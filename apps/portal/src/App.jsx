import React, { useEffect, useState } from 'react';
import {
  BrowserRouter, Routes, Route, NavLink, useNavigate, useParams, useLocation, Navigate,
} from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users as UsersIcon, BarChart3, Settings, Sun, Moon, Search,
  FileText, Briefcase, Building2, Inbox, Calendar, Mail, Bot, MessageSquare, Users2,
  Boxes, Folder, ClipboardList, Plus,
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Workers from './pages/Workers';
import WorkerDetail from './pages/WorkerDetail';
import Reports from './pages/Reports';
import SimpleListPage from './pages/SimpleListPage';
import SimpleDetailPage from './pages/SimpleDetailPage';
import MediaDetail from './pages/MediaDetail';
import MediaGallery from './pages/MediaGallery';
import AssetsPage from './pages/AssetsPage';
import AssetDetailPage from './pages/AssetDetailPage';
import PrintableFormDetail from './pages/PrintableFormDetail';
import WorkerHSNForm from './pages/WorkerHSNForm';
import CalendarView from './pages/CalendarView';
import EmployeeProfile from './pages/EmployeeProfile';
import OfficialDocumentView from './pages/OfficialDocumentView';
import FormModal from './components/FormModal';
import { createDoc } from './api/payload';
import { PAGES } from './pages/configs.jsx';

const EMPLOYEE_DEPT_OPTIONS = [
  { value: 'hcns',        label: '🏢 Hành chính - Nhân sự' },
  { value: 'tuyendung',   label: '🧑‍💼 Tuyển dụng' },
  { value: 'daotao',      label: '🎓 Đào tạo' },
  { value: 'visa',        label: '🛂 Visa - Hồ sơ' },
  { value: 'ketoan',      label: '💰 Kế toán' },
  { value: 'yte',         label: '🏥 Y tế' },
  { value: 'phong_jp',    label: '🇯🇵 Phòng Nhật Bản' },
  { value: 'phong_kr',    label: '🇰🇷 Phòng Hàn Quốc' },
  { value: 'phong_tw',    label: '🇹🇼 Phòng Đài Loan' },
  { value: 'phong_de',    label: '🇩🇪 Phòng Đức' },
  { value: 'bgd',         label: '👑 Ban Giám đốc' },
  { value: 'other',       label: 'Khác' },
];
const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'working',     label: '✅ Đang làm việc' },
  { value: 'long_leave',  label: '🌴 Nghỉ phép dài hạn' },
  { value: 'maternity',   label: '🤰 Thai sản' },
  { value: 'resigned',    label: '📤 Đã nghỉ việc' },
  { value: 'fired',       label: '❌ Sa thải' },
  { value: 'suspended',   label: '⏸ Tạm hoãn' },
];
const EMPLOYEE_CREATE_FIELDS = [
  { name: 'employeeCode', label: 'Mã NV',         type: 'text',   required: true, width: 'third', placeholder: 'EMP-001' },
  { name: 'fullName',     label: 'Họ tên đầy đủ', type: 'text',   required: true, width: 'full' },
  { name: 'department',   label: 'Phòng ban',     type: 'select', required: true, width: 'half', options: EMPLOYEE_DEPT_OPTIONS },
  { name: 'position',     label: 'Chức vụ',       type: 'text',   required: true, width: 'half', placeholder: 'Trưởng phòng / Chuyên viên / GĐ' },
  { name: 'status',       label: 'Trạng thái',    type: 'select', required: true, width: 'half', defaultValue: 'working', options: EMPLOYEE_STATUS_OPTIONS },
  { name: 'hireDate',     label: 'Ngày vào làm',  type: 'date',   width: 'half' },
  { name: 'phone',        label: 'SĐT',           type: 'text',   width: 'half' },
  { name: 'email',        label: 'Email cá nhân', type: 'text',   width: 'half' },
];

/** X-OR wordmark — Inter Black, chữ X xanh + -OR xám. */
function XorLogo({ className = '' }) {
  return (
    <span
      className={`inline-block font-black select-none whitespace-nowrap ${className}`}
      style={{ letterSpacing: '-0.04em', lineHeight: 1.1, paddingBottom: '0.05em' }}
    >
      <span style={{ color: '#2599F4' }}>X</span>
      <span className="text-slate-500 dark:text-slate-400">-OR</span>
    </span>
  );
}

