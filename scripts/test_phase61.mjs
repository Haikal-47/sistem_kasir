/**
 * ARFA FASHION POS — PHASE 6.1 TEST SUITE
 * Critical Security & Authorization Hardening
 *
 * Tests:
 *  1. Error responses don't leak stack traces / internals
 *  2. CRIT-3: Unauthenticated requests rejected (no offline bypass)
 *  3. CRIT-4: Scanner endpoints require valid auth
 *  4. HIGH-1: Confirm BATAL transaction is rejected (atomic lock)
 *  5. HIGH-5: Cashier cannot access user management (privilege escalation)
 *  6. HIGH-5: Admin cannot promote user to super_admin
 *  7. Reports RBAC: cashier forbidden from admin reports
 *  8. Core POS regression: checkout still works after hardening
 *  9. Tampered token rejected (timing-safe verify)
 * 10. Route integrity: /api prefix responds correctly
 */
import http from 'http';
import pg from 'pg';
import dotenv from 'dotenv';
import app, { createToken as createApiToken } from '../api/index.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PORT = 3961;
const BASE = `http://127.0.0.1:${PORT}`;
const server = http.createServer(app);

const getJakartaDate = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

let passCount = 0;
let failCount = 0;
const failures = [];

function PASS(label, detail = '') {
  passCount++;
  console.log(`  ✅ PASS  ${label}${detail ? ' -- ' + detail : ''}`);
}

