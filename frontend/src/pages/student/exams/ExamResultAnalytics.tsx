import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, CircleHelp, Clock3, Download, FileText, Send, X } from 'lucide-react';
import type { ExamSubmissionSummary } from './ExamWorkspace';
import { examQuestions, type ExamQuestion } from './examQuestions';
import { useAppLanguage } from '@/i18n/AppLanguageContext';
import { studentLocale, t } from '@/i18n/i18n';

interface ExamResultAnalyticsProps {
  examTitle: string;
  subject: string;
  summary: ExamSubmissionSummary;
  onBack: () => void;
}

function formatDuration(totalSeconds: number, language: 'vi' | 'en') {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return t(language, 'examResult.duration', { minutes, seconds: String(seconds).padStart(2, '0') });
}

function displayAnswer(question: ExamQuestion, rawAnswer: string | undefined, language: 'vi' | 'en') {
  if (!rawAnswer) return t(language, 'examResult.unanswered');
  if (question.kind === 'choice') {
    return question.options?.[Number(rawAnswer)] ?? rawAnswer;
  }
  if (question.kind === 'true-false') {
    try {
      const parsed = JSON.parse(rawAnswer) as Record<number, string>;
      return Object.entries(parsed)
        .map(([index, value]) => `${String.fromCharCode(97 + Number(index))}. ${value}`)
        .join(' - ') || t(language, 'examResult.unanswered');
    } catch {
      return rawAnswer;
    }
  }
  return rawAnswer;
}

function displayCorrectAnswer(question: ExamQuestion, language: 'vi' | 'en') {
  if (typeof question.correctAnswer === 'string') {
    if (question.kind === 'choice') {
      return question.options?.[Number(question.correctAnswer)] ?? question.correctAnswer;
    }
    if (question.kind === 'essay' && !question.correctAnswer) return t(language, 'examResult.teacherManualGrade');
    return question.correctAnswer;
  }
  return Object.entries(question.correctAnswer)
    .map(([index, value]) => `${String.fromCharCode(97 + Number(index))}. ${value}`)
    .join(' - ');
}

function isAnswerCorrect(question: ExamQuestion, rawAnswer: string | undefined) {
  if (!rawAnswer) return false;
  if (question.kind === 'true-false' && typeof question.correctAnswer !== 'string') {
    try {
      const submitted = JSON.parse(rawAnswer) as Record<number, string>;
      return Object.keys(question.correctAnswer).length === Object.keys(submitted).length
        && Object.entries(question.correctAnswer).every(([key, value]) => submitted[Number(key)] === value);
    } catch {
      return false;
    }
  }
  if (question.kind === 'essay' && !question.correctAnswer) return false;
  return typeof question.correctAnswer === 'string'
    && rawAnswer.trim().toLocaleLowerCase('vi') === question.correctAnswer.trim().toLocaleLowerCase('vi');
}

