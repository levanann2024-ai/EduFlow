const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createNotificationsService } = require('./notifications.service');

test('notification read state is private to the authenticated user', async () => {
  const calls = [];
  const service = createNotificationsService(() => ({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [{ notification_id: 'assignment:one' }] };
    },
  }));

  const readIds = await service.getReadNotificationIds(
    { userId: 'student-one' },
    ['assignment:one', 'assignment:two', 'assignment:one'],
  );

  assert.deepEqual(readIds, ['assignment:one']);
  assert.deepEqual(calls[0].values, ['student-one', ['assignment:one', 'assignment:two']]);
});

test('notification reads are idempotent and demo accounts do not persist state', async () => {
  const calls = [];
  const service = createNotificationsService(() => ({
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  }));

  await service.markNotificationsRead({ userId: 'student-one' }, ['assignment:one']);
  assert.match(calls[0].sql, /ON CONFLICT \(user_id, notification_id\) DO NOTHING/);
  assert.deepEqual(calls[0].values, ['student-one', ['assignment:one']]);
  assert.deepEqual(await service.getReadNotificationIds({ isDemo: true }, ['assignment:one']), []);
  assert.equal(calls.length, 1);
});

test('notification state rejects malformed IDs and oversized batches', async () => {
  const service = createNotificationsService(() => {
    throw new Error('Database should not be queried for invalid IDs.');
  });

  await assert.rejects(
    service.markNotificationsRead({ userId: 'student-one' }, ['']),
    { status: 400, code: 'SCHOOL_INVALID_NOTIFICATION' },
  );
  await assert.rejects(
    service.getReadNotificationIds({ userId: 'student-one' }, Array.from({ length: 101 }, (_, index) => `notice:${index}`)),
    { status: 400, code: 'SCHOOL_INVALID_NOTIFICATION' },
  );
});
