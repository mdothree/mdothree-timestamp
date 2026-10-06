// tests/cronParser.test.js — standard (Vixie) cron semantics.
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseCron, getNextRuns, expandField } from '../public/js/services/cronParser.js';
import { detectUnit, unixToFormats } from '../public/js/services/timestampConverter.js';
import { convertTimezone } from '../public/js/services/timezoneService.js';

const FROM = new Date(2026, 9, 6, 12, 0); // local time
const MIN = { key: 'minute', name: 'minute', min: 0, max: 59 };

describe('cron fields', () => {
  it('lists of ranges', () => assert.deepEqual(expandField('1-3,10', MIN), [1, 2, 3, 10]));
  it('stepped range honours upper bound', () => assert.deepEqual(expandField('1-10/4', MIN), [1, 5, 9]));
  it('out-of-range is invalid', () => assert.equal(parseCron('0 20-30 * * *').valid, false));
  it('names and 7=Sunday', () => {
    assert.equal(parseCron('0 9 * * MON-FRI').valid, true);
    assert.equal(getNextRuns('0 0 * * 7', 1, FROM)[0].getDay(), 0);
  });
});

describe('cron next runs', () => {
  it('yearly schedule is found (search horizon > 69 days)', () => {
    const r = getNextRuns('0 0 1 1 *', 2, FROM);
    assert.equal(r.length, 2);
    assert.equal(r[0].getMonth(), 0); assert.equal(r[0].getDate(), 1);
  });
  it('day-of-month OR day-of-week when both restricted', () => {
    const r = getNextRuns('0 0 1 * 1', 6, FROM);
    assert.ok(r.some(d => d.getDate() === 1 && d.getDay() !== 1), 'includes the 1st');
    assert.ok(r.some(d => d.getDay() === 1 && d.getDate() !== 1), 'includes Mondays');
  });
  it('Feb 29', () => assert.equal(getNextRuns('0 0 29 2 *', 1, FROM)[0].getFullYear(), 2028));
});

describe('timestamp unit detection', () => {
  it('10 digits = s', () => assert.equal(detectUnit('1700000000'), 's'));
  it('13 digits = ms', () => assert.equal(detectUnit('1700000000000'), 'ms'));
  it('16 digits = us', () => assert.equal(detectUnit('1700000000000000'), 'us'));
  it('no float noise', () => assert.equal(unixToFormats(1.1, 's')['Unix (ms)'], '1100'));
});

describe('timezone converter uses the From zone', () => {
  it('10:00 Tokyo = 01:00Z', () => assert.equal(convertTimezone('2026-10-06T10:00', 'Asia/Tokyo', 'America/New_York').iso, '2026-10-06T01:00:00.000Z'));
  it('12:00 Kolkata = 06:30Z', () => assert.equal(convertTimezone('2026-07-01T12:00', 'Asia/Kolkata', 'UTC').iso, '2026-07-01T06:30:00.000Z'));
});
