import express from 'express';
import cors from 'cors';
import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { rateLimit } from 'express-rate-limit';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ WARNING: DATABASE_URL environment variable is not defined.');
}

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

const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  console.error('FATAL: AUTH_SECRET environment variable is not set. Server cannot start securely.');
  process.exit(1);
}

export const createToken = (user) => {
  const payload = JSON.stringify({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  });
  const b64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(b64Payload).digest('base64url');
  return `${b64Payload}.${signature}`;
};

const verifyToken = (token) => {
  if (!token) return null;
  const clean = token.replace(/^Bearer\s+/i, '').trim();
  const parts = clean.split('.');
  if (parts.length !== 2) return null;
  const [b64Payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(b64Payload).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  if (!authHeader) {
    req.user = null;
    return next();
  }
  req.user = verifyToken(authHeader);
  next();
};

const requireAdmin = (req, res, next) => {
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

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];
  const user = verifyToken(authHeader);
  if (!user) {
    return res.status(401).json({
      error: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.',
      code: 'UNAUTHORIZED'
    });
  }
  req.user = user;
  next();
};

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
  skipSuccessfulRequests: true,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(authenticate);

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

// ── Auth Endpoints ─────────────────────────────────────────────────────────

router.post('/auth/login', loginRateLimiter, async (req, res) => {
  try {
    const { username, password, portal } = req.body;
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Username dan kata sandi wajib diisi.' });
    }
    if (username.length > 100 || password.length > 200) {
      return res.status(400).json({ error: 'Input tidak valid.' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );

    // Always run bcrypt.compare to prevent timing attacks (even when user not found)
    const dummyHash = '$2b$10$invalidhashfortimingprotection00000000000000000000';
    const storedHash = result.rows.length > 0 ? result.rows[0].password : dummyHash;
    const isPasswordValid = await bcrypt.compare(password, storedHash);

    if (result.rows.length === 0 || !isPasswordValid) {
      return res.status(401).json({ error: 'Username atau kata sandi tidak cocok.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Akun Anda dinonaktifkan oleh Administrator.' });
    }

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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

router.get('/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir.' });
  }
  res.json({ user: req.user });
});

// ── Cashier Attendance (Absensi + Modal Kas + Tutup Kas) ───────────────────

const getJakartaDateString = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
};

const formatAttendanceRow = (r, stats = null) => {
  let dateStr = r.date;
  if (r.date instanceof Date) {
    dateStr = r.date.toISOString().slice(0, 10);
  } else if (typeof r.date === 'string' && r.date.includes('T')) {
    dateStr = r.date.slice(0, 10);
  }

  const resolvedStats = stats || {
    totalTransactions: r.total_transactions != null ? parseInt(r.total_transactions, 10) : 0,
    totalRevenue: r.total_sales != null ? parseFloat(r.total_sales) : 0,
    cashSales: r.total_cash != null ? parseFloat(r.total_cash) : 0,
    qrisSales: r.total_qris != null ? parseFloat(r.total_qris) : 0,
    transferSales: r.total_transfer != null ? parseFloat(r.total_transfer) : 0,
    otherSales: 0,
    expectedCash: r.expected_cash != null ? parseFloat(r.expected_cash) : parseFloat(r.opening_cash || 500000)
  };

  return {
    id: r.id,
    userId: r.user_id,
    cashierName: r.cashier_name || r.name || 'Gusti',
    date: dateStr,
    checkIn: r.check_in,
    checkOut: r.check_out || null,
    openingCash: parseFloat(r.opening_cash || 500000),
    expectedCash: r.expected_cash != null ? parseFloat(r.expected_cash) : (resolvedStats?.expectedCash != null ? resolvedStats.expectedCash : parseFloat(r.opening_cash || 500000)),
    actualCash: r.actual_cash != null ? parseFloat(r.actual_cash) : null,
    cashDifference: r.cash_difference != null ? parseFloat(r.cash_difference) : null,
    status: r.status,
    note: r.note || null,
    closedBy: r.closed_by || null,
    stats: resolvedStats
  };
};

