import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, KeyRound, Save, Eye, EyeOff, AlertCircle, Shield, LogOut,
  MessageSquare, Check,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import { fetchPayload, refreshMe } from '../api/payload';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [telegramUserId, setTelegramUserId] = useState(user?.telegramUserId ?? '');
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState(null);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);

  if (!user) {
    return <div className="text-center py-24 text-slate-500 text-sm">Đang tải thông tin tài khoản...</div>;
  }

  const roleName = typeof user.roleRef === 'object' && user.roleRef?.name
    ? user.roleRef.name
    : (user.role ?? '—');
  const initials = (user.displayName ?? user.email ?? '?').slice(0, 2).toUpperCase();

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    setInfoMsg(null);
    try {
      const res = await fetchPayload(`/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, telegramUserId: telegramUserId || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.errors?.[0]?.message || j?.message || `HTTP ${res.status}`);
      }
      await refreshMe();
      setInfoMsg({ ok: true, text: 'Đã cập nhật thông tin.' });
    } catch (e) {
      setInfoMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSavingInfo(false);
    }
  };

  const handleChangePwd = async () => {
    setPwdMsg(null);
    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdMsg({ ok: false, text: 'Vui lòng nhập đầy đủ 3 trường.' });
      return;
    }
    if (newPwd.length < 8) {
      setPwdMsg({ ok: false, text: 'Mật khẩu mới tối thiểu 8 ký tự.' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ ok: false, text: 'Mật khẩu mới không khớp.' });
      return;
    }
    if (newPwd === currentPwd) {
      setPwdMsg({ ok: false, text: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
      return;
    }

    setSavingPwd(true);
    try {
      // Verify mật khẩu hiện tại bằng cách login lại (Payload không có endpoint check-pwd riêng)
      const verifyRes = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: currentPwd }),
      });
      if (!verifyRes.ok) {
        throw new Error('Mật khẩu hiện tại không đúng.');
      }

      // PATCH password
      const res = await fetchPayload(`/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPwd }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j?.errors?.[0]?.message || j?.message || `HTTP ${res.status}`);
      }
      setPwdMsg({ ok: true, text: 'Đổi mật khẩu thành công. Lần đăng nhập tới dùng mật khẩu mới.' });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (e) {
      setPwdMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight">Thông tin tài khoản</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">Cập nhật tên hiển thị, ID Telegram và đổi mật khẩu cá nhân.</p>
      </div>

      {/* Hero */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-black shadow-md shadow-blue-500/20">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-black text-[var(--text-main)] truncate">{user.displayName ?? user.email}</h3>
            <p className="text-sm text-slate-500 truncate">{user.email}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
              <Shield size={11} />
              {roleName}
            </div>
          </div>
        </div>
      </div>

      {/* Thông tin cá nhân */}
      <div className="glass-card p-6">
        <h3 className="text-base font-black text-[var(--text-main)] mb-4 flex items-center gap-2">
          <User size={16} className="text-blue-500" /> Thông tin cá nhân
        </h3>
        <div className="space-y-4">
          <Field label="Email" icon={Mail} readonly value={user.email} help="Email dùng để đăng nhập — không đổi được. Liên hệ admin nếu cần đổi." />
          <Field label="Tên hiển thị" icon={User} value={displayName} onChange={setDisplayName} placeholder="vd: Nguyễn Thị Hoa" />
          <Field label="Telegram User ID" icon={MessageSquare} value={telegramUserId} onChange={setTelegramUserId} placeholder="vd: 123456789 (dùng @userinfobot để lấy)" help="Bot DM nhắc việc về đây. Để trống nếu chưa có." />

          {infoMsg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${infoMsg.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-500'}`}>
              {infoMsg.ok ? <Check size={14} /> : <AlertCircle size={14} />}
              {infoMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleSaveInfo} disabled={savingInfo} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-50">
              <Save size={14} /> {savingInfo ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      </div>

      {/* Đổi mật khẩu */}
      <div className="glass-card p-6">
        <h3 className="text-base font-black text-[var(--text-main)] mb-4 flex items-center gap-2">
          <KeyRound size={16} className="text-blue-500" /> Đổi mật khẩu
        </h3>
        <div className="space-y-4">
          <Field
            label="Mật khẩu hiện tại"
            icon={KeyRound}
            type={showCurrent ? 'text' : 'password'}
            value={currentPwd}
            onChange={setCurrentPwd}
            placeholder="••••••••"
            trailing={
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
          />
          <Field
            label="Mật khẩu mới"
            icon={KeyRound}
            type={showNew ? 'text' : 'password'}
            value={newPwd}
            onChange={setNewPwd}
            placeholder="Tối thiểu 8 ký tự"
            help="Mẹo: kết hợp chữ + số. Không bắt buộc ký tự đặc biệt."
            trailing={
              <button type="button" onClick={() => setShowNew(!showNew)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
          />
          <Field
            label="Xác nhận mật khẩu mới"
            icon={KeyRound}
            type={showNew ? 'text' : 'password'}
            value={confirmPwd}
            onChange={setConfirmPwd}
            placeholder="Nhập lại"
          />

          {pwdMsg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${pwdMsg.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-500'}`}>
              {pwdMsg.ok ? <Check size={14} /> : <AlertCircle size={14} />}
              {pwdMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleChangePwd} disabled={savingPwd} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-50">
              <KeyRound size={14} /> {savingPwd ? 'Đang đổi...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="glass-card p-6 border-red-500/20">
        <h3 className="text-base font-black text-red-500 mb-2 flex items-center gap-2">
          <LogOut size={16} /> Đăng xuất
        </h3>
        <p className="text-xs text-slate-500 mb-4">Kết thúc phiên hiện tại. Anh phải đăng nhập lại lần sau.</p>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={14} /> Đăng xuất
        </button>
      </div>
    </motion.div>
  );
}

function Field({ label, icon: Icon, value, onChange, type = 'text', placeholder, help, readonly = false, trailing }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />}
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readonly}
          autoComplete={type === 'password' ? 'new-password' : undefined}
          className={`w-full ${Icon ? 'pl-9' : 'pl-3'} ${trailing ? 'pr-10' : 'pr-3'} py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent text-[var(--text-main)] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 outline-none ${readonly ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
        {trailing && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</div>
        )}
      </div>
      {help && <p className="text-[10px] text-slate-500 mt-1">{help}</p>}
    </div>
  );
}
