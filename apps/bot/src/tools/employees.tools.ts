import { z } from "zod";
import { createCrudTools } from "./factory.js";

export const EMPLOYEE_DEPARTMENTS = [
  "hcns",
  "tuyendung",
  "daotao",
  "visa",
  "ketoan",
  "yte",
  "phong_jp",
  "phong_kr",
  "phong_tw",
  "phong_de",
  "bgd",
  "other",
] as const;

export const EMPLOYEE_STATUSES = [
  "working",
  "long_leave",
  "maternity",
  "resigned",
  "fired",
  "suspended",
] as const;

export const employeeTools = createCrudTools({
  slug: "employees",
  label: { singular: "nhân sự", plural: "nhân sự" },
  titleField: "fullName",
  filterableFields: ["employeeCode", "fullName", "department", "position", "status", "phone", "email"],
  // Fuzzy search across nhiều field — AI gọi q="Linh" tìm trong tất cả các trường text
  qSearchFields: ["fullName", "employeeCode", "email", "phone", "idNumber", "position"],
  listFields: ["employeeCode", "department", "position", "status", "phone", "email", "hireDate", "idNumber"],
  inputSchema: {
    employeeCode: z.string().describe("Mã NV, vd EMP-001 (unique)"),
    fullName: z.string().describe("Họ tên đầy đủ"),
    dateOfBirth: z.string().optional().describe("YYYY-MM-DD"),
    gender: z.enum(["male", "female", "other"]).optional(),
    idNumber: z.string().optional().describe("CCCD/CMND"),
    phone: z.string().optional(),
    email: z.string().optional(),
    telegramUserId: z.string().optional(),
    address: z.string().optional(),
    department: z.enum(EMPLOYEE_DEPARTMENTS).describe("Phòng ban"),
    position: z.string().describe("Chức vụ"),
    manager: z.string().optional().describe("ID nhân sự cấp trên trực tiếp"),
    userAccount: z.string().optional().describe("ID Users account (nếu có)"),
    hireDate: z.string().optional().describe("YYYY-MM-DD"),
    contractType: z.enum(["probation", "fixed", "indefinite", "contractor", "intern"]).optional(),
    contractEndDate: z.string().optional().describe("YYYY-MM-DD"),
    status: z.enum(EMPLOYEE_STATUSES).optional(),
    salary: z.number().nonnegative().optional().describe("VND/tháng"),
    extraFields: z
      .array(z.object({ key: z.string(), value: z.string() }))
      .optional()
      .describe(
        "Thông tin bổ sung dạng key-value (BHXH, MST, người liên hệ khẩn cấp, tài khoản NH, đặc thù riêng). Linh hoạt — không cần schema cứng.",
      ),
    notes: z.string().optional(),
  },
});
