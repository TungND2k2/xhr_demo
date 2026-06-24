# Backlog — yêu cầu sau buổi họp đối tác 18/06/2026

> Tổng hợp 9 yêu cầu mới từ buổi họp. Mỗi mục em ghi: bối cảnh, phạm vi rõ ràng, độ phức tạp ước lượng, dependency, câu hỏi cần làm rõ trước khi bắt tay.
>
> **Quy ước độ phức tạp:**
> - 🟢 Nhỏ (1–4 giờ): chỉnh 1 collection + agent prompt + portal page.
> - 🟡 Trung (1–3 ngày): tính năng đầy đủ FE + BE + agent docs.
> - 🔴 Lớn (4+ ngày): module mới hoặc đụng nhiều hệ thống.

---

## 1. Báo cáo tổng hợp hàng tháng (Phòng HCNS)

**Phòng yêu cầu:** Phòng HCNS

**Mục tiêu:** các phòng nhập dữ liệu trong tháng → trợ lý AI tự tổng hợp + xuất ra báo cáo theo mẫu chuẩn (Word/Excel/PDF) cho HCNS gửi sếp.

**Độ phức tạp:** 🟡 Trung (2–3 ngày)

**Phạm vi đề xuất:**
- Tạo mẫu báo cáo chuẩn (mẫu nào? Excel? Word? — cần file mẫu)
- Agent mới `monthly_report` có tool `generate_monthly_report({month, year, departments})`
- Tool tổng hợp data từ Workers/Orders/Contracts/Reminders trong khoảng tháng, format theo mẫu.

**Câu hỏi cần làm rõ:**
- Báo cáo gồm những chỉ số gì? (số LĐ mới, số đơn ký, số COE về, số xuất cảnh, doanh thu...?)
- Định dạng output mong muốn — Word có header/logo TLG? Excel sheet nhiều tab? PDF in?
- Mẫu báo cáo hiện tại đang dùng là gì — anh gửi file mẫu để em copy chuẩn.
- Có cần group theo phòng (HCNS / Nhật / Hàn / Đài...) không?

---

## 2. Hiển thị "Ngày đến" trong lịch trình chung (Phòng HCNS)

**Phòng yêu cầu:** Phòng HCNS

**Mục tiêu:** field "Ngày đến" của LĐ (ngày bay sang Nhật / ngày dự kiến đến nơi làm việc) phải hiện ra trên màn hình lịch chung toàn công ty, không phải chỉ trong hồ sơ riêng từng LĐ.

**Độ phức tạp:** 🟢 Nhỏ (3–4 giờ)

**Phạm vi đề xuất:**
- Hook khi `Worker.deploymentDate` được set → tự tạo event trong Calendar collection (eventType="arrival", title="Đến Nhật: <tên LĐ>").
- Update CalendarView trên portal để hiển thị event này (đã có infrastructure, chỉ là thêm 1 loại event).

**Câu hỏi cần làm rõ:**
- "Ngày đến" = ngày LĐ đáp xuống Nhật (`deploymentDate` hiện tại) hay ngày dự kiến đến chỗ làm (khác)? Hệ thống có 1 field này thôi.
- Lịch chung muốn lọc theo phòng nào (HCNS thấy tất cả? hay W7 cũng thấy?)
- Cần notify ai khi gần ngày (1 ngày trước? 1 tuần trước?)

---

## 3. Nâng cấp trường "Bằng cấp cao nhất" (Hệ thống nhập liệu)

**Phòng yêu cầu:** Hệ thống nhập liệu

**Mục tiêu:** 
- Trường "Bằng cấp cao nhất" hiện là text tự do → đổi thành **danh mục lựa chọn**.
- Bổ sung lựa chọn "Phòng Nghiệp Vụ" (?? — có thể là 1 loại bằng cấp ngành nghề).
- Thêm trường định danh "Người nhập dữ liệu".

**Độ phức tạp:** 🟢 Nhỏ (2 giờ)

**Phạm vi đề xuất:**
- Workers collection: đổi `education` từ text → select với danh mục (THCS / THPT / Trung cấp / Cao đẳng / Đại học / Sau ĐH / Khác / **Phòng Nghiệp Vụ** ???)
- Form public "Sơ yếu lý lịch" (`seed-form-trainee-resume.ts`): đổi field `highestDegree` từ text → select cùng danh mục.
- Thêm field mới `createdByUser` (relationship → users) auto-set khi tạo Worker (hook `beforeChange`).

