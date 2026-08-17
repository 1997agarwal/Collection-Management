# SmartCollect AI — Collection Management Platform

## What This Is

Harshit's product side project for solving AR (Accounts Receivable) collection pain points at Tekion's dealership network. Harshit works on AR at Tekion — collections is a major pain point for the dealerships they serve.

**Two core goals:**
1. **Early Payment Acceleration** — incentivize buyers to pay before due date via targeted discount offers
2. **Receivables Reduction on Time** — prioritize collection effort, track promises to pay, resolve disputes, reduce DSO

**Product evolution:**
- `ClearAR` — the functional MVP (fully built, running)
- `SmartCollect AI` — the AI-first vision (designed as prototype, not yet built in React)

---

## Running the App

```bash
npm start        # Express API on :3001 + Vite frontend on :5000
```

The Vite dev server proxies `/api` → Express. SQLite DB auto-creates at `data/clearar.db` on first run.
Node 22+ required (uses built-in `node:sqlite` module, NOT the npm `better-sqlite3` package).

---

## Folder Structure

```
server/index.js          — Express API + SQLite schema + all routes (615 lines)
src/App.jsx              — React SPA — all 8 views (1569 lines)
src/main.jsx             — React entry point
data/clearar.db          — SQLite DB (gitignored, auto-seeded)
index.html               — HTML shell with Tailwind CDN
vite.config.js           — Vite config with /api proxy
package.json             — Stack: React 18, Vite 6, Express 4, concurrently
docs/                    — PRDs, design prompts, feature checklist, handoff notes
prototypes/              — SmartCollect AI HTML prototype (high-fidelity)
prompts/                 — Replit build prompts (historical reference)
```

---

## What's Already Built (ClearAR)

### Backend — `server/index.js`

