import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Star,
  BookOpen,
  ClipboardCheck,
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
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  Presentation,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { AssignmentSubmissionFiles } from '@/components/AssignmentSubmissionFiles';
import { MathText } from '@/components/MathText';
import { RichLessonContent } from '@/components/LessonEditorContent';
import { recordStudentLearningActivity } from '@/api/studentLearningActivity';
import { authenticatedFetch } from '@/auth/authApi';
import { useSavedItems } from './savedItems';
import {
  distributeAssignmentPoints,
  parseAssignmentAnswers,
  parseAssignmentContent,
  serializeAssignmentAnswers,
  withAssignmentQuestionPoints,
} from './assignmentQuestions';
import {
  downloadClassLearningResourceFile,
  listClasses,
  listStudentAssignments,
  listStudentExamResults,
  listStudentLearningResources,
  listStudentSubjectAverages,
  markStudentExamResultRead,
  submitAssignment,
  type StudentAssignment,
  type StudentExamResult,
  type StudentLearningResource,
  type SchoolClass,
  type StudentSubjectAverage,
} from '@/api/schoolApi';
import { StudentExamResults } from './StudentExamResults';

interface MyClassesProps {
  studentUserId: string;
  isDemo?: boolean;
  onOpenSchedule: () => void;
  initialSubjectCode: string | null;
  initialSubjectView: 'lessons' | 'assignments' | 'exam' | null;
  initialSubjectTopic: string | null;
  initialExamSessionId?: string | null;
  initialExamClassId?: string | null;
  initialResourceId?: string | null;
  initialAssignmentId?: string | null;
  onExitGroup: () => void;
  onAskAI: (prompt: string, subject?: string) => void;
}

function resizeAnswerTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(textarea.scrollHeight, 128)}px`;
}

type Semester = 'Kỳ 1' | 'Kỳ 2';
const maxSubmissionFiles = 5;
const maxSubmissionFileBytes = 10 * 1024 * 1024;
const submissionFileExtensions = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx',
]);
type LearningGroup = {
  key: string;
  classId: string;
  className: string;
  classCode: string;
  subject: string;
  academicYear: string;
  teacherName: string | null;
  teacherGender?: 'female' | 'male' | 'other' | 'unspecified' | null;
  resources: StudentLearningResource[];
  assignments: StudentAssignment[];
};

type LearningGroupSource = Pick<
  LearningGroup,
  'classId' | 'className' | 'classCode' | 'subject' | 'academicYear' | 'teacherName'
  | 'teacherGender'
>;

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
  if (assignment.score !== null) return `Đã chấm - ${assignment.score}/10`;
  if (assignment.submittedAt) return 'Đã làm';
  return isAssignmentPastDue(assignment, now) ? 'Quá hạn nộp bài' : 'Chưa làm';
}

function assignmentStatusPriority(assignment: StudentAssignment) {
  if (assignment.score !== null) return 2;
  return assignment.submittedAt ? 1 : 0;
}

function sortAssignmentsByStatus(assignments: StudentAssignment[]) {
  return assignments
    .map((assignment, index) => ({ assignment, index }))
    .sort((first, second) =>
      assignmentStatusPriority(first.assignment) - assignmentStatusPriority(second.assignment)
      || first.index - second.index)
    .map(({ assignment }) => assignment);
}

function assignmentGradeRevision(assignment: StudentAssignment) {
  return assignment.gradedAt ?? `score:${assignment.score}`;
}

function assignmentGradeReadStorageKey(studentUserId: string) {
  return `eduflow.student.assignment-grades-read:${studentUserId}`;
}

function examGradeRevision(result: StudentExamResult) {
  return result.grade.gradedAt;
}

function studentFacingAssignmentIntroduction(introduction: string, assignment: StudentAssignment) {
  const lines = introduction.split(/\r?\n/);
  const metadataLines = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => line);
  const [titleLine, subjectLine] = metadataLines;
  if (titleLine?.line !== `Bài tập: ${assignment.title}`
    || !/^.+\s-\sKhối\s+[^-]+\s-\s.+$/i.test(subjectLine?.line ?? '')) {
    return introduction;
  }
  return lines.slice(subjectLine.index + 1).join('\n').trim();
}

function canEditAssignment(assignment: StudentAssignment, now = Date.now()) {
  return !isAssignmentPastDue(assignment, now) && assignment.score === null;
}

function normalizeSubjectName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('vi').replace(/[^A-Z0-9]/g, '');
}

function teacherLabel(name: string | null, gender?: LearningGroup['teacherGender']) {
  if (!name) return '';
  if (/^(cô|thầy)\s/i.test(name)) return name;
  const honorific = gender === 'female' ? 'Cô' : gender === 'male' ? 'Thầy' : 'GV';
  return `${honorific} ${name}`;
}

function scoreColor(score: number) {
  const stops = [
    { score: 0, color: [17, 24, 39] },
    { score: 2, color: [185, 28, 28] },
    { score: 4, color: [234, 88, 12] },
    { score: 6, color: [202, 138, 4] },
    { score: 8, color: [101, 163, 13] },
    { score: 10, color: [21, 128, 61] },
  ];
  const boundedScore = Math.min(10, Math.max(0, score));
  const upperIndex = stops.findIndex((stop) => stop.score >= boundedScore);
  const upper = stops[upperIndex] ?? stops[stops.length - 1];
  const lower = stops[Math.max(0, upperIndex - 1)];
  const ratio = (boundedScore - lower.score) / (upper.score - lower.score || 1);
  const channels = lower.color.map((channel, index) =>
    Math.round(channel + (upper.color[index] - channel) * ratio));
  return `rgb(${channels.join(' ')})`;
}

export function MyClasses(props: MyClassesProps) {
  const {
    studentUserId,
    isDemo = false,
    initialSubjectCode,
    initialSubjectView,
    initialSubjectTopic,
    initialExamSessionId,
    initialExamClassId,
    initialResourceId,
    initialAssignmentId,
    onExitGroup,
    onAskAI,
  } = props;
  const [resources, setResources] = useState<StudentLearningResource[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [examResults, setExamResults] = useState<StudentExamResult[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjectAverages, setSubjectAverages] = useState<StudentSubjectAverage[]>([]);
  const [averageLoadError, setAverageLoadError] = useState('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [gradeReadError, setGradeReadError] = useState('');
  const [readGradedAssignments, setReadGradedAssignments] = useState<Record<string, string>>({});
  const [examResultsLoading, setExamResultsLoading] = useState(true);
  const [examResultsError, setExamResultsError] = useState('');
  const [examGradeReadError, setExamGradeReadError] = useState('');
  const [query, setQuery] = useState('');
  const [semester, setSemester] = useState<Semester>('Kỳ 1');
  const [activeTab, setActiveTab] = useState<'lesson' | 'assignment' | 'exam'>(() => (
    initialSubjectView === 'assignments' ? 'assignment' : initialSubjectView === 'exam' ? 'exam' : 'lesson'
  ));
  const [contentSidebarHidden, setContentSidebarHidden] = useState(false);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState('');
  const [bookmarkError, setBookmarkError] = useState('');
  const [bookmarkPending, setBookmarkPending] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formattingAnswerIndex, setFormattingAnswerIndex] = useState<number | null>(null);
  const [formatAnswerError, setFormatAnswerError] = useState('');
  const [formatAnswerErrorIndex, setFormatAnswerErrorIndex] = useState<number | null>(null);
  const [editingAnswerIndex, setEditingAnswerIndex] = useState<number | null>(null);
  const [editingPlainAnswer, setEditingPlainAnswer] = useState(false);
  const [resourceFileUrl, setResourceFileUrl] = useState<string | null>(null);
  const [resourceFileLoading, setResourceFileLoading] = useState(false);
  const [resourceFileError, setResourceFileError] = useState('');
  const refreshInFlight = useRef(false);
  const responseDraft = useRef({ assignmentId: null as string | null, dirty: false });
  const saved = useSavedItems();
  const savedResourceIds = new Set(saved.items.filter((item) => item.type === 'resource').map((item) => item.id));
  const savedAssignmentIds = new Set(saved.items.filter((item) => item.type === 'assignment' && 'assignmentId' in item).map((item) => item.id));
  const savedExamIds = new Set(saved.items.filter((item) => item.type === 'exam' && 'sessionId' in item).map((item) => item.id));

  useEffect(() => {
    try {
      const stored = localStorage.getItem(assignmentGradeReadStorageKey(studentUserId));
      if (!stored) {
        setReadGradedAssignments({});
        setGradeReadError('');
        return;
      }
      const parsed: unknown = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
        || Object.values(parsed).some((revision) => typeof revision !== 'string')) {
        throw new Error('Dữ liệu trạng thái bài chấm đã xem không hợp lệ.');
      }
      setReadGradedAssignments(parsed as Record<string, string>);
      setGradeReadError('');
    } catch (error) {
      setGradeReadError(error instanceof Error ? error.message : 'Không thể đọc trạng thái bài chấm đã xem.');
    }
  }, [studentUserId]);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    const refreshExamResults = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const nextResults = await listStudentExamResults();
        if (active) {
          setExamResults(nextResults);
          setExamResultsError('');
        }
      } catch (requestError) {
        if (active) {
          setExamResultsError(
            requestError instanceof Error ? requestError.message : 'Không thể tải kết quả kiểm tra.',
          );
        }
      } finally {
        if (active) setExamResultsLoading(false);
        refreshing = false;
      }
    };
    void refreshExamResults();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshExamResults();
    }, 15_000);
    document.addEventListener('visibilitychange', refreshExamResults);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshExamResults);
    };
  }, [studentUserId]);

  const refresh = async (silent = false) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const [nextResources, nextAssignments, nextClasses] = await Promise.all([
        listStudentLearningResources(),
        listStudentAssignments(),
        listClasses(),
      ]);
      setResources(nextResources);
      setAssignments(nextAssignments);
      setClasses(nextClasses);
      setLoadError('');
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : 'Không thể tải tài liệu lớp học.');
    } finally {
      if (!silent) setLoading(false);
      refreshInFlight.current = false;
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) void refresh(true);
    };
    const timer = window.setInterval(refreshWhenVisible, 5_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setAverageLoadError('');
    listStudentSubjectAverages(semester)
      .then((averages) => {
        if (active) setSubjectAverages(averages);
      })
      .catch((requestError) => {
        if (active) {
          setAverageLoadError(
            requestError instanceof Error ? requestError.message : 'Không thể tải điểm trung bình môn.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [semester]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const groups = useMemo(() => {
    const grouped = new Map<string, LearningGroup>();
    const ensureGroup = (item: LearningGroupSource) => {
      const key = `${item.classId}:${item.subject}:${item.academicYear}`;
      const group = grouped.get(key) ?? {
        key,
        classId: item.classId,
        className: item.className,
        classCode: item.classCode,
        subject: item.subject,
        academicYear: item.academicYear,
        teacherName: item.teacherName,
        teacherGender: item.teacherGender,
        resources: [],
        assignments: [],
      };
      if (!group.teacherName && item.teacherName) group.teacherName = item.teacherName;
      if (!group.teacherGender && item.teacherGender) group.teacherGender = item.teacherGender;
      grouped.set(key, group);
      return group;
    };
    resources.forEach((resource) => ensureGroup(resource).resources.push(resource));
    assignments.forEach((assignment) => ensureGroup(assignment).assignments.push(assignment));
    classes.forEach((classroom) => {
      classroom.subjects?.forEach(({ subject, teacherName, teacherGender }) => {
        ensureGroup({
          classId: classroom.id,
          className: classroom.name,
          classCode: classroom.code,
          subject,
          academicYear: classroom.academic_year,
          teacherName,
          teacherGender,
        });
      });
    });
    return Array.from(grouped.values()).sort((first, second) =>
      first.classCode.localeCompare(second.classCode, 'vi') || first.subject.localeCompare(second.subject, 'vi'));
  }, [assignments, classes, resources]);

  useEffect(() => {
    if (!initialAssignmentId || selectedGroupKey) return;
    const match = groups.find((group) => group.assignments.some((item) => item.id === initialAssignmentId));
    const assignment = match?.assignments.find((item) => item.id === initialAssignmentId);
    if (!match || !assignment) return;
    setSemester(displaySemester(assignment.semester));
    setSelectedGroupKey(match.key);
    setSelectedAssignmentId(assignment.id);
    setSelectedResourceId(null);
    setResponseText(assignment.responseText ?? '');
    setActiveTab('assignment');
  }, [groups, initialAssignmentId, selectedGroupKey]);

  useEffect(() => {
    if (!initialExamSessionId || !initialExamClassId || selectedGroupKey) return;
    const result = examResults.find((item) => item.sessionId === initialExamSessionId && item.classId === initialExamClassId);
    if (!result) return;
    const match = groups.find((group) => group.classId === result.classId
      && group.academicYear === result.academicYear
      && normalizeSubjectName(group.subject) === normalizeSubjectName(result.subject));
    if (!match) return;
    setSemester(result.semester === 'Kỳ 2' ? 'Kỳ 2' : 'Kỳ 1');
    setSelectedGroupKey(match.key);
    setActiveTab('exam');
  }, [examResults, groups, initialExamClassId, initialExamSessionId, selectedGroupKey]);

  useEffect(() => {
    if (!initialResourceId || selectedGroupKey) return;
    const match = groups.find((group) => group.resources.some((item) => item.id === initialResourceId));
    if (match) {
      const resource = match.resources.find((item) => item.id === initialResourceId);
      if (!resource) return;
      setSemester(displaySemester(resource.semester));
      setSelectedGroupKey(match.key);
      setSelectedResourceId(resource.id);
      setActiveTab('lesson');
    }
  }, [groups, initialResourceId, selectedGroupKey]);

  useEffect(() => {
    if (!initialResourceId && !initialAssignmentId && !initialExamSessionId && !selectedGroupKey && initialSubjectCode) {
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
        } else if (initialSubjectView === 'exam') {
          setActiveTab('exam');
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
  }, [groups, initialAssignmentId, initialExamSessionId, initialResourceId, initialSubjectCode, initialSubjectTopic, initialSubjectView, selectedGroupKey, semester]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi');
    return groups.filter((group) =>
      `${group.classCode} ${group.className} ${group.subject} ${group.teacherName}`
        .toLocaleLowerCase('vi').includes(normalizedQuery));
  }, [groups, query]);
  const selectedGroup = groups.find((group) => group.key === selectedGroupKey) ?? null;
  const selectedGroupExamResults = useMemo(() => selectedGroup
    ? examResults.filter((result) => (
      result.classId === selectedGroup.classId
      && result.academicYear === selectedGroup.academicYear
      && normalizeSubjectName(result.subject) === normalizeSubjectName(selectedGroup.subject)
    ))
    : [], [examResults, selectedGroup]);
  const readExamGrades = useMemo(() => Object.fromEntries(
    examResults
      .filter((result) => result.grade.isRead)
      .map((result) => [result.sessionId, examGradeRevision(result)]),
  ), [examResults]);
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
          .map(([lesson, items]) => ({ lesson, assignments: sortAssignmentsByStatus(items) }))
          .sort((first, second) => first.lesson.localeCompare(second.lesson, 'vi', { numeric: true })),
      }))
      .sort((first, second) => first.chapter.localeCompare(second.chapter, 'vi', { numeric: true }));
    if (freeAssignments.length) {
      groups.unshift({
        chapter: 'Bài tập tự do',
        isFree: true,
        lessons: [{ lesson: '', assignments: sortAssignmentsByStatus(freeAssignments) }],
      });
    }
    return groups;
  }, [visibleAssignments]);
  const selectedResource = visibleResources.find((resource) => resource.id === selectedResourceId) ?? visibleResources[0] ?? null;
  const selectedAssignment = visibleAssignments.find((assignment) => assignment.id === selectedAssignmentId)
    ?? visibleAssignments[0]
    ?? null;
  const selectedAssignmentContent = selectedAssignment
    ? parseAssignmentContent(selectedAssignment.description)
    : null;
  const assignmentIntroduction = selectedAssignment && selectedAssignmentContent
    ? studentFacingAssignmentIntroduction(selectedAssignmentContent.introduction, selectedAssignment)
    : '';
  const structuredAnswers = selectedAssignmentContent
    ? parseAssignmentAnswers(responseText, selectedAssignmentContent.questions.length)
    : null;
  const legacyAssignmentResponse = selectedAssignmentContent && responseText.trim() && !structuredAnswers
    ? responseText
    : '';
  const assignmentAnswerValues = selectedAssignmentContent
    ? structuredAnswers ?? Array.from({ length: selectedAssignmentContent.questions.length }, () => '')
    : [];
  const assignmentQuestionMaximums = distributeAssignmentPoints(selectedAssignmentContent?.questions.length ?? 0);
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
    const assignmentId = selectedAssignment?.id ?? null;
    if (responseDraft.current.assignmentId !== assignmentId) {
      responseDraft.current = { assignmentId, dirty: false };
      setSubmissionFiles([]);
      setEditingAnswerIndex(null);
      setEditingPlainAnswer(false);
    }
    if (!responseDraft.current.dirty) setResponseText(selectedAssignment?.responseText ?? '');
  }, [selectedAssignment?.id, selectedAssignment?.responseText]);
  const allPendingAssignments = assignments.filter((assignment) => assignment.submittedAt === null);
  const submittedAssignments = assignments.filter((assignment) => assignment.submittedAt !== null);

  const openGroup = (group: LearningGroup, view: 'lesson' | 'assignment' | 'exam') => {
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

  const handleSaveResource = async (resource: StudentLearningResource) => {
    try {
      if (savedResourceIds.has(resource.id)) {
        await saved.removeSavedItem('resource', resource.id);
      } else {
        await saved.saveItem({
        id: resource.id,
        type: 'resource',
        title: resource.title,
        subject: resource.subject,
        savedAt: new Date().toISOString(),
        });
      }
      setSubmitError('');
    } catch (saveError) {
      setSubmitError(saveError instanceof Error ? saveError.message : 'Không thể lưu tài liệu.');
    }
  };

  const toggleAssignmentBookmark = async (assignment: StudentAssignment) => {
    if (bookmarkPending.includes(`assignment:${assignment.id}`)) return;
    setBookmarkPending((current) => [...current, `assignment:${assignment.id}`]);
    setBookmarkError('');
    try {
      if (savedAssignmentIds.has(assignment.id)) {
        await saved.removeSavedItem('assignment', assignment.id);
      } else {
        await saved.saveItem({
          id: assignment.id,
          type: 'assignment',
          title: assignment.title,
          subject: assignment.subject,
          savedAt: new Date().toISOString(),
          assignmentId: assignment.id,
        });
      }
    } catch (error) {
      setBookmarkError(error instanceof Error ? error.message : 'Không thể cập nhật nội dung đã lưu.');
    } finally {
      setBookmarkPending((current) => current.filter((key) => key !== `assignment:${assignment.id}`));
    }
  };

  const toggleExamBookmark = async (result: StudentExamResult) => {
    if (bookmarkPending.includes(`exam:${result.sessionId}`)) return;
    setBookmarkPending((current) => [...current, `exam:${result.sessionId}`]);
    setBookmarkError('');
    try {
      if (savedExamIds.has(result.sessionId)) {
        await saved.removeSavedItem('exam', result.sessionId);
      } else {
        await saved.saveItem({
          id: result.sessionId,
          type: 'exam',
          title: result.title,
          subject: result.subject,
          savedAt: new Date().toISOString(),
          sessionId: result.sessionId,
          classId: result.classId,
        });
      }
    } catch (error) {
      setBookmarkError(error instanceof Error ? error.message : 'Không thể cập nhật nội dung đã lưu.');
    } finally {
      setBookmarkPending((current) => current.filter((key) => key !== `exam:${result.sessionId}`));
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

  const markAssignmentGradeAsRead = (assignment: StudentAssignment) => {
    if (assignment.score === null) return;
    const revision = assignmentGradeRevision(assignment);
    const next = { ...readGradedAssignments, [assignment.id]: revision };
    try {
      localStorage.setItem(assignmentGradeReadStorageKey(studentUserId), JSON.stringify(next));
      setReadGradedAssignments(next);
      setGradeReadError('');
    } catch (error) {
      setGradeReadError(error instanceof Error ? error.message : 'Không thể lưu trạng thái bài chấm đã xem.');
    }
  };

  const markExamGradeAsRead = useCallback(async (result: StudentExamResult) => {
    try {
      await markStudentExamResultRead(result.sessionId);
      if (!isDemo) {
        void recordStudentLearningActivity('result_view').catch((activityError: unknown) => {
          console.error('Could not record student exam-result activity.', activityError);
        });
      }
      setExamResults((current) => current.map((item) => (
        item.sessionId === result.sessionId
          ? { ...item, grade: { ...item.grade, isRead: true } }
          : item
      )));
      setExamGradeReadError('');
    } catch (error) {
      setExamGradeReadError(error instanceof Error ? error.message : 'Không thể lưu trạng thái bài thi đã xem.');
    }
  }, [isDemo]);

  const handleSubmitAssignment = async () => {
    const hasAnswer = submissionFiles.length > 0 || (selectedAssignmentContent
      ? assignmentAnswerValues.some((answer) => answer.trim())
      : Boolean(responseText.trim()));
    if (!selectedAssignment || !hasAnswer || !canEditAssignment(selectedAssignment, currentTime)) {
      setSubmitError('Nhập câu trả lời trước khi nộp bài.');
      return;
    }
    const submissionText = selectedAssignmentContent
      ? serializeAssignmentAnswers(assignmentAnswerValues)
      : responseText.trim() || (submissionFiles.length ? 'Bài làm gửi dưới dạng tệp đính kèm.' : '');
    if (submissionText.length > 20000) {
      setSubmitError('Bài làm không được vượt quá 20.000 ký tự.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitAssignment(selectedAssignment.id, submissionText, submissionFiles);
      if (!isDemo) {
        void recordStudentLearningActivity('assignment_submit').catch((activityError: unknown) => {
          console.error('Could not record student assignment activity.', activityError);
        });
      }
      responseDraft.current.dirty = false;
      setSubmissionFiles([]);
      setEditingAnswerIndex(null);
      setEditingPlainAnswer(false);
      await refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setSubmitError(requestError instanceof Error ? requestError.message : 'Không thể nộp bài tập.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormatAnswer = async (answer: string, index: number) => {
    if (!answer.trim() || !selectedAssignment || !canEditAssignment(selectedAssignment, currentTime)) return;
    const assignmentId = selectedAssignment.id;
    setFormattingAnswerIndex(index);
    setFormatAnswerError('');
    setFormatAnswerErrorIndex(null);
    try {
      const response = await authenticatedFetch('/api/ai/format-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: answer }),
      });
      const result: {
        success: boolean;
        data?: { formattedText?: string };
        message?: string;
      } = await response.json();
      const formattedText = result.data?.formattedText;
      if (!response.ok || !result.success || typeof formattedText !== 'string' || !formattedText.trim()) {
        throw new Error(result.message || 'Không thể chuẩn hóa ký hiệu trong câu trả lời.');
      }
      if (selectedAssignmentId !== assignmentId) return;
      responseDraft.current.dirty = true;
      if (selectedAssignmentContent) {
        const questionCount = selectedAssignmentContent.questions.length;
        setResponseText((currentText) => {
          const currentAnswers = parseAssignmentAnswers(currentText, questionCount)
            ?? Array.from({ length: questionCount }, () => '');
          currentAnswers[index] = formattedText.trim();
          return serializeAssignmentAnswers(currentAnswers);
        });
        setEditingAnswerIndex(null);
      } else {
        setResponseText(formattedText.trim());
        setEditingPlainAnswer(false);
      }
    } catch (requestError) {
      setFormatAnswerError(
        requestError instanceof Error ? requestError.message : 'Không thể chuẩn hóa ký hiệu trong câu trả lời.',
      );
      setFormatAnswerErrorIndex(index);
    } finally {
      setFormattingAnswerIndex(null);
    }
  };

  if (selectedGroup) {
    return (
      <section className="animate-fadeIn overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => {
              setSelectedGroupKey(null);
              onExitGroup();
            }} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-blue-700">
              <ChevronLeft className="h-5 w-5" /> Lớp học
            </button>
            <span className="h-6 border-l border-slate-200" />
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-slate-900">{selectedGroup.subject}</p>
            </div>
          </div>
          <button
            type="button"
            aria-controls="student-class-content-sidebar"
            aria-expanded={!contentSidebarHidden}
            onClick={() => setContentSidebarHidden((hidden) => !hidden)}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            {contentSidebarHidden
              ? <><PanelLeftOpen className="h-4 w-4" /><span className="hidden sm:inline">Hiện danh mục</span></>
              : <><PanelLeftClose className="h-4 w-4" /><span className="hidden sm:inline">Ẩn danh mục</span></>}
          </button>
        </header>
        <div className={`grid min-h-[min(72vh,760px)] ${contentSidebarHidden ? 'grid-cols-1' : 'lg:grid-cols-[360px_minmax(0,1fr)]'}`}>
          {!contentSidebarHidden && <aside id="student-class-content-sidebar" className="min-w-0 overflow-x-hidden border-b border-slate-200 bg-slate-50/70 p-4 lg:border-b-0 lg:border-r sm:p-5">
            <div className="mb-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Nội dung lớp học">
              <button
                id="student-lessons-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === 'lesson'}
                aria-controls="student-lessons-panel"
                onClick={() => setActiveTab('lesson')}
                className={`inline-flex min-h-10 items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold ${
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
                className={`inline-flex min-h-10 items-center justify-center gap-0.5 rounded-lg px-0.5 text-xs font-semibold ${
                  activeTab === 'assignment' ? 'bg-rose-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ClipboardList className="h-4 w-4" /> Bài tập
                <span className={`rounded-full px-1.5 py-0.5 text-[0.6875rem] ${activeTab === 'assignment' ? 'bg-white/20' : 'bg-rose-50 text-rose-700'}`}>
                  {visibleAssignments.length}
                </span>
              </button>
              <button
                id="student-exams-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === 'exam'}
                aria-controls="student-exams-panel"
                onClick={() => setActiveTab('exam')}
                className={`inline-flex min-h-10 items-center justify-center gap-0.5 rounded-lg px-0.5 text-xs font-semibold ${
                  activeTab === 'exam' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ClipboardCheck className="h-4 w-4" /> Kiểm tra
                {selectedGroupExamResults.some((result) => (
                  readExamGrades[result.sessionId] !== examGradeRevision(result)
                )) && (
                  <span
                    className={`h-2 w-2 rounded-full ${activeTab === 'exam' ? 'bg-white' : 'bg-rose-500'}`}
                    aria-label="Có điểm kiểm tra mới"
                  />
                )}
              </button>
            </div>
            {activeTab === 'lesson' && (
              <div id="student-lessons-panel" role="tabpanel" aria-labelledby="student-lessons-tab">
            {chapterGroups.length ? (
              <nav aria-label="Danh sách bài giảng" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
                {chapterGroups.map(({ chapter, lessons }) => {
                  const chapterExpanded = expandedChapters.has(chapter);
                  return (
                    <section key={chapter} className="min-w-0 border-b border-slate-200/80 pb-1">
                      <button
                        type="button"
                        aria-expanded={chapterExpanded}
                        onClick={() => toggleExpandedChapter(chapter)}
                        className="flex min-h-10 min-w-0 w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left text-sm font-extrabold uppercase tracking-wide text-slate-800 hover:bg-white"
                      >
                        <span className="min-w-0 flex-1 whitespace-normal break-words">{chapter}</span>
                        {chapterExpanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
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
                                  className="flex min-h-9 min-w-0 w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm font-bold text-slate-700 hover:bg-white"
                                >
                                  <span className="min-w-0 flex-1 whitespace-normal break-words">{lesson}</span>
                                  {lessonExpanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
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
                                              if (!isDemo) {
                                                void recordStudentLearningActivity('resource_view').catch((activityError: unknown) => {
                                                  console.error('Could not record student learning-resource activity.', activityError);
                                                });
                                              }
                                            }}
                                            className={`flex min-h-9 min-w-0 w-full items-start gap-2 rounded-md border-l-2 px-2 py-1.5 text-left text-xs ${
                                              selectedResource?.id === resource.id && !selectedAssignment
                                                ? 'border-blue-600 bg-blue-50 text-blue-900'
                                                : 'border-transparent text-slate-600 hover:bg-white'
                                            }`}
                                          >
                                            <ResourceIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                                            <span className="min-w-0 flex-1">
                                              <span className="block whitespace-normal break-words font-semibold">{resource.title}</span>
                                              {resourceFile && <span className="mt-0.5 block whitespace-normal break-words text-[0.6875rem]">{resourceFile.name}</span>}
                                              {resource.period && <span className="mt-0.5 block whitespace-normal break-words text-[0.6875rem] text-slate-500">{resource.period}</span>}
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
                {gradeReadError && <p role="alert" className="mb-3 text-xs text-rose-700">{gradeReadError}</p>}
              {visibleAssignments.length ? (
                <nav aria-label="Danh sách bài tập" className="grid min-w-0 grid-cols-[minmax(0,1fr)] max-h-[66vh] gap-1 overflow-x-hidden overflow-y-auto">
                  {assignmentChapterGroups.map(({ chapter, lessons, isFree }) => {
                    const chapterKey = `assignment:${chapter}`;
                    const chapterExpanded = expandedChapters.has(chapterKey);
                    return (
                      <section
                        key={chapterKey}
                        className={`min-w-0 rounded-lg pb-1 ${isFree ? 'border border-rose-200 bg-rose-50/70' : ''}`}
                      >
                        <button
                          type="button"
                          aria-expanded={chapterExpanded}
                          onClick={() => toggleExpandedChapter(chapterKey)}
                          className={`flex min-h-10 min-w-0 w-full items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-2 text-left text-xs font-extrabold uppercase tracking-wide ${
                            isFree
                              ? 'text-rose-800 hover:bg-rose-100'
                              : 'text-slate-800 hover:bg-white'
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
                                        <li key={assignment.id} className="flex min-w-0 items-start gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              markAssignmentGradeAsRead(assignment);
                                              setSelectedAssignmentId(assignment.id);
                                              setSelectedResourceId(null);
                                              setResponseText(assignment.responseText ?? '');
                                              setSubmitError('');
                                            }}
                                            className={`flex min-h-9 min-w-0 flex-1 items-start gap-2 overflow-hidden rounded-md border-l-2 px-2 py-1.5 text-left text-xs ${
                                              selectedAssignment?.id === assignment.id
                                                ? 'border-rose-500 bg-rose-50 text-rose-900'
                                                : 'border-transparent text-slate-600 hover:bg-white'
                                            }`}
                                          >
                                            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                                            <span className="min-w-0 flex-1">
                                              <span className="block truncate font-semibold" title={assignment.title}>{assignment.title}</span>
                                              <span className={`mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.6875rem] font-medium ${
                                                assignment.score !== null ? 'text-emerald-700'
                                                  : assignment.submittedAt ? 'text-blue-700'
                                                    : 'text-rose-700'
                                              }`}>
                                                <span className="truncate">{assignmentStatus(assignment, currentTime)}</span>
                                                {assignment.score !== null
                                                  && readGradedAssignments[assignment.id] !== assignmentGradeRevision(assignment) && (
                                                    <span className="shrink-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 font-semibold leading-none text-slate-900">
                                                      mới
                                                    </span>
                                                )}
                                              </span>
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            disabled={saved.loading || Boolean(saved.error) || bookmarkPending.includes(`assignment:${assignment.id}`)}
                                            aria-pressed={savedAssignmentIds.has(assignment.id)}
                                            aria-label={savedAssignmentIds.has(assignment.id) ? `Bỏ lưu ${assignment.title}` : `Lưu ${assignment.title}`}
                                            title={savedAssignmentIds.has(assignment.id) ? 'Bỏ lưu' : 'Lưu bài tập'}
                                            onClick={() => void toggleAssignmentBookmark(assignment)}
                                            className="mt-1 shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                                          >
                                            <Star className={`h-4 w-4 ${savedAssignmentIds.has(assignment.id) ? 'fill-amber-400 text-amber-500' : ''}`} />
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
            {activeTab === 'exam' && (
              <div id="student-exams-panel" role="tabpanel" aria-labelledby="student-exams-tab">
                {examGradeReadError && <p role="alert" className="mb-3 text-xs text-rose-700">{examGradeReadError}</p>}
                <p className="py-3 text-sm text-slate-500">
                  {examResultsLoading && selectedGroupExamResults.length === 0
                    ? 'Đang tải kết quả kiểm tra...'
                    : selectedGroupExamResults.length
                      ? `${selectedGroupExamResults.length} bài kiểm tra đã có điểm`
                      : 'Chưa có bài kiểm tra được công bố điểm.'}
                </p>
              </div>
            )}
          </aside>}
          <main className="min-w-0 px-5 py-7 sm:px-8 sm:py-10 lg:px-12">
            {loadError && <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{loadError}</p>}
            {bookmarkError && !(activeTab === 'assignment' && selectedAssignment) && <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{bookmarkError}</p>}
            {activeTab === 'exam' ? (
              <StudentExamResults
                results={selectedGroupExamResults}
                loading={examResultsLoading}
                error={examResultsError}
                readRevisions={readExamGrades}
                readError={examGradeReadError}
                onMarkRead={markExamGradeAsRead}
                onAskAI={onAskAI}
                initialSessionId={initialExamSessionId}
                savedResultIds={savedExamIds}
                bookmarkPendingIds={new Set(bookmarkPending.filter((key) => key.startsWith('exam:')).map((key) => key.slice('exam:'.length)))}
                onToggleSaved={(result) => void toggleExamBookmark(result)}
              />
            ) : activeTab === 'assignment' && selectedAssignment ? (
              <article className="mx-auto max-w-4xl">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h1 className="min-w-0 flex-1 text-2xl font-bold text-slate-950 sm:text-3xl">{selectedAssignment.title}</h1>
                  <button
                    type="button"
                    disabled={saved.loading || Boolean(saved.error) || bookmarkPending.includes(`assignment:${selectedAssignment.id}`)}
                    aria-pressed={savedAssignmentIds.has(selectedAssignment.id)}
                    aria-label={savedAssignmentIds.has(selectedAssignment.id) ? 'Bỏ lưu bài tập' : 'Lưu bài tập'}
                    onClick={() => void toggleAssignmentBookmark(selectedAssignment)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Star className={`h-4 w-4 ${savedAssignmentIds.has(selectedAssignment.id) ? 'fill-amber-400 text-amber-500' : ''}`} />
                    {savedAssignmentIds.has(selectedAssignment.id) ? 'Đã lưu' : 'Lưu bài'}
                  </button>
                </div>
                {bookmarkError && <p role="alert" className="mt-3 text-sm text-rose-700">{bookmarkError}</p>}
                <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="h-4 w-4" /> Hạn nộp: {formatDueDate(selectedAssignment.dueAt)}
                  </span>
                  {selectedAssignment.submittedAt && (
                    <span className="inline-flex items-center gap-2 text-blue-700">
                      <CheckCircle2 className="h-4 w-4" /> Đã nộp lúc {formatDueDate(selectedAssignment.submittedAt)}
                    </span>
                  )}
                </div>
                {(selectedAssignment.score !== null || selectedAssignment.teacherFeedback) && (
                  <section className="mb-5 flex flex-wrap items-stretch gap-4 rounded-xl border border-slate-200 bg-white p-4">
                    {selectedAssignment.score !== null && (
                      <div className={`flex shrink-0 items-baseline gap-2 ${selectedAssignment.teacherFeedback ? 'border-r border-slate-200 pr-5' : ''}`}>
                        <span className="text-2xl font-bold leading-none text-slate-600">Điểm:</span>
                        <span className="text-5xl font-extrabold leading-none tracking-tight" style={{ color: scoreColor(selectedAssignment.score) }}>
                          {selectedAssignment.score}
                        </span>
                        <span className="text-2xl font-semibold leading-none text-slate-500">/ 10</span>
                      </div>
                    )}
                    {selectedAssignment.teacherFeedback && (
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-sm font-semibold text-slate-700">Lời phê giáo viên:</p>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedAssignment.teacherFeedback}</p>
                      </div>
                    )}
                  </section>
                )}
                {canEditAssignment(selectedAssignment, currentTime) && selectedAssignment.score === null && (
                  <section className="mb-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                      <Paperclip className="h-4 w-4" />
                      Đính kèm ảnh hoặc tệp
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx"
                        disabled={(selectedAssignment.files.length + submissionFiles.length) >= maxSubmissionFiles}
                        onChange={(event) => {
                          const addedFiles = Array.from(event.currentTarget.files ?? []);
                          event.currentTarget.value = '';
                          if (selectedAssignment.files.length + submissionFiles.length + addedFiles.length > maxSubmissionFiles) {
                            setSubmitError('Mỗi bài nộp được đính kèm tối đa 5 tệp.');
                            return;
                          }
                          const oversized = addedFiles.find((file) => file.size === 0 || file.size > maxSubmissionFileBytes);
                          if (oversized) {
                            setSubmitError('Mỗi tệp đính kèm phải có dung lượng từ 1 byte đến 10 MB.');
                            return;
                          }
                          const unsupported = addedFiles.find((file) => (
                            !submissionFileExtensions.has(file.name.split('.').pop()?.toLowerCase() ?? '')
                          ));
                          if (unsupported) {
                            setSubmitError('Định dạng tệp không được hỗ trợ. Hãy chọn ảnh, PDF, Word, Excel hoặc PowerPoint.');
                            return;
                          }
                          setSubmissionFiles((current) => [...current, ...addedFiles]);
                          setSubmitError('');
                        }}
                        className="sr-only"
                      />
                    </label>
                    <p className="mt-2 text-xs text-slate-500">Tối đa 5 tệp, mỗi tệp không quá 10 MB. Hỗ trợ ảnh, PDF, Word, Excel và PowerPoint.</p>
                    {submissionFiles.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {submissionFiles.map((file, index) => (
                          <li key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-2 text-sm text-slate-700">
                            <FileText className="h-4 w-4 shrink-0 text-blue-700" />
                            <span className="min-w-0 flex-1 truncate">{file.name}</span>
                            <span className="shrink-0 text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                            <button
                              type="button"
                              aria-label={`Xóa tệp ${file.name}`}
                              onClick={() => setSubmissionFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-rose-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
                <section>
                  {selectedAssignmentContent ? (
                    <div className="space-y-4">
                      {assignmentIntroduction && (
                        <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-base leading-7 text-slate-700">
                          <MathText text={assignmentIntroduction} />
                        </div>
                      )}
                      {legacyAssignmentResponse && (
                        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                          <h3 className="text-sm font-semibold text-amber-900">Bài nộp trước đây (chưa tách theo từng câu)</h3>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{legacyAssignmentResponse}</p>
                          {canEditAssignment(selectedAssignment, currentTime) && (
                            <p className="mt-2 text-xs text-amber-900">Hãy nhập lại câu trả lời vào từng câu bên dưới nếu muốn cập nhật bài nộp.</p>
                          )}
                        </section>
                      )}
                      {selectedAssignmentContent.questions.map((question, index) => (
                        <article key={`${question.number}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                          <div className="text-base leading-7 text-slate-800">
                            <MathText text={withAssignmentQuestionPoints(question.content, assignmentQuestionMaximums[index])} />
                          </div>
                          <label className="mt-4 block text-sm font-semibold text-slate-700">
                            Câu trả lời
                            {assignmentAnswerValues[index]?.trim() && editingAnswerIndex !== index ? (
                              canEditAssignment(selectedAssignment, currentTime) ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingAnswerIndex(index)}
                                  aria-label={`Bấm để sửa câu trả lời ${question.number}`}
                                  className="mt-2 block min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-base font-normal leading-7 text-slate-800 hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                  title="Bấm để sửa văn bản và LaTeX"
                                >
                                  <MathText text={assignmentAnswerValues[index] ?? ''} />
                                </button>
                              ) : (
                                <div className="mt-2 min-h-20 rounded-xl border border-slate-200 bg-slate-50 p-4 text-base font-normal leading-7 text-slate-800">
                                  <MathText text={assignmentAnswerValues[index] ?? ''} />
                                </div>
                              )
                            ) : (
                              <textarea
                                autoFocus={editingAnswerIndex === index}
                                ref={(textarea) => {
                                  if (textarea) resizeAnswerTextarea(textarea);
                                }}
                                value={assignmentAnswerValues[index] ?? ''}
                                onChange={(event) => {
                                  const nextAnswers = [...assignmentAnswerValues];
                                  nextAnswers[index] = event.target.value;
                                  responseDraft.current.dirty = true;
                                  setEditingAnswerIndex(index);
                                  resizeAnswerTextarea(event.currentTarget);
                                  setResponseText(serializeAssignmentAnswers(nextAnswers));
                                }}
                                onBlur={() => setEditingAnswerIndex(null)}
                                readOnly={!canEditAssignment(selectedAssignment, currentTime) || formattingAnswerIndex === index}
                                rows={1}
                                maxLength={20000}
                                className="input-field mt-2 min-h-32 w-full resize-none overflow-hidden read-only:bg-slate-50 read-only:text-slate-600"
                                placeholder={`Nhập câu trả lời cho câu ${question.number}...`}
                              />
                            )}
                          </label>
                          {selectedAssignment.score !== null && (
                            <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-bold text-blue-900">
                                  Điểm câu {question.number}:{' '}
                                  {selectedAssignment.questionScores[String(index)] === undefined
                                    ? 'Chưa có điểm riêng'
                                    : `${selectedAssignment.questionScores[String(index)]} / ${assignmentQuestionMaximums[index]}`}
                                </p>
                                {assignmentAnswerValues[index]?.trim() && (
                                  <button
                                    type="button"
                                    onClick={() => onAskAI([
                                      `Mình đang xem lại câu ${question.number} của bài tập "${selectedAssignment.title}" môn ${selectedAssignment.subject}.`,
                                      `Đề bài: ${question.content}`,
                                      `Bài làm của mình: ${assignmentAnswerValues[index]}`,
                                      selectedAssignment.questionFeedback[String(index)]
                                        ? `Lời phê của giáo viên: ${selectedAssignment.questionFeedback[String(index)]}`
                                        : 'Giáo viên chưa ghi lời phê riêng cho câu này.',
                                      selectedAssignment.questionScores[String(index)] !== undefined
                                        ? `Điểm câu: ${selectedAssignment.questionScores[String(index)]} / ${assignmentQuestionMaximums[index]}`
                                        : '',
                                      'Hãy giúp mình hiểu phần nào đúng/chưa rõ và giải thích kiến thức dựa trên nội dung trên. Chỉ hướng dẫn học tập; không chỉnh sửa bài đã nộp và không tự kết luận thay giáo viên.',
                                    ].filter(Boolean).join('\n\n'), selectedAssignment.subject)}
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                                  >
                                    <Sparkles className="h-4 w-4" />Hỏi AI về câu này
                                  </button>
                                )}
                              </div>
                              {selectedAssignment.questionFeedback[String(index)] && (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                  <strong>Lời phê giáo viên: </strong>{selectedAssignment.questionFeedback[String(index)]}
                                </p>
                              )}
                            </section>
                          )}
                          {canEditAssignment(selectedAssignment, currentTime) && (
                            <button
                              type="button"
                              disabled={!assignmentAnswerValues[index]?.trim() || formattingAnswerIndex !== null}
                              onClick={() => void handleFormatAnswer(assignmentAnswerValues[index] ?? '', index)}
                              className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Sparkles className="h-4 w-4" />
                              {formattingAnswerIndex === index ? 'Đang chuẩn hóa...' : 'Chuẩn hóa ký hiệu'}
                            </button>
                          )}
                          {formatAnswerErrorIndex === index && formatAnswerError && (
                            <p role="alert" className="mt-2 text-sm text-rose-700">{formatAnswerError}</p>
                          )}
                        </article>
                      ))}
                      {selectedAssignmentContent.teacherNote && (
                        <p className="whitespace-pre-wrap rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                          <span className="font-semibold">Lời nhắn của giáo viên: </span>
                          {selectedAssignmentContent.teacherNote}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-base leading-7 text-slate-700">{selectedAssignment.description}</div>
                      <label className="mt-5 block text-sm font-semibold text-slate-700">
                        {selectedAssignment.submittedAt ? 'Bài làm đã nộp' : 'Câu trả lời'}
                        {responseText.trim() && !editingPlainAnswer ? (
                          canEditAssignment(selectedAssignment, currentTime) ? (
                            <button
                              type="button"
                              onClick={() => setEditingPlainAnswer(true)}
                              aria-label="Bấm để sửa bài làm"
                              className="mt-2 block min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-base font-normal leading-7 text-slate-800 hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              title="Bấm để sửa văn bản và LaTeX"
                            >
                              <MathText text={responseText} />
                            </button>
                          ) : (
                            <div className="mt-2 min-h-32 rounded-xl border border-slate-200 bg-slate-50 p-4 text-base font-normal leading-7 text-slate-800">
                              <MathText text={responseText} />
                            </div>
                          )
                        ) : (
                          <textarea
                            autoFocus={editingPlainAnswer}
                            ref={(textarea) => {
                              if (textarea) resizeAnswerTextarea(textarea);
                            }}
                            value={responseText}
                            onChange={(event) => {
                              responseDraft.current.dirty = true;
                              setEditingPlainAnswer(true);
                              resizeAnswerTextarea(event.currentTarget);
                              setResponseText(event.target.value);
                            }}
                            onBlur={() => setEditingPlainAnswer(false)}
                            readOnly={!canEditAssignment(selectedAssignment, currentTime) || formattingAnswerIndex === -1}
                            rows={1}
                            maxLength={20000}
                            className="input-field mt-2 min-h-32 w-full resize-none overflow-hidden read-only:bg-slate-50 read-only:text-slate-600"
                            placeholder="Nhập câu trả lời..."
                          />
                        )}
                      </label>
                      {canEditAssignment(selectedAssignment, currentTime) && (
                        <button
                          type="button"
                          disabled={!responseText.trim() || formattingAnswerIndex !== null}
                          onClick={() => void handleFormatAnswer(responseText, -1)}
                          className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Sparkles className="h-4 w-4" />
                          {formattingAnswerIndex === -1 ? 'Đang chuẩn hóa...' : 'Chuẩn hóa ký hiệu'}
                        </button>
                      )}
                      {formatAnswerErrorIndex === -1 && formatAnswerError && (
                        <p role="alert" className="mt-2 text-sm text-rose-700">{formatAnswerError}</p>
                      )}
                    </>
                  )}
                </section>
                {selectedAssignment.files.length > 0 && (
                  <AssignmentSubmissionFiles
                    assignmentId={selectedAssignment.id}
                    files={selectedAssignment.files}
                  />
                )}
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
                    <h1 className="mt-2 text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">{selectedResource.title}</h1>
                  </div>
                  <button type="button" onClick={() => void handleSaveResource(selectedResource)} disabled={saved.loading || Boolean(saved.error)} aria-pressed={savedResourceIds.has(selectedResource.id)} aria-label={savedResourceIds.has(selectedResource.id) ? 'Bỏ lưu tài liệu' : 'Lưu tài liệu'} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    <Star className={`h-4 w-4 ${savedResourceIds.has(selectedResource.id) ? 'fill-amber-400 text-amber-500' : ''}`} />
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
                {(selectedResource.editorDocument || selectedResource.content) && (
                  <section className="mt-7 text-base leading-7 text-slate-700">
                    {selectedResource.editorDocument
                      ? <RichLessonContent document={selectedResource.editorDocument} />
                      : <MathText text={selectedResource.content} variant="lesson" />}
                  </section>
                )}
                {!selectedResource.editorDocument
                  && !selectedResource.content
                  && selectedResource.files.length === 0
                  && (
                    <p role="status" className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      Bài giảng chưa có nội dung để hiển thị. Vui lòng báo giáo viên kiểm tra lại nội dung đã gửi.
                    </p>
                  )}
                {submitError && <p role="alert" className="mt-4 text-sm text-rose-700">{submitError}</p>}
                {saved.error && <p role="alert" className="mt-4 text-sm text-rose-700">{saved.error}</p>}
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
    <div className="animate-fadeIn space-y-6 text-base" style={{ zoom: 0.9 }}>
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
          <div className="flex gap-2">
            <label className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm lớp, môn, giáo viên" className="input-field w-96 h-10 pl-9 pr-3 text-sm" />
            </label>
            <select className="input-field h-10 px-3 text-sm" value={semester} onChange={(event) => setSemester(event.target.value as Semester)}>
              <option value="Kỳ 1">Học kỳ 1</option>
              <option value="Kỳ 2">Học kỳ 2</option>
            </select>
          </div>
        </div>
        {loading ? <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Đang tải lớp học...</p> : null}
        {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{loadError}<button type="button" onClick={() => void refresh()} className="ml-3 font-semibold underline">Thử lại</button></div>}
        {!loading && !loadError && initialResourceId && !groups.some((group) => group.resources.some((item) => item.id === initialResourceId)) && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Không tìm thấy tài liệu này hoặc bạn không còn quyền truy cập.</p>}
        {averageLoadError && !loadError && (
          <p role="alert" className="text-sm text-rose-700">{averageLoadError}</p>
        )}
        {!loading && !loadError && !groups.length && (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <BookOpen className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">Chưa có tài liệu hoặc bài tập</p>
            <p className="mt-1 text-sm text-slate-500">Khi giáo viên đăng nội dung, lớp học sẽ hiển thị tại đây.</p>
          </div>
        )}
        {!loading && !loadError && groups.length > 0 && !filteredGroups.length && <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Không tìm thấy lớp học phù hợp.</p>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredGroups.map((group) => {
            const termAssignments = group.assignments.filter((item) => item.semester === semester && item.submittedAt === null);
            const groupExamResults = examResults.filter((result) => (
              result.classId === group.classId
              && result.academicYear === group.academicYear
              && normalizeSubjectName(result.subject) === normalizeSubjectName(group.subject)
            ));
            const unreadExamCount = groupExamResults.filter((result) => (
              readExamGrades[result.sessionId] !== examGradeRevision(result)
            )).length;
            const subjectAverage = subjectAverages.find((item) =>
              item.classId === group.classId
              && item.subject === group.subject
              && item.academicYear === group.academicYear);
            return (
              <article key={group.key} style={{ zoom: 0.9 }} className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-6">
                <button
                  type="button"
                  aria-label={unreadExamCount > 0
                    ? `Mở kết quả kiểm tra mới môn ${group.subject}`
                    : `Mở tài liệu môn ${group.subject}`}
                  onClick={() => openGroup(group, unreadExamCount > 0 ? 'exam' : 'lesson')}
                  className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-500"
                />
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400" />
                <div className="pointer-events-none relative z-10">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className={`min-w-0 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl ${unreadExamCount > 0 ? 'pr-12' : ''}`}>
                      {group.subject}
                      {group.teacherName && <span className="font-medium text-slate-500"> - {teacherLabel(group.teacherName, group.teacherGender)}</span>}
                    </h2>
                    {unreadExamCount > 0 && (
                      <span
                        aria-label={`${unreadExamCount} kết quả kiểm tra mới`}
                        title={`${unreadExamCount} kết quả kiểm tra mới`}
                        className="absolute right-0 top-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-xl font-black leading-none text-white shadow-md ring-4 ring-rose-100"
                      >
                        !
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex min-h-12 flex-wrap items-baseline gap-x-1 gap-y-1 whitespace-normal sm:gap-x-2">
                    <span className="shrink-0 text-xs font-semibold text-slate-600 sm:text-base">Điểm trung bình môn:</span>
                    <span
                      className="text-3xl font-extrabold leading-none tracking-tight sm:text-5xl"
                      style={{ color: subjectAverage?.average == null ? '#111827' : scoreColor(subjectAverage.average) }}
                    >
                      {subjectAverage?.average == null ? '—' : subjectAverage.average.toFixed(1)}
                    </span>
                    {subjectAverage?.previousAverage != null && (
                      <>
                        <span aria-hidden="true" className="text-lg font-semibold text-slate-400 sm:text-2xl">←</span>
                        <span
                          className="text-xl font-bold leading-none tracking-tight sm:text-3xl"
                          style={{ color: scoreColor(subjectAverage.previousAverage) }}
                        >
                          {subjectAverage.previousAverage.toFixed(1)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mt-4 min-h-6">
                    {termAssignments.length > 0 && (
                      <p className="text-base font-semibold text-rose-700">
                        {termAssignments.length} bài chưa làm
                      </p>
                    )}
                  </div>
                  <div className="pointer-events-auto relative mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                    <button type="button" onClick={() => openGroup(group, 'lesson')} className="min-h-11 rounded-lg bg-blue-600 px-2 text-sm font-semibold text-white transition hover:bg-blue-700">Tài liệu</button>
                    <button type="button" onClick={() => openGroup(group, 'assignment')} className="min-h-11 rounded-lg border border-slate-200 px-2 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">Bài tập</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
