import { useMemo, useState } from 'react';
import { BookOpenCheck, Plus, Search, Trash2, WandSparkles } from 'lucide-react';
import { AIQuizGenerator } from '@/pages/teacher/AIQuizGenerator';
import type { QuizQuestion } from '@/types';

interface QuestionSet {
  id: string;
  topic: string;
  subject: string;
  grade: string;
  createdAt: string;
  questions: QuizQuestion[];
}

const storageKey = 'eduflow.teacher.question-bank';

const demoSets: QuestionSet[] = [
  {
    id: 'demo-quadratic',
    topic: 'Hàm số bậc hai',
    subject: 'Toán học',
    grade: 'Khối 10',
    createdAt: 'Bộ câu hỏi mẫu',
    questions: [
      { id: 'demo-q1', question: 'Đồ thị hàm số y = x² có trục đối xứng là đường nào?', options: ['Trục Ox', 'Trục Oy', 'Đường y = x', 'Không có trục đối xứng'], correctIndex: 1, explanation: 'Hàm số y = x² là hàm chẵn nên đồ thị nhận trục Oy làm trục đối xứng.', difficulty: 'easy' },
      { id: 'demo-q2', question: 'Giá trị nhỏ nhất của y = (x - 2)² + 1 là bao nhiêu?', options: ['0', '1', '2', '4'], correctIndex: 1, explanation: '(x - 2)² ≥ 0 với mọi x, do đó giá trị nhỏ nhất là 1 khi x = 2.', difficulty: 'medium' },
    ],
  },
];

function loadQuestionSets(): QuestionSet[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(stored)) throw new Error('Ngân hàng câu hỏi không đúng định dạng.');
    const valid = stored.filter((item): item is QuestionSet => (
      typeof item === 'object'
      && item !== null
      && 'id' in item && typeof item.id === 'string'
      && 'topic' in item && typeof item.topic === 'string'
      && 'subject' in item && typeof item.subject === 'string'
      && 'grade' in item && typeof item.grade === 'string'
      && 'createdAt' in item && typeof item.createdAt === 'string'
      && 'questions' in item && Array.isArray(item.questions)
    ));
    return valid.length ? valid : demoSets;
  } catch (error) {
    console.error('Không thể đọc ngân hàng câu hỏi trên thiết bị.', error);
    return demoSets;
  }
}

export function QuestionBank() {
  const [sets, setSets] = useState(loadQuestionSets);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const filteredSets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return sets.filter((set) => `${set.topic} ${set.subject} ${set.grade}`.toLocaleLowerCase('vi').includes(normalized));
  }, [query, sets]);

  const persistSets = (nextSets: QuestionSet[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextSets));
      setSets(nextSets);
      setError('');
      return true;
    } catch (storageError) {
      console.error('Không thể cập nhật ngân hàng câu hỏi trên thiết bị.', storageError);
      setError('Không lưu được thay đổi. Hãy kiểm tra dung lượng lưu trữ của trình duyệt.');
      return false;
    }
  };

  const saveQuestionSet = (generated: { topic: string; subject: string; grade: string; questions: QuizQuestion[] }) => {
    const nextSet: QuestionSet = {
      ...generated,
      id: `bank-${Date.now()}`,
      createdAt: new Date().toLocaleDateString('vi-VN'),
    };
    if (persistSets([nextSet, ...sets])) setCreating(false);
  };

  const removeQuestionSet = (id: string) => {
    persistSets(sets.filter((set) => set.id !== id));
  };

  return (
    <main className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-950">Ngân hàng câu hỏi</h1>
            <p className="mt-1 text-sm text-slate-500">Lưu và tìm lại câu hỏi để dùng trong các bài kiểm tra.</p>
          </div>
          <button onClick={() => setCreating((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">
            {creating ? <BookOpenCheck className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creating ? 'Xem ngân hàng' : 'Tạo câu hỏi'}
          </button>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      {creating ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <WandSparkles className="h-4 w-4 text-violet-700" />
            <h2 className="font-semibold text-slate-900">Tạo bộ câu hỏi</h2>
          </div>
          <AIQuizGenerator onSaveQuestions={saveQuestionSet} />
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{filteredSets.length}</span> bộ câu hỏi</p>
            <label className="relative block w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo chủ đề, môn, khối..." className="input-field pl-9" />
            </label>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredSets.map((set) => (
              <article key={set.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-900">{set.topic}</h2>
                    <p className="mt-1 text-sm text-slate-500">{set.subject} · {set.grade} · {set.questions.length} câu · {set.createdAt}</p>
                  </div>
                  {set.id !== 'demo-quadratic' && <button onClick={() => removeQuestionSet(set.id)} aria-label={`Xóa bộ ${set.topic}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>}
                </div>
                <ol className="mt-4 space-y-3">
                  {set.questions.map((question, index) => (
                    <li key={question.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <p className="text-sm font-medium leading-5 text-slate-800">{index + 1}. {question.question}</p>
                      <p className="mt-2 text-sm text-slate-500">{question.options.map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}. ${option}`).join('  ·  ')}</p>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
            {filteredSets.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Không tìm thấy bộ câu hỏi phù hợp.</p>}
          </div>
        </section>
      )}
    </main>
  );
}
