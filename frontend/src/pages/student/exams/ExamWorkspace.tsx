import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  Mic,
  Send,
  Video,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { examQuestions } from './examQuestions';

type QuestionLayout = 'vertical' | 'horizontal';

interface ExamWorkspaceProps {
  examTitle: string;
  subject: string;
  stream: MediaStream;
  onSubmit: (summary: ExamSubmissionSummary) => void;
  onExit: () => void;
}

export interface ExamSubmissionSummary {
  answered: number;
  total: number;
  correct: number;
  wrong: number;
  answers: Record<number, string>;
  images: Record<number, EssayImageAttachment[]>;
  durationSeconds: number;
  submittedAt: string;
  submitReason: string;
  offscreenViolations: number;
  totalOffscreenSeconds: number;
  auditSaved: boolean;
}

export interface EssayImageAttachment {
  name: string;
  dataUrl: string;
}

const examDurationSeconds = 30 * 60;
const examAuditStorageKey = 'eduflow-exam-security-audit';

const mathSymbols = [
  { label: '½', name: 'Phân số', latex: '\\frac{|}{}' },
  { label: '√x', name: 'Căn thức', latex: '\\sqrt{|}' },
  { label: 'x²', name: 'Lũy thừa', latex: 'x^{|}' },
  { label: 'xₙ', name: 'Chỉ số dưới', latex: 'x_{|}' },
  { label: '∫', name: 'Tích phân', latex: '\\int_{|}^{}' },
  { label: '∑', name: 'Tổng', latex: '\\sum_{|}^{}' },
  { label: 'π', name: 'Pi', latex: '\\pi' },
  { label: '∞', name: 'Vô cực', latex: '\\infty' },
  { label: '±', name: 'Cộng trừ', latex: '\\pm' },
  { label: '≤', name: 'Nhỏ hơn hoặc bằng', latex: '\\le' },
  { label: '≥', name: 'Lớn hơn hoặc bằng', latex: '\\ge' },
  { label: 'θ', name: 'Theta', latex: '\\theta' },
];

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error(`Không thể đọc ảnh ${file.name}.`));
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Không thể đọc ảnh ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function MathToolbar({ onInsert }: { onInsert: (latex: string) => void }) {
  return (
    <div aria-label="Thanh công cụ ký hiệu toán học" className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-600">Ký hiệu toán học</p>
      <div className="flex flex-wrap gap-1.5">
        {mathSymbols.map((symbol) => (
          <button
            key={symbol.name}
            type="button"
            title={symbol.name}
            aria-label={`Chèn ${symbol.name}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onInsert(symbol.latex)}
            className="min-w-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {symbol.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MathPreview({ value, shortAnswer = false }: { value: string; shortAnswer?: boolean }) {
  const trimmedValue = value.trim();
  const preview = shortAnswer && trimmedValue && !trimmedValue.includes('$')
    ? `$${trimmedValue}$`
    : value;

  return (
    <section aria-label="Xem trước công thức" className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
      <p className="mb-2 text-xs font-semibold text-blue-800">Xem trước công thức</p>
      {preview.trim() ? (
        <div className="min-h-8 overflow-x-auto text-slate-800">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{preview}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-slate-400">Công thức sẽ hiển thị tại đây khi em nhập bài.</p>
      )}
    </section>
  );
}

export function ExamWorkspace({ examTitle, subject, stream, onSubmit, onExit }: ExamWorkspaceProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionLayout, setQuestionLayout] = useState<QuestionLayout>('vertical');
  const [secondsLeft, setSecondsLeft] = useState(examDurationSeconds);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [securityAlert, setSecurityAlert] = useState('');
  const [policyViolationSummary, setPolicyViolationSummary] = useState<ExamSubmissionSummary | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [essayImages, setEssayImages] = useState<Record<number, EssayImageAttachment[]>>({});
  const [ocrStatus, setOcrStatus] = useState<Record<number, string>>({});
  const gradeLabel = examTitle.match(/khối\s*\d+/i)?.[0] ?? 'Khối 11';
  const videoRef = useRef<HTMLVideoElement>(null);
  const answerFields = useRef<Record<number, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const wasFullscreen = useRef(Boolean(document.fullscreenElement));
  const offscreenStartedAt = useRef<number | null>(null);
  const offscreenViolationCount = useRef(0);
  const filePickerOpen = useRef(false);
  const submitted = useRef(false);
  const audioWarningShown = useRef(false);
  const answeredCount = new Set([
    ...Object.keys(answers),
    ...Object.keys(essayImages),
  ]).size;
  const isTimeLow = secondsLeft < 5 * 60;

  const answeredQuestions = useMemo(
    () => new Set([...Object.keys(answers), ...Object.keys(essayImages)].map(Number)),
    [answers, essayImages],
  );

  const submitExam = useCallback((submitReason = 'Học sinh chủ động nộp bài') => {
    if (submitted.current) return;
    submitted.current = true;
    const correct = examQuestions.filter((item) => {
      const answer = answers[item.id];
      if (!answer) return false;
      if (item.kind === 'true-false') {
        try {
          const submitted = JSON.parse(answer) as Record<number, string>;
          const expected = item.correctAnswer as Record<number, string>;
          return Object.keys(expected).length === Object.keys(submitted).length
            && Object.entries(expected).every(([key, value]) => submitted[Number(key)] === value);
        } catch {
          return false;
        }
      }
      return typeof item.correctAnswer === 'string'
        && answer.trim().toLocaleLowerCase('vi') === item.correctAnswer.trim().toLocaleLowerCase('vi');
    }).length;
    const submittedAt = new Date().toISOString();
    const totalOffscreenSeconds = Math.floor(
      (offscreenStartedAt.current === null ? 0 : Date.now() - offscreenStartedAt.current) / 1000,
    );
    const audit = {
      examTitle,
      submittedAt,
      reason: submitReason,
      offscreenViolations: offscreenViolationCount.current,
      totalOffscreenSeconds,
    };
    let auditSaved = true;
    try {
      const previous = JSON.parse(localStorage.getItem(examAuditStorageKey) ?? '[]') as unknown;
      const records = Array.isArray(previous) ? previous : [];
      localStorage.setItem(examAuditStorageKey, JSON.stringify([...records.slice(-49), audit]));
    } catch (error) {
      auditSaved = false;
      console.error('Không thể lưu nhật ký vi phạm bài thi vào bộ nhớ trình duyệt.', error);
    }
    const summary = {
      answered: answeredCount,
      total: examQuestions.length,
      correct,
      wrong: examQuestions.length - correct,
      answers,
      images: essayImages,
      durationSeconds: examDurationSeconds - secondsLeft,
      submittedAt,
      submitReason,
      offscreenViolations: offscreenViolationCount.current,
      totalOffscreenSeconds,
      auditSaved,
    };
    if (offscreenViolationCount.current > 0) {
      setPolicyViolationSummary(summary);
      return;
    }
    onSubmit(summary);
  }, [answeredCount, answers, essayImages, examTitle, onSubmit, secondsLeft]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((remaining) => {
        if (remaining <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) submitExam('Hết thời gian làm bài');
  }, [secondsLeft, submitExam]);

  useEffect(() => {
    const submitForOffscreenViolation = (reason: string) => {
      if (submitted.current) return;
      offscreenStartedAt.current = Date.now();
      offscreenViolationCount.current += 1;
      submitExam(reason);
    };
    const handleVisibility = () => {
      if (document.hidden) submitForOffscreenViolation('Vi phạm chuyển sang tab hoặc ứng dụng khác');
    };
    const handleBlur = () => {
      if (!filePickerOpen.current) {
        submitForOffscreenViolation('Vi phạm rời khỏi cửa sổ bài thi');
      }
    };
    const handleFocus = () => {
      filePickerOpen.current = false;
    };
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        wasFullscreen.current = true;
        setIsFullscreen(true);
        return;
      }
      if (!wasFullscreen.current) return;
      wasFullscreen.current = false;
      setIsFullscreen(false);
      submitForOffscreenViolation('Vi phạm thoát chế độ toàn màn hình');
    };
    const handleShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(key)) event.preventDefault();
      if ((event.shiftKey && key === 'insert') || (event.ctrlKey && key === 'insert') || key === 'contextmenu') event.preventDefault();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('keydown', handleShortcut, true);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('keydown', handleShortcut, true);
    };
  }, [submitExam]);

  useEffect(() => {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setSecurityAlert('Không phát hiện micro trong phiên thi. Hãy liên hệ giáo viên nếu đây là nhầm lẫn.');
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const source = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let loudSince = 0;
    let animationFrame = 0;

    const checkAudioLevel = () => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
      if (rms > 0.06) {
        if (!loudSince) loudSince = Date.now();
        if (Date.now() - loudSince >= 1200 && !audioWarningShown.current) {
          audioWarningShown.current = true;
          setSecurityAlert('Micro phát hiện âm thanh trong phòng thi. Hãy giữ yên lặng và tiếp tục làm bài. Âm thanh chỉ được phân tích mức âm lượng trên thiết bị, không ghi âm hay gửi đi.');
        }
      } else {
        loudSince = 0;
      }
      animationFrame = window.requestAnimationFrame(checkAudioLevel);
    };

    void audioContext.resume().then(checkAudioLevel).catch((error: unknown) => {
      setSecurityAlert(error instanceof Error
        ? `Không thể kiểm tra mức âm thanh từ micro: ${error.message}`
        : 'Không thể kiểm tra mức âm thanh từ micro.');
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      source.disconnect();
      analyser.disconnect();
      void audioContext.close();
    };
  }, [stream]);

  function setAnswer(questionId: number, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function setTrueFalse(questionId: number, statementIndex: number, value: 'Đúng' | 'Sai') {
    const current = answers[questionId] ? JSON.parse(answers[questionId]) as Record<number, string> : {};
    setAnswer(questionId, JSON.stringify({ ...current, [statementIndex]: value }));
  }

  async function attachImage(questionId: number, files: FileList | null) {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    setOcrStatus((current) => ({ ...current, [questionId]: 'Đang nhận diện chữ trong ảnh trên thiết bị...' }));

    try {
      const attachments = await Promise.all(selectedFiles.map(async (file) => ({
        name: file.name,
        dataUrl: await readImageAsDataUrl(file),
      })));
      setEssayImages((current) => ({
        ...current,
        [questionId]: [...(current[questionId] ?? []), ...attachments],
      }));
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('vie+eng');
      let recognizedText: string;
      try {
        const results = await Promise.all(selectedFiles.map((file) => worker.recognize(file)));
        recognizedText = results
          .map((result) => result.data.text.trim())
          .filter(Boolean)
          .join('\n\n');
      } finally {
        await worker.terminate();
      }

      if (recognizedText) {
        setAnswers((current) => ({
          ...current,
          [questionId]: [current[questionId]?.trim(), recognizedText].filter(Boolean).join('\n\n'),
        }));
        setOcrStatus((current) => ({ ...current, [questionId]: 'Đã nhận diện nội dung và chèn vào bài làm. Vui lòng kiểm tra lại công thức.' }));
      } else {
        setOcrStatus((current) => ({ ...current, [questionId]: 'Không nhận diện được chữ trong ảnh. Em có thể nhập bài làm trực tiếp.' }));
      }
    } catch (error) {
      console.error('Không thể nhận diện chữ trong ảnh bài làm.', error);
      setOcrStatus((current) => ({
        ...current,
        [questionId]: error instanceof Error
          ? `Không thể nhận diện ảnh: ${error.message}`
          : 'Không thể nhận diện ảnh. Em có thể nhập bài làm trực tiếp.',
      }));
    }
  }

  function insertMath(questionId: number, fragment: string, wrapInMath: boolean) {
    const field = answerFields.current[questionId];
    const currentAnswer = answers[questionId] ?? '';
    const selectionStart = field?.selectionStart ?? currentAnswer.length;
    const selectionEnd = field?.selectionEnd ?? selectionStart;
    const fragmentWithMath = wrapInMath ? `$${fragment}$` : fragment;
    const cursorMarker = fragmentWithMath.indexOf('|');
    const insertion = fragmentWithMath.replace('|', '');
    const nextAnswer = `${currentAnswer.slice(0, selectionStart)}${insertion}${currentAnswer.slice(selectionEnd)}`;

    setAnswer(questionId, nextAnswer);
    window.requestAnimationFrame(() => {
      const updatedField = answerFields.current[questionId];
      if (!updatedField) return;
      const cursorPosition = selectionStart + (cursorMarker < 0 ? insertion.length : cursorMarker);
      updatedField.focus();
      updatedField.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  return createPortal(
    <main
      className="fixed inset-0 z-[2147483000] flex min-h-0 select-none flex-col overflow-hidden bg-slate-100"
      onContextMenu={(event) => event.preventDefault()}
      onCopy={(event) => event.preventDefault()}
      onCut={(event) => event.preventDefault()}
      onPaste={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white"><BookIcon /></span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-blue-700">EduFlow</p>
            <p className="max-w-[70vw] text-sm font-semibold leading-5 text-slate-800 sm:max-w-[calc(100vw-220px)] sm:text-base">{subject} - {examTitle} - {gradeLabel}</p>
          </div>
        </div>
        <button type="button" onClick={onExit} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Thoát bài thi</span>
        </button>
      </header>

      {!isFullscreen && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Bài thi hiện không ở chế độ toàn màn hình. Hệ thống đã ghi nhận sự việc.
        </div>
      )}
      {securityAlert && (
        <div className="fixed inset-0 z-[2147483001] flex h-dvh w-screen items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]" role="presentation">
          <section role="alertdialog" aria-modal="true" aria-labelledby="exam-security-alert-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><AlertTriangle className="h-5 w-5" /></span>
            </div>
            <h2 id="exam-security-alert-title" className="mt-3 text-lg font-bold text-slate-900">Nhắc nhở trong phòng thi</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{securityAlert}</p>
            <button type="button" autoFocus onClick={() => setSecurityAlert('')} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700">Đã hiểu</button>
          </section>
        </div>
      )}
      {policyViolationSummary && (
        <div className="fixed inset-0 z-[2147483003] flex h-dvh w-screen items-center justify-center bg-slate-950/80 p-4" role="presentation">
          <section role="alertdialog" aria-modal="true" aria-labelledby="exam-violation-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><AlertTriangle className="h-5 w-5" /></span>
            <h2 id="exam-violation-title" className="mt-3 text-lg font-bold text-slate-900">Vi phạm quy chế thi</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Bạn đã vi phạm quy chế thi: thoát màn hình máy tính. Bài thi đã được tự động nộp. Nhấn nút bên dưới để xem kết quả.</p>
            <button type="button" autoFocus onClick={() => onSubmit(policyViolationSummary)} className="mt-5 w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700">Xem kết quả</button>
          </section>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden">
        <section className="min-w-0 space-y-4 p-3 sm:p-5 lg:overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-slate-700">Cách hiển thị câu hỏi</p>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button type="button" onClick={() => setQuestionLayout('vertical')} aria-pressed={questionLayout === 'vertical'} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${questionLayout === 'vertical' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>Trải dọc</button>
              <button type="button" onClick={() => setQuestionLayout('horizontal')} aria-pressed={questionLayout === 'horizontal'} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${questionLayout === 'horizontal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}>Ngang</button>
            </div>
          </div>

          {(questionLayout === 'vertical' ? examQuestions : [examQuestions[currentIndex]]).map((item) => {
            const answerState = item.kind === 'true-false' && answers[item.id]
              ? JSON.parse(answers[item.id]) as Record<number, string>
              : {};
            return (
              <article id={`exam-question-${item.id}`} key={item.id} className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Câu {item.id}</h2>
                  <span className="text-sm font-medium text-slate-800">({item.points.toFixed(1)} điểm)</span>
                </div>

                <h3 className="mb-5 text-lg font-semibold leading-8 text-slate-900 sm:text-xl">{item.prompt}</h3>

                {item.kind === 'choice' && (
                  <div className="grid gap-3">
                    {item.options?.map((option, index) => {
                      const selected = answers[item.id] === String(index);
                      return (
                        <button key={option} type="button" onClick={() => setAnswer(item.id, String(index))} className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-left text-base transition ${selected ? 'border-blue-400 bg-blue-50 text-blue-900 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-600'}`}>{String.fromCharCode(65 + index)}</span>
                          <span className="flex-1">{option}</span>
                          {selected && <Check className="h-5 w-5 text-blue-700" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {item.kind === 'true-false' && (
                  <div className="space-y-3">
                    {item.statements?.map((statement, index) => (
                      <div key={statement} className="grid gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <p className="text-base leading-7 text-slate-700"><strong className="mr-2 text-slate-900">{String.fromCharCode(97 + index)}.</strong>{statement}</p>
                        <div className="flex gap-2">
                          {(['Đúng', 'Sai'] as const).map((value) => (
                            <button key={value} type="button" onClick={() => setTrueFalse(item.id, index, value)} aria-pressed={answerState[index] === value} className={`min-w-20 rounded-lg border px-4 py-2 text-sm font-semibold transition ${answerState[index] === value ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{value}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {item.kind === 'short' && (
                  <div className="space-y-3">
                    <MathToolbar onInsert={(latex) => insertMath(item.id, latex, false)} />
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Câu trả lời ngắn (có thể nhập LaTeX)</span>
                      <input
                        ref={(element) => { answerFields.current[item.id] = element; }}
                        value={answers[item.id] ?? ''}
                        onChange={(event) => setAnswer(item.id, event.target.value)}
                        placeholder="Nhập đáp án hoặc chèn ký hiệu toán học"
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-base outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <MathPreview value={answers[item.id] ?? ''} shortAnswer />
                  </div>
                )}

                {item.kind === 'essay' && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">Viết lời giải bằng văn bản, chèn công thức từ thanh công cụ hoặc tải ảnh bài làm để nhận diện chữ tự động.</p>
                    <MathToolbar onInsert={(latex) => insertMath(item.id, latex, true)} />
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Bài làm</span>
                      <textarea
                        ref={(element) => { answerFields.current[item.id] = element; }}
                        value={answers[item.id] ?? ''}
                        onChange={(event) => setAnswer(item.id, event.target.value)}
                        rows={6}
                        placeholder="Trình bày lời giải bằng văn bản; dùng thanh công cụ để chèn công thức..."
                        className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-base leading-7 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <MathPreview value={answers[item.id] ?? ''} />
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-300 bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
                        <Camera className="h-4 w-4" /> Upload / Chụp ảnh bài làm
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          onClick={() => { filePickerOpen.current = true; }}
                          onChange={(event) => {
                            filePickerOpen.current = false;
                            void attachImage(item.id, event.target.files);
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500">Ảnh được nhận diện trên thiết bị của em; nội dung công thức có thể cần chỉnh sửa lại.</p>
                    {essayImages[item.id]?.length > 0 && <p className="text-sm text-emerald-700">Ảnh đã đính kèm: {essayImages[item.id].map((image) => image.name).join(', ')}</p>}
                    {ocrStatus[item.id] && <p role="status" className="text-sm text-blue-700">{ocrStatus[item.id]}</p>}
                  </div>
                )}

                {questionLayout === 'horizontal' && (
                  <footer className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                    <button type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">
                      <ArrowLeft className="h-4 w-4" /> Câu trước
                    </button>
                    <button type="button" onClick={() => currentIndex === examQuestions.length - 1 ? setConfirmSubmit(true) : setCurrentIndex((index) => index + 1)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
                      {currentIndex === examQuestions.length - 1 ? 'Hoàn thành' : 'Câu tiếp theo'} <ArrowRight className="h-4 w-4" />
                    </button>
                  </footer>
                )}
              </article>
            );
          })}
        </section>

        <aside className="min-w-0 space-y-3 border-t border-slate-200 bg-white p-3 sm:p-4 lg:overflow-y-auto lg:border-l lg:border-t-0">
          <section className={`rounded-xl border p-3 ${isTimeLow ? 'border-rose-200 bg-rose-50' : 'border-blue-100 bg-blue-50'}`}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Clock3 className="h-4 w-4" /> Thời gian còn lại</p>
            <p className={`mt-1 text-2xl font-extrabold tabular-nums ${isTimeLow ? 'text-rose-700' : 'text-blue-800'}`}>{formatDuration(secondsLeft)}</p>
          </section>

          <section className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-800">Ma trận câu hỏi</h2>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1.5">
              {examQuestions.map((item, index) => (
                <button key={item.id} type="button" onClick={() => {
                  setCurrentIndex(index);
                  if (questionLayout === 'vertical') document.getElementById(`exam-question-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }} aria-label={`Đi đến câu ${item.id}`} aria-current={currentIndex === index ? 'step' : undefined} className={`flex aspect-square items-center justify-center rounded-md text-xs font-bold transition ${currentIndex === index ? 'bg-blue-600 text-white ring-2 ring-blue-200' : answeredQuestions.has(item.id) ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {item.id}
                </button>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-3 py-2">
              <h2 className="text-xs font-bold text-slate-800">Webcam giám sát</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Thiết bị bật</span>
            </div>
            <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full bg-slate-950 object-cover" />
            <div className="flex items-center gap-3 px-3 py-2 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><Video className="h-3 w-3" /> Camera</span><span className="inline-flex items-center gap-1"><Mic className="h-3 w-3" /> Micro</span></div>
          </section>

          <button type="button" onClick={() => setConfirmSubmit(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700">
            <Send className="h-4 w-4" /> Nộp bài
          </button>
        </aside>
      </div>

      {confirmSubmit && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="submit-exam-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><AlertTriangle className="h-5 w-5" /></span>
            <h2 id="submit-exam-title" className="mt-3 text-lg font-bold text-slate-900">Nộp bài thi?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Em đã trả lời {answeredCount}/{examQuestions.length} câu. Sau khi nộp, em không thể chỉnh sửa bài làm.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmSubmit(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Tiếp tục làm</button>
              <button type="button" onClick={() => submitExam()} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700">Nộp bài</button>
            </div>
          </section>
        </div>
      )}
    </main>,
    document.body,
  );
}

function BookIcon() {
  return <CheckCircle2 className="h-4 w-4" />;
}
