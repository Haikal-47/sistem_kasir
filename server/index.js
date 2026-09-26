import express from 'express';
import http from 'http';
import os from 'os';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { pool } from './db.js';
import { initDatabase } from './initDb.js';
import { setupWebSocketServer } from './websocket.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const AUTH_SECRET = process.env.AUTH_SECRET || 'arfa-fashion-pos-secret-key-2026';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Token & Auth Helpers ──────────────────────────────────────────────────
export const createToken = (user) => {
  const payload = JSON.stringify({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  const b64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(b64Payload).digest('base64url');
  return `${b64Payload}.${signature}`;
};

export const verifyToken = (token) => {
  if (!token) return null;
  const clean = token.replace(/^Bearer\s+/i, '').trim();
  const parts = clean.split('.');
  if (parts.length !== 2) return null;
  const [b64Payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(b64Payload).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  if (!authHeader) {
    req.user = null;
    return next();
  }
  req.user = verifyToken(authHeader);
  next();
};

export const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  const user = verifyToken(authHeader);
  if (!user || user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Akses ditolak: Operasi ini membutuhkan hak akses Super Admin.',
      code: 'FORBIDDEN_ADMIN_ONLY'
    });
  }
  req.user = user;
  next();
};

app.use(authenticate);

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ status: 'ok', database: 'connected', time: result.rows[0].current_time });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// GET /api/network-ip - Helper to provide laptop's WiFi IP address for mobile phone scanner
app.get('/api/network-ip', (req, res) => {
  const nets = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ interface: name, address: net.address });
      }
    }
  }

  const primaryIp = addresses.find(a => !a.address.startsWith('169.254'))?.address || 'localhost';
  res.json({
    primaryIp,
    addresses,
    wsPort: PORT,
    vitePort: 5173
  });
});

// ─── AUTHENTICATION ENDPOINTS ──────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, portal } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan kata sandi wajib diisi.' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Username atau kata sandi tidak cocok.' });
    }

    const user = result.rows[0];
    if (user.password !== password) {
      return res.status(401).json({ error: 'Username atau kata sandi tidak cocok.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Akun Anda dinonaktifkan oleh Administrator.' });
    }

    // Role Enforcement: Kasir tidak boleh login di portal admin
    if (portal === 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Akses ditolak: Akun Kasir tidak diizinkan masuk ke portal Admin.'
      });
    }

    const token = createToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        isActive: user.is_active,
      }
    });
  } catch (error) {
    console.error('Error in /api/auth/login:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir.' });
  }
  res.json({ user: req.user });
});

// ─── USER MANAGEMENT (ADMIN ONLY) ──────────────────────────────────────────

// GET /api/users
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, name, role, is_active, created_at FROM users ORDER BY created_at ASC'
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      username: r.username,
      name: r.name,
      role: r.role,
      isActive: r.is_active,
      createdAt: r.created_at
    })));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users
