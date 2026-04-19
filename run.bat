@echo off
chcp 65001 >nul
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


if errorlevel 1 (
    echo.
    echo [Error] 앱 실행 실패 errorlevel=%errorlevel%
    echo 원인 확인 후 다시 실행해주세요.
    pause
    exit /b %errorlevel%
)
