const { randomUUID } = require('node:crypto');
const { getPool } = require('../db/pool');

const ROLES = new Set(['student', 'lecturer', 'admin']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function historyError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function assertRole(auth) {
  if (!auth || !ROLES.has(auth.role) || typeof auth.userId !== 'string') {
    throw historyError(403, 'AI_CHAT_ROLE_FORBIDDEN', 'Tài khoản không được phép lưu lịch sử trò chuyện.');
  }
}

function validateConversationId(value) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw historyError(400, 'AI_CHAT_INVALID_CONVERSATION', 'Cuộc trò chuyện không hợp lệ.');
  }
  return value;
}

function validateContent(value, maximum = 40000) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw historyError(400, 'AI_CHAT_INVALID_MESSAGE', `Tin nhắn phải có nội dung và không vượt quá ${maximum} ký tự.`);
  }
  return value.trim();
}

function validateImageAttachment(file) {
  const content = Buffer.isBuffer(file?.buffer) ? file.buffer : file?.content;
  const mimeType = file?.mimetype ?? file?.mimeType;
  const fileName = file?.originalname ?? file?.fileName;
  if (!Buffer.isBuffer(content) || content.length === 0 || content.length > MAX_IMAGE_BYTES
    || !IMAGE_TYPES.has(mimeType)
    || typeof fileName !== 'string' || !fileName.trim() || fileName.length > 255
    || /[\\/\u0000-\u001f\u007f]/.test(fileName)) {
    throw historyError(400, 'AI_CHAT_INVALID_IMAGE', 'Ảnh phải là JPEG, PNG hoặc WebP và không vượt quá 5 MB.');
  }
  const validSignature = mimeType === 'image/jpeg'
    ? content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
    : mimeType === 'image/png'
      ? content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : content.subarray(0, 4).toString('ascii') === 'RIFF'
        && content.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!validSignature) {
    throw historyError(400, 'AI_CHAT_INVALID_IMAGE', 'Nội dung ảnh không khớp với định dạng tệp.');
  }
  return { content, mimeType, fileName: fileName.trim() };
}

function mapMessage(row) {
  return {
    id: row.id,
    role: row.sender_role,
    content: row.content,
    subject: row.subject,
    createdAt: row.created_at.toISOString(),
    hasImage: Boolean(row.has_image),
    imageMimeType: row.image_mime_type,
    imageName: row.image_name,
  };
}

