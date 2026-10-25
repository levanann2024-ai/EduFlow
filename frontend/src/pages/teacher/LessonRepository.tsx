import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  BookOpen, Check, Clock3, CloudUpload, FileText, FileVideo2, FolderOpen,
  Presentation, Search, Send, Sparkles, Upload, WandSparkles, X,
} from 'lucide-react';
import { authenticatedFetch } from '@/auth/authApi';
import {
  createClassAssignment,
  createClassLearningResource,
  listClassAssignments,
  listClassLearningResources,
  listClassSubjects,
  listClasses,
  type SchoolClass,
} from '@/api/schoolApi';

type LessonFile = {
  id: string;
  name: string;
  size: number;
  file?: File;
  className?: string;
  chapter: string;
  lesson: string;
  period?: string;
  displayTitle?: string;
  note?: string;
  content?: string;
  uploadedAt: string;
};

const acceptedTypes = '.pdf,.ppt,.pptx,.doc,.docx,.xlsx,.xls,.mp4,.jpg,.jpeg,.png';
const maxFileSize = 50 * 1024 * 1024;
const acceptedExtensions = new Set(acceptedTypes.split(',').map((extension) => extension.slice(1)));

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function defaultDueAt() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function fileKind(name: string) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'txt') return { label: 'TXT', color: 'bg-blue-500', Icon: FileText };
  if (extension === 'pdf') return { label: 'PDF', color: 'bg-rose-500', Icon: FileText };
  if (extension === 'ppt' || extension === 'pptx') return { label: 'PPT', color: 'bg-orange-500', Icon: Presentation };
  if (extension === 'mp4') return { label: 'MP4', color: 'bg-violet-500', Icon: FileVideo2 };
  if (extension === 'doc' || extension === 'docx') return { label: 'DOC', color: 'bg-blue-500', Icon: FileText };
  return { label: 'FILE', color: 'bg-sky-500', Icon: FileText };
}

