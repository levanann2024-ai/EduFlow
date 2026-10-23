import type { QuizQuestion } from '@/types';

export interface QuestionSet {
  id: string;
  topic: string;
  subject: string;
  grade: string;
  createdAt: string;
  questions: QuizQuestion[];
}

export interface SavedExam {
  id: string;
  title: string;
  topic: string;
  subject: string;
  grade: string;
  createdAt: string;
  durationMinutes: number | null;
  questions: ExamQuestion[];
  status?: 'draft' | 'ready';
  structureSummary?: string[];
  writtenSection?: string;
}

export type ExamQuestionType = 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';

export interface ExamQuestion {
  id: string;
  type: ExamQuestionType;
  question: string;
  options: string[];
  correctIndex: number;
  correctAnswer: string;
  correctAnswers?: boolean[];
  explanation: string;
  difficulty: QuizQuestion['difficulty'];
  points: number;
}

export const questionBankStorageKey = 'eduflow.teacher.question-bank';
export const savedExamsStorageKey = 'eduflow.teacher.saved-exams';

function normalizeQuizQuestion(value: unknown, index: number): QuizQuestion {
  if (!value || typeof value !== 'object') throw new Error(`Câu hỏi ${index + 1} không đúng định dạng.`);
  const raw = value as Record<string, unknown>;
  const questionText = raw.question ?? raw.content ?? raw.text;
  const rawOptions = raw.options ?? raw.choices;
  const options = Array.isArray(rawOptions) ? rawOptions.map((option) => String(option ?? '')) : [];
  const answer = raw.correctAnswer ?? raw.answer;
  const answerIndex = typeof answer === 'string' ? options.findIndex((option) => option === answer) : -1;
  const correctIndex = typeof raw.correctIndex === 'number' && Number.isInteger(raw.correctIndex)
    ? Math.min(Math.max(raw.correctIndex, 0), Math.max(options.length - 1, 0))
    : answerIndex >= 0 ? answerIndex : 0;
  const difficulty = ['easy', 'medium', 'hard'].includes(String(raw.difficulty))
    ? raw.difficulty as QuizQuestion['difficulty']
    : 'medium';
  return {
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : `legacy-question-${index}`,
    question: typeof questionText === 'string' && questionText.trim() ? questionText : '[Câu hỏi cũ chưa có nội dung]',
    options,
    correctIndex,
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
    difficulty,
  };
}

function normalizeExamQuestion(value: unknown, index: number): ExamQuestion {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const normalized = normalizeQuizQuestion(value, index);
  const type = ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(String(raw.type))
    ? raw.type as ExamQuestionType
    : 'multiple-choice';
  return {
    ...raw,
    ...normalized,
    type,
    correctAnswer: typeof raw.correctAnswer === 'string'
      ? raw.correctAnswer
      : normalized.options[normalized.correctIndex] ?? '',
    correctAnswers: Array.isArray(raw.correctAnswers) && raw.correctAnswers.every((answer) => typeof answer === 'boolean')
      ? raw.correctAnswers
      : undefined,
    points: typeof raw.points === 'number' && Number.isFinite(raw.points) ? raw.points : 1,
  };
}

export function readQuestionSets(): QuestionSet[] {
  const stored = localStorage.getItem(questionBankStorageKey);
  if (stored === null) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error('Dữ liệu lưu trên trình duyệt không đúng định dạng.');
  return parsed.map((item, setIndex): QuestionSet => {
    if (!item || typeof item !== 'object') throw new Error(`Bộ câu hỏi ${setIndex + 1} không đúng định dạng.`);
    const set = item as Record<string, unknown>;
    if (!Array.isArray(set.questions)) {
      throw new Error(`Bộ câu hỏi ${setIndex + 1} không đúng định dạng.`);
    }
    return {
      ...set,
      id: typeof set.id === 'string' && set.id ? set.id : `legacy-set-${setIndex}`,
      topic: typeof set.topic === 'string' ? set.topic : 'Chủ đề chưa phân loại',
      subject: typeof set.subject === 'string' ? set.subject : 'Chưa phân loại',
      grade: typeof set.grade === 'string' ? set.grade : 'Chưa phân loại',
      createdAt: typeof set.createdAt === 'string' ? set.createdAt : 'Ngày chưa ghi nhận',
      questions: set.questions.map(normalizeQuizQuestion),
    };
  });
}

export function readSavedExams(): SavedExam[] {
  const stored = localStorage.getItem(savedExamsStorageKey);
  if (stored === null) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error('Dữ liệu lưu trên trình duyệt không đúng định dạng.');

  return parsed.map((item, examIndex): SavedExam => {
    if (!item || typeof item !== 'object') throw new Error('Dữ liệu đề thi không đúng định dạng.');
    const exam = item as Record<string, unknown>;
    if (!Array.isArray(exam.questions)) {
      throw new Error('Dữ liệu đề thi không đúng định dạng.');
    }

    return {
      ...exam,
      id: typeof exam.id === 'string' && exam.id ? exam.id : `legacy-exam-${examIndex}`,
      title: typeof exam.title === 'string' ? exam.title : typeof exam.topic === 'string' ? exam.topic : 'Đề chưa đặt tên',
      topic: typeof exam.topic === 'string' ? exam.topic : 'Chủ đề chưa phân loại',
      subject: typeof exam.subject === 'string' ? exam.subject : 'Chưa phân loại',
      grade: typeof exam.grade === 'string' ? exam.grade : 'Chưa phân loại',
      createdAt: typeof exam.createdAt === 'string' ? exam.createdAt : 'Ngày chưa ghi nhận',
      durationMinutes: typeof exam.durationMinutes === 'number' && Number.isFinite(exam.durationMinutes)
        ? exam.durationMinutes
        : null,
      questions: exam.questions.map(normalizeExamQuestion),
      status: exam.status === 'ready' ? 'ready' : 'draft',
      structureSummary: Array.isArray(exam.structureSummary) && exam.structureSummary.every((entry) => typeof entry === 'string')
        ? exam.structureSummary
        : undefined,
      writtenSection: typeof exam.writtenSection === 'string' ? exam.writtenSection : undefined,
    };
  });
}

export function writeQuestionSets(questionSets: QuestionSet[]): void {
  localStorage.setItem(questionBankStorageKey, JSON.stringify(questionSets));
}

export function writeSavedExams(exams: SavedExam[]): void {
  localStorage.setItem(savedExamsStorageKey, JSON.stringify(exams));
}
