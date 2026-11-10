const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { getPool } = require('../db/pool');
const {
  requireAccountReady,
  requireAuthForSchoolReads,
  requirePersistentAccount,
  requireRole,
} = require('../auth/middleware');
const {
  createClassAssignment,
  deleteClassAssignment,
  deleteClassAssignmentChapter,
  deleteClassAssignmentLesson,
  createClassLearningResource,
  createClassLearningResourceAsset,
  createClassLearningResourceChapter,
  createClassLearningResourceFile,
  createTeacherLessonDraft,
  createTeacherLessonDraftAsset,
  deleteClassLearningResource,
  deleteTeacherAssessment,
  deleteTeacherExamRoom,
  createStudentExamMobileUploadSession,
  deleteStudentExamMobileUpload,
  getTeacherExamGradeEvidenceFile,
  getStudentExamMobileImage,
  getStudentExamMobileUploadStatus,
  getTeacherExamRoomGrading,
  getTeacherExamSubmissionFile,
  deleteClassLearningResourceChapter,
  deleteClassLearningResourceLesson,
  getClass,
  getHomeroomClassGradeSummary,
  listClassAssignmentSubmissions,
  getClassAssignmentSubmissionFile,
  getClassLearningResourceFile,
  getClassLearningResourceAsset,
  getTeacherLessonDraft,
  getTeacherLessonDraftAsset,
  getClassGradebook,
  listClasses,
  listClassAssignments,
  listClassLearningResources,
  listClassLearningResourceChapters,
  listClassStudents,
  listStudentExamRooms,
  listStudentExamResults,
  markStudentExamResultRead,
  getStudentExamResultFile,
  listStudentAssignments,
  listStudentLearningResources,
  getStudentTimetable,
  listStudentSubjectAverages,
  listTeacherClassSubjects,
  listTeacherAssessments,
  listTeacherExamRooms,
  publishTeacherExamRoomGrades,
  saveClassGradebook,
  saveStudentGrades,
  saveClassAssignmentGrade,
  saveTeacherAssessment,
  saveTeacherExamRoom,
  saveTeacherExamSessionGrade,
  startStudentExamSession,
  uploadStudentExamMobileImage,
  recordStudentExamEvent,
  recordStudentExamBehaviorLog,
  submitStudentExamSession,
  submitClassAssignment,
  updateClassAssignment,
  updateClassLearningResource,
  updateTeacherLessonDraft,
  renameClassAssignmentChapter,
  renameClassAssignmentLesson,
  renameClassLearningResourceChapter,
  renameClassLearningResourceLesson,
} = require('../services/school.service');
const {
  createExamAppealsService,
} = require('../services/examAppeals.service');
const { createNotificationsService } = require('../services/notifications.service');
const { createStudentLearningActivityService } = require('../services/studentLearningActivity.service');
const {
  analyzeStudentProgress,
  getStudentProgress,
} = require('../services/studentProgress.service');
const {
  analyzeTeacherClassProgress,
} = require('../services/teacherProgressAnalysis.service');
const {
  generateStudentTimetableSuggestion,
  generateTeacherTimetableSuggestion,
  getTeacherTimetable,
  saveTeacherTimetable,
  validateWeekStart,
} = require('../services/timetable.service');

const router = express.Router();
const examAppeals = createExamAppealsService();
const notifications = createNotificationsService(getPool);
const studentLearningActivity = createStudentLearningActivityService(getPool);
const resourceFileUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 12, parts: 13 },
});
const lessonImageUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
});
const assignmentSubmissionUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: { fileSize: 10 * 1024 * 1024, files: 5, fields: 1, parts: 6 },
});
const examSubmissionUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
    fields: 11,
    fieldSize: 102400,
    parts: 16,
  },
});
const mobileExamUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, fieldSize: 128, parts: 2 },
});
const teacherExamGradeUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
    fields: 10,
    fieldSize: 102400,
    parts: 15,
  },
});
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mobileExamUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều lần gửi ảnh. Vui lòng thử lại sau.' },
});
const mobileExamCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều lần kiểm tra mã ảnh. Vui lòng thử lại sau.' },
});

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function parseResourceFile(req, res, next) {
  resourceFileUpload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        success: false,
        code: tooLarge ? 'SCHOOL_RESOURCE_FILE_TOO_LARGE' : 'SCHOOL_INVALID_RESOURCE_FILE',
        message: tooLarge ? 'Tệp không được vượt quá 50 MB.' : 'Yêu cầu tải tệp không hợp lệ.',
      });
    }
    if (error) return next(error);
    return next();
  });
}

