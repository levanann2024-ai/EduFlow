require('dotenv').config();

const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const SCHOOL_NAME_PATTERN = 'Trần Phú Hoàn Kiếm';
const ACADEMIC_YEAR = '2026-2027';
const CLASS_CODE = '11A2';
const TIMETABLE = {
  semester: 'Kỳ 1',
  session: 'morning',
  effectiveFrom: '2026-09-07',
  periodCount: 5,
  entries: [
    [1, 1, 'CHAOCO'],
    [1, 2, 'Hóa học'],
    [1, 3, 'Tin'],
    [1, 4, 'Toán'],
    [1, 5, 'Toán'],
    [2, 1, 'Hóa học'],
    [2, 2, 'Sinh học'],
    [2, 3, 'Ngoại ngữ'],
    [2, 4, 'Tin'],
    [3, 1, 'Văn học'],
    [3, 2, 'Văn học'],
    [3, 3, 'Vật lý'],
    [4, 1, 'Vật lý'],
    [4, 2, 'Sinh học'],
    [4, 3, 'Ngoại ngữ'],
    [4, 4, 'Ngoại ngữ'],
    [5, 1, 'Toán'],
    [5, 2, 'Lịch sử'],
    [5, 3, 'Văn học'],
    [5, 4, 'Toán'],
    [5, 5, 'Sinh hoạt'],
  ],
};

function normalizeSchoolName(value) {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/[^a-z0-9]/g, '');
}

function assertSeedIsExplicitlyEnabled() {
  if (process.env.EDUFLOW_ALLOW_TIMETABLE_SEED !== 'true') {
    throw new Error('Set EDUFLOW_ALLOW_TIMETABLE_SEED=true to seed the 11A2 timetable.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The 11A2 timetable seed cannot run in production.');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }
}

function areEntriesEqual(existingEntries, expectedEntries) {
  if (existingEntries.length !== expectedEntries.length) return false;
  const normalize = (entries) => entries
    .map((entry) => `${entry.weekday ?? entry[0]}:${entry.period_number ?? entry[1]}:${entry.subject ?? entry[2]}`)
    .sort();
  return normalize(existingEntries).every((entry, index) => entry === normalize(expectedEntries)[index]);
}

async function seedClassTimetable(client) {
  await client.query('BEGIN');
  try {
    const schemaResult = await client.query(
      `SELECT count(*)::int AS count
         FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = ANY($1::text[])`,
      [['class_timetables', 'class_timetable_entries']],
    );
    if (schemaResult.rows[0].count !== 2) {
      throw new Error('Run npm run migrate before seeding the 11A2 timetable.');
    }

    const activeSchools = await client.query(
      "SELECT id, name FROM schools WHERE status = 'active'",
    );
    const matchingSchools = activeSchools.rows.filter(({ name }) => {
      const normalized = normalizeSchoolName(name);
      return normalized.includes('tranphu') && normalized.includes('hoankiem');
    });
    if (matchingSchools.length !== 1) {
      throw new Error(`Expected exactly one active school matching ${SCHOOL_NAME_PATTERN}; found ${matchingSchools.length}.`);
    }
    const school = matchingSchools[0];

    const classResult = await client.query(
      `SELECT id
         FROM classes
        WHERE school_id = $1 AND code = $2 AND academic_year = $3 AND status = 'active'
        FOR UPDATE`,
      [school.id, CLASS_CODE, ACADEMIC_YEAR],
    );
    if (classResult.rowCount !== 1) {
      throw new Error(`Expected exactly one active ${CLASS_CODE} class for ${ACADEMIC_YEAR} at ${school.name}; found ${classResult.rowCount}.`);
    }
    const classId = classResult.rows[0].id;

    const timetableResult = await client.query(
      `SELECT id, session, to_char(effective_from, 'YYYY-MM-DD') AS effective_from, period_count
         FROM class_timetables
        WHERE class_id = $1 AND semester = $2
        FOR UPDATE`,
      [classId, TIMETABLE.semester],
    );

    let timetableId;
    if (timetableResult.rowCount) {
      const existing = timetableResult.rows[0];
      if (existing.session !== TIMETABLE.session
        || String(existing.effective_from).slice(0, 10) !== TIMETABLE.effectiveFrom
        || Number(existing.period_count) !== TIMETABLE.periodCount) {
        throw new Error('An existing 11A2 semester-1 timetable has different session/date/period count; no data was changed.');
      }
      timetableId = existing.id;
      const entriesResult = await client.query(
        `SELECT weekday, period_number, subject
           FROM class_timetable_entries
          WHERE timetable_id = $1`,
        [timetableId],
      );
      if (entriesResult.rowCount > 0 && !areEntriesEqual(entriesResult.rows, TIMETABLE.entries)) {
        throw new Error('An existing 11A2 semester-1 timetable has different entries; no data was changed.');
      }
      if (entriesResult.rowCount === TIMETABLE.entries.length) {
        await client.query('COMMIT');
        return { schoolName: school.name, inserted: false };
      }
    } else {
      timetableId = randomUUID();
      await client.query(
        `INSERT INTO class_timetables (id, class_id, school_id, semester, session, effective_from, period_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [timetableId, classId, school.id, TIMETABLE.semester, TIMETABLE.session, TIMETABLE.effectiveFrom, TIMETABLE.periodCount],
      );
    }

    for (const [weekday, period, subject] of TIMETABLE.entries) {
      await client.query(
        `INSERT INTO class_timetable_entries (id, timetable_id, weekday, period_number, subject)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), timetableId, weekday, period, subject],
      );
    }
    await client.query('COMMIT');
    return { schoolName: school.name, inserted: true };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      console.error('Timetable seed rollback could not be confirmed.');
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
    const result = await seedClassTimetable(client);
    console.log(`${result.inserted ? 'Seeded' : 'Verified'} 11A2 semester-1 timetable for ${result.schoolName} (${ACADEMIC_YEAR}).`);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Could not seed 11A2 timetable:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  ACADEMIC_YEAR,
  CLASS_CODE,
  TIMETABLE,
  areEntriesEqual,
  assertSeedIsExplicitlyEnabled,
  seedClassTimetable,
};
