@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BE_DIR=%ROOT_DIR%be"

echo [INFO] Stopping any process using port 3000...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /PID %%P /F >nul 2>&1
)

echo [INFO] Starting backend from:
echo        %BE_DIR%

cd /d "%BE_DIR%"
start "Xuan Phu Backend" cmd /k node server-main.js

echo [INFO] Backend launch requested.
echo [INFO] Open these URLs after the new terminal appears:
echo        http://localhost:3000/
echo        http://localhost:3000/admin

endlocal