function parseLessonImageUpload(req, res, next) {
  lessonImageUpload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        success: false,
        code: tooLarge ? 'SCHOOL_LESSON_IMAGE_TOO_LARGE' : 'SCHOOL_INVALID_LESSON_IMAGE',
        message: tooLarge ? 'Ảnh không được vượt quá 3 MB.' : 'Yêu cầu tải ảnh lên không hợp lệ.',
      });
    }
    if (error) return next(error);
    return next();
  });
}

function parseAssignmentSubmissionFiles(req, res, next) {
  assignmentSubmissionUpload.array('files', 5)(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      const tooMany = error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE';
      return res.status(tooLarge ? 413 : 400).json({
        success: false,
        code: tooLarge ? 'SCHOOL_SUBMISSION_FILE_TOO_LARGE' : 'SCHOOL_INVALID_SUBMISSION_FILES',
        message: tooLarge
          ? 'Mỗi tệp đính kèm không được vượt quá 10 MB.'
          : tooMany ? 'Mỗi bài nộp được đính kèm tối đa 5 tệp.' : 'Yêu cầu tải tệp bài nộp không hợp lệ.',
      });
    }
    if (error) return next(error);
    return next();
  });
}

function parseExamSubmissionFiles(req, res, next) {
  examSubmissionUpload.array('files', 5)(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      const tooMany = error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE';
      return res.status(tooLarge ? 413 : 400).json({
        success: false,
        code: tooLarge ? 'SCHOOL_EXAM_FILE_TOO_LARGE' : 'SCHOOL_INVALID_EXAM_FILES',
        message: tooLarge
          ? 'Mỗi ảnh bài thi không được vượt quá 10 MB.'
          : tooMany ? 'Mỗi bài thi được đính kèm tối đa 5 ảnh.' : 'Yêu cầu tải ảnh bài thi không hợp lệ.',
      });
    }
    if (error) return next(error);
    return next();
  });
}

function parseMobileExamUpload(req, res, next) {
  mobileExamUpload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        success: false,
        code: tooLarge ? 'SCHOOL_EXAM_FILE_TOO_LARGE' : 'SCHOOL_INVALID_EXAM_FILE',
        message: tooLarge
          ? 'Ảnh bài thi không được vượt quá 10 MB.'
          : 'Yêu cầu tải ảnh bài thi không hợp lệ.',
      });
    }
    if (error) return next(error);
    return next();
  });
}

function parseTeacherExamGradeFiles(req, res, next) {
  teacherExamGradeUpload.array('evidenceFiles', 5)(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      const tooMany = error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE';
      return res.status(tooLarge ? 413 : 400).json({
        success: false,
        code: tooLarge ? 'SCHOOL_EXAM_GRADE_FILE_TOO_LARGE' : 'SCHOOL_INVALID_EXAM_GRADE_FILES',
        message: tooLarge
          ? 'Mỗi ảnh minh chứng không được vượt quá 10 MB.'
          : tooMany ? 'Mỗi bài thi được đính kèm tối đa 5 ảnh minh chứng.' : 'Yêu cầu tải ảnh minh chứng không hợp lệ.',
      });
    }
    if (error) return next(error);
    return next();
  });
}

function parseTeacherExamGradeInput(req) {
  if (!req.is('multipart/form-data')) return req.body ?? {};
  const parseJson = (value, field, fallback) => {
    if (value === undefined) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      const error = new Error(`Trường ${field} không đúng định dạng.`);
      error.status = 400;
      error.code = 'SCHOOL_INVALID_EXAM_GRADE';
      throw error;
    }
  };
  const questionIds = req.body.evidenceQuestionIds === undefined
    ? []
    : Array.isArray(req.body.evidenceQuestionIds)
      ? req.body.evidenceQuestionIds
      : [req.body.evidenceQuestionIds];
  if (questionIds.length !== (req.files ?? []).length
    || questionIds.some((questionId) => typeof questionId !== 'string')) {
    const error = new Error('Ảnh minh chứng chưa được gắn đúng với câu tự luận.');
    error.status = 400;
    error.code = 'SCHOOL_INVALID_EXAM_GRADE_FILES';
    throw error;
  }
  return {
    questionScores: parseJson(req.body.questionScores, 'questionScores', {}),
    questionFeedback: parseJson(req.body.questionFeedback, 'questionFeedback', {}),
    teacherFeedback: req.body.teacherFeedback,
    deletedEvidenceIds: parseJson(req.body.deletedEvidenceIds, 'deletedEvidenceIds', []),
    evidenceFiles: (req.files ?? []).map((file, index) => ({
      ...file,
      questionId: questionIds[index],
    })),
  };
}

function requireUuid(value, field) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    const error = new Error(`${field} không hợp lệ.`);
    error.status = 400;
    error.code = 'SCHOOL_INVALID_ID';
    throw error;
  }
  return value;
}

