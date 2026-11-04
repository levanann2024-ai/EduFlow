const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  ACADEMIC_YEAR,
  CLASS_CODE,
  TIMETABLE,
  areEntriesEqual,
  assertSeedIsExplicitlyEnabled,
  seedClassTimetable,
} = require('./seed-class-11a2-timetable');

test('11A2 seed contains only the supplied semester-one morning entries', () => {
  assert.equal(ACADEMIC_YEAR, '2026-2027');
  assert.equal(CLASS_CODE, '11A2');
  assert.equal(TIMETABLE.semester, 'Kỳ 1');
  assert.equal(TIMETABLE.session, 'morning');
  assert.equal(TIMETABLE.effectiveFrom, '2026-09-07');
  assert.equal(TIMETABLE.periodCount, 5);
  assert.equal(TIMETABLE.entries.length, 21);
  assert.ok(TIMETABLE.entries.every(([weekday, period]) => weekday >= 1 && weekday <= 5 && period >= 1 && period <= 5));
  assert.ok(!TIMETABLE.entries.some(([weekday]) => weekday === 6));
});

test('seed requires explicit opt-in and refuses production', () => {
  const previous = {
    allow: process.env.EDUFLOW_ALLOW_TIMETABLE_SEED,
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
  };
  try {
    delete process.env.EDUFLOW_ALLOW_TIMETABLE_SEED;
    assert.throws(assertSeedIsExplicitlyEnabled, /EDUFLOW_ALLOW_TIMETABLE_SEED=true/);
    process.env.EDUFLOW_ALLOW_TIMETABLE_SEED = 'true';
    process.env.NODE_ENV = 'production';
    assert.throws(assertSeedIsExplicitlyEnabled, /cannot run in production/);
  } finally {
    if (previous.allow === undefined) delete process.env.EDUFLOW_ALLOW_TIMETABLE_SEED;
    else process.env.EDUFLOW_ALLOW_TIMETABLE_SEED = previous.allow;
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.databaseUrl;
  }
});

test('existing entries are compared without changing the timetable', () => {
  const existing = TIMETABLE.entries.map(([weekday, period, subject]) => ({
    weekday,
    period_number: period,
    subject,
  }));
  assert.equal(areEntriesEqual(existing, TIMETABLE.entries), true);
  assert.equal(areEntriesEqual(existing.slice(1), TIMETABLE.entries), false);
  assert.equal(areEntriesEqual([{ weekday: 1, period_number: 1, subject: 'Unknown' }], [[1, 1, 'Toán']]), false);
});

test('new seed writes the timetable and all supplied slots in one transaction', async () => {
  const insertedEntries = [];
  const statements = [];
  const client = {
    async query(sql, values = []) {
      statements.push(sql);
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('information_schema.tables')) return { rows: [{ count: 2 }], rowCount: 1 };
      if (sql.includes('FROM schools')) return {
        rows: [{ id: 'school-id', name: 'Trần Phú Hoàn Kiếm' }],
        rowCount: 1,
      };
      if (sql.includes('FROM classes')) return { rows: [{ id: 'class-id' }], rowCount: 1 };
      if (sql.includes('FROM class_timetables')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO class_timetables')) {
        assert.deepEqual(values.slice(1), ['class-id', 'school-id', 'Kỳ 1', 'morning', '2026-09-07', 5]);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO class_timetable_entries')) {
        insertedEntries.push(values.slice(2));
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const result = await seedClassTimetable(client);
  assert.deepEqual(result, { schoolName: 'Trần Phú Hoàn Kiếm', inserted: true });
  assert.equal(insertedEntries.length, TIMETABLE.entries.length);
  assert.deepEqual(insertedEntries, TIMETABLE.entries);
  assert.equal(statements.at(-1), 'COMMIT');
});

test('rerunning an identical seed verifies existing rows without inserting duplicates', async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('information_schema.tables')) return { rows: [{ count: 2 }], rowCount: 1 };
      if (sql.includes('FROM schools')) return {
        rows: [{ id: 'school-id', name: 'Trần Phú Hoàn Kiếm' }],
        rowCount: 1,
      };
      if (sql.includes('FROM classes')) return { rows: [{ id: 'class-id' }], rowCount: 1 };
      if (sql.includes('FROM class_timetables')) {
        return {
          rows: [{ id: 'timetable-id', session: 'morning', effective_from: '2026-09-07', period_count: 5 }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM class_timetable_entries')) {
        return {
          rows: TIMETABLE.entries.map(([weekday, period, subject]) => ({
            weekday,
            period_number: period,
            subject,
          })),
          rowCount: TIMETABLE.entries.length,
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  const result = await seedClassTimetable(client);
  assert.deepEqual(result, { schoolName: 'Trần Phú Hoàn Kiếm', inserted: false });
  assert.equal(statements.some((sql) => sql.includes('INSERT INTO')), false);
  assert.equal(statements.at(-1), 'COMMIT');
});
