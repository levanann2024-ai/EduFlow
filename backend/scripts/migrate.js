const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function preflightSchoolManagement(client) {
  const blankYearRows = await client.query(
    `SELECT count(*)::int AS count
       FROM classes
      WHERE academic_year IS NULL OR academic_year !~ '[^[:space:]]'`,
  );
  const ambiguousYearRows = await client.query(
    `SELECT count(*)::int AS count
       FROM (
         SELECT school_id, lower(regexp_replace(academic_year, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
           FROM classes
          WHERE academic_year IS NOT NULL AND academic_year ~ '[^[:space:]]'
          GROUP BY school_id, lower(regexp_replace(academic_year, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
         HAVING count(DISTINCT regexp_replace(academic_year, '^[[:space:]]+|[[:space:]]+$', '', 'g')) > 1
       ) conflicts`,
  );
  const longYearRows = await client.query(
    `SELECT count(*)::int AS count
       FROM classes
      WHERE length(regexp_replace(academic_year, '^[[:space:]]+|[[:space:]]+$', '', 'g')) > 80`,
  );
  const blankSubjectRows = await client.query(
    `SELECT count(*)::int AS count
       FROM (
         SELECT school_id, subject FROM class_subjects
         UNION ALL
         SELECT school_id, subject FROM teacher_class_assignments
       ) subject_rows
      WHERE subject IS NULL OR subject !~ '[^[:space:]]'`,
  );
  const longSubjectRows = await client.query(
    `SELECT count(*)::int AS count
       FROM (
         SELECT school_id, subject FROM class_subjects
         UNION ALL
         SELECT school_id, subject FROM teacher_class_assignments
       ) subject_rows
      WHERE length(regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g')) > 120`,
  );
  const ambiguousSubjectRows = await client.query(
    `SELECT count(*)::int AS count
       FROM (
         SELECT school_id, lower(regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
           FROM (
             SELECT school_id, subject FROM class_subjects
             UNION ALL
             SELECT school_id, subject FROM teacher_class_assignments
           ) subject_rows
          WHERE subject IS NOT NULL AND subject ~ '[^[:space:]]'
          GROUP BY school_id, lower(regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
         HAVING count(DISTINCT regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g')) > 1
       ) conflicts`,
  );
  const classRows = await client.query(
    `SELECT count(*)::int AS count
       FROM (
         SELECT school_id, upper(regexp_replace(trim(code), '[[:space:]]+', '', 'g')),
                lower(regexp_replace(academic_year, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
           FROM classes
          GROUP BY school_id, upper(regexp_replace(trim(code), '[[:space:]]+', '', 'g')),
                   lower(regexp_replace(academic_year, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
         HAVING count(*) > 1
       ) conflicts`,
  );
  const membershipRows = await client.query(
    `SELECT count(*)::int AS count
       FROM (
         SELECT cm.student_user_id, cm.school_id,
                lower(COALESCE(NULLIF(trim(c.academic_year), ''), 'Chưa xác định'))
           FROM class_memberships cm
           JOIN classes c ON c.id = cm.class_id AND c.school_id = cm.school_id
          WHERE cm.status = 'active'
          GROUP BY cm.student_user_id, cm.school_id,
                   lower(COALESCE(NULLIF(trim(c.academic_year), ''), 'Chưa xác định'))
         HAVING count(*) > 1
       ) conflicts`,
  );
  const assignmentRows = await client.query(
    `SELECT count(*)::int AS count
       FROM (
         SELECT class_id, school_id,
                lower(regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
           FROM teacher_class_assignments
          WHERE revoked_at IS NULL
          GROUP BY class_id, school_id,
                   lower(regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
         HAVING count(*) > 1
       ) conflicts`,
  );
  const conflicts = {
    classesWithBlankAcademicYear: blankYearRows.rows[0].count,
    academicYearLabelsNeedingManualReview: ambiguousYearRows.rows[0].count,
    academicYearLabelsTooLong: longYearRows.rows[0].count,
    subjectRowsWithBlankName: blankSubjectRows.rows[0].count,
    subjectLabelsTooLong: longSubjectRows.rows[0].count,
    subjectLabelsNeedingManualReview: ambiguousSubjectRows.rows[0].count,
    duplicateClassNamesByYear: classRows.rows[0].count,
    studentsInMultipleActiveClassesPerYear: membershipRows.rows[0].count,
    duplicateActiveSubjectAssignments: assignmentRows.rows[0].count,
  };
  if (Object.values(conflicts).some((count) => count > 0)) {
    throw new Error(`Migration stopped: 039 school-management data conflicts require review: ${JSON.stringify(conflicts)}.`);
  }
  return conflicts;
}

