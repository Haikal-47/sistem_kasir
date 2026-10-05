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
    console.log('--- RUNNING PHASE 3.1 DATABASE OPTIMIZATION MIGRATION ---');

    // 1. Transactions indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
    `);
    console.log('✓ Index idx_transactions_date verified');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    `);
    console.log('✓ Index idx_transactions_user_id verified');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    `);
    console.log('✓ Index idx_transactions_status verified');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_att_status ON transactions(attendance_id, status);
    `);
    console.log('✓ Composite index idx_transactions_att_status verified');

    // 2. Attendance indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attendances_status ON cashier_attendances(status);
    `);
    console.log('✓ Index idx_attendances_status verified');

    // 3. Products indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    `);
    console.log('✓ Index idx_products_category verified');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
    `);
    console.log('✓ Index idx_products_created_at verified');

    console.log('--- PHASE 3.1 DATABASE MIGRATION COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
