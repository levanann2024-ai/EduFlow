import { useState } from 'react';
import { AlertTriangle, Check, Clock3, Eye, RotateCcw, X } from 'lucide-react';

type ExamStatus = 'Đang thi' | 'Tự nộp · vi phạm' | 'Đã hoàn thành';

interface ExamSession {
  id: string;
  student: string;
  className: string;
  exam: string;
  remaining: string;
  status: ExamStatus;
  events: string[];
}

const startingSessions: ExamSession[] = [
  { id: 'S-101', student: 'Nguyễn Minh Khôi', className: '10A1', exam: 'Kiểm tra chương 2', remaining: '18:24', status: 'Đang thi', events: ['08:02 · Bắt đầu bài thi', '08:14 · Đang ở toàn màn hình'] },
  { id: 'S-102', student: 'Trần Hà Linh', className: '10A1', exam: 'Kiểm tra chương 2', remaining: '12:08', status: 'Đang thi', events: ['08:03 · Bắt đầu bài thi', '08:11 · Đã lưu câu trả lời'] },
  { id: 'S-103', student: 'Lê Quốc Bảo', className: '10A1', exam: 'Kiểm tra chương 2', remaining: '00:00', status: 'Tự nộp · vi phạm', events: ['08:01 · Bắt đầu bài thi', '08:12 · Chuyển tab', '08:13 · Tự nộp bài, ghi nhận 0 điểm'] },
  { id: 'S-104', student: 'Phạm Thu Trang', className: '10A1', exam: 'Kiểm tra chương 2', remaining: 'Đã nộp', status: 'Đã hoàn thành', events: ['08:00 · Bắt đầu bài thi', '08:17 · Nộp bài'] },
];

export function ExamMonitor() {
  const [sessions, setSessions] = useState(startingSessions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sessions.find((session) => session.id === selectedId);
  const activeCount = sessions.filter((session) => session.status === 'Đang thi').length;

  const approveRetake = (sessionId: string) => {
    setSessions((items) => items.map((item) => item.id === sessionId
      ? { ...item, status: 'Đang thi', remaining: '30:00', events: [...item.events, 'Giáo viên duyệt làm lại · Mã đề mới'] }
      : item));
    setSelectedId(null);
  };

  return (
    <main className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-950">Giám sát phòng thi</h1>
            <p className="mt-1 text-sm text-slate-500">Kiểm tra chương 2 · Lớp 10A1</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {activeCount} đang thi</span>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {sessions.map((session) => {
            const flagged = session.status === 'Tự nộp · vi phạm';
            const done = session.status === 'Đã hoàn thành';
            return (
              <button key={session.id} onClick={() => setSelectedId(session.id)} className={`rounded-xl border p-4 text-left transition hover:shadow-sm ${flagged ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{session.student}</p>
                    <p className="mt-1 text-sm text-slate-500">{session.className} · {session.id}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${flagged ? 'bg-rose-100 text-rose-800' : done ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${flagged ? 'bg-rose-600' : done ? 'bg-slate-500' : 'bg-emerald-600'}`} />{session.status}
                  </span>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <span className="text-slate-500">{flagged ? <><AlertTriangle className="mr-1 inline h-4 w-4 text-rose-600" /> Vi phạm giám sát</> : done ? 'Đã nộp bài' : <><Clock3 className="mr-1 inline h-4 w-4" /> Còn {session.remaining}</>}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-blue-700"><Eye className="h-4 w-4" /> Nhật ký</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/35" onClick={() => setSelectedId(null)}>
          <aside role="dialog" aria-modal="true" aria-label={`Nhật ký thi ${selected.student}`} onClick={(event) => event.stopPropagation()} className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-5">
              <div>
                <p className="text-sm text-slate-500">Nhật ký phiên thi</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{selected.student}</h2>
                <p className="mt-1 text-sm text-slate-500">{selected.exam} · {selected.className}</p>
              </div>
              <button onClick={() => setSelectedId(null)} aria-label="Đóng nhật ký" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <h3 className="font-semibold text-slate-900">Sự kiện</h3>
              <ol className="space-y-3">{selected.events.map((event) => <li key={event} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">{event}</li>)}</ol>
              {selected.status === 'Tự nộp · vi phạm' && <p className="rounded-xl bg-rose-50 p-3 text-sm leading-5 text-rose-800"><AlertTriangle className="mr-1.5 inline h-4 w-4" />Bài thi đã tự nộp sau khi phát hiện chuyển tab. Có thể cấp lượt thi mới.</p>}
            </div>
            {selected.status === 'Tự nộp · vi phạm' && <div className="border-t border-slate-100 p-5"><button onClick={() => approveRetake(selected.id)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"><RotateCcw className="h-4 w-4" /><Check className="h-4 w-4" /> Duyệt thi lại, tạo mã đề mới</button></div>}
          </aside>
        </div>
      )}
    </main>
  );
}
