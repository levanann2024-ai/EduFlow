import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, Send } from 'lucide-react';
import {
  getStudentAssignment,
  listStudentAssignmentSummaries,
  submitAssignment,
  type StudentAssignment,
  type StudentAssignmentSummary,
} from '@/api/schoolApi';
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
  detail,
  expanded,
  detailLoading,
  detailError,
  onToggle,
  onRetryDetail,
  onSubmitted,
}: {
  assignment: StudentAssignmentSummary;
  detail: StudentAssignment | undefined;
  expanded: boolean;
  detailLoading: boolean;
  detailError: string | undefined;
  onToggle: () => void;
  onRetryDetail: () => void;
  onSubmitted: (submission: Awaited<ReturnType<typeof submitAssignment>>) => void;
}) {
  const language = useAppLanguage();
  const locale = studentLocale(language);
  const [responseText, setResponseText] = useState(detail?.responseText ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const draftDirty = useRef(false);
  const submitted = assignment.submittedAt !== null;

  useEffect(() => {
    if (!draftDirty.current && detail) setResponseText(detail.responseText ?? '');
  }, [detail?.responseText, detail]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const submission = await submitAssignment(assignment.id, responseText);
      draftDirty.current = false;
      showToast(t(language, "Đã nộp bài."));
      onSubmitted(submission);
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
        {assignment.score !== null && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-sm font-semibold text-emerald-800">{t(language, 'phrase:Điểm::Grade')}: {assignment.score}/10</p>
            {detail?.teacherFeedback && (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-emerald-900">{detail.teacherFeedback}</p>
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

      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="min-h-10 border-t border-slate-100 pt-3 text-left text-sm font-semibold text-indigo-700 hover:text-indigo-900"
      >
        {expanded ? 'Đóng chi tiết' : 'Xem nội dung và bài làm'}
      </button>
      {expanded && (
        <div className="pt-4">
          {detailLoading && <p role="status" className="text-sm text-slate-500">Đang tải chi tiết bài tập...</p>}
          {detailError && <ErrorMessage message={detailError} onRetry={onRetryDetail} />}
          {detail && (
            <>
              {detail.description && <p className="mb-4 whitespace-pre-wrap text-sm text-slate-600">{detail.description}</p>}
              {detail.score !== null && detail.teacherFeedback && (
                <p className="mb-4 whitespace-pre-wrap text-sm leading-5 text-emerald-900">{detail.teacherFeedback}</p>
              )}
              <form onSubmit={(event) => void submit(event)} className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  {t(language, "Bài làm (văn bản)")}
                  <textarea
                    required
                    maxLength={20000}
                    rows={4}
                    value={responseText}
                    onChange={(event) => {
                      draftDirty.current = true;
                      setResponseText(event.target.value);
                    }}
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
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function Assignments() {
  const language = useAppLanguage();
  const languageRef = useRef(language);
  languageRef.current = language;
  const [assignments, setAssignments] = useState<StudentAssignmentSummary[]>([]);
  const [details, setDetails] = useState<Record<string, StudentAssignment>>({});
  const detailsRef = useRef<Record<string, StudentAssignment>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const detailRequests = useRef(new Map<string, AbortController>());
  const expandedIdRef = useRef<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const loadDetail = useCallback(async (assignmentId: string, force = false) => {
    if (!force && detailsRef.current[assignmentId]) return;
    if (detailRequests.current.has(assignmentId)) return;
    const controller = new AbortController();
    detailRequests.current.set(assignmentId, controller);
    setLoadingDetails((current) => ({ ...current, [assignmentId]: true }));
    setDetailErrors((current) => ({ ...current, [assignmentId]: '' }));
    try {
      const detail = await getStudentAssignment(assignmentId, controller.signal);
      if (!controller.signal.aborted) {
        detailsRef.current = { ...detailsRef.current, [assignmentId]: detail };
        setDetails(detailsRef.current);
      }
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setDetailErrors((current) => ({
          ...current,
          [assignmentId]: requestError instanceof Error ? requestError.message : 'Không thể tải chi tiết bài tập.',
        }));
      }
    } finally {
      if (detailRequests.current.get(assignmentId) === controller) {
        detailRequests.current.delete(assignmentId);
        setLoadingDetails((current) => ({ ...current, [assignmentId]: false }));
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refreshAssignments = async () => {
      setLoading(true);
      try {
        const result = await listStudentAssignmentSummaries(controller.signal);
        if (active) {
          setAssignments(result);
          setError('');
          if (expandedIdRef.current) void loadDetail(expandedIdRef.current, true);
        }
      } catch (requestError: unknown) {
        if (active && !controller.signal.aborted) {
          setError(requestError instanceof Error
            ? requestError.message
            : t(languageRef.current, "Không thể tải danh sách bài tập."));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void refreshAssignments();
    return () => {
      active = false;
      controller.abort();
    };
  }, [loadDetail, reloadKey]);

  useEffect(() => () => {
    detailRequests.current.forEach((controller) => controller.abort());
    detailRequests.current.clear();
  }, []);

  const toggleAssignment = (assignmentId: string) => {
    const nextId = expandedId === assignmentId ? null : assignmentId;
    if (expandedId && expandedId !== nextId) {
      const request = detailRequests.current.get(expandedId);
      if (request) {
        request.abort();
        detailRequests.current.delete(expandedId);
        setLoadingDetails((current) => ({ ...current, [expandedId]: false }));
      }
    }
    expandedIdRef.current = nextId;
    setExpandedId(nextId);
    if (nextId) void loadDetail(nextId);
  };

  const updateSubmittedAssignment = (
    assignmentId: string,
    submission: Awaited<ReturnType<typeof submitAssignment>>,
  ) => {
    setAssignments((current) => current.map((assignment) => assignment.id === assignmentId
      ? { ...assignment, submittedAt: submission.submittedAt, score: null, gradedAt: null }
      : assignment));
    const detail = detailsRef.current[assignmentId];
    if (detail) {
      const updated = {
        ...detail,
        responseText: submission.responseText,
        submittedAt: submission.submittedAt,
        files: submission.files,
        score: null,
        teacherFeedback: '',
        questionScores: {},
        questionFeedback: {},
        gradedAt: null,
      };
      detailsRef.current = { ...detailsRef.current, [assignmentId]: updated };
      setDetails(detailsRef.current);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{t(language, 'phrase:Bài tập::Assignments')}</h1>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
          className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {t(language, 'Làm mới')}
        </button>
      </div>
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
              detail={details[assignment.id]}
              expanded={expandedId === assignment.id}
              detailLoading={Boolean(loadingDetails[assignment.id])}
              detailError={detailErrors[assignment.id] || undefined}
              onToggle={() => toggleAssignment(assignment.id)}
              onRetryDetail={() => void loadDetail(assignment.id, true)}
              onSubmitted={(submission) => updateSubmittedAssignment(assignment.id, submission)}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
