const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  getTeacherTimetable,
  generateStudentTimetableSuggestion,
  getStudentAvailabilityInstructions,
  addDateDays,
  filterStudentTimeline,
  getVietnamDateTime,
  getWeekStartForDate,
  mapTeacherClass,
  mergeTeacherExamRoomNotes,
  mapTeacherTimetableEntries,
  parseAvailabilityWindows,
  validateStudentSchedulePlan,
  validateStudentScheduleInputs,
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

test('homeroom teacher classes allow Sinh hoạt without changing assigned subjects', () => {
  const homeroom = mapTeacherClass({
    id: 'class-id',
    code: '11A2',
    name: 'Lớp 11A2',
    grade: '11',
    academic_year: '2026-2027',
    is_homeroom: true,
    subjects: ['Hóa học'],
  });
  assert.deepEqual(homeroom.subjects, ['Hóa học', 'Sinh hoạt']);

  const alreadyAssigned = mapTeacherClass({
    id: 'class-id',
    code: '11A2',
    name: 'Lớp 11A2',
    grade: '11',
    academic_year: '2026-2027',
    is_homeroom: true,
    subjects: ['Hóa học', 'Sinh hoạt'],
  });
  assert.deepEqual(alreadyAssigned.subjects, ['Hóa học', 'Sinh hoạt']);

  const nonHomeroom = mapTeacherClass({
    id: 'other-class',
    code: '11A3',
    name: 'Lớp 11A3',
    grade: '11',
    academic_year: '2026-2027',
    is_homeroom: false,
    subjects: ['Hóa học'],
  });
  assert.deepEqual(nonHomeroom.subjects, ['Hóa học']);
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
  await assert.rejects(
    generateStudentTimetableSuggestion({ userId: 'student', role: 'student' }, {
      semester: 'Kỳ 1',
      weekStart: '2026-10-26',
      tomorrowWeekday: 1,
      availability: 'Thời gian bận: Thứ 3, 18:00-20:00',
      remainingTimeIsFree: 'yes',
    }),
    { code: 'SCHOOL_INVALID_STUDENT_PLAN' },
  );
});

test('student schedule availability instructions follow the selected remaining-time rule', () => {
  const enabledInstructions = getStudentAvailabilityInstructions(true).join(' ');
  assert.match(enabledInstructions, /đến hết ngày thứ 7 của cửa sổ/);
  assert.match(enabledInstructions, /khung bận/);
  assert.match(enabledInstructions, /07:00 đến 21:00/);

  const disabledInstructions = getStudentAvailabilityInstructions(false).join(' ');
  assert.match(disabledInstructions, /khung giờ rảnh có ngày và giờ cụ thể/);
  assert.match(disabledInstructions, /timeline để rỗng/);
});

test('student schedule plan validates and trims structured priorities and timeline items', () => {
  const plan = validateStudentSchedulePlan({
    overview: '  Kế hoạch ngắn gọn  ',
    lifeBalanceTip: '  Nghỉ ngắn giữa các buổi học nhé.  ',
    startDate: '2026-11-14',
    priorities: [
      { task: '  Hoàn thành bài tập  ', reason: '  Hạn gần nhất  ', durationMinutes: 45 },
      { task: 'Ôn bài kiểm tra', reason: 'Bài kiểm tra sắp tới', durationMinutes: 30 },
      { task: 'Ôn lại kiến thức', reason: 'Cần củng cố môn học', durationMinutes: 25 },
    ],
    timeline: [{
      date: '2026-11-15',
      startTime: '19:00',
      endTime: '19:30',
      activity: '  Ôn tập bài học  ',
      kind: 'review',
    }],
  });

  assert.equal(plan.overview, 'Kế hoạch ngắn gọn');
  assert.equal(plan.lifeBalanceTip, 'Nghỉ ngắn giữa các buổi học nhé.');
  assert.equal(plan.startDate, '2026-11-14');
  assert.equal(plan.priorities.length, 3);
  assert.deepEqual(plan.adjustments, []);
  assert.equal(plan.timeline[0].activity, 'Ôn tập bài học');
});

