/**
 * test_phase4.mjs
 * ARFA FASHION POS — Phase 4.1 Verification Test Suite
 *
 * Verifikasi Tutup Kas & Rekonsiliasi Harian:
 * - TEST 1: OPEN CASH (201/success)
 * - TEST 2: DUPLICATE OPEN (ditolak / 400)
 * - TEST 3: TRANSACTION (berhasil)
 * - TEST 4: CASH SUMMARY (DB calculation benar)
 * - TEST 5: CLOSE CASH (berhasil)
 * - TEST 6: DOUBLE CLOSE (ditolak / 400)
 * - TEST 7: CASH VARIANCE (actual - expected benar)
 * - TEST 8: CANCELLED TRANSACTION (tidak dihitung dalam sales/expected cash)
 * - TEST 9: EXISTING CHECKOUT (PASS)
 * - TEST 10: STOCK LOCK (PASS)
 * - TEST 11: IDEMPOTENCY (PASS)
 * - TEST 12: INVOICE SEQUENCE (PASS)
 * - TEST 13: CONCURRENCY CLOSE (atomic lock prevents double close)
 * - TEST 14: CASH ACTUAL VALIDATION (reject negative/NaN)
 * - TEST 15: ADMIN CLOSING VIEW & REPORT (complete breakdown)
 */
import http from 'http';
import pg from 'pg';
import dotenv from 'dotenv';
import app, { createToken } from '../api/index.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PORT = 3992;
const BASE = `http://127.0.0.1:${PORT}`;
const server = http.createServer(app);

const getJakartaDate = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

let passCount = 0;
let failCount = 0;
const failures = [];

function pass(label, detail = '') {
  passCount++;
  console.log(`  ✅ PASS  ${label}${detail ? ' -- ' + detail : ''}`);
}

function fail(label, detail = '') {
  failCount++;
  failures.push(label + (detail ? ': ' + detail : ''));
  console.log(`  ❌ FAIL  ${label}${detail ? ' -- ' + detail : ''}`);
}

function section(title) {
  console.log('\n' + '='.repeat(65));
  console.log('  ' + title);
  console.log('='.repeat(65));
}

