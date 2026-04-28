# SkillBot bot — Telegram + Claude AI

Process này chạy song song với **`cms/`** (Payload). Không truy cập MongoDB trực tiếp — mọi I/O đi qua Payload REST API.

## Kiến trúc

```
Telegram user
    │
    ▼
TelegramChannel ──► MessageQueue ──► runPipeline()
                                          │
                                          ▼
                                   Claude Agent SDK
                                          │ tool calls
                                          ▼
                                   tools/* (CRUD + custom)
                                          │
                                          ▼
                                   Payload REST API
                                          │
                                          ▼
                                       MongoDB
```

CronWorker chạy parallel:
```
mỗi tickMs → check job nào due → run() → push notify lên Telegram admin
```

## Cấu trúc thư mục

```
src/
├── index.ts              entry — wire telegram + cron + payload
├── config.ts             zod-validated env config
├── payload/
│   ├── client.ts         REST client (auto-login JWT, retry on 401)
│   └── types.ts          PayloadDoc, PayloadFindResponse, ...
├── tools/                AI tools — Claude calls these
│   ├── factory.ts        ⭐ createCrudTools() → list/get/create/update/delete
│   ├── format.ts         result formatting helpers
│   ├── orders.tools.ts   1 file = 5 tool (auto từ factory)
│   ├── fabrics.tools.ts
│   ├── suppliers.tools.ts
│   ├── inventory.tools.ts
│   ├── qcLogs.tools.ts
│   ├── allowances.tools.ts
│   ├── orders.workflow.ts  custom: advance_order_status
│   ├── inventory.queries.ts custom: find_low_stock, weekly_report
│   └── index.ts          re-export `allTools` array
├── pipeline/
│   ├── pipeline.ts       runPipeline() — 1 conversation turn
│   └── system-prompt.ts  Vietnamese system prompt + business rules
├── telegram/
│   ├── channel.ts        long-poll, queue, dispatch
│   └── format.ts         markdown → Telegram HTML
├── cron/
│   ├── worker.ts         CronWorker class
│   ├── cron-schedule.ts  cron-parser wrapper
│   └── jobs.ts           hardcoded jobs: weekly purchase, weekly report, hourly stock
├── queue/
│   └── message-queue.ts  bounded priority queue
└── utils/
    ├── clock.ts
    ├── logger.ts
    └── id.ts             ulid
```

## Thêm entity mới = 10 dòng

```ts
// src/tools/shipments.tools.ts
import { z } from "zod";
import { createCrudTools } from "./factory.js";

export const shipmentTools = createCrudTools({
  slug: "shipments",
  label: { singular: "lô giao hàng", plural: "lô giao hàng" },
  filterableFields: ["status", "carrier"],
  inputSchema: {
    order: z.string().describe("ID đơn hàng"),
    carrier: z.string(),
    trackingNumber: z.string().optional(),
    shippedAt: z.string().describe("YYYY-MM-DD"),
  },
});
```

Rồi push vào [tools/index.ts](src/tools/index.ts):
```ts
import { shipmentTools } from "./shipments.tools.js";
export const allTools = [..., ...shipmentTools, ...];
```

Xong — AI biết `list_shipments`, `create_shipments`, etc. ngay lập tức.

## Run

```bash
# 1. CMS phải chạy trước
cd ../../cms && npm run dev

# 2. Bot
cd ../apps/bot
cp .env.example .env
# sửa PAYLOAD_BOT_EMAIL, PAYLOAD_BOT_PASSWORD theo user đã tạo trong Payload
# thêm TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
npm install
npm run dev
```

## Auth model

- Bot login Payload bằng `email/password` của 1 user (role admin) lưu trong `.env`.
- JWT cache trong memory, auto-refresh trước expiry.
- Mọi tool gọi Payload qua JWT này. Payload's access control + audit log auto-track.

## Giới hạn hiện tại

- Chưa support file upload (Telegram → Payload media). Sẽ thêm sau.
- Chưa support multi-user mapping (Telegram user → Payload user). Hiện 1 bot account chung cho mọi tool call.
- Cron job hardcode trong `cron/jobs.ts`; chưa có cron động chỉnh qua admin UI.
