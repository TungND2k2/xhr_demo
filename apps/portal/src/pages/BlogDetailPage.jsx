import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit2, Eye } from 'lucide-react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { getDoc } from '../api/payload';
import useAuth from '../hooks/useAuth';
import DeleteButton from '../components/DeleteButton';

const DEPT_LABEL = {
  all: 'Toàn công ty',
  hcns: 'Hành chính - Nhân sự',
  tuyendung: 'Tuyển dụng',
  daotao: 'Đào tạo',
  visa: 'Visa - Hồ sơ',
  ketoan: 'Kế toán',
  yte: 'Y tế',
  phong_jp: 'Phòng Nhật Bản',
  phong_kr: 'Phòng Hàn Quốc',
  phong_tw: 'Phòng Đài Loan',
  phong_de: 'Phòng Đức',
  bgd: 'Ban Giám đốc',
  other: 'Khác',
};

const MONTHS = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];

function fmtMediumDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

function calcReadTime(blocks, title, excerpt) {
  const text = (Array.isArray(blocks) ? blocks : []).map((b) => {
    if (!b || !Array.isArray(b.content)) return '';
    return b.content.map((c) => (c && typeof c === 'object' && c.text) ? c.text : '').join(' ');
  }).join(' ') + ' ' + (title ?? '') + ' ' + (excerpt ?? '');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return minutes;
}

