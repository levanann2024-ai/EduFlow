import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  BookOpen, Check, Clock3, CloudUpload, FileText, FileVideo2, FolderOpen, MoreVertical,
  Presentation, Search, Send, X,
} from 'lucide-react';
import { mockClasses } from '@/data';

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
  uploadedAt: string;
};

const classLabels: Record<string, string> = {
  c1: 'Toán 10A1',
  c2: 'Vật lý 11B3',
  c3: 'Ngữ văn 12A2',
  c5: 'Hóa học 10B2',
  c6: 'Sinh học 11A1',
};

const initialRecentFiles: LessonFile[] = [
  { id: 'recent-1', name: 'Bài giảng Chương 2 - Hàm số bậc hai.pdf', size: 12.4 * 1024 * 1024, className: 'Toán 10A2', chapter: 'Chương 2 - Bài 1', lesson: 'Tiết 1', uploadedAt: '08/10/2026 16:42' },
  { id: 'recent-2', name: 'Bài tập vận dụng - Chương 2.pptx', size: 8.7 * 1024 * 1024, className: 'Toán 10A1', chapter: 'Chương 2 - Bài 2', lesson: 'Tiết 2', uploadedAt: '08/10/2026 14:20' },
  { id: 'recent-3', name: 'Đề cương ôn tập Toán 10.docx', size: 1.2 * 1024 * 1024, className: 'Toán 10A2', chapter: 'Chương 1 - Bài 3', lesson: 'Tiết 1', uploadedAt: '07/10/2026 20:15' },
  { id: 'recent-4', name: 'Video bài giảng Hàm số.mp4', size: 45.6 * 1024 * 1024, className: 'Toán 11A1', chapter: 'Chương 2 - Bài 1', lesson: 'Tiết 1', uploadedAt: '06/10/2026 18:30' },
];

const chapters = [
  'Chương 1 - Mệnh đề và tập hợp',
  'Chương 2 - Hàm số bậc hai',
  'Chương 3 - Phương trình',
];
const lessons = [
  'Bài 1: Hàm số bậc hai và đồ thị',
  'Bài 2: Dấu của tam thức bậc hai',
  'Bài 3: Phương trình quy về bậc hai',
];
const acceptedTypes = '.pdf,.ppt,.pptx,.doc,.docx,.xlsx,.xls,.mp4,.jpg,.jpeg,.png';
const maxFileSize = 50 * 1024 * 1024;
const acceptedExtensions = new Set(acceptedTypes.split(',').map((extension) => extension.slice(1)));

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileKind(name: string) {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return { label: 'PDF', color: 'bg-rose-500', Icon: FileText };
  if (extension === 'ppt' || extension === 'pptx') return { label: 'PPT', color: 'bg-orange-500', Icon: Presentation };
  if (extension === 'mp4') return { label: 'MP4', color: 'bg-violet-500', Icon: FileVideo2 };
  if (extension === 'doc' || extension === 'docx') return { label: 'DOC', color: 'bg-blue-500', Icon: FileText };
  return { label: 'FILE', color: 'bg-sky-500', Icon: FileText };
}

