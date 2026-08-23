@echo off
REM ============================================================
REM  Deliwifi - SETUP OTOMATIS (cukup double-klik file ini)
REM  Disarankan: klik kanan -> Run as administrator
REM ============================================================
title Deliwifi Setup Otomatis
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_windows.ps1"
echo.
pause
