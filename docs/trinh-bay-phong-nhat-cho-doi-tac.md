# Quy trình XKLĐ Phòng Nhật Bản — Thịnh Long Group

> Tài liệu trình bày cho buổi làm việc với đối tác — *18/06/2026*

---

## 1. Vấn đề Thịnh Long đang giải quyết

Một người lao động (LĐ) muốn sang Nhật làm việc phải qua **8 giai đoạn**, kéo dài 4–6 tháng, có khoảng 30–40 đầu việc nhỏ rải rác ở 8 phòng khác nhau trong công ty. Trước đây mọi thứ chạy bằng giấy tờ, Excel cá nhân, gọi điện báo nhau — dễ rớt việc, dễ chậm, khi đối tác hỏi tiến độ thì phải đi hỏi từng người.

Nền tảng **xHR** ra đời để giải quyết đúng vấn đề này: **một LĐ đi xuyên suốt 8 phòng**, dữ liệu chỉ nhập 1 lần, mỗi khi xong 1 giai đoạn thì phòng kế tiếp tự nhận việc — không ai phải gọi điện hỏi nhau, không ai phải nhớ.

---

## 2. Cách vận hành — nhìn từ nhân viên Thịnh Long

Mỗi nhân viên Thịnh Long làm việc qua **một nhóm Telegram chung của phòng mình**. Trong nhóm có một trợ lý AI luôn trực 24/7. Khi cần làm việc gì, nhân viên chỉ cần nhắn tiếng Việt bình thường vào nhóm — ví dụ "tạo hồ sơ cho anh Hùng", "anh Hùng đã nộp cọc 25 triệu", "đặt lịch khám sức khoẻ tuần sau" — trợ lý AI hiểu và tự làm.

Khi cần xem chi tiết, sửa hàng loạt, in hợp đồng hay xuất báo cáo, nhân viên vào **trang quản trị web**. Hai kênh này dùng chung dữ liệu, làm ở đâu cũng được.

---

## 3. Hành trình của một người lao động — từ lúc đăng ký đến lúc về nước

Để hiểu nhất quán, cách dễ nhất là theo chân một LĐ — tạm gọi là **anh Hùng**.

### Phòng Tuyển dụng

Anh Hùng gửi CV qua Zalo cho nhân viên tuyển dụng. Nhân viên gửi CV vào nhóm Telegram của phòng và nhắn "**tạo hồ sơ**". Trợ lý AI tạo ngay một đường link form online và đưa lại — nhân viên chỉ việc gửi link đó cho anh Hùng qua Zalo, anh Hùng tự điền họ tên, số điện thoại, CCCD, học vấn, kinh nghiệm. Khi anh Hùng bấm gửi, hệ thống tự cập nhật hồ sơ — nhân viên không phải gõ lại gì.

Khi anh Hùng đồng ý tham gia chương trình, nhân viên báo trợ lý AI. **Hệ thống tự gửi tin nhắn sang nhóm Phòng Khám sức khoẻ — "Có người mới cần đặt lịch khám"** — không cần ai gọi điện báo.

### Phòng Khám sức khoẻ

Nhân viên phòng này thấy tin nhắn, liên hệ anh Hùng, đặt lịch khám ở bệnh viện đối tác. Trước ngày khám 1 hôm, trợ lý AI tự nhắc anh Hùng và bộ phận đưa đón.

Có kết quả khám, nhân viên chụp giấy khám gửi vào nhóm. Hệ thống tự lưu giấy khám vào hồ sơ điện tử của anh Hùng. Nếu đạt, hệ thống tự **báo sang nhóm Phòng Đào tạo**. Nếu không đạt, báo về Phòng Tuyển dụng để xem lại.

> ⚠ **Quy tắc Thịnh Long**: chưa có giấy khám scan thì không được đánh dấu "đạt". Nguyên tắc này tránh việc thất lạc giấy tờ — sau này cơ quan kiểm tra hỏi đến thì lúc nào cũng có.