const NAV_GROUPS = [
  {
    label: 'Tổng hợp',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Tổng quan', exact: true },
      { path: '/reports', icon: BarChart3, label: 'Báo cáo' },
    ],
  },
  {
    label: 'Nghiệp vụ XKLĐ',
    items: [
      { path: '/workers', icon: UsersIcon, label: 'Lao động' },
      { path: '/orders', icon: FileText, label: 'Đơn tuyển' },
      { path: '/supply-contracts', icon: Briefcase, label: 'HĐ Cung ứng' },
      { path: '/contracts', icon: Briefcase, label: 'HĐ Lao động' },
      { path: '/partners', icon: Building2, label: 'Đối tác' },
    ],
  },
  {
    label: 'Hành chính',
    items: [
      { path: '/official-documents', icon: Inbox, label: 'Công văn' },
      { path: '/employees', icon: Users2, label: 'Nhân sự nội bộ' },
      { path: '/assets', icon: Boxes, label: 'Tài sản' },
      { path: '/calendars', icon: Calendar, label: 'Lịch họp' },
      { path: '/reminders', icon: ClipboardList, label: 'Nhắc việc' },
      { path: '/forms', icon: FileText, label: 'Form / Lời mời' },
    ],
  },
  {
    label: 'Tệp tin',
    items: [
      { path: '/media', icon: Folder, label: 'Kho Media' },
    ],
  },
  {
    label: 'Telegram Bot',
    items: [
      { path: '/agents', icon: Bot, label: 'AI Agents' },
      { path: '/telegram-topics', icon: MessageSquare, label: 'Topics' },
      { path: '/telegram-groups', icon: Mail, label: 'Nhóm' },
    ],
  },
];

