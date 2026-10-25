const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const jwt = require('jsonwebtoken');

process.env.AUTH_JWT_SECRET = crypto.randomBytes(32).toString('base64');
const { signAccessToken, signDemoToken, verifyAccessToken } = require('./tokens');

test('access token binds a subject and session without trusting a client role', () => {
  const token = signAccessToken('user-1', 'session-1');
  const claims = verifyAccessToken(token);

  assert.equal(claims.sub, 'user-1');
  assert.equal(claims.sid, 'session-1');
  assert.equal(claims.iss, 'eduflow-api');
  assert.equal(claims.aud, 'eduflow-app');
  assert.equal(claims.role, undefined);
});

test('demo token is explicitly marked and carries only a selectable demo role', () => {
  const claims = verifyAccessToken(signDemoToken('student'));

  assert.equal(claims.demo, true);
  assert.equal(claims.role, 'student');
  assert.equal(claims.sid, undefined);
});

test('access token uses a short expiration', () => {
  const token = signAccessToken('user-2', 'session-2');
  const claims = jwt.decode(token);

  assert.equal(claims.exp - claims.iat, 600);
});
