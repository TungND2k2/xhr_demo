"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Reminder {
  atDay: number;
  kind: "checkin" | "overdue" | "critical";
  recipients?: string[];
}

interface Stage {
  id: string;
  order: number;
  code: string;
  name: string;
  durationDays?: number;
  minDurationDays?: number;
  maxDurationDays?: number;
  responsibleRole: string;
  isActive?: boolean;
  reminders?: Reminder[];
  description?: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "👑 Admin",
  manager: "📋 Manager",
  planner: "🔧 Planner",
  salesperson: "💼 Sales",
  qc: "✅ QC",
  storage: "📦 Storage",
  accountant: "💰 Kế toán",
  supplier: "🏭 NCC",
};

const KIND_DOT: Record<string, string> = {
  checkin: "#3b82f6",
  overdue: "#f59e0b",
  critical: "#ef4444",
};

function durationLabel(s: Stage): string {
  if (s.minDurationDays && s.maxDurationDays) {
    return `${s.minDurationDays}–${s.maxDurationDays} ngày`;
  }
  if (s.durationDays) return `${s.durationDays} ngày`;
  return "—";
}

export const WorkflowDiagram: React.FC = () => {
  const { id } = useDocumentInfo();
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setStages([]);
      return;
    }
    const url =
      `/api/workflow-stages` +
      `?where[workflow][equals]=${encodeURIComponent(String(id))}` +
      `&sort=order&limit=100&depth=0`;
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { docs: Stage[] }) => setStages(d.docs ?? []))
      .catch((e) => setError(`Không tải được các bước (${e})`));
  }, [id]);

  if (!id) {
    return (
      <Hint>
        Lưu workflow trước để bắt đầu cấu hình các bước. Sau khi lưu, bạn có thể
        thêm các bước (B1, B2, ...) ở bên dưới hoặc trong collection
        <em> Workflow đơn hàng</em>.
      </Hint>
    );
  }

  if (error) return <Hint variant="error">{error}</Hint>;
  if (stages === null) return <Hint>Đang tải sơ đồ...</Hint>;

  if (stages.length === 0) {
    return (
      <Hint variant="empty">
        Workflow này chưa có bước nào.{" "}
        <Link
          href={`/admin/collections/workflow-stages/create?workflow=${id}`}
          style={{ textDecoration: "underline", fontWeight: 500 }}
        >
          + Tạo bước đầu tiên
        </Link>
      </Hint>
    );
  }

  return (
    <div style={{ marginTop: 8, marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          Sơ đồ quy trình ({stages.length} bước)
        </div>
        <Link
          href={`/admin/collections/workflow-stages/create?workflow=${id}`}
          style={{
            fontSize: 12,
            padding: "6px 12px",
            border: "1px solid var(--theme-elevation-150)",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          + Thêm bước
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 12,
          paddingTop: 4,
        }}
      >
        {stages.map((s, idx) => (
          <div
            key={s.id}
            style={{ display: "flex", alignItems: "stretch", flexShrink: 0 }}
          >
            <StageCard stage={s} />
            {idx < stages.length - 1 && <Arrow />}
          </div>
        ))}
      </div>
    </div>
  );
};

const StageCard: React.FC<{ stage: Stage }> = ({ stage }) => {
  const roleLabel = ROLE_LABEL[stage.responsibleRole] ?? stage.responsibleRole;
  const reminderCount = stage.reminders?.length ?? 0;
  const dimmed = stage.isActive === false;

  return (
    <Link
      href={`/admin/collections/workflow-stages/${stage.id}`}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
        minWidth: 200,
        maxWidth: 220,
        padding: 12,
        border: "1px solid var(--theme-elevation-150)",
        borderRadius: 10,
        background: "var(--theme-elevation-50)",
        opacity: dimmed ? 0.5 : 1,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "white",
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {stage.order}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            opacity: 0.6,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {stage.code}
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>
        {stage.name}
      </div>
      <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.6 }}>
        <div>⏱ {durationLabel(stage)}</div>
        <div>{roleLabel}</div>
        {reminderCount > 0 && (
          <div style={{ marginTop: 6, display: "flex", gap: 3 }}>
            {stage.reminders?.map((r, i) => (
              <span
                key={i}
                title={`Ngày ${r.atDay} — ${r.kind}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: KIND_DOT[r.kind] ?? "#94a3b8",
                  display: "inline-block",
                }}
              />
            ))}
            <span style={{ marginLeft: 4, fontSize: 10 }}>
              {reminderCount} nhắc
            </span>
          </div>
        )}
      </div>
    </Link>
  );
};

const Arrow: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 24,
      color: "var(--theme-elevation-300)",
      flexShrink: 0,
    }}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8h10m0 0L9 4m4 4L9 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

const Hint: React.FC<{
  children: React.ReactNode;
  variant?: "error" | "empty" | "default";
}> = ({ children, variant = "default" }) => {
  const palette: Record<string, { bg: string; border: string; color?: string }> = {
    default: { bg: "var(--theme-elevation-50)", border: "var(--theme-elevation-150)" },
    empty: { bg: "var(--theme-elevation-50)", border: "var(--theme-elevation-200)" },
    error: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" },
  };
  const p = palette[variant];
  return (
    <div
      style={{
        padding: 16,
        border: `1px dashed ${p.border}`,
        borderRadius: 8,
        background: p.bg,
        color: p.color,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
};

export default WorkflowDiagram;
