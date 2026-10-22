import { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CircleCheck, CircleX, Clock3 } from 'lucide-react';

interface PracticeRecord {
  id: string;
  title: string;
  subject: string;
  term: string;
  date: string;
  score: number;
  total: number;
}

const practiceRecords: PracticeRecord[] = [
  { id: 'english-midterm', title: 'KIỂM TRA GIỮA HỌC KÌ I — LỚP 11 — MÔN TIẾNG ANH', subject: 'Tiếng Anh', term: 'Giữa kỳ 1', date: '10/10/2026', score: 9, total: 10 },
  { id: 'math-midterm', title: 'KIỂM TRA GIỮA HỌC KÌ I — LỚP 11 — MÔN TOÁN', subject: 'Toán Học', term: 'Giữa kỳ 1', date: '10/10/2026', score: 8.95, total: 10 },
  { id: 'math-review', title: 'Bộ 10 đề ôn tập giữa học kì I - Toán 11 - Đề 1 (2025-2026)', subject: 'Toán Học', term: 'Giữa kỳ 1', date: '9/10/2026', score: 1.35, total: 10 },
];

interface PracticeHistoryProps {
  onBackToSaved: () => void;
}

export function PracticeHistory({ onBackToSaved }: PracticeHistoryProps) {
  const [subjectFilter, setSubjectFilter] = useState('Tất cả môn');
  const [resultFilter, setResultFilter] = useState('Tất cả kết quả');

  const visibleRecords = useMemo(() => practiceRecords.filter((record) => {
    const matchesSubject = subjectFilter === 'Tất cả môn' || record.subject === subjectFilter;
    const matchesResult = resultFilter === 'Tất cả kết quả'
      || (resultFilter === 'Đạt' ? record.score / record.total >= 0.5 : record.score / record.total < 0.5);
    return matchesSubject && matchesResult;
  }), [resultFilter, subjectFilter]);

  return (
    <main className="animate-fadeIn space-y-4 pb-8">
      <button type="button" onClick={onBackToSaved} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-700">
        <ArrowLeft className="h-4 w-4" /> Quay lại kho đề
      </button>

      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Lịch sử làm bài</h1>
      </header>

      <div className="flex flex-wrap gap-2" aria-label="Lọc lịch sử làm bài">
        <label>
          <span className="sr-only">Lọc theo môn</span>
          <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
            <option>Tất cả môn</option>
            {[...new Set(practiceRecords.map((record) => record.subject))].map((subject) => <option key={subject}>{subject}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Lọc theo kết quả</span>
          <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
            <option>Tất cả kết quả</option>
            <option>Đạt</option>
            <option>Chưa đạt</option>
          </select>
        </label>
      </div>

      <section aria-label="Danh sách bài đã làm" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {visibleRecords.length ? visibleRecords.map((record) => {
          const passed = record.score / record.total >= 0.5;
          const percentage = (record.score / record.total) * 100;
          return (
            <article key={record.id} className="flex min-h-[76px] items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:gap-4 sm:px-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${passed ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {passed ? <CircleCheck className="h-5 w-5" /> : <CircleX className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xs font-extrabold uppercase tracking-wide text-slate-900 sm:text-sm">{record.title}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-slate-500 sm:text-xs">
                  <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" /> {record.subject}</span>
                  <span className="inline-flex items-center gap-1"><span aria-hidden="true">◉</span> {record.term}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {record.date}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-extrabold leading-tight text-slate-900 sm:text-lg">{record.score}/{record.total}</p>
                <p className={`mt-0.5 text-[10px] font-bold ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>{percentage}%</p>
              </div>
            </article>
          );
        }) : (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Không có bài làm phù hợp với bộ lọc.</p>
        )}
      </section>
    </main>
  );
}