router.use('/classes', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount);
router.use('/assignments', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount);
router.use('/student/resources', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount);
router.use('/student/exam-rooms', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('student'));
router.use('/student/exam-results', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('student'));
router.use('/student/exam-appeals', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('student'));
router.use('/student/exam-sessions', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('student'));
router.use('/student/subject-averages', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount);
router.use('/student/timetable', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('student'));
router.use('/student/progress', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('student'));
router.use('/student/learning-activity', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('student'));
router.use('/teacher/timetable', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('lecturer'));
router.use('/teacher/lesson-drafts', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('lecturer'));
router.use('/resources', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount);
router.use('/teacher/assessments', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('lecturer'));
router.use('/teacher/exam-rooms', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('lecturer'));
router.use('/teacher/exam-appeals', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('lecturer'));
router.use('/notifications', requireAuthForSchoolReads, requireAccountReady);

router.post('/upload-temporary', mobileExamUploadLimiter, parseMobileExamUpload, asyncRoute(async (req, res) => {
  if (typeof req.body?.session !== 'string' || !req.file) {
    const error = new Error('Thiếu mã phiên tải ảnh hoặc tệp ảnh.');
    error.status = 400;
    error.code = 'SCHOOL_INVALID_MOBILE_UPLOAD';
    throw error;
  }
  const result = await uploadStudentExamMobileImage(req.body.session, req.file);
  return res.json({ success: true, ...result });
}));

router.get('/check-session', mobileExamCheckLimiter, asyncRoute(async (req, res) => {
  const result = await getStudentExamMobileUploadStatus(req.query.session);
  return res.json({ success: true, ...result });
}));

router.get('/check-session/image', mobileExamCheckLimiter, asyncRoute(async (req, res) => {
  const file = await getStudentExamMobileImage(req.query.session);
  res.set('Content-Type', file.mediaType);
  res.set('Content-Length', String(file.sizeBytes));
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', 'inline');
  return res.send(file.content);
}));

router.post('/delete-temporary', requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('student'), asyncRoute(async (req, res) => {
  const sessionId = requireUuid(req.body?.sessionId, 'sessionId');
  const result = await deleteStudentExamMobileUpload(req.auth, sessionId, req.body?.session);
  return res.json({ success: true, ...result });
}));

router.get('/classes', asyncRoute(async (req, res) => {
  const schoolId = req.query.schoolId === undefined
    ? undefined
    : requireUuid(req.query.schoolId, 'schoolId');
  const classes = await listClasses(req.auth, schoolId);
  return res.json({ success: true, classes });
}));

router.post('/notifications/read-state', asyncRoute(async (req, res) => {
  const readIds = await notifications.getReadNotificationIds(req.auth, req.body?.ids);
  return res.json({ success: true, readIds });
}));

router.post('/notifications/read', asyncRoute(async (req, res) => {
  const readIds = await notifications.markNotificationsRead(req.auth, req.body?.ids);
  return res.json({ success: true, readIds });
}));

router.get('/teacher/assessments/:kind', asyncRoute(async (req, res) => {
  const assessments = await listTeacherAssessments(req.auth, req.params.kind);
  return res.json({ success: true, assessments });
}));

router.post('/teacher/assessments/:kind', asyncRoute(async (req, res) => {
  const assessment = await saveTeacherAssessment(req.auth, req.params.kind, req.body);
  return res.status(201).json({ success: true, assessment });
}));

router.delete('/teacher/assessments/:kind/:clientId', asyncRoute(async (req, res) => {
  const deleted = await deleteTeacherAssessment(req.auth, req.params.kind, req.params.clientId);
  if (!deleted) {
    const error = new Error('Không tìm thấy nội dung đã lưu.');
    error.status = 404;
    error.code = 'SCHOOL_ASSESSMENT_NOT_FOUND';
    throw error;
  }
  return res.json({ success: true });
}));

router.get('/teacher/exam-rooms', asyncRoute(async (req, res) => {
  const rooms = await listTeacherExamRooms(req.auth);
  return res.json({ success: true, rooms });
}));

router.get('/teacher/exam-appeals', asyncRoute(async (req, res) => {
  const appeals = await examAppeals.listTeacherExamAppeals(req.auth);
  return res.json({ success: true, appeals });
}));

router.patch('/teacher/exam-appeals/:appealId', asyncRoute(async (req, res) => {
  const appeal = await examAppeals.reviewTeacherExamAppeal(req.auth, req.params.appealId, req.body ?? {});
  return res.json({ success: true, appeal });
}));

router.get('/teacher/exam-rooms/:roomId/grading', asyncRoute(async (req, res) => {
  const roomId = requireUuid(req.params.roomId, 'roomId');
  const grading = await getTeacherExamRoomGrading(req.auth, roomId);
  return res.json({ success: true, ...grading });
}));

