import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Edit2, Save, X, User, Calendar, Tag, AlertCircle, Newspaper, Eye,
} from 'lucide-react';
import { getDoc, fetchPayload } from '../api/payload';
import useAuth from '../hooks/useAuth';
import { fmtDate } from '../lib/workers-labels';
import DeleteButton from '../components/DeleteButton';

const DEPT_LABEL = {
  all: '🏢 Toàn công ty',
  hcns: '🏢 Hành chính - Nhân sự',
  tuyendung: '🧑‍💼 Tuyển dụng',
  daotao: '🎓 Đào tạo',
  visa: '🛂 Visa - Hồ sơ',
  ketoan: '💰 Kế toán',
  yte: '🏥 Y tế',
  phong_jp: '🇯🇵 Phòng Nhật Bản',
  phong_kr: '🇰🇷 Phòng Hàn Quốc',
  phong_tw: '🇹🇼 Phòng Đài Loan',
  phong_de: '🇩🇪 Phòng Đức',
  bgd: '👑 Ban Giám đốc',
  other: 'Khác',
};

const STATUS_META = {
  draft: { label: '📝 Bản nháp', chip: 'bg-slate-500/10 text-slate-500 border-slate-500/30' },
  published: { label: '✅ Đã đăng', chip: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' },
  archived: { label: '🗄 Lưu trữ', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
};

export default function BlogDetailPage({ recordId, onBack }) {
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('draft');
  const [department, setDepartment] = useState('all');

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    getDoc('blog-posts', recordId, 2).then((d) => {
      setDoc(d);
      setTitle(d?.title ?? '');
      setExcerpt(d?.excerpt ?? '');
      setContent(d?.content ?? '');
      setStatus(d?.status ?? 'draft');
      setDepartment(d?.department ?? 'all');
      setLoading(false);
    });
  }, [recordId]);

  if (loading) return <div className="text-center py-24 text-slate-500">Đang tải...</div>;
  if (!doc) return <div className="text-center py-24 text-red-500">Không tải được bài viết này.</div>;

  const statusMeta = STATUS_META[doc.status] ?? STATUS_META.draft;
  const authorObj = typeof doc.author === 'object' ? doc.author : null;
  const authorName = authorObj?.displayName ?? authorObj?.email ?? '—';
  const featuredImage = typeof doc.featuredImage === 'object' ? doc.featuredImage : null;

  const canEdit = user?.id && (
    (authorObj && authorObj.id === user.id) ||
    (typeof user.roleRef === 'object' && user.roleRef?.name === 'Admin') ||
    user.role === 'admin' || user.role === 'manager'
  );

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetchPayload(`/blog-posts/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, excerpt, content, status, department }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = j?.errors?.[0]?.message || j?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setDoc(j.doc ?? j);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl">
      {/* Top bar */}
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-main)] transition-colors">
          <ArrowLeft size={16} /> Quay lại Blog
        </button>
        {canEdit && (
          <div className="flex items-center gap-2">
            {!editing ? (
              <>
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-blue-500/40 text-blue-500 hover:bg-blue-500/10">
                  <Edit2 size={14} /> Sửa
                </button>
                <DeleteButton
                  collection="blog-posts"
                  recordId={doc.id}
                  recordLabel={doc.title}
                  onDeleted={onBack}
                />
              </>
            ) : (
              <>
                <button onClick={() => { setEditing(false); setSaveError(null); setTitle(doc.title); setExcerpt(doc.excerpt); setContent(doc.content); setStatus(doc.status); setDepartment(doc.department); }} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5">
                  <X size={14} /> Huỷ
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
                  <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {saveError && (
        <div className="glass-card p-3 border-red-500/30 bg-red-500/5 flex items-start gap-2">
          <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <span className="text-xs text-red-500">{saveError}</span>
        </div>
      )}

      {/* Featured image */}
      {featuredImage?.url && !editing && (
        <div className="glass-card p-0 overflow-hidden">
          <img src={featuredImage.url} alt={doc.title} className="w-full max-h-[400px] object-cover" />
        </div>
      )}

      {/* Hero */}
      <div className="glass-card p-6 space-y-4">
        {editing ? (
          <>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tiêu đề</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="block w-full mt-1 bg-transparent text-2xl font-black text-[var(--text-main)] outline-none border-b border-[var(--border-color)] focus:border-blue-500/40" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phòng ban</label>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className="block w-full mt-1 px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none">
                  {Object.entries(DEPT_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="block w-full mt-1 px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none">
                  {Object.entries(STATUS_META).map(([v, m]) => (
                    <option key={v} value={v}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tóm tắt</label>
              <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} className="block w-full mt-1 px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20 resize-y" />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusMeta.chip}`}>
                {statusMeta.label}
              </div>
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                {DEPT_LABEL[doc.department] ?? doc.department ?? '—'}
              </span>
            </div>
            <h1 className="text-3xl font-black text-[var(--text-main)] leading-tight">{doc.title ?? '—'}</h1>
            {doc.excerpt && (
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{doc.excerpt}</p>
            )}
            <div className="flex items-center gap-5 pt-3 border-t border-[var(--border-color)] text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <User size={13} />
                <span className="font-semibold">{authorName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} />
                {doc.publishedAt ? fmtDate(doc.publishedAt) : 'Chưa đăng'}
              </div>
              {doc.views > 0 && (
                <div className="flex items-center gap-1.5">
                  <Eye size={13} />
                  {doc.views} lượt xem
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="glass-card p-6">
        {editing ? (
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nội dung</label>
            <p className="text-[10px] text-slate-500 mb-2">Hỗ trợ markdown cơ bản: **đậm**, *nghiêng*, ## Đề mục, - danh sách</p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="block w-full mt-1 px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20 resize-y font-mono"
            />
          </div>
        ) : (
          <div className="prose-content text-sm text-[var(--text-main)] leading-relaxed">
            {renderMarkdown(doc.content ?? '')}
          </div>
        )}
      </div>

      {/* Tags */}
      {Array.isArray(doc.tags) && doc.tags.length > 0 && !editing && (
        <div className="glass-card p-4 flex items-center gap-2 flex-wrap">
          <Tag size={14} className="text-slate-500" />
          {doc.tags.map((t, i) => {
            const val = typeof t === 'object' ? t.tag : t;
            return (
              <span key={i} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/30">
                {val}
              </span>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/** Very minimal markdown renderer: paragraphs, headings, bold, italic, list, link. */
function renderMarkdown(text) {
  const lines = text.split(/\n/);
  const blocks = [];
  let paragraph = [];

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) { flush(); continue; }
    if (line.startsWith('### ')) { flush(); blocks.push({ type: 'h3', text: line.slice(4) }); continue; }
    if (line.startsWith('## '))  { flush(); blocks.push({ type: 'h2', text: line.slice(3) }); continue; }
    if (line.startsWith('# '))   { flush(); blocks.push({ type: 'h1', text: line.slice(2) }); continue; }
    if (line.match(/^[-*]\s+/))  {
      flush();
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ul') last.items.push(line.replace(/^[-*]\s+/, ''));
      else blocks.push({ type: 'ul', items: [line.replace(/^[-*]\s+/, '')] });
      continue;
    }
    if (line.match(/^\d+\.\s+/)) {
      flush();
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ol') last.items.push(line.replace(/^\d+\.\s+/, ''));
      else blocks.push({ type: 'ol', items: [line.replace(/^\d+\.\s+/, '')] });
      continue;
    }
    paragraph.push(line);
  }
  flush();

  const inline = (str) => {
    // bold, italic, link
    const parts = [];
    let s = str;
    let key = 0;
    const push = (node) => parts.push(<React.Fragment key={key++}>{node}</React.Fragment>);

    // Simple regex-based tokenizer
    const patterns = [
      { re: /\*\*([^*]+)\*\*/, tag: 'strong' },
      { re: /\*([^*]+)\*/, tag: 'em' },
      { re: /\[([^\]]+)\]\(([^)]+)\)/, tag: 'a' },
    ];
    let match;
    while (s.length > 0) {
      let earliest = null;
      for (const p of patterns) {
        const m = s.match(p.re);
        if (m && (earliest == null || m.index < earliest.m.index)) earliest = { p, m };
      }
      if (!earliest) { push(s); break; }
      const { p, m } = earliest;
      if (m.index > 0) push(s.slice(0, m.index));
      if (p.tag === 'strong') push(<strong>{m[1]}</strong>);
      else if (p.tag === 'em') push(<em>{m[1]}</em>);
      else if (p.tag === 'a') push(<a href={m[2]} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{m[1]}</a>);
      s = s.slice(m.index + m[0].length);
    }
    return parts;
  };

  return blocks.map((b, i) => {
    if (b.type === 'h1') return <h1 key={i} className="text-2xl font-black mt-4 mb-2">{inline(b.text)}</h1>;
    if (b.type === 'h2') return <h2 key={i} className="text-xl font-black mt-4 mb-2">{inline(b.text)}</h2>;
    if (b.type === 'h3') return <h3 key={i} className="text-lg font-bold mt-3 mb-1.5">{inline(b.text)}</h3>;
    if (b.type === 'ul') return <ul key={i} className="list-disc list-inside space-y-1 my-2">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>;
    if (b.type === 'ol') return <ol key={i} className="list-decimal list-inside space-y-1 my-2">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>;
    return <p key={i} className="my-3">{inline(b.text)}</p>;
  });
}