function getInitials(name, email) {
  const src = (name || email || '?').trim();
  if (!src) return '?';
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function BlogDetailPage({ recordId, onBack }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    getDoc('blog-posts', recordId, 2).then((d) => {
      setDoc(d);
      setLoading(false);
    });
  }, [recordId]);

  const initialContent = doc && Array.isArray(doc.content) && doc.content.length > 0
    ? doc.content
    : undefined;
  const editor = useCreateBlockNote({ initialContent }, [doc?.id]);

  const readTime = useMemo(
    () => (doc ? calcReadTime(doc.content, doc.title, doc.excerpt) : 0),
    [doc],
  );

  if (loading) return <div className="text-center py-24 text-slate-500">Đang tải...</div>;
  if (!doc) return <div className="text-center py-24 text-red-500">Không tải được bài viết này.</div>;

  const authorObj = typeof doc.author === 'object' ? doc.author : null;
  const authorName = authorObj?.displayName ?? authorObj?.email ?? 'Ẩn danh';
  const authorEmail = authorObj?.email ?? '';
  const authorInitials = getInitials(authorObj?.displayName, authorObj?.email);
  const featuredImage = typeof doc.featuredImage === 'object' ? doc.featuredImage : null;
  const hasContent = Array.isArray(doc.content) && doc.content.length > 0;

  const canEdit = user?.id && (
    (authorObj && authorObj.id === user.id) ||
    (typeof user.roleRef === 'object' && user.roleRef?.name === 'Admin') ||
    user.role === 'admin' || user.role === 'manager'
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="-m-8 bg-[var(--bg-main)] min-h-[calc(100vh-64px-40px)]"
    >
      {/* Sticky minimal top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-3 border-b border-[var(--border-color)] bg-[var(--sidebar-bg)]/95 backdrop-blur-sm">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[var(--text-main)]">
          <ArrowLeft size={14} /> Blog
        </button>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/blog/${doc.id}/edit`)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-[var(--border-color)] hover:border-blue-500/40 hover:text-blue-500">
              <Edit2 size={12} /> Sửa
            </button>
            <DeleteButton collection="blog-posts" recordId={doc.id} recordLabel={doc.title} onDeleted={onBack} />
          </div>
        )}
      </div>

      {/* Cover — edge-to-edge full-width */}
      {featuredImage?.url && (
        <div className="w-full max-h-[500px] overflow-hidden">
          <img src={featuredImage.url} alt={doc.title} className="w-full max-h-[500px] object-cover" />
        </div>
      )}

      {/* Article — centered readable width */}
      <article className="max-w-[720px] mx-auto px-6 py-12">
        {/* Category text link */}
        <div className="mb-5">
          <span className="text-[13px] font-bold text-slate-500 uppercase tracking-widest">
            {DEPT_LABEL[doc.department] ?? doc.department ?? '—'}
          </span>
        </div>

        {/* Title — Medium-style massive serif */}
        <h1
          className="text-[42px] md:text-[52px] font-black text-[var(--text-main)] leading-[1.15] tracking-tight mb-4"
          style={{ fontFamily: 'Merriweather, "Source Serif Pro", "Charter", Georgia, serif' }}
        >
          {doc.title}
        </h1>

        {/* Excerpt as subtitle */}
        {doc.excerpt && (
          <p
            className="text-xl md:text-2xl italic text-[var(--text-muted)] leading-relaxed mb-10"
            style={{ fontFamily: 'Merriweather, "Source Serif Pro", "Charter", Georgia, serif' }}
          >
            {doc.excerpt}
          </p>
        )}

        {/* Byline: avatar + author + date + read time */}
        <div className="flex items-center gap-3 pb-8 mb-10 border-b border-[var(--border-color)]">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center text-sm font-black shadow-md shadow-blue-500/20 shrink-0">
            {authorInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--text-main)] truncate">{authorName}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <span>{doc.publishedAt ? fmtMediumDate(doc.publishedAt) : 'Chưa đăng'}</span>
              <span>·</span>
              <span>{readTime} phút đọc</span>
              {doc.views > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Eye size={11} />{doc.views}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Content — BlockNote readonly */}
        <div className="bn-blog-view">
          {hasContent ? (
            <BlockNoteView editor={editor} theme={isDark ? 'dark' : 'light'} editable={false} />
          ) : (
            <p className="text-slate-500 italic text-lg" style={{ fontFamily: 'Merriweather, Georgia, serif' }}>
              Bài viết này chưa có nội dung.
            </p>
          )}
        </div>

        {/* Tags — text link style */}
        {Array.isArray(doc.tags) && doc.tags.length > 0 && (
          <div className="flex items-center gap-x-4 gap-y-2 flex-wrap mt-16 pt-8 border-t border-[var(--border-color)]">
            {doc.tags.map((t, i) => {
              const val = typeof t === 'object' ? t.tag : t;
              return (
                <span key={i} className="text-sm text-slate-500 hover:text-blue-500 cursor-pointer transition-colors">
                  #{val}
                </span>
              );
            })}
          </div>
        )}

        {/* Author card */}
        <div className="mt-16 pt-8 border-t border-[var(--border-color)] flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center text-xl font-black shadow-lg shadow-blue-500/25 shrink-0">
            {authorInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Tác giả</p>
            <p className="text-lg font-black text-[var(--text-main)]">{authorName}</p>
            {authorEmail && <p className="text-xs text-slate-500">{authorEmail}</p>}
          </div>
        </div>
      </article>

      {/* Typography — Medium-esque body text */}
      <style>{`
        .bn-blog-view .bn-editor {
          background: transparent !important;
          padding: 0 !important;
        }
        .bn-blog-view [data-mantine-color-scheme="light"],
        .bn-blog-view [data-mantine-color-scheme="dark"] {
          background: transparent !important;
        }
        .bn-blog-view .bn-block-content {
          font-family: Merriweather, "Source Serif Pro", "Charter", Georgia, serif;
          font-size: 20px;
          line-height: 1.75;
          color: var(--text-main);
        }
        .bn-blog-view .bn-inline-content {
          font-family: inherit;
        }
        .bn-blog-view h1.bn-block-content,
        .bn-blog-view h2.bn-block-content,
        .bn-blog-view h3.bn-block-content {
          font-weight: 900 !important;
          letter-spacing: -0.01em;
        }
      `}</style>
    </motion.div>
  );
}
