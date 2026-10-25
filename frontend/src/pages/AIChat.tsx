import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Bookmark, PanelLeftClose, PanelLeftOpen, Paperclip, Plus, RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react';
import type { ChatMessage, Role } from '@/types';
import { getSavedItems, removeSavedItem, saveItem } from '@/pages/student/savedItems';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { authenticatedFetch } from '@/auth/authApi';
import 'katex/dist/katex.min.css';
const initialMessages: Record<Role, ChatMessage[]> = {
  student: [{
    id: 'm1',
    role: 'assistant',
    content: 'Chào em! Em cứ gửi câu hỏi, mình sẽ cùng em tìm hiểu và tự nhận diện môn học phù hợp.',
    time: 'Bây giờ',
  }],
  lecturer: [{
    id: 'm1',
    role: 'assistant',
    content: 'Xin chào! Tôi là trợ lý AI EduFlow. Tôi có thể hỗ trợ thầy/cô chuẩn bị bài giảng, tạo câu hỏi và giải đáp các nội dung học tập.',
    time: 'Bây giờ',
  }],
  admin: [{
    id: 'm1',
    role: 'assistant',
    content: 'Xin chào! Tôi là trợ lý AI EduFlow. Tôi có thể hỗ trợ các câu hỏi về học tập và sử dụng nền tảng.',
    time: 'Bây giờ',
  }],
};

