import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";

interface SubmitBody {
  values?: Record<string, string>;
}

interface InviteDoc {
  id: string;
  token: string;
  status: string;
  expiresAt: string;
  form: { id: string } | string;
  worker?: { id: string; fullName?: string } | string | null;
}

/**
 * Public submit endpoint cho FormInvite. KHÔNG cần auth — token là credential.
 *
 * Flow:
 *   1. Validate token + not expired + not submitted/revoked
 *   2. Tạo FormSubmission (collection của plugin form-builder)
 *   3. Update FormInvite: status=submitted + submission + submittedAt
 *   4. Sync data về Worker (nếu invite có worker → update; nếu không → tạo mới)
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const values = body.values ?? {};
  if (typeof values !== "object" || Array.isArray(values)) {
    return NextResponse.json({ error: "values must be an object" }, { status: 400 });
  }

  const payload = await getPayload({ config });

  // 1. Validate invite
  const inviteRes = await payload.find({
    collection: "form-invites",
    where: { token: { equals: token } },
    limit: 1,
    depth: 1,
  });
  const invite = inviteRes.docs[0] as unknown as InviteDoc | undefined;
  if (!invite) {
    return NextResponse.json({ error: "Link không hợp lệ" }, { status: 404 });
  }
  if (invite.status === "submitted") {
    return NextResponse.json({ error: "Anh/chị đã nộp form rồi." }, { status: 409 });
  }
  if (invite.status === "revoked") {
    return NextResponse.json({ error: "Link đã bị thu hồi." }, { status: 410 });
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "Link đã hết hạn." }, { status: 410 });
  }

  const formId = typeof invite.form === "string" ? invite.form : invite.form.id;

  // 2. Build submissionData array — plugin form-builder format
  const submissionData = Object.entries(values)
    .filter(([, v]) => v != null && v !== "")
    .map(([field, value]) => ({ field, value: String(value) }));

  let submissionId: string | undefined;
  try {
    const submission = await payload.create({
      collection: "form-submissions",
      data: {
        form: formId,
        submissionData,
      },
    });
    submissionId = String(submission.id);
  } catch (err) {
    payload.logger.error(
      `[form-invite ${token}] create submission failed: ${err instanceof Error ? err.message : err}`,
    );
    return NextResponse.json(
      { error: "Lỗi lưu form. Vui lòng thử lại sau hoặc liên hệ cán bộ tuyển dụng." },
      { status: 500 },
    );
  }

  // 3. Update FormInvite
  await payload.update({
    collection: "form-invites",
    id: invite.id,
    data: {
      status: "submitted",
      submittedAt: new Date().toISOString(),
      submission: submissionId,
    },
  });

  // 4. Sync data → Worker (best-effort, không block response)
  void syncToWorker(payload, invite, values).catch((e) =>
    payload.logger.warn(`[form-invite ${token}] syncToWorker failed: ${e}`),
  );

  // 5. Notify bot Telegram (best-effort)
  const internalSecret = process.env.INTERNAL_SECRET;
  const botUrl = process.env.BOT_INTERNAL_URL ?? "http://localhost:4002";
  if (internalSecret) {
    void fetch(`${botUrl}/internal/form-submitted`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": internalSecret,
      },
      body: JSON.stringify({
        inviteId: invite.id,
        formId,
        submissionId,
        workerId: typeof invite.worker === "string" ? invite.worker : invite.worker?.id,
        workerName: typeof invite.worker === "object" ? invite.worker?.fullName : undefined,
        fullName: values.fullName ?? null,
        phone: values.personalPhone ?? null,
      }),
      signal: AbortSignal.timeout(5_000),
    }).catch((e) => payload.logger.warn(`[form-invite ${token}] notify bot failed: ${e}`));
  }

  return NextResponse.json({
    ok: true,
    message: "Cảm ơn anh/chị đã gửi đăng ký. Cán bộ TLG sẽ liên hệ trong 24h.",
  });
}

/** Map form data → Worker fields. Best-effort, sync only common fields. */
async function syncToWorker(
  payload: Awaited<ReturnType<typeof getPayload>>,
  invite: InviteDoc,
  values: Record<string, string>,
): Promise<void> {
  const workerData: Record<string, unknown> = {};
  // Map các field form → Worker fields (tên Worker schema thực tế:
  // dob/nationalId/height/weight, KHÔNG phải dateOfBirth/idNumber/heightCm).
  if (values.fullName) workerData.fullName = values.fullName;
  if (values.dateOfBirth) workerData.dob = values.dateOfBirth;
  if (values.gender) workerData.gender = values.gender;
  if (values.idNumber) workerData.nationalId = values.idNumber;
  if (values.idIssuedDate) workerData.nationalIdIssuedAt = values.idIssuedDate;
  if (values.personalPhone) workerData.phone = values.personalPhone;
  if (values.address) workerData.address = values.address;
  if (values.heightCm) workerData.height = Number(values.heightCm);
  if (values.weightKg) workerData.weight = Number(values.weightKg);
  if (values.maritalStatus) workerData.maritalStatus = values.maritalStatus;
  if (values.highestDegree) workerData.education = values.highestDegree;
  if (values.office) workerData.office = values.office;

  if (Object.keys(workerData).length === 0) return;

  if (invite.worker) {
    const workerId = typeof invite.worker === "string" ? invite.worker : invite.worker.id;
    await payload.update({ collection: "workers", id: workerId, data: workerData });
  } else if (values.fullName) {
    // Tạo Worker mới
    const created = await payload.create({
      collection: "workers",
      data: { ...workerData, status: "researching" },
    });
    // Link back to invite
    await payload.update({
      collection: "form-invites",
      id: invite.id,
      data: { worker: created.id as string },
    });
  }
}
