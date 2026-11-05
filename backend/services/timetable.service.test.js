const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  getTeacherTimetable,
  generateStudentTimetableSuggestion,
  mergeTeacherExamRoomNotes,
  mapTeacherTimetableEntries,
  validateStudentSchedulePlan,
  validateTeacherSchedulePlan,
  validateTeacherScheduleInput,
  validateWeekStart,
} = require('./timetable.service');

const validInput = {
  academicYear: '2026-2027',
  semester: 'Kỳ 1',
  weekStart: '2026-10-26',
  session: 'morning',
  periodCount: 5,
  status: 'draft',
  dailyNote: '',
  entries: [{
    weekday: 1,
    period: 1,
    classId: '01234567-89ab-4cde-8fab-0123456789ab',
    subject: 'Hóa học',
    type: 'lesson',
    title: '',
    topic: '',
    dueAt: null,
  }],
};

test('week start must be a real Monday', () => {
  assert.equal(validateWeekStart('2026-10-26'), '2026-10-26');
  assert.throws(() => validateWeekStart('2026-10-25'), { code: 'SCHOOL_INVALID_WEEK' });
  assert.throws(() => validateWeekStart('2026-02-31'), { code: 'SCHOOL_INVALID_WEEK' });
});

test('teacher timetable input accepts assigned-period shape and trims text', () => {
  const parsed = validateTeacherScheduleInput({
    ...validInput,
    dailyNote: '  Chấm bài sau giờ dạy  ',
    entries: [{ ...validInput.entries[0], title: '  Bài học  ', topic: '  Nội dung  ' }],
  });
  assert.equal(parsed.dailyNote, '  Chấm bài sau giờ dạy  ');
  assert.equal(parsed.entries[0].title, 'Bài học');
  assert.equal(parsed.entries[0].topic, 'Nội dung');
  assert.equal(parsed.entries[0].hasHomework, false);
  assert.equal(parsed.entries[0].hasExam, false);
  assert.equal(parsed.entries[0].hasExamReturn, false);
});

test('teacher timetable input rejects duplicate cells and invalid entry types', () => {
  assert.throws(
    () => validateTeacherScheduleInput({
      ...validInput,
      entries: [validInput.entries[0], validInput.entries[0]],
    }),
    { code: 'SCHOOL_DUPLICATE_TIMETABLE_SLOT' },
  );
  assert.throws(
    () => validateTeacherScheduleInput({
      ...validInput,
      entries: [{ ...validInput.entries[0], type: 'unknown' }],
    }),
    { code: 'SCHOOL_INVALID_TIMETABLE_ENTRY' },
  );
});

test('teacher timetable input supports multiple cell activities and explicit cancellations', () => {
  const parsed = validateTeacherScheduleInput({
    ...validInput,
    entries: [{
      ...validInput.entries[0],
      hasHomework: true,
      homeworkTitle: 'Bài tập chương 2',
      homeworkDueAt: '2026-10-27T12:00:00.000Z',
      hasExam: true,
      examTitle: 'Kiểm tra 15 phút',
      examStartsAt: '2026-10-26T01:00:00.000Z',
      hasExamReturn: true,
      examReturnNote: 'Trả bài',
      examReturnAt: '2026-10-30T01:00:00.000Z',
    }],
  });
  assert.equal(parsed.entries[0].hasHomework, true);
  assert.equal(parsed.entries[0].hasExam, true);
  assert.equal(parsed.entries[0].hasExamReturn, true);

  const cancelled = validateTeacherScheduleInput({
    ...validInput,
    entries: [{ ...validInput.entries[0], type: 'cancelled' }],
  });
  assert.equal(cancelled.entries[0].type, 'cancelled');

  assert.throws(
    () => validateTeacherScheduleInput({
      ...validInput,
      entries: [{ ...validInput.entries[0], hasExam: 'yes' }],
    }),
    { code: 'SCHOOL_INVALID_TIMETABLE_ENTRY' },
  );
});

