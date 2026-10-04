import pg from 'pg';
import dotenv from 'dotenv';
import http from 'http';
import app, { createToken } from '../api/index.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PORT = 3998;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const server = http.createServer(app);

async function testOwnership() {
  await new Promise(resolve => server.listen(PORT, resolve));
  const client = await pool.connect();
  try {
    console.log('\n--- VERIFYING TRANSACTION OWNERSHIP (BAGIAN 11) ---');

    const adminToken = createToken({
      id: 'USR-ADM-01',
      username: 'admin',
      name: 'Super Admin',
      role: 'super_admin'
    });

    const cashierGustiToken = createToken({
      id: 'USR-KAS-01',
      username: 'gusti',
      name: 'Gusti',
      role: 'kasir'
    });

    const cashierOtherToken = createToken({
      id: 'USR-KAS-99',
      username: 'otherkasir',
      name: 'Other Kasir',
      role: 'kasir'
    });

    // 1. Admin fetches transactions
    const adminRes = await fetch(`${BASE_URL}/api/transactions`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminTxs = await adminRes.json();
    console.log(`Admin sees: ${adminTxs.length} transactions`);

    // 2. Cashier Gusti fetches transactions
    const gustiRes = await fetch(`${BASE_URL}/api/transactions`, {
      headers: { 'Authorization': `Bearer ${cashierGustiToken}` }
    });
    const gustiTxs = await gustiRes.json();
    console.log(`Gusti sees: ${gustiTxs.length} transactions`);

    // 3. New Cashier with no transactions fetches transactions
    const otherRes = await fetch(`${BASE_URL}/api/transactions`, {
      headers: { 'Authorization': `Bearer ${cashierOtherToken}` }
    });
    const otherTxs = await otherRes.json();
    console.log(`Other Kasir sees: ${otherTxs.length} transactions`);

    const passed = Array.isArray(adminTxs) && 
                   Array.isArray(gustiTxs) && 
                   Array.isArray(otherTxs) &&
                   otherTxs.length === 0 &&
                   adminTxs.length >= gustiTxs.length;

    console.log(`Ownership Verification: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  } catch (err) {
    console.error('Ownership test failed:', err);
  } finally {
    client.release();
    await pool.end();
    server.close();
  }
}

testOwnership();
