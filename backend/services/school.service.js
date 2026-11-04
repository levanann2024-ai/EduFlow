const { getPool } = require('../db/pool');
const {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
} = require('node:crypto');
const {
  automaticExamScores,
  questionId,
  questionType,
} = require('./examScoring');
const {
  getAcademicYearWeekNumber,
  mergeClassTimetableEvents,
} = require('./classTimetableEvents');

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
const ASSIGNMENT_SUBMISSION_MAX_FILES = 5;
const ASSIGNMENT_SUBMISSION_MAX_FILE_BYTES = 10 * 1024 * 1024;
const ASSIGNMENT_SUBMISSION_FILE_TYPES = new Set([...RESOURCE_FILE_TYPES.values()].filter((type) => type !== 'video/mp4'));
const EXAM_SUBMISSION_MAX_FILES = 5;
const EXAM_SUBMISSION_MAX_FILE_BYTES = 10 * 1024 * 1024;
const EXAM_SUBMISSION_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MOBILE_EXAM_UPLOAD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function hashMobileExamUploadToken(token) {
  if (typeof token !== 'string' || !MOBILE_EXAM_UPLOAD_TOKEN_PATTERN.test(token)) {
    throw serviceError(400, 'SCHOOL_INVALID_MOBILE_UPLOAD_SESSION', 'Mã tải ảnh qua điện thoại không hợp lệ.');
  }
  return createHash('sha256').update(token).digest('hex');
}

async function purgeExpiredStudentExamMobileUploadSessions() {
  const result = await getPool().query(
    'DELETE FROM teacher_exam_mobile_upload_sessions WHERE expires_at <= now()',
  );
  return result.rowCount;
}

function serviceError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function generateTeacherExamRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

function effectiveExamRoomStatus(room, now = Date.now()) {
  if (!['scheduled', 'open'].includes(room.status)) return room.status;
  const startsAt = Date.parse(room.startsAt);
  const endsAt = startsAt + room.durationMinutes * 60_000;
  if (!Number.isFinite(startsAt)) return room.status;
  if (now >= endsAt) return 'completed';
  return room.status === 'scheduled' && now >= startsAt ? 'open' : room.status;
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

function defaultAssessmentSections(questions) {
  const normalizedQuestions = questions.map((question, index) => ({
    ...question,
    id: typeof question.id === 'string' && question.id.trim() ? question.id : `question-${index + 1}`,
    type: ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(question.type)
      ? question.type
      : 'multiple-choice',
  }));
  const sectionTypes = ['multiple-choice', 'true-false', 'short-answer', 'essay']
    .filter((type) => normalizedQuestions.some((question) => question.type === type));
  const types = sectionTypes.length > 0 ? sectionTypes : ['essay'];
  const labels = {
    'multiple-choice': ['Trắc nghiệm nhiều phương án', 'Thí sinh chọn một phương án đúng cho mỗi câu.'],
    'true-false': ['Trắc nghiệm đúng / sai', 'Trong mỗi ý a), b), c), d), thí sinh chọn đúng hoặc sai.'],
    'short-answer': ['Trắc nghiệm trả lời ngắn', 'Thí sinh ghi câu trả lời ngắn cho từng câu.'],
    essay: ['Tự luận', 'Thí sinh trình bày lời giải và lập luận.'],
  };
  const romanNumbers = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  return types.map((type, index) => ({
    id: `section-${type}`,
    title: `Phần ${romanNumbers[index] ?? index + 1}: ${labels[type][0]}`,
    description: labels[type][1],
    questionIds: normalizedQuestions.filter((question) => question.type === type).map((question) => question.id),
    questionType: type,
  }));
}

function validateTeacherAssessment(kind, assessment) {
  if (!['exam', 'assignment'].includes(kind)) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT_KIND', 'Loại nội dung đã lưu không hợp lệ.');
  }
  if (!assessment || typeof assessment !== 'object' || Array.isArray(assessment)) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Dữ liệu nội dung đã lưu không hợp lệ.');
  }
  if (typeof assessment.id !== 'string' || assessment.id.trim().length === 0 || assessment.id.length > 160) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Mã nội dung đã lưu không hợp lệ.');
  }
  if (typeof assessment.title !== 'string' || assessment.title.trim().length === 0 || assessment.title.length > 200) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Tên nội dung phải có từ 1 đến 200 ký tự.');
  }
  if (typeof assessment.subject !== 'string' || assessment.subject.length > 120
    || typeof assessment.grade !== 'string' || assessment.grade.length > 80
    || typeof assessment.topic !== 'string' || assessment.topic.length > 200) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Thông tin môn học, khối lớp hoặc chủ đề không hợp lệ.');
  }
  if (!Array.isArray(assessment.questions) || assessment.questions.length > 500
    || !assessment.questions.every((question) => question && typeof question === 'object'
      && !Array.isArray(question) && typeof question.question === 'string')) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Danh sách câu hỏi không hợp lệ.');
  }
  const questions = assessment.questions.map((question, index) => ({
    ...question,
    id: typeof question.id === 'string' && question.id.trim()
      ? question.id
      : `question-${index + 1}`,
    type: ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(question.type)
      ? question.type
      : 'multiple-choice',
  }));
  const questionIds = new Set(questions.map((question) => question.id));
  if (questionIds.size !== questions.length || [...questionIds].some((id) => id.length > 160)) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Mã câu hỏi phải hợp lệ và không trùng nhau.');
  }
  let sections;
  if (assessment.sections === undefined) {
    sections = defaultAssessmentSections(questions);
  } else {
    if (!Array.isArray(assessment.sections) || assessment.sections.length < 1 || assessment.sections.length > 100) {
      throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Đề hoặc bài tập phải có từ 1 đến 100 phần.');
    }
    const sectionIds = new Set();
    const assignedQuestionIds = new Set();
    sections = assessment.sections.map((section) => {
      if (!section || typeof section !== 'object' || Array.isArray(section)
        || typeof section.id !== 'string' || section.id.trim().length === 0 || section.id.length > 160
        || sectionIds.has(section.id)
        || typeof section.title !== 'string' || section.title.trim().length === 0 || section.title.length > 160
        || typeof section.description !== 'string' || section.description.length > 2000
        || !Array.isArray(section.questionIds) || section.questionIds.length > 500
        || !section.questionIds.every((id) => typeof id === 'string' && questionIds.has(id) && !assignedQuestionIds.has(id))) {
        throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Thông tin phần hoặc câu hỏi thuộc phần không hợp lệ.');
      }
      sectionIds.add(section.id);
      section.questionIds.forEach((id) => assignedQuestionIds.add(id));
      return {
        id: section.id,
        title: section.title.trim(),
        description: section.description,
        questionIds: [...section.questionIds],
        questionType: section.questionType,
      };
    });
    if (assignedQuestionIds.size !== questions.length) {
      throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Mỗi câu hỏi phải thuộc chính xác một phần.');
    }
    sections = sections.map((section) => {
      const questionType = section.questionType
        ?? questions.find((question) => section.questionIds.includes(question.id))?.type
        ?? 'multiple-choice';
      if (!['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(questionType)
        || section.questionIds.some((id) => questions.find((question) => question.id === id)?.type !== questionType)) {
        throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Mỗi phần chỉ được chứa một loại câu hỏi.');
      }
      return { ...section, questionType };
    });
  }
  if (assessment.sectionPoints !== undefined) {
    const sectionTypes = ['multiple-choice', 'true-false', 'short-answer', 'essay'];
    const sectionPoints = assessment.sectionPoints;
    if (kind !== 'exam' || !sectionPoints || typeof sectionPoints !== 'object' || Array.isArray(sectionPoints)
      || sectionTypes.some((type) => !Number.isFinite(sectionPoints[type]) || sectionPoints[type] < 0)
      || Math.abs(sectionTypes.reduce((total, type) => total + sectionPoints[type], 0) - 10) > 0.000001) {
      throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Điểm các phần của đề thi phải hợp lệ và cộng đúng 10 điểm.');
    }
    const sectionTotals = Object.fromEntries(sectionTypes.map((type) => [type, 0]));
    let totalPoints = 0;
    for (const question of questions) {
      const type = sectionTypes.includes(question.type) ? question.type : 'multiple-choice';
      if (!Number.isFinite(question.points) || question.points <= 0) {
        throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Mỗi câu trong đề có phân bổ điểm cần có điểm hợp lệ.');
      }
      sectionTotals[type] += question.points;
      totalPoints += question.points;
    }
    if (Math.abs(totalPoints - 10) > 0.000001
      || sectionTypes.some((type) => Math.abs(sectionTotals[type] - sectionPoints[type]) > 0.000001)) {
      throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Tổng điểm câu hỏi phải bằng 10 và khớp với điểm từng phần.');
    }
  }
  if (assessment.status !== undefined && !['draft', 'ready'].includes(assessment.status)) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Trạng thái nội dung không hợp lệ.');
  }
  const normalizedAssessment = { ...assessment, questions, sections };
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const persistedSections = sections.map((section) => ({
    ...section,
    questions: section.questionIds.map((id) => questionsById.get(id)),
  }));
  normalizedAssessment.sections = persistedSections;
  const serialized = JSON.stringify(normalizedAssessment);
  if (Buffer.byteLength(serialized, 'utf8') > 262144) {
    throw serviceError(413, 'SCHOOL_ASSESSMENT_TOO_LARGE', 'Nội dung đã lưu không được vượt quá 256 KB.');
  }
  return { clientId: assessment.id, title: assessment.title.trim(), serialized, sections: persistedSections };
}

async function listTeacherAssessments(auth, kind) {
  if (!['exam', 'assignment'].includes(kind)) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT_KIND', 'Loại nội dung đã lưu không hợp lệ.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'lecturer');
  const result = await getPool().query(
    `SELECT client_id, payload, sections
       FROM teacher_assessments
      WHERE teacher_user_id = $1 AND school_id = $2 AND kind = $3
      ORDER BY updated_at DESC, created_at DESC`,
    [auth.userId, schoolId, kind],
  );
  return result.rows.map((row) => {
    const questions = Array.isArray(row.payload.questions)
      ? row.payload.questions.map((question, index) => ({
        ...question,
        id: typeof question.id === 'string' && question.id.trim() ? question.id : `question-${index + 1}`,
        type: ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(question.type)
          ? question.type
          : 'multiple-choice',
      }))
      : [];
    return {
      ...row.payload,
      id: row.client_id,
      sections: row.sections?.length
        ? row.sections
        : Array.isArray(row.payload.sections) && row.payload.sections.length > 0
          ? row.payload.sections
          : defaultAssessmentSections(questions),
    };
  });
}

async function saveTeacherAssessment(auth, kind, assessment) {
  const { clientId, title, serialized, sections } = validateTeacherAssessment(kind, assessment);
  const schoolId = await getSingleActiveSchool(auth.userId, 'lecturer');
  const result = await getPool().query(
    `INSERT INTO teacher_assessments
       (id, teacher_user_id, school_id, kind, client_id, title, payload, sections)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
     ON CONFLICT (teacher_user_id, kind, client_id)
     DO UPDATE SET school_id = EXCLUDED.school_id, title = EXCLUDED.title,
                   payload = EXCLUDED.payload, sections = EXCLUDED.sections, updated_at = now()
     RETURNING client_id, payload, sections`,
    [randomUUID(), auth.userId, schoolId, kind, clientId, title, serialized, JSON.stringify(sections)],
  );
  return { ...result.rows[0].payload, id: result.rows[0].client_id, sections: result.rows[0].sections };
}

async function deleteTeacherAssessment(auth, kind, clientId) {
  if (!['exam', 'assignment'].includes(kind)) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT_KIND', 'Loại nội dung đã lưu không hợp lệ.');
  }
  if (typeof clientId !== 'string' || clientId.trim().length === 0 || clientId.length > 160) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSESSMENT', 'Mã nội dung đã lưu không hợp lệ.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'lecturer');
  const result = await getPool().query(
    `DELETE FROM teacher_assessments
      WHERE teacher_user_id = $1 AND school_id = $2 AND kind = $3 AND client_id = $4`,
    [auth.userId, schoolId, kind, clientId],
  );
  return result.rowCount > 0;
}

function validateTeacherExamRoom(room) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!room || typeof room !== 'object' || Array.isArray(room)) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_ROOM', 'Dữ liệu phòng thi không hợp lệ.');
  }
  if (typeof room.id !== 'string' || !uuidPattern.test(room.id)) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_ROOM', 'Mã phòng thi không hợp lệ.');
  }
  if (typeof room.code !== 'string' || room.code.trim().length === 0 || room.code.length > 32
    || typeof room.title !== 'string' || room.title.trim().length === 0 || room.title.length > 200) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_ROOM', 'Mã và tên phòng thi là bắt buộc.');
  }
  if (typeof room.instructions !== 'string' || room.instructions.length > 5000
    || typeof room.examId !== 'string' || room.examId.trim().length === 0) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_ROOM', 'Hướng dẫn hoặc đề thi không hợp lệ.');
  }
  if (!Array.isArray(room.classIds) || room.classIds.length === 0 || room.classIds.length > 100
    || !room.classIds.every((id) => typeof id === 'string' && uuidPattern.test(id))
    || new Set(room.classIds).size !== room.classIds.length) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_ROOM', 'Chọn ít nhất một lớp hợp lệ.');
  }
  const startsAt = typeof room.startsAt === 'string' ? Date.parse(room.startsAt) : NaN;
  if (!Number.isFinite(startsAt)) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_ROOM', 'Thời điểm bắt đầu phòng thi không hợp lệ.');
  }
  if (!Number.isInteger(room.durationMinutes) || room.durationMinutes < 1 || room.durationMinutes > 600) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_ROOM', 'Thời gian làm bài phải từ 1 đến 600 phút.');
  }
  if (!['draft', 'scheduled', 'open', 'closed', 'completed'].includes(room.status)) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_ROOM', 'Trạng thái phòng thi không hợp lệ.');
  }
  const settings = room.settings;
  const normalizedSettings = settings && typeof settings === 'object' && !Array.isArray(settings)
    ? {
      ...settings,
      requireCamera: settings.requireCamera ?? false,
      requireMicrophone: settings.requireMicrophone ?? false,
      monitorFace: settings.monitorFace ?? false,
      monitorSpeech: settings.monitorSpeech ?? false,
    }
    : settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)
    || !['shuffleQuestions', 'allowBackNavigation', 'allowEarlySubmit', 'monitorTabSwitch', 'monitorConnection']
      .every((key) => typeof settings[key] === 'boolean')
    || !['requireCamera', 'requireMicrophone']
      .every((key) => typeof normalizedSettings[key] === 'boolean')
    || !['monitorFace', 'monitorSpeech']
      .every((key) => typeof normalizedSettings[key] === 'boolean')
    || !Number.isInteger(settings.warningThreshold) || settings.warningThreshold < 1 || settings.warningThreshold > 20) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_ROOM', 'Quy tắc phòng thi không hợp lệ.');
  }
  const serialized = JSON.stringify(room);
  if (Buffer.byteLength(serialized, 'utf8') > 1048576) {
    throw serviceError(413, 'SCHOOL_EXAM_ROOM_TOO_LARGE', 'Cấu hình phòng thi không được vượt quá 1 MB.');
  }
  return {
    id: room.id,
    code: room.code.trim(),
    title: room.title.trim(),
    startsAt: new Date(startsAt).toISOString(),
    settings: normalizedSettings,
  };
}

