import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  buildCalendarFile,
  createDeadlineCalendarEvent,
  createPeriodCalendarEvent,
  downloadCalendarFile,
} from '@/calendarExport';
import {
  generateStudentTimetableSuggestion,
  getStudentProgress,
  getStudentTimetable,
  type ProgressSemester,
  type StudentTimetableResponse,
} from '@/api/schoolApi';
import { WeeklySchedule, type ScheduleGridEntry } from './WeeklySchedule';

interface StudentScheduleProps {
  studentId: string;
}

const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const planWeekdays = ['', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const studentPlanKinds = new Set(['study', 'homework', 'review', 'class', 'break', 'busy', 'personal', 'exam']);
const priorityCards = [
  {
    label: 'Ưu tiên 1',
    badge: 'Khẩn cấp',
    cardStyle: 'border-rose-200 bg-gradient-to-br from-rose-50 via-orange-50 to-white',
    badgeStyle: 'bg-rose-100 text-rose-700',
    numberStyle: 'bg-rose-500 text-white',
  },
  {
    label: 'Ưu tiên 2',
    badge: 'Cần chuẩn bị',
    cardStyle: 'border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-white',
    badgeStyle: 'bg-violet-100 text-violet-700',
    numberStyle: 'bg-violet-500 text-white',
  },
  {
    label: 'Ưu tiên 3',
    badge: 'Ôn tập',
    cardStyle: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-white',
    badgeStyle: 'bg-emerald-100 text-emerald-700',
    numberStyle: 'bg-emerald-500 text-white',
  },
];
const timelineDayStyles = [
  '',
  'border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50',
  'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50',
  'border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50',
  'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50',
  'border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50',
  'border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50',
  'border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-pink-50',
];

type StudentPlanKind = 'study' | 'homework' | 'review' | 'class' | 'break' | 'busy' | 'personal' | 'exam';

interface StudentSchedulePlan {
  overview: string;
  lifeBalanceTip: string;
  dataNotes: string[];
  priorities: Array<{ task: string; reason: string; durationMinutes: number }>;
  timeline: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
    activity: string;
    kind: StudentPlanKind;
  }>;
}

function parseStudentSchedulePlan(raw: string): StudentSchedulePlan | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const plan = value as Record<string, unknown>;
    if (typeof plan.overview !== 'string'
      || (plan.lifeBalanceTip !== undefined && typeof plan.lifeBalanceTip !== 'string')
      || !Array.isArray(plan.dataNotes)
      || !plan.dataNotes.every((note) => typeof note === 'string')
      || !Array.isArray(plan.priorities)
      || plan.priorities.length !== 3
      || !Array.isArray(plan.timeline)
      || plan.timeline.length > 28) return null;

    const priorities = plan.priorities.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const priority = item as Record<string, unknown>;
      if (typeof priority.task !== 'string'
        || typeof priority.reason !== 'string'
        || typeof priority.durationMinutes !== 'number'
        || !Number.isInteger(priority.durationMinutes)) return null;
      return {
        task: priority.task,
        reason: priority.reason,
        durationMinutes: priority.durationMinutes,
      };
    });
    const timeline = plan.timeline.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const entry = item as Record<string, unknown>;
      if (typeof entry.weekday !== 'number'
        || !Number.isInteger(entry.weekday)
        || typeof entry.startTime !== 'string'
        || typeof entry.endTime !== 'string'
        || typeof entry.activity !== 'string'
        || typeof entry.kind !== 'string'
        || !studentPlanKinds.has(entry.kind)) return null;
      return {
        weekday: entry.weekday,
        startTime: entry.startTime,
        endTime: entry.endTime,
        activity: entry.activity,
        kind: entry.kind as StudentPlanKind,
      };
    });
    if (priorities.some((item) => item === null) || timeline.some((item) => item === null)) return null;
    return {
      overview: plan.overview,
      lifeBalanceTip: typeof plan.lifeBalanceTip === 'string' ? plan.lifeBalanceTip : '',
      dataNotes: plan.dataNotes as string[],
      priorities: priorities as StudentSchedulePlan['priorities'],
      timeline: timeline as StudentSchedulePlan['timeline'],
    };
  } catch {
    return null;
  }
}