router.post('/teacher/exam-rooms/:roomId/publish-grades', asyncRoute(async (req, res) => {
  const roomId = requireUuid(req.params.roomId, 'roomId');
  const publication = await publishTeacherExamRoomGrades(req.auth, roomId);
  return res.json({ success: true, publication });
}));

router.get('/teacher/exam-rooms/:roomId/sessions/:sessionId/files/:fileId', asyncRoute(async (req, res) => {
  const roomId = requireUuid(req.params.roomId, 'roomId');
  const sessionId = requireUuid(req.params.sessionId, 'sessionId');
  const fileId = requireUuid(req.params.fileId, 'fileId');
  const file = await getTeacherExamSubmissionFile(req.auth, roomId, sessionId, fileId);
  const fallbackName = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.set('Content-Type', file.mediaType);
  res.set('Content-Length', String(file.sizeBytes));
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', `inline; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  return res.send(file.content);
}));

router.get('/teacher/exam-rooms/:roomId/sessions/:sessionId/grade-files/:fileId', asyncRoute(async (req, res) => {
  const roomId = requireUuid(req.params.roomId, 'roomId');
  const sessionId = requireUuid(req.params.sessionId, 'sessionId');
  const fileId = requireUuid(req.params.fileId, 'fileId');
  const file = await getTeacherExamGradeEvidenceFile(req.auth, roomId, sessionId, fileId);
  const fallbackName = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.set('Content-Type', file.mediaType);
  res.set('Content-Length', String(file.sizeBytes));
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', `inline; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  return res.send(file.content);
}));

router.put('/teacher/exam-rooms/:roomId/sessions/:sessionId/grade', parseTeacherExamGradeFiles, asyncRoute(async (req, res) => {
  const roomId = requireUuid(req.params.roomId, 'roomId');
  const sessionId = requireUuid(req.params.sessionId, 'sessionId');
  const grade = await saveTeacherExamSessionGrade(req.auth, roomId, sessionId, parseTeacherExamGradeInput(req));
  return res.json({ success: true, grade });
}));

router.post('/teacher/exam-rooms', asyncRoute(async (req, res) => {
  const room = await saveTeacherExamRoom(req.auth, req.body);
  return res.status(201).json({ success: true, room });
}));

router.put('/teacher/exam-rooms/:roomId', asyncRoute(async (req, res) => {
  const roomId = requireUuid(req.params.roomId, 'roomId');
  if (req.body?.id !== roomId) {
    const error = new Error('Mã phòng thi không khớp.');
    error.status = 400;
    error.code = 'SCHOOL_INVALID_EXAM_ROOM';
    throw error;
  }
  const room = await saveTeacherExamRoom(req.auth, req.body);
  return res.json({ success: true, room });
}));

router.delete('/teacher/exam-rooms/:roomId', asyncRoute(async (req, res) => {
  const roomId = requireUuid(req.params.roomId, 'roomId');
  const deleted = await deleteTeacherExamRoom(req.auth, roomId);
  if (!deleted) {
    const error = new Error('Không tìm thấy phòng thi.');
    error.status = 404;
    error.code = 'SCHOOL_EXAM_ROOM_NOT_FOUND';
    throw error;
  }
  return res.json({ success: true });
}));

router.get('/classes/:classId/students', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const students = await listClassStudents(req.auth, classId);
  return res.json({ success: true, students });
}));

router.get('/classes/:classId/subjects', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const subjects = await listTeacherClassSubjects(req.auth, classId);
  return res.json({ success: true, subjects });
}));

router.get('/classes/:classId/gradebook', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const students = await getClassGradebook(req.auth, classId, {
    academicYear: req.query.academicYear,
    semester: req.query.semester,
    subject: req.query.subject,
  });
  return res.json({ success: true, students });
}));

router.post('/classes/:classId/progress-analysis', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const result = await analyzeTeacherClassProgress(req.auth, classId, req.body ?? {});
  return res.json({ success: true, ...result });
}));

router.put('/classes/:classId/gradebook', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const { academicYear, semester, subject, entries } = req.body ?? {};
  const validatedEntries = Array.isArray(entries)
    ? entries.map((entry) => ({
      ...entry,
      studentId: requireUuid(entry?.studentId, 'studentId'),
    }))
    : entries;
  const saved = await saveClassGradebook(req.auth, classId, {
    academicYear,
    semester,
    subject,
    entries: validatedEntries,
  });
  return res.json({ success: true, saved });
}));

router.get('/classes/:classId/homeroom-gradebook', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const summary = await getHomeroomClassGradeSummary(req.auth, classId, {
    academicYear: req.query.academicYear,
    semester: req.query.semester,
  });
  return res.json({ success: true, summary });
}));

