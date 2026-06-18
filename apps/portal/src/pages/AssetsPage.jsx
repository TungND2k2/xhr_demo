import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Boxes, Wallet, Wrench, ShieldAlert,
  Download, Search, X, MapPin, User, Plus,
} from 'lucide-react';
import { listDocs, createDoc } from '../api/payload';
import { exportXlsx } from '../lib/export';
import { fmtVND, fmtDate } from '../lib/workers-labels';
import { CATEGORY_META, STATUS_META, TINT_CLASS, daysUntil, lineValue } from '../lib/assets-meta';
import FormModal from '../components/FormModal';
import BulkActionBar from '../components/BulkActionBar';
import useBulkSelection from '../hooks/useBulkSelection';

const CREATE_FIELDS = [
  { name: 'assetCode', label: 'Mã tài sản', type: 'text', required: true, width: 'third', placeholder: 'LT-001' },
  { name: 'name',      label: 'Tên tài sản', type: 'text', required: true, width: 'full',  placeholder: 'Macbook Pro 14 (chị Hương)' },
  { name: 'category',  label: 'Loại',        type: 'select', required: true, width: 'third',
    options: Object.entries(CATEGORY_META).map(([v, m]) => ({ value: v, label: m.label })) },
  { name: 'status',    label: 'Tình trạng',  type: 'select', required: true, width: 'third', defaultValue: 'in_use',
    options: Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label })) },
  { name: 'quantity',  label: 'Số lượng', type: 'number', width: 'third', defaultValue: 1 },
  { name: 'purchaseDate',  label: 'Ngày mua',         type: 'date',   width: 'third' },
  { name: 'purchaseValue', label: 'Đơn giá (VND)',    type: 'number', width: 'third', placeholder: '30000000' },
  { name: 'warrantyUntil', label: 'Bảo hành đến',     type: 'date',   width: 'third' },
  { name: 'serialNumber',  label: 'Serial / Số khung', type: 'text', width: 'half' },
  { name: 'location',      label: 'Vị trí',           type: 'text', width: 'half', placeholder: 'Tầng 3 phòng Đào tạo' },
  { name: 'notes',         label: 'Ghi chú',          type: 'textarea', width: 'full', rows: 2 },
];

