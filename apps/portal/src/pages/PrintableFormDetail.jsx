import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Printer, Edit2, Save, X, FileText } from "lucide-react";
import { getDoc, fetchPayload } from "../api/payload";
import { printPdf } from "../lib/export";

export default function PrintableFormDetail({
  title,
  collection,
  recordId,
  formTitle,
  detailSections,
  headerSummary,
  onBack,
  showSignatures = true,
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (recordId) load(); }, [collection, recordId]);

  const handleSave = async () => {
    if (Object.keys(dirty).length === 0) { setEditMode(false); return; }
    setSaving(true);
    try {
      const patch = {};
      for (const [k, val] of Object.entries(dirty)) {
        if (val === "" || val === null || val === undefined) continue;
        patch[k] = val;
      }
      const res = await fetchPayload(`/${collection}/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        alert(`Luu that bai HTTP ${res.status}`);
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
    if (Object.keys(dirty).length > 0 && !window.confirm("Huy thay doi chua luu?")) return;
    setDirty({});
    setEditMode(false);
  };

  if (loading) return <div className="text-center py-24 text-slate-500">Dang tai...</div>;
  if (!doc) return <div className="text-center py-24 text-red-500">Khong tai duoc ban ghi nay.</div>;

  const liveDoc = { ...doc, ...dirty };
  const sections = detailSections ? detailSections(liveDoc) : [];
  const summary = headerSummary ? headerSummary(liveDoc) : { title: doc.id, subtitle: null };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-[var(--text-main)] transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> QUAY LAI
        </button>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <button onClick={printPdf} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border-color)] hover:border-red-500/30 hover:bg-red-500/5 text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-all shadow-sm">
                <Printer size={14} className="text-red-500" /> In / PDF
              </button>
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-blue-500/40 text-blue-500 hover:bg-blue-500/10 transition-all shadow-sm">
                <Edit2 size={14} /> Chinh sua
              </button>
            </>
          ) : (
            <>
              <button onClick={handleCancel} disabled={saving} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border-color)] hover:bg-black/5 text-slate-500">
                <X size={14} /> Huy bo
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-green-500/40 text-green-600 hover:bg-green-500/10 transition-all disabled:opacity-40">
                <Save size={14} /> {saving ? "Dang luu..." : "Luu thay doi"}
              </button>
            </>
          )}
        </div>
      </div>

      {editMode && (
        <div className="bg-amber-500/10 border border-amber-500/20 backdrop-blur-md rounded-2xl px-5 py-3 text-xs text-amber-600 dark:text-amber-400 no-print flex items-center gap-2 font-semibold">
          <Edit2 size={14} className="animate-pulse text-amber-500 shrink-0" />
          <span>Che do chinh sua. Bam <b>"Luu thay doi"</b> de cap nhat.</span>
          {Object.keys(dirty).length > 0 && <span className="ml-auto bg-amber-500/20 px-2.5 py-1 rounded-lg font-bold shrink-0">({Object.keys(dirty).length} thay doi)</span>}
        </div>
      )}

      <div className="glass-card p-8 shadow-sm no-print">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0 relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 transform -skew-x-12 translate-x-1/2" />
            <FileText size={28} className="relative z-10" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight">{formTitle ?? title}</h2>
                {summary.title && <p className="text-sm text-[var(--text-muted)] font-medium mt-1">Ma: <span className="font-mono font-bold text-blue-500">{summary.title}</span></p>}
                {summary.subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{summary.subtitle}</p>}
              </div>
              {summary.badges && summary.badges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {summary.badges.map((b, i) => <span key={i} className={badgeClass(b.color)}>{b.label}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="no-print space-y-6">
        {sections.map((sec, idx) => {
          if (!sec.fields || sec.fields.length === 0) return null;
          const isWide = sec.wide;
          return (
            <div key={idx} className="glass-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
              <div className="px-6 py-3.5 border-b border-[var(--border-color)] bg-gradient-to-r from-blue-500/[0.04] to-transparent">
                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400">{sec.title}</h3>
              </div>
              <div className="p-6">
                <div className={isWide ? "grid grid-cols-1 md:grid-cols-2 gap-x-10" : "grid grid-cols-1 sm:grid-cols-2 gap-x-10"}>
                  {sec.fields.map(([label, value, opts], i) => {
                    const empty = value === null || value === undefined || value === "";
                    const isPre = opts?.pre;
                    const isLink = React.isValidElement(value);
                    if (isPre || isLink) {
                      return (
                        <div key={i} className="col-span-full space-y-1.5 py-3.5 border-b border-[var(--border-color)] last:border-0">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">{label}</span>
                          {isLink ? <div className="mt-1">{value}</div> : editMode && opts?.edit ? (
                            <FieldEdit opts={opts} doc={liveDoc} dirty={dirty} setDirty={setDirty} fullRow />
                          ) : (
                            <pre className="font-sans whitespace-pre-wrap text-[11px] font-semibold text-[var(--text-main)] leading-relaxed bg-black/[0.015] dark:bg-white/[0.015] rounded-xl p-4 m-0 border border-[var(--border-color)]">{empty ? "—" : value}</pre>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 py-3 border-b border-[var(--border-color)] last:border-0">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">{label}</span>
                        {editMode && opts?.edit ? (
                          <div className="flex-1 max-w-[55%]"><FieldEdit opts={opts} doc={liveDoc} dirty={dirty} setDirty={setDirty} /></div>
                        ) : (
                          <span className={`text-xs font-bold text-right break-words ${opts?.mono ? "font-mono text-[10px] text-blue-500" : "text-[var(--text-main)]"}`}>
                            {empty ? <span className="text-slate-300 dark:text-slate-600">—</span> : value}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="form-doc print-area bg-white text-black border border-gray-300 mx-auto max-w-[1000px]" style={{ display: "none" }}>
        <div className="border-b-2 border-black px-6 py-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-widest">{formTitle ?? title}</h1>
          {summary.title && <p className="text-xs font-bold mt-1 font-mono">Ma: {summary.title}</p>}
          {summary.subtitle && <p className="text-xs text-gray-700 mt-0.5">{summary.subtitle}</p>}
        </div>
        {sections.map((sec, idx) => <FormSection key={idx} section={sec} doc={liveDoc} editMode={false} dirty={dirty} setDirty={setDirty} />)}
        {showSignatures && (
          <div className="border-t-2 border-black px-6 py-6">
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              {["Nguoi tao", "Can bo quan ly", "Truong phong"].map((label) => (
                <div key={label}>
                  <div className="font-bold uppercase">{label}</div>
                  <div className="text-[10px] text-gray-600 mb-12">(Ky, ghi ro ho ten)</div>
                  <div className="border-t border-gray-400 mx-6"></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`@media print { .no-print { display: none !important; } .form-doc { display: block !important; border-color: black !important; max-width: 100% !important; } }`}</style>
    </motion.div>
  );
}

function FieldEdit({ opts, doc, dirty, setDirty, fullRow }) {
  const ed = opts?.edit;
  if (!ed) return null;
  const key = ed.key;
  const current = dirty[key] !== undefined ? dirty[key] : (doc[key] ?? "");
  const set = (v) => setDirty((d) => ({ ...d, [key]: v }));
  const cls = "portal-edit-input";
  if (ed.type === "select") return <select value={String(current)} onChange={(e) => set(e.target.value)} className={cls}><option value="">—</option>{ed.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}</select>;
  if (ed.type === "textarea") return <textarea value={String(current)} onChange={(e) => set(e.target.value)} rows={fullRow ? 4 : 2} className={cls} />;
  if (ed.type === "date") { const dv = current ? String(current).slice(0, 10) : ""; return <input type="date" value={dv} onChange={(e) => set(e.target.value)} className={cls} />; }
  if (ed.type === "number") return <input type="number" value={String(current)} onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))} className={cls} />;
  return <input type="text" value={String(current)} onChange={(e) => set(e.target.value)} className={cls} />;
}

function FormSection({ section, doc }) {
  const { title, fields, wide, render } = section;
  if (render) return <div><SectionHeader title={title} /><div className="border-b border-black px-4 py-3">{render()}</div></div>;
  if (wide) {
    return (
      <div><SectionHeader title={title} />
        <table className="w-full border-collapse"><tbody>
          {fields.map(([label, value, opts], i) => (
            <tr key={i}>
              <td className="border-r border-b border-black bg-gray-50 px-3 py-2 font-semibold text-xs w-[180px] align-top">{label}</td>
              <td className="border-b border-black px-3 py-2 text-sm">{React.isValidElement(value) ? value : opts?.pre ? <pre className="font-sans whitespace-pre-wrap m-0">{fmtDisplay(value)}</pre> : fmtDisplay(value)}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    );
  }
  const rows = [];
  for (let i = 0; i < fields.length; i += 2) rows.push([fields[i], fields[i + 1] ?? null]);
  return (
    <div><SectionHeader title={title} />
      <table className="w-full border-collapse"><tbody>
        {rows.map((pair, i) => (
          <tr key={i}>{pair.map((cell, j) => {
            if (!cell) return <React.Fragment key={j}><td className="border-r border-b border-black bg-gray-50 w-[180px]"></td><td className="border-b border-black"></td></React.Fragment>;
            const [label, value, opts] = cell;
            const isLast = j === pair.length - 1;
            return <React.Fragment key={j}><td className="border-r border-b border-black bg-gray-50 px-3 py-2 font-semibold text-xs w-[180px] align-top">{label}</td><td className={`${isLast ? "" : "border-r"} border-b border-black px-3 py-2 text-sm align-top ${opts?.mono ? "font-mono text-xs" : ""}`}>{fmtDisplay(value)}</td></React.Fragment>;
          })}</tr>
        ))}
      </tbody></table>
    </div>
  );
}

function SectionHeader({ title }) {
  return <div className="border-b border-black bg-gray-100 px-4 py-2"><h2 className="font-bold text-xs uppercase tracking-widest text-gray-700">{title}</h2></div>;
}

function badgeClass(color) {
  switch (color) {
    case "green": return "badge-green";
    case "amber": return "badge-amber";
    case "red": return "badge-red";
    case "cyan": return "badge-cyan";
    case "purple": return "badge-purple";
    case "blue": return "badge-blue";
    default: return "badge-slate";
  }
}

function fmtDisplay(v) {
  if (v === null || v === undefined || v === "") return "—";
  return v;
}
