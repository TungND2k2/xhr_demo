import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox, Send, Building2, Plus, Search, RefreshCw,
  FileText, X, Download, ChevronLeft, ChevronRight,
  SortAsc, SortDesc, Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { listDocs } from '../api/payload';
import { fmtDate } from '../lib/workers-labels';

/* ─── Export Helpers ─── */
function fmtSeqStr(seq, dateStr) {
  if (!seq) return '';
  const yr = dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear();
  return `${String(seq).padStart(3, '0')}/${yr}`;
}

async function fetchAllDocs(direction) {
  let page = 1;
  const all = [];
  while (true) {
    const res = await listDocs('official-documents', {
      where: { direction: { equals: direction } },
      limit: 100, page, depth: 0, sort: direction === 'incoming' ? 'incomingSequence' : '-issuedDate',
    });
    all.push(...(res.docs ?? []));
    if (all.length >= (res.totalDocs ?? 0) || (res.docs?.length ?? 0) === 0) break;
    page++;
  }
  return all;
}

const DOC_TYPE_LABEL = {
  decision: 'Quyết định', circular: 'Thông tư', official_letter: 'Công văn',
  notice: 'Thông báo', report: 'Tờ trình', contract: 'Hợp đồng/Phụ lục',
  license: 'Giấy phép/Chứng nhận', letter: 'Thư/Email', other: 'Khác',
};

function buildIncomingRows(docs) {
  return docs.map((d) => ({
    'Số đến': fmtSeqStr(d.incomingSequence, d.issuedDate),
    'Ngày nhận': fmtDate(d.receivedDate) || fmtDate(d.createdAt) || '',
    'Nơi gửi': d.issuingAuthority || '',
    'Số hiệu văn bản': d.officialNumber || '',
    'Ngày văn bản': fmtDate(d.issuedDate) || '',
    'Loại văn bản': DOC_TYPE_LABEL[d.documentType] || d.documentType || '',
    'Tên loại / Trích yếu nội dung': d.title || '',
    'Đơn vị/Người nhận': d.recipient || '',
    'Ký nhận': '',
    'Ghi chú': d.notes || '',
  }));
}

function buildOutgoingRows(docs) {
  return docs.map((d) => ({
    'Số ký hiệu văn bản': d.documentCode || '',
    'Ngày văn bản': fmtDate(d.issuedDate) || '',
    'Loại văn bản': DOC_TYPE_LABEL[d.documentType] || d.documentType || '',
    'Tên loại / Trích yếu nội dung': d.title || '',
    'Người ký': d.signedBy || '',
    'Nơi nhận văn bản': d.recipient || '',
    'Đơn vị/Người nhận hồi lời': d.responseRecipient || '',
    'Số lượng bản': d.copiesCount ?? 1,
    'Ghi chú': d.notes || '',
  }));
}

function buildInternalRows(docs) {
  return docs.map((d) => ({
    'Mã công văn': d.documentCode || '',
    'Ngày ban hành': fmtDate(d.issuedDate) || '',
    'Tiêu đề / Trích yếu': d.title || '',
    'Phòng ban': d.issuingAuthority || '',
    'Nơi nhận': d.recipient || '',
    'Người ký': d.signedBy || '',
    'Trạng thái': d.status || '',
    'Ghi chú': d.notes || '',
  }));
}

function styleSheet(ws, headers) {
  // Column widths
  const colWidths = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
  ws['!cols'] = colWidths;
  return ws;
}

