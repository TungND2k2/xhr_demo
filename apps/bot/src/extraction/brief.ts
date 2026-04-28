import { extractFromText } from "./claude.js";
import type { BriefExtract } from "./types.js";

const BRIEF_INSTRUCTION = `Đây là ĐỀ BÀI của một đơn hàng may thêu trẻ em xuất khẩu.
ĐỀ BÀI KHÔNG có giá và KHÔNG có thông tin khách hàng — chỉ có yêu cầu sản xuất.

Trích thông tin và trả về JSON theo schema:

{
  "items": [
    {
      "description": string,    // mô tả: vải (woven/knit), dáng/style, kiểu thêu
                                // (handsmocked / french knot / beaded / shadow /
                                //  hand embroidery / machine embroidery),
                                // có lining đầy đủ hay chỉ lót phần thêu,
                                // có mác hay không mác
      "size"?: string,
      "quantity": number
    }
  ],
  "deadline"?: string,           // YYYY-MM-DD — BẮT BUỘC theo guide
  "fabricType"?: "woven" | "knit",
  "embroideryType"?: string,
  "notes"?: string
}

Quy tắc:
- KHÔNG bịa. Không có giá → bỏ qua.
- Mô tả phải đủ chi tiết để khớp với hóa đơn (vải/dáng/thêu/lining/mác).
- Nếu không tìm thấy deadline trong tài liệu, để trống — sẽ bị flag warning.`;

export function extractBrief(documentText: string): Promise<BriefExtract> {
  return extractFromText<BriefExtract>({
    instruction: BRIEF_INSTRUCTION,
    documentText,
    tag: "brief",
  });
}
