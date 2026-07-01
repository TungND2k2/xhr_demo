/**
 * Seed test data — Tài sản phòng Hàn Quốc (theo biên bản giấy do user
 * chụp ngày 05/03/2021).
 *
 * Mỗi dòng trong biên bản → 1 Asset record với field `quantity` để gom
 * số lượng cùng loại (đúng nghiệp vụ thực tế của TLG).
 *
 * Idempotent: upsert theo `assetCode` — chạy lại không trùng.
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

interface AssetSeed {
  assetCode: string;
  name: string;
  category:
    | "computer"
    | "phone"
    | "vehicle"
    | "printer"
    | "furniture"
    | "training_equipment"
    | "stationery"
    | "physical_doc"
    | "other";
  status: "in_use" | "in_stock" | "repairing" | "broken" | "disposed" | "lost";
  quantity: number;
  location: string;
  serialNumber?: string;
  notes?: string;
}

// Phòng Hàn Quốc — kiểm kê 10g00 ngày 05/03/2021
const ASSETS: AssetSeed[] = [
  {
    assetCode: "HK-DH-001",
    name: "Điều hoà 2HP",
    category: "other",
    status: "in_use",
    quantity: 2,
    location: "Phòng Hàn Quốc",
  },
  {
    assetCode: "HK-PC-001",
    name: "Máy tính để bàn (PC)",
    category: "computer",
    status: "in_use",
    quantity: 4,
    location: "Phòng Hàn Quốc",
  },
  {
    assetCode: "HK-LT-001",
    name: "Laptop Dell Vostro 5380",
    category: "computer",
    status: "in_use",
    quantity: 1,
    location: "Phòng Hàn Quốc",
    serialNumber: "Vostro 5380",
  },
  {
    assetCode: "HK-SC-001",
    name: "Máy scan HP G2410",
    category: "printer",
    status: "in_use",
    quantity: 1,
    location: "Phòng Hàn Quốc",
    serialNumber: "HP G2410",
  },
  {
    assetCode: "HK-BA-001",
    name: "Bàn làm việc",
    category: "furniture",
    status: "in_use",
    quantity: 5,
    location: "Phòng Hàn Quốc",
  },
  {
    assetCode: "HK-GH-001",
    name: "Ghế xoay (loại thường)",
    category: "furniture",
    status: "in_use",
    quantity: 3,
    location: "Phòng Hàn Quốc",
  },
  {
    assetCode: "HK-GHC-001",
    name: "Ghế xoay (kiểu cũ)",
    category: "furniture",
    status: "in_use",
    quantity: 4,
    location: "Phòng Hàn Quốc",
    notes: "Kiểu cũ, một số chân yếu — đang dùng tạm",
  },
  {
    assetCode: "HK-GHTP-001",
    name: "Ghế trưởng phòng",
    category: "furniture",
    status: "in_use",
    quantity: 1,
    location: "Phòng Hàn Quốc",
  },
];

async function main(): Promise<void> {
  loadConfig();
  logger.info("Seed", `▶▶▶ Seed ${ASSETS.length} assets (Phòng Hàn Quốc)`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const a of ASSETS) {
    try {
      const existing = await payload.request<{ docs: Array<{ id: string }> }>(
        `/api/assets`,
        {
          query: {
            where: { assetCode: { equals: a.assetCode } },
            limit: 1,
            depth: 0,
          },
        },
      );
      if (existing.docs.length > 0) {
        await payload.request(`/api/assets/${encodeURIComponent(existing.docs[0].id)}`, {
          method: "PATCH",
          body: a,
        });
        logger.info("Seed", `  ↻ ${a.assetCode} updated (${a.name} × ${a.quantity})`);
        updated += 1;
      } else {
        await payload.request(`/api/assets`, { method: "POST", body: a });
        logger.info("Seed", `  ✓ ${a.assetCode} created (${a.name} × ${a.quantity})`);
        created += 1;
      }
    } catch (err) {
      const reason = err instanceof PayloadError ? err.message : String(err);
      logger.error("Seed", `  ✗ ${a.assetCode} failed: ${reason}`);
      failed += 1;
    }
  }

  logger.info("Seed", `\n╔═══════════════════════════════════════╗`);
  logger.info("Seed", `║ DONE`);
  logger.info("Seed", `║   created: ${created}`);
  logger.info("Seed", `║   updated: ${updated}`);
  logger.info("Seed", `║   failed:  ${failed}`);
  logger.info("Seed", `╚═══════════════════════════════════════╝`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
