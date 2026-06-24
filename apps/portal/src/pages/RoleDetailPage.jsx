import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, Shield, Lock, AlertCircle, Check, X, Globe2,
} from 'lucide-react';
import { getDoc, fetchPayload } from '../api/payload';
import DeleteButton from '../components/DeleteButton';

const ACTIONS = [
  { key: 'read',   label: 'Đọc' },
  { key: 'create', label: 'Tạo' },
  { key: 'update', label: 'Sửa' },
  { key: 'delete', label: 'Xoá' },
];

// 23 collection slug — group theo nhóm nghiệp vụ
const COLLECTION_GROUPS = [
  {
    label: 'Tuyển dụng & XKLĐ',
    items: [
      { slug: 'workers',          label: 'Lao động' },
      { slug: 'orders',           label: 'Đơn tuyển' },
      { slug: 'order-workers',    label: 'LĐ × Đơn' },
      { slug: 'contracts',        label: 'Hợp đồng' },
      { slug: 'supply-contracts', label: 'HĐ Cung ứng' },
      { slug: 'partners',         label: 'Đối tác' },
      { slug: 'form-invites',     label: 'Form mời điền' },
    ],
  },
  {
    label: 'Hành chính',
    items: [
      { slug: 'employees',         label: 'Nhân sự nội bộ' },
      { slug: 'assets',            label: 'Tài sản' },
      { slug: 'offices',           label: 'Văn phòng' },
      { slug: 'official-documents', label: 'Công văn' },
    ],
  },
  {
    label: 'Quy trình & Lịch',
    items: [
      { slug: 'calendars',       label: 'Lịch họp/event' },
      { slug: 'reminders',       label: 'Nhắc việc' },
      { slug: 'workflows',       label: 'Workflows' },
      { slug: 'workflow-stages', label: 'Workflow stages' },
      { slug: 'media',           label: 'Tệp tin' },
      { slug: 'forms',           label: 'Form templates' },
    ],
  },
  {
    label: 'Hệ thống (nhạy cảm)',
    items: [
      { slug: 'users',                label: 'Người dùng' },
      { slug: 'roles',                label: 'Vai trò' },
      { slug: 'agents',               label: 'AI Agents' },
      { slug: 'telegram-topics',      label: 'Telegram topics' },
      { slug: 'telegram-groups',      label: 'Telegram groups' },
      { slug: 'telegram-users',       label: 'Telegram users' },
      { slug: 'telegram-membership',  label: 'Telegram membership' },
      { slug: 'counters',             label: 'Counters' },
    ],
  },
];

const MARKET_OPTIONS = [
  { value: 'jp', label: '🇯🇵 Nhật Bản' },
  { value: 'kr', label: '🇰🇷 Hàn Quốc' },
  { value: 'tw', label: '🇹🇼 Đài Loan' },
  { value: 'de', label: '🇩🇪 Đức' },
  { value: 'me', label: '🇸🇦 Trung Đông' },
  { value: 'eu', label: '🇪🇺 EU' },
  { value: 'other', label: 'Khác' },
];

