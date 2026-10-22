import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PenLine,
  Presentation,
  Users,
} from 'lucide-react';
import { mockClasses, mockSchedule } from '@/data';
import type { Page, ScheduleItem } from '@/types';

interface TeacherDashboardProps {
  onNavigate: (page: Page) => void;
}

interface CalendarEvent {
  id: string;
  title: string;
  detail: string;
  date: Date;
  kind: 'class' | 'exam' | 'deadline';
}

const dayNumbers: Record<string, number> = {
  T2: 1,
  T3: 2,
  T4: 3,
  T5: 4,
  T6: 5,
  T7: 6,
};

const workload = { submitted: 36, awaitingSubmission: 4, graded: 24, awaitingGrading: 12 };

const recentWork: { title: string; detail: string; edited: string; page: Page; icon: typeof FileText; tone: string }[] = [
  { title: 'Hàm số bậc hai', detail: 'Giáo án · Toán 10A1', edited: '10:20', page: 'lesson-builder', icon: PenLine, tone: 'violet' },
  { title: 'Định luật Ohm', detail: 'Bài giảng · Vật lý 11B3', edited: 'Hôm qua', page: 'lessons', icon: BookOpen, tone: 'blue' },
  { title: 'Kiểm tra chương 2', detail: 'Đề thi · Toán 10A1', edited: 'Hôm qua', page: 'exams', icon: FileCheck2, tone: 'amber' },
];

const shortcuts: { label: string; page: Page; icon: typeof FileText; tone: string }[] = [
  { label: 'Lớp học', page: 'classes', icon: Users, tone: 'blue' },
  { label: 'Kho bài giảng', page: 'lessons', icon: BookOpen, tone: 'green' },
  { label: 'Soạn bài', page: 'lesson-builder', icon: Presentation, tone: 'violet' },
  { label: 'Ngân hàng câu hỏi', page: 'question-bank', icon: ClipboardList, tone: 'teal' },
  { label: 'Đề kiểm tra', page: 'exams', icon: FileCheck2, tone: 'amber' },
  { label: 'Chấm bài', page: 'ai-grading', icon: PenLine, tone: 'rose' },
  { label: 'Kết quả', page: 'analytics', icon: LayoutDashboard, tone: 'cyan' },
];

function nextClassDate(day: string, time: string, now: Date) {
  const targetDay = dayNumbers[day];
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  let daysUntil = (targetDay - date.getDay() + 7) % 7;
  if (daysUntil === 0 && date <= now) daysUntil = 7;
  date.setDate(date.getDate() + daysUntil);
  return date;
}

function addDays(date: Date, days: number, hours: number, minutes: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function createEvents(now: Date): CalendarEvent[] {
  const lessons: CalendarEvent[] = mockSchedule.map((item) => ({
    id: item.id,
    title: `${item.className} · ${item.subject}`,
    detail: `Tiết dạy · Phòng ${item.room.replace(/^P\./, '')}`,
    date: nextClassDate(item.day, item.time, now),
    kind: 'class',
  }));

  const events: CalendarEvent[] = [
    ...lessons,
    { id: 'upcoming-exam', title: 'Kiểm tra chương 2 · 10A1', detail: 'Duyệt đề trước khi giao', date: addDays(now, 1, 8, 0), kind: 'exam' },
    { id: 'assignment-deadline', title: 'Bài tập Hàm số · 10A1', detail: 'Hạn nộp của học sinh', date: addDays(now, 3, 17, 0), kind: 'deadline' },
  ];
  return events.sort((first, second) => first.date.getTime() - second.date.getTime());
}

function sameDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function toneClasses(tone: string) {
  const classes: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
    teal: 'bg-teal-50 text-teal-700',
    rose: 'bg-rose-50 text-rose-700',
    cyan: 'bg-cyan-50 text-cyan-700',
  };
  return classes[tone] ?? classes.blue;
}

