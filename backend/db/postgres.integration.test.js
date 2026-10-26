const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { after, before, test } = require('node:test');
const Module = require('node:module');
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');
const { applyMigrations } = require('../scripts/migrate');

const rawTestDatabaseUrl = process.env.EDUFLOW_TEST_DATABASE_URL;
const databaseUrl = validateTestDatabaseUrl(rawTestDatabaseUrl);
const schemaName = `eduflow_test_${process.pid}_${crypto.randomBytes(6).toString('hex')}`;
let pool;
let schemaCreated = false;
let authService;
let previousJwtSecret;

function validateTestDatabaseUrl(value) {
  if (!value) return null;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('EDUFLOW_TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (
    !['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname)
    || !/^eduflow_test(?:_[a-z0-9_]+)?$/i.test(databaseName)
  ) {
    throw new Error('PostgreSQL integration tests require a loopback database named eduflow_test or eduflow_test_<suffix>.');
  }
  return value;
}

async function connectToSchema() {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

async function insertSchool(client, status = 'active') {
  const id = randomUUID();
  await client.query(
    'INSERT INTO schools (id, name, status) VALUES ($1, $2, $3)',
    [id, `Test school ${id}`, status],
  );
  return id;
}

async function insertUser(client, role, adminScope = null, fullName = 'Integration Test') {
  const id = randomUUID();
  await client.query(
    `INSERT INTO users (id, email, full_name, password_hash, role, admin_scope, profile_completed_at)
     VALUES ($1, $2, $3, 'not-a-real-password-hash', $4, $5, now())`,
    [id, `${id}@example.invalid`, fullName, role, adminScope],
  );
  return id;
}

async function insertSchoolMembership(client, userId, schoolId, role, status = 'active') {
  const id = randomUUID();
  await client.query(
    `INSERT INTO school_memberships (id, user_id, school_id, role, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, schoolId, role, status],
  );
  return id;
}

async function makeClassAndStudent(client) {
  const schoolId = await insertSchool(client);
  const studentId = await insertUser(client, 'student');
  const membershipId = await insertSchoolMembership(client, studentId, schoolId, 'student');
  await client.query(
    'INSERT INTO student_profiles (user_id, membership_id, school_id) VALUES ($1, $2, $3)',
    [studentId, membershipId, schoolId],
  );
  const classId = randomUUID();
  await client.query(
    `INSERT INTO classes (id, school_id, code, name, grade, academic_year)
     VALUES ($1, $2, 'TEST', 'Integration class', '10', '2026-2027')`,
    [classId, schoolId],
  );
  return { schoolId, studentId, classId };
}

async function runConcurrentInserts(insertStatement, valuesA, valuesB) {
  const clients = await Promise.all([connectToSchema(), connectToSchema()]);
  try {
    await Promise.all(clients.map((client) => client.query('BEGIN')));
    const insert = async (client, values) => {
      try {
        await client.query(insertStatement, values);
        await client.query('COMMIT');
        return null;
      } catch (error) {
        await client.query('ROLLBACK');
        return error;
      }
    };
    return await Promise.all([
      insert(clients[0], valuesA),
      insert(clients[1], valuesB),
    ]);
  } finally {
    for (const client of clients) client.release();
  }
}

before({ skip: !databaseUrl }, async () => {
  pool = new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 3000 });
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    await applyMigrations(client, { schemaName, through: '001_auth_accounts' });
    await applyMigrations(client, { schemaName });
    assert.deepEqual(await applyMigrations(client, { schemaName }), []);
  } finally {
    client.release();
  }

  previousJwtSecret = process.env.AUTH_JWT_SECRET;
  process.env.AUTH_JWT_SECRET = crypto.randomBytes(32).toString('base64url');
  const poolModulePath = require.resolve('./pool');
  const poolModule = new Module(poolModulePath);
  poolModule.filename = poolModulePath;
  poolModule.loaded = true;
  poolModule.exports = {
    getPool: () => ({
      connect: async () => connectToSchema(),
      query: async (sql, values) => {
        const scopedClient = await connectToSchema();
        try {
          return await scopedClient.query(sql, values);
        } finally {
          scopedClient.release();
        }
      },
    }),
  };
  require.cache[poolModulePath] = poolModule;
  authService = require('../auth/service');
});

after({ skip: !databaseUrl }, async () => {
  if (!pool) return;
  if (schemaCreated) {
    const client = await pool.connect();
    try {
      await client.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    } finally {
      client.release();
    }
  }
  await pool.end();
  if (previousJwtSecret === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = previousJwtSecret;
});

test('PostgreSQL integration tests use an isolated schema and apply the repository migrations', {
  skip: !databaseUrl,
}, async () => {
  const client = await connectToSchema();
  try {
    const tables = await client.query(
      `SELECT count(*)::int AS count
         FROM information_schema.tables
        WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
      [schemaName],
    );
    assert.equal(tables.rows[0].count, 18);
    const migrationRows = await client.query(
      'SELECT count(*)::int AS count FROM eduflow_schema_migrations',
    );
    assert.equal(migrationRows.rows[0].count, 8);
  } finally {
    client.release();
  }
});

