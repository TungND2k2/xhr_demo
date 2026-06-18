import {
  Laptop, Smartphone, Car, Printer, Armchair, Scissors,
  PenLine, FileText, Package,
} from 'lucide-react';

export const CATEGORY_META = {
  computer:           { label: 'Máy tính / Laptop',          icon: Laptop,     tint: 'blue' },
  phone:              { label: 'Điện thoại / Tablet',        icon: Smartphone, tint: 'cyan' },
  vehicle:            { label: 'Xe cộ',                       icon: Car,        tint: 'amber' },
  printer:            { label: 'Máy in / Scan',              icon: Printer,    tint: 'purple' },
  furniture:          { label: 'Bàn ghế văn phòng',          icon: Armchair,   tint: 'slate' },
  training_equipment: { label: 'Thiết bị đào tạo',           icon: Scissors,   tint: 'green' },
  stationery:         { label: 'Văn phòng phẩm',             icon: PenLine,    tint: 'slate' },
  physical_doc:       { label: 'Tài liệu vật lý',            icon: FileText,   tint: 'purple' },
  other:              { label: 'Khác',                        icon: Package,    tint: 'slate' },
};

export const STATUS_META = {
  in_use:    { label: 'Đang dùng',  dot: 'bg-green-500',  chip: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30' },
  in_stock:  { label: 'Trong kho',   dot: 'bg-blue-500',   chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  repairing: { label: 'Sửa chữa',   dot: 'bg-amber-500',  chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  broken:    { label: 'Hỏng',       dot: 'bg-red-500',    chip: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' },
  disposed:  { label: 'Thanh lý',    dot: 'bg-slate-500',  chip: 'bg-slate-500/10 text-slate-500 border-slate-500/30' },
  lost:      { label: 'Mất',         dot: 'bg-red-500',    chip: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' },
};

export const TINT_CLASS = {
  blue:   'bg-blue-500/10 text-blue-500',
  cyan:   'bg-cyan-500/10 text-cyan-500',
  amber:  'bg-amber-500/10 text-amber-500',
  purple: 'bg-purple-500/10 text-purple-500',
  green:  'bg-green-500/10 text-green-500',
  slate:  'bg-slate-500/10 text-slate-500',
  red:    'bg-red-500/10 text-red-500',
};

export const MAINTENANCE_KIND_LABELS = {
  periodic: 'Bảo trì định kỳ',
  repair:   'Sửa chữa',
  upgrade:  'Nâng cấp',
};

export const daysUntil = (iso) => {
  if (!iso) return null;
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
};

export const lineValue = (a) => (Number(a.purchaseValue) || 0) * (Number(a.quantity) || 1);
