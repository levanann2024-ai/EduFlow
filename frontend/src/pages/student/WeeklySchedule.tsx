import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Pin,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

export type WeeklyScheduleEntryType = 'lesson' | 'exam' | 'homework';

export interface WeeklyScheduleEntry {
  day: number;
  period: number;
  subject: string;
  teacher: string;
  room: string;
  type: WeeklyScheduleEntryType;
  topic: string;
}

interface WeeklyScheduleProps {
  controls: ReactNode;
  entries: WeeklyScheduleEntry[];
  weekDays: { label: string; date: Date }[];
  filter: 'all' | 'lesson' | 'exam' | 'homework';
  view: 'week' | 'day';
  selectedDay: number;
  onViewDay: (day: number) => void;
  suggestionsLoading: boolean;
  showSuggestions: boolean;
  onOpenEntry: (entry: WeeklyScheduleEntry) => void;
  onOpenApp: (subject: string, topic: string) => void;
}

interface PersonalEntry {
  subject: string;
  topic: string;
  source: 'ai' | 'note';
  pinned?: boolean;
}

interface ScheduleDetails {
  entry: WeeklyScheduleEntry;
  date: Date;
  dayLabel: string;
  periodTime: string;
}

type ScheduleSlotContent =
  | (PersonalEntry & { kind: 'ai' })
  | (PersonalEntry & { kind: 'note' })
  | (WeeklyScheduleEntry & { kind: 'exam' | 'homework' | 'school' });

const sessions = [
  {
    title: 'Buổi Sáng',
    style: 'border-sky-100 bg-sky-50 text-sky-800',
    periods: [
      { number: 1, time: '07:15 – 08:00' },
      { number: 2, time: '08:05 – 08:50' },
      { number: 3, time: '09:05 – 09:50' },
      { number: 4, time: '09:55 – 10:40' },
      { number: 5, time: '10:45 – 11:30' },
    ],
  },
  {
    title: 'Buổi Chiều',
    style: 'border-amber-100 bg-amber-50 text-amber-800',
    periods: [
      { number: 6, time: '13:00 – 13:45' },
      { number: 7, time: '13:50 – 14:35' },
      { number: 8, time: '14:50 – 15:35' },
      { number: 9, time: '15:40 – 16:25' },
      { number: 10, time: '16:30 – 17:15' },
    ],
  },
  {
    title: 'Buổi Tối',
    style: 'border-violet-100 bg-violet-50 text-violet-800',
    periods: [
      { number: 11, time: '18:30 – 19:15' },
      { number: 12, time: '19:20 – 20:05' },
      { number: 13, time: '20:10 – 20:55' },
      { number: 14, time: '21:00 – 21:45' },
      { number: 15, time: '21:50 – 22:45' },
    ],
  },
];