**Câu hỏi cần làm rõ:**
- "Phòng Nghiệp Vụ" trong context này là gì? Một loại bằng cấp (chứng chỉ nghề?) hay tên một phòng trong công ty? — không hiểu hết yêu cầu.
- Danh sách đầy đủ các lựa chọn bằng cấp — anh confirm giúp.
- "Người nhập dữ liệu" — auto-fill theo user đang login? Hay cho phép chọn tay?

---

## 4. Auto kiểm tra tài sản khi nhân sự nghỉ việc (Phòng HCNS Quản lý tài sản)

**Phòng yêu cầu:** Phòng HCNS — Quản lý tài sản

**Mục tiêu:** Khi nhân sự nội bộ (Employee) đổi trạng thái sang "Đã nghỉ việc" / "Sa thải":
1. Trợ lý AI **tự liệt kê** các tài sản (Assets) đang gán cho nhân sự đó.
2. **Nhắc thu hồi** — tạo reminder cho HCNS.
3. Sau khi HCNS xác nhận đã thu hồi → tự **gỡ assignedTo + đổi status tài sản** (vd "in_stock") + đóng reminder.

**Độ phức tạp:** 🟡 Trung (1–2 ngày)

**Phạm vi đề xuất:**
- Hook trên Employee `afterChange`: nếu `status` chuyển sang `resigned`/`fired` → query `assets where assignedTo = employee.userAccount` → tạo reminder kèm danh sách + tag HCNS.
- Tool `bulk_release_assets({employeeId})` để HCNS dùng sau khi thu hồi xong: clear `assignedTo` + set `status="in_stock"` cho cả batch.
- Agent admin asset (đã có) bổ sung quy trình này vào docs.

**Câu hỏi cần làm rõ:**
- Asset hiện đang gán theo `assignedTo: users` (account login), nhưng nghỉ việc là sự kiện trên Employee. Cần map Employee → User account (đã có `Employee.userAccount`). OK.
- Phòng nhân sự muốn nhận reminder hay agent tự DM thẳng cho HCNS?
- Có yêu cầu trạng thái "Đang chờ thu hồi" trên Asset không (để filter dễ)?

---

## 5. Chuẩn hóa cơ cấu Phòng Nghiệp Vụ — khối Lao động + Nghiệp đoàn

**Phòng yêu cầu:** Quản lý Phòng Nghiệp Vụ

**Mục tiêu:** chuẩn hóa cơ cấu — gồm 2 khối:
- **Khối Lao động** (employees đi XKLĐ)
- **Khối Nghiệp đoàn** (partner đối tác Nhật Bản)

Đặt tên thống nhất: "Nhật Bản 1", "Nhật Bản 2", "Hàn Quốc 1"... thay vì các tên hiện tại.

**Độ phức tạp:** 🟢🟡 Nhỏ–Trung (4–8 giờ)

**Phạm vi đề xuất:**
- Workers collection: đảm bảo có field `market` (đã có) + `assignedDepartment` (?) để nhóm.
- Departments enum (hiện trong Employees có 12 phòng) → có thể tách thành 2 chiều: market (jp/kr/tw/de) × index (1, 2, 3).
- UI portal: thêm nhóm hiển thị "Nhật Bản 1", "Nhật Bản 2"...

**Câu hỏi cần làm rõ:**
- "Nhật Bản 1" vs "Nhật Bản 2" là gì — 2 team khác nhau cùng làm thị trường Nhật? Hay 2 đợt? Hay 2 dòng đơn?
- "Khối Lao động" = nhân viên TLG hay LĐ XKLĐ? — em đoán là LĐ XKLĐ.
- Cần áp dụng cho thị trường nào khác (Hàn, Đài...) hay chỉ Nhật?

⚠ Yêu cầu này em chưa hiểu rõ nhất — cần anh giải thích cụ thể hoặc cho 1 ví dụ cơ cấu mong muốn.

---

## 6. Auto lịch nhắc từ công văn xuất cảnh (Trợ lý xuất cảnh)

