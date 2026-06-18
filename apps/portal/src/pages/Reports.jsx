import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, AlertTriangle, ShieldAlert, Plane, ArrowLeft,
  DollarSign, Wallet, Award, TrendingDown,
} from 'lucide-react';
import ReportWorkersByStage from './reports/WorkersByStage';
import ReportOrdersExpiring from './reports/OrdersExpiring';
import ReportCucPending from './reports/CucPending';
import ReportCoePending from './reports/CoePending';
import ReportRevenueByMonth from './reports/RevenueByMonth';
import ReportDepositHolding from './reports/DepositHolding';
import ReportTopPartnersRevenue from './reports/TopPartnersRevenue';
import ReportFailureReasons from './reports/FailureReasons';

const CATEGORIES = [
  {
    id: 'operational',
    label: '🔥 Vận hành',
    desc: 'Theo dõi workflow LĐ + deadline + COE + Cục',
    reports: [
      { id: 'workers-by-stage', icon: BarChart3,    title: 'LĐ theo W1 → W8',     desc: 'Phân bố lao động ở từng giai đoạn', color: 'cyan',   Component: ReportWorkersByStage },
      { id: 'orders-expiring',  icon: AlertTriangle, title: 'Đơn sắp hết deadline', desc: 'Đơn YCTD còn hiệu lực, deadline ≤ 30 ngày', color: 'amber',  Component: ReportOrdersExpiring },
      { id: 'cuc-pending',      icon: ShieldAlert,   title: 'HĐ chờ Cục QLLĐNN',    desc: 'HĐCU chưa được Cục chấp thuận', color: 'purple', Component: ReportCucPending },
      { id: 'coe-pending',      icon: Plane,         title: 'COE chờ về',           desc: 'HĐLĐ đã ký nhưng chưa nhận COE', color: 'red',    Component: ReportCoePending },
    ],
  },
  {
    id: 'financial',
    label: '💰 Tài chính',
    desc: 'Doanh thu, cọc, phí dịch vụ',
    reports: [
      { id: 'revenue-by-month', icon: DollarSign, title: 'Doanh thu phí DV theo tháng', desc: 'Bar chart 12 tháng gần nhất', color: 'green', Component: ReportRevenueByMonth },
      { id: 'deposit-holding',  icon: Wallet,     title: 'Cọc đang giữ / chưa hoàn',    desc: 'Tổng tiền cọc + LĐ trượt chưa hoàn', color: 'amber', Component: ReportDepositHolding },
    ],
  },
  {
    id: 'partner',
    label: '🤝 Đối tác',
    desc: 'Ranking + doanh thu theo partner',
    reports: [
      { id: 'top-partners-revenue', icon: Award, title: 'Top đối tác doanh thu', desc: 'Sắp xếp theo tổng phí DV', color: 'blue', Component: ReportTopPartnersRevenue },
    ],
  },
  {
    id: 'analytics',
    label: '📈 Phân tích',
    desc: 'Hiệu suất + risk analysis',
    reports: [
      { id: 'failure-reasons', icon: TrendingDown, title: 'Tỷ lệ trượt theo nguyên nhân', desc: 'Phân loại LĐ trượt + lý do cụ thể', color: 'red', Component: ReportFailureReasons },
    ],
  },
];

const COLOR_CLS = {
  cyan: 'bg-cyan-500/10 text-cyan-500', amber: 'bg-amber-500/10 text-amber-500',
  purple: 'bg-purple-500/10 text-purple-500', red: 'bg-red-500/10 text-red-500',
  green: 'bg-green-500/10 text-green-500', blue: 'bg-blue-500/10 text-blue-500',
};

const ALL_REPORTS = CATEGORIES.flatMap((c) => c.reports);

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeReport = searchParams.get('r');
  const setActiveReport = (id) => { id ? setSearchParams({ r: id }) : setSearchParams({}); };

  if (activeReport) {
    const r = ALL_REPORTS.find((x) => x.id === activeReport);
    if (r) {
      const C = r.Component;
      return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <button onClick={() => setActiveReport(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-main)] no-print">
            <ArrowLeft size={16} /> Quay lại danh sách báo cáo
          </button>
          <C />
        </motion.div>
      );
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight">Báo cáo</h2>
        <p className="text-sm text-[var(--text-muted)]">
          {ALL_REPORTS.length} báo cáo theo {CATEGORIES.length} nhóm — xuất Excel / PDF.
        </p>
      </div>

      {CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-lg font-bold text-[var(--text-main)]">{cat.label}</h3>
            <span className="text-xs text-slate-500">{cat.desc}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cat.reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveReport(r.id)}
                className="glass-card p-5 text-left hover:border-blue-500/40 transition-all group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${COLOR_CLS[r.color] ?? 'bg-slate-500/10 text-slate-500'}`}>
                  <r.icon size={18} />
                </div>
                <h4 className="text-base font-bold text-[var(--text-main)] mb-1">{r.title}</h4>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{r.desc}</p>
                <p className="text-[10px] text-blue-500 mt-3 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Mở →
                </p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
