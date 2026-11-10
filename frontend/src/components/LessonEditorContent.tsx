import { EditorContent, useEditor } from '@tiptap/react';
import { useMemo } from 'react';
import {
  isLessonEditorDocument,
  normalizeLessonEditorMath,
  type LessonEditorDocument,
} from '@/types/lessonEditor';
import { lessonEditorExtensions } from './LessonEditorExtensions';
import './LessonEditorContent.css';

export function RichLessonContent({
  document,
  className = '',
}: {
  document: LessonEditorDocument;
  className?: string;
}) {
  const normalizedDocument = useMemo(() => normalizeLessonEditorMath(document), [document]);
  const editor = useEditor({
    extensions: lessonEditorExtensions,
    content: normalizedDocument,
    editable: false,
    editorProps: { attributes: { class: 'lesson-rich-document' } },
  }, [normalizedDocument]);

  if (!editor) {
    return <p role="status" className="lesson-rich-document-status">Đang tải nội dung bài giảng...</p>;
  }
  if (!isLessonEditorDocument(editor.getJSON())) {
    return <p role="alert" className="lesson-rich-document-status">Nội dung bài giảng không thể hiển thị.</p>;
  }
  return <EditorContent editor={editor} className={className} />;
}
