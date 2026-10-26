import { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  Clock3,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo2,
  Presentation,
  Search,
  Send,
} from 'lucide-react';
import { getSavedItems, saveItem } from './savedItems';
import {
  downloadClassLearningResourceFile,
  listStudentAssignments,
  listStudentLearningResources,
  submitAssignment,
  type StudentAssignment,
  type StudentLearningResource,
} from '@/api/schoolApi';

interface MyClassesProps {
  onOpenSchedule: () => void;
  initialSubjectCode: string | null;
  initialSubjectView: 'lessons' | 'assignments' | null;
  initialSubjectTopic: string | null;
}

type Semester = 'Kỳ 1' | 'Kỳ 2';
type LearningGroup = {
  key: string;
  classId: string;
  className: string;
  classCode: string;
  subject: string;
  academicYear: string;
  teacherName: string;
  resources: StudentLearningResource[];
  assignments: StudentAssignment[];
};

type ChapterGroup = {
  chapter: string;
  lessons: Array<{ lesson: string; resources: StudentLearningResource[] }>;
};

type AssignmentChapterGroup = {
  chapter: string;
  isFree?: boolean;
  lessons: Array<{ lesson: string; assignments: StudentAssignment[] }>;
};

function resourceFileIcon(title: string) {
  const extension = title.match(/\.([a-z0-9]+)$/i)?.[1]?.toLocaleLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension ?? '')) return FileImage;
  if (['mp4', 'mov', 'webm', 'm4v'].includes(extension ?? '')) return FileVideo2;
  if (['ppt', 'pptx', 'odp'].includes(extension ?? '')) return Presentation;
  if (['xls', 'xlsx', 'csv', 'ods'].includes(extension ?? '')) return FileSpreadsheet;
  return FileText;
}

function displaySemester(value: string): Semester {
  return value === 'Kỳ 2' ? 'Kỳ 2' : 'Kỳ 1';
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function isAssignmentPastDue(assignment: StudentAssignment, now = Date.now()) {
  return now > new Date(assignment.dueAt).getTime();
}

function assignmentStatus(assignment: StudentAssignment, now = Date.now()) {
  if (assignment.score !== null) return `Đã chấm · ${assignment.score}/10`;
  if (assignment.submittedAt) return 'Đã làm';
  return isAssignmentPastDue(assignment, now) ? 'Quá hạn nộp bài' : 'Chưa làm';
}

function canEditAssignment(assignment: StudentAssignment, now = Date.now()) {
  return !isAssignmentPastDue(assignment, now) && assignment.score === null;
}

function normalizeSubjectName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('vi').replace(/[^A-Z0-9]/g, '');
}

