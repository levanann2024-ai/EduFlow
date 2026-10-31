import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  Smartphone,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import type { ExamQuestion } from './examQuestions';
import { authenticatedFetch } from '@/auth/authApi';
import {
  createStudentExamMobileUploadSession,
  deleteStudentExamMobileUpload,
  getStudentExamMobileUploadStatus,
  type StudentExamEventType,
  type StudentExamRoom,
} from '@/api/schoolApi';

type QuestionLayout = 'vertical' | 'horizontal';

const fallbackSectionLabels: Record<ExamQuestion['kind'], { title: string; instruction: string }> = {
  choice: { title: 'Trắc nghiệm nhiều phương án', instruction: 'Thí sinh chọn một phương án đúng cho mỗi câu.' },
  'true-false': { title: 'Trắc nghiệm đúng / sai', instruction: 'Thí sinh chọn đúng hoặc sai cho từng ý.' },
  short: { title: 'Trắc nghiệm trả lời ngắn', instruction: 'Thí sinh ghi câu trả lời ngắn cho từng câu.' },
  essay: { title: 'Tự luận', instruction: 'Thí sinh trình bày lời giải và lập luận.' },
};

function formatPoints(points: number) {
  return Number(points.toFixed(2)).toString();
}

interface ExamWorkspaceProps {
  examTitle: string;
  subject: string;
  roomCode: string;
  questions: ExamQuestion[];
  durationMinutes: number;
  startedAt: string;
  roomStartsAt: string;
  sessionId: string;
  settings: StudentExamRoom['settings'];
  stream: MediaStream;
  onEvent: (eventType: StudentExamEventType) => Promise<void>;
  onSubmit: (summary: ExamSubmissionSummary) => Promise<void>;
  onExit: () => void;
}

export interface ExamSubmissionSummary {
  answered: number;
  total: number;
  correct?: number;
  wrong?: number;
  answers: Record<number, string>;
  images: Record<number, EssayImageAttachment[]>;
  files: Array<{ questionNumber: number; file: File }>;
  mobileUploadTokens: string[];
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

interface LocalEssayImage extends EssayImageAttachment {
  id: string;
  file: File | null;
  uploadToken?: string;
}

interface ActiveMobileUpload {
  token: string;
  questionNumber: number;
  expiresAt: string;
}

const examAuditStorageKey = 'eduflow-exam-security-audit';
const maxEssayImages = 5;
const maxEssayImageBytes = 10 * 1024 * 1024;

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

function createLocalImageId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `essay-image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readImageUrlAsDataUrl(imageUrl: string, name: string) {
  const response = await fetch(imageUrl, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('Không thể tải ảnh điện thoại để hoàn tất bài nộp.');
  const blob = await response.blob();
  return readImageAsDataUrl(new File([blob], name, { type: blob.type }));
}

function MathText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ p: ({ children }) => <span className="block">{children}</span> }}
      >
        {normalizeMathDelimiters(text)}
      </ReactMarkdown>
    </span>
  );
}

function AnswerPreview({ text }: { text: string }) {
  return (
    <MathText
      className="block w-full whitespace-pre-wrap leading-6"
      text={text.replace(/\r\n?/g, '\n').replace(/\n/g, '  \n')}
    />
  );
}

function normalizeMathDelimiters(value: string) {
  return value
    .replace(/\\\$/g, '$')
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula: string) => `$${formula}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula: string) => `$$${formula}$$`);
}

