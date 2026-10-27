import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, BookOpen, Clock3, RefreshCw, Settings2, Sparkles, Target, WandSparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import type { QuizQuestion } from '@/types';
import { saveItem } from './savedItems';
import { authenticatedFetch } from '@/auth/authApi';

type PracticeMode = 'practice' | 'test';
type PracticePhase = 'setup' | 'ready' | 'answering' | 'results';

const subjects = [
  { name: 'Toán học', icon: '∑', description: 'Luyện công thức và giải bài từng bước', color: 'from-blue-600 to-sky-600', surface: 'bg-blue-50 text-blue-700' },
  { name: 'Ngữ văn', icon: '文', description: 'Ôn tác phẩm, đọc hiểu và cách viết', color: 'from-amber-400 to-yellow-500', surface: 'bg-amber-50 text-amber-700' },
  { name: 'Vật lý', icon: 'ϟ', description: 'Hiểu định luật qua ví dụ và bài tập', color: 'from-violet-600 to-purple-600', surface: 'bg-violet-50 text-violet-700' },
  { name: 'Hóa học', icon: '⚗', description: 'Ôn phản ứng, nguyên tố và tính toán', color: 'from-pink-500 to-rose-500', surface: 'bg-pink-50 text-pink-700' },
  { name: 'Tiếng Anh', icon: 'A', description: 'Luyện từ vựng, ngữ pháp và giao tiếp', color: 'from-green-500 to-emerald-600', surface: 'bg-green-50 text-green-700' },
  { name: 'Tin học', icon: '</>', description: 'Rèn tư duy máy tính và kỹ năng số', color: 'from-sky-500 to-cyan-600', surface: 'bg-sky-50 text-sky-700' },
  { name: 'Sinh học', icon: '⌘', description: 'Khám phá cơ thể sống và tự nhiên', color: 'from-lime-400 to-green-500', surface: 'bg-lime-50 text-lime-700' },
  { name: 'Lịch sử', icon: '◷', description: 'Ghi nhớ sự kiện và hiểu dòng thời gian', color: 'from-orange-500 to-amber-500', surface: 'bg-orange-50 text-orange-700' },
];

const topicSuggestions: Record<string, string[]> = {
  'Toán học': ['Hàm số bậc hai', 'Phương trình và hệ phương trình'],
  'Ngữ văn': ['Truyện dân gian Việt Nam', 'Viết bài văn nghị luận'],
  'Vật lý': ['Định luật Newton', 'Chuyển động thẳng'],
  'Hóa học': ['Cấu tạo nguyên tử', 'Bảng tuần hoàn'],
  'Tiếng Anh': ['Từ vựng Unit 4', 'Thì hiện tại và quá khứ'],
  'Tin học': ['Mạng máy tính và Internet', 'Thông tin và dữ liệu'],
  'Sinh học': ['Tế bào nhân thực', 'Trao đổi chất ở tế bào'],
  'Lịch sử': ['Văn minh cổ đại', 'Các quốc gia cổ đại'],
};

function normalizePrompt(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi');
}

function detectPromptSubject(prompt: string) {
  const normalizedPrompt = normalizePrompt(prompt);
  const aliases: Record<string, string[]> = {
    'Toán học': ['toan', 'toan hoc'],
    'Ngữ văn': ['ngu van', 'van hoc', 'van'],
    'Vật lý': ['vat ly', 'vat li', 'ly', 'li'],
    'Hóa học': ['hoa hoc', 'hoa'],
    'Tiếng Anh': ['tieng anh', 'english'],
    'Tin học': ['tin hoc', 'tin'],
    'Sinh học': ['sinh hoc', 'sinh'],
    'Lịch sử': ['lich su', 'su'],
  };
  const promptWords = normalizedPrompt.split(/\s+/);
  return Object.entries(aliases).find(([, words]) => words.some((word) => (
    word.includes(' ') ? normalizedPrompt.includes(word) : promptWords.includes(word)
  )))?.[0] ?? '';
}

