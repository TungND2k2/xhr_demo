import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserRouter, Routes, Route, NavLink, useNavigate, useParams, useLocation, Navigate,
} from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users as UsersIcon, BarChart3, Settings, Sun, Moon, Search,
  FileText, Briefcase, Building2, Inbox, Calendar, Mail, Bot, MessageSquare, Users2,
  Boxes, Folder, ClipboardList, Plus, Shield, LogOut, Command, ArrowRight, X as XIcon,
  Newspaper,
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
import RoleDetailPage from './pages/RoleDetailPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import BlogListPage from './pages/BlogListPage';
import BlogDetailPage from './pages/BlogDetailPage';
import BlogEditorPage from './pages/BlogEditorPage';
import useAuth from './hooks/useAuth';
import PrintableFormDetail from './pages/PrintableFormDetail';
import WorkerHSNForm from './pages/WorkerHSNForm';
import CalendarView from './pages/CalendarView';
import EmployeeProfile from './pages/EmployeeProfile';
import OfficialDocumentView from './pages/OfficialDocumentView';
import OfficialDocumentsPage from './pages/OfficialDocumentsPage';
import PublicFormPage from './pages/PublicFormPage';

import FormModal from './components/FormModal';
import { createDoc, listDocs } from './api/payload';
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
      { path: '/offices', icon: Building2, label: 'Văn phòng' },
      { path: '/calendars', icon: Calendar, label: 'Lịch họp' },
      { path: '/reminders', icon: ClipboardList, label: 'Nhắc việc' },
      { path: '/forms', icon: FileText, label: 'Form / Lời mời' },
      { path: '/blog', icon: Newspaper, label: 'Blog nội bộ' },
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
      { path: '/users', icon: UsersIcon, label: 'Người dùng' },
      { path: '/roles', icon: Shield, label: 'Vai trò' },
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
      `w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all duration-200 border-l-4 ${
        isActive
          ? 'bg-gradient-to-r from-blue-500/10 to-transparent border-blue-500 text-blue-600 dark:text-blue-400 font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
          : 'border-transparent text-slate-500 hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <div className="flex items-center gap-3">
          <Icon size={16} className={isActive ? 'text-blue-500 dark:text-blue-400 filter drop-shadow-[0_0_4px_rgba(59,130,246,0.3)]' : 'text-slate-400'} />
          <span className="text-xs font-medium tracking-wide">{label}</span>
        </div>
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />}
      </>
    )}
  </NavLink>
);

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Ctrl+K / Cmd+K to open spotlight
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSpotlightOpen((o) => !o);
      }
      if (e.key === 'Escape') setSpotlightOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const location = useLocation();

  return (
    <div className="flex h-screen bg-[var(--bg-main)] text-[var(--text-main)] font-sans selection:bg-blue-500/30 overflow-hidden transition-colors duration-500">
      {/* Spotlight Search modal */}
      <SpotlightSearch open={spotlightOpen} onClose={() => setSpotlightOpen(false)} navigate={navigate} />
      <aside className="w-72 bg-[var(--sidebar-bg)] backdrop-blur-md border-r border-[var(--border-color)] flex flex-col shrink-0 transition-colors duration-500">
        <div className="px-8 pt-8 pb-6">
          <XorLogo className="text-4xl" />
          <p className="mt-2 text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-[0.2em] uppercase whitespace-nowrap">xHR Thịnh Long Group</p>
        </div>

        <nav className="flex-1 px-6 space-y-4 overflow-y-auto no-scrollbar pb-4">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.label} className="pt-2">
              <h3 className="px-4 text-[9px] font-extrabold text-slate-400 dark:text-slate-600 uppercase tracking-[0.25em] mb-2">{grp.label}</h3>
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
            <NavLink
              to="/profile"
              className={({ isActive }) => `flex items-center gap-3 min-w-0 flex-1 rounded-xl p-1.5 -m-1.5 transition-all ${isActive ? 'bg-blue-500/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
              title="Xem thông tin tài khoản"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/5 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-sm">
                <UsersIcon size={16} className="text-blue-500 dark:text-blue-400" />
              </div>
              <div className="leading-tight min-w-0">
                <p className="text-xs font-bold text-[var(--text-main)] truncate">{user?.displayName ?? user?.email ?? 'Người dùng'}</p>
                <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
                  {typeof user?.roleRef === 'object' && user?.roleRef?.name ? user.roleRef.name : (user?.role ?? '—')}
                </p>
              </div>
            </NavLink>
            <button
              onClick={logout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 ml-2"
              title="Đăng xuất"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 shrink-0 border-b border-[var(--border-color)] bg-[var(--sidebar-bg)]/80 backdrop-blur-md z-10 no-print">
          <div className="relative w-[360px] max-w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <button
              onClick={() => setSpotlightOpen(true)}
              className="w-full flex items-center gap-3 bg-black/5 dark:bg-white/5 border border-transparent hover:border-[var(--border-color)] focus:border-blue-500/40 rounded-xl py-2 pl-11 pr-4 text-xs transition-all outline-none text-slate-400 text-left"
            >
              <span className="flex-1">Tìm kiếm hệ thống...</span>
              <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800">
                <Command size={9} />K
              </kbd>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsDark(!isDark)} className="p-2.5 rounded-xl border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5 transition-all text-slate-500 dark:text-slate-400" title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}>
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