const SidebarNavLink = ({ to, icon: Icon, label, end }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      `w-full flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all duration-200 ${
        isActive
          ? 'sidebar-item-active text-white'
          : 'text-slate-500 hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <div className="flex items-center gap-3">
          <Icon size={16} className={isActive ? 'text-blue-500' : ''} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        {isActive && <div className="w-1 h-1 rounded-full bg-blue-500" />}
      </>
    )}
  </NavLink>
);

function Layout({ children }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const location = useLocation();

  return (
    <div className="flex h-screen bg-[var(--bg-main)] text-[var(--text-main)] font-sans selection:bg-blue-500/30 overflow-hidden transition-colors duration-500">
      <aside className="w-72 bg-[var(--sidebar-bg)] border-r border-[var(--border-color)] flex flex-col shrink-0 transition-colors duration-500">
        <div className="px-8 pt-8 pb-6">
          <XorLogo className="text-4xl" />
          <p className="mt-2 text-[10px] font-bold text-slate-500 tracking-[0.15em] uppercase whitespace-nowrap">xHR Thịnh Long Group</p>
        </div>

        <nav className="flex-1 px-6 space-y-5 overflow-y-auto no-scrollbar pb-4">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.label} className="pt-2">
              <h3 className="px-4 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-2">{grp.label}</h3>
              <div className="space-y-0.5">
                {grp.items.map((it) => (
                  <SidebarNavLink key={it.path} to={it.path} icon={it.icon} label={it.label} end={it.exact} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-6 border-t border-[var(--border-color)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                <UsersIcon size={16} className="text-blue-500" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold text-[var(--text-main)]">Quản trị viên</p>
                <p className="text-[10px] text-slate-500">Demo (Sprint 1)</p>
              </div>
            </div>
            <Settings size={18} className="text-slate-500" />
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 shrink-0 border-b border-[var(--border-color)] bg-[var(--sidebar-bg)] backdrop-blur-md z-10 no-print">
          <div className="relative w-[400px] max-w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input type="text" placeholder="Tìm kiếm (sẽ wire sau)..." className="w-full bg-transparent border border-[var(--border-color)] rounded-2xl py-2 pl-12 pr-4 text-xs focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-[var(--text-main)]" disabled />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsDark(!isDark)} className="p-2.5 rounded-xl border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5 transition-all" title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="h-10 flex items-center justify-between px-8 shrink-0 border-t border-[var(--border-color)] text-[10px] text-slate-500 uppercase tracking-widest no-print">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> ONLINE</span>
          </div>
          <div>© NỀN TẢNG xHR — Thịnh Long Group V1.0.0</div>
        </footer>
      </main>
    </div>
  );
}

// Route wrapper cho Workers (list)
function WorkersRoute() {
  const navigate = useNavigate();
  return <Workers onSelect={(id) => navigate(`/workers/${id}`)} />;
}

// Route wrapper cho Worker detail — render đúng layout HSN-M01.
function WorkerDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <WorkerHSNForm recordId={id} onBack={() => navigate('/workers')} />;
}

// Employee detail — BambooHR-style profile
function EmployeeDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <EmployeeProfile recordId={id} onBack={() => navigate('/employees')} />;
}

// Official document detail — Confluence/Notion-style with sidebar
function OfficialDocumentRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <OfficialDocumentView recordId={id} onBack={() => navigate('/official-documents')} />;
}

// Asset detail — custom hero + maintenance timeline
function AssetDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <AssetDetailPage recordId={id} onBack={() => navigate('/assets')} />;
}

// Employees list — SimpleListPage + nút Tạo + FormModal
function EmployeesListRoute() {
  const navigate = useNavigate();
  const cfg = PAGES.employees;
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleCreate = async (payload) => {
    const doc = await createDoc('employees', payload);
    setReloadKey((k) => k + 1);
    if (doc?.id) navigate(`/employees/${doc.id}`);
  };

  if (!cfg) return <NotFound />;
  return (
    <>
      <SimpleListPage
        {...cfg}
        onSelect={(id) => navigate(`/employees/${id}`)}
        reloadKey={reloadKey}
        headerActions={
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all"
          >
            <Plus size={14} /> Thêm nhân sự
          </button>
        }
      />
      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Thêm nhân sự mới"
        subtitle="Mã NV + Họ tên + Phòng ban + Chức vụ + Trạng thái là bắt buộc. Còn lại có thể bổ sung sau."
        fields={EMPLOYEE_CREATE_FIELDS}
        submitLabel="Tạo nhân sự"
        onSubmit={handleCreate}
      />
    </>
  );
}

// Route wrapper cho list 1 collection
function CollectionListRoute({ tab }) {
  const navigate = useNavigate();
  const cfg = PAGES[tab];
  if (!cfg) return <NotFound />;
  return <SimpleListPage {...cfg} onSelect={(id) => navigate(`/${tab}/${id}`)} />;
}

// Route wrapper cho detail
function CollectionDetailRoute({ tab }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const cfg = PAGES[tab];
  if (!cfg) return <NotFound />;
  if (tab === 'media') return <MediaDetail recordId={id} onBack={() => navigate('/media')} />;
  if (cfg.detailLayout === 'form') {
    return (
      <PrintableFormDetail
        title={cfg.title}
        collection={cfg.collection}
        recordId={id}
        formTitle={cfg.formTitle}
        detailSections={cfg.detailSections}
        headerSummary={cfg.headerSummary}
        showSignatures={cfg.showSignatures !== false}
        onBack={() => navigate(`/${tab}`)}
      />
    );
  }
  return (
    <SimpleDetailPage
      title={cfg.title}
      collection={cfg.collection}
      recordId={id}
      detailSections={cfg.detailSections}
      headerSummary={cfg.headerSummary}
      displayKey={cfg.displayKey}
      onBack={() => navigate(`/${tab}`)}
    />
  );
}

function NotFound() {
  return (
    <div className="text-center py-24">
      <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">Không tìm thấy trang</h2>
      <p className="text-sm text-slate-500">URL không khớp với route nào.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reports" element={<Reports />} />

          <Route path="/workers" element={<WorkersRoute />} />
          <Route path="/workers/:id" element={<WorkerDetailRoute />} />

          <Route path="/calendars" element={<CalendarView />} />
          <Route path="/calendars/:id" element={<CollectionDetailRoute tab="calendars" />} />
          <Route path="/employees" element={<EmployeesListRoute />} />
          <Route path="/employees/:id" element={<EmployeeDetailRoute />} />
          <Route path="/official-documents/:id" element={<OfficialDocumentRoute />} />
          <Route path="/media" element={<MediaGallery />} />
          <Route path="/media/:id" element={<CollectionDetailRoute tab="media" />} />

          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/assets/:id" element={<AssetDetailRoute />} />

          {Object.keys(PAGES).filter((t) => t !== 'workers' && t !== 'calendars' && t !== 'media' && t !== 'assets' && t !== 'employees').map((tab) => (
            <React.Fragment key={tab}>
              <Route path={`/${tab}`} element={<CollectionListRoute tab={tab} />} />
              <Route path={`/${tab}/:id`} element={<CollectionDetailRoute tab={tab} />} />
            </React.Fragment>
          ))}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
