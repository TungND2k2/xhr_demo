# Quy trình người dùng — Phòng Nhật Bản

> Tài liệu hướng dẫn vận hành cho **nhân viên TLG** (không phải tài liệu kỹ thuật).
> Mỗi nhân viên đọc phần "Vai trò của tôi" tương ứng với phòng/topic mình quản.
>
> Cập nhật: 2026-06-04

---

## Tổng quan

Toàn bộ quy trình XKLĐ Nhật chia thành **8 bước W1 → W8** + **3 bộ phận phụ trợ** (HĐ Cung ứng, Cục QLLĐNN, Quản đơn). Mỗi bước có 1 topic Telegram + 1 agent AI:

```
Đối tác Nhật ký HĐ → Anh Long đăng ký Cục → Cục chấp thuận
                                                ↓
                                       Order (đơn YCTD) ACTIVE
                                                ↓
W1 Tuyển dụng → W2 Khám SK → W3 Đào tạo + Cọc → W4 PV đối tác
                                                                ↓
W8 Tại Nhật ← W7 Xuất cảnh ← W6 Visa + COE ← W5 Ký HĐ ←──────┘
```

Mọi nhân viên đều thao tác qua **2 nơi**:

1. **Telegram** (nhanh nhất): nhắn `@thinhlong_xhr_bot` trong topic của mình. Bot AI trả lời + làm task.
2. **Admin web**: https://xhr.cms-admin.x-or.cloud/admin — xem chi tiết / sửa hàng loạt.

Khi LĐ chuyển bước, **hệ thống tự động bắn thông báo "Việc cần làm" vào topic của phòng kế tiếp** — không phải gọi điện báo nhau, không cần check thủ công.

---

## Tổng đài 10 topic Phòng Nhật

| # | Topic Telegram | Vai trò |
|---|---|---|
| W1 | 🧑‍💼 Tuyển dụng | Tiếp nhận CV, sàng lọc, tạo hồ sơ LĐ |
| W2 | 🏥 Khám sức khoẻ | Đặt lịch BV, lưu kết quả |
| W3 | 📚 Đào tạo + Cọc | Thu cọc, xếp lớp, điểm danh, thi nội bộ |
| W4 | 🤝 Phỏng vấn đối tác | Lịch PV với employer Nhật |
| W5 | 📜 Ký hợp đồng | Tạo Order, ký HĐLĐ |
| W6 | 🛂 Visa + COE | Theo dõi COE, nộp ĐSQ, lấy visa |
| W7 | ✈️ Xuất cảnh | Đặt vé, lịch trình, bàn giao đoàn |
| W8 | 🇯🇵 Hậu xuất cảnh | Check-in LĐ tại Nhật, hết HĐ |
| — | 📦 Quản đơn / Đối tác | Tra cứu đơn, làm việc đối tác |
| — | 🧑‍💻 Trưởng phòng | Tổng hợp, báo cáo |

---

## Hướng dẫn theo vai trò

### 🏢 Phòng Hành chính (HC) — admin_contract_manager

**Khi đối tác Nhật ký HĐ Cung ứng mới (HĐCU):**

1. Nhận file scan HĐCU qua chat → nhắn `@bot extract HĐ này`.
2. Bot tự đọc PDF, tạo SupplyContract + Partner record.
3. Bot tự gán `responsibleEmployee = Anh Long` + tạo reminder 3 ngày cho Anh Long đăng ký Cục.
4. Tab **Cục QLLĐNN** mặc định `not_submitted` → chờ Long làm.

**Khi user hỏi "HĐ X đăng ký Cục chưa":**

Bot tự gọi `get_supply_contracts` → trả về:
- `cucApprovalStatus = pending/approved/rejected`
- `cucRegistrationDate`, `cucResponseDate`
- File chấp thuận

### 👨‍💼 Anh Long — Cán bộ Cục QLLĐNN

**Hàng ngày:**

1. Mở admin: https://xhr.cms-admin.x-or.cloud/admin/collections/supply-contracts
2. Lọc `cucApprovalStatus = not_submitted` hoặc `pending` → biết HĐ nào cần xử lý.

**Khi nộp hồ sơ lên Cục:**

- Vào HĐCU đó → tab "Cục QLLĐNN" → set `cucRegistrationDate = hôm nay` + `cucApprovalStatus = pending`.

