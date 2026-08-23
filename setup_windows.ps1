# Deliwifi - Setup Otomatis Windows
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Step($msg) { Write-Host ""; Write-Host "=== $msg ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "OK: $msg" -ForegroundColor Green }
function Fail($msg) {
    Write-Host ""
    Write-Host "GAGAL: $msg" -ForegroundColor Red
    Write-Host "Baca PANDUAN_INSTALASI_WINDOWS.md Bagian 8 (Troubleshooting)." -ForegroundColor Yellow
    exit 1
}

Step "1/7 Mengecek Python & Node.js"
foreach ($cmd in @("python", "node", "npm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Fail "$cmd tidak ditemukan. Install dulu dari situs resminya, lalu jalankan lagi SETUP_OTOMATIS.bat"
    }
}
Ok "Python & Node.js ditemukan"

Step "2/7 Mengecek Yarn"
if (-not (Get-Command yarn -ErrorAction SilentlyContinue)) {
    npm install -g yarn
    if ($LASTEXITCODE -ne 0) { Fail "Gagal install yarn" }
}
Ok "Yarn siap"

Step "3/7 Mengecek MongoDB (database)"
$mongo = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if (-not $mongo) {
    Write-Host "MongoDB belum ada, menginstall otomatis via winget (butuh internet, beberapa menit)..."
    winget install -e --id MongoDB.Server --accept-package-agreements --accept-source-agreements
    $mongo = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    if (-not $mongo) { Fail "MongoDB gagal terinstall otomatis. Install manual dari https://www.mongodb.com/try/download/community (centang 'Install as Service')" }
}
if ($mongo.Status -ne "Running") { Start-Service MongoDB -ErrorAction SilentlyContinue }
Ok "MongoDB berjalan"

Step "4/7 Membuat file konfigurasi (.env)"
$beEnv = Join-Path $root "backend\.env"
if (Test-Path $beEnv) {
    Write-Host "backend\.env sudah ada, dilewati"
} else {
    $chars = (48..57) + (65..90) + (97..122)
    $secret = -join ($chars | Get-Random -Count 48 | ForEach-Object { [char]$_ })
    @"
MONGO_URL="mongodb://localhost:27017"
DB_NAME="deliwifi"
CORS_ORIGINS="http://localhost:3000"
JWT_SECRET="$secret"
ADMIN_EMAIL="agungsetiadi220@gmail.com"
ADMIN_PASSWORD="deliwifi123"
"@ | Out-File -FilePath $beEnv -Encoding ascii
    Ok "backend\.env dibuat otomatis"
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -match "^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)" } |
    Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "localhost" }

$feEnv = Join-Path $root "frontend\.env"
if (Test-Path $feEnv) {
    Write-Host "frontend\.env sudah ada, dilewati"
} else {
    "REACT_APP_BACKEND_URL=http://${ip}:8001" | Out-File -FilePath $feEnv -Encoding ascii
    Ok "frontend\.env dibuat otomatis (IP laptop terdeteksi: $ip)"
}

Step "5/7 Menginstall backend (bisa beberapa menit)"
python -m venv (Join-Path $root "backend\venv")
if ($LASTEXITCODE -ne 0) { Fail "Gagal membuat virtual environment Python" }
& (Join-Path $root "backend\venv\Scripts\python.exe") -m pip install --upgrade pip | Out-Null
& (Join-Path $root "backend\venv\Scripts\python.exe") -m pip install -r (Join-Path $root "backend\requirements.txt")
if ($LASTEXITCODE -ne 0) { Fail "Gagal install dependensi backend" }
Ok "Backend terinstall"

Step "6/7 Menginstall & build frontend (bisa 5-15 menit)"
Push-Location (Join-Path $root "frontend")
yarn install
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Gagal yarn install" }
yarn build
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Gagal build frontend" }
Pop-Location
Ok "Frontend ter-build"

Step "7/7 Auto-startup"
$answer = Read-Host "Jalankan Deliwifi otomatis setiap laptop nyala? (Y/n)"
if ($answer -ne "n" -and $answer -ne "N") {
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Deliwifi.lnk")
    $sc.TargetPath = Join-Path $root "start.bat"
    $sc.WorkingDirectory = $root
    $sc.Save()
    Ok "Auto-startup dipasang"
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  INSTALASI SELESAI! Menjalankan Deliwifi..." -ForegroundColor Green
Write-Host "  Buka browser : http://${ip}:3000" -ForegroundColor Green
Write-Host "  Login admin  : agungsetiadi220@gmail.com" -ForegroundColor Green
Write-Host "  Password     : deliwifi123 (segera ganti setelah login)" -ForegroundColor Yellow
Write-Host "  Selanjutnya  : menu Pengaturan -> isi kredensial MikroTik" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Start-Process -FilePath (Join-Path $root "start.bat")
