const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  ACADEMIC_YEAR,
  CLASS_CODES,
  DRAFT_ENTRIES,
  SEMESTER,
  SUBJECT,
  assertSeedIsExplicitlyEnabled,
  currentWeekStart,
  seedTeacherTimetable,
} = require('./seed-teacher-duc-timetable');

test('teacher timetable seed is a current-week morning draft using only assigned classes', () => {
  const weekStart = currentWeekStart();
  assert.match(weekStart, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(ACADEMIC_YEAR, '2026-2027');
  assert.equal(SEMESTER, 'Kỳ 1');
  assert.equal(SUBJECT, 'Hóa học');
  assert.deepEqual(new Set(DRAFT_ENTRIES.map(([, , classCode]) => classCode)), new Set(CLASS_CODES));
  assert.deepEqual(
    DRAFT_ENTRIES.filter(([, , classCode]) => classCode === '11A2').map(([weekday, period]) => [weekday, period]),
    [[1, 2], [2, 1]],
  );
  assert.ok(DRAFT_ENTRIES.every(([weekday, period]) => weekday >= 1 && weekday <= 5 && period >= 1 && period <= 5));
});

test('teacher timetable seed requires an explicit non-production opt-in', () => {
  const previous = {
    allow: process.env.EDUFLOW_ALLOW_TEACHER_TIMETABLE_SEED,
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
  };
  try {
    delete process.env.EDUFLOW_ALLOW_TEACHER_TIMETABLE_SEED;
    assert.throws(assertSeedIsExplicitlyEnabled, /EDUFLOW_ALLOW_TEACHER_TIMETABLE_SEED=true/);
    process.env.EDUFLOW_ALLOW_TEACHER_TIMETABLE_SEED = 'true';
    process.env.NODE_ENV = 'production';
    assert.throws(assertSeedIsExplicitlyEnabled, /cannot run in production/);
  } finally {
    if (previous.allow === undefined) delete process.env.EDUFLOW_ALLOW_TEACHER_TIMETABLE_SEED;
    else process.env.EDUFLOW_ALLOW_TEACHER_TIMETABLE_SEED = previous.allow;
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.databaseUrl;
  }
});

test('teacher timetable seed writes a transactionally protected estimated schedule', async () => {
  const statements = [];
  const inserted = [];
  const classIds = { '11A2': 'class-11a2', '11A5': 'class-11a5', '12A1': 'class-12a1' };
  const client = {
    async query(sql, values = []) {
      statements.push(sql);
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
      if (sql.includes('information_schema.tables')) return { rows: [{ count: 2 }], rowCount: 1 };
      if (sql.includes('FROM schools')) return { rows: [{ id: 'school-id', name: 'Trần Phú Hoàn Kiếm' }], rowCount: 1 };
      if (sql.includes('JOIN class_homeroom_assignments')) {
        return { rows: [{ teacher_user_id: 'teacher-id', full_name: 'Nguyễn Đức' }], rowCount: 1 };
      }
      if (sql.includes('JOIN teacher_class_assignments')) {
        return {
          rows: CLASS_CODES.map((code) => ({ id: classIds[code], code })),
          rowCount: CLASS_CODES.length,
        };
      }
      if (sql.includes('FROM class_timetables')) return { rows: [{ id: 'class-timetable-id' }], rowCount: 1 };
      if (sql.includes('FROM class_timetable_entries')) {
        return {
          rows: [
            { weekday: 1, period_number: 2, subject: SUBJECT },
            { weekday: 2, period_number: 1, subject: SUBJECT },
          ],
          rowCount: 2,
        };
      }
      if (sql.includes('FROM teacher_weekly_timetables')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO teacher_weekly_timetables')) {
        assert.deepEqual(values.slice(1, 5), ['teacher-id', 'school-id', ACADEMIC_YEAR, SEMESTER]);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO teacher_weekly_timetable_entries')) {
        inserted.push(values.slice(2));
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected seed query: ${sql}`);
    },
  };

  const result = await seedTeacherTimetable(client);
  assert.deepEqual(result, { status: 'seeded', weekStart: currentWeekStart() });
  assert.equal(inserted.length, DRAFT_ENTRIES.length);
  assert.equal(statements.at(-1), 'COMMIT');
});
