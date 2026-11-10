import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  LoaderCircle,
  Redo2,
  Save,
  Search,
  Sigma,
  Sparkles,
  Strikethrough,
  Table2,
  Underline as UnderlineIcon,
  Undo2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { Slice } from '@tiptap/pm/model';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  runLessonDocumentAssistant,
  runLessonDocumentAssistantOnNodes,
  type LessonDocumentAssistantAction,
} from '@/utils/lessonDocumentAssistant';
import {
  isLessonEditorDocument,
  normalizeLessonEditorMath,
  normalizeLessonEditorMathContent,
  type LessonEditorDocument,
} from '@/types/lessonEditor';
import { lessonEditorExtensions } from './LessonEditorExtensions';
import './LessonEditorContent.css';

type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';
type EditorDialog = 'link' | 'formula' | null;

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`lesson-editor-tool ${active ? 'is-active' : ''}`}
    >
      {children}
    </button>
  );
}

function toolGroupClass() {
  return 'flex shrink-0 items-center gap-1 border-r border-slate-200 pr-2 last:border-r-0 last:pr-0';
}

function currentBlock(editor: Editor) {
  if (editor.isActive('heading')) return 'heading';
  return 'paragraph';
}

export function LessonEditor({
  title,
  initialMarkdown,
  document,
  saveState,
  saveError,
  onTitleChange,
  onDocumentChange,
  onClose,
  onUploadImage,
}: {
  title: string;
  initialMarkdown: string;
  document: LessonEditorDocument | null;
  saveState: SaveState;
  saveError: string;
  onTitleChange: (title: string) => void;
  onDocumentChange: (document: LessonEditorDocument) => void;
  onClose: () => void;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const onDocumentChangeRef = useRef(onDocumentChange);
  onDocumentChangeRef.current = onDocumentChange;
  const onUploadImageRef = useRef(onUploadImage);
  onUploadImageRef.current = onUploadImage;
  const editorRef = useRef<Editor | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<EditorDialog>(null);
  const [dialogValue, setDialogValue] = useState('');
  const [dialogLabel, setDialogLabel] = useState('');
  const [formulaBlock, setFormulaBlock] = useState(false);
  const [editingFormula, setEditingFormula] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [advancedActionsOpen, setAdvancedActionsOpen] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantFeedback, setAssistantFeedback] = useState<{ message: string; isError: boolean } | null>(null);
  const normalizedDocument = document ? normalizeLessonEditorMath(document) : null;
  const editor = useEditor({
    extensions: lessonEditorExtensions,
    content: normalizedDocument ?? initialMarkdown,
    contentType: normalizedDocument ? 'json' : 'markdown',
    onCreate: ({ editor: currentEditor }) => {
      editorRef.current = currentEditor;
      const currentDocument = currentEditor.getJSON();
      if (!isLessonEditorDocument(currentDocument)) return;
      const normalized = normalizeLessonEditorMath(currentDocument);
      if (JSON.stringify(normalized) !== JSON.stringify(currentDocument)) {
        currentEditor.commands.setContent(normalized, { emitUpdate: false });
      }
      const initializedDocument = currentEditor.getJSON();
      if (isLessonEditorDocument(initializedDocument)) {
        onDocumentChangeRef.current(initializedDocument);
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      const currentDocument = currentEditor.getJSON();
      if (isLessonEditorDocument(currentDocument)) onDocumentChangeRef.current(currentDocument);
    },
    editorProps: {
      attributes: { class: 'lesson-editor-page-content' },
      handlePaste: (view, event, slice) => {
        const clipboardImage = Array.from(event.clipboardData?.items ?? [])
          .find((item) => item.type.startsWith('image/'))
          ?.getAsFile();
        if (clipboardImage) {
          event.preventDefault();
          setUploadError('');
          const extensionByType: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
          };
          const pastedImage = clipboardImage.name
            ? clipboardImage
            : new File([clipboardImage], `clipboard-image.${extensionByType[clipboardImage.type] ?? 'png'}`, {
              type: clipboardImage.type,
            });
          void onUploadImageRef.current(pastedImage)
            .then((src) => {
              editorRef.current?.commands.insertContentAt(view.state.selection.from, {
                type: 'image',
                attrs: {
                  src,
                  alt: pastedImage.name.replace(/\.[^.]+$/, '') || 'Ảnh được dán',
                  width: null,
                  align: 'center',
                  caption: '',
                },
              });
            })
            .catch((error: unknown) => {
              console.error('Không thể dán ảnh vào bài giảng.', error);
              setUploadError(error instanceof Error ? error.message : 'Không thể tải ảnh được dán lên.');
            });
          return true;
        }
        const pastedContent = slice.content.toJSON();
        const normalizedContent = normalizeLessonEditorMathContent(pastedContent);
        if (JSON.stringify(normalizedContent) === JSON.stringify(pastedContent)) return false;
        const parsedSlice = new Slice(
          view.state.schema.nodeFromJSON({ type: 'doc', content: normalizedContent }).content,
          slice.openStart,
          slice.openEnd,
        );
        view.dispatch(view.state.tr.replaceSelection(parsedSlice).scrollIntoView());
        return true;
      },
    },
  });

  const openLinkDialog = () => {
    if (!editor) return;
    setDialog('link');
    setDialogValue(editor.getAttributes('link').href ?? '');
    setDialogLabel(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to));
  };
  const openFormulaDialog = () => {
    if (!editor) return;
    const inline = editor.isActive('inlineMath');
    const block = editor.isActive('blockMath');
    setEditingFormula(inline || block);
    setFormulaBlock(block);
    setDialog('formula');
    setDialogValue(
      inline ? editor.getAttributes('inlineMath').latex ?? ''
        : block ? editor.getAttributes('blockMath').latex ?? '' : '',
    );
  };

  useEffect(() => {
    if (!editor) return undefined;
    const handleSelectionUpdate = () => {
      if (editor.state.selection.toJSON().type !== 'node') return;
      const selectedNode = editor.state.doc.nodeAt(editor.state.selection.from);
      if (!selectedNode || !['inlineMath', 'blockMath'].includes(selectedNode.type.name)) return;
      setEditingFormula(true);
      setFormulaBlock(selectedNode.type.name === 'blockMath' || selectedNode.attrs.display === true);
      setDialogValue(typeof selectedNode.attrs.latex === 'string' ? selectedNode.attrs.latex : '');
      setUploadError('');
      setDialog('formula');
    };
    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => { editor.off('selectionUpdate', handleSelectionUpdate); };
  }, [editor]);

  const submitDialog = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    if (dialog === 'link') {
      const href = dialogValue.trim();
      if (!/^(https:\/\/|mailto:|tel:)/i.test(href)) {
        setUploadError('Liên kết phải bắt đầu bằng https://, mailto: hoặc tel:.');
        return;
      }
      const selectedText = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to);
      if (selectedText || editor.isActive('link')) {
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
      } else {
        editor.chain().focus().insertContent({
          type: 'text',
          text: dialogLabel.trim() || href,
          marks: [{ type: 'link', attrs: { href } }],
        }).run();
      }
    } else if (dialog === 'formula' && dialogValue.trim()) {
      const latex = dialogValue.trim();
      if (editor.isActive('inlineMath')) {
        editor.chain().focus().updateAttributes('inlineMath', { latex }).run();
      } else if (editor.isActive('blockMath')) {
        editor.chain().focus().updateAttributes('blockMath', { latex }).run();
      } else {
        editor.chain().focus().insertContent({
          type: formulaBlock ? 'blockMath' : 'inlineMath',
          attrs: { latex },
        }).run();
      }
    }
    setDialog(null);
    setUploadError('');
  };

  const handleImageFile = async (file?: File) => {
    if (!editor || !file) return;
    setUploadError('');
    try {
      const src = await onUploadImage(file);
      editor.chain().focus().insertContent({
        type: 'image',
        attrs: { src, alt: file.name.replace(/\.[^.]+$/, ''), width: null, align: 'center', caption: '' },
      }).run();
    } catch (error) {
      console.error('Không thể chèn ảnh vào bài giảng.', error);
      setUploadError(error instanceof Error ? error.message : 'Không thể tải ảnh lên.');
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const runEditorAssistant = async (action: LessonDocumentAssistantAction) => {
    if (!editor) return;
    const documentAtRequest = editor.state.doc;
    setAdvancedActionsOpen(false);
    setAssistantBusy(true);
    setAssistantFeedback(null);
    try {
      if (action === 'check') {
        const result = await runLessonDocumentAssistant(action, editor.getMarkdown());
        if (!editor.state.doc.eq(documentAtRequest)) {
          throw new Error('Bài giảng đã thay đổi trong lúc trợ lý xử lý. Hãy chạy lại thao tác.');
        }
        setAssistantFeedback({ message: result, isError: false });
        return;
      }

      if (action === 'latex') {
        const formulaTargets: Array<{ id: string; pos: number; node: ProseMirrorNode; latex: string }> = [];
        documentAtRequest.descendants((node, pos) => {
          if ((node.type.name === 'inlineMath' || node.type.name === 'blockMath')
            && typeof node.attrs.latex === 'string'
            && node.attrs.latex.trim()) {
            formulaTargets.push({ id: `formula-${formulaTargets.length}`, pos, node, latex: node.attrs.latex });
          }
        });
        if (formulaTargets.length === 0) {
          setAssistantFeedback({ message: 'Chưa tìm thấy công thức LaTeX trong bài giảng.', isError: false });
          return;
        }

        const results = await runLessonDocumentAssistantOnNodes('latex', formulaTargets.map(({ id, latex }) => ({
          id,
          text: latex,
        })));
        if (!editor.state.doc.eq(documentAtRequest)) {
          throw new Error('Bài giảng đã thay đổi trong lúc trợ lý xử lý. Hãy chạy lại thao tác.');
        }
        const resultById = new Map(results.map(({ id, text }) => [id, text]));
        let transaction = editor.state.tr;
        for (const target of [...formulaTargets].sort((a, b) => b.pos - a.pos)) {
          const latex = resultById.get(target.id);
          if (latex !== undefined && latex !== target.latex) {
            transaction = transaction.setNodeMarkup(target.pos, undefined, {
              ...target.node.attrs,
              latex,
            }, target.node.marks);
          }
        }
        if (transaction.docChanged) editor.view.dispatch(transaction);
        setAssistantFeedback({
          message: `Đã kiểm tra ${formulaTargets.length} công thức LaTeX trên toàn bài. Các nội dung và định dạng khác được giữ nguyên.`,
          isError: false,
        });
        return;
      }

      const textTargets: Array<{ id: string; pos: number; node: ProseMirrorNode; context: string }> = [];
      documentAtRequest.descendants((node, pos, parent) => {
        const insideCode = parent?.type.name === 'codeBlock' || node.marks.some((mark) => mark.type.name === 'code');
        if (node.isText && node.text?.trim() && !insideCode) {
          textTargets.push({
            id: `text-${textTargets.length}`,
            pos,
            node,
            context: parent?.textContent ?? node.text,
          });
        }
      });
      if (textTargets.length === 0) {
        setAssistantFeedback({ message: 'Chưa tìm thấy văn bản để trình bày lại.', isError: false });
        return;
      }

      const results = await runLessonDocumentAssistantOnNodes('polish', textTargets.map(({ id, node, context }) => ({
        id,
        text: node.text ?? '',
        context,
      })));
      if (!editor.state.doc.eq(documentAtRequest)) {
        throw new Error('Bài giảng đã thay đổi trong lúc trợ lý xử lý. Hãy chạy lại thao tác.');
      }
      const resultById = new Map(results.map(({ id, text }) => [id, text]));
      let transaction = editor.state.tr;
      for (const target of [...textTargets].sort((a, b) => b.pos - a.pos)) {
        const originalText = target.node.text ?? '';
        const revisedText = resultById.get(target.id);
        if (revisedText === undefined) continue;
        const leadingWhitespace = originalText.match(/^\s*/)?.[0] ?? '';
        const trailingWhitespace = originalText.match(/\s*$/)?.[0] ?? '';
        const normalizedText = `${leadingWhitespace}${revisedText.trim()}${trailingWhitespace}`;
        if (normalizedText !== originalText) {
          transaction = transaction.replaceWith(
            target.pos,
            target.pos + target.node.nodeSize,
            editor.schema.text(normalizedText, target.node.marks),
          );
        }
      }
      if (transaction.docChanged) editor.view.dispatch(transaction);
      setAssistantFeedback({
        message: `Đã trình bày lại ${textTargets.length} phần văn bản trên toàn bài. Bố cục, định dạng, công thức và ảnh được giữ nguyên.`,
        isError: false,
      });
    } catch (error) {
      setAssistantFeedback({
        message: error instanceof Error ? error.message : 'Không thể xử lý nội dung bằng trợ lý AI.',
        isError: true,
      });
    } finally {
      setAssistantBusy(false);
    }
  };

  const saveLabel = {
    idle: 'Chờ chỉnh sửa',
    unsaved: 'Có thay đổi chưa đăng lại',
    saving: 'Đang lưu...',
    saved: 'Đã lưu',
    error: 'Lỗi lưu',
  }[saveState];

  if (!editor) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-100" role="status">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-blue-600" /> Đang mở trình soạn thảo...
      </div>
    );
  }

  return (
    <div className="lesson-editor-shell fixed inset-0 z-[80] flex flex-col bg-slate-100" role="dialog" aria-modal="true" aria-label="Trình soạn thảo bài giảng">
      <header className="flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="lesson-editor-title">Tên bài giảng</label>
          <input
            id="lesson-editor-title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            className="w-full truncate border-0 bg-transparent p-0 text-base font-semibold text-slate-900 outline-none focus:ring-0 sm:text-lg"
            placeholder="Tên bài giảng"
          />
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500" role="status" aria-live="polite">
            {saveState === 'saving' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              : saveState === 'saved' ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                : <Save className="h-3.5 w-3.5" />}
            {saveLabel}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setAdvancedActionsOpen((open) => !open)}
              disabled={assistantBusy}
              aria-haspopup="menu"
              aria-expanded={advancedActionsOpen}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60 sm:text-sm"
              title="Trợ lý AI cho toàn bộ bài giảng"
            >
              {assistantBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
              <span className="hidden sm:inline">{assistantBusy ? 'Đang xử lý...' : 'Trình bày nâng cao'}</span>
              <ChevronDown className={`hidden h-3.5 w-3.5 transition-transform sm:block ${advancedActionsOpen ? 'rotate-180' : ''}`} />
            </button>
            {advancedActionsOpen && (
              <div role="menu" className="absolute right-0 top-full z-[90] mt-2 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                <p className="px-2.5 py-2 text-[0.6875rem] leading-relaxed text-slate-500">
                  Chọn một tính năng để xử lý toàn bộ bài giảng.
                </p>
                {([
                  ['latex', 'Tạo / chuẩn hóa LaTeX', Sparkles],
                  ['polish', 'Trình bày đẹp hơn', WandSparkles],
                  ['check', 'Kiểm tra lỗi', Search],
                ] as const).map(([action, label, Icon]) => (
                  <button
                    key={action}
                    type="button"
                    role="menuitem"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => { void runEditorAssistant(action); }}
                    disabled={assistantBusy}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ToolbarButton label="Hoàn tác" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Làm lại" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
          <button type="button" onClick={onClose} className="ml-1 inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100" aria-label="Đóng trình soạn thảo">
            <X className="h-4 w-4" /><span className="hidden sm:inline">Đóng</span>
          </button>
        </div>
      </header>

      <div className="lesson-editor-toolbar flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6" role="toolbar" aria-label="Công cụ định dạng">
        <div className={toolGroupClass()}>
          <select
            aria-label="Phông chữ"
            title="Phông chữ"
            className="lesson-editor-select w-32"
            value={editor.getAttributes('textStyle').fontFamily ?? ''}
            onChange={(event) => {
              const chain = editor.chain().focus();
              if (event.target.value) chain.setFontFamily(event.target.value).run();
              else chain.unsetFontFamily().run();
            }}
          >
            <option value="">Phông mặc định</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="Inter, sans-serif">Inter</option>
            <option value="Times New Roman, serif">Times New Roman</option>
          </select>
          <select
            aria-label="Cỡ chữ"
            title="Cỡ chữ"
            className="lesson-editor-select w-20"
            value={editor.getAttributes('textStyle').fontSize ?? ''}
            onChange={(event) => {
              const chain = editor.chain().focus();
              if (event.target.value) chain.setFontSize(event.target.value).run();
              else chain.unsetFontSize().run();
            }}
          >
            <option value="">Cỡ chữ</option>
            {['12px', '14px', '16px', '18px', '24px', '32px'].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
        <div className={toolGroupClass()}>
          <select
            aria-label="Kiểu đoạn"
            title="Kiểu đoạn"
            className="lesson-editor-select w-32"
            value={editor.isActive('heading') ? String(editor.getAttributes('heading').level) : 'paragraph'}
            onChange={(event) => event.target.value === 'paragraph'
              ? editor.chain().focus().setParagraph().run()
              : editor.chain().focus().toggleHeading({ level: Number(event.target.value) as 1 | 2 | 3 }).run()}
          >
            <option value="paragraph">Đoạn văn</option>
            <option value="1">Tiêu đề 1</option>
            <option value="2">Tiêu đề 2</option>
            <option value="3">Tiêu đề 3</option>
          </select>
          <ToolbarButton label="In đậm" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="In nghiêng" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Gạch chân" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Gạch ngang" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolbarButton>
          <label className="lesson-editor-color" title="Màu chữ">
            <span className="sr-only">Màu chữ</span>
            <input type="color" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
            <span className="text-sm font-bold text-slate-700">A</span>
          </label>
          <label className="lesson-editor-color" title="Tô sáng văn bản">
            <span className="sr-only">Tô sáng văn bản</span>
            <input type="color" defaultValue="#fff59d" onChange={(event) => editor.chain().focus().setHighlight({ color: event.target.value }).run()} />
            <Highlighter className="h-4 w-4 text-slate-700" />
          </label>
          <ToolbarButton label="Xóa định dạng" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><X className="h-4 w-4" /></ToolbarButton>
        </div>
        <div className={toolGroupClass()}>
          <ToolbarButton label="Danh sách gạch đầu dòng" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Danh sách đánh số" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Căn trái" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Căn giữa" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Căn phải" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Căn đều" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Giảm thụt lề" onClick={() => {
            const target = currentBlock(editor);
            const level = Number(editor.getAttributes(target).indentLevel) || 0;
            editor.chain().focus().updateAttributes(target, { indentLevel: Math.max(0, level - 1) }).run();
          }}><IndentDecrease className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Tăng thụt lề" onClick={() => {
            const target = currentBlock(editor);
            const level = Number(editor.getAttributes(target).indentLevel) || 0;
            editor.chain().focus().updateAttributes(target, { indentLevel: Math.min(4, level + 1) }).run();
          }}><IndentIncrease className="h-4 w-4" /></ToolbarButton>
          <select
            aria-label="Giãn dòng"
            title="Giãn dòng"
            className="lesson-editor-select w-24"
            value={editor.getAttributes(currentBlock(editor)).lineHeight ?? ''}
            onChange={(event) => editor.chain().focus().updateAttributes(currentBlock(editor), { lineHeight: event.target.value || null }).run()}
          >
            <option value="">Giãn dòng</option>
            {['1.4', '1.6', '1.8', '2'].map((height) => <option key={height} value={height}>{height}</option>)}
          </select>
          <select
            aria-label="Khoảng cách đoạn"
            title="Khoảng cách đoạn"
            className="lesson-editor-select w-28"
            value={String(editor.getAttributes(currentBlock(editor)).spaceAfter ?? '')}
            onChange={(event) => editor.chain().focus().updateAttributes(currentBlock(editor), { spaceAfter: event.target.value ? Number(event.target.value) : null }).run()}
          >
            <option value="">Cách đoạn</option>
            <option value="4">4 px</option>
            <option value="8">8 px</option>
            <option value="16">16 px</option>
            <option value="24">24 px</option>
          </select>
          <select
            aria-label="Khoảng cách trước đoạn"
            title="Khoảng cách trước đoạn"
            className="lesson-editor-select w-28"
            value={String(editor.getAttributes(currentBlock(editor)).spaceBefore ?? '')}
            onChange={(event) => editor.chain().focus().updateAttributes(currentBlock(editor), { spaceBefore: event.target.value ? Number(event.target.value) : null }).run()}
          >
            <option value="">Trước đoạn</option>
            <option value="4">4 px</option>
            <option value="8">8 px</option>
            <option value="16">16 px</option>
            <option value="24">24 px</option>
          </select>
        </div>
        <div className={toolGroupClass()}>
          <ToolbarButton label="Chèn bảng 3 x 3" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></ToolbarButton>
          {editor.isActive('table') && (
            <>
              <ToolbarButton label="Thêm hàng" onClick={() => editor.chain().focus().addRowAfter().run()}><span className="text-xs font-bold">+H</span></ToolbarButton>
              <ToolbarButton label="Thêm cột" onClick={() => editor.chain().focus().addColumnAfter().run()}><span className="text-xs font-bold">+C</span></ToolbarButton>
              <ToolbarButton label="Xóa hàng" onClick={() => editor.chain().focus().deleteRow().run()}><span className="text-xs font-bold">−H</span></ToolbarButton>
              <ToolbarButton label="Xóa cột" onClick={() => editor.chain().focus().deleteColumn().run()}><span className="text-xs font-bold">−C</span></ToolbarButton>
            </>
          )}
          <ToolbarButton label="Chèn liên kết" active={editor.isActive('link')} onClick={openLinkDialog}><LinkIcon className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Chèn công thức LaTeX" active={editor.isActive('inlineMath') || editor.isActive('blockMath')} onClick={openFormulaDialog}><Sigma className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Chèn ảnh từ thiết bị hoặc dán bằng Ctrl+V" onClick={() => imageInputRef.current?.click()}><ImagePlus className="h-4 w-4" /></ToolbarButton>
          {editor.isActive('image') && (
            <select
              aria-label="Căn ảnh"
              title="Căn ảnh"
              className="lesson-editor-select w-24"
              value={editor.getAttributes('image').align ?? 'center'}
              onChange={(event) => editor.chain().focus().updateAttributes('image', { align: event.target.value }).run()}
            >
              <option value="left">Ảnh trái</option>
              <option value="center">Ảnh giữa</option>
              <option value="right">Ảnh phải</option>
            </select>
          )}
        </div>
      </div>

      <main className="lesson-editor-workspace flex-1 overflow-y-auto px-3 py-6 sm:px-8 sm:py-10">
        <div className="lesson-editor-page mx-auto">
          <EditorContent editor={editor} />
        </div>
      </main>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="sr-only"
        onChange={(event) => { void handleImageFile(event.target.files?.[0]); }}
      />
      {(uploadError || (saveState === 'error' && saveError)) && (
        <p role="alert" className="lesson-editor-alert">{uploadError || saveError}</p>
      )}
      {assistantFeedback && (
        <div
          role={assistantFeedback.isError ? 'alert' : 'status'}
          className={`mx-3 mb-3 flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm sm:mx-8 ${
            assistantFeedback.isError
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-blue-200 bg-blue-50 text-blue-900'
          }`}
        >
          <p className="whitespace-pre-wrap">{assistantFeedback.message}</p>
          <button type="button" onClick={() => setAssistantFeedback(null)} className="shrink-0 rounded p-0.5 hover:bg-black/5" aria-label="Đóng thông báo">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/30 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialog(null);
        }}>
          <form onSubmit={submitDialog} className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {dialog === 'link' ? 'Chèn liên kết' : editingFormula ? 'Chỉnh sửa công thức' : 'Chèn công thức'}
              </h2>
              <button type="button" onClick={() => setDialog(null)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X className="h-4 w-4" /></button>
            </div>
            {dialog === 'link' ? (
              <>
                <label className="mb-3 block text-sm font-medium text-slate-700">Địa chỉ liên kết
                  <input autoFocus value={dialogValue} onChange={(event) => setDialogValue(event.target.value)} className="input-field mt-1.5" placeholder="https://..." />
                </label>
                {!editor.state.selection.empty && <p className="mb-3 text-xs text-slate-500">Liên kết sẽ áp dụng cho phần văn bản đang chọn.</p>}
                {editor.state.selection.empty && (
                  <label className="mb-3 block text-sm font-medium text-slate-700">Nội dung hiển thị
                    <input value={dialogLabel} onChange={(event) => setDialogLabel(event.target.value)} className="input-field mt-1.5" placeholder="Văn bản liên kết" />
                  </label>
                )}
              </>
            ) : (
              <>
                <label className="mb-3 block text-sm font-medium text-slate-700">Biểu thức LaTeX
                  <textarea autoFocus value={dialogValue} onChange={(event) => setDialogValue(event.target.value)} className="input-field mt-1.5 min-h-24 font-mono" placeholder="Ví dụ: \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" />
                </label>
                <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={formulaBlock} onChange={(event) => setFormulaBlock(event.target.checked)} />
                  Công thức nằm riêng một dòng
                </label>
              </>
            )}
            {uploadError && <p role="alert" className="mb-3 text-sm text-rose-700">{uploadError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className="btn-outline">Hủy</button>
              <button type="submit" className="btn-primary">
                <Check className="h-4 w-4" /> {dialog === 'formula' && editingFormula ? 'Lưu công thức' : 'Chèn'}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="sr-only" aria-live="polite">{saveLabel}</div>
    </div>
  );
}
