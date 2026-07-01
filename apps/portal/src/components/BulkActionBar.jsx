import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, X, CheckSquare } from 'lucide-react';
import { deleteDoc } from '../api/payload';
import ConfirmDialog from './ConfirmDialog';

/**
 * BulkActionBar — thanh action xuất hiện khi đã chọn ≥1 record.
 *
 * Props:
 *  - count: số đã chọn
 *  - selectedIds: array ID (để delete loop)
 *  - collection (slug)
 *  - onClear()
 *  - onDeleted(ids)  — sau khi xoá xong, parent reload + clear selection
 *  - entityLabel (default "bản ghi")  — vd "tài sản", "lao động", "nhân sự"
 */
export default function BulkActionBar({
  count,
  selectedIds,
  collection,
  onClear,
  onDeleted,
  entityLabel = 'bản ghi',
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) => deleteDoc(collection, id)),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - ok;

      // Toàn bộ fail — KHÔNG xoá được record nào (vd no permission).
      if (ok === 0) {
        const firstReason = results.find((r) => r.status === 'rejected')?.reason;
        const reasonMsg = firstReason instanceof Error
          ? firstReason.message
          : firstReason ? String(firstReason) : 'Không rõ lý do';
        setError(`❌ Không xoá được bản ghi nào. Lý do: ${reasonMsg}`);
        return;
      }

      // Một phần fail — báo rõ con số + lý do
      if (failed > 0) {
        const firstReason = results.find((r) => r.status === 'rejected')?.reason;
        const reasonMsg = firstReason instanceof Error
          ? firstReason.message
          : firstReason ? String(firstReason) : '?';
        setError(`⚠ Đã xoá ${ok}/${results.length}. ${failed} bản ghi bị từ chối (lý do: ${reasonMsg}).`);
        onDeleted?.(selectedIds);
        return;
      }

      // Tất cả thành công
      setConfirmOpen(false);
      onDeleted?.(selectedIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="sticky top-0 z-20 no-print"
          >
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
              <CheckSquare size={16} />
              <span className="text-sm font-semibold flex-1">
                Đã chọn {count} {entityLabel}
              </span>
              <button
                onClick={() => setConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 hover:bg-red-600 transition-all"
              >
                <Trash2 size={12} /> Xoá đã chọn
              </button>
              <button
                onClick={onClear}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white/15 hover:bg-white/25 transition-all"
              >
                <X size={12} /> Bỏ chọn
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => { if (!busy) { setConfirmOpen(false); setError(null); } }}
        onConfirm={handleConfirm}
        title={`Xoá ${count} ${entityLabel}?`}
        message={
          <>
            Thao tác này không thể hoàn tác. <strong className="text-[var(--text-main)]">{count}</strong> {entityLabel} đã chọn sẽ bị xoá vĩnh viễn.
          </>
        }
        confirmLabel={`Xoá ${count} bản ghi`}
        confirmTone="red"
        busy={busy}
        error={error}
      />
    </>
  );
}
