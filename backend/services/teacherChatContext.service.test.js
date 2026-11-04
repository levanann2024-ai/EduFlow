const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createTeacherChatContextService } = require('./teacherChatContext.service');

test('teacher chat context rejects non-teacher sessions before loading data', async () => {
  const loadData = () => {
    throw new Error('Teacher data must not be loaded.');
  };
  const getContext = createTeacherChatContextService({
    listClasses: loadData,
    listTeacherAssessments: loadData,
    listTeacherExamRooms: loadData,
  });

  await assert.rejects(
    getContext({ userId: 'student-1', role: 'student' }),
    { statusCode: 403, code: 'SCHOOL_ROLE_FORBIDDEN' },
  );
});

test('teacher chat context combines assigned classes and work without exposing student records', async () => {
  const auth = { userId: 'teacher-1', role: 'lecturer' };
  const getContext = createTeacherChatContextService({
    now: () => new Date('2026-11-02T03:00:00.000Z'),
    listClasses: async (requestAuth) => {
      assert.equal(requestAuth, auth);
      return [{
        id: 'class-1',
        name: 'Lớp 11A2',
        code: '11A2',
        grade: '11',
        academic_year: '2026-2027',
        is_homeroom: false,
        homeroom_subject: null,
      }];
    },
    listTeacherClassSubjects: async (requestAuth, classId) => {
      assert.equal(requestAuth, auth);
      assert.equal(classId, 'class-1');
      return ['Toán'];
    },
    getTimetable: async () => ({
      timetable: {
        academicYear: '2026-2027',
        semester: 'Kỳ 1',
        weekStart: '2026-11-02',
        status: 'published',
        dailyNote: 'Ôn tập hàm số',
      },
      entries: [{ weekday: 1, period: 1, className: 'Lớp 11A2', classCode: '11A2', subject: 'Toán', type: 'lesson', title: 'Hàm số' }],
      upcomingWork: [{ title: 'Bài tập hàm số', subject: 'Toán', classCode: '11A2', dueAt: '2026-11-05', submittedCount: 4, ungradedCount: 2 }],
    }),
    listClassAssignments: async () => [{
      title: 'Bài tập hàm số',
      subject: 'Toán',
      academicYear: '2026-2027',
      semester: 'Kỳ 1',
      dueAt: '2026-11-05',
      description: 'Ôn tập chương hàm số',
      studentCount: 6,
      submittedCount: 4,
      students: [{ gradedAt: null }],
    }],
    getGradebook: async () => Array.from({ length: 5 }, (_, index) => ({
      studentName: `Học sinh ${index + 1}`,
      email: `student${index + 1}@example.test`,
      confirmedAverage: 8,
      assignments: { overdueMissing: 1 },
    })),
    listClassLearningResources: async () => [{
      subject: 'Toán',
      academic_year: '2026-2027',
      semester: 'Kỳ 1',
      title: 'Tài liệu hàm số',
      content: 'Nội dung bài học',
      note: 'Đọc trước',
    }],
    listTeacherAssessments: async (_requestAuth, kind) => kind === 'exam'
      ? [{ title: 'Đề giữa kỳ', subject: 'Toán', questions: [{ type: 'multiple-choice', question: '1 + 1?', correctAnswer: '2' }] }]
      : [{ title: 'Bài tập cuối chương', subject: 'Toán', questions: [] }],
    listTeacherExamRooms: async () => [{
      title: 'Kiểm tra giữa kỳ',
      subject: 'Toán',
      classNames: ['Lớp 11A2'],
      status: 'scheduled',
      startsAt: '2026-11-10T02:00:00.000Z',
      durationMinutes: 45,
      studentCount: 6,
      sessions: [{ status: 'submitted' }],
    }],
  });

  const context = await getContext(auth);

  assert.equal(context.currentWeek, '2026-11-02');
  assert.equal(context.classes[0].name, 'Lớp 11A2');
  assert.equal(context.timetables[0].entries[0].subject, 'Toán');
  assert.equal(context.assignments[0].title, 'Bài tập hàm số');
  assert.equal(context.classPerformance[0].classAverage, 8);
  assert.equal(context.classPerformance[0].overdueMissingAssignmentCount, 5);
  assert.equal(context.savedAssessments.length, 2);
  assert.equal(context.examRooms[0].title, 'Kiểm tra giữa kỳ');
  assert.equal(context.learningResources[0].content, 'Nội dung bài học');
  assert.equal('studentName' in context.classPerformance[0], false);
  assert.equal('email' in context.classPerformance[0], false);
});
