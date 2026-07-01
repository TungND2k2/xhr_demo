# Phòng Nhật — Cục QLLĐNN + Đặt cọc LĐ

**Ngày tài liệu:** 2026-06-01
**Phạm vi:** schema thay đổi cho luồng XKLĐ phòng Nhật + cập nhật agent docs để chat hiểu.

---

## 1. Bối cảnh

Phòng Nhật Bản là 1 phòng riêng (khác Phòng Hành chính). Luồng XKLĐ chuẩn TLG bắt buộc 2 chốt nghiệp vụ vốn chưa được model trong DB:

- **Chốt Cục QLLĐNN.** Mỗi Hợp đồng cung ứng (HĐCU) mới ký với đối tác Nhật phải được Cục Quản lý Lao động Ngoài nước (Bộ LĐTBXH) chấp thuận thì TLG mới được phép phát sinh đơn hàng đưa LĐ đi. HĐ cũ legacy thì không cần. Cán bộ chuyên trách phía TLG: **Anh Long** (`EMP-JP-LONG`).
- **Chốt đặt cọc.** Sau khi LĐ pass khám sức khoẻ và trước khi vào lớp đào tạo, TLG thu 20–30tr VND ràng buộc. Cọc được hoàn khi LĐ xuất cảnh thành công, hoặc khi LĐ trượt/huỷ.

Trước đây 2 chốt này đang bị xử lý ngoài hệ thống (giấy / Excel cá nhân). Sau đợt cập nhật này nó nằm trực tiếp trong Payload + agent chat biết tự hỏi/điền.

---

## 2. Thay đổi schema

### 2.1 SupplyContracts — tab mới "Cục QLLĐNN"

File: [cms/src/collections/SupplyContracts.ts](cms/src/collections/SupplyContracts.ts)

| Field | Kiểu | Mô tả |
|---|---|---|
| `responsibleEmployee` | relationship → employees | Cán bộ TLG phụ trách. HĐ mới: gán Anh Long. (đặt trong tab Thông tin chung) |
| `cucApprovalStatus` | select, required, default `not_required` | `not_required` / `not_submitted` / `pending` / `approved` / `rejected` / `needs_revision` |
| `cucRegistrationDate` | date | Ngày nộp hồ sơ lên Cục |
| `cucResponseDate` | date | Ngày Cục phản hồi (chấp thuận / từ chối / yêu cầu bổ sung) |
| `cucApprovalDoc` | relationship → media | Scan văn bản chấp thuận / phúc đáp từ Cục |
| `cucNotes` | textarea | Lịch sử trao đổi với Cục |

**Default `not_required`**: 76 HĐCU cũ extract từ scan đều rơi vào trạng thái này → không bị buộc đăng ký lại.

### 2.2 Workers — bộ field đặt cọc

File: [cms/src/collections/Workers.ts](cms/src/collections/Workers.ts) (tab "Trạng thái")

| Field | Kiểu | Mô tả |
|---|---|---|
| `depositAmount` | number (VND) | Tiền cọc TLG đã thu |
| `depositDate` | date | Ngày nộp cọc |
| `depositRefundedAt` | date | Ngày hoàn cọc (xuất cảnh thành công / trượt → hoàn) |
| `depositNote` | textarea | Lịch sử thu/hoàn (vd "đợt 1 15tr 10/05, đợt 2 15tr 25/05") |

Status `deposit_paid` đã có sẵn trong vòng đời Worker (giữa `health_check` và `training`).

### 2.3 Employee A Long

Seed record qua [apps/bot/src/scripts/seed-employee-along.ts](apps/bot/src/scripts/seed-employee-along.ts):

```
employeeCode: EMP-JP-LONG
fullName:    Anh Long
department:  phong_jp
position:    Cán bộ Cục QLLĐNN
status:      working
```

Idempotent — upsert theo `employeeCode`. Đã chạy thành công trên VM (`✓ created (#6a1d5b58205fef806ac73869)`).

---

## 3. Thay đổi agent chat

4 agent đã được cập nhật docs để hiểu quy trình mới. Re-seed bằng `node dist/scripts/seed-admin-agents.js` và `seed-jp-agents.js`.

