# ClearAR — Extend Existing App to Full Platform

The app is already running. Do NOT delete or rewrite what exists.
Read the existing `server.js` and `public/index.html` first before touching anything.
Only add what is described below.

---

## WHAT EXISTS (do not touch)

- SQLite database with `customers`, `invoices`, `discount_offers` tables — already seeded
- `/api/stats`, `/api/invoices`, `/api/offers`, `PATCH /api/offers/:id/accept`, `PATCH /api/offers/:id/withdraw` routes — keep as-is
- Single-page frontend with: top bar, 4 KPI cards, invoice workqueue table with filter pills, offer activity feed on the right
- The existing layout is a top bar + full-width content area with no sidebar

---

## STEP 1 — ADD MISSING TABLES (run on startup, safe to add alongside existing tables)

```sql
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
```

Seed the new tables only if `disputes` table is empty:

**disputes:**
```
invoice_id=2, customer_id=1, 'Price discrepancy', 3200, 'Customer claims quoted price differs from invoice', 'open', sla_date=date('now','+3 days')
invoice_id=5, customer_id=5, 'Quantity error', 1900, 'Short shipment on order #5521', 'under_review', sla_date=date('now','+4 days')
```

**promises_to_pay:**
```
invoice_id=7, customer_id=5, 22000, date('now','+13 days'), 'active', 'Spoke with CFO — cash flow issue, will pay in full'
invoice_id=8, customer_id=2, 6300,  date('now','-4 days'),  'broken', 'Did not arrive as promised'
```

**customer_profiles (one per customer, seed if table empty):**
```
cid=1: avg_days=52, cycle='irregular', pref_day=null, on_time=0.35, early=0.05, late=0.60, avg_inv=12000, outstanding=41350, lifetime=145000, broken_ptp=2, disputes=3, last_pay='2026-06-10', grade='risky', grade_reason='52d avg. 60% invoices late. 2 broken promises. High disputes.', eligible=0, elig_reason='Too many disputes and broken PTPs. Discount unlikely to guarantee payment.'
cid=2: avg_days=8, cycle='mid_month', pref_day=15, on_time=0.88, early=0.22, late=0.12, avg_inv=8500, outstanding=19400, lifetime=312000, broken_ptp=0, disputes=0, last_pay='2026-08-01', grade='easy', grade_reason='Pays by 15th every month. 88% on-time. Zero disputes or broken promises.', eligible=1, elig_reason='Reliable payer, $19,400 outstanding. Low risk of discount abuse.'
cid=3: avg_days=28, cycle='end_of_month', pref_day=28, on_time=0.62, early=0.08, late=0.38, avg_inv=7200, outstanding=19400, lifetime=198000, broken_ptp=1, disputes=1, last_pay='2026-07-28', grade='moderate', grade_reason='Usually pays by month-end but inconsistent. One broken PTP.', eligible=0, elig_reason='Moderate risk. Outstanding not large enough to justify a targeted discount.'
cid=4: avg_days=5, cycle='weekly', pref_day=null, on_time=0.95, early=0.45, late=0.05, avg_inv=9800, outstanding=20600, lifetime=520000, broken_ptp=0, disputes=0, last_pay='2026-08-05', grade='easy', grade_reason='Best payer. Pays within a week. 45% paid early. Zero issues.', eligible=1, elig_reason='Top-tier payer, $20,600 outstanding. Offer will convert fast with zero risk.'
cid=5: avg_days=41, cycle='irregular', pref_day=null, on_time=0.45, early=0.02, late=0.55, avg_inv=14600, outstanding=29600, lifetime=87000, broken_ptp=1, disputes=0, last_pay='2026-06-22', grade='high_risk', grade_reason='$29,600 outstanding vs $87K lifetime. 55% late. Irregular payer.', eligible=0, elig_reason='Unreliable behavior. Discount risks precedent without payment guarantee.'
```

**payment_history — 8 rows per customer** (covering months 2025-12 through 2026-07):

Seed only if payment_history table is empty.

