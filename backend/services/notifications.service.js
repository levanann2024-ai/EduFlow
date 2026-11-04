function notificationError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.code = 'SCHOOL_INVALID_NOTIFICATION';
  return error;
}

function validateNotificationIds(notificationIds) {
  if (
    !Array.isArray(notificationIds)
    || notificationIds.length > 100
    || notificationIds.some((id) => typeof id !== 'string' || id.length < 1 || id.length > 240)
  ) {
    throw notificationError(400, 'Danh sách thông báo không hợp lệ.');
  }
  return [...new Set(notificationIds)];
}

function createNotificationsService(poolProvider) {
  async function getReadNotificationIds(auth, notificationIds) {
    const ids = validateNotificationIds(notificationIds);
    if (auth?.isDemo) return [];
    if (!auth?.userId) throw notificationError(401, 'Đăng nhập để xem thông báo.');
    if (ids.length === 0) return [];

    const result = await poolProvider().query(
      `SELECT notification_id
         FROM user_notification_reads
        WHERE user_id = $1 AND notification_id = ANY($2::text[])`,
      [auth.userId, ids],
    );
    return result.rows.map((row) => row.notification_id);
  }

  async function markNotificationsRead(auth, notificationIds) {
    const ids = validateNotificationIds(notificationIds);
    if (auth?.isDemo) return [];
    if (!auth?.userId) throw notificationError(401, 'Đăng nhập để cập nhật thông báo.');
    if (ids.length === 0) return [];

    await poolProvider().query(
      `INSERT INTO user_notification_reads (user_id, notification_id)
       SELECT $1, notification_id
         FROM unnest($2::text[]) AS ids(notification_id)
       ON CONFLICT (user_id, notification_id) DO NOTHING`,
      [auth.userId, ids],
    );
    return ids;
  }

  return { getReadNotificationIds, markNotificationsRead };
}

module.exports = { createNotificationsService };