test('student schedule personal settings validate optional preferences and commitments', () => {
  const parsed = validateStudentScheduleInputs({
    studyPreferences: {
      subjectCombination: 'Toán - Hoá - Tin',
      dailyStudyMinutes: 120,
      sessionMinutes: 45,
      preferredStudyTime: 'evening',
      customStudyTime: '',
      habitNotes: 'Học tốt hơn theo phiên ngắn.',
    },
    externalCommitments: [
      { title: 'Bài tập trung tâm', date: '2026-11-18', priority: 'high' },
    ],
  });
  assert.equal(parsed.studyPreferences.subjectCombination, 'Toán - Hoá - Tin');
  assert.equal(parsed.studyPreferences.dailyStudyMinutes, 120);
  assert.equal(parsed.externalCommitments[0].title, 'Bài tập trung tâm');
  assert.throws(
    () => validateStudentScheduleInputs({
      studyPreferences: { dailyStudyMinutes: 10 },
    }),
    { code: 'SCHOOL_INVALID_STUDENT_PLAN_INPUTS' },
  );
  assert.throws(
    () => validateStudentScheduleInputs({
      externalCommitments: [{
        title: 'Lịch bị sai',
        type: 'fixed',
        date: '2026-11-17',
        priority: 'high',
      }],
    }),
    { code: 'SCHOOL_INVALID_STUDENT_PLAN_INPUTS' },
  );
});

test('student plan passes personal context to AI and filters conflicting or overlong study sessions', async () => {
  let promptContext;
  const generated = {
    overview: 'Kế hoạch theo ưu tiên bạn chọn.',
    lifeBalanceTip: '',
    startDate: '2026-11-14',
    deadlinePreparation: [{
      title: 'Nộp web, thuyết trình cuộc thi NKCH cấp thành phố vòng chung kết',
      importance: 'major',
      minutesPerDay: 120,
      daysPerWeek: 5,
    }],
    priorities: [
      { task: 'Hoàn thành bài tập', reason: 'Có hạn gần.', durationMinutes: 30 },
      { task: 'Chuẩn bị kiểm tra', reason: 'Đã có lịch kiểm tra.', durationMinutes: 30 },
      { task: 'Ôn tập củng cố môn Ngữ văn và Toán học', reason: 'Cần dàn trải thêm môn.', durationMinutes: 30 },
    ],
    adjustments: [],
    timeline: [
      { date: '2026-11-15', startTime: '18:00', endTime: '20:00', activity: 'Phiên quá dài', kind: 'review' },
      { date: '2026-11-15', startTime: '19:30', endTime: '20:00', activity: 'Trùng lịch thêm', kind: 'study' },
      { date: '2026-11-15', startTime: '20:00', endTime: '20:30', activity: 'Ôn Toán', kind: 'review' },
      { date: '2026-11-15', startTime: '20:30', endTime: '21:00', activity: 'Luyện Toán', kind: 'study' },
      { date: '2026-11-15', startTime: '21:00', endTime: '21:30', activity: 'Vượt giới hạn ngày', kind: 'study' },
      { date: '2026-11-17', startTime: '18:30', endTime: '21:30', activity: 'Khung giờ bận cá nhân', kind: 'personal' },
      { date: '2026-11-15', startTime: '14:30', endTime: '15:00', activity: 'Ôn Ngữ văn', kind: 'review' },
    ],
  };
  const result = await generateStudentTimetableSuggestion(
    { userId: 'student', role: 'student' },
    {
      semester: 'Kỳ 1',
      availability: [
        'Thời gian rảnh:',
        'Thứ 7: 12:00-17:00',
        'Thời gian bận:',
        'Thứ 3 5 7 bận 6h30-9h30 tối',
        'Thứ 4 bận 2h-5h',
        'Thứ 6 bận 6h-9h',
        'Chủ nhật: 19:00-20:00',
      ].join('\n'),
      remainingTimeIsFree: true,
      studyPreferences: {
        subjectCombination: 'Toán - Hoá - Tin',
        dailyStudyMinutes: 60,
        sessionMinutes: 90,
        preferredStudyTime: 'flexible',
        customStudyTime: '',
        habitNotes: 'Học theo phiên ngắn.',
      },
      externalCommitments: [{
        title: 'Nộp web, thuyết trình cuộc thi NKCH cấp thành phố vòng chung kết',
        date: '2026-11-25',
        priority: 'high',
      }],
    },
    {
      now: () => new Date('2026-11-14T04:21:00.000Z'),
      getProgress: async () => ({
        officialAverages: [{
          classId: 'class-id',
          academicYear: '2026-2027',
          semester: 'Kỳ 1',
          subject: 'Ngữ văn',
          average: 8,
        }, {
          classId: 'class-id',
          academicYear: '2026-2027',
          semester: 'Kỳ 1',
          subject: 'Hóa học',
          average: 8,
        }, {
          classId: 'class-id',
          academicYear: '2026-2027',
          semester: 'Kỳ 1',
          subject: 'Toán học',
          average: 8,
        }, {
          classId: 'class-id',
          academicYear: '2026-2027',
          semester: 'Kỳ 1',
          subject: 'Tin học',
          average: 8,
        }],
        assignments: [],
        upcomingExams: [],
        resources: [],
        academicCalendar: { available: false },
      }),
      getTimetable: async (_auth, _semester, weekStart) => ({
        classroom: { id: 'class-id', academicYear: '2026-2027', code: '11A2' },
        timetable: { weekStart, session: 'morning', entries: [] },
      }),
      generatePlan: async ({ prompt }) => {
        promptContext = JSON.parse(prompt);
        return generated;
      },
    },
  );
  const plan = JSON.parse(result.suggestion);
  assert.ok(plan.timeline.some((item) => item.activity === 'Ôn Toán'));
  assert.ok(plan.timeline.some((item) => item.activity === 'Luyện Toán'));
  const competitionSessions = plan.timeline.filter((item) => item.activity.startsWith('Chuẩn bị deadline'));
  assert.equal(competitionSessions.length, 5);
  assert.equal(new Set(competitionSessions.map((item) => item.date)).size, 5);
  assert.ok(competitionSessions.every((item) => (
    (Number(item.endTime.slice(0, 2)) * 60 + Number(item.endTime.slice(3)))
      - (Number(item.startTime.slice(0, 2)) * 60 + Number(item.startTime.slice(3))) === 60
  )));
  assert.equal(promptContext.studyPreferences.subjectCombination, 'Toán - Hoá - Tin');
  assert.equal(promptContext.externalCommitments.length, 1);
  assert.equal(promptContext.priorityDeadlines[0].date, '2026-11-25');
  assert.match(plan.adjustments[0], /dài hơn mục tiêu tự học mỗi ngày/);
  assert.match(plan.priorities[0].task, /cuộc thi NKCH/);
  assert.doesNotMatch(plan.priorities[2].task, /Ngữ văn/);
  assert.ok(!plan.timeline.some((item) => item.activity === 'Khung giờ bận cá nhân'));
  assert.ok(!plan.timeline.some((item) => item.activity === 'Ôn Ngữ văn'));
  assert.ok(plan.timeline.find((item) => item.activity.startsWith('Chuẩn bị deadline')).date < '2026-11-25');
  assert.ok(promptContext.blockedWindows.some((window) => (
    window.date === '2026-11-15' && window.startTime === '19:00' && window.kind === 'busy'
  )));
  assert.match(promptContext.instructions.join(' '), /subjectCombination/);
  assert.match(promptContext.instructions.join(' '), /deadlinePreparation/);
});

