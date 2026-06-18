import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Printer, Award } from 'lucide-react';
import { listDocs } from '../../api/payload';
import { exportXlsx, printPdf } from '../../lib/export';

export default function ReportTopPartnersRevenue() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Lấy tất cả contracts với order populated (để lấy partner)
      const r = await listDocs('contracts', { limit: 1000, depth: 2, sort: '-signingDate' });
      const byPartner = new Map();
      for (const c of r.docs ?? []) {
        const order = typeof c.order === 'object' ? c.order : null;
        const partner = typeof order?.partner === 'object' ? order.partner : null;
        if (!partner) continue;
        const cur = byPartner.get(partner.id) ?? {
          id: partner.id, name: partner.name ?? '?', country: partner.country, contracts: 0, totalFee: 0, totalSalary: 0,
        };
        cur.contracts += 1;
        cur.totalFee += Number(c.serviceFee ?? 0);
        // ước tính lương 36 tháng (3 năm) — typical XKLĐ
        cur.totalSalary += Number(c.salary ?? 0) * 36;
        byPartner.set(partner.id, cur);
      }
      setRows([...byPartner.values()].sort((a, b) => b.totalFee - a.totalFee));
      setLoading(false);
    })();
  }, []);

  const maxFee = Math.max(...rows.map((r) => r.totalFee), 1);
  const handleExport = () => exportXlsx(
    rows.map((r, i) => ({
      'STT': i + 1, 'Đối tác': r.name, 'Country': (r.country ?? '').toUpperCase(),
      'Số HĐ': r.contracts,
      'Tổng phí DV (VND)': r.totalFee,
      'Lương ước tính 3 năm': r.totalSalary,
    })),
    `top-doi-tac-doanh-thu-${new Date().toISOString().slice(0, 10)}.xlsx`,
    'Top đối tác',
  );

  return (
    <div className="space-y-6 print-area">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
            <Award className="text-blue-500" size={22} />Top đối tác theo doanh thu phí dịch vụ
          </h2>
          <p className="text-sm text-[var(--text-muted)]">{rows.length} đối tác có HĐLĐ — sắp xếp theo tổng phí DV</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5"><Download size={14} /> Excel</button>
          <button onClick={printPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5"><Printer size={14} /> PDF</button>
        </div>
      </div>

      <div className="glass-card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-black/[0.02]">
            <tr><th className="px-4 py-3 text-left w-12">#</th><th className="px-4 py-3 text-left">Đối tác</th><th className="px-4 py-3 text-right">Số HĐ</th><th className="px-4 py-3 text-left">Phí DV</th><th className="px-4 py-3 text-right w-24">Tổng (VND)</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Đang tính...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Chưa có HĐ nào ghi nhận phí DV</td></tr>}
            {!loading && rows.map((p, i) => {
              const pct = Math.round((p.totalFee / maxFee) * 100);
              return (
                <tr key={p.id} className="border-t border-[var(--border-color)]">
                  <td className="px-4 py-3 text-sm font-bold text-blue-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link to={`/partners/${p.id}`} className="font-semibold hover:underline">{p.name}</Link>
                    <div className="text-[10px] text-slate-500 uppercase">{p.country}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{p.contracts}</td>
                  <td className="px-4 py-3">
                    <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{p.totalFee.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
