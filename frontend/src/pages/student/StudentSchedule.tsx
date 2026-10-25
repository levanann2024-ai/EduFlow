import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { WeeklySchedule, type WeeklyScheduleEntry } from './WeeklySchedule';
type ScheduleFilter = 'all' | 'lesson' | 'exam' | 'homework';
type ScheduleView = 'week' | 'day';

interface StudentScheduleProps {
  onOpenContent: (subject: string, topic: string, type: WeeklyScheduleEntry['type']) => void;
  onOpenApp: (subject: string, topic: string) => void;
}

type TimetableEntry = WeeklyScheduleEntry;

const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const timetable: TimetableEntry[] = [
  { day: 0, period: 1, subject: 'Toán học', teacher: 'Cô Nguyễn Hà', room: '10A1', type: 'lesson', topic: 'Hàm số bậc hai' },
  { day: 0, period: 2, subject: 'Toán học', teacher: 'Cô Nguyễn Hà', room: '10A1', type: 'lesson', topic: 'Luyện tập đồ thị hàm số' },
  { day: 0, period: 3, subject: 'Ngữ văn', teacher: 'Thầy Lê Minh', room: '10A1', type: 'lesson', topic: 'Truyện dân gian Việt Nam' },
  { day: 0, period: 6, subject: 'Tiếng Anh', teacher: 'Cô Phạm Linh', room: '10A1', type: 'lesson', topic: 'Unit 4 - For a better community' },
  { day: 0, period: 7, subject: 'Tiếng Anh', teacher: 'Cô Phạm Linh', room: '10A1', type: 'lesson', topic: 'Reading and speaking' },
  { day: 1, period: 1, subject: 'Ngữ văn', teacher: 'Thầy Lê Minh', room: '10A1', type: 'lesson', topic: 'Thực hành tiếng Việt' },
  { day: 1, period: 2, subject: 'Ngữ văn', teacher: 'Thầy Lê Minh', room: '10A1', type: 'lesson', topic: 'Viết bài văn nghị luận' },
  { day: 1, period: 3, subject: 'Tin học', teacher: 'Cô Hoàng Mai', room: 'Phòng máy 2', type: 'lesson', topic: 'Mạng máy tính và Internet' },
  { day: 1, period: 4, subject: 'Tin học', teacher: 'Cô Hoàng Mai', room: 'Phòng máy 2', type: 'lesson', topic: 'Thực hành tìm kiếm thông tin' },
  { day: 1, period: 8, subject: 'Vật lý', teacher: 'Thầy Trần Nam', room: '10A1', type: 'lesson', topic: 'Định luật II Newton' },
  { day: 2, period: 1, subject: 'Tiếng Anh', teacher: 'Cô Phạm Linh', room: '10A1', type: 'lesson', topic: 'Vocabulary and grammar' },
  { day: 2, period: 2, subject: 'Sinh học', teacher: 'Cô Đặng Vy', room: 'Phòng bộ môn 1', type: 'lesson', topic: 'Tế bào nhân thực' },
  { day: 2, period: 3, subject: 'Sinh học', teacher: 'Cô Đặng Vy', room: 'Phòng bộ môn 1', type: 'lesson', topic: 'Quan sát tế bào' },
  { day: 2, period: 6, subject: 'Giáo dục thể chất', teacher: 'Thầy Vũ Long', room: 'Sân trường', type: 'lesson', topic: 'Bóng chuyền cơ bản' },
  { day: 3, period: 1, subject: 'Vật lý', teacher: 'Thầy Trần Nam', room: '10A1', type: 'lesson', topic: 'Lực ma sát' },
  { day: 3, period: 2, subject: 'Vật lý', teacher: 'Thầy Trần Nam', room: '10A1', type: 'lesson', topic: 'Bài tập định luật Newton' },
  { day: 3, period: 3, subject: 'Hóa học', teacher: 'Cô Thu Dung', room: 'Phòng bộ môn 2', type: 'lesson', topic: 'Cấu tạo nguyên tử' },
  { day: 3, period: 4, subject: 'Toán học', teacher: 'Cô Nguyễn Hà', room: '10A1', type: 'exam', topic: 'Kiểm tra 1 tiết - Hàm số' },
  { day: 3, period: 6, subject: 'Hóa học', teacher: 'Cô Thu Dung', room: 'Phòng bộ môn 2', type: 'lesson', topic: 'Bảng tuần hoàn các nguyên tố' },
  { day: 3, period: 7, subject: 'Ngữ văn', teacher: 'Thầy Lê Minh', room: '10A1', type: 'lesson', topic: 'Đọc hiểu văn bản' },
  { day: 4, period: 1, subject: 'Hóa học', teacher: 'Cô Thu Dung', room: 'Phòng bộ môn 2', type: 'lesson', topic: 'Liên kết hóa học' },
  { day: 4, period: 2, subject: 'Hóa học', teacher: 'Cô Thu Dung', room: 'Phòng bộ môn 2', type: 'lesson', topic: 'Bài tập cấu tạo nguyên tử' },
  { day: 4, period: 3, subject: 'Lịch sử', teacher: 'Thầy Phan An', room: '10A1', type: 'lesson', topic: 'Văn minh cổ đại' },
  { day: 4, period: 4, subject: 'Địa lý', teacher: 'Cô Bùi Lan', room: '10A1', type: 'lesson', topic: 'Địa lý dân cư' },
  { day: 4, period: 6, subject: 'Toán học', teacher: 'Cô Nguyễn Hà', room: '10A1', type: 'lesson', topic: 'Ôn tập giữa kỳ' },
  { day: 5, period: 1, subject: 'Sinh học', teacher: 'Cô Đặng Vy', room: 'Phòng bộ môn 1', type: 'lesson', topic: 'Trao đổi chất ở tế bào' },
  { day: 5, period: 2, subject: 'Lịch sử', teacher: 'Thầy Phan An', room: '10A1', type: 'lesson', topic: 'Các quốc gia cổ đại' },
  { day: 5, period: 3, subject: 'Tiếng Anh', teacher: 'Cô Phạm Linh', room: '10A1', type: 'exam', topic: 'Kiểm tra từ vựng Unit 4' },
  { day: 3, period: 13, subject: 'Toán học', teacher: 'Cô Nguyễn Hà', room: '10A1', type: 'homework', topic: 'Hạn nộp phiếu bài tập Hàm số' },
  { day: 4, period: 15, subject: 'Vật lý', teacher: 'Thầy Trần Nam', room: '10A1', type: 'homework', topic: 'Hạn nộp bài tập Định luật II Newton' },
  { day: 4, period: 5, subject: 'Vật lý', teacher: 'Thầy Trần Nam', room: '10A1', type: 'exam', topic: 'Kiểm tra 1 tiết - Định luật Newton' },
];

