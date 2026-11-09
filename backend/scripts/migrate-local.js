require('dotenv').config();

const { getPool } = require('../db/pool');
const { applyMigrations } = require('./migrate');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const LOCAL_DATABASE = 'neondb';
const LOCAL_PORT = '5432';

function validateLocalDatabaseUrl(connectionString) {
  if (typeof connectionString !== 'string' || !connectionString) {
    throw new Error('DATABASE_URL is required.');
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is invalid.');
  }

  const host = url.hostname.toLowerCase();
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || !LOCAL_HOSTS.has(host)
    || url.port !== LOCAL_PORT
    || database !== LOCAL_DATABASE
  ) {
    throw new Error('Migration stopped: only the verified loopback neondb target is allowed.');
  }

  return { host, database, port: Number(url.port) };
}

async function migrateLocal() {
  const target = validateLocalDatabaseUrl(process.env.DATABASE_URL);
  const pool = getPool();
  let client;

  try {
    client = await pool.connect();
    const before = await client.query(`
      SELECT current_database() AS database_name,
             current_schema() AS schema_name,
             current_setting('search_path') AS search_path,
             inet_server_addr()::text AS server_address,
             inet_server_port() AS server_port
    `);
    const identity = before.rows[0];
    if (identity.database_name !== target.database || identity.server_port !== Number(LOCAL_PORT)) {
      throw new Error('Migration stopped: connected database identity does not match the verified local target.');
    }

    const pendingMigrations = await applyMigrations(client);
    const appliedResult = await client.query(
      'SELECT name FROM public.eduflow_schema_migrations ORDER BY name',
    );
    const appliedMigrations = appliedResult.rows.map(({ name }) => name);
    if (!appliedMigrations.includes('041_school_management')) {
      throw new Error('Migration stopped: migration 041 is not recorded after migration.');
    }

    const verification = await client.query(`
      SELECT current_database() AS database_name,
             current_schema() AS schema_name,
             current_setting('search_path') AS search_path,
             to_regclass('public.academic_years')::text AS academic_years_table,
             inet_server_addr()::text AS server_address,
             inet_server_port() AS server_port
    `);
    if (!verification.rows[0].academic_years_table) {
      throw new Error('Migration stopped: public.academic_years is missing after migration.');
    }

    const countResult = await client.query(
      'SELECT count(*)::int AS count FROM public.academic_years',
    );
    const yearsResult = await client.query(`
      SELECT name, status, starts_on, ends_on
        FROM public.academic_years
       ORDER BY starts_on NULLS LAST, name
    `);

    console.log(JSON.stringify({
      target,
      identity: verification.rows[0],
      pendingMigrations,
      migration039Applied: true,
      academicYearsCount: countResult.rows[0].count,
      academicYears: yearsResult.rows,
    }, null, 2));
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrateLocal().catch((error) => {
    console.error('Local migration failed:', error.code || error.name || 'Error');
    process.exitCode = 1;
  });
}

module.exports = { validateLocalDatabaseUrl, migrateLocal };
