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
        ['PM-002', 'BCA Transfer', 'TRANSFER', '🏦', 'sky', true, false, 'Bank Central Asia (BCA)', '8820 4912 3901', 'Kasir Kita Pro', 'Verifikasi mutasi m-banking BCA otomatis / manual'],
        ['PM-003', 'BNI Transfer', 'TRANSFER', '🏦', 'orange', true, false, 'Bank Negara Indonesia (BNI)', '0391 2847 10', 'Kasir Kita Pro', 'Transfer via BNI Mobile Banking / ATM'],
        ['PM-004', 'BRI Transfer', 'TRANSFER', '🏦', 'blue', true, false, 'Bank Rakyat Indonesia (BRI)', '1029 0100 4819 501', 'Kasir Kita Pro', 'Transfer via aplikasi BRImo'],
        ['PM-005', 'Mandiri Livin', 'TRANSFER', '🏦', 'yellow', true, false, 'Bank Mandiri', '1370 0192 4819 2', 'Kasir Kita Pro', 'Transfer via Livin by Mandiri'],
        ['PM-006', 'QRIS Kasir', 'TRANSFER', '📱', 'rose', true, false, 'QRIS Multi-Payment', 'NMD-881920194', 'Kasir Kita Pro', 'Scan QRIS statis kasir dengan GoPay, OVO, ShopeePay, DANA'],
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
        UPDATE payment_methods SET bank_name = 'Bank Central Asia (BCA)', account_number = '8820 4912 3901', account_holder = 'Kasir Kita Pro', description = 'Verifikasi mutasi m-banking BCA' WHERE id = 'PM-002' AND (bank_name IS NULL OR bank_name = '');
        UPDATE payment_methods SET bank_name = 'Bank Negara Indonesia (BNI)', account_number = '0391 2847 10', account_holder = 'Kasir Kita Pro', description = 'Transfer via BNI Mobile Banking' WHERE id = 'PM-003' AND (bank_name IS NULL OR bank_name = '');
        UPDATE payment_methods SET bank_name = 'Bank Rakyat Indonesia (BRI)', account_number = '1029 0100 4819 501', account_holder = 'Kasir Kita Pro', description = 'Transfer via aplikasi BRImo' WHERE id = 'PM-004' AND (bank_name IS NULL OR bank_name = '');
        UPDATE payment_methods SET bank_name = 'Bank Mandiri', account_number = '1370 0192 4819 2', account_holder = 'Kasir Kita Pro', description = 'Transfer via Livin by Mandiri' WHERE id = 'PM-005' AND (bank_name IS NULL OR bank_name = '');
        UPDATE payment_methods SET bank_name = 'QRIS Multi-Payment', account_number = 'NMD-881920194', account_holder = 'Kasir Kita Pro', description = 'Scan QRIS dari semua e-wallet & m-banking' WHERE id = 'PM-006' AND (bank_name IS NULL OR bank_name = '');
      `);
    }

    // Seed cashier if not exists
    const cashierCheck = await client.query(`SELECT COUNT(*) FROM cashier_profile`);
    if (parseInt(cashierCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO cashier_profile (id, name, shift, outlet_name, outlet_address, outlet_phone)
        VALUES ('CSH-001', 'Budi Pratama', 'Shift 1 (07:00 - 15:00)', 'MINIMARKET KASIR PRO', 'Jl. Merdeka Raya No. 45, Jakarta Pusat', '021-5550192');
      `);
      console.log('✅ Profil kasir awal berhasil di-seed');
    }

    // Seed products if not exists
    const productCheck = await client.query(`SELECT COUNT(*) FROM products`);
    if (parseInt(productCheck.rows[0].count, 10) === 0) {
      const initialProducts = [
        ['PRD-001', 'Aqua Air Mineral 600ml', 'Aqua Danone', 'Minuman', 3500, 2800, 48, '8992761111014', 'Botol'],
        ['PRD-002', 'Indomie Goreng Spesial 85g', 'Indofood', 'Makanan Instan', 3500, 2900, 120, '8998866200223', 'Bungkus'],
        ['PRD-003', 'Indomie Kuah Ayam Bawang 69g', 'Indofood', 'Makanan Instan', 3500, 2900, 85, '8998866200339', 'Bungkus'],
        ['PRD-004', 'Teh Botol Sosro Kotak 250ml', 'Sosro', 'Minuman', 4000, 3200, 35, '8992741981105', 'Kotak'],
        ['PRD-005', 'Ultra Milk Susu UHT Cokelat 250ml', 'Ultra Jaya', 'Susu & Olahan', 6500, 5300, 24, '8992723120118', 'Kotak'],
        ['PRD-006', 'Silverqueen Cashew 58g', 'Silverqueen', 'Snack & Cokelat', 16500, 13500, 18, '8991001103217', 'Pcs'],
        ['PRD-007', 'Pocari Sweat Botol 500ml', 'Otsuka', 'Minuman', 8000, 6500, 32, '8992753210087', 'Botol'],
        ['PRD-008', 'Chitato Sapi Panggang 68g', 'Indofood Snack', 'Snack & Cokelat', 11500, 9200, 19, '8992775110195', 'Bungkus'],
        ['PRD-009', 'Kopiko Candy Coffee Bag 150g', 'Mayora', 'Permen & Manisan', 9000, 7200, 4, '8996001301140', 'Bungkus'],
        ['PRD-010', 'Kopi Kapal Api Spesial Mix 10x24g', 'Kapal Api', 'Kopi & Teh', 14500, 12000, 40, '8991002101120', 'Renceng'],
        ['PRD-011', 'Tango Wafer Cokelat 110g', 'Orang Tua', 'Snack & Cokelat', 8500, 6800, 3, '8991102201019', 'Pcs'],
        ['PRD-012', 'Lifebuoy Sabun Cair Total 10 450ml', 'Unilever', 'Perawatan Tubuh', 24500, 19800, 15, '8999999014562', 'Pouch']
      ];

      for (const p of initialProducts) {
        await client.query(`
          INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING;
        `, p);
      }
      console.log('✅ Katalog produk retail awal berhasil di-seed ke Neon DB');
    }

    // Seed transactions if not exists
    const txCheck = await client.query(`SELECT COUNT(*) FROM transactions`);
    if (parseInt(txCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO transactions (
          id, invoice_number, date, cashier_name, items, subtotal, tax, discount, total, payment_method, status, cash_given, change_amount
        ) VALUES (
          'TRX-101', 'INV/20260919/0001', '2026-09-19T08:32:15', 'Budi Pratama',
          '[{"productId":"PRD-001","name":"Aqua Air Mineral 600ml","brand":"Aqua Danone","price":3500,"quantity":2,"subtotal":7000},{"productId":"PRD-002","name":"Indomie Goreng Spesial 85g","brand":"Indofood","price":3500,"quantity":3,"subtotal":10500}]'::jsonb,
          17500, 0, 0, 17500, 'TUNAI', 'LUNAS', 20000, 2500
        );
      `);

      await client.query(`
        INSERT INTO transactions (
          id, invoice_number, date, cashier_name, items, subtotal, tax, discount, total, payment_method, status, transfer_bank, transfer_proof_url, transfer_proof_verified, transfer_confirmed_at, transfer_confirmed_by
        ) VALUES (
          'TRX-102', 'INV/20260919/0002', '2026-09-19T09:14:40', 'Budi Pratama',
          '[{"productId":"PRD-006","name":"Silverqueen Cashew 58g","brand":"Silverqueen","price":16500,"quantity":2,"subtotal":33000},{"productId":"PRD-005","name":"Ultra Milk Susu UHT Cokelat 250ml","brand":"Ultra Jaya","price":6500,"quantity":2,"subtotal":13000}]'::jsonb,
          46000, 0, 0, 46000, 'TRANSFER', 'LUNAS', 'BCA (Virtual Account)', 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&q=80', true, '2026-09-19T09:16:00', 'Budi Pratama'
        );
      `);

      await client.query(`
        INSERT INTO transactions (
          id, invoice_number, date, cashier_name, items, subtotal, tax, discount, total, payment_method, status, transfer_bank, transfer_proof_url, transfer_proof_verified, customer_note
        ) VALUES (
          'TRX-103', 'INV/20260919/0003', '2026-09-19T10:05:22', 'Budi Pratama',
          '[{"productId":"PRD-010","name":"Kopi Kapal Api Spesial Mix 10x24g","brand":"Kapal Api","price":14500,"quantity":1,"subtotal":14500},{"productId":"PRD-008","name":"Chitato Sapi Panggang 68g","brand":"Indofood Snack","price":11500,"quantity":2,"subtotal":23000}]'::jsonb,
          37500, 0, 0, 37500, 'TRANSFER', 'MENUNGGU_KONFIRMASI', 'Mandiri Livin', 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&q=80', false, 'Pelanggan Meja 4 / Takeaway'
        );
      `);
      console.log('✅ Transaksi awal berhasil di-seed ke Neon DB');
    }

    console.log('🎉 Neon PostgreSQL Database siap digunakan!');
  } catch (error) {
    console.error('❌ Gagal inisialisasi tabel di Neon PostgreSQL:', error);
    throw error;
  } finally {
    client.release();
  }
};