// GET /api/attendance/today — Kasir/Admin melihat status absensi hari ini
router.get('/attendance/today', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Sesi tidak valid.' });
    const today = getJakartaDateString();
    const isSuperAdmin = req.user.role === 'super_admin';
    const userId = req.user.id;

    const query = isSuperAdmin
      ? `SELECT ca.*, COALESCE(ca.cashier_name, u.name, 'Gusti') AS cashier_name
         FROM cashier_attendances ca
         LEFT JOIN users u ON u.id = ca.user_id
         WHERE ca.date = $1
         ORDER BY ca.check_in DESC
         LIMIT 1`
      : `SELECT ca.*, COALESCE(ca.cashier_name, u.name, 'Gusti') AS cashier_name
         FROM cashier_attendances ca
         LEFT JOIN users u ON u.id = ca.user_id
         WHERE ca.user_id = $1 AND ca.date = $2
         LIMIT 1`;
    const params = isSuperAdmin ? [today] : [userId, today];

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.json({ status: 'not_started', attendance: null });
    }

    const row = result.rows[0];

    let stats = null;
    if (row.status === 'working' || row.status === 'completed') {
      const txResult = await pool.query(
        `SELECT payment_method, SUM(total) as total_amount, COUNT(*) as tx_count
         FROM transactions
         WHERE attendance_id = $1 AND status = 'LUNAS'
         GROUP BY payment_method`,
        [row.id]
      );

      let cashSales = 0, transferSales = 0, qrisSales = 0, totalRevenue = 0, totalTx = 0;
      for (const tx of txResult.rows) {
        const amount = Math.round(Number(tx.total_amount));
        const count = parseInt(tx.tx_count, 10);
        totalRevenue += amount;
        totalTx += count;
        const methodUpper = (tx.payment_method || '').toUpperCase();
        if (methodUpper === 'TUNAI') cashSales += amount;
        else if (methodUpper.includes('QRIS')) qrisSales += amount;
        else transferSales += amount;
      }

      const openingCash = Math.round(Number(row.opening_cash || 500000));
      const expectedCash = row.status === 'completed' && row.expected_cash != null
        ? Math.round(Number(row.expected_cash))
        : openingCash + cashSales;

      stats = {
        totalTransactions: row.status === 'completed' && row.total_transactions != null ? parseInt(row.total_transactions, 10) : totalTx,
        totalRevenue: row.status === 'completed' && row.total_sales != null ? Math.round(Number(row.total_sales)) : totalRevenue,
        cashSales: row.status === 'completed' && row.total_cash != null ? Math.round(Number(row.total_cash)) : cashSales,
        qrisSales: row.status === 'completed' && row.total_qris != null ? Math.round(Number(row.total_qris)) : qrisSales,
        transferSales: row.status === 'completed' && row.total_transfer != null ? Math.round(Number(row.total_transfer)) : transferSales,
        otherSales: 0,
        expectedCash
      };
    }

    return res.json({
      status: row.status,
      attendance: formatAttendanceRow(row, stats)
    });
  } catch (error) {
    console.error('Error in GET /api/attendance/today:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/attendance/check-in — Kasir Absen Masuk (Modal Kas Awal Rp500.000 Tetap)
router.post('/attendance/check-in', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Sesi tidak valid.' });
    if (req.user.role === 'super_admin') {
      return res.status(403).json({ error: 'Admin tidak perlu absen kasir.' });
    }

    const today = getJakartaDateString();
    const userId = req.user.id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT * FROM cashier_attendances WHERE user_id = $1 AND date = $2 FOR UPDATE',
        [userId, today]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        await client.query('COMMIT');
        if (row.status === 'working') {
          return res.status(400).json({ 
            error: 'Anda sudah absen masuk hari ini. Silakan tutup kas terlebih dahulu.',
            code: 'SESSION_ALREADY_OPEN',
            attendance: formatAttendanceRow(row)
          });
        }
        if (row.status === 'completed') {
          return res.status(400).json({ 
            error: 'Hari kerja hari ini sudah ditutup. Absen ulang tidak diizinkan.',
            code: 'SESSION_ALREADY_CLOSED',
            attendance: formatAttendanceRow(row)
          });
        }
      }

      const userResult = await client.query('SELECT name FROM users WHERE id = $1', [userId]);
      const cashierName = userResult.rows[0]?.name || req.user.name || 'Gusti';

      const id = `ATT-${Date.now()}`;
      const OPENING_CASH = 500000;

      const result = await client.query(
        `INSERT INTO cashier_attendances (id, user_id, cashier_name, date, check_in, opening_cash, status)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, 'working')
         RETURNING *`,
        [id, userId, cashierName, today, OPENING_CASH]
      );

      await client.query('COMMIT');

      const row = result.rows[0];
      row.cashier_name = cashierName;

      console.log(`✅ Check-in: ${cashierName} (${userId}) pada ${today}`);

      return res.status(201).json({
        success: true,
        attendance: formatAttendanceRow(row, {
          totalTransactions: 0,
          totalRevenue: 0,
          cashSales: 0,
          qrisSales: 0,
          transferSales: 0,
          otherSales: 0,
          expectedCash: OPENING_CASH
        })
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in POST /api/attendance/check-in:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/attendance/check-out — Kasir Tutup Kas Harian (Atomic & Concurrency-Safe)
router.post('/attendance/check-out', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Sesi tidak valid.' });
    if (req.user.role === 'super_admin') {
      return res.status(403).json({ error: 'Admin tidak perlu tutup kas kasir.' });
    }

    const { actualCash, note } = req.body;

    // Strict validation of cash_actual (Step 16)
    if (
      actualCash === null ||
      actualCash === undefined ||
      typeof actualCash === 'boolean' ||
      isNaN(Number(actualCash)) ||
      !isFinite(Number(actualCash)) ||
      Number(actualCash) < 0
    ) {
      return res.status(400).json({ error: 'Jumlah kas fisik harus diisi dengan angka valid dan tidak boleh negatif.' });
    }

    const actualCashInt = Math.round(Number(actualCash));
    const today = getJakartaDateString();
    const userId = req.user.id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sessionRes = await client.query(
        'SELECT * FROM cashier_attendances WHERE user_id = $1 AND date = $2 FOR UPDATE',
        [userId, today]
      );

      if (sessionRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Anda belum melakukan absen masuk hari ini.' });
      }

      const row = sessionRes.rows[0];

      if (row.status === 'completed') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Hari kerja sudah ditutup sebelumnya. Tutup kas hanya dapat dilakukan satu kali per hari.' });
      }

      const txResult = await client.query(
        `SELECT payment_method, SUM(total) as total_amount, COUNT(*) as tx_count
         FROM transactions
         WHERE attendance_id = $1 AND status = 'LUNAS'
         GROUP BY payment_method`,
        [row.id]
      );

      let totalRevenue = 0;
      let totalTx = 0;
      let cashSales = 0;
      let qrisSales = 0;
      let transferSales = 0;

      for (const tx of txResult.rows) {
        const amount = Math.round(Number(tx.total_amount));
        const count = parseInt(tx.tx_count, 10);
        totalRevenue += amount;
        totalTx += count;

        const methodUpper = (tx.payment_method || '').toUpperCase();
        if (methodUpper === 'TUNAI') {
          cashSales += amount;
        } else if (methodUpper.includes('QRIS')) {
          qrisSales += amount;
        } else {
          transferSales += amount;
        }
      }

      const openingCash = Math.round(Number(row.opening_cash || 500000));
      const expectedCash = openingCash + cashSales;
      const cashDifference = actualCashInt - expectedCash;

      if (cashDifference !== 0 && (!note || typeof note !== 'string' || note.trim().length < 3)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Terdapat selisih kas sebesar ${cashDifference >= 0 ? '+' : ''}Rp${Math.abs(cashDifference).toLocaleString('id-ID')}. Keterangan wajib diisi (min. 3 karakter).`
        });
      }

      const closedByName = req.user.name || row.cashier_name || 'Gusti';

      const updateResult = await client.query(
        `UPDATE cashier_attendances
         SET check_out = CURRENT_TIMESTAMP,
             expected_cash = $1,
             actual_cash = $2,
             cash_difference = $3,
             total_transactions = $4,
             total_sales = $5,
             total_cash = $6,
             total_transfer = $7,
             total_qris = $8,
             closed_by = $9,
             status = 'completed',
             note = $10,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $11
         RETURNING *`,
        [
          expectedCash,
          actualCashInt,
          cashDifference,
          totalTx,
          totalRevenue,
          cashSales,
          transferSales,
          qrisSales,
          closedByName,
          note ? note.trim() : null,
          row.id
        ]
      );

      await client.query('COMMIT');

      const updatedRow = updateResult.rows[0];
      const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
      updatedRow.cashier_name = userResult.rows[0]?.name || closedByName;

      console.log(`✅ Tutup Kas: ${updatedRow.cashier_name} pada ${today} | Expected: ${expectedCash} | Actual: ${actualCashInt} | Selisih: ${cashDifference}`);

      const closingStats = {
        totalTransactions: totalTx,
        totalRevenue,
        cashSales,
        qrisSales,
        transferSales,
        otherSales: 0,
        expectedCash
      };

      res.json({
        success: true,
        attendance: formatAttendanceRow(updatedRow, closingStats)
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in POST /api/attendance/check-out:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/attendance/summary-today — Ringkasan kas hari ini (untuk Dashboard kasir & admin)
router.get('/attendance/summary-today', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const today = getJakartaDateString();
    const userId = req.user.role === 'super_admin' ? null : req.user.id;

    const query = userId
      ? `SELECT ca.*, COALESCE(ca.cashier_name, u.name, 'Gusti') AS cashier_name
         FROM cashier_attendances ca
         LEFT JOIN users u ON u.id = ca.user_id
         WHERE ca.user_id = $1 AND ca.date = $2
         LIMIT 1`
      : `SELECT ca.*, COALESCE(ca.cashier_name, u.name, 'Gusti') AS cashier_name
         FROM cashier_attendances ca
         LEFT JOIN users u ON u.id = ca.user_id
         WHERE ca.date = $1
         ORDER BY ca.check_in DESC
         LIMIT 1`;
    const params = userId ? [userId, today] : [today];

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.json({
        status: 'not_started',
        cashierName: 'Gusti',
        date: today,
        openingCash: 500000,
        revenueToday: 0,
        totalTransactions: 0,
        cashSales: 0,
        transferSales: 0,
        qrisSales: 0,
        expectedCash: 500000,
        actualCash: null,
        cashDifference: null,
        note: null,
        attendance: null,
        stats: null
      });
    }

    const row = result.rows[0];

    const txResult = await pool.query(
      `SELECT payment_method, SUM(total) as total_amount, COUNT(*) as tx_count
       FROM transactions
       WHERE attendance_id = $1 AND status = 'LUNAS'
       GROUP BY payment_method`,
      [row.id]
    );

    let cashSales = 0, transferSales = 0, qrisSales = 0, totalRevenue = 0, totalTx = 0;
    for (const tx of txResult.rows) {
      const amount = Math.round(Number(tx.total_amount));
      const count = parseInt(tx.tx_count, 10);
      totalRevenue += amount;
      totalTx += count;
      const methodUpper = (tx.payment_method || '').toUpperCase();
      if (methodUpper === 'TUNAI') cashSales += amount;
      else if (methodUpper.includes('QRIS')) qrisSales += amount;
      else transferSales += amount;
    }

    const openingCash = Math.round(Number(row.opening_cash || 500000));
    const computedExpectedCash = openingCash + cashSales;
    const finalExpectedCash = row.status === 'completed' && row.expected_cash != null
      ? Math.round(Number(row.expected_cash))
      : computedExpectedCash;

    const stats = {
      totalTransactions: row.status === 'completed' && row.total_transactions != null ? parseInt(row.total_transactions, 10) : totalTx,
      totalRevenue: row.status === 'completed' && row.total_sales != null ? Math.round(Number(row.total_sales)) : totalRevenue,
      cashSales: row.status === 'completed' && row.total_cash != null ? Math.round(Number(row.total_cash)) : cashSales,
      qrisSales: row.status === 'completed' && row.total_qris != null ? Math.round(Number(row.total_qris)) : qrisSales,
      transferSales: row.status === 'completed' && row.total_transfer != null ? Math.round(Number(row.total_transfer)) : transferSales,
      otherSales: 0,
      expectedCash: finalExpectedCash
    };

    res.json({
      status: row.status,
      cashierName: row.cashier_name || 'Gusti',
      date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
      checkIn: row.check_in,
      checkOut: row.check_out,
      openingCash,
      revenueToday: stats.totalRevenue,
      totalTransactions: stats.totalTransactions,
      cashSales: stats.cashSales,
      qrisSales: stats.qrisSales,
      transferSales: stats.transferSales,
      expectedCash: finalExpectedCash,
      actualCash: row.actual_cash != null ? Math.round(Number(row.actual_cash)) : null,
      cashDifference: row.cash_difference != null ? Math.round(Number(row.cash_difference)) : null,
      note: row.note || null,
      attendance: formatAttendanceRow(row, stats),
      stats
    });
  } catch (error) {
    console.error('Error in GET /api/attendance/summary-today:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/attendance/laporan (Admin only)
router.get('/attendance/laporan', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate || getJakartaDateString();
    const end = endDate || getJakartaDateString();

    const result = await pool.query(
      `SELECT ca.*, u.name AS cashier_name
       FROM cashier_attendances ca
       JOIN users u ON u.id = ca.user_id
       WHERE ca.date BETWEEN $1 AND $2
       ORDER BY ca.date DESC, ca.check_in ASC`,
      [start, end]
    );

    const rows = result.rows;
    if (rows.length === 0) {
      return res.json({ attendances: [], total: 0 });
    }

    // Eliminate N+1: Aggregate all transaction stats in a single grouped query
    const attendanceIds = rows.map(r => r.id);
    const txResult = await pool.query(
      `SELECT attendance_id, payment_method, SUM(total) as total_amount, COUNT(*) as tx_count
       FROM transactions
       WHERE attendance_id = ANY($1::varchar[]) AND status = 'LUNAS'
       GROUP BY attendance_id, payment_method`,
      [attendanceIds]
    );

    const statsMap = new Map();
    for (const tx of txResult.rows) {
      let stat = statsMap.get(tx.attendance_id);
      if (!stat) {
        stat = { cashSales: 0, transferSales: 0, qrisSales: 0, totalRevenue: 0, totalTx: 0 };
        statsMap.set(tx.attendance_id, stat);
      }
      const amount = parseFloat(tx.total_amount);
      const count = parseInt(tx.tx_count, 10);
      stat.totalRevenue += amount;
      stat.totalTx += count;
      const methodUpper = (tx.payment_method || '').toUpperCase();
      if (methodUpper === 'TUNAI') stat.cashSales += amount;
      else if (methodUpper.includes('QRIS')) stat.qrisSales += amount;
      else stat.transferSales += amount;
    }

    const attendanceList = [];
    for (const row of rows) {
      const s = statsMap.get(row.id) || { cashSales: 0, transferSales: 0, qrisSales: 0, totalRevenue: 0, totalTx: 0 };
      const openingCash = parseFloat(row.opening_cash || 500000);
      const expectedCash = openingCash + s.cashSales;
      const stats = {
        totalTransactions: s.totalTx,
        totalRevenue: s.totalRevenue,
        cashSales: s.cashSales,
        qrisSales: s.qrisSales,
        transferSales: s.transferSales,
        otherSales: 0,
        expectedCash
      };
      attendanceList.push(formatAttendanceRow(row, stats));
    }

    res.json({ attendances: attendanceList, total: attendanceList.length });
  } catch (error) {
    console.error('Error in GET /api/attendance/laporan:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── REPORTS & DASHBOARD (ADMIN ONLY) ──────────────────────────────────────

// Helper to parse report period and date ranges (WIB / Asia/Jakarta)
const parseReportPeriod = (period, startDate, endDate) => {
  const getJakartaToday = () => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  };
  const todayStr = getJakartaToday();
  const [y, m, d] = todayStr.split('-').map(Number);

  let start = startDate ? String(startDate).trim() : null;
  let end = endDate ? String(endDate).trim() : null;

  const p = (period || '').toUpperCase();
  if (p === 'TODAY') {
    start = todayStr;
    end = todayStr;
  } else if (p === 'YESTERDAY') {
    const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
    start = yesterday.toISOString().slice(0, 10);
    end = start;
  } else if (p === 'THIS_WEEK') {
    const current = new Date(Date.UTC(y, m - 1, d));
    const day = current.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(Date.UTC(y, m - 1, d + diff));
    start = monday.toISOString().slice(0, 10);
    end = todayStr;
  } else if (p === 'THIS_MONTH') {
    start = `${y}-${String(m).padStart(2, '0')}-01`;
    end = todayStr;
  } else if (!start && !end) {
    start = `${y}-${String(m).padStart(2, '0')}-01`;
    end = todayStr;
  } else {
    if (!start) start = end;
    if (!end) end = start;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(start) || !dateRegex.test(end)) {
    return { error: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.' };
  }

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  return {
    period: p || 'CUSTOM',
    startDate: start,
    endDate: end,
    startIso: `${start}T00:00:00+07:00`,
    endIso: `${end}T23:59:59.999+07:00`
  };
};

// GET /api/reports/summary — Backend-driven sales, payments, & cashiers aggregation
router.get('/reports/summary', requireAdmin, async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const range = parseReportPeriod(period, startDate, endDate);
    if (range.error) {
      return res.status(400).json({ error: range.error });
    }

    const [salesResult, itemsResult, paymentResult, cashierResult] = await Promise.all([
      // 1. Sales aggregate (only status = 'LUNAS' counted in sales)
      pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status='LUNAS') as total_completed,
          COUNT(*) FILTER (WHERE status='BATAL') as total_cancelled,
          COUNT(*) FILTER (WHERE status='MENUNGGU_KONFIRMASI') as total_pending,
          COALESCE(SUM(total) FILTER (WHERE status='LUNAS'), 0) as total_sales,
          COALESCE(SUM(subtotal) FILTER (WHERE status='LUNAS'), 0) as total_subtotal,
          COALESCE(SUM(discount) FILTER (WHERE status='LUNAS'), 0) as total_discount,
          COALESCE(SUM(tax) FILTER (WHERE status='LUNAS'), 0) as total_tax,
          COALESCE(SUM(total) FILTER (WHERE status='LUNAS' AND UPPER(payment_method)='TUNAI'), 0) as cash_sales,
          COALESCE(SUM(total) FILTER (WHERE status='LUNAS' AND UPPER(payment_method) LIKE '%QRIS%'), 0) as qris_sales,
          COALESCE(SUM(total) FILTER (WHERE status='LUNAS' AND UPPER(payment_method) NOT IN ('TUNAI') AND UPPER(payment_method) NOT LIKE '%QRIS%'), 0) as transfer_sales
        FROM transactions
        WHERE date >= $1 AND date <= $2
      `, [range.startIso, range.endIso]),

      // 2. Total items sold (JSONB array unnest)
      pool.query(`
        SELECT COALESCE(SUM((item->>'quantity')::int), 0) as total_items_sold
        FROM transactions t,
        jsonb_array_elements(CASE WHEN jsonb_typeof(t.items) = 'array' THEN t.items ELSE '[]'::jsonb END) as item
        WHERE t.status = 'LUNAS'
          AND t.date >= $1 AND t.date <= $2
      `, [range.startIso, range.endIso]),

      // 3. Payment methods breakdown
      pool.query(`
        SELECT 
          payment_method as name,
          COUNT(*)::int as count,
          COALESCE(SUM(total), 0)::numeric as total
        FROM transactions
        WHERE status = 'LUNAS'
          AND date >= $1 AND date <= $2
        GROUP BY payment_method
        ORDER BY total DESC
      `, [range.startIso, range.endIso]),

      // 4. Cashiers breakdown
      pool.query(`
        SELECT 
          cashier_name as name,
          COUNT(*)::int as count,
          COALESCE(SUM(total), 0)::numeric as total
        FROM transactions
        WHERE status = 'LUNAS'
          AND date >= $1 AND date <= $2
        GROUP BY cashier_name
        ORDER BY total DESC
      `, [range.startIso, range.endIso]),
    ]);

    const salesRow = salesResult.rows[0] || {};
    const totalRevenue = Math.round(Number(salesRow.total_sales || 0));
    const totalCompleted = parseInt(salesRow.total_completed || '0', 10);
    const totalCancelled = parseInt(salesRow.total_cancelled || '0', 10);
    const totalPending = parseInt(salesRow.total_pending || '0', 10);
    const cashSales = Math.round(Number(salesRow.cash_sales || 0));
    const qrisSales = Math.round(Number(salesRow.qris_sales || 0));
    const transferSales = Math.round(Number(salesRow.transfer_sales || 0));
    const totalSubtotal = Math.round(Number(salesRow.total_subtotal || 0));
    const totalDiscount = Math.round(Number(salesRow.total_discount || 0));
    const totalTax = Math.round(Number(salesRow.total_tax || 0));

    const totalItemsSold = parseInt(itemsResult.rows[0]?.total_items_sold || '0', 10);
    const averageTransactionValue = totalCompleted > 0 ? Math.round(totalRevenue / totalCompleted) : 0;

    const paymentMethods = paymentResult.rows.map(r => {
      const tot = Math.round(Number(r.total));
      return {
        name: r.name || 'Lainnya',
        count: parseInt(r.count, 10),
        total: tot,
        percentage: totalRevenue > 0 ? Number(((tot / totalRevenue) * 100).toFixed(1)) : 0
      };
    });

    const cashiers = cashierResult.rows.map(r => {
      const tot = Math.round(Number(r.total));
      return {
        name: r.name || 'Kasir',
        count: parseInt(r.count, 10),
        total: tot,
        percentage: totalRevenue > 0 ? Number(((tot / totalRevenue) * 100).toFixed(1)) : 0
      };
    });

    res.json({
      period: {
        period: range.period,
        startDate: range.startDate,
        endDate: range.endDate
      },
      summary: {
        totalRevenue,
        totalTransactionCount: totalCompleted,
        totalCancelledCount: totalCancelled,
        totalPendingCount: totalPending,
        totalItemsSold,
        averageTransactionValue,
        cashSales,
        transferSales,
        qrisSales,
        totalSubtotal,
        totalDiscount,
        totalTax
      },
      paymentMethods,
      cashiers
    });
  } catch (error) {
    console.error('Error in GET /api/reports/summary:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat ringkasan laporan.' });
  }
});