```
Customer 1 (BlueSky, late, check):
  days=[45,52,60,48,71,55,63,75], was_late=1, was_on_time=0, was_early=0
  amounts=[9200,11500,8700,13200,10100,14500,9800,12400], method='check'

Customer 2 (Meridian, on time, ach):
  days=[8,12,7,9,11,8,6,10], was_on_time=1, was_late=0, was_early=0
  amounts=[7500,9200,6800,8100,7900,9500,8200,7700], method='ach'

Customer 3 (Pinnacle, mixed, ach):
  days=[22,35,18,28,42,25,31,19]
  was_on_time=1 if days<=30 else was_late=1
  amounts=[6500,7800,5900,7200,8100,6700,7400,6200], method='ach'

Customer 4 (Apex, early, wire):
  days=[4,6,3,5,7,4,5,6], was_early=1, was_on_time=1, was_late=0
  amounts=[8500,11200,9800,10500,9200,12100,8900,10800], method='wire'

Customer 5 (Granite, mostly late, check):
  days=[38,55,42,61,35,48,52,44]
  was_on_time=1 if days<=30 else was_late=1
  amounts=[12500,15800,11200,14100,13600,16200,12900,14800], method='check'

For each row: due_date = first day of that month (2025-12-01, 2026-01-01 ... 2026-07-01)
paid_date = due_date + days_to_pay, month = 'YYYY-MM'
```

---

## STEP 2 — ADD NEW API ROUTES (append to server.js, do not modify existing routes)

```
GET /api/invoices/:id
  Single invoice + customer + active_offer + active_ptp (from promises_to_pay) + open_dispute
  + activity: last 10 activity_log rows for this invoice_id, newest first

GET /api/disputes          → disputes JOIN customers JOIN invoices, sort sla_date ASC
GET /api/disputes/:id      → single dispute + customer + invoice
POST /api/disputes         body:{invoice_id,customer_id,type,disputed_amount,description}
  sla_date = date('now','+3 days')
  Withdraw any active offer for this invoice (set status='withdrawn')
  Insert into activity_log: "Dispute opened: [type] — offer suspended"
  Return created dispute.
PATCH /api/disputes/:id/status   body:{status}
  Log: "Dispute updated to [status]". Return updated dispute.

GET /api/promises          → promises_to_pay JOIN customers JOIN invoices, sort promise_date ASC
POST /api/promises         body:{invoice_id,customer_id,promised_amount,promise_date,notes}
  Log: "Promise to pay recorded — [amount] by [date]". Return created promise.
PATCH /api/promises/:id/status   body:{status}
  If kept: set invoice status='paid'. Log: "PTP kept — invoice marked paid"
  If broken: Log: "PTP broken — dunning resumed". Return updated promise.

POST /api/activity   body:{invoice_id,message,type}   → insert + return {success:true}

GET /api/customers/intelligence
  → customer_profiles JOIN customers
  For each: compute payment_trend = (avg of last 3 days_to_pay) - (avg of rows 4-6) from payment_history
  Compute next_expected_payment:
    mid_month → next 15th of current or next month
    end_of_month → next 28th of current or next month
    weekly → date('now','+7 days')
    irregular → null
  Compute open_invoice_count: count invoices where customer_id matches and status != 'paid'
  Sort by total_outstanding DESC.

GET /api/customers/:id/payment-history   → all payment_history rows for customer, ORDER BY rowid DESC

GET /api/liquidity/eligible
  → customer_profiles JOIN customers where liquidity_offer_eligible=1
  Include open invoices for each. Sort by total_outstanding DESC.

GET /api/liquidity/campaigns   → liquidity_campaigns JOIN customers, ORDER BY created_at DESC

POST /api/liquidity/campaigns   body:{customer_id,invoice_ids[],discount_pct,deadline,reason}
  Validate: eligible=1, discount between 5 and 20.
  total_outstanding = sum of amounts of selected invoice_ids.
  discount_amount = round(total_outstanding * discount_pct / 100, 2)
  final_amount = total_outstanding - discount_amount
  Store invoice_ids as JSON.stringify(invoice_ids).
  Log to activity_log for each invoice_id: "Targeted liquidity offer sent — [pct]% discount"
  Return created campaign.

PATCH /api/liquidity/campaigns/:id/respond   body:{status:'accepted'|'declined'}
  Set status + responded_at = datetime('now').
  If accepted: set all invoices from invoice_ids to status='paid'. Log: "Liquidity offer accepted"
  If declined: Log: "Liquidity offer declined". Return updated campaign.
```

Also update `GET /api/stats` to add two new fields to what it already returns:
```
open_disputes: count(*) from disputes where status in ('open','under_review')
avg_dso: avg(days_past_due) from invoices where days_past_due > 0 and status != 'paid'
```

