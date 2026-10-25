const express = require('express');
const {
  requireAccountReady,
  requireAuthForSchoolReads,
  requirePersistentAccount,
} = require('../auth/middleware');
const { getClass, listClasses, listClassStudents } = require('../services/school.service');

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
