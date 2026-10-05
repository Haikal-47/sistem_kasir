/**
 * ARFA FASHION POS — PHASE 6.3 STOCK MUTATION & PRODUCT SAFETY MIGRATION
 *
 * Idempotent, safe, and non-destructive migration script.
 * Adds database-level invariant CHECK (stock >= 0) to ensure stock can never become negative.
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
    console.log('🔄 Running Phase 6.3 Stock Invariant & Safety Migration...\n');

    // 1. Verify all existing product stock is non-negative
    const negCheck = await client.query('SELECT id, name, stock FROM products WHERE stock < 0');
    if (negCheck.rows.length > 0) {
      throw new Error(`Cannot apply CHECK (stock >= 0) constraint: ${negCheck.rows.length} products have negative stock.`);
    }

    // 2. Add CHECK constraint if it does not exist
    const constraintCheck = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'products' AND constraint_name = 'chk_products_stock_non_negative'
    `);

    if (constraintCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE products ADD CONSTRAINT chk_products_stock_non_negative CHECK (stock >= 0);
      `);
      console.log('  ✔ Added CHECK constraint chk_products_stock_non_negative (stock >= 0) on products table');
    } else {
      console.log('  ✔ CHECK constraint chk_products_stock_non_negative (stock >= 0) already verified');
    }

    console.log('\n✅ Phase 6.3 Migration completed successfully (100% idempotent & non-destructive).\n');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run directly if called as a script
if (process.argv[1] && process.argv[1].endsWith('migrate_phase63.mjs')) {
  runMigration()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      pool.end().then(() => process.exit(1));
    });
}
