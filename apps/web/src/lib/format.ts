const moneyFormat = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

const compactMoneyFormat = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const dateTimeFormat = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Bangkok',
});

const dateFormat = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeZone: 'Asia/Bangkok',
});

export function formatMoney(value: number | null): string {
  return value === null ? '—' : moneyFormat.format(value);
}

export function formatMoneyCompact(value: number): string {
  return compactMoneyFormat.format(value);
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** เวลาแบบสัมพัทธ์สำหรับรายการล่าสุด — เก่ากว่า 30 วันแสดงเป็นวันที่ */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MINUTE) return 'เมื่อสักครู่';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} นาทีที่แล้ว`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} ชั่วโมงที่แล้ว`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} วันที่แล้ว`;
  return formatDate(iso);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}
