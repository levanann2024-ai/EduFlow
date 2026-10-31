import type { QuizQuestion } from '@/types';
import { listTeacherAssessments, saveTeacherAssessment } from '@/api/schoolApi';

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
  sections?: AssessmentSection[];
  status?: 'draft' | 'ready';
  structureSummary?: string[];
  sectionPoints?: Record<ExamQuestionType, number>;
  writtenSection?: string;
}

export type SavedAssignment = SavedExam;

export type ExamQuestionType = 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';

export interface AssessmentSection {
  id: string;
  title: string;
  description: string;
  questionIds: string[];
  questionType?: ExamQuestionType;
  questions?: ExamQuestion[];
}

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

const defaultSectionDetails: Record<ExamQuestionType, { title: string; description: string }> = {
  'multiple-choice': {
    title: 'Trắc nghiệm nhiều phương án',
    description: 'Thí sinh chọn một phương án đúng cho mỗi câu.',
  },
  'true-false': {
    title: 'Trắc nghiệm đúng / sai',
    description: 'Trong mỗi ý a), b), c), d), thí sinh chọn đúng hoặc sai.',
  },
  'short-answer': {
    title: 'Trắc nghiệm trả lời ngắn',
    description: 'Thí sinh ghi câu trả lời ngắn cho từng câu.',
  },
  essay: {
    title: 'Tự luận',
    description: 'Thí sinh trình bày lời giải và lập luận.',
  },
};

export function defaultAssessmentSections(questions: ExamQuestion[]): AssessmentSection[] {
  const types = (['multiple-choice', 'true-false', 'short-answer', 'essay'] as const)
    .filter((type) => questions.some((question) => question.type === type));
  const sectionTypes: ExamQuestionType[] = types.length > 0 ? [...types] : ['essay'];
  return sectionTypes.map((type, index) => ({
    id: `section-${type}`,
    title: `Phần ${['I', 'II', 'III', 'IV', 'V', 'VI'][index] ?? index + 1}: ${defaultSectionDetails[type].title}`,
    description: defaultSectionDetails[type].description,
    questionIds: questions.filter((question) => question.type === type).map((question) => question.id),
    questionType: type,
  }));
}

export function normalizeAssessmentSections(
  questions: ExamQuestion[],
  value: unknown,
): AssessmentSection[] {
  if (!Array.isArray(value) || value.length === 0) return defaultAssessmentSections(questions);
  const sections = value.flatMap((item): AssessmentSection[] => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    const questionIds = Array.isArray(raw.questionIds)
      ? raw.questionIds
      : Array.isArray(raw.questions)
        ? raw.questions.map((question) => question && typeof question === 'object'
          ? (question as Record<string, unknown>).id
          : undefined)
        : null;
    if (typeof raw.id !== 'string' || typeof raw.title !== 'string' || !questionIds) return [];
    return [{
      id: raw.id,
      title: raw.title,
      description: typeof raw.description === 'string' ? raw.description : '',
      questionIds: questionIds.filter((id): id is string => typeof id === 'string'),
      questionType: ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(String(raw.questionType))
        ? raw.questionType as ExamQuestionType
        : undefined,
    }];
  });
  if (sections.length !== value.length) return defaultAssessmentSections(questions);

  const knownQuestionIds = new Set(questions.map((question) => question.id));
  const assignedQuestionIds = new Set<string>();
  const normalized = sections.map((section) => ({
    ...section,
    questionIds: section.questionIds.filter((id) => {
      if (!knownQuestionIds.has(id) || assignedQuestionIds.has(id)) return false;
      assignedQuestionIds.add(id);
      return true;
    }),
  }));
  for (const section of normalized) {
    if (!section.questionType) {
      section.questionType = questions.find((question) => section.questionIds.includes(question.id))?.type
        ?? 'multiple-choice';
    }
  }
  const unassigned = questions.filter((question) => !assignedQuestionIds.has(question.id)).map((question) => question.id);
  if (unassigned.length > 0) normalized[0].questionIds.push(...unassigned);
  return normalized;
}

export const questionBankStorageKey = 'eduflow.teacher.question-bank';
export const savedExamsStorageKey = 'eduflow.teacher.saved-exams';
export const savedAssignmentsStorageKey = 'eduflow.teacher.saved-assignments';

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
    type: ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(String(raw.type))
      ? raw.type as QuizQuestion['type']
      : undefined,
    correctAnswer: typeof answer === 'string' ? answer : undefined,
    correctAnswers: Array.isArray(raw.correctAnswers) && raw.correctAnswers.every((item) => typeof item === 'boolean')
      ? raw.correctAnswers
      : undefined,
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

function readAssessments(storageKey: string, label: string): SavedExam[] {
  const stored = localStorage.getItem(storageKey);
  if (stored === null) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error(`Dữ liệu ${label} lưu trên trình duyệt không đúng định dạng.`);

  return parsed.map((item, examIndex): SavedExam => {
    if (!item || typeof item !== 'object') throw new Error(`Dữ liệu ${label} không đúng định dạng.`);
    const exam = item as Record<string, unknown>;
    if (!Array.isArray(exam.questions)) {
      throw new Error(`Dữ liệu ${label} không đúng định dạng.`);
    }

    const questions = exam.questions.map(normalizeExamQuestion);
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
      questions,
      sections: normalizeAssessmentSections(questions, exam.sections),
      status: exam.status === 'ready' ? 'ready' : 'draft',
      structureSummary: Array.isArray(exam.structureSummary) && exam.structureSummary.every((entry) => typeof entry === 'string')
        ? exam.structureSummary
        : undefined,
      sectionPoints: exam.sectionPoints && typeof exam.sectionPoints === 'object'
        ? exam.sectionPoints as Record<ExamQuestionType, number>
        : undefined,
      writtenSection: typeof exam.writtenSection === 'string' ? exam.writtenSection : undefined,
    };
  });
}

export function readSavedExams(): SavedExam[] {
  return readAssessments(savedExamsStorageKey, 'đề thi');
}

export function readSavedAssignments(): SavedAssignment[] {
  return readAssessments(savedAssignmentsStorageKey, 'bài tập');
}

export async function loadTeacherAssessments(kind: 'exam' | 'assignment'): Promise<SavedExam[]> {
  const storageKey = kind === 'exam' ? savedExamsStorageKey : savedAssignmentsStorageKey;
  const legacyAssessments = kind === 'exam' ? readSavedExams() : readSavedAssignments();
  const savedAssessments = await listTeacherAssessments<SavedExam>(kind);
  const savedIds = new Set(savedAssessments.map((assessment) => assessment.id));
  const migrated: SavedExam[] = [];

  for (const assessment of legacyAssessments) {
    if (savedIds.has(assessment.id)) continue;
    migrated.push(await saveTeacherAssessment(kind, assessment));
  }

  if (legacyAssessments.length > 0) localStorage.removeItem(storageKey);
  return [...migrated, ...savedAssessments];
}

export function writeQuestionSets(questionSets: QuestionSet[]): void {
  localStorage.setItem(questionBankStorageKey, JSON.stringify(questionSets));
}

export function writeSavedExams(exams: SavedExam[]): void {
  localStorage.setItem(savedExamsStorageKey, JSON.stringify(exams));
}

export function writeSavedAssignments(assignments: SavedAssignment[]): void {
  localStorage.setItem(savedAssignmentsStorageKey, JSON.stringify(assignments));
}
