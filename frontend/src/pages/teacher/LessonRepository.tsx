import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  BookOpen, Check, ChevronDown, ChevronRight, Clock3, CloudUpload, Download, Edit3, Eye, FileImage,
  FileSpreadsheet, FileText, FileVideo2, FolderOpen, MoreVertical, Pencil, Presentation, Save, Search, Send,
  Sparkles, Trash2, Upload, WandSparkles, X,
} from 'lucide-react';
import { authenticatedFetch } from '@/auth/authApi';
import {
  createClassAssignment,
  createClassLearningResource,
  deleteClassLearningResourceChapter,
  downloadClassLearningResourceFile,
  listClassAssignments,
  listClassLearningResources,
  listClassSubjects,
  listClasses,
  renameClassLearningResourceChapter,
  type ClassAssignment,
  type ClassLearningResource,
  type SchoolClass,
  updateClassLearningResource,
  uploadClassLearningResource,
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

const acceptedTypes = '.pdf,.ppt,.pptx,.doc,.docx,.xlsx,.xls,.mp4,.jpg,.jpeg,.png,.gif,.webp';
const maxFileSize = 50 * 1024 * 1024;
const acceptedExtensions = new Set(acceptedTypes.split(',').map((extension) => extension.slice(1)));

type ReviewDraft = {
  title: string;
  chapter: string;
  lesson: string;
  period: string;
  content: string;
  note: string;
  fileName: string;
};

type ReviewAssignmentGroup = {
  chapter: string;
  isFree?: boolean;
  lessons: Array<{ lesson: string; assignments: ClassAssignment[] }>;
};

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
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension ?? '')) return { label: 'IMG', color: 'bg-emerald-500', Icon: FileImage };
  if (extension === 'txt') return { label: 'TXT', color: 'bg-blue-500', Icon: FileText };
  if (extension === 'pdf') return { label: 'PDF', color: 'bg-rose-500', Icon: FileText };
  if (extension === 'ppt' || extension === 'pptx') return { label: 'PPT', color: 'bg-orange-500', Icon: Presentation };
  if (extension === 'mp4') return { label: 'MP4', color: 'bg-violet-500', Icon: FileVideo2 };
  if (extension === 'doc' || extension === 'docx') return { label: 'DOC', color: 'bg-blue-500', Icon: FileText };
  return { label: 'FILE', color: 'bg-sky-500', Icon: FileText };
}

function resourceFileIcon(name: string) {
  const extension = name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension ?? '')) return FileImage;
  if (extension === 'mp4') return FileVideo2;
  if (extension === 'ppt' || extension === 'pptx') return Presentation;
  if (extension === 'xls' || extension === 'xlsx') return FileSpreadsheet;
  return FileText;
}

