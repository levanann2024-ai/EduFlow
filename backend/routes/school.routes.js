const express = require('express');
const {
  requireAccountReady,
  requireAuthForSchoolReads,
  requirePersistentAccount,
  requireRole,
} = require('../auth/middleware');
const {
  createClassAssignment,
  createClassLearningResource,
  getClass,
  getClassGradebook,
  listClasses,
  listClassAssignments,
  listClassLearningResources,
  listClassStudents,
  listStudentAssignments,
  listStudentLearningResources,
  listTeacherClassSubjects,
  saveStudentGrades,
  submitClassAssignment,
} = require('../services/school.service');

const router = express.Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
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

router.get('/classes', asyncRoute(async (req, res) => {
  const schoolId = req.query.schoolId === undefined
    ? undefined
    : requireUuid(req.query.schoolId, 'schoolId');
  const classes = await listClasses(req.auth, schoolId);
  return res.json({ success: true, classes });
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

router.put('/classes/:classId/gradebook/:studentId', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const studentId = requireUuid(req.params.studentId, 'studentId');
  const { academicYear, semester, subject, regular, midterm, final } = req.body ?? {};
  await saveStudentGrades(req.auth, classId, studentId, {
    academicYear,
    semester,
    subject,
    regular,
    midterm,
    final,
  });
  return res.json({ success: true });
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

router.get('/classes/:classId/resources', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const resources = await listClassLearningResources(req.auth, classId);
  return res.json({ success: true, resources });
}));

router.post('/classes/:classId/resources', asyncRoute(async (req, res) => {
  const classId = requireUuid(req.params.classId, 'classId');
  const resource = await createClassLearningResource(req.auth, classId, req.body ?? {});
  return res.status(201).json({ success: true, resource });
}));

router.get('/student/resources', requireRole('student'), asyncRoute(async (req, res) => {
  const resources = await listStudentLearningResources(req.auth);
  return res.json({ success: true, resources });
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

router.put('/assignments/:assignmentId/submission', requireRole('student'), asyncRoute(async (req, res) => {
  const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
  const submission = await submitClassAssignment(req.auth, assignmentId, req.body?.responseText);
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
