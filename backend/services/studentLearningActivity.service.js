const { randomUUID } = require('node:crypto');

const ACTIVITY_TYPES = new Set([
  'resource_view',
  'assignment_submit',
  'exam_submit',
  'result_view',
  'ai_chat',
  'ai_practice',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function activityError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function createStudentLearningActivityService(poolProvider) {
  async function recordActivity(auth, activityType, eventKey = randomUUID()) {
    if (!auth?.userId) throw activityError(401, 'SCHOOL_UNAUTHORIZED', 'Đăng nhập để ghi nhận hoạt động học tập.');
    if (!ACTIVITY_TYPES.has(activityType) || typeof eventKey !== 'string' || !UUID_PATTERN.test(eventKey)) {
      throw activityError(400, 'SCHOOL_INVALID_ACTIVITY', 'Hoạt động học tập không hợp lệ.');
    }

    await poolProvider().query(
      `INSERT INTO student_learning_activity (user_id, event_key, activity_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, event_key) DO NOTHING`,
      [auth.userId, eventKey, activityType],
    );
    return { recorded: true };
  }

  async function getWeeklyActivity(auth) {
    if (!auth?.userId) throw activityError(401, 'SCHOOL_UNAUTHORIZED', 'Đăng nhập để xem hoạt động học tập.');
    const result = await poolProvider().query(
      `WITH week_days AS (
         SELECT generate_series(
           date_trunc('week', now() AT TIME ZONE 'Asia/Ho_Chi_Minh'),
           date_trunc('week', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') + interval '6 days',
           interval '1 day'
         )::date AS activity_date
       )
       SELECT to_char(days.activity_date, 'YYYY-MM-DD') AS activity_date,
              count(activity.id)::int AS activity_count
         FROM week_days days
         LEFT JOIN student_learning_activity activity
           ON activity.user_id = $1
          AND (activity.occurred_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = days.activity_date
        GROUP BY days.activity_date
        ORDER BY days.activity_date`,
      [auth.userId],
    );
    const days = result.rows.map((row) => ({
      date: row.activity_date,
      count: row.activity_count,
    }));
    return {
      days,
      activeDays: days.filter((day) => day.count > 0).length,
      activityCount: days.reduce((total, day) => total + day.count, 0),
    };
  }

  return { recordActivity, getWeeklyActivity };
}

module.exports = { createStudentLearningActivityService };