async function exportSo(direction, monthYear) {
  const label = direction === 'incoming' ? 'Đến' : direction === 'outgoing' ? 'Đi' : 'NB';
  const docs = await fetchAllDocs(direction);
  const rows = direction === 'incoming' ? buildIncomingRows(docs)
    : direction === 'outgoing' ? buildOutgoingRows(docs)
    : buildInternalRows(docs);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  styleSheet(ws, headers);

  // Title row above data
  XLSX.utils.sheet_add_aoa(ws, [
    [`SỔ CÔNG VĂN ${label.toUpperCase()} — THỊNH LONG GROUP`],
    [monthYear ? `Kỳ: ${monthYear}` : `Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`],
    [],
  ], { origin: 'A1' });
  XLSX.utils.sheet_add_json(ws, rows, { origin: 'A4', skipHeader: false });

  const sheetName = `Sổ ${label}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `so-cong-van-${label.toLowerCase()}-${new Date().toISOString().slice(0,10)}.xlsx`);
}

/* ─── Constants ─── */
const TABS = [
  { id: 'incoming', label: 'Sổ Đến', icon: Inbox,    color: 'blue'  },
  { id: 'outgoing', label: 'Sổ Đi',  icon: Send,     color: 'cyan'  },
  { id: 'internal', label: 'Nội bộ', icon: Building2, color: 'slate' },
];

const STATUS_META = {
  draft:      { label: 'Nháp',       cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  sent:       { label: 'Đã gửi',     cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  received:   { label: 'Đã nhận',    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  processing: { label: 'Đang xử lý', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  completed:  { label: 'Hoàn thành', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  archived:   { label: 'Lưu trữ',    cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  cancelled:  { label: 'Huỷ',        cls: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
};

const PRIORITY_META = {
  normal:       { label: 'Thường',   cls: '' },
  urgent:       { label: '⚡ Khẩn',  cls: 'text-amber-600 font-bold' },
  very_urgent:  { label: '🔥 Hỏa tốc', cls: 'text-red-600 font-bold' },
  confidential: { label: '🔒 Mật',   cls: 'text-purple-600 font-bold' },
};

const DOC_TYPE_SHORT = {
  decision: 'QĐ', circular: 'TT', official_letter: 'CV',
  notice: 'TB', report: 'TrT', contract: 'HĐ',
  license: 'GP', letter: 'Thư', other: '...',
};

function fmtSeq(seq, year) {
  if (!seq) return '—';
  return `${String(seq).padStart(3, '0')}/${year ?? new Date().getFullYear()}`;
}

function Badge({ cls, children }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${cls}`}>
      {children}
    </span>
  );
}

function SkeletonRow({ cols }) {
  return (
    <tr className="animate-pulse border-b border-[var(--border-color)]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded" style={{ width: `${60 + (i * 17) % 35}%` }} />
        </td>
      ))}
    </tr>
  );
}