export default function AssetsPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState(null); // null = all
  const [statusFilter, setStatusFilter] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const sel = useBulkSelection();

  useEffect(() => { sel.clear(); }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    listDocs('assets', { limit: 500, depth: 1, sort: '-purchaseDate' }).then((d) => {
      if (cancel) return;
      setAssets(d.docs ?? []);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [reloadKey]);

  const handleCreate = async (payload) => {
    const doc = await createDoc('assets', payload);
    setReloadKey((k) => k + 1);
    if (doc?.id) navigate(`/assets/${doc.id}`);
  };

  // KPIs
  const kpi = useMemo(() => {
    let total = 0, value = 0, brokenCnt = 0, warrantyNear = 0;
    for (const a of assets) {
      total += Number(a.quantity) || 1;
      value += lineValue(a);
      if (a.status === 'broken' || a.status === 'repairing') brokenCnt += 1;
      const d = daysUntil(a.warrantyUntil);
      if (d != null && d >= 0 && d <= 30) warrantyNear += 1;
    }
    return { total, value, brokenCnt, warrantyNear };
  }, [assets]);

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (catFilter && a.category !== catFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (q) {
        const hay = `${a.name ?? ''} ${a.assetCode ?? ''} ${a.serialNumber ?? ''} ${a.location ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [assets, search, catFilter, statusFilter]);

  // Group by category
  const grouped = useMemo(() => {
    const m = new Map();
    for (const a of filtered) {
      const k = a.category ?? 'other';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    }
    // Sort: categories with most items first
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  // Category counts (for filter chips)
  const catCounts = useMemo(() => {
    const m = new Map();
    for (const a of assets) {
      const k = a.category ?? 'other';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [assets]);

  const statusCounts = useMemo(() => {
    const m = new Map();
    for (const a of assets) {
      const k = a.status ?? 'in_use';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [assets]);

  const handleExport = () => {
    const rows = filtered.map((a) => ({
      'Mã TS': a.assetCode ?? '',
      'Tên': a.name ?? '',
      'Loại': CATEGORY_META[a.category]?.label ?? a.category ?? '',
      'Tình trạng': STATUS_META[a.status]?.label ?? a.status ?? '',
      'Số lượng': a.quantity ?? 1,
      'Giao cho': typeof a.assignedTo === 'object' ? (a.assignedTo?.fullName ?? '') : '',
      'Đơn giá (VND)': a.purchaseValue ?? '',
      'Tổng giá trị (VND)': lineValue(a),
      'Ngày mua': fmtDate(a.purchaseDate),
      'Bảo hành đến': fmtDate(a.warrantyUntil),
      'Vị trí': a.location ?? '',
      'Serial': a.serialNumber ?? '',
    }));
    exportXlsx(rows, `tai-san-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Tài sản');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 print-area">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight">Tài sản</h2>
          <p className="text-[var(--text-muted)] text-sm">Thiết bị, xe, máy móc — TLG quản lý nội bộ</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all disabled:opacity-40">
            <Download size={14} /> Xuất Excel ({filtered.length})
          </button>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all">
            <Plus size={14} /> Thêm tài sản
          </button>
        </div>
      </div>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm tài sản mới"
        subtitle="Mã + Tên + Loại là bắt buộc. Còn lại có thể bổ sung sau."
        fields={CREATE_FIELDS}
        submitLabel="Tạo tài sản"
        onSubmit={handleCreate}
      />

      <BulkActionBar
        count={sel.count}
        selectedIds={[...sel.selected]}
        collection="assets"
        entityLabel="tài sản"
        onClear={sel.clear}
        onDeleted={() => { sel.clear(); setReloadKey((k) => k + 1); }}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Tổng tài sản" value={loading ? '…' : kpi.total} icon={Boxes} tint="blue" />
        <KpiCard label="Tổng giá trị" value={loading ? '…' : fmtVND(kpi.value)} icon={Wallet} tint="green" />
        <KpiCard label="Đang hỏng / sửa" value={loading ? '…' : kpi.brokenCnt} icon={Wrench} tint={kpi.brokenCnt > 0 ? 'amber' : 'slate'} />
        <KpiCard label="Sắp hết BH (<30 ngày)" value={loading ? '…' : kpi.warrantyNear} icon={ShieldAlert} tint={kpi.warrantyNear > 0 ? 'red' : 'slate'} />
      </div>

      {/* Filter bar */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã, tên, serial, vị trí..."
              className="w-full bg-transparent border border-[var(--border-color)] rounded-xl py-2 pl-9 pr-3 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none text-[var(--text-main)]"
            />
          </div>
          {(catFilter || statusFilter || search) && (
            <button onClick={() => { setCatFilter(null); setStatusFilter(null); setSearch(''); }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--border-color)] text-slate-500 hover:text-[var(--text-main)]">
              <X size={11} /> Xoá lọc
            </button>
          )}
          <span className="text-[11px] text-slate-500 ml-auto">{filtered.length}/{assets.length} TS</span>
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={catFilter === null} onClick={() => setCatFilter(null)} label="Tất cả loại" count={assets.length} />
          {Object.entries(CATEGORY_META).map(([k, m]) => {
            const c = catCounts.get(k) ?? 0;
            if (c === 0) return null;
            return (
              <FilterChip key={k} active={catFilter === k} onClick={() => setCatFilter(catFilter === k ? null : k)}
                label={m.label} count={c} icon={m.icon} tint={m.tint} />
            );
          })}
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={statusFilter === null} onClick={() => setStatusFilter(null)} label="Mọi trạng thái" count={assets.length} />
          {Object.entries(STATUS_META).map(([k, m]) => {
            const c = statusCounts.get(k) ?? 0;
            if (c === 0) return null;
            return (
              <button
                key={k}
                onClick={() => setStatusFilter(statusFilter === k ? null : k)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                  statusFilter === k ? m.chip : 'border-[var(--border-color)] text-slate-500 hover:text-[var(--text-main)]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                {m.label}
                <span className="opacity-60">{c}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grouped grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Đang tải...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">Không có tài sản khớp bộ lọc</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, items]) => {
            const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
            const Icon = meta.icon;
            return (
              <section key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-1.5 rounded-lg ${TINT_CLASS[meta.tint]}`}><Icon size={14} /></div>
                  <h3 className="text-sm font-black text-[var(--text-main)] uppercase tracking-wider">{meta.label}</h3>
                  <span className="text-[11px] text-slate-500">{items.length} tài sản</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {items.map((a) => (
                    <AssetCard
                      key={a.id}
                      a={a}
                      selected={sel.has(a.id)}
                      onToggle={() => sel.toggle(a.id)}
                      onClick={() => navigate(`/assets/${a.id}`)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function KpiCard({ label, value, icon: Icon, tint }) {
  return (
    <div className="glass-card p-5">
      <div className={`p-2.5 rounded-xl inline-flex mb-4 ${TINT_CLASS[tint]}`}>
        <Icon size={18} />
      </div>
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">{label}</p>
      <h3 className="text-3xl font-black text-[var(--text-main)]">{value ?? '—'}</h3>
    </div>
  );
}

function FilterChip({ active, onClick, label, count, icon: Icon, tint }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
        active
          ? `${tint ? TINT_CLASS[tint] : 'bg-blue-500/10 text-blue-500'} border-current`
          : 'border-[var(--border-color)] text-slate-500 hover:text-[var(--text-main)]'
      }`}
    >
      {Icon && <Icon size={11} />}
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  );
}

function AssetCard({ a, onClick, selected, onToggle }) {
  const meta = CATEGORY_META[a.category] ?? CATEGORY_META.other;
  const status = STATUS_META[a.status] ?? STATUS_META.in_use;
  const Icon = meta.icon;
  const assignedName = typeof a.assignedTo === 'object' ? a.assignedTo?.fullName : null;
  const warrantyDays = daysUntil(a.warrantyUntil);
  const warrantyExpiringSoon = warrantyDays != null && warrantyDays >= 0 && warrantyDays <= 30;

  return (
    <div
      onClick={onClick}
      className={`relative glass-card p-4 text-left hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group cursor-pointer ${selected ? 'ring-2 ring-blue-500/40 bg-blue-500/5' : ''}`}
    >
      <label
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 z-10 cursor-pointer opacity-60 group-hover:opacity-100 transition-opacity"
      >
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={onToggle}
          className="rounded border-[var(--border-color)] accent-blue-500 cursor-pointer w-4 h-4"
        />
      </label>
      <div className="flex items-start gap-3 mb-2">
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${TINT_CLASS[meta.tint]}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-[10px] text-blue-500 font-bold">{a.assetCode ?? '—'}</span>
            {Number(a.quantity) > 1 && (
              <span className="text-[10px] font-bold text-slate-500">×{a.quantity}</span>
            )}
          </div>
          <p className="text-sm font-bold text-[var(--text-main)] truncate group-hover:text-blue-500 transition-colors">
            {a.name ?? '—'}
          </p>
        </div>
      </div>

      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.chip} mb-2`}>
        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
        {status.label}
      </div>

      <div className="space-y-1 text-[11px] text-slate-500">
        {assignedName && (
          <div className="flex items-center gap-1.5 truncate">
            <User size={11} className="shrink-0" />
            <span className="truncate text-[var(--text-main)]">{assignedName}</span>
          </div>
        )}
        {a.location && (
          <div className="flex items-center gap-1.5 truncate">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{a.location}</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{fmtDate(a.purchaseDate)}</span>
        <span className="font-bold text-[var(--text-main)]">{fmtVND(lineValue(a))}</span>
      </div>

      {warrantyExpiringSoon && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-500 font-semibold">
          <ShieldAlert size={11} />
          BH còn {warrantyDays}d
        </div>
      )}
    </div>
  );
}