app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, kata sandi, dan nama wajib diisi.' });
    }
    const cleanUser = username.trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(username) = $1', [cleanUser]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `Username "${cleanUser}" sudah digunakan.` });
    }

    const id = `USR-${Date.now().toString().slice(-4)}`;
    const roleVal = role === 'super_admin' ? 'super_admin' : 'kasir';
    const result = await pool.query(
      `INSERT INTO users (id, username, password, name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, username, name, role, is_active, created_at`,
      [id, cleanUser, password, name.trim(), roleVal]
    );

    const r = result.rows[0];
    res.status(201).json({
      id: r.id,
      username: r.username,
      name: r.name,
      role: r.role,
      isActive: r.is_active,
      createdAt: r.created_at
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id
app.put('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, name, role, isActive } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET username = COALESCE($1, username),
           password = COALESCE($2, password),
           name = COALESCE($3, name),
           role = COALESCE($4, role),
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, username, name, role, is_active, created_at`,
      [username ? username.trim().toLowerCase() : null, password ? password : null, name ? name.trim() : null, role || null, typeof isActive === 'boolean' ? isActive : null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    const r = result.rows[0];
    res.json({
      id: r.id,
      username: r.username,
      name: r.name,
      role: r.role,
      isActive: r.is_active,
      createdAt: r.created_at
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user && req.user.id === id) {
      return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang login.' });
    }
    const adminCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'super_admin'");
    const target = await pool.query("SELECT role FROM users WHERE id = $1", [id]);
    if (target.rows.length > 0 && target.rows[0].role === 'super_admin' && parseInt(adminCount.rows[0].count, 10) <= 1) {
      return res.status(400).json({ error: 'Tidak dapat menghapus satu-satunya akun Super Admin.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── STORE SETTINGS ────────────────────────────────────────────────────────

// GET /api/settings
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM store_settings LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({
        id: 'SET-001',
        storeName: 'ARFA FASHION',
        storeAddress: 'Jl. Merdeka Raya No. 45, Jakarta Pusat',
        storePhone: '021-5550192',
        minStockAlert: 5,
        receiptFooter: 'Terima kasih telah berbelanja di ARFA FASHION!'
      });
    }
    const r = result.rows[0];
    res.json({
      id: r.id,
      storeName: r.store_name,
      storeAddress: r.store_address,
      storePhone: r.store_phone,
      minStockAlert: r.min_stock_alert,
      receiptFooter: r.receipt_footer
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings
app.put('/api/settings', requireAdmin, async (req, res) => {
  try {
    const { storeName, storeAddress, storePhone, minStockAlert, receiptFooter } = req.body;
    const check = await pool.query('SELECT id FROM store_settings LIMIT 1');
    let result;
    if (check.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO store_settings (id, store_name, store_address, store_phone, min_stock_alert, receipt_footer)
         VALUES ('SET-001', $1, $2, $3, $4, $5) RETURNING *`,
        [storeName, storeAddress, storePhone, minStockAlert || 5, receiptFooter]
      );
    } else {
      result = await pool.query(
        `UPDATE store_settings
         SET store_name = COALESCE($1, store_name),
             store_address = COALESCE($2, store_address),
             store_phone = COALESCE($3, store_phone),
             min_stock_alert = COALESCE($4, min_stock_alert),
             receipt_footer = COALESCE($5, receipt_footer),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 RETURNING *`,
        [storeName, storeAddress, storePhone, minStockAlert || 5, receiptFooter, check.rows[0].id]
      );
    }
    const r = result.rows[0];
    res.json({
      id: r.id,
      storeName: r.store_name,
      storeAddress: r.store_address,
      storePhone: r.store_phone,
      minStockAlert: r.min_stock_alert,
      receiptFooter: r.receipt_footer
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── PRODUCTS ──────────────────────────────────────────────────────────────

// GET /api/products
app.get('/api/products', async (req, res) => {
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
      colors: typeof r.colors === 'string' ? JSON.parse(r.colors) : (r.colors || []),
      sizes: typeof r.sizes === 'string' ? JSON.parse(r.sizes) : (r.sizes || []),
      variants: typeof r.variants === 'string' ? JSON.parse(r.variants) : (r.variants || []),
    }));
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/products (Admin Only)
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const { name, brand, category, price, costPrice, stock, barcode, unit, colors, sizes, variants } = req.body;
    const id = `PRD-${Date.now().toString().slice(-4)}`;
    const result = await pool.query(
      `INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, colors, sizes, variants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id, name, brand, category, price, costPrice || 0, stock || 0, barcode, unit || 'Pcs',
        JSON.stringify(colors || []), JSON.stringify(sizes || []), JSON.stringify(variants || [])
      ]
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
      colors: r.colors,
      sizes: r.sizes,
      variants: r.variants,
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/products/:id (Admin Only)
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, category, price, costPrice, stock, barcode, unit, colors, sizes, variants } = req.body;
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
           colors = COALESCE($9, colors),
           sizes = COALESCE($10, sizes),
           variants = COALESCE($11, variants),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING *`,
      [
        name, brand, category, price, costPrice, stock, barcode, unit,
        colors ? JSON.stringify(colors) : null,
        sizes ? JSON.stringify(sizes) : null,
        variants ? JSON.stringify(variants) : null,
        id
      ]
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
      colors: typeof r.colors === 'string' ? JSON.parse(r.colors) : r.colors,
      sizes: typeof r.sizes === 'string' ? JSON.parse(r.sizes) : r.sizes,
      variants: typeof r.variants === 'string' ? JSON.parse(r.variants) : r.variants,
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/products/:id/stock (Admin Only) - Quick restock or adjustment
app.patch('/api/products/:id/stock', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { variantId, deltaStock, newStock } = req.body;

    const prodRes = await pool.query('SELECT stock, variants FROM products WHERE id = $1', [id]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const prod = prodRes.rows[0];
    let vars = typeof prod.variants === 'string' ? JSON.parse(prod.variants) : (prod.variants || []);
    let updatedTotalStock = prod.stock;

    if (variantId && Array.isArray(vars) && vars.length > 0) {
      vars = vars.map(v => {
        if (v.id === variantId) {
          const finalStock = typeof newStock === 'number' ? newStock : Math.max(0, v.stock + (deltaStock || 0));
          return { ...v, stock: finalStock };
        }
        return v;
      });
      updatedTotalStock = vars.reduce((sum, v) => sum + v.stock, 0);
    } else {
      updatedTotalStock = typeof newStock === 'number' ? newStock : Math.max(0, prod.stock + (deltaStock || 0));
    }

    const updateRes = await pool.query(
      `UPDATE products SET stock = $1, variants = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
      [updatedTotalStock, JSON.stringify(vars), id]
    );

    const r = updateRes.rows[0];
    res.json({
      id: r.id,
      stock: r.stock,
      variants: typeof r.variants === 'string' ? JSON.parse(r.variants) : r.variants
    });
  } catch (error) {
    console.error('Error updating product stock:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/products/:id (Admin Only)
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── TRANSACTIONS ──────────────────────────────────────────────────────────

// GET /api/transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions ORDER BY date DESC');
    const transactions = result.rows.map(r => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      date: r.date.toISOString ? r.date.toISOString() : r.date,
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
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/transactions - Decrements both total stock and matching variant stock
app.post('/api/transactions', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      id, invoiceNumber, date, cashierName, items, subtotal, tax, discount, total,
      paymentMethod, status, cashGiven, changeAmount, transferBank, transferProofUrl,
      transferProofVerified, transferConfirmedAt, transferConfirmedBy, customerNote
    } = req.body;

    // Deduct stock per item and per variant
    for (const item of items) {
      const prodRes = await client.query('SELECT stock, variants FROM products WHERE id = $1', [item.productId]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        let vars = typeof prod.variants === 'string' ? JSON.parse(prod.variants) : (prod.variants || []);
        if (Array.isArray(vars) && vars.length > 0 && (item.selectedColor || item.selectedSize)) {
          vars = vars.map(v => {
            const matchColor = !item.selectedColor || v.color.toLowerCase() === item.selectedColor.toLowerCase();
            const matchSize = !item.selectedSize || v.size.toLowerCase() === item.selectedSize.toLowerCase();
            if (matchColor && matchSize) {
              return { ...v, stock: Math.max(0, v.stock - item.quantity) };
            }
            return v;
          });
          const newTotalStock = vars.reduce((sum, v) => sum + v.stock, 0);
          await client.query(
            `UPDATE products SET stock = $1, variants = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newTotalStock, JSON.stringify(vars), item.productId]
          );
        } else {
          await client.query(
            `UPDATE products SET stock = GREATEST(0, stock - $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [item.quantity, item.productId]
          );
        }
      }
    }

    const result = await client.query(
      `INSERT INTO transactions (
        id, invoice_number, date, cashier_name, items, subtotal, tax, discount, total,
        payment_method, status, cash_given, change_amount, transfer_bank, transfer_proof_url,
        transfer_proof_verified, transfer_confirmed_at, transfer_confirmed_by, customer_note
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        id, invoiceNumber, date, cashierName, JSON.stringify(items), subtotal, tax || 0, discount || 0, total,
        paymentMethod, status, cashGiven || null, changeAmount || null, transferBank || null, transferProofUrl || null,
        transferProofVerified || false, transferConfirmedAt || null, transferConfirmedBy || null, customerNote || null
      ]
    );

    await client.query('COMMIT');
    const r = result.rows[0];
    res.status(201).json({
      ...req.body,
      id: r.id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// PATCH /api/transactions/:id/confirm
app.patch('/api/transactions/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmedBy } = req.body;
    const now = new Date().toISOString();

    const result = await pool.query(
      `UPDATE transactions
       SET status = 'LUNAS',
           transfer_proof_verified = TRUE,
           transfer_confirmed_at = $1,
           transfer_confirmed_by = $2
       WHERE id = $3
       RETURNING *`,
      [now, confirmedBy || 'Kasir', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true, transaction: result.rows[0] });
  } catch (error) {
    console.error('Error confirming transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/transactions/:id/cancel - Restores product and variant stock
app.patch('/api/transactions/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const txRes = await client.query(`SELECT * FROM transactions WHERE id = $1`, [id]);
    if (txRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const tx = txRes.rows[0];
    const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items;

    // Restore stock per item and per variant
    for (const item of items) {
      const prodRes = await client.query('SELECT stock, variants FROM products WHERE id = $1', [item.productId]);
      if (prodRes.rows.length > 0) {
        const prod = prodRes.rows[0];
        let vars = typeof prod.variants === 'string' ? JSON.parse(prod.variants) : (prod.variants || []);
        if (Array.isArray(vars) && vars.length > 0 && (item.selectedColor || item.selectedSize)) {
          vars = vars.map(v => {
            const matchColor = !item.selectedColor || v.color.toLowerCase() === item.selectedColor.toLowerCase();
            const matchSize = !item.selectedSize || v.size.toLowerCase() === item.selectedSize.toLowerCase();
            if (matchColor && matchSize) {
              return { ...v, stock: v.stock + item.quantity };
            }
            return v;
          });
          const newTotalStock = vars.reduce((sum, v) => sum + v.stock, 0);
          await client.query(
            `UPDATE products SET stock = $1, variants = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newTotalStock, JSON.stringify(vars), item.productId]
          );
        } else {
          await client.query(
            `UPDATE products SET stock = stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [item.quantity, item.productId]
          );
        }
      }
    }

    await client.query(`UPDATE transactions SET status = 'BATAL' WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ success: true, id, status: 'BATAL' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling transaction:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ─── CASHIER PROFILE ───────────────────────────────────────────────────────

// GET /api/cashier
app.get('/api/cashier', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cashier_profile LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({
        id: 'CSH-001',
        name: 'Gusti',
        shift: 'Shift 1 (07:00 - 15:00)',
        outletName: 'ARFA FASHION',
        outletAddress: 'Jl. Merdeka Raya No. 45, Jakarta Pusat',
        outletPhone: '021-5550192',
      });
    }
    const r = result.rows[0];
    res.json({
      id: r.id,
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

// PUT /api/cashier (Admin Only)
app.put('/api/cashier', requireAdmin, async (req, res) => {
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
      id: r.id,
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

// ─── PAYMENT METHODS ───────────────────────────────────────────────────────

// GET /api/payment-methods
app.get('/api/payment-methods', async (req, res) => {
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
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/payment-methods (Admin Only)
app.post('/api/payment-methods', requireAdmin, async (req, res) => {
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
    console.error('Error creating payment method:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/payment-methods/:id (Admin Only)
app.put('/api/payment-methods/:id', requireAdmin, async (req, res) => {
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
    console.error('Error updating payment method:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/payment-methods/:id (Admin Only)
app.delete('/api/payment-methods/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM payment_methods WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Wireless Scanner Polling Endpoints (Vercel & Cloud Compatible) ─────

// HP kirim heartbeat (menandai scanner HP aktif)
app.post('/api/scan/heartbeat', async (req, res) => {
  try {
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
app.post('/api/scan', async (req, res) => {
  try {
    const { session, barcode } = req.body;
    if (!session || !barcode) {
      return res.status(400).json({ error: 'Session code and barcode are required' });
    }
    // Cleanup scans older than 10 minutes
    pool.query(`DELETE FROM pending_scans WHERE scanned_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes'`).catch(() => {});
    
    const result = await pool.query(
      `INSERT INTO pending_scans (session_code, barcode)
       VALUES ($1, $2)
       RETURNING id`,
      [session, barcode.trim()]
    );
    res.status(201).json({ success: true, scanId: result.rows[0].id });
  } catch (error) {
    console.error('Error in /api/scan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Laptop mengambil antrian scan yang belum diproses + cek status koneksi HP
app.get('/api/scan/pending', async (req, res) => {
  try {
    const { session } = req.query;
    if (!session) return res.status(400).json({ error: 'Session code is required' });

    // Cek apakah HP aktif (heartbeat dalam 15 detik terakhir)
    const sessionRes = await pool.query(
      `SELECT (last_heartbeat > CURRENT_TIMESTAMP - INTERVAL '15 seconds') AS is_active
       FROM scanner_sessions WHERE session_code = $1`,
      [session]
    );
    const isScannerConnected = sessionRes.rows.length > 0 && sessionRes.rows[0].is_active === true;

    // Ambil scan yang belum diproses
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
    console.error('Error fetching pending scans:', error);
    res.status(500).json({ error: error.message });
  }
});

// Laptop tandai barcode sudah selesai diproses (disertai info produk jika ketemu)
app.patch('/api/scan/:id/processed', async (req, res) => {
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
    console.error('Error marking scan processed:', error);
    res.status(500).json({ error: error.message });
  }
});

// HP polling acknowledgement (apakah laptop kasir sudah menemukan & menambah produk)
app.get('/api/scan/:id/ack', async (req, res) => {
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
    console.error('Error checking scan ack:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start HTTP & WebSocket Server & Init DB
const startServer = async () => {
  try {
    await initDatabase();
    const server = http.createServer(app);
    setupWebSocketServer(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Neon PostgreSQL POS API & WebSocket Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
};

startServer();