async function listConversations(auth) {
  assertRole(auth);
  const result = await getPool().query(
    `SELECT c.id, c.title, c.subject, c.created_at, c.updated_at,
            latest.content AS last_message
       FROM ai_chat_conversations c
       LEFT JOIN LATERAL (
         SELECT content
           FROM ai_chat_messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC, id DESC
          LIMIT 1
       ) latest ON true
      WHERE c.user_id = $1 AND c.user_role = $2
      ORDER BY c.updated_at DESC, c.id DESC`,
    [auth.userId, auth.role],
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    subject: row.subject,
    lastMessage: row.last_message ?? '',
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
}

async function getConversation(auth, conversationId) {
  assertRole(auth);
  const id = validateConversationId(conversationId);
  const conversationResult = await getPool().query(
    `SELECT id, title, subject, created_at, updated_at
       FROM ai_chat_conversations
      WHERE id = $1 AND user_id = $2 AND user_role = $3`,
    [id, auth.userId, auth.role],
  );
  const conversation = conversationResult.rows[0];
  if (!conversation) {
    throw historyError(404, 'AI_CHAT_CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện trong tài khoản này.');
  }
  const messagesResult = await getPool().query(
    `SELECT id, sender_role, content, subject, created_at,
            image_content IS NOT NULL AS has_image, image_mime_type, image_name
       FROM ai_chat_messages
      WHERE conversation_id = $1
      ORDER BY created_at, id`,
    [id],
  );
  return {
    id: conversation.id,
    title: conversation.title,
    subject: conversation.subject,
    createdAt: conversation.created_at.toISOString(),
    updatedAt: conversation.updated_at.toISOString(),
    messages: messagesResult.rows.map(mapMessage),
  };
}

async function getConversationImage(auth, conversationId, messageId) {
  assertRole(auth);
  const id = validateConversationId(conversationId);
  const message = validateConversationId(messageId);
  const result = await getPool().query(
    `SELECT m.image_content, m.image_mime_type, m.image_name
       FROM ai_chat_messages m
       JOIN ai_chat_conversations c ON c.id = m.conversation_id
      WHERE c.id = $1 AND c.user_id = $2 AND c.user_role = $3
        AND m.id = $4 AND m.sender_role = 'user' AND m.image_content IS NOT NULL`,
    [id, auth.userId, auth.role, message],
  );
  const row = result.rows[0];
  if (!row) {
    throw historyError(404, 'AI_CHAT_IMAGE_NOT_FOUND', 'Không tìm thấy ảnh trong cuộc trò chuyện này.');
  }
  return {
    content: row.image_content,
    mimeType: row.image_mime_type,
    fileName: row.image_name,
  };
}

async function deleteConversation(auth, conversationId) {
  assertRole(auth);
  const id = validateConversationId(conversationId);
  const result = await getPool().query(
    `DELETE FROM ai_chat_conversations
      WHERE id = $1 AND user_id = $2 AND user_role = $3`,
    [id, auth.userId, auth.role],
  );
  if (result.rowCount === 0) {
    throw historyError(404, 'AI_CHAT_CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện trong tài khoản này.');
  }
  return { deleted: true };
}

async function saveConversationTurn(auth, { conversationId, message, reply, subject = '', image = null }) {
  assertRole(auth);
  const userMessage = validateContent(message, 12000);
  const assistantMessage = validateContent(reply);
  const conversationSubject = typeof subject === 'string' ? subject.trim().slice(0, 120) : '';
  const imageAttachment = image ? validateImageAttachment(image) : null;
  const id = conversationId === null || conversationId === undefined
    ? randomUUID()
    : validateConversationId(conversationId);
  const userMessageId = randomUUID();
  const assistantMessageId = randomUUID();
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    let existing;
    if (conversationId) {
      const result = await client.query(
        `SELECT id, title
           FROM ai_chat_conversations
          WHERE id = $1 AND user_id = $2 AND user_role = $3
          FOR UPDATE`,
        [id, auth.userId, auth.role],
      );
      existing = result.rows[0];
      if (!existing) {
        throw historyError(404, 'AI_CHAT_CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện trong tài khoản này.');
      }
    } else {
      const title = userMessage.replace(/\s+/g, ' ').slice(0, 120) || 'Cuộc trò chuyện mới';
      await client.query(
        `INSERT INTO ai_chat_conversations (id, user_id, user_role, title, subject)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, auth.userId, auth.role, title, conversationSubject],
      );
    }

    await client.query(
      `INSERT INTO ai_chat_messages
         (id, conversation_id, sender_role, content, subject, image_content, image_mime_type, image_name)
       VALUES ($1, $2, 'user', $3, '', $4, $5, $6)`,
      [
        userMessageId,
        id,
        userMessage,
        imageAttachment?.content ?? null,
        imageAttachment?.mimeType ?? null,
        imageAttachment?.fileName ?? null,
      ],
    );
    await client.query(
      `INSERT INTO ai_chat_messages (id, conversation_id, sender_role, content, subject)
       VALUES ($1, $2, 'assistant', $3, $4)`,
      [assistantMessageId, id, assistantMessage, conversationSubject],
    );
    await client.query(
      `UPDATE ai_chat_conversations
          SET subject = CASE WHEN $2 = '' THEN subject ELSE $2 END,
              updated_at = now()
        WHERE id = $1`,
      [id, conversationSubject],
    );
    await client.query('COMMIT');
    return { conversationId: id, userMessageId, assistantMessageId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function validateLegacyConversation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.id !== 'string' || !value.id || value.id.length > 160
    || typeof value.subject !== 'string' || typeof value.title !== 'string'
    || value.title.trim().length === 0
    || !Array.isArray(value.messages) || value.messages.length > 500) {
    throw historyError(400, 'AI_CHAT_INVALID_LEGACY_HISTORY', 'Lịch sử chat cũ không đúng định dạng.');
  }
  return {
    legacyId: value.id,
    title: value.title.trim().slice(0, 120),
    subject: value.subject.trim().slice(0, 120),
    messages: value.messages.map((message) => {
      if (!message || typeof message !== 'object'
        || !['user', 'assistant'].includes(message.role)) {
        throw historyError(400, 'AI_CHAT_INVALID_LEGACY_HISTORY', 'Tin nhắn trong lịch sử chat cũ không đúng định dạng.');
      }
      return {
        role: message.role,
        content: validateContent(message.content),
        subject: typeof message.subject === 'string' ? message.subject.trim().slice(0, 120) : '',
      };
    }),
  };
}

async function importLegacyConversations(auth, input) {
  assertRole(auth);
  if (auth.role !== 'student') {
    throw historyError(403, 'AI_CHAT_ROLE_FORBIDDEN', 'Chỉ có thể chuyển lịch sử chat cũ của học sinh.');
  }
  if (!Array.isArray(input) || input.length > 200) {
    throw historyError(400, 'AI_CHAT_INVALID_LEGACY_HISTORY', 'Danh sách lịch sử chat cũ không đúng định dạng.');
  }
  const conversations = input.map(validateLegacyConversation);
  const messageCount = conversations.reduce((total, item) => total + item.messages.length, 0);
  if (messageCount > 5000) {
    throw historyError(413, 'AI_CHAT_LEGACY_HISTORY_TOO_LARGE', 'Lịch sử chat cũ vượt quá giới hạn chuyển đổi.');
  }

  const client = await getPool().connect();
  let imported = 0;
  try {
    await client.query('BEGIN');
    for (const conversation of conversations) {
      const id = randomUUID();
      const created = await client.query(
        `INSERT INTO ai_chat_conversations
           (id, user_id, user_role, legacy_id, title, subject)
         VALUES ($1, $2, 'student', $3, $4, $5)
         ON CONFLICT (user_id, user_role, legacy_id) WHERE legacy_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [id, auth.userId, conversation.legacyId, conversation.title, conversation.subject],
      );
      if (!created.rows[0]) continue;
      imported += 1;
      for (const message of conversation.messages) {
        await client.query(
          `INSERT INTO ai_chat_messages (id, conversation_id, sender_role, content, subject)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), id, message.role, message.content, message.subject],
        );
      }
    }
    await client.query('COMMIT');
    return { imported };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  deleteConversation,
  getConversation,
  getConversationImage,
  importLegacyConversations,
  listConversations,
  saveConversationTurn,
  validateImageAttachment,
};