**Phòng yêu cầu:** Trợ lý xuất cảnh (W7)

**Mục tiêu:** khi nhân viên W7 upload công văn xuất cảnh (có ngày bay, thông tin chuyến, ...) → AI đọc → tự tạo lịch nhắc các mốc xuất cảnh (làm thủ tục sân bay, người đón Nhật, gọi LĐ kiểm tra...).

**Độ phức tạp:** 🟡 Trung (1–2 ngày)

**Phạm vi đề xuất:**
- Tận dụng hệ thống extraction PDF/Office sẵn có (`apps/bot/src/extraction/`) để parse công văn.
- Khi Media được upload với `kind="departure_doc"` → trigger extraction → parse ngày bay + tên LĐ → tự `create_reminder` cho W7 các mốc: T-3 ngày, T-1 ngày, T-2h, T-confirm-arrival.
- Tận dụng pattern đã có với COE (`coeReceivedAt` → 3 reminder T+1/T+8/T+18).

**Câu hỏi cần làm rõ:**
- Mẫu công văn xuất cảnh có chuẩn không (1 format duy nhất) hay nhiều mẫu khác nhau? Anh gửi 1 file mẫu.
- Các mốc nhắc cụ thể — bao nhiêu mốc, mỗi mốc cách bao lâu trước ngày bay?
- Người nhận reminder — chỉ nhân viên W7 hay cả LĐ + người đón?

---

## 7. Nghiên cứu auto nhập liệu hồ sơ (anh Long quyết)

**Phòng yêu cầu:** Anh Long (Phòng Nhật)

**Mục tiêu:** đề xuất phương án tự động nhập liệu hồ sơ LĐ (vd OCR CV / hộ chiếu / CCCD / giấy khám SK...). Anh Long sẽ quyết định có làm không sau khi xem đề xuất.

**Độ phức tạp:** N/A (R&D giai đoạn này)

**Phạm vi đề xuất (chỉ research):**
- Em viết 1 file `docs/de-xuat-auto-nhap-lieu-ho-so.md` so sánh:
  - **Option A:** OCR + LLM (Claude/GPT vision) — chi phí ~$0.01–0.05/page, độ chính xác ~85–95%, không cần data train.
  - **Option B:** dùng Form online (link tự điền — đã có).
  - **Option C:** kết hợp — LĐ upload ảnh chụp giấy tờ → AI điền form draft → người duyệt.
- Cost/page, accuracy expected, dependency (S3 storage, API key), maintenance burden.

**Câu hỏi cần làm rõ:**
- Loại hồ sơ nào cụ thể? CV / CCCD / hộ chiếu / sổ học bạ / giấy khám?
- Anh Long ưu tiên tốc độ hay độ chính xác?
- Có chấp nhận human review trước khi commit không (em đề xuất nên có).

---

## 8. Blog nội bộ (Phòng HCNS)

**Phòng yêu cầu:** Phòng HCNS

**Mục tiêu:** module Blog nội bộ — đăng bài + ảnh, phân loại theo phòng ban, phân quyền chi tiết (post, edit, delete) cho từng nhóm user.

**Độ phức tạp:** 🔴 Lớn (4–5 ngày)

**Phạm vi đề xuất:**
- Collection mới `blog-posts`: title, content (rich text), author, department, status (draft/published/archived), tags, featuredImage, attachments[].
- Phân quyền theo role + department:
  - HCNS: post toàn cục.
  - Trưởng phòng X: post + edit trong phòng X.
  - Nhân viên: read + comment (nếu cần).
- Frontend portal: trang `/blog` list bài, `/blog/:id` chi tiết, editor (richtext markdown).
- Hooks: notify Telegram nhóm phòng khi bài mới đăng (option).

**Câu hỏi cần làm rõ:**
- Đối tượng đọc: chỉ nội bộ TLG hay LĐ cũng đọc?
- Bài có cần phê duyệt trước khi đăng (workflow draft → review → publish) không?
- Rich text editor — thường, hay cần highlight code, embed video, vẽ flow?
- Số lượng bài ước lượng/tháng — để biết có cần search engine không.

---

## 9. Quản lý văn bản đi/đến — báo cáo tập trung (Phòng HCNS)

