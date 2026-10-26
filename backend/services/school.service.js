const { getPool } = require('../db/pool');
const { randomUUID } = require('node:crypto');

const RESOURCE_FILE_TYPES = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['gif', 'image/gif'],
  ['webp', 'image/webp'],
  ['pdf', 'application/pdf'],
  ['ppt', 'application/vnd.ms-powerpoint'],
  ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['doc', 'application/msword'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['xls', 'application/vnd.ms-excel'],
  ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['mp4', 'video/mp4'],
]);

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
      GROUP BY u.id, u.full_name, u.email, sp.grade, sp.student_number
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

function validatePeriod(academicYear, semester, subject) {
  if (typeof academicYear !== 'string' || academicYear.trim().length < 4 || academicYear.length > 20) {
    throw serviceError(400, 'SCHOOL_INVALID_PERIOD', 'Năm học không hợp lệ.');
  }
  if (!['Kỳ 1', 'Kỳ 2'].includes(semester)) {
    throw serviceError(400, 'SCHOOL_INVALID_PERIOD', 'Học kỳ không hợp lệ.');
  }
  if (typeof subject !== 'string' || subject.trim().length === 0 || subject.length > 120) {
    throw serviceError(400, 'SCHOOL_INVALID_SUBJECT', 'Môn học không hợp lệ.');
  }
}

async function requireTeacherSubject(auth, classId, subject) {
  if (auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ giáo viên được phép quản lý điểm và bài tập của lớp.');
  }
  const classroom = await findAccessibleClass(auth, classId);
  if (!classroom) {
    throw serviceError(404, 'SCHOOL_CLASS_NOT_FOUND', 'Không tìm thấy lớp trong phạm vi truy cập.');
  }
  const assignment = await getPool().query(
    `SELECT 1
       FROM teacher_class_assignments
      WHERE class_id = $1 AND teacher_user_id = $2 AND school_id = $3
        AND lower(trim(subject)) = lower(trim($4)) AND revoked_at IS NULL`,
    [classroom.id, auth.userId, classroom.school_id, subject],
  );
  if (assignment.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_SUBJECT_NOT_FOUND', 'Không tìm thấy môn học trong phạm vi phân công.');
  }
  return classroom;
}

function validateClassAcademicYear(classroom, academicYear) {
  if (classroom.academic_year !== academicYear) {
    throw serviceError(400, 'SCHOOL_INVALID_PERIOD', 'Năm học không khớp với năm học của lớp.');
  }
}

async function listTeacherClassSubjects(auth, classId) {
  if (auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ giáo viên được xem môn học được phân công.');
  }
  const classroom = await findAccessibleClass(auth, classId);
  if (!classroom) {
    throw serviceError(404, 'SCHOOL_CLASS_NOT_FOUND', 'Không tìm thấy lớp trong phạm vi truy cập.');
  }
  const result = await getPool().query(
    `SELECT DISTINCT trim(subject) AS subject
       FROM teacher_class_assignments
      WHERE class_id = $1 AND teacher_user_id = $2 AND revoked_at IS NULL
      ORDER BY subject`,
    [classroom.id, auth.userId],
  );
  return result.rows.map(({ subject }) => subject);
}

function getPreviousPeriod(academicYear, semester) {
  if (semester === 'Kỳ 2') return { academicYear, semester: 'Kỳ 1' };
  const match = /^(\d{4})-(\d{4})$/.exec(academicYear);
  if (!match) return null;
  return {
    academicYear: `${Number(match[1]) - 1}-${Number(match[2]) - 1}`,
    semester: 'Kỳ 2',
  };
}

function mapGrade(row, prefix) {
  const score = (field) => row[`${prefix}${field}`] === null || row[`${prefix}${field}`] === undefined
    ? null
    : Number(row[`${prefix}${field}`]);
  return {
    regular: [1, 2, 3, 4].map((index) => score(`regular_${index}`)),
    midterm: score('midterm'),
    final: score('final'),
  };
}

