# Deliwifi - Setup Otomatis Windows
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Meminta izin Administrator (klik Yes di jendela yang muncul)..." -ForegroundColor Yellow
    try {
        Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    } catch {
        Write-Host ""
        Write-Host "Setup membutuhkan izin Administrator. Klik 'Yes' saat diminta, atau klik kanan SETUP_OTOMATIS.bat -> Run as administrator." -ForegroundColor Red
        Read-Host "Tekan Enter untuk menutup"
        exit 1
    }
    exit 0
}

function Step($msg) { Write-Host ""; Write-Host "=== $msg ===" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "OK: $msg" -ForegroundColor Green }
function Fail($msg) {
    Write-Host ""
    Write-Host "GAGAL: $msg" -ForegroundColor Red
    Write-Host "Baca PANDUAN_INSTALASI_WINDOWS.md Bagian 8 (Troubleshooting)." -ForegroundColor Yellow
    Read-Host "Tekan Enter untuk menutup"
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
    Write-Host "MongoDB belum ada. Mencoba install via winget..."
    $wingetOk = $false
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        $wingetLog = Join-Path $env:TEMP "deliwifi-winget.log"
        winget source update --accept-source-agreements *> $wingetLog
        winget install -e --id MongoDB.Server --accept-package-agreements --accept-source-agreements *>> $wingetLog
        $wingetOk = [bool](Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue)
        if (-not $wingetOk) { Write-Host "winget gagal (log: $wingetLog). Beralih ke unduhan langsung..." -ForegroundColor Yellow }
    } else {
        Write-Host "winget tidak tersedia. Beralih ke unduhan langsung..." -ForegroundColor Yellow
    }
    if (-not $wingetOk) {
        $ProgressPreference = "SilentlyContinue"
        try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
        $msiUrl = $null
        try {
            $current = Invoke-RestMethod -Uri "https://downloads.mongodb.org/current.json" -UseBasicParsing
            $ver = $current.versions | Where-Object { $_.production_release -eq $true } | Select-Object -First 1
            $dl = $ver.downloads | Where-Object { $_.target -eq "windows" -and $_.edition -eq "base" } | Select-Object -First 1
            if ($dl -and $dl.msi) { $msiUrl = $dl.msi }
        } catch {}
        if (-not $msiUrl) { $msiUrl = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-8.0.29-signed.msi" }
        Write-Host "Mengunduh MongoDB (~350 MB, mohon tunggu beberapa menit)..."
        Write-Host "Sumber: $msiUrl"
        $msi = Join-Path $env:TEMP "mongodb-installer.msi"
        try {
            Invoke-WebRequest -Uri $msiUrl -OutFile $msi -UseBasicParsing
        } catch {
            Fail "Gagal mengunduh MongoDB. Cek koneksi internet, atau install manual: https://www.mongodb.com/try/download/community (centang 'Install MongoDB as a Service')"
        }
        if ((Get-Item $msi).Length -lt 50MB) {
            Remove-Item $msi -Force -ErrorAction SilentlyContinue
            Fail "File unduhan MongoDB tidak valid. Install manual: https://www.mongodb.com/try/download/community (centang 'Install MongoDB as a Service')"
        }
        Write-Host "Menginstall MongoDB sebagai service (silent, beberapa menit)..."
        $proc = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn ADDLOCAL=ServerService SHOULD_INSTALL_COMPASS=0" -Wait -PassThru
        if ($proc.ExitCode -ne 0) {
            Remove-Item $msi -Force -ErrorAction SilentlyContinue
            Fail "Instalasi MongoDB gagal (kode $($proc.ExitCode)). Install manual: https://www.mongodb.com/try/download/community (centang 'Install MongoDB as a Service')"
        }
        Remove-Item $msi -Force -ErrorAction SilentlyContinue
    }
    $mongo = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    if (-not $mongo) { Fail "MongoDB gagal terinstall otomatis. Install manual dari https://www.mongodb.com/try/download/community (centang 'Install as Service')" }
}
if ($mongo.Status -ne "Running") {
    Start-Service MongoDB -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    $mongo = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    if (-not $mongo -or $mongo.Status -ne "Running") { Fail "Service MongoDB tidak bisa dijalankan. Buka services.msc dan start 'MongoDB' manual, lalu ulangi script ini." }
}
Ok "MongoDB berjalan"

Step "4/7 Membuat file konfigurasi (.env)"
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -match "^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)" } |
    Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "localhost" }

$beEnv = Join-Path $root "backend\.env"
if (Test-Path $beEnv) {
    $envContent = Get-Content $beEnv -Raw
    if ($ip -ne "localhost" -and $envContent -notmatch [regex]::Escape("http://${ip}:3000")) {
        $envContent = $envContent -replace 'CORS_ORIGINS="([^"]*)"', ('CORS_ORIGINS="$1,http://' + $ip + ':3000"')
        $envContent | Out-File -FilePath $beEnv -Encoding ascii
        Ok "backend\.env diperbarui: CORS_ORIGINS ditambah http://${ip}:3000"
    } else {
        Write-Host "backend\.env sudah ada, dilewati"
    }
} else {
    $chars = (48..57) + (65..90) + (97..122)
    $secret = -join ($chars | Get-Random -Count 48 | ForEach-Object { [char]$_ })
    @"
MONGO_URL="mongodb://localhost:27017"
DB_NAME="deliwifi"
CORS_ORIGINS="http://localhost:3000,http://${ip}:3000"
JWT_SECRET="$secret"
ADMIN_EMAIL="agungsetiadi220@gmail.com"
ADMIN_PASSWORD="deliwifi123"
"@ | Out-File -FilePath $beEnv -Encoding ascii
    Ok "backend\.env dibuat otomatis"
}

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

# Pengaman: buang paket internal Emergent yang tidak ada di PyPI publik
$reqFile = Join-Path $root "backend\requirements.txt"
$reqClean = Join-Path $env:TEMP "deliwifi-requirements.txt"
Get-Content $reqFile | Where-Object { $_ -notmatch "emergentintegrations" -and $_ -notmatch "customer-assets\.emergentagent\.com" } | Out-File -FilePath $reqClean -Encoding ascii

& (Join-Path $root "backend\venv\Scripts\python.exe") -m pip install --upgrade pip | Out-Null
& (Join-Path $root "backend\venv\Scripts\python.exe") -m pip install -r $reqClean
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
Read-Host "Tekan Enter untuk menutup jendela ini"
