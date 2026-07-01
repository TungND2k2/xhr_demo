import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, Loader2, Send, FileText, ChevronRight,
} from 'lucide-react';
import { API_BASE } from '../api/payload';

/* ─── Public fetch (no auth token needed) ─── */
async function publicGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  return res.ok ? res.json() : null;
}
async function publicPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

/* ─── Field renderer ─── */
function FormField({ field, value, onChange, prefill }) {
  const base = 'w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50';
  const cls  = `${base} border-slate-200 bg-white placeholder-slate-300`;

  const pre = prefill?.[field.name];

  switch (field.blockType ?? field.type) {
    case 'text':
    case 'email':
      return (
        <input
          type={field.blockType === 'email' ? 'email' : 'text'}
          value={value ?? pre ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.blockName ?? field.label ?? field.name}
          className={cls}
        />
      );
    case 'textarea':
      return (
        <textarea
          rows={4}
          value={value ?? pre ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.blockName ?? field.label ?? field.name}
          className={`${cls} resize-none`}
        />
      );
    case 'select': {
      const opts = field.options ?? [];
      return (
        <select
          value={value ?? pre ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={cls}
        >
          <option value="">-- Chọn --</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }
    case 'date':
      return (
        <input
          type="date"
          value={value ?? pre ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={cls}
        />
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!(value ?? pre)}
            onChange={(e) => onChange(field.name, e.target.checked)}
            className="w-5 h-5 rounded-md border-slate-300 text-blue-500 focus:ring-blue-500/30"
          />
          <span className="text-sm text-slate-600">{field.blockName ?? field.label}</span>
        </label>
      );
    default:
      return (
        <input
          type="text"
          value={value ?? pre ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.blockName ?? field.label ?? field.name}
          className={cls}
        />
      );
  }
}

/* ─── Main Page ─── */
export default function PublicFormPage() {
  const { token } = useParams();
  const [invite, setInvite]   = useState(null);
  const [form,   setForm]     = useState(null);   // form template
  const [prefill, setPrefill] = useState({});
  const [values, setValues]   = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState('idle'); // idle | submitting | success | error | expired | notfound
  const [errMsg, setErrMsg]   = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      // 1. Tìm invite theo token (public read — không cần auth)
      const res = await publicGet(
        `/form-invites?where[token][equals]=${token}&depth=2&limit=1`
      );
      const inv = res?.docs?.[0];
      if (!inv) { setStatus('notfound'); setLoading(false); return; }

      // 2. Kiểm tra status
      if (['expired', 'revoked'].includes(inv.status)) {
        setStatus(inv.status);
        setLoading(false);
        return;
      }
      if (inv.status === 'submitted') {
        setStatus('submitted_already');
        setLoading(false);
        return;
      }

      setInvite(inv);

      // 3. Form template
      const tpl = typeof inv.form === 'object' ? inv.form : null;
      if (tpl) setForm(tpl);

      // 4. Pre-fill map
      const pre = {};
      (inv.prefillData ?? []).forEach(({ field, value }) => { pre[field] = value; });
      setPrefill(pre);

      // Khởi tạo values từ prefill
      setValues({ ...pre });

      // 5. Đánh dấu "đã mở"
      if (inv.status === 'pending') {
        await fetch(`${API_BASE}/form-invites/${inv.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'opened', openedAt: new Date().toISOString() }),
        }).catch(() => {});
      }

      setStatus('idle');
      setLoading(false);
    })();
  }, [token]);

  const setValue = (name, val) => setValues((v) => ({ ...v, [name]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');

    // Build submissionData array
    const submissionData = Object.entries(values)
      .filter(([, v]) => v !== '' && v !== undefined && v !== null)
      .map(([field, value]) => ({ field, value: String(value) }));

    // 1. Tạo form submission
    const { ok, data } = await publicPost('/form-submissions', {
      form: typeof invite.form === 'object' ? invite.form.id : invite.form,
      submissionData,
    });

    if (!ok) {
      setErrMsg(data?.errors?.[0]?.message ?? data?.message ?? 'Gửi thất bại.');
      setStatus('error');
      return;
    }

    // 2. Cập nhật FormInvite → submitted + link submission
    await fetch(`${API_BASE}/form-invites/${invite.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'submitted',
        submission: data.doc?.id ?? data.id,
        submittedAt: new Date().toISOString(),
      }),
    }).catch(() => {});

    // 3. Cập nhật Worker nếu có
    if (invite.worker) {
      const workerId = typeof invite.worker === 'object' ? invite.worker.id : invite.worker;
      const workerPatch = {};
      const MAP = {
        fullName: 'fullName', phone: 'phone', dob: 'dob', gender: 'gender',
        email: 'email', hometown: 'hometown', address: 'address',
        idNumber: 'idNumber', passportNumber: 'passportNumber',
        maritalStatus: 'maritalStatus', height: 'height', weight: 'weight',
      };
      Object.entries(values).forEach(([k, v]) => {
        if (MAP[k] && v) workerPatch[MAP[k]] = v;
      });
      if (Object.keys(workerPatch).length > 0) {
        await fetch(`${API_BASE}/workers/${workerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workerPatch),
        }).catch(() => {});
      }
    }

    setStatus('success');
  };

  /* ─── STATES ─── */
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={36} className="text-blue-500 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Đang tải form...</p>
      </div>
    </div>
  );

  if (status === 'notfound') return <StatusScreen icon="❓" title="Không tìm thấy link" desc="Link này không tồn tại hoặc đã bị xoá." color="slate" />;
  if (status === 'expired')  return <StatusScreen icon="⏰" title="Link đã hết hạn" desc="Link điền form này đã hết thời hạn sử dụng. Vui lòng liên hệ bộ phận tuyển dụng để nhận link mới." color="amber" />;
  if (status === 'revoked')  return <StatusScreen icon="🚫" title="Link bị thu hồi" desc="Link điền form này đã bị thu hồi. Vui lòng liên hệ bộ phận tuyển dụng." color="red" />;
  if (status === 'submitted_already') return <StatusScreen icon="✅" title="Bạn đã nộp rồi!" desc="Thông tin của bạn đã được ghi nhận trước đó. Cảm ơn bạn!" color="green" />;
  if (status === 'success')  return <SuccessScreen />;

  const fields = form?.fields ?? [];
  const workerName = prefill?.fullName ?? (typeof invite?.worker === 'object' ? invite.worker.fullName : '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-10 px-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 text-blue-600 text-xs font-bold mb-4">
          <FileText size={13} /> XHR — Thịnh Long Group
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-800 mb-2">
          {form?.title ?? 'Phiếu đăng ký'}
        </h1>
        {workerName && (
          <p className="text-slate-500 text-sm">
            Xin chào <strong className="text-slate-700">{workerName}</strong>, vui lòng điền đầy đủ thông tin bên dưới.
          </p>
        )}
        {!workerName && (
          <p className="text-slate-500 text-sm">Vui lòng điền đầy đủ và chính xác các thông tin dưới đây.</p>
        )}
      </div>

      {/* Form card */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden"
      >
        <div className="p-8 space-y-6">
          {fields.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Form chưa có trường nào được cấu hình.</p>
            </div>
          )}

          {fields.map((field, idx) => {
            const label = field.label ?? field.blockName ?? field.name;
            const isRequired = field.required;
            return (
              <motion.div
                key={field.name ?? idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                {field.blockType !== 'checkbox' && (
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                  </label>
                )}
                <FormField
                  field={field}
                  value={values[field.name]}
                  onChange={setValue}
                  prefill={prefill}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Error */}
        <AnimatePresence>
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-8 mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold flex items-center gap-2"
            >
              <AlertTriangle size={15} /> {errMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <div className="px-8 pb-8">
          <button
            type="submit"
            disabled={status === 'submitting' || fields.length === 0}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black text-base shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            {status === 'submitting'
              ? <><Loader2 size={18} className="animate-spin" /> Đang gửi...</>
              : <><Send size={18} /> Gửi thông tin <ChevronRight size={16} /></>
            }
          </button>
          <p className="text-center text-[11px] text-slate-400 mt-3">
            Thông tin của bạn được bảo mật và chỉ dùng cho mục đích tuyển dụng lao động.
          </p>
        </div>
      </motion.form>

      {/* Footer */}
      <div className="text-center mt-6 text-xs text-slate-400">
        © Thịnh Long Group · Hệ thống XHR v1.0
      </div>
    </div>
  );
}

function StatusScreen({ icon, title, desc, color }) {
  const colors = {
    green: 'from-green-50 to-emerald-50',
    amber: 'from-amber-50 to-yellow-50',
    red:   'from-red-50 to-rose-50',
    slate: 'from-slate-50 to-gray-50',
  };
  return (
    <div className={`min-h-screen bg-gradient-to-br ${colors[color] ?? colors.slate} flex items-center justify-center p-4`}>
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-6">{icon}</div>
        <h2 className="text-2xl font-black text-slate-800 mb-3">{title}</h2>
        <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
        <div className="mt-8 text-xs text-slate-400">© Thịnh Long Group · XHR v1.0</div>
      </div>
    </div>
  );
}

function SuccessScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 250 }}
        className="text-center max-w-sm"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 15, stiffness: 300 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/30"
        >
          <CheckCircle2 size={48} className="text-white" />
        </motion.div>
        <h2 className="text-3xl font-black text-slate-800 mb-3">Đã nộp thành công!</h2>
        <p className="text-slate-500 leading-relaxed text-sm">
          Cảm ơn bạn đã điền thông tin. Bộ phận tuyển dụng sẽ liên hệ với bạn trong thời gian sớm nhất.
        </p>
        <div className="mt-4 px-4 py-3 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-700 text-xs font-semibold">
          📱 Giữ máy điện thoại để nhận cuộc gọi từ Thịnh Long Group
        </div>
        <div className="mt-8 text-xs text-slate-400">© Thịnh Long Group · XHR v1.0</div>
      </motion.div>
    </div>
  );
}
