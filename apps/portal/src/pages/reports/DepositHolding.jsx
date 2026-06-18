import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Printer, Wallet } from 'lucide-react';
import { listDocs } from '../../api/payload';
import { WORKER_STATUS_LABELS, fmtDate } from '../../lib/workers-labels';
import { exportXlsx, printPdf } from '../../lib/export';

export default function ReportDepositHolding() {
  const [holding, setHolding] = useState([]);
  const [unrefunded, setUnrefunded] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // LĐ đang giữ cọc (đã nộp + chưa hoàn + chưa xuất cảnh)
      const r1 = await listDocs('workers', {
        where: { and: [{ depositAmount: { greater_than: 0 } }, { depositRefundedAt: { exists: false } }, { status: { not_equals: 'deployed' } }] },
        limit: 500, depth: 0, sort: '-depositDate',
      });
      // LĐ trượt + chưa hoàn cọc → critical
      const r2 = await listDocs('workers', {
        where: { and: [{ status: { equals: 'failed' } }, { depositAmount: { greater_than: 0 } }, { depositRefundedAt: { exists: false } }] },
        limit: 500, depth: 0, sort: '-depositDate',
      });
      setHolding(r1.docs ?? []);
      setUnrefunded(r2.docs ?? []);
      setLoading(false);
    })();
  }, []);

  const totalHolding = holding.reduce((s, w) => s + Number(w.depositAmount ?? 0), 0);
  const totalUnref = unrefunded.reduce((s, w) => s + Number(w.depositAmount ?? 0), 0);

  const handleExport = () => {
    const rows = [
      ...holding.map((w) => ({ Loại: 'Đang giữ', 'Mã LĐ': w.workerCode, 'Họ tên': w.fullName, 'Trạng thái': WORKER_STATUS_LABELS[w.status], 'Số tiền (VND)': w.depositAmount, 'Ngày nộp': w.depositDate })),
      ...unrefunded.map((w) => ({ Loại: 'Chưa hoàn (trượt)', 'Mã LĐ': w.workerCode, 'Họ tên': w.fullName, 'Trạng thái': WORKER_STATUS_LABELS[w.status], 'Số tiền (VND)': w.depositAmount, 'Ngày nộp': w.depositDate })),
    ];
    exportXlsx(rows, `coc-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Cọc');
  };

  return (
    <div className="space-y-6 print-area">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
            <Wallet className="text-amber-500" size={22} />Cọc đang giữ / Cọc chưa hoàn
          </h2>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5"><Download size={14} /> Excel</button>
          <button onClick={printPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5"><Printer size={14} /> PDF</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Đang giữ (LĐ chưa xuất cảnh)</p>
          <h3 className="text-3xl font-black text-green-600 mt-1">{totalHolding.toLocaleString()} <span className="text-sm text-slate-500">VND</span></h3>
          <p className="text-xs text-slate-500 mt-2">{holding.length} LĐ</p>
        </div>
        <div className="glass-card p-5 border-red-500/30 bg-red-500/5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">⚠ Chưa hoàn (LĐ đã trượt)</p>
          <h3 className="text-3xl font-black text-red-500 mt-1">{totalUnref.toLocaleString()} <span className="text-sm text-slate-500">VND</span></h3>
          <p className="text-xs text-slate-500 mt-2">{unrefunded.length} LĐ — cần hoàn cọc gấp</p>
        </div>
      </div>

      {/* Critical: chưa hoàn */}
      {unrefunded.length > 0 && (
        <div className="glass-card p-0 overflow-hidden border-red-500/30">
          <div className="bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">🚨 LĐ trượt chưa hoàn cọc ({unrefunded.length})</div>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-black/[0.02]">
              <tr><th className="px-4 py-3 text-left">Mã LĐ</th><th className="px-4 py-3 text-left">Họ tên</th><th className="px-4 py-3 text-left">Ngày nộp cọc</th><th className="px-4 py-3 text-right">Số tiền (VND)</th></tr>
            </thead>
            <tbody>
              {unrefunded.map((w) => (
                <tr key={w.id} className="border-t border-[var(--border-color)]">
                  <td className="px-4 py-2"><Link to={`/workers/${w.id}`} className="font-mono text-xs text-blue-500 hover:underline">{w.workerCode ?? '—'}</Link></td>
                  <td className="px-4 py-2">{w.fullName}</td>
                  <td className="px-4 py-2 text-xs">{fmtDate(w.depositDate)}</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(w.depositAmount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Đang giữ */}
      <div className="glass-card p-0 overflow-hidden">
        <div className="bg-green-500/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-500">💰 LĐ đang giữ cọc ({holding.length})</div>
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-black/[0.02]">
            <tr><th className="px-4 py-3 text-left">Mã LĐ</th><th className="px-4 py-3 text-left">Họ tên</th><th className="px-4 py-3 text-left">Trạng thái</th><th className="px-4 py-3 text-left">Ngày nộp</th><th className="px-4 py-3 text-right">Số tiền (VND)</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Đang tải...</td></tr>}
            {!loading && holding.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Không có LĐ nào đang giữ cọc</td></tr>}
            {holding.map((w) => (
              <tr key={w.id} className="border-t border-[var(--border-color)]">
                <td className="px-4 py-2"><Link to={`/workers/${w.id}`} className="font-mono text-xs text-blue-500 hover:underline">{w.workerCode ?? '—'}</Link></td>
                <td className="px-4 py-2">{w.fullName}</td>
                <td className="px-4 py-2 text-xs">{WORKER_STATUS_LABELS[w.status] ?? w.status}</td>
                <td className="px-4 py-2 text-xs">{fmtDate(w.depositDate)}</td>
                <td className="px-4 py-2 text-right font-mono">{Number(w.depositAmount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
