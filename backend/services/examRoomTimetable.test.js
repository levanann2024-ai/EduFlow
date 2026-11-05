const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getExamPeriodSlot } = require('./examRoomTimetable');

test('maps each weekday class period in Vietnam time to its date and period', () => {
  const cases = [
    ['2026-11-02T00:15:00.000Z', { eventDate: '2026-11-02', weekday: 1, period: 1 }],
    ['2026-11-03T01:15:00.000Z', { eventDate: '2026-11-03', weekday: 2, period: 2 }],
    ['2026-11-04T02:10:00.000Z', { eventDate: '2026-11-04', weekday: 3, period: 3 }],
    ['2026-11-05T03:00:00.000Z', { eventDate: '2026-11-05', weekday: 4, period: 4 }],
    ['2026-11-06T04:44:00.000Z', { eventDate: '2026-11-06', weekday: 5, period: 5 }],
  ];

  for (const [startsAt, expected] of cases) {
    assert.deepEqual(getExamPeriodSlot(startsAt), expected);
  }
});

test('uses inclusive starts and exclusive ends for class periods', () => {
  assert.deepEqual(getExamPeriodSlot('2026-11-02T00:15:00.000Z'), {
    eventDate: '2026-11-02', weekday: 1, period: 1,
  });
  assert.equal(getExamPeriodSlot('2026-11-02T01:00:00.000Z'), null);
  assert.equal(getExamPeriodSlot('2026-11-02T01:14:00.000Z'), null);
  assert.equal(getExamPeriodSlot('2026-11-02T01:15:00.000Z').period, 2);
  assert.equal(getExamPeriodSlot('2026-11-02T04:45:00.000Z'), null);
});

test('ignores weekends, after-school times, and invalid timestamps', () => {
  assert.equal(getExamPeriodSlot('2026-11-07T00:15:00.000Z'), null);
  assert.equal(getExamPeriodSlot('2026-11-08T00:15:00.000Z'), null);
  assert.equal(getExamPeriodSlot('2026-11-02T05:00:00.000Z'), null);
  assert.equal(getExamPeriodSlot('invalid'), null);
});