### Phòng Đào tạo + Đặt cọc

Đây là phòng có **một chốt quan trọng**: trước khi vào lớp đào tạo, LĐ phải đóng cọc 20–30 triệu. Cọc này Thịnh Long thu để ràng buộc LĐ đi đến cùng; nếu LĐ xuất cảnh thành công cọc được hoàn lại, nếu LĐ trượt hoặc bỏ giữa chừng cũng được hoàn (sau khi trừ chi phí phát sinh).

Khi kế toán xác nhận anh Hùng nộp 25 triệu ngày 10/06, nhân viên phòng đào tạo báo trợ lý AI. Hệ thống ghi nhận đầy đủ: số tiền, ngày nộp, ghi chú đợt thu. **Đến lúc này hệ thống mới cho phép xếp anh Hùng vào lớp.** Nếu chưa có thông tin cọc, trợ lý AI từ chối, không cho qua bước này — đây là an toàn kép tránh việc "miệng nói có thu cọc nhưng giấy tờ không khớp".

Vào lớp, học tiếng và học nghề, điểm danh hàng ngày, thi nội bộ. Pass thi thì **báo sang Phòng Phỏng vấn đối tác**. Trượt thì hoàn cọc và đóng hồ sơ.

### Phòng Phỏng vấn đối tác

Phòng này lo cầu nối giữa LĐ và phía Nhật. Khi nhận thông báo anh Hùng đã pass đào tạo, nhân viên liên hệ đối tác Nhật chốt lịch phỏng vấn (Zoom hoặc trực tiếp), đặt lịch trên hệ thống, **gửi sẵn hồ sơ + CV cho đối tác trước phỏng vấn 24h**.

Pass phỏng vấn → báo sang Phòng Ký hợp đồng. Fail → có thể quay lại tìm đơn khác hoặc đóng hồ sơ.

### Phòng Ký hợp đồng

Đây là phòng có **chốt nghiệp vụ thứ hai và quan trọng nhất** — **Cục Quản lý Lao động Ngoài nước**. Mỗi Hợp đồng cung ứng (HĐCU) mới ký với đối tác Nhật bắt buộc phải được Cục chấp thuận thì Thịnh Long mới được phép phát sinh đơn đưa LĐ đi (đây là quy định Bộ Lao động). Người phụ trách phía Thịnh Long là **anh Long**.

Khi định mở đơn cho anh Hùng đi Toyota, trợ lý AI tự kiểm tra: HĐCU với Toyota đã được Cục duyệt chưa? Nếu **chưa** — hệ thống dừng lại, không cho mở đơn, đồng thời tự ngắc anh Long làm gấp. Nếu **đã duyệt** (hoặc là HĐ cũ trước thời điểm quy định) — cho mở đơn bình thường.

Sau khi đơn đã active, soạn Hợp đồng Lao động (HĐLĐ) cho anh Hùng ký, chụp HĐLĐ đưa vào nhóm — hệ thống tự lưu vào hồ sơ. Báo sang Phòng Visa.

### Phòng Visa + COE

Sau khi ký HĐLĐ, đối tác Nhật sẽ làm Giấy chứng nhận tư cách lưu trú (**COE — Certificate of Eligibility**) và gửi về Việt Nam. Thường COE mất 30–90 ngày. Phòng này tự đặt nhắc 30/60/90 ngày để theo dõi COE.

**Khi COE về** — đây là khoảnh khắc cực kỳ quan trọng. Nhân viên chụp COE đưa vào nhóm và đánh dấu "COE về ngày X". Ngay lập tức hệ thống làm 2 việc tự động:

1. **Gửi tin nhắn sang Phòng Xuất cảnh** — "Anh Hùng đã có COE, chuẩn bị đặt vé".
2. **Tự đặt sẵn 3 lịch nhắc cho Phòng Xuất cảnh**:
   - 1 ngày sau: Nộp hồ sơ visa ở Đại sứ quán
   - 8 ngày sau: Có visa, đặt vé máy bay
   - 18 ngày sau: Xác nhận vé + báo người đón ở Nhật

