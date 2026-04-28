/**
 * Verify ảnh xác nhận của khách hàng theo guide:
 *  - Có 2 đối tượng (subjects) trong ảnh — thường là 2 ô chat
 *  - Có câu hỏi như "pls confirm the invoice is correct?"
 *  - Có từ "approved" / "correct" / "confirmed" trong câu trả lời
 *
 * Dùng claude-agent-sdk vision (OAuth Claude Max, không cần API key).
 */
import { extractFromImage } from "./claude.js";
import type { ImageVerifyResult } from "./types.js";

const VERIFY_INSTRUCTION = `Đây là ảnh chụp màn hình cuộc trò chuyện giữa SALES và KHÁCH HÀNG.

Kiểm tra:
1. Ảnh có 2 đối tượng/người trong cuộc trò chuyện không (thường là 2 bubble chat của 2 bên)?
2. Có từ "approved", "correct", "confirmed", "ok", "yes", "đúng", "ok rồi", "duyệt", "xác nhận" trong tin nhắn KHÁCH trả lời không?
3. Có câu hỏi xác nhận hóa đơn từ Sales (vd: "pls confirm the invoice is correct?", "are you ok with the invoice?", "xác nhận hóa đơn đúng chưa?") không?

Trả về JSON đúng schema sau (KHÔNG markdown, KHÔNG giải thích ngoài):

{
  "isValid": boolean,                         // true nếu ĐỦ cả 3 điều kiện trên
  "reasoning": string,                        // 1 câu tiếng Việt giải thích kết luận
  "hasTwoSubjects": boolean,
  "hasConfirmationKeyword": boolean,
  "detectedKeywords": string[]                // các từ khoá bắt được
}

Lưu ý:
- "isValid" CHỈ true khi cả hasTwoSubjects=true VÀ hasConfirmationKeyword=true.
- Nếu ảnh mờ, không đọc được, hoặc không phải chat → isValid=false, giải thích.`;

export function verifyConfirmationImage(
  imageBuffer: Buffer,
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
): Promise<ImageVerifyResult> {
  return extractFromImage<ImageVerifyResult>({
    imageBuffer,
    mediaType,
    instruction: VERIFY_INSTRUCTION,
    tag: "image-verify",
  });
}
