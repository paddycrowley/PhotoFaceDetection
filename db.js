const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbFile = process.env.DATABASE_FILE || path.join(__dirname, '..', 'data.sqlite');

const db = new sqlite3.Database(dbFile);

// Initialize tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      s3_key TEXT NOT NULL,
      s3_url TEXT NOT NULL,
      original_filename TEXT,
      mime TEXT,
      photographer TEXT,
      uploaded_at TEXT,
      FOREIGN KEY(event_id) REFERENCES events(id)
    );
  `);

  // users table for admin auth
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
});

module.exports = db;