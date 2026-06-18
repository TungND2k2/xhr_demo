import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer, Edit2, Save, X } from 'lucide-react';
import { getDoc, fetchPayload } from '../api/payload';
import { printPdf } from '../lib/export';
import RowEditor from '../components/RowEditor';
import DeleteButton from '../components/DeleteButton';

const EDU_COLS = [
  { key: 'range',   label: 'Bắt đầu - Kết thúc', width: '1.2fr' },
  { key: 'school',  label: 'Tên trường',         width: '2fr' },
  { key: 'major',   label: 'Chuyên ngành',       width: '1.5fr' },
  { key: 'years',   label: 'Số năm',             width: '0.8fr' },
  { key: 'jp',      label: 'Học tiếng Nhật',     width: '1fr' },
];
const WORK_COLS = [
  { key: 'range',    label: 'Bắt đầu - Kết thúc',  width: '1.2fr' },
  { key: 'company',  label: 'Tên công ty',         width: '2fr' },
  { key: 'industry', label: 'Ngành nghề',          width: '1.2fr' },
  { key: 'place',    label: 'Địa điểm',            width: '1.2fr' },
  { key: 'salary',   label: 'Lương/tháng',         width: '1fr' },
  { key: 'years',    label: 'Số năm',              width: '0.7fr' },
];
const FAMILY_COLS = [
  { key: 'relation', label: 'Quan hệ',     width: '1fr' },
  { key: 'name',     label: 'Họ tên',      width: '1.8fr' },
  { key: 'age',      label: 'Tuổi',        width: '0.6fr' },
  { key: 'place',    label: 'Địa điểm',    width: '1.2fr' },
  { key: 'job',      label: 'Nghề nghiệp', width: '1.2fr' },
  { key: 'income',   label: 'Thu nhập',    width: '1fr' },
];

// Schema: tên field trong submission → Worker doc field + kiểu input
// Chỉ field nào có "worker" mới editable + save (PATCH Worker).
const EDITABLE = {
  fullName:        { worker: 'fullName',           type: 'text' },
  katakanaName:    { type: 'text' },               // submission only — em vẫn cho edit, save về submission
  gender:          { worker: 'gender',             type: 'select', options: [['male','Nam'],['female','Nữ'],['other','Khác']] },
  dateOfBirth:     { worker: 'dob',                type: 'date' },
  age:             { type: 'number' },
  heightCm:        { worker: 'height',             type: 'number' },
  weightKg:        { worker: 'weight',             type: 'number' },
  idNumber:        { worker: 'nationalId',         type: 'text' },
  idIssuedDate:    { worker: 'nationalIdIssuedAt', type: 'date' },
  tattoo:          { type: 'text' },
  eyeSightLeft:    { type: 'text' },
  eyeSightRight:   { type: 'text' },
  colorBlind:      { type: 'select', options: [['yes','Có'],['no','Không']] },
  bloodTypeBP:     { type: 'text' },
  drinker:         { type: 'select', options: [['yes','Có'],['no','Không']] },
  smoker:          { type: 'select', options: [['yes','Có'],['no','Không']] },
  handDominant:    { type: 'select', options: [['right','Phải'],['left','Trái'],['both','Cả hai']] },
  healthCheck:     { type: 'text' },
  maritalStatus:   { worker: 'maritalStatus',      type: 'select', options: [['single','Độc thân'],['married','Đã kết hôn'],['divorced','Ly hôn'],['widowed','Goá']] },
  religion:        { type: 'text' },
  highestDegree:   { worker: 'education',          type: 'text' },
  address:         { worker: 'address',            type: 'textarea' },
  hasChildren:     { type: 'select', options: [['yes','Có'],['no','Không']] },
  travelAbroad:    { type: 'textarea' },
  visaJapanBefore: { type: 'select', options: [['yes','Có'],['no','Chưa']] },
  criminalRecord:  { type: 'select', options: [['yes','Có'],['no','Không']] },
  orderReason:     { type: 'textarea' },
  strengths:       { type: 'textarea' },
  weaknesses:      { type: 'textarea' },
  hobbies:         { type: 'textarea' },
  expertise:       { type: 'textarea' },
  japanReason:     { type: 'textarea' },
  targetAmountAfter3y: { type: 'number' },
  planAfterReturn: { type: 'textarea' },
  relativeInJapan: { type: 'textarea' },
  consentFrom:     { type: 'text' },
  consentDuration: { type: 'text' },
  enrollmentDate:  { type: 'date' },
  applicationDate: { type: 'date' },
  guarantorRelation: { type: 'text' },
  guarantorName:   { type: 'text' },
  personalPhone:   { worker: 'phone',              type: 'text' },
  guarantorPhone:  { type: 'text' },
  managerName:     { type: 'text' },
  managerPhone:    { type: 'text' },
  orderCode:       { type: 'text' },
  interviewDate:   { type: 'date' },
  learningSource:  { type: 'text' },
  learningEntrance:{ type: 'text' },
  educationHistory:{ type: 'textarea' },
  workHistory:     { type: 'textarea' },
  familyMembers:   { type: 'textarea' },
};

