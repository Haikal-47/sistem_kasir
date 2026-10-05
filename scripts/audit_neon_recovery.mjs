import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('=== NEON POSTGRESQL RECOVERY SCOPE AUDIT ===\n');

    // 1. Connection & Server Info
    const dbInfo = await client.query(`
      SELECT 
        current_database() as db_name,
        current_user as user_name,
        session_user,
        version() as pg_version;
    `);
    console.log('Database Name:', dbInfo.rows[0].db_name);
    console.log('Database User:', dbInfo.rows[0].user_name);
    console.log('PG Version:', dbInfo.rows[0].pg_version);

    // 2. Tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('\n--- PUBLIC TABLES (' + tablesRes.rows.length + ') ---');
    for (const row of tablesRes.rows) {
      const countRes = await client.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
      console.log(`  - ${row.table_name}: ${countRes.rows[0].count} rows`);
    }

    // 3. Sequences
    const seqsRes = await client.query(`
      SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
      ORDER BY sequence_name;
    `);
    console.log('\n--- SEQUENCES (' + seqsRes.rows.length + ') ---');
    for (const seq of seqsRes.rows) {
      let lastVal = 'N/A';
      try {
        const valRes = await client.query(`SELECT last_value, is_called FROM "${seq.sequence_name}"`);
        lastVal = `last_value=${valRes.rows[0].last_value}, is_called=${valRes.rows[0].is_called}`;
      } catch (err) {
        lastVal = `Error reading: ${err.message}`;
      }
      console.log(`  - ${seq.sequence_name}: ${lastVal}`);
    }

    // 4. Constraints (PK, FK, CHECK, UNIQUE)
    const constraintsRes = await client.query(`
      SELECT 
        tc.table_name, 
        tc.constraint_name, 
        tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
    `);
    console.log('\n--- CONSTRAINTS (' + constraintsRes.rows.length + ') ---');
    const grouped = {};
    for (const c of constraintsRes.rows) {
      grouped[c.table_name] = grouped[c.table_name] || [];
      grouped[c.table_name].push(`${c.constraint_type}: ${c.constraint_name}`);
    }
    for (const [tbl, list] of Object.entries(grouped)) {
      console.log(`  Table [${tbl}]:`);
      for (const item of list) {
        console.log(`    * ${item}`);
      }
    }

    // 5. Check Highest Invoice Number vs invoice_seq
    console.log('\n--- INVOICE SEQUENCE AUDIT ---');
    const invRes = await client.query(`
      SELECT invoice_number 
      FROM transactions 
      WHERE invoice_number ~ '^INV-[0-9]+'
      ORDER BY invoice_number DESC 
      LIMIT 5;
    `);
    console.log('Top invoice numbers:', invRes.rows.map(r => r.invoice_number));

    // 6. Check Stock Non-negative Integrity
    console.log('\n--- STOCK NON-NEGATIVE AUDIT ---');
    const negStock = await client.query(`SELECT id, name, stock FROM products WHERE stock < 0;`);
    console.log('Negative stock count:', negStock.rows.length);

    // 7. Check User Permissions for Schema Isolation
    console.log('\n--- PERMISSIONS & ISOLATION CAPABILITY ---');
    const permRes = await client.query(`
      SELECT 
        has_database_privilege(current_user, current_database(), 'CREATE') as can_create_schema,
        has_database_privilege(current_user, current_database(), 'CONNECT') as can_connect;
    `);
    console.log('Can create schemas/objects in DB:', permRes.rows[0].can_create_schema);
    console.log('Can connect to DB:', permRes.rows[0].can_connect);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
