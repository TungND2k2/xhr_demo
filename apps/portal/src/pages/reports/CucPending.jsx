import React, { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { listDocs } from '../../api/payload';
import { CUC_STATUS_LABELS, fmtDate } from '../../lib/workers-labels';
import { exportXlsx, printPdf } from '../../lib/export';

export default function ReportCucPending() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await listDocs('supply-contracts', {
        where: {
          cucApprovalStatus: { in: 'not_submitted,pending,needs_revision' },
        },
        limit: 100,
        depth: 1,
        sort: 'cucRegistrationDate',
      });
      setRows(r.docs ?? []);
      setLoading(false);
    })();
  }, []);

  const handleExport = () =>
    exportXlsx(
      rows.map((sc) => ({
        'Số HĐ': sc.contractNumber ?? '',
        'Đối tác': typeof sc.partner === 'object' ? sc.partner?.name : '',
        'Chương trình': sc.programType ?? '',
        'Trạng thái Cục': CUC_STATUS_LABELS[sc.cucApprovalStatus] ?? sc.cucApprovalStatus,
        'Ngày đăng ký': fmtDate(sc.cucRegistrationDate),
        'Cán bộ phụ trách':
          typeof sc.responsibleEmployee === 'object'
            ? sc.responsibleEmployee?.fullName ?? ''
            : '',
        'Ghi chú': sc.cucNotes ?? '',
      })),
      `hd-cho-cuc-qlldnn-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'HĐ chờ Cục',
    );

  return (
    <div className="space-y-6 print-area">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)]">HĐ chờ Cục QLLĐNN</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {rows.length} HĐ chưa được Cục chấp thuận (Anh Long phụ trách)
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
                <th className="px-4 py-3 text-left">Số HĐ</th>
                <th className="px-4 py-3 text-left">Đối tác</th>
                <th className="px-4 py-3 text-left">Chương trình</th>
                <th className="px-4 py-3 text-left">Trạng thái Cục</th>
                <th className="px-4 py-3 text-left">Đăng ký</th>
                <th className="px-4 py-3 text-left">Phụ trách</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Đang tổng hợp...</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Tất cả HĐ đã được Cục xử lý ✓</td></tr>}
              {rows.map((sc) => (
                <tr key={sc.id} className="border-t border-[var(--border-color)]">
                  <td className="px-4 py-3 font-mono text-xs text-blue-500">{sc.contractNumber ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold">{typeof sc.partner === 'object' ? (sc.partner?.name ?? '—') : '—'}</td>
                  <td className="px-4 py-3 text-xs uppercase">{sc.programType ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">{CUC_STATUS_LABELS[sc.cucApprovalStatus] ?? sc.cucApprovalStatus}</td>
                  <td className="px-4 py-3 text-xs">{fmtDate(sc.cucRegistrationDate)}</td>
                  <td className="px-4 py-3 text-xs">
                    {typeof sc.responsibleEmployee === 'object'
                      ? sc.responsibleEmployee?.fullName ?? '—'
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
