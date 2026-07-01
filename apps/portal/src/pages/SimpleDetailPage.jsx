import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer } from 'lucide-react';
import { getDoc } from '../api/payload';
import { printPdf } from '../lib/export';
import DeleteButton from '../components/DeleteButton';

/**
 * SimpleDetailPage — generic detail view cho 1 record bất kỳ.
 */
export default function SimpleDetailPage({
  title,
  collection,
  recordId,
  detailSections,
  headerSummary,
  onBack,
  displayKey,
}) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    getDoc(collection, recordId, 2).then((d) => {
      setDoc(d);
      setLoading(false);
    });
  }, [collection, recordId]);

  if (loading) return <div className="text-center py-24 text-slate-500">Đang tải...</div>;
  if (!doc) return <div className="text-center py-24 text-red-500">Không tải được bản ghi này.</div>;

  const rawSections = detailSections && detailSections(doc).length > 0
    ? detailSections(doc)
    : autoSections(doc);

  const isEmpty = (v) => v === null || v === undefined || v === '' || v === '—';
  const sections = rawSections
    .map((sec) => {
      if (sec.render) return sec;
      const filtered = (sec.fields ?? []).filter(([, value]) => !isEmpty(value));
      return { ...sec, fields: filtered };
    })
    .filter((sec) => sec.render || (sec.fields && sec.fields.length > 0));

  const summary = headerSummary
    ? headerSummary(doc)
    : { title: defaultHeader(doc, displayKey), subtitle: null, badges: [] };

  const narrowSections = sections.filter((s) => !s.wide);
  const wideSections = sections.filter((s) => s.wide);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6 print-area">
      {/* Top action bar */}
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-[var(--text-main)] transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> QUAY LẠI
        </button>
        <div className="flex items-center gap-2">
          <button onClick={printPdf} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border-color)] hover:border-red-500/30 hover:bg-red-500/5 text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-all shadow-sm">
            <Printer size={14} className="text-red-500" /> Xuất PDF
          </button>
          <DeleteButton
            collection={collection}
            recordId={doc.id}
            recordLabel={summary.title}
            onDeleted={onBack}
          />
        </div>
      </div>

      {/* Hero header */}
      <div className="glass-card p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="flex items-start gap-6 flex-wrap">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-500/30 shrink-0 select-none relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 transform -skew-x-12 translate-x-1/2" />
            <span className="relative z-10">{(summary.title ?? '?').slice(0, 1).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight break-words">{summary.title}</h2>
                {summary.subtitle && (
                  <p className="text-sm text-[var(--text-muted)] font-medium mt-1">{summary.subtitle}</p>
                )}
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-mono uppercase tracking-widest">{collection} · {doc.id?.slice(-8)}</p>
              </div>
              {summary.badges && summary.badges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {summary.badges.map((b, i) => (
                    <span key={i} className={badgeClass(b.color)}>{b.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2-column narrow sections */}
      {narrowSections.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {narrowSections.map((sec, idx) => (
            <SectionCard key={idx} sec={sec} />
          ))}
        </div>
      )}

      {/* Full-width wide sections */}
      {wideSections.length > 0 && (
        <div className="space-y-6">
          {wideSections.map((sec, idx) => (
            <SectionCard key={idx} sec={sec} wide />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function SectionCard({ sec, wide }) {
  return (
    <div className="glass-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="px-6 py-3.5 border-b border-[var(--border-color)] bg-gradient-to-r from-blue-500/[0.04] to-transparent flex items-center gap-2">
        {sec.icon && <sec.icon size={14} className="text-blue-500" />}
        <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400">{sec.title}</h3>
      </div>
      <div className="p-6">
        {sec.render ? (
          sec.render()
        ) : (
          <div className={wide ? 'grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1' : 'space-y-0'}>
            {sec.fields.map(([label, value, opts], i) => {
              const empty = value === null || value === undefined || value === '';
              const isPre = opts?.pre;
              if (isPre) {
                return (
                  <div key={i} className="md:col-span-2 space-y-1.5 py-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
                    <pre className="font-sans whitespace-pre-wrap text-[11px] font-semibold text-[var(--text-main)] leading-relaxed bg-black/[0.015] dark:bg-white/[0.015] rounded-xl p-4 m-0 border border-[var(--border-color)]">
                      {empty ? '—' : value}
                    </pre>
                  </div>
                );
              }
              return (
                <div key={i} className="flex items-center justify-between gap-3 py-3 border-b border-[var(--border-color)] last:border-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">{label}</span>
                  <span className={`text-xs font-bold text-right break-words max-w-[60%] ${opts?.mono ? 'font-mono text-[10px] text-blue-500' : 'text-[var(--text-main)]'}`}>
                    {empty ? <span className="text-slate-300 dark:text-slate-600">—</span> : value}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function badgeClass(color) {
  switch (color) {
    case 'green': return 'badge-green';
    case 'amber': return 'badge-amber';
    case 'red':   return 'badge-red';
    case 'cyan':  return 'badge-cyan';
    case 'purple':return 'badge-purple';
    case 'blue':  return 'badge-blue';
    default:      return 'badge-slate';
  }
}

function defaultHeader(doc, displayKey) {
  return (displayKey && doc[displayKey])
    || doc.fullName || doc.name || doc.title
    || doc.contractCode || doc.workerCode || doc.orderCode || doc.documentCode || doc.assetCode
    || doc.filename || doc.id;
}

/** Fallback: hiện mọi field không rỗng, gom group "Thông tin". */
function autoSections(doc) {
  const skip = new Set(['id', '__v', 'sizes', 'updatedAt', 'createdAt']);
  const fields = [];
  for (const [k, v] of Object.entries(doc)) {
    if (skip.has(k)) continue;
    if (v === null || v === undefined || v === '') continue;
    let display;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      display = `${v.length} mục`;
    } else if (typeof v === 'object') {
      display = v.fullName || v.name || v.title || v.id || JSON.stringify(v).slice(0, 80);
    } else if (typeof v === 'boolean') {
      display = v ? '✅' : '❌';
    } else {
      display = String(v);
      if (display.length > 200) display = display.slice(0, 200) + '...';
    }
    fields.push([k, display]);
  }
  return [
    { title: 'Thông tin', fields },
    {
      title: 'Hệ thống',
      fields: [
        ['Tạo lúc', doc.createdAt ? new Date(doc.createdAt).toLocaleString('vi-VN') : '—'],
        ['Cập nhật', doc.updatedAt ? new Date(doc.updatedAt).toLocaleString('vi-VN') : '—'],
        ['ID', doc.id, { mono: true }],
      ],
    },
  ];
}
