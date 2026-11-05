import { useEffect, useMemo, useState } from 'react';
import { showToast } from '@/components/toast';
import { BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Plus, Save, Sparkles, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  generateTeacherTimetableSuggestion,
  getTeacherTimetable,
  listClasses,
  saveTeacherTimetable,
  type ProgressSemester,
  type TeacherTimetableEntry,
  type TeacherTimetableResponse,
  type TimetableEntryType,
} from '@/api/schoolApi';
import {
  WeeklySchedule,
  type ScheduleGridEntry,
} from '@/pages/student/WeeklySchedule';

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
type ScheduleContentType = 'lesson' | 'homework' | 'exam' | 'other';
type TeacherGender = 'female' | 'male' | 'other' | 'unspecified' | null;
type TeacherPlanKind = 'prep' | 'grading' | 'feedback' | 'class' | 'admin' | 'break' | 'busy' | 'personal' | 'other';

const TEACHER_PLAN_KINDS = new Set<TeacherPlanKind>([
  'prep', 'grading', 'feedback', 'class', 'admin', 'break', 'busy', 'personal', 'other',
]);
const PLAN_WEEKDAYS = ['', ...DAYS, 'Chủ nhật'];
const PLAN_CARD_STYLES = [
  'border-orange-200 bg-gradient-to-br from-orange-100 via-rose-50 to-white shadow-sm shadow-orange-100',
  'border-violet-200 bg-gradient-to-br from-violet-100 via-purple-50 to-white shadow-sm shadow-violet-100',
  'border-emerald-200 bg-gradient-to-br from-emerald-100 via-teal-50 to-white shadow-sm shadow-emerald-100',
];
const PLAN_PRIORITY_BADGES = [
  'bg-orange-200 text-orange-900',
  'bg-violet-200 text-violet-900',
  'bg-emerald-200 text-emerald-900',
];
const PLAN_DAY_STYLES = [
  '',
  'border-sky-200 bg-gradient-to-br from-sky-100/80 to-white',
  'border-violet-200 bg-gradient-to-br from-violet-100/70 to-white',
  'border-rose-200 bg-gradient-to-br from-rose-100/70 to-white',
  'border-amber-200 bg-gradient-to-br from-amber-100/70 to-white',
  'border-emerald-200 bg-gradient-to-br from-emerald-100/70 to-white',
  'border-cyan-200 bg-gradient-to-br from-cyan-100/70 to-white',
  'border-fuchsia-200 bg-gradient-to-br from-fuchsia-100/60 to-white',
];
const PLAN_KIND_LABELS: Record<TeacherPlanKind, string> = {
  prep: 'Soạn bài',
  grading: 'Chấm bài',
  feedback: 'Phản hồi',
  class: 'Lên lớp',
  admin: 'Công việc chung',
  break: 'Nghỉ ngơi',
  busy: 'Bận',
  personal: 'Cá nhân',
  other: 'Khác',
};
const PLAN_KIND_STYLES: Record<TeacherPlanKind, string> = {
  prep: 'border-blue-200 bg-blue-100 text-blue-800',
  grading: 'border-amber-200 bg-amber-100 text-amber-900',
  feedback: 'border-violet-200 bg-violet-100 text-violet-800',
  class: 'border-cyan-200 bg-cyan-100 text-cyan-900',
  admin: 'border-slate-200 bg-slate-100 text-slate-700',
  break: 'border-emerald-200 bg-emerald-100 text-emerald-900',
  busy: 'border-rose-200 bg-rose-100 text-rose-900',
  personal: 'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-900',
  other: 'border-indigo-200 bg-indigo-100 text-indigo-900',
};

interface TeacherScheduleNotes {
  freeTime: string;
  busyTime: string;
  legacyNote: string;
}

