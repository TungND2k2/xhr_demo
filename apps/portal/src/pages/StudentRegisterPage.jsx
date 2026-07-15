import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, AlertCircle, Loader2, GraduationCap } from 'lucide-react';
import { createDoc } from '../api/payload';

/**
 * StudentRegisterPage — form đăng ký học viên CÔNG KHAI (không cần login).
 * Truy cập qua link/QR. Chọn khoá Nhật/Hàn → nội dung thích ứng.
 */

const GOALS = [
  { value: 'communication', label: 'Giao tiếp' },
  { value: 'exam', label: 'Thi TOPIK/JLPT' },
  { value: 'study_abroad', label: 'Du học' },
  { value: 'work_abroad', label: 'Làm việc tại Hàn Quốc/Nhật Bản' },
  { value: 'xkld', label: 'Xuất khẩu lao động' },
  { value: 'travel', label: 'Du lịch' },
  { value: 'other', label: 'Khác' },
];
const TIMES = [
  { value: 'weekday_evening', label: 'Ngày thường - Tối (18:00–20:00)' },
  { value: 'weekend', label: 'Cuối tuần' },
];

export default function StudentRegisterPage() {
  const [courseType, setCourseType] = useState('');
  const [v, setV] = useState({
    fullName: '', dateOfBirth: '', gender: '', phone: '', email: '',
    province: '', occupation: '', koreanJapaneseLevel: '',
    learningGoalOther: '', studyMode: '', device: '',
    referralSource: '', expectation: '', note: '',
  });
  const [goals, setGoals] = useState([]);
  const [times, setTimes] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const lang = courseType === 'han' ? 'Hàn' : courseType === 'nhat' ? 'Nhật' : '';
  const exam = courseType === 'han' ? 'TOPIK' : courseType === 'nhat' ? 'JLPT' : 'TOPIK/JLPT';
  const country = courseType === 'han' ? 'Hàn Quốc' : courseType === 'nhat' ? 'Nhật Bản' : 'Hàn Quốc/Nhật Bản';

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const toggleArr = (arr, setArr, val) => setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!courseType) { setError('Vui lòng chọn khoá học'); return; }
    if (!v.fullName.trim() || !v.phone.trim() || !v.email.trim() || !v.province.trim() || !v.koreanJapaneseLevel) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc (*)');
      return;
    }
    if (!confirmed) { setError('Vui lòng xác nhận thông tin chính xác'); return; }
    setBusy(true);
    try {
      await createDoc('students', {
        courseType,
        fullName: v.fullName.trim(),
        dateOfBirth: v.dateOfBirth || undefined,
        gender: v.gender || undefined,
        phone: v.phone.trim(),
        email: v.email.trim(),
        province: v.province.trim(),
        occupation: v.occupation || undefined,
        koreanJapaneseLevel: v.koreanJapaneseLevel,
        learningGoals: goals,
        learningGoalOther: v.learningGoalOther || undefined,
        studyMode: v.studyMode || undefined,
        device: v.device || undefined,
        availableTimes: times,
        referralSource: v.referralSource || undefined,
        expectation: v.expectation || undefined,
        note: v.note || undefined,
        source: 'form',
        status: 'new',
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mx-auto mb-4">
            <Check size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">Đăng ký thành công!</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Cảm ơn bạn đã đăng ký khoá học <strong>tiếng {lang}</strong> tại Thịnh Long Group.
            Cán bộ tư vấn sẽ liên hệ với bạn trong vòng 24h qua số điện thoại đã cung cấp.
          </p>
        </motion.div>
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40';
  const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';
  const req = <span className="text-red-500"> *</span>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <img src="/logo.png" alt="TLG" className="h-12 w-auto" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">Đăng ký khoá học tiếng Hàn / Nhật</h1>
          <p className="text-sm text-slate-500 mt-2">Thịnh Long Group — Vui lòng điền thông tin, cán bộ tư vấn sẽ liên hệ trong 24h.</p>
        </div>

        <form onSubmit={submit} className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 md:p-8 space-y-8">
          {/* Chọn khoá học */}
          <div>
            <label className={labelCls}>Bạn muốn đăng ký khoá nào?{req}</label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {[{ v: 'nhat', flag: '🇯🇵', name: 'Tiếng Nhật' }, { v: 'han', flag: '🇰🇷', name: 'Tiếng Hàn' }].map((c) => (
                <button
                  type="button"
                  key={c.v}
                  onClick={() => setCourseType(c.v)}
                  className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 font-bold transition-all ${courseType === c.v ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-500/40'}`}
                >
                  <span className="text-2xl">{c.flag}</span> {c.name}
                </button>
              ))}
            </div>
          </div>

          {courseType && (
            <>
              {/* Phần 1 */}
              <Section title="Phần 1: Thông tin cá nhân" icon={GraduationCap}>
                <div>
                  <label className={labelCls}>Họ và tên{req}</label>
                  <input className={inputCls} value={v.fullName} onChange={set('fullName')} placeholder="Nguyễn Văn A" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Ngày sinh</label>
                    <input type="date" className={inputCls} value={v.dateOfBirth} onChange={set('dateOfBirth')} />
                  </div>
                  <div>
                    <label className={labelCls}>Giới tính</label>
                    <select className={inputCls} value={v.gender} onChange={set('gender')}>
                      <option value="">— Chọn —</option>
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                      <option value="undisclosed">Không muốn tiết lộ</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Số điện thoại{req}</label>
                    <input className={inputCls} value={v.phone} onChange={set('phone')} placeholder="09xxxxxxxx" />
                  </div>
                  <div>
                    <label className={labelCls}>Email{req}</label>
                    <input type="email" className={inputCls} value={v.email} onChange={set('email')} placeholder="email@example.com" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Tỉnh / Thành phố{req}</label>
                    <input className={inputCls} value={v.province} onChange={set('province')} placeholder="Hà Nội" />
                  </div>
                  <div>
                    <label className={labelCls}>Nghề nghiệp</label>
                    <input className={inputCls} value={v.occupation} onChange={set('occupation')} placeholder="Sinh viên / Công nhân..." />
                  </div>
                </div>
              </Section>

              {/* Phần 2 */}
              <Section title="Phần 2: Thông tin học tập">
                <div>
                  <label className={labelCls}>Bạn đã từng học tiếng {lang} chưa?{req}</label>
                  <select className={inputCls} value={v.koreanJapaneseLevel} onChange={set('koreanJapaneseLevel')}>
                    <option value="">— Chọn —</option>
                    <option value="none">Chưa từng học</option>
                    <option value="beginner">Đã học sơ cấp</option>
                    <option value="intermediate">Đã học trung cấp</option>
                    <option value="advanced">Đã học cao cấp</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Mục tiêu học tiếng {lang} (chọn nhiều)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {GOALS.map((g) => (
                      <Chk key={g.value} checked={goals.includes(g.value)} onChange={() => toggleArr(goals, setGoals, g.value)}
                        label={g.value === 'exam' ? `Thi ${exam}` : g.value === 'work_abroad' ? `Làm việc tại ${country}` : g.label} />
                    ))}
                  </div>
                  {goals.includes('other') && (
                    <input className={`${inputCls} mt-2`} value={v.learningGoalOther} onChange={set('learningGoalOther')} placeholder="Mục tiêu khác..." />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Hình thức học</label>
                    <select className={inputCls} value={v.studyMode} onChange={set('studyMode')}>
                      <option value="">— Chọn —</option>
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                      <option value="both">Đều được</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Thiết bị học online</label>
                    <select className={inputCls} value={v.device} onChange={set('device')}>
                      <option value="">— Chọn —</option>
                      <option value="computer">Máy tính</option>
                      <option value="phone">Điện thoại thông minh</option>
                      <option value="both">Cả hai</option>
                      <option value="none">Chưa có</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Khung giờ có thể tham gia học (chọn nhiều)</label>
                  <div className="space-y-2 mt-1">
                    {TIMES.map((t) => (
                      <Chk key={t.value} checked={times.includes(t.value)} onChange={() => toggleArr(times, setTimes, t.value)} label={t.label} />
                    ))}
                  </div>
                </div>
              </Section>

              {/* Phần 3 */}
              <Section title="Phần 3: Thông tin bổ sung">
                <div>
                  <label className={labelCls}>Bạn biết đến khoá học qua đâu?</label>
                  <select className={inputCls} value={v.referralSource} onChange={set('referralSource')}>
                    <option value="">— Chọn —</option>
                    <option value="facebook">Facebook</option>
                    <option value="tiktok">TikTok</option>
                    <option value="website">Website</option>
                    <option value="referral">Bạn bè giới thiệu</option>
                    <option value="zalo">Zalo</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Bạn mong muốn gì từ khoá học?</label>
                  <textarea rows={3} className={inputCls} value={v.expectation} onChange={set('expectation')} />
                </div>
                <div>
                  <label className={labelCls}>Câu hỏi hoặc ghi chú</label>
                  <textarea rows={3} className={inputCls} value={v.note} onChange={set('note')} />
                </div>
              </Section>

              {/* Xác nhận */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded accent-blue-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Tôi xác nhận các thông tin trên là chính xác.{req}</span>
              </label>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all disabled:opacity-50 shadow-md shadow-blue-500/20">
                {busy ? <><Loader2 size={16} className="animate-spin" /> Đang gửi...</> : 'Gửi đăng ký'}
              </button>
            </>
          )}
        </form>

        <p className="text-center text-[11px] text-slate-400 mt-6">© 2026 Thịnh Long Group</p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
        {Icon && <Icon size={16} className="text-blue-500" />}
        {title}
      </h2>
      {children}
    </div>
  );
}

function Chk({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-4 h-4 rounded accent-blue-500" />
      {label}
    </label>
  );
}
