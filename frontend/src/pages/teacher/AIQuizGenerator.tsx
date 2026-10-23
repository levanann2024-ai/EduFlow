import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Sparkles, Wand2, Copy, Check, RefreshCw, Download, ChevronDown, ChevronRight, BookOpen, GraduationCap, Layers, Target, Lightbulb, Plus, Trash2, FileText } from 'lucide-react';
import type { QuizQuestion } from '@/types';

interface GeneratedQuestionSet {
  topic: string;
  subject: string;
  grade: string;
  questions: QuizQuestion[];
  durationMinutes?: number;
  structureSummary?: string[];
  writtenSection?: string;
}

type PracticeFormat = 'free' | 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
type AssessmentType = 'practice' | 'official';

interface GeneratedAssessmentDraft {
  topic: string;
  subject: string;
  grade: string;
  difficulty: 'easy' | 'medium' | 'hard';
  numQuestions: number;
  durationMinutes: number;
  practiceFormat: PracticeFormat;
  vietnameseCounts: { recognition: number; comprehension: number; application: number; advanced: number };
  englishCounts: { notice: number; ordering: number; cloze: number; reading: number };
  generalCounts: { multipleChoice: number; trueFalse: number; shortAnswer: number; essay: number };
  writtenSection: string;
  questions: QuizQuestion[];
}

const assessmentDraftKey = (type: AssessmentType) => `eduflow.teacher.ai-assessment-preview.${type}`;

function readAssessmentDraft(type: AssessmentType): GeneratedAssessmentDraft | null {
  try {
    const stored = localStorage.getItem(assessmentDraftKey(type));
    if (!stored) return null;
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== 'object') return null;
    const draft = value as Partial<GeneratedAssessmentDraft>;
    if (
      typeof draft.topic !== 'string'
      || typeof draft.subject !== 'string'
      || typeof draft.grade !== 'string'
      || !Array.isArray(draft.questions)
      || !draft.questions.every((question) => question && typeof question.question === 'string' && Array.isArray(question.options))
    ) return null;
    return {
      topic: draft.topic,
      subject: draft.subject,
      grade: draft.grade,
      difficulty: draft.difficulty === 'easy' || draft.difficulty === 'hard' ? draft.difficulty : 'medium',
      numQuestions: typeof draft.numQuestions === 'number' ? draft.numQuestions : 5,
      durationMinutes: typeof draft.durationMinutes === 'number' ? draft.durationMinutes : 45,
      practiceFormat: practiceFormats.some(({ value: format }) => format === draft.practiceFormat) ? draft.practiceFormat! : 'free',
      vietnameseCounts: draft.vietnameseCounts ?? { recognition: 1, comprehension: 1, application: 1, advanced: 1 },
      englishCounts: draft.englishCounts ?? { notice: 12, ordering: 5, cloze: 5, reading: 18 },
      generalCounts: draft.generalCounts ?? { multipleChoice: 12, trueFalse: 2, shortAnswer: 4, essay: 6 },
      writtenSection: typeof draft.writtenSection === 'string' ? draft.writtenSection : '',
      questions: draft.questions.map((question, index) => ({
        ...question,
        id: typeof question.id === 'string' ? question.id : `restored-question-${index}`,
        options: question.options.map((option) => String(option ?? '')),
        correctIndex: typeof question.correctIndex === 'number' && Number.isInteger(question.correctIndex)
          ? Math.min(Math.max(question.correctIndex, 0), Math.max(question.options.length - 1, 0))
          : 0,
        explanation: typeof question.explanation === 'string' ? question.explanation : '',
        difficulty: question.difficulty === 'easy' || question.difficulty === 'hard' ? question.difficulty : 'medium',
      })),
    };
  } catch (draftError) {
    console.error('Không thể khôi phục bản xem trước đề đã tạo.', draftError);
    return null;
  }
}

const subjects = ['Toán học', 'Vật lý', 'Hóa học', 'Sinh học', 'Ngữ văn', 'Lịch sử', 'Địa lý', 'Tiếng Anh'];
const practiceFormats: { value: PracticeFormat; label: string }[] = [
  { value: 'free', label: 'Tự do' },
  { value: 'multiple-choice', label: 'Trắc nghiệm' },
  { value: 'true-false', label: 'Đúng / Sai' },
  { value: 'short-answer', label: 'Trả lời ngắn' },
  { value: 'essay', label: 'Tự luận' },
];
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

