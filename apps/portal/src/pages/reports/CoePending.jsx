import React, { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { listDocs } from '../../api/payload';
import { fmtDate } from '../../lib/workers-labels';
import { exportXlsx, printPdf } from '../../lib/export';

export default function ReportCoePending() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // HĐ đã ký (signed/visa_pending) nhưng chưa nhận COE
      const r = await listDocs('contracts', {
        where: {
          and: [
            { status: { in: 'signed,visa_pending' } },
            { coeReceivedAt: { exists: false } },
          ],
        },
        limit: 100,
        depth: 2,
        sort: 'signingDate',
      });
      setRows(r.docs ?? []);
      setLoading(false);
    })();
  }, []);

  const daysSince = (d) => {
    if (!d) return null;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  };

  const handleExport = () =>
    exportXlsx(
      rows.map((c) => ({
        'Mã HĐ': c.contractCode ?? '',
        'LĐ': typeof c.worker === 'object' ? c.worker?.fullName : '',
        'Mã LĐ': typeof c.worker === 'object' ? c.worker?.workerCode : '',
        'Đối tác': typeof c.order === 'object' && typeof c.order?.partner === 'object'
          ? c.order.partner?.name
          : '',
        'Ngày ký HĐ': fmtDate(c.signingDate),
        'Ngày yêu cầu COE': fmtDate(c.coeRequestedAt),
        'Số ngày chờ': daysSince(c.coeRequestedAt ?? c.signingDate) ?? '',
      })),
      `coe-cho-ve-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'COE chờ về',
    );

  return (
    <div className="space-y-6 print-area">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)]">COE chờ về</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {rows.length} HĐ đã ký nhưng chưa nhận COE từ đối tác
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
                <th className="px-4 py-3 text-left">Mã HĐ</th>
                <th className="px-4 py-3 text-left">LĐ</th>
                <th className="px-4 py-3 text-left">Đối tác</th>
                <th className="px-4 py-3 text-left">Ngày ký HĐ</th>
                <th className="px-4 py-3 text-left">Yêu cầu COE</th>
                <th className="px-4 py-3 text-right">Số ngày chờ</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Đang tổng hợp...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Tất cả COE đã về ✓</td></tr>}
              {rows.map((c) => {
                const days = daysSince(c.coeRequestedAt ?? c.signingDate);
                return (
                  <tr key={c.id} className="border-t border-[var(--border-color)]">
                    <td className="px-4 py-3 font-mono text-xs text-blue-500">{c.contractCode ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{typeof c.worker === 'object' ? c.worker?.fullName ?? '—' : '—'}</div>
                      <div className="text-xs text-slate-500 font-mono">{typeof c.worker === 'object' ? c.worker?.workerCode ?? '' : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {typeof c.order === 'object' && typeof c.order?.partner === 'object'
                        ? c.order.partner?.name ?? '—'
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">{fmtDate(c.signingDate)}</td>
                    <td className="px-4 py-3 text-xs">{fmtDate(c.coeRequestedAt)}</td>
                    <td className={`px-4 py-3 text-right text-xs font-bold ${days != null && days > 90 ? 'text-red-500' : days != null && days > 60 ? 'text-amber-500' : 'text-slate-500'}`}>
                      {days != null ? `${days} ngày` : '—'}
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