test('teacher timetable template keeps recurring cells but clears week-specific details', () => {
  const [entry] = mapTeacherTimetableEntries([{
    weekday: 2,
    period_number: 3,
    class_id: 'class-id',
    class_code: '11A2',
    class_name: '11A2',
    is_homeroom: true,
    subject: 'Hóa học',
    entry_type: 'cancelled',
    is_cancelled: true,
    title: 'Bài kiểm tra cũ',
    topic: 'Nội dung tuần trước',
    due_at: new Date('2026-10-20T00:00:00.000Z'),
    has_homework: true,
    homework_title: 'Bài tập cũ',
    homework_due_at: new Date('2026-10-20T00:00:00.000Z'),
    has_exam: true,
    exam_title: 'Bài kiểm tra',
    exam_starts_at: new Date('2026-10-20T00:00:00.000Z'),
    has_exam_return: true,
    exam_return_note: 'Trả bài cũ',
    exam_return_at: new Date('2026-10-20T00:00:00.000Z'),
  }], new Set(['class-id']), true);

  assert.equal(entry.weekday, 2);
  assert.equal(entry.period, 3);
  assert.equal(entry.classId, 'class-id');
  assert.equal(entry.subject, 'Hóa học');
  assert.equal(entry.type, 'lesson');
  assert.equal(entry.isHomeroom, true);
  assert.equal(entry.topic, '');
  assert.equal(entry.hasHomework, false);
  assert.equal(entry.hasExam, false);
  assert.equal(entry.hasExamReturn, false);
  assert.equal(entry.dueAt, null);
});

test('teacher exam-room notes merge with existing entries and do not replace another class', () => {
  const entries = [{
    weekday: 1,
    period: 1,
    classId: 'class-id',
    classCode: '11A2',
    className: 'Lớp 11A2',
    isHomeroom: false,
    subject: 'Toán học',
    type: 'lesson',
    title: '',
    topic: 'Hàm số',
    dueAt: null,
    hasHomework: true,
    homeworkTitle: 'Bài tập',
    homeworkDueAt: null,
    hasExam: false,
    examTitle: '',
    examStartsAt: null,
    hasExamReturn: false,
    examReturnNote: '',
    examReturnAt: null,
  }];
  const events = [
    {
      weekday: 1,
      period_number: 1,
      class_id: 'class-id',
      class_code: '11A2',
      class_name: 'Lớp 11A2',
      is_homeroom: false,
      subject: 'Toán học',
      exam_title: 'Kiểm tra chương 1',
    },
    {
      weekday: 1,
      period_number: 2,
      class_id: 'other-class',
      class_code: '11A3',
      class_name: 'Lớp 11A3',
      is_homeroom: false,
      subject: 'Hóa học',
      exam_title: 'Kiểm tra hóa',
    },
    {
      weekday: 1,
      period_number: 1,
      class_id: 'another-class',
      class_code: '11A4',
      class_name: 'Lớp 11A4',
      is_homeroom: false,
      subject: 'Ngữ văn',
      exam_title: 'Kiểm tra văn',
    },
  ];

  const merged = mergeTeacherExamRoomNotes(entries, events);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].roomExamTitle, 'Kiểm tra chương 1');
  assert.equal(merged[0].topic, 'Hàm số');
  assert.equal(merged[0].homeworkTitle, 'Bài tập');
  assert.equal(merged[0].hasExam, false);
  assert.equal(merged[1].roomExamTitle, 'Kiểm tra hóa');
  assert.equal(merged[1].classId, 'other-class');
});

test('teacher and student timetable operations reject cross-role access before database access', async () => {
  await assert.rejects(
    getTeacherTimetable({ userId: 'student', role: 'student' }, {}),
    { code: 'SCHOOL_ROLE_FORBIDDEN' },
  );
  await assert.rejects(
    generateStudentTimetableSuggestion({ userId: 'teacher', role: 'lecturer' }, {}),
    { code: 'SCHOOL_ROLE_FORBIDDEN' },
  );
  await assert.rejects(
    generateStudentTimetableSuggestion({ userId: 'student', role: 'student' }, {
      semester: 'Kỳ 1',
      weekStart: '2026-10-26',
      tomorrowWeekday: 1,
      availability: '  ',
    }),
    { code: 'SCHOOL_INVALID_STUDENT_PLAN' },
  );
});