> **Lợi ích cụ thể**: trước đây thường xảy ra việc COE về rồi nhưng đặt vé muộn, không còn chuyến phù hợp với deadline đối tác. Giờ COE về là 3 mốc đặt vé tự xuất hiện trên màn hình Phòng Xuất cảnh — không thể quên.

Có visa, chụp visa vào hệ thống, báo sang Phòng Xuất cảnh.

### Phòng Xuất cảnh

Phòng này nhận sẵn 3 mốc nhắc T+1, T+8, T+18 do hệ thống tự tạo (không cần nhân viên tự nhớ). Nhân viên đặt vé máy bay, chụp vé vào nhóm — hệ thống lưu số hiệu chuyến bay và ngày bay. T+18 confirm với đối tác Nhật về người đón sân bay.

Ngày bay, đánh dấu anh Hùng đã xuất cảnh. Báo sang Phòng Hậu xuất cảnh.

### Phòng Hậu xuất cảnh

Khi anh Hùng đang ở Nhật, phòng này check-in mỗi tháng 1 lần (lương ra sao, sức khoẻ thế nào, có sự cố không). Nếu anh Hùng **mất liên lạc quá 7 ngày**, hệ thống tự bắn cảnh báo khẩn.

Gần hết hợp đồng (3 tháng cuối), liên hệ đối tác xem có gia hạn không. Nếu gia hạn — cập nhật ngày mới. Nếu về nước — đánh dấu hoàn tất, hoàn cọc cho anh Hùng.

---

## 4. Tổng kết 8 giai đoạn

| Phòng | Việc chính |
|---|---|
| **1 — Tuyển dụng** | Nhận CV, tạo hồ sơ qua link form online (LĐ tự điền) |
| **2 — Khám sức khoẻ** | Đặt lịch bệnh viện đối tác, lưu giấy khám |
| **3 — Đào tạo + Cọc** | **Thu cọc trước**, xếp lớp, điểm danh, thi nội bộ |
| **4 — Phỏng vấn đối tác** | Đặt lịch PV, gửi hồ sơ cho đối tác trước 24h |
| **5 — Ký hợp đồng** | **Kiểm tra Cục QLLĐNN đã duyệt**, mở đơn, ký HĐLĐ |
| **6 — Visa + COE** | Theo dõi COE, nộp Đại sứ quán, lấy visa |
| **7 — Xuất cảnh** | Đặt vé, chốt người đón Nhật, bàn giao đoàn |
| **8 — Hậu xuất cảnh** | Check-in tháng, gia hạn, về nước, hoàn cọc |

Ngoài 8 phòng nghiệp vụ này còn 3 vai trò hỗ trợ ngang:

- **Phòng Hành chính** — lưu hợp đồng cung ứng mới, gán anh Long phụ trách Cục.
- **Quản đơn / Đối tác** — đầu mối làm việc với đối tác Nhật, báo tiến độ đơn, soạn đơn mới.
- **Trưởng phòng** — chỉ xem báo cáo + giao việc, không thao tác trực tiếp.

---

## 5. Hai chốt nghiệp vụ quan trọng nhất

Thịnh Long đặc biệt nhấn mạnh 2 chốt sau, vì đây là nơi dễ rớt việc nhất nếu làm thủ công, và là 2 chốt **hệ thống tự chặn cứng** — không vượt qua được nếu chưa đủ điều kiện.

### Chốt 1 — Cục Quản lý Lao động Ngoài nước

Mỗi hợp đồng cung ứng mới với đối tác Nhật phải được Cục chấp thuận thì mới được phát sinh đơn. Trước đây nếu nhân viên sơ ý đẩy đơn ra trước khi Cục duyệt, sẽ vi phạm. Giờ hệ thống tự đọc tình trạng Cục cho từng hợp đồng — chưa duyệt thì không cho mở đơn, đồng thời tự gắn nhắc anh Long làm gấp.

