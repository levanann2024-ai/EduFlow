const { getPool } = require('../db/pool');

const TYPES = {
  student: ['quiz', 'answer', 'resource', 'exam', 'assignment'],
  lecturer: ['question', 'exam', 'assignment', 'lesson'],
};
const MAX_ITEM_BYTES = 256 * 1024;
const MAX_BATCH_ITEMS = 100;

function invalid(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function allowedTypes(auth) {
  if (!auth || auth.isDemo || typeof auth.userId !== 'string' || !Object.hasOwn(TYPES, auth.role)) {
    throw invalid('Bạn không có quyền thực hiện thao tác này.', 403);
  }
  return TYPES[auth.role];
}

function validString(value, max, nonempty = false) {
  return typeof value === 'string' && value.length <= max
    && (!nonempty || Boolean(value.trim()))
    && !/[\u0000-\u001f\u007f]/.test(value)
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
}

function validateKey(auth, type, id) {
  if (!allowedTypes(auth).includes(type)) throw invalid('Loại mục đã lưu không hợp lệ.');
  if (!validString(id, 240, true)) throw invalid('ID mục đã lưu không hợp lệ.');
}

function validateJson(value, depth = 0) {
  if (depth > 32) throw invalid('Dữ liệu mục đã lưu quá sâu.');
  if (typeof value === 'string') {
    // PostgreSQL JSONB rejects NUL and unpaired UTF-16 surrogates.
    if (value.includes('\u0000') || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) {
      throw invalid('Dữ liệu mục đã lưu chứa ký tự không hợp lệ.');
    }
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw invalid('Dữ liệu mục đã lưu không hợp lệ.');
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      validateJson(key, depth + 1);
      validateJson(child, depth + 1);
    }
  } else if (value !== null && typeof value !== 'boolean') {
    throw invalid('Dữ liệu mục đã lưu không hợp lệ.');
  }
}

function validateTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, zone] = match;
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return Number(year) >= 100 && Number(month) >= 1 && Number(month) <= 12
    && Number(day) >= 1 && Number(day) <= days
    && Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59
    && (zone === 'Z' || (Number(zone.slice(1, 3)) <= 23 && Number(zone.slice(4, 6)) <= 59))
    && Number.isFinite(Date.parse(value))
    && new Date(value).getUTCFullYear() >= 1 && new Date(value).getUTCFullYear() <= 9999;
}

function validQuizQuestion(question) {
  return question !== null && typeof question === 'object' && !Array.isArray(question)
    && typeof question.id === 'string'
    && typeof question.question === 'string'
    && Array.isArray(question.options) && question.options.every((option) => typeof option === 'string')
    && Number.isInteger(question.correctIndex)
    && typeof question.explanation === 'string'
    && ['easy', 'medium', 'hard'].includes(question.difficulty)
    && (question.type === undefined || ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(question.type))
    && (question.correctAnswer === undefined || typeof question.correctAnswer === 'string')
    && (question.correctAnswers === undefined || (Array.isArray(question.correctAnswers)
      && question.correctAnswers.every((answer) => typeof answer === 'boolean')))
    && (question.points === undefined || (typeof question.points === 'number' && Number.isFinite(question.points)));
}

function validateTypePayload(auth, item) {
  const isString = (value) => typeof value === 'string';
  const required = {
    quiz: () => isString(item.topic) && typeof item.questionCount === 'number'
      && Number.isFinite(item.questionCount) && ['practice', 'test'].includes(item.mode)
      && Array.isArray(item.questions) && item.questions.every(validQuizQuestion),
    answer: () => isString(item.question) && isString(item.answer)
      && (item.conversationId === undefined || isString(item.conversationId)),
    resource: () => true,
    question: () => isString(item.setId) && validQuizQuestion(item.question),
    exam: () => auth.role === 'lecturer'
      ? isString(item.assessmentId)
      : validString(item.sessionId, 240, true) && item.sessionId === item.id
        && validString(item.classId, 240, true),
    assignment: () => auth.role === 'lecturer'
      ? isString(item.assessmentId)
      : validString(item.assignmentId, 240, true) && item.assignmentId === item.id,
    lesson: () => isString(item.content) && isString(item.grade),
  };
  if (!required[item.type]()) throw invalid(`Dữ liệu cho loại "${item.type}" không hợp lệ.`);
}

function validateItem(auth, item) {
  allowedTypes(auth);
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid('Mục đã lưu phải là một đối tượng.');
  validateKey(auth, item.type, item.id);
  if (!validString(item.title, 500, true) || !validString(item.subject, 256)
    || !validateTimestamp(item.savedAt)) {
    throw invalid('Tiêu đề, môn học hoặc thời gian lưu không hợp lệ.');
  }
  validateTypePayload(auth, item);
  validateJson(item);
  const json = JSON.stringify(item);
  if (Buffer.byteLength(json, 'utf8') > MAX_ITEM_BYTES) throw invalid('Mục đã lưu vượt quá 256 KiB.', 413);
  return { item, json };
}

async function listWithClient(client, auth) {
  const result = await client.query(
    `SELECT payload FROM saved_items
      WHERE user_id = $1 AND item_type = ANY($2::text[])
      ORDER BY saved_at DESC, item_type, item_id`,
    [auth.userId, allowedTypes(auth)],
  );
  return result.rows.map((row) => row.payload);
}

async function list(auth) {
  allowedTypes(auth);
  return listWithClient(getPool(), auth);
}

async function upsert(auth, type, id, body) {
  validateKey(auth, type, id);
  const { item, json } = validateItem(auth, body);
  if (item.type !== type || item.id !== id) throw invalid('ID và loại trong nội dung phải khớp với URL.');
  const result = await getPool().query(
    `INSERT INTO saved_items (user_id, item_type, item_id, saved_at, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (user_id, item_type, item_id)
     DO UPDATE SET saved_at = EXCLUDED.saved_at, payload = EXCLUDED.payload
     RETURNING payload`,
    [auth.userId, type, id, new Date(item.savedAt).toISOString(), json],
  );
  return result.rows[0].payload;
}

async function remove(auth, type, id) {
  validateKey(auth, type, id);
  const result = await getPool().query(
    'DELETE FROM saved_items WHERE user_id = $1 AND item_type = $2 AND item_id = $3',
    [auth.userId, type, id],
  );
  if (!result.rowCount) throw invalid('Không tìm thấy mục đã lưu.', 404);
}

async function importItems(auth, body) {
  allowedTypes(auth);
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.items)
    || Object.keys(body).length !== 1) {
    throw invalid('Nội dung nhập phải là đối tượng chứa danh sách items.');
  }
  if (body.items.length > MAX_BATCH_ITEMS) throw invalid('Danh sách nhập vượt quá 100 mục; không có mục nào được nhập.', 413);
  const items = body.items.map((item) => validateItem(auth, item));
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (const { item, json } of items) {
      await client.query(
        `INSERT INTO saved_items (user_id, item_type, item_id, saved_at, payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (user_id, item_type, item_id) DO NOTHING`,
        [auth.userId, item.type, item.id, new Date(item.savedAt).toISOString(), json],
      );
    }
    const result = await listWithClient(client, auth);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Preserve the original error. */ }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { list, upsert, remove, importItems };
