// Config cho các trang dùng SimpleListPage.
// Mỗi key = activeTab name.
import { Link } from 'react-router-dom';
import { fmtDate, fmtVND, CUC_STATUS_LABELS, ORDER_STAGE_LABELS, WORKER_STATUS_LABELS, MARKET_LABELS } from '../lib/workers-labels';

// Render 1 media reference (relationship field) thành link clickable
// → click mở /media/<id> trong portal (MediaDetail có preview)
function mediaLink(m) {
  if (!m) return null;
  // Có thể là string ID hoặc object (depth >= 1)
  const id = typeof m === 'object' ? m.id : m;
  if (!id) return null;
  const filename = typeof m === 'object' ? (m.filename ?? m.alt ?? `media#${id}`) : `media#${id}`;
  const sizeKb = typeof m === 'object' && m.filesize ? `${Math.round(m.filesize / 1024).toLocaleString()} KB` : null;
  return (
    <Link
      to={`/media/${id}`}
      className="text-blue-500 hover:underline inline-flex items-center gap-1"
      title="Mở chi tiết file"
    >
      📎 <span className="font-mono text-xs">{filename}</span>
      {sizeKb && <span className="text-slate-500 text-[10px]">({sizeKb})</span>}
    </Link>
  );
}

const DOC_DIRECTION = {
  incoming: '📥 Đến',
  outgoing: '📤 Đi',
  internal: '🏢 Nội bộ',
};

const DOC_STATUS = {
  draft: '📝 Nháp',
  sent: '✉️ Đã gửi',
  received: '📬 Đã nhận',
  processing: '⏳ Đang xử lý',
  completed: '✅ Xong',
  archived: '📦 Lưu trữ',
  cancelled: '❌ Huỷ',
};

const EMP_DEPT = {
  hcns: '🏢 HC-NS',
  tuyendung: '🧑‍💼 Tuyển dụng',
  daotao: '🎓 Đào tạo',
  visa: '🛂 Visa',
  ketoan: '💰 Kế toán',
  yte: '🏥 Y tế',
  phong_jp: '🇯🇵 Phòng JP',
  phong_kr: '🇰🇷 Phòng KR',
  phong_tw: '🇹🇼 Phòng TW',
  phong_de: '🇩🇪 Phòng DE',
  bgd: '👑 BGĐ',
  other: 'Khác',
};

const REMIND_STATUS = {
  pending: '⏳ Chờ',
  sent: '✉️ Đã gửi',
  snoozed: '💤 Hoãn',
  dismissed: '🚫 Bỏ qua',
  done: '✅ Xong',
};

const GENDER_LABEL = { male: 'Nam', female: 'Nữ', other: 'Khác' };
const MARITAL_LABEL = { single: 'Độc thân', married: 'Đã kết hôn', divorced: 'Ly hôn', widowed: 'Goá' };
const HEALTH_LABEL = { pending: 'Chưa khám', scheduled: 'Đã đặt lịch', pass: 'Đạt', fail: 'Không đạt', retest: 'Khám lại' };
const EXAM_LABEL = { pending: 'Chưa thi', pass: 'Đỗ', fail: 'Trượt' };