async function api(method, path, body, headers = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function runPhase4Tests() {
  await new Promise(resolve => server.listen(PORT, resolve));
  const today = getJakartaDate();
  const client = await pool.connect();

  console.log('\n' + '█'.repeat(65));
  console.log('  ARFA FASHION POS — PHASE 4.1 TEST SUITE');
  console.log('  Business Date: ' + today);
  console.log('█'.repeat(65));

  const TEST_USER_ID = 'USR-P4-GUSTI';
  const TEST_USER_2 = 'USR-P4-KASIR2';
  const TEST_PROD_1 = 'PRD-P4-001';
  const TEST_PROD_2 = 'PRD-P4-002';

  try {
    // ── Setup Clean Test Environment ──
    await client.query(`DELETE FROM transactions WHERE cashier_name IN ('Gusti Test', 'Kasir Dua')`);
    await client.query(`DELETE FROM cashier_attendances WHERE user_id IN ($1, $2)`, [TEST_USER_ID, TEST_USER_2]);
    await client.query(`DELETE FROM products WHERE id IN ($1, $2)`, [TEST_PROD_1, TEST_PROD_2]);
    await client.query(`DELETE FROM users WHERE id IN ($1, $2)`, [TEST_USER_ID, TEST_USER_2]);
    await client.query(`DELETE FROM idempotency_keys WHERE key LIKE 'p4-%'`);

    // Products
    await client.query(`
      INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, variants)
      VALUES 
        ($1, 'Kemeja Katun P4', 'ARFA', 'Kemeja', 100000, 60000, 50, '8999990001', 'Pcs', '[]'::jsonb),
        ($2, 'Celana Chino P4', 'ARFA', 'Celana', 150000, 90000, 40, '8999990002', 'Pcs', '[]'::jsonb)
    `, [TEST_PROD_1, TEST_PROD_2]);

    // Users
    await client.query(`
      INSERT INTO users (id, username, name, password, role)
      VALUES 
        ($1, 'gusti_p4', 'Gusti Test', 'hash123', 'kasir'),
        ($2, 'kasir2_p4', 'Kasir Dua', 'hash123', 'kasir')
    `, [TEST_USER_ID, TEST_USER_2]);

    const gustiToken = createToken({ id: TEST_USER_ID, username: 'gusti_p4', name: 'Gusti Test', role: 'kasir' });
    const kasir2Token = createToken({ id: TEST_USER_2, username: 'kasir2_p4', name: 'Kasir Dua', role: 'kasir' });
    const adminToken = createToken({ id: 'USR-ADM-01', username: 'admin', name: 'Super Admin', role: 'super_admin' });

    // Payment methods check
    const pmRes = await client.query(`SELECT name, type FROM payment_methods WHERE is_active = true`);
    const PM_TUNAI = pmRes.rows.find(r => r.type === 'TUNAI')?.name || 'Tunai';
    const PM_TRANSFER = pmRes.rows.find(r => r.type === 'TRANSFER' && !r.name.toUpperCase().includes('QRIS'))?.name || 'BCA Transfer';
    const PM_QRIS = pmRes.rows.find(r => r.name.toUpperCase().includes('QRIS'))?.name || 'QRIS Kasir';

    // ──────────────────────────────────────────────────────────
    section('TEST 1 — OPEN CASH (Buka Kas / Mulai Shift)');
    // ──────────────────────────────────────────────────────────
    const openRes = await api('POST', '/api/attendance/check-in', {}, auth(gustiToken));
    if (openRes.status === 201 && openRes.data?.success && openRes.data?.attendance?.openingCash === 500000 && openRes.data?.attendance?.status === 'working') {
      pass('TEST 1: OPEN CASH', `Status 201, openingCash Rp500.000, status 'working'`);
    } else {
      fail('TEST 1: OPEN CASH', `Status ${openRes.status}, data: ${JSON.stringify(openRes.data)}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 2 — DUPLICATE OPEN (Mencegah Sesi Ganda)');
    // ──────────────────────────────────────────────────────────
    const dupRes = await api('POST', '/api/attendance/check-in', {}, auth(gustiToken));
    if (dupRes.status === 400 && dupRes.data?.error?.includes('sudah absen masuk')) {
      pass('TEST 2: DUPLICATE OPEN', `Ditolak HTTP 400, pesan: "${dupRes.data.error}"`);
    } else {
      fail('TEST 2: DUPLICATE OPEN', `Expected 400, got ${dupRes.status}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 3 — TRANSACTIONS (Cash, Transfer, QRIS)');
    // ──────────────────────────────────────────────────────────
    // Transaksi 1: Cash Tunai Rp100.000 (1 Kemeja)
    const tx1Res = await api('POST', '/api/transactions', {
      items: [{ productId: TEST_PROD_1, quantity: 1 }],
      paymentMethod: PM_TUNAI,
      cashGiven: 100000,
      idempotencyKey: `p4-tx1-${Date.now()}`
    }, auth(gustiToken));

    if (tx1Res.status === 201 && tx1Res.data?.status === 'LUNAS' && tx1Res.data?.total === 100000) {
      pass('TEST 3A: Transaksi TUNAI', `Total Rp100.000 LUNAS, Invoice: ${tx1Res.data.invoiceNumber}`);
    } else {
      fail('TEST 3A: Transaksi TUNAI', `Status: ${tx1Res.status}, data: ${JSON.stringify(tx1Res.data)}`);
    }

    // Transaksi 2: Cash Tunai Rp150.000 (1 Celana)
    const tx2Res = await api('POST', '/api/transactions', {
      items: [{ productId: TEST_PROD_2, quantity: 1 }],
      paymentMethod: PM_TUNAI,
      cashGiven: 200000,
      idempotencyKey: `p4-tx2-${Date.now()}`
    }, auth(gustiToken));

    if (tx2Res.status === 201 && tx2Res.data?.total === 150000 && tx2Res.data?.changeAmount === 50000) {
      pass('TEST 3B: Transaksi TUNAI kedua', `Total Rp150.000, Cash Given 200.000, Kembalian 50.000`);
    } else {
      fail('TEST 3B: Transaksi TUNAI kedua', `Status: ${tx2Res.status}`);
    }

    // Transaksi 3: Non-Tunai Transfer Rp100.000 (Verified)
    const tx3Res = await api('POST', '/api/transactions', {
      items: [{ productId: TEST_PROD_1, quantity: 1 }],
      paymentMethod: PM_TRANSFER,
      transferProofVerified: true,
      idempotencyKey: `p4-tx3-${Date.now()}`
    }, auth(gustiToken));

    if (tx3Res.status === 201 && tx3Res.data?.total === 100000 && tx3Res.data?.status === 'LUNAS') {
      pass('TEST 3C: Transaksi TRANSFER', `Total Rp100.000 LUNAS (Non-Tunai ke Bank)`);
    } else {
      fail('TEST 3C: Transaksi TRANSFER', `Status: ${tx3Res.status}`);
    }

    // Transaksi 4: Non-Tunai QRIS Rp150.000 (Verified)
    const tx4Res = await api('POST', '/api/transactions', {
      items: [{ productId: TEST_PROD_2, quantity: 1 }],
      paymentMethod: PM_QRIS,
      transferProofVerified: true,
      idempotencyKey: `p4-tx4-${Date.now()}`
    }, auth(gustiToken));

    if (tx4Res.status === 201 && tx4Res.data?.total === 150000 && tx4Res.data?.status === 'LUNAS') {
      pass('TEST 3D: Transaksi QRIS', `Total Rp150.000 LUNAS (Non-Tunai ke Bank)`);
    } else {
      fail('TEST 3D: Transaksi QRIS', `Status: ${tx4Res.status}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 4 — CASH SUMMARY (Kalkulasi Database Source of Truth)');
    // ──────────────────────────────────────────────────────────
    // Penjualan Cash: Rp100.000 + Rp150.000 = Rp250.000
    // Penjualan Transfer: Rp100.000
    // Penjualan QRIS: Rp150.000
    // Total Penjualan: Rp500.000 (4 transaksi)
    // Modal Awal: Rp500.000
    // Kas Seharusnya (Expected Cash): Rp500.000 + Rp250.000 = Rp750.000
    const sumRes = await api('GET', '/api/attendance/summary-today', null, auth(gustiToken));
    if (sumRes.status === 200) {
      const s = sumRes.data;
      const expectedCashOK = s.expectedCash === 750000;
      const cashSalesOK = s.cashSales === 250000;
      const transferSalesOK = s.transferSales === 100000;
      const qrisSalesOK = s.qrisSales === 150000;
      const totalRevenueOK = s.revenueToday === 500000;
      const totalTxOK = s.totalTransactions === 4;

      if (expectedCashOK && cashSalesOK && transferSalesOK && qrisSalesOK && totalRevenueOK && totalTxOK) {
        pass('TEST 4: CASH SUMMARY', `Modal: Rp500.000 | Cash: Rp250.000 | Transfer: Rp100.000 | QRIS: Rp150.000 | Expected Cash: Rp750.000`);
      } else {
        fail('TEST 4: CASH SUMMARY', `Expected 750k/250k/100k/150k/500k/4, got: ${JSON.stringify(s)}`);
      }
    } else {
      fail('TEST 4: CASH SUMMARY', `Status: ${sumRes.status}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 8 — CANCELLED TRANSACTION (Transaksi Batal Diabaikan)');
    // ──────────────────────────────────────────────────────────
    // Buat transaksi tunai baru, lalu batalkan
    const txCancelRes = await api('POST', '/api/transactions', {
      items: [{ productId: TEST_PROD_1, quantity: 1 }],
      paymentMethod: PM_TUNAI,
      cashGiven: 100000,
      idempotencyKey: `p4-txcancel-${Date.now()}`
    }, auth(gustiToken));

    const cancelTxId = txCancelRes.data.id;
    // Cancel transaksi (Admin required)
    const cancelRes = await api('PATCH', `/api/transactions/${cancelTxId}/cancel`, {
      reason: 'Pembeli salah barang test'
    }, auth(adminToken));

    if (cancelRes.status === 200) {
      // Periksa summary lagi: transaksi batal TIDAK BOLEH menambah cashSales atau expectedCash
      const sumAfterCancel = await api('GET', '/api/attendance/summary-today', null, auth(gustiToken));
      if (sumAfterCancel.data?.cashSales === 250000 && sumAfterCancel.data?.expectedCash === 750000) {
        pass('TEST 8: CANCELLED TRANSACTION', `Transaksi batal diabaikan. Cash tetap Rp250.000, Expected tetap Rp750.000`);
      } else {
        fail('TEST 8: CANCELLED TRANSACTION', `Expected cash berubah setelah cancel: ${JSON.stringify(sumAfterCancel.data)}`);
      }
    } else {
      fail('TEST 8: CANCELLED TRANSACTION', `Cancel request failed: ${cancelRes.status}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 7 — CASH VARIANCE & VALIDATION');
    // ──────────────────────────────────────────────────────────
    // Kas seharusnya: Rp750.000
    // Tes 1: Selisih tanpa keterangan -> harus ditolak (400)
    const noNoteClose = await api('POST', '/api/attendance/check-out', {
      actualCash: 740000, // Selisih -Rp10.000
      note: ''
    }, auth(gustiToken));

    if (noNoteClose.status === 400 && noNoteClose.data?.error?.includes('Keterangan wajib diisi')) {
      pass('TEST 7A: Selisih kas wajib isi catatan', `Ditolak 400 karena ada selisih -Rp10.000 tanpa catatan`);
    } else {
      fail('TEST 7A: Selisih kas wajib isi catatan', `Expected 400, got ${noNoteClose.status}`);
    }

    // Tes 2: Input actualCash negatif / invalid
    const negClose = await api('POST', '/api/attendance/check-out', {
      actualCash: -50000,
      note: 'Minus'
    }, auth(gustiToken));
    if (negClose.status === 400) {
      pass('TEST 7B: Input negatif ditolak', `Status 400 untuk actualCash = -50000`);
    } else {
      fail('TEST 7B: Input negatif ditolak', `Expected 400, got ${negClose.status}`);
    }

    const nanClose = await api('POST', '/api/attendance/check-out', {
      actualCash: 'abc123nan',
      note: 'String invalid'
    }, auth(gustiToken));
    if (nanClose.status === 400) {
      pass('TEST 7C: Input NaN/string ditolak', `Status 400 untuk non-numeric actualCash`);
    } else {
      fail('TEST 7C: Input NaN/string ditolak', `Expected 400, got ${nanClose.status}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 5 — CLOSE CASH (Tutup Kas Berhasil & Rekonsiliasi)');
    // ──────────────────────────────────────────────────────────
    // Kasir masukkan kas aktual Rp740.000 (Selisih -Rp10.000) dengan keterangan valid
    const closeRes = await api('POST', '/api/attendance/check-out', {
      actualCash: 740000,
      note: 'Uang receh kembalian kurang Rp10.000'
    }, auth(gustiToken));

    if (closeRes.status === 200 && closeRes.data?.success) {
      const att = closeRes.data.attendance;
      const expectedOK = att.expectedCash === 750000;
      const actualOK = att.actualCash === 740000;
      const diffOK = att.cashDifference === -10000;
      const statusOK = att.status === 'completed';

      if (expectedOK && actualOK && diffOK && statusOK) {
        pass('TEST 5: CLOSE CASH', `Expected: Rp750.000, Actual: Rp740.000, Selisih: -Rp10.000, Status: completed`);
      } else {
        fail('TEST 5: CLOSE CASH', `Mismatch data: ${JSON.stringify(att)}`);
      }
    } else {
      fail('TEST 5: CLOSE CASH', `Expected 200, got ${closeRes.status}: ${JSON.stringify(closeRes.data)}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 6 — DOUBLE CLOSE (Mencegah Tutup Kas Ulang)');
    // ──────────────────────────────────────────────────────────
    const doubleClose = await api('POST', '/api/attendance/check-out', {
      actualCash: 750000
    }, auth(gustiToken));

    if (doubleClose.status === 400 && doubleClose.data?.error?.includes('sudah ditutup')) {
      pass('TEST 6: DOUBLE CLOSE', `Ditolak HTTP 400: "${doubleClose.data.error}"`);
    } else {
      fail('TEST 6: DOUBLE CLOSE', `Expected 400, got ${doubleClose.status}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 6B — RE-OPEN AFTER CLOSE (Mencegah Buka Ulang Setelah Tutup)');
    // ──────────────────────────────────────────────────────────
    const reOpen = await api('POST', '/api/attendance/check-in', {}, auth(gustiToken));
    if (reOpen.status === 400 && reOpen.data?.error?.includes('sudah ditutup')) {
      pass('TEST 6B: RE-OPEN AFTER CLOSE', `Ditolak HTTP 400: "${reOpen.data.error}"`);
    } else {
      fail('TEST 6B: RE-OPEN AFTER CLOSE', `Expected 400, got ${reOpen.status}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 13 — CONCURRENCY: SIMULTANEOUS CLOSE REQUESTS');
    // ──────────────────────────────────────────────────────────
    // Buka sesi untuk Kasir Dua
    const openKasir2 = await api('POST', '/api/attendance/check-in', {}, auth(kasir2Token));
    if (openKasir2.status === 201) {
      // 1 Transaksi untuk Kasir Dua
      await api('POST', '/api/transactions', {
        items: [{ productId: TEST_PROD_1, quantity: 1 }],
        paymentMethod: PM_TUNAI,
        cashGiven: 100000,
        idempotencyKey: `p4-k2-tx-${Date.now()}`
      }, auth(kasir2Token));

      // Kirim dua request close bersamaan
      const [resCloseA, resCloseB] = await Promise.all([
        api('POST', '/api/attendance/check-out', { actualCash: 600000 }, auth(kasir2Token)),
        api('POST', '/api/attendance/check-out', { actualCash: 600000 }, auth(kasir2Token))
      ]);

      const successCount = (resCloseA.status === 200 ? 1 : 0) + (resCloseB.status === 200 ? 1 : 0);
      const rejectedCount = (resCloseA.status === 400 ? 1 : 0) + (resCloseB.status === 400 ? 1 : 0);

      if (successCount === 1 && rejectedCount === 1) {
        pass('TEST 13: CONCURRENCY CLOSE', `Tepat 1 berhasil (200), tepat 1 ditolak (400). Double-close berhasil dicegah via FOR UPDATE`);
      } else {
        fail('TEST 13: CONCURRENCY CLOSE', `Expected 1 success & 1 reject, got ${successCount} success, ${rejectedCount} reject`);
      }
    } else {
      fail('TEST 13: CONCURRENCY CLOSE', `Gagal membuka shift kasir 2: ${openKasir2.status}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 9 — EXISTING CHECKOUT (Regression Verification)');
    // ──────────────────────────────────────────────────────────
    // Buat kasir 3 untuk tes checkout
    const TEST_USER_3 = 'USR-P4-KASIR3';
    await client.query(`DELETE FROM transactions WHERE cashier_name = 'Kasir Tiga'`);
    await client.query(`DELETE FROM cashier_attendances WHERE user_id = $1`, [TEST_USER_3]);
    await client.query(`DELETE FROM users WHERE id = $1`, [TEST_USER_3]);

    await client.query(`
      INSERT INTO users (id, username, name, password, role)
      VALUES ($1, 'kasir3_p4', 'Kasir Tiga', 'hash123', 'kasir')
    `, [TEST_USER_3]);
    const kasir3Token = createToken({ id: TEST_USER_3, username: 'kasir3_p4', name: 'Kasir Tiga', role: 'kasir' });

    // Coba checkout sebelum absen masuk -> harus ditolak
    const preCheckTx = await api('POST', '/api/transactions', {
      items: [{ productId: TEST_PROD_1, quantity: 1 }],
      paymentMethod: PM_TUNAI,
      cashGiven: 100000
    }, auth(kasir3Token));

    if (preCheckTx.status === 403 && preCheckTx.data?.code === 'ATTENDANCE_NOT_STARTED') {
      pass('TEST 9A: Checkout sebelum absen ditolak', `HTTP 403 ATTENDANCE_NOT_STARTED`);
    } else {
      fail('TEST 9A: Checkout sebelum absen ditolak', `Expected 403, got ${preCheckTx.status}`);
    }

    // Absen masuk kasir 3
    await api('POST', '/api/attendance/check-in', {}, auth(kasir3Token));

    // Checkout setelah absen masuk -> harus berhasil
    const validTx = await api('POST', '/api/transactions', {
      items: [{ productId: TEST_PROD_1, quantity: 2 }],
      paymentMethod: PM_TUNAI,
      cashGiven: 200000,
      idempotencyKey: `p4-k3-valid-${Date.now()}`
    }, auth(kasir3Token));

    if (validTx.status === 201 && validTx.data?.total === 200000) {
      pass('TEST 9B: EXISTING CHECKOUT', `Status 201, Total Rp200.000, Invoice: ${validTx.data.invoiceNumber}`);
    } else {
      fail('TEST 9B: EXISTING CHECKOUT', `Expected 201, got ${validTx.status}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 10 — STOCK LOCK & INTEGRITY (Regression Verification)');
    // ──────────────────────────────────────────────────────────
    // Periksa stok produk PRD-P4-001 (Awal 50 - 1 - 1 - 1 - 2 = 45 unit, 1 cancel di-restore = 46 unit)
    const prodRes = await client.query('SELECT stock FROM products WHERE id = $1', [TEST_PROD_1]);
    const currentStock = parseInt(prodRes.rows[0].stock, 10);
    // Detail pengurangan stok:
    // Awal: 50
    // Tx 1: -1 (stok 49)
    // Tx 3: -1 (stok 48)
    // Tx Batal: -1 (stok 47), lalu di-cancel: +1 (stok 48)
    // Tx Kasir 2: -1 (stok 47)
    // Tx Kasir 3: -2 (stok 45)
    if (currentStock === 45) {
      pass('TEST 10: STOCK LOCK & INTEGRITY', `Stok akhir tepat 45 unit (termasuk stock restore saat cancel)`);
    } else {
      fail('TEST 10: STOCK LOCK & INTEGRITY', `Expected stock 45, got ${currentStock}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 11 — IDEMPOTENCY (Regression Verification)');
    // ──────────────────────────────────────────────────────────
    const idemKey = `p4-idem-key-${Date.now()}`;
    const idemReq1 = await api('POST', '/api/transactions', {
      items: [{ productId: TEST_PROD_2, quantity: 1 }],
      paymentMethod: PM_TUNAI,
      cashGiven: 150000,
      idempotencyKey: idemKey
    }, auth(kasir3Token));

    const idemReq2 = await api('POST', '/api/transactions', {
      items: [{ productId: TEST_PROD_2, quantity: 1 }],
      paymentMethod: PM_TUNAI,
      cashGiven: 150000,
      idempotencyKey: idemKey
    }, auth(kasir3Token));

    if (idemReq1.status === 201 && idemReq2.status === 200 && idemReq1.data.invoiceNumber === idemReq2.data.invoiceNumber) {
      pass('TEST 11: IDEMPOTENCY', `Invoice sama (${idemReq1.data.invoiceNumber}), request 2 return 200 cached`);
    } else {
      fail('TEST 11: IDEMPOTENCY', `Req1: ${idemReq1.status}, Req2: ${idemReq2.status}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 12 — INVOICE SEQUENCE (Regression Verification)');
    // ──────────────────────────────────────────────────────────
    const nextTx = await api('POST', '/api/transactions', {
      items: [{ productId: TEST_PROD_2, quantity: 1 }],
      paymentMethod: PM_TUNAI,
      cashGiven: 150000,
      idempotencyKey: `p4-seq-test-${Date.now()}`
    }, auth(kasir3Token));

    const seqA = parseInt(idemReq1.data.invoiceNumber.split('-')[2], 10);
    const seqB = parseInt(nextTx.data.invoiceNumber.split('-')[2], 10);
    if (seqB === seqA + 1) {
      pass('TEST 12: INVOICE SEQUENCE', `Sequence bertambah berurutan: ${seqA} -> ${seqB}`);
    } else {
      fail('TEST 12: INVOICE SEQUENCE', `Sequence: ${seqA} -> ${seqB}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 14 — ADMIN CLOSING VIEW & REPORT (Step 14)');
    // ──────────────────────────────────────────────────────────
    const adminRep = await api('GET', `/api/attendance/laporan?startDate=${today}&endDate=${today}`, null, auth(adminToken));
    if (adminRep.status === 200 && Array.isArray(adminRep.data?.attendances)) {
      const gustiRecord = adminRep.data.attendances.find(a => a.userId === TEST_USER_ID);
      if (gustiRecord) {
        const hasAllFields = 
          gustiRecord.date &&
          gustiRecord.cashierName &&
          gustiRecord.openingCash === 500000 &&
          gustiRecord.expectedCash === 750000 &&
          gustiRecord.actualCash === 740000 &&
          gustiRecord.cashDifference === -10000 &&
          gustiRecord.status === 'completed' &&
          gustiRecord.stats?.totalTransactions === 4 &&
          gustiRecord.stats?.totalRevenue === 500000 &&
          gustiRecord.stats?.cashSales === 250000 &&
          gustiRecord.stats?.transferSales === 100000 &&
          gustiRecord.stats?.qrisSales === 150000;

        if (hasAllFields) {
          pass('TEST 14: ADMIN CLOSING VIEW', `Laporan admin mencakup seluruh data: Tanggal, Kasir, Modal, Transaksi (4), Total (500k), Cash (250k), Transfer (100k), QRIS (150k), Expected (750k), Actual (740k), Selisih (-10k), Status (completed)`);
        } else {
          fail('TEST 14: ADMIN CLOSING VIEW', `Field mismatch: ${JSON.stringify(gustiRecord)}`);
        }
      } else {
        fail('TEST 14: ADMIN CLOSING VIEW', `Gusti attendance not found in admin report`);
      }
    } else {
      fail('TEST 14: ADMIN CLOSING VIEW', `Admin report failed: status ${adminRep.status}`);
    }

  } catch (err) {
    fail('UNEXPECTED TEST ERROR', err.message);
    console.error(err);
  } finally {
    // Cleanup test data
    await client.query(`DELETE FROM transactions WHERE cashier_name IN ('Gusti Test', 'Kasir Dua', 'Kasir Tiga')`);
    await client.query(`DELETE FROM cashier_attendances WHERE user_id IN ($1, $2, 'USR-P4-KASIR3')`, [TEST_USER_ID, TEST_USER_2]);
    await client.query(`DELETE FROM products WHERE id IN ($1, $2)`, [TEST_PROD_1, TEST_PROD_2]);
    await client.query(`DELETE FROM users WHERE id IN ($1, $2, 'USR-P4-KASIR3')`, [TEST_USER_ID, TEST_USER_2]);
    await client.query(`DELETE FROM idempotency_keys WHERE key LIKE 'p4-%'`);

    client.release();
    await pool.end();
    server.close();

    console.log('\n' + '█'.repeat(65));
    console.log(`  HASIL AKHIR TEST SUITE PHASE 4.1`);
    console.log(`  TOTAL: ${passCount + failCount} | LULUS: ${passCount} | GAGAL: ${failCount}`);
    if (failures.length > 0) {
      console.log('  DAFTAR KEGAGALAN:');
      failures.forEach(f => console.log('   - ' + f));
    }
    console.log('█'.repeat(65) + '\n');

    process.exit(failCount === 0 ? 0 : 1);
  }
}

runPhase4Tests();