async function getClassGradebook(auth, classId, { academicYear, semester, subject }) {
  validatePeriod(academicYear, semester, subject);
  const classroom = await requireTeacherSubject(auth, classId, subject);
  validateClassAcademicYear(classroom, academicYear);
  const previous = getPreviousPeriod(academicYear, semester);
  const result = await getPool().query(
    `SELECT u.id, u.full_name, u.email, sp.grade, sp.student_number,
            g.regular_1, g.regular_2, g.regular_3, g.regular_4, g.midterm, g.final,
            pg.regular_1 AS previous_regular_1, pg.regular_2 AS previous_regular_2,
            pg.regular_3 AS previous_regular_3, pg.regular_4 AS previous_regular_4,
            pg.midterm AS previous_midterm, pg.final AS previous_final,
            assignment_stats.total_assignments, assignment_stats.submitted_assignments,
            assignment_stats.overdue_missing
       FROM class_memberships cm
       JOIN users u ON u.id = cm.student_user_id AND u.status = 'active'
       JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN student_term_grades g
         ON g.class_id = cm.class_id AND g.student_user_id = cm.student_user_id
        AND g.subject = $2 AND g.academic_year = $3 AND g.semester = $4
       LEFT JOIN student_term_grades pg
         ON pg.class_id = cm.class_id AND pg.student_user_id = cm.student_user_id
        AND pg.subject = $2 AND pg.academic_year = $5 AND pg.semester = $6
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS total_assignments,
                count(s.id)::int AS submitted_assignments,
                count(*) FILTER (WHERE a.due_at < now() AND s.id IS NULL)::int AS overdue_missing
           FROM class_assignments a
           LEFT JOIN class_assignment_submissions s
             ON s.assignment_id = a.id AND s.student_user_id = cm.student_user_id
          WHERE a.class_id = cm.class_id AND a.subject = $2
            AND a.academic_year = $3 AND a.semester = $4
       ) assignment_stats ON true
      WHERE cm.class_id = $1 AND cm.status = 'active'
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = cm.class_id AND tca.teacher_user_id = $7
             AND tca.school_id = $8 AND lower(trim(tca.subject)) = lower(trim($2))
             AND tca.revoked_at IS NULL
        )
      ORDER BY u.full_name, u.email`,
    [
      classroom.id,
      subject.trim(),
      academicYear,
      semester,
      previous?.academicYear ?? null,
      previous?.semester ?? null,
      auth.userId,
      classroom.school_id,
    ],
  );

  return result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    grade: row.grade,
    studentNumber: row.student_number,
    grades: mapGrade(row, ''),
    previousGrades: mapGrade(row, 'previous_'),
    assignments: {
      total: row.total_assignments,
      submitted: row.submitted_assignments,
      overdueMissing: row.overdue_missing,
    },
  }));
}

function validateScore(value, field) {
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10)) {
    throw serviceError(400, 'SCHOOL_INVALID_GRADE', `${field} phải nằm trong khoảng từ 0 đến 10 hoặc để trống.`);
  }
}

async function saveStudentGrades(auth, classId, studentId, input) {
  const { academicYear, semester, subject, regular, midterm, final } = input;
  validatePeriod(academicYear, semester, subject);
  if (!Array.isArray(regular) || regular.length !== 4) {
    throw serviceError(400, 'SCHOOL_INVALID_GRADE', 'Cần cung cấp đúng 4 điểm thường xuyên.');
  }
  regular.forEach((value, index) => validateScore(value, `Điểm thường xuyên ${index + 1}`));
  validateScore(midterm, 'Điểm giữa kỳ');
  validateScore(final, 'Điểm cuối kỳ');
  const classroom = await requireTeacherSubject(auth, classId, subject);
  validateClassAcademicYear(classroom, academicYear);
  const result = await getPool().query(
    `INSERT INTO student_term_grades
       (id, class_id, school_id, student_user_id, subject, academic_year, semester,
        regular_1, regular_2, regular_3, regular_4, midterm, final, created_by, updated_by)
     SELECT $1, $2, $3, cm.student_user_id, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13
       FROM class_memberships cm
      WHERE cm.class_id = $2 AND cm.student_user_id = $14 AND cm.status = 'active'
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = cm.class_id AND tca.teacher_user_id = $13
             AND tca.school_id = $3 AND lower(trim(tca.subject)) = lower(trim($4))
             AND tca.revoked_at IS NULL
        )
     ON CONFLICT (class_id, student_user_id, subject, academic_year, semester)
     DO UPDATE SET regular_1 = EXCLUDED.regular_1, regular_2 = EXCLUDED.regular_2,
                   regular_3 = EXCLUDED.regular_3, regular_4 = EXCLUDED.regular_4,
                   midterm = EXCLUDED.midterm, final = EXCLUDED.final,
                   updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING id`,
    [
      randomUUID(), classroom.id, classroom.school_id, subject.trim(), academicYear, semester,
      ...regular, midterm, final, auth.userId, studentId,
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_STUDENT_NOT_FOUND', 'Không tìm thấy học sinh đang theo học lớp này.');
  }
}

async function listClassAssignments(auth, classId, { academicYear, semester, subject }) {
  validatePeriod(academicYear, semester, subject);
  const classroom = await requireTeacherSubject(auth, classId, subject);
  validateClassAcademicYear(classroom, academicYear);
  const result = await getPool().query(
    `SELECT a.id, a.title, a.description, a.subject, a.academic_year, a.semester,
            a.chapter, a.lesson, a.period, a.due_at, a.created_at,
            count(DISTINCT cm.student_user_id)::int AS student_count,
            count(DISTINCT s.student_user_id)::int AS submitted_count,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', u.id,
                  'fullName', u.full_name,
                  'submittedAt', s.submitted_at,
                  'gradedAt', s.graded_at
                )
                ORDER BY u.full_name, u.id
              ) FILTER (WHERE cm.student_user_id IS NOT NULL),
              '[]'::jsonb
            ) AS students
       FROM class_assignments a
       LEFT JOIN class_memberships cm
         ON cm.class_id = a.class_id AND cm.status = 'active'
       LEFT JOIN users u ON u.id = cm.student_user_id
       LEFT JOIN class_assignment_submissions s
         ON s.assignment_id = a.id AND s.student_user_id = cm.student_user_id
      WHERE a.class_id = $1 AND a.teacher_user_id = $2
        AND a.academic_year = $3 AND a.semester = $4 AND a.subject = $5
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = a.class_id AND tca.teacher_user_id = a.teacher_user_id
             AND tca.school_id = a.school_id AND lower(trim(tca.subject)) = lower(trim(a.subject))
             AND tca.revoked_at IS NULL
        )
      GROUP BY a.id
      ORDER BY a.due_at, a.created_at`,
    [classroom.id, auth.userId, academicYear, semester, subject.trim()],
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    academicYear: row.academic_year,
    semester: row.semester,
    chapter: row.chapter,
    lesson: row.lesson,
    period: row.period,
    dueAt: row.due_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    studentCount: row.student_count,
    submittedCount: row.submitted_count,
    students: row.students,
  }));
}