### Chốt 2 — Đặt cọc LĐ

Trước đây có trường hợp LĐ nộp cọc bằng tiền mặt, nhân viên ghi sổ tay, đến lúc LĐ trượt cần hoàn cọc thì sổ thất lạc — tranh chấp khó xử. Giờ phải có số tiền + ngày nộp trong hệ thống mới được vào lớp; cọc luôn có dấu vết, hoàn cọc cũng có dấu vết.

---

## 6. Đối tác Nhật được lợi gì?

### 6.1 Hỏi tiến độ là có ngay

Trước đây đối tác hỏi "đơn của tôi đang có bao nhiêu LĐ ở bước nào" — nhân viên TLG phải đi hỏi từng phòng. Giờ chỉ cần một câu trong nhóm Telegram, trợ lý AI trả lời ngay với số liệu chính xác đến phút.

### 6.2 COE về là tự khởi động lịch xuất cảnh

Khi đối tác gửi COE, Phòng Visa chỉ cần đánh dấu một lần — toàn bộ lịch nộp Đại sứ quán, lịch đặt vé, lịch confirm người đón đều tự hiện ra cho Phòng Xuất cảnh đúng ngày cần làm. Đối tác không còn phải lo "COE đã về 2 tuần rồi mà chưa thấy vé".

### 6.3 Hồ sơ điện tử đầy đủ — yêu cầu là có

Mọi giấy tờ — hợp đồng cung ứng, hợp đồng lao động, giấy khám sức khoẻ, COE, visa, vé bay — đều được chụp lưu vào hệ thống. Khi đối tác hoặc cơ quan kiểm tra yêu cầu xuất hồ sơ bất kỳ LĐ nào, nhân viên TLG xuất ra trong vài phút (không phải lục tủ giấy).

### 6.4 Cảnh báo sớm thay vì xử lý khủng hoảng

Hệ thống tự cảnh báo trước khi có vấn đề:

- LĐ kẹt một bước quá lâu → Trưởng phòng biết, vào hỏi ngay.
- Hợp đồng cung ứng treo Cục quá lâu → nhắc anh Long.
- COE chờ quá lâu → nhắc Phòng Visa thúc đối tác.
- Đơn sắp đến deadline → nhắc Quản đơn.
- LĐ mất liên lạc ở Nhật → cảnh báo khẩn về Phòng Hậu xuất cảnh.

### 6.5 Tuân thủ pháp lý chắc chắn

Cổng chặn Cục QLLĐNN đảm bảo TLG không bao giờ vô tình phát sinh đơn YCTD khi chưa có chấp thuận — tránh rủi ro pháp lý cho cả TLG và đối tác.

---

## 7. Khi gặp sự cố

| Tình huống | Cách xử |
|---|---|
| Trợ lý AI không trả lời trong nhóm | Nhắc tên `@thinhlong_xhr_bot` ở đầu tin |
| Nhân viên nhắn nhầm nhóm | Sang đúng nhóm phòng mình rồi nhắn lại |
| LĐ kẹt một bước quá lâu | Trưởng phòng vào hệ thống xem ai chậm, gọi xử riêng |
| Cần sửa thông tin LĐ | Vào web admin sửa tay (không xoá hồ sơ — chỉ đổi trạng thái) |
| Hệ thống có sự cố kỹ thuật | Liên hệ đội kỹ thuật XOR Cloud (dev@x-or.cloud) |

---

## 8. Liên hệ

- **Đơn vị vận hành nền tảng:** XOR Cloud — dev@x-or.cloud
- **Trang quản trị:** https://xhr.cms-admin.x-or.cloud/admin
- **Trợ lý AI Telegram:** `@thinhlong_xhr_bot`
- **Người phụ trách Cục QLLĐNN:** anh Long (Phòng Nhật Bản)

---

*Tài liệu cập nhật 18/06/2026 — Thịnh Long Group × XOR Cloud.*
