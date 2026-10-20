@echo off
chcp 65001 >nul
net session >nul 2>&1
if errorlevel 1 (echo Запустите от имени администратора. & pause & exit /b 1)
schtasks /End /TN "Innova365 PrintAgent" >nul 2>&1
schtasks /Delete /TN "Innova365 PrintAgent" /F >nul 2>&1
netsh advfirewall firewall delete rule name="Innova365 print agent" >nul 2>&1
echo Агент удалён из автозапуска, правило брандмауэра убрано.
pause
