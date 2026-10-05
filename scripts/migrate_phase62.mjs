/**
 * ARFA FASHION POS — PHASE 6.2 SCHEMA CONSISTENCY & MIGRATION HARDENING
 * 
 * Idempotent, safe, and non-destructive migration script.
 * Validates and ensures that all columns and indexes used by production API
 * exist in PostgreSQL without altering or deleting existing data.
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running Phase 6.2 Schema Consistency Migration...\n');

    // 1. Transactions table columns
    await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS attendance_id VARCHAR(64);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
    `);
    console.log('  ✔ Verified transactions columns: user_id, attendance_id, customer_name, customer_phone');

    // 2. Transactions indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_attendance ON transactions(attendance_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_transactions_att_status ON transactions(attendance_id, status);
      CREATE INDEX IF NOT EXISTS idx_transactions_status_date ON transactions(status, date DESC);
    `);
    console.log('  ✔ Verified transactions indexes: attendance, date, user_id, status, composite');

    // 3. Cashier Attendances table columns (Phase 4.1 snapshot & closing fields)
    await client.query(`
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS cashier_name VARCHAR(255);
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS total_transactions INT DEFAULT 0;
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS total_sales NUMERIC(15, 2) DEFAULT 0;
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS total_cash NUMERIC(15, 2) DEFAULT 0;
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS total_transfer NUMERIC(15, 2) DEFAULT 0;
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS total_qris NUMERIC(15, 2) DEFAULT 0;
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS closed_by VARCHAR(255);
    `);
    console.log('  ✔ Verified cashier_attendances snapshot fields: total_transactions, total_sales, total_cash, total_transfer, total_qris, closed_by');

    // 4. Cashier Attendances indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attendances_date ON cashier_attendances(date);
      CREATE INDEX IF NOT EXISTS idx_attendances_user ON cashier_attendances(user_id);
      CREATE INDEX IF NOT EXISTS idx_attendances_status ON cashier_attendances(status);
    `);
    console.log('  ✔ Verified cashier_attendances indexes: date, user_id, status');

    // 5. Idempotency Keys table & index
    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key VARCHAR(255) PRIMARY KEY,
        transaction_id VARCHAR(64) NOT NULL,
        response_body JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON idempotency_keys (created_at);
    `);
    console.log('  ✔ Verified idempotency_keys table & idx_idempotency_created_at index');

    // 6. Invoice sequence
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
    `);
    console.log('  ✔ Verified invoice_seq sequence');

    // 7. Products indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
      CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
    `);
    console.log('  ✔ Verified products indexes: category, created_at');

    // 8. Payment methods columns
    await client.query(`
      ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
      ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS account_number VARCHAR(100);
      ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS account_holder VARCHAR(150);
      ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS description TEXT;
    `);
    console.log('  ✔ Verified payment_methods columns: bank_name, account_number, account_holder, description');

    console.log('\n✅ Phase 6.2 Migration completed successfully (100% idempotent & non-destructive).\n');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run directly if called as a script
if (process.argv[1] && process.argv[1].endsWith('migrate_phase62.mjs')) {
  runMigration()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end().then(() => process.exit(1));
    });
}
