@echo off
set "APP_DIR=%~dp0"
pushd "%APP_DIR%"

if not exist "package.json" (
    echo Could not find package.json in:
    echo %APP_DIR%
    pause
    popd
    exit /b 1
)

call npm start
popd
exit /b 0
