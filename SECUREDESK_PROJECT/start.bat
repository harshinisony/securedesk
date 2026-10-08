@echo off
title SecureDesk Launcher
echo ========================================================
echo               SecureDesk Incident Response Portal
echo ========================================================
echo.
echo Starting Backend API Server (Port 5000)...
start "SecureDesk Backend API" cmd /k "cd /d "%~dp0securedesk" && "venv\Scripts\python.exe" run.py"

echo Starting Frontend Static Server (Port 5500)...
start "SecureDesk Frontend" cmd /k "cd /d "%~dp0" && "securedesk\venv\Scripts\python.exe" -m http.server 5500 --directory securedesk-frontend"

echo.
echo Waiting for servers to initialize...
timeout /t 3 /nobreak > nul

echo Opening browser at http://127.0.0.1:5500/index.html ...
start http://127.0.0.1:5500/index.html

echo.
echo ========================================================
echo   Backend URL : http://127.0.0.1:5000/api/health
echo   Frontend URL: http://127.0.0.1:5500/api/health
echo.
echo.
pause

echo   Demo Accounts:
echo     Admin:        admin@securedesk.local       / AdminPassword123!
echo     Investigator: investigator@securedesk.local/ Investigator123!
echo     Employee:     employee@securedesk.local    / EmployeePassword123!
echo ========================================================