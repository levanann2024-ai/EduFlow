require('dotenv').config();

const argon2 = require('argon2');
const { randomInt, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Pool } = require('pg');

const OLD_TEACHER_EMAIL = 'duc.11a2.hoa@classroom-test.example.invalid';
const TEACHER_EMAIL = 'ducthe@eduflow.test';
const CLASS_CODE = '11A2';
const ACADEMIC_YEAR = '2026-2027';
const TEACHER_SUBJECT = 'Hóa học';
const PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const REQUIRED_MIGRATIONS = [
  '001_auth_accounts',
  '002_class_membership_history',
  '003_school_membership_invariant',
  '009_homeroom_class_subjects',
  '041_school_management',
];

function assertEnabled() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test accounts cannot be provisioned in production.');
  }
  if (process.env.EDUFLOW_ALLOW_11A2_STUDENT_SEED !== 'true') {
    throw new Error('Set EDUFLOW_ALLOW_11A2_STUDENT_SEED=true to explicitly enable this seed.');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
}

function readRoster(rosterPath) {
  const parsed = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length !== 49) {
    throw new Error('Roster must contain exactly 49 students.');
  }

  const emails = new Set();
  const names = new Set();
  return parsed.map((entry) => {
    if (
      !entry
      || typeof entry.fullName !== 'string'
      || typeof entry.email !== 'string'
      || entry.fullName.trim().length < 2
      || entry.fullName.trim().length > 120
      || entry.email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry.email)
      || !entry.email.toLowerCase().endsWith('@eduflow.test')
    ) {
      throw new Error('Roster contains an invalid name or test email.');
    }

    const fullName = entry.fullName.trim();
    const email = entry.email.trim().toLowerCase();
    const normalizedName = fullName.toLocaleLowerCase('vi');
    if (emails.has(email) || names.has(normalizedName)) {
      throw new Error('Roster contains duplicate email addresses or names.');
    }
    emails.add(email);
    names.add(normalizedName);
    return { fullName, email };
  });
}

