const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'adeldadel-admin';

// Database setup
const db = new Database(path.join(__dirname, 'sparring.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    notes TEXT,
    is_available INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL REFERENCES slots(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    experience_level TEXT,
    message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

app.use(express.json());
app.use(express.static(__dirname));

// Middleware: check admin key
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.admin_key;
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// --- Public routes ---

// GET /api/slots — list all available slots
app.get('/api/slots', (req, res) => {
  const slots = db.prepare(`
    SELECT id, date, time, duration_minutes, notes
    FROM slots
    WHERE is_available = 1
      AND date >= date('now')
    ORDER BY date, time
  `).all();
  res.json(slots);
});

// POST /api/bookings — book a slot
app.post('/api/bookings', (req, res) => {
  const { slot_id, name, email, phone, experience_level, message } = req.body;

  if (!slot_id || !name || !email) {
    return res.status(400).json({ error: 'slot_id, name, and email are required' });
  }

  // Check slot is available
  const slot = db.prepare('SELECT * FROM slots WHERE id = ? AND is_available = 1').get(slot_id);
  if (!slot) {
    return res.status(409).json({ error: 'Slot is no longer available' });
  }

  const insert = db.transaction(() => {
    db.prepare(`
      INSERT INTO bookings (slot_id, name, email, phone, experience_level, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(slot_id, name, email, phone || null, experience_level || null, message || null);

    db.prepare('UPDATE slots SET is_available = 0 WHERE id = ?').run(slot_id);
  });

  insert();
  res.json({ success: true, message: `Booking confirmed for ${slot.date} at ${slot.time}` });
});

// --- Admin routes ---

// GET /api/admin/slots — all slots (including booked)
app.get('/api/admin/slots', requireAdmin, (req, res) => {
  const slots = db.prepare(`
    SELECT s.*, b.name AS booked_by, b.email AS booked_email, b.phone AS booked_phone,
           b.experience_level, b.message AS booking_message, b.created_at AS booked_at
    FROM slots s
    LEFT JOIN bookings b ON b.slot_id = s.id
    ORDER BY s.date, s.time
  `).all();
  res.json(slots);
});

// POST /api/admin/slots — create time slot(s)
app.post('/api/admin/slots', requireAdmin, (req, res) => {
  const { slots } = req.body; // array of { date, time, duration_minutes?, notes? }
  if (!Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ error: 'Provide a "slots" array' });
  }

  const insert = db.prepare(`
    INSERT INTO slots (date, time, duration_minutes, notes)
    VALUES (?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    for (const s of items) {
      if (!s.date || !s.time) throw new Error('Each slot needs date and time');
      insert.run(s.date, s.time, s.duration_minutes || 60, s.notes || null);
    }
  });

  insertMany(slots);
  res.json({ success: true, created: slots.length });
});

// DELETE /api/admin/slots/:id — remove a slot
app.delete('/api/admin/slots/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM slots WHERE id = ?').run(id);
  res.json({ success: true });
});

// GET /api/admin/bookings — all bookings
app.get('/api/admin/bookings', requireAdmin, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, s.date, s.time, s.duration_minutes
    FROM bookings b
    JOIN slots s ON s.id = b.slot_id
    ORDER BY s.date, s.time
  `).all();
  res.json(bookings);
});

app.listen(PORT, () => {
  console.log(`Sparring booking server running on http://localhost:${PORT}`);
  console.log(`Admin key: ${ADMIN_KEY}`);
});
