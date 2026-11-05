import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  RefreshCw,
  Send,
  Sparkles,
  TrendingDown,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getClassGradebook,
  getHomeroomClassGradeSummary,
  getTeacherTimetable,
  listClassSubjects,
  listClassLearningResources,
  listClasses,
  listTeacherExamAppeals,
  listTeacherExamRooms,
  type ExamAppeal,
  type GradebookStudent,
  type HomeroomGradeSummary,
  type ProgressSemester,
  type SchoolClass,
  type TeacherTimetableResponse,
} from '@/api/schoolApi';
import type { Page } from '@/types';
import { useDashboardCycle } from '@/hooks/useDashboardCycle';
import studentAiBannerBackground from '@/assets/student-ai-banner-background.jpg';
import type { ExamRoomRecord } from './examRoomDemoData';

interface TeacherDashboardProps {
  userName: string;
  userGender?: 'female' | 'male' | 'other' | 'unspecified' | null;
  onNavigate: (page: Page) => void;
  onAskAI: (prompt: string) => void;
}

interface StudentConcern {
  studentId: string;
  studentName: string;
  subject: string;
  average: number;
  previousAverage: number | null;
  kind: 'low' | 'declining';
}

interface SubjectProgress {
  subject: string;
  average: number | null;
  gradedStudents: number;
  concerns: StudentConcern[];
}

interface ClassProgress {
  classId: string;
  className: string;
  classCode: string;
  isHomeroom: boolean;
  teacherSubjects: string[];
  overallAverage: number | null;
  subjects: SubjectProgress[];
  concerns: StudentConcern[];
}

interface ProgressFilterOption {
  id: string;
  label: string;
  type: 'homeroom' | 'subject';
  classId?: string;
  subject?: string;
}

interface RecentSentDocument {
  id: string;
  title: string;
  subject: string;
  classCode: string;
  className: string;
  createdAt: string;
}

interface TeacherDashboardData {
  classes: SchoolClass[];
  academicYear: string;
  semester: ProgressSemester;
  timetable: TeacherTimetableResponse | null;
  progress: ClassProgress[];
  recentDocuments: RecentSentDocument[];
  appeals: ExamAppeal[];
  examRooms: ExamRoomRecord[];
  sectionErrors: string[];
}

type SectionResult<T> = { value: T; error: null } | { value: null; error: string };

const weekdayLabels = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const LOW_GRADE_THRESHOLD = 5;

function getWeekStart(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekDate(weekStart: string, weekday: number) {
  const [year, month, day] = weekStart.split('-').map(Number);
  if (!year || !month || !day || weekday < 1 || weekday > 7) return null;
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + weekday - 1);
  return date;
}

function getCalendarDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const parsed = new Date(timestamp);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getCurrentSemester(date: Date): ProgressSemester {
  return date.getMonth() >= 7 ? 'Kỳ 1' : 'Kỳ 2';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Ngày chưa xác định';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Thời gian chưa xác định';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isPastDue(value: string) {
  const due = new Date(value);
  if (!Number.isFinite(due.getTime())) return false;
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDay < today;
}

function averageFromGrades(student: GradebookStudent) {
  if (student.confirmedAverage !== null) return student.confirmedAverage;
  const scores = [
    ...student.grades.regular.map((value) => ({ value, weight: 1 })),
    { value: student.grades.midterm, weight: 2 },
    { value: student.grades.final, weight: 3 },
  ].filter((score): score is { value: number; weight: number } => score.value !== null);
  const totalWeight = scores.reduce((sum, score) => sum + score.weight, 0);
  return totalWeight > 0
    ? scores.reduce((sum, score) => sum + score.value * score.weight, 0) / totalWeight
    : null;
}

function averageForSubject(
  subject: string,
  values: Array<{ studentId: string; studentName: string; average: number | null; previousAverage?: number | null }>,
): SubjectProgress {
  const graded = values.filter((student) => student.average !== null);
  const average = graded.length > 0
    ? graded.reduce((sum, student) => sum + (student.average ?? 0), 0) / graded.length
    : null;
  const concerns = graded.flatMap((student) => {
    if (student.average === null) return [];
    const previousAverage = student.previousAverage ?? null;
    const kind: StudentConcern['kind'] | null = student.average < LOW_GRADE_THRESHOLD ? 'low'
      : previousAverage !== null && student.average < previousAverage ? 'declining' : null;
    if (kind === null) return [];
    return [{
      studentId: student.studentId,
      studentName: student.studentName,
      subject,
      average: student.average,
      previousAverage,
      kind,
    }];
  });
  return { subject, average, gradedStudents: graded.length, concerns };
}

async function loadSection<T>(label: string, request: Promise<T>): Promise<SectionResult<T>> {
  try {
    return { value: await request, error: null };
  } catch (requestError) {
    return {
      value: null,
      error: `${label}: ${requestError instanceof Error ? requestError.message : 'Không thể tải dữ liệu.'}`,
    };
  }
}

async function loadClassProgress(
  classItem: SchoolClass,
  academicYear: string,
  semester: ProgressSemester,
): Promise<ClassProgress> {
  if (classItem.is_homeroom) {
    const [summary, teacherSubjects]: [HomeroomGradeSummary, string[]] = await Promise.all([
      getHomeroomClassGradeSummary(classItem.id, academicYear, semester),
      listClassSubjects(classItem.id),
    ]);
    const subjects = summary.subjects.map((subject) => averageForSubject(
      subject,
      summary.students.map((student) => ({
        studentId: student.id,
        studentName: student.fullName,
        average: student.averages[subject] ?? null,
      })),
    ));
    const studentAverages = summary.students.flatMap((student) => {
      const values = Object.values(student.averages)
        .filter((average): average is number => average !== null);
      return values.length > 0
        ? [values.reduce((sum, value) => sum + value, 0) / values.length]
        : [];
    });
    return {
      classId: classItem.id,
      className: classItem.name,
      classCode: classItem.code,
      isHomeroom: true,
      teacherSubjects,
      overallAverage: studentAverages.length > 0
        ? studentAverages.reduce((sum, value) => sum + value, 0) / studentAverages.length
        : null,
      subjects,
      concerns: subjects.flatMap((subject) => subject.concerns),
    };
  }

  const assignedSubjects = await listClassSubjects(classItem.id);
  const gradebooks = await Promise.all(assignedSubjects.map(async (subject) => ({
    subject,
    students: await getClassGradebook(classItem.id, academicYear, semester, subject),
  })));
  const subjects = gradebooks.map(({ subject, students }) => averageForSubject(
    subject,
    students.map((student) => ({
      studentId: student.id,
      studentName: student.fullName,
      average: averageFromGrades(student),
      previousAverage: student.previousConfirmedAverage,
    })),
  ));
  return {
    classId: classItem.id,
    className: classItem.name,
    classCode: classItem.code,
    isHomeroom: false,
    teacherSubjects: assignedSubjects,
    overallAverage: null,
    subjects,
    concerns: subjects.flatMap((subject) => subject.concerns),
  };
}

function SectionHeading({
  icon: Icon,
  children,
  action,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
        <Icon className="h-5 w-5 text-blue-600" />
        {children}
      </h2>
      {action && (
        <button type="button" onClick={action.onClick} className="text-xs font-semibold text-blue-700 hover:text-blue-900">
          {action.label} <ArrowRight className="ml-0.5 inline h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function TeacherDashboard({ userName, userGender, onNavigate, onAskAI }: TeacherDashboardProps) {
  const [dashboard, setDashboard] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [chatPrompt, setChatPrompt] = useState('');
  const [progressFilter, setProgressFilter] = useState('');
  const now = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), [now]);
  const tomorrowWeekday = ((tomorrow.getDay() + 6) % 7) + 1;
  const honorific = userGender === 'male' ? 'thầy' : userGender === 'female' ? 'cô' : 'thầy/cô';
  const greeting = now.getHours() < 11 ? 'buổi sáng' : now.getHours() < 14 ? 'buổi trưa' : now.getHours() < 18 ? 'buổi chiều' : 'buổi tối';

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true);
      setError('');
      setDashboard(null);
      try {
        const classes = await listClasses();
        const academicYear = [...new Set(classes.map((item) => item.academic_year))]
          .sort((first, second) => second.localeCompare(first, 'vi', { numeric: true }))[0] ?? '';
        const semester = getCurrentSemester(tomorrow);
        const currentYearClasses = classes.filter((item) => item.academic_year === academicYear);
        const [timetableResult, appealsResult, examsResult, progressResults, documentResults] = await Promise.all([
          loadSection('Thời khóa biểu', academicYear
            ? getTeacherTimetable(academicYear, semester, getWeekStart(tomorrow))
            : Promise.resolve(null)),
          loadSection('Yêu cầu phúc khảo', listTeacherExamAppeals()),
          loadSection('Lịch kiểm tra', listTeacherExamRooms<ExamRoomRecord>()),
          Promise.all(currentYearClasses.map((classItem) => (
            loadSection(`Tiến độ ${classItem.name}`, loadClassProgress(classItem, academicYear, semester))
          ))),
          Promise.all(currentYearClasses.map((classItem) => (
            loadSection(`Tài liệu ${classItem.name}`, listClassLearningResources(classItem.id).then((resources) => (
              resources.map((resource) => ({
                id: resource.id,
                title: resource.title,
                subject: resource.subject,
                classCode: classItem.code,
                className: classItem.name,
                createdAt: resource.createdAt,
              }))
            )))
          ))),
        ]);
        if (!active) return;
        const sectionErrors = [timetableResult, appealsResult, examsResult, ...progressResults, ...documentResults]
          .flatMap((result) => result.error ? [result.error] : []);
        const recentDocuments = documentResults.flatMap((result) => result.value ?? [])
          .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
          .slice(0, 2);
        setDashboard({
          classes,
          academicYear,
          semester,
          timetable: timetableResult.value,
          appeals: appealsResult.value ?? [],
          examRooms: examsResult.value ?? [],
          progress: progressResults.flatMap((result) => result.value ? [result.value] : []),
          recentDocuments,
          sectionErrors,
        });
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Không thể tải dữ liệu trang tổng quan.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadDashboard();
    return () => { active = false; };
  }, [retryToken, tomorrow]);

  const tomorrowEntries = useMemo(() => {
    if (!dashboard?.timetable || dashboard.timetable.timetable?.isTemplate) return [];
    return dashboard.timetable.entries
      .filter((entry) => entry.weekday === tomorrowWeekday && entry.type !== 'cancelled')
      .sort((first, second) => first.period - second.period);
  }, [dashboard, tomorrowWeekday]);
  const upcomingWork = useMemo(() => {
    return [...(dashboard?.timetable?.upcomingWork ?? [])]
      .sort((first, second) => new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime());
  }, [dashboard]);
  const upcomingExams = useMemo(() => (
    [...(dashboard?.examRooms ?? [])]
      .filter((room) => room.status !== 'draft' && new Date(room.startsAt).getTime() >= now.getTime())
      .sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime())
  ), [dashboard, now]);
  const pendingAppeals = dashboard?.appeals.filter((appeal) => appeal.status === 'pending') ?? [];
  const timetableWeek = dashboard?.timetable?.timetable;
  const scheduleExamKeys = new Set<string>();
  const timetableAttentionItems = timetableWeek && !timetableWeek.isTemplate
    ? (dashboard?.timetable?.entries ?? []).flatMap((entry) => {
      const scheduledDate = getWeekDate(timetableWeek.weekStart, entry.weekday);
      if (!scheduledDate) return [];
      const items = [];
      if (entry.hasExam) {
        const examDateTime = entry.examStartsAt || entry.dueAt;
        const examDate = examDateTime ? getCalendarDate(examDateTime) : scheduledDate;
        const examHasNotStarted = !examDateTime || Date.parse(examDateTime) >= now.getTime();
        if (examDate && examDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && examHasNotStarted) {
          const title = entry.examTitle || entry.title || 'Bài kiểm tra';
          scheduleExamKeys.add(`${title.trim().toLocaleLowerCase('vi')}:${getDateKey(examDate)}`);
          items.push({
            id: `scheduled-exam-${getDateKey(examDate)}-${entry.classId}-${entry.period}`,
            title: `Sắp kiểm tra: ${title}`,
            detail: `${entry.classCode} · ${entry.subject} · ${examDate.toLocaleDateString('vi-VN')}`,
            tone: 'rose' as const,
            icon: CalendarClock,
            onClick: () => onNavigate('schedule'),
          });
        }
      }
      if (entry.hasExamReturn) {
        const returnDateTime = entry.examReturnAt || (entry.type === 'exam_return' ? entry.dueAt : null);
        const returnDate = returnDateTime ? getCalendarDate(returnDateTime) : scheduledDate;
        const returnIsUpcoming = !returnDateTime || Date.parse(returnDateTime) >= now.getTime();
        if (returnDate && returnDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && returnIsUpcoming) {
          items.push({
            id: `scheduled-return-${getDateKey(returnDate)}-${entry.classId}-${entry.period}`,
            title: `Lịch trả bài: ${entry.examReturnNote || entry.classCode}`,
            detail: `${entry.classCode} · ${entry.subject} · ${returnDate.toLocaleDateString('vi-VN')}`,
            tone: 'blue' as const,
            icon: CalendarDays,
            onClick: () => onNavigate('schedule'),
          });
        }
      }
      if (entry.hasHomework) {
        const homeworkDueAt = entry.homeworkDueAt || entry.dueAt;
        const homeworkDate = homeworkDueAt ? getCalendarDate(homeworkDueAt) : scheduledDate;
        const dueTimestamp = homeworkDueAt ? Date.parse(homeworkDueAt) : scheduledDate.getTime();
        if (homeworkDate
          && dueTimestamp >= now.getTime()
          && dueTimestamp - now.getTime() <= 3 * 24 * 60 * 60 * 1000) {
          items.push({
            id: `scheduled-homework-${getDateKey(homeworkDate)}-${entry.classId}-${entry.period}`,
            title: `BTVN sắp đến hạn: ${entry.homeworkTitle || entry.title || entry.subject}`,
            detail: `${entry.classCode} · ${entry.subject} · ${homeworkDate.toLocaleDateString('vi-VN')}`,
            tone: 'amber' as const,
            icon: CalendarDays,
            onClick: () => onNavigate('schedule'),
          });
        }
      }
      return items;
    })
    : [];
  const studentConcerns = (dashboard?.progress ?? []).flatMap((classProgress) => (
    classProgress.concerns.map((concern) => ({
      ...concern,
      className: classProgress.className,
      classCode: classProgress.classCode,
    }))
  ));
  const progressFilterOptions = useMemo(() => {
    const homeroomOptions: ProgressFilterOption[] = (dashboard?.progress ?? [])
      .filter((classProgress) => classProgress.isHomeroom)
      .map((classProgress) => ({
        id: `homeroom:${classProgress.classId}`,
        label: `Lớp chủ nhiệm - ${classProgress.classCode}`,
        type: 'homeroom',
        classId: classProgress.classId,
      }));
    const subjects = new Map<string, string>();
    (dashboard?.progress ?? []).forEach((classProgress) => {
      classProgress.teacherSubjects.forEach((subject) => {
        const key = subject.trim().toLocaleLowerCase('vi');
        if (key && !subjects.has(key)) subjects.set(key, subject);
      });
    });
    const subjectOptions: ProgressFilterOption[] = [...subjects.entries()]
      .map(([key, subject]) => ({
        id: `subject:${key}`,
        label: `Môn ${subject}`,
        type: 'subject',
        subject,
      }));
    return [...homeroomOptions, ...subjectOptions];
  }, [dashboard]);
  const selectedProgressFilter = progressFilterOptions.find((option) => option.id === progressFilter)
    ?? progressFilterOptions[0];
  const selectedHomeroomProgress = selectedProgressFilter?.type === 'homeroom'
    ? dashboard?.progress.find((classProgress) => classProgress.classId === selectedProgressFilter.classId)
    : undefined;
  const selectedSubjectProgress = selectedProgressFilter?.type === 'subject'
    ? (dashboard?.progress ?? []).flatMap((classProgress) => {
      const teacherTeachesSubject = classProgress.teacherSubjects.some(
        (subject) => subject.toLocaleLowerCase('vi') === selectedProgressFilter.subject?.toLocaleLowerCase('vi'),
      );
      if (!teacherTeachesSubject) return [];
      const subjectProgress = classProgress.subjects.find(
        (subject) => subject.subject.toLocaleLowerCase('vi') === selectedProgressFilter.subject?.toLocaleLowerCase('vi'),
      );
      return subjectProgress ? [{ classProgress, subjectProgress }] : [];
    })
    : [];
  const homeroomProgressItems = [...(selectedHomeroomProgress?.subjects ?? [])]
    .sort((first, second) => (first.average ?? Infinity) - (second.average ?? Infinity));
  const subjectProgressItems = [...selectedSubjectProgress]
    .sort((first, second) => (first.subjectProgress.average ?? Infinity) - (second.subjectProgress.average ?? Infinity));
  const progressCycle = useDashboardCycle(
    selectedProgressFilter?.type === 'homeroom' ? homeroomProgressItems.length : subjectProgressItems.length,
    4,
    1_000,
    selectedProgressFilter?.id,
  );
  const tomorrowCycle = useDashboardCycle(tomorrowEntries.length, 2, 2_000);
  const tomorrowDateLabel = tomorrow.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

  const submitChatPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = chatPrompt.trim();
    if (!prompt) return;
    onAskAI(prompt);
  };

  const attentionItems = [
    ...pendingAppeals.slice(0, 3).map((appeal) => ({
      id: `appeal-${appeal.id}`,
      title: `Phúc khảo: ${appeal.examTitle}`,
      detail: `${appeal.studentName ?? 'Học sinh'} - ${appeal.className} - ${appeal.subject}`,
      tone: 'rose' as const,
      icon: ClipboardCheck,
      onClick: () => onNavigate('ai-grading'),
    })),
    ...timetableAttentionItems,
    ...studentConcerns.slice(0, 4).map((student) => ({
      id: `student-${student.studentId}-${student.subject}`,
      title: student.kind === 'low' ? `${student.studentName} có điểm thấp` : `Điểm ${student.studentName} đang giảm`,
      detail: `${student.classCode} - ${student.subject} ${student.average.toFixed(1)}${student.previousAverage !== null && student.average < student.previousAverage ? ` - trước ${student.previousAverage.toFixed(1)}` : ''}`,
      tone: student.kind === 'low' ? 'amber' as const : 'blue' as const,
      icon: student.kind === 'low' ? AlertTriangle : TrendingDown,
      onClick: () => onNavigate('analytics'),
    })),
    ...upcomingExams
      .filter((room) => new Date(room.startsAt).getTime() - now.getTime() <= 48 * 60 * 60 * 1000)
      .filter((room) => {
        const examDate = getCalendarDate(room.startsAt);
        return !examDate || !scheduleExamKeys.has(
          `${room.title.trim().toLocaleLowerCase('vi')}:${getDateKey(examDate)}`,
        );
      })
      .slice(0, 3)
      .map((room) => ({
        id: `exam-${room.id}`,
        title: `Sắp kiểm tra: ${room.title}`,
        detail: `${room.classNames.join(', ')} - ${formatDateTime(room.startsAt)}`,
        tone: 'rose' as const,
        icon: CalendarClock,
        onClick: () => onNavigate('exam-monitor'),
      })),
    ...upcomingWork
      .filter((work) => {
        const due = new Date(work.dueAt).getTime();
        return isPastDue(work.dueAt)
          || (due >= now.getTime() && due - now.getTime() <= 3 * 24 * 60 * 60 * 1000);
      })
      .slice(0, 3)
      .map((work) => ({
        id: `due-${work.id}`,
        title: `${isPastDue(work.dueAt) ? 'Quá hạn' : 'Sắp đến hạn'}: ${work.title}`,
        detail: `${work.classCode} - Hạn ${formatDateTime(work.dueAt)}`,
        tone: 'amber' as const,
        icon: CalendarDays,
        onClick: () => onNavigate('classes'),
      })),
    ...upcomingWork
      .filter((work) => work.ungradedCount > 0)
      .slice(0, 3)
      .map((work) => ({
        id: `grading-${work.id}`,
        title: `${work.ungradedCount} bài chưa chấm`,
        detail: `${work.title} - ${work.classCode}`,
        tone: 'rose' as const,
        icon: ClipboardCheck,
        onClick: () => onNavigate('ai-grading'),
      })),
  ];
  const attentionCycle = useDashboardCycle(attentionItems.length, 2, 3_000);

  return (
    <main className="mx-auto w-full max-w-screen-2xl pb-6 text-slate-900">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(300px,1fr)]">
        <div className="min-w-0 space-y-3">
      <section className="relative isolate min-h-[310px] overflow-hidden rounded-2xl border border-blue-300 bg-blue-700 p-4 text-white shadow-lg shadow-blue-900/20 sm:min-h-[326px] sm:p-5">
        <img
          src={studentAiBannerBackground}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[62%_center] sm:object-center"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-blue-950/40 via-blue-900/15 to-transparent" />
        <div className="relative z-10 flex min-h-[270px] flex-col justify-center sm:min-h-[286px] sm:max-w-[76%]">
          <p className="text-lg font-bold tracking-wide text-white sm:text-xl">Chào {greeting}, {honorific} {userName}</p>
          <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
            Dạy đúng trọng tâm.<br className="hidden sm:block" /> Tiến bộ <span className="text-amber-300">từng ngày.</span>
          </h1>
          <form onSubmit={submitChatPrompt} className="mt-4 flex w-full items-center gap-2 rounded-full border border-white/70 bg-white p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.2)] ring-4 ring-white/15 focus-within:ring-cyan-200/50">
            <Sparkles aria-hidden="true" className="ml-2 h-5 w-5 shrink-0 text-blue-500" />
            <label htmlFor="teacher-dashboard-ai-prompt" className="sr-only">Hỏi trợ lý AI EduFlow</label>
            <input
              id="teacher-dashboard-ai-prompt"
              value={chatPrompt}
              onChange={(event) => setChatPrompt(event.target.value)}
              placeholder="Thầy/cô muốn chuẩn bị gì hôm nay?"
              className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button type="submit" aria-label="Gửi câu hỏi cho AI" disabled={!chatPrompt.trim()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </form>
          <nav aria-label="Lối tắt công cụ AI giáo viên" className="mt-3 flex flex-wrap gap-2">
            {([
              { page: 'lesson-builder', label: 'Soạn bài với AI', Icon: BookOpen },
              { page: 'exams', label: 'Tạo đề kiểm tra', Icon: FileCheck2 },
              { page: 'analytics', label: 'Phân tích lớp học', Icon: BarChart3 },
            ] as const).map(({ page, label, Icon }) => (
              <button key={page} type="button" onClick={() => onNavigate(page)} className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-2 text-[10px] font-bold text-blue-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600 sm:text-xs">
                <Icon className="h-4 w-4 shrink-0 text-blue-600" />
                <span>{label}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              </button>
            ))}
          </nav>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryToken((token) => token + 1)} className="inline-flex items-center gap-1.5 font-bold hover:text-rose-950">
            <RefreshCw className="h-4 w-4" /> Thử tải lại
          </button>
        </div>
      )}
      {dashboard?.sectionErrors.map((sectionError) => (
        <p key={sectionError} role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{sectionError}</p>
      ))}

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <SectionHeading
                icon={CalendarDays}
                action={{ label: 'Xem quản lý lớp', onClick: () => onNavigate('classes') }}
              >
                Bài tập &amp; kiểm tra gần đây
              </SectionHeading>
            </div>
            {loading ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">Đang tải bài tập và lịch kiểm tra…</p>
            ) : !dashboard ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">Chưa có dữ liệu để hiển thị.</p>
            ) : upcomingWork.length === 0 && upcomingExams.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
                Chưa có bài tập hoặc bài kiểm tra sắp tới.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 px-5">
                {upcomingWork.slice(0, 4).map((work) => (
                  <li key={`work-${work.id}`}>
                    <button type="button" onClick={() => onNavigate(work.ungradedCount > 0 ? 'ai-grading' : 'classes')} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-blue-50">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${work.ungradedCount ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                        {work.ungradedCount ? <ClipboardCheck className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{work.title}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500">{work.classCode} - Hạn {formatDate(work.dueAt)} - {work.submittedCount} đã nộp</span>
                      </span>
                      {work.ungradedCount > 0 && <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1.5 text-[10px] font-semibold text-rose-700">{work.ungradedCount} chưa chấm</span>}
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  </li>
                ))}
                {upcomingExams.slice(0, 4).map((room) => (
                  <li key={`exam-${room.id}`}>
                    <button type="button" onClick={() => onNavigate('exam-monitor')} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-blue-50">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><CalendarClock className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">Kiểm tra: {room.title}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500">{room.classNames.join(', ')} - {formatDateTime(room.startsAt)}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Trophy className="h-5 w-5 text-blue-600" />
                Tiến độ học tập của lớp
              </h2>
              <button type="button" onClick={() => onNavigate('analytics')} className="text-xs font-semibold text-blue-700 hover:text-blue-900">
                Chi tiết <ArrowRight className="ml-0.5 inline h-3.5 w-3.5" />
              </button>
            </div>
            {loading ? (
              <p className="py-6 text-center text-xs text-slate-500">Đang tải sổ điểm…</p>
            ) : !selectedProgressFilter ? (
              <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs text-slate-600">Chưa có dữ liệu điểm thực để hiển thị.</div>
            ) : (
              <div
                onMouseEnter={() => progressCycle.setPaused(true)}
                onMouseLeave={() => progressCycle.setPaused(false)}
                onFocus={() => progressCycle.setPaused(true)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) progressCycle.setPaused(false);
                }}
              >
                <label htmlFor="teacher-progress-filter" className="sr-only">Lọc tiến độ lớp</label>
                <select
                  id="teacher-progress-filter"
                  value={selectedProgressFilter.id}
                  onChange={(event) => setProgressFilter(event.target.value)}
                  className="mb-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {progressFilterOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                {selectedProgressFilter.type === 'homeroom' && selectedHomeroomProgress ? (
                  <>
                    <div className="mb-2 flex items-end gap-2 border-b border-slate-100 pb-2">
                      <strong className="text-3xl font-extrabold leading-none text-slate-900">
                        {selectedHomeroomProgress.overallAverage === null ? '—' : selectedHomeroomProgress.overallAverage.toFixed(1)}
                      </strong>
                      <span className="pb-0.5 text-[10px] text-slate-500">/10 - điểm trung bình toàn lớp</span>
                    </div>
                    <div className="student-dashboard-cycle-viewport h-[176px]">
                      <div
                        className="student-dashboard-cycle-track h-full"
                        style={{
                          width: `${progressCycle.pageCount * 100}%`,
                          transform: `translateX(-${progressCycle.page * 100 / Math.max(progressCycle.pageCount, 1)}%)`,
                        }}
                      >
                        {Array.from({ length: progressCycle.pageCount }, (_, page) => (
                          <div key={page} className="student-dashboard-cycle-page grid h-full grid-rows-4 gap-1" style={{ flexBasis: `${100 / progressCycle.pageCount}%` }}>
                            {homeroomProgressItems.slice(page * 4, page * 4 + 4).map((subject) => (
                              <div key={`${selectedHomeroomProgress.classId}-${subject.subject}`} className="flex min-h-0 flex-col justify-center">
                                <div className="mb-1 flex justify-between gap-2 text-xs">
                                  <span className="truncate font-medium text-slate-700">{subject.subject}</span>
                                  <strong className="shrink-0 text-slate-800">{subject.average === null ? '—' : subject.average.toFixed(1)}</strong>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                  {subject.average !== null && (
                                    <div className={`h-full rounded-full ${subject.average < LOW_GRADE_THRESHOLD ? 'bg-rose-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, Math.max(0, subject.average * 10))}%` }} />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div aria-hidden="true" className="mt-2 flex h-2 items-center justify-center gap-1">
                      {progressCycle.pageCount > 1 && Array.from({ length: progressCycle.pageCount }, (_, index) => (
                          <span key={index} className={`h-1.5 w-1.5 rounded-full ${index === progressCycle.page ? 'bg-blue-600' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                  </>
                ) : selectedSubjectProgress.length > 0 ? (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-medium text-slate-500">
                      <span>Lớp</span>
                      <span>Điểm trung bình lớp</span>
                    </div>
                    <div className="student-dashboard-cycle-viewport h-[176px]">
                      <div
                        className="student-dashboard-cycle-track h-full"
                        style={{
                          width: `${progressCycle.pageCount * 100}%`,
                          transform: `translateX(-${progressCycle.page * 100 / Math.max(progressCycle.pageCount, 1)}%)`,
                        }}
                      >
                        {Array.from({ length: progressCycle.pageCount }, (_, page) => (
                          <div key={page} className="student-dashboard-cycle-page grid h-full grid-rows-4 gap-1" style={{ flexBasis: `${100 / progressCycle.pageCount}%` }}>
                            {subjectProgressItems.slice(page * 4, page * 4 + 4).map(({ classProgress, subjectProgress }) => (
                              <div key={`${classProgress.classId}-${subjectProgress.subject}`} className="flex min-h-0 flex-col justify-center">
                                <div className="mb-0.5 flex justify-between gap-2 text-xs">
                                  <span className="truncate font-medium text-slate-700">{classProgress.classCode}</span>
                                  <strong className="shrink-0 text-slate-800">{subjectProgress.average === null ? '—' : subjectProgress.average.toFixed(1)}</strong>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                  {subjectProgress.average !== null && (
                                    <div className={`h-full rounded-full ${subjectProgress.average < LOW_GRADE_THRESHOLD ? 'bg-rose-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, Math.max(0, subjectProgress.average * 10))}%` }} />
                                  )}
                                </div>
                                <div aria-hidden="true" className="mt-0.5 h-3" />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div aria-hidden="true" className="mt-2 flex h-2 items-center justify-center gap-1">
                      {progressCycle.pageCount > 1 && Array.from({ length: progressCycle.pageCount }, (_, index) => (
                          <span key={index} className={`h-1.5 w-1.5 rounded-full ${index === progressCycle.page ? 'bg-blue-600' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-5 text-center text-xs text-slate-500">Chưa có điểm cho bộ lọc đã chọn.</p>
                )}
              </div>
            )}
          </section>
      </div>
      </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <SectionHeading icon={CalendarClock}>Cần chú ý</SectionHeading>
            <div
              onMouseEnter={() => attentionCycle.setPaused(true)}
              onMouseLeave={() => attentionCycle.setPaused(false)}
              onFocus={() => attentionCycle.setPaused(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) attentionCycle.setPaused(false);
              }}
            >
              <div className="student-dashboard-cycle-viewport h-[136px]">
                {loading ? (
                  <p className="flex h-full items-center justify-center text-xs text-slate-500">Đang tải thông tin cần chú ý…</p>
                ) : attentionItems.length > 0 ? (
                  <div
                    className="student-dashboard-cycle-track h-full"
                    style={{
                      width: `${attentionCycle.pageCount * 100}%`,
                      transform: `translateX(-${attentionCycle.page * 100 / Math.max(attentionCycle.pageCount, 1)}%)`,
                    }}
                  >
                    {Array.from({ length: attentionCycle.pageCount }, (_, page) => {
                      const pageItems = attentionItems.slice(page * 2, page * 2 + 2);
                      return (
                        <div
                          key={page}
                          aria-hidden={page !== attentionCycle.page}
                          className="student-dashboard-cycle-page space-y-2"
                          style={{ flexBasis: `${100 / attentionCycle.pageCount}%` }}
                        >
                          {pageItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                tabIndex={page === attentionCycle.page ? 0 : -1}
                                onClick={item.onClick}
                                className={`flex h-16 w-full items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition ${item.tone === 'rose' ? 'border-rose-100 bg-rose-50/70 hover:bg-rose-50' : item.tone === 'blue' ? 'border-blue-100 bg-blue-50/70 hover:bg-blue-50' : 'border-amber-100 bg-amber-50/70 hover:bg-amber-50'}`}
                              >
                                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ${item.tone === 'rose' ? 'text-rose-600' : item.tone === 'blue' ? 'text-blue-700' : 'text-amber-700'}`}><Icon className="h-5 w-5" /></span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-bold text-slate-900">{item.title}</span>
                                  <span className="mt-1 block truncate text-[11px] text-slate-600">{item.detail}</span>
                                </span>
                                <ArrowRight className={`h-4 w-4 shrink-0 ${item.tone === 'rose' ? 'text-rose-600' : item.tone === 'blue' ? 'text-blue-700' : 'text-amber-700'}`} />
                              </button>
                            );
                          })}
                          {pageItems.length < 2 && <div aria-hidden="true" className="h-16" />}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                    {dashboard ? 'Chưa có mục nào cần chú ý.' : 'Chưa có dữ liệu để hiển thị.'}
                  </p>
                )}
              </div>
              <div aria-hidden="true" className="mt-2 flex h-2 items-center justify-center gap-1">
                {attentionCycle.pageCount > 1 && Array.from({ length: attentionCycle.pageCount }, (_, index) => (
                  <span key={index} className={`h-1.5 w-1.5 rounded-full ${index === attentionCycle.page ? 'bg-blue-600' : 'bg-slate-200'}`} />
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                Lịch ngày mai - {tomorrowDateLabel}
              </h2>
              <button type="button" onClick={() => onNavigate('schedule')} className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900">
                Thời khóa biểu <ArrowRight className="ml-0.5 inline h-3.5 w-3.5" />
              </button>
            </div>
            <div
              onMouseEnter={() => tomorrowCycle.setPaused(true)}
              onMouseLeave={() => tomorrowCycle.setPaused(false)}
              onFocus={() => tomorrowCycle.setPaused(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) tomorrowCycle.setPaused(false);
              }}
            >
              <div className="student-dashboard-cycle-viewport h-[192px]">
                {loading ? (
                  <p className="flex h-full items-center justify-center text-sm text-slate-500">Đang tải lịch…</p>
                ) : dashboard?.timetable?.timetable?.isTemplate ? (
                  <p className="flex h-full items-center justify-center rounded-lg bg-blue-50 px-4 text-sm leading-6 text-blue-800">
                    Đang dùng lịch mẫu, chưa có lịch riêng cho tuần này.
                  </p>
                ) : tomorrowEntries.length > 0 ? (
                  <div
                    className="student-dashboard-cycle-track h-full"
                    style={{
                      width: `${tomorrowCycle.pageCount * 100}%`,
                      transform: `translateX(-${tomorrowCycle.page * 100 / Math.max(tomorrowCycle.pageCount, 1)}%)`,
                    }}
                  >
                    {Array.from({ length: tomorrowCycle.pageCount }, (_, page) => {
                      const pageEntries = tomorrowEntries.slice(page * 2, page * 2 + 2);
                      return (
                        <ul
                          key={page}
                          aria-hidden={page !== tomorrowCycle.page}
                          className="student-dashboard-cycle-page divide-y divide-slate-100"
                          style={{ flexBasis: `${100 / tomorrowCycle.pageCount}%` }}
                        >
                          {pageEntries.map((entry, index) => (
                            <li key={`${entry.classId}-${entry.period}-${index}`}>
                              <button
                                type="button"
                                tabIndex={page === tomorrowCycle.page ? 0 : -1}
                                onClick={() => onNavigate('schedule')}
                                className="flex h-24 w-full items-center gap-4 overflow-hidden py-4 text-left transition hover:bg-blue-50"
                              >
                                <span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 text-blue-800">
                                  <span className="text-[10px] font-medium text-slate-500">{weekdayLabels[entry.weekday]}</span>
                                  <span className="text-xl font-extrabold leading-6">Tiết {entry.period}</span>
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-bold text-slate-800">{entry.subject} - {entry.classCode}</span>
                                  <span className="mt-1 block truncate text-xs text-slate-500">{entry.title || entry.topic || 'Buổi học theo thời khóa biểu'}</span>
                                  {entry.hasExam && <span className="mt-1 block truncate text-xs font-semibold text-rose-700">Có kiểm tra: {entry.examTitle}</span>}
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                              </button>
                            </li>
                          ))}
                          {pageEntries.length < 2 && <li aria-hidden="true" className="h-24" />}
                        </ul>
                      );
                    })}
                  </div>
                ) : (
                  <p className="flex h-full items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-sm leading-6 text-slate-600">
                    {dashboard ? 'Chưa có tiết dạy ngày mai được lưu trong thời khóa biểu.' : 'Chưa có dữ liệu lịch để hiển thị.'}
                  </p>
                )}
              </div>
              <div aria-hidden="true" className="mt-2 flex h-2 items-center justify-center gap-1">
                {tomorrowCycle.pageCount > 1 && Array.from({ length: tomorrowCycle.pageCount }, (_, index) => (
                  <span key={index} className={`h-1.5 w-1.5 rounded-full ${index === tomorrowCycle.page ? 'bg-blue-600' : 'bg-slate-200'}`} />
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <FileCheck2 className="h-5 w-5 text-blue-600" />
                Tài liệu đã gửi
              </h2>
              <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">2 gần nhất</span>
            </div>
            {loading ? <p className="py-5 text-sm text-slate-500">Đang tải tài liệu đã gửi…</p>
              : dashboard?.recentDocuments.length ? (
                <ul className="divide-y divide-slate-100">
                  {dashboard.recentDocuments.map((document) => (
                    <li key={`${document.classCode}-${document.id}`}>
                      <button type="button" onClick={() => onNavigate('lessons')} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-blue-50">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                          <FileCheck2 className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{document.title}</span>
                          <span className="mt-1 block truncate text-xs text-slate-500">
                            {document.subject} - {document.classCode} - {formatDateTime(document.createdAt)}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-5 text-center">
                  <p className="text-sm text-slate-600">Chưa có tài liệu nào được gửi cho các lớp.</p>
                  <button type="button" onClick={() => onNavigate('lessons')} className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900">
                    Mở kho bài giảng <ArrowRight className="ml-0.5 inline h-3.5 w-3.5" />
                  </button>
                </div>
              )}
          </section>
        </aside>
      </div>
    </main>
  );
}
