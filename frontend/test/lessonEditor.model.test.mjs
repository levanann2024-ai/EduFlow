import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { EditorState } from '@tiptap/pm/state';
import { getSchema } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { createServer } from 'vite';

let vite;
let schema;
let markdownManager;
let normalizeLessonEditorMath;
let normalizeLessonEditorMathContent;
let clampLessonImageWidth;

const fontMark = (fontSize) => [{
  type: 'textStyle',
  attrs: { fontSize },
}];

function documentFixture() {
  return {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Lesson heading' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Before formula', marks: fontMark('12px') },
          { type: 'inlineMath', attrs: { latex: 'x^2 + 1', display: false } },
          { type: 'text', text: 'Between formulas', marks: fontMark('24px') },
          { type: 'inlineMath', attrs: { latex: '\\frac{a}{b}', display: false } },
          { type: 'text', text: 'After formula', marks: fontMark('1.25rem') },
        ],
      },
      {
        type: 'blockMath',
        attrs: { latex: '\\sum_{i=1}^{n} i' },
      },
      {
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: 'List item', marks: fontMark('14px') }],
          }],
        }],
      },
      {
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [{
            type: 'tableCell',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: 'Cell text', marks: fontMark('32px') }],
            }],
          }],
        }],
      },
    ],
  };
}

function stateFor(document) {
  return EditorState.create({ schema, doc: schema.nodeFromJSON(document) });
}

function findNode(document, type, predicate = () => true) {
  let match;
  document.descendants((node, pos) => {
    if (!match && node.type.name === type && predicate(node)) {
      match = { node, pos };
      return false;
    }
    return !match;
  });
  assert.ok(match, `Expected to find ${type}`);
  return match;
}

function findTextNode(document, text) {
  return findNode(document, 'text', (node) => node.text === text);
}

function formulas(document) {
  const result = [];
  document.descendants((node) => {
    if (node.type.name === 'inlineMath' || node.type.name === 'blockMath') {
      result.push({ type: node.type.name, latex: node.attrs.latex, display: node.attrs.display });
    }
  });
  return result;
}

function fontSizes(document) {
  const result = [];
  document.descendants((node) => {
    if (!node.isText) return;
    const textStyle = node.marks.find((mark) => mark.type.name === 'textStyle');
    if (textStyle?.attrs.fontSize) result.push(textStyle.attrs.fontSize);
  });
  return [...new Set(result)].sort();
}

before(async () => {
  vite = await createServer({
    configFile: './vite.config.ts',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  const [extensions, editorTypes, imageUtils] = await Promise.all([
    vite.ssrLoadModule('/src/components/LessonEditorExtensions.tsx'),
    vite.ssrLoadModule('/src/types/lessonEditor.ts'),
    vite.ssrLoadModule('/src/utils/lessonImage.ts'),
  ]);
  schema = getSchema(extensions.lessonEditorExtensions);
  markdownManager = new MarkdownManager({ extensions: extensions.lessonEditorExtensions });
  normalizeLessonEditorMath = editorTypes.normalizeLessonEditorMath;
  normalizeLessonEditorMathContent = editorTypes.normalizeLessonEditorMathContent;
  clampLessonImageWidth = imageUtils.clampLessonImageWidth;
});

after(async () => {
  await vite?.close();
});

test('editing paragraph, heading, list, and table text preserves formulas and unrelated font sizes', () => {
  let state = stateFor(documentFixture());
  const originalFormulas = formulas(state.doc);
  const originalFontSizes = fontSizes(state.doc);

  for (const text of ['Before formula', 'List item', 'Cell text']) {
    const { node, pos } = findTextNode(state.doc, text);
    state = state.apply(state.tr.insertText(' edited', pos + Math.min(3, node.nodeSize - 1)));
  }

  const heading = findNode(state.doc, 'heading');
  const headingText = heading.node.firstChild;
  state = state.apply(state.tr.insertText(
    'Updated heading',
    heading.pos + 1,
    heading.pos + 1 + headingText.nodeSize,
  ));

  assert.deepEqual(formulas(state.doc), originalFormulas);
  assert.deepEqual(fontSizes(state.doc), originalFontSizes);
});

test('editing one selected formula changes only its LaTeX source', () => {
  const state = stateFor(documentFixture());
  const target = findNode(state.doc, 'inlineMath', (node) => node.attrs.latex === '\\frac{a}{b}');
  const updatedState = state.apply(state.tr.setNodeMarkup(
    target.pos,
    undefined,
    { ...target.node.attrs, latex: '\\frac{c}{d}' },
    target.node.marks,
  ));

  assert.deepEqual(formulas(updatedState.doc).map(({ latex }) => latex), [
    'x^2 + 1',
    '\\frac{c}{d}',
    '\\sum_{i=1}^{n} i',
  ]);
  assert.deepEqual(fontSizes(updatedState.doc), fontSizes(state.doc));
});

test('JSON save and reload preserves formula nodes and independently sized text runs', () => {
  const original = stateFor(documentFixture()).doc;
  const savedDocument = JSON.parse(JSON.stringify(original.toJSON()));
  const reloaded = schema.nodeFromJSON(savedDocument);

  assert.deepEqual(reloaded.toJSON(), original.toJSON());
  assert.deepEqual(formulas(reloaded), formulas(original));
  assert.deepEqual(fontSizes(reloaded), ['1.25rem', '12px', '14px', '24px', '32px']);
});

test('normalizing legacy formula text retains its text style marks and is idempotent', () => {
  const marks = [{
    type: 'textStyle',
    attrs: { color: '#1d4ed8', fontSize: '28px' },
  }];
  const legacyDocument = {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: 'Before \\(x^2\\), then $y+1$, after.', marks }],
    }],
  };
  const normalized = normalizeLessonEditorMath(legacyDocument);
  const normalizedState = stateFor(normalized);
  const mathNodes = [];
  normalizedState.doc.descendants((node) => {
    if (node.type.name === 'inlineMath') mathNodes.push(node);
  });

  assert.deepEqual(mathNodes.map((node) => node.attrs.latex), ['x^2', 'y+1']);
  assert.deepEqual(mathNodes.map((node) => node.marks[0].attrs.fontSize), ['28px', '28px']);
  assert.deepEqual(normalizeLessonEditorMath(normalized), normalized);
});