interface StudentConversation {
  id: string;
  subject: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

function isStudentConversation(value: unknown): value is StudentConversation {
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

function readStudentConversations(): { conversations: StudentConversation[]; loadError: string } {
  try {
    const stored = localStorage.getItem('eduflow-ai-chat-history');
    if (!stored) return { conversations: [], loadError: '' };
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every(isStudentConversation)) {
      return { conversations: parsed, loadError: '' };
    }
    return { conversations: [], loadError: 'Lịch sử chat bị sai định dạng và chưa được thay đổi. Hãy tạo cuộc trò chuyện mới để lưu lịch sử mới.' };
  } catch (loadError) {
    const message = loadError instanceof Error ? loadError.message : 'Dữ liệu không đọc được.';
    return { conversations: [], loadError: `Không thể đọc lịch sử chat: ${message}` };
  }
}


const formatMarkdownText = (text: string) => {
  return text
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
};

function ChatMessageList({
  messages,
  role,
  thinking,
  savedAnswerIds,
  onBookmark,
  endRef,
}: {
  messages: ChatMessage[];
  role: Role;
  thinking: boolean;
  savedAnswerIds: Set<string>;
  onBookmark: (message: ChatMessage, messageIndex: number) => void;
  endRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
      {messages.map((message, messageIndex) => (
        <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${message.role === 'user' ? 'bg-slate-700' : 'bg-blue-600'}`}>
            {message.role === 'user' ? <span className="text-xs font-semibold text-white">MA</span> : <Sparkles className="h-4 w-4 text-white" />}
          </div>
          <div className={`max-w-[85%] sm:max-w-[75%] ${message.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block rounded-2xl px-4 py-3 text-left text-sm leading-relaxed ${message.role === 'user' ? 'bg-blue-600 text-white chat-user-markdown' : 'border border-slate-200 bg-slate-50 text-slate-700 markdown-body'}`}>
              {message.role === 'user' ? message.content : (
                <div className="prose prose-slate max-w-none break-words whitespace-pre-line text-sm">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {formatMarkdownText(message.content)}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            <div className={`mt-1 flex items-center gap-2 px-1 ${message.role === 'user' ? 'justify-end' : ''}`}>
              <p className="text-xs text-slate-400">{message.time}</p>
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
      ))}
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

export function AIChat({ role, initialSubject, initialPrompt, onExit }: { role: Role; initialSubject?: string; initialPrompt?: string; onExit?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages[role]);
  const [input, setInput] = useState(initialPrompt ?? '');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState(initialSubject ?? '');
  const [studentHistory, setStudentHistory] = useState(readStudentConversations);
  const studentConversations = studentHistory.conversations;
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [savedAnswerIds, setSavedAnswerIds] = useState(
    () => new Set(getSavedItems().filter((item) => item.type === 'answer').map((item) => item.id)),
  );
  const endRef = useRef<HTMLDivElement>(null);
  const chatIdRef = useRef(0);

  const createConversationId = () => `chat-${Date.now()}-${chatIdRef.current++}`;

  const startNewStudentConversation = () => {
    setSubject('');
    setActiveConversationId(null);
    setMessages(initialMessages.student);
    setInput('');
    setError('');
  };

  const openStudentConversation = (conversation: StudentConversation) => {
    setActiveConversationId(conversation.id);
    setSubject(conversation.subject === 'Tổng hợp' ? '' : conversation.subject);
    setMessages(conversation.messages);
    setError('');
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    if (role !== 'student' || !activeConversationId) return;
    setStudentHistory((history) => {
      const current = history.conversations;
      const firstQuestion = messages.find((message) => message.role === 'user')?.content;
      const updated: StudentConversation = {
        id: activeConversationId,
        subject: subject || 'Tổng hợp',
        title: firstQuestion ? firstQuestion.slice(0, 52) : (subject ? `Trao đổi môn ${subject}` : 'Trò chuyện mới'),
        messages,
        updatedAt: Date.now(),
      };
      return {
        conversations: [...current.filter((conversation) => conversation.id !== activeConversationId), updated]
          .sort((first, second) => second.updatedAt - first.updatedAt),
        loadError: '',
      };
    });
  }, [activeConversationId, messages, role, subject]);

  useEffect(() => {
    if (studentHistory.loadError) return;
    try {
      localStorage.setItem('eduflow-ai-chat-history', JSON.stringify(studentConversations));
    } catch {
      setError('Không thể lưu lịch sử trò chuyện trên thiết bị này.');
    }
  }, [studentConversations, studentHistory.loadError]);

  useEffect(() => {
    if (role === 'student' && initialSubject && !activeConversationId) {
      const id = createConversationId();
      setActiveConversationId(id);
    }
  }, [activeConversationId, initialSubject, role]);

  const handleSend = async (text?: string) => {
    const content = (text || input).trim();
    if (!content) return;
    if (role === 'student' && !activeConversationId) setActiveConversationId(createConversationId());
    let explanationStyle: 'concise' | 'detailed' = 'detailed';
    if (role === 'student') {
      try {
        const storedPreferences = localStorage.getItem('eduflow.student.preferences');
        if (storedPreferences) {
          const parsed: unknown = JSON.parse(storedPreferences);
          if (!parsed || typeof parsed !== 'object' || !['concise', 'detailed'].includes(String((parsed as Record<string, unknown>).explanationStyle))) {
            throw new Error('Thiết lập cách giải thích của EduBot không đúng định dạng. Hãy kiểm tra lại trong Hồ sơ cá nhân.');
          }
          explanationStyle = (parsed as { explanationStyle: 'concise' | 'detailed' }).explanationStyle;
        }
      } catch (preferenceError) {
        setError(preferenceError instanceof Error ? preferenceError.message : 'Không thể đọc thiết lập AI.');
        return;
      }
    }
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: 'user', content, time: 'Bây giờ' };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setThinking(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          role,
          ...(role === 'student' ? { userName: 'Lê Văn An', subject, explanationStyle } : {}),
        }),
      });
      const result: { success: boolean; data?: { reply?: string; subject?: string }; message?: string } = await response.json();
      const reply = result.data?.reply;
      if (!response.ok || !result.success || !reply) {
        throw new Error(result.message || 'Không thể kết nối tới AI server.');
      }
      const detectedSubject = role === 'student' ? result.data?.subject : undefined;
      if (detectedSubject) setSubject(detectedSubject === 'Chưa phân loại' ? '' : detectedSubject);
      setMessages((m) => [...m, {
        id: `a${Date.now()}`,
        role: 'assistant',
        content: reply,
        time: 'Bây giờ',
        ...(detectedSubject ? { subject: detectedSubject } : {}),
      }]);
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

  const deleteStudentConversation = (conversationId: string) => {
    setStudentHistory((history) => ({
      conversations: history.conversations.filter((conversation) => conversation.id !== conversationId),
      loadError: history.loadError,
    }));
    if (activeConversationId === conversationId) startNewStudentConversation();
  };

  if (role === 'student') {
    return (
      <div className="flex h-[calc(100vh-140px)] min-h-[540px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {historyOpen && (
          <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50/80 sm:w-72">
            <div className="p-3">
              <button type="button" onClick={startNewStudentConversation} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                <Plus className="h-4 w-4" /> Cuộc trò chuyện mới
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Lịch sử chat</h2>
              {studentHistory.loadError && <p role="alert" className="mx-2 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{studentHistory.loadError}</p>}
              {studentConversations.length ? (
                <div className="space-y-1">
                  {studentConversations.map((conversation) => (
                    <div key={conversation.id} className={`group flex items-center gap-1 rounded-xl ${conversation.id === activeConversationId ? 'bg-blue-100 text-blue-900' : 'text-slate-700 hover:bg-white'}`}>
                      <button type="button" onClick={() => openStudentConversation(conversation)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
                        <span className="block truncate text-sm font-medium">{conversation.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{conversation.subject}</span>
                      </button>
                      <button type="button" onClick={() => deleteStudentConversation(conversation.id)} aria-label={`Xóa cuộc trò chuyện ${conversation.title}`} className="mr-1 rounded-lg p-2 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus:opacity-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-2 text-sm text-slate-400">Các cuộc trò chuyện của em sẽ hiện ở đây.</p>
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
            <button type="button" onClick={startNewStudentConversation} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              <Plus className="h-4 w-4" /> Cuộc trò chuyện mới
            </button>
          </header>

          <ChatMessageList messages={messages} role={role} thinking={thinking} savedAnswerIds={savedAnswerIds} onBookmark={handleToggleBookmark} endRef={endRef} />

          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-6">
              {['Giải thích bài này giúp mình', 'Gợi ý cách bắt đầu', 'Tóm tắt kiến thức chính'].map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => handleSend(suggestion)} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 transition hover:bg-blue-100">
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {error && <p role="alert" className="mx-4 mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:mx-6">{error}</p>}
          <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className="border-t border-slate-100 p-3 sm:px-5 sm:py-4">
            <div className="flex items-end gap-2">
              <button type="button" aria-label="Đính kèm tệp" className="shrink-0 rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                <Paperclip className="h-5 w-5" />
              </button>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }}
                placeholder="Nhập câu hỏi của em..."
                rows={1}
                className="max-h-32 min-w-0 flex-1 resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button type="submit" disabled={!input.trim() || thinking} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                Gửi <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-fadeIn">
      {/* Header */}
      <div className="card px-4 py-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">Trợ lý AI EduFlow</h2>
          </div>
        </div>
        <button onClick={() => setMessages(initialMessages[role])} className="btn-ghost">
          <RefreshCw className="w-3.5 h-3.5" /> Cuộc trò chuyện mới
        </button>
      </div>

      {/* Messages */}
      <div className="card flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-slate-700' : 'bg-blue-600'
            }`}>
              {msg.role === 'user' ? (
                <span className="text-white text-sm font-medium">{role === 'lecturer' ? 'GV' : 'AD'}</span>
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-white" />
              )}
            </div>
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block px-3.5 py-2.5 rounded-lg text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white chat-user-markdown'
                  : 'bg-slate-50 border border-slate-200 text-slate-700 markdown-body'
              }`}>
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  /* Đã sửa: Bọc lớp định dạng prose bên ngoài và xóa className trong ReactMarkdown */
                  <div className="prose prose-slate max-w-none text-sm break-words whitespace-pre-line text-left">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {formatMarkdownText(msg.content)}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              <div className={`mt-1 flex items-center gap-2 px-1 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                <p className="text-sm text-slate-400">{msg.time}</p>
              </div>
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
            </div>
            <div className="inline-block px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
      {/* Input */}
      <div className="card p-3 mt-3">
        <div className="flex items-end gap-2">
          <button className="p-2 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0">
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Nhập câu hỏi hoặc yêu cầu cho AI..."
            rows={1}
            className="flex-1 resize-none px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors max-h-32"
          />
          <button onClick={() => handleSend()} disabled={!input.trim()} className="btn-primary shrink-0 h-9">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
