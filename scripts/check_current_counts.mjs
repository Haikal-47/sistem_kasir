import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const tables = [
    'users', 'store_settings', 'payment_methods', 'cashier_profile',
    'products', 'transactions', 'cashier_attendances',
    'idempotency_keys', 'scanner_sessions', 'pending_scans'
  ];
  for (const t of tables) {
    const res = await pool.query(`SELECT count(*) FROM "${t}";`);
    console.log(`${t}: ${res.rows[0].count} rows`);
  }
  const seqs = await pool.query(`SELECT sequencename, last_value FROM pg_sequences;`);
  console.log('Sequences:', seqs.rows);
  await pool.end();
}

check().catch(console.error);
