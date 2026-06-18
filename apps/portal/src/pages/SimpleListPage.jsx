import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Printer } from 'lucide-react';
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
}) {
  const [data, setData] = useState({ docs: [], totalDocs: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [internalReload, setInternalReload] = useState(0);
  const sel = useBulkSelection();

  useEffect(() => { sel.clear(); }, [page, collection, reloadKey, internalReload]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    listDocs(collection, { limit: 50, page, sort, depth }).then((d) => {
      if (cancel) return;
      setData(d);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [collection, page, sort, depth, reloadKey, internalReload]);

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>}
          <p className="text-xs text-slate-500 mt-1">{data.totalDocs} bản ghi</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
            <Download size={14} /> Excel
          </button>
          <button onClick={printPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
            <Printer size={14} /> PDF
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
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={totalCols} className="px-4 py-12 text-center text-slate-500">Đang tải...</td></tr>}
              {!loading && data.docs.length === 0 && <tr><td colSpan={totalCols} className="px-4 py-12 text-center text-slate-500">{emptyMessage}</td></tr>}
              {!loading && data.docs.map((d) => (
                <tr
                  key={d.id}
                  onClick={onSelect ? () => onSelect(d.id) : undefined}
                  className={`border-t border-[var(--border-color)] transition-colors ${onSelect ? 'hover:bg-blue-500/5 cursor-pointer' : ''} ${sel.has(d.id) ? 'bg-blue-500/5' : ''}`}
                >
                  <td className="px-4 py-3 no-print" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={sel.has(d.id)}
                      onChange={() => sel.toggle(d.id)}
                      className="rounded border-[var(--border-color)] accent-blue-500 cursor-pointer"
                    />
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : 'text-left'} text-xs`}>
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
          <span className="text-slate-500">Trang {page}/{data.totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] disabled:opacity-30">← Trước</button>
            <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] disabled:opacity-30">Sau →</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
