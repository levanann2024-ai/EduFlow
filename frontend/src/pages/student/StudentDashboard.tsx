import { useEffect, useState } from 'react';
import type { FormEvent, TransitionEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Send,
  Sparkles,
  TrendingDown,
  Trophy,
} from 'lucide-react';
import {
  getStudentProgress,
  getStudentTimetable,
  listStudentExamAppeals,
  listStudentExamRooms,
  type ExamAppeal,
  type ProgressSemester,
  type StudentProgressData,
  type StudentExamRoom,
  type StudentTimetableResponse,
} from '@/api/schoolApi';
import type { Page } from '@/types';
import { AiImageAttachment } from '@/components/AiImageAttachment';
import studentAiBannerBackground from '@/assets/student-ai-banner-background.jpg';
import { studentResults } from './studentResults';
import { StudentSubjectCard } from './StudentSubjectCard';
import { useDashboardCycle } from '@/hooks/useDashboardCycle';

interface StudentDashboardProps {
  userName: string;
  onNavigate: (page: Page) => void;
  onOpenAssignment: (subject: string, assignmentId?: string) => void;
  onOpenResources: (subjectCode: string) => void;
  onOpenAssignments: (subjectCode: string, topic?: string) => void;
  onAskAI: (prompt: string, image?: File) => void;
}

const subjects = [
  { code: 'TOAN10', name: 'Toán học', lessons: '18/35', resources: 12, tasks: 3, progress: 51 },
  { code: 'VAN10', name: 'Ngữ văn', lessons: '20/35', resources: 10, tasks: 0, progress: 57 },
  { code: 'LY10', name: 'Vật lý', lessons: '14/28', resources: 8, tasks: 2, progress: 50 },
  { code: 'HOA10', name: 'Hóa học', lessons: '12/28', resources: 6, tasks: 1, progress: 43 },
  { code: 'ANH10', name: 'Tiếng Anh', lessons: '22/28', resources: 10, tasks: 1, progress: 78 },
  { code: 'TIN10', name: 'Tin học', lessons: '32/35', resources: 8, tasks: 0, progress: 91 },
  { code: 'SINH10', name: 'Sinh học', lessons: '22/35', resources: 8, tasks: 0, progress: 63 },
  { code: 'SU10', name: 'Lịch sử', lessons: '24/35', resources: 7, tasks: 1, progress: 69 },
  { code: 'DIA10', name: 'Địa lý', lessons: '0/1', resources: 1, tasks: 0, progress: 0 },
  { code: 'GDTC10', name: 'Giáo dục thể chất', lessons: '0/1', resources: 1, tasks: 0, progress: 0 },
] as const;

function parseVietnameseDate(value: string) {
  const [day, month, year] = value.split('/').map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

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

function getCountdownLabel(date: Date, today: Date) {
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  return `Còn ${days} ngày`;
}

function isWithinRecentDays(value: string | null, now: number, days: number) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    && timestamp <= now
    && timestamp >= now - days * 86_400_000;
}

function getCurrentSemester(date: Date): ProgressSemester {
  return date.getMonth() >= 7 ? 'Kỳ 1' : 'Kỳ 2';
}

