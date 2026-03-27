@echo off
cd /d "%~dp0"
echo Building Feathering Analysis...
npm run tauri build
echo.
echo Build complete. Installer at:
echo   src-tauri\target\release\bundle\
pause
