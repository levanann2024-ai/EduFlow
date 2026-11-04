import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

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
}: {
  text: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={compact
          ? compactMarkdownComponents
          : { p: ({ children }) => <p className="my-0 whitespace-pre-wrap">{children}</p> }}
      >
        {normalizeMathDelimiters(text.replace(/\r\n?/g, '\n'))}
      </ReactMarkdown>
    </div>
  );
}
