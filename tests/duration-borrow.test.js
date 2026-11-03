import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { calcDuration, formatDuration } from "../public/js/services/durationCalculator.js";

describe("calcDuration borrows across units", () => {
  it("10:30:45 to next day 09:15:50 is 22h 45m 5s", () => {
    const d = calcDuration(new Date(2026, 0, 1, 10, 30, 45), new Date(2026, 0, 2, 9, 15, 50));
    assert.deepEqual([d.days, d.hours, d.minutes, d.seconds], [0, 22, 45, 5]);
    assert.equal(formatDuration(d), "22 hours, 45 minutes, 5 seconds");
  });
  it("borrows from months when days and time both go negative", () => {
    const d = calcDuration(new Date(2026, 0, 15, 23, 0, 0), new Date(2026, 1, 15, 1, 0, 0));
    assert.ok([d.years, d.months, d.days, d.hours, d.minutes, d.seconds].every(v => v >= 0));
    assert.deepEqual([d.months, d.days, d.hours], [0, 30, 2]);
  });
  it("same-day span unchanged", () => {
    const d = calcDuration(new Date(2026, 0, 1, 8, 0, 0), new Date(2026, 0, 1, 9, 30, 15));
    assert.deepEqual([d.hours, d.minutes, d.seconds], [1, 30, 15]);
  });
});
