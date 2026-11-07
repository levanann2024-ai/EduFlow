const assert = require('node:assert/strict');
const { before, after, beforeEach, test } = require('node:test');
const express = require('express');
const database = require('../db/pool');

process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-32-bytes';
process.env.NODE_ENV = 'test';
const { signAccessToken, signDemoToken } = require('../auth/tokens');
let records;
let failInsert;
let commands;

const users = {
  studentA: { role: 'student', school_ids: ['school'] },
  studentB: { role: 'student', school_ids: ['school'] },
  teacher: { role: 'lecturer', school_ids: ['school'] },
  admin: { role: 'admin', school_ids: [] },
};

function key(user, type, id) { return JSON.stringify([user, type, id]); }
function dbQuery(map, sql, values = []) {
  commands.push(sql);
  if (sql.includes('FROM auth_sessions')) {
    const user = users[values[1]];
    return { rows: user && values[0] === `session-${values[1]}` ? [{
      ...user, id: values[1], admin_scope: 'system', must_change_password: false,
      profile_completed_at: new Date(),
    }] : [] };
  }
  if (sql.includes('INSERT INTO saved_items')) {
    if (values[2] === failInsert) throw new Error('injected database failure');
    const k = key(values[0], values[1], values[2]);
    if (sql.includes('DO NOTHING') && map.has(k)) return { rows: [], rowCount: 0 };
    const payload = JSON.parse(values[4]);
    map.set(k, { user: values[0], type: values[1], id: values[2], payload });
    return { rows: [{ payload }], rowCount: 1 };
  }
  if (sql.includes('SELECT payload FROM saved_items')) {
    const rows = [...map.values()].filter((row) => row.user === values[0] && values[1].includes(row.type))
      .sort((a, b) => Date.parse(b.payload.savedAt) - Date.parse(a.payload.savedAt)
        || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
    return { rows: rows.map(({ payload }) => ({ payload })) };
  }
  if (sql.includes('DELETE FROM saved_items')) {
    return { rowCount: map.delete(key(...values)) ? 1 : 0 };
  }
  throw new Error(`Unexpected SQL: ${sql}`);
}

database.getPool = () => ({
  query: async (sql, values) => dbQuery(records, sql, values),
  connect: async () => {
    let working;
    return {
      query: async (sql, values) => {
        if (sql === 'BEGIN') { commands.push(sql); working = new Map(records); return; }
        if (sql === 'COMMIT') { commands.push(sql); records = working; return; }
        if (sql === 'ROLLBACK') { commands.push(sql); return; }
        return dbQuery(working, sql, values);
      },
      release() { commands.push('RELEASE'); },
    };
  },
});
const router = require('./savedItems.routes');
let server;
let base;

before(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/saved-items', router);
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: status < 500 ? err.message : 'Internal server error.' });
  });
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  base = `http://127.0.0.1:${server.address().port}/api/saved-items`;
});
after(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => { records = new Map(); failInsert = null; commands = []; });

async function request(path = '', { user = 'studentA', method = 'GET', body, token, raw, contentType = 'application/json' } = {}) {
  const headers = {};
  if (user) headers.authorization = `Bearer ${token || signAccessToken(user, `session-${user}`)}`;
  if (body !== undefined || raw !== undefined) headers['content-type'] = contentType;
  const response = await fetch(`${base}${path}`, {
    method, headers, body: raw === undefined ? (body === undefined ? undefined : JSON.stringify(body)) : raw,
  });
  return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
}
const quizQuestion = {
  id: 'q1', question: 'private', options: ['a', 'b'], correctIndex: 0,
  explanation: '', difficulty: 'easy',
};
const typePayloads = {
  quiz: { topic: '', questionCount: 1, mode: 'practice', questions: [quizQuestion] },
  answer: { question: '', answer: '', conversationId: 'conversation' },
  resource: {},
  question: { setId: '', question: quizQuestion },
  exam: { assessmentId: '' },
  assignment: { assessmentId: '' },
  lesson: { content: '', grade: '' },
};
const item = (id = 'a', type = 'quiz') => ({
  id, type, title: 'Saved', subject: '', savedAt: '2026-01-02T03:04:05.000Z',
  ...typePayloads[type],
});

