import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, X, Trash2 } from 'lucide-react';
import { listDocs, fetchPayload } from '../api/payload';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const EVENT_COLORS = {
  meeting:    { bg: 'bg-blue-500/15',   text: 'text-blue-600 dark:text-blue-400',     dot: 'bg-blue-500' },
  training:   { bg: 'bg-cyan-500/15',   text: 'text-cyan-600 dark:text-cyan-400',     dot: 'bg-cyan-500' },
  interview:  { bg: 'bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  deadline:   { bg: 'bg-red-500/15',    text: 'text-red-600 dark:text-red-400',       dot: 'bg-red-500' },
  flight:     { bg: 'bg-amber-500/15',  text: 'text-amber-600 dark:text-amber-400',   dot: 'bg-amber-500' },
  exam:       { bg: 'bg-green-500/15',  text: 'text-green-600 dark:text-green-400',   dot: 'bg-green-500' },
  default:    { bg: 'bg-slate-500/15',  text: 'text-slate-600 dark:text-slate-400',   dot: 'bg-slate-500' },
};
const EVENT_TYPE_LABELS = {
  meeting: 'Họp', training: 'Đào tạo', interview: 'PV', deadline: 'Hạn',
  flight: 'Vé', exam: 'Thi', other: 'Khác',
};

function colorOf(type) { return EVENT_COLORS[type] ?? EVENT_COLORS.default; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Generate 6×7 grid of dates centered on `month` (Monday-start). */
function buildGrid(month) {
  const first = startOfMonth(month);
  // JS getDay: Sun=0, Mon=1, ..., Sat=6. We want Mon=0 ... Sun=6.
  const dow = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - dow);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function CalendarView() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // { mode: 'create', date } | { mode: 'edit', event }
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const fromIso = startOfMonth(addMonths(month, -1)).toISOString();
    const toIso = endOfMonth(addMonths(month, 1)).toISOString();
    listDocs('calendars', {
      where: {
        and: [
          { startAt: { greater_than_equal: fromIso } },
          { startAt: { less_than_equal: toIso } },
        ],
      },
      limit: 500,
      depth: 0,
      sort: 'startAt',
    }).then((d) => {
      if (cancel) return;
      setEvents(d.docs ?? []);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [month, reloadKey]);

  const grid = useMemo(() => buildGrid(month), [month]);
  const today = new Date();

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      if (!e.startAt) continue;
      const d = new Date(e.startAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return map;
  }, [events]);

  const keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 print-area">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-main)] flex items-center gap-3">
            <CalendarIcon className="text-blue-500" size={28} />
            Lịch họp / Sự kiện
          </h2>
          <p className="text-sm text-[var(--text-muted)]">{events.length} sự kiện trong 3 tháng đang xem</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button onClick={() => setMonth(addMonths(month, -1))} className="p-2 rounded-xl border border-[var(--border-color)] hover:bg-blue-500/5"><ChevronLeft size={16} /></button>
          <button onClick={() => setMonth(startOfMonth(new Date()))} className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-xs font-semibold hover:bg-blue-500/5">Hôm nay</button>
          <button onClick={() => setMonth(addMonths(month, 1))} className="p-2 rounded-xl border border-[var(--border-color)] hover:bg-blue-500/5"><ChevronRight size={16} /></button>
          <div className="ml-3 text-lg font-bold text-[var(--text-main)] min-w-[140px]">
            Tháng {month.getMonth() + 1}/{month.getFullYear()}
          </div>
        </div>
      </div>

      {loading && <p className="text-center text-sm text-slate-500">Đang tải sự kiện...</p>}

      <div className="glass-card overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-[var(--border-color)]">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className={`px-3 py-2 text-center text-xs font-bold uppercase tracking-wider ${wd === 'CN' ? 'text-red-500' : 'text-slate-500'}`}>
              {wd}
            </div>
          ))}
        </div>
        {/* Grid 6 weeks */}
        <div className="grid grid-cols-7 grid-rows-6" style={{ minHeight: '70vh' }}>
          {grid.map((d, i) => {
            const inMonth = d.getMonth() === month.getMonth();
            const isToday = isSameDay(d, today);
            const isSunday = d.getDay() === 0;
            const dayEvents = eventsByDate.get(keyOf(d)) ?? [];
            return (
              <div
                key={i}
                onClick={(e) => {
                  if (e.target === e.currentTarget || e.target.closest('[data-cell-bg]')) {
                    setModal({ mode: 'create', date: new Date(d) });
                  }
                }}
                className={`border-r border-b border-[var(--border-color)] last-of-type:border-r-0 p-1.5 overflow-hidden group cursor-pointer hover:bg-blue-500/[0.03] transition-colors ${
                  inMonth ? '' : 'bg-black/[0.015] dark:bg-white/[0.015]'
                }`}
                data-cell-bg
              >
                <div className={`flex items-center justify-between mb-1 px-1 ${inMonth ? '' : 'opacity-40'}`} data-cell-bg>
                  <span className={`text-xs font-bold ${
                    isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center'
                    : isSunday ? 'text-red-500'
                    : 'text-[var(--text-main)]'
                  }`}>
                    {d.getDate()}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setModal({ mode: 'create', date: new Date(d) }); }}
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded bg-blue-500 text-white flex items-center justify-center transition-opacity no-print"
                    title="Tạo sự kiện"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 4).map((e) => {
                    const c = colorOf(e.eventType);
                    return (
                      <button
                        key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); setModal({ mode: 'edit', event: e }); }}
                        title={`${e.title} (${EVENT_TYPE_LABELS[e.eventType] ?? e.eventType ?? 'event'}) — click để sửa`}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate ${c.bg} ${c.text} hover:opacity-80 transition-opacity flex items-center gap-1`}
                      >
                        <span className={`w-1 h-1 rounded-full ${c.dot} shrink-0`} />
                        {!e.allDay && e.startAt && <span className="opacity-70 font-mono">{fmtTime(new Date(e.startAt))}</span>}
                        <span className="truncate font-medium">{e.title ?? '(không tiêu đề)'}</span>
                      </button>
                    );
                  })}
                  {dayEvents.length > 4 && (
                    <button
                      onClick={() => navigate('/calendars?date=' + keyOf(d))}
                      className="w-full text-left px-1.5 py-0.5 text-[10px] text-blue-500 hover:underline"
                    >
                      + {dayEvents.length - 4} sự kiện khác
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
        <span className="font-bold uppercase tracking-wider">Phân loại:</span>
        {Object.entries(EVENT_TYPE_LABELS).map(([code, label]) => {
          const c = colorOf(code);
          return (
            <span key={code} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              {label}
            </span>
          );
        })}
      </div>

      <AnimatePresence>
        {modal && (
          <EventModal
            mode={modal.mode}
            date={modal.date}
            event={modal.event}
            onClose={() => setModal(null)}
            onSaved={() => { setModal(null); setReloadKey((k) => k + 1); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EventModal({ mode, date, event, onClose, onSaved }) {
  // Build initial state — from existing event (edit) or new (create)
  const initDate = useMemo(() => {
    if (mode === 'edit' && event?.startAt) return new Date(event.startAt);
    return date ?? new Date();
  }, [mode, event, date]);
  const dateStr = `${initDate.getFullYear()}-${String(initDate.getMonth() + 1).padStart(2, '0')}-${String(initDate.getDate()).padStart(2, '0')}`;

  const [title, setTitle] = useState(event?.title ?? '');
  const [eventType, setEventType] = useState(event?.eventType ?? 'meeting');
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startTime, setStartTime] = useState(event?.startAt ? fmtTime(new Date(event.startAt)) : '09:00');
  const [endTime, setEndTime] = useState(event?.endAt ? fmtTime(new Date(event.endAt)) : '10:00');
  const [eventDate, setEventDate] = useState(dateStr);
  const [location, setLocation] = useState(event?.location ?? '');
  const [meetingLink, setMeetingLink] = useState(event?.meetingLink ?? '');
  const [description, setDescription] = useState(
    typeof event?.description === 'string' ? event.description : '',
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!title.trim()) { setError('Vui lòng nhập tiêu đề'); return; }
    setSaving(true);
    setError(null);
    try {
      const startAt = allDay
        ? `${eventDate}T00:00:00+07:00`
        : `${eventDate}T${startTime}:00+07:00`;
      const endAt = allDay
        ? `${eventDate}T23:59:59+07:00`
        : `${eventDate}T${endTime}:00+07:00`;
      const body = {
        title: title.trim(),
        eventType,
        allDay,
        startAt,
        endAt,
        ...(mode === 'create' ? { status: 'scheduled' } : {}),
        location: location || null,
        meetingLink: meetingLink || null,
        description: description || null,
      };
      const url = mode === 'edit' ? `/calendars/${event.id}` : '/calendars';
      const method = mode === 'edit' ? 'PATCH' : 'POST';
      const r = await fetchPayload(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        setError(`Lưu thất bại HTTP ${r.status}: ${txt.slice(0, 200)}`);
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    if (!window.confirm(`Xoá sự kiện "${event.title}"?`)) return;
    setDeleting(true);
    setError(null);
    try {
      const r = await fetchPayload(`/calendars/${event.id}`, { method: 'DELETE' });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        setError(`Xoá thất bại HTTP ${r.status}: ${txt.slice(0, 200)}`);
        return;
      }
      onSaved();
    } finally {
      setDeleting(false);
    }
  };

  const isEdit = mode === 'edit';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 20 }}
        className="bg-[var(--sidebar-bg)] rounded-2xl shadow-xl max-w-lg w-full p-6 border border-[var(--border-color)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-black text-[var(--text-main)]">{isEdit ? 'Sửa sự kiện' : 'Tạo sự kiện mới'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">📅 {initDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Tiêu đề *</label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="vd: Họp giao ban tuần"
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Loại sự kiện</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {Object.entries(EVENT_TYPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Cả ngày</label>
              <label className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-blue-500" />
                Sự kiện cả ngày
              </label>
            </div>
          </div>

          <div className={allDay ? '' : 'grid grid-cols-3 gap-3'}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Ngày</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            {!allDay && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Giờ bắt đầu</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Giờ kết thúc</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Địa điểm</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="vd: Phòng họp tầng 5" className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Link họp online</label>
            <input type="text" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://zoom.us/..." className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nội dung / Agenda</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Mô tả nội dung sự kiện..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20 resize-y"
            />
          </div>

          {error && <div className="text-xs text-red-500 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

          <div className="flex justify-between items-center pt-2">
            <div>
              {isEdit && (
                <button onClick={handleDelete} disabled={saving || deleting} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-red-500/40 text-red-500 hover:bg-red-500/5 disabled:opacity-40">
                  <Trash2 size={14} /> {deleting ? 'Đang xoá...' : 'Xoá'}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} disabled={saving || deleting} className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--border-color)] hover:bg-black/5 dark:hover:bg-white/5">Huỷ</button>
              <button onClick={handleSave} disabled={saving || deleting || !title.trim()} className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40">
                {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo sự kiện'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
