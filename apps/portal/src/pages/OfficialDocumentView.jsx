import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Edit2, Save, X, Printer, Inbox, Send, Building, Calendar,
  User, Paperclip, LinkIcon, AlertTriangle, CheckCircle2, Hourglass, FileText,
} from 'lucide-react';
import { getDoc, fetchPayload } from '../api/payload';
import { fmtDate } from '../lib/workers-labels';
import { printPdf } from '../lib/export';
import RichText from '../components/RichText';
import DeleteButton from '../components/DeleteButton';

const DIRECTION_META = {
  incoming: { label: '📥 Đến', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Inbox },
  outgoing: { label: '📤 Đi',  color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400', icon: Send },
  internal: { label: '🏢 Nội bộ', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400', icon: Building },
};
const STATUS_META = {
  draft:      { label: '📝 Nháp',       color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400', icon: FileText },
  sent:       { label: '✉️ Đã gửi',     color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Send },
  received:   { label: '📬 Đã nhận',    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Inbox },
  processing: { label: '⏳ Đang xử lý', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: Hourglass },
  completed:  { label: '✅ Hoàn thành', color: 'bg-green-500/10 text-green-600 dark:text-green-400', icon: CheckCircle2 },
  archived:   { label: '📦 Lưu trữ',    color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400', icon: FileText },
  cancelled:  { label: '❌ Huỷ',        color: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: X },
};
const PRIORITY_META = {
  normal:       { label: 'Thường',     color: 'bg-slate-500/10 text-slate-500' },
  urgent:       { label: '🚨 Khẩn',    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  very_urgent:  { label: '🔥 Rất khẩn', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  confidential: { label: '🔒 Mật',      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
};

function daysLeft(deadline) {
  if (!deadline) return null;
  const d = (new Date(deadline).getTime() - Date.now()) / 86_400_000;
  return Math.ceil(d);
}

function mediaLink(m) {
  if (!m) return null;
  const id = typeof m === 'object' ? m.id : m;
  const filename = typeof m === 'object' ? (m.filename ?? m.alt ?? `media#${id}`) : `media#${id}`;
  return (
    <Link to={`/media/${id}`} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-blue-500/10 border border-[var(--border-color)] hover:border-blue-500/20 group transition-all duration-200 shadow-sm mt-1.5 w-full">
      <Paperclip size={14} className="text-blue-500 shrink-0 group-hover:scale-110 transition-transform" />
      <span className="text-xs font-semibold text-[var(--text-main)] truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">{filename}</span>
    </Link>
  );
}

function relatedLink(r) {
  if (!r) return null;
  const relationTo = r.relationTo;
  const v = r.value;
  const id = typeof v === 'object' ? v.id : v;
  const label = typeof v === 'object'
    ? (v.fullName || v.title || v.contractCode || v.workerCode || v.orderCode || v.documentCode || v.name || v.contractNumber || v.id)
    : id;
  const COLLECTION_ICON = {
    workers: '👤', orders: '📦', contracts: '📜', 'supply-contracts': '🤝',
    partners: '🏢', employees: '🧑‍💼', 'official-documents': '📨',
  };
  const COLLECTION_LABEL = {
    workers: 'LĐ', orders: 'Đơn', contracts: 'HĐLĐ', 'supply-contracts': 'HĐCU',
    partners: 'Đối tác', employees: 'NV', 'official-documents': 'CV',
  };
  return (
    <Link to={`/${relationTo}/${id}`} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-500/5 group transition-colors">
      <span className="text-base shrink-0">{COLLECTION_ICON[relationTo] ?? '🔗'}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{COLLECTION_LABEL[relationTo] ?? relationTo}</div>
        <div className="text-xs text-[var(--text-main)] truncate group-hover:underline">{label}</div>
      </div>
    </Link>
  );
}

export default function OfficialDocumentView({ recordId, onBack }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const d = await getDoc('official-documents', recordId, 2);
    setDoc(d);
    setLoading(false);
  };
  useEffect(() => { if (recordId) load(); /* eslint-disable-next-line */ }, [recordId]);

  const live = useMemo(() => ({ ...doc, ...dirty }), [doc, dirty]);

  const handleSave = async () => {
    if (Object.keys(dirty).length === 0) { setEditMode(false); return; }
    setSaving(true);
    try {
      const patch = { ...dirty };
      const r = await fetchPayload(`/official-documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        alert(`Lưu thất bại HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`);
        return;
      }
      setDirty({});
      setEditMode(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-24 text-slate-500">Đang tải...</div>;
  if (!doc) return <div className="text-center py-24 text-red-500">Không tải được công văn.</div>;

  const d = live;
  const dir = DIRECTION_META[d.direction];
  const stat = STATUS_META[d.status];
  const prio = PRIORITY_META[d.priority];
  const assigned = typeof d.assignedTo === 'object' ? d.assignedTo : null;
  const respDoc = typeof d.responseDocument === 'object' ? d.responseDocument : null;
  const deadlineDays = daysLeft(d.deadline);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-[var(--text-main)] transition-colors">
          <ArrowLeft size={16} /> QUAY LẠI
        </button>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <button onClick={printPdf} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border-color)] hover:border-red-500/30 hover:bg-red-500/5 text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-all shadow-sm">
                <Printer size={14} className="text-red-500" /> In / PDF
              </button>
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-blue-500/40 text-blue-500 hover:bg-blue-500/10 transition-all shadow-sm">
                <Edit2 size={14} /> Sửa
              </button>
              <DeleteButton
                collection="official-documents"
                recordId={doc.id}
                recordLabel={doc.title ?? doc.documentCode}
                onDeleted={onBack}
              />
            </>
          ) : (
            <>
              <button onClick={() => { setDirty({}); setEditMode(false); }} disabled={saving} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-[var(--border-color)] hover:bg-black/5"><X size={14} /> Huỷ</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-green-500/40 text-green-600 hover:bg-green-500/10 disabled:opacity-40">
                <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* MAIN + SIDEBAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print-area">
        {/* MAIN COLUMN */}
        <div className="lg:col-span-8 space-y-5">
          {/* Header card */}
          <div className="glass-card p-6">
            {/* Tag bar */}
            <div className="flex flex-wrap gap-2 mb-4">
              {dir && <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${dir.color}`}>{dir.label}</span>}
              {stat && <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${stat.color}`}>{stat.label}</span>}
              {prio && d.priority && d.priority !== 'normal' && (
                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${prio.color}`}>{prio.label}</span>
              )}
              {d.documentType && <span className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-500/10 text-slate-500">{d.documentType}</span>}
            </div>

            {/* Title */}
            {editMode ? (
              <input
                type="text"
                value={String(d.title ?? '')}
                onChange={(e) => setDirty((x) => ({ ...x, title: e.target.value }))}
                className="w-full text-2xl font-black text-[var(--text-main)] bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2"
              />
            ) : (
              <h1 className="text-2xl font-black text-[var(--text-main)] leading-snug">{d.title ?? '(không tiêu đề)'}</h1>
            )}
            <p className="text-xs text-slate-500 mt-2 font-mono">{d.documentCode ?? '—'}</p>

            {/* From / To */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-[var(--border-color)]">
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Đơn vị ban hành</div>
                {editMode ? (
                  <input type="text" value={String(d.issuingAuthority ?? '')} onChange={(e) => setDirty((x) => ({ ...x, issuingAuthority: e.target.value }))} className="w-full text-sm bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-1.5" />
                ) : (
                  <div className="text-sm font-semibold text-[var(--text-main)]">{d.issuingAuthority ?? '—'}</div>
                )}
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <Calendar size={11} /> Ngày ban hành: {fmtDate(d.issuedDate)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Nơi nhận</div>
                {editMode ? (
                  <input type="text" value={String(d.recipient ?? '')} onChange={(e) => setDirty((x) => ({ ...x, recipient: e.target.value }))} className="w-full text-sm bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-1.5" />
                ) : (
                  <div className="text-sm font-semibold text-[var(--text-main)]">{d.recipient ?? '—'}</div>
                )}
                {d.officialNumber && (
                  <div className="text-xs text-slate-500 mt-1 font-mono">Số gốc: {d.officialNumber}</div>
                )}
              </div>
            </div>

            {/* Extra meta row — Số đến, ngày nhận, người ký, số bản */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-[var(--border-color)]">
              {d.direction === 'incoming' && (
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Số đến</div>
                  {editMode ? (
                    <input type="number" min={1} value={d.incomingSequence ?? ''} onChange={(e) => setDirty((x) => ({ ...x, incomingSequence: e.target.value ? Number(e.target.value) : null }))} className="w-full text-sm bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-1.5" placeholder="VD: 7" />
                  ) : (
                    <div className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono">
                      {d.incomingSequence ? `${String(d.incomingSequence).padStart(3,'0')}/${d.issuedDate ? new Date(d.issuedDate).getFullYear() : new Date().getFullYear()}` : '—'}
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  {d.direction === 'incoming' ? 'Ngày nhận' : 'Ngày phát hành'}
                </div>
                {editMode ? (
                  <input type="date" value={(d.receivedDate ?? d.issuedDate ?? '').slice(0, 10)} onChange={(e) => setDirty((x) => ({ ...x, receivedDate: e.target.value }))} className="w-full text-sm bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-1.5" />
                ) : (
                  <div className="text-sm font-semibold">{fmtDate(d.receivedDate) || fmtDate(d.issuedDate) || '—'}</div>
                )}
              </div>
              {d.direction !== 'incoming' && (
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Người ký</div>
                  {editMode ? (
                    <input type="text" value={d.signedBy ?? ''} onChange={(e) => setDirty((x) => ({ ...x, signedBy: e.target.value }))} className="w-full text-sm bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-1.5" />
                  ) : (
                    <div className="text-sm font-semibold">{d.signedBy || '—'}</div>
                  )}
                </div>
              )}
              {d.direction === 'outgoing' && (
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Nhận hồi lời</div>
                  {editMode ? (
                    <input type="text" value={d.responseRecipient ?? ''} onChange={(e) => setDirty((x) => ({ ...x, responseRecipient: e.target.value }))} className="w-full text-sm bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-1.5" placeholder="Phòng HC, P. Giám đốc..." />
                  ) : (
                    <div className="text-sm font-semibold">{d.responseRecipient || '—'}</div>
                  )}
                </div>
              )}
              {d.direction !== 'incoming' && (
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Số bản</div>
                  {editMode ? (
                    <input type="number" min={1} value={d.copiesCount ?? 1} onChange={(e) => setDirty((x) => ({ ...x, copiesCount: Number(e.target.value) }))} className="w-full text-sm bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-1.5" />
                  ) : (
                    <div className="text-sm font-semibold">{d.copiesCount ?? 1}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          {(d.summary || editMode) && (
            <div className="glass-card p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                📋 Tóm tắt
              </h3>
              {editMode ? (
                <textarea value={String(d.summary ?? '')} onChange={(e) => setDirty((x) => ({ ...x, summary: e.target.value }))} rows={6} className="portal-edit-input font-mono" placeholder="Hỗ trợ Markdown: **bold**, *italic*, - danh sách, 1. số thứ tự, ## tiêu đề" />
              ) : (
                <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed font-semibold text-[var(--text-main)]">
                  <RichText text={d.summary} />
                </div>
              )}
            </div>
          )}

          {/* Content */}
          {(d.content || editMode) && (
            <div className="glass-card p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                📄 Nội dung chi tiết
              </h3>
              {editMode ? (
                <textarea value={String(d.content ?? '')} onChange={(e) => setDirty((x) => ({ ...x, content: e.target.value }))} rows={10} className="portal-edit-input font-mono" placeholder="Hỗ trợ Markdown" />
              ) : (
                <div className="prose dark:prose-invert max-w-none text-xs leading-relaxed font-semibold text-[var(--text-main)]">
                  <RichText text={d.content} />
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {(d.notes || editMode) && (
            <div className="glass-card p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">💬 Ghi chú nội bộ</h3>
              {editMode ? (
                <textarea value={String(d.notes ?? '')} onChange={(e) => setDirty((x) => ({ ...x, notes: e.target.value }))} rows={3} className="w-full text-sm bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2" />
              ) : (
                <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap">{d.notes}</p>
              )}
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4 self-start">
          {/* Xử lý */}
          <div className="glass-card p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <Hourglass size={13} className="text-blue-500" /> Xử lý
            </h3>
            <div className="space-y-3">
              <SidebarRow icon={User} label="Người được giao">
                {assigned ? <span className="font-semibold">{assigned.fullName ?? assigned.id}</span> : <span className="text-slate-400">—</span>}
              </SidebarRow>
              <SidebarRow icon={Calendar} label="Hạn xử lý">
                {d.deadline ? (
                  <span>
                    {fmtDate(d.deadline)}
                    {deadlineDays != null && (
                      <span className={`ml-2 text-[10px] font-bold ${deadlineDays < 0 ? 'text-red-500' : deadlineDays <= 3 ? 'text-amber-500' : 'text-slate-500'}`}>
                        ({deadlineDays < 0 ? `quá ${-deadlineDays}d` : `còn ${deadlineDays}d`})
                      </span>
                    )}
                  </span>
                ) : <span className="text-slate-400">—</span>}
              </SidebarRow>
              <SidebarRow icon={CheckCircle2} label="Hoàn thành lúc">
                {d.completedAt ? fmtDate(d.completedAt) : <span className="text-slate-400">—</span>}
              </SidebarRow>
              {respDoc && (
                <SidebarRow icon={LinkIcon} label="Phúc đáp">
                  <Link to={`/official-documents/${respDoc.id}`} className="text-blue-500 hover:underline font-mono text-xs">
                    {respDoc.documentCode ?? respDoc.id}
                  </Link>
                </SidebarRow>
              )}
            </div>
          </div>

          {/* Đính kèm */}
          {(d.scanFile || (Array.isArray(d.attachments) && d.attachments.length > 0)) && (
            <div className="glass-card p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <Paperclip size={13} className="text-blue-500" /> Đính kèm
              </h3>
              <div className="space-y-1 -mx-2">
                {d.scanFile && (
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-0.5">Bản gốc</div>
                    {mediaLink(d.scanFile)}
                  </div>
                )}
                {Array.isArray(d.attachments) && d.attachments.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-0.5">Phụ lục ({d.attachments.length})</div>
                    {d.attachments.map((att, i) => <div key={i}>{mediaLink(att)}</div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Liên quan */}
          {Array.isArray(d.relatedRecords) && d.relatedRecords.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <LinkIcon size={13} className="text-blue-500" /> Liên quan
              </h3>
              <div className="space-y-1 -mx-2">
                {d.relatedRecords.map((r, i) => <div key={i}>{relatedLink(r)}</div>)}
              </div>
            </div>
          )}

          {/* Alert nếu sắp deadline */}
          {deadlineDays != null && deadlineDays <= 3 && d.status !== 'completed' && (
            <div className="glass-card p-4 border-amber-500/40 bg-amber-500/5">
              <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold">{deadlineDays < 0 ? 'Quá hạn xử lý!' : 'Sắp đến hạn!'}</div>
                  <div className="mt-0.5">{deadlineDays < 0 ? `Quá hạn ${-deadlineDays} ngày` : `Còn ${deadlineDays} ngày`}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SidebarRow({ icon: Icon, label, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5">
        <Icon size={11} /> {label}
      </div>
      <div className="text-sm text-[var(--text-main)] pl-4">{children}</div>
    </div>
  );
}
