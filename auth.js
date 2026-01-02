const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');

const router = express.Router();

// Check if any users exist
router.get('/exists', (req, res) => {
  db.get(`SELECT COUNT(*) as cnt FROM users`, [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ exists: row.cnt > 0 });
  });
});

// Register (only allowed when no users exist)
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  // Only allow if no users exist yet
  db.get(`SELECT COUNT(*) as cnt FROM users`, [], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row.cnt > 0) return res.status(403).json({ error: 'registration disabled' });

    const hash = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();
    db.run(`INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)`, [email, hash, createdAt], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      req.session.userId = this.lastID;
      res.json({ id: this.lastID, email, created_at: createdAt });
    });
  });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  db.get(`SELECT id, email, password_hash FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    req.session.userId = user.id;
    res.json({ id: user.id, email: user.email });
  });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Who am I
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  db.get(`SELECT id, email, created_at FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ user: user || null });
  });
});

// Middleware to require auth
function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'unauthorized' });
}

module.exports = { router, requireAuth };