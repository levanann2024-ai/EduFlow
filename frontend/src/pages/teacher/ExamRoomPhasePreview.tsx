import { AlertTriangle, CheckCircle2, Clock3, Eye, FileCheck2, Wifi } from 'lucide-react';

export function ExamRoomPhasePreview({
  examTitle,
  durationMinutes,
  warningThreshold,
  onClose,
}: {
  examTitle: string;
  durationMinutes: number;
  warningThreshold: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-phase-preview-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Bản xem trước giao diện học sinh</p>
            <h2 id="exam-phase-preview-title" className="mt-1 text-xl font-bold text-slate-950">Ba giai đoạn của bài thi</h2>
            <p className="mt-1 text-sm text-slate-600">{examTitle || 'Đề thi'} · {durationMinutes} phút mỗi học sinh</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Đóng xem trước</button>
        </header>
        <div className="overflow-y-auto p-4 sm:p-6">
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Đây là mock để duyệt bố cục. Phiên học sinh, cảnh báo giáo viên và nhật ký hiện chưa được gửi/lưu vào database.
          </p>
          <div className="grid gap-4 xl:grid-cols-3">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 bg-blue-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">01 · Trước khi thi</p>
                <h3 className="mt-1 font-bold text-slate-950">Kiểm tra và xác nhận</h3>
              </header>
              <div className="space-y-4 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Phòng thi</p>
                  <p className="mt-1 font-semibold text-slate-900">{examTitle || 'Đề thi'}</p>
                  <p className="mt-1 text-sm text-slate-600">{durationMinutes} phút · 1 lượt làm bài</p>
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Kết nối mạng ổn định</p>
                  <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Đã đọc hướng dẫn làm bài</p>
                  <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><Eye className="h-4 w-4" /> Rời bài thi sẽ được ghi nhận</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-900">Trước khi bắt đầu</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Đóng các tab không liên quan, kiểm tra mạng và báo giáo viên nếu gặp sự cố. Không yêu cầu camera hoặc micro.</p>
                </div>
                <button type="button" className="w-full rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Bắt đầu làm bài</button>
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 bg-amber-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800">02 · Trong khi thi</p>
                <h3 className="mt-1 font-bold text-slate-950">Làm bài và nhận nhắc nhở</h3>
              </header>
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-3 text-white">
                  <span className="flex items-center gap-2 text-sm"><Clock3 className="h-4 w-4" /> Còn lại</span>
                  <strong className="font-mono text-lg">32:18</strong>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold text-blue-700">CÂU 4 / 12 · 1 ĐIỂM</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">Đồ thị hàm số bậc hai có trục đối xứng là đường thẳng nào?</p>
                  <div className="mt-3 space-y-2">
                    {['x = 0', 'y = 0', 'x = 1'].map((option, index) => (
                      <p key={option} className={`rounded-lg border px-3 py-2 text-sm ${index === 0 ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-700'}`}>{String.fromCharCode(65 + index)}. {option}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertTriangle className="h-4 w-4" /> Nhắc nhở · 2/{warningThreshold} sự kiện</p>
                  <p className="mt-1 text-xs leading-5 text-amber-900">Lần rời màn hình được ghi nhận. Bài thi vẫn tiếp tục; không tự động trừ điểm hoặc nộp bài.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500"><Wifi className="h-4 w-4" /> Mất kết nối sẽ được ghi vào nhật ký khi nối lại.</div>
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">03 · Sau khi thi</p>
                <h3 className="mt-1 font-bold text-slate-950">Xác nhận nộp và xem kết quả</h3>
              </header>
              <div className="space-y-4 p-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                  <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
                  <p className="mt-2 font-bold text-emerald-900">Đã nộp bài thành công</p>
                  <p className="mt-1 text-xs text-emerald-800">10:42 · Lưu ý: đây là dữ liệu mẫu</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-3"><strong className="block text-lg text-slate-900">10/12</strong><span className="text-xs text-slate-500">Đã trả lời</span></div>
                  <div className="rounded-lg bg-slate-50 p-3"><strong className="block text-lg text-slate-900">Chờ chấm</strong><span className="text-xs text-slate-500">Kết quả</span></div>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                  <p className="flex items-center gap-2 text-sm font-bold text-violet-900"><FileCheck2 className="h-4 w-4" /> Giáo viên xem nhật ký</p>
                  <p className="mt-1 text-xs leading-5 text-violet-900">Số lần chuyển tab, thời điểm và tình trạng kết nối được hiển thị trong mục “Cần xem xét” của phòng thi.</p>
                </div>
                <button type="button" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Xem bài đã nộp</button>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
