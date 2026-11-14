const test = require('node:test');
const assert = require('node:assert/strict');
const { formatStudentAnswer, generateQuestions } = require('./ai.controller');

async function requestQuestions(body, { auth, dependencies } = {}) {
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
  await generateQuestions({ body: { topic: 'Ôn tập', ...body }, auth }, response, dependencies);
  return response;
}

async function requestFormatAnswer(body) {
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
  await formatStudentAnswer({ body }, response);
  return response;
}

test('answer formatting rejects empty input', async () => {
  const response = await requestFormatAnswer({ text: '  ' });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});

test('answer formatting rejects oversized input', async () => {
  const response = await requestFormatAnswer({ text: 'x'.repeat(12001) });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
});

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

test('student question generation uses the enrolled database grade instead of the request grade', async () => {
  const auth = { userId: 'student-1', role: 'student' };
  let prompt = '';
  const response = await requestQuestions({
    topic: 'Luyện tập lớp 12',
    quantity: 1,
    grade: '12',
  }, {
    auth,
    dependencies: {
      listClasses: async (receivedAuth) => {
        assert.equal(receivedAuth, auth);
        return [{ name: 'Lớp 10A1', grade: '10' }];
      },
      generateJsonRequest: async (request) => {
        prompt = request.prompt;
        return [{
          id: 'q1',
          type: 'multiple-choice',
          question: 'Câu hỏi',
          options: ['A', 'B', 'C', 'D'],
          correctIndex: 0,
          explanation: 'Giải thích',
          difficulty: 'medium',
        }];
      },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.match(prompt, /Khối lớp xác thực từ CSDL EduFlow: 10/);
  assert.match(prompt, /bỏ qua khối đó/);
  assert.match(prompt, /không tạo câu hỏi đòi hỏi học sinh biết kiến thức vượt cấp/);
});

test('student question generation stops when no enrolled grade exists', async () => {
  let generated = false;
  const response = await requestQuestions({ quantity: 1, grade: '11' }, {
    auth: { userId: 'student-1', role: 'student' },
    dependencies: {
      listClasses: async () => [],
      generateJsonRequest: async () => {
        generated = true;
        return [];
      },
    },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.success, false);
  assert.equal(generated, false);
});
