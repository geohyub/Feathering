@echo off
cd /d "%~dp0"
if exist "src-tauri\target\debug\feathering-app.exe" (
    start "" "src-tauri\target\debug\feathering-app.exe"
    exit /b
)
if exist "src-tauri\target\release\feathering-app.exe" (
    start "" "src-tauri\target\release\feathering-app.exe"
    exit /b
)
echo [ERROR] feathering-app.exe not found. Run "npm run tauri build" first.
pause
