# DISASTER RECOVERY & BUSINESS CONTINUITY RUNBOOK
## ARFA FASHION — Sistem Kasir / POS

---

## 1. System Overview

Sistem POS **ARFA FASHION** adalah aplikasi kasir point-of-sale ritel busana muslim/fashion yang melayani operasional harian kasir tunggal (**Gusti**) dengan modal kas awal tetap **Rp500.000**.

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons
* **Backend**: Node.js, Express, Native `pg` Pool (PostgreSQL driver)
* **Database**: Neon Serverless PostgreSQL 18.6
* **Hosting**: Vercel (Frontend & Serverless API)
* **Repository**: GitHub (`main` branch)
* **Operational Model**: Kasir tunggal (Gusti), single active shift, modal tetap Rp500.000, offline barcode scanner HP via DB session polling.

---

## 2. Production Components

| Komponen | Provider / Layanan | Peran / Deskripsi | Criticality |
| :--- | :--- | :--- | :--- |
| **Database** | Neon Serverless PostgreSQL | Penyimpanan data relasional, transaksi, stok, absensi kasir, idempotency | CRITICAL |
| **API Backend** | Vercel Serverless Functions (`/api/*`) & Node/Express (`server/index.js`) | API transaksi kasir, validasi stok, otorisasi JWT, mutasi kas | CRITICAL |
| **Web Client** | Vercel Edge Hosting | UI Kasir Gusti, cetak struk, katalog produk, absensi & tutup kas | HIGH |
| **Version Control** | GitHub (`origin/main`) | Single source of truth kode sumber, CI/CD pipeline | HIGH |

---

## 3. Backup Strategy

Strategi backup ARFA FASHION mengadopsi prinsip pertahanan berlapis (*Defense-in-Depth*):

### Layer 1: Native Neon Continuous WAL & PITR (Point-in-Time Recovery)
* **Mekanisme**: Arsitektur Neon Pageserver & Safekeepers mencatat setiap perubahan WAL secara kontinu.
* **Fitur**: Point-in-Time Restore (PITR) memungkinkan pembuatan branch database baru dari detik/menit manapun dalam rentang retensi.
* **Retention**: 24 jam (Free Tier) atau hingga 7-30 hari (Pro/Enterprise Tier).
* **Keunggulan**: RPO sangat rendah (<= 5 menit), pembuatan branch instan (Copy-on-Write) tanpa downtime.

### Layer 2: Logical PostgreSQL Backup (Scheduled Script)
* **Mekanisme**: Script otomatis `scripts/backup_database.mjs` mengekstraksi seluruh skema tabel, dependensi relasi, sequence state (`invoice_seq`, `pending_scans_id_seq`), constraints, dan row data dalam format JSON deterministik + SHA-256 checksum manifest.
* **Lokasi Penyimpanan**: Direktori `backups/` lokal dan cold storage terpisah yang terproteksi (di luar git repository).
* **Frekuensi**: Harian (setiap pergantian shift / penutupan kas kasir Gusti).
* **Keamanan**: `backups/`, `*.dump`, `*.tar`, `*.sql.gz` terdaftar dalam `.gitignore`. Kredensial tidak pernah dicatat dalam isi file backup.

---

## 4. Backup Verification

Backup tidak pernah dianggap valid hanya karena file ada di disk. Verifikasi otomatis dijalankan via `scripts/verify_backup.mjs`:

1. **Existence & Size**: Memastikan file ada, dapat dibaca, dan ukurannya proporsional (>1 KB, tipikal 200–300 KB).
2. **Readability & Syntax**: Memvalidasi JSON formatting dan struktur metadata.
3. **Schema Completeness**: Memastikan 10 tabel inti ada:
   * `users`, `store_settings`, `cashier_profile`, `payment_methods`, `products`, `cashier_attendances`, `transactions`, `idempotency_keys`, `scanner_sessions`, `pending_scans`.
