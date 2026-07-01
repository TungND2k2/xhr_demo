"use client";

/**
 * MarkdownField — custom field component cho field type=textarea muốn
 * hiển thị markdown preview (render đẹp) thay vì textarea thô.
 *
 * UX: mặc định MODE PREVIEW (chỉ xem). Click "Sửa" → switch sang editor
 * (toolbar đầy đủ + textarea). Click "Xem" → quay về preview.
 *
 * DB vẫn lưu markdown string. AI engine đọc như string bình thường.
 */

import dynamic from "next/dynamic";
import { useField } from "@payloadcms/ui";
import { useState, useEffect } from "react";

import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((m) => m.default),
  { ssr: false, loading: () => <div style={{ padding: 12, color: "#999" }}>Đang tải editor...</div> },
);

const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((m) => m.default.Markdown),
  { ssr: false, loading: () => <div style={{ padding: 12, color: "#999" }}>Đang tải preview...</div> },
);

interface Props {
  path: string;
  field?: {
    label?: string;
    admin?: { description?: string };
  };
}

export default function MarkdownField({ path, field }: Props) {
  const { value, setValue } = useField<string>({ path });
  const [mounted, setMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => setMounted(true), []);

  const label = typeof field?.label === "string" ? field.label : "Nội dung";
  const description = field?.admin?.description;
  const text = value ?? "";

  const buttonStyle: React.CSSProperties = {
    padding: "6px 14px",
    fontSize: 13,
    border: "1px solid #555",
    borderRadius: 4,
    background: isEditing ? "#444" : "#1f6feb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  };

  return (
    <div className="field-type" data-field-path={path}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <label className="field-label" style={{ fontWeight: 600 }}>{label}</label>
        {mounted && (
          <button type="button" onClick={() => setIsEditing(!isEditing)} style={buttonStyle}>
            {isEditing ? "👁 Xem" : "✏️ Sửa"}
          </button>
        )}
      </div>
      {description && (
        <p style={{ fontSize: 12, color: "#888", marginTop: 0, marginBottom: 8 }}>
          {description}
        </p>
      )}
      {!mounted ? (
        <div style={{ padding: 12, color: "#999" }}>Đang tải...</div>
      ) : isEditing ? (
        <div data-color-mode="dark">
          <MDEditor
            value={text}
            onChange={(v) => setValue(v ?? "")}
            height={500}
            preview="edit"
            visibleDragbar={false}
            textareaProps={{
              placeholder:
                "Viết nội dung. Bấm nút trên thanh công cụ để format (đậm, tiêu đề, danh sách...).",
            }}
          />
        </div>
      ) : (
        <div
          data-color-mode="dark"
          style={{
            border: "1px solid #2d3138",
            borderRadius: 4,
            padding: 16,
            minHeight: 200,
            background: "#0d1117",
          }}
        >
          {text.trim() ? (
            <MDPreview source={text} style={{ background: "transparent" }} />
          ) : (
            <p style={{ color: "#666", margin: 0 }}>
              <em>(Chưa có nội dung — bấm "✏️ Sửa" để thêm)</em>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
