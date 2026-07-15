import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Plus, Search, X, QrCode, Download, Phone, Mail, MapPin, User,
} from 'lucide-react';
import { listDocs, createDoc, API_BASE } from '../api/payload';
import { fmtDate } from '../lib/workers-labels';
import FormModal from '../components/FormModal';
import QRCodeCard from '../components/QRCodeCard';
import { exportXlsx } from '../lib/export';

const COURSE_META = {
  nhat: { label: '🇯🇵 Tiếng Nhật', chip: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' },
  han: { label: '🇰🇷 Tiếng Hàn', chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
};
const STATUS_META = {
  new: { label: '🆕 Mới', chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  contacted: { label: '📞 Đã liên hệ', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  enrolled: { label: '✅ Đã nhập học', chip: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' },
  rejected: { label: '❌ Không học', chip: 'bg-slate-500/10 text-slate-500 border-slate-500/30' },
};
const LEVEL_LABEL = { none: 'Chưa học', beginner: 'Sơ cấp', intermediate: 'Trung cấp', advanced: 'Cao cấp' };
const SOURCE_LABEL = { form: '📝 Form', manual: '👤 Tạo tay', telegram: '🤖 Telegram' };

const CREATE_FIELDS = [
  { name: 'fullName', label: 'Họ và tên', type: 'text', required: true, width: 'full' },
  { name: 'courseType', label: 'Khoá học', type: 'select', required: true, width: 'half',
    options: [{ value: 'nhat', label: '🇯🇵 Tiếng Nhật' }, { value: 'han', label: '🇰🇷 Tiếng Hàn' }] },
  { name: 'phone', label: 'Số điện thoại', type: 'text', required: true, width: 'half' },
  { name: 'email', label: 'Email', type: 'email', required: true, width: 'half' },
  { name: 'province', label: 'Tỉnh/Thành phố', type: 'text', required: true, width: 'half' },
  { name: 'koreanJapaneseLevel', label: 'Trình độ hiện tại', type: 'select', required: true, width: 'half',
    options: [
      { value: 'none', label: 'Chưa từng học' },
      { value: 'beginner', label: 'Sơ cấp' },
      { value: 'intermediate', label: 'Trung cấp' },
      { value: 'advanced', label: 'Cao cấp' },
    ] },
  { name: 'occupation', label: 'Nghề nghiệp', type: 'text', width: 'half' },
  { name: 'note', label: 'Ghi chú', type: 'textarea', width: 'full', rows: 2 },
];

export default function StudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const registerUrl = useMemo(() => `${window.location.origin}/dang-ky-hoc-vien`, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    listDocs('students', { limit: 500, depth: 1, sort: '-createdAt' }).then((d) => {
      if (cancel) return;
      setStudents(d.docs ?? []);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (courseFilter && s.courseType !== courseFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (q) {
        const hay = `${s.fullName ?? ''} ${s.phone ?? ''} ${s.email ?? ''} ${s.province ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [students, search, courseFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = students.length;
    const nhat = students.filter((s) => s.courseType === 'nhat').length;
    const han = students.filter((s) => s.courseType === 'han').length;
    const newCount = students.filter((s) => s.status === 'new').length;
    return { total, nhat, han, newCount };
  }, [students]);

  const handleCreate = async (payload) => {
    const doc = await createDoc('students', { ...payload, source: 'manual', status: 'new' });
    setReloadKey((k) => k + 1);
    if (doc?.id) navigate(`/students/${doc.id}`);
  };

  const handleExport = () => {
    const rows = filtered.map((s) => ({
      'Họ tên': s.fullName ?? '',
      'Khoá': COURSE_META[s.courseType]?.label ?? s.courseType ?? '',
      'SĐT': s.phone ?? '',
      'Email': s.email ?? '',
      'Tỉnh/TP': s.province ?? '',
      'Nghề nghiệp': s.occupation ?? '',
      'Trình độ': LEVEL_LABEL[s.koreanJapaneseLevel] ?? '',
      'Trạng thái': STATUS_META[s.status]?.label ?? s.status ?? '',
      'Nguồn': SOURCE_LABEL[s.source] ?? s.source ?? '',
      'Ngày đăng ký': fmtDate(s.createdAt),
    }));
    exportXlsx(rows, `hoc-vien-${new Date().toISOString().slice(0, 10)}.xlsx`, 'Học viên');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight flex items-center gap-3">
            <GraduationCap size={28} className="text-blue-500" /> Học viên
          </h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">Học viên đăng ký khoá tiếng Hàn / Nhật</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={filtered.length === 0} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all disabled:opacity-40">
            <Download size={14} /> Excel
          </button>
          <button onClick={() => setQrOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
            <QrCode size={14} /> Link / QR đăng ký
          </button>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all">
            <Plus size={14} /> Thêm học viên
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Tổng học viên" value={loading ? '…' : stats.total} tint="bg-blue-500/10 text-blue-500" />
        <Kpi label="🇯🇵 Tiếng Nhật" value={loading ? '…' : stats.nhat} tint="bg-red-500/10 text-red-500" />
        <Kpi label="🇰🇷 Tiếng Hàn" value={loading ? '…' : stats.han} tint="bg-blue-500/10 text-blue-500" />
        <Kpi label="Mới chưa liên hệ" value={loading ? '…' : stats.newCount} tint={stats.newCount > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-500'} />
      </div>

      {/* Filter */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên, SĐT, email, tỉnh..." className="w-full bg-transparent border border-[var(--border-color)] rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 text-[var(--text-main)]" />
          </div>
          {(courseFilter || statusFilter || search) && (
            <button onClick={() => { setCourseFilter(null); setStatusFilter(null); setSearch(''); }} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--border-color)] text-slate-500 hover:text-[var(--text-main)]">
              <X size={11} /> Xoá lọc
            </button>
          )}
          <span className="text-[11px] text-slate-500 ml-auto">{filtered.length}/{students.length}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(COURSE_META).map(([k, m]) => (
            <Chip key={k} active={courseFilter === k} onClick={() => setCourseFilter(courseFilter === k ? null : k)} label={m.label} />
          ))}
          <span className="w-px bg-[var(--border-color)] mx-1" />
          {Object.entries(STATUS_META).map(([k, m]) => (
            <Chip key={k} active={statusFilter === k} onClick={() => setStatusFilter(statusFilter === k ? null : k)} label={m.label} />
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">Chưa có học viên nào khớp bộ lọc.</div>
      ) : (
        <div className="glass-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500 bg-black/[0.02] dark:bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-left">Họ tên</th>
                  <th className="px-4 py-3 text-left">Khoá</th>
                  <th className="px-4 py-3 text-left">SĐT</th>
                  <th className="px-4 py-3 text-left">Tỉnh/TP</th>
                  <th className="px-4 py-3 text-left">Trình độ</th>
                  <th className="px-4 py-3 text-left">Trạng thái</th>
                  <th className="px-4 py-3 text-left">Nguồn</th>
                  <th className="px-4 py-3 text-left">Ngày ĐK</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} onClick={() => navigate(`/students/${s.id}`)} className="border-t border-[var(--border-color)] hover:bg-blue-500/5 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-xs font-semibold">{s.fullName ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${COURSE_META[s.courseType]?.chip ?? ''}`}>{COURSE_META[s.courseType]?.label ?? s.courseType}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{s.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{s.province ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">{LEVEL_LABEL[s.koreanJapaneseLevel] ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_META[s.status]?.chip ?? ''}`}>{STATUS_META[s.status]?.label ?? s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{SOURCE_LABEL[s.source] ?? s.source ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create modal */}
      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm học viên (tạo tay)"
        subtitle="Nhập thông tin cơ bản. Có thể bổ sung chi tiết trong trang học viên."
        fields={CREATE_FIELDS}
        submitLabel="Tạo học viên"
        onSubmit={handleCreate}
      />

      {/* QR modal */}
      <AnimatePresence>
        {qrOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQrOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[var(--sidebar-bg)] rounded-2xl border border-[var(--border-color)] shadow-2xl p-8 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-[var(--text-main)]">Link / QR đăng ký</h3>
                <button onClick={() => setQrOpen(false)} className="text-slate-500 hover:text-[var(--text-main)]"><X size={18} /></button>
              </div>
              <p className="text-xs text-slate-500 mb-5">In QR này lên tờ rơi / poster, hoặc gửi link cho học viên. Ai quét cũng mở được form đăng ký (không cần đăng nhập).</p>
              <QRCodeCard url={registerUrl} title="Đăng ký khoá học tiếng Hàn / Nhật" subtitle="Thịnh Long Group" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Kpi({ label, value, tint }) {
  return (
    <div className="glass-card p-5">
      <div className={`p-2.5 rounded-xl inline-flex mb-4 ${tint}`}><GraduationCap size={18} /></div>
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">{label}</p>
      <h3 className="text-3xl font-black text-[var(--text-main)]">{value ?? '—'}</h3>
    </div>
  );
}

function Chip({ active, onClick, label }) {
  return (
    <button onClick={onClick} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${active ? 'bg-blue-500/10 text-blue-500 border-blue-500/40' : 'border-[var(--border-color)] text-slate-500 hover:text-[var(--text-main)]'}`}>
      {label}
    </button>
  );
}
