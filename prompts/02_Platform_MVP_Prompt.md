# ClearAR — MVP Single Prompt for Replit

> Paste everything between the triple-dashes into Replit Agent. Nothing else.

---

Build a full-stack web app called **ClearAR** — a minimal AR Collections & Early Payment tool for B2B businesses.

---

## PROBLEM THIS SOLVES
Finance teams waste hours chasing overdue invoices manually. This app lets them:
1. See all invoices ranked by risk (who is most likely to not pay)
2. Send early payment discount offers to customers to get paid faster
3. Track whether customers accepted or ignored the offer

---

## TECH STACK
- **Frontend:** React + Vite (single HTML file with CDN React if Vite is too slow to set up)
- **Backend:** Node.js + Express
- **Database:** SQLite with better-sqlite3 (no Postgres setup needed — zero config)
- **Styling:** Tailwind CSS via CDN
- **No auth required** — single-user demo app

---

## DATABASE
Create a SQLite database with 3 tables only:

```sql
-- Customers
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avg_days_to_pay INTEGER DEFAULT 30
);

-- Invoices
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT DEFAULT 'open',
    -- open | paid | overdue
  days_past_due INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (date('now'))
);

-- Discount Offers
CREATE TABLE discount_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER REFERENCES invoices(id),
  discount_pct REAL NOT NULL,
  discount_amount REAL NOT NULL,
  discounted_amount REAL NOT NULL,
  expiry_date TEXT NOT NULL,
  status TEXT DEFAULT 'active',
    -- active | accepted | expired | withdrawn
  created_at TEXT DEFAULT (datetime('now')),
  accepted_at TEXT
);
```

Seed with:
- 5 customers (realistic business names, emails, avg_days_to_pay ranging from 15 to 65)
- 15 invoices spread across: 5 current (due in future), 5 overdue 1–30 days, 3 overdue 31–60 days, 2 overdue 60+ days. Amounts between $500 and $25,000.
- Calculate days_past_due for each invoice on insert.
- 3 discount offers: 1 active, 1 accepted, 1 expired.

---

## BACKEND — Express API

All routes prefixed with `/api`

```
GET  /api/invoices
  Returns all invoices JOIN customers, sorted by days_past_due DESC
  Includes: active discount offer for each invoice if one exists

POST /api/offers
  Body: { invoice_id, discount_pct, expiry_date }
  Validates: invoice exists, status = 'open' or 'overdue', no active offer already exists
  Calculates: discount_amount, discounted_amount
  Returns: created offer

POST /api/offers/:id/accept
  Sets offer status = 'accepted', accepted_at = now()
  Sets invoice status = 'paid'
  Returns: updated offer + invoice

POST /api/offers/:id/withdraw
  Sets offer status = 'withdrawn'
  Returns: updated offer

GET  /api/stats
  Returns:
  - total_open_ar: sum of amount for open/overdue invoices
  - overdue_amount: sum of amount where days_past_due > 0
  - active_offers: count of active discount offers
  - cash_accelerated: sum of discounted_amount for accepted offers
  - avg_days_past_due: average days_past_due across overdue invoices
```

---

## FRONTEND — Single Page App

One page, three sections stacked vertically. Use Tailwind CSS classes throughout.

**Color palette:**
- Navy `#1A3C5E` — headers, sidebar, primary buttons
- Teal `#0F766E` — collection actions, overdue alerts  
- Purple `#7C3AED` — early payment offer actions and badges
- Background `#F8FAFC`
- White cards with `border border-gray-200 rounded-lg shadow-sm`

---

### SECTION 1 — Top Stats Bar
4 cards in a row (full width):

| Total Open AR | Overdue Amount | Active Offers | Cash Accelerated |
|---|---|---|---|
| $X,XXX | $X,XXX (red if > 0) | X offers | $X,XXX (purple) |

Data from: `GET /api/stats`

---

### SECTION 2 — Invoice Table (main section, ~65% of page)

Title: **"Invoice Workqueue"** with subtitle *"Ranked by payment risk — act on red rows first"*

Table columns:
| # | Customer | Amount | Due Date | Days Past Due | Status | Offer | Action |
|---|---|---|---|---|---|---|---|

