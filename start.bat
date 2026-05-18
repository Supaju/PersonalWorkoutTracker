@echo off
cd /d "%~dp0"
echo Starting WorkoutTracker...
echo.
echo Local:    http://localhost:3000
echo Network:  http://%COMPUTERNAME%:3000
echo.
echo Press Ctrl+C to stop the server.
echo.
npm run dev -- --hostname 0.0.0.0
pause