export function MyClasses({
  onOpenSchedule,
  initialSubjectCode,
  initialSubjectView,
  initialSubjectTopic,
}: MyClassesProps) {
  const [resources, setResources] = useState<StudentLearningResource[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [semester, setSemester] = useState<Semester>('Kỳ 1');
  const [activeTab, setActiveTab] = useState<'lesson' | 'assignment'>(
    () => initialSubjectView === 'assignments' ? 'assignment' : 'lesson',
  );
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resourceFileUrl, setResourceFileUrl] = useState<string | null>(null);
  const [resourceFileLoading, setResourceFileLoading] = useState(false);
  const [resourceFileError, setResourceFileError] = useState('');
  const [savedResourceIds, setSavedResourceIds] = useState(
    () => new Set(getSavedItems().filter((item) => item.type === 'resource').map((item) => item.id)),
  );

  const refresh = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [nextResources, nextAssignments] = await Promise.all([
        listStudentLearningResources(),
        listStudentAssignments(),
      ]);
      setResources(nextResources);
      setAssignments(nextAssignments);
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : 'Không thể tải tài liệu lớp học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const groups = useMemo(() => {
    const grouped = new Map<string, LearningGroup>();
    const ensureGroup = (item: StudentLearningResource | StudentAssignment) => {
      const key = `${item.classId}:${item.subject}:${item.academicYear}`;
      const group = grouped.get(key) ?? {
        key,
        classId: item.classId,
        className: item.className,
        classCode: item.classCode,
        subject: item.subject,
        academicYear: item.academicYear,
        teacherName: item.teacherName,
        resources: [],
        assignments: [],
      };
      if (!group.teacherName && item.teacherName) group.teacherName = item.teacherName;
      grouped.set(key, group);
      return group;
    };
    resources.forEach((resource) => ensureGroup(resource).resources.push(resource));
    assignments.forEach((assignment) => ensureGroup(assignment).assignments.push(assignment));
    return Array.from(grouped.values()).sort((first, second) =>
      first.classCode.localeCompare(second.classCode, 'vi') || first.subject.localeCompare(second.subject, 'vi'));
  }, [assignments, resources]);

  useEffect(() => {
    if (!selectedGroupKey && initialSubjectCode) {
      const subjectCode = normalizeSubjectName(initialSubjectCode).replace(/\d+$/, '');
      const match = groups.find((group) => {
        const subjectName = normalizeSubjectName(group.subject);
        return group.subject.toLocaleLowerCase('vi').includes(initialSubjectCode.toLocaleLowerCase('vi'))
          || (subjectCode.length >= 3 && subjectName.startsWith(subjectCode));
      });
      if (match) {
        setSelectedGroupKey(match.key);
        if (initialSubjectView === 'assignments') {
          setActiveTab('assignment');
          const assignment = match.assignments.find((item) => item.semester === semester && !item.submittedAt);
          setSelectedAssignmentId(assignment?.id ?? null);
        } else {
          setActiveTab('lesson');
          const resource = match.resources.find((item) =>
            displaySemester(item.semester) === semester
            && (!initialSubjectTopic
              || `${item.title} ${item.chapter} ${item.lesson}`.toLocaleLowerCase('vi')
                .includes(initialSubjectTopic.toLocaleLowerCase('vi'))));
          setSelectedResourceId(resource?.id ?? null);
        }
      }
    }
  }, [groups, initialSubjectCode, initialSubjectTopic, initialSubjectView, selectedGroupKey, semester]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi');
    return groups.filter((group) =>
      `${group.classCode} ${group.className} ${group.subject} ${group.teacherName}`
        .toLocaleLowerCase('vi').includes(normalizedQuery));
  }, [groups, query]);
  const selectedGroup = groups.find((group) => group.key === selectedGroupKey) ?? null;
  const visibleResources = useMemo(
    () => selectedGroup?.resources.filter((resource) => displaySemester(resource.semester) === semester) ?? [],
    [selectedGroup, semester],
  );
  const chapterGroups = useMemo(() => {
    const chapters = new Map<string, Map<string, StudentLearningResource[]>>();
    visibleResources.forEach((resource) => {
      const chapter = chapters.get(resource.chapter) ?? new Map<string, StudentLearningResource[]>();
      const lessons = chapter.get(resource.lesson) ?? [];
      lessons.push(resource);
      chapter.set(resource.lesson, lessons);
      chapters.set(resource.chapter, chapter);
    });
    return Array.from(chapters.entries())
      .map(([chapter, lessons]): ChapterGroup => ({
        chapter,
        lessons: Array.from(lessons.entries())
          .map(([lesson, items]) => ({ lesson, resources: items }))
          .sort((first, second) => first.lesson.localeCompare(second.lesson, 'vi', { numeric: true })),
      }))
      .sort((first, second) => first.chapter.localeCompare(second.chapter, 'vi', { numeric: true }));
  }, [visibleResources]);
  const visibleAssignments = useMemo(
    () => selectedGroup?.assignments.filter((assignment) =>
      assignment.semester === semester) ?? [],
    [selectedGroup, semester],
  );
  const assignmentChapterGroups = useMemo(() => {
    const chapters = new Map<string, Map<string, StudentAssignment[]>>();
    const freeAssignments: StudentAssignment[] = [];
    visibleAssignments.forEach((assignment) => {
      if (!assignment.chapter.trim() || !assignment.lesson.trim()) {
        freeAssignments.push(assignment);
        return;
      }
      const chapter = chapters.get(assignment.chapter) ?? new Map<string, StudentAssignment[]>();
      const lessons = chapter.get(assignment.lesson) ?? [];
      lessons.push(assignment);
      chapter.set(assignment.lesson, lessons);
      chapters.set(assignment.chapter, chapter);
    });
    const groups = Array.from(chapters.entries())
      .map(([chapter, lessons]): AssignmentChapterGroup => ({
        chapter,
        lessons: Array.from(lessons.entries())
          .map(([lesson, items]) => ({ lesson, assignments: items }))
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
  }, [visibleAssignments]);
  const selectedResource = visibleResources.find((resource) => resource.id === selectedResourceId) ?? visibleResources[0] ?? null;
  const selectedAssignment = visibleAssignments.find((assignment) => assignment.id === selectedAssignmentId)
    ?? visibleAssignments[0]
    ?? null;
  const selectedResourceIdForFile = selectedResource?.id;
  const selectedFileId = selectedResource?.files[0]?.id;

  useEffect(() => {
    if (!selectedResourceIdForFile || !selectedFileId) {
      setResourceFileUrl(null);
      setResourceFileError('');
      setResourceFileLoading(false);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    setResourceFileUrl(null);
    setResourceFileError('');
    setResourceFileLoading(true);
    downloadClassLearningResourceFile(selectedResourceIdForFile, selectedFileId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setResourceFileUrl(objectUrl);
      })
      .catch((downloadError) => {
        if (active) setResourceFileError(downloadError instanceof Error ? downloadError.message : 'Không thể tải tệp đính kèm.');
      })
      .finally(() => {
        if (active) setResourceFileLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedResourceIdForFile, selectedFileId]);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (selectedResource) {
      setExpandedChapters((current) => new Set(current).add(selectedResource.chapter));
      setExpandedLessons((current) => new Set(current).add(`${selectedResource.chapter}:${selectedResource.lesson}`));
    }
  }, [selectedResource]);

  useEffect(() => {
    if (selectedAssignment) {
      const chapterKey = `assignment:${selectedAssignment.chapter}`;
      setExpandedChapters((current) => new Set(current).add(chapterKey));
      setExpandedLessons((current) => new Set(current).add(`${chapterKey}:${selectedAssignment.lesson}`));
    }
  }, [selectedAssignment]);
  useEffect(() => {
    setResponseText(selectedAssignment?.responseText ?? '');
  }, [selectedAssignment]);
  const allPendingAssignments = assignments.filter((assignment) => assignment.submittedAt === null);
  const submittedAssignments = assignments.filter((assignment) => assignment.submittedAt !== null);

  const openGroup = (group: LearningGroup, view: 'lesson' | 'assignment') => {
    setSelectedGroupKey(group.key);
    setActiveTab(view);
    const matchingResources = group.resources.filter((item) => displaySemester(item.semester) === semester);
    const matchingAssignments = group.assignments.filter((item) => item.semester === semester);
    if (view === 'assignment' && matchingAssignments.length) {
      setSelectedAssignmentId(matchingAssignments[0].id);
      setSelectedResourceId(null);
      setResponseText(matchingAssignments[0].responseText ?? '');
    } else {
      setSelectedResourceId(matchingResources[0]?.id ?? null);
      setSelectedAssignmentId(null);
    }
    if (initialSubjectTopic) {
      const resourceMatch = matchingResources.find((item) =>
        `${item.title} ${item.chapter} ${item.lesson}`.toLocaleLowerCase('vi')
          .includes(initialSubjectTopic.toLocaleLowerCase('vi')));
      if (resourceMatch) setSelectedResourceId(resourceMatch.id);
    }
  };

  const handleSaveResource = (resource: StudentLearningResource) => {
    if (savedResourceIds.has(resource.id)) return;
    try {
      saveItem({
        id: resource.id,
        type: 'resource',
        title: resource.title,
        subject: resource.subject,
        savedAt: new Date().toISOString(),
      });
      setSavedResourceIds((current) => new Set(current).add(resource.id));
      setSubmitError('');
    } catch (saveError) {
      setSubmitError(saveError instanceof Error ? saveError.message : 'Không thể lưu tài liệu.');
    }
  };

  const toggleExpandedChapter = (chapter: string) => {
    setExpandedChapters((current) => {
      const next = new Set(current);
      if (next.has(chapter)) next.delete(chapter);
      else next.add(chapter);
      return next;
    });
  };

  const toggleExpandedLesson = (chapter: string, lesson: string) => {
    const key = `${chapter}:${lesson}`;
    setExpandedLessons((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmitAssignment = async () => {
    if (!selectedAssignment || !responseText.trim() || !canEditAssignment(selectedAssignment, currentTime)) {
      setSubmitError('Nhập câu trả lời trước khi nộp bài.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitAssignment(selectedAssignment.id, responseText.trim());
      await refresh();
    } catch (requestError) {
      setSubmitError(requestError instanceof Error ? requestError.message : 'Không thể nộp bài tập.');
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedGroup) {
    return (
      <section className="animate-fadeIn overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setSelectedGroupKey(null)} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-blue-700">
              <ChevronLeft className="h-5 w-5" /> Lớp học
            </button>
            <span className="h-6 border-l border-slate-200" />
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-900">{selectedGroup.subject} · {selectedGroup.classCode}</p>
              <p className="truncate text-sm text-slate-500">{selectedGroup.className} · {selectedGroup.teacherName}</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <span>Học kỳ</span>
            <select className="input-field min-h-11 min-w-36 px-3" value={semester} onChange={(event) => {
              setSemester(event.target.value as Semester);
              setSelectedResourceId(null);
              setSelectedAssignmentId(null);
            }}>
              <option value="Kỳ 1">Học kỳ 1</option>
              <option value="Kỳ 2">Học kỳ 2</option>
            </select>
          </label>
        </header>
        <div className="grid min-h-[min(72vh,760px)] lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-w-0 overflow-x-hidden border-b border-slate-200 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r sm:p-5">
            <div className="mb-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Nội dung lớp học">
              <button
                id="student-lessons-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === 'lesson'}
                aria-controls="student-lessons-panel"
                onClick={() => setActiveTab('lesson')}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${
                  activeTab === 'lesson' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BookOpen className="h-4 w-4" /> Bài giảng
              </button>
              <button
                id="student-assignments-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === 'assignment'}
                aria-controls="student-assignments-panel"
                onClick={() => setActiveTab('assignment')}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${
                  activeTab === 'assignment' ? 'bg-rose-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ClipboardList className="h-4 w-4" /> Bài tập
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${activeTab === 'assignment' ? 'bg-white/20' : 'bg-rose-50 text-rose-700'}`}>
                  {visibleAssignments.length}
                </span>
              </button>
            </div>
            {activeTab === 'lesson' && (
              <div id="student-lessons-panel" role="tabpanel" aria-labelledby="student-lessons-tab">
              <p className="mb-3 text-xs text-slate-500">Tài liệu do giáo viên đăng trên hệ thống.</p>
            {chapterGroups.length ? (
              <nav aria-label="Danh sách bài giảng" className="grid min-w-0 grid-cols-[minmax(0,1fr)] max-h-[36vh] gap-1 overflow-x-hidden overflow-y-auto">
                {chapterGroups.map(({ chapter, lessons }) => {
                  const chapterExpanded = expandedChapters.has(chapter);
                  return (
                    <section key={chapter} className="min-w-0 border-b border-slate-200/80 pb-1">
                      <button
                        type="button"
                        aria-expanded={chapterExpanded}
                        onClick={() => toggleExpandedChapter(chapter)}
                        className="flex min-h-10 min-w-0 w-full items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-2 text-left text-sm font-extrabold uppercase tracking-wide text-slate-800 hover:bg-white"
                      >
                        <span className="min-w-0 flex-1 truncate" title={chapter}>{chapter}</span>
                        {chapterExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      </button>
                      {chapterExpanded && (
                        <div className="min-w-0 space-y-1 pl-3">
                          {lessons.map(({ lesson, resources: lessonResources }) => {
                            const lessonKey = `${chapter}:${lesson}`;
                            const lessonExpanded = expandedLessons.has(lessonKey);
                            return (
                              <section key={lessonKey} className="min-w-0">
                                <button
                                  type="button"
                                  aria-expanded={lessonExpanded}
                                  onClick={() => toggleExpandedLesson(chapter, lesson)}
                                  className="flex min-h-9 min-w-0 w-full items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-sm font-bold text-slate-700 hover:bg-white"
                                >
                                  <span className="min-w-0 flex-1 truncate" title={lesson}>{lesson}</span>
                                  {lessonExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                                </button>
                                {lessonExpanded && (
                                  <ul className="min-w-0 space-y-1 overflow-x-hidden pb-1 pl-3">
                                    {lessonResources.map((resource) => {
                                      const resourceFile = resource.files[0];
                                      const ResourceIcon = resourceFileIcon(resourceFile?.name ?? resource.title);
                                      return (
                                        <li key={resource.id} className="min-w-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedResourceId(resource.id);
                                              setSelectedAssignmentId(null);
                                            }}
                                            className={`flex min-h-9 min-w-0 w-full items-start gap-2 overflow-hidden rounded-md border-l-2 px-2 py-1.5 text-left text-xs ${
                                              selectedResource?.id === resource.id && !selectedAssignment
                                                ? 'border-blue-600 bg-blue-50 text-blue-900'
                                                : 'border-transparent text-slate-600 hover:bg-white'
                                            }`}
                                          >
                                            <ResourceIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                                            <span className="min-w-0 flex-1">
                                              <span className="block truncate font-semibold" title={resource.title}>{resource.title}</span>
                                              {resourceFile && <span className="mt-0.5 block truncate text-[11px]">{resourceFile.name}</span>}
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
            ) : <p className="py-3 text-sm text-slate-500">Chưa có bài giảng trong học kỳ này.</p>}
              </div>
            )}
            {activeTab === 'assignment' && (
              <div id="student-assignments-panel" role="tabpanel" aria-labelledby="student-assignments-tab">
                <p className="mb-3 text-xs text-slate-500">Bài chưa làm, đã nộp và kết quả chấm điểm.</p>
              {visibleAssignments.length ? (
                <nav aria-label="Danh sách bài tập" className="grid min-w-0 grid-cols-[minmax(0,1fr)] max-h-[66vh] gap-1 overflow-x-hidden overflow-y-auto">
                  {assignmentChapterGroups.map(({ chapter, lessons, isFree }) => {
                    const chapterKey = `assignment:${chapter}`;
                    const chapterExpanded = expandedChapters.has(chapterKey);
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
                          onClick={() => toggleExpandedChapter(chapterKey)}
                          className={`flex min-h-10 min-w-0 w-full items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-2 text-left text-xs font-extrabold uppercase tracking-wide ${
                            isFree ? 'text-rose-800 hover:bg-rose-100' : 'text-slate-800 hover:bg-white'
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate" title={chapter}>{chapter}</span>
                          {chapterExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        </button>
                        {chapterExpanded && (
                          <div className="min-w-0 space-y-1 pl-3">
                            {lessons.map(({ lesson, assignments: lessonAssignments }) => {
                              const lessonKey = `assignment:${chapter}:${lesson}`;
                              const lessonExpanded = expandedLessons.has(lessonKey);
                              return (
                                <section key={lessonKey} className="min-w-0">
                                  {!isFree && (
                                    <button
                                      type="button"
                                      aria-expanded={lessonExpanded}
                                      onClick={() => toggleExpandedLesson(`assignment:${chapter}`, lesson)}
                                      className="flex min-h-8 min-w-0 w-full items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-white"
                                    >
                                      <span className="min-w-0 flex-1 truncate" title={lesson}>{lesson}</span>
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
                                              setSelectedAssignmentId(assignment.id);
                                              setSelectedResourceId(null);
                                              setResponseText(assignment.responseText ?? '');
                                              setSubmitError('');
                                            }}
                                            className={`flex min-h-9 min-w-0 w-full items-start gap-2 overflow-hidden rounded-md border-l-2 px-2 py-1.5 text-left text-xs ${
                                              selectedAssignment?.id === assignment.id
                                                ? 'border-rose-500 bg-rose-50 text-rose-900'
                                                : 'border-transparent text-slate-600 hover:bg-white'
                                            }`}
                                          >
                                            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                                            <span className="min-w-0 flex-1">
                                              <span className="block truncate font-semibold" title={assignment.title}>{assignment.title}</span>
                                              <span className={`mt-0.5 block truncate text-[11px] font-medium ${
                                                assignment.score !== null ? 'text-emerald-700'
                                                  : assignment.submittedAt ? 'text-blue-700'
                                                    : 'text-rose-700'
                                              }`}>{assignmentStatus(assignment, currentTime)}</span>
                                            </span>
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
              ) : <p className="py-3 text-sm text-slate-500">Chưa có bài tập trong học kỳ này.</p>}
              </div>
            )}
          </aside>
          <main className="min-w-0 px-5 py-7 sm:px-8 sm:py-10 lg:px-12">
            {loadError && <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{loadError}</p>}
            {activeTab === 'assignment' && selectedAssignment ? (
              <article className="mx-auto max-w-4xl">
                <p className="text-sm font-medium text-rose-700">
                  {!selectedAssignment.chapter.trim() || !selectedAssignment.lesson.trim()
                    ? 'Bài tập tự do'
                    : `${selectedAssignment.chapter} · ${selectedAssignment.lesson}`}
                </p>
                <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{selectedAssignment.title}</h1>
                <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  selectedAssignment.score !== null ? 'bg-emerald-50 text-emerald-700'
                    : selectedAssignment.submittedAt ? 'bg-blue-50 text-blue-700'
                      : 'bg-rose-50 text-rose-700'
                }`}>{assignmentStatus(selectedAssignment, currentTime)}</span>
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4" /> Hạn nộp: {formatDueDate(selectedAssignment.dueAt)}</p>
                <div className="mt-6 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-base leading-7 text-slate-700">{selectedAssignment.description}</div>
                {selectedAssignment.score !== null && (
                  <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="font-semibold text-emerald-800">Điểm: {selectedAssignment.score}/10</p>
                    {selectedAssignment.teacherFeedback && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">{selectedAssignment.teacherFeedback}</p>}
                  </section>
                )}
                {selectedAssignment.submittedAt && (
                  <p className="mt-4 text-sm text-blue-700">Đã nộp lúc {formatDueDate(selectedAssignment.submittedAt)}</p>
                )}
                <label className="mt-6 block text-sm font-semibold text-slate-700">
                  {selectedAssignment.submittedAt ? 'Bài làm đã nộp' : 'Câu trả lời'}
                  <textarea
                    value={responseText}
                    onChange={(event) => setResponseText(event.target.value)}
                    readOnly={!canEditAssignment(selectedAssignment, currentTime)}
                    rows={6}
                    maxLength={10000}
                    className="input-field mt-2 w-full resize-y read-only:bg-slate-50 read-only:text-slate-600"
                    placeholder="Nhập câu trả lời..."
                  />
                </label>
                {isAssignmentPastDue(selectedAssignment, currentTime) && (
                  <p className={`mt-3 rounded-lg p-3 text-sm font-semibold ${
                    selectedAssignment.submittedAt ? 'bg-slate-50 text-slate-600' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {selectedAssignment.submittedAt
                      ? 'Đã hết hạn nộp — không thể chỉnh sửa bài làm.'
                      : 'Quá hạn nộp bài — bạn chưa nộp bài tập này.'}
                  </p>
                )}
                {submitError && <p role="alert" className="mt-3 text-sm text-rose-700">{submitError}</p>}
                {!isAssignmentPastDue(selectedAssignment, currentTime) && selectedAssignment.score === null && (
                  <button type="button" disabled={submitting} onClick={handleSubmitAssignment} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                    <Send className="h-4 w-4" /> {submitting ? 'Đang lưu...' : selectedAssignment.submittedAt ? 'Cập nhật bài nộp' : 'Nộp bài'}
                  </button>
                )}
              </article>
            ) : activeTab === 'lesson' && selectedResource ? (
              <article className="mx-auto max-w-4xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-blue-700">{selectedResource.subject} · {selectedResource.classCode} · Học kỳ {selectedResource.semester === 'Kỳ 2' ? '2' : '1'}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-600">{selectedResource.chapter} · {selectedResource.lesson}{selectedResource.period ? ` · ${selectedResource.period}` : ''}</p>
                    <h1 className="mt-2 text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">{selectedResource.title}</h1>
                  </div>
                  <button type="button" onClick={() => handleSaveResource(selectedResource)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    {savedResourceIds.has(selectedResource.id) ? <BookmarkCheck className="h-4 w-4 text-blue-600" /> : <Bookmark className="h-4 w-4" />}
                    {savedResourceIds.has(selectedResource.id) ? 'Đã lưu' : 'Lưu bài'}
                  </button>
                </div>
                {selectedResource.note && <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">{selectedResource.note}</p>}
                {selectedResource.files[0] && (
                  <section className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h2 className="break-all text-sm font-semibold text-slate-800">{selectedResource.files[0].name}</h2>
                    {resourceFileLoading && <p className="mt-3 text-sm text-slate-500">Đang tải tệp...</p>}
                    {resourceFileError && <p role="alert" className="mt-3 text-sm text-rose-700">{resourceFileError}</p>}
                    {resourceFileUrl && selectedResource.files[0].mediaType.startsWith('image/') && (
                      <img src={resourceFileUrl} alt={selectedResource.title} className="mt-3 max-h-[70vh] max-w-full rounded-lg object-contain" />
                    )}
                    {resourceFileUrl && selectedResource.files[0].mediaType === 'video/mp4' && (
                      <video controls src={resourceFileUrl} className="mt-3 max-h-[70vh] max-w-full rounded-lg" />
                    )}
                    {resourceFileUrl && (
                      <a href={resourceFileUrl} download={selectedResource.files[0].name} className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
                        Tải tệp về
                      </a>
                    )}
                  </section>
                )}
                {selectedResource.content && (
                  <section className="mt-7 whitespace-pre-wrap text-base leading-7 text-slate-700">{selectedResource.content}</section>
                )}
                {submitError && <p role="alert" className="mt-4 text-sm text-rose-700">{submitError}</p>}
              </article>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                {activeTab === 'lesson' ? <BookOpen className="h-10 w-10 text-slate-300" /> : <ClipboardList className="h-10 w-10 text-slate-300" />}
                <p className="mt-3 font-semibold text-slate-700">{activeTab === 'lesson' ? 'Chưa có bài giảng trong học kỳ này' : 'Chưa có bài tập trong học kỳ này'}</p>
                <p className="mt-1 text-sm text-slate-500">{activeTab === 'lesson' ? 'Giáo viên chưa đăng bài giảng.' : 'Giáo viên chưa giao bài tập.'}</p>
              </div>
            )}
          </main>
        </div>
      </section>
    );
  }

  return (
    <div className="animate-fadeIn space-y-6 text-base">
      <section className="grid gap-3 sm:grid-cols-2">
        <article className="flex items-center justify-between rounded-xl bg-amber-50 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-600"><Clock3 className="h-5 w-5 text-amber-600" />Bài tập chưa nộp</p>
          <strong className="text-2xl text-amber-700">{allPendingAssignments.length}</strong>
        </article>
        <article className="flex items-center justify-between rounded-xl bg-emerald-50 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-600"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Bài tập đã nộp</p>
          <strong className="text-2xl text-emerald-700">{submittedAssignments.length}</strong>
        </article>
      </section>
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Lớp học và tài liệu</h1>
            <p className="mt-1 text-sm text-slate-500">Danh sách bài giảng và bài tập được tải trực tiếp từ hệ thống.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onOpenSchedule} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Thời khóa biểu</button>
            <label className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm lớp, môn, giáo viên" className="input-field h-10 pl-9 pr-3 text-sm" />
            </label>
            <select className="input-field h-10 px-3 text-sm" value={semester} onChange={(event) => setSemester(event.target.value as Semester)}>
              <option value="Kỳ 1">Học kỳ 1</option>
              <option value="Kỳ 2">Học kỳ 2</option>
            </select>
          </div>
        </div>
        {loading ? <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Đang tải lớp học...</p> : null}
        {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{loadError}<button type="button" onClick={() => void refresh()} className="ml-3 font-semibold underline">Thử lại</button></div>}
        {!loading && !loadError && !groups.length && (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <BookOpen className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">Chưa có tài liệu hoặc bài tập</p>
            <p className="mt-1 text-sm text-slate-500">Khi giáo viên đăng nội dung, lớp học sẽ hiển thị tại đây.</p>
          </div>
        )}
        {!loading && !loadError && groups.length > 0 && !filteredGroups.length && <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Không tìm thấy lớp học phù hợp.</p>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredGroups.map((group) => {
            const termResources = group.resources.filter((item) => displaySemester(item.semester) === semester);
            const termAssignments = group.assignments.filter((item) => item.semester === semester && item.submittedAt === null);
            return (
              <article key={group.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{group.classCode} · {group.academicYear}</p>
                <h2 className="mt-2 text-lg font-bold text-slate-900">{group.subject}</h2>
                <p className="mt-1 text-sm text-slate-500">{group.className} · {group.teacherName}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-blue-50 px-3 py-1.5">{termResources.length} bài giảng · {semester}</span>
                  <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">{termAssignments.length} bài tập chưa làm</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => openGroup(group, 'lesson')} className="min-h-10 flex-1 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">Xem tài liệu</button>
                  <button type="button" onClick={() => openGroup(group, 'assignment')} className="min-h-10 flex-1 rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50">Bài tập</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