function slotKey(date: Date, period: number) {
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  return `${dateKey}-${period}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
}

function getWeekStart(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

const PERSONAL_ENTRIES_STORAGE_KEY = 'eduflow-student-schedule-personal-entries';

function loadPersonalEntries() {
  try {
    const stored = localStorage.getItem(PERSONAL_ENTRIES_STORAGE_KEY);
    if (!stored) return { entries: {} as Record<string, PersonalEntry>, error: '' };
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { entries: {} as Record<string, PersonalEntry>, error: 'Không thể đọc ghi chú đã lưu trên thiết bị này.' };
    }
    const entries = Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => {
        if (!value || typeof value !== 'object') return false;
        const item = value as Partial<PersonalEntry>;
        return typeof item.subject === 'string'
          && typeof item.topic === 'string'
          && (item.source === 'ai' || item.source === 'note');
      }),
    ) as Record<string, PersonalEntry>;
    return { entries, error: '' };
  } catch {
    return { entries: {} as Record<string, PersonalEntry>, error: 'Không thể truy cập ghi chú đã lưu trên thiết bị này.' };
  }
}

export function WeeklySchedule({
  controls,
  entries,
  weekDays,
  filter,
  view,
  selectedDay,
  onViewDay,
  suggestionsLoading,
  showSuggestions,
  onOpenEntry,
  onOpenApp,
}: WeeklyScheduleProps) {
  const [initialStorage] = useState(loadPersonalEntries);
  const [personalEntries, setPersonalEntries] = useState<Record<string, PersonalEntry>>(initialStorage.entries);
  const [storageMessage, setStorageMessage] = useState(initialStorage.error);
  const [previewPlan, setPreviewPlan] = useState<Record<string, PersonalEntry> | null>(null);
  const [planMessage, setPlanMessage] = useState('');
  const [eveningExpanded, setEveningExpanded] = useState(false);
  const [noteSlot, setNoteSlot] = useState<{ day: number; period: number } | null>(null);
  const [noteDetails, setNoteDetails] = useState<{ day: number; period: number; subject: string; topic: string } | null>(null);
  const [scheduleDetails, setScheduleDetails] = useState<ScheduleDetails | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSubject, setNoteSubject] = useState('');
  const [notePinned, setNotePinned] = useState(false);
  const isCurrentScheduleWeek = weekDays[0].date.toDateString() === getWeekStart(new Date()).toDateString();
  const visibleWeekDays = weekDays.slice(0, 5);
  const subjects = [...new Set(entries.map((entry) => entry.subject))];

  const schoolEntries = useMemo(
    () => entries.filter((entry) => filter === 'all' || entry.type === filter),
    [entries, filter],
  );
  const currentWeekSlots = useMemo(
    () => new Set(weekDays.flatMap((day) => sessions.flatMap((session) => session.periods.map((period) => slotKey(day.date, period.number))))),
    [weekDays],
  );
  const today = new Date();
  const todayIndex = Math.min((today.getDay() + 6) % 7, weekDays.length - 1);
  const todayEntries = entries
    .filter((entry) => entry.day === todayIndex)
    .sort((first, second) => first.period - second.period);
  const todayLessons = todayEntries.filter((entry) => entry.type === 'lesson');
  const upcomingEntries = entries
    .filter((entry) => (entry.type === 'exam' || entry.type === 'homework')
      && (entry.day > todayIndex || (entry.day === todayIndex && entry.period >= 1)))
    .sort((first, second) => first.day - second.day || first.period - second.period);
  const upcomingExams = upcomingEntries.filter((entry) => entry.type === 'exam').slice(0, 3);
  const upcomingHomework = upcomingEntries.filter((entry) => entry.type === 'homework').slice(0, 2);

  const getSlotContent = (day: number, period: number): ScheduleSlotContent | null => {
    const key = slotKey(weekDays[day].date, period);
    const personalEntry = personalEntries[key];
    if (personalEntry?.source === 'note') return { ...personalEntry, kind: 'note' };
    if (personalEntry) return { ...personalEntry, kind: 'ai' };
    const schoolEntry = schoolEntries.find((entry) => entry.day === day && entry.period === period);
    if (schoolEntry && (schoolEntry.type === 'exam' || schoolEntry.type === 'homework') && !isCurrentScheduleWeek) return null;
    if (!schoolEntry) return null;
    if (schoolEntry.type === 'exam') return { ...schoolEntry, kind: 'exam' };
    if (schoolEntry.type === 'homework') return { ...schoolEntry, kind: 'homework' };
    return { ...schoolEntry, kind: 'school' };
  };

  const savePersonalEntries = (nextEntries: Record<string, PersonalEntry>) => {
    try {
      localStorage.setItem(PERSONAL_ENTRIES_STORAGE_KEY, JSON.stringify(nextEntries));
      setPersonalEntries(nextEntries);
      setStorageMessage('Đã lưu trên thiết bị này.');
      return true;
    } catch {
      setStorageMessage('Không thể lưu thay đổi. Hãy kiểm tra dung lượng hoặc quyền lưu trữ của trình duyệt rồi thử lại.');
      return false;
    }
  };

  const prepareAutoPlan = () => {
    setPlanMessage('');
    const suggestions: Record<string, PersonalEntry> = Object.fromEntries(
      Object.entries(personalEntries).filter(([key, entry]) => currentWeekSlots.has(key) && entry.source === 'ai'),
    );
    const preferredSubjects = ['Toán học', 'Tiếng Anh', 'Vật lý'];
    weekDays.forEach((_, day) => {
      const eveningPeriod = sessions[2].periods[day % sessions[2].periods.length].number;
      const key = slotKey(weekDays[day].date, eveningPeriod);
      if (!entries.some((entry) => entry.day === day && entry.period === eveningPeriod)
        && !personalEntries[key]) {
        const subject = preferredSubjects[day % preferredSubjects.length];
        suggestions[key] = {
          subject,
          topic: `Ôn tập ${subject.toLocaleLowerCase('vi')}`,
          source: 'ai',
        };
      }
    });
    if (Object.keys(suggestions).length === 0) {
      setPlanMessage('Tuần này không còn khung giờ trống phù hợp để đề xuất.');
      return;
    }
    setPreviewPlan(suggestions);
  };

  const applyAutoPlan = () => {
    if (!previewPlan) return;
    if (savePersonalEntries({ ...personalEntries, ...previewPlan })) {
      setPreviewPlan(null);
      setPlanMessage('Đã thêm các ca ôn tập vào lịch cá nhân. Lịch của trường không thay đổi.');
    }
  };

  const saveNote = () => {
    if (!noteSlot || !noteText.trim()) return;
    const nextEntries: Record<string, PersonalEntry> = {
      ...personalEntries,
      [slotKey(weekDays[noteSlot.day].date, noteSlot.period)]: {
        subject: noteSubject,
        topic: noteText.trim(),
        source: 'note',
        pinned: notePinned,
      },
    };
    if (!savePersonalEntries(nextEntries)) return;
    setNoteText('');
    setNoteSubject('');
    setNotePinned(false);
    setNoteSlot(null);
  };

  const removePersonalEntry = (day: number, period: number) => {
    const next = { ...personalEntries };
    delete next[slotKey(weekDays[day].date, period)];
    savePersonalEntries(next);
  };

  const renderSession = (session: typeof sessions[number], showTitle = true) => (
    <section key={session.title} className={showTitle ? 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm' : 'overflow-hidden'}>
      {showTitle && <h3 className={`border-b px-4 py-2.5 text-sm font-bold ${session.style}`}>{session.title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-center">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 w-[88px] border-b border-r border-slate-200 bg-slate-50 p-1.5 text-xs font-semibold text-slate-600">Tiết / Giờ</th>
              {visibleWeekDays.map((day) => {
                return (
                  <th key={day.label} className={`border-b border-slate-200 p-1.5 text-center align-top ${day.date.toDateString() === new Date().toDateString() ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                    <span className="block text-xs font-bold text-slate-700">{day.label}</span>
                    <span className="mt-0.5 block text-[10px] font-normal text-slate-500">{formatDate(day.date)}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {session.periods.map((period) => {
              const periodHasAdditionalContent = visibleWeekDays.some((_, index) => {
                const slotContent = getSlotContent(index, period.number);
                return slotContent !== null && slotContent.kind !== 'school' && slotContent.kind !== 'exam';
              });
              return (
                <tr key={period.number} className="border-b border-slate-100 last:border-0">
                <th className="sticky left-0 z-10 border-r border-slate-100 bg-white px-2 py-1.5 text-left align-top">
                  <span className="block text-xs font-semibold text-slate-800">Tiết {period.number}</span>
                  <span className="mt-0.5 block whitespace-nowrap text-[9px] font-normal text-slate-500">{period.time}</span>
                </th>
                {visibleWeekDays.map((day, dayIndex) => {
                  const content = getSlotContent(dayIndex, period.number);
                  const hiddenSchoolEntry = entries.some((entry) =>
                    entry.day === dayIndex
                    && entry.period === period.number
                    && !schoolEntries.some((visibleEntry) => visibleEntry.day === dayIndex && visibleEntry.period === period.number),
                  );
                  const personalEntry = content?.kind === 'ai' || content?.kind === 'note';
                  const cardStyle = content?.kind === 'exam'
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : content?.kind === 'homework'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : content?.kind === 'ai'
                      ? 'border-dashed border-violet-300 bg-violet-50 text-violet-800'
                      : content?.kind === 'note'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : content
                          ? 'border-blue-200 bg-blue-50 text-blue-800'
                          : 'border-dashed border-slate-200 bg-slate-50/50 text-slate-400 hover:border-indigo-300 hover:bg-indigo-50';
                  return (
                    <td key={day.label} className={`${periodHasAdditionalContent ? 'h-20' : 'h-12'} border-l border-slate-100 p-0.5`}>
                      {content ? (
                        <div className={`group relative flex h-full min-w-0 flex-col items-center justify-center rounded-lg border px-1 py-1 text-center ${cardStyle}`}>
                          <span className={`line-clamp-2 break-words font-bold leading-4 ${content.kind === 'note' ? 'text-xs' : 'text-[10px]'}`}>{content.subject}</span>
                          {content.kind === 'note' && content.pinned && (
                            <Pin aria-label="Ghi chú đã ghim" className="absolute right-1.5 top-1.5 z-20 h-3.5 w-3.5 fill-rose-600 text-rose-600" />
                          )}
                          {content.kind !== 'school' && content.kind !== 'exam' && (
                            <span className={`line-clamp-2 break-words leading-3 ${content.kind === 'note' ? 'text-[11px]' : 'text-[9px]'}`}>{content.topic}</span>
                          )}
                          <span className="mt-0.5 flex items-center justify-center gap-1">
                            {content.kind === 'homework' && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">Bài tập</span>}
                            {content.kind === 'ai' && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">🤖 AI Suggest</span>}
                            {content.kind === 'note' && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Ghi chú</span>}
                          </span>
                          {personalEntry && (
                            <button type="button" onClick={() => removePersonalEntry(dayIndex, period.number)} aria-label={`Xóa ${content.kind === 'ai' ? 'gợi ý AI' : 'ghi chú'} ${content.subject}`} className="absolute bottom-1.5 right-1.5 z-20 rounded p-0.5 text-slate-500 opacity-100 transition hover:bg-white/80 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {!personalEntry && (
                            <button
                              type="button"
                              aria-label={content.kind === 'school' ? `Xem thời khóa biểu môn ${content.subject}` : content.kind === 'exam' ? `Xem lịch kiểm tra môn ${content.subject}` : `Xem nội dung ${content.subject}: ${content.topic}`}
                              onClick={() => setScheduleDetails({
                                entry: content as WeeklyScheduleEntry,
                                date: day.date,
                                dayLabel: day.label,
                                periodTime: period.time,
                              })}
                              className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            />
                          )}
                          {content.kind === 'note' && (
                            <button
                              type="button"
                              aria-label={`Xem ghi chú môn ${content.subject}: ${content.topic}`}
                              onClick={() => setNoteDetails({ day: dayIndex, period: period.number, subject: content.subject, topic: content.topic })}
                              className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            />
                          )}
                        </div>
                      ) : hiddenSchoolEntry ? (
                        <div aria-hidden="true" className="h-full rounded-lg bg-slate-50/40" />
                      ) : (
                        <button type="button" onClick={() => { setNoteSlot({ day: dayIndex, period: period.number }); setStorageMessage(''); }} aria-label={`Thêm ghi chú ${day.label}, tiết ${period.number}`} className={`group flex h-full w-full items-center justify-center rounded-lg border transition ${cardStyle}`}>
                          <Plus className="h-4 w-4 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderDaySchedule = () => {
    const day = weekDays[selectedDay];
    const sections = sessions.filter((session) => session.title !== 'Buổi Tối' || eveningExpanded);
    return (
      <div className="space-y-3">
        {sections.map((session) => {
          const visiblePeriods = session.periods.filter((period) => {
            const hasEntry = getSlotContent(selectedDay, period.number);
            const hiddenByFilter = entries.some((entry) => entry.day === selectedDay
              && entry.period === period.number
              && !schoolEntries.some((visibleEntry) => visibleEntry.day === selectedDay && visibleEntry.period === period.number));
            return hasEntry || !hiddenByFilter;
          });
          if (visiblePeriods.length === 0) return null;
          return (
            <section key={session.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <h3 className={`border-b px-4 py-2.5 text-sm font-bold ${session.style}`}>{session.title}</h3>
              <div className="divide-y divide-slate-100">
                {visiblePeriods.map((period) => {
                  const content = getSlotContent(selectedDay, period.number);
                  const hiddenSchoolEntry = entries.some((entry) => entry.day === selectedDay
                    && entry.period === period.number
                    && !schoolEntries.some((visibleEntry) => visibleEntry.day === selectedDay && visibleEntry.period === period.number));
                  const isPersonal = content?.kind === 'ai' || content?.kind === 'note';
                  const cardStyle = content?.kind === 'exam'
                    ? 'border-rose-200 bg-rose-50'
                    : content?.kind === 'ai'
                      ? 'border-dashed border-violet-300 bg-violet-50'
                      : content?.kind === 'note'
                        ? 'border-emerald-200 bg-emerald-50'
                        : content?.kind === 'homework'
                          ? 'border-amber-200 bg-amber-50'
                          : content
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-dashed border-slate-200 bg-slate-50';
                  return (
                    <div key={period.number} className="flex min-h-[76px] items-stretch gap-3 p-2.5">
                      <div className="flex w-[84px] shrink-0 flex-col justify-center text-xs">
                        <span className="font-bold text-slate-800">Tiết {period.number}</span>
                        <span className="mt-1 text-[10px] text-slate-500">{period.time}</span>
                      </div>
                      {content ? (
                        <div className={`group relative flex min-w-0 flex-1 flex-col justify-center rounded-xl border px-3 py-2 pr-10 ${cardStyle}`}>
                          <span className={`break-words font-bold text-slate-900 ${content.kind === 'note' ? 'text-lg' : 'text-sm'}`}>{content.subject}</span>
                          {content.kind !== 'school' && (
                            <span className={`mt-0.5 break-words leading-5 text-slate-700 ${content.kind === 'note' ? 'text-base' : 'text-xs'}`}>{content.topic}</span>
                          )}
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {content.kind === 'homework' && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">Bài tập</span>}
                            {content.kind === 'ai' && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">Đề xuất AI</span>}
                            {content.kind === 'note' && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">Ghi chú cá nhân</span>}
                          </span>
                          {isPersonal ? (
                            <>
                              {content.kind === 'note' && content.pinned && <Pin aria-label="Ghi chú đã ghim" className="absolute right-2 top-2 h-3.5 w-3.5 fill-rose-600 text-rose-600" />}
                              <button type="button" onClick={() => content.kind === 'note'
                                ? setNoteDetails({ day: selectedDay, period: period.number, subject: content.subject, topic: content.topic })
                                : setPlanMessage('Đây là khung ôn tập cá nhân do bạn đã xác nhận. Lịch học chính thức không bị thay đổi.')} aria-label={`Xem ${content.kind === 'note' ? 'ghi chú' : 'đề xuất'} ${content.subject}`} className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" />
                              <button type="button" onClick={() => removePersonalEntry(selectedDay, period.number)} aria-label={`Xóa ${content.kind === 'ai' ? 'gợi ý AI' : 'ghi chú'} ${content.subject}`} className="absolute bottom-2 right-2 z-10 rounded p-1 text-slate-500 hover:bg-white hover:text-rose-600">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <button type="button" aria-label={`Xem ${content.kind === 'exam' ? 'lịch kiểm tra' : 'nội dung'} ${content.subject}: ${content.topic}`} onClick={() => setScheduleDetails({
                              entry: content as WeeklyScheduleEntry,
                              date: day.date,
                              dayLabel: day.label,
                              periodTime: period.time,
                            })} className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" />
                          )}
                        </div>
                      ) : hiddenSchoolEntry ? (
                        <div aria-hidden="true" className="min-w-0 flex-1" />
                      ) : (
                        <button type="button" onClick={() => { setNoteSlot({ day: selectedDay, period: period.number }); setStorageMessage(''); }} aria-label={`Thêm ghi chú ${day.label}, tiết ${period.number}`} className="group flex min-w-0 flex-1 items-center rounded-xl border border-dashed border-slate-200 px-3 text-xs text-slate-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                          <span>Ô trống - Nhấn để thêm ghi chú</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button type="button" aria-expanded={eveningExpanded} onClick={() => setEveningExpanded((expanded) => !expanded)} className={`flex w-full items-center justify-between border-b px-4 py-3 text-left text-sm font-bold ${sessions[2].style}`}>
            <span>Buổi Tối <span className="ml-1 text-xs font-medium opacity-80">5 ca - 18:30 – 22:45</span></span>
            {eveningExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </section>
      </div>
    );
  };

  const renderMobileWeekAgenda = () => (
    <div className="space-y-3 md:hidden">
      {visibleWeekDays.map((day, dayIndex) => {
        const dailyEntries = sessions.flatMap((session) => session.periods.map((period) => ({
          period,
          content: getSlotContent(dayIndex, period.number),
        }))).filter(({ content }) => content !== null);
        return (
          <section key={day.label} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button type="button" onClick={() => onViewDay(dayIndex)} className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2.5 text-left">
              <span className="text-sm font-bold text-slate-800">{day.label}</span>
              <span className="text-xs text-slate-500">{formatDate(day.date)}</span>
            </button>
            <div className="divide-y divide-slate-100">
              {dailyEntries.length > 0 ? dailyEntries.map(({ period, content }) => {
                if (!content) return null;
                const isPersonal = content.kind === 'note' || content.kind === 'ai';
                const badgeStyle = content.kind === 'exam'
                  ? 'bg-rose-100 text-rose-700'
                  : content.kind === 'homework'
                    ? 'bg-amber-100 text-amber-800'
                    : content.kind === 'note'
                      ? 'bg-emerald-100 text-emerald-700'
                      : content.kind === 'ai'
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-blue-100 text-blue-700';
                return (
                  <div key={period.number} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-[72px] shrink-0 text-[10px] text-slate-500">Tiết {period.number}<span className="mt-0.5 block">{period.time.split(' – ')[0]}</span></span>
                    <button type="button" onClick={() => isPersonal
                      ? content.kind === 'note'
                        ? setNoteDetails({ day: dayIndex, period: period.number, subject: content.subject, topic: content.topic })
                        : setPlanMessage('Đây là khung ôn tập cá nhân do bạn đã xác nhận. Lịch học chính thức không bị thay đổi.')
                      : setScheduleDetails({ entry: content as WeeklyScheduleEntry, date: day.date, dayLabel: day.label, periodTime: period.time })} className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-left ${content.kind === 'exam' ? 'border-rose-200 bg-rose-50' : content.kind === 'homework' ? 'border-amber-200 bg-amber-50' : content.kind === 'note' ? 'border-emerald-200 bg-emerald-50' : content.kind === 'ai' ? 'border-violet-200 bg-violet-50' : 'border-blue-200 bg-blue-50'}`}>
                      <span className={`block break-words font-bold text-slate-900 ${content.kind === 'note' ? 'text-base' : 'text-xs'}`}>{content.subject}</span>
                      {content.kind !== 'school' && (
                        <span className={`mt-0.5 block break-words leading-5 text-slate-700 ${content.kind === 'note' ? 'text-sm' : 'text-xs'}`}>{content.topic}</span>
                      )}
                      {content.kind !== 'school' && content.kind !== 'exam' && (
                        <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${badgeStyle}`}>
                          {content.kind === 'homework' ? 'Bài tập' : content.kind === 'note' ? 'Ghi chú cá nhân' : 'Đề xuất AI'}
                        </span>
                      )}
                    </button>
                    {isPersonal && (
                      <button type="button" onClick={() => removePersonalEntry(dayIndex, period.number)} aria-label={`Xóa ${content.kind === 'ai' ? 'gợi ý AI' : 'ghi chú'} ${content.subject}`} className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              }) : <p className="px-3 py-3 text-xs text-slate-500">Chưa có lịch học trong ngày.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );

  const previewItems = previewPlan
    ? Object.entries(previewPlan).map(([key, entry]) => {
      const [year, month, date, periodNumber] = key.split('-').map(Number);
      const period = sessions.flatMap((session) => session.periods).find((item) => item.number === periodNumber);
      return {
        date: new Date(year, month, date),
        period: periodNumber,
        time: period?.time ?? '',
        entry,
      };
    })
    : [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(230px,0.3fr)]">
      <div id="student-schedule-calendar" className="min-w-0 space-y-3">
        {controls}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-slate-600" aria-label="Chú giải lịch">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-blue-200 bg-blue-100" />Lịch học</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-rose-200 bg-rose-100" />Kiểm tra</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-violet-300 bg-violet-100" />Đề xuất AI</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-emerald-200 bg-emerald-100" />Ghi chú</span>
        </div>

        <div className={view === 'week' ? 'hidden md:block' : 'hidden'}>
          <div className="space-y-3">
            {renderSession(sessions[0])}
            {renderSession(sessions[1])}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button type="button" aria-expanded={eveningExpanded} onClick={() => setEveningExpanded((expanded) => !expanded)} className={`flex w-full items-center justify-between border-b px-4 py-3 text-left text-sm font-bold ${sessions[2].style}`}>
              <span>Buổi Tối <span className="ml-1 text-xs font-medium opacity-80">5 ca - 18:30 – 22:45</span></span>
              {eveningExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {eveningExpanded && <div className="animate-fadeIn">{renderSession(sessions[2], false)}</div>}
            </section>
          </div>
        </div>
        <div className={view === 'day' ? 'block' : 'hidden md:hidden'}>
          {renderDaySchedule()}
        </div>
        {view === 'week' && renderMobileWeekAgenda()}
        {storageMessage && (
          <p role={storageMessage.startsWith('Không thể') ? 'alert' : 'status'} className={`px-1 text-xs ${storageMessage.startsWith('Không thể') ? 'text-rose-700' : 'text-slate-500'}`}>
            {storageMessage}
          </p>
        )}
      </div>

      <aside className="space-y-3">
        {suggestionsLoading && (
          <section aria-label="Đang tải gợi ý học tập" aria-busy="true" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-amber-50" />
            <div className="h-16 animate-pulse rounded-xl bg-violet-50" />
            <div className="h-20 animate-pulse rounded-xl bg-blue-50" />
          </section>
        )}
        {showSuggestions && !suggestionsLoading && (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarDays className="h-4 w-4 text-blue-600" />Gợi ý từ AI</h3>
            </header>
            {todayLessons.length >= 6 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-xs font-bold text-amber-800"><AlertTriangle className="h-4 w-4" />Lịch học dày</p>
                <p className="mt-1 text-xs leading-5 text-amber-900">Hôm nay có {todayLessons.length} tiết học. Em nhớ sắp xếp thời gian nghỉ và ôn tập nhé.</p>
              </div>
            )}
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3">
              <p className="text-xs leading-5 text-slate-700">
                {upcomingExams[0]
                  ? `Có bài kiểm tra ${upcomingExams[0].subject} sắp tới. Dành một khoảng ngắn để ôn lại ${upcomingExams[0].topic.replace(/^Kiểm tra[^-]*-?\\s*/i, '').trim() || 'nội dung trọng tâm'}.`
                  : todayLessons[0]
                    ? `Sau buổi học, thử ôn lại ${todayLessons[0].topic} môn ${todayLessons[0].subject}.`
                    : 'Hôm nay chưa có lịch học. Em có thể chọn một chủ đề cần ôn tập.'}
              </p>
              <button type="button" onClick={prepareAutoPlan} className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
                <CalendarDays className="h-3.5 w-3.5" />
                Xem lịch
              </button>
            </div>
            {upcomingHomework.length > 0 && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                <h4 className="flex items-center gap-2 text-xs font-bold text-blue-800"><BookOpen className="h-4 w-4" />Bài tập cần ôn</h4>
                <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
                  {upcomingHomework.map((entry) => <li key={`${entry.day}-${entry.period}-${entry.subject}`} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{entry.subject} - {entry.topic}</span></li>)}
                </ul>
              </div>
            )}
          </section>
        )}
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <h3 className="flex items-center gap-2 border-b border-slate-100 pb-2.5 text-sm font-bold text-slate-900"><Clock3 className="h-4 w-4 text-blue-600" />Sắp tới</h3>
          {upcomingExams.length > 0 ? (
            <ul className="mt-2 space-y-2.5">
              {upcomingExams.map((entry) => (
                <li key={`${entry.day}-${entry.period}-${entry.subject}`} className="flex items-start gap-2 text-[11px]">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                  <span className="min-w-0"><strong className="font-semibold text-slate-800">{entry.subject} - {entry.topic}</strong><span className="mt-0.5 block text-slate-500">{weekDays[entry.day].label} - Tiết {entry.period} - {formatDate(weekDays[entry.day].date)}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-xs text-slate-500">Chưa có bài kiểm tra sắp tới.</p>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <h3 className="flex items-center gap-2 border-b border-slate-100 pb-2.5 text-sm font-bold text-slate-900"><BookOpen className="h-4 w-4 text-blue-600" />Môn học hôm nay</h3>
          {todayLessons.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {[...new Set(todayLessons.map((entry) => entry.subject))].map((subject) => (
                <li key={subject} className="flex items-center justify-between gap-2 text-[11px] text-slate-700">
                  <span>{subject}</span>
                  <span className="text-slate-500">{todayLessons.filter((entry) => entry.subject === subject).length} tiết</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-xs text-slate-500">Hôm nay không có tiết học.</p>}
        </section>
        {planMessage && <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">{planMessage}</p>}
      </aside>

      {noteSlot && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNoteSlot(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="weekly-note-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="weekly-note-title" className="text-lg font-bold text-slate-900">Thêm ghi chú</h2>
                <p className="mt-1 text-sm text-slate-500">{weekDays[noteSlot.day].label} - Tiết {noteSlot.period}</p>
                <p className="mt-1 text-xs text-slate-500">Ghi chú được lưu trên trình duyệt của thiết bị này.</p>
              </div>
              <button type="button" onClick={() => setNoteSlot(null)} aria-label="Đóng" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Môn học</span>
              <select autoFocus value={noteSubject} onChange={(event) => setNoteSubject(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100">
                <option value="">Chọn môn học</option>
                {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              </select>
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Chủ đề / nội dung ghi chú</span>
              <textarea rows={3} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Ví dụ: Ôn tập hàm số bậc hai..." className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={notePinned} onChange={(event) => setNotePinned(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500" />
              Ghim ghi chú
            </label>
            {storageMessage && (
              <p role={storageMessage.startsWith('Không thể') ? 'alert' : 'status'} className={`mt-3 text-xs ${storageMessage.startsWith('Không thể') ? 'text-rose-700' : 'text-emerald-700'}`}>
                {storageMessage}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setNoteSlot(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button type="button" disabled={!noteSubject || !noteText.trim()} onClick={saveNote} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Lưu ghi chú</button>
            </div>
          </section>
        </div>
      )}
      {previewPlan && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewPlan(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="auto-plan-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="auto-plan-title" className="flex items-center gap-2 text-lg font-bold text-slate-900"><Sparkles className="h-5 w-5 text-violet-600" />Xem trước lịch ôn tập</h2>
                <p className="mt-1 text-sm text-slate-600">Đây là lịch cá nhân đề xuất. Lịch học và lịch kiểm tra của trường sẽ không bị thay đổi.</p>
              </div>
              <button type="button" onClick={() => setPreviewPlan(null)} aria-label="Đóng xem trước" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {previewItems.map(({ date, period, time, entry }) => (
                <div key={`${date.toISOString()}-${period}`} className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                  <CalendarDays className="h-4 w-4 shrink-0 text-violet-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{formatDate(date)} - Tiết {period}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-600">{entry.subject} - {entry.topic}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-500">{time}</span>
                </div>
              ))}
            </div>
            {storageMessage.startsWith('Không thể') && <p role="alert" className="mt-3 text-xs text-rose-700">{storageMessage}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setPreviewPlan(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Hủy</button>
              <button type="button" onClick={applyAutoPlan} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">
                <Check className="h-4 w-4" />Xác nhận thêm vào lịch cá nhân
              </button>
            </div>
          </section>
        </div>
      )}
      {noteDetails && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNoteDetails(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="weekly-note-details-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="weekly-note-details-title" className="text-lg font-bold text-slate-900">Chi tiết ghi chú</h2>
                <p className="mt-1 text-sm text-slate-500">{weekDays[noteDetails.day].label} - Tiết {noteDetails.period}</p>
              </div>
              <button type="button" onClick={() => setNoteDetails(null)} aria-label="Thoát" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <dl className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Môn học</dt>
                <dd className="mt-1 font-semibold text-slate-900">{noteDetails.subject}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chủ đề</dt>
                <dd className="mt-1 text-slate-700">{noteDetails.topic}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm font-medium text-slate-700">Bạn muốn mở tài liệu hay ứng dụng học tập?</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  onOpenEntry({ day: noteDetails.day, period: noteDetails.period, subject: noteDetails.subject, teacher: '', room: '', type: 'lesson', topic: noteDetails.topic });
                  setNoteDetails(null);
                }}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
              >
                Vào tài liệu
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenApp(noteDetails.subject, noteDetails.topic);
                  setNoteDetails(null);
                }}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
              >
                Mở ứng dụng học tập
              </button>
            </div>
          </section>
        </div>
      )}
      {scheduleDetails && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setScheduleDetails(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="schedule-details-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="schedule-details-title" className="text-lg font-bold text-slate-900">
                  {scheduleDetails.entry.type === 'exam' ? 'Thông tin kiểm tra' : scheduleDetails.entry.type === 'homework' ? 'Thông tin bài tập' : 'Nội dung môn học'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{scheduleDetails.dayLabel} - {formatDate(scheduleDetails.date)} - Tiết {scheduleDetails.entry.period}</p>
              </div>
              <button type="button" onClick={() => setScheduleDetails(null)} aria-label="Thoát" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <dl className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Môn học</dt>
                <dd className="mt-1 font-semibold text-slate-900">{scheduleDetails.entry.subject}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{scheduleDetails.entry.type === 'exam' ? 'Nội dung kiểm tra' : scheduleDetails.entry.type === 'homework' ? 'Bài tập' : 'Chủ đề bài học'}</dt>
                <dd className="mt-1 text-slate-700">{scheduleDetails.entry.topic}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{scheduleDetails.entry.type === 'exam' ? 'Thời gian thi' : 'Thời gian'}</dt>
                <dd className="mt-1 text-slate-700">{scheduleDetails.periodTime}</dd>
              </div>
            </dl>
            {scheduleDetails.entry.type !== 'exam' && (
              <>
                <p className="mt-4 text-sm font-medium text-slate-700">
                  {scheduleDetails.entry.type === 'homework' ? 'Bạn có muốn mở bài tập này trong Môn học của tôi không?' : 'Bạn có muốn vào tài liệu bài học này trong Môn học của tôi không?'}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setScheduleDetails(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Để sau</button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenEntry(scheduleDetails.entry);
                      setScheduleDetails(null);
                    }}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    {scheduleDetails.entry.type === 'homework' ? 'Vào bài tập' : 'Vào tài liệu'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
