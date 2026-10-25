import { useMemo, useState } from 'react';
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
import { studentResults as results } from './studentResults';

const subjectOptions = ['Tất cả', 'Toán học', 'Vật lý', 'Ngữ văn'];
const weeks = ['T.9 - 21', 'T.9 - 28', 'T.10 - 5', 'T.10 - 12', 'T.10 - 19'];
const trendBySubject: Record<string, number[]> = {
  'Tất cả': [7.3, 7.6, 7.7, 8, 8.5],
  'Toán học': [7, 7.4, 7.5, 8, 8.5],
  'Vật lý': [7.5, 7.7, 8, 8.2, 8.8],
  'Ngữ văn': [7.4, 7.6, 7.7, 7.8, 8],
};

const subjectColors: Record<string, string> = {
  'Tất cả': '#4f46e5',
  'Toán học': '#2563eb',
  'Vật lý': '#7c3aed',
  'Ngữ văn': '#f97316',
};

export function MyResults() {
  const [filter, setFilter] = useState('Tất cả');
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const filteredResults = useMemo(
    () => filter === 'Tất cả' ? results : results.filter((result) => result.subject === filter),
    [filter],
  );
  const average = (results.reduce((sum, result) => sum + result.score, 0) / results.length).toFixed(1);
  const trend = trendBySubject[filter];
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
  const focusSubject = subjectAverages[subjectAverages.length - 1];
  const subjectCount = subjectAverages.length;
  const passedCount = results.filter((result) => result.score >= 5).length;
  const passRate = Math.round((passedCount / results.length) * 100);
  const subjectPalette: Record<string, { bar: string; badge: string }> = {
    'Toán học': { bar: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700' },
    'Vật lý': { bar: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700' },
    'Ngữ văn': { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-800' },
  };
  const analyzeProgress = async () => {
    setAnalysisLoading(true);
    setAnalysisError('');
    try {
      const progressSummary = subjectAverages
        .map((item) => `${item.subject}: trung bình ${item.average.toFixed(1)}/10 qua ${item.count} bài`)
        .join('\n');
      const resultSummary = results
        .map((item) => `${item.date} - ${item.subject} - ${item.name}: ${item.score}/10`)
        .join('\n');
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'student',
          userName: 'Minh Anh',
          subject: focusSubject?.subject ?? 'Học tập',
          message: [
            'Hãy phân tích tiến độ học tập dựa trên dữ liệu dưới đây, không tự suy diễn thêm dữ liệu.',
            `Điểm trung bình chung: ${average}/10; số bài đã có kết quả: ${results.length}.`,
            'Điểm trung bình theo môn:',
            progressSummary,
            'Kết quả từng bài:',
            resultSummary,
            'Trả lời ngắn gọn bằng tiếng Việt, gồm điểm tiến bộ/điểm mạnh có bằng chứng từ dữ liệu, nội dung cần củng cố và 2 gợi ý hành động cụ thể, thân thiện với học sinh.',
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
          <button type="button" onClick={analyzeProgress} disabled={analysisLoading} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-80">
            {analysisLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analysisLoading ? 'Đang phân tích...' : aiAnalysis ? 'Phân tích lại' : 'Phân tích'}
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard value={results.length.toString()} label="Bài đã làm" color="text-violet-700" />
            <StatCard value={average} suffix="/10" label="Điểm TB" color="text-blue-700" />
            <StatCard value={subjectCount.toString()} label="Môn học" color="text-emerald-700" />
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {aiAnalysis ? (
              <p className="whitespace-pre-line">{aiAnalysis}</p>
            ) : (
              <span>
                {strongestSubject && focusSubject
                  ? <>Em thể hiện sự ổn định trong môn {strongestSubject.subject} với điểm trung bình cao hơn; {focusSubject.subject} có thể cần thêm thời gian ôn tập.</>
                  : 'Hoàn thành thêm bài kiểm tra để xem nhận xét học tập.'}
              </span>
            )}
            {summaryExpanded && (
              !aiAnalysis && <p className="mt-2 text-slate-600">
                Điểm trung bình hiện tại là {average}/10 qua {results.length} bài. Hãy xem lại các câu chưa chắc và duy trì lịch ôn đều cho từng môn.
              </p>
            )}
            <button type="button" onClick={() => setSummaryExpanded((expanded) => !expanded)} className="ml-1 inline-flex items-center gap-1 font-semibold text-violet-700 hover:text-violet-900">
              {summaryExpanded ? 'Thu gọn' : 'Xem thêm'}
            </button>
          </div>

          {analysisError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{analysisError}</p>}

          {!aiAnalysis && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-center text-sm font-medium leading-6 text-amber-900">
              {strongestSubject
                ? `Chúc mừng em đã có kết quả tốt ở môn ${strongestSubject.subject}. Hãy tiếp tục phát huy và kiên trì ôn luyện những nội dung còn khó nhé!`
                : 'Cố gắng duy trì thói quen học tập đều đặn nhé!'}
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
                      <p className="mt-1 text-sm leading-5 text-slate-700">Em đang có kết quả tốt ở môn này qua {strongestSubject.count} bài. Hãy duy trì cách ôn tập hiện tại.</p>
                    </>
                  )}
                </article>
                <article className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                  <h2 className="flex items-center gap-2 font-bold text-rose-800"><Lightbulb className="h-4 w-4" />Cần củng cố</h2>
                  {focusSubject && (
                    <>
                      <p className="mt-3 font-semibold text-rose-900">{focusSubject.subject} - {focusSubject.average.toFixed(1)}/10</p>
                      <p className="mt-1 text-sm leading-5 text-slate-700">Thử ôn lại phần kiến thức chưa chắc và làm thêm bài tập cùng dạng.</p>
                    </>
                  )}
                </article>
              </div>
              <article className="rounded-2xl border border-violet-200 p-4">
                <h2 className="font-bold text-violet-800">Kế hoạch học tập đề xuất</h2>
                <div className="mt-3 space-y-3">
                  {[focusSubject, strongestSubject].filter((item): item is NonNullable<typeof item> => Boolean(item)).map((item, index) => (
                    <div key={item.subject} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{index + 1}</span>
                      <p className="text-sm leading-5 text-slate-700">
                        <strong>{index === 0 ? `Tập trung ôn ${item.subject}` : `Duy trì ${item.subject}`}</strong>
                        {' '}— {index === 0 ? 'chia nội dung thành các phần nhỏ và luyện đều mỗi tuần.' : 'tiếp tục luyện tập để giữ vững kết quả.'}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
              <article className="rounded-2xl border border-violet-200 p-4">
                <h2 className="font-bold text-violet-800">Phân tích theo dạng bài</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700">Làm tốt</p>
                    <p className="mt-1 font-semibold text-emerald-900">Câu hỏi nhận biết</p>
                    <p className="text-xs text-emerald-700">Độ chính xác: 81%</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-700">Cần luyện thêm</p>
                    <p className="mt-1 font-semibold text-amber-900">Bài tập vận dụng</p>
                    <p className="text-xs text-amber-700">Độ chính xác: 64%</p>
                  </div>
                </div>
              </article>
              <article className="rounded-2xl border border-violet-200 p-4">
                <h2 className="font-bold text-violet-800">Thói quen học tập</h2>
                <p className="mt-1 text-xs text-slate-500">Thời gian hoàn thành bài theo buổi</p>
                <div className="mt-4 space-y-3">
                  {[['Sáng', 15], ['Chiều', 25], ['Tối', 60]].map(([label, value]) => (
                    <div key={label}>
                      <div className="mb-1 flex justify-between text-xs text-slate-600"><span>{label}</span><span>{value}%</span></div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${value}%` }} /></div>
                    </div>
                  ))}
                </div>
              </article>
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
                <h2 className="font-bold text-slate-900">Lịch sử bài thi</h2>
                <p className="text-xs text-slate-500">{results.length} bài đã làm</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 p-4">
            <ResultSummary icon={<CircleCheck className="h-4 w-4" />} label="Đạt" value={passedCount} tone="emerald" />
            <ResultSummary icon={<CircleX className="h-4 w-4" />} label="Chưa đạt" value={results.length - passedCount} tone="slate" />
            <ResultSummary icon={<TrendingUp className="h-4 w-4" />} label="Tỷ lệ đạt" value={`${passRate}%`} tone="blue" />
          </div>
          <div className="px-4">
            <p className="mb-1 text-xs font-medium text-slate-500">Xu hướng điểm số</p>
            <ScoreTrendChart values={trend} labels={weeks} color={subjectColors[filter]} />
          </div>
          <div className="mt-2 border-t border-slate-100">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Bài thi gần đây</h3>
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
                  <p className="mt-0.5 text-[11px] text-slate-500">{result.subject} - {result.date}</p>
                </div>
                <span className={`text-xs font-semibold ${result.score >= 5 ? 'text-emerald-700' : 'text-rose-700'}`}>{result.score >= 5 ? 'Đạt' : 'Chưa đạt'}</span>
              </div>
            ))}
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
  const minScore = 5;
  const maxScore = 10;
  const coordinates = values.map((value, index) => ({
    x: padding.left + (index / Math.max(values.length - 1, 1)) * chartWidth,
    y: padding.top + ((maxScore - value) / (maxScore - minScore)) * chartHeight,
    value,
  }));
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <div className="mt-4 w-full overflow-hidden" role="img" aria-label={`Biểu đồ xu hướng điểm: ${values.join(', ')}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" preserveAspectRatio="none">
        {[5, 6, 7, 8, 9, 10].map((score) => {
          const y = padding.top + ((maxScore - score) / (maxScore - minScore)) * chartHeight;
          return (
            <g key={score}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray={score === 5 ? undefined : '4 5'} />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{score}</text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point, index) => (
          <g key={labels[index]}>
            <circle cx={point.x} cy={point.y} r="5" fill="white" stroke={color} strokeWidth="3" />
            <text x={point.x} y={point.y - 12} textAnchor="middle" fill="#334155" fontSize="11" fontWeight="600">{point.value.toFixed(1)}</text>
            <text x={point.x} y={height - 10} textAnchor="middle" fill="#94a3b8" fontSize="10">{labels[index]}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
