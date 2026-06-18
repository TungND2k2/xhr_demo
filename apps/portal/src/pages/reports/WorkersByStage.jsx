import React, { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { countDocs } from '../../api/payload';
import { WORKER_STATUS_LABELS } from '../../lib/workers-labels';
import { exportXlsx, printPdf } from '../../lib/export';

const STAGES = Object.keys(WORKER_STATUS_LABELS);

const COLORS = [
  '#3b82f6', '#06b6d4', '#10b981', '#14b8a6', '#84cc16',
  '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7',
  '#8b5cf6', '#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#64748b',
];

export default function ReportWorkersByStage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const counts = await Promise.all(
        STAGES.map((s) => countDocs('workers', { status: { equals: s } })),
      );
      const t = counts.reduce((acc, c) => acc + (c ?? 0), 0);
      setTotal(t);
      setRows(
        STAGES.map((code, i) => ({
          code,
          label: WORKER_STATUS_LABELS[code],
          count: counts[i] ?? 0,
          pct: t > 0 ? Math.round(((counts[i] ?? 0) / t) * 1000) / 10 : 0,
          color: COLORS[i % COLORS.length],
        })),
      );
      setLoading(false);
    })();
  }, []);

  const handleExport = () =>
    exportXlsx(
      rows.map((r) => ({
        'Trạng thái': r.label,
        'Số LĐ': r.count,
        'Tỷ lệ (%)': r.pct,
      })),
      `bao-cao-ld-theo-w1-w8-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'LĐ theo W1-W8',
    );

  return (
    <div className="space-y-6 print-area">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)]">LĐ theo W1 → W8</h2>
          <p className="text-sm text-[var(--text-muted)]">Tổng: {total} LĐ</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
            <Download size={14} /> Excel
          </button>
          <button onClick={printPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
            <Printer size={14} /> PDF
          </button>
        </div>
      </div>

      <div className="glass-card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-black/[0.02] dark:bg-white/[0.02]">
            <tr>
              <th className="px-4 py-3 text-left">Trạng thái</th>
              <th className="px-4 py-3 text-right">Số LĐ</th>
              <th className="px-4 py-3 text-left w-[40%]">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-slate-500">Đang tổng hợp...</td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.code} className="border-t border-[var(--border-color)]">
                <td className="px-4 py-3 font-semibold">{r.label}</td>
                <td className="px-4 py-3 text-right font-mono">{r.count}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                    </div>
                    <span className="text-xs font-bold w-12 text-right text-slate-500">{r.pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
