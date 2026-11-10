const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const { after, before, beforeEach, test } = require('node:test');
const express = require('express');
const { getExamPeriodSlot } = require('../services/examRoomTimetable');

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
  rosterStudent: '10000000-0000-4000-8000-000000000014',
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
    [ids.rosterStudent, { role: 'student', admin_scope: null, status: 'active', full_name: 'Roster Only Student', email: 'roster-only@example.invalid' }],
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
    { user_id: ids.rosterStudent, school_id: ids.schoolB, status: 'active' },
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
    { class_id: ids.classB, student_user_id: ids.rosterStudent, status: 'active' },
    { class_id: ids.classA, student_user_id: ids.inconsistentRosterStudent, status: 'active' },
    { class_id: ids.classA, student_user_id: ids.disabledStudent, status: 'active' },
  ];
  const teacherAssignments = [
    { class_id: ids.classA, teacher_user_id: ids.teacherA, school_id: ids.schoolA, subject: 'Ngữ văn', revoked_at: null },
    { class_id: ids.classB, teacher_user_id: ids.teacherB, school_id: ids.schoolB, subject: 'Toán học', revoked_at: null },
  ];
  const studentTermGrades = [
    {
      class_id: ids.classA,
      student_user_id: ids.studentA,
      subject: 'Ngữ văn',
      academic_year: '2026-2027',
      semester: 'Kỳ 1',
      confirmed_average: 8,
    },
    {
      class_id: ids.classA,
      student_user_id: ids.disabledStudent,
      subject: 'Ngữ văn',
      academic_year: '2026-2027',
      semester: 'Kỳ 1',
      confirmed_average: 0,
    },
  ];
  const sessions = new Map([...users.keys()].map((userId) => [`session-${userId}`, userId]));
  return {
    users,
    schools,
    memberships,
    classes,
    classMemberships,
    teacherAssignments,
    homeroomAssignments: [],
    studentTermGrades,
    sessions,
    assessments: new Map(),
    examRooms: new Map(),
    classAssignments: [],
    classAssignmentSubmissions: [],
    classTimetableEvents: new Map(),
    examSessions: new Map(),
    examSubmissionFiles: new Map(),
    mobileExamUploads: new Map(),
    mobileUploadSchemaAvailable: true,
    examGradeEvidenceFiles: new Map(),
    examGrades: new Map(),
    examGradeViews: new Map(),
    examEvents: [],
    examLogs: [],
  };
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
  async connect() {
    return {
      query: (sql, values) => fakePool.query(sql, values),
      release() {},
    };
  },
  async query(sql, values = []) {
    const query = sql.replace(/\s+/g, ' ').trim();
    if (query.startsWith('SELECT payload, sections FROM teacher_exam_rooms')) {
      throw new Error('teacher_exam_rooms has no sections column.');
    }
    if (query.startsWith('SELECT f.original_name, f.media_type, f.size_bytes, f.content')
      && query.includes('WHERE s.id = $1 AND f.id = $2 AND s.student_user_id = $3')
      && (query.includes('FROM teacher_exam_grade_evidence_files f')
        || query.includes('FROM teacher_exam_submission_files f'))) {
      const [sessionId, fileId, studentId, schoolId] = values;
      const session = [...fixture.examSessions.values()].find((item) => (
        item.id === sessionId && item.student_user_id === studentId && item.status === 'submitted'
      ));
      const room = session ? fixture.examRooms.get(session.room_id) : null;
      const file = query.includes('FROM teacher_exam_grade_evidence_files f')
        ? fixture.examGradeEvidenceFiles.get(fileId)
        : fixture.examSubmissionFiles.get(fileId);
      const gradeEvidence = query.includes('FROM teacher_exam_grade_evidence_files f');
      const authorized = room?.school_id === schoolId && file?.sessionId === sessionId
        && fixture.examGrades.get(sessionId)?.published_at
        && fixture.classMemberships.some((membership) => (
          membership.class_id === session.class_id && membership.student_user_id === studentId
            && membership.status === 'active'
        ));
      return authorized
        ? {
          rowCount: 1,
          rows: [{
            original_name: file.originalName,
            media_type: file.mediaType,
            size_bytes: file.sizeBytes,
            content: file.content,
          }],
        }
        : { rowCount: 0, rows: [] };
    }
    if (query.startsWith('SELECT s.id AS session_id, s.room_id, s.class_id, s.submitted_at, s.answers')) {
      const [schoolId, studentId] = values;
      const rows = [...fixture.examSessions.values()].flatMap((session) => {
        const room = fixture.examRooms.get(session.room_id);
        const classroom = fixture.classes.find((item) => item.id === session.class_id);
        const grade = fixture.examGrades.get(session.id);
        const hasMembership = fixture.classMemberships.some((membership) => (
          membership.class_id === session.class_id && membership.student_user_id === studentId
            && membership.status === 'active'
        ));
        const hasSchoolMembership = fixture.memberships.some((membership) => (
          membership.user_id === studentId && membership.school_id === schoolId && membership.status === 'active'
        ));
        const user = fixture.users.get(studentId);
        if (session.student_user_id !== studentId || session.status !== 'submitted' || !grade
          || !grade.published_at
          || room?.school_id !== schoolId || classroom?.school_id !== schoolId || classroom.status !== 'active'
          || !hasMembership || !hasSchoolMembership || user?.status !== 'active' || user.role !== 'student') {
          return [];
        }
        return [{
          session_id: session.id,
          room_id: session.room_id,
          class_id: session.class_id,
          submitted_at: session.submitted_at,
          answers: session.answers,
          payload: room.payload,
          starts_at: new Date(room.starts_at),
          class_name: classroom.name,
          academic_year: classroom.academic_year,
          question_scores: grade.question_scores,
          question_feedback: grade.question_feedback,
          total_score: grade.total_score,
          teacher_feedback: grade.teacher_feedback,
          graded_at: grade.graded_at,
          published_at: grade.published_at,
          is_read: fixture.examGradeViews.get(session.id)?.getTime() === new Date(grade.graded_at).getTime(),
          files: [...fixture.examSubmissionFiles.values()]
            .filter((file) => file.sessionId === session.id)
            .map((file) => ({
              id: file.id,
              questionNumber: file.questionNumber,
              name: file.originalName,
              mediaType: file.mediaType,
              sizeBytes: file.sizeBytes,
            })),
          grade_evidence_files: [...fixture.examGradeEvidenceFiles.values()]
            .filter((file) => file.sessionId === session.id)
            .map((file) => ({
              id: file.id,
              questionId: file.questionId,
              name: file.originalName,
              mediaType: file.mediaType,
              sizeBytes: file.sizeBytes,
            })),
        }];
      });
      return { rows };
    }
    if (query.includes('INSERT INTO teacher_exam_grade_views')) {
      const [sessionId, studentId, schoolId] = values;
      const session = [...fixture.examSessions.values()].find((item) => (
        item.id === sessionId && item.student_user_id === studentId && item.status === 'submitted'
      ));
      const room = session ? fixture.examRooms.get(session.room_id) : null;
      const classroom = session ? fixture.classes.find((item) => item.id === session.class_id) : null;
      const grade = session ? fixture.examGrades.get(session.id) : null;
      const authorized = room?.school_id === schoolId && classroom?.school_id === schoolId
        && classroom.status === 'active' && grade?.published_at
        && fixture.classMemberships.some((item) => (
          item.class_id === session.class_id && item.student_user_id === studentId && item.status === 'active'
        ))
        && fixture.memberships.some((item) => (
          item.user_id === studentId && item.school_id === schoolId && item.status === 'active'
        ));
      if (!authorized) return { rows: [] };
      const readAt = new Date(grade.graded_at);
      fixture.examGradeViews.set(sessionId, readAt);
      return { rows: [{ viewed_graded_at: readAt }] };
    }
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) return { rows: [] };
    if (query.includes('DELETE FROM teacher_exam_mobile_upload_sessions WHERE expires_at <= now()')) {
      if (!fixture.mobileUploadSchemaAvailable) {
        const error = new Error('relation "teacher_exam_mobile_upload_sessions" does not exist');
        error.code = '42P01';
        throw error;
      }
      for (const [hash, upload] of fixture.mobileExamUploads) {
        if (upload.expiresAt <= Date.now()) fixture.mobileExamUploads.delete(hash);
      }
      return { rows: [] };
    }
    if (query.includes('LEAST(') && query.includes('FROM teacher_exam_sessions s')
      && query.includes('AS expires_at')) {
      const [sessionId, studentId, schoolId] = values;
      const session = [...fixture.examSessions.values()].find((item) => item.id === sessionId);
      const room = session ? fixture.examRooms.get(session.room_id) : null;
      if (!session || session.student_user_id !== studentId || !room || room.school_id !== schoolId
        || !['in-progress', 'review'].includes(session.status)) return { rows: [] };
      const expiresAt = Math.min(
        Date.now() + 30 * 60_000,
        new Date(session.started_at).getTime() + room.payload.durationMinutes * 60_000,
      );
      if (Date.now() >= expiresAt) return { rows: [] };
      return { rows: [{
        started_at: session.started_at,
        status: session.status,
        payload: room.payload,
        expires_at: new Date(expiresAt),
      }] };
    }
    if (query.includes('SELECT count(*)::int AS count')
      && query.includes('FROM teacher_exam_mobile_upload_sessions')) {
      const [sessionId] = values;
      return {
        rows: [{
          count: [...fixture.mobileExamUploads.values()].filter((item) => (
            item.sessionId === sessionId && item.expiresAt > Date.now()
          )).length,
        }],
      };
    }
    if (query.includes('INSERT INTO teacher_exam_mobile_upload_sessions')) {
      const [tokenHash, sessionId, questionNumber, expiresAt] = values;
      fixture.mobileExamUploads.set(tokenHash, {
        tokenHash,
        sessionId,
        questionNumber,
        expiresAt: new Date(expiresAt).getTime(),
        originalName: null,
        mediaType: null,
        sizeBytes: null,
        content: null,
      });
      return { rows: [{ expires_at: new Date(expiresAt) }] };
    }
    if (query.includes('SELECT m.content IS NOT NULL AS uploaded')) {
      const [tokenHash] = values;
      const upload = fixture.mobileExamUploads.get(tokenHash);
      const session = upload && [...fixture.examSessions.values()].find((item) => item.id === upload.sessionId);
      return upload && session && session.status !== 'submitted' && upload.expiresAt > Date.now()
        ? { rows: [{ uploaded: Boolean(upload.content), original_name: upload.originalName }] }
        : { rows: [] };
    }
    if (query.includes('SELECT m.question_number')
      && query.includes('teacher_exam_mobile_upload_sessions')
      && query.includes('m.content IS NULL')) {
      const [tokenHash] = values;
      const upload = fixture.mobileExamUploads.get(tokenHash);
      const session = upload && [...fixture.examSessions.values()].find((item) => item.id === upload.sessionId);
      return upload && session && session.status !== 'submitted' && upload.expiresAt > Date.now()
        && !upload.content ? { rows: [{ question_number: upload.questionNumber }] } : { rows: [] };
    }
    if (query.includes('UPDATE teacher_exam_mobile_upload_sessions m')) {
      const [tokenHash, originalName, mediaType, sizeBytes, content] = values;
      const upload = fixture.mobileExamUploads.get(tokenHash);
      const session = upload && [...fixture.examSessions.values()].find((item) => item.id === upload.sessionId);
      if (!upload || !session || session.status === 'submitted' || upload.expiresAt <= Date.now()
        || upload.content) return { rows: [] };
      Object.assign(upload, { originalName, mediaType, sizeBytes, content });
      return { rows: [{ question_number: upload.questionNumber }] };
    }
    if (query.includes('SELECT m.original_name, m.media_type, m.size_bytes, m.content')
      && query.includes('teacher_exam_mobile_upload_sessions')) {
      const [tokenHash] = values;
      const upload = fixture.mobileExamUploads.get(tokenHash);
      const session = upload && [...fixture.examSessions.values()].find((item) => item.id === upload.sessionId);
      return upload && session && session.status !== 'submitted' && upload.expiresAt > Date.now() && upload.content
        ? { rows: [{
          original_name: upload.originalName,
          media_type: upload.mediaType,
          size_bytes: upload.sizeBytes,
          content: upload.content,
        }] }
        : { rows: [] };
    }
    if (query.includes('DELETE FROM teacher_exam_mobile_upload_sessions m')
      && query.includes('USING teacher_exam_sessions s')) {
      const [tokenHash, sessionId, studentId, schoolId] = values;
      const upload = fixture.mobileExamUploads.get(tokenHash);
      const session = upload && [...fixture.examSessions.values()].find((item) => (
        item.id === sessionId && item.student_user_id === studentId
      ));
      const room = session ? fixture.examRooms.get(session.room_id) : null;
      const authorized = upload?.sessionId === sessionId && room?.school_id === schoolId;
      if (authorized) fixture.mobileExamUploads.delete(tokenHash);
      return { rowCount: authorized ? 1 : 0, rows: [] };
    }
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
    if (query.includes('INSERT INTO teacher_assessments')) {
      const [id, teacherUserId, schoolId, kind, clientId, title, payload, sections] = values;
      const key = `${teacherUserId}:${kind}:${clientId}`;
      const existing = fixture.assessments.get(key);
      const row = {
        id: existing?.id ?? id,
        teacher_user_id: teacherUserId,
        school_id: schoolId,
        kind,
        client_id: clientId,
        title,
        payload: JSON.parse(payload),
        sections: JSON.parse(sections),
      };
      fixture.assessments.set(key, row);
      return { rows: [{ client_id: row.client_id, payload: row.payload, sections: row.sections }] };
    }
    if (query.includes('DELETE FROM teacher_assessments')) {
      const [teacherUserId, schoolId, kind, clientId] = values;
      const key = `${teacherUserId}:${kind}:${clientId}`;
      const assessment = fixture.assessments.get(key);
      if (!assessment || assessment.school_id !== schoolId) return { rowCount: 0 };
      fixture.assessments.delete(key);
      return { rowCount: 1 };
    }
    if (query.includes('FROM teacher_assessments')
      && query.includes("kind = 'exam' AND client_id = $3")) {
      const [teacherUserId, schoolId, clientId] = values;
      const assessment = fixture.assessments.get(`${teacherUserId}:exam:${clientId}`);
      return {
        rows: assessment && assessment.school_id === schoolId
          ? [{ payload: assessment.payload, sections: assessment.sections }]
          : [],
      };
    }
    if (query.includes('FROM teacher_assessments')) {
      const [teacherUserId, schoolId, kind] = values;
      return {
        rows: [...fixture.assessments.values()]
          .filter((assessment) => assessment.teacher_user_id === teacherUserId
            && assessment.school_id === schoolId && assessment.kind === kind)
          .map(({ client_id, payload, sections }) => ({ client_id, payload, sections })),
      };
    }
    if (query.includes('FROM teacher_exam_rooms r')
      && query.includes('FROM class_memberships cm')
      && query.includes('r.payload->\'classIds\' ? c.id::text')) {
      const [schoolId, studentId] = values;
      const rooms = [...fixture.examRooms.values()]
        .filter((room) => room.school_id === schoolId
          && ['scheduled', 'open', 'closed', 'completed'].includes(room.status)
          && fixture.classMemberships.some((membership) => (
            membership.student_user_id === studentId
            && membership.status === 'active'
            && room.payload.classIds.includes(membership.class_id)
            && fixture.classes.some((classroom) => (
              classroom.id === membership.class_id && classroom.status === 'active'
                && classroom.school_id === schoolId
            ))
          )))
        .map((room) => ({
          payload: room.payload,
          status: room.status,
          starts_at: room.starts_at,
          in_progress_count: [...fixture.examSessions.values()]
            .filter((session) => session.room_id === room.id && ['in-progress', 'review'].includes(session.status)).length,
          has_submitted: [...fixture.examSessions.values()].some((session) => (
            session.room_id === room.id && session.student_user_id === studentId && session.status === 'submitted'
          )),
        }));
      return { rows: rooms };
    }
    if (query.includes('SELECT token_hash, question_number, original_name, media_type, size_bytes, content')
      && query.includes('teacher_exam_mobile_upload_sessions')) {
      const [sessionId, tokenHashes] = values;
      return {
        rows: tokenHashes.flatMap((hash) => {
          const upload = fixture.mobileExamUploads.get(hash);
          return upload?.sessionId === sessionId && upload.content && upload.expiresAt > Date.now()
            ? [{
              token_hash: hash,
              question_number: upload.questionNumber,
              original_name: upload.originalName,
              media_type: upload.mediaType,
              size_bytes: upload.sizeBytes,
              content: upload.content,
            }]
            : [];
        }),
      };
    }
    if (query.includes('INSERT INTO teacher_exam_sessions')) {
      const [id, roomId, studentId, schoolId] = values;
      const room = fixture.examRooms.get(roomId);
      const membership = fixture.classMemberships.find((item) => (
        item.student_user_id === studentId && item.status === 'active'
        && room?.payload.classIds.includes(item.class_id)
      ));
      const roomEnd = room
        ? new Date(room.payload.startsAt).getTime() + room.payload.durationMinutes * 60_000
        : Number.NaN;
      const roomStart = room ? new Date(room.payload.startsAt).getTime() : Number.NaN;
      if (!room || room.school_id !== schoolId || !['scheduled', 'open'].includes(room.status)
        || !Number.isFinite(roomStart) || Date.now() < roomStart
        || !Number.isFinite(roomEnd) || Date.now() >= roomEnd || !membership) return { rows: [] };
      const key = `${roomId}:${studentId}`;
      const existing = fixture.examSessions.get(key);
      if (existing?.status === 'submitted') return { rows: [] };
      const session = existing ?? {
        id,
        room_id: roomId,
        student_user_id: studentId,
        class_id: membership.class_id,
        status: 'in-progress',
        started_at: new Date(),
        submitted_at: null,
        answers: {},
        result: {},
      };
      fixture.examSessions.set(key, session);
      return { rows: [{ id: session.id, started_at: session.started_at }] };
    }
    if (query.includes('FROM teacher_exam_sessions s JOIN teacher_exam_rooms r')
      && query.includes("r.payload->'settings' AS settings")) {
      const [sessionId, studentId, schoolId] = values;
      const session = [...fixture.examSessions.values()].find((item) => (
        item.id === sessionId && item.student_user_id === studentId
      ));
      const room = session ? fixture.examRooms.get(session.room_id) : null;
      return session && room && (!schoolId || room.school_id === schoolId) ? {
        rows: [{ room_id: session.room_id, status: session.status, settings: room.payload.settings }],
      } : { rows: [] };
    }
    if (query.startsWith('SELECT id FROM exam_logs')) {
      const [sessionId, eventType] = values;
      const existing = fixture.examLogs.find((item) => (
        item.session_id === sessionId && item.event_type === eventType
          && Date.now() - item.received_at.getTime() < 3_000
      ));
      return { rows: existing ? [{ id: existing.id }] : [] };
    }
    if (query.startsWith('INSERT INTO exam_logs')) {
      const [id, sessionId, studentId, eventType, occurredAt, durationSeconds] = values;
      fixture.examLogs.push({
        id,
        session_id: sessionId,
        student_user_id: studentId,
        event_type: eventType,
        occurred_at: occurredAt,
        duration_seconds: durationSeconds,
        received_at: new Date(),
      });
      return { rowCount: 1, rows: [] };
    }
    if (query.includes('INSERT INTO teacher_exam_events')) {
      const [id, sessionId, eventType] = values;
      fixture.examEvents.push({ id, session_id: sessionId, event_type: eventType, occurred_at: new Date() });
      return { rows: [{ id }] };
    }
    if (query.includes('FROM teacher_exam_events e')
      && query.includes('warning_threshold')) {
      const [sessionId] = values;
      const eventCount = fixture.examEvents.filter((item) => item.session_id === sessionId).length;
      const session = [...fixture.examSessions.values()].find((item) => item.id === sessionId);
      const room = session ? fixture.examRooms.get(session.room_id) : null;
      return room ? {
        rows: [{ event_count: eventCount, warning_threshold: room.payload.settings.warningThreshold }],
      } : { rows: [] };
    }
    if (query.includes("SET status = 'review'")) {
      const [sessionId, studentId] = values;
      const session = [...fixture.examSessions.values()].find((item) => (
        item.id === sessionId && item.student_user_id === studentId && item.status === 'in-progress'
      ));
      if (session) session.status = 'review';
      return { rowCount: session ? 1 : 0 };
    }
    if (query.includes('SELECT r.payload FROM teacher_exam_sessions s')) {
      const [sessionId, studentId, schoolId] = values;
      const session = [...fixture.examSessions.values()].find((item) => (
        item.id === sessionId && item.student_user_id === studentId
          && ['in-progress', 'review'].includes(item.status)
      ));
      const room = session ? fixture.examRooms.get(session.room_id) : null;
      return room?.school_id === schoolId ? { rows: [{ payload: room.payload }] } : { rows: [] };
    }
    if (query.includes('SELECT s.started_at, s.status, r.payload')
      && query.includes('FOR UPDATE OF s')) {
      const [sessionId, studentId, schoolId] = values;
      const session = [...fixture.examSessions.values()].find((item) => (
        item.id === sessionId && item.student_user_id === studentId
          && ['in-progress', 'review'].includes(item.status)
      ));
      const room = session ? fixture.examRooms.get(session.room_id) : null;
      const deadline = room && session
        ? session.started_at.getTime() + room.payload.durationMinutes * 60_000
        : Number.NaN;
      return room?.school_id === schoolId && Date.now() <= deadline
        ? { rows: [{ started_at: session.started_at, status: session.status, payload: room.payload }] }
        : { rows: [] };
    }
    if (query.includes('UPDATE teacher_exam_sessions s')
      && query.includes("SET status = 'submitted'")) {
      assert.match(query, /'answered', \$7::integer/);
      assert.match(query, /'automaticTotal', \$5::numeric/);
      const [
        sessionId, studentId, answers, automaticScores, automaticTotal, manualQuestionIds, answered, schoolId,
      ] = values;
      const session = [...fixture.examSessions.values()].find((item) => (
        item.id === sessionId && item.student_user_id === studentId
        && ['in-progress', 'review'].includes(item.status)
      ));
      if (!session) return { rows: [] };
      const room = fixture.examRooms.get(session.room_id);
      if (room.school_id !== schoolId) return { rows: [] };
      const parsedAnswers = JSON.parse(answers);
      session.status = 'submitted';
      session.submitted_at = new Date();
      session.answers = parsedAnswers;
      session.result = {
        answered,
        total: room.payload.examSnapshot.questions.length,
        submittedAt: session.submitted_at.toISOString(),
        automaticScores: JSON.parse(automaticScores),
        automaticTotal: Number(automaticTotal),
        manualQuestionIds: JSON.parse(manualQuestionIds),
      };
      return { rows: [{ result: session.result }] };
    }
    if (query.includes('INSERT INTO teacher_exam_submission_files')) {
      const [id, sessionId, questionNumber, originalName, mediaType, sizeBytes, content] = values;
      const file = { id, sessionId, questionNumber, originalName, mediaType, sizeBytes, content };
      fixture.examSubmissionFiles.set(id, file);
      return { rows: [] };
    }
    if (query.includes('DELETE FROM teacher_exam_mobile_upload_sessions WHERE session_id = $1')) {
      const [sessionId] = values;
      for (const [hash, upload] of fixture.mobileExamUploads) {
        if (upload.sessionId === sessionId) fixture.mobileExamUploads.delete(hash);
      }
      return { rows: [] };
    }
    if (query.includes('SELECT f.original_name, f.media_type, f.size_bytes, f.content')
      && query.includes('FROM teacher_exam_submission_files f')) {
      const [teacherId, roomId, sessionId, fileId, schoolId] = values;
      const room = fixture.examRooms.get(roomId);
      const session = [...fixture.examSessions.values()].find((item) => (
        item.id === sessionId && item.room_id === roomId && item.status === 'submitted'
      ));
      const file = fixture.examSubmissionFiles.get(fileId);
      const authorized = room?.teacher_user_id === teacherId && room.school_id === schoolId
        && session && file?.sessionId === sessionId;
      return authorized
        ? {
          rowCount: 1,
          rows: [{
            original_name: file.originalName,
            media_type: file.mediaType,
            size_bytes: file.sizeBytes,
            content: file.content,
          }],
        }
        : { rowCount: 0, rows: [] };
    }
    if (query.includes('SELECT f.original_name, f.media_type, f.size_bytes, f.content')
      && query.includes('FROM teacher_exam_grade_evidence_files f')) {
      const [teacherId, roomId, sessionId, fileId, schoolId] = values;
      const room = fixture.examRooms.get(roomId);
      const session = [...fixture.examSessions.values()].find((item) => (
        item.id === sessionId && item.room_id === roomId && item.status === 'submitted'
      ));
      const file = fixture.examGradeEvidenceFiles.get(fileId);
      const authorized = room?.teacher_user_id === teacherId && room.school_id === schoolId
        && session && file?.sessionId === sessionId && fixture.examGrades.has(sessionId);
      return authorized
        ? {
          rowCount: 1,
          rows: [{
            original_name: file.originalName,
            media_type: file.mediaType,
            size_bytes: file.sizeBytes,
            content: file.content,
          }],
        }
        : { rowCount: 0, rows: [] };
    }
    if (query.startsWith('SELECT id, session_id, event_type, occurred_at, duration_seconds FROM exam_logs')) {
      const [sessionIds] = values;
      return {
        rows: fixture.examLogs
          .filter((log) => sessionIds.includes(log.session_id))
          .sort((first, second) => second.occurred_at.getTime() - first.occurred_at.getTime())
          .map(({ id, session_id, event_type, occurred_at, duration_seconds }) => ({
            id,
            session_id,
            event_type,
            occurred_at,
            duration_seconds,
          })),
      };
    }
    if (query.includes('SELECT DISTINCT ON (r.id, u.id)')
      && query.includes('FROM teacher_exam_rooms r')
      && query.includes('JOIN class_memberships cm')) {
      const [roomIds, teacherUserId, schoolId] = values;
      const rows = [];
      for (const roomId of roomIds) {
        const room = fixture.examRooms.get(roomId);
        if (!room || room.teacher_user_id !== teacherUserId || room.school_id !== schoolId) continue;
        const roster = new Map();
        for (const membership of fixture.classMemberships) {
          if (membership.status !== 'active' || !room.payload.classIds.includes(membership.class_id)) continue;
          const classroom = fixture.classes.find((item) => item.id === membership.class_id
            && item.school_id === schoolId && item.status === 'active');
          const user = fixture.users.get(membership.student_user_id);
          if (!classroom || !user || user.status !== 'active' || user.role !== 'student'
            || !getActiveSchoolIds(membership.student_user_id).includes(schoolId)) continue;
          roster.set(membership.student_user_id, {
            room_id: roomId,
            student_user_id: membership.student_user_id,
            student_name: user.full_name,
            class_name: classroom.name,
          });
        }
        rows.push(...roster.values());
      }
      return { rows };
    }
    if (query.includes('FROM teacher_exam_sessions s')
      && query.includes('jsonb_agg(jsonb_build_object')) {
      const [roomIds] = values;
      const rows = [...fixture.examSessions.values()]
        .filter((session) => roomIds.includes(session.room_id))
        .filter((session) => !query.includes("u.status = 'active'")
          || fixture.users.get(session.student_user_id)?.status === 'active')
        .map((session) => {
          const user = fixture.users.get(session.student_user_id);
          const classroom = fixture.classes.find((item) => item.id === session.class_id);
          const events = fixture.examEvents
            .filter((event) => event.session_id === session.id)
            .map((event) => ({
              id: event.id,
              at: '08:02',
              label: event.event_type,
              kind: 'warning',
            }));
          return {
            id: session.id,
            room_id: session.room_id,
            student_user_id: session.student_user_id,
            student_name: user.full_name,
            class_name: classroom.name,
            status: session.status,
            started_at: session.started_at,
            submitted_at: session.submitted_at,
            event_count: events.length,
            events,
            files: [...fixture.examSubmissionFiles.values()]
              .filter((file) => file.sessionId === session?.id)
              .map((file) => ({
                id: file.id,
                questionNumber: file.questionNumber,
                name: file.originalName,
                mediaType: file.mediaType,
                sizeBytes: file.sizeBytes,
              })),
          };
        });
      return { rows };
    }
    if (query.startsWith('SELECT payload')
      && query.includes('WHERE id = $1 AND teacher_user_id = $2 AND school_id = $3')) {
      const [roomId, teacherUserId, schoolId] = values;
      const room = fixture.examRooms.get(roomId);
      return room && room.teacher_user_id === teacherUserId && room.school_id === schoolId
        ? { rows: [{ payload: room.payload }] }
        : { rows: [] };
    }
    if (query.includes('FROM jsonb_array_elements_text($1::jsonb) selected(class_id)')) {
      const [classIds, schoolId, roomId] = values;
      const rows = [];
      for (const classId of JSON.parse(classIds)) {
        const classroom = fixture.classes.find((item) => item.id === classId
          && item.school_id === schoolId && item.status === 'active');
        if (!classroom) continue;
        for (const membership of fixture.classMemberships.filter((item) => (
          item.class_id === classId && item.status === 'active'
        ))) {
          const user = fixture.users.get(membership.student_user_id);
          if (!user || user.status !== 'active' || user.role !== 'student'
            || !fixture.memberships.some((item) => item.user_id === membership.student_user_id
              && item.school_id === schoolId && item.status === 'active')) continue;
          const session = fixture.examSessions.get(`${roomId}:${membership.student_user_id}`);
          const grade = session ? fixture.examGrades.get(session.id) : null;
          rows.push({
            student_id: membership.student_user_id,
            student_name: user.full_name,
            class_name: classroom.name,
            session_id: session?.id ?? null,
            status: session?.status ?? null,
            submitted_at: session?.submitted_at ?? null,
            answers: session?.answers ?? null,
            question_scores: grade?.question_scores ?? null,
            question_feedback: grade?.question_feedback ?? null,
            total_score: grade?.total_score ?? null,
            teacher_feedback: grade?.teacher_feedback ?? null,
            graded_at: grade?.graded_at ?? null,
            published_at: grade?.published_at ?? null,
            grade_evidence_files: [...fixture.examGradeEvidenceFiles.values()]
              .filter((file) => file.sessionId === session?.id)
              .map((file) => ({
                id: file.id,
                questionId: file.questionId,
                name: file.originalName,
                mediaType: file.mediaType,
                sizeBytes: file.sizeBytes,
              })),
            files: [...fixture.examSubmissionFiles.values()]
              .filter((file) => file.sessionId === session?.id)
              .map((file) => ({
                id: file.id,
                questionNumber: file.questionNumber,
                name: file.originalName,
                mediaType: file.mediaType,
                sizeBytes: file.sizeBytes,
              })),
          });
        }
      }
      return { rows: rows.filter((row, index) => (
        rows.findIndex((candidate) => candidate.student_id === row.student_id) === index
      )) };
    }
    if (query.includes('FOR UPDATE OF s')) {
      const [roomId, sessionId, schoolId, teacherId] = values;
      const room = fixture.examRooms.get(roomId);
      const session = [...fixture.examSessions.values()].find((item) => item.id === sessionId);
      return room?.teacher_user_id === teacherId && room.school_id === schoolId
        && session?.room_id === roomId && session.status === 'submitted'
        ? { rows: [{ id: session.id }] }
        : { rows: [] };
    }
    if (query.includes('FROM teacher_exam_grade_evidence_files')
      && query.includes('FOR UPDATE')) {
      const [sessionId] = values;
      return {
        rows: [...fixture.examGradeEvidenceFiles.values()]
          .filter((file) => file.sessionId === sessionId)
          .map((file) => ({ id: file.id })),
      };
    }
    if (query.includes('INSERT INTO teacher_exam_session_grades')) {
      const [roomId, sessionId, schoolId, teacherId, questionScores, questionFeedback, totalScore, teacherFeedback] = values;
      const room = fixture.examRooms.get(roomId);
      const session = [...fixture.examSessions.values()].find((item) => item.id === sessionId);
      if (!room || room.teacher_user_id !== teacherId || room.school_id !== schoolId
        || !session || session.room_id !== roomId || session.status !== 'submitted') {
        return { rows: [] };
      }
      const grade = {
        question_scores: JSON.parse(questionScores),
        question_feedback: JSON.parse(questionFeedback),
        total_score: totalScore,
        teacher_feedback: teacherFeedback,
        graded_at: new Date(),
        published_at: fixture.examGrades.get(sessionId)?.published_at ?? null,
      };
      fixture.examGrades.set(sessionId, grade);
      return { rows: [grade] };
    }
    if (query.startsWith('SELECT id FROM teacher_exam_rooms')
      && query.includes('teacher_user_id = $2 AND school_id = $3')) {
      const [roomId, teacherId, schoolId] = values;
      const room = fixture.examRooms.get(roomId);
      return room?.teacher_user_id === teacherId && room.school_id === schoolId
        ? { rowCount: 1, rows: [{ id: roomId }] }
        : { rowCount: 0, rows: [] };
    }
    if (query.startsWith('WITH published AS ( UPDATE teacher_exam_session_grades g')) {
      const [roomId] = values;
      const now = new Date();
      let publishedCount = 0;
      for (const [sessionId, grade] of fixture.examGrades) {
        const session = [...fixture.examSessions.values()].find((item) => item.id === sessionId);
        if (session?.room_id === roomId && session.status === 'submitted') {
          grade.published_at = now;
          publishedCount += 1;
        }
      }
      const publishedGrades = [...fixture.examGrades.entries()].filter(([sessionId, grade]) => {
        const session = [...fixture.examSessions.values()].find((item) => item.id === sessionId);
        return session?.room_id === roomId && Boolean(grade.published_at);
      });
      return {
        rows: [{
          published_count: publishedCount,
          total_published_count: publishedGrades.length,
          published_at: publishedGrades.length ? now : null,
        }],
      };
    }
    if (query.includes('DELETE FROM teacher_exam_grade_evidence_files')) {
      const [sessionId, idsToDelete] = values;
      for (const id of idsToDelete) {
        const file = fixture.examGradeEvidenceFiles.get(id);
        if (file?.sessionId === sessionId) fixture.examGradeEvidenceFiles.delete(id);
      }
      return { rows: [] };
    }
    if (query.includes('INSERT INTO teacher_exam_grade_evidence_files')) {
      const [id, sessionId, questionId, originalName, mediaType, sizeBytes, content] = values;
      fixture.examGradeEvidenceFiles.set(id, {
        id, sessionId, questionId, originalName, mediaType, sizeBytes, content,
      });
      return { rows: [] };
    }
    if (query.includes('SELECT id, question_id, original_name, media_type, size_bytes')
      && query.includes('FROM teacher_exam_grade_evidence_files')) {
      const [sessionId] = values;
      return {
        rows: [...fixture.examGradeEvidenceFiles.values()]
          .filter((file) => file.sessionId === sessionId)
          .map((file) => ({
            id: file.id,
            question_id: file.questionId,
            original_name: file.originalName,
            media_type: file.mediaType,
            size_bytes: file.sizeBytes,
          })),
      };
    }
    if (query.includes('FROM teacher_exam_sessions s')
      && query.includes('s.status = \'submitted\'')) {
      const [roomId, sessionId, schoolId, teacherId] = values;
      const room = fixture.examRooms.get(roomId);
      const session = [...fixture.examSessions.values()].find((item) => item.id === sessionId);
      return room?.school_id === schoolId && room?.teacher_user_id === teacherId
        && session?.room_id === roomId && session.status === 'submitted'
        ? { rows: [{ answers: session.answers }] }
        : { rows: [] };
    }
    if (query.includes('INSERT INTO teacher_exam_rooms')) {
      const [id, teacherUserId, schoolId, code, title, status, startsAt, payload] = values;
      const existing = fixture.examRooms.get(id);
      if (existing && existing.school_id !== schoolId) return { rows: [] };
      const room = {
        id,
        teacher_user_id: teacherUserId,
        school_id: schoolId,
        code,
        title,
        status,
        starts_at: startsAt,
        payload: JSON.parse(payload),
        grades_published_at: existing?.grades_published_at ?? null,
      };
      fixture.examRooms.set(id, room);
      return { rows: [{ payload: room.payload }] };
    }
    if (query.startsWith('SELECT operation, has_exam, source_exam_room_id, teacher_user_id FROM class_timetable_events')) {
      const [classId, eventDate, period] = values;
      const event = fixture.classTimetableEvents.get(`${classId}:${eventDate}:${period}`);
      return {
        rowCount: event ? 1 : 0,
        rows: event ? [{
          operation: event.operation,
          has_exam: event.has_exam,
          source_exam_room_id: event.source_exam_room_id,
          teacher_user_id: event.teacher_user_id,
        }] : [],
      };
    }
    if (query.startsWith('SELECT class_id, trim(subject) AS subject FROM teacher_class_assignments')) {
      const [teacherId, schoolId, classIds] = values;
      const rows = fixture.teacherAssignments
        .filter((assignment) => assignment.teacher_user_id === teacherId
          && assignment.school_id === schoolId
          && assignment.revoked_at === null
          && classIds.includes(assignment.class_id))
        .map(({ class_id, subject }) => ({ class_id, subject: subject.trim() }))
        .sort((first, second) => first.subject.localeCompare(second.subject, 'vi'));
      return { rows };
    }
    if (query.startsWith('UPDATE class_timetable_events') && query.includes('source_exam_room_id = NULL')) {
      const [roomId, teacherUserId, schoolId] = values;
      for (const [key, event] of fixture.classTimetableEvents) {
        if (event.source_exam_room_id === roomId && event.teacher_user_id === teacherUserId
          && event.school_id === schoolId && !event.source_exam_room_created_event) {
          Object.assign(event, {
            has_exam: false,
            exam_title: '',
            exam_starts_at: null,
            source_exam_room_id: null,
            source_exam_room_created_event: false,
          });
          fixture.classTimetableEvents.set(key, event);
        }
      }
      return { rows: [] };
    }
    if (query.startsWith('UPDATE class_timetable_events') && query.includes('SET has_exam = true')) {
      const [classId, eventDate, period, title, startsAt, sourceRoomId] = values;
      const event = fixture.classTimetableEvents.get(`${classId}:${eventDate}:${period}`);
      if (event) {
        Object.assign(event, {
          has_exam: true,
          exam_title: title,
          exam_starts_at: startsAt,
          source_exam_room_id: sourceRoomId,
          source_exam_room_created_event: false,
        });
      }
      return { rows: [] };
    }
    if (query.startsWith('DELETE FROM class_timetable_events')) {
      const [roomId, teacherUserId, schoolId] = values;
      for (const [key, event] of fixture.classTimetableEvents) {
        if (event.source_exam_room_id === roomId && event.teacher_user_id === teacherUserId
          && event.school_id === schoolId && event.source_exam_room_created_event) {
          fixture.classTimetableEvents.delete(key);
        }
      }
      return { rows: [] };
    }
    if (query.startsWith('INSERT INTO class_timetable_events')) {
      const [
        id, classId, schoolId, teacherUserId, academicYear, semester, eventDate,
        period, subject, title, startsAt, sourceRoomId,
      ] = values;
      fixture.classTimetableEvents.set(`${classId}:${eventDate}:${period}`, {
        id,
        class_id: classId,
        school_id: schoolId,
        teacher_user_id: teacherUserId,
        academic_year: academicYear,
        semester,
        event_date: eventDate,
        period_number: period,
        operation: 'override',
        subject,
        title,
        has_exam: true,
        exam_title: title,
        exam_starts_at: startsAt,
        source_exam_room_id: sourceRoomId,
        source_exam_room_created_event: true,
      });
      return { rows: [] };
    }
    if (query.includes('DELETE FROM teacher_exam_rooms')) {
      const [roomId, teacherUserId, schoolId] = values;
      const room = fixture.examRooms.get(roomId);
      if (!room || room.teacher_user_id !== teacherUserId || room.school_id !== schoolId) return { rowCount: 0 };
      fixture.examRooms.delete(roomId);
      return { rowCount: 1 };
    }
    if (query.includes('FROM teacher_exam_rooms') && query.includes('id = $3')) {
      const [teacherUserId, schoolId, roomId] = values;
      const room = fixture.examRooms.get(roomId);
      return room && room.teacher_user_id === teacherUserId && room.school_id === schoolId
        ? { rows: [{ payload: room.payload }] }
        : { rows: [] };
    }
    if (query.includes('FROM teacher_exam_rooms')) {
      const [teacherUserId, schoolId] = values;
      return {
        rows: [...fixture.examRooms.values()]
          .filter((room) => room.teacher_user_id === teacherUserId && room.school_id === schoolId)
          .map(({ payload }) => ({ payload })),
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
        item.class_id === classId && item.teacher_user_id === teacherId && item.ended_at === null
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
    if (query.includes('SELECT c.id, c.school_id, c.code, c.name')
      && query.includes('FROM class_memberships cm')
      && query.includes('WHERE cm.student_user_id = $1 AND cm.status = \'active\'')) {
      const [studentId, schoolId] = values;
      const rows = fixture.classMemberships
        .filter((membership) => membership.student_user_id === studentId && membership.status === 'active')
        .map((membership) => fixture.classes.find((item) => item.id === membership.class_id))
        .filter((classroom) => classroom && classroom.school_id === schoolId && classroom.status === 'active'
          && fixture.schools.get(classroom.school_id)?.status === 'active')
        .map(classRow);
      return { rows };
    }
    if (query.includes('FROM teacher_class_assignments tca')
      && query.includes('FROM classes c') && query.includes('AS student_count')) {
      const [teacherId, schoolId] = values;
      const rows = fixture.teacherAssignments
        .filter((assignment) => assignment.teacher_user_id === teacherId && assignment.revoked_at === null)
        .map((assignment) => fixture.classes.find((item) => item.id === assignment.class_id))
        .filter((classroom) => classroom && classroom.school_id === schoolId && classroom.status === 'active'
          && fixture.schools.get(classroom.school_id)?.status === 'active')
        .map((classroom) => {
          const row = classRow(classroom);
          if (query.includes('AS student_count')) {
            const activeUserFilter = query.includes("active_student.status = 'active'")
              && query.includes("active_student.role = 'student'");
            row.student_count = fixture.classMemberships
              .filter((membership) => membership.class_id === classroom.id && membership.status === 'active')
              .filter((membership) => {
                const user = fixture.users.get(membership.student_user_id);
                return user && (!activeUserFilter || (user.status === 'active' && user.role === 'student'));
              }).length;
          }
          if (query.includes('AS class_average')) {
            const activeUserFilter = query.includes('ON active_student.id = grade.student_user_id')
              && query.includes("active_student.status = 'active'")
              && query.includes("active_student.role = 'student'");
            const grades = fixture.studentTermGrades
              .filter((grade) => grade.class_id === classroom.id
               && grade.academic_year === classroom.academic_year
               && fixture.classMemberships.some((membership) => (
                 membership.class_id === classroom.id
                   && membership.student_user_id === grade.student_user_id
                   && membership.status === 'active'
               ))
               && fixture.teacherAssignments.some((assignment) => (
                 assignment.class_id === classroom.id
                   && assignment.teacher_user_id === teacherId
                   && assignment.revoked_at === null
                   && assignment.subject.trim().toLowerCase() === grade.subject.trim().toLowerCase()
               )))
              .filter((grade) => {
               const user = fixture.users.get(grade.student_user_id);
               return user && (!activeUserFilter || (user.status === 'active' && user.role === 'student'));
              });
            row.class_average = grades.length
              ? grades.reduce((total, grade) => total + grade.confirmed_average, 0) / grades.length
              : null;
          }
          return row;
        });
      return { rows };
    }
    if (query.startsWith('SELECT 1 FROM teacher_class_assignments')) {
      const [classId, teacherId, schoolId, subject] = values;
      const assigned = fixture.teacherAssignments.some((item) => (
        item.class_id === classId && item.teacher_user_id === teacherId && item.school_id === schoolId
          && item.revoked_at === null && item.subject.toLowerCase() === subject.trim().toLowerCase()
      ));
      return { rowCount: assigned ? 1 : 0, rows: assigned ? [{ '?column?': 1 }] : [] };
    }
    if (query.includes('FROM class_assignments a') && query.includes('jsonb_agg')) {
      const [classId, teacherId, academicYear, semester, subject] = values;
      const activeUserFilter = query.includes("u.status = 'active'") && query.includes("u.role = 'student'");
      const assignments = fixture.classAssignments
        .filter((assignment) => assignment.class_id === classId
          && assignment.teacher_user_id === teacherId
          && assignment.academic_year === academicYear
          && assignment.semester === semester
          && assignment.subject === subject);
      return {
        rows: assignments.map((assignment) => {
          const students = fixture.classMemberships
            .filter((membership) => membership.class_id === classId && membership.status === 'active')
            .flatMap((membership) => {
              const user = fixture.users.get(membership.student_user_id);
              if (!user || (activeUserFilter && (user.status !== 'active' || user.role !== 'student'))) return [];
              const submission = fixture.classAssignmentSubmissions.find((item) => (
                item.assignment_id === assignment.id && item.student_user_id === membership.student_user_id
              ));
              return [{
                id: membership.student_user_id,
                fullName: user.full_name,
                submittedAt: submission?.submitted_at ?? null,
                score: submission?.score ?? null,
                gradedAt: submission?.graded_at ?? null,
              }];
            });
          return {
            ...assignment,
            student_count: students.length,
            submitted_count: students.filter((student) => student.submittedAt).length,
            students,
          };
        }),
      };
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

async function request(path, userId, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(userId ? { Authorization: authHeader(userId) } : {}),
    },
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  const app = express();
  app.use(express.json());
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

test('student progress endpoints reject non-student accounts', async () => {
  const getResponse = await request('/student/progress', ids.teacherA);
  assert.equal(getResponse.status, 403);

  const analysisResponse = await request('/student/progress/analysis', ids.teacherA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(analysisResponse.status, 403);
});

test('lesson draft routes require a lecturer and validate draft IDs', async () => {
  const studentResponse = await request('/teacher/lesson-drafts', ids.studentA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(studentResponse.status, 403);

  const invalidDraftResponse = await request('/teacher/lesson-drafts/not-a-uuid', ids.teacherA);
  assert.equal(invalidDraftResponse.status, 400);
  assert.equal(invalidDraftResponse.body.code, 'SCHOOL_INVALID_ID');
});

test('student timetable endpoint enforces student access and a valid semester', async () => {
  const teacherResponse = await request('/student/timetable?semester=Kỳ%201', ids.teacherA);
  assert.equal(teacherResponse.status, 403);

  const invalidSemesterResponse = await request('/student/timetable?semester=unknown', ids.studentA);
  assert.equal(invalidSemesterResponse.status, 400);
  assert.equal(invalidSemesterResponse.body.code, 'SCHOOL_INVALID_SEMESTER');
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
  assert.equal(list.body.classes[0].student_count, 2);
  assert.equal(list.body.classes[0].class_average, 8);

  const crossClass = await request(`/classes/${ids.classB}`, ids.teacherA);
  assert.equal(crossClass.status, 404);
  fixture.teacherAssignments[0].revoked_at = new Date();
  const revoked = await request(`/classes/${ids.classA}`, ids.teacherA);
  assert.equal(revoked.status, 404);
});

test('a former homeroom teacher loses current class access after the assignment ends', async () => {
  const originalAssignments = fixture.teacherAssignments;
  const originalHomeroomAssignments = fixture.homeroomAssignments;
  fixture.teacherAssignments = originalAssignments.filter((item) => item.class_id !== ids.classA);
  fixture.homeroomAssignments = [{
    class_id: ids.classA,
    teacher_user_id: ids.teacherA,
    ended_at: null,
  }];

  try {
    const current = await request(`/classes/${ids.classA}`, ids.teacherA);
    assert.equal(current.status, 200);

    fixture.homeroomAssignments[0].ended_at = new Date();
    const ended = await request(`/classes/${ids.classA}`, ids.teacherA);
    assert.equal(ended.status, 404);
  } finally {
    fixture.teacherAssignments = originalAssignments;
    fixture.homeroomAssignments = originalHomeroomAssignments;
  }
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

test('teacher assignment lists hide disabled students and their submissions', async () => {
  const assignmentId = '40000000-0000-4000-8000-000000000002';
  fixture.classAssignments.push({
    id: assignmentId,
    class_id: ids.classA,
    teacher_user_id: ids.teacherA,
    title: 'Bài tập thử',
    description: '',
    subject: 'Ngữ văn',
    academic_year: '2026-2027',
    semester: 'Kỳ 1',
    chapter: null,
    lesson: null,
    period: null,
    due_at: new Date('2026-11-07T10:00:00.000Z'),
    created_at: new Date('2026-11-01T10:00:00.000Z'),
  });
  fixture.classAssignmentSubmissions.push({
    assignment_id: assignmentId,
    student_user_id: ids.disabledStudent,
    submitted_at: new Date('2026-11-06T10:00:00.000Z'),
    score: 9,
    graded_at: new Date('2026-11-06T11:00:00.000Z'),
  });

  const response = await request(
    `/classes/${ids.classA}/assignments?academicYear=2026-2027&semester=Kỳ%201&subject=Ngữ%20văn`,
    ids.teacherA,
  );
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.assignments.length, 1);
  assert.equal(response.body.assignments[0].studentCount, 2);
  assert.equal(response.body.assignments[0].submittedCount, 0);
  assert.ok(!response.body.assignments[0].students.some((student) => student.id === ids.disabledStudent));
});

test('unauthenticated and malformed class requests are rejected', async () => {
  const unauthenticated = await request('/classes');
  assert.equal(unauthenticated.status, 401);

  const malformed = await request('/classes/not-a-uuid', ids.systemAdmin);
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.code, 'SCHOOL_INVALID_ID');
});

test('teacher assessments are persisted and scoped to their owner and assessment kind', async () => {
  const assessment = {
    id: 'assignment-local-1',
    title: 'Ôn tập chương 1',
    subject: '',
    grade: 'Khối 10',
    topic: 'Hàm số',
    questions: [{ id: 'question-1', question: 'Tính 1 + 1', options: ['2'] }],
    status: 'draft',
  };
  const saved = await request('/teacher/assessments/assignment', ids.teacherA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assessment),
  });
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  assert.deepEqual(saved.body.assessment, {
    ...assessment,
    questions: [{ ...assessment.questions[0], type: 'multiple-choice' }],
    sections: [{
      id: 'section-multiple-choice',
      title: 'Phần I: Trắc nghiệm nhiều phương án',
      description: 'Thí sinh chọn một phương án đúng cho mỗi câu.',
      questionIds: ['question-1'],
      questionType: 'multiple-choice',
      questions: [{ ...assessment.questions[0], type: 'multiple-choice' }],
    }],
  });

  const listed = await request('/teacher/assessments/assignment', ids.teacherA);
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body.assessments, [saved.body.assessment]);
  const otherTeacher = await request('/teacher/assessments/assignment', ids.teacherB);
  assert.equal(otherTeacher.status, 200);
  assert.deepEqual(otherTeacher.body.assessments, []);

  const wrongKind = await request('/teacher/assessments/exam', ids.teacherA);
  assert.equal(wrongKind.status, 200);
  assert.deepEqual(wrongKind.body.assessments, []);

  const scoredExam = {
    id: 'exam-points-1',
    title: 'Đề chia điểm theo phần',
    subject: 'Toán học',
    grade: 'Khối 10',
    topic: 'Ôn tập',
    status: 'draft',
    sectionPoints: {
      'multiple-choice': 3,
      'true-false': 2,
      'short-answer': 2,
      essay: 3,
    },
    questions: [
      { type: 'multiple-choice', question: 'MC', points: 3 },
      { type: 'true-false', question: 'Đúng sai', points: 2 },
      { type: 'short-answer', question: 'Trả lời ngắn', points: 2 },
      { type: 'essay', question: 'Tự luận', points: 3 },
    ],
  };
  const savedScoredExam = await request('/teacher/assessments/exam', ids.teacherA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scoredExam),
  });
  assert.equal(savedScoredExam.status, 201);
  assert.deepEqual(savedScoredExam.body.assessment.sectionPoints, scoredExam.sectionPoints);
  assert.deepEqual(
    savedScoredExam.body.assessment.questions.map((question) => question.points),
    [3, 2, 2, 3],
  );
  const savedScoredExamList = await request('/teacher/assessments/exam', ids.teacherA);
  assert.equal(savedScoredExamList.body.assessments.length, 1);
  assert.deepEqual(savedScoredExamList.body.assessments[0].questions.map((question) => question.id), [
    'question-1', 'question-2', 'question-3', 'question-4',
  ]);
  assert.deepEqual(savedScoredExamList.body.assessments[0].sections.map((section) => section.title), [
    'Phần I: Trắc nghiệm nhiều phương án',
    'Phần II: Trắc nghiệm đúng / sai',
    'Phần III: Trắc nghiệm trả lời ngắn',
    'Phần IV: Tự luận',
  ]);
});