export function ExamResultAnalytics({ examTitle, subject, summary, onBack }: ExamResultAnalyticsProps) {
  const language = useAppLanguage();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealError, setAppealError] = useState('');
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [appealId, setAppealId] = useState<string | null>(null);
  const [appealDecision, setAppealDecision] = useState<'Đã duyệt' | 'Đã từ chối' | null>(null);
  const correctCount = summary.correct ?? 0;
  const wrongCount = summary.wrong ?? summary.total;
  const score = summary.total ? (correctCount / summary.total) * 10 : 0;

  useEffect(() => {
    if (!appealId) return;
    const syncDecision = () => {
      try {
        const stored: unknown = JSON.parse(localStorage.getItem('eduflow-exam-appeals') ?? '[]');
        if (!Array.isArray(stored)) throw new Error(t(language, 'examResult.error.invalidAppeals'));
        const appeal = stored.find((item): item is Record<string, unknown> => (
          typeof item === 'object' && item !== null && 'id' in item && item.id === appealId
        ));
        if (appeal?.teacherStatus === 'Đã duyệt' || appeal?.teacherStatus === 'Đã từ chối') {
          setAppealDecision(appeal.teacherStatus);
        }
      } catch (error) {
        console.error('Không thể đồng bộ trạng thái phúc khảo trên thiết bị.', error);
        setAppealError(t(language, 'examResult.error.syncAppeal'));
      }
    };
    const syncOnStorage = (event: StorageEvent) => {
      if (event.key === 'eduflow-exam-appeals') syncDecision();
    };
    syncDecision();
    window.addEventListener('storage', syncOnStorage);
    window.addEventListener('eduflow-appeal-updated', syncDecision);
    return () => {
      window.removeEventListener('storage', syncOnStorage);
      window.removeEventListener('eduflow-appeal-updated', syncDecision);
    };
  }, [appealId, language]);

  const getAppealEvidence = () => ({
    examTitle,
    subject,
    submittedAt: summary.submittedAt,
    durationSeconds: summary.durationSeconds,
    submitReason: summary.submitReason,
    offscreenViolations: summary.offscreenViolations,
    totalOffscreenSeconds: summary.totalOffscreenSeconds,
    auditSaved: summary.auditSaved,
  });

  const downloadAppealEvidence = () => {
    const evidence = {
      fileName: 'Nhat-ky-thiet-bi.json',
      createdAt: new Date().toISOString(),
      auditLog: getAppealEvidence(),
      aiMonitoringLog: {
        available: false,
        reason: t(language, 'examResult.error.cameraUnavailable'),
      },
    };
    const file = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Nhat-ky-thiet-bi.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const submitAppeal = () => {
    if (!appealReason) {
      setAppealError(t(language, 'examResult.error.selectReason'));
      return;
    }
    const appeal = {
      id: crypto.randomUUID(),
      examTitle,
      subject,
      reason: appealReason,
      createdAt: new Date().toISOString(),
      attachments: {
        deviceAuditLog: getAppealEvidence(),
        aiMonitoringLog: {
          available: false,
          reason: t(language, 'examResult.error.cameraUnavailable'),
        },
      },
      delivery: 'local-only',
    };
    try {
      const savedAppeals = JSON.parse(localStorage.getItem('eduflow-exam-appeals') ?? '[]') as unknown;
      const appeals = Array.isArray(savedAppeals) ? savedAppeals : [];
      localStorage.setItem('eduflow-exam-appeals', JSON.stringify([...appeals, appeal]));
      setAppealId(appeal.id);
      setAppealError('');
      setAppealSubmitted(true);
    } catch (error) {
      console.error('Không thể lưu yêu cầu phúc khảo trên thiết bị.', error);
      setAppealError(t(language, 'examResult.error.saveAppealHelp'));
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-3 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{t(language, 'examResult.code')} 188 - {subject}</p>
            <h1 className="mt-1 text-xl font-extrabold text-slate-900">{t(language, 'examResult.title')}</h1>
            <p className="mt-1 text-sm text-slate-500">{examTitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAppealOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 active:scale-[0.98]"
            >
              <CircleHelp className="h-4 w-4" /> {t(language, 'examResult.appeal')}
            </button>
            <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" /> {t(language, 'examResult.backToRooms')}
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{t(language, 'examResult.submitted')}</span>
            <span className="text-xs text-slate-500">{t(language, 'examResult.demoNote')}</span>
          </div>

          <div className="grid grid-cols-2 gap-5 text-center sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-slate-500">{t(language, 'examResult.score')}</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-800">{score.toFixed(2)}<span className="text-sm font-semibold text-slate-400">/10</span></p>
            </div>
            <div>
              <p className="flex items-center justify-center gap-1 text-xs font-medium text-slate-500"><Clock3 className="h-3.5 w-3.5" /> {t(language, 'examResult.time')}</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{formatDuration(summary.durationSeconds, language)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{t(language, 'examResult.correct')}</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-600">{correctCount}/{summary.total}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{t(language, 'examResult.wrong')}</p>
              <p className="mt-1 text-2xl font-extrabold text-rose-600">{wrongCount}</p>
            </div>
          </div>

          <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-rose-100" aria-label={t(language, 'examResult.scoreSummary', { correct: correctCount, wrong: wrongCount })}>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${summary.total ? (correctCount / summary.total) * 100 : 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t(language, 'examResult.submittedAt')} {new Date(summary.submittedAt).toLocaleString(studentLocale(language), { dateStyle: 'short', timeStyle: 'short' })}
          </p>
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs leading-5 ${summary.offscreenViolations > 0 ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-600'}`}>
            <p><span className="font-semibold">{t(language, 'examResult.submitReason')}</span> {summary.submitReason}</p>
            <p>{summary.auditSaved ? t(language, 'examResult.auditSaved') : t(language, 'examResult.auditNotSaved')}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 sm:px-6"
          >
            <span>
              <span className="block font-bold text-slate-900">{t(language, 'examResult.details')}</span>
              <span className="mt-1 block text-xs text-slate-500">{t(language, 'examResult.detailsHint', { correct: correctCount, total: summary.total })}</span>
            </span>
            {detailsOpen ? <ArrowUp className="h-5 w-5 text-slate-500" /> : <ArrowDown className="h-5 w-5 text-slate-500" />}
          </button>

          {detailsOpen && (
            <div className="space-y-3 border-t border-slate-100 p-4 sm:p-6">
              {examQuestions.map((question) => {
                const correct = isAnswerCorrect(question, summary.answers[question.id]);
                const manualGrade = question.kind === 'essay' && !question.correctAnswer;
                return (
                  <article key={question.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${manualGrade ? 'bg-amber-100 text-amber-700' : correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {manualGrade ? <CircleHelp className="h-3.5 w-3.5" /> : correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-6 text-slate-800">{t(language, 'examResult.question')} {question.id}. {question.prompt}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600"><span className="font-semibold">{t(language, 'examResult.yourAnswer')}</span> {displayAnswer(question, summary.answers[question.id], language)}</p>
                        {summary.images[question.id]?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-semibold leading-6 text-slate-600">{t(language, 'examResult.imageAttachments')}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {summary.images[question.id].map((image) => (
                                <figure key={`${image.name}-${image.dataUrl.slice(-20)}`} className="max-w-48">
                                  <img src={image.dataUrl} alt={`${t(language, 'examResult.imageAttachments')} ${image.name}`} className="max-h-48 rounded-lg border border-slate-200 object-contain" />
                                  <figcaption className="mt-1 truncate text-xs text-slate-500">{image.name}</figcaption>
                                </figure>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="mt-1 text-sm leading-6 text-emerald-700"><span className="font-semibold">{t(language, 'examResult.answer')}</span> {displayCorrectAnswer(question, language)}</p>
                        {manualGrade && <p className="mt-1 text-xs font-semibold text-amber-700">{t(language, 'examResult.pendingGrade')}</p>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {appealOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAppealOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="appeal-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="appeal-title" className="text-lg font-bold text-slate-900">{t(language, 'examResult.appeal.title')}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{t(language, 'examResult.appeal.instructions')}</p>
              </div>
              <button type="button" onClick={() => setAppealOpen(false)} aria-label={t(language, 'examResult.close')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            {appealSubmitted ? (
              <div className="mt-5 space-y-3">
                <p role="status" className={`rounded-lg px-3 py-2 text-sm leading-5 ${appealDecision === 'Đã duyệt' ? 'bg-emerald-50 text-emerald-800' : appealDecision === 'Đã từ chối' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-900'}`}>
                  {appealDecision === 'Đã duyệt' ? t(language, 'examResult.appeal.approved') : appealDecision === 'Đã từ chối' ? t(language, 'examResult.appeal.rejected') : t(language, 'examResult.appeal.pending')}
                </p>
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{t(language, 'examResult.videoUnavailable')}</p>
                <button type="button" onClick={downloadAppealEvidence} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><Download className="h-4 w-4" /> {t(language, 'examResult.downloadLog')}</button>
                <button type="button" onClick={() => setAppealOpen(false)} className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700">{t(language, 'examResult.close')}</button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-800">{t(language, 'examResult.appeal.reason')}</span>
                  <select value={appealReason} onChange={(event) => { setAppealReason(event.target.value); setAppealError(''); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                    <option value="">{t(language, 'examResult.appeal.choose')}</option>
                    <option value="Gặp sự cố phần mềm/thông báo máy tính">{t(language, 'examResult.appeal.software')}</option>
                    <option value="Lỡ tay thoát toàn màn hình">{t(language, 'examResult.appeal.fullscreen')}</option>
                    <option value="Mất kết nối mạng">{t(language, 'examResult.appeal.network')}</option>
                    <option value="Lý do khác">{t(language, 'examResult.appeal.other')}</option>
                  </select>
                </label>
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  <p className="flex items-center gap-2 font-semibold text-slate-800"><FileText className="h-4 w-4" /> {t(language, 'examResult.automaticAttachments')}</p>
                  <p>{t(language, 'examResult.deviceLogAvailable')}</p>
                  <p>{t(language, 'examResult.videoUnavailable')}</p>
                </div>
                {appealError && <p role="alert" className="text-sm text-rose-700">{appealError}</p>}
                <button type="button" onClick={submitAppeal} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700"><Send className="h-4 w-4" /> {t(language, 'examResult.saveAppeal')}</button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