4. **Sequence Completeness**: Memastikan sequence `invoice_seq` dan `pending_scans_id_seq` tercatat dengan `last_value` valid.
5. **Data Checksum (SHA-256)**: Menghitung ulang hash SHA-256 seluruh baris per tabel dan mencocokkannya dengan manifest.
6. **Business Invariant Sanity**:
   * Users > 0
   * Products > 0
   * Transactions non-corrupt
   * Cashier Attendances non-corrupt
   * Store Settings & Payment Methods aktif

Command verifikasi:
```bash
node scripts/verify_backup.mjs
```

---

## 5. Restore Procedure

### Prosedur Standar (Isolated Schema Restore)
Jika terjadi insiden data, proses restore **DILARANG** langsung menimpa tabel production yang sedang aktif sebelum diverifikasi di lingkungan terisolasi:

1. **Langkah 1**: Buat skema pemulihan terisolasi:
   ```sql
   CREATE SCHEMA recovery_sandbox;
   ```
2. **Langkah 2**: Jalankan restore ke skema pemulihan menggunakan:
   ```bash
   node scripts/restore_database.mjs
   ```
3. **Langkah 3**: Lakukan audit data integrity dan smoke test pada skema pemulihan.
4. **Langkah 4**: Jika validasi selesai dan disetujui, lakukan promosi:
   * **Opsi A (Neon Branching)**: Arahkan `DATABASE_URL` di Vercel Dashboard ke connection string branch hasil pemulihan.
   * **Opsi B (Atomic Swap Table)**: Lakukan rename schema di PostgreSQL:
     ```sql
     ALTER SCHEMA public RENAME TO public_corrupted_backup;
     ALTER SCHEMA recovery_sandbox RENAME TO public;
     ```
5. **Langkah 5**: Restart service API dan verifikasi login kasir Gusti.

---

## 6. Migration Recovery & Rollback

### Klasifikasi Seluruh Migration

| Migration Script | Scope Perubahan | Klasifikasi | Rollback Action |
| :--- | :--- | :--- | :--- |
| `migrate_phase2.mjs` | `idempotency_keys`, `invoice_seq`, `transactions.user_id` | **Reversible** | `DROP TABLE IF EXISTS idempotency_keys; DROP SEQUENCE IF EXISTS invoice_seq; ALTER TABLE transactions DROP COLUMN user_id;` |
| `migrate_phase3.mjs` | Indeks performa transaksi & absensi | **Reversible** | `DROP INDEX IF EXISTS idx_transactions_date, idx_transactions_user_id, idx_transactions_status, idx_transactions_att_status, idx_attendances_status, idx_products_category, idx_products_created_at;` |
| `migrate_phase4.mjs` | Kolom snapshot tutup kas (`total_transactions`, `total_sales`, dll.) | **Partially Reversible** | Kolom dapat di-drop, namun data historis tutup kas akan hilang jika tidak di-backup terlebih dahulu. |
| `migrate_phase62.mjs` | Schema consistency: JSONB variants, NOT NULL checks, missing columns | **Partially Reversible** | Kolom nullable dapat di-drop. Skema konsisten tidak boleh di-rollback tanpa backup data. |
| `migrate_phase63.mjs` | `CHECK (stock >= 0)` constraint | **Reversible** | `ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_stock_non_negative;` |

### Kebijakan Rollback Migrasi
1. Selalu jalankan `node scripts/backup_database.mjs` sebelum mengeksekusi migration baru.
2. Jika migrasi gagal di tengah jalan, script menghentikan proses dalam blok `try/catch` tanpa meninggalkan state setengah jadi.

---

## 7. Deployment Rollback

### Rollback di Vercel
1. Buka **Vercel Dashboard** -> Project `sistem_kasir` -> Tab **Deployments**.
2. Cari deployment terakhir yang berstatus PASS (Known-Good Commit, e.g., `9fb95d7`).
3. Klik ikon titik tiga `(...)` -> Pilih **Promote to Production** / **Instant Rollback**.
4. Waktu propagasi rollback Vercel: `< 30 detik`.

