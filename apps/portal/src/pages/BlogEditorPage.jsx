import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, Send, AlertCircle, Check, Image as ImageIcon, X, Tag as TagIcon, Loader2,
} from 'lucide-react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import useAuth from '../hooks/useAuth';
import { createDoc, getDoc, fetchPayload, API_BASE } from '../api/payload';

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
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null); // 'draft' | 'published' | null

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [department, setDepartment] = useState('all');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [featuredImageId, setFeaturedImageId] = useState(null);
  const [featuredImageUrl, setFeaturedImageUrl] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [initialBlocks, setInitialBlocks] = useState(null);

  // Load existing post if edit mode
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
      form.append('_payload', JSON.stringify({ kind: 'blog_image' }));
      const res = await fetchPayload('/media', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error(`Upload thất bại HTTP ${res.status}`);
      const json = await res.json();
      const doc = json.doc ?? json;
      return doc.url ?? doc.filename ?? '';
    },
  }, [initialBlocks?.length]);

  const canSave = title.trim() && department;

  const handleTagAdd = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().toLowerCase();
      if (!tags.includes(t)) setTags([...tags, t]);
      setTagInput('');
    }
  };
  const removeTag = (t) => setTags(tags.filter((x) => x !== t));

  const handleFeaturedImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('alt', `Cover image blog: ${title || file.name}`);
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
    setSaved(null);
    const setter = status === 'draft' ? setSaving : setPublishing;
    setter(true);
    try {
      const payload = buildPayload(status);
      if (mode === 'edit' && id) {
        const res = await fetchPayload(`/blog-posts/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.errors?.[0]?.message || `HTTP ${res.status}`);
        }
      } else {
        const doc = await createDoc('blog-posts', payload);
        if (doc?.id) {
          setSaved(status);
          setTimeout(() => navigate(`/blog/${doc.id}`), 700);
          return;
        }
      }
      setSaved(status);
      if (status === 'published') {
        setTimeout(() => navigate(`/blog/${id ?? ''}`), 700);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setter(false);
    }
  };

  if (loading) {
    return <div className="text-center py-24 text-slate-500">Đang tải editor...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100vh-64px-40px)] -m-8"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-color)] bg-[var(--sidebar-bg)] shrink-0">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[var(--text-main)]">
          <ArrowLeft size={14} /> QUAY LẠI
        </button>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
              <Check size={12} /> Đã lưu {saved === 'published' ? '+ đăng bài' : 'nháp'}
            </span>
          )}
          <button
            onClick={() => doSave('draft')}
            disabled={!canSave || saving || publishing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {mode === 'edit' ? 'Lưu' : 'Lưu nháp'}
          </button>
          <button
            onClick={() => doSave('published')}
            disabled={!canSave || saving || publishing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-40 shadow-sm shadow-blue-500/20"
          >
            {publishing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {mode === 'edit' ? 'Đăng lại' : 'Đăng bài'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 text-red-500 text-xs">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Body: editor + sidebar */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Editor */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-main)]">
          <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Featured image */}
            {featuredImageUrl ? (
              <div className="mb-6 relative group">
                <img src={featuredImageUrl} alt="Cover" className="w-full max-h-[300px] object-cover rounded-2xl" />
                <button
                  onClick={() => { setFeaturedImageId(null); setFeaturedImageUrl(null); }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                  title="Xoá ảnh cover"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="mb-6 flex items-center justify-center gap-2 py-6 border-2 border-dashed border-[var(--border-color)] rounded-2xl text-sm text-slate-500 cursor-pointer hover:border-blue-500/40 hover:text-blue-500 transition">
                {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                {uploadingImage ? 'Đang upload...' : 'Thêm ảnh cover (kéo thả hoặc click)'}
                <input type="file" accept="image/*" onChange={handleFeaturedImageUpload} disabled={uploadingImage} className="hidden" />
              </label>
            )}

            {/* Title */}
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tiêu đề bài viết..."
              rows={1}
              autoFocus={mode === 'create'}
              className="block w-full bg-transparent text-4xl font-black text-[var(--text-main)] outline-none resize-none mb-2 tracking-tight leading-tight placeholder:text-slate-400"
              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            />

            {/* Excerpt */}
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Tóm tắt ngắn (optional) — hiện dưới title ở blog list..."
              rows={2}
              className="block w-full bg-transparent text-base text-[var(--text-muted)] outline-none resize-none mb-8 placeholder:text-slate-400 leading-relaxed"
              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            />

            {/* BlockNote editor */}
            <div className="bn-container">
              <BlockNoteView editor={editor} theme={isDark ? 'dark' : 'light'} />
            </div>

            <div className="text-[11px] text-slate-500 mt-4 border-t border-[var(--border-color)] pt-4">
              💡 Gõ <kbd className="px-1 py-0.5 rounded bg-slate-500/10 text-[10px] font-mono">/</kbd> để chèn heading, list, ảnh, quote, code... — kéo icon ⋮⋮ để reorder block. Chọn text → format toolbar hiện lên.
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-l border-[var(--border-color)] bg-[var(--sidebar-bg)] overflow-y-auto custom-scrollbar p-5 space-y-5">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Cài đặt bài</h3>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Phòng ban</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20 text-[var(--text-main)]">
              {Object.entries(DEPT_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">Bài viết sẽ được gán cho phòng này để filter.</p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
              <TagIcon size={11} /> Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/30">
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
              placeholder="Nhập tag + Enter"
              className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="pt-4 border-t border-[var(--border-color)] text-[10px] text-slate-500 leading-relaxed">
            <p><strong className="text-[var(--text-main)]">Tác giả:</strong> {user?.displayName ?? user?.email ?? '—'}</p>
            <p className="mt-1">Auto lưu khi bấm "Lưu nháp". Bấm "Đăng bài" khi sẵn sàng public.</p>
          </div>
        </aside>
      </div>

      {/* Override BlockNote background để dùng theme portal */}
      <style>{`
        .bn-container .bn-editor {
          background: transparent !important;
          padding: 0 !important;
        }
        .bn-container [data-mantine-color-scheme="light"],
        .bn-container [data-mantine-color-scheme="dark"] {
          background: transparent !important;
        }
      `}</style>
    </motion.div>
  );
}