All 9 SQLite tables with schema + seed data. Full API:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/stats` | KPI metrics (AR, overdue, DSO, disputes, offers) |
| GET/POST | `/api/invoices` | All invoices with customer + active offer |
| GET | `/api/invoices/:id` | Single invoice + offer + PTP + dispute + activity log |
| POST | `/api/offers` | Create early payment discount offer |
| POST | `/api/offers/:id/accept` | Accept offer → marks invoice paid |
| POST | `/api/offers/:id/withdraw` | Withdraw active offer |
| GET/POST | `/api/disputes` | Dispute management (auto-withdraws offer on creation) |
| PATCH | `/api/disputes/:id/status` | Update dispute status |
| GET/POST | `/api/promises` | Promises to Pay |
| PATCH | `/api/promises/:id/status` | Mark PTP kept (→ paid) or broken |
| POST | `/api/activity` | Log activity entry |
| GET | `/api/customers/intelligence` | Risk profiles + payment trend + next expected payment |
| GET | `/api/customers/:id/payment-history` | 8-month payment history |
| GET | `/api/liquidity/eligible` | Customers eligible for bulk campaigns |
| GET/POST | `/api/liquidity/campaigns` | Bulk liquidity discount campaigns |
| PATCH | `/api/liquidity/campaigns/:id/respond` | Accept/decline campaign |

### Frontend — `src/App.jsx`

8 views navigated via left sidebar (210px). All state in top-level `App` component.

| View ID | Label | What It Does |
|---------|-------|-------------|
| `workqueue` | Workqueue | Invoice table ranked by risk, color-coded rows, inline offer form, row click opens detail drawer |
| `invoices` | Invoices | Full invoice list with filter pills + aging badges (current/1-30/31-60/61-90/90+ DPD) |
| `disputes` | Disputes | Dispute list with SLA countdown, new dispute form, status workflow (open → under_review → resolved) |
| `promises` | Promises to Pay | PTP cards with mark-kept / mark-broken actions |
| `intel` | Customer Intel | Risk grade cards (Easy/Moderate/Medium/High Risk/Risky), payment sparklines, behavioral metrics |
| `offers` | Offers | Early payment offer activity feed + buyer acceptance simulation |
| `smart` | Smart Offers | Liquidity campaign builder for eligible customers (5-20% discount slider, deadline picker) |
| `buyer` | Buyer Portal | Simulated buyer-side acceptance flow with sticky checkout bar |

**Sidebar bottom:** DSO meter (colored red/amber/green vs 30-day target)

**Drawer system:** Invoice detail drawer opens on row click — shows offer/PTP/dispute alerts + activity log + quick action buttons.

### Database Seed Data (5 customers)

| Customer | Grade | Behavior |
|----------|-------|---------|
| Meridian Industrial | Risky | 52d avg, 60% late, 2 broken PTPs, 3 disputes |
| Apex Logistics Group | Easy | 8d avg, 88% on-time, mid-month payer — **eligible for liquidity offers** |
| BlueSky Technologies | Moderate | 28d avg, 62% on-time, mixed payer |
| Granite Construction | Easy | 5d avg, 95% on-time, 45% early — **eligible for liquidity offers** |
| Pinnacle Retail Co. | High Risk | 41d avg, 55% late, irregular |

---

## What's Designed But Not Built (SmartCollect AI Gap)

See `prototypes/SmartCollect_AI_v2.html` for the full interactive prototype.
See `docs/SmartCollect_AI_Design_Prompt.md` for the product brief.
See `docs/SmartCollect_AI_Handoff.md` for implementation notes.

The AI prototype targets integration into **Tekion ARC** at route `/accounting/ar-insights`.
Uses **Arcade Design System** (internal Tekion component library).

### Features to Build

**Priority 1 — AI Risk Engine:**
- Score 0–100 per account using: outstanding amount, weighted avg days to pay, invoice aging, payment consistency, PTP reliability, disputes, credit utilization
- Every score must surface top 3 contributing factors as plain-language strings
- Risk levels: Critical (80-100), High (60-80), Medium (40-60), Low (0-40)

**Priority 2 — AI Command Center (replace current workqueue):**
- AI Daily Brief: "5 high-risk accounts totaling $7.9M require action today"
- Priority Worklist with AI rank + "Why Now" column (AI signal column)
- Morning KPIs: Total Outstanding, Risk Alerts, Projected Cash Flow, Active Disputes

**Priority 3 — AI Copilot SideSheet:**
- Conversational panel answering natural-language queries
- Prebuilt queries: "Who should I call first?", "Why did DSO increase?", "Predict recovery"
- Every AI response: Summary + Evidence + Confidence + Recommended Next Action
- Wire to Claude API (`claude-sonnet-5` or `claude-haiku-4-5-20251001`) in production

**Priority 4 — Forecasting Tab:**
- DSO 90-day forecast (no-action vs AI-guided trajectories)
- Expected Cash Inflow — 4-week bar chart
- 30-Day Recovery Forecast: Likely to Pay / At Risk / Likely to Default
- Accounts Likely to Default table

**Priority 5 — Intelligent Outreach:**
- AI-drafted personalized emails by tone: Friendly / Professional / Urgent / Executive Escalation
- AI explains why it selected this tone for this customer
- Channels: Email, SMS, Portal Notification, Phone Talking Points

**Priority 6 — Tekion ARC Integration:**
- Replace custom Tailwind styles with Arcade Design System components
- Module entry point in Accounting app module registry
- Tab-based routing for deep-linking

---

## Design Language (Current ClearAR)

Colors:
- Navy `#1A3C5E` — headers, primary buttons, Collections nav active
- Teal `#0F766E` — collection actions
- Purple `#7C3AED` — early payment, offers
- Background `#F8FAFC`
- Success `#059669`, Error `#DC2626`, Warning `#D97706`

Grade colors: Easy `#1D9E75`, Moderate `#185FA5`, Medium `#D97706`, High Risk `#EA580C`, Risky `#E24B4A`

---

## Key Technical Decisions

- **Node built-in sqlite** (`node:sqlite` / `DatabaseSync`) — requires Node 22+, zero npm dependency
- **WAL mode** enabled for SQLite concurrency
- **React SPA, no router** — `activeView` state string controls which view renders
- **Drawer not modal** — detail views slide in from the right (440px wide) without page nav
- **No auth** — single-user tool, no login required for MVP
- **Tailwind via CDN** — no build step for styles; just classes in JSX

---

## Reference Documents (in `docs/`)

| File | What It Contains |
|------|-----------------|
| `Tekion_ARC_Collections_PRD_v1.0.docx` | Original product requirements |
| `Tekion_ARC_Collections_PRD_v1.1.docx` | Updated PRD v1.1 |
| `ARC_Collections_Feature_Checklist_v1.1.xlsx` | Feature-by-feature build checklist |
| `SmartCollect_AI_Design_Prompt.md` | Full design brief — 7 modules, AI rules, risk engine spec |
| `SmartCollect_AI_Handoff.md` | Implementation handoff — screen-by-screen spec with Arcade DS components |
