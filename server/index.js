const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

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

  CREATE TABLE IF NOT EXISTS disputes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER REFERENCES invoices(id),
    customer_id INTEGER REFERENCES customers(id),
    type TEXT NOT NULL,
    disputed_amount REAL NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open',
    sla_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS promises_to_pay (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER REFERENCES invoices(id),
    customer_id INTEGER REFERENCES customers(id),
    promised_amount REAL NOT NULL,
    promise_date TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customer_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER UNIQUE REFERENCES customers(id),
    avg_days_to_pay REAL DEFAULT 30,
    payment_cycle TEXT DEFAULT 'end_of_month',
    preferred_payment_day INTEGER,
    on_time_rate REAL DEFAULT 0.8,
    early_payment_rate REAL DEFAULT 0.1,
    late_payment_rate REAL DEFAULT 0.1,
    avg_invoice_size REAL DEFAULT 5000,
    total_outstanding REAL DEFAULT 0,
    total_paid_lifetime REAL DEFAULT 0,
    broken_ptp_count INTEGER DEFAULT 0,
    dispute_count INTEGER DEFAULT 0,
    last_payment_date TEXT,
    collection_grade TEXT DEFAULT 'medium',
    grade_reason TEXT,
    liquidity_offer_eligible INTEGER DEFAULT 0,
    liquidity_offer_reason TEXT
  );

  CREATE TABLE IF NOT EXISTS payment_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    invoice_amount REAL NOT NULL,
    due_date TEXT NOT NULL,
    paid_date TEXT,
    days_to_pay INTEGER,
    was_early INTEGER DEFAULT 0,
    was_on_time INTEGER DEFAULT 0,
    was_late INTEGER DEFAULT 0,
    payment_method TEXT DEFAULT 'ach',
    month TEXT
  );

  CREATE TABLE IF NOT EXISTS liquidity_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    invoice_ids TEXT NOT NULL,
    total_outstanding REAL NOT NULL,
    offered_discount_pct REAL NOT NULL,
    discount_amount REAL NOT NULL,
    final_amount REAL NOT NULL,
    deadline TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    responded_at TEXT
  );
