const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  createStudentProgressService,
  semesterForExamStart,
  validateProgressFilters,
} = require('./studentProgress.service');

const classA = '30000000-0000-4000-8000-000000000001';
const classB = '30000000-0000-4000-8000-000000000002';
const assignmentId = '40000000-0000-4000-8000-000000000001';
const examId = '50000000-0000-4000-8000-000000000001';
const auth = { id: 'student-a', role: 'student' };

function makeDependencies(overrides = {}) {
  const calls = [];
  const dependencies = {
    listClasses: async (receivedAuth) => {
      calls.push(['classes', receivedAuth]);
      return [
        { id: classA, name: 'Lớp 10A', code: '10A', grade: '10', academic_year: '2025-2026', subjects: ['Toán'] },
        { id: classB, name: 'Lớp 10B', code: '10B', grade: '10', academic_year: '2025-2026', subjects: ['Toán'] },
      ];
    },
    listStudentSubjectAverages: async (receivedAuth, semester) => {
      calls.push(['averages', receivedAuth, semester]);
      return semester === 'Kỳ 1'
        ? [{
          classId: classA,
          className: 'Lớp 10A',
          classCode: '10A',
          academicYear: '2025-2026',
          subject: 'Toán',
          average: 8,
          regularScores: [7, null, 8, null],
          previousAverage: null,
          averageHistory: [{ average: 7.5, recordedAt: '2025-10-01T00:00:00.000Z' }],
        }]
        : [];
    },
    listStudentAssignments: async (receivedAuth) => {
      calls.push(['assignments', receivedAuth]);
      return [];
    },
    listStudentExamResults: async (receivedAuth) => {
      calls.push(['exams', receivedAuth]);
      return [];
    },
    listStudentExamRooms: async (receivedAuth) => {
      calls.push(['rooms', receivedAuth]);
      return [];
    },
    listStudentLearningResources: async (receivedAuth) => {
      calls.push(['resources', receivedAuth]);
      return [];
    },
    assignmentQuestionMaximums: (count) => Array(count).fill(10 / count),
    generateJsonAnalysis: async () => ({
      overview: { text: 'Phân tích có căn cứ.', evidenceIds: [`grade:${classA}:2025-2026:Kỳ 1:Toán`] },
      strengths: [],
      focusAreas: [],
      recommendations: [],
      roadmap: [],
      limitations: [],
    }),
    now: () => Date.parse('2026-01-01T00:00:00Z'),
    ...overrides,
  };
  return { dependencies, calls };
}

function makeAssignment(overrides = {}) {
  return {
    id: assignmentId,
    title: 'Bài tập chương 1',
    description: 'Câu 1: Tính 1 + 1',
    subject: 'Toán',
    classId: classA,
    className: 'Lớp 10A',
    academicYear: '2025-2026',
    semester: 'Kỳ 1',
    chapter: 'Chương 1',
    lesson: 'Bài 1',
    responseText: '2',
    dueAt: '2025-11-01T00:00:00Z',
    submittedAt: '2025-10-30T00:00:00Z',
    gradedAt: '2025-11-02T00:00:00Z',
    score: 8,
    teacherFeedback: '',
    questionScores: { 0: 8 },
    questionFeedback: {},
    files: [],
    ...overrides,
  };
}