export function LessonRepository() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reviewFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'review'>('create');
  const [entryMode, setEntryMode] = useState<'write' | 'upload'>('write');
  const [contentType, setContentType] = useState<'lesson' | 'assignment'>('lesson');
  const [files, setFiles] = useState<LessonFile[]>([]);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [reviewResources, setReviewResources] = useState<ClassLearningResource[]>([]);
  const [reviewAssignments, setReviewAssignments] = useState<ClassAssignment[]>([]);
  const [assignmentChapters, setAssignmentChapters] = useState<string[]>([]);
  const [creatingChapter, setCreatingChapter] = useState(false);
  const [editingChapterName, setEditingChapterName] = useState<string | null>(null);
  const [chapterNameDraft, setChapterNameDraft] = useState('');
  const [openChapterMenu, setOpenChapterMenu] = useState<string | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [selectedReviewAssignmentId, setSelectedReviewAssignmentId] = useState<string | null>(null);
  const [reviewPreviewTab, setReviewPreviewTab] = useState<'lesson' | 'assignment'>('lesson');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>({
    title: '', chapter: '', lesson: '', period: '', content: '', note: '', fileName: '',
  });
  const [editingReview, setEditingReview] = useState(false);
  const [reviewFileUrl, setReviewFileUrl] = useState<string | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementFileUrl, setReplacementFileUrl] = useState<string | null>(null);
  const [reviewFileError, setReviewFileError] = useState('');
  const [reviewFileLoading, setReviewFileLoading] = useState(false);
  const [expandedReviewChapters, setExpandedReviewChapters] = useState<Set<string>>(() => new Set());
  const [expandedReviewLessons, setExpandedReviewLessons] = useState<Set<string>>(() => new Set());
  const [recentEntries, setRecentEntries] = useState<Array<{
    id: string;
    title: string;
    chapter: string;
    lesson: string;
    period: string | null;
    className: string;
    note: string;
    fileName?: string;
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
  const selectedFile = files[0]?.file;

  useEffect(() => {
    if (!selectedFile?.type.startsWith('image/')) {
      setFilePreviewUrl('');
      return;
    }
    const previewUrl = URL.createObjectURL(selectedFile);
    setFilePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedFile]);

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
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
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
      setReviewResources([]);
      setReviewAssignments([]);
      setAssignmentChapters([]);
      setRecentEntries([]);
      return;
    }
    let active = true;
    setReviewResources([]);
    setReviewAssignments([]);
    setLoadingRecent(true);
    Promise.all([
      listClassLearningResources(classId),
      listClassAssignments(classId, classroom.academic_year, semester, selectedSubject),
    ])
      .then(([resources, assignments]) => {
        if (!active) return;
        setReviewResources(resources.filter((resource) => resource.subject === selectedSubject));
        setReviewAssignments(assignments);
        setAssignmentChapters(assignments.map((assignment) => assignment.chapter).filter(Boolean));
        setRecentEntries([
          ...resources.filter((resource) => resource.subject === selectedSubject).map((resource) => ({
            id: resource.id,
            title: resource.title,
            chapter: resource.chapter,
            lesson: resource.lesson,
            period: resource.period,
            className: classroom.code,
            note: resource.note,
            fileName: resource.files[0]?.name,
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

  const selectedClass = classes.find((classroom) => classroom.id === selectedClasses[0]) ?? null;
  const visibleReviewResources = useMemo(
    () => reviewResources.filter((resource) => resource.semester === semester),
    [reviewResources, semester],
  );
  const visibleReviewAssignments = useMemo(
    () => reviewAssignments.filter((assignment) => new Date(assignment.dueAt).getTime() > currentTime),
    [currentTime, reviewAssignments],
  );
  const availableChapters = useMemo(
    () => Array.from(new Set([
      ...visibleReviewResources.map((resource) => resource.chapter),
      ...assignmentChapters,
    ])).sort((first, second) => first.localeCompare(second, 'vi', { numeric: true })),
    [assignmentChapters, visibleReviewResources],
  );
  const selectedReviewResource = visibleReviewResources.find((resource) => resource.id === selectedReviewId)
    ?? visibleReviewResources[0]
    ?? null;
  const selectedReviewAssignment = visibleReviewAssignments.find((assignment) =>
    assignment.id === selectedReviewAssignmentId) ?? visibleReviewAssignments[0] ?? null;
  const reviewChapterGroups = useMemo(() => {
    const chapters = new Map<string, Map<string, ClassLearningResource[]>>();
    visibleReviewResources.forEach((resource) => {
      const lessons = chapters.get(resource.chapter) ?? new Map<string, ClassLearningResource[]>();
      const items = lessons.get(resource.lesson) ?? [];
      items.push(resource);
      lessons.set(resource.lesson, items);
      chapters.set(resource.chapter, lessons);
    });
    return Array.from(chapters.entries())
      .map(([chapterName, lessons]) => ({
        chapter: chapterName,
        lessons: Array.from(lessons.entries())
          .map(([lessonName, items]) => ({ lesson: lessonName, resources: items }))
          .sort((first, second) => first.lesson.localeCompare(second.lesson, 'vi', { numeric: true })),
      }))
      .sort((first, second) => first.chapter.localeCompare(second.chapter, 'vi', { numeric: true }));
  }, [visibleReviewResources]);
  const reviewAssignmentGroups = useMemo(() => {
    const chapters = new Map<string, Map<string, ClassAssignment[]>>();
    const freeAssignments: ClassAssignment[] = [];
    visibleReviewAssignments.forEach((assignment) => {
      if (!assignment.chapter.trim() || !assignment.lesson.trim()) {
        freeAssignments.push(assignment);
        return;
      }
      const lessons = chapters.get(assignment.chapter) ?? new Map<string, ClassAssignment[]>();
      const items = lessons.get(assignment.lesson) ?? [];
      items.push(assignment);
      lessons.set(assignment.lesson, items);
      chapters.set(assignment.chapter, lessons);
    });
    const groups: ReviewAssignmentGroup[] = Array.from(chapters.entries())
      .map(([chapterName, lessons]) => ({
        chapter: chapterName,
        lessons: Array.from(lessons.entries())
          .map(([lessonName, items]) => ({ lesson: lessonName, assignments: items }))
          .sort((first, second) => first.lesson.localeCompare(second.lesson, 'vi', { numeric: true })),
      }))
      .sort((first, second) => first.chapter.localeCompare(second.chapter, 'vi', { numeric: true }));
    if (freeAssignments.length) {
      groups.unshift({
        chapter: 'Bài tập tự do',
        isFree: true,
        lessons: [{ lesson: '', assignments: freeAssignments }],
      });
    }
    return groups;
  }, [visibleReviewAssignments]);

  useEffect(() => {
    if (!selectedReviewAssignment) return;
    const chapter = selectedReviewAssignment.chapter.trim() && selectedReviewAssignment.lesson.trim()
      ? selectedReviewAssignment.chapter
      : 'Bài tập tự do';
    const chapterKey = `preview-assignment:${chapter}`;
    setExpandedReviewChapters((current) => new Set(current).add(chapterKey));
    if (chapter !== 'Bài tập tự do') {
      setExpandedReviewLessons((current) => new Set(current).add(`${chapterKey}:${selectedReviewAssignment.lesson}`));
    }
  }, [selectedReviewAssignment]);

  useEffect(() => {
    if (!selectedReviewResource) {
      setReplacementFile(null);
      setReviewDraft({ title: '', chapter: '', lesson: '', period: '', content: '', note: '', fileName: '' });
      return;
    }
    setReplacementFile(null);
    setReviewDraft({
      title: selectedReviewResource.title,
      chapter: selectedReviewResource.chapter,
      lesson: selectedReviewResource.lesson,
      period: selectedReviewResource.period ?? '',
      content: selectedReviewResource.content,
      note: selectedReviewResource.note,
      fileName: selectedReviewResource.files[0]?.name ?? '',
    });
    setExpandedReviewChapters((current) => new Set(current).add(selectedReviewResource.chapter));
    setExpandedReviewLessons((current) => new Set(current).add(`${selectedReviewResource.chapter}:${selectedReviewResource.lesson}`));
  }, [selectedReviewResource]);

  useEffect(() => {
    if (!replacementFile?.type.startsWith('image/')) {
      setReplacementFileUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(replacementFile);
    setReplacementFileUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [replacementFile]);

  useEffect(() => {
    const file = selectedReviewResource?.files[0];
    if (!selectedReviewResource || !file) {
      setReviewFileUrl(null);
      setReviewFileError('');
      setReviewFileLoading(false);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    setReviewFileUrl(null);
    setReviewFileError('');
    setReviewFileLoading(true);
    downloadClassLearningResourceFile(selectedReviewResource.id, file.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setReviewFileUrl(objectUrl);
      })
      .catch((downloadError) => {
        if (active) setReviewFileError(downloadError instanceof Error ? downloadError.message : 'Không thể tải tệp bài giảng.');
      })
      .finally(() => {
        if (active) setReviewFileLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedReviewResource]);

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
    if (accepted.length > 1) setFeedback('Mỗi bài đăng chỉ đính kèm một tệp. Đã chọn tệp đầu tiên.');
    const selected = accepted[0];
    if (selected) {
      setFiles([{
        id: `${selected.name}-${selected.lastModified}-${Math.random().toString(36).slice(2)}`,
        name: selected.name,
        size: selected.size,
        file: selected,
        chapter,
        lesson,
        uploadedAt: '',
      }]);
      setTitle((current) => current.trim() || selected.name);
    }
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
    const file = entryMode === 'upload' ? files[0]?.file : undefined;
    if (entryMode === 'upload' && !file) {
      setFeedback('Chọn một tệp trước khi đăng.');
      return;
    }
    if (entryMode === 'write' && !documentContent.trim()) {
      setFeedback('Nhập nội dung tài liệu trước khi gửi.');
      return;
    }
    if (contentType === 'assignment' && file) {
      setFeedback('Bài tập hiện chỉ hỗ trợ nội dung văn bản. Hãy chọn “Viết trực tiếp” để giao bài tập.');
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
    if (contentType === 'lesson' && (!chapter.trim() || !lesson.trim())) {
      setFeedback('Nhập chương và bài học.');
      return;
    }
    if (!title.trim() && !file) {
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
        const resourceTitle = title.trim() || file?.name || '';
        if (file) {
          await uploadClassLearningResource(classId, {
            ...payload, title: resourceTitle, note: note.trim(), file,
          });
        } else {
          await createClassLearningResource(classId, {
            ...payload, title: resourceTitle, content: documentContent.trim(), note: note.trim(),
          });
        }
      } else {
        if ((!chapter.trim() || !lesson.trim())
          && !window.confirm('Bài tập chưa có đủ chương và bài cụ thể. Nếu tiếp tục, bài tập sẽ được chuyển vào mục “Bài tập tự do” của học sinh. Bạn có muốn tiếp tục không?')) {
          return;
        }
        if (!Number.isFinite(Date.parse(dueAt)) || Date.parse(dueAt) <= Date.now()) {
          setFeedback('Chọn hạn nộp bài tập trong tương lai.');
          return;
        }
        const assignmentDescription = [
          documentContent.trim(),
          note.trim() ? `Lời nhắn của giáo viên:\n${note.trim()}` : '',
        ].filter(Boolean).join('\n\n');
        if (assignmentDescription.length > 5000) {
          setFeedback('Nội dung bài tập và lời nhắn không được vượt quá 5.000 ký tự.');
          return;
        }
        await createClassAssignment(classId, {
          ...payload, title: title.trim(), description: assignmentDescription, dueAt: new Date(dueAt).toISOString(),
        });
      }
      setTitle('');
      setNote('');
      setDocumentContent('');
      setFiles([]);
      setFeedback(contentType === 'lesson' ? 'Bài giảng đã được đăng.' : 'Bài tập đã được giao.');
      const [resources, assignments] = await Promise.all([
        listClassLearningResources(classId),
        listClassAssignments(classId, classroom.academic_year, semester, selectedSubject),
      ]);
      setReviewResources(resources.filter((resource) => resource.subject === selectedSubject));
      setReviewAssignments(assignments);
      setAssignmentChapters(assignments.map((assignment) => assignment.chapter).filter(Boolean));
      setRecentEntries([
        ...resources.filter((resource) => resource.subject === selectedSubject).map((resource) => ({
          id: resource.id, title: resource.title, chapter: resource.chapter, lesson: resource.lesson,
          period: resource.period, className: classroom.code, note: resource.note,
          fileName: resource.files[0]?.name,
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

  const saveReviewedLesson = async () => {
    if (!selectedClass || !selectedReviewResource) return;
    if (!reviewDraft.title.trim() || !reviewDraft.chapter.trim() || !reviewDraft.lesson.trim()) {
      setFeedback('Tên bài giảng, chương và bài học không được để trống.');
      return;
    }
    if (!reviewDraft.content.trim() && !selectedReviewResource.files.length && !replacementFile) {
      setFeedback('Bài giảng cần có nội dung hoặc tệp đính kèm.');
      return;
    }
    if (selectedReviewResource.files.length && !reviewDraft.fileName.trim()) {
      setFeedback('Tên tệp hiển thị không được để trống.');
      return;
    }
    setPublishing(true);
    setFeedback('');
    try {
      await updateClassLearningResource(selectedClass.id, selectedReviewResource.id, {
        academicYear: selectedReviewResource.academicYear,
        semester: selectedReviewResource.semester,
        subject: selectedReviewResource.subject,
        chapter: reviewDraft.chapter.trim(),
        lesson: reviewDraft.lesson.trim(),
        period: reviewDraft.period.trim() || null,
        title: reviewDraft.title.trim(),
        content: reviewDraft.content,
        note: reviewDraft.note.trim(),
        ...(selectedReviewResource.files.length ? { fileName: reviewDraft.fileName.trim() } : {}),
        ...(replacementFile ? { file: replacementFile } : {}),
      });
      const updatedResources = (await listClassLearningResources(selectedClass.id))
        .filter((resource) => resource.subject === selectedReviewResource.subject);
      setReviewResources(updatedResources);
      setReplacementFile(null);
      setRecentEntries((current) => current.map((entry) => entry.id === selectedReviewResource.id
        ? {
          ...entry,
          title: reviewDraft.title.trim(),
          chapter: reviewDraft.chapter.trim(),
          lesson: reviewDraft.lesson.trim(),
          period: reviewDraft.period.trim() || null,
          note: reviewDraft.note.trim(),
          fileName: reviewDraft.fileName.trim() || entry.fileName,
        }
        : entry));
      setEditingReview(false);
      setFeedback('Bài giảng đã được cập nhật và đăng lại cho học sinh.');
    } catch (requestError) {
      setFeedback(requestError instanceof Error ? requestError.message : 'Không thể cập nhật bài giảng.');
    } finally {
      setPublishing(false);
    }
  };

  const saveChapterName = async (currentChapter: string) => {
    if (!selectedClass) return;
    const nextChapter = chapterNameDraft.trim();
    if (!nextChapter || nextChapter.length > 160) {
      setFeedback('Tên chương phải có từ 1 đến 160 ký tự.');
      return;
    }
    if (nextChapter === currentChapter) {
      setEditingChapterName(null);
      return;
    }
    setPublishing(true);
    setFeedback('');
    try {
      await renameClassLearningResourceChapter(selectedClass.id, currentChapter, {
        academicYear: selectedClass.academic_year,
        semester,
        subject: selectedSubject,
        newChapter: nextChapter,
      });
      const resources = await listClassLearningResources(selectedClass.id);
      setReviewResources(resources.filter((resource) => resource.subject === selectedSubject));
      setExpandedReviewChapters((current) => {
        const next = new Set(current);
        next.delete(currentChapter);
        next.add(nextChapter);
        return next;
      });
      setEditingChapterName(null);
      setFeedback('Đã đổi tên chương cho các bài giảng trong học kỳ này.');
    } catch (requestError) {
      setFeedback(requestError instanceof Error ? requestError.message : 'Không thể đổi tên chương.');
    } finally {
      setPublishing(false);
    }
  };

  const removeChapter = async (chapterName: string) => {
    if (!selectedClass) return;
    const firstConfirmation = window.confirm(
      `Xóa chương "${chapterName}" khỏi lớp ${selectedClass.code}, môn ${selectedSubject}, ${semester}? Toàn bộ bài giảng và tệp trong chương sẽ bị xóa.`,
    );
    if (!firstConfirmation) return;
    const secondConfirmation = window.confirm(
      `Xác nhận lần cuối: xóa vĩnh viễn chương "${chapterName}" cùng tất cả bài giảng và tệp của chương? Thao tác này không thể hoàn tác.`,
    );
    if (!secondConfirmation) return;
    setPublishing(true);
    setFeedback('');
    try {
      await deleteClassLearningResourceChapter(selectedClass.id, chapterName, {
        academicYear: selectedClass.academic_year,
        semester,
        subject: selectedSubject,
      });
      setReviewResources((current) => current.filter((resource) =>
        !(resource.semester === semester && resource.chapter === chapterName)));
      setExpandedReviewChapters((current) => {
        const next = new Set(current);
        next.delete(chapterName);
        return next;
      });
      setSelectedReviewId(null);
      setEditingChapterName(null);
      setFeedback(`Đã xóa chương "${chapterName}" cùng các bài giảng và tệp thuộc chương.`);
    } catch (requestError) {
      setFeedback(requestError instanceof Error ? requestError.message : 'Không thể xóa chương.');
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

      <div className="mb-3 flex shrink-0 gap-1 rounded-xl border border-blue-100 bg-white p-1 shadow-sm" role="tablist" aria-label="Quản lý bài giảng">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'create'}
          onClick={() => setActiveTab('create')}
          className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${activeTab === 'create' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-blue-50'}`}
        >
          <CloudUpload className="h-4 w-4" /> Đăng tài liệu / bài tập
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'review'}
          onClick={() => setActiveTab('review')}
          className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${activeTab === 'review' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-blue-50'}`}
        >
          <Eye className="h-4 w-4" /> Kiểm tra bài giảng
        </button>
      </div>

      {activeTab === 'create' && (
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
                  placeholder={contentType === 'assignment'
                    ? 'Nhập nội dung hoặc câu hỏi bài tập tại đây...'
                    : 'Nhập hoặc dán nội dung tài liệu tại đây...'}
                  rows={5}
                  className="input-field min-h-28 resize-y text-sm"
                  aria-label={contentType === 'assignment' ? 'Nội dung bài tập' : 'Nội dung tài liệu'}
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
                  <input ref={fileInputRef} type="file" accept={acceptedTypes} className="hidden" onChange={onFileInput} />
                  <p className="mt-2 text-[10px] text-slate-500">Tệp sẽ được lưu cùng bài giảng để học sinh trong lớp truy cập.</p>
                </div>
                {filePreviewUrl && (
                  <img src={filePreviewUrl} alt="Xem trước tệp ảnh đã chọn" className="mx-auto mt-2 max-h-40 max-w-full rounded-lg border border-slate-200 object-contain" />
                )}
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
                {creatingChapter ? (
                  <span className="mt-1 flex gap-1">
                    <input
                      autoFocus
                      value={chapter}
                      onChange={(event) => setChapter(event.target.value)}
                      maxLength={160}
                      placeholder="Nhập tên chương mới"
                      className="input-field h-9 min-w-0 flex-1 px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => { setCreatingChapter(false); setChapter(''); }}
                      className="shrink-0 rounded-md border border-slate-200 px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Chọn chương
                    </button>
                  </span>
                ) : (
                  <select
                    value={availableChapters.includes(chapter) ? chapter : ''}
                    onChange={(event) => {
                      if (event.target.value === '__create_chapter__') {
                        setCreatingChapter(true);
                        setChapter('');
                      } else {
                        setChapter(event.target.value);
                      }
                    }}
                    className="input-field mt-1 h-9 w-full px-2.5 py-1.5 text-xs"
                  >
                    <option value="">Chọn chương</option>
                    {availableChapters.map((item) => <option key={item} value={item}>{item}</option>)}
                    <option value="__create_chapter__">+ Tạo chương mới</option>
                  </select>
                )}
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
              <label className="block text-[11px] font-semibold text-slate-600">{contentType === 'lesson' ? 'Nội dung / Lời nhắn' : 'Lời nhắn bổ sung'} <span className="font-normal text-slate-400">(tùy chọn)</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={contentType === 'lesson' ? 'Lời nhắn cho học sinh...' : 'Lời nhắn riêng cho học sinh...'} maxLength={500} rows={1} className="input-field mt-1 h-9 min-h-0 resize-y px-2.5 py-1.5 text-xs" />
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
                const { color, Icon } = fileKind(entry.kind === 'assignment' ? 'exercise.txt' : entry.fileName ?? entry.title);
                return (
                  <article key={entry.id} className="flex items-center gap-1.5 py-2">
                    <span className={`${color} flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white`}><Icon className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-semibold leading-4 text-slate-800">{entry.title}</p>
                      <p className="truncate text-[9px] leading-3 text-slate-400">
                        {entry.kind === 'assignment' && (!entry.chapter.trim() || !entry.lesson.trim())
                          ? 'Bài tập tự do'
                          : `${entry.kind === 'lesson' ? 'Bài giảng' : 'Bài tập'} · ${entry.chapter} · ${entry.lesson}${entry.period ? ` · ${entry.period}` : ''}`}
                      </p>
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
      )}

      {activeTab === 'review' && (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex min-w-0 shrink-0 flex-nowrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 sm:px-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900" title={`${selectedSubject || 'Bài giảng'}${selectedClass ? ` · ${selectedClass.code}` : ''}`}>
                {selectedSubject || 'Bài giảng'}{selectedClass ? ` · ${selectedClass.code}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-nowrap items-center gap-1">
              <select
                aria-label="Lớp cần kiểm tra"
                value={selectedClass?.id ?? ''}
                onChange={(event) => {
                  setSelectedClasses(event.target.value ? [event.target.value] : []);
                  setSelectedReviewId(null);
                  setSelectedReviewAssignmentId(null);
                  setEditingReview(false);
                }}
                className="input-field min-h-9 w-20 px-2 text-xs"
              >
                {classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.code}</option>)}
              </select>
              {subjects.length > 1 && (
                <select
                  aria-label="Môn học cần kiểm tra"
                  value={selectedSubject}
                  onChange={(event) => {
                    setSelectedSubject(event.target.value);
                    setSelectedReviewId(null);
                    setSelectedReviewAssignmentId(null);
                    setEditingReview(false);
                  }}
                  className="input-field min-h-9 w-24 px-2 text-xs"
                >
                  {subjects.map((item) => <option key={item}>{item}</option>)}
                </select>
              )}
              <select
                aria-label="Học kỳ cần kiểm tra"
                value={semester}
                onChange={(event) => {
                  setSemester(event.target.value);
                  setSelectedReviewId(null);
                  setSelectedReviewAssignmentId(null);
                  setEditingReview(false);
                }}
                className="input-field min-h-9 w-20 px-2 text-xs"
              >
                <option>Kỳ 1</option><option>Kỳ 2</option>
              </select>
            </div>
          </header>
          <div className="grid min-h-0 flex-1 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto border-b border-slate-200 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r sm:p-5">
              <div className="mb-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Nội dung học sinh">
                <button
                  type="button"
                  role="tab"
                  aria-selected={reviewPreviewTab === 'lesson'}
                  onClick={() => setReviewPreviewTab('lesson')}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${
                    reviewPreviewTab === 'lesson' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <BookOpen className="h-4 w-4" /> Bài giảng
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={reviewPreviewTab === 'assignment'}
                  onClick={() => setReviewPreviewTab('assignment')}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${
                    reviewPreviewTab === 'assignment' ? 'bg-rose-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Clock3 className="h-4 w-4" /> Bài tập
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                    reviewPreviewTab === 'assignment' ? 'bg-white/20' : 'bg-rose-50 text-rose-700'
                  }`}>{visibleReviewAssignments.length}</span>
                </button>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                {reviewPreviewTab === 'lesson'
                  ? 'Xem trước theo đúng bố cục học sinh nhìn thấy.'
                  : 'Chỉ hiển thị bài học sinh còn có thể xem và nộp.'}
              </p>
              {reviewPreviewTab === 'lesson' && (loadingRecent ? <p className="py-3 text-sm text-slate-500">Đang tải bài giảng...</p> : reviewChapterGroups.length ? (
                <nav aria-label="Danh sách bài giảng để xem trước" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 overflow-x-hidden">
                  {reviewChapterGroups.map(({ chapter: chapterName, lessons }) => {
                    const chapterExpanded = expandedReviewChapters.has(chapterName);
                    return (
                      <section key={chapterName} className="group min-w-0 border-b border-slate-200/80 pb-1">
                        <div className="flex min-h-10 min-w-0 items-center gap-1">
                          {editingChapterName === chapterName ? (
                            <>
                              <input
                                autoFocus
                                value={chapterNameDraft}
                                onChange={(event) => setChapterNameDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') void saveChapterName(chapterName);
                                  if (event.key === 'Escape') setEditingChapterName(null);
                                }}
                                maxLength={160}
                                aria-label={`Tên mới cho ${chapterName}`}
                                className="input-field min-h-9 min-w-0 flex-1 px-2 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => void saveChapterName(chapterName)}
                                disabled={publishing}
                                aria-label="Lưu tên chương"
                                className="rounded p-1.5 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingChapterName(null)}
                                disabled={publishing}
                                aria-label="Hủy sửa tên chương"
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                aria-expanded={chapterExpanded}
                                onClick={() => setExpandedReviewChapters((current) => {
                                  const next = new Set(current);
                                  if (next.has(chapterName)) next.delete(chapterName);
                                  else next.add(chapterName);
                                  return next;
                                })}
                                className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-2 text-left text-sm font-extrabold uppercase tracking-wide text-slate-800 hover:bg-white"
                              >
                                <span className="min-w-0 flex-1 truncate" title={chapterName}>{chapterName}</span>
                                {chapterExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                              </button>
                              <div
                                className="relative shrink-0"
                                onBlur={(event) => {
                                  if (!(event.relatedTarget instanceof Node)
                                    || !event.currentTarget.contains(event.relatedTarget)) {
                                    setOpenChapterMenu(null);
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Escape') setOpenChapterMenu(null);
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => setOpenChapterMenu((current) =>
                                    current === chapterName ? null : chapterName)}
                                  aria-label={`Tùy chọn chương ${chapterName}`}
                                  aria-expanded={openChapterMenu === chapterName}
                                  title="Tùy chọn chương"
                                  className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                                {openChapterMenu === chapterName && (
                                  <div
                                    className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
                                    aria-label={`Tùy chọn chương ${chapterName}`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setChapterNameDraft(chapterName);
                                        setEditingChapterName(chapterName);
                                        setOpenChapterMenu(null);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                                    >
                                      <Pencil className="h-4 w-4" />
                                      Sửa tên chương
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenChapterMenu(null);
                                        void removeChapter(chapterName);
                                      }}
                                      disabled={publishing}
                                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Xóa chương
                                    </button>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        {chapterExpanded && (
                          <div className="min-w-0 space-y-1 pl-3">
                            {lessons.map(({ lesson: lessonName, resources }) => {
                              const lessonKey = `${chapterName}:${lessonName}`;
                              const lessonExpanded = expandedReviewLessons.has(lessonKey);
                              return (
                                <section key={lessonKey} className="min-w-0">
                                  <button
                                    type="button"
                                    aria-expanded={lessonExpanded}
                                    onClick={() => setExpandedReviewLessons((current) => {
                                      const next = new Set(current);
                                      if (next.has(lessonKey)) next.delete(lessonKey);
                                      else next.add(lessonKey);
                                      return next;
                                    })}
                                    className="flex min-h-9 min-w-0 w-full items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm font-bold text-slate-700 hover:bg-white"
                                  >
                                    <span className="min-w-0 flex-1 truncate" title={lessonName}>{lessonName}</span>
                                    {lessonExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                                  </button>
                                  {lessonExpanded && (
                                    <ul className="min-w-0 space-y-1 overflow-x-hidden pb-1 pl-3">
                                      {resources.map((resource) => {
                                        const file = resource.files[0];
                                        const ResourceIcon = resourceFileIcon(file?.name ?? resource.title);
                                        return (
                                          <li key={resource.id} className="min-w-0">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedReviewId(resource.id);
                                                setSelectedReviewAssignmentId(null);
                                                setEditingReview(false);
                                              }}
                                              className={`flex min-h-10 min-w-0 w-full items-start gap-2 overflow-hidden rounded-md border-l-2 px-2 py-1.5 text-left text-xs ${
                                                selectedReviewResource?.id === resource.id
                                                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                                                  : 'border-transparent text-slate-600 hover:bg-white'
                                              }`}
                                            >
                                              <ResourceIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                                              <span className="min-w-0 flex-1">
                                                <span className="block truncate font-semibold" title={resource.title}>{resource.title}</span>
                                                {file && <span className="mt-0.5 block truncate text-[11px]" title={file.name}>{file.name}</span>}
                                                {resource.period && <span className="mt-0.5 block truncate text-[11px] text-slate-500">{resource.period}</span>}
                                              </span>
                                            </button>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </section>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </nav>
              ) : <p className="py-3 text-sm text-slate-500">{selectedClass ? 'Chưa có bài giảng trong học kỳ này.' : 'Chọn lớp để xem bài giảng.'}</p>)}
              {reviewPreviewTab === 'assignment' && (loadingRecent ? (
                <p className="py-3 text-sm text-slate-500">Đang tải bài tập...</p>
              ) : reviewAssignmentGroups.length ? (
                <nav aria-label="Bài tập hiển thị cho học sinh" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 overflow-x-hidden">
                  {reviewAssignmentGroups.map(({ chapter: chapterName, lessons, isFree }) => {
                    const chapterKey = `preview-assignment:${chapterName}`;
                    const chapterExpanded = expandedReviewChapters.has(chapterKey);
                    return (
                      <section
                        key={chapterKey}
                        className={`min-w-0 rounded-lg border pb-1 ${
                          isFree ? 'mb-2 border-rose-200 bg-rose-50/70 px-1' : 'border-x-0 border-t-0 border-slate-200/80'
                        }`}
                      >
                        <button
                          type="button"
                          aria-expanded={chapterExpanded}
                          onClick={() => setExpandedReviewChapters((current) => {
                            const next = new Set(current);
                            if (next.has(chapterKey)) next.delete(chapterKey);
                            else next.add(chapterKey);
                            return next;
                          })}
                          className={`flex min-h-10 min-w-0 w-full items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-2 text-left text-xs font-extrabold uppercase tracking-wide ${
                            isFree ? 'text-rose-800 hover:bg-rose-100' : 'text-slate-800 hover:bg-white'
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate" title={chapterName}>{chapterName}</span>
                          {chapterExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        </button>
                        {chapterExpanded && (
                          <div className="min-w-0 space-y-1 pl-3">
                            {lessons.map(({ lesson: lessonName, assignments: lessonAssignments }) => {
                              const lessonKey = `${chapterKey}:${lessonName}`;
                              const lessonExpanded = expandedReviewLessons.has(lessonKey);
                              return (
                                <section key={lessonKey} className="min-w-0">
                                  {!isFree && (
                                    <button
                                      type="button"
                                      aria-expanded={lessonExpanded}
                                      onClick={() => setExpandedReviewLessons((current) => {
                                        const next = new Set(current);
                                        if (next.has(lessonKey)) next.delete(lessonKey);
                                        else next.add(lessonKey);
                                        return next;
                                      })}
                                      className="flex min-h-8 min-w-0 w-full items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-white"
                                    >
                                      <span className="min-w-0 flex-1 truncate" title={lessonName}>{lessonName}</span>
                                      {lessonExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                                    </button>
                                  )}
                                  {(isFree || lessonExpanded) && (
                                    <ul className="min-w-0 space-y-1 overflow-x-hidden pb-1 pl-3">
                                      {lessonAssignments.map((assignment) => (
                                        <li key={assignment.id} className="min-w-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedReviewAssignmentId(assignment.id);
                                              setSelectedReviewId(null);
                                              setEditingReview(false);
                                            }}
                                            className={`flex min-h-9 min-w-0 w-full items-start gap-2 overflow-hidden rounded-md border-l-2 px-2 py-1.5 text-left text-xs ${
                                              selectedReviewAssignment?.id === assignment.id
                                                ? 'border-rose-500 bg-rose-50 text-rose-900'
                                                : 'border-transparent text-slate-600 hover:bg-white'
                                            }`}
                                          >
                                            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                                            <span className="min-w-0 flex-1 truncate font-semibold" title={assignment.title}>{assignment.title}</span>
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </section>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </nav>
              ) : <p className="py-3 text-sm text-slate-500">{selectedClass ? 'Không có bài tập còn hạn trong học kỳ này.' : 'Chọn lớp để xem bài tập.'}</p>)}
            </aside>
            <article className="min-h-0 overflow-y-auto p-5 sm:p-8">
              {reviewPreviewTab === 'assignment' && selectedReviewAssignment ? (
                <div className="mx-auto max-w-4xl">
                  <p className="text-sm font-semibold text-rose-700">
                    {selectedReviewAssignment.chapter.trim() && selectedReviewAssignment.lesson.trim()
                      ? `${selectedReviewAssignment.chapter} · ${selectedReviewAssignment.lesson}`
                      : 'Bài tập tự do'}
                  </p>
                  <h1 className="mt-2 break-words text-2xl font-bold text-slate-950">{selectedReviewAssignment.title}</h1>
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                    <Clock3 className="h-4 w-4" /> Hạn nộp: {new Date(selectedReviewAssignment.dueAt).toLocaleString('vi-VN')}
                  </p>
                  <div className="mt-6 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-base leading-7 text-slate-700">
                    {selectedReviewAssignment.description}
                  </div>
                </div>
              ) : reviewPreviewTab === 'lesson' && selectedReviewResource ? (
                <>
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-blue-700">
                        {selectedReviewResource.subject} · {selectedClass?.code} · Học kỳ {selectedReviewResource.semester.replace('Kỳ ', '')}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-600">
                        {selectedReviewResource.chapter} · {selectedReviewResource.lesson}{selectedReviewResource.period ? ` · ${selectedReviewResource.period}` : ''}
                      </p>
                      <h1 className="mt-2 break-words text-2xl font-bold text-slate-950">{selectedReviewResource.title}</h1>
                    </div>
                    {!editingReview ? (
                      <button
                        type="button"
                        onClick={() => setEditingReview(true)}
                        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        <Edit3 className="h-4 w-4" /> Chỉnh sửa
                      </button>
                    ) : (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReviewDraft({
                              title: selectedReviewResource.title,
                              chapter: selectedReviewResource.chapter,
                              lesson: selectedReviewResource.lesson,
                              period: selectedReviewResource.period ?? '',
                              content: selectedReviewResource.content,
                              note: selectedReviewResource.note,
                              fileName: selectedReviewResource.files[0]?.name ?? '',
                            });
                            setReplacementFile(null);
                            setEditingReview(false);
                          }}
                          disabled={publishing}
                          className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveReviewedLesson()}
                          disabled={publishing}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" /> {publishing ? 'Đang đăng lại...' : 'Đăng lại'}
                        </button>
                      </div>
                    )}
                  </div>

                  {editingReview ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {([
                          ['title', 'Tên bài giảng'],
                          ['chapter', 'Chương'],
                          ['lesson', 'Bài'],
                          ['period', 'Tiết (nếu có)'],
                        ] as const).map(([field, label]) => (
                          <label key={field} className="block text-sm font-semibold text-slate-700">{label}
                            <input
                              value={reviewDraft[field]}
                              onChange={(event) => setReviewDraft((current) => ({ ...current, [field]: event.target.value }))}
                              maxLength={field === 'title' ? 200 : field === 'chapter' ? 160 : field === 'lesson' ? 200 : 80}
                              className="input-field mt-1 min-h-10 px-3 text-sm"
                            />
                          </label>
                        ))}
                      </div>
                      {selectedReviewResource.files[0] && (
                        <label className="block text-sm font-semibold text-slate-700">Tên tệp hiển thị
                          <input
                            value={reviewDraft.fileName}
                            onChange={(event) => setReviewDraft((current) => ({ ...current, fileName: event.target.value }))}
                            maxLength={255}
                            className="input-field mt-1 min-h-10 px-3 text-sm"
                          />
                          <span className="mt-1 block text-xs font-normal text-slate-500">Có thể sửa tên tệp nếu ký tự tiếng Việt hiển thị sai.</span>
                        </label>
                      )}
                      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h2 className="text-sm font-semibold text-slate-800">Tệp đính kèm</h2>
                        {replacementFileUrl && replacementFile?.type.startsWith('image/') && (
                          <img src={replacementFileUrl} alt="Xem trước ảnh thay thế" className="mt-3 max-h-64 max-w-full rounded-lg object-contain" />
                        )}
                        {!replacementFile && reviewFileUrl && selectedReviewResource.files[0]?.mediaType.startsWith('image/') && (
                          <img src={reviewFileUrl} alt={selectedReviewResource.title} className="mt-3 max-h-64 max-w-full rounded-lg object-contain" />
                        )}
                        {!replacementFile && reviewFileUrl && selectedReviewResource.files[0]?.mediaType === 'video/mp4' && (
                          <video controls src={reviewFileUrl} className="mt-3 max-h-64 max-w-full rounded-lg" />
                        )}
                        <input
                          ref={reviewFileInputRef}
                          type="file"
                          accept={acceptedTypes}
                          className="hidden"
                          onChange={(event) => {
                            const selected = event.target.files?.[0];
                            event.target.value = '';
                            if (!selected) return;
                            const extension = selected.name.split('.').pop()?.toLowerCase() ?? '';
                            if (selected.size > maxFileSize || !acceptedExtensions.has(extension)) {
                              setFeedback('Tệp không đúng định dạng hỗ trợ hoặc vượt quá giới hạn 50 MB.');
                              return;
                            }
                            setFeedback('');
                            setReplacementFile(selected);
                            if (selectedReviewResource.files.length) {
                              setReviewDraft((current) => ({ ...current, fileName: selected.name }));
                            }
                          }}
                        />
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => reviewFileInputRef.current?.click()}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            <Upload className="h-4 w-4" /> {replacementFile ? 'Chọn tệp khác' : selectedReviewResource.files.length ? 'Thay tệp đính kèm' : 'Đính kèm tệp'}
                          </button>
                          <span className="min-w-0 break-all text-xs text-slate-600">
                            {replacementFile?.name ?? selectedReviewResource.files[0]?.name ?? 'Chưa có tệp đính kèm'}
                          </span>
                          {replacementFile && (
                            <button type="button" onClick={() => setReplacementFile(null)} className="text-xs font-semibold text-rose-600 hover:underline">
                              Bỏ thay thế
                            </button>
                          )}
                        </div>
                        {replacementFile && !replacementFile.type.startsWith('image/') && (
                          <p className="mt-2 text-xs text-slate-500">Tệp mới sẽ thay tệp hiện tại khi nhấn “Đăng lại”.</p>
                        )}
                      </section>
                      <label className="block text-sm font-semibold text-slate-700">Lời nhắn cho học sinh
                        <textarea
                          value={reviewDraft.note}
                          onChange={(event) => setReviewDraft((current) => ({ ...current, note: event.target.value }))}
                          maxLength={500}
                          rows={2}
                          className="input-field mt-1 resize-y text-sm"
                        />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">Nội dung bài giảng
                        <textarea
                          value={reviewDraft.content}
                          onChange={(event) => setReviewDraft((current) => ({ ...current, content: event.target.value }))}
                          maxLength={50000}
                          rows={12}
                          className="input-field mt-1 min-h-56 resize-y whitespace-pre-wrap text-sm leading-6"
                        />
                      </label>
                      <p className="text-xs text-slate-500">Tệp hiện tại được giữ nguyên nếu không chọn tệp thay thế. Nhấn “Đăng lại” để học sinh thấy bản cập nhật.</p>
                    </div>
                  ) : (
                    <>
                      {selectedReviewResource.note && <p className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">{selectedReviewResource.note}</p>}
                      {selectedReviewResource.files[0] && (
                        <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <h2 className="break-all text-sm font-semibold text-slate-800">{selectedReviewResource.files[0].name}</h2>
                          {reviewFileLoading && <p className="mt-3 text-sm text-slate-500">Đang tải tệp...</p>}
                          {reviewFileError && <p role="alert" className="mt-3 text-sm text-rose-700">{reviewFileError}</p>}
                          {reviewFileUrl && selectedReviewResource.files[0].mediaType.startsWith('image/') && (
                            <img src={reviewFileUrl} alt={selectedReviewResource.title} className="mt-3 max-h-[70vh] max-w-full rounded-lg object-contain" />
                          )}
                          {reviewFileUrl && selectedReviewResource.files[0].mediaType === 'video/mp4' && (
                            <video controls src={reviewFileUrl} className="mt-3 max-h-[70vh] max-w-full rounded-lg" />
                          )}
                          {reviewFileUrl && (
                            <a href={reviewFileUrl} download={selectedReviewResource.files[0].name} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
                              <Download className="h-4 w-4" /> Tải tệp về
                            </a>
                          )}
                        </section>
                      )}
                      {selectedReviewResource.content
                        ? <section className="whitespace-pre-wrap text-base leading-7 text-slate-700">{selectedReviewResource.content}</section>
                        : !selectedReviewResource.files.length && <p className="text-sm text-slate-500">Bài giảng chưa có nội dung.</p>}
                    </>
                  )}
                </>
              ) : <div className="flex h-full min-h-48 items-center justify-center text-center text-sm text-slate-500">
                {loadingRecent
                  ? 'Đang tải nội dung...'
                  : reviewPreviewTab === 'assignment'
                    ? 'Không có bài tập còn hạn trong học kỳ này.'
                    : 'Chọn bài giảng ở danh sách bên trái để xem trước.'}
              </div>}
            </article>
          </div>
        </section>
      )}
    </section>
  );
}