test('teacher assessments reject invalid data and require a lecturer account', async () => {
  const invalid = await request('/teacher/assessments/exam', ids.teacherA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'exam-1', title: '', subject: '', grade: '', topic: '', questions: [] }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, 'SCHOOL_INVALID_ASSESSMENT');

  const invalidScoring = await request('/teacher/assessments/exam', ids.teacherA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'exam-points-invalid',
      title: 'Đề sai tổng điểm',
      subject: 'Toán học',
      grade: 'Khối 10',
      topic: 'Ôn tập',
      sectionPoints: { 'multiple-choice': 3, 'true-false': 2, 'short-answer': 2, essay: 2 },
      questions: [{ type: 'multiple-choice', question: 'MC', points: 9 }],
    }),
  });
  assert.equal(invalidScoring.status, 400);
  assert.equal(invalidScoring.body.code, 'SCHOOL_INVALID_ASSESSMENT');

  const student = await request('/teacher/assessments/exam', ids.studentA);
  assert.equal(student.status, 403);
  const unauthenticated = await request('/teacher/assessments/exam');
  assert.equal(unauthenticated.status, 401);
});

test('teacher can delete only their own saved assessment', async () => {
  const assessment = {
    id: 'exam-local-1',
    title: 'Kiểm tra chương 1',
    subject: 'Toán học',
    grade: 'Khối 10',
    topic: 'Hàm số',
    questions: [],
  };
  await request('/teacher/assessments/exam', ids.teacherA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assessment),
  });
  const forbiddenDelete = await request('/teacher/assessments/exam/exam-local-1', ids.teacherB, { method: 'DELETE' });
  assert.equal(forbiddenDelete.status, 404);
  const deleted = await request('/teacher/assessments/exam/exam-local-1', ids.teacherA, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  const listed = await request('/teacher/assessments/exam', ids.teacherA);
  assert.deepEqual(listed.body.assessments, []);
});

