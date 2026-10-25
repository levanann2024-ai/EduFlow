const { getPool } = require('../db/pool');

function serviceError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function getSingleActiveSchool(userId, expectedRole) {
  const result = await getPool().query(
    `SELECT u.role, u.status, COUNT(DISTINCT s.id)::int AS active_school_count,
            MIN(s.id::text)::uuid AS school_id
       FROM users u
       LEFT JOIN school_memberships sm
         ON sm.user_id = u.id AND sm.status = 'active'
       LEFT JOIN schools s
         ON s.id = sm.school_id AND s.status = 'active'
      WHERE u.id = $1
      GROUP BY u.id`,
    [userId],
  );
  const user = result.rows[0];
  if (!user || user.status !== 'active') {
    throw serviceError(401, 'SCHOOL_ACCOUNT_INACTIVE', 'Tài khoản không còn hoạt động.');
  }
  if (user.role !== expectedRole) {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Vai trò không được phép truy cập dữ liệu lớp học này.');
  }
  if (user.active_school_count !== 1 || !user.school_id) {
    throw serviceError(
      409,
      'SCHOOL_MEMBERSHIP_INVARIANT_VIOLATION',
      'Tài khoản học sinh/giáo viên phải có đúng một trường đang hoạt động.',
    );
  }
  return user.school_id;
}

function adminSchoolScope(auth, requestedSchoolId) {
  if (auth.adminScope === 'system') {
    return { systemAdmin: true, schoolIds: [], requestedSchoolId: requestedSchoolId || null };
  }
  if (auth.adminScope !== 'school' || auth.schoolIds.length === 0) {
    throw serviceError(403, 'SCHOOL_SCOPE_FORBIDDEN', 'Tài khoản quản trị không có phạm vi trường đang hoạt động.');
  }
  if (requestedSchoolId && !auth.schoolIds.includes(requestedSchoolId)) {
    throw serviceError(404, 'SCHOOL_NOT_FOUND', 'Không tìm thấy trường trong phạm vi truy cập.');
  }
  return {
    systemAdmin: false,
    schoolIds: auth.schoolIds,
    requestedSchoolId: requestedSchoolId || null,
  };
}

async function listClasses(auth, requestedSchoolId) {
  const pool = getPool();
  if (auth.role === 'admin') {
    const scope = adminSchoolScope(auth, requestedSchoolId);
    const result = await pool.query(
      `SELECT c.id, c.school_id, c.code, c.name, c.grade, c.academic_year, c.status,
              s.name AS school_name
         FROM classes c
         JOIN schools s ON s.id = c.school_id
        WHERE c.status = 'active' AND s.status = 'active'
          AND ($1::boolean OR c.school_id = ANY($2::uuid[]))
          AND ($3::uuid IS NULL OR c.school_id = $3::uuid)
        ORDER BY s.name, c.academic_year DESC, c.name`,
      [scope.systemAdmin, scope.schoolIds, scope.requestedSchoolId],
    );
    return result.rows;
  }

  if (auth.role !== 'student' && auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Vai trò không được phép xem danh sách lớp.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, auth.role);
  if (requestedSchoolId && requestedSchoolId !== schoolId) {
    throw serviceError(404, 'SCHOOL_NOT_FOUND', 'Không tìm thấy trường trong phạm vi truy cập.');
  }

  const result = auth.role === 'student'
    ? await pool.query(
      `SELECT c.id, c.school_id, c.code, c.name, c.grade, c.academic_year, c.status,
              s.name AS school_name
         FROM class_memberships cm
         JOIN classes c ON c.id = cm.class_id
         JOIN schools s ON s.id = c.school_id
        WHERE cm.student_user_id = $1 AND cm.status = 'active'
          AND c.school_id = $2 AND c.status = 'active' AND s.status = 'active'
        ORDER BY c.academic_year DESC, c.name`,
      [auth.userId, schoolId],
    )
    : await pool.query(
      `SELECT c.id, c.school_id, c.code, c.name, c.grade, c.academic_year, c.status,
              s.name AS school_name
         FROM teacher_class_assignments tca
         JOIN classes c ON c.id = tca.class_id
         JOIN schools s ON s.id = c.school_id
        WHERE tca.teacher_user_id = $1 AND tca.revoked_at IS NULL
          AND c.school_id = $2 AND c.status = 'active' AND s.status = 'active'
        ORDER BY c.academic_year DESC, c.name`,
      [auth.userId, schoolId],
    );
  return result.rows;
}