const MIGRATIONS = [
  {
    name: '001_auth_accounts',
    file: path.join(__dirname, '..', 'db', 'migrations', '001_auth_accounts.sql'),
    preflight: null,
  },
  {
    name: '002_class_membership_history',
    file: path.join(__dirname, '..', 'db', 'migrations', '002_class_membership_history.sql'),
    lockTables: ['class_memberships', 'teacher_class_assignments'],
    preflight: async (client) => {
      const classRows = await client.query(
        `SELECT count(*)::int AS count
           FROM (
             SELECT class_id, student_user_id
               FROM class_memberships
              GROUP BY class_id, student_user_id
             HAVING count(*) FILTER (WHERE status = 'active') > 1
           ) conflicts`,
      );
      const endedRows = await client.query(
        `SELECT count(*)::int AS count
           FROM class_memberships
          WHERE (status = 'active' AND ended_at IS NOT NULL)
             OR (status = 'ended' AND ended_at IS NULL)`,
      );
      const assignmentRows = await client.query(
        `SELECT count(*)::int AS count
           FROM (
             SELECT class_id, teacher_user_id,
               lower(regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
               FROM teacher_class_assignments
              WHERE revoked_at IS NULL
              GROUP BY class_id, teacher_user_id,
                lower(regexp_replace(subject, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
             HAVING count(*) > 1
           ) conflicts`,
      );
      const conflicts = {
        activeClassMembershipDuplicates: classRows.rows[0].count,
        inconsistentClassMembershipPeriods: endedRows.rows[0].count,
        activeTeacherAssignmentDuplicates: assignmentRows.rows[0].count,
      };
      if (Object.values(conflicts).some((count) => count > 0)) {
        throw new Error(`Migration stopped: 002 class/assignment data conflicts: ${JSON.stringify(conflicts)}.`);
      }
    },
  },
  {
    name: '003_school_membership_invariant',
    file: path.join(__dirname, '..', 'db', 'migrations', '003_school_membership_invariant.sql'),
    lockTables: ['school_memberships', 'users'],
    preflight: async (client) => {
      const result = await client.query(
        `SELECT count(*)::int AS count
           FROM (
             SELECT sm.user_id
               FROM school_memberships sm
               JOIN users u ON u.id = sm.user_id
              WHERE sm.status = 'active' AND u.role IN ('student', 'lecturer')
              GROUP BY sm.user_id
             HAVING count(*) > 1
           ) conflicts`,
      );
      if (result.rows[0].count > 0) {
        throw new Error(
          `Migration stopped: 003 found ${result.rows[0].count} student/lecturer account(s) with multiple active school memberships.`,
        );
      }
    },
  },
  {
    name: '004_invitation_lifecycle',
    file: path.join(__dirname, '..', 'db', 'migrations', '004_invitation_lifecycle.sql'),
    lockTables: ['account_invitations'],
    preflight: null,
  },
  {
    name: '005_classroom_learning',
    file: path.join(__dirname, '..', 'db', 'migrations', '005_classroom_learning.sql'),
    preflight: null,
  },
  {
    name: '006_class_learning_content',
    file: path.join(__dirname, '..', 'db', 'migrations', '006_class_learning_content.sql'),
    preflight: null,
  },
  {
    name: '007_class_learning_resource_files',
    file: path.join(__dirname, '..', 'db', 'migrations', '007_class_learning_resource_files.sql'),
    preflight: null,
  },
  {
    name: '008_assignment_grading',
    file: path.join(__dirname, '..', 'db', 'migrations', '008_assignment_grading.sql'),
    preflight: null,
  },
  {
    name: '009_homeroom_class_subjects',
    file: path.join(__dirname, '..', 'db', 'migrations', '009_homeroom_class_subjects.sql'),
    preflight: null,
  },
  {
    name: '010_confirmed_term_average',
    file: path.join(__dirname, '..', 'db', 'migrations', '010_confirmed_term_average.sql'),
    preflight: null,
  },
  {
    name: '011_previous_confirmed_term_average',
    file: path.join(__dirname, '..', 'db', 'migrations', '011_previous_confirmed_term_average.sql'),
    preflight: null,
  },
  {
    name: '012_teacher_gender',
    file: path.join(__dirname, '..', 'db', 'migrations', '012_teacher_gender.sql'),
    preflight: null,
  },
  {
    name: '013_teacher_assessments',
    file: path.join(__dirname, '..', 'db', 'migrations', '013_teacher_assessments.sql'),
    preflight: null,
  },
  {
    name: '014_teacher_exam_rooms',
    file: path.join(__dirname, '..', 'db', 'migrations', '014_teacher_exam_rooms.sql'),
    preflight: null,
  },
  {
    name: '015_teacher_exam_sessions',
    file: path.join(__dirname, '..', 'db', 'migrations', '015_teacher_exam_sessions.sql'),
    preflight: async (client) => {
      const result = await client.query(
        `SELECT count(*)::int AS count
           FROM (
             SELECT school_id, code
               FROM teacher_exam_rooms
              GROUP BY school_id, code
             HAVING count(*) > 1
           ) conflicts`,
      );
      if (result.rows[0].count > 0) {
        throw new Error(
          `Migration stopped: 015 found ${result.rows[0].count} duplicate exam-room code(s) within a school.`,
        );
      }
    },
  },
  {
    name: '016_teacher_exam_grading',
    file: path.join(__dirname, '..', 'db', 'migrations', '016_teacher_exam_grading.sql'),
    preflight: null,
  },
  {
    name: '017_class_assignment_submission_files',
    file: path.join(__dirname, '..', 'db', 'migrations', '017_class_assignment_submission_files.sql'),
    preflight: null,
  },
  {
    name: '018_teacher_exam_submission_files',
    file: path.join(__dirname, '..', 'db', 'migrations', '018_teacher_exam_submission_files.sql'),
    preflight: null,
  },
  {
    name: '019_teacher_exam_grade_evidence',
    file: path.join(__dirname, '..', 'db', 'migrations', '019_teacher_exam_grade_evidence.sql'),
    preflight: null,
  },
  {
    name: '020_student_exam_mobile_uploads',
    file: path.join(__dirname, '..', 'db', 'migrations', '020_student_exam_mobile_uploads.sql'),
    preflight: null,
  },
  {
    name: '021_teacher_assessment_sections',
    file: path.join(__dirname, '..', 'db', 'migrations', '021_teacher_assessment_sections.sql'),
    preflight: null,
  },
  {
    name: '022_teacher_exam_grade_publication',
    file: path.join(__dirname, '..', 'db', 'migrations', '022_teacher_exam_grade_publication.sql'),
    preflight: null,
  },
  {
    name: '023_student_exam_grade_views',
    file: path.join(__dirname, '..', 'db', 'migrations', '023_student_exam_grade_views.sql'),
    preflight: null,
  },
  {
    name: '024_assignment_question_grading',
    file: path.join(__dirname, '..', 'db', 'migrations', '024_assignment_question_grading.sql'),
    preflight: null,
  },
  {
    name: '025_class_timetables',
    file: path.join(__dirname, '..', 'db', 'migrations', '025_class_timetables.sql'),
    preflight: null,
  },
  {
    name: '026_teacher_weekly_timetables',
    file: path.join(__dirname, '..', 'db', 'migrations', '026_teacher_weekly_timetables.sql'),
    preflight: null,
  },
  {
    name: '027_class_timetable_events',
    file: path.join(__dirname, '..', 'db', 'migrations', '027_class_timetable_events.sql'),
    lockTables: ['teacher_weekly_timetables', 'teacher_weekly_timetable_entries'],
    preflight: async (client) => {
      const result = await client.query(
        `SELECT count(*)::int AS count
           FROM (
             SELECT e.class_id, t.week_start + (e.weekday - 1) AS event_date, e.period_number
               FROM teacher_weekly_timetables t
               JOIN teacher_weekly_timetable_entries e ON e.timetable_id = t.id
              WHERE t.status = 'published'
              GROUP BY e.class_id, t.week_start + (e.weekday - 1), e.period_number
             HAVING count(*) > 1
           ) conflicts`,
      );
      if (result.rows[0].count > 0) {
        throw new Error(
          `Migration stopped: 027 found ${result.rows[0].count} conflicting published class timetable cell(s).`,
        );
      }
    },
  },
  {
    name: '028_ai_chat_history',
    file: path.join(__dirname, '..', 'db', 'migrations', '028_ai_chat_history.sql'),
    preflight: null,
  },
  {
    name: '029_ai_chat_message_images',
    file: path.join(__dirname, '..', 'db', 'migrations', '029_ai_chat_message_images.sql'),
    preflight: null,
  },
  {
    name: '030_exam_appeals',
    file: path.join(__dirname, '..', 'db', 'migrations', '030_exam_appeals.sql'),
    preflight: null,
  },
  {
    name: '031_exam_appeal_reason_length',
    file: path.join(__dirname, '..', 'db', 'migrations', '031_exam_appeal_reason_length.sql'),
    preflight: null,
  },
  {
    name: '032_student_term_grade_history',
    file: path.join(__dirname, '..', 'db', 'migrations', '032_student_term_grade_history.sql'),
    preflight: null,
  },
  {
    name: '033_exam_logs',
    file: path.join(__dirname, '..', 'db', 'migrations', '033_exam_logs.sql'),
    preflight: null,
  },
  {
    name: '034_user_avatar',
    file: path.join(__dirname, '..', 'db', 'migrations', '034_user_avatar.sql'),
    preflight: null,
  },
  {
    name: '035_user_notification_reads',
    file: path.join(__dirname, '..', 'db', 'migrations', '035_user_notification_reads.sql'),
    preflight: null,
  },
  {
    name: '036_student_learning_activity',
    file: path.join(__dirname, '..', 'db', 'migrations', '036_student_learning_activity.sql'),
    preflight: null,
  },
  {
    name: '037_exam_room_timetable_events',
    file: path.join(__dirname, '..', 'db', 'migrations', '037_exam_room_timetable_events.sql'),
    preflight: null,
  },
  {
    name: '038_saved_items',
    file: path.join(__dirname, '..', 'db', 'migrations', '038_saved_items.sql'),
    preflight: null,
  },
  {
    name: '039_sunday_timetables',
    file: path.join(__dirname, '..', 'db', 'migrations', '039_sunday_timetables.sql'),
    preflight: null,
  },
  {
    name: '040_invitation_teacher_assignment',
    file: path.join(__dirname, '..', 'db', 'migrations', '040_invitation_teacher_assignment.sql'),
    preflight: null,
  },
  {
    name: '041_school_management',
    file: path.join(__dirname, '..', 'db', 'migrations', '041_school_management.sql'),
    lockTables: ['classes', 'class_memberships', 'class_subjects', 'teacher_class_assignments', 'class_homeroom_assignments'],
    preflight: preflightSchoolManagement,
  },
  {
    name: '042_class_learning_resource_chapters',
    file: path.join(__dirname, '..', 'db', 'migrations', '042_class_learning_resource_chapters.sql'),
    preflight: null,
  },
  {
    name: '043_teacher_lesson_editor',
    file: path.join(__dirname, '..', 'db', 'migrations', '043_teacher_lesson_editor.sql'),
    preflight: null,
  },
];

