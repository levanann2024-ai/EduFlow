const express = require('express');
const { requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole } = require('../auth/middleware');
const savedItems = require('../services/savedItems.service');

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

router.use(requireAuthForSchoolReads, requireAccountReady, requirePersistentAccount, requireRole('student', 'lecturer'));
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function requireJson(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ success: false, message: 'Content-Type phải là application/json.' });
  }
  return next();
}

router.get('/', asyncRoute(async (req, res) => {
  res.json({ success: true, data: { items: await savedItems.list(req.auth) } });
}));
router.post('/import', requireJson, asyncRoute(async (req, res) => {
  res.json({ success: true, data: { items: await savedItems.importItems(req.auth, req.body) } });
}));
router.put('/:type/:id', requireJson, asyncRoute(async (req, res) => {
  res.json({ success: true, data: { item: await savedItems.upsert(req.auth, req.params.type, req.params.id, req.body) } });
}));
router.delete('/:type/:id', asyncRoute(async (req, res) => {
  await savedItems.remove(req.auth, req.params.type, req.params.id);
  res.json({ success: true });
}));

module.exports = router;
