/**
 * Seed Form Template: "Sơ yếu lý lịch thực tập sinh" (TLG TTKN/KNĐĐ).
 *
 * Mẫu lấy từ HSN-M01.MẪU FORM.pdf (đơn TLG). Form-builder plugin của
 * Payload — fields render thành public form page khi NLĐ mở link.
 *
 * Idempotent: upsert theo `title` (unique soft). Run lại không tạo trùng.
 *
 * Usage:
 *   cd /opt/xhr-v1/apps/bot
 *   node dist/scripts/seed-form-trainee-resume.js
 */
import "dotenv/config";

import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { payload, PayloadError } from "../payload/client.js";

const FORM_TITLE = "Sơ yếu lý lịch thực tập sinh";

// Helper builders — Payload form-builder field blocks
type FieldWidth = number;
type FormField = Record<string, unknown>;

const txt = (name: string, label: string, required = false, width: FieldWidth = 50): FormField => ({
  blockType: "text",
  name,
  label,
  required,
  width,
});
const ta = (name: string, label: string, required = false, width: FieldWidth = 100): FormField => ({
  blockType: "textarea",
  name,
  label,
  required,
  width,
});
const num = (name: string, label: string, required = false, width: FieldWidth = 33): FormField => ({
  blockType: "number",
  name,
  label,
  required,
  width,
});
const date = (name: string, label: string, required = false, width: FieldWidth = 33): FormField => ({
  blockType: "date",
  name,
  label,
  required,
  width,
});
const sel = (
  name: string,
  label: string,
  options: Array<{ label: string; value: string }>,
  required = false,
  width: FieldWidth = 33,
): FormField => ({
  blockType: "select",
  name,
  label,
  options,
  required,
  width,
});
const radio = (
  name: string,
  label: string,
  options: Array<{ label: string; value: string }>,
  required = false,
  width: FieldWidth = 33,
): FormField => ({
  blockType: "radio",
  name,
  label,
  options,
  required,
  width,
});
const msg = (text: string): FormField => ({
  blockType: "message",
  message: {
    root: {
      type: "root",
      version: 1,
      direction: "ltr",
      format: "",
      indent: 0,
      children: [
        {
          type: "heading",
          tag: "h3",
          version: 1,
          direction: "ltr",
          format: "",
          indent: 0,
          children: [{ type: "text", version: 1, mode: "normal", style: "", text, detail: 0, format: 0 }],
        },
      ],
    },
  },
});

const YES_NO: Array<{ label: string; value: string }> = [
  { label: "Có", value: "yes" },
  { label: "Không", value: "no" },
];