### Rollback di Git / GitHub
Jika perbaikan kode diperlukan:
```bash
# Revert commit bermasalah
git revert <bad-commit-hash> -m 1
git push origin main
```
Atau kembalikan ke known-good commit:
```bash
git checkout -b hotfix-rollback <known-good-commit>
git push origin hotfix-rollback
```

---

## 8. Recovery Point Objective (RPO)

* **Definisi**: Batas maksimal data transaksi yang dapat hilang dalam kondisi bencana.
* **Target Bisnis**: `<= 1 jam` (maksimal transaksi dalam satu shift kasir Gusti).
* **Layer 1 (Neon PITR)**: `<= 5 menit` (data direkam kontinu pada WAL stream).
* **Layer 2 (Logical Backup)**: `<= 12 jam` (periode tutup kas harian).
* **Status**: **PASS** (Memenuhi target bisnis).

---

## 9. Recovery Time Objective (RTO)

* **Definisi**: Durasi maksimal dari deteksi kegagalan hingga sistem kasir dapat melayani transaksi kembali.
* **Target Bisnis**: `<= 15 menit`.
* **Layer 1 (Neon Branching Promosi)**: `~3-5 menit` (buat branch PITR, update Vercel `DATABASE_URL`, redeploy).
* **Layer 2 (Logical Isolated Restore)**: `~6.7 detik` (teruji pada dataset 56 transaksi, 21 produk, 106 idempotency keys).
* **Status**: **PASS** (Jauh melampaui batas waktu 15 menit).

---

## 10. Database Integrity Checks

Query wajib setelah pemulihan database:

```sql
-- 1. Verifikasi tidak ada stok negatif
SELECT id, name, stock FROM products WHERE stock < 0;
-- Expected: 0 rows

-- 2. Verifikasi foreign key transaksi ke users & attendance
SELECT COUNT(*) FROM cashier_attendances ca 
LEFT JOIN users u ON ca.user_id = u.id 
WHERE u.id IS NULL;
-- Expected: 0 rows

-- 3. Verifikasi invoice number unik dan utuh
SELECT invoice_number, COUNT(*) 
FROM transactions 
GROUP BY invoice_number 
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

---

## 11. Post-Recovery Smoke Test

Sebelum kasir Gusti mulai melayani pelanggan kembali:

1. **Autentikasi**:
   * Login Admin: `admin` -> Verifikasi role `super_admin`.
   * Login Kasir: `gusti` -> Verifikasi role `kasir`.
2. **Katalog & Stok Produk**:
   * Akses `/api/products` -> Pastikan 21 produk tampil dengan stok >= 0.
   * Cek varian warna dan ukuran dapat dipilih.
3. **Uji Transaksi Sampel (Sandbox/Test)**:
   * Buat 1 transaksi kecil (1 pcs).
   * Verifikasi stok produk berkurang tepat 1 pcs.
   * Verifikasi nomor invoice terbit sesuai urutan sequence.
   * Lakukan pembatalan transaksi (cancel) -> Pastikan stok kembali dan status transaksi menjadi `cancelled`.
4. **Verifikasi Kasir & Modal**:
   * Buka menu Absensi & Kas Kasir.
   * Pastikan modal awal tercatat Rp500.000.

---

## 12. Idempotency Considerations

### Analisis Skenario Restore ke Titik Lampau (Point-in-Time):
Jika database dipulihkan ke backup T-1 jam:
1. **Transaksi T-1 jam hingga T0**: Data transaksi tersebut tidak ada dalam backup database yang dipulihkan.
2. **Risiko Retry Client/Browser**: Jika browser kasir atau scanner offline mencoba mengirim ulang transaksi yang terjadi antara T-1 dan T0, kunci idempotensinya belum ada di database yang dipulihkan. Akibatnya sistem akan mengeksekusi request tersebut sebagai transaksi baru dan memotong stok kembali.
3. **Mitigasi Operasional Kasir**:
   * Kasir Gusti wajib melakukan **Hard Refresh** browser (`Ctrl + F5`) untuk membersihkan memory/state transaksi yang menggantung.
   * Periksa fisik struk belanja di laci kasir dan bandingkan dengan daftar riwayat transaksi di sistem hasil restore.
   * Bersihkan pending queue scanner wireless (`DELETE FROM pending_scans WHERE processed = false`).

---

## 13. Invoice Sequence Verification

Sequence `invoice_seq` menghasilkan nomor invoice dengan format `INV-YYYYMMDD-XXXX`.

### Aturan Invariant
`nextval('invoice_seq') > highest existing numeric suffix of transactions`

### Query Verifikasi & Koreksi Sequence:
```sql
-- Cek angka invoice tertinggi yang ada di database
SELECT MAX(NULLIF(regexp_replace(invoice_number, '^INV-[0-9]+-', ''), ''))::int AS max_invoice_num
FROM transactions;