test('progress only accepts the authenticated student and rejects user ID filters', async () => {
  const { dependencies, calls } = makeDependencies();
  const service = createStudentProgressService(dependencies);

  await assert.rejects(service.getStudentProgress({ id: 'teacher', role: 'lecturer' }), {
    code: 'SCHOOL_ROLE_FORBIDDEN',
  });
  assert.equal(calls.length, 0);
  assert.throws(() => validateProgressFilters({ userId: 'another-student' }), {
    code: 'SCHOOL_INVALID_PROGRESS_FILTER',
  });
  assert.deepEqual(validateProgressFilters({ semester: 'Cả năm' }), { semester: 'Cả năm' });
  assert.throws(() => validateProgressFilters({ semester: 'all' }), {
    code: 'SCHOOL_INVALID_PROGRESS_FILTER',
  });

  test('exam semester classification uses the Vietnam-local date and January 18 boundary', () => {
    assert.equal(semesterForExamStart('2026-01-17T16:59:00.000Z'), 'Kỳ 1');
    assert.equal(semesterForExamStart('2026-01-17T17:00:00.000Z'), 'Kỳ 2');
    assert.equal(semesterForExamStart('2026-06-01T00:00:00.000Z'), 'Kỳ 2');
    assert.equal(semesterForExamStart('2026-09-01T00:00:00.000Z'), 'Kỳ 1');
    assert.equal(semesterForExamStart('invalid-date'), null);
  });

  const progress = await service.getStudentProgress(auth);
  assert.ok(calls.every(([, receivedAuth]) => receivedAuth === auth));
  assert.deepEqual(progress.officialAverages[0].averageHistory, [
    { average: 7.5, recordedAt: '2025-10-01T00:00:00.000Z' },
  ]);
  assert.deepEqual(progress.officialAverages[0].regularScores, [7, null, 8, null]);
});

test('AI analysis requires an explicit class, year, and semester scope', async () => {
  let aiCalled = false;
  const { dependencies } = makeDependencies({
    generateJsonAnalysis: async () => {
      aiCalled = true;
      throw new Error('AI should not be called without a complete scope');
    },
  });
  await assert.rejects(
    createStudentProgressService(dependencies).analyzeStudentProgress(auth, { semester: 'Kỳ 1' }),
    { code: 'SCHOOL_PROGRESS_SCOPE_REQUIRED' },
  );
  assert.equal(aiCalled, false);
});

test('analysis is restricted to the selected class and academic year', async () => {
  let prompt = '';
  const { dependencies } = makeDependencies({
    listClasses: async () => [
      { id: classA, name: 'Lớp 10A', code: '10A', grade: '10', academic_year: '2025-2026', subjects: ['Toán', 'Văn'] },
      { id: classB, name: 'Lớp 10B', code: '10B', grade: '10', academic_year: '2025-2026', subjects: ['Toán', 'Văn'] },
    ],
    listStudentSubjectAverages: async (_auth, semester) => (semester === 'Kỳ 1' ? [
      {
        classId: classA, className: 'Lớp 10A', classCode: '10A', academicYear: '2025-2026',
        subject: 'Toán', average: 8, previousAverage: null,
      },
      {
        classId: classA, className: 'Lớp 10A', classCode: '10A', academicYear: '2025-2026',
        subject: 'Văn', average: 9, previousAverage: null,
      },
      {
        classId: classB, className: 'Lớp 10B', classCode: '10B', academicYear: '2025-2026',
        subject: 'Toán', average: 6, previousAverage: null,
      },
    ] : []),
    listStudentAssignments: async () => [
      makeAssignment({
        id: '40000000-0000-4000-8000-000000000005',
        title: 'Bài Văn',
        subject: 'Văn',
      }),
    ],
    generateJsonAnalysis: async (input) => {
      prompt = input.prompt;
      return {
        overview: { text: 'Phân tích riêng lớp đã chọn.', evidenceIds: [`grade:${classA}:2025-2026:Kỳ 1:Toán`] },
        strengths: [],
        focusAreas: [],
        recommendations: [],
        roadmap: [],
        limitations: [],
      };
    },
  });
  const result = await createStudentProgressService(dependencies).analyzeStudentProgress(auth, {
    classId: classA,
    academicYear: '2025-2026',
    subject: 'Toán',
    semester: 'Kỳ 1',
  });

  assert.equal(result.status, 'analyzed');
  assert.match(prompt, new RegExp(classA));
  assert.match(prompt, /xưng "em"/);
  assert.match(prompt, /previousAverage/);
  assert.doesNotMatch(prompt, new RegExp(classB));
  assert.doesNotMatch(prompt, /Văn/);
});