test('class membership rows preserve ended periods and allow one active rejoin', {
  skip: !databaseUrl,
}, async () => {
  const client = await connectToSchema();
  try {
    const { classId, studentId, schoolId } = await makeClassAndStudent(client);
    await client.query(
      `INSERT INTO class_memberships
         (id, class_id, student_user_id, school_id, status, ended_at)
       VALUES ($1, $2, $3, $4, 'ended', now())`,
      [randomUUID(), classId, studentId, schoolId],
    );
    await client.query(
      `INSERT INTO class_memberships (id, class_id, student_user_id, school_id)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), classId, studentId, schoolId],
    );
    const history = await client.query(
      `SELECT count(*)::int AS count
         FROM class_memberships
        WHERE class_id = $1 AND student_user_id = $2`,
      [classId, studentId],
    );
    assert.equal(history.rows[0].count, 2);
    await assert.rejects(
      client.query(
        `INSERT INTO class_memberships (id, class_id, student_user_id, school_id)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), classId, studentId, schoolId],
      ),
      (error) => error.code === '23505',
    );
    await assert.rejects(
      client.query(
        `INSERT INTO class_memberships
           (id, class_id, student_user_id, school_id, status, ended_at)
         VALUES ($1, $2, $3, $4, 'active', now())`,
        [randomUUID(), classId, studentId, schoolId],
      ),
      (error) => error.code === '23514',
    );
  } finally {
    client.release();
  }
});

