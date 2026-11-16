@echo off
setlocal
pushd "%~dp0" || exit /b 1

set "MUSE_EXE=target\release\songbook-muse.exe"
if exist "%MUSE_EXE%" goto launch
set "MUSE_EXE=target\debug\songbook-muse.exe"
if exist "%MUSE_EXE%" goto launch

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo Node.js and npm are required to build SongBookMuse.
    goto failed
)
where cargo.exe >nul 2>&1
if errorlevel 1 (
    echo Rust and Cargo are required to build SongBookMuse.
    goto failed
)

if not exist "node_modules\.bin\tauri.cmd" (
    call npm.cmd ci
    if errorlevel 1 goto failed
)

echo Building SongBookMuse for the first launch...
call npm.cmd run tauri -- build --debug --no-bundle
if errorlevel 1 goto failed
if not exist "%MUSE_EXE%" goto failed

:launch
start "" "%MUSE_EXE%"
if errorlevel 1 goto failed
popd
exit /b 0

:failed
echo.
echo SongBookMuse could not start. Check the messages above.
pause
popd
exit /b 1
