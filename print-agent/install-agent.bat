@echo off
chcp 65001 >nul
title Innova365 - установка агента печати
rem Запускайте ОТ ИМЕНИ АДМИНИСТРАТОРА (ПКМ - «Запуск от имени администратора»).
rem Делает три вещи: открывает порт 9101 в брандмауэре (только частные сети), добавляет агент в автозапуск и запускает его.
net session >nul 2>&1
if errorlevel 1 (
  echo Нужны права администратора. Нажмите правой кнопкой на файл - "Запуск от имени администратора".
  pause & exit /b 1
)
set "DIR=%~dp0"
netsh advfirewall firewall delete rule name="Innova365 print agent" >nul 2>&1
netsh advfirewall firewall add rule name="Innova365 print agent" dir=in action=allow protocol=TCP localport=9101 profile=private,domain >nul
schtasks /Delete /TN "Innova365 PrintAgent" /F >nul 2>&1
schtasks /Create /TN "Innova365 PrintAgent" /SC ONLOGON /RL HIGHEST /F /TR "powershell.exe -NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%DIR%agent.ps1\"" >nul
if errorlevel 1 (echo Не удалось создать задачу автозапуска. & pause & exit /b 1)
schtasks /Run /TN "Innova365 PrintAgent" >nul
echo.
echo Готово: порт 9101 открыт, агент добавлен в автозапуск и уже работает в фоне.
echo Токен агента лежит в файле agent-token.txt рядом с этим файлом.
echo Удалить: uninstall-agent.bat
pause