// Role detail — checkbox grid permissions matrix
function RoleDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <RoleDetailPage recordId={id} onBack={() => navigate('/roles')} />;
}

// Blog detail — view + edit markdown content
function BlogDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <BlogDetailPage recordId={id} onBack={() => navigate('/blog')} />;
}

// Roles list — SimpleListPage + nút Tạo (sau khi tạo redirect sang detail để tick permissions)
function RolesListRoute() {
  const navigate = useNavigate();
  const cfg = PAGES.roles;
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const ROLE_FIELDS = [
    { name: 'name', label: 'Tên vai trò', type: 'text', required: true, width: 'full', placeholder: 'vd: Trưởng phòng Nhật' },
    { name: 'description', label: 'Mô tả', type: 'textarea', width: 'full', rows: 2, placeholder: 'Chức danh + phạm vi' },
  ];

  const handleCreate = async (payload) => {
    const doc = await createDoc('roles', { ...payload, isSystem: false, permissions: {}, markets: [] });
    setReloadKey((k) => k + 1);
    if (doc?.id) navigate(`/roles/${doc.id}`);
  };

  if (!cfg) return <NotFound />;
  return (
    <>
      <SimpleListPage
        {...cfg}
        onSelect={(id) => navigate(`/roles/${id}`)}
        reloadKey={reloadKey}
        headerActions={
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all">
            <Plus size={14} /> Tạo vai trò
          </button>
        }
      />
      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo vai trò mới"
        subtitle="Sau khi tạo, anh sẽ tick checkbox các quyền trong trang chi tiết."
        fields={ROLE_FIELDS}
        submitLabel="Tạo vai trò"
        onSubmit={handleCreate}
      />
    </>
  );
}