// GET /api/reports/top-products — Top bestselling products by quantity or revenue
router.get('/reports/top-products', requireAdmin, async (req, res) => {
  try {
    const { period, startDate, endDate, limit, sortBy } = req.query;
    const range = parseReportPeriod(period, startDate, endDate);
    if (range.error) {
      return res.status(400).json({ error: range.error });
    }

    let lim = parseInt(limit, 10);
    if (isNaN(lim) || lim < 1) lim = 10;
    if (lim > 50) lim = 50;

    const sortOrder = sortBy === 'revenue' ? 'total_revenue DESC, total_qty DESC' : 'total_qty DESC, total_revenue DESC';

    const result = await pool.query(`
      SELECT 
        item->>'productId' as product_id,
        item->>'name' as product_name,
        COALESCE(item->>'brand', 'ARFA FASHION') as brand,
        SUM((item->>'quantity')::int) as total_qty,
        SUM((item->>'subtotal')::numeric) as total_revenue
      FROM transactions t,
      jsonb_array_elements(CASE WHEN jsonb_typeof(t.items) = 'array' THEN t.items ELSE '[]'::jsonb END) as item
      WHERE t.status = 'LUNAS'
        AND t.date >= $1 AND t.date <= $2
      GROUP BY item->>'productId', item->>'name', COALESCE(item->>'brand', 'ARFA FASHION')
      ORDER BY ${sortOrder}
      LIMIT $3
    `, [range.startIso, range.endIso, lim]);

    const products = result.rows.map(r => ({
      productId: r.product_id,
      name: r.product_name,
      brand: r.brand,
      quantity: parseInt(r.total_qty, 10),
      revenue: Math.round(Number(r.total_revenue))
    }));

    res.json({
      period: {
        period: range.period,
        startDate: range.startDate,
        endDate: range.endDate
      },
      products
    });
  } catch (error) {
    console.error('Error in GET /api/reports/top-products:', error);
    res.status(500).json({ error: error.message || 'Gagal memuat produk terlaris.' });
  }
});

