import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  Clock3,
  DoorOpen,
  History,
  Search,
  Users,
} from 'lucide-react';
import { PreExamCheckModal } from './exams/PreExamCheckModal';
import { ExamWorkspace, type ExamSubmissionSummary } from './exams/ExamWorkspace';
import { ExamResultAnalytics } from './exams/ExamResultAnalytics';

type RoomStatus = 'open' | 'upcoming' | 'ended';
type StatusFilter = RoomStatus | 'all';

interface ExamRoom {
  id: string;
  code: string;
  title: string;
  subject: string;
  start: string;
  end: string;
  durationMinutes: number;
  status: RoomStatus;
  inProgressCount: number;
}

const examRooms: ExamRoom[] = [
  {
    id: 'school-math-midterm',
    code: 'IT7YVQ',
    title: 'KIỂM TRA KHẢO SÁT CHẤT LƯỢNG GIỮA KỲ I - KHỐI 11',
    subject: 'Toán',
    start: '22/10/2026 - 08:00',
    end: '22/10/2026 - 09:30',
    durationMinutes: 90,
    status: 'upcoming',
    inProgressCount: 0,
  },
  {
    id: 'school-english',
    code: 'EN4KPL',
    title: 'BÀI KIỂM TRA NĂNG LỰC TIẾNG ANH GIỮA KỲ',
    subject: 'Tiếng Anh',
    start: '21/10/2026 - 20:00',
    end: '21/10/2026 - 21:00',
    durationMinutes: 60,
    status: 'open',
    inProgressCount: 1,
  },
  {
    id: 'school-physics',
    code: 'PH8NTR',
    title: 'KIỂM TRA VẬT LÝ - CHUYỂN ĐỘNG VÀ LỰC',
    subject: 'Vật lý',
    start: '18/10/2026 - 08:00',
    end: '18/10/2026 - 09:00',
    durationMinutes: 60,
    status: 'ended',
    inProgressCount: 0,
  },
  {
    id: 'system-math',
    code: 'MX2QAZ',
    title: 'LUYỆN TẬP TOÁN TỔNG HỢP - HÀM SỐ',
    subject: 'Toán',
    start: '20/10/2026 - 00:00',
    end: '25/10/2026 - 23:59',
    durationMinutes: 45,
    status: 'open',
    inProgressCount: 1,
  },
  {
    id: 'system-literature',
    code: 'VN6HGD',
    title: 'ÔN TẬP ĐỌC HIỂU VÀ NGHỊ LUẬN VĂN HỌC',
    subject: 'Ngữ văn',
    start: '23/10/2026 - 13:30',
    end: '23/10/2026 - 14:30',
    durationMinutes: 60,
    status: 'upcoming',
    inProgressCount: 0,
  },
  {
    id: 'system-english-archive',
    code: 'EN3RWT',
    title: 'ĐỀ LUYỆN TIẾNG ANH - UNIT 4',
    subject: 'Tiếng Anh',
    start: '12/10/2026 - 00:00',
    end: '15/10/2026 - 23:59',
    durationMinutes: 45,
    status: 'ended',
    inProgressCount: 0,
  },
];

const statusLabels: Record<RoomStatus, string> = {
  open: 'Đang diễn ra',
  upcoming: 'Sắp diễn ra',
  ended: 'Đã kết thúc',
};

function getExamDate(dateTime: string) {
  return dateTime.split(' - ')[0];
}

function getExamTime(start: string, durationMinutes: number) {
  const startTime = start.split(' - ')[1];
  if (!startTime) return start;
  const [hour, minute] = startTime.split(':').map(Number);
  const endTotalMinutes = hour * 60 + minute + durationMinutes;
  const endHour = Math.floor(endTotalMinutes / 60) % 24;
  const endMinute = endTotalMinutes % 60;
  return `${startTime} - ${`${endHour}`.padStart(2, '0')}:${`${endMinute}`.padStart(2, '0')}`;
}

const statusTextStyles: Record<RoomStatus, string> = {
  open: 'text-emerald-700',
  upcoming: 'text-amber-700',
  ended: 'text-slate-600',
};

const statusTabs: { id: StatusFilter; label: string }[] = [
  { id: 'open', label: 'Đang mở' },
  { id: 'upcoming', label: 'Sắp diễn ra' },
  { id: 'ended', label: 'Đã kết thúc' },
  { id: 'all', label: 'Tất cả' },
];

interface OnlineExamRoomsProps {
  onOpenHistory: () => void;
}

