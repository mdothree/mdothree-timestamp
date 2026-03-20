// services/cronParser.js

const FIELDS = ['minute', 'hour', 'day of month', 'month', 'day of week'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/**
 * Parse and explain a cron expression
 * @param {string} expr - 5-part cron expression
 * @returns {{ valid: boolean, explanation: string, parts: Object, nextRuns: Date[] }}
 */
export function parseCron(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { valid: false, explanation: 'Cron expression must have exactly 5 parts', parts: {}, nextRuns: [] };
  }

  const [min, hour, dom, month, dow] = parts;
  const errors = [];

  const explained = {
    minute:      explainField(min, 0, 59, 'minute', null, errors),
    hour:        explainField(hour, 0, 23, 'hour', null, errors),
    dayOfMonth:  explainField(dom, 1, 31, 'day of month', null, errors),
    month:       explainField(month, 1, 12, 'month', MONTHS, errors),
    dayOfWeek:   explainField(dow, 0, 6, 'day of week', DAYS, errors),
  };

  if (errors.length) {
    return { valid: false, explanation: errors.join('; '), parts: explained, nextRuns: [] };
  }

  const sentences = [
    explained.minute,
    explained.hour,
    explained.dayOfMonth,
    explained.month,
    explained.dayOfWeek,
  ].filter(Boolean);

  const explanation = `Runs ${sentences.join(', ')}.`;
  const nextRuns = getNextRuns(expr, 5);

  return { valid: true, explanation, parts: explained, nextRuns };
}

function explainField(value, min, max, name, labels, errors) {
  if (value === '*') return `every ${name}`;
  if (value === '?') return null;

  if (value.includes('/')) {
    const [range, step] = value.split('/');
    const s = parseInt(step);
    if (isNaN(s) || s < 1) { errors.push(`Invalid step in ${name}`); return ''; }
    const from = range === '*' ? min : parseInt(range);
    return `every ${s} ${name}${s !== 1 ? 's' : ''} (starting at ${labels ? labels[from - (name === 'month' ? 1 : 0)] || from : from})`;
  }

  if (value.includes(',')) {
    const vals = value.split(',').map(v => parseInt(v.trim()));
    const named = vals.map(v => {
      if (labels) return labels[v - (name === 'month' ? 1 : 0)] || v;
      return v;
    });
    return `at ${name}${name === 'minute' ? ' ' : 's '}${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
  }

  if (value.includes('-')) {
    const [a, b] = value.split('-').map(Number);
    const la = labels ? labels[a - (name === 'month' ? 1 : 0)] || a : a;
    const lb = labels ? labels[b - (name === 'month' ? 1 : 0)] || b : b;
    return `from ${la} to ${lb}`;
  }

  const n = parseInt(value);
  if (isNaN(n) || n < min || n > max) {
    errors.push(`${name} value ${value} out of range ${min}-${max}`);
    return '';
  }
  const label = labels ? labels[n - (name === 'month' ? 1 : 0)] || n : n;
  return `at ${name} ${label}`;
}

/**
 * Calculate next N run times for a cron expression (approximation)
 * @param {string} expr
 * @param {number} count
 * @returns {Date[]}
 */
export function getNextRuns(expr, count = 5) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return [];

  const [min, hour, dom, month, dow] = parts;
  const results = [];
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  let d = new Date(start);
  let iterations = 0;

  while (results.length < count && iterations++ < 100000) {
    if (matchField(month, d.getMonth() + 1, 1, 12) &&
        matchField(dom, d.getDate(), 1, 31) &&
        matchField(dow, d.getDay(), 0, 6) &&
        matchField(hour, d.getHours(), 0, 23) &&
        matchField(min, d.getMinutes(), 0, 59)) {
      results.push(new Date(d));
    }
    d.setMinutes(d.getMinutes() + 1);
  }

  return results;
}

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

export const CRON_EXAMPLES = [
  { expr: '* * * * *',     label: 'Every minute' },
  { expr: '0 * * * *',     label: 'Every hour' },
  { expr: '0 0 * * *',     label: 'Every day at midnight' },
  { expr: '0 9 * * 1-5',   label: 'Weekdays at 9am' },
  { expr: '0 0 * * 0',     label: 'Every Sunday at midnight' },
  { expr: '*/15 * * * *',  label: 'Every 15 minutes' },
  { expr: '0 0 1 * *',     label: 'First of every month' },
  { expr: '0 0 1 1 *',     label: 'Every year on Jan 1' },
  { expr: '30 9 * * 1',    label: 'Monday at 9:30am' },
];
