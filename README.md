# ClearAR — B2B Accounts Receivable Collections & Early Payment Accelerator

ClearAR is a modern, high-performance B2B Accounts Receivable (AR) management and cash acceleration platform built for finance, AR, and credit management teams. It empowers organizations to reduce Days Sales Outstanding (DSO), manage overdue invoices, resolve customer disputes, track Promises to Pay (PTP), evaluate customer credit risk, and launch targeted early-payment liquidity campaigns.

---

## 🌟 Key Features

### 📊 1. Collections Workqueue & Dashboard
- **Real-Time AR Metrics**: Instant visibility into Total Open AR, Overdue Amount, Active Offers, Accelerated Cash, Avg Days Past Due, Open Disputes, and DSO.
- **Dynamic Discount Suggestions**: Automatic early payment discount rate calculations based on invoice delinquency (e.g. 0.5% for current up to 2.5% for >60 days overdue).
- **Interactive Dunning Workqueue**: Quick action workflows to issue early payment offers or record customer engagements directly from the main feed.

### 📑 2. Detailed Invoice Management & Side Drawer
- Filter invoices across **Open**, **Overdue**, and **Paid** statuses.
- **Deep-Dive Drawer**: Click any invoice to inspect customer profiles, active discount offers, active payment promises, open disputes, and a full chronological activity log.

### ⚖️ 3. Dispute Resolution Workflow
- Log customer disputes categorized by type (*Price discrepancy*, *Quantity error*, *Quality issue*, etc.).
- SLA date tracking to ensure timely resolution by finance teams.
- **Automated Offer Suspension**: Automatically withdraws active discount offers when an invoice enters dispute to prevent unauthorized discount claims.

### 🤝 4. Promises to Pay (PTP) Tracking
- Record promised payment dates, notes, and commitment amounts.
- Automated status progression:
  - **Kept**: Automatically marks the invoice as paid.
  - **Broken**: Resumes dunning activity and logs broken promise history in customer intelligence profiles.

### 🧠 5. Customer Intelligence & Risk Grading
- **Collection Risk Ratings**: Categorizes accounts as *Easy*, *Moderate*, *Medium*, *High Risk*, or *Risky* based on payment history and dispute frequency.
- **Behavioral Analytics**: Tracks average days to pay, preferred payment day of month, payment cycles (*weekly*, *mid-month*, *end-of-month*, *irregular*), on-time rate, and lifetime paid amounts.
- **Trend Analysis**: Detects payment slowdowns or improvements across historic payment cycles.

### ⚡ 6. Smart Liquidity Campaigns
- Target high-value, eligible accounts with bulk early payment discount offers (5% – 20%).
- Set strict offer deadlines and financial rationale.
- Track campaign status (*pending*, *accepted*, *declined*).

### 🛍️ 7. Interactive Buyer Portal Simulation
- Simulates the buyer experience allowing end customers to review pending early payment discount offers and liquidity campaigns.
- One-click acceptance/rejection flow that instantly updates invoice statuses and accelerates cash flow.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite 8, Tailwind CSS (via CDN)
- **Backend**: Node.js, Express 5, CORS, Concurrently
- **Database**: SQLite using `better-sqlite3` (WAL mode enabled for high concurrency)

---

## 📁 Project Structure

```
.
├── server/
│   └── index.js          # Express API server, SQLite schema setup & data seeders
├── src/
│   ├── App.jsx           # Main React Single Page Application (Views, Components, Drawers)
│   └── main.jsx          # React application entry point
├── data/
│   └── clearar.db        # SQLite database (auto-created on first run, gitignored)
├── index.html            # Main HTML document with Tailwind CDN inclusion
├── vite.config.js        # Vite configuration with /api reverse proxy to port 3001
├── package.json          # Project metadata, dependencies, and execution scripts
├── replit.md             # Development environment instructions
└── README.md             # Project documentation
```

---

## 🗄️ Database Architecture

The SQLite database (`data/clearar.db`) includes the following core schemas:

- `customers`: Customer master records.
- `invoices`: Invoice records with status tracking (`open`, `overdue`, `paid`).
- `discount_offers`: Early payment discount offers sent to buyers.
- `disputes`: Customer invoice disputes and resolution SLAs.
- `promises_to_pay`: Payment commitments logged by AR collectors.
- `activity_log`: Audit trail of all actions performed on invoices.
- `customer_profiles`: Behavioral risk scores, payment cycles, and liquidity eligibility.
- `payment_history`: Historic invoice payment logs and metrics.
- `liquidity_campaigns`: Bulk targeted early payment discount campaigns.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ recommended
- **npm**: v9+ recommended

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/1997agarwal/Collection-Management.git
   cd Collection-Management
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the application:
   ```bash
   npm start
   ```

   `npm start` uses `concurrently` to launch:
   - **Backend API**: `http://localhost:3001`
   - **Frontend App**: `http://localhost:5000`

---

## 🌐 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/stats` | Retrieves top-level AR summary metrics |
| `GET` | `/api/invoices` | Fetches all invoices with customer details & active offers |
| `GET` | `/api/invoices/:id` | Fetches single invoice details with active offers, PTP & disputes |
| `POST` | `/api/offers` | Creates an early payment discount offer for an invoice |
| `POST` | `/api/offers/:id/accept` | Accepts a discount offer and marks the invoice as paid |
| `POST` | `/api/offers/:id/withdraw` | Withdraws an active discount offer |
| `GET` | `/api/disputes` | Retrieves all customer disputes |
| `POST` | `/api/disputes` | Logs a new dispute and suspends active offers |
| `GET` | `/api/promises` | Fetches all Promises to Pay |
| `POST` | `/api/promises` | Logs a new Promise to Pay |
| `PATCH` | `/api/promises/:id/status` | Updates PTP status (`kept`, `broken`) |
| `GET` | `/api/customers/intelligence` | Fetches customer risk profiles and payment analytics |
| `GET` | `/api/liquidity/eligible` | Lists accounts eligible for targeted liquidity campaigns |
| `POST` | `/api/liquidity/campaigns` | Creates a new bulk liquidity discount campaign |
