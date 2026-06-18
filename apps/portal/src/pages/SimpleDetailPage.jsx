import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer } from 'lucide-react';
import { getDoc } from '../api/payload';
import { printPdf } from '../lib/export';
import DeleteButton from '../components/DeleteButton';

/**
 * SimpleDetailPage — generic detail view cho 1 record bất kỳ.
 *
 * Section schema:
 *  { title, icon?, wide?, fields: [[label, value, opts?], ...] }
 *  - wide=true : section span cả 2 column
 *  - opts.mono : render value mono-font
 *  - opts.pre  : value là multiline → render <pre> preserve formatting
 *
 * config.headerSummary(doc): trả về { title, subtitle, badges:[{label, color}] }
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

  // Ẩn field rỗng + ẩn section nếu toàn rỗng (trừ khi có custom render)
  const isEmpty = (v) => v === null || v === undefined || v === '' || v === '—';
  const sections = rawSections
    .map((sec) => {
      if (sec.render) return sec; // custom render — không filter
      const filtered = (sec.fields ?? []).filter(([, value]) => !isEmpty(value));
      return { ...sec, fields: filtered };
    })
    .filter((sec) => sec.render || (sec.fields && sec.fields.length > 0));

  const summary = headerSummary
    ? headerSummary(doc)
    : { title: defaultHeader(doc, displayKey), subtitle: null, badges: [] };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 print-area">
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-main)] transition-colors">
          <ArrowLeft size={16} /> Quay lại {title}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={printPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
            <Printer size={14} /> Xuất PDF
          </button>
          <DeleteButton
            collection={collection}
            recordId={doc.id}
            recordLabel={summary.title}
            onDeleted={onBack}
          />
        </div>
      </div>

      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight break-words">{summary.title}</h2>
            {summary.subtitle && (
              <p className="text-sm text-[var(--text-muted)] mt-1">{summary.subtitle}</p>
            )}
            <p className="text-[10px] text-slate-500 mt-2 font-mono">{collection}/{doc.id}</p>
          </div>
          {summary.badges && summary.badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {summary.badges.map((b, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${badgeClass(b.color)}`}>
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sections.map((sec, idx) => (
          <div key={idx} className={`glass-card p-6 ${sec.wide ? 'lg:col-span-2' : ''}`}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              {sec.icon && <sec.icon size={14} className="text-blue-500" />}
              {sec.title}
            </h3>
            {sec.render ? (
              sec.render()
            ) : (
              <div className="space-y-2.5">
                {sec.fields.map(([label, value, opts], i) => {
                  const empty = value === null || value === undefined || value === '';
                  const isPre = opts?.pre;
                  return (
                    <div key={i} className={`${isPre ? 'flex flex-col gap-1.5' : 'flex justify-between gap-3'} text-sm border-b border-[var(--border-color)] pb-2 last:border-0 last:pb-0`}>
                      <span className="text-slate-500 shrink-0">{label}</span>
                      {isPre ? (
                        <pre className="font-sans whitespace-pre-wrap text-[13px] text-[var(--text-main)] leading-relaxed bg-black/[0.02] dark:bg-white/[0.02] rounded-lg p-3 m-0">
                          {empty ? '—' : value}
                        </pre>
                      ) : (
                        <span className={`font-medium text-right break-words max-w-[60%] ${opts?.mono ? 'font-mono text-xs' : ''} text-[var(--text-main)]`}>
                          {empty ? '—' : value}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function badgeClass(color) {
  switch (color) {
    case 'green': return 'bg-green-500/10 text-green-600 dark:text-green-400';
    case 'amber': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'red':   return 'bg-red-500/10 text-red-600 dark:text-red-400';
    case 'cyan':  return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400';
    case 'purple':return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
    case 'blue':  return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    default:      return 'bg-slate-500/10 text-slate-500 dark:text-slate-400';
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