test('concurrent class rejoin requests create at most one active period', {
  skip: !databaseUrl,
}, async () => {
  const setup = await connectToSchema();
  let ids;
  try {
    ids = await makeClassAndStudent(setup);
  } finally {
    setup.release();
  }
  const outcomes = await runConcurrentInserts(
    `INSERT INTO class_memberships (id, class_id, student_user_id, school_id)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), ids.classId, ids.studentId, ids.schoolId],
    [randomUUID(), ids.classId, ids.studentId, ids.schoolId],
  );
  assert.equal(outcomes.filter((error) => error === null).length, 1);
  assert.equal(outcomes.filter((error) => error?.code === '23505').length, 1);
});

test('teacher assignment history allows regrant and normalizes active subject uniqueness', {
  skip: !databaseUrl,
}, async () => {
  const client = await connectToSchema();
  try {
    const schoolId = await insertSchool(client);
    const teacherId = await insertUser(client, 'lecturer');
    const membershipId = await insertSchoolMembership(client, teacherId, schoolId, 'lecturer');
    await client.query(
      'INSERT INTO teacher_profiles (user_id, membership_id, school_id) VALUES ($1, $2, $3)',
      [teacherId, membershipId, schoolId],
    );
    const assignedBy = await insertUser(client, 'admin', 'system');
    const classId = randomUUID();
    await client.query(
      `INSERT INTO classes (id, school_id, code, name, grade, academic_year)
       VALUES ($1, $2, 'TCH', 'Teacher class', '10', '2026-2027')`,
      [classId, schoolId],
    );
    await client.query(
      `INSERT INTO teacher_class_assignments
         (id, class_id, teacher_user_id, school_id, subject, assigned_by, revoked_at)
       VALUES ($1, $2, $3, $4, '  Math  ', $5, now())`,
      [randomUUID(), classId, teacherId, schoolId, assignedBy],
    );
    await client.query(
      `INSERT INTO teacher_class_assignments
         (id, class_id, teacher_user_id, school_id, subject, assigned_by)
       VALUES ($1, $2, $3, $4, 'Math', $5)`,
      [randomUUID(), classId, teacherId, schoolId, assignedBy],
    );
    await assert.rejects(
      client.query(
        `INSERT INTO teacher_class_assignments
           (id, class_id, teacher_user_id, school_id, subject, assigned_by)
         VALUES ($1, $2, $3, $4, ' math ', $5)`,
        [randomUUID(), classId, teacherId, schoolId, assignedBy],
      ),
      (error) => error.code === '23505',
    );
    const history = await client.query(
      `SELECT count(*)::int AS count
         FROM teacher_class_assignments
        WHERE class_id = $1 AND teacher_user_id = $2`,
      [classId, teacherId],
    );
    assert.equal(history.rows[0].count, 3);
  } finally {
    client.release();
  }
});

test('gradebook and assignment submissions persist for the assigned chemistry teacher and five students', {
  skip: !databaseUrl,
}, async () => {
  const client = await connectToSchema();
  try {
    const schoolId = await insertSchool(client);
    const teacherId = await insertUser(client, 'lecturer', null, 'Đức');
    const teacherMembershipId = await insertSchoolMembership(client, teacherId, schoolId, 'lecturer');
    await client.query(
      'INSERT INTO teacher_profiles (user_id, membership_id, school_id) VALUES ($1, $2, $3)',
      [teacherId, teacherMembershipId, schoolId],
    );
    const assignedBy = await insertUser(client, 'admin', 'system');
    const classId = randomUUID();
    await client.query(
      `INSERT INTO classes (id, school_id, code, name, grade, academic_year)
       VALUES ($1, $2, '11A2', '11A2', '11', '2026-2027')`,
      [classId, schoolId],
    );
    await client.query(
      `INSERT INTO teacher_class_assignments
         (id, class_id, teacher_user_id, school_id, subject, assigned_by)
       VALUES ($1, $2, $3, $4, 'Hóa học', $5)`,
      [randomUUID(), classId, teacherId, schoolId, assignedBy],
    );

    const studentNames = ['Văn An', 'Chí Bằng', 'Tuấn Minh', 'Duy Phan', 'Trần Anh'];
    const studentIds = [];
    for (const fullName of studentNames) {
      const studentId = await insertUser(client, 'student', null, fullName);
      const membershipId = await insertSchoolMembership(client, studentId, schoolId, 'student');
      await client.query(
        'INSERT INTO student_profiles (user_id, membership_id, school_id, grade) VALUES ($1, $2, $3, $4)',
        [studentId, membershipId, schoolId, '11'],
      );
      await client.query(
        `INSERT INTO class_memberships (id, class_id, student_user_id, school_id)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), classId, studentId, schoolId],
      );
      studentIds.push(studentId);
    }

    const classroomService = require('../services/school.service');
    const teacherAuth = { userId: teacherId, role: 'lecturer', schoolIds: [schoolId] };
    const input = {
      academicYear: '2026-2027',
      semester: 'Kỳ 1',
      subject: 'Hóa học',
    };
    await classroomService.saveStudentGrades(teacherAuth, classId, studentIds[0], {
      ...input,
      regular: [8, 9, null, null],
      midterm: 8.5,
      final: null,
    });
    const assignment = await classroomService.createClassAssignment(teacherAuth, classId, {
      ...input,
      chapter: 'Chương 1',
      lesson: 'Bài 1',
      title: 'Bài tập cấu tạo nguyên tử',
      description: 'Trả lời các câu hỏi ôn tập.',
      dueAt: '2030-10-25T23:59:00.000Z',
    });
    const resource = await classroomService.createClassLearningResource(teacherAuth, classId, {
      ...input,
      chapter: 'Chương 1',
      lesson: 'Bài 1',
      period: 'Tiết 1',
      title: 'Cấu tạo nguyên tử - ghi chú bổ trợ',
      content: 'Nội dung ôn tập do giáo viên biên soạn.',
      note: '',
    });
    assert.equal((await classroomService.listClassLearningResources(teacherAuth, classId))[0].id, resource.id);
    const uploadedResource = await classroomService.createClassLearningResourceFile(teacherAuth, classId, {
      ...input,
      chapter: 'Chương 1',
      lesson: 'Bài 1',
      title: 'Ảnh minh họa phản ứng',
      note: '',
    }, {
      originalname: 'minh-hoa.png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xZ8AAAAASUVORK5CYII=', 'base64'),
    });
    const replacementFile = Buffer.from('%PDF-1.4 updated lesson');
    await classroomService.updateClassLearningResource(teacherAuth, classId, uploadedResource.id, {
      ...input,
      chapter: 'Chương 1',
      lesson: 'Bài 1',
      title: 'Ảnh minh họa phản ứng đã chỉnh sửa',
      content: '',
      note: 'Đã cập nhật bài giảng.',
      fileName: 'updated-minh-hoa.pdf',
    }, {
      originalname: 'replacement.pdf',
      buffer: replacementFile,
    });
    const uploadedFile = await classroomService.getClassLearningResourceFile(
      teacherAuth,
      uploadedResource.id,
      uploadedResource.file.id,
    );
    assert.equal(uploadedFile.name, 'updated-minh-hoa.pdf');
    assert.equal(uploadedFile.mediaType, 'application/pdf');
    assert.deepEqual(uploadedFile.content, replacementFile);
    const gradebook = await classroomService.getClassGradebook(teacherAuth, classId, input);
    assert.deepEqual(gradebook.map((student) => student.fullName), studentNames);
    assert.deepEqual(gradebook[0].grades.regular, [8, 9, null, null]);
    assert.equal(gradebook[0].assignments.total, 1);
    assert.equal(gradebook[0].assignments.submitted, 0);
    assert.equal(gradebook[0].assignments.overdueMissing, 0);

    const firstStudentAuth = { userId: studentIds[0], role: 'student', schoolIds: [schoolId] };
    await assert.rejects(
      classroomService.listClassAssignmentSubmissions(firstStudentAuth, classId, assignment.id),
      (error) => error.status === 404,
    );
    await assert.rejects(
      classroomService.saveClassAssignmentGrade(firstStudentAuth, classId, assignment.id, studentIds[0], {
        score: 8,
        teacherFeedback: 'Không được phép chấm.',
      }),
      (error) => error.status === 404,
    );
    await assert.rejects(
      classroomService.updateClassLearningResource(firstStudentAuth, classId, uploadedResource.id, {
        ...input,
        chapter: 'Chương 1',
        lesson: 'Bài 1',
        title: 'Không được phép sửa',
        content: '',
        note: '',
      }),
      (error) => error.status === 403,
    );
    const listedAssignments = await classroomService.listStudentAssignments(firstStudentAuth);
    assert.equal(listedAssignments.length, 1);
    assert.equal(listedAssignments[0].id, assignment.id);
    const studentResources = await classroomService.listStudentLearningResources(firstStudentAuth);
    assert.equal(studentResources.length, 2);
    assert.ok(studentResources.some((item) => item.id === resource.id && item.teacherName === 'Đức'));
    assert.ok(studentResources.some((item) => item.id === uploadedResource.id
      && item.title === 'Ảnh minh họa phản ứng đã chỉnh sửa'
      && item.files[0].name === 'updated-minh-hoa.pdf'));
    const studentFile = await classroomService.getClassLearningResourceFile(
      firstStudentAuth,
      uploadedResource.id,
      uploadedResource.file.id,
    );
    assert.equal(studentFile.mediaType, 'application/pdf');
    await classroomService.submitClassAssignment(firstStudentAuth, assignment.id, 'Bài làm của Văn An.');
    const assignmentSubmissions = await classroomService.listClassAssignmentSubmissions(
      teacherAuth,
      classId,
      assignment.id,
    );
    assert.equal(assignmentSubmissions.submissions.length, studentNames.length);
    assert.equal(assignmentSubmissions.submissions.find((submission) => submission.studentId === studentIds[0]).responseText, 'Bài làm của Văn An.');
    assert.ok(assignmentSubmissions.submissions
      .filter((submission) => submission.responseText === null)
      .every((submission) => submission.teacherFeedback === ''));
    await classroomService.saveClassAssignmentGrade(teacherAuth, classId, assignment.id, studentIds[0], {
      score: 8.5,
      teacherFeedback: 'Lập luận tốt, cần trình bày rõ hơn.',
    });
    const gradedSubmissions = await classroomService.listClassAssignmentSubmissions(
      teacherAuth,
      classId,
      assignment.id,
    );
    const gradedSubmission = gradedSubmissions.submissions.find((submission) => submission.studentId === studentIds[0]);
    assert.equal(gradedSubmission.score, 8.5);
    assert.equal(gradedSubmission.teacherFeedback, 'Lập luận tốt, cần trình bày rõ hơn.');
    assert.ok(gradedSubmission.gradedAt);
    const studentAssignmentsAfterGrading = await classroomService.listStudentAssignments(firstStudentAuth);
    assert.equal(studentAssignmentsAfterGrading[0].score, 8.5);
    assert.equal(studentAssignmentsAfterGrading[0].teacherFeedback, 'Lập luận tốt, cần trình bày rõ hơn.');
    await classroomService.submitClassAssignment(firstStudentAuth, assignment.id, 'Bài làm đã cập nhật.');
    const resubmitted = await classroomService.listClassAssignmentSubmissions(teacherAuth, classId, assignment.id);
    const resubmittedWork = resubmitted.submissions.find((submission) => submission.studentId === studentIds[0]);
    assert.equal(resubmittedWork.score, null);
    assert.equal(resubmittedWork.teacherFeedback, '');

    const updatedGradebook = await classroomService.getClassGradebook(teacherAuth, classId, input);
    assert.equal(updatedGradebook[0].assignments.submitted, 1);
    assert.equal(updatedGradebook[1].assignments.submitted, 0);
    const teacherAssignments = await classroomService.listClassAssignments(teacherAuth, classId, input);
    assert.equal(teacherAssignments[0].students.length, studentNames.length);
    assert.equal(teacherAssignments[0].students.filter((student) => student.submittedAt).length, 1);
    assert.equal(teacherAssignments[0].students.find((student) => student.id === studentIds[0]).fullName, studentNames[0]);
    assert.equal(teacherAssignments[0].students.find((student) => student.id === studentIds[1]).submittedAt, null);

    const renamedChapter = await classroomService.renameClassLearningResourceChapter(
      teacherAuth,
      classId,
      'Chương 1',
      { ...input, newChapter: 'Chương đã đổi tên' },
    );
    assert.equal(renamedChapter.updatedCount, 2);
    const renamedResources = await classroomService.listClassLearningResources(teacherAuth, classId);
    assert.ok(renamedResources.every((item) => item.chapter === 'Chương đã đổi tên'));

    await assert.rejects(
      classroomService.deleteClassLearningResourceChapter(
        firstStudentAuth,
        classId,
        'Chương đã đổi tên',
        input,
      ),
      (error) => error.status === 403,
    );
    const deletedChapter = await classroomService.deleteClassLearningResourceChapter(
      teacherAuth,
      classId,
      'Chương đã đổi tên',
      input,
    );
    assert.equal(deletedChapter.deletedCount, 2);
    assert.equal((await classroomService.listClassLearningResources(teacherAuth, classId)).length, 0);
    await assert.rejects(
      classroomService.getClassLearningResourceFile(firstStudentAuth, uploadedResource.id, uploadedResource.file.id),
      (error) => error.status === 404,
    );
    assert.equal((await classroomService.listStudentAssignments(firstStudentAuth)).length, 1);
  } finally {
    client.release();
  }
});

