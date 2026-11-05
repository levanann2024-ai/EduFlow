import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Bookmark, PanelLeftClose, PanelLeftOpen, Paperclip, Plus, RefreshCw, Send, Sparkles, Trash2, X } from 'lucide-react';
import type { ChatMessage, Role } from '@/types';
import { getSavedItems, removeSavedItem, saveItem } from '@/pages/student/savedItems';
import { MathText } from '@/components/MathText';
import { authenticatedFetch } from '@/auth/authApi';
import type { AuthUser } from '@/auth/authApi';
import { recordStudentLearningActivity } from '@/api/studentLearningActivity';
import { readExplanationStyle } from '@/settings/userSettings';
import 'katex/dist/katex.min.css';

function getInitialMessages(role: Role, gender?: AuthUser['gender']): ChatMessage[] {
  const content = role === 'student'
    ? 'Chào bạn! Bạn cứ gửi câu hỏi, tôi sẽ cùng bạn tìm hiểu và tự nhận diện môn học phù hợp.'
    : role === 'lecturer'
      ? `Xin chào ${gender === 'male' ? 'thầy' : gender === 'female' ? 'cô' : 'thầy/cô'}! Tôi là trợ lý AI EduFlow. Tôi có thể hỗ trợ chuẩn bị bài giảng, tạo câu hỏi và giải đáp các nội dung học tập.`
      : 'Xin chào! Tôi là trợ lý AI EduFlow. Tôi có thể hỗ trợ các câu hỏi về học tập và sử dụng nền tảng.';
  return [{ id: 'm1', role: 'assistant', content, time: 'Bây giờ' }];
}

interface LegacyStudentConversation {
  id: string;
  subject: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

interface ChatConversationSummary {
  id: string;
  subject: string;
  title: string;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  subject: string;
  createdAt: string;
  hasImage: boolean;
  imageMimeType: string | null;
  imageName: string | null;
}

interface ChatConversation extends ChatConversationSummary {
  messages: ApiChatMessage[];
}

interface ApiChatConversation extends Omit<ChatConversationSummary, 'lastMessage'> {
  lastMessage?: string;
  messages: ApiChatMessage[];
}

function isLegacyStudentConversation(value: unknown): value is LegacyStudentConversation {
  if (!value || typeof value !== 'object') return false;
  const conversation = value as Record<string, unknown>;
  return typeof conversation.id === 'string'
    && typeof conversation.subject === 'string'
    && typeof conversation.title === 'string'
    && typeof conversation.updatedAt === 'number'
    && Array.isArray(conversation.messages)
    && conversation.messages.every((message) => (
      !!message
      && typeof message === 'object'
      && typeof (message as Record<string, unknown>).id === 'string'
      && ['assistant', 'user'].includes(String((message as Record<string, unknown>).role))
      && typeof (message as Record<string, unknown>).content === 'string'
      && typeof (message as Record<string, unknown>).time === 'string'
      && ((message as Record<string, unknown>).subject === undefined || typeof (message as Record<string, unknown>).subject === 'string')
    ));
}

function readLegacyStudentConversations(): { conversations: LegacyStudentConversation[]; loadError: string; keyPresent: boolean } {
  try {
    const stored = localStorage.getItem('eduflow-ai-chat-history');
    if (!stored) return { conversations: [], loadError: '', keyPresent: false };
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every(isLegacyStudentConversation)) {
      return { conversations: parsed, loadError: '', keyPresent: true };
    }
    return { conversations: [], loadError: 'Lịch sử chat bị sai định dạng và chưa được thay đổi. Hãy tạo cuộc trò chuyện mới để lưu lịch sử mới.', keyPresent: true };
  } catch (loadError) {
    const message = loadError instanceof Error ? loadError.message : 'Dữ liệu không đọc được.';
    return { conversations: [], loadError: `Không thể đọc lịch sử chat: ${message}`, keyPresent: false };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isChatConversationMetadata(value: unknown): value is Omit<ChatConversationSummary, 'lastMessage'> & { lastMessage?: string } {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.subject === 'string'
    && typeof value.title === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
    && (value.lastMessage === undefined || typeof value.lastMessage === 'string');
}

function isChatConversationSummary(value: unknown): value is ChatConversationSummary {
  return isChatConversationMetadata(value) && typeof value.lastMessage === 'string';
}

function formatChatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';

  const now = new Date();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const nextWeekStart = new Date(startOfWeek);
  nextWeekStart.setDate(startOfWeek.getDate() + 7);
  const conversationDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const time = formatChatTime(timestamp);

  if (conversationDate.getTime() === today.getTime()) {
    return `Hôm nay ${time}`;
  }

  if (conversationDate >= startOfWeek && conversationDate < nextWeekStart) {
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return `${weekdays[date.getDay()]} ${time}`;
  }

  const shortWeekdays = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayAndMonth = date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
  return `${shortWeekdays[date.getDay()]}, ${dayAndMonth} lúc ${time}`;
}

function getChatDateKey(timestamp: string): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatChatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '';
}

