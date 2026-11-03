import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { getNextRuns } from "../public/js/services/cronParser.js";

const FROM = new Date(2026, 9, 31, 12, 0); // Sat Oct 31 2026, local

describe("cron wildcard day-step restrictions", () => {
  it("*/2 day-of-month with Monday restricts to odd-numbered Mondays", () => {
    // */2 on dom = 1,3,5,...; plus weekday Monday (1): only odd-numbered Mondays
    const runs = getNextRuns("0 9 */2 * 1", 6, FROM);
    assert.equal(runs.length, 6);
    for (const r of runs) {
      assert.equal(r.getDay(), 1, "must be Monday");
      assert.equal(r.getDate() % 2, 1, "day of month must satisfy */2 (odd)");
    }
  });
  it("*/2 day-of-week with day-of-month 1 requires both", () => {
    const runs = getNextRuns("0 9 1 * */2", 4, FROM);
    for (const r of runs) {
      assert.equal(r.getDate(), 1);
      assert.ok([0, 2, 4, 6].includes(r.getDay()));
    }
  });
  it("plain * still unrestricted", () => {
    assert.equal(getNextRuns("0 9 * * 1", 3, FROM).every(r => r.getDay() === 1), true);
  });
});
