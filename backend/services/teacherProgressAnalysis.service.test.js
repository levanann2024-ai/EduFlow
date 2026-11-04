const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createTeacherProgressAnalysisService } = require('./teacherProgressAnalysis.service');

const auth = { userId: 'teacher-1', role: 'lecturer' };
const classId = '6bd49ab1-70ad-4ca3-9012-a0dc9d20d10d';
const roster = [{
  id: 'student-1',
  fullName: 'Nguyễn An',
  email: 'an@example.test',
  grades: { regular: [8, 7, null, null], midterm: 6, final: null },
  confirmedAverage: 7,
  previousConfirmedAverage: 6.8,
  averageHistory: [
    { average: 6.5, recordedAt: '2026-10-10T00:00:00.000Z' },
    { average: 7, recordedAt: '2026-11-02T00:00:00.000Z' },
  ],
  assignments: { total: 2, submitted: 1, overdueMissing: 1 },
}];

function generated(studentKey = 'HS001') {
  return {
    classOverview: 'Lớp có dữ liệu điểm và bài tập để theo dõi.',
    learningAdvice: 'Duy trì ôn tập đều và nộp bài đúng hạn.',
    strengths: ['Có một số điểm thường xuyên khá.'],
    focusAreas: ['Cần theo dõi bài tập quá hạn.'],
    studentInsights: [{
      studentKey,
      level: 'support',
      insight: 'Cần được hỏi thăm về tiến độ làm bài.',
      evidence: ['Có 1 bài tập quá hạn.'],
    }],
    recommendations: [{
      type: 'review',
      title: 'Ôn tập ngắn',
      action: 'Dành một tiết củng cố nội dung còn yếu.',
      reason: 'Có học sinh còn thiếu bài tập.',
    }],
    limitations: [],
  };
}

function createService(overrides = {}) {
  return createTeacherProgressAnalysisService({
    listClasses: async () => [{
      id: classId,
      name: '11A2',
      academic_year: '2026-2027',
      is_homeroom: false,
    }],
    getClassGradebook: async () => roster,
    listClassAssignments: async () => [{
      id: 'assignment-1',
      title: 'Bài tập hàm số',
      dueAt: '2026-11-03T00:00:00.000Z',
      submittedCount: 1,
      studentCount: 1,
    }],
    listClassAssignmentSubmissions: async () => ({
      assignmentId: 'assignment-1',
      submissions: [{
        studentId: 'student-1',
        studentName: 'Nguyễn An',
        score: 7,
        gradedAt: '2026-11-02T00:00:00.000Z',
        teacherFeedback: 'Nguyễn An cần bổ sung lời giải.',
        questionFeedback: {},
      }],
    }),
    getHomeroomClassGradeSummary: async () => {
      throw new Error('Non-homeroom teachers must not load cross-subject grades.');
    },
    generateJsonAnalysis: async () => generated(),
    ...overrides,
  });
}

test('teacher analysis rejects non-teachers before loading class data', async () => {
  const service = createService({
    listClasses: async () => { throw new Error('Class data must not be loaded.'); },
  });
  await assert.rejects(
    service({ userId: 'student-1', role: 'student' }, classId, {
      academicYear: '2026-2027',
      semester: 'Kỳ 1',
      subject: 'Toán',
    }),
    { status: 403, code: 'SCHOOL_ROLE_FORBIDDEN' },
  );
});

test('subject teacher gets anonymous, evidence-based analysis for their assigned subject', async () => {
  let prompt = '';
  const service = createService({
    generateJsonAnalysis: async (input) => {
      prompt = input.prompt;
      return generated();
    },
  });
  const result = await service(auth, classId, {
    academicYear: '2026-2027',
    semester: 'Kỳ 1',
    subject: 'Toán',
  });
  const promptData = JSON.parse(prompt.slice(prompt.lastIndexOf('\n\n') + 2));

  assert.equal(result.scope.isHomeroom, false);
  assert.equal(result.students[0].fullName, 'Nguyễn An');
  assert.equal(result.analysis.studentInsights[0].studentKey, 'HS001');
  assert.match(prompt, /"overdueMissing":1/);
  assert.equal(promptData.students[0].previousTbm, 6.5);
  assert.equal(promptData.students[0].tbmChange, 0.5);
  assert.equal(promptData.students[0].tbmComparisonBasis, 'history');
  assert.match(prompt, /ghi rõ tăng\/giảm\/không đổi và mức chênh lệch/);
  assert.doesNotMatch(prompt, /Nguyễn An|an@example\.test/);
  assert.equal('crossSubjectContext' in promptData, false);
});

test('homeroom analysis includes anonymized cross-subject averages', async () => {
  let prompt = '';
  const service = createService({
    listClasses: async () => [{
      id: classId,
      name: '11A2',
      academic_year: '2026-2027',
      is_homeroom: true,
    }],
    getHomeroomClassGradeSummary: async () => ({
      subjects: ['Toán', 'Ngữ văn'],
      students: [{
        id: 'student-1',
        fullName: 'Nguyễn An',
        averages: { Toán: 7, 'Ngữ văn': 8 },
      }],
    }),
    generateJsonAnalysis: async (input) => {
      prompt = input.prompt;
      return generated();
    },
  });
  const result = await service(auth, classId, {
    academicYear: '2026-2027',
    semester: 'Kỳ 1',
    subject: 'Toán',
  });
  const promptData = JSON.parse(prompt.slice(prompt.lastIndexOf('\n\n') + 2));

  assert.equal(result.scope.isHomeroom, true);
  assert.deepEqual(promptData.crossSubjectContext.subjects, ['Toán', 'Ngữ văn']);
  assert.doesNotMatch(prompt, /Nguyễn An|an@example\.test/);
});

test('teacher analysis rejects AI insights that cite unknown student keys', async () => {
  const service = createService({
    generateJsonAnalysis: async () => generated('HS999'),
  });
  await assert.rejects(
    service(auth, classId, {
      academicYear: '2026-2027',
      semester: 'Kỳ 1',
      subject: 'Toán',
    }),
    { status: 502, code: 'SCHOOL_PROGRESS_AI_INVALID' },
  );
});
