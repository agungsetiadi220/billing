# Panduan Instalasi Deliwifi di Laptop Windows (Server 24 Jam)

## CARA TERMUDAH (3 Langkah)

1. **Simpan kode ke GitHub:** di Emergent klik **Save → Save to GitHub** (hubungkan akun GitHub Anda).
2. **Download ZIP:** buka repo Anda di github.com → tombol hijau **Code → Download ZIP** → extract ke folder, misal `C:\deliwifi`.
3. **Double-klik `SETUP_OTOMATIS.bat`** (klik kanan → Run as administrator). Script otomatis:
   - Mengecek Python & Node.js
   - Menginstall MongoDB (database) otomatis
   - Membuat file konfigurasi `.env` otomatis (termasuk deteksi IP laptop)
   - Menginstall semua dependensi & build aplikasi
   - Menawarkan auto-startup saat laptop nyala
   - Langsung menjalankan aplikasi

Selesai! Buka browser → `http://localhost:3000` → login `agungsetiadi220@gmail.com` / `deliwifi123` (segera ganti password). Lalu lanjut ke **BAGIAN 6** untuk menghubungkan MikroTik.

> Setiap mau menyalakan server berikutnya cukup double-klik **`start.bat`** (atau otomatis jika Anda pilih auto-startup).

---

## Panduan Manual (jika setup otomatis gagal)

Estimasi waktu: **30–45 menit**. Yang sudah Anda punya: Node.js ✓

---

## BAGIAN 1 — Download Kode Aplikasi

Pilih salah satu:

**Cara A (GitHub — disarankan):**
1. Di Emergent, klik **Save → Save to GitHub**, hubungkan akun GitHub Anda.
2. Di laptop, install Git (https://git-scm.com/download/win) lalu jalankan di Command Prompt:
   ```
   git clone https://github.com/<username-anda>/<repo-anda>.git C:\deliwifi
   ```

**Cara B (Manual):** klik **Code** di Emergent, copy semua file ke folder `C:\deliwifi` dengan struktur yang sama (`backend\`, `frontend\`, dst).

---

## BAGIAN 2 — Install Software yang Dibutuhkan

### 2.1 Python 3.10+ (untuk backend)
1. Download dari https://www.python.org/downloads/
2. Saat install, **WAJIB centang "Add Python to PATH"** di layar pertama.
3. Verifikasi di Command Prompt baru: `python --version`

### 2.2 MongoDB Community Server (database — XAMPP tidak dipakai)
1. Download MSI dari https://www.mongodb.com/try/download/community
2. Install dengan pilihan default, **centang "Install MongoDB as a Service"**.
3. Selesai — MongoDB otomatis jalan di background selamanya.

### 2.3 Yarn (package manager)
Buka Command Prompt, jalankan:
```
npm install -g yarn
```

---

## BAGIAN 3 — Buat File Konfigurasi (.env)

File `.env` tidak ikut ter-download demi keamanan, jadi buat manual:

### 3.1 Buat file `C:\deliwifi\backend\.env`
Buka Notepad, paste ini, lalu **Save As → `C:\deliwifi\backend\.env`** (pilih "All Files", bukan .txt):

```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="deliwifi"
CORS_ORIGINS="http://localhost:3000"
JWT_SECRET="ganti-dengan-karakter-acak-panjang-minimal-32-karakter"
ADMIN_EMAIL="agungsetiadi220@gmail.com"
ADMIN_PASSWORD="deliwifi123"
```

> **PENTING:** Ganti `JWT_SECRET` dengan string acak Anda sendiri, dan ganti `ADMIN_PASSWORD` setelah login pertama.

### 3.2 Buat file `C:\deliwifi\frontend\.env`

Cari dulu IP lokal laptop Anda: buka Command Prompt → `ipconfig` → catat **IPv4 Address** (contoh: `192.168.1.10`).

Buat file `C:\deliwifi\frontend\.env` berisi (ganti IP sesuai milik Anda):

```
REACT_APP_BACKEND_URL=http://192.168.1.10:8001
```

> Dengan IP lokal ini, aplikasi bisa diakses dari HP/perangkat lain di jaringan WiFi yang sama.

---

## BAGIAN 4 — Instalasi Otomatis

1. Klik kanan **`install.bat`** → **Run as administrator** (cukup sekali seumur hidup).
2. Tunggu sampai selesai (5–15 menit tergantung internet).
3. Jika ada error, baca Bagian 8 (Troubleshooting).

---

## BAGIAN 5 — Menjalankan Aplikasi

1. Double-klik **`start.bat`**.
2. Dua jendela hitam akan terbuka (backend & frontend) — **jangan ditutup** selama server harus hidup.
3. Buka browser: **http://localhost:3000** (atau `http://192.168.1.10:3000` dari HP).
4. Login admin:
   - Email: `agungsetiadi220@gmail.com`
   - Password: `deliwifi123` ← **segera ganti setelah login**

Database otomatis terisi data awal (paket internet, akun demo) saat pertama jalan.

### Agar otomatis jalan saat laptop nyala:
1. Tekan `Win + R` → ketik `shell:startup` → Enter.
2. Klik kanan `start.bat` → Create shortcut → pindahkan shortcut ke folder startup itu.

---

## BAGIAN 6 — Hubungkan ke MikroTik (Langsung Jalan!)

Karena laptop Anda satu jaringan dengan MikroTik, ini langsung berfungsi:

1. **Di MikroTik (Winbox):** buka **IP → Services** → aktifkan service **`api`** (port 8728). Untuk keamanan lebih baik, bisa pakai `api-ssl` (8729).
2. Buat user khusus API (opsional tapi disarankan): **System → Users** → tambah user misal `deliwifi` dengan group `full` atau `write`.
3. **Di aplikasi Deliwifi:** login admin → menu **Pengaturan** → bagian Router MikroTik:
   - Aktifkan integrasi: **ON**
   - Host: IP router Anda (contoh `192.168.88.1`)
   - Port: `8728`
   - Username & password: user MikroTik
   - Klik **Simpan** lalu **Tes Koneksi** → harus muncul "Terhubung".
4. Selesai — semua fitur router (tambah PPPoE secret, isolir, ubah SSID/password WiFi pelanggan) kini langsung diterapkan ke MikroTik.

---

## BAGIAN 7 — Akses Publik & Pembayaran Midtrans (Opsional)

Agar pelanggan bisa bayar online asli dan akses portal dari luar rumah:

1. Daftar Cloudflare gratis → tambahkan domain Anda (atau beli domain murah dulu).
2. Download **cloudflared** (https://github.com/cloudflare/cloudflared/releases — file `cloudflared-windows-amd64.msi`).
3. Jalankan: `cloudflared tunnel login` lalu buat tunnel yang mengarah ke `http://localhost:3000` (frontend) dan `http://localhost:8001` (backend untuk webhook).
4. Update `frontend/.env` → `REACT_APP_BACKEND_URL=https://api.domainanda.com`, lalu jalankan ulang `install.bat` (build ulang frontend).
5. Di dashboard Midtrans, set **Payment Notification URL**: `https://api.domainanda.com/api/payments/midtrans/notification`
6. Isi Server Key & Client Key Midtrans di menu **Pengaturan** aplikasi → pembayaran online asli aktif.

> Tanpa Bagian 7, aplikasi tetap berfungsi penuh di jaringan lokal; pembayaran online berjalan mode simulasi.

---

## BAGIAN 8 — Troubleshooting

| Masalah | Solusi |
|---|---|
| `python is not recognized` | Python belum masuk PATH. Install ulang, centang "Add Python to PATH". |
| `winget` error `0x8a15000f` / gagal install MongoDB | Script terbaru otomatis fallback: mengunduh MongoDB langsung dari situs resmi. Jika masih gagal, install manual dari mongodb.com/try/download/community (centang "Install MongoDB as a Service"), lalu jalankan ulang `SETUP_OTOMATIS.bat`. |
| Backend error koneksi MongoDB | Buka `services.msc` → pastikan service **MongoDB** status Running. |
| Port 8001/3000 sudah dipakai | Tutup aplikasi lain yang memakai port itu, atau ganti port di `start.bat` dan `.env`. |
| `yarn is not recognized` | Jalankan `npm install -g yarn`, tutup-buka Command Prompt. |
| MikroTik "tidak dapat dihubungi" | Cek service `api` aktif di IP → Services, cek firewall MikroTik tidak memblokir port 8728, cek IP router benar. |
| Tidak bisa akses dari HP | Pastikan HP satu WiFi dengan laptop, IP di `frontend/.env` benar, dan Windows Firewall mengizinkan port 3000 & 8001 (allow saat pertama diminta). |
| Build frontend gagal | Hapus folder `frontend\node_modules`, jalankan ulang `install.bat`. |

---

## Ringkasan Perintah Cepat

```
# Sekali saja:
install.bat          (Run as administrator)

# Setiap mau menyalakan server (atau otomatis via startup):
start.bat

# Akses:
http://localhost:3000          → dari laptop
http://192.168.1.10:3000       → dari HP/perangkat lain (sesuaikan IP)
```
