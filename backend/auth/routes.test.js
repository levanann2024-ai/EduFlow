const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const { after, before, beforeEach, test } = require('node:test');
const cookieParser = require('cookie-parser');
const express = require('express');

process.env.AUTH_JWT_SECRET = crypto.randomBytes(32).toString('base64');
process.env.AUTH_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.EDUFLOW_DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';

let activePool;
const poolModulePath = require.resolve('../db/pool');
const poolModule = new Module(poolModulePath);
poolModule.filename = poolModulePath;
poolModule.loaded = true;
poolModule.exports = { getPool: () => activePool };
require.cache[poolModulePath] = poolModule;

const { router } = require('./routes');
const { signAccessToken } = require('./tokens');

const USER_ID = 'user-test';
const SESSION_ID = 'session-test';
const SCHOOL_ID = 'school-test';
const INITIAL_REFRESH_TOKEN = 'initial-test-refresh-token';
const REFRESH_COOKIE_NAME = 'eduflow_refresh';
const futureDate = () => new Date(Date.now() + 60 * 60 * 1000);

class FakeAuthPool {
  constructor({ role = 'admin', status = 'active' } = {}) {
    this.user = {
      id: USER_ID,
      email: 'test@example.invalid',
      full_name: 'Test User',
      role,
      admin_scope: role === 'admin' ? 'system' : null,
      status,
      must_change_password: false,
      profile_completed_at: new Date(),
      school_ids: role === 'admin' ? [] : [SCHOOL_ID],
    };
    this.profile = { grade: null, student_number: null, employee_number: null };
    this.sessions = new Map([[
      SESSION_ID,
      {
        id: SESSION_ID,
        user_id: USER_ID,
        expires_at: futureDate(),
        revoked_at: null,
      },
    ]]);
    this.refreshTokens = new Map();
    this.refreshTokens.set(
      require('./tokens').hashRefreshToken(INITIAL_REFRESH_TOKEN),
      {
        id: 'refresh-initial',
        session_id: SESSION_ID,
        expires_at: futureDate(),
        consumed_at: null,
        replaced_by: null,
      },
    );
  }