test('concurrent teacher assignments cannot duplicate a normalized active subject', {
  skip: !databaseUrl,
}, async () => {
  const client = await connectToSchema();
  let ids;
  try {
    const schoolId = await insertSchool(client);
    const teacherId = await insertUser(client, 'lecturer');
    const membershipId = await insertSchoolMembership(client, teacherId, schoolId, 'lecturer');
    await client.query(
      'INSERT INTO teacher_profiles (user_id, membership_id, school_id) VALUES ($1, $2, $3)',
      [teacherId, membershipId, schoolId],
    );
    const assignedBy = await insertUser(client, 'admin', 'system');
    const classId = randomUUID();
    await client.query(
      `INSERT INTO classes (id, school_id, code, name, grade, academic_year)
       VALUES ($1, $2, 'RACE', 'Race test class', '10', '2026-2027')`,
      [classId, schoolId],
    );
    ids = { schoolId, teacherId, assignedBy, classId };
  } finally {
    client.release();
  }
  const outcomes = await runConcurrentInserts(
    `INSERT INTO teacher_class_assignments
       (id, class_id, teacher_user_id, school_id, subject, assigned_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), ids.classId, ids.teacherId, ids.schoolId, 'Math', ids.assignedBy],
    [randomUUID(), ids.classId, ids.teacherId, ids.schoolId, ' math ', ids.assignedBy],
  );
  assert.equal(outcomes.filter((error) => error === null).length, 1);
  assert.equal(outcomes.filter((error) => error?.code === '23505').length, 1);
});

test('student and lecturer active-school constraint is role-aware and concurrency-safe', {
  skip: !databaseUrl,
}, async () => {
  const setup = await connectToSchema();
  let studentId;
  let schoolA;
  let schoolB;
  try {
    studentId = await insertUser(setup, 'student');
    schoolA = await insertSchool(setup);
    schoolB = await insertSchool(setup);
  } finally {
    setup.release();
  }
  const outcomes = await runConcurrentInserts(
    `INSERT INTO school_memberships (id, user_id, school_id, role)
     VALUES ($1, $2, $3, 'student')`,
    [randomUUID(), studentId, schoolA],
    [randomUUID(), studentId, schoolB],
  );
  assert.equal(outcomes.filter((error) => error === null).length, 1);
  assert.equal(outcomes.filter((error) => error?.code === '23505').length, 1);

  const adminSetup = await connectToSchema();
  try {
    const activeMembership = await adminSetup.query(
      `SELECT school_id
         FROM school_memberships
        WHERE user_id = $1 AND status = 'active'`,
      [studentId],
    );
    assert.equal(activeMembership.rowCount, 1);
    const secondSchool = activeMembership.rows[0].school_id === schoolA ? schoolB : schoolA;
    await adminSetup.query(
      `UPDATE school_memberships SET status = 'inactive'
        WHERE user_id = $1 AND status = 'active'`,
      [studentId],
    );
    await insertSchoolMembership(adminSetup, studentId, secondSchool, 'student');
    await adminSetup.query(
      `UPDATE schools SET status = 'suspended' WHERE id = $1`,
      [secondSchool],
    );
    const thirdSchool = await insertSchool(adminSetup);
    await assert.rejects(
      insertSchoolMembership(adminSetup, studentId, thirdSchool, 'student'),
      (error) => error.code === '23505',
    );

    const adminId = await insertUser(adminSetup, 'admin', 'school');
    await insertSchoolMembership(adminSetup, adminId, schoolA, 'admin');
    await insertSchoolMembership(adminSetup, adminId, schoolB, 'admin');
  } finally {
    adminSetup.release();
  }
});

test('concurrent refresh rotation is serialized and replay revokes the session', {
  skip: !databaseUrl,
}, async () => {
  const client = await connectToSchema();
  let refreshToken;
  let sessionId;
  try {
    const schoolId = await insertSchool(client);
    const userId = await insertUser(client, 'student');
    await insertSchoolMembership(client, userId, schoolId, 'student');
    sessionId = randomUUID();
    refreshToken = crypto.randomBytes(32).toString('base64url');
    const { hashRefreshToken } = require('../auth/tokens');
    await client.query(
      'INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval \'1 day\')',
      [sessionId, userId],
    );
    await client.query(
      `INSERT INTO auth_refresh_tokens (id, session_id, token_hash, expires_at)
       VALUES ($1, $2, $3, now() + interval '1 day')`,
      [randomUUID(), sessionId, hashRefreshToken(refreshToken)],
    );
  } finally {
    client.release();
  }

  const rotations = await Promise.allSettled([
    authService.rotateRefreshToken(refreshToken),
    authService.rotateRefreshToken(refreshToken),
  ]);
  const successful = rotations.filter((result) => result.status === 'fulfilled');
  const rejected = rotations.filter((result) => result.status === 'rejected');
  assert.equal(successful.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.status, 401);

  await assert.rejects(
    authService.rotateRefreshToken(successful[0].value.refreshToken),
    (error) => error.status === 401,
  );
  const check = await connectToSchema();
  try {
    const session = await check.query('SELECT revoked_at FROM auth_sessions WHERE id = $1', [sessionId]);
    assert.ok(session.rows[0].revoked_at);
  } finally {
    check.release();
  }
});

test('concurrent invitation requests produce one pending invitation', {
  skip: !databaseUrl,
}, async () => {
  const client = await connectToSchema();
  try {
    const schoolId = await insertSchool(client);
    const adminId = await insertUser(client, 'admin', 'system');
    const invitations = await Promise.allSettled([
      authService.createInvitation({
        email: 'race@example.invalid',
        role: 'student',
        schoolId,
        invitedBy: adminId,
        adminScope: 'system',
        allowedSchoolIds: [],
      }),
      authService.createInvitation({
        email: 'race@example.invalid',
        role: 'student',
        schoolId,
        invitedBy: adminId,
        adminScope: 'system',
        allowedSchoolIds: [],
      }),
    ]);
    assert.equal(invitations.filter(({ status }) => status === 'fulfilled').length, 1);
    assert.equal(invitations.filter(({ status, reason }) => status === 'rejected' && reason.status === 409).length, 1);
  } finally {
    client.release();
  }
});

test('expired invitations release the pending unique slot without losing history', {
  skip: !databaseUrl,
}, async () => {
  const client = await connectToSchema();
  try {
    const schoolId = await insertSchool(client);
    const adminId = await insertUser(client, 'admin', 'system');
    const email = `${randomUUID()}@example.invalid`;
    const firstInvitation = await authService.createInvitation({
      email,
      role: 'student',
      schoolId,
      invitedBy: adminId,
      adminScope: 'system',
      allowedSchoolIds: [],
    });
    await client.query(
      `UPDATE account_invitations SET expires_at = now() - interval '1 day'
        WHERE lower(email) = lower($1)`,
      [email],
    );
    const secondInvitation = await authService.createInvitation({
      email,
      role: 'student',
      schoolId,
      invitedBy: adminId,
      adminScope: 'system',
      allowedSchoolIds: [],
    });
    const inviteRows = await client.query(
      `SELECT closed_at, closed_reason
         FROM account_invitations
        WHERE lower(email) = lower($1)
        ORDER BY created_at`,
      [email],
    );
    assert.equal(inviteRows.rowCount, 2);
    assert.ok(inviteRows.rows[0].closed_at);
    assert.equal(inviteRows.rows[0].closed_reason, 'expired');
    assert.equal(inviteRows.rows[1].closed_at, null);

    await assert.rejects(
      authService.acceptInvitation({
        token: firstInvitation.token,
        fullName: 'Expired Invite',
        password: 'integration-password-1',
      }),
      (error) => error.status === 400,
    );
    const accepted = await authService.acceptInvitation({
      token: secondInvitation.token,
      fullName: 'Accepted Invite',
      password: 'integration-password-2',
    });
    assert.equal(accepted.user.role, 'student');
    const loggedIn = await authService.login(email, 'integration-password-2');
    assert.deepEqual(loggedIn.user.schoolIds, [schoolId]);
    const acceptedRow = await client.query(
      `SELECT consumed_at, closed_at
         FROM account_invitations
        WHERE lower(email) = lower($1) AND consumed_at IS NOT NULL`,
      [email],
    );
    assert.equal(acceptedRow.rowCount, 1);
    assert.equal(acceptedRow.rows[0].closed_at, null);
  } finally {
    client.release();
  }
});

test('invitation acceptance refuses a school suspended after invitation creation', {
  skip: !databaseUrl,
}, async () => {
  const client = await connectToSchema();
  try {
    const schoolId = await insertSchool(client);
    const adminId = await insertUser(client, 'admin', 'system');
    const email = `${randomUUID()}@example.invalid`;
    const invitation = await authService.createInvitation({
      email,
      role: 'lecturer',
      schoolId,
      invitedBy: adminId,
      adminScope: 'system',
      allowedSchoolIds: [],
    });
    await client.query("UPDATE schools SET status = 'suspended' WHERE id = $1", [schoolId]);
    await assert.rejects(
      authService.acceptInvitation({
        token: invitation.token,
        fullName: 'Suspended School Invite',
        password: 'integration-password-3',
      }),
      (error) => error.status === 400,
    );
    const users = await client.query('SELECT count(*)::int AS count FROM users WHERE lower(email) = lower($1)', [email]);
    assert.equal(users.rows[0].count, 0);
  } finally {
    client.release();
  }
});
