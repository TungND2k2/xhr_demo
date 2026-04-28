import { extractFromText } from "./claude.js";
import type { InvoiceExtract } from "./types.js";

const INVOICE_INSTRUCTION = `Đây là HÓA ĐƠN của một đơn hàng may thêu xuất khẩu trẻ em.
Trích thông tin và trả về JSON theo schema:

{
  "customer": { "name": string, "country"?: string, "phone"?: string, "email"?: string },
  "items": [ { "description": string, "size"?: string, "quantity": number, "pricePerUnit"?: number } ],
  "totalAmount"?: number,    // tổng giá trị đơn (số nguyên VND, không format)
  "currency"?: string,        // "VND" / "USD" / etc.
  "invoiceDate"?: string,     // YYYY-MM-DD
  "notes"?: string
}

Quy tắc:
- KHÔNG bịa. Field nào không có trong tài liệu → bỏ trống.
- Số lượng (quantity) bắt buộc nếu có item.
- Giá (pricePerUnit, totalAmount) là SỐ THUẦN (không "đ" không dấu chấm).
- Description là mô tả ngắn (≤120 ký tự).`;

export function extractInvoice(documentText: string): Promise<InvoiceExtract> {
  return extractFromText<InvoiceExtract>({
    instruction: INVOICE_INSTRUCTION,
    documentText,
    tag: "invoice",
  });
}
