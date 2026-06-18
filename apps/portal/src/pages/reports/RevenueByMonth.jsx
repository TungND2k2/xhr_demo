import React, { useEffect, useMemo, useState } from 'react';
import { Download, Printer, DollarSign } from 'lucide-react';
import { listDocs } from '../../api/payload';
import { exportXlsx, printPdf } from '../../lib/export';

const MONTHS_BACK = 12;

export default function ReportRevenueByMonth() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - MONTHS_BACK);
      const r = await listDocs('contracts', {
        where: { signingDate: { greater_than_equal: since.toISOString() } },
        limit: 1000, depth: 0, sort: 'signingDate',
      });
      const months = new Map();
      // Khởi tạo MONTHS_BACK tháng
      const now = new Date();
      for (let i = MONTHS_BACK - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.set(key, { key, label: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, revenue: 0, count: 0 });
      }
      let tot = 0;
      for (const c of r.docs ?? []) {
        if (!c.signingDate) continue;
        const d = new Date(c.signingDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const m = months.get(key);
        if (!m) continue;
        const fee = Number(c.serviceFee ?? 0);
        m.revenue += fee;
        m.count += 1;
        tot += fee;
      }
      setRows([...months.values()]);
      setTotal(tot);
      setLoading(false);
    })();
  }, []);

  const maxR = useMemo(() => Math.max(...rows.map((r) => r.revenue), 1), [rows]);

  const handleExport = () => exportXlsx(
    rows.map((r) => ({ Tháng: r.label, 'Số HĐ ký': r.count, 'Doanh thu (VND)': r.revenue })),
    `doanh-thu-${new Date().toISOString().slice(0, 10)}.xlsx`,
    'Doanh thu',
  );

  return (
    <div className="space-y-6 print-area">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
            <DollarSign className="text-green-500" size={22} />Doanh thu phí dịch vụ theo tháng
          </h2>
          <p className="text-sm text-[var(--text-muted)]">12 tháng gần nhất · Tổng: <b className="text-[var(--text-main)]">{total.toLocaleString()} VND</b></p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5"><Download size={14} /> Excel</button>
          <button onClick={printPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5"><Printer size={14} /> PDF</button>
        </div>
      </div>

      {/* Bar chart */}
      <div className="glass-card p-6">
        {loading ? <p className="text-center py-12 text-slate-500">Đang tính...</p> : (
          <div className="space-y-2">
            {rows.map((r) => {
              const pct = Math.round((r.revenue / maxR) * 100);
              return (
                <div key={r.key} className="flex items-center gap-3">
                  <div className="w-16 text-xs font-bold text-slate-500">{r.label}</div>
                  <div className="flex-1 h-7 bg-black/5 dark:bg-white/5 rounded-lg overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-end pr-2 transition-all" style={{ width: `${pct}%` }}>
                      {pct > 10 && <span className="text-white text-[10px] font-bold">{r.revenue.toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="w-12 text-right text-xs text-slate-500 font-mono">{r.count} HĐ</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-black/[0.02]">
            <tr><th className="px-4 py-3 text-left">Tháng</th><th className="px-4 py-3 text-right">Số HĐ ký</th><th className="px-4 py-3 text-right">Doanh thu (VND)</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-[var(--border-color)]">
                <td className="px-4 py-2 font-semibold">{r.label}</td>
                <td className="px-4 py-2 text-right font-mono">{r.count}</td>
                <td className="px-4 py-2 text-right font-mono">{r.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