function getMobileUploadUrl(token: string) {
  const { protocol, hostname, port } = window.location;
  const origin = `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  const url = new URL('/upload-mobile', origin);
  url.searchParams.set('session', token);
  return url.toString();
}

export function ExamWorkspace({
  examTitle,
  subject,
  roomCode,
  questions,
  durationMinutes,
  startedAt,
  roomStartsAt,
  sessionId,
  settings,
  stream,
  onEvent,
  onSubmit,
  onExit,
}: ExamWorkspaceProps) {
  const sessionEndAt = new Date(startedAt).getTime() + durationMinutes * 60_000;
  const scheduledEndAt = new Date(roomStartsAt).getTime() + durationMinutes * 60_000;
  const examEndAt = Number.isFinite(scheduledEndAt) ? Math.min(sessionEndAt, scheduledEndAt) : sessionEndAt;
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionLayout, setQuestionLayout] = useState<QuestionLayout>(settings.allowBackNavigation ? 'vertical' : 'horizontal');
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((examEndAt - Date.now()) / 1000)));
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [securityAlert, setSecurityAlert] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [essayImages, setEssayImages] = useState<Record<number, LocalEssayImage[]>>({});
  const [cameraQuestionId, setCameraQuestionId] = useState<number | null>(null);
  const [mobileQrSession, setMobileQrSession] = useState<ActiveMobileUpload | null>(null);
  const [mobileQrLoading, setMobileQrLoading] = useState(false);
  const [mobileQrError, setMobileQrError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [selectedEssayImage, setSelectedEssayImage] = useState<LocalEssayImage | null>(null);
  const [editingEssay, setEditingEssay] = useState<Record<number, boolean>>({});
  const [formattingQuestionId, setFormattingQuestionId] = useState<number | null>(null);
  const [formatErrors, setFormatErrors] = useState<Record<number, string>>({});
  const [imageStatus, setImageStatus] = useState<Record<number, string>>({});
  const essayTextareaRef = useRef<HTMLTextAreaElement>(null);
  const gradeLabel = examTitle.match(/khối\s*\d+/i)?.[0] ?? 'Khối 11';
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mobileUploadTokensRef = useRef(new Set<string>());
  const essayImagesRef = useRef(essayImages);
  const wasFullscreen = useRef(Boolean(document.fullscreenElement));
  const offscreenStartedAt = useRef<number | null>(null);
  const totalOffscreenSeconds = useRef(0);
  const offscreenViolationCount = useRef(0);
  const filePickerOpen = useRef(false);
  const filePickerFocusResetTimer = useRef<number | null>(null);
  const submitted = useRef(false);
  const submissionInProgress = useRef(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  useEffect(() => {
    essayImagesRef.current = essayImages;
  }, [essayImages]);
  const attemptQuestions = useMemo(() => {
    const groups = new Map<string, ExamQuestion[]>();
    for (const question of questions) {
      const sectionId = question.sectionId ?? question.sectionTitle ?? `legacy-${question.kind}`;
      groups.set(sectionId, [...(groups.get(sectionId) ?? []), question]);
    }
    return [...groups.entries()].flatMap(([sectionId, sectionQuestions]) => {
      const source = [...sectionQuestions];
      if (settings.shuffleQuestions) {
        for (let index = source.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(Math.random() * (index + 1));
          [source[index], source[swapIndex]] = [source[swapIndex], source[index]];
        }
      }
      const labels = fallbackSectionLabels[source[0].kind];
      return source.map((question, index) => ({
        ...question,
        sectionId,
        displayNumber: index + 1,
        sectionTitle: question.sectionTitle ?? `Phần ${index + 1}: ${labels.title}`,
        sectionInstruction: question.sectionInstruction ?? labels.instruction,
      }));
    });
  }, [questions, settings.shuffleQuestions]);
  const answeredCount = new Set([
    ...Object.keys(answers),
    ...Object.entries(essayImages).filter(([, images]) => images.length > 0).map(([questionId]) => questionId),
  ]).size;
  const isTimeLow = secondsLeft < 5 * 60;
  const editingQuestionId = Object.keys(editingEssay).find((key) => editingEssay[Number(key)]);

  const scheduleFilePickerClose = useCallback(() => {
    if (filePickerFocusResetTimer.current !== null) {
      window.clearTimeout(filePickerFocusResetTimer.current);
    }
    filePickerFocusResetTimer.current = window.setTimeout(() => {
      filePickerOpen.current = false;
      filePickerFocusResetTimer.current = null;
    }, 2000);
  }, []);

  const answeredQuestions = useMemo(
    () => new Set([
      ...Object.keys(answers),
      ...Object.entries(essayImages).filter(([, images]) => images.length > 0).map(([questionId]) => questionId),
    ].map(Number)),
    [answers, essayImages],
  );

  const submitExam = useCallback(async (submitReason = 'Học sinh chủ động nộp bài') => {
    if (submitted.current || submissionInProgress.current) return;
    if (!settings.allowEarlySubmit && secondsLeft > 0) {
      setSubmissionError('Phòng thi chỉ cho phép nộp bài khi hết thời gian.');
      return;
    }
    submissionInProgress.current = true;
    setIsSubmitting(true);
    setSubmissionError('');
    const submittedAt = new Date().toISOString();
    const offscreenSeconds = totalOffscreenSeconds.current + (
      offscreenStartedAt.current === null ? 0 : Math.floor((Date.now() - offscreenStartedAt.current) / 1000)
    );
    const audit = {
      examTitle,
      submittedAt,
      reason: submitReason,
      offscreenViolations: offscreenViolationCount.current,
      totalOffscreenSeconds: offscreenSeconds,
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
    try {
      const mobileUploadTokens = Object.values(essayImages).flatMap((images) => (
        images.flatMap((image) => image.uploadToken ? [image.uploadToken] : [])
      ));
      const attachedTokens = new Set(mobileUploadTokens);
      for (const token of mobileUploadTokensRef.current) {
        if (!attachedTokens.has(token)) await deleteStudentExamMobileUpload(sessionId, token);
      }
      const imageEntries = await Promise.all(Object.entries(essayImages).map(async ([questionNumber, images]) => [
        questionNumber,
        await Promise.all(images.filter((image) => image.dataUrl).map(async (image) => ({
          name: image.name,
          dataUrl: image.uploadToken || image.dataUrl.startsWith('blob:')
            ? await readImageUrlAsDataUrl(image.dataUrl, image.name)
            : image.dataUrl,
        }))),
      ] as const));
      const summary: ExamSubmissionSummary = {
        answered: answeredCount,
        total: questions.length,
        answers,
        images: Object.fromEntries(imageEntries),
        files: Object.entries(essayImages).flatMap(([questionNumber, images]) => (
          images.flatMap((image) => image.file
            ? [{ questionNumber: Number(questionNumber), file: image.file }]
            : [])
        )),
        mobileUploadTokens,
        durationSeconds: Math.min(durationMinutes * 60, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
        submittedAt,
        submitReason,
        offscreenViolations: offscreenViolationCount.current,
        totalOffscreenSeconds: offscreenSeconds,
        auditSaved,
      };
      await onSubmit(summary);
      submitted.current = true;
      mobileUploadTokensRef.current.clear();
    } catch (error) {
      console.error('Không thể lưu bài nộp phòng thi.', error);
      setSubmissionError(error instanceof Error ? error.message : 'Không thể lưu bài nộp. Hãy thử nộp lại.');
    } finally {
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  }, [answeredCount, answers, durationMinutes, essayImages, examTitle, onSubmit, questions.length, secondsLeft, sessionId, settings.allowEarlySubmit, startedAt]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraQuestionId]);

  useEffect(() => {
    if (!mobileQrSession) return undefined;
    const activeUpload = mobileQrSession;
    let active = true;
    let checking = false;
    async function checkForMobilePhoto() {
      if (!active || checking) return;
      checking = true;
      try {
        const status = await getStudentExamMobileUploadStatus(activeUpload.token);
        if (!active || status.status !== 'success') return;
        active = false;
        mobileUploadTokensRef.current.add(activeUpload.token);
        const image: LocalEssayImage = {
          id: createLocalImageId(),
          name: status.name,
          dataUrl: status.imageUrl,
          file: null,
          uploadToken: activeUpload.token,
        };
        setEssayImages((current) => ({
          ...current,
          [activeUpload.questionNumber]: [
            ...(current[activeUpload.questionNumber] ?? []),
            image,
          ],
        }));
        setMobileQrSession(null);
        setMobileQrError('');
        setImageStatus((current) => ({
          ...current,
          [activeUpload.questionNumber]: 'Ảnh đã đồng bộ. Em có thể xem lại hoặc xóa trước khi nộp bài.',
        }));
      } catch (error: unknown) {
        active = false;
        setMobileQrError(error instanceof Error ? error.message : 'Không thể kiểm tra ảnh từ điện thoại.');
      } finally {
        checking = false;
      }
    }
    void checkForMobilePhoto();
    const intervalId = window.setInterval(() => void checkForMobilePhoto(), 2_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [mobileQrSession]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (!submitted.current) {
      mobileUploadTokensRef.current.forEach((token) => {
        void deleteStudentExamMobileUpload(sessionId, token).catch((error: unknown) => {
          console.error('Không thể xóa ảnh QR tạm khi đóng bài thi.', error);
        });
      });
    }
    Object.values(essayImagesRef.current).flat().forEach((image) => {
      if (image.dataUrl.startsWith('blob:')) URL.revokeObjectURL(image.dataUrl);
    });
  }, [sessionId]);

  useLayoutEffect(() => {
    const textarea = essayTextareaRef.current;
    if (!editingQuestionId || !textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [editingQuestionId]);

  useEffect(() => {
    const updateRemainingTime = () => {
      const remaining = Math.max(0, Math.ceil((examEndAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      return remaining;
    };
    if (updateRemainingTime() === 0) return undefined;
    const timer = window.setInterval(() => {
      if (updateRemainingTime() === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [examEndAt]);

  useEffect(() => {
    if (!selectedEssayImage) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedEssayImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEssayImage]);

  useEffect(() => {
    if (secondsLeft === 0) submitExam('Hết thời gian làm bài');
  }, [secondsLeft, submitExam]);

  useEffect(() => {
    const recordOffscreenEvent = (reason: string, eventType: StudentExamEventType) => {
      if (submitted.current || offscreenStartedAt.current !== null || !settings.monitorTabSwitch) return;
      offscreenStartedAt.current = Date.now();
      offscreenViolationCount.current += 1;
      let savedLocally = true;
      try {
        const previous: unknown = JSON.parse(localStorage.getItem(examAuditStorageKey) ?? '[]');
        if (!Array.isArray(previous)) throw new Error('Nhật ký bài thi không đúng định dạng.');
        localStorage.setItem(examAuditStorageKey, JSON.stringify([
          ...previous.slice(-49),
          { examTitle, occurredAt: new Date().toISOString(), reason, type: 'event' },
        ]));
      } catch (error) {
        savedLocally = false;
        console.error('Không thể lưu sự kiện bài thi trên thiết bị.', error);
      }
      void onEventRef.current(eventType).then(() => {
        setSecurityAlert(`${reason}. Bài thi vẫn tiếp tục; sự kiện đã được lưu để giáo viên xem xét.`);
      }).catch((error: unknown) => {
        console.error('Không thể gửi sự kiện phòng thi lên máy chủ.', error);
        setSecurityAlert(`${reason}. Bài thi vẫn tiếp tục. ${savedLocally ? 'Đã lưu cục bộ; không thể gửi lên máy chủ.' : 'Không thể lưu nhật ký trên thiết bị hoặc gửi lên máy chủ.'}`);
      });
    };
    const handleVisibility = () => {
      if (document.hidden && !filePickerOpen.current) {
        recordOffscreenEvent('Em đã chuyển sang tab hoặc ứng dụng khác', 'tab-hidden');
      }
    };
    const handleBlur = () => {
      if (!filePickerOpen.current) {
        recordOffscreenEvent('Em đã rời khỏi cửa sổ bài thi', 'window-blur');
      }
    };
    const handleFocus = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      if (filePickerOpen.current) scheduleFilePickerClose();
      if (offscreenStartedAt.current !== null) {
        totalOffscreenSeconds.current += Math.floor((Date.now() - offscreenStartedAt.current) / 1000);
        offscreenStartedAt.current = null;
      }
    };
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        wasFullscreen.current = true;
        setIsFullscreen(true);
        return;
      }
      if (filePickerOpen.current) {
        wasFullscreen.current = false;
        setIsFullscreen(false);
        return;
      }
      if (!wasFullscreen.current) return;
      wasFullscreen.current = false;
      setIsFullscreen(false);
      recordOffscreenEvent('Em đã thoát chế độ toàn màn hình', 'fullscreen-exit');
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
      if (filePickerFocusResetTimer.current !== null) {
        window.clearTimeout(filePickerFocusResetTimer.current);
        filePickerFocusResetTimer.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('keydown', handleShortcut, true);
    };
  }, [examTitle, scheduleFilePickerClose, settings.monitorTabSwitch, submitExam]);

  useEffect(() => {
    if (!settings.monitorConnection) return;
    const handleOffline = () => {
      void onEventRef.current('connection-lost').catch((error: unknown) => {
        console.error('Không thể ghi nhận mất kết nối phòng thi.', error);
      });
    };
    const handleOnline = () => {
      void onEventRef.current('connection-restored').catch((error: unknown) => {
        console.error('Không thể ghi nhận khôi phục kết nối phòng thi.', error);
      });
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [settings.monitorConnection]);

  function setAnswer(questionId: number, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function setTrueFalse(questionId: number, statementIndex: number, value: 'Đúng' | 'Sai') {
    const current = answers[questionId] ? JSON.parse(answers[questionId]) as Record<number, string> : {};
    setAnswer(questionId, JSON.stringify({ ...current, [statementIndex]: value }));
  }

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraQuestionId(null);
  }

  async function openWebcam(questionId: number) {
    if (Object.values(essayImages).reduce((total, items) => total + items.length, 0) >= maxEssayImages) {
      setImageStatus((current) => ({ ...current, [questionId]: `Mỗi bài thi được đính kèm tối đa ${maxEssayImages} ảnh.` }));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setImageStatus((current) => ({
        ...current,
        [questionId]: window.isSecureContext
          ? 'Trình duyệt này không hỗ trợ mở camera. Hãy chọn ảnh có sẵn hoặc dùng điện thoại.'
          : 'Trình duyệt đang chặn webcam vì trang được mở bằng HTTP qua IP nội bộ. Hãy dùng HTTPS hoặc mở trên localhost; bạn vẫn có thể chụp bằng điện thoại qua mã QR.',
      }));
      return;
    }
    setCameraError('');
    filePickerOpen.current = true;
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStreamRef.current = cameraStream;
      setCameraQuestionId(questionId);
      scheduleFilePickerClose();
    } catch (error: unknown) {
      filePickerOpen.current = false;
      setImageStatus((current) => ({
        ...current,
        [questionId]: error instanceof Error ? `Không thể mở webcam: ${error.message}` : 'Không thể mở webcam.',
      }));
    }
  }

  async function captureWebcamImage() {
    const video = cameraVideoRef.current;
    const questionId = cameraQuestionId;
    if (!video || !questionId || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera chưa sẵn sàng. Hãy đợi hình ảnh hiển thị rồi thử lại.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Không thể chụp ảnh từ camera trên trình duyệt này.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob || blob.size === 0 || blob.size > maxEssayImageBytes) {
      setCameraError('Ảnh chụp không hợp lệ hoặc vượt quá 10 MB.');
      return;
    }
    const file = new File([blob], `bai-lam-cau-${questionId}.jpg`, { type: 'image/jpeg' });
    const image: LocalEssayImage = {
      id: createLocalImageId(),
      name: file.name,
      dataUrl: URL.createObjectURL(blob),
      file,
    };
    setEssayImages((current) => ({
      ...current,
      [questionId]: [...(current[questionId] ?? []), image],
    }));
    setImageStatus((current) => ({ ...current, [questionId]: '' }));
    setCameraError('');
    stopCamera();
  }

  async function openMobileQr(questionId: number) {
    const attachedCount = Object.values(essayImages).reduce((total, images) => total + images.length, 0);
    if (attachedCount >= maxEssayImages || mobileQrLoading) {
      setImageStatus((current) => ({ ...current, [questionId]: `Mỗi bài thi được đính kèm tối đa ${maxEssayImages} ảnh.` }));
      return;
    }
    setMobileQrLoading(true);
    setMobileQrError('');
    try {
      const uploadSession = await createStudentExamMobileUploadSession(sessionId, questionId);
      mobileUploadTokensRef.current.add(uploadSession.token);
      setMobileQrSession(uploadSession);
    } catch (error: unknown) {
      setImageStatus((current) => ({
        ...current,
        [questionId]: error instanceof Error ? error.message : 'Không thể tạo mã QR tải ảnh.',
      }));
    } finally {
      setMobileQrLoading(false);
    }
  }

  async function closeMobileQr() {
    if (!mobileQrSession) return;
    try {
      await deleteStudentExamMobileUpload(sessionId, mobileQrSession.token);
      mobileUploadTokensRef.current.delete(mobileQrSession.token);
      setMobileQrSession(null);
      setMobileQrError('');
    } catch (error: unknown) {
      setMobileQrError(error instanceof Error ? error.message : 'Không thể xóa phiên tải ảnh tạm.');
    }
  }

  async function removeEssayImage(questionId: number, image: LocalEssayImage) {
    if (image.uploadToken) {
      try {
        await deleteStudentExamMobileUpload(sessionId, image.uploadToken);
        mobileUploadTokensRef.current.delete(image.uploadToken);
      } catch (error: unknown) {
        setImageStatus((current) => ({
          ...current,
          [questionId]: error instanceof Error ? error.message : 'Không thể xóa ảnh tạm trên máy chủ.',
        }));
        return;
      }
    }
    if (image.dataUrl.startsWith('blob:')) URL.revokeObjectURL(image.dataUrl);
    setEssayImages((current) => ({
      ...current,
      [questionId]: (current[questionId] ?? []).filter((item) => item.id !== image.id),
    }));
    setSelectedEssayImage((current) => current?.id === image.id ? null : current);
  }

  async function formatEssayAnswer(questionId: number) {
    const answer = answers[questionId]?.trim();
    if (!answer || formattingQuestionId !== null) return;
    setFormattingQuestionId(questionId);
    setFormatErrors((current) => ({ ...current, [questionId]: '' }));
    try {
      const response = await authenticatedFetch('/api/ai/format-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: answer }),
      });
      const result: unknown = await response.json();
      const payload = result && typeof result === 'object' && !Array.isArray(result)
        ? result as Record<string, unknown>
        : {};
      const data = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
        ? payload.data as Record<string, unknown>
        : {};
      if (!response.ok || payload.success !== true
        || typeof data.formattedText !== 'string' || !data.formattedText.trim()) {
        throw new Error(typeof payload.message === 'string'
          ? payload.message
          : 'Không thể chuẩn hóa ký hiệu trong câu trả lời.');
      }
      setAnswer(questionId, data.formattedText.trim());
      setEditingEssay((current) => ({ ...current, [questionId]: false }));
    } catch (error) {
      setFormatErrors((current) => ({
        ...current,
        [questionId]: error instanceof Error ? error.message : 'Không thể chuẩn hóa ký hiệu trong câu trả lời.',
      }));
    } finally {
      setFormattingQuestionId(null);
    }
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
            <p className="max-w-[70vw] text-sm font-semibold leading-5 text-slate-800 sm:max-w-[calc(100vw-220px)] sm:text-base">{subject} - {examTitle} - {gradeLabel} · Mã phòng {roomCode}</p>
          </div>
        </div>
        <button type="button" onClick={onExit} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Thoát bài thi</span>
        </button>
      </header>

      {!isFullscreen && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Bài thi hiện không ở chế độ toàn màn hình. Sự việc được ghi nhận trên thiết bị.
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
      {cameraQuestionId !== null && (
        <div className="fixed inset-0 z-[2147483002] flex items-center justify-center bg-slate-950/75 p-4">
          <section role="dialog" aria-modal="true" aria-label="Chụp ảnh bài làm bằng webcam" className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="font-bold text-slate-900">Chụp ảnh câu {cameraQuestionId}</h2>
              <button
                type="button"
                onClick={() => { stopCamera(); setCameraError(''); }}
                aria-label="Đóng camera"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="space-y-3 p-4">
              <video ref={cameraVideoRef} autoPlay playsInline muted className="max-h-[60vh] w-full rounded-xl bg-slate-950 object-contain" />
              {cameraError && <p role="alert" className="text-sm text-rose-700">{cameraError}</p>}
              <button
                type="button"
                onClick={() => void captureWebcamImage()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 font-bold text-white hover:bg-blue-800"
              >
                <Camera className="h-5 w-5" />
                Chụp
              </button>
            </div>
          </section>
        </div>
      )}
      {mobileQrSession && (
        <div className="fixed inset-0 z-[2147483002] flex items-center justify-center bg-slate-950/75 p-4">
          <section role="dialog" aria-modal="true" aria-label="Chụp ảnh bài làm bằng điện thoại" className="w-full max-w-md rounded-2xl bg-white p-5 text-center shadow-2xl">
            <div className="flex items-center justify-between gap-3 text-left">
              <div>
                <h2 className="font-bold text-slate-900">Chụp bằng Điện thoại (Quét QR)</h2>
                <p className="mt-1 text-xs text-slate-500">Câu {mobileQrSession.questionNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => void closeMobileQr()}
                aria-label="Đóng mã QR"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mx-auto mt-4 inline-flex rounded-xl border border-slate-200 bg-white p-3">
              <QRCodeSVG
                value={getMobileUploadUrl(mobileQrSession.token)}
                size={224}
                level="M"
                includeMargin
              />
            </div>
            <p role="status" className="mt-3 text-sm text-slate-600">Quét mã bằng điện thoại. Ảnh sẽ tự đồng bộ lên bài làm.</p>
            <p className="mt-1 text-xs text-slate-500">
              Mã có hiệu lực đến {new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(mobileQrSession.expiresAt))}.
            </p>
            {mobileQrError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{mobileQrError}</p>}
            <button type="button" onClick={() => void closeMobileQr()} className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Đóng và hủy mã
            </button>
          </section>
        </div>
      )}
      {selectedEssayImage?.dataUrl && (
        <div
          className="fixed inset-0 z-[2147483002] flex items-center justify-center bg-slate-950/75 p-4"
          role="presentation"
          onClick={() => setSelectedEssayImage(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Xem ảnh ${selectedEssayImage.name}`}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h2 className="min-w-0 truncate text-sm font-semibold text-slate-800">{selectedEssayImage.name}</h2>
              <button
                type="button"
                onClick={() => setSelectedEssayImage(null)}
                aria-label="Đóng ảnh"
                className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="flex min-h-48 flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
              <img src={selectedEssayImage.dataUrl} alt={selectedEssayImage.name} className="max-h-[78vh] max-w-full object-contain" />
            </div>
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

          {(questionLayout === 'vertical' ? attemptQuestions : [attemptQuestions[currentIndex]]).map((item) => {
            const answerState = item.kind === 'true-false' && answers[item.id]
              ? JSON.parse(answers[item.id]) as Record<number, string>
              : {};
            const firstInSection = item.displayNumber === 1;
            const sectionPoints = questions
              .filter((question) => (question.sectionId ?? question.sectionTitle ?? `legacy-${question.kind}`) === item.sectionId)
              .reduce((total, question) => total + question.points, 0);
            const questionsInSection = attemptQuestions.filter((question) => question.sectionId === item.sectionId);
            const firstQuestionPoints = questionsInSection[0]?.points;
            const hasSameQuestionPoints = questionsInSection.every((question) => question.points === firstQuestionPoints);
            const sectionPointLabel = hasSameQuestionPoints && item.kind !== 'true-false'
              ? `(${formatPoints(firstQuestionPoints ?? 0)} điểm/câu)`
              : `(Tổng điểm phần: ${formatPoints(sectionPoints)})`;
            return (
              <article id={`exam-question-${item.id}`} key={item.id} className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                {firstInSection && (
                  <header className="mb-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                    <h2 className="font-extrabold tracking-tight text-slate-900">{item.sectionTitle} <span className="whitespace-nowrap">({formatPoints(sectionPoints)} điểm)</span></h2>
                    <p className="mt-2 text-sm leading-6 text-slate-800">
                      <strong>
                        {item.sectionInstruction} {sectionPointLabel}
                      </strong>
                    </p>
                  </header>
                )}
                <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Câu {item.displayNumber}</h2>
                  <span className="text-sm font-medium text-slate-800">({formatPoints(item.points)} điểm)</span>
                </div>

                <h3 className="mb-5 text-lg font-semibold leading-8 text-slate-900 sm:text-xl"><MathText text={item.prompt} /></h3>

                {item.kind === 'choice' && (
                  <div className="grid gap-3">
                    {item.options?.map((option, index) => {
                      const selected = answers[item.id] === String(index);
                      return (
                        <button key={option} type="button" onClick={() => setAnswer(item.id, String(index))} className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-left text-base transition ${selected ? 'border-blue-400 bg-blue-50 text-blue-900 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-600'}`}>{String.fromCharCode(65 + index)}</span>
                          <MathText text={option} className="flex-1" />
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
                        <p className="text-base leading-7 text-slate-700"><strong className="mr-2 text-slate-900">{String.fromCharCode(97 + index)}.</strong><MathText text={statement} /></p>
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
                  <div>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700">Câu trả lời ngắn</span>
                      <input
                        value={answers[item.id] ?? ''}
                        onChange={(event) => setAnswer(item.id, event.target.value)}
                        placeholder="Nhập đáp án..."
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  </div>
                )}

                {item.kind === 'essay' && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">Tự trình bày lời giải bằng văn bản hoặc đính kèm ảnh bài làm.</p>
                    <div
                      className="space-y-3"
                      onBlurCapture={(event) => {
                        if (!(event.relatedTarget instanceof Node)
                          || !event.currentTarget.contains(event.relatedTarget)) {
                          const editor = event.currentTarget;
                          window.requestAnimationFrame(() => {
                            if (!editor.contains(document.activeElement)) {
                              setEditingEssay((current) => ({ ...current, [item.id]: false }));
                            }
                          });
                        }
                      }}
                    >
                      <span className="text-sm font-medium text-slate-700">Bài làm</span>
                      {answers[item.id]?.trim() && !editingEssay[item.id] ? (
                        <button
                          type="button"
                          onClick={() => setEditingEssay((current) => ({ ...current, [item.id]: true }))}
                          title="Bấm để sửa văn bản và LaTeX"
                          className="mt-2 flex min-h-32 w-full flex-col items-start justify-start select-text whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-base font-normal leading-7 text-slate-800 hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <AnswerPreview text={answers[item.id]} />
                        </button>
                      ) : (
                        <div className="mt-2">
                          <textarea
                            ref={editingEssay[item.id] ? essayTextareaRef : undefined}
                            value={answers[item.id] ?? ''}
                            onChange={(event) => setAnswer(item.id, event.target.value)}
                            rows={6}
                            aria-label="Bài làm tự luận"
                            placeholder="Trình bày lời giải..."
                            className="block min-h-32 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-left align-top text-base leading-6 outline-none [align-content:start] transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                      )}
                    {essayImages[item.id]?.length ? (
                      <div className="mt-3 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-label="Ảnh bài làm đã đính kèm">
                        {essayImages[item.id].map((image) => (
                          <div key={image.id} className="flex min-w-0 items-start gap-2">
                            <button
                              type="button"
                              disabled={!image.dataUrl}
                              onClick={() => setSelectedEssayImage(image)}
                              aria-label={`Xem ảnh ${image.name}`}
                              className="block h-24 w-28 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white disabled:cursor-wait"
                            >
                              {image.dataUrl ? (
                                <img src={image.dataUrl} alt={image.name} className="h-full w-full object-contain" />
                              ) : (
                                <span className="flex h-full items-center justify-center text-xs text-slate-400">Đang tải...</span>
                              )}
                            </button>
                            <div className="min-w-0 pt-1">
                              <p className="max-w-48 truncate text-xs font-semibold text-slate-700">{image.name}</p>
                              <p className="mt-1 text-[11px] text-emerald-700">Đã đính kèm</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void removeEssayImage(item.id, image)}
                              aria-label={`Xóa ảnh ${image.name}`}
                              title="Xóa ảnh đính kèm"
                              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-100 hover:text-rose-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={!answers[item.id]?.trim() || formattingQuestionId !== null}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void formatEssayAnswer(item.id)}
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" />
                      {formattingQuestionId === item.id ? 'Đang chuẩn hóa...' : 'Chuẩn hóa ký hiệu'}
                    </button>
                    {formatErrors[item.id] && <p role="alert" className="text-sm text-rose-700">{formatErrors[item.id]}</p>}
                    {!essayImages[item.id]?.length && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={Object.values(essayImages).reduce((total, items) => total + items.length, 0) >= maxEssayImages}
                            onClick={() => void openWebcam(item.id)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Camera className="h-4 w-4" /> Chụp bằng Webcam máy tính
                          </button>
                          <button
                            type="button"
                            disabled={Object.values(essayImages).reduce((total, items) => total + items.length, 0) >= maxEssayImages || mobileQrLoading}
                            onClick={() => void openMobileQr(item.id)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Smartphone className="h-4 w-4" />
                            {mobileQrLoading ? 'Đang tạo mã QR...' : 'Chụp bằng Điện thoại (Quét QR)'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">Tối đa 5 ảnh toàn bài thi, mỗi ảnh không quá 10 MB.</p>
                      </>
                    )}
                    {imageStatus[item.id] && <p role="status" className="text-sm text-blue-700">{imageStatus[item.id]}</p>}
                  </div>
                  </div>
                )}

                {questionLayout === 'horizontal' && (
                  <footer className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                    <button type="button" disabled={currentIndex === 0 || !settings.allowBackNavigation} onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40">
                      <ArrowLeft className="h-4 w-4" /> Câu trước
                    </button>
                    <button type="button" onClick={() => currentIndex === attemptQuestions.length - 1 ? setConfirmSubmit(true) : setCurrentIndex((index) => index + 1)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
                      {currentIndex === attemptQuestions.length - 1 ? 'Hoàn thành' : 'Câu tiếp theo'} <ArrowRight className="h-4 w-4" />
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
              {attemptQuestions.map((item, index) => (
                <button key={item.id} type="button" disabled={!settings.allowBackNavigation && index < currentIndex} onClick={() => {
                  setCurrentIndex(index);
                  if (questionLayout === 'vertical') document.getElementById(`exam-question-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }} aria-label={`Đi đến ${item.sectionTitle}, câu ${item.displayNumber}`} aria-current={currentIndex === index ? 'step' : undefined} className={`flex aspect-square items-center justify-center rounded-md text-xs font-bold transition ${currentIndex === index ? 'bg-blue-600 text-white ring-2 ring-blue-200' : answeredQuestions.has(item.id) ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {item.displayNumber}
                </button>
              ))}
            </div>
          </section>

          {settings.requireCamera && (
            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between px-3 py-2">
                <h2 className="text-xs font-bold text-slate-800">Webcam</h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Bật trên thiết bị</span>
              </div>
              <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full bg-slate-950 object-cover" />
              <p className="px-3 py-2 text-[10px] text-slate-500">Chỉ hiển thị cục bộ; video không được gửi lên máy chủ.</p>
            </section>
          )}
          {settings.requireMicrophone && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <Mic className="h-4 w-4 text-emerald-700" /> Micro đã được kiểm tra trên thiết bị; không ghi âm.
            </div>
          )}

          <button type="button" onClick={() => setConfirmSubmit(true)} disabled={!settings.allowEarlySubmit && secondsLeft > 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Send className="h-4 w-4" /> Nộp bài
          </button>
          {!settings.allowEarlySubmit && secondsLeft > 0 && <p className="text-xs text-slate-500">Phòng thi chỉ cho phép nộp bài khi hết thời gian.</p>}
          {submissionError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
              <p>{submissionError}</p>
              <button type="button" onClick={() => void submitExam('Nộp lại bài thi')} className="mt-2 font-bold underline">Thử lưu bài lại</button>
            </div>
          )}
        </aside>
      </div>

      {confirmSubmit && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="submit-exam-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><AlertTriangle className="h-5 w-5" /></span>
            <h2 id="submit-exam-title" className="mt-3 text-lg font-bold text-slate-900">Nộp bài thi?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Em đã trả lời {answeredCount}/{questions.length} câu. Sau khi nộp, em không thể chỉnh sửa bài làm.</p>
            {isSubmitting && <p role="status" className="mt-2 text-sm text-blue-700">Đang lưu bài lên hệ thống...</p>}
            {!settings.allowEarlySubmit && secondsLeft > 0 && <p className="mt-2 text-sm text-amber-800">Giáo viên cài đặt chỉ nộp khi hết thời gian.</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmSubmit(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Tiếp tục làm</button>
              <button type="button" disabled={isSubmitting || (!settings.allowEarlySubmit && secondsLeft > 0)} onClick={() => void submitExam()} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Đang lưu...' : 'Nộp bài'}</button>
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