async function findTeacherAssignment(auth, classId, assignmentId) {
  const assignmentResult = await getPool().query(
    `SELECT subject, academic_year
       FROM class_assignments
      WHERE id = $1 AND class_id = $2 AND teacher_user_id = $3`,
    [assignmentId, classId, auth.userId],
  );
  if (assignmentResult.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_ASSIGNMENT_NOT_FOUND', 'Không tìm thấy bài tập trong phạm vi lớp học.');
  }
  const assignment = assignmentResult.rows[0];
  const classroom = await requireTeacherSubject(auth, classId, assignment.subject);
  validateClassAcademicYear(classroom, assignment.academic_year);
  return assignment;
}

async function listClassAssignmentSubmissions(auth, classId, assignmentId) {
  await findTeacherAssignment(auth, classId, assignmentId);
  const students = await listClassStudents(auth, classId);
  const result = await getPool().query(
    `SELECT u.id, u.full_name, s.response_text, s.submitted_at,
            s.score, s.teacher_feedback, s.graded_at
       FROM class_memberships cm
       JOIN users u ON u.id = cm.student_user_id AND u.status = 'active'
       LEFT JOIN class_assignment_submissions s
         ON s.assignment_id = $2 AND s.student_user_id = cm.student_user_id
      WHERE cm.class_id = $1 AND cm.status = 'active'
      ORDER BY u.full_name, u.id`,
    [classId, assignmentId],
  );
  const studentIds = new Set(students.map((student) => student.id));
  return {
    assignmentId,
    submissions: result.rows
      .filter((row) => studentIds.has(row.id))
      .map((row) => ({
        studentId: row.id,
        studentName: row.full_name,
        responseText: row.response_text,
        submittedAt: row.submitted_at?.toISOString() ?? null,
        score: row.score === null ? null : Number(row.score),
        teacherFeedback: row.teacher_feedback ?? '',
        gradedAt: row.graded_at?.toISOString() ?? null,
      })),
  };
}

async function saveClassAssignmentGrade(auth, classId, assignmentId, studentId, input) {
  const score = input.score;
  const teacherFeedback = input.teacherFeedback;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 10) {
    throw serviceError(400, 'SCHOOL_INVALID_GRADE', 'Điểm phải là số từ 0 đến 10.');
  }
  if (typeof teacherFeedback !== 'string' || teacherFeedback.length > 5000) {
    throw serviceError(400, 'SCHOOL_INVALID_FEEDBACK', 'Nhận xét không được vượt quá 5.000 ký tự.');
  }
  await findTeacherAssignment(auth, classId, assignmentId);
  const result = await getPool().query(
    `UPDATE class_assignment_submissions s
        SET score = $4, teacher_feedback = $5, graded_by = $6, graded_at = now(), updated_at = now()
       FROM class_assignments a
      WHERE s.assignment_id = a.id AND s.class_id = a.class_id
        AND a.id = $1 AND a.class_id = $2 AND a.teacher_user_id = $6
        AND s.student_user_id = $3
        AND EXISTS (
          SELECT 1 FROM class_memberships cm
           WHERE cm.class_id = a.class_id AND cm.student_user_id = s.student_user_id
             AND cm.status = 'active'
        )
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = a.class_id AND tca.teacher_user_id = a.teacher_user_id
             AND tca.school_id = a.school_id
             AND lower(trim(tca.subject)) = lower(trim(a.subject))
             AND tca.revoked_at IS NULL
        )
     RETURNING s.score, s.teacher_feedback, s.graded_at`,
    [assignmentId, classId, studentId, score, teacherFeedback.trim(), auth.userId],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_SUBMISSION_NOT_FOUND', 'Không tìm thấy bài nộp của học sinh đang theo học lớp này.');
  }
  const row = result.rows[0];
  return {
    score: Number(row.score),
    teacherFeedback: row.teacher_feedback,
    gradedAt: row.graded_at.toISOString(),
  };
}

