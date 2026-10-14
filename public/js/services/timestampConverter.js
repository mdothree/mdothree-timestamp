// services/timestampConverter.js

const UNIT_TO_MS = { s: 1000, ms: 1, us: 1e-3, ns: 1e-6 };
export const UNIT_NAMES = { s: 'seconds', ms: 'milliseconds', us: 'microseconds', ns: 'nanoseconds' };

// HID-016: rows labelled Local / Date only / Time only use the visitor's own locale (Intl); the UTC, ISO, RFC 2822,
// Unix and "(UTC)" rows stay fixed and locale-independent because their labels promise a fixed format.
export const LOCAL_ROWS = new Set(['Local', 'Date only', 'Time only']);
export function userLocale() {
  try { return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US'; } catch { return 'en-US'; }
}
const fmtLocal = (d, opts, locale) => new Intl.DateTimeFormat(locale, opts).format(d);
const LOCAL_DATETIME = { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' };

/**
 * Guess the unit of a Unix timestamp from its number of integer digits.
 * ≤11 digits → seconds (up to year 5138), 12–14 → ms, 15–17 → µs, ≥18 → ns.
 * @param {string|number} raw
 * @returns {'s'|'ms'|'us'|'ns'|null} null when not a number
 */
export function detectUnit(raw) {
  const str = String(raw).trim();
  if (!/^-?\d+(\.\d+)?$/.test(str)) return null;
  const digits = str.replace(/^-/, '').split('.')[0].replace(/^0+(?=\d)/, '').length;
  if (digits >= 18) return 'ns';
  if (digits >= 15) return 'us';
  if (digits >= 12) return 'ms';
  return 's';
}

/**
 * Convert Unix timestamp to multiple date formats
 * @param {number} ts - Unix timestamp
 * @param {'s'|'ms'|'us'|'ns'} unit
 * @returns {Object} map of format name → formatted string
 */
export function unixToFormats(ts, unit = 's', locale = undefined) {
  // toFixed(3) strips float noise, e.g. 1.1 s → 1100 ms (not 1100.0000000000002)
  const ms = Number((ts * (UNIT_TO_MS[unit] ?? 1000)).toFixed(3));
  const d = new Date(ms);

  if (isNaN(d.getTime())) throw new Error('Invalid timestamp');

  return {
    'UTC':        d.toUTCString(),
    'ISO 8601':   d.toISOString(),
    'Local':      fmtLocal(d, LOCAL_DATETIME, locale),
    'Date only':  fmtLocal(d, { year: 'numeric', month: 'numeric', day: 'numeric' }, locale),
    'Time only':  fmtLocal(d, { hour: 'numeric', minute: '2-digit', second: '2-digit' }, locale),
    'Unix (s)':   Math.floor(ms / 1000).toString(),
    'Unix (ms)':  ms.toString(),
    // C7B-TS-WEEK: computed in UTC so they agree with the UTC/ISO rows above (they used local time).
    'Day of week (UTC)': d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
    'ISO week (UTC)': getIsoWeekUTC(d),
  };
}

/**
 * Convert a Date or ISO string to multiple timestamp formats
 * @param {string|Date} date
 * @returns {Object}
 */
export function dateToFormats(date, locale = undefined) {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) throw new Error('Invalid date');

  const ms = d.getTime();
  const sec = Math.floor(ms / 1000);

  return {
    'Unix (seconds)': sec.toString(),
    'Unix (ms)':      ms.toString(),
    'ISO 8601':       d.toISOString(),
    'UTC':            d.toUTCString(),
    'Local':          fmtLocal(d, LOCAL_DATETIME, locale),
    'RFC 2822':       d.toUTCString(),
  };
}

/** ISO 8601 week of the UTC date, e.g. "1970-W01" (weeks start Monday; week 1 holds the first Thursday). */
function getIsoWeekUTC(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;            // Mon=1 … Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - dow);    // Thursday of this week decides the year
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Get current timestamp in multiple formats
 */
export function nowFormats() {
  return unixToFormats(Date.now(), 'ms');
}