async function listTeacherExamRooms(auth) {
  const schoolId = await getSingleActiveSchool(auth.userId, 'lecturer');
  const result = await getPool().query(
    `SELECT payload
       FROM teacher_exam_rooms
      WHERE teacher_user_id = $1 AND school_id = $2
      ORDER BY starts_at DESC, created_at DESC`,
    [auth.userId, schoolId],
  );
  const rooms = result.rows.map((row) => ({
    ...row.payload,
    status: effectiveExamRoomStatus(row.payload),
    sessions: [],
  }));
  if (rooms.length === 0) return rooms;
  const sessionsResult = await getPool().query(
    `SELECT s.id, s.room_id, s.student_user_id, u.full_name AS student_name,
            c.name AS class_name, s.status, s.started_at, s.submitted_at,
            s.last_activity_at, count(e.id)::int AS event_count,
            COALESCE(jsonb_agg(jsonb_build_object(
              'id', e.id,
              'at', to_char(e.occurred_at AT TIME ZONE 'UTC', 'HH24:MI'),
              'label', CASE e.event_type
                WHEN 'tab-hidden' THEN 'Chuyển sang tab khác'
                WHEN 'window-blur' THEN 'Rời khỏi cửa sổ bài thi'
                WHEN 'fullscreen-exit' THEN 'Thoát chế độ toàn màn hình'
                WHEN 'connection-lost' THEN 'Mất kết nối'
                WHEN 'connection-restored' THEN 'Đã khôi phục kết nối'
              END,
              'kind', 'warning'
            )) FILTER (WHERE e.id IS NOT NULL), '[]'::jsonb) AS events
       FROM teacher_exam_sessions s
       JOIN users u ON u.id = s.student_user_id
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN teacher_exam_events e ON e.session_id = s.id
      WHERE s.room_id = ANY($1::uuid[])
      GROUP BY s.id, u.full_name, c.name
      ORDER BY s.started_at DESC`,
    [rooms.map((room) => room.id)],
  );
  const behaviorLogsBySession = new Map(sessionsResult.rows.map((row) => [row.id, []]));
  if (sessionsResult.rows.length > 0) {
    const behaviorLogsResult = await getPool().query(
      `SELECT id, session_id, event_type, occurred_at, duration_seconds
         FROM exam_logs
        WHERE session_id = ANY($1::uuid[])
        ORDER BY occurred_at DESC`,
      [sessionsResult.rows.map((row) => row.id)],
    );
    for (const row of behaviorLogsResult.rows) {
      behaviorLogsBySession.get(row.session_id)?.push({
        id: row.id,
        eventType: row.event_type,
        occurredAt: row.occurred_at.toISOString(),
        durationSeconds: Number(row.duration_seconds),
      });
    }
  }
  const sessionsByRoom = new Map(rooms.map((room) => [room.id, []]));
  const rosterResult = await getPool().query(
    `SELECT DISTINCT ON (r.id, u.id)
            r.id AS room_id, u.id AS student_user_id, u.full_name AS student_name,
            c.name AS class_name
       FROM teacher_exam_rooms r
       JOIN class_memberships cm
         ON r.payload->'classIds' ? cm.class_id::text
        AND cm.school_id = r.school_id AND cm.status = 'active'
       JOIN classes c
         ON c.id = cm.class_id AND c.school_id = r.school_id AND c.status = 'active'
       JOIN users u
         ON u.id = cm.student_user_id AND u.role = 'student' AND u.status = 'active'
      WHERE r.id = ANY($1::uuid[]) AND r.teacher_user_id = $2 AND r.school_id = $3
        AND EXISTS (
          SELECT 1
            FROM school_memberships sm
            JOIN schools school ON school.id = sm.school_id AND school.status = 'active'
           WHERE sm.user_id = u.id AND sm.school_id = r.school_id AND sm.status = 'active'
        )
      ORDER BY r.id, u.id, c.name`,
    [rooms.map((room) => room.id), auth.userId, schoolId],
  );
  const rosterCounts = new Map(rooms.map((room) => [room.id, 0]));
  for (const row of rosterResult.rows) {
    rosterCounts.set(row.room_id, (rosterCounts.get(row.room_id) ?? 0) + 1);
  }
  for (const row of sessionsResult.rows) {
    const room = rooms.find((item) => item.id === row.room_id);
    if (!room) continue;
    const remainingSeconds = Math.max(
      0,
      room.durationMinutes * 60 - Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000),
    );
    sessionsByRoom.get(row.room_id).push({
      id: row.id,
      studentId: row.student_user_id,
      studentName: row.student_name,
      className: row.class_name,
      status: row.status === 'submitted' ? 'submitted' : row.status === 'review' ? 'review' : 'in-progress',
      startedAt: row.started_at.toISOString(),
      submittedAt: row.submitted_at?.toISOString() ?? null,
      remainingMinutes: row.status === 'submitted' ? null : Math.ceil(remainingSeconds / 60),
      eventCount: row.event_count,
      risk: row.status === 'review' ? 'review' : row.event_count > 0 ? 'low' : 'none',
      events: row.events,
      behaviorLogs: behaviorLogsBySession.get(row.id) ?? [],
      behaviorLogCount: behaviorLogsBySession.get(row.id)?.length ?? 0,
      score: null,
      needsManualGrading: 0,
    });
  }
  for (const row of rosterResult.rows) {
    const roomSessions = sessionsByRoom.get(row.room_id);
    if (roomSessions.some((session) => session.studentId === row.student_user_id)) continue;
    roomSessions.push({
      id: `not-started:${row.student_user_id}`,
      studentId: row.student_user_id,
      studentName: row.student_name,
      className: row.class_name,
      status: 'not-started',
      startedAt: null,
      submittedAt: null,
      remainingMinutes: null,
      eventCount: 0,
      risk: 'none',
      events: [],
      behaviorLogs: [],
      behaviorLogCount: 0,
      score: null,
      needsManualGrading: 0,
    });
  }
  return rooms.map((room) => ({
    ...room,
    studentCount: Math.max(rosterCounts.get(room.id) ?? 0, sessionsByRoom.get(room.id).length),
    sessions: sessionsByRoom.get(room.id),
  }));
}

function studentExamRoomForClient(payload) {
  const snapshot = payload.examSnapshot;
  const sourceQuestions = snapshot.questions.map((question, index) => ({
    id: typeof question.id === 'string' ? question.id : `question-${index + 1}`,
    type: ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(question.type)
      ? question.type
      : 'multiple-choice',
    question: question.question,
    options: Array.isArray(question.options) ? question.options : [],
    points: Number.isFinite(question.points) ? question.points : 1,
  }));
  const sourceSections = Array.isArray(snapshot.sections) && snapshot.sections.length > 0
    ? snapshot.sections
    : defaultAssessmentSections(sourceQuestions);
  const clientSections = sourceSections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    questionIds: Array.isArray(section.questionIds) ? section.questionIds : [],
  }));
  const questionsById = new Map(sourceQuestions.map((question) => [question.id, question]));
  const questions = clientSections.flatMap((section) => (
    Array.isArray(section.questionIds)
      ? section.questionIds.flatMap((questionId) => {
        const question = questionsById.get(questionId);
        if (!question) return [];
        return [{
          ...question,
          sectionId: section.id,
          sectionTitle: section.title,
          sectionDescription: section.description,
        }];
      })
      : []
  ));
  return {
    id: payload.id,
    classIds: Array.isArray(payload.classIds) ? payload.classIds : [],
    code: payload.code,
    title: payload.title,
    subject: snapshot.subject,
    startsAt: payload.startsAt,
    durationMinutes: payload.durationMinutes,
    status: effectiveExamRoomStatus(payload),
    instructions: payload.instructions,
    settings: {
      ...payload.settings,
      requireCamera: payload.settings.requireCamera ?? false,
      requireMicrophone: payload.settings.requireMicrophone ?? false,
      monitorFace: payload.settings.monitorFace ?? false,
      monitorSpeech: payload.settings.monitorSpeech ?? false,
    },
    examSnapshot: { sections: clientSections, questions },
  };
}

async function listStudentExamRooms(auth) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được xem phòng thi.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const result = await getPool().query(
    `SELECT r.payload, r.status, r.starts_at,
            (SELECT count(*)::int
               FROM teacher_exam_sessions s
              WHERE s.room_id = r.id AND s.status IN ('in-progress', 'review')) AS in_progress_count,
            EXISTS (
              SELECT 1
                FROM teacher_exam_sessions s
               WHERE s.room_id = r.id AND s.student_user_id = $2 AND s.status = 'submitted'
            ) AS has_submitted
       FROM teacher_exam_rooms r
      WHERE r.school_id = $1
        AND r.status IN ('scheduled', 'open', 'closed', 'completed')
        AND EXISTS (
          SELECT 1
            FROM class_memberships cm
            JOIN classes c ON c.id = cm.class_id AND c.school_id = cm.school_id
           WHERE cm.student_user_id = $2
             AND cm.school_id = $1
             AND cm.status = 'active'
             AND c.status = 'active'
             AND r.payload->'classIds' ? c.id::text
        )
      ORDER BY r.starts_at DESC, r.created_at DESC`,
    [schoolId, auth.userId],
  );
  return result.rows.map((row) => ({
    ...studentExamRoomForClient({
      ...row.payload,
      status: row.status,
      startsAt: new Date(row.starts_at).toISOString(),
    }),
    inProgressCount: row.in_progress_count,
    hasSubmitted: row.has_submitted,
  }));
}

async function listStudentExamResults(auth) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được xem bài làm đã chấm của mình.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const result = await getPool().query(
    `SELECT s.id AS session_id, s.room_id, s.class_id, s.submitted_at, s.answers,
            r.payload, r.starts_at, c.name AS class_name, c.academic_year,
            g.question_scores, g.question_feedback, g.total_score, g.teacher_feedback,
            g.graded_at, g.published_at,
            EXISTS (
              SELECT 1
                FROM teacher_exam_grade_views v
               WHERE v.session_id = s.id AND v.student_user_id = $2
                 AND v.viewed_graded_at = g.graded_at
            ) AS is_read,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', f.id,
                'questionNumber', f.question_number,
                'name', f.original_name,
                'mediaType', f.media_type,
                'sizeBytes', f.size_bytes
              ) ORDER BY f.question_number, f.created_at, f.id)
                FROM teacher_exam_submission_files f
               WHERE f.session_id = s.id
            ), '[]'::json) AS files,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', ef.id,
                'questionId', ef.question_id,
                'name', ef.original_name,
                'mediaType', ef.media_type,
                'sizeBytes', ef.size_bytes
              ) ORDER BY ef.question_id, ef.created_at, ef.id)
                FROM teacher_exam_grade_evidence_files ef
               WHERE ef.session_id = s.id
            ), '[]'::json) AS grade_evidence_files
       FROM teacher_exam_sessions s
       JOIN teacher_exam_rooms r ON r.id = s.room_id AND r.school_id = $1
       JOIN classes c ON c.id = s.class_id AND c.school_id = r.school_id AND c.status = 'active'
       JOIN class_memberships cm
         ON cm.class_id = c.id AND cm.student_user_id = s.student_user_id AND cm.status = 'active'
       JOIN users u ON u.id = s.student_user_id AND u.status = 'active' AND u.role = 'student'
       JOIN school_memberships sm
         ON sm.user_id = u.id AND sm.school_id = r.school_id AND sm.status = 'active'
       JOIN teacher_exam_session_grades g ON g.session_id = s.id
      WHERE s.student_user_id = $2 AND s.status = 'submitted'
        AND g.published_at IS NOT NULL
      ORDER BY g.graded_at DESC, s.submitted_at DESC`,
    [schoolId, auth.userId],
  );
  return result.rows.map((row) => {
    const snapshot = row.payload?.examSnapshot;
    const questions = teacherExamQuestions(row.payload);
    const sections = Array.isArray(snapshot.sections) ? snapshot.sections : [];
    const sectionByQuestionId = new Map(
      sections.flatMap((section) => (
        Array.isArray(section.questionIds)
          ? section.questionIds.map((id) => [id, section])
          : []
      )),
    );
    return {
      sessionId: row.session_id,
      roomId: row.room_id,
      roomCode: row.payload.code,
      title: row.payload.title,
      subject: snapshot.subject,
      classId: row.class_id,
      className: row.class_name,
      academicYear: row.academic_year,
      startsAt: row.starts_at.toISOString(),
      submittedAt: row.submitted_at?.toISOString() ?? null,
      answers: row.answers ?? {},
      files: row.files ?? [],
      questions: questions.map((question, index) => {
        const id = questionId(question, index);
        const section = sectionByQuestionId.get(id);
        return {
          id,
          type: questionType(question),
          question: question.question,
          options: Array.isArray(question.options) ? question.options : [],
          correctIndex: Number.isInteger(question.correctIndex)
            ? question.correctIndex
            : Array.isArray(question.options) ? question.options.indexOf(question.correctAnswer) : -1,
          correctAnswer: typeof question.correctAnswer === 'string' ? question.correctAnswer : '',
          correctAnswers: Array.isArray(question.correctAnswers)
            ? question.correctAnswers.filter((answer) => typeof answer === 'boolean')
            : undefined,
          explanation: typeof question.explanation === 'string' ? question.explanation : '',
          points: question.points,
          sectionId: section?.id ?? '',
          sectionTitle: section?.title ?? 'Bài làm',
          sectionDescription: section?.description ?? '',
        };
      }),
      grade: {
        questionScores: row.question_scores ?? {},
        questionFeedback: row.question_feedback ?? {},
        totalScore: Number(row.total_score),
        teacherFeedback: row.teacher_feedback ?? '',
        evidenceFiles: row.grade_evidence_files ?? [],
        gradedAt: row.graded_at.toISOString(),
        isRead: row.is_read,
      },
    };
  });
}

async function markStudentExamResultRead(auth, sessionId) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được đánh dấu bài kiểm tra đã xem.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const result = await getPool().query(
    `INSERT INTO teacher_exam_grade_views (session_id, student_user_id, viewed_graded_at)
     SELECT s.id, s.student_user_id, g.graded_at
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
     ON CONFLICT (session_id, student_user_id)
     DO UPDATE SET viewed_graded_at = EXCLUDED.viewed_graded_at, updated_at = now()
     RETURNING viewed_graded_at`,
    [sessionId, auth.userId, schoolId],
  );
  if (!result.rows[0]) {
    throw serviceError(404, 'SCHOOL_EXAM_RESULT_NOT_FOUND', 'Không tìm thấy bài kiểm tra đã công bố trong tài khoản của bạn.');
  }
  return { readAt: result.rows[0].viewed_graded_at.toISOString() };
}

async function getStudentExamResultFile(auth, sessionId, fileId, gradeEvidence = false) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được xem tệp bài làm của mình.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const fileTable = gradeEvidence
    ? 'teacher_exam_grade_evidence_files'
    : 'teacher_exam_submission_files';
  const result = await getPool().query(
    `SELECT f.original_name, f.media_type, f.size_bytes, f.content
       FROM ${fileTable} f
       JOIN teacher_exam_sessions s ON s.id = f.session_id AND s.status = 'submitted'
       JOIN teacher_exam_rooms r ON r.id = s.room_id AND r.school_id = $4
       JOIN classes c ON c.id = s.class_id AND c.school_id = r.school_id AND c.status = 'active'
       JOIN class_memberships cm
         ON cm.class_id = c.id AND cm.student_user_id = s.student_user_id AND cm.status = 'active'
       JOIN school_memberships sm
         ON sm.user_id = s.student_user_id AND sm.school_id = r.school_id AND sm.status = 'active'
       JOIN teacher_exam_session_grades g ON g.session_id = s.id AND g.published_at IS NOT NULL
      WHERE s.id = $1 AND f.id = $2 AND s.student_user_id = $3`,
    [sessionId, fileId, auth.userId, schoolId],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_EXAM_FILE_NOT_FOUND', 'Không tìm thấy tệp trong bài kiểm tra đã chấm của bạn.');
  }
  const row = result.rows[0];
  return {
    name: row.original_name,
    mediaType: row.media_type,
    sizeBytes: Number(row.size_bytes),
    content: row.content,
  };
}

async function publishTeacherExamRoomGrades(auth, roomId) {
  if (auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ giáo viên được công bố điểm bài thi.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'lecturer');
  const roomResult = await getPool().query(
    `SELECT id
       FROM teacher_exam_rooms
      WHERE id = $1 AND teacher_user_id = $2 AND school_id = $3`,
    [roomId, auth.userId, schoolId],
  );
  if (!roomResult.rows[0]) {
    throw serviceError(404, 'SCHOOL_EXAM_ROOM_NOT_FOUND', 'Không tìm thấy phòng thi trong phạm vi của bạn.');
  }
  const result = await getPool().query(
    `WITH published AS (
       UPDATE teacher_exam_session_grades g
          SET published_at = now()
         FROM teacher_exam_sessions s
        JOIN teacher_exam_rooms r ON r.id = s.room_id
       WHERE g.session_id = s.id AND r.id = $1 AND r.teacher_user_id = $2
         AND r.school_id = $3 AND s.status = 'submitted'
      RETURNING g.session_id
    )
    SELECT (SELECT count(*)::int FROM published) AS published_count,
           count(*)::int AS total_published_count,
           max(g.published_at) AS published_at
      FROM teacher_exam_session_grades g
      JOIN teacher_exam_sessions s ON s.id = g.session_id
      JOIN teacher_exam_rooms r ON r.id = s.room_id
     WHERE r.id = $1 AND r.teacher_user_id = $2 AND r.school_id = $3
       AND g.published_at IS NOT NULL`,
    [roomId, auth.userId, schoolId],
  );
  const publication = result.rows[0];
  if (publication.total_published_count === 0) {
    throw serviceError(409, 'SCHOOL_EXAM_NO_GRADES_TO_PUBLISH', 'Phòng thi chưa có bài nào được chấm để công bố.');
  }
  return {
    publishedCount: publication.published_count,
    totalPublishedCount: publication.total_published_count,
    publishedAt: publication.published_at.toISOString(),
  };
}