async function createClassAssignment(auth, classId, input) {
  const {
    academicYear, semester, subject, chapter = '', lesson = '', period = null, title, description, dueAt,
  } = input;
  validatePeriod(academicYear, semester, subject);
  if (typeof title !== 'string' || title.trim().length === 0 || title.trim().length > 200) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSIGNMENT', 'Tên bài tập phải có từ 1 đến 200 ký tự.');
  }
  if (typeof description !== 'string' || description.length > 5000) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSIGNMENT', 'Mô tả bài tập không hợp lệ.');
  }
  if (typeof dueAt !== 'string' || !Number.isFinite(Date.parse(dueAt))) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSIGNMENT', 'Hạn nộp bài tập không hợp lệ.');
  }
  if (typeof chapter !== 'string' || chapter.length > 160
    || typeof lesson !== 'string' || lesson.length > 200
    || (period !== null && (typeof period !== 'string' || period.length > 80))) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSIGNMENT', 'Thông tin chương, bài hoặc tiết không hợp lệ.');
  }
  const classroom = await requireTeacherSubject(auth, classId, subject);
  validateClassAcademicYear(classroom, academicYear);
  const result = await getPool().query(
    `INSERT INTO class_assignments
       (id, class_id, school_id, teacher_user_id, subject, academic_year, semester,
        chapter, lesson, period, title, description, due_at)
     SELECT $1, c.id, c.school_id, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       FROM classes c
      WHERE c.id = $2 AND c.school_id = $3 AND c.status = 'active'
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = c.id AND tca.teacher_user_id = $4
             AND tca.school_id = c.school_id AND lower(trim(tca.subject)) = lower(trim($5))
             AND tca.revoked_at IS NULL
        )
     RETURNING id, title, description, subject, academic_year, semester, chapter, lesson, period, due_at`,
    [
      randomUUID(), classroom.id, classroom.school_id, auth.userId, subject.trim(),
      academicYear, semester, chapter.trim(), lesson.trim(), period?.trim() || null,
      title.trim(), description, new Date(dueAt),
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_SUBJECT_NOT_FOUND', 'Không tìm thấy môn học trong phạm vi phân công.');
  }
  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    academicYear: row.academic_year,
    semester: row.semester,
    chapter: row.chapter,
    lesson: row.lesson,
    period: row.period,
    dueAt: row.due_at.toISOString(),
  };
}

async function listStudentAssignments(auth) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được xem danh sách bài tập cá nhân.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const result = await getPool().query(
    `SELECT a.id, a.title, a.description, a.subject, a.academic_year, a.semester,
            a.chapter, a.lesson, a.period, a.due_at, a.created_at,
            c.id AS class_id, c.name AS class_name, c.code AS class_code,
            teacher.full_name AS teacher_name,
            s.response_text, s.submitted_at, s.score, s.teacher_feedback, s.graded_at
       FROM class_memberships cm
       JOIN classes c ON c.id = cm.class_id AND c.school_id = $2 AND c.status = 'active'
       JOIN schools sc ON sc.id = c.school_id AND sc.status = 'active'
       JOIN class_assignments a ON a.class_id = c.id
       JOIN users teacher ON teacher.id = a.teacher_user_id
       LEFT JOIN class_assignment_submissions s
         ON s.assignment_id = a.id AND s.student_user_id = cm.student_user_id
      WHERE cm.student_user_id = $1 AND cm.status = 'active'
      ORDER BY a.due_at, a.created_at`,
    [auth.userId, schoolId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    academicYear: row.academic_year,
    semester: row.semester,
    chapter: row.chapter,
    lesson: row.lesson,
    period: row.period,
    dueAt: row.due_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    classId: row.class_id,
    className: row.class_name,
    classCode: row.class_code,
    teacherName: row.teacher_name,
    responseText: row.response_text,
    submittedAt: row.submitted_at?.toISOString() ?? null,
    score: row.score === null ? null : Number(row.score),
    teacherFeedback: row.teacher_feedback ?? '',
    gradedAt: row.graded_at?.toISOString() ?? null,
  }));
}

function validateLearningResource(input) {
  const { academicYear, semester, subject, chapter, lesson, period, title, content, note = '' } = input;
  validatePeriod(academicYear, semester, subject);
  if (typeof chapter !== 'string' || chapter.trim().length === 0 || chapter.length > 160
    || typeof lesson !== 'string' || lesson.trim().length === 0 || lesson.length > 200
    || (period !== null && period !== undefined && (typeof period !== 'string' || period.length > 80))
    || typeof title !== 'string' || title.trim().length === 0 || title.length > 200
    || typeof content !== 'string' || content.trim().length === 0 || content.length > 50000
    || typeof note !== 'string' || note.length > 500) {
    throw serviceError(400, 'SCHOOL_INVALID_RESOURCE', 'Thông tin bài giảng không hợp lệ.');
  }
}

