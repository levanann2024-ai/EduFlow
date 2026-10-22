import { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  Layers3,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import { getSavedItems, removeSavedItem, type SavedItem, type SavedQuiz } from './savedItems';

type SavedTab = 'quizzes' | 'answers' | 'resources';

interface SavedResourcesProps {
  onRepeatQuiz: (quiz: SavedQuiz) => void;
}

const tabs: { id: SavedTab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'quizzes', label: 'Đề luyện tập & Bài kiểm tra', icon: ClipboardList },
  { id: 'answers', label: 'Lời giải AI hay', icon: Sparkles },
  { id: 'resources', label: 'Tài liệu môn học', icon: BookOpen },
];

export function SavedResources({ onRepeatQuiz }: SavedResourcesProps) {
  const [activeTab, setActiveTab] = useState<SavedTab>('quizzes');
  const [items, setItems] = useState<SavedItem[]>(() => getSavedItems());
  const [error, setError] = useState('');

  const visibleItems = useMemo(() => items.filter((item) => (
    activeTab === 'quizzes'
      ? item.type === 'quiz'
      : activeTab === 'answers'
        ? item.type === 'answer'
        : item.type === 'resource'
  )), [activeTab, items]);

  const handleRemove = (id: string) => {
    try {
      removeSavedItem(id);
      setItems((current) => current.filter((item) => item.id !== id));
      setError('');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Không thể cập nhật kho lưu trữ.');
    }
  };

  return (
    <div className="animate-fadeIn space-y-4">
      <section className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Lọc nội dung đã lưu">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-pressed={activeTab === id}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}

        {visibleItems.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => item.type === 'quiz' ? (
              <article key={item.id} className="card flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <WandSparkles className="h-5 w-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    aria-label={`Xóa đề ${item.title}`}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex-1">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{item.subject}</span>
                  <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                    <Layers3 className="h-4 w-4" /> {item.questionCount} câu hỏi
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Lưu ngày {formatSavedDate(item.savedAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRepeatQuiz(item)}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  <CheckCircle2 className="h-4 w-4" /> Làm lại
                </button>
              </article>
            ) : item.type === 'answer' ? (
              <article key={item.id} className="card flex h-full flex-col p-5 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    aria-label={`Xóa bookmark ${item.title}`}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex-1">
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{item.subject}</span>
                  <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 line-clamp-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">{item.answer}</p>
                  <p className="mt-2 text-xs text-slate-400">Lưu ngày {formatSavedDate(item.savedAt)}</p>
                </div>
                <details className="mt-4 border-t border-slate-100 pt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-indigo-700">Xem câu hỏi</summary>
                  <p className="mt-2 text-sm leading-5 text-slate-600">{item.question}</p>
                </details>
              </article>
            ) : (
              <article key={item.id} className="card flex h-full flex-col p-5 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    aria-label={`Xóa tài liệu ${item.title}`}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex-1">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{item.subject}</span>
                  <h3 className="mt-3 font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-xs text-slate-400">Lưu ngày {formatSavedDate(item.savedAt)}</p>
                </div>
                <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">Chủ đề bài học đã đánh dấu để xem lại.</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState tab={activeTab} />
        )}
      </section>
    </div>
  );
}

function EmptyState({ tab }: { tab: SavedTab }) {
  const emptyContent: Record<SavedTab, { title: string; description: string; icon: typeof ClipboardList }> = {
    quizzes: {
      title: 'Chưa có đề luyện nào',
      description: 'Đề đã tạo sẽ hiện ở đây.',
      icon: ClipboardList,
    },
    answers: {
      title: 'Chưa lưu lời giải nào',
      description: 'Lưu câu trả lời trong AI Trợ giảng để xem lại.',
      icon: Sparkles,
    },
    resources: {
      title: 'Chưa có tài liệu được lưu',
      description: 'Bài học đã lưu sẽ hiện ở đây.',
      icon: FileText,
    },
  };
  const content = emptyContent[tab];
  const Icon = content.icon;

  return (
    <div className="card flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 font-semibold text-slate-800">{content.title}</h3>
      <p className="mt-1 max-w-md text-sm leading-5 text-slate-500">{content.description}</p>
    </div>
  );
}

function formatSavedDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}
