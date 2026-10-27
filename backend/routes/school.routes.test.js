const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const { after, before, beforeEach, test } = require('node:test');
const express = require('express');

process.env.AUTH_JWT_SECRET = crypto.randomBytes(32).toString('base64');
process.env.NODE_ENV = 'test';

const ids = {
  systemAdmin: '10000000-0000-4000-8000-000000000001',
  schoolAdmin: '10000000-0000-4000-8000-000000000002',
  teacherA: '10000000-0000-4000-8000-000000000003',
  teacherB: '10000000-0000-4000-8000-000000000004',
  studentA: '10000000-0000-4000-8000-000000000005',
  studentB: '10000000-0000-4000-8000-000000000006',
  noSchoolTeacher: '10000000-0000-4000-8000-000000000007',
  multiSchoolStudent: '10000000-0000-4000-8000-000000000008',
  disabledTeacher: '10000000-0000-4000-8000-000000000009',
  inconsistentRosterStudent: '10000000-0000-4000-8000-000000000010',
  multiSchoolTeacher: '10000000-0000-4000-8000-000000000012',
  disabledStudent: '10000000-0000-4000-8000-000000000013',
  schoolA: '20000000-0000-4000-8000-000000000001',
  schoolB: '20000000-0000-4000-8000-000000000002',
  suspendedSchool: '20000000-0000-4000-8000-000000000003',
  classA: '30000000-0000-4000-8000-000000000001',
  classB: '30000000-0000-4000-8000-000000000002',
  archivedClass: '30000000-0000-4000-8000-000000000003',
  suspendedSchoolClass: '30000000-0000-4000-8000-000000000004',
  endedStudent: '10000000-0000-4000-8000-000000000011',
};

function makeFixture() {
  const users = new Map([
    [ids.systemAdmin, { role: 'admin', admin_scope: 'system', status: 'active', full_name: 'System Admin', email: 'system@example.invalid' }],
    [ids.schoolAdmin, { role: 'admin', admin_scope: 'school', status: 'active', full_name: 'School Admin', email: 'school-admin@example.invalid' }],
    [ids.teacherA, { role: 'lecturer', admin_scope: null, status: 'active', full_name: 'Teacher A', email: 'teacher-a@example.invalid' }],
    [ids.teacherB, { role: 'lecturer', admin_scope: null, status: 'active', full_name: 'Teacher B', email: 'teacher-b@example.invalid' }],
    [ids.studentA, { role: 'student', admin_scope: null, status: 'active', full_name: 'Student A', email: 'student-a@example.invalid' }],
    [ids.studentB, { role: 'student', admin_scope: null, status: 'active', full_name: 'Student B', email: 'student-b@example.invalid' }],
    [ids.noSchoolTeacher, { role: 'lecturer', admin_scope: null, status: 'active', full_name: 'No School', email: 'no-school@example.invalid' }],
    [ids.multiSchoolStudent, { role: 'student', admin_scope: null, status: 'active', full_name: 'Multi School', email: 'multi-school@example.invalid' }],
    [ids.disabledTeacher, { role: 'lecturer', admin_scope: null, status: 'disabled', full_name: 'Disabled', email: 'disabled@example.invalid' }],
    [ids.inconsistentRosterStudent, { role: 'student', admin_scope: null, status: 'active', full_name: 'Inconsistent', email: 'inconsistent@example.invalid' }],
    [ids.endedStudent, { role: 'student', admin_scope: null, status: 'active', full_name: 'Ended Student', email: 'ended@example.invalid' }],
    [ids.multiSchoolTeacher, { role: 'lecturer', admin_scope: null, status: 'active', full_name: 'Multi School Teacher', email: 'multi-teacher@example.invalid' }],
    [ids.disabledStudent, { role: 'student', admin_scope: null, status: 'disabled', full_name: 'Disabled Student', email: 'disabled-student@example.invalid' }],
  ]);
  const schools = new Map([
    [ids.schoolA, { name: 'School A', status: 'active' }],
    [ids.schoolB, { name: 'School B', status: 'active' }],
    [ids.suspendedSchool, { name: 'Suspended School', status: 'suspended' }],
  ]);
  const memberships = [
    { user_id: ids.schoolAdmin, school_id: ids.schoolA, status: 'active' },
    { user_id: ids.teacherA, school_id: ids.schoolA, status: 'active' },
    { user_id: ids.teacherB, school_id: ids.schoolB, status: 'active' },
    { user_id: ids.studentA, school_id: ids.schoolA, status: 'active' },
    { user_id: ids.studentB, school_id: ids.schoolB, status: 'active' },
    { user_id: ids.noSchoolTeacher, school_id: ids.schoolA, status: 'inactive' },
    { user_id: ids.multiSchoolStudent, school_id: ids.schoolA, status: 'active' },
    { user_id: ids.multiSchoolStudent, school_id: ids.schoolB, status: 'active' },
    { user_id: ids.inconsistentRosterStudent, school_id: ids.schoolA, status: 'active' },
    { user_id: ids.inconsistentRosterStudent, school_id: ids.schoolB, status: 'active' },
    { user_id: ids.endedStudent, school_id: ids.schoolA, status: 'active' },
    { user_id: ids.multiSchoolTeacher, school_id: ids.schoolA, status: 'active' },
    { user_id: ids.multiSchoolTeacher, school_id: ids.schoolB, status: 'active' },
    { user_id: ids.disabledStudent, school_id: ids.schoolA, status: 'active' },
  ];
  const classes = [
    { id: ids.classA, school_id: ids.schoolA, code: '10A1', name: 'Lớp 10A1', grade: '10', academic_year: '2026-2027', status: 'active' },
    { id: ids.classB, school_id: ids.schoolB, code: '10B1', name: 'Lớp 10B1', grade: '10', academic_year: '2026-2027', status: 'active' },
    { id: ids.archivedClass, school_id: ids.schoolA, code: '10A2', name: 'Lớp lưu trữ', grade: '10', academic_year: '2026-2027', status: 'archived' },
    { id: ids.suspendedSchoolClass, school_id: ids.suspendedSchool, code: '10C1', name: 'Lớp trường tạm ngưng', grade: '10', academic_year: '2026-2027', status: 'active' },
  ];
  const classMemberships = [
    { class_id: ids.classA, student_user_id: ids.studentA, status: 'active' },
    { class_id: ids.classA, student_user_id: ids.endedStudent, status: 'ended' },
    { class_id: ids.classB, student_user_id: ids.studentB, status: 'active' },
    { class_id: ids.classA, student_user_id: ids.inconsistentRosterStudent, status: 'active' },
    { class_id: ids.classA, student_user_id: ids.disabledStudent, status: 'active' },
  ];
  const teacherAssignments = [
    { class_id: ids.classA, teacher_user_id: ids.teacherA, revoked_at: null },
    { class_id: ids.classB, teacher_user_id: ids.teacherB, revoked_at: null },
  ];
  const sessions = new Map([...users.keys()].map((userId) => [`session-${userId}`, userId]));
  return { users, schools, memberships, classes, classMemberships, teacherAssignments, sessions };
}

