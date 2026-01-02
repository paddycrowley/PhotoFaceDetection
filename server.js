require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const db = require('./db');
const { uploadBufferToS3 } = require('./s3');
const { router: authRouter, requireAuth } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// session
app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: '.' }),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // set secure:true when using HTTPS
  })
);

const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');

app.use(cookieParser());
// Use cookie-based CSRF protection so token endpoint works even for unauthenticated users
app.use(csurf({ cookie: true }));

// Rate limiters
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many auth attempts from this IP, please try again later.' });
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many uploads from this IP, please try again later.' });

// Expose an endpoint to fetch CSRF token (returns token, cookie secret is handled by csurf)
app.get('/api/auth/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.use('/api/auth', authLimiter, authRouter);

const upload = multer({ storage: multer.memoryStorage() });

const S3_BUCKET = process.env.S3_BUCKET;
const S3_PREFIX = process.env.S3_PREFIX || 'events';

// Create an event
app.post('/api/events', requireAuth, (req, res) => {
  const { name, date } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  db.run(`INSERT INTO events (name, date) VALUES (?, ?)`, [name, date || null], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, date });
  });
});

// List events
app.get('/api/events', (req, res) => {
  db.all(`SELECT * FROM events ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Upload multiple images for an event
// Fields: photographer (applies to all files) and files[]
app.post('/api/events/:id/images', requireAuth, uploadLimiter, upload.array('files', 20), async (req, res) => {
  const eventId = req.params.id;
  const photographer = req.body.photographer || null;

  // Check event exists
  db.get(`SELECT * FROM events WHERE id = ?`, [eventId], async (err, event) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!event) return res.status(404).json({ error: 'event not found' });

    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'no files uploaded' });

    const results = [];

    for (const file of req.files) {
      const key = `${S3_PREFIX}/${eventId}/${Date.now()}-${file.originalname}`;
      try {
        const url = await uploadBufferToS3(file.buffer, key, file.mimetype, S3_BUCKET);

        const uploadedAt = new Date().toISOString();
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO images (event_id, s3_key, s3_url, original_filename, mime, photographer, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [eventId, key, url, file.originalname, file.mimetype, photographer, uploadedAt],
            function (err) {
              if (err) return reject(err);
              resolve(this.lastID);
            }
          );
        });

        results.push({ filename: file.originalname, url });
      } catch (uploadErr) {
        console.error('upload error', uploadErr);
        results.push({ filename: file.originalname, error: uploadErr.message });
      }
    }

    res.json({ uploaded: results.length, results });
  });
});

// List images for an event
app.get('/api/events/:id/images', (req, res) => {
  const eventId = req.params.id;
  db.all(
    `SELECT id, event_id, s3_url, original_filename, mime, photographer, uploaded_at FROM images WHERE event_id = ? ORDER BY id DESC`,
    [eventId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// CSRF error handler
app.use(function (err, req, res, next) {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'invalid CSRF token' });
  }
  next(err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));