router.put('/classes/:classId/gradebook/:studentId', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const studentId = requireUuid(req.params.studentId, 'studentId');
  const { academicYear, semester, subject, regular, midterm, final } = req.body ?? {};
  const average = await saveStudentGrades(req.auth, classId, studentId, {
    academicYear,
    semester,
    subject,
    regular,
    midterm,
    final,
  });
  return res.json({ success: true, average });
}));

router.get('/classes/:classId/assignments', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const assignments = await listClassAssignments(req.auth, classId, {
    academicYear: req.query.academicYear,
    semester: req.query.semester,
    subject: req.query.subject,
  });
  return res.json({ success: true, assignments });
}));

router.patch('/classes/:classId/assignment-chapters/:chapter', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const result = await renameClassAssignmentChapter(req.auth, classId, req.params.chapter, req.body ?? {});
  return res.json({ success: true, ...result });
}));

router.delete('/classes/:classId/assignment-chapters/:chapter', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const result = await deleteClassAssignmentChapter(req.auth, classId, req.params.chapter, req.body ?? {});
  return res.json({ success: true, ...result });
}));

router.patch('/classes/:classId/assignment-chapters/:chapter/lessons/:lesson', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const result = await renameClassAssignmentLesson(
    req.auth,
    classId,
    req.params.chapter,
    req.params.lesson,
    req.body ?? {},
  );
  return res.json({ success: true, ...result });
}));

router.delete('/classes/:classId/assignment-chapters/:chapter/lessons/:lesson', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const result = await deleteClassAssignmentLesson(
    req.auth,
    classId,
    req.params.chapter,
    req.params.lesson,
    req.body ?? {},
  );
  return res.json({ success: true, ...result });
}));

router.put('/classes/:classId/assignments/:assignmentId', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
  const assignment = await updateClassAssignment(req.auth, classId, assignmentId, req.body ?? {});
  return res.json({ success: true, assignment });
}));

router.delete('/classes/:classId/assignments/:assignmentId', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
  const result = await deleteClassAssignment(req.auth, classId, assignmentId, req.body ?? {});
  return res.json({ success: true, ...result });
}));

router.get('/classes/:classId/assignments/:assignmentId/submissions', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
  const result = await listClassAssignmentSubmissions(req.auth, classId, assignmentId);
  return res.json({ success: true, ...result });
}));

async function sendAssignmentSubmissionFile(req, res, studentId) {
  const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
  const fileId = requireUuid(req.params.fileId, 'fileId');
  const file = await getClassAssignmentSubmissionFile(req.auth, assignmentId, studentId, fileId);
  const fallbackName = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.set('Content-Type', file.mediaType);
  res.set('Content-Length', String(file.sizeBytes));
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', `${file.mediaType.startsWith('image/') ? 'inline' : 'attachment'}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  return res.send(file.content);
}

router.get('/assignments/:assignmentId/submission/files/:fileId', asyncRoute(async (req, res) => (
  sendAssignmentSubmissionFile(req, res, req.auth.userId)
)));

router.get('/assignments/:assignmentId/submissions/:studentId/files/:fileId', asyncRoute(async (req, res) => (
  sendAssignmentSubmissionFile(req, res, requireUuid(req.params.studentId, 'studentId'))
)));

router.put('/classes/:classId/assignments/:assignmentId/submissions/:studentId/grade', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
  const studentId = requireUuid(req.params.studentId, 'studentId');
  const grade = await saveClassAssignmentGrade(req.auth, classId, assignmentId, studentId, req.body ?? {});
  return res.json({ success: true, grade });
}));

router.get('/classes/:classId/resources', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const resources = await listClassLearningResources(req.auth, classId);
  return res.json({ success: true, resources });
}));

router.get('/classes/:classId/resource-chapters', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const chapters = await listClassLearningResourceChapters(req.auth, classId, req.query);
  return res.json({ success: true, chapters });
}));

router.post('/classes/:classId/resource-chapters', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const result = await createClassLearningResourceChapter(req.auth, classId, req.body ?? {});
  return res.status(201).json({ success: true, ...result });
}));

router.patch('/classes/:classId/resource-chapters/:chapter', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const resource = await renameClassLearningResourceChapter(req.auth, classId, req.params.chapter, req.body ?? {});
  return res.json({ success: true, ...resource });
}));

router.delete('/classes/:classId/resource-chapters/:chapter', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const result = await deleteClassLearningResourceChapter(req.auth, classId, req.params.chapter, req.body ?? {});
  return res.json({ success: true, ...result });
}));

router.patch('/classes/:classId/resource-chapters/:chapter/lessons/:lesson', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const result = await renameClassLearningResourceLesson(
    req.auth,
    classId,
    req.params.chapter,
    req.params.lesson,
    req.body ?? {},
  );
  return res.json({ success: true, ...result });
}));

