import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Sparkles, Wand2, Copy, Check, RefreshCw, Download, ChevronDown, ChevronRight, BookOpen, GraduationCap, Layers, Target, Lightbulb, Plus, Trash2, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { QuizQuestion } from '@/types';
import { authenticatedFetch } from '@/auth/authApi';
import { getAISubjectExamples } from './aiSubjectExamples';

interface GeneratedQuestionSet {
  topic: string;
  subject: string;
  grade: string;
  questions: QuizQuestion[];
  durationMinutes?: number | null;
  structureSummary?: string[];
  sectionPoints?: Record<GeneratedQuestionType, number>;
  writtenSection?: string;
  sourceReferences?: SourceReference[];
}

interface SourceReference {
  title: string;
  url: string;
}

type PracticeFormat = 'free' | 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
type AssessmentType = 'practice' | 'official';
type VietnameseWritingFormat = 'paragraph-and-essay' | 'essay-only';
type VietnameseReadingField = 'title' | 'author' | 'source' | 'origin' | 'position';
type VietnameseReadingDetails = Record<VietnameseReadingField, string>;
type VietnameseReadingMode = 'details' | 'full-text';
type GeneratedQuestionType = NonNullable<QuizQuestion['type']>;

const vietnameseReadingFields: { key: VietnameseReadingField; label: string; placeholder: string }[] = [
  { key: 'title', label: 'Nhan đề văn bản', placeholder: 'Tên tác phẩm hoặc văn bản' },
  { key: 'author', label: 'Tác giả', placeholder: 'Tên nhà văn, nhà thơ nếu có' },
  { key: 'source', label: 'Nguồn trích dẫn', placeholder: 'Tên sách, tuyển tập, tài liệu' },
  { key: 'origin', label: 'Xuất xứ', placeholder: 'Trích từ tác phẩm nào, phần nào' },
  { key: 'position', label: 'Vị trí đoạn trích', placeholder: 'Chương, phần, trang nếu có' },
];

const emptyVietnameseReadingDetails: VietnameseReadingDetails = {
  title: '',
  author: '',
  source: '',
  origin: '',
  position: '',
};
const defaultVietnameseCounts = { recognition: 2, comprehension: 2, application: 1 };

function normalizeVietnameseReadingDetails(value: unknown): VietnameseReadingDetails {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return vietnameseReadingFields.reduce((details, { key }) => ({
    ...details,
    [key]: typeof source[key] === 'string' ? source[key] : '',
  }), { ...emptyVietnameseReadingDetails });
}

interface GeneratedAssessmentDraft {
  topic: string;
  subject?: string;
  readingMode?: VietnameseReadingMode;
  readingDetails?: VietnameseReadingDetails;
  readingFullText?: string;
  grade: string;
  difficulty: 'easy' | 'medium' | 'hard';
  numQuestions: number;
  englishDefaultsApplied?: boolean;
  practiceFormat: PracticeFormat;
  vietnameseCounts: { recognition: number; comprehension: number; application: number };
  includeReading?: boolean;
  includeWriting?: boolean;
  writingFormat: VietnameseWritingFormat;
  generalCounts: { multipleChoice: number; trueFalse: number; shortAnswer: number; essay: number };
  sectionPoints: Record<GeneratedQuestionType, number>;
  writtenSection: string;
  paragraphSection?: string;
  essaySection?: string;
  sourceReferences?: SourceReference[];
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
      || typeof draft.grade !== 'string'
      || !Array.isArray(draft.questions)
      || !draft.questions.every((question) => question && typeof question.question === 'string' && Array.isArray(question.options))
    ) return null;
    const hasSectionSelectionSettings = typeof draft.includeReading === 'boolean'
      || typeof draft.includeWriting === 'boolean';
    const hasLegacyEnglishDefaults = draft.englishDefaultsApplied !== true
      && draft.subject === 'Tiếng Anh'
      && draft.numQuestions === 5;
    return {
      topic: draft.topic,
      subject: typeof draft.subject === 'string' ? draft.subject : '',
      readingMode: draft.readingMode === 'details' || draft.readingMode === 'full-text'
        ? draft.readingMode
        : draft.topic.trim() ? 'full-text' : 'details',
      readingDetails: normalizeVietnameseReadingDetails(draft.readingDetails),
      readingFullText: typeof draft.readingFullText === 'string' ? draft.readingFullText : draft.topic,
      grade: draft.grade,
      difficulty: draft.difficulty === 'easy' || draft.difficulty === 'hard' ? draft.difficulty : 'medium',
      numQuestions: hasLegacyEnglishDefaults ? 40 : typeof draft.numQuestions === 'number' ? draft.numQuestions : 5,
      englishDefaultsApplied: true,
      practiceFormat: hasLegacyEnglishDefaults
        ? 'multiple-choice'
        : practiceFormats.some(({ value: format }) => format === draft.practiceFormat) ? draft.practiceFormat! : 'free',
      vietnameseCounts: hasSectionSelectionSettings ? draft.vietnameseCounts ?? defaultVietnameseCounts : defaultVietnameseCounts,
      includeReading: draft.includeReading ?? true,
      includeWriting: draft.includeWriting ?? true,
      writingFormat: draft.writingFormat === 'essay-only' ? 'essay-only' : 'paragraph-and-essay',
      generalCounts: draft.generalCounts ?? { multipleChoice: 12, trueFalse: 2, shortAnswer: 4, essay: 6 },
      sectionPoints: draft.sectionPoints ?? {
        'multiple-choice': 3,
        'true-false': 2,
        'short-answer': 2,
        essay: 3,
      },
      writtenSection: typeof draft.writtenSection === 'string' ? draft.writtenSection : '',
      paragraphSection: typeof draft.paragraphSection === 'string' ? draft.paragraphSection : '',
      essaySection: typeof draft.essaySection === 'string' ? draft.essaySection : '',
      sourceReferences: Array.isArray(draft.sourceReferences)
        ? draft.sourceReferences.filter((source): source is SourceReference => (
          Boolean(source)
          && typeof source.title === 'string'
          && typeof source.url === 'string'
          && source.url.startsWith('https://')
        ))
        : [],
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
  { value: 'free', label: 'Tự do / ngẫu nhiên' },
  { value: 'multiple-choice', label: 'Trắc nghiệm' },
  { value: 'true-false', label: 'Đúng / Sai' },
  { value: 'short-answer', label: 'Trả lời ngắn' },
  { value: 'essay', label: 'Tự luận' },
];
const questionTypeLabels: Record<GeneratedQuestionType, string> = {
  'multiple-choice': 'Trắc nghiệm',
  'true-false': 'Đúng / Sai',
  'short-answer': 'Trả lời ngắn',
  essay: 'Tự luận',
};