-- Cek nilai terakhir sequence saat ini
SELECT last_value, is_called FROM invoice_seq;

-- Koreksi jika sequence tertinggal di bawah nomor invoice yang sudah ada
-- (Misal invoice tertinggi adalah 132, set sequence minimal ke 133):
SELECT setval('invoice_seq', GREATEST((SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '^INV-[0-9]+-', ''), ''))::int, 1) FROM transactions), (SELECT last_value FROM invoice_seq)));
```

---

## 14. Cash Closing Verification

Setiap sesi kasir Gusti mengunci data penutupan kas (*closing snapshot*):
* **Opening Cash (Modal Awal)**: Tetap **Rp500.000**.
* **Cashier Name**: **Gusti** (`USR-KAS-01`).
* **Closing Fields**: `total_transactions`, `total_sales`, `total_cash`, `total_transfer`, `total_qris`, `closed_by`.

Query Verifikasi:
```sql
SELECT 
  id, date, cashier_name, opening_cash, total_transactions, 
  total_sales, total_cash, total_transfer, total_qris, status, closed_by
FROM cashier_attendances
ORDER BY date DESC
LIMIT 5;
```
Pastikan `opening_cash = 500000.00` dan seluruh ringkasan penjualan kas/transfer/QRIS tidak bernilai NULL.

---

## 15. Emergency Checklist

Jika terjadi insiden sistem down di toko:

- [ ] **Langkah 1**: Kasir Gusti beralih sementara ke pencatatan nota fisik manual jika sistem tidak dapat diakses > 5 menit.
- [ ] **Langkah 2**: Admin memeriksa status Vercel dan Neon Console.
- [ ] **Langkah 3**: Jika ada kegagalan deploy di Vercel -> Lakukan *Instant Rollback* ke commit sebelumnya.
- [ ] **Langkah 4**: Jika database rusak -> Buat isolated restore atau buat Neon PITR branch.
- [ ] **Langkah 5**: Jalankan `node scripts/verify_backup.mjs` dan verifikasi integritas data.
- [ ] **Langkah 6**: Periksa nilai `invoice_seq` agar tidak tabrakan dengan invoice lama.
- [ ] **Langkah 7**: Update `DATABASE_URL` di Vercel Environment Variables jika menggunakan branch pemulihan baru.
- [ ] **Langkah 8**: Lakukan smoke test login kasir Gusti dan modal Rp500.000.
- [ ] **Langkah 9**: Kasir Gusti melakukan rekonsiliasi transaksi offline/manual ke dalam sistem POS.

---

## 16. Known Limitations

1. **Neon API Token**: Lingkungan runner saat ini tidak memiliki `NEON_API_KEY` di `.env`, sehingga pembuatan branch PITR otomatis via REST API `REQUIRES MANUAL VERIFICATION` di web console Neon (`console.neon.tech`). Pemulihan otomatis lokal/server ditangani secara mandiri oleh script logical restore (`scripts/restore_database.mjs`).
2. **Single Cashier Concurrency**: Desain sistem dioptimasi untuk 1 kasir aktif (Gusti). Tidak ada kebutuhan lock multi-kasir terdistribusi antar cabang.
3. **Offline Scanner Queue**: Pending scans yang belum diproses tersimpan di tabel `pending_scans`. Saat pemulihan database lama, kasir harus memverifikasi apakah ada barcode scanner yang tertunda agar tidak terinput ganda.
