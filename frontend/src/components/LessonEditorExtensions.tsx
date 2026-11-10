import { Extension, Node } from '@tiptap/core';
import { BackgroundColor, Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { TableKit } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { StarterKit } from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { BlockMathView, InlineMathView, LessonImageView } from './LessonEditorNodeViews';
import './LessonEditorContent.css';

const InlineMath = Node.create({
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

const BlockMath = Node.create({
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

const LessonImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: false,
  addAttributes: () => ({
    src: { default: '' },
    alt: { default: '' },
    title: { default: null },
    width: { default: null },
    align: { default: 'center' },
    caption: { default: '' },
  }),
  parseHTML: () => [{ tag: 'figure[data-lesson-image]' }],
  renderHTML: ({ node }) => [
    'figure',
    { 'data-lesson-image': '', 'data-align': node.attrs.align, 'data-width': node.attrs.width },
    ['img', { src: node.attrs.src, alt: node.attrs.alt, title: node.attrs.title }],
    ...(node.attrs.caption ? [['figcaption', {}, node.attrs.caption]] : []),
  ],
  addNodeView: () => ReactNodeViewRenderer(LessonImageView),
  parseMarkdown: (token, helpers) => helpers.createNode('image', {
    src: token.href ?? '',
    alt: token.text ?? '',
    title: token.title ?? null,
  }),
  renderMarkdown: (node) => `![${node.attrs?.alt ?? ''}](${node.attrs?.src ?? ''})`,
});

const LessonParagraphLayout = Extension.create({
  name: 'lessonParagraphLayout',
  addGlobalAttributes: () => [{
    types: ['paragraph', 'heading', 'listItem'],
    attributes: {
      indentLevel: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute('data-indent-level')) || 0,
        renderHTML: ({ indentLevel }) => indentLevel ? { 'data-indent-level': indentLevel } : {},
      },
      lineHeight: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-line-height'),
        renderHTML: ({ lineHeight }) => lineHeight ? { 'data-line-height': lineHeight } : {},
      },
      spaceBefore: {
        default: null,
        parseHTML: (element) => Number(element.getAttribute('data-space-before')) || null,
        renderHTML: ({ spaceBefore }) => spaceBefore ? { 'data-space-before': spaceBefore } : {},
      },
      spaceAfter: {
        default: null,
        parseHTML: (element) => Number(element.getAttribute('data-space-after')) || null,
        renderHTML: ({ spaceAfter }) => spaceAfter ? { 'data-space-after': spaceAfter } : {},
      },
    },
  }],
});

export const lessonEditorExtensions = [
  StarterKit.configure({ link: false, underline: false }),
  TextStyle,
  Color,
  BackgroundColor,
  FontFamily,
  FontSize,
  Highlight.configure({ multicolor: true }),
  Link.configure({ openOnClick: false }),
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TableKit.configure({ table: { resizable: true }, tableCell: {}, tableHeader: {}, tableRow: {} }),
  LessonParagraphLayout,
  LessonImage,
  InlineMath,
  BlockMath,
  Markdown,
];
