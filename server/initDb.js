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
        colors JSONB DEFAULT '[]'::jsonb,
        sizes JSONB DEFAULT '[]'::jsonb,
        variants JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE products ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

      -- Users Table (Role-based Authentication)
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'kasir',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Store Settings Table
      CREATE TABLE IF NOT EXISTS store_settings (
        id VARCHAR(64) PRIMARY KEY,
        store_name VARCHAR(255) NOT NULL,
        store_address TEXT,
        store_phone VARCHAR(50),
        min_stock_alert INT DEFAULT 5,
        receipt_footer TEXT,
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

    // Seed users table if empty
    const userCheck = await client.query(`SELECT COUNT(*) FROM users`);
    if (parseInt(userCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO users (id, username, password, name, role, is_active)
        VALUES 
          ('USR-ADM-01', 'admin', 'admin123', 'Super Admin', 'super_admin', TRUE),
          ('USR-KAS-01', 'gusti', '123456', 'Gusti', 'kasir', TRUE)
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('✅ Akun pengguna Admin & Kasir berhasil di-seed');
    }

    // Seed store_settings if empty
    const settingsCheck = await client.query(`SELECT COUNT(*) FROM store_settings`);
    if (parseInt(settingsCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO store_settings (id, store_name, store_address, store_phone, min_stock_alert, receipt_footer)
        VALUES ('SET-001', 'ARFA FASHION', 'Jl. Merdeka Raya No. 45, Jakarta Pusat', '021-5550192', 5, 'Terima kasih telah berbelanja di ARFA FASHION! Barang yang sudah dibeli dapat ditukar maksimal 3 hari.')
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('✅ Pengaturan toko berhasil di-seed');
    }

    // Helper to generate variants per product
    const buildVariants = (productId, colors, sizes, totalStock) => {
      const combos = [];
      for (const c of colors) {
        for (const s of sizes) {
          combos.push({ color: c, size: s });
        }
      }
      if (combos.length === 0) return [];
      const perVar = Math.max(1, Math.floor(totalStock / combos.length));
      let currentAlloc = 0;
      return combos.map((cb, idx) => {
        const isLast = idx === combos.length - 1;
        const stock = isLast ? Math.max(0, totalStock - currentAlloc) : perVar;
        currentAlloc += stock;
        const cleanColor = cb.color.replace(/\s+/g, '').slice(0, 3).toUpperCase();
        const cleanSize = cb.size.replace(/\s+/g, '').toUpperCase();
        return {
          id: `${productId}-VAR-${idx + 1}`,
          color: cb.color,
          size: cb.size,
          stock,
          sku: `${productId.replace('PRD-', 'ARF-')}-${cleanColor}-${cleanSize}`
        };
      });
    };

    const fashionData = [
      { id: 'PRD-001', name: 'Atasan Stripe Polo Kerah Jeans', brand: 'BY.ELFARA', category: 'Atasan & Kemeja', price: 145000, costPrice: 110000, stock: 25, barcode: '8991001001014', unit: 'Pcs', colors: ['Hitam', 'Putih', 'Navy', 'Abu-abu'], sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'PRD-002', name: 'Atasan Stripe Polo Kerah Jeans Polos', brand: 'BY.ELFARA', category: 'Atasan & Kemeja', price: 139000, costPrice: 105000, stock: 30, barcode: '8991001001021', unit: 'Pcs', colors: ['Hitam', 'Putih', 'Cream', 'Dusty Pink'], sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'PRD-003', name: 'Cardigan Stripe Kerah Jeans', brand: 'BY.ELFARA', category: 'Cardigan & Outer', price: 146000, costPrice: 112000, stock: 20, barcode: '8991001001038', unit: 'Pcs', colors: ['Hitam', 'Coklat', 'Navy'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
      { id: 'PRD-004', name: 'Cardigan Polo Stripe', brand: 'BY.ELFARA', category: 'Cardigan & Outer', price: 155000, costPrice: 120000, stock: 18, barcode: '8991001001045', unit: 'Pcs', colors: ['Hitam', 'Putih', 'Maroon', 'Olive'], sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'PRD-005', name: 'Kemeja Linen Oversized Casual', brand: 'ARFA FASHION', category: 'Atasan & Kemeja', price: 125000, costPrice: 95000, stock: 22, barcode: '8991001001052', unit: 'Pcs', colors: ['Putih', 'Cream', 'Sage Green', 'Dusty Blue'], sizes: ['M', 'L', 'XL', 'XXL'] },
      { id: 'PRD-006', name: 'Blouse Tunik Rayon Premium', brand: 'ARFA FASHION', category: 'Atasan & Kemeja', price: 115000, costPrice: 85000, stock: 24, barcode: '8991001001069', unit: 'Pcs', colors: ['Hitam', 'Putih', 'Dusty Pink', 'Lavender'], sizes: ['All Size'] },
      { id: 'PRD-007', name: 'Gamis Crinkle Airflow Premium', brand: 'ARFA FASHION', category: 'Gamis & Dress', price: 175000, costPrice: 130000, stock: 16, barcode: '8991001001076', unit: 'Pcs', colors: ['Hitam', 'Navy', 'Maroon', 'Olive', 'Grey'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
      { id: 'PRD-008', name: 'Midi Dress Floral Rayon Viscose', brand: 'ARFA FASHION', category: 'Gamis & Dress', price: 135000, costPrice: 100000, stock: 4, barcode: '8991001001083', unit: 'Pcs', colors: ['Biru Bunga', 'Pink Bunga', 'Hijau Bunga'], sizes: ['S', 'M', 'L'] },
      { id: 'PRD-009', name: 'Kulot Highwaist Linen Premium', brand: 'ARFA FASHION', category: 'Celana & Bawahan', price: 95000, costPrice: 70000, stock: 28, barcode: '8991001001090', unit: 'Pcs', colors: ['Hitam', 'Cream', 'Coklat Muda', 'Abu-abu'], sizes: ['S', 'M', 'L', 'XL'] },
      { id: 'PRD-010', name: 'Celana Baggy Jeans Boyfriend Denim', brand: 'ARFA FASHION', category: 'Celana & Bawahan', price: 145000, costPrice: 110000, stock: 15, barcode: '8991001001106', unit: 'Pcs', colors: ['Light Blue', 'Dark Blue', 'Black Denim'], sizes: ['27', '28', '29', '30', '31', '32'] },
      { id: 'PRD-011', name: 'Rok Plisket Flare Premium', brand: 'ARFA FASHION', category: 'Celana & Bawahan', price: 75000, costPrice: 55000, stock: 3, barcode: '8991001001113', unit: 'Pcs', colors: ['Hitam', 'Maroon', 'Camel'], sizes: ['All Size'] },
      { id: 'PRD-012', name: 'Jaket Denim Vintage Washed', brand: 'ARFA FASHION', category: 'Cardigan & Outer', price: 185000, costPrice: 140000, stock: 12, barcode: '8991001001120', unit: 'Pcs', colors: ['Light Blue', 'Dark Blue'], sizes: ['M', 'L', 'XL', 'XXL'] },
      { id: 'PRD-013', name: 'Pashmina Ceruty Baby Doll 180x75', brand: 'ZAHRA HIJAB', category: 'Hijab & Kerudung', price: 35000, costPrice: 24000, stock: 50, barcode: '8991001001137', unit: 'Pcs', colors: ['Hitam', 'Putih', 'Cream', 'Dusty Pink', 'Sage', 'Navy', 'Grey', 'Maroon'], sizes: ['All Size'] },
      { id: 'PRD-014', name: 'Hijab Segi Empat Voal Miracle Laser Cut', brand: 'ZAHRA HIJAB', category: 'Hijab & Kerudung', price: 38000, costPrice: 26000, stock: 45, barcode: '8991001001144', unit: 'Pcs', colors: ['Hitam', 'Putih', 'Cream', 'Dusty Lilac', 'Sage Green', 'Nude'], sizes: ['All Size'] },
      { id: 'PRD-015', name: 'Kaos Basic Cotton Combed 24s', brand: 'ARFA FASHION', category: 'Atasan & Kemeja', price: 65000, costPrice: 45000, stock: 35, barcode: '8991001001151', unit: 'Pcs', colors: ['Hitam', 'Putih', 'Navy', 'Abu-abu', 'Maroon', 'Olive'], sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    ];

    // Seed / update products with variants
    for (const p of fashionData) {
      const vars = buildVariants(p.id, p.colors, p.sizes, p.stock);
      await client.query(`
        INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, colors, sizes, variants)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          colors = EXCLUDED.colors,
          sizes = EXCLUDED.sizes,
          variants = CASE WHEN products.variants IS NULL OR products.variants = '[]'::jsonb THEN EXCLUDED.variants ELSE products.variants END;
      `, [p.id, p.name, p.brand, p.category, p.price, p.costPrice, p.stock, p.barcode, p.unit, JSON.stringify(p.colors), JSON.stringify(p.sizes), JSON.stringify(vars)]);
    }
    console.log('✅ Varian produk fashion berhasil di-sinkronkan ke Neon DB');

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
