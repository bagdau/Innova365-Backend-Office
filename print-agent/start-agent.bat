@echo off
chcp 65001 >nul
title Innova365 - агент печати
cd /d "%~dp0"
:loop
rem Node.js не нужен: агент работает на PowerShell, который есть в Windows 10/11
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0agent.ps1"
echo.
echo Агент остановился. Перезапуск через 3 секунды... (закройте окно, чтобы выйти)
timeout /t 3 >nul
goto loop
