import { z } from "zod";
import { createCrudTools } from "./factory.js";

/**
 * Workers — người lao động đăng ký XKLĐ. AI cần xem hồ sơ + sàng lọc
 * theo yêu cầu đơn (vd: cao trên 165cm, nói được tiếng Nhật N4).
 */
export const workerTools = createCrudTools({
  slug: "workers",
  label: { singular: "người lao động", plural: "người lao động" },
  titleField: "fullName",
  filterableFields: ["workerCode", "fullName", "phone", "status", "hometown"],
  inputSchema: {
    fullName: z.string().describe("Họ tên đầy đủ"),
    dob: z.string().optional().describe("Ngày sinh YYYY-MM-DD"),
    gender: z.enum(["male", "female", "other"]).optional(),
    phone: z.string().describe("Số điện thoại"),
    email: z.string().email().optional(),
    hometown: z.string().optional().describe("Quê quán"),
    address: z.string().optional(),
    height: z.number().optional().describe("Chiều cao (cm)"),
    weight: z.number().optional().describe("Cân nặng (kg)"),
    education: z.enum([
      "primary",
      "secondary",
      "highschool",
      "vocational",
      "college",
      "university",
      "postgrad",
    ]).optional(),
    nationalId: z.string().optional().describe("CCCD/CMND"),
    passportNo: z.string().optional(),
    healthStatus: z.enum(["pending", "scheduled", "pass", "fail", "retest"]).optional(),
    status: z.enum([
      "new",
      "screening",
      "training",
      "ready",
      "contracted",
      "deployed",
      "returned",
      "paused",
      "blacklisted",
    ]).optional(),
    notes: z.string().optional(),
  },
});
