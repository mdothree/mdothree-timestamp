// services/countdownTimer.js

/**
 * Calculate time remaining until a target date
 * @param {Date|string} target
 * @returns {{ days, hours, minutes, seconds, totalMs, isPast }}
 */
export function getCountdown(target) {
  const t = new Date(target);
  const now = new Date();
  const diff = t - now;
  const isPast = diff < 0;
  const abs = Math.abs(diff);

  return {
    days:     Math.floor(abs / 86400000),
    hours:    Math.floor((abs % 86400000) / 3600000),
    minutes:  Math.floor((abs % 3600000) / 60000),
    seconds:  Math.floor((abs % 60000) / 1000),
    totalMs:  diff,
    isPast,
  };
}

/**
 * Start a live countdown, calling cb every second
 * @param {Date|string} target
 * @param {Function} cb - called with countdown object each tick
 * @returns {Function} stop function
 */
export function startCountdown(target, cb) {
  cb(getCountdown(target));
  const id = setInterval(() => cb(getCountdown(target)), 1000);
  return () => clearInterval(id);
}
