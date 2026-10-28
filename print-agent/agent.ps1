# Агент печати Innova365 на чистом PowerShell (Windows 10/11) — Node.js не нужен.
#
#   GET  /health                  — проверка (без токена)
#   GET  /printers                — список принтеров Windows (порт, USB, подключён ли)   (заголовок X-Token)
#   GET  /best                    — «умный» выбор: какой принтер лучше всего подходит для чеков
#   GET  /discover?subnet=a.b.c   — поиск сетевых принтеров (порт 9100) в локальной сети
#   POST /print?printer=<имя>     — тело = байты ESC/POS       (заголовок X-Token)
#
# Печать из браузера кассы: страница на сервере в интернете отправляет байты ESC/POS на 127.0.0.1:9101 этого ПК.
# Разрешены запросы только со страниц из allowed-origins.txt (и localhost) — посторонний сайт печатать не сможет.
#   POST /print?printer=auto|<имя>   либо   /print?host=<IP>&port=9100   (ретрансляция на сетевой принтер)
#
# Запуск: start-agent.bat  (или: powershell -ExecutionPolicy Bypass -File agent.ps1 -Port 9101)

param([int]$Port = 9101)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

# ───────── токен доступа ─────────
$tokenFile = Join-Path $here 'agent-token.txt'
if ($env:PRINT_AGENT_TOKEN) { $Token = $env:PRINT_AGENT_TOKEN }
elseif (Test-Path $tokenFile) { $Token = (Get-Content $tokenFile -Raw).Trim() }
else {
  $bytes = New-Object byte[] 18
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $Token = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  Set-Content -Path $tokenFile -Value $Token -Encoding ASCII
}