/* ─── Main Component ─── */
export default function OfficialDocumentsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const dir = params.get('dir') || 'incoming';
  const setDir = (d) => setParams({ dir: d });

  const [docs, setDocs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [exporting, setExp]     = useState(false);
  const [search, setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort]         = useState('-receivedDate');
  const searchRef               = useRef(null);

  const handleExport = async () => {
    setExp(true);
    try { await exportSo(dir); }
    catch (e) { console.error(e); alert('Lỗi xuất file: ' + e.message); }
    finally { setExp(false); };
  };

  const LIMIT = 20;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch whenever tab/page/sort/search changes
  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const where = { direction: { equals: dir } };
    if (debouncedSearch) {
      where.or = [
        { title: { contains: debouncedSearch } },
        { documentCode: { contains: debouncedSearch } },
        { officialNumber: { contains: debouncedSearch } },
        { issuingAuthority: { contains: debouncedSearch } },
        { recipient: { contains: debouncedSearch } },
      ];
    }
    const res = await listDocs('official-documents', {
      where, limit: LIMIT, page, sort, depth: 0,
    });
    setDocs(res.docs ?? []);
    setTotal(res.totalDocs ?? 0);
    setLoading(false);
  }, [dir, page, sort, debouncedSearch]);

  useEffect(() => { setPage(1); }, [dir, debouncedSearch]);
  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const toggleSort = (field) => {
    setSort((s) => s === field ? `-${field}` : s === `-${field}` ? field : `-${field}`);
  };
  const SortIcon = ({ field }) => {
    if (sort === field) return <SortAsc size={12} className="text-blue-500" />;
    if (sort === `-${field}`) return <SortDesc size={12} className="text-blue-500" />;
    return <SortAsc size={12} className="opacity-20" />;
  };

  const tab = TABS.find((t) => t.id === dir) ?? TABS[0];
  const TAB_COLOR = {
    blue:  { active: 'bg-blue-500 text-white shadow-lg shadow-blue-500/25', dot: 'bg-blue-500' },
    cyan:  { active: 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25',  dot: 'bg-cyan-500' },
    slate: { active: 'bg-slate-600 text-white shadow-lg shadow-slate-500/15', dot: 'bg-slate-500' },
  };

  // Column definitions per tab
  const columns = dir === 'incoming' ? [
    { key: 'incomingSequence', label: 'Số đến', w: 'w-20', sortKey: 'incomingSequence' },
    { key: 'receivedDate',    label: 'Ngày nhận', w: 'w-28', sortKey: 'receivedDate' },
    { key: 'issuingAuthority',label: 'Nơi gửi', w: 'w-44' },
    { key: 'officialNumber',  label: 'Số hiệu', w: 'w-36' },
    { key: 'issuedDate',      label: 'Ngày VB', w: 'w-28', sortKey: 'issuedDate' },
    { key: 'title',           label: 'Tên loại / Trích yếu', w: 'flex-1' },
    { key: 'recipient',       label: 'Nơi nhận', w: 'w-40' },
    { key: 'status',          label: 'Trạng thái', w: 'w-28' },
  ] : dir === 'outgoing' ? [
    { key: 'documentCode',    label: 'Số ký hiệu', w: 'w-32', sortKey: 'documentCode' },
    { key: 'issuedDate',      label: 'Ngày VB', w: 'w-28', sortKey: 'issuedDate' },
    { key: 'title',           label: 'Tên loại / Trích yếu', w: 'flex-1' },
    { key: 'signedBy',        label: 'Người ký', w: 'w-36' },
    { key: 'recipient',       label: 'Nơi nhận', w: 'w-40' },
    { key: 'responseRecipient', label: 'Nhận hồi lời', w: 'w-36' },
    { key: 'copiesCount',     label: 'Số bản', w: 'w-16' },
    { key: 'status',          label: 'Trạng thái', w: 'w-28' },
  ] : [
    { key: 'documentCode',    label: 'Mã CV', w: 'w-32', sortKey: 'documentCode' },
    { key: 'issuedDate',      label: 'Ngày', w: 'w-28', sortKey: 'issuedDate' },
    { key: 'title',           label: 'Tiêu đề / Trích yếu', w: 'flex-1' },
    { key: 'issuingAuthority', label: 'Phòng ban', w: 'w-40' },
    { key: 'recipient',       label: 'Nơi nhận', w: 'w-40' },
    { key: 'assignedTo',      label: 'Giao cho', w: 'w-36' },
    { key: 'status',          label: 'Trạng thái', w: 'w-28' },
  ];

  function renderCell(col, doc) {
    switch (col.key) {
      case 'incomingSequence': {
        const yr = doc.issuedDate ? new Date(doc.issuedDate).getFullYear() : new Date().getFullYear();
        return <span className="font-mono text-blue-600 dark:text-blue-400 font-bold text-sm">{fmtSeq(doc.incomingSequence, yr)}</span>;
      }
      case 'documentCode':
        return <span className="font-mono text-blue-600 dark:text-blue-400 font-bold text-sm">{doc.documentCode ?? '—'}</span>;
      case 'receivedDate':
        return <span className="text-sm">{fmtDate(doc.receivedDate) || fmtDate(doc.createdAt) || '—'}</span>;
      case 'issuedDate':
        return <span className="text-sm">{fmtDate(doc.issuedDate) || '—'}</span>;
      case 'issuingAuthority':
        return <span className="text-sm truncate block max-w-[10rem]" title={doc.issuingAuthority}>{doc.issuingAuthority || '—'}</span>;
      case 'officialNumber':
        return <span className="text-sm font-mono text-slate-600 dark:text-slate-400">{doc.officialNumber || '—'}</span>;
      case 'title': {
        const type = DOC_TYPE_SHORT[doc.documentType];
        return (
          <div className="min-w-0">
            {type && <span className="mr-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{type}</span>}
            <span className="text-sm font-semibold text-[var(--text-main)] line-clamp-1">{doc.title || '—'}</span>
            {doc.priority && doc.priority !== 'normal' && (
              <span className={`ml-2 text-[10px] ${PRIORITY_META[doc.priority]?.cls ?? ''}`}>
                {PRIORITY_META[doc.priority]?.label}
              </span>
            )}
          </div>
        );
      }
      case 'recipient':
      case 'responseRecipient':
        return <span className="text-sm truncate block max-w-[9rem] text-slate-600 dark:text-slate-400" title={doc[col.key]}>{doc[col.key] || '—'}</span>;
      case 'signedBy':
        return <span className="text-sm text-slate-600 dark:text-slate-400">{doc.signedBy || '—'}</span>;
      case 'copiesCount':
        return <span className="text-sm text-center block">{doc.copiesCount ?? '—'}</span>;
      case 'assignedTo': {
        const a = doc.assignedTo;
        return <span className="text-sm">{typeof a === 'object' ? (a?.fullName ?? '—') : (a ? '...' : '—')}</span>;
      }
      case 'status': {
        const s = STATUS_META[doc.status];
        return s ? <Badge cls={s.cls}>{s.label}</Badge> : <span className="text-sm text-slate-400">{doc.status ?? '—'}</span>;
      }
      default:
        return <span className="text-sm">{doc[col.key] ?? '—'}</span>;
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full gap-5">
      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <FileText size={18} className="text-white" />
            </div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent tracking-tight">
              Quản lý Công văn
            </h2>
          </div>
          <p className="text-sm text-[var(--text-muted)] font-medium ml-12">
            Sổ công văn đến / đi / nội bộ — Phòng Hành chính
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-500/40 text-green-600 dark:text-green-400 text-sm font-bold hover:bg-green-500/10 hover:border-green-500/60 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
            title={`Xuất Sổ ${dir === 'incoming' ? 'Đến' : dir === 'outgoing' ? 'Đi' : 'Nội bộ'} ra Excel`}
          >
            {exporting
              ? <><Loader2 size={15} className="animate-spin" /> Đang xuất...</>
              : <><Download size={15} /> Xuất Sổ Excel</>}
          </button>
          <button
            onClick={() => navigate('/official-documents/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-200"
          >
            <Plus size={16} /> Thêm công văn
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-sm">
          {TABS.map((t) => {
            const active = dir === t.id;
            const col = TAB_COLOR[t.color];
            return (
              <button
                key={t.id}
                onClick={() => setDir(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                  active ? col.active : 'text-slate-500 dark:text-slate-400 hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <t.icon size={15} />
                {t.label}
                {active && total > 0 && (
                  <span className="bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {total}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm số hiệu, trích yếu, đơn vị..."
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-sm text-[var(--text-main)] placeholder-slate-400 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={fetchDocs}
          className="p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] text-slate-500 hover:text-blue-500 hover:border-blue-500/30 transition-all"
          title="Làm mới"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Table ── */}
      <div className="glass-card overflow-hidden flex-1 flex flex-col">
        {/* Table Header */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full min-w-max border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--sidebar-bg)]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left ${col.w === 'flex-1' ? 'min-w-[240px]' : col.w}`}
                  >
                    {col.sortKey ? (
                      <button
                        onClick={() => toggleSort(col.sortKey)}
                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-[var(--text-main)] transition-colors"
                      >
                        {col.label}
                        <SortIcon field={col.sortKey} />
                      </button>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {col.label}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} />
              ))}
              {!loading && docs.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <FileText size={40} className="opacity-20" />
                      <p className="font-semibold">Không có công văn nào</p>
                      {search && <p className="text-xs">Thử tìm với từ khóa khác</p>}
                    </div>
                  </td>
                </tr>
              )}
              <AnimatePresence mode="popLayout">
                {!loading && docs.map((doc, idx) => (
                  <motion.tr
                    key={doc.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => navigate(`/official-documents/${doc.id}`)}
                    className="border-b border-[var(--border-color)] hover:bg-blue-500/[0.03] cursor-pointer group transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={`px-4 py-3 ${col.w === 'flex-1' ? 'min-w-[240px]' : col.w}`}>
                        {renderCell(col, doc)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-color)] bg-[var(--sidebar-bg)]">
            <span className="text-xs text-slate-500 font-medium">
              {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} / <strong>{total}</strong> công văn
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pg = i + 1;
                if (totalPages > 7) {
                  if (page <= 4) pg = i + 1;
                  else if (page >= totalPages - 3) pg = totalPages - 6 + i;
                  else pg = page - 3 + i;
                }
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      pg === page
                        ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                        : 'text-slate-400 hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
