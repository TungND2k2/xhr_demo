import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * FormModal — schema-driven create/edit modal.
 *
 * Props:
 *  - open
 *  - onClose
 *  - title
 *  - subtitle
 *  - fields: [{ name, label, type, required?, options?, placeholder?, defaultValue?, width?, help? }]
 *      type: 'text' | 'textarea' | 'number' | 'date' | 'select'
 *      width: 'full' (default) | 'half' | 'third'
 *  - initialValues?: object — pre-fill values cho edit mode
 *  - submitLabel (default "Tạo")
 *  - onSubmit(values): async — return doc/error; modal đợi rồi đóng
 *
 * Empty optional fields được loại khỏi payload trước khi onSubmit.
 */
export default function FormModal({
  open,
  onClose,
  title,
  subtitle,
  fields,
  initialValues,
  submitLabel = 'Tạo',
  onSubmit,
}) {
  const [values, setValues] = useState(() => buildInitial(fields, initialValues));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setValues(buildInitial(fields, initialValues));
      setError(null);
    }
  }, [open, fields, initialValues]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate required
    for (const f of fields) {
      if (f.required && isEmpty(values[f.name])) {
        setError(`Thiếu trường bắt buộc: ${f.label}`);
        return;
      }
    }

    // Build payload — strip empty optionals + coerce numbers
    const payload = {};
    for (const f of fields) {
      const v = values[f.name];
      if (isEmpty(v) && !f.required) continue;
      if (f.type === 'number') {
        const n = Number(v);
        if (Number.isFinite(n)) payload[f.name] = n;
        else if (f.required) { setError(`${f.label} phải là số`); return; }
      } else {
        payload[f.name] = v;
      }
    }

    setBusy(true);
    try {
      await onSubmit(payload);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => !busy && onClose?.()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl my-8 rounded-2xl bg-[var(--sidebar-bg)] border border-[var(--border-color)] shadow-2xl"
          >
            <div className="p-6 border-b border-[var(--border-color)] flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-[var(--text-main)]">{title}</h3>
                {subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                disabled={busy}
                className="shrink-0 text-slate-500 hover:text-[var(--text-main)] disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-6 gap-x-4 gap-y-4">
                {fields.map((f) => (
                  <FieldInput
                    key={f.name}
                    field={f}
                    value={values[f.name] ?? ''}
                    onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
                    disabled={busy}
                  />
                ))}
              </div>

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-xs">{error}</div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-50"
                >
                  {busy ? 'Đang lưu...' : submitLabel}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function buildInitial(fields, initial) {
  const out = {};
  for (const f of fields) {
    if (initial && f.name in initial) out[f.name] = initial[f.name] ?? '';
    else if (f.defaultValue !== undefined) out[f.name] = f.defaultValue;
    else out[f.name] = '';
  }
  return out;
}

function isEmpty(v) {
  return v === null || v === undefined || v === '';
}

function FieldInput({ field, value, onChange, disabled }) {
  const span =
    field.width === 'third' ? 'col-span-6 md:col-span-2'
    : field.width === 'half' ? 'col-span-6 md:col-span-3'
    : 'col-span-6';

  const inputCls =
    'w-full bg-transparent border border-[var(--border-color)] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 outline-none text-[var(--text-main)] disabled:opacity-50';

  return (
    <div className={span}>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {field.type === 'textarea' ? (
        <textarea
          rows={field.rows ?? 3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={`${inputCls} resize-y`}
        />
      ) : field.type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputCls}
        >
          <option value="">— Chọn —</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'password' ? 'password' : field.type === 'email' ? 'email' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          autoComplete={field.type === 'password' ? 'new-password' : undefined}
          className={inputCls}
        />
      )}

      {field.help && <p className="text-[10px] text-slate-500 mt-1">{field.help}</p>}
    </div>
  );
}