function SubjectCarousel({
  onNavigate,
  onOpenResources,
  onOpenAssignments,
}: {
  onNavigate: (page: Page) => void;
  onOpenResources: (subjectCode: string) => void;
  onOpenAssignments: (subjectCode: string, topic?: string) => void;
}) {
  const repeatedSubjects = [...subjects, ...subjects];
  const [slideIndex, setSlideIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const interval = window.setInterval(() => {
      setSlideIndex((index) => index + 1);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [paused]);

  const handleSlideTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || slideIndex !== subjects.length) return;
    setTransitionEnabled(false);
    window.requestAnimationFrame(() => {
      setSlideIndex(0);
      window.requestAnimationFrame(() => setTransitionEnabled(true));
    });
  };

  const showPreviousSubject = () => {
    if (slideIndex === 0) {
      setTransitionEnabled(false);
      setSlideIndex(subjects.length);
      window.requestAnimationFrame(() => {
        setTransitionEnabled(true);
        window.requestAnimationFrame(() => setSlideIndex(subjects.length - 1));
      });
      return;
    }
    setSlideIndex((index) => index - 1);
  };

  return (
    <section aria-label="Môn học của bạn" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <BookOpen className="h-4 w-4 text-blue-600" />
          Môn học của bạn
        </h2> 
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onNavigate('my-classes')} className="mr-2 text-[0.625rem] font-semibold text-blue-700 hover:text-blue-900">
            Xem tất cả <ArrowRight className="ml-0.5 inline h-3 w-3" />
          </button>
          <button type="button" aria-label="Môn học trước" onClick={showPreviousSubject} className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-blue-300 hover:text-blue-700">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Môn học tiếp theo" onClick={() => setSlideIndex((index) => index + 1)} className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-blue-300 hover:text-blue-700">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        className="student-subject-marquee"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
        }}
      >
        <div
          className="student-subject-marquee-track"
          onTransitionEnd={handleSlideTransitionEnd}
          style={{
            transform: `translateX(-${slideIndex * 5}%)`,
            transition: transitionEnabled ? 'transform 700ms ease-in-out' : 'none',
          }}
        >
          {repeatedSubjects.map((subject, index) => (
            <span key={`${subject.code}-${index}`} aria-hidden={index >= subjects.length} className="student-subject-card">
              <StudentSubjectCard
                artworkKey={subject.code}
                name={`${subject.name} 10`}
                lessons={subject.lessons}
                resources={subject.resources}
                assignments={subject.tasks}
                progress={subject.progress}
                isClone={index >= subjects.length}
                onLessonsClick={() => onNavigate('schedule')}
                onResourcesClick={() => onOpenResources(subject.code)}
                onAssignmentsClick={() => onOpenAssignments(subject.code)}
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StudentDashboard({
  userName,
  onNavigate,
  onOpenAssignment,
  onOpenResources,
  onOpenAssignments,
  onAskAI,
}: StudentDashboardProps) {
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatImage, setChatImage] = useState<File | null>(null);
  const [activityFilter, setActivityFilter] = useState<'upcoming' | 'submitted' | 'graded'>('upcoming');
  const [liveProgress, setLiveProgress] = useState<StudentProgressData | null>(null);
  const [tomorrowTimetable, setTomorrowTimetable] = useState<StudentTimetableResponse | null>(null);
  const [upcomingTimetables, setUpcomingTimetables] = useState<Array<{
    weekStart: string;
    timetable: StudentTimetableResponse;
  }>>([]);
  const [studentExamRooms, setStudentExamRooms] = useState<StudentExamRoom[]>([]);
  const [studentAppeals, setStudentAppeals] = useState<ExamAppeal[]>([]);
  const [liveDataError, setLiveDataError] = useState('');
  const [loadingLiveData, setLoadingLiveData] = useState(true);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const tomorrow = new Date(startOfToday);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowWeekday = ((tomorrow.getDay() + 6) % 7) + 1;
  const weekdayLabels = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const upcomingExams = (liveProgress?.upcomingExams ?? [])
    .filter((exam) => new Date(exam.startsAt).getTime() >= Date.now())
    .sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime());
  const liveAssignments = (liveProgress?.assignments ?? [])
    .filter((assignment) => assignment.submittedAt === null)
    .sort((first, second) => new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime());
  const upcomingLearningItems = (() => {
    type LearningItem = {
      id: string;
      kind: 'exam' | 'homework';
      title: string;
      subject: string;
      date: Date;
      destination: Page;
      assignmentId?: string;
    };
    const items = new Map<string, LearningItem>();
    const addItem = (item: LearningItem) => {
      const key = `${item.kind}:${item.subject.trim().toLocaleLowerCase('vi')}:${item.title.trim().toLocaleLowerCase('vi')}:${getDateKey(item.date)}`;
      items.set(key, item);
    };

    for (const { weekStart, timetable } of upcomingTimetables) {
      for (const entry of timetable.timetable?.entries ?? []) {
        const scheduledDate = getWeekDate(weekStart, entry.weekday);
        if (!scheduledDate) continue;

        if (entry.hasExam) {
          const examDateTime = entry.examStartsAt || entry.dueAt;
          const date = examDateTime ? getCalendarDate(examDateTime) : scheduledDate;
          const hasNotStarted = !examDateTime || Date.parse(examDateTime) >= Date.now();
          if (date && date >= startOfToday && hasNotStarted) {
            addItem({
              id: `timetable-exam-${getDateKey(date)}-${entry.period}-${entry.subject}`,
              kind: 'exam',
              title: entry.examTitle || entry.title || 'Bài kiểm tra',
              subject: entry.subject,
              date,
              destination: 'schedule',
            });
          }
        }

        if (entry.hasHomework) {
          const dueAt = entry.homeworkDueAt || entry.dueAt;
          const date = dueAt ? getCalendarDate(dueAt) : scheduledDate;
          if (date && (date >= startOfToday || dueAt)) {
            addItem({
              id: `timetable-homework-${getDateKey(date)}-${entry.period}-${entry.subject}`,
              kind: 'homework',
              title: entry.homeworkTitle || entry.title || 'Bài tập về nhà',
              subject: entry.subject,
              date,
              destination: 'schedule',
            });
          }
        }
      }
    }

    for (const exam of liveProgress?.upcomingExams ?? []) {
      const date = getCalendarDate(exam.startsAt);
      if (date && date >= startOfToday) {
        addItem({
          id: exam.id,
          kind: 'exam',
          title: exam.title,
          subject: exam.subject,
          date,
          destination: 'online-exams',
        });
      }
    }

    for (const assignment of liveAssignments) {
      const date = getCalendarDate(assignment.dueAt);
      if (date) {
        addItem({
          id: assignment.id,
          kind: 'homework',
          title: assignment.title,
          subject: assignment.subject,
          date,
          destination: 'assignments',
          assignmentId: assignment.id,
        });
      }
    }

    return [...items.values()].sort((first, second) => (
      Number(first.kind !== 'exam') - Number(second.kind !== 'exam')
      || first.date.getTime() - second.date.getTime()
    ));
  })();
  const focusAssignment = liveAssignments[0] ?? null;
  const tomorrowEntries = tomorrowTimetable?.timetable?.entries
    .filter((entry) => entry.weekday === tomorrowWeekday) ?? [];
  const progressClass = liveProgress?.classes.find((classItem) => classItem.id === liveProgress.scope.classId)
    ?? liveProgress?.classes[0]
    ?? null;
  const progressSemester = liveProgress?.scope.semester ?? getCurrentSemester(tomorrow);
  const officialAverages = (liveProgress?.officialAverages ?? []).filter((item) => (
    progressClass !== null
    && item.classId === progressClass.id
    && item.academicYear === progressClass.academicYear
    && item.semester === progressSemester
  ));
  const subjectNames = progressClass
    ? [...new Set([...progressClass.subjects, ...officialAverages.map((item) => item.subject)])]
    : [...new Set(studentResults.map((result) => result.subject))];
  const subjectScores = subjectNames
    .map((subject) => {
      if (progressClass) {
        const averages = officialAverages
          .flatMap((item) => item.subject === subject && item.average !== null ? [item.average] : []);
        return {
          subject,
          average: averages.length > 0
            ? averages.reduce((sum, average) => sum + average, 0) / averages.length
            : null,
        };
      }
      const scores = studentResults.filter((result) => result.subject === subject);
      return {
        subject,
        average: scores.length > 0
          ? scores.reduce((sum, result) => sum + result.score, 0) / scores.length
          : null,
      };
    })
    .sort((first, second) => (second.average ?? -Infinity) - (first.average ?? -Infinity));
  const scoredSubjectScores = subjectScores.filter(
    (item): item is { subject: string; average: number } => item.average !== null,
  );
  const allAverage = scoredSubjectScores.length > 0
    ? scoredSubjectScores.reduce((sum, item) => sum + item.average, 0) / scoredSubjectScores.length
    : null;
  const decreasingSubjects = [...new Set(studentResults.map((result) => result.subject))]
    .flatMap((subject) => {
      const results = studentResults
        .filter((result) => result.subject === subject)
        .sort((first, second) => (
          (parseVietnameseDate(first.date)?.getTime() ?? 0)
          - (parseVietnameseDate(second.date)?.getTime() ?? 0)
        ));
      if (results.length < 2) return [];
      const latest = results[results.length - 1];
      const previous = results[results.length - 2];
      return latest.score < previous.score ? [{ subject, latest, previous }] : [];
    });
  const greetingName = userName.trim().split(/\s+/).pop() || userName;
  const scheduleExamKeys = new Set<string>();
  const scheduleAttentionItems = upcomingTimetables.flatMap(({ weekStart, timetable }) => (
    (timetable.timetable?.entries ?? []).flatMap((entry) => {
      const scheduledDate = getWeekDate(weekStart, entry.weekday);
      if (!scheduledDate) return [];
      const items = [];
      if (entry.hasExam) {
        const examDateTime = entry.examStartsAt || entry.dueAt;
        const examDate = examDateTime ? getCalendarDate(examDateTime) : scheduledDate;
        const hasNotStarted = !examDateTime || Date.parse(examDateTime) >= Date.now();
        if (examDate && examDate >= startOfToday && hasNotStarted) {
          const title = entry.examTitle || entry.title || 'Bài kiểm tra';
          scheduleExamKeys.add(`${entry.subject.trim().toLocaleLowerCase('vi')}:${title.trim().toLocaleLowerCase('vi')}:${getDateKey(examDate)}`);
          items.push({
            id: `scheduled-exam-${getDateKey(examDate)}-${entry.period}-${entry.subject}`,
            title: `Kiểm tra sắp tới: ${title}`,
            detail: `${entry.subject} · ${examDate.toLocaleDateString('vi-VN')}`,
            onClick: () => onNavigate('schedule'),
            cardClass: 'border-rose-100 bg-rose-50/70 hover:bg-rose-50',
            iconClass: 'text-rose-600',
            Icon: CalendarClock,
          });
        }
      }
      if (entry.hasExamReturn) {
        const returnDateTime = entry.examReturnAt || (entry.type === 'exam_return' ? entry.dueAt : null);
        const returnDate = returnDateTime ? getCalendarDate(returnDateTime) : scheduledDate;
        const returnIsUpcoming = !returnDateTime || Date.parse(returnDateTime) >= Date.now();
        if (returnDate && returnDate >= startOfToday && returnIsUpcoming) {
          items.push({
            id: `scheduled-return-${getDateKey(returnDate)}-${entry.period}-${entry.subject}`,
            title: `Lịch trả bài: ${entry.examReturnNote || entry.subject}`,
            detail: `${entry.subject} · ${returnDate.toLocaleDateString('vi-VN')}`,
            onClick: () => onNavigate('schedule'),
            cardClass: 'border-violet-100 bg-violet-50/70 hover:bg-violet-50',
            iconClass: 'text-violet-700',
            Icon: CalendarDays,
          });
        }
      }
      return items;
    })
  ));
  const pendingAssignmentGrades = (liveProgress?.assignments ?? [])
    .filter((assignment) => assignment.submittedAt !== null && assignment.gradedAt === null);
  const recentAssignmentGrades = (liveProgress?.assignments ?? [])
    .filter((assignment) => isWithinRecentDays(assignment.gradedAt, Date.now(), 7));
  const gradedExamRoomIds = new Set((liveProgress?.examResults ?? []).map((result) => result.roomId));
  const pendingExamGrades = liveProgress
    ? studentExamRooms.filter((room) => room.hasSubmitted && !gradedExamRoomIds.has(room.id))
    : [];
  const recentExamGrades = (liveProgress?.examResults ?? [])
    .filter((result) => !result.grade.isRead && isWithinRecentDays(result.grade.gradedAt, Date.now(), 30));
  const pendingAppeals = studentAppeals.filter((appeal) => appeal.status === 'pending');
  const recentlyReviewedAppeals = studentAppeals.filter((appeal) => (
    appeal.status !== 'pending' && isWithinRecentDays(appeal.reviewedAt, Date.now(), 7)
  ));
  const attentionItems = [
    ...scheduleAttentionItems,
    ...upcomingExams.filter((exam) => {
      const date = getCalendarDate(exam.startsAt);
      return !date || !scheduleExamKeys.has(
        `${exam.subject.trim().toLocaleLowerCase('vi')}:${exam.title.trim().toLocaleLowerCase('vi')}:${getDateKey(date)}`,
      );
    }).map((exam) => ({
      id: `exam-${exam.id}`,
      title: `Kiểm tra: ${exam.title}`,
      detail: `${exam.subject} - ${new Date(exam.startsAt).toLocaleString('vi-VN')}`,
      onClick: () => onNavigate('online-exams'),
      cardClass: 'border-rose-100 bg-rose-50/70 hover:bg-rose-50',
      iconClass: 'text-rose-600',
      Icon: CalendarClock,
    })),
    ...pendingExamGrades.map((room) => ({
      id: `exam-pending-grade-${room.id}`,
      title: `Bài kiểm tra đang chờ chấm: ${room.title}`,
      detail: `${room.subject} · Đã nộp, đang chờ giáo viên`,
      onClick: () => onNavigate('online-exams'),
      cardClass: 'border-amber-100 bg-amber-50/70 hover:bg-amber-50',
      iconClass: 'text-amber-700',
      Icon: Clock3,
    })),
    ...pendingAssignmentGrades.map((assignment) => ({
      id: `assignment-pending-grade-${assignment.id}`,
      title: `Bài tập đang chờ chấm: ${assignment.title}`,
      detail: `${assignment.subject} · Đã nộp ${assignment.submittedAt ? new Date(assignment.submittedAt).toLocaleDateString('vi-VN') : ''}`,
      onClick: () => onNavigate('assignments'),
      cardClass: 'border-amber-100 bg-amber-50/70 hover:bg-amber-50',
      iconClass: 'text-amber-700',
      Icon: Clock3,
    })),
    ...pendingAppeals.map((appeal) => ({
      id: `appeal-pending-${appeal.id}`,
      title: `Phúc khảo đang chờ phản hồi: ${appeal.examTitle}`,
      detail: `${appeal.subject} · Đã gửi ${new Date(appeal.createdAt).toLocaleDateString('vi-VN')}`,
      onClick: () => onNavigate('online-exams'),
      cardClass: 'border-amber-100 bg-amber-50/70 hover:bg-amber-50',
      iconClass: 'text-amber-700',
      Icon: Clock3,
    })),
    ...recentExamGrades.map((result) => ({
      id: `exam-result-${result.sessionId}`,
      title: `Đã trả điểm kiểm tra: ${result.title}`,
      detail: `${result.subject} · ${result.grade.totalScore} điểm`,
      onClick: () => onNavigate('online-exams'),
      cardClass: 'border-emerald-100 bg-emerald-50/70 hover:bg-emerald-50',
      iconClass: 'text-emerald-700',
      Icon: Trophy,
    })),
    ...recentAssignmentGrades.map((assignment) => ({
      id: `assignment-grade-${assignment.id}`,
      title: `Đã trả bài tập: ${assignment.title}`,
      detail: `${assignment.subject} · ${assignment.score === null ? 'Đã chấm' : `${assignment.score}/10`}`,
      onClick: () => onNavigate('my-results'),
      cardClass: 'border-emerald-100 bg-emerald-50/70 hover:bg-emerald-50',
      iconClass: 'text-emerald-700',
      Icon: Trophy,
    })),
    ...recentlyReviewedAppeals.map((appeal) => ({
      id: `appeal-reviewed-${appeal.id}`,
      title: `${appeal.status === 'rejected' ? 'Phúc khảo không được chấp nhận' : 'Phúc khảo đã có phản hồi'}: ${appeal.examTitle}`,
      detail: `${appeal.subject}${appeal.teacherResponse ? ` · ${appeal.teacherResponse}` : ''}`,
      onClick: () => onNavigate('online-exams'),
      cardClass: 'border-emerald-100 bg-emerald-50/70 hover:bg-emerald-50',
      iconClass: 'text-emerald-700',
      Icon: Trophy,
    })),
    ...decreasingSubjects.map(({ subject, latest, previous }) => ({
      id: `decrease-${subject}`,
      title: `Điểm ${subject} có dấu hiệu giảm`,
      detail: `${latest.score}/10 - bài trước ${previous.score}/10`,
      onClick: () => onNavigate('my-results'),
      cardClass: 'border-blue-100 bg-blue-50/70 hover:bg-blue-50',
      iconClass: 'text-blue-700',
      Icon: TrendingDown,
    })),
    ...(focusAssignment ? [{
      id: `assignment-${focusAssignment.id}`,
      title: `Bài tập: ${focusAssignment.title}`,
      detail: `Hạn nộp ${new Date(focusAssignment.dueAt).toLocaleDateString('vi-VN')}`,
      onClick: () => onNavigate('assignments'),
      cardClass: 'border-amber-200 bg-amber-50/80 hover:bg-amber-50',
      iconClass: 'text-amber-700',
      Icon: Clock3,
    }] : []),
  ];
  const progressCycle = useDashboardCycle(subjectScores.length, 4, 1_000);
  const attentionCycle = useDashboardCycle(attentionItems.length, 2, 3_000);
  const tomorrowCycle = useDashboardCycle(tomorrowEntries.length, 2, 2_000);

  useEffect(() => {
    let active = true;
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const firstWeekStart = getWeekStart(tomorrowDate);
    const nextWeekDate = new Date(`${firstWeekStart}T00:00:00`);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStart = getWeekStart(nextWeekDate);
    const loadLiveData = async () => {
      setLoadingLiveData(true);
      setLiveDataError('');
      const [progressResult, timetableResult, nextTimetableResult, examRoomsResult, appealsResult] = await Promise.allSettled([
        getStudentProgress(),
        getStudentTimetable(getCurrentSemester(tomorrowDate), firstWeekStart),
        getStudentTimetable(getCurrentSemester(nextWeekDate), nextWeekStart),
        listStudentExamRooms(),
        listStudentExamAppeals(),
      ]);
      if (!active) return;
      const errors: string[] = [];
      if (progressResult.status === 'fulfilled') setLiveProgress(progressResult.value);
      else errors.push(progressResult.reason instanceof Error ? progressResult.reason.message : 'Không thể tải bài tập và lịch kiểm tra.');
      if (examRoomsResult.status === 'fulfilled') setStudentExamRooms(examRoomsResult.value);
      else errors.push(examRoomsResult.reason instanceof Error ? examRoomsResult.reason.message : 'Không thể tải trạng thái bài kiểm tra.');
      if (appealsResult.status === 'fulfilled') setStudentAppeals(appealsResult.value);
      else errors.push(appealsResult.reason instanceof Error ? appealsResult.reason.message : 'Không thể tải trạng thái phúc khảo.');
      const timetableWeeks: Array<{ weekStart: string; timetable: StudentTimetableResponse }> = [];
      if (timetableResult.status === 'fulfilled') {
        setTomorrowTimetable(timetableResult.value);
        timetableWeeks.push({ weekStart: firstWeekStart, timetable: timetableResult.value });
      } else {
        errors.push(timetableResult.reason instanceof Error ? timetableResult.reason.message : 'Không thể tải thời khóa biểu ngày mai.');
      }
      if (nextTimetableResult.status === 'fulfilled') {
        timetableWeeks.push({ weekStart: nextWeekStart, timetable: nextTimetableResult.value });
      } else {
        errors.push(nextTimetableResult.reason instanceof Error ? nextTimetableResult.reason.message : 'Không thể tải thời khóa biểu tuần tới.');
      }
      setUpcomingTimetables(timetableWeeks);
      setLiveDataError(errors.join(' '));
      setLoadingLiveData(false);
    };
    void loadLiveData();
    return () => { active = false; };
  }, []);

  const submitChatPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = chatPrompt.trim();
    if (!prompt && !chatImage) return;
    onAskAI(prompt, chatImage ?? undefined);
  };

  return (
    <div className="student-dashboard-scale w-full min-w-0 max-w-full space-y-3 overflow-x-clip pb-4">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-stretch gap-3 lg:grid-cols-[minmax(0,2.1fr)_minmax(300px,1fr)]">
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
              <p className="text-lg font-bold tracking-wide text-white sm:text-xl">Chào {greetingName}!</p>
              <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                Học đúng trọng tâm.<br className="hidden sm:block" /> Tiến bộ <span className="text-amber-300">từng ngày.</span>
              </h1>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-blue-50 sm:text-sm">Hỏi bài, lên kế hoạch học phù hợp với bạn.</p>

              <form onSubmit={submitChatPrompt} className="mt-4 w-full">
                <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.2)] ring-4 ring-white/15 focus-within:ring-cyan-200/50">
                  <Sparkles aria-hidden="true" className="ml-2 h-5 w-5 shrink-0 text-blue-500" />
                  <label htmlFor="dashboard-ai-prompt" className="sr-only">Hỏi trợ lý AI EduFlow</label>
                  <input
                    id="dashboard-ai-prompt"
                    value={chatPrompt}
                    onChange={(event) => setChatPrompt(event.target.value)}
                    placeholder="Hỏi EduFlow AI bất cứ điều gì..."
                    className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    aria-label="Gửi câu hỏi cho AI"
                    disabled={!chatPrompt.trim() && !chatImage}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <AiImageAttachment file={chatImage} onChange={setChatImage} />
              </form>

              <nav aria-label="Lối tắt công cụ AI" className="mt-3 flex flex-wrap gap-2">
                {([
                  { page: 'schedule', label: 'AI hỗ trợ thời khóa biểu', Icon: CalendarDays },
                  { page: 'my-results', label: 'AI phân tích tiến độ', Icon: BarChart3 },
                  { page: 'ai-practice', label: 'AI luyện tập', Icon: BookOpen },
                ] as const).map(({ page, label, Icon }) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => onNavigate(page)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/85 px-3 py-2 text-[0.625rem] font-bold text-blue-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600 sm:text-xs"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-blue-600" />
                    <span>{label}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                  </button>
                ))}
              </nav>
            </div>
          </section>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-stretch gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.85fr)]">
            <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><FileText className="h-4 w-4 text-blue-600" />Bài tập &amp; kiểm tra sắp tới</h2>
                <div role="group" aria-label="Lọc hoạt động học tập" className="flex rounded-lg bg-slate-100 p-0.5">
                  {([
                    { id: 'upcoming', label: 'Cần làm / sắp tới' },
                    { id: 'submitted', label: 'Đã nộp' },
                    { id: 'graded', label: 'Đã chấm' },
                  ] as const).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActivityFilter(id)}
                      aria-pressed={activityFilter === id}
                      className={`rounded-md px-2 py-1.5 text-[0.625rem] font-semibold transition ${activityFilter === id ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-slate-100 px-4">
                {activityFilter === 'upcoming' && (
                  <>
                    {upcomingLearningItems.slice(0, 3).map((item) => {
                      const isExam = item.kind === 'exam';
                      const countdownLabel = getCountdownLabel(item.date, startOfToday);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => item.kind === 'homework'
                            ? onOpenAssignment(item.subject, item.assignmentId)
                            : onNavigate(item.destination)}
                          className="flex min-h-[55px] w-full items-center gap-2.5 py-2 text-left transition hover:bg-blue-50"
                        >
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isExam ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                            {isExam ? <CalendarClock className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.6875rem] font-semibold text-slate-800">{isExam ? `Kiểm tra ${item.subject}: ${item.title}` : `BTVN ${item.subject}: ${item.title}`}</span>
                            <span className="mt-1 flex items-center gap-1 truncate text-[0.5625rem] text-slate-500">
                              <Clock3 className="h-2.5 w-2.5 shrink-0" />
                              {isExam ? 'Ngày kiểm tra' : 'Hạn nộp'}: {item.date.toLocaleDateString('vi-VN')}
                            </span>
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[0.5625rem] font-semibold ${countdownLabel.startsWith('Quá hạn') ? 'bg-rose-50 text-rose-700' : isExam ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                            {countdownLabel}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        </button>
                      );
                    })}
                    {loadingLiveData && upcomingLearningItems.length === 0 && (
                      <p className="py-5 text-center text-xs text-slate-500">Đang tải bài tập và lịch kiểm tra…</p>
                    )}
                    {!loadingLiveData && upcomingLearningItems.length === 0 && (
                      <p className="py-5 text-center text-xs text-slate-500">
                        {liveDataError || 'Chưa có bài tập hoặc lịch kiểm tra sắp tới.'}
                      </p>
                    )}
                    <button type="button" onClick={() => onNavigate('assignments')} className="w-full py-2 text-left text-[0.625rem] font-semibold text-blue-700 hover:text-blue-900">
                      Xem tất cả bài tập <ArrowRight className="ml-1 inline h-3 w-3" />
                    </button>
                  </>
                )}
                {activityFilter === 'submitted' && (
                  <p className="py-6 text-center text-xs leading-5 text-slate-500">Chưa có dữ liệu bài đã nộp để hiển thị tại đây.</p>
                )}
                {activityFilter === 'graded' && studentResults.slice(0, 4).map((result) => (
                  <button key={result.id} type="button" onClick={() => onNavigate('my-results')} className="flex min-h-[55px] w-full items-center gap-2.5 py-2 text-left transition hover:bg-blue-50">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Trophy className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.6875rem] font-semibold text-slate-800">{result.name}</span>
                      <span className="mt-1 block truncate text-[0.5625rem] text-slate-500">{result.subject} - {result.date}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[0.5625rem] font-semibold text-emerald-700">{result.score}/10</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            </section>

            <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Trophy className="h-4 w-4 text-blue-600" />Tiến độ học tập</h2>
                <button type="button" onClick={() => onNavigate('my-results')} className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900">
                  Chi tiết <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                </button>
              </div>
              <b className="mt-3 text-[1rem] text-slate-500">Điểm trung bình:</b>
              <div className="flex items-end gap-2 border-b border-slate-100 pb-2">
                <strong className="text-3xl font-extrabold leading-none text-slate-900">{allAverage === null ? '—' : allAverage.toFixed(1)}</strong>
              </div>
              <div
                className="mt-3 flex-1"
                onMouseEnter={() => progressCycle.setPaused(true)}
                onMouseLeave={() => progressCycle.setPaused(false)}
                onFocus={() => progressCycle.setPaused(true)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) progressCycle.setPaused(false);
                }}
              >
                <div className="student-dashboard-cycle-viewport">
                  <div
                    className="student-dashboard-cycle-track"
                    style={{
                      width: `${progressCycle.pageCount * 100}%`,
                      transform: `translateX(-${progressCycle.page * 100 / Math.max(progressCycle.pageCount, 1)}%)`,
                    }}
                  >
                    {Array.from({ length: progressCycle.pageCount }, (_, page) => (
                      <div key={page} className="student-dashboard-cycle-page space-y-3" style={{ flexBasis: `${100 / progressCycle.pageCount}%` }}>
                        {subjectScores.slice(page * 4, page * 4 + 4).map(({ subject, average }) => (
                          <div key={subject}>
                            <div className="mb-1 flex justify-between gap-2 text-[0.625rem]">
                              <span className="truncate font-medium text-slate-700">{subject}</span>
                              <strong className="text-slate-800">{average === null ? '—' : average.toFixed(1)}</strong>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              {average !== null && <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, average * 10))}%` }} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                {progressCycle.pageCount > 1 && (
                  <div className="mt-3 flex justify-center gap-1">
                    {Array.from({ length: progressCycle.pageCount }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        aria-label={`Xem nhóm môn học ${index + 1}`}
                        aria-pressed={index === progressCycle.page}
                        onClick={() => progressCycle.setPage(index)}
                        className="rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <span className={`block h-1.5 w-1.5 rounded-full transition-colors ${index === progressCycle.page ? 'bg-blue-600' : 'bg-slate-300 hover:bg-blue-400'}`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <section className="flex h-[15rem] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
              <Clock3 className="h-4 w-4 text-blue-600" /> Cần chú ý
            </h2>
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
              {attentionItems.length > 0 ? (
                <div
                  className="flex min-h-0 w-full min-w-0 flex-1 flex-col"
                  onMouseEnter={() => attentionCycle.setPaused(true)}
                  onMouseLeave={() => attentionCycle.setPaused(false)}
                  onFocus={() => attentionCycle.setPaused(true)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) attentionCycle.setPaused(false);
                  }}
                >
                  <div key={attentionCycle.page} className="dashboard-cycle-enter min-h-28 w-full min-w-0 space-y-2">
                    {attentionItems.slice(attentionCycle.page * 2, attentionCycle.page * 2 + 2).map((item) => {
                      const Icon = item.Icon;
                      return (
                        <button key={item.id} type="button" onClick={item.onClick} className={`flex min-h-[3.25rem] w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-xl border p-2.5 text-left transition ${item.cardClass}`}>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ${item.iconClass}`}><Icon className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.6875rem] font-bold text-slate-900">{item.title}</span>
                            <span className="mt-0.5 block truncate text-[0.625rem] text-slate-600">{item.detail}</span>
                          </span>
                          <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${item.iconClass}`} />
                        </button>
                      );
                    })}
                  </div>
                  {attentionCycle.pageCount > 1 && (
                    <div className="mt-auto flex h-6 shrink-0 items-end justify-center gap-1">
                      {Array.from({ length: attentionCycle.pageCount }, (_, index) => (
                        <button
                          key={index}
                          type="button"
                          aria-label={`Xem nhóm cần chú ý ${index + 1}`}
                          aria-pressed={index === attentionCycle.page}
                          onClick={() => attentionCycle.setPage(index)}
                          className="rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          <span className={`block h-1.5 w-1.5 rounded-full transition-colors ${index === attentionCycle.page ? 'bg-blue-600' : 'bg-slate-300 hover:bg-blue-400'}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="flex min-h-28 flex-1 items-center text-xs text-slate-500">{loadingLiveData ? 'Đang tải dữ liệu cần chú ý…' : liveDataError || 'Chưa có mục nào cần chú ý.'}</p>
              )}
            </div>
          </section>

          <section className="flex h-[17rem] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarClock className="h-4 w-4 text-blue-600" />Lịch ngày mai - {tomorrow.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</h2>
              <button type="button" onClick={() => onNavigate('schedule')} className="shrink-0 text-[0.625rem] font-semibold text-blue-700 hover:text-blue-900">
                Thời khóa biểu <ArrowRight className="ml-0.5 inline h-3 w-3" />
              </button>
            </div>
            <div className="mt-2 flex min-h-0 flex-1 flex-col">
              {loadingLiveData ? <p className="py-4 text-xs leading-5 text-slate-500">Đang tải thời khóa biểu…</p>
                : tomorrowEntries.length > 0 ? (
                  <div
                    className="flex min-h-0 flex-1 flex-col"
                    onMouseEnter={() => tomorrowCycle.setPaused(true)}
                    onMouseLeave={() => tomorrowCycle.setPaused(false)}
                    onFocus={() => tomorrowCycle.setPaused(true)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) tomorrowCycle.setPaused(false);
                    }}
                  >
                    <div className="student-dashboard-cycle-viewport min-h-0 flex-1">
                      <div
                        className="student-dashboard-cycle-track"
                        style={{
                          width: `${tomorrowCycle.pageCount * 100}%`,
                          transform: `translateX(-${tomorrowCycle.page * 100 / tomorrowCycle.pageCount}%)`,
                        }}
                      >
                        {Array.from({ length: tomorrowCycle.pageCount }, (_, page) => (
                          <div
                            key={page}
                            aria-hidden={page !== tomorrowCycle.page}
                            className="student-dashboard-cycle-page h-full min-h-[10rem] divide-y divide-slate-100"
                            style={{ flexBasis: `${100 / tomorrowCycle.pageCount}%` }}
                          >
                            {tomorrowEntries.slice(page * 2, page * 2 + 2).map((entry, index) => (
                              <button key={`${entry.weekday}-${entry.period}-${entry.subject}-${index}`} type="button" tabIndex={page === tomorrowCycle.page ? 0 : -1} onClick={() => onNavigate('schedule')} className="flex h-20 w-full min-w-0 items-center gap-3 overflow-hidden py-2 text-left transition hover:bg-blue-50">
                                <span className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 text-blue-800">
                                  <span className="text-[0.5625rem] font-medium text-slate-500">{weekdayLabels[entry.weekday]}</span>
                                  <span className="whitespace-nowrap text-lg font-extrabold leading-5">Tiết {entry.period}</span>
                                </span>
                                <span className="w-0 min-w-0 flex-1 overflow-hidden">
                                  <span title={entry.subject} className="block max-w-full truncate text-xs font-bold leading-4 text-slate-800">{entry.subject}</span>
                                  <span title={entry.title || entry.topic || 'Buổi học theo thời khóa biểu'} className="mt-0.5 block max-w-full truncate text-[0.625rem] leading-3 text-slate-500">{entry.title || entry.topic || 'Buổi học theo thời khóa biểu'}</span>
                                  {entry.hasExam && <span title={`Có kiểm tra: ${entry.examTitle}`} className="mt-0.5 block max-w-full truncate text-[0.625rem] font-semibold leading-3 text-rose-700">Có kiểm tra: {entry.examTitle}</span>}
                                </span>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    {tomorrowCycle.pageCount > 1 && (
                      <div className="mt-auto flex h-6 shrink-0 items-end justify-center gap-1">
                        {Array.from({ length: tomorrowCycle.pageCount }, (_, index) => (
                          <button
                            key={index}
                            type="button"
                            aria-label={`Xem lịch ngày mai trang ${index + 1}`}
                            aria-pressed={index === tomorrowCycle.page}
                            onClick={() => tomorrowCycle.setPage(index)}
                            className="rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <span className={`block h-1.5 w-1.5 rounded-full transition-colors ${index === tomorrowCycle.page ? 'bg-blue-600' : 'bg-slate-300 hover:bg-blue-400'}`} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : <p className="py-4 text-xs leading-5 text-slate-500">{liveDataError || 'Chưa có thời khóa biểu ngày mai được ghi nhận.'}</p>}
            </div>
          </section>

          <SubjectCarousel onNavigate={onNavigate} onOpenResources={onOpenResources} onOpenAssignments={onOpenAssignments} />
        </aside>
      </div>
    </div>
  );
}
