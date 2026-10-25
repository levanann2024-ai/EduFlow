const argon2 = require('argon2');
const { randomBytes, randomUUID } = require('node:crypto');
const { getPool } = require('../db/pool');
const { hasValidSchoolScope } = require('./school-scope');
const {
  ACCESS_TOKEN_TTL_SECONDS,
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
} = require('./tokens');

const REFRESH_TOKEN_TTL_DAYS = 30;
const PASSWORD_MIN_LENGTH = 12;
let dummyPasswordHash;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function getDummyPasswordHash() {
  if (!dummyPasswordHash) {
    dummyPasswordHash = argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id });
  }
  return dummyPasswordHash;
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    adminScope: row.admin_scope ?? null,
    schoolIds: row.school_ids ?? [],
    mustChangePassword: row.must_change_password,
    profileComplete: row.profile_completed_at !== null,
  };
}

async function loadUser(userId, client = getPool()) {
  const result = await client.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.admin_scope, u.status, u.must_change_password,
            u.profile_completed_at,
            COALESCE(array_agg(sm.school_id) FILTER (
              WHERE sm.status = 'active' AND sc.status = 'active'
            ), '{}') AS school_ids
       FROM users u
       LEFT JOIN school_memberships sm ON sm.user_id = u.id
       LEFT JOIN schools sc ON sc.id = sm.school_id
      WHERE u.id = $1
      GROUP BY u.id`,
    [userId],
  );
  return result.rows[0] ? publicUser(result.rows[0]) : null;
}

async function createSession(client, userId) {
  const sessionId = randomUUID();
  const refreshTokenId = randomUUID();
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await client.query(
    'INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [sessionId, userId, expiresAt],
  );
  await client.query(
    `INSERT INTO auth_refresh_tokens (id, session_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [refreshTokenId, sessionId, hashRefreshToken(refreshToken), expiresAt],
  );

  return {
    sessionId,
    refreshToken,
    expiresAt,
    accessToken: signAccessToken(userId, sessionId),
  };
}

