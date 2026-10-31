import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Award,
  BarChart3,
  Brain,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleX,
  Lightbulb,
  LoaderCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { authenticatedFetch } from '@/auth/authApi';
import {
  listStudentAssignments,
  listStudentExamResults,
  type StudentAssignment,
  type StudentExamResult,
} from '@/api/schoolApi';

interface MyResultsProps {
  studentName: string;
}

interface ProgressResult {
  id: string;
  name: string;
  subject: string;
  date: string;
  score: number;
  recordedAt: string;
  kind: 'Bài tập' | 'Bài kiểm tra';
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(value));
}

function assignmentProgressResult(assignment: StudentAssignment): ProgressResult | null {
  if (assignment.score === null) return null;
  const recordedAt = assignment.gradedAt ?? assignment.submittedAt ?? assignment.dueAt;
  return {
    id: `assignment:${assignment.id}`,
    name: assignment.title,
    subject: assignment.subject,
    date: displayDate(recordedAt),
    score: assignment.score,
    recordedAt,
    kind: 'Bài tập',
  };
}

function examProgressResult(result: StudentExamResult): ProgressResult {
  const maxScore = result.questions.reduce((total, question) => total + question.points, 0);
  return {
    id: `exam:${result.sessionId}`,
    name: result.title,
    subject: result.subject,
    date: displayDate(result.grade.gradedAt),
    score: maxScore > 0 ? (result.grade.totalScore / maxScore) * 10 : 0,
    recordedAt: result.grade.gradedAt,
    kind: 'Bài kiểm tra',
  };
}