export function LessonRepository() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entryMode, setEntryMode] = useState<'write' | 'upload'>('write');
  const [contentType, setContentType] = useState<'lesson' | 'assignment'>('lesson');
  const [files, setFiles] = useState<LessonFile[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [recentEntries, setRecentEntries] = useState<Array<{
    id: string;
    title: string;
    chapter: string;
    lesson: string;
    period: string | null;
    className: string;
    note: string;
    kind: 'lesson' | 'assignment';
    createdAt: string;
  }>>([]);
  const [classQuery, setClassQuery] = useState('');
  const [chapter, setChapter] = useState('');
  const [lesson, setLesson] = useState('');
  const [period, setPeriod] = useState('');
  const [semester, setSemester] = useState('Kỳ 1');
  const [dueAt, setDueAt] = useState(defaultDueAt);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const filteredClasses = useMemo(
    () => classes.filter((classroom) =>
      `${classroom.name} ${classroom.code}`.toLocaleLowerCase('vi').includes(classQuery.toLocaleLowerCase('vi'))),
    [classes, classQuery],
  );

  useEffect(() => {
    let active = true;
    listClasses()
      .then((items) => {
        if (!active) return;
        setClasses(items);
        setSelectedClasses(items[0] ? [items[0].id] : []);
      })
      .catch((loadError) => {
        if (active) setFeedback(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách lớp.');
      })
      .finally(() => {
        if (active) setLoadingClasses(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const classId = selectedClasses[0];
    if (!classId) {
      setSubjects([]);
      setSelectedSubject('');
      return;
    }
    let active = true;
    listClassSubjects(classId)
      .then((items) => {
        if (!active) return;
        setSubjects(items);
        setSelectedSubject((current) => items.includes(current) ? current : (items[0] ?? ''));
      })
      .catch((loadError) => {
        if (active) setFeedback(loadError instanceof Error ? loadError.message : 'Không thể tải môn học được phân công.');
      });
    return () => { active = false; };
  }, [selectedClasses]);

  useEffect(() => {
    const classId = selectedClasses[0];
    const classroom = classes.find((item) => item.id === classId);
    if (!classId || !classroom || !selectedSubject) {
      setRecentEntries([]);
      return;
    }
    let active = true;
    setLoadingRecent(true);
    Promise.all([
      listClassLearningResources(classId),
      listClassAssignments(classId, classroom.academic_year, semester, selectedSubject),
    ])
      .then(([resources, assignments]) => {
        if (!active) return;
        setRecentEntries([
          ...resources.filter((resource) => resource.subject === selectedSubject).map((resource) => ({
            id: resource.id,
            title: resource.title,
            chapter: resource.chapter,
            lesson: resource.lesson,
            period: resource.period,
            className: classroom.code,
            note: resource.note,
            kind: 'lesson' as const,
            createdAt: resource.createdAt,
          })),
          ...assignments.map((assignment) => ({
            id: assignment.id,
            title: assignment.title,
            chapter: assignment.chapter,
            lesson: assignment.lesson,
            period: assignment.period,
            className: classroom.code,
            note: assignment.description,
            kind: 'assignment' as const,
            createdAt: assignment.createdAt ?? assignment.dueAt,
          })),
        ].sort((first, second) => second.createdAt.localeCompare(first.createdAt)).slice(0, 4));
      })
      .catch((loadError) => {
        if (active) setFeedback(loadError instanceof Error ? loadError.message : 'Không thể tải nội dung đã đăng.');
      })
      .finally(() => {
        if (active) setLoadingRecent(false);
      });
    return () => { active = false; };
  }, [classes, selectedClasses, selectedSubject, semester]);

  const runDocumentAssistant = async (action: 'latex' | 'polish' | 'check') => {
    if (!documentContent.trim()) {
      setFeedback('Nhập nội dung tài liệu trước khi dùng trợ lý.');
      return;
    }

    const requests = {
      latex: 'Hãy chuẩn hóa các công thức Toán, Lý, Hóa trong tài liệu sau bằng cú pháp LaTeX dễ đọc. Giữ nguyên nội dung khác và chỉ trả về bản đã xử lý.',
      polish: 'Hãy trình bày lại tài liệu sau cho rõ ràng, đẹp, có tiêu đề và danh sách hợp lý nếu phù hợp. Giữ nguyên ý nghĩa và chỉ trả về nội dung đã trình bày.',
      check: 'Hãy kiểm tra tài liệu sau về lỗi chính tả, ngữ pháp, diễn đạt và công thức. Không viết lại tài liệu; trả về danh sách lỗi phát hiện và đề xuất sửa, hoặc xác nhận chưa thấy lỗi rõ ràng.',
    };
    setAiBusy(true);
    setFeedback('');
    try {
      const response = await authenticatedFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'lesson-document', prompt: `${requests[action]}\n\n${documentContent}` }),
      });
      const result: { success: boolean; data?: string; message?: string } = await response.json();
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'Không thể xử lý nội dung bằng trợ lý AI.');
      }
      if (action === 'check') setFeedback(result.data);
      else setDocumentContent(result.data);
    } catch (requestError) {
      setFeedback(requestError instanceof Error ? requestError.message : 'Không thể kết nối tới dịch vụ AI.');
    } finally {
      setAiBusy(false);
    }
  };

  const addFiles = (incomingFiles: FileList | File[]) => {
    const accepted = Array.from(incomingFiles).filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      return file.size <= maxFileSize && acceptedExtensions.has(extension);
    });
    if (accepted.length !== incomingFiles.length) {
      setFeedback('Một số tệp không đúng định dạng hỗ trợ hoặc vượt quá giới hạn 50 MB.');
    } else {
      setFeedback('');
    }
    setFiles((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: file.size,
        file,
        chapter,
        lesson,
        uploadedAt: '',
      })),
    ]);
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const sendFiles = async () => {
    if (entryMode === 'upload') {
      setFeedback('Hệ thống chưa hỗ trợ lưu tệp lên máy chủ. Hãy chọn “Viết trực tiếp” để đăng nội dung.');
      return;
    }
    if (!documentContent.trim()) {
      setFeedback('Nhập nội dung tài liệu trước khi gửi.');
      return;
    }
    const classId = selectedClasses[0];
    const classroom = classes.find((item) => item.id === classId);
    if (!classId || !classroom) {
      setFeedback('Chọn lớp nhận tài liệu.');
      return;
    }
    if (!selectedSubject) {
      setFeedback('Chọn môn học được phân công.');
      return;
    }
    if (!chapter.trim() || !lesson.trim()) {
      setFeedback('Nhập chương và bài học.');
      return;
    }
    if (!title.trim()) {
      setFeedback('Nhập tên tài liệu trước khi gửi.');
      return;
    }
    setPublishing(true);
    setFeedback('');
    try {
      const payload = {
        academicYear: classroom.academic_year,
        semester,
        subject: selectedSubject,
        chapter: chapter.trim(),
        lesson: lesson.trim(),
        period: period.trim() || null,
      };
      if (contentType === 'lesson') {
        await createClassLearningResource(classId, {
          ...payload, title: title.trim(), content: documentContent.trim(), note: note.trim(),
        });
      } else {
        if (!Number.isFinite(Date.parse(dueAt)) || Date.parse(dueAt) <= Date.now()) {
          setFeedback('Chọn hạn nộp bài tập trong tương lai.');
          return;
        }
        await createClassAssignment(classId, {
          ...payload, title: title.trim(), description: documentContent.trim(), dueAt: new Date(dueAt).toISOString(),
        });
      }
      setTitle('');
      setNote('');
      setDocumentContent('');
      setFeedback(contentType === 'lesson' ? 'Bài giảng đã được đăng.' : 'Bài tập đã được giao.');
      const [resources, assignments] = await Promise.all([
        listClassLearningResources(classId),
        listClassAssignments(classId, classroom.academic_year, semester, selectedSubject),
      ]);
      setRecentEntries([
        ...resources.filter((resource) => resource.subject === selectedSubject).map((resource) => ({
          id: resource.id, title: resource.title, chapter: resource.chapter, lesson: resource.lesson,
          period: resource.period, className: classroom.code, note: resource.note,
          kind: 'lesson' as const, createdAt: resource.createdAt,
        })),
        ...assignments.map((assignment) => ({
          id: assignment.id, title: assignment.title, chapter: assignment.chapter, lesson: assignment.lesson,
          period: assignment.period, className: classroom.code, note: assignment.description,
          kind: 'assignment' as const, createdAt: assignment.createdAt ?? assignment.dueAt,
        })),
      ].sort((first, second) => second.createdAt.localeCompare(first.createdAt)).slice(0, 4));
    } catch (requestError) {
      setFeedback(requestError instanceof Error ? requestError.message : 'Không thể đăng nội dung.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="teacher-library flex min-h-0 flex-1 flex-col overflow-hidden bg-sky-50/60">
      {feedback && (
        <div role="status" className="mb-2 flex max-h-20 shrink-0 items-start justify-between gap-3 overflow-auto whitespace-pre-wrap rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <span>{feedback}</span>
          <button onClick={() => setFeedback('')} aria-label="Đóng thông báo" className="shrink-0"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_260px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
        <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1">
          <section className="shrink-0 rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-950">
              <CloudUpload className="h-5 w-5 text-blue-600" /> 1. Tạo nội dung
            </h2>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Loại nội dung">
                <button type="button" onClick={() => setContentType('lesson')} aria-pressed={contentType === 'lesson'} className={`h-full rounded-md px-3 text-xs font-semibold transition-colors ${contentType === 'lesson' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}>Bài giảng</button>
                <button type="button" onClick={() => setContentType('assignment')} aria-pressed={contentType === 'assignment'} className={`h-full rounded-md px-3 text-xs font-semibold transition-colors ${contentType === 'assignment' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}>Bài tập</button>
              </div>
              <div className="inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Cách tạo tài liệu">
                <button
                  role="tab"
                  aria-selected={entryMode === 'write'}
                  onClick={() => setEntryMode('write')}
                  className={`inline-flex h-full items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${entryMode === 'write' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}
                >
                  <FileText className="h-3.5 w-3.5" /> Viết trực tiếp
                </button>
                <button
                  role="tab"
                  aria-selected={entryMode === 'upload'}
                  onClick={() => setEntryMode('upload')}
                  className={`inline-flex h-full items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${entryMode === 'upload' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}
                >
                  <Upload className="h-3.5 w-3.5" /> Tải tài liệu lên
                </button>
              </div>
            </div>
            {entryMode === 'write' ? (
              <div className="space-y-2">
                <textarea
                  value={documentContent}
                  onChange={(event) => setDocumentContent(event.target.value)}
                  placeholder="Nhập hoặc dán nội dung tài liệu tại đây..."
                  rows={5}
                  className="input-field min-h-28 resize-y text-sm"
                  aria-label="Nội dung tài liệu"
                />
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['latex', 'Tạo / chuẩn hóa LaTeX', Sparkles],
                    ['polish', 'Trình bày đẹp hơn', WandSparkles],
                    ['check', 'Kiểm tra lỗi', Search],
                  ] as const).map(([action, label, Icon]) => (
                    <button
                      key={action}
                      onClick={() => runDocumentAssistant(action)}
                      disabled={aiBusy || !documentContent.trim()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50/70 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icon className="h-3.5 w-3.5" /> {aiBusy ? 'Đang xử lý...' : label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div
                  onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-3 text-center transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-blue-300 bg-sky-50/70'}`}
                >
                  <CloudUpload className="h-8 w-8 text-blue-500" />
                  <p className="mt-1 text-xs font-semibold text-blue-950">Kéo và thả tệp vào đây</p>
                  <p className="text-[11px] text-slate-400">hoặc</p>
                  <button onClick={() => fileInputRef.current?.click()} className="mt-1 inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600">
                    <FolderOpen className="h-4 w-4" /> Chọn tệp từ máy tính
                  </button>
                  <input ref={fileInputRef} type="file" multiple accept={acceptedTypes} className="hidden" onChange={onFileInput} />
                  <p className="mt-2 text-[10px] text-amber-700">Tệp chỉ xem trước trên máy này, chưa được lưu lên máy chủ. Chọn “Viết trực tiếp” để đăng.</p>
                </div>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {files.map((file) => {
                      const { color, Icon } = fileKind(file.name);
                      return (
                        <li key={file.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2">
                          <span className={`${color} rounded-md p-1.5 text-white`}><Icon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">{file.name}<span className="ml-2 font-normal text-slate-400">{formatFileSize(file.size)}</span></span>
                          <button onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))} aria-label={`Xóa ${file.name}`} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X className="h-4 w-4" /></button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>

          <section className="shrink-0 rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-950">
              <BookOpen className="h-5 w-5 text-blue-600" /> 2. Gắn chương - bài
            </h2>
            <p className="mb-2 text-[11px] text-slate-500">Gắn thông tin chương, bài và tiết (nếu có) để học sinh dễ tìm.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="block text-[11px] font-semibold text-slate-600">Chương
                <input value={chapter} onChange={(event) => setChapter(event.target.value)} maxLength={160} placeholder="Ví dụ: Chương 1" className="input-field mt-1 h-9 px-2.5 py-1.5 text-xs" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">Bài
                <input value={lesson} onChange={(event) => setLesson(event.target.value)} maxLength={200} placeholder="Ví dụ: Bài 1 - ..." className="input-field mt-1 h-9 px-2.5 py-1.5 text-xs" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">Tiết (nếu có)
                <input value={period} onChange={(event) => setPeriod(event.target.value)} maxLength={80} placeholder="Nhập tiết (không bắt buộc)" className="input-field mt-1 h-9 px-2.5 py-1.5 text-xs" />
              </label>
            </div>
          </section>

          <section className="shrink-0 rounded-xl border border-blue-100 bg-white p-2.5 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-950">
              <FileText className="h-5 w-5 text-blue-600" /> 3. Thông tin {contentType === 'lesson' ? 'bài giảng' : 'bài tập'}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-[11px] font-semibold text-slate-600">Tên {contentType === 'lesson' ? 'bài giảng' : 'bài tập'} <span className="text-rose-500">*</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhập tên" maxLength={200} className="input-field mt-1 h-9 px-2.5 py-1.5 text-xs" />
              </label>
              {contentType === 'assignment' && (
                <label className="block text-[11px] font-semibold text-slate-600">Hạn nộp
                  <input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="input-field mt-1 h-9 px-2.5 py-1.5 text-xs" />
                </label>
              )}
              <label className="block text-[11px] font-semibold text-slate-600">Nội dung / Lời nhắn <span className="font-normal text-slate-400">(tùy chọn)</span>
                <textarea value={contentType === 'lesson' ? note : documentContent} onChange={(event) => contentType === 'lesson' ? setNote(event.target.value) : setDocumentContent(event.target.value)} placeholder={contentType === 'lesson' ? 'Lời nhắn cho học sinh...' : 'Nội dung yêu cầu bài tập...'} maxLength={contentType === 'lesson' ? 500 : 5000} rows={1} className="input-field mt-1 h-9 min-h-0 resize-y px-2.5 py-1.5 text-xs" />
              </label>
            </div>
          </section>
          {feedback && <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">{feedback}</p>}
          <button
            onClick={sendFiles}
            disabled={publishing}
            className="inline-flex min-h-14 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-md transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:opacity-60"
          >
            <Send className="h-5 w-5" /> {publishing ? 'Đang đăng...' : contentType === 'lesson' ? 'Đăng bài giảng' : 'Giao bài tập'}
          </button>
        </div>

        <div className="flex min-h-0 flex-col gap-3 lg:h-full lg:overflow-y-auto lg:pr-1">
          <section className="flex shrink-0 flex-col rounded-xl border border-blue-100 bg-white p-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                <BookOpen className="h-4 w-4 text-blue-600" /> Chọn lớp nhận
              </h2>
              <span className="text-[10px] text-slate-500">Mỗi lần đăng 1 lớp</span>
            </div>
            <label className="relative mt-1.5 block">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={classQuery} onChange={(event) => setClassQuery(event.target.value)} placeholder="Tìm lớp học..." className="h-8 w-full rounded-md border border-slate-200 pl-8 pr-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
            </label>
            <div className="mt-1.5 max-h-36 min-h-0 space-y-1 overflow-y-auto">
              {loadingClasses ? <p className="py-4 text-center text-xs text-slate-500">Đang tải lớp...</p> : filteredClasses.map((classroom) => {
                const selected = selectedClasses.includes(classroom.id);
                return (
                  <button key={classroom.id} onClick={() => setSelectedClasses([classroom.id])} className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-left transition-colors ${selected ? 'border-blue-100 bg-blue-50/60' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white'}`}>{selected && <Check className="h-2.5 w-2.5" />}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{classroom.code} - {classroom.name}</span>
                  </button>
                );
              })}
              {!loadingClasses && filteredClasses.length === 0 && <p className="py-5 text-center text-xs text-slate-400">Không tìm thấy lớp.</p>}
            </div>
            {subjects.length > 1 && (
              <select
                aria-label="Chọn môn học được phân công"
                value={selectedSubject}
                onChange={(event) => setSelectedSubject(event.target.value)}
                className="input-field mt-2 h-9 !py-1 px-2 text-xs"
              >
                {subjects.map((item) => <option key={item}>{item}</option>)}
              </select>
            )}
            <label className="mt-2 block text-[10px] font-semibold text-slate-600">Học kỳ
              <select value={semester} onChange={(event) => setSemester(event.target.value)} className="input-field mt-1 h-9 !py-1 px-2 text-xs">
                <option>Kỳ 1</option><option>Kỳ 2</option>
              </select>
            </label>
            <p className="mt-1.5 text-[10px] text-slate-500">Chỉ có thể đăng vào lớp và môn được phân công.</p>
          </section>

          <section className="flex shrink-0 flex-col rounded-xl border border-blue-100 bg-white p-2.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-950"><Clock3 className="h-4 w-4 text-blue-600" /> Tài liệu mới đăng</h2>
              <span className="text-[10px] font-medium text-blue-600">{loadingRecent ? 'Đang tải...' : 'Gần đây'}</span>
            </div>
            <div className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto">
              {recentEntries.map((entry) => {
                const { color, Icon } = fileKind(entry.kind === 'assignment' ? 'exercise.txt' : 'lesson.txt');
                return (
                  <article key={entry.id} className="flex items-center gap-1.5 py-2">
                    <span className={`${color} flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white`}><Icon className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-semibold leading-4 text-slate-800">{entry.title}</p>
                      <p className="truncate text-[9px] leading-3 text-slate-400">{entry.kind === 'lesson' ? 'Bài giảng' : 'Bài tập'} · {entry.chapter} · {entry.lesson}{entry.period ? ` · ${entry.period}` : ''}</p>
                      {entry.note && <p className="truncate text-[9px] leading-3 text-slate-500">{entry.note}</p>}
                    </div>
                    <span className="max-w-16 truncate rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">{entry.className}</span>
                  </article>
                );
              })}
              {!loadingRecent && recentEntries.length === 0 && <p className="py-5 text-center text-xs text-slate-400">Chưa có nội dung đã đăng.</p>}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
