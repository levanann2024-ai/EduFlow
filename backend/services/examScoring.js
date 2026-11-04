const TRUE_FALSE_POINTS_BY_CORRECT_COUNT = [0, 0.1, 0.25, 0.5, 1];

function questionType(question) {
  return ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(question.type)
    ? question.type
    : 'multiple-choice';
}

function questionId(question, index) {
  return typeof question.id === 'string' && question.id ? question.id : `question-${index + 1}`;
}

function normalizeAnswer(value) {
  return value
    .normalize('NFKC')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$1')
    .replace(/\$+/g, '')
    .replace(/\\(?:left|right)\b/g, '')
    .replace(/\\dfrac/g, '\\frac')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, '')
    .toLocaleLowerCase('vi');
}

function numericAnswer(value) {
  const normalized = normalizeAnswer(value).replace(',', '.');
  if (/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }
  const fraction = normalized.match(/^([+-]?\d+(?:\.\d+)?)\/([+-]?\d+(?:\.\d+)?)$/);
  if (!fraction) return null;
  const denominator = Number(fraction[2]);
  if (denominator === 0) return null;
  const number = Number(fraction[1]) / denominator;
  return Number.isFinite(number) ? number : null;
}

function answersMatch(studentAnswer, acceptedAnswers) {
  const student = normalizeAnswer(studentAnswer);
  const accepted = acceptedAnswers.split('||').map(normalizeAnswer).filter(Boolean);
  if (accepted.includes(student)) return true;
  const studentNumber = numericAnswer(studentAnswer);
  if (studentNumber === null) return false;
  return accepted.some((answer) => {
    const expectedNumber = numericAnswer(answer);
    return expectedNumber !== null && Math.abs(studentNumber - expectedNumber) < 1e-9;
  });
}

function automaticQuestionScore(question, index, answers) {
  const type = questionType(question);
  const key = questionId(question, index);
  const answer = answers[String(index + 1)] ?? '';
  if (!Number.isFinite(question.points) || question.points <= 0) {
    throw new Error(`Điểm tối đa câu ${index + 1} không hợp lệ.`);
  }

  if (type === 'essay') return null;
  if (type === 'multiple-choice') {
    const correctIndex = Number.isInteger(question.correctIndex)
      ? question.correctIndex
      : question.options?.indexOf(question.correctAnswer);
    if (!Array.isArray(question.options) || question.options.length < 2
      || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= question.options.length) {
      throw new Error(`Câu trắc nghiệm ${index + 1} thiếu đáp án đúng hợp lệ.`);
    }
    return { questionId: key, score: answer !== '' && Number(answer) === correctIndex ? question.points : 0 };
  }
  if (type === 'true-false') {
    if (!Array.isArray(question.options) || question.options.length !== 4
      || !Array.isArray(question.correctAnswers) || question.correctAnswers.length !== 4
      || !question.correctAnswers.every((item) => typeof item === 'boolean')) {
      throw new Error(`Câu đúng/sai ${index + 1} cần 4 nhận định và 4 đáp án đúng/sai.`);
    }
    let submittedAnswers = {};
    if (answer) {
      try {
        const parsed = JSON.parse(answer);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) submittedAnswers = parsed;
      } catch {
        submittedAnswers = {};
      }
    }
    const correctCount = question.correctAnswers.reduce((count, expected, statementIndex) => (
      submittedAnswers[String(statementIndex)] === (expected ? 'Đúng' : 'Sai') ? count + 1 : count
    ), 0);
    const score = question.points * TRUE_FALSE_POINTS_BY_CORRECT_COUNT[correctCount];
    return { questionId: key, score: Math.round(score * 100) / 100 };
  }
  if (typeof question.correctAnswer !== 'string' || !question.correctAnswer.trim()) {
    throw new Error(`Câu trả lời ngắn ${index + 1} thiếu đáp án để tự chấm.`);
  }
  return {
    questionId: key,
    score: answer && answersMatch(answer, question.correctAnswer) ? question.points : 0,
  };
}

function automaticExamScores(questions, answers) {
  if (!Array.isArray(questions) || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error('Dữ liệu đề thi hoặc bài làm không hợp lệ.');
  }
  return Object.fromEntries(questions.flatMap((question, index) => {
    const result = automaticQuestionScore(question, index, answers);
    return result ? [[result.questionId, result.score]] : [];
  }));
}

function normalizeAutomaticScores(questionScores, questions, answers) {
  const automaticScores = automaticExamScores(questions, answers);
  for (const [questionKey, score] of Object.entries(automaticScores)) {
    if (questionScores[questionKey] !== score) {
      throw new Error('Điểm câu trắc nghiệm, đúng/sai và trả lời ngắn phải theo kết quả tự chấm.');
    }
  }
  return automaticScores;
}

module.exports = {
  automaticExamScores,
  automaticQuestionScore,
  normalizeAutomaticScores,
  questionId,
  questionType,
};