function SectionTitle({ icon: Icon, children, action }: { icon: typeof CalendarDays; children: string; action?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-slate-800 sm:text-sm">
        <Icon className="h-4 w-4 shrink-0 text-blue-600" />
        {children}
      </h2>
      {action}
    </div>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3 ${className}`}>{children}</section>;
}

function MetricCard({ label, value, detail, icon: Icon, tone, onClick }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CalendarDays;
  tone: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex items-center justify-between gap-1">
        <span className="truncate text-[9px] font-medium text-slate-500">{label}</span>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${toneClasses(tone)}`}><Icon className="h-3.5 w-3.5" /></span>
      </span>
      <span className="mt-0.5 block text-lg font-bold leading-none text-slate-900">{value}</span>
      <span className="mt-0.5 block truncate text-[8px] text-slate-500">{detail}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="min-w-0 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-2.5">
      {content}
    </button>
  ) : (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-2.5">
      {content}
    </div>
  );
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
}

function calendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const count = Math.ceil((first.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function classDateLabel(date: Date, now: Date) {
  if (sameDay(date, now)) return 'Hôm nay';
  return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function scheduleFromEvent(event: CalendarEvent): ScheduleItem | null {
  if (event.kind !== 'class') return null;
  const item = mockSchedule.find((schedule) => event.id === schedule.id);
  return item ?? null;
}

export function TeacherDashboard({ onNavigate }: TeacherDashboardProps) {
  const now = new Date();
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(now);
  const events = createEvents(now);
  const visibleEvents = events.slice(0, 4);
  const studentCount = mockClasses.reduce((total, item) => total + item.studentCount, 0);
  const totalAssignments = workload.submitted + workload.awaitingSubmission;
  const calendarCells = calendarDays(month);
  const selectedEvents = events.filter((event) => sameDay(event.date, selectedDate));
  const scheduleEvents = selectedEvents.length > 0
    ? selectedEvents
    : sameDay(selectedDate, now)
      ? visibleEvents.filter((event) => event.kind === 'class').slice(0, 3)
      : [];

  const changeMonth = (offset: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <main className="space-y-2 pb-2 text-slate-900">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold tracking-tight text-slate-800 sm:text-lg">Trang chủ</h1>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-medium text-slate-500">Dữ liệu mẫu</span>
      </div>

      <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_270px] 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-2">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,2.1fr)_minmax(200px,0.9fr)]">
            <section className="relative isolate flex min-h-[108px] items-center overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 px-4 py-2 shadow-sm sm:min-h-[116px] sm:px-5">
              <div aria-hidden="true" className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-blue-200/50 blur-3xl" />
              <div className="relative z-10 max-w-[72%]">
                <h2 className="text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">Chào {now.getHours() < 11 ? 'buổi sáng' : now.getHours() < 14 ? 'buổi trưa' : now.getHours() < 18 ? 'buổi chiều' : 'buổi tối'}, thầy An 👋</h2>
                <p className="mt-0.5 text-[10px] text-slate-600">Lan tỏa tri thức, truyền cảm hứng.</p>
                <p className="mt-0.5 text-[9px] text-slate-600"><strong className="text-blue-700">{mockClasses.length} lớp</strong> phụ trách · <strong className="text-blue-700">{workload.awaitingGrading} bài</strong> cần chấm</p>
                <button type="button" onClick={() => onNavigate('classes')} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-2.5 py-1 text-[9px] font-semibold text-white shadow-sm transition hover:bg-blue-800">
                  Xem lớp học <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <svg aria-hidden="true" viewBox="0 0 120 140" className="absolute bottom-0 right-4 hidden h-[112px] w-24 sm:block">
                <ellipse cx="60" cy="136" rx="42" ry="3" fill="#bfdbfe" />
                <path d="M19 136c2-24 14-35 28-39h26c16 5 27 17 29 39z" fill="#2563eb" />
                <path d="m45 98 15 18 15-18-8-7H52z" fill="#fff" />
                <path d="m58 117 2 19h7l-2-19 8-14-13 8-13-8z" fill="#1e40af" />
                <path d="M40 68c-5-5-8-16-5-29 3-14 13-24 27-24 17 0 26 12 27 29 1 11-2 20-7 26l-1 14-10 11H52L42 84z" fill="#1f2937" />
                <path d="M45 43c0-14 8-23 19-23 12 0 19 9 19 23v19c0 13-9 23-20 23S44 75 44 62z" fill="#f4c7a1" />
                <path d="M41 48c-3-17 7-31 21-31 16 0 25 12 23 27-7-3-13-9-16-15-7 8-16 13-28 15z" fill="#1f2937" />
                <path d="M48 52h11m10 0h11m-11 0h-10" fill="none" stroke="#334155" strokeWidth="2" />
                <circle cx="54" cy="54" r="5" fill="none" stroke="#334155" strokeWidth="1.5" />
                <circle cx="74" cy="54" r="5" fill="none" stroke="#334155" strokeWidth="1.5" />
                <circle cx="55" cy="54" r="1" fill="#1e293b" />
                <circle cx="73" cy="54" r="1" fill="#1e293b" />
                <path d="M61 69c3 2 6 2 9 0" fill="none" stroke="#b4534b" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M23 106c8-8 14-11 22-12l10 13-10 29H27z" fill="#1d4ed8" />
                <rect x="28" y="83" width="25" height="36" rx="3" transform="rotate(-12 28 83)" fill="#0f3b73" />
                <rect x="31" y="86" width="19" height="28" rx="2" transform="rotate(-12 31 86)" fill="#e2e8f0" />
                <path d="M91 99c4-9 7-20 7-29l3-9c1-3 5-2 5 1l-1 9 5-14c1-3 5-1 4 2l-4 16c-2 14-4 23-10 31z" fill="#f4c7a1" />
              </svg>
              <span aria-hidden="true" className="absolute right-7 top-4 hidden text-lg text-amber-400 sm:block">✦</span>
            </section>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <button type="button" onClick={() => onNavigate('lesson-builder')} className="group flex min-h-[68px] items-center gap-2 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-3 text-left shadow-sm transition hover:border-violet-200 hover:shadow-md lg:min-h-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-violet-600 shadow-sm"><PenLine className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold text-slate-800">Soạn bài</span>
                  <span className="mt-0.5 block text-[9px] leading-4 text-slate-500">Giáo án, bài giảng và slide</span>
                  <span className="mt-1 inline-flex items-center text-[9px] font-semibold text-violet-700">Mở công cụ <ChevronRight className="h-3 w-3" /></span>
                </span>
              </button>
              <button type="button" onClick={() => onNavigate('question-bank')} className="group flex min-h-[68px] items-center gap-2 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-3 text-left shadow-sm transition hover:border-indigo-200 hover:shadow-md lg:min-h-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm"><ClipboardList className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold text-slate-800">Tạo học liệu</span>
                  <span className="mt-0.5 block text-[9px] leading-4 text-slate-500">Câu hỏi và nội dung ôn tập</span>
                  <span className="mt-1 inline-flex items-center text-[9px] font-semibold text-indigo-700">Mở ngân hàng câu hỏi <ChevronRight className="h-3 w-3" /></span>
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard label="Lớp phụ trách" value={`${mockClasses.length}`} detail={`${studentCount} học sinh`} icon={CalendarDays} tone="blue" onClick={() => onNavigate('classes')} />
            <MetricCard label="Bài tập đã nộp" value={`${workload.submitted}/${totalAssignments}`} detail={`${workload.awaitingSubmission} chưa nộp`} icon={Users} tone="green" onClick={() => onNavigate('classes')} />
            <MetricCard label="Bài cần chấm" value={`${workload.awaitingGrading}`} detail="Cần xử lý" icon={ClipboardCheck} tone="violet" onClick={() => onNavigate('ai-grading')} />
            <MetricCard label="Đề cần duyệt" value="1" detail="Trước khi giao lớp" icon={FileCheck2} tone="amber" onClick={() => onNavigate('exams')} />
          </div>

          <Panel className="py-2">
            <SectionTitle icon={ArrowRight}>Truy cập nhanh</SectionTitle>
            <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
              {shortcuts.map(({ label, page, icon: Icon, tone }) => (
                <button key={label} type="button" onClick={() => onNavigate(page)} className="group flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-center transition hover:bg-slate-50">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md ${toneClasses(tone)}`}><Icon className="h-3.5 w-3.5" /></span>
                  <span className="w-full truncate text-[8px] font-medium text-slate-600 group-hover:text-blue-700 sm:text-[9px]">{label}</span>
                </button>
              ))}
            </div>
          </Panel>

          <div className="grid gap-2.5 md:grid-cols-3">
            <Panel className="min-h-[108px] p-2.5">
              <SectionTitle icon={CalendarDays} action={<button type="button" onClick={() => setSelectedDate(now)} className="text-[9px] font-semibold text-blue-700 hover:text-blue-900">Xem lịch</button>}>Hoạt động sắp tới</SectionTitle>
              <div className="space-y-1.5">
                {visibleEvents.slice(0, 3).map((event) => (
                  <button key={event.id} type="button" onClick={() => setSelectedDate(event.date)} className="flex w-full items-center gap-2 text-left hover:bg-slate-50">
                    <span className={`flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-md text-[8px] font-semibold leading-3 ${event.kind === 'class' ? 'bg-blue-50 text-blue-700' : event.kind === 'exam' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                      <span>{event.date.toLocaleDateString('vi-VN', { weekday: 'short' }).replace('.', '')}</span>
                      <span className="text-[11px]">{event.date.getDate()}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[9px] font-semibold text-slate-800">{event.title}</span>
                      <span className="block truncate text-[8px] text-slate-500">{formatTime(event.date)} · {event.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel className="min-h-[108px] p-2.5">
              <SectionTitle icon={ClipboardCheck}>Bài tập học sinh</SectionTitle>
              <div className="flex items-center justify-center gap-3 pt-1">
                <div className="relative flex h-[78px] w-[78px] shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#2563eb 0% ${(workload.submitted / totalAssignments) * 100}%, #e2e8f0 ${(workload.submitted / totalAssignments) * 100}% 100%)` }}>
                  <div className="flex h-[58px] w-[58px] flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-lg font-bold text-slate-800">{Math.round((workload.submitted / totalAssignments) * 100)}%</span>
                    <span className="text-[8px] text-slate-500">đã nộp</span>
                  </div>
                </div>
                <div className="space-y-1 text-[9px]">
                  <p className="text-slate-500">Tổng bài <strong className="float-right pl-3 text-slate-800">{totalAssignments}</strong></p>
                  <p className="text-slate-500">Đã nộp <strong className="float-right pl-3 text-emerald-700">{workload.submitted}</strong></p>
                  <p className="text-slate-500">Chưa nộp <strong className="float-right pl-3 text-amber-700">{workload.awaitingSubmission}</strong></p>
                </div>
              </div>
            </Panel>

            <Panel className="min-h-[108px] p-2.5">
              <SectionTitle icon={GraduationCap}>Tiến độ lớp học</SectionTitle>
              <div className="space-y-1.5 pt-0.5">
                {mockClasses.slice(0, 4).map((classroom) => (
                  <div key={classroom.id} className="grid grid-cols-[34px_1fr_25px] items-center gap-1.5 text-[8px]">
                    <span className="font-medium text-slate-600">{classroom.name}</span>
                    <div className="h-2 overflow-hidden rounded-sm bg-slate-100">
                      <div className={`h-full rounded-sm ${classroom.progress >= 80 ? 'bg-emerald-500' : classroom.progress >= 60 ? 'bg-blue-600' : 'bg-sky-400'}`} style={{ width: `${classroom.progress}%` }} />
                    </div>
                    <span className="text-right font-semibold text-slate-600">{classroom.progress}%</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <Panel className="py-2">
            <SectionTitle icon={Clock3} action={<button type="button" onClick={() => onNavigate('lessons')} className="text-[9px] font-semibold text-blue-700 hover:text-blue-900">Mở kho bài giảng</button>}>Công việc gần đây</SectionTitle>
            <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {recentWork.map(({ title, detail, edited, page, icon: Icon, tone }) => (
                <button key={title} type="button" onClick={() => onNavigate(page)} className="flex min-w-0 items-center gap-2 py-1.5 text-left transition hover:bg-slate-50 sm:px-2 first:sm:pl-0">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${toneClasses(tone)}`}><Icon className="h-3 w-3" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[9px] font-semibold text-slate-800">{title}</span>
                    <span className="block truncate text-[8px] text-slate-500">{detail}</span>
                  </span>
                  <span className="shrink-0 text-[8px] text-slate-400">{edited}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <aside className="space-y-2.5">
          <Panel>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 sm:text-sm">Lịch</h2>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Tháng trước" onClick={() => changeMonth(-1)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><ChevronLeft className="h-3.5 w-3.5" /></button>
                <span className="min-w-[98px] text-center text-[10px] font-semibold capitalize text-slate-700">{monthLabel(month)}</span>
                <button type="button" aria-label="Tháng sau" onClick={() => changeMonth(1)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((label) => <span key={label} className="py-1 text-[8px] font-semibold text-slate-400">{label}</span>)}
              {calendarCells.map((date) => {
                const isCurrentMonth = date.getMonth() === month.getMonth();
                const isSelected = sameDay(date, selectedDate);
                const hasEvent = visibleEvents.some((event) => sameDay(event.date, date));
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    aria-label={date.toLocaleDateString('vi-VN')}
                    aria-pressed={isSelected}
                    className={`relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[9px] transition ${isSelected ? 'bg-blue-600 font-bold text-white' : isCurrentMonth ? 'text-slate-700 hover:bg-blue-50' : 'text-slate-300 hover:bg-slate-50'}`}
                  >
                    {date.getDate()}
                    {hasEvent && <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />}
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={CalendarDays} action={<button type="button" onClick={() => setSelectedDate(now)} className="text-[9px] font-semibold text-blue-700 hover:text-blue-900">Hôm nay</button>}>Lịch dạy sắp tới</SectionTitle>
            <div className="space-y-1.5">
              {scheduleEvents.slice(0, 3).map((event) => {
                const schedule = scheduleFromEvent(event);
                return (
                  <div key={event.id} className="flex items-center gap-2 rounded-lg border-l-2 border-blue-500 bg-slate-50 px-2 py-1.5">
                    <span className="w-12 shrink-0 text-[8px] leading-3 text-slate-500">{classDateLabel(event.date, now)}<br />{formatTime(event.date)}</span>
                    <span className="min-w-0 flex-1 border-l border-slate-200 pl-2">
                      <span className="block truncate text-[9px] font-semibold text-slate-800">{schedule ? `Lớp ${schedule.className} · ${schedule.subject}` : event.title}</span>
                      <span className="block truncate text-[8px] text-slate-500">{event.detail}</span>
                    </span>
                  </div>
                );
              })}
              {scheduleEvents.length === 0 && (
                <p className="px-1 py-1 text-[9px] text-slate-500">Ngày này chưa có lịch dạy.</p>
              )}
            </div>
          </Panel>

          <Panel>
            <SectionTitle icon={Check}>Nhắc việc</SectionTitle>
            <div className="space-y-1">
              <button type="button" onClick={() => onNavigate('ai-grading')} className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition hover:bg-violet-50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700"><PenLine className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold text-slate-800">Bài cần chấm</span><span className="block text-[8px] text-slate-500">{workload.awaitingGrading} bài tự luận đang chờ</span></span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
              <button type="button" onClick={() => onNavigate('exams')} className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition hover:bg-amber-50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"><FileCheck2 className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold text-slate-800">Đề kiểm tra</span><span className="block text-[8px] text-slate-500">1 đề cần duyệt trước khi giao</span></span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
              <button type="button" onClick={() => onNavigate('lesson-builder')} className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition hover:bg-blue-50">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700"><FileText className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[9px] font-semibold text-slate-800">Giáo án đang soạn</span><span className="block text-[8px] text-slate-500">Hàm số bậc hai · Toán 10A1</span></span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
          </Panel>
        </aside>
      </div>
    </main>
  );
}
