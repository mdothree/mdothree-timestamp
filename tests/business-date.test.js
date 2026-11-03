process.env.TZ = "America/Los_Angeles"; // negative UTC offset exposes UTC-parse vs local-arithmetic mixing
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
const { countBusinessDays, addBusinessDays, formatDateOnly } = await import("../public/js/utils/dateUtils.js");

describe("business-day date-only inputs", () => {
  it("Mon..Fri counts 5 business days", () => assert.equal(countBusinessDays("2026-11-02", "2026-11-06"), 5));
  it("single Monday counts 1", () => assert.equal(countBusinessDays("2026-11-02", "2026-11-02"), 1));
  it("Saturday..Sunday counts 0", () => assert.equal(countBusinessDays("2026-11-07", "2026-11-08"), 0));
  it("holiday date-only string is excluded", () => assert.equal(countBusinessDays("2026-11-02", "2026-11-06", ["2026-11-04"]), 4));
  it("Fri + 1 business day = next Monday", () => assert.equal(formatDateOnly(addBusinessDays("2026-11-06", 1)), "2026-11-09"));
});
