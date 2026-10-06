// services/timestampConverter.js

const UNIT_TO_MS = { s: 1000, ms: 1, us: 1e-3, ns: 1e-6 };
export const UNIT_NAMES = { s: 'seconds', ms: 'milliseconds', us: 'microseconds', ns: 'nanoseconds' };

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
export function unixToFormats(ts, unit = 's') {
  // toFixed(3) strips float noise, e.g. 1.1 s → 1100 ms (not 1100.0000000000002)
  const ms = Number((ts * (UNIT_TO_MS[unit] ?? 1000)).toFixed(3));
  const d = new Date(ms);

  if (isNaN(d.getTime())) throw new Error('Invalid timestamp');

  return {
    'UTC':        d.toUTCString(),
    'ISO 8601':   d.toISOString(),
    'Local':      d.toLocaleString(undefined, { timeZoneName: 'short' }),
    'Date only':  d.toLocaleDateString(),
    'Time only':  d.toLocaleTimeString(),
    'Unix (s)':   Math.floor(ms / 1000).toString(),
    'Unix (ms)':  ms.toString(),
    'Day of week': d.toLocaleDateString('en-US', { weekday: 'long' }),
    'Week of year': getWeekNumber(d).toString(),
  };
}

/**
 * Convert a Date or ISO string to multiple timestamp formats
 * @param {string|Date} date
 * @returns {Object}
 */
export function dateToFormats(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) throw new Error('Invalid date');

  const ms = d.getTime();
  const sec = Math.floor(ms / 1000);

  return {
    'Unix (seconds)': sec.toString(),
    'Unix (ms)':      ms.toString(),
    'ISO 8601':       d.toISOString(),
    'UTC':            d.toUTCString(),
    'Local':          d.toLocaleString(undefined, { timeZoneName: 'short' }),
    'RFC 2822':       d.toUTCString(),
  };
}

function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

/**
 * Get current timestamp in multiple formats
 */
export function nowFormats() {
  return unixToFormats(Date.now(), 'ms');
}
