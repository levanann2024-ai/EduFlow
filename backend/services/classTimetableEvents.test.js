const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  getAcademicYearWeekNumber,
  mergeClassTimetableEvents,
} = require('./classTimetableEvents');

test('academic week numbers follow the September 5 Monday-start rule', () => {
  assert.equal(getAcademicYearWeekNumber('2026-2027', '2026-09-07'), 1);
  assert.equal(getAcademicYearWeekNumber('2026-2027', '2026-10-19'), 7);
  assert.equal(getAcademicYearWeekNumber('2026-2027', '2026-10-26'), 8);
  assert.equal(getAcademicYearWeekNumber('2027-2028', '2027-09-06'), 1);
  assert.equal(getAcademicYearWeekNumber('2025-2026', '2025-09-08'), 1);
  assert.equal(getAcademicYearWeekNumber('2026-2027', '2026-08-31'), null);
});

test('weekly events override, cancel, and add timetable cells without changing the base', () => {
  const baseEntries = [
    { weekday: 1, period: 1, subject: 'Toán', type: 'lesson', title: '', topic: '', dueAt: null },
    { weekday: 1, period: 2, subject: 'Văn', type: 'lesson', title: '', topic: '', dueAt: null },
    { weekday: 2, period: 1, subject: 'Anh', type: 'lesson', title: '', topic: '', dueAt: null },
  ];
  const events = [
    {
      weekday: 1, period_number: 1, operation: 'override', subject: 'Toán',
      lesson_topic: 'Hàm số', has_homework: true, homework_title: 'Bài trang 20',
      homework_due_at: new Date('2026-10-27T12:00:00.000Z'),
      has_exam: true, exam_title: 'Kiểm tra 15 phút',
      exam_starts_at: new Date('2026-10-26T01:00:00.000Z'),
      has_exam_return: true, exam_return_note: 'Trả bài kiểm tra',
      exam_return_at: new Date('2026-10-30T01:00:00.000Z'),
    },
    { weekday: 1, period_number: 2, operation: 'cancel', subject: null },
    { weekday: 2, period_number: 2, operation: 'makeup', subject: 'Hóa học', lesson_topic: 'Phản ứng hóa học' },
  ];

  const result = mergeClassTimetableEvents(baseEntries, events);
  assert.deepEqual(result.map(({ weekday, period, subject }) => ({ weekday, period, subject })), [
    { weekday: 1, period: 1, subject: 'Toán' },
    { weekday: 2, period: 1, subject: 'Anh' },
    { weekday: 2, period: 2, subject: 'Hóa học' },
  ]);
  assert.equal(result[0].hasHomework, true);
  assert.equal(result[0].hasExam, true);
  assert.equal(result[0].hasExamReturn, true);
  assert.equal(result[0].type, 'exam');
  assert.equal(result[2].type, 'makeup');
  assert.equal(baseEntries.length, 3);
});
