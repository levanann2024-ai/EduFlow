import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Pencil, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
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
  type StudentExternalCommitment,
  type StudentStudyPreferences,
  type ProgressSemester,
  type StudentTimetableResponse,
} from '@/api/schoolApi';
import { WeeklySchedule, type ScheduleGridEntry } from './WeeklySchedule';

interface StudentScheduleProps {
  studentId: string;
}

const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const planDayLabels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
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
  startDate: string;
  priorities: Array<{ task: string; reason: string; durationMinutes: number }>;
  adjustments: string[];
  classWindows: Array<{ date: string; startTime: string; endTime: string }>;
  timeline: Array<{
    date: string;
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
      || typeof plan.startDate !== 'string'
      || !isValidDateKey(plan.startDate)
      || !Array.isArray(plan.priorities)
      || plan.priorities.length !== 3
      || !Array.isArray(plan.timeline)
      || plan.timeline.length > 28
      || (plan.adjustments !== undefined
        && (!Array.isArray(plan.adjustments)
          || plan.adjustments.length > 3
          || !plan.adjustments.every((item) => typeof item === 'string')))) return null;

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
      if (typeof entry.date !== 'string'
        || !isValidDateKey(entry.date)
        || typeof entry.startTime !== 'string'
        || typeof entry.endTime !== 'string'
        || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.startTime)
        || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.endTime)
        || entry.startTime >= entry.endTime
        || typeof entry.activity !== 'string'
        || typeof entry.kind !== 'string'
        || !studentPlanKinds.has(entry.kind)) return null;
      return {
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        activity: entry.activity,
        kind: entry.kind as StudentPlanKind,
      };
    });
    const classWindows = Array.isArray(plan.classWindows)
      ? plan.classWindows.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const window = item as Record<string, unknown>;
        if (typeof window.date !== 'string'
          || !isValidDateKey(window.date)
          || typeof window.startTime !== 'string'
          || !/^([01]\d|2[0-3]):[0-5]\d$/.test(window.startTime)
          || typeof window.endTime !== 'string'
          || !/^([01]\d|2[0-3]):[0-5]\d$/.test(window.endTime)
          || window.startTime >= window.endTime) return null;
        return { date: window.date, startTime: window.startTime, endTime: window.endTime };
      })
      : [];
    if (priorities.some((item) => item === null)
      || timeline.some((item) => item === null)
      || classWindows.some((item) => item === null)) return null;
    return {
      overview: plan.overview,
      lifeBalanceTip: typeof plan.lifeBalanceTip === 'string' ? plan.lifeBalanceTip : '',
      startDate: plan.startDate,
      priorities: priorities as StudentSchedulePlan['priorities'],
      adjustments: Array.isArray(plan.adjustments) ? plan.adjustments as string[] : [],
      classWindows: classWindows as StudentSchedulePlan['classWindows'],
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

function addDateKeyDays(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getPlanDateTime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date()).reduce<Record<string, string>>((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function planDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return `${planDayLabels[date.getUTCDay()]} · ${date.toLocaleDateString('vi-VN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
  })}`;
}

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getAvailabilityIntervals(text: string, startDate: string, defaultSection: 'free' | 'busy' = 'free') {
  const intervals: Array<{ date: string; startTime: string; endTime: string }> = [];
  const weekdayPattern = /(chủ\s*nhật|thứ\s*[2-7](?:\s*(?:,|và|&)?\s*[2-7])*)/giu;
  const timeRangePattern = /(\d{1,2}(?::\d{2}|h\d{0,2})?)\s*(sáng|trưa|chiều|tối)?\s*(?:-|–|—|đến|tới)\s*(\d{1,2}(?::\d{2}|h\d{0,2})?)\s*(sáng|trưa|chiều|tối)?/giu;
  let section = defaultSection;
  const parseTime = (value: string, period: string) => {
    const match = value.match(/^(\d{1,2})(?::(\d{2})|h(\d{1,2})?)?$/iu);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] ?? match[3] ?? 0);
    if (hour > 23 || minute > 59) return null;
    if (period === 'sáng' && hour === 12) hour = 0;
    if (['trưa', 'chiều', 'tối'].includes(period) && hour > 0 && hour < 12) hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };
  for (const line of text.split(/\r?\n/)) {
    if (/thời gian rảnh/i.test(line)) section = 'free';
    if (/thời gian bận/i.test(line)) section = 'busy';
    const weekdays = [...line.matchAll(weekdayPattern)].flatMap((match) => (
      match[0].toLocaleLowerCase('vi').startsWith('chủ')
        ? [7]
        : [...match[0].matchAll(/[2-7]/g)].map((weekdayMatch) => Number(weekdayMatch[0]) - 1)
    ));
    const timeRanges = [...line.matchAll(timeRangePattern)].flatMap((match) => {
      const sharedPeriod = match[4] || match[2] || '';
      const start = parseTime(match[1], match[2] || sharedPeriod);
      const end = parseTime(match[3], match[4] || sharedPeriod);
      if (!start || !end || start >= end) return [];
      const ranges = [{ startTime: start, endTime: end }];
      if (section === 'busy' && !match[2] && !match[4]) {
        const afternoonStart = parseTime(match[1], 'chiều');
        const afternoonEnd = parseTime(match[3], 'chiều');
        if (afternoonStart && afternoonEnd && afternoonStart < afternoonEnd
          && (afternoonStart !== start || afternoonEnd !== end)) {
          ranges.push({ startTime: afternoonStart, endTime: afternoonEnd });
        }
      }
      return ranges;
    });
    for (const weekday of weekdays) {
      for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
        const date = addDateKeyDays(startDate, dayOffset);
        const dateWeekday = new Date(`${date}T00:00:00.000Z`).getUTCDay() || 7;
        if (dateWeekday !== weekday) continue;
        intervals.push(...timeRanges.map((range) => ({ date, ...range })));
      }
    }
  }
  return intervals;
}

