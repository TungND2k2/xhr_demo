import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer, Edit2, Save, X } from 'lucide-react';
import { getDoc, fetchPayload } from '../api/payload';
import { printPdf } from '../lib/export';

/**
 * PrintableFormDetail — layout bảng có viền (form Word/Excel TLG) + edit mode.
 *
 * Section schema:
 *   [label, value, opts?]
 *   opts.pre = render trong ô full-row (textarea dài)
 *   opts.mono = font mono
 *   opts.edit = { key, type, options? }  — bật edit cho field
 */
export default function PrintableFormDetail({
  title,
  collection,
  recordId,
  formTitle,
  detailSections,
  headerSummary,
  onBack,
  showSignatures = true, // false để ẩn footer 3 chữ ký (vd công văn)
}) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const d = await getDoc(collection, recordId, 2);
    setDoc(d);
    setLoading(false);
  };

  useEffect(() => { if (recordId) load(); /* eslint-disable-next-line */ }, [collection, recordId]);

  const handleSave = async () => {
    if (Object.keys(dirty).length === 0) { setEditMode(false); return; }
    setSaving(true);
    try {
      const patch = {};
      for (const [k, val] of Object.entries(dirty)) {
        if (val === '' || val === null || val === undefined) continue;
        patch[k] = val;
      }
      const res = await fetchPayload(`/${collection}/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        alert(`Lưu thất bại HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
        return;
      }
      setDirty({});
      setEditMode(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (Object.keys(dirty).length > 0 && !window.confirm('Huỷ thay đổi chưa lưu?')) return;
    setDirty({});
    setEditMode(false);
  };

  if (loading) return <div className="text-center py-24 text-slate-500">Đang tải...</div>;
  if (!doc) return <div className="text-center py-24 text-red-500">Không tải được bản ghi này.</div>;

  const liveDoc = { ...doc, ...dirty };
  const sections = detailSections ? detailSections(liveDoc) : [];
  const summary = headerSummary ? headerSummary(liveDoc) : { title: doc.id, subtitle: null };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-main)]">
          <ArrowLeft size={16} /> Quay lại {title}
        </button>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <button onClick={printPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5">
                <Printer size={14} /> In / PDF
              </button>
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-blue-500/40 text-blue-500 hover:bg-blue-500/10">
                <Edit2 size={14} /> Sửa
              </button>
            </>
          ) : (
            <>
              <button onClick={handleCancel} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:bg-black/5">
                <X size={14} /> Huỷ
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-green-500/40 text-green-600 hover:bg-green-500/10 disabled:opacity-40">
                <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </>
          )}
        </div>
      </div>

      {editMode && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-2 text-xs text-yellow-800 no-print">
          ✏ Đang sửa — chỉ field có ✏ trên label mới sửa được. {Object.keys(dirty).length > 0 && <span className="font-bold">({Object.keys(dirty).length} thay đổi)</span>}
        </div>
      )}

      <div className="form-doc print-area bg-white text-black border-2 border-black mx-auto max-w-[1000px] shadow-lg">
        <div className="border-b-2 border-black px-6 py-4 text-center bg-white">
          <h1 className="text-2xl font-black uppercase tracking-wide">{formTitle ?? title}</h1>
          {summary.title && <p className="text-sm font-bold mt-1">Mã: <span className="font-mono">{summary.title}</span></p>}
          {summary.subtitle && <p className="text-xs text-gray-700 mt-1">{summary.subtitle}</p>}
        </div>

        {sections.map((sec, idx) => (
          <FormSection key={idx} section={sec} doc={liveDoc} editMode={editMode} dirty={dirty} setDirty={setDirty} />
        ))}

        {showSignatures && (
          <div className="border-t-2 border-black px-6 py-6">
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              {['Người tạo', 'Cán bộ quản lý', 'Trưởng phòng'].map((label) => (
                <div key={label}>
                  <div className="font-bold uppercase">{label}</div>
                  <div className="text-[10px] text-gray-600 mb-12">(Ký, ghi rõ họ tên)</div>
                  <div className="border-t border-gray-400 mx-6"></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body { background: white; }
          .form-doc { border-color: black !important; box-shadow: none !important; max-width: 100% !important; }
        }
      `}</style>
    </motion.div>
  );
}

function FormSection({ section, doc, editMode, dirty, setDirty }) {
  const { title, fields, wide, render } = section;
  if (render) {
    return (
      <div>
        <SectionHeader title={title} />
        <div className="border-b border-black px-4 py-3">{render()}</div>
      </div>
    );
  }
  if (wide) {
    return (
      <div>
        <SectionHeader title={title} />
        <table className="w-full border-collapse">
          <tbody>
            {fields.map(([label, value, opts], i) => (
              <tr key={i}>
                <td className="border-r border-b border-black bg-gray-50 px-3 py-2 font-semibold text-xs w-[180px] align-top">
                  {opts?.edit && editMode && '✏ '}{label}
                </td>
                <td className="border-b border-black px-3 py-2 text-sm">
                  <FieldCell value={value} opts={opts} doc={doc} editMode={editMode} dirty={dirty} setDirty={setDirty} fullRow />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const rows = [];
  for (let i = 0; i < fields.length; i += 2) {
    rows.push([fields[i], fields[i + 1] ?? null]);
  }
  return (
    <div>
      <SectionHeader title={title} />
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((pair, i) => (
            <tr key={i}>
              {pair.map((cell, j) => {
                if (!cell) {
                  return (
                    <React.Fragment key={j}>
                      <td className="border-r border-b border-black bg-gray-50 w-[180px]"></td>
                      <td className="border-b border-black"></td>
                    </React.Fragment>
                  );
                }
                const [label, value, opts] = cell;
                const isLast = j === pair.length - 1;
                return (
                  <React.Fragment key={j}>
                    <td className="border-r border-b border-black bg-gray-50 px-3 py-2 font-semibold text-xs w-[180px] align-top">
                      {opts?.edit && editMode && '✏ '}{label}
                    </td>
                    <td className={`${isLast ? '' : 'border-r'} border-b border-black px-3 py-2 text-sm align-top ${opts?.mono && !editMode ? 'font-mono text-xs' : ''}`}>
                      <FieldCell value={value} opts={opts} doc={doc} editMode={editMode} dirty={dirty} setDirty={setDirty} />
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldCell({ value, opts, doc, editMode, dirty, setDirty, fullRow }) {
  const ed = opts?.edit;
  if (!editMode || !ed) {
    if (opts?.pre) return <pre className="font-sans whitespace-pre-wrap m-0">{display(value)}</pre>;
    return display(value);
  }
  const key = ed.key;
  const current = dirty[key] !== undefined ? dirty[key] : (doc[key] ?? '');
  const set = (v) => setDirty((d) => ({ ...d, [key]: v }));
  const cls = `w-full bg-yellow-50 border border-yellow-300 rounded px-2 py-1 text-xs`;

  if (ed.type === 'select') {
    return (
      <select value={String(current)} onChange={(e) => set(e.target.value)} className={cls}>
        <option value="">—</option>
        {ed.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
      </select>
    );
  }
  if (ed.type === 'textarea') {
    return <textarea value={String(current)} onChange={(e) => set(e.target.value)} rows={fullRow ? 4 : 2} className={cls} />;
  }
  if (ed.type === 'date') {
    const dv = current ? String(current).slice(0, 10) : '';
    return <input type="date" value={dv} onChange={(e) => set(e.target.value)} className={cls} />;
  }
  if (ed.type === 'number') {
    return <input type="number" value={String(current)} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} className={cls} />;
  }
  return <input type="text" value={String(current)} onChange={(e) => set(e.target.value)} className={cls} />;
}

function SectionHeader({ title }) {
  return (
    <div className="border-b border-black bg-gray-200 px-4 py-2">
      <h2 className="font-bold text-sm uppercase tracking-wider">{title}</h2>
    </div>
  );
}

function display(v) {
  if (v === null || v === undefined || v === '') return '—';
  return v;
}