---

## STEP 3 — RESTRUCTURE THE FRONTEND LAYOUT

The existing layout has no sidebar. Add one without breaking the existing workqueue.

**New layout:** `display:grid; grid-template-rows:52px 1fr; height:100vh`
Body row: `display:grid; grid-template-columns:210px 1fr`

**Keep the existing topbar exactly as-is.**

**Add left sidebar** (210px, white bg, right border `#E2E8F0`):

Two labeled sections. Nav items: `padding:8px 14px; display:flex; align-items:center; gap:8px; cursor:pointer`.

Active state — Collections items: `border-left:3px solid #1A3C5E; background:#EFF6FF; color:#1A3C5E; font-weight:500`
Active state — Early Payment items: `border-left:3px solid #7C3AED; background:#F5F3FF; color:#7C3AED; font-weight:500`
Inactive: `color:#6B7280`

Section label style: `font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:#9CA3AF; padding:8px 14px`

**Collections** section:
1. Workqueue `ti-list-check` — red badge showing overdue invoice count
2. Invoices `ti-file-invoice`
3. Disputes `ti-alert-hexagon` — red badge showing open dispute count
4. Promises to pay `ti-handshake`
5. Customer intel `ti-brain`

**Early Payment** section:
6. Offers `ti-tag` — purple badge showing active offer count
7. Smart offers `ti-target`
8. Buyer portal `ti-shopping-cart`

**Sidebar bottom** (border-top, padding 14px):
"DSO this month" label (`#9CA3AF 11px`) + DSO value large bold (red if >40, amber if 30-40, green if <30, from `avg_dso` in `/api/stats`) + progress bar (`height:4px; border-radius:2px; background:#E2E8F0`; fill width = `min(dso/60*100, 100)%`, fill color matches DSO color) + "Target: 30 days" muted 10px.

**Wrap the existing content** (KPI cards + workqueue + offer feed) in a div with `id="v-workqueue"`. All other new views (`id="v-invoices"`, `id="v-disputes"`, etc.) start hidden (`display:none`).

Move the KPI cards to show inside the workqueue view. The 4-card row stays exactly as it is visually but gets wrapped by the view container.

Clicking a nav item: remove active class from all items, add active class to clicked item, hide all views, show the matching view, re-render that view's data.

Default active: Workqueue nav item.

---

## STEP 4 — ADD GLOBAL HELPERS (add to existing script, do not duplicate existing fetch logic)

```js
const fmtD = s => new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const todayPlus = n => new Date(Date.now()+n*864e5).toISOString().split('T')[0];

function badge(text, color) {
  const map = {
    red:    'background:#FECACA;color:#7F1D1D',
    amber:  'background:#FEF3C7;color:#78350F',
    green:  'background:#D1FAE5;color:#064E3B',
    blue:   'background:#DBEAFE;color:#1E3A8A',
    purple: 'background:#EDE9FE;color:#4C1D95',
    gray:   'background:#F3F4F6;color:#374151',
  };
  return `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500;${map[color]||map.gray}">${text}</span>`;
}

function avatar(initials, bg, tc, size=32) {
  return `<div style="width:${size}px;height:${size}px;border-radius:8px;background:${bg};color:${tc};display:inline-flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.38)}px;font-weight:500;flex-shrink:0">${initials}</div>`;
}
```

**Drawer system:** Add to the HTML body (before closing tag):
```html
<div id="drawer-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:50">
  <div id="drawer-panel" style="position:absolute;right:0;top:0;bottom:0;width:420px;background:#fff;overflow-y:auto;border-left:1px solid #E2E8F0"></div>
