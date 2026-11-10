import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { normalizeLessonMaterialMarkdown } from '@/utils/lessonMaterialMarkdown';

const compactMarkdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-1 whitespace-pre-wrap leading-6">{children}</p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="my-2 text-sm font-bold leading-5">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="my-2 text-sm font-semibold leading-5">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="my-2 text-sm font-semibold leading-5">{children}</h3>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-6">{children}</li>
  ),
  hr: () => <hr className="my-2 border-violet-200" />,
};

const lessonMarkdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-3 pl-4 whitespace-pre-wrap text-slate-700 leading-7">{children}</p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mt-7 border-b border-blue-100 pb-2 text-xl font-extrabold tracking-tight text-blue-950 first:mt-0 sm:text-2xl">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-7 border-b border-blue-100 pb-2 text-xl font-extrabold tracking-tight text-blue-950 first:mt-0 sm:text-2xl">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-5 border-l-2 border-blue-300 pl-3 text-base font-bold text-slate-900 sm:text-lg">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mt-4 pl-4 text-base font-semibold text-slate-900">{children}</h4>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-3 list-disc space-y-1 pl-9">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-3 list-decimal space-y-1 pl-9">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="py-0.5 leading-7">{children}</li>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-4 overflow-x-auto pl-4">
      <table className="min-w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-slate-300 bg-blue-50 px-3 py-2 font-semibold">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-slate-300 px-3 py-2 align-top">{children}</td>
  ),
};

function normalizeMathDelimiters(value: string) {
  return value
    .replace(/\\\$/g, '$')
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula: string) => `$${formula}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula: string) => `$$${formula}$$`);
}

export function MathText({
  text,
  className = '',
  compact = false,
  variant = 'default',
}: {
  text: string;
  className?: string;
  compact?: boolean;
  variant?: 'default' | 'lesson';
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={variant === 'lesson' ? [remarkGfm, remarkMath] : [remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={variant === 'lesson'
          ? lessonMarkdownComponents
          : compact
            ? compactMarkdownComponents
            : { p: ({ children }) => <p className="my-0 whitespace-pre-wrap">{children}</p> }}
      >
        {normalizeMathDelimiters(variant === 'lesson'
          ? normalizeLessonMaterialMarkdown(text)
          : text.replace(/\r\n?/g, '\n'))}
      </ReactMarkdown>
    </div>
  );
}