**Khi Cục có phản hồi:**

- Set `cucResponseDate = ngày nhận phúc đáp` + `cucApprovalStatus = approved/rejected/needs_revision`.
- Upload scan công văn Cục vào `cucApprovalDoc`.
- Ghi rõ vào `cucNotes` nếu Cục yêu cầu bổ sung.

⚠ **Khi `approved`**: phòng Nhật **mới** được phép active Order cho HĐ này.

---

### W1 — Phòng Tuyển dụng

**Topic Telegram**: 🧑‍💼 W1 — Tuyển dụng

**Khi nhận CV mới (file/ảnh/chat):**

1. Trong topic W1, gửi CV + nhắn `@bot tạo LĐ mới từ CV này`.
2. Bot tự tạo Worker với `status = researching`.
3. Bạn xác nhận lại: họ tên, SĐT, ngày sinh, quê.

**Khi LĐ đồng ý tham gia:**

- Nhắn bot: `@bot update LĐ Nguyễn Văn A status = agreed`.
- → Hệ thống tự bắn message "Việc cần làm" sang **W2 Khám SK**.
- ⚠ Bạn nên **báo trước LĐ** về số cọc 20-30tr (sẽ thu sau khám SK).

---

### W2 — Phòng Khám sức khoẻ

**Topic Telegram**: 🏥 W2 — Khám sức khoẻ

**Khi nhận thông báo "LĐ vừa đồng ý":**

1. Gọi LĐ xác nhận thông tin liên hệ.
2. Đặt lịch khám tại BV đối tác (Hồng Ngọc / Medlatec / Hà Đông / ...).
3. Trước ngày khám 1 hôm: nhắn `@bot tạo reminder nhắc LĐ A khám SK ngày X` + xe đưa đón.

**Khi có kết quả khám:**

- Upload giấy khám SK qua chat trong topic này.
- Pass → `@bot update LĐ status = health_check` → tự bắn sang W3.
- Fail → `@bot update LĐ status = failed` + ghi lý do.

---

### W3 — Phòng Đào tạo + Cọc

**Topic Telegram**: 📚 W3 — Đào tạo + Cọc

**Khi nhận thông báo "LĐ đã pass khám SK":**

1. **PHẢI** phối hợp kế toán **thu cọc trước**.
2. Khi nhận cọc → nhắn:
   `@bot LĐ A nộp cọc 20tr ngày 04/06, set status = deposit_paid`
3. Bot lưu `depositAmount`, `depositDate`, `status = deposit_paid`.

⚠ **KHÔNG** đẩy sang `training` nếu `depositAmount` rỗng — quy tắc bắt buộc.

**Sau khi vào lớp:**

- `@bot xếp LĐ A vào lớp N4-2026-A, bắt đầu 10/06`.
- Điểm danh hàng ngày: `@bot điểm danh lớp N4-2026-A ngày 10/06: vắng A, B; có mặt còn lại`.

**Thi nội bộ:**

- `@bot LĐ A đỗ thi N4 điểm 75` → set `examResult = pass`.
- Khi muốn đẩy sang W4: `@bot update LĐ A status = passed`.

**LĐ trượt:**

- `@bot LĐ A trượt thi, status = failed`.
- Phối hợp kế toán **hoàn cọc** → set `depositRefundedAt` ngày hoàn xong.

---

### W4 — Phỏng vấn đối tác

**Topic Telegram**: 🤝 W4 — Phỏng vấn đối tác

**Khi nhận "LĐ đã pass đào tạo":**

1. Liên hệ đối tác Nhật chốt lịch PV.
2. **Gửi profile + CV cho đối tác trước PV 24h** qua email:
   `@bot gửi email đối tác Toyota: profile LĐ Nguyễn Văn A đính kèm`.
3. Đặt lịch PV (Zoom hoặc offline): `@bot tạo lịch PV LĐ A với Toyota ngày 15/06 14h`.
4. Bot tự tạo reminder nhắc cả LĐ + người phụ trách.

**Sau PV:**

- Pass: `@bot LĐ A pass PV với Toyota, status = passed` → tự bắn sang **W5 Ký HĐ**.
- Fail: ghi lý do vào Worker.notes, có thể đẩy về W1 thử đơn khác.

---

### W5 — Ký hợp đồng

