const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const poolModulePath = require.resolve('../db/pool');
const poolModule = new Module(poolModulePath);
poolModule.filename = poolModulePath;
poolModule.loaded = true;
const queries = [];
let hasClass = true;
let hasTimetable = true;
let hasPublishedTeacherEntries = false;
let weekEventRows = [];
poolModule.exports = {
  getPool: () => ({
    async query(sql, values = []) {
      const query = sql.replace(/\s+/g, ' ').trim();
      queries.push({ query, values });
      if (query.startsWith('SELECT u.role, u.status, COUNT(DISTINCT s.id)')) {
        return { rowCount: 1, rows: [{ role: 'student', status: 'active', active_school_count: 1, school_id: 'school-id' }] };
      }
      if (query.startsWith('SELECT c.id, c.code, c.name, c.academic_year')) {
        return hasClass
          ? { rowCount: 1, rows: [{ id: 'class-id', code: '11A2', name: 'Lớp 11A2', academic_year: '2026-2027' }] }
          : { rowCount: 0, rows: [] };
      }
      if (query.startsWith('SELECT id, semester, session, to_char(effective_from')) {
        return hasTimetable
          ? { rowCount: 1, rows: [{ id: 'timetable-id', semester: 'Kỳ 1', session: 'morning', effective_from: '2026-09-07', period_count: 5 }] }
          : { rowCount: 0, rows: [] };
      }
      if (query.startsWith('SELECT weekday, period_number, subject')) {
        return { rowCount: 1, rows: [{ weekday: 1, period_number: 1, subject: 'CHAOCO' }] };
      }
      if (query.includes('FROM teacher_weekly_timetables tt')) {
        return hasPublishedTeacherEntries
          ? {
            rowCount: 1,
            rows: [{ session: 'morning', period_count: 5 }],
          }
          : { rowCount: 0, rows: [] };
      }
      if (query.includes('FROM class_timetable_events')) {
        return { rowCount: weekEventRows.length, rows: weekEventRows };
      }
      throw new Error(`Unexpected timetable query: ${query}`);
    },
  }),
};
require.cache[poolModulePath] = poolModule;

const { getStudentTimetable } = require('./school.service');

test('student timetable is scoped to the authenticated student and requested semester', async () => {
  queries.length = 0;
  hasClass = true;
  hasTimetable = true;
  const result = await getStudentTimetable({ userId: 'authenticated-student', role: 'student' }, 'Kỳ 1');

  assert.deepEqual(result, {
    weekNumber: null,
    classroom: { id: 'class-id', code: '11A2', name: 'Lớp 11A2', academicYear: '2026-2027' },
    timetable: {
      semester: 'Kỳ 1',
      session: 'morning',
      effectiveFrom: '2026-09-07',
      periodCount: 5,
      entries: [{
        weekday: 1,
        period: 1,
        subject: 'CHAOCO',
        type: 'lesson',
        title: '',
        topic: '',
        dueAt: null,
      }],
    },
  });
  const membershipQuery = queries.find(({ query }) => query.includes('FROM class_memberships cm'));
  assert.deepEqual(membershipQuery.values, ['authenticated-student', 'school-id']);
  const timetableQuery = queries.find(({ query }) => query.includes('FROM class_timetables'));
  assert.deepEqual(timetableQuery.values, ['class-id', 'school-id', 'Kỳ 1']);
});

test('missing class or semester timetable is returned as missing data, not fabricated', async () => {
  queries.length = 0;
  hasClass = false;
  assert.deepEqual(
    await getStudentTimetable({ userId: 'authenticated-student', role: 'student' }, 'Kỳ 1'),
    { classroom: null, timetable: null, weekNumber: null },
  );

  hasClass = true;
  hasTimetable = false;
  hasPublishedTeacherEntries = false;
  assert.deepEqual(
    await getStudentTimetable({ userId: 'authenticated-student', role: 'student' }, 'Kỳ 2'),
    {
      classroom: { id: 'class-id', code: '11A2', name: 'Lớp 11A2', academicYear: '2026-2027' },
      timetable: null,
      weekNumber: null,
    },
  );
});

