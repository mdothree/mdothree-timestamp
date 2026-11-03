// dateUtils.js — re-exports shared utils + timestamp-specific helpers
export { showToast, copyToClipboard } from './ui-helpers.js';

export function formatRelative(date) {
  const diff = Date.now() - new Date(date).getTime();
  const abs  = Math.abs(diff);
  const past = diff > 0;
  const suffix = past ? 'ago' : 'from now';
  if (abs < 60000)    return 'just now';
  if (abs < 3600000)  return `${Math.floor(abs / 60000)} minutes ${suffix}`;
  if (abs < 86400000) return `${Math.floor(abs / 3600000)} hours ${suffix}`;
  return new Date(date).toLocaleDateString();
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Date-only strings (YYYY-MM-DD) are calendar dates: parse them as local midnight,
// not UTC, so local-calendar arithmetic (getDay, setDate) stays on the same day.
export function toLocalDate(v) {
  if (typeof v === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  return new Date(v);
}

export function formatDateOnly(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function countBusinessDays(start, end, holidays = []) {
  const holidaySet = new Set(holidays.map(h => toLocalDate(h).toDateString()));
  let count = 0;
  const d = toLocalDate(start); d.setHours(0,0,0,0);
  const e = toLocalDate(end);  e.setHours(23,59,59,999);
  while (d <= e) {
    const day = d.getDay();
    if (day !== 0 && day !== 6 && !holidaySet.has(d.toDateString())) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function addBusinessDays(start, count, holidays = []) {
  const holidaySet = new Set(holidays.map(h => toLocalDate(h).toDateString()));
  const d = toLocalDate(start);
  let added = 0;
  while (added < count) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6 && !holidaySet.has(d.toDateString())) added++;
  }
  return d;
}