export default function RoleDetailPage({ recordId, onBack }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState({});
  const [markets, setMarkets] = useState([]);

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    getDoc('roles', recordId, 0).then((d) => {
      setDoc(d);
      setName(d?.name ?? '');
      setDescription(d?.description ?? '');
      setPermissions(d?.permissions ?? {});
      setMarkets(d?.markets ?? []);
      setLoading(false);
    });
  }, [recordId]);

  const isAdminRole = doc?.isSystem && doc?.name === 'Admin';
  const isSystemRole = !!doc?.isSystem;

  const handleToggle = (slug, action) => {
    if (isAdminRole) return; // Admin luôn full
    setPermissions((prev) => ({
      ...prev,
      [slug]: { ...(prev[slug] ?? {}), [action]: !(prev[slug]?.[action]) },
    }));
  };

  const handleToggleRow = (slug) => {
    if (isAdminRole) return;
    const row = permissions[slug] ?? {};
    const allOn = ACTIONS.every((a) => row[a.key]);
    const next = ACTIONS.reduce((acc, a) => ({ ...acc, [a.key]: !allOn }), {});
    setPermissions((prev) => ({ ...prev, [slug]: next }));
  };

  const handleToggleColumn = (action) => {
    if (isAdminRole) return;
    const allSlugs = COLLECTION_GROUPS.flatMap((g) => g.items.map((c) => c.slug));
    const allOn = allSlugs.every((s) => permissions[s]?.[action]);
    setPermissions((prev) => {
      const next = { ...prev };
      for (const s of allSlugs) {
        next[s] = { ...(next[s] ?? {}), [action]: !allOn };
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (isAdminRole) return;
    const allSlugs = COLLECTION_GROUPS.flatMap((g) => g.items.map((c) => c.slug));
    const next = {};
    for (const s of allSlugs) {
      next[s] = { read: true, create: true, update: true, delete: true };
    }
    setPermissions(next);
  };

  const handleClearAll = () => {
    if (isAdminRole) return;
    setPermissions({});
  };

  const handleToggleMarket = (value) => {
    if (isAdminRole) return;
    setMarkets((prev) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const body = isAdminRole
        ? { name, description }
        : { name, description, permissions, markets };
      const res = await fetchPayload(`/roles/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = j?.errors?.[0]?.message || j?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setDoc(j.doc ?? j);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // Count tổng quyền đã chọn
  const stats = useMemo(() => {
    let total = 0;
    let on = 0;
    for (const g of COLLECTION_GROUPS) {
      for (const c of g.items) {
        for (const a of ACTIONS) {
          total += 1;
          if (permissions[c.slug]?.[a.key]) on += 1;
        }
      }
    }
    return { total, on, pct: total > 0 ? Math.round((on / total) * 100) : 0 };
  }, [permissions]);

  if (loading) return <div className="text-center py-24 text-slate-500">Đang tải...</div>;
  if (!doc) return <div className="text-center py-24 text-red-500">Không tải được vai trò này.</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 print-area">
      {/* Top bar */}
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-main)] transition-colors">
          <ArrowLeft size={16} /> Quay lại Vai trò
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-50">
            <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          {!isSystemRole && (
            <DeleteButton
              collection="roles"
              recordId={doc.id}
              recordLabel={doc.name}
              onDeleted={onBack}
            />
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className={`shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center ${isAdminRole ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
            {isAdminRole ? <Lock size={28} /> : <Shield size={28} />}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tên vai trò</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isAdminRole}
                className="block w-full mt-1 bg-transparent text-2xl font-black text-[var(--text-main)] outline-none border-b border-transparent focus:border-blue-500/40 disabled:opacity-70"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mô tả</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="block w-full mt-1 bg-transparent text-sm text-[var(--text-muted)] outline-none border border-[var(--border-color)] rounded-lg p-2 focus:border-blue-500/40 resize-y"
              />
            </div>
            {isSystemRole && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border w-fit ${
                isAdminRole ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'}`}>
                <Lock size={11} />
                {isAdminRole ? 'Admin — luôn full quyền (không sửa permissions)' : 'Vai trò hệ thống (vẫn sửa được, không xoá được)'}
              </div>
            )}
          </div>
        </div>
      </div>

      {saveError && (
        <div className="glass-card p-4 border-red-500/30 bg-red-500/5 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-500">{saveError}</div>
        </div>
      )}

      {/* Phạm vi thị trường */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe2 size={16} className="text-blue-500" />
          <h3 className="text-base font-black text-[var(--text-main)]">Phạm vi thị trường</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Chọn các thị trường user role này được phép xem. <strong>Bỏ trống = tất cả thị trường</strong>. Áp dụng cho Workers / Orders / Contracts.
        </p>
        <div className="flex flex-wrap gap-2">
          {MARKET_OPTIONS.map((m) => {
            const selected = markets.includes(m.value);
            return (
              <button
                key={m.value}
                onClick={() => handleToggleMarket(m.value)}
                disabled={isAdminRole}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  selected
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'border-[var(--border-color)] text-slate-500 hover:text-[var(--text-main)]'
                }`}
              >
                {selected && <Check size={11} />}
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Permissions matrix */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="text-base font-black text-[var(--text-main)]">Ma trận phân quyền</h3>
            <p className="text-xs text-slate-500 mt-1">
              {isAdminRole
                ? '🔒 Admin luôn full quyền — không sửa được.'
                : `Đã bật ${stats.on}/${stats.total} quyền (${stats.pct}%)`}
            </p>
          </div>
          {!isAdminRole && (
            <div className="flex gap-2">
              <button onClick={handleSelectAll} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--border-color)] text-blue-500 hover:bg-blue-500/5">
                Chọn tất cả
              </button>
              <button onClick={handleClearAll} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--border-color)] text-slate-500 hover:bg-black/5 dark:hover:bg-white/5">
                Bỏ tất cả
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left text-[10px] uppercase tracking-wider text-slate-500 font-bold pb-2 pr-4">Collection</th>
                {ACTIONS.map((a) => (
                  <th key={a.key} className="text-center text-[10px] uppercase tracking-wider text-slate-500 font-bold pb-2 px-1 min-w-[60px]">
                    <button
                      onClick={() => handleToggleColumn(a.key)}
                      disabled={isAdminRole}
                      className="cursor-pointer hover:text-blue-500 disabled:cursor-default disabled:hover:text-slate-500"
                      title={`Bật/tắt tất cả ${a.label.toLowerCase()}`}
                    >
                      {a.label}
                    </button>
                  </th>
                ))}
                <th className="text-center text-[10px] uppercase tracking-wider text-slate-500 font-bold pb-2 px-1 w-12">⚡</th>
              </tr>
            </thead>
            <tbody>
              {COLLECTION_GROUPS.map((g, gi) => (
                <React.Fragment key={g.label}>
                  <tr className="bg-blue-500/5">
                    <td colSpan={ACTIONS.length + 2} className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-blue-500">
                      {g.label}
                    </td>
                  </tr>
                  {g.items.map((c) => {
                    const row = permissions[c.slug] ?? {};
                    const allOn = ACTIONS.every((a) => row[a.key]);
                    return (
                      <tr key={c.slug} className="border-b border-[var(--border-color)] last:border-0 hover:bg-blue-500/5">
                        <td className="py-2 pr-4 text-sm text-[var(--text-main)]">{c.label}</td>
                        {ACTIONS.map((a) => (
                          <td key={a.key} className="text-center py-2 px-1">
                            <label className="inline-flex cursor-pointer" onClick={(e) => isAdminRole && e.preventDefault()}>
                              <input
                                type="checkbox"
                                checked={isAdminRole ? true : !!row[a.key]}
                                onChange={() => handleToggle(c.slug, a.key)}
                                disabled={isAdminRole}
                                className="w-4 h-4 rounded border-[var(--border-color)] accent-blue-500 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </label>
                          </td>
                        ))}
                        <td className="text-center py-2 px-1">
                          <button
                            onClick={() => handleToggleRow(c.slug)}
                            disabled={isAdminRole}
                            className="text-[10px] text-slate-500 hover:text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Bật/tắt cả dòng"
                          >
                            {allOn ? <X size={12} /> : <Check size={12} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
