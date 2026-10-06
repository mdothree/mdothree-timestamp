// services/cronParser.js

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DOW_NAMES   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

// Field specs: [key, label, min, max, name aliases, display labels]
const SPECS = [
  { key: 'minute',     name: 'minute',       min: 0, max: 59 },
  { key: 'hour',       name: 'hour',         min: 0, max: 23 },
  { key: 'dayOfMonth', name: 'day of month', min: 1, max: 31 },
  { key: 'month',      name: 'month',        min: 1, max: 12, aliases: MONTH_NAMES, labels: MONTHS, offset: 1 },
  { key: 'dayOfWeek',  name: 'day of week',  min: 0, max: 7,  aliases: DOW_NAMES,   labels: DAYS,   offset: 0 },
];

function toNumber(tok, spec) {
  const t = tok.trim().toUpperCase();
  if (spec.aliases) {
    const i = spec.aliases.indexOf(t);
    if (i !== -1) return i + spec.offset;
  }
  if (!/^\d+$/.test(t)) throw new Error(`Invalid ${spec.name} value "${tok}"`);
  return Number(t);
}

/**
 * Expand one cron field into the sorted list of values it matches.
 * Supports *, ?, lists (a,b), ranges (a-b), steps (*\/n, a/n, a-b/n), month/day names, 7 = Sunday.
 * @throws {Error} on syntax or range errors
 */
export function expandField(field, spec) {
  const out = new Set();
  for (const item of field.split(',')) {
    if (item === '') throw new Error(`Empty list item in ${spec.name}`);
    const [rangePart, stepPart, extra] = item.split('/');
    if (extra !== undefined) throw new Error(`Invalid step in ${spec.name}`);
    let step = 1;
    if (stepPart !== undefined) {
      if (!/^\d+$/.test(stepPart) || +stepPart < 1) throw new Error(`Invalid step "${stepPart}" in ${spec.name}`);
      step = +stepPart;
    }
    let lo, hi;
    if (rangePart === '*' || rangePart === '?') {
      lo = spec.min; hi = spec.key === 'dayOfWeek' ? 6 : spec.max;
    } else if (rangePart.includes('-')) {
      const [a, b, more] = rangePart.split('-');
      if (more !== undefined) throw new Error(`Invalid range "${rangePart}" in ${spec.name}`);
      lo = toNumber(a, spec); hi = toNumber(b, spec);
    } else {
      lo = toNumber(rangePart, spec);
      hi = stepPart !== undefined ? (spec.key === 'dayOfWeek' ? 6 : spec.max) : lo; // "a/n" = from a to max
    }
    for (const v of [lo, hi]) {
      if (v < spec.min || v > spec.max) throw new Error(`${spec.name} value ${v} out of range ${spec.min}-${spec.max}`);
    }
    if (lo > hi) throw new Error(`Invalid range ${lo}-${hi} in ${spec.name} (start is after end)`);
    for (let v = lo; v <= hi; v += step) out.add(spec.key === 'dayOfWeek' && v === 7 ? 0 : v);
  }
  return [...out].sort((a, b) => a - b);
}

function label(v, spec) {
  return spec.labels ? spec.labels[v - spec.offset] : String(v);
}

function joinList(arr) {
  return arr.length === 1 ? arr[0] : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;
}

function describe(field, values, spec) {
  if (field === '*' || field === '?') return spec.key === 'minute' ? 'every minute' : null;
  const full = spec.key === 'dayOfWeek' ? 7 : spec.max - spec.min + 1;
  if (values.length === full) return null; // e.g. "*/1" or "0-6" — no restriction
  const m = /^(\*|\d+)\/(\d+)$/.exec(field);
  if (m) {
    const step = +m[2];
    const start = m[1] === '*' ? spec.min : +m[1];
    return `every ${step} ${spec.name}${step !== 1 ? 's' : ''}` + (start !== spec.min ? ` starting at ${label(start, spec)}` : '');
  }
  // Collapse runs of consecutive values into "a to b"
  const runs = [];
  for (const v of values) {
    const last = runs[runs.length - 1];
    if (last && v === last[1] + 1) last[1] = v; else runs.push([v, v]);
  }
  const words = runs.map(([a, b]) => (b - a >= 2 ? `${label(a, spec)} to ${label(b, spec)}` : (a === b ? label(a, spec) : `${label(a, spec)}, ${label(b, spec)}`)));
  const prefix = { minute: 'at minute', hour: 'during hour', dayOfMonth: 'on day of month', month: 'in', dayOfWeek: 'on' }[spec.key];
  return `${prefix} ${joinList(words)}`;
}

