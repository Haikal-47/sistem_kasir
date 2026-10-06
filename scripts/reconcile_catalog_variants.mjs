/**
 * ARFA FASHION POS — CATALOG VARIANT STOCK RECONCILIATION
 *
 * Reconciles live catalog products PRD-007, PRD-008, PRD-010 where variant sums
 * differed from the header stock column due to legacy initial seeding.
 *
 * Established Invariant:
 * For products with variants, products.stock === SUM(variants[].stock).
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function reconcileCatalogVariants() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting Catalog Variant Stock Reconciliation...\n');
    await client.query('BEGIN');

    const targetIds = ['PRD-007', 'PRD-008', 'PRD-010'];
    const prodsRes = await client.query(
      `SELECT id, name, stock, variants FROM products WHERE id = ANY($1) FOR UPDATE`,
      [targetIds]
    );

    console.log('--- PRE-RECONCILIATION STATUS ---');
    for (const prod of prodsRes.rows) {
      const vars = typeof prod.variants === 'string' ? JSON.parse(prod.variants) : (prod.variants || []);
      const varSum = vars.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
      console.log(`Product ${prod.id} (${prod.name}): Header Stock = ${prod.stock}, Variant Sum = ${varSum}`);

      // Update header stock to match variant sum
      await client.query(
        `UPDATE products SET stock = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [varSum, prod.id]
      );
      console.log(`  ✔ Updated ${prod.id} products.stock: ${prod.stock} -> ${varSum}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Reconciliation transaction committed successfully.');

    // Verification check across all products
    console.log('\n--- VERIFYING ALL PRODUCTS IN CATALOG ---');
    const allRes = await client.query('SELECT id, name, stock, variants FROM products ORDER BY id ASC');
    let inconsistentCount = 0;
    for (const p of allRes.rows) {
      const vars = typeof p.variants === 'string' ? JSON.parse(p.variants) : (p.variants || []);
      if (vars.length > 0) {
        const sum = vars.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
        if (sum !== Number(p.stock)) {
          console.error(`  ❌ Mismatch still exists in ${p.id}: stock=${p.stock}, sum=${sum}`);
          inconsistentCount++;
        }
      }
    }

    if (inconsistentCount === 0) {
      console.log(`  ✔ 100% of products (${allRes.rows.length}/${allRes.rows.length}) adhere to invariant: stock === SUM(variants.stock)`);
    } else {
      throw new Error(`Inconsistency detected in ${inconsistentCount} products!`);
    }

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Reconciliation failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('reconcile_catalog_variants.mjs')) {
  reconcileCatalogVariants()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
