import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Printer, Search as SearchIcon, Plus, X,
  Copy, Check, ExternalLink, Loader2, Link as LinkIcon,
  User, Phone, Globe, AlertCircle,
} from 'lucide-react';
import FilterPanel from '../components/FilterPanel';
import { listDocs, createDoc } from '../api/payload';
import useBulkSelection from '../hooks/useBulkSelection';
import BulkActionBar from '../components/BulkActionBar';
import {
  WORKER_STATUS_LABELS,
  MARKET_LABELS,
  fmtVND,
  fmtDate,
} from '../lib/workers-labels';
import { exportXlsx, printPdf } from '../lib/export';

/* ─── Config ─── */
const DEFAULT_FORM_ID = '6a13bb33ce3bccf8c6866ada'; // "Sơ yếu lý lịch thực tập sinh"
const FORM_BASE_URL   = `${window.location.origin}/forms`;

/* ─── CreateWorkerModal ─── */
function CreateWorkerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: '', phone: '', market: 'jp', dob: '', gender: 'male' });
  const [step, setStep] = useState('form'); // 'form' | 'creating' | 'done' | 'error'
  const [result, setResult] = useState(null); // { worker, invite, formLink }
  const [copied, setCopied]   = useState(false);
  const [err, setErr]         = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.fullName.trim()) { setErr('Vui lòng nhập họ tên.'); return; }
    setErr('');
    setStep('creating');
    try {
      // 1. Tạo Worker (draft)
      const worker = await createDoc('workers', {
        fullName: form.fullName.trim(),
        phone:    form.phone.trim() || undefined,
        market:   form.market,
        status:   'researching',
        ...(form.dob    ? { dob: form.dob }       : {}),
        ...(form.gender ? { gender: form.gender } : {}),
      });


      // 2. Tạo FormInvite → token auto-gen bởi CMS hook
      const invite = await createDoc('form-invites', {
        form:   DEFAULT_FORM_ID,
        worker: worker.id,
        prefillData: [
          ...(form.fullName ? [{ field: 'fullName', value: form.fullName.trim() }] : []),
          ...(form.phone    ? [{ field: 'phone',    value: form.phone.trim() }]    : []),
        ],
      });

      const formLink = `${FORM_BASE_URL}/${invite.token}`;
      setResult({ worker, invite, formLink });
      setStep('done');
      onCreated?.();
    } catch (e) {
      setErr(e.message ?? 'Lỗi không xác định.');
      setStep('form');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(result.formLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget && step !== 'creating') onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1,    opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-[var(--card-bg)] rounded-2xl shadow-2xl border border-[var(--border-color)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <User size={16} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[var(--text-main)]">Tạo lao động mới</h3>
                <p className="text-[10px] text-slate-500">Tạo hồ sơ + sinh link mời điền form</p>
              </div>
            </div>
            {step !== 'creating' && (
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-slate-400 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="p-6">
            {/* STEP: form */}
            {step === 'form' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <User size={11} /> Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={form.fullName}
                    onChange={(e) => set('fullName', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--sidebar-bg)] text-sm text-[var(--text-main)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Phone size={11} /> Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    placeholder="0912 345 678"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--sidebar-bg)] text-sm text-[var(--text-main)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                  />
                </div>

                {/* dob + gender side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Ngày sinh
                    </label>
                    <input
                      type="date"
                      value={form.dob}
                      onChange={(e) => set('dob', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--sidebar-bg)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                      Giới tính
                    </label>
                    <select
                      value={form.gender}
                      onChange={(e) => set('gender', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--sidebar-bg)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Globe size={11} /> Thị trường
                  </label>
                  <select
                    value={form.market}
                    onChange={(e) => set('market', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--sidebar-bg)] text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  >
                    {Object.entries(MARKET_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                {err && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
                    <AlertCircle size={13} /> {err}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[var(--border-color)] text-sm font-bold text-slate-500 hover:bg-black/5 transition-all">
                    Huỷ
                  </button>
                  <button
                    onClick={handleCreate}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
                  >
                    Tạo + Sinh link
                  </button>
                </div>
              </div>
            )}

            {/* STEP: creating */}
            {step === 'creating' && (
              <div className="py-8 flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                  <Loader2 size={28} className="text-white animate-spin" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-[var(--text-main)]">Đang tạo hồ sơ...</p>
                  <p className="text-xs text-slate-500 mt-1">Tạo Worker + sinh link form mời điền</p>
                </div>
              </div>
            )}

            {/* STEP: done */}
            {step === 'done' && result && (
              <div className="space-y-4">
                {/* Worker info */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow shadow-green-500/20">
                    <Check size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-green-700 dark:text-green-400">{result.worker.fullName}</p>
                    <p className="text-[10px] text-green-600 dark:text-green-500 font-mono">
                      {result.worker.workerCode ?? result.worker.id.slice(-8)}
                      {result.worker.phone ? ` · ${result.worker.phone}` : ''}
                    </p>
                  </div>
                </div>

                {/* Form link */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <LinkIcon size={11} /> Link mời điền form
                  </p>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--sidebar-bg)] border border-[var(--border-color)] group">
                    <p className="flex-1 text-xs font-mono text-blue-600 dark:text-blue-400 truncate select-all">
                      {result.formLink}
                    </p>
                    <button
                      onClick={copyLink}
                      className={`shrink-0 p-1.5 rounded-lg transition-all ${copied ? 'bg-green-500/20 text-green-600' : 'hover:bg-blue-500/10 text-slate-400 hover:text-blue-500'}`}
                      title="Copy link"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <a
                      href={result.formLink}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-500 transition-all"
                      title="Mở link"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Link có hiệu lực 7 ngày. Gửi cho lao động qua Telegram, Zalo hoặc SMS.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={copyLink}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                      copied
                        ? 'border-green-500/40 bg-green-500/10 text-green-600'
                        : 'border-[var(--border-color)] text-slate-500 hover:border-blue-500/30 hover:bg-blue-500/5 hover:text-blue-600'
                    }`}
                  >
                    {copied ? <><Check size={14} /> Đã copy!</> : <><Copy size={14} /> Copy link</>}
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 transition-all"
                  >
                    Xong
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


export default function Workers({ onSelect }) {
  const [filters, setFilters] = useState({});
  const [q, setQ] = useState('');
  const [data, setData] = useState({ docs: [], totalDocs: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const sel = useBulkSelection();


  // Helper functions for redesigned status badges
  const getStatusBadge = (status) => {
    const label = WORKER_STATUS_LABELS[status] ?? status ?? '—';
    if (['researching', 'agreed'].includes(status)) return <span className="badge-blue">{label}</span>;
    if (['health_check', 'training'].includes(status)) return <span className="badge-cyan">{label}</span>;
    if (['deposit_paid', 'contracted'].includes(status)) return <span className="badge-green">{label}</span>;
    if (['passed', 'visa_prep'].includes(status)) return <span className="badge-purple">{label}</span>;
    if (status === 'deployed') return <span className="badge-green">{label}</span>;
    return <span className="badge-slate">{label}</span>;
  };

  const getMarketBadge = (market) => {
    const label = MARKET_LABELS[market] ?? market ?? '—';
    if (market === 'jp') return <span className="badge-red">{label}</span>;
    if (market === 'kr') return <span className="badge-blue">{label}</span>;
    if (market === 'tw') return <span className="badge-green">{label}</span>;
    return <span className="badge-slate">{label}</span>;
  };

  useEffect(() => { sel.clear(); }, [page, q, filters, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const where = {};
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.market?.length) where.market = { in: filters.market };
    if (filters.deposit?.includes('paid')) where.depositAmount = { greater_than: 0 };
    if (filters.deposit?.includes('unpaid'))
      where.depositAmount = { ...(where.depositAmount ?? {}), exists: false };

    const params = { where, limit: 25, page, depth: 0, sort: '-updatedAt' };
    if (q.trim()) where.or = [{ fullName: { like: q } }, { workerCode: { like: q } }, { phone: { like: q } }];

    listDocs('workers', params).then((d) => {
      if (cancel) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [filters, page, q, reloadKey]);

  const filterSections = useMemo(
    () => [
      {
        key: 'market',
        label: 'Thị trường',
        options: Object.entries(MARKET_LABELS).map(([value, label]) => ({ value, label })),
      },
      {
        key: 'status',
        label: 'Trạng thái',
        options: Object.entries(WORKER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
      },
      {
        key: 'deposit',
        label: 'Đặt cọc',
        options: [
          { value: 'paid', label: 'Đã nộp cọc' },
          { value: 'unpaid', label: 'Chưa nộp' },
        ],
      },
    ],
    [],
  );

  const handleExport = () => {
    const rows = data.docs.map((w) => ({
      'Mã LĐ': w.workerCode ?? '',
      'Họ tên': w.fullName ?? '',
      'Thị trường': MARKET_LABELS[w.market] ?? '',
      'Trạng thái': WORKER_STATUS_LABELS[w.status] ?? w.status ?? '',
      SĐT: w.phone ?? '',
      'Ngày sinh': w.dob ?? '',
      'Quê': w.hometown ?? '',
      'Tiền cọc (VND)': w.depositAmount ?? '',
      'Ngày nộp cọc': w.depositDate ?? '',
      'Lớp đào tạo': w.trainingGroup ?? '',
      'Cập nhật': w.updatedAt ?? '',
    }));
    exportXlsx(rows, `lao-dong-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Lao động');
  };

  return (<>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-6 print-area"
    >
      <div className="filter-panel-wrapper">
        <FilterPanel sections={filterSections} value={filters} onChange={(v) => { setFilters(v); setPage(1); }} />
      </div>

      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent tracking-tight">Lao động</h2>
            <p className="text-sm text-[var(--text-muted)] font-medium mt-0.5">
              {data.totalDocs} LĐ
              {Object.values(filters).some((v) => v?.length) || q ? ' (đã lọc)' : ' tổng cộng'}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="Tìm tên / mã / SĐT..."
                className="pl-9 pr-3 py-2 text-xs rounded-xl border border-[var(--border-color)] bg-[var(--sidebar-bg)] outline-none focus:ring-2 focus:ring-blue-500/20 w-56 hover:border-[var(--border-color)] transition-all"
              />
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border-color)] hover:border-green-500/30 hover:bg-green-500/5 text-slate-600 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 transition-all duration-200 shadow-sm"
            >
              <Download size={14} className="text-green-500" /> Excel
            </button>
            <button
              onClick={printPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border-color)] hover:border-red-500/30 hover:bg-red-500/5 text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 shadow-sm"
            >
              <Printer size={14} className="text-red-500" /> PDF
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              <Plus size={14} /> Tạo lao động
            </button>

          </div>
        </div>

        <BulkActionBar
          count={sel.count}
          selectedIds={[...sel.selected]}
          collection="workers"
          entityLabel="lao động"
          onClear={sel.clear}
          onDeleted={() => { sel.clear(); setReloadKey((k) => k + 1); }}
        />

        <div className="glass-card p-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="overflow-x-auto">
            <table className="portal-table">
              <thead>
                <tr>
                  <th className="w-12 no-print text-center">
                    <input
                      type="checkbox"
                      checked={data.docs.length > 0 && sel.isAllSelected(data.docs.map((d) => d.id))}
                      onChange={(e) => e.target.checked ? sel.setAll(data.docs.map((d) => d.id)) : sel.clear()}
                      className="rounded-md border-[var(--border-color)] text-blue-500 focus:ring-blue-500/30 cursor-pointer w-4 h-4 transition-all"
                    />
                  </th>
                  <th>Mã LĐ</th>
                  <th>Họ tên</th>
                  <th>Thị trường</th>
                  <th>Trạng thái</th>
                  <th>SĐT</th>
                  <th>Cọc</th>
                  <th>Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                )}
                {!loading && data.docs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Không có lao động phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
                {!loading && data.docs.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => onSelect?.(w.id)}
                    className={`cursor-pointer ${sel.has(w.id) ? 'bg-blue-500/[0.04] dark:bg-cyan-500/[0.02]' : ''}`}
                  >
                    <td className="no-print text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={sel.has(w.id)}
                        onChange={() => sel.toggle(w.id)}
                        className="rounded-md border-[var(--border-color)] text-blue-500 focus:ring-blue-500/30 cursor-pointer w-4 h-4 transition-all"
                      />
                    </td>
                    <td className="font-mono text-xs text-blue-500 font-semibold">{w.workerCode ?? '—'}</td>
                    <td className="text-xs font-bold">{w.fullName ?? '—'}</td>
                    <td>{getMarketBadge(w.market)}</td>
                    <td>{getStatusBadge(w.status)}</td>
                    <td className="text-xs font-semibold">{w.phone ?? '—'}</td>
                    <td className="text-xs font-semibold">{fmtVND(w.depositAmount)}</td>
                    <td className="text-xs text-slate-400 dark:text-slate-500 font-semibold">{fmtDate(w.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {data.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs no-print">
            <span className="text-slate-500">
              Trang {page}/{data.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--border-color)] disabled:opacity-30 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-slate-500 font-semibold"
              >
                ← Trước
              </button>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--border-color)] disabled:opacity-30 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-slate-500 font-semibold"
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>

    {/* Modal tạo lao động mới */}
    {showCreate && (
      <CreateWorkerModal
        onClose={() => setShowCreate(false)}
        onCreated={() => setReloadKey((k) => k + 1)}
      />
    )}
  </>);
}
