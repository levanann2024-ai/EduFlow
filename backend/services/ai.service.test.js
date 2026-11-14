const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  extractGroundingSources,
  generateGroundedJson,
  getSystemInstruction,
  getTeacherHonorific,
} = require('./ai.service');

test('grounding sources include unique secure web URLs only', () => {
  assert.deepEqual(extractGroundingSources([
    { web: { title: 'Official text', uri: 'https://example.edu/text' } },
    { web: { title: 'Duplicate', uri: 'https://example.edu/text' } },
    { web: { title: 'Insecure', uri: 'http://example.edu/text' } },
    { web: { title: 'Invalid', uri: 'not a url' } },
    { retrievedContext: { title: 'Not a web citation', uri: 'https://example.edu/context' } },
  ]), [
    { title: 'Official text', url: 'https://example.edu/text' },
  ]);
});

test('grounded question generation enables Google Search and returns source citations', async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = global.fetch;
  process.env.GEMINI_API_KEY = 'test-key';
  let requestOptions;
  global.fetch = async (_url, options) => {
    requestOptions = options;
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: '[{"question":"Grounded question"}]' }] },
          groundingMetadata: {
            webSearchQueries: ['authoritative source'],
            groundingChunks: [{ web: { title: 'Source', uri: 'https://example.edu/source' } }],
          },
        }],
      }),
    };
  };
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    global.fetch = previousFetch;
  });

  const result = await generateGroundedJson({
    type: 'questions',
    prompt: 'Create a question from verified sources.',
    schema: 'questions',
  });
  assert.deepEqual(result.data, [{ question: 'Grounded question' }]);
  assert.deepEqual(result.sources, [{ title: 'Source', url: 'https://example.edu/source' }]);
  assert.deepEqual(result.searchQueries, ['authoritative source']);
  assert.deepEqual(JSON.parse(requestOptions.body).tools, [{ google_search: {} }]);
  assert.equal(requestOptions.headers['x-goog-api-key'], 'test-key');

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: { parts: [{ text: '[]' }] },
        groundingMetadata: { groundingChunks: [] },
      }],
    }),
  });
  await assert.rejects(
    generateGroundedJson({ type: 'questions', prompt: 'No source', schema: 'questions' }),
    /Không tìm thấy nguồn web có thể xác minh/,
  );
});

test('student AI instructions consistently use toi-ban address', () => {
  for (const type of ['student-chat', 'student-progress', 'student-schedule']) {
    const instruction = getSystemInstruction(type);
    assert.match(instruction, /xưng "tôi"/);
    assert.match(instruction, /gọi học sinh là "bạn"/);
    assert.doesNotMatch(instruction, /xưng hô với học sinh là "em"/);
    if (type === 'student-chat') {
      assert.match(instruction, /Không mở đầu bằng lời chào/);
      assert.match(instruction, /chỉ ở chế độ Tư duy mới dẫn dắt/);
      assert.match(instruction, /khối đã xác minh từ lớp đang học trong CSDL EduFlow/);
      assert.match(instruction, /không mặc định học sinh đã biết/);
    }
  }
});

test('AI question generation instructions stay within the provided grade curriculum', () => {
  const instruction = getSystemInstruction('questions');
  assert.match(instruction, /bám sát chương trình phổ thông đến khối đó/);
  assert.match(instruction, /không tạo câu hỏi cần kiến thức vượt cấp/);
});

test('student schedule instructions do not ask the model to report missing data', () => {
  const instruction = getSystemInstruction('student-schedule');
  assert.match(instruction, /không tạo mục báo thiếu dữ liệu/);
  assert.match(instruction, /không tạo hoạt động trong quá khứ/);
  assert.match(instruction, /các môn ghi trong tổ hợp/);
  assert.match(instruction, /mức trần thời gian tự học mỗi ngày/);
  assert.match(instruction, /Deadline ngoài trường ưu tiên cao còn trong 14 ngày/);
  assert.match(instruction, /deadlinePreparation/);
  assert.match(instruction, /1-2 giờ mỗi ngày/);
  assert.doesNotMatch(instruction, /Lịch cố định là khung bị chiếm/);
  assert.match(instruction, /không phải hoạt động cần chép lại vào timeline/);
  assert.match(instruction, /adjustments/);
  assert.doesNotMatch(instruction, /gồm overview, lifeBalanceTip, dataNotes/);
});

test('teacher honorific follows the authenticated account gender', () => {
  assert.equal(getTeacherHonorific('male'), 'thầy');
  assert.equal(getTeacherHonorific('female'), 'cô');
  assert.equal(getTeacherHonorific('other'), null);
  assert.equal(getTeacherHonorific('unspecified'), null);

  for (const [gender, honorific] of [['male', 'thầy'], ['female', 'cô']]) {
    for (const type of ['teacher-chat', 'teacher-progress-analysis', 'teacher-schedule']) {
      const instruction = getSystemInstruction(type, gender);
      assert.match(instruction, new RegExp(`gọi (?:người dùng|giáo viên) là "${honorific}"`));
      assert.match(instruction, /xưng "tôi"/);
      if (type === 'teacher-chat') {
        assert.match(instruction, /Không mở đầu bằng lời chào/);
      }
    }
  }
  for (const type of ['teacher-chat', 'teacher-progress-analysis', 'teacher-schedule']) {
    const instruction = getSystemInstruction(type, 'unspecified');
    assert.doesNotMatch(instruction, /thầy\/cô/);
    assert.match(instruction, /không dùng đại từ hoặc danh xưng/);
  }
});