// ── User Management ────────────────────────────────────────────────────────

router.get('/users', requireAdmin, async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

router.post('/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, kata sandi, dan nama wajib diisi.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Kata sandi minimal 8 karakter.' });
    }
    const cleanUser = username.trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(username) = $1', [cleanUser]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `Username "${cleanUser}" sudah digunakan.` });
    }

    const id = `USR-${Date.now().toString().slice(-4)}`;
    const roleVal = role === 'super_admin' ? 'super_admin' : 'kasir';
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (id, username, password, name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, username, name, role, is_active, created_at`,
      [id, cleanUser, hashedPassword, name.trim(), roleVal]
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
    res.status(500).json({ error: error.message });
  }
});

router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, name, role, isActive } = req.body;

    if (password && password.length < 8) {
      return res.status(400).json({ error: 'Kata sandi baru minimal 8 karakter.' });
    }

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 12);
    }

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
      [username ? username.trim().toLowerCase() : null, hashedPassword, name ? name.trim() : null, role || null, typeof isActive === 'boolean' ? isActive : null, id]
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
    res.status(500).json({ error: error.message });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user && req.user.id === id) {
      return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    }
    const adminCount = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'super_admin'");
    const target = await pool.query("SELECT role FROM users WHERE id = $1", [id]);
    if (target.rows.length > 0 && target.rows[0].role === 'super_admin' && parseInt(adminCount.rows[0].count, 10) <= 1) {
      return res.status(400).json({ error: 'Tidak dapat menghapus satu-satunya akun Super Admin.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Store Settings ─────────────────────────────────────────────────────────

router.get('/settings', async (req, res) => {
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

router.put('/settings', requireAdmin, async (req, res) => {
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

// ── Products ───────────────────────────────────────────────────────────────

router.get('/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    const isAdmin = req.user && req.user.role === 'super_admin';
    const products = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      price: parseFloat(r.price),
      // Only expose costPrice to authenticated admins
      ...(isAdmin ? { costPrice: r.cost_price ? parseFloat(r.cost_price) : 0 } : {}),
      stock: parseInt(r.stock, 10),
      barcode: r.barcode,
      unit: r.unit || 'Pcs',
      colors: typeof r.colors === 'string' ? JSON.parse(r.colors) : (r.colors || []),
      sizes: typeof r.sizes === 'string' ? JSON.parse(r.sizes) : (r.sizes || []),
      variants: typeof r.variants === 'string' ? JSON.parse(r.variants) : (r.variants || []),
    }));
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Variant Helpers ────────────────────────────────────────────────────────
export const validateProductVariantStock = (prod) => {
  const vars = Array.isArray(prod.variants) ? prod.variants : [];
  if (vars.length > 0) {
    const sum = vars.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
    if (sum !== Number(prod.stock)) {
      return false;
    }
  }
  return true;
};

export const hasDuplicateVariants = (variants) => {
  if (!Array.isArray(variants) || variants.length === 0) return false;
  const seen = new Set();
  for (const v of variants) {
    const color = (v.color || '').trim().toLowerCase();
    const size = (v.size || '').trim().toLowerCase();
    const key = `${color}__${size}`;
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
};

router.post('/products', requireAdmin, async (req, res) => {
  try {
    const { name, brand, category, price, costPrice, stock, barcode, unit, colors, sizes, variants } = req.body;
    if (variants && Array.isArray(variants) && hasDuplicateVariants(variants)) {
      return res.status(400).json({ error: 'Kombinasi warna dan ukuran variant sudah ada.' });
    }
    const finalStock = (variants && Array.isArray(variants) && variants.length > 0)
      ? variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
      : (stock || 0);

    const id = `PRD-${Date.now().toString().slice(-4)}`;
    const result = await pool.query(
      `INSERT INTO products (id, name, brand, category, price, cost_price, stock, barcode, unit, colors, sizes, variants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id, name, brand, category, price, costPrice || 0, finalStock, barcode, unit || 'Pcs',
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
    res.status(500).json({ error: error.message });
  }
});

