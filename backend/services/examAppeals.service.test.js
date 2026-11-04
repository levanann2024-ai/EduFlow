const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createExamAppealsService } = require('./examAppeals.service');

const auth = { userId: 'student-1', role: 'student' };
const sessionId = 'b5bd9f17-c82a-48a5-bcdf-1e4d7e1fb291';

test('a student can appeal only their own published exam result', async () => {
  const statements = [];
  const client = {
    query: async (sql, values = []) => {
      statements.push({ sql, values });
      if (sql.includes('SELECT s.id')) return { rows: [{ id: sessionId }] };
      if (sql.includes('INSERT INTO exam_appeals')) return { rows: [{ id: 'appeal-1' }] };
      return { rows: [] };
    },
    release() {},
  };
  const service = createExamAppealsService({
    getPool: () => ({ connect: async () => client }),
    getSchool: async (userId, role) => {
      assert.equal(userId, auth.userId);
      assert.equal(role, 'student');
      return 'school-1';
    },
  });

  assert.deepEqual(
    await service.submitStudentExamAppeal(auth, sessionId, 'Câu 3'),
    { id: 'appeal-1' },
  );
  assert.equal(statements[0].sql, 'BEGIN');
  assert.deepEqual(statements[1].values, [sessionId, auth.userId, 'school-1']);
  assert.deepEqual(statements[2].values.slice(1), [sessionId, auth.userId, 'Câu 3']);
  assert.equal(statements.at(-1).sql, 'COMMIT');
});

test('a student cannot appeal an unpublished, incomplete, or another student result', async () => {
  let connectCalls = 0;
  const service = createExamAppealsService({
    getPool: () => ({
      connect: async () => {
        connectCalls += 1;
        return {
          query: async (sql) => sql.includes('SELECT s.id') ? { rows: [] } : { rows: [] },
          release() {},
        };
      },
    }),
    getSchool: async () => 'school-1',
  });

  await assert.rejects(
    service.submitStudentExamAppeal(auth, sessionId, 'Muốn được xem lại câu 2.'),
    { status: 404, code: 'SCHOOL_EXAM_RESULT_NOT_FOUND' },
  );
  assert.equal(connectCalls, 1);
});

test('appeal requests require nonempty text before opening a database connection', async () => {
  let connectCalls = 0;
  const service = createExamAppealsService({
    getPool: () => ({ connect: async () => { connectCalls += 1; } }),
    getSchool: async () => 'school-1',
  });
  await assert.rejects(
    service.submitStudentExamAppeal(auth, sessionId, '   '),
    { status: 400, code: 'SCHOOL_INVALID_APPEAL' },
  );
  assert.equal(connectCalls, 0);
});

test('a student cannot submit another appeal for the same exam after a request exists', async () => {
  const client = {
    query: async (sql) => {
      if (sql.includes('SELECT s.id')) return { rows: [{ id: sessionId }] };
      if (sql.includes('INSERT INTO exam_appeals')) return { rows: [] };
      return { rows: [] };
    },
    release() {},
  };
  const service = createExamAppealsService({
    getPool: () => ({ connect: async () => client }),
    getSchool: async () => 'school-1',
  });

  await assert.rejects(
    service.submitStudentExamAppeal(auth, sessionId, 'Xin xem lại câu 2.'),
    { status: 409, code: 'SCHOOL_APPEAL_ALREADY_EXISTS' },
  );
});

test('teachers can only resolve their own pending appeals with a student-facing response', async () => {
  const teacherAuth = { userId: 'teacher-1', role: 'lecturer' };
  const calls = [];
  const service = createExamAppealsService({
    getPool: () => ({
      query: async (sql, values) => {
        calls.push({ sql, values });
        return { rows: [{
          id: 'd48e49de-0b46-4e88-9ba7-b7b2114f1975',
          session_id: sessionId,
          exam_title: 'Kiểm tra Toán',
          subject: 'Toán',
          class_name: '11A2',
          student_name: 'Học sinh 01',
          reason: 'Xin xem lại câu 1.',
          status: 'reviewed',
          teacher_response: 'Đã kiểm tra lại, điểm được giữ nguyên.',
          created_at: new Date('2026-11-02T08:00:00Z'),
          reviewed_at: new Date('2026-11-02T09:00:00Z'),
        }] };
      },
    }),
    getSchool: async (userId, role) => {
      assert.equal(userId, teacherAuth.userId);
      assert.equal(role, 'lecturer');
      return 'school-1';
    },
  });

  const result = await service.reviewTeacherExamAppeal(
    teacherAuth,
    'd48e49de-0b46-4e88-9ba7-b7b2114f1975',
    { status: 'reviewed', teacherResponse: ' Đã kiểm tra lại, điểm được giữ nguyên. ' },
  );
  assert.equal(result.status, 'reviewed');
  assert.equal(calls[0].values[1], teacherAuth.userId);
  assert.match(calls[0].sql, /r\.teacher_user_id = \$2/);
  assert.match(calls[0].sql, /a\.status = 'pending'/);
});