export function AIQuizGenerator({
  onSaveQuestions,
  saveLabel = 'Lưu vào ngân hàng',
  examMode = false,
  assessmentType,
  onAssessmentTypeChange,
  durationMinutes = 45,
  onDurationChange,
}: {
  onSaveQuestions: (set: GeneratedQuestionSet) => void;
  saveLabel?: string;
  examMode?: boolean;
  assessmentType?: 'practice' | 'official';
  onAssessmentTypeChange?: (type: 'practice' | 'official') => void;
  durationMinutes?: number;
  onDurationChange?: (duration: number) => void;
}) {
  const [initialDraft] = useState(() => assessmentType ? readAssessmentDraft(assessmentType) : null);
  const [topic, setTopic] = useState(initialDraft?.topic ?? '');
  const [subject, setSubject] = useState(initialDraft?.subject ?? 'Toán học');
  const [grade, setGrade] = useState(initialDraft?.grade ?? 'Khối 10');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(initialDraft?.difficulty ?? 'medium');
  const [numQuestions, setNumQuestions] = useState(initialDraft?.numQuestions ?? 5);
  const [practiceFormat, setPracticeFormat] = useState<PracticeFormat>(initialDraft?.practiceFormat ?? 'free');
  const [vietnameseCounts, setVietnameseCounts] = useState(initialDraft?.vietnameseCounts ?? { recognition: 1, comprehension: 1, application: 1, advanced: 1 });
  const [englishCounts, setEnglishCounts] = useState(initialDraft?.englishCounts ?? { notice: 12, ordering: 5, cloze: 5, reading: 18 });
  const [generalCounts, setGeneralCounts] = useState(initialDraft?.generalCounts ?? { multipleChoice: 12, trueFalse: 2, shortAnswer: 4, essay: 6 });
  const [writtenSection, setWrittenSection] = useState(initialDraft?.writtenSection ?? '');
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialDraft?.questions ?? []);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentType) return;
    const draft = readAssessmentDraft(assessmentType);
    if (draft) {
      setTopic(draft.topic);
      setSubject(draft.subject);
      setGrade(draft.grade);
      setDifficulty(draft.difficulty);
      setNumQuestions(draft.numQuestions);
      onDurationChange?.(draft.durationMinutes);
      setPracticeFormat(draft.practiceFormat);
      setVietnameseCounts(draft.vietnameseCounts);
      setEnglishCounts(draft.englishCounts);
      setGeneralCounts(draft.generalCounts);
      setWrittenSection(draft.writtenSection);
      setQuestions(draft.questions);
    } else {
      setQuestions([]);
    }
    setError('');
    setExpandedId(null);
    if (assessmentType === 'practice') {
      setNumQuestions((current) => Math.min(10, Math.max(5, current)));
    }
  }, [assessmentType, onDurationChange]);

  const isVietnamese = subject === 'Ngữ văn';
  const isEnglish = subject === 'Tiếng Anh';
  const currentCounts = isVietnamese ? vietnameseCounts : isEnglish ? englishCounts : generalCounts;
  const totalExamQuestions = Object.values(currentCounts).reduce((total, count) => total + count, 0);
  const requestedQuestionCount = examMode ? totalExamQuestions : numQuestions;
  const examStructure = isVietnamese
    ? [
      `Nhận biết: ${vietnameseCounts.recognition} câu`,
      `Thông hiểu: ${vietnameseCounts.comprehension} câu`,
      `Vận dụng: ${vietnameseCounts.application} câu`,
      `Vận dụng cao: ${vietnameseCounts.advanced} câu`,
      'Phần viết: giáo viên tự nhập yêu cầu',
    ]
    : isEnglish
      ? [
        `Dạng 1 · Điền từ/cụm từ ngắn: ${englishCounts.notice} câu`,
        `Dạng 2 · Sắp xếp câu/đoạn: ${englishCounts.ordering} câu`,
        `Dạng 3 · Đọc điền khuyết: ${englishCounts.cloze} câu`,
        `Dạng 4 · Đọc hiểu: ${englishCounts.reading} câu`,
      ]
      : [
        `Trắc nghiệm ABCD: ${generalCounts.multipleChoice} câu`,
        `Đúng / Sai (4 ý mỗi câu): ${generalCounts.trueFalse} câu`,
        `Trả lời ngắn: ${generalCounts.shortAnswer} câu`,
        `Tự luận: ${generalCounts.essay} câu`,
      ];
  const setCount = <T extends Record<string, number>>(
    setter: Dispatch<SetStateAction<T>>,
    key: keyof T,
    value: number,
  ) => {
    const count = Math.max(0, Math.min(100, value || 0));
    setter((current) => ({ ...current, [key]: count }));
  };

  const handleGenerate = async () => {
    if (!topic.trim() && !(examMode && isVietnamese && writtenSection.trim())) return;
    setGenerating(true);
    setQuestions([]);
    setError('');
    try {
      const formatInstruction: Record<PracticeFormat, string> = {
        free: 'Chọn hình thức câu hỏi phù hợp nhất với chủ đề; có thể kết hợp nhiều dạng ngắn.',
        'multiple-choice': 'Tạo toàn bộ câu hỏi dạng trắc nghiệm 4 phương án A, B, C, D.',
        'true-false': 'Tạo toàn bộ câu hỏi dạng đúng/sai, nêu rõ nhận định cần đánh giá.',
        'short-answer': 'Tạo toàn bộ câu hỏi trả lời ngắn, yêu cầu học sinh tự điền đáp án.',
        essay: 'Tạo toàn bộ câu hỏi tự luận ngắn, yêu cầu học sinh trình bày câu trả lời.',
      };
      const requestTopic = assessmentType === 'practice'
        ? `Tạo bài tập tự luyện ngắn gồm ${numQuestions} câu. ${formatInstruction[practiceFormat]} Chủ đề: ${topic.trim()}`
        : examMode
        ? [
          `Nội dung/chủ đề của đề: ${topic.trim()}`,
          `Cấu trúc đề yêu cầu: ${examStructure.join('; ')}.`,
          isVietnamese && writtenSection.trim() ? `Nội dung phần viết giáo viên yêu cầu: ${writtenSection.trim()}. Hãy tạo các câu trắc nghiệm phù hợp chủ đề và yêu cầu phần viết này.` : '',
          isEnglish ? 'Đảm bảo câu hỏi theo đúng thứ tự từng dạng, nội dung tiếng Anh phù hợp chương trình phổ thông Việt Nam.' : '',
          !isVietnamese && !isEnglish ? 'Tạo câu hỏi theo đúng nội dung và cơ cấu từng phần nêu trên.' : '',
        ].filter(Boolean).join('\n')
        : topic;
      const quantity = examMode ? totalExamQuestions : numQuestions;
      const response = await fetch('/api/ai/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, grade, topic: requestTopic, quantity, difficulty }),
      });
      const result: { success: boolean; data?: QuizQuestion[]; message?: string } = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Không thể tạo câu hỏi.');
      }
      setQuestions(result.data);
      if (assessmentType) {
        try {
          localStorage.setItem(assessmentDraftKey(assessmentType), JSON.stringify({
            topic,
            subject,
            grade,
            difficulty,
            numQuestions,
            durationMinutes,
            practiceFormat,
            vietnameseCounts,
            englishCounts,
            generalCounts,
            writtenSection,
            questions: result.data,
          } satisfies GeneratedAssessmentDraft));
        } catch (draftError) {
          console.error('Không thể lưu bản xem trước đề đã tạo trong phiên này.', draftError);
        }
      }
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

            {assessmentType && (
              <div className="mb-4 space-y-3 border-b border-slate-100 pb-4">
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold text-slate-700">Loại đề</legend>
                  <div className="grid grid-cols-1 gap-2">
                    {([
                      ['practice', 'Bài tập tự luyện ngắn', '5–10 câu, tạo nhanh để ôn tập'],
                      ['official', 'Bài kiểm tra chính thức', 'Thiết lập ma trận và thời lượng'],
                    ] as const).map(([value, label, description]) => (
                      <label key={value} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors ${assessmentType === value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}>
                        <input
                          type="radio"
                          name="assessment-type"
                          value={value}
                          checked={assessmentType === value}
                          onChange={() => onAssessmentTypeChange?.(value)}
                          className="mt-0.5 accent-blue-600"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-slate-800">{label}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">{description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                  <h3 className="mb-2 text-xs font-semibold text-slate-800">{assessmentType === 'practice' ? 'Thông tin bài tập' : 'Thông tin đề kiểm tra'}</h3>
                  <div className={`grid gap-2 ${examMode ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <label className="min-w-0 text-[11px] font-medium text-slate-600">Môn học
                      <select value={subject} onChange={(event) => setSubject(event.target.value)} className="input-field mt-1 h-9 min-w-0 px-2 text-xs">
                        {subjects.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </label>
                    <label className="min-w-0 text-[11px] font-medium text-slate-600">Khối lớp
                      <select value={grade} onChange={(event) => setGrade(event.target.value)} className="input-field mt-1 h-9 min-w-0 px-2 text-xs">
                        {['Khối 10', 'Khối 11', 'Khối 12'].map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </label>
                    {examMode && <label className="min-w-0 text-[11px] font-medium text-slate-600">Thời lượng (phút)
                      <input type="number" min={1} max={300} value={durationMinutes} onChange={(event) => onDurationChange?.(Math.min(300, Math.max(1, Number(event.target.value) || 1)))} className="input-field mt-1 h-9 min-w-0 px-2 text-xs" />
                    </label>}
                  </div>
                </div>
                {assessmentType === 'practice' && (
                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold text-slate-700">Hình thức bài tập</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {practiceFormats.map(({ value, label }) => (
                        <label key={value} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${practiceFormat === value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-200'}`}>
                          <input
                            type="radio"
                            name="practice-format"
                            value={value}
                            checked={practiceFormat === value}
                            onChange={() => setPracticeFormat(value)}
                            className="accent-blue-600"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
            )}

            <div className="space-y-3.5">
              {!examMode && !assessmentType && <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  Môn học
                </label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field cursor-pointer">
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>}

              {!examMode && !assessmentType && <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  Khối lớp
                </label>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className="input-field cursor-pointer">
                  {['Khối 10','Khối 11','Khối 12'].map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>}

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-slate-400" />
                  Chủ đề / Nội dung
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={examMode ? 'Nhập phạm vi kiến thức, văn bản hoặc nội dung muốn kiểm tra...' : 'VD: Hàm số bậc hai và đồ thị parabol...'}
                  rows={3}
                  className="input-field resize-none"
                />
              </div>

              {examMode && (
                <div className="space-y-2.5 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-800">Cấu trúc đề</h4>
                    <span className="text-xs font-semibold text-blue-700">{totalExamQuestions} câu</span>
                  </div>
                  {isVietnamese ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">Phần 1 · Trắc nghiệm</p>
                      {([
                        ['recognition', 'Nhận biết'],
                        ['comprehension', 'Thông hiểu'],
                        ['application', 'Vận dụng'],
                        ['advanced', 'Vận dụng cao'],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                          {label}
                          <input type="number" min={0} max={100} value={vietnameseCounts[key]} onChange={(event) => setCount(setVietnameseCounts, key, Number(event.target.value))} className="input-field h-9 w-20 text-center" />
                        </label>
                      ))}
                      <label className="block border-t border-blue-100 pt-2 text-sm font-medium text-slate-700">
                        Phần 2 · Yêu cầu phần viết
                        <textarea value={writtenSection} onChange={(event) => setWrittenSection(event.target.value)} rows={3} placeholder="Giáo viên nhập dạng bài, tác phẩm hoặc yêu cầu viết; AI sẽ dựa vào đây để tạo nội dung phù hợp." className="input-field mt-1.5 resize-y text-sm" />
                      </label>
                    </div>
                  ) : isEnglish ? (
                    <div className="space-y-2">
                      {([
                        ['notice', 'Dạng 1 · Điền từ/cụm từ ngắn', '30%'],
                        ['ordering', 'Dạng 2 · Sắp xếp câu/đoạn', '12,5%'],
                        ['cloze', 'Dạng 3 · Đọc điền khuyết', '12,5%'],
                        ['reading', 'Dạng 4 · Đọc hiểu (thường 2 bài)', '45%'],
                      ] as const).map(([key, label, percentage]) => (
                        <label key={key} className="flex items-center justify-between gap-2 text-xs text-slate-700">
                          <span className="min-w-0">{label} <span className="text-slate-400">· {percentage} mặc định</span></span>
                          <input type="number" min={0} max={100} value={englishCounts[key]} onChange={(event) => setCount(setEnglishCounts, key, Number(event.target.value))} aria-label={`${label}, phần trăm mặc định ${percentage}`} className="input-field h-9 w-20 shrink-0 text-center" />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {([
                        ['multipleChoice', 'Trắc nghiệm ABCD'],
                        ['trueFalse', 'Đúng / Sai · 4 ý a, b, c, d mỗi câu'],
                        ['shortAnswer', 'Trả lời ngắn'],
                        ['essay', 'Tự luận'],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                          {label}
                          <input type="number" min={0} max={100} value={generalCounts[key]} onChange={(event) => setCount(setGeneralCounts, key, Number(event.target.value))} className="input-field h-9 w-20 text-center" />
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-500">Có thể thay đổi số câu từng phần theo yêu cầu của lớp.</p>
                </div>
              )}

              {!examMode && !assessmentType && <div>
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
              </div>}

              {!examMode && (!assessmentType || assessmentType === 'practice') && <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Số câu {assessmentType === 'practice' && <span className="text-xs font-normal text-slate-400">(5–10)</span>}
                  </span>
                  <span className="text-blue-600 font-semibold tabular-nums">{numQuestions}</span>
                </label>
                <input
                  type="range"
                  min={assessmentType === 'practice' ? 5 : 3}
                  max={assessmentType === 'practice' ? 10 : 15}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-sm text-slate-400 mt-0.5">
                  <span>{assessmentType === 'practice' ? 5 : 3}</span>
                  <span>{assessmentType === 'practice' ? 10 : 15}</span>
                </div>
              </div>}

              <button onClick={handleGenerate} disabled={(!topic.trim() && !(examMode && isVietnamese && writtenSection.trim())) || generating || (examMode && totalExamQuestions === 0)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {generating ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang tạo...</>
                ) : (
                  <><Wand2 className="w-3.5 h-3.5" /> {assessmentType === 'official' ? 'Tạo bài kiểm tra' : assessmentType === 'practice' ? 'Tạo bài tập' : 'Tạo câu hỏi'}</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">
              {assessmentType === 'official' ? 'Xem trước bài kiểm tra chính thức' : assessmentType === 'practice' ? 'Xem trước bài tập tự luyện' : 'Kết quả tạo câu hỏi'}
            </h3>
            {assessmentType &&             <span className="text-xs text-slate-500">{requestedQuestionCount} câu</span>}
          </div>
          {generating ? (
            <GeneratingSkeleton num={requestedQuestionCount} />
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
                    <p className="font-semibold text-slate-800 text-sm">{assessmentType === 'official' ? 'Đã tạo đề kiểm tra' : assessmentType === 'practice' ? 'Đã tạo bài tập tự luyện' : `Đã tạo ${questions.length} câu hỏi`}</p>
                    {assessmentType && <p className="text-xs text-slate-500">{questions.length} câu hỏi được AI trả về</p>}
                    <p className="text-sm text-slate-400">{subject} • {grade} • {examMode ? `${durationMinutes} phút` : difficulties.find((d) => d.value === difficulty)?.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={handleGenerate} className="btn-ghost">
                    <RefreshCw className="w-3.5 h-3.5" /> Tạo lại
                  </button>
                  <button onClick={handleDownload} className="btn-outline">
                    <Download className="w-3.5 h-3.5" /> Tải xuống
                  </button>
                  <button onClick={() => onSaveQuestions({
                    topic: topic.trim() || (examMode ? writtenSection.trim().slice(0, 80) : topic),
                    subject,
                    grade,
                    questions,
                    ...(examMode ? { durationMinutes, structureSummary: examStructure, writtenSection } : {}),
                  })} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
                    <Plus className="w-3.5 h-3.5" /> {saveLabel}
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
            <EmptyState assessmentType={assessmentType} />
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

function EmptyState({ assessmentType }: { assessmentType?: 'practice' | 'official' }) {
  return (
    <div className="card p-10 flex flex-col items-center text-center min-h-[400px] justify-center">
      <div className="w-14 h-14 rounded-md bg-slate-100 flex items-center justify-center">
        <Wand2 className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-800 mt-4">
        {assessmentType === 'official' ? 'Tạo bài kiểm tra chính thức bằng AI' : assessmentType === 'practice' ? 'Tạo bài tập tự luyện bằng AI' : 'Tạo câu hỏi trắc nghiệm bằng AI'}
      </h3>
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
