@echo off
setlocal

echo [INFO] Stopping any process using port 3000...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo [INFO] Killing PID %%P
  taskkill /PID %%P /F >nul 2>&1
)

echo [INFO] Done.

endlocal
