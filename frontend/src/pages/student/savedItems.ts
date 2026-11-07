import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '@/auth/authApi';
import type { QuizQuestion } from '@/types';

const LEGACY_KEY = 'eduflow.student.saved-items';
const CHANGED_EVENT = 'eduflow-saved-items-changed';

interface SavedBase {
  id: string;
  title: string;
  subject: string;
  savedAt: string;
}

export interface SavedQuiz extends SavedBase {
  type: 'quiz';
  topic: string;
  questionCount: number;
  mode: 'practice' | 'test';
  questions: QuizQuestion[];
}

export interface SavedAnswer extends SavedBase {
  type: 'answer';
  question: string;
  answer: string;
  conversationId?: string;
}

export interface SavedResource extends SavedBase {
  type: 'resource';
}

export interface SavedQuestion extends SavedBase {
  type: 'question';
  question: QuizQuestion;
  setId: string;
}

export interface SavedAssessment extends SavedBase {
  type: 'exam' | 'assignment';
  assessmentId: string;
}

export interface SavedStudentAssignment extends SavedBase {
  type: 'assignment';
  assignmentId: string;
}

export interface SavedStudentExam extends SavedBase {
  type: 'exam';
  sessionId: string;
  classId: string;
}

export interface SavedLesson extends SavedBase {
  type: 'lesson';
  content: string;
  grade: string;
}

export type SavedItem = SavedQuiz | SavedAnswer | SavedResource | SavedQuestion | SavedAssessment
  | SavedStudentAssignment | SavedStudentExam | SavedLesson;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isQuizQuestion(value: unknown): value is QuizQuestion {
  return isRecord(value) && typeof value.id === 'string' && typeof value.question === 'string'
    && Array.isArray(value.options) && value.options.every((option) => typeof option === 'string')
    && typeof value.correctIndex === 'number' && Number.isInteger(value.correctIndex)
    && typeof value.explanation === 'string'
    && (value.difficulty === 'easy' || value.difficulty === 'medium' || value.difficulty === 'hard')
    && (value.type === undefined || value.type === 'multiple-choice' || value.type === 'true-false'
      || value.type === 'short-answer' || value.type === 'essay')
    && (value.correctAnswer === undefined || typeof value.correctAnswer === 'string')
    && (value.correctAnswers === undefined || (Array.isArray(value.correctAnswers) && value.correctAnswers.every((answer) => typeof answer === 'boolean')))
    && (value.points === undefined || (typeof value.points === 'number' && Number.isFinite(value.points)));
}

export function isSavedItem(value: unknown): value is SavedItem {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string'
    || typeof value.subject !== 'string' || typeof value.savedAt !== 'string') return false;
  switch (value.type) {
    case 'answer': return typeof value.question === 'string' && typeof value.answer === 'string'
      && (value.conversationId === undefined || typeof value.conversationId === 'string');
    case 'resource': return true;
    case 'quiz': return typeof value.topic === 'string' && typeof value.questionCount === 'number'
      && (value.mode === 'practice' || value.mode === 'test') && Array.isArray(value.questions)
      && value.questions.every(isQuizQuestion);
    case 'question': return typeof value.setId === 'string' && isQuizQuestion(value.question);
    case 'exam':
      return typeof value.assessmentId === 'string'
        || (typeof value.sessionId === 'string' && typeof value.classId === 'string');
    case 'assignment':
      return typeof value.assessmentId === 'string' || typeof value.assignmentId === 'string';
    case 'lesson': return typeof value.content === 'string' && typeof value.grade === 'string';
    default: return false;
  }
}

async function request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await authenticatedFetch(path, init);
  const body: unknown = await response.json();
  if (!isRecord(body) || !response.ok || body.success !== true) {
    throw new Error(isRecord(body) && typeof body.message === 'string'
      ? body.message : 'Không thể cập nhật nội dung đã lưu.');
  }
  return body;
}

export async function getSavedItems(): Promise<SavedItem[]> {
  const body = await request('/api/saved-items');
  if (!isRecord(body.data) || !Array.isArray(body.data.items) || !body.data.items.every(isSavedItem)) {
    throw new Error('Dữ liệu đã lưu từ máy chủ không hợp lệ.');
  }
  return body.data.items;
}

export async function saveItem(item: SavedItem): Promise<void> {
  await request(`/api/saved-items/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export async function removeSavedItem(type: SavedItem['type'], id: string): Promise<void> {
  await request(`/api/saved-items/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function readLegacySavedItems(): { raw: string; items: SavedItem[] } | null {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (raw === null) return null;
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every(isSavedItem)
    || data.some((item) => !['quiz', 'answer', 'resource'].includes(item.type))) {
    throw new Error('Dữ liệu lưu cũ không hợp lệ; dữ liệu gốc vẫn được giữ nguyên.');
  }
  return { raw, items: data };
}

export async function importLegacySavedItems(items: SavedItem[]): Promise<void> {
  const batches: SavedItem[][] = [];
  let batch: SavedItem[] = [];
  for (const item of items) {
    const candidate = [...batch, item];
    if (batch.length && (candidate.length > 100
      || new TextEncoder().encode(JSON.stringify({ items: candidate })).length > 900 * 1024)) {
      batches.push(batch);
      batch = [item];
    } else {
      batch = candidate;
    }
  }
  if (batch.length) batches.push(batch);
  for (const itemsBatch of batches) {
    try {
      await request('/api/saved-items/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsBatch }),
      });
      window.dispatchEvent(new Event(CHANGED_EVENT));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể nhập dữ liệu cũ.';
      throw new Error(`${message} Dữ liệu cũ vẫn được giữ lại; có thể thử nhập lại an toàn.`);
    }
  }
}

export function removeLegacySavedItems(raw: string): void {
  if (localStorage.getItem(LEGACY_KEY) !== raw) {
    throw new Error('Dữ liệu cũ đã thay đổi sau khi nhập nên được giữ lại để tránh mất dữ liệu.');
  }
  localStorage.removeItem(LEGACY_KEY);
}

export function useSavedItems() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const saved = await getSavedItems();
    setItems(saved);
    setError('');
  }, []);
  const save = useCallback(async (item: SavedItem) => {
    await saveItem(item);
    setItems((current) => [item, ...current.filter((entry) => entry.type !== item.type || entry.id !== item.id)]);
  }, []);
  const remove = useCallback(async (type: SavedItem['type'], id: string) => {
    await removeSavedItem(type, id);
    setItems((current) => current.filter((entry) => entry.type !== type || entry.id !== id));
  }, []);

  useEffect(() => {
    let active = true;
    let sequence = 0;
    const load = async () => {
      const current = ++sequence;
      try {
        const saved = await getSavedItems();
        if (active && current === sequence) {
          setItems(saved);
          setError('');
        }
      } catch (loadError) {
        if (active && current === sequence) setError(loadError instanceof Error ? loadError.message : 'Không thể tải nội dung đã lưu.');
      } finally {
        if (active && current === sequence) setLoading(false);
      }
    };
    void load();
    window.addEventListener(CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(CHANGED_EVENT, load);
    };
  }, []);

  return { items, loading, error, refresh, saveItem: save, removeSavedItem: remove };
}