async function createClassLearningResource(auth, classId, input) {
  validateLearningResource(input);
  const { academicYear, semester, subject, chapter, lesson, period, title, content, note = '' } = input;
  const classroom = await requireTeacherSubject(auth, classId, subject);
  validateClassAcademicYear(classroom, academicYear);
  const result = await getPool().query(
    `INSERT INTO class_learning_resources
       (id, class_id, school_id, teacher_user_id, subject, academic_year, semester,
        chapter, lesson, period, title, content, note)
     SELECT $1, c.id, c.school_id, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       FROM classes c
      WHERE c.id = $2 AND c.school_id = $3 AND c.status = 'active'
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = c.id AND tca.teacher_user_id = $4
             AND tca.school_id = c.school_id AND lower(trim(tca.subject)) = lower(trim($5))
             AND tca.revoked_at IS NULL
        )
     RETURNING id, class_id, subject, academic_year, semester, chapter, lesson, period,
               title, content, note, created_at`,
    [
      randomUUID(), classroom.id, classroom.school_id, auth.userId, subject.trim(), academicYear,
      semester, chapter.trim(), lesson.trim(), period?.trim() || null, title.trim(), content.trim(), note.trim(),
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_SUBJECT_NOT_FOUND', 'Không tìm thấy môn học trong phạm vi phân công.');
  }
  return result.rows[0];
}

async function updateClassLearningResource(auth, classId, resourceId, input, file) {
  const { academicYear, semester, subject, chapter, lesson, period, title, content, note = '', fileName } = input;
  const uploadedFile = file ? validateResourceFile(file) : null;
  validatePeriod(academicYear, semester, subject);
  if (typeof chapter !== 'string' || chapter.trim().length === 0 || chapter.length > 160
    || typeof lesson !== 'string' || lesson.trim().length === 0 || lesson.length > 200
    || (period !== null && period !== undefined && (typeof period !== 'string' || period.length > 80))
    || typeof title !== 'string' || title.trim().length === 0 || title.length > 200
    || typeof content !== 'string' || content.length > 50000
    || typeof note !== 'string' || note.length > 500
    || (fileName !== undefined
      && (typeof fileName !== 'string' || fileName.trim().length === 0 || fileName.trim().length > 255
        || /[\\/\u0000-\u001f\u007f]/.test(fileName)))) {
    throw serviceError(400, 'SCHOOL_INVALID_RESOURCE', 'Thông tin bài giảng không hợp lệ.');
  }
  const classroom = await requireTeacherSubject(auth, classId, subject);
  validateClassAcademicYear(classroom, academicYear);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM class_learning_resource_files WHERE resource_id = r.id
       ) AS has_file
         FROM class_learning_resources r
        WHERE r.id = $1 AND r.class_id = $2 AND r.school_id = $3 AND r.teacher_user_id = $4
        FOR UPDATE`,
      [resourceId, classroom.id, classroom.school_id, auth.userId],
    );
    if (current.rowCount === 0) {
      throw serviceError(404, 'SCHOOL_RESOURCE_NOT_FOUND', 'Không tìm thấy bài giảng trong lớp của bạn.');
    }
    if (!content.trim() && !current.rows[0].has_file && !uploadedFile) {
      throw serviceError(400, 'SCHOOL_INVALID_RESOURCE', 'Bài giảng cần có nội dung hoặc tệp đính kèm.');
    }
    const updated = await client.query(
      `UPDATE class_learning_resources r
          SET subject = $5, academic_year = $6, semester = $7, chapter = $8, lesson = $9,
              period = $10, title = $11, content = $12, note = $13
        WHERE r.id = $1 AND r.class_id = $2 AND r.school_id = $3 AND r.teacher_user_id = $4
          AND EXISTS (
            SELECT 1 FROM teacher_class_assignments tca
             WHERE tca.class_id = r.class_id AND tca.teacher_user_id = r.teacher_user_id
               AND tca.school_id = r.school_id AND lower(trim(tca.subject)) = lower(trim($5))
               AND tca.revoked_at IS NULL
          )
       RETURNING r.id, r.class_id, r.subject, r.academic_year, r.semester, r.chapter,
                 r.lesson, r.period, r.title, r.content, r.note, r.created_at`,
      [
        resourceId, classroom.id, classroom.school_id, auth.userId, subject.trim(), academicYear,
        semester, chapter.trim(), lesson.trim(), period?.trim() || null, title.trim(), content.trim(), note.trim(),
      ],
    );
    if (updated.rowCount === 0) {
      throw serviceError(404, 'SCHOOL_RESOURCE_NOT_FOUND', 'Không tìm thấy bài giảng trong lớp của bạn.');
    }
    if (uploadedFile && current.rows[0].has_file) {
      await client.query(
        `UPDATE class_learning_resource_files
            SET original_name = $2, media_type = $3, size_bytes = $4, content = $5
          WHERE resource_id = $1`,
        [
          resourceId, fileName?.trim() || uploadedFile.originalName, uploadedFile.mediaType,
          file.buffer.length, file.buffer,
        ],
      );
    } else if (uploadedFile) {
      await client.query(
        `INSERT INTO class_learning_resource_files
           (id, resource_id, original_name, media_type, size_bytes, content)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(), resourceId, fileName?.trim() || uploadedFile.originalName, uploadedFile.mediaType,
          file.buffer.length, file.buffer,
        ],
      );
    } else if (fileName !== undefined) {
      await client.query(
        'UPDATE class_learning_resource_files SET original_name = $2 WHERE resource_id = $1',
        [resourceId, fileName.trim()],
      );
    }
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function validateResourceChapterScope(input, chapter) {
  const { academicYear, semester, subject } = input;
  validatePeriod(academicYear, semester, subject);
  if (typeof chapter !== 'string' || chapter.trim().length === 0 || chapter.trim().length > 160) {
    throw serviceError(400, 'SCHOOL_INVALID_CHAPTER', 'Tên chương không hợp lệ.');
  }
  return { academicYear, semester, subject: subject.trim(), chapter: chapter.trim() };
}