export function MyResults({ studentName }: MyResultsProps) {
  const [results, setResults] = useState<ProgressResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('Tất cả');
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  useEffect(() => {
    let active = true;
    async function loadResults() {
      setLoading(true);
      setLoadError('');
      try {
        const [assignments, exams] = await Promise.all([
          listStudentAssignments(),
          listStudentExamResults(),
        ]);
        if (!active) return;
        const activities = [
          ...assignments.flatMap((assignment) => {
            const result = assignmentProgressResult(assignment);
            return result ? [result] : [];
          }),
          ...exams.map(examProgressResult),
        ].sort((first, second) => (
          new Date(second.recordedAt).getTime() - new Date(first.recordedAt).getTime()
        ));
        setResults(activities);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : 'Không thể tải kết quả học tập.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadResults();
    return () => { active = false; };
  }, []);

  const subjectOptions = useMemo(
    () => ['Tất cả', ...new Set(results.map((result) => result.subject))],
    [results],
  );
  const filteredResults = useMemo(
    () => filter === 'Tất cả' ? results : results.filter((result) => result.subject === filter),
    [filter, results],
  );
  const average = results.length
    ? (results.reduce((sum, result) => sum + result.score, 0) / results.length).toFixed(1)
    : '—';
  const trendResults = [...filteredResults].slice(0, 5).reverse();
  const trend = trendResults.map((result) => result.score);
  const trendLabels = trendResults.map((result) => {
    const date = new Date(result.recordedAt);
    return `T.${date.getMonth() + 1} - ${date.getDate()}`;
  });
  const subjectAverages = [...new Set(results.map((result) => result.subject))]
    .map((subject) => {
      const subjectResults = results.filter((result) => result.subject === subject);
      return {
        subject,
        average: subjectResults.reduce((sum, result) => sum + result.score, 0) / subjectResults.length,
        count: subjectResults.length,
      };
    })
    .sort((first, second) => second.average - first.average);
  const strongestSubject = subjectAverages[0];
  const focusSubject = subjectAverages.length > 1 ? subjectAverages[subjectAverages.length - 1] : undefined;
  const subjectCount = subjectAverages.length;
  const passedCount = results.filter((result) => result.score >= 5).length;
  const passRate = results.length ? Math.round((passedCount / results.length) * 100) : 0;
  const subjectPalette: Record<string, { bar: string; badge: string }> = {
    'Toán học': { bar: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700' },
    'Vật lý': { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700' },
    'Ngữ văn': { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-800' },
  };
  const subjectColors: Record<string, string> = {
    'Tất cả': '#4f46e5',
    'Toán học': '#2563eb',
    'Vật lý': '#7c3aed',
    'Ngữ văn': '#f97316',
  };
  const analyzeProgress = async () => {
    if (!results.length || analysisLoading) return;
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const progressSummary = subjectAverages
        .map((item) => `${item.subject}: trung bình ${item.average.toFixed(1)}/10 qua ${item.count} bài`)
        .join('\n');
      const resultSummary = results
        .map((item) => `${item.date} - ${item.subject} - ${item.kind}: ${item.name}: ${item.score.toFixed(1)}/10`)
        .join('\n');
      const response = await authenticatedFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'student',
          userName: studentName,
          subject: focusSubject?.subject ?? 'Học tập',
          message: [
            'Hãy phân tích tiến độ học tập dựa duy nhất trên dữ liệu bài tập và bài kiểm tra đã có điểm dưới đây. Không suy diễn về chuyên cần, thời gian học, dạng câu hỏi hoặc dữ liệu không được cung cấp.',
            `Điểm trung bình chung: ${average}/10; số bài đã có kết quả: ${results.length}.`,
            `Số bài tập đã chấm: ${results.filter((item) => item.kind === 'Bài tập').length}; số bài kiểm tra đã công bố điểm: ${results.filter((item) => item.kind === 'Bài kiểm tra').length}.`,
            'Điểm trung bình theo môn:',
            progressSummary,
            'Kết quả từng bài:',
            resultSummary,
            'Trả lời ngắn gọn bằng tiếng Việt, nêu điểm mạnh và điều cần củng cố có dẫn chứng điểm số, sau đó đề xuất 2 hành động ôn tập cụ thể. Nếu dữ liệu quá ít, hãy nói rõ chưa đủ dữ liệu để kết luận.',
          ].join('\n'),
        }),
      });
      const result: { success: boolean; data?: { reply?: string }; message?: string } = await response.json();
      if (!response.ok || !result.success || !result.data?.reply) {
        throw new Error(result.message || 'EduBot chưa thể phân tích tiến độ lúc này.');
      }
      setAiAnalysis(result.data.reply);
      setSummaryExpanded(true);
      setAnalysisExpanded(true);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Không thể kết nối tới EduBot.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-6 pb-8">
      <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Brain className="h-5 w-5" /></span>
            <div>
              <h1 className="font-bold text-slate-900">AI nhận xét</h1>
              <p className="text-xs text-slate-500">Phân tích kết quả học tập bằng AI</p>
            </div>
          </div>
          <button type="button" onClick={analyzeProgress} disabled={analysisLoading || loading || results.length === 0} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-50">
            {analysisLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analysisLoading ? 'Đang phân tích...' : aiAnalysis ? 'Phân tích lại' : 'Phân tích'}
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard value={loading ? '…' : results.length.toString()} label="Bài đã có điểm" color="text-violet-700" />
            <StatCard value={loading ? '…' : average} suffix={loading ? undefined : '/10'} label="Điểm TB" color="text-blue-700" />
            <StatCard value={loading ? '…' : subjectCount.toString()} label="Môn học" color="text-emerald-700" />
          </div>

          {loadError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</p>}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {aiAnalysis ? (
              <p className="whitespace-pre-line">{aiAnalysis}</p>
            ) : (
              <span>
                {loading
                  ? 'Đang tổng hợp kết quả bài tập và bài kiểm tra đã có điểm…'
                  : strongestSubject && focusSubject
                    ? <>Dựa trên {results.length} bài đã có điểm, môn {strongestSubject.subject} đang có điểm trung bình cao nhất; {focusSubject.subject} có thể cần thêm thời gian ôn tập.</>
                    : strongestSubject
                      ? <>Môn {strongestSubject.subject} có điểm trung bình {strongestSubject.average.toFixed(1)}/10 qua {strongestSubject.count} bài có điểm.</>
                    : 'Hoàn thành bài tập hoặc bài kiểm tra và chờ giáo viên chấm/công bố điểm để xem tiến độ.'}
              </span>
            )}
            {summaryExpanded && (
              !aiAnalysis && <p className="mt-2 text-slate-600">
                Điểm trung bình hiện tại là {average}/10 qua {results.length} bài đã được chấm hoặc công bố điểm.
              </p>
            )}
            {results.length > 0 && (
              <button type="button" onClick={() => setSummaryExpanded((expanded) => !expanded)} className="ml-1 inline-flex items-center gap-1 font-semibold text-violet-700 hover:text-violet-900">
                {summaryExpanded ? 'Thu gọn' : 'Xem thêm'}
              </button>
            )}
          </div>

          {analysisError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{analysisError}</p>}

          {!aiAnalysis && results.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-center text-sm font-medium leading-6 text-amber-900">
              {strongestSubject
                ? `Môn ${strongestSubject.subject} đang có điểm trung bình ${strongestSubject.average.toFixed(1)}/10 qua ${strongestSubject.count} bài có điểm.`
                : 'Chưa có đủ dữ liệu kết quả để nhận xét.'}
            </div>
          )}

          <button type="button" aria-expanded={analysisExpanded} onClick={() => setAnalysisExpanded((expanded) => !expanded)} className="flex w-full items-center justify-center gap-2 py-1 text-sm font-semibold text-violet-700 hover:text-violet-900">
            {analysisExpanded ? 'Ẩn phân tích chi tiết' : 'Xem phân tích chi tiết'}
            {analysisExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {analysisExpanded && (
            <div className="space-y-4 border-t border-violet-100 pt-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <h2 className="flex items-center gap-2 font-bold text-emerald-800"><TrendingUp className="h-4 w-4" />Điểm mạnh</h2>
                  {strongestSubject && (
                    <>
                      <p className="mt-3 font-semibold text-emerald-900">{strongestSubject.subject} - {strongestSubject.average.toFixed(1)}/10</p>
                      <p className="mt-1 text-sm leading-5 text-slate-700">Đây là môn có điểm trung bình cao nhất trong {strongestSubject.count} kết quả hiện có.</p>
                    </>
                  )}
                </article>
                <article className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                  <h2 className="flex items-center gap-2 font-bold text-rose-800"><Lightbulb className="h-4 w-4" />Cần củng cố</h2>
                  {focusSubject && (
                    <>
                      <p className="mt-3 font-semibold text-rose-900">{focusSubject.subject} - {focusSubject.average.toFixed(1)}/10</p>
                      <p className="mt-1 text-sm leading-5 text-slate-700">Đây là môn có điểm trung bình thấp nhất trong {focusSubject.count} kết quả hiện có.</p>
                    </>
                  )}
                </article>
              </div>
              {!aiAnalysis && (
                <p className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 text-sm leading-6 text-violet-900">
                  Nhấn “Phân tích” để nhận gợi ý ôn tập dựa trên các kết quả đang hiển thị.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="grid items-stretch gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Award className="h-5 w-5" /></span>
              <div>
                <h2 className="font-bold text-slate-900">Thành tích theo môn</h2>
                <p className="text-xs text-slate-500">{subjectCount} môn học</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-5 space-y-5">
            {subjectAverages.map((item) => {
              const palette = subjectPalette[item.subject] ?? { bar: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700' };
              const rating = item.average >= 8.5 ? 'Giỏi' : item.average >= 7 ? 'Khá' : 'Cần cố gắng';
              return (
                <div key={item.subject}>
                  <div className="mb-2 flex items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-800">{item.subject}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${palette.badge}`}>{rating}</span>
                    <span className="ml-auto text-xs text-slate-500">{item.count} bài</span>
                    <strong className="text-sm tabular-nums text-slate-800">{item.average.toFixed(1)}<span className="font-normal text-slate-400">/10</span></strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${palette.bar}`} style={{ width: `${item.average * 10}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><BarChart3 className="h-5 w-5" /></span>
              <div>
                <h2 className="font-bold text-slate-900">Lịch sử kết quả</h2>
                <p className="text-xs text-slate-500">{results.length} bài đã làm</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 p-4">
            <ResultSummary icon={<CircleCheck className="h-4 w-4" />} label="Đạt" value={loading ? '…' : passedCount} tone="emerald" />
            <ResultSummary icon={<CircleX className="h-4 w-4" />} label="Chưa đạt" value={loading ? '…' : results.length - passedCount} tone="slate" />
            <ResultSummary icon={<TrendingUp className="h-4 w-4" />} label="Tỷ lệ đạt" value={loading ? '…' : `${passRate}%`} tone="blue" />
          </div>
          <div className="px-4">
            <p className="mb-1 text-xs font-medium text-slate-500">Xu hướng điểm số</p>
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Đang tải kết quả…</p>
            ) : filteredResults.length ? (
              <ScoreTrendChart values={trend} labels={trendLabels} color={subjectColors[filter] ?? '#4f46e5'} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                {loadError ? 'Không thể hiển thị kết quả khi dữ liệu chưa tải được.' : 'Chưa có kết quả được chấm hoặc công bố cho môn này.'}
              </p>
            )}
          </div>
          <div className="mt-2 border-t border-slate-100">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Kết quả gần đây</h3>
              <label>
                <span className="sr-only">Lọc kết quả theo môn</span>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 outline-none transition hover:border-violet-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                >
                  {subjectOptions.map((option) => <option key={option} value={option}>{option === 'Tất cả' ? 'Tất cả môn' : option}</option>)}
                </select>
              </label>
            </div>
            {filteredResults.slice(0, 4).map((result) => (
              <div key={result.id} className="flex items-center gap-3 border-t border-slate-100 px-4 py-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${result.score >= 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{result.score.toFixed(1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold uppercase text-slate-800">{result.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{result.kind} · {result.subject} - {result.date}</p>
                </div>
                <span className={`text-xs font-semibold ${result.score >= 5 ? 'text-emerald-700' : 'text-rose-700'}`}>{result.score >= 5 ? 'Đạt' : 'Chưa đạt'}</span>
              </div>
            ))}
            {!loading && !filteredResults.length && !loadError && (
              <p className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-500">
                Chưa có bài tập được chấm hoặc bài kiểm tra được công bố điểm.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ value, suffix, label, color }: { value: string; suffix?: string; label: string; color: string }) {
  return (
    <article className="flex min-h-20 flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-center">
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}{suffix && <span className="ml-0.5 text-xs font-medium text-slate-400">{suffix}</span>}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </article>
  );
}

function ResultSummary({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number | string; tone: 'emerald' | 'slate' | 'blue' }) {
  const tones = {
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
  };

  return (
    <article className={`flex min-h-16 flex-col items-center justify-center rounded-xl border p-2 ${tones[tone]}`}>
      <span className="flex items-center gap-1 text-[11px]">{icon}{label}</span>
      <strong className="mt-0.5 text-lg">{value}</strong>
    </article>
  );
}

function ScoreTrendChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const width = 720;
  const height = 220;
  const padding = { top: 18, right: 18, bottom: 36, left: 36 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const minScore = 0;
  const maxScore = 10;
  const coordinates = values.map((value, index) => ({
    x: padding.left + (index / Math.max(values.length - 1, 1)) * chartWidth,
    y: padding.top + ((maxScore - Math.min(maxScore, Math.max(minScore, value))) / (maxScore - minScore)) * chartHeight,
    value,
  }));
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="mt-4 w-full overflow-hidden" role="img" aria-label={`Biểu đồ xu hướng điểm: ${values.join(', ')}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" preserveAspectRatio="none">
        {[0, 2, 4, 6, 8, 10].map((score) => {
          const y = padding.top + ((maxScore - score) / (maxScore - minScore)) * chartHeight;
          return (
            <g key={score}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray={score === 0 ? undefined : '4 5'} />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{score}</text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point, index) => (
          <g key={`${labels[index]}-${index}`}>
            <circle cx={point.x} cy={point.y} r="5" fill="white" stroke={color} strokeWidth="3" />
            <text x={point.x} y={point.y - 12} textAnchor="middle" fill="#334155" fontSize="11" fontWeight="600">{point.value.toFixed(1)}</text>
            <text x={point.x} y={height - 10} textAnchor="middle" fill="#94a3b8" fontSize="10">{labels[index]}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
