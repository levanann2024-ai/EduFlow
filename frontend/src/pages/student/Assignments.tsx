import { FormEvent, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, Send } from 'lucide-react';
import { listStudentAssignments, submitAssignment, type StudentAssignment } from '@/api/schoolApi';
import { showToast } from '@/components/toast';
import { useAppLanguage } from '@/i18n/AppLanguageContext';
import { studentLocale, t } from '@/i18n/i18n';

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  const language = useAppLanguage();
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="mt-3 font-semibold underline underline-offset-2">
        {t(language, "Thử tải lại")}
      </button>
    </div>
  );
}

function AssignmentCard({
  assignment,
  onSubmitted,
}: {
  assignment: StudentAssignment;
  onSubmitted: () => void;
}) {
  const language = useAppLanguage();
  const locale = studentLocale(language);
  const [responseText, setResponseText] = useState(assignment.responseText ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitted = assignment.submittedAt !== null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await submitAssignment(assignment.id, responseText);
      showToast(t(language, "Đã nộp bài."));
      onSubmitted();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t(language, "Không thể nộp bài."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="flex min-h-64 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ClipboardList className="h-4 w-4" />
          </span>
          <span className="truncate">{assignment.subject} - {assignment.className}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${submitted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {submitted ? t(language, "Đã nộp") : t(language, "Chưa nộp")}
        </span>
      </div>

      <div className="flex-1 py-5">
        <h2 className="text-base font-semibold leading-6 text-slate-900">{assignment.title}</h2>
        {assignment.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{assignment.description}</p>}
        {assignment.score !== null && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-sm font-semibold text-emerald-800">{t(language, 'phrase:Điểm::Grade')}: {assignment.score}/10</p>
            {assignment.teacherFeedback && (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-emerald-900">{assignment.teacherFeedback}</p>
            )}
          </div>
        )}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
          {submitted ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <CalendarDays className="h-4 w-4 shrink-0 text-indigo-600" />}
          <span className="text-slate-500">{t(language, "Hạn nộp")}</span>
          <span className="ml-auto font-semibold text-slate-700">{new Date(assignment.dueAt).toLocaleString(locale)}</span>
        </div>
        {submitted && assignment.submittedAt && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
            <Clock3 className="h-3.5 w-3.5" />{t(language, "Đã nộp lúc")} {new Date(assignment.submittedAt).toLocaleString(locale)}
          </p>
        )}
      </div>

      <form onSubmit={(event) => void submit(event)} className="space-y-3 border-t border-slate-100 pt-4">
        <label className="block text-sm font-medium text-slate-700">
          {t(language, "Bài làm (văn bản)")}
          <textarea
            required
            maxLength={20000}
            rows={4}
            value={responseText}
            onChange={(event) => setResponseText(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            placeholder={t(language, "Nhập câu trả lời...")}
          />
        </label>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitted ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {saving ? t(language, "Đang nộp...") : submitted ? t(language, "Cập nhật bài nộp") : t(language, "phrase:Nộp bài::Submit assignment")}
        </button>
      </form>
    </article>
  );
}

export function Assignments() {
  const language = useAppLanguage();
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const refreshAssignments = async (silent = false) => {
      if (inFlight) return;
      inFlight = true;
      if (!silent) setLoading(true);
      try {
        const result = await listStudentAssignments();
        if (active) {
          setAssignments(result);
          setError('');
        }
      } catch (requestError: unknown) {
        if (active) setError(requestError instanceof Error ? requestError.message : t(language, "Không thể tải danh sách bài tập."));
      } finally {
        inFlight = false;
        if (active && !silent) setLoading(false);
      }
    };
    void refreshAssignments();
    const refreshWhenVisible = () => {
      if (!document.hidden) void refreshAssignments(true);
    };
    const timer = window.setInterval(refreshWhenVisible, 5_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [reloadKey, language]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">{t(language, 'phrase:Bài tập::Assignments')}</h1>
      {error && <ErrorMessage message={error} onRetry={() => setReloadKey((key) => key + 1)} />}
      {loading ? (
        <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{t(language, "Đang tải bài tập...")}</p>
      ) : !error && assignments.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">{t(language, "Hiện chưa có bài tập được giao cho các lớp của bạn.")}</p>
      ) : !error ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label={t(language, "Danh sách bài tập")}>
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onSubmitted={() => setReloadKey((key) => key + 1)}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
