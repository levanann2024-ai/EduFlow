const crypto = require('node:crypto');
const { getPool } = require('../db/pool');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const YEAR_STATUSES = new Set(['planned', 'active', 'closed', 'legacy']);
const HOMEROOM_SUBJECT = 'Sinh hoạt';

function serviceError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function requireUuid(value, field) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw serviceError(400, 'ADMIN_INVALID_INPUT', `${field} không hợp lệ.`);
  }
  return value;
}

function requireText(value, field, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) {
    throw serviceError(400, 'ADMIN_INVALID_INPUT', `${field} là bắt buộc và không được vượt quá ${maxLength} ký tự.`);
  }
  return text;
}

function requireDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw serviceError(400, 'ADMIN_INVALID_INPUT', `${field} phải có định dạng YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw serviceError(400, 'ADMIN_INVALID_INPUT', `${field} không phải ngày hợp lệ.`);
  }
  return value;
}

function optionalUuid(value, field) {
  return value === undefined || value === null || value === '' ? null : requireUuid(value, field);
}

function normalizeDatabaseError(error) {
  if (error?.code === '23505') {
    return serviceError(409, 'ADMIN_DUPLICATE', 'Dữ liệu bị trùng với bản ghi hiện có.');
  }
  if (error?.code === '23503') {
    return serviceError(409, 'ADMIN_RELATED_DATA', 'Không thể thực hiện do dữ liệu liên quan đã thay đổi.');
  }
  return error;
}

async function transaction(pool, operation) {
  const client = await pool.connect();
  let began = false;
  try {
    await client.query('BEGIN');
    began = true;
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (began) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        rollbackError.cause = error;
        throw rollbackError;
      }
    }
    throw normalizeDatabaseError(error);
  } finally {
    client.release();
  }
}

async function resolveSchoolId(queryable, auth, schoolId) {
  if (!auth || auth.role !== 'admin' || !['school', 'system'].includes(auth.adminScope)) {
    throw serviceError(403, 'ADMIN_FORBIDDEN', 'Bạn không có quyền quản lý dữ liệu trường học.');
  }
  const id = requireUuid(schoolId, 'Trường học');
  if (auth.adminScope === 'school' && !auth.schoolIds?.includes(id)) {
    throw serviceError(404, 'ADMIN_SCHOOL_NOT_FOUND', 'Không tìm thấy trường học.');
  }
  const result = await queryable.query(
    `SELECT id FROM schools WHERE id = $1 AND status = 'active'`,
    [id],
  );
  if (!result.rows[0]) {
    throw serviceError(404, 'ADMIN_SCHOOL_NOT_FOUND', 'Không tìm thấy trường học.');
  }
  return id;
}

async function requireYear(queryable, schoolId, yearId, { allowClosed = false, lock = false } = {}) {
  const id = requireUuid(yearId, 'Năm học');
  const result = await queryable.query(
    `SELECT id, name, status, is_current
       FROM academic_years
      WHERE id = $1 AND school_id = $2${lock ? ' FOR UPDATE' : ''}`,
    [id, schoolId],
  );
  const year = result.rows[0];
  if (!year) throw serviceError(404, 'ADMIN_YEAR_NOT_FOUND', 'Không tìm thấy năm học.');
  if (!allowClosed && year.status === 'closed') {
    throw serviceError(409, 'ADMIN_YEAR_CLOSED', 'Không thể thay đổi dữ liệu của năm học đã đóng.');
  }
  return year;
}

function createAdminSchoolService(poolProvider = getPool) {
  async function listSchools(auth) {
    if (!auth || auth.role !== 'admin' || !['school', 'system'].includes(auth.adminScope)) {
      throw serviceError(403, 'ADMIN_FORBIDDEN', 'Bạn không có quyền quản lý dữ liệu trường học.');
    }
    const result = auth.adminScope === 'school'
      ? await poolProvider().query(
        `SELECT id, name FROM schools
          WHERE status = 'active' AND id = ANY($1::uuid[])
          ORDER BY name`,
        [auth.schoolIds ?? []],
      )
      : await poolProvider().query(
        `SELECT id, name FROM schools WHERE status = 'active' ORDER BY name`,
      );
    return result.rows;
  }

  async function getOverview(auth, requestedSchoolId) {
    const pool = poolProvider();
    const schoolId = await resolveSchoolId(pool, auth, requestedSchoolId);
    const result = await pool.query(
      `WITH current_year AS (
         SELECT id, name
           FROM academic_years
          WHERE school_id = $1 AND is_current
       ),
       counts AS (
         SELECT
           (SELECT count(*)::int
              FROM school_memberships sm
              JOIN users u ON u.id = sm.user_id
             WHERE sm.school_id = $1 AND sm.status = 'active'
               AND u.role = 'student' AND u.status = 'active') AS student_count,
           (SELECT count(*)::int
              FROM school_memberships sm
              JOIN users u ON u.id = sm.user_id
             WHERE sm.school_id = $1 AND sm.status = 'active'
               AND u.role = 'lecturer' AND u.status = 'active') AS teacher_count,
           (SELECT count(*)::int
              FROM classes c
             WHERE c.school_id = $1 AND c.status = 'active'
               AND (NOT EXISTS (SELECT 1 FROM current_year)
                 OR c.academic_year_id = (SELECT id FROM current_year))) AS class_count,
           (SELECT count(*)::int FROM school_subjects ss WHERE ss.school_id = $1) AS subject_count
       )
       SELECT current_year.id AS current_year_id,
              current_year.name AS current_year_name,
              counts.student_count, counts.teacher_count, counts.class_count, counts.subject_count
         FROM counts LEFT JOIN current_year ON true`,
      [schoolId],
    );
    const missing = await pool.query(
      `SELECT c.id AS class_id, c.name AS class_name,
              missing_kind.kind,
              missing_kind.subject_id,
              missing_kind.subject_name
         FROM classes c
         JOIN academic_years ay ON ay.id = c.academic_year_id AND ay.is_current
         CROSS JOIN LATERAL (
           SELECT 'homeroom'::text AS kind, NULL::uuid AS subject_id, NULL::text AS subject_name
            WHERE NOT EXISTS (
              SELECT 1 FROM class_homeroom_assignments hra
               WHERE hra.class_id = c.id AND hra.ended_at IS NULL
            )
           UNION ALL
           SELECT DISTINCT 'subject'::text, cs.school_subject_id, ss.name
             FROM class_subjects cs
             JOIN school_subjects ss
               ON ss.id = cs.school_subject_id AND ss.school_id = cs.school_id
            WHERE cs.class_id = c.id
              AND NOT EXISTS (
                SELECT 1 FROM teacher_class_assignments tca
                 WHERE tca.class_id = c.id AND tca.school_subject_id = cs.school_subject_id
                   AND tca.revoked_at IS NULL
              )
         ) missing_kind
        WHERE c.school_id = $1 AND c.status = 'active'
        ORDER BY c.name, missing_kind.kind, missing_kind.subject_name`,
      [schoolId],
    );
    const overview = result.rows[0] ?? {};
    return {
      ...overview,
      missingHomeroomClasses: missing.rows.filter((row) => row.kind === 'homeroom'),
      unassignedSubjects: missing.rows.filter((row) => row.kind === 'subject'),
    };
  }

  async function listAcademicYears(auth, requestedSchoolId) {
    const pool = poolProvider();
    const schoolId = await resolveSchoolId(pool, auth, requestedSchoolId);
    const result = await pool.query(
      `SELECT id, name, starts_on, ends_on, status, is_current, created_at, updated_at
         FROM academic_years
        WHERE school_id = $1
        ORDER BY starts_on DESC NULLS LAST, created_at DESC`,
      [schoolId],
    );
    return result.rows;
  }

  async function createAcademicYear(auth, requestedSchoolId, input) {
    const name = requireText(input?.name, 'Tên năm học', 80);
    const startsOn = requireDate(input?.startsOn, 'Ngày bắt đầu');
    const endsOn = requireDate(input?.endsOn, 'Ngày kết thúc');
    if (startsOn > endsOn) {
      throw serviceError(400, 'ADMIN_INVALID_INPUT', 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
    }
    const status = input.status ?? 'planned';
    if (!['planned', 'active'].includes(status)) {
      throw serviceError(400, 'ADMIN_INVALID_INPUT', 'Trạng thái năm học không hợp lệ.');
    }
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const id = crypto.randomUUID();
      const result = await client.query(
        `INSERT INTO academic_years
           (id, school_id, name, starts_on, ends_on, status, is_current, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7)
         RETURNING id, name, starts_on, ends_on, status, is_current, created_at, updated_at`,
        [id, schoolId, name, startsOn, endsOn, status, auth.userId],
      );
      return result.rows[0];
    });
  }

  async function updateAcademicYear(auth, requestedSchoolId, yearId, input) {
    const id = requireUuid(yearId, 'Năm học');
    const name = requireText(input?.name, 'Tên năm học', 80);
    const startsOn = requireDate(input?.startsOn, 'Ngày bắt đầu');
    const endsOn = requireDate(input?.endsOn, 'Ngày kết thúc');
    const status = input.status;
    if (startsOn > endsOn || !YEAR_STATUSES.has(status)) {
      throw serviceError(400, 'ADMIN_INVALID_INPUT', 'Thông tin hoặc trạng thái năm học không hợp lệ.');
    }
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      await client.query(`SELECT id FROM schools WHERE id = $1 FOR UPDATE`, [schoolId]);
      const currentYear = await requireYear(client, schoolId, id, { allowClosed: true, lock: true });
      if (currentYear.status === 'closed' && status !== 'closed') {
        throw serviceError(409, 'ADMIN_YEAR_CLOSED', 'Không thể mở lại năm học đã đóng.');
      }
      if (status === 'closed' || status === 'legacy') {
        await client.query(
          `UPDATE academic_years
              SET is_current = false
            WHERE id = $1 AND school_id = $2`,
          [id, schoolId],
        );
      }
      const result = await client.query(
        `UPDATE academic_years
            SET name = $3, starts_on = $4, ends_on = $5, status = $6,
              is_current = CASE WHEN $6 <> 'active' THEN false ELSE is_current END,
                updated_at = now()
          WHERE id = $1 AND school_id = $2
          RETURNING id, name, starts_on, ends_on, status, is_current, created_at, updated_at`,
        [id, schoolId, name, startsOn, endsOn, status],
      );
      return result.rows[0];
    });
  }

  async function setCurrentAcademicYear(auth, requestedSchoolId, yearId) {
    const id = requireUuid(yearId, 'Năm học');
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      await client.query(`SELECT id FROM schools WHERE id = $1 FOR UPDATE`, [schoolId]);
      const year = await requireYear(client, schoolId, id, { lock: true });
      if (year.status === 'closed') {
        throw serviceError(409, 'ADMIN_YEAR_CLOSED', 'Không thể đặt năm học đã đóng làm hiện hành.');
      }
      await client.query(
        `UPDATE academic_years
            SET is_current = false, updated_at = now()
          WHERE school_id = $1 AND is_current AND id <> $2`,
        [schoolId, id],
      );
      const result = await client.query(
        `UPDATE academic_years
            SET status = 'active', is_current = true, updated_at = now()
          WHERE id = $1 AND school_id = $2
          RETURNING id, name, starts_on, ends_on, status, is_current, created_at, updated_at`,
        [id, schoolId],
      );
      return result.rows[0];
    });
  }

  async function closeAcademicYear(auth, requestedSchoolId, yearId) {
    const id = requireUuid(yearId, 'Năm học');
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      await client.query(`SELECT id FROM schools WHERE id = $1 FOR UPDATE`, [schoolId]);
      await requireYear(client, schoolId, id, { allowClosed: true, lock: true });
      const result = await client.query(
        `UPDATE academic_years
            SET status = 'closed', is_current = false, updated_at = now()
          WHERE id = $1 AND school_id = $2
          RETURNING id, name, starts_on, ends_on, status, is_current, created_at, updated_at`,
        [id, schoolId],
      );
      return result.rows[0];
    });
  }

  async function listClasses(auth, requestedSchoolId, filters = {}) {
    const pool = poolProvider();
    const schoolId = await resolveSchoolId(pool, auth, requestedSchoolId);
    const yearId = optionalUuid(filters.yearId, 'Năm học');
    const grade = filters.grade ? requireText(filters.grade, 'Khối lớp', 2) : null;
    if (grade && !['10', '11', '12'].includes(grade)) {
      throw serviceError(400, 'ADMIN_INVALID_INPUT', 'Khối lớp chỉ được là 10, 11 hoặc 12.');
    }
    const query = typeof filters.q === 'string' ? filters.q.trim().slice(0, 100) : '';
    const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(filters.pageSize, 10) || 25));
    const result = await pool.query(
      `WITH filtered AS (
         SELECT c.id, c.code, c.name, c.grade,
                COALESCE(ay.name, c.academic_year) AS academic_year,
                c.academic_year_id, c.status,
                hra.teacher_user_id AS homeroom_teacher_id,
                homeroom.full_name AS homeroom_teacher_name,
                (SELECT count(*)::int FROM class_memberships cm
                  WHERE cm.class_id = c.id AND cm.status = 'active') AS student_count,
                (SELECT count(DISTINCT cs.school_subject_id)::int FROM class_subjects cs
                  WHERE cs.class_id = c.id AND cs.school_subject_id IS NOT NULL) AS subject_count,
                (SELECT count(DISTINCT tca.school_subject_id)::int FROM teacher_class_assignments tca
                  WHERE tca.class_id = c.id AND tca.revoked_at IS NULL
                    AND tca.school_subject_id IS NOT NULL) AS assigned_subject_count
           FROM classes c
           LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
           LEFT JOIN class_homeroom_assignments hra
             ON hra.class_id = c.id AND hra.ended_at IS NULL
           LEFT JOIN users homeroom ON homeroom.id = hra.teacher_user_id
          WHERE c.school_id = $1 AND c.status = 'active'
            AND ($2::uuid IS NULL OR c.academic_year_id = $2)
            AND ($3::text IS NULL OR c.grade = $3)
            AND ($4::text = '' OR c.name ILIKE '%' || $4 || '%' OR homeroom.full_name ILIKE '%' || $4 || '%')
       )
       SELECT filtered.*, count(*) OVER()::int AS total_count
         FROM filtered
        ORDER BY academic_year DESC NULLS LAST, name
        LIMIT $5 OFFSET $6`,
      [schoolId, yearId, grade, query, pageSize, (page - 1) * pageSize],
    );
    return {
      items: result.rows.map(({ total_count: _totalCount, ...row }) => row),
      total: result.rows[0]?.total_count ?? 0,
      page,
      pageSize,
    };
  }

  async function getClass(auth, requestedSchoolId, classId) {
    const pool = poolProvider();
    const schoolId = await resolveSchoolId(pool, auth, requestedSchoolId);
    const id = requireUuid(classId, 'Lớp học');
    const classResult = await pool.query(
      `SELECT c.id, c.school_id, c.code, c.name, c.grade, c.academic_year_id,
              COALESCE(ay.name, c.academic_year) AS academic_year, c.status,
              hra.teacher_user_id AS homeroom_teacher_id,
              homeroom.full_name AS homeroom_teacher_name
         FROM classes c
         LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
         LEFT JOIN class_homeroom_assignments hra
           ON hra.class_id = c.id AND hra.ended_at IS NULL
         LEFT JOIN users homeroom ON homeroom.id = hra.teacher_user_id
        WHERE c.id = $1 AND c.school_id = $2 AND c.status = 'active'`,
      [id, schoolId],
    );
    const classRow = classResult.rows[0];
    if (!classRow) throw serviceError(404, 'ADMIN_CLASS_NOT_FOUND', 'Không tìm thấy lớp học.');
    const [students, teachers, subjects, homeroomHistory] = await Promise.all([
      pool.query(
        `SELECT u.id AS user_id, u.full_name, u.email, u.status AS account_status,
                sp.student_number, cm.joined_at
           FROM class_memberships cm
           JOIN users u ON u.id = cm.student_user_id
           JOIN student_profiles sp ON sp.user_id = u.id
          WHERE cm.class_id = $1 AND cm.status = 'active'
          ORDER BY u.full_name, u.email`,
        [id],
      ),
      pool.query(
        `SELECT tca.id, tca.teacher_user_id, teacher.full_name AS teacher_name,
                teacher.email AS teacher_email, ss.id AS subject_id, ss.name AS subject_name,
                'subject'::text AS assignment_type
           FROM teacher_class_assignments tca
           JOIN users teacher ON teacher.id = tca.teacher_user_id
           JOIN school_subjects ss
             ON ss.id = tca.school_subject_id AND ss.school_id = tca.school_id
          WHERE tca.class_id = $1 AND tca.school_id = $2 AND tca.revoked_at IS NULL
          ORDER BY ss.name, teacher.full_name`,
        [id, schoolId],
      ),
      pool.query(
        `SELECT DISTINCT ON (cs.school_subject_id) cs.school_subject_id AS id, ss.name,
                EXISTS (
                  SELECT 1 FROM teacher_class_assignments tca
                   WHERE tca.class_id = cs.class_id
                     AND tca.school_subject_id = cs.school_subject_id
                     AND tca.revoked_at IS NULL
                ) AS assigned
           FROM class_subjects cs
           JOIN school_subjects ss
             ON ss.id = cs.school_subject_id AND ss.school_id = cs.school_id
          WHERE cs.class_id = $1 AND cs.school_id = $2
          ORDER BY cs.school_subject_id, ss.name`,
        [id, schoolId],
      ),
      pool.query(
        `SELECT hra.teacher_user_id, u.full_name AS teacher_name,
                hra.subject, hra.created_at, hra.ended_at,
                ended_by.full_name AS ended_by_name
           FROM class_homeroom_assignments hra
           JOIN users u ON u.id = hra.teacher_user_id
           LEFT JOIN users ended_by ON ended_by.id = hra.ended_by
          WHERE hra.class_id = $1
          ORDER BY hra.created_at DESC`,
        [id],
      ),
    ]);
    return {
      ...classRow,
    student_count: students.rows.length,
    subject_count: subjects.rows.length,
    assigned_subject_count: new Set(teachers.rows.map((teacher) => teacher.subject_id)).size,
    students: students.rows,
      teachers: teachers.rows,
      subjects: subjects.rows,
      homeroomHistory: homeroomHistory.rows,
    };
  }

  async function createClass(auth, requestedSchoolId, input) {
    const name = requireText(input?.name, 'Tên lớp', 50);
    const grade = requireText(input?.grade, 'Khối lớp', 2);
    if (!['10', '11', '12'].includes(grade)) {
      throw serviceError(400, 'ADMIN_INVALID_INPUT', 'Khối lớp chỉ được là 10, 11 hoặc 12.');
    }
    const yearId = requireUuid(input?.academicYearId, 'Năm học');
    const code = name.replace(/\s+/g, '').toLocaleUpperCase('vi');
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const year = await requireYear(client, schoolId, yearId, { lock: true });
      const result = await client.query(
        `INSERT INTO classes (id, school_id, code, name, grade, academic_year, academic_year_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING id, code, name, grade, academic_year, academic_year_id, status`,
        [crypto.randomUUID(), schoolId, code, name, grade, year.name, year.id],
      );
      return result.rows[0];
    });
  }

  async function updateClass(auth, requestedSchoolId, classId, input) {
    const id = requireUuid(classId, 'Lớp học');
    const name = requireText(input?.name, 'Tên lớp', 50);
    const grade = requireText(input?.grade, 'Khối lớp', 2);
    if (!['10', '11', '12'].includes(grade)) {
      throw serviceError(400, 'ADMIN_INVALID_INPUT', 'Khối lớp chỉ được là 10, 11 hoặc 12.');
    }
    const code = name.replace(/\s+/g, '').toLocaleUpperCase('vi');
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const existing = await client.query(
        `SELECT c.id, ay.status AS year_status
           FROM classes c
           JOIN academic_years ay ON ay.id = c.academic_year_id
          WHERE c.id = $1 AND c.school_id = $2 AND c.status = 'active'
          FOR UPDATE OF c, ay`,
        [id, schoolId],
      );
      if (!existing.rows[0]) throw serviceError(404, 'ADMIN_CLASS_NOT_FOUND', 'Không tìm thấy lớp học.');
      if (existing.rows[0].year_status === 'closed') {
        throw serviceError(409, 'ADMIN_YEAR_CLOSED', 'Không thể chỉnh sửa lớp thuộc năm học đã đóng.');
      }
      const result = await client.query(
        `UPDATE classes SET code = $3, name = $4, grade = $5
          WHERE id = $1 AND school_id = $2
          RETURNING id, code, name, grade, academic_year, academic_year_id, status`,
        [id, schoolId, code, name, grade],
      );
      return result.rows[0];
    });
  }

  async function listTeachers(auth, requestedSchoolId) {
    const pool = poolProvider();
    const schoolId = await resolveSchoolId(pool, auth, requestedSchoolId);
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, tp.employee_number
         FROM users u
         JOIN teacher_profiles tp ON tp.user_id = u.id AND tp.school_id = $1
         JOIN school_memberships sm
           ON sm.user_id = u.id AND sm.school_id = $1 AND sm.status = 'active'
        WHERE u.role = 'lecturer' AND u.status = 'active'
        ORDER BY u.full_name, u.email`,
      [schoolId],
    );
    return result.rows;
  }

  async function listStudents(auth, requestedSchoolId, yearId) {
    const pool = poolProvider();
    const schoolId = await resolveSchoolId(pool, auth, requestedSchoolId);
    const academicYearId = optionalUuid(yearId, 'Năm học');
    if (academicYearId) await requireYear(pool, schoolId, academicYearId, { allowClosed: true });
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.status AS account_status, sp.student_number,
              active_class.id AS current_class_id, active_class.name AS current_class_name
         FROM users u
         JOIN student_profiles sp ON sp.user_id = u.id AND sp.school_id = $1
         JOIN school_memberships sm
           ON sm.user_id = u.id AND sm.school_id = $1 AND sm.status = 'active'
         LEFT JOIN LATERAL (
           SELECT c.id, c.name
             FROM class_memberships cm
             JOIN classes c ON c.id = cm.class_id
            WHERE cm.student_user_id = u.id AND cm.status = 'active'
              AND c.school_id = $1 AND c.status = 'active'
              AND ($2::uuid IS NULL OR cm.academic_year_id = $2)
            ORDER BY c.academic_year DESC, c.name
            LIMIT 1
         ) active_class ON true
        WHERE u.role = 'student'
        ORDER BY u.full_name, u.email`,
      [schoolId, academicYearId],
    );
    return result.rows;
  }

  async function changeStudentMembership(auth, requestedSchoolId, classId, studentId, { end = false } = {}) {
    const classUuid = requireUuid(classId, 'Lớp học');
    const userId = requireUuid(studentId, 'Học sinh');
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const classResult = await client.query(
        `SELECT c.id, c.academic_year_id
           FROM classes c
           JOIN academic_years ay ON ay.id = c.academic_year_id
          WHERE c.id = $1 AND c.school_id = $2 AND c.status = 'active'
            AND ay.status <> 'closed'
          FOR UPDATE OF c, ay`,
        [classUuid, schoolId],
      );
      const classRow = classResult.rows[0];
      if (!classRow) throw serviceError(404, 'ADMIN_CLASS_NOT_FOUND', 'Không tìm thấy lớp học hoặc năm học đã đóng.');

      const studentResult = await client.query(
        `SELECT u.id
           FROM users u
           JOIN student_profiles sp ON sp.user_id = u.id AND sp.school_id = $2
           JOIN school_memberships sm
             ON sm.user_id = u.id AND sm.school_id = $2 AND sm.status = 'active'
          WHERE u.id = $1 AND u.role = 'student'
          FOR UPDATE OF u`,
        [userId, schoolId],
      );
      if (!studentResult.rows[0]) {
        throw serviceError(404, 'ADMIN_STUDENT_NOT_FOUND', 'Không tìm thấy học sinh đang thuộc trường này.');
      }

      const activeMembership = await client.query(
        `SELECT id, class_id FROM class_memberships
          WHERE student_user_id = $1 AND school_id = $2
            AND academic_year_id = $3 AND status = 'active'
          FOR UPDATE`,
        [userId, schoolId, classRow.academic_year_id],
      );
      if (end) {
        const membership = activeMembership.rows.find((row) => row.class_id === classUuid);
        if (!membership) throw serviceError(404, 'ADMIN_MEMBERSHIP_NOT_FOUND', 'Học sinh không còn là thành viên đang hoạt động của lớp.');
        await client.query(
          `UPDATE class_memberships
              SET status = 'ended', ended_at = now()
            WHERE id = $1`,
          [membership.id],
        );
        return { ended: true, studentUserId: userId, classId: classUuid };
      }
      if (activeMembership.rows.some((row) => row.class_id === classUuid)) {
        throw serviceError(409, 'ADMIN_MEMBERSHIP_EXISTS', 'Học sinh đã thuộc lớp này trong năm học đang chọn.');
      }
      await client.query(
        `UPDATE class_memberships
            SET status = 'ended', ended_at = now()
          WHERE student_user_id = $1 AND school_id = $2
            AND academic_year_id = $3 AND status = 'active'`,
        [userId, schoolId, classRow.academic_year_id],
      );
      const result = await client.query(
        `INSERT INTO class_memberships
           (id, class_id, student_user_id, school_id, academic_year_id, status, joined_at)
         VALUES ($1, $2, $3, $4, $5, 'active', now())
         RETURNING id, class_id, student_user_id, school_id, academic_year_id, status, joined_at`,
        [crypto.randomUUID(), classUuid, userId, schoolId, classRow.academic_year_id],
      );
      return result.rows[0];
    });
  }

  async function listSubjects(auth, requestedSchoolId, yearId) {
    const pool = poolProvider();
    const schoolId = await resolveSchoolId(pool, auth, requestedSchoolId);
    const academicYearId = optionalUuid(yearId, 'Năm học');
    if (academicYearId) await requireYear(pool, schoolId, academicYearId, { allowClosed: true });
    const result = await pool.query(
      `SELECT ss.id, ss.name, ss.code,
              count(DISTINCT c.id)::int AS class_count,
              count(DISTINCT tca.teacher_user_id)::int AS teacher_count
         FROM school_subjects ss
         LEFT JOIN class_subjects cs
           ON cs.school_subject_id = ss.id AND cs.school_id = ss.school_id
         LEFT JOIN classes c
           ON c.id = cs.class_id AND c.school_id = cs.school_id
          AND c.status = 'active'
          AND ($2::uuid IS NULL OR c.academic_year_id = $2)
         LEFT JOIN teacher_class_assignments tca
           ON tca.class_id = c.id AND tca.school_subject_id = ss.id
          AND tca.school_id = ss.school_id AND tca.revoked_at IS NULL
        WHERE ss.school_id = $1
        GROUP BY ss.id
        ORDER BY ss.name`,
      [schoolId, academicYearId],
    );
    return result.rows;
  }

  async function getSubject(auth, requestedSchoolId, subjectId, yearId) {
    const pool = poolProvider();
    const schoolId = await resolveSchoolId(pool, auth, requestedSchoolId);
    const id = requireUuid(subjectId, 'Môn học');
    const academicYearId = optionalUuid(yearId, 'Năm học');
    const subject = await pool.query(
      `SELECT id, name, code FROM school_subjects WHERE id = $1 AND school_id = $2`,
      [id, schoolId],
    );
    if (!subject.rows[0]) throw serviceError(404, 'ADMIN_SUBJECT_NOT_FOUND', 'Không tìm thấy môn học.');
    const classes = await pool.query(
      `SELECT c.id AS class_id, c.name AS class_name, c.grade,
              COALESCE(ay.name, c.academic_year) AS academic_year,
              tca.id AS assignment_id, tca.teacher_user_id,
              teacher.full_name AS teacher_name,
              (tca.id IS NOT NULL) AS assigned
         FROM (
           SELECT DISTINCT ON (cs.class_id, cs.school_subject_id)
                  cs.class_id, cs.school_id, cs.school_subject_id
             FROM class_subjects cs
            WHERE cs.school_subject_id = $1 AND cs.school_id = $2
            ORDER BY cs.class_id, cs.school_subject_id, cs.created_at, cs.subject
         ) cs
         JOIN classes c ON c.id = cs.class_id AND c.school_id = cs.school_id
         LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
         LEFT JOIN teacher_class_assignments tca
           ON tca.class_id = c.id AND tca.school_subject_id = cs.school_subject_id
          AND tca.revoked_at IS NULL
         LEFT JOIN users teacher ON teacher.id = tca.teacher_user_id
        WHERE c.status = 'active'
          AND ($3::uuid IS NULL OR c.academic_year_id = $3)
        ORDER BY c.name, teacher.full_name`,
      [id, schoolId, academicYearId],
    );
    return { ...subject.rows[0], classes: classes.rows };
  }

  async function createSubject(auth, requestedSchoolId, input) {
    const name = requireText(input?.name, 'Tên môn học', 120);
    const code = requireText(input?.code, 'Mã môn học', 32).toLocaleUpperCase('vi');
    if (!/^[\p{L}\p{N}_-]+$/u.test(code)) {
      throw serviceError(400, 'ADMIN_INVALID_INPUT', 'Mã môn chỉ được chứa chữ cái, chữ số, gạch nối hoặc gạch dưới.');
    }
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const result = await client.query(
        `INSERT INTO school_subjects (id, school_id, name, code, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, code`,
        [crypto.randomUUID(), schoolId, name, code, auth.userId],
      );
      return result.rows[0];
    });
  }

  async function updateSubject(auth, requestedSchoolId, subjectId, input) {
    const id = requireUuid(subjectId, 'Môn học');
    const name = requireText(input?.name, 'Tên môn học', 120);
    const code = requireText(input?.code, 'Mã môn học', 32).toLocaleUpperCase('vi');
    if (!/^[\p{L}\p{N}_-]+$/u.test(code)) {
      throw serviceError(400, 'ADMIN_INVALID_INPUT', 'Mã môn chỉ được chứa chữ cái, chữ số, gạch nối hoặc gạch dưới.');
    }
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const result = await client.query(
        `UPDATE school_subjects
            SET name = $3, code = $4, updated_at = now()
          WHERE id = $1 AND school_id = $2
          RETURNING id, name, code`,
        [id, schoolId, name, code],
      );
      if (!result.rows[0]) throw serviceError(404, 'ADMIN_SUBJECT_NOT_FOUND', 'Không tìm thấy môn học.');
      return result.rows[0];
    });
  }

  async function listAssignments(auth, requestedSchoolId, filters = {}) {
    const pool = poolProvider();
    const schoolId = await resolveSchoolId(pool, auth, requestedSchoolId);
    const yearId = optionalUuid(filters.yearId, 'Năm học');
    const classId = optionalUuid(filters.classId, 'Lớp học');
    const subjectId = optionalUuid(filters.subjectId, 'Môn học');
    const teacherId = optionalUuid(filters.teacherId, 'Giáo viên');
    const result = await pool.query(
      `SELECT tca.id, c.id AS class_id, c.name AS class_name, c.grade,
              ay.id AS academic_year_id, ay.name AS academic_year,
              ss.id AS subject_id, ss.name AS subject_name,
              tca.teacher_user_id, teacher.full_name AS teacher_name,
              tca.created_at
         FROM teacher_class_assignments tca
         JOIN classes c ON c.id = tca.class_id AND c.school_id = tca.school_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
         JOIN school_subjects ss
           ON ss.id = tca.school_subject_id AND ss.school_id = tca.school_id
         JOIN users teacher ON teacher.id = tca.teacher_user_id
        WHERE tca.school_id = $1 AND tca.revoked_at IS NULL
          AND ($2::uuid IS NULL OR ay.id = $2)
          AND ($3::uuid IS NULL OR c.id = $3)
          AND ($4::uuid IS NULL OR ss.id = $4)
          AND ($5::uuid IS NULL OR teacher.id = $5)
        ORDER BY ay.name DESC, c.name, ss.name, teacher.full_name`,
      [schoolId, yearId, classId, subjectId, teacherId],
    );
    return result.rows;
  }

  async function requireActiveTeacher(queryable, schoolId, teacherId) {
    const id = requireUuid(teacherId, 'Giáo viên');
    const result = await queryable.query(
      `SELECT u.id
         FROM users u
         JOIN teacher_profiles tp ON tp.user_id = u.id AND tp.school_id = $2
         JOIN school_memberships sm
           ON sm.user_id = u.id AND sm.school_id = $2 AND sm.status = 'active'
        WHERE u.id = $1 AND u.role = 'lecturer' AND u.status = 'active'
        FOR UPDATE OF u`,
      [id, schoolId],
    );
    if (!result.rows[0]) {
      throw serviceError(400, 'ADMIN_INVALID_TEACHER', 'Chỉ được phân công giáo viên đang hoạt động của trường.');
    }
    return id;
  }

  async function ensureClassSubject(client, classId, schoolId, subjectId, subjectName) {
    await client.query(
      `UPDATE class_subjects
          SET school_subject_id = $3
        WHERE class_id = $1 AND school_id = $2
          AND lower(trim(subject)) = lower(trim($4))
          AND school_subject_id IS NULL`,
      [classId, schoolId, subjectId, subjectName],
    );
    let result = await client.query(
      `SELECT subject FROM class_subjects
        WHERE class_id = $1 AND school_id = $2 AND school_subject_id = $3
        ORDER BY created_at
        LIMIT 1`,
      [classId, schoolId, subjectId],
    );
    if (result.rows[0]) return result.rows[0].subject;
    await client.query(
      `INSERT INTO class_subjects (class_id, school_id, subject, school_subject_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (class_id, subject) DO NOTHING`,
      [classId, schoolId, subjectName, subjectId],
    );
    result = await client.query(
      `SELECT subject FROM class_subjects
        WHERE class_id = $1 AND school_id = $2 AND school_subject_id = $3
        ORDER BY created_at
        LIMIT 1`,
      [classId, schoolId, subjectId],
    );
    if (!result.rows[0]) {
      throw serviceError(409, 'ADMIN_SUBJECT_CLASS_CONFLICT', 'Không thể liên kết môn học này với lớp do dữ liệu cũ không nhất quán.');
    }
    return result.rows[0].subject;
  }

  async function addClassSubject(auth, requestedSchoolId, classId, subjectId) {
    const classUuid = requireUuid(classId, 'Lớp học');
    const schoolSubjectId = requireUuid(subjectId, 'Môn học');
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const classResult = await client.query(
        `SELECT c.id
           FROM classes c
           JOIN academic_years ay ON ay.id = c.academic_year_id
          WHERE c.id = $1 AND c.school_id = $2
            AND c.status = 'active' AND ay.status <> 'closed'
          FOR UPDATE OF c, ay`,
        [classUuid, schoolId],
      );
      if (!classResult.rows[0]) {
        throw serviceError(404, 'ADMIN_CLASS_NOT_FOUND', 'Không tìm thấy lớp hoặc năm học đã đóng.');
      }
      const subject = await client.query(
        `SELECT id, name FROM school_subjects WHERE id = $1 AND school_id = $2`,
        [schoolSubjectId, schoolId],
      );
      if (!subject.rows[0]) throw serviceError(404, 'ADMIN_SUBJECT_NOT_FOUND', 'Không tìm thấy môn học.');
      const subjectSnapshot = await ensureClassSubject(
        client,
        classUuid,
        schoolId,
        schoolSubjectId,
        subject.rows[0].name,
      );
      return { classId: classUuid, subjectId: schoolSubjectId, name: subjectSnapshot };
    });
  }

  async function createAssignment(auth, requestedSchoolId, input) {
    const classId = requireUuid(input?.classId, 'Lớp học');
    const yearId = requireUuid(input?.academicYearId, 'Năm học');
    const subjectId = requireUuid(input?.subjectId, 'Môn học');
    const teacherId = requireUuid(input?.teacherUserId, 'Giáo viên');
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const classResult = await client.query(
        `SELECT c.id, c.academic_year_id
           FROM classes c JOIN academic_years ay ON ay.id = c.academic_year_id
          WHERE c.id = $1 AND c.school_id = $2 AND c.status = 'active'
            AND ay.id = $3 AND ay.status <> 'closed'
          FOR UPDATE OF c, ay`,
        [classId, schoolId, yearId],
      );
      if (!classResult.rows[0]) throw serviceError(404, 'ADMIN_CLASS_NOT_FOUND', 'Không tìm thấy lớp trong năm học đang chọn.');
      const subjectResult = await client.query(
        `SELECT id, name FROM school_subjects WHERE id = $1 AND school_id = $2`,
        [subjectId, schoolId],
      );
      if (!subjectResult.rows[0]) throw serviceError(404, 'ADMIN_SUBJECT_NOT_FOUND', 'Không tìm thấy môn học.');
      await requireActiveTeacher(client, schoolId, teacherId);
      const existing = await client.query(
        `SELECT id FROM teacher_class_assignments
          WHERE class_id = $1 AND school_id = $2
            AND school_subject_id = $3 AND revoked_at IS NULL
          FOR UPDATE`,
        [classId, schoolId, subjectId],
      );
      if (existing.rows.length) {
        throw serviceError(409, 'ADMIN_ASSIGNMENT_EXISTS', 'Môn học này đã có giáo viên được phân công trong lớp.');
      }
      const subjectSnapshot = await ensureClassSubject(client, classId, schoolId, subjectId, subjectResult.rows[0].name);
      const result = await client.query(
        `INSERT INTO teacher_class_assignments
           (id, class_id, teacher_user_id, school_id, subject, school_subject_id, assigned_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, class_id, teacher_user_id, school_id, subject, school_subject_id, created_at`,
        [crypto.randomUUID(), classId, teacherId, schoolId, subjectSnapshot, subjectId, auth.userId],
      );
      return result.rows[0];
    });
  }

  async function updateAssignment(auth, requestedSchoolId, assignmentId, teacherUserId) {
    const id = requireUuid(assignmentId, 'Phân công');
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const currentResult = await client.query(
        `SELECT tca.id, tca.class_id, tca.teacher_user_id, tca.subject, tca.school_subject_id,
                ay.status AS year_status
           FROM teacher_class_assignments tca
           JOIN classes c ON c.id = tca.class_id AND c.school_id = tca.school_id
           JOIN academic_years ay ON ay.id = c.academic_year_id
          WHERE tca.id = $1 AND tca.school_id = $2 AND tca.revoked_at IS NULL
          FOR UPDATE OF tca, c, ay`,
        [id, schoolId],
      );
      const current = currentResult.rows[0];
      if (!current) throw serviceError(404, 'ADMIN_ASSIGNMENT_NOT_FOUND', 'Không tìm thấy phân công đang hoạt động.');
      if (current.year_status === 'closed') throw serviceError(409, 'ADMIN_YEAR_CLOSED', 'Không thể sửa phân công thuộc năm học đã đóng.');
      const nextTeacherId = await requireActiveTeacher(client, schoolId, teacherUserId);
      if (current.teacher_user_id === nextTeacherId) {
        throw serviceError(409, 'ADMIN_ASSIGNMENT_UNCHANGED', 'Giáo viên này đã phụ trách môn học.');
      }
      await client.query(
        `UPDATE teacher_class_assignments SET revoked_at = now()
          WHERE id = $1 AND revoked_at IS NULL`,
        [id],
      );
      const result = await client.query(
        `INSERT INTO teacher_class_assignments
           (id, class_id, teacher_user_id, school_id, subject, school_subject_id, assigned_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, class_id, teacher_user_id, school_id, subject, school_subject_id, created_at`,
        [crypto.randomUUID(), current.class_id, nextTeacherId, schoolId, current.subject, current.school_subject_id, auth.userId],
      );
      return result.rows[0];
    });
  }

  async function revokeAssignment(auth, requestedSchoolId, assignmentId) {
    const id = requireUuid(assignmentId, 'Phân công');
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const active = await client.query(
        `SELECT tca.id
           FROM teacher_class_assignments tca
           JOIN classes c ON c.id = tca.class_id AND c.school_id = tca.school_id
           JOIN academic_years ay ON ay.id = c.academic_year_id
          WHERE tca.id = $1 AND tca.school_id = $2 AND tca.revoked_at IS NULL
            AND ay.status <> 'closed'
          FOR UPDATE OF tca, c, ay`,
        [id, schoolId],
      );
      if (!active.rows[0]) {
        throw serviceError(404, 'ADMIN_ASSIGNMENT_NOT_FOUND', 'Không tìm thấy phân công đang hoạt động trong năm học có thể chỉnh sửa.');
      }
      const result = await client.query(
        `UPDATE teacher_class_assignments
            SET revoked_at = now()
          WHERE id = $1 AND school_id = $2 AND revoked_at IS NULL
          RETURNING id, revoked_at`,
        [id, schoolId],
      );
      if (!result.rows[0]) throw serviceError(404, 'ADMIN_ASSIGNMENT_NOT_FOUND', 'Không tìm thấy phân công đang hoạt động.');
      return result.rows[0];
    });
  }

  async function setHomeroomTeacher(auth, requestedSchoolId, classId, teacherUserId) {
    const id = requireUuid(classId, 'Lớp học');
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const classResult = await client.query(
        `SELECT c.id FROM classes c
          JOIN academic_years ay ON ay.id = c.academic_year_id
         WHERE c.id = $1 AND c.school_id = $2
           AND c.status = 'active' AND ay.status <> 'closed'
         FOR UPDATE OF c, ay`,
        [id, schoolId],
      );
      if (!classResult.rows[0]) throw serviceError(404, 'ADMIN_CLASS_NOT_FOUND', 'Không tìm thấy lớp học hoặc năm học đã đóng.');
      const teacherId = await requireActiveTeacher(client, schoolId, teacherUserId);
      const current = await client.query(
        `SELECT id, teacher_user_id FROM class_homeroom_assignments
          WHERE class_id = $1 AND ended_at IS NULL
          FOR UPDATE`,
        [id],
      );
      if (current.rows[0]?.teacher_user_id === teacherId) {
        throw serviceError(409, 'ADMIN_HOMEROOM_UNCHANGED', 'Giáo viên này đã là giáo viên chủ nhiệm của lớp.');
      }
      if (current.rows[0]) {
        await client.query(
          `UPDATE class_homeroom_assignments
              SET ended_at = now(), ended_by = $2, updated_at = now()
            WHERE id = $1`,
          [current.rows[0].id, auth.userId],
        );
      }
      const result = await client.query(
        `INSERT INTO class_homeroom_assignments
           (id, class_id, school_id, teacher_user_id, subject, assigned_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, class_id, teacher_user_id, subject, created_at`,
        [crypto.randomUUID(), id, schoolId, teacherId, HOMEROOM_SUBJECT, auth.userId],
      );
      return result.rows[0];
    });
  }

  async function endHomeroomAssignment(auth, requestedSchoolId, classId) {
    const id = requireUuid(classId, 'Lớp học');
    const pool = poolProvider();
    return transaction(pool, async (client) => {
      const schoolId = await resolveSchoolId(client, auth, requestedSchoolId);
      const classResult = await client.query(
        `SELECT c.id
           FROM classes c
           JOIN academic_years ay ON ay.id = c.academic_year_id
          WHERE c.id = $1 AND c.school_id = $2 AND c.status = 'active'
            AND ay.status <> 'closed'
          FOR UPDATE OF c, ay`,
        [id, schoolId],
      );
      if (!classResult.rows[0]) {
        throw serviceError(404, 'ADMIN_CLASS_NOT_FOUND', 'Không tìm thấy lớp hoặc năm học đã đóng.');
      }
      const result = await client.query(
        `UPDATE class_homeroom_assignments
            SET ended_at = now(), ended_by = $3, updated_at = now()
          WHERE class_id = $1 AND school_id = $2 AND ended_at IS NULL
          RETURNING id, class_id, ended_at`,
        [id, schoolId, auth.userId],
      );
      if (!result.rows[0]) throw serviceError(404, 'ADMIN_HOMEROOM_NOT_FOUND', 'Lớp hiện không có GVCN đang hoạt động.');
      return result.rows[0];
    });
  }

  return {
    listSchools,
    getOverview,
    listAcademicYears,
    createAcademicYear,
    updateAcademicYear,
    setCurrentAcademicYear,
    closeAcademicYear,
    listClasses,
    getClass,
    createClass,
    updateClass,
    listTeachers,
    listStudents,
    changeStudentMembership,
    listSubjects,
    getSubject,
    createSubject,
    updateSubject,
    addClassSubject,
    listAssignments,
    createAssignment,
    updateAssignment,
    revokeAssignment,
    setHomeroomTeacher,
    endHomeroomAssignment,
  };
}

module.exports = {
  createAdminSchoolService,
  serviceError,
};
