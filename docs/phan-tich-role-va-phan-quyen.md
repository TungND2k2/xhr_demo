# Phân tích Roles + Login + Phân quyền — xHR

> Tài liệu phân tích trước khi code. Mục đích: thống nhất role model + permission matrix + login flow trước khi triển khai.
>
> **Ngày:** 24/06/2026

---

## 1. Hiện trạng

### 1.1 Roles đang có (Users collection)

| Role hiện tại | Ý nghĩa | Vấn đề |
|---|---|---|
| `admin` | Chủ DN / GĐ — toàn quyền | Quá rộng, không phân biệt owner vs IT admin |
| `manager` | Quản lý điều hành | Không scope theo thị trường — manager Nhật thấy được hồ sơ Hàn |
| `recruiter` | Tuyển dụng W1 | OK |
| `trainer` | Giảng viên W3 | OK |
| `visa_specialist` | Chuyên viên visa W6 | OK |
| `accountant` | Kế toán | OK (cross phòng) |
| `medical` | Y tế / Khám SK W2 | OK |

### 1.2 Vai trò THIẾU trong hệ thống hiện tại

Đối chiếu với buổi họp đối tác 18/06/2026 và cơ cấu thực tế TLG:

- ❌ **Không có vai trò HCNS** (Phòng Hành chính – Nhân sự) — đang gộp vào admin/manager → ai cũng dụng được Employees, Assets, OfficialDocuments.
- ❌ **Không có scope thị trường** — manager Nhật xem được hồ sơ phòng Hàn (chéo phòng không có rào chắn).
- ❌ **Không có trưởng phòng theo thị trường** (vd Trưởng phòng Nhật) — chỉ có `manager` flat.
- ❌ **Không có vai trò cho W4 / W5 / W7 / W8** — phỏng vấn / ký HĐ / xuất cảnh / hậu xuất cảnh. Hiện đều phải gán `manager` hoặc `admin` → mất rào chắn.
- ❌ **Không có viewer / read-only** cho lãnh đạo quan sát mà không sửa.
- ❌ **Không có owner ≠ admin** — chủ DN khác với admin IT.

### 1.3 Login hiện tại

| Kênh | Cách auth | Vấn đề |
|---|---|---|
| **Bot Telegram** | Chat trong nhóm bot lookup `TelegramUserId` → resolve User → check role | OK, nhưng nhân viên phải được thêm `telegramUserId` thủ công |
| **CMS admin** (`/admin`) | Payload built-in email + password | OK, đã có sẵn |
| **Portal** (`/`) | **Hardcoded `VITE_DEV_EMAIL/PASSWORD`** trong env build — KHÔNG có login thật | 🔴 Bug bảo mật — tất cả người vào portal đều thấy hết data |

### 1.4 Audit hiện tại

- `createdAt` / `updatedAt` (Payload tự ghi).
- `createdByUser` (vừa thêm cho Workers).
- ❌ Chưa có **audit log đầy đủ** — sửa field nào, từ giá trị nào sang giá trị nào.

---

## 2. Đề xuất Role Model

### 2.1 Hai chiều quyền

Em đề xuất chia role thành **2 chiều**:

- **Chiều 1 — `role` (loại quyền chức năng):** ai làm gì
- **Chiều 2 — `markets` (mảng thị trường):** trong phạm vi nào

Ví dụ:
- Trưởng phòng Nhật = `role=market_manager` + `markets=["jp"]`
- Nhân viên Tuyển dụng phòng Nhật = `role=recruiter` + `markets=["jp"]`
- HCNS (cross thị trường) = `role=hcns` + `markets=[]` (rỗng = tất cả)
- Kế toán = `role=accountant` + `markets=[]` (tất cả)

### 2.2 Danh sách Role đề xuất (12 roles)

#### 🌐 Cross-system roles

| Role | Tên tiếng Việt | Phạm vi | Quyền chính |
|---|---|---|---|
| `owner` | Chủ DN | Toàn hệ thống | Full quyền + quản lý users + role + cấu hình |
| `admin` | Admin kỹ thuật | Toàn hệ thống | Full data trừ quản lý owner / billing |
| `viewer` | Quan sát viên | Toàn hệ thống | Chỉ đọc — cho cố vấn, audit, lãnh đạo cấp cao |

#### 🏢 Cross-market staff roles (đụng nhiều phòng)

| Role | Tên tiếng Việt | Phạm vi |
|---|---|---|
| `hcns` | HCNS — Hành chính Nhân sự | Tất cả thị trường. Quản Employees, Assets, OfficialDocuments, Offices |
| `accountant` | Kế toán | Tất cả. Quản tiền cọc, doanh thu, phí dịch vụ |
| `medical` | Y tế / Khám SK | Tất cả. Cập nhật kết quả khám SK (W2) |

