@echo off
REM ============================================================
REM  Deliwifi - Menjalankan Server (backend + frontend)
REM  Biarkan kedua jendela hitam terbuka selama server hidup.
REM ============================================================
cd /d %~dp0

if not exist backend\.env (
    echo ERROR: backend\.env belum dibuat. Lihat PANDUAN_INSTALASI_WINDOWS.md Bagian 3.
    pause
    exit /b 1
)
if not exist frontend\build (
    echo ERROR: Frontend belum di-build. Jalankan install.bat dulu.
    pause
    exit /b 1
)

echo Menjalankan backend Deliwifi di port 8001...
start "Deliwifi Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\activate.bat && uvicorn server:app --host 0.0.0.0 --port 8001"

timeout /t 3 /nobreak >nul

echo Menjalankan frontend Deliwifi di port 3000...
start "Deliwifi Frontend" cmd /k "npx --yes serve -s %~dp0frontend\build -l 3000"

echo.
echo ============================================================
echo  Deliwifi berjalan!
echo  Buka di browser: http://localhost:3000
echo  Login admin    : agungsetiadi220@gmail.com
echo ============================================================
pause