</div>
```
```js
function openDrawer(html) {
  document.getElementById('drawer-panel').innerHTML = html;
  document.getElementById('drawer-overlay').style.display = 'block';
}
function closeDrawer() {
  document.getElementById('drawer-overlay').style.display = 'none';
}
document.getElementById('drawer-overlay').addEventListener('click', e => {
  if (e.target.id === 'drawer-overlay') closeDrawer();
});
```

---

## STEP 5 — INVOICE DETAIL DRAWER

Add to the existing workqueue table: clicking a row (not a button) calls `openInvoiceDrawer(id)`.

```js
async function openInvoiceDrawer(invoiceId) {
  const data = await fetch('/api/invoices/'+invoiceId).then(r=>r.json());
  const inv = data; const cu = data.customer;
  const ao = data.active_offer; const ap = data.active_ptp; const ad = data.open_dispute;
  const logs = data.activity || [];

  openDrawer(`
    <div style="padding:16px;border-bottom:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:start;position:sticky;top:0;background:#fff">
      <div>
        <div style="font-size:11px;color:#6B7280;font-family:monospace">${inv.invoice_number}</div>
        <div style="font-size:22px;font-weight:600;margin-top:2px">${fmt(inv.amount)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${badge(inv.status, inv.status==='paid'?'green':inv.status==='overdue'?'red':'blue')}
        <button onclick="closeDrawer()" style="padding:4px 8px;border:1px solid #E2E8F0;border-radius:6px;cursor:pointer;font-size:12px">✕</button>
      </div>
    </div>
    <div style="padding:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        <div style="background:#F9FAFB;border-radius:8px;padding:10px"><div style="font-size:10px;color:#9CA3AF">Customer</div><div style="font-weight:500;margin-top:2px">${cu.name}</div></div>
        <div style="background:#F9FAFB;border-radius:8px;padding:10px"><div style="font-size:10px;color:#9CA3AF">Due date</div><div style="font-weight:500;margin-top:2px;color:${inv.days_past_due>0?'#E24B4A':'#111827'}">${fmtD(inv.due_date)}</div></div>
        <div style="background:#F9FAFB;border-radius:8px;padding:10px"><div style="font-size:10px;color:#9CA3AF">Days past due</div><div style="font-weight:500;margin-top:2px;color:${inv.days_past_due>=60?'#E24B4A':inv.days_past_due>=30?'#D97706':'#1D9E75'}">${inv.days_past_due?inv.days_past_due+'d':'Current'}</div></div>
        <div style="background:#F9FAFB;border-radius:8px;padding:10px"><div style="font-size:10px;color:#9CA3AF">Risk level</div><div style="font-weight:500;margin-top:2px">${inv.days_past_due>=60?'Critical':inv.days_past_due>=30?'High':inv.days_past_due>0?'Medium':'Low'}</div></div>
      </div>

      ${ap ? `<div style="background:#D1FAE5;border:1px solid #6EE7B7;border-radius:8px;padding:10px;margin-bottom:10px"><div style="font-size:11px;font-weight:500;color:#065F46">⟳ Active promise to pay</div><div style="font-size:12px;color:#047857;margin-top:3px">${fmt(ap.promised_amount)} promised by ${fmtD(ap.promise_date)}</div></div>` : ''}
      ${ad ? `<div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:8px;padding:10px;margin-bottom:10px"><div style="font-size:11px;font-weight:500;color:#78350F">⚠ Open dispute</div><div style="font-size:12px;color:#92400E;margin-top:3px">${ad.type} · ${fmt(ad.disputed_amount)} disputed</div></div>` : ''}
      ${ao ? `<div style="background:#EDE9FE;border:1px solid #C4B5FD;border-radius:8px;padding:10px;margin-bottom:10px"><div style="font-size:11px;font-weight:500;color:#4C1D95">⬡ Active discount offer</div><div style="font-size:12px;color:#5B21B6;margin-top:3px">${ao.discount_pct}% discount · buyer saves ${fmt(ao.discount_amount)} · expires ${fmtD(ao.expiry_date)}</div></div>` : ''}

      <div style="font-size:11px;font-weight:500;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Quick actions</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
        ${inv.status!=='paid'&&!ap&&!ad ? `<button onclick="closeDrawer();openPTPForm(${inv.id},${inv.amount})" style="padding:5px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;cursor:pointer">Record PTP</button>` : ''}
        ${inv.status!=='paid'&&!ad ? `<button onclick="closeDrawer();openDisputeForm(${inv.id},${cu.id},${inv.amount})" style="padding:5px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;cursor:pointer">Open dispute</button>` : ''}
        ${inv.status!=='paid'&&!ao ? `<button onclick="closeDrawer();quickSendOffer(${inv.id},${inv.amount},${inv.days_past_due})" style="padding:5px 10px;background:#7C3AED;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer">Send offer</button>` : ''}
      </div>

      <div style="font-size:11px;font-weight:500;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Activity log</div>
      ${logs.length ? logs.map(l=>`
        <div style="display:flex;gap:8px;padding-bottom:10px;border-left:1px solid #E2E8F0;padding-left:10px;margin-left:5px">
          <div style="flex:1"><div style="font-size:12px">${l.message}</div><div style="font-size:10px;color:#9CA3AF;margin-top:2px">${l.created_at}</div></div>
        </div>`).join('') : '<div style="font-size:12px;color:#9CA3AF">No activity yet</div>'}
    </div>
  `);
}
```

---

## STEP 6 — PTP AND DISPUTE QUICK FORMS

These open in the drawer from invoice detail quick actions.

```js
function openPTPForm(invoiceId, amount) {
  openDrawer(`
    <div style="padding:16px;border-bottom:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:500">Record promise to pay</div>
      <button onclick="closeDrawer()" style="padding:4px 8px;border:1px solid #E2E8F0;border-radius:6px;cursor:pointer;font-size:12px">✕</button>
    </div>
    <div style="padding:16px">
      <div style="margin-bottom:12px"><label style="font-size:12px;color:#6B7280;display:block;margin-bottom:4px">Promised amount</label><input id="ptp-amt" type="number" value="${amount}" style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px"></div>
      <div style="margin-bottom:12px"><label style="font-size:12px;color:#6B7280;display:block;margin-bottom:4px">Promise date</label><input id="ptp-date" type="date" value="${todayPlus(14)}" style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px"></div>
      <div style="margin-bottom:16px"><label style="font-size:12px;color:#6B7280;display:block;margin-bottom:4px">Notes</label><textarea id="ptp-notes" rows="3" placeholder="What the customer said..." style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px;resize:vertical"></textarea></div>
      <button onclick="savePTP(${invoiceId})" style="width:100%;padding:10px;background:#1A3C5E;color:white;border:none;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer">Save promise to pay</button>
    </div>
  `);
}

async function savePTP(invoiceId) {
  const amt = parseFloat(document.getElementById('ptp-amt').value);
  const date = document.getElementById('ptp-date').value;
  const notes = document.getElementById('ptp-notes').value;
  const inv = allInvoices.find(i=>i.id===invoiceId);
  await fetch('/api/promises',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invoice_id:invoiceId,customer_id:inv.customer_id,promised_amount:amt,promise_date:date,notes})});
  closeDrawer(); showToast('PTP recorded — dunning paused until '+fmtD(date),'success');
  loadStats(); renderWorkqueue();
}

function openDisputeForm(invoiceId, customerId, amount) {
  openDrawer(`
    <div style="padding:16px;border-bottom:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:500">Open dispute</div>
      <button onclick="closeDrawer()" style="padding:4px 8px;border:1px solid #E2E8F0;border-radius:6px;cursor:pointer;font-size:12px">✕</button>
    </div>
    <div style="padding:16px">
      <div style="margin-bottom:12px"><label style="font-size:12px;color:#6B7280;display:block;margin-bottom:4px">Dispute type</label>
        <select id="dsp-type" style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px">
          <option>Price discrepancy</option><option>Quantity error</option><option>Duplicate invoice</option><option>Service not delivered</option><option>PO mismatch</option><option>Other</option>
        </select></div>
      <div style="margin-bottom:12px"><label style="font-size:12px;color:#6B7280;display:block;margin-bottom:4px">Disputed amount</label><input id="dsp-amt" type="number" value="${amount}" style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px"></div>
      <div style="margin-bottom:16px"><label style="font-size:12px;color:#6B7280;display:block;margin-bottom:4px">Description</label><textarea id="dsp-desc" rows="3" placeholder="Describe the issue..." style="width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:6px;font-size:13px;resize:vertical"></textarea></div>
      <button onclick="saveDispute(${invoiceId},${customerId})" style="width:100%;padding:10px;background:#DC2626;color:white;border:none;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer">Open dispute</button>
    </div>
  `);
}

async function saveDispute(invoiceId, customerId) {
  const type = document.getElementById('dsp-type').value;
  const amt = parseFloat(document.getElementById('dsp-amt').value);
  const desc = document.getElementById('dsp-desc').value;
  await fetch('/api/disputes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invoice_id:invoiceId,customer_id:customerId,type,disputed_amount:amt,description:desc})});
  closeDrawer(); showToast('Dispute filed — active offer suspended','warning');
  loadStats(); renderWorkqueue();
}
```

---

## STEP 7 — FIVE NEW VIEWS

Add these view divs to the HTML (all start `display:none`). Add render functions in JS. Each view fetches its own data when shown.

### VIEW: INVOICES (id="v-invoices")

Filter pills: All | Overdue | Open | Paid — client-side filter.

Table: Invoice# | Customer | Amount | Due Date | DPD | Status | Aging | Action

Aging badge: dpd=0→badge("Current","green"), 1-30→badge("1-30 DPD","blue"), 31-60→badge("31-60 DPD","amber"), 61-90→badge("61-90 DPD","red") with amber style, 90+→badge("90+ DPD","red").

Action: active offer→purple badge with % · paid→green badge · else purple "Send offer" button.
Row click → `openInvoiceDrawer(id)`.

### VIEW: DISPUTES (id="v-disputes")

Page header + "New dispute" button (navy) → `openNewDisputeForm()`.

3 stat cards: Open (red) · SLA at risk (count where sla_date <= todayPlus(1), amber) · Resolved this month (green).

Table: Customer | Invoice# | Type | Disputed$ | Status | SLA left | Actions

SLA left from sla_date minus today: <0→badge("Overdue","red"), 0→badge("Today","red"), 1→badge("1 day","red"), 2-4→badge(n+"d","amber"), 5+→badge(n+"d","blue").

"View" button → drawer showing: dispute type + customer + invoice# header · field grid (disputed amount, status, sla date, invoice total) · description in gray italic box · status workflow buttons:
  - open → "Mark under review" button → PATCH status=under_review
  - open or under_review → "Resolve" green button → PATCH status=resolved
  Internal note textarea + "Save note" button → POST /api/activity.

`openNewDisputeForm()`: drawer with select invoice (non-paid invoices from allInvoices dropdown), dispute type, disputed amount, description → POST /api/disputes.

### VIEW: PROMISES TO PAY (id="v-promises")

3 stat cards: Active · Broken this month (red) · Kept this month (green).

Cards not table. Each PTP card: icon square (active=green `#D1FAE5`/`ti-calendar-check`, broken=red `#FECACA`/`ti-calendar-x`, kept=blue `#DBEAFE`/`ti-check`) + customer name bold + invoice# monospace small + promised amount bold + "due" + fmtD(promise_date) + italic notes muted + status badge + if active: "Mark kept" green button + "Mark broken" red button → PATCH /api/promises/:id/status → toast + re-render.

### VIEW: CUSTOMER INTEL (id="v-intel")

Grade legend bar: 5 colored pills in a row — Easy (green) · Moderate (blue) · Medium (amber) · High risk (orange `#FEF3C7`/`#92400E`) · Risky (red).

Sort pills: By outstanding (default) · By grade · By on-time rate · By avg DPD. Client-side sort.

**Customer cards** (fetch `/api/customers/intelligence`):
Each card: white bg, border, 10px radius, padding 16px, `border-left:4px solid [grade color]`.
Grade colors: easy=`#1D9E75`, moderate=`#185FA5`, medium=`#D97706`, high_risk=`#EA580C`, risky=`#E24B4A`.

Three columns inside:

LEFT (32%): `avatar(initials,color,text_color,44)` + name bold 15px + email muted + grade `badge()` + grade_reason italic 11px muted (overflow hidden, max 2 lines).

MIDDLE (40%): 2×2 grid of metric chips (bg `#F9FAFB`, border-radius 6px, padding 6px 10px, label 10px muted above, value bold 13px below):
  - Avg days to pay: colored green<15, amber 15-35, red>35
  - On-time rate: as XX% colored green>75%, amber 50-75%, red<50%
  - Payment cycle: text
  - Next payment: fmtD or "Irregular"
Below chips: "Last 8 payments" 10px muted + 8 squares (8px wide × 20px tall, gap 2px, border-radius 2px):
  was_early=1→purple `#7C3AED` · was_on_time=1→green `#1D9E75` · was_late=1→red `#E24B4A`
  Fetch `/api/customers/:id/payment-history` for each card.

RIGHT (28%): outstanding large bold (red>15k, amber 5k-15k, green<5k) · open invoice count badge · lifetime paid green small · trend: red "↑ Slowing" if >5, green "↓ Improving" if <-5, gray "→ Stable" · "View history" button → drawer with payment history table (Amt | Due | Paid | Days | Method | Result badge) · "Collect now" teal button — ONLY if grade='risky' or 'high_risk' → POST /api/activity → toast "P1 task created for [name]".

### VIEW: SMART OFFERS (id="v-smart")

**Navy banner** (two cols): left — "Why not discount everyone?" bold + explanation. Right — 3 green checkmark lines: "Significant outstanding" · "Proven reliability" · "No broken promises or disputes".

**Two-column layout** (60/40):

LEFT — Eligible customers (fetch `/api/liquidity/eligible`):
Green count badge header.
Each eligible card (white, border, radius 10px, padding 14px):
  Top: avatar + name + grade badge + italic teal elig_reason.
  4 chips: outstanding (red) · on_time_rate (green%) · lifetime paid · last payment date.
  "[n] open invoices" chevron toggle → expanded list with checkboxes per invoice.
  When ≥1 checked — offer config appears:
    Discount slider 5-20 (default 10) + live label "Offer X% — they pay [fmt(total*(1-X/100))] instead of [fmt(total)]" + muted "You forgo [fmt(total*X/100)]" + amber warning if >15%.
    Deadline date picker default todayPlus(7), max todayPlus(30) + amber warning if >todayPlus(21).
    Reason textarea.
    "Send targeted offer" purple button — check client-side if pending campaign exists for this customer before submitting → POST /api/liquidity/campaigns → toast → refresh right column.

Below eligible: collapsible "Not eligible" section (collapsed by default, "[n] not eligible" toggle).
Each row: avatar + name + grade badge + italic muted elig_reason. Read-only, no buttons.

RIGHT — Campaigns (fetch `/api/liquidity/campaigns`):
Each campaign card: avatar + name + status badge · "[pct]% on [n] invoices" · "They pay [final] instead of [total]" · muted "You forgo [discount_amount]" · deadline colored · if pending: "Mark accepted" green + "Mark declined" red → PATCH /api/liquidity/campaigns/:id/respond → toast + re-render.
Empty state: "No campaigns sent yet."

---

## STEP 8 — BUYER PORTAL VIEW (id="v-buyer")

Navy banner: "Pay early, save money" white bold + teal subtitle + right side total available savings.

Fetch active offers from existing `/api/offers`, filter client-side where status='active'.

Offer cards (stacked): checkbox + avatar + customer name + invoice# + due date + original amount strikethrough → right box (bg `#EDE9FE`, radius 8px) with discounted amount large bold purple + "You save $X" green + pct label + days remaining colored (red<3, amber 3-6, green 7+).

Sticky bottom bar when ≥1 selected (position sticky, bottom 0, white bg, border-top, padding 12px 20px):
"[n] selected · You pay $X · You save $X" + "Confirm payment" purple button → loop PATCH /api/offers/:id/accept → refresh → toast.

---

## STEP 9 — CROSS-MODULE WIRING

These must work end-to-end after all changes:

1. Opening a dispute via the dispute form → backend withdraws the active offer → Offers view reflects this on next render.
2. Accepting an offer (simulate or buyer portal) → invoice becomes 'paid' → Workqueue removes it from active list.
3. PTP marked kept → invoice becomes 'paid' → Workqueue and Invoices view update.
4. After any mutating action → re-call `loadStats()` → KPI cards and DSO meter in sidebar both update.

---

## DONE MEANS

`node server.js` → verify:

1. Left sidebar appears with all 8 nav items, correct icons, badge counts — existing workqueue still works
2. Clicking each nav item shows the correct view and hides others
3. DSO meter appears at sidebar bottom with number and progress bar
4. Clicking an invoice row opens the detail drawer with PTP/dispute/offer alert boxes and activity log
5. Recording a PTP from the drawer saves it and appears in Promises to Pay view
6. Opening a dispute from the drawer suspends the active offer (check Offers view)
7. Disputes view: 2 seeded rows show, SLA countdown works, new dispute drawer works, resolve works
8. PTP view: 2 seeded cards show, mark kept/broken works
9. Customer intel: 5 cards with grade color strips and payment sparklines, sort pills work, "Collect now" only on risky/high_risk
10. Smart offers: Meridian and Apex eligible with working offer form and live slider math, others in collapsed section
11. Buyer portal: checkboxes work, bottom bar totals update, confirm payment settles invoices
12. Nothing in the existing workqueue, KPI cards, or offer feed is broken

List every file modified and every new function added.