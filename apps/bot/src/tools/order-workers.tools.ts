import { z } from "zod";
import { createCrudTools } from "./factory.js";

/**
 * OrderWorkers — quan hệ ứng viên × đơn tuyển. AI dùng để:
 *  - Đăng ký 1 worker vào 1 order
 *  - Cập nhật kết quả sàng lọc / khám SK / đào tạo / phỏng vấn
 *  - Liệt kê ai đang ở giai đoạn nào của đơn
 */
export const orderWorkerTools = createCrudTools({
  slug: "order-workers",
  label: { singular: "ứng viên trong đơn", plural: "ứng viên × đơn" },
  titleField: "label",
  filterableFields: [
    "status",
    "screeningStatus",
    "medicalStatus",
    "trainingStatus",
    "interviewResult",
  ],
  inputSchema: {
    order: z.string().describe("ID đơn tuyển"),
    worker: z.string().describe("ID người lao động"),
    appliedAt: z.string().optional().describe("Ngày ứng tuyển YYYY-MM-DD"),
    source: z
      .enum(["walk_in", "referral", "fb_ads", "agent", "other"])
      .optional(),
    referrer: z.string().optional(),
    screeningStatus: z.enum(["pending", "pass", "fail"]).optional(),
    screeningNotes: z.string().optional(),
    medicalStatus: z
      .enum(["pending", "scheduled", "pass", "fail"])
      .optional(),
    medicalDate: z.string().optional(),
    trainingStatus: z
      .enum(["not_started", "in_progress", "completed", "dropped"])
      .optional(),
    trainingClass: z.string().optional(),
    trainingScore: z.number().optional(),
    interviewDate: z.string().optional(),
    interviewer: z.string().optional(),
    interviewResult: z.enum(["pending", "pass", "fail", "retest"]).optional(),
    status: z
      .enum([
        "applied",
        "screening",
        "medical",
        "training",
        "interviewed",
        "passed",
        "deployed",
        "dropped",
      ])
      .optional(),
    notes: z.string().optional(),
  },
});