const CORE_TABLES = [
  'schools',
  'users',
  'school_memberships',
  'student_profiles',
  'teacher_profiles',
  'classes',
  'class_memberships',
  'teacher_class_assignments',
  'account_invitations',
  'auth_sessions',
  'auth_refresh_tokens',
];

const APPLICATION_TABLES = [
  ...CORE_TABLES,
  'user_notification_reads',
  'student_learning_activity',
  'student_term_grades',
  'class_assignments',
  'class_assignment_submissions',
  'class_assignment_submission_files',
  'class_learning_resources',
  'class_learning_resource_files',
  'class_learning_resource_chapters',
  'class_learning_resource_assets',
  'teacher_lesson_drafts',
  'teacher_lesson_draft_assets',
  'class_subjects',
  'class_homeroom_assignments',
  'teacher_assessments',
  'teacher_exam_rooms',
  'teacher_exam_sessions',
  'teacher_exam_events',
  'teacher_exam_session_grades',
  'teacher_exam_submission_files',
  'teacher_exam_grade_evidence_files',
  'teacher_exam_mobile_upload_sessions',
  'teacher_exam_grade_views',
  'class_timetables',
  'class_timetable_entries',
  'teacher_weekly_timetables',
  'teacher_weekly_timetable_entries',
  'class_timetable_events',
  'ai_chat_conversations',
  'ai_chat_messages',
  'exam_appeals',
  'student_term_grade_history',
  'exam_logs',
  'saved_items',
  'academic_years',
  'school_subjects',
];

