/**
 * ARFA FASHION — Fresh Store Reset Script
 * 
 * Objectives requested by owner:
 * 1. Mulai absensi dari awal (cashier_attendances -> 0 rows, ready for new shift opening)
 * 2. Riwayat transaksi dari 0 (transactions -> 0 rows)
 * 3. Produk dari 0 (products -> 0 rows, empty catalog for fresh physical inventory entry)
 * 4. Idempotency keys & scanner sessions reset (0 rows)
 * 5. Reset invoice_seq to 1 (first transaction will be INV-...-0001)
 * 6. PRESERVED:
 *    - users (all user accounts kept intact)
 *    - store_settings (ARFA FASHION configuration kept intact)
 *    - payment_methods (all payment methods kept intact)
 *    - cashier_profile (Gusti profile kept intact)
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runStoreReset() {
  console.log('========================================================');
  console.log('   ARFA FASHION — FRESH STORE INITIALIZATION (RESET)   ');
  console.log('========================================================\n');

  const client = await pool.connect();
  const startTime = new Date();

  try {
    console.log('1. Checking Pre-Reset Counts...');
    const preCounts = {};
    const tables = [
      'users', 'store_settings', 'payment_methods', 'cashier_profile',
      'products', 'transactions', 'cashier_attendances',
      'idempotency_keys', 'scanner_sessions', 'pending_scans'
    ];
    for (const t of tables) {
      const res = await client.query(`SELECT count(*)::int as count FROM "${t}";`);
      preCounts[t] = res.rows[0].count;
      console.log(`   - ${t}: ${preCounts[t]} rows`);
    }

    console.log('\n2. Starting ACID Transaction...');
    await client.query('BEGIN');

    // Delete transactional & inventory data
    console.log('   - Truncating/Deleting transactions...');
    await client.query('DELETE FROM transactions;');

    console.log('   - Truncating/Deleting cashier_attendances...');
    await client.query('DELETE FROM cashier_attendances;');

    console.log('   - Truncating/Deleting products...');
    await client.query('DELETE FROM products;');

    console.log('   - Truncating/Deleting idempotency_keys...');
    await client.query('DELETE FROM idempotency_keys;');

    console.log('   - Truncating/Deleting pending_scans...');
    await client.query('DELETE FROM pending_scans;');

    console.log('   - Truncating/Deleting scanner_sessions...');
    await client.query('DELETE FROM scanner_sessions;');

    // Reset sequences
    console.log('   - Resetting invoice_seq to 1...');
    await client.query('ALTER SEQUENCE invoice_seq RESTART WITH 1;');

    console.log('   - Resetting pending_scans_id_seq to 1...');
    await client.query('ALTER SEQUENCE pending_scans_id_seq RESTART WITH 1;');

    await client.query('COMMIT');
    console.log('✓ Transaction COMMITTED successfully.\n');

    console.log('3. Verifying Post-Reset State...');
    const postCounts = {};
    for (const t of tables) {
      const res = await client.query(`SELECT count(*)::int as count FROM "${t}";`);
      postCounts[t] = res.rows[0].count;
      console.log(`   - ${t}: ${postCounts[t]} rows`);
    }

    // Verify sequences
    const seqRes = await client.query(`SELECT sequencename, last_value FROM pg_sequences;`);
    console.log('\n4. Sequence Status:', seqRes.rows);

    // Verify invariants
    const assertions = [
      { name: 'Products count is 0', ok: postCounts.products === 0 },
      { name: 'Transactions count is 0', ok: postCounts.transactions === 0 },
      { name: 'Attendances count is 0', ok: postCounts.cashier_attendances === 0 },
      { name: 'Idempotency keys count is 0', ok: postCounts.idempotency_keys === 0 },
      { name: 'Scanner sessions count is 0', ok: postCounts.scanner_sessions === 0 },
      { name: 'Pending scans count is 0', ok: postCounts.pending_scans === 0 },
      { name: 'Users preserved intact', ok: postCounts.users === preCounts.users && postCounts.users > 0 },
      { name: 'Store settings preserved intact', ok: postCounts.store_settings === 1 },
      { name: 'Payment methods preserved intact', ok: postCounts.payment_methods === preCounts.payment_methods },
      { name: 'Cashier profile preserved intact', ok: postCounts.cashier_profile === 1 }
    ];

    let allPassed = true;
    for (const a of assertions) {
      if (a.ok) {
        console.log(`  ✓ PASS: ${a.name}`);
      } else {
        console.log(`  ✗ FAIL: ${a.name}`);
        allPassed = false;
      }
    }

    if (!allPassed) {
      throw new Error('One or more post-reset assertions failed!');
    }

    // Generate documentation report
    const reportPath = path.join(__dirname, '../docs/FRESH_STORE_RESET_20261006.md');
    const reportContent = `# FRESH STORE INITIALIZATION REPORT (TOKO BARU)
**ARFA FASHION — Sistem Kasir / POS**  
*Execution Date:* ${new Date().toISOString()}  
*Status:* **COMPLETED & VERIFIED (PASS)**

---

## 1. Executive Summary

Sistem kasir **ARFA FASHION** telah diinisialisasi ulang ke kondisi **Toko Baru (Fresh Opening State)** sesuai permintaan:
- **Katalog Produk:** Dikosongkan sepenuhnya (0 produk). Siap input produk dan stok baru dari awal.
- **Riwayat Transaksi:** Direset ke 0 transaksi. Sequence invoice di-restart ke 1 (\`INV-...-0001\`).
- **Absensi Kasir:** Direset ke 0. Kasir Gusti dapat langsung memulai hari kerja pertama dengan modal awal Rp500.000.
- **Akun Pengguna:** 100% DIPERTAHANKAN (\`admin\`, \`gusti\`, dll tetap aktif).
- **Pengaturan & Metode Pembayaran:** 100% DIPERTAHANKAN (ARFA FASHION setting, QRIS, Transfer BCA/BNI/BRI/Mandiri, Tunai).

---

## 2. Table Transition Summary (Before vs After)

| Tabel | Deskripsi | Jumlah Sebelum | Jumlah Sesudah | Status |
|---|---|---:|---:|:---:|
| \`products\` | Katalog & Stok Barang | ${preCounts.products} | **${postCounts.products}** | 🟢 Bersih (0) |
| \`transactions\` | Histori Transaksi Penjualan | ${preCounts.transactions} | **${postCounts.transactions}** | 🟢 Bersih (0) |
| \`cashier_attendances\` | Histori Absensi & Kas Shift | ${preCounts.cashier_attendances} | **${postCounts.cashier_attendances}** | 🟢 Bersih (0) |
| \`idempotency_keys\` | Cache Idempotensi Transaksi | ${preCounts.idempotency_keys} | **${postCounts.idempotency_keys}** | 🟢 Bersih (0) |
| \`scanner_sessions\` | Sesi Mobile Wireless Scanner | ${preCounts.scanner_sessions} | **${postCounts.scanner_sessions}** | 🟢 Bersih (0) |
| \`pending_scans\` | Antrean Scan Nirkabel | ${preCounts.pending_scans} | **${postCounts.pending_scans}** | 🟢 Bersih (0) |
| \`users\` | Akun Pengguna & Kasir | ${preCounts.users} | **${postCounts.users}** | 🛡️ Utuh (Preserved) |
| \`store_settings\` | Pengaturan Nama & Info Toko | ${preCounts.store_settings} | **${postCounts.store_settings}** | 🛡️ Utuh (Preserved) |
| \`payment_methods\` | Konfigurasi Metode Bayar | ${preCounts.payment_methods} | **${postCounts.payment_methods}** | 🛡️ Utuh (Preserved) |
| \`cashier_profile\` | Profil Kasir (Gusti) | ${preCounts.cashier_profile} | **${postCounts.cashier_profile}** | 🛡️ Utuh (Preserved) |

---

## 3. Sequences Status

- \`invoice_seq\`: RESTARTED WITH 1 (Nomor invoice berikutnya dimulai dari nomor urut 0001)
- \`pending_scans_id_seq\`: RESTARTED WITH 1

---

## 4. Next Operational Steps for Store

1. **Login Kasir:** Kasir Gusti login ke sistem kasir.
2. **Buka Shift Kasir:** Sistem akan meminta input modal awal (Standar: **Rp500.000**).
3. **Input Produk Baru:** Admin atau kasir dapat mulai memasukkan produk fisik, varian pakaian, barcode, dan stok ke menu Produk.
4. **Transaksi Pertama:** Transaksi penjualan pertama siap dicetak dengan nomor invoice nomor 1.
`;

    fs.writeFileSync(reportPath, reportContent, 'utf8');
    console.log(`\n✓ Audit report written to ${reportPath}`);
    console.log('========================================================');
    console.log('   FRESH STORE INITIALIZATION COMPLETED SUCCESSFULLY!  ');
    console.log('========================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during store reset:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runStoreReset().catch((err) => {
  console.error('Fatal execution failure:', err);
  process.exit(1);
});
