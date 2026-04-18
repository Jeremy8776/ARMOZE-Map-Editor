@echo off
set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%"
set "APP_DIR=%CD%"
set "ELECTRON_CMD=%APP_DIR%\node_modules\.bin\electron.cmd"

if not exist "%ELECTRON_CMD%" (
    echo Could not find the local Electron launcher at:
    echo %ELECTRON_CMD%
    pause
    popd
    exit /b 1
)

call "%ELECTRON_CMD%" "%APP_DIR%"
popd
exit /b 0
