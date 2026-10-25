const { Pool } = require('pg');

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('Authentication database is not configured.');
    error.code = 'AUTH_DATABASE_NOT_CONFIGURED';
    throw error;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX) || 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on('error', (error) => {
      console.error('Unexpected database pool error:', error.message);
    });
  }

  return pool;
}

module.exports = { getPool };
