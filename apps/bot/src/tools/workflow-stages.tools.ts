import { z } from "zod";
import { createCrudTools } from "./factory.js";

/**
 * Workflow stages — AI dùng để biết:
 *  - Đơn này đang ở bước nào, bước này dự kiến bao nhiêu ngày
 *  - Ai phụ trách, ai duyệt
 *  - Output cần gì để chuyển bước
 *  - Lịch nhắc
 *
 * Manager update qua admin → AI tự đọc cấu hình mới.
 */
export const workflowStageTools = createCrudTools({
  slug: "workflow-stages",
  label: { singular: "bước workflow", plural: "bước workflow" },
  titleField: "name",
  filterableFields: ["code", "responsibleRole"],
  inputSchema: {
    order: z.number().int().positive().describe("Thứ tự bước"),
    code: z.enum(["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "done"]).describe("Mã bước"),
    name: z.string().describe("Tên bước"),
    durationDays: z.number().nonnegative().optional(),
    responsibleRole: z.string().describe("Role phụ trách"),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
  },
  exclude: ["delete"], // không cho LLM xoá cấu hình workflow
});