function compile(expr) {
  const fields = String(expr).trim().split(/\s+/);
  if (fields.length !== 5) throw new Error('Cron expression must have exactly 5 parts');
  const sets = {};
  const errors = [];
  SPECS.forEach((spec, i) => {
    try { sets[spec.key] = expandField(fields[i], spec); }
    catch (e) { errors.push(e.message); }
  });
  if (errors.length) throw new Error(errors.join('; '));
  // Standard (Vixie) cron: when BOTH day-of-month and day-of-week are restricted, a day matches if EITHER matches.
  const domStar = fields[2].startsWith('*') || fields[2] === '?';
  const dowStar = fields[4].startsWith('*') || fields[4] === '?';
  return { fields, sets, domOrDow: !domStar && !dowStar, domStar, dowStar };
}

/**
 * Parse and explain a cron expression
 * @param {string} expr - 5-part cron expression
 * @returns {{ valid: boolean, explanation: string, parts: Object, nextRuns: Date[] }}
 */
export function parseCron(expr) {
  let c;
  try { c = compile(expr); }
  catch (e) { return { valid: false, explanation: e.message, parts: {}, nextRuns: [] }; }

  const parts = {};
  SPECS.forEach((spec, i) => { parts[spec.key] = describe(c.fields[i], c.sets[spec.key], spec); });

  let dayText;
  if (c.domOrDow) dayText = `${parts.dayOfMonth} or ${parts.dayOfWeek}`;
  else dayText = [parts.dayOfMonth, parts.dayOfWeek].filter(Boolean).join(', ');
  let timeText = [parts.minute, parts.hour].filter(Boolean);
  if (/^\d+$/.test(c.fields[0]) && /^\d+$/.test(c.fields[1])) {
    timeText = [`at ${String(c.sets.hour[0]).padStart(2, '0')}:${String(c.sets.minute[0]).padStart(2, '0')}`];
  }
  const sentences = [...timeText, dayText, parts.month].filter(Boolean);

  const explanation = `Runs ${sentences.join(', ')}.`;
  const nextRuns = getNextRuns(expr, 5);
  return { valid: true, explanation, parts, nextRuns };
}

/**
 * Calculate the next N run times (local time) for a cron expression.
 * Walks day by day (up to ~8 years, enough for Feb 29 schedules), then hours/minutes within matching days.
 * @param {string} expr
 * @param {number} count
 * @param {Date} [from=new Date()]
 * @returns {Date[]}
 */
export function getNextRuns(expr, count = 5, from = new Date()) {
  let c;
  try { c = compile(expr); } catch { return []; }
  const { sets, domOrDow, domStar, dowStar } = c;
  const months = new Set(sets.month), doms = new Set(sets.dayOfMonth), dows = new Set(sets.dayOfWeek);

  const start = new Date(from);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  const results = [];
  const day = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 0; i < 366 * 8 && results.length < count; i++, day.setDate(day.getDate() + 1)) {
    if (!months.has(day.getMonth() + 1)) continue;
    const domOk = doms.has(day.getDate()), dowOk = dows.has(day.getDay());
    const dayOk = domOrDow ? (domOk || dowOk) : ((domStar || domOk) && (dowStar || dowOk));
    if (!dayOk) continue;
    for (const h of sets.hour) {
      for (const m of sets.minute) {
        const t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        if (t.getHours() !== h || t.getMinutes() !== m) continue; // skipped by a DST jump
        if (t < start) continue;
        results.push(t);
        if (results.length >= count) return results;
      }
    }
  }
  return results;
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
