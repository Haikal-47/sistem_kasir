import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

export const TABLE_DEPENDENCY_ORDER = [
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

export async function createBackup(customOptions = {}) {
  const connectionString = customOptions.connectionString || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    const startedAt = new Date();
    const timestampStr = startedAt.toISOString().replace(/[:.]/g, '-');
    const backupDir = customOptions.outputDir || path.join(__dirname, '../backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 1. Database Info
    const dbInfoRes = await client.query(`
      SELECT 
        current_database() as db_name,
        current_user as user_name,
        version() as pg_version;
    `);
    const dbInfo = dbInfoRes.rows[0];

    // 2. Fetch Sequence States
    const seqsRes = await client.query(`
      SELECT sequence_name
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
      ORDER BY sequence_name;
    `);

    const sequences = {};
    for (const row of seqsRes.rows) {
      const seqName = row.sequence_name;
      const valRes = await client.query(`SELECT last_value, is_called FROM "${seqName}"`);
      sequences[seqName] = {
        last_value: parseInt(valRes.rows[0].last_value, 10),
        is_called: valRes.rows[0].is_called
      };
    }

    // 3. Fetch Table Data & Compute Deterministic Hashes
    const tablesData = {};
    const tableManifest = {};

    for (const tableName of TABLE_DEPENDENCY_ORDER) {
      // Check if table exists
      const existsRes = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        );
      `, [tableName]);

      if (!existsRes.rows[0].exists) {
        continue;
      }

      // Fetch columns
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      // Fetch all rows deterministically ordered
      let primaryKey = 'id';
      if (tableName === 'idempotency_keys') primaryKey = 'key';
      if (tableName === 'scanner_sessions') primaryKey = 'session_code';

      const rowsRes = await client.query(`
        SELECT * FROM "${tableName}" ORDER BY "${primaryKey}" ASC;
      `);

      const rows = rowsRes.rows;
      const deterministicJson = JSON.stringify(rows);
      const sha256 = crypto.createHash('sha256').update(deterministicJson).digest('hex');

      tablesData[tableName] = {
        columns: colRes.rows,
        rowCount: rows.length,
        sha256,
        rows
      };

      tableManifest[tableName] = {
        rowCount: rows.length,
        sha256
      };
    }

    const backupPayload = {
      format: 'arfa-pos-logical-backup-v1',
      metadata: {
        createdAt: startedAt.toISOString(),
        database: dbInfo.db_name,
        pgVersion: dbInfo.pg_version,
        schema: 'public',
        tableCount: Object.keys(tablesData).length,
        tables: tableManifest,
        sequences
      },
      data: tablesData
    };

    const fileName = `backup-${timestampStr}.json`;
    const filePath = path.join(backupDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), 'utf8');

    const fileStats = fs.statSync(filePath);

    return {
      success: true,
      filePath,
      fileName,
      sizeBytes: fileStats.size,
      metadata: backupPayload.metadata
    };

  } finally {
    client.release();
    await pool.end();
  }
}

// Allow CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log('Initiating ARFA FASHION database backup...');
  createBackup()
    .then((result) => {
      console.log('✓ Backup successfully created!');
      console.log('  File:', result.filePath);
      console.log('  Size:', (result.sizeBytes / 1024).toFixed(2), 'KB');
      console.log('  Tables:', result.metadata.tableCount);
      console.log('  Sequences:', Object.keys(result.metadata.sequences).join(', '));
      process.exit(0);
    })
    .catch((err) => {
      console.error('✗ Backup failed:', err.message);
      process.exit(1);
    });
}
