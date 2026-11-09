const express = require('express');
const {
  requireAccountReady,
  requireAuth,
  requirePersistentAccount,
  requireRole,
} = require('../auth/middleware');
const { createAdminSchoolService } = require('../services/admin-school.service');

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createAdminSchoolRouter({
  service = createAdminSchoolService(),
  authenticate = requireAuth,
} = {}) {
  const router = express.Router();

  router.use(authenticate, requireAccountReady, requirePersistentAccount, requireRole('admin'));

  router.get('/schools', asyncRoute(async (req, res) => {
    res.json({ success: true, schools: await service.listSchools(req.auth) });
  }));

  router.get('/schools/:schoolId/overview', asyncRoute(async (req, res) => {
    res.json({ success: true, overview: await service.getOverview(req.auth, req.params.schoolId) });
  }));

  router.get('/schools/:schoolId/academic-years', asyncRoute(async (req, res) => {
    res.json({ success: true, years: await service.listAcademicYears(req.auth, req.params.schoolId) });
  }));

  router.post('/schools/:schoolId/academic-years', asyncRoute(async (req, res) => {
    const year = await service.createAcademicYear(req.auth, req.params.schoolId, req.body);
    res.status(201).json({ success: true, year });
  }));

  router.put('/schools/:schoolId/academic-years/:yearId', asyncRoute(async (req, res) => {
    const year = await service.updateAcademicYear(req.auth, req.params.schoolId, req.params.yearId, req.body);
    res.json({ success: true, year });
  }));

  router.post('/schools/:schoolId/academic-years/:yearId/current', asyncRoute(async (req, res) => {
    const year = await service.setCurrentAcademicYear(req.auth, req.params.schoolId, req.params.yearId);
    res.json({ success: true, year });
  }));

  router.patch('/schools/:schoolId/academic-years/:yearId/close', asyncRoute(async (req, res) => {
    const year = await service.closeAcademicYear(req.auth, req.params.schoolId, req.params.yearId);
    res.json({ success: true, year });
  }));

  router.get('/schools/:schoolId/classes', asyncRoute(async (req, res) => {
    const result = await service.listClasses(req.auth, req.params.schoolId, req.query);
    res.json({ success: true, ...result });
  }));

  router.post('/schools/:schoolId/classes', asyncRoute(async (req, res) => {
    const classroom = await service.createClass(req.auth, req.params.schoolId, req.body);
    res.status(201).json({ success: true, classroom });
  }));

  router.get('/schools/:schoolId/classes/:classId', asyncRoute(async (req, res) => {
    const classroom = await service.getClass(req.auth, req.params.schoolId, req.params.classId);
    res.json({ success: true, classroom });
  }));

  router.put('/schools/:schoolId/classes/:classId', asyncRoute(async (req, res) => {
    const classroom = await service.updateClass(req.auth, req.params.schoolId, req.params.classId, req.body);
    res.json({ success: true, classroom });
  }));

  router.post('/schools/:schoolId/classes/:classId/subjects', asyncRoute(async (req, res) => {
    const subject = await service.addClassSubject(
      req.auth,
      req.params.schoolId,
      req.params.classId,
      req.body?.subjectId,
    );
    res.status(201).json({ success: true, subject });
  }));

  router.put('/schools/:schoolId/classes/:classId/homeroom', asyncRoute(async (req, res) => {
    const assignment = await service.setHomeroomTeacher(
      req.auth,
      req.params.schoolId,
      req.params.classId,
      req.body?.teacherUserId,
    );
    res.json({ success: true, assignment });
  }));

  router.delete('/schools/:schoolId/classes/:classId/homeroom', asyncRoute(async (req, res) => {
    const assignment = await service.endHomeroomAssignment(req.auth, req.params.schoolId, req.params.classId);
    res.json({ success: true, assignment });
  }));

  router.get('/schools/:schoolId/teachers', asyncRoute(async (req, res) => {
    res.json({ success: true, teachers: await service.listTeachers(req.auth, req.params.schoolId) });
  }));

  router.get('/schools/:schoolId/students', asyncRoute(async (req, res) => {
    res.json({
      success: true,
      students: await service.listStudents(req.auth, req.params.schoolId, req.query.yearId),
    });
  }));

  router.post('/schools/:schoolId/classes/:classId/students', asyncRoute(async (req, res) => {
    const membership = await service.changeStudentMembership(
      req.auth,
      req.params.schoolId,
      req.params.classId,
      req.body?.studentUserId,
    );
    res.status(201).json({ success: true, membership });
  }));

  router.delete('/schools/:schoolId/classes/:classId/students/:studentId', asyncRoute(async (req, res) => {
    const membership = await service.changeStudentMembership(
      req.auth,
      req.params.schoolId,
      req.params.classId,
      req.params.studentId,
      { end: true },
    );
    res.json({ success: true, membership });
  }));

  router.get('/schools/:schoolId/subjects', asyncRoute(async (req, res) => {
    res.json({
      success: true,
      subjects: await service.listSubjects(req.auth, req.params.schoolId, req.query.yearId),
    });
  }));

  router.post('/schools/:schoolId/subjects', asyncRoute(async (req, res) => {
    const subject = await service.createSubject(req.auth, req.params.schoolId, req.body);
    res.status(201).json({ success: true, subject });
  }));

  router.get('/schools/:schoolId/subjects/:subjectId', asyncRoute(async (req, res) => {
    const subject = await service.getSubject(
      req.auth,
      req.params.schoolId,
      req.params.subjectId,
      req.query.yearId,
    );
    res.json({ success: true, subject });
  }));

  router.put('/schools/:schoolId/subjects/:subjectId', asyncRoute(async (req, res) => {
    const subject = await service.updateSubject(
      req.auth,
      req.params.schoolId,
      req.params.subjectId,
      req.body,
    );
    res.json({ success: true, subject });
  }));

  router.get('/schools/:schoolId/assignments', asyncRoute(async (req, res) => {
    const assignments = await service.listAssignments(req.auth, req.params.schoolId, req.query);
    res.json({ success: true, assignments });
  }));

  router.post('/schools/:schoolId/assignments', asyncRoute(async (req, res) => {
    const assignment = await service.createAssignment(req.auth, req.params.schoolId, req.body);
    res.status(201).json({ success: true, assignment });
  }));

  router.patch('/schools/:schoolId/assignments/:assignmentId', asyncRoute(async (req, res) => {
    const assignment = await service.updateAssignment(
      req.auth,
      req.params.schoolId,
      req.params.assignmentId,
      req.body?.teacherUserId,
    );
    res.json({ success: true, assignment });
  }));

  router.delete('/schools/:schoolId/assignments/:assignmentId', asyncRoute(async (req, res) => {
    const assignment = await service.revokeAssignment(req.auth, req.params.schoolId, req.params.assignmentId);
    res.json({ success: true, assignment });
  }));

  return router;
}

module.exports = createAdminSchoolRouter();
module.exports.createAdminSchoolRouter = createAdminSchoolRouter;
