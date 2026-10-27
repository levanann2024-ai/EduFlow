const test = require('node:test');
const assert = require('node:assert/strict');
const { generateQuestions } = require('./ai.controller');

async function requestQuestions(body) {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  await generateQuestions({ body: { topic: 'Ôn tập', ...body } }, response);
  return response;
}

test('question generation rejects quantities outside the supported range', async () => {
  const response = await requestQuestions({ quantity: 51 });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});

test('question generation rejects unsupported question formats', async () => {
  const response = await requestQuestions({ quantity: 5, questionFormat: 'matching' });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});

test('question generation rejects a structure with a mismatched question count', async () => {
  const response = await requestQuestions({
    quantity: 5,
    questionStructure: [{ type: 'true-false', count: 4 }],
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});
