import { z } from "zod";
import { createCrudTools } from "./factory.js";

export const ORDER_STATUSES = [
  "w1",
  "w2",
  "w3",
  "w4",
  "w5",
  "w6",
  "w7",
  "w8",
  "done",
  "paused",
  "cancelled",
] as const;

export const orderTools = createCrudTools({
  slug: "orders",
  label: { singular: "đơn tuyển", plural: "đơn tuyển" },
  titleField: "orderCode",
  filterableFields: [
    "orderCode",
    "employer",
    "position",
    "market",
    "status",
  ],
  inputSchema: {
    market: z.enum(["jp", "kr", "tw", "de", "me", "eu", "other"]),
    employer: z.string().describe("Tên xí nghiệp / công ty đối tác"),
    employerCountry: z.string().optional(),
    employerContact: z.string().optional(),
    employerEmail: z.string().email().optional(),
    position: z.string().describe("Vị trí / nghề tuyển"),
    quantityNeeded: z.number().int().positive().describe("Số lượng cần tuyển"),
    contractDurationMonths: z.number().int().positive().optional(),
    genderPreference: z.enum(["any", "male", "female"]).optional(),
    ageMin: z.number().int().optional(),
    ageMax: z.number().int().optional(),
    salaryFrom: z.number().nonnegative().optional(),
    salaryTo: z.number().nonnegative().optional(),
    currency: z.enum(["JPY", "KRW", "USD", "EUR", "TWD", "VND"]).optional(),
    requirements: z.string().optional().describe("Yêu cầu chi tiết"),
    benefits: z.string().optional(),
    deadline: z.string().describe("Hạn tuyển đủ YYYY-MM-DD"),
    deploymentDate: z.string().optional().describe("Dự kiến xuất cảnh YYYY-MM-DD"),
    serviceFee: z.number().nonnegative().optional(),
    depositRequired: z.number().nonnegative().optional(),
    status: z.enum(ORDER_STATUSES).optional(),
    notes: z.string().optional(),
  },
});