const FIELDS: FormField[] = [
  // ═══ THÔNG TIN ĐĂNG KÝ ═══
  msg("📋 Thông tin đăng ký"),
  txt("orderCode", "Đơn hàng đăng ký", false, 50),
  date("interviewDate", "Ngày thi tuyển", false, 50),
  txt("learningSource", "Học nguồn", false, 50),
  txt("learningEntrance", "Học thi tuyển", false, 50),

  // ═══ THÔNG TIN CÁ NHÂN ═══
  msg("👤 Thông tin cá nhân"),
  txt("fullName", "Họ tên đầy đủ", true, 50),
  txt("katakanaName", "Phiên âm Katakana", false, 50),
  radio("gender", "Giới tính", [
    { label: "Nam", value: "male" },
    { label: "Nữ", value: "female" },
  ], true, 33),
  date("dateOfBirth", "Ngày sinh", true, 33),
  num("age", "Tuổi", false, 33),
  num("heightCm", "Chiều cao (cm)", false, 50),
  num("weightKg", "Cân nặng (kg)", false, 50),
  txt("idNumber", "Số CMND/CCCD", true, 50),
  date("idIssuedDate", "Ngày cấp", false, 50),

  // ═══ NGOẠI HÌNH & SỨC KHỎE ═══
  msg("🏥 Ngoại hình & Sức khỏe"),
  ta("tattoo", "Hình xăm (mô tả nếu có)", false, 100),
  txt("eyeSightLeft", "Thị lực mắt trái", false, 33),
  txt("eyeSightRight", "Thị lực mắt phải", false, 33),
  radio("colorBlind", "Mù màu / yếu màu", YES_NO, false, 33),
  txt("bloodTypeBP", "Nhóm máu / huyết áp", false, 50),
  ta("healthCheck", "Tình trạng khám sức khỏe", false, 50),
  radio("drinker", "Có uống rượu không?", YES_NO, false, 33),
  radio("smoker", "Có hút thuốc không?", YES_NO, false, 33),
  radio("handDominant", "Tay thuận", [
    { label: "Phải", value: "right" },
    { label: "Trái", value: "left" },
    { label: "Cả 2", value: "both" },
  ], false, 33),

  // ═══ TÌNH TRẠNG GIA ĐÌNH ═══
  msg("👨‍👩‍👧 Tình trạng gia đình"),
  sel("maritalStatus", "Tình trạng hôn nhân", [
    { label: "Độc thân", value: "single" },
    { label: "Đã kết hôn", value: "married" },
    { label: "Ly hôn", value: "divorced" },
    { label: "Goá", value: "widowed" },
  ], false, 33),
  radio("hasChildren", "Đã có con hay chưa?", YES_NO, false, 33),
  txt("religion", "Tôn giáo", false, 33),

  // ═══ HỌC VẤN ═══
  msg("🎓 Học vấn"),
  sel("highestDegree", "Bằng cấp cao nhất", [
    { label: "Tiểu học", value: "primary" },
    { label: "THCS", value: "secondary" },
    { label: "THPT", value: "highschool" },
    { label: "Trung cấp", value: "vocational" },
    { label: "Cao đẳng", value: "college" },
    { label: "Đại học", value: "university" },
    { label: "Trên Đại học", value: "postgrad" },
    { label: "Khác", value: "other" },
  ], false, 50),
  ta("educationHistory",
    "Quá trình học tập (mỗi dòng 1 trường: Năm bắt đầu — Năm kết thúc | Tên trường | Chuyên ngành | Số năm | Thời gian học tiếng Nhật)",
    false, 100),

  // ═══ ĐỊA CHỈ & LIÊN HỆ ═══
  msg("🏠 Địa chỉ & liên hệ"),
  ta("address", "Địa chỉ thường trú", true, 100),
  txt("personalPhone", "Số ĐT cá nhân", true, 50),

  // ═══ VĂN PHÒNG PHỤ TRÁCH ═══
  msg("🏢 Văn phòng phụ trách"),
  // Options trống — FormClient sẽ tự load từ /api/offices?active=true.
  sel("office", "Văn phòng TLG đang phụ trách anh/chị", [], true, 50),

  // ═══ KINH NGHIỆM LÀM VIỆC ═══
  msg("💼 Kinh nghiệm làm việc"),
  ta("workHistory",
    "Quá trình công tác (mỗi dòng: Năm/tháng bắt đầu — kết thúc | Tên công ty | Ngành nghề | Địa điểm | Lương/tháng | Số năm)",
    false, 100),

  // ═══ LỊCH SỬ XUẤT CẢNH ═══
  msg("✈️ Lịch sử xuất cảnh"),
  ta("travelAbroad", "Đã từng đi nước ngoài (nước nào, thời gian, mục đích)?", false, 100),
  radio("visaJapanBefore", "Đã từng xin visa Nhật / nộp hồ sơ du học?", [
    { label: "Đã từng", value: "yes" },
    { label: "Chưa", value: "no" },
  ], false, 50),
  radio("criminalRecord", "Có tiền án tiền sự không?", YES_NO, false, 50),

  // ═══ ĐỘNG LỰC & ĐỊNH HƯỚNG ═══
  msg("🎯 Động lực & định hướng"),
  ta("orderReason", "Lý do chọn đơn hàng", false, 100),
  ta("strengths", "Điểm mạnh", false, 50),
  ta("weaknesses", "Điểm yếu", false, 50),
  ta("hobbies", "Sở thích", false, 50),
  ta("expertise", "Lĩnh vực chuyên môn xuất sắc", false, 50),
  ta("japanReason", "Lý do đi Nhật", false, 100),
  num("targetAmountAfter3y", "Số tiền mong muốn sau 3 năm (VND)", false, 50),
  ta("planAfterReturn", "Dự định khi về nước", false, 50),
  ta("relativeInJapan", "Người quen tại Nhật (tên, quan hệ, địa chỉ — nếu có)", false, 100),

  // ═══ GIA ĐÌNH ═══
  msg("👨‍👩‍👧‍👦 Thành viên gia đình"),
  ta("familyMembers",
    "Thành viên gia đình sống cùng (mỗi dòng 1 người: Quan hệ | Họ tên | Tuổi | Địa điểm | Nghề nghiệp | Thu nhập)",
    false, 100),

  // ═══ BẢO LÃNH ═══
  msg("✍️ Bảo lãnh & xác nhận"),
  txt("consentFrom", "Được sự đồng ý của", false, 33),
  txt("consentDuration", "Thời gian đồng ý (vd Nửa năm, 1 năm)", false, 33),
  date("enrollmentDate", "Ngày nhập học", false, 33),
  date("applicationDate", "Ngày ứng tuyển", false, 33),
  txt("guarantorRelation", "Quan hệ người bảo lãnh (bố/mẹ/vợ/chồng/anh/chị/em)", false, 33),
  txt("guarantorName", "Họ tên người bảo lãnh", false, 33),
  txt("guarantorPhone", "Số ĐT người bảo lãnh", false, 100),

  // ═══ NỘI BỘ TLG ═══
  msg("🏢 Thông tin nội bộ TLG (cán bộ điền)"),
  txt("managerName", "Cán bộ quản lý", false, 50),
  txt("managerPhone", "Số ĐT cán bộ quản lý", false, 50),
];

