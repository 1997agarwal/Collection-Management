import React, { useState, useEffect, useCallback, useRef } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt$(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str + (str.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function suggestDiscount(dpd) {
  if (dpd >= 60) return 2.5;
  if (dpd >= 30) return 1.5;
  if (dpd >= 1)  return 1.0;
  return 0.5;
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Deterministic color palette for company avatars
const AVATAR_COLORS = [
  'bg-blue-600', 'bg-violet-600', 'bg-emerald-600',
  'bg-rose-600',  'bg-amber-600', 'bg-cyan-600',
  'bg-fuchsia-600','bg-teal-600',
];
const colorCache = {};
function avatarColor(name) {
  if (!colorCache[name]) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    colorCache[name] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  }
  return colorCache[name];
}
function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toasts({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`px-4 py-3 rounded-xl shadow-xl text-white text-sm font-medium flex items-center gap-2 pointer-events-auto
            ${t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          <span>{t.type === 'error' ? '✕' : '✓'}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
const KPI_META = [
  { key: 'total_open_ar',    label: 'Total Open AR',    sub: 'open + overdue',          accent: 'bg-[#1A3C5E]',  fmt: fmt$ },
  { key: 'overdue_amount',   label: 'Overdue Amount',   sub: 'past due today',           accent: 'bg-red-500',    fmt: fmt$, red: true },
  { key: 'active_offers',    label: 'Active Offers',    sub: 'awaiting response',        accent: 'bg-violet-500', fmt: v => `${v}` },
  { key: 'cash_accelerated', label: 'Cash Accelerated', sub: 'collected early',          accent: 'bg-emerald-500',fmt: fmt$ },
];

function KpiCards({ stats }) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {KPI_META.map(m => {
        const val = stats ? m.fmt(stats[m.key]) : null;
        return (
          <div key={m.key}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 pt-4 pb-3 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">{m.label}</p>
              {val == null
                ? <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
                : <p className={`text-2xl font-bold ${m.red && stats[m.key] > 0 ? 'text-red-600' : m.key === 'active_offers' ? 'text-violet-700' : m.key === 'cash_accelerated' ? 'text-emerald-700' : 'text-[#1A3C5E]'}`}>
                    {val}
                  </p>
              }
              <p className="text-xs text-gray-400 mt-1">{m.sub}</p>
            </div>
            <div className={`h-1 w-full ${m.accent}`} />
          </div>
        );
      })}
    </div>
  );
}

// ── Filter Pills ──────────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',     label: 'All Invoices' },
  { id: 'overdue', label: '🔴 Overdue' },
  { id: 'open',    label: '⚪ Open' },
  { id: 'offer',   label: '💰 Has Active Offer' },
  { id: 'paid',    label: '✅ Paid' },
];

function FilterPills({ active, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap mb-3">
      {FILTERS.map(f => (
        <button key={f.id} onClick={() => onChange(f.id)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all
            ${active === f.id
              ? 'bg-[#1A3C5E] text-white border-[#1A3C5E]'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ── Avatar Chip ───────────────────────────────────────────────────────────────
function Avatar({ name }) {
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold flex-shrink-0 ${avatarColor(name)}`}>
      {initials(name)}
    </span>
  );
}

// ── Inline Offer Form ─────────────────────────────────────────────────────────
function OfferFormRow({ invoice, onSubmit, onCancel }) {
  const [pct, setPct]       = useState(suggestDiscount(invoice.days_past_due));
  const [expiry, setExpiry] = useState(addDays(7));
  const [loading, setLoading] = useState(false);

  const discountAmt   = invoice.amount * pct / 100;
  const buyerPays     = invoice.amount - discountAmt;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ invoice_id: invoice.id, discount_pct: parseFloat(pct), expiry_date: expiry });
    setLoading(false);
  }

  return (
    <tr className="bg-violet-50">
      <td colSpan={8} className="px-5 py-4 border-l-4 border-violet-400">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-violet-900">
            💸 Send early payment discount to <strong>{invoice.customer_name}</strong>
            <span className="font-normal text-violet-600 ml-1">· {invoice.invoice_number} · {fmt$(invoice.amount)}</span>
          </p>
          <form onSubmit={handleSubmit} className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Discount %</label>
              <input type="number" step="0.1" min="0.1" max="20"
                value={pct}
                onChange={e => setPct(e.target.value)}
                className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                required />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wide">Expires</label>
              <input type="date" value={expiry}
                onChange={e => setExpiry(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                required />
            </div>
            {/* Real-time calculation */}
            {pct > 0 && (
              <div className="bg-white border border-violet-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 flex gap-3">
                <span>Buyer pays <strong className="text-emerald-700">{fmt$(buyerPays)}</strong></span>
                <span className="text-gray-300">·</span>
                <span>Saves <strong className="text-violet-700">{fmt$(discountAmt)}</strong></span>
              </div>
            )}
            <button type="submit" disabled={loading}
              className="bg-violet-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {loading ? 'Sending…' : 'Confirm Offer'}
            </button>
            <button type="button" onClick={onCancel}
              className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors">
              Cancel
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

// ── Invoice Table ─────────────────────────────────────────────────────────────
function dpd_severity(dpd, status) {
  if (status === 'paid') return 'paid';
  if (dpd >= 60) return 'critical';
  if (dpd >= 8)  return 'warning';
  if (dpd >= 1)  return 'mild';
  return 'current';
}

const SEV = {
  critical: { border: 'border-l-4 border-red-500',    bg: 'bg-red-50',    text: 'text-red-600',    badge: 'bg-red-100 text-red-700' },
  warning:  { border: 'border-l-4 border-orange-400', bg: 'bg-orange-50', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  mild:     { border: 'border-l-4 border-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700' },
  current:  { border: 'border-l-4 border-emerald-400',bg: 'bg-white',     text: 'text-emerald-600',badge: 'bg-emerald-100 text-emerald-700' },
  paid:     { border: 'border-l-4 border-gray-200',   bg: 'bg-white',     text: 'text-gray-400',   badge: 'bg-gray-100 text-gray-500' },
};

function StatusBadge({ status }) {
  const cls = {
    overdue: 'bg-red-100 text-red-700',
    open:    'bg-gray-100 text-gray-600',
    paid:    'bg-emerald-100 text-emerald-700',
  }[status] || 'bg-gray-100 text-gray-500';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function OfferBadge({ inv }) {
  if (inv.offer_id && inv.offer_status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
        💰 {inv.offer_pct}% · exp {fmtDate(inv.offer_expiry)}
      </span>
    );
  }
  if (inv.offer_id && inv.offer_status === 'accepted') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
        ✅ Paid early
      </span>
    );
  }
  return <span className="text-gray-300 text-xs">—</span>;
}

function InvoiceTable({ invoices, onSendOffer, onWithdraw }) {
  const [openFormId, setOpenFormId] = useState(null);
  const [filter, setFilter]         = useState('all');

  const filtered = (invoices || []).filter(inv => {
    if (filter === 'all')     return true;
    if (filter === 'overdue') return inv.status === 'overdue';
    if (filter === 'open')    return inv.status === 'open';
    if (filter === 'paid')    return inv.status === 'paid';
    if (filter === 'offer')   return inv.offer_id && inv.offer_status === 'active';
    return true;
  });

  async function handleSendOffer(data) {
    await onSendOffer(data);
    setOpenFormId(null);
  }

  if (!invoices) return (
    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading…</div>
  );
  if (invoices.length === 0) return (
    <div className="text-center py-16 text-gray-400 text-sm">No invoices found. Add some via the seed script.</div>
  );

  return (
    <div>
      <FilterPills active={filter} onChange={setFilter} />
      <div className="overflow-x-auto rounded-b-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#1A3C5E] text-white text-xs uppercase tracking-wide">
              {['', '#', 'Customer', 'Amount', 'Due Date', 'Days Past Due', 'Status', 'Offer', 'Action'].map((h, i) => (
                <th key={i} className={`text-left px-3 py-3 font-semibold whitespace-nowrap ${i === 0 ? 'w-1' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400 text-sm">No invoices match this filter.</td></tr>
            )}
            {filtered.map(inv => {
              const sev = dpd_severity(inv.days_past_due, inv.status);
              const s   = SEV[sev];
              const canOffer = inv.status !== 'paid' && !(inv.offer_id && inv.offer_status === 'active');
              const hasActiveOffer = inv.offer_id && inv.offer_status === 'active';

              return (
                <React.Fragment key={inv.id}>
                  <tr className={`${s.border} ${s.bg} hover:brightness-[0.97] transition-all`}>
                    {/* color swatch cell */}
                    <td className="w-1 px-0" />
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{inv.invoice_number}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Avatar name={inv.customer_name} />
                        <span className="font-medium text-gray-800">{inv.customer_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{fmt$(inv.amount)}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(inv.due_date)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {inv.days_past_due > 0
                        ? <span className={`font-bold ${s.text}`}>{inv.days_past_due}d</span>
                        : <span className="text-emerald-500 font-medium text-xs">On time</span>}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={inv.status} /></td>
                    <td className="px-3 py-2.5"><OfferBadge inv={inv} /></td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {inv.status === 'paid' ? (
                        <span className="text-gray-300 text-xs">—</span>
                      ) : hasActiveOffer ? (
                        <button onClick={() => onWithdraw(inv.offer_id)}
                          className="text-xs px-3 py-1 border border-gray-300 rounded-lg bg-white text-gray-500 hover:bg-gray-50 transition-colors">
                          Withdraw
                        </button>
                      ) : (
                        <button
                          onClick={() => setOpenFormId(openFormId === inv.id ? null : inv.id)}
                          className="text-xs px-3 py-1 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium">
                          Send Offer
                        </button>
                      )}
                    </td>
                  </tr>
                  {openFormId === inv.id && (
                    <OfferFormRow
                      key={`form-${inv.id}`}
                      invoice={inv}
                      onSubmit={handleSendOffer}
                      onCancel={() => setOpenFormId(null)}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────────────────
function FeedIcon({ status }) {
  if (status === 'accepted') return <span className="text-emerald-500 text-base leading-none">✅</span>;
  if (status === 'expired')  return <span className="text-gray-400 text-base leading-none">⏱</span>;
  if (status === 'withdrawn')return <span className="text-gray-400 text-base leading-none">↩</span>;
  return <span className="text-violet-500 text-base leading-none">💰</span>;
}

function ActivityFeed({ activity, onSimulateAccept }) {
  if (!activity) return <div className="text-gray-400 text-sm py-4 text-center">Loading…</div>;

  const totalSaved = activity
    .filter(a => a.status === 'accepted')
    .reduce((sum, a) => sum + a.discount_amount, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 max-h-[520px] pr-1">
        {activity.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No offer activity yet.</p>
        )}
        {activity.map(a => {
          const faded = a.status === 'expired' || a.status === 'withdrawn';
          return (
            <div key={a.id} className={`py-3 ${faded ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex-shrink-0"><FeedIcon status={a.status} /></div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${faded ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {a.customer_name}
                    <span className="font-normal text-gray-400 ml-1 text-xs">— {a.invoice_number}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.discount_pct}% discount · {fmt$(a.discount_amount)} savings
                  </p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {a.status === 'active' && (
                      <span className="inline-flex items-center gap-1 text-xs text-violet-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block animate-pulse" />
                        Active
                      </span>
                    )}
                    {a.status === 'accepted' && (
                      <span className="text-xs text-emerald-700 font-medium">
                        Paid early — saved {fmt$(a.discount_amount)}
                      </span>
                    )}
                    {(a.status === 'expired' || a.status === 'withdrawn') && (
                      <span className="text-xs text-gray-400 capitalize">{a.status}</span>
                    )}
                    <span className="text-xs text-gray-300">{fmtDate(a.created_at)}</span>
                  </div>
                  {a.status === 'active' && (
                    <button onClick={() => onSimulateAccept(a.id, a.customer_name)}
                      className="mt-1.5 text-xs px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap font-medium">
                      Simulate Acceptance
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="pt-3 mt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Total saved by early payment:{' '}
          <span className="font-bold text-emerald-700">{fmt$(totalSaved)}</span>
        </p>
      </div>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [invoices, setInvoices] = useState(null);
  const [stats, setStats]       = useState(null);
  const [activity, setActivity] = useState(null);
  const [toasts, setToasts]     = useState([]);
  const toastId = useRef(0);

  function toast(msg, type = 'success') {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }

  const fetchAll = useCallback(async () => {
    try {
      const [inv, st, act] = await Promise.all([
        fetch('/api/invoices').then(r => r.json()),
        fetch('/api/stats').then(r => r.json()),
        fetch('/api/activity').then(r => r.json()),
      ]);
      setInvoices(inv);
      setStats(st);
      setActivity(act);
    } catch {
      toast('Failed to load data', 'error');
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleSendOffer(data) {
    try {
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error || 'Failed to send offer', 'error');
        return;
      }
      await fetchAll();
      toast('Offer sent!');
    } catch {
      toast('Failed to send offer', 'error');
    }
  }

  async function handleWithdraw(offerId) {
    try {
      const res = await fetch(`/api/offers/${offerId}/withdraw`, { method: 'POST' });
      if (!res.ok) { toast('Failed to withdraw offer', 'error'); return; }
      await fetchAll();
      toast('Offer withdrawn.');
    } catch {
      toast('Failed to withdraw offer', 'error');
    }
  }

  async function handleSimulateAccept(offerId, customerName) {
    try {
      const res = await fetch(`/api/offers/${offerId}/accept`, { method: 'POST' });
      if (!res.ok) { toast('Failed to accept offer', 'error'); return; }
      await fetchAll();
      toast(`✅ ${customerName} accepted the offer! Invoice marked paid.`);
    } catch {
      toast('Failed to simulate acceptance', 'error');
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <Toasts toasts={toasts} />

      {/* Header */}
      <header className="bg-[#1A3C5E] text-white px-6 py-3 shadow-lg">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm font-black">C</div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none">ClearAR</h1>
              <p className="text-blue-300 text-[10px] mt-0.5 leading-none">Collections &amp; Early Payment</p>
            </div>
          </div>
          <div className="text-xs text-blue-300">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-6 py-5">
        {/* KPI Cards */}
        <KpiCards stats={stats} />

        {/* Body — 70/30 */}
        <div className="flex gap-4">
          {/* Invoice Table */}
          <div className="flex-[7] min-w-0 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1A3C5E]">Invoice Workqueue</h2>
                <p className="text-xs text-gray-400 mt-0.5">Ranked by payment risk — act on red rows first</p>
              </div>
              {invoices && (
                <span className="text-xs text-gray-400 font-medium">{invoices.length} invoices</span>
              )}
            </div>
            <div className="px-5 pt-3">
              <InvoiceTable
                invoices={invoices}
                onSendOffer={handleSendOffer}
                onWithdraw={handleWithdraw}
              />
            </div>
          </div>

          {/* Activity Feed */}
          <div className="flex-[3] min-w-0 bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-bold text-[#1A3C5E] mb-3 pb-2 border-b border-gray-100">
              Recent Offer Activity
            </h2>
            <ActivityFeed
              activity={activity}
              onSimulateAccept={handleSimulateAccept}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