test('authenticated owners can upsert, list, and delete independently with encoded IDs', async () => {
  const id = 'a/b ?#%+đ';
  const path = `/quiz/${encodeURIComponent(id)}`;
  const saved = item(id);
  assert.deepEqual((await request(path, { method: 'PUT', body: saved })).body, { success: true, data: { item: saved } });
  const other = { ...saved, title: 'Other account' };
  await request(path, { user: 'studentB', method: 'PUT', body: other });
  const changed = { ...saved, title: 'Updated' };
  await request(path, { method: 'PUT', body: changed });
  const list = await request();
  assert.equal(list.cache, 'no-store');
  assert.deepEqual(list.body, { success: true, data: { items: [changed] } });
  assert.deepEqual((await request('', { user: 'studentB' })).body.data.items, [other]);
  await request('/quiz/only-a', { method: 'PUT', body: item('only-a') });
  assert.equal((await request('/quiz/only-a', { user: 'studentB', method: 'DELETE' })).status, 404);
  assert.deepEqual((await request()).body.data.items, [changed, item('only-a')]);
  assert.deepEqual((await request(path, { method: 'DELETE' })).body, { success: true });
  assert.equal((await request(path, { method: 'DELETE' })).status, 404);
  assert.deepEqual((await request('', { user: 'studentB' })).body.data.items, [other]);
  assert.equal((await request('/quiz/missing', { user: 'studentB', method: 'DELETE' })).status, 404);
});

test('auth, account roles, allowed types and JSON request validation are enforced', async () => {
  assert.equal((await request('', { user: null })).status, 401);
  assert.equal((await request('', { user: 'admin' })).status, 403);
  process.env.EDUFLOW_DEMO_MODE = 'true';
  assert.equal((await request('', { token: signDemoToken('student') })).status, 403);
  delete process.env.EDUFLOW_DEMO_MODE;
  assert.equal((await request('/exam/a', { method: 'PUT', body: item('a', 'exam') })).status, 400);
  assert.equal((await request('/quiz/a', { user: 'teacher', method: 'PUT', body: item() })).status, 400);
  assert.equal((await request('/question/a', { user: 'teacher', method: 'PUT', body: item('a', 'question') })).status, 200);
  for (const type of ['exam', 'assignment', 'lesson']) {
    assert.equal((await request(`/${type}/a`, { user: 'teacher', method: 'PUT', body: item('a', type) })).status, 200);
  }
  for (const type of ['answer', 'resource']) {
    assert.equal((await request(`/${type}/a`, { method: 'PUT', body: item('a', type) })).status, 200);
  }
  for (const type of ['exam', 'assignment']) {
    const saved = { ...item(`student-${type}`, type) };
    delete saved.assessmentId;
    if (type === 'exam') {
      saved.sessionId = saved.id;
      saved.classId = 'class-1';
    } else {
      saved.assignmentId = saved.id;
    }
    assert.equal((await request(`/${type}/${saved.id}`, { method: 'PUT', body: saved })).status, 200);
    const lecturerShape = item(`teacher-${type}`, type);
    assert.equal((await request(`/${type}/${lecturerShape.id}`, { method: 'PUT', body: lecturerShape })).status, 400);
    const mismatchedReference = { ...saved, id: `mismatch-${type}` };
    assert.equal((await request(`/${type}/${mismatchedReference.id}`, { method: 'PUT', body: mismatchedReference })).status, 400);
  }
  assert.equal((await request('/quiz/a', { method: 'PUT', body: item('b') })).status, 400);
  assert.equal((await request('/quiz/a', { method: 'PUT', raw: '{' })).status, 400);
  assert.equal((await request('/quiz/a', { method: 'PUT', raw: '{}', contentType: 'text/plain' })).status, 415);
  assert.equal((await request('/quiz/%ZZ', { method: 'DELETE' })).status, 400);
});

test('malformed, oversize, invalid timestamps and invalid structured data are rejected', async () => {
  for (const invalid of [
    { ...item(), id: '' }, { ...item(), type: 'bogus' }, { ...item(), title: '' },
    { ...item(), subject: 2 }, { ...item(), savedAt: '2026-02-30T00:00:00Z' },
    { ...item(), savedAt: 'not a date' }, { ...item(), content: '\u0000' },
    { ...item(), content: '\ud800' },
  ]) {
    assert.equal((await request('/import', { method: 'POST', body: { items: [invalid] } })).status, 400);
  }
  const tooMany = await request('/import', { method: 'POST', body: { items: Array(101).fill(item()) } });
  assert.equal(tooMany.status, 413);
  assert.match(tooMany.body.message, /100/);
  assert.equal((await request('/quiz/a', { method: 'PUT', body: { ...item(), text: 'a'.repeat(256 * 1024) } })).status, 413);
  const largeBatch = Array.from({ length: 5 }, (_, i) => ({ ...item(String(i)), text: 'a'.repeat(220 * 1024) }));
  const tooLarge = await request('/import', { method: 'POST', body: { items: largeBatch } });
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.body.success, false);
  assert.ok(tooLarge.body.message);
  assert.equal(records.size, 0);
});

