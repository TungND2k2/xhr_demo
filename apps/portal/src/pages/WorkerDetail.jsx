import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer } from 'lucide-react';
import { getDoc } from '../api/payload';
import {
  WORKER_STATUS_LABELS,
  MARKET_LABELS,
  fmtVND,
  fmtDate,
} from '../lib/workers-labels';
import { printPdf } from '../lib/export';

const SECTIONS = [
  {
    title: 'Thông tin cơ bản',
    fields: [
      ['fullName', 'Họ tên'],
      ['dob', 'Ngày sinh', fmtDate],
      ['gender', 'Giới tính'],
      ['nationalId', 'CCCD'],
      ['passportNo', 'Hộ chiếu'],
      ['phone', 'SĐT'],
      ['email', 'Email'],
      ['hometown', 'Quê'],
      ['address', 'Địa chỉ'],
    ],
  },
  {
    title: 'Đặt cọc',
    fields: [
      ['depositAmount', 'Số tiền', fmtVND],
      ['depositDate', 'Ngày nộp', fmtDate],
      ['depositRefundedAt', 'Ngày hoàn', fmtDate],
      ['depositNote', 'Ghi chú'],
    ],
  },
  {
    title: 'Đào tạo',
    fields: [
      ['trainingGroup', 'Lớp'],
      ['trainingStartDate', 'Bắt đầu', fmtDate],
      ['trainingEndDate', 'Kết thúc', fmtDate],
      ['examResult', 'Kết quả thi'],
      ['examScore', 'Điểm'],
    ],
  },
  {
    title: 'Sức khoẻ',
    fields: [
      ['healthCheckDate', 'Ngày khám', fmtDate],
      ['healthCheckLocation', 'Nơi khám'],
      ['healthStatus', 'Tình trạng'],
      ['healthNotes', 'Ghi chú'],
    ],
  },
];

export default function WorkerDetail({ workerId, onBack }) {
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workerId) return;
    setLoading(true);
    getDoc('workers', workerId, 1).then((w) => {
      setWorker(w);
      setLoading(false);
    });
  }, [workerId]);

  if (loading) {
    return <div className="text-center py-24 text-slate-500">Đang tải hồ sơ...</div>;
  }
  if (!worker) {
    return <div className="text-center py-24 text-red-500">Không tải được hồ sơ này.</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 print-area"
    >
      <div className="flex items-center justify-between no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-[var(--text-main)] transition-colors"
        >
          <ArrowLeft size={16} /> Quay lại danh sách
        </button>
        <button
          onClick={printPdf}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:border-blue-500/40 hover:bg-blue-500/5 transition-all"
        >
          <Printer size={14} /> Xuất PDF
        </button>
      </div>

      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-3xl font-black text-[var(--text-main)]">{worker.fullName ?? '(không tên)'}</h2>
          <span className="text-sm font-mono text-blue-500">{worker.workerCode ?? '—'}</span>
        </div>
        <div className="flex items-center gap-3 mt-2 text-sm text-[var(--text-muted)] flex-wrap">
          <span>{MARKET_LABELS[worker.market] ?? '—'}</span>
          <span className="text-slate-500">·</span>
          <span>{WORKER_STATUS_LABELS[worker.status] ?? worker.status}</span>
          {worker.agreedAt && (
            <>
              <span className="text-slate-500">·</span>
              <span>Đồng ý từ {fmtDate(worker.agreedAt)}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="glass-card p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
              {sec.title}
            </h3>
            <div className="space-y-2.5">
              {sec.fields.map(([key, label, format]) => {
                const raw = worker[key];
                const val = format ? format(raw) : raw;
                return (
                  <div
                    key={key}
                    className="flex justify-between gap-3 text-sm border-b border-[var(--border-color)] pb-2 last:border-0 last:pb-0"
                  >
                    <span className="text-slate-500 shrink-0">{label}</span>
                    <span className="font-medium text-[var(--text-main)] text-right truncate">
                      {val !== null && val !== undefined && val !== '' ? val : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {worker.notes && (
        <div className="glass-card p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Ghi chú
          </h3>
          <p className="text-sm text-[var(--text-main)] whitespace-pre-wrap">{worker.notes}</p>
        </div>
      )}
    </motion.div>
  );
}
