@echo off
REM ============================================================
REM  Deliwifi - Installer Windows (jalankan SEKALI saja)
REM  Klik kanan -> Run as administrator
REM ============================================================
cd /d %~dp0

echo.
echo [1/5] Mengecek Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python tidak ditemukan. Install Python 3.10+ dulu dan centang "Add Python to PATH".
    pause
    exit /b 1
)

echo [2/5] Membuat virtual environment backend...
python -m venv backend\venv
if errorlevel 1 goto gagal

echo [3/5] Menginstall dependensi backend...
call backend\venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
if errorlevel 1 goto gagal

echo [4/5] Menginstall dependensi frontend...
cd frontend
call yarn install
if errorlevel 1 goto gagal

echo [5/5] Build frontend untuk production...
call yarn build
if errorlevel 1 goto gagal
cd ..

echo.
echo ============================================================
echo  INSTALASI SELESAI!
echo  Pastikan file backend\.env dan frontend\.env sudah dibuat
echo  ^(lihat PANDUAN_INSTALASI_WINDOWS.md Bagian 3^),
echo  lalu jalankan start.bat
echo ============================================================
pause
exit /b 0

:gagal
echo.
echo INSTALASI GAGAL. Baca PANDUAN_INSTALASI_WINDOWS.md Bagian 8 (Troubleshooting).
pause
exit /b 1
