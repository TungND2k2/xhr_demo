import { z } from "zod";
import { createCrudTools } from "./factory.js";

export const ASSET_CATEGORIES = [
  "computer",
  "phone",
  "vehicle",
  "printer",
  "furniture",
  "training_equipment",
  "stationery",
  "physical_doc",
  "other",
] as const;

export const ASSET_STATUSES = [
  "in_use",
  "in_stock",
  "repairing",
  "broken",
  "disposed",
  "lost",
] as const;

export const assetTools = createCrudTools({
  slug: "assets",
  label: { singular: "tài sản", plural: "tài sản" },
  titleField: "name",
  filterableFields: ["assetCode", "name", "category", "status", "location"],
  inputSchema: {
    assetCode: z.string().describe('Mã tài sản, vd "LT-001"'),
    name: z.string().describe("Tên tài sản"),
    category: z.enum(ASSET_CATEGORIES),
    status: z.enum(ASSET_STATUSES).optional(),
    assignedToUserId: z.string().optional().describe("user.id đang phụ trách"),
    purchaseDate: z.string().optional().describe("YYYY-MM-DD"),
    purchaseValue: z.number().nonnegative().optional().describe("VND"),
    warrantyUntil: z.string().optional().describe("YYYY-MM-DD"),
    serialNumber: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
  },
});
