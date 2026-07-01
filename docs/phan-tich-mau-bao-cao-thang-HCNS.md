# Phân tích Mẫu báo cáo HCNS tháng + plan triển khai

> File gốc: [BÁO CÁO CÔNG VIỆC PHÒNG HÀNH CHÍNH THÁNG 5.2026.docx](./BÁO CÁO CÔNG VIỆC PHÒNG HÀNH CHÍNH THÁNG 5.2026.docx)
>
> Ngày: 2026-06-26

---

## 1. Cấu trúc báo cáo

Báo cáo HCNS chia thành **11 mục**, có thể group thành 3 loại:

### 🔢 Loại A — Số liệu định lượng (auto query được)

| # | Mục | Granularity | Phân tách |
|---|---|---|---|
| 1 | Số LĐ xuất cảnh **YTD** (T1 → T5) | Cộng dồn | Hàn / Qatar / Nhật (chia chi nhánh) |
| 2 | Số LĐ thanh lý HĐ **YTD** | Cộng dồn | Hàn / Qatar / Nhật / Đài |
| 3 | Số LĐ trốn **YTD** | Cộng dồn | Hàn (chia nghiệp đoàn) |
| 4 | Số LĐ xuất cảnh **tháng** | Trong tháng | Hàn / Qatar / Nhật (chia chi nhánh) |
| 5 | Số LĐ thanh lý HĐ **tháng** | Trong tháng | Hàn / Qatar / Nhật / Đài |
| 6 | Số LĐ trốn **tháng** | Trong tháng | Hàn / Qatar / Nhật / Đài |
| 7 | Số LĐ về nước **tháng** | Trong tháng | Theo thị trường |
| 8 | HĐLĐ Nhật đã nhận đủ năm 2026 | Theo tháng | T1/T2/T3/.. + count + trạng thái |

### 📝 Loại B — Tiến độ thanh lý HĐ cũ (text + count)

- Thanh lý LĐ Đài Loan: từng năm xuất cảnh (2017-2024), từng entity (TL Corp / TL Group), số LĐ, trạng thái "đã xong / đang dở / mất hồ sơ".
- Cần text mô tả + đính kèm số → bán-auto (data từ DB, format theo template).

### 📰 Loại C — Hoạt động phòng (text tự do)

- Web: đăng N bài tin tức tháng này.
- Số hóa hồ sơ.
- Sắp xếp hồ sơ Đài Loan.

Loại này không có data, HCNS gõ tay → bot chỉ làm phần khung + để chỗ trống cho HCNS điền.

---

## 2. Các "chiều" cần hỗ trợ

### 2.1 Thị trường (đã có — field `market` của Worker)

| Code | Tên | Có trong báo cáo? |
|---|---|---|
| `jp` | Nhật Bản | ✅ Mặc định |
| `kr` | Hàn Quốc | ✅ |
| `tw` | Đài Loan | ✅ |
| `qa` | Qatar | ⚠ chưa có code này (em thêm) |

### 2.2 Chi nhánh / Công ty / Nghiệp đoàn (CHƯA CÓ — cần thêm)

Báo cáo cần phân tách số LĐ theo:

**Nhật Bản:**
- Thịnh Long (TL) — gốc
- Tokai (đối tác chia sẻ)
- TTĐT số 2
- VP Long An

**Đài Loan:**
- Thịnh Long Corp (entity 1)
- Thịnh Long Group (entity 2)

**Hàn Quốc** (nghiệp đoàn):
- Dongoh
- Gury

→ **Đây có thể map vào collection `Offices` em vừa làm** (chi nhánh TLG) hoặc cần thêm field mới?

Em đề xuất 2 phương án:

**A. Dùng Offices (đã có)** — tạo thêm các record:
- HN, ND, ... (vp TLG)
- VP_LONG_AN, TTDT_02 (vp chi nhánh)
- THINH_LONG_CORP, THINH_LONG_GROUP (entity)

Worker.office → chọn 1.

**B. Tách "Office" và "Partner" rõ:**
- Office = chi nhánh TLG nội bộ (Hà Nội, Nam Định, Long An, TTĐT 2...)
- Partner = đối tác / nghiệp đoàn nước ngoài (Tokai, Dongoh, Gury, TL Corp ĐL, TL Group ĐL...)
- Báo cáo group theo CẢ 2 field.

Em đề xuất **B** vì sạch hơn về mặt nghiệp vụ.

### 2.3 Trạng thái LĐ (PHẦN LỚN ĐÃ CÓ — thiếu 2 cái)

| Loại trong báo cáo | Worker.status hiện tại | Cần thêm? |
|---|---|---|
| Xuất cảnh | `deployed` | ✅ |
| Thanh lý HĐ | ❌ chưa có | **Cần thêm `liquidated`** |
| Trốn | ❌ chưa có (chỉ có `blacklisted`) | **Cần thêm `escaped`** |
| Về nước | `returned` | ✅ |
| Hết hạn HĐ | ❌ chưa có status riêng | Có thể dùng `returned` |

### 2.4 Tracking HĐLĐ đã nhận từ phòng nghiệp vụ

- Báo cáo phần "HCNS đã nhận đủ HĐLĐ NB 2026" → trạng thái bàn giao hồ sơ.
- Hiện hệ thống có `Contracts.contractFile` (file scan) — nếu có file = đã bàn giao? Hay cần field riêng `handoverToHCNSAt`?

