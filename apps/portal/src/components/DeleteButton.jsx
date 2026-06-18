import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteDoc } from '../api/payload';
import ConfirmDialog from './ConfirmDialog';

/**
 * DeleteButton — nút Xoá + ConfirmDialog.
 *
 * Props:
 *  - collection (slug)
 *  - recordId
 *  - recordLabel (hiển thị trong message)
 *  - onDeleted (callback sau khi xoá thành công — vd navigate back)
 *  - label (default "Xoá")
 *  - variant: 'outline' (default) | 'ghost' | 'icon'
 */
export default function DeleteButton({
  collection,
  recordId,
  recordLabel,
  onDeleted,
  label = 'Xoá',
  variant = 'outline',
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteDoc(collection, recordId);
      setOpen(false);
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const btnCls =
    variant === 'icon'
      ? 'p-2 rounded-xl border border-[var(--border-color)] text-red-500 hover:bg-red-500/10 hover:border-red-500/40 transition-all'
      : variant === 'ghost'
      ? 'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-red-500 hover:bg-red-500/10 transition-all'
      : 'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] text-red-500 hover:bg-red-500/5 hover:border-red-500/40 transition-all';

  const handleOpen = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <button onClick={handleOpen} className={btnCls} title="Xoá bản ghi">
        <Trash2 size={14} />
        {variant !== 'icon' && label}
      </button>
      <ConfirmDialog
        open={open}
        onCancel={() => { if (!busy) { setOpen(false); setError(null); } }}
        onConfirm={handleConfirm}
        title="Xoá bản ghi này?"
        message={
          <>
            Thao tác này không thể hoàn tác. Bản ghi <strong className="text-[var(--text-main)]">{recordLabel ?? recordId}</strong> sẽ bị xoá vĩnh viễn.
          </>
        }
        confirmLabel="Xoá vĩnh viễn"
        confirmTone="red"
        busy={busy}
        error={error}
      />
    </>
  );
}
