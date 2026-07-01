import { z } from "zod";
import { createCrudTools } from "./factory.js";

export const PARTNER_COUNTRIES = ["jp", "kr", "tw", "de", "me", "eu", "other"] as const;

export const partnerTools = createCrudTools({
  slug: "partners",
  label: { singular: "đối tác", plural: "đối tác" },
  titleField: "name",
  filterableFields: ["name", "country", "directorName", "email", "phone", "active"],
  // Trả full contact info trong list → AI không cần loop get_partners.
  listFields: ["country", "directorName", "email", "phone", "address", "firstContractDate", "active"],
  inputSchema: {
    name: z.string().describe("Tên công ty đối tác (đầy đủ, dùng làm unique key)"),
    country: z.enum(PARTNER_COUNTRIES).describe("Thị trường: jp/kr/tw/de/me/eu/other"),
    directorName: z.string().optional().describe("Tên Giám đốc / Người đại diện"),
    email: z.string().optional().describe("Email liên hệ"),
    phone: z.string().optional().describe("Số điện thoại"),
    address: z.string().optional().describe("Địa chỉ trụ sở"),
    website: z.string().optional(),
    taxId: z.string().optional().describe("Mã số thuế / Reg. No."),
    firstContractDate: z.string().optional().describe("Ngày ký HĐCU đầu tiên (YYYY-MM-DD)"),
    active: z.boolean().optional().describe("Đang hợp tác (default true)"),
    notes: z.string().optional(),
  },
});
