import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Printer, ShieldAlert, Wallet, Calendar, Hash,
  MapPin, User, FileText as FileTextIcon, Wrench, ArrowUpCircle, Sparkles,
} from 'lucide-react';
import { getDoc } from '../api/payload';
import { printPdf } from '../lib/export';
import { fmtVND, fmtDate } from '../lib/workers-labels';
import DeleteButton from '../components/DeleteButton';
import {
  CATEGORY_META, STATUS_META, TINT_CLASS, MAINTENANCE_KIND_LABELS,
  daysUntil, lineValue,
} from '../lib/assets-meta';

const MAINTENANCE_KIND_META = {
  periodic: { icon: Sparkles,       tint: 'blue' },
  repair:   { icon: Wrench,         tint: 'amber' },
  upgrade:  { icon: ArrowUpCircle,  tint: 'green' },
};

export default function AssetDetailPage({ recordId, onBack }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recordId) return;
    setLoading(true);
    getDoc('assets', recordId, 2).then((d) => {
      setDoc(d);
      setLoading(false);
    });
  }, [recordId]);

  const maintenanceCost = useMemo(() => {
    if (!doc?.maintenanceLog?.length) return 0;
    return doc.maintenanceLog.reduce((s, m) => s + (Number(m.cost) || 0), 0);
  }, [doc]);

  if (loading) return <div className="text-center py-24 text-slate-500">Đang tải...</div>;
  if (!doc) return <div className="text-center py-24 text-red-500">Không tải được tài sản này.</div>;

  const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.other;
  const status = STATUS_META[doc.status] ?? STATUS_META.in_use;
  const Icon = meta.icon;
  const assignedName = typeof doc.assignedTo === 'object' ? doc.assignedTo?.fullName : null;
  const assignedEmail = typeof doc.assignedTo === 'object' ? doc.assignedTo?.email : null;
  const value = lineValue(doc);
  const warrantyDays = daysUntil(doc.warrantyUntil);
  const sortedLog = (doc.maintenanceLog ?? [])
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 print-area">
      {/* Top bar */}
      <div className="flex items-center justify-between no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-main)] transition-colors">
          <ArrowLeft size={16} /> Quay lại Tài sản
        </button>
        <div className="flex items-center gap-2">
          <button onClick={printPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
            <Printer size={14} /> Xuất PDF
          </button>
          <DeleteButton
            collection="assets"
            recordId={doc.id}
            recordLabel={doc.name ?? doc.assetCode}
            onDeleted={onBack}
          />
        </div>
      </div>

      {/* Hero */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className={`shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center ${TINT_CLASS[meta.tint]}`}>
            <Icon size={36} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs text-blue-500 font-bold">{doc.assetCode ?? '—'}</span>
              <span className="text-[10px] text-slate-500">·</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{meta.label}</span>
              {Number(doc.quantity) > 1 && (
                <>
                  <span className="text-[10px] text-slate-500">·</span>
                  <span className="text-[10px] font-bold text-slate-500">SL ×{doc.quantity}</span>
                </>
              )}
            </div>
            <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tight break-words">{doc.name ?? '—'}</h2>
            <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${status.chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[var(--border-color)]">
          <MiniKpi icon={Wallet}      label="Tổng giá trị" value={fmtVND(value)}                  tint="green" />
          <MiniKpi icon={Calendar}    label="Ngày mua"     value={fmtDate(doc.purchaseDate)}      tint="blue" />
          <MiniKpi icon={ShieldAlert} label="Bảo hành"
            value={
              warrantyDays == null ? '—'
              : warrantyDays < 0 ? `Hết ${-warrantyDays}d`
              : `Còn ${warrantyDays}d`
            }
            tint={warrantyDays != null && warrantyDays < 0 ? 'slate' : warrantyDays != null && warrantyDays <= 30 ? 'red' : 'blue'} />
          <MiniKpi icon={Wrench} label="Chi phí bảo trì"
            value={maintenanceCost > 0 ? fmtVND(maintenanceCost) : '—'}
            tint={maintenanceCost > 0 ? 'amber' : 'slate'} />
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — specs + person + notes */}
        <div className="space-y-6">
          <Section title="Thông số" icon={Hash}>
            <Row label="Mã tài sản" value={doc.assetCode} mono />
            <Row label="Loại" value={meta.label} />
            <Row label="Số lượng" value={doc.quantity ?? 1} />
            <Row label="Serial / Số khung" value={doc.serialNumber} mono />
            <Row label="Đơn giá" value={doc.purchaseValue ? `${Number(doc.purchaseValue).toLocaleString('vi-VN')} VND` : null} />
            <Row label="Bảo hành đến" value={fmtDate(doc.warrantyUntil)} />
          </Section>

          <Section title="Người mượn / phụ trách" icon={User}>
            {assignedName ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                  {assignedName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-main)] truncate">{assignedName}</p>
                  {assignedEmail && <p className="text-[11px] text-slate-500 truncate">{assignedEmail}</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">— Chưa giao</p>
            )}
            {doc.location && (
              <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-slate-500 shrink-0" />
                <span className="text-[var(--text-main)]">{doc.location}</span>
              </div>
            )}
          </Section>

          {doc.notes && (
            <Section title="Ghi chú" icon={FileTextIcon}>
              <pre className="font-sans whitespace-pre-wrap text-[13px] text-[var(--text-main)] leading-relaxed bg-black/[0.02] dark:bg-white/[0.02] rounded-lg p-3 m-0">
                {doc.notes}
              </pre>
            </Section>
          )}
        </div>

        {/* RIGHT — maintenance timeline */}
        <div className="space-y-6">
          <Section
            title={`Lịch sử bảo trì${sortedLog.length > 0 ? ` (${sortedLog.length})` : ''}`}
            icon={Wrench}
          >
            {sortedLog.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có ghi nhận bảo trì nào.</p>
            ) : (
              <div className="space-y-3">
                {sortedLog.map((m, i) => {
                  const km = MAINTENANCE_KIND_META[m.kind] ?? MAINTENANCE_KIND_META.repair;
                  const KIcon = km.icon;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TINT_CLASS[km.tint]}`}>
                          <KIcon size={14} />
                        </div>
                        {i < sortedLog.length - 1 && <div className="flex-1 w-px bg-[var(--border-color)] mt-1" />}
                      </div>
                      <div className="min-w-0 flex-1 pb-3">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-wider">
                            {MAINTENANCE_KIND_LABELS[m.kind] ?? m.kind ?? 'Bảo trì'}
                          </span>
                          <span className="text-[11px] text-slate-500">{fmtDate(m.date)}</span>
                          {m.cost > 0 && (
                            <span className="ml-auto text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              {Number(m.cost).toLocaleString('vi-VN')} VND
                            </span>
                          )}
                        </div>
                        {m.vendor && (
                          <p className="text-[12px] text-slate-500 mb-1">{m.vendor}</p>
                        )}
                        {m.description && (
                          <p className="text-[13px] text-[var(--text-main)] leading-relaxed">{m.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Hệ thống" subtle>
            <Row label="Tạo lúc" value={doc.createdAt ? new Date(doc.createdAt).toLocaleString('vi-VN') : null} />
            <Row label="Cập nhật" value={doc.updatedAt ? new Date(doc.updatedAt).toLocaleString('vi-VN') : null} />
            <Row label="ID" value={doc.id} mono />
          </Section>
        </div>
      </div>
    </motion.div>
  );
}

function MiniKpi({ icon: Icon, label, value, tint }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-xl shrink-0 ${TINT_CLASS[tint]}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-black text-[var(--text-main)] truncate">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, subtle }) {
  return (
    <div className={`glass-card p-6 ${subtle ? 'opacity-90' : ''}`}>
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
        {Icon && <Icon size={14} className="text-blue-500" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value, mono }) {
  const empty = value === null || value === undefined || value === '' || value === '—';
  return (
    <div className="flex justify-between gap-3 text-sm border-b border-[var(--border-color)] py-2 last:border-0 last:pb-0 first:pt-0">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className={`font-medium text-right break-words max-w-[60%] ${mono ? 'font-mono text-xs' : ''} text-[var(--text-main)]`}>
        {empty ? '—' : value}
      </span>
    </div>
  );
}