function generateTemporaryPassword() {
  let password = '';
  for (let index = 0; index < 12; index += 1) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function writePrivateCredentials(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const header = ['Họ và tên', 'Email', 'Mật khẩu tạm'];
  const csv = `\uFEFF${[header, ...rows.map(({ fullName, email, password }) => [fullName, email, password])]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')}\r\n`;
  let created = false;
  try {
    fs.writeFileSync(filePath, csv, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    created = true;
    const principal = execFileSync('whoami', [], { encoding: 'utf8' }).trim();
    execFileSync('icacls', [
      filePath,
      '/inheritance:r',
      '/grant:r',
      `${principal}:(F)`,
      'SYSTEM:(F)',
    ], { stdio: 'ignore' });
  } catch (error) {
    if (created) fs.rmSync(filePath, { force: true });
    throw error;
  }
}

async function provision(roster, credentialsPath) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000 });
  let credentialsWritten = false;
  const newCredentials = [];
  const summary = { accountsCreated: 0, accountsReused: 0, classLinksCreated: 0 };
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('eduflow-11a2-student-seed'))");

      const migrationResult = await client.query(
        'SELECT name FROM eduflow_schema_migrations WHERE name = ANY($1::text[])',
        [REQUIRED_MIGRATIONS],
      );
      const appliedMigrations = new Set(migrationResult.rows.map(({ name }) => name));
      if (REQUIRED_MIGRATIONS.some((name) => !appliedMigrations.has(name))) {
        throw new Error('Required account/class schema migrations are not all applied.');
      }

      const classResult = await client.query(
        `SELECT c.id, c.school_id, c.name, c.grade, c.academic_year_id
           FROM classes c
           JOIN schools s ON s.id = c.school_id
          WHERE lower(c.code) = lower($1) AND c.academic_year = $2
            AND c.status = 'active' AND s.status = 'active'
          FOR UPDATE OF c`,
        [CLASS_CODE, ACADEMIC_YEAR],
      );
      if (classResult.rowCount !== 1) {
        throw new Error(`Expected exactly one active ${CLASS_CODE} class for ${ACADEMIC_YEAR}; found ${classResult.rowCount}.`);
      }
      const classroom = classResult.rows[0];

      const teacherResult = await client.query(
        `SELECT id, full_name, role, status
           FROM users
          WHERE lower(email) = lower($1)
          FOR UPDATE`,
        [OLD_TEACHER_EMAIL],
      );
      if (teacherResult.rowCount !== 1) {
        throw new Error('The confirmed existing teacher account was not found uniquely.');
      }
      const teacher = teacherResult.rows[0];
      if (teacher.full_name !== 'Đức' || teacher.role !== 'lecturer' || teacher.status !== 'active') {
        throw new Error('The existing teacher account no longer matches the inspected name, role, or status.');
      }

      const emailCollision = await client.query(
        'SELECT id FROM users WHERE lower(email) = lower($1) FOR UPDATE',
        [TEACHER_EMAIL],
      );
      if (emailCollision.rowCount) {
        throw new Error(`The requested teacher email ${TEACHER_EMAIL} is already in use; no data was changed.`);
      }

      const teacherMembership = await client.query(
        `SELECT id, role, status
           FROM school_memberships
          WHERE user_id = $1 AND school_id = $2
          FOR UPDATE`,
        [teacher.id, classroom.school_id],
      );
      if (teacherMembership.rowCount !== 1
        || teacherMembership.rows[0].role !== 'lecturer'
        || teacherMembership.rows[0].status !== 'active') {
        throw new Error('The existing teacher does not have exactly one active membership in the target school.');
      }
      const teacherProfile = await client.query(
        `SELECT membership_id, school_id
           FROM teacher_profiles
          WHERE user_id = $1
          FOR UPDATE`,
        [teacher.id],
      );
      if (teacherProfile.rowCount !== 1
        || teacherProfile.rows[0].school_id !== classroom.school_id
        || teacherProfile.rows[0].membership_id !== teacherMembership.rows[0].id) {
        throw new Error('The existing teacher profile does not match the target school membership.');
      }

      const homeroom = await client.query(
        `SELECT teacher_user_id, subject
           FROM class_homeroom_assignments
          WHERE class_id = $1 AND school_id = $2 AND ended_at IS NULL
          FOR UPDATE`,
        [classroom.id, classroom.school_id],
      );
      if (homeroom.rowCount !== 1
        || homeroom.rows[0].teacher_user_id !== teacher.id
        || homeroom.rows[0].subject !== TEACHER_SUBJECT) {
        throw new Error('The existing homeroom/subject assignment no longer matches the confirmed teacher relationship.');
      }
      const subjectAssignment = await client.query(
        `SELECT id
           FROM teacher_class_assignments
          WHERE class_id = $1 AND school_id = $2 AND teacher_user_id = $3
            AND lower(trim(subject)) = lower(trim($4)) AND revoked_at IS NULL
          FOR UPDATE`,
        [classroom.id, classroom.school_id, teacher.id, TEACHER_SUBJECT],
      );
      if (subjectAssignment.rowCount !== 1) {
        throw new Error('The existing active teacher/subject link is missing or ambiguous.');
      }

      for (const student of roster) {
        const accountResult = await client.query(
          `SELECT id, full_name, role, status, must_change_password, profile_completed_at
             FROM users
            WHERE lower(email) = $1
            FOR UPDATE`,
          [student.email],
        );
        let account = accountResult.rows[0];
        if (account) {
          if (account.full_name !== student.fullName || account.role !== 'student' || account.status !== 'active') {
            throw new Error(`Existing account conflicts with roster entry ${student.email}; no data was changed.`);
          }
          const otherName = await client.query(
            `SELECT id
               FROM users
              WHERE lower(trim(full_name)) = lower(trim($1)) AND lower(email) <> lower($2)
              LIMIT 1
              FOR UPDATE`,
            [student.fullName, student.email],
          );
          if (otherName.rowCount) {
            throw new Error(`A different account already uses the roster name for ${student.email}; no data was changed.`);
          }
          summary.accountsReused += 1;
        } else {
          const pendingInvitation = await client.query(
            `SELECT id
               FROM account_invitations
              WHERE lower(email) = $1 AND consumed_at IS NULL AND closed_at IS NULL
              LIMIT 1
              FOR UPDATE`,
            [student.email],
          );
          if (pendingInvitation.rowCount) {
            throw new Error(`A pending invitation conflicts with ${student.email}; no data was changed.`);
          }
          const otherName = await client.query(
            `SELECT id
               FROM users
              WHERE lower(trim(full_name)) = lower(trim($1))
              LIMIT 1
              FOR UPDATE`,
            [student.fullName],
          );
          if (otherName.rowCount) {
            throw new Error(`A different account already uses the roster name for ${student.email}; no data was changed.`);
          }

          let password = generateTemporaryPassword();
          while (newCredentials.some((credential) => credential.password === password)) {
            password = generateTemporaryPassword();
          }
          const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
          const userId = randomUUID();
          const inserted = await client.query(
            `INSERT INTO users
              (id, email, full_name, password_hash, role, status, must_change_password, profile_completed_at)
             VALUES ($1, $2, $3, $4, 'student', 'active', true, now())
             RETURNING id, full_name, role, status, must_change_password, profile_completed_at`,
            [userId, student.email, student.fullName, passwordHash],
          );
          account = inserted.rows[0];
          newCredentials.push({ fullName: student.fullName, email: student.email, password });
          summary.accountsCreated += 1;
        }

        const memberships = await client.query(
          `SELECT id, school_id, role, status
             FROM school_memberships
            WHERE user_id = $1
            FOR UPDATE`,
          [account.id],
        );
        if (memberships.rows.some(({ role }) => role !== 'student')
          || memberships.rows.filter(({ status }) => status === 'active').length > 1) {
          throw new Error(`School membership conflict for ${student.email}; no data was changed.`);
        }
        let membership = memberships.rows.find(({ school_id: schoolId }) => schoolId === classroom.school_id);
        if (membership && (membership.role !== 'student' || membership.status !== 'active')) {
          throw new Error(`The target-school membership for ${student.email} is not active; no data was changed.`);
        }
        if (!membership) {
          const membershipId = randomUUID();
          await client.query(
            `INSERT INTO school_memberships (id, user_id, school_id, role, status)
             VALUES ($1, $2, $3, 'student', 'active')`,
            [membershipId, account.id, classroom.school_id],
          );
          membership = { id: membershipId, school_id: classroom.school_id, role: 'student', status: 'active' };
        }

        const profile = await client.query(
          `SELECT membership_id, school_id
             FROM student_profiles
            WHERE user_id = $1
            FOR UPDATE`,
          [account.id],
        );
        if (profile.rowCount > 1 || (profile.rowCount === 1
          && (profile.rows[0].membership_id !== membership.id || profile.rows[0].school_id !== classroom.school_id))) {
          throw new Error(`Student profile conflicts with the target school for ${student.email}; no data was changed.`);
        }
        if (!profile.rowCount) {
          await client.query(
            `INSERT INTO student_profiles (user_id, membership_id, school_id, grade)
             VALUES ($1, $2, $3, $4)`,
            [account.id, membership.id, classroom.school_id, classroom.grade],
          );
        }

        const classMembership = await client.query(
          `SELECT id, school_id
             FROM class_memberships
            WHERE class_id = $1 AND student_user_id = $2 AND status = 'active'
            FOR UPDATE`,
          [classroom.id, account.id],
        );
        if (classMembership.rowCount > 1
          || (classMembership.rowCount === 1 && classMembership.rows[0].school_id !== classroom.school_id)) {
          throw new Error(`Active class membership conflicts with the target school for ${student.email}; no data was changed.`);
        }
        if (!classMembership.rowCount) {
          await client.query(
            `INSERT INTO class_memberships
               (id, class_id, student_user_id, school_id, academic_year_id, status)
             VALUES ($1, $2, $3, $4, $5, 'active')`,
            [randomUUID(), classroom.id, account.id, classroom.school_id, classroom.academic_year_id],
          );
          summary.classLinksCreated += 1;
        }
      }

      if (newCredentials.length) {
        writePrivateCredentials(credentialsPath, newCredentials);
        credentialsWritten = true;
      }

      const teacherUpdate = await client.query(
        'UPDATE users SET email = $2, updated_at = now() WHERE id = $1',
        [teacher.id, TEACHER_EMAIL],
      );
      if (teacherUpdate.rowCount !== 1) {
        throw new Error('The confirmed teacher email could not be updated uniquely.');
      }

      const verification = await client.query(
        `SELECT count(*)::int AS linked_students
           FROM class_memberships cm
           JOIN users u ON u.id = cm.student_user_id
           JOIN student_profiles sp ON sp.user_id = u.id
           JOIN school_memberships sm
             ON sm.user_id = u.id AND sm.school_id = cm.school_id AND sm.status = 'active'
          WHERE cm.class_id = $1 AND cm.school_id = $2 AND cm.status = 'active'
            AND u.role = 'student' AND u.status = 'active'
            AND u.must_change_password = true AND u.profile_completed_at IS NOT NULL
            AND lower(u.email) = ANY($3::text[])`,
        [classroom.id, classroom.school_id, roster.map(({ email }) => email)],
      );
      if (verification.rows[0].linked_students !== roster.length) {
        throw new Error(`Pre-commit verification found ${verification.rows[0].linked_students} of ${roster.length} expected class links.`);
      }

      await client.query('COMMIT');

      return {
        classCode: CLASS_CODE,
        academicYear: ACADEMIC_YEAR,
        accountsCreated: summary.accountsCreated,
        accountsReused: summary.accountsReused,
        classLinksCreated: summary.classLinksCreated,
        linkedStudents: verification.rows[0].linked_students,
        teacherEmailUpdated: true,
        credentialsFile: newCredentials.length ? credentialsPath : null,
      };
    } catch (error) {
      let rollbackFailed = false;
      try {
        await client.query('ROLLBACK');
      } catch {
        rollbackFailed = true;
      }
      if (credentialsWritten) fs.rmSync(credentialsPath, { force: true });
      if (rollbackFailed) throw new Error('Seed failed and transaction rollback could not be confirmed.');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  assertEnabled();
  const [rosterPathArg, credentialsPathArg] = process.argv.slice(2);
  if (!rosterPathArg || !credentialsPathArg) {
    throw new Error('Usage: node scripts/seed-classroom-students.js <private-roster.json> <private-credentials.csv>');
  }
  const rosterPath = path.resolve(rosterPathArg);
  const credentialsPath = path.resolve(credentialsPathArg);
  const repoRoot = path.resolve(__dirname, '..', '..');
  const relativeOutput = path.relative(repoRoot, credentialsPath);
  if (!relativeOutput.startsWith('..') || path.isAbsolute(relativeOutput)) {
    throw new Error('Credential output must be outside the repository.');
  }
  if (fs.existsSync(credentialsPath)) {
    throw new Error('Credential output already exists; choose a new private file path.');
  }
  const roster = readRoster(rosterPath);
  const result = await provision(roster, credentialsPath);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(`Seed aborted: ${error.message}`);
  process.exitCode = 1;
});
