import { getPayload } from "payload";
import config from "@payload-config";
import { notFound } from "next/navigation";

import { FormClient } from "./FormClient";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

export default async function FormInvitePage({ params }: PageProps) {
  const { token } = await params;
  const payload = await getPayload({ config });

  // 1. Tìm invite theo token
  const inviteRes = await payload.find({
    collection: "form-invites",
    where: { token: { equals: token } },
    limit: 1,
    depth: 2,
  });
  const invite = inviteRes.docs[0];
  if (!invite) notFound();

  // 2. Check trạng thái
  const now = Date.now();
  if (invite.status === "revoked") {
    return <FormError title="Link đã bị thu hồi" message="Liên hệ cán bộ tuyển dụng để được cấp link mới." />;
  }
  if (invite.status === "submitted") {
    return (
      <FormError
        title="Đã nộp"
        message={`Anh/chị đã nộp form vào ${new Date(invite.submittedAt ?? "").toLocaleString("vi-VN")}. Cảm ơn!`}
        info
      />
    );
  }
  const expMs = new Date(invite.expiresAt).getTime();
  if (expMs < now || invite.status === "expired") {
    return <FormError title="Link đã hết hạn" message="Liên hệ cán bộ tuyển dụng để được cấp link mới." />;
  }

  // 3. Load form template
  const formId = typeof invite.form === "string" ? invite.form : invite.form?.id;
  if (!formId) notFound();

  const form = await payload.findByID({
    collection: "forms",
    id: formId,
    depth: 0,
  });

  // 4. Update status = "opened" (fire-and-forget — không block render)
  if (invite.status === "pending") {
    void payload.update({
      collection: "form-invites",
      id: invite.id,
      data: { status: "opened", openedAt: new Date().toISOString() },
    }).catch(() => {});
  }

  // 5. Build prefillMap
  const prefillMap: Record<string, string> = {};
  if (Array.isArray(invite.prefillData)) {
    for (const p of invite.prefillData) {
      if (p?.field) prefillMap[p.field] = String(p.value ?? "");
    }
  }

  // 6. Load offices (active=true) cho dropdown "Văn phòng phụ trách"
  let officeOptions: Array<{ value: string; label: string }> = [];
  try {
    const officesRes = await payload.find({
      collection: "offices",
      where: { active: { equals: true } },
      limit: 200,
      depth: 0,
      sort: "name",
    });
    officeOptions = officesRes.docs.map((o) => {
      const doc = o as { id: string; name?: string; officeCode?: string };
      return {
        value: String(doc.id),
        label: doc.officeCode ? `${doc.name ?? doc.id} (${doc.officeCode})` : doc.name ?? String(doc.id),
      };
    });
  } catch {
    // offices collection chưa migrate — bỏ qua, FormClient hiện dropdown rỗng
  }

  return (
    <FormClient
      token={token}
      formTitle={form.title}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields={(form.fields ?? []) as any}
      prefill={prefillMap}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      submitLabel={(form as any).submitButtonLabel ?? "Gửi"}
      officeOptions={officeOptions}
    />
  );
}

function FormError({ title, message, info = false }: { title: string; message: string; info?: boolean }) {
  const color = info ? "#0a7f3f" : "#b91c1c";
  return (
    <main
      style={{
        maxWidth: 600,
        margin: "80px auto",
        padding: "40px 24px",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ color, fontSize: 24, marginBottom: 16 }}>{title}</h1>
      <p style={{ color: "#444", fontSize: 16, lineHeight: 1.6 }}>{message}</p>
    </main>
  );
}
