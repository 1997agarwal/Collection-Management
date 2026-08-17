import React, { useState, useEffect, useCallback, useRef } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = n => '$' + Math.round(n).toLocaleString('en-US');
const fmtDate = str => {
  if (!str) return '—';
  const d = new Date(str + (str.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const todayPlus = n => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const suggestDiscount = dpd => dpd >= 60 ? 2.5 : dpd >= 30 ? 1.5 : dpd >= 1 ? 1.0 : 0.5;
const daysBetween = (a, b = new Date()) => {
  const d = new Date(a + (a.length === 10 ? 'T00:00:00' : ''));
  return Math.round((d - b) / 864e5);
};

const AVATAR_PALETTE = [
  ['#1A3C5E','#fff'],['#7C3AED','#fff'],['#0F766E','#fff'],
  ['#DC2626','#fff'],['#D97706','#fff'],['#0891B2','#fff'],
  ['#7C3AED','#fff'],['#065F46','#fff'],
];
const _ac = {};
function avatarMeta(name) {
  if (!_ac[name]) {
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    _ac[name] = AVATAR_PALETTE[h % AVATAR_PALETTE.length];
  }
  return _ac[name];
}
function getInitials(name) { return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

function AvatarChip({ name, size = 32 }) {
  const [bg, tc] = avatarMeta(name);
  const fs = Math.round(size * 0.38);
  return (
    <div style={{ width: size, height: size, borderRadius: 8, background: bg, color: tc,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: fs, fontWeight: 600, flexShrink: 0 }}>
      {getInitials(name)}
    </div>
  );
}

const BADGE_STYLES = {
  red:    { background:'#FECACA', color:'#7F1D1D' },
  amber:  { background:'#FEF3C7', color:'#78350F' },
  green:  { background:'#D1FAE5', color:'#064E3B' },
  blue:   { background:'#DBEAFE', color:'#1E3A8A' },
  purple: { background:'#EDE9FE', color:'#4C1D95' },
  gray:   { background:'#F3F4F6', color:'#374151' },
};
function Badge({ text, color = 'gray' }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', padding:'2px 8px',
      borderRadius:9999, fontSize:11, fontWeight:500, whiteSpace:'nowrap',
      ...BADGE_STYLES[color]
    }}>{text}</span>
  );
}

const GRADE_COLORS = {
  easy:'#1D9E75', moderate:'#185FA5', medium:'#D97706', high_risk:'#EA580C', risky:'#E24B4A'
};
function gradeColor(g) { return GRADE_COLORS[g] || '#6B7280'; }
function gradeLabel(g) { return { easy:'Easy', moderate:'Moderate', medium:'Medium', high_risk:'High Risk', risky:'Risky' }[g] || g; }
function gradeBadgeColor(g) { return { easy:'green', moderate:'blue', medium:'amber', high_risk:'amber', risky:'red' }[g] || 'gray'; }

const PRIORITY_STYLES = {
  P1: { color:'#DC2626', bg:'#FEF2F2', border:'#EF4444', badge:'red' },
  P2: { color:'#EA580C', bg:'#FFF7ED', border:'#F97316', badge:'amber' },
  P3: { color:'#D97706', bg:'#FFFBEB', border:'#F59E0B', badge:'amber' },
  P4: { color:'#16A34A', bg:'#F0FDF4', border:'#34D399', badge:'green' },
  P5: { color:'#7C3AED', bg:'#F5F3FF', border:'#8B5CF6', badge:'purple' },
  P6: { color:'#9CA3AF', bg:'#F9FAFB', border:'#D1D5DB', badge:'gray' },
};

// ── useToast ──────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const id = useRef(0);
  const toast = useCallback((msg, type = 'success') => {
    const tid = ++id.current;
    setToasts(t => [...t, { id: tid, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== tid)), 3500);
  }, []);
  return { toasts, toast };
}