### 3.1 `admin_contract_manager` (Phòng HC — HĐ Cung ứng)

- **Tool group mới `employees`** với `list_employees`, `get_employees` (để lookup id Anh Long).
- **Quy tắc tạo HĐCU mới**:
  1. Set `responsibleEmployee = Anh Long` (lookup `EMP-JP-LONG`).
  2. Set `cucApprovalStatus = "not_submitted"`.
  3. `create_reminder` cho Anh Long: "Đăng ký HĐ #X lên Cục" — due 3 ngày.
- **Section mới "⚠ Quy trình Cục QLLĐNN"** liệt kê 6 trạng thái + cách trả lời khi user hỏi "HĐ X đăng ký Cục chưa".

### 3.2 `jp_contract` (W5 Ký hợp đồng)

- **Cổng chặn (gate) trước khi advance Order draft → active**: phải đọc `cucApprovalStatus` của HĐCU liên quan.
  - `approved` / `not_required` → cho phép.
  - `pending` / `not_submitted` / `needs_revision` → STOP, báo user + tạo reminder cho Anh Long.
  - `rejected` → STOP, đề nghị xử lý lại.
- Order mới mặc định `status="draft"`.

### 3.3 `jp_recruitment` (W1)

- Thêm rule: khi LĐ đồng ý tham gia → **báo trước** số cọc dự kiến (20–30tr VND), thu sau khám SK trước khi vào lớp.

### 3.4 `jp_training` (W3)

- **Quy trình mới** chèn bước thu cọc:
  1. `status="health_check"` → hỏi admin/kế toán "LĐ X nộp cọc chưa, bao nhiêu, ngày nào?" → `update_workers({depositAmount, depositDate, depositNote, status:"deposit_paid"})`.
  2. KHÔNG cho `status="training"` nếu `depositAmount` rỗng.
  3. LĐ trượt/huỷ → set `depositRefundedAt` + nhắc kế toán hoàn tiền.

---

## 4. Quy trình end-to-end mong muốn

```
[ Phòng HC ]
  Đối tác Nhật mới → ký HĐCU
    → admin_contract_manager tạo SupplyContract
        responsibleEmployee = Anh Long
        cucApprovalStatus  = not_submitted
        + reminder cho Anh Long (3 ngày)
    ↓
  Anh Long nộp hồ sơ lên Cục → cucRegistrationDate, status = pending
    ↓
  Cục chấp thuận → cucResponseDate + cucApprovalDoc, status = approved

[ Phòng Nhật ]
  W5 jp_contract: tạo Order (status=draft) cho HĐCU đó
    advance_order_status(draft → active)?
      → check cucApprovalStatus = approved ✓
      → OK, active
  W1 jp_recruitment: tuyển LĐ → status=agreed (báo trước cọc 20-30tr)
  W2 jp_health_check: khám SK → pass → status=health_check
  W3 jp_training:
     thu cọc → depositAmount + depositDate, status=deposit_paid
     vào lớp → status=training
     thi pass → status=passed
     (hoặc fail → status=failed + depositRefundedAt)
  W4 → W5 → W6 → W7 → W8 (giữ nguyên)
```

---

## 5. Backlog liên quan

- **Backfill** `responsibleEmployee = Anh Long` cho 76 HĐCU cũ — đang để rỗng. Người dùng có thể gán tay từ admin, hoặc viết script `update many` sau.
- **Báo cáo "HĐ chờ Cục"**: `list_supply_contracts({where:{cucApprovalStatus:{in:["not_submitted","pending","needs_revision"]}}})` → xuất xlsx cho Anh Long. Tool đã sẵn — chỉ cần user hỏi `admin_contract_manager` "anh Long đang treo bao nhiêu HĐ".
- **Report đặt cọc chưa hoàn**: `list_workers({where:{status:{equals:"failed"}, depositRefundedAt:{exists:false}}})` cho kế toán. Tool đã sẵn.
- Mở rộng cùng pattern cho **Phòng Hàn / Đài / Đức**: chỉ cần seed thêm Employee ⨯ market + clone agent jp_* sang kr_* / tw_* / de_*. Schema HĐCU + Worker đã đủ tổng quát (không hard-code "Nhật" trong field).
