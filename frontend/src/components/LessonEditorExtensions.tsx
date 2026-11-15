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
import { LessonImageView } from './LessonEditorNodeViews';
import { BlockMath, InlineMath } from './LessonMathExtensions';
import './LessonEditorContent.css';

const lessonImageExtension = Node.create({
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

const lessonParagraphLayoutExtension = Extension.create({
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
  lessonParagraphLayoutExtension,
  lessonImageExtension,
  InlineMath,
  BlockMath,
  Markdown,
];