function isApiChatConversation(value: unknown): value is ApiChatConversation {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.subject === 'string'
    && typeof value.title === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
    && (value.lastMessage === undefined || typeof value.lastMessage === 'string')
    && Array.isArray(value.messages)
    && value.messages.every(isApiChatMessage);
}

function isApiChatMessage(value: unknown): value is ApiChatMessage {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.role === 'user' || value.role === 'assistant')
    && typeof value.content === 'string'
    && typeof value.subject === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.hasImage === 'boolean'
    && (value.imageMimeType === null || typeof value.imageMimeType === 'string')
    && (value.imageName === null || typeof value.imageName === 'string');
}

async function requestConversationList(): Promise<ChatConversationSummary[]> {
  const response = await authenticatedFetch('/api/ai/conversations');
  const result: unknown = await response.json();
  if (!response.ok || !isRecord(result) || result.success !== true
    || !isRecord(result.data) || !Array.isArray(result.data.conversations)
    || !result.data.conversations.every(isChatConversationSummary)) {
    throw new Error(isRecord(result) && typeof result.message === 'string'
      ? result.message
      : 'Lịch sử chat từ máy chủ không đúng định dạng.');
  }
  return result.data.conversations;
}

async function requestConversation(conversationId: string): Promise<ChatConversation> {
  const response = await authenticatedFetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}`);
  const result: unknown = await response.json();
  const conversation = isRecord(result) && isRecord(result.data) ? result.data.conversation : null;
  if (!response.ok || !isRecord(result) || result.success !== true || !isRecord(conversation)
    || !isApiChatConversation(conversation)) {
    throw new Error(isRecord(result) && typeof result.message === 'string'
      ? result.message
      : 'Cuộc trò chuyện từ máy chủ không đúng định dạng.');
  }
  return {
    id: conversation.id,
    title: conversation.title,
    subject: conversation.subject,
    lastMessage: typeof conversation.lastMessage === 'string' ? conversation.lastMessage : '',
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: conversation.messages,
  };
}

function toChatMessage(message: ApiChatMessage, conversationId: string): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    subject: message.subject,
    time: new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    timestamp: message.createdAt,
    ...(message.hasImage ? {
      imagePath: `/api/ai/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(message.id)}/image`,
      imageName: message.imageName ?? undefined,
    } : {}),
  };
}

async function deleteConversationRequest(conversationId: string) {
  const response = await authenticatedFetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  });
  const result: unknown = await response.json();
  if (!response.ok || !isRecord(result) || result.success !== true) {
    throw new Error(isRecord(result) && typeof result.message === 'string'
      ? result.message
      : 'Không thể xóa cuộc trò chuyện.');
  }
}

async function sendLegacyConversationBatch(conversations: LegacyStudentConversation[]) {
  const body = JSON.stringify({ conversations });
  if (new TextEncoder().encode(body).length > 900 * 1024) {
    throw new Error('Một cuộc trò chuyện cũ quá lớn để chuyển trong một lần. Lịch sử vẫn được giữ nguyên trên thiết bị.');
  }
  const response = await authenticatedFetch('/api/ai/conversations/import-legacy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const result: unknown = await response.json();
  if (!response.ok || !isRecord(result) || result.success !== true) {
    throw new Error(isRecord(result) && typeof result.message === 'string'
      ? result.message
      : 'Không thể chuyển lịch sử chat cũ sang cơ sở dữ liệu.');
  }
}

async function importLegacyConversationsRequest(conversations: LegacyStudentConversation[]) {
  let batch: LegacyStudentConversation[] = [];
  let batchMessageCount = 0;
  for (const conversation of conversations) {
    const candidate = [...batch, conversation];
    const candidateMessageCount = batchMessageCount + conversation.messages.length;
    const candidateSize = new TextEncoder().encode(JSON.stringify({ conversations: candidate })).length;
    if (batch.length > 0 && (
      candidate.length > 100
      || candidateMessageCount > 2500
      || candidateSize > 800 * 1024
    )) {
      await sendLegacyConversationBatch(batch);
      batch = [conversation];
      batchMessageCount = conversation.messages.length;
    } else {
      batch = candidate;
      batchMessageCount = candidateMessageCount;
    }
  }
  if (batch.length > 0) await sendLegacyConversationBatch(batch);
}
function getStudentWeeklyPlanContext(studentId?: string) {
  if (!studentId) return undefined;
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const weekStart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  let stored: string | null;
  try {
    stored = localStorage.getItem(`eduflow-student-week-plan:${studentId}:${weekStart}`);
  } catch {
    throw new Error('Không thể đọc kế hoạch tuần đã lưu trên thiết bị.');
  }
  if (!stored) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new Error('Kế hoạch tuần đã lưu bị sai định dạng. Hãy mở lại trang Kế hoạch tuần để kiểm tra.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Kế hoạch tuần đã lưu bị sai định dạng. Hãy mở lại trang Kế hoạch tuần để kiểm tra.');
  }
  const plan = parsed as Record<string, unknown>;
  const textFields = ['freeTime', 'busyTime', 'availability', 'suggestion'];
  if (textFields.some((field) => plan[field] !== undefined && typeof plan[field] !== 'string')
    || (plan.completedPriorities !== undefined && !Array.isArray(plan.completedPriorities))) {
    throw new Error('Kế hoạch tuần đã lưu bị sai định dạng. Hãy mở lại trang Kế hoạch tuần để kiểm tra.');
  }
  const context = {
    freeTime: typeof plan.freeTime === 'string' ? plan.freeTime : '',
    busyTime: typeof plan.busyTime === 'string' ? plan.busyTime : '',
    legacyAvailability: typeof plan.availability === 'string' ? plan.availability : '',
    suggestion: typeof plan.suggestion === 'string' ? plan.suggestion : '',
    completedPriorities: Array.isArray(plan.completedPriorities)
      ? plan.completedPriorities.filter((index): index is number => (
        typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < 3
      ))
      : [],
  };
  return Object.values(context).some((value) => (
    typeof value === 'string' ? Boolean(value.trim()) : value.length > 0
  )) ? context : undefined;
}

function ChatImageAttachment({ imagePath, previewUrl, imageName }: {
  imagePath?: string;
  previewUrl?: string;
  imageName?: string;
}) {
  const [imageUrl, setImageUrl] = useState(previewUrl ?? '');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!imagePath) {
      setImageUrl(previewUrl ?? '');
      return undefined;
    }

    let cancelled = false;
    let objectUrl = '';
    setLoadError('');
    const loadImage = async () => {
      try {
        const response = await authenticatedFetch(imagePath);
        if (!response.ok) throw new Error('Không thể tải ảnh đã lưu.');
        objectUrl = URL.createObjectURL(await response.blob());
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
        } else {
          setImageUrl(objectUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Không thể tải ảnh đã lưu.');
        }
      }
    };
    void loadImage();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imagePath, previewUrl]);

  return (
    <div className="mt-2">
      {imageUrl ? <img src={imageUrl} alt={imageName || 'Ảnh đính kèm'} className="max-h-72 max-w-full rounded-xl object-contain" /> : (
        <p className="text-xs text-slate-400">{loadError || 'Đang tải ảnh...'}</p>
      )}
      {loadError && imageUrl && <p className="mt-1 text-xs text-rose-500">{loadError}</p>}
    </div>
  );
}

function ChatMessageList({
  messages,
  role,
  userInitials,
  thinking,
  savedAnswerIds,
  onBookmark,
  endRef,
}: {
  messages: ChatMessage[];
  role: Role;
  userInitials: string;
  thinking: boolean;
  savedAnswerIds: Set<string>;
  onBookmark: (message: ChatMessage, messageIndex: number) => void;
  endRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
      {messages.map((message, messageIndex) => {
        const dateKey = message.timestamp ? getChatDateKey(message.timestamp) : '';
        const previousTimestamp = messages[messageIndex - 1]?.timestamp;
        const isFirstMessageOfDay = Boolean(dateKey)
          && (!previousTimestamp || getChatDateKey(previousTimestamp) !== dateKey);
        return (
        <div key={message.id} className="space-y-1">
        {isFirstMessageOfDay && message.timestamp && (
          <p className="py-2 text-center text-xs font-medium text-slate-500">
            {formatChatTimestamp(message.timestamp)}
          </p>
        )}
        <div className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${message.role === 'user' ? 'bg-slate-700' : 'bg-blue-600'}`}>
            {message.role === 'user' ? <span className="text-xs font-semibold text-white">{userInitials}</span> : <Sparkles className="h-4 w-4 text-white" />}
          </div>
          <div className={`max-w-[85%] sm:max-w-[75%] ${message.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block rounded-2xl px-4 py-3 text-left text-sm leading-relaxed ${message.role === 'user' ? 'bg-blue-600 text-white chat-user-markdown' : 'border border-slate-200 bg-slate-50 text-slate-700 markdown-body'}`}>
              {message.imagePath || message.imagePreviewUrl ? (
                <ChatImageAttachment
                  imagePath={message.imagePath}
                  previewUrl={message.imagePreviewUrl}
                  imageName={message.imageName}
                />
              ) : null}
              {message.role === 'user' ? message.content : (
                <MathText text={message.content} compact className="max-w-none break-words text-sm" />
              )}
            </div>
            <div className={`mt-1 flex items-center gap-2 px-1 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {!isFirstMessageOfDay && (
                <p className="text-xs text-slate-400">
                  {message.timestamp ? formatChatTime(message.timestamp) : message.time}
                </p>
              )}
              {role === 'student' && message.role === 'assistant' && message.subject && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {message.subject}
                </span>
              )}
              {role === 'student' && message.role === 'assistant' && messageIndex > 0 && (
                <button
                  type="button"
                  onClick={() => onBookmark(message, messageIndex)}
                  aria-label={savedAnswerIds.has(`answer-${message.id}`) ? 'Bỏ lưu câu trả lời' : 'Lưu câu trả lời'}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${savedAnswerIds.has(`answer-${message.id}`) ? 'text-violet-700 hover:bg-violet-50' : 'text-slate-400 hover:bg-slate-100 hover:text-violet-700'}`}
                >
                  <Bookmark className="h-3.5 w-3.5" fill={savedAnswerIds.has(`answer-${message.id}`) ? 'currentColor' : 'none'} />
                  {savedAnswerIds.has(`answer-${message.id}`) ? 'Đã lưu' : 'Lưu'}
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
        );
      })}
      {thinking && (
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600">
            <Sparkles className="h-4 w-4 animate-pulse text-white" />
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" aria-label="EduBot đang trả lời">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

export function AIChat({ role, userName, userId, studentId, gender, initialSubject, initialPrompt, onExit, isDemo = false }: { role: Role; userName: string; userId?: string; studentId?: string; gender?: AuthUser['gender']; initialSubject?: string; initialPrompt?: string; onExit?: () => void; isDemo?: boolean }) {
  const userInitials = userName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi');
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages(role, gender));
  const [input, setInput] = useState(initialPrompt ?? '');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState(initialSubject ?? '');
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(
    () => window.matchMedia('(min-width: 768px)').matches,
  );
  const [selectedImage, setSelectedImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [savedAnswerIds, setSavedAnswerIds] = useState(
    () => new Set(getSavedItems().filter((item) => item.type === 'answer').map((item) => item.id)),
  );
  const endRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const desktopViewport = window.matchMedia('(min-width: 768px)');
    const syncHistoryVisibility = () => setHistoryOpen(desktopViewport.matches);
    desktopViewport.addEventListener('change', syncHistoryVisibility);
    return () => desktopViewport.removeEventListener('change', syncHistoryVisibility);
  }, []);

  const handleImageSelection = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.');
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setError('Ảnh đính kèm phải có dung lượng tối đa 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('Không thể đọc ảnh đã chọn.');
        return;
      }
      setSelectedImage({ file, previewUrl: reader.result });
      setError('');
    };
    reader.onerror = () => setError('Không thể đọc ảnh đã chọn.');
    reader.readAsDataURL(file);
  };

  const handlePasteImage = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData.items)
      .find((item) => item.kind === 'file' && item.type.startsWith('image/'));
    const pastedImage = imageItem?.getAsFile()
      ?? Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'));
    if (!pastedImage) return;
    event.preventDefault();
    if (pastedImage.name) {
      handleImageSelection(pastedImage);
      return;
    }
    const extension = pastedImage.type === 'image/png' ? 'png'
      : pastedImage.type === 'image/webp' ? 'webp' : 'jpg';
    handleImageSelection(new File([pastedImage], `clipboard-image-${Date.now()}.${extension}`, {
      type: pastedImage.type,
      lastModified: Date.now(),
    }));
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const startNewConversation = () => {
    setSubject(role === 'student' ? (initialSubject ?? '') : '');
    setActiveConversationId(null);
    setMessages(getInitialMessages(role, gender));
    setInput('');
    setSelectedImage(null);
    if (!window.matchMedia('(min-width: 768px)').matches) setHistoryOpen(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
    setError('');
  };

  const refreshConversationList = async () => {
    const updatedConversations = await requestConversationList();
    setConversations(updatedConversations);
  };

  const openConversation = async (conversationId: string) => {
    if (thinking) return;
    setHistoryLoading(true);
    setError('');
    try {
      const conversation = await requestConversation(conversationId);
      setActiveConversationId(conversation.id);
      setSubject(conversation.subject === 'Tổng hợp' ? '' : conversation.subject);
      setMessages(conversation.messages.map((message) => toChatMessage(message, conversation.id)));
      setInput('');
      removeSelectedImage();
      if (!window.matchMedia('(min-width: 768px)').matches) setHistoryOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể mở cuộc trò chuyện.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    let cancelled = false;
    const loadConversations = async () => {
      setHistoryLoading(true);
      setHistoryError('');
      try {
        let serverConversations = await requestConversationList();
        if (role === 'student') {
          const legacy = readLegacyStudentConversations();
          if (legacy.loadError) throw new Error(legacy.loadError);
          if (legacy.keyPresent) {
            if (legacy.conversations.length > 0) {
              await importLegacyConversationsRequest(legacy.conversations);
            }
            localStorage.removeItem('eduflow-ai-chat-history');
            serverConversations = await requestConversationList();
          }
        }
        if (!cancelled) setConversations(serverConversations);
      } catch (loadError) {
        if (!cancelled) {
          setHistoryError(loadError instanceof Error ? loadError.message : 'Không thể tải lịch sử chat.');
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    void loadConversations();
    return () => { cancelled = true; };
  }, [role]);

  const handleSend = async (text?: string) => {
    const content = (text || input).trim() || (selectedImage ? 'Hãy mô tả và phân tích ảnh đính kèm.' : '');
    if (!content || thinking) return;
    const imageToSend = selectedImage;
    let explanationStyle: 'concise' | 'detailed' = 'detailed';
    let weeklyPlanContext: ReturnType<typeof getStudentWeeklyPlanContext>;
    if (role === 'student' || role === 'lecturer') {
      if (!userId) {
        setError('Không thể xác định tài khoản để tải thiết lập AI.');
        return;
      }
      const { style, error: settingsError } = readExplanationStyle(userId, role);
      if (settingsError) {
        setError(settingsError);
        return;
      }
      explanationStyle = style;
      if (role === 'student') {
        try {
          weeklyPlanContext = getStudentWeeklyPlanContext(studentId);
        } catch (contextError) {
          setError(contextError instanceof Error ? contextError.message : 'Không thể đọc kế hoạch tuần đã lưu.');
          return;
        }
      }
    }
    const userMsg: ChatMessage = {
      id: `u${Date.now()}`,
      role: 'user',
      content,
      time: 'Bây giờ',
      timestamp: new Date().toISOString(),
      ...(imageToSend ? { imagePreviewUrl: imageToSend.previewUrl, imageName: imageToSend.file.name } : {}),
    };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setThinking(true);
    setError('');
    try {
      const requestBody = new FormData();
      requestBody.append('message', content);
      if (activeConversationId) requestBody.append('conversationId', activeConversationId);
      requestBody.append('explanationStyle', explanationStyle);
      if (role === 'student') {
        requestBody.append('userName', userName);
        requestBody.append('subject', subject);
        if (weeklyPlanContext) requestBody.append('weeklyPlanContext', JSON.stringify(weeklyPlanContext));
      }
      if (imageToSend) requestBody.append('image', imageToSend.file);
      const response = await authenticatedFetch('/api/ai/chat', {
        method: 'POST',
        body: requestBody,
      });
      const result: unknown = await response.json();
      const data = isRecord(result) && isRecord(result.data) ? result.data : null;
      const reply = data && typeof data.reply === 'string' ? data.reply : '';
      if (!response.ok || !isRecord(result) || result.success !== true || !reply
        || !data || typeof data.conversationId !== 'string' || typeof data.userMessageId !== 'string') {
        throw new Error(isRecord(result) && typeof result.message === 'string'
          ? result.message
          : 'Không thể kết nối tới AI server.');
      }
      const detectedSubject = role === 'student' && typeof data.subject === 'string' ? data.subject : undefined;
      setActiveConversationId(data.conversationId);
      if (detectedSubject) setSubject(detectedSubject === 'Chưa phân loại' ? '' : detectedSubject);
      const imagePath = imageToSend
        ? `/api/ai/conversations/${encodeURIComponent(data.conversationId)}/messages/${encodeURIComponent(data.userMessageId)}/image`
        : undefined;
      setMessages((currentMessages) => [...currentMessages.map((messageItem) => (
        messageItem.id === userMsg.id && imagePath
          ? { ...messageItem, imagePath, imagePreviewUrl: undefined }
          : messageItem
      )), {
        id: `a${Date.now()}`,
        role: 'assistant',
        content: reply,
        time: 'Bây giờ',
        timestamp: new Date().toISOString(),
        ...(detectedSubject ? { subject: detectedSubject } : {}),
      }]);
      if (role === 'student' && !isDemo) {
        void recordStudentLearningActivity('ai_chat').catch((activityError: unknown) => {
          console.error('Could not record student AI-study activity.', activityError);
        });
      }
      setSelectedImage(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      await refreshConversationList();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối tới AI server.');
    } finally {
      setThinking(false);
    }
  };

  const handleToggleBookmark = (message: ChatMessage, messageIndex: number) => {
    const id = `answer-${message.id}`;
    try {
      if (savedAnswerIds.has(id)) {
        removeSavedItem(id);
        setSavedAnswerIds((current) => {
          const updated = new Set(current);
          updated.delete(id);
          return updated;
        });
        setError('');
        return;
      }

      const question = messages.slice(0, messageIndex).reverse().find((item) => item.role === 'user')?.content
        ?? 'Lời giải EduBot';
      const title = question.length > 72 ? `${question.slice(0, 69)}...` : question;
      saveItem({
        id,
        type: 'answer',
        title,
        subject: message.subject ?? (subject || 'Tổng hợp'),
        question,
        answer: message.content,
        savedAt: new Date().toISOString(),
      });
      setSavedAnswerIds((current) => new Set(current).add(id));
      setError('');
    } catch (storageError) {
      setError(storageError instanceof Error ? storageError.message : 'Không thể cập nhật kho lưu trữ.');
    }
  };

  const deleteChatConversation = async (conversationId: string) => {
    try {
      await deleteConversationRequest(conversationId);
      setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
      if (activeConversationId === conversationId) startNewConversation();
      setError('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa cuộc trò chuyện.');
    }
  };

  if (role === 'student') {
    return (
      <div className="relative flex h-[calc(100vh-140px)] min-h-[540px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {historyOpen && <button type="button" aria-label="Đóng lịch sử chat" onClick={() => setHistoryOpen(false)} className="absolute inset-0 z-10 bg-slate-950/20 md:hidden" />}
        {historyOpen && (
          <aside className="absolute inset-y-0 left-0 z-20 flex w-[min(18rem,85vw)] flex-col border-r border-slate-200 bg-slate-50/95 shadow-xl md:relative md:w-64 md:shrink-0 md:bg-slate-50/80 md:shadow-none lg:w-72">
            <div className="p-3">
              <button type="button" disabled={thinking} onClick={startNewConversation} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="h-4 w-4" /> Cuộc trò chuyện mới
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Lịch sử chat</h2>
              {historyError && <p role="alert" className="mx-2 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{historyError}</p>}
              {historyLoading && <p className="px-3 py-2 text-sm text-slate-400">Đang tải lịch sử...</p>}
              {!historyLoading && conversations.length ? (
                <div className="space-y-1">
                  {conversations.map((conversation) => (
                    <div key={conversation.id} className={`group flex items-center gap-1 rounded-xl ${conversation.id === activeConversationId ? 'bg-blue-100 text-blue-900' : 'text-slate-700 hover:bg-white'}`}>
                      <button type="button" disabled={thinking || historyLoading} onClick={() => void openConversation(conversation.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:opacity-50">
                        <span className="block truncate text-sm font-medium">{conversation.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{conversation.subject || 'Tổng hợp'}</span>
                      </button>
                      <button type="button" disabled={thinking} onClick={() => void deleteChatConversation(conversation.id)} aria-label={`Xóa cuộc trò chuyện ${conversation.title}`} className="mr-1 rounded-lg p-2 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : !historyLoading && (
                <p className="px-3 py-2 text-sm text-slate-400">Các cuộc trò chuyện của bạn sẽ hiện ở đây.</p>
              )}
            </div>
          </aside>
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              {onExit && (
                <button type="button" onClick={onExit} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                  <ArrowLeft className="h-4 w-4" /> Thoát
                </button>
              )}
              <button type="button" onClick={() => setHistoryOpen((open) => !open)} aria-label={historyOpen ? 'Thu gọn lịch sử chat' : 'Mở lịch sử chat'} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
                {historyOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Trợ lý học tập</p>
                <h2 className="truncate font-semibold text-slate-900">{subject ? `Trò chuyện môn ${subject}` : 'Hỏi EduBot bất kỳ môn nào'}</h2>
              </div>
            </div>
            <button type="button" disabled={thinking} onClick={startNewConversation} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="h-4 w-4" /> Cuộc trò chuyện mới
            </button>
          </header>

          <ChatMessageList messages={messages} role={role} userInitials={userInitials} thinking={thinking} savedAnswerIds={savedAnswerIds} onBookmark={handleToggleBookmark} endRef={endRef} />

          {error && <p role="alert" className="mx-4 mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:mx-6">{error}</p>}
          <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className="border-t border-slate-100 p-3 sm:px-5 sm:py-4">
            {selectedImage && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-2">
                <img src={selectedImage.previewUrl} alt="Ảnh sẽ gửi" className="h-16 w-16 rounded-lg object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{selectedImage.file.name}</span>
                <button type="button" disabled={thinking} onClick={removeSelectedImage} aria-label="Bỏ ảnh đính kèm" className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-rose-600 disabled:opacity-50">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { handleImageSelection(event.target.files?.[0]); event.target.value = ''; }} />
              <button type="button" disabled={thinking} onClick={() => imageInputRef.current?.click()} aria-label="Đính kèm ảnh" title="Chọn ảnh hoặc dán ảnh" className="shrink-0 rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50">
                <Paperclip className="h-5 w-5" />
              </button>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPaste={handlePasteImage}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }}
                placeholder="Nhập câu hỏi hoặc dán ảnh..."
                rows={1}
                className="max-h-32 min-w-0 flex-1 resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button type="submit" disabled={(!input.trim() && !selectedImage) || thinking} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                Gửi <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-140px)] min-h-[540px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm animate-fadeIn">
      {historyOpen && <button type="button" aria-label="Đóng lịch sử chat" onClick={() => setHistoryOpen(false)} className="absolute inset-0 z-10 bg-slate-950/20 md:hidden" />}
      {historyOpen && (
        <aside className="absolute inset-y-0 left-0 z-20 flex w-[min(18rem,85vw)] flex-col border-r border-slate-200 bg-slate-50/95 shadow-xl md:relative md:w-64 md:shrink-0 md:bg-slate-50/80 md:shadow-none lg:w-72">
          <div className="p-3">
            <button type="button" disabled={thinking} onClick={startNewConversation} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="h-4 w-4" /> Cuộc trò chuyện mới
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Lịch sử chat</h2>
            {historyError && <p role="alert" className="mx-2 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{historyError}</p>}
            {historyLoading && <p className="px-3 py-2 text-sm text-slate-400">Đang tải lịch sử...</p>}
            {!historyLoading && conversations.length > 0 && (
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <div key={conversation.id} className={`group flex items-center gap-1 rounded-xl ${conversation.id === activeConversationId ? 'bg-blue-100 text-blue-900' : 'text-slate-700 hover:bg-white'}`}>
                    <button type="button" disabled={thinking || historyLoading} onClick={() => void openConversation(conversation.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:opacity-50">
                      <span className="block truncate text-sm font-medium">{conversation.title}</span>
                    </button>
                    <button type="button" disabled={thinking} onClick={() => void deleteChatConversation(conversation.id)} aria-label={`Xóa cuộc trò chuyện ${conversation.title}`} className="mr-1 rounded-lg p-2 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!historyLoading && conversations.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-400">Các cuộc trò chuyện sẽ hiện ở đây.</p>
            )}
          </div>
        </aside>
      )}
      <section className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <header className="card mb-3 flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setHistoryOpen((open) => !open)} aria-label={historyOpen ? 'Thu gọn lịch sử chat' : 'Mở lịch sử chat'} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
              {historyOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Trợ lý AI EduFlow</h2>
              <p className="text-xs text-slate-500">{activeConversationId ? 'Cuộc trò chuyện đã lưu' : 'Bắt đầu một cuộc trò chuyện mới'}</p>
            </div>
          </div>
          <button type="button" disabled={thinking} onClick={startNewConversation} className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" /> Cuộc trò chuyện mới
          </button>
        </header>

        <div className="card flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((msg, messageIndex) => {
            const dateKey = msg.timestamp ? getChatDateKey(msg.timestamp) : '';
            const previousTimestamp = messages[messageIndex - 1]?.timestamp;
            const isFirstMessageOfDay = Boolean(dateKey)
              && (!previousTimestamp || getChatDateKey(previousTimestamp) !== dateKey);
            return (
            <div key={msg.id} className="space-y-1">
            {isFirstMessageOfDay && msg.timestamp && (
              <p className="py-2 text-center text-xs font-medium text-slate-500">{formatChatTimestamp(msg.timestamp)}</p>
            )}
            <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${msg.role === 'user' ? 'bg-slate-700' : 'bg-blue-600'}`}>
                {msg.role === 'user' ? <span className="text-xs font-medium text-white">{role === 'lecturer' ? 'GV' : 'AD'}</span> : <Sparkles className="h-4 w-4 text-white" />}
              </div>
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block rounded-2xl px-4 py-3 text-left text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white chat-user-markdown' : 'border border-slate-200 bg-slate-50 text-slate-700 markdown-body'}`}>
                  {msg.imagePath || msg.imagePreviewUrl ? (
                    <ChatImageAttachment imagePath={msg.imagePath} previewUrl={msg.imagePreviewUrl} imageName={msg.imageName} />
                  ) : null}
                  {msg.role === 'user' ? msg.content : (
                    <MathText text={msg.content} compact className="max-w-none break-words text-sm" />
                  )}
                </div>
                <div className={`mt-1 flex items-center gap-2 px-1 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {!isFirstMessageOfDay && (
                    <p className="text-xs text-slate-400">
                      {msg.timestamp ? formatChatTime(msg.timestamp) : msg.time}
                    </p>
                  )}
                </div>
              </div>
            </div>
            </div>
            );
          })}
          {thinking && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                <Sparkles className="h-4 w-4 animate-pulse text-white" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3" aria-label="EduBot đang trả lời">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-rose-600">{error}</p>}
        <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className="card mt-3 p-3">
          {selectedImage && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-2">
              <img src={selectedImage.previewUrl} alt="Ảnh sẽ gửi" className="h-16 w-16 rounded-lg object-cover" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{selectedImage.file.name}</span>
              <button type="button" disabled={thinking} onClick={removeSelectedImage} aria-label="Bỏ ảnh đính kèm" className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-rose-600 disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { handleImageSelection(event.target.files?.[0]); event.target.value = ''; }} />
            <button type="button" disabled={thinking} onClick={() => imageInputRef.current?.click()} aria-label="Đính kèm ảnh" title="Chọn ảnh hoặc dán ảnh" className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50">
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onPaste={handlePasteImage}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }}
              placeholder="Nhập câu hỏi hoặc dán ảnh..."
              rows={1}
              className="max-h-32 min-w-0 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button type="submit" disabled={(!input.trim() && !selectedImage) || thinking} className="btn-primary h-9 shrink-0 disabled:cursor-not-allowed disabled:opacity-50">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
