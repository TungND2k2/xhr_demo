import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, LayoutGrid, Columns, Download, ExternalLink,
  FileText, FileSpreadsheet, FileImage, FileType, File as FileIcon,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { listDocs, getDoc } from '../api/payload';
import { fmtDate } from '../lib/workers-labels';
import RichText from '../components/RichText';
import BulkActionBar from '../components/BulkActionBar';
import useBulkSelection from '../hooks/useBulkSelection';

const PUBLIC_BASE = '/api/media/file';
const PUBLIC_HOST = import.meta.env.VITE_PAYLOAD_URL || '';

const OFFICE_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
]);

const KIND_FILTERS = [
  { id: 'all',    label: 'Tất cả' },
  { id: 'image',  label: '🖼 Ảnh' },
  { id: 'pdf',    label: '📕 PDF' },
  { id: 'office', label: '📊 Office' },
  { id: 'other',  label: '📦 Khác' },
];

const PAGE_SIZE = 24;

function matchKind(mime, k) {
  if (k === 'all') return true;
  if (k === 'image') return mime?.startsWith('image/');
  if (k === 'pdf') return mime === 'application/pdf';
  if (k === 'office') return OFFICE_MIMES.has(mime);
  if (k === 'other') return !mime?.startsWith('image/') && mime !== 'application/pdf' && !OFFICE_MIMES.has(mime);
  return true;
}

function fileMeta(mime) {
  if (mime?.startsWith('image/')) return { Icon: FileImage, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'IMG' };
  if (mime === 'application/pdf') return { Icon: FileText, color: 'text-red-500', bg: 'bg-red-500/10', label: 'PDF' };
  if (mime?.includes('spreadsheet') || mime?.includes('excel')) return { Icon: FileSpreadsheet, color: 'text-green-600', bg: 'bg-green-500/10', label: 'XLS' };
  if (mime?.includes('word') || mime?.includes('wordprocessing')) return { Icon: FileType, color: 'text-blue-600', bg: 'bg-blue-500/10', label: 'DOC' };
  if (mime?.includes('presentation') || mime?.includes('powerpoint')) return { Icon: FileType, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'PPT' };
  if (mime?.startsWith('text/')) return { Icon: FileText, color: 'text-slate-500', bg: 'bg-slate-500/10', label: 'TXT' };
  return { Icon: FileIcon, color: 'text-slate-500', bg: 'bg-slate-500/10', label: 'FILE' };
}

const fileUrl = (filename) => `${PUBLIC_BASE}/${encodeURIComponent(filename)}`;

