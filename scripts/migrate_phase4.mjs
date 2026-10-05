import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running Phase 4.1 Schema Migration...');
    await client.query(`
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS total_transactions INT DEFAULT 0;
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS total_sales NUMERIC(15, 2) DEFAULT 0;
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS total_cash NUMERIC(15, 2) DEFAULT 0;
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS total_transfer NUMERIC(15, 2) DEFAULT 0;
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS total_qris NUMERIC(15, 2) DEFAULT 0;
      ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS closed_by VARCHAR(255);
    `);
    console.log('✅ Phase 4.1 Schema Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