export function LessonRepository() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LessonFile[]>([]);
  const [recentFiles, setRecentFiles] = useState(initialRecentFiles);
  const [selectedClasses, setSelectedClasses] = useState<string[]>(['c1', 'c2']);
  const [classQuery, setClassQuery] = useState('');
  const [chapter, setChapter] = useState(chapters[1]);
  const [lesson, setLesson] = useState(lessons[0]);
  const [period, setPeriod] = useState('Tiết 1');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dragging, setDragging] = useState(false);
  const [feedback, setFeedback] = useState('');

  const filteredClasses = useMemo(
    () => mockClasses.filter((classroom) => (classLabels[classroom.id] ?? classroom.name).toLocaleLowerCase('vi').includes(classQuery.toLocaleLowerCase('vi'))),
    [classQuery],
  );

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

  const toggleClass = (classId: string) => {
    setSelectedClasses((selected) => selected.includes(classId)
      ? selected.filter((id) => id !== classId)
      : [...selected, classId]);
  };

  const sendFiles = () => {
    if (files.length === 0) {
      setFeedback('Chọn ít nhất một tài liệu trước khi gửi.');
      return;
    }
    if (selectedClasses.length === 0) {
      setFeedback('Chọn lớp nhận tài liệu.');
      return;
    }
    if (!title.trim()) {
      setFeedback('Nhập tên tài liệu trước khi gửi.');
      return;
    }

    const uploadedAt = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date());
    const additions = files.map((file, index) => ({
      ...file,
      id: `uploaded-${Date.now()}-${index}`,
      className: selectedClasses.map((id) => classLabels[id] ?? id).join(', '),
      chapter,
      lesson,
      period: period === 'Không chọn' ? undefined : period,
      displayTitle: title.trim() || file.name,
      note: note.trim() || undefined,
      uploadedAt,
    }));
    setRecentFiles((current) => [...additions, ...current].slice(0, 8));
    setFiles([]);
    setTitle('');
    setNote('');
    setFeedback(`Đã cập nhật danh sách demo: ${additions.length} tài liệu tới ${selectedClasses.length} lớp.`);
  };

  const allFilteredSelected = filteredClasses.length > 0 && filteredClasses.every(({ id }) => selectedClasses.includes(id));

  return (
    <section className="teacher-library flex min-h-0 flex-1 flex-col overflow-hidden bg-sky-50/60">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-1 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-blue-950 sm:text-2xl">Đăng tài liệu cho học sinh</h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Tải tài liệu, gắn chương - bài, chọn lớp và gửi đến học sinh.</p>
        </div>
        <button
          onClick={sendFiles}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Send className="h-4 w-4" /> Gửi tài liệu
        </button>
      </div>

      {feedback && (
        <div role="status" className="mb-2 flex shrink-0 items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          {feedback}
          <button onClick={() => setFeedback('')} aria-label="Đóng thông báo"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-[1.55fr_1fr] lg:overflow-hidden">
        <div className="flex min-h-0 flex-col gap-3">
          <section className="shrink-0 rounded-xl border border-blue-100 bg-white p-3 shadow-sm sm:p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-950">
              <CloudUpload className="h-5 w-5 text-blue-600" /> 1. Tải tài liệu
            </h2>
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
              <p className="mt-2 text-[10px] text-slate-500">PDF, PPTX, DOCX, XLSX, MP4, JPG, PNG · Tối đa 50 MB/tệp</p>
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
          </section>

          <section className="shrink-0 rounded-xl border border-blue-100 bg-white p-3 shadow-sm sm:p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-950">
              <BookOpen className="h-5 w-5 text-blue-600" /> 2. Gắn chương - bài
            </h2>
            <p className="mb-2 text-[11px] text-slate-500">Giúp học sinh dễ dàng tìm thấy tài liệu theo chương, bài học.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="block text-[11px] font-semibold text-slate-600">Chương
                <select value={chapter} onChange={(event) => setChapter(event.target.value)} className="input-field mt-1 h-9 px-2.5 py-1.5 text-xs">
                  {chapters.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">Bài
                <select value={lesson} onChange={(event) => setLesson(event.target.value)} className="input-field mt-1 h-9 px-2.5 py-1.5 text-xs">
                  {lessons.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">Tiết (nếu có)
                <select value={period} onChange={(event) => setPeriod(event.target.value)} className="input-field mt-1 h-9 px-2.5 py-1.5 text-xs">
                  {['Tiết 1', 'Tiết 2', 'Tiết 3', 'Không chọn'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className="min-h-0 flex-1 rounded-xl border border-blue-100 bg-white p-3 shadow-sm sm:p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-950">
              <FileText className="h-5 w-5 text-blue-600" /> 3. Thêm thông tin tài liệu
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[11px] font-semibold text-slate-600">Tên tài liệu <span className="text-rose-500">*</span> <span className="font-normal text-slate-400">(hiển thị cho học sinh)</span>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhập tên tài liệu" maxLength={120} className="input-field mt-1 h-9 px-2.5 py-1.5 text-xs" />
              </label>
              <label className="block text-[11px] font-semibold text-slate-600">Nội dung / Lời nhắn <span className="font-normal text-slate-400">(tùy chọn)</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi lời nhắn cho học sinh..." maxLength={500} rows={2} className="input-field mt-1 resize-none px-2.5 py-1.5 text-xs" />
                <span className="mt-0.5 block text-right text-[10px] text-slate-400">{note.length}/500</span>
              </label>
            </div>
          </section>
        </div>

        <div className="flex min-h-[420px] min-h-0 flex-col gap-3 lg:min-h-0">
          <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-blue-100 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-950">
                <BookOpen className="h-4 w-4 text-blue-600" /> Chọn lớp nhận
              </h2>
              <button onClick={() => setSelectedClasses(allFilteredSelected ? selectedClasses.filter((id) => !filteredClasses.some((item) => item.id === id)) : Array.from(new Set([...selectedClasses, ...filteredClasses.map(({ id }) => id)])))} className="text-[11px] font-medium text-blue-600 hover:text-blue-800">
                {allFilteredSelected ? 'Bỏ chọn' : 'Chọn tất cả'}
              </button>
            </div>
            <label className="relative mt-2 block">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={classQuery} onChange={(event) => setClassQuery(event.target.value)} placeholder="Tìm lớp học..." className="h-8 w-full rounded-md border border-slate-200 pl-8 pr-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50" />
            </label>
            <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {filteredClasses.map((classroom) => {
                const selected = selectedClasses.includes(classroom.id);
                return (
                  <button key={classroom.id} onClick={() => toggleClass(classroom.id)} className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${selected ? 'border-blue-100 bg-blue-50/60' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white'}`}>{selected && <Check className="h-3 w-3" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-800">{classLabels[classroom.id] ?? classroom.name}</span>
                      <span className="block text-[10px] text-slate-400">{classroom.studentCount} học sinh</span>
                    </span>
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-[9px] font-medium text-sky-700">{classroom.grade}</span>
                  </button>
                );
              })}
              {filteredClasses.length === 0 && <p className="py-5 text-center text-xs text-slate-400">Không tìm thấy lớp.</p>}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">Đã chọn {selectedClasses.length} lớp</p>
          </section>

          <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-blue-100 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-950"><Clock3 className="h-4 w-4 text-blue-600" /> Tài liệu mới đăng</h2>
              <span className="text-[10px] font-medium text-blue-600">Gần đây</span>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
              {recentFiles.map((file) => {
                const { color, label, Icon } = fileKind(file.name);
                return (
                  <article key={file.id} className="flex items-start gap-2 py-2">
                    <span className={`${color} mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white`}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-slate-800">{file.displayTitle ?? file.name}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-400">{file.chapter} · {file.lesson} · {file.period ? `${file.period} · ` : ''}{label} · {formatFileSize(file.size)}</p>
                      {file.note && <p className="truncate text-[10px] text-slate-500">{file.note}</p>}
                      <p className="text-[9px] text-slate-400">{file.uploadedAt}</p>
                    </div>
                    <span className="max-w-24 truncate rounded-full bg-blue-50 px-2 py-1 text-[9px] font-medium text-blue-700">{file.className}</span>
                    <button onClick={() => setRecentFiles((current) => current.filter((item) => item.id !== file.id))} aria-label={`Xóa ${file.name} khỏi danh sách gần đây`} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
