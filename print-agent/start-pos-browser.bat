@echo off
chcp 65001 >nul
rem Открывает Innova365 как приложение на весь экран для кассы:
rem   --kiosk-printing  — печать через «Окно системы» идёт сразу на принтер Windows по умолчанию, без диалога;
rem   --unsafely-treat-insecure-origin-as-secure — страница по http:// (адрес сервера) может обращаться к агенту печати
rem                      на этом же компьютере (127.0.0.1:9101) — так чек печатается «родными» командами ESC/POS.
rem Использование: start-pos-browser.bat http://194.32.142.75:8080
set "URL=%~1"
if "%URL%"=="" set "URL=http://194.32.142.75:8080"
for /f "tokens=1,2 delims=/" %%A in ("%URL%") do set "ORIGIN=%%A//%%B"
set "FLAGS=--kiosk-printing --unsafely-treat-insecure-origin-as-secure=%ORIGIN% --app=%URL% --user-data-dir=%LocalAppData%\Innova365-pos"
set "CHROME="
for %%P in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do if exist %%P set "CHROME=%%~P"
if defined CHROME (
  start "" "%CHROME%" %FLAGS%
  exit /b 0
)
for %%P in ("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe") do if exist %%P set "EDGE=%%~P"
if defined EDGE (
  start "" "%EDGE%" %FLAGS%
  exit /b 0
)
echo Не найден Chrome или Edge.
pause