Em đề xuất thêm **field `handoverToHCNSAt: date`** trên Contracts → query nhanh.

---

## 3. Mapping query cụ thể

### 3.1 Số LĐ xuất cảnh trong tháng (vd T5/2026)

```javascript
// Contracts với deploymentDate trong khoảng T5/2026
listDocs('contracts', {
  where: {
    deploymentDate: {
      greater_than_equal: '2026-05-01',
      less_than_equal: '2026-05-31',
    }
  },
  limit: 1000, depth: 1, // depth 1 để có worker.market + partner
});
// Group theo worker.market → count
// Trong nhật, sub-group theo partner.name (Tokai / TTĐT2 / ...)
```

### 3.2 Số LĐ thanh lý trong tháng

Cần `Contract.liquidationDate` (field mới) hoặc Worker.status = liquidated.

### 3.3 Số LĐ trốn

Cần `Worker.status = escaped` (mới). Hoặc thêm field `escapedAt: date` để query theo tháng.

### 3.4 Số LĐ về nước

`Worker.status = returned` + field `returnedAt: date`.

---

## 4. Phần tử hệ thống còn thiếu

Em tổng hợp để 1 lần migration là xong:

### 4.1 Workers status enum thêm 2 giá trị
```
"escaped"     — LĐ bỏ trốn (không liên lạc được)
"liquidated"  — đã hoàn tất thanh lý hợp đồng
```

### 4.2 Workers fields mới
```
escapedAt:        date  — ngày bắt đầu mất liên lạc
returnedAt:       date  — ngày về VN
```

### 4.3 Contracts fields mới
```
liquidationDate:  date    — ngày thanh lý xong
liquidationType:  select  — đơn phương / song phương / hết hạn / phạt
handoverToHCNSAt: date    — ngày nghiệp vụ bàn giao file scan cho HC
```

### 4.4 Markets thêm Qatar
```
"qa" — 🇶🇦 Qatar
```

### 4.5 Tách "Office" + "Partner" rõ ràng

- Offices đã có (em vừa làm) → dùng cho chi nhánh TLG nội bộ.
- Partners đã có → dùng cho đối tác nước ngoài + entity cùng tập đoàn (TL Corp, TL Group, Tokai, Dongoh, Gury...).
- Worker đã có `office`, đã có `recruitedBy.market`. Cần thêm `Worker.partner` (→ partners) để biết LĐ này đi qua nghiệp đoàn nào.

→ Hiện đang link partner qua `Order.partner` (qua orderworkers). Có thể query qua chain Worker → orderWorkers → order → partner. Nhưng performance nặng. Đề xuất thêm shortcut field `Worker.primaryPartner` (denormalized).

---

## 5. Plan triển khai báo cáo

### Bước 1 — Schema migration (1 ngày)
- Add 2 statuses (`escaped`, `liquidated`) + 2 dates trên Workers
- Add 3 fields trên Contracts (`liquidationDate/Type`, `handoverToHCNSAt`)
- Add Qatar vào markets enum
- Add `Worker.primaryPartner` (relationship → partners)

### Bước 2 — Seed Partners + Offices cần thiết (~2 giờ)
- Tokai, TTĐT 2, VP Long An (làm phận trong cả partner và office?)
- Dongoh, Gury (Hàn nghiệp đoàn)
- TL Corp, TL Group (Đài entity)

→ Em cần anh confirm: các tên này map vào Partner hay Office?

### Bước 3 — Build template generator (1-2 ngày)
- Tool MCP `generate_hcns_monthly_report({month, year})`
- Generate Word document theo đúng format file mẫu
- Embed các số liệu thực vào đúng vị trí
- Để chỗ trống cho HCNS điền text Loại C (Web / Số hóa / Hồ sơ Đài)
- Lưu file output vào Media → trả link cho user

### Bước 4 — Agent docs update (~30 phút)
- Agent HCNS / admin_contract_manager / dept_head: thêm quy trình "khi user hỏi xuất báo cáo tháng → gọi tool này".

---

## 6. Câu hỏi cần anh chốt trước khi code

1. **Tên `Tokai / TTĐT2 / VP Long An`** map vào đâu? Partner (đối tác/nghiệp đoàn) hay Office (chi nhánh TLG)?
2. **TL Corp + TL Group** ở thị trường Đài Loan — em hiểu là 2 entity pháp lý của tập đoàn? Hay là 2 chi nhánh?
3. **Status `liquidated`** anh đồng ý thêm không? Hay HCNS sẽ dùng cách khác (vd flag boolean)?
4. **Loại bỏ trốn (`escaped`)** anh đồng ý thêm không?
5. **Tự sinh báo cáo Word** giữ nguyên format file mẫu, hay chuyển sang **Excel/PDF**?
6. **Loại C (text tự do)** — em chỉ generate KHUNG đầu mục + để chỗ trống, hay AI tự "soạn" theo lịch sử reminders/calendars?

---

## 7. Còn 2 file mẫu chưa nhận

- ✉️ **Mẫu sổ văn bản đi/đến** (item #9)
- ✉️ **1-2 file công văn xuất cảnh** (item #6)

Khi nhận em sẽ phân tích tương tự + thêm task migration vào kế hoạch chung.
