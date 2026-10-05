-- ====================================================================
-- SISTEM POS KASIR PRO - DATABASE SCHEMA & INITIAL SEED (POSTGRESQL)
-- Instansi: Puslitbang Polri
-- Kompatibel: PostgreSQL 13 / 14 / 15 / 16
-- ====================================================================

-- 1. TABEL PENGGUNA & AUTENTIKASI (USERS)
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

-- 2. TABEL PENGATURAN TOKO (STORE SETTINGS)
CREATE TABLE IF NOT EXISTS store_settings (
  id VARCHAR(64) PRIMARY KEY,
  store_name VARCHAR(255) NOT NULL,
  store_address TEXT,
  store_phone VARCHAR(50),
  min_stock_alert INT DEFAULT 5,
  receipt_footer TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABEL PROFIL KASIR (CASHIER PROFILE)
CREATE TABLE IF NOT EXISTS cashier_profile (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  shift VARCHAR(100) NOT NULL,
  outlet_name VARCHAR(255) NOT NULL,
  outlet_address TEXT,
  outlet_phone VARCHAR(50),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABEL PRODUK & INVENTARIS (PRODUCTS)
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

-- 5. TABEL METODE PEMBAYARAN (PAYMENT METHODS)
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

-- 6. TABEL ABSENSI & MODAL KASIR (CASHIER ATTENDANCES)
CREATE TABLE IF NOT EXISTS cashier_attendances (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  cashier_name VARCHAR(255),
  date DATE NOT NULL,
  check_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_out TIMESTAMP WITH TIME ZONE,
  opening_cash NUMERIC(15, 2) NOT NULL DEFAULT 500000,
  expected_cash NUMERIC(15, 2),
  actual_cash NUMERIC(15, 2),
  cash_difference NUMERIC(15, 2),
  total_transactions INT DEFAULT 0,
  total_sales NUMERIC(15, 2) DEFAULT 0,
  total_cash NUMERIC(15, 2) DEFAULT 0,
  total_transfer NUMERIC(15, 2) DEFAULT 0,
  total_qris NUMERIC(15, 2) DEFAULT 0,
  closed_by VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'working',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_date UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendances_date ON cashier_attendances(date);
CREATE INDEX IF NOT EXISTS idx_attendances_user ON cashier_attendances(user_id);
CREATE INDEX IF NOT EXISTS idx_attendances_status ON cashier_attendances(status);

-- 7. TABEL TRANSAKSI PENJUALAN (TRANSACTIONS)
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
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  attendance_id VARCHAR(64),
  user_id VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transactions_attendance ON transactions(attendance_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_att_status ON transactions(attendance_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_status_date ON transactions(status, date DESC);

-- 8. TABEL IDEMPOTENCY (IDEMPOTENCY KEYS)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  transaction_id VARCHAR(64) NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON idempotency_keys (created_at);

-- 9. SEQUENCE NOMOR INVOICE
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

-- 10. TABEL WIRELESS SCANNER (SCANNER SESSIONS & PENDING SCANS)
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

-- ====================================================================
-- INITIAL SEED DATA (DATA AWAL SISTEM)
-- ====================================================================

-- Data Awal Pengguna (Kata sandi di-hash menggunakan bcrypt)
INSERT INTO users (id, username, password, name, role, is_active)
VALUES 
  ('USR-ADM-01', 'admin', '$2b$10$QbBFjqhitnZuPT5L7I60cuvhDMLd6/lBf/ZsbXvOLglpw5EoPQARK', 'Super Admin', 'super_admin', TRUE),
  ('USR-KAS-01', 'gusti', '$2b$10$gmteABlXoj7T0Yirh.1xmOj0MRpeofZz2j1HPbgVn5H/HfOixIcq6', 'Gusti', 'kasir', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Data Awal Pengaturan Toko
INSERT INTO store_settings (id, store_name, store_address, store_phone, min_stock_alert, receipt_footer)
VALUES 
  ('SET-001', 'ARFA FASHION', 'Jl. Merdeka Raya No. 45, Jakarta Pusat', '021-5550192', 5, 'Terima kasih telah berbelanja! Barang yang sudah dibeli dapat ditukar maksimal 3 hari dengan menyertakan struk ini.')
ON CONFLICT (id) DO NOTHING;

-- Data Awal Profil Kasir
INSERT INTO cashier_profile (id, name, shift, outlet_name, outlet_address, outlet_phone)
VALUES 
  ('CSH-001', 'Gusti', 'Shift 1 (07:00 - 15:00)', 'ARFA FASHION', 'Jl. Merdeka Raya No. 45, Jakarta Pusat', '021-5550192')
ON CONFLICT (id) DO NOTHING;

-- Data Awal Metode Pembayaran
INSERT INTO payment_methods (id, name, type, icon, color, is_active, is_default, bank_name, account_number, account_holder, description)
VALUES 
  ('PM-001', 'Tunai', 'TUNAI', '💵', 'emerald', true, true, '', '', '', 'Pembayaran tunai langsung di meja kasir'),
  ('PM-002', 'BCA Transfer', 'TRANSFER', '🏦', 'sky', true, false, 'Bank Central Asia (BCA)', '8820 4912 3901', 'ARFA FASHION', 'Verifikasi mutasi m-banking BCA otomatis / manual'),
  ('PM-003', 'BNI Transfer', 'TRANSFER', '🏦', 'orange', true, false, 'Bank Negara Indonesia (BNI)', '0391 2847 10', 'ARFA FASHION', 'Transfer via BNI Mobile Banking / ATM'),
  ('PM-004', 'BRI Transfer', 'TRANSFER', '🏦', 'blue', true, false, 'Bank Rakyat Indonesia (BRI)', '1029 0100 4819 501', 'ARFA FASHION', 'Transfer via aplikasi BRImo'),
  ('PM-005', 'Mandiri Livin', 'TRANSFER', '🏦', 'yellow', true, false, 'Bank Mandiri', '1370 0192 4819 2', 'ARFA FASHION', 'Transfer via Livin by Mandiri'),
  ('PM-006', 'QRIS Kasir', 'TRANSFER', '📱', 'rose', true, false, 'QRIS Multi-Payment', 'NMD-881920194', 'ARFA FASHION', 'Scan QRIS statis kasir dengan GoPay, OVO, ShopeePay, DANA')
ON CONFLICT (id) DO NOTHING;

-- Data Awal Produk Contoh
INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, colors, sizes, variants)
VALUES 
  ('PRD-001', 'Atasan Stripe Polo Kerah Jeans', 'BY.ELFARA', 'Atasan & Kemeja', 145000, 110000, 25, '8991001001014', 'Pcs', '["Hitam", "Putih", "Navy", "Abu-abu"]'::jsonb, '["S", "M", "L", "XL"]'::jsonb, '[]'::jsonb),
  ('PRD-002', 'Atasan Stripe Polo Kerah Jeans Polos', 'BY.ELFARA', 'Atasan & Kemeja', 139000, 105000, 30, '8991001001021', 'Pcs', '["Hitam", "Putih", "Cream", "Dusty Pink"]'::jsonb, '["S", "M", "L", "XL"]'::jsonb, '[]'::jsonb),
  ('PRD-003', 'Cardigan Stripe Kerah Jeans', 'BY.ELFARA', 'Cardigan & Outer', 146000, 112000, 20, '8991001001038', 'Pcs', '["Hitam", "Coklat", "Navy"]'::jsonb, '["S", "M", "L", "XL", "XXL"]'::jsonb, '[]'::jsonb),
  ('PRD-004', 'Cardigan Polo Stripe', 'BY.ELFARA', 'Cardigan & Outer', 155000, 120000, 18, '8991001001045', 'Pcs', '["Hitam", "Putih", "Maroon", "Olive"]'::jsonb, '["S", "M", "L", "XL"]'::jsonb, '[]'::jsonb),
  ('PRD-005', 'Kemeja Linen Oversized Casual', 'ARFA FASHION', 'Atasan & Kemeja', 125000, 95000, 22, '8991001001052', 'Pcs', '["Putih", "Cream", "Sage Green", "Dusty Blue"]'::jsonb, '["M", "L", "XL", "XXL"]'::jsonb, '[]'::jsonb),
  ('PRD-006', 'Blouse Tunik Rayon Premium', 'ARFA FASHION', 'Atasan & Kemeja', 115000, 85000, 24, '8991001001069', 'Pcs', '["Hitam", "Putih", "Dusty Pink", "Lavender"]'::jsonb, '["All Size"]'::jsonb, '[]'::jsonb),
  ('PRD-007', 'Gamis Crinkle Airflow Premium', 'ARFA FASHION', 'Gamis & Dress', 175000, 130000, 16, '8991001001076', 'Pcs', '["Hitam", "Navy", "Maroon", "Olive", "Grey"]'::jsonb, '["S", "M", "L", "XL", "XXL"]'::jsonb, '[]'::jsonb),
  ('PRD-008', 'Midi Dress Floral Rayon Viscose', 'ARFA FASHION', 'Gamis & Dress', 135000, 100000, 4, '8991001001083', 'Pcs', '["Biru Bunga", "Pink Bunga", "Hijau Bunga"]'::jsonb, '["S", "M", "L"]'::jsonb, '[]'::jsonb),
  ('PRD-009', 'Kulot Highwaist Linen Premium', 'ARFA FASHION', 'Celana & Bawahan', 95000, 70000, 28, '8991001001090', 'Pcs', '["Hitam", "Cream", "Coklat Muda", "Abu-abu"]'::jsonb, '["S", "M", "L", "XL"]'::jsonb, '[]'::jsonb),
  ('PRD-010', 'Celana Baggy Jeans Boyfriend Denim', 'ARFA FASHION', 'Celana & Bawahan', 145000, 110000, 15, '8991001001106', 'Pcs', '["Light Blue", "Dark Blue", "Black Denim"]'::jsonb, '["27", "28", "29", "30", "31", "32"]'::jsonb, '[]'::jsonb),
  ('PRD-011', 'Rok Plisket Flare Premium', 'ARFA FASHION', 'Celana & Bawahan', 75000, 55000, 3, '8991001001113', 'Pcs', '["Hitam", "Maroon", "Camel"]'::jsonb, '["All Size"]'::jsonb, '[]'::jsonb),
  ('PRD-012', 'Jaket Denim Vintage Washed', 'ARFA FASHION', 'Cardigan & Outer', 185000, 140000, 12, '8991001001120', 'Pcs', '["Light Blue", "Dark Blue"]'::jsonb, '["M", "L", "XL", "XXL"]'::jsonb, '[]'::jsonb),
  ('PRD-013', 'Pashmina Ceruty Baby Doll 180x75', 'ZAHRA HIJAB', 'Hijab & Kerudung', 35000, 24000, 50, '8991001001137', 'Pcs', '["Hitam", "Putih", "Cream", "Dusty Pink", "Sage", "Navy", "Grey", "Maroon"]'::jsonb, '["All Size"]'::jsonb, '[]'::jsonb),
  ('PRD-014', 'Hijab Segi Empat Voal Miracle Laser Cut', 'ZAHRA HIJAB', 'Hijab & Kerudung', 38000, 26000, 45, '8991001001144', 'Pcs', '["Hitam", "Putih", "Cream", "Dusty Lilac", "Sage Green", "Nude"]'::jsonb, '["All Size"]'::jsonb, '[]'::jsonb),
  ('PRD-015', 'Kaos Basic Cotton Combed 24s', 'ARFA FASHION', 'Atasan & Kemeja', 65000, 45000, 35, '8991001001151', 'Pcs', '["Hitam", "Putih", "Navy", "Abu-abu", "Maroon", "Olive"]'::jsonb, '["S", "M", "L", "XL", "XXL"]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;
