# ClearAR — AR Collections & Early Payment Tool

A minimal B2B tool for finance teams to track overdue invoices, send early payment discount offers, and monitor cash acceleration.

## Stack
- **Frontend**: React + Vite (port 5000)
- **Backend**: Node.js + Express (port 3001)
- **Database**: SQLite via `better-sqlite3` (stored in `data/clearar.db`)
- **Styling**: Tailwind CSS via CDN

## Running the App
```
npm start
```
This runs both the Express API server (port 3001) and the Vite dev server (port 5000) concurrently. The Vite server proxies `/api` requests to Express.

## Project Structure
```
server/index.js   — Express API + SQLite schema + seed data
src/App.jsx       — Main React SPA (stats, invoice table, activity feed)
src/main.jsx      — React entry point
index.html        — HTML shell with Tailwind CDN
vite.config.js    — Vite config with /api proxy
data/clearar.db   — SQLite database (auto-created on first run, gitignored)
```

## Database
Auto-seeded on first run with 5 customers, 15 invoices, and 3 sample discount offers. Delete `data/clearar.db` to reset.

## User Preferences
- Desktop-only MVP (1280px), no auth, no email sending.
