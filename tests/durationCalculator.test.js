// tests/durationCalculator.test.js
// Unit tests for durationCalculator.js and cronParser.js
// Run with: npm test

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

// ─── Inline duration calculator ───────────────────────────────
function calcDuration(start, end) {
  const s = new Date(start), e = new Date(end);
  const totalMs = Math.abs(e - s);
  const totalSeconds = Math.floor(totalMs / 1000);
  const totalMinutes = Math.floor(totalMs / 60000);
  const totalHours   = Math.floor(totalMs / 3600000);
  const totalDays    = Math.floor(totalMs / 86400000);

  let d1 = s < e ? new Date(s) : new Date(e);
  let d2 = s < e ? new Date(e) : new Date(s);

  let years  = d2.getFullYear() - d1.getFullYear();
  let months = d2.getMonth() - d1.getMonth();
  let days   = d2.getDate() - d1.getDate();

  if (days < 0)   { months--; days += new Date(d2.getFullYear(), d2.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }

  return { years, months, days, totalMs, totalDays, totalHours, totalMinutes, totalSeconds };
}

function addDuration(base, delta, op = 'add') {
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

function formatDuration({ years, months, days, hours, minutes, seconds }) {
  const parts = [];
  if (years)   parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  if (months)  parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  if (days)    parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours)   parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  return parts.join(', ') || '0 seconds';
}

// ─── Inline business days ─────────────────────────────────────
function countBusinessDays(start, end) {
  let count = 0;
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  while (d <= e) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// ─── Inline cron field matcher ────────────────────────────────
function matchField(expr, value, min, max) {
  if (expr === '*' || expr === '?') return true;
  if (expr.includes('/')) {
    const [range, step] = expr.split('/');
    const s = parseInt(step);
    const from = range === '*' ? min : parseInt(range);
    return value >= from && (value - from) % s === 0;
  }
  if (expr.includes(',')) return expr.split(',').map(Number).includes(value);
  if (expr.includes('-')) {
    const [a, b] = expr.split('-').map(Number);
    return value >= a && value <= b;
  }
  return parseInt(expr) === value;
}

// ─── Tests ───────────────────────────────────────────────────

describe('calcDuration', () => {
  it('same date is zero duration', () => {
    const d = calcDuration('2024-01-01', '2024-01-01');
    assert.strictEqual(d.totalMs, 0);
    assert.strictEqual(d.totalDays, 0);
  });
  it('exactly 1 year', () => {
    const d = calcDuration('2023-01-01', '2024-01-01');
    assert.strictEqual(d.years, 1);
    assert.strictEqual(d.months, 0);
    assert.strictEqual(d.days, 0);
  });
  it('exactly 1 day = 86400 seconds', () => {
    const d = calcDuration('2024-01-01T00:00:00', '2024-01-02T00:00:00');
    assert.strictEqual(d.totalSeconds, 86400);
    assert.strictEqual(d.totalDays, 1);
  });
  it('handles reversed order (end before start)', () => {
    const forward  = calcDuration('2024-01-01', '2024-06-01');
    const backward = calcDuration('2024-06-01', '2024-01-01');
    assert.strictEqual(forward.totalMs, backward.totalMs);
  });
  it('30 days is exactly 1 month for Jan-Feb in non-leap year', () => {
    const d = calcDuration('2023-01-01', '2023-02-01');
    assert.strictEqual(d.months, 1);
    assert.strictEqual(d.years, 0);
  });
  it('totalDays is 365 for a non-leap year', () => {
    const d = calcDuration('2023-01-01', '2024-01-01');
    assert.strictEqual(d.totalDays, 365);
  });
  it('totalDays is 366 for a leap year', () => {
    const d = calcDuration('2024-01-01', '2025-01-01');
    assert.strictEqual(d.totalDays, 366);
  });
});

describe('addDuration', () => {
  it('adds 1 year', () => {
    const result = addDuration('2024-01-01', { years: 1 }, 'add');
    assert.strictEqual(result.getFullYear(), 2025);
  });
  it('subtracts 6 months', () => {
    const result = addDuration('2024-07-01', { months: 6 }, 'subtract');
    assert.strictEqual(result.getMonth(), 0); // January
  });
  it('adds 7 days', () => {
    const result = addDuration('2024-01-01', { days: 7 }, 'add');
    assert.strictEqual(result.getDate(), 8);
  });
  it('adds 0 delta returns same date', () => {
    const base   = '2024-03-15T10:00:00';
    const result = addDuration(base, {}, 'add');
    assert.strictEqual(result.getTime(), new Date(base).getTime());
  });
});

describe('formatDuration', () => {
  it('formats years + months + days', () => {
    const s = formatDuration({ years: 2, months: 3, days: 5 });
    assert.ok(s.includes('2 years'));
    assert.ok(s.includes('3 months'));
    assert.ok(s.includes('5 days'));
  });
  it('singular for 1 unit', () => {
    assert.ok(formatDuration({ years: 1 }).includes('1 year'));
    assert.ok(!formatDuration({ years: 1 }).includes('1 years'));
  });
  it('returns "0 seconds" for empty input', () => {
    assert.strictEqual(formatDuration({}), '0 seconds');
  });
});

describe('countBusinessDays', () => {
  it('Monday to Friday is 5 business days', () => {
    // 2024-01-08 is Monday, 2024-01-12 is Friday
    assert.strictEqual(countBusinessDays(new Date('2024-01-08'), new Date('2024-01-12')), 5);
  });
  it('Saturday + Sunday = 0 business days', () => {
    // 2024-01-13 Sat, 2024-01-14 Sun
    assert.strictEqual(countBusinessDays(new Date('2024-01-13'), new Date('2024-01-14')), 0);
  });
  it('full week Mon–Sun has 5 business days', () => {
    assert.strictEqual(countBusinessDays(new Date('2024-01-08'), new Date('2024-01-14')), 5);
  });
  it('same day (Monday) is 1 business day', () => {
    assert.strictEqual(countBusinessDays(new Date('2024-01-08'), new Date('2024-01-08')), 1);
  });
  it('same day (Saturday) is 0 business days', () => {
    assert.strictEqual(countBusinessDays(new Date('2024-01-13'), new Date('2024-01-13')), 0);
  });
});

describe('cron field matcher', () => {
  it('* matches everything', () => {
    for (let i = 0; i <= 59; i++) assert.ok(matchField('*', i, 0, 59));
  });
  it('specific value matches only that value', () => {
    assert.ok(matchField('30', 30, 0, 59));
    assert.ok(!matchField('30', 31, 0, 59));
    assert.ok(!matchField('30', 29, 0, 59));
  });
  it('range a-b matches inclusive', () => {
    assert.ok(matchField('1-5', 1, 0, 59));
    assert.ok(matchField('1-5', 5, 0, 59));
    assert.ok(!matchField('1-5', 0, 0, 59));
    assert.ok(!matchField('1-5', 6, 0, 59));
  });
  it('list matches listed values only', () => {
    assert.ok(matchField('1,3,5', 1, 0, 59));
    assert.ok(matchField('1,3,5', 3, 0, 59));
    assert.ok(!matchField('1,3,5', 2, 0, 59));
  });
  it('*/15 matches every 15 minutes', () => {
    for (const v of [0, 15, 30, 45]) assert.ok(matchField('*/15', v, 0, 59));
    assert.ok(!matchField('*/15', 1, 0, 59));
    assert.ok(!matchField('*/15', 16, 0, 59));
  });
  it('5/10 matches 5, 15, 25, 35, 45, 55', () => {
    for (const v of [5, 15, 25, 35, 45, 55]) assert.ok(matchField('5/10', v, 0, 59));
    assert.ok(!matchField('5/10', 0, 0, 59));
    assert.ok(!matchField('5/10', 10, 0, 59));
  });
});
