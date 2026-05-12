# xHR — Danh sách tính năng

Sau điều chỉnh từ buổi họp với nhân viên TLG, hệ thống chia làm **2 phần**:

- **WebApp** — nhân viên dùng hàng ngày để nhập liệu, theo dõi, sửa đổi
- **AI Agent** — hỗ trợ phân tích, tổng hợp báo cáo, nhắc nhở qua Telegram (sau này Zalo/Discord)

Cả 2 chia sẻ **chung 1 kho dữ liệu trung tâm** — thay đổi ở chỗ nào cũng thấy được ngay ở chỗ kia.

---

# PHẦN A. WEBAPP — cho nhân viên dùng hàng ngày

## A.1. Trang chủ (Dashboard)

Sau khi đăng nhập, mỗi vai trò nhìn thấy:
- Tổng quan số đơn theo trạng thái (đang tuyển / đang đào tạo / chờ visa...)
- Đơn ì quá hạn (cần xử lý ngay)
- Người lao động sắp đến mốc (khám SK, hết hạn hộ chiếu...)
- Báo cáo nhanh tuần này

## A.2. Quản lý đơn tuyển

### Tạo / sửa đơn
- **Mã đơn tự sinh** (XHR-NNNN)
- **Đối tác**: tên, quốc gia, người liên hệ, email, SĐT
- **Nghiệp đoàn / broker** trung gian
- **Số HĐCU + ngày ký**
- **Vị trí + số lượng cần + thời hạn HĐ**
- **Yêu cầu ứng viên**: giới tính, độ tuổi, kỹ năng, ngôn ngữ
- **Lương từ — đến + tiền tệ**
- **Phí dịch vụ + cọc**
- **Deadline + dự kiến xuất cảnh**
- **Thuộc tính bổ sung** (linh hoạt): phụ cấp ăn, loại visa, bảo hiểm, nhà ở...

### Theo dõi tiến độ W1 → W8
8 bước rõ ràng:
```
W1 Tuyển dụng → W2 Khám SK → W3 Đào tạo → W4 Phỏng vấn đối tác
→ W5 Ký HĐ → W6 Xin visa → W7 Xuất cảnh → W8 Sau xuất cảnh
```

Mỗi bước hệ thống lưu:
- Ngày vào bước, ngày dự kiến rời bước
- Người phụ trách (recruiter / trainer / visa / ...)

### Tìm kiếm + lọc
Filter list theo: mã đơn, đối tác, vị trí, thị trường (JP/KR/TW/...), trạng thái.

## A.3. Quản lý người lao động

### Hồ sơ
- **Mã LĐ tự sinh** (LD-NNNNN)
- Họ tên, ngày sinh, quê quán, SĐT
- Trình độ NN (N3/N4/N5/TOPIK 4...)
- Kinh nghiệm, kỹ năng đặc biệt
- Trạng thái vòng đời: mới → sàng lọc → đào tạo → sẵn sàng → đã ký HĐ → đã xuất cảnh → đã về nước

### File đính kèm
Mỗi LĐ có folder lưu: hộ chiếu, CCCD, giấy khám SK, CV, ảnh chân dung, hợp đồng.

### Liên kết với đơn
1 LĐ ứng tuyển nhiều đơn → theo dõi từng lần (khám SK, phỏng vấn, kết quả).

## A.4. Quản lý hợp đồng

- Liên kết worker × đơn
- Số HĐ, ngày ký, nơi ký
- Lương cơ bản + tăng ca
- Thời hạn (tháng), gia hạn
- Visa loại gì, ngày cấp / hết hạn
- Ngày xuất cảnh
- Trạng thái: nháp → đã ký → đang hiệu lực → hết hạn → chấm dứt

## A.5. Kho tệp tin

- **Folder lồng nhau** (parent / children) để tổ chức
- **Xem trước ảnh** trong danh sách
- **Xem trước PDF** trong trang chi tiết (cuộn / zoom)
- **Phân loại tự động**: ID doc / health cert / contract / visa / CV / portrait / invoice / form / partner doc
- **Tìm kiếm**: theo tên file + mô tả + nội dung text

## A.6. Form template động

