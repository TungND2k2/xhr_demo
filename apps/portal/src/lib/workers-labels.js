export const WORKER_STATUS_LABELS = {
  new: '🆕 Mới đăng ký',
  researching: '🔍 Đang tìm hiểu',
  agreed: '✋ Đồng ý',
  health_check: '🏥 Khám SK',
  deposit_paid: '💰 Đã đặt cọc',
  training: '🎓 Đang đào tạo',
  exam: '🎯 Đang thi',
  passed: '✅ Đỗ — sẵn sàng',
  failed: '❌ Trượt',
  contracted: '📝 Đã ký HĐ',
  visa_prep: '🛂 Đang xin visa',
  deployed: '✈️ Đã xuất cảnh',
  working: '💼 Đang làm việc',
  returned: '🏠 Đã về nước',
  liquidated: '📑 Đã thanh lý HĐ',
  escaped: '🏃 Bỏ trốn',
  paused: '⏸ Khoá tạm',
  blacklisted: '🚫 Blacklist',
};

export const MARKET_LABELS = {
  jp: '🇯🇵 Nhật Bản',
  kr: '🇰🇷 Hàn Quốc',
  tw: '🇹🇼 Đài Loan',
  de: '🇩🇪 Đức',
  qa: '🇶🇦 Qatar',
  me: '🇸🇦 Trung Đông khác',
  eu: '🇪🇺 EU khác',
  other: 'Khác',
};

export const CUC_STATUS_LABELS = {
  not_required: '— Không yêu cầu',
  not_submitted: '📝 Chưa đăng ký',
  pending: '⏳ Chờ Cục phản hồi',
  approved: '✅ Cục chấp thuận',
  rejected: '❌ Cục từ chối',
  needs_revision: '🔄 Cục yêu cầu bổ sung',
};

export const ORDER_STAGE_LABELS = {
  w1: 'W1 Tuyển',
  w2: 'W2 Khám SK',
  w3: 'W3 Đào tạo',
  w4: 'W4 PV đối tác',
  w5: 'W5 Ký HĐ',
  w6: 'W6 Visa',
  w7: 'W7 Xuất cảnh',
  w8: 'W8 Tại Nhật',
  done: '✅ Xong',
  paused: '⏸ Tạm dừng',
  cancelled: '❌ Huỷ',
};

export function fmtVND(amount) {
  if (amount == null || amount === 0) return '—';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(0)} tr`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)} k`;
  return String(amount);
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