async function login(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, email, password_hash, role, admin_scope, status
       FROM users
      WHERE lower(email) = $1`,
    [normalizedEmail],
  );
  const user = result.rows[0];
  const passwordHash = user ? user.password_hash : await getDummyPasswordHash();
  const passwordMatches = await argon2.verify(passwordHash, password);

  if (!user || user.status !== 'active' || !passwordMatches) {
    const error = new Error('Email hoặc mật khẩu không đúng.');
    error.status = 401;
    throw error;
  }
  const existingUser = await loadUser(user.id, pool);
  if (!existingUser || !hasValidSchoolScope(existingUser)) {
    const error = new Error('Email hoặc mật khẩu không đúng.');
    error.status = 401;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const authUser = await loadUser(user.id, client);
    if (!authUser || !hasValidSchoolScope(authUser)) {
      const error = new Error('Email hoặc mật khẩu không đúng.');
      error.status = 401;
      throw error;
    }
    const session = await createSession(client, user.id);
    await client.query('COMMIT');
    return { ...session, user: authUser };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function rotateRefreshToken(refreshToken) {
  const pool = getPool();
  const client = await pool.connect();
  let invalid = false;
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT rt.id AS refresh_id, rt.session_id, rt.expires_at AS refresh_expires_at,
              rt.consumed_at, s.user_id, s.expires_at AS session_expires_at, s.revoked_at,
              u.status, u.role, u.admin_scope,
              (
                SELECT count(DISTINCT sc.id)::int
                  FROM school_memberships sm
                  JOIN schools sc ON sc.id = sm.school_id
                 WHERE sm.user_id = u.id AND sm.status = 'active' AND sc.status = 'active'
              ) AS active_school_count
         FROM auth_refresh_tokens rt
         JOIN auth_sessions s ON s.id = rt.session_id
         JOIN users u ON u.id = s.user_id
        WHERE rt.token_hash = $1
        FOR UPDATE OF rt, s`,
      [hashRefreshToken(refreshToken)],
    );
    const current = result.rows[0];
    if (!current) {
      invalid = true;
    } else if (current.consumed_at) {
      await client.query(
        'UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1',
        [current.session_id],
      );
      invalid = true;
    } else if (
      current.revoked_at
      || current.status !== 'active'
      || ((current.role === 'student' || current.role === 'lecturer')
        && current.active_school_count !== 1)
      || (current.admin_scope === 'school' && current.active_school_count === 0)
      || new Date(current.refresh_expires_at) <= new Date()
      || new Date(current.session_expires_at) <= new Date()
    ) {
      await client.query(
        'UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1',
        [current.session_id],
      );
      invalid = true;
    } else {
      const nextRefreshId = randomUUID();
      const nextRefreshToken = createRefreshToken();
      const expiresAt = new Date(current.session_expires_at);
      await client.query(
        `INSERT INTO auth_refresh_tokens (id, session_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [nextRefreshId, current.session_id, hashRefreshToken(nextRefreshToken), expiresAt],
      );
      await client.query(
        `UPDATE auth_refresh_tokens
            SET consumed_at = now(), replaced_by = $2
          WHERE id = $1`,
        [current.refresh_id, nextRefreshId],
      );
      await client.query(
        'UPDATE auth_sessions SET last_used_at = now() WHERE id = $1',
        [current.session_id],
      );
      const user = await loadUser(current.user_id, client);
      await client.query('COMMIT');
      return {
        accessToken: signAccessToken(current.user_id, current.session_id),
        refreshToken: nextRefreshToken,
        expiresAt,
        user,
      };
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (invalid) {
    const error = new Error('Phiên đăng nhập đã hết hạn hoặc không hợp lệ.');
    error.status = 401;
    throw error;
  }
  throw new Error('Không thể làm mới phiên đăng nhập.');
}

async function changePassword(userId, currentPassword, newPassword, currentSessionId) {
  if (typeof newPassword !== 'string' || newPassword.length < PASSWORD_MIN_LENGTH || newPassword.length > 128) {
    const error = new Error(`Mật khẩu mới cần có từ ${PASSWORD_MIN_LENGTH} đến 128 ký tự.`);
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const result = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1 AND status = $2',
    [userId, 'active'],
  );
  const user = result.rows[0];
  if (!user || !(await argon2.verify(user.password_hash, currentPassword))) {
    const error = new Error('Mật khẩu hiện tại không đúng.');
    error.status = 401;
    throw error;
  }

  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE users
          SET password_hash = $2, must_change_password = false, updated_at = now()
        WHERE id = $1`,
      [userId, passwordHash],
    );
    if (currentSessionId) {
      await client.query(
        `UPDATE auth_sessions
            SET revoked_at = COALESCE(revoked_at, now())
          WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
        [userId, currentSessionId],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function completeProfile(userId, fullName, roleProfile = {}) {
  if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 120) {
    const error = new Error('Họ và tên cần có từ 2 đến 120 ký tự.');
    error.status = 400;
    throw error;
  }

  const profileFields = ['grade', 'studentNumber', 'employeeNumber'];
  for (const field of profileFields) {
    const value = roleProfile[field];
    if (value !== undefined && (typeof value !== 'string' || value.trim().length > 80)) {
      const error = new Error('Thông tin hồ sơ theo vai trò không hợp lệ.');
      error.status = 400;
      throw error;
    }
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT role
         FROM users
        WHERE id = $1 AND status = 'active' AND must_change_password = false
        FOR UPDATE`,
      [userId],
    );
    const user = result.rows[0];
    if (!user) {
      const error = new Error('Hãy đổi mật khẩu ban đầu trước khi hoàn thiện hồ sơ.');
      error.status = 403;
      throw error;
    }

    if (user.role === 'student') {
      const profile = await client.query(
        `UPDATE student_profiles
            SET grade = COALESCE(NULLIF($2, ''), grade),
                student_number = COALESCE(NULLIF($3, ''), student_number)
          WHERE user_id = $1`,
        [userId, roleProfile.grade?.trim() ?? '', roleProfile.studentNumber?.trim() ?? ''],
      );
      if (!profile.rowCount) {
        const error = new Error('Hồ sơ học sinh chưa được khởi tạo.');
        error.status = 409;
        throw error;
      }
    } else if (user.role === 'lecturer') {
      const profile = await client.query(
        `UPDATE teacher_profiles
            SET employee_number = COALESCE(NULLIF($2, ''), employee_number)
          WHERE user_id = $1`,
        [userId, roleProfile.employeeNumber?.trim() ?? ''],
      );
      if (!profile.rowCount) {
        const error = new Error('Hồ sơ giáo viên chưa được khởi tạo.');
        error.status = 409;
        throw error;
      }
    }

    await client.query(
      `UPDATE users
          SET full_name = $2, profile_completed_at = now(), updated_at = now()
        WHERE id = $1`,
      [userId, fullName.trim()],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createInvitation({ email, role, schoolId, invitedBy, adminScope, allowedSchoolIds }) {
  const normalizedEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error = new Error('Email không hợp lệ.');
    error.status = 400;
    throw error;
  }
  if (!['student', 'lecturer', 'admin'].includes(role) || (role === 'admin' && adminScope !== 'system')) {
    const error = new Error('Vai trò được mời không hợp lệ hoặc vượt phạm vi quản lý.');
    error.status = 400;
    throw error;
  }

  const resolvedSchoolId = schoolId || (allowedSchoolIds.length === 1 ? allowedSchoolIds[0] : null);
  if (
    typeof resolvedSchoolId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resolvedSchoolId)
    || (adminScope !== 'system' && allowedSchoolIds.length > 0 && !allowedSchoolIds.includes(resolvedSchoolId))
  ) {
    const error = new Error('Trường được chọn không thuộc phạm vi quản lý của tài khoản.');
    error.status = 403;
    throw error;
  }

  const pool = getPool();
  const client = await pool.connect();
  const token = createRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  try {
    await client.query('BEGIN');
    const school = await client.query(
      'SELECT 1 FROM schools WHERE id = $1 AND status = $2 FOR UPDATE',
      [resolvedSchoolId, 'active'],
    );
    if (!school.rowCount) {
      const error = new Error('Trường được chọn không hoạt động hoặc không tồn tại.');
      error.status = 400;
      throw error;
    }
    const existingUser = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [normalizedEmail]);
    if (existingUser.rowCount) {
      const error = new Error('Email này đã có tài khoản.');
      error.status = 409;
      throw error;
    }
    await client.query(
      `UPDATE account_invitations
          SET closed_at = now(), closed_reason = 'expired'
        WHERE lower(email) = $1 AND role = $2 AND school_id = $3
          AND consumed_at IS NULL AND closed_at IS NULL AND expires_at <= now()`,
      [normalizedEmail, role, resolvedSchoolId],
    );
    await client.query(
      `INSERT INTO account_invitations
         (id, email, role, school_id, token_hash, expires_at, invited_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), normalizedEmail, role, resolvedSchoolId, hashRefreshToken(token), expiresAt, invitedBy],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      const conflict = new Error('Đã có lời mời đang chờ cho email và vai trò này tại trường.');
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  } finally {
    client.release();
  }

  return { token, expiresAt };
}

async function acceptInvitation({ token, fullName, password }) {
  if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 120) {
    const error = new Error('Họ và tên cần có từ 2 đến 120 ký tự.');
    error.status = 400;
    throw error;
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || password.length > 128) {
    const error = new Error(`Mật khẩu cần có từ ${PASSWORD_MIN_LENGTH} đến 128 ký tự.`);
    error.status = 400;
    throw error;
  }

  const pool = getPool();
  const client = await pool.connect();
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  try {
    await client.query('BEGIN');
    const invitationPreview = await client.query(
      `SELECT id, school_id
         FROM account_invitations
        WHERE token_hash = $1`,
      [hashRefreshToken(token)],
    );
    const preview = invitationPreview.rows[0];
    if (!preview) {
      const error = new Error('Liên kết mời đã hết hạn hoặc không hợp lệ.');
      error.status = 400;
      throw error;
    }

    const school = await client.query(
      'SELECT status FROM schools WHERE id = $1 FOR UPDATE',
      [preview.school_id],
    );
    if (!school.rowCount || school.rows[0].status !== 'active') {
      const error = new Error('Trường trong lời mời không còn hoạt động.');
      error.status = 400;
      throw error;
    }

    const result = await client.query(
      `SELECT id, email, role, school_id, expires_at, consumed_at, closed_at
         FROM account_invitations
        WHERE id = $1 AND token_hash = $2
        FOR UPDATE`,
      [preview.id, hashRefreshToken(token)],
    );
    const invitation = result.rows[0];
    if (
      !invitation
      || invitation.closed_at
      || invitation.consumed_at
      || new Date(invitation.expires_at) <= new Date()
    ) {
      const error = new Error('Liên kết mời đã hết hạn hoặc không hợp lệ.');
      error.status = 400;
      throw error;
    }

    const existingUser = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [invitation.email]);
    if (existingUser.rowCount) {
      const error = new Error('Email này đã có tài khoản.');
      error.status = 409;
      throw error;
    }

    const userId = randomUUID();
    await client.query(
        `INSERT INTO users (id, email, full_name, password_hash, role, admin_scope)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          invitation.email,
          fullName.trim(),
          passwordHash,
          invitation.role,
          invitation.role === 'admin' ? 'school' : null,
        ],
    );
    const membershipId = randomUUID();
    await client.query(
      'INSERT INTO school_memberships (id, user_id, school_id, role) VALUES ($1, $2, $3, $4)',
      [membershipId, userId, invitation.school_id, invitation.role],
    );
    if (invitation.role === 'student') {
      await client.query(
        'INSERT INTO student_profiles (user_id, membership_id, school_id) VALUES ($1, $2, $3)',
        [userId, membershipId, invitation.school_id],
      );
    } else if (invitation.role === 'lecturer') {
      await client.query(
        'INSERT INTO teacher_profiles (user_id, membership_id, school_id) VALUES ($1, $2, $3)',
        [userId, membershipId, invitation.school_id],
      );
    }
    await client.query(
      `UPDATE account_invitations
          SET consumed_at = now()
        WHERE id = $1`,
      [invitation.id],
    );
    const session = await createSession(client, userId);
    const user = await loadUser(userId, client);
    await client.query('COMMIT');
    return { ...session, user };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      const conflict = new Error('Email này đã có tài khoản.');
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  } finally {
    client.release();
  }
}