function assertMigrationStatements(sql, migrationName) {
  const statements = sql.split(';').map((statement) => statement.trim()).filter(Boolean);
  const allowed = [
    /^CREATE (TABLE|(?:UNIQUE )?INDEX)\b/i,
    /^ALTER TABLE [a-z0-9_.]+\s+(ADD|DROP|ALTER)\b/i,
    /^DROP INDEX [a-z0-9_.]+\b/i,
    /^INSERT INTO class_subjects \(class_id, school_id, subject\)\s+SELECT DISTINCT ON \(/i,
    /^INSERT INTO class_timetable_events\s+/i,
    /^INSERT INTO student_term_grade_history \(\s*id, class_id, school_id, student_user_id, subject, academic_year, semester,\s+average, recorded_by, recorded_at\s*\)\s+SELECT gen_random_uuid\(\), class_id, school_id, student_user_id, subject, academic_year, semester,\s+confirmed_average, updated_by, updated_at\s+FROM student_term_grades\s+WHERE confirmed_average IS NOT NULL$/i,
    /^UPDATE teacher_weekly_timetable_entries\s+SET has_homework = entry_type = 'homework'/i,
    /^UPDATE school_memberships\s+sm\s+SET role = u\.role\s+FROM users u\b/i,
    /^UPDATE student_term_grades\s+SET confirmed_average = \(\s*COALESCE\(regular_1, 0\)/i,
    /^INSERT INTO academic_years \(id, school_id, name, status, is_current\)\s+SELECT DISTINCT ON \(/i,
    /^UPDATE classes c\s+SET academic_year_id = ay\.id\s+FROM academic_years ay\b/i,
    /^UPDATE class_memberships cm\s+SET academic_year_id = c\.academic_year_id\s+FROM classes c\b/i,
    /^INSERT INTO school_subjects \(id, school_id, name\)\s+SELECT DISTINCT ON \(/i,
    /^UPDATE class_subjects cs\s+SET school_subject_id = ss\.id\s+FROM school_subjects ss\b/i,
    /^UPDATE teacher_class_assignments tca\s+SET school_subject_id = ss\.id\s+FROM school_subjects ss\b/i,
  ];
  if (
    statements.length === 0
    || statements.some((statement) => !allowed.some((pattern) => pattern.test(statement)))
  ) {
    throw new Error(`Migration stopped: ${migrationName} contains an operation outside the reviewed schema allowlist.`);
  }
}

function getNeonConnectionString() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');

  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is invalid.');
  }

  if (!parsed.hostname.endsWith('.neon.tech')) {
    throw new Error('Migration stopped because DATABASE_URL does not identify a Neon host.');
  }
  if (!['require', 'verify-ca', 'verify-full'].includes(parsed.searchParams.get('sslmode'))) {
    throw new Error('Migration stopped because DATABASE_URL does not require TLS.');
  }
  return connectionString;
}

function migrationChecksum(sql) {
  return crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

function crlfMigrationChecksum(sql) {
  return crypto.createHash('sha256').update(sql.replace(/\r\n|\n/g, '\r\n')).digest('hex');
}

async function verifyBaseSchema(client, schemaName) {
  const result = await client.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = $2 AND table_type = 'BASE TABLE'
        AND table_name = ANY($1::text[])`,
    [CORE_TABLES, schemaName],
  );
  if (CORE_TABLES.some((tableName) => !result.rows.some((row) => row.table_name === tableName))) {
    throw new Error('Migration stopped: authentication schema is incomplete.');
  }
}

async function applyMigrations(client, { schemaName = 'public', through = null } = {}) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(schemaName)) {
    throw new Error('Migration stopped: invalid schema name.');
  }
  const quotedSchema = `"${schemaName}"`;
  const throughIndex = through === null
    ? MIGRATIONS.length - 1
    : MIGRATIONS.findIndex(({ name }) => name === through);
  if (throughIndex < 0) throw new Error('Migration stopped: unknown migration boundary.');

  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('eduflow-schema-migrations'))");
    await client.query(`SET LOCAL search_path TO ${quotedSchema}`);

    const schemaResult = await client.query('SELECT current_schema() AS schema_name');
    if (schemaResult.rows[0]?.schema_name !== schemaName) {
      throw new Error('Migration stopped because the active schema does not match the requested schema.');
    }

    await client.query(
      `CREATE TABLE IF NOT EXISTS ${quotedSchema}.eduflow_schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now(),
         checksum text
       )`,
    );
    await client.query(
      `ALTER TABLE ${quotedSchema}.eduflow_schema_migrations ADD COLUMN IF NOT EXISTS checksum text`,
    );

    const appliedResult = await client.query(
      `SELECT name, checksum FROM ${quotedSchema}.eduflow_schema_migrations ORDER BY name`,
    );
    const applied = new Map(appliedResult.rows.map((row) => [row.name, row.checksum]));
    const knownNames = new Set(MIGRATIONS.map(({ name }) => name));
    if ([...applied.keys()].some((name) => !knownNames.has(name))) {
      throw new Error('Migration stopped: migration history contains an unknown migration.');
    }

    const appliedNames = [...applied.keys()];
    const expectedApplied = MIGRATIONS.slice(0, appliedNames.length).map(({ name }) => name);
    if (appliedNames.length !== expectedApplied.length
      || appliedNames.some((name, index) => name !== expectedApplied[index])) {
      throw new Error('Migration stopped: migration history is not a contiguous ordered prefix.');
    }
    for (const [name, checksum] of applied) {
      if (checksum === null) continue;
      const migration = MIGRATIONS.find((item) => item.name === name);
      const sql = fs.readFileSync(migration.file, 'utf8');
      if (checksum !== migrationChecksum(sql) && checksum !== crlfMigrationChecksum(sql)) {
        throw new Error(`Migration stopped: checksum mismatch for ${name}.`);
      }
    }

    const applicationTables = await client.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = $1 AND table_type = 'BASE TABLE'
          AND table_name <> 'eduflow_schema_migrations'
        ORDER BY table_name`,
      [schemaName],
    );
    if (applied.has('001_auth_accounts')) {
      await verifyBaseSchema(client, schemaName);
      const unexpectedTables = applicationTables.rows
        .map(({ table_name: name }) => name)
        .filter((name) => !APPLICATION_TABLES.includes(name));
      if (unexpectedTables.length > 0) {
        throw new Error('Migration stopped: untracked application tables exist in the public schema.');
      }
    } else if (applicationTables.rowCount > 0 || applied.size > 0) {
      throw new Error('Migration stopped: the database is not empty or its migration history is inconsistent.');
    }

    const pending = MIGRATIONS
      .slice(0, throughIndex + 1)
      .filter(({ name }) => !applied.has(name));
    for (const migration of pending) {
      const sql = fs.readFileSync(migration.file, 'utf8');
      assertMigrationStatements(sql, migration.name);
      await client.query("SET LOCAL lock_timeout = '5s'");
      if (migration.lockTables?.length) {
        const tables = migration.lockTables.map((table) => `${quotedSchema}.${table}`).join(', ');
        await client.query(`LOCK TABLE ${tables} IN ACCESS EXCLUSIVE MODE`);
      }
      if (migration.preflight) await migration.preflight(client);
      await client.query(sql);
      await client.query(
        `INSERT INTO ${quotedSchema}.eduflow_schema_migrations (name, checksum) VALUES ($1, $2)`,
        [migration.name, migrationChecksum(sql)],
      );
    }

    await verifyBaseSchema(client, schemaName);
    await client.query('COMMIT');
    return pending.map(({ name }) => name);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      console.error('Migration rollback could not be confirmed.');
    }
    if (error instanceof Error && error.message.startsWith('Migration stopped')) {
      throw error;
    }
    const code = typeof error?.code === 'string' ? ` (PostgreSQL code ${error.code})` : '';
    const reason = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`Database migration failed${code}${reason}; transaction was rolled back where possible.`);
  }
}

async function migrate() {
  require('dotenv').config();
  const connectionString = getNeonConnectionString();
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 1000,
  });
  let client;
  try {
    client = await pool.connect();
    const pending = await applyMigrations(client);
    if (pending.length === 0) {
      console.log(`Database migrations are already up to date; verified tables: ${APPLICATION_TABLES.join(', ')}`);
    } else {
      console.log(`Applied database migration(s): ${pending.join(', ')}; verified authentication tables.`);
    }
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  applyMigrations,
  assertMigrationStatements,
  crlfMigrationChecksum,
  migrationChecksum,
  migrationNames: MIGRATIONS.map(({ name }) => name),
  migrate,
  preflightSchoolManagement,
};
