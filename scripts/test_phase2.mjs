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

const PORT = 3999;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Create server
const server = http.createServer(app);

const getJakartaDate = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`\n======================================================`);
  console.log(`  ARFA FASHION POS — PHASE 2 VERIFICATION TEST SUITE  `);
  console.log(`======================================================\n`);

  const client = await pool.connect();
  const testResults = [];

  try {
    // 0. Setup Test User and Attendance
    const adminUser = {
      id: 'USR-ADM-01',
      username: 'admin',
      name: 'Super Admin',
      role: 'super_admin'
    };
    const adminToken = createToken(adminUser);

    const cashierUser = {
      id: 'USR-KAS-01',
      username: 'gusti',
      name: 'Gusti',
      role: 'kasir'
    };
    const cashierToken = createToken(cashierUser);

    const today = getJakartaDate();
    // Ensure active attendance for cashier
    await client.query(`
      INSERT INTO cashier_attendances (id, user_id, cashier_name, date, status, opening_cash)
      VALUES ('ATT-TEST-01', 'USR-KAS-01', 'Gusti', $1, 'working', 500000)
      ON CONFLICT (user_id, date) DO UPDATE SET status = 'working'
    `, [today]);

    // Setup a dedicated test product to avoid disturbing production catalog
    await client.query(`
      INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, variants)
      VALUES ('PRD-TEST-P2', 'Produk Uji Phase 2', 'ARFA LAB', 'Testing', 50000.00, 30000.00, 20, '8999999999001', 'Pcs', '[]'::jsonb)
      ON CONFLICT (id) DO UPDATE SET price = 50000.00, stock = 20, variants = '[]'::jsonb
    `);

    // Setup a dedicated single-stock test product for concurrency
    await client.query(`
      INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, variants)
      VALUES ('PRD-TEST-CONCUR', 'Produk Rebutan Terakhir', 'ARFA LAB', 'Testing', 100000.00, 80000.00, 1, '8999999999002', 'Pcs', '[]'::jsonb)
      ON CONFLICT (id) DO UPDATE SET price = 100000.00, stock = 1, variants = '[]'::jsonb
    `);

    console.log('✓ Test fixtures and active attendance prepared.');

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Checkout Normal
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Running TEST 1: Checkout Normal ---');
    {
      const initialStockRes = await client.query('SELECT stock FROM products WHERE id = $1', ['PRD-TEST-P2']);
      const initialStock = initialStockRes.rows[0].stock;

      const res = await fetch(`${BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          items: [{ productId: 'PRD-TEST-P2', quantity: 2 }],
          paymentMethod: 'Tunai',
          cashGiven: 100000,
        })
      });

      const body = await res.json();
      const afterStockRes = await client.query('SELECT stock FROM products WHERE id = $1', ['PRD-TEST-P2']);
      const afterStock = afterStockRes.rows[0].stock;

      const passed = res.status === 201 && 
                     body.total === 100000 && 
                     body.changeAmount === 0 &&
                     body.invoiceNumber.startsWith('INV-') &&
                     afterStock === initialStock - 2;

      testResults.push({
        test: 'TEST 1: Checkout Normal',
        status: passed ? 'PASSED' : 'FAILED',
        detail: `Status: ${res.status}, Total: ${body.total}, Inv: ${body.invoiceNumber}, Stock: ${initialStock} -> ${afterStock}`
      });
      console.log(`[TEST 1] ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Quantity > Stock (Must Reject with 409, no stock change)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Running TEST 2: Quantity > Stock ---');
    {
      const initialStockRes = await client.query('SELECT stock FROM products WHERE id = $1', ['PRD-TEST-P2']);
      const currentStock = initialStockRes.rows[0].stock;

      const res = await fetch(`${BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          items: [{ productId: 'PRD-TEST-P2', quantity: currentStock + 50 }],
          paymentMethod: 'Tunai',
          cashGiven: 5000000,
        })
      });

      const body = await res.json();
      const afterStockRes = await client.query('SELECT stock FROM products WHERE id = $1', ['PRD-TEST-P2']);
      const afterStock = afterStockRes.rows[0].stock;

      const passed = res.status === 409 && 
                     afterStock === currentStock &&
                     body.error.toLowerCase().includes('stok tidak mencukupi');

      testResults.push({
        test: 'TEST 2: Quantity > Stock',
        status: passed ? 'PASSED' : 'FAILED',
        detail: `Status: ${res.status}, Error: "${body.error}", Stock: ${currentStock} -> ${afterStock}`
      });
      console.log(`[TEST 2] ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Double Submit with same Idempotency-Key
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Running TEST 3: Idempotency Protection ---');
    {
      const initialStockRes = await client.query('SELECT stock FROM products WHERE id = $1', ['PRD-TEST-P2']);
      const currentStock = initialStockRes.rows[0].stock;
      const testKey = `idemp-key-test-${Date.now()}`;

      // First Request
      const res1 = await fetch(`${BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
          'Idempotency-Key': testKey,
        },
        body: JSON.stringify({
          items: [{ productId: 'PRD-TEST-P2', quantity: 1 }],
          paymentMethod: 'Tunai',
          cashGiven: 50000,
        })
      });
      const body1 = await res1.json();

      // Second Request (Immediate duplicate submit with same key)
      const res2 = await fetch(`${BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
          'Idempotency-Key': testKey,
        },
        body: JSON.stringify({
          items: [{ productId: 'PRD-TEST-P2', quantity: 1 }],
          paymentMethod: 'Tunai',
          cashGiven: 50000,
        })
      });
      const body2 = await res2.json();

      const afterStockRes = await client.query('SELECT stock FROM products WHERE id = $1', ['PRD-TEST-P2']);
      const afterStock = afterStockRes.rows[0].stock;

      const passed = res1.status === 201 &&
                     (res2.status === 200 || res2.status === 201) &&
                     body1.id === body2.id &&
                     body1.invoiceNumber === body2.invoiceNumber &&
                     afterStock === currentStock - 1; // Stock only deducted ONCE!

      testResults.push({
        test: 'TEST 3: Idempotency / Double Submit',
        status: passed ? 'PASSED' : 'FAILED',
        detail: `Req1: ${res1.status}, Req2: ${res2.status}, Tx1: ${body1.id}, Tx2: ${body2.id}, Stock deducted: ${currentStock - afterStock} (expected: 1)`
      });
      console.log(`[TEST 3] ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Concurrent Checkout for the Last Available Stock
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Running TEST 4: Concurrent Checkout on Last Stock ---');
    {
      // Stock is currently 1 on PRD-TEST-CONCUR
      const [resA, resB] = await Promise.all([
        fetch(`${BASE_URL}/api/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cashierToken}`,
            'Idempotency-Key': `concur-a-${Date.now()}`
          },
          body: JSON.stringify({
            items: [{ productId: 'PRD-TEST-CONCUR', quantity: 1 }],
            paymentMethod: 'Tunai',
            cashGiven: 100000
          })
        }),
        fetch(`${BASE_URL}/api/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cashierToken}`,
            'Idempotency-Key': `concur-b-${Date.now()}`
          },
          body: JSON.stringify({
            items: [{ productId: 'PRD-TEST-CONCUR', quantity: 1 }],
            paymentMethod: 'Tunai',
            cashGiven: 100000
          })
        })
      ]);

      const statuses = [resA.status, resB.status];
      const afterStockRes = await client.query('SELECT stock FROM products WHERE id = $1', ['PRD-TEST-CONCUR']);
      const finalStock = afterStockRes.rows[0].stock;

      const has201 = statuses.includes(201);
      const has409 = statuses.includes(409);
      const passed = has201 && has409 && finalStock === 0;

      testResults.push({
        test: 'TEST 4: Concurrent Checkout Race Condition',
        status: passed ? 'PASSED' : 'FAILED',
        detail: `Statuses: [${statuses.join(', ')}], Final Stock: ${finalStock} (strictly 0, never negative)`
      });
      console.log(`[TEST 4] ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Frontend attempts to tamper with Price
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Running TEST 5: Price Tampering Defense ---');
    {
      const res = await fetch(`${BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          // Tampered price: claiming Rp 1 instead of DB price Rp 50,000
          items: [{ productId: 'PRD-TEST-P2', quantity: 2, price: 1, subtotal: 2 }],
          paymentMethod: 'Tunai',
          cashGiven: 100000,
        })
      });

      const body = await res.json();
      // Server must calculate 2 * 50,000 = 100,000
      const passed = res.status === 201 && body.total === 100000 && body.subtotal === 100000 && body.items[0].price === 50000;

      testResults.push({
        test: 'TEST 5: Price Tampering Defense',
        status: passed ? 'PASSED' : 'FAILED',
        detail: `Status: ${res.status}, Client sent price: 1, Server recorded price: ${body.items?.[0]?.price}, Total: ${body.total}`
      });
      console.log(`[TEST 5] ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Frontend attempts to tamper with Total/Subtotal
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Running TEST 6: Total Tampering Defense ---');
    {
      const res = await fetch(`${BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          items: [{ productId: 'PRD-TEST-P2', quantity: 1 }],
          subtotal: 100, // Tampered
          total: 100,    // Tampered
          paymentMethod: 'Tunai',
          cashGiven: 50000,
        })
      });

      const body = await res.json();
      // Server must calculate 1 * 50,000 = 50,000
      const passed = res.status === 201 && body.total === 50000 && body.subtotal === 50000;

      testResults.push({
        test: 'TEST 6: Total Tampering Defense',
        status: passed ? 'PASSED' : 'FAILED',
        detail: `Status: ${res.status}, Client sent total: 100, Server recorded total: ${body.total}`
      });
      console.log(`[TEST 6] ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Atomic Rollback on Mid-Checkout Error
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Running TEST 7: Atomic Rollback ---');
    {
      const initialStockRes = await client.query('SELECT stock FROM products WHERE id = $1', ['PRD-TEST-P2']);
      const currentStock = initialStockRes.rows[0].stock;

      // Cart contains valid product AND an invalid/non-existent product
      const res = await fetch(`${BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          items: [
            { productId: 'PRD-TEST-P2', quantity: 2 },
            { productId: 'PRD-NON-EXISTENT-XYZ', quantity: 1 }
          ],
          paymentMethod: 'Tunai',
          cashGiven: 200000
        })
      });

      const body = await res.json();
      const afterStockRes = await client.query('SELECT stock FROM products WHERE id = $1', ['PRD-TEST-P2']);
      const afterStock = afterStockRes.rows[0].stock;

      // Must be rolled back completely: stock for valid product must NOT decrease
      const passed = res.status === 404 && afterStock === currentStock;

      testResults.push({
        test: 'TEST 7: Atomic Rollback on Error',
        status: passed ? 'PASSED' : 'FAILED',
        detail: `Status: ${res.status}, Stock before: ${currentStock}, Stock after: ${afterStock} (Zero partial deduction)`
      });
      console.log(`[TEST 7] ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Response Contract for Frontend Checkout Flow
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Running TEST 8: Frontend Checkout Contract ---');
    {
      // When insufficient cash is given, returns 400 with clean error so frontend doesn't clear cart
      const res = await fetch(`${BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          items: [{ productId: 'PRD-TEST-P2', quantity: 1 }],
          paymentMethod: 'Tunai',
          cashGiven: 1000, // Insufficient cash (Total is 50,000)
        })
      });

      const body = await res.json();
      const passed = res.status === 400 && body.error && !body.id;

      testResults.push({
        test: 'TEST 8: Frontend Safe Flow / Insufficient Payment Error',
        status: passed ? 'PASSED' : 'FAILED',
        detail: `Status: ${res.status}, Error msg: "${body.error}"`
      });
      console.log(`[TEST 8] ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Invoice Generation Under High Concurrency
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Running TEST 9: Concurrency-Safe Invoice Generation ---');
    {
      // Run 5 rapid concurrent checkout requests
      const promises = Array.from({ length: 5 }).map((_, i) =>
        fetch(`${BASE_URL}/api/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cashierToken}`,
            'Idempotency-Key': `rapid-inv-${i}-${Date.now()}`
          },
          body: JSON.stringify({
            items: [{ productId: 'PRD-TEST-P2', quantity: 1 }],
            paymentMethod: 'Tunai',
            cashGiven: 50000
          })
        }).then(r => r.json())
      );

      const responses = await Promise.all(promises);
      const invoices = responses.map(r => r.invoiceNumber).filter(Boolean);
      const uniqueInvoices = new Set(invoices);

      const passed = invoices.length === 5 && uniqueInvoices.size === 5;

      testResults.push({
        test: 'TEST 9: Concurrency-Safe Unique Invoices',
        status: passed ? 'PASSED' : 'FAILED',
        detail: `Generated Invoices: [${invoices.join(', ')}], Unique count: ${uniqueInvoices.size}/5`
      });
      console.log(`[TEST 9] ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 10: Safe Error Handling (No SQL / Stack Leak)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Running TEST 10: Server Error / SQL Leak Defense ---');
    {
      // Malformed request with invalid types designed to cause internal errors if unhandled
      const res = await fetch(`${BASE_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          items: [{ productId: 'PRD-TEST-P2', quantity: -99 }],
          paymentMethod: 'NonExistentMethod!@#$',
        })
      });

      const body = await res.json();
      const bodyStr = JSON.stringify(body);
      const leaksSQL = /select|insert|update|delete|pg_|syntax error|at \/|at Object/i.test(bodyStr);

      const passed = (res.status === 400 || res.status === 500) && !leaksSQL;

      testResults.push({
        test: 'TEST 10: Server Error & SQL Leak Defense',
        status: passed ? 'PASSED' : 'FAILED',
        detail: `Status: ${res.status}, Body: ${bodyStr}, Leaks raw internals: ${leaksSQL}`
      });
      console.log(`[TEST 10] ${passed ? '✓ PASSED' : '✗ FAILED'}`);
    }

    // ─────────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────────
    console.log(`\n======================================================`);
    console.log(`                TEST RESULTS SUMMARY                  `);
    console.log(`======================================================\n`);
    for (const r of testResults) {
      console.log(`${r.status.padEnd(8)} | ${r.test.padEnd(45)} | ${r.detail}`);
    }

    const allPassed = testResults.every(r => r.status === 'PASSED');
    console.log(`\nOVERALL: ${allPassed ? 'ALL TESTS PASSED (10/10) ✓' : 'SOME TESTS FAILED ✗'}\n`);

  } catch (error) {
    console.error('Test suite runner crashed:', error);
  } finally {
    // Clean up test products
    try {
      await client.query("DELETE FROM transactions WHERE items::text LIKE '%PRD-TEST%'");
      await client.query("DELETE FROM products WHERE id IN ('PRD-TEST-P2', 'PRD-TEST-CONCUR')");
    } catch (_) {}
    client.release();
    await pool.end();
    server.close();
  }
}

runTests();
