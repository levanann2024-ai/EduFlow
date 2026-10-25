const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { assertMigrationStatements, migrationChecksum } = require('./migrate');

const migrationsDirectory = path.join(__dirname, '..', 'db', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDirectory)
  .filter((file) => /^\d+_[a-z0-9_]+\.sql$/i.test(file))
  .sort();

test('all versioned migrations use only reviewed schema operations', () => {
  assert.ok(migrationFiles.length >= 4);
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDirectory, file), 'utf8');
    assert.doesNotThrow(() => assertMigrationStatements(sql, file));
    assert.match(migrationChecksum(sql), /^[a-f0-9]{64}$/);
  }
});

test('migration allowlist rejects destructive table operations', () => {
  assert.throws(
    () => assertMigrationStatements('DROP TABLE users;', 'unsafe_test'),
    /outside the reviewed schema allowlist/,
  );
});
