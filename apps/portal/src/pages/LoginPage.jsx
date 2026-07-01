import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LogIn, Mail, KeyRound, AlertCircle, Eye, EyeOff, ArrowRight,
  ShieldCheck, Globe, BarChart3,
} from 'lucide-react';
import { login } from '../api/payload';

/* ── Floating orb decoration ── */
function Orb({ size, color, style }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size,
        background: color,
        filter: 'blur(60px)',
        opacity: 0.35,
        ...style,
      }}
      animate={{ scale: [1, 1.2, 1], y: [0, -20, 0] }}
      transition={{ duration: 7 + Math.random() * 3, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

/* ── Feature row in brand panel ── */
function Feature({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3.5">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
      >
        <Icon size={16} className="text-cyan-300" />
      </div>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-white/50 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex overflow-hidden"
      style={{ background: '#060d1a', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
    >
      {/* ═══════════ LEFT BRAND PANEL ═══════════ */}
      <div
        className="hidden lg:flex lg:w-[55%] relative flex-col justify-between overflow-hidden"
        style={{ padding: '3rem 4rem' }}
      >
        {/* Background image */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/login-bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        {/* Dark overlay for readability */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(6,13,26,0.55) 0%, rgba(30,58,138,0.4) 50%, rgba(6,13,26,0.7) 100%)' }}
        />

        {/* Floating orbs on top of bg */}
        <Orb size={300} color="#1d4ed8" style={{ top: '-80px', left: '-60px' }} />
        <Orb size={200} color="#0ea5e9" style={{ bottom: '120px', right: '-40px' }} />

        {/* ── Top logo ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-xl"
              style={{ background: 'linear-gradient(135deg, #2563eb, #0ea5e9)', boxShadow: '0 0 24px rgba(37,99,235,0.5)' }}
            >
              X
            </div>
            <div>
              <span
                className="font-black text-white text-2xl select-none"
                style={{ letterSpacing: '-0.04em' }}
              >
                X<span className="text-white/50">-OR</span>
              </span>
              <p className="text-white/40 text-[9px] font-bold tracking-[0.25em] uppercase -mt-0.5">
                XHR Thịnh Long Group
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Center hero text + features ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative z-10 space-y-10"
        >
          <div>
            <div
              className="inline-block text-[11px] font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4"
              style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.25)' }}
            >
              Nền tảng quản lý XKLĐ
            </div>
            <h1
              className="text-5xl font-black text-white leading-tight"
              style={{ letterSpacing: '-0.03em', textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}
            >
              Quản lý toàn diện<br />
              <span
                style={{
                  background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                xuất khẩu lao động
              </span>
            </h1>
            <p className="text-white/55 text-sm mt-4 leading-relaxed max-w-md">
              Theo dõi toàn bộ hành trình lao động từ tuyển dụng, ký hợp đồng đến xuất cảnh — tất cả trong một nền tảng thống nhất.
            </p>
          </div>

          <div className="space-y-4">
            <Feature
              icon={ShieldCheck}
              title="Bảo mật phân quyền theo vai trò"
              desc="Kiểm soát truy cập chi tiết theo từng tính năng"
            />
            <Feature
              icon={Globe}
              title="Đa thị trường JP · KR · TW · DE"
              desc="Quản lý song song nhiều thị trường xuất khẩu"
            />
            <Feature
              icon={BarChart3}
              title="Báo cáo & phân tích thời gian thực"
              desc="Dashboard trực quan, báo cáo tài chính tự động"
            />
          </div>
        </motion.div>

        {/* ── Bottom stats strip ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 flex items-center gap-8"
        >
          {[
            { num: 'W1→W8', label: 'Quy trình tự động' },
            { num: '360°', label: 'Hồ sơ lao động' },
            { num: '∞', label: 'Thị trường hỗ trợ' },
          ].map(({ num, label }) => (
            <div key={label}>
              <p
                className="text-2xl font-black text-white"
                style={{ textShadow: '0 0 20px rgba(56,189,248,0.4)' }}
              >
                {num}
              </p>
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <p className="text-white/25 text-[10px] font-semibold tracking-widest uppercase">
            © 2026 XOR Cloud
          </p>
        </motion.div>
      </div>

      {/* ═══════════ RIGHT FORM PANEL ═══════════ */}
      <div
        className="flex-1 flex items-center justify-center relative"
        style={{ padding: '2rem', background: '#060d1a' }}
      >
        {/* Subtle bg glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(37,99,235,0.08) 0%, transparent 70%)',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm relative z-10"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <span
              className="font-black text-3xl text-white select-none"
              style={{ letterSpacing: '-0.04em' }}
            >
              X<span className="text-slate-500">-OR</span>
            </span>
            <p className="text-slate-600 text-[10px] font-bold tracking-[0.2em] uppercase mt-1">
              XHR Thịnh Long Group
            </p>
          </div>

          {/* ── Form header ── */}
          <div className="mb-8">
            <h2
              className="text-3xl font-black text-white"
              style={{ letterSpacing: '-0.02em' }}
            >
              Đăng nhập
            </h2>
            <p className="text-sm mt-1.5" style={{ color: 'rgba(148,163,184,0.8)' }}>
              Chào mừng trở lại 👋 Vui lòng đăng nhập để tiếp tục
            </p>
          </div>

          {/* ── Form card ── */}
          <div
            className="rounded-2xl p-7 space-y-5"
            style={{
              background: 'rgba(15,23,42,0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Email field */}
            <div>
              <label
                className="block text-[11px] font-bold uppercase tracking-wider mb-2"
                style={{ color: 'rgba(148,163,184,0.8)' }}
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(100,116,139,0.8)' }}
                />
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@x-or.cloud"
                  disabled={busy}
                  style={{
                    width: '100%',
                    paddingLeft: '2.5rem',
                    paddingRight: '1rem',
                    paddingTop: '0.75rem',
                    paddingBottom: '0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '0.75rem',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f1f5f9',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '1px solid rgba(59,130,246,0.6)';
                    e.target.style.background = 'rgba(59,130,246,0.06)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid rgba(255,255,255,0.08)';
                    e.target.style.background = 'rgba(255,255,255,0.04)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label
                className="block text-[11px] font-bold uppercase tracking-wider mb-2"
                style={{ color: 'rgba(148,163,184,0.8)' }}
              >
                Mật khẩu
              </label>
              <div className="relative">
                <KeyRound
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(100,116,139,0.8)' }}
                />
                <input
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={busy}
                  style={{
                    width: '100%',
                    paddingLeft: '2.5rem',
                    paddingRight: '3rem',
                    paddingTop: '0.75rem',
                    paddingBottom: '0.75rem',
                    fontSize: '0.875rem',
                    borderRadius: '0.75rem',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#f1f5f9',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '1px solid rgba(59,130,246,0.6)';
                    e.target.style.background = 'rgba(59,130,246,0.06)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid rgba(255,255,255,0.08)';
                    e.target.style.background = 'rgba(255,255,255,0.04)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'rgba(100,116,139,0.8)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(100,116,139,0.8)'; }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 p-3 rounded-xl text-xs"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#fca5a5',
                }}
              >
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Submit button */}
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              whileHover={{ scale: busy ? 1 : 1.02 }}
              whileTap={{ scale: busy ? 1 : 0.98 }}
              className="w-full flex items-center justify-center gap-2.5 font-bold text-sm text-white relative overflow-hidden group"
              style={{
                padding: '0.85rem',
                borderRadius: '0.875rem',
                background: busy
                  ? 'rgba(37,99,235,0.5)'
                  : 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
                boxShadow: busy ? 'none' : '0 4px 20px rgba(37,99,235,0.35)',
                transition: 'all 0.2s',
              }}
            >
              {/* Shimmer effect on hover */}
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)',
                }}
              />
              {busy ? (
                <span className="flex items-center gap-2 relative z-10">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Đang đăng nhập...
                </span>
              ) : (
                <span className="flex items-center gap-2 relative z-10">
                  <LogIn size={15} />
                  Đăng nhập
                  <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform duration-200" />
                </span>
              )}
            </motion.button>
          </div>

          {/* ── Footer link ── */}
          <p className="text-center mt-5 text-xs" style={{ color: 'rgba(100,116,139,0.7)' }}>
            Quên mật khẩu?{' '}
            <a
              href="mailto:dev@x-or.cloud"
              className="font-semibold transition-colors"
              style={{ color: '#38bdf8' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#7dd3fc'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#38bdf8'; }}
            >
              Liên hệ admin
            </a>
          </p>

          <p className="text-center mt-3 text-[10px]" style={{ color: 'rgba(71,85,105,0.6)' }}>
            © 2026 XHR · Thịnh Long Group × XOR Cloud
          </p>
        </motion.div>
      </div>
    </div>
  );
}