async function startStudentExamSession(auth, roomId) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được bắt đầu phòng thi.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const result = await getPool().query(
    `INSERT INTO teacher_exam_sessions (id, room_id, student_user_id, class_id)
     SELECT $1, eligible.id, $3, eligible.class_id
       FROM (
         SELECT DISTINCT ON (r.id) r.id, cm.class_id
           FROM teacher_exam_rooms r
           JOIN class_memberships cm
             ON cm.student_user_id = $3 AND cm.school_id = r.school_id AND cm.status = 'active'
           JOIN classes c ON c.id = cm.class_id AND c.status = 'active'
          WHERE r.id = $2 AND r.school_id = $4 AND r.status IN ('scheduled', 'open')
            AND now() >= r.starts_at
            AND now() < r.starts_at + make_interval(mins => (r.payload->>'durationMinutes')::int)
            AND r.payload->'classIds' ? cm.class_id::text
          ORDER BY r.id, cm.joined_at
       ) eligible
     ON CONFLICT (room_id, student_user_id)
     DO UPDATE SET last_activity_at = now()
       WHERE teacher_exam_sessions.status IN ('in-progress', 'review')
     RETURNING id, started_at`,
    [randomUUID(), roomId, auth.userId, schoolId],
  );
  if (!result.rows[0]) {
    throw serviceError(409, 'SCHOOL_EXAM_ROOM_UNAVAILABLE', 'Phòng thi hiện không mở hoặc em không thuộc lớp được giao.');
  }
  return { id: result.rows[0].id, startedAt: result.rows[0].started_at.toISOString() };
}

async function recordStudentExamEvent(auth, sessionId, eventType) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được ghi nhận sự kiện phòng thi.');
  }
  const enabledEventTypes = {
    'tab-hidden': 'monitorTabSwitch',
    'window-blur': 'monitorTabSwitch',
    'fullscreen-exit': 'monitorTabSwitch',
    'connection-lost': 'monitorConnection',
    'connection-restored': 'monitorConnection',
  };
  if (!Object.hasOwn(enabledEventTypes, eventType)) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_EVENT', 'Loại sự kiện phòng thi không hợp lệ.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const sessionResult = await getPool().query(
    `SELECT s.room_id, s.status, r.payload->'settings' AS settings
       FROM teacher_exam_sessions s
       JOIN teacher_exam_rooms r ON r.id = s.room_id
      WHERE s.id = $1 AND s.student_user_id = $2 AND r.school_id = $3`,
    [sessionId, auth.userId, schoolId],
  );
  const session = sessionResult.rows[0];
  if (!session || !['in-progress', 'review'].includes(session.status)) {
    throw serviceError(404, 'SCHOOL_EXAM_SESSION_NOT_FOUND', 'Không tìm thấy phiên thi đang hoạt động.');
  }
  if (!session.settings[enabledEventTypes[eventType]]) {
    return { eventCount: 0, needsReview: session.status === 'review' };
  }
  await getPool().query(
    `INSERT INTO teacher_exam_events (id, session_id, event_type)
     VALUES ($1, $2, $3)`,
    [randomUUID(), sessionId, eventType],
  );
  const countResult = await getPool().query(
    `SELECT count(*)::int AS event_count,
            (SELECT (r.payload->'settings'->>'warningThreshold')::int
               FROM teacher_exam_rooms r WHERE r.id = s.room_id) AS warning_threshold
       FROM teacher_exam_events e
       JOIN teacher_exam_sessions s ON s.id = e.session_id
      WHERE e.session_id = $1
      GROUP BY s.room_id`,
    [sessionId],
  );
  const eventCount = countResult.rows[0]?.event_count ?? 0;
  const needsReview = eventCount >= countResult.rows[0]?.warning_threshold;
  if (needsReview && session.status === 'in-progress') {
    await getPool().query(
      `UPDATE teacher_exam_sessions SET status = 'review', last_activity_at = now()
        WHERE id = $1 AND student_user_id = $2 AND status = 'in-progress'`,
      [sessionId, auth.userId],
    );
  }
  return { eventCount, needsReview };
}

async function recordStudentExamBehaviorLog(auth, sessionId, eventData) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được ghi nhận sự kiện phòng thi.');
  }
  const eventSettings = {
    tab_hidden: 'monitorTabSwitch',
    face_missing: 'monitorFace',
    multiple_faces: 'monitorFace',
    speech_activity: 'monitorSpeech',
  };
  const minimumDurations = {
    tab_hidden: 0,
    face_missing: 3,
    multiple_faces: 3,
    speech_activity: 1.5,
  };
  if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)
    || !Object.hasOwn(eventSettings, eventData.event_type)
    || typeof eventData.timestamp !== 'string'
    || eventData.timestamp.length > 64
    || !Number.isFinite(Date.parse(eventData.timestamp))
    || Date.parse(eventData.timestamp) > Date.now() + 5 * 60_000
    || typeof eventData.duration_seconds !== 'number'
    || !Number.isFinite(eventData.duration_seconds)
    || eventData.duration_seconds < minimumDurations[eventData.event_type]
    || eventData.duration_seconds > 36_000) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_BEHAVIOR_LOG', 'Dữ liệu sự kiện giám sát phòng thi không hợp lệ.');
  }

  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const client = await getPool().connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const sessionResult = await client.query(
      `SELECT s.status, r.payload->'settings' AS settings
         FROM teacher_exam_sessions s
         JOIN teacher_exam_rooms r ON r.id = s.room_id
        WHERE s.id = $1 AND s.student_user_id = $2 AND r.school_id = $3
        FOR UPDATE OF s`,
      [sessionId, auth.userId, schoolId],
    );
    const session = sessionResult.rows[0];
    if (!session || !['in-progress', 'review'].includes(session.status)) {
      throw serviceError(404, 'SCHOOL_EXAM_SESSION_NOT_FOUND', 'Không tìm thấy phiên thi đang hoạt động.');
    }
    if (!session.settings?.[eventSettings[eventData.event_type]]) {
      throw serviceError(403, 'SCHOOL_EXAM_MONITORING_DISABLED', 'Sự kiện này không được bật cho phòng thi.');
    }

    const duplicateResult = await client.query(
      `SELECT id
         FROM exam_logs
        WHERE session_id = $1 AND event_type = $2
          AND received_at >= now() - interval '3 seconds'
        ORDER BY received_at DESC
        LIMIT 1`,
      [sessionId, eventData.event_type],
    );
    if (duplicateResult.rows[0]) {
      await client.query('COMMIT');
      transactionStarted = false;
      return { saved: false, duplicate: true };
    }

    await client.query(
      `INSERT INTO exam_logs
         (id, session_id, student_user_id, event_type, occurred_at, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        sessionId,
        auth.userId,
        eventData.event_type,
        new Date(eventData.timestamp),
        eventData.duration_seconds,
      ],
    );
    await client.query('COMMIT');
    transactionStarted = false;
    return { saved: true, duplicate: false };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Không thể hoàn tác giao dịch ghi log phòng thi.', rollbackError);
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

async function createStudentExamMobileUploadSession(auth, sessionId, questionNumber) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được mở phiên tải ảnh bài thi.');
  }
  if (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > 500) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_FILE', 'Câu tự luận không hợp lệ.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM teacher_exam_mobile_upload_sessions WHERE expires_at <= now()',
    );
    const sessionResult = await client.query(
      `SELECT s.started_at, s.status, r.payload,
              LEAST(
                now() + interval '30 minutes',
                s.started_at + make_interval(mins => (r.payload->>'durationMinutes')::int)
              ) AS expires_at
         FROM teacher_exam_sessions s
         JOIN teacher_exam_rooms r ON r.id = s.room_id
        WHERE s.id = $1 AND s.student_user_id = $2 AND r.school_id = $3
          AND s.status IN ('in-progress', 'review')
          AND now() < s.started_at + make_interval(mins => (r.payload->>'durationMinutes')::int)
        FOR UPDATE OF s`,
      [sessionId, auth.userId, schoolId],
    );
    const session = sessionResult.rows[0];
    if (!session) {
      throw serviceError(409, 'SCHOOL_EXAM_UPLOAD_UNAVAILABLE', 'Phiên thi đã nộp, hết giờ hoặc không thuộc tài khoản của em.');
    }
    const questions = teacherExamQuestions(session.payload);
    if (questionNumber > questions.length || questionType(questions[questionNumber - 1]) !== 'essay') {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_FILE', 'Ảnh chỉ được đính kèm vào câu tự luận hợp lệ.');
    }
    const countResult = await client.query(
      `SELECT count(*)::int AS count
         FROM teacher_exam_mobile_upload_sessions
        WHERE session_id = $1 AND expires_at > now()`,
      [sessionId],
    );
    if (countResult.rows[0].count >= EXAM_SUBMISSION_MAX_FILES) {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_FILES', 'Mỗi bài thi được mở tối đa 5 phiên tải ảnh qua điện thoại.');
    }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashMobileExamUploadToken(token);
    const created = await client.query(
      `INSERT INTO teacher_exam_mobile_upload_sessions (token_hash, session_id, question_number, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING expires_at`,
      [tokenHash, sessionId, questionNumber, session.expires_at],
    );
    await client.query('COMMIT');
    return {
      token,
      questionNumber,
      expiresAt: created.rows[0].expires_at.toISOString(),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.code === '42P01'
      && String(error.message).includes('teacher_exam_mobile_upload_sessions')) {
      throw serviceError(
        503,
        'SCHOOL_EXAM_MOBILE_UPLOAD_MIGRATION_REQUIRED',
        'Tính năng ảnh QR chưa sẵn sàng: cơ sở dữ liệu chưa có bảng tải ảnh tạm. Hãy chạy migration 020_student_exam_mobile_uploads và khởi động lại backend.',
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getStudentExamMobileUploadStatus(token) {
  const tokenHash = hashMobileExamUploadToken(token);
  const result = await getPool().query(
    `SELECT m.content IS NOT NULL AS uploaded, m.original_name
       FROM teacher_exam_mobile_upload_sessions m
       JOIN teacher_exam_sessions s ON s.id = m.session_id
       JOIN teacher_exam_rooms r ON r.id = s.room_id
      WHERE m.token_hash = $1 AND m.expires_at > now()
        AND s.status IN ('in-progress', 'review')
        AND now() < s.started_at + make_interval(mins => (r.payload->>'durationMinutes')::int)`,
    [tokenHash],
  );
  if (!result.rows[0]) {
    throw serviceError(410, 'SCHOOL_MOBILE_UPLOAD_SESSION_EXPIRED', 'Mã tải ảnh đã hết hạn hoặc phiên thi đã kết thúc.');
  }
  return result.rows[0].uploaded
    ? {
      status: 'success',
      imageUrl: `/api/check-session/image?session=${encodeURIComponent(token)}`,
      name: result.rows[0].original_name,
    }
    : { status: 'pending' };
}

async function uploadStudentExamMobileImage(token, file) {
  const tokenHash = hashMobileExamUploadToken(token);
  const sessionResult = await getPool().query(
    `SELECT m.question_number
       FROM teacher_exam_mobile_upload_sessions m
       JOIN teacher_exam_sessions s ON s.id = m.session_id
       JOIN teacher_exam_rooms r ON r.id = s.room_id
      WHERE m.token_hash = $1 AND m.expires_at > now()
        AND s.status IN ('in-progress', 'review')
        AND now() < s.started_at + make_interval(mins => (r.payload->>'durationMinutes')::int)
        AND m.content IS NULL`,
    [tokenHash],
  );
  if (!sessionResult.rows[0]) {
    throw serviceError(409, 'SCHOOL_MOBILE_UPLOAD_UNAVAILABLE', 'Mã tải ảnh không hợp lệ, đã được sử dụng hoặc phiên thi đã kết thúc.');
  }
  const [validatedFile] = validateExamSubmissionFiles([{
    ...file,
    questionNumber: sessionResult.rows[0].question_number,
  }]);
  const result = await getPool().query(
    `UPDATE teacher_exam_mobile_upload_sessions m
        SET original_name = $2, media_type = $3, size_bytes = $4, content = $5
       FROM teacher_exam_sessions s
       JOIN teacher_exam_rooms r ON r.id = s.room_id
      WHERE m.token_hash = $1 AND s.id = m.session_id
        AND m.expires_at > now() AND m.content IS NULL
        AND s.status IN ('in-progress', 'review')
        AND now() < s.started_at + make_interval(mins => (r.payload->>'durationMinutes')::int)
     RETURNING m.question_number`,
    [
      tokenHash,
      validatedFile.originalName,
      validatedFile.mediaType,
      validatedFile.buffer.length,
      validatedFile.buffer,
    ],
  );
  if (!result.rows[0]) {
    throw serviceError(409, 'SCHOOL_MOBILE_UPLOAD_UNAVAILABLE', 'Mã tải ảnh vừa được sử dụng hoặc phiên thi đã kết thúc.');
  }
  return { uploaded: true, questionNumber: result.rows[0].question_number };
}

async function getStudentExamMobileImage(token) {
  const tokenHash = hashMobileExamUploadToken(token);
  const result = await getPool().query(
    `SELECT m.original_name, m.media_type, m.size_bytes, m.content
       FROM teacher_exam_mobile_upload_sessions m
       JOIN teacher_exam_sessions s ON s.id = m.session_id
       JOIN teacher_exam_rooms r ON r.id = s.room_id
      WHERE m.token_hash = $1 AND m.expires_at > now() AND m.content IS NOT NULL
        AND s.status IN ('in-progress', 'review')
        AND now() < s.started_at + make_interval(mins => (r.payload->>'durationMinutes')::int)`,
    [tokenHash],
  );
  if (!result.rows[0]) {
    throw serviceError(404, 'SCHOOL_MOBILE_IMAGE_NOT_FOUND', 'Không tìm thấy ảnh tạm hoặc mã tải ảnh đã hết hạn.');
  }
  return {
    name: result.rows[0].original_name,
    mediaType: result.rows[0].media_type,
    sizeBytes: Number(result.rows[0].size_bytes),
    content: result.rows[0].content,
  };
}

async function deleteStudentExamMobileUpload(auth, sessionId, token) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được xóa ảnh tạm trong bài thi.');
  }
  const tokenHash = hashMobileExamUploadToken(token);
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const result = await getPool().query(
    `DELETE FROM teacher_exam_mobile_upload_sessions m
      USING teacher_exam_sessions s, teacher_exam_rooms r
      WHERE m.token_hash = $1 AND m.session_id = s.id AND s.id = $2
        AND s.room_id = r.id AND s.student_user_id = $3 AND r.school_id = $4`,
    [tokenHash, sessionId, auth.userId, schoolId],
  );
  return { deleted: result.rowCount > 0 };
}

async function submitStudentExamSession(auth, sessionId, answers, files = [], mobileUploadTokens = []) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được nộp bài thi.');
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)
    || Object.keys(answers).length > 500
    || !Object.entries(answers).every(([key, value]) => /^\d+$/.test(key)
      && typeof value === 'string' && value.length <= 20000)) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_SUBMISSION', 'Câu trả lời không đúng định dạng.');
  }
  if (Buffer.byteLength(JSON.stringify(answers), 'utf8') > 102400) {
    throw serviceError(413, 'SCHOOL_EXAM_SUBMISSION_TOO_LARGE', 'Bài làm không được vượt quá 100 KB.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const uploadedFiles = validateExamSubmissionFiles(files);
  if (!Array.isArray(mobileUploadTokens) || mobileUploadTokens.length > EXAM_SUBMISSION_MAX_FILES
    || mobileUploadTokens.some((token) => typeof token !== 'string'
      || !MOBILE_EXAM_UPLOAD_TOKEN_PATTERN.test(token))
    || new Set(mobileUploadTokens).size !== mobileUploadTokens.length) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_FILES', 'Danh sách ảnh từ điện thoại không hợp lệ.');
  }
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const roomResult = await client.query(
      `SELECT s.started_at, s.status, r.payload
         FROM teacher_exam_sessions s
         JOIN teacher_exam_rooms r ON r.id = s.room_id
        WHERE s.id = $1 AND s.student_user_id = $2 AND r.school_id = $3
          AND s.status IN ('in-progress', 'review')
          AND now() <= s.started_at + make_interval(mins => (r.payload->>'durationMinutes')::int)
        FOR UPDATE OF s`,
      [sessionId, auth.userId, schoolId],
    );
    if (!roomResult.rows[0]) {
      throw serviceError(409, 'SCHOOL_EXAM_SUBMISSION_UNAVAILABLE', 'Phiên thi đã nộp, hết giờ hoặc không thuộc tài khoản của em.');
    }
    const questions = teacherExamQuestions(roomResult.rows[0].payload);
    const validFiles = uploadedFiles.map((file) => {
      if (file.questionNumber > questions.length
        || questionType(questions[file.questionNumber - 1]) !== 'essay') {
        throw serviceError(400, 'SCHOOL_INVALID_EXAM_FILE', 'Ảnh chỉ được đính kèm vào câu tự luận hợp lệ.');
      }
      return file;
    });
    const mobileUploadResult = mobileUploadTokens.length > 0
      ? await client.query(
        `SELECT token_hash, question_number, original_name, media_type, size_bytes, content
           FROM teacher_exam_mobile_upload_sessions
          WHERE session_id = $1 AND token_hash = ANY($2::text[])
            AND expires_at > now() AND content IS NOT NULL
          FOR UPDATE`,
        [sessionId, mobileUploadTokens.map((token) => hashMobileExamUploadToken(token))],
      )
      : { rows: [] };
    if (mobileUploadResult.rows.length !== mobileUploadTokens.length) {
      throw serviceError(409, 'SCHOOL_MOBILE_UPLOAD_SESSION_EXPIRED', 'Có ảnh điện thoại chưa tải lên hoặc mã tải ảnh đã hết hạn. Kiểm tra lại ảnh trước khi nộp.');
    }
    const mobileFiles = validateExamSubmissionFiles(mobileUploadResult.rows.map((row) => ({
      originalname: row.original_name,
      mimetype: row.media_type,
      buffer: row.content,
      questionNumber: row.question_number,
    })));
    if (validFiles.length + mobileFiles.length > EXAM_SUBMISSION_MAX_FILES) {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_FILES', 'Mỗi bài thi được đính kèm tối đa 5 ảnh.');
    }
    for (const file of mobileFiles) {
      if (file.questionNumber > questions.length
        || questionType(questions[file.questionNumber - 1]) !== 'essay') {
        throw serviceError(400, 'SCHOOL_INVALID_EXAM_FILE', 'Ảnh từ điện thoại không còn gắn với câu tự luận hợp lệ.');
      }
    }
    let automaticScores;
    try {
      automaticScores = automaticExamScores(questions, answers);
    } catch (error) {
      throw serviceError(409, 'SCHOOL_EXAM_INVALID_ANSWER_KEY', error.message);
    }
    const automaticTotal = Object.values(automaticScores).reduce((total, score) => total + score, 0);
    const manualQuestionIds = questions.flatMap((question, index) => (
      questionType(question) === 'essay' ? [questionId(question, index)] : []
    ));
    const answeredCount = new Set([
      ...Object.keys(answers),
      ...validFiles.map((file) => String(file.questionNumber)),
      ...mobileFiles.map((file) => String(file.questionNumber)),
    ]).size;
    const result = await client.query(
      `UPDATE teacher_exam_sessions s
          SET status = 'submitted', submitted_at = now(), last_activity_at = now(),
              answers = $3::jsonb,
              result = jsonb_build_object(
                'answered', $7::integer,
                'total', jsonb_array_length(r.payload->'examSnapshot'->'questions'),
                'submittedAt', now(),
                'automaticScores', $4::jsonb,
                'automaticTotal', $5::numeric,
                'manualQuestionIds', $6::jsonb
              )
         FROM teacher_exam_rooms r
        WHERE s.id = $1 AND s.student_user_id = $2 AND s.room_id = r.id
          AND r.school_id = $8
          AND s.status IN ('in-progress', 'review')
          AND now() <= s.started_at + make_interval(mins => (r.payload->>'durationMinutes')::int)
        RETURNING s.result`,
      [
        sessionId,
        auth.userId,
        JSON.stringify(answers),
        JSON.stringify(automaticScores),
        Math.round(automaticTotal * 100) / 100,
        JSON.stringify(manualQuestionIds),
        answeredCount,
        schoolId,
      ],
    );
    if (!result.rows[0]) {
      throw serviceError(409, 'SCHOOL_EXAM_SUBMISSION_UNAVAILABLE', 'Phiên thi đã nộp, hết giờ hoặc không thuộc tài khoản của em.');
    }
    for (const file of [...validFiles, ...mobileFiles]) {
      await client.query(
        `INSERT INTO teacher_exam_submission_files
           (id, session_id, question_number, original_name, media_type, size_bytes, content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(),
          sessionId,
          file.questionNumber,
          file.originalName,
          file.mediaType,
          file.buffer.length,
          file.buffer,
        ],
      );
    }
    await client.query(
      'DELETE FROM teacher_exam_mobile_upload_sessions WHERE session_id = $1',
      [sessionId],
    );
    await client.query('COMMIT');
    return result.rows[0].result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function validateExamSubmissionFiles(files) {
  if (!Array.isArray(files) || files.length > EXAM_SUBMISSION_MAX_FILES) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_FILES', 'Mỗi bài thi được đính kèm tối đa 5 ảnh.');
  }
  return files.map((file) => {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0
      || file.buffer.length > EXAM_SUBMISSION_MAX_FILE_BYTES
      || !Number.isInteger(file.questionNumber) || file.questionNumber < 1) {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_FILE', 'Mỗi ảnh phải có dung lượng tối đa 10 MB và gắn với câu tự luận.');
    }
    const metadata = validateResourceFile(file);
    if (!EXAM_SUBMISSION_IMAGE_TYPES.has(metadata.mediaType)) {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_FILE', 'Chỉ hỗ trợ ảnh JPG, PNG, GIF hoặc WebP.');
    }
    return { ...metadata, buffer: file.buffer, questionNumber: file.questionNumber };
  });
}