export default function WorkerHSNForm({ recordId, onBack }) {
  const [worker, setWorker] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [formInviteId, setFormInviteId] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState({}); // { fieldName: newValue }
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const w = await getDoc('workers', recordId, 2);
    setWorker(w);
    try {
      const res = await fetchPayload(`/form-invites?where[worker][equals]=${w.id}&limit=1&depth=2&sort=-createdAt`);
      if (res.ok) {
        const j = await res.json();
        const inv = j.docs?.[0];
        setFormInviteId(inv?.id ?? null);
        const sub = typeof inv?.submission === 'object' ? inv.submission : null;
        if (sub) setSubmission(sub);
        if (typeof inv?.form === 'object') setFormFields(inv.form.fields ?? []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { if (recordId) load(); /* eslint-disable-next-line */ }, [recordId]);

  const labelMap = useMemo(() => new Map(formFields.filter((f) => f && f.name).map((f) => [f.name, f])), [formFields]);
  const subMap = useMemo(() => new Map((submission?.submissionData ?? []).map((sd) => [sd.field, sd.value])), [submission]);

  // Get raw value (string) — dirty first, then submission, then worker
  const raw = (fieldName, workerKey) => {
    if (dirty[fieldName] !== undefined) return dirty[fieldName];
    const sub = subMap.get(fieldName);
    if (sub !== undefined && sub !== null && sub !== '') return sub;
    if (workerKey && worker?.[workerKey] !== undefined && worker?.[workerKey] !== null && worker?.[workerKey] !== '') return worker[workerKey];
    return '';
  };

  // Display value (translate radio/select label, format date)
  const v = (fieldName, workerKey) => {
    const r = raw(fieldName, workerKey);
    if (r === '' || r === null || r === undefined) return '';
    const cfg = EDITABLE[fieldName];
    if (cfg?.options) {
      const opt = cfg.options.find(([val]) => val === String(r));
      if (opt) return opt[1];
    }
    return r;
  };

  const fmtD = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return val;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  // Renderer cho 1 field — view = text, edit = input/select
  const F = (fieldName, workerKey, opts = {}) => {
    const cfg = EDITABLE[fieldName];
    if (!editMode || !cfg) {
      // View mode hoặc field không editable
      const val = v(fieldName, workerKey);
      if (cfg?.type === 'date') return fmtD(raw(fieldName, workerKey));
      return val;
    }
    // Edit mode + editable
    const current = String(raw(fieldName, workerKey) ?? '');
    const set = (newVal) => setDirty((d) => ({ ...d, [fieldName]: newVal }));
    const cls = 'w-full bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-xs';

    if (cfg.type === 'select') {
      return (
        <select value={current} onChange={(e) => set(e.target.value)} className={cls}>
          <option value="">—</option>
          {cfg.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
      );
    }
    if (cfg.type === 'textarea') {
      return <textarea value={current} onChange={(e) => set(e.target.value)} rows={opts.rows ?? 2} className={cls} />;
    }
    if (cfg.type === 'date') {
      const dateVal = current ? new Date(current).toISOString().slice(0, 10) : '';
      return <input type="date" value={dateVal} onChange={(e) => set(e.target.value)} className={cls} />;
    }
    if (cfg.type === 'number') {
      return <input type="number" value={current} onChange={(e) => set(e.target.value)} className={cls} />;
    }
    return <input type="text" value={current} onChange={(e) => set(e.target.value)} className={cls} />;
  };

  const parseRows = (txt) => txt ? String(txt).split(/<br\s*\/?>|\n/).map((s) => s.trim()).filter(Boolean) : [];
  const splitCells = (rowStr) => rowStr.split('|').map((c) => c.trim());

  const handleSave = async () => {
    setSaving(true);
    try {
      // Split dirty: Worker fields vs submission fields
      const workerPatch = {};
      const subPatch = {}; // fieldName → newValue
      for (const [field, val] of Object.entries(dirty)) {
        if (val === '' || val === null) continue;
        const cfg = EDITABLE[field];
        if (cfg?.worker) {
          // Convert: number type
          if (cfg.type === 'number') workerPatch[cfg.worker] = Number(val);
          else workerPatch[cfg.worker] = val;
        } else {
          subPatch[field] = val;
        }
      }

      // 1. PATCH worker
      if (Object.keys(workerPatch).length > 0) {
        const r = await fetchPayload(`/workers/${worker.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workerPatch),
        });
        if (!r.ok) {
          alert('Lưu Worker thất bại: HTTP ' + r.status);
        }
      }

      // 2. PATCH form-submission (replace submissionData entries)
      if (Object.keys(subPatch).length > 0 && submission?.id) {
        const next = [...(submission.submissionData ?? [])];
        for (const [field, val] of Object.entries(subPatch)) {
          const idx = next.findIndex((sd) => sd.field === field);
          if (idx >= 0) next[idx] = { ...next[idx], value: val };
          else next.push({ field, value: val });
        }
        const r = await fetchPayload(`/form-submissions/${submission.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionData: next }),
        });
        if (!r.ok) alert('Lưu form-submission thất bại: HTTP ' + r.status);
      }

      setDirty({});
      setEditMode(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (Object.keys(dirty).length > 0 && !window.confirm('Huỷ bỏ thay đổi chưa lưu?')) return;
    setDirty({});
    setEditMode(false);
  };

  if (loading) return <div className="text-center py-24 text-slate-500">Đang tải...</div>;
  if (!worker) return <div className="text-center py-24 text-red-500">Không tải được hồ sơ.</div>;

  const educationRows = parseRows(raw('educationHistory'));
  const workRows = parseRows(raw('workHistory'));
  const familyRows = parseRows(raw('familyMembers'));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-main)] transition-colors">
          <ArrowLeft size={16} /> Quay lại danh sách LĐ
        </button>
        <div className="flex gap-2">
          {!editMode && (
            <>
              <button onClick={printPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
                <Printer size={14} /> In / PDF
              </button>
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-blue-500/40 text-blue-500 hover:bg-blue-500/10 transition-all">
                <Edit2 size={14} /> Sửa
              </button>
              <DeleteButton
                collection="workers"
                recordId={worker.id}
                recordLabel={worker.fullName ?? worker.workerCode}
                onDeleted={onBack}
              />
            </>
          )}
          {editMode && (
            <>
              <button onClick={handleCancel} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-red-500/40 hover:bg-red-500/5 transition-all">
                <X size={14} /> Huỷ
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-green-500/40 text-green-600 hover:bg-green-500/10 transition-all disabled:opacity-40">
                <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </>
          )}
        </div>
      </div>

      {editMode && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-2 text-xs text-yellow-800 no-print">
          ✏ Chế độ chỉnh sửa — ô đang được sửa có viền vàng. Bấm "Lưu thay đổi" để PATCH lên DB.
          {Object.keys(dirty).length > 0 && <span className="ml-2 font-bold">({Object.keys(dirty).length} field thay đổi)</span>}
        </div>
      )}

      <div className="form-doc bg-white text-black border-2 border-black mx-auto max-w-[1100px] shadow-lg print-area">
        <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            {Array.from({ length: 22 }).map((_, i) => <col key={i} style={{ width: `${100 / 22}%` }} />)}
          </colgroup>
          <tbody>
            <tr><td colSpan={22} className="text-center font-black text-xl py-3 border-b-2 border-black uppercase">SƠ YẾU LÝ LỊCH THỰC TẬP SINH</td></tr>

            {/* Header */}
            <tr>
              <td colSpan={22} className="border border-black px-2 py-1 font-bold">
                ĐƠN HÀNG ĐĂNG KÝ: <span className="font-normal">{F('orderCode')}</span>
              </td>
            </tr>
            <tr>
              <td colSpan={10} className="border border-black px-2 py-1 font-bold">Ngày thi tuyển: <span className="font-normal">{F('interviewDate')}</span></td>
              <td colSpan={4} className="border border-black bg px-2 py-1 font-semibold">Học nguồn</td>
              <td colSpan={3} className="border border-black px-2 py-1">{F('learningSource')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Học thi tuyển</td>
              <td colSpan={3} className="border border-black px-2 py-1">{F('learningEntrance')}</td>
            </tr>

            <tr>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Họ tên</td>
              <td colSpan={7} className="border border-black px-2 py-1 font-bold">{F('fullName', 'fullName')}</td>
              <td colSpan={1} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Katakana</td>
              <td colSpan={2} className="border border-black px-2 py-1">{F('katakanaName')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Giới tính</td>
              <td colSpan={4} className="border border-black px-2 py-1">{F('gender', 'gender')}</td>
              <td colSpan={4} rowSpan={6} className="border border-black text-center bg-gray-50">Ảnh 3x4<br /><span className="text-[10px] text-gray-500">(dán ảnh)</span></td>
            </tr>

            <tr>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Ngày sinh</td>
              <td colSpan={7} className="border border-black px-2 py-1">{F('dateOfBirth', 'dob')}</td>
              <td colSpan={1} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Tuổi</td>
              <td colSpan={2} className="border border-black px-2 py-1">{F('age')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Chiều cao / Cân nặng</td>
              <td colSpan={2} className="border border-black px-2 py-1">{F('heightCm', 'height')} cm</td>
              <td colSpan={2} className="border border-black px-2 py-1">{F('weightKg', 'weight')} kg</td>
            </tr>

            <tr>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Số CMND/CCCD</td>
              <td colSpan={7} className="border border-black px-2 py-1">{F('idNumber', 'nationalId')}</td>
              <td colSpan={1} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Ngày cấp</td>
              <td colSpan={2} className="border border-black px-2 py-1">{F('idIssuedDate', 'nationalIdIssuedAt')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Hình xăm</td>
              <td colSpan={4} className="border border-black px-2 py-1">{F('tattoo')}</td>
            </tr>

            <tr>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Thị lực</td>
              <td colSpan={1} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Trái</td>
              <td colSpan={3} className="border border-black px-2 py-1">{F('eyeSightLeft')}</td>
              <td colSpan={1} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Phải</td>
              <td colSpan={3} className="border border-black px-2 py-1">{F('eyeSightRight')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Mù màu</td>
              <td colSpan={2} className="border border-black px-2 py-1">{F('colorBlind')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Nhóm máu/HA</td>
              <td colSpan={2} className="border border-black px-2 py-1">{F('bloodTypeBP')}</td>
            </tr>

            <tr>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Uống rượu</td>
              <td colSpan={3} className="border border-black px-2 py-1">{F('drinker')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Hút thuốc</td>
              <td colSpan={4} className="border border-black px-2 py-1">{F('smoker')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Khám SK</td>
              <td colSpan={5} className="border border-black px-2 py-1">{F('healthCheck')}</td>
            </tr>

            <tr>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Hôn nhân</td>
              <td colSpan={3} className="border border-black px-2 py-1">{F('maritalStatus', 'maritalStatus')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Tôn giáo</td>
              <td colSpan={2} className="border border-black px-2 py-1">{F('religion')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Tay thuận</td>
              <td colSpan={2} className="border border-black px-2 py-1">{F('handDominant')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Bằng cấp</td>
              <td colSpan={3} className="border border-black px-2 py-1">{F('highestDegree', 'education')}</td>
            </tr>

            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Địa chỉ thường trú</td>
              <td colSpan={19} className="border border-black px-2 py-1">{F('address', 'address', { rows: 2 })}</td>
            </tr>

            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Đã có con hay chưa</td>
              <td colSpan={6} className="border border-black px-2 py-1">{F('hasChildren')}</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Đã từng đi nước ngoài</td>
              <td colSpan={10} className="border border-black px-2 py-1">{F('travelAbroad', null, { rows: 2 })}</td>
            </tr>

            {/* Education table */}
            <tr><td colSpan={22} className="border border-black bg-gray-200 px-2 py-1 font-bold uppercase text-center">Quá trình học tập</td></tr>
            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Bắt đầu</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Kết thúc</td>
              <td colSpan={6} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Tên trường</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Số năm</td>
              <td colSpan={4} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Chuyên ngành</td>
              <td colSpan={4} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Học tiếng Nhật</td>
            </tr>
            {editMode ? (
              <tr><td colSpan={22} className="border border-black px-2 py-1">
                <RowEditor
                  cols={EDU_COLS}
                  value={String(raw('educationHistory') ?? '')}
                  onChange={(v) => setDirty((d) => ({ ...d, educationHistory: v }))}
                  compact
                />
              </td></tr>
            ) : educationRows.length === 0 ? (
              <tr><td colSpan={22} className="border border-black px-2 py-3 text-center text-gray-400 italic">(chưa có dữ liệu)</td></tr>
            ) : (
              educationRows.map((row, i) => {
                const c = splitCells(row);
                return (
                  <tr key={i}>
                    <td colSpan={3} className="border border-black px-2 py-1 text-[10px]">{c[0] ?? ''}</td>
                    <td colSpan={3} className="border border-black px-2 py-1 text-[10px]">{c[1] ?? ''}</td>
                    <td colSpan={6} className="border border-black px-2 py-1 text-[10px]">{c[2] ?? ''}</td>
                    <td colSpan={2} className="border border-black px-2 py-1 text-[10px]">{c[3] ?? ''}</td>
                    <td colSpan={4} className="border border-black px-2 py-1 text-[10px]">{c[4] ?? ''}</td>
                    <td colSpan={4} className="border border-black px-2 py-1 text-[10px]">{c[5] ?? ''}</td>
                  </tr>
                );
              })
            )}

            <tr>
              <td colSpan={6} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Đã từng xin visa Nhật / nộp hồ sơ du học?</td>
              <td colSpan={5} className="border border-black px-2 py-1">{F('visaJapanBefore')}</td>
              <td colSpan={6} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Có tiền án tiền sự không?</td>
              <td colSpan={5} className="border border-black px-2 py-1">{F('criminalRecord')}</td>
            </tr>

            {/* Work table */}
            <tr><td colSpan={22} className="border border-black bg-gray-200 px-2 py-1 font-bold uppercase text-center">Quá trình công tác</td></tr>
            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Bắt đầu</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Kết thúc</td>
              <td colSpan={5} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Tên công ty</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Số năm</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Ngành nghề</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Địa điểm</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Lương/tháng</td>
            </tr>
            {editMode ? (
              <tr><td colSpan={22} className="border border-black px-2 py-1">
                <RowEditor
                  cols={WORK_COLS}
                  value={String(raw('workHistory') ?? '')}
                  onChange={(v) => setDirty((d) => ({ ...d, workHistory: v }))}
                  compact
                />
              </td></tr>
            ) : workRows.length === 0 ? (
              <tr><td colSpan={22} className="border border-black px-2 py-3 text-center text-gray-400 italic">(chưa có dữ liệu)</td></tr>
            ) : (
              workRows.map((row, i) => {
                const c = splitCells(row);
                return (
                  <tr key={i}>
                    <td colSpan={3} className="border border-black px-2 py-1 text-[10px]">{c[0] ?? ''}</td>
                    <td colSpan={3} className="border border-black px-2 py-1 text-[10px]">{c[1] ?? ''}</td>
                    <td colSpan={5} className="border border-black px-2 py-1 text-[10px]">{c[2] ?? ''}</td>
                    <td colSpan={2} className="border border-black px-2 py-1 text-[10px]">{c[5] ?? ''}</td>
                    <td colSpan={3} className="border border-black px-2 py-1 text-[10px]">{c[3] ?? ''}</td>
                    <td colSpan={3} className="border border-black px-2 py-1 text-[10px]">{c[4] ?? ''}</td>
                    <td colSpan={3} className="border border-black px-2 py-1 text-[10px]">{c[5] ?? ''}</td>
                  </tr>
                );
              })
            )}

            {/* Định hướng */}
            <tr><td colSpan={4} className="border border-black bg px-2 py-1 font-semibold">Lý do chọn đơn hàng</td><td colSpan={18} className="border border-black px-2 py-1">{F('orderReason', null, { rows: 2 })}</td></tr>
            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Điểm mạnh</td><td colSpan={8} className="border border-black px-2 py-1">{F('strengths', null, { rows: 2 })}</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Điểm yếu</td><td colSpan={8} className="border border-black px-2 py-1">{F('weaknesses', null, { rows: 2 })}</td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Sở thích</td><td colSpan={8} className="border border-black px-2 py-1">{F('hobbies', null, { rows: 2 })}</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Chuyên môn xuất sắc</td><td colSpan={8} className="border border-black px-2 py-1">{F('expertise', null, { rows: 2 })}</td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Lý do đi Nhật</td><td colSpan={8} className="border border-black px-2 py-1">{F('japanReason', null, { rows: 2 })}</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Mong muốn sau 3 năm</td>
              <td colSpan={8} className="border border-black px-2 py-1">{editMode ? F('targetAmountAfter3y') : (v('targetAmountAfter3y') ? Number(v('targetAmountAfter3y')).toLocaleString() + ' VND' : '')}</td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Dự định về nước</td><td colSpan={8} className="border border-black px-2 py-1">{F('planAfterReturn', null, { rows: 2 })}</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Người quen tại Nhật</td><td colSpan={8} className="border border-black px-2 py-1">{F('relativeInJapan', null, { rows: 2 })}</td>
            </tr>

            {/* Family */}
            <tr><td colSpan={22} className="border border-black bg-gray-200 px-2 py-1 font-bold uppercase text-center">Gia đình (sống cùng hộ khẩu)</td></tr>
            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Quan hệ</td>
              <td colSpan={6} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Họ tên</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Tuổi</td>
              <td colSpan={4} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Địa điểm</td>
              <td colSpan={4} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Nghề nghiệp</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold text-[10px]">Thu nhập</td>
            </tr>
            {editMode ? (
              <tr><td colSpan={22} className="border border-black px-2 py-1">
                <RowEditor
                  cols={FAMILY_COLS}
                  value={String(raw('familyMembers') ?? '')}
                  onChange={(v) => setDirty((d) => ({ ...d, familyMembers: v }))}
                  compact
                />
              </td></tr>
            ) : familyRows.length === 0 ? (
              <tr><td colSpan={22} className="border border-black px-2 py-3 text-center text-gray-400 italic">(chưa có dữ liệu)</td></tr>
            ) : (
              familyRows.map((row, i) => {
                const c = splitCells(row);
                return (
                  <tr key={i}>
                    <td colSpan={3} className="border border-black px-2 py-1 text-[10px]">{c[0] ?? ''}</td>
                    <td colSpan={6} className="border border-black px-2 py-1 text-[10px]">{c[1] ?? ''}</td>
                    <td colSpan={2} className="border border-black px-2 py-1 text-[10px]">{c[2] ?? ''}</td>
                    <td colSpan={4} className="border border-black px-2 py-1 text-[10px]">{c[3] ?? ''}</td>
                    <td colSpan={4} className="border border-black px-2 py-1 text-[10px]">{c[4] ?? ''}</td>
                    <td colSpan={3} className="border border-black px-2 py-1 text-[10px]">{c[5] ?? ''}</td>
                  </tr>
                );
              })
            )}

            {/* Consent + dates */}
            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Đồng ý của</td>
              <td colSpan={4} className="border border-black px-2 py-1">{F('consentFrom')}</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Thời gian đồng ý</td>
              <td colSpan={3} className="border border-black px-2 py-1">{F('consentDuration')}</td>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Ngày nhập học</td>
              <td colSpan={2} className="border border-black px-2 py-1">{F('enrollmentDate')}</td>
              <td colSpan={2} className="border border-black bg px-2 py-1 font-semibold">Ngày ứng tuyển</td>
              <td colSpan={2} className="border border-black px-2 py-1">{F('applicationDate')}</td>
            </tr>

            {/* Bảo lãnh */}
            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Người bảo lãnh</td>
              <td colSpan={4} className="border border-black px-2 py-1">{F('guarantorRelation')}</td>
              <td colSpan={4} className="border border-black bg px-2 py-1 font-semibold">Tên người bảo lãnh</td>
              <td colSpan={11} className="border border-black px-2 py-1">{F('guarantorName')}</td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">SĐT cá nhân</td>
              <td colSpan={8} className="border border-black px-2 py-1">{F('personalPhone', 'phone')}</td>
              <td colSpan={4} className="border border-black bg px-2 py-1 font-semibold">SĐT người bảo lãnh</td>
              <td colSpan={7} className="border border-black px-2 py-1">{F('guarantorPhone')}</td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black bg px-2 py-1 font-semibold">Cán bộ quản lý</td>
              <td colSpan={8} className="border border-black px-2 py-1">{F('managerName')}</td>
              <td colSpan={4} className="border border-black bg px-2 py-1 font-semibold">SĐT cán bộ QL</td>
              <td colSpan={7} className="border border-black px-2 py-1">{F('managerPhone')}</td>
            </tr>

            {/* Signatures */}
            <tr>
              <td colSpan={9} className="border border-black text-center py-1 font-bold uppercase text-[11px]">
                Người soát form<br /><span className="text-[10px] font-normal italic">(Ký, ghi rõ họ và tên)</span>
                <div className="h-16"></div>
              </td>
              <td colSpan={4} className="border border-black text-center py-1 font-bold uppercase text-[11px]">
                Cán bộ quản lý<br /><span className="text-[10px] font-normal italic">(Ký, ghi rõ họ và tên)</span>
                <div className="h-16"></div>
              </td>
              <td colSpan={9} className="border border-black text-center py-1 font-bold uppercase text-[11px]">
                Thực tập sinh<br /><span className="text-[10px] font-normal italic">(Ký, ghi rõ họ và tên)</span>
                <div className="h-16"></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <style>{`
        .form-doc td.bg { background: #f3f4f6; }
        @media print {
          body { background: white; }
          .form-doc { border-color: black !important; box-shadow: none !important; max-width: 100% !important; }
          .form-doc td { font-size: 9px !important; padding: 2px 4px !important; }
        }
      `}</style>
    </motion.div>
  );
}
