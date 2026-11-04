require('dotenv').config();

const argon2 = require('argon2');
const { randomBytes, randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const SCHOOL_NAME_PATTERN = 'Trần Phú Hoàn Kiếm';
const ACADEMIC_YEAR = '2026-2027';
const CLASS_CODE = '11A2';
const teachers = [
  { name: 'Cô Lan', subject: 'Vật lý', gender: 'female', email: 'lan.ly.11a2@seed.eduflow.invalid' },
  { name: 'Cô Phượng', subject: 'Tin học', gender: 'female', email: 'phuong.tin.11a2@seed.eduflow.invalid' },
  { name: 'Cô Huế', subject: 'Sinh học', gender: 'female', email: 'hue.sinh.11a2@seed.eduflow.invalid' },
  { name: 'Cô Thủy', subject: 'Lịch sử', gender: 'female', email: 'thuy.su.11a2@seed.eduflow.invalid' },
  { name: 'Cô Linh', subject: 'Tiếng Anh', gender: 'female', email: 'linh.anh.11a2@seed.eduflow.invalid' },
  { name: 'Cô Nhung', subject: 'Toán học', gender: 'female', email: 'nhung.toan.11a2@seed.eduflow.invalid' },
  { name: 'Cô Huyền', subject: 'Ngữ văn', gender: 'female', email: 'huyen.van.11a2@seed.eduflow.invalid' },
];

function normalizeSchoolName(value) {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/[^a-z0-9]/g, '');
}