test('each type rejects missing and invalid required fields on PUT and import without changing records', async () => {
  const invalidFields = {
    quiz: { topic: 1, questionCount: '1', mode: 'other', questions: {} },
    answer: { question: 1, answer: {}, conversationId: null },
    question: { setId: [], question: [] },
    exam: { assessmentId: null },
    assignment: { assessmentId: 1 },
    lesson: { content: null, grade: 1 },
  };
  for (const [type, fields] of Object.entries(invalidFields)) {
    const user = ['quiz', 'answer'].includes(type) ? 'studentA' : 'teacher';
    const valid = item('saved', type);
    assert.equal((await request(`/${type}/saved`, { user, method: 'PUT', body: valid })).status, 200);
    for (const [field, wrong] of Object.entries(fields)) {
      for (const badValue of field === 'conversationId' ? [wrong] : [undefined, wrong]) {
        const malformed = { ...valid, [field]: badValue };
        const put = await request(`/${type}/saved`, { user, method: 'PUT', body: malformed });
        assert.equal(put.status, 400, `${type}.${field} PUT`);
        assert.equal(put.body.success, false);
        const batch = await request('/import', {
          user, method: 'POST', body: { items: [item('new', type), malformed] },
        });
        assert.equal(batch.status, 400, `${type}.${field} import`);
      }
    }
    const list = (await request('', { user })).body.data.items.filter((saved) => saved.type === type);
    assert.deepEqual(list, [valid]);
  }
  const answerWithoutConversation = item('optional', 'answer');
  delete answerWithoutConversation.conversationId;
  assert.equal((await request('/answer/optional', { method: 'PUT', body: answerWithoutConversation })).status, 200);
  const testQuiz = { ...item('test'), mode: 'test' };
  assert.equal((await request('/quiz/test', { method: 'PUT', body: testQuiz })).status, 200);
});

test('quiz and lecturer question enforce QuizQuestion fields in PUT and atomic import', async () => {
  const invalidFields = {
    id: [undefined, 1],
    question: [undefined, null],
    options: [undefined, null, [1], ['ok', null]],
    correctIndex: [undefined, '0', 0.5, null],
    explanation: [undefined, false],
    difficulty: [undefined, 'extreme', null],
    type: ['bogus', null],
    correctAnswer: [null, 1],
    correctAnswers: [null, ['true'], [true, 0]],
    points: [null, '1'],
  };
  for (const [type, user] of [['quiz', 'studentA'], ['question', 'teacher']]) {
    const make = (id, question) => type === 'quiz'
      ? { ...item(id, type), questions: [quizQuestion, question] }
      : { ...item(id, type), question };
    const original = item('saved', type);
    assert.equal((await request(`/${type}/saved`, { user, method: 'PUT', body: original })).status, 200);
    const malformedQuestions = [null, [], 'invalid', { prompt: 'private' }];
    for (const [field, values] of Object.entries(invalidFields)) {
      for (const value of values) malformedQuestions.push({ ...quizQuestion, [field]: value });
    }
    for (const question of malformedQuestions) {
      const bad = make('saved', question);
      const put = await request(`/${type}/saved`, { user, method: 'PUT', body: bad });
      assert.equal(put.status, 400, `${type} PUT ${JSON.stringify(question)}`);
      assert.deepEqual(Object.keys(put.body).sort(), ['message', 'success']);
      assert.equal(put.body.success, false);
      assert.ok(put.body.message);
      const imported = await request('/import', {
        user, method: 'POST', body: { items: [item('new', type), bad] },
      });
      assert.equal(imported.status, 400, `${type} import ${JSON.stringify(question)}`);
    }
    assert.deepEqual((await request('', { user })).body.data.items.filter((saved) => saved.type === type), [original]);
    for (const questionType of ['multiple-choice', 'true-false', 'short-answer', 'essay']) {
      const question = {
        ...quizQuestion, type: questionType, correctIndex: -1,
        correctAnswer: '', correctAnswers: [true, false], points: 1.5,
      };
      const valid = make(questionType, question);
      assert.equal((await request(`/${type}/${questionType}`, { user, method: 'PUT', body: valid })).status, 200);
    }
  }
});

test('import is atomic, idempotent and preserves any existing record', async () => {
  const current = { ...item(), title: 'Current' };
  await request('/quiz/a', { method: 'PUT', body: current });
  const batch = [item(), item('b'), { ...item('b'), title: 'duplicate' }];
  const imported = await request('/import', { method: 'POST', body: { items: batch } });
  assert.equal(imported.status, 200);
  assert.deepEqual(imported.body.data.items, [current, item('b')]);
  assert.deepEqual((await request('/import', { method: 'POST', body: { items: batch } })).body, imported.body);
  const before = new Map(records);
  failInsert = 'fail';
  const failed = await request('/import', { method: 'POST', body: { items: [item('c'), item('fail')] } });
  assert.deepEqual(failed.body, { success: false, message: 'Internal server error.' });
  assert.equal(failed.status, 500);
  assert.deepEqual(records, before);
  assert.deepEqual(commands.slice(-2), ['ROLLBACK', 'RELEASE']);
  const bad = await request('/import', { method: 'POST', body: { items: [item('c'), { ...item('x'), savedAt: 'bad' }] } });
  assert.equal(bad.status, 400);
  assert.deepEqual(records, before);
});
