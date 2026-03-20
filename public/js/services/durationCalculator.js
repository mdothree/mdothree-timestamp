// services/durationCalculator.js

/**
 * Calculate duration between two dates
 * @param {Date|string} start
 * @param {Date|string} end
 * @returns {{ years, months, days, hours, minutes, seconds, totalMs, totalDays, totalHours, totalMinutes, totalSeconds }}
 */
export function calcDuration(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e)) throw new Error('Invalid date');

  const totalMs = Math.abs(e - s);
  const totalSeconds = Math.floor(totalMs / 1000);
  const totalMinutes = Math.floor(totalMs / 60000);
  const totalHours   = Math.floor(totalMs / 3600000);
  const totalDays    = Math.floor(totalMs / 86400000);

  // Calendar breakdown
  let d1 = s < e ? new Date(s) : new Date(e);
  let d2 = s < e ? new Date(e) : new Date(s);

  let years  = d2.getFullYear() - d1.getFullYear();
  let months = d2.getMonth() - d1.getMonth();
  let days   = d2.getDate() - d1.getDate();

  if (days < 0) {
    months--;
    days += new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
  }
  if (months < 0) { years--; months += 12; }

  const hours   = d2.getHours() - d1.getHours();
  const minutes = d2.getMinutes() - d1.getMinutes();
  const seconds = d2.getSeconds() - d1.getSeconds();

  return {
    years, months, days,
    hours: Math.abs(hours), minutes: Math.abs(minutes), seconds: Math.abs(seconds),
    totalMs, totalDays, totalHours, totalMinutes, totalSeconds,
  };
}

/**
 * Add/subtract duration from a date
 * @param {Date|string} base
 * @param {Object} delta - { years?, months?, days?, hours?, minutes?, seconds? }
 * @param {'add'|'subtract'} op
 * @returns {Date}
 */
export function addDuration(base, delta, op = 'add') {
  const d = new Date(base);
  const sign = op === 'add' ? 1 : -1;

  if (delta.years)   d.setFullYear(d.getFullYear() + sign * delta.years);
  if (delta.months)  d.setMonth(d.getMonth() + sign * delta.months);
  if (delta.days)    d.setDate(d.getDate() + sign * delta.days);
  if (delta.hours)   d.setHours(d.getHours() + sign * delta.hours);
  if (delta.minutes) d.setMinutes(d.getMinutes() + sign * delta.minutes);
  if (delta.seconds) d.setSeconds(d.getSeconds() + sign * delta.seconds);

  return d;
}

/**
 * Format a duration object into a human string
 */
export function formatDuration({ years, months, days, hours, minutes, seconds }) {
  const parts = [];
  if (years)   parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  if (months)  parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  if (days)    parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours)   parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  return parts.join(', ') || '0 seconds';
}