**Phòng yêu cầu:** Phòng HCNS

**Mục tiêu:** chuẩn hóa quản lý văn bản đi (công văn TLG gửi đi) và văn bản đến (công văn nhận về) qua hệ thống báo cáo tập trung. Có 1 mẫu báo cáo chuẩn, agent dùng đúng mẫu đó khi xuất.

**Độ phức tạp:** 🟡 Trung (2 ngày — nhưng đã có 80% sẵn)

**Phạm vi đề xuất:**
- Collection `OfficialDocuments` **đã có sẵn** (em thấy trong cms/src/collections/). Có field direction (đi/đến).
- Mẫu báo cáo chuẩn (Word/Excel): cần file mẫu từ HCNS.
- Tool mới `export_official_documents_report({month, direction})` → xuất Excel/Word theo mẫu.
- Agent admin_contract_manager (hoặc tạo riêng `admin_documents`) update docs để dùng mẫu này khi user yêu cầu xuất báo cáo.

**Câu hỏi cần làm rõ:**
- File mẫu báo cáo — anh gửi để em copy chính xác layout.
- Báo cáo theo tháng / quý / năm / custom range?
- Lọc thêm theo loại văn bản (HĐ / nội bộ / Cục QLLĐNN / ...)?

---

## 📊 Bảng tổng quan ưu tiên

| # | Yêu cầu | Phòng | Độ phức tạp | Có thể làm ngay? |
|---|---|---|---|---|
| 1 | Báo cáo tháng tự động | HCNS | 🟡 2-3 ngày | Cần file mẫu báo cáo |
| 2 | Lịch chung hiển thị "Ngày đến" | HCNS | 🟢 3-4 giờ | ✅ ngay (làm rõ "ngày đến") |
| 3 | "Bằng cấp" thành danh mục + tracker người nhập | Hệ thống | 🟢 2 giờ | Cần list lựa chọn |
| 4 | Auto thu hồi tài sản khi nghỉ việc | HCNS Tài sản | 🟡 1-2 ngày | ✅ ngay |
| 5 | Chuẩn hóa cơ cấu Nhật 1 / Nhật 2 | Quản lý | 🟢🟡 4-8 giờ | Cần làm rõ "Nhật 1 / Nhật 2" là gì |
| 6 | Auto reminder từ công văn xuất cảnh | W7 | 🟡 1-2 ngày | Cần file mẫu công văn |
| 7 | Research auto nhập liệu | A Long | N/A | ✅ làm research doc trước |
| 8 | Blog nội bộ | HCNS | 🔴 4-5 ngày | ✅ ngay (cần spec UX) |
| 9 | Báo cáo VB đi/đến tập trung | HCNS | 🟡 2 ngày | Cần file mẫu báo cáo |

## 🎯 Em đề xuất thứ tự thực hiện

**Tuần 1 (quick wins):**
- #2 Lịch hiển thị Ngày đến (nhỏ, value cao cho HCNS)
- #3 Bằng cấp thành dropdown (nhỏ)
- #7 Viết research doc auto nhập liệu (để anh Long quyết sớm)

**Tuần 2:**
- #4 Auto thu hồi tài sản (hữu ích lâu dài, kết hợp module Assets em vừa redesign)
- #9 Báo cáo VB đi/đến (đã có 80% sẵn)

**Tuần 3-4:**
- #1 Báo cáo tháng tự động
- #6 Auto reminder xuất cảnh

**Tuần 5+:**
- #5 Chuẩn hóa cơ cấu Nhật 1/2 (cần align với BGD trước)
- #8 Blog nội bộ (lớn nhất, nên làm cuối)

**Items em cần anh confirm trước khi bắt tay:**
1. File **mẫu báo cáo tháng** + **mẫu báo cáo VB đi/đến** (cho mục 1 + 9)
2. File **mẫu công văn xuất cảnh** (cho mục 6)
3. Giải thích **"Phòng Nghiệp Vụ"** trong context bằng cấp (mục 3)
4. Giải thích **"Nhật Bản 1 / Nhật Bản 2"** — là gì, dùng để làm gì (mục 5)
5. Loại hồ sơ ưu tiên cho auto nhập liệu (mục 7)
