const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  assertMigrationStatements,
  crlfMigrationChecksum,
  migrationChecksum,
  migrationNames,
} = require('./migrate');

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

test('all versioned migrations are registered in application order', () => {
  assert.deepEqual(
    migrationNames,
    migrationFiles.map((file) => file.replace(/\.sql$/i, '')),
  );
});

test('migration allowlist rejects destructive table operations', () => {
  assert.throws(
    () => assertMigrationStatements('DROP TABLE users;', 'unsafe_test'),
    /outside the reviewed schema allowlist/,
  );
});

test('migration checksums are stable across Windows and Unix line endings', () => {
  const sql = 'ALTER TABLE users\n  ADD COLUMN avatar_url text;\n';
  const windowsSql = sql.replace(/\n/g, '\r\n');

  assert.equal(migrationChecksum(sql), migrationChecksum(windowsSql));
  assert.equal(crlfMigrationChecksum(sql), crlfMigrationChecksum(windowsSql));
  assert.notEqual(migrationChecksum(sql), crlfMigrationChecksum(sql));
});

test('migration 031 allows nonempty appeal reasons under the UI limit', () => {
  const sql = fs.readFileSync(
    path.join(migrationsDirectory, '031_exam_appeal_reason_length.sql'),
    'utf8',
  );
  assert.match(sql, /DROP CONSTRAINT exam_appeals_reason_check/i);
  assert.match(sql, /CHECK\s*\(length\(trim\(reason\)\)\s+BETWEEN\s+1\s+AND\s+2000\)/i);
});

test('migration 032 creates and seeds TBM history snapshots', () => {
  const sql = fs.readFileSync(
    path.join(migrationsDirectory, '032_student_term_grade_history.sql'),
    'utf8',
  );
  assert.match(sql, /CREATE TABLE student_term_grade_history/i);
  assert.match(sql, /average numeric\(4, 2\) NOT NULL CHECK \(average BETWEEN 0 AND 10\)/i);
  assert.match(sql, /FROM student_term_grades\s+WHERE confirmed_average IS NOT NULL/i);
  assert.doesNotThrow(() => assertMigrationStatements(sql, '032_student_term_grade_history'));
});

test('migration 033 stores metadata-only exam behavior logs', () => {
  const sql = fs.readFileSync(
    path.join(migrationsDirectory, '033_exam_logs.sql'),
    'utf8',
  );
  assert.match(sql, /CREATE TABLE exam_logs/i);
  assert.match(sql, /event_type IN \('tab_hidden', 'face_missing', 'multiple_faces', 'speech_activity'\)/i);
  assert.match(sql, /duration_seconds numeric\(8, 3\) NOT NULL CHECK \(duration_seconds BETWEEN 0 AND 36000\)/i);
  assert.match(sql, /CREATE INDEX exam_logs_session_event_received_idx/i);
  assert.doesNotMatch(sql, /bytea|media|audio|video|image/i);
});
