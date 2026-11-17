@echo off
setlocal
pushd "%~dp0" || exit /b 1

if /i "%~1"=="run" goto run
if /i "%~1"=="build" goto build
if not "%~1"=="" (
    echo Usage: run.bat [run ^| build]
    popd
    exit /b 1
)

set "MUSE_INTERACTIVE=1"
echo [R] Run the newest local build
echo [B] Build and run
choice /c RB /n /m "Choose an option: "
if errorlevel 3 goto failed
if errorlevel 2 goto build
if not errorlevel 1 goto failed

:run
set "MUSE_EXE="
for /f "delims=" %%D in ('powershell.exe -NoProfile -Command "Get-Item -LiteralPath target/debug/songbook-muse.exe,target/release/songbook-muse.exe -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1 | ForEach-Object { $_.Directory.Name }"') do set "MUSE_EXE=target\%%D\songbook-muse.exe"
if defined MUSE_EXE goto launch
echo No local build found.

:build
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

echo Building SongBookMuse from the current source...
call npm.cmd run tauri -- build --debug --no-bundle
if errorlevel 1 (
    echo If the debug build of SongBookMuse is open, close it before rebuilding.
    goto failed
)
set "MUSE_EXE=target\debug\songbook-muse.exe"
if not exist "%MUSE_EXE%" goto failed

:launch
echo Starting %MUSE_EXE%...
start "" "%MUSE_EXE%" || goto failed
popd
exit /b 0

:failed
echo.
echo SongBookMuse could not start. Check the messages above.
if defined MUSE_INTERACTIVE pause
popd
exit /b 1