  async query(sql, values = []) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('UPDATE auth_sessions SET revoked_at = COALESCE')) {
      const token = this.refreshTokens.get(values[0]);
      const session = token && this.sessions.get(token.session_id);
      if (session) session.revoked_at = new Date();
      return { rowCount: session ? 1 : 0, rows: [] };
    }
    if (normalized.includes('FROM auth_sessions s')) {
      const session = this.sessions.get(values[0]);
      if (
        !session
        || session.user_id !== values[1]
        || session.revoked_at
        || session.expires_at <= new Date()
        || this.user.status !== 'active'
      ) {
        return { rows: [] };
      }
      return {
        rows: [{
          id: this.user.id,
          role: this.user.role,
          admin_scope: this.user.admin_scope,
          must_change_password: this.user.must_change_password,
          profile_completed_at: this.user.profile_completed_at,
          school_ids: this.user.school_ids,
        }],
      };
    }
    if (normalized.includes('FROM users u') && normalized.includes('WHERE u.id = $1')) {
      if (values[0] !== this.user.id || this.user.status !== 'active') return { rows: [] };
      return { rows: [this.user] };
    }
    throw new Error(`Unexpected pool query in auth test: ${normalized}`);
  }

  async connect() {
    return {
      query: async (sql, values = []) => this.clientQuery(sql, values),
      release() {},
    };
  }

  async clientQuery(sql, values = []) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalized)) {
      return { rows: [] };
    }
    if (normalized.startsWith('SELECT role FROM users')) {
      if (values[0] !== this.user.id || this.user.status !== 'active' || this.user.must_change_password) {
        return { rows: [] };
      }
      return { rows: [{ role: this.user.role }] };
    }
    if (normalized.startsWith('UPDATE student_profiles')) {
      this.profile.grade = values[1] || this.profile.grade;
      this.profile.student_number = values[2] || this.profile.student_number;
      return { rowCount: this.user.role === 'student' ? 1 : 0, rows: [] };
    }
    if (normalized.startsWith('UPDATE teacher_profiles')) {
      this.profile.employee_number = values[1] || this.profile.employee_number;
      return { rowCount: this.user.role === 'lecturer' ? 1 : 0, rows: [] };
    }
    if (normalized.startsWith('UPDATE users SET full_name')) {
      this.user.full_name = values[1];
      this.user.profile_completed_at = new Date();
      return { rowCount: 1, rows: [] };
    }
    if (normalized.includes('FROM auth_refresh_tokens rt')) {
      const token = this.refreshTokens.get(values[0]);
      if (!token) return { rows: [] };
      const session = this.sessions.get(token.session_id);
      return {
        rows: [{
          refresh_id: token.id,
          session_id: token.session_id,
          refresh_expires_at: token.expires_at,
          consumed_at: token.consumed_at,
          user_id: this.user.id,
          session_expires_at: session.expires_at,
          revoked_at: session.revoked_at,
          status: this.user.status,
          role: this.user.role,
          admin_scope: this.user.admin_scope,
          active_school_count: this.user.school_ids.length,
        }],
      };
    }
    if (normalized.startsWith('INSERT INTO auth_refresh_tokens')) {
      this.refreshTokens.set(values[2], {
        id: values[0],
        session_id: values[1],
        expires_at: values[3],
        consumed_at: null,
        replaced_by: null,
      });
      return { rowCount: 1, rows: [] };
    }
    if (normalized.startsWith('UPDATE auth_refresh_tokens')) {
      const token = [...this.refreshTokens.values()].find((entry) => entry.id === values[0]);
      assert.ok(token, 'rotation must update the presented refresh token');
      token.consumed_at = new Date();
      token.replaced_by = values[1];
      return { rowCount: 1, rows: [] };
    }
    if (normalized.startsWith('UPDATE auth_sessions SET last_used_at')) {
      return { rowCount: 1, rows: [] };
    }
    if (normalized.startsWith('UPDATE auth_sessions SET revoked_at = COALESCE')) {
      const session = this.sessions.get(values[0]);
      if (session) session.revoked_at = new Date();
      return { rowCount: session ? 1 : 0, rows: [] };
    }
    if (normalized.includes('FROM users u') && normalized.includes('WHERE u.id = $1')) {
      return this.query(sql, values);
    }
    throw new Error(`Unexpected client query in auth test: ${normalized}`);
  }
}

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', router);
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ success: false });
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  activePool = new FakeAuthPool();
});

async function post(path, token) {
  return fetch(`${baseUrl}/api/auth/${path}`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      Cookie: `${REFRESH_COOKIE_NAME}=${token}`,
    },
  });
}

