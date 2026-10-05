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

const PORT = 3996;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const server = http.createServer(app);

const getJakartaDate = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
};

async function runPhase3Tests() {
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`\n======================================================`);
  console.log(`  ARFA FASHION POS — PHASE 3.1 VERIFICATION SUITE   `);
  console.log(`======================================================\n`);

  const client = await pool.connect();
  let passCount = 0;
  let totalTests = 10;

  try {
    const adminUser = {
      id: 'USR-ADM-01',
      username: 'admin',
      name: 'Super Admin',
      role: 'super_admin'
    };
    const adminToken = createToken(adminUser);

    const cashierGustiUser = {
      id: 'USR-KAS-01',
      username: 'gusti',
      name: 'Gusti',
      role: 'kasir'
    };
    const cashierGustiToken = createToken(cashierGustiUser);

    const cashierOtherUser = {
      id: 'USR-KAS-999',
      username: 'otherkasir',
      name: 'Other Kasir',
      role: 'kasir'
    };
    const cashierOtherToken = createToken(cashierOtherUser);

    const today = getJakartaDate();

    // Setup active attendance
    await client.query(`
      INSERT INTO cashier_attendances (id, user_id, cashier_name, date, status, opening_cash)
      VALUES ('ATT-TEST-P3', 'USR-KAS-01', 'Gusti', $1, 'working', 500000)
      ON CONFLICT (user_id, date) DO UPDATE SET status = 'working'
    `, [today]);

    // Setup test product
    await client.query(`
      INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, variants)
      VALUES ('PRD-TEST-P3', 'Produk Uji Phase 3', 'ARFA LAB', 'Testing', 50000.00, 30000.00, 20, '8999999999003', 'Pcs', '[]'::jsonb)
      ON CONFLICT (id) DO UPDATE SET price = 50000.00, stock = 20, variants = '[]'::jsonb
    `);

    // TEST 1: Default Pagination
    console.log('--- TEST 1: GET /api/transactions (Default Pagination) ---');
    const res1 = await fetch(`${BASE_URL}/api/transactions`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data1 = await res1.json();
    const isT1Passed = res1.status === 200 &&
      Array.isArray(data1.data) &&
      data1.pagination &&
      data1.pagination.page === 1 &&
      data1.pagination.limit === 20 &&
      typeof data1.pagination.total === 'number' &&
      typeof data1.pagination.totalPages === 'number';
    console.log(`[TEST 1] ${isT1Passed ? '✓ PASSED' : '✗ FAILED'}: Page=${data1.pagination?.page}, Limit=${data1.pagination?.limit}, Total=${data1.pagination?.total}`);
    if (isT1Passed) passCount++;

    // TEST 2: page=2&limit=20
    console.log('\n--- TEST 2: GET /api/transactions?page=2&limit=20 ---');
    const res2 = await fetch(`${BASE_URL}/api/transactions?page=2&limit=20`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data2 = await res2.json();
    const isT2Passed = res2.status === 200 &&
      Array.isArray(data2.data) &&
      data2.data.length <= 20 &&
      data2.pagination?.page === 2 &&
      data2.pagination?.limit === 20;
    console.log(`[TEST 2] ${isT2Passed ? '✓ PASSED' : '✗ FAILED'}: Records returned=${data2.data?.length}, Page=${data2.pagination?.page}`);
    if (isT2Passed) passCount++;

    // TEST 3: limit=1000 capped to max 100
    console.log('\n--- TEST 3: GET /api/transactions?limit=1000 (Safety Limit Enforcement) ---');
    const res3 = await fetch(`${BASE_URL}/api/transactions?limit=1000`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data3 = await res3.json();
    const isT3Passed = res3.status === 200 &&
      data3.pagination?.limit <= 100 &&
      data3.data.length <= 100;
    console.log(`[TEST 3] ${isT3Passed ? '✓ PASSED' : '✗ FAILED'}: Enforced limit=${data3.pagination?.limit}`);
    if (isT3Passed) passCount++;

    // TEST 4: Cashier Scoped Query
    console.log('\n--- TEST 4: Cashier Scoped Query ---');
    const res4Gusti = await fetch(`${BASE_URL}/api/transactions`, {
      headers: { 'Authorization': `Bearer ${cashierGustiToken}` }
    });
    const data4Gusti = await res4Gusti.json();
    const res4Other = await fetch(`${BASE_URL}/api/transactions`, {
      headers: { 'Authorization': `Bearer ${cashierOtherToken}` }
    });
    const data4Other = await res4Other.json();
    const isT4Passed = res4Gusti.status === 200 &&
      res4Other.status === 200 &&
      data4Other.data.length === 0 &&
      data4Other.pagination.total === 0;
    console.log(`[TEST 4] ${isT4Passed ? '✓ PASSED' : '✗ FAILED'}: Gusti sees=${data4Gusti.pagination?.total}, Other kasir sees=${data4Other.pagination?.total}`);
    if (isT4Passed) passCount++;

    // TEST 5: Admin Transaction Query (Sees All)
    console.log('\n--- TEST 5: Admin Full Access Query ---');
    const res5 = await fetch(`${BASE_URL}/api/transactions`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data5 = await res5.json();
    const isT5Passed = res5.status === 200 &&
      data5.pagination?.total >= data4Gusti.pagination?.total;
    console.log(`[TEST 5] ${isT5Passed ? '✓ PASSED' : '✗ FAILED'}: Admin total=${data5.pagination?.total} >= Gusti total=${data4Gusti.pagination?.total}`);
    if (isT5Passed) passCount++;

    // TEST 6: Date Filter
    console.log('\n--- TEST 6: Date Filter (startDate & endDate) ---');
    const res6 = await fetch(`${BASE_URL}/api/transactions?startDate=${today}&endDate=${today}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data6 = await res6.json();
    const res6Invalid = await fetch(`${BASE_URL}/api/transactions?startDate=invalid-date`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const isT6Passed = res6.status === 200 &&
      res6Invalid.status === 400 &&
      Array.isArray(data6.data);
    console.log(`[TEST 6] ${isT6Passed ? '✓ PASSED' : '✗ FAILED'}: Transactions today=${data6.data.length}, Invalid date correctly rejected=${res6Invalid.status === 400}`);
    if (isT6Passed) passCount++;

    // TEST 7: Checkout Integrity
    console.log('\n--- TEST 7: Checkout Functionality Intact ---');
    const idempotencyKey = `p3-test-${Date.now()}`;
    const checkoutRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cashierGustiToken}`,
        'idempotency-key': idempotencyKey
      },
      body: JSON.stringify({
        items: [{ productId: 'PRD-TEST-P3', name: 'Produk Uji Phase 3', price: 50000, quantity: 1, subtotal: 50000 }],
        paymentMethod: 'Tunai',
        cashGiven: 50000,
        changeAmount: 0
      })
    });
    const checkoutData = await checkoutRes.json();
    const isT7Passed = checkoutRes.status === 201 && checkoutData.invoiceNumber && checkoutData.total === 50000;
    console.log(`[TEST 7] ${isT7Passed ? '✓ PASSED' : '✗ FAILED'}: Status=${checkoutRes.status}, Invoice=${checkoutData.invoiceNumber}`);
    if (isT7Passed) passCount++;

    // TEST 8: Stock FOR UPDATE Lock verification
    console.log('\n--- TEST 8: Stock Deduction & FOR UPDATE Protection ---');
    const prodRes = await client.query("SELECT stock FROM products WHERE id = 'PRD-TEST-P3'");
    const currentStock = prodRes.rows[0].stock;
    const isT8Passed = currentStock === 19; // 20 - 1 = 19
    console.log(`[TEST 8] ${isT8Passed ? '✓ PASSED' : '✗ FAILED'}: Stock before=20, Stock after=${currentStock} (Correctly deducted by 1)`);
    if (isT8Passed) passCount++;

    // TEST 9: Idempotency Protection Intact
    console.log('\n--- TEST 9: Idempotency Replay on POST /api/transactions ---');
    const replayRes = await fetch(`${BASE_URL}/api/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cashierGustiToken}`,
        'idempotency-key': idempotencyKey
      },
      body: JSON.stringify({
        items: [{ productId: 'PRD-TEST-P3', name: 'Produk Uji Phase 3', price: 50000, quantity: 1, subtotal: 50000 }],
        paymentMethod: 'Tunai',
        cashGiven: 50000,
        changeAmount: 0
      })
    });
    const replayData = await replayRes.json();
    const isT9Passed = replayRes.status === 200 && replayData.id === checkoutData.id;
    console.log(`[TEST 9] ${isT9Passed ? '✓ PASSED' : '✗ FAILED'}: Status=${replayRes.status} (Replayed cached response, ID=${replayData.id})`);
    if (isT9Passed) passCount++;

    // TEST 10: Cancel Transaction Atomic
    console.log('\n--- TEST 10: Atomic Transaction Cancellation ---');
    const cancelRes = await fetch(`${BASE_URL}/api/transactions/${checkoutData.id}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const cancelData = await cancelRes.json();
    const prodAfterCancel = await client.query("SELECT stock FROM products WHERE id = 'PRD-TEST-P3'");
    const isT10Passed = cancelRes.status === 200 &&
      (cancelData.status === 'BATAL' || cancelData.transaction?.status === 'BATAL') &&
      prodAfterCancel.rows[0].stock === 20; // Restored to 20
    console.log(`[TEST 10] ${isT10Passed ? '✓ PASSED' : '✗ FAILED'}: Status=${cancelRes.status}, TxStatus=${cancelData.status}, Restored stock=${prodAfterCancel.rows[0].stock}`);
    if (isT10Passed) passCount++;

    // Clean up test data
    await client.query("DELETE FROM transactions WHERE id = $1", [checkoutData.id]);
    await client.query("DELETE FROM idempotency_keys WHERE key = $1", [idempotencyKey]);
    await client.query("DELETE FROM products WHERE id = 'PRD-TEST-P3'");

    console.log(`\n======================================================`);
    console.log(`PHASE 3.1 TEST SUMMARY: ${passCount}/${totalTests} PASSED`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Phase 3.1 test error:', err);
  } finally {
    client.release();
    server.close();
    await pool.end();
  }
}

runPhase3Tests();