export function AIPractice({
  onExit,
  initialSubject = '',
  initialTopic = '',
  initialQuestions = [],
  initialMode = 'practice',
}: {
  onExit?: () => void;
  initialSubject?: string;
  initialTopic?: string;
  initialQuestions?: QuizQuestion[];
  initialMode?: PracticeMode;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [mode, setMode] = useState<PracticeMode>(initialMode);
  const [topic, setTopic] = useState(initialTopic);
  const [naturalPrompt, setNaturalPrompt] = useState(initialTopic);
  const [quantity, setQuantity] = useState(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [testMinutes, setTestMinutes] = useState(15);
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<PracticePhase>(initialQuestions.length > 0 ? 'ready' : 'setup');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [isSample, setIsSample] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'test' || phase !== 'answering') return undefined;
    if (timeLeft <= 0) {
      setPhase('results');
      return undefined;
    }
    const timer = window.setTimeout(() => setTimeLeft((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [mode, phase, timeLeft]);

  const resetAttempt = () => {
    setAnswers({});
    setCurrentIndex(0);
    setTimeLeft(testMinutes * 60);
  };

  const generateQuestions = async (overrides: { subject?: string; topic?: string; quantity?: number } = {}) => {
    const requestSubject = overrides.subject ?? subject;
    const requestTopic = overrides.topic ?? topic;
    const requestQuantity = overrides.quantity ?? quantity;
    if (!requestTopic.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/ai/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: requestSubject,
          topic: requestTopic.trim(),
          quantity: requestQuantity,
          difficulty,
        }),
      });
      const result: { success: boolean; data?: QuizQuestion[]; message?: string } = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.data) || result.data.length === 0) {
        throw new Error(result.message || 'Chưa tạo được câu hỏi. Em thử lại nhé.');
      }
      setSubject(requestSubject || 'Tổng hợp');
      setTopic(requestTopic.trim());
      setQuestions(result.data);
      setIsSample(false);
      resetAttempt();
      setPhase('ready');
      saveItem({
        id: `quiz-${Date.now()}`,
        type: 'quiz',
        title: requestTopic.trim(),
        subject: requestSubject || 'Tổng hợp',
        topic: requestTopic.trim(),
        questionCount: result.data.length,
        mode,
        savedAt: new Date().toISOString(),
        questions: result.data,
      });
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Không thể kết nối tới AI server.');
    } finally {
      setGenerating(false);
    }
  };

  const loadSampleQuestions = () => {
    const sampleQuestions: QuizQuestion[] = [
      {
        id: 'sample-1',
        question: `Khi học chủ đề “${topic.trim() || 'kiến thức mới'}” trong môn ${subject}, cách nào giúp em bắt đầu giải bài hiệu quả?`,
        options: ['Đọc kỹ yêu cầu và xác định dữ kiện đã cho', 'Chọn đáp án bất kỳ trước khi đọc đề', 'Bỏ qua các khái niệm liên quan', 'Ghi lại mọi công thức mà không xem đề'],
        correctIndex: 0,
        explanation: 'Đọc kỹ đề giúp em xác định cần tìm gì và chọn kiến thức phù hợp.',
        difficulty: 'easy',
      },
      {
        id: 'sample-2',
        question: 'Sau khi chọn được cách giải, em nên làm gì để hạn chế sai sót?',
        options: ['Kiểm tra lại từng bước và đối chiếu với yêu cầu', 'Bỏ qua đơn vị và điều kiện', 'Chỉ xem đáp án cuối', 'Dừng ngay khi có kết quả đầu tiên'],
        correctIndex: 0,
        explanation: 'Kiểm tra lại từng bước giúp phát hiện lỗi tính toán hoặc bỏ sót điều kiện.',
        difficulty: 'medium',
      },
      {
        id: 'sample-3',
        question: 'Nếu chưa hiểu một câu hỏi, lựa chọn nào phù hợp nhất?',
        options: ['Tách câu hỏi thành ý nhỏ và xem lại kiến thức liên quan', 'Bỏ luôn câu hỏi', 'Chọn đáp án theo cảm tính', 'Chép lời giải mà không đọc'],
        correctIndex: 0,
        explanation: 'Chia nhỏ vấn đề và kết nối với kiến thức đã học là cách tốt để tự tìm lời giải.',
        difficulty: 'medium',
      },
    ];
    setQuestions(sampleQuestions);
    setIsSample(true);
    resetAttempt();
    setPhase('ready');
    setError('');
  };

  const startAttempt = () => {
    resetAttempt();
    setPhase('answering');
  };

  const submitAttempt = () => setPhase('results');

  const correctCount = questions.filter((question) => answers[question.id] === question.correctIndex).length;
  const selectedSubject = subjects.find((item) => item.name === subject);
  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const changeMode = (nextMode: PracticeMode) => {
    setMode(nextMode);
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setPhase('setup');
    setIsSample(false);
  };

  const submitNaturalPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = naturalPrompt.trim();
    if (!prompt) return;
    const countMatch = normalizePrompt(prompt).match(/(\d{1,2})\s*cau\b/);
    const requestedQuantity = countMatch ? Math.max(1, Math.min(20, Number(countMatch[1]))) : quantity;
    const requestedSubject = subject || detectPromptSubject(prompt);
    void generateQuestions({ subject: requestedSubject, topic: prompt, quantity: requestedQuantity });
  };

  return (
    <div className="animate-fadeIn space-y-5">
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" /> Thoát
        </button>
      )}
      {phase === 'setup' && questions.length === 0 ? (
        <section className="mx-auto max-w-3xl space-y-5" aria-label="Tạo bài luyện bằng AI">
          <header className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-8 shadow-sm sm:px-9 sm:py-10">
            <div className="mx-auto max-w-3xl text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-200">
                <Sparkles className="h-7 w-7" />
              </span>
              <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-blue-800 sm:text-4xl">AI Ôn luyện</h1>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Mô tả bài em muốn luyện, EduBot sẽ chuẩn bị câu hỏi phù hợp.
              </p>
            </div>
          </header>
          <form onSubmit={submitNaturalPrompt} className="card space-y-4 p-5 sm:p-6">
            <label htmlFor="practice-natural-prompt" className="block text-sm font-semibold text-slate-800">Em muốn luyện nội dung gì?</label>
            <textarea
              id="practice-natural-prompt"
              value={naturalPrompt}
              onChange={(event) => setNaturalPrompt(event.target.value)}
              placeholder="Ví dụ: Luyện 5 câu Lý Newton"
              rows={3}
              className="input-field min-h-24 resize-y"
            />
            <p className="-mt-2 text-xs text-slate-500">Có thể ghi số câu trong yêu cầu; tối đa 20 câu mỗi lần tạo.</p>
            <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">Tùy chọn nâng cao</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Môn học (không bắt buộc)
                  <select value={subject} onChange={(event) => setSubject(event.target.value)} className="input-field mt-2">
                    <option value="">Để AI tự nhận diện</option>
                    {subjects.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Mức độ
                  <select className="input-field mt-2" value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>
                    <option value="easy">Dễ</option>
                    <option value="medium">Vừa sức</option>
                    <option value="hard">Thử thách</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Số câu mặc định
                  <select className="input-field mt-2" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>
                    <option value={5}>5 câu</option>
                    <option value={10}>10 câu</option>
                    <option value={15}>15 câu</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Hình thức
                  <select className="input-field mt-2" value={mode} onChange={(event) => setMode(event.target.value as PracticeMode)}>
                    <option value="practice">Luyện tập</option>
                    <option value="test">Làm đề có tính giờ</option>
                  </select>
                </label>
                {mode === 'test' && (
                  <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                    Thời gian làm đề
                    <select className="input-field mt-2" value={testMinutes} onChange={(event) => setTestMinutes(Number(event.target.value))}>
                      <option value={10}>10 phút</option>
                      <option value={15}>15 phút</option>
                      <option value={30}>30 phút</option>
                    </select>
                  </label>
                )}
              </div>
            </details>
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <button type="submit" disabled={!naturalPrompt.trim() || generating} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              {generating ? 'Đang tạo câu hỏi...' : mode === 'practice' ? 'Tạo bài luyện' : 'Tạo đề kiểm tra'}
            </button>
          </form>
        </section>
      ) : (
        <section className={`grid gap-5 ${phase === 'setup' ? 'lg:grid-cols-[minmax(260px,340px)_1fr]' : ''}`}>
          {phase === 'setup' && (
            <aside className="card h-fit space-y-5 p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${selectedSubject?.color} font-bold text-white`}>
                    {selectedSubject?.icon}
                  </span>
                  <p className="font-semibold text-slate-900">{subject}</p>
                </div>
                <button type="button" onClick={() => setSubject('')} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-indigo-700">
                  <ArrowLeft className="h-3.5 w-3.5" /> Đổi môn
                </button>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Em muốn</p>
                <div className="grid grid-cols-2 gap-2">
                  <ModeButton selected={mode === 'practice'} onClick={() => changeMode('practice')}>
                    <Target className="h-4 w-4" /> Luyện tập
                  </ModeButton>
                  <ModeButton selected={mode === 'test'} onClick={() => changeMode('test')}>
                    <ClipboardIcon /> Làm đề
                  </ModeButton>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {mode === 'practice' ? 'Làm từng câu, xem đáp án và lời giải ngay.' : 'Làm bài có tính giờ, xem điểm sau khi nộp.'}
                </p>
              </div>

              <div>
                <label htmlFor="practice-topic" className="mb-2 block text-sm font-medium text-slate-700">Chủ đề</label>
                <input
                  id="practice-topic"
                  className="input-field"
                  placeholder="VD: Hàm số bậc hai"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(topicSuggestions[subject] ?? []).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setTopic(suggestion)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${topic === suggestion ? selectedSubject?.surface : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium text-slate-700">
                  Số câu
                  <select className="input-field mt-2" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>
                    <option value={5}>5 câu</option>
                    <option value={10}>10 câu</option>
                    <option value={15}>15 câu</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Mức độ
                  <select className="input-field mt-2" value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>
                    <option value="easy">Dễ</option>
                    <option value="medium">Vừa sức</option>
                    <option value="hard">Thử thách</option>
                  </select>
                </label>
              </div>
              {mode === 'test' && (
                <label className="block text-sm font-medium text-slate-700">
                  Thời gian làm đề
                  <select className="input-field mt-2" value={testMinutes} onChange={(event) => setTestMinutes(Number(event.target.value))}>
                    <option value={10}>10 phút</option>
                    <option value={15}>15 phút</option>
                    <option value={30}>30 phút</option>
                  </select>
                </label>
              )}

              <button
                type="button"
                onClick={() => void generateQuestions()}
                disabled={!topic.trim() || generating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                {generating ? 'Đang chuẩn bị...' : mode === 'practice' ? 'Tạo bài luyện' : 'Tạo đề kiểm tra'}
              </button>
              <button type="button" onClick={loadSampleQuestions} className="w-full text-xs font-medium text-blue-700 hover:text-blue-900">
                Xem thử dữ liệu mẫu
              </button>
            </aside>
          )}

          <div className={`min-w-0 space-y-4 ${phase !== 'setup' ? 'mx-auto w-full max-w-4xl' : ''}`}>
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">{error}</div>}

            {generating ? (
              <div className="card flex min-h-72 flex-col items-center justify-center p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <p className="mt-4 font-semibold text-slate-800">Đang tạo câu hỏi...</p>
              </div>
            ) : phase === 'setup' ? (
              <div className="card flex min-h-72 flex-col items-center justify-center p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  {mode === 'practice' ? <Target className="h-7 w-7" /> : <BookOpen className="h-7 w-7" />}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{mode === 'practice' ? 'Bắt đầu luyện tập' : 'Chuẩn bị làm đề'}</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                  {mode === 'practice'
                    ? 'Chọn chủ đề và mức độ. Bài luyện sẽ hiện từng câu để em làm, xem đáp án và đọc lời giải ngay.'
                    : 'Chọn chủ đề, số câu và thời gian. Khi bắt đầu, phần cài đặt sẽ ẩn để em tập trung làm bài.'}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {(topicSuggestions[subject] ?? []).map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => setTopic(suggestion)} className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : phase === 'ready' ? (
              <div className="card space-y-5 p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-700">{isSample ? 'Bộ câu hỏi minh họa - Dữ liệu mẫu' : mode === 'practice' ? 'Bài luyện đã sẵn sàng' : 'Đề kiểm tra đã sẵn sàng'}</p>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">{topic || 'Câu hỏi minh họa'}</h3>
                    <p className="mt-1 text-sm text-slate-500">{subject} - {questions.length} câu - {difficulty === 'easy' ? 'Dễ' : difficulty === 'hard' ? 'Thử thách' : 'Vừa sức'}</p>
                  </div>
                  <button type="button" onClick={() => setPhase('setup')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <Settings2 className="h-4 w-4" /> Chỉnh cài đặt
                  </button>
                </div>
                <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                  {mode === 'practice'
                    ? 'Em sẽ làm lần lượt từng câu. Sau mỗi lựa chọn, đáp án đúng và lời giải sẽ hiện ra để em tự kiểm tra.'
                    : `Bài làm có ${testMinutes} phút. Đáp án và điểm số chỉ hiển thị sau khi em nộp bài.`}
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Câu 1 - Xem trước</p>
                  <MathText text={questions[0]?.question ?? ''} className="mt-2 font-medium leading-6 text-slate-900" />
                </div>
                <button type="button" onClick={startAttempt} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700">
                  {mode === 'practice' ? <Target className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                  {mode === 'practice' ? 'Bắt đầu luyện' : 'Bắt đầu làm đề'}
                </button>
              </div>
            ) : phase === 'answering' && currentQuestion ? (
              <div className="card space-y-5 p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-sm font-semibold text-blue-700">{mode === 'practice' ? 'Luyện tập' : 'Đang làm đề'}</p>
                    <h3 className="mt-1 font-bold text-slate-900">{subject} - {topic}</h3>
                  </div>
                  {mode === 'test' && (
                    <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 font-bold tabular-nums ${timeLeft < 60 ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                      <Clock3 className="h-4 w-4" />{formatTime(timeLeft)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
                    <span>Câu {currentIndex + 1} / {questions.length}</span>
                    <span>{Object.keys(answers).length} câu đã chọn</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Chọn câu hỏi">
                    {questions.map((question, index) => (
                      <button
                        key={question.id}
                        type="button"
                        aria-label={`Đến câu ${index + 1}`}
                        aria-current={index === currentIndex ? 'step' : undefined}
                        onClick={() => setCurrentIndex(index)}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold ${
                          index === currentIndex
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : answers[question.id] !== undefined
                              ? 'border-blue-200 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                        }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
                <article>
                  <MathText text={currentQuestion.question} className="text-lg font-semibold leading-7 text-slate-900" />
                  <div className="mt-5 space-y-3">
                    {currentQuestion.options.map((option, optionIndex) => {
                      const selected = currentAnswer === optionIndex;
                      const revealAnswer = mode === 'practice' && currentAnswer !== undefined;
                      const correct = optionIndex === currentQuestion.correctIndex;
                      const optionStyle = revealAnswer && correct
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                        : revealAnswer && selected
                          ? 'border-rose-300 bg-rose-50 text-rose-800'
                          : selected
                            ? 'border-blue-400 bg-blue-50 text-blue-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50';
                      return (
                        <button key={`${currentQuestion.id}-${optionIndex}`} type="button" disabled={revealAnswer || (mode === 'test' && selected)} onClick={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: optionIndex }))} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition disabled:cursor-default ${optionStyle}`}>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm font-bold">{String.fromCharCode(65 + optionIndex)}</span>
                          <MathText text={option} />
                        </button>
                      );
                    })}
                  </div>
                  {mode === 'practice' && currentAnswer !== undefined && (
                    <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-slate-700">
                      <p className="font-semibold text-blue-900">{currentAnswer === currentQuestion.correctIndex ? 'Chính xác!' : 'Mình cùng xem lại nhé.'}</p>
                      <MathText text={currentQuestion.explanation} className="mt-1" />
                    </div>
                  )}
                </article>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <button type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Câu trước</button>
                  {mode === 'test' ? (
                    <div className="flex gap-2">
                      {currentIndex < questions.length - 1 && (
                        <button type="button" onClick={() => setCurrentIndex((index) => index + 1)} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">Câu tiếp theo</button>
                      )}
                      <button type="button" disabled={Object.keys(answers).length !== questions.length} onClick={submitAttempt} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Nộp bài ({Object.keys(answers).length}/{questions.length})</button>
                    </div>
                  ) : (
                    <button type="button" disabled={currentAnswer === undefined} onClick={() => currentIndex === questions.length - 1 ? submitAttempt() : setCurrentIndex((index) => index + 1)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{currentIndex === questions.length - 1 ? 'Hoàn thành' : 'Câu tiếp theo'}</button>
                  )}
                </div>
              </div>
            ) : phase === 'results' ? (
              <div className="space-y-4">
                <div className="card flex flex-wrap items-center justify-between gap-4 border-blue-100 bg-blue-50 p-5 sm:p-7">
                  <div>
                    <p className="font-semibold text-blue-800">{mode === 'practice' ? 'Hoàn thành luyện tập' : 'Kết quả bài làm'}</p>
                    <h3 className="mt-1 text-2xl font-bold text-slate-900">Đúng {correctCount}/{questions.length} câu</h3>
                    {mode === 'test' && <p className="mt-1 text-sm text-slate-600">Thời gian còn lại: {formatTime(timeLeft)}</p>}
                  </div>
                  <button type="button" onClick={isSample ? loadSampleQuestions : () => void generateQuestions()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                    <RefreshCw className="h-4 w-4" /> Tạo đề khác
                  </button>
                </div>
                <button type="button" onClick={() => setPhase('setup')} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
                  <Settings2 className="h-4 w-4" /> Chỉnh cài đặt
                </button>
                {questions.map((question, index) => (
                  <article key={question.id} className="card space-y-3 p-4 sm:p-5">
                    <MathText text={`${index + 1}. ${question.question}`} className="font-semibold leading-6 text-slate-900" />
                    <div className="space-y-2">
                      {question.options.map((option, optionIndex) => (
                        <div key={`${question.id}-result-${optionIndex}`} className={`rounded-xl border p-3 text-sm ${optionIndex === question.correctIndex ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : answers[question.id] === optionIndex ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-slate-100 text-slate-600'}`}>
                          <MathText text={`${String.fromCharCode(65 + optionIndex)}. ${option}`} />
                          {optionIndex === question.correctIndex && <span className="ml-2 font-semibold">Đáp án đúng</span>}
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600"><strong className="text-slate-800">Giải thích: </strong><MathText text={question.explanation} /></div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

function ModeButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
        selected ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function ClipboardIcon() {
  return <BookOpen className="h-4 w-4" />;
}

function MathText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ p: ({ children }) => <p className="m-0">{children}</p> }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
