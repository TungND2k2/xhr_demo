# LLM API Spec — yêu cầu cho team build

Doc này dành cho team xây API LLM thay thế Claude. Mô tả những gì API cần đáp ứng để bot kết nối được mà không lỗi.

---

## 1. Endpoint

```
POST https://your-api.com/v1/messages
Authorization: Bearer <api_key>
Content-Type: application/json
```

API nên **clone format Anthropic Messages API**. Nếu format chuẩn, client chỉ cần đổi `baseURL` + `apiKey`.

---

## 2. Request body

```json
{
  "model": "your-model-name",
  "max_tokens": 8192,
  "system": "<system prompt — string>",
  "messages": [
    { "role": "user", "content": [{ "type": "text", "text": "Hello" }] }
  ],
  "tools": [
    {
      "name": "create_reminder",
      "description": "Tạo lịch nhắc",
      "input_schema": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "dueAt": { "type": "string" }
        },
        "required": ["title", "dueAt"]
      }
    }
  ],
  "stream": true
}
```

| Field | Bắt buộc | Mô tả |
|---|---|---|
| `model` | ✅ | Model name |
| `max_tokens` | ✅ | Output cap, ≥ 4096 |
| `system` | ✅ | System prompt (string hoặc array) |
| `messages` | ✅ | Mảng turn user/assistant |
| `tools` | ✅ | Tool definitions (JSON Schema) |
| `stream` | ✅ | Hỗ trợ `true` (SSE) |

---

## 3. Response — Streaming SSE

Trả về dạng `text/event-stream`. Mỗi event 1 dòng:

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_xxx","role":"assistant","model":"...","usage":{}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Đã"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" tạo"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":15}}

event: message_stop
data: {"type":"message_stop"}
```

### Stop reason có thể trả

| Value | Khi nào |
|---|---|
| `end_turn` | Model trả xong text bình thường |
| `tool_use` | Model muốn gọi tool, dừng để client chạy tool |
| `max_tokens` | Hết quota output |
| `stop_sequence` | Match stop sequence (nếu có) |

---

## 4. Tool calling protocol

### 4.1. Model gọi tool

Khi model quyết định gọi tool, content_block là `tool_use`:

```json
{
  "type": "content_block_start",
  "index": 0,
  "content_block": {
    "type": "tool_use",
    "id": "toolu_abc123",
    "name": "create_reminder",
    "input": {}
  }
}
```

Tham số `input` stream qua delta dạng `input_json_delta`:

```json
{
  "type": "content_block_delta",
  "index": 0,
  "delta": { "type": "input_json_delta", "partial_json": "{\"title\":\"" }
}
```

Client accumulate các `partial_json` chunks → parse thành object cuối cùng.

### 4.2. Client gửi tool_result về model

Sau khi client chạy xong tool, request kế tiếp gửi message:

```json
{
  "messages": [
    { "role": "user", "content": [{ "type": "text", "text": "..." }] },
    {
      "role": "assistant",
      "content": [
        {
          "type": "tool_use",
          "id": "toolu_abc123",
          "name": "create_reminder",
          "input": { "title": "...", "dueAt": "..." }
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "tool_result",
          "tool_use_id": "toolu_abc123",
          "content": "✅ Đã tạo #abc",
          "is_error": false
        }
      ]
    }
  ]
}
```

Model phải:
- Map `tool_result.tool_use_id` về `tool_use.id` mà nó sinh ở turn trước
- Đọc `content` (string hoặc array content block), tiếp tục reasoning hoặc trả final text

### 4.3. Tool calling — yêu cầu chất lượng

- Sinh `input` JSON **đúng schema 100%** (đặc biệt khi schema có `enum`, `required`, nested object)
- Khi user yêu cầu rõ → gọi tool, KHÔNG hỏi lại
- Có thể chạy multi-turn 10–30 vòng tool_use ↔ tool_result trong 1 conversation

---

## 5. Vision (image input)

User gửi ảnh dạng base64 trong content:

```json
{
  "role": "user",
  "content": [
    {
      "type": "image",
      "source": {
        "type": "base64",
        "media_type": "image/png",
        "data": "iVBORw0KGgo..."
      }
    },
    { "type": "text", "text": "Đọc giúp tài liệu này" }
  ]
}
```

**Hỗ trợ media_type:**
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`

**Yêu cầu chất lượng vision:**
- OCR được tiếng Việt + tiếng Nhật/Hàn/Trung (giấy tờ đối tác đa ngôn ngữ)
- Trích entity được (tên, số, ngày, mã)
- 1 request có thể có 4–5 ảnh (PDF scan multi-page) — model phải xử lý được

---

## 6. Khả năng model phải có

| Khả năng | Mô tả | Test |
|---|---|---|
| **Tool calling** | Đọc tool definitions trong request, sinh `tool_use` đúng schema | Gửi tool dummy `get_weather`, hỏi "Hà Nội bao nhiêu độ" → model phải gọi tool |
| **Multi-turn** | Sau khi nhận tool_result, tiếp tục logic; có thể 10–30 vòng | Lặp 5 tool_result → vẫn nhất quán |
| **Long context** | ≥ 32K tokens (system + history + tool results) | System prompt 10K + 20 messages → không truncate |
| **Vision** | Đọc ảnh, OCR multilingual | Ảnh giấy tiếng Việt → trả nội dung chữ |
| **Vietnamese** | Hiểu + sinh tiếng Việt tự nhiên | "thứ 6 9h" → output Friday 09:00 ISO |
| **JSON output** | Sinh JSON valid theo schema (kể cả enum, nested) | Schema có `enum: ["a","b"]` → model pick đúng 1 trong 2 |
| **Streaming SSE** | Trả từng chunk, không buffer toàn bộ | Curl streaming thấy chunks về liên tục |

---

## 7. Checklist test

Mỗi case PASS thì OK switch.

- [ ] **Test 1 — Text only**: gửi `"Chào em"` → trả streaming text bình thường.
- [ ] **Test 2 — 1 tool**: định nghĩa tool `get_weather(city)`, hỏi `"Hà Nội bao nhiêu độ"` → model gọi tool đúng input.
- [ ] **Test 3 — Tool result**: gửi tool_result `"32°C"` → model trả text dùng kết quả.
- [ ] **Test 4 — Multi-tool**: 2 tool `list_users` + `create_reminder`, hỏi `"Nhắc anh Nam 9h"` → gọi `list_users` trước rồi `create_reminder`.
- [ ] **Test 5 — Vision**: gửi ảnh giấy chữ tiếng Việt → model đọc được nội dung.
- [ ] **Test 6 — Long system prompt**: system prompt ~10K tokens → không truncate, model vẫn follow rules.
- [ ] **Test 7 — Vietnamese datetime**: `"thứ 6 14h"` → output ISO `2026-XX-XXT14:00:00+07:00` đúng thứ 6 gần nhất.
- [ ] **Test 8 — Streaming interrupt**: client đóng kết nối giữa chừng → server close gracefully, không leak.

---

## 8. Thông tin team API cần cung cấp khi xong

- `LLM_BASE_URL` — endpoint
- `LLM_API_KEY` — test key (có thể revoke)
- Tên model
- Context window (tokens)
- Rate limit (req/min, tokens/min)
- 1 sample `curl` thành công cho streaming response