function validateTeacherExamGradeEvidenceFiles(files, essayQuestionIds) {
  if (!Array.isArray(files) || files.length > EXAM_SUBMISSION_MAX_FILES) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_GRADE_FILES', 'Mỗi bài thi được đính kèm tối đa 5 ảnh minh chứng.');
  }
  return files.map((file) => {
    if (!file || typeof file.questionId !== 'string' || file.questionId.trim().length === 0
      || file.questionId.length > 160 || !essayQuestionIds.has(file.questionId)) {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_GRADE_FILE', 'Ảnh minh chứng phải được gắn với một câu tự luận.');
    }
    if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0
      || file.buffer.length > EXAM_SUBMISSION_MAX_FILE_BYTES) {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_GRADE_FILE', 'Mỗi ảnh minh chứng phải có dung lượng tối đa 10 MB.');
    }
    const metadata = validateResourceFile(file);
    if (!EXAM_SUBMISSION_IMAGE_TYPES.has(metadata.mediaType)) {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_GRADE_FILE', 'Chỉ hỗ trợ ảnh JPG, PNG, GIF hoặc WebP.');
    }
    return { ...metadata, buffer: file.buffer, questionId: file.questionId };
  });
}

function teacherExamQuestions(payload) {
  const questions = payload?.examSnapshot?.questions;
  if (!Array.isArray(questions) || questions.length === 0
    || questions.some((question) => !question || typeof question.question !== 'string'
      || typeof question.points !== 'number' || !Number.isFinite(question.points) || question.points <= 0)) {
    throw serviceError(409, 'SCHOOL_EXAM_INVALID_SNAPSHOT', 'Đề thi trong phòng không có cấu trúc câu hỏi hợp lệ.');
  }
  return questions;
}

async function getTeacherExamRoomGrading(auth, roomId) {
  const schoolId = await getSingleActiveSchool(auth.userId, 'lecturer');
  const roomResult = await getPool().query(
    `SELECT payload
       FROM teacher_exam_rooms
      WHERE id = $1 AND teacher_user_id = $2 AND school_id = $3`,
    [roomId, auth.userId, schoolId],
  );
  const room = roomResult.rows[0]?.payload;
  if (!room) {
    throw serviceError(404, 'SCHOOL_EXAM_ROOM_NOT_FOUND', 'Không tìm thấy phòng thi trong phạm vi của bạn.');
  }
  const questions = teacherExamQuestions(room);
  if (!Array.isArray(room.classIds) || room.classIds.length === 0) {
    throw serviceError(409, 'SCHOOL_EXAM_INVALID_ROSTER', 'Phòng thi chưa có lớp học được giao.');
  }

  const result = await getPool().query(
    `SELECT DISTINCT ON (u.id)
            u.id AS student_id, u.full_name AS student_name, c.name AS class_name,
            s.id AS session_id, s.status, s.submitted_at, s.answers, s.result,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', f.id,
                'questionNumber', f.question_number,
                'name', f.original_name,
                'mediaType', f.media_type,
                'sizeBytes', f.size_bytes
              ) ORDER BY f.question_number, f.created_at, f.id)
                FROM teacher_exam_submission_files f
               WHERE f.session_id = s.id
            ), '[]'::json) AS files,
            g.question_scores, g.question_feedback, g.total_score, g.teacher_feedback,
            g.graded_at, g.published_at,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', ef.id,
                'questionId', ef.question_id,
                'name', ef.original_name,
                'mediaType', ef.media_type,
                'sizeBytes', ef.size_bytes
              ) ORDER BY ef.question_id, ef.created_at, ef.id)
                FROM teacher_exam_grade_evidence_files ef
               WHERE ef.session_id = s.id
            ), '[]'::json) AS grade_evidence_files
       FROM jsonb_array_elements_text($1::jsonb) selected(class_id)
       JOIN classes c
         ON c.id = selected.class_id::uuid AND c.school_id = $2 AND c.status = 'active'
       JOIN class_memberships cm ON cm.class_id = c.id AND cm.status = 'active'
       JOIN users u ON u.id = cm.student_user_id AND u.status = 'active' AND u.role = 'student'
       JOIN school_memberships sm
         ON sm.user_id = u.id AND sm.school_id = $2 AND sm.status = 'active'
       LEFT JOIN teacher_exam_sessions s
         ON s.room_id = $3 AND s.student_user_id = u.id AND s.class_id = c.id
       LEFT JOIN teacher_exam_session_grades g ON g.session_id = s.id
      ORDER BY u.id, (s.id IS NOT NULL) DESC, c.name`,
    [JSON.stringify(room.classIds), schoolId, roomId],
  );
  let students;
  try {
    students = result.rows.map((row) => ({
      studentId: row.student_id,
      studentName: row.student_name,
      className: row.class_name,
      sessionId: row.session_id,
      status: row.status ?? 'not-started',
      submittedAt: row.submitted_at?.toISOString() ?? null,
      answers: row.answers ?? {},
      files: row.files ?? [],
      automaticScores: row.status === 'submitted'
        ? row.result?.automaticScores ?? automaticExamScores(questions, row.answers ?? {})
        : {},
      grade: row.graded_at ? {
        questionScores: row.question_scores,
        questionFeedback: row.question_feedback ?? {},
        totalScore: Number(row.total_score),
        teacherFeedback: row.teacher_feedback,
        evidenceFiles: row.grade_evidence_files ?? [],
        gradedAt: row.graded_at.toISOString(),
        publishedAt: row.published_at?.toISOString() ?? null,
      } : null,
    }));
  } catch (error) {
    throw serviceError(409, 'SCHOOL_EXAM_INVALID_ANSWER_KEY', error.message);
  }
  const gradingRoom = {
    ...room,
    examSnapshot: {
      ...room.examSnapshot,
      questions: questions.map((question, index) => ({
        ...question,
        id: questionId(question, index),
        type: questionType(question),
        options: Array.isArray(question.options) ? question.options : [],
        correctIndex: Number.isInteger(question.correctIndex)
          ? question.correctIndex
          : Array.isArray(question.options) ? question.options.indexOf(question.correctAnswer) : -1,
        correctAnswer: typeof question.correctAnswer === 'string' ? question.correctAnswer : '',
      })),
    },
  };
  return { room: gradingRoom, students };
}

async function getTeacherExamSubmissionFile(auth, roomId, sessionId, fileId) {
  if (auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ giáo viên được xem tệp bài thi.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'lecturer');
  const result = await getPool().query(
    `SELECT f.original_name, f.media_type, f.size_bytes, f.content
       FROM teacher_exam_submission_files f
       JOIN teacher_exam_sessions s ON s.id = f.session_id AND s.status = 'submitted'
       JOIN teacher_exam_rooms r ON r.id = s.room_id AND r.teacher_user_id = $1
       JOIN schools sc ON sc.id = r.school_id AND sc.status = 'active'
      WHERE r.id = $2 AND s.id = $3 AND f.id = $4 AND r.school_id = $5`,
    [auth.userId, roomId, sessionId, fileId, schoolId],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_EXAM_FILE_NOT_FOUND', 'Không tìm thấy ảnh trong bài thi thuộc phòng của bạn.');
  }
  const row = result.rows[0];
  return {
    name: row.original_name,
    mediaType: row.media_type,
    sizeBytes: Number(row.size_bytes),
    content: row.content,
  };
}

async function getTeacherExamGradeEvidenceFile(auth, roomId, sessionId, fileId) {
  if (auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ giáo viên được xem ảnh minh chứng chấm bài.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'lecturer');
  const result = await getPool().query(
    `SELECT f.original_name, f.media_type, f.size_bytes, f.content
       FROM teacher_exam_grade_evidence_files f
       JOIN teacher_exam_session_grades g ON g.session_id = f.session_id
       JOIN teacher_exam_sessions s ON s.id = f.session_id AND s.status = 'submitted'
       JOIN teacher_exam_rooms r ON r.id = s.room_id AND r.teacher_user_id = $1
       JOIN schools sc ON sc.id = r.school_id AND sc.status = 'active'
      WHERE r.id = $2 AND s.id = $3 AND f.id = $4 AND r.school_id = $5`,
    [auth.userId, roomId, sessionId, fileId, schoolId],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_EXAM_GRADE_FILE_NOT_FOUND', 'Không tìm thấy ảnh minh chứng trong phạm vi phòng thi của bạn.');
  }
  const row = result.rows[0];
  return {
    name: row.original_name,
    mediaType: row.media_type,
    sizeBytes: Number(row.size_bytes),
    content: row.content,
  };
}

