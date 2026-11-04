const assert = require('node:assert/strict');
const { test } = require('node:test');
const { automaticExamScores, normalizeAutomaticScores } = require('./examScoring');

test('automatically scores multiple choice and accepted numeric short-answer equivalents', () => {
  const questions = [
    { id: 'choice', type: 'multiple-choice', options: ['A', 'B', 'C', 'D'], correctIndex: 2, points: 2 },
    { id: 'short', type: 'short-answer', correctAnswer: '0.5 || 1/2', points: 1 },
  ];
  assert.deepEqual(automaticExamScores(questions, { 1: '2', 2: '\\frac{1}{2}' }), {
    choice: 2,
    short: 1,
  });
  assert.deepEqual(automaticExamScores(questions, { 1: '1', 2: '0.25' }), {
    choice: 0,
    short: 0,
  });
});

test('true-false automatic score uses partial-credit rubric scaled by question points', () => {
  const question = {
    id: 'tf',
    type: 'true-false',
    options: ['a', 'b', 'c', 'd'],
    correctAnswers: [true, false, true, false],
    points: 2,
  };
  assert.equal(automaticExamScores([question], { 1: JSON.stringify({ 0: 'Đúng' }) }).tf, 0.2);
  assert.equal(automaticExamScores([question], { 1: JSON.stringify({ 0: 'Đúng', 1: 'Sai' }) }).tf, 0.5);
  assert.equal(automaticExamScores([question], { 1: JSON.stringify({ 0: 'Đúng', 1: 'Sai', 2: 'Đúng' }) }).tf, 1);
  assert.equal(automaticExamScores([question], { 1: JSON.stringify({ 0: 'Đúng', 1: 'Sai', 2: 'Đúng', 3: 'Sai' }) }).tf, 2);
});

test('essays are left to the teacher and objective scores cannot be overridden', () => {
  const questions = [
    { id: 'choice', type: 'multiple-choice', options: ['A', 'B', 'C', 'D'], correctIndex: 0, points: 1 },
    { id: 'essay', type: 'essay', correctAnswer: 'Rubric', points: 3 },
  ];
  assert.deepEqual(automaticExamScores(questions, { 1: '0', 2: 'Bài làm' }), { choice: 1 });
  assert.deepEqual(normalizeAutomaticScores({ choice: 1, essay: 2 }, questions, { 1: '0', 2: 'Bài làm' }), {
    choice: 1,
  });
  assert.throws(
    () => normalizeAutomaticScores({ choice: 0, essay: 2 }, questions, { 1: '0', 2: 'Bài làm' }),
    /phải theo kết quả tự chấm/,
  );
});
