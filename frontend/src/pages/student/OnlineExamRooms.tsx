import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  Clock3,
  DoorOpen,
  History,
  Mic,
  Search,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { PreExamCheckModal } from './exams/PreExamCheckModal';
import { ExamWorkspace, type ExamSubmissionSummary } from './exams/ExamWorkspace';
import { ExamResultAnalytics } from './exams/ExamResultAnalytics';

type RoomStatus = 'open' | 'upcoming' | 'ended';
type RoomSource = 'school' | 'system';
type StatusFilter = RoomStatus | 'all';

interface ExamRoom {
  id: string;
  code: string;
  title: string;
  subject: string;
  start: string;
  end: string;
  status: RoomStatus;
  source: RoomSource;
}

const examRooms: ExamRoom[] = [
  {
    id: 'school-math-midterm',
    code: 'IT7YVQ',
    title: 'KIỂM TRA KHẢO SÁT CHẤT LƯỢNG GIỮA KỲ I - KHỐI 11',
    subject: 'Toán',
    start: '22/10/2026 · 08:00',
    end: '22/10/2026 · 09:30',
    status: 'upcoming',
    source: 'school',
  },
  {
    id: 'school-english',
    code: 'EN4KPL',
    title: 'BÀI KIỂM TRA NĂNG LỰC TIẾNG ANH GIỮA KỲ',
    subject: 'Tiếng Anh',
    start: '21/10/2026 · 20:00',
    end: '21/10/2026 · 21:00',
    status: 'open',
    source: 'school',
  },
  {
    id: 'school-physics',
    code: 'PH8NTR',
    title: 'KIỂM TRA VẬT LÝ - CHUYỂN ĐỘNG VÀ LỰC',
    subject: 'Vật lý',
    start: '18/10/2026 · 08:00',
    end: '18/10/2026 · 09:00',
    status: 'ended',
    source: 'school',
  },
  {
    id: 'system-math',
    code: 'MX2QAZ',
    title: 'LUYỆN TẬP TOÁN TỔNG HỢP - HÀM SỐ',
    subject: 'Toán',
    start: '20/10/2026 · 00:00',
    end: '25/10/2026 · 23:59',
    status: 'open',
    source: 'system',
  },
  {
    id: 'system-literature',
    code: 'VN6HGD',
    title: 'ÔN TẬP ĐỌC HIỂU VÀ NGHỊ LUẬN VĂN HỌC',
    subject: 'Ngữ văn',
    start: '23/10/2026 · 13:30',
    end: '23/10/2026 · 14:30',
    status: 'upcoming',
    source: 'system',
  },
  {
    id: 'system-english-archive',
    code: 'EN3RWT',
    title: 'ĐỀ LUYỆN TIẾNG ANH - UNIT 4',
    subject: 'Tiếng Anh',
    start: '12/10/2026 · 00:00',
    end: '15/10/2026 · 23:59',
    status: 'ended',
    source: 'system',
  },
];

const statusLabels: Record<RoomStatus, string> = {
  open: 'Đang diễn ra',
  upcoming: 'Sắp diễn ra',
  ended: 'Đã kết thúc',
};

function getExamDate(dateTime: string) {
  return dateTime.split(' · ')[0];
}

function getExamTime(start: string, end: string) {
  const startTime = start.split(' · ')[1];
  const endTime = end.split(' · ')[1];
  return startTime && endTime ? `${startTime} – ${endTime}` : `${start} – ${end}`;
}

const statusStyles: Record<RoomStatus, string> = {
  open: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  upcoming: 'bg-amber-50 text-amber-700 ring-amber-200',
  ended: 'bg-slate-100 text-slate-600 ring-slate-200',
};