test('normalizing styled inline HTML after Markdown parsing creates editable formula nodes', () => {
  const markdown = '<p><span style="font-family: &quot;Google Sans Text&quot;, sans-serif !important">$(\\omega t + \\varphi)$ : phase</span></p>'
    + '<p>Inline $x^2 + 1$ and display $$x = 2\\cos(4\\pi t)$$</p>';
  const parsed = markdownManager.parse(markdown);
  const normalized = normalizeLessonEditorMath(parsed);
  const state = stateFor(normalized);

  assert.deepEqual(formulas(state.doc), [
    { type: 'inlineMath', latex: '(\\omega t + \\varphi)', display: false },
    { type: 'inlineMath', latex: 'x^2 + 1', display: false },
    { type: 'inlineMath', latex: 'x = 2\\cos(4\\pi t)', display: true },
  ]);
  assert.ok(JSON.stringify(normalized).includes('Google Sans Text'));
  assert.equal(JSON.stringify(normalized).includes('$(\\omega t + \\varphi)$'), false);
});

test('pasting LaTeX in parsed paragraphs and lists creates formula nodes without changing surrounding text', () => {
  const pastedMarkdown = '- Trước $x^2 + 1$ sau\n- Pha $(\\omega t + \\varphi)$\n\n$$y = 2\\cos(t)$$';
  const parsedPaste = markdownManager.parse(pastedMarkdown);
  const normalizedContent = normalizeLessonEditorMathContent(parsedPaste.content);
  const pastedDocument = stateFor({ type: 'doc', content: normalizedContent }).doc;

  assert.deepEqual(formulas(pastedDocument).map(({ type, latex }) => ({ type, latex })), [
    { type: 'inlineMath', latex: 'x^2 + 1' },
    { type: 'inlineMath', latex: '(\\omega t + \\varphi)' },
    { type: 'blockMath', latex: 'y = 2\\cos(t)' },
  ]);
  assert.match(pastedDocument.textBetween(0, pastedDocument.content.size, '\n'), /Trước  sau/);
  assert.match(pastedDocument.textBetween(0, pastedDocument.content.size, '\n'), /Pha /);
});

test('lesson images stay fixed and cannot resize beyond the content width', () => {
  assert.equal(schema.nodes.image.spec.draggable, false);
  assert.equal(clampLessonImageWidth(500, 300, 600), 600);
  assert.equal(clampLessonImageWidth(500, -1000, 600), 80);
  assert.equal(clampLessonImageWidth(50, 200, 40), 40);
});
