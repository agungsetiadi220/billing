@echo off
title Deliwifi - Perbaikan Instalasi Backend
cd /d %~dp0

if not exist backend (
    echo.
    echo ERROR: File PERBAIKI.bat ini harus diletakkan di dalam folder deliwifi,
    echo yaitu sejajar dengan folder "backend" dan "frontend".
    echo Pindahkan file ini ke sana, lalu double-klik lagi.
    echo.
    pause
    exit /b 1
)

echo.
echo [1/4] Memperbaiki requirements.txt...
(
echo fastapi^>=0.115,^<1.0
echo uvicorn[standard]^>=0.30,^<1.0
echo motor^>=3.6,^<4.0
echo pydantic[email]^>=2.9,^<3.0
echo python-dotenv^>=1.0,^<2.0
echo PyJWT^>=2.9,^<3.0
echo bcrypt^>=4.2,^<6.0
echo httpx^>=0.28,^<1.0
echo routeros-api^>=0.21,^<1.0
) > backend\requirements.txt
echo OK - requirements.txt sekarang hanya berisi 9 paket inti.

echo.
echo [2/4] Menghapus environment Python lama yang rusak...
if exist backend\venv rmdir /s /q backend\venv
echo OK

echo.
echo [3/4] Menginstall ulang dependensi backend (hanya 9 paket, lebih cepat)...
python -m venv backend\venv
if errorlevel 1 (
    echo GAGAL membuat venv. Pastikan Python terinstall dan ada di PATH.
    pause
    exit /b 1
)
backend\venv\Scripts\python.exe -m pip install --upgrade pip --quiet
backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 (
    echo.
    echo MASIH GAGAL. Screenshot semua pesan di atas dan kirim ke developer.
    pause
    exit /b 1
)
echo OK - backend terinstall.

echo.
echo [4/4] Selesai! Menjalankan Deliwifi...
echo.
call start.bat
