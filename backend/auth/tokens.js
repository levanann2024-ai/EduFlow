const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_TTL = '10m';
const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;

function getJwtSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    const error = new Error('AUTH_JWT_SECRET must contain at least 32 bytes.');
    error.code = 'AUTH_JWT_SECRET_NOT_CONFIGURED';
    throw error;
  }
  return secret;
}

function signAccessToken(userId, sessionId) {
  return jwt.sign(
    { sid: sessionId },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      subject: userId,
      issuer: 'eduflow-api',
      audience: 'eduflow-app',
      expiresIn: ACCESS_TOKEN_TTL,
    },
  );
}

function signDemoToken(role) {
  return jwt.sign(
    { demo: true, role },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      subject: `demo:${role}`,
      issuer: 'eduflow-api',
      audience: 'eduflow-app',
      expiresIn: ACCESS_TOKEN_TTL,
    },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    issuer: 'eduflow-api',
    audience: 'eduflow-app',
  });
}

function createRefreshToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  ACCESS_TOKEN_TTL_SECONDS,
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
  signDemoToken,
  verifyAccessToken,
};
