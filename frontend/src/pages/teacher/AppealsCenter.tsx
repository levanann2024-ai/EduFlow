import { useState } from 'react';
import { AlertTriangle, Check, Clock3, FileText, History, RotateCcw, ShieldAlert, UserRoundCheck, X } from 'lucide-react';

type AppealStatus = 'Chờ xử lý' | 'Đã xử lý';
type AppealAction = 'resume' | 'reopen' | 'new-attempt' | 'new-variant' | 'reject';

interface AppealAuditEntry {
  action: AppealAction;
  label: string;
  at: string;
}

interface Appeal {
  id: string;
  student: string;
  className: string;
  exam: string;
  reason: string;
  activeTime: string;
  exitDuration: string;
  risk: 'Chưa đánh giá' | 'Thấp' | 'Cần xem xét';
  status: AppealStatus;
  evidence: string[];
  history: AppealAuditEntry[];
}

const demoAppeals: Appeal[] = [
  {
    id: 'demo-appeal-204',
    student: 'Trần Hà Linh',
    className: '10A1',
    exam: 'Ôn tập hàm số bậc hai',
    reason: 'Rời màn hình một lần',
    activeTime: '18 phút 42 giây',
    exitDuration: '7 giây',
    risk: 'Chưa đánh giá',
    status: 'Chờ xử lý',
    evidence: ['08:03 · Bắt đầu lượt làm bài', '08:11 · Rời màn hình trong thời gian ngắn', '08:11 · Quay lại phiên thi'],
    history: [],
  },
  {
    id: 'demo-appeal-203',
    student: 'Phạm Thu Trang',
    className: '10A1',
    exam: 'Ôn tập hàm số bậc hai',
    reason: 'Mất kết nối trong khi làm bài',
    activeTime: '14 phút 06 giây',
    exitDuration: 'Chưa xác định',
    risk: 'Cần xem xét',
    status: 'Chờ xử lý',
    evidence: ['08:01 · Bắt đầu lượt làm bài', '08:09 · Mất kết nối · dữ liệu mạng minh họa'],
    history: [],
  },
];

const actionLabels: Record<AppealAction, string> = {
  resume: 'Cho tiếp tục phiên hiện tại',
  reopen: 'Mở lại quyền làm bài',
  'new-attempt': 'Tạo lượt thi mới',
  'new-variant': 'Cấp đề thi khác',
  reject: 'Từ chối yêu cầu',
};

