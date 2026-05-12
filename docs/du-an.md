# xHR — Dự án PoC cho Thịnh Long (TLG)

**Bên triển khai:** XOR Cloud
**Bên A:** Thịnh Long (TLG) — công ty xuất khẩu lao động
**Hình thức:** Proof of Concept (PoC) nền tảng xHR — Agentic AI cho XKLĐ

---

## 1. Vấn đề TLG đang gặp

Sau khảo sát hiện trạng, TLG đang gặp **3 nhóm thách thức** trong quản lý vận hành:

### ① Dữ liệu phân tán
- Thông tin người lao động ở Excel, Google Sheets, máy cá nhân
- Hồ sơ đối tác lưu rải rác email, Zalo, USB
- Hợp đồng, giấy tờ scan nằm trong từng folder máy
- **→ Khi cần tra cứu, không biết tìm ở đâu, không khai thác được giá trị tổng hợp**

### ② Tri thức chưa chuẩn hoá
- Kinh nghiệm nghiệp vụ gắn liền **cá nhân từng nhân viên**
- Người mới vào không có nguồn học chuẩn
- Mỗi phòng ban làm theo cách riêng
- **→ Thiếu nhất quán, lệ thuộc người, khó scale**

### ③ Phối hợp nội bộ chưa thông suốt
- Luồng thông tin giữa phòng ban (tuyển dụng → đào tạo → visa → kế toán) bị ngắt quãng
- Báo cáo lên sếp phải tổng hợp tay từ nhiều nguồn
- Phòng A không biết phòng B đang ở đâu trong quy trình
- **→ Gián đoạn, mất thời gian, giảm hiệu quả**

---

## 2. Giải pháp PoC — XOR Cloud đề xuất

| Hướng giải | Phương án |
|---|---|
| **Hợp nhất dữ liệu** | Thu thập + tổ chức toàn bộ dữ liệu phân tán thành **Kho tri thức tập trung**, truy vấn ngữ nghĩa bằng tiếng Việt tự nhiên |
| **Tự động hoá nghiệp vụ** | Triển khai **AI Agent** theo từng phòng ban (Tuyển dụng / Pháp lý / Báo cáo / Hỗ trợ) — phân tích, tổng hợp, đề xuất quyết định |
| **Đơn giản hoá truy cập** | Cán bộ tra cứu qua **Telegram / Zalo / Discord** hoặc **Dashboard web**, không cần phần mềm phức tạp |

---

## 3. Tính năng AI Agent — hiện tại đang có

Agent chạy qua Telegram (bot **@vale_xhr_bot**), nói chuyện tiếng Việt tự nhiên.

### ① Phân tích tài liệu
- Đọc file gửi vào chat: **Word / Excel / PowerPoint / PDF có chữ / PDF scan / Ảnh JPG/PNG**
- Tự nhận diện loại tài liệu (YCTD đối tác / CV / hộ chiếu / khám SK / hợp đồng / hoá đơn / ...)
- **Trích chi tiết** các trường quan trọng theo từng loại (tên xí nghiệp, vị trí, số lượng, lương, deadline, ...)
- **Đọc được tài liệu tiếng Nhật / Hàn / Trung** — tóm tắt 100% bằng tiếng Việt
- Tự **OCR PDF scan** (chuyển từng trang sang ảnh → AI vision đọc)
- Đưa **nhận xét + đề xuất 2-3 hành động** tiếp theo cho người duyệt

### ② Tổng hợp & Báo cáo
- Hỏi đáp tự nhiên: "Đơn XHR-12 còn mấy slot?" / "Tìm LĐ tiếng Nhật N3 nam 25-35" / "Hồ sơ LD-001 sao rồi?"
- **Xuất file** theo yêu cầu (gửi thẳng vào chat, click tải):
  - **Excel (.xlsx)** — header bold, freeze row, auto-filter; hỗ trợ nhiều sheet/file
  - **CSV / Markdown / JSON / TXT** — tuỳ nhu cầu
- **Báo cáo tự động cuối tuần** — thứ Sáu 17h, bot DM giám đốc tóm tắt số đơn theo trạng thái, số worker theo giai đoạn, đơn quá hạn

### ③ Nhắc nhở
- **Tự động theo workflow**: đơn ì ở 1 stage quá X ngày → bot DM người phụ trách
- **Tự do (do cán bộ đặt)**: "9h sáng mai nhắc tôi gọi Toyota" / "Thứ 6 14h nhắc cả nhóm họp"
- **Bắn vào đâu cũng được**:
  - Chat hiện tại (default) — group nào → reminder bắn lại group đó
  - Group khác — "nhắc bên Phòng Hàn 9h họp" → bot tìm group + bắn vào
  - DM riêng 1 người
  - Cả phòng ban — broadcast role
- **Tag người tự động** — khi reminder bắn vào group, bot @mention đúng người
- Quản lý: xem lịch nhắc, hoãn, huỷ

### ④ Kho tri thức (background)
- Mọi file upload → **tự lưu kho cloud** + **AI sinh mô tả** + **phân loại tự động**
- Tra cứu sau bằng câu tự nhiên: "có hợp đồng với Toyota tháng 3 không?" → bot tìm + trả file
- Tích luỹ theo thời gian → kiến thức tổ chức (không lệ thuộc cá nhân)

### ⑤ Nhận biết ngữ cảnh
- Tự nhớ danh sách user + group Telegram → biết "@ha_ntv là ai", "group Phòng Hàn ở đâu"
- Hiểu **thời gian**: "9h mai" / "thứ 6" / "1p nữa" → ra đúng thời điểm
- Hiểu **người tự xưng**: "nhắc tôi" → biết "tôi" là ai
- Hỗ trợ **đa group song song** — không lẫn lộn ngữ cảnh

---

## 4. Yêu cầu mới sau buổi họp với nhân viên TLG

Sau khi demo PoC v1, buổi họp với nhân viên TLG đưa ra **2 yêu cầu điều chỉnh**:

### A. Xây dựng **WebApp riêng** cho vận hành hàng ngày
- Nhân viên quen nhập liệu qua **giao diện web** hơn chat bot
- WebApp dùng cho **CRUD nghiệp vụ**: tạo / sửa / xoá đơn tuyển, hồ sơ, hợp đồng
- Phân quyền theo phòng ban (giống mong muốn ban đầu của sếp tổng)
- Thêm tính năng chat nội bộ + nhắc nhở →  thay thế Telegram
- xây dựng theo quỳ trình họ đề ra 

### B. **AI Agent thu hẹp phạm vi** xuống 3 nhóm việc
Agent **không thay người làm CRUD**, chỉ tập trung:
1. **Phân tích** — đọc tài liệu, trích entity, tóm tắt
2. **Tổng hợp & Báo cáo** — xuất Excel theo yêu cầu, báo cáo tuần/tháng
3. **Nhắc nhở** — auto theo workflow + lịch tự đặt

Việc tạo đơn, sửa hợp đồng... **chuyển hết về WebApp**.
