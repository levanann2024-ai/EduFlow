import type { QuizQuestion } from '@/types';

const STORAGE_KEY = 'eduflow.student.saved-items';

export interface SavedQuiz {
  id: string;
  type: 'quiz';
  title: string;
  subject: string;
  topic: string;
  questionCount: number;
  mode: 'practice' | 'test';
  savedAt: string;
  questions: QuizQuestion[];
}

export interface SavedAnswer {
  id: string;
  type: 'answer';
  title: string;
  subject: string;
  question: string;
  answer: string;
  savedAt: string;
}

export interface SavedResource {
  id: string;
  type: 'resource';
  title: string;
  subject: string;
  savedAt: string;
}

export type SavedItem = SavedQuiz | SavedAnswer | SavedResource;

export function getSavedItems(): SavedItem[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) {
    throw new Error('Kho lưu trữ bị lỗi định dạng. Hãy xóa dữ liệu trang web và thử lại.');
  }

  return parsed.filter(isSavedItem);
}

export function saveItem(item: SavedItem) {
  const items = getSavedItems().filter((savedItem) => savedItem.id !== item.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...items]));
}

export function removeSavedItem(id: string) {
  const items = getSavedItems().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function isSavedItem(value: unknown): value is SavedItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== 'string'
    || typeof item.title !== 'string'
    || typeof item.subject !== 'string'
    || typeof item.savedAt !== 'string'
  ) return false;

  if (item.type === 'answer') {
    return typeof item.question === 'string' && typeof item.answer === 'string';
  }

  if (item.type === 'resource') return true;

  return item.type === 'quiz'
      && typeof item.topic === 'string'
      && typeof item.questionCount === 'number'
      && (item.mode === 'practice' || item.mode === 'test')
      && Array.isArray(item.questions);
}
