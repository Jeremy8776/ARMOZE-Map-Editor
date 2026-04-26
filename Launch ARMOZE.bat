@echo off
set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%"
set "APP_DIR=%CD%"
set "ELECTRON_CMD=%APP_DIR%\node_modules\.bin\electron.cmd"
set "ELECTRON_EXE=%APP_DIR%\.electron-runner\node_modules\electron\dist\electron.exe"

if exist "%ELECTRON_EXE%" (
    start "" /D "%APP_DIR%" "%ELECTRON_EXE%" .
    popd
    exit /b 0
)

if exist "%ELECTRON_CMD%" (
    call "%ELECTRON_CMD%" "%APP_DIR%"
    popd
    exit /b %ERRORLEVEL%
)

echo Could not find a local Electron launcher at:
echo %ELECTRON_EXE%
echo or:
echo %ELECTRON_CMD%
echo.
echo Try running:
echo npm install
pause
popd
exit /b 1
