"use client";

import React, { useState } from "react";

interface FormField {
  blockType: "text" | "textarea" | "select" | "radio" | "checkbox" | "number" | "date" | "message";
  name?: string;
  label?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  width?: number;
  message?: unknown;
}

interface Props {
  token: string;
  formTitle: string;
  fields: FormField[];
  prefill: Record<string, string>;
  submitLabel: string;
  officeOptions?: Array<{ value: string; label: string }>;
}

function extractMessageText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as Record<string, unknown>;
  if (typeof n.text === "string") return n.text;
  const children = (n.children ?? n.root) as unknown;
  if (Array.isArray(children)) return children.map(extractMessageText).join(" ");
  if (children && typeof children === "object") return extractMessageText(children);
  return "";
}

export function FormClient({ token, formTitle, fields, prefill, submitLabel, officeOptions }: Props) {
  // Inject office options vào field "office" nếu seed để rỗng (load động từ DB).
  const enrichedFields = React.useMemo(() => {
    if (!officeOptions || officeOptions.length === 0) return fields;
    return fields.map((f) => {
      if (f.name === "office" && f.blockType === "select" && (!f.options || f.options.length === 0)) {
        return { ...f, options: officeOptions };
      }
      return f;
    });
  }, [fields, officeOptions]);
  const [values, setValues] = useState<Record<string, string>>(prefill);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; message: string } | null>(null);

  function setVal(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      // Validate required
      for (const f of fields) {
        if (f.required && f.name && !values[f.name]?.trim()) {
          alert(`Vui lòng điền: ${f.label ?? f.name}`);
          setSubmitting(false);
          return;
        }
      }

      const r = await fetch(`/api/form-invites/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const j = (await r.json()) as { ok?: boolean; message?: string; error?: string };
      if (r.ok && j.ok) {
        setDone({ ok: true, message: j.message ?? "Cảm ơn anh/chị đã gửi đăng ký!" });
      } else {
        setDone({ ok: false, message: j.error ?? `Lỗi: ${r.status}` });
      }
    } catch (err) {
      setDone({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <h1 style={{ color: done.ok ? "#0a7f3f" : "#b91c1c", fontSize: 24, marginBottom: 16 }}>
            {done.ok ? "✅ Đã gửi thành công" : "❌ Lỗi"}
          </h1>
          <p style={{ color: "#444", fontSize: 16, lineHeight: 1.6 }}>{done.message}</p>
        </div>
      </main>
    );
  }

  // Field nào full-width (textarea + structured row editor)
  const isFullWidth = (f: FormField) =>
    f.blockType === "textarea" ||
    (f.name && ROW_EDITOR_FIELDS[f.name]);

  return (
    <main style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 26, marginBottom: 4, color: "#111", fontWeight: 800 }}>{formTitle}</h1>
        <p style={{ color: "#666", marginBottom: 28, fontSize: 14, lineHeight: 1.5 }}>
          Vui lòng điền đầy đủ các trường bắt buộc (<span style={{ color: "#b91c1c" }}>*</span>). Cán bộ TLG sẽ liên hệ trong 24h sau khi anh/chị gửi.
        </p>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            {enrichedFields.map((f, i) => {
              if (f.blockType === "message") {
                const text = extractMessageText(f.message);
                return (
                  <h2 key={i} className="form-section">{text}</h2>
                );
              }
              if (!f.name) return null;
              const fullWidth = isFullWidth(f);
              return (
                <div key={f.name} className={fullWidth ? "form-field full" : "form-field"}>
                  <label style={labelStyle}>
                    {f.label ?? f.name}
                    {f.required && <span style={{ color: "#b91c1c" }}> *</span>}
                  </label>
                  {renderField(f, values[f.name] ?? "", (v) => setVal(f.name!, v))}
                </div>
              );
            })}
          </div>
          <button type="submit" disabled={submitting} style={submitBtnStyle(submitting)}>
            {submitting ? "Đang gửi..." : submitLabel}
          </button>
        </form>
      </div>

      <style>{`
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px 20px;
        }
        .form-field { display: flex; flex-direction: column; min-width: 0; }
        .form-field.full { grid-column: 1 / -1; }
        .form-section {
          grid-column: 1 / -1;
          margin: 28px 0 4px;
          padding: 10px 14px;
          background: linear-gradient(90deg, #eff6ff 0%, transparent 100%);
          border-left: 4px solid #2563eb;
          color: #1d4ed8;
          font-size: 16px;
          font-weight: 700;
          border-radius: 0 6px 6px 0;
        }
        .form-section:first-child { margin-top: 0; }
        @media (max-width: 720px) {
          .form-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}

// 3 field dạng table — convert sang structured row editor
const ROW_EDITOR_FIELDS: Record<string, { cols: { key: string; label: string; type?: string; width?: string }[] }> = {
  educationHistory: {
    cols: [
      { key: "range",   label: "Năm bắt đầu - kết thúc", width: "1.2fr" },
      { key: "school",  label: "Tên trường",             width: "2fr" },
      { key: "major",   label: "Chuyên ngành",           width: "1.5fr" },
      { key: "years",   label: "Số năm",                 width: "0.8fr" },
      { key: "jpHours", label: "Học tiếng Nhật",         width: "1fr" },
    ],
  },
  workHistory: {
    cols: [
      { key: "range",    label: "Năm/tháng bắt đầu - kết thúc", width: "1.3fr" },
      { key: "company",  label: "Tên công ty",                  width: "2fr" },
      { key: "industry", label: "Ngành nghề",                   width: "1.3fr" },
      { key: "place",    label: "Địa điểm",                     width: "1.2fr" },
      { key: "salary",   label: "Lương/tháng",                  width: "1fr" },
      { key: "years",    label: "Số năm",                       width: "0.7fr" },
    ],
  },
  familyMembers: {
    cols: [
      { key: "relation", label: "Quan hệ",     width: "1fr" },
      { key: "name",     label: "Họ tên",      width: "1.8fr" },
      { key: "age",      label: "Tuổi",        width: "0.6fr" },
      { key: "place",    label: "Địa điểm",    width: "1.3fr" },
      { key: "job",      label: "Nghề nghiệp", width: "1.3fr" },
      { key: "income",   label: "Thu nhập",    width: "1fr" },
    ],
  },
};

function renderField(f: FormField, value: string, onChange: (v: string) => void) {
  // Override 3 field dạng table
  if (f.name && ROW_EDITOR_FIELDS[f.name]) {
    return <RowEditor cols={ROW_EDITOR_FIELDS[f.name].cols} value={value} onChange={onChange} />;
  }
  switch (f.blockType) {
    case "text":
      return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
    case "number":
      return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
    case "date":
      return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />;
    case "textarea":
      return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} style={inputStyle} />;
    case "select":
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          <option value="">— Chọn —</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
          {f.options?.map((o) => (
            <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer", color: "#111" }}>
              <input
                type="radio"
                name={f.name}
                value={o.value}
                checked={value === o.value}
                onChange={(e) => onChange(e.target.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
      );
    default:
      return null;
  }
}

/**
 * RowEditor — bảng nhiều dòng, mỗi dòng N cell. Lưu output dạng
 * "<cell1> | <cell2> | ...\n<cell1> | <cell2> | ..." (multi-line | separator).
 * Tương thích bot/sync hiện có.
 */
function RowEditor({ cols, value, onChange }: {
  cols: { key: string; label: string; type?: string; width?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const rows = React.useMemo(() => {
    if (!value || !value.trim()) return [Array(cols.length).fill("")];
    return value
      .split(/<br\s*\/?>|\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const cells = line.split("|").map((c) => c.trim());
        const padded = [...cells];
        while (padded.length < cols.length) padded.push("");
        return padded.slice(0, cols.length);
      });
  }, [value, cols.length]);

  const serialize = (next: string[][]) =>
    next.map((row) => row.map((c) => c.trim()).join(" | ")).join("\n");

  const update = (rowIdx: number, colIdx: number, v: string) => {
    const next = rows.map((r) => [...r]);
    next[rowIdx][colIdx] = v;
    onChange(serialize(next));
  };
  const addRow = () => {
    const next = [...rows.map((r) => [...r]), Array(cols.length).fill("")];
    onChange(serialize(next));
  };
  const removeRow = (idx: number) => {
    if (rows.length === 1) {
      onChange("");
      return;
    }
    const next = rows.filter((_, i) => i !== idx);
    onChange(serialize(next));
  };

  const colTemplate = cols.map((c) => c.width ?? "1fr").concat("auto").join(" ");

  return (
    <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: 12, background: "#f9fafb" }}>
      <div style={{ display: "grid", gridTemplateColumns: colTemplate, gap: 6, marginBottom: 6, fontSize: 11, fontWeight: 600, color: "#374151" }}>
        {cols.map((c) => <div key={c.key}>{c.label}</div>)}
        <div style={{ width: 28 }}></div>
      </div>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "grid", gridTemplateColumns: colTemplate, gap: 6, marginBottom: 6 }}>
          {cols.map((c, ci) => (
            <input
              key={c.key}
              type={c.type ?? "text"}
              value={row[ci] ?? ""}
              onChange={(e) => update(ri, ci, e.target.value)}
              style={{ ...inputStyle, padding: "6px 8px", fontSize: 13 }}
            />
          ))}
          <button
            type="button"
            onClick={() => removeRow(ri)}
            style={{ width: 28, height: 32, border: "1px solid #fca5a5", background: "white", color: "#dc2626", borderRadius: 6, cursor: "pointer", fontSize: 14, lineHeight: 1 }}
            title="Xoá dòng"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        style={{ marginTop: 4, padding: "6px 14px", border: "1px dashed #93c5fd", background: "white", color: "#2563eb", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}
      >
        + Thêm dòng
      </button>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f3f4f6",
  padding: "40px 16px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
const cardStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  background: "white",
  borderRadius: 8,
  padding: 32,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
  color: "#111",
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#374151",
  marginBottom: 6,
  fontWeight: 500,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  color: "#111",
  background: "#fff",
};
const submitBtnStyle = (loading: boolean): React.CSSProperties => ({
  marginTop: 32,
  padding: "12px 32px",
  background: loading ? "#9ca3af" : "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 6,
  fontSize: 16,
  cursor: loading ? "not-allowed" : "pointer",
  fontWeight: 600,
});