router.put('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, category, price, costPrice, stock, barcode, unit, colors, sizes, variants } = req.body;
    if (variants && Array.isArray(variants) && hasDuplicateVariants(variants)) {
      return res.status(400).json({ error: 'Kombinasi warna dan ukuran variant sudah ada.' });
    }
    const finalStock = (variants && Array.isArray(variants) && variants.length > 0)
      ? variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
      : stock;

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
        name, brand, category, price, costPrice, finalStock, barcode, unit,
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
    res.status(500).json({ error: error.message });
  }
});

router.patch('/products/:id/stock', requireAdmin, async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

router.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Transactions ───────────────────────────────────────────────────────────

router.get('/transactions', requireAuth, async (req, res) => {
  try {
    // 1. Pagination parameters (defaults: page=1, limit=20, max limit=100)
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100;

    const offset = (page - 1) * limit;

    // 2. Query conditions and parameters
    const conditions = [];
    const params = [];
    let pIdx = 1;

    // Role-based scoping (Phase 2 security rule preserved)
    const isAdmin = req.user && (req.user.role === 'super_admin' || req.user.role === 'admin');
    if (!isAdmin) {
      conditions.push(`(user_id = $${pIdx} OR attendance_id IN (SELECT id FROM cashier_attendances WHERE user_id = $${pIdx}) OR cashier_name = $${pIdx + 1})`);
      params.push(req.user.id, req.user.name);
      pIdx += 2;
    }

    // Optional Date filtering
    const { startDate, endDate, status, paymentMethod, invoice, search } = req.query;
    if (startDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate).trim())) {
        return res.status(400).json({ error: 'Format startDate tidak valid. Gunakan format YYYY-MM-DD.' });
      }
      conditions.push(`date >= $${pIdx}`);
      params.push(`${String(startDate).trim()}T00:00:00+07:00`);
      pIdx++;
    }

    if (endDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) {
        return res.status(400).json({ error: 'Format endDate tidak valid. Gunakan format YYYY-MM-DD.' });
      }
      conditions.push(`date <= $${pIdx}`);
      params.push(`${String(endDate).trim()}T23:59:59.999+07:00`);
      pIdx++;
    }

    // Optional Status filtering
    if (status && String(status).trim().toUpperCase() !== 'ALL' && String(status).trim().toUpperCase() !== 'SEMUA') {
      conditions.push(`status = $${pIdx}`);
      params.push(String(status).trim().toUpperCase());
      pIdx++;
    }

    // Optional Payment Method filtering
    if (paymentMethod && String(paymentMethod).trim().toUpperCase() !== 'ALL' && String(paymentMethod).trim().toUpperCase() !== 'SEMUA') {
      const pmUpper = String(paymentMethod).trim().toUpperCase();
      if (pmUpper === 'TUNAI' || pmUpper === 'CASH') {
        conditions.push(`UPPER(payment_method) = 'TUNAI'`);
      } else if (pmUpper === 'QRIS') {
        conditions.push(`UPPER(payment_method) LIKE '%QRIS%'`);
      } else if (pmUpper === 'TRANSFER') {
        conditions.push(`(UPPER(payment_method) NOT IN ('TUNAI') AND UPPER(payment_method) NOT LIKE '%QRIS%')`);
      } else {
        conditions.push(`UPPER(payment_method) = $${pIdx}`);
        params.push(pmUpper);
        pIdx++;
      }
    }

    // Optional Invoice/Customer/Search filter
    const searchQuery = String(search || invoice || '').trim();
    if (searchQuery) {
      conditions.push(`(invoice_number ILIKE $${pIdx} OR customer_name ILIKE $${pIdx})`);
      params.push(`%${searchQuery}%`);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 3. Count query (uses exact same scoping and filters)
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM transactions ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);
    const totalPages = Math.ceil(total / limit) || 1;

    // 4. Data query with deterministic ordering (ORDER BY date DESC, id DESC)
    const dataParams = [...params, limit, offset];
    const dataQuery = `SELECT * FROM transactions ${whereClause} ORDER BY date DESC, id DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
    const result = await pool.query(dataQuery, dataParams);

    const transactions = result.rows.map(r => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      date: r.date instanceof Date ? r.date.toISOString() : (r.date?.toISOString ? r.date.toISOString() : r.date),
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
      customerName: r.customer_name || undefined,
      customerPhone: r.customer_phone || undefined,
      attendanceId: r.attendance_id || undefined,
      userId: r.user_id || undefined,
    }));

    res.json({
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('[GET /transactions ERROR]:', error);
    res.status(500).json({ error: 'Gagal memuat data transaksi.' });
  }
});

const getJakartaDate = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
};

router.post('/transactions', requireAuth, async (req, res) => {
  // ── 1. Idempotency Check (Early return on duplicated submit) ──
  const idempotencyKey = String(
    req.headers['idempotency-key'] ||
    req.headers['x-idempotency-key'] ||
    req.body.idempotencyKey ||
    ''
  ).trim();

  if (idempotencyKey) {
    try {
      const existing = await pool.query(
        'SELECT response_body FROM idempotency_keys WHERE key = $1',
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        return res.status(200).json(existing.rows[0].response_body);
      }
    } catch (err) {
      console.error('[Idempotency Pre-Check Error]:', err);
    }
  }

  // ── 2. Request Payload Validation ──
  const {
    items,
    paymentMethod,
    cashGiven,
    discount,
    transferBank,
    transferProofUrl,
    transferProofVerified,
    customerNote,
    customerName,
    customerPhone
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Permintaan tidak valid: Daftar item belanja tidak boleh kosong.' });
  }

  if (items.length > 100) {
    return res.status(400).json({ error: 'Permintaan tidak valid: Jumlah item melebihi batas maksimum (100 item).' });
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item.productId !== 'string' || !item.productId.trim()) {
      return res.status(400).json({ error: `Permintaan tidak valid: Item ke-${i + 1} tidak memiliki productId yang valid.` });
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 1000) {
      return res.status(400).json({ error: `Permintaan tidak valid: Jumlah (quantity) untuk produk "${item.productId}" harus berupa bilangan bulat antara 1 dan 1000.` });
    }
  }

  if (typeof paymentMethod !== 'string' || !paymentMethod.trim()) {
    return res.status(400).json({ error: 'Permintaan tidak valid: Metode pembayaran wajib diisi.' });
  }

  const rawDiscount = Number(discount || 0);
  if (isNaN(rawDiscount) || !isFinite(rawDiscount) || rawDiscount < 0) {
    return res.status(400).json({ error: 'Permintaan tidak valid: Nilai diskon tidak boleh negatif atau tidak valid.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 3. Validate Payment Method Whitelist from DB ──
    const pmRes = await client.query('SELECT name, type FROM payment_methods WHERE is_active = true');
    const matchedMethod = pmRes.rows.find(
      m => m.name.toLowerCase() === paymentMethod.trim().toLowerCase()
    );

    if (!matchedMethod) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Metode pembayaran "${paymentMethod}" tidak valid atau tidak aktif.` });
    }

    // ── 4. Attendance Validation ──
    const todayJakarta = getJakartaDate();
    const cashierUserId = req.user.id;

    const attRes = await client.query(
      `SELECT * FROM cashier_attendances WHERE user_id = $1 AND date = $2 LIMIT 1`,
      [cashierUserId, todayJakarta]
    );

    let activeAttendanceId = null;

    if (attRes.rows.length === 0) {
      if (req.user && req.user.role === 'super_admin') {
        activeAttendanceId = null;
      } else {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'Transaksi ditolak: Anda belum melakukan Absen Masuk hari ini. Silakan mulai hari kerja terlebih dahulu.',
          code: 'ATTENDANCE_NOT_STARTED'
        });
      }
    } else {
      const att = attRes.rows[0];
      if (att.status === 'completed') {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'Transaksi ditolak: Hari kerja Anda hari ini sudah selesai.',
          code: 'ATTENDANCE_COMPLETED'
        });
      }
      activeAttendanceId = att.id;
    }

    // ── 5. Lock Product Rows (Deadlock-free via Sorted Product IDs) ──
    const uniqueProductIds = [...new Set(items.map(it => it.productId.trim()))].sort();
    const prodLockRes = await client.query(
      `SELECT id, name, price, stock, variants, brand, barcode, unit, cost_price
       FROM products
       WHERE id = ANY($1)
       FOR UPDATE`,
      [uniqueProductIds]
    );

    const productMap = new Map();
    for (const row of prodLockRes.rows) {
      productMap.set(row.id, {
        ...row,
        price: Math.round(Number(row.price)),
        stock: parseInt(row.stock, 10),
        variants: typeof row.variants === 'string' ? JSON.parse(row.variants) : (row.variants || [])
      });
    }

    // Verify all products exist
    for (const item of items) {
      if (!productMap.has(item.productId.trim())) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Produk dengan ID "${item.productId}" tidak ditemukan di database.` });
      }
    }

    // ── 6. Process Stock, Recalculate Subtotal (Backend Source of Truth) ──
    // Verify product variant stock consistency before transaction
    for (const prod of productMap.values()) {
      if (!validateProductVariantStock(prod)) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Stok variant produk "${prod.name}" tidak konsisten.`,
          code: 'STOCK_INCONSISTENCY'
        });
      }
    }

    let calculatedSubtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const prod = productMap.get(item.productId.trim());
      const itemPrice = prod.price; // Official DB price
      const itemSubtotal = itemPrice * item.quantity;
      calculatedSubtotal += itemSubtotal;

      const vars = Array.isArray(prod.variants) ? prod.variants : [];
      const hasVariantRequested = Boolean(item.variantId || item.selectedColor || item.selectedSize);

      if (hasVariantRequested) {
        if (vars.length === 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: `Variant produk "${prod.name}" tidak ditemukan.`,
            code: 'VARIANT_NOT_FOUND'
          });
        }

        let variantIndex = -1;
        if (item.variantId) {
          // Priority 1: Match by exact variantId
          variantIndex = vars.findIndex(v => v.id === item.variantId);
        } else {
          // Priority 2: Match by color + size
          variantIndex = vars.findIndex(v => {
            const matchColor = !item.selectedColor || (v.color && v.color.toLowerCase() === item.selectedColor.trim().toLowerCase());
            const matchSize = !item.selectedSize || (v.size && v.size.toLowerCase() === item.selectedSize.trim().toLowerCase());
            return matchColor && matchSize;
          });
        }

        if (variantIndex === -1) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: `Variant produk "${prod.name}" tidak ditemukan.`,
            code: 'VARIANT_NOT_FOUND'
          });
        }

        const matchedVar = vars[variantIndex];
        if (matchedVar.stock < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: `Stok tidak mencukupi untuk "${prod.name} (${matchedVar.color || ''} ${matchedVar.size || ''})". Stok tersedia: ${matchedVar.stock}, diminta: ${item.quantity}.`,
            code: 'INSUFFICIENT_STOCK'
          });
        }

        matchedVar.stock -= item.quantity;
        prod.stock = vars.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

        verifiedItems.push({
          productId: prod.id,
          name: prod.name,
          brand: prod.brand || '',
          price: itemPrice,
          quantity: item.quantity,
          subtotal: itemSubtotal,
          selectedColor: item.selectedColor ? String(item.selectedColor).trim() : (matchedVar.color || undefined),
          selectedSize: item.selectedSize ? String(item.selectedSize).trim() : (matchedVar.size || undefined),
          variantId: matchedVar.id,
        });
      } else {
        // Plain product without variants
        if (prod.stock < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: `Stok tidak mencukupi untuk produk "${prod.name}". Stok tersedia: ${prod.stock}, diminta: ${item.quantity}.`,
            code: 'INSUFFICIENT_STOCK'
          });
        }
        prod.stock -= item.quantity;

        verifiedItems.push({
          productId: prod.id,
          name: prod.name,
          brand: prod.brand || '',
          price: itemPrice,
          quantity: item.quantity,
          subtotal: itemSubtotal,
        });
      }
    }

    // ── 7. Calculate Discount, Tax, and Final Total ──
    const verifiedSubtotal = Math.round(calculatedSubtotal);
    let verifiedDiscount = Math.round(rawDiscount);
    if (verifiedDiscount > verifiedSubtotal) {
      verifiedDiscount = verifiedSubtotal;
    }
    const verifiedTax = 0;
    const verifiedTotal = Math.max(0, verifiedSubtotal - verifiedDiscount + verifiedTax);

    // ── 8. Payment Specific Validation ──
    let txStatus = 'LUNAS';
    let finalCashGiven = null;
    let finalChangeAmount = null;
    let confirmedAt = null;
    let confirmedBy = null;

    if (matchedMethod.type === 'TUNAI') {
      const given = Math.round(Number(cashGiven));
      if (isNaN(given) || !isFinite(given) || given < verifiedTotal) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Nominal tunai yang diberikan (Rp ${(given || 0).toLocaleString('id-ID')}) kurang dari total belanja (Rp ${verifiedTotal.toLocaleString('id-ID')}).`
        });
      }
      finalCashGiven = given;
      finalChangeAmount = Math.round(given - verifiedTotal);
      txStatus = 'LUNAS';
    } else {
      // TRANSFER / QRIS
      finalCashGiven = null;
      finalChangeAmount = null;
      if (transferProofVerified === true) {
        txStatus = 'LUNAS';
        confirmedAt = new Date().toISOString();
        confirmedBy = req.user.name;
      } else {
        txStatus = 'MENUNGGU_KONFIRMASI';
        confirmedAt = null;
        confirmedBy = null;
      }
    }

    // ── 9. Update Product Stocks in DB ──
    for (const prod of productMap.values()) {
      const updRes = await client.query(
        `UPDATE products
         SET stock = $1, variants = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND stock >= 0`,
        [prod.stock, JSON.stringify(prod.variants), prod.id]
      );
      if (updRes.rowCount === 0) {
        throw new Error(`Integritas stok gagal diperbarui untuk produk ID ${prod.id}`);
      }
    }

    // ── 10. Concurrency-Safe Invoice Generation via PostgreSQL Sequence ──
    const seqRes = await client.query("SELECT nextval('invoice_seq') as seq");
    const seqNum = String(seqRes.rows[0].seq).padStart(4, '0');
    const todayCompact = todayJakarta.replace(/-/g, '');
    const invoiceNumber = `INV-${todayCompact}-${seqNum}`;
    const transactionId = `TRX-${Date.now()}-${seqNum}`;
    const txDate = new Date().toISOString();

    // ── 11. Insert Transaction into Database (No DDL at runtime) ──
    const insertRes = await client.query(
      `INSERT INTO transactions (
        id, invoice_number, date, cashier_name, items, subtotal, tax, discount, total,
        payment_method, status, cash_given, change_amount, transfer_bank, transfer_proof_url,
        transfer_proof_verified, transfer_confirmed_at, transfer_confirmed_by, customer_note,
        customer_name, customer_phone, attendance_id, user_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      ) RETURNING *`,
      [
        transactionId,
        invoiceNumber,
        txDate,
        req.user.name,
        JSON.stringify(verifiedItems),
        verifiedSubtotal,
        verifiedTax,
        verifiedDiscount,
        verifiedTotal,
        matchedMethod.name,
        txStatus,
        finalCashGiven,
        finalChangeAmount,
        transferBank ? String(transferBank).trim() : null,
        transferProofUrl ? String(transferProofUrl).trim() : null,
        Boolean(transferProofVerified),
        confirmedAt,
        confirmedBy,
        customerNote ? String(customerNote).trim() : null,
        customerName ? String(customerName).trim() : null,
        customerPhone ? String(customerPhone).trim() : null,
        activeAttendanceId,
        req.user.id
      ]
    );

    const r = insertRes.rows[0];
    const responsePayload = {
      id: r.id,
      invoiceNumber: r.invoice_number,
      date: r.date instanceof Date ? r.date.toISOString() : r.date,
      cashierName: r.cashier_name,
      items: verifiedItems,
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
      customerName: r.customer_name || undefined,
      customerPhone: r.customer_phone || undefined,
      attendanceId: r.attendance_id || undefined,
      userId: r.user_id || undefined,
    };

    // ── 12. Save Idempotency Key ──
    if (idempotencyKey) {
      await client.query(
        `INSERT INTO idempotency_keys (key, transaction_id, response_body)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING`,
        [idempotencyKey, transactionId, JSON.stringify(responsePayload)]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json(responsePayload);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[POST /transactions ERROR]:', error);
    return res.status(500).json({ error: 'Transaksi gagal diproses. Silakan coba kembali.' });
  } finally {
    client.release();
  }
});

router.patch('/transactions/:id/confirm', requireAdmin, async (req, res) => {
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
      [confirmedBy || req.user.name || 'Admin', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    }
    res.json({ success: true, transaction: result.rows[0] });
  } catch (error) {
    console.error('[PATCH /confirm ERROR]:', error);
    res.status(500).json({ error: 'Gagal mengonfirmasi transaksi.' });
  }
});

router.patch('/transactions/:id/cancel', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const txRes = await client.query(`SELECT * FROM transactions WHERE id = $1 FOR UPDATE`, [id]);
    if (txRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
    }

    const tx = txRes.rows[0];
    if (tx.status === 'BATAL') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Transaksi ini sudah dibatalkan sebelumnya.' });
    }
    const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items;

    // Lock all involved products in deterministic sorted order to prevent deadlocks
    const uniqueProdIds = [...new Set(items.map(it => it.productId.trim()))].sort();
    const prodLockRes = await client.query(
      `SELECT id, name, stock, variants FROM products WHERE id = ANY($1) FOR UPDATE`,
      [uniqueProdIds]
    );

    const prodMap = new Map();
    for (const r of prodLockRes.rows) {
      prodMap.set(r.id, {
        id: r.id,
        name: r.name,
        stock: parseInt(r.stock, 10),
        variants: typeof r.variants === 'string' ? JSON.parse(r.variants) : (r.variants || [])
      });
    }

    for (const item of items) {
      const prod = prodMap.get(item.productId.trim());
      if (!prod) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Produk ID "${item.productId}" untuk pengembalian stok tidak ditemukan.` });
      }

      const vars = Array.isArray(prod.variants) ? prod.variants : [];
      const hasVariantInfo = Boolean(item.variantId || item.selectedColor || item.selectedSize);

      if (hasVariantInfo) {
        if (vars.length === 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Variant untuk pengembalian stok tidak ditemukan.',
            code: 'VARIANT_NOT_FOUND_CANCEL'
          });
        }

        let variantIndex = -1;
        if (item.variantId) {
          // Primary: search strictly by variantId
          variantIndex = vars.findIndex(v => v.id === item.variantId);
          if (variantIndex === -1) {
            // DO NOT fallback to color/size if variantId was specified but not found
            await client.query('ROLLBACK');
            return res.status(409).json({
              error: 'Variant untuk pengembalian stok tidak ditemukan.',
              code: 'VARIANT_NOT_FOUND_CANCEL'
            });
          }
        } else {
          // Backward compatibility fallback for legacy transactions: search by color + size
          variantIndex = vars.findIndex(v => {
            const matchColor = !item.selectedColor || (v.color && v.color.toLowerCase() === item.selectedColor.trim().toLowerCase());
            const matchSize = !item.selectedSize || (v.size && v.size.toLowerCase() === item.selectedSize.trim().toLowerCase());
            return matchColor && matchSize;
          });
          if (variantIndex === -1) {
            await client.query('ROLLBACK');
            return res.status(409).json({
              error: 'Variant untuk pengembalian stok tidak ditemukan.',
              code: 'VARIANT_NOT_FOUND_CANCEL'
            });
          }
        }

        vars[variantIndex].stock = (Number(vars[variantIndex].stock) || 0) + item.quantity;
        prod.stock = vars.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      } else {
        // Plain product without variants
        prod.stock += item.quantity;
      }
    }

    // Persist all restored products in DB
    for (const prod of prodMap.values()) {
      await client.query(
        `UPDATE products SET stock = $1, variants = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [prod.stock, JSON.stringify(prod.variants), prod.id]
      );
    }

    await client.query(`UPDATE transactions SET status = 'BATAL' WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ success: true, id, status: 'BATAL' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PATCH /cancel ERROR]:', error);
    res.status(500).json({ error: 'Gagal membatalkan transaksi.' });
  } finally {
    client.release();
  }
});


router.get('/cashier', async (req, res) => {
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

router.put('/cashier', requireAdmin, async (req, res) => {
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

// ── Payment Methods ────────────────────────────────────────────────────────

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

router.post('/payment-methods', requireAdmin, async (req, res) => {
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

router.put('/payment-methods/:id', requireAdmin, async (req, res) => {
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

router.delete('/payment-methods/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM payment_methods WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Wireless Scanner Polling Endpoints ─────────────────────────────────────

let isScannerTableReady = false;
const ensureScannerTables = async () => {
  if (isScannerTableReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scanner_sessions (
        session_code VARCHAR(50) PRIMARY KEY,
        last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        device_name VARCHAR(100)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_scans (
        id SERIAL PRIMARY KEY,
        session_code VARCHAR(50) NOT NULL,
        barcode VARCHAR(100) NOT NULL,
        scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE,
        product_name VARCHAR(255),
        product_price NUMERIC(15, 2),
        success BOOLEAN
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pending_scans_session ON pending_scans (session_code, processed)
    `);
    isScannerTableReady = true;
  } catch (e) {
    console.error('Error ensuring scanner tables:', e);
  }
};

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

app.use('/api', router);
app.use('/', router);

export default app;
