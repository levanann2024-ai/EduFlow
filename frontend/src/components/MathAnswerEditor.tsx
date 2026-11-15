import { useEffect, useState } from 'react';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { isLessonEditorDocument, normalizeLessonEditorMath } from '@/types/lessonEditor';
import { BlockMath, InlineMath } from './LessonMathExtensions';

function normalizeAnswerMath(editor: NonNullable<ReturnType<typeof useEditor>>, source: string) {
  if (!editor.markdown) throw new Error('Trình chỉnh sửa câu trả lời chưa được bật bộ phân tích Markdown.');
  const document = editor.markdown.parse(source);
  if (!isLessonEditorDocument(document)) return;
  const normalized = normalizeLessonEditorMath(document);
  if (JSON.stringify(normalized) !== JSON.stringify(editor.getJSON())) {
    editor.commands.setContent(normalized, { emitUpdate: false });
  }
}

function formulaSource(latex: string, display: boolean) {
  return display ? `$$\n${latex}\n$$` : `$${latex}$`;
}

function parseFormulaSource(source: string, display: boolean) {
  const value = source.trim();
  if (display && value.startsWith('$$') && value.endsWith('$$')) {
    return value.slice(2, -2).trim();
  }
  if (!display && value.startsWith('$') && value.endsWith('$')) {
    return value.slice(1, -1).trim();
  }
  return value;
}

export function MathAnswerEditor({
  value,
  onChange,
  onBlur,
  editable,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  editable: boolean;
}) {
  const [formula, setFormula] = useState<{
    nodeType: 'inlineMath' | 'blockMath';
    display: boolean;
    value: string;
  } | null>(null);
  const editor = useEditor({
    extensions: [StarterKit, InlineMath, BlockMath, Markdown],
    content: value,
    contentType: 'markdown',
    editable,
    onCreate: ({ editor: currentEditor }) => {
      normalizeAnswerMath(currentEditor, value);
      if (currentEditor.isEditable) currentEditor.commands.focus('end');
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getMarkdown()),
    editorProps: {
      attributes: {
        class: 'lesson-rich-document min-h-32 whitespace-pre-wrap text-base leading-7 text-slate-800 outline-none',
        'aria-label': 'Chỉnh sửa câu trả lời',
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.getMarkdown() === value) return;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
    normalizeAnswerMath(editor, value);
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return undefined;
    const handleSelectionUpdate = () => {
      if (!editor.isEditable) return;
      const { selection, doc } = editor.state;
      if (selection.toJSON().type !== 'node') return;
      const node = doc.nodeAt(selection.from);
      if (!node || !['inlineMath', 'blockMath'].includes(node.type.name)) return;
      const display = node.type.name === 'blockMath' || node.attrs.display === true;
      const latex = typeof node.attrs.latex === 'string' ? node.attrs.latex : '';
      setFormula({
        nodeType: node.type.name === 'blockMath' ? 'blockMath' : 'inlineMath',
        display,
        value: formulaSource(latex, display),
      });
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor]);

  const saveFormula = () => {
    if (!editor || !formula) return;
    const latex = parseFormulaSource(formula.value, formula.display);
    if (!latex) return;
    editor.chain().focus().updateAttributes(formula.nodeType, { latex }).run();
    setFormula(null);
  };

  return (
    <div
      className="relative mt-2 min-h-32 rounded-xl border border-blue-500 bg-white p-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 sm:p-4"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onBlur();
      }}
    >
      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <p role="status" className="text-sm text-slate-500">Đang mở trình chỉnh sửa câu trả lời...</p>
      )}
      {editable && (
        <p className="mt-2 text-[0.6875rem] text-slate-400">
          Công thức được hiển thị đã định dạng; nhấn vào công thức để sửa LaTeX.
        </p>
      )}
      {formula && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-950/30 p-3">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Chỉnh sửa công thức LaTeX"
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
          >
            <label htmlFor="student-answer-latex" className="mb-2 block text-sm font-semibold text-slate-800">
              Công thức LaTeX
            </label>
            <textarea
              id="student-answer-latex"
              autoFocus
              value={formula.value}
              onChange={(event) => setFormula({ ...formula, value: event.target.value })}
              rows={formula.display ? 5 : 2}
              className="input-field w-full font-mono text-sm"
              spellCheck={false}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setFormula(null)} className="btn-outline">
                Hủy
              </button>
              <button type="button" onClick={saveFormula} className="btn-primary">
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
