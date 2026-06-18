import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Printer, AlertTriangle } from 'lucide-react';
import { listDocs } from '../../api/payload';
import { fmtDate } from '../../lib/workers-labels';
import { exportXlsx, printPdf } from '../../lib/export';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#a855f7', '#ec4899', '#06b6d4', '#64748b'];

export default function ReportFailureReasons() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await listDocs('workers', {
        where: { status: { equals: 'failed' } },
        limit: 500, depth: 0, sort: '-updatedAt',
      });
      setWorkers(r.docs ?? []);
      setLoading(false);
    })();
  }, []);

  const groups = useMemo(() => {
    const m = new Map();
    for (const w of workers) {
      // Đơn giản hoá lý do — lấy 3 từ đầu hoặc đặt "Không rõ"
      const reason = (w.failureReason ?? '').trim().slice(0, 60) || 'Không có lý do';
      const cur = m.get(reason) ?? { reason, count: 0, samples: [] };
      cur.count += 1;
      if (cur.samples.length < 5) cur.samples.push(w);
      m.set(reason, cur);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [workers]);

  const total = workers.length;
  const maxC = Math.max(...groups.map((g) => g.count), 1);

  const handleExport = () => exportXlsx(
    workers.map((w) => ({
      'Mã LĐ': w.workerCode, 'Họ tên': w.fullName, 'Lý do trượt': w.failureReason ?? '',
      'Điểm thi': w.examScore ?? '', 'Ngày cập nhật': w.updatedAt,
    })),
    `ld-truot-${new Date().toISOString().slice(0, 10)}.xlsx`,
    'LĐ trượt',
  );

  return (
    <div className="space-y-6 print-area">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={22} />Tỷ lệ trượt theo nguyên nhân
          </h2>
          <p className="text-sm text-[var(--text-muted)]">{total} LĐ có status=failed</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5"><Download size={14} /> Excel</button>
          <button onClick={printPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5"><Printer size={14} /> PDF</button>
        </div>
      </div>

      {/* Pie + List */}
      <div className="glass-card p-6">
        {loading ? <p className="text-center py-12 text-slate-500">Đang tính...</p> : groups.length === 0 ? (
          <p className="text-center py-12 text-slate-500">🎉 Chưa có LĐ nào trượt</p>
        ) : (
          <div className="space-y-3">
            {groups.map((g, i) => {
              const pct = Math.round((g.count / maxC) * 100);
              const sharePct = total > 0 ? Math.round((g.count / total) * 1000) / 10 : 0;
              return (
                <div key={i}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 text-sm font-semibold text-[var(--text-main)] truncate" title={g.reason}>{g.reason}</span>
                    <span className="text-xs text-slate-500 shrink-0 font-mono">{g.count} LĐ ({sharePct}%)</span>
                  </div>
                  <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                  {g.samples.length > 0 && (
                    <div className="mt-2 ml-6 flex flex-wrap gap-2">
                      {g.samples.map((w) => (
                        <Link key={w.id} to={`/workers/${w.id}`} className="text-[10px] px-2 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.04] hover:bg-blue-500/10 hover:text-blue-500">
                          {w.workerCode} {w.fullName}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
