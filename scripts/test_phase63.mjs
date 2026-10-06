/**
 * ARFA FASHION POS — PHASE 6.3 VERIFICATION TEST SUITE
 * Stock Mutation & Product Safety Hardening
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

const TEST_PORT = 3963;
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
  console.log('  ARFA FASHION POS — PHASE 6.3 TEST SUITE');
  console.log('  Stock Mutation & Product Safety Hardening');
  console.log(`  Business Date: ${today}`);
  console.log('█'.repeat(65));

  const TEST_CASHIER = { id: 'USR-P63-KASIR', username: 'gusti', name: 'Gusti', role: 'kasir' };
  const TEST_ADMIN   = { id: 'USR-P63-ADMIN', username: 'admin_p63', name: 'Admin P63', role: 'super_admin' };
  const cashierToken = createToken(TEST_CASHIER);
  const adminToken   = createToken(TEST_ADMIN);

  let idA, varA1;
  let idB, varB1;
  let idSolo;

  try {
    // Ensure test users exist in DB
    await client.query(`
      INSERT INTO users (id, username, password, name, role, is_active)
      VALUES 
        ($1, $2, 'hash', $3, 'kasir', TRUE),
        ($4, $5, 'hash', $6, 'super_admin', TRUE)
      ON CONFLICT (id) DO UPDATE SET is_active = TRUE
    `, [TEST_CASHIER.id, TEST_CASHIER.username, TEST_CASHIER.name, TEST_ADMIN.id, TEST_ADMIN.username, TEST_ADMIN.name]);

    // Ensure active attendance for cashier
    // FIX: Use ON CONFLICT (id) to handle date rollover correctly.
    // The hardcoded ID 'ATT-P63-001' must upsert on its own PK,
    // not on (user_id, date) which fails when today changes.
    await client.query(`
      INSERT INTO cashier_attendances (id, user_id, cashier_name, date, check_in, opening_cash, status)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 500000, 'working')
      ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, status = 'working'
    `, ['ATT-P63-001', TEST_CASHIER.id, TEST_CASHIER.name, today]);

    // ── SECTION 1: DATABASE CHECK CONSTRAINT ENFORCEMENT ─────────────────
    section('1. DATABASE INVARIANT & CHECK CONSTRAINT');
    {
      const constraintCheck = await client.query(`
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint
        WHERE conrelid = 'products'::regclass
          AND conname = 'chk_products_stock_non_negative'
      `);
      if (constraintCheck.rows.length > 0) {
        PASS('chk_products_stock_non_negative exists in PostgreSQL', constraintCheck.rows[0].def);
      } else {
        FAIL('chk_products_stock_non_negative missing');
      }

      // Test raw negative stock insert is blocked by PostgreSQL
      let dbConstraintCaught = false;
      try {
        await client.query(`
          INSERT INTO products (id, name, brand, category, price, stock, barcode)
          VALUES ('TEST-NEG-DB', 'Neg Test', 'Brand', 'Cat', 10000, -5, 'BAR-NEG-DB')
        `);
      } catch (err) {
        if (err.message.includes('chk_products_stock_non_negative') || err.code === '23514') {
          dbConstraintCaught = true;
        }
      }
      if (dbConstraintCaught) {
        PASS('PostgreSQL directly rejects negative product stock (CHECK constraint 23514)');
      } else {
        FAIL('PostgreSQL did not reject negative stock insert');
      }
    }

    // ── SECTION 2: PRODUCT & VARIANT CREATION/UPDATE VALIDATION ──────────
    section('2. PRODUCT & VARIANT INTEGRITY VALIDATION');
    {
      // Negative stock rejected in POST /api/products
      const negProductRes = await api('POST', '/api/products', {
        name: 'Produk Negatif',
        brand: 'Arfa',
        category: 'Test',
        price: 50000,
        stock: -1,
        barcode: 'BAR-NEG-P1'
      }, auth(adminToken));
      if (negProductRes.status === 400 && negProductRes.data?.error?.toLowerCase().includes('stok')) {
        PASS('POST /api/products rejects negative stock (400)');
      } else {
        FAIL('POST /api/products allowed negative stock', `status: ${negProductRes.status}`);
      }

      // Negative variant stock rejected
      const negVarRes = await api('POST', '/api/products', {
        name: 'Produk Neg Var',
        brand: 'Arfa',
        category: 'Test',
        price: 50000,
        stock: 5,
        barcode: 'BAR-NEG-P2',
        variants: [
          { id: 'VAR-1', color: 'Hitam', size: 'M', stock: -2, price: 50000 }
        ]
      }, auth(adminToken));
      if (negVarRes.status === 400 && negVarRes.data?.error?.toLowerCase().includes('varian')) {
        PASS('POST /api/products rejects negative variant stock (400)');
      } else {
        FAIL('POST /api/products allowed negative variant stock', `status: ${negVarRes.status}`);
      }

      // Negative price rejected
      const negPriceRes = await api('POST', '/api/products', {
        name: 'Produk Neg Price',
        brand: 'Arfa',
        category: 'Test',
        price: -5000,
        stock: 5,
        barcode: 'BAR-NEG-P3'
      }, auth(adminToken));
      if (negPriceRes.status === 400 && negPriceRes.data?.error?.toLowerCase().includes('harga')) {
        PASS('POST /api/products rejects negative price (400)');
      } else {
        FAIL('POST /api/products allowed negative price', `status: ${negPriceRes.status}`);
      }

      // Duplicate variant combination rejected
      const dupVarRes = await api('POST', '/api/products', {
        name: 'Produk Dup Var',
        brand: 'Arfa',
        category: 'Test',
        price: 50000,
        stock: 10,
        barcode: 'BAR-DUP-V1',
        variants: [
          { id: 'V1', color: 'Merah', size: 'L', stock: 5, price: 50000 },
          { id: 'V2', color: 'Merah', size: 'L', stock: 5, price: 50000 }
        ]
      }, auth(adminToken));
      if (dupVarRes.status === 400 && dupVarRes.data?.error?.toLowerCase().includes('kombinasi')) {
        PASS('POST /api/products rejects duplicate variant combinations (400)');
      } else {
        FAIL('POST /api/products allowed duplicate variant combination', `status: ${dupVarRes.status}, data: ${JSON.stringify(dupVarRes.data)}`);
      }

      // Create valid product A with variants for checkout tests
      const prodARes = await api('POST', '/api/products', {
        name: 'Gamis Test P63 A',
        brand: 'Arfa Fashion',
        category: 'Gamis',
        price: 150000,
        costPrice: 100000,
        stock: 10,
        barcode: `BAR-P63-A-${Date.now()}`,
        colors: ['Navy'],
        sizes: ['XL'],
        variants: [
          { id: `VAR-P63-A1-${Date.now()}`, color: 'Navy', size: 'XL', stock: 10, price: 150000, barcode: `BAR-VAR-P63-A1-${Date.now()}` }
        ]
      }, auth(adminToken));
      if (prodARes.status === 201 && prodARes.data?.id) {
        idA = prodARes.data.id;
        varA1 = prodARes.data.variants[0].id;
        PASS(`Created valid product A with 10 stock (ID: ${idA})`);
      } else {
        FAIL('Failed to create product A', JSON.stringify(prodARes.data));
      }

      // Create product B with exactly 1 stock for concurrent race condition test
      const prodBRes = await api('POST', '/api/products', {
        name: 'Kemeja Test P63 B (Stock 1)',
        brand: 'Arfa Fashion',
        category: 'Kemeja',
        price: 80000,
        costPrice: 50000,
        stock: 1,
        barcode: `BAR-P63-B-${Date.now()}`,
        colors: ['Putih'],
        sizes: ['M'],
        variants: [
          { id: `VAR-P63-B1-${Date.now()}`, color: 'Putih', size: 'M', stock: 1, price: 80000, barcode: `BAR-VAR-P63-B1-${Date.now()}` }
        ]
      }, auth(adminToken));
      if (prodBRes.status === 201 && prodBRes.data?.id) {
        idB = prodBRes.data.id;
        varB1 = prodBRes.data.variants[0].id;
        PASS(`Created valid product B with 1 stock (ID: ${idB})`);
      } else {
        FAIL('Failed to create product B', JSON.stringify(prodBRes.data));
      }

      // Create product Solo without transactions for delete test
      const prodSoloRes = await api('POST', '/api/products', {
        name: 'Produk Solo Delete Test',
        brand: 'Arfa Fashion',
        category: 'Aksesoris',
        price: 25000,
        costPrice: 15000,
        stock: 5,
        barcode: `BAR-P63-SOLO-${Date.now()}`,
        colors: [],
        sizes: [],
        variants: []
      }, auth(adminToken));
      if (prodSoloRes.status === 201 && prodSoloRes.data?.id) {
        idSolo = prodSoloRes.data.id;
        PASS(`Created standalone product Solo for delete safety test (ID: ${idSolo})`);
      } else {
        FAIL('Failed to create product Solo', JSON.stringify(prodSoloRes.data));
      }
    }

    // ── SECTION 3: STOCK ADJUSTMENT ENDPOINT (PATCH /api/products/:id/stock)
    section('3. STOCK ADJUSTMENT ATOMICITY & SAFETY');
    {
      // Cashier forbidden from direct stock adjustment
      const kasirAdj = await api('PATCH', `/api/products/${idA}/stock`, {
        newStock: 20
      }, auth(cashierToken));
      if (kasirAdj.status === 403) {
        PASS('PATCH /api/products/:id/stock rejects non-admin users (403)');
      } else {
        FAIL('Cashier was allowed to adjust stock', `status: ${kasirAdj.status}`);
      }

      // Negative newStock rejected
      const negAdj = await api('PATCH', `/api/products/${idA}/stock`, {
        newStock: -3
      }, auth(adminToken));
      if (negAdj.status === 400) {
        PASS('PATCH /api/products/:id/stock rejects negative newStock (400)');
      } else {
        FAIL('Negative newStock allowed', `status: ${negAdj.status}`);
      }

      // Excessive negative deltaStock rejected
      const negDelta = await api('PATCH', `/api/products/${idA}/stock`, {
        deltaStock: -20 // current is 10
      }, auth(adminToken));
      if (negDelta.status === 400 && (negDelta.data?.error?.toLowerCase().includes('negatif') || negDelta.data?.error?.includes('kurang dari 0'))) {
        PASS('PATCH /api/products/:id/stock rejects delta causing negative stock (400)');
      } else {
        FAIL('Negative delta allowed below 0', `status: ${negDelta.status}`);
      }

      // Valid delta adjustment (+5)
      const incRes = await api('PATCH', `/api/products/${idA}/stock`, {
        deltaStock: 5,
        variantId: varA1
      }, auth(adminToken));
      if (incRes.status === 200 && incRes.data?.stock === 15) {
        PASS('PATCH deltaStock +5 correctly updated product & variant stock to 15');
      } else {
        FAIL('deltaStock +5 failed', JSON.stringify(incRes.data));
      }

      // Reset back to 10 for checkout tests
      await api('PATCH', `/api/products/${idA}/stock`, {
        deltaStock: -5,
        variantId: varA1
      }, auth(adminToken));
    }

    // ── SECTION 4: CONCURRENCY & IDEMPOTENCY SAFETY ─────────────────────
    section('4. CONCURRENCY & IDEMPOTENCY SAFETY');
    {
      const idemKey = `IDEM-P63-${Date.now()}`;
      const checkoutPayload = {
        paymentMethod: 'Tunai',
        cashGiven: 500000,
        customerName: 'Pelanggan P63',
        cashierName: 'Gusti',
        items: [
          {
            productId: idA,
            variantId: varA1,
            selectedColor: 'Navy',
            selectedSize: 'XL',
            quantity: 2
          }
        ]
      };

      // Test A: Duplicate request with SAME Idempotency-Key (simulating double click)
      const [res1, res2] = await Promise.all([
        api('POST', '/api/transactions', checkoutPayload, {
          ...auth(cashierToken),
          'Idempotency-Key': idemKey
        }),
        api('POST', '/api/transactions', checkoutPayload, {
          ...auth(cashierToken),
          'Idempotency-Key': idemKey
        })
      ]);

      const inv1 = res1.data?.invoiceNumber || res1.data?.invoice_number;
      const inv2 = res2.data?.invoiceNumber || res2.data?.invoice_number;

      if ((res1.status === 201 || res1.status === 200) && (res2.status === 201 || res2.status === 200)) {
        if (inv1 && inv1 === inv2) {
          PASS('Concurrent requests with same Idempotency-Key returned identical invoice', inv1);
        } else {
          FAIL('Concurrent requests produced different invoices', `inv1: ${inv1}, inv2: ${inv2}`);
        }
      } else {
        FAIL('Idempotent concurrent requests failed', `s1: ${res1.status}, s2: ${res2.status}, d1: ${JSON.stringify(res1.data)}`);
      }

      // Verify stock was decremented ONLY ONCE (10 - 2 = 8, not 10 - 4 = 6)
      const chkProdA = await client.query('SELECT stock, variants FROM products WHERE id = $1', [idA]);
      const currentStockA = chkProdA.rows[0]?.stock;
      const varStockA = (typeof chkProdA.rows[0]?.variants === 'string' 
        ? JSON.parse(chkProdA.rows[0]?.variants) 
        : chkProdA.rows[0]?.variants)?.[0]?.stock;

      if (currentStockA === 8 && varStockA === 8) {
        PASS('Stock decremented exactly once after duplicate request (10 -> 8)');
      } else {
        FAIL('Stock mutated incorrectly after duplicate request', `stock: ${currentStockA}, var: ${varStockA}`);
      }

      // Test B: Race condition on Stock = 1 with DIFFERENT idempotency keys
      // Two concurrent checkouts requesting quantity = 1
      const racePayload = {
        paymentMethod: 'Tunai',
        cashGiven: 100000,
        customerName: 'Pelanggan Race',
        cashierName: 'Gusti',
        items: [
          {
            productId: idB,
            variantId: varB1,
            selectedColor: 'Putih',
            selectedSize: 'M',
            quantity: 1
          }
        ]
      };

      const [raceRes1, raceRes2] = await Promise.all([
        api('POST', '/api/transactions', racePayload, {
          ...auth(cashierToken),
          'Idempotency-Key': `RACE-1-${Date.now()}`
        }),
        api('POST', '/api/transactions', racePayload, {
          ...auth(cashierToken),
          'Idempotency-Key': `RACE-2-${Date.now()}`
        })
      ]);

      const statuses = [raceRes1.status, raceRes2.status].sort();
      // Expected: one 201, one 409 (insufficient stock)
      if (statuses[0] === 201 && statuses[1] === 409) {
        PASS('Race condition on stock=1 handled atomically: 1 SUCCESS (201), 1 REJECT (409)');
      } else {
        FAIL('Race condition did not yield 1 success & 1 conflict', `statuses: ${statuses.join(', ')}`);
      }

      // Verify stock of product B is exactly 0 and NOT -1
      const chkProdB = await client.query('SELECT stock, variants FROM products WHERE id = $1', [idB]);
      const currentStockB = chkProdB.rows[0]?.stock;
      const varStockB = (typeof chkProdB.rows[0]?.variants === 'string'
        ? JSON.parse(chkProdB.rows[0]?.variants)
        : chkProdB.rows[0]?.variants)?.[0]?.stock;

      if (currentStockB === 0 && varStockB === 0) {
        PASS('Product B final stock is exactly 0 (no negative stock)');
      } else {
        FAIL('Product B final stock corrupted', `stock: ${currentStockB}, var: ${varStockB}`);
      }
    }

    // ── SECTION 5: ATOMIC TRANSACTION ROLLBACK ──────────────────────────
    section('5. ATOMIC TRANSACTION ROLLBACK ON FAILURE');
    {
      // Current stock of Product A is 8.
      // Attempt checkout of 2 items: 1 valid (qty 2 of Prod A), 1 invalid (qty 99 of Prod B whose stock is 0).
      // The whole transaction must rollback; Prod A stock must remain 8!
      const failPayload = {
        paymentMethod: 'Tunai',
        cashGiven: 2000000,
        customerName: 'Pelanggan Fail',
        cashierName: 'Gusti',
        items: [
          {
            productId: idA,
            variantId: varA1,
            selectedColor: 'Navy',
            selectedSize: 'XL',
            quantity: 2
          },
          {
            productId: idB,
            variantId: varB1,
            selectedColor: 'Putih',
            selectedSize: 'M',
            quantity: 99 // Stock is 0 -> will trigger 409
          }
        ]
      };

      const failRes = await api('POST', '/api/transactions', failPayload, {
        ...auth(cashierToken),
        'Idempotency-Key': `FAIL-ROLLBACK-${Date.now()}`
      });

      if (failRes.status === 409) {
        PASS('Multi-item checkout with insufficient stock returned 409 (atomic abort)');
      } else {
        FAIL('Multi-item checkout did not return 409', `status: ${failRes.status}`);
      }

      // Check stock of Product A: MUST still be 8
      const rollA = await client.query('SELECT stock, variants FROM products WHERE id = $1', [idA]);
      const rollStockA = rollA.rows[0]?.stock;
      if (rollStockA === 8) {
        PASS('Rollback verified: Product A stock was untouched (remained 8)');
      } else {
        FAIL('Rollback failed: Product A stock was partially deducted', `stock: ${rollStockA}`);
      }
    }

    // ── SECTION 6: CANCEL TRANSACTION IDEMPOTENCY & STOCK RESTORATION ───
    section('6. CANCEL TRANSACTION IDEMPOTENCY & RESTORATION');
    {
      // Create a fresh transaction to cancel
      const cancelTxPayload = {
        paymentMethod: 'Tunai',
        cashGiven: 500000,
        customerName: 'Pelanggan Cancel',
        cashierName: 'Gusti',
        items: [
          {
            productId: idA,
            variantId: varA1,
            selectedColor: 'Navy',
            selectedSize: 'XL',
            quantity: 3 // stock is 8 -> will become 5
          }
        ]
      };

      const txRes = await api('POST', '/api/transactions', cancelTxPayload, {
        ...auth(cashierToken),
        'Idempotency-Key': `TX-FOR-CANCEL-${Date.now()}`
      });
      const txId = txRes.data?.id;

      // Stock should now be 5
      const sAfterSale = (await client.query('SELECT stock FROM products WHERE id = $1', [idA])).rows[0]?.stock;
      if (sAfterSale === 5) {
        PASS('Product A stock reduced from 8 to 5 for cancel test');
      } else {
        FAIL('Product A stock not 5 after sale', `stock: ${sAfterSale}`);
      }

      // First Cancel: should restore 3 stock -> 8
      const cancel1 = await api('PATCH', `/api/transactions/${txId}/cancel`, {
        reason: 'Salah input kasir'
      }, auth(adminToken));

      if (cancel1.status === 200) {
        PASS('First cancel request succeeded (200)');
      } else {
        FAIL('First cancel failed', `status: ${cancel1.status}, data: ${JSON.stringify(cancel1.data)}`);
      }

      const sAfterCancel1 = (await client.query('SELECT stock FROM products WHERE id = $1', [idA])).rows[0]?.stock;
      if (sAfterCancel1 === 8) {
        PASS('Stock restored exactly by +3 (5 -> 8)');
      } else {
        FAIL('Stock not restored correctly', `stock: ${sAfterCancel1}`);
      }

      // Second Cancel: MUST be rejected and MUST NOT restore stock again
      const cancel2 = await api('PATCH', `/api/transactions/${txId}/cancel`, {
        reason: 'Duplicate cancel click'
      }, auth(adminToken));

      if (cancel2.status === 400 && cancel2.data?.error?.includes('sudah dibatalkan')) {
        PASS('Second cancel rejected (400 Transaction already cancelled)');
      } else {
        FAIL('Second cancel was not rejected', `status: ${cancel2.status}, data: ${JSON.stringify(cancel2.data)}`);
      }

      const sAfterCancel2 = (await client.query('SELECT stock FROM products WHERE id = $1', [idA])).rows[0]?.stock;
      if (sAfterCancel2 === 8) {
        PASS('Cancel idempotency verified: stock remained 8 (no double-restoration)');
      } else {
        FAIL('Cancel idempotency violated: double-restoration occurred', `stock: ${sAfterCancel2}`);
      }
    }

    // ── SECTION 7: PRODUCT DELETION SAFETY ──────────────────────────────
    section('7. PRODUCT DELETION SAFETY & HISTORICAL TRANSACTIONS');
    {
      // Product A is referenced in transaction records. Deleting it MUST be blocked with 409
      const delProdARes = await api('DELETE', `/api/products/${idA}`, null, auth(adminToken));

      if (delProdARes.status === 409 && delProdARes.data?.code === 'PRODUCT_HAS_TRANSACTIONS') {
        PASS('DELETE /api/products/:id blocks deletion of product with historical transactions (409)');
      } else {
        FAIL('Product with historical transactions was not protected from deletion', `status: ${delProdARes.status}, data: ${JSON.stringify(delProdARes.data)}`);
      }

      // Product SOLO has never been in any transaction. Deletion should succeed
      const delSoloRes = await api('DELETE', `/api/products/${idSolo}`, null, auth(adminToken));
      if (delSoloRes.status === 200) {
        PASS('DELETE /api/products/:id permits deletion of unreferenced product (200)');
      } else {
        FAIL('Failed to delete unreferenced product', `status: ${delSoloRes.status}`);
      }
    }

    // ── SECTION 8: SCANNER MUTATION SAFETY ──────────────────────────────
    section('8. SCANNER MUTATION SAFETY');
    {
      // Verify mobile scanner endpoint only writes to pending_scans and does NOT mutate product stock
      const stockBeforeScan = (await client.query('SELECT stock FROM products WHERE id = $1', [idA])).rows[0]?.stock;

      const scanSession = 'SCN-P63-SESS-01';
      await api('POST', '/api/scanner/scan', {
        session_code: scanSession,
        barcode: 'BAR-P63-A'
      });

      // Submit duplicate scan event
      await api('POST', '/api/scanner/scan', {
        session_code: scanSession,
        barcode: 'BAR-P63-A'
      });

      const stockAfterScan = (await client.query('SELECT stock FROM products WHERE id = $1', [idA])).rows[0]?.stock;

      if (stockBeforeScan === stockAfterScan) {
        PASS('Scanner scan events do not directly mutate stock (stock remained unchanged)');
      } else {
        FAIL('Scanner scan mutated stock directly', `before: ${stockBeforeScan}, after: ${stockAfterScan}`);
      }

      // Clean up test pending scans
      await client.query('DELETE FROM pending_scans WHERE session_code = $1', [scanSession]);
    }

    // ── SECTION 9: DATABASE-WIDE DATA INTEGRITY AUDIT ───────────────────
    section('9. DATABASE-WIDE DATA INTEGRITY AUDIT');
    {
      // Check negative stock in products
      const negStockCheck = await client.query('SELECT id, name, stock FROM products WHERE stock < 0');
      if (negStockCheck.rows.length === 0) {
        PASS('No negative stock found in products table (0 violations)');
      } else {
        FAIL('Negative stock found in products table', JSON.stringify(negStockCheck.rows));
      }

      // Check negative stock in variants JSONB
      const negVariantCheck = await client.query(`
        SELECT p.id, p.name, v->>'id' as variant_id, (v->>'stock')::int as v_stock
        FROM products p, jsonb_array_elements(p.variants) as v
        WHERE (v->>'stock')::int < 0
      `);
      if (negVariantCheck.rows.length === 0) {
        PASS('No negative stock found in product variants (0 violations)');
      } else {
        FAIL('Negative variant stock found', JSON.stringify(negVariantCheck.rows));
      }

      // Check duplicate barcodes
      const dupBarcodeCheck = await client.query(`
        SELECT barcode, COUNT(*)
        FROM products
        WHERE barcode IS NOT NULL AND barcode != ''
        GROUP BY barcode
        HAVING COUNT(*) > 1
      `);
      if (dupBarcodeCheck.rows.length === 0) {
        PASS('No duplicate product barcodes (0 violations)');
      } else {
        FAIL('Duplicate barcodes found', JSON.stringify(dupBarcodeCheck.rows));
      }
    }

    // ── CLEANUP TEST DATA ───────────────────────────────────────────────
    // Clean up test products, transactions, and test users created during this test
    await client.query(`
      DELETE FROM transactions WHERE customer_name IN ('Pelanggan P63', 'Pelanggan Race', 'Pelanggan Cancel')
    `);
    await client.query(`
      DELETE FROM products WHERE id IN ($1, $2)
    `, [idA, idB]);
    await client.query(`
      DELETE FROM cashier_attendances WHERE id = 'ATT-P63-001' OR user_id IN ($1, $2)
    `, [TEST_CASHIER.id, TEST_ADMIN.id]);
    await client.query(`
      DELETE FROM users WHERE id IN ($1, $2)
    `, [TEST_CASHIER.id, TEST_ADMIN.id]);

  } finally {
    client.release();
    server.close();
    await pool.end();
  }

  // ── FINAL SUMMARY ───────────────────────────────────────────────────
  console.log('\n' + '█'.repeat(65));
  console.log('  TEST SUMMARY');
  console.log(`  Passed : ${passCount}`);
  console.log(`  Failed : ${failCount}`);
  if (failCount > 0) {
    console.log('  Failures:');
    failures.forEach((f) => console.log(`    - ${f}`));
  }
  console.log('█'.repeat(65));

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