// Users list — SimpleListPage + nút Tạo + FormModal với roleRef dropdown động
function UsersListRoute() {
  const navigate = useNavigate();
  const cfg = PAGES.users;
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [roleOptions, setRoleOptions] = useState([]);

  useEffect(() => {
    listDocs('roles', { limit: 100, depth: 0, sort: 'name' }).then((r) => {
      setRoleOptions((r.docs ?? []).map((d) => ({ value: d.id, label: d.name })));
    });
  }, [reloadKey]);

  const USER_FIELDS = [
    { name: 'displayName', label: 'Tên hiển thị', type: 'text', required: true, width: 'half', placeholder: 'vd: Nguyễn Thị Hoa' },
    { name: 'email',       label: 'Email',        type: 'email', required: true, width: 'half', placeholder: 'hoa@tlg.vn' },
    { name: 'password',    label: 'Mật khẩu',     type: 'password', required: true, width: 'half', placeholder: 'Tối thiểu 8 ký tự' },
    { name: 'role',        label: 'Vai trò (legacy enum)', type: 'select', required: true, width: 'half', defaultValue: 'recruiter',
      options: [
        { value: 'admin',           label: '👑 Admin' },
        { value: 'manager',         label: '📋 Quản lý điều hành' },
        { value: 'recruiter',       label: '🧑‍💼 Tuyển dụng' },
        { value: 'trainer',         label: '🎓 Giảng viên' },
        { value: 'visa_specialist', label: '🛂 Visa' },
        { value: 'accountant',      label: '💰 Kế toán' },
        { value: 'medical',         label: '🏥 Y tế' },
      ],
      help: 'Field cũ — vẫn dùng cho backward compat. Field "Vai trò (mới)" bên dưới mới là chính.',
    },
    { name: 'roleRef',     label: 'Vai trò (mới — chọn từ Roles)', type: 'select', required: true, width: 'half',
      options: roleOptions,
      help: 'Quyết định ma trận quyền user này được làm gì.',
    },
    { name: 'telegramUserId', label: 'Telegram User ID', type: 'text', width: 'full', placeholder: 'Để trống nếu chưa có. Lấy bằng @userinfobot trên Telegram.' },
  ];

  const handleCreate = async (payload) => {
    const doc = await createDoc('users', { ...payload, isActive: true });
    setReloadKey((k) => k + 1);
    if (doc?.id) navigate(`/users/${doc.id}`);
  };

  if (!cfg) return <NotFound />;
  return (
    <>
      <SimpleListPage
        {...cfg}
        onSelect={(id) => navigate(`/users/${id}`)}
        reloadKey={reloadKey}
        headerActions={
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all">
            <Plus size={14} /> Tạo người dùng
          </button>
        }
      />
      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo người dùng mới"
        subtitle="Email + Mật khẩu + Vai trò là bắt buộc. Đưa cho nhân viên đăng nhập portal."
        fields={USER_FIELDS}
        submitLabel="Tạo người dùng"
        onSubmit={handleCreate}
      />
    </>
  );
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

function ProtectedRoutes() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="text-sm text-slate-500">Đang kiểm tra phiên đăng nhập...</div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return (
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
        <Route path="/official-documents" element={<OfficialDocumentsPage />} />
        <Route path="/official-documents/:id" element={<OfficialDocumentRoute />} />

        <Route path="/media" element={<MediaGallery />} />
        <Route path="/media/:id" element={<CollectionDetailRoute tab="media" />} />

        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/assets/:id" element={<AssetDetailRoute />} />

        <Route path="/roles/:id" element={<RoleDetailRoute />} />

        {Object.keys(PAGES).filter((t) => t !== 'workers' && t !== 'calendars' && t !== 'media' && t !== 'assets' && t !== 'employees' && t !== 'roles' && t !== 'users' && t !== 'official-documents').map((tab) => (
          <React.Fragment key={tab}>
            <Route path={`/${tab}`} element={<CollectionListRoute tab={tab} />} />
            <Route path={`/${tab}/:id`} element={<CollectionDetailRoute tab={tab} />} />
          </React.Fragment>
        ))}

        <Route path="/profile" element={<ProfilePage />} />

        <Route path="/blog" element={<BlogListPage />} />
        <Route path="/blog/new" element={<BlogEditorPage mode="create" />} />
        <Route path="/blog/:id" element={<BlogDetailRoute />} />
        <Route path="/blog/:id/edit" element={<BlogEditorPage mode="edit" />} />

        <Route path="/roles" element={<RolesListRoute />} />

        <Route path="/users" element={<UsersListRoute />} />
        <Route path="/users/:id" element={<CollectionDetailRoute tab="users" />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forms/:token" element={<PublicFormPage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}

/* ─────────── Spotlight Search ─────────── */
const SPOTLIGHT_LINKS = [
  { label: 'Tổng quan', path: '/',            icon: LayoutDashboard, category: 'Tổng hợp' },
  { label: 'Báo cáo',   path: '/reports',     icon: BarChart3,       category: 'Tổng hợp' },
  { label: 'Lao động',  path: '/workers',     icon: UsersIcon,       category: 'Nghiệp vụ XKLĐ' },
  { label: 'Đơn tuyển', path: '/orders',      icon: Briefcase,       category: 'Nghiệp vụ XKLĐ' },
  { label: 'HĐ Cung ứng', path: '/supply-contracts', icon: FileText, category: 'Nghiệp vụ XKLĐ' },
  { label: 'HĐ Lao động', path: '/contracts', icon: FileText,        category: 'Nghiệp vụ XKLĐ' },
  { label: 'Đối tác',   path: '/partners',    icon: Building2,       category: 'Nghiệp vụ XKLĐ' },
  { label: 'Công văn',  path: '/official-documents', icon: Inbox,    category: 'Hành chính' },
  { label: 'Nhân sự nội bộ', path: '/employees', icon: Users2,       category: 'Hành chính' },
  { label: 'Tài sản',   path: '/assets',      icon: Boxes,           category: 'Hành chính' },
  { label: 'Văn phòng', path: '/offices',     icon: Building2,       category: 'Hành chính' },
  { label: 'Lịch họp',  path: '/calendars',   icon: Calendar,        category: 'Hành chính' },
  { label: 'Nhắc việc', path: '/reminders',   icon: ClipboardList,   category: 'Hành chính' },
  { label: 'Form / Lời mời', path: '/forms',  icon: Mail,            category: 'Hành chính' },
  { label: 'Kho Media', path: '/media',       icon: Folder,          category: 'Tệp tin' },
];

function SpotlightSearch({ open, onClose, navigate }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = q.trim()
    ? SPOTLIGHT_LINKS.filter((l) =>
        l.label.toLowerCase().includes(q.toLowerCase()) ||
        l.category.toLowerCase().includes(q.toLowerCase()) ||
        l.path.toLowerCase().includes(q.toLowerCase())
      )
    : SPOTLIGHT_LINKS;

  useEffect(() => {
    if (open) {
      setQ('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setActiveIdx(0); }, [q]);

  const go = useCallback((path) => {
    navigate(path);
    onClose();
    setQ('');
  }, [navigate, onClose]);

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[activeIdx]) { go(filtered[activeIdx].path); }
  };

  if (!open) return null;

  // Group by category
  const groups = {};
  filtered.forEach((l) => { (groups[l.category] ??= []).push(l); });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] px-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-[var(--border-color)]"
            style={{ background: 'var(--sidebar-bg)', backdropFilter: 'blur(20px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-color)]">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Tìm trang, tính năng..."
                className="flex-1 bg-transparent text-sm text-[var(--text-main)] placeholder-slate-400 outline-none"
              />
              {q && (
                <button onClick={() => setQ('')} className="text-slate-400 hover:text-[var(--text-main)] transition-colors">
                  <XIcon size={14} />
                </button>
              )}
              <kbd className="text-[10px] text-slate-400 border border-[var(--border-color)] px-1.5 py-0.5 rounded font-bold shrink-0">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto py-2 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">Không tìm thấy kết quả</div>
              ) : (
                Object.entries(groups).map(([cat, links]) => {
                  let globalIdx = filtered.indexOf(links[0]);
                  return (
                    <div key={cat} className="mb-2">
                      <p className="px-4 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">{cat}</p>
                      {links.map((l) => {
                        const idx = filtered.indexOf(l);
                        const Icon = l.icon;
                        return (
                          <button
                            key={l.path}
                            onClick={() => go(l.path)}
                            onMouseEnter={() => setActiveIdx(idx)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              idx === activeIdx
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${idx === activeIdx ? 'bg-blue-500/15' : 'bg-black/5 dark:bg-white/5'}`}>
                              <Icon size={14} className={idx === activeIdx ? 'text-blue-500' : 'text-slate-400'} />
                            </div>
                            <span className="flex-1 text-sm font-medium">{l.label}</span>
                            {idx === activeIdx && <ArrowRight size={14} className="text-blue-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[var(--border-color)] text-[10px] text-slate-400 font-semibold">
              <span className="flex items-center gap-1"><kbd className="border border-[var(--border-color)] px-1 rounded text-[9px]">↑↓</kbd> Di chuyển</span>
              <span className="flex items-center gap-1"><kbd className="border border-[var(--border-color)] px-1 rounded text-[9px]">↵</kbd> Chọn</span>
              <span className="flex items-center gap-1"><kbd className="border border-[var(--border-color)] px-1 rounded text-[9px]">ESC</kbd> Đóng</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
