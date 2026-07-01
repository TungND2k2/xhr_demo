import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Newspaper, Plus, Search, X, Filter, User, Calendar,
} from 'lucide-react';
import { listDocs, createDoc } from '../api/payload';
import { fmtDate } from '../lib/workers-labels';
import FormModal from '../components/FormModal';

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
  draft: { label: '📝 Nháp', chip: 'bg-slate-500/10 text-slate-500 border-slate-500/30' },
  published: { label: '✅ Đã đăng', chip: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' },
  archived: { label: '🗄 Lưu trữ', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
};

const CREATE_FIELDS = [
  { name: 'title', label: 'Tiêu đề', type: 'text', required: true, width: 'full', placeholder: 'vd: Chào mừng nhân sự mới tháng 7' },
  { name: 'department', label: 'Phòng ban', type: 'select', required: true, width: 'half',
    options: Object.entries(DEPT_LABEL).map(([v, l]) => ({ value: v, label: l })) },
  { name: 'status', label: 'Trạng thái', type: 'select', required: true, width: 'half', defaultValue: 'draft',
    options: [
      { value: 'draft', label: '📝 Lưu nháp' },
      { value: 'published', label: '✅ Đăng ngay' },
    ] },
  { name: 'excerpt', label: 'Tóm tắt', type: 'textarea', width: 'full', rows: 2, placeholder: '1-2 câu ngắn — hiện dưới title ở list' },
  { name: 'content', label: 'Nội dung', type: 'textarea', required: true, width: 'full', rows: 10,
    help: 'Hỗ trợ markdown: **đậm**, *nghiêng*, ## Đề mục, - danh sách...' },
];

export default function BlogListPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('published');
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const where = {};
    if (statusFilter) where.status = { equals: statusFilter };
    if (deptFilter) where.department = { equals: deptFilter };
    listDocs('blog-posts', { where, limit: 100, depth: 1, sort: '-publishedAt' }).then((d) => {
      if (cancel) return;
      setPosts(d.docs ?? []);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [statusFilter, deptFilter, reloadKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) =>
      (p.title ?? '').toLowerCase().includes(q) ||
      (p.excerpt ?? '').toLowerCase().includes(q) ||
      (p.content ?? '').toLowerCase().includes(q),
    );
  }, [posts, search]);

  const deptCounts = useMemo(() => {
    const m = new Map();
    for (const p of posts) {
      const k = p.department ?? 'other';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [posts]);

  const handleCreate = async (payload) => {
    const doc = await createDoc('blog-posts', payload);
    setReloadKey((k) => k + 1);
    if (doc?.id) navigate(`/blog/${doc.id}`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight flex items-center gap-3">
            <Newspaper size={28} className="text-blue-500" />
            Blog nội bộ
          </h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">Thông báo, chia sẻ, tài liệu — phân theo phòng ban</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all">
          <Plus size={14} /> Viết bài mới
        </button>
      </div>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Viết bài mới"
        subtitle="Chọn phòng ban + trạng thái. Sau khi tạo có thể sửa tiếp trong trang chi tiết."
        fields={CREATE_FIELDS}
        submitLabel="Đăng bài"
        onSubmit={handleCreate}
      />

      {/* Filter bar */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tiêu đề, nội dung..."
              className="w-full bg-transparent border border-[var(--border-color)] rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 text-[var(--text-main)]"
            />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {Object.entries(STATUS_META).map(([k, m]) => (
              <button
                key={k}
                onClick={() => setStatusFilter(statusFilter === k ? null : k)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-all ${
                  statusFilter === k ? m.chip : 'border-[var(--border-color)] text-slate-500 hover:text-[var(--text-main)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {(deptFilter || search || statusFilter !== 'published') && (
            <button onClick={() => { setDeptFilter(null); setSearch(''); setStatusFilter('published'); }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--border-color)] text-slate-500 hover:text-[var(--text-main)]">
              <X size={11} /> Reset lọc
            </button>
          )}
          <span className="text-[11px] text-slate-500">{filtered.length} bài</span>
        </div>

        {/* Department chips */}
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={deptFilter === null} onClick={() => setDeptFilter(null)} label="Tất cả phòng" count={posts.length} />
          {Object.entries(DEPT_LABEL).map(([k, label]) => {
            const c = deptCounts.get(k) ?? 0;
            if (c === 0) return null;
            return (
              <FilterChip
                key={k}
                active={deptFilter === k}
                onClick={() => setDeptFilter(deptFilter === k ? null : k)}
                label={label}
                count={c}
              />
            );
          })}
        </div>
      </div>

      {/* Blog grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          Không có bài nào khớp bộ lọc. {statusFilter === 'published' && posts.length === 0 && '(Anh viết bài đầu tiên đi!)'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <BlogCard key={p.id} post={p} onClick={() => navigate(`/blog/${p.id}`)} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function FilterChip({ active, onClick, label, count }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
        active
          ? 'bg-blue-500/10 text-blue-500 border-blue-500/40'
          : 'border-[var(--border-color)] text-slate-500 hover:text-[var(--text-main)]'
      }`}
    >
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  );
}

function BlogCard({ post, onClick }) {
  const status = STATUS_META[post.status] ?? STATUS_META.draft;
  const authorName = typeof post.author === 'object' ? (post.author?.displayName ?? post.author?.email) : null;
  const featuredImage = typeof post.featuredImage === 'object' ? post.featuredImage : null;

  return (
    <div onClick={onClick}
      className="glass-card p-0 overflow-hidden hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer group flex flex-col">
      {featuredImage?.url && (
        <div className="aspect-video bg-gradient-to-br from-blue-500/10 to-cyan-500/10 overflow-hidden">
          <img src={featuredImage.url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.chip}`}>
            {status.label}
          </div>
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            {DEPT_LABEL[post.department] ?? post.department ?? '—'}
          </span>
        </div>
        <h3 className="text-base font-black text-[var(--text-main)] group-hover:text-blue-500 transition-colors line-clamp-2 mb-2">
          {post.title ?? '—'}
        </h3>
        {post.excerpt && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3">{post.excerpt}</p>
        )}
        <div className="mt-auto pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <User size={11} />
            <span className="truncate max-w-[100px]">{authorName ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={11} />
            <span>{post.publishedAt ? fmtDate(post.publishedAt) : 'chưa đăng'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