test('major external deadlines receive daily preparation across most available days', async () => {
  const title = 'Cuộc thi cấp thành phố vòng chung khảo';
  const generated = {
    overview: 'Kế hoạch chuẩn bị cuộc thi.',
    lifeBalanceTip: '',
    startDate: '2026-11-14',
    priorities: [
      { task: 'Chuẩn bị cuộc thi', reason: 'Cần tập trung.', durationMinutes: 90 },
      { task: 'Hoàn thành bài tập', reason: 'Có hạn gần.', durationMinutes: 30 },
      { task: 'Ôn tập', reason: 'Củng cố kiến thức.', durationMinutes: 30 },
    ],
    adjustments: [],
    timeline: [],
  };
  const result = await generateStudentTimetableSuggestion(
    { userId: 'student', role: 'student' },
    {
      semester: 'Kỳ 1',
      availability: 'Thời gian bận:\nThứ 3 5 7 bận 6h30-9h30 tối',
      remainingTimeIsFree: true,
      studyPreferences: {
        subjectCombination: '',
        dailyStudyMinutes: null,
        sessionMinutes: null,
        preferredStudyTime: 'flexible',
        customStudyTime: '',
        habitNotes: '',
      },
      externalCommitments: [{ title, date: '2026-11-25', priority: 'high' }],
    },
    {
      now: () => new Date('2026-11-14T04:21:00.000Z'),
      getProgress: async () => ({
        officialAverages: [],
        assignments: [],
        upcomingExams: [],
        resources: [],
        academicCalendar: { available: false },
      }),
      getTimetable: async (_auth, _semester, weekStart) => ({
        classroom: { id: 'class-id', academicYear: '2026-2027', code: '11A2' },
        timetable: { weekStart, session: 'morning', entries: [] },
      }),
      generatePlan: async () => generated,
    },
  );
  const plan = JSON.parse(result.suggestion);
  const sessions = plan.timeline.filter((item) => item.activity.includes(title));
  assert.equal(sessions.length, 10);
  const minutesByDate = new Map();
  for (const item of sessions) {
    const duration = (Number(item.endTime.slice(0, 2)) * 60 + Number(item.endTime.slice(3)))
      - (Number(item.startTime.slice(0, 2)) * 60 + Number(item.startTime.slice(3)));
    minutesByDate.set(item.date, (minutesByDate.get(item.date) ?? 0) + duration);
  }
  assert.equal(minutesByDate.size, 5);
  assert.ok([...minutesByDate.values()].every((minutes) => minutes === 120));
  assert.ok([...minutesByDate.keys()].every((date) => date < '2026-11-25'));
  assert.match(plan.priorities[0].reason, /120 phút\/ngày trong 5 ngày/);
});