export function OnlineExamRooms({ onOpenHistory }: OnlineExamRoomsProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ExamRoom | null>(null);
  const [examStage, setExamStage] = useState<'check' | 'workspace' | 'result' | null>(null);
  const [examSummary, setExamSummary] = useState<ExamSubmissionSummary | null>(null);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  const statusCounts = useMemo(() => ({
    open: examRooms.filter((room) => room.status === 'open').length,
    upcoming: examRooms.filter((room) => room.status === 'upcoming').length,
    ended: examRooms.filter((room) => room.status === 'ended').length,
    all: examRooms.length,
  }), []);

  const filteredRooms = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('vi');
    return examRooms.filter((room) => {
      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
      const matchesSubject = subjectFilter === 'all' || room.subject === subjectFilter;
      const matchesSearch = !normalizedQuery
        || room.title.toLocaleLowerCase('vi').includes(normalizedQuery)
        || room.code.toLocaleLowerCase('vi').includes(normalizedQuery);
      return matchesStatus && matchesSubject && matchesSearch;
    }).sort((first, second) => {
      const statusPriority: Record<RoomStatus, number> = { open: 0, upcoming: 1, ended: 2 };
      return statusPriority[first.status] - statusPriority[second.status];
    });
  }, [searchQuery, statusFilter, subjectFilter]);

  const renderRoomCard = (room: ExamRoom) => (
    <article key={room.id} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-xl font-black leading-7 text-slate-950 sm:text-2xl">{room.subject}</span>
      </div>

      <div className="mt-2 flex-1">
        <h3 className="line-clamp-2 text-sm font-extrabold leading-5 text-slate-900 sm:text-base">{room.title}</h3>
        <p className="mt-1 text-xs text-slate-600">Mã phòng: <strong className="font-extrabold tracking-wide text-slate-900">{room.code}</strong></p>
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className={`inline-flex items-center gap-1.5 text-sm font-bold ${statusTextStyles[room.status]}`}>
              <CalendarClock className="h-4 w-4" />
              {room.status === 'ended' ? 'Đã kết thúc' : statusLabels[room.status]}
            </p>
            <p className="shrink-0 text-sm font-extrabold text-slate-800">{getExamDate(room.start)}</p>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Clock3 className="h-3.5 w-3.5" /> {room.durationMinutes} phút ({getExamTime(room.start, room.durationMinutes)})
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Users className="h-3.5 w-3.5" /> {room.inProgressCount} đang làm
          </p>
        </div>
      </div>

      <footer className="mt-4">
        <button
          type="button"
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            room.status === 'open'
              ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md'
              : 'cursor-not-allowed bg-slate-100 text-slate-400'
          }`}
          disabled={room.status !== 'open'}
          onClick={() => { setSelectedRoom(room); setExamStage('check'); }}
        >
          {room.status === 'open' ? 'Vào phòng thi' : room.status === 'upcoming' ? 'Chưa mở' : 'Đã đóng'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </footer>
    </article>
  );

  return (
    examStage === 'result' && selectedRoom && examSummary ? (
      <ExamResultAnalytics
        examTitle={selectedRoom.title}
        subject={selectedRoom.subject}
        summary={examSummary}
        onBack={() => {
          stream?.getTracks().forEach((track) => track.stop());
          setStream(null);
          setSelectedRoom(null);
          setExamSummary(null);
          setExamStage(null);
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        }}
      />
    ) : (
    <main className="animate-fadeIn space-y-5 pb-8">
      <header className="flex justify-end">
        <button type="button" onClick={onOpenHistory} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
          <History className="h-4 w-4" /> Lịch sử làm bài
        </button>
      </header>

      <section className="space-y-3" aria-label="Lọc phòng thi">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statusTabs.map((tab) => {
            const count = statusCounts[tab.id];
            const active = statusFilter === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setStatusFilter(tab.id)} aria-pressed={active} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'}`}>
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto]">
          <label className="relative">
            <span className="sr-only">Tìm theo tên hoặc mã phòng</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm theo tên/mã phòng..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          </label>
          <label className="relative">
            <span className="sr-only">Lọc theo môn học</span>
            <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:min-w-40">
              <option value="all">Tất cả môn học</option>
              {[...new Set(examRooms.map((room) => room.subject))].map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </label>
        </div>
      </section>

      <div>
        {filteredRooms.length > 0 ? (
          <section aria-label="Danh sách phòng thi" className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filteredRooms.map(renderRoomCard)}
          </section>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><DoorOpen className="h-7 w-7" /></span>
            <h2 className="mt-4 font-semibold text-slate-800">Hiện chưa có phòng thi nào ở mục này</h2>
            <p className="mt-1 text-sm text-slate-500">Thử chọn trạng thái hoặc bộ lọc khác nhé.</p>
          </div>
        )}
      </div>

      {selectedRoom && examStage === 'check' && (
        <PreExamCheckModal
          examTitle={selectedRoom.title}
          onClose={() => { setSelectedRoom(null); setExamStage(null); }}
          onStart={(mediaStream) => { setStream(mediaStream); setExamStage('workspace'); }}
        />
      )}
      {selectedRoom && examStage === 'workspace' && stream && (
        <ExamWorkspace
          examTitle={selectedRoom.title}
          subject={selectedRoom.subject}
          stream={stream}
          onExit={() => {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
            setSelectedRoom(null);
            setExamStage(null);
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
          }}
          onSubmit={(summary) => {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
            setExamSummary(summary);
            setExamStage('result');
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
          }}
        />
      )}
    </main>
    )
  );
}
