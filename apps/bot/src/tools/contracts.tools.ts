import { z } from "zod";
import { createCrudTools } from "./factory.js";

export const contractTools = createCrudTools({
  slug: "contracts",
  label: { singular: "hợp đồng", plural: "hợp đồng" },
  titleField: "contractCode",
  filterableFields: ["contractCode", "status", "visaStatus"],
  inputSchema: {
    order: z.string().describe("ID đơn tuyển"),
    worker: z.string().describe("ID người lao động"),
    signingDate: z.string().describe("Ngày ký YYYY-MM-DD"),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    salary: z.number().nonnegative().describe("Lương cơ bản"),
    currency: z.enum(["JPY", "KRW", "USD", "EUR", "TWD", "VND"]).optional(),
    salaryPeriod: z.enum(["monthly", "weekly", "hourly"]).optional(),
    benefits: z.string().optional(),
    visaStatus: z
      .enum(["not_applied", "submitted", "processing", "approved", "rejected"])
      .optional(),
    visaSubmittedAt: z.string().optional(),
    visaApprovedAt: z.string().optional(),
    deploymentDate: z.string().optional().describe("Ngày xuất cảnh thực tế"),
    expectedReturnDate: z.string().optional(),
    flightNumber: z.string().optional(),
    destination: z.string().optional(),
    serviceFee: z.number().nonnegative().optional(),
    depositPaid: z.number().nonnegative().optional(),
    status: z
      .enum([
        "draft",
        "signed",
        "visa_pending",
        "deployed",
        "completed",
        "terminated",
      ])
      .optional(),
    notes: z.string().optional(),
  },
});