test('student schedule plan rejects invalid priority and timeline data', () => {
  const validPlan = {
    overview: 'Kế hoạch ngắn gọn',
    lifeBalanceTip: '',
    startDate: '2026-11-14',
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
      timeline: [{ date: '2026-11-15', startTime: '19:30', endTime: '19:00', activity: 'Ôn bài', kind: 'review' }],
    }),
    { code: 'SCHOOL_INVALID_AI_STUDENT_PLAN' },
  );
});

test('student schedule window uses Vietnam time and spans seven dates across weeks', () => {
  const now = new Date('2026-11-13T16:23:00.000Z');
  assert.deepEqual(getVietnamDateTime(now), { date: '2026-11-13', time: '23:23' });
  assert.equal(getWeekStartForDate('2026-11-14'), '2026-11-09');
  assert.equal(getWeekStartForDate(addDateDays('2026-11-14', 6)), '2026-11-16');
});

test('student timeline excludes past times, busy slots, class slots and overlaps', () => {
  const startDate = '2026-11-14';
  const availabilityWindows = parseAvailabilityWindows([
    'Thời gian rảnh:',
    'Thứ 7: 12:00-17:00',
    'Thời gian bận:',
    'Thứ 7: 16:00-18:00',
  ].join('\n'), startDate);
  assert.deepEqual(
    availabilityWindows.filter((window) => window.kind === 'free').map((window) => window.date),
    ['2026-11-14', '2026-11-21'],
  );
  const timeline = filterStudentTimeline([
    { date: startDate, startTime: '09:30', endTime: '10:00', activity: 'Đã qua', kind: 'study' },
    { date: startDate, startTime: '15:30', endTime: '16:30', activity: 'Đè giờ bận', kind: 'study' },
    { date: startDate, startTime: '13:30', endTime: '14:00', activity: 'Đè tiết học', kind: 'study' },
    { date: startDate, startTime: '14:30', endTime: '15:00', activity: 'Học bài', kind: 'study' },
    { date: startDate, startTime: '14:45', endTime: '15:15', activity: 'Bị trùng hoạt động', kind: 'study' },
    { date: '2026-11-21', startTime: '14:00', endTime: '14:30', activity: 'Thứ 7 tuần sau', kind: 'study' },
    { date: '2026-11-22', startTime: '14:00', endTime: '14:30', activity: 'Ngoài cửa sổ', kind: 'study' },
  ], {
    startDate,
    currentTime: '11:21',
    availabilityWindows,
    classWindows: [{ date: startDate, startTime: '13:15', endTime: '14:00' }],
  });
  assert.deepEqual(timeline.map((item) => item.activity), ['Học bài', 'Thứ 7 tuần sau']);
});

test('student availability parses repeated weekdays and Vietnamese hour shorthand', () => {
  const windows = parseAvailabilityWindows([
    'Thời gian bận:',
    'Thứ 3 5 7 bận 6h30-9h30 tối',
    'Thứ 4 bận 2h-5h',
    'Thứ 6 bận 6h-9h',
  ].join('\n'), '2026-11-14');
  assert.ok(windows.some((window) => (
    window.date === '2026-11-17'
    && window.startTime === '18:30'
    && window.endTime === '21:30'
    && window.kind === 'busy'
  )));
  assert.ok(windows.some((window) => (
    window.date === '2026-11-18'
    && window.startTime === '14:00'
    && window.endTime === '17:00'
  )));
  assert.ok(windows.some((window) => (
    window.date === '2026-11-20'
    && window.startTime === '18:00'
    && window.endTime === '21:00'
  )));
  const filtered = filterStudentTimeline([{
    date: '2026-11-17',
    startTime: '18:30',
    endTime: '21:30',
    activity: 'Khung giờ bận cá nhân',
    kind: 'busy',
  }], {
    startDate: '2026-11-14',
    currentTime: '11:21',
    availabilityWindows: windows,
    remainingTimeIsFree: true,
  });
  assert.deepEqual(filtered, []);
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

test('teacher schedule validation uses the stored gender or neutral wording', () => {
  for (const [gender, expected] of [
    ['male', /Thầy thử tạo lại nhé\./],
    ['female', /Cô thử tạo lại nhé\./],
    ['unspecified', /Vui lòng thử tạo lại\./],
  ]) {
    assert.throws(
      () => validateTeacherSchedulePlan({}, gender),
      { code: 'SCHOOL_INVALID_AI_TEACHER_PLAN', message: expected },
    );
  }
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