async function saveTeacherExamSessionGrade(auth, roomId, sessionId, input) {
  const schoolId = await getSingleActiveSchool(auth.userId, 'lecturer');
  const roomResult = await getPool().query(
    `SELECT payload
       FROM teacher_exam_rooms
      WHERE id = $1 AND teacher_user_id = $2 AND school_id = $3`,
    [roomId, auth.userId, schoolId],
  );
  const room = roomResult.rows[0]?.payload;
  if (!room) {
    throw serviceError(404, 'SCHOOL_EXAM_ROOM_NOT_FOUND', 'Không tìm thấy phòng thi trong phạm vi của bạn.');
  }
  const questions = teacherExamQuestions(room);
  if (!input || !input.questionScores || typeof input.questionScores !== 'object'
    || Array.isArray(input.questionScores)) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_GRADE', 'Điểm từng câu không đúng định dạng.');
  }
  if (typeof input.teacherFeedback !== 'string' || input.teacherFeedback.length > 5000) {
    throw serviceError(400, 'SCHOOL_INVALID_FEEDBACK', 'Nhận xét không được vượt quá 5.000 ký tự.');
  }
  const rawQuestionFeedback = input.questionFeedback ?? {};
  if (!rawQuestionFeedback || typeof rawQuestionFeedback !== 'object' || Array.isArray(rawQuestionFeedback)) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_FEEDBACK', 'Lời phê từng câu không đúng định dạng.');
  }
  const essayQuestionIds = new Set(questions.flatMap((question, index) => (
    questionType(question) === 'essay' ? [questionId(question, index)] : []
  )));
  const questionFeedback = {};
  for (const [key, value] of Object.entries(rawQuestionFeedback)) {
    if (!essayQuestionIds.has(key) || typeof value !== 'string' || value.length > 5000) {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_FEEDBACK', 'Lời phê chỉ được ghi cho câu tự luận và không vượt quá 5.000 ký tự.');
    }
    questionFeedback[key] = value.trim();
  }
  const evidenceFiles = validateTeacherExamGradeEvidenceFiles(input.evidenceFiles ?? [], essayQuestionIds);
  const deletedEvidenceIds = input.deletedEvidenceIds ?? [];
  if (!Array.isArray(deletedEvidenceIds) || deletedEvidenceIds.length > EXAM_SUBMISSION_MAX_FILES
    || deletedEvidenceIds.some((id) => typeof id !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    || new Set(deletedEvidenceIds).size !== deletedEvidenceIds.length) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_GRADE_FILES', 'Danh sách ảnh minh chứng cần xóa không hợp lệ.');
  }
  const questionScores = {};
  const answersResult = await getPool().query(
    `SELECT s.answers
       FROM teacher_exam_sessions s
       JOIN teacher_exam_rooms r ON r.id = s.room_id
      WHERE s.id = $2 AND r.id = $1 AND r.teacher_user_id = $4 AND r.school_id = $3
        AND s.status = 'submitted'`,
    [roomId, sessionId, schoolId, auth.userId],
  );
  const answers = answersResult.rows[0]?.answers;
  if (!answers) {
    throw serviceError(409, 'SCHOOL_EXAM_SUBMISSION_NOT_GRADEABLE', 'Chỉ có thể chấm bài thi đã nộp thuộc phòng của bạn.');
  }
  let automaticScores;
  try {
    automaticScores = automaticExamScores(questions, answers);
  } catch (error) {
    throw serviceError(409, 'SCHOOL_EXAM_INVALID_ANSWER_KEY', error.message);
  }
  for (const [questionId, score] of Object.entries(automaticScores)) {
    if (input.questionScores[questionId] !== score) {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_GRADE', 'Điểm câu trắc nghiệm, đúng/sai và trả lời ngắn phải theo kết quả tự chấm.');
    }
    questionScores[questionId] = score;
  }

  let totalScore = 0;
  for (const [index, question] of questions.entries()) {
    const key = questionId(question, index);
    if (questionType(question) !== 'essay') continue;
    const score = input.questionScores[key];
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > question.points) {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_GRADE', `Điểm câu ${index + 1} phải từ 0 đến ${question.points}.`);
    }
    questionScores[key] = Math.round(score * 100) / 100;
  }
  if (Object.keys(input.questionScores).length !== questions.length) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_GRADE', 'Cần chấm điểm đầy đủ tất cả câu hỏi.');
  }
  totalScore = questions.reduce((total, question, index) => (
    total + questionScores[questionId(question, index)]
  ), 0);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const sessionResult = await client.query(
      `SELECT s.id
         FROM teacher_exam_sessions s
         JOIN teacher_exam_rooms r ON r.id = s.room_id
        WHERE s.id = $2 AND r.id = $1 AND r.teacher_user_id = $4 AND r.school_id = $3
          AND s.status = 'submitted'
        FOR UPDATE OF s`,
      [roomId, sessionId, schoolId, auth.userId],
    );
    if (!sessionResult.rows[0]) {
      throw serviceError(409, 'SCHOOL_EXAM_SUBMISSION_NOT_GRADEABLE', 'Chỉ có thể chấm bài thi đã nộp thuộc phòng của bạn.');
    }
    const existingEvidenceResult = await client.query(
      `SELECT id
         FROM teacher_exam_grade_evidence_files
        WHERE session_id = $1
        FOR UPDATE`,
      [sessionId],
    );
    const existingEvidenceIds = new Set(existingEvidenceResult.rows.map((row) => row.id));
    if (deletedEvidenceIds.some((id) => !existingEvidenceIds.has(id))) {
      throw serviceError(409, 'SCHOOL_EXAM_GRADE_FILE_CHANGED', 'Danh sách ảnh minh chứng đã thay đổi. Tải lại bài chấm rồi thử lại.');
    }
    if (existingEvidenceIds.size - deletedEvidenceIds.length + evidenceFiles.length > EXAM_SUBMISSION_MAX_FILES) {
      throw serviceError(400, 'SCHOOL_INVALID_EXAM_GRADE_FILES', 'Mỗi bài thi được lưu tối đa 5 ảnh minh chứng.');
    }

    const result = await client.query(
      `INSERT INTO teacher_exam_session_grades
         (session_id, grader_user_id, question_scores, question_feedback, total_score, teacher_feedback)
       SELECT s.id, $4, $5::jsonb, $6::jsonb, $7, $8
         FROM teacher_exam_sessions s
         JOIN teacher_exam_rooms r ON r.id = s.room_id
        WHERE s.id = $2 AND r.id = $1 AND r.teacher_user_id = $4 AND r.school_id = $3
          AND s.status = 'submitted'
       ON CONFLICT (session_id)
       DO UPDATE SET grader_user_id = EXCLUDED.grader_user_id,
                     question_scores = EXCLUDED.question_scores,
                     question_feedback = EXCLUDED.question_feedback,
                     total_score = EXCLUDED.total_score,
                     teacher_feedback = EXCLUDED.teacher_feedback,
                     graded_at = now()
       RETURNING question_scores, question_feedback, total_score, teacher_feedback, graded_at, published_at`,
      [
        roomId, sessionId, schoolId, auth.userId, JSON.stringify(questionScores),
        JSON.stringify(questionFeedback), totalScore, input.teacherFeedback.trim(),
      ],
    );
    if (!result.rows[0]) {
      throw serviceError(409, 'SCHOOL_EXAM_SUBMISSION_NOT_GRADEABLE', 'Chỉ có thể chấm bài thi đã nộp thuộc phòng của bạn.');
    }
    if (deletedEvidenceIds.length > 0) {
      await client.query(
        `DELETE FROM teacher_exam_grade_evidence_files
          WHERE session_id = $1 AND id = ANY($2::uuid[])`,
        [sessionId, deletedEvidenceIds],
      );
    }
    for (const file of evidenceFiles) {
      await client.query(
        `INSERT INTO teacher_exam_grade_evidence_files
           (id, session_id, question_id, original_name, media_type, size_bytes, content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(), sessionId, file.questionId, file.originalName, file.mediaType,
          file.buffer.length, file.buffer,
        ],
      );
    }
    const savedEvidenceResult = await client.query(
      `SELECT id, question_id, original_name, media_type, size_bytes
         FROM teacher_exam_grade_evidence_files
        WHERE session_id = $1
        ORDER BY question_id, created_at, id`,
      [sessionId],
    );
    await client.query('COMMIT');
    const grade = result.rows[0];
    return {
      questionScores: grade.question_scores,
      questionFeedback: grade.question_feedback,
      totalScore: Number(grade.total_score),
      teacherFeedback: grade.teacher_feedback,
      evidenceFiles: savedEvidenceResult.rows.map((file) => ({
        id: file.id,
        questionId: file.question_id,
        name: file.original_name,
        mediaType: file.media_type,
        sizeBytes: Number(file.size_bytes),
      })),
      gradedAt: grade.graded_at.toISOString(),
      publishedAt: grade.published_at?.toISOString() ?? null,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function saveTeacherExamRoom(auth, room) {
  const validated = validateTeacherExamRoom(room);
  const schoolId = await getSingleActiveSchool(auth.userId, 'lecturer');
  const existingResult = await getPool().query(
    `SELECT payload
       FROM teacher_exam_rooms
      WHERE teacher_user_id = $1 AND school_id = $2 AND id = $3`,
    [auth.userId, schoolId, validated.id],
  );
  const existingRoom = existingResult.rows[0]?.payload;
  let exam;
  if (existingRoom?.examId === room.examId) {
    exam = existingRoom.examSnapshot;
  } else {
    const examResult = await getPool().query(
      `SELECT payload
         FROM teacher_assessments
        WHERE teacher_user_id = $1 AND school_id = $2 AND kind = 'exam' AND client_id = $3`,
      [auth.userId, schoolId, room.examId],
    );
    const examRow = examResult.rows[0];
    if (examRow?.payload) {
      const questions = examRow.payload.questions.map((question, index) => ({
        ...question,
        id: typeof question.id === 'string' && question.id.trim() ? question.id : `question-${index + 1}`,
        type: ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(question.type)
          ? question.type
          : 'multiple-choice',
      }));
      exam = {
        ...examRow.payload,
        questions,
        sections: examRow.sections?.length
          ? examRow.sections
          : Array.isArray(examRow.payload.sections) && examRow.payload.sections.length > 0
            ? examRow.payload.sections
            : defaultAssessmentSections(questions),
      };
    }
    if (!exam || exam.status !== 'ready' || !Array.isArray(exam.questions) || exam.questions.length === 0) {
      throw serviceError(400, 'SCHOOL_EXAM_NOT_READY', 'Chỉ có thể cấu hình phòng bằng đề đã sẵn sàng sử dụng.');
    }
  }

  const classDetails = await Promise.all(room.classIds.map(async (classId) => {
    const classroom = await getClass(auth, classId);
    const students = await listClassStudents(auth, classId);
    return { classroom, studentCount: students.length };
  }));
  const savedRoom = {
    ...room,
    id: validated.id,
    title: validated.title,
    code: existingRoom?.code ?? generateTeacherExamRoomCode(),
    startsAt: validated.startsAt,
    settings: validated.settings,
    organizer: 'Giáo viên',
    classNames: classDetails.map(({ classroom }) => classroom.name),
    studentCount: classDetails.reduce((total, item) => total + item.studentCount, 0),
    examSnapshot: exam,
    sessions: [],
    isDemo: false,
  };
  const result = await getPool().query(
    `INSERT INTO teacher_exam_rooms
       (id, teacher_user_id, school_id, code, title, status, starts_at, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (teacher_user_id, id)
     DO UPDATE SET code = EXCLUDED.code, title = EXCLUDED.title, status = EXCLUDED.status,
                   starts_at = EXCLUDED.starts_at, payload = EXCLUDED.payload, updated_at = now()
       WHERE teacher_exam_rooms.school_id = EXCLUDED.school_id
     RETURNING payload`,
    [validated.id, auth.userId, schoolId, savedRoom.code, validated.title, room.status, validated.startsAt, JSON.stringify(savedRoom)],
  );
  if (!result.rows[0]) {
    throw serviceError(404, 'SCHOOL_EXAM_ROOM_NOT_FOUND', 'Không tìm thấy phòng thi trong phạm vi của bạn.');
  }
  return result.rows[0].payload;
}

async function deleteTeacherExamRoom(auth, roomId) {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof roomId !== 'string' || !uuidPattern.test(roomId)) {
    throw serviceError(400, 'SCHOOL_INVALID_EXAM_ROOM', 'Mã phòng thi không hợp lệ.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'lecturer');
  const result = await getPool().query(
    `DELETE FROM teacher_exam_rooms
      WHERE id = $1 AND teacher_user_id = $2 AND school_id = $3`,
    [roomId, auth.userId, schoolId],
  );
  return result.rowCount > 0;
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
              s.name AS school_name, false AS is_homeroom, NULL::text AS homeroom_subject
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
              s.name AS school_name, false AS is_homeroom, NULL::text AS homeroom_subject,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'subject', cs.subject,
                  'teacherName', (
                    SELECT teacher.full_name
                      FROM teacher_class_assignments tca
                      JOIN users teacher ON teacher.id = tca.teacher_user_id
                      JOIN school_memberships sm
                        ON sm.user_id = teacher.id AND sm.school_id = c.school_id AND sm.status = 'active'
                     WHERE tca.class_id = c.id AND tca.school_id = c.school_id
                       AND lower(trim(tca.subject)) = lower(trim(cs.subject))
                       AND tca.revoked_at IS NULL
                     ORDER BY tca.created_at
                     LIMIT 1
                  ),
                  'teacherGender', (
                    SELECT teacher_profile.gender
                      FROM teacher_class_assignments tca
                      JOIN teacher_profiles teacher_profile ON teacher_profile.user_id = tca.teacher_user_id
                      JOIN school_memberships sm
                        ON sm.user_id = tca.teacher_user_id AND sm.school_id = c.school_id AND sm.status = 'active'
                     WHERE tca.class_id = c.id AND tca.school_id = c.school_id
                       AND lower(trim(tca.subject)) = lower(trim(cs.subject))
                       AND tca.revoked_at IS NULL
                     ORDER BY tca.created_at
                     LIMIT 1
                  )
                ) ORDER BY cs.subject)
                  FROM class_subjects cs
                 WHERE cs.class_id = c.id AND cs.school_id = c.school_id
              ), '[]'::json) AS subjects
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
              s.name AS school_name,
              EXISTS (
                SELECT 1 FROM class_homeroom_assignments hra
                 WHERE hra.class_id = c.id AND hra.teacher_user_id = $1
              ) AS is_homeroom,
              (SELECT hra.subject FROM class_homeroom_assignments hra
                WHERE hra.class_id = c.id AND hra.teacher_user_id = $1) AS homeroom_subject,
              (SELECT count(*)::int FROM class_memberships cm
                WHERE cm.class_id = c.id AND cm.status = 'active') AS student_count,
              (SELECT avg(COALESCE(
                       grade.confirmed_average::float8,
                       (
                         COALESCE(grade.regular_1, 0)
                         + COALESCE(grade.regular_2, 0)
                         + COALESCE(grade.regular_3, 0)
                         + COALESCE(grade.regular_4, 0)
                         + 2 * COALESCE(grade.midterm, 0)
                         + 3 * COALESCE(grade.final, 0)
                       ) / NULLIF(
                         CASE WHEN grade.regular_1 IS NOT NULL THEN 1 ELSE 0 END
                         + CASE WHEN grade.regular_2 IS NOT NULL THEN 1 ELSE 0 END
                         + CASE WHEN grade.regular_3 IS NOT NULL THEN 1 ELSE 0 END
                         + CASE WHEN grade.regular_4 IS NOT NULL THEN 1 ELSE 0 END
                         + 2 * CASE WHEN grade.midterm IS NOT NULL THEN 1 ELSE 0 END
                         + 3 * CASE WHEN grade.final IS NOT NULL THEN 1 ELSE 0 END,
                         0
                       )
                     ))::float8
                 FROM student_term_grades grade
                 JOIN class_memberships cm ON cm.class_id = grade.class_id
                  AND cm.student_user_id = grade.student_user_id AND cm.status = 'active'
                WHERE grade.class_id = c.id AND grade.academic_year = c.academic_year
                  AND EXISTS (
                    SELECT 1 FROM teacher_class_assignments taught_subject
                     WHERE taught_subject.class_id = c.id
                       AND taught_subject.teacher_user_id = $1
                       AND taught_subject.school_id = c.school_id
                       AND taught_subject.revoked_at IS NULL
                       AND lower(trim(taught_subject.subject)) = lower(trim(grade.subject))
                  )
                  AND (
                    grade.confirmed_average IS NOT NULL
                    OR grade.regular_1 IS NOT NULL OR grade.regular_2 IS NOT NULL
                    OR grade.regular_3 IS NOT NULL OR grade.regular_4 IS NOT NULL
                    OR grade.midterm IS NOT NULL OR grade.final IS NOT NULL
                  )
                  AND grade.semester = (
                    SELECT history.semester
                      FROM student_term_grades history
                     WHERE history.class_id = c.id AND history.academic_year = c.academic_year
                       AND EXISTS (
                         SELECT 1 FROM teacher_class_assignments taught_subject
                          WHERE taught_subject.class_id = c.id
                            AND taught_subject.teacher_user_id = $1
                            AND taught_subject.school_id = c.school_id
                            AND taught_subject.revoked_at IS NULL
                            AND lower(trim(taught_subject.subject)) = lower(trim(history.subject))
                       )
                       AND (
                         history.confirmed_average IS NOT NULL
                         OR history.regular_1 IS NOT NULL OR history.regular_2 IS NOT NULL
                         OR history.regular_3 IS NOT NULL OR history.regular_4 IS NOT NULL
                         OR history.midterm IS NOT NULL OR history.final IS NOT NULL
                       )
                     ORDER BY CASE history.semester WHEN 'Kỳ 2' THEN 2 ELSE 1 END DESC
                     LIMIT 1
                  )) AS class_average,
              (SELECT count(*)::int
                 FROM class_assignments assignment
                WHERE assignment.class_id = c.id
                  AND EXISTS (
                    SELECT 1
                      FROM class_memberships cm
                      LEFT JOIN class_assignment_submissions submission
                        ON submission.assignment_id = assignment.id
                       AND submission.student_user_id = cm.student_user_id
                     WHERE cm.class_id = c.id AND cm.status = 'active'
                       AND (submission.id IS NULL OR submission.submitted_at IS NULL)
                  )) AS pending_assignment_count
         FROM classes c
         JOIN schools s ON s.id = c.school_id
        WHERE c.school_id = $2 AND c.status = 'active' AND s.status = 'active'
          AND (
            EXISTS (
              SELECT 1 FROM teacher_class_assignments tca
               WHERE tca.class_id = c.id AND tca.teacher_user_id = $1 AND tca.revoked_at IS NULL
            )
            OR EXISTS (
              SELECT 1 FROM class_homeroom_assignments hra
               WHERE hra.class_id = c.id AND hra.teacher_user_id = $1
            )
          )
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
              s.name AS school_name, false AS is_homeroom, NULL::text AS homeroom_subject
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
              s.name AS school_name, false AS is_homeroom, NULL::text AS homeroom_subject
         FROM class_memberships cm
         JOIN classes c ON c.id = cm.class_id
         JOIN schools s ON s.id = c.school_id
        WHERE c.id = $1 AND cm.student_user_id = $2 AND cm.status = 'active'
          AND c.school_id = $3 AND c.status = 'active' AND s.status = 'active'`,
      [classId, auth.userId, schoolId],
    )
    : await pool.query(
      `SELECT c.id, c.school_id, c.code, c.name, c.grade, c.academic_year, c.status,
              s.name AS school_name,
              EXISTS (
                SELECT 1 FROM class_homeroom_assignments hra
                 WHERE hra.class_id = c.id AND hra.teacher_user_id = $2
              ) AS is_homeroom,
              (SELECT hra.subject FROM class_homeroom_assignments hra
                WHERE hra.class_id = c.id AND hra.teacher_user_id = $2) AS homeroom_subject
         FROM classes c
         JOIN schools s ON s.id = c.school_id
        WHERE c.id = $1 AND c.school_id = $3 AND c.status = 'active' AND s.status = 'active'
          AND (
            EXISTS (
              SELECT 1 FROM teacher_class_assignments tca
               WHERE tca.class_id = c.id AND tca.teacher_user_id = $2 AND tca.revoked_at IS NULL
            )
            OR EXISTS (
              SELECT 1 FROM class_homeroom_assignments hra
               WHERE hra.class_id = c.id AND hra.teacher_user_id = $2
            )
          )`,
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

async function getHomeroomClassGradeSummary(auth, classId, { academicYear, semester }) {
  if (auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ giáo viên chủ nhiệm được xem tổng hợp điểm liên môn.');
  }
  if (typeof academicYear !== 'string' || academicYear.trim().length < 4 || academicYear.length > 20
    || !['Kỳ 1', 'Kỳ 2'].includes(semester)) {
    throw serviceError(400, 'SCHOOL_INVALID_PERIOD', 'Năm học hoặc học kỳ không hợp lệ.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, auth.role);
  const classroomResult = await getPool().query(
    `SELECT c.id, c.academic_year, hra.subject AS homeroom_subject
       FROM class_homeroom_assignments hra
       JOIN classes c ON c.id = hra.class_id AND c.school_id = hra.school_id
       JOIN schools s ON s.id = c.school_id AND s.status = 'active'
      WHERE c.id = $1 AND hra.teacher_user_id = $2 AND c.school_id = $3
        AND c.status = 'active'`,
    [classId, auth.userId, schoolId],
  );
  if (!classroomResult.rowCount) {
    throw serviceError(404, 'SCHOOL_HOMEROOM_CLASS_NOT_FOUND', 'Không tìm thấy lớp chủ nhiệm trong phạm vi truy cập.');
  }
  const classroom = classroomResult.rows[0];
  if (classroom.academic_year !== academicYear) {
    throw serviceError(400, 'SCHOOL_INVALID_PERIOD', 'Năm học không khớp với năm học của lớp.');
  }
  await listClassStudents(auth, classId);

  const result = await getPool().query(
    `SELECT u.id, u.full_name, cs.subject,
            g.regular_1, g.regular_2, g.regular_3, g.regular_4, g.midterm, g.final,
            g.confirmed_average
       FROM class_memberships cm
       JOIN users u ON u.id = cm.student_user_id AND u.status = 'active'
       JOIN class_subjects cs ON cs.class_id = cm.class_id AND cs.school_id = $4
       LEFT JOIN student_term_grades g
         ON g.class_id = cm.class_id AND g.student_user_id = cm.student_user_id
        AND lower(trim(g.subject)) = lower(trim(cs.subject))
        AND g.academic_year = $2 AND g.semester = $3
      WHERE cm.class_id = $1 AND cm.status = 'active'
      ORDER BY u.full_name, u.id, cs.subject`,
    [classId, academicYear, semester, schoolId],
  );
  const students = new Map();
  const subjects = new Set();
  for (const row of result.rows) {
    subjects.add(row.subject);
    const student = students.get(row.id) ?? { id: row.id, fullName: row.full_name, averages: {} };
    const grades = mapGrade(row, '');
    const scores = [
      ...grades.regular.map((value) => ({ value, weight: 1 })),
      { value: grades.midterm, weight: 2 },
      { value: grades.final, weight: 3 },
    ].filter(({ value }) => value !== null);
    const totalWeight = scores.reduce((sum, score) => sum + score.weight, 0);
    student.averages[row.subject] = row.confirmed_average === null
      ? totalWeight
        ? scores.reduce((sum, score) => sum + score.value * score.weight, 0) / totalWeight
        : null
      : Number(row.confirmed_average);
    students.set(row.id, student);
  }
  return {
    classId,
    academicYear,
    semester,
    homeroomSubject: classroom.homeroom_subject,
    subjects: Array.from(subjects).sort((first, second) => first.localeCompare(second, 'vi')),
    students: Array.from(students.values()),
  };
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
  const result = await getPool().query(
    `SELECT u.id, u.full_name, u.email, sp.grade, sp.student_number,
            g.regular_1, g.regular_2, g.regular_3, g.regular_4, g.midterm, g.final,
            g.confirmed_average, g.previous_confirmed_average,
            grade_history.average_history,
            assignment_stats.total_assignments, assignment_stats.submitted_assignments,
            assignment_stats.overdue_missing
       FROM class_memberships cm
       JOIN users u ON u.id = cm.student_user_id AND u.status = 'active'
       JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN student_term_grades g
         ON g.class_id = cm.class_id AND g.student_user_id = cm.student_user_id
        AND g.subject = $2 AND g.academic_year = $3 AND g.semester = $4
       LEFT JOIN LATERAL (
         SELECT COALESCE(
                  json_agg(
                    json_build_object('average', history.average, 'recordedAt', history.recorded_at)
                    ORDER BY history.recorded_at, history.id
                  ),
                  '[]'::json
                ) AS average_history
           FROM student_term_grade_history history
          WHERE history.class_id = cm.class_id AND history.student_user_id = cm.student_user_id
            AND history.subject = $2 AND history.academic_year = $3 AND history.semester = $4
       ) grade_history ON true
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
           WHERE tca.class_id = cm.class_id AND tca.teacher_user_id = $5
             AND tca.school_id = $6 AND lower(trim(tca.subject)) = lower(trim($2))
             AND tca.revoked_at IS NULL
        )
      ORDER BY u.full_name, u.email`,
    [
      classroom.id,
      subject.trim(),
      academicYear,
      semester,
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
    confirmedAverage: row.confirmed_average === null ? null : Number(row.confirmed_average),
    previousConfirmedAverage: row.previous_confirmed_average === null
      ? null
      : Number(row.previous_confirmed_average),
    averageHistory: row.average_history.map((snapshot) => ({
      average: Number(snapshot.average),
      recordedAt: new Date(snapshot.recordedAt).toISOString(),
    })),
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

function validateStudentGradeEntry(entry) {
  const { regular, midterm, final } = entry;
  if (!Array.isArray(regular) || regular.length !== 4) {
    throw serviceError(400, 'SCHOOL_INVALID_GRADE', 'Cần cung cấp đúng 4 điểm thường xuyên.');
  }
  regular.forEach((value, index) => validateScore(value, `Điểm thường xuyên ${index + 1}`));
  validateScore(midterm, 'Điểm giữa kỳ');
  validateScore(final, 'Điểm cuối kỳ');
  const scores = [
    ...regular.map((value) => ({ value, weight: 1 })),
    { value: midterm, weight: 2 },
    { value: final, weight: 3 },
  ].filter(({ value }) => value !== null);
  const totalWeight = scores.reduce((sum, score) => sum + score.weight, 0);
  return totalWeight
    ? Number((scores.reduce((sum, score) => sum + score.value * score.weight, 0) / totalWeight).toFixed(2))
    : null;
}

async function upsertStudentGrades(client, auth, classroom, period, studentId, entry, average) {
  const { academicYear, semester, subject } = period;
  const { regular, midterm, final } = entry;
  const result = await client.query(
    `WITH saved AS (
       INSERT INTO student_term_grades
         (id, class_id, school_id, student_user_id, subject, academic_year, semester,
          regular_1, regular_2, regular_3, regular_4, midterm, final,
          confirmed_average, created_by, updated_by)
       SELECT $1, $2, $3, cm.student_user_id, $4, $5, $6, $7, $8, $9, $10, $11, $12, $15, $13, $13
         FROM class_memberships cm
        WHERE cm.class_id = $2 AND cm.student_user_id = $14 AND cm.status = 'active'
          AND EXISTS (
            SELECT 1 FROM teacher_class_assignments tca
             WHERE tca.class_id = cm.class_id AND tca.teacher_user_id = $13
               AND tca.school_id = $3 AND lower(trim(tca.subject)) = lower(trim($4))
               AND tca.revoked_at IS NULL
          )
       ON CONFLICT (class_id, student_user_id, subject, academic_year, semester)
       DO UPDATE SET previous_confirmed_average = student_term_grades.confirmed_average,
                     regular_1 = EXCLUDED.regular_1, regular_2 = EXCLUDED.regular_2,
                     regular_3 = EXCLUDED.regular_3, regular_4 = EXCLUDED.regular_4,
                     midterm = EXCLUDED.midterm, final = EXCLUDED.final,
                     confirmed_average = EXCLUDED.confirmed_average,
                     updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING class_id, school_id, student_user_id, subject, academic_year, semester,
                 confirmed_average, previous_confirmed_average, updated_by, updated_at
     ), history AS (
       INSERT INTO student_term_grade_history
         (id, class_id, school_id, student_user_id, subject, academic_year, semester,
          average, recorded_by, recorded_at)
       SELECT gen_random_uuid(), class_id, school_id, student_user_id, subject, academic_year, semester,
              confirmed_average, updated_by, updated_at
         FROM saved
        WHERE confirmed_average IS NOT NULL
          AND confirmed_average IS DISTINCT FROM previous_confirmed_average
       RETURNING id
     )
     SELECT confirmed_average FROM saved`,
    [
      randomUUID(), classroom.id, classroom.school_id, subject.trim(), academicYear, semester,
      ...regular, midterm, final, auth.userId, studentId, average,
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_STUDENT_NOT_FOUND', 'Không tìm thấy học sinh đang theo học lớp này.');
  }
  return result.rows[0].confirmed_average === null ? null : Number(result.rows[0].confirmed_average);
}

async function validateTeacherGradebookRequest(auth, classId, input) {
  const { academicYear, semester, subject } = input;
  validatePeriod(academicYear, semester, subject);
  const classroom = await requireTeacherSubject(auth, classId, subject);
  validateClassAcademicYear(classroom, academicYear);
  return classroom;
}

async function saveStudentGrades(auth, classId, studentId, input) {
  const classroom = await validateTeacherGradebookRequest(auth, classId, input);
  const average = validateStudentGradeEntry(input);
  return upsertStudentGrades(
    getPool(),
    auth,
    classroom,
    input,
    studentId,
    input,
    average,
  );
}

async function saveClassGradebook(auth, classId, input) {
  const { academicYear, semester, subject, entries } = input;
  const classroom = await validateTeacherGradebookRequest(auth, classId, input);
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 500) {
    throw serviceError(400, 'SCHOOL_INVALID_GRADE', 'Cần cung cấp từ 1 đến 500 dòng điểm để lưu.');
  }
  const studentIds = new Set();
  const preparedEntries = entries.map((entry) => {
    if (!entry || typeof entry.studentId !== 'string' || studentIds.has(entry.studentId)) {
      throw serviceError(400, 'SCHOOL_INVALID_GRADE', 'Danh sách học sinh lưu điểm không hợp lệ hoặc bị trùng.');
    }
    studentIds.add(entry.studentId);
    return { entry, average: validateStudentGradeEntry(entry) };
  });
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const roster = await client.query(
      `SELECT student_user_id
         FROM class_memberships
        WHERE class_id = $1 AND status = 'active' AND student_user_id = ANY($2::uuid[])
        FOR UPDATE`,
      [classroom.id, Array.from(studentIds)],
    );
    if (roster.rowCount !== studentIds.size) {
      throw serviceError(404, 'SCHOOL_STUDENT_NOT_FOUND', 'Có học sinh không còn theo học trong lớp này.');
    }
    const savedAverages = [];
    for (const { entry, average } of preparedEntries) {
      const savedAverage = await upsertStudentGrades(
        client,
        auth,
        classroom,
        { academicYear, semester, subject },
        entry.studentId,
        entry,
        average,
      );
      savedAverages.push({ studentId: entry.studentId, average: savedAverage });
    }
    await client.query('COMMIT');
    return savedAverages;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
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
                  'score', s.score,
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
    `SELECT subject, academic_year, description
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

function assignmentQuestionCount(description) {
  const noteMatch = description.match(/(?:^|\n{2,})Lời nhắn của giáo viên:[ \t]*\r?\n[\s\S]*$/i);
  const questionContent = noteMatch ? description.slice(0, noteMatch.index) : description;
  return Array.from(questionContent.matchAll(/^[ \t]*Câu[ \t]*\d+[ \t]*(?:[-–—:.)][ \t]*|$)/gim)).length;
}

function assignmentQuestionMaximums(questionCount) {
  if (!questionCount) return [];
  const baseCents = Math.floor(1000 / questionCount);
  const remainingCents = 1000 - baseCents * questionCount;
  return Array.from({ length: questionCount }, (_, index) => (
    (baseCents + (index < remainingCents ? 1 : 0)) / 100
  ));
}

async function listClassAssignmentSubmissions(auth, classId, assignmentId) {
  await findTeacherAssignment(auth, classId, assignmentId);
  const students = await listClassStudents(auth, classId);
  const result = await getPool().query(
    `SELECT u.id, u.full_name, s.response_text, s.submitted_at,
            s.score, s.teacher_feedback, s.question_scores, s.question_feedback, s.graded_at,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', f.id, 'name', f.original_name, 'mediaType', f.media_type, 'sizeBytes', f.size_bytes
              ) ORDER BY f.created_at, f.id)
                FROM class_assignment_submission_files f
               WHERE f.submission_id = s.id
            ), '[]'::json) AS files
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
        questionScores: row.question_scores ?? {},
        questionFeedback: row.question_feedback ?? {},
        gradedAt: row.graded_at?.toISOString() ?? null,
        files: row.files,
      })),
  };
}

