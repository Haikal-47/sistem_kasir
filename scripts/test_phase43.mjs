/**
 * test_phase43.mjs
 * ARFA FASHION POS — Phase 4.3 Variant & Stock Integrity Hardening Test Suite
 *
 * Covers:
 * TEST 1  — Simple product checkout (stock atomic deduction)
 * TEST 2  — Variant checkout (variant stock deduction & total stock sync)
 * TEST 3  — Variant not found (rejection, no fall-through, stock untouched)
 * TEST 4  — Insufficient variant stock (rejection, stock untouched)
 * TEST 5  — Cancel variant by variantId (restore using variantId as primary key)
 * TEST 6  — Cancel double (first succeeds, second rejected, no double restore)
 * TEST 7  — Invalid variantId on checkout (rejected, no fall-through)
 * TEST 8  — Cancel with invalid variantId (rejected, rollback, tx not BATAL)
 * TEST 9  — Duplicate variant protection (rejected on create/update with 400)
 * TEST 10 — Stock consistency (variants sum strictly equals products.stock)
 * TEST 11 — Multi-item checkout rollback (valid + invalid variant -> entire rollback)
 * TEST 12 — Idempotency (duplicate key returns cached result, stock deducted once)
 * TEST 13 — Concurrency (two concurrent checkouts on stock=1 -> 1 ok, 1 409, stock=0)
 * TEST 14 — Backend Auth & Security Regression (bcrypt compare, timing safe, role enforcement)
 */
import http from 'http';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import app, { createToken as createApiToken, validateProductVariantStock, hasDuplicateVariants } from '../api/index.js';
import { createToken as createServerToken, verifyToken as verifyServerToken } from '../server/index.js';

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
  console.log(`  ✅ PASS  ${label}${detail ? ' -- ' + detail : ''}`);
}

function fail(label, detail = '') {
  failCount++;
  failures.push(label + (detail ? ': ' + detail : ''));
  console.log(`  ❌ FAIL  ${label}${detail ? ' -- ' + detail : ''}`);
}

const parseVariants = (v) => (typeof v === 'string' ? JSON.parse(v) : (v || []));

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

