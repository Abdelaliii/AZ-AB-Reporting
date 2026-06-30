import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-this';
const ADMIN_JWT_COOKIE = 'are_admin_token';
const DB_PATH = process.env.DB_PATH || 'orders.db';
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const db = new Database(DB_PATH);

// --- Database Initialization ---
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'user')) NOT NULL DEFAULT 'user',
    security_question TEXT,
    security_answer_hash TEXT
  );

  CREATE TABLE IF NOT EXISTS user_companies (
    user_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE(user_id, company_id)
  );

  CREATE TABLE IF NOT EXISTS orders_initial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    year INTEGER NOT NULL,
    UNIQUE(company_id, year),
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS orders_monthly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, month, year),
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );
`);

// Migration: Add security columns if they don't exist
try { db.exec('ALTER TABLE users ADD COLUMN security_question TEXT'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN security_answer_hash TEXT'); } catch(e) {}

// --- Seed Initial Data ---
const seed = () => {
  const compCount = db.prepare('SELECT count(*) as count FROM companies').get() as { count: number };
  if (compCount.count === 0) {
    const insertCompany = db.prepare('INSERT INTO companies (name) VALUES (?)');
    const c1 = insertCompany.run('Müller GmbH').lastInsertRowid;
    const c2 = insertCompany.run('Schmidt & Co.').lastInsertRowid;
    const c3 = insertCompany.run('Tech AG').lastInsertRowid;

    const insertUser = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    const insertUserCompany = db.prepare('INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)');
    
    const hashedAdmin = bcrypt.hashSync('admin123', 10);
    const hashedUser = bcrypt.hashSync('user123', 10);

    const adminId = insertUser.run('admin', hashedAdmin, 'admin').lastInsertRowid;
    const mId = insertUser.run('mueller_user', hashedUser, 'user').lastInsertRowid;
    const sId = insertUser.run('schmidt_user', hashedUser, 'user').lastInsertRowid;

    insertUserCompany.run(mId, c1);
    insertUserCompany.run(sId, c2);
    
    console.log('Database seeded successfully.');
  }

  // Graceful migration logic if company_id column still exists in users table from old code
  try {
    db.exec(`
      INSERT OR IGNORE INTO user_companies (user_id, company_id)
      SELECT id, company_id FROM users WHERE company_id IS NOT NULL;
    `);
  } catch(e) { /* Column might have been already dropped */ }
};
seed();

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());


  // --- SSO Auth Middleware ---
  // Supports two authentication paths:
  // 1. Normal users: SSO via X-Remote-User header (set by reverse proxy)
  // 2. Admin: Password login via JWT cookie (/api/admin-login)
  const authenticateToken = (req: any, res: any, next: any) => {
    // Path 1: Check for admin JWT cookie (password login)
    const adminToken = req.cookies?.[ADMIN_JWT_COOKIE];
    if (adminToken) {
      try {
        const decoded = jwt.verify(adminToken, JWT_SECRET) as any;
        if (decoded.role !== 'admin') {
          return res.status(403).json({ error: 'Kein Admin-Token' });
        }
        const user = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(decoded.id, 'admin') as any;
        if (!user) return res.status(403).json({ error: 'Admin-Konto nicht gefunden' });
        req.user = { id: user.id, username: user.username, role: user.role, companies: [] };
        return next();
      } catch (e) {
        // Token invalid or expired — fall through to SSO check
        res.clearCookie(ADMIN_JWT_COOKIE);
      }
    }

    // Path 2: SSO via reverse proxy header or oauth2-proxy
    const remoteUser = req.headers['x-remote-user'] || req.headers['x-forwarded-user'] || req.headers['x-forwarded-email'] || process.env.DEV_MOCK_USER;

    if (!remoteUser) {
      return res.status(401).json({ error: 'SSO Header missing' });
    }

    let username = (remoteUser as string).trim();
    if (username.includes('@')) {
      username = username.split('@')[0];
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as any;

    if (!user) {
      return res.status(403).json({ error: `Benutzer nicht für dieses Tool berechtigt: ${username}` });
    }

    const companies = db.prepare(`
      SELECT c.id, c.name FROM user_companies uc 
      JOIN companies c ON uc.company_id = c.id 
      WHERE uc.user_id = ?
    `).all(user.id);

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      companies: companies
    };
    next();
  };

  // --- API Routes ---

  // ADMIN PASSWORD LOGIN (bypasses SSO, sets HttpOnly cookie)
  app.post('/api/admin-login', (req: any, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as any;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Ungültige Anmeldedaten oder kein Admin-Konto' });
    }

    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordValid) {
      return res.status(403).json({ error: 'Falsches Passwort' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
    res.cookie(ADMIN_JWT_COOKIE, token, {
      httpOnly: true,
      secure: false, // Set to false so it works over HTTP (e.g. http://10.101.53.7:3000)
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    });
    res.json({ success: true, user: { id: user.id, username: user.username, role: 'admin', companies: [] } });
  });

  // ADMIN LOGOUT (clears cookie)
  app.post('/api/admin-logout', (req: any, res) => {
    res.clearCookie(ADMIN_JWT_COOKIE);
    res.json({ success: true });
  });

  // GET ME (SSO Initialization for Frontend)
  app.get('/api/me', authenticateToken, (req: any, res) => {
    res.json({ user: req.user });
  });

  // GET MY COMPANY DATA
  app.get('/api/company-data', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Nur für Gesellschafts-User' });
    
    // For specific multiple company filtering, we would expect a user to pass ?company_id=
    // But safely return all their accessible records.
    const ids = (req.user.companies || []).map((c:any) => c.id).join(',') || '0';
    const initial = db.prepare(`SELECT * FROM orders_initial WHERE company_id IN (${ids})`).all();
    const monthly = db.prepare(`SELECT * FROM orders_monthly WHERE company_id IN (${ids}) ORDER BY year DESC, month DESC`).all();

    res.json({ initial, monthly });
  });

  // SAVE INITIAL BACKLOG
  app.post('/api/orders/initial', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Nur für Gesellschafts-User' });
    const { amount, year, company_id } = req.body;

    if (!(req.user.companies || []).find((c:any) => c.id === company_id)) {
      if (req.user.company_id !== company_id) { // Fallback legacy
        return res.status(403).json({ error: 'Fehlende Berechtigung für diese Gesellschaft' });
      }
    }

    try {
      db.prepare(`
        INSERT INTO orders_initial (company_id, amount, year) 
        VALUES (?, ?, ?)
        ON CONFLICT(company_id, year) 
        DO UPDATE SET amount = excluded.amount
      `).run(company_id, amount, year);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: 'Fehler beim Speichern' });
    }
  });

  // SAVE MONTHLY ORDERS
  app.post('/api/orders/monthly', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Nur für Gesellschafts-User' });
    const { amount, month, year, company_id } = req.body;

    if (!(req.user.companies || []).find((c:any) => c.id === company_id)) {
      if (req.user.company_id !== company_id) { // Fallback legacy
        return res.status(403).json({ error: 'Fehlende Berechtigung für diese Gesellschaft' });
      }
    }

    try {
      db.prepare(`
        INSERT INTO orders_monthly (company_id, amount, month, year) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(company_id, month, year) 
        DO UPDATE SET amount = excluded.amount
      `).run(company_id, amount, month, year);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: 'Fehler beim Speichern' });
    }
  });

  // ADMIN DASHBOARD DATA
  app.get('/api/admin/overview', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const companies = db.prepare('SELECT * FROM companies').all();
    const reports = db.prepare(`
      SELECT m.*, c.name as company_name 
      FROM orders_monthly m
      JOIN companies c ON m.company_id = c.id
      ORDER BY m.year DESC, m.month DESC
    `).all();

    const initials = db.prepare(`
      SELECT i.*, c.name as company_name
      FROM orders_initial i
      JOIN companies c ON i.company_id = c.id
    `).all();

    res.json({ companies, reports, initials });
  });

  // ADMIN USERS MANAGEMENT
  app.get('/api/admin/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const usersList = db.prepare(`
      SELECT u.id, u.username, u.role, 
             json_group_array(json_object('id', c.id, 'name', c.name)) as companies_json
      FROM users u 
      LEFT JOIN user_companies uc ON u.id = uc.user_id
      LEFT JOIN companies c ON uc.company_id = c.id
      GROUP BY u.id
    `).all() as any[];
    
    // Parse JSON
    const parsed = usersList.map(u => ({
      ...u,
      companies: JSON.parse(u.companies_json).filter((c:any) => c.id !== null)
    }));
    
    res.json({ users: parsed });
  });

  app.post('/api/admin/users', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { username, role, company_ids } = req.body;
    
    try {
      db.transaction(() => {
        // Dummy hash because column is NOT NULL
        const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, 'SSO', role);
        const newId = result.lastInsertRowid;
        
        if (company_ids && Array.isArray(company_ids)) {
           const stmt = db.prepare('INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)');
           for (const cid of company_ids) stmt.run(newId, parseInt(cid));
        }
      })();
      res.json({ success: true });
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: 'Benutzername existiert bereits.' });
      } else {
        res.status(500).json({ error: 'Fehler beim Erstellen des Nutzers' });
      }
    }
  });

  app.put('/api/admin/users/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { id } = req.params;
    const { username, role, company_ids } = req.body;
    
    try {
      db.transaction(() => {
        db.prepare('UPDATE users SET username = ?, role = ? WHERE id = ?').run(username, role, id);
        
        // Rewrite companies
        db.prepare('DELETE FROM user_companies WHERE user_id = ?').run(id);
        if (company_ids && Array.isArray(company_ids)) {
           const stmt = db.prepare('INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)');
           for (const cid of company_ids) stmt.run(id, parseInt(cid));
        }
      })();
      res.json({ success: true });
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: 'Benutzername existiert bereits.' });
      } else {
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Nutzers' });
      }
    }
  });

  app.delete('/api/admin/users/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    db.transaction(() => {
      db.prepare('DELETE FROM user_companies WHERE user_id = ?').run(req.params.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    })();
    res.json({ success: true });
  });

  // ADMIN COMPANIES MANAGEMENT
  app.get('/api/admin/companies', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const companies = db.prepare('SELECT * FROM companies').all();
    res.json({ companies });
  });

  app.post('/api/admin/companies', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { name } = req.body;
    
    try {
      db.prepare('INSERT INTO companies (name) VALUES (?)').run(name);
      res.json({ success: true });
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: 'Gesellschaft existiert bereits.' });
      } else {
        res.status(500).json({ error: 'Fehler beim Erstellen der Gesellschaft' });
      }
    }
  });

  app.put('/api/admin/companies/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { id } = req.params;
    const { name } = req.body;
    try {
      db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(name, id);
      res.json({ success: true });
    } catch (e: any) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(400).json({ error: 'Gesellschaft existiert bereits.' });
      } else {
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Gesellschaft' });
      }
    }
  });

  app.delete('/api/admin/companies/:id', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    try {
      db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: 'Fehler beim Löschen' });
    }
  });

  // DATA QUERY (for Analytics)
  app.get('/api/query', authenticateToken, (req: any, res) => {
    const { year, company_id } = req.query;
    
    let baseMonthlyQuery = `
      SELECT m.*, c.name as company_name 
      FROM orders_monthly m
      JOIN companies c ON m.company_id = c.id
      WHERE 1=1
    `;
    let baseInitialQuery = `
      SELECT i.*, c.name as company_name 
      FROM orders_initial i
      JOIN companies c ON i.company_id = c.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    const initialParams: any[] = [];

    // Filter by year if provided
    if (year) {
      baseMonthlyQuery += ` AND m.year = ?`;
      baseInitialQuery += ` AND i.year = ?`;
      params.push(parseInt(year));
      initialParams.push(parseInt(year));
    }

    // Role-based filtering or explicit company filtering
    if (req.user.role !== 'admin') {
      if (company_id && company_id !== 'all') {
        const parsedCid = parseInt(company_id);
        if (!(req.user.companies || []).find((c:any) => c.id === parsedCid)) {
          return res.status(403).json({ error: 'Unzulässige Gesellschaft' });
        }
        baseMonthlyQuery += ` AND m.company_id = ?`;
        baseInitialQuery += ` AND i.company_id = ?`;
        params.push(parsedCid);
        initialParams.push(parsedCid);
      } else {
        const ids = (req.user.companies || []).map((c:any) => c.id).join(',') || '0';
        baseMonthlyQuery += ` AND m.company_id IN (${ids})`;
        baseInitialQuery += ` AND i.company_id IN (${ids})`;
      }
    } else if (company_id && company_id !== 'all') {
      baseMonthlyQuery += ` AND m.company_id = ?`;
      baseInitialQuery += ` AND i.company_id = ?`;
      params.push(parseInt(company_id));
      initialParams.push(parseInt(company_id));
    }

    baseMonthlyQuery += ` ORDER BY m.year ASC, m.month ASC`;

    const monthlyData = db.prepare(baseMonthlyQuery).all(...params);
    const initialData = db.prepare(baseInitialQuery).all(...initialParams);

    // Grouping by company and year/month could be done here or in frontend
    res.json({ monthly: monthlyData, initial: initialData });
  });

  // --- Vite Setup ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
