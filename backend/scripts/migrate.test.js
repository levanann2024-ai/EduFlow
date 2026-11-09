const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  assertMigrationStatements,
  crlfMigrationChecksum,
  migrationChecksum,
  migrationNames,
  preflightSchoolManagement,
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

test('migration 041 preserves legacy snapshots and adds school-scoped year and subject relations', () => {
  const sql = fs.readFileSync(
    path.join(migrationsDirectory, '041_school_management.sql'),
    'utf8',
  );
  assert.match(sql, /CREATE TABLE academic_years/i);
  assert.match(sql, /CREATE TABLE school_subjects/i);
  assert.match(sql, /UPDATE classes c\s+SET academic_year_id = ay\.id/i);
  assert.match(sql, /UPDATE class_memberships cm\s+SET academic_year_id = c\.academic_year_id/i);
  assert.match(sql, /DROP CONSTRAINT class_homeroom_assignments_pkey/i);
  assert.match(sql, /class_homeroom_assignments_one_active_per_class/i);
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN/i);
  assert.doesNotThrow(() => assertMigrationStatements(sql, '041_school_management'));
});

test('migration 041 preflight accepts complete legacy data without writing', async () => {
  const queries = [];
  const conflicts = await preflightSchoolManagement({
    async query(sql) {
      queries.push(sql);
      return { rows: [{ count: 0 }] };
    },
  });

  assert.deepEqual(conflicts, {
    classesWithBlankAcademicYear: 0,
    academicYearLabelsNeedingManualReview: 0,
    academicYearLabelsTooLong: 0,
    subjectRowsWithBlankName: 0,
    subjectLabelsTooLong: 0,
    subjectLabelsNeedingManualReview: 0,
    duplicateClassNamesByYear: 0,
    studentsInMultipleActiveClassesPerYear: 0,
    duplicateActiveSubjectAssignments: 0,
  });
  assert.equal(queries.length, 9);
  assert.ok(queries.every((sql) => /^\s*SELECT\b/i.test(sql)));
});

test('migration 041 preflight rejects incomplete or ambiguous legacy labels before DDL', async (t) => {
  const cases = [
    ['blank academic year', 'classesWithBlankAcademicYear', /FROM classes\s+WHERE academic_year IS NULL/i],
    [
      'ambiguous academic-year labels',
      'academicYearLabelsNeedingManualReview',
      /count\(DISTINCT regexp_replace\(academic_year/i,
    ],
    [
      'academic-year label too long',
      'academicYearLabelsTooLong',
      /length\(regexp_replace\(academic_year/i,
    ],
    ['blank subject', 'subjectRowsWithBlankName', /subject IS NULL OR subject !~ '\[\^\[:space:\]\]'/i],
    [
      'subject label too long',
      'subjectLabelsTooLong',
      /length\(regexp_replace\(subject/i,
    ],
    [
      'ambiguous subject labels',
      'subjectLabelsNeedingManualReview',
      /count\(DISTINCT regexp_replace\(subject/i,
    ],
    ['duplicate normalized class code', 'duplicateClassNamesByYear', /upper\(regexp_replace\(trim\(code\)/i],
    ['multiple active classes per student and year', 'studentsInMultipleActiveClassesPerYear', /FROM class_memberships cm/i],
    [
      'duplicate active subject assignments',
      'duplicateActiveSubjectAssignments',
      /GROUP BY class_id,?\s*school_id,\s*lower\(regexp_replace\(subject/i,
    ],
  ];

  for (const [label, conflictKey, queryPattern] of cases) {
    await t.test(label, async () => {
      const queries = [];
      await assert.rejects(
        preflightSchoolManagement({
          async query(sql) {
            queries.push(sql);
            return { rows: [{ count: queryPattern.test(sql) ? 1 : 0 }] };
          },
        }),
        (error) => error.message.includes(`"${conflictKey}":1`),
      );
      assert.equal(queries.length, 9);
      assert.ok(queries.every((sql) => /^\s*SELECT\b/i.test(sql)));
    });
  }
});
