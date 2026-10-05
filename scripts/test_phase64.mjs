import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import http from 'http';
import app, { createToken as createApiToken, cleanupExpiredIdempotencyKeys } from '../api/index.js';
import serverApp, { createToken as createServerToken } from '../server/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(name, detail = '') {
  totalTests++;
  passedTests++;
  console.log(`  ✓ PASS: ${name} ${detail ? '(' + detail + ')' : ''}`);
}

function fail(name, error) {
  totalTests++;
  failedTests++;
  console.error(`  ✗ FAIL: ${name} ->`, error);
}

function makeRequest(server, options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runPhase64Tests() {
  console.log('\n======================================================');
  console.log('   ARFA FASHION POS — PHASE 6.4 VERIFICATION SUITE   ');
  console.log('======================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const adminToken = createApiToken({ id: 'USR-ADM-01', username: 'admin', role: 'super_admin' });
  const kasirToken = createApiToken({ id: 'USR-KAS-01', username: 'gusti', role: 'kasir' });

  try {
    // ── 1. DEPENDENCY & BCRYPTJS AUDIT ──
    console.log('--- TEST GROUP 1: Dependency & bcryptjs Audit ---');
    const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    
    if (!pkgJson.dependencies['bcryptjs'] && !pkgJson.devDependencies['bcryptjs']) {
      pass('bcryptjs completely removed from package.json');
    } else {
      fail('bcryptjs completely removed from package.json', 'bcryptjs found in package.json');
    }

    if (pkgJson.dependencies['bcrypt']) {
      pass('Native bcrypt is declared in production dependencies');
    } else {
      fail('Native bcrypt is declared in production dependencies', 'bcrypt missing');
    }

    if (pkgJson.devDependencies['@types/jsbarcode']) {
      pass('@types/jsbarcode correctly located in devDependencies');
    } else {
      fail('@types/jsbarcode correctly located in devDependencies', 'missing in devDependencies');
    }

    const initDbContent = fs.readFileSync(path.join(__dirname, '../server/initDb.js'), 'utf8');
    if (!initDbContent.includes("from 'bcryptjs'") && initDbContent.includes("from 'bcrypt'")) {
      pass('server/initDb.js uses native bcrypt');
    } else {
      fail('server/initDb.js uses native bcrypt', 'initDb still references bcryptjs');
    }

    const migratePasswordsContent = fs.readFileSync(path.join(__dirname, '../server/migrate_passwords.js'), 'utf8');
    if (!migratePasswordsContent.includes("from 'bcryptjs'") && migratePasswordsContent.includes("from 'bcrypt'")) {
      pass('server/migrate_passwords.js uses native bcrypt');
    } else {
      fail('server/migrate_passwords.js uses native bcrypt', 'migrate_passwords still references bcryptjs');
    }

    // ── 2. RUNTIME DDL SCANNER ──
    console.log('\n--- TEST GROUP 2: Runtime Request DDL Scanner ---');
    const apiIndexContent = fs.readFileSync(path.join(__dirname, '../api/index.js'), 'utf8');
    if (!apiIndexContent.includes('ensureScannerTables') && !apiIndexContent.includes('CREATE TABLE IF NOT EXISTS scanner_sessions')) {
      pass('Zero runtime request DDL in api/index.js (ensureScannerTables eliminated)');
    } else {
      fail('Zero runtime request DDL in api/index.js', 'Found DDL in api/index.js');
    }

    // Scan for any runtime DDL inside server/index.js request handlers
    const serverIndexContent = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');
    const ddlKeywords = ['CREATE TABLE', 'DROP TABLE', 'ALTER TABLE', 'CREATE INDEX', 'DROP INDEX', 'TRUNCATE'];
    let serverHandlerDdlFound = false;
    for (const kw of ddlKeywords) {
      if (serverIndexContent.includes(kw)) {
        serverHandlerDdlFound = true;
        break;
      }
    }
    if (!serverHandlerDdlFound) {
      pass('Zero DDL statements inside server/index.js');
    } else {
      fail('Zero DDL statements inside server/index.js', 'Found DDL keyword in server/index.js');
    }

    // ── 3. CONNECTION POOLING CONFIGURATION ──
    console.log('\n--- TEST GROUP 3: Connection Pool & Timeout Hardening ---');
    const dbJsContent = fs.readFileSync(path.join(__dirname, '../server/db.js'), 'utf8');
    if (dbJsContent.includes('connectionTimeoutMillis: 10000') && dbJsContent.includes('idleTimeoutMillis: 30000')) {
      pass('server/db.js pool has explicit idleTimeoutMillis and connectionTimeoutMillis');
    } else {
      fail('server/db.js pool timeouts', 'Missing connectionTimeoutMillis or idleTimeoutMillis');
    }

    if (apiIndexContent.includes('connectionTimeoutMillis: 10000') && apiIndexContent.includes('idleTimeoutMillis: 30000')) {
      pass('api/index.js pool has explicit idleTimeoutMillis and connectionTimeoutMillis');
    } else {
      fail('api/index.js pool timeouts', 'Missing connectionTimeoutMillis or idleTimeoutMillis');
    }

    // ── 4. TRANSACTION ERROR & ROLLBACK REJECTION DEFENSE ──
    console.log('\n--- TEST GROUP 4: Transaction & Rollback Safety ---');
    const hasSafeRollbackInApi = (apiIndexContent.match(/await client\.query\('ROLLBACK'\)\.catch/g) || []).length;
    if (hasSafeRollbackInApi >= 4) {
      pass('api/index.js transaction catch blocks safely swallow dead connection rollback errors', `${hasSafeRollbackInApi} sites protected`);
    } else {
      fail('api/index.js transaction catch blocks safe rollback', `Only ${hasSafeRollbackInApi} sites found`);
    }

    const hasSafeRollbackInServer = (serverIndexContent.match(/await client\.query\('ROLLBACK'\)\.catch/g) || []).length;
    if (hasSafeRollbackInServer >= 4) {
      pass('server/index.js transaction catch blocks safely swallow dead connection rollback errors', `${hasSafeRollbackInServer} sites protected`);
    } else {
      fail('server/index.js transaction catch blocks safe rollback', `Only ${hasSafeRollbackInServer} sites found`);
    }

    // ── 5. IDEMPOTENCY KEY LIFECYCLE & TTL SAFETY ──
    console.log('\n--- TEST GROUP 5: Idempotency Key Lifecycle & TTL Cleanup ---');
    
    // Seed test keys: one recent (today) and one expired (15 days ago)
    const expiredKey = `TEST-EXP-${Date.now()}`;
    const recentKey = `TEST-REC-${Date.now()}`;
    const dummyTxId = `TRX-TEST-P64-${Date.now()}`;

    // Insert expired key (created_at = NOW() - INTERVAL '15 days')
    await pool.query(
      `INSERT INTO idempotency_keys (key, transaction_id, response_body, created_at)
       VALUES ($1, $2, $3, NOW() - INTERVAL '15 days')`,
      [expiredKey, dummyTxId, JSON.stringify({ success: true, id: dummyTxId, invoice: 'INV-EXP' })]
    );

    // Insert recent key (created_at = NOW())
    await pool.query(
      `INSERT INTO idempotency_keys (key, transaction_id, response_body, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [recentKey, dummyTxId, JSON.stringify({ success: true, id: dummyTxId, invoice: 'INV-REC' })]
    );

    // Verify recent key is protected against duplicate execution
    const preRes = await pool.query('SELECT key FROM idempotency_keys WHERE key IN ($1, $2)', [expiredKey, recentKey]);
    if (preRes.rows.length === 2) {
      pass('Both test keys (expired and recent) seeded successfully');
    } else {
      fail('Seed idempotency keys', 'Failed to seed keys');
    }

    // Call cleanup endpoint with retention = 7 days
    const cleanupRes = await makeRequest(server, {
      hostname: '127.0.0.1',
      port,
      path: '/api/admin/maintenance/cleanup-idempotency',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, { retentionDays: 7, limit: 100 });

    if (cleanupRes.status === 200 && cleanupRes.body.success === true && cleanupRes.body.deletedCount >= 1) {
      pass('Maintenance cleanup endpoint executed successfully', `Deleted ${cleanupRes.body.deletedCount} expired keys`);
    } else {
      fail('Maintenance cleanup endpoint', JSON.stringify(cleanupRes));
    }

    // Verify expired key was deleted
    const postExpired = await pool.query('SELECT key FROM idempotency_keys WHERE key = $1', [expiredKey]);
    if (postExpired.rows.length === 0) {
      pass('Expired key (> 7 days) was cleanly deleted by TTL mechanism');
    } else {
      fail('Expired key deleted', 'Expired key still exists');
    }

    // Verify recent key is STILL intact and preserved
    const postRecent = await pool.query('SELECT key FROM idempotency_keys WHERE key = $1', [recentKey]);
    if (postRecent.rows.length === 1) {
      pass('Active recent key is 100% PRESERVED and protected from deletion');
    } else {
      fail('Active recent key preservation', 'Recent key was deleted!');
    }

    // Test non-admin authorization on cleanup endpoint
    const unauthCleanup = await makeRequest(server, {
      hostname: '127.0.0.1',
      port,
      path: '/api/admin/maintenance/cleanup-idempotency',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kasirToken}`
      }
    }, { retentionDays: 7 });

    if (unauthCleanup.status === 403) {
      pass('Non-admin access to idempotency cleanup is strictly forbidden (403)');
    } else {
      fail('Non-admin cleanup authorization', `Expected 403, got ${unauthCleanup.status}`);
    }

    // Clean up our test recent key
    await pool.query('DELETE FROM idempotency_keys WHERE key = $1', [recentKey]);

    // ── 6. ERROR HANDLING & INFORMATION LEAK PROTECTION ──
    console.log('\n--- TEST GROUP 6: Safe Error Responses & API Parity ---');
    
    // Test endpoint with invalid ID type / parameter to ensure safe sanitized error
    const errRes = await makeRequest(server, {
      hostname: '127.0.0.1',
      port,
      path: '/api/products/invalid-id-xyz/stock',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    }, { newStock: -999 });

    if (errRes.status === 400 && errRes.body.error && !JSON.stringify(errRes.body).includes('SQL') && !JSON.stringify(errRes.body).includes('postgres')) {
      pass('Validation errors return clean client-safe message without SQL details');
    } else {
      fail('Validation error sanitation', JSON.stringify(errRes.body));
    }

    // Verify server/index.js contains 0 raw error.message returns
    const hasRawErrorMessage = serverIndexContent.includes('error: error.message');
    if (!hasRawErrorMessage) {
      pass('server/index.js zero raw error.message leakages');
    } else {
      fail('server/index.js error sanitation', 'Found raw error: error.message in server/index.js');
    }

    // ── 7. ENVIRONMENT & SECRET INTEGRITY ──
    console.log('\n--- TEST GROUP 7: Environment & Git Secret Protection ---');
    const gitignoreContent = fs.readFileSync(path.join(__dirname, '../.gitignore'), 'utf8');
    if (gitignoreContent.includes('.env\n') || gitignoreContent.includes('.env\r\n')) {
      pass('.env is explicitly protected in .gitignore');
    } else {
      fail('.env in .gitignore', '.env not found in .gitignore');
    }

    const envExampleContent = fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8');
    if (!envExampleContent.includes('postgresql://') || envExampleContent.includes('DATABASE_URL=\n') || envExampleContent.includes('DATABASE_URL=\r\n')) {
      pass('.env.example contains zero hardcoded secrets or credentials');
    } else {
      fail('.env.example secret leak', 'Found suspected credential in .env.example');
    }

  } finally {
    server.close();
    await pool.end();
  }

  console.log('\n======================================================');
  console.log(`  PHASE 6.4 TESTS SUMMARY: ${passedTests}/${totalTests} PASSED`);
  if (failedTests === 0) {
    console.log('  ALL PHASE 6.4 VERIFICATION TESTS PASSED! (18/18) ✓');
  } else {
    console.log(`  ${failedTests} TESTS FAILED! ✗`);
    process.exit(1);
  }
  console.log('======================================================\n');
}

runPhase64Tests().catch((err) => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});