function assertSeedIsExplicitlyEnabled() {
  if (process.env.EDUFLOW_ALLOW_PLACEHOLDER_TEACHER_SEED !== 'true') {
    throw new Error('Set EDUFLOW_ALLOW_PLACEHOLDER_TEACHER_SEED=true to seed non-login placeholder accounts.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Placeholder teacher accounts cannot be seeded in production.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }
}

async function findTarget(client) {
  const activeSchools = await client.query(
    "SELECT id, name FROM schools WHERE status = 'active'",
  );
  const matchingSchools = activeSchools.rows.filter(({ name }) => {
    const normalizedName = normalizeSchoolName(name);
    return normalizedName.includes('tranphu') && normalizedName.includes('hoankiem');
  });
  if (matchingSchools.length !== 1) {
    throw new Error(`Expected exactly one active school matching ${SCHOOL_NAME_PATTERN}; found ${matchingSchools.length}.`);
  }

  const school = matchingSchools[0];
  const classResult = await client.query(
    `SELECT id, school_id
       FROM classes
      WHERE school_id = $1 AND code = $2 AND academic_year = $3 AND status = 'active'`,
    [school.id, CLASS_CODE, ACADEMIC_YEAR],
  );
  if (classResult.rowCount !== 1) {
    throw new Error(`Expected exactly one active ${CLASS_CODE} class for ${ACADEMIC_YEAR} at ${school.name}; found ${classResult.rowCount}.`);
  }

  const classroom = classResult.rows[0];
  const homeroomResult = await client.query(
    `SELECT hra.teacher_user_id, hra.assigned_by, u.full_name, u.role
       FROM class_homeroom_assignments hra
       JOIN users u ON u.id = hra.teacher_user_id
      WHERE hra.class_id = $1 AND hra.school_id = $2
      FOR UPDATE OF hra`,
    [classroom.id, school.id],
  );
  if (homeroomResult.rowCount !== 1 || homeroomResult.rows[0].role !== 'lecturer'
    || !homeroomResult.rows[0].full_name.toLocaleLowerCase('vi').includes('đức')) {
    throw new Error('The existing 11A2 homeroom assignment was not found or does not identify teacher Đức; no homeroom assignment was changed.');
  }

  return { school, classroom, homeroom: homeroomResult.rows[0] };
}

async function ensureTeacher(client, teacher, schoolId) {
  const normalizedEmail = teacher.email.toLowerCase();
  let userResult = await client.query(
    'SELECT id, full_name, role, status FROM users WHERE lower(email) = $1 FOR UPDATE',
    [normalizedEmail],
  );
  let user;

  if (userResult.rowCount) {
    user = userResult.rows[0];
    if (user.full_name !== teacher.name || user.role !== 'lecturer') {
      throw new Error(`Placeholder email ${teacher.email} is already used by a different account.`);
    }
    if (user.status !== 'disabled') {
      throw new Error(`Placeholder account ${teacher.email} is not disabled; refusing to alter an existing active account.`);
    }
  } else {
    const userId = randomUUID();
    const randomUnusablePassword = randomBytes(32).toString('hex');
    const passwordHash = await argon2.hash(randomUnusablePassword, { type: argon2.argon2id });
    const inserted = await client.query(
      `INSERT INTO users (id, email, full_name, password_hash, role, status, must_change_password, profile_completed_at)
       VALUES ($1, $2, $3, $4, 'lecturer', 'disabled', true, now())
       RETURNING id, full_name, role, status`,
      [userId, normalizedEmail, teacher.name, passwordHash],
    );
    user = inserted.rows[0];
  }

  const membershipResult = await client.query(
    `SELECT id, role, status
       FROM school_memberships
      WHERE user_id = $1 AND school_id = $2
      FOR UPDATE`,
    [user.id, schoolId],
  );
  let membershipId;
  if (membershipResult.rowCount) {
    if (membershipResult.rows[0].status !== 'active' || membershipResult.rows[0].role !== 'lecturer') {
      throw new Error(`Placeholder teacher ${teacher.name} has an inactive or invalid school membership.`);
    }
    membershipId = membershipResult.rows[0].id;
  } else {
    membershipId = randomUUID();
    await client.query(
      `INSERT INTO school_memberships (id, user_id, school_id, role, status)
       VALUES ($1, $2, $3, 'lecturer', 'active')`,
      [membershipId, user.id, schoolId],
    );
  }

  const profileResult = await client.query(
    `SELECT school_id
       FROM teacher_profiles
      WHERE user_id = $1
      FOR UPDATE`,
    [user.id],
  );
  if (profileResult.rowCount && profileResult.rows[0].school_id !== schoolId) {
    throw new Error(`Placeholder teacher ${teacher.name} already has a profile in another school.`);
  }
  if (!profileResult.rowCount) {
    await client.query(
      `INSERT INTO teacher_profiles (user_id, membership_id, school_id, gender)
       VALUES ($1, $2, $3, $4)`,
      [user.id, membershipId, schoolId, teacher.gender],
    );
  } else {
    await client.query(
      'UPDATE teacher_profiles SET gender = $2 WHERE user_id = $1',
      [user.id, teacher.gender],
    );
  }

  return user.id;
}

async function seedClassTeachers(client) {
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('eduflow-placeholder-11a2-teachers'))");
    const { school, classroom, homeroom } = await findTarget(client);
    await client.query(
      `UPDATE teacher_profiles SET gender = 'male' WHERE user_id = $1 AND school_id = $2`,
      [homeroom.teacher_user_id, school.id],
    );

    const classSubjects = await client.query(
      'SELECT subject FROM class_subjects WHERE class_id = $1 AND school_id = $2',
      [classroom.id, school.id],
    );
    for (const teacher of teachers) {
      const subject = classSubjects.rows.find(
        (row) => row.subject.trim().toLocaleLowerCase('vi') === teacher.subject.toLocaleLowerCase('vi'),
      )?.subject ?? teacher.subject;
      if (!classSubjects.rows.some((row) => row.subject === subject)) {
        await client.query(
          'INSERT INTO class_subjects (class_id, school_id, subject) VALUES ($1, $2, $3)',
          [classroom.id, school.id, subject],
        );
        classSubjects.rows.push({ subject });
      }

      const teacherId = await ensureTeacher(client, teacher, school.id);
      const existingAssignment = await client.query(
        `SELECT id
           FROM teacher_class_assignments
          WHERE class_id = $1 AND teacher_user_id = $2
            AND lower(trim(subject)) = lower(trim($3)) AND revoked_at IS NULL`,
        [classroom.id, teacherId, subject],
      );
      if (existingAssignment.rowCount) continue;
      await client.query(
        `INSERT INTO teacher_class_assignments (id, class_id, teacher_user_id, school_id, subject, assigned_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), classroom.id, teacherId, school.id, subject, homeroom.assigned_by],
      );
    }

    const chemistrySubject = classSubjects.rows.find(
      (row) => row.subject.trim().toLocaleLowerCase('vi') === 'hóa học',
    )?.subject ?? 'Hóa học';
    if (!classSubjects.rows.some((row) => row.subject === chemistrySubject)) {
      await client.query(
        'INSERT INTO class_subjects (class_id, school_id, subject) VALUES ($1, $2, $3)',
        [classroom.id, school.id, chemistrySubject],
      );
    }
    const chemistryAssignment = await client.query(
      `SELECT id
         FROM teacher_class_assignments
        WHERE class_id = $1 AND teacher_user_id = $2
          AND lower(trim(subject)) = lower(trim($3)) AND revoked_at IS NULL`,
      [classroom.id, homeroom.teacher_user_id, chemistrySubject],
    );
    if (!chemistryAssignment.rowCount) {
      await client.query(
        `INSERT INTO teacher_class_assignments (id, class_id, teacher_user_id, school_id, subject, assigned_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), classroom.id, homeroom.teacher_user_id, school.id, chemistrySubject, homeroom.assigned_by],
      );
    }
    await client.query('COMMIT');
    return { schoolName: school.name, teacherCount: teachers.length + 1 };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      console.error('Teacher seed rollback could not be confirmed.');
    }
    throw error;
  }
}

async function main() {
  assertSeedIsExplicitlyEnabled();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  let client;
  try {
    client = await pool.connect();
    const schema = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'teacher_profiles'
            AND column_name = 'gender'
       ) AS has_gender`,
    );
    if (!schema.rows[0].has_gender) {
      throw new Error('Run npm run migrate before seeding teacher placeholders.');
    }
    const result = await seedClassTeachers(client);
    console.log(`Seeded 11A2 subject-teacher placeholders for ${result.schoolName} (${ACADEMIC_YEAR}). Accounts are disabled and cannot sign in.`);
  } catch (error) {
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Could not seed 11A2 subject teachers:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { assertSeedIsExplicitlyEnabled, seedClassTeachers };
