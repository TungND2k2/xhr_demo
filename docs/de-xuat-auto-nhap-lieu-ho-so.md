# Đề xuất: Tự động nhập liệu hồ sơ lao động

> Tài liệu phân tích cho anh Long quyết định có triển khai auto nhập liệu hồ sơ hay không (item #7 trong [backlog 18/06/2026](backlog-yeu-cau-sau-hop-doi-tac-18062026.md)).
>
> **Ngày:** 18/06/2026

---

## 1. Bối cảnh

Hiện trạng nhập liệu hồ sơ LĐ tại TLG:

- **Cách 1 (hiện có):** Form online tự điền — nhân viên gửi link, LĐ tự gõ thông tin vào form trên web (Sơ yếu lý lịch thực tập sinh). Đã chạy ổn.
- **Cách 2 (hiện có):** Nhân viên admin gõ tay vào CMS hoặc Telegram bot (`@bot tạo LĐ Nguyễn Văn A 0327851263`).

Hồ sơ đầy đủ 1 LĐ gồm 5-7 loại giấy tờ:
- CCCD (2 mặt)
- Hộ chiếu (trang chính)
- Sổ hộ khẩu / giấy xác nhận thông tin cư trú
- Bằng cấp cao nhất + học bạ
- Giấy khám sức khoẻ
- Sơ yếu lý lịch có xác nhận xã
- Ảnh chân dung 4×6

Hiện tại tất cả gõ tay → mất ~15-20 phút/LĐ × 50-100 LĐ/tháng = **~25 giờ nhập liệu thuần/tháng** cho phòng tuyển dụng.

---

## 2. Mục tiêu

Giảm thời gian nhập liệu xuống còn ~3-5 phút/LĐ (chỉ duyệt + sửa lỗi AI) → tiết kiệm **80% thời gian**.

---

## 3. Ba phương án

### Phương án A — OCR + LLM Vision (auto đọc giấy tờ)

**Cách hoạt động:**
- LĐ / nhân viên gửi ảnh chụp CCCD / hộ chiếu / bằng cấp vào Telegram.
- Bot gửi ảnh sang Claude/GPT vision API → trả về JSON các field (họ tên, ngày sinh, CCCD số...).
- Bot tạo Worker draft với các field đã extract, đính kèm ảnh gốc vào Media.
- Nhân viên admin duyệt + sửa lỗi (nếu có) → confirm.

**Ưu:**
- Nhanh nhất: ảnh chụp → 30 giây có Worker draft.
- Không cần LĐ gõ tay (LĐ già/ít học cũng dùng được).
- Chính xác cao với giấy tờ chuẩn (CCCD, hộ chiếu): **~95-98%** chính xác trên field đơn (tên, ngày sinh, số CCCD).

**Nhược:**
- Chi phí: ~$0.01-0.03 / ảnh khi dùng Claude/GPT vision. **50 LĐ × 5 ảnh × $0.02 = ~$5/tháng** (cost rẻ).
- Độ chính xác giảm còn ~80-85% với giấy viết tay (sơ yếu xác nhận xã, học bạ cũ).
- Cần admin duyệt — không phải "fire and forget".
- Có rủi ro nhận sai số CCCD (đặc biệt với 0 / 6 / 8 ở ảnh mờ) → cần check 2 lần.

**Effort:** 🟡 ~3-4 ngày dev (tool nhận ảnh → vision API → Worker draft + UI duyệt).

**Cost vận hành:** ~$5-10/tháng API + nhân lực admin duyệt (~2-3 phút/LĐ).

---

### Phương án B — Form online tự điền (cải tiến cách hiện tại)

**Cách hoạt động:**
- Tận dụng `/forms/<token>` đã có.
- Bổ sung **upload ảnh giấy tờ** trong form — LĐ chụp CCCD/hộ chiếu/bằng cấp upload thẳng vào form.
- Backend lưu ảnh vào Media + auto link với Worker.

**Ưu:**
- Không tốn chi phí AI.
- Tận dụng infra sẵn có — chỉ thêm field upload.
- LĐ tự chịu trách nhiệm dữ liệu nhập đúng.

**Nhược:**
- Vẫn cần LĐ tự gõ — chậm hơn A.
- Một số LĐ già không quen điền form → vẫn phải nhân viên gõ tay hộ.
- Ảnh upload không tự extract field — admin vẫn phải đọc ảnh để check.

**Effort:** 🟢 ~1-2 ngày dev (thêm field upload + UI).

**Cost vận hành:** $0.

---

### Phương án C — Hybrid (đề xuất)

**Cách hoạt động (2 luồng song song):**

**Luồng 1 — LĐ trẻ, biết dùng smartphone:**
1. Nhân viên gửi link form (đã có).
2. LĐ điền form + upload ảnh giấy tờ.
3. Backend nhận form → run vision API trên ảnh CCCD/hộ chiếu để **verify** field LĐ điền (vd LĐ điền tên "Nguyễn Văn A" nhưng CCCD ảnh đọc ra "Nguyễn Văn B" → bot cảnh báo admin).
4. Admin duyệt cuối.

**Luồng 2 — LĐ già, không quen smartphone:**
1. Nhân viên TLG chụp giấy tờ LĐ vào Telegram nhóm W1.
2. Bot vision API extract → tạo Worker draft + link ảnh.
3. Nhân viên duyệt + bổ sung field còn thiếu (sở thích, lý do đi Nhật...) qua chat bot.

**Ưu:**
- Phục vụ cả 2 nhóm LĐ.
- Vision API dùng để **verify** thay vì extract chính — giảm rủi ro sai số.
- Linh hoạt — admin chọn luồng phù hợp.

**Nhược:**
- Phức tạp hơn — gấp đôi code path.
- Cần training admin biết khi nào dùng luồng nào.

**Effort:** 🟡 ~5-7 ngày dev (gộp A + B + verify logic).

**Cost vận hành:** ~$3-5/tháng API + nhân lực duyệt giảm ~70%.

---

## 4. Bảng so sánh

| Tiêu chí | A: OCR+LLM | B: Form upload | C: Hybrid |
|---|---|---|---|
| Tốc độ nhập 1 LĐ | ⭐⭐⭐⭐⭐ ~3 phút | ⭐⭐⭐ ~10 phút | ⭐⭐⭐⭐ ~5 phút |
| Chính xác | ⭐⭐⭐⭐ 90-95% | ⭐⭐⭐⭐⭐ LĐ tự ký | ⭐⭐⭐⭐⭐ Verify 2 lớp |
| Effort dev | 3-4 ngày | 1-2 ngày | 5-7 ngày |
| Cost API/tháng | $5-10 | $0 | $3-5 |
| Trải nghiệm LĐ | ⭐⭐⭐⭐⭐ Chỉ chụp ảnh | ⭐⭐⭐ Phải gõ | ⭐⭐⭐⭐ Linh hoạt |
| Phù hợp TLG | Cao | Trung | Cao nhất |

---

## 5. Đề xuất của em

Em đề xuất **Phương án C (Hybrid)** vì:

1. **Phục vụ cả 2 đối tượng LĐ** — trẻ điền form, già nhân viên chụp ảnh.
2. **Vision API dùng để verify** thay vì là nguồn dữ liệu duy nhất — giảm rủi ro sai số CCCD.
3. **Cost rất thấp** (~$3-5/tháng) — không đáng kể so với tiết kiệm 80% thời gian admin.
4. Tận dụng được toàn bộ infra hiện có (form online, Media, Telegram bot, MCP tools).

**Nếu Anh Long muốn nhanh, làm từng bước:**
- **Phase 1** (2 ngày): làm Phương án B trước — chỉ thêm upload ảnh vào form online + lưu link Media. Không AI gì cả.
- **Phase 2** (3 ngày sau): thêm Phương án A — vision API extract khi nhân viên chụp ảnh trong Telegram (cho LĐ già).
- **Phase 3** (1 tuần sau): thêm logic verify (vision check ảnh upload trong form khớp với text LĐ điền hay không).

→ Tổng ~6 ngày dev rải trong 2-3 tuần. Có thể demo từng phần cho khách.

---

## 6. Risk + Mitigation

| Rủi ro | Cách phòng ngừa |
|---|---|
| Vision API đọc sai số CCCD → tạo Worker sai → nhầm hồ sơ | LUÔN cần admin duyệt trước khi `status="agreed"`. Không tự active. |
| LĐ upload ảnh chứa thông tin nhạy cảm (vd CCCD lộ ra ngoài) | Media lưu trên S3 private + signed URL có expiry. KHÔNG public. |
| Chi phí Claude/GPT vision tăng vọt nếu spam | Set giới hạn 100 calls/ngày/IP. Log mọi extraction. |
| Phụ thuộc 1 nhà cung cấp (Anthropic / OpenAI) | Code abstract qua interface → swap được giữa Claude/GPT/Gemini. |

---

## 7. Câu hỏi cần Anh Long quyết

1. **Đồng ý Phương án C (Hybrid)** không, hay chọn A / B?
2. **Loại hồ sơ ưu tiên auto trước:** CCCD / hộ chiếu / bằng cấp / giấy khám SK / sơ yếu xác nhận xã? Em nghĩ nên ưu tiên CCCD + hộ chiếu (chuẩn format, accuracy cao nhất).
3. **Có chấp nhận luồng "admin duyệt cuối"** trước khi commit, hay muốn auto-commit nếu confidence > 95%?
4. **Budget chi phí AI/tháng** — TLG OK ~$10/tháng không?
5. **Bao giờ start?** Tuần này hay đợi sau khi xong các item #2/#3/#4?

---

*Tài liệu này dành cho Anh Long quyết định, sau khi quyết em sẽ làm spec triển khai chi tiết.*
