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
    brokerAgency: z.string().optional().describe("Tên nghiệp đoàn / broker trung gian"),
    brokerAgencyContact: z.string().optional().describe("SĐT nghiệp đoàn"),
    contractNumber: z.string().optional().describe("Số HĐCU (Hợp đồng cung ứng)"),
    contractDate: z.string().optional().describe("Ngày ký HĐCU YYYY-MM-DD"),
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
    attributes: z
      .array(
        z.object({
          key: z.string().describe("Tên thuộc tính, vd 'Phụ cấp ăn', 'Loại visa', 'Bảo hiểm'"),
          value: z.string().describe("Giá trị"),
          note: z.string().optional().describe("Ghi chú thêm nếu cần"),
        }),
      )
      .optional()
      .describe(
        "Thuộc tính bổ sung không có cột riêng. Dùng khi đọc YCTD/HĐ thấy info quan trọng nhưng không match schema (vd: phụ cấp, loại visa, bảo hiểm, điều khoản đặc biệt). Mỗi item là 1 cặp key-value.",
      ),
  },
});