let fixture;
let activeServer;
let baseUrl;

const poolModulePath = require.resolve('../db/pool');
const poolModule = new Module(poolModulePath);
poolModule.filename = poolModulePath;
poolModule.loaded = true;
poolModule.exports = { getPool: () => fakePool };
require.cache[poolModulePath] = poolModule;

function getActiveSchoolIds(userId) {
  return [...new Set(fixture.memberships
    .filter((membership) => membership.user_id === userId && membership.status === 'active')
    .filter((membership) => fixture.schools.get(membership.school_id)?.status === 'active')
    .map((membership) => membership.school_id))];
}

function classRow(classroom) {
  return {
    ...classroom,
    school_name: fixture.schools.get(classroom.school_id).name,
  };
}

const fakePool = {
  async query(sql, values = []) {
    const query = sql.replace(/\s+/g, ' ').trim();
    if (query.includes('FROM auth_sessions s')) {
      const userId = fixture.sessions.get(values[0]);
      const user = userId === values[1] ? fixture.users.get(userId) : null;
      if (!user || user.status !== 'active') return { rows: [] };
      return {
        rows: [{
          id: userId,
          role: user.role,
          admin_scope: user.admin_scope,
          must_change_password: false,
          profile_completed_at: new Date(),
          school_ids: getActiveSchoolIds(userId),
        }],
      };
    }
    if (query.includes('COUNT(DISTINCT s.id)::int AS active_school_count')) {
      const user = fixture.users.get(values[0]);
      if (!user) return { rows: [] };
      const activeSchoolIds = getActiveSchoolIds(values[0]);
      return {
        rows: [{
          role: user.role,
          status: user.status,
          active_school_count: activeSchoolIds.length,
          school_id: activeSchoolIds[0] ?? null,
        }],
      };
    }
    if (query.includes('active_school_count') && query.includes('FROM class_memberships cm')) {
      const [classId] = values;
      const rows = fixture.classMemberships
        .filter((membership) => membership.class_id === classId && membership.status === 'active')
        .map((membership) => {
          const user = fixture.users.get(membership.student_user_id);
          if (!user || user.status !== 'active') return null;
          const activeSchoolIds = getActiveSchoolIds(membership.student_user_id);
          const profileMembership = fixture.memberships.find((item) => (
            item.user_id === membership.student_user_id && item.status === 'active'
          ));
          return {
            id: membership.student_user_id,
            full_name: user.full_name,
            email: user.email,
            grade: '10',
            student_number: null,
            active_school_count: activeSchoolIds.length,
            active_school_id: activeSchoolIds[0] ?? null,
            profile_school_id: profileMembership?.school_id ?? null,
          };
        })
        .filter(Boolean);
      return { rows };
    }
    if (query.includes('FROM classes c')
      && query.includes('WHERE c.id = $1')
      && query.includes('($2::boolean OR c.school_id = ANY($3::uuid[]))')) {
      const [classId, systemAdmin, schoolIds] = values;
      const classroom = fixture.classes.find((item) => item.id === classId
        && item.status === 'active'
        && fixture.schools.get(item.school_id)?.status === 'active'
        && (systemAdmin || schoolIds.includes(item.school_id)));
      return { rows: classroom ? [classRow(classroom)] : [] };
    }
    if (query.includes('FROM classes c')
      && query.includes('WHERE c.id = $1')
      && query.includes('EXISTS ( SELECT 1 FROM teacher_class_assignments tca')) {
      const [classId, teacherId, schoolId] = values;
      const assigned = fixture.teacherAssignments.some((item) => (
        item.class_id === classId && item.teacher_user_id === teacherId && item.revoked_at === null
      ));
      const homeroomAssigned = fixture.homeroomAssignments?.some((item) => (
        item.class_id === classId && item.teacher_user_id === teacherId
      ));
      const classroom = fixture.classes.find((item) => item.id === classId
        && item.school_id === schoolId && item.status === 'active'
        && fixture.schools.get(item.school_id)?.status === 'active');
      return { rows: (assigned || homeroomAssigned) && classroom ? [classRow(classroom)] : [] };
    }
    if (query.includes('FROM class_memberships cm') && query.includes('WHERE c.id = $1')) {
      const [classId, studentId, schoolId] = values;
      const member = fixture.classMemberships.some((item) => (
        item.class_id === classId && item.student_user_id === studentId && item.status === 'active'
      ));
      const classroom = fixture.classes.find((item) => item.id === classId
        && item.school_id === schoolId && item.status === 'active'
        && fixture.schools.get(item.school_id)?.status === 'active');
      return { rows: member && classroom ? [classRow(classroom)] : [] };
    }
    if (query.includes('FROM classes c') && query.includes('ANY($2::uuid[])')) {
      const [systemAdmin, schoolIds, requestedSchoolId] = values;
      const rows = fixture.classes
        .filter((item) => item.status === 'active'
          && fixture.schools.get(item.school_id)?.status === 'active'
          && (systemAdmin || schoolIds.includes(item.school_id))
          && (!requestedSchoolId || item.school_id === requestedSchoolId))
        .map(classRow);
      return { rows };
    }
    if (query.includes('FROM teacher_class_assignments tca')) {
      const [teacherId, schoolId] = values;
      const rows = fixture.teacherAssignments
        .filter((assignment) => assignment.teacher_user_id === teacherId && assignment.revoked_at === null)
        .map((assignment) => fixture.classes.find((item) => item.id === assignment.class_id))
        .filter((classroom) => classroom && classroom.school_id === schoolId && classroom.status === 'active'
          && fixture.schools.get(classroom.school_id)?.status === 'active')
        .map(classRow);
      return { rows };
    }
    if (query.includes('FROM class_memberships cm')) {
      const [studentId, schoolId] = values;
      const rows = fixture.classMemberships
        .filter((membership) => membership.student_user_id === studentId && membership.status === 'active')
        .map((membership) => fixture.classes.find((item) => item.id === membership.class_id))
        .filter((classroom) => classroom && classroom.school_id === schoolId && classroom.status === 'active'
          && fixture.schools.get(classroom.school_id)?.status === 'active')
        .map(classRow);
      return { rows };
    }
    throw new Error(`Unexpected school API test query: ${query}`);
  },
};