test('student schedule plan validates and trims structured priorities and timeline items', () => {
  const plan = validateStudentSchedulePlan({
    overview: '  Kế hoạch ngắn gọn  ',
    lifeBalanceTip: '  Nghỉ ngắn giữa các buổi học nhé.  ',
    dataNotes: ['  Chưa có tên bài học ngày mai.  '],
    priorities: [
      { task: '  Hoàn thành bài tập  ', reason: '  Hạn gần nhất  ', durationMinutes: 45 },
      { task: 'Ôn bài kiểm tra', reason: 'Bài kiểm tra sắp tới', durationMinutes: 30 },
      { task: 'Ôn lại kiến thức', reason: 'Cần củng cố môn học', durationMinutes: 25 },
    ],
    timeline: [{
      weekday: 2,
      startTime: '19:00',
      endTime: '19:30',
      activity: '  Ôn tập bài học  ',
      kind: 'review',
    }],
  });

  assert.equal(plan.overview, 'Kế hoạch ngắn gọn');
  assert.equal(plan.lifeBalanceTip, 'Nghỉ ngắn giữa các buổi học nhé.');
  assert.equal(plan.dataNotes[0], 'Chưa có tên bài học ngày mai.');
  assert.equal(plan.priorities.length, 3);
  assert.equal(plan.timeline[0].activity, 'Ôn tập bài học');
});

test('student schedule plan rejects invalid priority and timeline data', () => {
  const validPlan = {
    overview: 'Kế hoạch ngắn gọn',
    lifeBalanceTip: '',
    dataNotes: [],
    priorities: [
      { task: 'Bài tập', reason: 'Hạn gần', durationMinutes: 30 },
      { task: 'Ôn tập', reason: 'Sắp kiểm tra', durationMinutes: 30 },
      { task: 'Củng cố', reason: 'Điểm cần cải thiện', durationMinutes: 30 },
    ],
    timeline: [],
  };
  assert.throws(
    () => validateStudentSchedulePlan({ ...validPlan, priorities: validPlan.priorities.slice(0, 2) }),
    { code: 'SCHOOL_INVALID_AI_STUDENT_PLAN' },
  );
  assert.throws(
    () => validateStudentSchedulePlan({
      ...validPlan,
      timeline: [{ weekday: 8, startTime: '19:00', endTime: '19:30', activity: 'Ôn bài', kind: 'review' }],
    }),
    { code: 'SCHOOL_INVALID_AI_STUDENT_PLAN' },
  );
});

test('teacher schedule plan validates structured priorities and weekly timeline', () => {
  const plan = validateTeacherSchedulePlan({
    overview: '  Kế hoạch công việc trong tuần.  ',
    dataNotes: ['Chưa có giờ dạy chi tiết.'],
    priorities: [
      { task: 'Chấm bài kiểm tra', reason: 'Có bài đã nộp cần phản hồi.', durationMinutes: 60 },
      { task: 'Soạn bài Hóa', reason: 'Chuẩn bị cho tiết sắp tới.', durationMinutes: 45 },
      { task: 'Rà soát bài tập', reason: 'Kiểm tra tình trạng nộp bài.', durationMinutes: 30 },
    ],
    timeline: [{
      weekday: 3,
      startTime: '19:00',
      endTime: '19:45',
      activity: '  Soạn bài Hóa  ',
      kind: 'prep',
    }],
  });

  assert.equal(plan.overview, 'Kế hoạch công việc trong tuần.');
  assert.equal(plan.priorities.length, 3);
  assert.equal(plan.timeline[0].activity, 'Soạn bài Hóa');
});

test('teacher schedule plan rejects malformed times and unsupported activity kinds', () => {
  const validPlan = {
    overview: 'Kế hoạch công việc trong tuần.',
    dataNotes: [],
    priorities: [
      { task: 'Chấm bài', reason: 'Bài đã nộp.', durationMinutes: 60 },
      { task: 'Soạn bài', reason: 'Chuẩn bị tiết dạy.', durationMinutes: 45 },
      { task: 'Rà soát', reason: 'Theo dõi tiến độ.', durationMinutes: 30 },
    ],
    timeline: [],
  };
  assert.throws(
    () => validateTeacherSchedulePlan({
      ...validPlan,
      timeline: [{ weekday: 2, startTime: '25:00', endTime: '26:00', activity: 'Soạn bài', kind: 'prep' }],
    }),
    { code: 'SCHOOL_INVALID_AI_TEACHER_PLAN' },
  );
  assert.throws(
    () => validateTeacherSchedulePlan({
      ...validPlan,
      timeline: [{ weekday: 2, startTime: '19:00', endTime: '20:00', activity: 'Soạn bài', kind: 'unknown' }],
    }),
    { code: 'SCHOOL_INVALID_AI_TEACHER_PLAN' },
  );
});
