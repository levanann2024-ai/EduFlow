import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

function normalizeMathDelimiters(value: string) {
  return value
    .replace(/\\\$/g, '$')
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula: string) => `$${formula}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula: string) => `$$${formula}$$`);
}

export function MathText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{ p: ({ children }) => <p className="my-0 whitespace-pre-wrap">{children}</p> }}
      >
        {normalizeMathDelimiters(text.replace(/\r\n?/g, '\n'))}
      </ReactMarkdown>
    </div>
  );
}