router.delete('/classes/:classId/resource-chapters/:chapter/lessons/:lesson', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const result = await deleteClassLearningResourceLesson(
    req.auth,
    classId,
    req.params.chapter,
    req.params.lesson,
    req.body ?? {},
  );
  return res.json({ success: true, ...result });
}));

router.post('/classes/:classId/resources', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const input = { ...(req.body ?? {}) };
  if (input.editorDraftId !== undefined) input.editorDraftId = requireUuid(input.editorDraftId, 'editorDraftId');
  const resource = await createClassLearningResource(req.auth, classId, input);
  return res.status(201).json({ success: true, resource });
}));

router.put('/classes/:classId/resources/:resourceId', parseResourceFile, asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const resourceId = requireUuid(req.params.resourceId, 'resourceId');
  const input = { ...(req.body ?? {}) };
  if (typeof input.editorDocument === 'string') {
    try {
      input.editorDocument = JSON.parse(input.editorDocument);
    } catch {
      return res.status(400).json({
        success: false,
        code: 'SCHOOL_INVALID_LESSON_DOCUMENT',
        message: 'Cấu trúc nội dung bài giảng không hợp lệ.',
      });
    }
  }
  const resource = await updateClassLearningResource(req.auth, classId, resourceId, input, req.file);
  return res.json({ success: true, resource });
}));

router.post('/classes/:classId/resources/:resourceId/assets', parseLessonImageUpload, asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const resourceId = requireUuid(req.params.resourceId, 'resourceId');
  const asset = await createClassLearningResourceAsset(req.auth, classId, resourceId, req.file);
  return res.status(201).json({
    success: true,
    asset: {
      id: asset.id,
      src: `/api/resources/${resourceId}/assets/${asset.id}`,
      name: asset.original_name,
      mediaType: asset.media_type,
      sizeBytes: Number(asset.size_bytes),
    },
  });
}));

router.delete('/classes/:classId/resources/:resourceId', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const resourceId = requireUuid(req.params.resourceId, 'resourceId');
  const result = await deleteClassLearningResource(req.auth, classId, resourceId, req.body ?? {});
  return res.json({ success: true, ...result });
}));

router.post('/classes/:classId/resources/upload', parseResourceFile, asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const resource = await createClassLearningResourceFile(req.auth, classId, req.body ?? {}, req.file);
  return res.status(201).json({ success: true, resource });
}));

router.post('/teacher/lesson-drafts', asyncRoute(async (req, res) => {
  const draft = await createTeacherLessonDraft(req.auth, req.body ?? {});
  return res.status(201).json({ success: true, draft });
}));

router.get('/teacher/lesson-drafts/:draftId', asyncRoute(async (req, res) => {
  const draftId = requireUuid(req.params.draftId, 'draftId');
  const draft = await getTeacherLessonDraft(req.auth, draftId);
  return res.json({ success: true, draft });
}));

router.put('/teacher/lesson-drafts/:draftId', asyncRoute(async (req, res) => {
  const draftId = requireUuid(req.params.draftId, 'draftId');
  const draft = await updateTeacherLessonDraft(req.auth, draftId, req.body ?? {});
  return res.json({ success: true, draft });
}));

router.post('/teacher/lesson-drafts/:draftId/assets', parseLessonImageUpload, asyncRoute(async (req, res) => {
  const draftId = requireUuid(req.params.draftId, 'draftId');
  const asset = await createTeacherLessonDraftAsset(req.auth, draftId, req.file);
  return res.status(201).json({
    success: true,
    asset: {
      id: asset.id,
      src: `/api/teacher/lesson-drafts/${draftId}/assets/${asset.id}`,
      name: asset.original_name,
      mediaType: asset.media_type,
      sizeBytes: Number(asset.size_bytes),
    },
  });
}));

router.get('/teacher/lesson-drafts/:draftId/assets/:assetId', asyncRoute(async (req, res) => {
  const draftId = requireUuid(req.params.draftId, 'draftId');
  const assetId = requireUuid(req.params.assetId, 'assetId');
  const asset = await getTeacherLessonDraftAsset(req.auth, draftId, assetId);
  res.set('Content-Type', asset.media_type);
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.send(asset.content);
}));

router.get('/student/resources', requireRole('student'), asyncRoute(async (req, res) => {
  const resources = await listStudentLearningResources(req.auth);
  return res.json({ success: true, resources });
}));

router.get('/student/timetable', asyncRoute(async (req, res) => {
  const weekStart = req.query.weekStart ? validateWeekStart(req.query.weekStart) : undefined;
  const timetable = await getStudentTimetable(req.auth, req.query.semester, weekStart);
  return res.json({ success: true, ...timetable });
}));

