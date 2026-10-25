const express = require('express');
const rateLimit = require('express-rate-limit');
const { getPool } = require('../db/pool');
const {
  demoModeEnabled,
  requireAccountReady,
  requireAuth,
  requirePersistentAccount,
  requireRole,
} = require('./middleware');
const {
  ACCESS_TOKEN_TTL_SECONDS,
  acceptInvitation,
  changePassword,
  completeProfile,
  createInvitation,
  createSchool,
  loadUser,
  listSchools,
  listUsers,
  login,
  rotateRefreshToken,
} = require('./service');
const { hashRefreshToken, signDemoToken } = require('./tokens');

const router = express.Router();
const REFRESH_COOKIE_NAME = 'eduflow_refresh';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều lần thử. Vui lòng thử lại sau.' },
});

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function cookieOptions() {
  const sameSite = (process.env.AUTH_COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    throw new Error('AUTH_COOKIE_SAME_SITE must be lax, strict, or none.');
  }
  const secure = process.env.NODE_ENV === 'production' || process.env.AUTH_COOKIE_SECURE === 'true';
  if (sameSite === 'none' && !secure) {
    throw new Error('AUTH_COOKIE_SECURE=true is required with SameSite=None.');
  }
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api/auth',
  };
}

const REFRESH_COOKIE_OPTIONS = cookieOptions();

function setRefreshCookie(res, token, expiresAt) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...REFRESH_COOKIE_OPTIONS,
    expires: expiresAt,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
}

function requireTrustedOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) {
    return res.status(403).json({ success: false, message: 'Thiếu nguồn yêu cầu hợp lệ.' });
  }

  const allowedOrigins = (process.env.AUTH_ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowedOrigins.includes(origin)) {
    return res.status(403).json({ success: false, message: 'Nguồn yêu cầu không được phép.' });
  }
  return next();
}

router.post('/login', requireTrustedOrigin, loginLimiter, asyncRoute(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (
    typeof email !== 'string'
    || email.length > 254
    || typeof password !== 'string'
    || password.length > 128
  ) {
    return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không hợp lệ.' });
  }
  const session = await login(email, password);
  setRefreshCookie(res, session.refreshToken, session.expiresAt);
  return res.json({
    success: true,
    accessToken: session.accessToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: session.user,
  });
}));

router.post('/refresh', requireTrustedOrigin, asyncRoute(async (req, res) => {
  const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn.' });
  }
  const session = await rotateRefreshToken(refreshToken);
  setRefreshCookie(res, session.refreshToken, session.expiresAt);
  return res.json({
    success: true,
    accessToken: session.accessToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: session.user,
  });
}));

router.post('/logout', requireTrustedOrigin, asyncRoute(async (req, res) => {
  const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    await getPool().query(
      `UPDATE auth_sessions
          SET revoked_at = COALESCE(revoked_at, now())
        WHERE id IN (
          SELECT session_id FROM auth_refresh_tokens WHERE token_hash = $1
        )`,
      [tokenHash],
    );
  }
  clearRefreshCookie(res);
  return res.json({ success: true });
}));

router.post('/demo', requireTrustedOrigin, (req, res) => {
  if (!demoModeEnabled()) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy.' });
  }
  const { role } = req.body ?? {};
  if (!['student', 'lecturer', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Vai trò demo không hợp lệ.' });
  }
  const accessToken = signDemoToken(role);
  return res.json({
    success: true,
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: {
      id: `demo:${role}`,
      email: `demo-${role}@example.invalid`,
      fullName: role === 'student' ? 'Học sinh demo' : role === 'lecturer' ? 'Giáo viên demo' : 'Quản trị viên demo',
      role,
      schoolIds: [],
      mustChangePassword: false,
      profileComplete: true,
      isDemo: true,
    },
  });
});

router.post('/invitations/accept', requireTrustedOrigin, loginLimiter, asyncRoute(async (req, res) => {
  const { token, fullName, password } = req.body ?? {};
  if (typeof token !== 'string' || token.length < 32 || token.length > 100) {
    return res.status(400).json({ success: false, message: 'Liên kết mời không hợp lệ.' });
  }
  const session = await acceptInvitation({ token, fullName, password });
  setRefreshCookie(res, session.refreshToken, session.expiresAt);
  return res.status(201).json({
    success: true,
    accessToken: session.accessToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: session.user,
  });
}));

router.post('/invitations', requireTrustedOrigin, requireAuth, requireAccountReady, requireRole('admin'), asyncRoute(async (req, res) => {
  const { email, role, schoolId } = req.body ?? {};
  if (typeof email !== 'string' || email.length > 254) {
    return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
  }
  const invitation = await createInvitation({
    email,
    role,
    adminScope: req.auth.adminScope,
    schoolId,
    invitedBy: req.auth.userId,
    allowedSchoolIds: req.auth.schoolIds,
  });
  return res.status(201).json({
    success: true,
    invitationToken: invitation.token,
    expiresAt: invitation.expiresAt,
  });
}));

router.get('/schools', requireAuth, requireAccountReady, requireRole('admin'), asyncRoute(async (req, res) => {
  const schools = await listSchools(req.auth.schoolIds, req.auth.adminScope === 'system');
  return res.json({ success: true, schools });
}));

router.post('/schools', requireTrustedOrigin, requireAuth, requireAccountReady, requireRole('admin'), asyncRoute(async (req, res) => {
  if (req.auth.adminScope !== 'system') {
    return res.status(403).json({ success: false, message: 'Chỉ quản trị viên hệ thống được tạo trường.' });
  }
  const school = await createSchool(req.body?.name);
  return res.status(201).json({ success: true, school });
}));

router.get('/users', requireAuth, requireAccountReady, requireRole('admin'), asyncRoute(async (req, res) => {
  const users = await listUsers(req.auth.schoolIds, req.auth.adminScope === 'system');
  return res.json({ success: true, users });
}));

router.post('/change-password', requireTrustedOrigin, loginLimiter, requireAuth, requirePersistentAccount, asyncRoute(async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== 'string' || currentPassword.length > 128) {
    return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không hợp lệ.' });
  }
  await changePassword(req.auth.userId, currentPassword, newPassword, req.auth.sessionId);
  return res.json({ success: true });
}));

router.post('/complete-profile', requireTrustedOrigin, requireAuth, requirePersistentAccount, asyncRoute(async (req, res) => {
  await completeProfile(req.auth.userId, req.body?.fullName, {
    grade: req.body?.grade,
    studentNumber: req.body?.studentNumber,
    employeeNumber: req.body?.employeeNumber,
  });
  const user = await loadUser(req.auth.userId);
  return res.json({ success: true, user });
}));

router.get('/me', requireAuth, asyncRoute(async (req, res) => {
  if (req.auth.isDemo) {
    return res.json({
      success: true,
      user: {
        id: req.auth.userId,
        email: `demo-${req.auth.role}@example.invalid`,
        fullName: req.auth.role === 'student' ? 'Học sinh demo' : req.auth.role === 'lecturer' ? 'Giáo viên demo' : 'Quản trị viên demo',
        role: req.auth.role,
        schoolIds: [],
        mustChangePassword: false,
        profileComplete: true,
        isDemo: true,
      },
    });
  }
  const user = await loadUser(req.auth.userId);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Tài khoản không còn hoạt động.' });
  }
  return res.json({ success: true, user });
}));

module.exports = { router, REFRESH_COOKIE_NAME };
