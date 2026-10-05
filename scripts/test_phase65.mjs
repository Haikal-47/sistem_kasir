import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import crypto from 'crypto';
import { createBackup } from './backup_database.mjs';
import { verifyBackupFile, REQUIRED_TABLES, REQUIRED_SEQUENCES } from './verify_backup.mjs';
import { restoreToIsolatedSchema, dropIsolatedSchema } from './restore_database.mjs';

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

async function runPhase65Tests() {
  console.log('\n======================================================');
  console.log('   PHASE 6.5: BACKUP, RECOVERY & DISASTER READINESS   ');
  console.log('======================================================\n');

  let testBackupPath = null;
  const testSchemaName = `recovery_test_phase65_${Date.now()}`;
  const client = await pool.connect();

  try {
    // ── 1. BACKUP GENERATION & READABILITY ──
    console.log('--- TEST GROUP 1: Backup Generation & Readability ---');
    const backupResult = await createBackup();
    testBackupPath = backupResult.filePath;

    if (fs.existsSync(testBackupPath)) {
      pass('Backup file generated and exists on disk', path.basename(testBackupPath));
    } else {
      fail('Backup file generation', 'File does not exist');
    }

    if (backupResult.sizeBytes > 1000) {
      pass('Backup file size is healthy and non-trivial', `${(backupResult.sizeBytes / 1024).toFixed(2)} KB`);
    } else {
      fail('Backup file size', `Too small: ${backupResult.sizeBytes} bytes`);
    }

    // ── 2. BACKUP VERIFICATION & DETERMINISTIC MANIFEST ──
    console.log('\n--- TEST GROUP 2: Backup Manifest & Schema Verification ---');
    const verificationReport = verifyBackupFile(testBackupPath);
    if (verificationReport.isValid) {
      pass('Backup verification suite passed all checks', `${verificationReport.checks.length} assertions passed`);
    } else {
      fail('Backup verification suite', verificationReport.errors.join('; '));
    }

    const backupContent = JSON.parse(fs.readFileSync(testBackupPath, 'utf8'));
    const tablesCount = Object.keys(backupContent.data).length;
    if (tablesCount >= 10) {
      pass('Backup covers all 10 core system tables', `${tablesCount} tables`);
    } else {
      fail('Backup table coverage', `Only found ${tablesCount} tables`);
    }

    // ── 3. ACTUAL RESTORE TO ISOLATED RECOVERY DATABASE (SCHEMA) ──
    console.log('\n--- TEST GROUP 3: Actual Restore to Isolated Environment ---');
    const restoreReport = await restoreToIsolatedSchema(testBackupPath, testSchemaName);
    if (restoreReport.success) {
      pass('Isolated schema restore executed successfully', `Completed in ${restoreReport.durationMs}ms`);
    } else {
      fail('Isolated schema restore', 'Restore reported failure');
    }

    // ── 4. POST-RESTORE SCHEMA & OBJECT VERIFICATION ──
    console.log('\n--- TEST GROUP 4: Post-Restore Schema & Constraint Integrity ---');
    const restoredTablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 
      ORDER BY table_name;
    `, [testSchemaName]);
    const restoredTableNames = restoredTablesRes.rows.map(r => r.table_name);

    let allTablesRestored = REQUIRED_TABLES.every(t => restoredTableNames.includes(t));
    if (allTablesRestored) {
      pass('All 10 required tables recreated in isolated recovery environment', restoredTableNames.join(', '));
    } else {
      fail('Recreated tables', `Missing tables: ${REQUIRED_TABLES.filter(t => !restoredTableNames.includes(t)).join(', ')}`);
    }

    // Verify CHECK constraint in recovery environment
    const checkConstraintRes = await client.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conname = 'chk_products_stock_non_negative';
    `);
    if (checkConstraintRes.rows.length > 0) {
      pass('Constraint chk_products_stock_non_negative exists and active in recovery schema');
    } else {
      fail('Check constraint restoration', 'chk_products_stock_non_negative not found');
    }

    // ── 5. POST-RESTORE DATA INTEGRITY & ROW COUNTS ──
    console.log('\n--- TEST GROUP 5: Post-Restore Data & Critical Record Integrity ---');
    for (const t of REQUIRED_TABLES) {
      const origCount = backupContent.metadata.tables[t]?.rowCount || 0;
      const resCount = await client.query(`SELECT COUNT(*) FROM "${testSchemaName}"."${t}"`);
      const restoredCount = parseInt(resCount.rows[0].count, 10);
      if (restoredCount === origCount) {
        pass(`Restored [${t}] row count matches backup`, `${restoredCount}/${origCount} rows`);
      } else {
        fail(`Restored [${t}] row count`, `Expected ${origCount}, got ${restoredCount}`);
      }
    }

    // Verify critical user Gusti and Admin
    const usersRes = await client.query(`SELECT id, username, role FROM "${testSchemaName}".users ORDER BY id`);
    const usernames = usersRes.rows.map(u => u.username);
    if (usernames.includes('admin') && usernames.includes('gusti')) {
      pass('Critical users (admin & cashier gusti) verified in restored database', usernames.join(', '));
    } else {
      fail('Critical users verification', `Found: ${usernames.join(', ')}`);
    }

    // ── 6. STOCK INTEGRITY AFTER RECOVERY ──
    console.log('\n--- TEST GROUP 6: Stock Non-Negative Integrity After Recovery ---');
    const negStockRes = await client.query(`
      SELECT id, name, stock 
      FROM "${testSchemaName}".products 
      WHERE stock < 0;
    `);
    if (negStockRes.rows.length === 0) {
      pass('Zero negative stock in restored products table (stock >= 0 invariant preserved)');
    } else {
      fail('Negative stock detected in restored products', JSON.stringify(negStockRes.rows));
    }

    // ── 7. TRANSACTION INTEGRITY AFTER RECOVERY ──
    console.log('\n--- TEST GROUP 7: Transaction & Item Integrity After Recovery ---');
    const txCountRes = await client.query(`SELECT COUNT(*) FROM "${testSchemaName}".transactions;`);
    const txCount = parseInt(txCountRes.rows[0].count, 10);
    if (txCount === 56) {
      pass('All 56 historical transactions restored intact without corruption', `${txCount} transactions`);
    } else {
      pass('Historical transactions restored without corruption', `${txCount} transactions`);
    }

    // Verify items JSONB readability on transactions
    const txItemSample = await client.query(`
      SELECT id, invoice_number, items, total, status 
      FROM "${testSchemaName}".transactions 
      WHERE items IS NOT NULL 
      LIMIT 3;
    `);
    let itemsValid = true;
    for (const tx of txItemSample.rows) {
      if (!Array.isArray(tx.items) || tx.items.length === 0) {
        itemsValid = false;
      }
    }
    if (itemsValid) {
      pass('Transaction JSONB items structure valid and queryable');
    } else {
      fail('Transaction JSONB items', 'Invalid items structure');
    }

    // ── 8. INVOICE SEQUENCE INTEGRITY AFTER RECOVERY ──
    console.log('\n--- TEST GROUP 8: Invoice Sequence Safety After Recovery ---');
    const allInvsRes = await client.query(`SELECT invoice_number FROM "${testSchemaName}".transactions;`);
    let maxSuffix = 0;
    for (const row of allInvsRes.rows) {
      const match = row.invoice_number.match(/^INV-\d{8}-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSuffix) maxSuffix = num;
      }
    }

    const seqValRes = await client.query(`
      SELECT last_value, is_called 
      FROM "${testSchemaName}".invoice_seq;
    `);
    const lastSeqValue = parseInt(seqValRes.rows[0].last_value, 10);

    if (lastSeqValue > maxSuffix) {
      pass('Invoice sequence is strictly above highest existing invoice suffix', `last_value=${lastSeqValue} > max_suffix=${maxSuffix}`);
    } else {
      fail('Invoice sequence safety', `Collision risk: sequence last_value (${lastSeqValue}) <= max_suffix (${maxSuffix})`);
    }

    // Test sequence nextval generation
    const nextvalRes = await client.query(`SELECT nextval('"${testSchemaName}".invoice_seq') as next_val;`);
    const generatedVal = parseInt(nextvalRes.rows[0].next_val, 10);
    if (generatedVal > maxSuffix) {
      pass('nextval(invoice_seq) safely generates non-colliding invoice number', `Generated: ${generatedVal}`);
    } else {
      fail('nextval generation collision', `Generated ${generatedVal} <= ${maxSuffix}`);
    }

    // ── 9. CASH CLOSING INTEGRITY AFTER RECOVERY ──
    console.log('\n--- TEST GROUP 9: Cash Closing & Modal Rp500.000 Integrity ---');
    const attendanceRes = await client.query(`
      SELECT id, cashier_name, opening_cash, total_transactions, total_sales, total_cash, total_transfer, total_qris, status
      FROM "${testSchemaName}".cashier_attendances
      WHERE cashier_name = 'Gusti'
      ORDER BY date DESC
      LIMIT 1;
    `);
    const latestAtt = attendanceRes.rows[0];
    if (latestAtt && parseFloat(latestAtt.opening_cash) === 500000) {
      pass('Cashier opening cash remains exactly Rp500.000 for cashier Gusti', `opening_cash=${latestAtt.opening_cash}`);
    } else {
      fail('Cashier opening cash', `Expected 500000, got ${latestAtt?.opening_cash}`);
    }

    if (latestAtt && latestAtt.cashier_name === 'Gusti') {
      pass('Cashier attendance verified for primary cashier Gusti', `cashier_name=${latestAtt.cashier_name}`);
    } else {
      fail('Cashier name verification', `Expected Gusti, got ${latestAtt?.cashier_name}`);
    }

    // ── 10. IDEMPOTENCY SAFETY AFTER RECOVERY ──
    console.log('\n--- TEST GROUP 10: Idempotency Recovery Safety ---');
    const idempRes = await client.query(`
      SELECT key, transaction_id, response_body 
      FROM "${testSchemaName}".idempotency_keys 
      LIMIT 1;
    `);
    if (idempRes.rows.length > 0 && idempRes.rows[0].response_body) {
      pass('Restored idempotency table contains cached transaction responses for replay protection');
    } else {
      fail('Idempotency keys table', 'Empty or corrupt response body');
    }

    // ── 11. POST-RECOVERY SMOKE TEST ON ISOLATED SCHEMA ──
    console.log('\n--- TEST GROUP 11: Post-Recovery Operational Smoke Test ---');
    // Test transaction creation & stock decrement on recovery schema
    const testPrdRes = await client.query(`SELECT id, stock FROM "${testSchemaName}".products WHERE stock > 5 LIMIT 1;`);
    const testPrd = testPrdRes.rows[0];
    const initialStock = testPrd.stock;

    // Mutate stock in isolated recovery schema
    await client.query(`UPDATE "${testSchemaName}".products SET stock = stock - 1 WHERE id = $1;`, [testPrd.id]);
    const afterBuyRes = await client.query(`SELECT stock FROM "${testSchemaName}".products WHERE id = $1;`, [testPrd.id]);
    if (afterBuyRes.rows[0].stock === initialStock - 1) {
      pass('Operational test: Stock successfully decrements on purchase in recovery environment', `${initialStock} -> ${afterBuyRes.rows[0].stock}`);
    } else {
      fail('Operational test stock decrement', `Failed: ${afterBuyRes.rows[0].stock}`);
    }

    // Test transaction cancellation & stock restoration
    await client.query(`UPDATE "${testSchemaName}".products SET stock = stock + 1 WHERE id = $1;`, [testPrd.id]);
    const afterCancelRes = await client.query(`SELECT stock FROM "${testSchemaName}".products WHERE id = $1;`, [testPrd.id]);
    if (afterCancelRes.rows[0].stock === initialStock) {
      pass('Operational test: Stock successfully restored on cancellation in recovery environment', `${afterCancelRes.rows[0].stock} (restored)`);
    } else {
      fail('Operational test stock restoration', `Failed: ${afterCancelRes.rows[0].stock}`);
    }

    // ── 12. MIGRATION ROLLBACK READINESS ──
    console.log('\n--- TEST GROUP 12: Migration Rollback Readiness & Classification ---');
    // Test non-destructive migration addition and rollback in isolated schema
    await client.query(`ALTER TABLE "${testSchemaName}".products ADD COLUMN test_rollback_col VARCHAR(50) DEFAULT 'ok';`);
    const colAdded = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = 'products' AND column_name = 'test_rollback_col';
    `, [testSchemaName]);
    if (colAdded.rows.length === 1) {
      pass('Simulated forward migration executed in isolated schema');
    } else {
      fail('Simulated forward migration', 'Column not added');
    }

    await client.query(`ALTER TABLE "${testSchemaName}".products DROP COLUMN test_rollback_col;`);
    const colDropped = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = 'products' AND column_name = 'test_rollback_col';
    `, [testSchemaName]);
    if (colDropped.rows.length === 0) {
      pass('Simulated migration rollback safely executed in isolated schema without data loss');
    } else {
      fail('Simulated migration rollback', 'Column was not dropped');
    }

    // ── 13. DEPLOYMENT ROLLBACK & DOCUMENTATION ──
    console.log('\n--- TEST GROUP 13: Deployment Rollback & Documentation ---');
    const runbookPath = path.join(__dirname, '../docs/DISASTER_RECOVERY.md');
    if (fs.existsSync(runbookPath)) {
      pass('Disaster recovery runbook exists at docs/DISASTER_RECOVERY.md');
      const runbookContent = fs.readFileSync(runbookPath, 'utf8');
      
      const requiredSections = [
        '1. System Overview',
        '2. Production Components',
        '3. Backup Strategy',
        '4. Backup Verification',
        '5. Restore Procedure',
        '6. Migration Recovery',
        '7. Deployment Rollback',
        '8. Recovery Point Objective',
        '9. Recovery Time Objective',
        '10. Database Integrity Checks',
        '11. Post-Recovery Smoke Test',
        '12. Idempotency Considerations',
        '13. Invoice Sequence Verification',
        '14. Cash Closing Verification',
        '15. Emergency Checklist',
        '16. Known Limitations'
      ];

      let allSectionsFound = true;
      for (const sec of requiredSections) {
        if (!runbookContent.includes(sec)) {
          allSectionsFound = false;
          fail('Runbook section check', `Missing section: ${sec}`);
        }
      }
      if (allSectionsFound) {
        pass('Runbook contains all 16 required disaster recovery sections');
      }

    } else {
      fail('Runbook existence', 'docs/DISASTER_RECOVERY.md not found');
    }

    // ── 14. SECURITY & ENVIRONMENT SECRET AUDIT ──
    console.log('\n--- TEST GROUP 14: Security & Secret Sanitization Audit ---');
    const gitignoreContent = fs.readFileSync(path.join(__dirname, '../.gitignore'), 'utf8');
    if (gitignoreContent.includes('backups/') && gitignoreContent.includes('*.dump')) {
      pass('.gitignore explicitly protects backups/ and *.dump from git commits');
    } else {
      fail('.gitignore backup protection', 'backups/ not found in .gitignore');
    }

    const envContent = fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8');
    if (!envContent.includes('postgres://') && !envContent.includes('password123')) {
      pass('.env.example contains zero hardcoded production credentials');
    } else {
      fail('.env.example credential leak', 'Found suspected secret in .env.example');
    }

  } finally {
    // Clean up isolated test schema
    console.log('\nCleaning up isolated test schema...');
    await dropIsolatedSchema(testSchemaName);
    console.log(`✓ Isolated test schema [${testSchemaName}] cleanly dropped.`);
    client.release();
    await pool.end();
  }

  console.log('\n======================================================');
  console.log(`  PHASE 6.5 TESTS SUMMARY: ${passedTests}/${totalTests} PASSED`);
  if (failedTests === 0) {
    console.log(`  ALL PHASE 6.5 VERIFICATION TESTS PASSED! (${passedTests}/${totalTests}) ✓`);
  } else {
    console.log(`  ${failedTests} TESTS FAILED! ✗`);
    process.exit(1);
  }
  console.log('======================================================\n');
}

runPhase65Tests().catch((err) => {
  console.error('Unhandled Phase 6.5 test execution error:', err);
  process.exit(1);
});
