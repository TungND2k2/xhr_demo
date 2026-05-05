# Hướng dẫn sử dụng xHR-bot

Trợ lý AI quản lý xuất khẩu lao động qua Telegram — chat tiếng Việt tự nhiên, không cần học cú pháp.

## 1. Bắt đầu

Tìm bot trên Telegram: **@vale_xhr_bot**

| Bạn muốn | Làm thế nào |
|---|---|
| Chat riêng với bot | Bấm Start, gõ tin nhắn như chat người thường |
| Dùng trong nhóm | Add `@vale_xhr_bot` vào group → **tag tên** hoặc **reply** vào tin của bot mới được phản hồi |

> 💡 Trong group, bot **chỉ trả lời khi được gọi** (mention/reply/lệnh) — đỡ ồn cho cuộc trò chuyện.

## 2. Cách "gọi" bot trong group

Có 3 cách:

```
@vale_xhr_bot tóm tắt đơn tuyển tuần này
```
```
/start@vale_xhr_bot
```
```
[Reply vào tin của bot] cho em xem chi tiết
```

⚠️ Khi gõ `@`, đợi Telegram gợi ý → **chọn từ list** (không gõ tay) thì mới được tính là mention thật.

## 3. Hỏi gì cũng được

Một số ví dụ thường dùng:

| Bạn nói | Bot làm |
|---|---|
| "Hồ sơ LD-00012 sao rồi?" | Tóm tắt trạng thái ứng viên |
| "Đơn XHR-12 còn mấy slot?" | Đếm slot trống + danh sách đăng ký |
| "Liệt kê đơn Nhật đang tuyển" | Lọc đơn theo thị trường + trạng thái |
| "Tìm LĐ nói được tiếng Nhật N3 nam 25-35" | Search workers theo điều kiện |
| "Đăng ký Nguyễn Văn A vào đơn XHR-12" | Tạo bản ghi sau khi xác nhận |
| "Chuyển đơn XHR-12 sang W3" | Đẩy workflow sang bước đào tạo |

Trả lời sai? Nói lại bằng từ khác — bot không nhớ lệnh cứng.

## 4. Gửi file — bot tự đọc & phân tích

Drag/paste vào Telegram là xong. Bot xử lý 3 loại:

| Loại file | Bot làm gì |
|---|---|
| 📄 **Word, Excel, PDF có text** | Đọc nội dung → phân tích chi tiết → đề xuất action |
| 🖼 **Ảnh (JPG, PNG)** | Nhìn ảnh → mô tả + trích thông tin |
| 📑 **PDF scan** (giấy tờ chụp/scan thành PDF) | Tự OCR từng trang qua AI vision → trích nội dung |

Bot **tự động phân tích** — không cần bạn hỏi "đây là gì". Nó sẽ:
1. Nhận diện loại tài liệu (YCTD / CV / hộ chiếu / khám SK / HĐ...)
2. Trích các trường quan trọng (số lượng, lương, ngày, contact...)
3. Đưa nhận xét + 2-3 đề xuất bước tiếp theo

### 💬 Caption — gõ kèm file để AI làm đúng việc bạn cần

Bạn có thể **không gõ gì** (bot tự phân tích + đề xuất), hoặc gõ kèm 1 câu để bot biết hành động cụ thể:

| Loại file đính kèm | Câu gõ kèm gợi ý |
|---|---|
| 📋 **YCTD đối tác** (yêu cầu tuyển dụng) | "Cập nhật đối tác và tạo đơn tuyển từ file này" |
| | "Tạo order mới + so với đơn cùng ngành đang chạy" |
| 👤 **TPC tiến cử ứng viên** | "Tiến cử ứng viên này vào đơn XHR-12" |
| | "Đánh giá xem có phù hợp với đơn Toyota không" |
| 📝 **CV worker** | "Tạo hồ sơ LĐ mới từ CV này" |
| | "Match ứng viên này với đơn nào phù hợp" |
| 🆔 **Hộ chiếu / CCCD** | "Đính kèm vào hồ sơ LD-00123" |
| | "Cập nhật ngày hết hạn hộ chiếu cho LD-005" |
| 🏥 **Giấy khám SK** | "Cập nhật kết quả khám SK cho LD-001 đơn XHR-12" |
| | "Lưu kết quả khám rồi đẩy sang bước đào tạo" |
| 📜 **Hợp đồng** | "Lưu HĐ này + chuyển LD-001 sang W6 visa" |
| | "Tạo contract giữa LD-001 và đơn XHR-12 lương 200000 JPY" |
| 🖼 **Ảnh chân dung** | "Gắn ảnh chân dung vào LD-00123" |
| 💰 **Hoá đơn / Phiếu thu** | "Lưu phiếu thu cho HĐ #003" |
| | "Đối chiếu phí với hợp đồng dịch vụ" |
| 📂 **Gửi nhiều file 1 lúc** | "Đây là YCTD + 5 CV ứng viên, tiến cử giúp em" |

Sau khi bot phân tích, bạn chỉ cần reply ngắn để xác nhận:
- ✅ **"ok làm đi"** / **"tạo order luôn"** — bot thực thi action đã đề xuất
- 🔄 **"không, đổi market sang Hàn"** — chỉnh tham số rồi tạo
- ❌ **"thôi để xem lại"** — bot dừng, không tạo bản ghi

### 📦 Gửi file vào group nhóm

Trong group, **caption phải có @mention bot** thì bot mới đọc:

```
📎 [Đính kèm: YCTD-Nanyo-Hifuku.pdf]
@vale_xhr_bot tạo đơn tuyển từ file này
```

> 💾 Mọi file đều **tự lưu vào kho media S3** — sau này tìm bằng câu hỏi tự nhiên (vd: "có HĐ với Toyota tháng 3 không?", "tìm hộ chiếu LD-001", "YCTD ngành cơ khí gần nhất").

## 5. Lệnh nhanh

| Lệnh | Tác dụng |
|---|---|
| `/reset` | Xoá lịch sử trò chuyện trong chat hiện tại, bắt đầu lại |
| `/clear` | Tương tự `/reset` |

## 6. Một vài lưu ý

- Bot **không tự duyệt phí dịch vụ > 50 triệu VND** — luôn hỏi quản lý.
- Bot **không tự pass/fail khám SK hoặc đào tạo** — chỉ ghi kết quả bạn cung cấp.
- Bot **không tự ký visa** — chỉ cập nhật trạng thái khi bạn xác nhận có giấy tờ.
- Bot **luôn xác nhận trước khi xoá data**.
- Bot **trả lời 100% tiếng Việt**, kể cả khi file/ảnh bằng tiếng Anh/Nhật/Hàn.

## 7. Khi gặp vấn đề

| Tình huống | Cách xử lý |
|---|---|
| Bot không trả lời trong group | Kick bot ra rồi add lại (Telegram cache setting) |
| Bot báo "Hệ thống đang bận" | Đợi 10s rồi gửi lại |
| Bot trả sai/lệch context | Gõ `/reset` để xoá history rồi hỏi lại |
| File PDF không đọc được | Gửi lại dạng ảnh từng trang (JPG/PNG) |

Cần hỗ trợ thêm: liên hệ quản trị hệ thống.
