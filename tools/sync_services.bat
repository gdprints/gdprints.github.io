@echo off
setlocal
cd /d "%~dp0"

where powershell.exe >nul 2>nul
if errorlevel 1 goto :fallback

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_services_ui.ps1"
exit /b %errorlevel%

:fallback
echo GDprint Service Sync
echo --------------------
cd /d "%~dp0.."
where py.exe >nul 2>nul
if not errorlevel 1 (
  py -3 tools\sync_services.py
) else (
  python tools\sync_services.py
)
pause
