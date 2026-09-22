import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Paperclip, FileText, RefreshCw } from 'lucide-react';
import type { ChatMessage } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
const initialMessages: ChatMessage[] = [
  {
    id: 'm1',
    role: 'assistant',
    content: 'Xin chào! Tôi là trợ lý AI học tập. Tôi có thể giúp bạn giải thích khái niệm, tạo câu hỏi luyện tập, tóm tắt tài liệu và lên kế hoạch học tập. Bạn cần hỗ trợ gì hôm nay?',
    time: 'Bây giờ',
  },
];


const formatMarkdownText = (text: string) => {
  return text
    .replace(/\\\[/g, '$$$$')
    .replace(/\\\]/g, '$$$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
};
export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const handleSend = async (text?: string) => {
    const content = (text || input).trim();
    if (!content) return;
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: 'user', content, time: 'Bây giờ' };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setThinking(true);
    setError('');
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });
      const result: { success: boolean; data?: { reply?: string }; message?: string } = await response.json();
      const reply = result.data?.reply;
      if (!response.ok || !result.success || !reply) {
        throw new Error(result.message || 'Không thể kết nối tới AI server.');
      }
      setMessages((m) => [...m, {
        id: `a${Date.now()}`,
        role: 'assistant',
        content: reply,
        time: 'Bây giờ',
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối tới AI server.');
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-fadeIn">
      {/* Header */}
      <div className="card px-4 py-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">Trợ lý AI học tập</h2>
            <p className="text-sm text-slate-400">Hỏi đáp dựa trên tài liệu môn học</p>
          </div>
        </div>
        <button onClick={() => setMessages(initialMessages)} className="btn-ghost">
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
                <span className="text-white text-sm font-medium">GV</span>
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
              <p className="text-sm text-slate-400 mt-1 px-1">{msg.time}</p>
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
        <p className="text-sm text-slate-400 mt-2 flex items-center gap-1">
          <FileText className="w-3 h-3" />
          AI trả lời dựa trên tài liệu môn học. Kiểm tra lại nội dung quan trọng.
        </p>
      </div>
    </div>
  );
}