export default function MediaGallery() {
  const navigate = useNavigate();
  const [view, setView] = useState(() => localStorage.getItem('media:view') || 'grid');
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const sel = useBulkSelection();

  useEffect(() => { localStorage.setItem('media:view', view); }, [view]);
  useEffect(() => { sel.clear(); }, [q, page, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const where = {};
    if (q.trim()) where.filename = { like: q.trim() };
    listDocs('media', { where, limit: PAGE_SIZE, page, sort: '-uploadedAt', depth: 0 }).then((r) => {
      if (cancelled) return;
      setDocs(r.docs ?? []);
      setTotal(r.totalDocs ?? 0);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [q, page, reloadKey]);

  const visible = useMemo(() => docs.filter((m) => matchKind(m.mimeType, kind)), [docs, kind]);

  useEffect(() => {
    if (view === 'split' && !selectedId && visible.length > 0) setSelectedId(visible[0].id);
  }, [view, visible, selectedId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight">Kho Media</h2>
          <p className="text-sm text-[var(--text-muted)]">{total.toLocaleString()} tệp tin · HĐ scan, ảnh, công văn, CV, form Excel</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
              placeholder="Tìm theo tên file..."
              className="w-64 pl-9 pr-3 py-2 text-sm rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] focus:border-blue-500/60 outline-none"
            />
          </div>
          <div className="flex items-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-0.5">
            <button onClick={() => setView('grid')} className={`p-2 rounded-lg ${view === 'grid' ? 'bg-blue-500/10 text-blue-500' : 'text-slate-500 hover:text-[var(--text-main)]'}`} title="Lưới">
              <LayoutGrid size={16} />
            </button>
            <button onClick={() => setView('split')} className={`p-2 rounded-lg ${view === 'split' ? 'bg-blue-500/10 text-blue-500' : 'text-slate-500 hover:text-[var(--text-main)]'}`} title="Chia đôi (list + preview)">
              <Columns size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setKind(f.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              kind === f.id
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-blue-500/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <BulkActionBar
        count={sel.count}
        selectedIds={[...sel.selected]}
        collection="media"
        entityLabel="tệp tin"
        onClear={sel.clear}
        onDeleted={() => { sel.clear(); setReloadKey((k) => k + 1); }}
      />

      {/* Content */}
      {loading ? (
        <div className="text-center py-24 text-slate-500 text-sm">Đang tải...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-24 text-slate-500 text-sm">Không có tệp tin nào khớp bộ lọc.</div>
      ) : view === 'grid' ? (
        <GridView items={visible} onOpen={(id) => navigate(`/media/${id}`)} sel={sel} />
      ) : (
        <SplitView items={visible} selectedId={selectedId} onSelect={setSelectedId} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg border border-[var(--border-color)] disabled:opacity-30 hover:border-blue-500/40">
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-slate-500">Trang {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg border border-[var(--border-color)] disabled:opacity-30 hover:border-blue-500/40">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

/* ─────────── Grid view ─────────── */

function GridView({ items, onOpen, sel }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((m) => (
        <MediaCard
          key={m.id}
          media={m}
          onOpen={() => onOpen(m.id)}
          selected={sel?.has(m.id)}
          onToggle={() => sel?.toggle(m.id)}
        />
      ))}
    </div>
  );
}

function MediaCard({ media, onOpen, selected, onToggle }) {
  const mime = media.mimeType ?? '';
  const isImage = mime.startsWith('image/');
  const meta = fileMeta(mime);
  const sizeKb = media.filesize ? Math.round(media.filesize / 1024) : 0;
  const sizeLabel = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb.toLocaleString()} KB`;

  return (
    <div
      onClick={onOpen}
      className={`relative group text-left bg-[var(--bg-card)] border ${selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-[var(--border-color)]'} rounded-2xl overflow-hidden hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer`}
    >
      <label
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-2 left-2 z-10 cursor-pointer ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
      >
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={onToggle}
          className="rounded border-[var(--border-color)] accent-blue-500 cursor-pointer w-4 h-4 bg-white/95 dark:bg-slate-800/95"
        />
      </label>
      <div className={`relative aspect-square ${meta.bg} flex items-center justify-center overflow-hidden`}>
        {isImage ? (
          <img
            src={fileUrl(media.filename)}
            alt={media.alt ?? media.filename}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <meta.Icon size={42} className={meta.color} />
            <span className={`text-[10px] font-black tracking-widest ${meta.color}`}>{meta.label}</span>
          </div>
        )}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <a
            href={fileUrl(media.filename)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white shadow"
            title="Mở tab mới"
          >
            <ExternalLink size={12} />
          </a>
          <a
            href={fileUrl(media.filename)}
            download={media.filename}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white shadow"
            title="Tải về"
          >
            <Download size={12} />
          </a>
        </div>
      </div>
      <div className="p-3">
        <p className="text-xs font-semibold text-[var(--text-main)] truncate" title={media.filename}>
          {media.filename ?? '—'}
        </p>
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
          <span>{sizeLabel}</span>
          <span>{fmtDate(media.uploadedAt)}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Split view (list + preview pane) ─────────── */

function SplitView({ items, selectedId, onSelect }) {
  return (
    <div className="grid grid-cols-12 gap-4 min-h-[60vh]">
      {/* Left list */}
      <div className="col-span-12 md:col-span-4 lg:col-span-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden max-h-[75vh] overflow-y-auto">
        {items.map((m) => {
          const isImage = m.mimeType?.startsWith('image/');
          const meta = fileMeta(m.mimeType);
          const active = m.id === selectedId;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={`w-full flex items-center gap-3 p-3 text-left border-b border-[var(--border-color)] transition-colors ${
                active ? 'bg-blue-500/10' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
              }`}
            >
              <div className={`shrink-0 w-12 h-12 rounded-lg ${meta.bg} flex items-center justify-center overflow-hidden`}>
                {isImage ? (
                  <img src={fileUrl(m.filename)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <meta.Icon size={20} className={meta.color} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold truncate ${active ? 'text-blue-500' : 'text-[var(--text-main)]'}`} title={m.filename}>
                  {m.filename ?? '—'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {meta.label} · {m.filesize ? `${Math.round(m.filesize / 1024).toLocaleString()} KB` : '—'} · {fmtDate(m.uploadedAt)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right preview pane */}
      <div className="col-span-12 md:col-span-8 lg:col-span-9">
        {selectedId ? <PreviewPane id={selectedId} /> : (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm border border-dashed border-[var(--border-color)] rounded-2xl">
            Chọn 1 tệp tin để xem preview
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewPane({ id }) {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDoc('media', id, 1).then((m) => { setMedia(m); setLoading(false); });
  }, [id]);

  if (loading) return <div className="h-full flex items-center justify-center text-slate-500 text-sm">Đang tải...</div>;
  if (!media) return <div className="h-full flex items-center justify-center text-red-500 text-sm">Lỗi tải file</div>;

  const mime = media.mimeType ?? '';
  const url = fileUrl(media.filename);
  const publicUrl = `${PUBLIC_HOST}${url}`;
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  const isOffice = OFFICE_MIMES.has(mime);
  const officeUrl = isOffice ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}` : null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--text-main)] truncate" title={media.filename}>{media.filename}</p>
          <p className="text-[10px] text-slate-500">{mime} · {media.filesize ? `${Math.round(media.filesize / 1024).toLocaleString()} KB` : '—'}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--border-color)] hover:border-blue-500/40">
            <ExternalLink size={12} /> Mở
          </a>
          <a href={url} download={media.filename} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-blue-500/40 text-blue-500 hover:bg-blue-500/10">
            <Download size={12} /> Tải
          </a>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 p-3 overflow-auto">
        {isImage && <img src={url} alt={media.alt ?? media.filename} className="max-w-full max-h-[60vh] mx-auto rounded-lg object-contain" />}
        {isPdf && <iframe src={url} title={media.filename} className="w-full h-[60vh] rounded-lg border-0" />}
        {isOffice && <iframe src={officeUrl} title={media.filename} className="w-full h-[60vh] rounded-lg border-0" />}
        {!isImage && !isPdf && !isOffice && (
          <div className="py-12 text-center text-slate-500">
            <FileText size={40} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Định dạng <code className="text-xs">{mime}</code> không xem trực tiếp được.</p>
          </div>
        )}

        {media.description && (
          <div className="mt-4 p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02]">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">🤖 Mô tả nội dung (AI)</h4>
            <RichText text={media.description} />
          </div>
        )}
      </div>
    </div>
  );
}