# ───────── RAW-печать через winspool ─────────
Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class RawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool OpenPrinter(string name, out IntPtr h, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern int StartDocPrinter(IntPtr h, int level, [In] DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool WritePrinter(IntPtr h, IntPtr buf, int count, out int written);

  public static void Send(string printer, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error(), "OpenPrinter: " + printer);
    try {
      var di = new DOCINFO { pDocName = "Innova365", pDataType = "RAW" };
      if (StartDocPrinter(h, 1, di) == 0) throw new Win32Exception(Marshal.GetLastWin32Error(), "StartDocPrinter");
      try {
        if (!StartPagePrinter(h)) throw new Win32Exception(Marshal.GetLastWin32Error(), "StartPagePrinter");
        IntPtr p = Marshal.AllocCoTaskMem(data.Length);
        try {
          Marshal.Copy(data, 0, p, data.Length);
          int w;
          if (!WritePrinter(h, p, data.Length, out w) || w != data.Length) throw new Win32Exception(Marshal.GetLastWin32Error(), "WritePrinter");
        } finally { Marshal.FreeCoTaskMem(p); }
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
"@

# ───────── мини HTTP-сервер на TcpListener (не требует прав администратора) ─────────
function Send-Json($stream, [int]$status, $obj) {
  $reason = @{ 200 = 'OK'; 204 = 'No Content'; 400 = 'Bad Request'; 401 = 'Unauthorized'; 404 = 'Not Found'; 413 = 'Payload Too Large'; 500 = 'Internal Server Error' }[$status]
  if ($status -eq 204) { $body = New-Object byte[] 0 } else { $body = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress -Depth 6)) }
  $head = "HTTP/1.1 $status $reason`r`nContent-Type: application/json; charset=utf-8`r`n$($script:Cors)Content-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length); $stream.Write($body, 0, $body.Length); $stream.Flush()
}

function Read-Request($stream) {
  $buf = New-Object byte[] 8192
  $ms = New-Object System.IO.MemoryStream
  $headerEnd = -1
  while ($headerEnd -lt 0) {
    $n = $stream.Read($buf, 0, $buf.Length)
    if ($n -le 0) { return $null }
    $ms.Write($buf, 0, $n)
    $all = $ms.ToArray()
    for ($i = 3; $i -lt $all.Length; $i++) {
      if ($all[$i - 3] -eq 13 -and $all[$i - 2] -eq 10 -and $all[$i - 1] -eq 13 -and $all[$i] -eq 10) { $headerEnd = $i + 1; break }
    }
    if ($ms.Length -gt 65536 -and $headerEnd -lt 0) { return $null }
  }
  $all = $ms.ToArray()
  $headText = [System.Text.Encoding]::ASCII.GetString($all, 0, $headerEnd)
  $lines = $headText -split "`r`n"
  $parts = $lines[0] -split ' '
  $headers = @{}
  foreach ($l in $lines[1..($lines.Length - 1)]) { $k = $l.IndexOf(':'); if ($k -gt 0) { $headers[$l.Substring(0, $k).Trim().ToLower()] = $l.Substring($k + 1).Trim() } }
  $len = 0; if ($headers.ContainsKey('content-length')) { $len = [int]$headers['content-length'] }
  $body = New-Object byte[] $len
  $have = $all.Length - $headerEnd
  if ($len -gt 0) {
    [Array]::Copy($all, $headerEnd, $body, 0, [Math]::Min($have, $len))
    $got = [Math]::Min($have, $len)
    while ($got -lt $len) { $n = $stream.Read($body, $got, $len - $got); if ($n -le 0) { break }; $got += $n }
  }
  return @{ method = $parts[0]; target = $parts[1]; headers = $headers; body = $body; length = $len }
}


# ───────── разрешённые источники (страницы, которым можно печатать) ─────────
$script:Cors = ''
$originsFile = Join-Path $here 'allowed-origins.txt'
$allowedOrigins = @()
if (Test-Path $originsFile) { $allowedOrigins += Get-Content $originsFile | ForEach-Object { $_.Trim().TrimEnd('/') } | Where-Object { $_ -and -not $_.StartsWith('#') } }
if ($env:PRINT_AGENT_ORIGINS) { $allowedOrigins += $env:PRINT_AGENT_ORIGINS -split ',' | ForEach-Object { $_.Trim().TrimEnd('/') } }
function Test-Origin($o) { return ($o -match '^https?://(localhost|127\.0\.0\.1)(:\d+)?$') -or ($allowedOrigins -contains $o) }

# ───────── список принтеров Windows и «умный» выбор ─────────
function Get-PrinterItems {
  @(Get-CimInstance Win32_Printer | ForEach-Object {
    $usb = ($_.PortName -match '^(USB|DOT4|COM|LPT)')
    $thermal = ($_.Name -match '(?i)(pos|xprinter|xp-|receipt|thermal|tm-|rp-?\d|bixolon|star|citizen|sam4s|rongta|gprinter|zjiang|\b(58|80)\s?mm)')
    $virtual = ($_.Name -match '(?i)(pdf|xps|onenote|fax|microsoft|anydesk|virtual|send to)')
    $score = 0; if ($thermal) { $score += 4 }; if ($usb -or $_.PortName -match '^(IP_|\d+\.)') { $score += 2 }; if ($_.Default) { $score += 1 }; if ($virtual) { $score -= 10 }; if ($_.WorkOffline) { $score -= 20 }
    [ordered]@{ name = $_.Name; port = $_.PortName; driver = $_.DriverName; isDefault = [bool]$_.Default; offline = [bool]$_.WorkOffline; usb = [bool]$usb; thermal = [bool]$thermal; score = $score } })
}
function Get-BestPrinter {
  $b = Get-PrinterItems |
    Where-Object { -not $_.offline -and ($_.thermal -or $_.name -match '(?i)(generic|text only)') } |
    Sort-Object { $_.score } -Descending |
    Select-Object -First 1
  if ($b) { return $b }
  return $null
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
$listener.Start()
$ips = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | ForEach-Object { $_.ToString() }
Write-Host '--------------------------------------------'
Write-Host ' Innova365 - агент печати запущен (PowerShell)'
Write-Host " Порт:   $Port"
Write-Host " Токен:  $Token"
Write-Host (" Адрес для Innova365:  http://{0}:{1}" -f ($ips | Select-Object -First 1), $Port)
Write-Host '--------------------------------------------'

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 10000; $client.SendTimeout = 10000
    $stream = $client.GetStream()
    $req = Read-Request $stream
    if ($null -eq $req) { continue }
    $uri = [System.Uri]('http://x' + $req.target)
    $path = $uri.AbsolutePath
    $origin = $req.headers['origin']
    $originOk = [bool]($origin -and (Test-Origin $origin))
    $script:Cors = ''
    if ($originOk) {
      $script:Cors = "Access-Control-Allow-Origin: $origin`r`nAccess-Control-Allow-Headers: X-Token, Content-Type`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Private-Network: true`r`nAccess-Control-Max-Age: 600`r`nVary: Origin`r`n"
    }
    if ($req.method -eq 'OPTIONS') { Send-Json $stream 204 @{ }; continue }
    if ($req.method -eq 'GET' -and $path -eq '/health') {
      Send-Json $stream 200 @{ ok = $true; agent = 'innova365'; host = $env:COMPUTERNAME; platform = 'win32'; version = '1.3.0-ps'; origin = $originOk }
      continue
    }
    # доступ: страница из списка разрешённых источников ИЛИ верный токен
    if (-not $originOk -and $req.headers['x-token'] -ne $Token) { Send-Json $stream 401 @{ error = 'bad token' }; continue }

    if ($req.method -eq 'GET' -and $path -eq '/printers') { Send-Json $stream 200 (Get-PrinterItems); continue }
    if ($req.method -eq 'GET' -and $path -eq '/best') {
      $best = Get-BestPrinter
      if ($best) { Send-Json $stream 200 $best } else { Send-Json $stream 404 @{ error = 'no suitable printer' } }
      continue
    }
    if ($req.method -eq 'GET' -and $path -eq '/discover') {
      $q = [System.Web.HttpUtility]::ParseQueryString($uri.Query)
      $subnet = $q['subnet']
      if (-not $subnet) { $mine = ($ips | Select-Object -First 1); if ($mine) { $subnet = ($mine -split '\.')[0..2] -join '.' } }
      if ($subnet -notmatch '^(10\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+|192\.168\.\d+)$') { Send-Json $stream 400 @{ error = 'private subnet required' }; continue }
      $tasks = 1..254 | ForEach-Object { $c = New-Object System.Net.Sockets.TcpClient; @{ ip = "$subnet.$_"; c = $c; t = $c.ConnectAsync("$subnet.$_", 9100) } }
      Start-Sleep -Milliseconds 700
      $found = @($tasks | Where-Object { $_.t.IsCompleted -and -not $_.t.IsFaulted -and $_.c.Connected } | ForEach-Object { $_.ip })
      $tasks | ForEach-Object { try { $_.c.Close() } catch { } }
      Send-Json $stream 200 @{ subnet = $subnet; printers = $found }
      continue
    }
    if ($req.method -eq 'POST' -and $path -eq '/print') {
      $q = [System.Web.HttpUtility]::ParseQueryString($uri.Query)
      if ($req.length -gt 2097152) { Send-Json $stream 413 @{ error = 'too large' }; continue }
      $sw = [Diagnostics.Stopwatch]::StartNew()
      try {
        if ($q['host']) {
          # ретрансляция на сетевой принтер (порт 9100) — только локальные адреса
          $h = $q['host']; $p = 9100; if ($q['port']) { $p = [int]$q['port'] }
          if ($h -notmatch '^(127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)$') { Send-Json $stream 400 @{ error = 'private address required' }; continue }
          $tc = New-Object System.Net.Sockets.TcpClient
          $iar = $tc.BeginConnect($h, $p, $null, $null)
          if (-not $iar.AsyncWaitHandle.WaitOne(3000)) { $tc.Close(); throw "printer $h`:$p not reachable" }
          $tc.EndConnect($iar)
          $ns = $tc.GetStream(); $ns.Write([byte[]]$req.body, 0, $req.length); $ns.Flush(); Start-Sleep -Milliseconds 150; $tc.Close()
          $printer = "$h`:$p"
        } else {
          $printer = $q['printer']
          if (-not $printer -or $printer -eq 'auto') { $best = Get-BestPrinter; if (-not $best) { Send-Json $stream 404 @{ error = 'no suitable printer' }; continue }; $printer = $best.name }
          [RawPrint]::Send($printer, [byte[]]$req.body)
        }
        Write-Host ("[print] `"{0}`" {1} bytes {2} ms" -f $printer, $req.length, $sw.ElapsedMilliseconds)
        Send-Json $stream 200 @{ ok = $true; ms = $sw.ElapsedMilliseconds; printer = $printer }
      } catch {
        Write-Host ("[error] " + $_.Exception.Message)
        Send-Json $stream 500 @{ error = $_.Exception.Message }
      }
      continue
    }
    Send-Json $stream 404 @{ error = 'not found' }
  } catch {
    try { Send-Json $stream 500 @{ error = $_.Exception.Message } } catch { }
  } finally {
    try { $client.Close() } catch { }
  }
}
