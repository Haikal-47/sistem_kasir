import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_gtfYruN0hi8d@ep-super-mouse-b3uxrazw-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 5,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Neon pool error:', err);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const router = express.Router();

// Health Check
router.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ status: 'ok', database: 'connected', time: result.rows[0].current_time });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Network IP helper
router.get('/network-ip', (req, res) => {
  res.json({
    primaryIp: req.headers.host?.split(':')[0] || 'localhost',
    wsPort: 3001,
    vitePort: 5173,
  });
});

// ── Products ───────────────────────────────────────────────────────────
router.get('/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    const products = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      price: parseFloat(r.price),
      costPrice: r.cost_price ? parseFloat(r.cost_price) : 0,
      stock: parseInt(r.stock, 10),
      barcode: r.barcode,
      unit: r.unit || 'Pcs',
    }));
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/products', async (req, res) => {
  try {
    const { name, brand, category, price, costPrice, stock, barcode, unit } = req.body;
    const id = `PRD-${Date.now().toString().slice(-4)}`;
    const result = await pool.query(
      `INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, name, brand, category, price, costPrice || 0, stock || 0, barcode, unit || 'Pcs']
    );
    const r = result.rows[0];
    res.status(201).json({
      id: r.id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      price: parseFloat(r.price),
      costPrice: r.cost_price ? parseFloat(r.cost_price) : 0,
      stock: parseInt(r.stock, 10),
      barcode: r.barcode,
      unit: r.unit,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, category, price, costPrice, stock, barcode, unit } = req.body;
    const result = await pool.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           brand = COALESCE($2, brand),
           category = COALESCE($3, category),
           price = COALESCE($4, price),
           cost_price = COALESCE($5, cost_price),
           stock = COALESCE($6, stock),
           barcode = COALESCE($7, barcode),
           unit = COALESCE($8, unit),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [name, brand, category, price, costPrice, stock, barcode, unit, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const r = result.rows[0];
    res.json({
      id: r.id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      price: parseFloat(r.price),
      costPrice: r.cost_price ? parseFloat(r.cost_price) : 0,
      stock: parseInt(r.stock, 10),
      barcode: r.barcode,
      unit: r.unit,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Transactions ───────────────────────────────────────────────────────
router.get('/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions ORDER BY date DESC');
    const transactions = result.rows.map(r => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      date: r.date instanceof Date ? r.date.toISOString() : r.date,
      cashierName: r.cashier_name,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      subtotal: parseFloat(r.subtotal),
      tax: parseFloat(r.tax || 0),
      discount: parseFloat(r.discount || 0),
      total: parseFloat(r.total),
      paymentMethod: r.payment_method,
      status: r.status,
      cashGiven: r.cash_given ? parseFloat(r.cash_given) : undefined,
      changeAmount: r.change_amount ? parseFloat(r.change_amount) : undefined,
      transferBank: r.transfer_bank || undefined,
      transferProofUrl: r.transfer_proof_url || undefined,
      transferProofVerified: r.transfer_proof_verified,
      transferConfirmedAt: r.transfer_confirmed_at ? (r.transfer_confirmed_at.toISOString ? r.transfer_confirmed_at.toISOString() : r.transfer_confirmed_at) : undefined,
      transferConfirmedBy: r.transfer_confirmed_by || undefined,
      customerNote: r.customer_note || undefined,
    }));
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/transactions', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      id,
      invoiceNumber,
      date,
      cashierName,
      items,
      subtotal,
      tax,
      discount,
      total,
      paymentMethod,
      status,
      cashGiven,
      changeAmount,
      transferBank,
      transferProofUrl,
      transferProofVerified,
      transferConfirmedAt,
      transferConfirmedBy,
      customerNote,
    } = req.body;

    for (const item of items) {
      await client.query(
        `UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [item.quantity, item.productId]
      );
    }

    const result = await client.query(
      `INSERT INTO transactions (
        id, invoice_number, date, cashier_name, items, subtotal, tax, discount, total,
        payment_method, status, cash_given, change_amount, transfer_bank, transfer_proof_url,
        transfer_proof_verified, transfer_confirmed_at, transfer_confirmed_by, customer_note
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *`,
      [
        id,
        invoiceNumber,
        date,
        cashierName,
        JSON.stringify(items),
        subtotal,
        tax || 0,
        discount || 0,
        total,
        paymentMethod,
        status,
        cashGiven || null,
        changeAmount || null,
        transferBank || null,
        transferProofUrl || null,
        transferProofVerified || false,
        transferConfirmedAt || null,
        transferConfirmedBy || null,
        customerNote || null,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...req.body, id: result.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.patch('/transactions/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmedBy } = req.body;
    const result = await pool.query(
      `UPDATE transactions
       SET status = 'LUNAS',
           transfer_proof_verified = TRUE,
           transfer_confirmed_at = CURRENT_TIMESTAMP,
           transfer_confirmed_by = $1
       WHERE id = $2
       RETURNING *`,
      [confirmedBy || 'Kasir', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ success: true, transaction: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Cashier Profile ────────────────────────────────────────────────────
router.get('/cashier', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cashier_profile LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({
        name: 'Budi Pratama',
        shift: 'Shift 1 (07:00 - 15:00)',
        outletName: 'MINIMARKET KASIR PRO',
        outletAddress: 'Jl. Merdeka Raya No. 45, Jakarta Pusat',
        outletPhone: '021-5550192',
      });
    }
    const r = result.rows[0];
    res.json({
      name: r.name,
      shift: r.shift,
      outletName: r.outlet_name,
      outletAddress: r.outlet_address,
      outletPhone: r.outlet_phone,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/cashier', async (req, res) => {
  try {
    const { name, shift, outletName, outletAddress, outletPhone } = req.body;
    const check = await pool.query('SELECT id FROM cashier_profile LIMIT 1');
    let result;
    if (check.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO cashier_profile (id, name, shift, outlet_name, outlet_address, outlet_phone)
         VALUES ('CSH-001', $1, $2, $3, $4, $5) RETURNING *`,
        [name, shift, outletName, outletAddress, outletPhone]
      );
    } else {
      result = await pool.query(
        `UPDATE cashier_profile
         SET name = COALESCE($1, name),
             shift = COALESCE($2, shift),
             outlet_name = COALESCE($3, outlet_name),
             outlet_address = COALESCE($4, outlet_address),
             outlet_phone = COALESCE($5, outlet_phone),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 RETURNING *`,
        [name, shift, outletName, outletAddress, outletPhone, check.rows[0].id]
      );
    }
    const r = result.rows[0];
    res.json({
      name: r.name,
      shift: r.shift,
      outletName: r.outlet_name,
      outletAddress: r.outlet_address,
      outletPhone: r.outlet_phone,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Payment Methods ────────────────────────────────────────────────────
router.get('/payment-methods', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payment_methods ORDER BY created_at ASC');
    const methods = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      icon: r.icon,
      color: r.color,
      isActive: r.is_active,
      isDefault: r.is_default,
      bankName: r.bank_name || '',
      accountNumber: r.account_number || '',
      accountHolder: r.account_holder || '',
      description: r.description || '',
    }));
    res.json(methods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/payment-methods', async (req, res) => {
  try {
    const { name, type, icon, color, isActive, isDefault, bankName, accountNumber, accountHolder, description } = req.body;
    const id = `PM-${Date.now().toString().slice(-4)}`;
    const result = await pool.query(
      `INSERT INTO payment_methods (id, name, type, icon, color, is_active, is_default, bank_name, account_number, account_holder, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [id, name, type, icon || '💳', color || 'sky', isActive !== false, isDefault === true, bankName || '', accountNumber || '', accountHolder || '', description || '']
    );
    const r = result.rows[0];
    res.status(201).json({
      id: r.id,
      name: r.name,
      type: r.type,
      icon: r.icon,
      color: r.color,
      isActive: r.is_active,
      isDefault: r.is_default,
      bankName: r.bank_name || '',
      accountNumber: r.account_number || '',
      accountHolder: r.account_holder || '',
      description: r.description || '',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, icon, color, isActive, isDefault, bankName, accountNumber, accountHolder, description } = req.body;
    const result = await pool.query(
      `UPDATE payment_methods
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           icon = COALESCE($3, icon),
           color = COALESCE($4, color),
           is_active = COALESCE($5, is_active),
           is_default = COALESCE($6, is_default),
           bank_name = COALESCE($7, bank_name),
           account_number = COALESCE($8, account_number),
           account_holder = COALESCE($9, account_holder),
           description = COALESCE($10, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [name, type, icon, color, isActive, isDefault, bankName, accountNumber, accountHolder, description, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment method not found' });
    }
    const r = result.rows[0];
    res.json({
      id: r.id,
      name: r.name,
      type: r.type,
      icon: r.icon,
      color: r.color,
      isActive: r.is_active,
      isDefault: r.is_default,
      bankName: r.bank_name || '',
      accountNumber: r.account_number || '',
      accountHolder: r.account_holder || '',
      description: r.description || '',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/payment-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM payment_methods WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Wireless Scanner Polling Endpoints ─────────────────────────────────

let isScannerTableReady = false;
const ensureScannerTables = async () => {
  if (isScannerTableReady) return;
  try {
    await pool.query(`
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
    isScannerTableReady = true;
  } catch (e) {
    console.error('Error ensuring scanner tables:', e);
  }
};

// HP kirim heartbeat (menandai scanner HP aktif)
router.post('/scan/heartbeat', async (req, res) => {
  try {
    await ensureScannerTables();
    const { session, deviceName } = req.body;
    if (!session) return res.status(400).json({ error: 'Session code required' });
    await pool.query(
      `INSERT INTO scanner_sessions (session_code, last_heartbeat, device_name)
       VALUES ($1, CURRENT_TIMESTAMP, $2)
       ON CONFLICT (session_code)
       DO UPDATE SET last_heartbeat = CURRENT_TIMESTAMP, device_name = EXCLUDED.device_name`,
      [session, deviceName || 'HP Kasir']
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HP kirim hasil scan barcode
router.post('/scan', async (req, res) => {
  try {
    await ensureScannerTables();
    const { session, barcode } = req.body;
    if (!session || !barcode) {
      return res.status(400).json({ error: 'Session code and barcode are required' });
    }
    pool.query(`DELETE FROM pending_scans WHERE scanned_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes'`).catch(() => {});
    
    const result = await pool.query(
      `INSERT INTO pending_scans (session_code, barcode)
       VALUES ($1, $2)
       RETURNING id`,
      [session, barcode.trim()]
    );
    res.status(201).json({ success: true, scanId: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Laptop mengambil antrian scan yang belum diproses + cek status koneksi HP
router.get('/scan/pending', async (req, res) => {
  try {
    await ensureScannerTables();
    const { session } = req.query;
    if (!session) return res.status(400).json({ error: 'Session code is required' });

    const sessionRes = await pool.query(
      `SELECT (last_heartbeat > CURRENT_TIMESTAMP - INTERVAL '45 seconds') AS is_active
       FROM scanner_sessions WHERE session_code = $1`,
      [session]
    );
    const isScannerConnected = sessionRes.rows.length > 0 && sessionRes.rows[0].is_active === true;

    const scansRes = await pool.query(
      `SELECT id, barcode, scanned_at
       FROM pending_scans
       WHERE session_code = $1 AND processed = FALSE
       ORDER BY scanned_at ASC
       LIMIT 10`,
      [session]
    );

    res.json({
      scans: scansRes.rows.map(r => ({ id: r.id, barcode: r.barcode, scannedAt: r.scanned_at })),
      isScannerConnected,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Laptop tandai barcode sudah selesai diproses (POST + PATCH for Vercel compatibility)
const markScanProcessedHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { success, productName, productPrice } = req.body;
    await pool.query(
      `UPDATE pending_scans
       SET processed = TRUE,
           success = $1,
           product_name = $2,
           product_price = $3
       WHERE id = $4`,
      [success === true, productName || null, productPrice ? parseFloat(productPrice) : null, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
router.post('/scan/:id/processed', markScanProcessedHandler);
router.patch('/scan/:id/processed', markScanProcessedHandler);

// HP polling acknowledgement
router.get('/scan/:id/ack', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, processed, success, product_name, product_price
       FROM pending_scans
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    const row = result.rows[0];
    res.json({
      id: row.id,
      processed: row.processed,
      success: row.success,
      productName: row.product_name,
      productPrice: row.product_price ? parseFloat(row.product_price) : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mount router on both '/api' and '/' so rewrites work seamlessly on Vercel
app.use('/api', router);
app.use('/', router);

export default app;
