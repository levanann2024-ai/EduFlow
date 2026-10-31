import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleHelp, CircleX, Clock3, Sparkles } from 'lucide-react';
import { MathText } from '@/components/MathText';
import {
  downloadStudentExamResultFile,
  type StudentExamResult,
  type StudentExamReviewQuestion,
} from '@/api/schoolApi';

type RevealStage = 'intro' | 'score' | 'actions' | 'details';

interface StudentExamResultsProps {
  results: StudentExamResult[];
  loading: boolean;
  error: string;
  readRevisions: Record<string, string>;
  readError: string;
  onMarkRead: (result: StudentExamResult) => void | Promise<void>;
  onAskAI: (prompt: string, subject?: string) => void;
}

function gradeRevision(result: StudentExamResult) {
  return result.grade.gradedAt;
}

function formatPoints(value: number) {
  return Number(value.toFixed(2)).toString();
}

function formatDate(value: string | null) {
  if (!value) return 'Chưa có thông tin';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function scoreColor(score: number, maxScore: number) {
  const ratio = maxScore > 0 ? Math.min(1, Math.max(0, score / maxScore)) : 0;
  const stops = [
    { score: 0, color: [17, 24, 39] },
    { score: 0.2, color: [185, 28, 28] },
    { score: 0.4, color: [234, 88, 12] },
    { score: 0.6, color: [202, 138, 4] },
    { score: 0.8, color: [101, 163, 13] },
    { score: 1, color: [21, 128, 61] },
  ];
  const upperIndex = stops.findIndex((stop) => stop.score >= ratio);
  const upper = stops[upperIndex] ?? stops[stops.length - 1];
  const lower = stops[Math.max(0, upperIndex - 1)];
  const position = (ratio - lower.score) / (upper.score - lower.score || 1);
  const channels = lower.color.map((channel, index) =>
    Math.round(channel + (upper.color[index] - channel) * position));
  return `rgb(${channels.join(' ')})`;
}

function studentAnswerText(
  question: StudentExamReviewQuestion,
  index: number,
  answers: Record<string, string>,
  hasImageAnswer: boolean,
) {
  const rawAnswer = answers[String(index + 1)] ?? '';
  if (!rawAnswer) {
    return hasImageAnswer ? 'Bài làm được gửi bằng ảnh đính kèm bên dưới.' : 'Bạn chưa trả lời câu này.';
  }
  if (question.type === 'multiple-choice') {
    const optionIndex = Number(rawAnswer);
    if (Number.isInteger(optionIndex) && question.options[optionIndex] !== undefined) {
      return `${String.fromCharCode(65 + optionIndex)}. ${question.options[optionIndex]}`;
    }
  }
  if (question.type === 'true-false') {
    try {
      const selected: unknown = JSON.parse(rawAnswer);
      if (selected && typeof selected === 'object' && !Array.isArray(selected)) {
        const values = selected as Record<string, unknown>;
        const rows = question.options.flatMap((statement, statementIndex) => {
          const value = values[String(statementIndex)];
          return typeof value === 'string'
            ? [{ statement, value, statementIndex }]
            : [];
        });
        if (rows.length) return rows
          .map(({ statement, value, statementIndex }) => `${String.fromCharCode(97 + statementIndex)}. ${statement} — ${value}`)
          .join('\n');
      }
    } catch {
      return rawAnswer;
    }
  }
  return rawAnswer;
}

function correctAnswer(question: StudentExamReviewQuestion) {
  if (question.type === 'multiple-choice') {
    const answer = question.options[question.correctIndex] ?? question.correctAnswer;
    if (!answer) return 'Giáo viên chưa nhập đáp án.';
    return question.correctIndex >= 0
      ? `${String.fromCharCode(65 + question.correctIndex)}. ${answer}`
      : answer;
  }
  if (question.type === 'true-false') {
    if (!question.correctAnswers?.length) return question.correctAnswer || 'Giáo viên chưa nhập đáp án.';
    return question.options.map((statement, index) => (
      `${String.fromCharCode(97 + index)}. ${statement} — ${question.correctAnswers?.[index] ? 'Đúng' : 'Sai'}`
    )).join('\n');
  }
  return question.correctAnswer || 'Giáo viên chưa nhập lời giải.';
}

function aiAnalysisPrompt(
  result: StudentExamResult,
  question: StudentExamReviewQuestion,
  index: number,
) {
  const answer = studentAnswerText(
    question,
    index,
    result.answers,
    result.files.some((file) => file.questionNumber === index + 1),
  );
  const feedback = result.grade.questionFeedback[question.id] || 'Không có lời phê riêng cho câu này.';
  return [
    `Mình đang xem lại câu ${index + 1} trong bài kiểm tra "${result.title}" môn ${result.subject}.`,
    `Đề bài: ${question.question}`,
    `Bài làm của mình: ${answer}`,
    `Lời phê của giáo viên: ${feedback}`,
    `Đáp án/hướng dẫn của giáo viên: ${correctAnswer(question)}`,
    question.explanation ? `Giải thích của giáo viên: ${question.explanation}` : '',
    'Hãy phân tích từng bước vì sao bài làm đúng hoặc sai và giúp mình hiểu kiến thức. Chỉ giải thích để học tập, không chỉnh sửa hay thay đổi bài làm đã nộp.',
  ].filter(Boolean).join('\n\n');
}

export function StudentExamResults({
  results,
  loading,
  error,
  readRevisions,
  readError,
  onMarkRead,
  onAskAI,
}: StudentExamResultsProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [revealStage, setRevealStage] = useState<RevealStage>('details');
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState('');
  const selectedResult = results.find((result) => result.sessionId === selectedSessionId) ?? null;
  const maxScore = useMemo(
    () => selectedResult?.questions.reduce((total, question) => total + question.points, 0) ?? 0,
    [selectedResult],
  );
  const groupedQuestions = useMemo(() => {
    const groups = new Map<string, {
      id: string;
      title: string;
      description: string;
      questions: Array<{ question: StudentExamReviewQuestion; index: number }>;
    }>();
    selectedResult?.questions.forEach((question, index) => {
      const id = question.sectionId || question.sectionTitle || `section-${index}`;
      const group = groups.get(id) ?? {
        id,
        title: question.sectionTitle || 'Bài làm',
        description: question.sectionDescription,
        questions: [],
      };
      group.questions.push({ question, index });
      groups.set(id, group);
    });
    return Array.from(groups.values());
  }, [selectedResult]);

  useEffect(() => {
    if (selectedSessionId && !results.some((result) => result.sessionId === selectedSessionId)) {
      setSelectedSessionId(null);
      setRevealStage('details');
    }
  }, [results, selectedSessionId]);

  useEffect(() => {
    if (loading || selectedSessionId) return;
    const unreadResults = results.filter((result) => (
      readRevisions[result.sessionId] !== gradeRevision(result)
    ));
    if (unreadResults.length > 0) {
      const newestUnreadResult = unreadResults.reduce((newest, result) => (
        new Date(result.grade.gradedAt).getTime() > new Date(newest.grade.gradedAt).getTime()
          ? result
          : newest
      ));
      setSelectedSessionId(newestUnreadResult.sessionId);
      setRevealStage('intro');
    }
  }, [loading, readRevisions, results, selectedSessionId]);

  useEffect(() => {
    if (revealStage !== 'score') return undefined;
    const timer = window.setTimeout(() => setRevealStage('actions'), 1000);
    return () => window.clearTimeout(timer);
  }, [revealStage]);

  useEffect(() => {
    if (!selectedResult) {
      setFileUrls({});
      setFileError('');
      return undefined;
    }
    let active = true;
    const createdUrls: string[] = [];
    setFileUrls({});
    setFileError('');
    const requests = [
      ...selectedResult.files.map((file) => ({
        key: `submission:${file.id}`,
        id: file.id,
        gradeEvidence: false,
      })),
      ...selectedResult.grade.evidenceFiles.map((file) => ({
        key: `evidence:${file.id}`,
        id: file.id,
        gradeEvidence: true,
      })),
    ];
    void Promise.all(requests.map(async ({ key, id, gradeEvidence }) => {
      try {
        const blob = await downloadStudentExamResultFile(selectedResult.sessionId, id, gradeEvidence);
        const url = URL.createObjectURL(blob);
        createdUrls.push(url);
        return { key, url };
      } catch (requestError) {
        return {
          key,
          error: requestError instanceof Error ? requestError.message : 'Không thể tải ảnh đính kèm.',
        };
      }
    })).then((loadedFiles) => {
      if (!active) return;
      setFileUrls(loadedFiles.reduce<Record<string, string>>((urls, file) => {
        if ('url' in file && typeof file.url === 'string') urls[file.key] = file.url;
        return urls;
      }, {}));
      const failures = loadedFiles.flatMap((file) => ('error' in file ? [file.error] : []));
      if (failures.length) setFileError(failures.join(' '));
    });
    return () => {
      active = false;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedResult]);

  const openResult = (result: StudentExamResult) => {
    setSelectedSessionId(result.sessionId);
    setRevealStage(readRevisions[result.sessionId] === gradeRevision(result) ? 'details' : 'intro');
  };

  if (loading && results.length === 0) {
    return <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Đang tải kết quả kiểm tra...</p>;
  }
  if (error && results.length === 0) {
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error}
      </div>
    );
  }
  if (!results.length) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center">
        <CircleHelp className="h-10 w-10 text-slate-300" />
        <p className="mt-3 font-semibold text-slate-700">Chưa có bài kiểm tra được công bố điểm</p>
        <p className="mt-1 text-sm text-slate-500">Khi giáo viên chấm và công bố điểm, bài làm sẽ xuất hiện tại đây.</p>
      </div>
    );
  }

  if (!selectedResult) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Bài kiểm tra đã có điểm</h2>
          <p className="mt-1 text-sm text-slate-500">Chọn bài để xem điểm, lời phê và lời giải của giáo viên.</p>
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {readError && <p role="alert" className="text-sm text-rose-700">{readError}</p>}
        <div className="space-y-3">
          {results.map((result) => {
            const unread = readRevisions[result.sessionId] !== gradeRevision(result);
            return (
              <button
                key={result.sessionId}
                type="button"
                onClick={() => openResult(result)}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-base font-bold text-slate-900">{result.title}</span>
                      {unread && <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">Điểm mới</span>}
                    </span>
                    <p className="mt-1 text-sm text-slate-500">{result.subject} · {result.className}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" /> Công bố {formatDate(result.grade.gradedAt)}
                    </p>
                  </div>
                  <strong className="shrink-0 text-2xl font-extrabold" style={{ color: scoreColor(result.grade.totalScore, result.questions.reduce((sum, question) => sum + question.points, 0)) }}>
                    {formatPoints(result.grade.totalScore)}<span className="ml-1 text-sm font-semibold text-slate-500">/ {formatPoints(result.questions.reduce((sum, question) => sum + question.points, 0))}</span>
                  </strong>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (revealStage !== 'details') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 px-5 text-center backdrop-blur-sm">
        <div className="mx-auto w-full max-w-4xl">
          {revealStage === 'intro' ? (
            <p
              key={`${selectedResult.sessionId}:${gradeRevision(selectedResult)}`}
              onAnimationEnd={() => {
                if (revealStage !== 'intro') return;
                setRevealStage('score');
                onMarkRead(selectedResult);
              }}
              className="exam-score-intro text-3xl font-extrabold leading-tight text-blue-700 sm:text-5xl"
            >
              Điểm kiểm tra {selectedResult.title} của em là...
            </p>
          ) : (
            <>
              <p className="text-lg font-bold text-blue-700 sm:text-2xl">{selectedResult.title}</p>
              <div
                className={`my-8 flex items-baseline justify-center gap-3 whitespace-nowrap ${
                  revealStage === 'score' ? 'exam-score-pop' : ''
                }`}
                aria-live="polite"
              >
                <span
                  className="text-7xl font-black leading-none tracking-tight sm:text-[12rem]"
                  style={{ color: scoreColor(selectedResult.grade.totalScore, maxScore) }}
                >
                  {formatPoints(selectedResult.grade.totalScore)}
                </span>
                <span className="text-xl font-bold text-slate-500 sm:text-5xl">
                  / {formatPoints(maxScore)} điểm
                </span>
              </div>
              {revealStage === 'actions' && (
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRevealStage('details')}
                    className="min-h-12 rounded-xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:bg-blue-700"
                  >
                    Xem chi tiết bài làm
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSessionId(null)}
                    className="min-h-12 rounded-xl border border-slate-300 bg-white px-6 py-3 text-base font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Thoát ra
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <button
        type="button"
        onClick={() => setSelectedSessionId(null)}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách bài kiểm tra
      </button>
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-semibold text-blue-700">{selectedResult.subject} · {selectedResult.className}</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">{selectedResult.title}</h2>
        <p className="mt-2 text-sm text-slate-500">Nộp bài {formatDate(selectedResult.submittedAt)} · Công bố điểm {formatDate(selectedResult.grade.gradedAt)}</p>
        <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1">
          <strong className="text-5xl font-black leading-none" style={{ color: scoreColor(selectedResult.grade.totalScore, maxScore) }}>
            {formatPoints(selectedResult.grade.totalScore)}
          </strong>
          <span className="pb-1 text-lg font-semibold text-slate-500">/ {formatPoints(maxScore)} điểm</span>
        </div>
        {selectedResult.grade.teacherFeedback && (
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <h3 className="font-bold text-blue-950">Lời phê của giáo viên</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedResult.grade.teacherFeedback}</p>
          </div>
        )}
      </header>
        {fileError && <p role="alert" className="text-sm text-rose-700">{fileError}</p>}

        {groupedQuestions.map((group) => (
          <section key={group.id} className="space-y-3">
          <header className="rounded-xl bg-slate-100 px-4 py-3">
              <h3 className="text-lg font-extrabold text-blue-800">{group.title}</h3>
            {group.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{group.description}</p>}
          </header>
          {group.questions.map(({ question, index }) => {
            const score = selectedResult.grade.questionScores[question.id] ?? 0;
            const feedback = selectedResult.grade.questionFeedback[question.id];
            const isCorrect = question.type !== 'essay' && score >= question.points;
            return (
              <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h4 className="min-w-0 flex-1 text-base font-bold leading-7 text-slate-900">
                    Câu {index + 1} <span className="font-normal">· {formatPoints(question.points)} điểm</span>
                  </h4>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                    question.type === 'essay'
                      ? 'bg-blue-50 text-blue-700'
                      : isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {question.type === 'essay'
                      ? `${formatPoints(score)} / ${formatPoints(question.points)} điểm`
                      : isCorrect ? <><CheckCircle2 className="h-3.5 w-3.5" /> Đúng</> : <><CircleX className="h-3.5 w-3.5" /> Cần xem lại</>}
                  </span>
                </div>
                <div className="mt-3 text-sm leading-7 text-slate-800"><MathText text={question.question} /></div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Bài làm của bạn</p>
                    <p className={`whitespace-pre-wrap text-sm leading-6 ${
                      !selectedResult.answers[String(index + 1)] ? 'italic text-slate-500' : 'text-slate-800'
                    }`}>
                      {studentAnswerText(
                        question,
                        index,
                        selectedResult.answers,
                        selectedResult.files.some((file) => file.questionNumber === index + 1),
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-800">Đáp án / lời giải của giáo viên</p>
                    <div className="whitespace-pre-wrap text-sm leading-6 text-slate-800"><MathText text={correctAnswer(question)} /></div>
                  </div>
                </div>
                {selectedResult.files.some((file) => file.questionNumber === index + 1) && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ảnh bài làm của bạn</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedResult.files
                        .filter((file) => file.questionNumber === index + 1)
                        .map((file) => (
                          <figure key={file.id} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            {fileUrls[`submission:${file.id}`]
                              ? <img src={fileUrls[`submission:${file.id}`]} alt={`Ảnh bài làm câu ${index + 1}`} className="max-h-[28rem] w-full object-contain" />
                              : <div className="p-4 text-sm text-slate-500">Đang tải ảnh bài làm...</div>}
                            <figcaption className="truncate border-t border-slate-200 px-3 py-2 text-xs text-slate-500">{file.name}</figcaption>
                          </figure>
                        ))}
                    </div>
                  </div>
                )}
                {selectedResult.grade.evidenceFiles.some((file) => file.questionId === question.id) && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-800">Lời giải / minh họa của giáo viên</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedResult.grade.evidenceFiles
                        .filter((file) => file.questionId === question.id)
                        .map((file) => (
                          <figure key={file.id} className="overflow-hidden rounded-lg border border-blue-100 bg-blue-50/40">
                            {fileUrls[`evidence:${file.id}`]
                              ? <img src={fileUrls[`evidence:${file.id}`]} alt={`Lời giải giáo viên câu ${index + 1}`} className="max-h-[28rem] w-full object-contain" />
                              : <div className="p-4 text-sm text-slate-500">Đang tải lời giải...</div>}
                            <figcaption className="truncate border-t border-blue-100 px-3 py-2 text-xs text-slate-500">{file.name}</figcaption>
                          </figure>
                        ))}
                    </div>
                  </div>
                )}
                {feedback && (
                  <div className="mt-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Lời phê câu này</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{feedback}</p>
                  </div>
                )}
                {question.explanation && (
                  <div className="mt-3 rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Giải thích của giáo viên</p>
                    <div className="mt-1 text-sm leading-6 text-slate-700"><MathText text={question.explanation} /></div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onAskAI(aiAnalysisPrompt(selectedResult, question, index), selectedResult.subject)}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-semibold text-violet-800 hover:bg-violet-100"
                >
                  <Sparkles className="h-4 w-4" /> Nhờ AI phân tích câu này
                </button>
              </article>
            );
          })}
        </section>
      ))}
    </section>
  );
}