function FAIL(label, detail = '') {
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
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function runTests() {
  await new Promise(resolve => server.listen(PORT, resolve));
  const today = getJakartaDate();
  const client = await pool.connect();

  console.log('\n' + '█'.repeat(65));
  console.log('  ARFA FASHION POS — PHASE 6.1 TEST SUITE');
  console.log('  Critical Security & Authorization Hardening');
  console.log('  Business Date: ' + today);
  console.log('█'.repeat(65));

  const TEST_CASHIER = { id: 'USR-P61-KASIR', username: 'kasir_p61', name: 'Kasir P61', role: 'kasir' };
  const TEST_ADMIN   = { id: 'USR-P61-ADMIN', username: 'admin_p61', name: 'Admin P61', role: 'super_admin' };

  const cashierToken = createApiToken(TEST_CASHIER);
  const adminToken   = createApiToken(TEST_ADMIN);

  const P_TEST = 'PRD-P61-TEST';

  try {
    // ── Setup: Cleanup & seed ────────────────────────────────────────────
    await client.query(`DELETE FROM transactions WHERE cashier_name = $1`, [TEST_CASHIER.name]);
    await client.query(`DELETE FROM cashier_attendances WHERE user_id = $1`, [TEST_CASHIER.id]);
    await client.query(`DELETE FROM products WHERE id = $1`, [P_TEST]);
    await client.query(`DELETE FROM users WHERE id = ANY($1)`, [[TEST_CASHIER.id, TEST_ADMIN.id]]);

    // Insert test products
    await client.query(`
      INSERT INTO products (id, name, brand, price, cost_price, stock, category, barcode)
      VALUES ($1, 'P61 Test Product', 'Test Brand', 100000, 50000, 50, 'Test', 'P61-BARCODE')
    `, [P_TEST]);

    // Insert test users
    await client.query(`
      INSERT INTO users (id, username, password, name, role, is_active)
      VALUES ($1, $2, 'dummy_hash', $3, $4, true), ($5, $6, 'dummy_hash', $7, $8, true)
    `, [TEST_CASHIER.id, TEST_CASHIER.username, TEST_CASHIER.name, TEST_CASHIER.role,
        TEST_ADMIN.id,   TEST_ADMIN.username,   TEST_ADMIN.name,   TEST_ADMIN.role]);

    // Insert attendance for cashier (working status)
    await client.query(`
      INSERT INTO cashier_attendances (id, user_id, cashier_name, date, check_in, opening_cash, status)
      VALUES ('ATT-P61-001', $1, $2, $3, CURRENT_TIMESTAMP, 500000, 'working')
      ON CONFLICT (user_id, date) DO NOTHING
    `, [TEST_CASHIER.id, TEST_CASHIER.name, today]);

    console.log('  ✔ Fixtures ready.\n');

    // ── TEST 1: Error sanitization ───────────────────────────────────────
    section('TEST 1 — ERROR SANITIZATION: No Stack Trace Exposure');
    {
      const { status, data } = await api('POST', '/api/transactions', {
        items: [{ productId: 'GHOST-PRODUCT', quantity: 1 }],
        paymentMethod: 'tunai', cashGiven: 100000, totalAmount: 100000,
        idempotencyKey: `idem-p61-err-${Date.now()}`
      }, auth(cashierToken));

      const bodyStr = JSON.stringify(data || {});
      const leaksStack = bodyStr.includes('at ') && bodyStr.includes('.js:');
      const leaksQuery = bodyStr.toLowerCase().includes('pg error') || (bodyStr.toLowerCase().includes('select') && bodyStr.toLowerCase().includes('from'));
      const leaksPath  = bodyStr.includes('C:\\\\') || bodyStr.includes('/home/');

      if (!leaksStack && !leaksQuery && !leaksPath) {
        PASS('Error response contains no stack trace / SQL / filesystem path');
      } else {
        FAIL('Error response leaks internal data', bodyStr.slice(0, 200));
      }

      // Any 4xx/5xx with an error field OR a non-leaking response is acceptable
      if (data?.error || data?.message || status >= 400) {
        PASS(`Error endpoint returns expected error response (${status})`);
      } else {
        FAIL('Error response did not return an error status', `${status} ${bodyStr}`);
      }
    }

    // ── TEST 2: No offline bypass (unauthenticated checkout) ─────────────
    section('TEST 2 — NO OFFLINE BYPASS: Unauthenticated Request Rejected');
    {
      const { status } = await api('POST', '/api/transactions', {
        items: [{ productId: P_TEST, quantity: 1 }],
        paymentMethod: 'tunai', cashGiven: 100000, totalAmount: 100000,
        idempotencyKey: `idem-p61-noauth-${Date.now()}`
      });
      if (status === 401 || status === 403) {
        PASS(`Unauthenticated checkout rejected (${status})`);
      } else {
        FAIL(`Expected 401/403, got ${status}`);
      }
    }

    // ── TEST 3: Scanner endpoints require auth ───────────────────────────
    section('TEST 3 — SCANNER AUTH: Endpoints Require Valid Token');
    {
      // heartbeat requires sessionCode body param — test without it should get 400 or 401/403
      const r1 = await api('POST', '/api/scan/heartbeat', {});
      if (r1.status === 401 || r1.status === 403 || r1.status === 400) {
        PASS(`POST /api/scan/heartbeat without auth/session rejected (${r1.status})`);
      } else {
        FAIL(`POST /api/scan/heartbeat expected 400/401/403, got ${r1.status}`);
      }

      const r2 = await api('GET', '/api/scan/pending?sessionCode=TEST');
      if (r2.status === 401 || r2.status === 403) {
        PASS('GET /api/scan/pending rejected without auth');
      } else {
        FAIL(`GET /api/scan/pending expected 401/403, got ${r2.status}`);
      }

      const r3 = await api('GET', '/api/scan/pending?sessionCode=KASIR-TEST', null, auth(cashierToken));
      if (r3.status !== 401 && r3.status !== 403) {
        PASS(`GET /api/scan/pending with valid auth returns ${r3.status} (not blocked)`);
      } else {
        FAIL(`GET /api/scan/pending with valid auth still blocked (${r3.status})`);
      }
    }

    // ── TEST 4: Confirm BATAL transaction rejected ───────────────────────
    section('TEST 4 — ATOMIC LOCK: Cannot Confirm BATAL Transaction');
    {
      const { status: s1, data: d1 } = await api('POST', '/api/transactions', {
        items: [{ productId: P_TEST, quantity: 1 }],
        paymentMethod: 'BCA Transfer', totalAmount: 100000,
        idempotencyKey: `idem-p61-batal-${Date.now()}`
      }, auth(cashierToken));

      if (s1 !== 201) {
        FAIL('Setup: Could not create transfer transaction', `${s1} ${JSON.stringify(d1)}`);
      } else {
        const txId = d1?.id || d1?.transaction?.id;
        if (!txId) {
          FAIL('Setup: Transaction ID not returned');
        } else {
          const { status: sc } = await api('PATCH', `/api/transactions/${txId}/cancel`, null, auth(adminToken));
          if (!sc || sc >= 300) {
            FAIL('Setup: Could not cancel transaction', sc);
          } else {
            const { status: conf } = await api('PATCH', `/api/transactions/${txId}/confirm`, null, auth(adminToken));
            if (conf === 400 || conf === 409 || conf === 422) {
              PASS(`Confirm BATAL transaction rejected (${conf})`);
            } else {
              FAIL(`Expected 400/409/422, got ${conf} — BATAL confirm may be allowed`);
            }
          }
        }
      }
    }

    // ── TEST 5: Cashier cannot access user management ────────────────────
    section('TEST 5 — PRIVILEGE ESCALATION: Cashier Blocked from User Mgmt');
    {
      const { status } = await api('PUT', `/api/users/${TEST_CASHIER.id}`,
        { role: 'super_admin' }, auth(cashierToken));
      if (status === 401 || status === 403) {
        PASS(`Cashier blocked from modifying user roles (${status})`);
      } else {
        FAIL(`Expected 401/403 for cashier PUT /api/users, got ${status}`);
      }
    }

    // ── TEST 6: Admin cannot promote to super_admin ──────────────────────
    section('TEST 6 — NO SUPER_ADMIN PROMOTION via API');
    {
      const { status } = await api('PUT', `/api/users/${TEST_CASHIER.id}`,
        { role: 'super_admin' }, auth(adminToken));
      if (status === 400 || status === 403) {
        PASS(`Admin cannot promote user to super_admin (${status})`);
      } else {
        FAIL(`Expected 400/403 for super_admin promotion, got ${status}`);
      }
    }

    // ── TEST 7: Reports RBAC ─────────────────────────────────────────────
    section('TEST 7 — REPORTS RBAC: Cashier Forbidden from Admin Reports');
    {
      const { status } = await api('GET', '/api/reports/summary', null, auth(cashierToken));
      if (status === 403) {
        PASS('GET /api/reports/summary returns 403 for cashier role');
      } else {
        FAIL(`Expected 403, got ${status}`);
      }
    }

    // ── TEST 8: Core checkout regression ────────────────────────────────
    section('TEST 8 — CORE POS REGRESSION: Checkout Still Works After Hardening');
    {
      const { rows: before } = await client.query('SELECT stock FROM products WHERE id=$1', [P_TEST]);
      const stockBefore = Number(before[0]?.stock ?? 50);

      const { status, data } = await api('POST', '/api/transactions', {
        items: [{ productId: P_TEST, quantity: 2 }],
        paymentMethod: 'tunai', cashGiven: 200000, totalAmount: 200000,
        idempotencyKey: `idem-p61-reg-${Date.now()}`
      }, auth(cashierToken));

      if (status === 201) {
        const { rows: after } = await client.query('SELECT stock FROM products WHERE id=$1', [P_TEST]);
        const stockAfter = Number(after[0]?.stock ?? 0);
        if (stockAfter === stockBefore - 2) {
          PASS(`Checkout 201 OK; stock ${stockBefore} → ${stockAfter}`);
        } else {
          FAIL(`Stock not correctly deducted: ${stockBefore} → ${stockAfter} (expected -2)`);
        }
      } else {
        FAIL(`Checkout failed: ${status}`, JSON.stringify(data));
      }
    }

    // ── TEST 9: Tampered token rejected ──────────────────────────────────
    section('TEST 9 — TAMPERED TOKEN REJECTED');
    {
      const tampered = adminToken.slice(0, -5) + 'XXXXX';
      const { status } = await api('GET', '/api/reports/summary', null, { Authorization: `Bearer ${tampered}` });
      if (status === 401 || status === 403) {
        PASS(`Tampered token rejected (${status})`);
      } else {
        FAIL(`Expected 401/403 for tampered token, got ${status}`);
      }
    }

    // ── TEST 10: Route integrity ─────────────────────────────────────────
    section('TEST 10 — ROUTE INTEGRITY: /api prefix routes correctly');
    {
      const r1 = await api('GET', '/api/products', null, auth(cashierToken));
      if (r1.status === 200) {
        PASS(`GET /api/products returns 200`);
      } else {
        FAIL(`GET /api/products returned ${r1.status}`);
      }

      // /products (without /api prefix) should NOT work (double mount removed)
      const r2 = await api('GET', '/products');
      if (r2.status === 404 || r2.status === 401 || r2.status === 403) {
        PASS(`GET /products (no prefix) returns ${r2.status} — not double-mounted`);
      } else {
        // Acceptable if non-JSON
        const bodyStr = JSON.stringify(r2.data || {});
        if (r2.data && Array.isArray(r2.data)) {
          FAIL(`GET /products leaked product list without /api prefix (double mount present)`);
        } else {
          PASS(`GET /products returns ${r2.status} non-product data (acceptable)`);
        }
      }
    }

  } finally {
    // ── Teardown ─────────────────────────────────────────────────────────
    await client.query(`DELETE FROM transactions WHERE cashier_name = $1`, [TEST_CASHIER.name]);
    await client.query(`DELETE FROM cashier_attendances WHERE user_id = $1`, [TEST_CASHIER.id]);
    await client.query(`DELETE FROM products WHERE id = $1`, [P_TEST]);
    await client.query(`DELETE FROM users WHERE id = ANY($1)`, [[TEST_CASHIER.id, TEST_ADMIN.id]]);
    await client.query(`DELETE FROM idempotency_keys WHERE key LIKE 'idem-p61-%'`);
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
    console.log('\nAll Phase 6.1 security tests PASSED! 🔐\n');
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
