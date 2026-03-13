@echo off
chcp 65001 >nul 2>&1
title Feathering Analysis

echo.
echo   ==========================================
echo     Feathering Analysis - Launcher
echo   ==========================================
echo.

REM --- Python ---
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Python not found. Install Python 3.10+
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo   [OK] %PYVER%

REM --- Packages ---
python -c "import pandas, numpy, matplotlib" >nul 2>&1
if %errorlevel% neq 0 (
    echo   [INSTALL] Installing packages...
    pip install -r "%~dp0requirements.txt" --quiet
    if %errorlevel% neq 0 (
        echo   [ERROR] Package install failed.
        pause
        exit /b 1
    )
    echo   [OK] Packages installed
)

echo   [RUN] Starting GUI...
echo.
python "%~dp0GUI.py"

if %errorlevel% neq 0 (
    echo.
    echo   [ERROR] Runtime error occurred.
    pause
)
