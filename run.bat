@echo off
cd /d "%~dp0"
if exist "src-tauri\target\debug\feathering-app.exe" (
    start "" "src-tauri\target\debug\feathering-app.exe"
    exit /b
)
npm run tauri dev