#### 🎯 Market-scoped roles (theo thị trường)

| Role | Tên tiếng Việt | Phạm vi | Đụng W nào |
|---|---|---|---|
| `market_manager` | Trưởng phòng thị trường | 1+ market | Đọc tất cả W của market, gán việc |
| `recruiter` | Tuyển dụng | Theo market | W1 |
| `trainer` | Đào tạo | Theo market | W3 |
| `interviewer` | Phỏng vấn đối tác | Theo market | W4 |
| `contract_specialist` | Chuyên viên hợp đồng | Theo market | W5 |
| `visa_specialist` | Chuyên viên visa | Theo market | W6 |
| `departure_specialist` | Chuyên viên xuất cảnh | Theo market | W7, W8 |
| `order_manager` | Quản đơn / Đối tác | Theo market | Orders, Partners |

> **Ghi chú:** 1 user có thể có **nhiều markets** (vd nhân viên kiêm Nhật + Hàn → `markets=["jp","kr"]`).

### 2.3 Mapping với 7 role cũ → 12 role mới

| Role cũ | → Role mới + markets |
|---|---|
| `admin` (1 người = chủ DN) | `owner` |
| `admin` (IT) | `admin` |
| `manager` (chung) | `market_manager` + `markets=[market họ phụ trách]` |
| `recruiter` | `recruiter` + `markets=[...]` |
| `trainer` | `trainer` + `markets=[...]` |
| `visa_specialist` | `visa_specialist` + `markets=[...]` |
| `accountant` | `accountant` |
| `medical` | `medical` |

**Migration:** script đọc Users hiện tại, tự gán markets dựa trên `Employees.department` (nếu user có Employee link), default `markets=[]`.

---

## 3. Permission Matrix (đề xuất)

Mỗi collection có 4 action: **Read / Create / Update / Delete**.

### 3.1 Workers (LĐ XKLĐ)

| Role | Read | Create | Update | Delete | Note |
|---|---|---|---|---|---|
| `owner` | ✅ all | ✅ | ✅ | ✅ | |
| `admin` | ✅ all | ✅ | ✅ | ✅ | |
| `viewer` | ✅ all | ❌ | ❌ | ❌ | |
| `hcns` | ✅ all | ❌ | ❌ | ❌ | Chỉ xem, không sửa LĐ |
| `accountant` | ✅ all | ❌ | ✅ deposit fields | ❌ | Sửa cọc thôi |
| `medical` | ✅ all | ❌ | ✅ health fields | ❌ | Sửa kết quả khám |
| `market_manager` | ✅ own market | ✅ own market | ✅ own market | ❌ | |
| `recruiter` | ✅ own market | ✅ own market | ✅ W1 fields own market | ❌ | |
| `trainer` | ✅ own market | ❌ | ✅ W3 fields own market | ❌ | |
| `interviewer` | ✅ own market | ❌ | ✅ W4 fields own market | ❌ | |
| `contract_specialist` | ✅ own market | ❌ | ✅ W5 fields own market | ❌ | |
| `visa_specialist` | ✅ own market | ❌ | ✅ W6 fields own market | ❌ | |
| `departure_specialist` | ✅ own market | ❌ | ✅ W7/W8 fields own market | ❌ | |
| `order_manager` | ✅ own market | ❌ | ❌ | ❌ | |

### 3.2 Orders / Contracts / Partners / SupplyContracts

Theo `market` của Order. Tương tự bảng trên — `market_manager`, `order_manager`, `contract_specialist` có quyền sửa theo phạm vi.

### 3.3 Employees / Assets / Offices / OfficialDocuments

Chỉ `hcns`, `admin`, `owner` có quyền sửa. Còn lại đọc thôi.

### 3.4 Reminders / Calendars / FormInvites

Mọi user logged-in đều create/read được. Update/delete chỉ creator + admin.

### 3.5 Agents / TelegramTopics / TelegramGroups

Chỉ `owner`, `admin` — đây là cấu hình hệ thống.

### 3.6 Users (quản lý tài khoản)

| Role | Action |
|---|---|
| `owner` | Full — tạo / xoá / đổi role bất kỳ ai |
| `admin` | Tạo + sửa người dùng trừ `owner`, không đổi role thành `owner` |
| Khác | ❌ |

---

## 4. Login Flow

### 4.1 Vấn đề hiện tại

Portal đang dùng `VITE_DEV_EMAIL/PASSWORD` hardcoded — **bất cứ ai vào URL portal đều thấy hết data**. Không có rào chắn.

### 4.2 Đề xuất

**Portal sẽ có login page riêng** (không dùng Payload admin login vì UX khác hẳn).

#### Flow đăng nhập

