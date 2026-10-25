import { FormEvent, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, Send } from 'lucide-react';
import { listStudentAssignments, submitAssignment, type StudentAssignment } from '@/api/schoolApi';

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="mt-3 font-semibold underline underline-offset-2">
        Thử tải lại
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
  const [responseText, setResponseText] = useState(assignment.responseText ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const submitted = assignment.submittedAt !== null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await submitAssignment(assignment.id, responseText);
      setMessage('Đã nộp bài.');
      onSubmitted();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể nộp bài.');
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
          <span className="truncate">{assignment.subject} · {assignment.className}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${submitted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {submitted ? 'Đã nộp' : 'Chưa nộp'}
        </span>
      </div>

      <div className="flex-1 py-5">
        <h2 className="text-base font-semibold leading-6 text-slate-900">{assignment.title}</h2>
        {assignment.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{assignment.description}</p>}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
          {submitted ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <CalendarDays className="h-4 w-4 shrink-0 text-indigo-600" />}
          <span className="text-slate-500">Hạn nộp</span>
          <span className="ml-auto font-semibold text-slate-700">{new Date(assignment.dueAt).toLocaleString('vi-VN')}</span>
        </div>
        {submitted && assignment.submittedAt && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
            <Clock3 className="h-3.5 w-3.5" />Đã nộp lúc {new Date(assignment.submittedAt).toLocaleString('vi-VN')}
          </p>
        )}
      </div>

      <form onSubmit={(event) => void submit(event)} className="space-y-3 border-t border-slate-100 pt-4">
        <label className="block text-sm font-medium text-slate-700">
          Bài làm (văn bản)
          <textarea
            required
            maxLength={20000}
            rows={4}
            value={responseText}
            onChange={(event) => setResponseText(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            placeholder="Nhập câu trả lời..."
          />
        </label>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitted ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {saving ? 'Đang nộp...' : submitted ? 'Cập nhật bài nộp' : 'Nộp bài'}
        </button>
      </form>
    </article>
  );
}

export function Assignments() {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    listStudentAssignments()
      .then((result) => {
        if (active) setAssignments(result);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách bài tập.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Bài tập</h1>
      {error && <ErrorMessage message={error} onRetry={() => setReloadKey((key) => key + 1)} />}
      {loading ? (
        <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang tải bài tập...</p>
      ) : !error && assignments.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">Hiện chưa có bài tập được giao cho các lớp của bạn.</p>
      ) : !error ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Danh sách bài tập">
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
