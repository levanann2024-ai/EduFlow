import { useState } from 'react';
import { AlertTriangle, Check, Clock3, FileText, RotateCcw, ShieldAlert, X } from 'lucide-react';

type AppealStatus = 'Chờ xử lý' | 'Đã duyệt' | 'Đã từ chối';
type AppealAction = 're-entry' | 'retry' | 'reject';

interface Appeal {
  id: string;
  student: string;
  className: string;
  exam: string;
  reason: string;
  activeTime: string;
  exitDuration: string;
  risk: 'Thấp' | 'Cao';
  status: AppealStatus;
}

const appealsStorageKey = 'eduflow-exam-appeals';

const demoAppeals: Appeal[] = [
  { id: 'A-204', student: 'Trần Hà Linh', className: '10A1', exam: 'Kiểm tra chương 2', reason: 'Rời toàn màn hình', activeTime: '18 phút 42 giây', exitDuration: '7 giây', risk: 'Thấp', status: 'Chờ xử lý' },
  { id: 'A-203', student: 'Lê Quốc Bảo', className: '11B3', exam: 'Vật lý giữa kỳ', reason: 'Chuyển tab 2 lần', activeTime: '26 phút 10 giây', exitDuration: '43 giây', risk: 'Cao', status: 'Chờ xử lý' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatDuration(seconds: unknown) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return 'Chưa có dữ liệu';
  const minutes = Math.floor(seconds / 60);
  return `${minutes} phút ${String(Math.floor(seconds % 60)).padStart(2, '0')} giây`;
}

function readAppeals(): Appeal[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(appealsStorageKey) ?? '[]');
    if (!Array.isArray(stored)) throw new Error('Danh sách phúc khảo không đúng định dạng.');
    const items = stored.flatMap((entry): Appeal[] => {
      if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.examTitle !== 'string' || typeof entry.reason !== 'string') return [];
      const attachments = isRecord(entry.attachments) ? entry.attachments : {};
      const evidence = isRecord(attachments.deviceAuditLog) ? attachments.deviceAuditLog : {};
      const status: AppealStatus = entry.teacherStatus === 'Đã duyệt' || entry.teacherStatus === 'Đã từ chối'
        ? entry.teacherStatus
        : 'Chờ xử lý';
      return [{
        id: entry.id,
        student: typeof entry.studentName === 'string' ? entry.studentName : 'Học sinh',
        className: typeof entry.className === 'string' ? entry.className : '—',
        exam: entry.examTitle,
        reason: entry.reason,
        activeTime: formatDuration(evidence.durationSeconds),
        exitDuration: formatDuration(evidence.totalOffscreenSeconds),
        risk: typeof evidence.totalOffscreenSeconds === 'number' && evidence.totalOffscreenSeconds < 15 ? 'Thấp' : 'Cao',
        status,
      }];
    });
    return items.length > 0 ? items : demoAppeals;
  } catch (error) {
    console.error('Không thể đọc danh sách phúc khảo trên thiết bị.', error);
    return demoAppeals;
  }
}

export function AppealsCenter() {
  const [appeals, setAppeals] = useState(readAppeals);
  const [selectedId, setSelectedId] = useState('');
  const [storageError, setStorageError] = useState('');
  const selected = appeals.find((appeal) => appeal.id === selectedId) ?? appeals[0];

  const resolveAppeal = (action: AppealAction) => {
    if (!selected) return;
    const status: AppealStatus = action === 'reject' ? 'Đã từ chối' : 'Đã duyệt';
    const nextAppeals = appeals.map((item) => item.id === selected.id ? { ...item, status } : item);
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(appealsStorageKey) ?? '[]');
      if (Array.isArray(stored)) {
        const updated = stored.map((entry) => isRecord(entry) && entry.id === selected.id
          ? { ...entry, teacherStatus: status, teacherAction: action, resolvedAt: new Date().toISOString() }
          : entry);
        localStorage.setItem(appealsStorageKey, JSON.stringify(updated));
      }
      setStorageError('');
      setAppeals(nextAppeals);
      window.dispatchEvent(new CustomEvent('eduflow-appeal-updated', { detail: { id: selected.id, status } }));
    } catch (error) {
      console.error('Không thể lưu quyết định phúc khảo trên thiết bị.', error);
      setStorageError('Không lưu được quyết định. Hãy kiểm tra quyền lưu trữ của trình duyệt rồi thử lại.');
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4">
          <h2 className="font-semibold text-slate-900">Yêu cầu cần xem</h2>
          <p className="mt-1 text-sm text-slate-500">{appeals.filter((item) => item.status === 'Chờ xử lý').length} đang chờ</p>
        </div>
        <div className="divide-y divide-slate-100">
          {appeals.map((appeal) => (
            <button key={appeal.id} onClick={() => setSelectedId(appeal.id)} className={`w-full px-4 py-4 text-left transition hover:bg-slate-50 ${selected?.id === appeal.id ? 'bg-blue-50/70' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{appeal.student}</p>
                  <p className="mt-1 text-sm text-slate-500">{appeal.className} · {appeal.exam}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${appeal.status === 'Chờ xử lý' ? 'bg-amber-50 text-amber-800' : appeal.status === 'Đã duyệt' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {appeal.status}
                </span>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-rose-700"><ShieldAlert className="h-4 w-4" />{appeal.reason} · 0 điểm</p>
            </button>
          ))}
        </div>
      </section>

      {selected ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Mã yêu cầu {selected.id}</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">{selected.student}</h2>
              <p className="mt-1 text-sm text-slate-500">{selected.exam} · {selected.className}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-800">
              <AlertTriangle className="h-4 w-4" /> 0 điểm tự động
            </span>
          </div>

          {storageError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{storageError}</p>}
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
            <div className="flex items-center gap-2 font-semibold text-violet-950"><FileText className="h-4 w-4" /> Dữ liệu phiên thi</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-slate-500">Thời gian làm bài</p><p className="mt-1 font-semibold text-slate-900">{selected.activeTime}</p></div>
              <div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-slate-500">Rời màn hình</p><p className="mt-1 font-semibold text-slate-900">{selected.exitDuration}</p></div>
              <div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-slate-500">Mức rủi ro</p><p className={`mt-1 font-semibold ${selected.risk === 'Thấp' ? 'text-emerald-700' : 'text-rose-700'}`}>{selected.risk}</p></div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">Ghi nhận: {selected.reason.toLowerCase()}. Thời lượng ngoài bài thi ngắn; chưa có dấu hiệu bất thường khác trong phiên.</p>
          </div>

          {selected.status === 'Chờ xử lý' ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button onClick={() => resolveAppeal('re-entry')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Check className="h-4 w-4" /> Cho vào thi lại</button>
              <button onClick={() => resolveAppeal('retry')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-100"><RotateCcw className="h-4 w-4" /> Tạo mã đề mới</button>
              <button onClick={() => resolveAppeal('reject')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"><X className="h-4 w-4" /> Từ chối</button>
            </div>
          ) : (
            <p className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"><Clock3 className="h-4 w-4" /> Đã cập nhật: {selected.status}. Trạng thái demo chỉ lưu trong phiên này.</p>
          )}
        </section>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Chưa có yêu cầu kháng nghị.</div>
      )}
    </div>
  );
}