test('all-subject analysis aggregates only the selected class, year, and semester', async () => {
  let prompt = '';
  const { dependencies } = makeDependencies({
    listClasses: async () => [
      { id: classA, name: 'Lớp 10A', code: '10A', grade: '10', academic_year: '2025-2026', subjects: ['Toán', 'Văn'] },
      { id: classB, name: 'Lớp 10B', code: '10B', grade: '10', academic_year: '2025-2026', subjects: ['Toán', 'Văn'] },
    ],
    listStudentSubjectAverages: async (_auth, semester) => semester === 'Kỳ 1'
      ? [
        {
          classId: classA, className: 'Lớp 10A', classCode: '10A', academicYear: '2025-2026',
          subject: 'Toán', average: 8, previousAverage: null,
        },
        {
          classId: classA, className: 'Lớp 10A', classCode: '10A', academicYear: '2025-2026',
          subject: 'Văn', average: 7, previousAverage: null,
        },
      ]
      : [{
        classId: classA, className: 'Lớp 10A', classCode: '10A', academicYear: '2025-2026',
        subject: 'Lịch sử', average: 10, previousAverage: null,
      }],
    listStudentAssignments: async () => [
      makeAssignment(),
      makeAssignment({
        id: '40000000-0000-4000-8000-000000000002',
        title: 'Bài Văn Kỳ 1',
        subject: 'Văn',
      }),
      makeAssignment({
        id: '40000000-0000-4000-8000-000000000003',
        title: 'Bài ngoài Kỳ 1',
        semester: 'Kỳ 2',
        subject: 'Văn',
      }),
      makeAssignment({
        id: '40000000-0000-4000-8000-000000000004',
        title: 'Bài lớp khác',
        classId: classB,
        subject: 'Văn',
      }),
    ],
    generateJsonAnalysis: async (input) => {
      prompt = input.prompt;
      return {
        overview: { text: 'Phân tích các môn trong kỳ.', evidenceIds: [`grade:${classA}:2025-2026:Kỳ 1:Toán`] },
        strengths: [],
        focusAreas: [],
        recommendations: [],
        roadmap: [],
        limitations: [],
      };
    },
  });
  const result = await createStudentProgressService(dependencies).analyzeStudentProgress(auth, {
    classId: classA,
    academicYear: '2025-2026',
    semester: 'Kỳ 1',
  });

  assert.equal(result.status, 'analyzed');
  const context = JSON.parse(prompt.slice(prompt.lastIndexOf('\n\n') + 2));
  assert.deepEqual(context.officialAverages.map((item) => item.subject), ['Toán', 'Văn']);
  assert.deepEqual(context.assessments.map((item) => item.subject), ['Toán', 'Văn']);
  assert.equal(context.assessments.some((item) => item.title === 'Bài ngoài Kỳ 1'), false);
  assert.equal(context.assessments.some((item) => item.title === 'Bài lớp khác'), false);
  assert.equal(context.officialAverages.some((item) => item.semester !== 'Kỳ 1'), false);
  assert.doesNotMatch(prompt, /Lịch sử|Kỳ 2/);
});

