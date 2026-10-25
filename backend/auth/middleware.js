const { getPool } = require('../db/pool');
const { hasValidSchoolScope } = require('./school-scope');
const { verifyAccessToken } = require('./tokens');

function demoModeEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.EDUFLOW_DEMO_MODE === 'true';
}

async function requireAuth(req, res, next, { allowMissingSchool = false } = {}) {
  const authorization = req.get('authorization') ?? '';
  const match = authorization.match(/^Bearer (.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Đăng nhập để tiếp tục.' });
  }

  try {
    const claims = verifyAccessToken(match[1]);
    if (claims.demo === true) {
      if (!demoModeEnabled() || !['student', 'lecturer', 'admin'].includes(claims.role)) {
        return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
      }
      req.auth = {
        userId: claims.sub,
        sessionId: null,
        role: claims.role,
        adminScope: claims.role === 'admin' ? 'system' : null,
        schoolIds: [],
        mustChangePassword: false,
        profileComplete: true,
        isDemo: true,
      };
      return next();
    }

    if (typeof claims.sid !== 'string' || typeof claims.sub !== 'string') {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
    }
    const result = await getPool().query(
      `SELECT u.id, u.role, u.admin_scope, u.must_change_password, u.profile_completed_at,
              COALESCE(array_agg(sm.school_id) FILTER (
                WHERE sm.status = 'active' AND sc.status = 'active'
              ), '{}') AS school_ids
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN school_memberships sm ON sm.user_id = u.id
         LEFT JOIN schools sc ON sc.id = sm.school_id
        WHERE s.id = $1 AND s.user_id = $2
          AND s.revoked_at IS NULL AND s.expires_at > now()
          AND u.status = 'active'
        GROUP BY u.id`,
      [claims.sid, claims.sub],
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn.' });
    }
    const authUser = {
      role: user.role,
      adminScope: user.admin_scope,
      schoolIds: user.school_ids,
    };
    if (!allowMissingSchool && !hasValidSchoolScope(authUser)) {
      if (user.role === 'student' || user.role === 'lecturer') {
        return res.status(409).json({
          success: false,
          message: 'Tài khoản cần có đúng một trường đang hoạt động.',
          code: 'SCHOOL_MEMBERSHIP_INVARIANT_VIOLATION',
        });
      }
      return res.status(403).json({ success: false, message: 'Tài khoản không còn quyền truy cập trường.' });
    }
    req.auth = {
      userId: user.id,
      sessionId: claims.sid,
      role: user.role,
      adminScope: user.admin_scope,
      schoolIds: user.school_ids,
      mustChangePassword: user.must_change_password,
      profileComplete: user.profile_completed_at !== null,
      isDemo: false,
    };
    return next();
  } catch (error) {
    if (error.code === 'AUTH_DATABASE_NOT_CONFIGURED' || error.code === 'AUTH_JWT_SECRET_NOT_CONFIGURED') {
      return res.status(503).json({ success: false, message: error.message });
    }
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn.' });
    }
    return next(error);
  }
}

function requireAuthForSchoolReads(req, res, next) {
  return requireAuth(req, res, next, { allowMissingSchool: true });
}

function requireAccountReady(req, res, next) {
  if (req.auth?.isDemo) return next();
  if (!req.auth || req.auth.mustChangePassword || !req.auth.profileComplete) {
    return res.status(403).json({
      success: false,
      message: 'Hoàn tất thiết lập tài khoản trước khi tiếp tục.',
      code: 'ACCOUNT_SETUP_REQUIRED',
    });
  }
  return next();
}

function requirePersistentAccount(req, res, next) {
  if (!req.auth || req.auth.isDemo) {
    return res.status(403).json({ success: false, message: 'Tài khoản demo không thể thay đổi tài khoản thật.' });
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || req.auth.isDemo || !roles.includes(req.auth.role)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    return next();
  };
}

module.exports = {
  demoModeEnabled,
  requireAccountReady,
  requireAuth,
  requireAuthForSchoolReads,
  requirePersistentAccount,
  requireRole,
};
