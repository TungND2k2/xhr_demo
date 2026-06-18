import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Briefcase, FileText, Clock, AlertCircle, TrendingUp, Bell,
  ShieldAlert, Plane, Calendar, DollarSign, ArrowRight, Globe, Award,
  Inbox, CheckSquare, Sparkles, Activity, CalendarClock,
} from 'lucide-react';
import { countDocs, listDocs } from '../api/payload';
import {
  WORKER_STATUS_LABELS, MARKET_LABELS, fmtDate,
} from '../lib/workers-labels';

/* ────────── Helpers ────────── */
const STAGE_FUNNEL = [
  { code: 'researching', label: 'W1 Tuyển' },
  { code: 'agreed',       label: 'W1 Đồng ý' },
  { code: 'health_check', label: 'W2 Khám SK' },
  { code: 'deposit_paid', label: 'W3 Cọc' },
  { code: 'training',     label: 'W3 Đào tạo' },
  { code: 'passed',       label: 'W4 Pass PV' },
  { code: 'contracted',   label: 'W5 Ký HĐ' },
  { code: 'visa_prep',    label: 'W6 Visa' },
  { code: 'deployed',     label: 'W7 Bay' },
];
const MARKET_COLORS = {
  jp: '#3b82f6', kr: '#06b6d4', tw: '#10b981', de: '#f59e0b',
  me: '#ef4444', eu: '#a855f7', other: '#64748b',
};
const RANGE_OPTIONS = [
  { id: '7d',  label: '7 ngày',  days: 7 },
  { id: '30d', label: '30 ngày', days: 30 },
  { id: '90d', label: '90 ngày', days: 90 },
  { id: 'ytd', label: 'YTD',     days: null }, // year-to-date
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const isoMinusDays = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const isoPlusDays  = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/* ────────── Component ────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const [stats, setStats] = useState({});
  const [periodStats, setPeriodStats] = useState({});
  const [alerts, setAlerts] = useState({});
  const [funnelData, setFunnelData] = useState([]);
  const [marketData, setMarketData] = useState([]);
  const [topPartners, setTopPartners] = useState([]);
  const [recent, setRecent] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [todayEvents, setTodayEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const rangeDays = useMemo(() => {
    const r = RANGE_OPTIONS.find((x) => x.id === range);
    if (r?.days != null) return r.days;
    // YTD: days since Jan 1
    const start = new Date(new Date().getFullYear(), 0, 1);
    return Math.ceil((Date.now() - start.getTime()) / 86_400_000);
  }, [range]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const fromIso = isoMinusDays(rangeDays);

      const [
        workers,
        recentDocs,
        ordersForPartners,
        donActive, hdCuc, coePending,
        cucOverdue, coeOverdue, deadlineNear, depositUnrefunded,
        newWorkers, newOrders, newContracts, newDocs,
        upcomingReminders,
        todayCalendars,
        recentReminders,
      ] = await Promise.all([
        listDocs('workers', { limit: 1000, depth: 0, sort: '-updatedAt' }),
        listDocs('official-documents', { limit: 5, depth: 0, sort: '-issuedDate' }),
        listDocs('orders', { limit: 500, depth: 1, sort: '-orderDate' }),

        // Current state KPIs
        countDocs('orders', { status: { in: 'w1,w2,w3,w4,w5,w6,w7' } }),
        countDocs('supply-contracts', { cucApprovalStatus: { in: 'not_submitted,pending,needs_revision' } }),
        countDocs('contracts', { coeReceivedAt: { exists: false } }),

        // Alerts
        countDocs('supply-contracts', { and: [{ cucApprovalStatus: { in: 'pending,needs_revision' } }, { cucRegistrationDate: { less_than: isoMinusDays(30) } }] }),
        countDocs('contracts', { and: [{ coeReceivedAt: { exists: false } }, { signingDate: { less_than: isoMinusDays(60) } }] }),
        countDocs('orders', { and: [{ deadline: { less_than_equal: isoPlusDays(7) } }, { deadline: { greater_than_equal: todayIso() } }, { status: { in: 'w1,w2,w3,w4,w5,w6,w7' } }] }),
        countDocs('workers', { and: [{ status: { equals: 'failed' } }, { depositRefundedAt: { exists: false } }, { depositAmount: { greater_than: 0 } }] }),

        // Period activity (KPI "kỳ này")
        countDocs('workers', { createdAt: { greater_than_equal: fromIso } }),
        countDocs('orders', { createdAt: { greater_than_equal: fromIso } }),
        countDocs('contracts', { createdAt: { greater_than_equal: fromIso } }),
        countDocs('official-documents', { createdAt: { greater_than_equal: fromIso } }),

        // Tasks của tôi: reminders sắp đến hạn (7 ngày tới)
        listDocs('reminders', {
          where: { and: [{ status: { equals: 'pending' } }, { dueAt: { less_than_equal: isoPlusDays(7) } }] },
          limit: 8, depth: 0, sort: 'dueAt',
        }),

        // Today's events: calendars hôm nay
        listDocs('calendars', {
          where: { and: [{ startAt: { greater_than_equal: todayIso() } }, { startAt: { less_than: isoPlusDays(1) } }] },
          limit: 5, depth: 0, sort: 'startAt',
        }),

        // Activity feed: reminders gần đây
        listDocs('reminders', { limit: 5, depth: 0, sort: '-updatedAt' }),
      ]);
      if (cancel) return;

      // KPI từ workers list
      const byStatus = new Map();
      const byMarket = new Map();
      for (const w of workers.docs ?? []) {
        byStatus.set(w.status, (byStatus.get(w.status) ?? 0) + 1);
        if (w.market) byMarket.set(w.market, (byMarket.get(w.market) ?? 0) + 1);
      }
      const dangONhat = (byStatus.get('deployed') ?? 0) + (byStatus.get('working') ?? 0);
      setStats({ dang_o_nhat: dangONhat, don_active: donActive, hd_pending_cuc: hdCuc, coe_pending: coePending });
      setPeriodStats({ workers: newWorkers, orders: newOrders, contracts: newContracts, docs: newDocs });
      setAlerts({ cuc_overdue: cucOverdue, coe_overdue: coeOverdue, deadline_near: deadlineNear, deposit_unrefunded: depositUnrefunded });

      // Funnel với conversion %
      const total = STAGE_FUNNEL.reduce((s, x) => s + (byStatus.get(x.code) ?? 0), 0);
      const maxCount = Math.max(...STAGE_FUNNEL.map((s) => byStatus.get(s.code) ?? 0), 1);
      setFunnelData(STAGE_FUNNEL.map((s, i) => {
        const count = byStatus.get(s.code) ?? 0;
        const pct = Math.round((count / maxCount) * 100);
        const sharePct = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
        return { ...s, count, pct, sharePct };
      }));

      // Market donut
      const totalMkt = [...byMarket.values()].reduce((a, b) => a + b, 0);
      setMarketData([...byMarket.entries()].map(([code, count]) => ({
        code, count,
        label: MARKET_LABELS[code] ?? code,
        pct: totalMkt > 0 ? Math.round((count / totalMkt) * 1000) / 10 : 0,
        color: MARKET_COLORS[code] ?? '#64748b',
      })).sort((a, b) => b.count - a.count));

      // Top partners
      const partnerCount = new Map();
      for (const o of ordersForPartners.docs ?? []) {
        const p = typeof o.partner === 'object' ? o.partner : null;
        if (!p) continue;
        const cur = partnerCount.get(p.id) ?? { id: p.id, name: p.name ?? '?', country: p.country, count: 0 };
        cur.count += 1;
        partnerCount.set(p.id, cur);
      }
      const tops = [...partnerCount.values()].sort((a, b) => b.count - a.count).slice(0, 5);
      const maxTop = Math.max(...tops.map((t) => t.count), 1);
      setTopPartners(tops.map((t) => ({ ...t, pct: Math.round((t.count / maxTop) * 100) })));

      // Activity stream: merge workers + docs + reminders
      const wAct = (workers.docs ?? []).slice(0, 8).map((w) => ({
        kind: 'worker', id: w.id, icon: Briefcase, color: 'cyan',
        title: w.fullName ?? '(không tên)',
        sub: `${w.workerCode} · ${WORKER_STATUS_LABELS[w.status] ?? w.status}`,
        at: w.updatedAt,
      }));
      const dAct = (recentDocs.docs ?? []).map((d) => ({
        kind: 'doc', id: d.id, icon: Inbox, color: 'purple',
        title: d.title ?? '(công văn)',
        sub: `${d.documentCode ?? ''} · ${d.direction ?? ''}`,
        at: d.issuedDate ?? d.createdAt,
      }));
      const rAct = (recentReminders.docs ?? []).map((r) => ({
        kind: 'reminder', id: r.id, icon: Bell, color: 'amber',
        title: r.title ?? '(nhắc việc)',
        sub: r.status ?? '',
        at: r.updatedAt,
      }));
      setRecent([...wAct, ...dAct, ...rAct]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 10));

      // Tasks
      setTasks(upcomingReminders.docs ?? []);

      // Today's events: calendars + workers có healthCheckDate=today
      const events = [];
      for (const c of todayCalendars.docs ?? []) {
        events.push({ kind: 'calendar', id: c.id, title: c.title, sub: c.eventType, at: c.startAt });
      }
      // Health check today
      const todayCheck = (workers.docs ?? []).filter((w) => w.healthCheckDate && w.healthCheckDate.slice(0, 10) === todayIso());
      for (const w of todayCheck) {
        events.push({ kind: 'health', id: w.id, title: `Khám SK: ${w.fullName}`, sub: w.healthCheckLocation ?? '', at: w.healthCheckDate });
      }
      // Training start today
      const todayTraining = (workers.docs ?? []).filter((w) => w.trainingStartDate && w.trainingStartDate.slice(0, 10) === todayIso());
      for (const w of todayTraining) {
        events.push({ kind: 'training', id: w.id, title: `Khai giảng lớp: ${w.fullName}`, sub: w.trainingGroup ?? '', at: w.trainingStartDate });
      }
      setTodayEvents(events.slice(0, 6));

      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [rangeDays]);

  const KPIS = [
    { label: 'LĐ đang ở Nhật', value: stats.dang_o_nhat, icon: Briefcase, color: 'cyan' },
    { label: 'Đơn đang tuyển', value: stats.don_active, icon: FileText, color: 'cyan' },
    { label: 'HĐ chờ Cục QLLĐNN', value: stats.hd_pending_cuc, icon: Clock, color: 'purple' },
    { label: 'COE chờ về', value: stats.coe_pending, icon: AlertCircle, color: 'red' },
  ];
  const PERIOD_KPIS = [
    { label: 'LĐ mới', value: periodStats.workers, icon: Briefcase, color: 'blue' },
    { label: 'Đơn YCTD mới', value: periodStats.orders, icon: FileText, color: 'blue' },
    { label: 'HĐLĐ ký mới', value: periodStats.contracts, icon: CheckSquare, color: 'green' },
    { label: 'Công văn mới', value: periodStats.docs, icon: Inbox, color: 'purple' },
  ];
  const ALERTS = [
    { label: 'HĐ Cục treo > 30 ngày', value: alerts.cuc_overdue, icon: ShieldAlert, color: 'red', go: () => navigate('/reports?r=cuc-pending') },
    { label: 'COE chờ > 60 ngày',     value: alerts.coe_overdue, icon: Plane,      color: 'red', go: () => navigate('/reports?r=coe-pending') },
    { label: 'Đơn deadline < 7 ngày', value: alerts.deadline_near, icon: Calendar, color: 'amber', go: () => navigate('/reports?r=orders-expiring') },
    { label: 'Cọc chưa hoàn (LĐ trượt)', value: alerts.deposit_unrefunded, icon: DollarSign, color: 'amber', go: () => navigate('/workers') },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 print-area">
      {/* Header + time range */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight">Trung tâm Điều hành XKLĐ — Thịnh Long Group</h2>
          <p className="text-[var(--text-muted)] text-sm">Lao động Nhật Bản, đơn YCTD, HĐ Cung ứng và công văn.</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl border border-[var(--border-color)] bg-[var(--sidebar-bg)] no-print">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setRange(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                range === opt.id ? 'bg-blue-500 text-white shadow' : 'text-slate-500 hover:text-[var(--text-main)]'
              }`}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {/* KPI: Current state */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Hiện trạng</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {KPIS.map((kpi, i) => (
            <div key={i} className="glass-card p-5">
              <div className={`p-2.5 rounded-xl inline-flex mb-4 ${
                kpi.color === 'cyan' ? 'bg-cyan-500/10 text-cyan-500'
                : kpi.color === 'purple' ? 'bg-purple-500/10 text-purple-500'
                : 'bg-red-500/10 text-red-500'
              }`}><kpi.icon size={18} /></div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">{kpi.label}</p>
              <h3 className="text-3xl font-black text-[var(--text-main)]">{loading ? '…' : (kpi.value ?? '—')}</h3>
            </div>
          ))}
        </div>
      </div>

      {/* KPI: Period activity */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
          <Sparkles size={11} />Hoạt động {RANGE_OPTIONS.find((r) => r.id === range)?.label.toLowerCase()} qua
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PERIOD_KPIS.map((kpi, i) => (
            <div key={i} className="glass-card p-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${
                kpi.color === 'blue' ? 'bg-blue-500/10 text-blue-500'
                : kpi.color === 'green' ? 'bg-green-500/10 text-green-500'
                : 'bg-purple-500/10 text-purple-500'
              }`}><kpi.icon size={16} /></div>
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</p>
                <h3 className="text-xl font-black text-[var(--text-main)]">+{loading ? '…' : (kpi.value ?? 0)}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
          <AlertCircle size={11} />Cần xử lý ngay
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {ALERTS.map((a, i) => {
            const dangerous = (a.value ?? 0) > 0;
            return (
              <button key={i} onClick={a.go}
                className={`glass-card p-4 text-left group hover:scale-[1.01] transition-all ${
                  dangerous && a.color === 'red' ? 'border-red-500/30 bg-red-500/5'
                  : dangerous && a.color === 'amber' ? 'border-amber-500/30 bg-amber-500/5'
                  : ''
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <a.icon size={16} className={
                    dangerous && a.color === 'red' ? 'text-red-500'
                    : dangerous && a.color === 'amber' ? 'text-amber-500'
                    : 'text-slate-500'} />
                  <ArrowRight size={12} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{a.label}</p>
                <p className={`text-2xl font-black ${
                  dangerous && a.color === 'red' ? 'text-red-500'
                  : dangerous && a.color === 'amber' ? 'text-amber-500'
                  : 'text-[var(--text-main)]'}`}>{loading ? '…' : (a.value ?? 0)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* My tasks + Today's events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-base font-black text-[var(--text-main)] mb-4 flex items-center gap-2">
            <CheckSquare size={16} className="text-blue-500" />
            Việc cần làm (7 ngày tới)
          </h3>
          <div className="space-y-2">
            {loading && <p className="text-center py-6 text-slate-500 text-sm">Đang tải...</p>}
            {!loading && tasks.length === 0 && <p className="text-center py-6 text-slate-500 text-sm">🎉 Không có việc nào sắp đến hạn</p>}
            {tasks.map((t) => {
              const dueDate = new Date(t.dueAt);
              const days = Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000);
              return (
                <div key={t.id} className="flex items-start gap-3 py-2 border-b border-[var(--border-color)] last:border-0">
                  <div className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${days <= 0 ? 'bg-red-500' : days <= 1 ? 'bg-amber-500' : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-main)] truncate">{t.title ?? '(không tiêu đề)'}</p>
                    {t.description && <p className="text-[11px] text-slate-500 truncate">{t.description}</p>}
                  </div>
                  <span className={`text-[10px] font-bold shrink-0 ${days < 0 ? 'text-red-500' : days <= 1 ? 'text-amber-500' : 'text-slate-500'}`}>
                    {days < 0 ? `quá ${-days}d` : days === 0 ? 'hôm nay' : `${days}d nữa`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-base font-black text-[var(--text-main)] mb-4 flex items-center gap-2">
            <CalendarClock size={16} className="text-blue-500" />
            Hôm nay
          </h3>
          <div className="space-y-2">
            {loading && <p className="text-center py-6 text-slate-500 text-sm">Đang tải...</p>}
            {!loading && todayEvents.length === 0 && <p className="text-center py-6 text-slate-500 text-sm">Không có sự kiện</p>}
            {todayEvents.map((e, i) => {
              const ICON = e.kind === 'calendar' ? Calendar : e.kind === 'health' ? '🏥' : '🎓';
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (e.kind === 'calendar') navigate('/calendars');
                    else navigate(`/workers/${e.id}`);
                  }}
                  className="w-full text-left flex items-start gap-3 py-2 border-b border-[var(--border-color)] last:border-0 hover:bg-blue-500/5 -mx-2 px-2 rounded-lg"
                >
                  <span className="text-base mt-0.5">{typeof ICON === 'string' ? ICON : '📅'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-main)] truncate">{e.title}</p>
                    {e.sub && <p className="text-[11px] text-slate-500 truncate">{e.sub}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pipeline funnel — Linear style với conversion */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-[var(--text-main)] flex items-center gap-3">
            <TrendingUp className="text-blue-500" size={20} />
            Pipeline LĐ — Funnel W1 → W7
          </h3>
          <span className="text-xs text-slate-500">{funnelData.reduce((s, x) => s + x.count, 0)} LĐ trong pipeline</span>
        </div>
        <div className="space-y-2">
          {loading && <p className="text-center py-8 text-slate-500 text-sm">Đang tải...</p>}
          {!loading && funnelData.map((s, i) => {
            const prev = i > 0 ? funnelData[i - 1].count : null;
            const conv = prev != null && prev > 0 ? Math.round((s.count / prev) * 100) : null;
            return (
              <div key={s.code} className="flex items-center gap-3">
                <div className="w-24 text-xs font-bold text-slate-500">{s.label}</div>
                <div className="flex-1 h-9 bg-black/5 dark:bg-white/5 rounded-lg overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${s.pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.05 }}
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-end pr-3"
                  >
                    <span className="text-white text-xs font-bold">{s.sharePct > 5 ? `${s.sharePct}%` : ''}</span>
                  </motion.div>
                </div>
                <div className="w-16 text-right text-sm font-bold text-[var(--text-main)]">{s.count}</div>
                {conv != null && <div className="w-14 text-right text-[10px] text-slate-500">{conv}% →</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Market donut + Top partners */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 glass-card p-6">
          <h3 className="text-base font-black text-[var(--text-main)] mb-4 flex items-center gap-2">
            <Globe className="text-blue-500" size={16} /> Thị trường
          </h3>
          {loading || marketData.length === 0 ? <p className="text-center py-8 text-slate-500 text-sm">{loading ? 'Đang tải...' : 'Chưa có'}</p> : (
            <div className="flex items-center gap-4">
              <Donut data={marketData} size={130} />
              <div className="flex-1 space-y-1.5">
                {marketData.map((m) => (
                  <div key={m.code} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                    <span className="flex-1 text-[var(--text-main)] truncate">{m.label}</span>
                    <span className="text-slate-500 font-mono shrink-0">{m.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 glass-card p-6">
          <h3 className="text-base font-black text-[var(--text-main)] mb-4 flex items-center gap-2">
            <Award className="text-blue-500" size={16} /> Top 5 đối tác theo số đơn
          </h3>
          {loading || topPartners.length === 0 ? <p className="text-center py-8 text-slate-500 text-sm">{loading ? 'Đang tải...' : 'Chưa có'}</p> : (
            <div className="space-y-3">
              {topPartners.map((p, i) => (
                <button key={p.id} onClick={() => navigate(`/partners/${p.id}`)} className="w-full flex items-center gap-3 hover:bg-blue-500/5 -mx-2 px-2 py-1 rounded-lg transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <span className="font-semibold text-[var(--text-main)] truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-500 uppercase shrink-0">{p.country}</span>
                    </div>
                    <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${p.pct}%` }} transition={{ duration: 0.8 }} className="h-full bg-gradient-to-r from-blue-500 to-cyan-500" />
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[var(--text-main)] w-12 text-right shrink-0">{p.count}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity stream */}
      <div className="glass-card p-6">
        <h3 className="text-base font-black text-[var(--text-main)] mb-4 flex items-center gap-2">
          <Activity size={16} className="text-blue-500" /> Hoạt động gần đây
        </h3>
        <div className="space-y-2">
          {loading && <p className="text-center py-6 text-slate-500 text-sm">Đang tải...</p>}
          {!loading && recent.length === 0 && <p className="text-center py-6 text-slate-500 text-sm">Chưa có hoạt động</p>}
          {!loading && recent.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                if (r.kind === 'worker') navigate(`/workers/${r.id}`);
                else if (r.kind === 'doc') navigate(`/official-documents/${r.id}`);
                else if (r.kind === 'reminder') navigate(`/reminders/${r.id}`);
              }}
              className="w-full text-left flex items-start gap-3 py-2 border-b border-[var(--border-color)] last:border-0 hover:bg-blue-500/5 -mx-2 px-2 rounded-lg"
            >
              <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 ${
                r.color === 'cyan' ? 'bg-cyan-500/10 text-cyan-500'
                : r.color === 'purple' ? 'bg-purple-500/10 text-purple-500'
                : 'bg-amber-500/10 text-amber-500'
              }`}><r.icon size={13} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-main)] truncate">{r.title}</p>
                <p className="text-[11px] text-slate-500 truncate">{r.sub}</p>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0">{fmtDate(r.at)}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* Donut chart */
function Donut({ data, size = 130 }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR * 0.6;
  let acc = 0;
  const arcs = data.map((d, i) => {
    const sA = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += d.count;
    const eA = (acc / total) * Math.PI * 2 - Math.PI / 2;
    return { d, path: arcPath(cx, cy, outerR, innerR, sA, eA), key: i };
  });
  return (
    <svg width={size} height={size} className="shrink-0">
      {arcs.map((a) => <path key={a.key} d={a.path} fill={a.d.color} />)}
      <circle cx={cx} cy={cy} r={innerR} fill="var(--sidebar-bg)" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="18" fontWeight="900" fill="currentColor">{total}</text>
    </svg>
  );
}
function arcPath(cx, cy, rO, rI, sA, eA) {
  const x1 = cx + rO * Math.cos(sA), y1 = cy + rO * Math.sin(sA);
  const x2 = cx + rO * Math.cos(eA), y2 = cy + rO * Math.sin(eA);
  const x3 = cx + rI * Math.cos(eA), y3 = cy + rI * Math.sin(eA);
  const x4 = cx + rI * Math.cos(sA), y4 = cy + rI * Math.sin(sA);
  const la = (eA - sA) > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${rO} ${rO} 0 ${la} 1 ${x2} ${y2} L ${x3} ${y3} A ${rI} ${rI} 0 ${la} 0 ${x4} ${y4} Z`;
}
