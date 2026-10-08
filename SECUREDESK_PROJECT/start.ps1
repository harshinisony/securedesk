# SecureDesk Launcher (PowerShell)
$root = $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "           SecureDesk Incident Response Portal          " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$pythonExe = Join-Path $root "securedesk\venv\Scripts\python.exe"

# Start Backend API
Write-Host "Starting Backend API Server (Port 5000)..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$root\securedesk`" && `"$pythonExe`" run.py" -WindowStyle Normal

# Start Frontend
Write-Host "Starting Frontend Server (Port 5500)..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$root`" && `"$pythonExe`" -m http.server 5500 --directory securedesk-frontend" -WindowStyle Normal

Write-Host "Waiting for servers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Launch Browser
Write-Host "Launching web browser at http://127.0.0.1:5500/index.html" -ForegroundColor Green
Start-Process "http://127.0.0.1:5500/index.html"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Backend URL : http://127.0.0.1:5000/api/health" -ForegroundColor White
Write-Host "  Frontend URL: http://127.0.0.1:5500/index.html" -ForegroundColor White
Write-Host ""
Write-Host "  Demo Accounts:" -ForegroundColor Yellow
Write-Host "    Admin:        admin@securedesk.local        / AdminPassword123!" -ForegroundColor White
Write-Host "    Investigator: investigator@securedesk.local / Investigator123!" -ForegroundColor White
Write-Host "    Employee:     employee@securedesk.local     / EmployeePassword123!" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
