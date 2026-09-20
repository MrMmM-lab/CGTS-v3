@echo off
title CGTS Launcher
echo ===================================================
echo     CGTS SYSTEM - LAUNCHER
echo ===================================================
echo.
echo Starting Backend Server (FastAPI)...
start "Cassava V3 Backend" cmd /c "cd backend && uvicorn main:app --reload --port 8000"

echo Starting Frontend Server (React + Vite)...
start "Cassava V3 Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo Waiting for servers to initialize...
timeout /t 3 >nul

echo Opening browser at http://localhost:5173...
start http://localhost:5173

echo.
echo [SUCCESS] Both servers are running! 
echo Feel free to close this launcher window.
timeout /t 5 >nul
exit