**Row behavior:**
- `days_past_due > 60`: red left border + light red row background
- `days_past_due 31–60`: orange left border + light orange background
- `days_past_due 1–30`: amber left border + light amber background
- `days_past_due = 0` (not yet due): white background

**Status badge:**
- `overdue`: red pill
- `open`: gray pill
- `paid`: green pill

**Offer column:**
- If invoice has an `active` offer: show purple badge "💰 X% offer active — expires [date]"
- If invoice has an `accepted` offer: show green badge "✅ Paid early"
- If invoice has no offer and status is not `paid`: show nothing (offer button handles this)

**Action column:**
- If invoice is `paid`: show nothing
- If invoice has an `active` offer: show `[Withdraw]` button (gray, small)
- If invoice has no active offer and is `open` or `overdue`: show `[Send Offer]` button (purple, small)

**"Send Offer" button click:**
Opens a small inline form that drops down BELOW that specific table row (not a modal).
The form contains:
- Text: "Send early payment discount to [Customer Name]"
- Discount %: number input (default: auto-suggested based on days_past_due — see logic below)
- Expiry date: date input (default: 7 days from today)
- "Confirm Offer" button (purple) + "Cancel" link
- On submit: calls `POST /api/offers`, refreshes the row, shows a small green toast "Offer sent!"

**Auto-suggest discount % logic (frontend only, no backend needed):**
```
days_past_due >= 60 → suggest 2.5%
days_past_due 30–59 → suggest 1.5%
days_past_due 1–29  → suggest 1.0%
days_past_due = 0   → suggest 0.5%
```

**"Withdraw" button click:**
Calls `POST /api/offers/:id/withdraw` immediately (no confirmation needed).
Refreshes that row. Shows toast "Offer withdrawn."

Data from: `GET /api/invoices` on page load. Re-fetch after every action.

---

### SECTION 3 — Offer Activity Feed (right sidebar, 30% width — make layout 70/30)

Title: **"Recent Offer Activity"**

Shows last 10 discount_offers (join invoices + customers), sorted newest first.

Each item:
```
[💰 or ✅ or ❌]  Customer Name — Invoice #XXXX
Offered X% discount · $XXX savings
Status badge · [date]
```
- Active: purple dot
- Accepted: green ✅ with "Paid early — saved $XXX"
- Expired/Withdrawn: gray strikethrough text

Below the feed, show one summary line:
**"Total saved by early payment this session: $X,XXX"**

---

### BUYER ACCEPTANCE SIMULATION (for demo purposes)

In the offer activity feed, each `active` offer row has a small **[Simulate Acceptance]** button.
Clicking it calls `POST /api/offers/:id/accept`.
Refreshes both the table and the feed.
Shows toast: "✅ [Customer] accepted the offer! Invoice marked paid."

This simulates the buyer clicking "accept" in their email — useful for demo without building a separate buyer portal.

---

## UX DETAILS

- No page reloads — all actions update state via fetch + re-render
- All money formatted as `$X,XXX` (no decimals in display)
- All dates formatted as `Nov 14, 2026` style
- Toast notifications: appear top-right, auto-dismiss after 3 seconds, green for success, red for error
- Loading state: show "Loading..." text while fetching
- Empty state: if no invoices, show centered message "No invoices found. Add some via the seed script."
- The page should work on a 1280px screen without horizontal scroll

---

## WHAT NOT TO BUILD
- No login / auth
- No user management
- No email sending (just simulate)
- No file uploads
- No multi-page routing
- No mobile responsive design (desktop only for MVP)
- No charts or analytics
- No dispute management
- No dunning sequences
- No campaign builder

---

## DONE MEANS:
1. `npm start` (or equivalent) runs without errors
2. The stats bar shows real numbers from seeded data
3. The invoice table loads all 15 invoices, sorted red-first
4. Clicking "Send Offer" on an overdue invoice creates an offer and shows the purple badge
5. Clicking "Simulate Acceptance" marks the invoice paid and updates the feed
6. Withdrawing an offer removes the badge from the row
7. The stats bar updates after each action

When done, list every file you created.

---