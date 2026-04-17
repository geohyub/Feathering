@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo   Feathering Analysis - Full Build
echo ============================================================

echo.
echo [1/2] Building Python backend sidecar (PyInstaller)...
pushd src-tauri\python
pyinstaller backend.spec --clean --noconfirm
if errorlevel 1 (
    popd
    echo.
    echo [ERROR] PyInstaller build failed. Install pyinstaller:
    echo   pip install pyinstaller numpy pandas matplotlib
    exit /b 1
)
if not exist dist\feathering-backend.exe (
    popd
    echo [ERROR] Expected dist\feathering-backend.exe was not produced.
    exit /b 1
)
popd

echo.
echo [2/3] Building Tauri installer...
call npm run tauri build
if errorlevel 1 (
    echo.
    echo [ERROR] Tauri build failed.
    exit /b 1
)

echo.
echo [3/3] Injecting backend sidecar into bundle resources...
set SIDECAR_SRC=src-tauri\python\dist\feathering-backend.exe
set BUNDLE_ROOT=src-tauri\target\release\bundle
if exist "%BUNDLE_ROOT%\nsis" (
    for /d %%D in ("%BUNDLE_ROOT%\nsis\*") do copy /Y "%SIDECAR_SRC%" "%%D\python\" >nul 2>&1
)
if exist "%BUNDLE_ROOT%\msi" (
    for /d %%D in ("%BUNDLE_ROOT%\msi\*") do copy /Y "%SIDECAR_SRC%" "%%D\python\" >nul 2>&1
)
rem Also copy next to the unpackaged exe for developer smoke-testing
if exist "src-tauri\target\release\feathering-analysis.exe" (
    copy /Y "%SIDECAR_SRC%" "src-tauri\target\release\python\" >nul 2>&1
)

echo.
echo Build complete. Installer at:
echo   src-tauri\target\release\bundle\
echo The sidecar feathering-backend.exe is copied next to each installer's
echo python/ resource directory.
