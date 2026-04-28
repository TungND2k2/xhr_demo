# xHR — Trợ lý AI quản lý Xuất khẩu lao động

Phiên bản v1 build trên pattern SkillBot (Payload CMS + Next.js + MongoDB + Telegram bot + Claude Agent SDK).

## Domain

Quản lý quy trình XKLĐ tổng quát — từ lúc tiếp nhận hồ sơ ứng viên đến khi
LĐ hoàn thành hợp đồng và về nước. 4 entity cốt lõi:

```
workers ─┬─< order_workers >─┬─ orders
         │                    │
         └────< contracts ────┘
```

- **workers** — người lao động (hồ sơ, giấy tờ, sức khoẻ, năng lực, ngoại ngữ)
- **orders** — đơn tuyển từ đối tác (xí nghiệp Nhật/Hàn/Đài/...) cần X người vị trí Y
- **order_workers** — junction: 1 ứng viên ứng tuyển 1 đơn, có sàng lọc/khám/đào tạo/phỏng vấn
- **contracts** — HĐ đã ký giữa worker × order, có visa/COE, ngày xuất cảnh, phí dịch vụ

## Workflow W1 → W8

```
W1 Tuyển dụng       (recruiter, ~30 ngày)
W2 Khám sức khoẻ    (medical, ~14 ngày)
W3 Đào tạo          (trainer, ~90 ngày — Nhật N4-N5, Hàn EPS)
W4 Phỏng vấn đối tác (recruiter, ~14 ngày)
W5 Ký hợp đồng       (manager + accountant, ~14 ngày)
W6 Xin visa / COE    (visa_specialist, ~60 ngày)
W7 Xuất cảnh         (visa_specialist, ~14 ngày)
W8 QL sau xuất cảnh  (manager, theo HĐ — 1-3 năm)
```

Stage configs (durationDays, reminders, deliverables) lưu trong `workflow-stages`
collection — admin/manager edit qua dashboard, bot tự đọc cấu hình mới.

## Cấu trúc

```
skillbot-xhr/
├── cms/                    # Payload CMS (Next.js 16, port 3002)
│   ├── src/
│   │   ├── collections/    # Users, Workers, Orders, OrderWorkers, Contracts, ...
│   │   ├── hooks/          # generate-code (XHR-, LD-, CT-), track-stage-timing
│   │   ├── components/admin/  # Logo, Icon, WorkflowDiagram (sơ đồ B1→B8)
│   │   └── payload.config.ts
│   ├── scripts/seed-workflow-stages.ts   # seed default workflow + 8 stages
│   └── package.json (name: xhr-cms, port 3002)
│
└── apps/bot/               # Telegram bot (port 4002 internal HTTP)
    ├── src/
    │   ├── tools/          # CRUD via factory + custom helpers
    │   │                  # workers/orders/order-workers/contracts/workflow-stages/forms
    │   │                  # advance_order_status, order_progress_summary, worker_summary
    │   ├── pipeline/system-prompt.ts   # Domain XKLĐ
    │   ├── telegram/channel.ts         # Polling + xử lý document/photo
    │   ├── extraction/                  # MarkItDown + Claude vision
    │   ├── cron/jobs.ts                 # Báo cáo tuần + reminder DM theo workflow
    │   └── payload/client.ts            # REST client + uploadMedia helper
    └── package.json (name: xhr-bot, port 4002)
```

## Setup local

### 1. MongoDB user mới

```bash
mongosh -u rootAdmin -p XXX --authenticationDatabase admin
> use xhr_cms
> db.createUser({ user: "xhrApp", pwd: "STRONG_PASS", roles: [{ role: "readWrite", db: "xhr_cms" }] })
```

### 2. Environment

```bash
cp cms/.env.example cms/.env       # → đổi DATABASE_URI, PAYLOAD_SECRET
cp apps/bot/.env.example apps/bot/.env  # → đổi TELEGRAM_BOT_TOKEN, INTERNAL_SECRET
```

`INTERNAL_SECRET` phải khớp giữa `cms/.env` và `apps/bot/.env`.

`TELEGRAM_BOT_TOKEN` — tạo bot **mới** qua [@BotFather](https://t.me/BotFather)
(không dùng chung token với SkillBot).

### 3. Install + run

```bash
# CMS
cd cms && npm install && npm run dev   # → http://localhost:3002/admin

# Tạo admin user lần đầu qua giao diện admin

# Seed workflow + stages
SEED_ADMIN_EMAIL=admin@xhr.local SEED_ADMIN_PASSWORD=... npx tsx scripts/seed-workflow-stages.ts

# Bot (terminal khác)
cd apps/bot && npm install && npm run dev
```

## Roles

| Role               | Quyền                                                 |
|--------------------|-------------------------------------------------------|
| `admin`            | toàn quyền                                            |
| `manager`          | duyệt workflow, gán đơn, sửa data                     |
| `recruiter`        | nhập ứng viên, sàng lọc, theo dõi đơn                 |
| `trainer`          | quản lý lớp, điểm danh, ghi điểm đào tạo              |
| `visa_specialist`  | xử lý hồ sơ COE/visa, quản lý xuất cảnh               |
| `accountant`       | phí dịch vụ, thanh toán                               |
| `medical`          | cập nhật kết quả khám SK                              |

## Custom tools mà bot cung cấp

- `worker_summary(workerCode | id)` — tóm tắt 1 LĐ + đơn đang ứng tuyển + HĐ
- `order_progress_summary(orderCode | id)` — tóm tắt 1 đơn + tiến độ ứng viên
- `advance_order_status(orderId, toStatus)` — chuyển W1→W2→...→W8
- CRUD: `list_/get_/create_/update_/delete_workers|orders|order-workers|contracts`
- `list_workflow_stages|get_workflow_stages|...` — bot đọc cấu hình
- `list_forms|get_form|submit_form|list_submissions` — form-builder integration

## Deploy lên server (cùng host SkillBot)

Server đang có sẵn MongoDB (port 27017) + MarkItDown (port 8080) — share được.

```
/opt/xhr-v1/
├── cms/      → port 3002, DB: xhr_cms
└── apps/bot/  → port 4002 internal HTTP

PM2 process names: xhr-cms, xhr-bot
nginx site:        xhr.<domain> → :3002
```

Dùng pm2 ecosystem file (chưa wire — copy từ skillbot và đổi tên/port).

## Khác biệt với SkillBot (may thêu)

| | SkillBot | xHR |
|--|--|--|
| Domain | May thêu xuất khẩu trẻ em | Xuất khẩu lao động |
| Entities | Orders/Customers/Fabrics/Suppliers/Inventory/Allowances/QcLogs | Workers/Orders/OrderWorkers/Contracts |
| Workflow | B1-B6 (~30-60 ngày/đơn) | W1-W8 (~6-12 tháng/đơn) |
| Roles | salesperson, planner, qc, storage, accountant | recruiter, trainer, visa_specialist, medical, accountant |
| Mã đơn | PE-{seq} | XHR-{seq} |
| Mã ứng viên | — | LD-{seq} |
| Mã HĐ | — | CT-{seq} |
| Bot domain | đơn hàng, vải, kho | hồ sơ LĐ, đơn tuyển, HĐ |
| File AI đọc | hóa đơn + đề bài | CV / hộ chiếu / giấy khám SK / HĐ |
