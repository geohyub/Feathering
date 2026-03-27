@echo off
chcp 65001 >nul 2>&1
title NPD Feathering Analysis v2.1

echo.
echo   ╔══════════════════════════════════════════╗
echo   ║   NPD Feathering Analysis  v2.1          ║
echo   ║   Seismic Survey Feathering Tool          ║
echo   ╚══════════════════════════════════════════╝
echo.

REM --- Python 찾기 ---
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Python이 설치되어 있지 않거나 PATH에 등록되지 않았습니다.
    echo           https://www.python.org/downloads/ 에서 Python 3.10+ 설치
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo   [OK] %PYVER% 감지됨

REM --- 의존성 확인 ---
python -c "import pandas, numpy, matplotlib" >nul 2>&1
if %errorlevel% neq 0 (
    echo   [INSTALL] 필요한 패키지를 설치합니다...
    pip install -r "%~dp0requirements.txt" --quiet
    if %errorlevel% neq 0 (
        echo   [ERROR] 패키지 설치 실패. pip 또는 인터넷 연결을 확인하세요.
        pause
        exit /b 1
    )
    echo   [OK] 패키지 설치 완료
)

echo   [RUN] GUI를 시작합니다...
echo.
python "%~dp0GUI.py"

if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] 프로그램 실행 중 오류가 발생했습니다.
    echo           오류 내용을 확인하고 다시 시도해주세요.
    echo.
    pause
)
