import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Edit2, Save, X, Printer, User, Briefcase, FileText, Award, Folder, Mail, Phone, MapPin, MessageSquare,
} from 'lucide-react';
import { getDoc, fetchPayload } from '../api/payload';
import { fmtDate } from '../lib/workers-labels';
import { printPdf } from '../lib/export';
import DeleteButton from '../components/DeleteButton';

const DEPT_LABEL = {
  hcns: '🏢 HC-NS', tuyendung: '🧑‍💼 Tuyển dụng', daotao: '🎓 Đào tạo',
  visa: '🛂 Visa', ketoan: '💰 Kế toán', yte: '🏥 Y tế',
  phong_jp: '🇯🇵 Phòng JP', phong_kr: '🇰🇷 Phòng KR', phong_tw: '🇹🇼 Phòng TW',
  phong_de: '🇩🇪 Phòng DE', bgd: '👑 BGĐ', other: 'Khác',
};
const STATUS_LABEL = {
  working: '✅ Đang làm', long_leave: '🌴 Nghỉ phép dài', maternity: '🤰 Thai sản',
  resigned: '📤 Đã nghỉ', fired: '❌ Sa thải', suspended: '⏸ Tạm hoãn',
};
const STATUS_COLOR = {
  working: 'bg-green-500/10 text-green-600 dark:text-green-400',
  long_leave: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  maternity: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  resigned: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  fired: 'bg-red-500/10 text-red-600 dark:text-red-400',
  suspended: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const TABS = [
  { id: 'profile',  icon: User,         label: 'Hồ sơ' },
  { id: 'job',      icon: Briefcase,    label: 'Công việc' },
  { id: 'contract', icon: FileText,     label: 'HĐ Lao động' },
  { id: 'awards',   icon: Award,        label: 'Khen-Phạt' },
  { id: 'extra',    icon: Folder,       label: 'Khác' },
];

function tenure(hireDate) {
  if (!hireDate) return null;
  const h = new Date(hireDate); if (Number.isNaN(h.getTime())) return null;
  const now = new Date();
  const months = (now.getFullYear() - h.getFullYear()) * 12 + (now.getMonth() - h.getMonth());
  if (months < 12) return `${months} tháng`;
  const y = Math.floor(months / 12), m = months % 12;
  return m > 0 ? `${y}.${Math.floor((m / 12) * 10)} năm` : `${y} năm`;
}

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function EmployeeProfile({ recordId, onBack }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const d = await getDoc('employees', recordId, 2);
    setDoc(d);
    setLoading(false);
  };
  useEffect(() => { if (recordId) load(); /* eslint-disable-next-line */ }, [recordId]);

  const liveDoc = useMemo(() => ({ ...doc, ...dirty }), [doc, dirty]);

  const handleSave = async () => {
    if (Object.keys(dirty).length === 0) { setEditMode(false); return; }
    setSaving(true);
    try {
      const patch = {};
      for (const [k, v] of Object.entries(dirty)) {
        if (v === '' || v === null || v === undefined) continue;
        patch[k] = v;
      }
      const r = await fetchPayload(`/employees/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        alert(`Lưu thất bại HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
        return;
      }
      setDirty({});
      setEditMode(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-24 text-slate-500">Đang tải...</div>;
  if (!doc) return <div className="text-center py-24 text-red-500">Không tải được hồ sơ.</div>;

  const e = liveDoc;
  const photoUrl = typeof e.photo === 'object' && e.photo?.filename
    ? `/api/media/file/${encodeURIComponent(e.photo.filename)}`
    : null;
  const managerName = typeof e.manager === 'object' ? e.manager?.fullName : null;
  const userAcc = typeof e.userAccount === 'object' ? e.userAccount : null;
  const tenureStr = tenure(e.hireDate);
  const numAwards = (e.achievements ?? []).filter((a) => a.type === 'reward' || a.type === 'promotion').length;
  const numDiscs = (e.achievements ?? []).filter((a) => a.type === 'discipline').length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-main)]">
          <ArrowLeft size={16} /> Quay lại danh sách Nhân sự
        </button>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <button onClick={printPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5">
                <Printer size={14} /> PDF
              </button>
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-blue-500/40 text-blue-500 hover:bg-blue-500/10">
                <Edit2 size={14} /> Sửa
              </button>
              <DeleteButton
                collection="employees"
                recordId={doc.id}
                recordLabel={doc.fullName ?? doc.employeeCode}
                onDeleted={onBack}
              />
            </>
          ) : (
            <>
              <button onClick={() => { setDirty({}); setEditMode(false); }} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:bg-black/5"><X size={14} /> Huỷ</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-green-500/40 text-green-600 hover:bg-green-500/10 disabled:opacity-40">
                <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-6 flex-wrap">
          {/* Avatar */}
          <div className="shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={e.fullName} className="w-24 h-24 rounded-2xl object-cover border-2 border-white/10 shadow-lg" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-blue-500/30">
                {initialsOf(e.fullName)}
              </div>
            )}
          </div>

          {/* Identity + stats */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-black text-[var(--text-main)]">{e.fullName ?? '(không tên)'}</h2>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  {e.position ?? '—'} · {DEPT_LABEL[e.department] ?? e.department ?? '—'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 font-mono">{e.employeeCode ?? '—'}</p>
              </div>
              {e.status && (
                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[e.status] ?? 'bg-slate-500/10'}`}>
                  {STATUS_LABEL[e.status] ?? e.status}
                </span>
              )}
            </div>

            {/* Mini-stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <Stat label="Thâm niên" value={tenureStr ?? '—'} />
              <Stat label="Lương/tháng" value={e.salary ? `${(e.salary / 1_000_000).toFixed(1)} tr` : '—'} />
              <Stat label="Khen thưởng" value={numAwards} />
              <Stat label="Kỷ luật" value={numDiscs} dangerIfPositive />
            </div>

            {/* Quick contacts */}
            {(e.phone || e.email || e.telegramUserId) && (
              <div className="flex flex-wrap gap-3 mt-5 text-xs text-slate-500">
                {e.phone && <span className="inline-flex items-center gap-1.5"><Phone size={13} />{e.phone}</span>}
                {e.email && <span className="inline-flex items-center gap-1.5"><Mail size={13} />{e.email}</span>}
                {e.telegramUserId && <span className="inline-flex items-center gap-1.5"><MessageSquare size={13} />TG {e.telegramUserId}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card p-0 overflow-hidden">
        <div className="flex border-b border-[var(--border-color)] overflow-x-auto no-scrollbar no-print">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all whitespace-nowrap border-b-2 ${
                tab === t.id
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-slate-500 hover:text-[var(--text-main)]'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'profile' && <ProfileTab e={e} editMode={editMode} setDirty={setDirty} dirty={dirty} />}
          {tab === 'job' && <JobTab e={e} managerName={managerName} userAcc={userAcc} editMode={editMode} setDirty={setDirty} dirty={dirty} />}
          {tab === 'contract' && <ContractTab e={e} editMode={editMode} setDirty={setDirty} dirty={dirty} />}
          {tab === 'awards' && <AwardsTab e={e} />}
          {tab === 'extra' && <ExtraTab e={e} editMode={editMode} setDirty={setDirty} dirty={dirty} />}
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, dangerIfPositive }) {
  const isDanger = dangerIfPositive && Number(value) > 0;
  return (
    <div className="rounded-xl bg-black/[0.025] dark:bg-white/[0.025] px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{label}</div>
      <div className={`text-lg font-black ${isDanger ? 'text-red-500' : 'text-[var(--text-main)]'}`}>{value}</div>
    </div>
  );
}

/* ─── Tab content ─── */

function ProfileTab({ e, editMode, setDirty, dirty }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Field label="Họ tên" value={e.fullName} editKey="fullName" type="text" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      <Field label="Ngày sinh" value={fmtDate(e.dateOfBirth)} editKey="dateOfBirth" type="date" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      <Field label="Giới tính" value={e.gender} editKey="gender" type="select" options={[['male','Nam'],['female','Nữ'],['other','Khác']]} editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      <Field label="CCCD/CMND" value={e.idNumber} editKey="idNumber" type="text" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} mono />
      <Field label="SĐT" value={e.phone} editKey="phone" type="text" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      <Field label="Email" value={e.email} editKey="email" type="text" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      <Field label="Telegram User ID" value={e.telegramUserId} editKey="telegramUserId" type="text" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} mono />
      <Field label="Mã NV" value={e.employeeCode} mono />
      <div className="md:col-span-2">
        <Field label="Địa chỉ thường trú" value={e.address} editKey="address" type="textarea" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      </div>
    </div>
  );
}

function JobTab({ e, managerName, userAcc, editMode, setDirty, dirty }) {
  const DEPT_OPTS = Object.entries(DEPT_LABEL);
  const STATUS_OPTS = Object.entries(STATUS_LABEL);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Field label="Phòng ban" value={DEPT_LABEL[e.department] ?? e.department} editKey="department" type="select" options={DEPT_OPTS} editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      <Field label="Chức vụ" value={e.position} editKey="position" type="text" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      <Field label="Trạng thái" value={STATUS_LABEL[e.status] ?? e.status} editKey="status" type="select" options={STATUS_OPTS} editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      <Field label="Ngày vào làm" value={fmtDate(e.hireDate)} editKey="hireDate" type="date" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      <Field label="Quản lý trực tiếp" value={managerName} />
      <Field label="Account login" value={userAcc?.email} mono />
      <div className="md:col-span-2">
        <Field label="Lương (VND/tháng)" value={e.salary ? Number(e.salary).toLocaleString() : null} editKey="salary" type="number" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      </div>
    </div>
  );
}

function ContractTab({ e, editMode, setDirty, dirty }) {
  const CONTRACT_OPTS = [['probation','Thử việc'],['fixed','Xác định thời hạn'],['indefinite','Không xác định thời hạn'],['contractor','Cộng tác viên'],['intern','Thực tập sinh']];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Loại HĐLĐ" value={e.contractType} editKey="contractType" type="select" options={CONTRACT_OPTS} editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
        <Field label="Hết hạn HĐ" value={fmtDate(e.contractEndDate)} editKey="contractEndDate" type="date" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
      </div>
      {Array.isArray(e.workHistory) && e.workHistory.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Lịch sử công tác trước TLG</h4>
          <div className="space-y-2">
            {e.workHistory.map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/[0.025] dark:bg-white/[0.025] text-sm">
                <div>
                  <div className="font-semibold">{h.company ?? '?'}</div>
                  <div className="text-xs text-slate-500">{h.position ?? ''}</div>
                </div>
                <div className="text-xs text-slate-500 font-mono">{h.fromTo ?? ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AwardsTab({ e }) {
  const list = e.achievements ?? [];
  if (list.length === 0) return <p className="text-sm text-slate-500 text-center py-8">Chưa có khen thưởng / kỷ luật nào.</p>;
  return (
    <div className="space-y-3">
      {list.map((a, i) => {
        const color = a.type === 'reward' ? 'text-yellow-600 bg-yellow-500/10'
                    : a.type === 'discipline' ? 'text-red-600 bg-red-500/10'
                    : a.type === 'promotion' ? 'text-blue-600 bg-blue-500/10'
                    : 'text-slate-600 bg-slate-500/10';
        const icon = a.type === 'reward' ? '🏆' : a.type === 'discipline' ? '⚠' : a.type === 'promotion' ? '📈' : '📝';
        return (
          <div key={i} className="glass-card p-4 flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${color}`}>{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h5 className="font-bold text-sm">{a.title ?? '?'}</h5>
                <span className="text-xs text-slate-500 font-mono shrink-0">{fmtDate(a.date)}</span>
              </div>
              {a.description && <p className="text-sm text-[var(--text-muted)] mt-1">{a.description}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExtraTab({ e, editMode, setDirty, dirty }) {
  const extra = e.extraFields ?? [];
  return (
    <div className="space-y-5">
      {extra.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Thông tin bổ sung</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {extra.map((f, i) => (
              <div key={i} className="p-3 rounded-xl bg-black/[0.025] dark:bg-white/[0.025]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{f.key}</div>
                <div className="text-sm mt-1 break-words">{f.value ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Field label="Ghi chú" value={e.notes} editKey="notes" type="textarea" editMode={editMode} setDirty={setDirty} dirty={dirty} doc={e} />
    </div>
  );
}

/* ─── Field renderer ─── */
function Field({ label, value, editKey, type, options, editMode, setDirty, dirty, doc, mono }) {
  const isEditable = editMode && editKey;
  const current = editKey && dirty && dirty[editKey] !== undefined ? dirty[editKey] : (doc?.[editKey] ?? '');
  const set = (v) => setDirty((d) => ({ ...d, [editKey]: v }));

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
        {isEditable && '✏ '}{label}
      </div>
      {!isEditable ? (
        <div className={`text-sm ${mono ? 'font-mono text-xs' : ''} text-[var(--text-main)] break-words`}>
          {value === null || value === undefined || value === '' ? <span className="text-slate-400">—</span> : value}
        </div>
      ) : type === 'select' ? (
        <select value={String(current)} onChange={(e) => set(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-yellow-300 bg-yellow-50 outline-none">
          <option value="">—</option>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={String(current)} onChange={(e) => set(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm rounded-xl border border-yellow-300 bg-yellow-50 outline-none resize-y" />
      ) : type === 'date' ? (
        <input type="date" value={current ? String(current).slice(0, 10) : ''} onChange={(e) => set(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-yellow-300 bg-yellow-50 outline-none" />
      ) : type === 'number' ? (
        <input type="number" value={String(current)} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 text-sm rounded-xl border border-yellow-300 bg-yellow-50 outline-none" />
      ) : (
        <input type="text" value={String(current)} onChange={(e) => set(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-yellow-300 bg-yellow-50 outline-none" />
      )}
    </div>
  );
}
