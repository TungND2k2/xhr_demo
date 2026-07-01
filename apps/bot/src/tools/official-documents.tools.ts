import { z } from "zod";
import { createCrudTools } from "./factory.js";

export const DOCUMENT_DIRECTIONS = ["incoming", "outgoing", "internal"] as const;
export const DOCUMENT_STATUSES = [
  "draft",
  "sent",
  "received",
  "processing",
  "completed",
  "archived",
  "cancelled",
] as const;
export const DOCUMENT_PRIORITIES = ["normal", "urgent", "very_urgent", "confidential"] as const;
export const DOCUMENT_TYPES = [
  "decision",
  "circular",
  "official_letter",
  "notice",
  "report",
  "contract",
  "license",
  "letter",
  "other",
] as const;

export const officialDocumentTools = createCrudTools({
  slug: "official-documents",
  label: { singular: "công văn", plural: "công văn" },
  titleField: "documentCode",
  filterableFields: [
    "documentCode",
    "officialNumber",
    "title",
    "direction",
    "status",
    "documentType",
    "priority",
    "issuingAuthority",
    "recipient",
    "signedBy",
  ],
  // q search fuzzy đa field — cover "tìm công văn về Sở LĐ" / "BHXH" / số văn bản
  qSearchFields: ["documentCode", "officialNumber", "title", "summary", "issuingAuthority", "signedBy"],
  listFields: [
    "direction",
    "status",
    "title",
    "officialNumber",
    "issuedDate",
    "issuingAuthority",
    "priority",
    "documentType",
    "deadline",
  ],
  inputSchema: {
    documentCode: z.string().describe("Mã CV nội bộ TLG, vd CV-2024-001"),
    direction: z.enum(DOCUMENT_DIRECTIONS).describe("incoming = đến, outgoing = đi, internal = nội bộ"),
    title: z.string().describe("Tiêu đề / trích yếu công văn"),
    officialNumber: z.string().optional().describe("Số văn bản do cơ quan ban hành cấp"),
    issuedDate: z.string().describe("Ngày ban hành YYYY-MM-DD"),
    receivedDate: z.string().optional().describe("Ngày TLG nhận/gửi"),
    issuingAuthority: z.string().optional().describe("Cơ quan ban hành"),
    recipient: z.string().optional().describe("Nơi nhận"),
    signedBy: z.string().optional(),
    priority: z.enum(DOCUMENT_PRIORITIES).optional(),
    documentType: z.enum(DOCUMENT_TYPES).optional(),
    status: z.enum(DOCUMENT_STATUSES).optional(),
    assignedTo: z.string().optional().describe("Employee ID được giao xử lý"),
    deadline: z.string().optional().describe("Hạn xử lý YYYY-MM-DD"),
    scanFile: z.string().optional().describe("Media ID của file scan"),
    summary: z.string().optional().describe("Tóm tắt nội dung 4-8 câu"),
    notes: z.string().optional(),
  },
});
