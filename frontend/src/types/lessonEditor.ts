import type { JSONContent } from '@tiptap/core';

export type LessonEditorDocument = JSONContent & {
  type: 'doc';
  content: JSONContent[];
};

function isJsonContent(value: unknown, depth = 0): value is JSONContent {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 80) return false;
  const node = value as Record<string, unknown>;
  if (typeof node.type !== 'string') return false;
  if (node.text !== undefined && typeof node.text !== 'string') return false;
  if (node.content !== undefined
    && (!Array.isArray(node.content) || !node.content.every((child) => isJsonContent(child, depth + 1)))) {
    return false;
  }
  if (node.marks !== undefined
    && (!Array.isArray(node.marks) || !node.marks.every((mark) => (
      Boolean(mark)
      && typeof mark === 'object'
      && !Array.isArray(mark)
      && typeof (mark as Record<string, unknown>).type === 'string'
    )))) {
    return false;
  }
  return true;
}

export function isLessonEditorDocument(value: unknown): value is LessonEditorDocument {
  return isJsonContent(value) && value.type === 'doc' && Array.isArray(value.content);
}

function isEscaped(text: string, index: number) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function parseLatexText(text: string, marks?: JSONContent['marks']): JSONContent[] {
  if (marks?.some((mark) => mark.type === 'code')) return [{ type: 'text', text, marks }];
  const parsed: JSONContent[] = [];
  let segmentStart = 0;
  let cursor = 0;

  while (cursor < text.length) {
    if (isEscaped(text, cursor)) {
      cursor += 1;
      continue;
    }

    let opening: string;
    let closing: string;
    let display = false;
    if (text.startsWith('$$', cursor)) {
      opening = '$$';
      closing = '$$';
      display = true;
    } else if (text[cursor] === '$') {
      opening = '$';
      closing = '$';
    } else if (text.startsWith('\\[', cursor)) {
      opening = '\\[';
      closing = '\\]';
      display = true;
    } else if (text.startsWith('\\(', cursor)) {
      opening = '\\(';
      closing = '\\)';
    } else {
      cursor += 1;
      continue;
    }

    let closingIndex = text.indexOf(closing, cursor + opening.length);
    while (closingIndex !== -1 && isEscaped(text, closingIndex)) {
      closingIndex = text.indexOf(closing, closingIndex + closing.length);
    }
    if (closingIndex === -1) {
      cursor += opening.length;
      continue;
    }

    const latex = text.slice(cursor + opening.length, closingIndex).trim();
    if (!latex) {
      cursor = closingIndex + closing.length;
      continue;
    }
    if (cursor > segmentStart) {
      parsed.push({ type: 'text', text: text.slice(segmentStart, cursor), marks });
    }
    parsed.push({
      type: 'inlineMath',
      attrs: { latex, display },
      ...(marks?.length ? { marks } : {}),
    });
    cursor = closingIndex + closing.length;
    segmentStart = cursor;
  }

  if (segmentStart === 0) return [{ type: 'text', text, marks }];
  if (segmentStart < text.length) parsed.push({ type: 'text', text: text.slice(segmentStart), marks });
  return parsed;
}

export function normalizeLessonEditorMathContent(content: JSONContent[]): JSONContent[] {
  const normalizeNode = (node: JSONContent): JSONContent[] => {
    if (node.type === 'text' && typeof node.text === 'string') {
      return parseLatexText(node.text, node.marks);
    }
    if (node.type === 'codeBlock') return [node];
    if (!Array.isArray(node.content)) return [node];
    return [{
      ...node,
      content: node.content.flatMap(normalizeNode),
    }];
  };
  return content.flatMap(normalizeNode);
}

export function normalizeLessonEditorMath(document: LessonEditorDocument): LessonEditorDocument {
  return {
    ...document,
    content: normalizeLessonEditorMathContent(document.content),
  };
}
