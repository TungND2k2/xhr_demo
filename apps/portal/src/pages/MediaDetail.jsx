import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, ExternalLink, FileText, Image as ImageIcon } from 'lucide-react';
import { getDoc } from '../api/payload';
import DeleteButton from '../components/DeleteButton';
import { fmtDate } from '../lib/workers-labels';
import RichText from '../components/RichText';

const PUBLIC_BASE = '/api/media/file';

// URL public của file (để Office Online / Google Docs viewer fetch được).
// Phải dùng full URL CMS, không phải localhost proxy.
const PUBLIC_HOST = import.meta.env.VITE_PAYLOAD_URL || '';

const OFFICE_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/msword',          // .doc
  'application/vnd.ms-excel',    // .xls
  'application/vnd.ms-powerpoint', // .ppt
]);

export default function MediaDetail({ recordId, onBack }) {
  const [media, setMedia] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    getDoc('media', recordId, 1).then((m) => {
      setMedia(m);
      setLoading(false);
    });
  }, [recordId]);

  if (loading) return <div className="text-center py-24 text-slate-500">Đang tải file...</div>;
  if (!media) return <div className="text-center py-24 text-red-500">Không tải được file này.</div>;

  const mime = media.mimeType ?? '';
  const fileUrl = `${PUBLIC_BASE}/${encodeURIComponent(media.filename)}`;
  const publicFileUrl = `${PUBLIC_HOST}${PUBLIC_BASE}/${encodeURIComponent(media.filename)}`;
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf';
  const isText = mime.startsWith('text/') || mime === 'application/json';
  const isOffice = OFFICE_MIMES.has(mime);
  const officeViewerUrl = isOffice
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicFileUrl)}`
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 print-area">
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-main)] transition-colors">
          <ArrowLeft size={16} /> Quay lại Tệp tin
        </button>
        <div className="flex gap-2">
          <a href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
            <ExternalLink size={14} /> Mở tab mới
          </a>
          <a href={fileUrl} download={media.filename} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-blue-500/40 text-blue-500 hover:bg-blue-500/10 transition-all">
            <Download size={14} /> Tải về
          </a>
          <DeleteButton
            collection="media"
            recordId={media.id}
            recordLabel={media.filename}
            onDeleted={onBack}
          />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-black text-[var(--text-main)] break-all">{media.filename}</h2>
        <p className="text-xs text-slate-500 mt-1">{mime} · {(media.filesize ?? 0) > 0 ? `${Math.round(media.filesize / 1024).toLocaleString()} KB` : ''}</p>
      </div>

      {/* Preview */}
      <div className="glass-card p-4">
        {isImage && (
          <img
            src={fileUrl}
            alt={media.alt ?? media.filename}
            className="max-w-full max-h-[70vh] mx-auto rounded-lg object-contain bg-black/5 dark:bg-white/5"
          />
        )}
        {isPdf && (
          <iframe
            src={fileUrl}
            title={media.filename}
            className="w-full h-[70vh] rounded-lg border-0"
          />
        )}
        {isText && <TextPreview url={fileUrl} />}
        {isOffice && officeViewerUrl && (
          <>
            <iframe
              src={officeViewerUrl}
              title={media.filename}
              className="w-full h-[75vh] rounded-lg border-0"
            />
            <p className="text-[10px] text-slate-500 mt-2 text-center">
              Powered by Microsoft Office Online — preview only, không edit được.
            </p>
          </>
        )}
        {!isImage && !isPdf && !isText && !isOffice && (
          <div className="py-16 text-center text-slate-500">
            <FileText size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Định dạng <code className="text-xs">{mime}</code> không xem trực tiếp được.</p>
            <p className="text-xs mt-2">Bấm nút <b>Tải về</b> hoặc <b>Mở tab mới</b> ở trên.</p>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Thông tin</h3>
          <div className="space-y-2.5 text-sm">
            <KV label="Tên file" value={media.filename} mono />
            <KV label="Loại" value={media.kind} />
            <KV label="Mô tả ngắn (alt)" value={media.alt} />
            <KV label="Mime" value={mime} mono />
            <KV label="Kích cỡ" value={media.filesize ? `${Math.round(media.filesize / 1024).toLocaleString()} KB` : null} />
            <KV label="Nguồn" value={media.uploadedFrom} />
            <KV label="Tải lên" value={fmtDate(media.uploadedAt)} />
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Liên kết với record</h3>
          {Array.isArray(media.linkedRecords) && media.linkedRecords.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {media.linkedRecords.map((l, i) => {
                const ref = typeof l.value === 'object' ? l.value : { id: l.value };
                const label = ref.fullName || ref.name || ref.title || ref.contractCode || ref.workerCode || ref.orderCode || ref.documentCode || ref.id;
                return (
                  <li key={i} className="flex items-center gap-2 text-[var(--text-main)]">
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-bold">{l.relationTo}</span>
                    <span>{label}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Chưa link với record nào.</p>
          )}
        </div>
      </div>

      {/* AI description */}
      {media.description && (
        <div className="glass-card p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
            🤖 Mô tả nội dung (AI)
          </h3>
          <RichText text={media.description} />
        </div>
      )}

      {/* Extracted text */}
      {media.extractedText && (
        <details className="glass-card p-6">
          <summary className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 cursor-pointer">
            Text gốc đã trích (markdown)
          </summary>
          <pre className="text-xs text-[var(--text-muted)] whitespace-pre-wrap mt-4 max-h-[40vh] overflow-y-auto">
            {media.extractedText}
          </pre>
        </details>
      )}
    </motion.div>
  );
}

function KV({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--border-color)] pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`font-medium text-right break-all max-w-[60%] ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function TextPreview({ url }) {
  const [text, setText] = useState('Đang tải...');
  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then((t) => setText(t.slice(0, 50_000)))
      .catch(() => setText('(Không tải được nội dung)'));
  }, [url]);
  return <pre className="text-xs whitespace-pre-wrap max-h-[60vh] overflow-y-auto p-4">{text}</pre>;
}