router.post('/student/timetable/suggestions', asyncRoute(async (req, res) => {
  const result = await generateStudentTimetableSuggestion(req.auth, req.body ?? {});
  return res.json({ success: true, ...result });
}));

router.get('/teacher/timetable', asyncRoute(async (req, res) => {
  const timetable = await getTeacherTimetable(req.auth, req.query);
  return res.json({ success: true, ...timetable });
}));

router.put('/teacher/timetable', asyncRoute(async (req, res) => {
  const timetable = await saveTeacherTimetable(req.auth, req.body ?? {});
  return res.json({ success: true, ...timetable });
}));

router.post('/teacher/timetable/suggestions', asyncRoute(async (req, res) => {
  const result = await generateTeacherTimetableSuggestion(req.auth, req.body ?? {});
  return res.json({ success: true, ...result });
}));

router.get('/student/exam-rooms', asyncRoute(async (req, res) => {
  const rooms = await listStudentExamRooms(req.auth);
  return res.json({ success: true, rooms });
}));

router.get('/student/exam-results', asyncRoute(async (req, res) => {
  const results = await listStudentExamResults(req.auth);
  return res.json({ success: true, results });
}));

router.get('/student/exam-appeals', asyncRoute(async (req, res) => {
  const appeals = await examAppeals.listStudentExamAppeals(req.auth);
  return res.json({ success: true, appeals });
}));

router.post('/student/exam-results/:sessionId/appeals', asyncRoute(async (req, res) => {
  const appeal = await examAppeals.submitStudentExamAppeal(req.auth, req.params.sessionId, req.body?.reason);
  return res.status(201).json({ success: true, appeal });
}));

router.get('/student/progress', asyncRoute(async (req, res) => {
  const progress = await getStudentProgress(req.auth);
  return res.json({ success: true, progress });
}));

router.get('/student/learning-activity', asyncRoute(async (req, res) => {
  const activity = await studentLearningActivity.getWeeklyActivity(req.auth);
  return res.json({ success: true, ...activity });
}));

router.post('/student/learning-activity', asyncRoute(async (req, res) => {
  const result = await studentLearningActivity.recordActivity(
    req.auth,
    req.body?.activityType,
    req.body?.eventKey,
  );
  return res.status(201).json({ success: true, ...result });
}));

router.post('/student/progress/analysis', asyncRoute(async (req, res) => {
  const result = await analyzeStudentProgress(req.auth, req.body ?? {});
  return res.json({ success: true, ...result });
}));

router.post('/student/exam-results/:sessionId/read', asyncRoute(async (req, res) => {
  const sessionId = requireUuid(req.params.sessionId, 'sessionId');
  const readState = await markStudentExamResultRead(req.auth, sessionId);
  return res.json({ success: true, readState });
}));

router.get('/student/exam-results/:sessionId/files/:fileId', asyncRoute(async (req, res) => {
  const sessionId = requireUuid(req.params.sessionId, 'sessionId');
  const fileId = requireUuid(req.params.fileId, 'fileId');
  const file = await getStudentExamResultFile(req.auth, sessionId, fileId);
  const fallbackName = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.set('Content-Type', file.mediaType);
  res.set('Content-Length', String(file.sizeBytes));
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', `inline; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  return res.send(file.content);
}));

router.get('/student/exam-results/:sessionId/grade-files/:fileId', asyncRoute(async (req, res) => {
  const sessionId = requireUuid(req.params.sessionId, 'sessionId');
  const fileId = requireUuid(req.params.fileId, 'fileId');
  const file = await getStudentExamResultFile(req.auth, sessionId, fileId, true);
  const fallbackName = file.name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.set('Content-Type', file.mediaType);
  res.set('Content-Length', String(file.sizeBytes));
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', `inline; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  return res.send(file.content);
}));

router.post('/student/exam-rooms/:roomId/start', asyncRoute(async (req, res) => {
  const roomId = requireUuid(req.params.roomId, 'roomId');
  const session = await startStudentExamSession(req.auth, roomId);
  return res.status(201).json({ success: true, session });
}));

router.post('/student/exam-sessions/:sessionId/events', asyncRoute(async (req, res) => {
  const sessionId = requireUuid(req.params.sessionId, 'sessionId');
  const result = await recordStudentExamEvent(req.auth, sessionId, req.body?.eventType);
  return res.status(201).json({ success: true, ...result });
}));

router.post('/student/exam-sessions/:sessionId/behavior-logs', asyncRoute(async (req, res) => {
  const sessionId = requireUuid(req.params.sessionId, 'sessionId');
  const result = await recordStudentExamBehaviorLog(req.auth, sessionId, req.body);
  return res.status(result.saved ? 201 : 200).json({ success: true, ...result });
}));