const { signAccessToken } = require('../auth/tokens');
const router = require('./school.routes');

function authHeader(userId) {
  const scheme = ['Bear', 'er '].join('');
  return `${scheme}${signAccessToken(userId, `session-${userId}`)}`;
}

async function request(path, userId) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: userId ? { Authorization: authHeader(userId) } : {},
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  const app = express();
  app.use('/api', router);
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ success: false, message: 'Internal server error.' });
  });
  await new Promise((resolve) => {
    activeServer = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${activeServer.address().port}/api`;
});

after(async () => {
  await new Promise((resolve, reject) => activeServer.close((error) => error ? reject(error) : resolve()));
});

beforeEach(() => {
  fixture = makeFixture();
});

test('system admin lists only active classes in active schools', async () => {
  const response = await request('/classes', ids.systemAdmin);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.classes.map((item) => item.id).sort(), [ids.classA, ids.classB].sort());
});

test('school admin is restricted to school scope and cannot target another school', async () => {
  const response = await request('/classes', ids.schoolAdmin);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.classes.map((item) => item.id), [ids.classA]);

  const crossSchool = await request(`/classes?schoolId=${ids.schoolB}`, ids.schoolAdmin);
  assert.equal(crossSchool.status, 404);
  assert.equal(crossSchool.body.code, 'SCHOOL_NOT_FOUND');
  const crossClass = await request(`/classes/${ids.classB}`, ids.schoolAdmin);
  assert.equal(crossClass.status, 404);
});

test('teacher sees only assigned classes and cannot read a class after assignment revocation', async () => {
  const list = await request('/classes', ids.teacherA);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.classes.map((item) => item.id), [ids.classA]);

  const crossClass = await request(`/classes/${ids.classB}`, ids.teacherA);
  assert.equal(crossClass.status, 404);
  fixture.teacherAssignments[0].revoked_at = new Date();
  const revoked = await request(`/classes/${ids.classA}`, ids.teacherA);
  assert.equal(revoked.status, 404);
});

test('student sees only active memberships and cannot read ended or unrelated classes', async () => {
  const list = await request('/classes', ids.studentA);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.classes.map((item) => item.id), [ids.classA]);

  const unrelated = await request(`/classes/${ids.classB}`, ids.studentA);
  assert.equal(unrelated.status, 404);
  fixture.classMemberships.find((item) => item.student_user_id === ids.studentA).status = 'ended';
  const ended = await request(`/classes/${ids.classA}`, ids.studentA);
  assert.equal(ended.status, 404);
});

test('student and teacher with no active school receive an explicit invariant error', async () => {
  for (const userId of [ids.noSchoolTeacher]) {
    const response = await request('/classes', userId);
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'SCHOOL_MEMBERSHIP_INVARIANT_VIOLATION');
  }
  fixture.memberships = fixture.memberships.filter((item) => item.user_id !== ids.studentA);
  const student = await request('/classes', ids.studentA);
  assert.equal(student.status, 409);
  assert.equal(student.body.code, 'SCHOOL_MEMBERSHIP_INVARIANT_VIOLATION');
});

test('student or teacher with multiple active schools fails closed without selecting one', async () => {
  for (const userId of [ids.multiSchoolStudent, ids.multiSchoolTeacher]) {
    const response = await request('/classes', userId);
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'SCHOOL_MEMBERSHIP_INVARIANT_VIOLATION');
  }
  const detail = await request(`/classes/${ids.classA}`, ids.multiSchoolStudent);
  assert.equal(detail.status, 409);
  assert.equal(detail.body.code, 'SCHOOL_MEMBERSHIP_INVARIANT_VIOLATION');
});

test('disabled account, archived class, and suspended school are inaccessible', async () => {
  const disabled = await request('/classes', ids.disabledTeacher);
  assert.equal(disabled.status, 401);

  const archived = await request(`/classes/${ids.archivedClass}`, ids.systemAdmin);
  assert.equal(archived.status, 404);
  const suspendedSchool = await request(`/classes/${ids.suspendedSchoolClass}`, ids.systemAdmin);
  assert.equal(suspendedSchool.status, 404);
});

test('authorized teacher can read active students, but student cannot read a roster', async () => {
  const response = await request(`/classes/${ids.classA}/students`, ids.teacherA);
  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'SCHOOL_MEMBERSHIP_INVARIANT_VIOLATION');

  fixture.classMemberships = fixture.classMemberships.filter(
    (item) => item.student_user_id !== ids.inconsistentRosterStudent,
  );
  const roster = await request(`/classes/${ids.classA}/students`, ids.teacherA);
  assert.equal(roster.status, 200);
  assert.deepEqual(roster.body.students.map((item) => item.id), [ids.studentA]);
  assert.ok(!roster.body.students.some((item) => item.id === ids.disabledStudent));

  const forbidden = await request(`/classes/${ids.classA}/students`, ids.studentA);
  assert.equal(forbidden.status, 403);
});

test('unauthenticated and malformed class requests are rejected', async () => {
  const unauthenticated = await request('/classes');
  assert.equal(unauthenticated.status, 401);

  const malformed = await request('/classes/not-a-uuid', ids.systemAdmin);
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.code, 'SCHOOL_INVALID_ID');
});