function normalizeGeneratedQuestion(value: unknown, index: number): QuizQuestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Câu ${index + 1} không phải object JSON.`);
  }
  const raw = value as Record<string, unknown>;
  const questionText = raw.question ?? raw.content ?? raw.text;
  if (typeof questionText !== 'string' || !questionText.trim()) {
    throw new Error(`Câu ${index + 1} thiếu nội dung câu hỏi.`);
  }
  const rawOptions = raw.options ?? raw.choices;
  if (rawOptions !== undefined && (!Array.isArray(rawOptions) || !rawOptions.every((option) => typeof option === 'string'))) {
    throw new Error(`Câu ${index + 1} có danh sách phương án không hợp lệ.`);
  }
  const options = Array.isArray(rawOptions) ? rawOptions : [];
  const rawType = raw.type ?? raw.questionType;
  const inferredType = rawType === undefined && options.length === 4
    ? 'multiple-choice'
    : rawType;
  if (!['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(String(inferredType))) {
    throw new Error(`Câu ${index + 1} thiếu dạng câu hỏi hợp lệ.`);
  }
  const type = inferredType as GeneratedQuestionType;
  const answer = raw.correctAnswer ?? raw.answer;
  const answerText = typeof answer === 'string' ? answer : '';
  const rawIndex = raw.correctIndex;
  const answerIndex = answerText ? options.indexOf(answerText) : -1;
  const correctIndex = typeof rawIndex === 'number' && Number.isInteger(rawIndex)
    ? rawIndex
    : answerIndex;
  const rawCorrectAnswers = raw.correctAnswers;
  const correctAnswers = Array.isArray(rawCorrectAnswers)
    && rawCorrectAnswers.every((item) => typeof item === 'boolean')
    ? rawCorrectAnswers as boolean[]
    : undefined;
  const difficulty = ['easy', 'medium', 'hard'].includes(String(raw.difficulty))
    ? raw.difficulty as QuizQuestion['difficulty']
    : 'medium';
  const basePoints = type === 'multiple-choice' ? 0.25
    : type === 'true-false' ? 1
      : type === 'short-answer' ? 0.5
        : 2;
  const difficultyMultiplier = difficulty === 'easy' ? 0.75 : difficulty === 'hard' ? 1.5 : 1;
  const points = typeof raw.points === 'number' && Number.isFinite(raw.points) && raw.points > 0
    ? raw.points
    : Math.max(0.25, Math.round(basePoints * difficultyMultiplier * 4) / 4);

  if (type === 'multiple-choice' && (options.length !== 4 || correctIndex < 0 || correctIndex >= options.length)) {
    throw new Error(`Câu ${index + 1} trắc nghiệm cần 4 phương án và đáp án đúng hợp lệ.`);
  }
  if (type === 'true-false' && (options.length !== 4 || correctAnswers?.length !== 4)) {
    throw new Error(`Câu ${index + 1} đúng/sai cần 4 nhận định và 4 đáp án đúng/sai.`);
  }
  if ((type === 'short-answer' || type === 'essay') && !answerText.trim()) {
    throw new Error(`Câu ${index + 1} dạng ${questionTypeLabel(type)} thiếu đáp án tham khảo.`);
  }

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `generated-question-${index + 1}`,
    type,
    question: questionText,
    options: options as string[],
    correctIndex: type === 'multiple-choice' ? correctIndex : -1,
    correctAnswer: answerText || (type === 'multiple-choice' ? options[correctIndex] : ''),
    correctAnswers,
    points,
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
    difficulty,
  };
}

function questionTypeLabel(type?: QuizQuestion['type']): string {
  return type ? questionTypeLabels[type] : questionTypeLabels['multiple-choice'];
}

function vietnameseQuestionLabels(
  counts: { recognition: number; comprehension: number; application: number },
  writingFormat: VietnameseWritingFormat,
  includeReading: boolean,
  includeWriting: boolean,
) {
  const readingLabels = includeReading ? [
    ...Array.from({ length: counts.recognition }, (_, index) => `Phần I: Đọc hiểu - Câu ${index + 1} (Nhận biết)`),
    ...Array.from({ length: counts.comprehension }, (_, index) => `Phần I: Đọc hiểu - Câu ${counts.recognition + index + 1} (Thông hiểu)`),
    ...Array.from({ length: counts.application }, (_, index) => `Phần I: Đọc hiểu - Câu ${counts.recognition + counts.comprehension + index + 1} (Vận dụng)`),
  ] : [];
  return [
    ...readingLabels,
    ...(!includeWriting ? [] : writingFormat === 'paragraph-and-essay'
      ? ['Phần II: Viết - Câu 1: Viết đoạn văn', 'Phần II: Viết - Câu 2: Viết bài văn']
      : ['Phần II: Viết - Câu 1: Viết bài văn']),
  ];
}

const difficulties = [
  { value: 'easy', label: 'Dễ', activeClass: 'bg-green-50 border-green-300 text-green-700' },
  { value: 'medium', label: 'Trung bình', activeClass: 'bg-amber-50 border-amber-300 text-amber-700' },
  { value: 'hard', label: 'Khó', activeClass: 'bg-rose-50 border-rose-300 text-rose-700' },
] as const;

function distributeQuestionPoints(
  questions: QuizQuestion[],
  sectionPoints: Record<GeneratedQuestionType, number>,
) {
  const counts = questions.reduce<Record<GeneratedQuestionType, number>>((result, question) => {
    const type = question.type ?? 'multiple-choice';
    result[type] += 1;
    return result;
  }, { 'multiple-choice': 0, 'true-false': 0, 'short-answer': 0, essay: 0 });
  return questions.map((question) => {
    const type = question.type ?? 'multiple-choice';
    return { ...question, points: sectionPoints[type] / counts[type] };
  });
}

function VietnameseReadingInput({
  mode,
  details,
  fullText,
  onModeChange,
  onDetailChange,
  onFullTextChange,
}: {
  mode: VietnameseReadingMode;
  details: VietnameseReadingDetails;
  fullText: string;
  onModeChange: (mode: VietnameseReadingMode) => void;
  onDetailChange: (field: VietnameseReadingField, value: string) => void;
  onFullTextChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Cách nhập thông tin bài đọc hiểu" className="inline-flex rounded-lg bg-slate-100 p-1">
        {([
          ['details', 'Thông tin bài đọc hiểu'],
          ['full-text', 'Toàn bộ văn bản'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => onModeChange(value)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'details' ? (
        <div className="space-y-3">
          {vietnameseReadingFields.map(({ key, label, placeholder }) => (
            <label key={key} className="block text-sm font-medium text-slate-700">
              {label}
              <textarea
                value={details[key]}
                onChange={(event) => onDetailChange(key, event.target.value)}
                rows={1}
                placeholder={placeholder}
                className="input-field mt-1.5 resize-y text-base leading-6"
              />
            </label>
          ))}
        </div>
      ) : (
        <textarea
          value={fullText}
          onChange={(event) => onFullTextChange(event.target.value)}
          rows={14}
          placeholder="Dán toàn bộ văn bản hoặc nguồn đọc hiểu vào đây. Nội dung sẽ được giữ nguyên để AI tạo câu hỏi."
          className="input-field min-h-80 resize-y text-base leading-7"
        />
      )}
      <p className="text-sm leading-6 text-slate-600">
        AI sẽ tìm kiếm và đối chiếu nguồn trên web; đường dẫn nguồn sẽ hiện cùng kết quả. Nếu không xác minh được nguồn đáng tin cậy hoặc toàn văn hợp pháp, AI sẽ dừng thay vì tự bịa.
      </p>
    </div>
  );
}

function VietnameseWritingInputs({
  writingFormat,
  paragraphSection,
  essaySection,
  onParagraphChange,
  onEssayChange,
}: {
  writingFormat: VietnameseWritingFormat;
  paragraphSection: string;
  essaySection: string;
  onParagraphChange: (value: string) => void;
  onEssayChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      {writingFormat === 'paragraph-and-essay' && (
        <label className="block text-sm font-medium text-slate-700">
          Câu 1 - Viết đoạn văn
          <textarea
            value={paragraphSection}
            onChange={(event) => onParagraphChange(event.target.value)}
            rows={3}
            placeholder="Nhập yêu cầu, chủ đề hoặc nội dung cần viết thành đoạn văn..."
            className="input-field mt-1.5 resize-y text-base leading-6"
          />
        </label>
      )}
      <label className="block text-sm font-medium text-slate-700">
        {writingFormat === 'paragraph-and-essay' ? 'Câu 2 - Viết bài văn' : 'Câu 1 - Viết bài văn'}
        <textarea
          value={essaySection}
          onChange={(event) => onEssayChange(event.target.value)}
          rows={3}
          placeholder="Nhập yêu cầu, chủ đề hoặc nội dung cần viết thành bài văn..."
          className="input-field mt-1.5 resize-y text-base leading-6"
        />
      </label>
    </div>
  );
}

export function AIQuizGenerator({
  onSaveQuestions,
  saveLabel = 'Lưu vào ngân hàng',
  examMode = false,
  assessmentType,
  assignedSubjects = [],
  onAssessmentTypeChange,
}: {
  onSaveQuestions: (set: GeneratedQuestionSet) => void;
  saveLabel?: string;
  examMode?: boolean;
  assessmentType?: 'practice' | 'official';
  assignedSubjects?: string[];
  onAssessmentTypeChange?: (type: 'practice' | 'official') => void;
}) {
  const [initialDraft] = useState(() => assessmentType ? readAssessmentDraft(assessmentType) : null);
  const defaultSubject = initialDraft?.subject ?? assignedSubjects[0] ?? '';
  const [topic, setTopic] = useState(initialDraft?.topic ?? '');
  const [subject, setSubject] = useState(defaultSubject);
  const [readingMode, setReadingMode] = useState<VietnameseReadingMode>(initialDraft?.readingMode ?? 'details');
  const [readingDetails, setReadingDetails] = useState<VietnameseReadingDetails>(initialDraft?.readingDetails ?? emptyVietnameseReadingDetails);
  const [readingFullText, setReadingFullText] = useState(initialDraft?.readingFullText ?? '');
  const [grade, setGrade] = useState(initialDraft?.grade ?? 'Khối 10');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(initialDraft?.difficulty ?? 'medium');
  const [numQuestions, setNumQuestions] = useState(
    initialDraft?.numQuestions ?? (defaultSubject === 'Tiếng Anh' ? 40 : 5),
  );
  const [practiceFormat, setPracticeFormat] = useState<PracticeFormat>(
    initialDraft?.practiceFormat ?? (defaultSubject === 'Tiếng Anh' ? 'multiple-choice' : 'free'),
  );
  const [vietnameseCounts, setVietnameseCounts] = useState(initialDraft?.vietnameseCounts ?? defaultVietnameseCounts);
  const [includeReading, setIncludeReading] = useState(initialDraft?.includeReading ?? true);
  const [includeWriting, setIncludeWriting] = useState(initialDraft?.includeWriting ?? true);
  const [writingFormat, setWritingFormat] = useState<VietnameseWritingFormat>(initialDraft?.writingFormat ?? 'paragraph-and-essay');
  const [generalCounts, setGeneralCounts] = useState(initialDraft?.generalCounts ?? { multipleChoice: 12, trueFalse: 2, shortAnswer: 4, essay: 6 });
  const [sectionPoints, setSectionPoints] = useState<Record<GeneratedQuestionType, number>>(initialDraft?.sectionPoints ?? {
    'multiple-choice': 3,
    'true-false': 2,
    'short-answer': 2,
    essay: 3,
  });
  const [writtenSection, setWrittenSection] = useState(initialDraft?.writtenSection ?? '');
  const [paragraphSection, setParagraphSection] = useState(initialDraft?.paragraphSection ?? '');
  const [essaySection, setEssaySection] = useState(initialDraft?.essaySection ?? initialDraft?.writtenSection ?? '');
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialDraft?.questions ?? []);
  const [sourceReferences, setSourceReferences] = useState<SourceReference[]>(initialDraft?.sourceReferences ?? []);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentType) return;
    const draft = readAssessmentDraft(assessmentType);
    if (draft) {
      setTopic(draft.topic);
      setSubject(assignedSubjects.includes(draft.subject ?? '') ? draft.subject! : assignedSubjects[0] ?? '');
      setReadingMode(draft.readingMode ?? 'details');
      setReadingDetails(draft.readingDetails ?? emptyVietnameseReadingDetails);
      setReadingFullText(draft.readingFullText ?? '');
      setGrade(draft.grade);
      setDifficulty(draft.difficulty);
      setNumQuestions(draft.numQuestions);
      setPracticeFormat(draft.practiceFormat);
      setVietnameseCounts(draft.vietnameseCounts);
      setIncludeReading(draft.includeReading ?? true);
      setIncludeWriting(draft.includeWriting ?? true);
      setWritingFormat(draft.writingFormat);
      setGeneralCounts(draft.generalCounts);
      setSectionPoints(draft.sectionPoints);
      setWrittenSection(draft.writtenSection);
      setParagraphSection(draft.paragraphSection ?? '');
      setEssaySection(draft.essaySection || draft.writtenSection);
      setQuestions(draft.questions);
    } else {
      setQuestions([]);
    }
    setError('');
    setExpandedId(null);
    if (assessmentType === 'practice' && subject !== 'Tiếng Anh') {
      setNumQuestions((current) => Math.min(10, Math.max(5, current)));
    }
  }, [assessmentType, assignedSubjects, subject]);

  const isVietnamese = subject === 'Ngữ văn';
  const isEnglish = subject === 'Tiếng Anh';
  const hasReadingSection = assessmentType === 'official' && isVietnamese ? true : includeReading;
  const hasWritingSection = assessmentType === 'official' && isVietnamese ? true : includeWriting;
  const subjectExamples = getAISubjectExamples(subject);
  const assessmentTopic = assessmentType && isVietnamese
    ? readingMode === 'details'
      ? vietnameseReadingFields
        .map(({ key, label }) => readingDetails[key].trim() ? `${label}: ${readingDetails[key]}` : '')
        .filter(Boolean)
        .join('\n')
      : readingFullText
    : topic;
  const vietnameseWritingInstructions = writingFormat === 'paragraph-and-essay'
    ? [
      paragraphSection.trim() ? `Thông tin cho câu viết đoạn văn (Câu 1): ${paragraphSection.trim()}` : '',
      essaySection.trim() ? `Thông tin cho câu viết bài văn (Câu 2): ${essaySection.trim()}` : '',
    ].filter(Boolean).join('\n')
    : essaySection.trim() ? `Thông tin cho câu viết bài văn (Câu 1): ${essaySection.trim()}` : '';
  const currentCounts = isVietnamese
    ? assessmentType === 'practice'
      ? hasReadingSection ? vietnameseCounts : { recognition: 0, comprehension: 0, application: 0 }
      : hasReadingSection ? defaultVietnameseCounts : { recognition: 0, comprehension: 0, application: 0 }
    : generalCounts;
  const vietnameseCountsForAssessment = assessmentType === 'practice'
    ? hasReadingSection ? vietnameseCounts : { recognition: 0, comprehension: 0, application: 0 }
    : hasReadingSection ? defaultVietnameseCounts : { recognition: 0, comprehension: 0, application: 0 };
  const vietnameseWritingQuestionCount = writingFormat === 'paragraph-and-essay' ? 2 : 1;
  const vietnameseReadingQuestionCount = Object.values(currentCounts).reduce((total, count) => total + count, 0);
  const selectedVietnameseWritingQuestionCount = hasWritingSection ? vietnameseWritingQuestionCount : 0;
  const vietnameseBasePoints = [
    ...(hasReadingSection ? [0.5, 0.5, 1, 1, 1] : []),
    ...(hasWritingSection ? writingFormat === 'paragraph-and-essay' ? [2, 4] : [6] : []),
  ];
  const vietnamesePointScale = hasReadingSection && hasWritingSection
    ? 1
    : vietnameseBasePoints.length
      ? 10 / vietnameseBasePoints.reduce((total, points) => total + points, 0)
      : 0;
  const vietnameseQuestionPoints = vietnameseBasePoints.map((points) => points * vietnamesePointScale);
  const vietnameseReadingPointTotal = vietnameseQuestionPoints
    .slice(0, hasReadingSection ? vietnameseReadingQuestionCount : 0)
    .reduce((total, points) => total + points, 0);
  const vietnameseWritingPointTotal = vietnameseQuestionPoints
    .slice(hasReadingSection ? vietnameseReadingQuestionCount : 0)
    .reduce((total, points) => total + points, 0);
  const vietnameseQuestionCount = vietnameseReadingQuestionCount + selectedVietnameseWritingQuestionCount;
  const totalExamQuestions = isVietnamese
    ? assessmentType === 'practice'
      ? vietnameseQuestionCount
      : (hasReadingSection ? 5 : 0) + selectedVietnameseWritingQuestionCount
    : isEnglish ? numQuestions
    : Object.values(currentCounts).reduce((total, count) => total + count, 0);
  const sectionCounts: Record<GeneratedQuestionType, number> = {
    'multiple-choice': generalCounts.multipleChoice,
    'true-false': generalCounts.trueFalse,
    'short-answer': generalCounts.shortAnswer,
    essay: generalCounts.essay,
  };
  const totalSectionPoints = Object.values(sectionPoints).reduce((total, points) => total + points, 0);
  const sectionPointsValid = Object.values(sectionPoints).every((points) => Number.isFinite(points) && points >= 0)
    && Math.abs(totalSectionPoints - 10) < 0.000001
    && Object.entries(sectionPoints).every(([type, points]) => (
      sectionCounts[type as GeneratedQuestionType] > 0 ? points > 0 : points === 0
    ));
  const generatedStructureMatches = Object.entries(sectionCounts).every(([type, count]) => (
    questions.filter((question) => (question.type ?? 'multiple-choice') === type).length === count
  ));
  const distributedQuestions = examMode && !isVietnamese && !isEnglish
    ? distributeQuestionPoints(questions, sectionPoints)
    : questions;
  const examQuestionLimitExceeded = examMode && totalExamQuestions > 50;
  const vietnamesePracticeQuestionCountInvalid = assessmentType === 'practice'
    && isVietnamese
    && (totalExamQuestions < 1 || totalExamQuestions > 10);
  const requestedQuestionCount = assessmentType === 'practice' && isVietnamese
    ? totalExamQuestions
    : examMode || isEnglish ? totalExamQuestions : numQuestions;
  const examStructure = isVietnamese
    ? [
      hasReadingSection ? `Phần I: Đọc hiểu - Nhận biết: ${vietnameseCountsForAssessment.recognition} câu` : '',
      hasReadingSection ? `Phần I: Đọc hiểu - Thông hiểu: ${vietnameseCountsForAssessment.comprehension} câu` : '',
      hasReadingSection ? `Phần I: Đọc hiểu - Vận dụng: ${vietnameseCountsForAssessment.application} câu` : '',
      hasWritingSection ? `Phần II: Viết - ${writingFormat === 'paragraph-and-essay' ? 'viết đoạn văn và bài văn' : 'chỉ viết bài văn'}` : '',
    ].filter(Boolean)
    : isEnglish
      ? [
        `Trắc nghiệm Tiếng Anh: ${numQuestions} câu`,
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

  const persistAssessmentDraft = (overrides: Partial<GeneratedAssessmentDraft> = {}) => {
    if (!assessmentType) return;
    try {
      localStorage.setItem(assessmentDraftKey(assessmentType), JSON.stringify({
        topic: assessmentTopic,
        subject,
        readingMode,
        readingDetails,
        readingFullText,
        grade,
        difficulty,
        numQuestions,
        englishDefaultsApplied: true,
        practiceFormat,
        vietnameseCounts,
        includeReading,
        includeWriting,
        writingFormat,
        generalCounts,
        sectionPoints,
        writtenSection,
        paragraphSection,
        essaySection,
        questions,
        ...overrides,
      } satisfies GeneratedAssessmentDraft));
    } catch (draftError) {
      console.error('Không thể lưu cấu hình đề trong phiên này.', draftError);
    }
  };

  const handleGenerate = async () => {
    if (
      !(assessmentType && isVietnamese && !hasReadingSection)
      && !assessmentTopic.trim()
      && !(examMode && !isVietnamese && writtenSection.trim())
    ) return;
    if (examMode && !isVietnamese && !isEnglish && !sectionPointsValid) {
      setError('Tổng điểm các phần phải bằng 10; phần có câu hỏi phải có điểm, phần trống phải đặt 0.');
      return;
    }
    setGenerating(true);
    setQuestions([]);
    setSourceReferences([]);
    setError('');
    try {
      const requestTopic = assessmentType === 'practice'
        ? [
          `Bài tập tự luyện môn ${subject}.${hasReadingSection && assessmentTopic.trim() ? `\nThông tin bài đọc hiểu:\n${assessmentTopic}` : ''}`,
          isVietnamese ? [
            hasReadingSection
              ? `Phần I: Đọc hiểu gồm ${vietnameseCounts.recognition} câu mức độ nhận biết, ${vietnameseCounts.comprehension} câu mức độ thông hiểu, ${vietnameseCounts.application} câu mức độ vận dụng.`
              : 'Không tạo Phần I: Đọc hiểu.',
            hasWritingSection
              ? `Phần II: Viết gồm ${writingFormat === 'paragraph-and-essay' ? 'một câu viết đoạn văn và một câu viết bài văn' : 'một câu viết bài văn'}.`
              : 'Không tạo Phần II: Viết.',
            'Tất cả câu đều là tự luận; không tạo trắc nghiệm ABCD, đúng/sai hoặc trả lời ngắn.',
            'Đánh số câu liên tục trong từng phần. Không gộp nhiều câu vào một câu hỏi.',
            hasReadingSection && assessmentTopic.trim()
              ? `Thông tin bài đọc hiểu do giáo viên cung cấp:\n${assessmentTopic}\nDùng đúng thông tin ở từng trường; không tự suy diễn hoặc bịa nhan đề, tác giả, nguồn trích dẫn, xuất xứ hay vị trí. Nếu giáo viên cung cấp đoạn trích hoặc toàn văn, giữ nguyên từng chữ, dấu câu và cách viết; không sửa, rút gọn, diễn đạt lại hoặc thêm nội dung. Nếu đầu ra có phần văn bản/ngữ liệu, chép đầy đủ nguyên văn nội dung được cung cấp. Câu hỏi và đáp án đọc hiểu phải dựa trên chính văn bản đó.`
              : hasReadingSection ? 'Tìm nguồn đọc hiểu đáng tin cậy trên web; nếu không xác minh được văn bản/nguồn phù hợp thì không suy đoán hoặc tự viết thay văn bản.' : '',
            hasWritingSection
              ? writingFormat === 'paragraph-and-essay'
                ? 'Trong Phần II: Viết, Câu 1 phải là viết đoạn văn và Câu 2 phải là viết bài văn.'
                : 'Trong Phần II: Viết, Câu 1 là viết bài văn.'
              : '',
            hasWritingSection ? vietnameseWritingInstructions : '',
          ].join('\n') : '',
        ].filter(Boolean).join('\n')
        : examMode && isVietnamese
          ? [
            `Đề kiểm tra chính thức môn Ngữ văn luôn gồm đủ hai phần. Phần I: Đọc hiểu. Thông tin bài đọc hiểu:\n${assessmentTopic}`,
            hasReadingSection
              ? 'Phần I: Đọc hiểu gồm đúng 5 câu tự luận: câu 1-2 mức độ nhận biết; câu 3-4 mức độ thông hiểu; câu 5 mức độ vận dụng.'
              : 'Không tạo Phần I: Đọc hiểu.',
            hasWritingSection
              ? `Phần II: Viết gồm ${writingFormat === 'paragraph-and-essay' ? 'một yêu cầu viết đoạn văn và một yêu cầu viết bài văn' : 'một yêu cầu viết bài văn'}.`
              : 'Không tạo Phần II: Viết.',
            'Tất cả câu đều là tự luận, tuyệt đối không tạo trắc nghiệm ABCD, đúng/sai hoặc trả lời ngắn.',
            hasReadingSection && assessmentTopic.trim()
              ? `Thông tin bài đọc hiểu do giáo viên cung cấp:\n${assessmentTopic}\nDùng đúng thông tin ở từng trường; không tự suy diễn hoặc bịa nhan đề, tác giả, nguồn trích dẫn, xuất xứ hay vị trí. Nếu giáo viên cung cấp đoạn trích hoặc toàn văn, giữ nguyên từng chữ, dấu câu và cách viết; không sửa, rút gọn, diễn đạt lại hoặc thêm nội dung. Nếu đầu ra có phần văn bản/ngữ liệu, chép đầy đủ nguyên văn nội dung được cung cấp. Câu hỏi và đáp án đọc hiểu phải dựa trên chính văn bản đó.`
              : hasReadingSection ? 'Tìm nguồn đọc hiểu đáng tin cậy trên web; nếu không xác minh được văn bản/nguồn phù hợp thì không suy đoán hoặc tự viết thay văn bản.' : '',
            'Không ghi số câu hoặc tên phần ở đầu trường question; ứng dụng sẽ gắn nhãn phần, số câu và mức độ.',
            hasReadingSection && hasWritingSection
              ? 'Tổng điểm đề là 10: Phần I Đọc hiểu 4 điểm, Phần II Viết 6 điểm. Ứng dụng sẽ gán điểm cụ thể cho từng câu.'
              : 'Tổng điểm của phần được chọn là 10. Ứng dụng sẽ gán điểm cụ thể cho từng câu.',
            hasWritingSection
              ? writingFormat === 'paragraph-and-essay'
                ? 'Trong Phần II: Viết, Câu 1 phải là viết đoạn văn và Câu 2 phải là viết bài văn.'
                : 'Trong Phần II: Viết, Câu 1 là viết bài văn.'
              : '',
            hasWritingSection ? vietnameseWritingInstructions : '',
          ].filter(Boolean).join('\n')
        : examMode
        ? [
          `Nội dung/chủ đề của đề: ${assessmentTopic.trim()}`,
          `Cấu trúc đề yêu cầu: ${examStructure.join('; ')}.`,
          isEnglish ? 'Đảm bảo câu hỏi theo đúng thứ tự từng dạng, nội dung tiếng Anh phù hợp chương trình phổ thông Việt Nam.' : '',
          !isVietnamese && !isEnglish ? 'Tạo câu hỏi theo đúng nội dung và cơ cấu từng phần nêu trên.' : '',
        ].filter(Boolean).join('\n')
        : topic;
      const quantity = assessmentType === 'practice' && isVietnamese
        ? totalExamQuestions
        : examMode ? totalExamQuestions : numQuestions;
      const examQuestionStructure = examMode && isVietnamese
        ? [{ type: 'essay' as const, count: quantity }]
        : examMode && !isEnglish
          ? [
          { type: 'multiple-choice', count: generalCounts.multipleChoice },
          { type: 'true-false', count: generalCounts.trueFalse },
          { type: 'short-answer', count: generalCounts.shortAnswer },
          { type: 'essay', count: generalCounts.essay },
        ].filter((section) => section.count > 0)
        : undefined;
      const expectedTypes: GeneratedQuestionType[] = examQuestionStructure
        ? examQuestionStructure.flatMap(({ type, count }) => Array(count).fill(type as GeneratedQuestionType))
        : isVietnamese
          ? Array(quantity).fill('essay')
        : examMode
          ? Array(quantity).fill('multiple-choice')
          : assessmentType === 'practice' && practiceFormat === 'free'
            ? []
            : Array(quantity).fill(assessmentType === 'practice' ? practiceFormat as GeneratedQuestionType : 'multiple-choice');
      const response = await authenticatedFetch('/api/ai/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade,
          topic: requestTopic,
          quantity,
          difficulty,
          questionFormat: isVietnamese ? 'essay' : assessmentType === 'practice' ? practiceFormat : 'multiple-choice',
          subject,
          ...(examQuestionStructure ? { questionStructure: examQuestionStructure } : {}),
          useWebGrounding: Boolean(assessmentType && isVietnamese && hasReadingSection),
        }),
      });
      const result: {
        success: boolean;
        data?: QuizQuestion[];
        sources?: SourceReference[];
        message?: string;
      } = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Không thể tạo câu hỏi.');
      }
      const generatedSources = Array.isArray(result.sources) ? result.sources : [];
      setSourceReferences(generatedSources);
      if (result.data.length !== quantity) {
        throw new Error(`AI trả về ${result.data.length} câu, trong khi yêu cầu ${quantity} câu. Hãy thử tạo lại.`);
      }
      let normalizedQuestions = result.data.map(normalizeGeneratedQuestion);
      if (expectedTypes.length > 0) {
        const mismatchIndex = normalizedQuestions.findIndex((question, index) => question.type !== expectedTypes[index]);
        if (mismatchIndex >= 0) {
          throw new Error(
            `AI trả về dạng câu chưa đúng ở câu ${mismatchIndex + 1}: yêu cầu ${questionTypeLabel(expectedTypes[mismatchIndex])}, nhận ${questionTypeLabel(normalizedQuestions[mismatchIndex].type)}. Backend/API có thể chưa được cập nhật phiên bản hỗ trợ cấu trúc câu hỏi mới.`,
          );
        }
      }
      if (examMode && !isVietnamese && !isEnglish) {
        normalizedQuestions = distributeQuestionPoints(normalizedQuestions, sectionPoints);
      }
      if (examMode && isVietnamese) {
        const labels = vietnameseQuestionLabels(vietnameseCountsForAssessment, writingFormat, hasReadingSection, hasWritingSection);
        normalizedQuestions = normalizedQuestions.map((question, index) => ({
          ...question,
          question: `${labels[index]}: ${question.question}`,
          points: vietnameseQuestionPoints[index],
        }));
      } else if (assessmentType === 'practice' && isVietnamese) {
        const labels = vietnameseQuestionLabels(vietnameseCountsForAssessment, writingFormat, hasReadingSection, hasWritingSection);
        normalizedQuestions = normalizedQuestions.map((question, index) => ({
          ...question,
          question: `${labels[index]}: ${question.question}`,
        }));
      }
      setQuestions(normalizedQuestions);
      if (assessmentType) {
        try {
          localStorage.setItem(assessmentDraftKey(assessmentType), JSON.stringify({
            topic: assessmentTopic,
            subject,
            readingMode,
            readingDetails,
            readingFullText,
            grade,
            difficulty,
            numQuestions,
            englishDefaultsApplied: true,
            practiceFormat,
            vietnameseCounts,
            includeReading,
            includeWriting,
            writingFormat,
            generalCounts,
            sectionPoints,
            writtenSection,
            paragraphSection,
            essaySection,
            sourceReferences: generatedSources,
            questions: normalizedQuestions,
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
    `Câu ${i + 1} (${questionTypeLabel(q.type)}): ${q.question}\n${q.options.map((o, j) => `${String.fromCharCode(65 + j)}. ${o}`).join('\n')}\nĐáp án: ${q.correctAnswer || q.options[q.correctIndex] || q.correctAnswers?.map((answer, index) => `${String.fromCharCode(97 + index)} ${answer ? 'Đúng' : 'Sai'}`).join('; ') || ''}\nGiải thích: ${q.explanation}\n`
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

            {assessmentType && (
              <div className="mb-4 space-y-3 border-b border-slate-100 pb-4">
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold text-slate-700">Loại đề</legend>
                  <div className="grid grid-cols-1 gap-2">
                    {([
                      ['practice', 'Bài tập tự luyện ngắn (5–10 câu, tạo nhanh để ôn tập)'],
                      ['official', 'Bài kiểm tra chính thức (tùy chỉnh cấu trúc câu hỏi và điểm số)'],
                    ] as const).map(([value, label]) => (
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
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block min-w-0 text-xs font-medium text-slate-600">Khối lớp
                  <select value={grade} onChange={(event) => setGrade(event.target.value)} className="input-field mt-1 h-9 min-w-0 px-2 text-xs">
                    {['Khối 10', 'Khối 11', 'Khối 12'].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                {assessmentType === 'practice' && !isVietnamese && (
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
              {!assessmentType && <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  Môn học
                </label>
                <select
                  value={subject}
                  onChange={(event) => {
                    const nextSubject = event.target.value;
                    setSubject(nextSubject);
                    setNumQuestions(nextSubject === 'Tiếng Anh' ? 40 : 5);
                    setPracticeFormat(nextSubject === 'Tiếng Anh' ? 'multiple-choice' : 'free');
                    setQuestions([]);
                    setError('');
                    persistAssessmentDraft({ subject: nextSubject, questions: [] });
                  }}
                  className="input-field cursor-pointer"
                >
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>}

              {assessmentType && assignedSubjects.length > 1 && (
                <label className="block min-w-0 text-xs font-medium text-slate-600">Môn được phân công
                  <select
                    value={subject}
                    onChange={(event) => {
                      const nextSubject = event.target.value;
                      setSubject(nextSubject);
                      setNumQuestions(nextSubject === 'Tiếng Anh' ? 40 : 5);
                      setPracticeFormat(nextSubject === 'Tiếng Anh' ? 'multiple-choice' : 'free');
                      setQuestions([]);
                      setError('');
                      persistAssessmentDraft({ subject: nextSubject, questions: [] });
                    }}
                    className="input-field mt-1 h-9 min-w-0 px-2 text-xs"
                  >
                    {assignedSubjects.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              )}

              {assessmentType === 'practice' && isVietnamese && (
                <div className="grid gap-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeReading}
                      onChange={(event) => {
                        setIncludeReading(event.target.checked);
                        setQuestions([]);
                        persistAssessmentDraft({ includeReading: event.target.checked, questions: [] });
                      }}
                      className="h-4 w-4 accent-blue-600"
                    />
                    Phần I: Đọc hiểu
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeWriting}
                      onChange={(event) => {
                        setIncludeWriting(event.target.checked);
                        setQuestions([]);
                        persistAssessmentDraft({ includeWriting: event.target.checked, questions: [] });
                      }}
                      className="h-4 w-4 accent-blue-600"
                    />
                    Phần II: Viết
                  </label>
                </div>
              )}

              {!examMode && !assessmentType && <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  Khối lớp
                </label>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className="input-field cursor-pointer">
                  {['Khối 10','Khối 11','Khối 12'].map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>}

              {assessmentType && isVietnamese && !hasReadingSection ? null : <div>
                <label className={`${assessmentType && isVietnamese ? 'text-base font-semibold text-slate-700' : 'text-sm font-medium text-slate-600'} mb-1.5 flex items-center gap-1.5`}>
                  <Target className="w-3.5 h-3.5 text-slate-400" />
                  {assessmentType && isVietnamese ? 'Thông tin bài đọc hiểu' : 'Chủ đề / Nội dung'}
                </label>
                {assessmentType && isVietnamese ? (
                  <VietnameseReadingInput
                    mode={readingMode}
                    details={readingDetails}
                    fullText={readingFullText}
                    onModeChange={(nextMode) => {
                      setReadingMode(nextMode);
                      persistAssessmentDraft({ readingMode: nextMode });
                    }}
                    onDetailChange={(field, value) => {
                      const nextDetails = { ...readingDetails, [field]: value };
                      setReadingDetails(nextDetails);
                      persistAssessmentDraft({ readingDetails: nextDetails });
                    }}
                    onFullTextChange={(value) => {
                      setReadingFullText(value);
                      persistAssessmentDraft({ readingFullText: value });
                    }}
                  />
                ) : (
                  <textarea
                    value={topic}
                    onChange={(event) => {
                      setTopic(event.target.value);
                      if (assessmentType) persistAssessmentDraft({ topic: event.target.value });
                    }}
                    placeholder={examMode
                      ? `Nhập phạm vi kiến thức môn ${subject} muốn kiểm tra...`
                      : `Ví dụ: ${subjectExamples.topic}`}
                    rows={3}
                    className="input-field resize-none"
                  />
                )}
              </div>}

              {assessmentType && isVietnamese && (
                <section className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-800">
                      {assessmentType === 'practice' ? 'Cấu trúc bài tập Ngữ văn' : 'Cấu trúc đề Ngữ văn'}
                    </h4>
                    <span className="text-xs font-semibold text-blue-700">{requestedQuestionCount} câu</span>
                  </div>
                  {hasReadingSection && <div>
                    <p className="text-sm font-semibold text-slate-800">Phần I: Đọc hiểu</p>
                    {assessmentType === 'official' ? (
                      <div className="mt-1 space-y-1 text-sm text-slate-600">
                        <p>Câu 1-2: mức độ nhận biết</p>
                        <p>Câu 3-4: mức độ thông hiểu</p>
                        <p>Câu 5: mức độ vận dụng</p>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {([
                          ['recognition', 'Mức độ nhận biết'],
                          ['comprehension', 'Mức độ thông hiểu'],
                          ['application', 'Mức độ vận dụng'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center justify-between gap-3 text-xs text-slate-700">
                            {label}
                            <input
                              type="number"
                              min={0}
                              max={10}
                              value={vietnameseCounts[key]}
                              onChange={(event) => {
                                const nextCounts = {
                                  ...vietnameseCounts,
                                  [key]: Math.max(0, Math.min(10, Number(event.target.value) || 0)),
                                };
                                setVietnameseCounts(nextCounts);
                                setQuestions([]);
                                persistAssessmentDraft({ vietnameseCounts: nextCounts, questions: [] });
                              }}
                              className="input-field h-9 w-20 text-center"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>}
                  {hasWritingSection && <fieldset className="border-t border-blue-100 pt-2">
                    <legend className="mb-1.5 text-sm font-semibold text-slate-800">Phần II: Viết</legend>
                    {([
                      ['paragraph-and-essay', 'Viết đoạn văn + bài văn'],
                      ['essay-only', 'Chỉ viết bài văn'],
                    ] as const).map(([value, label]) => (
                      <label key={value} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-slate-700">
                        <input
                          type="radio"
                          name="vietnamese-practice-writing-format"
                          value={value}
                          checked={writingFormat === value}
                          onChange={() => {
                            setWritingFormat(value);
                            setQuestions([]);
                            setError('');
                            persistAssessmentDraft({ writingFormat: value, questions: [] });
                          }}
                          className="accent-blue-600"
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>}
                  {vietnamesePracticeQuestionCountInvalid && (
                    <p role="alert" className="text-xs font-medium text-rose-700">
                      Chọn ít nhất một phần và thiết lập tổng cộng 1-10 câu. Hiện có {totalExamQuestions} câu.
                    </p>
                  )}
                  {hasWritingSection && <div className="border-t border-blue-100 pt-2">
                    <p className="mb-2 text-sm font-semibold text-slate-700">Thông tin phần đoạn/bài văn</p>
                    <VietnameseWritingInputs
                      writingFormat={writingFormat}
                      paragraphSection={paragraphSection}
                      essaySection={essaySection}
                      onParagraphChange={(value) => {
                        setParagraphSection(value);
                        persistAssessmentDraft({ paragraphSection: value });
                      }}
                      onEssayChange={(value) => {
                        setEssaySection(value);
                        setWrittenSection(value);
                        persistAssessmentDraft({ essaySection: value, writtenSection: value });
                      }}
                    />
                  </div>}
                </section>
              )}

              {assessmentType === 'official' && !isVietnamese && (
                <div className="space-y-2.5 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-800">Cấu trúc đề</h4>
                    <span className="text-xs font-semibold text-blue-700">{totalExamQuestions} câu</span>
                  </div>
                  {isVietnamese ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Phần I: Đọc hiểu</p>
                        <div className="mt-1 space-y-1 text-sm text-slate-600">
                          <p>Câu 1-2: mức độ nhận biết</p>
                          <p>Câu 3-4: mức độ thông hiểu</p>
                          <p>Câu 5: mức độ vận dụng</p>
                        </div>
                      </div>
                      <fieldset className="border-t border-blue-100 pt-2">
                        <legend className="mb-1.5 text-sm font-semibold text-slate-800">Phần II: Viết</legend>
                        {([
                          ['paragraph-and-essay', 'Viết đoạn văn + bài văn'],
                          ['essay-only', 'Chỉ viết bài văn'],
                        ] as const).map(([value, label]) => (
                          <label key={value} className="flex cursor-pointer items-center gap-2 py-1 text-xs text-slate-700">
                            <input
                              type="radio"
                              name="vietnamese-writing-format"
                              value={value}
                              checked={writingFormat === value}
                              onChange={() => {
                                setWritingFormat(value);
                                setQuestions([]);
                                setError('');
                                persistAssessmentDraft({ writingFormat: value, questions: [] });
                              }}
                              className="accent-blue-600"
                            />
                            {label}
                          </label>
                        ))}
                      </fieldset>
                      <p className="rounded-md bg-white/80 px-2.5 py-2 text-xs text-slate-600">
                        Phân bổ mặc định 10 điểm: Đọc hiểu 4 điểm, Viết 6 điểm.
                      </p>
                      <div className="border-t border-blue-100 pt-2">
                        <p className="mb-2 text-sm font-semibold text-slate-700">Thông tin phần đoạn/bài văn</p>
                        <VietnameseWritingInputs
                          writingFormat={writingFormat}
                          paragraphSection={paragraphSection}
                          essaySection={essaySection}
                          onParagraphChange={(value) => {
                            setParagraphSection(value);
                            persistAssessmentDraft({ paragraphSection: value });
                          }}
                          onEssayChange={(value) => {
                            setEssaySection(value);
                            setWrittenSection(value);
                            persistAssessmentDraft({ essaySection: value, writtenSection: value });
                          }}
                        />
                      </div>
                    </div>
                  ) : isEnglish ? (
                    <p className="rounded-md bg-white/80 px-2.5 py-2 text-sm text-slate-600">
                      Mặc định: {numQuestions} câu trắc nghiệm Tiếng Anh.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {([
                          ['multipleChoice', 'Trắc nghiệm ABCD'],
                          ['trueFalse', 'Đúng / Sai - 4 ý a, b, c, d mỗi câu'],
                          ['shortAnswer', 'Trả lời ngắn'],
                          ['essay', 'Tự luận'],
                        ] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                            {label}
                            <input type="number" min={0} max={100} value={generalCounts[key]} onChange={(event) => setCount(setGeneralCounts, key, Number(event.target.value))} className="input-field h-9 w-20 text-center" />
                          </label>
                        ))}
                      </div>
                      <div className="space-y-2 border-t border-blue-100 pt-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">Tổng điểm từng phần</p>
                          <span className={`text-xs font-bold ${sectionPointsValid ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {totalSectionPoints.toFixed(2)} / 10 điểm
                          </span>
                        </div>
                        {([
                          ['multiple-choice', 'Phần I - Trắc nghiệm ABCD'],
                          ['true-false', 'Phần II - Đúng / Sai'],
                          ['short-answer', 'Phần III - Trả lời ngắn'],
                          ['essay', 'Phần IV - Tự luận'],
                        ] as const).map(([type, label]) => (
                          <label key={type} className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 text-xs text-slate-700">
                            <span>{label} <span className="text-slate-400">({sectionCounts[type]} câu - {sectionCounts[type] ? (sectionPoints[type] / sectionCounts[type]).toFixed(2) : '0.00'} điểm/câu)</span></span>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              step={0.25}
                              value={sectionPoints[type]}
                              onChange={(event) => setSectionPoints((current) => ({
                                ...current,
                                [type]: Math.max(0, Number(event.target.value) || 0),
                              }))}
                              aria-label={`${label}, tổng điểm phần`}
                              className="input-field h-9 w-20 text-center"
                            />
                          </label>
                        ))}
                        {!sectionPointsValid && (
                          <p className="text-xs font-medium text-rose-700">
                            Tổng điểm phải bằng 10; phần có câu hỏi cần điểm lớn hơn 0 và phần trống cần đặt 0.
                          </p>
                        )}
                        {questions.length > 0 && !generatedStructureMatches && (
                          <p className="text-xs font-medium text-rose-700">
                            Số câu đã thay đổi; hãy tạo lại đề trước khi lưu.
                          </p>
                        )}
                      </div>
                    </>
                  )}
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

              {!examMode && (!assessmentType || (assessmentType === 'practice' && !isVietnamese)) && <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    Số câu {isEnglish && <span className="text-xs font-normal text-slate-400">(mặc định 40 trắc nghiệm)</span>}
                    {assessmentType === 'practice' && !isEnglish && <span className="text-xs font-normal text-slate-400">(5–10)</span>}
                  </span>
                  <span className="text-blue-600 font-semibold tabular-nums">{numQuestions}</span>
                </label>
                <input
                  type="range"
                  min={assessmentType === 'practice' && !isEnglish ? 5 : isEnglish ? 1 : 3}
                  max={assessmentType === 'practice' && !isEnglish ? 10 : isEnglish ? 50 : 15}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-sm text-slate-400 mt-0.5">
                  <span>{assessmentType === 'practice' && !isEnglish ? 5 : isEnglish ? 1 : 3}</span>
                  <span>{assessmentType === 'practice' && !isEnglish ? 10 : isEnglish ? 50 : 15}</span>
                </div>
              </div>}

              {examQuestionLimitExceeded && <p role="alert" className="text-sm text-rose-700">Đề thi tối đa 50 câu. Hãy giảm số câu trong cấu trúc đề.</p>}
              <button onClick={handleGenerate} disabled={(!(assessmentType && isVietnamese && !hasReadingSection) && !assessmentTopic.trim() && !(examMode && !isVietnamese && writtenSection.trim())) || generating || vietnamesePracticeQuestionCountInvalid || (examMode && (totalExamQuestions === 0 || examQuestionLimitExceeded || (!isVietnamese && !isEnglish && !sectionPointsValid)))} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
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
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button onClick={handleGenerate} className="btn-ghost">
                    <RefreshCw className="w-3.5 h-3.5" /> Tạo lại
                  </button>
                  <button onClick={handleDownload} className="btn-outline">
                    <Download className="w-3.5 h-3.5" /> Tải xuống
                  </button>
                  <button
                    disabled={examMode && !isVietnamese && !isEnglish && (!sectionPointsValid || !generatedStructureMatches)}
                    onClick={() => onSaveQuestions({
                    topic: assessmentTopic.trim()
                      || (isVietnamese && hasWritingSection ? vietnameseWritingInstructions.slice(0, 80) : '')
                      || (examMode ? writtenSection.trim().slice(0, 80) : topic),
                    subject,
                    grade,
                    questions: distributedQuestions,
                    sourceReferences,
                    ...(examMode ? {
                      durationMinutes: null,
                      structureSummary: examStructure,
                      sectionPoints: !isVietnamese && !isEnglish ? sectionPoints : undefined,
                      writtenSection: hasWritingSection ? vietnameseWritingInstructions || writtenSection : '',
                    } : {}),
                  })}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> {saveLabel}
                  </button>
                </div>
              </div>

              {sourceReferences.length > 0 && (
                <section className="card space-y-2 p-4">
                  <h4 className="text-sm font-semibold text-slate-800">Nguồn đã dùng để kiểm chứng</h4>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {sourceReferences.map((source) => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {examMode && isVietnamese && (
                <div className="card grid gap-2 p-3 text-xs sm:grid-cols-2">
                  {hasReadingSection && (
                    <div>
                      <p className="font-semibold text-slate-800">Phần I: Đọc hiểu - {vietnameseReadingPointTotal.toFixed(2)} điểm</p>
                      <p className="mt-1 text-slate-600">Câu 1-2: nhận biết · Câu 3-4: thông hiểu · Câu 5: vận dụng</p>
                    </div>
                  )}
                  {hasWritingSection && (
                    <div>
                      <p className="font-semibold text-slate-800">Phần II: Viết - {vietnameseWritingPointTotal.toFixed(2)} điểm</p>
                      <p className="mt-1 text-slate-600">
                        {writingFormat === 'paragraph-and-essay'
                          ? `Viết đoạn văn (${vietnameseQuestionPoints[hasReadingSection ? 5 : 0]?.toFixed(2)} điểm) + bài văn (${vietnameseQuestionPoints[hasReadingSection ? 6 : 1]?.toFixed(2)} điểm)`
                          : `Chỉ viết bài văn (${vietnameseWritingPointTotal.toFixed(2)} điểm)`}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {questions.map((q, i) => {
                const expanded = expandedId === q.id;
                const displayedQuestion = distributedQuestions[i];
                return (
                  <div key={q.id} className="card overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 font-semibold text-sm flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="mb-1 text-[0.6875rem] font-semibold text-blue-700">
                                {questionTypeLabel(q.type)}{examMode && ` - ${Number(displayedQuestion.points?.toFixed(2) ?? 0)} điểm`}
                              </p>
                              <MathText text={q.question} className="font-medium text-slate-800 text-sm leading-relaxed" />
                            </div>
                          </div>
                          {q.type === 'multiple-choice' && <div className="mt-2.5 space-y-1.5">
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
                                <MathText
                                  text={opt}
                                  className={`min-w-0 flex-1 ${expanded && j === q.correctIndex ? 'text-green-800 font-medium' : 'text-slate-600'}`}
                                />
                                {expanded && j === q.correctIndex && <Check className="w-3.5 h-3.5 text-green-600 ml-auto" />}
                              </div>
                            ))}
                          </div>}
                          {q.type === 'true-false' && <div className="mt-2.5 space-y-1.5">
                            {q.options.map((statement, statementIndex) => (
                              <div key={statementIndex} className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm ${
                                expanded ? q.correctAnswers?.[statementIndex] ? 'border-green-200 bg-green-50' : 'border-rose-100 bg-rose-50' : 'border-transparent bg-slate-50'
                              }`}>
                                <span className="shrink-0 font-semibold text-slate-500">{String.fromCharCode(97 + statementIndex)}.</span>
                                <MathText text={statement} className="min-w-0 flex-1 text-slate-700" />
                                {expanded && <span className="shrink-0 text-xs font-semibold">{q.correctAnswers?.[statementIndex] ? 'Đúng' : 'Sai'}</span>}
                              </div>
                            ))}
                          </div>}

                          {expanded && (
                            <div className="mt-2.5 p-3 rounded-md bg-amber-50 border border-amber-100 animate-fadeIn">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                  {q.type !== 'multiple-choice' && q.type !== 'true-false' && (
                                    <>
                                      <p className="text-sm font-semibold text-amber-700 mb-0.5">Đáp án tham khảo</p>
                                      <MathText text={q.correctAnswer ?? ''} className="mb-2 text-sm text-amber-900/80 leading-relaxed" />
                                    </>
                                  )}
                                  <p className="text-sm font-semibold text-amber-700 mb-0.5">Giải thích</p>
                                  <MathText text={q.explanation} className="text-sm text-amber-900/80 leading-relaxed" />
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
    </div>
  );
}

function MathText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