async function saveClassAssignmentGrade(auth, classId, assignmentId, studentId, input) {
  let score = input.score;
  const teacherFeedback = input.teacherFeedback;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 10) {
    throw serviceError(400, 'SCHOOL_INVALID_GRADE', 'Điểm phải là số từ 0 đến 10.');
  }
  if (typeof teacherFeedback !== 'string' || teacherFeedback.length > 5000) {
    throw serviceError(400, 'SCHOOL_INVALID_FEEDBACK', 'Nhận xét không được vượt quá 5.000 ký tự.');
  }
  const assignment = await findTeacherAssignment(auth, classId, assignmentId);
  let questionScores = null;
  let questionFeedback = null;
  if (input.questionScores !== undefined) {
    const maximums = assignmentQuestionMaximums(assignmentQuestionCount(assignment.description));
    if (!maximums.length || !input.questionScores || typeof input.questionScores !== 'object'
      || Array.isArray(input.questionScores)) {
      throw serviceError(400, 'SCHOOL_INVALID_ASSIGNMENT_QUESTION_GRADE', 'Điểm từng câu không đúng định dạng.');
    }
    const scoreEntries = Object.entries(input.questionScores);
    if (scoreEntries.length !== maximums.length
      || scoreEntries.some(([key, value]) => !/^(0|[1-9]\d*)$/.test(key)
        || Number(key) >= maximums.length
        || typeof value !== 'number'
        || !Number.isFinite(value)
        || value < 0
        || value > maximums[Number(key)])) {
      throw serviceError(400, 'SCHOOL_INVALID_ASSIGNMENT_QUESTION_GRADE', 'Điểm từng câu phải nằm trong giới hạn và cần chấm đủ tất cả câu.');
    }
    questionScores = Object.fromEntries(scoreEntries.map(([key, value]) => [
      key,
      Math.round(value * 100) / 100,
    ]));
    const questionTotal = Object.values(questionScores).reduce((total, value) => total + value, 0);
    score = Math.round(questionTotal * 100) / 100;
    if (Math.abs(score - input.score) > 0.01) {
      throw serviceError(400, 'SCHOOL_INVALID_ASSIGNMENT_QUESTION_GRADE', 'Điểm tổng phải bằng tổng điểm các câu.');
    }

    const rawFeedback = input.questionFeedback ?? {};
    if (!rawFeedback || typeof rawFeedback !== 'object' || Array.isArray(rawFeedback)) {
      throw serviceError(400, 'SCHOOL_INVALID_ASSIGNMENT_QUESTION_FEEDBACK', 'Lời phê từng câu không đúng định dạng.');
    }
    const feedbackEntries = Object.entries(rawFeedback);
    if (feedbackEntries.some(([key, value]) => !/^(0|[1-9]\d*)$/.test(key)
      || Number(key) >= maximums.length
      || typeof value !== 'string'
      || value.length > 5000)) {
      throw serviceError(400, 'SCHOOL_INVALID_ASSIGNMENT_QUESTION_FEEDBACK', 'Lời phê từng câu không hợp lệ hoặc vượt quá 5.000 ký tự.');
    }
    questionFeedback = Object.fromEntries(feedbackEntries.map(([key, value]) => [key, value.trim()]));
  }
  const result = await getPool().query(
    `UPDATE class_assignment_submissions s
        SET score = $4, teacher_feedback = $5, graded_by = $6, graded_at = now(), updated_at = now(),
            question_scores = COALESCE($7::jsonb, s.question_scores),
            question_feedback = COALESCE($8::jsonb, s.question_feedback)
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
     RETURNING s.score, s.teacher_feedback, s.question_scores, s.question_feedback, s.graded_at`,
    [
      assignmentId,
      classId,
      studentId,
      score,
      teacherFeedback.trim(),
      auth.userId,
      questionScores === null ? null : JSON.stringify(questionScores),
      questionFeedback === null ? null : JSON.stringify(questionFeedback),
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_SUBMISSION_NOT_FOUND', 'Không tìm thấy bài nộp của học sinh đang theo học lớp này.');
  }
  const row = result.rows[0];
  return {
    score: Number(row.score),
    teacherFeedback: row.teacher_feedback,
    questionScores: row.question_scores ?? {},
    questionFeedback: row.question_feedback ?? {},
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

async function updateClassAssignment(auth, classId, assignmentId, input) {
  const current = await findTeacherAssignment(auth, classId, assignmentId);
  const title = input.title;
  const description = input.description;
  const chapter = input.chapter;
  const lesson = input.lesson;
  const period = input.period ?? null;
  const dueAt = input.dueAt;
  if (typeof title !== 'string' || title.trim().length === 0 || title.trim().length > 200
    || typeof description !== 'string' || description.length > 5000
    || typeof chapter !== 'string' || chapter.length > 160
    || typeof lesson !== 'string' || lesson.length > 200
    || (period !== null && (typeof period !== 'string' || period.length > 80))
    || typeof dueAt !== 'string' || !Number.isFinite(Date.parse(dueAt))) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSIGNMENT', 'Thông tin bài tập không hợp lệ.');
  }
  const classroom = await requireTeacherSubject(auth, classId, current.subject);
  validateClassAcademicYear(classroom, current.academic_year);
  const result = await getPool().query(
    `UPDATE class_assignments a
        SET title = $4, description = $5, chapter = $6, lesson = $7,
            period = $8, due_at = $9
      WHERE a.id = $1 AND a.class_id = $2 AND a.teacher_user_id = $3
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = a.class_id AND tca.teacher_user_id = a.teacher_user_id
             AND tca.school_id = a.school_id
             AND lower(trim(tca.subject)) = lower(trim(a.subject))
             AND tca.revoked_at IS NULL
        )
     RETURNING a.id, a.title, a.description, a.subject, a.academic_year, a.semester,
               a.chapter, a.lesson, a.period, a.due_at, a.created_at`,
    [
      assignmentId, classroom.id, auth.userId, title.trim(), description,
      chapter.trim(), lesson.trim(), period?.trim() || null, new Date(dueAt),
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_ASSIGNMENT_NOT_FOUND', 'Không tìm thấy bài tập trong phạm vi lớp học.');
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
    createdAt: row.created_at.toISOString(),
  };
}

async function renameClassAssignmentChapter(auth, classId, chapter, input) {
  const scope = validateResourceChapterScope(input, chapter);
  const nextChapter = input.newChapter;
  if (typeof nextChapter !== 'string' || nextChapter.trim().length === 0 || nextChapter.trim().length > 160) {
    throw serviceError(400, 'SCHOOL_INVALID_CHAPTER', 'Tên chương mới không hợp lệ.');
  }
  const classroom = await requireTeacherSubject(auth, classId, scope.subject);
  validateClassAcademicYear(classroom, scope.academicYear);
  const result = await getPool().query(
    `UPDATE class_assignments a
        SET chapter = $8
      WHERE a.class_id = $1 AND a.school_id = $2 AND a.teacher_user_id = $3
        AND lower(trim(a.subject)) = lower(trim($4))
        AND a.academic_year = $5 AND a.semester = $6 AND a.chapter = $7
        AND a.due_at > now()
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = a.class_id AND tca.teacher_user_id = a.teacher_user_id
             AND tca.school_id = a.school_id
             AND lower(trim(tca.subject)) = lower(trim(a.subject))
             AND tca.revoked_at IS NULL
        )
     RETURNING a.id`,
    [
      classroom.id, classroom.school_id, auth.userId, scope.subject, scope.academicYear,
      scope.semester, scope.chapter, nextChapter.trim(),
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_ASSIGNMENT_CHAPTER_NOT_FOUND', 'Không tìm thấy chương bài tập còn hạn.');
  }
  return { updatedCount: result.rowCount, chapter: nextChapter.trim() };
}

async function renameClassAssignmentLesson(auth, classId, chapter, lesson, input) {
  const scope = validateResourceChapterScope(input, chapter);
  if (typeof lesson !== 'string' || lesson.trim().length === 0 || lesson.trim().length > 200) {
    throw serviceError(400, 'SCHOOL_INVALID_LESSON', 'Tên bài học không hợp lệ.');
  }
  const nextLesson = input.newLesson;
  if (typeof nextLesson !== 'string' || nextLesson.trim().length === 0 || nextLesson.trim().length > 200) {
    throw serviceError(400, 'SCHOOL_INVALID_LESSON', 'Tên bài học mới không hợp lệ.');
  }
  const classroom = await requireTeacherSubject(auth, classId, scope.subject);
  validateClassAcademicYear(classroom, scope.academicYear);
  const result = await getPool().query(
    `UPDATE class_assignments a
        SET lesson = $9
      WHERE a.class_id = $1 AND a.school_id = $2 AND a.teacher_user_id = $3
        AND lower(trim(a.subject)) = lower(trim($4))
        AND a.academic_year = $5 AND a.semester = $6
        AND a.chapter = $7 AND a.lesson = $8 AND a.due_at > now()
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = a.class_id AND tca.teacher_user_id = a.teacher_user_id
             AND tca.school_id = a.school_id
             AND lower(trim(tca.subject)) = lower(trim(a.subject))
             AND tca.revoked_at IS NULL
        )
     RETURNING a.id`,
    [
      classroom.id, classroom.school_id, auth.userId, scope.subject, scope.academicYear,
      scope.semester, scope.chapter, lesson.trim(), nextLesson.trim(),
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_ASSIGNMENT_LESSON_NOT_FOUND', 'Không tìm thấy bài học có bài tập còn hạn.');
  }
  return { updatedCount: result.rowCount, lesson: nextLesson.trim() };
}

async function deleteAuthorizedClassAssignments(auth, classId, input, selector) {
  const { academicYear, semester, subject } = validateResourcePeriodScope(input);
  const classroom = await requireTeacherSubject(auth, classId, subject);
  validateClassAcademicYear(classroom, academicYear);
  const values = [classroom.id, classroom.school_id, auth.userId, subject, academicYear, semester];
  const filters = [];
  if (selector.assignmentId) {
    values.push(selector.assignmentId);
    filters.push(`a.id = $${values.length}`);
  }
  if (selector.chapter !== undefined) {
    values.push(selector.chapter);
    filters.push(`a.chapter = $${values.length}`);
  }
  if (selector.lesson !== undefined) {
    values.push(selector.lesson);
    filters.push(`a.lesson = $${values.length}`);
  }
  if (selector.activeOnly) filters.push('a.due_at > now()');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const assignments = await client.query(
      `SELECT a.id
         FROM class_assignments a
         JOIN teacher_class_assignments tca
           ON tca.class_id = a.class_id AND tca.teacher_user_id = a.teacher_user_id
          AND tca.school_id = a.school_id
          AND lower(trim(tca.subject)) = lower(trim(a.subject))
          AND tca.revoked_at IS NULL
        WHERE a.class_id = $1 AND a.school_id = $2 AND a.teacher_user_id = $3
          AND lower(trim(a.subject)) = lower(trim($4))
          AND a.academic_year = $5 AND a.semester = $6
          ${filters.map((filter) => `AND ${filter}`).join('\n          ')}
        FOR UPDATE OF a, tca`,
      values,
    );
    const assignmentIds = [...new Set(assignments.rows.map((row) => row.id))];
    if (assignmentIds.length === 0) {
      throw serviceError(404, 'SCHOOL_ASSIGNMENT_NOT_FOUND', 'Không tìm thấy bài tập trong phạm vi lớp học.');
    }
    await client.query(
      'DELETE FROM class_assignment_submissions WHERE assignment_id = ANY($1::uuid[])',
      [assignmentIds],
    );
    const deleted = await client.query(
      `DELETE FROM class_assignments
        WHERE id = ANY($1::uuid[]) AND class_id = $2 AND teacher_user_id = $3
       RETURNING id`,
      [assignmentIds, classroom.id, auth.userId],
    );
    if (deleted.rowCount !== assignmentIds.length) {
      throw serviceError(409, 'SCHOOL_ASSIGNMENT_DELETE_CONFLICT', 'Một số bài tập đã thay đổi; hãy tải lại danh sách và thử lại.');
    }
    await client.query('COMMIT');
    return { deletedCount: deleted.rowCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteClassAssignment(auth, classId, assignmentId, input) {
  const result = await deleteAuthorizedClassAssignments(auth, classId, input, { assignmentId });
  return { deleted: true, deletedCount: result.deletedCount };
}

async function deleteClassAssignmentChapter(auth, classId, chapter, input) {
  if (typeof chapter !== 'string' || chapter.trim().length === 0 || chapter.trim().length > 160) {
    throw serviceError(400, 'SCHOOL_INVALID_CHAPTER', 'Tên chương không hợp lệ.');
  }
  const result = await deleteAuthorizedClassAssignments(auth, classId, input, {
    chapter: chapter.trim(),
    activeOnly: true,
  });
  return result;
}

async function deleteClassAssignmentLesson(auth, classId, chapter, lesson, input) {
  if (typeof chapter !== 'string' || chapter.trim().length === 0 || chapter.trim().length > 160
    || typeof lesson !== 'string' || lesson.trim().length === 0 || lesson.trim().length > 200) {
    throw serviceError(400, 'SCHOOL_INVALID_ASSIGNMENT', 'Chương hoặc bài tập không hợp lệ.');
  }
  const result = await deleteAuthorizedClassAssignments(auth, classId, input, {
    chapter: chapter.trim(),
    lesson: lesson.trim(),
    activeOnly: true,
  });
  return result;
}

async function getStudentTimetable(auth, semester, weekStart) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được xem thời khóa biểu lớp học.');
  }
  if (!['Kỳ 1', 'Kỳ 2'].includes(semester)) {
    throw serviceError(400, 'SCHOOL_INVALID_SEMESTER', 'Học kỳ không hợp lệ.');
  }
  if (weekStart !== undefined) {
    const selectedWeek = new Date(`${weekStart}T00:00:00.000Z`);
    if (typeof weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)
      || Number.isNaN(selectedWeek.getTime()) || selectedWeek.getUTCDay() !== 1
      || selectedWeek.toISOString().slice(0, 10) !== weekStart) {
      throw serviceError(400, 'SCHOOL_INVALID_WEEK', 'Tuần phải bắt đầu vào thứ Hai.');
    }
  }

  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const classResult = await getPool().query(
    `SELECT c.id, c.code, c.name, c.academic_year
       FROM class_memberships cm
       JOIN classes c ON c.id = cm.class_id AND c.school_id = $2 AND c.status = 'active'
       JOIN schools s ON s.id = c.school_id AND s.status = 'active'
      WHERE cm.student_user_id = $1 AND cm.status = 'active'
      ORDER BY c.academic_year DESC, cm.joined_at DESC
      LIMIT 1`,
    [auth.userId, schoolId],
  );
  if (!classResult.rowCount) return { classroom: null, timetable: null, weekNumber: null };

  const classroom = classResult.rows[0];
  const classroomResponse = {
    id: classroom.id,
    code: classroom.code,
    name: classroom.name,
    academicYear: classroom.academic_year,
  };
  const weekNumber = weekStart
    ? getAcademicYearWeekNumber(classroom.academic_year, weekStart)
    : null;
  const timetableResult = await getPool().query(
    `SELECT id, semester, session, to_char(effective_from, 'YYYY-MM-DD') AS effective_from, period_count
       FROM class_timetables
      WHERE class_id = $1 AND school_id = $2 AND semester = $3`,
    [classroom.id, schoolId, semester],
  );

  const loadWeekEvents = () => getPool().query(
    `SELECT extract(isodow FROM event_date)::int AS weekday, period_number, operation,
            subject, title, lesson_topic, has_homework, homework_title, homework_due_at,
            has_exam, exam_title, exam_starts_at, has_exam_return, exam_return_note, exam_return_at
       FROM class_timetable_events
      WHERE class_id = $1 AND school_id = $2 AND academic_year = $3 AND semester = $4
        AND event_date >= $5::date AND event_date < ($5::date + 7)
      ORDER BY event_date, period_number`,
    [classroom.id, schoolId, classroom.academic_year, semester, weekStart],
  );

  if (!timetableResult.rowCount) {
    if (!weekStart) return { classroom: classroomResponse, timetable: null, weekNumber };
    const [publishedSchedule, eventsResult] = await Promise.all([
      getPool().query(
        `SELECT tt.session, tt.period_count
           FROM teacher_weekly_timetables tt
          WHERE tt.school_id = $1 AND tt.academic_year = $2 AND tt.semester = $3
            AND tt.week_start = $4::date AND tt.status = 'published'
            AND EXISTS (
              SELECT 1 FROM class_timetable_events e
               WHERE e.teacher_user_id = tt.teacher_user_id AND e.class_id = $5
                 AND e.academic_year = tt.academic_year AND e.semester = tt.semester
                 AND e.event_date >= $4::date AND e.event_date < ($4::date + 7)
            )
          ORDER BY tt.teacher_user_id
          LIMIT 1`,
        [schoolId, classroom.academic_year, semester, weekStart, classroom.id],
      ),
      loadWeekEvents(),
    ]);
    if (publishedSchedule.rowCount && eventsResult.rowCount) {
      const timetable = publishedSchedule.rows[0];
      return {
        classroom: classroomResponse,
        weekNumber,
        timetable: {
          semester,
          session: timetable.session,
          effectiveFrom: weekStart,
          periodCount: Number(timetable.period_count),
          entries: mergeClassTimetableEvents([], eventsResult.rows),
        },
      };
    }
    return {
      classroom: classroomResponse,
      timetable: null,
      weekNumber,
    };
  }

  const timetable = timetableResult.rows[0];
  const entriesResult = await getPool().query(
    `SELECT weekday, period_number, subject
       FROM class_timetable_entries
      WHERE timetable_id = $1
      ORDER BY weekday, period_number`,
    [timetable.id],
  );
  const entries = entriesResult.rows.map((row) => ({
    weekday: Number(row.weekday),
    period: Number(row.period_number),
    subject: row.subject,
    type: 'lesson',
    title: '',
    topic: '',
    dueAt: null,
  }));
  if (weekStart) {
    const eventsResult = await loadWeekEvents();
    entries.splice(0, entries.length, ...mergeClassTimetableEvents(entries, eventsResult.rows));
  }
  return {
    classroom: classroomResponse,
    weekNumber,
    timetable: {
      semester: timetable.semester,
      session: timetable.session,
      effectiveFrom: String(timetable.effective_from).slice(0, 10),
      periodCount: Number(timetable.period_count),
      entries,
    },
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
            s.response_text, s.submitted_at, s.score, s.teacher_feedback,
            s.question_scores, s.question_feedback, s.graded_at,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', f.id, 'name', f.original_name, 'mediaType', f.media_type, 'sizeBytes', f.size_bytes
              ) ORDER BY f.created_at, f.id)
                FROM class_assignment_submission_files f
               WHERE f.submission_id = s.id
            ), '[]'::json) AS files
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
    questionScores: row.question_scores ?? {},
    questionFeedback: row.question_feedback ?? {},
    gradedAt: row.graded_at?.toISOString() ?? null,
    files: row.files,
  }));
}