async function findAccessibleClass(auth, classId) {
  const pool = getPool();
  if (auth.role === 'admin') {
    const scope = adminSchoolScope(auth);
    const result = await pool.query(
      `SELECT c.id, c.school_id, c.code, c.name, c.grade, c.academic_year, c.status,
              s.name AS school_name
         FROM classes c
         JOIN schools s ON s.id = c.school_id
        WHERE c.id = $1 AND c.status = 'active' AND s.status = 'active'
          AND ($2::boolean OR c.school_id = ANY($3::uuid[]))`,
      [classId, scope.systemAdmin, scope.schoolIds],
    );
    return result.rows[0] ?? null;
  }

  if (auth.role !== 'student' && auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Vai trò không được phép xem lớp học này.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, auth.role);
  const result = auth.role === 'student'
    ? await pool.query(
      `SELECT c.id, c.school_id, c.code, c.name, c.grade, c.academic_year, c.status,
              s.name AS school_name
         FROM class_memberships cm
         JOIN classes c ON c.id = cm.class_id
         JOIN schools s ON s.id = c.school_id
        WHERE c.id = $1 AND cm.student_user_id = $2 AND cm.status = 'active'
          AND c.school_id = $3 AND c.status = 'active' AND s.status = 'active'`,
      [classId, auth.userId, schoolId],
    )
    : await pool.query(
      `SELECT c.id, c.school_id, c.code, c.name, c.grade, c.academic_year, c.status,
              s.name AS school_name
         FROM teacher_class_assignments tca
         JOIN classes c ON c.id = tca.class_id
         JOIN schools s ON s.id = c.school_id
        WHERE c.id = $1 AND tca.teacher_user_id = $2 AND tca.revoked_at IS NULL
          AND c.school_id = $3 AND c.status = 'active' AND s.status = 'active'`,
      [classId, auth.userId, schoolId],
    );
  return result.rows[0] ?? null;
}

async function getClass(auth, classId) {
  const classroom = await findAccessibleClass(auth, classId);
  if (!classroom) {
    throw serviceError(404, 'SCHOOL_CLASS_NOT_FOUND', 'Không tìm thấy lớp trong phạm vi truy cập.');
  }
  return classroom;
}

async function listClassStudents(auth, classId) {
  if (auth.role !== 'admin' && auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Vai trò không được phép xem danh sách học sinh của lớp.');
  }
  const classroom = await findAccessibleClass(auth, classId);
  if (!classroom) {
    throw serviceError(404, 'SCHOOL_CLASS_NOT_FOUND', 'Không tìm thấy lớp trong phạm vi truy cập.');
  }

  const result = await getPool().query(
    `SELECT u.id, u.full_name, u.email, sp.grade, sp.student_number,
            COUNT(DISTINCT active_school.id)::int AS active_school_count,
            MIN(active_school.id::text)::uuid AS active_school_id
       FROM class_memberships cm
       JOIN users u ON u.id = cm.student_user_id
       JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN school_memberships sm
         ON sm.user_id = u.id AND sm.status = 'active'
       LEFT JOIN schools active_school
         ON active_school.id = sm.school_id AND active_school.status = 'active'
      WHERE cm.class_id = $1 AND cm.status = 'active' AND u.status = 'active'
      GROUP BY u.id
      ORDER BY u.full_name, u.email`,
    [classroom.id],
  );
  if (result.rows.some((student) => (
    student.active_school_count !== 1 || student.active_school_id !== classroom.school_id
  ))) {
    throw serviceError(
      409,
      'SCHOOL_MEMBERSHIP_INVARIANT_VIOLATION',
      'Có học sinh trong lớp không thuộc đúng một trường đang hoạt động.',
    );
  }
  return result.rows.map(({ id, full_name, email, grade, student_number }) => ({
    id,
    fullName: full_name,
    email,
    grade,
    studentNumber: student_number,
  }));
}

module.exports = { getClass, listClasses, listClassStudents };