function getWeekStart(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function noteKey(studentId: string, weekStart: string) {
  return `eduflow-student-week-plan:${studentId}:${weekStart}`;
}

function loadSavedPlan(key: string) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return { freeTime: '', busyTime: '', suggestion: '', completedPriorities: [], error: '' };
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { freeTime: '', busyTime: '', suggestion: '', completedPriorities: [], error: 'Ghi chú đã lưu không đúng định dạng.' };
    }
    const value = parsed as {
      availability?: unknown;
      freeTime?: unknown;
      busyTime?: unknown;
      suggestion?: unknown;
      completedPriorities?: unknown;
    };
    return {
      freeTime: typeof value.freeTime === 'string'
        ? value.freeTime
        : typeof value.availability === 'string' ? value.availability : '',
      busyTime: typeof value.busyTime === 'string' ? value.busyTime : '',
      suggestion: typeof value.suggestion === 'string' ? value.suggestion : '',
      completedPriorities: Array.isArray(value.completedPriorities)
        ? value.completedPriorities.filter((index): index is number => (
          typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < 3
        ))
        : [],
      error: '',
    };
  } catch {
    return {
      freeTime: '',
      busyTime: '',
      suggestion: '',
      completedPriorities: [],
      error: 'Không thể đọc kế hoạch đã lưu trên thiết bị này.',
    };
  }
}

