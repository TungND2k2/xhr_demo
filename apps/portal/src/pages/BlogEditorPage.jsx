import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, AlertCircle, Check, Image as ImageIcon, X,
  Tag as TagIcon, Loader2, Camera,
} from 'lucide-react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import useAuth from '../hooks/useAuth';
import { createDoc, getDoc, fetchPayload } from '../api/payload';

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

export default function BlogEditorPage({ mode = 'create' }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [error, setError] = useState(null);
  const [autoSaved, setAutoSaved] = useState(null);

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [department, setDepartment] = useState('all');
  const [tags, setTags] = useState([]);
  const [featuredImageId, setFeaturedImageId] = useState(null);
  const [featuredImageUrl, setFeaturedImageUrl] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [existingDocId, setExistingDocId] = useState(id ?? null);

  const [initialBlocks, setInitialBlocks] = useState(null);
  const titleRef = useRef(null);
  const excerptRef = useRef(null);

  useEffect(() => {
    if (mode !== 'edit' || !id) {
      setInitialBlocks([]);
      setLoading(false);
      return;
    }
    getDoc('blog-posts', id, 1).then((d) => {
      if (!d) { setError('Không tải được bài viết'); setLoading(false); return; }
      setTitle(d.title ?? '');
      setExcerpt(d.excerpt ?? '');
      setDepartment(d.department ?? 'all');
      setTags((Array.isArray(d.tags) ? d.tags : []).map((t) => typeof t === 'object' ? t.tag : t).filter(Boolean));
      if (typeof d.featuredImage === 'object' && d.featuredImage) {
        setFeaturedImageId(d.featuredImage.id);
        setFeaturedImageUrl(d.featuredImage.url ?? null);
      }
      setInitialBlocks(Array.isArray(d.content) ? d.content : []);
      setLoading(false);
    });
  }, [mode, id]);

  const editor = useCreateBlockNote({
    initialContent: initialBlocks && initialBlocks.length > 0 ? initialBlocks : undefined,
    uploadFile: async (file) => {
      const form = new FormData();
      form.append('file', file);
      form.append('alt', `Blog inline: ${file.name}`);
      const res = await fetchPayload('/media', { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Upload HTTP ${res.status}`);
      const json = await res.json();
      const doc = json.doc ?? json;
      return doc.url ?? '';
    },
  }, [initialBlocks?.length]);

  // Auto-resize title/excerpt textarea
  const autoResize = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  useEffect(() => { autoResize(titleRef.current); }, [title]);
  useEffect(() => { autoResize(excerptRef.current); }, [excerpt]);

  const buildPayload = (status) => {
    const content = editor?.document ?? [];
    return {
      title: title.trim(),
      excerpt: excerpt.trim() || undefined,
      department,
      status,
      content,
      tags: tags.map((t) => ({ tag: t })),
      featuredImage: featuredImageId ?? undefined,
    };
  };

  const doSave = async (status) => {
    setError(null);
    const isPublish = status === 'published';
    const setter = isPublish ? setPublishing : setSaving;
    setter(true);
    try {
      const payload = buildPayload(status);
      let docId = existingDocId;
      if (docId) {
        const res = await fetchPayload(`/blog-posts/${encodeURIComponent(docId)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.errors?.[0]?.message || `HTTP ${res.status}`);
        }
      } else {
        const doc = await createDoc('blog-posts', payload);
        docId = doc?.id;
        if (docId) setExistingDocId(docId);
      }
      if (isPublish && docId) {
        setPublishOpen(false);
        navigate(`/blog/${docId}`);
      } else {
        setAutoSaved(new Date());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setter(false);
    }
  };

  // Auto-save draft every 5s if there's a title + content
  useEffect(() => {
    if (loading || publishing) return;
    const iv = setInterval(() => {
      if (!title.trim()) return;
      if (saving || publishing) return;
      doSave('draft');
    }, 5000);
    return () => clearInterval(iv);
  }, [loading, title, publishing, saving, existingDocId]); // eslint-disable-line

  const handleFeaturedImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('alt', `Cover: ${title || file.name}`);
      const res = await fetchPayload('/media', { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Upload HTTP ${res.status}`);
      const json = await res.json();
      const doc = json.doc ?? json;
      setFeaturedImageId(doc.id);
      setFeaturedImageUrl(doc.url ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingImage(false);
    }
  };

  const wordCount = useMemo(() => {
    const text = (editor?.document ?? []).map((b) => {
      if (!b || !Array.isArray(b.content)) return '';
      return b.content.map((c) => (c && typeof c === 'object' && c.text) ? c.text : '').join(' ');
    }).join(' ') + ' ' + title + ' ' + excerpt;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, [title, excerpt, editor]);

  if (loading) {
    return <div className="text-center py-24 text-slate-500">Đang tải editor...</div>;
  }

  const canPublish = title.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100vh-64px-40px)] -m-8 bg-[var(--bg-main)]"
    >
      {/* Minimal top bar — Medium style */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-[var(--border-color)] shrink-0 bg-[var(--sidebar-bg)]">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[var(--text-main)]">
          <ArrowLeft size={14} /> Quay lại
        </button>
        <div className="flex items-center gap-3">
          {autoSaved && !saving && (
            <span className="hidden md:flex items-center gap-1 text-[11px] text-slate-500">
              <Check size={11} className="text-green-500" /> Đã lưu {autoSaved.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {saving && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Loader2 size={11} className="animate-spin" /> Đang lưu...
            </span>
          )}
          <span className="text-[11px] text-slate-500">{wordCount} từ</span>
          <button
            onClick={() => setPublishOpen(true)}
            disabled={!canPublish}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full bg-green-600 hover:bg-green-700 text-white transition-all disabled:opacity-40"
          >
            <Send size={12} /> Đăng bài
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-8 mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 text-red-500 text-xs">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Full-width canvas — NO SIDEBAR */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[720px] mx-auto px-6 py-12">
          {/* Cover image: nút nhỏ khi chưa có, ảnh full khi có */}
          {featuredImageUrl ? (
            <div className="mb-8 relative group">
              <img src={featuredImageUrl} alt="Cover" className="w-full max-h-[400px] object-cover rounded-lg" />
              <button
                onClick={() => { setFeaturedImageId(null); setFeaturedImageUrl(null); }}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                title="Xoá ảnh bìa"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="mb-8 inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 hover:text-blue-500 cursor-pointer rounded-full border border-dashed border-[var(--border-color)] hover:border-blue-500/40 transition">
              {uploadingImage ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              {uploadingImage ? 'Đang upload...' : 'Thêm ảnh bìa'}
              <input type="file" accept="image/*" onChange={handleFeaturedImageUpload} disabled={uploadingImage} className="hidden" />
            </label>
          )}

          {/* Title — huge serif */}
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề"
            rows={1}
            autoFocus={mode === 'create'}
            className="block w-full bg-transparent text-[42px] md:text-[52px] font-black text-[var(--text-main)] outline-none resize-none mb-3 tracking-tight leading-[1.15] placeholder:text-slate-400"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          />

          {/* Excerpt / subtitle */}
          <textarea
            ref={excerptRef}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Tóm tắt ngắn (tuỳ chọn)"
            rows={1}
            className="block w-full bg-transparent text-xl md:text-2xl italic text-[var(--text-muted)] outline-none resize-none mb-10 placeholder:text-slate-400 leading-relaxed"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          />

          {/* BlockNote editor */}
          <div className="bn-blog-editor">
            <BlockNoteView editor={editor} theme={isDark ? 'dark' : 'light'} />
          </div>

          <div className="text-[11px] text-slate-500 mt-8 pt-4 border-t border-[var(--border-color)]">
            💡 Gõ <kbd className="px-1 py-0.5 rounded bg-slate-500/10 text-[10px] font-mono">/</kbd> để chèn heading / list / ảnh / quote / code · Chọn text để format · Kéo <kbd className="px-1 py-0.5 rounded bg-slate-500/10 text-[10px] font-mono">⋮⋮</kbd> để đổi thứ tự block
          </div>
        </div>
      </div>

      {/* Publish dialog — Medium style */}
      <AnimatePresence>
        {publishOpen && (
          <PublishDialog
            title={title}
            excerpt={excerpt}
            department={department}
            setDepartment={setDepartment}
            tags={tags}
            setTags={setTags}
            featuredImageUrl={featuredImageUrl}
            publishing={publishing}
            onCancel={() => setPublishOpen(false)}
            onPublish={() => doSave('published')}
            user={user}
          />
        )}
      </AnimatePresence>

      {/* Style overrides — BlockNote hoà theme portal + typography serif cho body */}
      <style>{`
        .bn-blog-editor .bn-editor {
          background: transparent !important;
          padding: 0 !important;
        }
        .bn-blog-editor [data-mantine-color-scheme="light"],
        .bn-blog-editor [data-mantine-color-scheme="dark"] {
          background: transparent !important;
        }
        .bn-blog-editor .bn-block-content {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 19px;
          line-height: 1.7;
        }
        .bn-blog-editor .bn-inline-content {
          font-family: inherit;
        }
      `}</style>
    </motion.div>
  );
}

function PublishDialog({ title, excerpt, department, setDepartment, tags, setTags, featuredImageUrl, publishing, onCancel, onPublish, user }) {
  const [tagInput, setTagInput] = React.useState('');
  const handleTagAdd = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().toLowerCase();
      if (!tags.includes(t)) setTags([...tags, t]);
      setTagInput('');
    }
  };
  const removeTag = (t) => setTags(tags.filter((x) => x !== t));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="bg-[var(--sidebar-bg)] rounded-2xl border border-[var(--border-color)] shadow-2xl w-full max-w-4xl p-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* LEFT — Preview */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Xem trước card blog</p>
          <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
            {featuredImageUrl ? (
              <img src={featuredImageUrl} alt="" className="w-full aspect-video object-cover" />
            ) : (
              <div className="aspect-video bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center">
                <ImageIcon size={32} className="text-slate-400" />
              </div>
            )}
            <div className="p-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{DEPT_LABEL[department]}</p>
              <h3 className="text-base font-black text-[var(--text-main)] mb-1 line-clamp-2" style={{ fontFamily: 'Georgia, serif' }}>{title || 'Tiêu đề bài viết'}</h3>
              <p className="text-xs text-slate-500 line-clamp-2">{excerpt || 'Tóm tắt bài viết'}</p>
            </div>
          </div>
        </div>

        {/* RIGHT — Publish form */}
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-black text-[var(--text-main)]">Xuất bản bài</h2>
            <p className="text-xs text-slate-500 mt-1">Bài sẽ hiện ở /blog cho toàn công ty đọc.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-main)] mb-1.5 block">Phòng ban</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-green-500/20 text-[var(--text-main)]">
              {Object.entries(DEPT_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-main)] mb-1.5 block flex items-center gap-1"><TagIcon size={11} /> Tags (tuỳ chọn)</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-full bg-slate-500/10 text-[var(--text-main)]">
                  #{t}
                  <button onClick={() => removeTag(t)} className="hover:text-red-500"><X size={10} /></button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagAdd}
              placeholder="Nhập tag rồi Enter (vd: chào-mừng, thông-báo)"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-green-500/20"
            />
          </div>

          <div className="pt-4 border-t border-[var(--border-color)]">
            <p className="text-[11px] text-slate-500 mb-1">Đăng bởi</p>
            <p className="text-sm font-semibold text-[var(--text-main)]">{user?.displayName ?? user?.email ?? '—'}</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <button onClick={onCancel} disabled={publishing} className="px-4 py-2 text-xs font-semibold rounded-full border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5">
              Huỷ
            </button>
            <button onClick={onPublish} disabled={publishing || !title.trim()} className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-full bg-green-600 hover:bg-green-700 text-white disabled:opacity-40">
              {publishing ? <><Loader2 size={12} className="animate-spin" /> Đang đăng...</> : <><Send size={12} /> Xuất bản ngay</>}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