**Topic Telegram**: 📜 W5 — Ký hợp đồng

**Khi nhận "LĐ đã pass PV đối tác":**

1. Tra Order tương ứng (đối tác + position) — chưa có thì tạo Order draft:
   `@bot tạo Order Toyota, đơn KNĐĐ hàn xì, 5 LĐ, deadline 30/07`.
2. ⚠ **KIỂM TRA**: HĐCU của Toyota có `cucApprovalStatus = approved` chưa?
   - Chưa → STOP, ping topic HC nhờ Anh Long làm gấp.
   - Rồi → tiếp.
3. Advance Order draft → active: `@bot Order Toyota active`.
4. Soạn HĐLĐ → mời LĐ ký → upload scan PDF qua chat.
5. Bot tự tạo Contract record + set `contractFile`.
6. `@bot update LĐ A status = contracted` → tự bắn sang **W6 Visa**.

---

### W6 — Visa + COE

**Topic Telegram**: 🛂 W6 — Visa + COE

**Khi nhận "LĐ đã ký HĐ":**

1. Tạo reminder theo dõi COE từ đối tác:
   `@bot reminder 30/60/90 ngày check COE LĐ A từ Toyota`.

**Khi nhận COE từ đối tác (ngày COE thực về tay TLG):**

⚠ **CỰC KỲ QUAN TRỌNG — set ngay trong ngày**, đừng để chậm:

1. Upload scan COE qua chat → bot lưu vào Media.
2. Mở Contract của LĐ A → set:
   - `coeFile = scan vừa upload`
   - `coeReceivedAt = hôm nay` ← **trigger hook auto**

Hệ thống sẽ tự bắn vào topic W7 Xuất cảnh:
- 1 message thông báo "COE đã về cho LĐ A"
- 3 reminder timeline:
  - T+1 ngày: Nộp visa ĐSQ Nhật
  - T+8 ngày: Check visa + đặt vé
  - T+18 ngày: Confirm vé + báo người đón Nhật

**Khi có visa:**

- Upload scan visa → bot lưu vào `visaFile`.
- Set `visaStatus = approved`, `visaApprovedAt = ngày`.
- `@bot update LĐ A status = visa_prep` → tự bắn sang W7.

---

### W7 — Xuất cảnh

**Topic Telegram**: ✈️ W7 — Xuất cảnh

Phòng W7 **ít chủ động** nhất — chủ yếu **nhận** thông báo tự động + thao tác theo lịch:

1. **Tự nhận** 3 reminder T+1/T+8/T+18 khi COE về (không cần tự tạo).
2. T+8 — đặt vé bay → `@bot đặt vé LĐ A bay VNA chuyến VN300 ngày 25/06`.
3. Bot lưu `flightNumber`, `deploymentDate` vào Contract.
4. Upload vé bay scan: `@bot save vé bay LĐ A`.
5. T+18 — confirm với đối tác Nhật về người đón sân bay.
6. Ngày bay → `@bot update LĐ A status = deployed` → tự bắn sang W8.

---

### W8 — Hậu xuất cảnh

**Topic Telegram**: 🇯🇵 W8 — Hậu xuất cảnh

**Khi nhận "LĐ đã bay sang Nhật":**

1. Bot **đã tự** tạo reminder check-in 30 ngày 1 lần (sắp tới).
2. Mỗi lần check-in: `@bot LĐ A check-in tháng 7: ổn định, lương 18man/tháng`.
3. Sự cố / kỷ luật: nhắn bot, bot ghi vào Worker.notes.
4. Mất liên lạc > 7 ngày: bot tự bắn cảnh báo khẩn.
5. Gần hết HĐ (3 tháng cuối):
   - Gia hạn → `@bot LĐ A gia hạn HĐ thêm 2 năm tới 2028`.
   - Về nước → `@bot LĐ A về nước ngày X, status = returned`.

---

### 📦 Quản đơn / Đối tác — jp_order_manager

**Topic Telegram**: 📦 Quản đơn / Đối tác

**Khi đối tác hỏi tiến độ đơn:**

- `@bot tổng hợp tiến độ đơn Toyota số 5` → bot trả về số LĐ ở từng bước.

**Khi đối tác đặt đơn mới:**

- `@bot tạo đơn mới Yamaha hàn xì 10 LĐ deadline 30/09`.
- Bot xác nhận thông tin đối tác (tạo Partner mới nếu chưa có).