async function renameClassLearningResourceChapter(auth, classId, currentChapter, input) {
  const scope = validateResourceChapterScope(input, currentChapter);
  const nextChapter = input.newChapter;
  if (typeof nextChapter !== 'string' || nextChapter.trim().length === 0 || nextChapter.trim().length > 160) {
    throw serviceError(400, 'SCHOOL_INVALID_CHAPTER', 'Tên chương mới không hợp lệ.');
  }
  const classroom = await requireTeacherSubject(auth, classId, scope.subject);
  validateClassAcademicYear(classroom, scope.academicYear);
  const result = await getPool().query(
    `UPDATE class_learning_resources r
        SET chapter = $8
      WHERE r.class_id = $1 AND r.school_id = $2 AND r.teacher_user_id = $3
        AND lower(trim(r.subject)) = lower(trim($4))
        AND r.academic_year = $5 AND r.semester = $6 AND r.chapter = $7
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = r.class_id AND tca.teacher_user_id = r.teacher_user_id
             AND tca.school_id = r.school_id
             AND lower(trim(tca.subject)) = lower(trim(r.subject))
             AND tca.revoked_at IS NULL
        )
     RETURNING r.id`,
    [
      classroom.id, classroom.school_id, auth.userId, scope.subject, scope.academicYear,
      scope.semester, scope.chapter, nextChapter.trim(),
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_RESOURCE_CHAPTER_NOT_FOUND', 'Không tìm thấy chương trong phạm vi lớp học.');
  }
  return { updatedCount: result.rowCount, chapter: nextChapter.trim() };
}

async function deleteClassLearningResourceChapter(auth, classId, chapter, input) {
  const scope = validateResourceChapterScope(input, chapter);
  const classroom = await requireTeacherSubject(auth, classId, scope.subject);
  validateClassAcademicYear(classroom, scope.academicYear);
  const result = await getPool().query(
    `DELETE FROM class_learning_resources r
      WHERE r.class_id = $1 AND r.school_id = $2 AND r.teacher_user_id = $3
        AND lower(trim(r.subject)) = lower(trim($4))
        AND r.academic_year = $5 AND r.semester = $6 AND r.chapter = $7
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = r.class_id AND tca.teacher_user_id = r.teacher_user_id
             AND tca.school_id = r.school_id
             AND lower(trim(tca.subject)) = lower(trim(r.subject))
             AND tca.revoked_at IS NULL
        )
     RETURNING r.id`,
    [
      classroom.id, classroom.school_id, auth.userId, scope.subject, scope.academicYear,
      scope.semester, scope.chapter,
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_RESOURCE_CHAPTER_NOT_FOUND', 'Không tìm thấy chương trong phạm vi lớp học.');
  }
  return { deletedCount: result.rowCount };
}

function validateResourceFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0 || file.buffer.length > 50 * 1024 * 1024) {
    throw serviceError(400, 'SCHOOL_INVALID_RESOURCE_FILE', 'Tệp trống hoặc vượt quá giới hạn 50 MB.');
  }
  const originalName = typeof file.originalname === 'string' ? file.originalname.trim() : '';
  if (!originalName || originalName.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(originalName)) {
    throw serviceError(400, 'SCHOOL_INVALID_RESOURCE_FILE', 'Tên tệp không hợp lệ.');
  }
  const extension = originalName.split('.').pop()?.toLowerCase() ?? '';
  const mediaType = RESOURCE_FILE_TYPES.get(extension);
  if (!mediaType) {
    throw serviceError(400, 'SCHOOL_INVALID_RESOURCE_FILE', 'Định dạng tệp không được hỗ trợ.');
  }
  if (mediaType === 'image/jpeg' && !(file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff)) {
    throw serviceError(400, 'SCHOOL_INVALID_RESOURCE_FILE', 'Nội dung tệp không đúng định dạng ảnh JPEG.');
  }
  if (mediaType === 'image/png'
    && !file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw serviceError(400, 'SCHOOL_INVALID_RESOURCE_FILE', 'Nội dung tệp không đúng định dạng ảnh PNG.');
  }
  if (mediaType === 'image/gif'
    && !['GIF87a', 'GIF89a'].includes(file.buffer.subarray(0, 6).toString('ascii'))) {
    throw serviceError(400, 'SCHOOL_INVALID_RESOURCE_FILE', 'Nội dung tệp không đúng định dạng ảnh GIF.');
  }
  if (mediaType === 'image/webp'
    && (file.buffer.subarray(0, 4).toString('ascii') !== 'RIFF'
      || file.buffer.subarray(8, 12).toString('ascii') !== 'WEBP')) {
    throw serviceError(400, 'SCHOOL_INVALID_RESOURCE_FILE', 'Nội dung tệp không đúng định dạng ảnh WebP.');
  }
  return { originalName, mediaType };
}