async function listSchools(allowedSchoolIds, systemAdmin) {
  const result = !systemAdmin
    ? await getPool().query(
      `SELECT id, name
         FROM schools
        WHERE status = 'active' AND id = ANY($1::uuid[])
        ORDER BY name`,
      [allowedSchoolIds],
    )
    : await getPool().query(
      `SELECT id, name
         FROM schools
        WHERE status = 'active'
        ORDER BY name`,
    );
  return result.rows;
}

async function createSchool(name) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 160) {
    const error = new Error('Tên trường cần có từ 2 đến 160 ký tự.');
    error.status = 400;
    throw error;
  }
  const id = randomUUID();
  await getPool().query(
    'INSERT INTO schools (id, name) VALUES ($1, $2)',
    [id, name.trim()],
  );
  return { id, name: name.trim() };
}

async function listUsers(allowedSchoolIds, systemAdmin) {
  const result = !systemAdmin
    ? await getPool().query(
      `SELECT u.id, u.email, u.full_name, u.role, u.admin_scope, u.status, u.created_at,
              array_agg(DISTINCT sm.school_id) FILTER (WHERE sm.school_id IS NOT NULL) AS school_ids
         FROM users u
         JOIN school_memberships sm ON sm.user_id = u.id
         JOIN schools sc ON sc.id = sm.school_id
        WHERE sm.status = 'active' AND sc.status = 'active' AND sm.school_id = ANY($1::uuid[])
        GROUP BY u.id
        ORDER BY u.created_at DESC`,
      [allowedSchoolIds],
    )
    : await getPool().query(
      `SELECT u.id, u.email, u.full_name, u.role, u.admin_scope, u.status, u.created_at,
              COALESCE(array_agg(DISTINCT sm.school_id) FILTER (WHERE sm.school_id IS NOT NULL), '{}') AS school_ids
         FROM users u
         LEFT JOIN school_memberships sm ON sm.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC`,
    );
  return result.rows;
}

module.exports = {
  ACCESS_TOKEN_TTL_SECONDS,
  PASSWORD_MIN_LENGTH,
  acceptInvitation,
  changePassword,
  completeProfile,
  createSchool,
  createInvitation,
  listSchools,
  listUsers,
  loadUser,
  login,
  publicUser,
  rotateRefreshToken,
};
