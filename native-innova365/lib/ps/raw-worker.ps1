# Рабочий процесс агента печати Innova365 (Windows PowerShell 5.1+).
# Компилирует вызов winspool один раз и обслуживает команды из stdin (по одной JSON-строке):
#   {"id":1,"cmd":"list"}
#   {"id":2,"cmd":"print","printer":"POS-80","file":"C:\\...\\job.bin"}
# Ответы — JSON-строки в stdout: {"id":1,"ok":true,"data":...} / {"id":2,"ok":false,"error":"..."}.

$ErrorActionPreference = 'Stop'
[Console]::InputEncoding  = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.IO;
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

function Reply($id, $ok, $data, $err) {
  $o = [ordered]@{ id = $id; ok = $ok }
  if ($null -ne $data) { $o.data = $data }
  if ($err) { $o.error = $err }
  # ASCII-only JSON (\uXXXX) — не зависит от кодировки консоли
  $json = $o | ConvertTo-Json -Compress -Depth 6
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $json.ToCharArray()) { if ([int]$ch -gt 126) { [void]$sb.AppendFormat('\u{0:x4}', [int]$ch) } else { [void]$sb.Append($ch) } }
  [Console]::Out.WriteLine($sb.ToString())
  [Console]::Out.Flush()
}

[Console]::Out.WriteLine('{"ready":true}')
[Console]::Out.Flush()

while ($null -ne ($line = [Console]::In.ReadLine())) {
  if (-not $line.Trim()) { continue }
  $req = $null
  try {
    $req = $line | ConvertFrom-Json
    switch ($req.cmd) {
      'list' {
        $items = @(Get-CimInstance Win32_Printer | ForEach-Object {
          [ordered]@{ name = $_.Name; port = $_.PortName; driver = $_.DriverName; isDefault = [bool]$_.Default; offline = [bool]$_.WorkOffline }
        })
        Reply $req.id $true $items $null
      }
      'print' {
        $bytes = [System.IO.File]::ReadAllBytes($req.file)
        [RawPrint]::Send([string]$req.printer, $bytes)
        Reply $req.id $true $null $null
      }
      default { Reply $req.id $false $null ('unknown cmd: ' + $req.cmd) }
    }
  } catch {
    $id = if ($req) { $req.id } else { 0 }
    Reply $id $false $null $_.Exception.Message
  }
}
