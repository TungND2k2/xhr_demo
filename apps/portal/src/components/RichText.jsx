import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * RichText — render summary/content/AI description với:
 *  - Markdown (bold, italic, lists, headings, links, tables)
 *  - Auto-detect "Vấn đề" / "Tích cực" / "Lưu ý" → callout box màu
 *  - Auto split "**Section:** body" thành mini-heading + body
 */
export default function RichText({ text }) {
  if (!text) return <span className="text-slate-400">—</span>;
  const blocks = parseSmartBlocks(String(text));
  return (
    <div className="rich-text space-y-3">
      {blocks.map((b, i) =>
        b.type === 'callout' ? (
          <Callout key={i} kind={b.kind} title={b.title} body={b.body} />
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{b.text}</ReactMarkdown>
        )
      )}
      <style>{`
        .rich-text strong { font-weight: 700; color: var(--text-main); }
        .rich-text em { font-style: italic; }
        .rich-text h1, .rich-text h2, .rich-text h3 { font-weight: 700; color: var(--text-main); }
        .rich-text h1 { font-size: 1.25rem; margin-top: 0.5em; }
        .rich-text h2 { font-size: 1.1rem; margin-top: 0.5em; }
        .rich-text h3 { font-size: 1rem; margin-top: 0.5em; color: #2563eb; }
        .rich-text p { font-size: 14px; line-height: 1.7; color: var(--text-main); margin: 0.5em 0; }
        .rich-text ul, .rich-text ol { padding-left: 1.5em; margin: 0.5em 0; font-size: 14px; line-height: 1.7; }
        .rich-text li { margin: 0.2em 0; }
        .rich-text li::marker { color: #2563eb; }
        .rich-text code { background: rgba(0,0,0,0.05); padding: 1px 6px; border-radius: 4px; font-size: 12px; }
        .rich-text table { border-collapse: collapse; margin: 0.5em 0; font-size: 13px; }
        .rich-text th, .rich-text td { border: 1px solid var(--border-color); padding: 6px 10px; }
        .rich-text th { background: rgba(0,0,0,0.03); font-weight: 600; }
        .rich-text hr { border: none; border-top: 1px solid var(--border-color); margin: 1em 0; }
        .rich-text blockquote { border-left: 3px solid #2563eb; padding-left: 12px; margin: 0.5em 0; color: var(--text-muted); font-style: italic; }
        .rich-text a { color: #2563eb; text-decoration: underline; }
      `}</style>
    </div>
  );
}

function parseSmartBlocks(raw) {
  const txt = raw.trim();
  const re = /\*\*([^*]+?)(?::|：)\*\*\s*/g;
  const sections = [];
  let lastIdx = 0;
  let lastTitle = null;
  let m;
  while ((m = re.exec(txt)) !== null) {
    if (lastTitle !== null) {
      const body = txt.slice(lastIdx, m.index).trim();
      if (body) sections.push({ title: lastTitle, body });
    } else if (m.index > 0) {
      const body = txt.slice(0, m.index).trim();
      if (body) sections.push({ title: null, body });
    }
    lastTitle = m[1].trim();
    lastIdx = m.index + m[0].length;
  }
  if (lastTitle !== null) {
    const body = txt.slice(lastIdx).trim();
    if (body) sections.push({ title: lastTitle, body });
  } else if (sections.length === 0) {
    return [{ type: 'md', text: txt }];
  }
  return sections.map((s) => {
    const lower = (s.title ?? '').toLowerCase();
    const kind = /vấn đề|nghiêm trọng|rủi ro|risk|cấm|sai phạm/.test(lower) ? 'danger'
              : /tích cực|positive|hoàn thành|thành công|tốt/.test(lower) ? 'success'
              : /lưu ý|cảnh báo|warning|chú ý|attention/.test(lower) ? 'warning'
              : null;
    if (kind && s.title) return { type: 'callout', kind, title: s.title, body: s.body };
    if (s.title) return { type: 'md', text: `### ${s.title}\n\n${s.body}` };
    return { type: 'md', text: s.body };
  });
}

function Callout({ kind, title, body }) {
  const META = {
    danger:  { bg: 'bg-red-500/5 border-red-500/30',     color: 'text-red-600 dark:text-red-400',     emoji: '🚨' },
    warning: { bg: 'bg-amber-500/5 border-amber-500/30', color: 'text-amber-600 dark:text-amber-400', emoji: '⚠️' },
    success: { bg: 'bg-green-500/5 border-green-500/30', color: 'text-green-600 dark:text-green-400', emoji: '✅' },
  };
  const m = META[kind] ?? META.warning;
  return (
    <div className={`rounded-xl border-2 ${m.bg} p-4`}>
      <div className={`flex items-center gap-2 font-bold text-sm ${m.color} mb-2`}>
        <span className="text-base">{m.emoji}</span>
        <span className="uppercase tracking-wide">{title}</span>
      </div>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
