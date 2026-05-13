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
    status: z
      .enum([
        "new",
        "researching",
        "agreed",
        "health_check",
        "deposit_paid",
        "training",
        "exam",
        "passed",
        "failed",
        "contracted",
        "visa_prep",
        "deployed",
        "working",
        "returned",
        "paused",
        "blacklisted",
      ])
      .optional()
      .describe(
        "Vòng đời LĐ XKLĐ: new → researching (đang tìm hiểu) → agreed (đồng ý tham gia) → health_check (đang khám) → deposit_paid (đặt cọc) → training (đào tạo) → exam (thi tuyển) → passed/failed → contracted (ký HĐ) → visa_prep (xin visa) → deployed (xuất cảnh) → working (làm việc NN) → returned (về nước). paused/blacklisted là trạng thái đặc biệt.",
      ),
    examResult: z
      .enum(["pending", "pass", "fail"])
      .optional()
      .describe("Kết quả thi tuyển — set sau khi LĐ thi xong"),
    examScore: z.number().optional().describe("Điểm thi nếu có"),
    failureReason: z
      .string()
      .optional()
      .describe('Lý do trượt — chỉ điền khi examResult="fail"'),
    notes: z.string().optional(),
  },
});