const filterOptions: { id: ScheduleFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'lesson', label: 'Lịch học' },
  { id: 'exam', label: 'Lịch thi' },
  { id: 'homework', label: 'Bài tập' },
];

function getWeekStart(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function addDays(date: Date, daysToAdd: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + daysToAdd);
  return next;
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' }) {
  return new Intl.DateTimeFormat('vi-VN', options).format(date);
}

export function StudentSchedule({ onOpenContent, onOpenApp }: StudentScheduleProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [filter, setFilter] = useState<ScheduleFilter>('all');
  const [view, setView] = useState<ScheduleView>(() => window.matchMedia('(max-width: 767px)').matches ? 'day' : 'week');
  const [selectedDay, setSelectedDay] = useState(() => Math.min((new Date().getDay() + 6) % 7, days.length - 1));
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const mobileViewport = window.matchMedia('(max-width: 767px)');
    const updateViewForViewport = () => setView(mobileViewport.matches ? 'day' : 'week');
    mobileViewport.addEventListener('change', updateViewForViewport);
    return () => mobileViewport.removeEventListener('change', updateViewForViewport);
  }, []);

  useEffect(() => {
    if (!suggestionsLoading) return undefined;
    const timeout = window.setTimeout(() => {
      setSuggestionsLoading(false);
      setShowSuggestions(true);
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [suggestionsLoading]);

  const weekDays = useMemo(() => days.map((label, index) => ({
    label,
    date: addDays(weekStart, index),
  })), [weekStart]);
  const weekLabel = `${formatDate(weekDays[0].date)} – ${formatDate(weekDays[4].date, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  const selectedDateLabel = `${weekDays[selectedDay].label}, ${formatDate(weekDays[selectedDay].date, { day: '2-digit', month: 'long' })}`;
  const moveDate = (direction: -1 | 1) => {
    if (view === 'week') {
      setWeekStart((current) => addDays(current, direction * 7));
      return;
    }
    const nextDay = selectedDay + direction;
    if (nextDay < 0) {
      setWeekStart((current) => addDays(current, -7));
      setSelectedDay(days.length - 1);
    } else if (nextDay >= days.length) {
      setWeekStart((current) => addDays(current, 7));
      setSelectedDay(0);
    } else {
      setSelectedDay(nextDay);
    }
  };
  const goToToday = () => {
    const today = new Date();
    setWeekStart(getWeekStart(today));
    setSelectedDay(Math.min((today.getDay() + 6) % 7, days.length - 1));
  };

  return (
    <div className="pb-8 text-base">
      <WeeklySchedule
        controls={
      <section className="space-y-3 bg-transparent p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Chế độ xem lịch" className="flex h-10 items-center rounded-lg bg-slate-100 p-1">
            {(['week', 'day'] as const).map((mode) => (
              <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className={`inline-flex h-8 items-center rounded-md px-4 text-xs font-semibold transition ${view === mode ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                {mode === 'week' ? 'Tuần' : 'Ngày'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <label className="sr-only" htmlFor="schedule-filter">Lọc lịch</label>
          <select
            id="schedule-filter"
            aria-label="Lọc lịch"
            value={filter}
            onChange={(event) => setFilter(event.target.value as ScheduleFilter)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {filterOptions.map((option) => <option key={option.id} value={option.id}>{option.id === 'all' ? 'Tất cả lịch' : option.label}</option>)}
          </select>
          <div className="flex h-10 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button type="button" onClick={goToToday} className="h-full border-r border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">{view === 'week' ? 'Tuần này' : 'Hôm nay'}</button>
            <button type="button" aria-label={view === 'week' ? 'Tuần trước' : 'Ngày trước'} onClick={() => moveDate(-1)} className="h-full px-2 text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label={view === 'week' ? 'Tuần sau' : 'Ngày sau'} onClick={() => moveDate(1)} className="h-full border-l border-slate-200 px-2 text-slate-600 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <span aria-live="polite" className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600">
            <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" />
            <span>{view === 'week' ? weekLabel : selectedDateLabel}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setShowSuggestions(false);
              setSuggestionsLoading(true);
            }}
            disabled={suggestionsLoading}
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-80"
          >
            {suggestionsLoading ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <CalendarDays className="h-4 w-4" />}
            {suggestionsLoading ? 'Đang tải gợi ý...' : 'Gợi ý học tập'}
          </button>
        </div>
      </section>
        }
        entries={timetable}
        weekDays={weekDays}
        filter={filter}
        view={view}
        selectedDay={selectedDay}
        onViewDay={(day) => { setSelectedDay(day); setView('day'); }}
        suggestionsLoading={suggestionsLoading}
        showSuggestions={showSuggestions}
        onOpenEntry={(entry) => onOpenContent(entry.subject, entry.topic, entry.type)}
        onOpenApp={onOpenApp}
      />
    </div>
  );
}
