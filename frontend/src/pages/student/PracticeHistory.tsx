import { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, CircleCheck, CircleX, Clock3 } from 'lucide-react';
import { useAppLanguage } from '@/i18n/AppLanguageContext';
import { localizeStudentSubject, t } from '@/i18n/i18n';

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
  { id: 'english-midterm', title: 'practiceHistory.demo.english', subject: 'Tiếng Anh', term: 'Giữa kỳ 1', date: '10/10/2026', score: 9, total: 10 },
  { id: 'math-midterm', title: 'practiceHistory.demo.mathMidterm', subject: 'Toán Học', term: 'Giữa kỳ 1', date: '10/10/2026', score: 8.95, total: 10 },
  { id: 'math-review', title: 'practiceHistory.demo.mathReview', subject: 'Toán Học', term: 'Giữa kỳ 1', date: '9/10/2026', score: 1.35, total: 10 },
];

interface PracticeHistoryProps {
  onBackToSaved: () => void;
}

export function PracticeHistory({ onBackToSaved }: PracticeHistoryProps) {
  const language = useAppLanguage();
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'passed' | 'failed'>('all');

  const visibleRecords = useMemo(() => practiceRecords.filter((record) => {
    const matchesSubject = subjectFilter === 'all' || record.subject === subjectFilter;
    const matchesResult = resultFilter === 'all'
      || (resultFilter === 'passed' ? record.score / record.total >= 0.5 : record.score / record.total < 0.5);
    return matchesSubject && matchesResult;
  }), [resultFilter, subjectFilter]);

  return (
    <main className="animate-fadeIn space-y-4 pb-8">
      <button type="button" onClick={onBackToSaved} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-700">
        <ArrowLeft className="h-4 w-4" /> {t(language, 'practiceHistory.back')}
      </button>

      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{t(language, 'practiceHistory.title')}</h1>
      </header>

      <div className="flex flex-wrap gap-2" aria-label={t(language, 'practiceHistory.filters.label')}>
        <label>
          <span className="sr-only">{t(language, 'practiceHistory.subject.filter')}</span>
          <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
            <option value="all">{t(language, 'practiceHistory.subject.all')}</option>
            {[...new Set(practiceRecords.map((record) => record.subject))].map((subject) => <option key={subject}>{subject}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">{t(language, 'practiceHistory.result.filter')}</span>
          <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value as typeof resultFilter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
            <option value="all">{t(language, 'practiceHistory.result.all')}</option>
            <option value="passed">{t(language, 'practiceHistory.result.passed')}</option>
            <option value="failed">{t(language, 'practiceHistory.result.failed')}</option>
          </select>
        </label>
      </div>

      <section aria-label={t(language, 'practiceHistory.list.label')} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {visibleRecords.length ? visibleRecords.map((record) => {
          const passed = record.score / record.total >= 0.5;
          const percentage = (record.score / record.total) * 100;
          return (
            <article key={record.id} className="flex min-h-[76px] items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:gap-4 sm:px-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${passed ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {passed ? <CircleCheck className="h-5 w-5" /> : <CircleX className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xs font-extrabold uppercase tracking-wide text-slate-900 sm:text-sm">{t(language, record.title)}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.625rem] text-slate-500 sm:text-xs">
                  <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" /> {localizeStudentSubject(record.subject, language)}</span>
                  <span className="inline-flex items-center gap-1"><span aria-hidden="true">◉</span> {t(language, 'practiceHistory.term.midterm')}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {record.date}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-extrabold leading-tight text-slate-900 sm:text-lg">{record.score}/{record.total}</p>
                <p className={`mt-0.5 text-[0.625rem] font-bold ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>{percentage}%</p>
              </div>
            </article>
          );
        }) : (
          <p className="px-5 py-10 text-center text-sm text-slate-500">{t(language, 'practiceHistory.empty')}</p>
        )}
      </section>
    </main>
  );
}
