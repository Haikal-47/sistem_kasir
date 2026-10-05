import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REQUIRED_TABLES = [
  'users',
  'store_settings',
  'cashier_profile',
  'payment_methods',
  'products',
  'cashier_attendances',
  'transactions',
  'idempotency_keys',
  'scanner_sessions',
  'pending_scans'
];

export const REQUIRED_SEQUENCES = [
  'invoice_seq',
  'pending_scans_id_seq'
];

export function verifyBackupFile(filePath) {
  const report = {
    checks: [],
    errors: [],
    isValid: false
  };

  function addCheck(name, passed, detail = '') {
    report.checks.push({ name, passed, detail });
    if (!passed) {
      report.errors.push(`${name}: ${detail}`);
    }
  }

  // 1. Existence Check
  if (!fs.existsSync(filePath)) {
    addCheck('File existence', false, `File not found at ${filePath}`);
    return report;
  }
  addCheck('File existence', true, `Found at ${filePath}`);

  // 2. File Size Check
  const stats = fs.statSync(filePath);
  if (stats.size < 1000) {
    addCheck('File size reasonable', false, `File size too small: ${stats.size} bytes`);
    return report;
  }
  addCheck('File size reasonable', true, `${(stats.size / 1024).toFixed(2)} KB`);

  // 3. Readability & JSON parsing
  let backupData;
  try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    backupData = JSON.parse(rawContent);
    addCheck('File readability & valid JSON', true, 'Parsed successfully');
  } catch (err) {
    addCheck('File readability & valid JSON', false, err.message);
    return report;
  }

  // 4. Metadata verification
  if (!backupData.metadata || !backupData.metadata.createdAt) {
    addCheck('Metadata presence', false, 'Missing metadata or createdAt');
  } else {
    const parsedDate = new Date(backupData.metadata.createdAt);
    const validDate = !isNaN(parsedDate.getTime());
    addCheck('Metadata timestamp valid', validDate, `Timestamp: ${backupData.metadata.createdAt}`);
  }

  // 5. Schema / Tables presence
  const tablesInData = Object.keys(backupData.data || {});
  let allTablesPresent = true;
  for (const t of REQUIRED_TABLES) {
    if (!tablesInData.includes(t)) {
      allTablesPresent = false;
      addCheck(`Table [${t}] present`, false, 'Table missing from backup');
    }
  }
  if (allTablesPresent) {
    addCheck('All 10 required tables present', true, `${tablesInData.length} tables found`);
  }

  // 6. Sequences presence & valid state
  const seqsInMetadata = Object.keys(backupData.metadata.sequences || {});
  let allSeqsPresent = true;
  for (const s of REQUIRED_SEQUENCES) {
    if (!seqsInMetadata.includes(s)) {
      allSeqsPresent = false;
      addCheck(`Sequence [${s}] present`, false, 'Sequence missing');
    } else {
      const seqObj = backupData.metadata.sequences[s];
      if (typeof seqObj.last_value !== 'number' || seqObj.last_value <= 0) {
        addCheck(`Sequence [${s}] state valid`, false, `Invalid state: ${JSON.stringify(seqObj)}`);
      }
    }
  }
  if (allSeqsPresent) {
    addCheck('All required sequences present and initialized', true, seqsInMetadata.join(', '));
  }

  // 7. Data integrity & Row Counts & SHA-256 verification
  for (const tbl of REQUIRED_TABLES) {
    const tblObj = backupData.data[tbl];
    if (!tblObj) continue;

    // Check row count in manifest vs data
    const manifestInfo = backupData.metadata.tables[tbl];
    if (!manifestInfo || manifestInfo.rowCount !== tblObj.rows.length) {
      addCheck(`Table [${tbl}] row count matches manifest`, false, `Manifest: ${manifestInfo?.rowCount}, Actual: ${tblObj.rows.length}`);
    }

    // Verify deterministic sha256 checksum
    const computedSha = crypto.createHash('sha256').update(JSON.stringify(tblObj.rows)).digest('hex');
    if (computedSha !== tblObj.sha256 || computedSha !== manifestInfo?.sha256) {
      addCheck(`Table [${tbl}] SHA-256 hash match`, false, `Manifest hash mismatch!`);
    }
  }
  addCheck('All tables data checksums (SHA-256) match manifests', report.errors.length === 0, 'Verified');

  // 8. Critical data business sanity checks
  const users = backupData.data.users?.rows || [];
  const products = backupData.data.products?.rows || [];
  const transactions = backupData.data.transactions?.rows || [];
  const attendances = backupData.data.cashier_attendances?.rows || [];
  const settings = backupData.data.store_settings?.rows || [];
  const paymentMethods = backupData.data.payment_methods?.rows || [];

  addCheck('Critical data: users non-empty', users.length > 0, `${users.length} users`);
  addCheck('Critical data: products non-empty', products.length > 0, `${products.length} products`);
  addCheck('Critical data: transactions non-empty', transactions.length > 0, `${transactions.length} transactions`);
  addCheck('Critical data: attendances non-empty', attendances.length > 0, `${attendances.length} attendances`);
  addCheck('Critical data: store settings configured', settings.length > 0, `Store: ${settings[0]?.store_name || 'N/A'}`);
  addCheck('Critical data: payment methods configured', paymentMethods.length > 0, `${paymentMethods.length} methods`);

  report.isValid = report.errors.length === 0;
  return report;
}

// CLI usage
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    console.error('No backups directory found');
    process.exit(1);
  }
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup-') && f.endsWith('.json')).sort().reverse();
  if (files.length === 0) {
    console.error('No backup files found in', backupDir);
    process.exit(1);
  }
  const targetFile = path.join(backupDir, files[0]);
  console.log(`Verifying latest backup: ${files[0]}`);
  const result = verifyBackupFile(targetFile);

  console.log('\n--- VERIFICATION CHECKS ---');
  for (const c of result.checks) {
    console.log(`  ${c.passed ? '✓ PASS' : '✗ FAIL'}: ${c.name} ${c.detail ? '(' + c.detail + ')' : ''}`);
  }

  if (result.isValid) {
    console.log('\n✓ BACKUP VERIFICATION: ALL CHECKS PASSED');
    process.exit(0);
  } else {
    console.log('\n✗ BACKUP VERIFICATION FAILED:');
    result.errors.forEach(e => console.error('  -', e));
    process.exit(1);
  }
}