function parseTeacherScheduleNotes(raw: string): TeacherScheduleNotes {
  const lines = raw.split('\n');
  const notes: TeacherScheduleNotes = { freeTime: '', busyTime: '', legacyNote: '' };
  let section: keyof TeacherScheduleNotes | null = null;
  let hasSections = false;
  const values: Record<keyof TeacherScheduleNotes, string[]> = {
    freeTime: [],
    busyTime: [],
    legacyNote: [],
  };

  lines.forEach((line) => {
    const header = line.trim().toLocaleLowerCase('vi');
    if (header === 'thời gian rảnh:') {
      section = 'freeTime';
      hasSections = true;
    } else if (header === 'thời gian bận:') {
      section = 'busyTime';
      hasSections = true;
    } else if (header === 'ghi chú cũ (chưa phân loại):') {
      section = 'legacyNote';
      hasSections = true;
    } else if (section) {
      values[section].push(line);
    } else if (line.trim()) {
      values.legacyNote.push(line);
    }
  });

  if (!hasSections) return { ...notes, legacyNote: raw };
  return {
    freeTime: values.freeTime.join('\n').trim(),
    busyTime: values.busyTime.join('\n').trim(),
    legacyNote: values.legacyNote.join('\n').trim(),
  };
}

function serializeTeacherScheduleNotes(notes: TeacherScheduleNotes): string {
  return [
    notes.freeTime.trim() ? `Thời gian rảnh:\n${notes.freeTime.trim()}` : '',
    notes.busyTime.trim() ? `Thời gian bận:\n${notes.busyTime.trim()}` : '',
    notes.legacyNote.trim() ? `Ghi chú cũ (chưa phân loại):\n${notes.legacyNote.trim()}` : '',
  ].filter(Boolean).join('\n\n');
}

interface TeacherSchedulePlan {
  overview: string;
  dataNotes: string[];
  priorities: Array<{ task: string; reason: string; durationMinutes: number }>;
  timeline: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
    activity: string;
    kind: TeacherPlanKind;
  }>;
}

function parseTeacherSchedulePlan(raw: string): TeacherSchedulePlan | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const plan = value as Record<string, unknown>;
    if (typeof plan.overview !== 'string'
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
        || entry.weekday < 1
        || entry.weekday > 7
        || typeof entry.startTime !== 'string'
        || typeof entry.endTime !== 'string'
        || typeof entry.activity !== 'string'
        || typeof entry.kind !== 'string'
        || !TEACHER_PLAN_KINDS.has(entry.kind as TeacherPlanKind)) return null;
      return {
        weekday: entry.weekday,
        startTime: entry.startTime,
        endTime: entry.endTime,
        activity: entry.activity,
        kind: entry.kind as TeacherPlanKind,
      };
    });
    if (priorities.some((item) => item === null) || timeline.some((item) => item === null)) return null;
    return {
      overview: plan.overview,
      dataNotes: plan.dataNotes as string[],
      priorities: priorities as TeacherSchedulePlan['priorities'],
      timeline: timeline as TeacherSchedulePlan['timeline'],
    };
  } catch {
    return null;
  }
}

