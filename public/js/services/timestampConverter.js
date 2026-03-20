// services/timestampConverter.js

/**
 * Convert Unix timestamp to multiple date formats
 * @param {number} ts - Unix timestamp (seconds or ms)
 * @param {'s'|'ms'} unit
 * @returns {Object} map of format name → formatted string
 */
export function unixToFormats(ts, unit = 's') {
  const ms = unit === 'ms' ? ts : ts * 1000;
  const d = new Date(ms);

  if (isNaN(d.getTime())) throw new Error('Invalid timestamp');

  return {
    'UTC':        d.toUTCString(),
    'ISO 8601':   d.toISOString(),
    'Local':      d.toLocaleString(),
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
    'Local':          d.toLocaleString(),
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
