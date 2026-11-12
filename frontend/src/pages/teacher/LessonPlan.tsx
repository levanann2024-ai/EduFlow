import { useCallback, useEffect, useRef, useState } from 'react';
import { Wand2, RefreshCw, Download, FileText, BookOpen, GraduationCap, Target, Clock, ListChecks, Edit3, Pencil, Save, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { authenticatedFetch } from '@/auth/authApi';
import { MathText } from '@/components/MathText';
import { LessonEditor } from '@/components/LessonEditor';
import { RichLessonContent } from '@/components/LessonEditorContent';
import { createTeacherLessonDraft, updateTeacherLessonDraft, uploadTeacherLessonDraftImage } from '@/api/schoolApi';
import { isLessonEditorDocument, type LessonEditorDocument } from '@/types/lessonEditor';
import { LessonFormatSelector, type LessonFormat } from '@/pages/teacher/LessonFormatSelector';
import { normalizeLessonMaterialMarkdown } from '@/utils/lessonMaterialMarkdown';
import { textbookSeries } from './textbookOptions';
import { getAISubjectExamples } from './aiSubjectExamples';
const methods = ['Thuyết trình', 'Thảo luận nhóm', 'Khám phá', 'Dự án', 'Luyện tập'];

interface LessonSection {
  title: string;
  content: string;
}

type LectureOutlineKey = 'flow';

const lectureOutlineFields = [{
  key: 'flow' as const,
  title: 'Nội dung theo trình tự',
  placeholder: 'Ví dụ:\n- Ôn kiến thức nền\n- Khám phá nội dung trọng tâm\n- Luyện tập vận dụng',
}];

export function LessonPlan({
  format,
  onFormatChange,
  onAssignToStudents,
  assignedSubjects = [],
}: {
  format?: LessonFormat;
  onFormatChange?: (format: LessonFormat) => void;
  assignedSubjects?: string[];
  onAssignToStudents?: (draft: {
    title: string;
    subject: string;
    grade: string;
    content: string;
    editorDraftId?: string;
  }) => void;
} = {}) {
  const [textbook, setTextbook] = useState('');
  const [subject, setSubject] = useState(assignedSubjects[0] ?? '');
  const [volume, setVolume] = useState('Tập 1');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('Khối 10');
  const [duration, setDuration] = useState(45);
  const [method, setMethod] = useState('Thuyết trình');
  const [lectureOutline, setLectureOutline] = useState<Record<LectureOutlineKey, string>>({
    flow: '',
  });
  const [plan, setPlan] = useState<LessonSection[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editorDocument, setEditorDocument] = useState<LessonEditorDocument | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error'>('idle');
  const [draftSaveError, setDraftSaveError] = useState('');
  const draftIdRef = useRef<string | null>(null);
  const editorDocumentRef = useRef<LessonEditorDocument | null>(null);
  const draftGenerationRef = useRef(0);
  const saveSequenceRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const subjectExamples = getAISubjectExamples(subject);

  useEffect(() => {
    setSubject((current) => assignedSubjects.includes(current) ? current : assignedSubjects[0] ?? '');
  }, [assignedSubjects]);

  const saveDraftSnapshot = useCallback((document: LessonEditorDocument, title: string) => {
    const generation = draftGenerationRef.current;
    const sequence = ++saveSequenceRef.current;
    setDraftSaveState('saving');
    setDraftSaveError('');
    const request = saveQueueRef.current.then(async () => {
      if (generation !== draftGenerationRef.current) throw new Error('Bản nháp đã được thay thế bằng nội dung mới.');
      const saved = draftIdRef.current
        ? await updateTeacherLessonDraft(draftIdRef.current, { title, editorDocument: document })
        : await createTeacherLessonDraft({ title, editorDocument: document });
      if (generation === draftGenerationRef.current) {
        draftIdRef.current = saved.id;
        if (sequence === saveSequenceRef.current) {
          setDraftSaveState('saved');
          setDraftSaveError('');
        }
      }
      return saved.id;
    }).catch((saveError: unknown) => {
      if (generation === draftGenerationRef.current && sequence === saveSequenceRef.current) {
        setDraftSaveState('error');
        setDraftSaveError(saveError instanceof Error ? saveError.message : 'Không thể lưu bản nháp bài giảng.');
      }
      throw saveError;
    });
    saveQueueRef.current = request.then(() => undefined, () => undefined);
    return request;
  }, []);

  const handleEditorDocumentChange = (document: LessonEditorDocument) => {
    editorDocumentRef.current = document;
    setDraftSaveState((current) => current === 'unsaved' ? current : 'unsaved');
    setDraftSaveError((current) => current ? '' : current);
  };

  const handleEditorDocumentReady = (document: LessonEditorDocument) => {
    editorDocumentRef.current = document;
    setDraftSaveState((current) => current === 'saved' ? current : 'unsaved');
  };

  const saveCurrentEditorDocument = async () => {
    const document = editorDocumentRef.current;
    if (!document) throw new Error('Nội dung bài giảng chưa sẵn sàng. Vui lòng thử lại.');
    await saveDraftSnapshot(document, topic.trim());
    setEditorDocument(document);
  };

  const handleGenerate = async () => {
    if (!subject.trim() || !topic.trim() || !textbook.trim()) return;
    draftGenerationRef.current += 1;
    saveSequenceRef.current += 1;
    draftIdRef.current = null;
    editorDocumentRef.current = null;
    setEditorDocument(null);
    setEditorOpen(false);
    setDraftSaveState('idle');
    setDraftSaveError('');
    setGenerating(true);
    setPlan(null);
    setError('');

    try {
      const requestBody = format
        ? {
          type: 'lesson-material',
          prompt: [
            'Hãy biên soạn một BÀI GIẢNG DẠNG TÀI LIỆU VĂN BẢN CHI TIẾT để học sinh tự đọc và học.',
            'Đây không phải giáo án dành cho giáo viên: không viết mục tiêu sư phạm, kế hoạch hoạt động trên lớp, phương pháp đánh giá hay tài liệu tham khảo.',
            '',
            'Thông tin bài giảng:',
            `- Môn học: ${subject.trim() || 'giáo viên chưa chọn'}`,
            `- Bộ sách: ${textbook.trim()}`,
            `- Tập: ${volume}`,
            `- Khối lớp: ${grade}`,
            `- Chủ đề: ${topic.trim()}`,
            '',
            'Bám sát môn học đã chọn, bộ sách, tập, khối lớp và chủ đề; không tự suy đoán hoặc đưa nội dung thuộc môn khác.',
            'Các nội dung cốt lõi giáo viên muốn triển khai theo thứ tự:',
            lectureOutline.flow.trim(),
            '',
            'Yêu cầu trình bày:',
            '1. Phát triển từng ý giáo viên đưa ra thành nội dung kiến thức chính xác, chi tiết vừa đủ, dễ hiểu và phù hợp với học sinh của khối lớp đã chọn.',
            '2. Chia bài thành các phần lớn theo đúng thứ tự trên; viết mỗi tiêu đề phần bằng Markdown heading cấp 2, bắt đầu bằng số La Mã rõ ràng: ## I. ..., ## II. ..., ## III. ... Không gộp hoặc đảo thứ tự các ý.',
            '3. Trong mỗi phần La Mã, chia kiến thức thành các mục nhỏ có tiêu đề Markdown cấp 3 và số thứ tự: ### 1. ..., ### 2. ..., ### 3. ...; giải thích khái niệm, quy tắc, công thức và mối liên hệ giữa các ý.',
            '4. Khi phù hợp với môn học, thêm ví dụ minh họa hoặc bài giải từng bước ngay trong mục liên quan. Dùng ký hiệu và công thức chính xác.',
            '5. Viết trực tiếp cho học sinh như một tài liệu học tập độc lập; không nhắc đến prompt, giáo viên hay quá trình tạo bằng AI.',
            '6. Trình bày bằng Markdown có dòng trống trước/sau mỗi tiêu đề; nội dung giải thích ở đoạn văn ngắn. Chỉ dùng "- " cho các ý liệt kê và "+) " cho ý bổ sung; không biến mọi câu thành danh sách.',
            '7. Giữ nguyên nội dung, thứ tự kiến thức và định dạng phù hợp của công thức, ví dụ, bảng biểu; không tự thêm hoặc lược bỏ kiến thức.',
            '8. Chỉ trả về nội dung bài giảng, không thêm lời dẫn hoặc kết luận chung ngoài các phần kiến thức.',
          ].join('\n'),
        }
        : { grade, subject, topic, duration, method, textbook: textbook.trim(), volume };
      const response = await authenticatedFetch(format ? '/api/ai' : '/api/ai/lesson-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result: { success: boolean; data?: string; message?: string } = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'Không thể tạo giáo án.');
      }

      setPlan(format
        ? [{ title: 'Nội dung bài giảng', content: normalizeLessonMaterialMarkdown(result.data) }]
        : parseLessonPlan(result.data));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối tới backend AI.');
    } finally {
      setGenerating(false);
    }
  };

  const assignToStudents = async () => {
    if (!format || !onAssignToStudents || !plan) return;
    const content = plan
      .map((section, index) => normalizeLessonMaterialMarkdown(index === editingSection ? editText : section.content))
      .join('\n\n');
    if (editingSection !== null) {
      setPlan((current) => current?.map((section, index) => (
        index === editingSection ? { ...section, content: normalizeLessonMaterialMarkdown(editText) } : section
      )) ?? null);
      setEditingSection(null);
    }
    const currentDocument = editorDocumentRef.current;
    if (currentDocument) {
      try {
        const editorDraftId = await saveDraftSnapshot(currentDocument, topic.trim());
        onAssignToStudents({ title: topic.trim(), subject, grade, content: '', editorDraftId });
      } catch (saveError) {
        console.error('Không thể lưu bài giảng trước khi giao cho học sinh.', saveError);
        setDraftSaveError(saveError instanceof Error ? saveError.message : 'Không thể lưu bài giảng trước khi giao.');
      }
      return;
    }
    onAssignToStudents({ title: topic.trim(), subject, grade, content });
  };

  const uploadEditorImage = async (file: File) => {
    const draftId = draftIdRef.current;
    if (!draftId) throw new Error('Hãy nhấn “Lưu” trước khi chèn ảnh lần đầu.');
    const asset = await uploadTeacherLessonDraftImage(draftId, file);
    return asset.src;
  };

  const handleEdit = (idx: number) => {
    if (editingSection === idx) {
      setPlan((p) => p ? p.map((s, i) => i === idx
        ? { ...s, content: format ? normalizeLessonMaterialMarkdown(editText) : editText }
        : s) : p);
      setEditingSection(null);
    } else {
      setEditingSection(idx);
      const content = plan?.[idx].content || '';
      setEditText(format ? normalizeLessonMaterialMarkdown(content) : content);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* Config */}
        <div>
          <div className="card p-4 sticky top-4">
            {format && onFormatChange && (
              <div className="mb-4">
                <LessonFormatSelector value={format} onChange={onFormatChange} />
              </div>
            )}
            <div className="space-y-3.5">
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Môn học
                </label>
                {assignedSubjects.length > 0 ? (
                  <select value={subject} onChange={(event) => setSubject(event.target.value)} className="input-field cursor-pointer">
                    {assignedSubjects.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                ) : (
                  <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Nhập môn học" className="input-field" />
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Bộ sách và tập
                </label>
                <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                  <input
                    list="lesson-textbook-series"
                    value={textbook}
                    onChange={(event) => setTextbook(event.target.value)}
                    placeholder="Chọn hoặc nhập tên bộ sách"
                    className="input-field min-w-0"
                    aria-label="Tên bộ sách"
                    required
                  />
                  <datalist id="lesson-textbook-series">
                    {textbookSeries.map((series) => <option key={series} value={series} />)}
                  </datalist>
                  <select
                    value={volume}
                    onChange={(event) => setVolume(event.target.value)}
                    className="input-field cursor-pointer"
                    aria-label="Tập sách"
                  >
                    {['Tập 1', 'Tập 2'].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" /> Khối lớp
                </label>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className="input-field cursor-pointer">
                  {['Khối 10','Khối 11','Khối 12'].map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-slate-400" /> Chủ đề bài giảng
                </label>
                <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={`Ví dụ: ${subjectExamples.topic}`} rows={2} className="input-field resize-none" />
              </div>

              {format ? (
                <div>
                  {lectureOutlineFields.map(({ key, title, placeholder }) => (
                    <label key={key} className="block">
                      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-600">
                        <ListChecks className="h-3.5 w-3.5 text-slate-400" /> {title}
                      </span>
                      <textarea
                        value={lectureOutline[key]}
                        onChange={(event) => setLectureOutline((current) => ({ ...current, [key]: event.target.value }))}
                        placeholder={subject ? subjectExamples.outline : placeholder}
                        rows={8}
                        className="input-field mt-1.5 resize-y text-sm"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Thời lượng
                    </label>
                    <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input-field" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                      <ListChecks className="w-3.5 h-3.5 text-slate-400" /> Phương pháp
                    </label>
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className="input-field cursor-pointer">
                      {methods.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={!subject.trim() || !topic.trim() || !textbook.trim() || generating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600 disabled:opacity-60"
              >
                {generating ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang tạo...</> : <><Wand2 className="w-3.5 h-3.5" /> {format ? 'Tạo nội dung bài giảng' : 'Tạo giáo án'}</>}
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="min-w-0">
          {generating ? (
            <div className="card p-10 flex flex-col items-center justify-center min-h-[400px]">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-600">{format ? 'AI đang soạn bài giảng...' : 'AI đang soạn giáo án...'}</p>
              <p className="text-sm text-slate-400 mt-1">Phân tích chủ đề và tạo nội dung bài giảng</p>
            </div>
          ) : error ? (
            <div className="card p-10 flex flex-col items-center text-center min-h-[400px] justify-center">
              <FileText className="w-6 h-6 text-rose-500 mb-3" />
              <p className="text-sm font-medium text-rose-600">{format ? 'Không thể tạo bài giảng' : 'Không thể tạo giáo án'}</p>
              <p className="text-sm text-slate-500 mt-1 max-w-md">{error}</p>
            </div>
          ) : plan ? (
            <div className="space-y-3">
              <div className="card px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{format ? 'Bài giảng' : 'Giáo án'}: {topic}</p>
                  <p className="text-sm text-slate-400">
                    {format
                      ? `${textbook} • ${volume} • ${grade}`
                      : `${textbook} • ${volume} • ${grade} • ${duration} phút • ${method}`}
                  </p>
                </div>
                {format && onAssignToStudents ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditorOpen(true)}
                      title="Mở trình soạn thảo bài giảng"
                      aria-label="Mở trình soạn thảo bài giảng"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => { void assignToStudents(); }} className="btn-primary">
                      <Send className="w-3.5 h-3.5" /> Giao cho học sinh
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button className="btn-outline"><Download className="w-3.5 h-3.5" /> Xuất PDF</button>
                    <button className="btn-primary"><Save className="w-3.5 h-3.5" /> Lưu</button>
                  </div>
                )}
              </div>

              {plan.map((section, idx) => (
                <div key={idx} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">{idx + 1}</span>
                      {section.title}
                    </h4>
                    {!format && (
                      <button onClick={() => handleEdit(idx)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors">
                        {editingSection === idx ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  {editingSection === idx ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={format ? Math.max(20, Math.min(36, editText.split('\n').length + 4)) : 4}
                      className={`input-field w-full resize-y text-sm ${format ? 'min-h-[480px]' : ''}`}
                    />
                  ) : format ? (
                    editorDocument && isLessonEditorDocument(editorDocument)
                      ? <RichLessonContent document={editorDocument} className="text-sm leading-relaxed" />
                      : <MathText
                        text={section.content}
                        className="text-sm leading-relaxed"
                        variant="lesson"
                      />
                  ) : (
                    <div className="space-y-2 pl-7 text-sm leading-relaxed text-slate-600">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
                          h1: ({ children }) => <h4 className="text-lg font-bold text-slate-900">{children}</h4>,
                          h2: ({ children }) => <h5 className="text-base font-bold text-slate-900">{children}</h5>,
                          h3: ({ children }) => <h6 className="text-sm font-semibold text-slate-800">{children}</h6>,
                          strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
                        }}
                      >
                        {section.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-10 flex flex-col items-center text-center min-h-[400px] justify-center">
              <div className="w-14 h-14 rounded-md bg-slate-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mt-4">
                {format ? 'Tạo nội dung bài giảng bằng AI' : 'Tạo giáo án bằng AI'}
              </h3>
              <p className="text-sm text-slate-400 mt-1.5 max-w-sm">
                {format
                  ? 'Nhập chủ đề, sau đó điền ý chính vào từng mục ở bảng bên trái. AI sẽ sắp xếp và phát triển thành nội dung bài giảng.'
                  : 'Nhập chủ đề và cấu hình ở bảng bên trái. AI sẽ tạo giáo án với mục tiêu, nội dung, hoạt động và đánh giá.'}
              </p>
            </div>
          )}
        </div>
      </div>
      {draftSaveError && !editorOpen && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          Không thể lưu bản nháp: {draftSaveError}
        </p>
      )}
      {editorOpen && format && plan && (
        <LessonEditor
          title={topic}
          initialMarkdown={plan.map((section) => section.content).join('\n\n')}
          document={editorDocument}
          saveState={draftSaveState}
          saveError={draftSaveError}
          onTitleChange={(nextTitle) => {
            setTopic(nextTitle);
            setDraftSaveState((current) => current === 'unsaved' ? current : 'unsaved');
          }}
          onDocumentReady={handleEditorDocumentReady}
          onDocumentChange={handleEditorDocumentChange}
          onSave={saveCurrentEditorDocument}
          onClose={() => {
            setEditorDocument(editorDocumentRef.current);
            setEditorOpen(false);
          }}
          onUploadImage={uploadEditorImage}
        />
      )}
    </div>
  );
}

function parseLessonPlan(text: string): LessonSection[] {
  const titles = [
    'Mục tiêu học tập',
    'Kiến thức trọng tâm',
    'Nội dung bài giảng',
    'Hoạt động trên lớp',
    'Phương pháp đánh giá',
    'Tài liệu tham khảo',
  ];
  const sections: LessonSection[] = [];
  const titlePattern = titles.map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const matcher = new RegExp(`(?:^|\\n)\\s*(?:\\d+[.)]\\s*)?(${titlePattern})\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:\\d+[.)]\\s*)?(?:${titlePattern})\\s*:?|$)`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(text)) !== null) {
    const content = match[2].trim();
    if (content) sections.push({ title: match[1], content });
  }

  return sections.length > 0 ? sections : [{ title: 'Nội dung giáo án', content: text.trim() }];
}
