import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  CalendarClock,
  Clock3,
  Eye,
  Play,
  Users,
  X,
} from 'lucide-react';
import type { ExamRoomRecord, ExamRoomStatus, ExamSessionStatus } from './examRoomDemoData';

const roomStatusLabels: Record<ExamRoomStatus, string> = {
  draft: 'Bản nháp',
  scheduled: 'Sắp diễn ra',
  open: 'Đang mở',
  closed: 'Đã đóng',
  completed: 'Đã hoàn thành',
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

const roomStatusStyles: Record<ExamRoomStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-amber-50 text-amber-800',
  open: 'bg-emerald-50 text-emerald-800',
  closed: 'bg-slate-100 text-slate-700',
  completed: 'bg-blue-50 text-blue-800',
};

type DetailTab = 'overview' | 'monitor' | 'results' | 'events';
type SessionFilter = 'all' | ExamSessionStatus;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function countStatus(room: ExamRoomRecord, status: ExamSessionStatus) {
  return room.sessions.filter((session) => session.status === status).length;
}

export function ExamMonitor({
  rooms,
  onCreateRoom,
  onEditDraft,
  onUpdateRoom,
  onOpenAppeals,
  openRoomId,
}: {
  rooms: ExamRoomRecord[];
  onCreateRoom: () => void;
  onEditDraft: (room: ExamRoomRecord) => void;
  onUpdateRoom: (room: ExamRoomRecord) => void;
  onOpenAppeals: () => void;
  openRoomId: string | null;
}) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [roomFilter, setRoomFilter] = useState<'all' | ExamRoomStatus>('all');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const selectedSession = selectedRoom?.sessions.find((session) => session.id === selectedSessionId);
  const filteredRooms = useMemo(
    () => rooms.filter((room) => roomFilter === 'all' || room.status === roomFilter),
    [roomFilter, rooms],
  );
  const visibleSessions = selectedRoom?.sessions.filter((session) => sessionFilter === 'all' || session.status === sessionFilter) ?? [];

  useEffect(() => {
    if (openRoomId) setSelectedRoomId(openRoomId);
  }, [openRoomId]);

  const updateStatus = (room: ExamRoomRecord, status: ExamRoomStatus) => {
    if (status === 'closed' && !window.confirm(`Đóng phòng "${room.title}"? Đây chỉ là thao tác mô phỏng.`)) return;
    onUpdateRoom({ ...room, status });
  };

  if (selectedRoom) {
    const tabs: { id: DetailTab; label: string }[] = [
      { id: 'overview', label: 'Tổng quan' },
      { id: 'monitor', label: 'Giám sát trực tiếp' },
      { id: 'results', label: 'Kết quả' },
      { id: 'events', label: 'Nhật ký' },
    ];
    const hasGrading = selectedRoom.sessions.some((session) => session.needsManualGrading > 0);
    const canStart = selectedRoom.status === 'scheduled';
    return (
      <main className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => { setSelectedRoomId(null); setSelectedSessionId(null); }} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Danh sách phòng</button>
          <div className="flex flex-wrap gap-2">
            {selectedRoom.status === 'draft' && <button type="button" onClick={() => onEditDraft(selectedRoom)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white">Tiếp tục cấu hình</button>}
            {canStart && <button type="button" onClick={() => updateStatus(selectedRoom, 'open')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Play className="h-4 w-4" /> Mở phòng sớm</button>}
            {selectedRoom.status === 'open' && <button type="button" onClick={() => updateStatus(selectedRoom, 'closed')} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Đóng phòng</button>}
          </div>
        </div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold text-slate-950">{selectedRoom.title}</h1><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roomStatusStyles[selectedRoom.status]}`}>{roomStatusLabels[selectedRoom.status]}</span><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">Demo</span></div>
              <p className="mt-1 text-sm text-slate-500">{selectedRoom.examSnapshot.title} · {selectedRoom.classNames.join(', ')}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600"><Users className="h-4 w-4" />{selectedRoom.sessions.length}/{selectedRoom.studentCount} mẫu tham gia</div>
          </header>
          <nav className="flex flex-wrap gap-1 border-b border-slate-100 px-3 pt-2">
            {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setDetailTab(tab.id)} className={`rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-semibold ${detailTab === tab.id ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab.label}</button>)}
          </nav>

          {detailTab === 'overview' && (
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <article className="rounded-xl border border-slate-200 p-4"><h2 className="font-semibold text-slate-900">Lịch thi</h2><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Mở phòng</dt><dd className="text-right">{dateLabel(selectedRoom.opensAt)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Bắt đầu</dt><dd className="text-right">{dateLabel(selectedRoom.startsAt)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Hạn kết thúc</dt><dd className="text-right">{dateLabel(selectedRoom.endsAt)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Thời lượng/lượt</dt><dd>{selectedRoom.durationMinutes} phút</dd></div></dl></article>
              <article className="rounded-xl border border-slate-200 p-4"><h2 className="font-semibold text-slate-900">Đề thi</h2><p className="mt-2 font-medium text-slate-800">{selectedRoom.examSnapshot.title}</p><p className="mt-1 text-sm text-slate-500">{selectedRoom.examSnapshot.subject} · {selectedRoom.examSnapshot.grade} · {selectedRoom.examSnapshot.questions.length} câu · {selectedRoom.examSnapshot.questions.reduce((sum, q) => sum + q.points, 0)} điểm</p><p className="mt-3 text-sm text-slate-600">{selectedRoom.instructions || 'Chưa có hướng dẫn.'}</p></article>
              <article className="rounded-xl border border-slate-200 p-4"><h2 className="font-semibold text-slate-900">Tiến độ học sinh (mẫu)</h2><div className="mt-3 grid grid-cols-2 gap-2 text-sm">{(['not-started', 'in-progress', 'submitted', 'review'] as const).map((status) => <p key={status} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span>{sessionStatusLabels[status]}</span><strong>{countStatus(selectedRoom, status)}</strong></p>)}</div></article>
              <article className="rounded-xl border border-slate-200 p-4"><h2 className="font-semibold text-slate-900">Quy tắc và giám sát</h2><p className="mt-2 text-sm leading-6 text-slate-600">{selectedRoom.settings.maxAttempts} lượt · {selectedRoom.settings.allowLateEntry ? 'Cho vào muộn' : 'Không vào muộn'} · {selectedRoom.settings.monitorTabSwitch ? 'Có cấu hình ghi nhận chuyển tab' : 'Không ghi nhận chuyển tab'} · {selectedRoom.settings.monitorConnection ? 'Có cấu hình trạng thái kết nối' : 'Không theo dõi kết nối'}</p><p className="mt-3 text-xs text-violet-800">Thiết lập giao diện chưa được backend thực thi.</p></article>
            </div>
          )}

          {detailTab === 'monitor' && (
            <section className="p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Danh sách phiên</h2><p className="text-sm text-slate-500">Học sinh hiển thị là dữ liệu minh họa, không phải phiên kết nối trực tiếp.</p></div><select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value as SessionFilter)} className="input-field w-auto"><option value="all">Mọi trạng thái</option>{Object.entries(sessionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              {visibleSessions.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Chưa có phiên ở trạng thái này.</p> : (
                <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Học sinh</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Còn lại</th><th className="px-4 py-3">Sự kiện</th><th className="px-4 py-3">Cảnh báo</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{visibleSessions.map((session) => <tr key={session.id}><td className="px-4 py-3"><p className="font-semibold text-slate-900">{session.studentName}</p><p className="text-xs text-slate-500">{session.className}</p></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sessionStatusStyles[session.status]}`}>{sessionStatusLabels[session.status]}</span></td><td className="px-4 py-3">{session.remainingMinutes === null ? '—' : `${session.remainingMinutes} phút`}</td><td className="px-4 py-3">{session.eventCount}</td><td className="px-4 py-3">{session.risk === 'none' ? <span className="text-slate-400">Không có</span> : <span className={session.risk === 'review' ? 'font-semibold text-rose-700' : 'text-amber-700'}>{session.risk === 'review' ? 'Cần xem xét' : 'Cảnh báo'}</span>}</td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedSessionId(session.id)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-blue-700 hover:bg-blue-50"><Eye className="h-4 w-4" /> Chi tiết</button></td></tr>)}</tbody></table></div>
              )}
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Sự kiện chỉ là ví dụ UI. Không có camera, theo dõi trình duyệt nền hoặc giám sát thời gian thực trong bản demo này.</p>
            </section>
          )}

          {detailTab === 'results' && (
            <section className="p-4">
              <div className="mb-4"><h2 className="font-semibold text-slate-900">Bài nộp và kết quả</h2><p className="text-sm text-slate-500">Điểm dưới đây là mẫu giao diện, không phải kết quả đã chấm.</p></div>
              <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Học sinh</th><th className="px-4 py-3">Trạng thái nộp</th><th className="px-4 py-3">Điểm mẫu</th><th className="px-4 py-3">Cần chấm thủ công</th><th className="px-4 py-3">Phiên</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedRoom.sessions.map((session) => <tr key={session.id}><td className="px-4 py-3 font-medium text-slate-900">{session.studentName}</td><td className="px-4 py-3">{session.submittedAt ? dateLabel(session.submittedAt) : sessionStatusLabels[session.status]}</td><td className="px-4 py-3">{session.score === null ? '—' : `${session.score}/10`}</td><td className="px-4 py-3">{session.needsManualGrading || '—'}</td><td className="px-4 py-3">{sessionStatusLabels[session.status]}</td></tr>)}</tbody></table></div>
              {hasGrading && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Có câu tự luận trong bài nộp demo cần giáo viên chấm.</p>}
            </section>
          )}

          {detailTab === 'events' && (
            <section className="p-4"><h2 className="mb-3 font-semibold text-slate-900">Nhật ký sự kiện (mẫu)</h2>{selectedRoom.sessions.flatMap((session) => session.events.map((event) => ({ ...event, studentName: session.studentName }))).length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Chưa có sự kiện.</p> : <ol className="space-y-2">{selectedRoom.sessions.flatMap((session) => session.events.map((event) => ({ ...event, studentName: session.studentName }))).map((event) => <li key={event.id} className={`flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm ${event.kind === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}><span>{event.studentName} · {event.label}</span><time className="text-slate-500">{event.at}</time></li>)}</ol>}</section>
          )}
        </section>

        {selectedSession && (
          <div className="fixed inset-0 z-[75] flex justify-end bg-slate-950/35" onClick={() => setSelectedSessionId(null)}>
            <aside role="dialog" aria-modal="true" aria-label={`Phiên thi của ${selectedSession.studentName}`} onClick={(event) => event.stopPropagation()} className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
              <header className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="text-xs text-slate-500">Phiên minh họa</p><h2 className="mt-1 font-semibold text-slate-950">{selectedSession.studentName}</h2><p className="mt-1 text-sm text-slate-500">{selectedSession.className} · {sessionStatusLabels[selectedSession.status]}</p></div><button type="button" onClick={() => setSelectedSessionId(null)} aria-label="Đóng chi tiết" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
              <div className="flex-1 space-y-4 overflow-y-auto p-5"><div className="grid grid-cols-2 gap-2"><p className="rounded-lg bg-slate-50 p-3 text-sm"><span className="block text-xs text-slate-500">Thời gian còn</span>{selectedSession.remainingMinutes === null ? '—' : `${selectedSession.remainingMinutes} phút`}</p><p className="rounded-lg bg-slate-50 p-3 text-sm"><span className="block text-xs text-slate-500">Sự kiện</span>{selectedSession.eventCount}</p></div><h3 className="font-semibold text-slate-900">Hoạt động ghi nhận</h3>{selectedSession.events.length ? <ol className="space-y-2">{selectedSession.events.map((event) => <li key={event.id} className={`rounded-lg border p-3 text-sm ${event.kind === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700'}`}><span className="mr-2 text-xs text-slate-500">{event.at}</span>{event.label}</li>)}</ol> : <p className="text-sm text-slate-500">Chưa có sự kiện trong dữ liệu demo.</p>}<p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Một cảnh báo đơn lẻ không tự động tạo điểm 0. Giáo viên xem xét từng tình huống.</p></div>
              <footer className="border-t border-slate-100 p-4"><button type="button" onClick={() => { setSelectedSessionId(null); onOpenAppeals(); }} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Mở Kháng nghị & sự cố</button></footer>
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
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div><h2 className="font-semibold text-slate-950">Danh sách phòng thi</h2><p className="mt-0.5 text-xs text-slate-500">{rooms.length} phòng mẫu trong phiên này</p></div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">Trạng thái<select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value as typeof roomFilter)} className="input-field w-auto py-2"><option value="all">Tất cả</option>{Object.entries(roomStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </header>
        {filteredRooms.length === 0 ? <div className="p-12 text-center"><BookOpenCheck className="mx-auto h-8 w-8 text-slate-300" /><h2 className="mt-3 font-semibold text-slate-800">Chưa có phòng ở trạng thái này</h2><button type="button" onClick={onCreateRoom} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Tạo phòng demo</button></div> : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {filteredRooms.map((room) => {
              const submittedCount = countStatus(room, 'submitted');
              const activeCount = countStatus(room, 'in-progress');
              const flaggedCount = countStatus(room, 'review') + countStatus(room, 'disconnected');
              const ended = room.status === 'completed' || room.status === 'closed';
              const active = room.status === 'open';
              return <article key={room.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">{room.examSnapshot.subject}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${roomStatusStyles[room.status]}`}>{roomStatusLabels[room.status]}</span>
                </div>
                <h3 className="mt-3 line-clamp-2 min-h-12 text-base font-bold leading-6 text-slate-950">{room.title}</h3>
                <p className="mt-1 truncate text-sm text-slate-600">{room.examSnapshot.title} · {room.classNames.join(', ')}</p>
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-2"><span className="inline-flex min-w-0 items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 shrink-0" />{dateLabel(room.startsAt)}</span><span className="shrink-0 rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Demo</span></div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><span><Clock3 className="mr-1 inline h-3.5 w-3.5" />{room.durationMinutes} phút</span><span><Users className="mr-1 inline h-3.5 w-3.5" />{activeCount} đang làm · {submittedCount}/{room.studentCount} nộp</span>{flaggedCount > 0 && <span className="font-medium text-amber-700"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{flaggedCount} cần xem</span>}</div>
                </div>
                {room.status === 'draft' && <button type="button" onClick={() => onEditDraft(room)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Tiếp tục cấu hình</button>}
                <button
                  type="button"
                  onClick={() => openRoom(room)}
                  className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${active || ended ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  <Eye className="h-4 w-4" />{ended ? 'Kiểm tra' : 'Quản lý phòng'}
                </button>
              </article>;
            })}
          </div>
        )}
      </section>
    </main>
  );
}
