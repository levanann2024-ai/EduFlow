const assert = require('node:assert/strict');
const { test } = require('node:test');
const database = require('../db/pool');

let pool;
database.getPool = () => pool;
delete require.cache[require.resolve('./aiChatHistory.service')];
const aiChatHistory = require('./aiChatHistory.service');

test('conversation reads are scoped to the authenticated user and role', async () => {
  const queries = [];
  pool = {
    query: async (sql, values) => {
      queries.push({ sql, values });
      return { rows: [] };
    },
  };

  await assert.rejects(
    aiChatHistory.getConversation(
      { userId: 'student-1', role: 'student' },
      'b5bd9f17-c82a-48a5-bcdf-1e4d7e1fb291',
    ),
    { statusCode: 404, code: 'AI_CHAT_CONVERSATION_NOT_FOUND' },
  );
  assert.deepEqual(queries[0].values, [
    'b5bd9f17-c82a-48a5-bcdf-1e4d7e1fb291',
    'student-1',
    'student',
  ]);
});

test('legacy history import is idempotent and only stores messages once', async () => {
  const importedLegacyIds = new Set();
  const savedMessages = [];
  const client = {
    query: async (sql, values = []) => {
      if (sql.includes('INSERT INTO ai_chat_conversations')) {
        const legacyId = values[2];
        if (importedLegacyIds.has(legacyId)) return { rows: [] };
        importedLegacyIds.add(legacyId);
        return { rows: [{ id: values[0] }] };
      }
      if (sql.includes('INSERT INTO ai_chat_messages')) savedMessages.push(values);
      return { rows: [] };
    },
    release() {},
  };
  pool = { connect: async () => client };
  const conversations = [{
    id: 'legacy-chat-1',
    title: 'Ôn tập Toán',
    subject: 'Toán',
    messages: [
      { role: 'user', content: 'Giải phương trình' },
      { role: 'assistant', content: 'Ta chuyển vế rồi giải.' },
    ],
  }];
  const auth = { userId: 'student-1', role: 'student' };

  assert.deepEqual(await aiChatHistory.importLegacyConversations(auth, conversations), { imported: 1 });
  assert.deepEqual(await aiChatHistory.importLegacyConversations(auth, conversations), { imported: 0 });
  assert.equal(savedMessages.length, 2);
});

test('legacy history import rejects non-student sessions before database access', async () => {
  pool = {
    connect: async () => {
      throw new Error('Database should not be accessed.');
    },
  };

  await assert.rejects(
    aiChatHistory.importLegacyConversations({ userId: 'teacher-1', role: 'lecturer' }, []),
    { statusCode: 403, code: 'AI_CHAT_ROLE_FORBIDDEN' },
  );
});

test('image attachments validate the format and reject spoofed content', () => {
  const image = {
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    mimetype: 'image/jpeg',
    originalname: 'bai-tap.jpg',
  };
  assert.deepEqual(aiChatHistory.validateImageAttachment(image), {
    content: image.buffer,
    mimeType: 'image/jpeg',
    fileName: 'bai-tap.jpg',
  });
  assert.throws(
    () => aiChatHistory.validateImageAttachment({ ...image, mimetype: 'image/png' }),
    { statusCode: 400, code: 'AI_CHAT_INVALID_IMAGE' },
  );
  assert.throws(
    () => aiChatHistory.validateImageAttachment({ ...image, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }),
    { statusCode: 400, code: 'AI_CHAT_INVALID_IMAGE' },
  );
});

test('saved chat images are retrieved only through their owner-scoped conversation', async () => {
  const queries = [];
  const imageContent = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  pool = {
    query: async (sql, values) => {
      queries.push({ sql, values });
      return { rows: [{ image_content: imageContent, image_mime_type: 'image/jpeg', image_name: 'bai-tap.jpg' }] };
    },
  };
  const auth = { userId: 'student-1', role: 'student' };

  assert.deepEqual(
    await aiChatHistory.getConversationImage(
      auth,
      'b5bd9f17-c82a-48a5-bcdf-1e4d7e1fb291',
      'ee202469-92eb-49cb-8a72-0b2f1577f7cd',
    ),
    { content: imageContent, mimeType: 'image/jpeg', fileName: 'bai-tap.jpg' },
  );
  assert.deepEqual(queries[0].values, [
    'b5bd9f17-c82a-48a5-bcdf-1e4d7e1fb291',
    'student-1',
    'student',
    'ee202469-92eb-49cb-8a72-0b2f1577f7cd',
  ]);
});

test('a chat image is stored with its user message in the same transaction', async () => {
  const statements = [];
  const client = {
    query: async (sql, values = []) => {
      statements.push({ sql, values });
      return { rows: [] };
    },
    release() {},
  };
  pool = { connect: async () => client };
  const image = {
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    mimetype: 'image/png',
    originalname: 'question.png',
  };

  const saved = await aiChatHistory.saveConversationTurn(
    { userId: 'student-1', role: 'student' },
    { message: 'Giải giúp mình câu trong ảnh', reply: 'Mình sẽ phân tích từng bước.', image },
  );
  const userInsert = statements.find(({ sql }) => sql.includes('INSERT INTO ai_chat_messages'));
  assert.ok(saved.conversationId);
  assert.ok(saved.userMessageId);
  assert.equal(userInsert.values[2], 'Giải giúp mình câu trong ảnh');
  assert.deepEqual(userInsert.values.slice(3), [image.buffer, 'image/png', 'question.png']);
  assert.equal(statements[0].sql, 'BEGIN');
  assert.equal(statements.at(-1).sql, 'COMMIT');
});
