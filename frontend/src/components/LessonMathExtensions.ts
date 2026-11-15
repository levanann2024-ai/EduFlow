import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { BlockMathView, InlineMathView } from './LessonEditorNodeViews';

export const InlineMath = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({
    latex: { default: '' },
    display: { default: false },
  }),
  parseHTML: () => [{ tag: 'span[data-lesson-math="inline"]' }],
  renderHTML: ({ node }) => ['span', { 'data-lesson-math': 'inline', 'data-latex': node.attrs.latex }],
  addNodeView: () => ReactNodeViewRenderer(InlineMathView),
  parseMarkdown: (token, helpers) => helpers.createNode('inlineMath', {
    latex: token.text ?? '',
    display: token.display === true,
  }),
  renderMarkdown: (node) => node.attrs?.display
    ? `$$${node.attrs?.latex ?? ''}$$`
    : `$${node.attrs?.latex ?? ''}$`,
  markdownTokenizer: {
    name: 'inlineMath',
    level: 'inline',
    start: (source: string) => {
      const positions = [source.indexOf('$'), source.indexOf('\\('), source.indexOf('\\[')]
        .filter((position) => position >= 0);
      return positions.length ? Math.min(...positions) : -1;
    },
    tokenize: (source: string) => {
      if (source.startsWith('$$')) {
        const match = /^\$\$([^$\n]+?)\$\$/.exec(source);
        return match ? {
          type: 'inlineMath',
          raw: match[0],
          text: match[1],
          display: true,
        } : undefined;
      }
      if (source.startsWith('\\(') || source.startsWith('\\[')) {
        const display = source.startsWith('\\[');
        const closing = display ? '\\]' : '\\)';
        const closingIndex = source.indexOf(closing, 2);
        if (closingIndex > 2) {
          return {
            type: 'inlineMath',
            raw: source.slice(0, closingIndex + 2),
            text: source.slice(2, closingIndex),
            display,
          };
        }
        return undefined;
      }
      const match = /^\$([^$\n]+?)\$/.exec(source);
      return match ? { type: 'inlineMath', raw: match[0], text: match[1] } : undefined;
    },
  },
});

export const BlockMath = Node.create({
  name: 'blockMath',
  group: 'block',
  atom: true,
  addAttributes: () => ({ latex: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-lesson-math="block"]' }],
  renderHTML: ({ node }) => ['div', { 'data-lesson-math': 'block', 'data-latex': node.attrs.latex }],
  addNodeView: () => ReactNodeViewRenderer(BlockMathView),
  parseMarkdown: (token, helpers) => helpers.createNode('blockMath', { latex: token.text ?? '' }),
  renderMarkdown: (node) => `$$\n${node.attrs?.latex ?? ''}\n$$`,
  markdownTokenizer: {
    name: 'blockMath',
    level: 'block',
    start: (source: string) => {
      const match = /(?:^|\n)[ \t]*(?:\$\$|\\\[)/.exec(source);
      return match ? match.index + match[0].length - 2 : -1;
    },
    tokenize: (source: string) => {
      const match = /^(?:\$\$[ \t]*\r?\n([\s\S]+?)\r?\n\$\$[ \t]*(?:\r?\n|$)|\$\$([^\n]+?)\$\$|\\\[[ \t]*\r?\n([\s\S]+?)\r?\n\\\][ \t]*(?:\r?\n|$)|\\\[([^\n]+?)\\\])/.exec(source);
      return match
        ? { type: 'blockMath', raw: match[0], text: (match[1] ?? match[2] ?? match[3] ?? match[4]).trim() }
        : undefined;
    },
  },
});
