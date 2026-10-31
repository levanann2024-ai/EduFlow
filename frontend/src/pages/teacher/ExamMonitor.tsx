import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CalendarClock,
  Check,
  Clock3,
  Eye,
  FileText,
  Play,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { defaultAssessmentSections } from './assessmentStorage';
import type { ExamRoomRecord, ExamRoomStatus, ExamSessionStatus } from './examRoomDemoData';

const roomStatusLabels: Record<ExamRoomStatus, string> = {
  draft: 'Bản nháp',
  scheduled: 'Sắp diễn ra',
  open: 'Đang mở',
  closed: 'Kết thúc',
  completed: 'Kết thúc',
};

const sessionStatusLabels: Record<ExamSessionStatus, string> = {
  'not-started': 'Chưa vào',
  'in-progress': 'Đang làm',
  submitted: 'Đã nộp',
  disconnected: 'Mất kết nối',
  review: 'Cần xem xét',
};

const sessionStatusStyles: Record<ExamSessionStatus, string> = {
  'not-started': 'bg-slate-100 text-slate-700',
  'in-progress': 'bg-emerald-50 text-emerald-800',
  submitted: 'bg-blue-50 text-blue-800',
  disconnected: 'bg-amber-50 text-amber-800',
  review: 'bg-rose-50 text-rose-800',
};

const roomStatusTextStyles: Record<ExamRoomStatus, string> = {
  draft: 'text-slate-600',
  scheduled: 'text-amber-700',
  open: 'text-emerald-700',
  closed: 'text-slate-600',
  completed: 'text-slate-600',
};

type DetailTab = 'overview' | 'monitor' | 'events';
type SessionFilter = 'all' | ExamSessionStatus;