Manager tạo form mới bằng **kéo thả** trong admin:
- Form đăng ký LĐ
- Phiếu phỏng vấn
- Đánh giá đào tạo
- Khảo sát sau XK

Form gắn vào quy trình — bot có thể dùng để dẫn user qua câu hỏi.

## A.7. Quản lý người dùng + phân quyền

7 vai trò, mỗi vai trò có quyền khác nhau:

| Vai trò | Quyền |
|---|---|
| 👑 Admin / Giám đốc | Toàn quyền |
| 📋 Quản lý điều hành | CRUD hầu hết |
| 🧑‍💼 Tuyển dụng | CRUD workers + đăng ký đơn |
| 🎓 Đào tạo | Cập nhật trạng thái đào tạo LĐ |
| 🛂 Visa | Cập nhật visa + hợp đồng |
| 💰 Kế toán | Đọc đơn + hợp đồng (phần phí) |
| 🏥 Y tế | Cập nhật kết quả khám SK |

## A.8. Cấu hình hệ thống

- Cấu hình workflow stage (deadline, người phụ trách, mẫu nhắc nhở)
- Quản lý đối tác (sẽ thành 1 collection riêng nếu cần)
- Audit log (xem ai sửa gì khi nào)

---

# PHẦN B. AI AGENT — phân tích, báo cáo, nhắc nhở

> ⚠️ Agent **không thay thế** việc CRUD trên WebApp. Agent chỉ hỗ trợ 3 việc dưới đây.

## B.1. Phân tích tài liệu

### Đọc file gửi vào chat
- **Word / Excel / PowerPoint** (có chữ)
- **PDF** (cả có chữ lẫn dạng scan)
- **Ảnh** JPG/PNG/WebP (kể cả giấy tờ chữ tay rõ)

### Tự nhận diện loại tài liệu
Khi nhận file, agent đoán xem là:
- YCTD đối tác (yêu cầu tuyển dụng)
- TPC (tiến cử ứng viên)
- CV worker
- Hộ chiếu / CCCD
- Giấy khám sức khoẻ
- Hợp đồng
- Hoá đơn / phiếu thu
- Ảnh chân dung
- ...

### Trích xuất chi tiết
Tuỳ loại tài liệu, agent **trích các trường quan trọng**:
- YCTD: tên xí nghiệp, vị trí, số lượng, lương, deadline, yêu cầu kỹ năng...
- CV: họ tên, năm sinh, quê, trình độ NN, kinh nghiệm...
- Hợp đồng: bên A/B, mức lương, thời hạn, ngày ký...

### Đưa nhận xét + đề xuất
Sau khi trích, agent đưa nhận xét ngắn (rủi ro, điểm cần lưu ý) + đề xuất 2-3 bước tiếp theo (ví dụ: "Tôi có thể tạo đơn XHR-XX từ YCTD này, anh duyệt không?").

**Hành động cụ thể (tạo đơn, cập nhật...) — nhân viên làm trên WebApp.**

### Đa ngôn ngữ
Tài liệu đối tác tiếng **Nhật / Hàn / Trung** — agent vẫn đọc + hiểu, **tóm tắt 100% bằng tiếng Việt**.

## B.2. Tổng hợp & Báo cáo

### Hỏi đáp tự nhiên
Cán bộ hỏi qua chat:
- "Hồ sơ LD-00012 sao rồi?"
- "Đơn XHR-12 còn mấy slot?"
- "Tìm LĐ tiếng Nhật N3 nam 25-35"
- "Liệt kê đơn Nhật đang tuyển"
- "Có hợp đồng nào với Toyota tháng 3 không?"

→ Agent search trong kho → trả lời ngắn gọn / kèm bảng / kèm file.

### Xuất báo cáo
4 định dạng:

| Định dạng | Khi nào dùng |
|---|---|
| **Excel (.xlsx)** | Báo cáo chính thức. Header bold, freeze row, auto-filter — nhìn như tự làm tay |
| **CSV** | Đơn giản, Excel/Google Sheets mở được |
| **Markdown** | Báo cáo có format đẹp khi xem trên Notion/GitHub |
| **JSON** | Import vào hệ thống khác |

Bot tự gửi file vào chat — click tải về máy. File cũng lưu trong kho để tìm lại sau.