test('assessment sections retain custom names and embed their question list', async () => {
  const assessment = {
    id: 'custom-sections-1',
    title: 'Ngữ văn',
    subject: 'Ngữ văn',
    grade: 'Khối 11',
    topic: 'Đọc hiểu và làm văn',
    questions: [
      { id: 'reading-1', type: 'essay', question: 'Đọc đoạn trích.', options: [] },
      { id: 'writing-1', type: 'essay', question: 'Viết bài văn.', options: [] },
    ],
    sections: [
      { id: 'reading', title: 'Phần I: Đọc hiểu', description: 'Đọc văn bản và trả lời.', questionIds: ['reading-1'] },
      { id: 'writing', title: 'Phần II: Làm văn', description: 'Trình bày bài viết.', questionIds: ['writing-1'] },
    ],
    status: 'draft',
  };
  const saved = await request('/teacher/assessments/assignment', ids.teacherA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assessment),
  });
  assert.equal(saved.status, 201);
  assert.deepEqual(saved.body.assessment.sections.map(({ id, title, description, questionIds, questions }) => ({
    id, title, description, questionIds, questions: questions.map(({ id: questionId }) => questionId),
  })), [
    { id: 'reading', title: 'Phần I: Đọc hiểu', description: 'Đọc văn bản và trả lời.', questionIds: ['reading-1'], questions: ['reading-1'] },
    { id: 'writing', title: 'Phần II: Làm văn', description: 'Trình bày bài viết.', questionIds: ['writing-1'], questions: ['writing-1'] },
  ]);
  const invalid = await request('/teacher/assessments/assignment', ids.teacherA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...assessment, id: 'custom-sections-invalid', sections: [assessment.sections[0]] }),
  });
  assert.equal(invalid.status, 400);
});

