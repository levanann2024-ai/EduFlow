const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createAdminSchoolService } = require('./admin-school.service');

const ids = {
  admin: '10000000-0000-4000-8000-000000000001',
  school: '20000000-0000-4000-8000-000000000001',
  year: '30000000-0000-4000-8000-000000000001',
  class: '40000000-0000-4000-8000-000000000001',
  student: '50000000-0000-4000-8000-000000000001',
  oldClass: '40000000-0000-4000-8000-000000000002',
};

const schoolAdmin = {
  userId: ids.admin,
  role: 'admin',
  adminScope: 'school',
  schoolIds: [ids.school],
};

function createPool(handler) {
  const calls = [];
  const query = async (sql, values = []) => {
    calls.push({ sql, values });
    return handler(sql, values, calls.length);
  };
  return {
    calls,
    query,
    async connect() {
      return {
        query,
        release() {},
      };
    },
  };
}

function rows(...items) {
  return { rows: items, rowCount: items.length };
}

test('school-scoped admins cannot query a school outside their authorization scope', async () => {
  let queries = 0;
  const pool = createPool(async () => {
    queries += 1;
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  await assert.rejects(
    service.listAcademicYears(schoolAdmin, '20000000-0000-4000-8000-000000000002'),
    { status: 404, code: 'ADMIN_SCHOOL_NOT_FOUND' },
  );
  assert.equal(queries, 0);
});

test('academic-year creation validates dates and records the admin in one transaction', async () => {
  const pool = createPool(async (sql, values) => {
    if (sql.includes('FROM schools')) return rows({ id: ids.school });
    if (sql.includes('INSERT INTO academic_years')) {
      assert.equal(values[1], ids.school);
      assert.equal(values[2], '2027-2028');
      assert.equal(values[3], '2027-09-01');
      assert.equal(values[4], '2028-05-31');
      assert.equal(values[6], ids.admin);
      return rows({ id: ids.year, name: values[2], status: values[5], is_current: false });
    }
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  const result = await service.createAcademicYear(schoolAdmin, ids.school, {
    name: ' 2027-2028 ',
    startsOn: '2027-09-01',
    endsOn: '2028-05-31',
    status: 'planned',
  });

  assert.equal(result.id, ids.year);
  assert.deepEqual(pool.calls.map((call) => call.sql), [
    'BEGIN',
    'SELECT id FROM schools WHERE id = $1 AND status = \'active\'',
    pool.calls[2].sql,
    'COMMIT',
  ]);
  assert.match(pool.calls[2].sql, /INSERT INTO academic_years/);
  await assert.rejects(
    service.createAcademicYear(schoolAdmin, ids.school, {
      name: 'invalid',
      startsOn: '2027-02-30',
      endsOn: '2027-05-31',
    }),
    { status: 400, code: 'ADMIN_INVALID_INPUT' },
  );
});

test('setting the current academic year clears the previous one transactionally', async () => {
  const pool = createPool(async (sql) => {
    if (sql.includes('FROM schools')) return rows({ id: ids.school });
    if (sql.includes('FROM academic_years')) {
      return rows({ id: ids.year, name: '2027-2028', status: 'planned', is_current: false });
    }
    if (sql.includes('RETURNING id, name, starts_on')) {
      return rows({ id: ids.year, name: '2027-2028', status: 'active', is_current: true });
    }
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  const result = await service.setCurrentAcademicYear(schoolAdmin, ids.school, ids.year);

  assert.equal(result.is_current, true);
  assert.ok(pool.calls.some(({ sql }) => /SET is_current = false/.test(sql)));
  assert.ok(pool.calls.some(({ sql }) => /SET status = 'active', is_current = true/.test(sql)));
  assert.equal(pool.calls.at(-1).sql, 'COMMIT');
});

test('duplicate classes in the same year are rejected and rolled back', async () => {
  const pool = createPool(async (sql) => {
    if (sql.includes('FROM schools')) return rows({ id: ids.school });
    if (sql.includes('FROM academic_years')) {
      return rows({ id: ids.year, name: '2027-2028', status: 'active' });
    }
    if (sql.includes('INSERT INTO classes')) {
      const error = new Error('unique class name');
      error.code = '23505';
      throw error;
    }
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  await assert.rejects(
    service.createClass(schoolAdmin, ids.school, {
      name: '11A2',
      grade: '11',
      academicYearId: ids.year,
    }),
    { status: 409, code: 'ADMIN_DUPLICATE' },
  );
  assert.equal(pool.calls.at(-1).sql, 'ROLLBACK');
});

test('adding a class subject links the catalog subject without requiring a teacher assignment', async () => {
  let classSubjectReads = 0;
  const pool = createPool(async (sql) => {
    if (sql.includes('FROM schools')) return rows({ id: ids.school });
    if (sql.includes('FROM classes c') && sql.includes('FOR UPDATE OF c, ay')) {
      return rows({ id: ids.class });
    }
    if (sql.includes('FROM school_subjects') && sql.includes('SELECT id, name')) {
      return rows({ id: '60000000-0000-4000-8000-000000000001', name: 'Toán' });
    }
    if (sql.includes('SELECT subject FROM class_subjects')) {
      classSubjectReads += 1;
      return classSubjectReads === 1 ? rows() : rows({ subject: 'Toán' });
    }
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  const result = await service.addClassSubject(
    schoolAdmin,
    ids.school,
    ids.class,
    '60000000-0000-4000-8000-000000000001',
  );

  assert.deepEqual(result, {
    classId: ids.class,
    subjectId: '60000000-0000-4000-8000-000000000001',
    name: 'Toán',
  });
  assert.ok(pool.calls.some(({ sql }) => /INSERT INTO class_subjects/.test(sql)));
  assert.equal(pool.calls.some(({ sql }) => /INSERT INTO teacher_class_assignments/.test(sql)), false);
  assert.equal(pool.calls.at(-1).sql, 'COMMIT');
});

test('student transfer ends the old membership and inserts a new one without touching grades', async () => {
  const pool = createPool(async (sql, values) => {
    if (sql.includes('FROM schools')) return rows({ id: ids.school });
    if (sql.includes('FROM classes c') && sql.includes('FOR UPDATE OF c')) {
      return rows({ id: ids.class, academic_year_id: ids.year });
    }
    if (sql.includes('FROM users u') && sql.includes('student_profiles')) return rows({ id: ids.student });
    if (sql.includes('FROM class_memberships') && sql.includes('FOR UPDATE')) {
      return rows({ id: 'membership-old', class_id: ids.oldClass });
    }
    if (sql.includes('UPDATE class_memberships')) return rows();
    if (sql.includes('INSERT INTO class_memberships')) {
      assert.deepEqual(values.slice(1, 5), [ids.class, ids.student, ids.school, ids.year]);
      return rows({ id: 'membership-new', class_id: ids.class, status: 'active' });
    }
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  const result = await service.changeStudentMembership(schoolAdmin, ids.school, ids.class, ids.student);

  assert.equal(result.id, 'membership-new');
  const endOld = pool.calls.findIndex(({ sql }) => /UPDATE class_memberships/.test(sql));
  const insertNew = pool.calls.findIndex(({ sql }) => /INSERT INTO class_memberships/.test(sql));
  assert.ok(endOld >= 0 && insertNew > endOld);
  assert.match(pool.calls[endOld].sql, /status = 'ended', ended_at = now\(\)/);
  assert.equal(pool.calls.some(({ sql }) => /student_term_grades|grade_history/.test(sql)), false);
  assert.equal(pool.calls.at(-1).sql, 'COMMIT');
});

test('duplicate active subject assignments are rejected without adding another teacher', async () => {
  const pool = createPool(async (sql) => {
    if (sql.includes('FROM schools')) return rows({ id: ids.school });
    if (sql.includes('FROM classes c') && sql.includes('FOR UPDATE OF c, ay')) {
      return rows({ id: ids.class, academic_year_id: ids.year });
    }
    if (sql.includes('FROM school_subjects') && sql.includes('SELECT id, name')) {
      return rows({ id: '60000000-0000-4000-8000-000000000001', name: 'Toán' });
    }
    if (sql.includes('FROM users u') && sql.includes('teacher_profiles')) return rows({ id: '70000000-0000-4000-8000-000000000001' });
    if (sql.includes('FROM teacher_class_assignments') && sql.includes('FOR UPDATE')) return rows({ id: 'active-assignment' });
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  await assert.rejects(
    service.createAssignment(schoolAdmin, ids.school, {
      classId: ids.class,
      academicYearId: ids.year,
      subjectId: '60000000-0000-4000-8000-000000000001',
      teacherUserId: '70000000-0000-4000-8000-000000000001',
    }),
    { status: 409, code: 'ADMIN_ASSIGNMENT_EXISTS' },
  );
  assert.equal(pool.calls.some(({ sql }) => /INSERT INTO teacher_class_assignments/.test(sql)), false);
  assert.equal(pool.calls.at(-1).sql, 'ROLLBACK');
});

test('teaching assignments reject non-teachers and roll back without creating an assignment', async () => {
  const pool = createPool(async (sql) => {
    if (sql.includes('FROM schools')) return rows({ id: ids.school });
    if (sql.includes('FROM classes c') && sql.includes('FOR UPDATE OF c')) {
      return rows({ id: ids.class, academic_year_id: ids.year });
    }
    if (sql.includes('FROM school_subjects') && sql.includes('SELECT id, name')) {
      return rows({ id: '60000000-0000-4000-8000-000000000001', name: 'Toán' });
    }
    if (sql.includes('FROM users u') && sql.includes('teacher_profiles')) return rows();
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  await assert.rejects(
    service.createAssignment(schoolAdmin, ids.school, {
      classId: ids.class,
      academicYearId: ids.year,
      subjectId: '60000000-0000-4000-8000-000000000001',
      teacherUserId: ids.student,
    }),
    { status: 400, code: 'ADMIN_INVALID_TEACHER' },
  );
  assert.equal(pool.calls.some(({ sql }) => /INSERT INTO teacher_class_assignments/.test(sql)), false);
  assert.equal(pool.calls.at(-1).sql, 'ROLLBACK');
});

test('one active teacher can receive assignments across classes and subjects', async () => {
  const secondClassId = '40000000-0000-4000-8000-000000000003';
  const mathSubjectId = '60000000-0000-4000-8000-000000000001';
  const scienceSubjectId = '60000000-0000-4000-8000-000000000002';
  const subjectNames = new Map([[mathSubjectId, 'Toán'], [scienceSubjectId, 'Khoa học']]);
  const pool = createPool(async (sql, values) => {
    if (sql.includes('FROM schools')) return rows({ id: ids.school });
    if (sql.includes('FROM classes c') && sql.includes('FOR UPDATE OF c, ay')) {
      return rows({ id: values[0], academic_year_id: ids.year });
    }
    if (sql.includes('FROM school_subjects') && sql.includes('SELECT id, name')) {
      return rows({ id: values[0], name: subjectNames.get(values[0]) });
    }
    if (sql.includes('FROM users u') && sql.includes('teacher_profiles')) {
      return rows({ id: values[0] });
    }
    if (sql.includes('SELECT subject FROM class_subjects')) {
      return rows({ subject: subjectNames.get(values[2]) });
    }
    if (sql.includes('FROM teacher_class_assignments') && sql.includes('FOR UPDATE')) return rows();
    if (sql.includes('INSERT INTO teacher_class_assignments')) {
      return rows({ id: `assignment-${values[1]}-${values[5]}` });
    }
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  await service.createAssignment(schoolAdmin, ids.school, {
    classId: ids.class,
    academicYearId: ids.year,
    subjectId: mathSubjectId,
    teacherUserId: '70000000-0000-4000-8000-000000000001',
  });
  await service.createAssignment(schoolAdmin, ids.school, {
    classId: secondClassId,
    academicYearId: ids.year,
    subjectId: scienceSubjectId,
    teacherUserId: '70000000-0000-4000-8000-000000000001',
  });

  const inserts = pool.calls.filter(({ sql }) => /INSERT INTO teacher_class_assignments/.test(sql));
  assert.equal(inserts.length, 2);
  assert.deepEqual(inserts.map(({ values }) => [values[1], values[5]]), [
    [ids.class, mathSubjectId],
    [secondClassId, scienceSubjectId],
  ]);
});

test('changing a teacher assignment revokes the old row and retains history', async () => {
  const assignmentId = '80000000-0000-4000-8000-000000000001';
  const oldTeacherId = '70000000-0000-4000-8000-000000000001';
  const newTeacherId = '70000000-0000-4000-8000-000000000002';
  const subjectId = '60000000-0000-4000-8000-000000000001';
  const pool = createPool(async (sql, values) => {
    if (sql.includes('FROM schools')) return rows({ id: ids.school });
    if (sql.includes('FROM teacher_class_assignments tca') && sql.includes('FOR UPDATE OF tca, c, ay')) {
      return rows({
        id: assignmentId,
        class_id: ids.class,
        teacher_user_id: oldTeacherId,
        subject: 'Toán',
        school_subject_id: subjectId,
        year_status: 'active',
      });
    }
    if (sql.includes('FROM users u') && sql.includes('teacher_profiles')) return rows({ id: values[0] });
    if (sql.includes('UPDATE teacher_class_assignments SET revoked_at')) return rows();
    if (sql.includes('INSERT INTO teacher_class_assignments')) {
      return rows({ id: 'replacement-assignment', teacher_user_id: values[2] });
    }
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  const result = await service.updateAssignment(schoolAdmin, ids.school, assignmentId, newTeacherId);

  assert.equal(result.id, 'replacement-assignment');
  const revokeIndex = pool.calls.findIndex(({ sql }) => /UPDATE teacher_class_assignments SET revoked_at/.test(sql));
  const insertIndex = pool.calls.findIndex(({ sql }) => /INSERT INTO teacher_class_assignments/.test(sql));
  assert.ok(revokeIndex >= 0 && insertIndex > revokeIndex);
  assert.deepEqual(pool.calls[revokeIndex].values, [assignmentId]);
  assert.equal(pool.calls.some(({ sql }) => /DELETE FROM teacher_class_assignments/.test(sql)), false);
  assert.equal(pool.calls.at(-1).sql, 'COMMIT');
});

test('ending a teacher assignment marks it revoked without deleting its history', async () => {
  const assignmentId = '80000000-0000-4000-8000-000000000002';
  const pool = createPool(async (sql) => {
    if (sql.includes('FROM schools')) return rows({ id: ids.school });
    if (sql.includes('FROM teacher_class_assignments tca') && sql.includes('FOR UPDATE OF tca, c, ay')) {
      return rows({ id: assignmentId });
    }
    if (sql.includes('UPDATE teacher_class_assignments') && sql.includes('RETURNING id, revoked_at')) {
      return rows({ id: assignmentId, revoked_at: '2026-11-09T10:00:00Z' });
    }
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  const result = await service.revokeAssignment(schoolAdmin, ids.school, assignmentId);

  assert.equal(result.id, assignmentId);
  assert.ok(pool.calls.some(({ sql }) => /SET revoked_at = now\(\)/.test(sql)));
  assert.equal(pool.calls.some(({ sql }) => /DELETE FROM teacher_class_assignments/.test(sql)), false);
  assert.equal(pool.calls.at(-1).sql, 'COMMIT');
});

test('changing a homeroom teacher ends the previous assignment before inserting history', async () => {
  const pool = createPool(async (sql, values) => {
    if (sql.includes('FROM schools')) return rows({ id: ids.school });
    if (sql.includes('FROM classes c') && sql.includes('FOR UPDATE OF c, ay')) return rows({ id: ids.class });
    if (sql.includes('FROM users u') && sql.includes('teacher_profiles')) {
      return rows({ id: '70000000-0000-4000-8000-000000000002' });
    }
    if (sql.includes('FROM class_homeroom_assignments') && sql.includes('FOR UPDATE')) {
      return rows({ id: 'previous-homeroom', teacher_user_id: '70000000-0000-4000-8000-000000000001' });
    }
    if (sql.includes('INSERT INTO class_homeroom_assignments')) {
      assert.equal(values[4], 'Sinh hoạt');
      return rows({ id: 'new-homeroom', teacher_user_id: values[3] });
    }
    return rows();
  });
  const service = createAdminSchoolService(() => pool);

  await service.setHomeroomTeacher(
    schoolAdmin,
    ids.school,
    ids.class,
    '70000000-0000-4000-8000-000000000002',
  );

  const endPrevious = pool.calls.findIndex(({ sql }) => /UPDATE class_homeroom_assignments/.test(sql));
  const insertNew = pool.calls.findIndex(({ sql }) => /INSERT INTO class_homeroom_assignments/.test(sql));
  assert.ok(endPrevious >= 0 && insertNew > endPrevious);
  assert.match(pool.calls[endPrevious].sql, /ended_at = now\(\)/);
  assert.equal(pool.calls.at(-1).sql, 'COMMIT');
});

test('school-admin router rejects students and teachers before invoking admin services', async (t) => {
  const { createAdminSchoolRouter } = require('../routes/adminSchool.routes');
  const express = require('express');
  const serverApp = express();
  let serviceCalls = 0;
  const router = createAdminSchoolRouter({
    service: {
      async listSchools() {
        serviceCalls += 1;
        return [{ id: ids.school, name: 'School' }];
      },
    },
    authenticate(req, _res, next) {
      req.auth = {
        userId: ids.admin,
        role: req.get('x-test-role') ?? 'admin',
        adminScope: 'system',
        schoolIds: [],
        isDemo: false,
        mustChangePassword: false,
        profileComplete: true,
      };
      next();
    },
  });
  serverApp.use('/api/admin', router);
  serverApp.use((error, _req, res, _next) => {
    res.status(error.status ?? 500).json({ code: error.code });
  });
  const server = serverApp.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/schools`;

  for (const role of ['student', 'lecturer']) {
    const response = await fetch(url, { headers: { 'x-test-role': role } });
    assert.equal(response.status, 403);
  }
  const adminResponse = await fetch(url);
  assert.equal(adminResponse.status, 200);
  assert.equal(serviceCalls, 1);
});