export function StudentSchedule({ studentId }: StudentScheduleProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [semester, setSemester] = useState<ProgressSemester>('Kỳ 1');
  const [scheduleData, setScheduleData] = useState<StudentTimetableResponse | null>(null);
  const [freeTime, setFreeTime] = useState('');
  const [busyTime, setBusyTime] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [completedPriorities, setCompletedPriorities] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [exportingCalendar, setExportingCalendar] = useState(false);
  const [error, setError] = useState('');
  const [calendarExportError, setCalendarExportError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  const weekStartKey = dateKey(weekStart);
  const storageKey = noteKey(studentId, weekStartKey);
  const plan = useMemo(() => parseStudentSchedulePlan(suggestion), [suggestion]);
  const availability = [
    freeTime.trim() ? `Thời gian rảnh:\n${freeTime.trim()}` : '',
    busyTime.trim() ? `Thời gian bận:\n${busyTime.trim()}` : '',
  ].filter(Boolean).join('\n\n');
  const weekDays = useMemo(() => days.map((label, index) => ({
    label,
    date: addDays(weekStart, index),
  })), [weekStart]);

  useEffect(() => {
    const saved = loadSavedPlan(storageKey);
    setFreeTime(saved.freeTime);
    setBusyTime(saved.busyTime);
    setSuggestion(saved.suggestion);
    setCompletedPriorities(saved.completedPriorities);
    setStorageError(saved.error);
  }, [storageKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setScheduleData(null);
    getStudentTimetable(semester, weekStartKey)
      .then((response) => {
        if (active) setScheduleData(response);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải thời khóa biểu.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [semester, weekStartKey, retryToken]);

  const timetable = scheduleData?.timetable;
  const entries = useMemo<ScheduleGridEntry[]>(
    () => (timetable?.entries ?? []).map((entry) => ({
      weekday: entry.weekday,
      period: entry.period,
      subject: entry.subject,
      type: entry.type ?? 'lesson',
      title: entry.title,
      topic: entry.topic,
      dueAt: entry.dueAt,
      hasHomework: entry.hasHomework,
      homeworkTitle: entry.homeworkTitle,
      homeworkDueAt: entry.homeworkDueAt,
      hasExam: entry.hasExam,
      examTitle: entry.examTitle,
      examStartsAt: entry.examStartsAt,
      hasExamReturn: entry.hasExamReturn,
      examReturnNote: entry.examReturnNote,
      examReturnAt: entry.examReturnAt,
    })),
    [timetable],
  );
  const savePlan = (
    nextFreeTime: string,
    nextBusyTime: string,
    nextSuggestion = suggestion,
    nextCompletedPriorities = completedPriorities,
  ) => {
    setStorageError('');
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        freeTime: nextFreeTime,
        busyTime: nextBusyTime,
        suggestion: nextSuggestion,
        completedPriorities: nextCompletedPriorities,
      }));
    } catch {
      setStorageError('Không thể lưu ghi chú trên thiết bị này. Nội dung vẫn được giữ trong phiên hiện tại.');
    }
  };
  const updateAvailability = (field: 'free' | 'busy', value: string) => {
    const nextFreeTime = field === 'free' ? value : freeTime;
    const nextBusyTime = field === 'busy' ? value : busyTime;
    setFreeTime(nextFreeTime);
    setBusyTime(nextBusyTime);
    setSuggestion('');
    setCompletedPriorities([]);
    savePlan(nextFreeTime, nextBusyTime, '', []);
  };
  const moveWeek = (direction: -1 | 1) => {
    setWeekStart((current) => addDays(current, direction * 7));
  };
  const goToCurrentWeek = () => setWeekStart(getWeekStart(new Date()));
  const isCurrentWeek = weekStartKey === dateKey(getWeekStart(new Date()));
  const weekButtonLabel = scheduleData?.weekNumber
    ? `Tuần học ${scheduleData.weekNumber}${isCurrentWeek ? ' - Tuần này' : ''}`
    : isCurrentWeek ? 'Tuần này' : 'Về tuần này';

  const createPlan = async () => {
    setPlanning(true);
    setError('');
    try {
      const currentDay = new Date().getDay();
      const tomorrowWeekday = (currentDay + 1) % 7 === 0 ? 7 : ((currentDay + 1 + 6) % 7) + 1;
      const result = await generateStudentTimetableSuggestion({
        semester,
        weekStart: weekStartKey,
        tomorrowWeekday,
        availability,
      });
      if (!parseStudentSchedulePlan(result)) {
        throw new Error('AI chưa tạo được kế hoạch đúng định dạng. Bạn thử tạo lại nhé.');
      }
      setSuggestion(result);
      setCompletedPriorities([]);
      savePlan(freeTime, busyTime, result, []);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tạo kế hoạch học tập.');
    } finally {
      setPlanning(false);
    }
  };

  const togglePriority = (index: number) => {
    const nextCompleted = completedPriorities.includes(index)
      ? completedPriorities.filter((completedIndex) => completedIndex !== index)
      : [...completedPriorities, index];
    setCompletedPriorities(nextCompleted);
    savePlan(freeTime, busyTime, suggestion, nextCompleted);
  };

  const classroom = scheduleData?.classroom;
  const exportCalendar = async () => {
    if (!timetable || !classroom) return;
    setExportingCalendar(true);
    setCalendarExportError('');
    try {
      const progress = await getStudentProgress();
      const rangeStart = new Date(`${weekStartKey}T00:00:00+07:00`).getTime();
      const rangeEnd = rangeStart + 14 * 24 * 60 * 60 * 1000;
      const upcomingAssignments = progress.assignments.filter((assignment) => {
        const dueTime = Date.parse(assignment.dueAt);
        return assignment.classId === classroom.id
          && assignment.academicYear === classroom.academicYear
          && assignment.semester === semester
          && !assignment.submittedAt
          && Number.isFinite(dueTime)
          && dueTime >= rangeStart
          && dueTime < rangeEnd;
      });
      const calendarEvents = entries
        .filter((entry) => entry.type !== 'cancelled')
        .map((entry) => createPeriodCalendarEvent({
          id: `student-class-${classroom.code}-${weekStartKey}-${entry.weekday}-${entry.period}`,
          date: dateKey(addDays(weekStart, entry.weekday - 1)),
          session: timetable.session,
          period: entry.period,
          title: `${entry.subject}${entry.hasExam && entry.examTitle ? ` - ${entry.examTitle}` : ''}`,
          description: [
            `Lớp: ${classroom.code}`,
            entry.topic ? `Tài liệu: ${entry.topic}` : '',
            entry.hasHomework ? `Bài tập: ${entry.homeworkTitle || 'Có bài tập'}` : '',
            entry.hasExam ? `Kiểm tra: ${entry.examTitle || 'Bài kiểm tra'}` : '',
            entry.roomExamTitle ? `Phòng thi: ${entry.roomExamTitle}` : '',
          ].filter(Boolean).join('\n'),
          reminders: Boolean(entry.hasExam && entry.examStartsAt),
        }));
      for (const assignment of upcomingAssignments) {
        const deadline = createDeadlineCalendarEvent({
          id: `student-assignment-${assignment.id}`,
          startsAt: assignment.dueAt,
          title: `Hạn nộp: ${assignment.title}`,
          description: `Môn: ${assignment.subject}\nLớp: ${assignment.classCode}`,
        });
        if (deadline) calendarEvents.push(deadline);
      }
      for (const entry of entries) {
        if (entry.hasHomework && entry.homeworkDueAt) {
          const matchesAssignment = progress.assignments.some((assignment) => (
            assignment.classId === classroom.id
            && assignment.subject === entry.subject
            && Date.parse(assignment.dueAt) === Date.parse(entry.homeworkDueAt ?? '')
          ));
          if (!matchesAssignment) {
            const deadline = createDeadlineCalendarEvent({
              id: `student-homework-${classroom.code}-${entry.weekday}-${entry.period}-${entry.homeworkDueAt}`,
              startsAt: entry.homeworkDueAt,
              title: `Hạn nộp: ${entry.homeworkTitle || `Bài tập ${entry.subject}`}`,
              description: `Môn: ${entry.subject}\nLớp: ${classroom.code}`,
            });
            if (deadline) calendarEvents.push(deadline);
          }
        }
        if (entry.hasExamReturn && entry.examReturnAt) {
          const returnEvent = createDeadlineCalendarEvent({
            id: `student-exam-return-${classroom.code}-${entry.weekday}-${entry.period}-${entry.examReturnAt}`,
            startsAt: entry.examReturnAt,
            title: `Trả bài: ${entry.examReturnNote || entry.subject}`,
            description: `Môn: ${entry.subject}\nLớp: ${classroom.code}`,
          });
          if (returnEvent) calendarEvents.push(returnEvent);
        }
      }
      downloadCalendarFile(
        buildCalendarFile(calendarEvents, `${classroom.name} - Thời khóa biểu EduFlow`),
        `eduflow-hoc-sinh-${weekStartKey}.ics`,
      );
    } catch (exportError: unknown) {
      setCalendarExportError(exportError instanceof Error
        ? exportError.message
        : 'Không thể chuẩn bị tệp lịch. Vui lòng thử lại.');
    } finally {
      setExportingCalendar(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <span>Học kỳ: </span>
          <select
            value={semester}
            onChange={(event) => setSemester(event.target.value as ProgressSemester)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="Kỳ 1">Kỳ 1</option>
            <option value="Kỳ 2">Kỳ 2</option>
          </select>
        </label>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            onClick={() => void exportCalendar()}
            disabled={loading || exportingCalendar || !timetable || !classroom}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exportingCalendar
              ? <LoaderCircle className="h-4 w-4 animate-spin" />
              : <CalendarDays className="h-4 w-4" />}
            {exportingCalendar ? 'Đang chuẩn bị...' : 'Xuất .ics'}
          </button>
          {calendarExportError && (
            <p className="max-w-xs text-right text-xs text-rose-700" role="alert">{calendarExportError}</p>
          )}
        </div>
      </header>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
          <button type="button" onClick={() => moveWeek(-1)} aria-label="Tuần trước" className="grid h-10 w-10 place-items-center text-slate-600 hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={goToCurrentWeek} className="h-10 border-x border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {weekButtonLabel}
          </button>
          <button type="button" onClick={() => moveWeek(1)} aria-label="Tuần sau" className="grid h-10 w-10 place-items-center text-slate-600 hover:bg-slate-50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-600" role="status">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin text-blue-600" />
          Đang tải thời khóa biểu...
        </div>
      ) : error && !scheduleData ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)} className="mt-3 rounded-lg bg-white px-3 py-2 font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">
            Thử tải lại
          </button>
        </div>
      ) : !classroom ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Tài khoản hiện chưa có lớp học đang hoạt động.
        </div>
      ) : timetable ? (
        <WeeklySchedule
          entries={entries}
          weekDays={weekDays}
          periodCount={timetable.periodCount}
          sessionLabel={timetable.session === 'morning' ? 'Buổi sáng' : 'Buổi chiều'}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Chưa có thời khóa biểu {semester.toLocaleLowerCase('vi')} cho lớp {classroom.code}.
        </div>
      )}

      <section className="relative isolate overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-sky-50/80 to-violet-50 p-4 shadow-sm shadow-indigo-100/60 sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-fuchsia-200/40 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 text-white shadow-lg shadow-blue-200">
                <Sparkles className="h-6 w-6" />
              </span>
              <div>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">Kế hoạch tuần này</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Chia sẻ lúc bạn rảnh và bận trong tuần. Tôi sẽ cùng bạn sắp xếp việc học, bài tập và thời gian nghỉ.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={createPlan}
              disabled={planning || !availability.trim() || !timetable}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-200 disabled:cursor-not-allowed disabled:from-slate-300 disabled:via-slate-300 disabled:to-slate-400 disabled:shadow-none"
            >
              {planning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {planning ? 'Đang xếp kế hoạch...' : 'Lên kế hoạch cùng AI'}
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="block rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white p-3.5">
              <span className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Thời gian rảnh
              </span>
              <textarea
                value={freeTime}
                onChange={(event) => updateAvailability('free', event.target.value)}
                maxLength={1900}
                rows={5}
                placeholder={'Ví dụ:\nThứ 2: 19:00–21:00\nThứ 4: 17:30–20:00\nChủ nhật: buổi sáng'}
                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-emerald-100 bg-white/90 p-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100/70"
              />
            </label>
            <label className="block rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50/90 to-white p-3.5">
              <span className="flex items-center gap-2 text-sm font-bold text-rose-900">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Thời gian bận
              </span>
              <textarea
                value={busyTime}
                onChange={(event) => updateAvailability('busy', event.target.value)}
                maxLength={1900}
                rows={5}
                placeholder={'Ví dụ:\nThứ 3: 18:00–21:00 học thêm\nThứ 5: 19:00–20:30 có lịch riêng'}
                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-rose-100 bg-white/90 p-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100/70"
              />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span></span>
            <span className="rounded-full bg-white/70 px-2.5 py-1 font-medium text-slate-500">{availability.length}/4000</span>
          </div>
          {storageError && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">{storageError}</p>
          )}
          {error && scheduleData && (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>
          )}
          {suggestion && (
            <article className="relative mt-6 overflow-hidden rounded-3xl border border-white/80 bg-white/90 shadow-xl shadow-indigo-100/70 ring-1 ring-indigo-100/80">
              <div aria-hidden="true" className="h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 via-violet-500 to-fuchsia-400" />
              <div className="relative overflow-hidden p-4 sm:p-6">
                <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-100/70 blur-2xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/80 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-100 to-fuchsia-100 text-indigo-700">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight text-slate-900">Lộ trình tuần của bạn</h3>
                      <p className="mt-0.5 text-xs text-slate-500">Chia nhỏ việc cần làm để mỗi ngày đều vừa sức</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                    <Sparkles className="h-3.5 w-3.5 text-fuchsia-500" />
                    Gợi ý dành riêng cho bạn
                  </span>
                </div>
                {plan ? (
                  <div className="relative mt-5 space-y-6">
                    <p className="rounded-2xl bg-gradient-to-r from-indigo-50 via-sky-50 to-fuchsia-50 px-4 py-3 text-sm leading-6 text-indigo-900 ring-1 ring-indigo-100">
                      {plan.overview}
                    </p>

                    {plan.lifeBalanceTip && (
                      <p className="flex items-start gap-2 rounded-2xl border border-fuchsia-100 bg-gradient-to-r from-fuchsia-50 to-amber-50 px-4 py-3 text-sm leading-6 text-slate-700">
                        <Sparkles className="mt-1 h-4 w-4 shrink-0 text-fuchsia-500" />
                        <span>{plan.lifeBalanceTip}</span>
                      </p>
                    )}

                    <section className={`rounded-2xl border p-4 ${plan.dataNotes.length ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50' : 'border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50'}`}>
                      <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <span className={`grid h-7 w-7 place-items-center rounded-lg ${plan.dataNotes.length ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                          <BookOpen className="h-4 w-4" />
                        </span>
                        Thông tin dữ liệu còn thiếu / Chưa cập nhật
                      </h4>
                      {plan.dataNotes.length ? (
                        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-700">
                          {plan.dataNotes.map((note, index) => (
                            <li key={`${index}-${note}`} className="flex items-start gap-2">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Không có dữ liệu thiếu nào cần lưu ý cho kế hoạch này.
                        </p>
                      )}
                    </section>

                    <section>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="flex items-center gap-2 text-base font-bold text-slate-900">
                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-100 text-rose-600">1</span>
                          Kế hoạch học tập ưu tiên ngắn hạn
                        </h4>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {completedPriorities.length}/3 hoàn thành
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        {plan.priorities.map((priority, index) => {
                          const category = priorityCards[index];
                          const isComplete = completedPriorities.includes(index);
                          return (
                            <article
                              key={`${index}-${priority.task}`}
                              className={`rounded-2xl border p-4 shadow-sm transition ${category.cardStyle} ${isComplete ? 'opacity-75' : 'hover:-translate-y-0.5 hover:shadow-md'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${category.numberStyle}`}>{index + 1}</span>
                                  {category.label}
                                </span>
                                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={isComplete}
                                    onChange={() => togglePriority(index)}
                                    aria-label={`Đánh dấu hoàn thành: ${priority.task}`}
                                    className="h-4 w-4 accent-indigo-600"
                                  />
                                  <span>{isComplete ? 'Đã xong' : 'Hoàn thành'}</span>
                                </label>
                              </div>
                              <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[0.6875rem] font-bold ${category.badgeStyle}`}>
                                {category.badge}
                              </span>
                              <h5 className={`mt-2 font-bold leading-6 text-slate-900 ${isComplete ? 'line-through decoration-slate-400' : ''}`}>
                                {priority.task}
                              </h5>
                              <p className="mt-1 text-xs leading-5 text-slate-600">{priority.reason}</p>
                              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                <Clock3 className="h-3.5 w-3.5 text-indigo-500" />
                                {priority.durationMinutes} phút dự kiến
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>

                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-100 text-indigo-700">
                          <CalendarDays className="h-4 w-4" />
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900">Lịch cá nhân</h4>
                          <p className="text-xs text-slate-500">Các khung giờ và hoạt động theo ngày</p>
                        </div>
                      </div>
                      {plan.timeline.length ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {[...new Set(plan.timeline.map((item) => item.weekday))]
                            .sort((left, right) => left - right)
                            .map((weekday) => {
                              const dayItems = plan.timeline
                                .filter((item) => item.weekday === weekday)
                                .sort((left, right) => left.startTime.localeCompare(right.startTime));
                              const dayDate = addDays(weekStart, weekday - 1);
                              return (
                                <article
                                  key={weekday}
                                  className={`rounded-2xl border p-3.5 shadow-sm ${timelineDayStyles[weekday]}`}
                                >
                                  <div className="flex items-center justify-between gap-2 border-b border-white/80 pb-2">
                                    <h5 className="font-bold text-slate-800">{planWeekdays[weekday]}</h5>
                                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[0.6875rem] font-semibold text-slate-600">
                                      {dayDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="mt-3 space-y-3">
                                    {dayItems.map((item, index) => (
                                      <div key={`${weekday}-${item.startTime}-${index}`} className="flex gap-3">
                                        <span className="shrink-0 rounded-lg bg-white/80 px-2 py-1 text-[0.6875rem] font-bold tabular-nums text-indigo-700">
                                          {item.startTime}<br />{item.endTime}
                                        </span>
                                        <div className="min-w-0">
                                          <p className="text-sm font-semibold leading-5 text-slate-800">{item.activity}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </article>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm leading-6 text-slate-600">
                          Chưa có khung giờ rảnh cụ thể để xếp timeline. Bạn thêm giờ rảnh vào ghi chú phía trên nhé.
                        </p>
                      )}
                    </section>
                  </div>
                ) : (
                  <div className="relative mt-2 text-sm leading-7 text-slate-700">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h3 className="mb-3 mt-7 text-lg font-bold text-indigo-950">{children}</h3>,
                        h2: ({ children }) => <h3 className="mb-3 mt-7 text-lg font-bold text-indigo-950">{children}</h3>,
                        h3: ({ children }) => <h3 className="mb-3 mt-7 text-lg font-bold text-indigo-950">{children}</h3>,
                        h4: ({ children }) => <h4 className="mb-2 mt-5 font-bold text-slate-800">{children}</h4>,
                        p: ({ children }) => <p className="my-3 leading-7 text-slate-600">{children}</p>,
                        ul: ({ children }) => <ul className="my-3 ml-5 list-disc space-y-1.5 marker:text-fuchsia-400">{children}</ul>,
                        ol: ({ children }) => <ol className="my-3 ml-5 list-decimal space-y-1.5 marker:font-bold marker:text-indigo-500">{children}</ol>,
                        li: ({ children }) => <li className="pl-1 leading-7 text-slate-700">{children}</li>,
                        strong: ({ children }) => <strong className="font-bold text-indigo-900">{children}</strong>,
                        hr: () => <hr className="my-5 border-0 border-t border-dashed border-indigo-200" />,
                      }}
                    >
                      {suggestion}
                    </ReactMarkdown>
                  </div>
                )}
                <div className="mt-5 flex items-start gap-2 rounded-2xl bg-gradient-to-r from-cyan-50 to-violet-50 px-4 py-3 text-sm text-indigo-800 ring-1 ring-indigo-100/80">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <p>Mỗi bước nhỏ hoàn thành là một bước gần hơn tới mục tiêu của bạn. Cố lên nhé!</p>
                </div>
              </div>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