test('annual analysis applies the weighted average and includes both semesters only', async () => {
  let prompt = '';
  const { dependencies } = makeDependencies({
    listStudentSubjectAverages: async (_auth, semester) => semester === 'Kỳ 1'
      ? [
        {
          classId: classA, className: 'Lớp 10A', classCode: '10A', academicYear: '2025-2026',
          subject: 'Toán', average: 6, previousAverage: null,
        },
        {
          classId: classA, className: 'Lớp 10A', classCode: '10A', academicYear: '2025-2026',
          subject: 'Văn', average: 8, previousAverage: null,
        },
        {
          classId: classA, className: 'Lớp 10A', classCode: '10A', academicYear: '2025-2026',
          subject: 'Lý', average: 11, previousAverage: null,
        },
      ]
      : [
        {
          classId: classA, className: 'Lớp 10A', classCode: '10A', academicYear: '2025-2026',
          subject: 'Toán', average: 9, previousAverage: null,
        },
        {
          classId: classA, className: 'Lớp 10A', classCode: '10A', academicYear: '2025-2026',
          subject: 'Lý', average: 7, previousAverage: null,
        },
      ],
    listStudentAssignments: async () => [
      makeAssignment(),
      makeAssignment({
        id: '40000000-0000-4000-8000-000000000006',
        title: 'Bài Kỳ 2',
        semester: 'Kỳ 2',
      }),
      makeAssignment({
        id: '40000000-0000-4000-8000-000000000007',
        title: 'Bài năm trước',
        academicYear: '2024-2025',
      }),
    ],
    listStudentExamResults: async () => [{
      sessionId: examId,
      title: 'Kiểm tra chưa rõ kỳ',
      classId: classA,
      className: 'Lớp 10A',
      academicYear: '2025-2026',
      subject: 'Toán',
      submittedAt: '2026-03-01T00:00:00.000Z',
      grade: {
        gradedAt: '2026-03-02T00:00:00.000Z',
        totalScore: 8,
        teacherFeedback: '',
        questionScores: {},
        questionFeedback: {},
        evidenceFiles: [],
      },
      questions: [],
      answers: {},
      files: [],
    }],
    generateJsonAnalysis: async (input) => {
      prompt = input.prompt;
      return {
        overview: { text: 'Phân tích cả năm.', evidenceIds: [`grade:${classA}:2025-2026:Kỳ 1:Toán`] },
        strengths: [],
        focusAreas: [],
        recommendations: [],
        roadmap: [],
        limitations: [],
      };
    },
  });
  const result = await createStudentProgressService(dependencies).analyzeStudentProgress(auth, {
    classId: classA,
    academicYear: '2025-2026',
    semester: 'Cả năm',
  });

  assert.equal(result.status, 'analyzed');
  const context = JSON.parse(prompt.slice(prompt.lastIndexOf('\n\n') + 2));
  assert.deepEqual(context.annualAverages, [{
    subject: 'Toán',
    average: 8,
    calculation: '(Kỳ 1 + 2 × Kỳ 2) / 3',
    evidenceIds: [
      `grade:${classA}:2025-2026:Kỳ 1:Toán`,
      `grade:${classA}:2025-2026:Kỳ 2:Toán`,
    ],
  }]);
  assert.equal(context.officialAverages.some((item) => item.subject === 'Lý' && item.semester === 'Kỳ 1'), false);
  assert.equal(context.assessments.some((item) => item.title === 'Bài tập chương 1'), true);
  assert.equal(context.assessments.some((item) => item.title === 'Bài Kỳ 2'), true);
  assert.equal(context.assessments.some((item) => item.title === 'Bài năm trước'), false);
  assert.equal(context.assessments.some((item) => item.title === 'Kiểm tra chưa rõ kỳ'), true);
  assert.match(prompt, /Cả năm/);
});

test('semester analysis excludes exam results without a stored semester', async () => {
  let prompt = '';
  const { dependencies } = makeDependencies({
    listStudentExamResults: async () => [{
      sessionId: examId,
      title: 'Kiểm tra chưa rõ kỳ',
      classId: classA,
      academicYear: '2025-2026',
      subject: 'Toán',
    }],
    generateJsonAnalysis: async (input) => {
      prompt = input.prompt;
      return {
        overview: { text: 'Điểm chính thức được ghi nhận.', evidenceIds: [`grade:${classA}:2025-2026:Kỳ 1:Toán`] },
        strengths: [],
        focusAreas: [],
        recommendations: [],
        roadmap: [],
        limitations: [],
      };
    },
  });
  const result = await createStudentProgressService(dependencies).analyzeStudentProgress(auth, {
    classId: classA,
    academicYear: '2025-2026',
    subject: 'Toán',
    semester: 'Kỳ 1',
  });
  assert.equal(result.status, 'analyzed');
  assert.doesNotMatch(prompt, /Kiểm tra chưa rõ kỳ/);
  assert.match(prompt, /không có ngày bắt đầu hợp lệ/);
});

