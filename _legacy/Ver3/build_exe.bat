@echo off
chcp 65001 >nul 2>&1
title NPD Feathering Analysis - EXE Builder

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║   EXE Build Script                        ║
echo   ║   PyInstaller one-file packaging           ║
echo   ╚══════════════════════════════════════════╝
echo.

REM --- Python 확인 ---
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Python이 필요합니다.
    pause
    exit /b 1
)

REM --- PyInstaller 확인 및 설치 ---
python -c "import PyInstaller" >nul 2>&1
if %errorlevel% neq 0 (
    echo   [INSTALL] PyInstaller를 설치합니다...
    pip install pyinstaller --quiet
    if %errorlevel% neq 0 (
        echo   [ERROR] PyInstaller 설치 실패.
        pause
        exit /b 1
    )
)

REM --- 의존성 설치 ---
pip install -r "%~dp0requirements.txt" --quiet

echo   [BUILD] EXE 빌드를 시작합니다...
echo           (약 1~3분 소요)
echo.

pyinstaller "%~dp0NPD_Feathering.spec" --noconfirm

if %errorlevel% equ 0 (
    echo.
    echo   ══════════════════════════════════════════
    echo   [OK] 빌드 성공!
    echo.
    echo   출력 위치: dist\NPD_Feathering_Analysis.exe
    echo   ══════════════════════════════════════════
    echo.

    if exist "%~dp0dist" (
        explorer "%~dp0dist"
    )
) else (
    echo.
    echo   [ERROR] 빌드 실패. 위 오류 메시지를 확인하세요.
)

pause
