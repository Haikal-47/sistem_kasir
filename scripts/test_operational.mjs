/**
 * test_operational.mjs
 * ARFA FASHION POS - Simulasi Operasional Nyata (Fixed)
 *
 * Mensimulasikan 1 hari kerja penuh - 32 tes
 * v2: Fixed /auth/me shape, payment method name, cascading stock expectations
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

const PORT = 3994;
const BASE = `http://127.0.0.1:${PORT}`;
const server = http.createServer(app);

const getJakartaDate = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

let passCount = 0;
let failCount = 0;
const failures = [];

function pass(label, detail = '') {
  passCount++;
  console.log(`  PASS  ${label}${detail ? ' -- ' + detail : ''}`);
}
function fail(label, detail = '') {
  failCount++;
  failures.push(label + (detail ? ': ' + detail : ''));
  console.log(`  FAIL  ${label}${detail ? ' -- ' + detail : ''}`);
}
function section(title) {
  console.log('\n' + '-'.repeat(60));
  console.log('  ' + title);
  console.log('-'.repeat(60));
}
async function api(method, path, body, headers = {}) {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let data; try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}
function auth(token) { return { Authorization: `Bearer ${token}` }; }

async function runOperationalTest() {
  await new Promise(resolve => server.listen(PORT, resolve));
  const today = getJakartaDate();
  const client = await pool.connect();
  const idk = `op-test-${Date.now()}`;

  console.log('\n' + '='.repeat(60));
  console.log('  ARFA FASHION POS -- SIMULASI OPERASIONAL NYATA');
  console.log('  Tanggal: ' + today);
  console.log('='.repeat(60));

  // Cleanup
  await client.query(`DELETE FROM transactions WHERE cashier_name = 'Kasir Test OP'`);
  await client.query(`DELETE FROM cashier_attendances WHERE user_id = 'USR-OP-KAS'`);
  await client.query(`DELETE FROM products WHERE id = 'PRD-OP-TEST'`);
  await client.query(`DELETE FROM users WHERE id = 'USR-OP-KAS'`);
  await client.query(`DELETE FROM idempotency_keys WHERE key LIKE 'op-test-%'`);

  // Setup produk
  await client.query(`
    INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, variants)
    VALUES ('PRD-OP-TEST', 'Kaos Polos OP Test', 'ARFA', 'Kaos', 75000, 40000, 50, '8991234560001', 'Pcs', '[]'::jsonb)
    ON CONFLICT (id) DO UPDATE SET price = 75000, stock = 50, variants = '[]'::jsonb
  `);

  // Setup user kasir
  let bcryptHash = '$2b$10$testhashabcdefghijklmnopqrstuvwxyz01234567890123456789';
  try {
    const bcrypt = await import('bcrypt');
    bcryptHash = await bcrypt.default.hash('testpass123', 10);
  } catch {}
  await client.query(`
    INSERT INTO users (id, username, name, password, role)
    VALUES ('USR-OP-KAS', 'kasir_op_test', 'Kasir Test OP', $1, 'kasir')
    ON CONFLICT (id) DO UPDATE SET password = $1, role = 'kasir'
  `, [bcryptHash]);

  const adminToken = createToken({ id: 'USR-ADM-01', username: 'admin', name: 'Super Admin', role: 'super_admin' });
  const kasirToken = createToken({ id: 'USR-OP-KAS', username: 'kasir_op_test', name: 'Kasir Test OP', role: 'kasir' });
  const otherToken = createToken({ id: 'USR-KAS-999', username: 'lain', name: 'Kasir Lain', role: 'kasir' });

  // Ambil metode pembayaran aktif dari DB (agar nama selalu sinkron)
  const pmRes = await client.query(`SELECT name FROM payment_methods WHERE is_active = true ORDER BY id`);
  const PM_TUNAI = pmRes.rows.find(r => r.name.toUpperCase().includes('TUNAI'))?.name || 'Tunai';
  const PM_TRANSFER = pmRes.rows.find(r => r.name.toUpperCase().includes('TRANSFER') && r.name.toUpperCase().includes('BCA'))?.name || 'BCA Transfer';
  const PM_QRIS = pmRes.rows.find(r => r.name.toUpperCase().includes('QRIS'))?.name || 'QRIS';
  console.log(`  Metode pembayaran: "${PM_TUNAI}", "${PM_TRANSFER}", "${PM_QRIS}"`);

  // ==========================================================================
  section('SESI 1 -- LOGIN & AUTENTIKASI');
  // ==========================================================================

  // TEST 1: /auth/me admin -- response: { user: { role, ... } }
  const me1 = await api('GET', '/api/auth/me', null, auth(adminToken));
  const adminRole = me1.data?.user?.role || me1.data?.role;
  if (me1.status === 200 && adminRole === 'super_admin')
    pass('Admin /auth/me', `role=${adminRole}`);
  else fail('Admin /auth/me', `status=${me1.status}, role=${adminRole}`);

  // TEST 2: /auth/me kasir
  const me2 = await api('GET', '/api/auth/me', null, auth(kasirToken));
  const kasirRole = me2.data?.user?.role || me2.data?.role;
  if (me2.status === 200 && kasirRole === 'kasir')
    pass('Kasir /auth/me', `role=${kasirRole}`);
  else fail('Kasir /auth/me', `status=${me2.status}, role=${kasirRole}`);

  // TEST 3: Token palsu -> 401
  const meInvalid = await api('GET', '/api/auth/me', null, { Authorization: 'Bearer token.palsu' });
  if (meInvalid.status === 401)
    pass('Token palsu -> 401');
  else fail('Token palsu -> 401', `status=${meInvalid.status}`);

  // TEST 4: Tanpa token -> 401 di protected route
  const noToken = await api('GET', '/api/transactions');
  if (noToken.status === 401)
    pass('Tanpa token -> 401 di /api/transactions');
  else fail('Tanpa token -> 401', `status=${noToken.status}`);

  // ==========================================================================
  section('SESI 2 -- ABSEN MASUK KASIR');
  // ==========================================================================

  const checkIn = await api('POST', '/api/attendance/check-in', {}, auth(kasirToken));
  if (checkIn.status === 200 && checkIn.data?.attendance?.status === 'working')
    pass('Absen masuk kasir OK', `ID=${checkIn.data.attendance.id}`);
  else fail('Absen masuk kasir', `status=${checkIn.status}, err=${checkIn.data?.error}`);

  const attId = checkIn.data?.attendance?.id;

  // TEST 6: Duplikat -> 400
  const checkIn2 = await api('POST', '/api/attendance/check-in', {}, auth(kasirToken));
  if (checkIn2.status === 400)
    pass('Absen masuk duplikat -> 400', checkIn2.data?.error?.slice(0, 60));
  else fail('Absen masuk duplikat -> 400', `status=${checkIn2.status}`);

  // TEST 7: Admin absen -> 403
  const adminCheckIn = await api('POST', '/api/attendance/check-in', {}, auth(adminToken));
  if (adminCheckIn.status === 403)
    pass('Admin absen -> 403');
  else fail('Admin absen -> 403', `status=${adminCheckIn.status}`);

  // TEST 8: Status absensi hari ini
  const todayAtt = await api('GET', '/api/attendance/today', null, auth(kasirToken));
  if (todayAtt.status === 200 && todayAtt.data?.status === 'working')
    pass('GET attendance/today = working');
  else fail('GET attendance/today', `status=${todayAtt.status}, attStatus=${todayAtt.data?.status}`);

  // ==========================================================================
  section('SESI 3 -- TRANSAKSI (Tunai, Transfer, QRIS)');
  // ==========================================================================

  // TEST 9: Tunai
  const txTunai = await api('POST', '/api/transactions', {
    items: [{ productId: 'PRD-OP-TEST', name: 'Kaos Polos OP Test', price: 75000, quantity: 2, subtotal: 150000 }],
    paymentMethod: PM_TUNAI, cashGiven: 200000, changeAmount: 50000
  }, { ...auth(kasirToken), 'idempotency-key': `${idk}-tunai` });
  if (txTunai.status === 201 && txTunai.data?.total === 150000)
    pass('Transaksi Tunai OK', `Invoice=${txTunai.data.invoiceNumber}, Rp${txTunai.data.total?.toLocaleString('id-ID')}`);
  else fail('Transaksi Tunai', `status=${txTunai.status}, err=${txTunai.data?.error}`);

  // TEST 10: Transfer (nama diambil langsung dari DB)
  const txTransfer = await api('POST', '/api/transactions', {
    items: [{ productId: 'PRD-OP-TEST', name: 'Kaos Polos OP Test', price: 75000, quantity: 1, subtotal: 75000 }],
    paymentMethod: PM_TRANSFER, cashGiven: 0, changeAmount: 0
  }, { ...auth(kasirToken), 'idempotency-key': `${idk}-transfer` });
  if (txTransfer.status === 201 && txTransfer.data?.total === 75000)
    pass('Transaksi Transfer OK', `Invoice=${txTransfer.data.invoiceNumber} via "${PM_TRANSFER}"`);
  else fail('Transaksi Transfer', `status=${txTransfer.status}, err=${txTransfer.data?.error}`);

  // TEST 11: QRIS
  const txQris = await api('POST', '/api/transactions', {
    items: [{ productId: 'PRD-OP-TEST', name: 'Kaos Polos OP Test', price: 75000, quantity: 1, subtotal: 75000 }],
    paymentMethod: PM_QRIS, cashGiven: 0, changeAmount: 0
  }, { ...auth(kasirToken), 'idempotency-key': `${idk}-qris` });
  if (txQris.status === 201 && txQris.data?.total === 75000)
    pass('Transaksi QRIS OK', `Invoice=${txQris.data.invoiceNumber}`);
  else fail('Transaksi QRIS', `status=${txQris.status}, err=${txQris.data?.error}`);

  // TEST 12: Idempotency replay
  const txReplay = await api('POST', '/api/transactions', {
    items: [{ productId: 'PRD-OP-TEST', name: 'Kaos Polos OP Test', price: 75000, quantity: 2, subtotal: 150000 }],
    paymentMethod: PM_TUNAI, cashGiven: 200000, changeAmount: 50000
  }, { ...auth(kasirToken), 'idempotency-key': `${idk}-tunai` });
  if (txReplay.status === 200 && txReplay.data?.id === txTunai.data?.id)
    pass('Idempotency -- replay tidak double charge', `ID sama: ${txReplay.data?.id}`);
  else fail('Idempotency replay', `status=${txReplay.status}`);

  // ==========================================================================
  section('SESI 4 -- VERIFIKASI STOK');
  // ==========================================================================

  // 3 transaksi berhasil: Tunai(qty=2), Transfer(qty=1), QRIS(qty=1) = 4 item
  const stockRow = await client.query(`SELECT stock FROM products WHERE id = 'PRD-OP-TEST'`);
  const currentStock = stockRow.rows[0]?.stock;
  // Hitung berdasarkan tx yang benar-benar masuk
  const txSuccessQty = (txTunai.status === 201 ? 2 : 0)
                     + (txTransfer.status === 201 ? 1 : 0)
                     + (txQris.status === 201 ? 1 : 0);
  const expectedStock = 50 - txSuccessQty;
  if (currentStock === expectedStock)
    pass('Stok berkurang akurat', `50 - ${txSuccessQty} = ${currentStock}`);
  else fail('Stok berkurang akurat', `Expected=${expectedStock}, Got=${currentStock}`);

  // ==========================================================================
  section('SESI 5 -- PEMBATALAN TRANSAKSI');
  // ==========================================================================

  const qrisId = txQris.data?.id;
  const cancelRes = qrisId
    ? await api('PATCH', `/api/transactions/${qrisId}/cancel`, {}, auth(adminToken))
    : { status: 0, data: { error: 'tx tidak ada' } };

  if (cancelRes.status === 200 && (cancelRes.data?.status === 'BATAL' || cancelRes.data?.transaction?.status === 'BATAL'))
    pass('Pembatalan QRIS sukses', 'Status=BATAL');
  else fail('Pembatalan QRIS', `status=${cancelRes.status}, data=${JSON.stringify(cancelRes.data).slice(0,80)}`);

  // Stok harus dikembalikan 1
  const stockCancel = await client.query(`SELECT stock FROM products WHERE id = 'PRD-OP-TEST'`);
  const stockAfterCancel = stockCancel.rows[0]?.stock;
  const expectedAfterCancel = expectedStock + (cancelRes.status === 200 && txQris.status === 201 ? 1 : 0);
  if (stockAfterCancel === expectedAfterCancel)
    pass('Stok dikembalikan setelah batal', `${expectedStock} + 1 = ${stockAfterCancel}`);
  else fail('Stok setelah batal', `Expected=${expectedAfterCancel}, Got=${stockAfterCancel}`);

  const kasirCancel = await api('PATCH', `/api/transactions/${txTransfer.data?.id}/cancel`, {}, auth(kasirToken));
  if (kasirCancel.status === 403)
    pass('Kasir tidak bisa batalkan -> 403');
  else fail('Kasir tidak bisa batalkan -> 403', `status=${kasirCancel.status}`);

  // ==========================================================================
  section('SESI 6 -- LAPORAN & RINGKASAN KAS');
  // ==========================================================================

  const summary = await api('GET', '/api/attendance/summary-today', null, auth(kasirToken));
  if (summary.status === 200)
    pass('Ringkasan kas hari ini OK', `revenue=Rp${(summary.data?.stats?.totalRevenue || 0).toLocaleString('id-ID')}`);
  else fail('Ringkasan kas', `status=${summary.status}`);

  const laporan = await api('GET', '/api/attendance/laporan', null, auth(adminToken));
  if (laporan.status === 200 && Array.isArray(laporan.data?.attendances))
    pass('Laporan historis admin OK', `${laporan.data.attendances.length} record`);
  else fail('Laporan historis admin', `status=${laporan.status}`);

  const kasirLaporan = await api('GET', '/api/attendance/laporan', null, auth(kasirToken));
  if (kasirLaporan.status === 403)
    pass('Kasir akses laporan admin -> 403');
  else fail('Kasir akses laporan admin -> 403', `status=${kasirLaporan.status}`);

  // ==========================================================================
  section('SESI 7 -- PAGINATION & FILTER');
  // ==========================================================================

  const page1 = await api('GET', '/api/transactions?page=1&limit=5', null, auth(adminToken));
  if (page1.status === 200 && page1.data?.pagination && page1.data?.data?.length <= 5)
    pass('Paginasi berjalan', `Page=${page1.data.pagination.page}, Total=${page1.data.pagination.total}`);
  else fail('Paginasi', `status=${page1.status}`);

  const capped = await api('GET', '/api/transactions?limit=9999', null, auth(adminToken));
  if (capped.status === 200 && capped.data?.pagination?.limit <= 100)
    pass('Limit >100 dicapped ke 100', `Enforced=${capped.data.pagination.limit}`);
  else fail('Limit dicapped', `returned=${capped.data?.pagination?.limit}`);

  const dateFilt = await api('GET', `/api/transactions?startDate=${today}&endDate=${today}`, null, auth(adminToken));
  if (dateFilt.status === 200 && Array.isArray(dateFilt.data?.data))
    pass('Filter tanggal hari ini OK', `${dateFilt.data.data.length} transaksi hari ini`);
  else fail('Filter tanggal', `status=${dateFilt.status}`);

  const badDate = await api('GET', '/api/transactions?startDate=31-12-2024', null, auth(adminToken));
  if (badDate.status === 400)
    pass('Format tanggal invalid -> 400');
  else fail('Format tanggal invalid -> 400', `status=${badDate.status}`);

  const kasirTx = await api('GET', '/api/transactions', null, auth(kasirToken));
  const otherTx = await api('GET', '/api/transactions', null, auth(otherToken));
  if (otherTx.status === 200 && otherTx.data?.pagination?.total === 0)
    pass('Scoping kasir OK', `kasir test=${kasirTx.data?.pagination?.total}, kasir lain=${otherTx.data?.pagination?.total}`);
  else fail('Scoping kasir', `kasir=${kasirTx.data?.pagination?.total}, lain=${otherTx.data?.pagination?.total}`);

  // ==========================================================================
  section('SESI 8 -- PERFORMANCE (50 Transaksi)');
  // ==========================================================================

  await client.query(`UPDATE products SET stock = 500 WHERE id = 'PRD-OP-TEST'`);

  // Ambil semua metode aktif untuk rotasi
  const allPm = pmRes.rows.map(r => r.name);
  const t0 = Date.now();
  let okCount = 0;
  for (let i = 0; i < 50; i++) {
    const methodName = allPm[i % allPm.length];
    const isTunai = methodName.toUpperCase() === 'TUNAI';
    const r = await api('POST', '/api/transactions', {
      items: [{ productId: 'PRD-OP-TEST', name: 'Kaos Polos OP Test', price: 75000, quantity: 1, subtotal: 75000 }],
      paymentMethod: methodName,
      cashGiven: isTunai ? 100000 : 0,
      changeAmount: isTunai ? 25000 : 0
    }, { ...auth(kasirToken), 'idempotency-key': `${idk}-perf-${i}` });
    if (r.status === 201) okCount++;
  }
  const elapsed = Date.now() - t0;
  const avg = Math.round(elapsed / 50);

  if (okCount === 50)
    pass('50 transaksi semua berhasil', `${okCount}/50`);
  else fail('50 transaksi performance', `Hanya ${okCount}/50 sukses`);

  if (avg < 1000)
    pass('Performa OK', `Total=${elapsed}ms, rata-rata=${avg}ms/tx`);
  else fail('Performa lambat', `rata-rata=${avg}ms/tx (target <1000ms)`);

  const stockPerf = await client.query(`SELECT stock FROM products WHERE id = 'PRD-OP-TEST'`);
  const spVal = stockPerf.rows[0]?.stock;
  if (spVal === 450)
    pass('Stok akurat setelah 50 tx', `500 - 50 = ${spVal}`);
  else fail('Stok setelah 50 tx', `Expected=450, Got=${spVal}`);

  // ==========================================================================
  section('SESI 9 -- TUTUP KAS');
  // ==========================================================================

  const kasStats = await client.query(`
    SELECT COALESCE(SUM(total), 0) as total FROM transactions
    WHERE attendance_id = $1 AND status = 'LUNAS' AND UPPER(payment_method) = 'TUNAI'
  `, [attId]);
  const tunaiTotal = parseFloat(kasStats.rows[0]?.total || 0);
  const expectedCash = 500000 + tunaiTotal;

  const checkOut = await api('POST', '/api/attendance/check-out', {
    actualCash: expectedCash, note: ''
  }, auth(kasirToken));
  if (checkOut.status === 200 && checkOut.data?.attendance?.status === 'completed')
    pass('Tutup kas berhasil (selisih=0)', `Expected=Rp${expectedCash.toLocaleString('id-ID')}`);
  else fail('Tutup kas', `status=${checkOut.status}, err=${checkOut.data?.error}`);

  const checkOut2 = await api('POST', '/api/attendance/check-out', { actualCash: expectedCash, note: '' }, auth(kasirToken));
  if (checkOut2.status === 400)
    pass('Tutup kas duplikat -> 400');
  else fail('Tutup kas duplikat -> 400', `status=${checkOut2.status}`);

  // ==========================================================================
  section('SESI 10 -- EDGE CASES');
  // ==========================================================================

  const prods = await api('GET', '/api/products');
  if (prods.status === 200 && Array.isArray(prods.data))
    pass('GET /api/products publik OK', `${prods.data.length} produk`);
  else fail('GET /api/products', `status=${prods.status}`);

  const kasirAddProd = await api('POST', '/api/products', {
    name: 'Test', brand: 'T', category: 'T', price: 1000, stock: 1
  }, auth(kasirToken));
  if (kasirAddProd.status === 403)
    pass('Kasir tambah produk -> 403');
  else fail('Kasir tambah produk -> 403', `status=${kasirAddProd.status}`);

  // Cleanup idempotency
  await client.query(`DELETE FROM idempotency_keys WHERE key LIKE 'op-test-%'`);

  // ==========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('  HASIL SIMULASI OPERASIONAL ARFA FASHION POS');
  console.log('='.repeat(60));
  console.log(`  PASSED : ${passCount}`);
  console.log(`  FAILED : ${failCount}`);
  console.log(`  TOTAL  : ${passCount + failCount}`);
  if (failures.length > 0) {
    console.log('\n  -- KEGAGALAN --');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  if (failCount === 0)
    console.log('\n  SEMUA TES LULUS -- Sistem siap produksi');
  else
    console.log(`\n  ${failCount} tes gagal -- perlu investigasi`);
  console.log('='.repeat(60) + '\n');

  client.release();
  server.close();
  await pool.end();
}

runOperationalTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
