import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Maximize, Mic, ShieldAlert, Video, X } from 'lucide-react';

interface PreExamCheckModalProps {
  examTitle: string;
  roomCode: string;
  durationMinutes: number;
  instructions: string;
  requireCamera: boolean;
  requireMicrophone: boolean;
  monitorTabSwitch: boolean;
  allowBackNavigation: boolean;
  allowEarlySubmit: boolean;
  onClose: () => void;
  onStart: (stream: MediaStream) => Promise<void>;
}

export function PreExamCheckModal({
  examTitle,
  roomCode,
  durationMinutes,
  instructions,
  requireCamera,
  requireMicrophone,
  monitorTabSwitch,
  allowBackNavigation,
  allowEarlySubmit,
  onClose,
  onStart,
}: PreExamCheckModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamTransferred = useRef(false);
  const permissionGranted = (!requireCamera || cameraReady) && (!requireMicrophone || microphoneReady);

  useEffect(() => {
    if (videoRef.current && stream && requireCamera) videoRef.current.srcObject = stream;
  }, [requireCamera, stream]);

  useEffect(() => () => {
    if (!streamTransferred.current) stream?.getTracks().forEach((track) => track.stop());
  }, [stream]);

  const requestDevices = async () => {
    setError('');
    try {
      if (!requireCamera && !requireMicrophone) return;
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Trình duyệt hiện tại không hỗ trợ kiểm tra thiết bị.');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: requireCamera,
        audio: requireMicrophone,
      });
      stream?.getTracks().forEach((track) => track.stop());
      setStream(mediaStream);
      setCameraReady(!requireCamera || mediaStream.getVideoTracks().some((track) => track.readyState === 'live'));
      setMicrophoneReady(!requireMicrophone || mediaStream.getAudioTracks().some((track) => track.readyState === 'live'));
    } catch (deviceError) {
      const reason = deviceError instanceof Error && deviceError.name === 'NotAllowedError'
        ? 'Em cần cấp quyền thiết bị mà giáo viên yêu cầu trong trình duyệt để tiếp tục.'
        : deviceError instanceof Error && deviceError.name === 'NotFoundError'
          ? 'Không tìm thấy thiết bị được yêu cầu. Hãy kết nối thiết bị rồi thử lại.'
          : deviceError instanceof Error
            ? deviceError.message
            : 'Không thể kiểm tra thiết bị.';
      setError(reason);
      setCameraReady(false);
      setMicrophoneReady(false);
    }
  };

  const startExam = async () => {
    if (!permissionGranted) {
      setError('Hãy kiểm tra và cấp quyền cho thiết bị giáo viên yêu cầu trước khi bắt đầu.');
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
    try {
      await onStart(stream ?? new MediaStream());
      streamTransferred.current = true;
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Không thể bắt đầu phiên thi.');
      setStarting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[2147483002] flex h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="pre-exam-title" className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">EduFlow - Phòng thi an toàn</p>
            <h2 id="pre-exam-title" className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">Quy định làm bài &amp; kiểm tra thiết bị</h2>
            <p className="mt-1 text-sm text-slate-500">{examTitle} · Mã phòng: <strong>{roomCode}</strong></p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </header>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section aria-label="Quy định thi">
            <h3 className="font-semibold text-slate-900">Trước khi bắt đầu, em hãy lưu ý</h3>
            <div className="mt-3 space-y-2">
              {[
                {
                  title: 'Làm bài trong thời gian quy định',
                  detail: `${durationMinutes} phút kể từ lúc bắt đầu. ${monitorTabSwitch ? 'Chuyển tab hoặc rời màn hình được ghi nhận để giáo viên xem xét, không tự động nộp bài.' : 'Không bật ghi nhận chuyển tab.'}`,
                  icon: Maximize,
                },
                {
                  title: 'Không sử dụng tài liệu ngoài',
                  detail: instructions || 'Chỉ sử dụng nội dung và công cụ được phép trong bài thi.',
                  icon: ShieldAlert,
                },
                ...(requireMicrophone ? [{
                  title: 'Cho phép kiểm tra micro',
                  detail: 'Micro chỉ được kiểm tra trên thiết bị; EduFlow không ghi âm hay tải âm thanh lên.',
                  icon: Mic,
                }] : []),
                ...(requireCamera ? [{
                  title: 'Cho phép kiểm tra webcam',
                  detail: 'Webcam chỉ hiện bản xem trước trên thiết bị; không ghi hình hoặc truyền video.',
                  icon: Video,
                }] : []),
                {
                  title: allowBackNavigation ? 'Có thể quay lại câu trước' : 'Không thể quay lại câu trước',
                  detail: allowEarlySubmit ? 'Có thể nộp bài sớm sau khi hoàn tất.' : 'Chỉ nộp bài khi hết thời gian.',
                  icon: ShieldAlert,
                },
              ].map(({ title, detail, icon: Icon }, index) => (
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
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {requireCamera || requireMicrophone
                  ? `Phòng thi yêu cầu ${[requireCamera && 'webcam', requireMicrophone && 'micro'].filter(Boolean).join(' và ')}. Chỉ kiểm tra quyền truy cập, không kết nối nhận diện AI.`
                  : 'Phòng thi không yêu cầu webcam hoặc micro.'}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-slate-950">
              {stream && requireCamera ? (
                <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-2 text-slate-400">
                  <Video className="h-8 w-8" />
                  <span className="text-xs">{requireCamera ? 'Webcam chưa được kiểm tra' : 'Không yêu cầu webcam'}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium ${permissionGranted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                <Video className="h-4 w-4" /> Webcam {requireCamera ? cameraReady ? 'sẵn sàng' : 'chưa kiểm tra' : 'không yêu cầu'}
                {cameraReady && requireCamera && <Check className="ml-auto h-4 w-4" />}
              </div>
              <div className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium ${permissionGranted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                <Mic className="h-4 w-4" /> Micro {requireMicrophone ? microphoneReady ? 'sẵn sàng' : 'chưa kiểm tra' : 'không yêu cầu'}
                {microphoneReady && requireMicrophone && <Check className="ml-auto h-4 w-4" />}
              </div>
            </div>
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-4 text-blue-800">
              Kiểm tra này chỉ xác nhận quyền truy cập webcam/micro trên thiết bị. Không ghi âm, ghi hình hay kết nối nhận diện AI.
            </p>
            {!permissionGranted && (requireCamera || requireMicrophone) && (
              <button type="button" onClick={() => void requestDevices()} className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
                Kiểm tra {requireCamera && requireMicrophone ? 'webcam & micro' : requireCamera ? 'webcam' : 'micro'}
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