export const PAGES = {
  /* ─────────── Worker (LĐ) — form layout đầy đủ ─────────── */
  workers: {
    title: 'Lao động',
    collection: 'workers',
    detailLayout: 'form',
    formTitle: 'SƠ YẾU LÝ LỊCH NGƯỜI LAO ĐỘNG',
    headerSummary: (w) => {
      const status = WORKER_STATUS_LABELS[w.status] ?? w.status ?? '?';
      const market = MARKET_LABELS[w.market];
      return {
        title: w.workerCode ?? w.id,
        subtitle: [w.fullName, status, market].filter(Boolean).join(' · '),
      };
    },
    detailSections: (w, extras = {}) => {
      const sections = [
        {
          title: 'Thông tin cá nhân',
          fields: [
            ['Họ tên', w.fullName],
            ['Mã LĐ', w.workerCode, { mono: true }],
            ['Ngày sinh', fmtDate(w.dob)],
            ['Giới tính', GENDER_LABEL[w.gender] ?? w.gender],
            ['Tình trạng hôn nhân', MARITAL_LABEL[w.maritalStatus] ?? w.maritalStatus],
            ['Học vấn', w.education],
          ],
        },
        {
          title: 'Liên hệ',
          fields: [
            ['SĐT', w.phone],
            ['Email', w.email],
            ['Telegram User ID', w.telegramUserId, { mono: true }],
            ['Quê', w.hometown],
            ['Địa chỉ thường trú', w.address, { fullRow: true }],
          ],
        },
        {
          title: 'Giấy tờ tuỳ thân',
          fields: [
            ['Số CCCD/CMND', w.nationalId, { mono: true }],
            ['Ngày cấp CCCD', fmtDate(w.nationalIdIssuedAt)],
            ['Số hộ chiếu', w.passportNo, { mono: true }],
            ['Ngày cấp HC', fmtDate(w.passportIssuedAt)],
            ['Ngày hết hạn HC', fmtDate(w.passportExpiry)],
          ],
        },
        {
          title: 'Thể chất + Sức khoẻ',
          fields: [
            ['Chiều cao (cm)', w.height],
            ['Cân nặng (kg)', w.weight],
            ['Tình trạng SK', HEALTH_LABEL[w.healthStatus] ?? w.healthStatus],
            ['Ngày khám SK', fmtDate(w.healthCheckDate)],
            ['Nơi khám', w.healthCheckLocation],
          ],
        },
        {
          title: 'Đào tạo + Thi tuyển',
          fields: [
            ['Lớp đào tạo', w.trainingGroup],
            ['Bắt đầu', fmtDate(w.trainingStartDate)],
            ['Kết thúc', fmtDate(w.trainingEndDate)],
            ['Kết quả thi nội bộ', EXAM_LABEL[w.examResult] ?? w.examResult],
            ['Điểm thi', w.examScore],
            ['Lý do trượt', w.failureReason],
          ],
        },
        {
          title: 'Đặt cọc',
          fields: [
            ['Số tiền cọc (VND)', w.depositAmount ? Number(w.depositAmount).toLocaleString() : null],
            ['Ngày nộp cọc', fmtDate(w.depositDate)],
            ['Ngày hoàn cọc', fmtDate(w.depositRefundedAt)],
            ['Ghi chú cọc', w.depositNote, { fullRow: true }],
          ],
        },
        {
          title: 'Trạng thái + Thị trường',
          fields: [
            ['Thị trường XKLĐ', MARKET_LABELS[w.market] ?? w.market],
            ['Trạng thái vòng đời', WORKER_STATUS_LABELS[w.status] ?? w.status],
            ['Ngày đồng ý tham gia', w.agreedAt ? new Date(w.agreedAt).toLocaleDateString('vi-VN') : null],
            ['Ngày tiếp nhận', fmtDate(w.recruitedAt)],
          ],
        },
      ];

      // Ngôn ngữ
      if (Array.isArray(w.languages) && w.languages.length > 0) {
        sections.push({
          title: `Ngoại ngữ (${w.languages.length})`,
          wide: true,
          fields: w.languages.map((l, i) => [
            `${i + 1}. ${l.code ?? l.language ?? '?'}`,
            `Trình độ: ${l.level ?? '?'}${l.certificate ? ` · Chứng chỉ: ${l.certificate}` : ''}`,
          ]),
        });
      }

      // Kinh nghiệm
      if (Array.isArray(w.experience) && w.experience.length > 0) {
        sections.push({
          title: `Kinh nghiệm làm việc (${w.experience.length})`,
          wide: true,
          fields: w.experience.map((e, i) => [
            `${i + 1}. ${e.company ?? '?'}`,
            `${e.fromYear ?? '?'}-${e.toYear ?? '?'} · ${e.position ?? ''}${e.responsibilities ? ' · ' + e.responsibilities : ''}`,
            { pre: true },
          ]),
        });
      }

      // Kỹ năng
      if (Array.isArray(w.skills) && w.skills.length > 0) {
        sections.push({
          title: `Kỹ năng (${w.skills.length})`,
          wide: true,
          fields: w.skills.map((s, i) => [
            `${i + 1}. ${s.name ?? '?'}`,
            `${s.yearsExp ?? '—'} năm · ${s.level ?? '?'}`,
          ]),
        });
      }

      // Notes
      if (w.notes) {
        sections.push({ title: 'Ghi chú', wide: true, fields: [['Nội dung', w.notes, { pre: true }]] });
      }
      if (w.healthNotes) {
        sections.push({ title: 'Ghi chú sức khoẻ', wide: true, fields: [['Nội dung', w.healthNotes, { pre: true }]] });
      }

      // ╔════ TẤT CẢ 53 FIELD LĐ ĐÃ ĐIỀN Ở FORM ════╗
      // Phần này render mọi field LĐ nhập trong sơ yếu lý lịch, đầy đủ
      // không lọc — nguồn truth = form-submissions collection.
      if (Array.isArray(extras.submissionFields) && extras.submissionFields.length > 0) {
        const labelMap = new Map((extras.formFields ?? []).filter((f) => f && f.name).map((f) => [f.name, f]));
        const optLabel = (field, val) => {
          if (!field || !field.options) return String(val ?? '');
          const o = field.options.find((x) => x.value === String(val));
          return o ? o.label : String(val ?? '');
        };
        sections.push({
          title: `📋 Toàn bộ form đăng ký (${extras.submissionFields.length} mục) — nộp ${extras.submittedAt ? new Date(extras.submittedAt).toLocaleString('vi-VN') : '?'}`,
          wide: true,
          fields: extras.submissionFields
            .filter((sd) => sd.value !== null && sd.value !== undefined && sd.value !== '')
            .map((sd) => {
              const f = labelMap.get(sd.field);
              const label = f?.label ?? sd.field;
              const val = optLabel(f, sd.value);
              const isLong = typeof val === 'string' && (val.includes('\n') || val.includes('<br>') || val.length > 80);
              return [label, val.replace(/<br\s*\/?>/gi, '\n'), isLong ? { pre: true } : undefined];
            }),
        });
      }

      return sections;
    },
    // Workers vẫn dùng list page riêng (Workers.jsx), không lấy columns ở đây
  },

  /* ─────────── Nghiệp vụ XKLĐ ─────────── */
  orders: {
    title: 'Đơn tuyển (Orders)',
    subtitle: 'Đơn YCTD từ đối tác nước ngoài',
    collection: 'orders',
    sort: '-orderDate',
    detailLayout: 'form',                                  // ← bật form layout
    formTitle: 'ĐƠN YÊU CẦU TUYỂN DỤNG (YCTD)',
    columns: [
      { key: 'orderCode', label: 'Mã đơn', render: (o) => <span className="font-mono text-blue-500">{o.orderCode ?? '—'}</span> },
      { key: 'partner', label: 'Đối tác', render: (o) => typeof o.partner === 'object' ? (o.partner?.name ?? '—') : '—' },
      { key: 'employer', label: 'Employer', render: (o) => o.employer ?? '—' },
      { key: 'position', label: 'Vị trí', render: (o) => o.position ?? '—' },
      { key: 'quantityNeeded', label: 'Số LĐ', align: 'right', render: (o) => o.quantityNeeded ?? '—' },
      { key: 'status', label: 'Bước', render: (o) => ORDER_STAGE_LABELS[o.status] ?? o.status ?? '—' },
      { key: 'deadline', label: 'Deadline', render: (o) => fmtDate(o.deadline) },
    ],
    headerSummary: (o) => {
      const partnerName = typeof o.partner === 'object' ? o.partner?.name : '';
      const subtitle = [partnerName, o.employer, o.position].filter(Boolean).join(' · ');
      const stageColor = ['w1','w2','w3','w4'].includes(o.status) ? 'blue'
                      : ['w5','w6','w7','w8'].includes(o.status) ? 'cyan'
                      : o.status === 'done' ? 'green'
                      : o.status === 'paused' ? 'amber'
                      : o.status === 'cancelled' ? 'red' : 'slate';
      return {
        title: o.orderCode ?? '(không có mã)',
        subtitle,
        badges: [
          { label: ORDER_STAGE_LABELS[o.status] ?? o.status ?? '?', color: stageColor },
          ...(o.market ? [{ label: (o.market ?? '').toUpperCase(), color: 'purple' }] : []),
        ],
      };
    },
    detailSections: (o) => {
      const partner = typeof o.partner === 'object' ? o.partner : null;
      const salaryRange = (o.salaryFrom || o.salaryTo)
        ? `${o.salaryFrom ? Number(o.salaryFrom).toLocaleString() : '—'} ~ ${o.salaryTo ? Number(o.salaryTo).toLocaleString() : '—'} ${o.currency ?? ''}`
        : null;
      const ageRange = (o.ageMin || o.ageMax)
        ? `${o.ageMin ?? '—'} ~ ${o.ageMax ?? '—'}`
        : null;

      // Edit metadata cho 1 field
      const E = (key, type, options) => ({ edit: { key, type, options } });
      const STATUS_OPTS = Object.entries(ORDER_STAGE_LABELS);
      const MARKET_OPTS = [['jp','🇯🇵 Nhật'],['kr','🇰🇷 Hàn'],['tw','🇹🇼 Đài'],['de','🇩🇪 Đức'],['me','Trung Đông'],['eu','EU'],['other','Khác']];
      const GENDER_OPTS = [['any','Cả 2'],['male','Nam'],['female','Nữ']];
      const CURRENCY_OPTS = [['JPY','JPY (¥)'],['KRW','KRW (₩)'],['USD','USD ($)'],['EUR','EUR (€)'],['TWD','TWD'],['VND','VND (đ)']];

      const sections = [
        {
          title: 'Thông tin đơn',
          fields: [
            ['Mã đơn', o.orderCode, { mono: true }],
            ['Bước workflow', ORDER_STAGE_LABELS[o.status] ?? o.status, E('status', 'select', STATUS_OPTS)],
            ['Thị trường', (o.market ?? '').toUpperCase(), E('market', 'select', MARKET_OPTS)],
            ['Ngày đặt đơn', fmtDate(o.orderDate), E('orderDate', 'date')],
            ['Deadline', fmtDate(o.deadline), E('deadline', 'date')],
            ['Dự kiến xuất cảnh', fmtDate(o.deploymentDate), E('deploymentDate', 'date')],
          ],
        },
        {
          title: 'Đối tác / Employer',
          fields: [
            ['Đối tác (Partner)', partner?.name],
            ['Country', (partner?.country ?? '').toUpperCase()],
            ['Employer', o.employer, E('employer', 'text')],
            ['Nước employer', (o.employerCountry ?? '').toUpperCase(), E('employerCountry', 'text')],
            ['Contact', o.employerContact, E('employerContact', 'text')],
            ['Email', o.employerEmail, E('employerEmail', 'text')],
            ['Broker agency', o.brokerAgency, E('brokerAgency', 'text')],
            ['Broker contact', o.brokerAgencyContact, E('brokerAgencyContact', 'text')],
          ],
        },
        {
          title: 'Vị trí + Yêu cầu',
          fields: [
            ['Vị trí', o.position, E('position', 'text')],
            ['Số LĐ cần', o.quantityNeeded, E('quantityNeeded', 'number')],
            ['Thời hạn HĐ (tháng)', o.contractDurationMonths, E('contractDurationMonths', 'number')],
            ['Giới tính', o.genderPreference, E('genderPreference', 'select', GENDER_OPTS)],
            ['Tuổi (min)', o.ageMin, E('ageMin', 'number')],
            ['Tuổi (max)', o.ageMax, E('ageMax', 'number')],
          ],
        },
        {
          title: 'Tài chính',
          fields: [
            ['Lương từ', o.salaryFrom ? Number(o.salaryFrom).toLocaleString() : null, E('salaryFrom', 'number')],
            ['Lương đến', o.salaryTo ? Number(o.salaryTo).toLocaleString() : null, E('salaryTo', 'number')],
            ['Tiền tệ', o.currency, E('currency', 'select', CURRENCY_OPTS)],
            ['Phí dịch vụ (VND)', o.serviceFee ? Number(o.serviceFee).toLocaleString() : null, E('serviceFee', 'number')],
            ['Cọc yêu cầu (VND)', o.depositRequired ? Number(o.depositRequired).toLocaleString() : null, E('depositRequired', 'number')],
          ],
        },
        {
          title: 'HĐ Cung ứng tham chiếu',
          fields: [
            ['Số HĐCU', o.contractNumber, { mono: true, edit: { key: 'contractNumber', type: 'text' } }],
            ['Ngày HĐCU', fmtDate(o.contractDate), E('contractDate', 'date')],
          ],
        },
      ];

      if (o.requirements) sections.push({ title: 'Yêu cầu chi tiết', wide: true, fields: [['', o.requirements, { pre: true }]] });
      if (o.benefits) sections.push({ title: 'Phúc lợi', wide: true, fields: [['', o.benefits, { pre: true }]] });
      if (Array.isArray(o.attributes) && o.attributes.length > 0) {
        sections.push({
          title: 'Thuộc tính bổ sung',
          wide: true,
          fields: o.attributes.map((a) => [a.key ?? '?', a.value ?? '—']),
        });
      }
      if (Array.isArray(o.orderDocuments) && o.orderDocuments.length > 0) {
        sections.push({
          title: `Tài liệu đơn (${o.orderDocuments.length})`,
          wide: true,
          fields: o.orderDocuments.map((d, i) => [
            `${i + 1}. ${d.kind ?? '(loại?)'}${d.notes ? ` — ${d.notes}` : ''}`,
            typeof d.file === 'object' ? (d.file?.filename ?? d.file?.id ?? '—') : (d.file ?? '—'),
            { mono: true },
          ]),
        });
      }
      if (o.notes) sections.push({ title: 'Ghi chú', wide: true, fields: [['', o.notes, { pre: true }]] });
      return sections;
    },
  },

  'supply-contracts': {
    title: 'HĐ Cung ứng (HĐCU)',
    subtitle: 'HĐ khung TLG ↔ Đối tác Nhật / nước ngoài',
    collection: 'supply-contracts',
    sort: '-signedDate',
    detailLayout: 'form',
    formTitle: 'HỢP ĐỒNG CUNG ỨNG LAO ĐỘNG',
    columns: [
      { key: 'contractNumber', label: 'Số HĐ', render: (c) => <span className="font-mono text-blue-500">{c.contractNumber ?? '—'}</span> },
      { key: 'partner', label: 'Đối tác', render: (c) => typeof c.partner === 'object' ? (c.partner?.name ?? '—') : '—' },
      { key: 'programType', label: 'CT', render: (c) => (c.programType ?? '—').toUpperCase() },
      { key: 'signedDate', label: 'Ký ngày', render: (c) => fmtDate(c.signedDate) },
      { key: 'cucApprovalStatus', label: 'Cục QLLĐNN', render: (c) => CUC_STATUS_LABELS[c.cucApprovalStatus] ?? c.cucApprovalStatus ?? '—' },
      { key: 'status', label: 'Trạng thái', render: (c) => c.status ?? '—' },
    ],
    headerSummary: (c) => {
      const partner = typeof c.partner === 'object' ? c.partner?.name : '';
      const cuc = CUC_STATUS_LABELS[c.cucApprovalStatus] ?? c.cucApprovalStatus;
      const cucColor = c.cucApprovalStatus === 'approved' ? 'green'
                    : c.cucApprovalStatus === 'rejected' ? 'red'
                    : c.cucApprovalStatus === 'pending' ? 'amber' : 'slate';
      return {
        title: c.contractNumber ?? '(không số)',
        subtitle: [partner, (c.programType ?? '').toUpperCase()].filter(Boolean).join(' · '),
        badges: [
          { label: c.status ?? '?', color: c.status === 'active' ? 'green' : 'slate' },
          ...(cuc ? [{ label: cuc, color: cucColor }] : []),
        ],
      };
    },
    detailSections: (c) => {
      const E = (key, type, options) => ({ edit: { key, type, options } });
      const partner = typeof c.partner === 'object' ? c.partner : null;
      const respEmp = typeof c.responsibleEmployee === 'object' ? c.responsibleEmployee : null;
      const PROG_OPTS = [['ttkn','TTKN'],['kndd','KNĐĐ'],['ldkt','LĐKT'],['other','Khác']];
      const STATUS_OPTS = [['active','✅ Đang hiệu lực'],['expired','⏰ Hết hạn'],['terminated','❌ Chấm dứt'],['superseded','📄 Đã ký lại']];
      const CUC_OPTS = Object.entries(CUC_STATUS_LABELS);

      const sections = [
        {
          title: 'Thông tin chung',
          fields: [
            ['Số HĐ', c.contractNumber, { mono: true, edit: { key: 'contractNumber', type: 'text' } }],
            ['Ngày ký', fmtDate(c.signedDate), E('signedDate', 'date')],
            ['Chương trình', (c.programType ?? '').toUpperCase(), E('programType', 'select', PROG_OPTS)],
            ['Trạng thái', c.status, E('status', 'select', STATUS_OPTS)],
            ['Ngày hiệu lực', fmtDate(c.effectiveDate), E('effectiveDate', 'date')],
            ['Ngày hết hạn', fmtDate(c.expiryDate), E('expiryDate', 'date')],
          ],
        },
        {
          title: 'Đối tác',
          fields: [
            ['Đối tác (Partner)', partner?.name],
            ['Country', (partner?.country ?? '').toUpperCase()],
            ['Đại diện', c.partnerRep?.name],
            ['Chức vụ', c.partnerRep?.position],
            ['Số GP giám lý', c.partnerLicenseNo, E('partnerLicenseNo', 'text')],
          ],
        },
        {
          title: 'Cục QLLĐNN',
          fields: [
            ['Trạng thái Cục', CUC_STATUS_LABELS[c.cucApprovalStatus] ?? c.cucApprovalStatus, E('cucApprovalStatus', 'select', CUC_OPTS)],
            ['Cán bộ phụ trách', respEmp?.fullName],
            ['Ngày đăng ký Cục', fmtDate(c.cucRegistrationDate), E('cucRegistrationDate', 'date')],
            ['Ngày Cục phản hồi', fmtDate(c.cucResponseDate), E('cucResponseDate', 'date')],
          ],
        },
        {
          title: 'Bên TLG',
          fields: [
            ['Đại diện', c.tlgRep?.name],
            ['Chức vụ', c.tlgRep?.position],
            ['Số GP XKLĐ', c.tlgLicenseNo, E('tlgLicenseNo', 'text')],
            ['Ngày cấp GP', fmtDate(c.tlgLicenseDate), E('tlgLicenseDate', 'date')],
          ],
        },
      ];

      if (c.terms) {
        sections.push({
          title: 'Điều khoản chính',
          fields: [
            ['Thời hạn (tháng)', c.terms.durationMonths],
            ['Giờ/tuần', c.terms.weeklyHours],
            ['Ngày phép/năm', c.terms.leaveDaysPerYear],
          ],
        });
        if (c.terms.salaryNote) sections.push({ title: 'Lương (mô tả)', wide: true, fields: [['', c.terms.salaryNote, { pre: true }]] });
        if (c.terms.serviceFeeNote) sections.push({ title: 'Phí dịch vụ', wide: true, fields: [['', c.terms.serviceFeeNote, { pre: true }]] });
        if (c.terms.additionalTerms) sections.push({ title: 'Điều khoản đặc biệt', wide: true, fields: [['', c.terms.additionalTerms, { pre: true }]] });
      }

      if (c.cucNotes) sections.push({ title: 'Ghi chú trao đổi với Cục', wide: true, fields: [['', c.cucNotes, { pre: true }]] });

      // Files
      const fileFields = [];
      if (c.media) fileFields.push(['File scan HĐ', mediaLink(c.media)]);
      if (c.cucApprovalDoc) fileFields.push(['Văn bản Cục QLLĐNN', mediaLink(c.cucApprovalDoc)]);
      if (fileFields.length > 0) sections.push({ title: 'Tệp đính kèm', wide: true, fields: fileFields });

      if (Array.isArray(c.addendums) && c.addendums.length > 0) {
        sections.push({
          title: `Phụ lục HĐ (${c.addendums.length})`,
          wide: true,
          fields: c.addendums.map((a, i) => [
            `${i + 1}. ${a.addendumNumber ?? 'PLHD'} (${fmtDate(a.signedDate)})`,
            <>
              {a.changes ? <div>{a.changes}</div> : null}
              {a.file ? <div>{mediaLink(a.file)}</div> : null}
              {!a.changes && !a.file && '—'}
            </>,
          ]),
        });
      }

      if (c.notes) sections.push({ title: 'Ghi chú nội bộ', wide: true, fields: [['', c.notes, { pre: true }]] });
      return sections;
    },
  },

  students: {
    title: 'Học viên',
    subtitle: 'Học viên đăng ký khoá tiếng Hàn / Nhật',
    collection: 'students',
    sort: '-createdAt',
    columns: [
      { key: 'fullName', label: 'Họ tên', render: (s) => <span className="font-semibold">{s.fullName ?? '—'}</span> },
      { key: 'courseType', label: 'Khoá', render: (s) => s.courseType === 'nhat' ? '🇯🇵 Nhật' : s.courseType === 'han' ? '🇰🇷 Hàn' : '—' },
      { key: 'phone', label: 'SĐT', render: (s) => s.phone ?? '—' },
      { key: 'province', label: 'Tỉnh/TP', render: (s) => s.province ?? '—' },
      { key: 'status', label: 'Trạng thái', render: (s) => s.status ?? '—' },
    ],
    headerSummary: (s) => ({
      title: s.fullName ?? s.id,
      subtitle: [s.courseType === 'nhat' ? '🇯🇵 Tiếng Nhật' : '🇰🇷 Tiếng Hàn', s.phone].filter(Boolean).join(' · '),
      badges: [{ label: s.status ?? '?', color: s.status === 'enrolled' ? 'green' : s.status === 'new' ? 'blue' : s.status === 'rejected' ? 'slate' : 'amber' }],
    }),
    detailSections: (s) => {
      const E = (key, type, options) => ({ edit: { key, type, options } });
      const LEVEL = { none: 'Chưa học', beginner: 'Sơ cấp', intermediate: 'Trung cấp', advanced: 'Cao cấp' };
      const GOAL = { communication: 'Giao tiếp', exam: 'Thi TOPIK/JLPT', study_abroad: 'Du học', work_abroad: 'Làm việc nước ngoài', xkld: 'XKLĐ', travel: 'Du lịch', other: 'Khác' };
      const TIME = { weekday_evening: 'Tối ngày thường', weekend: 'Cuối tuần' };
      const goals = Array.isArray(s.learningGoals) ? s.learningGoals.map(g => GOAL[g] ?? g).join(', ') : '';
      const times = Array.isArray(s.availableTimes) ? s.availableTimes.map(t => TIME[t] ?? t).join(', ') : '';
      return [
        {
          title: 'Thông tin cá nhân',
          fields: [
            ['Họ tên', s.fullName, E('fullName', 'text')],
            ['Khoá học', s.courseType === 'nhat' ? '🇯🇵 Tiếng Nhật' : '🇰🇷 Tiếng Hàn', E('courseType', 'select', [['nhat','🇯🇵 Tiếng Nhật'],['han','🇰🇷 Tiếng Hàn']])],
            ['Ngày sinh', fmtDate(s.dateOfBirth)],
            ['Giới tính', { male: 'Nam', female: 'Nữ', other: 'Khác', undisclosed: 'Không tiết lộ' }[s.gender] ?? '—'],
            ['SĐT', s.phone, E('phone', 'text')],
            ['Email', s.email, E('email', 'text')],
            ['Tỉnh/TP', s.province, E('province', 'text')],
            ['Nghề nghiệp', s.occupation, E('occupation', 'text')],
          ],
        },
        {
          title: 'Thông tin học tập',
          fields: [
            ['Trình độ hiện tại', LEVEL[s.koreanJapaneseLevel] ?? '—'],
            ['Mục tiêu học', goals],
            ['Mục tiêu khác', s.learningGoalOther],
            ['Hình thức học', { online: 'Online', offline: 'Offline', both: 'Đều được' }[s.studyMode] ?? '—'],
            ['Thiết bị', { computer: 'Máy tính', phone: 'Điện thoại', both: 'Cả hai', none: 'Chưa có' }[s.device] ?? '—'],
            ['Khung giờ học', times],
          ],
        },
        {
          title: 'Quản lý',
          fields: [
            ['Trạng thái', s.status, E('status', 'select', [['new','🆕 Mới'],['contacted','📞 Đã liên hệ'],['enrolled','✅ Đã nhập học'],['rejected','❌ Không học']])],
            ['Nguồn', { form: '📝 Form', manual: '👤 Tạo tay', telegram: '🤖 Telegram' }[s.source] ?? s.source],
            ['Biết đến qua', { facebook: 'Facebook', tiktok: 'TikTok', website: 'Website', referral: 'Bạn bè', zalo: 'Zalo', other: 'Khác' }[s.referralSource] ?? '—'],
            ['Ngày đăng ký', fmtDate(s.createdAt)],
          ],
        },
        ...(s.expectation ? [{ title: 'Mong muốn từ khoá học', wide: true, fields: [['', s.expectation, { pre: true }]] }] : []),
        ...(s.note ? [{ title: 'Ghi chú', wide: true, fields: [['', s.note, { pre: true, edit: { key: 'note', type: 'textarea' } }]] }] : []),
      ];
    },
  },

  'blog-posts': {
    title: 'Blog nội bộ',
    subtitle: 'Bài viết, chia sẻ, thông báo — phân theo phòng ban',
    collection: 'blog-posts',
    sort: '-publishedAt',
    columns: [
      { key: 'title', label: 'Tiêu đề', render: (b) => <span className="font-semibold">{b.title ?? '—'}</span> },
      { key: 'department', label: 'Phòng', render: (b) => b.department ?? '—' },
      { key: 'author', label: 'Tác giả', render: (b) => typeof b.author === 'object' ? (b.author?.displayName ?? b.author?.email ?? '—') : '—' },
      { key: 'status', label: 'Trạng thái', render: (b) => b.status ?? '—' },
      { key: 'publishedAt', label: 'Ngày đăng', render: (b) => b.publishedAt ? new Date(b.publishedAt).toLocaleDateString('vi-VN') : '—' },
    ],
  },

  users: {
    title: 'Người dùng',
    subtitle: 'Tài khoản đăng nhập portal & CMS — gán role để phân quyền',
    collection: 'users',
    sort: 'displayName',
    columns: [
      { key: 'displayName', label: 'Tên hiển thị', render: (u) => <span className="font-semibold">{u.displayName ?? '—'}</span> },
      { key: 'email', label: 'Email', render: (u) => <span className="font-mono text-xs text-blue-500">{u.email ?? '—'}</span> },
      { key: 'roleRef', label: 'Vai trò', render: (u) => typeof u.roleRef === 'object' ? (u.roleRef?.name ?? '—') : (u.role ?? '—') },
      { key: 'isActive', label: 'Hoạt động', render: (u) => u.isActive ? '✅' : '⏸' },
      { key: 'telegramUserId', label: 'Telegram ID', render: (u) => u.telegramUserId ?? '—' },
    ],
    headerSummary: (u) => ({
      title: u.displayName ?? u.email ?? u.id,
      subtitle: u.email,
      badges: [
        { label: typeof u.roleRef === 'object' ? (u.roleRef?.name ?? '—') : (u.role ?? '—'), color: 'blue' },
        { label: u.isActive ? '✅ Hoạt động' : '⏸ Tạm khoá', color: u.isActive ? 'green' : 'slate' },
      ],
    }),
    detailSections: (u) => {
      const E = (key, type, options) => ({ edit: { key, type, options } });
      return [
        {
          title: 'Thông tin tài khoản',
          fields: [
            ['Tên hiển thị', u.displayName, E('displayName', 'text')],
            ['Email', u.email, { mono: true }],
            ['Vai trò (legacy)', u.role],
            ['Vai trò (Role mới)', typeof u.roleRef === 'object' ? u.roleRef?.name : u.roleRef],
            ['Đang hoạt động', u.isActive ? '✅ Có' : '❌ Không'],
            ['Telegram User ID', u.telegramUserId, { mono: true, edit: { key: 'telegramUserId', type: 'text' } }],
          ],
        },
      ];
    },
  },

  roles: {
    title: 'Vai trò',
    subtitle: 'Phân quyền chi tiết theo collection × action — admin tạo & gán cho từng user',
    collection: 'roles',
    sort: 'name',
    columns: [
      { key: 'name', label: 'Tên vai trò', render: (r) => (
        <span className="font-semibold">
          {r.isSystem && <span className="mr-1 text-amber-500" title="Vai trò hệ thống">⛨</span>}
          {r.name ?? '—'}
        </span>
      ) },
      { key: 'description', label: 'Mô tả', render: (r) => <span className="text-slate-500 text-xs truncate inline-block max-w-[300px]">{r.description ?? '—'}</span> },
      { key: 'markets', label: 'Thị trường', render: (r) => Array.isArray(r.markets) && r.markets.length > 0 ? r.markets.map(m => m.toUpperCase()).join(', ') : 'Tất cả' },
      { key: 'isSystem', label: 'Hệ thống', render: (r) => r.isSystem ? '⛨' : '' },
    ],
  },

  offices: {
    title: 'Chi nhánh',
    subtitle: 'Chi nhánh / chi nhánh TLG — LĐ chọn trong form đăng ký',
    collection: 'offices',
    sort: 'name',
    columns: [
      { key: 'officeCode', label: 'Mã', render: (o) => <span className="font-mono text-blue-500">{o.officeCode ?? '—'}</span> },
      { key: 'name', label: 'Tên VP', render: (o) => <span className="font-semibold">{o.name ?? '—'}</span> },
      { key: 'country', label: 'Nước', render: (o) => (o.country ?? '—').toUpperCase() },
      { key: 'manager', label: 'Trưởng VP', render: (o) => typeof o.manager === 'object' ? (o.manager?.fullName ?? '—') : '—' },
      { key: 'phone', label: 'SĐT', render: (o) => o.phone ?? '—' },
      { key: 'active', label: 'Hoạt động', render: (o) => o.active ? '✅' : '⏸' },
    ],
    headerSummary: (o) => ({
      title: o.name ?? o.officeCode ?? o.id,
      subtitle: [o.officeCode, (o.country ?? '').toUpperCase()].filter(Boolean).join(' · '),
      badges: [{ label: o.active ? '✅ Hoạt động' : '⏸ Tạm ngưng', color: o.active ? 'green' : 'slate' }],
    }),
    detailSections: (o) => {
      const E = (key, type, options) => ({ edit: { key, type, options } });
      const COUNTRY_OPTS = [['vn','🇻🇳 Việt Nam'],['jp','🇯🇵 Nhật'],['kr','🇰🇷 Hàn'],['tw','🇹🇼 Đài'],['de','🇩🇪 Đức'],['other','Khác']];
      const managerEmp = typeof o.manager === 'object' ? o.manager : null;
      return [
        {
          title: 'Thông tin chung',
          fields: [
            ['Mã VP', o.officeCode, { mono: true }],
            ['Tên VP', o.name, E('name', 'text')],
            ['Nước', (o.country ?? '').toUpperCase(), E('country', 'select', COUNTRY_OPTS)],
            ['Hoạt động', o.active ? '✅ Có' : '❌ Không'],
          ],
        },
        {
          title: 'Liên hệ',
          fields: [
            ['SĐT', o.phone, E('phone', 'text')],
            ['Email', o.email, E('email', 'text')],
            ['Trưởng VP', managerEmp?.fullName],
          ],
        },
        {
          title: 'Địa chỉ',
          wide: true,
          fields: [['Trụ sở', o.address, { pre: true, edit: { key: 'address', type: 'textarea' } }]],
        },
        ...(o.notes ? [{ title: 'Ghi chú', wide: true, fields: [['', o.notes, { pre: true }]] }] : []),
      ];
    },
  },

  partners: {
    title: 'Đối tác',
    subtitle: 'Nghiệp đoàn / employer các thị trường',
    collection: 'partners',
    columns: [
      { key: 'name', label: 'Tên', render: (p) => <span className="font-semibold">{p.name ?? '—'}</span> },
      { key: 'country', label: 'Nước', render: (p) => (p.country ?? '—').toUpperCase() },
      { key: 'directorName', label: 'GĐ', render: (p) => p.directorName ?? '—' },
      { key: 'email', label: 'Email', render: (p) => p.email ?? '—' },
      { key: 'phone', label: 'SĐT', render: (p) => p.phone ?? '—' },
      { key: 'active', label: 'Hoạt động', render: (p) => p.active ? '✅' : '❌' },
    ],
    headerSummary: (p) => ({
      title: p.name ?? p.id,
      subtitle: [(p.country ?? '').toUpperCase(), p.industry].filter(Boolean).join(' · '),
      badges: [{ label: p.active ? '✅ Hoạt động' : '⏸ Tạm ngưng', color: p.active ? 'green' : 'slate' }],
    }),
    detailSections: (p) => {
      const E = (key, type, options) => ({ edit: { key, type, options } });
      const COUNTRY_OPTS = [['jp','🇯🇵 Nhật'],['kr','🇰🇷 Hàn'],['tw','🇹🇼 Đài'],['de','🇩🇪 Đức'],['other','Khác']];
      return [
        {
          title: 'Thông tin chung',
          fields: [
            ['Tên đầy đủ', p.name, E('name', 'text')],
            ['Tên rút gọn', p.shortName, E('shortName', 'text')],
            ['Nước', (p.country ?? '').toUpperCase(), E('country', 'select', COUNTRY_OPTS)],
            ['Ngành nghề', p.industry, E('industry', 'text')],
            ['Hoạt động', p.active ? '✅ Có' : '❌ Không'],
          ],
        },
        {
          title: 'Liên hệ',
          fields: [
            ['Giám đốc / Đại diện', p.directorName, E('directorName', 'text')],
            ['Email', p.email, E('email', 'text')],
            ['SĐT', p.phone, E('phone', 'text')],
            ['Website', p.website, E('website', 'text')],
          ],
        },
        {
          title: 'Địa chỉ',
          wide: true,
          fields: [['Trụ sở', p.address, { pre: true, edit: { key: 'address', type: 'textarea' } }]],
        },
        ...(p.notes ? [{ title: 'Ghi chú', wide: true, fields: [['', p.notes, { pre: true }]] }] : []),
      ];
    },
  },

  contracts: {
    title: 'HĐ Lao động (HĐLĐ)',
    subtitle: 'HĐ ký với từng LĐ qua employer',
    collection: 'contracts',
    sort: '-signingDate',
    detailLayout: 'form',
    formTitle: 'HỢP ĐỒNG LAO ĐỘNG',
    columns: [
      { key: 'contractCode', label: 'Mã HĐ', render: (c) => <span className="font-mono text-blue-500">{c.contractCode ?? '—'}</span> },
      { key: 'worker', label: 'LĐ', render: (c) => typeof c.worker === 'object' ? c.worker?.fullName ?? '—' : '—' },
      { key: 'signingDate', label: 'Ngày ký', render: (c) => fmtDate(c.signingDate) },
      { key: 'salary', label: 'Lương', align: 'right', render: (c) => c.salary ? `${(c.salary).toLocaleString()} ${c.currency ?? ''}` : '—' },
      { key: 'visaStatus', label: 'Visa', render: (c) => c.visaStatus ?? '—' },
      { key: 'coeReceivedAt', label: 'COE', render: (c) => fmtDate(c.coeReceivedAt) },
      { key: 'status', label: 'Trạng thái', render: (c) => c.status ?? '—' },
    ],
    headerSummary: (c) => {
      const worker = typeof c.worker === 'object' ? c.worker : null;
      const order = typeof c.order === 'object' ? c.order : null;
      return {
        title: c.contractCode ?? '(không mã)',
        subtitle: [worker?.fullName, order?.employer].filter(Boolean).join(' · '),
        badges: [
          { label: c.status ?? '?', color: c.status === 'deployed' ? 'cyan' : c.status === 'signed' ? 'green' : 'slate' },
          ...(c.visaStatus ? [{ label: 'Visa: ' + c.visaStatus, color: c.visaStatus === 'approved' ? 'green' : 'amber' }] : []),
        ],
      };
    },
    detailSections: (c) => {
      const E = (key, type, options) => ({ edit: { key, type, options } });
      const worker = typeof c.worker === 'object' ? c.worker : null;
      const order = typeof c.order === 'object' ? c.order : null;
      const VISA_OPTS = [['not_applied','Chưa nộp'],['submitted','📤 Đã nộp'],['processing','🕒 Đang xét'],['approved','✅ Đã cấp'],['rejected','❌ Bị từ chối']];
      const STATUS_OPTS = [['draft','📝 Nháp'],['signed','✅ Đã ký'],['visa_pending','🛂 Chờ visa'],['deployed','✈️ Đã xuất cảnh'],['completed','🏠 Đã về nước'],['terminated','⛔ Chấm dứt sớm']];
      const CURRENCY_OPTS = [['JPY','JPY (¥)'],['KRW','KRW (₩)'],['USD','USD ($)'],['EUR','EUR (€)'],['TWD','TWD'],['VND','VND (đ)']];

      const sections = [
        {
          title: 'Thông tin HĐ',
          fields: [
            ['Mã HĐ', c.contractCode, { mono: true }],
            ['Trạng thái', c.status, E('status', 'select', STATUS_OPTS)],
            ['LĐ', worker?.fullName],
            ['Mã LĐ', worker?.workerCode, { mono: true }],
            ['Đơn tuyển', order?.orderCode, { mono: true }],
            ['Employer', order?.employer],
          ],
        },
        {
          title: 'Thời hạn',
          fields: [
            ['Ngày ký', fmtDate(c.signingDate), E('signingDate', 'date')],
            ['Ngày bắt đầu HĐ', fmtDate(c.startDate), E('startDate', 'date')],
            ['Ngày kết thúc HĐ', fmtDate(c.endDate), E('endDate', 'date')],
            ['Ngày xuất cảnh thực tế', fmtDate(c.deploymentDate), E('deploymentDate', 'date')],
            ['Ngày dự kiến về', fmtDate(c.expectedReturnDate), E('expectedReturnDate', 'date')],
          ],
        },
        {
          title: 'Lương + phí',
          fields: [
            ['Lương cơ bản', c.salary ? Number(c.salary).toLocaleString() : null, E('salary', 'number')],
            ['Tiền tệ', c.currency, E('currency', 'select', CURRENCY_OPTS)],
            ['Phí dịch vụ (VND)', c.serviceFee ? Number(c.serviceFee).toLocaleString() : null, E('serviceFee', 'number')],
            ['Đã đặt cọc (VND)', c.depositPaid ? Number(c.depositPaid).toLocaleString() : null, E('depositPaid', 'number')],
            ['Còn nợ (VND)', c.owedAmount ? Number(c.owedAmount).toLocaleString() : null],
          ],
        },
        {
          title: 'Visa + COE',
          fields: [
            ['Trạng thái visa', c.visaStatus, E('visaStatus', 'select', VISA_OPTS)],
            ['Ngày nộp visa', fmtDate(c.visaSubmittedAt), E('visaSubmittedAt', 'date')],
            ['Ngày được cấp visa', fmtDate(c.visaApprovedAt), E('visaApprovedAt', 'date')],
            ['Ngày yêu cầu COE', fmtDate(c.coeRequestedAt), E('coeRequestedAt', 'date')],
            ['Ngày nhận COE', fmtDate(c.coeReceivedAt), E('coeReceivedAt', 'date')],
          ],
        },
        {
          title: 'Vé bay',
          fields: [
            ['Số hiệu chuyến bay', c.flightNumber, E('flightNumber', 'text')],
            ['Nơi đến (sân bay)', c.destination, E('destination', 'text')],
          ],
        },
      ];

      if (c.benefits) sections.push({ title: 'Quyền lợi (snapshot)', wide: true, fields: [['', c.benefits, { pre: true }]] });

      // Files
      const fileFields = [];
      if (c.contractFile) fileFields.push(['Bản HĐLĐ (PDF)', mediaLink(c.contractFile)]);
      if (c.visaFile) fileFields.push(['Visa scan', mediaLink(c.visaFile)]);
      if (c.coeFile) fileFields.push(['COE / EPS', mediaLink(c.coeFile)]);
      if (c.flightTicketFile) fileFields.push(['Vé máy bay', mediaLink(c.flightTicketFile)]);
      if (Array.isArray(c.otherDocuments) && c.otherDocuments.length > 0) {
        c.otherDocuments.forEach((d, i) => fileFields.push([
          `${d.kind ?? 'Tài liệu'} ${i + 1}`,
          mediaLink(d.file),
        ]));
      }
      if (fileFields.length > 0) sections.push({ title: 'Tệp đính kèm', wide: true, fields: fileFields });

      if (Array.isArray(c.feeBreakdown) && c.feeBreakdown.length > 0) {
        sections.push({
          title: `Bóc tách phí (${c.feeBreakdown.length})`,
          wide: true,
          fields: c.feeBreakdown.map((f, i) => [
            `${i + 1}. ${f.kind ?? '?'}`,
            f.amount ? Number(f.amount).toLocaleString() + ' VND' : '—',
          ]),
        });
      }
      if (Array.isArray(c.payments) && c.payments.length > 0) {
        sections.push({
          title: `Lịch sử thanh toán (${c.payments.length})`,
          wide: true,
          fields: c.payments.map((p, i) => [
            `${i + 1}. ${fmtDate(p.date)} (${p.method ?? '?'})`,
            p.amount ? Number(p.amount).toLocaleString() + ' VND' : '—',
          ]),
        });
      }
      if (c.notes) sections.push({ title: 'Ghi chú', wide: true, fields: [['', c.notes, { pre: true }]] });
      return sections;
    },
  },

  /* ─────────── Hành chính ─────────── */
  'official-documents': {
    title: 'Công văn',
    subtitle: 'Công văn đến / đi / nội bộ — Phòng Hành chính',
    collection: 'official-documents',
    sort: '-issuedDate',
    detailLayout: 'form',
    formTitle: 'CÔNG VĂN',
    showSignatures: false,
    headerSummary: (d) => ({
      title: d.documentCode ?? d.id,
      subtitle: d.title,
      badges: [
        ...(d.direction ? [{ label: DOC_DIRECTION[d.direction] ?? d.direction, color: d.direction === 'incoming' ? 'blue' : d.direction === 'outgoing' ? 'cyan' : 'slate' }] : []),
        ...(d.status ? [{ label: DOC_STATUS[d.status] ?? d.status, color: d.status === 'completed' ? 'green' : d.status === 'processing' ? 'amber' : 'slate' }] : []),
      ],
    }),
    detailSections: (d) => {
      const E = (key, type, options) => ({ edit: { key, type, options } });
      const DIR_OPTS = Object.entries(DOC_DIRECTION);
      const STATUS_OPTS = Object.entries(DOC_STATUS);
      const sections = [
        {
          title: 'Thông tin chung',
          fields: [
            ['Mã CV', d.documentCode, { mono: true }],
            ['Hướng', DOC_DIRECTION[d.direction] ?? d.direction, E('direction', 'select', DIR_OPTS)],
            ['Loại văn bản', d.documentType, E('documentType', 'text')],
            ['Ưu tiên', d.priority, E('priority', 'text')],
            ['Trạng thái', DOC_STATUS[d.status] ?? d.status, E('status', 'select', STATUS_OPTS)],
            ['Ngày ban hành', fmtDate(d.issuedDate), E('issuedDate', 'date')],
          ],
        },
        {
          title: 'Tiêu đề',
          wide: true,
          fields: [['Title', d.title, { edit: { key: 'title', type: 'text' } }]],
        },
        {
          title: 'Đơn vị liên quan',
          fields: [
            ['Đơn vị ban hành', d.issuingAuthority, E('issuingAuthority', 'text')],
            ['Nơi nhận', d.recipient, E('recipient', 'text')],
            ['Số văn bản gốc', d.officialNumber, E('officialNumber', 'text')],
          ],
        },
        {
          title: 'Xử lý',
          fields: [
            ['Người được giao', typeof d.assignedTo === 'object' ? d.assignedTo?.fullName : null],
            ['Hạn xử lý', fmtDate(d.deadline), E('deadline', 'date')],
            ['Hoàn thành lúc', fmtDate(d.completedAt), E('completedAt', 'date')],
          ],
        },
      ];
      if (d.summary) sections.push({ title: 'Tóm tắt', wide: true, fields: [['', d.summary, { pre: true, edit: { key: 'summary', type: 'textarea' } }]] });
      if (d.content) sections.push({ title: 'Nội dung', wide: true, fields: [['', d.content, { pre: true }]] });

      // Files
      const fileFields = [];
      if (d.scanFile) fileFields.push(['File scan / PDF chính', mediaLink(d.scanFile)]);
      if (Array.isArray(d.attachments) && d.attachments.length > 0) {
        d.attachments.forEach((att, i) => fileFields.push([`Phụ lục ${i + 1}`, mediaLink(att)]));
      }
      if (fileFields.length > 0) sections.push({ title: 'Tệp đính kèm', wide: true, fields: fileFields });

      if (d.notes) sections.push({ title: 'Ghi chú', wide: true, fields: [['', d.notes, { pre: true, edit: { key: 'notes', type: 'textarea' } }]] });
      return sections;
    },
    columns: [
      { key: 'documentCode', label: 'Mã CV', render: (d) => <span className="font-mono text-blue-500">{d.documentCode ?? '—'}</span> },
      { key: 'direction', label: 'Hướng', render: (d) => DOC_DIRECTION[d.direction] ?? d.direction ?? '—' },
      { key: 'title', label: 'Tiêu đề', render: (d) => <span className="font-semibold">{d.title ?? '—'}</span> },
      { key: 'issuedDate', label: 'Ngày', render: (d) => fmtDate(d.issuedDate) },
      { key: 'issuingAuthority', label: 'Đơn vị', render: (d) => d.issuingAuthority ?? d.recipient ?? '—' },
      { key: 'status', label: 'Trạng thái', render: (d) => DOC_STATUS[d.status] ?? d.status ?? '—' },
    ],
  },

  employees: {
    title: 'Nhân sự nội bộ',
    subtitle: 'Hồ sơ HR — nhân viên Thịnh Long',
    collection: 'employees',
    columns: [
      { key: 'employeeCode', label: 'Mã NV', render: (e) => <span className="font-mono text-blue-500">{e.employeeCode ?? '—'}</span> },
      { key: 'fullName', label: 'Họ tên', render: (e) => e.fullName ?? '—' },
      { key: 'department', label: 'Phòng', render: (e) => EMP_DEPT[e.department] ?? e.department ?? '—' },
      { key: 'position', label: 'Chức vụ', render: (e) => e.position ?? '—' },
      { key: 'phone', label: 'SĐT', render: (e) => e.phone ?? '—' },
      { key: 'status', label: 'Trạng thái', render: (e) => e.status ?? '—' },
    ],
    headerSummary: (e) => ({
      title: e.fullName ?? e.employeeCode ?? e.id,
      subtitle: [e.employeeCode, EMP_DEPT[e.department] ?? e.department, e.position].filter(Boolean).join(' · '),
      badges: [{ label: e.status ?? '?', color: e.status === 'working' ? 'green' : 'slate' }],
    }),
    detailSections: (e) => {
      const E = (key, type, options) => ({ edit: { key, type, options } });
      const DEPT_OPTS = Object.entries(EMP_DEPT);
      const STATUS_OPTS = [['working','✅ Đang làm việc'],['long_leave','🌴 Nghỉ phép dài'],['maternity','🤰 Thai sản'],['resigned','📤 Đã nghỉ'],['fired','❌ Sa thải'],['suspended','⏸ Tạm hoãn']];
      const sections = [
        {
          title: 'Hồ sơ cơ bản',
          fields: [
            ['Mã NV', e.employeeCode, { mono: true }],
            ['Họ tên', e.fullName, E('fullName', 'text')],
            ['Ngày sinh', fmtDate(e.dateOfBirth), E('dateOfBirth', 'date')],
            ['Giới tính', e.gender],
            ['CCCD/CMND', e.idNumber, E('idNumber', 'text')],
            ['SĐT', e.phone, E('phone', 'text')],
            ['Email cá nhân', e.email, E('email', 'text')],
            ['Telegram User ID', e.telegramUserId, { mono: true }],
          ],
        },
        {
          title: 'Công việc',
          fields: [
            ['Phòng ban', EMP_DEPT[e.department] ?? e.department, E('department', 'select', DEPT_OPTS)],
            ['Chức vụ', e.position, E('position', 'text')],
            ['Trạng thái', e.status, E('status', 'select', STATUS_OPTS)],
            ['Ngày vào làm', fmtDate(e.hireDate), E('hireDate', 'date')],
            ['Loại HĐLĐ', e.contractType, E('contractType', 'text')],
            ['Hết hạn HĐ', fmtDate(e.contractEndDate), E('contractEndDate', 'date')],
            ['Lương (VND/tháng)', e.salary ? Number(e.salary).toLocaleString() : null, E('salary', 'number')],
          ],
        },
        ...(e.address ? [{ title: 'Địa chỉ', wide: true, fields: [['Thường trú', e.address, { pre: true, edit: { key: 'address', type: 'textarea' } }]] }] : []),
      ];
      if (Array.isArray(e.workHistory) && e.workHistory.length > 0) {
        sections.push({
          title: `Lịch sử công tác (${e.workHistory.length})`,
          wide: true,
          fields: e.workHistory.map((h, i) => [
            `${i + 1}. ${h.company ?? '?'}`,
            `${h.position ?? ''} · ${h.fromTo ?? ''}`,
          ]),
        });
      }
      if (Array.isArray(e.achievements) && e.achievements.length > 0) {
        sections.push({
          title: `Khen thưởng - Kỷ luật (${e.achievements.length})`,
          wide: true,
          fields: e.achievements.map((a, i) => [
            `${i + 1}. ${a.title ?? '?'} (${fmtDate(a.date)})`,
            a.description ?? a.type ?? '—',
          ]),
        });
      }
      if (Array.isArray(e.extraFields) && e.extraFields.length > 0) {
        sections.push({
          title: 'Thông tin bổ sung',
          wide: true,
          fields: e.extraFields.map((x) => [x.key ?? '?', x.value ?? '—']),
        });
      }
      if (e.notes) sections.push({ title: 'Ghi chú', wide: true, fields: [['', e.notes, { pre: true, edit: { key: 'notes', type: 'textarea' } }]] });
      return sections;
    },
  },

  reminders: {
    title: 'Nhắc việc',
    subtitle: 'Reminder cho nhân viên + LĐ',
    collection: 'reminders',
    sort: '-dueAt',
    columns: [
      { key: 'title', label: 'Tiêu đề', render: (r) => <span className="font-semibold">{r.title ?? '—'}</span> },
      { key: 'dueAt', label: 'Hạn', render: (r) => fmtDate(r.dueAt) },
      { key: 'recipientType', label: 'Đối tượng', render: (r) => r.recipientType ?? '—' },
      { key: 'status', label: 'Trạng thái', render: (r) => REMIND_STATUS[r.status] ?? r.status ?? '—' },
    ],
  },

  calendars: {
    title: 'Lịch họp / Sự kiện',
    subtitle: 'Lịch họp, đào tạo, phỏng vấn',
    collection: 'calendars',
    sort: '-startAt',
    columns: [
      { key: 'title', label: 'Tiêu đề', render: (c) => <span className="font-semibold">{c.title ?? '—'}</span> },
      { key: 'eventType', label: 'Loại', render: (c) => c.eventType ?? '—' },
      { key: 'startAt', label: 'Bắt đầu', render: (c) => fmtDate(c.startAt) },
      { key: 'endAt', label: 'Kết thúc', render: (c) => fmtDate(c.endAt) },
      { key: 'location', label: 'Địa điểm', render: (c) => c.location ?? c.meetingLink ?? '—' },
      { key: 'status', label: 'Trạng thái', render: (c) => c.status ?? '—' },
    ],
  },

  assets: {
    title: 'Tài sản',
    subtitle: 'Thiết bị, xe, máy móc — TLG quản lý nội bộ',
    collection: 'assets',
    sort: '-purchaseDate',
    columns: [
      { key: 'assetCode', label: 'Mã TS', render: (a) => <span className="font-mono text-blue-500">{a.assetCode ?? '—'}</span> },
      { key: 'name', label: 'Tên', render: (a) => a.name ?? '—' },
      { key: 'category', label: 'Loại', render: (a) => a.category ?? '—' },
      { key: 'status', label: 'Tình trạng', render: (a) => a.status ?? '—' },
      { key: 'assignedTo', label: 'Giao cho', render: (a) => typeof a.assignedTo === 'object' ? (a.assignedTo?.fullName ?? '—') : '—' },
      { key: 'purchaseValue', label: 'Giá trị', align: 'right', render: (a) => fmtVND(a.purchaseValue) },
      { key: 'location', label: 'Vị trí', render: (a) => a.location ?? '—' },
    ],
    headerSummary: (a) => ({
      title: a.name ?? a.assetCode ?? a.id,
      subtitle: [a.assetCode, a.category].filter(Boolean).join(' · '),
      badges: [{ label: a.status ?? '?', color: a.status === 'in_use' ? 'green' : a.status === 'broken' ? 'red' : 'slate' }],
    }),
    detailSections: (a) => {
      const E = (key, type, options) => ({ edit: { key, type, options } });
      const assignedEmp = typeof a.assignedTo === 'object' ? a.assignedTo : null;
      const sections = [
        {
          title: 'Thông tin TS',
          fields: [
            ['Mã TS', a.assetCode, { mono: true }],
            ['Tên', a.name, E('name', 'text')],
            ['Loại', a.category, E('category', 'text')],
            ['Số lượng', a.quantity, E('quantity', 'number')],
            ['Tình trạng', a.status, E('status', 'text')],
            ['Serial / Số khung', a.serialNumber, { mono: true, edit: { key: 'serialNumber', type: 'text' } }],
          ],
        },
        {
          title: 'Tài chính',
          fields: [
            ['Ngày mua', fmtDate(a.purchaseDate), E('purchaseDate', 'date')],
            ['Đơn giá (VND)', a.purchaseValue ? Number(a.purchaseValue).toLocaleString() : null, E('purchaseValue', 'number')],
            ['Bảo hành đến', fmtDate(a.warrantyUntil), E('warrantyUntil', 'date')],
          ],
        },
        {
          title: 'Sử dụng',
          fields: [
            ['Đang giao cho', assignedEmp?.fullName],
            ['Vị trí', a.location, E('location', 'text')],
          ],
        },
      ];
      if (Array.isArray(a.maintenanceLog) && a.maintenanceLog.length > 0) {
        sections.push({
          title: `Lịch sử bảo trì (${a.maintenanceLog.length})`,
          wide: true,
          fields: a.maintenanceLog.map((m, i) => [
            `${i + 1}. ${fmtDate(m.date)} · ${m.kind ?? ''}`,
            `${m.description ?? '—'}${m.cost ? ` · ${Number(m.cost).toLocaleString()} VND` : ''}`,
          ]),
        });
      }
      if (a.notes) sections.push({ title: 'Ghi chú', wide: true, fields: [['', a.notes, { pre: true, edit: { key: 'notes', type: 'textarea' } }]] });
      return sections;
    },
  },

  media: {
    title: 'Tệp tin (Media)',
    subtitle: 'Toàn bộ file lưu trữ — HĐ scan, ảnh, công văn, CV',
    collection: 'media',
    sort: '-uploadedAt',
    columns: [
      { key: 'filename', label: 'Tên file', render: (m) => <span className="font-mono text-xs text-blue-500 truncate inline-block max-w-[250px]">{m.filename ?? '—'}</span> },
      { key: 'kind', label: 'Loại', render: (m) => m.kind ?? '—' },
      { key: 'alt', label: 'Mô tả', render: (m) => <span className="truncate inline-block max-w-[220px]">{m.alt ?? '—'}</span> },
      { key: 'filesize', label: 'KB', align: 'right', render: (m) => m.filesize ? Math.round(m.filesize / 1024).toLocaleString() : '—' },
      { key: 'uploadedFrom', label: 'Nguồn', render: (m) => m.uploadedFrom ?? '—' },
      { key: 'uploadedAt', label: 'Tải lên', render: (m) => fmtDate(m.uploadedAt) },
    ],
  },

  forms: {
    title: 'Form & Lời mời',
    subtitle: 'Link form khách hàng / LĐ điền online',
    collection: 'form-invites',
    sort: '-createdAt',
    columns: [
      { key: 'title', label: 'Tiêu đề', render: (f) => <span className="font-semibold">{f.title ?? '—'}</span> },
      { key: 'token', label: 'Token', render: (f) => <span className="font-mono text-xs">{f.token ?? '—'}</span> },
      { key: 'status', label: 'Trạng thái', render: (f) => f.status ?? '—' },
      { key: 'expiresAt', label: 'Hết hạn', render: (f) => fmtDate(f.expiresAt) },
      { key: 'submittedAt', label: 'Đã submit', render: (f) => fmtDate(f.submittedAt) },
    ],
  },

  /* ─────────── Telegram ─────────── */
  agents: {
    title: 'AI Agents',
    subtitle: '13 agent đang vận hành (3 HC + 10 phòng Nhật)',
    collection: 'agents',
    sort: 'name',
    columns: [
      { key: 'name', label: 'Mã agent', render: (a) => <span className="font-mono text-blue-500">{a.name ?? '—'}</span> },
      { key: 'displayName', label: 'Tên hiển thị', render: (a) => <span className="font-semibold">{a.displayName ?? '—'}</span> },
      { key: 'shortDescription', label: 'Mô tả', render: (a) => <span className="text-slate-500">{a.shortDescription ?? '—'}</span> },
      { key: 'active', label: 'Hoạt động', render: (a) => a.active ? '✅' : '⏸' },
    ],
  },

  'telegram-topics': {
    title: 'Telegram Topics',
    subtitle: 'Mapping topic ↔ agent (group phòng JP có 10 topic)',
    collection: 'telegram-topics',
    columns: [
      { key: 'topicId', label: 'Topic ID', render: (t) => <span className="font-mono">{t.topicId ?? '—'}</span> },
      { key: 'telegramGroup', label: 'Group', render: (t) => typeof t.telegramGroup === 'object' ? (t.telegramGroup?.title ?? t.telegramGroup?.telegramChatId ?? '—') : '—' },
      { key: 'agent', label: 'Agent', render: (t) => typeof t.agent === 'object' ? (t.agent?.displayName ?? t.agent?.name ?? '—') : '—' },
    ],
  },

  'telegram-groups': {
    title: 'Telegram Groups',
    subtitle: 'Các nhóm Telegram bot đang phục vụ',
    collection: 'telegram-groups',
    columns: [
      { key: 'title', label: 'Tên nhóm', render: (g) => <span className="font-semibold">{g.title ?? '—'}</span> },
      { key: 'telegramChatId', label: 'Chat ID', render: (g) => <span className="font-mono">{g.telegramChatId ?? '—'}</span> },
      { key: 'type', label: 'Kiểu', render: (g) => g.type ?? '—' },
      { key: 'memberCount', label: 'Thành viên', align: 'right', render: (g) => g.memberCount ?? '—' },
    ],
  },
};
