import React, { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { listDocs } from '../../api/payload';
import { ORDER_STAGE_LABELS, fmtDate } from '../../lib/workers-labels';
import { exportXlsx, printPdf } from '../../lib/export';

export default function ReportOrdersExpiring() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 30);
      const horizonStr = horizon.toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      const r = await listDocs('orders', {
        where: {
          and: [
            { deadline: { less_than_equal: horizonStr } },
            { deadline: { greater_than_equal: today } },
            { status: { in: 'w1,w2,w3,w4,w5,w6,w7' } },
          ],
        },
        limit: 100,
        depth: 1,
        sort: 'deadline',
      });
      setRows(r.docs ?? []);
      setLoading(false);
    })();
  }, []);

  const daysLeft = (d) => {
    if (!d) return null;
    const diff = (new Date(d).getTime() - Date.now()) / 86_400_000;
    return Math.ceil(diff);
  };

  const handleExport = () =>
    exportXlsx(
      rows.map((o) => ({
        'Mã đơn': o.orderCode ?? '',
        'Đối tác': typeof o.partner === 'object' ? o.partner?.name : '',
        'Employer': o.employer ?? '',
        'Vị trí': o.position ?? '',
        'Số LĐ cần': o.quantityNeeded ?? '',
        'Deadline': fmtDate(o.deadline),
        'Bước hiện tại': ORDER_STAGE_LABELS[o.status] ?? o.status,
        'Còn (ngày)': daysLeft(o.deadline) ?? '',
      })),
      `don-sap-het-han-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Đơn sắp hết hạn',
    );

  return (
    <div className="space-y-6 print-area">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)]">Đơn sắp hết deadline</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {rows.length} đơn còn hiệu lực, deadline ≤ 30 ngày tới
          </p>
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-black/[0.02] dark:bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 text-left">Mã đơn</th>
                <th className="px-4 py-3 text-left">Đối tác / Employer</th>
                <th className="px-4 py-3 text-left">Vị trí</th>
                <th className="px-4 py-3 text-right">Cần</th>
                <th className="px-4 py-3 text-left">Bước</th>
                <th className="px-4 py-3 text-left">Deadline</th>
                <th className="px-4 py-3 text-right">Còn</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Đang tổng hợp...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Không có đơn nào sắp hết hạn 🎉</td></tr>}
              {rows.map((o) => {
                const dl = daysLeft(o.deadline);
                return (
                  <tr key={o.id} className="border-t border-[var(--border-color)]">
                    <td className="px-4 py-3 font-mono text-xs text-blue-500">{o.orderCode ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{typeof o.partner === 'object' ? (o.partner?.name ?? '—') : '—'}</div>
                      <div className="text-xs text-slate-500">{o.employer ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{o.position ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{o.quantityNeeded ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{ORDER_STAGE_LABELS[o.status] ?? o.status ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(o.deadline)}</td>
                    <td className={`px-4 py-3 text-right text-xs font-bold ${dl != null && dl <= 7 ? 'text-red-500' : dl != null && dl <= 14 ? 'text-amber-500' : 'text-slate-500'}`}>
                      {dl != null ? `${dl} ngày` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