const subjectStyles: Record<string, string> = {
  Toán: 'bg-blue-50 text-blue-700',
  'Ngữ văn': 'bg-amber-50 text-amber-800',
  'Tiếng Anh': 'bg-emerald-50 text-emerald-700',
  'Vật lý': 'bg-violet-50 text-violet-700',
  Hóa: 'bg-rose-50 text-rose-700',
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
  const [sourceFilter, setSourceFilter] = useState<'all' | RoomSource>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deviceCheckOpen, setDeviceCheckOpen] = useState(false);
  const [devicePromptDismissed, setDevicePromptDismissed] = useState(false);
  const [deviceError, setDeviceError] = useState('');
  const [deviceReady, setDeviceReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ExamRoom | null>(null);
  const [examStage, setExamStage] = useState<'check' | 'workspace' | 'result' | null>(null);
  const [examSummary, setExamSummary] = useState<ExamSubmissionSummary | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
      const matchesSource = sourceFilter === 'all' || room.source === sourceFilter;
      const matchesSearch = !normalizedQuery
        || room.title.toLocaleLowerCase('vi').includes(normalizedQuery)
        || room.code.toLocaleLowerCase('vi').includes(normalizedQuery);
      return matchesStatus && matchesSubject && matchesSource && matchesSearch;
    }).sort((first, second) => {
      const statusPriority: Record<RoomStatus, number> = { open: 0, upcoming: 1, ended: 2 };
      return statusPriority[first.status] - statusPriority[second.status];
    });
  }, [searchQuery, sourceFilter, statusFilter, subjectFilter]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, deviceCheckOpen]);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  const closeDeviceCheck = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setDeviceError('');
    setDeviceCheckOpen(false);
  };

  const checkDevices = async () => {
    setDeviceError('');
    setDeviceReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt hiện tại không hỗ trợ kiểm tra webcam và micro.');
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
      setDeviceReady(true);
    } catch (error) {
      const message = error instanceof Error
        ? error.name === 'NotAllowedError'
          ? 'Em chưa cấp quyền sử dụng webcam/micro. Hãy cho phép trong cài đặt trình duyệt rồi thử lại.'
          : error.name === 'NotFoundError'
            ? 'Không tìm thấy webcam hoặc micro đang kết nối.'
            : error.message
        : 'Không thể truy cập webcam hoặc micro.';
      setDeviceError(message);
    }
  };

  const renderRoomCard = (room: ExamRoom) => (
    <article key={room.id} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${subjectStyles[room.subject] ?? 'bg-slate-100 text-slate-700'}`}>{room.subject}</span>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[room.status]}`}>{room.status === 'ended' ? 'Đã kết thúc' : statusLabels[room.status]}</span>
      </div>

      <div className="mt-4 flex-1">
        <h3 className="line-clamp-2 min-h-12 text-sm font-extrabold leading-6 text-slate-900 sm:text-base">{room.title}</h3>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" />
              {room.status === 'ended' ? 'Đã kết thúc' : statusLabels[room.status]}
            </p>
            <p className="shrink-0 text-xs font-bold text-slate-500">{getExamDate(room.start)}</p>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Clock3 className="h-3.5 w-3.5" /> {getExamTime(room.start, room.end)}
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

      {!deviceReady && !devicePromptDismissed && (
        <div aria-hidden="true" className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[2px]" />
      )}
      {!deviceReady && (
        <section className={`relative overflow-hidden rounded-2xl border bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 p-4 transition-all sm:p-5 ${
          devicePromptDismissed
            ? 'border-blue-100'
            : 'z-50 animate-pulse border-2 border-blue-400 shadow-[0_0_0_6px_rgba(59,130,246,0.18),0_16px_40px_rgba(15,23,42,0.22)] motion-reduce:animate-none'
        }`}>
        <span aria-hidden="true" className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-blue-200/30 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900">EduBot nhắc em chuẩn bị trước giờ thi</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">Phòng Toán khối 11 gần nhất sắp mở. Hãy kiểm tra webcam và micro trước khi vào phòng thi.</p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-2 sm:items-end">
            <button type="button" onClick={() => { setDeviceCheckOpen(true); setDeviceError(''); }} className={`inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-5 py-3 text-base font-bold text-blue-700 shadow-md transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 ${
              !devicePromptDismissed ? 'ring-4 ring-blue-300/70 motion-safe:animate-pulse motion-reduce:animate-none' : ''
            }`}>
              <Video className="h-5 w-5" /> Kiểm tra webcam &amp; micro
            </button>
            {!devicePromptDismissed && (
              <button type="button" onClick={() => setDevicePromptDismissed(true)} className="rounded px-2 py-1 text-xs font-medium text-slate-600 underline decoration-slate-400 underline-offset-2 hover:text-slate-900">
                Để sau
              </button>
            )}
          </div>
        </div>
        </section>
      )}

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
        <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto_auto]">
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
          <label className="relative">
            <span className="sr-only">Lọc theo nguồn phòng</span>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as 'all' | RoomSource)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:min-w-48">
              <option value="all">Tất cả nguồn phòng</option>
              <option value="school">Phòng thi theo trường</option>
              <option value="system">Phòng thi hệ thống</option>
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

      {deviceCheckOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeviceCheck(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="device-check-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="device-check-title" className="text-lg font-bold text-slate-900">Kiểm tra webcam &amp; micro</h2>
                <p className="mt-1 text-sm text-slate-500">Trình duyệt sẽ yêu cầu quyền truy cập thiết bị.</p>
              </div>
              <button type="button" onClick={closeDeviceCheck} aria-label="Đóng kiểm tra thiết bị" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl bg-slate-950">
              {stream ? <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" /> : (
                <div className="flex aspect-video flex-col items-center justify-center gap-3 text-slate-300">
                  <div className="flex gap-3"><Video className="h-8 w-8" /><Mic className="h-8 w-8" /></div>
                  <p className="text-sm">Chưa kết nối thiết bị</p>
                </div>
              )}
            </div>
            {deviceReady && <p role="status" className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700"><Check className="h-4 w-4" /> Webcam và micro đã sẵn sàng.</p>}
            {deviceError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{deviceError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeDeviceCheck} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Đóng</button>
              {!deviceReady && <button type="button" onClick={() => void checkDevices()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">Bắt đầu kiểm tra</button>}
            </div>
          </section>
        </div>
      )}

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
