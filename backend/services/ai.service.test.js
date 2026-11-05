const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getSystemInstruction, getTeacherHonorific } = require('./ai.service');

test('student AI instructions consistently use toi-ban address', () => {
  for (const type of ['student-chat', 'student-progress', 'student-schedule']) {
    const instruction = getSystemInstruction(type);
    assert.match(instruction, /xưng "tôi"/);
    assert.match(instruction, /gọi học sinh là "bạn"/);
    assert.doesNotMatch(instruction, /xưng hô với học sinh là "em"/);
  }
});

test('teacher honorific follows the authenticated account gender', () => {
  assert.equal(getTeacherHonorific('male'), 'thầy');
  assert.equal(getTeacherHonorific('female'), 'cô');
  assert.equal(getTeacherHonorific('other'), 'thầy/cô');
  assert.equal(getTeacherHonorific('unspecified'), 'thầy/cô');

  for (const [gender, honorific] of [['male', 'thầy'], ['female', 'cô']]) {
    for (const type of ['teacher-chat', 'teacher-progress-analysis', 'teacher-schedule']) {
      const instruction = getSystemInstruction(type, gender);
      assert.match(instruction, new RegExp(`gọi (?:người dùng|giáo viên) là "${honorific}"`));
      assert.match(instruction, /xưng "tôi"/);
    }
  }
});
