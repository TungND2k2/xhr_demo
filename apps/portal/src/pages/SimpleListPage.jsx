import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Printer, Search, X } from 'lucide-react';
import { listDocs } from '../api/payload';
import { exportXlsx, printPdf } from '../lib/export';
import useBulkSelection from '../hooks/useBulkSelection';
import BulkActionBar from '../components/BulkActionBar';

/**
 * SimpleListPage — generic table page cho 1 collection Payload.
 *
 * Props:
 *  - title
 *  - subtitle
 *  - collection (slug Payload, vd "official-documents")
 *  - columns: [{ key, label, render?, exportValue? }]
 *  - emptyMessage
 *  - sort (vd "-updatedAt")
 *  - depth
 *  - headerActions: React node (eg "Tạo mới" button)
 *  - reloadKey: change to force reload
 *  - entityLabel: vd "đơn", "đối tác" (default "bản ghi") — show in bulk bar
 */
export default function SimpleListPage({
  title,
  subtitle,
  collection,
  columns,
  emptyMessage = 'Chưa có dữ liệu',
  sort = '-updatedAt',
  depth = 1,
  onSelect,
  headerActions,
  reloadKey,
  entityLabel = 'bản ghi',
  searchKeys = [],   // e.g. ['name','code'] — fields to search via API 'like'
}) {
  const [data, setData] = useState({ docs: [], totalDocs: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [internalReload, setInternalReload] = useState(0);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const debounceRef = useRef(null);
  const sel = useBulkSelection();

  // Debounce search input 350ms
  const handleSearch = (val) => {
    setQ(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(val);
      setPage(1);
    }, 350);
  };

  useEffect(() => { sel.clear(); }, [page, collection, reloadKey, internalReload, debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const where = {};
    if (debouncedQ.trim() && searchKeys.length > 0) {
      where.or = searchKeys.map((k) => ({ [k]: { like: debouncedQ.trim() } }));
    }
    listDocs(collection, { limit: 50, page, sort, depth, where: Object.keys(where).length ? where : undefined }).then((d) => {
      if (cancel) return;
      setData(d);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [collection, page, sort, depth, reloadKey, internalReload, debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = () => {
    const rows = data.docs.map((d) => {
      const row = {};
      for (const c of columns) {
        const val = c.exportValue ? c.exportValue(d) : d[c.key];
        row[c.label] = val ?? '';
      }
      return row;
    });
    exportXlsx(rows, `${collection}-${new Date().toISOString().slice(0, 10)}.xlsx`, title.slice(0, 31));
  };

  const totalCols = columns.length + 1; // + checkbox col

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 print-area">
      {/* Header row */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-[var(--text-muted)] font-medium mt-0.5">{subtitle}</p>}
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-semibold">{data.totalDocs} bản ghi</p>
        </div>
        <div className="flex flex-wrap gap-2 no-print items-center">
          {/* Search bar */}
          {searchKeys.length > 0 && (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Tìm kiếm..."
                className="pl-8 pr-8 py-2 text-xs rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-main)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 w-48 transition-all"
              />
              {q && (
                <button onClick={() => handleSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={12} />
                </button>
              )}
            </div>
          )}
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border-color)] hover:border-green-500/30 hover:bg-green-500/5 text-slate-600 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 transition-all duration-200 shadow-sm">
            <Download size={14} className="text-green-500" /> Excel
          </button>
          <button onClick={printPdf} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border-color)] hover:border-red-500/30 hover:bg-red-500/5 text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 shadow-sm">
            <Printer size={14} className="text-red-500" /> PDF
          </button>
          {headerActions}
        </div>
      </div>

      <BulkActionBar
        count={sel.count}
        selectedIds={[...sel.selected]}
        collection={collection}
        entityLabel={entityLabel}
        onClear={sel.clear}
        onDeleted={() => { sel.clear(); setInternalReload((k) => k + 1); }}
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
                {columns.map((c) => (
                  <th key={c.key} className={`${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  <td className="no-print"><div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700 mx-auto" /></td>
                  {columns.map((c) => (
                    <td key={c.key}><div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700" style={{ width: `${40 + Math.random() * 40}%` }} /></td>
                  ))}
                </tr>
              ))}
              {!loading && data.docs.length === 0 && (
                <tr><td colSpan={totalCols}>
                  <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
                    <Search size={32} className="opacity-20" />
                    <p className="text-sm font-medium">{q ? `Không tìm thấy kết quả cho "${q}"` : emptyMessage}</p>
                    {q && <button onClick={() => handleSearch('')} className="text-xs text-blue-500 hover:underline">Xoá bộ lọc</button>}
                  </div>
                </td></tr>
              )}
              {!loading && data.docs.map((d) => (
                <tr
                  key={d.id}
                  onClick={onSelect ? () => onSelect(d.id) : undefined}
                  className={`${onSelect ? 'cursor-pointer' : ''} ${sel.has(d.id) ? 'bg-blue-500/[0.04] dark:bg-cyan-500/[0.02]' : ''}`}
                >
                  <td className="no-print text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={sel.has(d.id)}
                      onChange={() => sel.toggle(d.id)}
                      className="rounded-md border-[var(--border-color)] text-blue-500 focus:ring-blue-500/30 cursor-pointer w-4 h-4 transition-all"
                    />
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className={`${c.align === 'right' ? 'text-right' : 'text-left'} text-xs font-medium`}>
                      {c.render ? c.render(d) : (d[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs no-print">
          <span className="text-slate-500 font-medium">Tổng: <b>{data.totalDocs}</b> · Trang {page}/{data.totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] disabled:opacity-30 hover:bg-blue-500/5 hover:border-blue-500/30 transition-all font-bold"
            >←</button>
            {Array.from({ length: Math.min(data.totalPages, 7) }, (_, i) => {
              // Show pages around current
              const total = data.totalPages;
              let pages = [];
              if (total <= 7) { pages = Array.from({ length: total }, (_, j) => j + 1); }
              else if (page <= 4) { pages = [1,2,3,4,5,'...',total]; }
              else if (page >= total - 3) { pages = [1,'...',total-4,total-3,total-2,total-1,total]; }
              else { pages = [1,'...',page-1,page,page+1,'...',total]; }
              const p = pages[i];
              if (p === '...') return <span key={`el-${i}`} className="px-1 text-slate-400">…</span>;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg border text-xs font-bold transition-all ${
                    p === page
                      ? 'bg-blue-500 border-blue-500 text-white shadow-sm shadow-blue-500/30'
                      : 'border-[var(--border-color)] hover:bg-blue-500/5 hover:border-blue-500/30 text-[var(--text-main)]'
                  }`}
                >{p}</button>
              );
            })}
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] disabled:opacity-30 hover:bg-blue-500/5 hover:border-blue-500/30 transition-all font-bold"
            >→</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