function examFormat(room: ExamRoomRecord) {
  const sections = room.examSnapshot.sections ?? defaultAssessmentSections(room.examSnapshot.questions);
  return sections.map((section) => ({
    ...section,
    questionCount: section.questionIds.filter((id) => room.examSnapshot.questions.some((question) => question.id === id)).length,
  }));
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function effectiveRoomStatus(room: ExamRoomRecord, now: number): ExamRoomStatus {
  if (!['scheduled', 'open'].includes(room.status)) return room.status;
  const startsAt = new Date(room.startsAt).getTime();
  if (!Number.isFinite(startsAt)) return room.status;
  if (now >= startsAt + room.durationMinutes * 60_000) return 'completed';
  if (now < startsAt && (room.status === 'scheduled' || room.status === 'open')) return 'scheduled';
  return room.status === 'scheduled' ? 'open' : room.status;
}

function examTimeRange(startsAt: string, durationMinutes: number) {
  const startDate = new Date(startsAt);
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

function roomCode(room: ExamRoomRecord) {
  return room.code?.trim() || room.id.toLocaleUpperCase('en').replace(/[^A-Z0-9]/g, '').slice(-6).padStart(6, '0');
}

function countStatus(room: ExamRoomRecord, status: ExamSessionStatus) {
  return room.sessions.filter((session) => session.status === status).length;
}

function sortSessionsByAlertCount(sessions: ExamRoomRecord['sessions']) {
  const alertLevel = (eventCount: number) => eventCount >= 3 ? 2 : eventCount > 0 ? 1 : 0;
  return [...sessions].sort((first, second) => (
    alertLevel(second.eventCount) - alertLevel(first.eventCount)
    || second.eventCount - first.eventCount
    || first.studentName.localeCompare(second.studentName, 'vi')
  ));
}

export function ExamMonitor({
  rooms,
  onEditDraft,
  onUpdateRoom,
  onDeleteRoom,
  openRoomId,
}: {
  rooms: ExamRoomRecord[];
  onEditDraft: (room: ExamRoomRecord) => void;
  onUpdateRoom: (room: ExamRoomRecord) => void;
  onDeleteRoom: (roomId: string) => void;
  openRoomId: string | null;
}) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [roomFilter, setRoomFilter] = useState<'all' | ExamRoomStatus>('all');
  const [roomSearch, setRoomSearch] = useState('');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const effectiveRooms = useMemo(
    () => rooms.map((room) => ({ ...room, status: effectiveRoomStatus(room, now) })),
    [now, rooms],
  );
  const selectedRoom = effectiveRooms.find((room) => room.id === selectedRoomId);
  const selectedSession = selectedRoom?.sessions.find((session) => session.id === selectedSessionId);
  const filteredRooms = useMemo(() => {
    const normalizedQuery = roomSearch.trim().toLocaleLowerCase('vi');
    return effectiveRooms.filter((room) => {
      const matchesStatus = roomFilter === 'all'
        || (roomFilter === 'closed' ? room.status === 'closed' || room.status === 'completed' : room.status === roomFilter);
      const matchesSearch = !normalizedQuery
        || room.title.toLocaleLowerCase('vi').includes(normalizedQuery)
        || room.code.toLocaleLowerCase('vi').includes(normalizedQuery);
      return matchesStatus && matchesSearch;
    });
  }, [effectiveRooms, roomFilter, roomSearch]);
  const roomStatusCounts = {
    open: effectiveRooms.filter((room) => room.status === 'open').length,
    scheduled: effectiveRooms.filter((room) => room.status === 'scheduled').length,
    closed: effectiveRooms.filter((room) => room.status === 'closed' || room.status === 'completed').length,
    all: effectiveRooms.length,
  };
  const visibleSessions = selectedRoom?.sessions.filter((session) => sessionFilter === 'all' || session.status === sessionFilter) ?? [];
  const sessionsByAlertCount = selectedRoom ? sortSessionsByAlertCount(selectedRoom.sessions) : [];

  useEffect(() => {
    if (openRoomId) {
      setSelectedRoomId(openRoomId);
      setDetailTab('overview');
      setSelectedSessionId(null);
    }
  }, [openRoomId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const updateStatus = (room: ExamRoomRecord, status: ExamRoomStatus) => {
    onUpdateRoom({ ...room, status });
  };

  const deleteRoom = (room: ExamRoomRecord) => {
    if (!window.confirm(`Bạn có chắc muốn xóa phòng "${room.title}"?`)) return;
    if (!window.confirm(`Xác nhận lần cuối: xóa phòng "${room.title}"? Thao tác này không thể hoàn tác.`)) return;
    onDeleteRoom(room.id);
  };

  if (selectedRoom) {
    const formatSections = examFormat(selectedRoom);
    const isEnded = selectedRoom.status === 'closed' || selectedRoom.status === 'completed';
    const tabs: { id: DetailTab; label: string }[] = [
      { id: 'overview', label: 'Tổng quan' },
      ...(!isEnded && selectedRoom.status === 'open' ? [{ id: 'monitor' as const, label: 'Sự cố đang diễn ra' }] : []),
      ...(isEnded ? [{ id: 'events' as const, label: 'Nhật ký' }] : []),
    ];
    const canStart = selectedRoom.status === 'scheduled';
    return (
      <main className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => { setSelectedRoomId(null); setSelectedSessionId(null); }} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Danh sách phòng</button>
          <div className="flex flex-wrap gap-2">
            {selectedRoom.status === 'draft' && <button type="button" onClick={() => onEditDraft(selectedRoom)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white">Tiếp tục cấu hình</button>}
            {canStart && <button type="button" onClick={() => updateStatus(selectedRoom, 'open')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Play className="h-4 w-4" /> Mở phòng</button>}
          </div>
        </div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-5 sm:p-6">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm"><BookOpenCheck className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">{selectedRoom.title}</h1>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
                    <span>Mã phòng: <strong className="font-extrabold tracking-wide text-blue-800">{roomCode(selectedRoom)}</strong> - {selectedRoom.classNames.join(', ')}</span>
                  </p>
                </div>
              </div>
            </div>
          </header>
          <nav className="flex flex-wrap gap-1 border-b border-slate-100 px-3 pt-2">
            {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setDetailTab(tab.id)} className={`rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-semibold ${detailTab === tab.id ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab.label}</button>)}
          </nav>

          {detailTab === 'overview' && (
            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <article className="rounded-xl border border-blue-100 bg-blue-50/70 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-blue-800"><Users className="h-4 w-4" /> Học sinh tham gia</div><p className="mt-2 text-2xl font-black text-slate-950">{selectedRoom.sessions.filter((session) => session.status !== 'not-started').length}<span className="text-base font-semibold text-slate-500"> / {selectedRoom.studentCount}</span></p></article>
                <article className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-indigo-800"><Check className="h-4 w-4" /> Đã nộp</div><p className="mt-2 text-2xl font-black text-slate-950">{countStatus(selectedRoom, 'submitted')}</p></article>
                <article className="rounded-xl border border-amber-100 bg-amber-50/70 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-amber-800"><AlertTriangle className="h-4 w-4" /> Cần xem</div><p className="mt-2 text-2xl font-black text-slate-950">{selectedRoom.sessions.filter((session) => session.eventCount >= 3).length}</p></article>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-xl border border-slate-200 border-t-4 border-t-blue-500 bg-white p-4"><h2 className="flex items-center gap-2 font-bold text-slate-900"><CalendarClock className="h-4 w-4 text-blue-600" /> Lịch thi</h2><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Thời điểm bắt đầu</dt><dd className="text-right">{dateLabel(selectedRoom.startsAt)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Thời gian làm bài</dt><dd>{selectedRoom.durationMinutes} phút mỗi học sinh</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Khung giờ dự kiến</dt><dd>{examTimeRange(selectedRoom.startsAt, selectedRoom.durationMinutes)}</dd></div></dl></article>
                <article className="rounded-xl border border-slate-200 border-t-4 border-t-indigo-500 bg-white p-4"><h2 className="flex items-center gap-2 font-bold text-slate-900"><FileText className="h-4 w-4 text-indigo-600" /> Đề thi</h2><p className="mt-2 font-semibold text-slate-800">{selectedRoom.examSnapshot.title}</p><div className="mt-1 text-sm text-slate-500"><p>Format đề:</p>{formatSections.length > 0 ? <ul className="mt-1 space-y-1">{formatSections.map((section) => <li key={section.id}><span className="font-medium">{section.title}</span> · {section.questionCount} câu{section.description && <p className="text-xs">{section.description}</p>}</li>)}</ul> : <p>Chưa có phần thi</p>}</div><p className="mt-3 text-sm text-slate-600">{selectedRoom.instructions || 'Chưa có hướng dẫn.'}</p></article>
              </div>
              <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h2 className="font-bold text-slate-900">Danh sách học sinh trong lớp</h2>
                </div>
                {selectedRoom.sessions.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">Chưa có học sinh trong lớp được giao.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr><th className="px-4 py-2.5">Học sinh</th><th className="px-4 py-2.5">Lớp</th><th className="px-4 py-2.5">Trạng thái</th><th className="px-4 py-2.5">Thời điểm nộp</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedRoom.sessions.map((session) => (
                          <tr key={session.id}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{session.studentName}</td>
                            <td className="px-4 py-3 text-slate-600">{session.className}</td>
                            <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sessionStatusStyles[session.status]}`}>{sessionStatusLabels[session.status]}</span></td>
                            <td className="px-4 py-3 text-slate-600">{session.submittedAt ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(session.submittedAt)) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </div>
          )}

          {detailTab === 'monitor' && (
            <section className="p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">Danh sách phiên</h2><select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value as SessionFilter)} className="input-field w-auto"><option value="all">Mọi trạng thái</option>{Object.entries(sessionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              {visibleSessions.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Chưa có phiên ở trạng thái này.</p> : (
                <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Học sinh</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Còn lại</th><th className="px-4 py-3">Sự kiện</th><th className="px-4 py-3">Cảnh báo</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{visibleSessions.map((session) => <tr key={session.id}><td className="px-4 py-3"><p className="font-semibold text-slate-900">{session.studentName}</p><p className="text-xs text-slate-500">{session.className}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sessionStatusStyles[session.status]}`}>{sessionStatusLabels[session.status]}</span></td><td className="px-4 py-3">{session.remainingMinutes === null ? '—' : `${session.remainingMinutes} phút`}</td><td className="px-4 py-3">{session.eventCount}</td><td className="px-4 py-3">{session.eventCount >= 3 ? <span className="font-semibold text-rose-700">Cần xem xét</span> : session.eventCount > 0 ? <span className="font-semibold text-amber-700">Cần kiểm tra</span> : <span className="text-slate-500">Không có</span>}</td><td className="px-4 py-3">{session.status === 'not-started' ? <span className="text-slate-400">—</span> : <button type="button" onClick={() => setSelectedSessionId(session.id)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-blue-700 hover:bg-blue-50"><Eye className="h-4 w-4" /> Chi tiết</button>}</td></tr>)}</tbody></table></div>
              )}
              <p className="mt-3 text-xs leading-5 text-slate-500">Chưa hỗ trợ camera hoặc theo dõi trình duyệt nền.</p>
            </section>
          )}

          {detailTab === 'events' && (
            <section className="space-y-3 p-4">
              <h2 className="font-semibold text-slate-900">Nhật ký cảnh báo của cả lớp</h2>
              {sessionsByAlertCount.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Chưa có học sinh trong lớp.</p>
              ) : (
                <ol className="space-y-2">
                  {sessionsByAlertCount.map((session) => {
                    const hasCriticalAlerts = session.eventCount >= 3;
                    const hasAlerts = session.eventCount > 0;
                    return (
                      <li
                        key={session.id}
                        className={`rounded-xl border p-3 ${
                          hasCriticalAlerts
                            ? 'border-rose-300 bg-rose-50 text-rose-950'
                            : hasAlerts
                              ? 'border-amber-300 bg-amber-50 text-amber-950'
                              : 'border-slate-200 bg-white text-slate-900'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{session.studentName}</p>
                            <p className="text-xs opacity-75">{session.className} · {sessionStatusLabels[session.status]}</p>
                          </div>
                          <span className="text-sm font-semibold">
                            {hasCriticalAlerts ? `Cảnh báo đỏ · ${session.eventCount} lần` : hasAlerts ? `Cần kiểm tra · ${session.eventCount} lần` : 'Không có cảnh báo'}
                          </span>
                        </div>
                        {session.events.length > 0 && (
                          <ul className="mt-2 space-y-1 border-t border-current/10 pt-2 text-sm">
                            {session.events.map((event) => (
                              <li key={event.id} className="flex flex-wrap justify-between gap-2">
                                <span>{event.label}</span>
                                <time className="text-xs opacity-75">{event.at}</time>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          )}
        </section>

        {selectedSession && (
          <div className="fixed inset-0 z-[75] flex justify-end bg-slate-950/35" onClick={() => setSelectedSessionId(null)}>
            <aside role="dialog" aria-modal="true" aria-label={`Phiên thi của ${selectedSession.studentName}`} onClick={(event) => event.stopPropagation()} className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
              <header className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="text-xs text-slate-500">Phiên thi</p><h2 className="mt-1 font-semibold text-slate-950">{selectedSession.studentName}</h2><p className="mt-1 text-sm text-slate-500">{selectedSession.className} - {sessionStatusLabels[selectedSession.status]}</p></div><button type="button" onClick={() => setSelectedSessionId(null)} aria-label="Đóng chi tiết" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
              <div className="flex-1 space-y-4 overflow-y-auto p-5"><div className="grid grid-cols-2 gap-2"><p className="rounded-lg bg-slate-50 p-3 text-sm"><span className="block text-xs text-slate-500">Thời gian còn</span>{selectedSession.remainingMinutes === null ? '—' : `${selectedSession.remainingMinutes} phút`}</p><p className="rounded-lg bg-slate-50 p-3 text-sm"><span className="block text-xs text-slate-500">Sự kiện</span>{selectedSession.eventCount}</p></div><h3 className="font-semibold text-slate-900">Hoạt động ghi nhận</h3>{selectedSession.events.length ? <ol className="space-y-2">{selectedSession.events.map((event) => <li key={event.id} className={`rounded-lg border p-3 text-sm ${event.kind === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'}`}><span className="mr-2 text-xs text-slate-500">{event.at}</span>{event.label}</li>)}</ol> : <p className="text-sm text-slate-500">Chưa có sự kiện.</p>}<p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Một cảnh báo đơn lẻ không tự động tạo điểm 0. Giáo viên xem xét từng tình huống.</p></div>
            </aside>
          </div>
        )}
      </main>
    );
  }

  const openRoom = (room: ExamRoomRecord) => {
    setSelectedRoomId(room.id);
    setDetailTab('overview');
    setSessionFilter('all');
  };

  return (
    <main className="space-y-3">
      <section className="space-y-3">
        <label className="relative block max-w-xl">
          <span className="sr-only">Tìm phòng theo tên hoặc mã</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={roomSearch} onChange={(event) => setRoomSearch(event.target.value)} placeholder="Tìm theo tên hoặc mã phòng..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        </label>
        <div role="group" aria-label="Lọc phòng theo trạng thái" className="flex flex-wrap gap-2">
          {([
            { id: 'open', label: 'Đang mở' },
            { id: 'scheduled', label: 'Sắp diễn ra' },
            { id: 'closed', label: 'Đã kết thúc' },
            { id: 'all', label: 'Tất cả' },
          ] as const).map(({ id, label }) => {
            const active = roomFilter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setRoomFilter(id)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'}`}
              >
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{roomStatusCounts[id]}</span>
              </button>
            );
          })}
        </div>
        {filteredRooms.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><BookOpenCheck className="mx-auto h-8 w-8 text-slate-300" /><h2 className="mt-3 font-semibold text-slate-800">{effectiveRooms.length ? 'Không tìm thấy phòng phù hợp' : 'Chưa có phòng thi nào'}</h2><p className="mt-1 text-sm text-slate-500">{effectiveRooms.length ? 'Thử đổi tên, mã phòng hoặc trạng thái lọc.' : 'Tạo phòng thi từ mục Đề thi đã lưu.'}</p></div> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredRooms.map((room) => {
              const submittedCount = countStatus(room, 'submitted');
              const activeCount = countStatus(room, 'in-progress');
              const flaggedCount = countStatus(room, 'review') + countStatus(room, 'disconnected');
              const ended = room.status === 'completed' || room.status === 'closed';
              const active = room.status === 'open';
              const startsAt = new Date(room.startsAt).getTime();
              const hasStarted = Number.isFinite(startsAt) && now >= startsAt;
              const countdownTarget = !ended
                ? hasStarted ? startsAt + room.durationMinutes * 60_000 : startsAt
                : null;
              return <article key={room.id} className="group relative flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
                <div className="flex items-center justify-between gap-2 pr-1">
                  <span className="min-w-0 text-xl font-black leading-7 text-slate-950 sm:text-2xl">{room.examSnapshot.subject}</span>
                  <button type="button" aria-label={`Xóa phòng ${room.title}`} onClick={() => deleteRoom(room)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 group-hover:opacity-100 sm:opacity-0"><Trash2 className="h-4 w-4" /></button>
                </div>
                <h3 className="mt-2 line-clamp-2 text-base font-extrabold leading-5 text-slate-900">{room.title}</h3>
                <p className="mt-1 text-xs text-slate-600">Mã phòng: <strong className="text-sm font-extrabold tracking-wide text-slate-900">{roomCode(room)}</strong></p>
                <div className="mt-2 flex min-h-[108px] flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-2"><span className={`inline-flex min-w-0 items-center gap-1.5 text-sm font-bold ${roomStatusTextStyles[room.status]}`}><CalendarClock className="h-4 w-4 shrink-0" />{room.status === 'open' ? 'Đang mở' : roomStatusLabels[room.status]}</span><span className="shrink-0 text-sm font-extrabold text-slate-800">{dateLabel(room.startsAt)}</span></div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span><Clock3 className="mr-1 inline h-3.5 w-3.5" />{room.durationMinutes} phút ({examTimeRange(room.startsAt, room.durationMinutes)})</span>
                    <span><Users className="mr-1 inline h-3.5 w-3.5" />{activeCount} đang làm - {submittedCount}/{room.studentCount} nộp</span>
                  </div>
                  {countdownTarget !== null && Number.isFinite(countdownTarget) && (
                    <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-center">
                      <p className={`text-xs font-semibold ${hasStarted ? 'text-emerald-700' : 'text-blue-700'}`}>
                        {hasStarted ? 'Thời gian làm bài còn' : 'Mở phòng sau'}
                      </p>
                      <p aria-label={`${hasStarted ? 'Thời gian làm bài còn' : 'Mở phòng sau'} ${countdownLabel(countdownTarget, now)}`} className={`mt-0.5 font-mono text-2xl font-black leading-tight tabular-nums sm:text-3xl ${hasStarted ? 'text-emerald-600' : 'text-blue-700'}`}>
                        {countdownLabel(countdownTarget, now)}
                      </p>
                    </div>
                  )}
                  <div className="min-h-4">
                    <span className={`font-medium ${flaggedCount > 0 ? 'text-amber-700' : 'text-slate-400'}`}><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{flaggedCount} cần xem</span>
                  </div>
                </div>
                <div className="mt-auto pt-3">
                  <button
                    type="button"
                    onClick={() => room.status === 'scheduled' || room.status === 'draft' ? onEditDraft(room) : openRoom(room)}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${active ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {active ? <Eye className="h-4 w-4" /> : null}
                    {active ? 'Xem phòng' : ended ? 'Kiểm tra thông tin phòng' : 'Cài đặt phòng'}
                  </button>
                </div>
              </article>;
            })}
          </div>
        )}
      </section>
    </main>
  );
}
