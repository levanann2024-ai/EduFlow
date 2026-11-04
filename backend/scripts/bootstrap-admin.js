require('dotenv').config();

const argon2 = require('argon2');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

async function bootstrapAdmin() {
  const { DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_PASSWORD } = process.env;
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required.');
  if (
    !BOOTSTRAP_ADMIN_EMAIL
    || BOOTSTRAP_ADMIN_EMAIL.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(BOOTSTRAP_ADMIN_EMAIL)
  ) {
    throw new Error('A valid BOOTSTRAP_ADMIN_EMAIL is required.');
  }
  if (!BOOTSTRAP_ADMIN_NAME || BOOTSTRAP_ADMIN_NAME.trim().length < 2 || BOOTSTRAP_ADMIN_NAME.trim().length > 120) {
    throw new Error('BOOTSTRAP_ADMIN_NAME is required.');
  }
  if (!BOOTSTRAP_ADMIN_PASSWORD || BOOTSTRAP_ADMIN_PASSWORD.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters.');
  }

  const pool = new Pool({ connectionString: DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('eduflow-initial-system-admin'))");
    const existing = await client.query('SELECT EXISTS (SELECT 1 FROM users) AS has_users');
    if (existing.rows[0].has_users) {
      throw new Error('Bootstrap stopped because the users table is not empty.');
    }
    const passwordHash = await argon2.hash(BOOTSTRAP_ADMIN_PASSWORD, { type: argon2.argon2id });
    await client.query(
      `INSERT INTO users (id, email, full_name, password_hash, role, admin_scope, profile_completed_at)
       VALUES ($1, lower($2), $3, $4, 'admin', 'system', now())`,
      [randomUUID(), BOOTSTRAP_ADMIN_EMAIL.trim(), BOOTSTRAP_ADMIN_NAME.trim(), passwordHash],
    );
    await client.query('COMMIT');
    console.log('Initial system administrator created.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

bootstrapAdmin().catch((error) => {
  console.error('Could not bootstrap the initial system administrator:', error.message);
  process.exitCode = 1;
});