**Khi cần báo cáo Excel:**

- `@bot xuất Excel danh sách đối tác Nhật + số đơn 2026`.
- Bot tạo file → gửi link.

---

### 🧑‍💻 Trưởng phòng Nhật Bản — jp_dept_head

**Topic Telegram**: 🧑‍💻 Trưởng phòng

Trưởng phòng **chỉ đọc + giao việc**, không thao tác CUD trực tiếp:

- `@bot báo cáo tuần phòng Nhật` → bot tổng hợp số LĐ ở từng W, đơn active, COE chờ.
- `@bot giao chị Hoa kiểm tra lớp N4-2026-A` → bot tạo reminder cho Hoa.
- Theo dõi LĐ chậm tiến độ: `@bot LĐ nào đang treo > 30 ngày ở 1 bước` → bot list ra.

---

## 5 quy tắc BẮT BUỘC toàn phòng

1. **KHÔNG thu cọc bằng miệng** — phải có `depositAmount` + `depositDate` trong hệ thống. Không thì sau này không biết hoàn cho ai.
2. **KHÔNG cho LĐ vào lớp đào tạo** nếu `depositAmount` rỗng.
3. **KHÔNG active Order** nếu HĐCU `cucApprovalStatus` chưa = `approved`/`not_required`.
4. **Set `coeReceivedAt` NGAY ngày COE về** — chậm 1 ngày = lệch toàn bộ lịch đặt vé.
5. **LUÔN upload scan** vào hệ thống thay vì giữ giấy ở bàn — sau này tra cứu được + AI search được.

---

## Use case mẫu: "Anh Hùng tuyển → đi Nhật"

| Ngày | Bước | Ai làm | Hệ thống |
|---|---|---|---|
| 01/06 | Hùng gửi CV qua Zalo → W1 nhận | W1 | Tạo Worker LD-00010, status=researching |
| 03/06 | Hùng đồng ý | W1 | status=agreed → **W2 nhận thông báo** |
| 05/06 | W2 đặt lịch khám 08/06 BV Hồng Ngọc | W2 | Reminder gửi Hùng + xe |
| 08/06 | Hùng khám, pass | W2 | Upload giấy khám, status=health_check → **W3 nhận thông báo** |
| 10/06 | Hùng nộp cọc 25tr | W3 | depositAmount=25tr, status=deposit_paid |
| 15/06 | Hùng vào lớp N4 | W3 | trainingStartDate=15/06 |
| 30/07 | Hùng thi pass | W3 | status=passed → **W4 nhận thông báo** |
| 05/08 | PV với Toyota, pass | W4 | status=passed → **W5 nhận thông báo** |
| 06/08 | W5 check HĐCU Toyota = approved | W5 | Order Toyota active |
| 10/08 | Hùng ký HĐLĐ | W5 | Contract created, status=contracted → **W6 nhận thông báo** |
| 25/09 | Toyota gửi COE về | W6 | **Set coeReceivedAt=25/09** → W7 nhận 1 msg + 3 reminder auto |
| 26/09 | Nộp ĐSQ (T+1) | W7 | Reminder ping |
| 03/10 | Visa có, đặt vé (T+8) | W7 | flightNumber=VN300, status=visa_prep |
| 15/10 | Hùng bay | W7 | status=deployed → **W8 nhận thông báo + 4 reminder check-in auto** |
| 15/11 | Check-in tháng đầu | W8 | "Ổn định, lương 18man" → Worker.notes |
| ... | ... | ... | ... |
| 14/10/2029 | Hết HĐ, về nước | W8 | status=returned |

---

## Khi gặp lỗi

| Triệu chứng | Cách xử |
|---|---|
| Bot không trả lời | Kiểm tra anh đã mention `@thinhlong_xhr_bot` chưa |
| Bot nhầm topic | Nhắn lại đúng topic của phòng mình |
| LĐ bị "stuck" 1 status > 1 tuần | Trưởng phòng `@bot LĐ nào treo > 7 ngày`, xử riêng |
| Nhầm dữ liệu | Vào admin web sửa tay, **không** xoá Worker — chỉ đổi status |

Hỗ trợ kỹ thuật: nhắn topic Trưởng phòng, hoặc trực tiếp dev TLG.
