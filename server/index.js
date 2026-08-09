const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'clearar.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    avg_days_to_pay INTEGER DEFAULT 30
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    amount REAL NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    days_past_due INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS discount_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER REFERENCES invoices(id),
    discount_pct REAL NOT NULL,
    discount_amount REAL NOT NULL,
    discounted_amount REAL NOT NULL,
    expiry_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    accepted_at TEXT
  );
`);

// ── Seed ─────────────────────────────────────────────────────────────────────
function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
  if (count > 0) return;

  const today = new Date();
  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r.toISOString().slice(0, 10);
  }

  // 5 customers
  const insertCustomer = db.prepare(
    'INSERT INTO customers (name, email, avg_days_to_pay) VALUES (?, ?, ?)'
  );
  const customers = [
    { name: 'Meridian Industrial', email: 'ar@meridianindustrial.com', avg: 15 },
    { name: 'Apex Logistics Group', email: 'finance@apexlogistics.com', avg: 28 },
    { name: 'BlueSky Technologies', email: 'accounts@bluesky.tech', avg: 38 },
    { name: 'Granite Construction', email: 'payables@graniteconstruction.com', avg: 52 },
    { name: 'Pinnacle Retail Co.', email: 'ap@pinnacleretail.com', avg: 65 },
  ];
  const customerIds = customers.map(c => {
    const r = insertCustomer.run(c.name, c.email, c.avg);
    return r.lastInsertRowid;
  });

  // 15 invoices
  const insertInvoice = db.prepare(
    `INSERT INTO invoices (invoice_number, customer_id, amount, due_date, status, days_past_due)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const invoiceData = [
    // 5 current (due in future)
    { cIdx: 0, num: 'INV-1001', amount: 4200,  dueDays: +14, status: 'open' },
    { cIdx: 1, num: 'INV-1002', amount: 8750,  dueDays: +7,  status: 'open' },
    { cIdx: 2, num: 'INV-1003', amount: 2100,  dueDays: +21, status: 'open' },
    { cIdx: 3, num: 'INV-1004', amount: 15500, dueDays: +30, status: 'open' },
    { cIdx: 4, num: 'INV-1005', amount: 3800,  dueDays: +5,  status: 'open' },
    // 5 overdue 1–30 days
    { cIdx: 0, num: 'INV-1006', amount: 6300,  dueDays: -12, status: 'overdue' },
    { cIdx: 1, num: 'INV-1007', amount: 9400,  dueDays: -5,  status: 'overdue' },
    { cIdx: 2, num: 'INV-1008', amount: 1850,  dueDays: -22, status: 'overdue' },
    { cIdx: 3, num: 'INV-1009', amount: 22000, dueDays: -18, status: 'overdue' },
    { cIdx: 4, num: 'INV-1010', amount: 500,   dueDays: -8,  status: 'overdue' },
    // 3 overdue 31–60 days
    { cIdx: 1, num: 'INV-1011', amount: 11200, dueDays: -45, status: 'overdue' },
    { cIdx: 3, num: 'INV-1012', amount: 7600,  dueDays: -33, status: 'overdue' },
    { cIdx: 4, num: 'INV-1013', amount: 18900, dueDays: -55, status: 'overdue' },
    // 2 overdue 60+ days
    { cIdx: 2, num: 'INV-1014', amount: 24500, dueDays: -75, status: 'overdue' },
    { cIdx: 0, num: 'INV-1015', amount: 13100, dueDays: -90, status: 'overdue' },
  ];

  const invoiceIds = invoiceData.map(inv => {
    const dueDate = addDays(today, inv.dueDays);
    const daysPastDue = Math.max(0, -inv.dueDays);
    const r = insertInvoice.run(inv.num, customerIds[inv.cIdx], inv.amount, dueDate, inv.status, daysPastDue);
    return r.lastInsertRowid;
  });

  // 3 discount offers: active, accepted, expired
  const insertOffer = db.prepare(
    `INSERT INTO discount_offers (invoice_id, discount_pct, discount_amount, discounted_amount, expiry_date, status, accepted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  // Active offer on INV-1011 (index 10)
  const activeInv = invoiceData[10];
  const activePct = 1.5;
  const activeAmt = 11200 * activePct / 100;
  insertOffer.run(invoiceIds[10], activePct, activeAmt, 11200 - activeAmt, addDays(today, 7), 'active', null);

  // Accepted offer on INV-1012 (index 11)
  const accPct = 2.0;
  const accAmt = 7600 * accPct / 100;
  insertOffer.run(invoiceIds[11], accPct, accAmt, 7600 - accAmt, addDays(today, -3), 'accepted', new Date().toISOString());
  db.prepare("UPDATE invoices SET status = 'paid' WHERE id = ?").run(invoiceIds[11]);

  // Expired offer on INV-1013 (index 12)
  const expPct = 2.5;
  const expAmt = 18900 * expPct / 100;
  insertOffer.run(invoiceIds[12], expPct, expAmt, 18900 - expAmt, addDays(today, -10), 'expired', null);

  console.log('Database seeded with sample data.');
}

seedIfEmpty();

// ── Express App ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// GET /api/invoices — all invoices JOIN customers, sorted by days_past_due DESC
app.get('/api/invoices', (req, res) => {
  const invoices = db.prepare(`
    SELECT
      i.*,
      c.name AS customer_name,
      c.email AS customer_email,
      c.avg_days_to_pay,
      d.id AS offer_id,
      d.discount_pct AS offer_pct,
      d.discount_amount AS offer_discount_amount,
      d.discounted_amount AS offer_discounted_amount,
      d.expiry_date AS offer_expiry,
      d.status AS offer_status,
      d.accepted_at AS offer_accepted_at,
      d.created_at AS offer_created_at
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN discount_offers d ON d.invoice_id = i.id
      AND d.status IN ('active', 'accepted')
    ORDER BY i.days_past_due DESC
  `).all();
  res.json(invoices);
});

// POST /api/offers
app.post('/api/offers', (req, res) => {
  const { invoice_id, discount_pct, expiry_date } = req.body;
  if (!invoice_id || !discount_pct || !expiry_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (!['open', 'overdue'].includes(invoice.status)) {
    return res.status(400).json({ error: 'Invoice must be open or overdue' });
  }

  const existing = db.prepare(
    "SELECT id FROM discount_offers WHERE invoice_id = ? AND status = 'active'"
  ).get(invoice_id);
  if (existing) return res.status(400).json({ error: 'Active offer already exists for this invoice' });

  const discount_amount = invoice.amount * discount_pct / 100;
  const discounted_amount = invoice.amount - discount_amount;

  const result = db.prepare(
    `INSERT INTO discount_offers (invoice_id, discount_pct, discount_amount, discounted_amount, expiry_date)
     VALUES (?, ?, ?, ?, ?)`
  ).run(invoice_id, discount_pct, discount_amount, discounted_amount, expiry_date);

  const offer = db.prepare('SELECT * FROM discount_offers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(offer);
});

// POST /api/offers/:id/accept
app.post('/api/offers/:id/accept', (req, res) => {
  const offer = db.prepare('SELECT * FROM discount_offers WHERE id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });

  db.prepare(
    "UPDATE discount_offers SET status = 'accepted', accepted_at = ? WHERE id = ?"
  ).run(new Date().toISOString(), offer.id);

  db.prepare("UPDATE invoices SET status = 'paid' WHERE id = ?").run(offer.invoice_id);

  const updated = db.prepare('SELECT * FROM discount_offers WHERE id = ?').get(offer.id);
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(offer.invoice_id);
  res.json({ offer: updated, invoice });
});

// POST /api/offers/:id/withdraw
app.post('/api/offers/:id/withdraw', (req, res) => {
  const offer = db.prepare('SELECT * FROM discount_offers WHERE id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });

  db.prepare("UPDATE discount_offers SET status = 'withdrawn' WHERE id = ?").run(offer.id);
  const updated = db.prepare('SELECT * FROM discount_offers WHERE id = ?').get(offer.id);
  res.json(updated);
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
  const total_open_ar = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS v FROM invoices WHERE status IN ('open', 'overdue')"
  ).get().v;

  const overdue_amount = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) AS v FROM invoices WHERE days_past_due > 0 AND status != 'paid'"
  ).get().v;

  const active_offers = db.prepare(
    "SELECT COUNT(*) AS v FROM discount_offers WHERE status = 'active'"
  ).get().v;

  const cash_accelerated = db.prepare(
    "SELECT COALESCE(SUM(discounted_amount), 0) AS v FROM discount_offers WHERE status = 'accepted'"
  ).get().v;

  const avg_days_past_due = db.prepare(
    "SELECT COALESCE(AVG(days_past_due), 0) AS v FROM invoices WHERE days_past_due > 0 AND status != 'paid'"
  ).get().v;

  res.json({ total_open_ar, overdue_amount, active_offers, cash_accelerated, avg_days_past_due });
});

// GET /api/activity — last 10 offers for the feed
app.get('/api/activity', (req, res) => {
  const rows = db.prepare(`
    SELECT
      d.*,
      i.invoice_number,
      i.amount AS invoice_amount,
      c.name AS customer_name
    FROM discount_offers d
    JOIN invoices i ON i.id = d.invoice_id
    JOIN customers c ON c.id = i.customer_id
    ORDER BY d.created_at DESC
    LIMIT 10
  `).all();
  res.json(rows);
});

const PORT = 3001;
app.listen(PORT, () => console.log(`ClearAR API running on port ${PORT}`));
