import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Maximize, Mic, ShieldAlert, Video, X } from 'lucide-react';

interface PreExamCheckModalProps {
  examTitle: string;
  onClose: () => void;
  onStart: (stream: MediaStream) => void;
}

const examRules = [
  { title: 'Không rời khỏi màn hình thi', detail: 'Chuyển tab, ứng dụng hoặc thoát toàn màn hình sẽ tự động nộp bài ngay ở lần đầu.', icon: Maximize },
  { title: 'Không sử dụng tài liệu ngoài', detail: 'Chỉ sử dụng nội dung và công cụ được cho phép trong đề thi.', icon: ShieldAlert },
  { title: 'Bật micro trong thời gian làm bài', detail: 'Micro được dùng theo dõi trạng thái thiết bị trong phiên thi này.', icon: Mic },
  { title: 'Giữ khuôn mặt trong khung hình', detail: 'Webcam cần hoạt động ổn định khi em đang làm bài.', icon: Video },
];

export function PreExamCheckModal({ examTitle, onClose, onStart }: PreExamCheckModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamTransferred = useRef(false);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => () => {
    if (!streamTransferred.current) stream?.getTracks().forEach((track) => track.stop());
  }, [stream]);

  const requestDevices = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt hiện tại không hỗ trợ kiểm tra webcam và micro.');
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream?.getTracks().forEach((track) => track.stop());
      setStream(mediaStream);
      setPermissionGranted(true);
    } catch (deviceError) {
      const reason = deviceError instanceof Error && deviceError.name === 'NotAllowedError'
        ? 'Em cần cấp quyền webcam và micro trong trình duyệt để tiếp tục.'
        : deviceError instanceof Error && deviceError.name === 'NotFoundError'
          ? 'Không tìm thấy webcam hoặc micro. Hãy kết nối thiết bị rồi thử lại.'
          : deviceError instanceof Error
            ? deviceError.message
            : 'Không thể kiểm tra webcam và micro.';
      setError(reason);
      setPermissionGranted(false);
    }
  };

  const startExam = async () => {
    if (!stream || !permissionGranted) {
      setError('Hãy kiểm tra và cấp quyền webcam, micro trước khi bắt đầu.');
      return;
    }
    setStarting(true);
    if (!document.fullscreenEnabled) {
      setError('Trình duyệt hiện tại không hỗ trợ chế độ toàn màn hình nên chưa thể bắt đầu bài thi.');
      setStarting(false);
      return;
    }
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        setError('Chưa bật được toàn màn hình. Hãy thử lại và cho phép trình duyệt mở chế độ toàn màn hình trước khi bắt đầu.');
        setStarting(false);
        return;
      }
    }
    streamTransferred.current = true;
    onStart(stream);
  };

  return createPortal(
    <div className="fixed inset-0 z-[2147483002] flex h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="pre-exam-title" className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">EduFlow · Phòng thi an toàn</p>
            <h2 id="pre-exam-title" className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">Quy định làm bài &amp; kiểm tra thiết bị</h2>
            <p className="mt-1 text-sm text-slate-500">{examTitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </header>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section aria-label="Quy định thi">
            <h3 className="font-semibold text-slate-900">Trước khi bắt đầu, em hãy lưu ý</h3>
            <div className="mt-3 space-y-2">
              {examRules.map(({ title, detail, icon: Icon }, index) => (
                <article key={title} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{index + 1}. {title}</h4>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section aria-label="Kiểm tra thiết bị" className="space-y-3">
            <div>
              <h3 className="font-semibold text-slate-900">Kiểm tra thiết bị</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Cho phép truy cập để xác nhận webcam và micro trước khi thi.</p>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-slate-950">
              {stream ? (
                <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-2 text-slate-400">
                  <Video className="h-8 w-8" />
                  <span className="text-xs">Webcam chưa được kiểm tra</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium ${permissionGranted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                <Video className="h-4 w-4" /> Webcam {permissionGranted ? 'sẵn sàng' : 'chưa kiểm tra'}
                {permissionGranted && <Check className="ml-auto h-4 w-4" />}
              </div>
              <div className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium ${permissionGranted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                <Mic className="h-4 w-4" /> Micro {permissionGranted ? 'sẵn sàng' : 'chưa kiểm tra'}
                {permissionGranted && <Check className="ml-auto h-4 w-4" />}
              </div>
            </div>
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-4 text-blue-800">
              Kiểm tra này xác nhận quyền truy cập thiết bị; nhận diện MediaPipe/AI chưa được kết nối trong bản demo.
            </p>
            {!permissionGranted && (
              <button type="button" onClick={() => void requestDevices()} className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
                Kiểm tra webcam &amp; micro
              </button>
            )}
            {error && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{error}</p>}
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-slate-500">Khi tiếp tục, em xác nhận đã đọc các quy định của phòng thi.</p>
          <button type="button" onClick={() => void startExam()} disabled={!permissionGranted || starting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Check className="h-4 w-4" /> Xác nhận &amp; Bắt đầu làm bài thi
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
