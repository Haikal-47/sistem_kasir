import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('--- RUNNING PHASE 2 DATABASE MIGRATION ---');

    // 1. Idempotency Keys Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key VARCHAR(255) PRIMARY KEY,
        transaction_id VARCHAR(64) NOT NULL,
        response_body JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Table idempotency_keys created / verified');

    // 2. Invoice Sequence
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
    `);
    console.log('✓ Sequence invoice_seq created / verified');

    // 3. User ID column on transactions
    await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
    `);
    console.log('✓ Column transactions.user_id verified');

    // 4. Customer columns on transactions
    await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
    `);
    console.log('✓ Columns transactions.customer_name / customer_phone verified');

    // 5. Index on idempotency_keys created_at
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON idempotency_keys (created_at);
    `);
    console.log('✓ Index idx_idempotency_created_at verified');

    console.log('--- PHASE 2 MIGRATION COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
