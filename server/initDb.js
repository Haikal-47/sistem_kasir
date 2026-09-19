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