async function createClassLearningResourceFile(auth, classId, input, file) {
  const { originalName, mediaType } = validateResourceFile(file);
  const { academicYear, semester, subject, chapter, lesson, period, title, note = '' } = input;
  validatePeriod(academicYear, semester, subject);
  if (typeof chapter !== 'string' || chapter.trim().length === 0 || chapter.length > 160
    || typeof lesson !== 'string' || lesson.trim().length === 0 || lesson.length > 200
    || (period !== null && period !== undefined && (typeof period !== 'string' || period.length > 80))
    || typeof title !== 'string' || title.trim().length === 0 || title.length > 200
    || typeof note !== 'string' || note.length > 500) {
    throw serviceError(400, 'SCHOOL_INVALID_RESOURCE', 'Thông tin bài giảng hoặc tệp đính kèm không hợp lệ.');
  }
  const classroom = await requireTeacherSubject(auth, classId, subject);
  validateClassAcademicYear(classroom, academicYear);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const resourceId = randomUUID();
    const insertedResource = await client.query(
      `INSERT INTO class_learning_resources
         (id, class_id, school_id, teacher_user_id, subject, academic_year, semester,
          chapter, lesson, period, title, content, note)
       SELECT $1, c.id, c.school_id, $4, $5, $6, $7, $8, $9, $10, $11, '', $12
         FROM classes c
        WHERE c.id = $2 AND c.school_id = $3 AND c.status = 'active'
          AND EXISTS (
            SELECT 1 FROM teacher_class_assignments tca
             WHERE tca.class_id = c.id AND tca.teacher_user_id = $4
               AND tca.school_id = c.school_id AND lower(trim(tca.subject)) = lower(trim($5))
               AND tca.revoked_at IS NULL
          )
       RETURNING id`,
      [
        resourceId, classroom.id, classroom.school_id, auth.userId, subject.trim(), academicYear,
        semester, chapter.trim(), lesson.trim(), period?.trim() || null, title.trim(), note.trim(),
      ],
    );
    if (insertedResource.rowCount === 0) {
      throw serviceError(404, 'SCHOOL_SUBJECT_NOT_FOUND', 'Không tìm thấy môn học trong phạm vi phân công.');
    }
    const insertedFile = await client.query(
      `INSERT INTO class_learning_resource_files
         (id, resource_id, original_name, media_type, size_bytes, content)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, original_name, media_type, size_bytes`,
      [randomUUID(), resourceId, originalName, mediaType, file.buffer.length, file.buffer],
    );
    await client.query('COMMIT');
    return {
      id: resourceId,
      title: title.trim(),
      file: {
        ...insertedFile.rows[0],
        size_bytes: Number(insertedFile.rows[0].size_bytes),
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listClassLearningResources(auth, classId) {
  if (auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ giáo viên được xem tài liệu đã đăng của lớp.');
  }
  const classroom = await findAccessibleClass(auth, classId);
  if (!classroom) {
    throw serviceError(404, 'SCHOOL_CLASS_NOT_FOUND', 'Không tìm thấy lớp trong phạm vi truy cập.');
  }
  const result = await getPool().query(
    `SELECT r.id, r.class_id, r.subject, r.academic_year, r.semester, r.chapter,
            r.lesson, r.period, r.title, r.content, r.note, r.created_at,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', f.id, 'name', f.original_name, 'mediaType', f.media_type, 'sizeBytes', f.size_bytes
              ))
                FROM class_learning_resource_files f
               WHERE f.resource_id = r.id
            ), '[]'::json) AS files
       FROM class_learning_resources r
      WHERE r.class_id = $1 AND r.teacher_user_id = $2
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = r.class_id AND tca.teacher_user_id = r.teacher_user_id
             AND tca.school_id = r.school_id AND lower(trim(tca.subject)) = lower(trim(r.subject))
             AND tca.revoked_at IS NULL
        )
      ORDER BY r.created_at DESC
      LIMIT 20`,
    [classroom.id, auth.userId],
  );
  return result.rows;
}

async function listStudentLearningResources(auth) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được xem tài liệu lớp học.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const result = await getPool().query(
    `SELECT r.id, r.class_id, c.name AS class_name, c.code AS class_code,
            r.subject, r.academic_year, r.semester, r.chapter, r.lesson, r.period,
            r.title, r.content, r.note, r.created_at,
            teacher.full_name AS teacher_name,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', f.id, 'name', f.original_name, 'mediaType', f.media_type, 'sizeBytes', f.size_bytes
              ))
                FROM class_learning_resource_files f
               WHERE f.resource_id = r.id
            ), '[]'::json) AS files
       FROM class_memberships cm
       JOIN classes c ON c.id = cm.class_id AND c.school_id = $2 AND c.status = 'active'
       JOIN schools sc ON sc.id = c.school_id AND sc.status = 'active'
       JOIN class_learning_resources r ON r.class_id = c.id
       JOIN users teacher ON teacher.id = r.teacher_user_id
      WHERE cm.student_user_id = $1 AND cm.status = 'active'
      ORDER BY r.created_at DESC`,
    [auth.userId, schoolId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    classId: row.class_id,
    className: row.class_name,
    classCode: row.class_code,
    subject: row.subject,
    academicYear: row.academic_year,
    semester: row.semester,
    chapter: row.chapter,
    lesson: row.lesson,
    period: row.period,
    title: row.title,
    content: row.content,
    note: row.note,
    createdAt: row.created_at.toISOString(),
    teacherName: row.teacher_name,
    files: row.files,
  }));
}

async function getClassLearningResourceFile(auth, resourceId, fileId) {
  if (auth.role !== 'student' && auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Vai trò không được phép tải tài liệu này.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, auth.role);
  const result = await getPool().query(
    `SELECT f.original_name, f.media_type, f.size_bytes, f.content
       FROM class_learning_resource_files f
       JOIN class_learning_resources r ON r.id = f.resource_id
       JOIN classes c ON c.id = r.class_id AND c.school_id = r.school_id
       JOIN schools sc ON sc.id = c.school_id AND sc.status = 'active'
      WHERE r.id = $1 AND f.id = $2 AND c.school_id = $3 AND c.status = 'active'
        AND (
          ($4 = 'lecturer' AND r.teacher_user_id = $5 AND EXISTS (
            SELECT 1 FROM teacher_class_assignments tca
             WHERE tca.class_id = c.id AND tca.teacher_user_id = $5
               AND tca.school_id = c.school_id
               AND lower(trim(tca.subject)) = lower(trim(r.subject))
               AND tca.revoked_at IS NULL
          ))
          OR
          ($4 = 'student' AND EXISTS (
            SELECT 1 FROM class_memberships cm
             WHERE cm.class_id = c.id AND cm.student_user_id = $5 AND cm.status = 'active'
          ))
        )`,
    [resourceId, fileId, schoolId, auth.role, auth.userId],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_RESOURCE_FILE_NOT_FOUND', 'Không tìm thấy tệp trong phạm vi lớp học của bạn.');
  }
  const row = result.rows[0];
  return {
    name: row.original_name,
    mediaType: row.media_type,
    sizeBytes: Number(row.size_bytes),
    content: row.content,
  };
}

async function submitClassAssignment(auth, assignmentId, responseText) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được nộp bài tập.');
  }
  if (typeof responseText !== 'string' || responseText.trim().length === 0 || responseText.length > 20000) {
    throw serviceError(400, 'SCHOOL_INVALID_SUBMISSION', 'Câu trả lời phải có từ 1 đến 20.000 ký tự.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const result = await getPool().query(
    `INSERT INTO class_assignment_submissions
       (id, assignment_id, class_id, student_user_id, response_text)
     SELECT $1, a.id, a.class_id, cm.student_user_id, $4
       FROM class_assignments a
       JOIN classes c ON c.id = a.class_id AND c.school_id = $3 AND c.status = 'active'
       JOIN schools sc ON sc.id = c.school_id AND sc.status = 'active'
       JOIN class_memberships cm ON cm.class_id = c.id
        AND cm.student_user_id = $2 AND cm.status = 'active'
      WHERE a.id = $5
     ON CONFLICT (assignment_id, student_user_id)
     DO UPDATE SET response_text = EXCLUDED.response_text, submitted_at = now(), updated_at = now(),
                   score = NULL, teacher_feedback = '', graded_by = NULL, graded_at = NULL
     RETURNING assignment_id, response_text, submitted_at`,
    [randomUUID(), auth.userId, schoolId, responseText.trim(), assignmentId],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_ASSIGNMENT_NOT_FOUND', 'Không tìm thấy bài tập trong lớp của học sinh.');
  }
  return result.rows[0];
}

module.exports = {
  createClassAssignment,
  createClassLearningResource,
  createClassLearningResourceFile,
  deleteClassLearningResourceChapter,
  getClass,
  listClassAssignmentSubmissions,
  getClassLearningResourceFile,
  getClassGradebook,
  listClasses,
  listClassAssignments,
  listClassLearningResources,
  listClassStudents,
  listStudentAssignments,
  listStudentLearningResources,
  listTeacherClassSubjects,
  saveStudentGrades,
  saveClassAssignmentGrade,
  submitClassAssignment,
  updateClassLearningResource,
  renameClassLearningResourceChapter,
};
