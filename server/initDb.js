import { pool } from './db.js';

export const initDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Menghubungkan ke Neon PostgreSQL & menyiapkan tabel...');

    // 1. Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price NUMERIC(15, 2) NOT NULL,
        cost_price NUMERIC(15, 2) DEFAULT 0,
        stock INT NOT NULL DEFAULT 0,
        barcode VARCHAR(100) UNIQUE NOT NULL,
        unit VARCHAR(50) DEFAULT 'Pcs',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Transactions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(64) PRIMARY KEY,
        invoice_number VARCHAR(100) UNIQUE NOT NULL,
        date TIMESTAMP WITH TIME ZONE NOT NULL,
        cashier_name VARCHAR(255) NOT NULL,
        items JSONB NOT NULL,
        subtotal NUMERIC(15, 2) NOT NULL,
        tax NUMERIC(15, 2) DEFAULT 0,
        discount NUMERIC(15, 2) DEFAULT 0,
        total NUMERIC(15, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        cash_given NUMERIC(15, 2),
        change_amount NUMERIC(15, 2),
        transfer_bank VARCHAR(255),
        transfer_proof_url TEXT,
        transfer_proof_verified BOOLEAN DEFAULT FALSE,
        transfer_confirmed_at TIMESTAMP WITH TIME ZONE,
        transfer_confirmed_by VARCHAR(255),
        customer_note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Cashier Profile Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cashier_profile (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        shift VARCHAR(100) NOT NULL,
        outlet_name VARCHAR(255) NOT NULL,
        outlet_address TEXT,
        outlet_phone VARCHAR(50),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Payment Methods Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        icon VARCHAR(20) DEFAULT '💳',
        color VARCHAR(20) DEFAULT 'sky',
        is_active BOOLEAN DEFAULT TRUE,
        is_default BOOLEAN DEFAULT FALSE,
        bank_name VARCHAR(100),
        account_number VARCHAR(100),
        account_holder VARCHAR(150),
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure columns exist if table was already created
    await client.query(`
      ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
      ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS account_number VARCHAR(100);
      ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS account_holder VARCHAR(150);
      ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS description TEXT;
    `);

    // 5. Scanner Sessions & Pending Scans (Wireless Scanner HP via DB Polling)
    await client.query(`
      CREATE TABLE IF NOT EXISTS scanner_sessions (
        session_code VARCHAR(50) PRIMARY KEY,
        last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        device_name VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS pending_scans (
        id SERIAL PRIMARY KEY,
        session_code VARCHAR(50) NOT NULL,
        barcode VARCHAR(100) NOT NULL,
        scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE,
        product_name VARCHAR(255),
        product_price NUMERIC(15, 2),
        success BOOLEAN
      );

      CREATE INDEX IF NOT EXISTS idx_pending_scans_session ON pending_scans (session_code, processed);
    `);

    // Seed payment methods if empty
    const pmCheck = await client.query(`SELECT COUNT(*) FROM payment_methods`);
    if (parseInt(pmCheck.rows[0].count, 10) === 0) {
      const defaultMethods = [
        ['PM-001', 'Tunai', 'TUNAI', '💵', 'emerald', true, true, '', '', '', 'Pembayaran tunai langsung di meja kasir'],
        ['PM-002', 'BCA Transfer', 'TRANSFER', '🏦', 'sky', true, false, 'Bank Central Asia (BCA)', '8820 4912 3901', 'ARFA FASHION', 'Verifikasi mutasi m-banking BCA otomatis / manual'],
        ['PM-003', 'BNI Transfer', 'TRANSFER', '🏦', 'orange', true, false, 'Bank Negara Indonesia (BNI)', '0391 2847 10', 'ARFA FASHION', 'Transfer via BNI Mobile Banking / ATM'],
        ['PM-004', 'BRI Transfer', 'TRANSFER', '🏦', 'blue', true, false, 'Bank Rakyat Indonesia (BRI)', '1029 0100 4819 501', 'ARFA FASHION', 'Transfer via aplikasi BRImo'],
        ['PM-005', 'Mandiri Livin', 'TRANSFER', '🏦', 'yellow', true, false, 'Bank Mandiri', '1370 0192 4819 2', 'ARFA FASHION', 'Transfer via Livin by Mandiri'],
        ['PM-006', 'QRIS Kasir', 'TRANSFER', '📱', 'rose', true, false, 'QRIS Multi-Payment', 'NMD-881920194', 'ARFA FASHION', 'Scan QRIS statis kasir dengan GoPay, OVO, ShopeePay, DANA'],
      ];
      for (const m of defaultMethods) {
        await client.query(`
          INSERT INTO payment_methods (id, name, type, icon, color, is_active, is_default, bank_name, account_number, account_holder, description)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING;
        `, m);
      }
      console.log('✅ Default payment methods berhasil di-seed');
    } else {
      // Update existing records with default details if they are empty
      await client.query(`
        UPDATE payment_methods SET bank_name = 'Bank Central Asia (BCA)', account_number = '8820 4912 3901', account_holder = 'ARFA FASHION', description = 'Verifikasi mutasi m-banking BCA' WHERE id = 'PM-002' AND (bank_name IS NULL OR bank_name = '');
        UPDATE payment_methods SET bank_name = 'Bank Negara Indonesia (BNI)', account_number = '0391 2847 10', account_holder = 'ARFA FASHION', description = 'Transfer via BNI Mobile Banking' WHERE id = 'PM-003' AND (bank_name IS NULL OR bank_name = '');
        UPDATE payment_methods SET bank_name = 'Bank Rakyat Indonesia (BRI)', account_number = '1029 0100 4819 501', account_holder = 'ARFA FASHION', description = 'Transfer via aplikasi BRImo' WHERE id = 'PM-004' AND (bank_name IS NULL OR bank_name = '');
        UPDATE payment_methods SET bank_name = 'Bank Mandiri', account_number = '1370 0192 4819 2', account_holder = 'ARFA FASHION', description = 'Transfer via Livin by Mandiri' WHERE id = 'PM-005' AND (bank_name IS NULL OR bank_name = '');
        UPDATE payment_methods SET bank_name = 'QRIS Multi-Payment', account_number = 'NMD-881920194', account_holder = 'ARFA FASHION', description = 'Scan QRIS dari semua e-wallet & m-banking' WHERE id = 'PM-006' AND (bank_name IS NULL OR bank_name = '');
      `);
    }

    // Seed cashier if not exists
    const cashierCheck = await client.query(`SELECT COUNT(*) FROM cashier_profile`);
    if (parseInt(cashierCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO cashier_profile (id, name, shift, outlet_name, outlet_address, outlet_phone)
        VALUES ('CSH-001', 'Gusti', 'Shift 1 (07:00 - 15:00)', 'ARFA FASHION', 'Jl. Merdeka Raya No. 45, Jakarta Pusat', '021-5550192');
      `);
      console.log('✅ Profil kasir awal berhasil di-seed');
    } else {
      await client.query(`
        UPDATE cashier_profile SET outlet_name = 'ARFA FASHION' WHERE outlet_name = 'MINIMARKET KASIR PRO';
        UPDATE cashier_profile SET name = 'Gusti' WHERE name = 'Budi Pratama';
        UPDATE transactions SET cashier_name = 'Gusti' WHERE cashier_name = 'Budi Pratama';
        UPDATE transactions SET transfer_confirmed_by = 'Gusti' WHERE transfer_confirmed_by = 'Budi Pratama';
      `);
    }

    // Check if products have old grocery items or need fashion migration
    const oldGroceryCheck = await client.query(`
      SELECT COUNT(*) FROM products WHERE name ILIKE '%Aqua%' OR category IN ('Minuman', 'Makanan Instan')
    `);
    const hasOldGrocery = parseInt(oldGroceryCheck.rows[0].count, 10) > 0;

    const productCheck = await client.query(`SELECT COUNT(*) FROM products`);
    if (parseInt(productCheck.rows[0].count, 10) === 0 || hasOldGrocery) {
      if (hasOldGrocery) {
        console.log('🔄 Memperbarui katalog dari produk minimarket ke produk fashion ARFA FASHION...');
        // Hapus transaksi lama yang mereferensikan produk minimarket
        await client.query(`DELETE FROM transactions WHERE items::text ILIKE '%Aqua%' OR items::text ILIKE '%Indomie%'`);
        // Hapus produk minimarket lama
        await client.query(`DELETE FROM products WHERE name ILIKE '%Aqua%' OR category IN ('Minuman', 'Makanan Instan', 'Susu & Olahan', 'Snack & Cokelat', 'Permen & Manisan', 'Kopi & Teh', 'Perawatan Tubuh')`);
      }

      const initialProducts = [
        ['PRD-001', 'Atasan Stripe Polo Kerah Jeans', 'BY.ELFARA', 'Atasan & Kemeja', 145000, 110000, 25, '8991001001014', 'Pcs'],
        ['PRD-002', 'Atasan Stripe Polo Kerah Jeans Polos', 'BY.ELFARA', 'Atasan & Kemeja', 139000, 105000, 30, '8991001001021', 'Pcs'],
        ['PRD-003', 'Cardigan Stripe Kerah Jeans', 'BY.ELFARA', 'Cardigan & Outer', 146000, 112000, 20, '8991001001038', 'Pcs'],
        ['PRD-004', 'Cardigan Polo Stripe', 'BY.ELFARA', 'Cardigan & Outer', 155000, 120000, 18, '8991001001045', 'Pcs'],
        ['PRD-005', 'Kemeja Linen Oversized Casual', 'ARFA FASHION', 'Atasan & Kemeja', 125000, 95000, 22, '8991001001052', 'Pcs'],
        ['PRD-006', 'Blouse Tunik Rayon Premium', 'ARFA FASHION', 'Atasan & Kemeja', 115000, 85000, 24, '8991001001069', 'Pcs'],
        ['PRD-007', 'Gamis Crinkle Airflow Premium', 'ARFA FASHION', 'Gamis & Dress', 175000, 130000, 16, '8991001001076', 'Pcs'],
        ['PRD-008', 'Midi Dress Floral Rayon Viscose', 'ARFA FASHION', 'Gamis & Dress', 135000, 100000, 4, '8991001001083', 'Pcs'],
        ['PRD-009', 'Kulot Highwaist Linen Premium', 'ARFA FASHION', 'Celana & Bawahan', 95000, 70000, 28, '8991001001090', 'Pcs'],
        ['PRD-010', 'Celana Baggy Jeans Boyfriend Denim', 'ARFA FASHION', 'Celana & Bawahan', 145000, 110000, 15, '8991001001106', 'Pcs'],
        ['PRD-011', 'Rok Plisket Flare Premium', 'ARFA FASHION', 'Celana & Bawahan', 75000, 55000, 3, '8991001001113', 'Pcs'],
        ['PRD-012', 'Jaket Denim Vintage Washed', 'ARFA FASHION', 'Cardigan & Outer', 185000, 140000, 12, '8991001001120', 'Pcs'],
        ['PRD-013', 'Pashmina Ceruty Baby Doll 180x75', 'ZAHRA HIJAB', 'Hijab & Kerudung', 35000, 24000, 50, '8991001001137', 'Pcs'],
        ['PRD-014', 'Hijab Segi Empat Voal Miracle Laser Cut', 'ZAHRA HIJAB', 'Hijab & Kerudung', 38000, 26000, 45, '8991001001144', 'Pcs'],
        ['PRD-015', 'Kaos Basic Cotton Combed 24s', 'ARFA FASHION', 'Atasan & Kemeja', 65000, 45000, 35, '8991001001151', 'Pcs']
      ];

      for (const p of initialProducts) {
        await client.query(`
          INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            brand = EXCLUDED.brand,
            category = EXCLUDED.category,
            price = EXCLUDED.price,
            cost_price = EXCLUDED.cost_price,
            stock = EXCLUDED.stock,
            barcode = EXCLUDED.barcode,
            unit = EXCLUDED.unit;
        `, p);
      }
      console.log('✅ Katalog produk fashion ARFA FASHION berhasil di-seed ke Neon DB');
    }

    // Seed transactions if empty
    const txCheck = await client.query(`SELECT COUNT(*) FROM transactions`);
    if (parseInt(txCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO transactions (
          id, invoice_number, date, cashier_name, items, subtotal, tax, discount, total, payment_method, status, cash_given, change_amount
        ) VALUES (
          'TRX-101', 'INV/20260919/0001', '2026-09-19T08:32:15', 'Gusti',
          '[{"productId":"PRD-001","name":"Atasan Stripe Polo Kerah Jeans","brand":"BY.ELFARA","price":145000,"quantity":2,"subtotal":290000},{"productId":"PRD-013","name":"Pashmina Ceruty Baby Doll 180x75","brand":"ZAHRA HIJAB","price":35000,"quantity":2,"subtotal":70000}]'::jsonb,
          360000, 0, 0, 360000, 'TUNAI', 'LUNAS', 400000, 40000
        );
      `);

      await client.query(`
        INSERT INTO transactions (
          id, invoice_number, date, cashier_name, items, subtotal, tax, discount, total, payment_method, status, transfer_bank, transfer_proof_url, transfer_proof_verified, transfer_confirmed_at, transfer_confirmed_by
        ) VALUES (
          'TRX-102', 'INV/20260919/0002', '2026-09-19T09:14:40', 'Gusti',
          '[{"productId":"PRD-003","name":"Cardigan Stripe Kerah Jeans","brand":"BY.ELFARA","price":146000,"quantity":2,"subtotal":292000},{"productId":"PRD-009","name":"Kulot Highwaist Linen Premium","brand":"ARFA FASHION","price":95000,"quantity":1,"subtotal":95000}]'::jsonb,
          387000, 0, 0, 387000, 'TRANSFER', 'LUNAS', 'BCA (Virtual Account)', 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80', true, '2026-09-19T09:16:00', 'Gusti'
        );
      `);

      await client.query(`
        INSERT INTO transactions (
          id, invoice_number, date, cashier_name, items, subtotal, tax, discount, total, payment_method, status, transfer_bank, transfer_proof_url, transfer_proof_verified, customer_note
        ) VALUES (
          'TRX-103', 'INV/20260919/0003', '2026-09-19T10:05:22', 'Gusti',
          '[{"productId":"PRD-007","name":"Gamis Crinkle Airflow Premium","brand":"ARFA FASHION","price":175000,"quantity":1,"subtotal":175000},{"productId":"PRD-014","name":"Hijab Segi Empat Voal Miracle Laser Cut","brand":"ZAHRA HIJAB","price":38000,"quantity":2,"subtotal":76000}]'::jsonb,
          251000, 0, 0, 251000, 'TRANSFER', 'MENUNGGU_KONFIRMASI', 'Mandiri Livin', 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&q=80', false, 'Pesanan Online / Reguler'
        );
      `);
      console.log('✅ Transaksi awal fashion berhasil di-seed ke Neon DB');
    }

    console.log('🎉 Neon PostgreSQL Database siap digunakan!');
  } catch (error) {
    console.error('❌ Gagal inisialisasi tabel di Neon PostgreSQL:', error);
    throw error;
  } finally {
    client.release();
  }
};
