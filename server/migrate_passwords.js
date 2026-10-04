import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function migratePasswords() {
  const client = await pool.connect();
  try {
    console.log('🔄 Checking existing users for plaintext passwords...');
    const res = await client.query('SELECT id, username, password FROM users');
    
    let migratedCount = 0;
    for (const user of res.rows) {
      const isHashed = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
      if (!isHashed) {
        console.log(`Migrating password for user: ${user.username} (${user.id})`);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(user.password, salt);
        await client.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
          hashedPassword,
          user.id
        ]);
        migratedCount++;
      } else {
        console.log(`User ${user.username} is already hashed.`);
      }
    }
    console.log(`✅ Password migration finished. ${migratedCount} user(s) migrated to bcrypt hash.`);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migratePasswords();
