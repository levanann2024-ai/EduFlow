const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');
const { signDemoToken } = require('./tokens');
const { requireAccountReady, requireAuth, requireRole } = require('./middleware');

process.env.AUTH_JWT_SECRET = crypto.randomBytes(32).toString('base64');

function runAuth(token) {
  const req = { get: () => `Bearer ${token}` };
  const result = { statusCode: 200, body: null, auth: null, nextCalled: false };
  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  return Promise.resolve(requireAuth(req, res, () => {
    result.nextCalled = true;
    result.auth = req.auth;
  })).then(() => result);
}

test('demo access is unavailable in production even for a valid demo token', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDemoFlag = process.env.EDUFLOW_DEMO_MODE;
  process.env.NODE_ENV = 'production';
  process.env.EDUFLOW_DEMO_MODE = 'true';
  try {
    const result = await runAuth(signDemoToken('student'));
    assert.equal(result.statusCode, 401);
    assert.equal(result.nextCalled, false);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousDemoFlag === undefined) delete process.env.EDUFLOW_DEMO_MODE;
    else process.env.EDUFLOW_DEMO_MODE = previousDemoFlag;
  }
});

test('demo access requires explicit non-production configuration', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDemoFlag = process.env.EDUFLOW_DEMO_MODE;
  process.env.NODE_ENV = 'development';
  process.env.EDUFLOW_DEMO_MODE = 'true';
  try {
    const result = await runAuth(signDemoToken('lecturer'));
    assert.equal(result.nextCalled, true);
    assert.equal(result.auth.role, 'lecturer');
    assert.equal(result.auth.isDemo, true);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousDemoFlag === undefined) delete process.env.EDUFLOW_DEMO_MODE;
    else process.env.EDUFLOW_DEMO_MODE = previousDemoFlag;
  }
});

test('account setup requirements are enforced outside the UI', () => {
  const result = { statusCode: 200, body: null, nextCalled: false };
  const req = { auth: { mustChangePassword: true, profileComplete: false, isDemo: false } };
  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };

  requireAccountReady(req, res, () => { result.nextCalled = true; });
  assert.equal(result.statusCode, 403);
  assert.equal(result.body.code, 'ACCOUNT_SETUP_REQUIRED');
  assert.equal(result.nextCalled, false);
});

test('demo users cannot use database-backed role administration routes', () => {
  const result = { statusCode: 200, nextCalled: false };
  const req = { auth: { isDemo: true, role: 'admin' } };
  const res = {
    status(code) {
      result.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };

  requireRole('admin')(req, res, () => { result.nextCalled = true; });
  assert.equal(result.statusCode, 403);
  assert.equal(result.nextCalled, false);
});
