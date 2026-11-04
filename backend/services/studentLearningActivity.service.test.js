const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createStudentLearningActivityService } = require('./studentLearningActivity.service');

test('records only allowed activity types and makes event retries idempotent', async () => {
  const calls = [];
  const service = createStudentLearningActivityService(() => ({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  }));
  const eventKey = '9d70447b-52ee-4bcc-87bc-423510e17129';

  await service.recordActivity({ userId: 'student-id' }, 'exam_submit', eventKey);

  assert.match(calls[0].sql, /ON CONFLICT \(user_id, event_key\) DO NOTHING/);
  assert.deepEqual(calls[0].values, ['student-id', eventKey, 'exam_submit']);
  await assert.rejects(
    service.recordActivity({ userId: 'student-id' }, 'login', eventKey),
    { status: 400, code: 'SCHOOL_INVALID_ACTIVITY' },
  );
  assert.equal(calls.length, 1);
});

test('returns seven daily activity counts scoped to the current user', async () => {
  let queryValues;
  const service = createStudentLearningActivityService(() => ({
    async query(sql, values) {
      queryValues = values;
      assert.match(sql, /Asia\/Ho_Chi_Minh/);
      return {
        rows: [
          { activity_date: '2026-11-02', activity_count: 2 },
          { activity_date: '2026-11-03', activity_count: 0 },
          { activity_date: '2026-11-04', activity_count: 1 },
          { activity_date: '2026-11-05', activity_count: 0 },
          { activity_date: '2026-11-06', activity_count: 0 },
          { activity_date: '2026-11-07', activity_count: 0 },
          { activity_date: '2026-11-08', activity_count: 0 },
        ],
      };
    },
  }));

  const activity = await service.getWeeklyActivity({ userId: 'student-id' });

  assert.deepEqual(queryValues, ['student-id']);
  assert.equal(activity.days.length, 7);
  assert.equal(activity.activeDays, 2);
  assert.equal(activity.activityCount, 3);
});