```
1. User vào portal URL → check session (cookie JWT)
   - Có session valid → vào dashboard
   - Không có / hết hạn → redirect /login
2. /login page:
   - Email + Password
   - "Đăng nhập" → POST /api/users/login
   - Nhận JWT → lưu cookie + redirect dashboard
3. Mỗi request kèm cookie JWT, Payload tự verify
4. /logout → xoá cookie + redirect /login
```

#### Forgot password (Phase 2)

```
1. "Quên mật khẩu" link → /forgot-password
2. Nhập email → gửi link reset (token TTL 1h)
3. Click link trong email → /reset-password?token=xxx
4. Đặt mật khẩu mới
```

→ Payload built-in đã hỗ trợ `/api/users/forgot-password` + `/api/users/reset-password`. Chỉ cần build UI.

#### Bảo mật

- **JWT trong httpOnly cookie** (không lưu localStorage để chống XSS).
- **CSRF token** cho mọi POST/PATCH/DELETE (Payload có sẵn).
- **Rate limit login** — 5 fail/phút thì block IP 15 phút.
- **Password policy** — min 8 ký tự, có chữ + số. KHÔNG bắt ký tự đặc biệt (dễ quên).

#### MFA (Phase 3 — sau)

- Email OTP khi login từ IP lạ.
- TOTP (Google Authenticator) cho `owner` + `admin`.

### 4.3 Telegram bot ↔ Portal sync

- User trong Telegram có `telegramUserId` đã link với User trong Payload.
- Khi nhân viên gõ `@bot tôi là ai` trong Telegram → bot trả về display name + role + markets.
- Có thể thêm tính năng `@bot tạo link đăng nhập portal cho tôi` → bot DM 1 link 1-time-login (token 5 phút).

### 4.4 Audit log (Phase 2)

- Collection mới `audit-logs`: collection + recordId + action + userId + diff + ip + userAgent + timestamp.
- Hook generic `afterChange` trên mọi collection ghi vào audit-logs.
- UI portal: trang `/audit` cho `owner` + `admin` xem ai sửa gì khi nào.

---

## 5. Implementation Phases

### Phase 1 — Foundation (1-2 tuần) ⭐ Ưu tiên

1. **Update Users collection schema**: thêm `markets` array, mở rộng role enum (12 roles), thêm `assignedTopics` (mảng W1-W8).
2. **Migration script**: map 7 role cũ → 12 role mới + auto-fill markets từ Employees.department.
3. **Cập nhật `access` của TẤT CẢ collections** theo permission matrix (mục 3).
4. **Login page portal**:
   - `/login` UI
   - `useAuth()` hook
   - Protected routes — auto redirect /login nếu chưa auth
   - Logout button
5. **Forgot password** UI (tận dụng Payload sẵn có).

### Phase 2 — Refinement (1 tuần)

6. **Rate limit + password policy**.
7. **Audit log collection + hook + UI**.
8. **Telegram bot tích hợp** — `@bot tôi là ai`, sync role/markets từ Payload.
9. **Field-level permission**: kế toán chỉ sửa được `depositAmount/depositDate`, không sửa được status worker — cần config riêng cho từng field.

### Phase 3 — Advanced (sau khi cần)

10. **MFA** — TOTP cho admin/owner.
11. **SSO** qua Google Workspace (nếu TLG có Workspace).
12. **Session management** — list active sessions, kick session.

---

## 6. Câu hỏi cần Anh chốt

1. **Owner ≠ Admin có cần thiết?** Hay TLG ok dùng 1 role `admin` cho chủ DN luôn? Em đề xuất tách vì sau này nhờ outsource IT thì admin IT ≠ owner.

2. **Có cần `viewer` (chỉ đọc)?** Cho cố vấn, audit ngoài, sếp cao cấp xem mà không sửa.

3. **`market_manager` cho trưởng phòng** có cần limit markets không, hay trưởng phòng nào cũng full view tất cả thị trường? — Em đề xuất limit theo markets cho an toàn dữ liệu.

4. **HCNS chỉ READ Workers hay cũng CRUD?** — Em đề xuất chỉ READ vì sửa LĐ là việc của các phòng W chuyên trách.

5. **Phòng W4 / W5 / W7 / W8** có nhân sự chuyên trách không, hay 1 người làm cả W4-W7-W8? Nếu 1 người làm nhiều → user có nhiều role / 1 role kiêm nhiều W?

6. **Forgot password gửi email** — TLG có SMTP riêng hay dùng Gmail? Em cần config SMTP cho Payload.

7. **MFA cần gấp không?** Hay để Phase 3 sau khi có khung permission ổn?

8. **Bao giờ start?** Em đoán Phase 1 mất ~5-7 ngày. Có thể demo từng phần cho khách (login → matrix → tester thử quyền).