interface FormExisting {
  id: string;
  title: string;
}

async function main(): Promise<void> {
  loadConfig();
  logger.info("Seed", `▶▶▶ Seed form: ${FORM_TITLE}`);

  // Idempotent: tìm form theo title
  const existing = await payload.request<{ docs: FormExisting[] }>(
    `/api/forms`,
    { query: { where: { title: { equals: FORM_TITLE } }, limit: 1, depth: 0 } },
  );

  const body = {
    title: FORM_TITLE,
    fields: FIELDS,
    submitButtonLabel: "Gửi đăng ký",
    confirmationType: "message",
    confirmationMessage: {
      root: {
        type: "root",
        version: 1,
        direction: "ltr",
        format: "",
        indent: 0,
        children: [
          {
            type: "paragraph",
            version: 1,
            direction: "ltr",
            format: "",
            indent: 0,
            children: [
              {
                type: "text",
                version: 1,
                mode: "normal",
                style: "",
                text: "Cảm ơn anh/chị đã gửi đăng ký. Cán bộ TLG sẽ liên hệ trong 24h.",
                detail: 0,
                format: 0,
              },
            ],
          },
        ],
      },
    },
  };

  try {
    if (existing.docs.length > 0) {
      const id = existing.docs[0].id;
      await payload.request(`/api/forms/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body,
      });
      logger.info("Seed", `↻ Updated form #${id}`);
    } else {
      const r = await payload.request<{ doc: { id: string } }>(`/api/forms`, {
        method: "POST",
        body,
      });
      logger.info("Seed", `✓ Created form #${r.doc.id}`);
    }
  } catch (err) {
    const reason = err instanceof PayloadError ? err.message : String(err);
    logger.error("Seed", `Failed: ${reason}`);
    process.exit(1);
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
