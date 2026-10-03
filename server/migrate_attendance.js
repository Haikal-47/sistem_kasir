import { pool } from './db.js';

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE cashier_attendances ADD COLUMN IF NOT EXISTS cashier_name VARCHAR(255)`);
    console.log('✅ cashier_name column ensured in cashier_attendances');

    // Verify the table
    const r = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cashier_attendances' ORDER BY ordinal_position`);
    console.log('cashier_attendances columns:', r.rows.map(x => x.column_name).join(', '));
    
    // Also check if cashier_attendances exists
    const tbl = await client.query(`SELECT COUNT(*) FROM cashier_attendances`);
    console.log('cashier_attendances row count:', tbl.rows[0].count);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

run();
