@echo off
title MapSave PAK Extractor
REM Launches ExtractTexture.ps1 in interactive mode from the same directory.
REM Bypasses execution policy for this session only — no system-wide changes.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ExtractTexture.ps1"

REM Catch cases where PowerShell exits before the script's own Read-Host fires
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Script exited with error code: %ERRORLEVEL%
)
pause
