import { useState } from 'react';
import { Sparkles, Wand2, Copy, Check, RefreshCw, Download, ChevronDown, ChevronRight, BookOpen, GraduationCap, Layers, Target, Lightbulb, Plus, Trash2, FileText } from 'lucide-react';
import type { QuizQuestion } from '@/types';

interface GeneratedQuestionSet {
  topic: string;
  subject: string;
  grade: string;
  questions: QuizQuestion[];
}

const subjects = ['Toán học', 'Vật lý', 'Hóa học', 'Sinh học', 'Ngữ văn', 'Lịch sử', 'Địa lý', 'Tiếng Anh'];
const difficulties = [
  { value: 'easy', label: 'Dễ', activeClass: 'bg-green-50 border-green-300 text-green-700' },
  { value: 'medium', label: 'Trung bình', activeClass: 'bg-amber-50 border-amber-300 text-amber-700' },
  { value: 'hard', label: 'Khó', activeClass: 'bg-rose-50 border-rose-300 text-rose-700' },
] as const;

const difficultyStyle: Record<string, { badge: string; dot: string }> = {
  easy: { badge: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  medium: { badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  hard: { badge: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
};

export function AIQuizGenerator({ onSaveQuestions }: { onSaveQuestions: (set: GeneratedQuestionSet) => void }) {
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('Toán học');
  const [grade, setGrade] = useState('Khối 10');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setQuestions([]);
    setError('');
    try {
      const response = await fetch('/api/ai/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, grade, topic, quantity: numQuestions, difficulty }),
      });
      const result: { success: boolean; data?: QuizQuestion[]; message?: string } = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Không thể tạo câu hỏi.');
      }
      setQuestions(result.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối tới AI server.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = () => {
    const text = questions.map((q, i) =>
      `Câu ${i + 1}: ${q.question}\n${q.options.map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`).join('\n')}\nĐáp án: ${String.fromCharCode(65 + q.correctIndex)}\nGiải thích: ${q.explanation}\n`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-${subject}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config panel */}
        <div className="lg:col-span-1">
          <div className="card p-4 sticky top-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Tạo câu hỏi AI</h3>
                <p className="text-sm text-slate-400">Cấu hình bộ đề</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  Môn học
                </label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field cursor-pointer">
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  Khối lớp
                </label>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className="input-field cursor-pointer">
                  {['Khối 10','Khối 11','Khối 12'].map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-slate-400" />
                  Chủ đề / Nội dung
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="VD: Hàm số bậc hai và đồ thị parabol..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Mức độ khó
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {difficulties.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDifficulty(d.value)}
                      className={`px-2 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                        difficulty === d.value ? d.activeClass : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Số câu hỏi
                  </span>
                  <span className="text-blue-600 font-semibold tabular-nums">{numQuestions}</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={15}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-sm text-slate-400 mt-0.5">
                  <span>3</span>
                  <span>15</span>
                </div>
              </div>

              <button onClick={handleGenerate} disabled={!topic.trim() || generating} className="btn-primary w-full py-2">
                {generating ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang tạo...</>
                ) : (
                  <><Wand2 className="w-3.5 h-3.5" /> Tạo câu hỏi</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          {generating ? (
            <GeneratingSkeleton num={numQuestions} />
          ) : error ? (
            <div className="card p-10 text-center text-sm text-rose-600">{error}</div>
          ) : questions.length > 0 ? (
            <div className="space-y-3">
              <div className="card px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-green-50 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Đã tạo {questions.length} câu hỏi</p>
                    <p className="text-sm text-slate-400">{subject} • {grade} • {difficulties.find((d) => d.value === difficulty)?.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={handleGenerate} className="btn-ghost">
                    <RefreshCw className="w-3.5 h-3.5" /> Tạo lại
                  </button>
                  <button onClick={handleDownload} className="btn-outline">
                    <Download className="w-3.5 h-3.5" /> Tải xuống
                  </button>
                  <button onClick={() => onSaveQuestions({ topic, subject, grade, questions })} className="btn-primary">
                    <Plus className="w-3.5 h-3.5" /> Lưu vào ngân hàng
                  </button>
                </div>
              </div>

              {questions.map((q, i) => {
                const expanded = expandedId === q.id;
                const ds = difficultyStyle[q.difficulty];
                return (
                  <div key={q.id} className="card overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 font-semibold text-sm flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-medium text-slate-800 text-sm leading-relaxed">{q.question}</p>
                            <span className={`badge ${ds.badge} shrink-0`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${ds.dot}`} />
                              {difficulties.find((d) => d.value === q.difficulty)?.label}
                            </span>
                          </div>
                          <div className="space-y-1.5 mt-2.5">
                            {q.options.map((opt, j) => (
                              <div
                                key={j}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
                                  expanded && j === q.correctIndex
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-slate-50 border-transparent'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded flex items-center justify-center text-sm font-semibold shrink-0 ${
                                  expanded && j === q.correctIndex ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'
                                }`}>
                                  {String.fromCharCode(65 + j)}
                                </span>
                                <span className={expanded && j === q.correctIndex ? 'text-green-800 font-medium' : 'text-slate-600'}>
                                  {opt}
                                </span>
                                {expanded && j === q.correctIndex && <Check className="w-3.5 h-3.5 text-green-600 ml-auto" />}
                              </div>
                            ))}
                          </div>

                          {expanded && (
                            <div className="mt-2.5 p-3 rounded-md bg-amber-50 border border-amber-100 animate-fadeIn">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-semibold text-amber-700 mb-0.5">Giải thích</p>
                                  <p className="text-sm text-amber-900/80 leading-relaxed">{q.explanation}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                      <button
                        onClick={() => setExpandedId(expanded ? null : q.id)}
                        className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        {expanded ? 'Thu gọn' : 'Xem đáp án'}
                      </button>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => handleCopy(q.id)} className="p-1.5 rounded text-slate-400 hover:bg-white hover:text-blue-600 transition-colors">
                          {copiedId === q.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button className="p-1.5 rounded text-slate-400 hover:bg-white hover:text-rose-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

function GeneratingSkeleton({ num }: { num: number }) {
  return (
    <div className="space-y-3">
      <div className="card px-4 py-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
        </div>
        <div>
          <p className="font-semibold text-slate-800 text-sm">AI đang tạo câu hỏi...</p>
          <p className="text-sm text-slate-400">Phân tích chủ đề và tạo bộ đề</p>
        </div>
      </div>
      {Array.from({ length: Math.min(num, 4) }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-md bg-slate-100 animate-pulse" />
            <div className="flex-1 space-y-2.5">
              <div className="h-4 rounded bg-slate-100 animate-pulse w-3/4" />
              <div className="space-y-1.5">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="h-8 rounded-md bg-slate-50 animate-pulse" style={{ animationDelay: `${j * 80}ms` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-10 flex flex-col items-center text-center min-h-[400px] justify-center">
      <div className="w-14 h-14 rounded-md bg-slate-100 flex items-center justify-center">
        <Wand2 className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-800 mt-4">Tạo câu hỏi trắc nghiệm bằng AI</h3>
      <p className="text-sm text-slate-400 mt-1.5 max-w-sm">
        Nhập chủ đề và cấu hình bộ đề ở bảng bên trái. AI sẽ tạo câu hỏi kèm đáp án và giải thích.
      </p>
      <div className="mt-5 flex flex-wrap gap-1.5 justify-center">
        {['Hàm số bậc hai', 'Định luật Ohm', 'Thế chiến II', 'Passive Voice'].map((t) => (
          <span key={t} className="badge bg-slate-100 text-slate-500 border border-slate-200">{t}</span>
        ))}
      </div>
    </div>
  );
}