test('exam results with a room start date are included only in their assigned semester', async () => {
  let prompt = '';
  const { dependencies } = makeDependencies({
    listStudentExamResults: async () => [{
      sessionId: examId,
      title: 'Kiểm tra giữa kỳ',
      classId: classA,
      className: 'Lớp 10A',
      academicYear: '2025-2026',
      subject: 'Toán',
      startsAt: '2026-01-17T17:30:00.000Z',
      submittedAt: '2026-01-18T00:00:00.000Z',
      answers: {},
      files: [],
      questions: [{
        id: 'q1',
        type: 'short-answer',
        question: 'Câu hỏi',
        correctAnswer: '',
        explanation: '',
        teacherFeedback: '',
        points: 40,
      }],
      grade: {
        questionScores: { q1: 18 },
        questionFeedback: {},
        totalScore: 18,
        teacherFeedback: '',
        evidenceFiles: [],
        gradedAt: '2026-01-18T01:00:00.000Z',
        isRead: false,
      },
    }],
    generateJsonAnalysis: async (input) => {
      prompt = input.prompt;
      return {
        overview: { text: 'Có kết quả bài kiểm tra.', evidenceIds: [`exam:${examId}`] },
        strengths: [],
        focusAreas: [],
        recommendations: [],
        roadmap: [],
        limitations: [],
      };
    },
  });
  const service = createStudentProgressService(dependencies);
  const result = await service.analyzeStudentProgress(auth, {
    classId: classA,
    academicYear: '2025-2026',
    subject: 'Toán',
    semester: 'Kỳ 2',
  });
  assert.equal(result.status, 'analyzed');
  assert.match(prompt, /Kiểm tra giữa kỳ/);
  await assert.rejects(
    service.analyzeStudentProgress(auth, {
      classId: classA,
      academicYear: '2025-2026',
      subject: 'Toán',
      semester: 'Kỳ 1',
      assessmentId: examId,
    }),
    { code: 'SCHOOL_PROGRESS_ASSESSMENT_NOT_FOUND' },
  );
});

test('null official averages with no graded assessments return insufficient data without calling AI', async () => {
  let aiCalled = false;
  const { dependencies } = makeDependencies({
    listStudentSubjectAverages: async () => [{
      classId: classA, className: 'Lớp 10A', classCode: '10A', academicYear: '2025-2026',
      subject: 'Toán', average: null, previousAverage: null,
    }],
    generateJsonAnalysis: async () => {
      aiCalled = true;
      throw new Error('AI should not be called without evidence');
    },
  });
  const result = await createStudentProgressService(dependencies).analyzeStudentProgress(auth, {
    classId: classA,
    academicYear: '2025-2026',
    subject: 'Toán',
    semester: 'Kỳ 1',
  });

  assert.equal(result.status, 'insufficient-data');
  assert.equal(aiCalled, false);
});

test('assessment analysis cannot be forced into a mismatched semester', async () => {
  const { dependencies } = makeDependencies({
    listStudentAssignments: async () => [makeAssignment()],
  });
  await assert.rejects(
    createStudentProgressService(dependencies).analyzeStudentProgress(auth, {
      classId: classA,
      academicYear: '2025-2026',
      subject: 'Toán',
      semester: 'Kỳ 2',
      assessmentId: assignmentId,
    }),
    { code: 'SCHOOL_PROGRESS_ASSESSMENT_NOT_FOUND' },
  );
});

test('exam-specific analysis rejects a semester filter when the exam semester is unknown', async () => {
  const { dependencies } = makeDependencies({
    listStudentExamResults: async () => [{
      sessionId: examId,
      title: 'Kiểm tra',
      classId: classA,
      academicYear: '2025-2026',
      subject: 'Toán',
    }],
  });
  await assert.rejects(
    createStudentProgressService(dependencies).analyzeStudentProgress(auth, {
      classId: classA,
      academicYear: '2025-2026',
      subject: 'Toán',
      semester: 'Kỳ 1',
      assessmentId: examId,
    }),
    { code: 'SCHOOL_PROGRESS_EXAM_SEMESTER_UNKNOWN' },
  );
});

test('AI output with evidence outside the selected records is rejected', async () => {
  const { dependencies } = makeDependencies({
    generateJsonAnalysis: async () => ({
      overview: { text: 'Nhận xét sai căn cứ.', evidenceIds: ['exam:another-student'] },
      strengths: [],
      focusAreas: [],
      recommendations: [],
      roadmap: [],
      limitations: [],
    }),
  });
  await assert.rejects(
    createStudentProgressService(dependencies).analyzeStudentProgress(auth, {
      classId: classA,
      academicYear: '2025-2026',
      subject: 'Toán',
      semester: 'Kỳ 1',
    }),
    { code: 'SCHOOL_PROGRESS_AI_INVALID' },
  );
});
