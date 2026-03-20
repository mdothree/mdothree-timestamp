// services/timezoneService.js

export const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Honolulu',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Jakarta',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

/**
 * Format a Date in a given IANA timezone
 * @param {Date} date
 * @param {string} tz
 * @returns {string}
 */
export function formatInTimezone(date, tz) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Get UTC offset label for a timezone at a given date
 * @param {string} tz
 * @param {Date} [date]
 * @returns {string} e.g. "UTC+05:30"
 */
export function getUTCOffset(tz, date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : tz;
  } catch {
    return tz;
  }
}

/**
 * Convert a local datetime string to another timezone
 * @param {string} localDatetime - value from <input type="datetime-local">
 * @param {string} fromTz - source timezone
 * @param {string} toTz - target timezone
 * @returns {{ formatted: string, iso: string }}
 */
export function convertTimezone(localDatetime, fromTz, toTz) {
  // Parse the datetime-local as if it's in fromTz
  const date = new Date(localDatetime);
  if (isNaN(date)) throw new Error('Invalid date/time');

  return {
    formatted: formatInTimezone(date, toTz),
    iso: date.toISOString(),
    offset: getUTCOffset(toTz, date),
  };
}

/**
 * Get current time in multiple timezones
 * @param {string[]} timezones
 * @returns {Array<{ tz, time, offset }>}
 */
export function getCurrentInTimezones(timezones) {
  const now = new Date();
  return timezones.map(tz => ({
    tz,
    time: formatInTimezone(now, tz),
    offset: getUTCOffset(tz, now),
  }));
}