function noteKey(studentId: string, weekStart: string) {
  return `eduflow-student-week-plan:${studentId}:${weekStart}`;
}

function preferencesKey(studentId: string) {
  return `eduflow-student-study-preferences:${studentId}`;
}

function emptyStudyPreferences(): StudentStudyPreferences {
  return {
    subjectCombination: '',
    dailyStudyMinutes: null,
    sessionMinutes: null,
    preferredStudyTime: 'flexible',
    customStudyTime: '',
    habitNotes: '',
  };
}

function loadStudentStudyPreferences(key: string) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      return { preferences: emptyStudyPreferences(), commitments: [] as StudentExternalCommitment[], error: '' };
    }
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Dữ liệu thiết lập không đúng định dạng.');
    }
    const value = parsed as Record<string, unknown>;
    const rawPreferences = value.preferences && typeof value.preferences === 'object'
      && !Array.isArray(value.preferences)
      ? value.preferences as Record<string, unknown>
      : {};
    const priorities = ['high', 'medium', 'low'] as const;
    const preferredTimes = ['morning', 'afternoon', 'evening', 'flexible', 'custom'] as const;
    const preferences: StudentStudyPreferences = {
      subjectCombination: typeof rawPreferences.subjectCombination === 'string'
        ? rawPreferences.subjectCombination.slice(0, 200) : '',
      dailyStudyMinutes: Number.isInteger(rawPreferences.dailyStudyMinutes)
        && Number(rawPreferences.dailyStudyMinutes) >= 15
        && Number(rawPreferences.dailyStudyMinutes) <= 480
        ? Number(rawPreferences.dailyStudyMinutes) : null,
      sessionMinutes: Number.isInteger(rawPreferences.sessionMinutes)
        && Number(rawPreferences.sessionMinutes) >= 10
        && Number(rawPreferences.sessionMinutes) <= 180
        ? Number(rawPreferences.sessionMinutes) : null,
      preferredStudyTime: preferredTimes.includes(rawPreferences.preferredStudyTime as typeof preferredTimes[number])
        ? rawPreferences.preferredStudyTime as typeof preferredTimes[number] : 'flexible',
      customStudyTime: typeof rawPreferences.customStudyTime === 'string'
        ? rawPreferences.customStudyTime.slice(0, 120) : '',
      habitNotes: typeof rawPreferences.habitNotes === 'string'
        ? rawPreferences.habitNotes.slice(0, 600) : '',
    };
    const commitments = Array.isArray(value.commitments)
      ? value.commitments.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const commitment = item as Record<string, unknown>;
        if (typeof commitment.title !== 'string' || !commitment.title.trim()
          || typeof commitment.date !== 'string'
          || !isValidDateKey(commitment.date)
          || (commitment.type !== undefined && commitment.type !== 'deadline')
          || !priorities.includes(commitment.priority as typeof priorities[number])) return [];
        return [{
          title: commitment.title.slice(0, 120),
          date: commitment.date,
          priority: commitment.priority as StudentExternalCommitment['priority'],
        }];
      }).slice(0, 20)
      : [];
    return { preferences, commitments, error: '' };
  } catch {
    return {
      preferences: emptyStudyPreferences(),
      commitments: [] as StudentExternalCommitment[],
      error: 'Không thể đọc thiết lập học tập đã lưu trên thiết bị này.',
    };
  }
}