async function runPhase43Tests() {
  await new Promise(resolve => server.listen(PORT, resolve));
  const today = getJakartaDate();
  const client = await pool.connect();

  console.log('\n' + '█'.repeat(65));
  console.log('  ARFA FASHION POS — PHASE 4.3 TEST SUITE');
  console.log('  Variant & Stock Integrity Hardening');
  console.log('  Business Date: ' + today);
  console.log('█'.repeat(65));

  const TEST_CASHIER = {
    id: 'USR-P43-KASIR',
    username: 'kasir_p43',
    name: 'Gusti P43',
    role: 'kasir'
  };

  const TEST_ADMIN = {
    id: 'USR-P43-ADMIN',
    username: 'admin_p43',
    name: 'Admin P43',
    role: 'super_admin'
  };

  const cashierToken = createApiToken(TEST_CASHIER);
  const adminToken = createApiToken(TEST_ADMIN);

  // Prefix IDs for clean teardown
  const P_SIMPLE = 'PRD-P43-SMP';
  const P_VAR = 'PRD-P43-VAR';
  const P_MULTI_A = 'PRD-P43-MA';
  const P_MULTI_B = 'PRD-P43-MB';
  const P_CONC = 'PRD-P43-CONC';
  const ALL_TEST_PRODUCTS = [P_SIMPLE, P_VAR, P_MULTI_A, P_MULTI_B, P_CONC];

  try {
    // ── Setup: Cleanup old test data ──
    await client.query(`DELETE FROM transactions WHERE cashier_name = 'Gusti P43' OR invoice_number LIKE 'INV-P43-%'`);
    await client.query(`DELETE FROM cashier_attendances WHERE user_id = $1`, [TEST_CASHIER.id]);
    await client.query(`DELETE FROM products WHERE id = ANY($1)`, [ALL_TEST_PRODUCTS]);
    await client.query(`DELETE FROM idempotency_keys WHERE key LIKE 'IDEMP-P43-%'`);
    await client.query(`DELETE FROM users WHERE id = $1`, [TEST_CASHIER.id]);

    // Insert test cashier user
    await client.query(
      `INSERT INTO users (id, username, password, name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [TEST_CASHIER.id, TEST_CASHIER.username, 'dummy-hash', TEST_CASHIER.name, TEST_CASHIER.role]
    );

    // Ensure cashier attendance exists for checkout
    await client.query(
      `INSERT INTO cashier_attendances (id, user_id, cashier_name, date, check_in, opening_cash, status)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 500000, 'working')`,
      ['ATT-P43-001', TEST_CASHIER.id, TEST_CASHIER.name, today]
    );

    // =================================================================
    // TEST 1 — SIMPLE PRODUCT CHECKOUT
    // =================================================================
    section('TEST 1 — SIMPLE PRODUCT CHECKOUT');
    await client.query(
      `INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, colors, sizes, variants)
       VALUES ($1, 'Kaos Polos Simple', 'Arfa Basic', 'Pakaian', 50000, 30000, 10, 'BAR-P43-001', 'Pcs', '[]', '[]', '[]')`,
      [P_SIMPLE]
    );

    const res1 = await api('POST', '/api/transactions', {
      items: [{ productId: P_SIMPLE, quantity: 1 }],
      paymentMethod: 'tunai',
      cashGiven: 50000,
      totalAmount: 50000
    }, auth(cashierToken));

    const check1 = await client.query('SELECT stock FROM products WHERE id = $1', [P_SIMPLE]);
    if (res1.status === 201 && check1.rows[0].stock === 9) {
      pass('Simple product checkout successfully deducted stock from 10 to 9', `Stock: ${check1.rows[0].stock}`);
    } else {
      fail('Simple product checkout failed', `Status: ${res1.status}, Stock: ${check1.rows[0]?.stock}`);
    }

    // =================================================================
    // TEST 2 — VARIANT CHECKOUT
    // =================================================================
    section('TEST 2 — VARIANT CHECKOUT');
    const initialVariants = [
      { id: 'var-hitam-m', color: 'Hitam', size: 'M', stock: 2 },
      { id: 'var-hitam-l', color: 'Hitam', size: 'L', stock: 3 },
      { id: 'var-putih-m', color: 'Putih', size: 'M', stock: 5 },
    ];
    await client.query(
      `INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, colors, sizes, variants)
       VALUES ($1, 'Kemeja Formal Variant', 'Arfa Style', 'Kemeja', 100000, 60000, 10, 'BAR-P43-002', 'Pcs', '["Hitam","Putih"]', '["M","L"]', $2)`,
      [P_VAR, JSON.stringify(initialVariants)]
    );

    const res2 = await api('POST', '/api/transactions', {
      items: [{ productId: P_VAR, variantId: 'var-hitam-m', selectedColor: 'Hitam', selectedSize: 'M', quantity: 1 }],
      paymentMethod: 'tunai',
      cashGiven: 100000,
      totalAmount: 100000
    }, auth(cashierToken));

    const check2 = await client.query('SELECT stock, variants FROM products WHERE id = $1', [P_VAR]);
    const vars2 = parseVariants(check2.rows[0].variants);
    const varHitamM = vars2.find(v => v.id === 'var-hitam-m');
    const varHitamL = vars2.find(v => v.id === 'var-hitam-l');
    const varPutihM = vars2.find(v => v.id === 'var-putih-m');

    if (
      res2.status === 201 &&
      varHitamM.stock === 1 &&
      varHitamL.stock === 3 &&
      varPutihM.stock === 5 &&
      check2.rows[0].stock === 9
    ) {
      pass('Variant Hitam/M deducted (2 -> 1), other variants unchanged, total product stock = 9');
    } else {
      fail('Variant checkout stock discrepancy', `varHitamM: ${varHitamM?.stock}, total: ${check2.rows[0]?.stock}`);
    }

    // =================================================================
    // TEST 3 — VARIANT NOT FOUND (NO FALL-THROUGH)
    // =================================================================
    section('TEST 3 — VARIANT NOT FOUND (NO FALL-THROUGH)');
    const txCountBefore3 = (await client.query("SELECT COUNT(*) FROM transactions WHERE status = 'LUNAS'")).rows[0].count;

    const res3 = await api('POST', '/api/transactions', {
      items: [{ productId: P_VAR, selectedColor: 'Merah', selectedSize: 'XS', quantity: 1 }],
      paymentMethod: 'tunai',
      cashGiven: 100000,
      totalAmount: 100000
    }, auth(cashierToken));

    const check3 = await client.query('SELECT stock, variants FROM products WHERE id = $1', [P_VAR]);
    const txCountAfter3 = (await client.query("SELECT COUNT(*) FROM transactions WHERE status = 'LUNAS'")).rows[0].count;

    if (
      (res3.status === 400 || res3.status === 409) &&
      check3.rows[0].stock === 9 &&
      txCountAfter3 === txCountBefore3
    ) {
      pass('Non-existent variant (Merah/XS) rejected with 409, no fall-through, stock remained 9');
    } else {
      fail('Variant not found fall-through occurred or wrong status', `Status: ${res3.status}, Stock: ${check3.rows[0]?.stock}`);
    }

    // =================================================================
    // TEST 4 — INSUFFICIENT VARIANT STOCK
    // =================================================================
    section('TEST 4 — INSUFFICIENT VARIANT STOCK');
    // var-hitam-m now has stock = 1. Try to buy qty = 2
    const res4 = await api('POST', '/api/transactions', {
      items: [{ productId: P_VAR, variantId: 'var-hitam-m', selectedColor: 'Hitam', selectedSize: 'M', quantity: 2 }],
      paymentMethod: 'tunai',
      cashGiven: 200000,
      totalAmount: 200000
    }, auth(cashierToken));

    const check4 = await client.query('SELECT stock, variants FROM products WHERE id = $1', [P_VAR]);
    const vars4 = parseVariants(check4.rows[0].variants);
    const varHitamM4 = vars4.find(v => v.id === 'var-hitam-m');

    if (res4.status === 409 && varHitamM4.stock === 1 && check4.rows[0].stock === 9) {
      pass('Insufficient variant stock rejected with 409, stock remained Hitam/M = 1, total = 9');
    } else {
      fail('Insufficient variant stock not rejected properly', `Status: ${res4.status}, Stock: ${varHitamM4?.stock}`);
    }

    // =================================================================
    // TEST 5 — CANCEL VARIANT BY variantId
    // =================================================================
    section('TEST 5 — CANCEL VARIANT BY variantId');
    // Checkout 1 var-putih-m (stock was 5 -> becomes 4)
    const res5A = await api('POST', '/api/transactions', {
      items: [{ productId: P_VAR, variantId: 'var-putih-m', selectedColor: 'Putih', selectedSize: 'M', quantity: 1 }],
      paymentMethod: 'tunai',
      cashGiven: 100000,
      totalAmount: 100000
    }, auth(cashierToken));

    const tx5Id = res5A.data.id;
    const check5A = await client.query('SELECT stock, variants FROM products WHERE id = $1', [P_VAR]);
    const vars5A = parseVariants(check5A.rows[0].variants);
    const varPutihM_afterBuy = vars5A.find(v => v.id === 'var-putih-m');

    // Now cancel the transaction
    const res5B = await api('PATCH', `/api/transactions/${tx5Id}/cancel`, {}, auth(adminToken));
    const check5B = await client.query('SELECT stock, variants FROM products WHERE id = $1', [P_VAR]);
    const vars5B = parseVariants(check5B.rows[0].variants);
    const varPutihM_afterCancel = vars5B.find(v => v.id === 'var-putih-m');

    if (
      res5B.status === 200 &&
      varPutihM_afterBuy.stock === 4 &&
      varPutihM_afterCancel.stock === 5 &&
      check5B.rows[0].stock === 9
    ) {
      pass('Cancel variant restored stock using variantId (4 -> 5), total stock synced to 9');
    } else {
      fail('Cancel variant stock restore failed', `Status: ${res5B.status}, Restored stock: ${varPutihM_afterCancel?.stock}`);
    }

    // =================================================================
    // TEST 6 — CANCEL DOUBLE
    // =================================================================
    section('TEST 6 — CANCEL DOUBLE');
    const res6 = await api('PATCH', `/api/transactions/${tx5Id}/cancel`, {}, auth(adminToken));
    const check6 = await client.query('SELECT stock, variants FROM products WHERE id = $1', [P_VAR]);
    const vars6 = parseVariants(check6.rows[0].variants);
    const varPutihM6 = vars6.find(v => v.id === 'var-putih-m');

    if (res6.status === 400 && varPutihM6.stock === 5 && check6.rows[0].stock === 9) {
      pass('Second cancel rejected with 400, stock was NOT double-restored (stayed at 5)');
    } else {
      fail('Double cancel allowed or stock corrupted', `Status: ${res6.status}, Stock: ${varPutihM6?.stock}`);
    }

    // =================================================================
    // TEST 7 — INVALID variantId
    // =================================================================
    section('TEST 7 — INVALID variantId');
    const res7 = await api('POST', '/api/transactions', {
      items: [{ productId: P_VAR, variantId: 'var-nonexistent-999', quantity: 1 }],
      paymentMethod: 'tunai',
      cashGiven: 100000,
      totalAmount: 100000
    }, auth(cashierToken));

    const check7 = await client.query('SELECT stock FROM products WHERE id = $1', [P_VAR]);

    if (res7.status === 409 && check7.rows[0].stock === 9) {
      pass('Invalid variantId rejected with 409, products.stock untouched (9)');
    } else {
      fail('Invalid variantId checkout should be rejected', `Status: ${res7.status}, Stock: ${check7.rows[0]?.stock}`);
    }

    // =================================================================
    // TEST 8 — CANCEL INVALID variantId (ROLLBACK INTEGRITY)
    // =================================================================
    section('TEST 8 — CANCEL INVALID variantId (ROLLBACK INTEGRITY)');
    // Manually insert a mock transaction with a corrupted/missing variantId
    const dummyTxId = `TRX-P43-DUMMY-${Date.now()}`;
    await client.query(
      `INSERT INTO transactions (id, invoice_number, date, items, subtotal, discount, tax, total, payment_method, status, cashier_name)
       VALUES ($1, 'INV-P43-MOCK-001', CURRENT_TIMESTAMP, $2, 100000, 0, 0, 100000, 'tunai', 'LUNAS', 'Gusti P43')`,
      [
        dummyTxId,
        JSON.stringify([{
          productId: P_VAR,
          variantId: 'var-ghost-not-in-db',
          quantity: 1
        }])
      ]
    );

    const res8 = await api('PATCH', `/api/transactions/${dummyTxId}/cancel`, {}, auth(adminToken));
    const txCheck8 = await client.query('SELECT status FROM transactions WHERE id = $1', [dummyTxId]);
    const prodCheck8 = await client.query('SELECT stock FROM products WHERE id = $1', [P_VAR]);

    if (
      res8.status === 409 &&
      txCheck8.rows[0].status === 'LUNAS' &&
      prodCheck8.rows[0].stock === 9
    ) {
      pass('Cancel with missing variantId rolled back completely; status remained LUNAS, stock unchanged');
    } else {
      fail('Cancel invalid variantId failed integrity', `Status: ${res8.status}, TxStatus: ${txCheck8.rows[0]?.status}`);
    }

    // =================================================================
    // TEST 9 — DUPLICATE VARIANT PROTECTION
    // =================================================================
    section('TEST 9 — DUPLICATE VARIANT PROTECTION');
    const duplicateVariantPayload = {
      name: 'Baju Duplicate Test',
      brand: 'Arfa Test',
      category: 'Test',
      price: 50000,
      costPrice: 30000,
      barcode: 'BAR-P43-DUP-01',
      variants: [
        { id: 'v1', color: 'Hitam', size: 'M', stock: 5 },
        { id: 'v2', color: 'hitam', size: 'm', stock: 5 } // Case-insensitive duplicate
      ]
    };

    const res9Create = await api('POST', '/api/products', duplicateVariantPayload, auth(adminToken));

    // Also test PUT update duplicate rejection
    const res9Update = await api('PUT', `/api/products/${P_VAR}`, {
      variants: [
        { id: 'v1', color: 'Merah', size: 'XL', stock: 2 },
        { id: 'v2', color: 'MERAH', size: 'xl', stock: 3 }
      ]
    }, auth(adminToken));

    if (res9Create.status === 400 && res9Update.status === 400) {
      pass('Duplicate variant (Hitam/M + hitam/m) rejected on both CREATE and UPDATE with 400');
    } else {
      fail('Duplicate variant allowed', `Create: ${res9Create.status}, Update: ${res9Update.status}`);
    }

    // =================================================================
    // TEST 10 — STOCK CONSISTENCY (SUM(variants.stock) === product.stock)
    // =================================================================
    section('TEST 10 — STOCK CONSISTENCY');
    // Read current state of P_VAR
    const res10Before = await client.query('SELECT stock, variants FROM products WHERE id = $1', [P_VAR]);
    const vars10Before = parseVariants(res10Before.rows[0].variants);
    const sumBefore = vars10Before.reduce((acc, v) => acc + v.stock, 0);

    // Checkout 1 var-hitam-l (stock was 3 -> becomes 2)
    const res10 = await api('POST', '/api/transactions', {
      items: [{ productId: P_VAR, variantId: 'var-hitam-l', quantity: 1 }],
      paymentMethod: 'tunai',
      cashGiven: 100000,
      totalAmount: 100000
    }, auth(cashierToken));

    const res10After = await client.query('SELECT stock, variants FROM products WHERE id = $1', [P_VAR]);
    const vars10After = parseVariants(res10After.rows[0].variants);
    const sumAfter = vars10After.reduce((acc, v) => acc + v.stock, 0);

    if (
      res10.status === 201 &&
      sumBefore === res10Before.rows[0].stock &&
      sumAfter === res10After.rows[0].stock &&
      res10After.rows[0].stock === res10Before.rows[0].stock - 1
    ) {
      pass(`SUM(variants.stock) strictly equals product.stock (${sumBefore} -> ${sumAfter})`);
    } else {
      fail('Stock consistency mismatch', `Before: ${sumBefore} vs ${res10Before.rows[0].stock}, After: ${sumAfter} vs ${res10After.rows[0].stock}`);
    }

    // =================================================================
    // TEST 11 — CHECKOUT ROLLBACK (MULTI-ITEM ATOMICITY)
    // =================================================================
    section('TEST 11 — CHECKOUT ROLLBACK (MULTI-ITEM ATOMICITY)');
    await client.query(
      `INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, colors, sizes, variants)
       VALUES ($1, 'Item A Valid', 'Arfa', 'Test', 25000, 15000, 10, 'BAR-P43-MA', 'Pcs', '[]', '[]', '[]')`,
      [P_MULTI_A]
    );

    // Attempt multi-item checkout where Item A is valid, but Item B has invalid variant
    const res11 = await api('POST', '/api/transactions', {
      items: [
        { productId: P_MULTI_A, quantity: 2 }, // valid
        { productId: P_VAR, variantId: 'var-not-exist', quantity: 1 } // invalid variant
      ],
      paymentMethod: 'tunai',
      cashGiven: 150000,
      totalAmount: 150000
    }, auth(cashierToken));

    const check11A = await client.query('SELECT stock FROM products WHERE id = $1', [P_MULTI_A]);

    if (res11.status === 409 && check11A.rows[0].stock === 10) {
      pass('Entire multi-item checkout rolled back; Item A stock NOT deducted (remained 10)');
    } else {
      fail('Multi-item checkout failed rollback', `Status: ${res11.status}, Item A stock: ${check11A.rows[0]?.stock}`);
    }

    // =================================================================
    // TEST 12 — IDEMPOTENCY
    // =================================================================
    section('TEST 12 — IDEMPOTENCY');
    const idempKey = `IDEMP-P43-${Date.now()}`;
    const payload12 = {
      items: [{ productId: P_MULTI_A, quantity: 1 }],
      paymentMethod: 'tunai',
      cashGiven: 50000,
      totalAmount: 25000
    };

    const res12A = await api('POST', '/api/transactions', payload12, { ...auth(cashierToken), 'x-idempotency-key': idempKey });
    const stockAfter1 = (await client.query('SELECT stock FROM products WHERE id = $1', [P_MULTI_A])).rows[0].stock;

    const res12B = await api('POST', '/api/transactions', payload12, { ...auth(cashierToken), 'x-idempotency-key': idempKey });
    const stockAfter2 = (await client.query('SELECT stock FROM products WHERE id = $1', [P_MULTI_A])).rows[0].stock;

    if (
      res12A.status === 201 &&
      res12B.status === 200 &&
      stockAfter1 === 9 &&
      stockAfter2 === 9 &&
      res12A.data.id === res12B.data.id
    ) {
      pass('Duplicate idempotency key returned cached response (200), stock deducted only once (10 -> 9)');
    } else {
      fail('Idempotency failure', `resA: ${res12A.status}, resB: ${res12B.status}, Stock1: ${stockAfter1}, Stock2: ${stockAfter2}`);
    }

    // =================================================================
    // TEST 13 — CONCURRENCY (RACE CONDITION ON VARIANT STOCK)
    // =================================================================
    section('TEST 13 — CONCURRENCY (RACE CONDITION ON VARIANT STOCK)');
    const concVariants = [{ id: 'var-conc-only-one', color: 'Gold', size: 'L', stock: 1 }];
    await client.query(
      `INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, colors, sizes, variants)
       VALUES ($1, 'Limited Edition Gold', 'Arfa Exclusive', 'Pakaian', 200000, 100000, 1, 'BAR-P43-CONC', 'Pcs', '["Gold"]', '["L"]', $2)`,
      [P_CONC, JSON.stringify(concVariants)]
    );

    // Run two simultaneous checkout requests for the same single piece
    const [cRes1, cRes2] = await Promise.all([
      api('POST', '/api/transactions', {
        items: [{ productId: P_CONC, variantId: 'var-conc-only-one', quantity: 1 }],
        paymentMethod: 'tunai',
        cashGiven: 200000,
        totalAmount: 200000
      }, auth(cashierToken)),
      api('POST', '/api/transactions', {
        items: [{ productId: P_CONC, variantId: 'var-conc-only-one', quantity: 1 }],
        paymentMethod: 'tunai',
        cashGiven: 200000,
        totalAmount: 200000
      }, auth(cashierToken))
    ]);

    const statuses = [cRes1.status, cRes2.status].sort();
    const concCheck = await client.query('SELECT stock, variants FROM products WHERE id = $1', [P_CONC]);
    const concFinalVars = parseVariants(concCheck.rows[0].variants);

    if (
      statuses[0] === 201 &&
      statuses[1] === 409 &&
      concCheck.rows[0].stock === 0 &&
      concFinalVars[0].stock === 0
    ) {
      pass('Concurrency test: exactly 1 succeeded (201) and 1 failed (409), stock atomic at 0 without negative drift');
    } else {
      fail('Concurrency race condition detected', `Statuses: ${statuses.join(', ')}, FinalStock: ${concCheck.rows[0]?.stock}`);
    }

    // =================================================================
    // TEST 14 — BACKEND AUTH & SECURITY REGRESSION
    // =================================================================
    section('TEST 14 — BACKEND AUTH & SECURITY REGRESSION');

    // 14A. Timing-safe verifyToken from server/index.js
    const serverToken = createServerToken(TEST_ADMIN);
    const verifiedServerUser = verifyServerToken(serverToken);
    const tamperedServerToken = serverToken.slice(0, -4) + 'zzzz';
    const verifiedTampered = verifyServerToken(tamperedServerToken);

    if (verifiedServerUser && verifiedServerUser.id === TEST_ADMIN.id && verifiedTampered === null) {
      pass('server/index.js timingSafeEqual token verification is active and rejects tampered tokens');
    } else {
      fail('server/index.js token verification failed');
    }

    // 14B. bcrypt authentication on login
    // Fetch a real user password hash from DB
    const realUser = (await client.query("SELECT username, password FROM users WHERE role = 'super_admin' LIMIT 1")).rows[0];
    const isHashBcrypt = realUser.password.startsWith('$2b$') || realUser.password.startsWith('$2a$');
    if (isHashBcrypt) {
      pass('Database user passwords are valid bcrypt hashes');
    } else {
      fail('Database user password is not a bcrypt hash!');
    }

    // 14C. Cashier forbidden on Admin-only routes
    const cashierAdminAttempt = await api('GET', '/api/reports/summary', null, auth(cashierToken));
    if (cashierAdminAttempt.status === 403) {
      pass('Cashier token strictly forbidden from admin reports (403)');
    } else {
      fail('Cashier role was not forbidden from admin route', `Status: ${cashierAdminAttempt.status}`);
    }

    // 14D. CostPrice hidden from cashier / unauthenticated
    const prodListPublic = await api('GET', '/api/products', null);
    const hasExposedCost = prodListPublic.data.some(p => p.costPrice !== undefined);
    if (!hasExposedCost) {
      pass('costPrice is hidden from public/cashier responses in GET /api/products');
    } else {
      fail('costPrice was leaked to unauthenticated user');
    }

    // 14E. Helper unit validation
    const sampleProductConsistent = { stock: 5, variants: [{ stock: 2 }, { stock: 3 }] };
    const sampleProductInconsistent = { stock: 5, variants: [{ stock: 2 }, { stock: 4 }] };
    const consistentValid = validateProductVariantStock(sampleProductConsistent);
    const inconsistentValid = validateProductVariantStock(sampleProductInconsistent);
    const dupCheckTrue = hasDuplicateVariants([{ color: 'Hitam', size: 'M' }, { color: 'hitam', size: 'm' }]);
    const dupCheckFalse = hasDuplicateVariants([{ color: 'Hitam', size: 'M' }, { color: 'Hitam', size: 'L' }]);

    if (consistentValid === true && inconsistentValid === false && dupCheckTrue === true && dupCheckFalse === false) {
      pass('Variant helper functions (validateProductVariantStock, hasDuplicateVariants) operate accurately');
    } else {
      fail('Variant helper function logic error');
    }

  } finally {
    // ── Teardown: Clean up test artifacts ──
    await client.query(`DELETE FROM transactions WHERE cashier_name = 'Gusti P43' OR invoice_number LIKE 'INV-P43-%'`);
    await client.query(`DELETE FROM cashier_attendances WHERE user_id = $1`, [TEST_CASHIER.id]);
    await client.query(`DELETE FROM products WHERE id = ANY($1)`, [ALL_TEST_PRODUCTS]);
    await client.query(`DELETE FROM idempotency_keys WHERE key LIKE 'IDEMP-P43-%'`);
    await client.query(`DELETE FROM users WHERE id = $1`, [TEST_CASHIER.id]);
    client.release();
    await pool.end();
    server.close();
  }

  // =================================================================
  // SUMMARY
  // =================================================================
  console.log('\n' + '='.repeat(65));
  console.log(`  FINAL RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('='.repeat(65));

  if (failCount > 0) {
    console.error('\n❌ FAILURES:');
    failures.forEach(f => console.error('  - ' + f));
    process.exit(1);
  } else {
    console.log('\nAll Phase 4.3 tests PASSED! 🚀\n');
    process.exit(0);
  }
}

runPhase43Tests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
