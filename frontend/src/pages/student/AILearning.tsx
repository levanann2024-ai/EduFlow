import { ArrowRight, BookOpenCheck, MessageCircle, Sparkles, Target } from 'lucide-react';
import type { Page } from '@/types';

interface AILearningProps {
  onNavigate: (page: Page) => void;
}

const learningTools = [
  {
    title: 'AI Trợ giảng',
    description: 'Hỏi bài, tìm lời giải và hiểu kiến thức qua hướng dẫn từng bước.',
    action: 'Bắt đầu trò chuyện',
    page: 'ai-chat' as const,
    icon: MessageCircle,
    wash: 'from-violet-600 to-indigo-600',
    surface: 'bg-violet-50',
    accent: 'text-violet-700',
  },
  {
    title: 'AI Ôn luyện',
    description: 'Luyện theo chủ đề hoặc tạo đề để tự kiểm tra và xem kết quả.',
    action: 'Chọn môn ôn tập',
    page: 'ai-practice' as const,
    icon: BookOpenCheck,
    wash: 'from-blue-600 to-cyan-600',
    surface: 'bg-blue-50',
    accent: 'text-blue-700',
  },
];

export function AILearning({ onNavigate }: AILearningProps) {
  return (
    <main className="space-y-8 pb-8">
      <header className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 py-8 shadow-sm sm:px-9 sm:py-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-200">
            <Sparkles className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-blue-800 sm:text-4xl lg:text-5xl">AI học tập</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Chọn cách học phù hợp: hỏi trợ giảng khi cần giải đáp, hoặc luyện tập để nhớ bài lâu hơn.
          </p>
        </div>
      </header>

      <section aria-label="Chọn công cụ AI" className="grid gap-6 lg:grid-cols-2">
        {learningTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.page}
              type="button"
              onClick={() => onNavigate(tool.page)}
              className="group relative flex min-h-72 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:p-6"
            >
              <span aria-hidden="true" className={`absolute -right-12 -top-14 h-48 w-48 rounded-full ${tool.surface} opacity-80 transition-transform duration-300 group-hover:scale-110`} />
              <span className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.wash} text-white shadow-md`}>
                <Icon className="h-8 w-8" />
              </span>
              <span className="relative mt-7 text-2xl font-bold text-slate-900 sm:text-3xl">{tool.title}</span>
              <span className="relative mt-3 max-w-lg text-base leading-7 text-slate-600">{tool.description}</span>
              <span className={`relative mt-auto inline-flex items-center gap-2 pt-8 text-sm font-bold ${tool.accent}`}>
                {tool.action}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
              {tool.page === 'ai-practice' && <Target aria-hidden="true" className="absolute bottom-7 right-8 h-14 w-14 text-blue-100 transition-transform group-hover:scale-110" />}
            </button>
          );
        })}
      </section>
    </main>
  );
}
