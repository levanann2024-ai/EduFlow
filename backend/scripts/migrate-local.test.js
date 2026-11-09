const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateLocalDatabaseUrl } = require('./migrate-local');

test('local migration accepts loopback aliases for neondb only', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.deepEqual(
      validateLocalDatabaseUrl(`postgresql://user:password@${host}:5432/neondb`),
      { host: host === '[::1]' ? '[::1]' : host, database: 'neondb', port: 5432 },
    );
  }
});

test('local migration rejects Neon, non-loopback, and unexpected database targets', () => {
  for (const url of [
    'postgresql://user:password@ep.example.neon.tech:5432/neondb?sslmode=require',
    'postgresql://user:password@192.168.1.10:5432/neondb',
    'postgresql://user:password@localhost:5432/postgres',
    'postgresql://user:password@localhost:5433/neondb',
  ]) {
    assert.throws(() => validateLocalDatabaseUrl(url), /only the verified loopback neondb target/);
  }
});
