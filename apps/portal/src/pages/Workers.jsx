import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Printer, Search as SearchIcon } from 'lucide-react';
import FilterPanel from '../components/FilterPanel';
import { listDocs } from '../api/payload';
import useBulkSelection from '../hooks/useBulkSelection';
import BulkActionBar from '../components/BulkActionBar';
import {
  WORKER_STATUS_LABELS,
  MARKET_LABELS,
  fmtVND,
  fmtDate,
} from '../lib/workers-labels';
import { exportXlsx, printPdf } from '../lib/export';

export default function Workers({ onSelect }) {
  const [filters, setFilters] = useState({});
  const [q, setQ] = useState('');
  const [data, setData] = useState({ docs: [], totalDocs: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const sel = useBulkSelection();

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

  return (
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
            <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight">Lao động</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {data.totalDocs} LĐ
              {Object.values(filters).some((v) => v?.length) || q ? ' (đã lọc)' : ' tổng cộng'}
            </p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="Tìm tên / mã / SĐT..."
                className="pl-9 pr-3 py-2 text-xs rounded-xl border border-[var(--border-color)] bg-[var(--sidebar-bg)] outline-none focus:ring-2 focus:ring-blue-500/20 w-56"
              />
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all"
            >
              <Download size={14} /> Excel
            </button>
            <button
              onClick={printPdf}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all"
            >
              <Printer size={14} /> PDF
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

        <div className="glass-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-black/[0.02] dark:bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-left w-10 no-print">
                    <input
                      type="checkbox"
                      checked={data.docs.length > 0 && sel.isAllSelected(data.docs.map((d) => d.id))}
                      onChange={(e) => e.target.checked ? sel.setAll(data.docs.map((d) => d.id)) : sel.clear()}
                      className="rounded border-[var(--border-color)] accent-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Mã LĐ</th>
                  <th className="px-4 py-3 text-left">Họ tên</th>
                  <th className="px-4 py-3 text-left">Thị trường</th>
                  <th className="px-4 py-3 text-left">Trạng thái</th>
                  <th className="px-4 py-3 text-left">SĐT</th>
                  <th className="px-4 py-3 text-left">Cọc</th>
                  <th className="px-4 py-3 text-left">Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      Đang tải...
                    </td>
                  </tr>
                )}
                {!loading && data.docs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      Không có LĐ phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
                {!loading && data.docs.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => onSelect?.(w.id)}
                    className={`border-t border-[var(--border-color)] hover:bg-blue-500/5 cursor-pointer transition-colors ${sel.has(w.id) ? 'bg-blue-500/5' : ''}`}
                  >
                    <td className="px-4 py-3 no-print" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={sel.has(w.id)}
                        onChange={() => sel.toggle(w.id)}
                        className="rounded border-[var(--border-color)] accent-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-500">{w.workerCode ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{w.fullName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{MARKET_LABELS[w.market] ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{WORKER_STATUS_LABELS[w.status] ?? w.status ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{w.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{fmtVND(w.depositAmount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(w.updatedAt)}</td>
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
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] disabled:opacity-30"
              >
                ← Trước
              </button>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] disabled:opacity-30"
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
