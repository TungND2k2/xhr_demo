"use client";

/**
 * ToolGroupSelectAll — master checkbox đặt trên đầu mỗi nhóm tool trong
 * Agents form. Tick → tick hết tool trong nhóm. Untick → bỏ tick hết.
 *
 * Component này là 1 UI field (type=ui) trong group. Nó tự dò các sibling
 * checkbox fields cùng group bằng useAllFormFields() + dispatch bulk update.
 *
 * State: nếu tất cả siblings tick → checked; nếu 0 tick → unchecked;
 * nếu 1 phần → indeterminate (HTML5 checkbox feature).
 */

import { useAllFormFields } from "@payloadcms/ui";
import { useMemo } from "react";

interface Props {
  path: string;
}

export default function ToolGroupSelectAll({ path }: Props) {
  const [fields, dispatchFields] = useAllFormFields();

  // path = "enabledTools.workers._selectAll" → parent = "enabledTools.workers"
  const parentPath = path.replace(/\._selectAll$/, "");

  // Tìm các checkbox siblings cùng parent group (loại trừ chính field này)
  const siblings = useMemo(() => {
    const out: string[] = [];
    const prefix = parentPath + ".";
    for (const key of Object.keys(fields)) {
      if (
        key.startsWith(prefix) &&
        key !== path &&
        !key.slice(prefix.length).includes(".") // chỉ direct children
      ) {
        out.push(key);
      }
    }
    return out;
  }, [fields, parentPath, path]);

  const checkedCount = siblings.filter(
    (p) => fields[p]?.value === true,
  ).length;
  const total = siblings.length;
  const isAllChecked = total > 0 && checkedCount === total;
  const isIndeterminate = checkedCount > 0 && checkedCount < total;

  const handleToggle = () => {
    const targetValue = !isAllChecked;
    for (const siblingPath of siblings) {
      dispatchFields({
        type: "UPDATE",
        path: siblingPath,
        value: targetValue,
      });
    }
  };

  if (total === 0) return null;

  return (
    <div
      style={{
        marginBottom: 12,
        padding: "10px 12px",
        background: "rgb(var(--theme-success-50))",
        border: "1px solid rgb(var(--theme-success-150))",
        borderRadius: 8,
      }}
    >
      <label
        style={{
          cursor: "pointer",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: 0,
        }}
      >
        <input
          type="checkbox"
          checked={isAllChecked}
          ref={(el) => {
            if (el) el.indeterminate = isIndeterminate;
          }}
          onChange={handleToggle}
          style={{
            width: 18,
            height: 18,
            cursor: "pointer",
            accentColor: "rgb(var(--theme-success-500))",
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          Chọn tất cả
          <span style={{ marginLeft: 8, opacity: 0.65, fontWeight: 400 }}>
            ({checkedCount}/{total})
          </span>
        </span>
      </label>
    </div>
  );
}
