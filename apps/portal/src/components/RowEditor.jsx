import React, { useMemo } from 'react';

/**
 * RowEditor — bảng nhiều dòng, mỗi dòng N input. Output dạng
 *   "<c1> | <c2> | ...\n<c1> | <c2> | ..."
 *
 * Tương thích với data đã có (split bằng <br> hoặc \n).
 *
 * Props:
 *   cols: [{ key, label, type?, width? }]
 *   value: string (multi-line | separated)
 *   onChange: (newString) => void
 */
export default function RowEditor({ cols, value, onChange, compact }) {
  const rows = useMemo(() => {
    if (!value || !String(value).trim()) return [Array(cols.length).fill('')];
    return String(value)
      .split(/<br\s*\/?>|\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const cells = line.split('|').map((c) => c.trim());
        const padded = [...cells];
        while (padded.length < cols.length) padded.push('');
        return padded.slice(0, cols.length);
      });
  }, [value, cols.length]);

  const serialize = (next) =>
    next.map((row) => row.map((c) => String(c ?? '').trim()).join(' | ')).join('\n');

  const update = (rowIdx, colIdx, v) => {
    const next = rows.map((r) => [...r]);
    next[rowIdx][colIdx] = v;
    onChange(serialize(next));
  };
  const addRow = () => onChange(serialize([...rows.map((r) => [...r]), Array(cols.length).fill('')]));
  const removeRow = (idx) => {
    if (rows.length === 1) { onChange(''); return; }
    onChange(serialize(rows.filter((_, i) => i !== idx)));
  };

  const colTemplate = cols.map((c) => c.width ?? '1fr').concat('auto').join(' ');
  const inputBase = compact
    ? { padding: '3px 5px', fontSize: 10, height: 22 }
    : { padding: '6px 8px', fontSize: 13 };

  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: compact ? 6 : 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: 4, marginBottom: 4, fontSize: compact ? 9 : 11, fontWeight: 600, color: '#374151' }}>
        {cols.map((c) => <div key={c.key}>{c.label}</div>)}
        <div style={{ width: compact ? 22 : 28 }}></div>
      </div>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: 4, marginBottom: 4 }}>
          {cols.map((c, ci) => (
            <input
              key={c.key}
              type={c.type ?? 'text'}
              value={row[ci] ?? ''}
              onChange={(e) => update(ri, ci, e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                outline: 'none',
                background: '#fff',
                color: '#111',
                ...inputBase,
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => removeRow(ri)}
            style={{
              width: compact ? 22 : 28,
              height: compact ? 22 : 28,
              border: '1px solid #fca5a5',
              background: '#fff',
              color: '#dc2626',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: compact ? 11 : 13,
              padding: 0,
              lineHeight: 1,
            }}
            title="Xoá dòng"
          >×</button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        style={{
          marginTop: 4,
          padding: compact ? '3px 8px' : '6px 14px',
          border: '1px dashed #93c5fd',
          background: '#fff',
          color: '#2563eb',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: compact ? 10 : 12,
          fontWeight: 500,
        }}
      >+ Thêm dòng</button>
    </div>
  );
}
