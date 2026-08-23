# PRD — Deliwifi: Aplikasi Billing RT/RW-Net

## Problem Statement (asli)
"Tolong buat kan aplikasi billing rt rw net ada 2 metodi pppoe dan hotspot bisa pembayar online dan hotspot bisa pembelian online atau offline di warung warung dan ada akuntasi pengeluaran oprasional dan pemasukan dari pelanggan pppoe atau rumahan ada login pelanggan untuk merubah password atau nama wifi router"

## Pilihan User
- Payment gateway: Midtrans (key belum diberikan → mode simulasi, siap-integrasi via Pengaturan)
- Router: Integrasi API MikroTik asli (kredensial belum diberikan → mode simulasi, siap-integrasi)
- Auth: email/username + password (JWT)
- Peran: Admin + Pelanggan + Agen/Warung
- Voucher warung: admin generate + agen punya akun sendiri (keduanya)
- Brand: Deliwifi
- Tambahan: bisa terhubung GenieACS; bisa update online

## Arsitektur
- Backend: FastAPI (port 8001, prefix /api), MongoDB (motor) — server.py, auth.py, db.py, mikrotik.py, payments.py, routes_admin.py, routes_portal.py, seed.py
- Frontend: React + Tailwind + shadcn/ui + Recharts — routing per peran (/admin, /portal, /agent, /beli publik)
- Auth: JWT 7 hari, httpOnly cookie + Bearer fallback, bcrypt, admin seed idempoten
- Integrasi: Midtrans Snap (create + webhook verifikasi SHA512), MikroTik RouterOS API (routeros-api, PPPoE secret, hotspot user, ubah SSID/password WiFi legacy+wifi package), GenieACS NBI (daftar perangkat)

## User Personas
- Admin/pengelola RT-RW Net: kelola pelanggan, paket, tagihan, voucher, agen, keuangan, pengaturan integrasi
- Pelanggan PPPoE/rumahan: bayar tagihan online, ubah nama & password WiFi router
- Agen/warung: jual voucher hotspot offline, dapat komisi otomatis
- Pengunjung publik: beli voucher hotspot online tanpa login

## Yang Sudah Diimplementasikan (23 Juni 2026)
- Auth JWT lengkap: register, login, logout, /me; proteksi brute-force (5x gagal → lock 15 menit, HTTP 429); seed admin (agungsetiadi220@gmail.com), pelanggan demo, agen demo
- Keamanan: CORS explicit origin allowlist, webhook Midtrans terverifikasi signature SHA512, secrets ter-mask di API pengaturan
- Dashboard admin: statistik + chart pemasukan vs pengeluaran 6 bulan + transaksi terbaru (responsif mobile, terverifikasi 390px)
- Manajemen pelanggan PPPoE: tambah (auto akun login + PPPoE secret ke router/simulasi), isolir/aktifkan, hapus
- Manajemen paket PPPoE & Hotspot (CRUD)
- Tagihan bulanan: generate massal/per pelanggan, lunas tunai, hapus
- Voucher hotspot: generate batch, kirim stok ke agen, filter status
- Portal agen: stok, jual voucher, komisi otomatis ke saldo, riwayat
- Pembelian voucher online publik (/beli): order → bayar → kode voucher (tombol Beli + salin kode aman)
- Pembayaran online tagihan pelanggan (Midtrans Snap siap-integrasi + mode simulasi)
- Akuntansi: jurnal pemasukan (tagihan PPPoE, voucher online, voucher agen) & pengeluaran operasional, ringkasan laba bersih per bulan
- Portal pelanggan: status layanan, tagihan + bayar online, ubah SSID & password WiFi (diterapkan ke router saat terhubung)
- Pengaturan admin: brand, Midtrans (sandbox/production), MikroTik (host/port/SSL + tes koneksi), GenieACS (URL + daftar perangkat)
- Semua mode simulasi otomatis aktif bila kredensial integrasi belum diisi
- Testing: 2 iterasi testing agent — 30/30 backend pass, semua flow UI pass, seluruh temuan (lockout, CORS, clipboard, mobile overflow, dsb.) diperbaiki & terverifikasi

## Backlog Prioritas
- P0: Isi API key Midtrans asli & kredensial MikroTik oleh user → verifikasi pembayaran & sinkronisasi router nyata
- P1: Generate tagihan massal otomatis tiap bulan (cron), cetak voucher (PDF/struk), isolir otomatis saat jatuh tempo
- P1: Notifikasi WhatsApp/email tagihan ke pelanggan
- P2: Laporan keuangan export Excel/PDF, pencairan saldo komisi agen, redeem voucher → login hotspot otomatis
- P2: Manajemen perangkat CPE via GenieACS (restart, ganti SSID ONU dari jarak jauh)

## Paket Instalasi Lokal (23 Juni 2026)
- `/app/PANDUAN_INSTALASI_WINDOWS.md` — panduan lengkap self-host di laptop Windows 24 jam (Python, MongoDB, .env, MikroTik, Cloudflare Tunnel untuk webhook Midtrans, auto-startup, troubleshooting)
- `/app/install.bat` — instalasi otomatis (venv, pip deps, yarn install, build frontend)
- `/app/start.bat` — menjalankan backend (uvicorn :8001) + frontend (serve :3000)
- Catatan: script .bat belum diuji di Windows asli (environment dev Linux)

## Next Tasks
1. Minta user mengisi Midtrans Server/Client Key & kredensial MikroTik di menu Pengaturan
2. Uji end-to-end pembayaran Midtrans sandbox dengan kartu test
3. Setup cron tagihan bulanan otomatis
