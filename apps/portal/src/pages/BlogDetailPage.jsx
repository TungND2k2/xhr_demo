import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Edit2, User, Calendar, Tag, Eye,
} from 'lucide-react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { getDoc } from '../api/payload';
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

  // Read-only editor luôn được tạo, initialContent = blocks đã lưu
  const initialContent = doc && Array.isArray(doc.content) && doc.content.length > 0
    ? doc.content
    : undefined;
  const editor = useCreateBlockNote({ initialContent }, [doc?.id]);

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

  const hasContent = Array.isArray(doc.content) && doc.content.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-main)]">
          <ArrowLeft size={16} /> Quay lại Blog
        </button>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/blog/${doc.id}/edit`)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-blue-500/40 text-blue-500 hover:bg-blue-500/10">
              <Edit2 size={14} /> Sửa
            </button>
            <DeleteButton collection="blog-posts" recordId={doc.id} recordLabel={doc.title} onDeleted={onBack} />
          </div>
        )}
      </div>

      {/* Featured image */}
      {featuredImage?.url && (
        <img src={featuredImage.url} alt={doc.title} className="w-full max-h-[400px] object-cover rounded-2xl" />
      )}

      {/* Meta + title */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusMeta.chip}`}>
            {statusMeta.label}
          </div>
          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
            {DEPT_LABEL[doc.department] ?? doc.department ?? '—'}
          </span>
        </div>
        <h1 className="text-4xl font-black text-[var(--text-main)] leading-tight tracking-tight">{doc.title ?? '—'}</h1>
        {doc.excerpt && (
          <p className="text-lg text-[var(--text-muted)] leading-relaxed">{doc.excerpt}</p>
        )}
        <div className="flex items-center gap-5 pt-3 border-t border-[var(--border-color)] text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><User size={13} /><span className="font-semibold">{authorName}</span></div>
          <div className="flex items-center gap-1.5"><Calendar size={13} />{doc.publishedAt ? fmtDate(doc.publishedAt) : 'Chưa đăng'}</div>
          {doc.views > 0 && <div className="flex items-center gap-1.5"><Eye size={13} />{doc.views} lượt xem</div>}
        </div>
      </div>

      {/* Content — BlockNote readonly */}
      <div className="blog-content-view">
        {hasContent ? (
          <BlockNoteView editor={editor} theme={isDark ? 'dark' : 'light'} editable={false} />
        ) : (
          <p className="text-sm text-slate-500 italic py-8">Bài viết này chưa có nội dung.</p>
        )}
      </div>

      {/* Tags */}
      {Array.isArray(doc.tags) && doc.tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-[var(--border-color)]">
          <Tag size={14} className="text-slate-500" />
          {doc.tags.map((t, i) => {
            const val = typeof t === 'object' ? t.tag : t;
            return (
              <span key={i} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/30">
                #{val}
              </span>
            );
          })}
        </div>
      )}

      <style>{`
        .blog-content-view .bn-editor {
          background: transparent !important;
          padding: 0 !important;
        }
        .blog-content-view [data-mantine-color-scheme="light"],
        .blog-content-view [data-mantine-color-scheme="dark"] {
          background: transparent !important;
        }
      `}</style>
    </motion.div>
  );
}
