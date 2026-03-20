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

export function countBusinessDays(start, end, holidays = []) {
  const holidaySet = new Set(holidays.map(h => new Date(h).toDateString()));
  let count = 0;
  const d = new Date(start); d.setHours(0,0,0,0);
  const e = new Date(end);   e.setHours(23,59,59,999);
  while (d <= e) {
    const day = d.getDay();
    if (day !== 0 && day !== 6 && !holidaySet.has(d.toDateString())) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function addBusinessDays(start, count, holidays = []) {
  const holidaySet = new Set(holidays.map(h => new Date(h).toDateString()));
  const d = new Date(start);
  let added = 0;
  while (added < count) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6 && !holidaySet.has(d.toDateString())) added++;
  }
  return d;
}
