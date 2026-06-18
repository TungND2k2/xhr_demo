import React, { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

/**
 * FilterPanel — Notion-style filter rail on the left.
 *
 * Props:
 *  - sections: [{ key, label, options: [{ value, label, count? }] }]
 *  - value:    { [key]: string[] }
 *  - onChange: (next) => void
 */
export default function FilterPanel({ sections, value, onChange }) {
  const hasAny = Object.values(value ?? {}).some((v) => Array.isArray(v) && v.length > 0);
  return (
    <aside className="w-64 shrink-0 space-y-4">
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Bộ lọc</span>
          {hasAny && (
            <button
              onClick={() => onChange({})}
              className="text-[10px] text-blue-500 hover:underline flex items-center gap-1"
            >
              <X size={12} />
              Xoá hết
            </button>
          )}
        </div>
        {sections.map((s) => (
          <FilterSection
            key={s.key}
            section={s}
            selected={(value && value[s.key]) || []}
            onChange={(next) => onChange({ ...(value ?? {}), [s.key]: next })}
          />
        ))}
      </div>
    </aside>
  );
}

function FilterSection({ section, selected, onChange }) {
  const [open, setOpen] = useState(true);
  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val));
    else onChange([...selected, val]);
  };
  return (
    <div className="border-b border-[var(--border-color)] pb-3 last:border-b-0 last:pb-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-3"
      >
        <span>{section.label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'} text-slate-500`} />
      </button>
      {open && (
        <div className="space-y-1.5">
          {section.options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-xs cursor-pointer hover:text-[var(--text-main)] text-[var(--text-muted)] group py-0.5"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="accent-blue-500 cursor-pointer"
              />
              <span className="flex-1">{opt.label}</span>
              {opt.count !== undefined && (
                <span className="text-slate-500 text-[10px]">{opt.count}</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