`);

// ── Seed original tables ──────────────────────────────────────────────────────
function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
  if (count > 0) return;

  const today = new Date();
  function addDays(d, n) {
    const r = new Date(d); r.setDate(r.getDate() + n);
    return r.toISOString().slice(0, 10);
  }

  const insertCustomer = db.prepare('INSERT INTO customers (name, email, avg_days_to_pay) VALUES (?, ?, ?)');
  const customers = [
    { name: 'Meridian Industrial',   email: 'ar@meridianindustrial.com',       avg: 15 },
    { name: 'Apex Logistics Group',  email: 'finance@apexlogistics.com',       avg: 28 },
    { name: 'BlueSky Technologies',  email: 'accounts@bluesky.tech',           avg: 38 },
    { name: 'Granite Construction',  email: 'payables@graniteconstruction.com',avg: 52 },
    { name: 'Pinnacle Retail Co.',   email: 'ap@pinnacleretail.com',           avg: 65 },
  ];
  const customerIds = customers.map(c => insertCustomer.run(c.name, c.email, c.avg).lastInsertRowid);

  const insertInvoice = db.prepare(
    `INSERT INTO invoices (invoice_number, customer_id, amount, due_date, status, days_past_due)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const invoiceData = [
    { cIdx:0, num:'INV-1001', amount:4200,  dueDays:+14, status:'open' },
    { cIdx:1, num:'INV-1002', amount:8750,  dueDays:+7,  status:'open' },
    { cIdx:2, num:'INV-1003', amount:2100,  dueDays:+21, status:'open' },
    { cIdx:3, num:'INV-1004', amount:15500, dueDays:+30, status:'open' },
    { cIdx:4, num:'INV-1005', amount:3800,  dueDays:+5,  status:'open' },
    { cIdx:0, num:'INV-1006', amount:6300,  dueDays:-12, status:'overdue' },
    { cIdx:1, num:'INV-1007', amount:9400,  dueDays:-5,  status:'overdue' },
    { cIdx:2, num:'INV-1008', amount:1850,  dueDays:-22, status:'overdue' },
    { cIdx:3, num:'INV-1009', amount:22000, dueDays:-18, status:'overdue' },
    { cIdx:4, num:'INV-1010', amount:500,   dueDays:-8,  status:'overdue' },
    { cIdx:1, num:'INV-1011', amount:11200, dueDays:-45, status:'overdue' },
    { cIdx:3, num:'INV-1012', amount:7600,  dueDays:-33, status:'overdue' },
    { cIdx:4, num:'INV-1013', amount:18900, dueDays:-55, status:'overdue' },
    { cIdx:2, num:'INV-1014', amount:24500, dueDays:-75, status:'overdue' },
    { cIdx:0, num:'INV-1015', amount:13100, dueDays:-90, status:'overdue' },
  ];
  const invoiceIds = invoiceData.map(inv => {
    const dueDate = addDays(today, inv.dueDays);
    const daysPastDue = Math.max(0, -inv.dueDays);
    return insertInvoice.run(inv.num, customerIds[inv.cIdx], inv.amount, dueDate, inv.status, daysPastDue).lastInsertRowid;
  });

  const insertOffer = db.prepare(
    `INSERT INTO discount_offers (invoice_id, discount_pct, discount_amount, discounted_amount, expiry_date, status, accepted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const a1pct = 1.5, a1amt = 11200 * 1.5 / 100;
  insertOffer.run(invoiceIds[10], a1pct, a1amt, 11200 - a1amt, addDays(today, 7), 'active', null);
  const a2pct = 2.0, a2amt = 7600 * 2.0 / 100;
  insertOffer.run(invoiceIds[11], a2pct, a2amt, 7600 - a2amt, addDays(today, -3), 'accepted', new Date().toISOString());
  db.prepare("UPDATE invoices SET status='paid' WHERE id=?").run(invoiceIds[11]);
  const a3pct = 2.5, a3amt = 18900 * 2.5 / 100;
  insertOffer.run(invoiceIds[12], a3pct, a3amt, 18900 - a3amt, addDays(today, -10), 'expired', null);

  console.log('Original tables seeded.');
}

// ── Seed new tables ───────────────────────────────────────────────────────────
function seedNewTablesIfEmpty() {
  const hasDisputes = db.prepare('SELECT COUNT(*) as c FROM disputes').get().c > 0;
  if (!hasDisputes) {
    const ins = db.prepare(
      `INSERT INTO disputes (invoice_id, customer_id, type, disputed_amount, description, status, sla_date)
       VALUES (?, ?, ?, ?, ?, ?, date('now', ?))`
    );
    ins.run(2, 1, 'Price discrepancy', 3200, "Customer claims quoted price differs from invoice", 'open', '+3 days');
    ins.run(5, 5, 'Quantity error', 1900, 'Short shipment on order #5521', 'under_review', '+4 days');
  }

  const hasPTP = db.prepare('SELECT COUNT(*) as c FROM promises_to_pay').get().c > 0;
  if (!hasPTP) {
    const ins = db.prepare(
      `INSERT INTO promises_to_pay (invoice_id, customer_id, promised_amount, promise_date, status, notes)
       VALUES (?, ?, ?, date('now', ?), ?, ?)`
    );
    ins.run(7, 5, 22000, '+13 days', 'active', 'Spoke with CFO — cash flow issue, will pay in full');
    ins.run(8, 2, 6300,  '-4 days',  'broken', 'Did not arrive as promised');
  }

  const hasProfiles = db.prepare('SELECT COUNT(*) as c FROM customer_profiles').get().c > 0;
  if (!hasProfiles) {
    const ins = db.prepare(`
      INSERT INTO customer_profiles
        (customer_id, avg_days_to_pay, payment_cycle, preferred_payment_day, on_time_rate,
         early_payment_rate, late_payment_rate, avg_invoice_size, total_outstanding,
         total_paid_lifetime, broken_ptp_count, dispute_count, last_payment_date,
         collection_grade, grade_reason, liquidity_offer_eligible, liquidity_offer_reason)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    ins.run(1,52,'irregular',null,0.35,0.05,0.60,12000,41350,145000,2,3,'2026-06-10','risky','52d avg. 60% invoices late. 2 broken promises. High disputes.',0,'Too many disputes and broken PTPs. Discount unlikely to guarantee payment.');
    ins.run(2,8,'mid_month',15,0.88,0.22,0.12,8500,19400,312000,0,0,'2026-08-01','easy','Pays by 15th every month. 88% on-time. Zero disputes or broken promises.',1,'Reliable payer, $19,400 outstanding. Low risk of discount abuse.');
    ins.run(3,28,'end_of_month',28,0.62,0.08,0.38,7200,19400,198000,1,1,'2026-07-28','moderate','Usually pays by month-end but inconsistent. One broken PTP.',0,'Moderate risk. Outstanding not large enough to justify a targeted discount.');
    ins.run(4,5,'weekly',null,0.95,0.45,0.05,9800,20600,520000,0,0,'2026-08-05','easy','Best payer. Pays within a week. 45% paid early. Zero issues.',1,'Top-tier payer, $20,600 outstanding. Offer will convert fast with zero risk.');
    ins.run(5,41,'irregular',null,0.45,0.02,0.55,14600,29600,87000,1,0,'2026-06-22','high_risk','$29,600 outstanding vs $87K lifetime. 55% late. Irregular payer.',0,'Unreliable behavior. Discount risks precedent without payment guarantee.');
  }

  const hasHistory = db.prepare('SELECT COUNT(*) as c FROM payment_history').get().c > 0;
  if (!hasHistory) {
    const months = ['2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
    const ins = db.prepare(`
      INSERT INTO payment_history
        (customer_id, invoice_amount, due_date, paid_date, days_to_pay, was_early, was_on_time, was_late, payment_method, month)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);

    // cid=1 Meridian, late, check
    const c1days=[45,52,60,48,71,55,63,75], c1amts=[9200,11500,8700,13200,10100,14500,9800,12400];
    months.forEach((m,i) => {
      const due = m+'-01';
      const paid = new Date(new Date(due).getTime() + c1days[i]*864e5).toISOString().slice(0,10);
      ins.run(1,c1amts[i],due,paid,c1days[i],0,0,1,'check',m);
    });
    // cid=2 Apex, on time, ach
    const c2days=[8,12,7,9,11,8,6,10], c2amts=[7500,9200,6800,8100,7900,9500,8200,7700];
    months.forEach((m,i) => {
      const due = m+'-01';
      const paid = new Date(new Date(due).getTime() + c2days[i]*864e5).toISOString().slice(0,10);
      ins.run(2,c2amts[i],due,paid,c2days[i],0,1,0,'ach',m);
    });
    // cid=3 BlueSky, mixed, ach
    const c3days=[22,35,18,28,42,25,31,19], c3amts=[6500,7800,5900,7200,8100,6700,7400,6200];
    months.forEach((m,i) => {
      const due = m+'-01';
      const paid = new Date(new Date(due).getTime() + c3days[i]*864e5).toISOString().slice(0,10);
      const late = c3days[i]>30?1:0, ontime = c3days[i]<=30?1:0;
      ins.run(3,c3amts[i],due,paid,c3days[i],0,ontime,late,'ach',m);
    });
    // cid=4 Granite, early, wire
    const c4days=[4,6,3,5,7,4,5,6], c4amts=[8500,11200,9800,10500,9200,12100,8900,10800];
    months.forEach((m,i) => {
      const due = m+'-01';
      const paid = new Date(new Date(due).getTime() + c4days[i]*864e5).toISOString().slice(0,10);
      ins.run(4,c4amts[i],due,paid,c4days[i],1,1,0,'wire',m);
    });
    // cid=5 Pinnacle, mostly late, check
    const c5days=[38,55,42,61,35,48,52,44], c5amts=[12500,15800,11200,14100,13600,16200,12900,14800];
    months.forEach((m,i) => {
      const due = m+'-01';
      const paid = new Date(new Date(due).getTime() + c5days[i]*864e5).toISOString().slice(0,10);
      const late = c5days[i]>30?1:0, ontime = c5days[i]<=30?1:0;
      ins.run(5,c5amts[i],due,paid,c5days[i],0,ontime,late,'check',m);
    });
  }

  console.log('New tables seeded.');
}

seedIfEmpty();
seedNewTablesIfEmpty();

// ── Express App ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// ── EXISTING ROUTES (unchanged) ───────────────────────────────────────────────

app.get('/api/invoices', (req, res) => {
  const invoices = db.prepare(`
    SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.avg_days_to_pay,
      d.id AS offer_id, d.discount_pct AS offer_pct,
      d.discount_amount AS offer_discount_amount, d.discounted_amount AS offer_discounted_amount,
      d.expiry_date AS offer_expiry, d.status AS offer_status,
      d.accepted_at AS offer_accepted_at, d.created_at AS offer_created_at
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN discount_offers d ON d.invoice_id = i.id AND d.status IN ('active','accepted')
    ORDER BY i.days_past_due DESC
  `).all();
  res.json(invoices);
});

app.post('/api/offers', (req, res) => {
  const { invoice_id, discount_pct, expiry_date } = req.body;
  if (!invoice_id || !discount_pct || !expiry_date)
    return res.status(400).json({ error: 'Missing required fields' });
  const invoice = db.prepare('SELECT * FROM invoices WHERE id=?').get(invoice_id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (!['open','overdue'].includes(invoice.status))
    return res.status(400).json({ error: 'Invoice must be open or overdue' });
  const existing = db.prepare("SELECT id FROM discount_offers WHERE invoice_id=? AND status='active'").get(invoice_id);
  if (existing) return res.status(400).json({ error: 'Active offer already exists for this invoice' });
  const discount_amount = invoice.amount * discount_pct / 100;
  const discounted_amount = invoice.amount - discount_amount;
  const result = db.prepare(
    `INSERT INTO discount_offers (invoice_id, discount_pct, discount_amount, discounted_amount, expiry_date) VALUES (?,?,?,?,?)`
  ).run(invoice_id, discount_pct, discount_amount, discounted_amount, expiry_date);
  res.status(201).json(db.prepare('SELECT * FROM discount_offers WHERE id=?').get(result.lastInsertRowid));
});

app.post('/api/offers/:id/accept', (req, res) => {
  const offer = db.prepare('SELECT * FROM discount_offers WHERE id=?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  db.prepare("UPDATE discount_offers SET status='accepted', accepted_at=? WHERE id=?").run(new Date().toISOString(), offer.id);
  db.prepare("UPDATE invoices SET status='paid' WHERE id=?").run(offer.invoice_id);
  res.json({ offer: db.prepare('SELECT * FROM discount_offers WHERE id=?').get(offer.id),
             invoice: db.prepare('SELECT * FROM invoices WHERE id=?').get(offer.invoice_id) });
});

app.post('/api/offers/:id/withdraw', (req, res) => {
  const offer = db.prepare('SELECT * FROM discount_offers WHERE id=?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  db.prepare("UPDATE discount_offers SET status='withdrawn' WHERE id=?").run(offer.id);
  res.json(db.prepare('SELECT * FROM discount_offers WHERE id=?').get(offer.id));
});

// Updated stats — adds open_disputes + avg_dso
app.get('/api/stats', (req, res) => {
  const total_open_ar = db.prepare("SELECT COALESCE(SUM(amount),0) AS v FROM invoices WHERE status IN ('open','overdue')").get().v;
  const overdue_amount = db.prepare("SELECT COALESCE(SUM(amount),0) AS v FROM invoices WHERE days_past_due>0 AND status!='paid'").get().v;
  const active_offers = db.prepare("SELECT COUNT(*) AS v FROM discount_offers WHERE status='active'").get().v;
  const cash_accelerated = db.prepare("SELECT COALESCE(SUM(discounted_amount),0) AS v FROM discount_offers WHERE status='accepted'").get().v;
  const avg_days_past_due = db.prepare("SELECT COALESCE(AVG(days_past_due),0) AS v FROM invoices WHERE days_past_due>0 AND status!='paid'").get().v;
  const open_disputes = db.prepare("SELECT COUNT(*) AS v FROM disputes WHERE status IN ('open','under_review')").get().v;
  const avg_dso = db.prepare("SELECT COALESCE(AVG(days_past_due),0) AS v FROM invoices WHERE days_past_due>0 AND status!='paid'").get().v;
  res.json({ total_open_ar, overdue_amount, active_offers, cash_accelerated, avg_days_past_due, open_disputes, avg_dso });
});

app.get('/api/activity', (req, res) => {
  const rows = db.prepare(`
    SELECT d.*, i.invoice_number, i.amount AS invoice_amount, c.name AS customer_name
    FROM discount_offers d
    JOIN invoices i ON i.id = d.invoice_id
    JOIN customers c ON c.id = i.customer_id
    ORDER BY d.created_at DESC LIMIT 10
  `).all();
  res.json(rows);
});

// ── NEW ROUTES ────────────────────────────────────────────────────────────────

// GET /api/invoices/:id
app.get('/api/invoices/:id', (req, res) => {
  const inv = db.prepare(`
    SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.avg_days_to_pay,
      c.id AS customer_id
    FROM invoices i JOIN customers c ON c.id = i.customer_id
    WHERE i.id=?
  `).get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });

  const active_offer = db.prepare("SELECT * FROM discount_offers WHERE invoice_id=? AND status='active'").get(inv.id);
  const active_ptp = db.prepare("SELECT * FROM promises_to_pay WHERE invoice_id=? AND status='active'").get(inv.id);
  const open_dispute = db.prepare("SELECT * FROM disputes WHERE invoice_id=? AND status IN ('open','under_review')").get(inv.id);
  const activity = db.prepare("SELECT * FROM activity_log WHERE invoice_id=? ORDER BY id DESC LIMIT 10").all(inv.id);
  const customer = { id: inv.customer_id, name: inv.customer_name, email: inv.customer_email };

  res.json({ ...inv, customer, active_offer, active_ptp, open_dispute, activity });
});

// Disputes
app.get('/api/disputes', (req, res) => {
  res.json(db.prepare(`
    SELECT d.*, c.name AS customer_name, i.invoice_number, i.amount AS invoice_amount
    FROM disputes d
    JOIN customers c ON c.id = d.customer_id
    JOIN invoices i ON i.id = d.invoice_id
    ORDER BY d.sla_date ASC
  `).all());
});

app.get('/api/disputes/:id', (req, res) => {
  const d = db.prepare(`
    SELECT d.*, c.name AS customer_name, c.email AS customer_email,
      i.invoice_number, i.amount AS invoice_amount, i.status AS invoice_status
    FROM disputes d
    JOIN customers c ON c.id = d.customer_id
    JOIN invoices i ON i.id = d.invoice_id
    WHERE d.id=?
  `).get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  res.json(d);
});

app.post('/api/disputes', (req, res) => {
  const { invoice_id, customer_id, type, disputed_amount, description } = req.body;
  if (!invoice_id || !customer_id || !type || !disputed_amount)
    return res.status(400).json({ error: 'Missing required fields' });

  // Withdraw any active offer for this invoice
  const activeOffer = db.prepare("SELECT id FROM discount_offers WHERE invoice_id=? AND status='active'").get(invoice_id);
  if (activeOffer) {
    db.prepare("UPDATE discount_offers SET status='withdrawn' WHERE id=?").run(activeOffer.id);
  }

  const result = db.prepare(
    `INSERT INTO disputes (invoice_id, customer_id, type, disputed_amount, description, sla_date)
     VALUES (?, ?, ?, ?, ?, date('now','+3 days'))`
  ).run(invoice_id, customer_id, type, disputed_amount, description || '');

  db.prepare("INSERT INTO activity_log (invoice_id, message, type) VALUES (?, ?, 'dispute')")
    .run(invoice_id, `Dispute opened: ${type} — offer suspended`);

  res.status(201).json(db.prepare('SELECT * FROM disputes WHERE id=?').get(result.lastInsertRowid));
});

app.patch('/api/disputes/:id/status', (req, res) => {
  const { status } = req.body;
  const d = db.prepare('SELECT * FROM disputes WHERE id=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE disputes SET status=? WHERE id=?').run(status, d.id);
  db.prepare("INSERT INTO activity_log (invoice_id, message, type) VALUES (?, ?, 'dispute')")
    .run(d.invoice_id, `Dispute updated to ${status}`);
  res.json(db.prepare('SELECT * FROM disputes WHERE id=?').get(d.id));
});

// Promises to pay
app.get('/api/promises', (req, res) => {
  res.json(db.prepare(`
    SELECT p.*, c.name AS customer_name, i.invoice_number, i.amount AS invoice_amount
    FROM promises_to_pay p
    JOIN customers c ON c.id = p.customer_id
    JOIN invoices i ON i.id = p.invoice_id
    ORDER BY p.promise_date ASC
  `).all());
});

app.post('/api/promises', (req, res) => {
  const { invoice_id, customer_id, promised_amount, promise_date, notes } = req.body;
  if (!invoice_id || !customer_id || !promised_amount || !promise_date)
    return res.status(400).json({ error: 'Missing required fields' });
  const result = db.prepare(
    `INSERT INTO promises_to_pay (invoice_id, customer_id, promised_amount, promise_date, notes) VALUES (?,?,?,?,?)`
  ).run(invoice_id, customer_id, promised_amount, promise_date, notes || '');
  db.prepare("INSERT INTO activity_log (invoice_id, message, type) VALUES (?, ?, 'ptp')")
    .run(invoice_id, `Promise to pay recorded — $${Math.round(promised_amount).toLocaleString()} by ${promise_date}`);
  res.status(201).json(db.prepare('SELECT * FROM promises_to_pay WHERE id=?').get(result.lastInsertRowid));
});

app.patch('/api/promises/:id/status', (req, res) => {
  const { status } = req.body;
  const p = db.prepare('SELECT * FROM promises_to_pay WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE promises_to_pay SET status=? WHERE id=?').run(status, p.id);
  if (status === 'kept') {
    db.prepare("UPDATE invoices SET status='paid' WHERE id=?").run(p.invoice_id);
    db.prepare("INSERT INTO activity_log (invoice_id, message, type) VALUES (?, 'PTP kept — invoice marked paid', 'ptp')").run(p.invoice_id);
  } else if (status === 'broken') {
    db.prepare("INSERT INTO activity_log (invoice_id, message, type) VALUES (?, 'PTP broken — dunning resumed', 'ptp')").run(p.invoice_id);
  }
  res.json(db.prepare('SELECT * FROM promises_to_pay WHERE id=?').get(p.id));
});

// Activity log
app.post('/api/activity', (req, res) => {
  const { invoice_id, message, type } = req.body;
  db.prepare("INSERT INTO activity_log (invoice_id, message, type) VALUES (?,?,?)").run(invoice_id || null, message, type || 'info');
  res.json({ success: true });
});

// Customer intelligence
app.get('/api/customers/intelligence', (req, res) => {
  const profiles = db.prepare(`
    SELECT cp.*, c.name AS customer_name, c.email AS customer_email
    FROM customer_profiles cp JOIN customers c ON c.id = cp.customer_id
    ORDER BY cp.total_outstanding DESC
  `).all();

  const today = new Date();

  const result = profiles.map(p => {
    // Payment trend: avg last 3 - avg rows 4-6
    const history = db.prepare(
      'SELECT days_to_pay FROM payment_history WHERE customer_id=? ORDER BY id DESC LIMIT 6'
    ).all(p.customer_id).map(r => r.days_to_pay);
    const avg3 = history.slice(0, 3).reduce((s, v) => s + v, 0) / Math.max(history.slice(0, 3).length, 1);
    const avg46 = history.slice(3, 6).reduce((s, v) => s + v, 0) / Math.max(history.slice(3, 6).length, 1);
    const payment_trend = avg46 > 0 ? avg3 - avg46 : 0;

    // Next expected payment
    let next_expected_payment = null;
    const d = new Date(today);
    if (p.payment_cycle === 'mid_month') {
      const n15 = new Date(d.getFullYear(), d.getMonth(), 15);
      if (n15 <= d) n15.setMonth(n15.getMonth() + 1);
      next_expected_payment = n15.toISOString().slice(0, 10);
    } else if (p.payment_cycle === 'end_of_month') {
      const n28 = new Date(d.getFullYear(), d.getMonth(), 28);
      if (n28 <= d) n28.setMonth(n28.getMonth() + 1);
      next_expected_payment = n28.toISOString().slice(0, 10);
    } else if (p.payment_cycle === 'weekly') {
      const nw = new Date(d.getTime() + 7 * 864e5);
      next_expected_payment = nw.toISOString().slice(0, 10);
    }

    const open_invoice_count = db.prepare(
      "SELECT COUNT(*) AS c FROM invoices WHERE customer_id=? AND status!='paid'"
    ).get(p.customer_id).c;

    return { ...p, payment_trend, next_expected_payment, open_invoice_count };
  });

  res.json(result);
});

app.get('/api/customers/:id/payment-history', (req, res) => {
  res.json(db.prepare('SELECT * FROM payment_history WHERE customer_id=? ORDER BY id DESC').all(req.params.id));
});

// Liquidity
app.get('/api/liquidity/eligible', (req, res) => {
  const profiles = db.prepare(`
    SELECT cp.*, c.name AS customer_name, c.email AS customer_email
    FROM customer_profiles cp JOIN customers c ON c.id = cp.customer_id
    WHERE cp.liquidity_offer_eligible=1
    ORDER BY cp.total_outstanding DESC
  `).all();

  const result = profiles.map(p => {
    const invoices = db.prepare(
      "SELECT * FROM invoices WHERE customer_id=? AND status!='paid' ORDER BY days_past_due DESC"
    ).all(p.customer_id);
    return { ...p, invoices };
  });
  res.json(result);
});

app.get('/api/liquidity/campaigns', (req, res) => {
  res.json(db.prepare(`
    SELECT lc.*, c.name AS customer_name
    FROM liquidity_campaigns lc JOIN customers c ON c.id = lc.customer_id
    ORDER BY lc.created_at DESC
  `).all());
});

app.post('/api/liquidity/campaigns', (req, res) => {
  const { customer_id, invoice_ids, discount_pct, deadline, reason } = req.body;
  if (!customer_id || !invoice_ids?.length || !discount_pct || !deadline)
    return res.status(400).json({ error: 'Missing required fields' });

  const profile = db.prepare('SELECT * FROM customer_profiles WHERE customer_id=?').get(customer_id);
  if (!profile?.liquidity_offer_eligible)
    return res.status(400).json({ error: 'Customer not eligible for liquidity offers' });
  if (discount_pct < 5 || discount_pct > 20)
    return res.status(400).json({ error: 'Discount must be between 5% and 20%' });

  const total_outstanding = invoice_ids.reduce((sum, id) => {
    const inv = db.prepare('SELECT amount FROM invoices WHERE id=?').get(id);
    return sum + (inv?.amount || 0);
  }, 0);
  const discount_amount = Math.round(total_outstanding * discount_pct / 100 * 100) / 100;
  const final_amount = total_outstanding - discount_amount;

  const result = db.prepare(`
    INSERT INTO liquidity_campaigns
      (customer_id, invoice_ids, total_outstanding, offered_discount_pct, discount_amount, final_amount, deadline, reason)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(customer_id, JSON.stringify(invoice_ids), total_outstanding, discount_pct, discount_amount, final_amount, deadline, reason || '');

  invoice_ids.forEach(id => {
    db.prepare("INSERT INTO activity_log (invoice_id, message, type) VALUES (?, ?, 'offer')")
      .run(id, `Targeted liquidity offer sent — ${discount_pct}% discount`);
  });

  res.status(201).json(db.prepare('SELECT * FROM liquidity_campaigns WHERE id=?').get(result.lastInsertRowid));
});

app.patch('/api/liquidity/campaigns/:id/respond', (req, res) => {
  const { status } = req.body;
  const campaign = db.prepare('SELECT * FROM liquidity_campaigns WHERE id=?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE liquidity_campaigns SET status=?, responded_at=? WHERE id=?')
    .run(status, new Date().toISOString(), campaign.id);

  const ids = JSON.parse(campaign.invoice_ids);
  if (status === 'accepted') {
    ids.forEach(id => {
      db.prepare("UPDATE invoices SET status='paid' WHERE id=?").run(id);
      db.prepare("INSERT INTO activity_log (invoice_id, message, type) VALUES (?, 'Liquidity offer accepted', 'offer')").run(id);
    });
  } else {
    ids.forEach(id => {
      db.prepare("INSERT INTO activity_log (invoice_id, message, type) VALUES (?, 'Liquidity offer declined', 'offer')").run(id);
    });
  }

  res.json(db.prepare('SELECT * FROM liquidity_campaigns WHERE id=?').get(campaign.id));
});

const PORT = 3001;
app.listen(PORT, () => console.log(`ClearAR API running on port ${PORT}`));
