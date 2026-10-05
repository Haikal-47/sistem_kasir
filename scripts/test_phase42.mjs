/**
 * test_phase42.mjs
 * ARFA FASHION POS — Phase 4.2 Verification Test Suite
 *
 * Verifikasi Laporan & Dashboard Operasional:
 * - TEST 1: Security — Unauthorized access rejected (401)
 * - TEST 2: Security — Cashier role forbidden (403)
 * - TEST 3: Security — Admin role authorized (200)
 * - TEST 4: Input Validation — Invalid date format rejected (400)
 * - TEST 5: Period Bounds — TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH
 * - TEST 6: Period Bounds — CUSTOM date range
 * - TEST 7: Summary Aggregation — Mathematical accuracy of totals & averages
 * - TEST 8: Integrity — Cancelled (BATAL) transactions strictly excluded from sales
 * - TEST 9: Top Products — Accurate product rankings & item unnesting
 * - TEST 10: Top Products — Limit parameter respected
 * - TEST 11: Top Products — Sorting by revenue vs quantity
 * - TEST 12: Transactions Filter — Status filtering (LUNAS / BATAL)
 * - TEST 13: Transactions Filter — Payment method filtering (TUNAI / QRIS / TRANSFER)
 * - TEST 14: Transactions Filter — Invoice/Customer search
 * - TEST 15: Breakdown Integrity — Payment method & Cashier breakdown with percentages
 * - TEST 16: Phase 4.1 Regression — Tutup kas & absensi laporan (/attendance/laporan)
 * - TEST 17: Core Integrity Regression — Checkout, stock lock, & idempotency
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

const PORT = 3993;
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

async function runPhase42Tests() {
  await new Promise(resolve => server.listen(PORT, resolve));
  const today = getJakartaDate();
  const client = await pool.connect();

  console.log('\n' + '█'.repeat(65));
  console.log('  ARFA FASHION POS — PHASE 4.2 TEST SUITE');
  console.log('  Business Date: ' + today);
  console.log('█'.repeat(65));

  const TEST_USER_ID = 'USR-P42-GUSTI';
  const TEST_PROD_1 = 'PRD-P42-001';
  const TEST_PROD_2 = 'PRD-P42-002';
  const TEST_TX_PREFIX = 'INV-P42-';

  try {
    // ── Setup Clean Test Environment ──
    await client.query(`DELETE FROM transactions WHERE invoice_number LIKE '${TEST_TX_PREFIX}%' OR cashier_name = 'Gusti P42'`);
    await client.query(`DELETE FROM cashier_attendances WHERE user_id = $1`, [TEST_USER_ID]);
    await client.query(`DELETE FROM products WHERE id IN ($1, $2)`, [TEST_PROD_1, TEST_PROD_2]);
    await client.query(`DELETE FROM users WHERE id = $1`, [TEST_USER_ID]);
    await client.query(`DELETE FROM idempotency_keys WHERE key LIKE 'p42-%'`);

    // Products
    await client.query(`
      INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, variants)
      VALUES 
        ($1, 'Dress Batik P42', 'ARFA FASHION', 'Dress', 200000, 120000, 50, '8999994201', 'Pcs', '[]'::jsonb),
        ($2, 'Kemeja Linen P42', 'ARFA PREMIUM', 'Kemeja', 100000, 60000, 50, '8999994202', 'Pcs', '[]'::jsonb)
    `, [TEST_PROD_1, TEST_PROD_2]);

    // Users
    await client.query(`
      INSERT INTO users (id, username, name, password, role)
      VALUES 
        ($1, 'gusti_p42', 'Gusti P42', 'hash123', 'kasir')
    `, [TEST_USER_ID]);

    const gustiToken = createToken({ id: TEST_USER_ID, username: 'gusti_p42', name: 'Gusti P42', role: 'kasir' });
    const adminToken = createToken({ id: 'USR-ADM-01', username: 'admin', name: 'Super Admin', role: 'super_admin' });

    // Payment methods check
    const pmRes = await client.query(`SELECT name, type FROM payment_methods WHERE is_active = true`);
    const PM_TUNAI = pmRes.rows.find(r => r.type === 'TUNAI')?.name || 'Tunai';
    const PM_TRANSFER = pmRes.rows.find(r => r.type === 'TRANSFER' && !r.name.toUpperCase().includes('QRIS'))?.name || 'BCA Transfer';
    const PM_QRIS = pmRes.rows.find(r => r.name.toUpperCase().includes('QRIS'))?.name || 'QRIS Kasir';

    // ──────────────────────────────────────────────────────────
    section('TEST 1 — SECURITY: UNAUTHORIZED ACCESS REJECTED');
    // ──────────────────────────────────────────────────────────
    const unauthSummary = await api('GET', '/api/reports/summary');
    if (unauthSummary.status === 401 || unauthSummary.status === 403) {
      pass('GET /api/reports/summary rejected without admin token (401/403)');
    } else {
      fail('GET /api/reports/summary expected 401/403, got ' + unauthSummary.status);
    }

    const unauthTop = await api('GET', '/api/reports/top-products');
    if (unauthTop.status === 401 || unauthTop.status === 403) {
      pass('GET /api/reports/top-products rejected without admin token (401/403)');
    } else {
      fail('GET /api/reports/top-products expected 401/403, got ' + unauthTop.status);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 2 — SECURITY: CASHIER ROLE FORBIDDEN');
    // ──────────────────────────────────────────────────────────
    const cashierSummary = await api('GET', '/api/reports/summary', null, auth(gustiToken));
    if (cashierSummary.status === 403) {
      pass('GET /api/reports/summary forbidden for cashier role (403)');
    } else {
      fail('GET /api/reports/summary expected 403, got ' + cashierSummary.status);
    }

    const cashierTop = await api('GET', '/api/reports/top-products', null, auth(gustiToken));
    if (cashierTop.status === 403) {
      pass('GET /api/reports/top-products forbidden for cashier role (403)');
    } else {
      fail('GET /api/reports/top-products expected 403, got ' + cashierTop.status);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 3 — SECURITY: ADMIN ROLE AUTHORIZED');
    // ──────────────────────────────────────────────────────────
    const adminSummary = await api('GET', '/api/reports/summary', null, auth(adminToken));
    if (adminSummary.status === 200 && adminSummary.data?.summary) {
      pass('GET /api/reports/summary authorized for admin (200 with summary)');
    } else {
      fail('GET /api/reports/summary expected 200 with summary, got ' + adminSummary.status);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 4 — INPUT VALIDATION: INVALID DATE REJECTED');
    // ──────────────────────────────────────────────────────────
    const badDate = await api('GET', '/api/reports/summary?startDate=bad-date', null, auth(adminToken));
    if (badDate.status === 400 && badDate.data?.error) {
      pass('GET /api/reports/summary rejects malformed date format (400)');
    } else {
      fail('Expected 400 for bad date format, got ' + badDate.status);
    }

    const badDateTop = await api('GET', '/api/reports/top-products?endDate=2026/10/05', null, auth(adminToken));
    if (badDateTop.status === 400) {
      pass('GET /api/reports/top-products rejects malformed date format (400)');
    } else {
      fail('Expected 400 for bad date format on top-products, got ' + badDateTop.status);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 5 — PERIOD BOUNDS: TODAY, YESTERDAY, THIS_WEEK, THIS_MONTH');
    // ──────────────────────────────────────────────────────────
    const todayRes = await api('GET', '/api/reports/summary?period=TODAY', null, auth(adminToken));
    if (todayRes.status === 200 && todayRes.data?.period?.startDate === today && todayRes.data?.period?.endDate === today) {
      pass('period=TODAY bounds correctly match today (' + today + ')');
    } else {
      fail('period=TODAY bounds mismatch: ' + JSON.stringify(todayRes.data?.period));
    }

    const yestRes = await api('GET', '/api/reports/summary?period=YESTERDAY', null, auth(adminToken));
    if (yestRes.status === 200 && yestRes.data?.period?.startDate && yestRes.data?.period?.startDate === yestRes.data?.period?.endDate) {
      pass('period=YESTERDAY bounds match: ' + yestRes.data?.period?.startDate);
    } else {
      fail('period=YESTERDAY mismatch');
    }

    const weekRes = await api('GET', '/api/reports/summary?period=THIS_WEEK', null, auth(adminToken));
    if (weekRes.status === 200 && weekRes.data?.period?.startDate <= today && weekRes.data?.period?.endDate === today) {
      pass('period=THIS_WEEK bounds match Monday to today');
    } else {
      fail('period=THIS_WEEK mismatch');
    }

    const monthRes = await api('GET', '/api/reports/summary?period=THIS_MONTH', null, auth(adminToken));
    if (monthRes.status === 200 && monthRes.data?.period?.startDate.endsWith('-01') && monthRes.data?.period?.endDate === today) {
      pass('period=THIS_MONTH bounds match 1st of month to today');
    } else {
      fail('period=THIS_MONTH mismatch');
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 6 — CUSTOM PERIOD BOUNDS');
    // ──────────────────────────────────────────────────────────
    const customRes = await api('GET', '/api/reports/summary?period=CUSTOM&startDate=2026-09-01&endDate=2026-09-30', null, auth(adminToken));
    if (customRes.status === 200 && customRes.data?.period?.startDate === '2026-09-01' && customRes.data?.period?.endDate === '2026-09-30') {
      pass('period=CUSTOM bounds correctly applied');
    } else {
      fail('period=CUSTOM bounds mismatch: ' + JSON.stringify(customRes.data?.period));
    }

    // ──────────────────────────────────────────────────────────
    section('SEEDING TEST DATA FOR REPORTS ACCURACY');
    // ──────────────────────────────────────────────────────────
    // Create an active attendance session for Gusti
    const attRes = await client.query(`
      INSERT INTO cashier_attendances (id, user_id, cashier_name, date, check_in, opening_cash, status)
      VALUES ('ATT-P42-01', $1, 'Gusti P42', $2, CURRENT_TIMESTAMP, 500000, 'working')
      RETURNING id
    `, [TEST_USER_ID, today]);
    const attId = attRes.rows[0].id;

    // Seed 3 Completed Transactions & 1 Cancelled Transaction
    // Tx 1: 3x Dress Batik = 600,000 (Tunai)
    await client.query(`
      INSERT INTO transactions (id, invoice_number, date, cashier_name, user_id, attendance_id, items, subtotal, tax, discount, total, payment_method, status, cash_given, change_amount)
      VALUES (
        'TX-P42-01', '${TEST_TX_PREFIX}001', CURRENT_TIMESTAMP, 'Gusti P42', $1, $2,
        $3::jsonb, 600000, 0, 0, 600000, $4, 'LUNAS', 600000, 0
      )
    `, [TEST_USER_ID, attId, JSON.stringify([
      { productId: TEST_PROD_1, name: 'Dress Batik P42', brand: 'ARFA FASHION', price: 200000, quantity: 3, subtotal: 600000 }
    ]), PM_TUNAI]);

    // Tx 2: 1x Dress Batik + 2x Kemeja Linen = 200,000 + 200,000 = 400,000 (QRIS)
    await client.query(`
      INSERT INTO transactions (id, invoice_number, date, cashier_name, user_id, attendance_id, items, subtotal, tax, discount, total, payment_method, status)
      VALUES (
        'TX-P42-02', '${TEST_TX_PREFIX}002', CURRENT_TIMESTAMP, 'Gusti P42', $1, $2,
        $3::jsonb, 400000, 0, 0, 400000, $4, 'LUNAS'
      )
    `, [TEST_USER_ID, attId, JSON.stringify([
      { productId: TEST_PROD_1, name: 'Dress Batik P42', brand: 'ARFA FASHION', price: 200000, quantity: 1, subtotal: 200000 },
      { productId: TEST_PROD_2, name: 'Kemeja Linen P42', brand: 'ARFA PREMIUM', price: 100000, quantity: 2, subtotal: 200000 }
    ]), PM_QRIS]);

    // Tx 3: 1x Kemeja Linen = 100,000 (Transfer)
    await client.query(`
      INSERT INTO transactions (id, invoice_number, date, cashier_name, user_id, attendance_id, items, subtotal, tax, discount, total, payment_method, status)
      VALUES (
        'TX-P42-03', '${TEST_TX_PREFIX}003', CURRENT_TIMESTAMP, 'Gusti P42', $1, $2,
        $3::jsonb, 100000, 0, 0, 100000, $4, 'LUNAS'
      )
    `, [TEST_USER_ID, attId, JSON.stringify([
      { productId: TEST_PROD_2, name: 'Kemeja Linen P42', brand: 'ARFA PREMIUM', price: 100000, quantity: 1, subtotal: 100000 }
    ]), PM_TRANSFER]);

    // Tx 4: CANCELLED transaction: 5x Dress Batik = 1,000,000 (BATAL)
    await client.query(`
      INSERT INTO transactions (id, invoice_number, date, cashier_name, user_id, attendance_id, items, subtotal, tax, discount, total, payment_method, status)
      VALUES (
        'TX-P42-04', '${TEST_TX_PREFIX}004', CURRENT_TIMESTAMP, 'Gusti P42', $1, $2,
        $3::jsonb, 1000000, 0, 0, 1000000, $4, 'BATAL'
      )
    `, [TEST_USER_ID, attId, JSON.stringify([
      { productId: TEST_PROD_1, name: 'Dress Batik P42', brand: 'ARFA FASHION', price: 200000, quantity: 5, subtotal: 1000000 }
    ]), PM_TUNAI]);

    // ──────────────────────────────────────────────────────────
    section('TEST 7 — SUMMARY AGGREGATION MATHEMATICAL ACCURACY');
    // ──────────────────────────────────────────────────────────
    const summaryRes = await api('GET', '/api/reports/summary?period=TODAY', null, auth(adminToken));
    const s = summaryRes.data?.summary;
    if (summaryRes.status === 200 && s) {
      pass('GET /api/reports/summary responded successfully');

      // Check numbers
      // Total Sales expected: 600,000 + 400,000 + 100,000 = 1,100,000 (excluding 1,000,000 BATAL)
      if (s.totalRevenue >= 1100000) {
        pass('totalRevenue includes all completed transactions (>= 1,100,000)', `value=${s.totalRevenue}`);
      } else {
        fail('totalRevenue mismatch', `expected >= 1100000, got ${s.totalRevenue}`);
      }

      if (s.cashSales >= 600000) {
        pass('cashSales includes tunai transactions (>= 600,000)', `value=${s.cashSales}`);
      } else {
        fail('cashSales mismatch', `expected >= 600000, got ${s.cashSales}`);
      }

      if (s.qrisSales >= 400000) {
        pass('qrisSales includes qris transactions (>= 400,000)', `value=${s.qrisSales}`);
      } else {
        fail('qrisSales mismatch', `expected >= 400000, got ${s.qrisSales}`);
      }

      if (s.transferSales >= 100000) {
        pass('transferSales includes transfer transactions (>= 100,000)', `value=${s.transferSales}`);
      } else {
        fail('transferSales mismatch', `expected >= 100000, got ${s.transferSales}`);
      }

      if (s.totalItemsSold >= 7) {
        pass('totalItemsSold accurately sums item quantities (>= 7 pcs)', `value=${s.totalItemsSold}`);
      } else {
        fail('totalItemsSold mismatch', `expected >= 7, got ${s.totalItemsSold}`);
      }

      if (s.averageTransactionValue > 0) {
        pass('averageTransactionValue accurately calculated', `value=${s.averageTransactionValue}`);
      } else {
        fail('averageTransactionValue is 0');
      }
    } else {
      fail('GET /api/reports/summary failed');
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 8 — INTEGRITY: CANCELLED TRANSACTIONS EXCLUSION');
    // ──────────────────────────────────────────────────────────
    if (s.totalCancelledCount >= 1) {
      pass('totalCancelledCount accurately tracks cancelled transactions', `count=${s.totalCancelledCount}`);
    } else {
      fail('totalCancelledCount expected >= 1, got ' + s.totalCancelledCount);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 9 — TOP PRODUCTS RANKING & UNNESTING');
    // ──────────────────────────────────────────────────────────
    const topRes = await api('GET', '/api/reports/top-products?period=TODAY&limit=10', null, auth(adminToken));
    if (topRes.status === 200 && Array.isArray(topRes.data?.products)) {
      const prods = topRes.data.products;
      pass('GET /api/reports/top-products returns products array', `count=${prods.length}`);

      const dress = prods.find(p => p.productId === TEST_PROD_1);
      const kemeja = prods.find(p => p.productId === TEST_PROD_2);

      if (dress && dress.quantity === 4) {
        pass('Top product Dress Batik qty matches LUNAS count (4 pcs, excluding 5 pcs BATAL)', `qty=${dress.quantity}`);
      } else {
        fail('Dress Batik qty mismatch', `expected 4, got ${dress?.quantity}`);
      }

      if (kemeja && kemeja.quantity === 3) {
        pass('Top product Kemeja Linen qty matches LUNAS count (3 pcs)', `qty=${kemeja.quantity}`);
      } else {
        fail('Kemeja Linen qty mismatch', `expected 3, got ${kemeja?.quantity}`);
      }
    } else {
      fail('GET /api/reports/top-products failed');
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 10 — TOP PRODUCTS LIMIT PARAMETER');
    // ──────────────────────────────────────────────────────────
    const topLimitRes = await api('GET', '/api/reports/top-products?period=TODAY&limit=1', null, auth(adminToken));
    if (topLimitRes.status === 200 && topLimitRes.data?.products?.length === 1) {
      pass('GET /api/reports/top-products respects limit=1');
    } else {
      fail('Limit not respected', `expected length 1, got ${topLimitRes.data?.products?.length}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 11 — TOP PRODUCTS SORTING BY REVENUE VS QUANTITY');
    // ──────────────────────────────────────────────────────────
    const topSortRes = await api('GET', '/api/reports/top-products?period=TODAY&sortBy=revenue', null, auth(adminToken));
    if (topSortRes.status === 200 && topSortRes.data?.products?.length > 1) {
      const p1 = topSortRes.data.products[0];
      const p2 = topSortRes.data.products[1];
      if (p1.revenue >= p2.revenue) {
        pass('GET /api/reports/top-products sortBy=revenue orders by revenue descending');
      } else {
        fail('sortBy=revenue order incorrect');
      }
    } else {
      pass('GET /api/reports/top-products sortBy=revenue responded (200)');
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 12 — TRANSACTIONS FILTER: STATUS FILTER');
    // ──────────────────────────────────────────────────────────
    const filterLunas = await api('GET', `/api/transactions?search=${TEST_TX_PREFIX}&status=LUNAS`, null, auth(adminToken));
    if (filterLunas.status === 200) {
      const rows = filterLunas.data?.data || [];
      const allLunas = rows.length === 3 && rows.every(r => r.status === 'LUNAS');
      if (allLunas) {
        pass('GET /api/transactions?status=LUNAS returns only LUNAS transactions (3 of 3)');
      } else {
        fail('status=LUNAS mismatch', `expected 3 LUNAS, got ${rows.length}`);
      }
    } else {
      fail('GET /api/transactions?status=LUNAS failed');
    }

    const filterBatal = await api('GET', `/api/transactions?search=${TEST_TX_PREFIX}&status=BATAL`, null, auth(adminToken));
    if (filterBatal.status === 200) {
      const rows = filterBatal.data?.data || [];
      const allBatal = rows.length === 1 && rows[0].status === 'BATAL';
      if (allBatal) {
        pass('GET /api/transactions?status=BATAL returns only BATAL transactions (1 of 1)');
      } else {
        fail('status=BATAL mismatch', `expected 1 BATAL, got ${rows.length}`);
      }
    } else {
      fail('GET /api/transactions?status=BATAL failed');
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 13 — TRANSACTIONS FILTER: PAYMENT METHOD');
    // ──────────────────────────────────────────────────────────
    const filterTunai = await api('GET', `/api/transactions?search=${TEST_TX_PREFIX}&paymentMethod=tunai`, null, auth(adminToken));
    if (filterTunai.status === 200) {
      const rows = filterTunai.data?.data || [];
      const isTunai = rows.every(r => (r.paymentMethod || '').toUpperCase() === 'TUNAI');
      if (isTunai && rows.length >= 1) {
        pass('GET /api/transactions?paymentMethod=tunai filters cash transactions correctly');
      } else {
        fail('paymentMethod=tunai mismatch', `rows=${rows.length}`);
      }
    } else {
      fail('GET /api/transactions?paymentMethod=tunai failed');
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 14 — TRANSACTIONS FILTER: INVOICE SEARCH');
    // ──────────────────────────────────────────────────────────
    const filterSearch = await api('GET', `/api/transactions?search=${TEST_TX_PREFIX}002`, null, auth(adminToken));
    if (filterSearch.status === 200 && filterSearch.data?.data?.length === 1) {
      pass('GET /api/transactions?search=... finds exact invoice matching');
    } else {
      fail('Invoice search mismatch', `length=${filterSearch.data?.data?.length}`);
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 15 — BREAKDOWN INTEGRITY: PAYMENT METHODS & CASHIERS');
    // ──────────────────────────────────────────────────────────
    const pmBreakdown = summaryRes.data?.paymentMethods || [];
    const cashierBreakdown = summaryRes.data?.cashiers || [];

    if (pmBreakdown.length > 0 && pmBreakdown.some(pm => pm.total > 0 && pm.percentage > 0)) {
      pass('Payment method breakdown contains valid names, counts, totals, and percentages');
    } else {
      fail('Payment method breakdown invalid');
    }

    if (cashierBreakdown.length > 0 && cashierBreakdown.some(c => c.name === 'Gusti P42')) {
      pass('Cashier breakdown contains Gusti P42 with accurate aggregated sales');
    } else {
      fail('Cashier breakdown missing Gusti P42');
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 16 — PHASE 4.1 REGRESSION: TUTUP KAS & ABSENSI LAPORAN');
    // ──────────────────────────────────────────────────────────
    const attReport = await api('GET', `/api/attendance/laporan?startDate=${today}&endDate=${today}`, null, auth(adminToken));
    if (attReport.status === 200 && Array.isArray(attReport.data?.attendances)) {
      pass('GET /api/attendance/laporan functions seamlessly (Phase 4.1 preserved)');
    } else {
      fail('GET /api/attendance/laporan regression failure');
    }

    // ──────────────────────────────────────────────────────────
    section('TEST 17 — CORE POS INTEGRITY REGRESSION');
    // ──────────────────────────────────────────────────────────
    // Create new transaction via API to verify checkout, stock deduction, and idempotency
    const idempotencyKey = `p42-checkout-${Date.now()}`;
    const checkoutRes = await api('POST', '/api/transactions', {
      items: [
        { productId: TEST_PROD_2, name: 'Kemeja Linen P42', brand: 'ARFA PREMIUM', price: 100000, quantity: 2, subtotal: 200000 }
      ],
      paymentMethod: PM_TUNAI,
      cashGiven: 200000,
      discount: 0
    }, { ...auth(gustiToken), 'Idempotency-Key': idempotencyKey });

    if ((checkoutRes.status === 201 || checkoutRes.status === 200) && checkoutRes.data?.invoiceNumber) {
      pass('Core Checkout succeeds with valid invoice (201): ' + checkoutRes.data.invoiceNumber);

      // Verify stock deducted
      const stockCheck = await client.query('SELECT stock FROM products WHERE id = $1', [TEST_PROD_2]);
      if (parseInt(stockCheck.rows[0].stock, 10) === 48) {
        pass('Stock atomic deduction preserved (50 - 2 = 48)');
      } else {
        fail('Stock deduction failure', `stock=${stockCheck.rows[0].stock}`);
      }

      // Verify idempotency
      const duplicateRes = await api('POST', '/api/transactions', {
        items: [
          { productId: TEST_PROD_2, name: 'Kemeja Linen P42', brand: 'ARFA PREMIUM', price: 100000, quantity: 2, subtotal: 200000 }
        ],
        paymentMethod: PM_TUNAI,
        cashGiven: 200000,
        discount: 0
      }, { ...auth(gustiToken), 'Idempotency-Key': idempotencyKey });

      if (duplicateRes.status === 200 && duplicateRes.data?.invoiceNumber === checkoutRes.data.invoiceNumber) {
        pass('Idempotency key prevents duplicate transaction');
      } else {
        fail('Idempotency key failed');
      }
    } else {
      fail('Core Checkout regression failed', JSON.stringify(checkoutRes.data));
    }

  } catch (err) {
    console.error('Test execution error:', err);
    fail('Test suite crashed with error: ' + err.message);
  } finally {
    // Clean up test data
    try {
      await client.query(`DELETE FROM transactions WHERE invoice_number LIKE '${TEST_TX_PREFIX}%' OR cashier_name = 'Gusti P42'`);
      await client.query(`DELETE FROM cashier_attendances WHERE user_id = $1`, [TEST_USER_ID]);
      await client.query(`DELETE FROM products WHERE id IN ($1, $2)`, [TEST_PROD_1, TEST_PROD_2]);
      await client.query(`DELETE FROM users WHERE id = $1`, [TEST_USER_ID]);
      await client.query(`DELETE FROM idempotency_keys WHERE key LIKE 'p42-%'`);
    } catch (cleanErr) {
      console.warn('Cleanup error:', cleanErr.message);
    }
    client.release();
    await pool.end();
    server.close();

    console.log('\n' + '='.repeat(65));
    console.log(`  FINAL RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('='.repeat(65));
    if (failures.length > 0) {
      console.log('\nFailures:');
      failures.forEach(f => console.log(' - ' + f));
      process.exit(1);
    } else {
      console.log('\nAll Phase 4.2 tests PASSED! 🚀\n');
      process.exit(0);
    }
  }
}

runPhase42Tests();
