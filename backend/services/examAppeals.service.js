const { randomUUID } = require('node:crypto');
const { getPool } = require('../db/pool');
const { getSingleActiveSchool } = require('./school.service');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APPEAL_STATUSES = new Set(['reviewed', 'rejected']);

function appealError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function requireUuid(value, field) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw appealError(400, 'SCHOOL_INVALID_ID', `${field} không hợp lệ.`);
  }
  return value;
}

function mapAppeal(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    examTitle: row.exam_title,
    subject: row.subject,
    className: row.class_name,
    studentName: row.student_name,
    reason: row.reason,
    status: row.status,
    teacherResponse: row.teacher_response,
    createdAt: row.created_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
  };
}

function createExamAppealsService({
  getPool: poolProvider = getPool,
  getSchool = getSingleActiveSchool,
} = {}) {
  async function submitStudentExamAppeal(auth, sessionId, reason) {
    if (auth?.role !== 'student') {
      throw appealError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được gửi yêu cầu phúc khảo.');
    }
    const id = requireUuid(sessionId, 'sessionId');
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 2000) {
      throw appealError(400, 'SCHOOL_INVALID_APPEAL', 'Lý do phúc khảo cần có nội dung và không vượt quá 2.000 ký tự.');
    }
    const schoolId = await getSchool(auth.userId, 'student');
    const pool = poolProvider();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const eligible = await client.query(
        `SELECT s.id
           FROM teacher_exam_sessions s
           JOIN teacher_exam_rooms r ON r.id = s.room_id AND r.school_id = $3
           JOIN classes c ON c.id = s.class_id AND c.school_id = r.school_id AND c.status = 'active'
           JOIN class_memberships cm
             ON cm.class_id = c.id AND cm.student_user_id = s.student_user_id AND cm.status = 'active'
           JOIN users u ON u.id = s.student_user_id AND u.status = 'active' AND u.role = 'student'
           JOIN school_memberships sm
             ON sm.user_id = u.id AND sm.school_id = r.school_id AND sm.status = 'active'
           JOIN teacher_exam_session_grades g ON g.session_id = s.id AND g.published_at IS NOT NULL
          WHERE s.id = $1 AND s.student_user_id = $2 AND s.status = 'submitted'
          FOR SHARE OF s, g`,
        [id, auth.userId, schoolId],
      );
      if (!eligible.rows[0]) {
        throw appealError(404, 'SCHOOL_EXAM_RESULT_NOT_FOUND', 'Chỉ có thể phúc khảo bài thi đã được giáo viên công bố điểm của bạn.');
      }

      const inserted = await client.query(
        `INSERT INTO exam_appeals (id, session_id, student_user_id, reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id) DO NOTHING
         RETURNING id`,
        [randomUUID(), id, auth.userId, reason.trim()],
      );
      if (!inserted.rows[0]) {
        throw appealError(409, 'SCHOOL_APPEAL_ALREADY_EXISTS', 'Bạn đã gửi yêu cầu phúc khảo cho bài thi này.');
      }
      await client.query('COMMIT');
      return { id: inserted.rows[0].id };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function listStudentExamAppeals(auth) {
    if (auth?.role !== 'student') {
      throw appealError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được xem yêu cầu phúc khảo.');
    }
    const schoolId = await getSchool(auth.userId, 'student');
    const result = await poolProvider().query(
      `SELECT a.id, a.session_id, a.reason, a.status, a.teacher_response, a.created_at, a.reviewed_at,
              r.title AS exam_title,
              COALESCE(r.payload->'examSnapshot'->>'subject', '') AS subject,
              c.name AS class_name,
              NULL::text AS student_name
         FROM exam_appeals a
         JOIN teacher_exam_sessions s ON s.id = a.session_id
         JOIN teacher_exam_rooms r ON r.id = s.room_id AND r.school_id = $2
         JOIN classes c ON c.id = s.class_id AND c.school_id = r.school_id
         JOIN teacher_exam_session_grades g ON g.session_id = s.id AND g.published_at IS NOT NULL
        WHERE a.student_user_id = $1
        ORDER BY a.created_at DESC`,
      [auth.userId, schoolId],
    );
    return result.rows.map(mapAppeal);
  }

  async function listTeacherExamAppeals(auth) {
    if (auth?.role !== 'lecturer') {
      throw appealError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ giáo viên được xem yêu cầu phúc khảo.');
    }
    const schoolId = await getSchool(auth.userId, 'lecturer');
    const result = await poolProvider().query(
      `SELECT a.id, a.session_id, a.reason, a.status, a.teacher_response, a.created_at, a.reviewed_at,
              r.title AS exam_title,
              COALESCE(r.payload->'examSnapshot'->>'subject', '') AS subject,
              c.name AS class_name,
              u.full_name AS student_name
         FROM exam_appeals a
         JOIN teacher_exam_sessions s ON s.id = a.session_id
         JOIN teacher_exam_rooms r ON r.id = s.room_id
         JOIN classes c ON c.id = s.class_id AND c.school_id = r.school_id
         JOIN users u ON u.id = a.student_user_id AND u.role = 'student'
         JOIN teacher_exam_session_grades g ON g.session_id = s.id AND g.published_at IS NOT NULL
        WHERE r.teacher_user_id = $1 AND r.school_id = $2
        ORDER BY (a.status = 'pending') DESC, a.created_at DESC`,
      [auth.userId, schoolId],
    );
    return result.rows.map(mapAppeal);
  }

  async function reviewTeacherExamAppeal(auth, appealId, { status, teacherResponse }) {
    if (auth?.role !== 'lecturer') {
      throw appealError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ giáo viên được xử lý yêu cầu phúc khảo.');
    }
    const id = requireUuid(appealId, 'appealId');
    if (!APPEAL_STATUSES.has(status)
      || typeof teacherResponse !== 'string'
      || teacherResponse.trim().length < 3
      || teacherResponse.trim().length > 2000) {
      throw appealError(400, 'SCHOOL_INVALID_APPEAL_REVIEW', 'Cần chọn kết quả xử lý và nhập phản hồi từ 3 đến 2.000 ký tự.');
    }
    const schoolId = await getSchool(auth.userId, 'lecturer');
    const result = await poolProvider().query(
      `UPDATE exam_appeals a
          SET status = $3, teacher_response = $4, reviewed_at = now()
         FROM teacher_exam_sessions s
         JOIN teacher_exam_rooms r ON r.id = s.room_id
        WHERE a.id = $1 AND a.session_id = s.id
          AND a.status = 'pending'
          AND r.teacher_user_id = $2 AND r.school_id = $5
        RETURNING a.id, a.session_id, a.reason, a.status, a.teacher_response, a.created_at, a.reviewed_at,
                  r.title AS exam_title,
                  COALESCE(r.payload->'examSnapshot'->>'subject', '') AS subject,
                  ''::text AS class_name,
                  ''::text AS student_name`,
      [id, auth.userId, status, teacherResponse.trim(), schoolId],
    );
    if (!result.rows[0]) {
      throw appealError(404, 'SCHOOL_APPEAL_NOT_FOUND', 'Không tìm thấy yêu cầu đang chờ xử lý trong các phòng thi của bạn.');
    }
    return mapAppeal(result.rows[0]);
  }

  return {
    listStudentExamAppeals,
    listTeacherExamAppeals,
    reviewTeacherExamAppeal,
    submitStudentExamAppeal,
  };
}

module.exports = { createExamAppealsService };