function loadSavedPlan(key: string) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return { freeTime: '', busyTime: '', suggestion: '', completedPriorities: [], remainingTimeIsFree: false, error: '' };
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { freeTime: '', busyTime: '', suggestion: '', completedPriorities: [], remainingTimeIsFree: false, error: 'Ghi chú đã lưu không đúng định dạng.' };
    }
    const value = parsed as {
      availability?: unknown;
      freeTime?: unknown;
      busyTime?: unknown;
      suggestion?: unknown;
      completedPriorities?: unknown;
      remainingTimeIsFree?: unknown;
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
      remainingTimeIsFree: value.remainingTimeIsFree === true,
      error: '',
    };
  } catch {
    return {
      freeTime: '',
      busyTime: '',
      suggestion: '',
      completedPriorities: [],
      remainingTimeIsFree: false,
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
  const [studyPreferences, setStudyPreferences] = useState<StudentStudyPreferences>(emptyStudyPreferences);
  const [externalCommitments, setExternalCommitments] = useState<StudentExternalCommitment[]>([]);
  const [preferencesLoadedFor, setPreferencesLoadedFor] = useState('');
  const [studyPreferencesDirty, setStudyPreferencesDirty] = useState(false);
  const [commitmentDraft, setCommitmentDraft] = useState({
    title: '',
    date: getPlanDateTime().date,
    priority: 'medium' as StudentExternalCommitment['priority'],
  });
  const [remainingTimeIsFree, setRemainingTimeIsFree] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [completedPriorities, setCompletedPriorities] = useState<number[]>([]);
  const [editingPlanSection, setEditingPlanSection] = useState<'priorities' | 'timeline' | null>(null);
  const [priorityDraft, setPriorityDraft] = useState<StudentSchedulePlan['priorities'] | null>(null);
  const [timelineDraft, setTimelineDraft] = useState<StudentSchedulePlan['timeline'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [exportingCalendar, setExportingCalendar] = useState(false);
  const [error, setError] = useState('');
  const [calendarExportError, setCalendarExportError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [planClock, setPlanClock] = useState(getPlanDateTime);

  const weekStartKey = dateKey(weekStart);
  const storageKey = noteKey(studentId, weekStartKey);
  const studyPreferencesStorageKey = preferencesKey(studentId);
  const plan = useMemo(() => {
    const parsed = parseStudentSchedulePlan(suggestion);
    if (!parsed) return null;
    const endDate = addDateKeyDays(parsed.startDate, 7);
    return {
      ...parsed,
      timeline: parsed.timeline.filter((item) => (
        item.date >= planClock.date
        && item.date <= endDate
        && (item.date > planClock.date || item.startTime > planClock.time)
      )),
    };
  }, [planClock, suggestion]);
  const availability = [
    freeTime.trim() ? `Thời gian rảnh:\n${freeTime.trim()}` : '',
    busyTime.trim() ? `Thời gian bận:\n${busyTime.trim()}` : '',
  ].filter(Boolean).join('\n\n');
  const weekDays = useMemo(() => days.map((label, index) => ({
    label,
    date: addDays(weekStart, index),
  })), [weekStart]);

  useEffect(() => {
    const timer = window.setInterval(() => setPlanClock(getPlanDateTime()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = loadSavedPlan(storageKey);
    setFreeTime(saved.freeTime);
    setBusyTime(saved.busyTime);
    setRemainingTimeIsFree(saved.remainingTimeIsFree);
    setSuggestion(saved.suggestion);
    setCompletedPriorities(saved.completedPriorities);
    setEditingPlanSection(null);
    setPriorityDraft(null);
    setTimelineDraft(null);
    setStorageError(saved.error);
  }, [storageKey]);

  useEffect(() => {
    const saved = loadStudentStudyPreferences(studyPreferencesStorageKey);
    setStudyPreferences(saved.preferences);
    setExternalCommitments(saved.commitments);
    setPreferencesLoadedFor(studentId);
    setStudyPreferencesDirty(false);
    if (saved.error) setStorageError(saved.error);
  }, [studentId, studyPreferencesStorageKey]);

  useEffect(() => {
    if (preferencesLoadedFor !== studentId || !studyPreferencesDirty) return;
    try {
      localStorage.setItem(studyPreferencesStorageKey, JSON.stringify({
        preferences: studyPreferences,
        commitments: externalCommitments,
      }));
      setStudyPreferencesDirty(false);
    } catch {
      setStorageError('Không thể lưu thiết lập học tập trên thiết bị này. Nội dung vẫn được giữ trong phiên hiện tại.');
    }
  }, [externalCommitments, preferencesLoadedFor, studyPreferences, studyPreferencesDirty, studyPreferencesStorageKey, studentId]);

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
    nextRemainingTimeIsFree = remainingTimeIsFree,
  ) => {
    setStorageError('');
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        freeTime: nextFreeTime,
        busyTime: nextBusyTime,
        suggestion: nextSuggestion,
        completedPriorities: nextCompletedPriorities,
        remainingTimeIsFree: nextRemainingTimeIsFree,
      }));
    } catch {
      setStorageError('Không thể lưu ghi chú trên thiết bị này. Nội dung vẫn được giữ trong phiên hiện tại.');
    }
  };
  const updateStudyPreferences = (nextPreferences: StudentStudyPreferences) => {
    setStudyPreferences(nextPreferences);
    setStudyPreferencesDirty(true);
    setSuggestion('');
    setCompletedPriorities([]);
    savePlan(freeTime, busyTime, '', []);
  };
  const updateExternalCommitments = (nextCommitments: StudentExternalCommitment[]) => {
    setExternalCommitments(nextCommitments);
    setStudyPreferencesDirty(true);
    setSuggestion('');
    setCompletedPriorities([]);
    savePlan(freeTime, busyTime, '', []);
  };
  const addExternalCommitment = () => {
    if (!commitmentDraft.title.trim() || !isValidDateKey(commitmentDraft.date)) {
      setError('Hãy nhập tên hoạt động và ngày hợp lệ.');
      return;
    }
    if (externalCommitments.length >= 20) {
      setError('Bạn có thể thêm tối đa 20 hoạt động ngoài trường.');
      return;
    }
    updateExternalCommitments([...externalCommitments, {
      title: commitmentDraft.title.trim(),
      date: commitmentDraft.date,
      priority: commitmentDraft.priority,
    }]);
    setCommitmentDraft((current) => ({ ...current, title: '' }));
    setError('');
  };
  const cancelPlanSectionEdit = () => {
    setEditingPlanSection(null);
    setPriorityDraft(null);
    setTimelineDraft(null);
  };
  const saveEditedPlan = (nextPlan: StudentSchedulePlan) => {
    const nextSuggestion = JSON.stringify(nextPlan);
    if (!parseStudentSchedulePlan(nextSuggestion)) {
      setError('Nội dung chỉnh sửa chưa hợp lệ. Hãy kiểm tra lại rồi lưu.');
      return;
    }
    setSuggestion(nextSuggestion);
    savePlan(freeTime, busyTime, nextSuggestion, completedPriorities);
    setError('');
    cancelPlanSectionEdit();
  };
  const startEditingPriorities = () => {
    if (!plan) return;
    setPriorityDraft(plan.priorities.map((priority) => ({ ...priority })));
    setTimelineDraft(null);
    setEditingPlanSection('priorities');
  };
  const startEditingTimeline = () => {
    if (!plan) return;
    setTimelineDraft(plan.timeline.map((item) => ({ ...item })));
    setPriorityDraft(null);
    setEditingPlanSection('timeline');
  };
  const savePriorityDraft = () => {
    if (!plan || !priorityDraft) return;
    const priorities = priorityDraft.map((priority) => ({
      ...priority,
      task: priority.task.trim(),
      reason: priority.reason.trim(),
    }));
    if (priorities.some((priority) => (
      !priority.task || !Number.isInteger(priority.durationMinutes) || priority.durationMinutes < 1 || priority.durationMinutes > 600
    ))) {
      setError('Hãy nhập nội dung cho cả 3 ưu tiên và thời lượng từ 1 đến 600 phút.');
      return;
    }
    saveEditedPlan({ ...plan, priorities });
  };
  const saveTimelineDraft = () => {
    if (!plan || !timelineDraft) return;
    const now = getPlanDateTime();
    const endDate = addDateKeyDays(plan.startDate, 7);
    const busyIntervals = getAvailabilityIntervals(busyTime, plan.startDate, 'busy');
    const freeIntervals = getAvailabilityIntervals(freeTime, plan.startDate);
    const sortedTimeline = [...timelineDraft].sort((left, right) => (
      left.date.localeCompare(right.date) || left.startTime.localeCompare(right.startTime)
    ));
    const previousEndByDate = new Map<string, string>();
    const studyMinutesByDate = new Map<string, number>();
    if (timelineDraft.length > 28 || timelineDraft.some((item) => (
      item.date < plan.startDate || item.date > endDate
      || (item.date < now.date)
      || (item.date === now.date && item.startTime <= now.time)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.endTime)
      || item.startTime >= item.endTime
      || !item.activity.trim()
    ))) {
      setError('Lịch cá nhân chỉ được có giờ từ hôm nay đến hết cùng thứ tuần sau, không được đặt vào quá khứ và giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }
    for (const item of sortedTimeline) {
      const previousEnd = previousEndByDate.get(item.date);
      if (previousEnd && item.startTime < previousEnd) {
        setError('Các hoạt động trong lịch cá nhân không được trùng giờ.');
        return;
      }
      if (busyIntervals.some((interval) => (
        interval.date === item.date && item.startTime < interval.endTime && item.endTime > interval.startTime
      ))) {
        setError('Khung giờ trong lịch cá nhân đang trùng với thời gian bận đã ghi.');
        return;
      }
      if (plan.classWindows.some((window) => (
        window.date === item.date && item.startTime < window.endTime && item.endTime > window.startTime
      ))) {
        setError('Khung giờ trong lịch cá nhân đang trùng với tiết học đã có trong thời khóa biểu.');
        return;
      }
      if (!remainingTimeIsFree && !freeIntervals.some((interval) => (
        interval.date === item.date
        && item.startTime >= interval.startTime
        && item.endTime <= interval.endTime
      ))) {
        setError('Chỉ lưu hoạt động nằm trọn trong khung giờ rảnh đã ghi, hoặc bật “Thời gian chưa ghi là rảnh”.');
        return;
      }
      if (['study', 'homework', 'review'].includes(item.kind)) {
        const [startHour, startMinute] = item.startTime.split(':').map(Number);
        const [endHour, endMinute] = item.endTime.split(':').map(Number);
        const duration = endHour * 60 + endMinute - (startHour * 60 + startMinute);
        const dailyTotal = (studyMinutesByDate.get(item.date) ?? 0) + duration;
        if (studyPreferences.sessionMinutes !== null && duration > studyPreferences.sessionMinutes) {
          setError(`Mỗi phiên tự học không được dài hơn ${studyPreferences.sessionMinutes} phút theo thiết lập của bạn.`);
          return;
        }
        if (studyPreferences.dailyStudyMinutes !== null && dailyTotal > studyPreferences.dailyStudyMinutes) {
          setError(`Tổng thời gian tự học trong ngày không được vượt ${studyPreferences.dailyStudyMinutes} phút theo thiết lập của bạn.`);
          return;
        }
        studyMinutesByDate.set(item.date, dailyTotal);
      }
      previousEndByDate.set(item.date, item.endTime);
    }
    saveEditedPlan({
      ...plan,
      timeline: timelineDraft.map((item) => ({ ...item, activity: item.activity.trim() })),
    });
  };
  const updateAvailability = (field: 'free' | 'busy', value: string) => {
    const nextFreeTime = field === 'free' ? value : freeTime;
    const nextBusyTime = field === 'busy' ? value : busyTime;
    setFreeTime(nextFreeTime);
    setBusyTime(nextBusyTime);
    setSuggestion('');
    setCompletedPriorities([]);
    savePlan(nextFreeTime, nextBusyTime, '', [], remainingTimeIsFree);
  };
  const updateRemainingTimeRule = (checked: boolean) => {
    setRemainingTimeIsFree(checked);
    setSuggestion('');
    setCompletedPriorities([]);
    savePlan(freeTime, busyTime, '', [], checked);
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
    if (studyPreferences.preferredStudyTime === 'custom' && !studyPreferences.customStudyTime.trim()) {
      setError('Hãy nhập khung giờ học phù hợp của bạn.');
      return;
    }
    let commitmentsForPlan = externalCommitments;
    if (commitmentDraft.title.trim()) {
      if (!isValidDateKey(commitmentDraft.date)) {
        setError('Hãy nhập ngày hợp lệ cho hoạt động ngoài trường.');
        return;
      }
      if (externalCommitments.length >= 20) {
        setError('Bạn có thể thêm tối đa 20 hoạt động ngoài trường.');
        return;
      }
      commitmentsForPlan = [...externalCommitments, {
        title: commitmentDraft.title.trim(),
        date: commitmentDraft.date,
        priority: commitmentDraft.priority,
      }];
      updateExternalCommitments(commitmentsForPlan);
      setCommitmentDraft((current) => ({ ...current, title: '' }));
    }
    setPlanning(true);
    setError('');
    try {
      const result = await generateStudentTimetableSuggestion({
        semester,
        availability,
        remainingTimeIsFree,
        studyPreferences,
        externalCommitments: commitmentsForPlan,
      });
      if (!parseStudentSchedulePlan(result)) {
        throw new Error('AI chưa tạo được kế hoạch đúng định dạng. Bạn thử tạo lại nhé.');
      }
      setSuggestion(result);
      setCompletedPriorities([]);
      savePlan(freeTime, busyTime, result, [], remainingTimeIsFree);
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
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-blue-100 bg-white/80 px-3 py-2.5">
            <input
              type="checkbox"
              checked={remainingTimeIsFree}
              onChange={(event) => updateRemainingTimeRule(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">Thời gian chưa ghi là rảnh</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                Khi bật, AI sẽ xét cả tuần, trừ khung bận và giờ học đã biết.
              </span>
            </span>
          </label>
          <details className="mt-3 rounded-2xl border border-slate-200 bg-white/75 p-4">
            <summary className="cursor-pointer text-sm font-bold text-slate-800">
              Cá nhân hóa kế hoạch <span className="font-normal text-slate-500">(không bắt buộc)</span>
            </summary>
            <div className="mt-4 space-y-5">
              <section>
                <label className="block text-xs font-semibold text-slate-600">
                  Tổ hợp môn muốn tập trung
                  <input
                    value={studyPreferences.subjectCombination}
                    onChange={(event) => updateStudyPreferences({ ...studyPreferences, subjectCombination: event.target.value })}
                    maxLength={200}
                    placeholder="Ví dụ: Toán – Hóa – Sinh"
                    aria-label="Tổ hợp môn muốn tập trung"
                    className="input-field mt-1 text-sm font-normal"
                  />
                </label>
              </section>

              <section>
                <h3 className="text-sm font-bold text-slate-800">Thói quen học tập</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-600">
                    Mục tiêu tự học mỗi ngày
                    <select
                      value={studyPreferences.dailyStudyMinutes ?? ''}
                      onChange={(event) => updateStudyPreferences({
                        ...studyPreferences,
                        dailyStudyMinutes: event.target.value ? Number(event.target.value) : null,
                      })}
                      className="input-field mt-1 text-sm font-normal"
                    >
                      <option value="">Không đặt giới hạn</option>
                      {[60, 90, 120, 150, 180, 240, 300].map((minutes) => (
                        <option key={minutes} value={minutes}>{minutes >= 60 ? `${minutes / 60} giờ` : `${minutes} phút`}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Thời lượng tối đa mỗi phiên
                    <select
                      value={studyPreferences.sessionMinutes ?? ''}
                      onChange={(event) => updateStudyPreferences({
                        ...studyPreferences,
                        sessionMinutes: event.target.value ? Number(event.target.value) : null,
                      })}
                      className="input-field mt-1 text-sm font-normal"
                    >
                      <option value="">Linh hoạt</option>
                      {[25, 30, 45, 60, 90, 120].map((minutes) => (
                        <option key={minutes} value={minutes}>{minutes} phút</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Buổi học thoải mái nhất
                    <select
                      value={studyPreferences.preferredStudyTime}
                      onChange={(event) => updateStudyPreferences({
                        ...studyPreferences,
                        preferredStudyTime: event.target.value as StudentStudyPreferences['preferredStudyTime'],
                      })}
                      className="input-field mt-1 text-sm font-normal"
                    >
                      <option value="flexible">Linh hoạt</option>
                      <option value="morning">Buổi sáng</option>
                      <option value="afternoon">Buổi chiều</option>
                      <option value="evening">Buổi tối</option>
                      <option value="custom">Khung giờ khác</option>
                    </select>
                  </label>
                </div>
                {studyPreferences.preferredStudyTime === 'custom' && (
                  <input
                    value={studyPreferences.customStudyTime}
                    onChange={(event) => updateStudyPreferences({ ...studyPreferences, customStudyTime: event.target.value })}
                    maxLength={120}
                    placeholder="Ví dụ: 16:30–18:00"
                    aria-label="Khung giờ học phù hợp"
                    className="input-field mt-3 text-sm"
                  />
                )}
                <label className="mt-3 block text-xs font-semibold text-slate-600">
                  Thói quen hoặc lưu ý khác
                  <textarea
                    value={studyPreferences.habitNotes}
                    onChange={(event) => updateStudyPreferences({ ...studyPreferences, habitNotes: event.target.value })}
                    maxLength={600}
                    rows={2}
                    placeholder="Ví dụ: thích học theo từng phiên ngắn và nghỉ giữa giờ."
                    className="input-field mt-1 resize-y text-sm font-normal"
                  />
                </label>
              </section>

              <section>
                <h3 className="text-sm font-bold text-slate-800">Công việc ngoài trường</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Chỉ thêm deadline; lịch bận cố định hãy ghi ở mục Thời gian bận. Nội dung còn trong ô nhập cũng sẽ được lưu và gửi khi bạn lập kế hoạch.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <input
                    value={commitmentDraft.title}
                    onChange={(event) => setCommitmentDraft({ ...commitmentDraft, title: event.target.value })}
                    maxLength={120}
                    placeholder="Tên hoạt động"
                    aria-label="Tên công việc ngoài trường"
                    className="input-field text-sm lg:col-span-2"
                  />
                  <input
                    type="date"
                    value={commitmentDraft.date}
                    onChange={(event) => setCommitmentDraft({ ...commitmentDraft, date: event.target.value })}
                    aria-label="Hạn hoàn thành"
                    className="input-field text-sm"
                  />
                  <select
                    value={commitmentDraft.priority}
                    onChange={(event) => setCommitmentDraft({
                      ...commitmentDraft,
                      priority: event.target.value as StudentExternalCommitment['priority'],
                    })}
                    aria-label="Mức ưu tiên hoạt động"
                    className="input-field text-sm"
                  >
                    <option value="high">Ưu tiên cao</option>
                    <option value="medium">Ưu tiên vừa</option>
                    <option value="low">Ưu tiên thấp</option>
                  </select>
                  <button
                    type="button"
                    onClick={addExternalCommitment}
                    disabled={!commitmentDraft.title.trim()}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Thêm hoạt động
                  </button>
                </div>
                {externalCommitments.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {externalCommitments.map((commitment, index) => (
                      <li key={`${commitment.date}-${commitment.title}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <span>
                          <strong>{commitment.title}</strong>
                          <span className="ml-2 text-xs text-slate-500">
                            Deadline · {commitment.date}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => updateExternalCommitments(externalCommitments.filter((_, itemIndex) => itemIndex !== index))}
                          aria-label={`Xóa hoạt động ${commitment.title}`}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </details>
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
          {suggestion && plan && (
            <article className="relative mt-6 overflow-hidden rounded-3xl border border-white/80 bg-white/90 shadow-xl shadow-indigo-100/70 ring-1 ring-indigo-100/80">
              <div aria-hidden="true" className="h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 via-violet-500 to-fuchsia-400" />
              <div className="relative overflow-hidden p-4 sm:p-6">
                <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-100/70 blur-2xl" />
                {plan ? (
                  <div className="relative space-y-6">
                    <p className="rounded-2xl bg-gradient-to-r from-indigo-50 via-sky-50 to-fuchsia-50 px-4 py-3 text-sm leading-6 text-indigo-900 ring-1 ring-indigo-100">
                      {plan.overview}
                    </p>

                    {plan.adjustments.length > 0 && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900" role="status">
                        <p className="font-semibold">Điều chỉnh cần lưu ý</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {plan.adjustments.map((adjustment, index) => <li key={`${index}-${adjustment}`}>{adjustment}</li>)}
                        </ul>
                      </div>
                    )}

                    {plan.lifeBalanceTip && (
                      <p className="flex items-start gap-2 rounded-2xl border border-fuchsia-100 bg-gradient-to-r from-fuchsia-50 to-amber-50 px-4 py-3 text-sm leading-6 text-slate-700">
                        <Sparkles className="mt-1 h-4 w-4 shrink-0 text-fuchsia-500" />
                        <span>{plan.lifeBalanceTip}</span>
                      </p>
                    )}

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
                      {editingPlanSection === 'priorities' && priorityDraft ? (
                        <div className="grid gap-3 md:grid-cols-3">
                          {priorityDraft.map((priority, index) => (
                            <article key={index} className={`space-y-3 rounded-2xl border p-4 ${priorityCards[index].cardStyle}`}>
                              <p className="text-xs font-bold text-slate-700">{priorityCards[index].label}</p>
                              <label className="block text-xs font-semibold text-slate-600">
                                Việc cần làm
                                <input
                                  value={priority.task}
                                  onChange={(event) => setPriorityDraft((current) => current?.map((item, itemIndex) => (
                                    itemIndex === index ? { ...item, task: event.target.value } : item
                                  )) ?? null)}
                                  maxLength={240}
                                  className="input-field mt-1 text-sm font-normal"
                                />
                              </label>
                              <label className="block text-xs font-semibold text-slate-600">
                                Ghi chú
                                <textarea
                                  value={priority.reason}
                                  onChange={(event) => setPriorityDraft((current) => current?.map((item, itemIndex) => (
                                    itemIndex === index ? { ...item, reason: event.target.value } : item
                                  )) ?? null)}
                                  maxLength={500}
                                  rows={3}
                                  className="input-field mt-1 resize-y text-sm font-normal"
                                />
                              </label>
                              <label className="block text-xs font-semibold text-slate-600">
                                Thời lượng (phút)
                                <input
                                  type="number"
                                  min={1}
                                  max={600}
                                  step={5}
                                  value={priority.durationMinutes}
                                  onChange={(event) => setPriorityDraft((current) => current?.map((item, itemIndex) => (
                                    itemIndex === index ? { ...item, durationMinutes: Number(event.target.value) } : item
                                  )) ?? null)}
                                  className="input-field mt-1 text-sm font-normal"
                                />
                              </label>
                            </article>
                          ))}
                        </div>
                      ) : (
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
                                  {priority.durationMinutes} phút {priority.task.startsWith('Ưu tiên cao:') ? 'mỗi ngày dự kiến' : 'dự kiến'}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-3 flex justify-end gap-2">
                        {editingPlanSection === 'priorities' ? (
                          <>
                            <button type="button" onClick={cancelPlanSectionEdit} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                              <X className="h-4 w-4" /> Hủy
                            </button>
                            <button type="button" onClick={savePriorityDraft} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
                              <Save className="h-4 w-4" /> Lưu
                            </button>
                          </>
                        ) : editingPlanSection === null ? (
                          <button type="button" onClick={startEditingPriorities} aria-label="Sửa kế hoạch học tập ưu tiên" title="Sửa kế hoạch học tập ưu tiên" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </section>

                    <section>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-100 text-indigo-700">
                            <CalendarDays className="h-4 w-4" />
                          </span>
                          <div>
                            <h4 className="font-bold text-slate-900">Lịch cá nhân</h4>
                            <p className="text-xs text-slate-500">Các khung giờ và hoạt động theo ngày</p>
                          </div>
                        </div>
                      </div>
                      {editingPlanSection === 'timeline' && timelineDraft ? (
                        <div className="space-y-3">
                          {timelineDraft.map((item, index) => (
                            <article key={`${index}-${item.date}`} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(120px,0.7fr)_minmax(110px,0.6fr)_minmax(110px,0.6fr)_minmax(200px,1.5fr)_auto]">
                                <label className="text-xs font-semibold text-slate-600">
                                  Ngày
                                  <select
                                    value={item.date}
                                    onChange={(event) => setTimelineDraft((current) => current?.map((entry, entryIndex) => (
                                      entryIndex === index ? { ...entry, date: event.target.value } : entry
                                    )) ?? null)}
                                    className="input-field mt-1 text-sm font-normal"
                                  >
                                    {Array.from({ length: 8 }, (_, dayIndex) => {
                                      const date = addDateKeyDays(plan.startDate, dayIndex);
                                      return <option key={date} value={date}>{planDateLabel(date)}</option>;
                                    })}
                                  </select>
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                  Bắt đầu
                                  <input
                                    type="time"
                                    value={item.startTime}
                                    onChange={(event) => setTimelineDraft((current) => current?.map((entry, entryIndex) => (
                                      entryIndex === index ? { ...entry, startTime: event.target.value } : entry
                                    )) ?? null)}
                                    className="input-field mt-1 text-sm font-normal"
                                  />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                  Kết thúc
                                  <input
                                    type="time"
                                    value={item.endTime}
                                    onChange={(event) => setTimelineDraft((current) => current?.map((entry, entryIndex) => (
                                      entryIndex === index ? { ...entry, endTime: event.target.value } : entry
                                    )) ?? null)}
                                    className="input-field mt-1 text-sm font-normal"
                                  />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                  Hoạt động
                                  <input
                                    value={item.activity}
                                    onChange={(event) => setTimelineDraft((current) => current?.map((entry, entryIndex) => (
                                      entryIndex === index ? { ...entry, activity: event.target.value } : entry
                                    )) ?? null)}
                                    maxLength={240}
                                    className="input-field mt-1 text-sm font-normal"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setTimelineDraft((current) => current?.filter((_, entryIndex) => entryIndex !== index) ?? null)}
                                  aria-label={`Xóa khung giờ ${index + 1}`}
                                  title="Xóa khung giờ"
                                  className="mt-1 grid h-10 w-10 place-items-center self-end rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </article>
                          ))}
                          <button
                            type="button"
                            onClick={() => setTimelineDraft((current) => current && current.length < 28
                              ? [...current, { date: plan.startDate, startTime: '19:00', endTime: '19:45', activity: '', kind: 'study' }]
                              : current)}
                            disabled={timelineDraft.length >= 28}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Plus className="h-4 w-4" /> Thêm khung giờ
                          </button>
                        </div>
                      ) : plan.timeline.length ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {[...new Set(plan.timeline.map((item) => item.date))]
                            .sort()
                            .map((date) => {
                              const dayItems = plan.timeline
                                .filter((item) => item.date === date)
                                .sort((left, right) => left.startTime.localeCompare(right.startTime));
                              return (
                                <article
                                  key={date}
                                  className={`rounded-2xl border p-3.5 shadow-sm ${timelineDayStyles[new Date(`${date}T00:00:00.000Z`).getUTCDay() || 7]}`}
                                >
                                  <div className="flex items-center justify-between gap-2 border-b border-white/80 pb-2">
                                    <h5 className="font-bold text-slate-800">{planDateLabel(date)}</h5>
                                    {date === getPlanDateTime().date && (
                                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[0.6875rem] font-semibold text-slate-600">Hôm nay</span>
                                    )}
                                  </div>
                                  <div className="mt-3 space-y-3">
                                    {dayItems.map((item, index) => (
                                      <div key={`${date}-${item.startTime}-${index}`} className="flex gap-3">
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
                      <div className="mt-3 flex justify-end gap-2">
                        {editingPlanSection === 'timeline' ? (
                          <>
                            <button type="button" onClick={cancelPlanSectionEdit} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                              <X className="h-4 w-4" /> Hủy
                            </button>
                            <button type="button" onClick={saveTimelineDraft} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
                              <Save className="h-4 w-4" /> Lưu
                            </button>
                          </>
                        ) : editingPlanSection === null ? (
                          <button type="button" onClick={startEditingTimeline} aria-label="Sửa lịch cá nhân" title="Sửa lịch cá nhân" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
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