interface EntryEditorState {
  weekday: number;
  period: number;
  classId: string;
  subject: string;
  type: TimetableEntryType;
  title: string;
  topic: string;
  hasHomework: boolean;
  homeworkTitle: string;
  hasExam: boolean;
  examTitle: string;
  hasExamReturn: boolean;
  examReturnNote: string;
  examReturnAt: string;
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

function toLocalInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function asGridEntry(entry: TeacherTimetableEntry): ScheduleGridEntry {
  return {
    weekday: entry.weekday,
    period: entry.period,
    subject: entry.subject,
    type: entry.type,
    title: entry.title,
    topic: entry.topic,
    classCode: entry.classCode,
    isHomeroom: entry.isHomeroom,
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
    roomExamTitle: entry.roomExamTitle,
  };
}

export function TeacherSchedule({ gender }: { gender?: TeacherGender }) {
  const [classOptions, setClassOptions] = useState<Array<{ id: string; academicYear: string }>>([]);
  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState<ProgressSemester>('Kỳ 1');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [data, setData] = useState<TeacherTimetableResponse | null>(null);
  const [entries, setEntries] = useState<TeacherTimetableEntry[]>([]);
  const [freeTime, setFreeTime] = useState('');
  const [busyTime, setBusyTime] = useState('');
  const [legacyNote, setLegacyNote] = useState('');
  const [editor, setEditor] = useState<EntryEditorState | null>(null);
  const [editorContentType, setEditorContentType] = useState<ScheduleContentType | null>(null);
  const [contentMenuOpen, setContentMenuOpen] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  const weekStartKey = dateKey(weekStart);
  const weekDays = useMemo(() => DAYS.map((label, index) => ({
    label,
    date: addDays(weekStart, index),
  })), [weekStart]);
  const availableClasses = data?.classes ?? [];
  const plan = useMemo(() => parseTeacherSchedulePlan(suggestion), [suggestion]);
  const teacherNotes = useMemo(() => serializeTeacherScheduleNotes({
    freeTime,
    busyTime,
    legacyNote,
  }), [freeTime, busyTime, legacyNote]);
  const teacherAddress = gender === 'male' ? 'thầy' : gender === 'female' ? 'cô' : 'thầy/cô';
  const periodCount = data?.timetable?.periodCount ?? 5;
  const sessionLabel = data?.timetable?.session === 'afternoon' ? 'Buổi chiều' : 'Buổi sáng';

  useEffect(() => {
    let active = true;
    setInitialLoading(true);
    listClasses()
      .then((classes) => {
        if (!active) return;
        const years = [...new Set(classes.map((item) => item.academic_year))].sort().reverse();
        setClassOptions(classes.map((item) => ({ id: item.id, academicYear: item.academic_year })));
        setAcademicYear((current) => current || years[0] || '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải lớp được phân công.');
      })
      .finally(() => {
        if (active) setInitialLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!academicYear) return;
    let active = true;
    setLoading(true);
    setError('');
    setData(null);
    setEntries([]);
    setFreeTime('');
    setBusyTime('');
    setLegacyNote('');
    setEditor(null);
    setContentMenuOpen(false);
    getTeacherTimetable(academicYear, semester, weekStartKey)
      .then((response) => {
        if (!active) return;
        setData(response);
        setEntries(response.entries);
        const savedNotes = parseTeacherScheduleNotes(response.timetable?.dailyNote ?? '');
        setFreeTime(savedNotes.freeTime);
        setBusyTime(savedNotes.busyTime);
        setLegacyNote(savedNotes.legacyNote);
        setSuggestion('');
        setMessage('');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải thời khóa biểu giáo viên.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [academicYear, semester, weekStartKey, retryToken]);

  const currentEntry = (weekday: number, period: number) => (
    entries.find((entry) => entry.weekday === weekday && entry.period === period)
  );
  const openEditor = (weekday: number, period: number) => {
    const existing = currentEntry(weekday, period);
    setEditorContentType(null);
    setContentMenuOpen(false);
    setEditor({
      weekday,
      period,
      classId: existing?.classId ?? '',
      subject: existing?.subject ?? '',
      type: existing?.type ?? 'lesson',
      title: existing?.title ?? '',
      topic: existing?.topic ?? '',
      hasHomework: existing?.hasHomework ?? existing?.type === 'homework',
      homeworkTitle: existing?.homeworkTitle ?? (existing?.type === 'homework' ? existing.title : ''),
      hasExam: existing?.hasExam ?? existing?.type === 'exam',
      examTitle: existing?.examTitle ?? (existing?.type === 'exam' ? existing.title : ''),
      hasExamReturn: existing?.hasExamReturn ?? existing?.type === 'exam_return',
      examReturnNote: existing?.examReturnNote ?? (existing?.type === 'exam_return' ? existing.title : ''),
      examReturnAt: toLocalInput(existing?.examReturnAt ?? (existing?.type === 'exam_return' ? existing.dueAt : null)),
    });
    setError('');
    setMessage('');
  };

  const addEditorContent = (contentType: ScheduleContentType) => {
    setEditorContentType(contentType);
    setContentMenuOpen(false);
    setEditor((current) => {
      if (!current) return current;
      if (contentType === 'homework') return { ...current, hasHomework: true };
      if (contentType === 'exam') return { ...current, hasExam: true };
      return current;
    });
  };

  const removeEditorContent = (contentType: ScheduleContentType) => {
    setEditor((current) => {
      if (!current) return current;
      if (contentType === 'lesson') return { ...current, topic: '' };
      if (contentType === 'homework') {
        return {
          ...current,
          hasHomework: false,
          homeworkTitle: '',
          ...(current.type === 'homework' ? { type: 'lesson' as const, title: '' } : {}),
        };
      }
      if (contentType === 'exam') {
        return {
          ...current,
          hasExam: false,
          examTitle: '',
          ...(current.type === 'exam' ? { type: 'lesson' as const, title: '' } : {}),
        };
      }
      return { ...current, title: '' };
    });
    setEditorContentType((current) => current === contentType ? null : current);
  };

  const saveEditor = () => {
    if (!editor) return;
    const selectedClass = availableClasses.find((item) => item.id === editor.classId);
    if (!selectedClass || !selectedClass.subjects.includes(editor.subject)) {
      setError('Hãy chọn lớp và môn học được phân công.');
      return;
    }
    const nextEntry: TeacherTimetableEntry = {
      weekday: editor.weekday,
      period: editor.period,
      classId: editor.classId,
      classCode: selectedClass.code,
      className: selectedClass.name,
      isHomeroom: selectedClass.isHomeroom,
      subject: editor.subject,
      type: editor.type,
      title: editor.title.trim(),
      topic: editor.topic.trim(),
      dueAt: null,
      hasHomework: editor.hasHomework,
      homeworkTitle: editor.homeworkTitle.trim(),
      homeworkDueAt: null,
      hasExam: editor.hasExam,
      examTitle: editor.examTitle.trim(),
      examStartsAt: null,
      hasExamReturn: editor.hasExamReturn,
      examReturnNote: editor.examReturnNote.trim(),
      examReturnAt: editor.examReturnAt ? new Date(editor.examReturnAt).toISOString() : null,
    };
    setEntries((current) => [
      ...current.filter((item) => item.weekday !== editor.weekday || item.period !== editor.period),
      nextEntry,
    ].sort((first, second) => first.weekday - second.weekday || first.period - second.period));
    setEditor(null);
    setContentMenuOpen(false);
    setMessage('Đã cập nhật ô lịch. Hãy lưu thời khóa biểu để giữ thay đổi.');
  };

  const deleteEditorEntry = () => {
    if (!editor) return;
    setEntries((current) => current.filter((entry) => entry.weekday !== editor.weekday || entry.period !== editor.period));
    setEditor(null);
    setMessage('Đã xóa ô lịch. Hãy lưu thời khóa biểu để giữ thay đổi.');
  };

  const persistSchedule = async (status: 'draft' | 'published') => {
    if (!academicYear) {
      setError('Tài khoản chưa có lớp được phân công để tạo thời khóa biểu.');
      return null;
    }
    if (teacherNotes.length > 5000) {
      setError('Ghi chú thời gian rảnh/bận vượt quá giới hạn 5.000 ký tự.');
      return null;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveTeacherTimetable({
        academicYear,
        semester,
        weekStart: weekStartKey,
        session: data?.timetable?.session ?? 'morning',
        periodCount,
        status,
        dailyNote: teacherNotes,
        entries: entries.map((entry) => ({
          weekday: entry.weekday,
          period: entry.period,
          classId: entry.classId,
          subject: entry.subject,
          type: entry.type,
          title: entry.title,
          topic: entry.topic,
          dueAt: entry.dueAt,
          hasHomework: entry.hasHomework,
          homeworkTitle: entry.homeworkTitle,
          homeworkDueAt: null,
          hasExam: entry.hasExam,
          examTitle: entry.examTitle,
          examStartsAt: null,
          hasExamReturn: entry.hasExamReturn,
          examReturnNote: entry.examReturnNote,
          examReturnAt: entry.examReturnAt,
        })),
      });
      setData(saved);
      setEntries(saved.entries);
      const savedNotes = parseTeacherScheduleNotes(saved.timetable?.dailyNote ?? '');
      setFreeTime(savedNotes.freeTime);
      setBusyTime(savedNotes.busyTime);
      setLegacyNote(savedNotes.legacyNote);
      showToast(status === 'published' ? 'Đã lưu và công bố lịch cho học sinh.' : 'Đã lưu bản nháp thời khóa biểu.');
      return saved;
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể lưu thời khóa biểu.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createSuggestion = async () => {
    setPlanning(true);
    setError('');
    const saved = await persistSchedule('draft');
    if (!saved) {
      setPlanning(false);
      return;
    }
    try {
      setSuggestion(await generateTeacherTimetableSuggestion({
        academicYear,
        semester,
        weekStart: weekStartKey,
        gender,
      }));
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tạo gợi ý công việc.');
    } finally {
      setPlanning(false);
    }
  };

  const changeWeek = (direction: -1 | 1) => setWeekStart((current) => addDays(current, direction * 7));
  const isCurrentWeek = weekStartKey === dateKey(getWeekStart(new Date()));
  const weekButtonLabel = data?.weekNumber
    ? `Tuần học ${data.weekNumber}${isCurrentWeek ? ' - Tuần này' : ''}`
    : isCurrentWeek ? 'Tuần này' : 'Về tuần này';
  const gridEntries = entries.map(asGridEntry);
  const estimated = data?.timetable?.isEstimated ?? false;
  const isTemplate = data?.timetable?.isTemplate ?? false;
  const editorClass = editor ? availableClasses.find((item) => item.id === editor.classId) : undefined;
  const canSaveEditor = Boolean(editorClass && editorClass.subjects.includes(editor?.subject ?? ''));
  const contentTypeLabels: Record<ScheduleContentType, string> = {
    lesson: 'Tài liệu / Bài giảng',
    homework: 'Bài tập',
    exam: 'Bài kiểm tra',
    other: 'Khác',
  };

  if (initialLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-600" role="status">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin text-blue-600" />
        Đang tải lớp được phân công...
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span>Năm học</span>
            <select
              value={academicYear}
              onChange={(event) => setAcademicYear(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {[...new Set(classOptions.map((item) => item.academicYear))].sort().reverse().map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span>Học kỳ</span>
            <select
              value={semester}
              onChange={(event) => setSemester(event.target.value as ProgressSemester)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="Kỳ 1">Kỳ 1</option>
              <option value="Kỳ 2">Kỳ 2</option>
            </select>
          </label>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
          <button type="button" onClick={() => changeWeek(-1)} aria-label="Tuần trước" className="grid h-10 w-10 place-items-center text-slate-600 hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setWeekStart(getWeekStart(new Date()))} className="h-10 border-x border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {weekButtonLabel}
          </button>
          <button type="button" onClick={() => changeWeek(1)} aria-label="Tuần sau" className="grid h-10 w-10 place-items-center text-slate-600 hover:bg-slate-50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void persistSchedule('published')}
            disabled={saving || !academicYear || availableClasses.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Lưu & công bố
          </button>
        </div>
      </div>

      {isTemplate ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          Khung tiết được lấy từ tuần gần nhất để giữ lịch dạy cố định; nội dung bài giảng, bài tập và bài kiểm tra vẫn lưu riêng theo từng tuần.
        </div>
      ) : estimated && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Lịch nháp ước lượng theo các lớp và môn đã được phân công; {teacherAddress} cần kiểm tra, chỉnh sửa trước khi công bố. Chưa có giờ cụ thể hoặc nội dung bài được tự thêm.
        </div>
      )}
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryToken((value) => value + 1)} className="rounded-lg bg-white px-3 py-1.5 font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">
            Thử tải lại
          </button>
        </div>
      )}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-600" role="status">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin text-blue-600" />
          Đang tải thời khóa biểu...
        </div>
      ) : !academicYear ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Chưa có lớp được phân công cho tài khoản giáo viên này.
        </div>
      ) : (
        <WeeklySchedule
          entries={gridEntries}
          weekDays={weekDays}
          periodCount={periodCount}
          sessionLabel={sessionLabel}
          editable
          onSelectCell={(weekday, period) => openEditor(weekday, period)}
        />
      )}

      {editor && createPortal((
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditor(null);
              setContentMenuOpen(false);
            }
          }}
        >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="teacher-schedule-editor-title"
          className="flex min-h-[70vh] max-h-[90vh] w-full max-w-3xl flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="teacher-schedule-editor-title" className="text-lg font-semibold text-slate-900">Nội dung tiết học</h2>
              <p className="mt-1 text-sm text-slate-500">{DAYS[editor.weekday - 1]} - Tiết {editor.period}</p>
            </div>
            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => setContentMenuOpen((open) => !open)}
                aria-label="Thêm mục nội dung"
                aria-expanded={contentMenuOpen}
                disabled={!canSaveEditor}
                className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                <Plus className="h-5 w-5" />
              </button>
              {contentMenuOpen && (
                <div className="absolute right-12 top-0 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl" role="menu" aria-label="Chọn loại nội dung">
                  {(Object.entries(contentTypeLabels) as Array<[ScheduleContentType, string]>).map(([contentType, label]) => (
                    <button
                      key={contentType}
                      type="button"
                      role="menuitem"
                      onClick={() => addEditorContent(contentType)}
                      className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditor(null);
                  setContentMenuOpen(false);
                }}
                aria-label="Đóng phần chỉnh sửa"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <label className="text-sm font-semibold text-slate-800">
              Lớp học
              <select
                value={editor.classId}
                onChange={(event) => {
                  const nextClass = availableClasses.find((item) => item.id === event.target.value);
                  setEditor((current) => current && ({
                    ...current,
                    classId: nextClass?.id ?? '',
                    subject: nextClass?.subjects.includes(current.subject)
                      ? current.subject
                      : nextClass?.subjects[0] ?? '',
                  }));
                  setContentMenuOpen(false);
                }}
                required
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Chọn lớp đang được phân công</option>
                {availableClasses.map((classOption) => (
                  <option key={classOption.id} value={classOption.id}>
                    {classOption.code === classOption.name
                      ? classOption.name
                      : `${classOption.code} - ${classOption.name}`}
                  </option>
                ))}
              </select>
            </label>
            {!editorClass && (
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Chọn một lớp giáo viên đang dạy, sau đó bấm dấu + để thêm bài giảng, bài tập, bài kiểm tra hoặc ghi chú.
              </p>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(editorContentType === 'lesson' || Boolean(editor.topic)) && (
              <div className="rounded-xl border border-blue-200 border-l-4 border-l-blue-500 bg-blue-50 p-4 text-sm font-medium text-blue-950 sm:col-span-2 lg:col-span-3">
                <span className="flex items-center justify-between gap-3">
                  Nội dung tài liệu / bài giảng
                  <button type="button" onClick={() => removeEditorContent('lesson')} className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-white/80">
                    Xóa mục
                  </button>
                </span>
                <label className="sr-only" htmlFor="teacher-schedule-lesson">Nội dung tài liệu / bài giảng</label>
                <textarea
                  id="teacher-schedule-lesson"
                  value={editor.topic}
                  onChange={(event) => setEditor((current) => current && ({ ...current, topic: event.target.value }))}
                  maxLength={1000}
                  rows={3}
                  placeholder="Ví dụ: Bài 4 - Phản ứng hóa học"
                  className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
            )}
            {(editorContentType === 'homework' || editor.hasHomework) && (
              <div className="rounded-xl border border-red-200 border-l-4 border-l-red-500 bg-red-50 p-4 sm:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between gap-3 text-sm font-semibold text-red-950">
                  <label htmlFor="teacher-schedule-homework">Bài tập cần nộp trên lớp</label>
                  <button type="button" onClick={() => removeEditorContent('homework')} className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-white/80">
                    Xóa mục
                  </button>
                </div>
                <label className="sr-only" htmlFor="teacher-schedule-homework">Bài tập cần nộp trên lớp</label>
                  <textarea
                    id="teacher-schedule-homework"
                    value={editor.homeworkTitle}
                    onChange={(event) => setEditor((current) => current && ({ ...current, homeworkTitle: event.target.value }))}
                    maxLength={200}
                    rows={3}
                    placeholder="Ghi rõ bài tập về nhà cần nộp"
                    className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-red-400"
                  />
              </div>
            )}
            {(editorContentType === 'exam' || editor.hasExam) && (
              <div className="rounded-xl border border-green-200 border-l-4 border-l-green-500 bg-green-50 p-4 sm:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between gap-3 text-sm font-semibold text-green-950">
                  <label htmlFor="teacher-schedule-exam">Nội dung bài kiểm tra</label>
                  <button type="button" onClick={() => removeEditorContent('exam')} className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-white/80">
                    Xóa mục
                  </button>
                </div>
                <label className="sr-only" htmlFor="teacher-schedule-exam">Nội dung bài kiểm tra</label>
                  <textarea
                    id="teacher-schedule-exam"
                    value={editor.examTitle}
                    onChange={(event) => setEditor((current) => current && ({ ...current, examTitle: event.target.value }))}
                    maxLength={200}
                    rows={3}
                    placeholder="Nhập nội dung bài kiểm tra"
                    className="mt-1 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-green-400"
                  />
              </div>
            )}
            {(editorContentType === 'other' || Boolean(editor.title)) && (
              <div className="rounded-xl border border-slate-200 border-l-4 border-l-slate-400 bg-slate-50 p-4 text-sm font-medium text-slate-800 sm:col-span-2 lg:col-span-3">
                <span className="flex items-center justify-between gap-3">
                  Ghi chú khác
                  <button type="button" onClick={() => removeEditorContent('other')} className="rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-white/80">
                    Xóa mục
                  </button>
                </span>
                <label className="sr-only" htmlFor="teacher-schedule-other">Ghi chú khác</label>
                <textarea
                  id="teacher-schedule-other"
                  value={editor.title}
                  onChange={(event) => setEditor((current) => current && ({ ...current, title: event.target.value }))}
                  maxLength={200}
                  rows={3}
                  placeholder="Nhập ghi chú cho tiết học"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {currentEntry(editor.weekday, editor.period) && (
              <button type="button" onClick={deleteEditorEntry} className="mr-auto rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                Xóa nội dung ô
              </button>
            )}
            <button type="button" onClick={() => setEditor(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Hủy
            </button>
            <button
              type="button"
              onClick={saveEditor}
              disabled={!canSaveEditor}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Lưu nội dung
            </button>
          </div>
        </section>
        </div>
      ), document.body)}

      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-violet-50 p-4 shadow-sm shadow-blue-100 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Kế hoạch tuần này</h2>
            <p className="mt-1 text-sm text-slate-600">Ghi rõ khung giờ rảnh và bận để AI xếp công việc phù hợp với lịch của {teacherAddress}.</p>
          </div>
          <button
            type="button"
            onClick={createSuggestion}
            disabled={planning || saving || !academicYear}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:from-slate-300 disabled:via-slate-300 disabled:to-slate-400 disabled:shadow-none"
          >
            {planning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {planning ? 'Đang phân tích...' : 'Gợi ý thời gian biểu'}
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="block rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-100 via-green-50 to-white p-3.5 shadow-sm shadow-emerald-100">
            <span className="flex items-center gap-2 text-sm font-bold text-emerald-950">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-200/70" />
              Thời gian rảnh
            </span>
            <textarea
              value={freeTime}
              onChange={(event) => setFreeTime(event.target.value)}
              maxLength={2000}
              rows={5}
              placeholder={'Ví dụ:\nThứ 2: 19:00–21:00\nThứ 4: sau 16:30\nChủ nhật: buổi sáng'}
              className="mt-2 min-h-32 w-full resize-y rounded-xl border border-emerald-200 bg-white/95 p-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
          <label className="block rounded-2xl border border-rose-300 bg-gradient-to-br from-rose-100 via-orange-50 to-white p-3.5 shadow-sm shadow-rose-100">
            <span className="flex items-center gap-2 text-sm font-bold text-rose-950">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-4 ring-rose-200/70" />
              Thời gian bận
            </span>
            <textarea
              value={busyTime}
              onChange={(event) => setBusyTime(event.target.value)}
              maxLength={2000}
              rows={5}
              placeholder={'Ví dụ:\nThứ 2: 07:30–11:00 họp tổ\nThứ 4: 14:00–16:30 sinh hoạt chuyên môn'}
              className="mt-2 min-h-32 w-full resize-y rounded-xl border border-rose-200 bg-white/95 p-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
            />
          </label>
        </div>
        {legacyNote.trim() && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-100 to-yellow-50 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-amber-950">Ghi chú tuần đã lưu trước đây</p>
              <button
                type="button"
                onClick={() => setLegacyNote('')}
                className="rounded-lg border border-amber-300 bg-white/80 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-white"
              >
                Xóa ghi chú cũ
              </button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-amber-950/90">{legacyNote}</p>
            <p className="mt-1 text-xs text-amber-800">Nội dung này được giữ lại nhưng chưa xếp vào cột rảnh hoặc bận.</p>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Ghi chú được lưu theo từng tuần khi {teacherAddress} tạo gợi ý hoặc lưu thời khóa biểu.</span>
          <span className={`rounded-full px-2.5 py-1 font-semibold ${teacherNotes.length > 5000 ? 'bg-rose-100 text-rose-800' : 'bg-white/80 text-slate-600'}`}>
            {teacherNotes.length}/5000 ký tự
          </span>
        </div>
      </section>

      {data?.upcomingWork && data.upcomingWork.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900">Bài tập và việc cần chấm sắp tới</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {data.upcomingWork.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.classCode} - {item.subject} - Hạn {new Date(item.dueAt).toLocaleDateString('vi-VN')}</p>
                </div>
                <span className="text-xs font-medium text-slate-600">
                  {item.ungradedCount} bài chưa chấm / {item.submittedCount} bài đã nộp
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan && (
        <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-lg shadow-indigo-100/70">
          <div className="border-b border-indigo-100 bg-gradient-to-r from-blue-100 via-violet-100 to-fuchsia-100 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Kế hoạch tuần dành cho {teacherAddress}
                </p>
                <h2 className="mt-1 text-lg font-bold text-indigo-950">Gợi ý sắp xếp công việc</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{plan.overview}</p>
              </div>
            </div>
          </div>

          {plan.dataNotes.length > 0 && (
            <div className="mx-4 mt-4 flex gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-sm text-amber-950 sm:mx-5">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <ul className="space-y-1">
                {plan.dataNotes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}
              </ul>
            </div>
          )}

          <div className="p-4 sm:p-5">
            <h3 className="text-sm font-bold text-slate-800">Việc nên ưu tiên</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {plan.priorities.map((priority, index) => (
                <article key={`${index}-${priority.task}`} className={`rounded-xl border p-3.5 ${PLAN_CARD_STYLES[index]}`}>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${PLAN_PRIORITY_BADGES[index]}`}>
                    Ưu tiên {index + 1}
                  </span>
                  <h4 className="mt-2 font-bold leading-5 text-slate-950">{priority.task}</h4>
                  <p className="mt-1.5 text-sm leading-5 text-slate-600">{priority.reason}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-black/5">
                    <Clock3 className="h-3.5 w-3.5" /> Dự kiến {priority.durationMinutes} phút
                  </span>
                </article>
              ))}
            </div>

            <h3 className="mt-6 text-sm font-bold text-slate-800">Lịch gợi ý trong tuần</h3>
            {plan.timeline.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 7 }, (_, index) => index + 1)
                  .filter((weekday) => plan.timeline.some((item) => item.weekday === weekday))
                  .map((weekday) => {
                    const dayDate = addDays(weekStart, weekday - 1);
                    const dayItems = plan.timeline
                      .filter((item) => item.weekday === weekday)
                      .sort((first, second) => first.startTime.localeCompare(second.startTime));
                    return (
                      <article key={weekday} className={`rounded-xl border p-3.5 ${PLAN_DAY_STYLES[weekday]}`}>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-slate-900">{PLAN_WEEKDAYS[weekday]}</h4>
                          <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-black/5">{dayDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>
                        </div>
                        <ol className="mt-3 space-y-3">
                          {dayItems.map((item, index) => (
                            <li key={`${item.startTime}-${item.activity}-${index}`} className="flex gap-3">
                              <span className="w-[5.5rem] shrink-0 pt-0.5 text-xs font-bold tabular-nums text-slate-700">
                                {item.startTime}–{item.endTime}
                              </span>
                              <span className="min-w-0 border-l-2 border-indigo-300 pl-3">
                                <span className="block text-sm font-medium leading-5 text-slate-800">{item.activity}</span>
                                <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PLAN_KIND_STYLES[item.kind]}`}>
                                  {PLAN_KIND_LABELS[item.kind]}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      </article>
                    );
                  })}
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                Chưa có khung giờ cụ thể để xếp lịch. {teacherAddress} có thể ghi thêm giờ rảnh/bận ở phần ghi chú tuần.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