### Báo cáo tự động hàng tuần
Mỗi **thứ Sáu 17h**, bot tự DM giám đốc:
- Tóm tắt số đơn theo trạng thái
- Số worker đang ở từng giai đoạn
- Đơn quá hạn cần xử lý
- Đơn mới trong tuần

### Báo cáo ad-hoc
- "Tổng kết doanh thu Q2"
- "Bao nhiêu LĐ training tháng này"
- "Top 5 đối tác có nhiều đơn nhất"

## B.3. Nhắc nhở

### Tự động theo workflow
Mỗi bước W1-W8 có thể cấu hình nhắc:
> "Nếu đơn ở W3 (Đào tạo) quá 7 ngày → nhắc trainer phụ trách"

Bot quét **mỗi giờ**, gửi DM Telegram cho người liên quan.

### Tự do — do cán bộ đặt
Cán bộ nói với bot bất cứ lúc nào:
- "9h sáng mai nhắc tôi gọi đối tác Toyota"
- "Thứ 6 14h nhắc cả nhóm họp"
- "Nhắc anh @ha_ntv 10h kiểm tra hồ sơ"
- "30/5 nhắc team kế toán chốt phí"

### Bắn vào đâu?
- **Chat hiện tại** (default): trong group nào → reminder bắn lại group đó
- **Group khác**: "Nhắc bên Phòng Hàn 9h họp" → bot bắn vào group Phòng Hàn
- **DM riêng** 1 người
- **Cả phòng ban**: broadcast cho mọi người cùng role

### Tag người
Khi reminder bắn vào group, bot **@mention đúng người** → họ nhận push notification.

### Quản lý reminder
- "Xem lịch nhắc của tôi tuần này"
- "Hoãn cuộc họp đến 14h"
- "Huỷ lịch nhắc gọi Toyota"

---

# PHẦN C. KÊNH TRUY CẬP

| Kênh | Trạng thái | Dùng làm gì |
|---|---|---|
| **WebApp** (browser) | ✅ Đang có | Vận hành chính — CRUD, dashboard, báo cáo, cấu hình |
| **Telegram** | ✅ Đang có | Hỏi đáp với agent, gửi file, đặt reminder, nhận thông báo |
| **Zalo** | ⏳ Lộ trình PoC v3 | Tương tự Telegram, dành cho người không quen Telegram |
| **Discord** | ⏳ Lộ trình PoC v3 | Tương tự, cho team trẻ |
| **Email** | ⏳ Chưa wire | Nhận báo cáo tuần qua email (nếu cần) |

Tất cả kênh **chia sẻ chung 1 kho dữ liệu** — nói trên Telegram, xem trên Web, gửi Zalo đều thấy nhất quán.

---

# PHẦN D. BẢO MẬT

- Mỗi nhân viên **tài khoản + mật khẩu riêng** vào WebApp
- **Phân quyền theo vai trò** — kế toán không xem hồ sơ tuyển, recruiter không sửa hợp đồng đã ký
- File quan trọng lưu trên **kho cloud công ty**, không nằm máy cá nhân
- Bot **luôn hỏi xác nhận** trước khi xoá dữ liệu
- Bot **không tự duyệt** phí dịch vụ trên 50 triệu VND — luôn cần lãnh đạo OK
- **Lịch sử mọi thao tác** lưu trong DB (audit)

---

# PHẦN E. GIỚI HẠN HIỆN TẠI

| Giới hạn | Workaround |
|---|---|
| Bot xử lý 1 yêu cầu mất 17 giây — vài phút (file dày) | Bot show heartbeat "đang đọc..." để biết đang chạy |
| File text export ≤ 1 MB | Lọc bớt hoặc chia nhỏ |
| Excel export ≤ 50,000 dòng | Phân kỳ |
| Chưa có Zalo / Discord | Lộ trình v3 |
| Backup tự động chưa cấu hình cron | Làm tay theo lịch |

---

## Đọc thêm

- [du-an.md](du-an.md) — Bối cảnh + mục tiêu PoC + lộ trình
- [huong-dan-su-dung.md](huong-dan-su-dung.md) — Hướng dẫn dùng bot Telegram cho nhân viên