async function completeProfile(token, body) {
  return fetch(`${baseUrl}/api/auth/complete-profile`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function postWithAccessToken(path, token, body = {}) {
  return fetch(`${baseUrl}/api/auth/${path}`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function getWithAccessToken(path, token) {
  return fetch(`${baseUrl}/api/auth/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function refreshTokenFrom(response) {
  const cookie = response.headers.get('set-cookie') || '';
  const match = cookie.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
  assert.ok(match, 'successful refresh must set a successor refresh cookie');
  return match[1];
}

test('refresh rotation accepts the successor, rejects replay, and revokes the session', async () => {
  const firstRotation = await post('refresh', INITIAL_REFRESH_TOKEN);
  assert.equal(firstRotation.status, 200);
  const successor = refreshTokenFrom(firstRotation);

  const secondRotation = await post('refresh', successor);
  assert.equal(secondRotation.status, 200);
  const latestToken = refreshTokenFrom(secondRotation);

  const replay = await post('refresh', INITIAL_REFRESH_TOKEN);
  assert.equal(replay.status, 401);
  assert.ok(activePool.sessions.get(SESSION_ID).revoked_at);

  const afterReplay = await post('refresh', latestToken);
  assert.equal(afterReplay.status, 401);
  assert.equal(activePool.sessions.size, 1);
});

test('logout revokes the session and prevents refresh from creating another session', async () => {
  const logout = await post('logout', INITIAL_REFRESH_TOKEN);
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.get('set-cookie').includes(`${REFRESH_COOKIE_NAME}=;`));
  assert.ok(activePool.sessions.get(SESSION_ID).revoked_at);

  const refreshAfterLogout = await post('refresh', INITIAL_REFRESH_TOKEN);
  assert.equal(refreshAfterLogout.status, 401);
  assert.equal(activePool.sessions.size, 1);
});

test('refresh rejects a lecturer with multiple active schools and revokes the session', async () => {
  activePool = new FakeAuthPool({ role: 'lecturer' });
  activePool.user.school_ids = ['school-one', 'school-two'];

  const response = await post('refresh', INITIAL_REFRESH_TOKEN);

  assert.equal(response.status, 401);
  assert.ok(activePool.sessions.get(SESSION_ID).revoked_at);
  assert.equal(activePool.refreshTokens.size, 1);
});

test('expired and disabled accounts are rejected, and non-admins cannot access admin APIs', async () => {
  const expiredToken = require('jsonwebtoken').sign(
    { sid: SESSION_ID },
    process.env.AUTH_JWT_SECRET,
    {
      algorithm: 'HS256',
      subject: USER_ID,
      issuer: 'eduflow-api',
      audience: 'eduflow-app',
      expiresIn: -1,
    },
  );
  const expiredResponse = await getWithAccessToken('me', expiredToken);
  assert.equal(expiredResponse.status, 401);

  const expiredRefresh = [...activePool.refreshTokens.values()][0];
  expiredRefresh.expires_at = new Date(Date.now() - 1000);
  const expiredRefreshResponse = await post('refresh', INITIAL_REFRESH_TOKEN);
  assert.equal(expiredRefreshResponse.status, 401);
  assert.ok(activePool.sessions.get(SESSION_ID).revoked_at);

  activePool = new FakeAuthPool();
  activePool.user.status = 'disabled';
  const disabledResponse = await getWithAccessToken(
    'me',
    signAccessToken(USER_ID, SESSION_ID),
  );
  assert.equal(disabledResponse.status, 401);

  activePool = new FakeAuthPool({ role: 'student' });
  const studentToken = signAccessToken(USER_ID, SESSION_ID);
  const usersResponse = await getWithAccessToken('users', studentToken);
  const schoolsResponse = await getWithAccessToken('schools', studentToken);
  assert.equal(usersResponse.status, 403);
  assert.equal(schoolsResponse.status, 403);

  activePool.user.school_ids = ['school-one', 'school-two'];
  const inconsistentScopeResponse = await getWithAccessToken('me', studentToken);
  assert.equal(inconsistentScopeResponse.status, 409);
  assert.equal((await inconsistentScopeResponse.json()).code, 'SCHOOL_MEMBERSHIP_INVARIANT_VIOLATION');
});

test('role-specific profile completion stores optional student and lecturer details', async () => {
  activePool = new FakeAuthPool({ role: 'student' });
  const studentToken = signAccessToken(USER_ID, SESSION_ID);
  const studentResponse = await completeProfile(studentToken, {
    fullName: 'Student User',
    grade: '10A',
    studentNumber: 'ST-001',
  });
  assert.equal(studentResponse.status, 200);
  assert.deepEqual(activePool.profile, {
    grade: '10A',
    student_number: 'ST-001',
    employee_number: null,
  });
  assert.ok(activePool.user.profile_completed_at);

  activePool = new FakeAuthPool({ role: 'lecturer' });
  const lecturerToken = signAccessToken(USER_ID, SESSION_ID);
  const lecturerResponse = await completeProfile(lecturerToken, {
    fullName: 'Lecturer User',
    employeeNumber: 'TC-001',
  });
  assert.equal(lecturerResponse.status, 200);
  assert.deepEqual(activePool.profile, {
    grade: null,
    student_number: null,
    employee_number: 'TC-001',
  });
  assert.ok(activePool.user.profile_completed_at);
});

test('demo accounts cannot change a real account password or profile', async () => {
  const demoToken = require('./tokens').signDemoToken('student');
  const passwordResponse = await postWithAccessToken('change-password', demoToken, {
    currentPassword: 'not-a-real-password',
    newPassword: 'not-a-real-password-either',
  });
  const profileResponse = await postWithAccessToken('complete-profile', demoToken, {
    fullName: 'Demo User',
    grade: '10A',
  });

  assert.equal(passwordResponse.status, 403);
  assert.equal(profileResponse.status, 403);
  assert.equal(activePool.user.full_name, 'Test User');
});
