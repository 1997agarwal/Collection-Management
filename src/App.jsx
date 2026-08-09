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

function suggestDiscount(daysPastDue) {
  if (daysPastDue >= 60) return 2.5;
  if (daysPastDue >= 30) return 1.5;
  if (daysPastDue >= 1)  return 1.0;
  return 0.5;
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toasts({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
            t.type === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stats }) {
  if (!stats) return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {[1,2,3,4].map(i => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 animate-pulse h-20" />
      ))}
    </div>
  );

  const cards = [
    {
      label: 'Total Open AR',
      value: fmt$(stats.total_open_ar),
      cls: 'text-[#1A3C5E]',
    },
    {
      label: 'Overdue Amount',
      value: fmt$(stats.overdue_amount),
      cls: stats.overdue_amount > 0 ? 'text-red-600' : 'text-gray-700',
    },
    {
      label: 'Active Offers',
      value: `${stats.active_offers} offer${stats.active_offers !== 1 ? 's' : ''}`,
      cls: 'text-[#7C3AED]',
    },
    {
      label: 'Cash Accelerated',
      value: fmt$(stats.cash_accelerated),
      cls: 'text-[#7C3AED]',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <div key={c.label} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{c.label}</p>
          <p className={`text-2xl font-bold ${c.cls}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Inline Offer Form ─────────────────────────────────────────────────────────
function OfferForm({ invoice, onSubmit, onCancel }) {
  const [pct, setPct] = useState(suggestDiscount(invoice.days_past_due));
  const [expiry, setExpiry] = useState(addDays(7));
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ invoice_id: invoice.id, discount_pct: parseFloat(pct), expiry_date: expiry });
    setLoading(false);
  }

  return (
    <tr className="bg-purple-50 border-l-4 border-purple-400">
      <td colSpan={8} className="px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-gray-700">
            Send early payment discount to <strong>{invoice.customer_name}</strong>
          </span>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Discount %</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="20"
              value={pct}
              onChange={e => setPct(e.target.value)}
              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Expires</label>
            <input
              type="date"
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#7C3AED] text-white px-4 py-1 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Confirm Offer'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Cancel
          </button>
        </form>
      </td>
    </tr>
  );
}

// ── Invoice Table ─────────────────────────────────────────────────────────────
function InvoiceTable({ invoices, loading, onSendOffer, onWithdraw }) {
  const [openFormId, setOpenFormId] = useState(null);

  function rowStyle(dpd) {
    if (dpd > 60) return 'border-l-4 border-red-500 bg-red-50';
    if (dpd > 30) return 'border-l-4 border-orange-400 bg-orange-50';
    if (dpd > 0)  return 'border-l-4 border-amber-400 bg-amber-50';
    return 'border-l-4 border-transparent bg-white';
  }

  function StatusBadge({ status }) {
    const cls = {
      overdue: 'bg-red-100 text-red-700',
      open:    'bg-gray-100 text-gray-600',
      paid:    'bg-green-100 text-green-700',
    }[status] || 'bg-gray-100 text-gray-600';
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  function OfferBadge({ inv }) {
    if (inv.offer_id && inv.offer_status === 'active') {
      return (
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
          💰 {inv.offer_pct}% offer · expires {fmtDate(inv.offer_expiry)}
        </span>
      );
    }
    if (inv.offer_id && inv.offer_status === 'accepted') {
      return (
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
          ✅ Paid early
        </span>
      );
    }
    return null;
  }

  async function handleSendOffer(data) {
    await onSendOffer(data);
    setOpenFormId(null);
  }

  if (loading && (!invoices || invoices.length === 0)) {
    return <div className="text-gray-500 py-8 text-center">Loading…</div>;
  }

  if (invoices && invoices.length === 0) {
    return (
      <div className="text-gray-500 py-16 text-center">
        No invoices found. Add some via the seed script.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1A3C5E] text-white">
            {['#', 'Customer', 'Amount', 'Due Date', 'Days Past Due', 'Status', 'Offer', 'Action'].map(h => (
              <th key={h} className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {(invoices || []).map(inv => (
            <React.Fragment key={inv.id}>
              <tr className={`${rowStyle(inv.days_past_due)} hover:brightness-95 transition-all`}>
                <td className="px-3 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">{inv.invoice_number}</td>
                <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">{inv.customer_name}</td>
                <td className="px-3 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{fmt$(inv.amount)}</td>
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(inv.due_date)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {inv.days_past_due > 0 ? (
                    <span className={`font-bold ${inv.days_past_due > 60 ? 'text-red-600' : inv.days_past_due > 30 ? 'text-orange-600' : 'text-amber-600'}`}>
                      {inv.days_past_due}d
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5"><StatusBadge status={inv.status} /></td>
                <td className="px-3 py-2.5"><OfferBadge inv={inv} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {inv.status === 'paid' ? null : inv.offer_id && inv.offer_status === 'active' ? (
                    <button
                      onClick={() => onWithdraw(inv.offer_id)}
                      className="text-xs px-3 py-1 border border-gray-300 rounded bg-white text-gray-600 hover:bg-gray-50"
                    >
                      Withdraw
                    </button>
                  ) : !inv.offer_id || inv.offer_status === 'expired' || inv.offer_status === 'withdrawn' ? (
                    <button
                      onClick={() => setOpenFormId(openFormId === inv.id ? null : inv.id)}
                      className="text-xs px-3 py-1 bg-[#7C3AED] text-white rounded hover:bg-purple-700"
                    >
                      Send Offer
                    </button>
                  ) : null}
                </td>
              </tr>
              {openFormId === inv.id && (
                <OfferForm
                  key={`form-${inv.id}`}
                  invoice={inv}
                  onSubmit={handleSendOffer}
                  onCancel={() => setOpenFormId(null)}
                />
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────────────────
function ActivityFeed({ activity, onSimulateAccept }) {
  if (!activity) return <div className="text-gray-400 text-sm py-4 text-center">Loading…</div>;

  const totalSaved = activity
    .filter(a => a.status === 'accepted')
    .reduce((sum, a) => sum + a.discount_amount, 0);

  function itemIcon(status) {
    if (status === 'accepted') return '✅';
    if (status === 'expired' || status === 'withdrawn') return '❌';
    return '💰';
  }

  function StatusLabel({ a }) {
    if (a.status === 'active') {
      return <span className="inline-flex items-center gap-1 text-xs text-purple-700 font-medium"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />Active</span>;
    }
    if (a.status === 'accepted') {
      return <span className="text-xs text-green-700 font-medium">✅ Paid early — saved {fmt$(a.discount_amount)}</span>;
    }
    return (
      <span className="text-xs text-gray-400 line-through">
        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
      </span>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 max-h-[520px]">
        {activity.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No offer activity yet.</p>
        )}
        {activity.map(a => (
          <div key={a.id} className={`py-3 px-1 ${(a.status === 'expired' || a.status === 'withdrawn') ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {itemIcon(a.status)} {a.customer_name} — {a.invoice_number}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Offered {a.discount_pct}% discount · {fmt$(a.discount_amount)} savings
                </p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <StatusLabel a={a} />
                  <span className="text-xs text-gray-400">{fmtDate(a.created_at)}</span>
                </div>
              </div>
              {a.status === 'active' && (
                <button
                  onClick={() => onSimulateAccept(a.id, a.customer_name)}
                  className="flex-shrink-0 text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 whitespace-nowrap"
                >
                  Simulate Acceptance
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="pt-3 mt-3 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          Total saved by early payment this session:{' '}
          <span className="font-bold text-[#7C3AED]">{fmt$(totalSaved)}</span>
        </p>
      </div>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [invoices, setInvoices] = useState(null);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);
  const [toasts, setToasts] = useState([]);
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
    } catch (e) {
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
    <div className="min-h-screen bg-[#F8FAFC]">
      <Toasts toasts={toasts} />

      {/* Header */}
      <header className="bg-[#1A3C5E] text-white px-6 py-4 shadow-md">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">ClearAR</h1>
            <p className="text-blue-200 text-xs mt-0.5">Collections &amp; Early Payment Platform</p>
          </div>
          <div className="text-xs text-blue-300">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-6 py-6">
        {/* Section 1 — Stats */}
        <StatsBar stats={stats} />

        {/* Sections 2 + 3 — 70/30 layout */}
        <div className="flex gap-4">
          {/* Invoice Table — 70% */}
          <div className="flex-[7] min-w-0 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-white">
              <h2 className="text-sm font-bold text-[#1A3C5E]">Invoice Workqueue</h2>
              <p className="text-xs text-gray-500 mt-0.5">Ranked by payment risk — act on red rows first</p>
            </div>
            <InvoiceTable
              invoices={invoices}
              loading={!invoices}
              onSendOffer={handleSendOffer}
              onWithdraw={handleWithdraw}
            />
          </div>

          {/* Activity Feed — 30% */}
          <div className="flex-[3] min-w-0 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h2 className="text-sm font-bold text-[#1A3C5E] mb-3">Recent Offer Activity</h2>
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
