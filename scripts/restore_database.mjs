import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';
import { TABLE_DEPENDENCY_ORDER } from './backup_database.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

export async function restoreToIsolatedSchema(backupFilePath, schemaName = null, options = {}) {
  const connectionString = options.connectionString || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found at ${backupFilePath}`);
  }

  const backupContent = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
  const targetSchema = schemaName || `recovery_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  const report = {
    targetSchema,
    startTime: new Date().toISOString(),
    restoredTables: {},
    restoredSequences: {},
    success: false,
    durationMs: 0
  };

  const startTime = Date.now();

  try {
    // 1. Create Isolated Schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}";`);

    // 2. Create Sequences inside the isolated schema
    for (const [seqName, seqData] of Object.entries(backupContent.metadata.sequences || {})) {
      await client.query(`CREATE SEQUENCE IF NOT EXISTS "${targetSchema}"."${seqName}" START WITH 1;`);
      await client.query(`SELECT setval('"${targetSchema}"."${seqName}"', $1, $2);`, [
        seqData.last_value,
        seqData.is_called
      ]);
      report.restoredSequences[seqName] = seqData;
    }

    // 3. Create Tables inside isolated schema with all constraints and indices
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${targetSchema}".users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'kasir',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "${targetSchema}".store_settings (
        id VARCHAR(64) PRIMARY KEY,
        store_name VARCHAR(255) NOT NULL,
        store_address TEXT,
        store_phone VARCHAR(50),
        min_stock_alert INT DEFAULT 5,
        receipt_footer TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "${targetSchema}".cashier_profile (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        shift VARCHAR(100) NOT NULL,
        outlet_name VARCHAR(255) NOT NULL,
        outlet_address TEXT,
        outlet_phone VARCHAR(50),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "${targetSchema}".payment_methods (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        icon VARCHAR(20) DEFAULT '💳',
        color VARCHAR(20) DEFAULT 'sky',
        is_active BOOLEAN DEFAULT TRUE,
        is_default BOOLEAN DEFAULT FALSE,
        bank_name VARCHAR(100),
        account_number VARCHAR(100),
        account_holder VARCHAR(150),
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "${targetSchema}".products (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price NUMERIC(15, 2) NOT NULL,
        cost_price NUMERIC(15, 2) DEFAULT 0,
        stock INT NOT NULL DEFAULT 0,
        barcode VARCHAR(100) UNIQUE NOT NULL,
        unit VARCHAR(50) DEFAULT 'Pcs',
        colors JSONB DEFAULT '[]'::jsonb,
        sizes JSONB DEFAULT '[]'::jsonb,
        variants JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_products_stock_non_negative CHECK (stock >= 0)
      );

      CREATE TABLE IF NOT EXISTS "${targetSchema}".cashier_attendances (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES "${targetSchema}".users(id),
        cashier_name VARCHAR(255),
        date DATE NOT NULL,
        check_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        check_out TIMESTAMP WITH TIME ZONE,
        opening_cash NUMERIC(15, 2) NOT NULL DEFAULT 500000,
        expected_cash NUMERIC(15, 2),
        actual_cash NUMERIC(15, 2),
        cash_difference NUMERIC(15, 2),
        total_transactions INT DEFAULT 0,
        total_sales NUMERIC(15, 2) DEFAULT 0,
        total_cash NUMERIC(15, 2) DEFAULT 0,
        total_transfer NUMERIC(15, 2) DEFAULT 0,
        total_qris NUMERIC(15, 2) DEFAULT 0,
        closed_by VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'working',
        note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_date UNIQUE(user_id, date)
      );

      CREATE TABLE IF NOT EXISTS "${targetSchema}".transactions (
        id VARCHAR(64) PRIMARY KEY,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        date TIMESTAMP WITH TIME ZONE NOT NULL,
        cashier_name VARCHAR(255) NOT NULL,
        items JSONB NOT NULL,
        subtotal NUMERIC(15, 2) NOT NULL,
        tax NUMERIC(15, 2) DEFAULT 0,
        discount NUMERIC(15, 2) DEFAULT 0,
        total NUMERIC(15, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        cash_given NUMERIC(15, 2),
        change_amount NUMERIC(15, 2),
        transfer_bank VARCHAR(255),
        transfer_proof_url TEXT,
        transfer_proof_verified BOOLEAN DEFAULT FALSE,
        transfer_confirmed_at TIMESTAMP WITH TIME ZONE,
        transfer_confirmed_by VARCHAR(255),
        customer_note TEXT,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        attendance_id VARCHAR(64),
        user_id VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "${targetSchema}".idempotency_keys (
        key VARCHAR(255) PRIMARY KEY,
        transaction_id VARCHAR(64) NOT NULL,
        response_body JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "${targetSchema}".scanner_sessions (
        session_code VARCHAR(50) PRIMARY KEY,
        last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        device_name VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS "${targetSchema}".pending_scans (
        id SERIAL PRIMARY KEY,
        session_code VARCHAR(50) NOT NULL,
        barcode VARCHAR(100) NOT NULL,
        scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE,
        product_name VARCHAR(255),
        product_price NUMERIC(15, 2),
        success BOOLEAN
      );
    `);

    // 4. Restore rows into tables in dependency order
    for (const tableName of TABLE_DEPENDENCY_ORDER) {
      const tableBackup = backupContent.data[tableName];
      if (!tableBackup || !tableBackup.rows || tableBackup.rows.length === 0) {
        report.restoredTables[tableName] = { rowCount: 0 };
        continue;
      }

      const rows = tableBackup.rows;
      const columns = Object.keys(rows[0]);

      for (const row of rows) {
        const colNames = columns.map(c => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(c => {
          const val = row[c];
          // Serialize JSON objects/arrays if column is JSONB/JSON
          if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });

        const insertSql = `
          INSERT INTO "${targetSchema}"."${tableName}" (${colNames})
          VALUES (${placeholders})
          ON CONFLICT DO NOTHING;
        `;
        await client.query(insertSql, values);
      }

      const countRes = await client.query(`SELECT COUNT(*) FROM "${targetSchema}"."${tableName}"`);
      report.restoredTables[tableName] = {
        rowCount: parseInt(countRes.rows[0].count, 10),
        expectedCount: rows.length
      };
    }

    report.durationMs = Date.now() - startTime;
    report.success = true;
    return report;

  } finally {
    client.release();
    await pool.end();
  }
}

export async function dropIsolatedSchema(schemaName, options = {}) {
  const connectionString = options.connectionString || process.env.DATABASE_URL;
  if (!connectionString) return;

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
  } finally {
    client.release();
    await pool.end();
  }
}

// CLI usage
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const backupDir = path.join(__dirname, '../backups');
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup-') && f.endsWith('.json')).sort().reverse();
  if (files.length === 0) {
    console.error('No backup files found');
    process.exit(1);
  }
  const targetFile = path.join(backupDir, files[0]);
  const schemaName = `recovery_test_${Date.now()}`;
  console.log(`Starting isolated restore test to schema [${schemaName}] from: ${files[0]}`);

  restoreToIsolatedSchema(targetFile, schemaName)
    .then(async (report) => {
      console.log(`✓ Restore to schema [${schemaName}] completed in ${report.durationMs}ms`);
      console.log('Restored tables:');
      for (const [tbl, data] of Object.entries(report.restoredTables)) {
        console.log(`  - ${tbl}: ${data.rowCount}/${data.expectedCount} rows`);
      }
      console.log('\nCleaning up test schema...');
      await dropIsolatedSchema(schemaName);
      console.log(`✓ Isolated test schema [${schemaName}] cleanly dropped.`);
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('✗ Restore failed:', err);
      try {
        await dropIsolatedSchema(schemaName);
      } catch {}
      process.exit(1);
    });
}