test('published teacher lessons are available to class members when no class timetable exists', async () => {
  hasClass = true;
  hasTimetable = false;
  hasPublishedTeacherEntries = true;
  weekEventRows = [{
    weekday: 1,
    period_number: 2,
    operation: 'override',
    subject: 'Hóa học',
    title: '',
    lesson_topic: 'Phản ứng hóa học',
    has_homework: false,
    homework_title: '',
    homework_due_at: null,
    has_exam: false,
    exam_title: '',
    exam_starts_at: null,
    has_exam_return: false,
    exam_return_note: '',
    exam_return_at: null,
  }];
  const result = await getStudentTimetable(
    { userId: 'authenticated-student', role: 'student' },
    'Kỳ 1',
    '2026-10-26',
  );
  assert.equal(result.timetable?.session, 'morning');
  assert.equal(result.weekNumber, 8);
  assert.deepEqual(result.timetable?.entries, [{
    weekday: 1,
    period: 2,
    subject: 'Hóa học',
    type: 'lesson',
    title: '',
    topic: 'Phản ứng hóa học',
    dueAt: null,
    hasHomework: false,
    homeworkTitle: '',
    homeworkDueAt: null,
    hasExam: false,
    examTitle: '',
    examStartsAt: null,
    hasExamReturn: false,
    examReturnNote: '',
    examReturnAt: null,
  }]);
  hasPublishedTeacherEntries = false;
  weekEventRows = [];
});

test('student timetable merges date-specific events into the recurring class skeleton', async () => {
  hasClass = true;
  hasTimetable = true;
  weekEventRows = [
    {
      weekday: 1,
      period_number: 1,
      operation: 'override',
      subject: 'CHAOCO',
      title: '',
      lesson_topic: 'Chủ đề tuần này',
      has_homework: true,
      homework_title: 'Bài trang 20',
      homework_due_at: new Date('2026-10-27T12:00:00.000Z'),
      has_exam: false,
      exam_title: '',
      exam_starts_at: null,
      has_exam_return: false,
      exam_return_note: '',
      exam_return_at: null,
    },
    {
      weekday: 1,
      period_number: 2,
      operation: 'makeup',
      subject: 'Hóa học',
      title: '',
      lesson_topic: 'Phản ứng hóa học',
      has_homework: false,
      homework_title: '',
      homework_due_at: null,
      has_exam: false,
      exam_title: '',
      exam_starts_at: null,
      has_exam_return: false,
      exam_return_note: '',
      exam_return_at: null,
    },
  ];
  queries.length = 0;
  const result = await getStudentTimetable(
    { userId: 'authenticated-student', role: 'student' },
    'Kỳ 1',
    '2026-10-26',
  );
  assert.equal(result.weekNumber, 8);
  assert.deepEqual(result.timetable?.entries.map((entry) => [entry.weekday, entry.period, entry.subject]), [
    [1, 1, 'CHAOCO'],
    [1, 2, 'Hóa học'],
  ]);
  assert.equal(result.timetable?.entries[0].topic, 'Chủ đề tuần này');
  assert.equal(result.timetable?.entries[0].hasHomework, true);
  assert.equal(result.timetable?.entries[0].homeworkDueAt, '2026-10-27T12:00:00.000Z');
  const eventQuery = queries.find(({ query }) => query.includes('FROM class_timetable_events'));
  assert.deepEqual(eventQuery.values, ['class-id', 'school-id', '2026-2027', 'Kỳ 1', '2026-10-26']);
  weekEventRows = [];
});

test('timetable service rejects other roles and invalid semester values', async () => {
  queries.length = 0;
  await assert.rejects(
    getStudentTimetable({ userId: 'teacher', role: 'lecturer' }, 'Kỳ 1'),
    { code: 'SCHOOL_ROLE_FORBIDDEN' },
  );
  await assert.rejects(
    getStudentTimetable({ userId: 'authenticated-student', role: 'student' }, 'unknown'),
    { code: 'SCHOOL_INVALID_SEMESTER' },
  );
  await assert.rejects(
    getStudentTimetable({ userId: 'authenticated-student', role: 'student' }, 'Kỳ 1', '2026-10-25'),
    { code: 'SCHOOL_INVALID_WEEK' },
  );
  assert.equal(queries.length, 0);
});
