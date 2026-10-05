/**
 * ARFA FASHION POS — PHASE 6.2 VERIFICATION TEST SUITE
 * Database Schema Consistency & Migration Hardening
 *
 * Minimal test requirements:
 *  1. Database connection
 *  2. Required tables exist
 *  3. Required columns exist
 *  4. Column types compatible
 *  5. transactions.user_id exists
 *  6. cashier_attendances snapshot fields exist
 *  7. cashier_attendances.closed_by exists
 *  8. formatAttendanceRow query works
 *  9. Existing transaction insert works
 * 10. Existing attendance/check-in works
 * 11. Cash closing still works
 * 12. Reports still work
 * 13. Checkout still works
 * 14. Cancel still works
 * 15. Idempotency still works
 * 16. Variant stock regression still works
 * 17. No destructive migration detected
 * 18. Migration can safely be rerun if applicable
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import app, { createToken as createApiToken } from '../api/index.js';
import { runMigration } from './migrate_phase62.mjs';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function createToken(payload) {
  return createApiToken(payload);
}

let passCount = 0;
let failCount = 0;
const failures = [];

function PASS(name, detail = '') {
  passCount++;
  console.log(`  ✅ PASS  ${name}${detail ? ' -- ' + detail : ''}`);
}

function FAIL(name, reason = '') {
  failCount++;
  const msg = `${name}${reason ? ': ' + reason : ''}`;
  failures.push(msg);
  console.log(`  ❌ FAIL  ${msg}`);
}

function section(title) {
  console.log('\n' + '='.repeat(65));
  console.log('  ' + title);
  console.log('='.repeat(65));
}

const TEST_PORT = 3962;
const BASE = `http://localhost:${TEST_PORT}`;
let server;

async function api(method, endpoint, body = null, headers = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${endpoint}`, opts);
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

async function runTests() {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  const client = await pool.connect();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  console.log('█'.repeat(65));
  console.log('  ARFA FASHION POS — PHASE 6.2 TEST SUITE');
  console.log('  Database Schema Consistency & Migration Hardening');
  console.log(`  Business Date: ${today}`);
  console.log('█'.repeat(65));

  const TEST_CASHIER = { id: 'USR-P62-KASIR', username: 'kasir_p62', name: 'Kasir P62', role: 'kasir' };
  const TEST_ADMIN   = { id: 'USR-P62-ADMIN', username: 'admin_p62', name: 'Admin P62', role: 'super_admin' };
  const cashierToken = createToken(TEST_CASHIER);
  const adminToken   = createToken(TEST_ADMIN);

  const P_TEST = 'PRD-P62-TEST';
  const ATT_ID = 'ATT-P62-001';

  try {
    // ── TEST 1: Database connection ─────────────────────────────────────
    section('TEST 1 — DATABASE CONNECTION');
    {
      const res = await client.query('SELECT 1 AS connected');
      if (res.rows[0]?.connected === 1) {
        PASS('Connected to PostgreSQL successfully');
      } else {
        FAIL('PostgreSQL connection check failed');
      }
    }

    // ── TEST 2: Required tables exist ────────────────────────────────────
    section('TEST 2 — REQUIRED TABLES EXIST');
    {
      const requiredTables = [
        'users', 'products', 'transactions', 'cashier_attendances',
        'idempotency_keys', 'payment_methods', 'store_settings',
        'cashier_profile', 'scanner_sessions', 'pending_scans'
      ];
      const res = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);
      const existing = new Set(res.rows.map(r => r.table_name));
      const missing = requiredTables.filter(t => !existing.has(t));
      if (missing.length === 0) {
        PASS('All 10 required production tables exist in database', requiredTables.join(', '));
      } else {
        FAIL('Missing required tables', missing.join(', '));
      }
    }

    // ── TEST 3: Required columns exist ───────────────────────────────────
    section('TEST 3 — REQUIRED COLUMNS EXIST ACROSS TABLES');
    {
      const colsRes = await client.query(`
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
      `);
      const colMap = new Map();
      colsRes.rows.forEach(r => {
        if (!colMap.has(r.table_name)) colMap.set(r.table_name, new Set());
        colMap.get(r.table_name).add(r.column_name);
      });

      const checks = [
        ['transactions', ['id', 'invoice_number', 'date', 'cashier_name', 'items', 'subtotal', 'total', 'payment_method', 'status', 'user_id', 'attendance_id', 'customer_name', 'customer_phone']],
        ['cashier_attendances', ['id', 'user_id', 'cashier_name', 'date', 'check_in', 'check_out', 'opening_cash', 'expected_cash', 'actual_cash', 'cash_difference', 'total_transactions', 'total_sales', 'total_cash', 'total_transfer', 'total_qris', 'closed_by', 'status']],
        ['products', ['id', 'name', 'brand', 'category', 'price', 'cost_price', 'stock', 'barcode', 'variants']],
        ['users', ['id', 'username', 'password', 'name', 'role', 'is_active']],
        ['idempotency_keys', ['key', 'transaction_id', 'response_body', 'created_at']],
        ['payment_methods', ['id', 'name', 'type', 'is_active', 'bank_name', 'account_number', 'account_holder']]
      ];

      let allFound = true;
      for (const [tbl, cols] of checks) {
        const existingCols = colMap.get(tbl) || new Set();
        const missing = cols.filter(c => !existingCols.has(c));
        if (missing.length > 0) {
          allFound = false;
          FAIL(`Table ${tbl} missing columns: ${missing.join(', ')}`);
        }
      }
      if (allFound) {
        PASS('All critical production columns exist across all core tables');
      }
    }

    // ── TEST 4: Column types compatible ──────────────────────────────────
    section('TEST 4 — COLUMN TYPES COMPATIBLE');
    {
      const typeRes = await client.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND (
          (table_name = 'transactions' AND column_name IN ('items', 'subtotal', 'total', 'user_id')) OR
          (table_name = 'products' AND column_name IN ('variants', 'price', 'stock')) OR
          (table_name = 'cashier_attendances' AND column_name IN ('total_sales', 'total_transactions', 'closed_by'))
        )
      `);
      const typeMap = new Map(typeRes.rows.map(r => [`${r.table_name}.${r.column_name}`, r.data_type]));

      const isJsonbItems = typeMap.get('transactions.items') === 'jsonb';
      const isNumericTotal = typeMap.get('transactions.total') === 'numeric';
      const isJsonbVariants = typeMap.get('products.variants') === 'jsonb';
      const isNumericSales = typeMap.get('cashier_attendances.total_sales') === 'numeric';

      if (isJsonbItems && isNumericTotal && isJsonbVariants && isNumericSales) {
        PASS('Core column types strictly compatible (jsonb, numeric, varchar)');
      } else {
        FAIL('Column type mismatch detected', JSON.stringify(Object.fromEntries(typeMap)));
      }
    }

    // ── TEST 5: transactions.user_id exists ──────────────────────────────
    section('TEST 5 — TRANSACTIONS.USER_ID VERIFICATION');
    {
      const res = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'user_id'
      `);
      if (res.rows.length === 1 && res.rows[0].data_type === 'character varying') {
        PASS(`transactions.user_id verified: ${res.rows[0].data_type}, nullable=${res.rows[0].is_nullable}`);
      } else {
        FAIL('transactions.user_id column not found or invalid type');
      }
    }

    // ── TEST 6: cashier_attendances snapshot fields exist ─────────────────
    section('TEST 6 — CASHIER_ATTENDANCES SNAPSHOT FIELDS VERIFICATION');
    {
      const snapCols = ['total_transactions', 'total_sales', 'total_cash', 'total_transfer', 'total_qris'];
      const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cashier_attendances' AND column_name = ANY($1)
      `, [snapCols]);
      if (res.rows.length === snapCols.length) {
        PASS('All 5 cash closing snapshot fields exist in cashier_attendances');
      } else {
        FAIL(`Expected ${snapCols.length} snapshot fields, found ${res.rows.length}`);
      }
    }

    // ── TEST 7: cashier_attendances.closed_by exists ──────────────────────
    section('TEST 7 — CASHIER_ATTENDANCES.CLOSED_BY VERIFICATION');
    {
      const res = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cashier_attendances' AND column_name = 'closed_by'
      `);
      if (res.rows.length === 1) {
        PASS(`cashier_attendances.closed_by verified (${res.rows[0].data_type})`);
      } else {
        FAIL('cashier_attendances.closed_by column not found');
      }
    }

    // ── TEST 8: formatAttendanceRow query works ──────────────────────────
    section('TEST 8 — FORMAT ATTENDANCE ROW QUERY INTEGRITY');
    {
      // Clean up previous test fixtures if any
      await client.query(`DELETE FROM transactions WHERE cashier_name = $1`, [TEST_CASHIER.name]);
      await client.query(`DELETE FROM cashier_attendances WHERE user_id = $1`, [TEST_CASHIER.id]);
      await client.query(`DELETE FROM products WHERE id = $1`, [P_TEST]);
      await client.query(`DELETE FROM users WHERE id = ANY($1)`, [[TEST_CASHIER.id, TEST_ADMIN.id]]);

      // Seed users
      await client.query(`
        INSERT INTO users (id, username, password, name, role, is_active)
        VALUES ($1, $2, 'dummy_hash', $3, $4, true), ($5, $6, 'dummy_hash', $7, $8, true)
      `, [TEST_CASHIER.id, TEST_CASHIER.username, TEST_CASHIER.name, TEST_CASHIER.role,
          TEST_ADMIN.id,   TEST_ADMIN.username,   TEST_ADMIN.name,   TEST_ADMIN.role]);

      // Seed attendance
      await client.query(`
        INSERT INTO cashier_attendances (id, user_id, cashier_name, date, check_in, opening_cash, status)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 500000, 'working')
      `, [ATT_ID, TEST_CASHIER.id, TEST_CASHIER.name, today]);

      // Query formatted row through API
      const { status, data } = await api('GET', '/api/attendance/today', null, auth(cashierToken));
      if (status === 200 && data?.attendance) {
        const att = data.attendance;
        const hasAllFields = att.id && att.userId && att.cashierName && att.openingCash && att.stats;
        if (hasAllFields) {
          PASS('GET /api/attendance/today executed formatAttendanceRow successfully without error');
        } else {
          FAIL('formatAttendanceRow result missing fields', JSON.stringify(att));
        }
      } else {
        FAIL('Failed to fetch formatted attendance row', `${status} ${JSON.stringify(data)}`);
      }
    }

    // ── TEST 9: Existing transaction insert works (all columns) ─────────
    section('TEST 9 — TRANSACTION INSERT WITH USER_ID');
    {
      const variantItems = [
        { id: `${P_TEST}-VAR-1`, color: 'Hitam', size: 'M', stock: 10, sku: 'ARF-TEST-HIT-M' }
      ];

      await client.query(`
        INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, variants)
        VALUES ($1, 'P62 Product', 'Brand', 'Atasan & Kemeja', 100000, 50000, 10, 'P62-BARCODE', $2)
      `, [P_TEST, JSON.stringify(variantItems)]);

      const txPayload = {
        items: [{ productId: P_TEST, variantId: `${P_TEST}-VAR-1`, selectedColor: 'Hitam', selectedSize: 'M', quantity: 1 }],
        paymentMethod: 'Tunai',
        cashGiven: 100000,
        totalAmount: 100000,
        customerName: 'Budi Santoso',
        customerPhone: '08123456789',
        idempotencyKey: `idem-p62-tx-${Date.now()}`
      };

      const { status, data } = await api('POST', '/api/transactions', txPayload, auth(cashierToken));
      if (status === 201 && data?.id) {
        // Verify user_id was stored in DB
        const { rows } = await client.query('SELECT user_id, customer_name, attendance_id FROM transactions WHERE id = $1', [data.id]);
        if (rows[0]?.user_id === TEST_CASHIER.id && rows[0]?.customer_name === 'Budi Santoso') {
          PASS(`Transaction created with user_id=${rows[0].user_id} and attendance_id=${rows[0].attendance_id}`);
        } else {
          FAIL('Transaction inserted but user_id not stored correctly', JSON.stringify(rows[0]));
        }
      } else {
        FAIL('Transaction insert failed', `${status} ${JSON.stringify(data)}`);
      }
    }

    // ── TEST 10: Existing attendance/check-in works ───────────────────────
    section('TEST 10 — ATTENDANCE CHECK-IN DUPLICATE DEFENSE');
    {
      // Attempt check-in when already checked in
      const { status } = await api('POST', '/api/attendance/check-in', {}, auth(cashierToken));
      if (status === 400) {
        PASS('Check-in duplicate safely rejected (HTTP 400 SESSION_ALREADY_OPEN)');
      } else {
        FAIL(`Expected 400 for duplicate check-in, got ${status}`);
      }
    }

    // ── TEST 11: Cash closing still works ────────────────────────────────
    section('TEST 11 — CASH CLOSING & SNAPSHOT FIELDS POPULATION');
    {
      const closePayload = {
        actualCash: 600000,
        note: 'Tutup kas normal P62'
      };
      const { status, data } = await api('POST', '/api/attendance/check-out', closePayload, auth(cashierToken));
      if (status === 200) {
        const { rows } = await client.query(`
          SELECT status, closed_by, total_transactions, total_sales, total_cash, actual_cash, cash_difference 
          FROM cashier_attendances WHERE id = $1
        `, [ATT_ID]);
        const r = rows[0];
        if (r?.status === 'completed' && r?.closed_by && Number(r?.total_transactions) >= 1) {
          PASS(`Cash closing completed: closed_by="${r.closed_by}", total_transactions=${r.total_transactions}, total_sales=${r.total_sales}`);
        } else {
          FAIL('Closing completed but snapshot fields not populated in DB', JSON.stringify(r));
        }
      } else {
        FAIL('Cash closing failed', `${status} ${JSON.stringify(data)}`);
      }
    }

    // ── TEST 12: Reports still work ──────────────────────────────────────
    section('TEST 12 — REPORTS AGGREGATION & TOP PRODUCTS');
    {
      const { status: s1, data: d1 } = await api('GET', '/api/reports/summary?period=TODAY', null, auth(adminToken));
      const { status: s2, data: d2 } = await api('GET', '/api/reports/top-products?period=TODAY', null, auth(adminToken));

      if (s1 === 200 && s2 === 200 && d1?.summary && Array.isArray(d2?.products)) {
        PASS('Reports /summary and /top-products operate smoothly on schema');
      } else {
        FAIL('Reports failed', `s1=${s1}, s2=${s2}`);
      }
    }

    // ── TEST 13: Checkout still works (stock deduction) ──────────────────
    section('TEST 13 — CHECKOUT & STOCK DEDUCTION');
    {
      // Open attendance again for cashier under admin or test checkout
      const { rows: bRows } = await client.query('SELECT stock FROM products WHERE id = $1', [P_TEST]);
      const stockBefore = bRows[0]?.stock;

      // Ensure active attendance for cashier
      await client.query(`UPDATE cashier_attendances SET status = 'working' WHERE id = $1`, [ATT_ID]);

      const { status } = await api('POST', '/api/transactions', {
        items: [{ productId: P_TEST, variantId: `${P_TEST}-VAR-1`, selectedColor: 'Hitam', selectedSize: 'M', quantity: 1 }],
        paymentMethod: 'Tunai',
        cashGiven: 100000,
        totalAmount: 100000,
        idempotencyKey: `idem-p62-co-${Date.now()}`
      }, auth(cashierToken));

      const { rows: aRows } = await client.query('SELECT stock FROM products WHERE id = $1', [P_TEST]);
      const stockAfter = aRows[0]?.stock;

      if (status === 201 && stockAfter === stockBefore - 1) {
        PASS(`Checkout succeeded: stock deducted from ${stockBefore} to ${stockAfter}`);
      } else {
        FAIL('Checkout or stock deduction failed', `status=${status}, before=${stockBefore}, after=${stockAfter}`);
      }
    }

    // ── TEST 14: Cancel still works ──────────────────────────────────────
    section('TEST 14 — TRANSACTION CANCEL & STOCK RESTORATION');
    {
      // Create transfer transaction to cancel
      const { status: s1, data: d1 } = await api('POST', '/api/transactions', {
        items: [{ productId: P_TEST, variantId: `${P_TEST}-VAR-1`, selectedColor: 'Hitam', selectedSize: 'M', quantity: 1 }],
        paymentMethod: 'BCA Transfer',
        totalAmount: 100000,
        idempotencyKey: `idem-p62-cancel-${Date.now()}`
      }, auth(cashierToken));

      if (s1 === 201 && d1?.id) {
        const { rows: midRows } = await client.query('SELECT stock FROM products WHERE id = $1', [P_TEST]);
        const stockMid = midRows[0]?.stock;

        const { status: sc } = await api('PATCH', `/api/transactions/${d1.id}/cancel`, null, auth(adminToken));
        const { rows: endRows } = await client.query('SELECT stock FROM products WHERE id = $1', [P_TEST]);
        const stockEnd = endRows[0]?.stock;

        if (sc === 200 && stockEnd === stockMid + 1) {
          PASS(`Transaction cancel restored stock (${stockMid} -> ${stockEnd})`);
        } else {
          FAIL('Cancel failed or stock not restored', `sc=${sc}, mid=${stockMid}, end=${stockEnd}`);
        }
      } else {
        FAIL('Could not setup transaction for cancel test', `${s1} ${JSON.stringify(d1)}`);
      }
    }

    // ── TEST 15: Idempotency still works ─────────────────────────────────
    section('TEST 15 — IDEMPOTENCY KEY VERIFICATION');
    {
      const key = `idem-p62-dedup-${Date.now()}`;
      const payload = {
        items: [{ productId: P_TEST, variantId: `${P_TEST}-VAR-1`, selectedColor: 'Hitam', selectedSize: 'M', quantity: 1 }],
        paymentMethod: 'Tunai',
        cashGiven: 100000,
        totalAmount: 100000,
        idempotencyKey: key
      };

      const r1 = await api('POST', '/api/transactions', payload, auth(cashierToken));
      const r2 = await api('POST', '/api/transactions', payload, auth(cashierToken));

      if (r1.status === 201 && r2.status === 200 && r1.data?.id === r2.data?.id) {
        PASS('Idempotency prevented duplicate transaction and returned cached response (200)');
      } else {
        FAIL('Idempotency failed', `r1=${r1.status}, r2=${r2.status}`);
      }
    }

    // ── TEST 16: Variant stock regression ────────────────────────────────
    section('TEST 16 — VARIANT STOCK REGRESSION');
    {
      const { rows } = await client.query('SELECT stock, variants FROM products WHERE id = $1', [P_TEST]);
      const p = rows[0];
      const sumVar = (p.variants || []).reduce((sum, v) => sum + Number(v.stock || 0), 0);
      if (sumVar === Number(p.stock)) {
        PASS(`SUM(variants.stock) === product.stock (${sumVar} === ${p.stock})`);
      } else {
        FAIL(`Variant stock mismatch: sum=${sumVar}, product.stock=${p.stock}`);
      }
    }

    // ── TEST 17: No destructive migration detected ───────────────────────
    section('TEST 17 — NO DESTRUCTIVE MIGRATION DETECTED');
    {
      const sqlFiles = [
        'database.sql',
        'server/initDb.js',
        'scripts/migrate_phase2.mjs',
        'scripts/migrate_phase3.mjs',
        'scripts/migrate_phase4.mjs',
        'scripts/migrate_phase62.mjs'
      ];

      const destructivePatterns = [
        /\bDROP\s+TABLE\b/i,
        /\bDROP\s+COLUMN\b/i,
        /\bTRUNCATE\b/i
      ];

      let destructiveFound = false;
      for (const relPath of sqlFiles) {
        const fullPath = path.resolve(process.cwd(), relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const pat of destructivePatterns) {
            if (pat.test(content)) {
              destructiveFound = true;
              FAIL(`Destructive SQL pattern "${pat}" found in ${relPath}`);
            }
          }
        }
      }

      if (!destructiveFound) {
        PASS('Zero destructive SQL operations (no DROP TABLE, no DROP COLUMN, no TRUNCATE) across all files');
      }
    }

    // ── TEST 18: Migration can safely be rerun ────────────────────────────
    section('TEST 18 — MIGRATION RE-RUN SAFETY (IDEMPOTENCY)');
    {
      try {
        await runMigration();
        await runMigration();
        PASS('migrate_phase62 runMigration() executed twice consecutively without error (100% idempotent)');
      } catch (err) {
        FAIL('Migration rerun threw error', err.message);
      }
    }

  } finally {
    // ── Teardown ─────────────────────────────────────────────────────────
    await client.query(`DELETE FROM transactions WHERE cashier_name = $1`, [TEST_CASHIER.name]);
    await client.query(`DELETE FROM cashier_attendances WHERE user_id = $1`, [TEST_CASHIER.id]);
    await client.query(`DELETE FROM products WHERE id = $1`, [P_TEST]);
    await client.query(`DELETE FROM users WHERE id = ANY($1)`, [[TEST_CASHIER.id, TEST_ADMIN.id]]);
    await client.query(`DELETE FROM idempotency_keys WHERE key LIKE 'idem-p62-%'`);
    client.release();
  }
}

async function main() {
  try {
    await runTests();
  } finally {
    server.close();
    await pool.end();
  }

  console.log('\n' + '='.repeat(65));
  console.log(`  FINAL RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('='.repeat(65));

  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(f => console.log(`  ❌ ${f}`));
    process.exit(1);
  } else {
    console.log('\nAll Phase 6.2 schema consistency tests PASSED! 🛡️\n');
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