export function AppealsCenter() {
  const [appeals, setAppeals] = useState(demoAppeals);
  const [selectedId, setSelectedId] = useState(demoAppeals[0]?.id ?? '');
  const [confirmation, setConfirmation] = useState<{ appealId: string; action: AppealAction } | null>(null);
  const [feedback, setFeedback] = useState('');
  const selected = appeals.find((appeal) => appeal.id === selectedId) ?? appeals[0];

  const resolve = () => {
    if (!selected || !confirmation || confirmation.appealId !== selected.id) return;
    const { action } = confirmation;
    const audit: AppealAuditEntry = {
      action,
      label: actionLabels[action],
      at: new Date().toLocaleString('vi-VN'),
    };
    setAppeals((current) => current.map((appeal) => appeal.id === selected.id
      ? { ...appeal, status: 'Đã xử lý', history: [...appeal.history, audit] }
      : appeal));
    setFeedback(`${actionLabels[action]} · thao tác minh họa trong phiên này, chưa gửi lên máy chủ.`);
    setConfirmation(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-5 text-violet-950"><strong>Dữ liệu sự cố minh họa.</strong> Quyết định được giữ tạm trong trạng thái giao diện, không cập nhật phiên thi hay audit log server.</div>
      {feedback && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{feedback}</p>}
      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-4"><h2 className="font-semibold text-slate-900">Yêu cầu cần xem</h2><p className="mt-1 text-sm text-slate-500">{appeals.filter((item) => item.status === 'Chờ xử lý').length} đang chờ · demo</p></header>
          <div className="divide-y divide-slate-100">
            {appeals.map((appeal) => <button key={appeal.id} type="button" onClick={() => { setSelectedId(appeal.id); setFeedback(''); }} className={`w-full px-4 py-4 text-left transition hover:bg-slate-50 ${selected?.id === appeal.id ? 'bg-blue-50/70' : ''}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{appeal.student}</p><p className="mt-1 text-sm text-slate-500">{appeal.className} · {appeal.exam}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${appeal.status === 'Chờ xử lý' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{appeal.status}</span></div>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-700"><ShieldAlert className="h-4 w-4 text-amber-600" />{appeal.reason}</p>
            </button>)}
          </div>
        </section>

        {selected ? <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-500">Yêu cầu {selected.id.replace('demo-appeal-', '')} · minh họa</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{selected.student}</h2><p className="mt-1 text-sm text-slate-500">{selected.exam} · {selected.className}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${selected.risk === 'Cần xem xét' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'}`}><AlertTriangle className="h-4 w-4" />{selected.risk}</span></div>
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
            <div className="flex items-center gap-2 font-semibold text-violet-950"><FileText className="h-4 w-4" /> Dữ liệu phiên (mẫu)</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-slate-500">Thời gian làm bài</p><p className="mt-1 font-semibold text-slate-900">{selected.activeTime}</p></div><div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-slate-500">Rời màn hình / mất kết nối</p><p className="mt-1 font-semibold text-slate-900">{selected.exitDuration}</p></div><div className="rounded-lg bg-white/80 p-3"><p className="text-xs text-slate-500">Đánh giá giáo viên</p><p className="mt-1 font-semibold text-slate-900">{selected.risk}</p></div></div>
            <p className="mt-3 text-sm leading-6 text-slate-700">Sự kiện là dữ liệu minh họa để xem xét. Một lần rời màn hình không tự động quy thành vi phạm hoặc điểm 0.</p>
            <ol className="mt-3 space-y-2">{selected.evidence.map((event) => <li key={event} className="rounded-lg bg-white/80 px-3 py-2 text-sm text-slate-700">{event}</li>)}</ol>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-slate-900">Chọn cách xử lý</h3>
            <p className="mb-3 text-sm text-slate-500">Các lựa chọn mô phỏng có ý nghĩa riêng; không thay đổi lượt thi thật.</p>
            {selected.status === 'Chờ xử lý' ? <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setConfirmation({ appealId: selected.id, action: 'resume' })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"><Check className="h-4 w-4" /> Cho tiếp tục phiên</button>
              <button type="button" onClick={() => setConfirmation({ appealId: selected.id, action: 'reopen' })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"><UserRoundCheck className="h-4 w-4" /> Mở lại quyền làm bài</button>
              <button type="button" onClick={() => setConfirmation({ appealId: selected.id, action: 'new-attempt' })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-100"><RotateCcw className="h-4 w-4" /> Tạo lượt thi mới</button>
              <button type="button" onClick={() => setConfirmation({ appealId: selected.id, action: 'new-variant' })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 px-3 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50"><FileText className="h-4 w-4" /> Cấp đề thi khác</button>
              <button type="button" onClick={() => setConfirmation({ appealId: selected.id, action: 'reject' })} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 sm:col-span-2"><X className="h-4 w-4" /> Từ chối yêu cầu</button>
            </div> : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><Check className="mr-1.5 inline h-4 w-4 text-emerald-700" />Yêu cầu đã được xử lý trong demo.</p>}
          </div>
          <div className="rounded-xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-semibold text-slate-900"><History className="h-4 w-4" /> Lịch sử quyết định</h3>{selected.history.length ? <ol className="mt-3 space-y-2">{selected.history.map((entry, index) => <li key={`${entry.at}-${index}`} className="flex flex-wrap justify-between gap-2 text-sm"><span>{entry.label}</span><time className="text-slate-500">{entry.at}</time></li>)}</ol> : <p className="mt-2 text-sm text-slate-500">Chưa có quyết định trong phiên demo này.</p>}</div>
        </section> : <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Chưa có yêu cầu.</div>}
      </div>

      {confirmation && selected && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onClick={() => setConfirmation(null)}><section role="dialog" aria-modal="true" aria-labelledby="appeal-confirm-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h2 id="appeal-confirm-title" className="text-lg font-semibold text-slate-950">Xác nhận xử lý</h2><p className="mt-2 text-sm leading-6 text-slate-600"><strong>{actionLabels[confirmation.action]}</strong> cho {selected.student}. Đây là tương tác demo; phiên thi thật không bị thay đổi.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmation(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Hủy</button><button type="button" onClick={resolve} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Clock3 className="mr-1 inline h-4 w-4" /> Xác nhận demo</button></div></section></div>}
    </div>
  );
}
