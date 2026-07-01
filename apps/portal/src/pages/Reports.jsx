import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, AlertTriangle, ShieldAlert, Plane, ArrowLeft, ArrowRight,
  DollarSign, Wallet, Award, TrendingDown, FileBarChart2,
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
    label: 'Vận hành',
    emoji: '🔥',
    desc: 'Theo dõi workflow LĐ + deadline + COE + Cục',
    gradient: 'from-orange-500 to-red-600',
    bg: 'from-orange-500/8 to-red-500/5',
    border: 'border-orange-500/20',
    reports: [
      { id: 'workers-by-stage', icon: BarChart3,    title: 'LĐ theo W1 → W8',     desc: 'Phân bố lao động ở từng giai đoạn', color: 'cyan',   gradient: 'from-cyan-500 to-blue-600',   Component: ReportWorkersByStage },
      { id: 'orders-expiring',  icon: AlertTriangle, title: 'Đơn sắp hết deadline', desc: 'Đơn YCTD còn hiệu lực, deadline ≤ 30 ngày', color: 'amber', gradient: 'from-amber-500 to-orange-600',  Component: ReportOrdersExpiring },
      { id: 'cuc-pending',      icon: ShieldAlert,   title: 'HĐ chờ Cục QLLĐNN',    desc: 'HĐCU chưa được Cục chấp thuận', color: 'purple', gradient: 'from-purple-500 to-violet-600', Component: ReportCucPending },
      { id: 'coe-pending',      icon: Plane,         title: 'COE chờ về',           desc: 'HĐLĐ đã ký nhưng chưa nhận COE', color: 'red',   gradient: 'from-red-500 to-rose-600',    Component: ReportCoePending },
    ],
  },
  {
    id: 'financial',
    label: 'Tài chính',
    emoji: '💰',
    desc: 'Doanh thu, cọc, phí dịch vụ',
    gradient: 'from-green-500 to-emerald-600',
    bg: 'from-green-500/8 to-emerald-500/5',
    border: 'border-green-500/20',
    reports: [
      { id: 'revenue-by-month', icon: DollarSign, title: 'Doanh thu phí DV theo tháng', desc: 'Bar chart 12 tháng gần nhất', color: 'green', gradient: 'from-green-500 to-teal-600',  Component: ReportRevenueByMonth },
      { id: 'deposit-holding',  icon: Wallet,     title: 'Cọc đang giữ / chưa hoàn',    desc: 'Tổng tiền cọc + LĐ trượt chưa hoàn', color: 'amber', gradient: 'from-amber-500 to-yellow-600', Component: ReportDepositHolding },
    ],
  },
  {
    id: 'partner',
    label: 'Đối tác',
    emoji: '🤝',
    desc: 'Ranking + doanh thu theo partner',
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'from-blue-500/8 to-indigo-500/5',
    border: 'border-blue-500/20',
    reports: [
      { id: 'top-partners-revenue', icon: Award, title: 'Top đối tác doanh thu', desc: 'Sắp xếp theo tổng phí DV', color: 'blue', gradient: 'from-blue-500 to-indigo-600', Component: ReportTopPartnersRevenue },
    ],
  },
  {
    id: 'analytics',
    label: 'Phân tích',
    emoji: '📈',
    desc: 'Hiệu suất + risk analysis',
    gradient: 'from-pink-500 to-rose-600',
    bg: 'from-pink-500/8 to-rose-500/5',
    border: 'border-pink-500/20',
    reports: [
      { id: 'failure-reasons', icon: TrendingDown, title: 'Tỷ lệ trượt theo nguyên nhân', desc: 'Phân loại LĐ trượt + lý do cụ thể', color: 'red', gradient: 'from-pink-500 to-red-600', Component: ReportFailureReasons },
    ],
  },
];

const ICON_COLORS = {
  cyan:   { bg: 'bg-cyan-500/15',   text: 'text-cyan-500',   border: 'border-cyan-500/30'   },
  amber:  { bg: 'bg-amber-500/15',  text: 'text-amber-500',  border: 'border-amber-500/30'  },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-500', border: 'border-purple-500/30' },
  red:    { bg: 'bg-red-500/15',    text: 'text-red-500',    border: 'border-red-500/30'    },
  green:  { bg: 'bg-green-500/15',  text: 'text-green-500',  border: 'border-green-500/30'  },
  blue:   { bg: 'bg-blue-500/15',   text: 'text-blue-500',   border: 'border-blue-500/30'   },
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
      const ic = ICON_COLORS[r.color] ?? ICON_COLORS.blue;
      return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center gap-4 no-print">
            <button
              onClick={() => setActiveReport(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] text-sm text-slate-500 hover:text-[var(--text-main)] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all font-semibold"
            >
              <ArrowLeft size={15} /> Quay lại
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${ic.bg} ${ic.text}`}>
                <r.icon size={17} />
              </div>
              <div>
                <h2 className="text-lg font-black text-[var(--text-main)]">{r.title}</h2>
                <p className="text-xs text-slate-500">{r.desc}</p>
              </div>
            </div>
          </div>
          <C />
        </motion.div>
      );
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <FileBarChart2 size={18} className="text-white" />
            </div>
            <h2 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent tracking-tight">
              Báo cáo
            </h2>
          </div>
          <p className="text-sm text-[var(--text-muted)] font-medium">
            {ALL_REPORTS.length} báo cáo theo {CATEGORIES.length} nhóm — xuất Excel / PDF
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
          <span className="px-2.5 py-1 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)]">
            {ALL_REPORTS.length} báo cáo
          </span>
        </div>
      </div>

      {/* Category groups */}
      {CATEGORIES.map((cat, catIdx) => (
        <motion.div
          key={cat.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: catIdx * 0.07 }}
        >
          {/* Category header */}
          <div className={`flex items-center gap-3 mb-4 p-4 rounded-2xl bg-gradient-to-r ${cat.bg} border ${cat.border}`}>
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center text-sm shadow-sm`}>
              {cat.emoji}
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--text-main)]">{cat.label}</h3>
              <p className="text-[11px] text-slate-500">{cat.desc}</p>
            </div>
            <span className="ml-auto text-[10px] font-bold text-slate-400 border border-[var(--border-color)] px-2 py-0.5 rounded-full bg-[var(--card-bg)]">
              {cat.reports.length} báo cáo
            </span>
          </div>

          {/* Report cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cat.reports.map((r, rIdx) => {
              const ic = ICON_COLORS[r.color] ?? ICON_COLORS.blue;
              return (
                <motion.button
                  key={r.id}
                  onClick={() => setActiveReport(r.id)}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: catIdx * 0.07 + rIdx * 0.04 }}
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  className={`glass-card p-5 text-left group hover:shadow-xl hover:border-[var(--border-focus,#3b82f6)]/40 transition-all duration-300 relative overflow-hidden`}
                >
                  {/* Top accent line */}
                  <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${r.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                  {/* Icon */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 border ${ic.border} ${ic.bg} group-hover:scale-110 transition-transform duration-300`}>
                    <r.icon size={19} className={ic.text} />
                  </div>

                  {/* Content */}
                  <h4 className="text-sm font-black text-[var(--text-main)] mb-1.5 leading-tight">{r.title}</h4>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{r.desc}</p>

                  {/* CTA */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-color)]">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${ic.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
                      Xem báo cáo
                    </span>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${ic.bg} ${ic.text} translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200`}>
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
