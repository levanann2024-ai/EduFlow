import { useCallback, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { useSavedItems } from '@/pages/student/savedItems';
import type { QuizQuestion } from '@/types';

interface TeacherSavedBase {
  id: string;
  title: string;
  subject: string;
  savedAt: string;
}

export interface SavedTeacherQuestion extends TeacherSavedBase {
  type: 'question';
  question: QuizQuestion;
  setId: string;
}

export interface SavedTeacherExam extends TeacherSavedBase {
  type: 'exam';
  assessmentId: string;
}

export interface SavedTeacherAssignment extends TeacherSavedBase {
  type: 'assignment';
  assessmentId: string;
}

export interface SavedTeacherLesson extends TeacherSavedBase {
  type: 'lesson';
  content: string;
  grade: string;
}

export type SavedTeacherItem = SavedTeacherQuestion | SavedTeacherExam | SavedTeacherAssignment | SavedTeacherLesson;
export type TeacherSavedType = SavedTeacherItem['type'];

const teacherTypes: readonly string[] = ['question', 'exam', 'assignment', 'lesson'];

function isTeacherItem(value: unknown): value is SavedTeacherItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && typeof item.type === 'string' && teacherTypes.includes(item.type);
}

const keyOf = (type: TeacherSavedType, id: string) => `${type}:${id}`;

export function useTeacherBookmarks() {
  const { items, loading, error, saveItem, removeSavedItem } = useSavedItems();
  const [pending, setPending] = useState<string[]>([]);
  const [actionError, setActionError] = useState('');

  const saved = useMemo(() => (items as unknown[]).filter(isTeacherItem), [items]);

  const isSaved = useCallback(
    (type: TeacherSavedType, id: string) => saved.some((item) => item.type === type && item.id === id),
    [saved],
  );
  const isPending = (type: TeacherSavedType, id: string) => pending.includes(keyOf(type, id));

  const toggle = useCallback(async (item: SavedTeacherItem) => {
    const key = keyOf(item.type, item.id);
    if (pending.includes(key)) return;
    setPending((current) => [...current, key]);
    setActionError('');
    try {
      if (isSaved(item.type, item.id)) {
        await removeSavedItem(item.type, item.id);
      } else {
        await saveItem(item);
      }
    } catch (toggleError) {
      console.error('Không thể cập nhật mục đã lưu.', toggleError);
      setActionError(toggleError instanceof Error ? toggleError.message : 'Không thể cập nhật mục đã lưu.');
    } finally {
      setPending((current) => current.filter((value) => value !== key));
    }
  }, [isSaved, pending, removeSavedItem, saveItem]);

  return { loading, error: actionError || error, isSaved, isPending, toggle };
}

export function BookmarkButton({
  saved,
  busy,
  label,
  onToggle,
}: {
  saved: boolean;
  busy: boolean;
  label: string;
  onToggle: () => void;
}) {
  const text = saved ? `Bỏ lưu ${label}` : `Lưu ${label}`;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={text}
      title={text}
      className={`rounded-lg border border-slate-200 p-2 hover:bg-amber-50 disabled:opacity-50 ${saved ? 'text-amber-500' : 'text-slate-500 hover:text-amber-600'}`}
    >
      <Star className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
    </button>
  );
}