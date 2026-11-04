require('dotenv').config();

const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const ACADEMIC_YEAR = '2026-2027';
const SEMESTER = 'Kỳ 1';
const SUBJECT = 'Hóa học';
const CLASS_CODES = ['11A2', '11A5', '12A1'];
const DRAFT_ENTRIES = [
  [1, 1, '11A5'],
  [1, 2, '11A2'],
  [1, 3, '12A1'],
  [2, 1, '11A2'],
  [2, 2, '11A5'],
  [2, 3, '12A1'],
  [3, 1, '11A5'],
  [3, 2, '12A1'],
  [4, 1, '11A5'],
  [4, 2, '12A1'],
  [5, 1, '11A5'],
  [5, 2, '12A1'],
];

function normalizeText(value) {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

function currentWeekStart() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const date = new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
  const utcDay = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((utcDay + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function assertSeedIsExplicitlyEnabled() {
  if (process.env.EDUFLOW_ALLOW_TEACHER_TIMETABLE_SEED !== 'true') {
    throw new Error('Set EDUFLOW_ALLOW_TEACHER_TIMETABLE_SEED=true to seed the teacher timetable draft.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The teacher timetable seed cannot run in production.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }
}

async function seedTeacherTimetable(client) {
  const weekStart = currentWeekStart();
  await client.query('BEGIN');
  try {
    const schema = await client.query(
      `SELECT count(*)::int AS count
         FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = ANY($1::text[])`,
      [['teacher_weekly_timetables', 'teacher_weekly_timetable_entries']],
    );
    if (schema.rows[0].count !== 2) {
      throw new Error('Run npm run migrate before seeding the teacher timetable.');
    }

    const schoolResult = await client.query(
      `SELECT id, name FROM schools
        WHERE status = 'active'
        ORDER BY name`,
    );
    const schools = schoolResult.rows.filter((school) => {
      const name = normalizeText(school.name);
      return name.includes('tranphu') && name.includes('hoankiem');
    });
    if (schools.length !== 1) {
      throw new Error(`Expected exactly one active Trần Phú Hoàn Kiếm school; found ${schools.length}.`);
    }
    const schoolId = schools[0].id;

    const teacherResult = await client.query(
      `SELECT hra.teacher_user_id, u.full_name
         FROM classes c
         JOIN class_homeroom_assignments hra ON hra.class_id = c.id
         JOIN users u ON u.id = hra.teacher_user_id AND u.role = 'lecturer' AND u.status = 'active'
        WHERE c.school_id = $1 AND c.code = '11A2'
          AND c.academic_year = $2 AND c.status = 'active'`,
      [schoolId, ACADEMIC_YEAR],
    );
    const teachers = teacherResult.rows.filter((teacher) => normalizeText(teacher.full_name).includes('duc'));
    if (teachers.length !== 1) {
      throw new Error(`Expected exactly one Đức homeroom teacher for 11A2; found ${teachers.length}.`);
    }
    const teacher = teachers[0];

    const classResult = await client.query(
      `SELECT c.id, c.code
         FROM classes c
         JOIN teacher_class_assignments tca
           ON tca.class_id = c.id AND tca.school_id = c.school_id
          AND tca.teacher_user_id = $1 AND tca.revoked_at IS NULL
          AND lower(trim(tca.subject)) = lower(trim($2))
        WHERE c.school_id = $3 AND c.academic_year = $4
          AND c.status = 'active' AND c.code = ANY($5::text[])`,
      [teacher.teacher_user_id, SUBJECT, schoolId, ACADEMIC_YEAR, CLASS_CODES],
    );
    const classes = new Map(classResult.rows.map((item) => [item.code, item.id]));
    if (CLASS_CODES.some((code) => !classes.has(code))) {
      throw new Error(`The teacher must be assigned ${SUBJECT} in ${CLASS_CODES.join(', ')} for ${ACADEMIC_YEAR}.`);
    }

    const classSchedule = await client.query(
      `SELECT ct.id
         FROM class_timetables ct
         JOIN classes c ON c.id = ct.class_id
        WHERE c.school_id = $1 AND c.code = '11A2' AND c.academic_year = $2
          AND ct.semester = $3 AND ct.session = 'morning'`,
      [schoolId, ACADEMIC_YEAR, SEMESTER],
    );
    if (classSchedule.rowCount !== 1) {
      throw new Error('Expected the real 11A2 morning timetable for Kỳ 1 to exist before seeding the teacher draft.');
    }
    const scheduleVerification = await client.query(
      `SELECT weekday, period_number, subject
         FROM class_timetable_entries
        WHERE timetable_id = $1 AND ((weekday = 1 AND period_number = 2) OR (weekday = 2 AND period_number = 1))`,
      [classSchedule.rows[0].id],
    );
    if (scheduleVerification.rowCount !== 2
      || scheduleVerification.rows.some((entry) => entry.subject !== SUBJECT)) {
      throw new Error('The 11A2 teacher draft does not match the confirmed Hóa học slots.');
    }

    const existing = await client.query(
      `SELECT id, academic_year, semester, status, is_estimated
         FROM teacher_weekly_timetables
        WHERE teacher_user_id = $1 AND school_id = $2 AND week_start = $3::date
        FOR UPDATE`,
      [teacher.teacher_user_id, schoolId, weekStart],
    );
    if (existing.rowCount) {
      if (existing.rows[0].is_estimated) {
        await client.query('COMMIT');
        return { status: 'verified', weekStart };
      }
      throw new Error('A teacher-edited timetable already exists for this week; refusing to overwrite it.');
    }

    const timetableId = randomUUID();
    await client.query(
      `INSERT INTO teacher_weekly_timetables
         (id, teacher_user_id, school_id, academic_year, semester, week_start,
          session, period_count, status, is_estimated)
       VALUES ($1, $2, $3, $4, $5, $6::date, 'morning', 5, 'draft', true)`,
      [timetableId, teacher.teacher_user_id, schoolId, ACADEMIC_YEAR, SEMESTER, weekStart],
    );
    for (const [weekday, period, classCode] of DRAFT_ENTRIES) {
      await client.query(
        `INSERT INTO teacher_weekly_timetable_entries
           (id, timetable_id, weekday, period_number, class_id, subject, entry_type)
         VALUES ($1, $2, $3, $4, $5, $6, 'lesson')`,
        [randomUUID(), timetableId, weekday, period, classes.get(classCode), SUBJECT],
      );
    }
    await client.query('COMMIT');
    return { status: 'seeded', weekStart };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  assertSeedIsExplicitlyEnabled();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const result = await seedTeacherTimetable(client);
    console.log(`Teacher timetable ${result.status} for ${result.weekStart}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  ACADEMIC_YEAR,
  CLASS_CODES,
  DRAFT_ENTRIES,
  SEMESTER,
  SUBJECT,
  assertSeedIsExplicitlyEnabled,
  currentWeekStart,
  seedTeacherTimetable,
};
