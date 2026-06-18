import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

/**
 * ConfirmDialog — generic confirm modal cho thao tác phá hủy (xoá...).
 *
 * Props:
 *  - open
 *  - onCancel
 *  - onConfirm (async function — modal đợi xong rồi tự đóng)
 *  - title (default "Xác nhận")
 *  - message (description, có thể là JSX)
 *  - confirmLabel (default "Xoá"), confirmTone ('red'|'amber'|'blue', default 'red')
 *  - busy (boolean — nếu parent muốn control loading state)
 *  - error (string — hiện inline nếu confirm fail)
 */
export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = 'Xác nhận',
  message,
  confirmLabel = 'Xoá',
  confirmTone = 'red',
  busy = false,
  error = null,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  const toneBtn = {
    red:   'bg-red-500 hover:bg-red-600 text-white',
    amber: 'bg-amber-500 hover:bg-amber-600 text-white',
    blue:  'bg-blue-500 hover:bg-blue-600 text-white',
  }[confirmTone] ?? 'bg-red-500 hover:bg-red-600 text-white';

  const toneIcon = {
    red:   'bg-red-500/10 text-red-500',
    amber: 'bg-amber-500/10 text-amber-500',
    blue:  'bg-blue-500/10 text-blue-500',
  }[confirmTone] ?? 'bg-red-500/10 text-red-500';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !busy && onCancel?.()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[var(--sidebar-bg)] border border-[var(--border-color)] shadow-2xl"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${toneIcon}`}>
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-black text-[var(--text-main)] mb-1">{title}</h3>
                  {message && <div className="text-sm text-[var(--text-muted)]">{message}</div>}
                </div>
                <button
                  onClick={onCancel}
                  disabled={busy}
                  className="shrink-0 text-slate-500 hover:text-[var(--text-main)] disabled:opacity-40"
                >
                  <X size={16} />
                </button>
              </div>
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-xs">{error}</div>
              )}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={onCancel}
                  disabled={busy}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                >
                  Huỷ
                </button>
                <button
                  onClick={onConfirm}
                  disabled={busy}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 ${toneBtn}`}
                >
                  {busy ? 'Đang xử lý...' : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