router.post('/student/exam-sessions/:sessionId/mobile-upload-sessions', asyncRoute(async (req, res) => {
  const sessionId = requireUuid(req.params.sessionId, 'sessionId');
  const result = await createStudentExamMobileUploadSession(req.auth, sessionId, Number(req.body?.questionNumber));
  return res.status(201).json({ success: true, uploadSession: result });
}));

router.post('/student/exam-sessions/:sessionId/submit', parseExamSubmissionFiles, asyncRoute(async (req, res) => {
  const sessionId = requireUuid(req.params.sessionId, 'sessionId');
  let answers = req.body?.answers;
  if (typeof answers === 'string') {
    try {
      answers = JSON.parse(answers);
    } catch {
      const error = new Error('Câu trả lời không đúng định dạng.');
      error.status = 400;
      error.code = 'SCHOOL_INVALID_EXAM_SUBMISSION';
      throw error;
    }
  }
  const rawQuestionNumbers = req.body?.fileQuestionNumbers;
  const questionNumbers = rawQuestionNumbers === undefined
    ? []
    : Array.isArray(rawQuestionNumbers) ? rawQuestionNumbers : [rawQuestionNumbers];
  if (questionNumbers.length !== (req.files ?? []).length
    || questionNumbers.some((value) => !/^\d+$/.test(value))) {
    const error = new Error('Mỗi ảnh phải được gắn với một câu tự luận hợp lệ.');
    error.status = 400;
    error.code = 'SCHOOL_INVALID_EXAM_FILES';
    throw error;
  }
  const files = (req.files ?? []).map((file, index) => ({
    ...file,
    questionNumber: Number(questionNumbers[index]),
  }));
  const rawMobileUploadTokens = req.body?.mobileUploadTokens;
  const mobileUploadTokens = rawMobileUploadTokens === undefined
    ? []
    : Array.isArray(rawMobileUploadTokens) ? rawMobileUploadTokens : [rawMobileUploadTokens];
  if (mobileUploadTokens.some((token) => typeof token !== 'string')) {
    const error = new Error('Danh sách ảnh từ điện thoại không đúng định dạng.');
    error.status = 400;
    error.code = 'SCHOOL_INVALID_EXAM_FILES';
    throw error;
  }
  const result = await submitStudentExamSession(req.auth, sessionId, answers, files, mobileUploadTokens);
  return res.json({ success: true, result });
}));

router.get('/student/subject-averages', requireRole('student'), asyncRoute(async (req, res) => {
  const averages = await listStudentSubjectAverages(req.auth, req.query.semester);
  return res.json({ success: true, averages });
}));

router.get('/resources/:resourceId/files/:fileId', asyncRoute(async (req, res) => {
  const resourceId = requireUuid(req.params.resourceId, 'resourceId');
  const fileId = requireUuid(req.params.fileId, 'fileId');
  const file = await getClassLearningResourceFile(req.auth, resourceId, fileId);
  res.set('Content-Type', file.mediaType);
  res.set('Content-Length', String(file.sizeBytes));
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', file.mediaType.startsWith('image/') ? 'inline' : 'attachment');
  return res.send(file.content);
}));

router.get('/resources/:resourceId/assets/:assetId', asyncRoute(async (req, res) => {
  const resourceId = requireUuid(req.params.resourceId, 'resourceId');
  const assetId = requireUuid(req.params.assetId, 'assetId');
  const asset = await getClassLearningResourceAsset(req.auth, resourceId, assetId);
  res.set('Content-Type', asset.media_type);
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.send(asset.content);
}));

router.post('/classes/:classId/assignments', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const assignment = await createClassAssignment(req.auth, classId, req.body ?? {});
  return res.status(201).json({ success: true, assignment });
}));

router.get('/assignments', requireRole('student'), asyncRoute(async (req, res) => {
  const assignments = await listStudentAssignments(req.auth);
  return res.json({ success: true, assignments });
}));

router.put('/assignments/:assignmentId/submission', requireRole('student'), parseAssignmentSubmissionFiles, asyncRoute(async (req, res) => {
  const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
  const submission = await submitClassAssignment(
    req.auth,
    assignmentId,
    req.body?.responseText,
    req.files ?? [],
  );
  return res.json({ success: true, submission });
}));

router.get('/classes/:classId', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const classroom = await getClass(req.auth, classId);
  return res.json({ success: true, class: classroom });
}));

router.use((error, _req, res, next) => {
  if (typeof error.code === 'string' && error.code.startsWith('SCHOOL_')) {
    return res.status(error.status || 500).json({
      success: false,
      code: error.code,
      message: error.message,
    });
  }
  return next(error);
});

module.exports = router;