function Toasts({ toasts }) {
  return (
    <div style={{ position:'fixed', top:16, right:16, zIndex:200, display:'flex', flexDirection:'column', gap:8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding:'10px 16px', borderRadius:10,
          background: t.type === 'error' ? '#DC2626' : t.type === 'warning' ? '#D97706' : '#059669',
          color:'#fff', fontSize:13, fontWeight:500, boxShadow:'0 4px 12px rgba(0,0,0,0.15)',
          display:'flex', alignItems:'center', gap:8
        }}>
          <span>{t.type === 'error' ? '✕' : '✓'}</span>{t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────
function Drawer({ content, onClose }) {
  if (!content) return null;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:100 }}>
      <div style={{
        position:'absolute', right:0, top:0, bottom:0, width:440,
        background:'#fff', overflowY:'auto', borderLeft:'1px solid #E2E8F0'
      }}>
        {content}
      </div>
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
const KPI_META = [
  { key:'total_open_ar',    label:'Total Open AR',    sub:'open + overdue',    accent:'#1A3C5E', fmt:fmt$ },
  { key:'overdue_amount',   label:'Overdue Amount',   sub:'past due today',    accent:'#EF4444', fmt:fmt$, red:true },
  { key:'active_offers',    label:'Active Offers',    sub:'awaiting response', accent:'#7C3AED', fmt:v=>`${v}`, purple:true },
  { key:'cash_accelerated', label:'Cash Accelerated', sub:'collected early',   accent:'#059669', fmt:fmt$, green:true },
];
function KpiCards({ stats }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:20 }}>
      {KPI_META.map(m => {
        const val = stats ? m.fmt(stats[m.key]) : null;
        const vc = m.red && stats?.[m.key] > 0 ? '#DC2626'
          : m.purple ? '#7C3AED' : m.green ? '#059669' : '#1A3C5E';
        return (
          <div key={m.key} style={{
            background:'#fff', borderRadius:12, border:'1px solid #E2E8F0',
            boxShadow:'0 1px 3px rgba(0,0,0,0.06)', overflow:'hidden', display:'flex', flexDirection:'column'
          }}>
            <div style={{ padding:'16px 20px 12px', flex:1 }}>
              <div style={{ fontSize:10, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>{m.label}</div>
              {val == null
                ? <div style={{ height:32, width:80, background:'#F3F4F6', borderRadius:6 }} />
                : <div style={{ fontSize:24, fontWeight:700, color:vc }}>{val}</div>}
              <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>{m.sub}</div>
            </div>
            <div style={{ height:4, background:m.accent }} />
          </div>
        );
      })}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV = [
  { section:'Collections', items:[
    { id:'workqueue',   label:'Workqueue',        icon:'🗂' },
    { id:'invoices',    label:'Invoices',          icon:'📄' },
    { id:'disputes',    label:'Disputes',          icon:'⚠️',  badgeKey:'open_disputes', badgeColor:'red' },
    { id:'promises',    label:'Promises to Pay',   icon:'🤝' },
    { id:'dunning',     label:'Dunning Sequences', icon:'📨' },
    { id:'intel',       label:'Customer Intel',    icon:'🧠' },
    { id:'controller',  label:'Controller View',   icon:'📊' },
  ]},
  { section:'Early Payment', items:[
    { id:'offers',    label:'Offers',        icon:'🏷',  badgeKey:'active_offers', badgeColor:'purple' },
    { id:'smart',     label:'Smart Offers',  icon:'🎯' },
    { id:'buyer',     label:'Buyer Portal',  icon:'🛒' },
  ]},
];

function Sidebar({ active, onChange, stats }) {
  const dso = stats?.avg_dso ?? null;
  const dsoColor = dso === null ? '#6B7280' : dso > 40 ? '#DC2626' : dso > 30 ? '#D97706' : '#059669';
  const dsoWidth = dso === null ? 0 : Math.min(dso / 60 * 100, 100);

  return (
    <div style={{
      width:210, background:'#fff', borderRight:'1px solid #E2E8F0',
      display:'flex', flexDirection:'column', height:'100%', overflow:'hidden'
    }}>
      <div style={{ flex:1, overflowY:'auto', paddingTop:8 }}>
        {NAV.map(sec => (
          <div key={sec.section}>
            <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'#9CA3AF', padding:'10px 14px 4px' }}>
              {sec.section}
            </div>
            {sec.items.map(item => {
              const isAct = active === item.id;
              const isEP = sec.section === 'Early Payment';
              const accentColor = isEP ? '#7C3AED' : '#1A3C5E';
              const badgeCount = item.badgeKey ? stats?.[item.badgeKey] : null;
              return (
                <div key={item.id} onClick={() => onChange(item.id)}
                  style={{
                    padding:'8px 14px', display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                    borderLeft: isAct ? `3px solid ${accentColor}` : '3px solid transparent',
                    background: isAct ? (isEP ? '#F5F3FF' : '#EFF6FF') : 'transparent',
                    color: isAct ? accentColor : '#6B7280',
                    fontWeight: isAct ? 500 : 400, fontSize:13,
                  }}>
                  <span style={{ fontSize:14 }}>{item.icon}</span>
                  <span style={{ flex:1 }}>{item.label}</span>
                  {badgeCount > 0 && (
                    <span style={{
                      background: item.badgeColor === 'red' ? '#FECACA' : '#EDE9FE',
                      color: item.badgeColor === 'red' ? '#7F1D1D' : '#4C1D95',
                      fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:9999
                    }}>{badgeCount}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* DSO meter */}
      <div style={{ borderTop:'1px solid #E2E8F0', padding:14 }}>
        <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:4 }}>DSO this month</div>
        <div style={{ fontSize:22, fontWeight:700, color:dsoColor, marginBottom:6 }}>
          {dso === null ? '—' : `${Math.round(dso)}d`}
        </div>
        <div style={{ height:4, borderRadius:2, background:'#E2E8F0', marginBottom:4 }}>
          <div style={{ height:'100%', borderRadius:2, width:`${dsoWidth}%`, background:dsoColor, transition:'width 0.4s' }} />
        </div>
        <div style={{ fontSize:10, color:'#9CA3AF' }}>Target: 30 days</div>
      </div>
    </div>
  );
}

// ── WorkqueueView ─────────────────────────────────────────────────────────────

function OfferFormRow({ invoice, onSubmit, onCancel }) {
  const [pct, setPct]     = useState(suggestDiscount(invoice.days_past_due));
  const [expiry, setExpiry] = useState(todayPlus(7));
  const [loading, setLoading] = useState(false);
  const discountAmt = invoice.amount * pct / 100;
  const buyerPays   = invoice.amount - discountAmt;

  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true);
    await onSubmit({ invoice_id: invoice.id, discount_pct: parseFloat(pct), expiry_date: expiry });
    setLoading(false);
  }

  return (
    <tr style={{ background:'#F5F3FF' }}>
      <td colSpan={9} style={{ padding:'12px 20px', borderLeft:'4px solid #7C3AED' }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#4C1D95', marginBottom:10 }}>
          💸 Send early payment discount to <strong>{invoice.customer_name}</strong>
          <span style={{ fontWeight:400, color:'#7C3AED', marginLeft:6 }}>· {invoice.invoice_number} · {fmt$(invoice.amount)}</span>
        </div>
        <form onSubmit={handleSubmit} style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <label style={{ fontSize:11, color:'#6B7280' }}>Discount %
            <input type="number" step="0.1" min="0.1" max="20" value={pct}
              onChange={e => setPct(e.target.value)} required
              style={{ display:'block', width:72, border:'1px solid #DDD', borderRadius:6, padding:'5px 8px', fontSize:13, marginTop:2 }} />
          </label>
          <label style={{ fontSize:11, color:'#6B7280' }}>Expires
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} required
              style={{ display:'block', border:'1px solid #DDD', borderRadius:6, padding:'5px 8px', fontSize:13, marginTop:2 }} />
          </label>
          {pct > 0 && (
            <div style={{ background:'#fff', border:'1px solid #C4B5FD', borderRadius:8, padding:'6px 12px', fontSize:12, color:'#374151' }}>
              Buyer pays <strong style={{ color:'#059669' }}>{fmt$(buyerPays)}</strong>
              <span style={{ margin:'0 6px', color:'#DDD' }}>·</span>
              Saves <strong style={{ color:'#7C3AED' }}>{fmt$(discountAmt)}</strong>
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            background:'#7C3AED', color:'#fff', border:'none', borderRadius:8,
            padding:'7px 16px', fontSize:13, fontWeight:600, cursor:'pointer'
          }}>{loading ? 'Sending…' : 'Confirm Offer'}</button>
          <button type="button" onClick={onCancel} style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', textDecoration:'underline', fontSize:13 }}>Cancel</button>
        </form>
      </td>
    </tr>
  );
}

function WorkqueueView({ invoices, onSendOffer, onWithdraw, onRowClick, stats }) {
  const [filter, setFilter] = useState('all');
  const [openFormId, setOpenFormId] = useState(null);

  const filtered = (invoices || []).filter(inv => {
    if (filter === 'overdue') return inv.status === 'overdue';
    if (filter === 'open')    return inv.status === 'open';
    if (filter === 'offer')   return inv.offer_id && inv.offer_status === 'active';
    if (filter === 'paid')    return inv.status === 'paid';
    return true;
  });

  async function handleSendOffer(data) {
    await onSendOffer(data); setOpenFormId(null);
  }

  const pills = [
    { id:'all', label:'All Invoices' },
    { id:'overdue', label:'🔴 Overdue' },
    { id:'open', label:'⚪ Open' },
    { id:'offer', label:'💰 Has Active Offer' },
    { id:'paid', label:'✅ Paid' },
  ];

  return (
    <div>
      <KpiCards stats={stats} />
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #E2E8F0', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #F3F4F6', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:700, color:'#1A3C5E', fontSize:14 }}>Invoice Workqueue</div>
            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>Ranked by payment risk — act on red rows first</div>
          </div>
          {invoices && <span style={{ fontSize:11, color:'#9CA3AF' }}>{invoices.length} invoices</span>}
        </div>
        <div style={{ padding:'12px 20px 0' }}>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {pills.map(p => (
              <button key={p.id} onClick={() => setFilter(p.id)} style={{
                padding:'4px 12px', borderRadius:9999, fontSize:11, fontWeight:600, cursor:'pointer',
                border:`1px solid ${filter === p.id ? '#1A3C5E' : '#E2E8F0'}`,
                background: filter === p.id ? '#1A3C5E' : '#fff',
                color: filter === p.id ? '#fff' : '#6B7280',
              }}>{p.label}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#1A3C5E', color:'#fff' }}>
                {['Priority','#','Customer','Amount','Due Date','DPD','Status','Offer','Action'].map((h,i) => (
                  <th key={i} style={{ textAlign:'left', padding:'10px 12px', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!invoices && <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>Loading…</td></tr>}
              {invoices && filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>No invoices match this filter.</td></tr>}
              {filtered.map(inv => {
                const p = inv.priority || {};
                const ps = p.tier ? PRIORITY_STYLES[p.tier] : null;
                const hasActiveOffer = inv.offer_id && inv.offer_status === 'active';
                const hasAcceptedOffer = inv.offer_id && inv.offer_status === 'accepted';
                return (
                  <React.Fragment key={inv.id}>
                    <tr onClick={e => { if (e.target.tagName !== 'BUTTON') onRowClick(inv.id); }}
                      style={{
                        borderBottom:'1px solid #F3F4F6', cursor:'pointer',
                        borderLeft: ps ? `4px solid ${ps.border}` : '4px solid #E5E7EB',
                        background: ps ? ps.bg : '#fff',
                      }}>
                      <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                        {p.tier && (
                          <span style={{
                            display:'inline-block', padding:'2px 7px', borderRadius:9999, fontSize:11, fontWeight:700,
                            background: ps.bg, color: ps.color, border:`1px solid ${ps.border}`
                          }}>{p.tier}</span>
                        )}
                      </td>
                      <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:11, color:'#6B7280', whiteSpace:'nowrap' }}>{inv.invoice_number}</td>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <AvatarChip name={inv.customer_name} />
                          <div>
                            <div style={{ fontWeight:500, color:'#111827', whiteSpace:'nowrap' }}>{inv.customer_name}</div>
                            {p.recommended_action && inv.status !== 'paid' && (
                              <div style={{ fontSize:10, color: ps?.color || '#9CA3AF', marginTop:1, maxWidth:220, lineHeight:1.3 }}>{p.recommended_action}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'10px 12px', fontWeight:600, color:'#111827', whiteSpace:'nowrap' }}>{fmt$(inv.amount)}</td>
                      <td style={{ padding:'10px 12px', color:'#6B7280', whiteSpace:'nowrap' }}>{fmtDate(inv.due_date)}</td>
                      <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                        {inv.days_past_due > 0
                          ? <span style={{ fontWeight:700, color: ps?.color }}>{inv.days_past_due}d</span>
                          : <span style={{ color:'#10B981', fontSize:11 }}>On time</span>}
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        <Badge text={inv.status.charAt(0).toUpperCase()+inv.status.slice(1)}
                          color={inv.status==='paid'?'green':inv.status==='overdue'?'red':'gray'} />
                      </td>
                      <td style={{ padding:'10px 12px' }}>
                        {hasActiveOffer && <Badge text={`💰 ${inv.offer_pct}% · exp ${fmtDate(inv.offer_expiry)}`} color="purple" />}
                        {hasAcceptedOffer && <Badge text="✅ Paid early" color="green" />}
                        {!hasActiveOffer && !hasAcceptedOffer && <span style={{ color:'#D1D5DB', fontSize:12 }}>—</span>}
                      </td>
                      <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                        {inv.status === 'paid' ? <span style={{ color:'#D1D5DB', fontSize:12 }}>—</span>
                          : hasActiveOffer
                            ? <button onClick={e => { e.stopPropagation(); onWithdraw(inv.offer_id); }} style={{ padding:'4px 10px', border:'1px solid #E2E8F0', borderRadius:6, background:'#fff', color:'#6B7280', fontSize:11, cursor:'pointer' }}>Withdraw</button>
                            : <button onClick={e => { e.stopPropagation(); setOpenFormId(openFormId === inv.id ? null : inv.id); }} style={{ padding:'4px 10px', background:'#7C3AED', border:'none', borderRadius:6, color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer' }}>Send Offer</button>
                        }
                      </td>
                    </tr>
                    {openFormId === inv.id && (
                      <OfferFormRow key={`form-${inv.id}`} invoice={inv}
                        onSubmit={handleSendOffer} onCancel={() => setOpenFormId(null)} />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── InvoicesView ──────────────────────────────────────────────────────────────
function InvoicesView({ invoices, onRowClick }) {
  const [filter, setFilter] = useState('all');
  const filtered = (invoices || []).filter(inv => {
    if (filter === 'overdue') return inv.status === 'overdue';
    if (filter === 'open')    return inv.status === 'open';
    if (filter === 'paid')    return inv.status === 'paid';
    return true;
  });

  function agingBadge(dpd, status) {
    if (status === 'paid') return <Badge text="Paid" color="green" />;
    if (dpd === 0) return <Badge text="Current" color="green" />;
    if (dpd <= 30) return <Badge text="1–30 DPD" color="blue" />;
    if (dpd <= 60) return <Badge text="31–60 DPD" color="amber" />;
    if (dpd <= 90) return <Badge text="61–90 DPD" color="red" />;
    return <Badge text="90+ DPD" color="red" />;
  }

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #E2E8F0', overflow:'hidden' }}>
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #F3F4F6' }}>
        <div style={{ fontWeight:700, color:'#1A3C5E', fontSize:14 }}>All Invoices</div>
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          {['all','overdue','open','paid'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding:'4px 12px', borderRadius:9999, fontSize:11, fontWeight:600, cursor:'pointer',
              border:`1px solid ${filter===f?'#1A3C5E':'#E2E8F0'}`,
              background:filter===f?'#1A3C5E':'#fff', color:filter===f?'#fff':'#6B7280',
            }}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
          ))}
        </div>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr style={{ background:'#F9FAFB', color:'#6B7280' }}>
            {['Invoice #','Customer','Amount','Due Date','DPD','Status','Aging','Action'].map(h => (
              <th key={h} style={{ textAlign:'left', padding:'8px 14px', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map(inv => {
            const hasAO = inv.offer_id && inv.offer_status === 'active';
            return (
              <tr key={inv.id} onClick={() => onRowClick(inv.id)}
                style={{ borderBottom:'1px solid #F3F4F6', cursor:'pointer' }}>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11, color:'#6B7280' }}>{inv.invoice_number}</td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <AvatarChip name={inv.customer_name} size={28} />
                    <span style={{ fontWeight:500 }}>{inv.customer_name}</span>
                  </div>
                </td>
                <td style={{ padding:'10px 14px', fontWeight:600 }}>{fmt$(inv.amount)}</td>
                <td style={{ padding:'10px 14px', color:'#6B7280' }}>{fmtDate(inv.due_date)}</td>
                <td style={{ padding:'10px 14px', fontWeight:700, color: inv.days_past_due>60?'#DC2626':inv.days_past_due>30?'#EA580C':inv.days_past_due>0?'#D97706':'#10B981' }}>
                  {inv.days_past_due > 0 ? `${inv.days_past_due}d` : '—'}
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <Badge text={inv.status.charAt(0).toUpperCase()+inv.status.slice(1)}
                    color={inv.status==='paid'?'green':inv.status==='overdue'?'red':'gray'} />
                </td>
                <td style={{ padding:'10px 14px' }}>{agingBadge(inv.days_past_due, inv.status)}</td>
                <td style={{ padding:'10px 14px' }}>
                  {hasAO ? <Badge text={`${inv.offer_pct}% offer`} color="purple" />
                    : inv.status === 'paid' ? <Badge text="Paid" color="green" />
                    : <button onClick={e => { e.stopPropagation(); onRowClick(inv.id); }}
                        style={{ padding:'4px 10px', background:'#7C3AED', border:'none', borderRadius:6, color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                        Send offer
                      </button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── DisputesView ──────────────────────────────────────────────────────────────
function DisputesView({ invoices, toast, openDrawer, closeDrawer, onMutate }) {
  const [disputes, setDisputeList] = useState(null);

  const load = useCallback(async () => {
    const d = await fetch('/api/disputes').then(r => r.json());
    setDisputeList(d);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date();
  const open = (disputes || []).filter(d => d.status === 'open' || d.status === 'under_review').length;
  const atRisk = (disputes || []).filter(d => {
    const dif = daysBetween(d.sla_date, today);
    return dif <= 1 && (d.status==='open'||d.status==='under_review');
  }).length;

  function slaLeft(sla_date) {
    const d = daysBetween(sla_date, today);
    if (d < 0) return <Badge text="Overdue" color="red" />;
    if (d === 0) return <Badge text="Today" color="red" />;
    if (d === 1) return <Badge text="1 day" color="red" />;
    if (d <= 4) return <Badge text={`${d}d`} color="amber" />;
    return <Badge text={`${d}d`} color="blue" />;
  }

  async function updateStatus(id, status) {
    await fetch(`/api/disputes/${id}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status }) });
    load(); closeDrawer(); toast(`Dispute marked ${status}`);
  }

  function openViewDrawer(d) {
    openDrawer(
      <div>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff' }}>
          <div>
            <div style={{ fontSize:11, color:'#6B7280' }}>{d.type}</div>
            <div style={{ fontSize:18, fontWeight:600 }}>{d.customer_name} — {d.invoice_number}</div>
          </div>
          <button onClick={closeDrawer} style={{ padding:'4px 10px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕</button>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
            {[['Disputed Amount', fmt$(d.disputed_amount)], ['Status', d.status], ['SLA Date', fmtDate(d.sla_date)], ['Invoice Total', fmt$(d.invoice_amount)]].map(([lbl,val]) => (
              <div key={lbl} style={{ background:'#F9FAFB', borderRadius:8, padding:10 }}>
                <div style={{ fontSize:10, color:'#9CA3AF' }}>{lbl}</div>
                <div style={{ fontWeight:500, marginTop:2 }}>{val}</div>
              </div>
            ))}
          </div>
          {d.description && <div style={{ background:'#F9FAFB', borderRadius:8, padding:12, fontSize:12, color:'#6B7280', fontStyle:'italic', marginBottom:16 }}>{d.description}</div>}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
            {d.status === 'open' && <button onClick={() => updateStatus(d.id,'under_review')} style={{ padding:'6px 14px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', fontSize:12 }}>Mark under review</button>}
            {(d.status==='open'||d.status==='under_review') && <button onClick={() => updateStatus(d.id,'resolved')} style={{ padding:'6px 14px', background:'#059669', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>Resolve</button>}
          </div>
          <NoteForm invoiceId={d.invoice_id} label="Internal note" toast={toast} />
        </div>
      </div>
    );
  }

  function openNewDisputeDrawer() {
    const nonPaid = (invoices || []).filter(i => i.status !== 'paid');
    openDrawer(
      <div>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:600 }}>Open new dispute</div>
          <button onClick={closeDrawer} style={{ padding:'4px 10px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕</button>
        </div>
        <DisputeForm invoices={nonPaid} onSave={async (data) => {
          const res = await fetch('/api/disputes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
          if (!res.ok) { toast('Failed to open dispute','error'); return; }
          closeDrawer(); load(); onMutate(); toast('Dispute filed — active offer suspended','warning');
        }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:16, color:'#1A3C5E' }}>Disputes</div>
        <button onClick={openNewDisputeDrawer} style={{ padding:'7px 16px', background:'#1A3C5E', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>+ New dispute</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
        {[{label:'Open',val:open,color:'#DC2626',bg:'#FEF2F2'},{label:'SLA at risk',val:atRisk,color:'#D97706',bg:'#FFFBEB'},{label:'Resolved this month',val:(disputes||[]).filter(d=>d.status==='resolved').length,color:'#059669',bg:'#F0FDF4'}].map(c => (
          <div key={c.label} style={{ background:c.bg, borderRadius:10, padding:'14px 18px', border:`1px solid ${c.color}33` }}>
            <div style={{ fontSize:11, color:c.color, fontWeight:600 }}>{c.label}</div>
            <div style={{ fontSize:28, fontWeight:700, color:c.color }}>{c.val}</div>
          </div>
        ))}
      </div>
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #E2E8F0', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#F9FAFB' }}>
              {['Customer','Invoice #','Type','Disputed $','Status','SLA left','Actions'].map(h => (
                <th key={h} style={{ textAlign:'left', padding:'9px 14px', fontSize:11, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!disputes && <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>Loading…</td></tr>}
            {(disputes || []).map(d => (
              <tr key={d.id} style={{ borderBottom:'1px solid #F3F4F6' }}>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <AvatarChip name={d.customer_name} size={28} />
                    <span style={{ fontWeight:500 }}>{d.customer_name}</span>
                  </div>
                </td>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11, color:'#6B7280' }}>{d.invoice_number}</td>
                <td style={{ padding:'10px 14px', fontSize:12 }}>{d.type}</td>
                <td style={{ padding:'10px 14px', fontWeight:600 }}>{fmt$(d.disputed_amount)}</td>
                <td style={{ padding:'10px 14px' }}>
                  <Badge text={d.status.replace('_',' ')} color={d.status==='resolved'?'green':d.status==='open'?'red':'amber'} />
                </td>
                <td style={{ padding:'10px 14px' }}>{slaLeft(d.sla_date)}</td>
                <td style={{ padding:'10px 14px' }}>
                  <button onClick={() => openViewDrawer(d)} style={{ padding:'4px 10px', border:'1px solid #E2E8F0', borderRadius:6, fontSize:11, cursor:'pointer' }}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DisputeForm({ invoices, onSave }) {
  const [invId, setInvId] = useState(invoices[0]?.id || '');
  const [type, setType]   = useState('Price discrepancy');
  const [amt, setAmt]     = useState(invoices[0]?.amount || '');
  const [desc, setDesc]   = useState('');

  useEffect(() => {
    const inv = invoices.find(i => i.id == invId);
    if (inv) setAmt(inv.amount);
  }, [invId]);

  async function handleSubmit(e) {
    e.preventDefault();
    const inv = invoices.find(i => i.id == invId);
    await onSave({ invoice_id: parseInt(invId), customer_id: inv.customer_id, type, disputed_amount: parseFloat(amt), description: desc });
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding:20 }}>
      <Field label="Invoice">
        <select value={invId} onChange={e => setInvId(e.target.value)} style={fieldStyle}>
          {invoices.map(i => <option key={i.id} value={i.id}>{i.invoice_number} — {i.customer_name} ({fmt$(i.amount)})</option>)}
        </select>
      </Field>
      <Field label="Dispute type">
        <select value={type} onChange={e => setType(e.target.value)} style={fieldStyle}>
          {['Price discrepancy','Quantity error','Duplicate invoice','Service not delivered','PO mismatch','Other'].map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Disputed amount">
        <input type="number" value={amt} onChange={e => setAmt(e.target.value)} style={fieldStyle} required />
      </Field>
      <Field label="Description">
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} style={{ ...fieldStyle, resize:'vertical' }} placeholder="Describe the issue…" />
      </Field>
      <button type="submit" style={{ width:'100%', padding:10, background:'#DC2626', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Open dispute</button>
    </form>
  );
}

// ── PromisesView ──────────────────────────────────────────────────────────────
function PromisesView({ toast, onMutate }) {
  const [promises, setPromises] = useState(null);
  const load = useCallback(async () => setPromises(await fetch('/api/promises').then(r => r.json())), []);
  useEffect(() => { load(); }, [load]);

  async function updateStatus(id, status) {
    await fetch(`/api/promises/${id}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status }) });
    load(); onMutate();
    toast(status === 'kept' ? 'PTP kept — invoice marked paid' : 'PTP marked broken');
  }

  const active  = (promises||[]).filter(p => p.status === 'active').length;
  const broken  = (promises||[]).filter(p => p.status === 'broken').length;
  const kept    = (promises||[]).filter(p => p.status === 'kept').length;

  function ptpIcon(status) {
    if (status === 'kept') return { bg:'#DBEAFE', icon:'✓' };
    if (status === 'broken') return { bg:'#FECACA', icon:'✕' };
    return { bg:'#D1FAE5', icon:'⟳' };
  }

  return (
    <div>
      <div style={{ fontWeight:700, fontSize:16, color:'#1A3C5E', marginBottom:16 }}>Promises to Pay</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
        {[{label:'Active',val:active,color:'#059669',bg:'#F0FDF4'},{label:'Broken this month',val:broken,color:'#DC2626',bg:'#FEF2F2'},{label:'Kept this month',val:kept,color:'#185FA5',bg:'#EFF6FF'}].map(c => (
          <div key={c.label} style={{ background:c.bg, borderRadius:10, padding:'14px 18px', border:`1px solid ${c.color}33` }}>
            <div style={{ fontSize:11, color:c.color, fontWeight:600 }}>{c.label}</div>
            <div style={{ fontSize:28, fontWeight:700, color:c.color }}>{c.val}</div>
          </div>
        ))}
      </div>
      {!promises && <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>Loading…</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {(promises || []).map(p => {
          const { bg, icon } = ptpIcon(p.status);
          return (
            <div key={p.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, padding:16, display:'flex', gap:14, alignItems:'flex-start' }}>
              <div style={{ width:40, height:40, borderRadius:10, background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'#111827' }}>{p.customer_name}</div>
                <div style={{ fontFamily:'monospace', fontSize:11, color:'#9CA3AF', marginTop:1 }}>{p.invoice_number}</div>
                <div style={{ marginTop:4, fontSize:13 }}>
                  <strong>{fmt$(p.promised_amount)}</strong> <span style={{ color:'#6B7280' }}>due</span> <strong>{fmtDate(p.promise_date)}</strong>
                </div>
                {p.notes && <div style={{ fontSize:11, color:'#9CA3AF', fontStyle:'italic', marginTop:4 }}>{p.notes}</div>}
                <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
                  <Badge text={p.status.charAt(0).toUpperCase()+p.status.slice(1)} color={p.status==='active'?'green':p.status==='kept'?'blue':'red'} />
                  {p.status === 'active' && (
                    <>
                      <button onClick={() => updateStatus(p.id,'kept')} style={{ padding:'4px 12px', background:'#059669', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>Mark kept</button>
                      <button onClick={() => updateStatus(p.id,'broken')} style={{ padding:'4px 12px', background:'#DC2626', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>Mark broken</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {promises && promises.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>No promises to pay recorded.</div>}
      </div>
    </div>
  );
}

// ── CustomerIntelView ─────────────────────────────────────────────────────────
function CustomerIntelView({ toast, openDrawer, closeDrawer }) {
  const [intel, setIntel] = useState(null);
  const [sort, setSort]   = useState('outstanding');
  const [histories, setHistories] = useState({});

  const load = useCallback(async () => {
    const data = await fetch('/api/customers/intelligence').then(r => r.json());
    setIntel(data);
    data.forEach(async c => {
      const h = await fetch(`/api/customers/${c.customer_id}/payment-history`).then(r => r.json());
      setHistories(prev => ({ ...prev, [c.customer_id]: h }));
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = [...(intel || [])].sort((a, b) => {
    if (sort === 'outstanding') return b.total_outstanding - a.total_outstanding;
    if (sort === 'grade') return Object.keys(GRADE_COLORS).indexOf(a.collection_grade) - Object.keys(GRADE_COLORS).indexOf(b.collection_grade);
    if (sort === 'ontime') return b.on_time_rate - a.on_time_rate;
    if (sort === 'dpd') return b.avg_days_to_pay - a.avg_days_to_pay;
    return 0;
  });

  function openHistoryDrawer(c, hist) {
    openDrawer(
      <div>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff' }}>
          <div style={{ fontWeight:600 }}>Payment History — {c.customer_name}</div>
          <button onClick={closeDrawer} style={{ padding:'4px 10px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕</button>
        </div>
        <div style={{ padding:20 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr style={{ background:'#F9FAFB' }}>
              {['Amount','Due','Paid','Days','Method','Result'].map(h => <th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#6B7280', fontWeight:600, fontSize:10, textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(hist||[]).map(r => (
                <tr key={r.id} style={{ borderBottom:'1px solid #F3F4F6' }}>
                  <td style={{ padding:'7px 10px' }}>{fmt$(r.invoice_amount)}</td>
                  <td style={{ padding:'7px 10px' }}>{fmtDate(r.due_date)}</td>
                  <td style={{ padding:'7px 10px' }}>{fmtDate(r.paid_date)}</td>
                  <td style={{ padding:'7px 10px', fontWeight:600, color:r.days_to_pay>30?'#DC2626':r.days_to_pay>15?'#D97706':'#059669' }}>{r.days_to_pay}d</td>
                  <td style={{ padding:'7px 10px', color:'#6B7280' }}>{r.payment_method}</td>
                  <td style={{ padding:'7px 10px' }}><Badge text={r.was_early?'Early':r.was_on_time?'On time':'Late'} color={r.was_early?'purple':r.was_on_time?'green':'red'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const gradeLegend = [['Easy','green'],['Moderate','blue'],['Medium','amber'],['High Risk','amber'],['Risky','red']];

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {gradeLegend.map(([lbl, c]) => <Badge key={lbl} text={lbl} color={c} />)}
        <div style={{ flex:1 }} />
        {[['outstanding','By outstanding'],['grade','By grade'],['ontime','By on-time rate'],['dpd','By avg DPD']].map(([k,l]) => (
          <button key={k} onClick={() => setSort(k)} style={{
            padding:'4px 12px', borderRadius:9999, fontSize:11, fontWeight:600, cursor:'pointer',
            border:`1px solid ${sort===k?'#1A3C5E':'#E2E8F0'}`,
            background:sort===k?'#1A3C5E':'#fff', color:sort===k?'#fff':'#6B7280',
          }}>{l}</button>
        ))}
      </div>

      {!intel && <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>Loading…</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {sorted.map(c => {
          const hist = histories[c.customer_id] || [];
          const last8 = hist.slice(0, 8).reverse();
          const trend = c.payment_trend;
          const trendLabel = trend > 5 ? '↑ Slowing' : trend < -5 ? '↓ Improving' : '→ Stable';
          const trendColor = trend > 5 ? '#DC2626' : trend < -5 ? '#059669' : '#6B7280';
          const isRisky = c.collection_grade === 'risky' || c.collection_grade === 'high_risk';
          const outColor = c.total_outstanding > 15000 ? '#DC2626' : c.total_outstanding > 5000 ? '#D97706' : '#059669';

          return (
            <div key={c.customer_id} style={{
              background:'#fff', border:'1px solid #E2E8F0', borderRadius:10,
              padding:16, display:'flex', gap:16,
              borderLeft:`4px solid ${gradeColor(c.collection_grade)}`
            }}>
              {/* LEFT */}
              <div style={{ width:'30%', minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                  <AvatarChip name={c.customer_name} size={44} />
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:'#111827' }}>{c.customer_name}</div>
                    <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{c.customer_email}</div>
                    <div style={{ marginTop:4 }}><Badge text={gradeLabel(c.collection_grade)} color={gradeBadgeColor(c.collection_grade)} /></div>
                  </div>
                </div>
                <div style={{ fontSize:11, color:'#9CA3AF', fontStyle:'italic', lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{c.grade_reason}</div>
                {(c.risk_factors || []).length > 0 && (
                  <div style={{ marginTop:8, borderTop:'1px solid #F3F4F6', paddingTop:6 }}>
                    <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', color:'#9CA3AF', marginBottom:4 }}>Risk factors</div>
                    {(c.risk_factors || []).map((f, i) => (
                      <div key={i} style={{ fontSize:11, color:'#374151', display:'flex', gap:4, alignItems:'flex-start', marginBottom:2 }}>
                        <span style={{ color: f.startsWith('Pays avg') || f.includes('%') && !f.includes('late') ? '#059669' : '#EA580C', flexShrink:0 }}>•</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* MIDDLE */}
              <div style={{ width:'40%', minWidth:0 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
                  {[
                    ['Avg days to pay', `${c.avg_days_to_pay}d`, c.avg_days_to_pay<15?'#059669':c.avg_days_to_pay<=35?'#D97706':'#DC2626'],
                    ['On-time rate', `${Math.round(c.on_time_rate*100)}%`, c.on_time_rate>0.75?'#059669':c.on_time_rate>=0.5?'#D97706':'#DC2626'],
                    ['Payment cycle', c.payment_cycle.replace('_',' '), '#374151'],
                    ['Next payment', c.next_expected_payment ? fmtDate(c.next_expected_payment) : 'Irregular', '#374151'],
                  ].map(([lbl, val, vc]) => (
                    <div key={lbl} style={{ background:'#F9FAFB', borderRadius:6, padding:'6px 10px' }}>
                      <div style={{ fontSize:10, color:'#9CA3AF' }}>{lbl}</div>
                      <div style={{ fontWeight:700, fontSize:13, color:vc, marginTop:1 }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:4 }}>Last 8 payments</div>
                <div style={{ display:'flex', gap:2 }}>
                  {last8.map((r, i) => (
                    <div key={i} style={{
                      width:8, height:20, borderRadius:2, flexShrink:0,
                      background: r.was_early ? '#7C3AED' : r.was_on_time ? '#1D9E75' : '#E24B4A'
                    }} />
                  ))}
                  {last8.length === 0 && <span style={{ fontSize:10, color:'#D1D5DB' }}>No history</span>}
                </div>
              </div>

              {/* RIGHT */}
              <div style={{ width:'28%', minWidth:0, display:'flex', flexDirection:'column', gap:6 }}>
                <div style={{ fontSize:22, fontWeight:700, color:outColor }}>{fmt$(c.total_outstanding)}</div>
                <div><Badge text={`${c.open_invoice_count} open invoice${c.open_invoice_count!==1?'s':''}`} color="gray" /></div>
                <div style={{ fontSize:11, color:'#059669' }}>Lifetime paid: {fmt$(c.total_paid_lifetime)}</div>
                <div style={{ fontSize:11, fontWeight:600, color:trendColor }}>{trendLabel}</div>
                <button onClick={() => openHistoryDrawer(c, hist)} style={{ padding:'5px 10px', border:'1px solid #E2E8F0', borderRadius:6, fontSize:11, cursor:'pointer', background:'#fff', color:'#374151', textAlign:'left' }}>View history →</button>
                {isRisky && (
                  <button onClick={async () => {
                    await fetch('/api/activity', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ message:`P1 task created for ${c.customer_name}`, type:'collection' }) });
                    toast(`P1 task created for ${c.customer_name}`);
                  }} style={{ padding:'5px 10px', background:'#0F766E', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    🔔 Collect now
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SmartOffersView ───────────────────────────────────────────────────────────
function SmartOffersView({ toast, onMutate }) {
  const [eligible, setEligible]   = useState(null);
  const [campaigns, setCampaigns] = useState(null);
  const [expanded, setExpanded]   = useState({});
  const [checked, setChecked]     = useState({});
  const [discPct, setDiscPct]     = useState({});
  const [deadline, setDeadline]   = useState({});
  const [reason, setReason]       = useState({});
  const [ineligOpen, setIneligOpen] = useState(false);

  const load = useCallback(async () => {
    const [e, c] = await Promise.all([
      fetch('/api/liquidity/eligible').then(r => r.json()),
      fetch('/api/liquidity/campaigns').then(r => r.json()),
    ]);
    setEligible(e);
    setCampaigns(c);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch all profiles for "not eligible"
  const [allIntel, setAllIntel] = useState(null);
  useEffect(() => { fetch('/api/customers/intelligence').then(r=>r.json()).then(setAllIntel); }, []);

  const ineligible = (allIntel||[]).filter(c => !c.liquidity_offer_eligible);

  function toggleInvoice(custId, invId) {
    setChecked(prev => {
      const cur = { ...(prev[custId] || {}) };
      cur[invId] = !cur[invId];
      return { ...prev, [custId]: cur };
    });
  }

  function selectedIds(custId) {
    return Object.entries(checked[custId] || {}).filter(([,v]) => v).map(([k]) => parseInt(k));
  }

  function selectedTotal(custId, invoices) {
    const ids = selectedIds(custId);
    return invoices.filter(i => ids.includes(i.id)).reduce((s, i) => s + i.amount, 0);
  }

  async function sendCampaign(custId, invs) {
    const ids = selectedIds(custId);
    if (!ids.length) return;
    const pct = discPct[custId] || 10;
    const dl  = deadline[custId] || todayPlus(7);
    const rsn = reason[custId]   || '';
    const res = await fetch('/api/liquidity/campaigns', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ customer_id: custId, invoice_ids: ids, discount_pct: pct, deadline: dl, reason: rsn })
    });
    if (!res.ok) { toast((await res.json()).error || 'Failed','error'); return; }
    toast('Targeted liquidity offer sent!');
    setChecked(p => ({ ...p, [custId]: {} }));
    load(); onMutate();
  }

  async function respondCampaign(id, status) {
    await fetch(`/api/liquidity/campaigns/${id}/respond`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ status })
    });
    toast(status === 'accepted' ? 'Offer accepted — invoices marked paid' : 'Offer declined');
    load(); onMutate();
  }

  return (
    <div>
      {/* Banner */}
      <div style={{ background:'#1A3C5E', borderRadius:12, padding:'20px 24px', marginBottom:20, display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, color:'#fff' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Why not discount everyone?</div>
          <div style={{ fontSize:13, color:'#93C5FD', lineHeight:1.6 }}>Targeted liquidity offers go only to customers who are reliable and have meaningful outstanding balances — maximising cash acceleration while protecting margin.</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6, justifyContent:'center' }}>
          {['✅  Significant outstanding balance','✅  Proven payment reliability','✅  No broken promises or disputes'].map(t => (
            <div key={t} style={{ fontSize:13, color:'#A7F3D0' }}>{t}</div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'60% 40%', gap:20 }}>
        {/* LEFT — eligible */}
        <div>
          <div style={{ fontWeight:700, color:'#1A3C5E', fontSize:14, marginBottom:12 }}>
            Eligible customers&nbsp;<Badge text={`${(eligible||[]).length} eligible`} color="green" />
          </div>
          {!eligible && <div style={{ color:'#9CA3AF', textAlign:'center', padding:40 }}>Loading…</div>}
          {(eligible || []).map(c => {
            const ids = selectedIds(c.customer_id);
            const total = selectedTotal(c.customer_id, c.invoices);
            const pct = discPct[c.customer_id] || 10;
            const isExpanded = expanded[c.customer_id];
            return (
              <div key={c.customer_id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:14, marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <AvatarChip name={c.customer_name} />
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:700, color:'#111827' }}>{c.customer_name}</span>
                    &nbsp;<Badge text={gradeLabel(c.collection_grade)} color={gradeBadgeColor(c.collection_grade)} />
                    <div style={{ fontSize:11, color:'#0F766E', fontStyle:'italic', marginTop:2 }}>{c.liquidity_offer_reason}</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:10 }}>
                  {[['Outstanding',fmt$(c.total_outstanding),'#DC2626'],['On-time',`${Math.round(c.on_time_rate*100)}%`,'#059669'],['Lifetime',fmt$(c.total_paid_lifetime),'#374151'],['Last pay',fmtDate(c.last_payment_date),'#374151']].map(([l,v,vc]) => (
                    <div key={l} style={{ background:'#F9FAFB', borderRadius:6, padding:'5px 8px' }}>
                      <div style={{ fontSize:10, color:'#9CA3AF' }}>{l}</div>
                      <div style={{ fontWeight:600, fontSize:12, color:vc }}>{v}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setExpanded(p => ({ ...p, [c.customer_id]: !p[c.customer_id] }))}
                  style={{ background:'none', border:'none', fontSize:12, color:'#6B7280', cursor:'pointer', padding:0 }}>
                  {isExpanded ? '▾' : '▸'} {c.invoices.length} open invoice{c.invoices.length!==1?'s':''}
                </button>
                {isExpanded && (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
                    {c.invoices.map(inv => (
                      <label key={inv.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer', padding:'4px 6px', borderRadius:6, background: checked[c.customer_id]?.[inv.id] ? '#EDE9FE' : 'transparent' }}>
                        <input type="checkbox" checked={!!(checked[c.customer_id]?.[inv.id])} onChange={() => toggleInvoice(c.customer_id, inv.id)} />
                        <span style={{ fontFamily:'monospace', fontSize:11, color:'#6B7280' }}>{inv.invoice_number}</span>
                        <span style={{ flex:1, color:'#374151' }}>{fmt$(inv.amount)}</span>
                        {inv.days_past_due > 0 && <Badge text={`${inv.days_past_due}d`} color={inv.days_past_due>60?'red':inv.days_past_due>30?'amber':'blue'} />}
                      </label>
                    ))}
                  </div>
                )}
                {ids.length > 0 && (
                  <div style={{ marginTop:10, background:'#F5F3FF', borderRadius:8, padding:12 }}>
                    <div style={{ fontSize:12, color:'#4C1D95', marginBottom:8 }}>
                      Offer {pct}% — they pay <strong>{fmt$(total*(1-pct/100))}</strong> instead of <strong>{fmt$(total)}</strong>
                      <div style={{ fontSize:11, color:'#7C3AED', marginTop:1 }}>You forgo {fmt$(total*pct/100)}</div>
                      {pct > 15 && <div style={{ color:'#D97706', fontSize:11, marginTop:2 }}>⚠ High discount — confirm this is intentional</div>}
                    </div>
                    <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:8 }}>
                      <label style={{ fontSize:11, color:'#6B7280' }}>Discount %
                        <input type="range" min={5} max={20} step={0.5} value={pct}
                          onChange={e => setDiscPct(p => ({ ...p, [c.customer_id]: parseFloat(e.target.value) }))}
                          style={{ display:'block', width:100, marginTop:2 }} />
                      </label>
                      <label style={{ fontSize:11, color:'#6B7280' }}>Deadline
                        <input type="date" value={deadline[c.customer_id]||todayPlus(7)}
                          onChange={e => setDeadline(p => ({ ...p, [c.customer_id]: e.target.value }))}
                          max={todayPlus(30)}
                          style={{ display:'block', border:'1px solid #E2E8F0', borderRadius:6, padding:'4px 8px', fontSize:12, marginTop:2 }} />
                      </label>
                    </div>
                    <textarea placeholder="Reason for offer…" value={reason[c.customer_id]||''} rows={2}
                      onChange={e => setReason(p => ({ ...p, [c.customer_id]: e.target.value }))}
                      style={{ width:'100%', border:'1px solid #E2E8F0', borderRadius:6, padding:'6px 8px', fontSize:12, resize:'vertical', marginBottom:8 }} />
                    <button onClick={() => sendCampaign(c.customer_id, c.invoices)}
                      style={{ padding:'7px 16px', background:'#7C3AED', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      Send targeted offer
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Not eligible */}
          {ineligible.length > 0 && (
            <div>
              <button onClick={() => setIneligOpen(p => !p)} style={{ background:'none', border:'none', color:'#6B7280', fontSize:12, cursor:'pointer', padding:0, marginBottom:8 }}>
                {ineligOpen ? '▾' : '▸'} {ineligible.length} not eligible
              </button>
              {ineligOpen && ineligible.map(c => (
                <div key={c.customer_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'#F9FAFB', borderRadius:8, marginBottom:6 }}>
                  <AvatarChip name={c.customer_name} size={28} />
                  <span style={{ fontWeight:600, fontSize:13 }}>{c.customer_name}</span>
                  <Badge text={gradeLabel(c.collection_grade)} color={gradeBadgeColor(c.collection_grade)} />
                  <span style={{ fontSize:11, color:'#9CA3AF', fontStyle:'italic', flex:1 }}>{c.liquidity_offer_reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — campaigns */}
        <div>
          <div style={{ fontWeight:700, color:'#1A3C5E', fontSize:14, marginBottom:12 }}>Campaigns</div>
          {!campaigns && <div style={{ color:'#9CA3AF', textAlign:'center', padding:40 }}>Loading…</div>}
          {campaigns && campaigns.length === 0 && <div style={{ color:'#9CA3AF', fontSize:13, textAlign:'center', padding:40 }}>No campaigns sent yet.</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(campaigns||[]).map(camp => {
              const ids = JSON.parse(camp.invoice_ids||'[]');
              const dlDays = daysBetween(camp.deadline);
              return (
                <div key={camp.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:14 }}>
                  <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:8 }}>
                    <AvatarChip name={camp.customer_name} size={28} />
                    <span style={{ fontWeight:700, flex:1 }}>{camp.customer_name}</span>
                    <Badge text={camp.status} color={camp.status==='accepted'?'green':camp.status==='declined'?'red':'purple'} />
                  </div>
                  <div style={{ fontSize:12, color:'#374151', marginBottom:4 }}>{camp.offered_discount_pct}% on {ids.length} invoice{ids.length!==1?'s':''}</div>
                  <div style={{ fontSize:12, color:'#374151', marginBottom:2 }}>They pay <strong>{fmt$(camp.final_amount)}</strong> instead of <strong>{fmt$(camp.total_outstanding)}</strong></div>
                  <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:6 }}>You forgo {fmt$(camp.discount_amount)}</div>
                  <div style={{ fontSize:11, marginBottom:8, color: dlDays < 0 ? '#DC2626' : dlDays <= 3 ? '#D97706' : '#059669', fontWeight:600 }}>
                    Deadline: {fmtDate(camp.deadline)} {dlDays < 0 ? '(expired)' : `(${dlDays}d left)`}
                  </div>
                  {camp.status === 'pending' && (
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => respondCampaign(camp.id,'accepted')} style={{ padding:'4px 12px', background:'#059669', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>Mark accepted</button>
                      <button onClick={() => respondCampaign(camp.id,'declined')} style={{ padding:'4px 12px', background:'#DC2626', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>Mark declined</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BuyerPortalView ───────────────────────────────────────────────────────────
function BuyerPortalView({ toast, onMutate }) {
  const [offers, setOffers]   = useState(null);
  const [selected, setSelected] = useState({});

  const load = useCallback(async () => {
    const data = await fetch('/api/activity').then(r => r.json());
    // Fetch actual offers list with invoice info
    const invs = await fetch('/api/invoices').then(r => r.json());
    const activeOffers = invs.filter(i => i.offer_id && i.offer_status === 'active').map(i => ({
      offer_id: i.offer_id,
      offer_pct: i.offer_pct,
      offer_discount_amount: i.offer_discount_amount,
      offer_discounted_amount: i.offer_discounted_amount,
      offer_expiry: i.offer_expiry,
      amount: i.amount,
      invoice_number: i.invoice_number,
      customer_name: i.customer_name,
      due_date: i.due_date,
    }));
    setOffers(activeOffers);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedOffers = (offers || []).filter(o => selected[o.offer_id]);
  const totalPay  = selectedOffers.reduce((s, o) => s + o.offer_discounted_amount, 0);
  const totalSave = selectedOffers.reduce((s, o) => s + o.offer_discount_amount, 0);

  async function confirmPayment() {
    for (const o of selectedOffers) {
      await fetch(`/api/offers/${o.offer_id}/accept`, { method:'POST' });
    }
    toast(`✅ ${selectedOffers.length} invoice${selectedOffers.length!==1?'s':''} paid early!`);
    setSelected({});
    load(); onMutate();
  }

  const expDays = exp => {
    const d = daysBetween(exp);
    const color = d < 3 ? '#DC2626' : d <= 6 ? '#D97706' : '#059669';
    return <span style={{ fontSize:11, fontWeight:600, color }}>{d < 0 ? 'Expired' : `${d}d remaining`}</span>;
  };

  return (
    <div>
      <div style={{ background:'#1A3C5E', borderRadius:12, padding:'20px 24px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:18, color:'#fff' }}>Pay early, save money</div>
          <div style={{ fontSize:13, color:'#7DD3FC', marginTop:4 }}>Select invoices below to pay at a discount</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:11, color:'#7DD3FC' }}>Total available savings</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#A7F3D0' }}>
            {fmt$((offers||[]).reduce((s, o) => s + o.offer_discount_amount, 0))}
          </div>
        </div>
      </div>

      {!offers && <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>Loading…</div>}
      {offers && offers.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#9CA3AF', fontSize:13 }}>No active early payment offers available.</div>}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {(offers||[]).map(o => (
          <div key={o.offer_id} onClick={() => setSelected(p => ({ ...p, [o.offer_id]: !p[o.offer_id] }))}
            style={{
              background:'#fff', border:`2px solid ${selected[o.offer_id]?'#7C3AED':'#E2E8F0'}`,
              borderRadius:10, padding:16, cursor:'pointer', display:'flex', gap:16, alignItems:'center',
              background: selected[o.offer_id] ? '#F5F3FF' : '#fff',
            }}>
            <input type="checkbox" checked={!!selected[o.offer_id]} onChange={() => {}} style={{ width:16, height:16, flexShrink:0 }} />
            <div style={{ flex:1, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
              <AvatarChip name={o.customer_name} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:'#111827' }}>{o.customer_name}</div>
                <div style={{ fontSize:11, fontFamily:'monospace', color:'#9CA3AF' }}>{o.invoice_number} · Due {fmtDate(o.due_date)}</div>
                <div style={{ marginTop:4 }}>{expDays(o.offer_expiry)}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:13, color:'#9CA3AF', textDecoration:'line-through' }}>{fmt$(o.amount)}</div>
              </div>
            </div>
            <div style={{ background:'#EDE9FE', borderRadius:8, padding:'10px 16px', textAlign:'right', minWidth:140 }}>
              <div style={{ fontSize:20, fontWeight:700, color:'#7C3AED' }}>{fmt$(o.offer_discounted_amount)}</div>
              <div style={{ fontSize:11, color:'#059669', fontWeight:600 }}>You save {fmt$(o.offer_discount_amount)}</div>
              <div style={{ fontSize:10, color:'#9CA3AF' }}>{o.offer_pct}% discount</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky bottom bar */}
      {selectedOffers.length > 0 && (
        <div style={{
          position:'sticky', bottom:0, background:'#fff', borderTop:'1px solid #E2E8F0',
          padding:'12px 20px', display:'flex', alignItems:'center', gap:16, marginTop:16,
          boxShadow:'0 -2px 8px rgba(0,0,0,0.06)', borderRadius:'0 0 12px 12px'
        }}>
          <div style={{ flex:1, fontSize:13, color:'#374151' }}>
            <strong>{selectedOffers.length} selected</strong> · You pay <strong style={{ color:'#7C3AED' }}>{fmt$(totalPay)}</strong> · You save <strong style={{ color:'#059669' }}>{fmt$(totalSave)}</strong>
          </div>
          <button onClick={confirmPayment} style={{ padding:'8px 20px', background:'#7C3AED', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Confirm payment
          </button>
        </div>
      )}
    </div>
  );
}

// ── OffersView ────────────────────────────────────────────────────────────────
function OffersView({ onMutate, toast }) {
  const [activity, setActivity] = useState(null);
  const load = useCallback(async () => setActivity(await fetch('/api/activity').then(r=>r.json())), []);
  useEffect(() => { load(); }, [load]);

  async function simulate(offerId, name) {
    await fetch(`/api/offers/${offerId}/accept`, { method:'POST' });
    toast(`✅ ${name} accepted the offer! Invoice marked paid.`);
    load(); onMutate();
  }

  const totalSaved = (activity||[]).filter(a=>a.status==='accepted').reduce((s,a)=>s+a.discount_amount,0);

  function feedIcon(status) { return status==='accepted'?'✅':status==='expired'||status==='withdrawn'?'❌':'💰'; }

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #E2E8F0', padding:20 }}>
      <div style={{ fontWeight:700, color:'#1A3C5E', fontSize:14, marginBottom:16 }}>Offer Activity</div>
      {!activity && <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>Loading…</div>}
      <div style={{ display:'flex', flexDirection:'column' }}>
        {(activity||[]).map(a => {
          const faded = a.status==='expired'||a.status==='withdrawn';
          return (
            <div key={a.id} style={{ borderBottom:'1px solid #F3F4F6', paddingBottom:12, paddingTop:12, opacity:faded?0.55:1 }}>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:18 }}>{feedIcon(a.status)}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, textDecoration:faded?'line-through':'none', color:faded?'#9CA3AF':'#111827' }}>
                    {a.customer_name} <span style={{ fontFamily:'monospace', fontSize:11, color:'#9CA3AF', fontWeight:400 }}>— {a.invoice_number}</span>
                  </div>
                  <div style={{ fontSize:12, color:'#6B7280' }}>{a.discount_pct}% discount · {fmt$(a.discount_amount)} savings</div>
                  <div style={{ marginTop:4, display:'flex', gap:8, alignItems:'center' }}>
                    {a.status==='active' && <><span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#7C3AED', fontWeight:600 }}><span style={{ width:6, height:6, borderRadius:'50%', background:'#7C3AED', display:'inline-block' }} />Active</span></>}
                    {a.status==='accepted' && <span style={{ fontSize:11, color:'#059669', fontWeight:600 }}>Paid early — saved {fmt$(a.discount_amount)}</span>}
                    <span style={{ fontSize:11, color:'#D1D5DB' }}>{fmtDate(a.created_at)}</span>
                  </div>
                  {a.status==='active' && (
                    <button onClick={() => simulate(a.id, a.customer_name)} style={{ marginTop:6, padding:'4px 12px', background:'#D1FAE5', color:'#065F46', border:'1px solid #6EE7B7', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                      Simulate Acceptance
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {activity && activity.length > 0 && (
        <div style={{ borderTop:'1px solid #E2E8F0', paddingTop:12, marginTop:4, fontSize:12, color:'#6B7280' }}>
          Total saved by early payment: <strong style={{ color:'#059669' }}>{fmt$(totalSaved)}</strong>
        </div>
      )}
    </div>
  );
}

// ── Shared form helpers ───────────────────────────────────────────────────────
const fieldStyle = { width:'100%', padding:'8px', border:'1px solid #E2E8F0', borderRadius:6, fontSize:13, boxSizing:'border-box' };
function Field({ label, children }) {
  return <div style={{ marginBottom:12 }}><label style={{ fontSize:12, color:'#6B7280', display:'block', marginBottom:4 }}>{label}</label>{children}</div>;
}
function NoteForm({ invoiceId, label = 'Internal note', toast }) {
  const [note, setNote] = useState('');
  async function save() {
    if (!note.trim()) return;
    await fetch('/api/activity', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ invoice_id: invoiceId, message: note, type:'note' }) });
    setNote(''); toast('Note saved');
  }
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:500, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{label}</div>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Add a note…"
        style={{ ...fieldStyle, resize:'vertical', marginBottom:6 }} />
      <button onClick={save} style={{ padding:'5px 12px', border:'1px solid #E2E8F0', borderRadius:6, fontSize:12, cursor:'pointer' }}>Save note</button>
    </div>
  );
}

// ── Invoice Drawer ────────────────────────────────────────────────────────────
function InvoiceDrawer({ invoiceId, invoices, onClose, openDrawer, toast, onMutate }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!invoiceId) return;
    fetch(`/api/invoices/${invoiceId}`).then(r => r.json()).then(setData);
  }, [invoiceId]);

  if (!data) return (
    <div style={{ padding:40, textAlign:'center', color:'#9CA3AF' }}>Loading…</div>
  );

  const inv = data, cu = data.customer, ao = data.active_offer, ap = data.active_ptp, ad = data.open_dispute;
  const logs = data.activity || [];

  function openPTPForm() {
    openDrawer(
      <div>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:600 }}>Record promise to pay</div>
          <button onClick={onClose} style={{ padding:'4px 10px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕</button>
        </div>
        <PTPForm invoiceId={inv.id} amount={inv.amount} customerId={cu.id} onClose={onClose} toast={toast} onMutate={onMutate} />
      </div>
    );
  }

  function openDisputeForm() {
    openDrawer(
      <div>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:600 }}>Open dispute</div>
          <button onClick={onClose} style={{ padding:'4px 10px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕</button>
        </div>
        <DisputeFormInline invoiceId={inv.id} customerId={cu.id} amount={inv.amount} onClose={onClose} toast={toast} onMutate={onMutate} />
      </div>
    );
  }

  function openOfferForm() {
    openDrawer(
      <div>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:600 }}>Send early payment offer</div>
          <button onClick={onClose} style={{ padding:'4px 10px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕</button>
        </div>
        <QuickOfferForm invoice={inv} onClose={onClose} toast={toast} onMutate={onMutate} />
      </div>
    );
  }

  const dpd = inv.days_past_due;
  const dpdColor  = dpd >= 60 ? '#E24B4A' : dpd >= 30 ? '#D97706' : '#1D9E75';
  const prio = data.priority || {};
  const ps = prio.tier ? PRIORITY_STYLES[prio.tier] : null;
  const riskFactors = data.risk_factors || [];

  function openPaymentForm() {
    openDrawer(
      <div>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:600 }}>Record payment received</div>
          <button onClick={onClose} style={{ padding:'4px 10px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕</button>
        </div>
        <RecordPaymentForm invoice={inv} onClose={onClose} toast={toast} onMutate={onMutate} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
        <div>
          <div style={{ fontSize:11, color:'#6B7280', fontFamily:'monospace' }}>{inv.invoice_number}</div>
          <div style={{ fontSize:22, fontWeight:600, marginTop:2 }}>{fmt$(inv.amount)}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {prio.tier && ps && (
            <span style={{ padding:'2px 8px', borderRadius:9999, fontSize:11, fontWeight:700, background:ps.bg, color:ps.color, border:`1px solid ${ps.border}` }}>
              {prio.tier} · {prio.label}
            </span>
          )}
          <Badge text={inv.status.charAt(0).toUpperCase()+inv.status.slice(1)} color={inv.status==='paid'?'green':inv.status==='overdue'?'red':'blue'} />
          <button onClick={onClose} style={{ padding:'4px 10px', border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', fontSize:12 }}>✕</button>
        </div>
      </div>
      <div style={{ padding:'16px 20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
          {[['Customer',cu.name],['Due date',fmtDate(inv.due_date)],['Days past due', dpd ? `${dpd}d` : 'Current'],['Priority', prio.label || '—']].map(([lbl,val],i) => (
            <div key={lbl} style={{ background:'#F9FAFB', borderRadius:8, padding:10 }}>
              <div style={{ fontSize:10, color:'#9CA3AF' }}>{lbl}</div>
              <div style={{ fontWeight:500, marginTop:2, color: i===2&&dpd>0 ? dpdColor : i===3&&ps ? ps.color : '#111827' }}>{val}</div>
            </div>
          ))}
        </div>

        {prio.recommended_action && inv.status !== 'paid' && (
          <div style={{ background: ps?.bg || '#F9FAFB', border:`1px solid ${ps?.border || '#E2E8F0'}`, borderRadius:8, padding:'8px 12px', marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:600, color: ps?.color || '#374151' }}>Recommended action</div>
            <div style={{ fontSize:12, color:'#374151', marginTop:3 }}>{prio.recommended_action}</div>
          </div>
        )}

        {riskFactors.length > 0 && (
          <div style={{ background:'#F9FAFB', borderRadius:8, padding:'8px 12px', marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#374151', marginBottom:4 }}>Risk signals</div>
            {riskFactors.map((f, i) => (
              <div key={i} style={{ fontSize:11, color:'#6B7280', display:'flex', gap:4, alignItems:'flex-start', marginBottom:2 }}>
                <span style={{ color:'#EA580C', flexShrink:0 }}>•</span><span>{f}</span>
              </div>
            ))}
          </div>
        )}

        {ap && <div style={{ background:'#D1FAE5', border:'1px solid #6EE7B7', borderRadius:8, padding:10, marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#065F46' }}>⟳ Active promise to pay</div>
          <div style={{ fontSize:12, color:'#047857', marginTop:3 }}>{fmt$(ap.promised_amount)} promised by {fmtDate(ap.promise_date)}</div>
        </div>}
        {ad && <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:8, padding:10, marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#78350F' }}>⚠ Open dispute</div>
          <div style={{ fontSize:12, color:'#92400E', marginTop:3 }}>{ad.type} · {fmt$(ad.disputed_amount)} disputed</div>
        </div>}
        {ao && <div style={{ background:'#EDE9FE', border:'1px solid #C4B5FD', borderRadius:8, padding:10, marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#4C1D95' }}>⬡ Active discount offer</div>
          <div style={{ fontSize:12, color:'#5B21B6', marginTop:3 }}>{ao.discount_pct}% discount · buyer saves {fmt$(ao.discount_amount)} · expires {fmtDate(ao.expiry_date)}</div>
        </div>}

        <div style={{ fontSize:11, fontWeight:500, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Quick actions</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
          {inv.status !== 'paid' && <button onClick={openPaymentForm} style={{ padding:'5px 10px', background:'#059669', color:'white', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:600 }}>Record Payment</button>}
          {inv.status !== 'paid' && !ap && !ad && <button onClick={openPTPForm} style={{ padding:'5px 10px', border:'1px solid #E2E8F0', borderRadius:6, fontSize:12, cursor:'pointer' }}>Record PTP</button>}
          {inv.status !== 'paid' && !ad && <button onClick={openDisputeForm} style={{ padding:'5px 10px', border:'1px solid #E2E8F0', borderRadius:6, fontSize:12, cursor:'pointer' }}>Open dispute</button>}
          {inv.status !== 'paid' && !ao && <button onClick={openOfferForm} style={{ padding:'5px 10px', background:'#7C3AED', color:'white', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:600 }}>Send offer</button>}
        </div>

        <div style={{ fontSize:11, fontWeight:500, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Activity log</div>
        {logs.length === 0 && <div style={{ fontSize:12, color:'#9CA3AF' }}>No activity yet</div>}
        {logs.map(l => (
          <div key={l.id} style={{ display:'flex', gap:8, paddingBottom:10, borderLeft:'1px solid #E2E8F0', paddingLeft:10, marginLeft:5, marginBottom:4 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, color:'#374151' }}>{l.message}</div>
              <div style={{ fontSize:10, color:'#9CA3AF', marginTop:2 }}>{fmtDate(l.created_at)}</div>
            </div>
          </div>
        ))}

        <div style={{ marginTop:16 }}>
          <NoteForm invoiceId={inv.id} toast={toast} />
        </div>
      </div>
    </div>
  );
}

function PTPForm({ invoiceId, amount, customerId, onClose, toast, onMutate }) {
  const [amt, setAmt]   = useState(amount);
  const [date, setDate] = useState(todayPlus(14));
  const [notes, setNotes] = useState('');

  async function save(e) {
    e.preventDefault();
    await fetch('/api/promises', { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ invoice_id: invoiceId, customer_id: customerId, promised_amount: parseFloat(amt), promise_date: date, notes }) });
    onClose(); onMutate(); toast(`PTP recorded — dunning paused until ${fmtDate(date)}`);
  }
  return (
    <form onSubmit={save} style={{ padding:20 }}>
      <Field label="Promised amount"><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} style={fieldStyle} required /></Field>
      <Field label="Promise date"><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={fieldStyle} required /></Field>
      <Field label="Notes"><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="What the customer said…" style={{ ...fieldStyle, resize:'vertical' }} /></Field>
      <button type="submit" style={{ width:'100%', padding:10, background:'#1A3C5E', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Save promise to pay</button>
    </form>
  );
}

function DisputeFormInline({ invoiceId, customerId, amount, onClose, toast, onMutate }) {
  const [type, setType] = useState('Price discrepancy');
  const [amt, setAmt]   = useState(amount);
  const [desc, setDesc] = useState('');

  async function save(e) {
    e.preventDefault();
    await fetch('/api/disputes', { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ invoice_id: invoiceId, customer_id: customerId, type, disputed_amount: parseFloat(amt), description: desc }) });
    onClose(); onMutate(); toast('Dispute filed — active offer suspended','warning');
  }
  return (
    <form onSubmit={save} style={{ padding:20 }}>
      <Field label="Dispute type">
        <select value={type} onChange={e=>setType(e.target.value)} style={fieldStyle}>
          {['Price discrepancy','Quantity error','Duplicate invoice','Service not delivered','PO mismatch','Other'].map(t=><option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Disputed amount"><input type="number" value={amt} onChange={e=>setAmt(e.target.value)} style={fieldStyle} required /></Field>
      <Field label="Description"><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} placeholder="Describe the issue…" style={{ ...fieldStyle, resize:'vertical' }} /></Field>
      <button type="submit" style={{ width:'100%', padding:10, background:'#DC2626', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Open dispute</button>
    </form>
  );
}

function QuickOfferForm({ invoice, onClose, toast, onMutate }) {
  const [pct, setPct]     = useState(suggestDiscount(invoice.days_past_due));
  const [expiry, setExpiry] = useState(todayPlus(7));
  const discountAmt = invoice.amount * pct / 100;
  const buyerPays   = invoice.amount - discountAmt;

  async function save(e) {
    e.preventDefault();
    const res = await fetch('/api/offers', { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ invoice_id: invoice.id, discount_pct: parseFloat(pct), expiry_date: expiry }) });
    if (!res.ok) { toast((await res.json()).error || 'Failed','error'); return; }
    onClose(); onMutate(); toast('Offer sent!');
  }
  return (
    <form onSubmit={save} style={{ padding:20 }}>
      <div style={{ background:'#F9FAFB', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:13 }}>
        <strong>{invoice.customer_name}</strong> · {invoice.invoice_number} · {fmt$(invoice.amount)}
      </div>
      <Field label="Discount %"><input type="number" step="0.1" min="0.1" max="20" value={pct} onChange={e=>setPct(e.target.value)} style={fieldStyle} required /></Field>
      <Field label="Expiry date"><input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)} style={fieldStyle} required /></Field>
      {pct > 0 && (
        <div style={{ background:'#EDE9FE', borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:14 }}>
          Buyer pays <strong style={{ color:'#059669' }}>{fmt$(buyerPays)}</strong> · Saves <strong style={{ color:'#7C3AED' }}>{fmt$(discountAmt)}</strong>
        </div>
      )}
      <button type="submit" style={{ width:'100%', padding:10, background:'#7C3AED', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Send offer</button>
    </form>
  );
}

// ── RecordPaymentForm ─────────────────────────────────────────────────────────
function RecordPaymentForm({ invoice, onClose, toast, onMutate }) {
  const [amount, setAmount] = useState(invoice.amount);
  const [method, setMethod] = useState('ach');
  const [date, setDate]     = useState(todayPlus(0));
  const [notes, setNotes]   = useState('');
  const [loading, setLoading] = useState(false);

  async function save(e) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/payments', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ invoice_id: invoice.id, amount: parseFloat(amount), payment_method: method, received_date: date, notes }),
    });
    if (!res.ok) { toast((await res.json()).error || 'Failed', 'error'); setLoading(false); return; }
    const full = parseFloat(amount) >= invoice.amount;
    toast(full ? `Payment recorded — ${invoice.invoice_number} marked paid!` : 'Partial payment recorded');
    onClose(); onMutate();
  }

  return (
    <form onSubmit={save} style={{ padding:20 }}>
      <div style={{ background:'#F9FAFB', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:13 }}>
        <strong>{invoice.customer_name}</strong> · {invoice.invoice_number} · Outstanding {fmt$(invoice.amount)}
      </div>
      <Field label="Amount received">
        <input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={fieldStyle} required />
      </Field>
      <Field label="Payment method">
        <select value={method} onChange={e => setMethod(e.target.value)} style={fieldStyle}>
          {['ach','wire','check','card','cash'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
        </select>
      </Field>
      <Field label="Received date">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fieldStyle} required />
      </Field>
      <Field label="Notes">
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ref # or memo…" style={fieldStyle} />
      </Field>
      {parseFloat(amount) >= invoice.amount && (
        <div style={{ background:'#D1FAE5', border:'1px solid #6EE7B7', borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:12 }}>
          Full payment — invoice will be marked <strong>Paid</strong>
        </div>
      )}
      <button type="submit" disabled={loading} style={{ width:'100%', padding:10, background:'#059669', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
        {loading ? 'Recording…' : 'Record payment'}
      </button>
    </form>
  );
}

// ── DunningView ───────────────────────────────────────────────────────────────
const DUNNING_STEP_LABELS = {
  invoice_issued:    { label:'Invoice Issued',     timing:'Day 0' },
  pre_due_reminder:  { label:'Pre-Due Reminder',   timing:'−7 days' },
  due_date_notice:   { label:'Due Date Notice',    timing:'Due date' },
  first_overdue:     { label:'1st Overdue',        timing:'+7 DPD' },
  escalated_notice:  { label:'Escalated Notice',   timing:'+21 DPD' },
  senior_outreach:   { label:'Senior Outreach',    timing:'+45 DPD' },
  legal_flag:        { label:'Legal Flag',         timing:'+90 DPD' },
  completed:         { label:'Completed',          timing:'—' },
};
const STEP_ORDER = ['invoice_issued','pre_due_reminder','due_date_notice','first_overdue','escalated_notice','senior_outreach','legal_flag'];

function DunningView({ toast, onMutate }) {
  const [seqs, setSeqs] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setSeqs(await fetch('/api/dunning').then(r => r.json()));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function advance(invoiceId) {
    await fetch(`/api/dunning/${invoiceId}/advance`, { method:'POST' });
    toast('Dunning advanced'); load(); onMutate();
  }

  const filtered = (seqs || []).filter(s => {
    if (filter === 'active')     return s.status === 'active' && !s.suppressed_by;
    if (filter === 'suppressed') return s.suppressed_by && s.invoice_status !== 'paid';
    if (filter === 'completed')  return s.invoice_status === 'paid' || s.status === 'completed';
    return true;
  });

  const suppressLabel = { dispute:'Dispute open', ptp:'PTP active', offer:'Offer active', paid:'Invoice paid' };
  const suppressColor = { dispute:'#D97706', ptp:'#059669', offer:'#7C3AED', paid:'#9CA3AF' };

  return (
    <div>
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #E2E8F0', padding:20, marginBottom:16 }}>
        <div style={{ fontWeight:700, color:'#1A3C5E', fontSize:14, marginBottom:4 }}>Dunning Sequences</div>
        <div style={{ fontSize:12, color:'#9CA3AF' }}>Track and manage automated outreach for every open invoice</div>
        {seqs && (
          <div style={{ display:'flex', gap:16, marginTop:12 }}>
            {[
              { label:'Active', val: seqs.filter(s => s.status === 'active' && !s.suppressed_by && s.invoice_status !== 'paid').length, color:'#1A3C5E' },
              { label:'Suppressed', val: seqs.filter(s => s.suppressed_by && s.invoice_status !== 'paid').length, color:'#D97706' },
              { label:'Completed', val: seqs.filter(s => s.invoice_status === 'paid').length, color:'#059669' },
            ].map(m => (
              <div key={m.label} style={{ background:'#F9FAFB', borderRadius:8, padding:'8px 14px' }}>
                <div style={{ fontSize:10, color:'#9CA3AF', textTransform:'uppercase' }}>{m.label}</div>
                <div style={{ fontSize:20, fontWeight:700, color:m.color }}>{m.val}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        {[['all','All'],['active','Active'],['suppressed','Suppressed'],['completed','Completed']].map(([id,lbl]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding:'4px 12px', borderRadius:9999, fontSize:11, fontWeight:600, cursor:'pointer',
            border:`1px solid ${filter===id?'#1A3C5E':'#E2E8F0'}`,
            background:filter===id?'#1A3C5E':'#fff', color:filter===id?'#fff':'#6B7280',
          }}>{lbl}</button>
        ))}
      </div>

      {!seqs && <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>Loading…</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.map(s => {
          const currentIdx = STEP_ORDER.indexOf(s.expected_step);
          const isDone = s.invoice_status === 'paid';
          return (
            <div key={s.id} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:16, opacity: isDone ? 0.65 : 1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13, color:'#111827' }}>{s.customer_name}</div>
                  <div style={{ fontFamily:'monospace', fontSize:11, color:'#9CA3AF' }}>{s.invoice_number} · {fmt$(s.amount)}</div>
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  {s.suppressed_by && (
                    <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:9999, background:'#FFF7ED', color: suppressColor[s.suppressed_by] || '#D97706' }}>
                      ⏸ {suppressLabel[s.suppressed_by] || 'Suppressed'}
                    </span>
                  )}
                  {!s.suppressed_by && !isDone && s.days_past_due > 0 && (
                    <span style={{ fontSize:11, color:'#DC2626', fontWeight:600 }}>{s.days_past_due}d overdue</span>
                  )}
                  {isDone && <Badge text="Paid" color="green" />}
                </div>
              </div>

              {/* Dunning timeline */}
              <div style={{ display:'flex', gap:0, alignItems:'center', overflowX:'auto', paddingBottom:4 }}>
                {STEP_ORDER.map((step, i) => {
                  const isActive  = step === s.expected_step;
                  const isPast    = i < currentIdx;
                  const stepMeta  = DUNNING_STEP_LABELS[step];
                  const dotColor  = isDone ? '#9CA3AF' : isActive ? '#1A3C5E' : isPast ? '#059669' : '#E2E8F0';
                  const lineColor = isPast || (isDone && i < STEP_ORDER.length - 1) ? '#059669' : '#E2E8F0';
                  return (
                    <React.Fragment key={step}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:64 }}>
                        <div style={{ width:14, height:14, borderRadius:'50%', background: dotColor, border:`2px solid ${dotColor}`, marginBottom:4 }} />
                        <div style={{ fontSize:9, color: isActive ? '#1A3C5E' : '#9CA3AF', fontWeight: isActive ? 700 : 400, textAlign:'center', lineHeight:1.2 }}>{stepMeta.label}</div>
                        <div style={{ fontSize:9, color:'#C4C9D4' }}>{stepMeta.timing}</div>
                      </div>
                      {i < STEP_ORDER.length - 1 && (
                        <div style={{ flex:1, height:2, background:lineColor, minWidth:8, marginTop:-24 }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {!s.suppressed_by && !isDone && (
                <div style={{ marginTop:10, display:'flex', gap:8 }}>
                  <button onClick={() => advance(s.invoice_id)} style={{
                    padding:'4px 12px', background:'#1A3C5E', color:'#fff', border:'none',
                    borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer'
                  }}>
                    Advance → {DUNNING_STEP_LABELS[STEP_ORDER[Math.min(STEP_ORDER.indexOf(s.expected_step) + 1, STEP_ORDER.length - 1)]]?.label}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {seqs && filtered.length === 0 && <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>No invoices match this filter.</div>}
      </div>
    </div>
  );
}

// ── ControllerView ────────────────────────────────────────────────────────────
function ControllerView() {
  const [dash, setDash] = useState(null);

  const load = useCallback(async () => {
    setDash(await fetch('/api/controller/dashboard').then(r => r.json()));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!dash) return <div style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>Loading…</div>;

  const { active_ptps, funnel, funnel_amounts, dso_trend, cash_forecast, aging } = dash;
  const totalOpen = Object.values(aging).reduce((s, v) => s + v, 0);

  const FUNNEL_LABELS = {
    P1: { label:'Critical', color:'#DC2626', bg:'#FEF2F2' },
    P2: { label:'High',     color:'#EA580C', bg:'#FFF7ED' },
    P3: { label:'Medium',   color:'#D97706', bg:'#FFFBEB' },
    P4: { label:'Low',      color:'#16A34A', bg:'#F0FDF4' },
    P5: { label:'Watch',    color:'#7C3AED', bg:'#F5F3FF' },
    P6: { label:'Suppress', color:'#9CA3AF', bg:'#F9FAFB' },
  };

  const committedTotal = active_ptps.reduce((s, p) => s + p.promised_amount, 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { label:'Committed (PTPs)', val: fmt$(committedTotal), sub:`${active_ptps.length} active promises`, color:'#059669' },
          { label:'30-Day Cash — Likely', val: fmt$(cash_forecast.likely), sub:'easy/moderate, <15 DPD', color:'#1A3C5E' },
          { label:'At Risk', val: fmt$(cash_forecast.at_risk), sub:'medium grade / 15–45 DPD', color:'#D97706' },
          { label:'Total Open AR', val: fmt$(totalOpen), sub:'all open invoices', color:'#DC2626' },
        ].map(m => (
          <div key={m.label} style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:10, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em' }}>{m.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:m.color, marginTop:4 }}>{m.val}</div>
            <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Collection funnel */}
        <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:16 }}>
          <div style={{ fontWeight:700, color:'#1A3C5E', fontSize:13, marginBottom:12 }}>Collection Funnel by Priority</div>
          {Object.entries(FUNNEL_LABELS).map(([tier, meta]) => {
            const count = funnel[tier] || 0;
            const amt   = funnel_amounts[tier] || 0;
            const pct   = count > 0 && totalOpen > 0 ? (amt / totalOpen * 100) : 0;
            return (
              <div key={tier} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:12, color: meta.color, fontWeight:600 }}>{tier} {meta.label}</span>
                  <span style={{ fontSize:11, color:'#6B7280' }}>{count} inv · {fmt$(amt)}</span>
                </div>
                <div style={{ height:6, borderRadius:3, background:'#F3F4F6' }}>
                  <div style={{ height:'100%', borderRadius:3, background:meta.color, width:`${Math.min(pct, 100)}%`, transition:'width 0.4s' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Aging buckets */}
        <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:16 }}>
          <div style={{ fontWeight:700, color:'#1A3C5E', fontSize:13, marginBottom:12 }}>AR Aging Buckets</div>
          {[
            { key:'current',   label:'Current',     color:'#059669' },
            { key:'dpd_1_30',  label:'1–30 DPD',    color:'#1A3C5E' },
            { key:'dpd_31_60', label:'31–60 DPD',   color:'#D97706' },
            { key:'dpd_61_90', label:'61–90 DPD',   color:'#EA580C' },
            { key:'dpd_90plus',label:'90+ DPD',     color:'#DC2626' },
          ].map(b => {
            const amt = aging[b.key] || 0;
            const pct = totalOpen > 0 ? (amt / totalOpen * 100) : 0;
            return (
              <div key={b.key} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:12, color: b.color, fontWeight:600 }}>{b.label}</span>
                  <span style={{ fontSize:11, color:'#6B7280' }}>{fmt$(amt)} ({Math.round(pct)}%)</span>
                </div>
                <div style={{ height:6, borderRadius:3, background:'#F3F4F6' }}>
                  <div style={{ height:'100%', borderRadius:3, background:b.color, width:`${Math.min(pct, 100)}%`, transition:'width 0.4s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DSO trend */}
      {dso_trend.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:16 }}>
          <div style={{ fontWeight:700, color:'#1A3C5E', fontSize:13, marginBottom:12 }}>DSO Trend — Avg Days to Pay</div>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end', height:80 }}>
            {dso_trend.map(m => {
              const h = Math.min((m.avg_dtp / 70) * 100, 100);
              const c = m.avg_dtp > 45 ? '#DC2626' : m.avg_dtp > 30 ? '#D97706' : '#059669';
              return (
                <div key={m.month} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                  <div style={{ fontSize:10, color: c, fontWeight:600 }}>{Math.round(m.avg_dtp)}d</div>
                  <div style={{ width:'100%', background: c, borderRadius:'3px 3px 0 0', height:`${h}%`, minHeight:4, transition:'height 0.4s' }} />
                  <div style={{ fontSize:9, color:'#9CA3AF' }}>{m.month?.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active PTPs */}
      {active_ptps.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid #E2E8F0', borderRadius:10, padding:16 }}>
          <div style={{ fontWeight:700, color:'#1A3C5E', fontSize:13, marginBottom:12 }}>Active Promises to Pay</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#F9FAFB' }}>
                {['Customer','Invoice','Promised Amount','Promise Date'].map(h => (
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', color:'#6B7280', fontSize:10, textTransform:'uppercase', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active_ptps.map(p => (
                <tr key={p.id} style={{ borderBottom:'1px solid #F3F4F6' }}>
                  <td style={{ padding:'8px 10px', fontWeight:500 }}>{p.customer_name}</td>
                  <td style={{ padding:'8px 10px', fontFamily:'monospace', color:'#6B7280', fontSize:11 }}>{p.invoice_number}</td>
                  <td style={{ padding:'8px 10px', fontWeight:700, color:'#059669' }}>{fmt$(p.promised_amount)}</td>
                  <td style={{ padding:'8px 10px', color:'#374151' }}>{fmtDate(p.promise_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]       = useState('workqueue');
  const [invoices, setInvoices] = useState(null);
  const [stats, setStats]     = useState(null);
  const [drawerContent, setDrawerContent] = useState(null);
  const [drawerInvId, setDrawerInvId] = useState(null);
  const { toasts, toast } = useToast();

  const fetchAll = useCallback(async () => {
    try {
      const [inv, st] = await Promise.all([
        fetch('/api/invoices').then(r => r.json()),
        fetch('/api/stats').then(r => r.json()),
      ]);
      setInvoices(inv);
      setStats(st);
    } catch { toast('Failed to load data','error'); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openDrawer(el) { setDrawerInvId(null); setDrawerContent(el); }
  function closeDrawer()  { setDrawerContent(null); setDrawerInvId(null); }
  function openInvoiceDrawer(id) { setDrawerContent(null); setDrawerInvId(id); }

  async function handleSendOffer(data) {
    const res = await fetch('/api/offers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    if (!res.ok) { toast((await res.json()).error||'Failed','error'); return; }
    fetchAll(); toast('Offer sent!');
  }
  async function handleWithdraw(offerId) {
    const res = await fetch(`/api/offers/${offerId}/withdraw`, { method:'POST' });
    if (!res.ok) { toast('Failed to withdraw','error'); return; }
    fetchAll(); toast('Offer withdrawn.');
  }

  const sharedProps = { toast, onMutate: fetchAll, openDrawer, closeDrawer };

  function renderView() {
    switch (view) {
      case 'workqueue':   return <WorkqueueView invoices={invoices} onSendOffer={handleSendOffer} onWithdraw={handleWithdraw} onRowClick={openInvoiceDrawer} stats={stats} />;
      case 'invoices':    return <InvoicesView invoices={invoices} onRowClick={openInvoiceDrawer} />;
      case 'disputes':    return <DisputesView invoices={invoices} {...sharedProps} />;
      case 'promises':    return <PromisesView {...sharedProps} />;
      case 'dunning':     return <DunningView {...sharedProps} />;
      case 'intel':       return <CustomerIntelView {...sharedProps} />;
      case 'controller':  return <ControllerView />;
      case 'offers':      return <OffersView {...sharedProps} />;
      case 'smart':       return <SmartOffersView {...sharedProps} />;
      case 'buyer':       return <BuyerPortalView {...sharedProps} />;
      default:            return null;
    }
  }

  return (
    <div style={{ display:'grid', gridTemplateRows:'52px 1fr', height:'100vh', background:'#F0F4F8' }}>
      <Toasts toasts={toasts} />

      {/* Drawer */}
      <Drawer content={
        drawerInvId ? (
          <InvoiceDrawer
            invoiceId={drawerInvId}
            invoices={invoices}
            onClose={closeDrawer}
            openDrawer={setDrawerContent}
            toast={toast}
            onMutate={fetchAll}
          />
        ) : drawerContent
      } onClose={closeDrawer} />

      {/* Header */}
      <header style={{ background:'#1A3C5E', color:'#fff', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:'0 2px 4px rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900 }}>C</div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, letterSpacing:'-0.01em', lineHeight:1 }}>ClearAR</div>
            <div style={{ fontSize:10, color:'#93C5FD', marginTop:1, lineHeight:1 }}>Collections &amp; Early Payment</div>
          </div>
        </div>
        <div style={{ fontSize:11, color:'#93C5FD' }}>
          {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
        </div>
      </header>

      {/* Body */}
      <div style={{ display:'grid', gridTemplateColumns:'210px 1fr', overflow:'hidden' }}>
        <Sidebar active={view} onChange={v => { setView(v); }} stats={stats} />
        <main style={{ overflowY:'auto', padding:20 }}>
          {renderView()}
        </main>
      </div>
    </div>
  );
}
