# Sistem POS Kasir Pro - React, Tailwind & Neon PostgreSQL

Aplikasi web **Point of Sale (POS)** modern dan realistis yang dirancang khusus untuk operasional kasir ritel/minimarket. Dibangun dengan **React**, **TypeScript**, **Tailwind CSS**, pemindai barcode kamera HP (**html5-qrcode**), serta backend API yang terhubung langsung ke cloud database **Neon PostgreSQL**.

---

## 🚀 Fitur Utama

1. **Halaman Transaksi POS**:
   - **Scan Barcode Kamera HP & Laptop**: Tombol `Scan (Enter)` mengaktifkan modul scanner kamera belakang HP / webcam laptop dengan laser indicator dan deteksi instan format retail EAN-13, EAN-8, CODE-128, QR-Code.
   - **Input Barcode Cepat**: Dukungan penuh keyboard barcode scanner (`F7` untuk fokus otomatis).
   - **Katalog & Filter Kategori**: Kartu produk interaktif dengan indikator stok (Aman, Menipis, Habis).
   - **Keranjang Transaksi Real-time**: Kuantitas instan, diskon toko, fitur **Hold / Recall Bill**, dan grand total dinamis.

2. **Halaman Kelola Produk**:
   - Tabel inventaris responsif: Barcode, Nama Produk, Brand, Kategori, Harga Jual, Stok, dan Aksi.
   - Inline Quick Stock Adjuster (`+` dan `-` langsung pada baris tabel).
   - Modal Tambah & Edit Produk dengan fitur **"Generate Barcode Otomatis"** standar EAN-13 (`899...`).

3. **Konfirmasi Pembayaran (Tanpa Payment Gateway)**:
   - **Tunai**: Tombol cepat uang pas, Rp 50.000, Rp 100.000, Rp 200.000, dan kalkulator kembalian otomatis.
   - **Transfer Bank & QRIS**: Kasir memeriksa pratinjau bukti transfer yang diunggah, mencentang validasi mutasi kasir, lalu mengonfirmasi status Lunas secara mandiri.
   - **Struk Termal POS (Print View)**: Format kertas struk nota kasir otentik (58mm / 80mm) yang siap dicetak langsung via printer thermal.

4. **Halaman Riwayat Transaksi**:
   - Log transaksi lengkap: No. Invoice, Waktu, Nama Kasir, Detail Item Belanja, Metode Bayar, Total, dan Status Pelunasan.
   - Filter pencarian instan, status pill (Lunas / Menunggu Konfirmasi / Batal), modal rincian transaksi, dan cetak ulang nota.

5. **Dashboard Kasir Ringkas**:
   - Ringkasan omset shift kasir hari ini dan transaksi berhasil.
   - **Antrean Notifikasi Transfer**: Aksi 1-klik untuk cek bukti transfer dan konfirmasi pelunasan langsung dari dashboard.
   - Peringatan stok menipis (<= 5 unit) beserta tombol restock cepat.

6. **Cloud Database Neon PostgreSQL**:
   - Seluruh data produk dan riwayat transaksi tersimpan dan tersinkronisasi langsung ke Neon PostgreSQL cloud database.
   - Fallback offline ke `localStorage` jika koneksi server lokal terputus.

---

## 🛠️ Pintasan Keyboard Kasir (POS Hotkeys)

| Pintasan | Aksi Kasir |
| :--- | :--- |
| **`F1`** | Buka Menu Transaksi POS |
| **`F2`** | Buka Dashboard & Antrean Verifikasi Kasir |
| **`F3`** | Buka Halaman Kelola Produk |
| **`F4`** | Buka Halaman Riwayat Transaksi |
| **`F7`** | Fokus Otomatis ke Input Barcode Scanner |
| **`F8`** | Bersihkan Seluruh Item di Keranjang |
| **`F9`** | Proses Bayar / Checkout Modal |

---

## 📦 Cara Menjalankan Aplikasi

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Konfigurasi Environment (`.env`)
Buat atau periksa file `.env` di root proyek:
```env
DATABASE_URL="postgresql://neondb_owner:npg_gtfYruN0hi8d@ep-super-mouse-b3uxrazw-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
PORT=3001
```

### 3. Menjalankan Server Backend & Frontend Sekaligus
```bash
npm run dev:all
```
Atau jalankan secara terpisah:
- Backend Express (Neon DB API): `npm run server` (Port 3001)
- Frontend Vite React: `npm run dev` (Port 5173)

Buka aplikasi di browser: **`http://localhost:5173`**
