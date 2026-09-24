@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\launch.ps1" -Mode desktop
if errorlevel 1 pause
endlocal
