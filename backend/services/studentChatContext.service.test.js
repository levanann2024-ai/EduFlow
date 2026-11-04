const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  createStudentChatContextService,
  currentVietnamWeekStart,
} = require('./studentChatContext.service');

test('student chat context uses the current Vietnam school week', () => {
  assert.equal(currentVietnamWeekStart(new Date('2026-11-02T03:00:00.000Z')), '2026-11-02');
  assert.equal(currentVietnamWeekStart(new Date('2026-11-01T18:00:00.000Z')), '2026-11-02');
});

test('student chat context rejects non-student sessions before loading data', async () => {
  const loadData = () => {
    throw new Error('Student data must not be loaded.');
  };
  const getContext = createStudentChatContextService({
    getProgress: loadData,
    getTimetable: loadData,
    listLearningResources: loadData,
    listExamRooms: loadData,
  });

  await assert.rejects(
    getContext({ userId: 'teacher-1', role: 'lecturer' }),
    { code: 'SCHOOL_ROLE_FORBIDDEN' },
  );
});

test('student chat context combines the authenticated student records and weekly plan', async () => {
  const auth = { userId: 'student-1', role: 'student' };
  const timetableCalls = [];
  const getContext = createStudentChatContextService({
    now: () => new Date('2026-11-02T03:00:00.000Z'),
    getProgress: async (requestAuth) => {
      assert.equal(requestAuth, auth);
      return {
        classes: [{
          name: 'Lớp 10A1',
          code: '10A1',
          grade: '10',
          academicYear: '2026-2027',
          subjects: ['Toán'],
        }],
        assignments: [{
          title: 'Bài tập hàm số',
          subject: 'Toán',
          className: 'Lớp 10A1',
          dueAt: '2026-11-05T00:00:00.000Z',
          submittedAt: null,
          score: null,
          description: 'Bài tập chương 1',
        }],
        officialAverages: [{ subject: 'Toán', average: 8.5, previousAverage: 8 }],
        examResults: [],
        academicCalendar: { available: false },
      };
    },
    getTimetable: async (requestAuth, semester, weekStart) => {
      assert.equal(requestAuth, auth);
      timetableCalls.push({ semester, weekStart });
      return {
        classroom: { name: 'Lớp 10A1', code: '10A1', academicYear: '2026-2027' },
        weekNumber: 10,
        timetable: { semester, entries: [{ weekday: 1, period: 1, subject: 'Toán' }] },
      };
    },
    listLearningResources: async (requestAuth) => {
      assert.equal(requestAuth, auth);
      return [{
        subject: 'Toán',
        className: 'Lớp 10A1',
        title: 'Hàm số bậc nhất',
        content: 'Tài liệu bài học',
      }];
    },
    listExamRooms: async (requestAuth) => {
      assert.equal(requestAuth, auth);
      return [{ title: 'Kiểm tra Toán', subject: 'Toán', status: 'scheduled', startsAt: '2026-11-06T00:00:00.000Z' }];
    },
  });

  const context = await getContext(auth, {
    freeTime: 'Thứ 3 buổi tối',
    busyTime: 'Thứ 4 buổi chiều',
    suggestion: '{"overview":"Ôn hàm số"}',
    completedPriorities: [0],
  });

  assert.equal(context.currentWeek, '2026-11-02');
  assert.equal(context.assignments[0].status, 'Chưa nộp');
  assert.equal(context.officialSubjectAverages[0].average, 8.5);
  assert.equal(context.learningMaterials[0].content, 'Tài liệu bài học');
  assert.equal(context.examRooms[0].title, 'Kiểm tra Toán');
  assert.equal(context.weeklyPlan.freeTime, 'Thứ 3 buổi tối');
  assert.deepEqual(timetableCalls, [
    { semester: 'Kỳ 1', weekStart: '2026-11-02' },
    { semester: 'Kỳ 2', weekStart: '2026-11-02' },
  ]);
});
