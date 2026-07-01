/**
 * Reconcile SupplyContracts — gom các SC duplicate / PLHD về 1 HĐ gốc
 * theo nghiệp vụ TLG: "1 partner + 1 programType = 1 HĐ gốc; còn lại là
 * phụ lục (PLHD)".
 *
 * Logic:
 *   1. Group SC theo (partnerId, programType) — programType parse từ filename
 *      hoặc contractNumber (TTKN/KNDD/KNĐĐ/LĐKT/LDKT/other).
 *   2. Mỗi group có >1 SC:
 *      - Giữ SC sớm nhất (theo signedDate) làm gốc → set programType.
 *      - Các SC khác → push vào addendums[] của gốc + xoá SC dư.
 *      - Cùng ngày → CẢNH BÁO duplicate scan, KHÔNG tự xoá → user review.
 *
 * Mode:
 *   --dry-run (default) → in báo cáo, không sửa DB.
 *   --apply               → áp dụng thay đổi.
 *
 * Usage:
 *   node dist/scripts/reconcile-supply-contracts.js
 *   node dist/scripts/reconcile-supply-contracts.js --apply
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

type ProgramType = "ttkn" | "kndd" | "ldkt" | "other";

interface SCDoc {
  id: string;
  contractNumber?: string;
  signedDate?: string;
  status?: string;
  partner?: { id: string; name?: string } | string;
  media?: { id: string; filename?: string } | string;
  addendums?: Array<unknown>;
  programType?: ProgramType;
}

interface PlanAction {
  type: "set_root" | "merge_addendum" | "duplicate_warn";
  scId: string;
  scContractNumber: string;
  signedDate: string;
  rootScId?: string;
  reason?: string;
}

function detectProgramType(text: string): ProgramType {
  const t = text.toUpperCase();
  if (/KNDD|KNĐĐ|KN\sĐĐ|KN_DD/.test(t)) return "kndd";
  if (/LĐKT|LDKT|LD\sKT/.test(t)) return "ldkt";
  if (/TTKN|TTSKN|TTSK\b/.test(t)) return "ttkn";
  return "other";
}

function getPartnerId(sc: SCDoc): string | null {
  if (!sc.partner) return null;
  if (typeof sc.partner === "string") return sc.partner;
  return sc.partner.id ?? null;
}

function getMediaFilename(sc: SCDoc): string {
  if (!sc.media) return "";
  if (typeof sc.media === "string") return "";
  return sc.media.filename ?? "";
}

async function main(): Promise<void> {
  loadConfig();
  const apply = process.argv.includes("--apply");
  logger.info("Reconcile", `▶▶▶ ${apply ? "APPLY" : "DRY-RUN"} reconcile supply-contracts`);

  // 1. Load all SC + populate partner + media
  const all = await payload.request<{ docs: SCDoc[]; totalDocs: number }>(
    `/api/supply-contracts`,
    { query: { limit: 500, depth: 1 } },
  );
  logger.info("Reconcile", `Tổng ${all.totalDocs} SC`);

  // 2. Group by (partnerId, programType)
  type Group = { partnerId: string; programType: ProgramType; scs: SCDoc[] };
  const groups = new Map<string, Group>();

  for (const sc of all.docs) {
    const pid = getPartnerId(sc);
    if (!pid) {
      logger.warn("Reconcile", `  SC#${sc.id} ${sc.contractNumber}: orphan (no partner) — skip`);
      continue;
    }
    // Detect programType từ filename + contractNumber
    const detectText = `${getMediaFilename(sc)} ${sc.contractNumber ?? ""}`;
    const prog = detectProgramType(detectText);
    const key = `${pid}::${prog}`;
    let g = groups.get(key);
    if (!g) {
      g = { partnerId: pid, programType: prog, scs: [] };
      groups.set(key, g);
    }
    g.scs.push(sc);
  }

  // 3. Build plan
  const actions: PlanAction[] = [];
  let dupWarnings = 0;
  let singletons = 0;
  let mergeGroups = 0;

  for (const [key, g] of groups) {
    if (g.scs.length === 1) {
      // Single SC — chỉ cần set programType
      actions.push({
        type: "set_root",
        scId: g.scs[0].id,
        scContractNumber: g.scs[0].contractNumber ?? "",
        signedDate: g.scs[0].signedDate?.slice(0, 10) ?? "?",
      });
      singletons += 1;
      continue;
    }

    // Multiple — sort by signedDate asc, giữ cái sớm nhất làm gốc
    g.scs.sort((a, b) => (a.signedDate ?? "").localeCompare(b.signedDate ?? ""));
    const root = g.scs[0];
    const others = g.scs.slice(1);
    mergeGroups += 1;

    actions.push({
      type: "set_root",
      scId: root.id,
      scContractNumber: root.contractNumber ?? "",
      signedDate: root.signedDate?.slice(0, 10) ?? "?",
    });

    for (const o of others) {
      if ((o.signedDate ?? "") === (root.signedDate ?? "")) {
        actions.push({
          type: "duplicate_warn",
          scId: o.id,
          scContractNumber: o.contractNumber ?? "",
          signedDate: o.signedDate?.slice(0, 10) ?? "?",
          rootScId: root.id,
          reason: "Cùng ngày ký với root — có thể duplicate scan",
        });
        dupWarnings += 1;
      } else {
        actions.push({
          type: "merge_addendum",
          scId: o.id,
          scContractNumber: o.contractNumber ?? "",
          signedDate: o.signedDate?.slice(0, 10) ?? "?",
          rootScId: root.id,
          reason: "Ngày ký sau root — coi là PLHD",
        });
      }
    }

    // Log group
    const partnerName = typeof g.scs[0].partner === "object" ? g.scs[0].partner?.name : "?";
    logger.info("Reconcile", `\n📁 [${g.programType.toUpperCase()}] ${partnerName} — ${g.scs.length} SC:`);
    logger.info("Reconcile", `   GỐC: SC#${root.id} ${root.contractNumber} (${root.signedDate?.slice(0,10) ?? "?"})`);
    for (const o of others) {
      const fn = getMediaFilename(o);
      const tag = (o.signedDate ?? "") === (root.signedDate ?? "") ? "⚠ DUP" : "→ PLHD";
      logger.info("Reconcile", `   ${tag} SC#${o.id} (${o.signedDate?.slice(0,10) ?? "?"}) ${fn}`);
    }
  }

  // 4. Summary
  logger.info("Reconcile", `\n╔═══════════════════════════════════════╗`);
  logger.info("Reconcile", `║ ${apply ? "APPLY" : "DRY-RUN"} SUMMARY`);
  logger.info("Reconcile", `║   Groups: ${groups.size}`);
  logger.info("Reconcile", `║   Singletons (chỉ set programType): ${singletons}`);
  logger.info("Reconcile", `║   Multi groups (merge addendum): ${mergeGroups}`);
  logger.info("Reconcile", `║   Sẽ MERGE addendum: ${actions.filter((a) => a.type === "merge_addendum").length}`);
  logger.info("Reconcile", `║   Cảnh báo DUP scan (cần review): ${dupWarnings}`);
  logger.info("Reconcile", `║   Tổng SC sau: ${groups.size} (giảm từ ${all.totalDocs})`);
  logger.info("Reconcile", `╚═══════════════════════════════════════╝`);

  if (!apply) {
    logger.info("Reconcile", `\nDry-run xong. Nếu OK, chạy lại với --apply để áp dụng.`);
    return;
  }

  // 5. Apply
  let applied = 0;
  let failed = 0;
  for (const a of actions) {
    try {
      if (a.type === "set_root") {
        // Set programType cho SC root (programType derive từ filename)
        const group = [...groups.values()].find((g) => g.scs[0].id === a.scId);
        if (group) {
          await payload.request(`/api/supply-contracts/${encodeURIComponent(a.scId)}`, {
            method: "PATCH",
            body: { programType: group.programType },
          });
        }
        applied += 1;
      } else if (a.type === "merge_addendum") {
        // Lấy SC cũ → push thành addendum của root → xoá SC cũ
        const oldSC = all.docs.find((s) => s.id === a.scId);
        if (!oldSC || !a.rootScId) continue;
        const root = await payload.request<SCDoc>(
          `/api/supply-contracts/${encodeURIComponent(a.rootScId)}`,
        );
        const existing = Array.isArray(root.addendums) ? root.addendums : [];
        const mediaId = typeof oldSC.media === "object" ? oldSC.media?.id : oldSC.media;
        const addendumNumber = `PLHD-${String(existing.length + 1).padStart(2, "0")}`;
        existing.push({
          addendumNumber,
          signedDate: oldSC.signedDate,
          file: mediaId,
          changes: oldSC.contractNumber ?? "",
          notes: `Migrated from SC#${oldSC.id}`,
        });
        await payload.request(`/api/supply-contracts/${encodeURIComponent(a.rootScId)}`, {
          method: "PATCH",
          body: { addendums: existing },
        });
        await payload.request(`/api/supply-contracts/${encodeURIComponent(a.scId)}`, {
          method: "DELETE",
        });
        applied += 1;
      }
      // duplicate_warn: KHÔNG auto, để user review
    } catch (err) {
      const reason = err instanceof PayloadError ? err.message : String(err);
      logger.error("Reconcile", `  ✗ ${a.type} SC#${a.scId}: ${reason}`);
      failed += 1;
    }
  }
  logger.info("Reconcile", `\n║ Applied: ${applied}, Failed: ${failed}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