function calculatedTermAverage(row, prefix) {
  const confirmedAverage = row[`${prefix}confirmed_average`];
  if (confirmedAverage !== null && confirmedAverage !== undefined) return Number(confirmedAverage);
  const grades = mapGrade(row, prefix);
  const scores = [
    ...grades.regular.map((value) => ({ value, weight: 1 })),
    { value: grades.midterm, weight: 2 },
    { value: grades.final, weight: 3 },
  ].filter(({ value }) => value !== null);
  const totalWeight = scores.reduce((sum, score) => sum + score.weight, 0);
  return totalWeight
    ? scores.reduce((sum, score) => sum + score.value * score.weight, 0) / totalWeight
    : null;
}

async function listStudentSubjectAverages(auth, semester) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được xem điểm môn học của mình.');
  }
  if (!['Kỳ 1', 'Kỳ 2'].includes(semester)) {
    throw serviceError(400, 'SCHOOL_INVALID_PERIOD', 'Học kỳ không hợp lệ.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const result = await getPool().query(
    `SELECT c.id AS class_id, c.name AS class_name, c.code AS class_code,
            c.academic_year, cs.subject,
            current_grade.regular_1 AS current_regular_1,
            current_grade.regular_2 AS current_regular_2,
            current_grade.regular_3 AS current_regular_3,
            current_grade.regular_4 AS current_regular_4,
            current_grade.midterm AS current_midterm,
            current_grade.final AS current_final,
            current_grade.confirmed_average AS current_confirmed_average,
            previous_grade.regular_1 AS previous_regular_1,
            previous_grade.regular_2 AS previous_regular_2,
            previous_grade.regular_3 AS previous_regular_3,
            previous_grade.regular_4 AS previous_regular_4,
            previous_grade.midterm AS previous_midterm,
            previous_grade.final AS previous_final,
            previous_grade.confirmed_average AS previous_confirmed_average,
            grade_history.average_history
       FROM class_memberships cm
       JOIN classes c ON c.id = cm.class_id AND c.school_id = $2 AND c.status = 'active'
       JOIN schools sc ON sc.id = c.school_id AND sc.status = 'active'
       JOIN class_subjects cs ON cs.class_id = c.id AND cs.school_id = c.school_id
       LEFT JOIN student_term_grades current_grade
         ON current_grade.class_id = c.id AND current_grade.student_user_id = cm.student_user_id
        AND lower(trim(current_grade.subject)) = lower(trim(cs.subject))
        AND current_grade.academic_year = c.academic_year AND current_grade.semester = $3
       LEFT JOIN student_term_grades previous_grade
         ON previous_grade.class_id = c.id AND previous_grade.student_user_id = cm.student_user_id
        AND lower(trim(previous_grade.subject)) = lower(trim(cs.subject))
        AND previous_grade.academic_year = CASE
          WHEN $3 = 'Kỳ 2' THEN c.academic_year
          WHEN c.academic_year ~ '^\\d{4}-\\d{4}$' THEN
            (split_part(c.academic_year, '-', 1)::int - 1)::text || '-'
            || (split_part(c.academic_year, '-', 2)::int - 1)::text
          ELSE c.academic_year
        END
        AND previous_grade.semester = CASE WHEN $3 = 'Kỳ 2' THEN 'Kỳ 1' ELSE 'Kỳ 2' END
       LEFT JOIN LATERAL (
         SELECT COALESCE(
                  json_agg(
                    json_build_object('average', history.average, 'recordedAt', history.recorded_at)
                    ORDER BY history.recorded_at, history.id
                  ),
                  '[]'::json
                ) AS average_history
           FROM student_term_grade_history history
          WHERE history.class_id = c.id AND history.student_user_id = cm.student_user_id
            AND lower(trim(history.subject)) = lower(trim(cs.subject))
            AND history.academic_year = c.academic_year AND history.semester = $3
       ) grade_history ON true
      WHERE cm.student_user_id = $1 AND cm.status = 'active'
      ORDER BY c.academic_year DESC, c.name, cs.subject`,
    [auth.userId, schoolId, semester],
  );
  return result.rows.map((row) => ({
    classId: row.class_id,
    className: row.class_name,
    classCode: row.class_code,
    academicYear: row.academic_year,
    subject: row.subject,
    average: calculatedTermAverage(row, 'current_'),
    regularScores: [1, 2, 3, 4].map((index) => (
      row[`current_regular_${index}`] === null || row[`current_regular_${index}`] === undefined
        ? null
        : Number(row[`current_regular_${index}`])
    )),
    previousAverage: calculatedTermAverage(row, 'previous_'),
    averageHistory: row.average_history.map((snapshot) => ({
      average: Number(snapshot.average),
      recordedAt: new Date(snapshot.recordedAt).toISOString(),
    })),
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

function validateResourcePeriodScope(input) {
  const { academicYear, semester, subject } = input;
  validatePeriod(academicYear, semester, subject);
  return { academicYear, semester, subject: subject.trim() };
}

function validateResourceChapterScope(input, chapter) {
  const scope = validateResourcePeriodScope(input);
  if (typeof chapter !== 'string' || chapter.trim().length === 0 || chapter.trim().length > 160) {
    throw serviceError(400, 'SCHOOL_INVALID_CHAPTER', 'Tên chương không hợp lệ.');
  }
  return { ...scope, chapter: chapter.trim() };
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

async function renameClassLearningResourceLesson(auth, classId, chapter, lesson, input) {
  const scope = validateResourceChapterScope(input, chapter);
  if (typeof lesson !== 'string' || lesson.trim().length === 0 || lesson.trim().length > 200) {
    throw serviceError(400, 'SCHOOL_INVALID_LESSON', 'Tên bài học không hợp lệ.');
  }
  const nextLesson = input.newLesson;
  if (typeof nextLesson !== 'string' || nextLesson.trim().length === 0 || nextLesson.trim().length > 200) {
    throw serviceError(400, 'SCHOOL_INVALID_LESSON', 'Tên bài học mới không hợp lệ.');
  }
  const classroom = await requireTeacherSubject(auth, classId, scope.subject);
  validateClassAcademicYear(classroom, scope.academicYear);
  const result = await getPool().query(
    `UPDATE class_learning_resources r
        SET lesson = $9
      WHERE r.class_id = $1 AND r.school_id = $2 AND r.teacher_user_id = $3
        AND lower(trim(r.subject)) = lower(trim($4))
        AND r.academic_year = $5 AND r.semester = $6 AND r.chapter = $7 AND r.lesson = $8
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
      scope.semester, scope.chapter, lesson.trim(), nextLesson.trim(),
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_RESOURCE_LESSON_NOT_FOUND', 'Không tìm thấy bài học trong phạm vi lớp học.');
  }
  return { updatedCount: result.rowCount, lesson: nextLesson.trim() };
}

async function deleteClassLearningResourceLesson(auth, classId, chapter, lesson, input) {
  const scope = validateResourceChapterScope(input, chapter);
  if (typeof lesson !== 'string' || lesson.trim().length === 0 || lesson.trim().length > 200) {
    throw serviceError(400, 'SCHOOL_INVALID_LESSON', 'Tên bài học không hợp lệ.');
  }
  const classroom = await requireTeacherSubject(auth, classId, scope.subject);
  validateClassAcademicYear(classroom, scope.academicYear);
  const result = await getPool().query(
    `DELETE FROM class_learning_resources r
      WHERE r.class_id = $1 AND r.school_id = $2 AND r.teacher_user_id = $3
        AND lower(trim(r.subject)) = lower(trim($4))
        AND r.academic_year = $5 AND r.semester = $6 AND r.chapter = $7 AND r.lesson = $8
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
      scope.semester, scope.chapter, lesson.trim(),
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_RESOURCE_LESSON_NOT_FOUND', 'Không tìm thấy bài học trong phạm vi lớp học.');
  }
  return { deletedCount: result.rowCount };
}

async function deleteClassLearningResource(auth, classId, resourceId, input) {
  const scope = validateResourcePeriodScope(input);
  const classroom = await requireTeacherSubject(auth, classId, scope.subject);
  validateClassAcademicYear(classroom, scope.academicYear);
  const result = await getPool().query(
    `DELETE FROM class_learning_resources r
      WHERE r.id = $1 AND r.class_id = $2 AND r.school_id = $3 AND r.teacher_user_id = $4
        AND lower(trim(r.subject)) = lower(trim($5))
        AND r.academic_year = $6 AND r.semester = $7
        AND EXISTS (
          SELECT 1 FROM teacher_class_assignments tca
           WHERE tca.class_id = r.class_id AND tca.teacher_user_id = r.teacher_user_id
             AND tca.school_id = r.school_id
             AND lower(trim(tca.subject)) = lower(trim(r.subject))
             AND tca.revoked_at IS NULL
        )
     RETURNING r.id`,
    [
      resourceId, classroom.id, classroom.school_id, auth.userId, scope.subject,
      scope.academicYear, scope.semester,
    ],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_RESOURCE_NOT_FOUND', 'Không tìm thấy bài giảng trong lớp của bạn.');
  }
  return { deleted: true };
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

function validateAssignmentSubmissionFiles(files) {
  if (!Array.isArray(files) || files.length > ASSIGNMENT_SUBMISSION_MAX_FILES) {
    throw serviceError(400, 'SCHOOL_INVALID_SUBMISSION_FILES', 'Mỗi bài nộp được đính kèm tối đa 5 tệp.');
  }
  return files.map((file) => {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0
      || file.buffer.length > ASSIGNMENT_SUBMISSION_MAX_FILE_BYTES) {
      throw serviceError(400, 'SCHOOL_INVALID_SUBMISSION_FILE', 'Mỗi tệp đính kèm phải có dung lượng tối đa 10 MB.');
    }
    const metadata = validateResourceFile(file);
    if (!ASSIGNMENT_SUBMISSION_FILE_TYPES.has(metadata.mediaType)) {
      throw serviceError(400, 'SCHOOL_INVALID_SUBMISSION_FILE', 'Chỉ hỗ trợ ảnh, PDF và tài liệu văn phòng.');
    }
    if (metadata.mediaType === 'application/pdf'
      && file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw serviceError(400, 'SCHOOL_INVALID_SUBMISSION_FILE', 'Nội dung tệp không đúng định dạng PDF.');
    }
    return { ...metadata, buffer: file.buffer };
  });
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

async function submitClassAssignment(auth, assignmentId, responseText, files = []) {
  if (auth.role !== 'student') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Chỉ học sinh được nộp bài tập.');
  }
  if (typeof responseText !== 'string' || responseText.trim().length === 0 || responseText.length > 20000) {
    throw serviceError(400, 'SCHOOL_INVALID_SUBMISSION', 'Câu trả lời phải có từ 1 đến 20.000 ký tự.');
  }
  const uploadedFiles = validateAssignmentSubmissionFiles(files);
  const schoolId = await getSingleActiveSchool(auth.userId, 'student');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
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
                     score = NULL, teacher_feedback = '', question_scores = '{}'::jsonb,
                     question_feedback = '{}'::jsonb, graded_by = NULL, graded_at = NULL
       RETURNING id, assignment_id, response_text, submitted_at`,
      [randomUUID(), auth.userId, schoolId, responseText.trim(), assignmentId],
    );
    if (result.rowCount === 0) {
      throw serviceError(404, 'SCHOOL_ASSIGNMENT_NOT_FOUND', 'Không tìm thấy bài tập trong lớp của học sinh.');
    }

    const submission = result.rows[0];
    if (uploadedFiles.length) {
      const currentFiles = await client.query(
        'SELECT count(*)::int AS count FROM class_assignment_submission_files WHERE submission_id = $1',
        [submission.id],
      );
      if (currentFiles.rows[0].count + uploadedFiles.length > ASSIGNMENT_SUBMISSION_MAX_FILES) {
        throw serviceError(400, 'SCHOOL_INVALID_SUBMISSION_FILES', 'Mỗi bài nộp được đính kèm tối đa 5 tệp.');
      }
      for (const file of uploadedFiles) {
        await client.query(
          `INSERT INTO class_assignment_submission_files
             (id, submission_id, original_name, media_type, size_bytes, content)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            randomUUID(), submission.id, file.originalName, file.mediaType,
            file.buffer.length, file.buffer,
          ],
        );
      }
    }
    const fileResult = await client.query(
      `SELECT id, original_name AS name, media_type AS "mediaType", size_bytes AS "sizeBytes"
         FROM class_assignment_submission_files
        WHERE submission_id = $1
        ORDER BY created_at, id`,
      [submission.id],
    );
    await client.query('COMMIT');
    return {
      assignmentId: submission.assignment_id,
      responseText: submission.response_text,
      submittedAt: submission.submitted_at.toISOString(),
      files: fileResult.rows.map((file) => ({ ...file, sizeBytes: Number(file.sizeBytes) })),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getClassAssignmentSubmissionFile(auth, assignmentId, studentId, fileId) {
  if (auth.role !== 'student' && auth.role !== 'lecturer') {
    throw serviceError(403, 'SCHOOL_ROLE_FORBIDDEN', 'Vai trò không được phép tải tệp bài nộp này.');
  }
  const schoolId = await getSingleActiveSchool(auth.userId, auth.role);
  const targetStudentId = auth.role === 'student' ? auth.userId : studentId;
  if (auth.role === 'lecturer') {
    const assignmentResult = await getPool().query(
      'SELECT class_id FROM class_assignments WHERE id = $1 AND teacher_user_id = $2',
      [assignmentId, auth.userId],
    );
    if (assignmentResult.rowCount === 0) {
      throw serviceError(404, 'SCHOOL_ASSIGNMENT_NOT_FOUND', 'Không tìm thấy bài tập trong phạm vi lớp học.');
    }
    await findTeacherAssignment(auth, assignmentResult.rows[0].class_id, assignmentId);
  }
  const result = await getPool().query(
    `SELECT f.original_name, f.media_type, f.size_bytes, f.content
       FROM class_assignment_submission_files f
       JOIN class_assignment_submissions s ON s.id = f.submission_id
       JOIN class_assignments a ON a.id = s.assignment_id
       JOIN classes c ON c.id = a.class_id AND c.school_id = a.school_id
       JOIN schools sc ON sc.id = c.school_id AND sc.status = 'active'
      WHERE a.id = $1 AND s.student_user_id = $2 AND f.id = $3
        AND c.school_id = $4 AND c.status = 'active'
        AND (
          ($5 = 'student' AND s.student_user_id = $6 AND EXISTS (
            SELECT 1 FROM class_memberships cm
             WHERE cm.class_id = c.id AND cm.student_user_id = $6 AND cm.status = 'active'
          ))
          OR
          ($5 = 'lecturer' AND a.teacher_user_id = $6 AND EXISTS (
            SELECT 1 FROM teacher_class_assignments tca
             WHERE tca.class_id = c.id AND tca.teacher_user_id = $6
               AND tca.school_id = c.school_id
               AND lower(trim(tca.subject)) = lower(trim(a.subject))
               AND tca.revoked_at IS NULL
          ) AND EXISTS (
            SELECT 1 FROM class_memberships cm
             WHERE cm.class_id = c.id AND cm.student_user_id = s.student_user_id AND cm.status = 'active'
          ))
        )`,
    [assignmentId, targetStudentId, fileId, schoolId, auth.role, auth.userId],
  );
  if (result.rowCount === 0) {
    throw serviceError(404, 'SCHOOL_SUBMISSION_FILE_NOT_FOUND', 'Không tìm thấy tệp trong bài nộp được phép truy cập.');
  }
  const row = result.rows[0];
  return {
    name: row.original_name,
    mediaType: row.media_type,
    sizeBytes: Number(row.size_bytes),
    content: row.content,
  };
}

module.exports = {
  createClassAssignment,
  deleteClassAssignment,
  deleteClassAssignmentChapter,
  deleteClassAssignmentLesson,
  createClassLearningResource,
  createClassLearningResourceFile,
  deleteClassLearningResource,
  deleteClassLearningResourceLesson,
  deleteTeacherAssessment,
  deleteTeacherExamRoom,
  deleteClassLearningResourceChapter,
  getClass,
  getHomeroomClassGradeSummary,
  listClassAssignmentSubmissions,
  getClassAssignmentSubmissionFile,
  getClassLearningResourceFile,
  getClassGradebook,
  listClasses,
  listClassAssignments,
  listClassLearningResources,
  listClassStudents,
  listStudentExamRooms,
  listStudentExamResults,
  markStudentExamResultRead,
  getStudentExamResultFile,
  publishTeacherExamRoomGrades,
  listStudentAssignments,
  listStudentLearningResources,
  getStudentTimetable,
  listStudentSubjectAverages,
  assignmentQuestionCount,
  assignmentQuestionMaximums,
  listTeacherClassSubjects,
  listTeacherAssessments,
  listTeacherExamRooms,
  getTeacherExamRoomGrading,
  getTeacherExamGradeEvidenceFile,
  getTeacherExamSubmissionFile,
  createStudentExamMobileUploadSession,
  purgeExpiredStudentExamMobileUploadSessions,
  getStudentExamMobileUploadStatus,
  uploadStudentExamMobileImage,
  getStudentExamMobileImage,
  deleteStudentExamMobileUpload,
  saveClassGradebook,
  saveStudentGrades,
  saveClassAssignmentGrade,
  saveTeacherAssessment,
  saveTeacherExamRoom,
  saveTeacherExamSessionGrade,
  startStudentExamSession,
  recordStudentExamEvent,
  recordStudentExamBehaviorLog,
  submitStudentExamSession,
  submitClassAssignment,
  updateClassLearningResource,
  updateClassAssignment,
  renameClassAssignmentChapter,
  renameClassAssignmentLesson,
  renameClassLearningResourceChapter,
  renameClassLearningResourceLesson,
  getSingleActiveSchool,
};
