import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  DoorOpen,
  History,
  Search,
  Users,
} from 'lucide-react';
import {
  listStudentExamRooms,
  recordStudentExamEvent,
  startStudentExam,
  submitStudentExam,
  type StudentExamEventType,
  type StudentExamQuestion,
  type StudentExamRoom,
} from '@/api/schoolApi';
import { PreExamCheckModal } from './exams/PreExamCheckModal';
import { ExamWorkspace, type ExamSubmissionSummary } from './exams/ExamWorkspace';
import type { ExamQuestion } from './exams/examQuestions';

type RoomStatus = 'open' | 'upcoming' | 'ended';
type StatusFilter = RoomStatus | 'all';

type ExamRoom = Omit<StudentExamRoom, 'status'> & { status: RoomStatus };

const statusLabels: Record<RoomStatus, string> = {
  open: 'Đang diễn ra',
  upcoming: 'Sắp diễn ra',
  ended: 'Đã kết thúc',
};

function getExamDate(dateTime: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(dateTime));
}

function getExamTime(start: string, durationMinutes: number) {
  const startDate = new Date(start);
  if (!Number.isFinite(startDate.getTime())) return '';
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
  const formatTime = (date: Date) => new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatTime(startDate)} - ${formatTime(endDate)}`;
}

function countdownLabel(targetTime: number, now: number) {
  const totalSeconds = Math.max(0, Math.ceil((targetTime - now) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
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

function statusFromRoom(room: StudentExamRoom): RoomStatus {
  if (room.status === 'open') return 'open';
  if (room.status === 'scheduled') return 'upcoming';
  return 'ended';
}

function expireRoom(room: ExamRoom, now: number): ExamRoom {
  const startsAt = new Date(room.startsAt).getTime();
  if (!Number.isFinite(startsAt) || room.status === 'ended') return room;
  if (now >= startsAt + room.durationMinutes * 60_000) return { ...room, status: 'ended' };
  if (now < startsAt && (room.status === 'open' || room.status === 'upcoming')) {
    return { ...room, status: 'upcoming' };
  }
  if (room.status === 'upcoming' && now >= startsAt) {
    return { ...room, status: 'open' };
  }
  return room;
}

function workspaceQuestions(questions: StudentExamQuestion[]): ExamQuestion[] {
  return questions.map((question, index) => ({
    id: index + 1,
    kind: question.type === 'true-false'
      ? 'true-false'
      : question.type === 'short-answer'
        ? 'short'
        : question.type === 'essay'
          ? 'essay'
          : 'choice',
    prompt: question.question,
    points: question.points,
    sectionId: question.sectionId,
    sectionTitle: question.sectionTitle,
    sectionInstruction: question.sectionDescription,
    ...(question.type === 'true-false'
      ? { statements: question.options }
      : question.type === 'multiple-choice' ? { options: question.options } : {}),
    correctAnswer: question.type === 'true-false' ? {} : '',
  }));
}

export function OnlineExamRooms({ onOpenHistory }: OnlineExamRoomsProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ExamRoom | null>(null);
  const [examStage, setExamStage] = useState<'check' | 'workspace' | 'result' | null>(null);
  const [examSummary, setExamSummary] = useState<ExamSubmissionSummary | null>(null);
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState('');
  const roomsRefreshInFlight = useRef(false);
  const [sessionId, setSessionId] = useState('');
  const [sessionStartedAt, setSessionStartedAt] = useState('');
  const [submission, setSubmission] = useState<{ answered: number; total: number; submittedAt: string } | null>(null);
  const [sessionError, setSessionError] = useState('');
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    let active = true;
    const refreshRooms = async () => {
      if (roomsRefreshInFlight.current) return;
      roomsRefreshInFlight.current = true;
      try {
        const items = await listStudentExamRooms();
        if (active) {
          setRooms(items.map((room) => expireRoom({ ...room, status: statusFromRoom(room) }, Date.now())));
          setRoomsError('');
        }
      } catch (error: unknown) {
        console.error('Không thể tải phòng thi được giao cho học sinh.', error);
        if (active) setRoomsError(error instanceof Error ? error.message : 'Không thể tải danh sách phòng thi.');
      } finally {
        roomsRefreshInFlight.current = false;
        if (active) setLoadingRooms(false);
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const currentTime = Date.now();
      setNow(currentTime);
      setRooms((current) => current.map((room) => expireRoom(room, currentTime)));
      void refreshRooms();
    };
    void refreshRooms();
    const interval = window.setInterval(refreshWhenVisible, 5_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  useEffect(() => {
    const updateRoomClock = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      setRooms((current) => current.map((room) => expireRoom(room, currentTime)));
    };
    const timer = window.setInterval(updateRoomClock, 1_000);
    document.addEventListener('visibilitychange', updateRoomClock);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateRoomClock);
    };
  }, []);

  const statusCounts = useMemo(() => ({
    open: rooms.filter((room) => room.status === 'open').length,
    upcoming: rooms.filter((room) => room.status === 'upcoming').length,
    ended: rooms.filter((room) => room.status === 'ended').length,
    all: rooms.length,
  }), [rooms]);

  const filteredRooms = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('vi');
    return rooms.filter((room) => {
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
  }, [rooms, searchQuery, statusFilter, subjectFilter]);

  const renderRoomCard = (room: ExamRoom) => {
    const startsAt = new Date(room.startsAt).getTime();
    const canEnter = room.status === 'open'
      && Number.isFinite(startsAt)
      && now >= startsAt
      && now < startsAt + room.durationMinutes * 60_000;
    return (
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
            <p className="shrink-0 text-sm font-extrabold text-slate-800">{getExamDate(room.startsAt)}</p>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Clock3 className="h-3.5 w-3.5" /> {room.durationMinutes} phút ({getExamTime(room.startsAt, room.durationMinutes)})
          </p>
          {room.status !== 'ended' && (() => {
            const startsAt = new Date(room.startsAt).getTime();
            const hasStarted = Number.isFinite(startsAt) && now >= startsAt;
            const countdownTarget = hasStarted
              ? startsAt + room.durationMinutes * 60_000
              : startsAt;
            return Number.isFinite(countdownTarget) ? (
              <div className="mt-3 rounded-lg border border-blue-100 bg-white px-3 py-2 text-center">
                <p className={`text-xs font-semibold ${hasStarted ? 'text-emerald-700' : 'text-blue-700'}`}>
                  {hasStarted ? 'Thời gian làm bài còn' : 'Mở phòng sau'}
                </p>
                <p aria-label={`${hasStarted ? 'Thời gian làm bài còn' : 'Mở phòng sau'} ${countdownLabel(countdownTarget, now)}`} className={`mt-0.5 font-mono text-2xl font-black leading-tight tabular-nums sm:text-3xl ${hasStarted ? 'text-emerald-600' : 'text-blue-700'}`}>
                  {countdownLabel(countdownTarget, now)}
                </p>
              </div>
            ) : null;
          })()}
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Users className="h-3.5 w-3.5" /> {room.inProgressCount} đang làm
          </p>
        </div>
      </div>

      <footer className="mt-4">
        <button
          type="button"
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition ${
            room.hasSubmitted
              ? 'cursor-not-allowed border-slate-200 bg-white text-slate-500'
              : canEnter
              ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md'
              : room.status === 'ended'
                ? 'cursor-not-allowed border-slate-200 bg-white text-slate-500'
                : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
          }`}
          disabled={room.hasSubmitted || !canEnter}
          onClick={() => {
            if (!canEnter) return;
            setSelectedRoom(room);
            setExamStage('check');
          }}
        >
          {room.hasSubmitted
            ? <><CheckCircle2 className="h-4 w-4" /> Đã nộp bài</>
            : <>{canEnter ? 'Vào phòng thi' : room.status === 'ended' ? 'Đã kết thúc' : 'Chưa mở'}{room.status !== 'ended' && <ArrowRight className="h-4 w-4" />}</>}
        </button>
      </footer>
      </article>
    );
  };

  return (
    examStage === 'result' && selectedRoom && examSummary && submission ? (
      <main className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold text-slate-950">Đã nộp bài thành công</h1>
        <p className="mt-2 text-sm text-slate-600">{selectedRoom.title}</p>
        <p className="mt-1 text-sm text-slate-600">Mã phòng: <strong>{selectedRoom.code}</strong></p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-4"><strong className="block text-xl text-slate-900">{submission.answered}/{submission.total}</strong><span className="text-xs text-slate-500">Câu đã trả lời</span></div>
          <div className="rounded-xl bg-slate-50 p-4"><strong className="block text-base text-slate-900">{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(submission.submittedAt))}</strong><span className="text-xs text-slate-500">Thời điểm nộp</span></div>
        </div>
        <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-left text-sm leading-6 text-blue-900">Bài làm đã được lưu vào hệ thống. Kết quả sẽ được cập nhật sau khi được chấm.</p>
        <button type="button" onClick={() => {
          setSelectedRoom(null);
          setExamSummary(null);
          setSubmission(null);
          setSessionId('');
          setExamStage(null);
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        }} className="mt-5 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800">Về danh sách phòng thi</button>
      </main>
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
              {[...new Set(rooms.map((room) => room.subject))].map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </label>
        </div>
      </section>

      <div>
        {roomsError && rooms.length > 0 && (
          <p role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            Không thể đồng bộ danh sách phòng thi mới nhất: {roomsError}
          </p>
        )}
        {filteredRooms.length > 0 ? (
          <section aria-label="Danh sách phòng thi" className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filteredRooms.map(renderRoomCard)}
          </section>
        ) : loadingRooms ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">Đang tải phòng thi được giao...</p>
        ) : roomsError ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{roomsError}</div>
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
          roomCode={selectedRoom.code}
          durationMinutes={selectedRoom.durationMinutes}
          instructions={selectedRoom.instructions}
          requireCamera={selectedRoom.settings.requireCamera}
          requireMicrophone={selectedRoom.settings.requireMicrophone}
          monitorTabSwitch={selectedRoom.settings.monitorTabSwitch}
          allowBackNavigation={selectedRoom.settings.allowBackNavigation}
          allowEarlySubmit={selectedRoom.settings.allowEarlySubmit}
          onClose={() => { setSelectedRoom(null); setExamStage(null); }}
          onStart={async (mediaStream) => {
            const session = await startStudentExam(selectedRoom.id);
            setSessionId(session.id);
            setSessionStartedAt(session.startedAt);
            setStream(mediaStream);
            setSessionError('');
            setExamStage('workspace');
          }}
        />
      )}
      {selectedRoom && examStage === 'workspace' && stream && (
        <ExamWorkspace
          examTitle={selectedRoom.title}
          subject={selectedRoom.subject}
          roomCode={selectedRoom.code}
          questions={workspaceQuestions(selectedRoom.examSnapshot.questions)}
          durationMinutes={selectedRoom.durationMinutes}
          startedAt={sessionStartedAt}
          roomStartsAt={selectedRoom.startsAt}
          sessionId={sessionId}
          settings={selectedRoom.settings}
          stream={stream}
          onExit={() => {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
            setSelectedRoom(null);
            setSessionId('');
            setExamStage(null);
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
          }}
          onEvent={async (eventType: StudentExamEventType) => {
            const result = await recordStudentExamEvent(sessionId, eventType);
            setSessionError(result.needsReview
              ? `Đã ghi nhận ${result.eventCount} sự kiện. Phiên thi đã được đưa vào mục giáo viên cần xem xét.`
              : '');
          }}
          onSubmit={async (summary) => {
            const saved = await submitStudentExam(
              sessionId,
              summary.answers,
              summary.files,
              summary.mobileUploadTokens,
            );
            setRooms((current) => current.map((room) => (
              room.id === selectedRoom.id ? { ...room, hasSubmitted: true } : room
            )));
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
            setExamSummary(summary);
            setSubmission(saved);
            setExamStage('result');
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
          }}
        />
      )}
      {sessionError && examStage === 'workspace' && (
        <p role="status" className="fixed bottom-4 right-4 z-[80] max-w-sm rounded-lg border border-blue-200 bg-white p-3 text-sm text-blue-900 shadow-lg">{sessionError}</p>
      )}
    </main>
    )
  );
}