test('essay-only legacy assessment starts at section I', async () => {
  const response = await request('/teacher/assessments/exam', ids.teacherA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'essay-only',
      title: 'Tự luận',
      subject: 'Ngữ văn',
      grade: 'Khối 11',
      topic: 'Viết',
      questions: [{ id: 'essay-1', type: 'essay', question: 'Viết đoạn văn.', options: [] }],
    }),
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.assessment.sections.length, 1);
  assert.equal(response.body.assessment.sections[0].title, 'Phần I: Tự luận');
  assert.deepEqual(response.body.assessment.sections[0].questions.map(({ id }) => id), ['essay-1']);
});

test('teacher exam rooms are saved, isolated by owner, and only accept ready exams', async () => {
  const exam = {
    id: 'ready-exam-1',
    title: 'Kiểm tra chương 1',
    subject: 'Toán học',
    grade: '10',
    topic: 'Hàm số',
    createdAt: '2026-10-28',
    durationMinutes: 45,
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'Tính 1 + 1',
        options: ['2', '3', '4', '5'],
        correctIndex: 0,
        correctAnswer: '2',
        explanation: 'Cộng hai số hạng để được 2.',
        points: 1,
      },
      {
        id: 'q2',
        type: 'true-false',
        question: 'Chọn đúng hoặc sai cho từng ý.',
        options: ['Ý a', 'Ý b', 'Ý c', 'Ý d'],
        correctAnswers: [true, false, true, false],
        points: 1,
      },
      {
        id: 'q3',
        type: 'short-answer',
        question: 'Nhập một nửa.',
        options: [],
        correctAnswer: '0.5 || 1/2',
        points: 1,
      },
      {
        id: 'q4',
        type: 'essay',
        question: 'Trình bày lời giải.',
        options: [],
        correctAnswer: 'Có lập luận phù hợp.',
        points: 2,
      },
    ],
    sections: [
      {
        id: 'reading',
        title: 'Phần I: Đọc hiểu',
        description: 'Đọc dữ liệu và chọn câu trả lời.',
        questionIds: ['q1'],
      },
      {
        id: 'judgement',
        title: 'Phần II: Nhận định',
        description: 'Đánh giá các nhận định.',
        questionIds: ['q2'],
      },
      {
        id: 'short',
        title: 'Phần III: Trả lời ngắn',
        description: 'Ghi câu trả lời.',
        questionIds: ['q3'],
      },
      {
        id: 'writing',
        title: 'Phần IV: Trình bày',
        description: 'Trình bày lời giải.',
        questionIds: ['q4'],
      },
    ],
    status: 'ready',
  };
  const savedExam = await request('/teacher/assessments/exam', ids.teacherB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(exam),
  });
  assert.equal(savedExam.status, 201);

  const localDateParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date()).map(({ type, value }) => [type, value]),
  );
  const localDateUtc = Date.UTC(
    Number(localDateParts.year),
    Number(localDateParts.month) - 1,
    Number(localDateParts.day),
  );
  const localWeekday = new Date(localDateUtc).getUTCDay();
  const daysUntilMonday = (8 - localWeekday) % 7 || 7;
  const startsAt = new Date(localDateUtc + daysUntilMonday * 24 * 60 * 60_000 + 15 * 60_000).toISOString();
  const room = {
    id: '40000000-0000-4000-8000-000000000001',
    code: 'A1B2C3',
    title: 'Kiểm tra chương 1 - 10A1',
    instructions: 'Đọc kỹ câu hỏi.',
    classIds: [ids.classB],
    classNames: ['Giá trị không tin cậy'],
    studentCount: 38,
    startsAt,
    durationMinutes: 45,
    status: 'scheduled',
    examId: exam.id,
    examSnapshot: { ...exam, subject: 'Sinh học' },
    settings: {
      shuffleQuestions: false,
      allowBackNavigation: true,
      allowEarlySubmit: true,
      requireCamera: true,
      requireMicrophone: false,
      monitorTabSwitch: true,
      monitorConnection: true,
      warningThreshold: 1,
    },
    sessions: [],
    createdAt: '2026-10-28T00:00:00.000Z',
    isDemo: false,
  };
  const savedRoom = await request('/teacher/exam-rooms', ids.teacherB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(room),
  });
  assert.equal(savedRoom.status, 201, JSON.stringify(savedRoom.body));
  assert.equal(savedRoom.body.room.classNames[0], 'Lớp 10B1');
  assert.equal(savedRoom.body.room.examSnapshot.id, exam.id);
  assert.equal(savedRoom.body.room.examSnapshot.subject, 'Toán học');
  assert.equal(savedRoom.body.room.isDemo, false);
  assert.match(savedRoom.body.room.code, /^[A-HJ-NP-Z2-9]{8}$/);
  const roomEvent = [...fixture.classTimetableEvents.values()]
    .find((event) => event.source_exam_room_id === room.id);
  assert.ok(roomEvent);
  assert.equal(roomEvent.class_id, ids.classB);
  assert.equal(roomEvent.has_exam, true);
  assert.equal(roomEvent.subject, 'Toán học');
  assert.equal(roomEvent.exam_title, room.title);
  assert.equal(getExamPeriodSlot(room.startsAt).period, 1);

  await request('/teacher/assessments/exam', ids.teacherB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...exam, title: 'Đề đã chỉnh sửa sau khi lập phòng' }),
  });
  const updatedRoom = await request(`/teacher/exam-rooms/${room.id}`, ids.teacherB, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(savedRoom.body.room),
  });
  assert.equal(updatedRoom.status, 200);
  assert.equal(updatedRoom.body.room.examSnapshot.title, exam.title);
  assert.equal(updatedRoom.body.room.code, savedRoom.body.room.code);
  assert.equal(
    [...fixture.classTimetableEvents.values()].filter((event) => event.source_exam_room_id === room.id).length,
    1,
  );
  const outsidePeriodRoom = await request(`/teacher/exam-rooms/${room.id}`, ids.teacherB, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...updatedRoom.body.room,
      startsAt: new Date(Date.parse(startsAt) + 5 * 60 * 60_000).toISOString(),
    }),
  });
  assert.equal(outsidePeriodRoom.status, 200);
  assert.equal(
    [...fixture.classTimetableEvents.values()].some((event) => event.source_exam_room_id === room.id),
    false,
  );
  await request(`/teacher/exam-rooms/${room.id}`, ids.teacherB, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedRoom.body.room),
  });

  const disabledSessionId = '50000000-0000-4000-8000-000000000001';
  fixture.examSessions.set(disabledSessionId, {
    id: disabledSessionId,
    room_id: room.id,
    student_user_id: ids.disabledStudent,
    class_id: ids.classB,
    status: 'submitted',
    started_at: new Date(),
    submitted_at: new Date(),
    last_activity_at: new Date(),
  });
  const listed = await request('/teacher/exam-rooms', ids.teacherB);
  fixture.examSessions.delete(disabledSessionId);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.rooms.length, 1);
  assert.equal(listed.body.rooms[0].code, updatedRoom.body.room.code);
  assert.deepEqual(
    listed.body.rooms[0].sessions.map(({ studentId, status }) => ({ studentId, status })),
    [
      { studentId: ids.studentB, status: 'not-started' },
      { studentId: ids.rosterStudent, status: 'not-started' },
    ],
  );
  const otherTeacher = await request('/teacher/exam-rooms', ids.teacherA);
  assert.equal(otherTeacher.status, 200);
  assert.deepEqual(otherTeacher.body.rooms, []);
  const otherTeacherGrading = await request(`/teacher/exam-rooms/${room.id}/grading`, ids.teacherA);
  assert.equal(otherTeacherGrading.status, 404);
  const teacherExamResults = await request('/student/exam-results', ids.teacherB);
  assert.equal(teacherExamResults.status, 403);

  const studentRooms = await request('/student/exam-rooms', ids.studentB);
  assert.equal(studentRooms.status, 200);
  assert.equal(studentRooms.body.rooms.length, 1);
  assert.equal(studentRooms.body.rooms[0].code, savedRoom.body.room.code);
  assert.equal(studentRooms.body.rooms[0].startsAt, savedRoom.body.room.startsAt);
  assert.equal(studentRooms.body.rooms[0].hasSubmitted, false);
  assert.equal(studentRooms.body.rooms[0].settings.requireCamera, true);
  assert.equal(studentRooms.body.rooms[0].settings.monitorFace, false);
  assert.equal(studentRooms.body.rooms[0].settings.monitorSpeech, false);
  assert.equal(studentRooms.body.rooms[0].examSnapshot.questions[0].question, 'Tính 1 + 1');
  assert.equal(studentRooms.body.rooms[0].examSnapshot.questions[0].sectionTitle, 'Phần I: Đọc hiểu');
  assert.equal(studentRooms.body.rooms[0].examSnapshot.sections[0].title, 'Phần I: Đọc hiểu');
  assert.equal(studentRooms.body.rooms[0].examSnapshot.questions[0].sectionDescription, 'Đọc dữ liệu và chọn câu trả lời.');
  assert.equal('questions' in studentRooms.body.rooms[0].examSnapshot.sections[0], false);
  assert.equal('correctIndex' in studentRooms.body.rooms[0].examSnapshot.questions[0], false);
  assert.equal('correctAnswer' in studentRooms.body.rooms[0].examSnapshot.questions[0], false);
  fixture.examRooms.get(room.id).status = 'closed';
  assert.equal((await request('/student/exam-rooms', ids.studentB)).body.rooms[0].status, 'closed');
  fixture.examRooms.get(room.id).status = 'scheduled';
  const unrelatedStudentRooms = await request('/student/exam-rooms', ids.studentA);
  assert.deepEqual(unrelatedStudentRooms.body.rooms, []);

  const closedStart = await request(`/student/exam-rooms/${room.id}/start`, ids.studentB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(closedStart.status, 409);

  let roomFixture = fixture.examRooms.get(room.id);
  roomFixture.payload.settings.monitorFace = true;
  roomFixture.payload.startsAt = new Date(Date.now() - 5 * 60_000).toISOString();
  roomFixture.starts_at = new Date(roomFixture.payload.startsAt);
  const scheduledStart = await request(`/student/exam-rooms/${room.id}/start`, ids.studentB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(scheduledStart.status, 201);

  const openRoom = await request(`/teacher/exam-rooms/${room.id}`, ids.teacherB, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...updatedRoom.body.room, status: 'open' }),
  });
  assert.equal(openRoom.status, 200);
  roomFixture = fixture.examRooms.get(room.id);
  roomFixture.payload.settings.monitorFace = true;
  roomFixture.payload.startsAt = new Date(Date.now() - 60 * 60_000).toISOString();
  roomFixture.starts_at = new Date(roomFixture.payload.startsAt);
  const expiredStart = await request(`/student/exam-rooms/${room.id}/start`, ids.studentB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(expiredStart.status, 409);
  roomFixture.payload.startsAt = new Date(Date.now() - 5 * 60_000).toISOString();
  roomFixture.starts_at = new Date(roomFixture.payload.startsAt);
  const started = await request(`/student/exam-rooms/${room.id}/start`, ids.studentB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(started.status, 201);
  const behaviorLogData = {
    event_type: 'face_missing',
    timestamp: new Date().toISOString(),
    duration_seconds: 3.2,
  };
  const behaviorLog = await request(
    `/student/exam-sessions/${started.body.session.id}/behavior-logs`,
    ids.studentB,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(behaviorLogData),
    },
  );
  assert.equal(behaviorLog.status, 201);
  assert.deepEqual(behaviorLog.body, { success: true, saved: true, duplicate: false });
  assert.equal(fixture.examLogs.length, 1);
  assert.equal(fixture.examSessions.get(`${room.id}:${ids.studentB}`).status, 'in-progress');
  const teacherExamRooms = await request('/teacher/exam-rooms', ids.teacherB);
  assert.equal(teacherExamRooms.status, 200);
  const teacherRoom = teacherExamRooms.body.rooms.find((item) => item.id === room.id);
  const teacherSession = teacherRoom.sessions.find((item) => item.id === started.body.session.id);
  assert.equal(teacherSession.behaviorLogCount, 1);
  assert.equal(teacherSession.behaviorLogs[0].eventType, 'face_missing');
  assert.equal(teacherSession.behaviorLogs[0].durationSeconds, 3.2);
  const duplicateBehaviorLog = await request(
    `/student/exam-sessions/${started.body.session.id}/behavior-logs`,
    ids.studentB,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...behaviorLogData, timestamp: new Date().toISOString() }),
    },
  );
  assert.equal(duplicateBehaviorLog.status, 200);
  assert.deepEqual(duplicateBehaviorLog.body, { success: true, saved: false, duplicate: true });
  assert.equal(fixture.examLogs.length, 1);
  const unauthorizedBehaviorLog = await request(
    `/student/exam-sessions/${started.body.session.id}/behavior-logs`,
    ids.studentA,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(behaviorLogData),
    },
  );
  assert.equal(unauthorizedBehaviorLog.status, 404);
  const invalidBehaviorLog = await request(
    `/student/exam-sessions/${started.body.session.id}/behavior-logs`,
    ids.studentB,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...behaviorLogData, duration_seconds: 1 }),
    },
  );
  assert.equal(invalidBehaviorLog.status, 400);
  const disabledBehaviorLog = await request(
    `/student/exam-sessions/${started.body.session.id}/behavior-logs`,
    ids.studentB,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'speech_activity',
        timestamp: new Date().toISOString(),
        duration_seconds: 1.5,
      }),
    },
  );
  assert.equal(disabledBehaviorLog.status, 403);
  fixture.mobileUploadSchemaAvailable = false;
  const missingMobileUploadMigration = await request(
    `/student/exam-sessions/${started.body.session.id}/mobile-upload-sessions`,
    ids.studentB,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionNumber: 4 }),
    },
  );
  assert.equal(missingMobileUploadMigration.status, 503);
  assert.match(missingMobileUploadMigration.body.message, /migration 020_student_exam_mobile_uploads/i);
  fixture.mobileUploadSchemaAvailable = true;
  const event = await request(`/student/exam-sessions/${started.body.session.id}/events`, ids.studentB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'tab-hidden' }),
  });
  assert.equal(event.status, 201);
  assert.equal(event.body.eventCount, 1);
  assert.equal(event.body.needsReview, true);
  const gradeBeforeSubmission = await request(
    `/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/grade`,
    ids.teacherB,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionScores: { q1: 1, q2: 0.1, q3: 1, q4: 1 },
        teacherFeedback: '',
      }),
    },
  );
  assert.equal(gradeBeforeSubmission.status, 409);
  const invalidEvent = await request(`/student/exam-sessions/${started.body.session.id}/events`, ids.studentB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'camera-recording' }),
  });
  assert.equal(invalidEvent.status, 400);

  const teacherMonitor = await request('/teacher/exam-rooms', ids.teacherB);
  assert.equal(teacherMonitor.status, 200);
  const flaggedSession = teacherMonitor.body.rooms[0].sessions.find((session) => session.studentId === ids.studentB);
  assert.equal(flaggedSession.status, 'review');
  assert.equal(flaggedSession.eventCount, 1);
  assert.equal(teacherMonitor.body.rooms[0].sessions.length, 2);
  const submissionAnswers = {
    1: '0',
    2: JSON.stringify({ 0: 'Đúng' }),
    3: '1/2',
    4: 'Bài giải tự luận',
  };
  roomFixture.payload.examSnapshot.questions[1].correctAnswers = [true];
  const invalidAnswerKeySubmission = await request(
    `/student/exam-sessions/${started.body.session.id}/submit`,
    ids.studentB,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: submissionAnswers }),
    },
  );
  assert.equal(invalidAnswerKeySubmission.status, 409);
  const pendingSession = fixture.examSessions.get(`${room.id}:${ids.studentB}`);
  assert.equal(pendingSession.status, 'review');
  assert.deepEqual(pendingSession.answers, {});
  roomFixture.payload.examSnapshot.questions[1].correctAnswers = [true, false, true, false];
  const mobileUploadSession = await request(
    `/student/exam-sessions/${started.body.session.id}/mobile-upload-sessions`,
    ids.studentB,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionNumber: 4 }),
    },
  );
  assert.equal(mobileUploadSession.status, 201);
  const mobileToken = mobileUploadSession.body.uploadSession.token;
  assert.match(mobileToken, /^[A-Za-z0-9_-]{43}$/);
  const pendingMobileUpload = await request(
    `/check-session?session=${encodeURIComponent(mobileToken)}`,
  );
  assert.equal(pendingMobileUpload.status, 200);
  assert.equal(pendingMobileUpload.body.status, 'pending');
  const invalidMobileUploadForm = new FormData();
  invalidMobileUploadForm.append('session', mobileToken);
  invalidMobileUploadForm.append('file', new Blob(['not a png']), 'invalid.png');
  const invalidMobileUpload = await request('/upload-temporary', undefined, {
    method: 'POST',
    body: invalidMobileUploadForm,
  });
  assert.equal(invalidMobileUpload.status, 400);
  const mobileUploadForm = new FormData();
  mobileUploadForm.append('session', mobileToken);
  mobileUploadForm.append(
    'file',
    new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]),
    'phone-work.png',
  );
  const mobileUpload = await request('/upload-temporary', undefined, {
    method: 'POST',
    body: mobileUploadForm,
  });
  assert.equal(mobileUpload.status, 200);
  const completeMobileUpload = await request(
    `/check-session?session=${encodeURIComponent(mobileToken)}`,
  );
  assert.equal(completeMobileUpload.status, 200);
  assert.equal(completeMobileUpload.body.status, 'success');
  assert.match(completeMobileUpload.body.imageUrl, /^\/api\/check-session\/image\?/);
  const temporaryImage = await fetch(`${baseUrl.replace(/\/api$/, '')}${completeMobileUpload.body.imageUrl}`);
  assert.equal(temporaryImage.status, 200);
  assert.equal(temporaryImage.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(
    Buffer.from(await temporaryImage.arrayBuffer()),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  const invalidMobileUploadSession = await request(
    `/student/exam-sessions/${started.body.session.id}/mobile-upload-sessions`,
    ids.studentB,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionNumber: 1 }),
    },
  );
  assert.equal(invalidMobileUploadSession.status, 400);
  const disposableMobileSession = await request(
    `/student/exam-sessions/${started.body.session.id}/mobile-upload-sessions`,
    ids.studentB,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionNumber: 4 }),
    },
  );
  assert.equal(disposableMobileSession.status, 201);
  const disposableToken = disposableMobileSession.body.uploadSession.token;
  const unauthorizedDeleteTemporary = await request('/delete-temporary', ids.studentA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: started.body.session.id, session: disposableToken }),
  });
  assert.equal(unauthorizedDeleteTemporary.status, 200);
  assert.equal(unauthorizedDeleteTemporary.body.deleted, false);
  const deletedTemporary = await request('/delete-temporary', ids.studentB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: started.body.session.id, session: disposableToken }),
  });
  assert.equal(deletedTemporary.status, 200);
  assert.equal(deletedTemporary.body.deleted, true);
  const deletedMobileStatus = await request(
    `/check-session?session=${encodeURIComponent(disposableToken)}`,
  );
  assert.equal(deletedMobileStatus.status, 410);
  const examSubmission = new FormData();
  examSubmission.append('answers', JSON.stringify(submissionAnswers));
  examSubmission.append(
    'files',
    new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]),
    'work.png',
  );
  examSubmission.append('fileQuestionNumbers', '4');
  examSubmission.append('mobileUploadTokens', mobileToken);
  const submitted = await request(`/student/exam-sessions/${started.body.session.id}/submit`, ids.studentB, {
    method: 'POST',
    body: examSubmission,
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.result.answered, 4);
  assert.equal(submitted.body.result.total, 4);
  assert.deepEqual(submitted.body.result.automaticScores, { q1: 1, q2: 0.1, q3: 1 });
  assert.equal(submitted.body.result.automaticTotal, 2.1);
  assert.deepEqual(submitted.body.result.manualQuestionIds, ['q4']);
  assert.ok(submitted.body.result.submittedAt);
  roomFixture.payload.startsAt = new Date(Date.now() - 60 * 60_000).toISOString();
  roomFixture.starts_at = new Date(roomFixture.payload.startsAt);
  const submittedRooms = await request('/student/exam-rooms', ids.studentB);
  assert.equal(submittedRooms.body.rooms[0].hasSubmitted, true);
  assert.equal(submittedRooms.body.rooms[0].status, 'completed');
  const endedTeacherRooms = await request('/teacher/exam-rooms', ids.teacherB);
  assert.equal(endedTeacherRooms.body.rooms[0].status, 'completed');

  const gradingDetail = await request(`/teacher/exam-rooms/${room.id}/grading`, ids.teacherB);
  assert.equal(gradingDetail.status, 200);
  assert.equal(gradingDetail.body.students.length, 2);
  const submittedStudent = gradingDetail.body.students.find((student) => student.studentId === ids.studentB);
  assert.ok(submittedStudent);
  assert.equal(submittedStudent.status, 'submitted');
  assert.deepEqual(submittedStudent.answers, submissionAnswers);
  assert.equal(submittedStudent.files.length, 2);
  const publishBeforeGrading = await request(
    `/teacher/exam-rooms/${room.id}/publish-grades`,
    ids.teacherB,
    { method: 'POST' },
  );
  assert.equal(publishBeforeGrading.status, 409);
  const [submittedFile] = submittedStudent.files;
  assert.equal(submittedFile.questionNumber, 4);
  assert.equal(submittedFile.name, 'work.png');
  const fileResponse = await fetch(
    `${baseUrl}/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/files/${submittedFile.id}`,
    { headers: { Authorization: authHeader(ids.teacherB) } },
  );
  assert.equal(fileResponse.status, 200);
  assert.equal(fileResponse.headers.get('content-type'), 'image/png');
  assert.deepEqual(
    Buffer.from(await fileResponse.arrayBuffer()),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  const studentFileResponse = await fetch(
    `${baseUrl}/student/exam-results/${started.body.session.id}/files/${submittedFile.id}`,
    { headers: { Authorization: authHeader(ids.studentB) } },
  );
  assert.equal(studentFileResponse.status, 404);
  const otherStudentFileResponse = await request(
    `/student/exam-results/${started.body.session.id}/files/${submittedFile.id}`,
    ids.studentA,
  );
  assert.equal(otherStudentFileResponse.status, 404);
  const phoneSubmissionFile = submittedStudent.files.find((file) => file.name === 'phone-work.png');
  assert.ok(phoneSubmissionFile);
  assert.equal(phoneSubmissionFile.questionNumber, 4);
  const phoneSubmissionResponse = await fetch(
    `${baseUrl}/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/files/${phoneSubmissionFile.id}`,
    { headers: { Authorization: authHeader(ids.teacherB) } },
  );
  assert.equal(phoneSubmissionResponse.status, 200);
  assert.equal(fixture.mobileExamUploads.size, 0);
  const otherTeacherFileResponse = await request(
    `/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/files/${submittedFile.id}`,
    ids.teacherA,
  );
  assert.equal(otherTeacherFileResponse.status, 404);
  assert.deepEqual(submittedStudent.automaticScores, { q1: 1, q2: 0.1, q3: 1 });
  assert.equal(submittedStudent.grade, null);
  const unpublishedExamResults = await request('/student/exam-results', ids.studentB);
  assert.deepEqual(unpublishedExamResults.body.results, []);
  const savedGrade = await request(
    `/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/grade`,
    ids.teacherB,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionScores: { q1: 1, q2: 0.1, q3: 1, q4: 1 },
        teacherFeedback: 'Tốt.',
      }),
    },
  );
  assert.equal(savedGrade.status, 200);
  assert.equal(savedGrade.body.grade.totalScore, 3.1);
  assert.deepEqual(savedGrade.body.grade.questionScores, { q1: 1, q2: 0.1, q3: 1, q4: 1 });
  assert.equal((await request('/student/exam-results', ids.studentB)).body.results.length, 0);
  const unauthorizedPublication = await request(
    `/teacher/exam-rooms/${room.id}/publish-grades`,
    ids.teacherA,
    { method: 'POST' },
  );
  assert.equal(unauthorizedPublication.status, 404);
  const studentPublication = await request(
    `/teacher/exam-rooms/${room.id}/publish-grades`,
    ids.studentB,
    { method: 'POST' },
  );
  assert.equal(studentPublication.status, 403);
  const publication = await request(
    `/teacher/exam-rooms/${room.id}/publish-grades`,
    ids.teacherB,
    { method: 'POST' },
  );
  assert.equal(publication.status, 200);
  assert.equal(publication.body.publication.publishedCount, 1);
  assert.equal(publication.body.publication.totalPublishedCount, 1);
  const publishedStudentFile = await fetch(
    `${baseUrl}/student/exam-results/${started.body.session.id}/files/${submittedFile.id}`,
    { headers: { Authorization: authHeader(ids.studentB) } },
  );
  assert.equal(publishedStudentFile.status, 200);
  assert.equal(publishedStudentFile.headers.get('cache-control'), 'private, no-store');
  const ownExamResults = await request('/student/exam-results', ids.studentB);
  assert.equal(ownExamResults.status, 200);
  assert.equal(ownExamResults.body.results.length, 1);
  assert.equal(ownExamResults.body.results[0].sessionId, started.body.session.id);
  assert.equal(ownExamResults.body.results[0].grade.teacherFeedback, 'Tốt.');
  assert.equal(ownExamResults.body.results[0].grade.isRead, false);
  assert.equal(ownExamResults.body.results[0].questions[0].explanation, 'Cộng hai số hạng để được 2.');
  assert.equal(ownExamResults.body.results[0].questions[0].correctAnswer, '2');
  assert.equal(ownExamResults.body.results[0].files.length, 2);
  const otherStudentRead = await request(
    `/student/exam-results/${started.body.session.id}/read`,
    ids.studentA,
    { method: 'POST' },
  );
  assert.equal(otherStudentRead.status, 404);
  const teacherRead = await request(
    `/student/exam-results/${started.body.session.id}/read`,
    ids.teacherB,
    { method: 'POST' },
  );
  assert.equal(teacherRead.status, 403);
  const markRead = await request(
    `/student/exam-results/${started.body.session.id}/read`,
    ids.studentB,
    { method: 'POST' },
  );
  assert.equal(markRead.status, 200);
  assert.ok(markRead.body.readState.readAt);
  const readExamResults = await request('/student/exam-results', ids.studentB);
  assert.equal(readExamResults.body.results[0].grade.isRead, true);
  const unrelatedExamResults = await request('/student/exam-results', ids.studentA);
  assert.deepEqual(unrelatedExamResults.body.results, []);
  const refreshedGradingDetail = await request(`/teacher/exam-rooms/${room.id}/grading`, ids.teacherB);
  const refreshedStudent = refreshedGradingDetail.body.students.find((student) => student.studentId === ids.studentB);
  assert.equal(refreshedStudent.grade.teacherFeedback, 'Tốt.');
  assert.deepEqual(refreshedStudent.grade.questionFeedback, {});
  const gradeUpdate = new FormData();
  gradeUpdate.append('questionScores', JSON.stringify({ q1: 1, q2: 0.1, q3: 1, q4: 1 }));
  gradeUpdate.append('questionFeedback', JSON.stringify({ q4: 'Trình bày rõ ràng.' }));
  gradeUpdate.append('teacherFeedback', 'Tốt.');
  gradeUpdate.append('deletedEvidenceIds', JSON.stringify([]));
  gradeUpdate.append('evidenceQuestionIds', 'q4');
  gradeUpdate.append(
    'evidenceFiles',
    new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]),
    'proof.png',
  );
  const updatedGrade = await request(
    `/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/grade`,
    ids.teacherB,
    { method: 'PUT', body: gradeUpdate },
  );
  assert.equal(updatedGrade.status, 200);
  assert.equal(updatedGrade.body.grade.publishedAt, publication.body.publication.publishedAt);
  assert.deepEqual(updatedGrade.body.grade.questionFeedback, { q4: 'Trình bày rõ ràng.' });
  assert.equal(updatedGrade.body.grade.evidenceFiles.length, 1);
  const refreshedPublication = await request(
    `/teacher/exam-rooms/${room.id}/publish-grades`,
    ids.teacherB,
    { method: 'POST' },
  );
  assert.equal(refreshedPublication.status, 200);
  assert.equal(refreshedPublication.body.publication.publishedCount, 1);
  const [gradeEvidence] = updatedGrade.body.grade.evidenceFiles;
  assert.equal(gradeEvidence.questionId, 'q4');
  assert.equal(gradeEvidence.name, 'proof.png');
  const reviewedExamResults = await request('/student/exam-results', ids.studentB);
  assert.equal(reviewedExamResults.body.results[0].grade.evidenceFiles.length, 1);
  assert.equal(reviewedExamResults.body.results[0].grade.isRead, false);
  const studentGradeEvidence = await fetch(
    `${baseUrl}/student/exam-results/${started.body.session.id}/grade-files/${gradeEvidence.id}`,
    { headers: { Authorization: authHeader(ids.studentB) } },
  );
  assert.equal(studentGradeEvidence.status, 200);
  const otherStudentGradeEvidence = await request(
    `/student/exam-results/${started.body.session.id}/grade-files/${gradeEvidence.id}`,
    ids.studentA,
  );
  assert.equal(otherStudentGradeEvidence.status, 404);
  const gradeEvidenceResponse = await fetch(
    `${baseUrl}/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/grade-files/${gradeEvidence.id}`,
    { headers: { Authorization: authHeader(ids.teacherB) } },
  );
  assert.equal(gradeEvidenceResponse.status, 200);
  assert.equal(gradeEvidenceResponse.headers.get('content-type'), 'image/png');
  assert.deepEqual(
    Buffer.from(await gradeEvidenceResponse.arrayBuffer()),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  const otherTeacherEvidenceResponse = await request(
    `/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/grade-files/${gradeEvidence.id}`,
    ids.teacherA,
  );
  assert.equal(otherTeacherEvidenceResponse.status, 404);
  const reloadedGrade = await request(`/teacher/exam-rooms/${room.id}/grading`, ids.teacherB);
  const reloadedStudent = reloadedGrade.body.students.find((student) => student.studentId === ids.studentB);
  assert.deepEqual(reloadedStudent.grade.questionFeedback, { q4: 'Trình bày rõ ràng.' });
  assert.equal(reloadedStudent.grade.evidenceFiles[0].id, gradeEvidence.id);
  const nonEssayEvidence = new FormData();
  nonEssayEvidence.append('questionScores', JSON.stringify({ q1: 1, q2: 0.1, q3: 1, q4: 1 }));
  nonEssayEvidence.append('questionFeedback', JSON.stringify({}));
  nonEssayEvidence.append('teacherFeedback', 'Tốt.');
  nonEssayEvidence.append('deletedEvidenceIds', JSON.stringify([]));
  nonEssayEvidence.append('evidenceQuestionIds', 'q1');
  nonEssayEvidence.append(
    'evidenceFiles',
    new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]),
    'not-essay.png',
  );
  const rejectedNonEssayEvidence = await request(
    `/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/grade`,
    ids.teacherB,
    { method: 'PUT', body: nonEssayEvidence },
  );
  assert.equal(rejectedNonEssayEvidence.status, 400);
  const invalidQuestionFeedback = await request(
    `/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/grade`,
    ids.teacherB,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionScores: { q1: 1, q2: 0.1, q3: 1, q4: 1 },
        questionFeedback: { q1: 'Không thể ghi lời phê cho câu trắc nghiệm.' },
        teacherFeedback: '',
      }),
    },
  );
  assert.equal(invalidQuestionFeedback.status, 400);
  const removeGradeEvidence = new FormData();
  removeGradeEvidence.append('questionScores', JSON.stringify({ q1: 1, q2: 0.1, q3: 1, q4: 1 }));
  removeGradeEvidence.append('questionFeedback', JSON.stringify({ q4: 'Trình bày rõ ràng.' }));
  removeGradeEvidence.append('teacherFeedback', 'Tốt.');
  removeGradeEvidence.append('deletedEvidenceIds', JSON.stringify([gradeEvidence.id]));
  const gradeWithoutEvidence = await request(
    `/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/grade`,
    ids.teacherB,
    { method: 'PUT', body: removeGradeEvidence },
  );
  assert.equal(gradeWithoutEvidence.status, 200);
  assert.deepEqual(gradeWithoutEvidence.body.grade.evidenceFiles, []);
  const invalidGrade = await request(
    `/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/grade`,
    ids.teacherB,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionScores: { q1: 2, q2: 0.1, q3: 1, q4: 1 },
        teacherFeedback: '',
      }),
    },
  );
  assert.equal(invalidGrade.status, 400);
  const otherTeacherGrade = await request(
    `/teacher/exam-rooms/${room.id}/sessions/${started.body.session.id}/grade`,
    ids.teacherA,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionScores: { q1: 1 }, teacherFeedback: '' }),
    },
  );
  assert.equal(otherTeacherGrade.status, 404);

  const forbiddenDelete = await request(`/teacher/exam-rooms/${room.id}`, ids.teacherA, { method: 'DELETE' });
  assert.equal(forbiddenDelete.status, 404);
  const deleted = await request(`/teacher/exam-rooms/${room.id}`, ids.teacherB, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.equal([...fixture.classTimetableEvents.values()].some((event) => event.source_exam_room_id === room.id), false);

  const secondRoomId = '40000000-0000-4000-8000-000000000002';
  const secondStartsAt = new Date(Date.parse(startsAt) + 25 * 60 * 60_000).toISOString();
  const secondSlot = getExamPeriodSlot(secondStartsAt);
  const existingTimetableEvent = {
    class_id: ids.classB,
    school_id: ids.schoolB,
    teacher_user_id: ids.teacherB,
    operation: 'override',
    has_exam: false,
    source_exam_room_id: null,
    source_exam_room_created_event: false,
    has_homework: true,
    homework_title: 'Bài tập đã có',
  };
  fixture.classTimetableEvents.set(
    `${ids.classB}:${secondSlot.eventDate}:${secondSlot.period}`,
    existingTimetableEvent,
  );
  const mergedRoom = await request('/teacher/exam-rooms', ids.teacherB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...room, id: secondRoomId, startsAt: secondStartsAt }),
  });
  assert.equal(mergedRoom.status, 201);
  const mergedEvent = fixture.classTimetableEvents.get(
    `${ids.classB}:${secondSlot.eventDate}:${secondSlot.period}`,
  );
  assert.equal(mergedEvent.source_exam_room_id, secondRoomId);
  assert.equal(mergedEvent.source_exam_room_created_event, false);
  assert.equal(mergedEvent.homework_title, 'Bài tập đã có');
  const deletedMergedRoom = await request(`/teacher/exam-rooms/${secondRoomId}`, ids.teacherB, { method: 'DELETE' });
  assert.equal(deletedMergedRoom.status, 200);
  assert.equal(mergedEvent.has_exam, false);
  assert.equal(mergedEvent.source_exam_room_id, null);
  assert.equal(mergedEvent.homework_title, 'Bài tập đã có');

  await request('/teacher/assessments/exam', ids.teacherB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...exam, id: 'draft-exam-1', status: 'draft' }),
  });
  const draftRoom = await request('/teacher/exam-rooms', ids.teacherB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...room, examId: 'draft-exam-1' }),
  });
  assert.equal(draftRoom.status, 400);
  assert.equal(draftRoom.body.code, 'SCHOOL_EXAM_NOT_READY');
});
