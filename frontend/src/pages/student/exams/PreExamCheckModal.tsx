import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Maximize, Mic, ShieldAlert, Video, X } from 'lucide-react';
import { useAppLanguage } from '@/i18n/AppLanguageContext';
import { t } from '@/i18n/i18n';

interface PreExamCheckModalProps {
  examTitle: string;
  roomCode: string;
  durationMinutes: number;
  instructions: string;
  requireCamera: boolean;
  requireMicrophone: boolean;
  monitorFace: boolean;
  monitorSpeech: boolean;
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
  monitorFace,
  monitorSpeech,
  monitorTabSwitch,
  allowBackNavigation,
  allowEarlySubmit,
  onClose,
  onStart,
}: PreExamCheckModalProps) {
  const language = useAppLanguage();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [microphoneReady, setMicrophoneReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamTransferred = useRef(false);
  const needsCamera = requireCamera || monitorFace;
  const needsMicrophone = requireMicrophone || monitorSpeech;
  const permissionGranted = (!needsCamera || cameraReady) && (!needsMicrophone || microphoneReady);

  useEffect(() => {
    if (videoRef.current && stream && needsCamera) videoRef.current.srcObject = stream;
  }, [needsCamera, stream]);

  useEffect(() => () => {
    if (!streamTransferred.current) stream?.getTracks().forEach((track) => track.stop());
  }, [stream]);

  const requestDevices = async () => {
    setError('');
    try {
      if (!needsCamera && !needsMicrophone) return;
      if (!navigator.mediaDevices?.getUserMedia) throw new Error(t(language, 'preExam.error.unsupported'));
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: needsCamera,
        audio: needsMicrophone,
      });
      stream?.getTracks().forEach((track) => track.stop());
      setStream(mediaStream);
      setCameraReady(!needsCamera || mediaStream.getVideoTracks().some((track) => track.readyState === 'live'));
      setMicrophoneReady(!needsMicrophone || mediaStream.getAudioTracks().some((track) => track.readyState === 'live'));
    } catch (deviceError) {
      const reason = deviceError instanceof Error && deviceError.name === 'NotAllowedError'
        ? t(language, 'preExam.error.permission')
        : deviceError instanceof Error && deviceError.name === 'NotFoundError'
          ? t(language, 'preExam.error.notFound')
          : deviceError instanceof Error
            ? deviceError.message
            : t(language, 'preExam.error.generic');
      setError(reason);
      setCameraReady(false);
      setMicrophoneReady(false);
    }
  };

  const startExam = async () => {
    if (!permissionGranted) {
      setError(t(language, 'preExam.error.checkBeforeStart'));
      return;
    }
    setStarting(true);
    if (!document.fullscreenEnabled) {
      setError(t(language, 'preExam.error.fullscreenUnsupported'));
      setStarting(false);
      return;
    }
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        setError(t(language, 'preExam.error.fullscreen'));
        setStarting(false);
        return;
      }
    }
    try {
      await onStart(stream ?? new MediaStream());
      streamTransferred.current = true;
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : t(language, 'preExam.error.start'));
      setStarting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[2147483002] flex h-dvh w-screen items-center justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="pre-exam-title" className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">{t(language, 'preExam.title')}</p>
            <h2 id="pre-exam-title" className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{t(language, 'preExam.heading')}</h2>
            <p className="mt-1 text-sm text-slate-500">{examTitle} - {t(language, 'preExam.roomCode')} <strong>{roomCode}</strong></p>
          </div>
          <button type="button" onClick={onClose} aria-label={t(language, 'preExam.close')} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </header>

        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section aria-label={t(language, 'preExam.rules.label')}>
            <h3 className="font-semibold text-slate-900">{t(language, 'preExam.rules.heading')}</h3>
            <div className="mt-3 space-y-2">
              {[
                {
                  title: t(language, 'preExam.duration.title'),
                  detail: t(language, 'preExam.duration.detail', { minutes: durationMinutes, monitoring: monitorTabSwitch ? t(language, 'preExam.tabMonitoring') : t(language, 'preExam.noTabMonitoring') }),
                  icon: Maximize,
                },
                {
                  title: t(language, 'preExam.noOutsideMaterials.title'),
                  detail: instructions || t(language, 'preExam.noOutsideMaterials.detail'),
                  icon: ShieldAlert,
                },
                ...(requireMicrophone ? [{
                  title: t(language, 'preExam.microphone.title'),
                  detail: t(language, 'preExam.microphone.detail'),
                  icon: Mic,
                }] : []),
                ...(monitorSpeech ? [{
                  title: t(language, 'preExam.speech.title'),
                  detail: t(language, 'preExam.speech.detail'),
                  icon: Mic,
                }] : []),
                ...(needsCamera ? [{
                  title: t(language, 'preExam.webcam.title'),
                  detail: monitorFace
                    ? t(language, 'preExam.webcam.faceDetail')
                    : t(language, 'preExam.webcam.previewDetail'),
                  icon: Video,
                }] : []),
                {
                  title: t(language, allowBackNavigation ? 'preExam.backAllowed.title' : 'preExam.backDenied.title'),
                  detail: t(language, allowEarlySubmit ? 'preExam.earlySubmit' : 'preExam.submitAtEnd'),
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

          <section aria-label={t(language, 'preExam.devices.label')} className="space-y-3">
            <div>
              <h3 className="font-semibold text-slate-900">{t(language, 'preExam.devices.label')}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {needsCamera || needsMicrophone
                  ? t(language, 'preExam.devices.required', {
                    devices: [needsCamera && t(language, 'preExam.camera.label'), needsMicrophone && t(language, 'preExam.microphone.label')].filter(Boolean).join(language === 'en' ? ' and ' : ' và '),
                    purposes: [
                      monitorFace && t(language, 'preExam.devices.purpose.face'),
                      monitorSpeech && t(language, 'preExam.devices.purpose.speech'),
                      (requireCamera || requireMicrophone) && t(language, 'preExam.devices.purpose.check'),
                    ].filter(Boolean).join(language === 'en' ? ' and ' : ' và '),
                  })
                  : t(language, 'preExam.devices.notRequired')}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-slate-950">
              {stream && needsCamera ? (
                <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-2 text-slate-400">
                  <Video className="h-8 w-8" />
                  <span className="text-xs">{needsCamera ? t(language, 'preExam.camera.notChecked') : t(language, 'preExam.camera.notRequired')}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium ${!needsCamera || cameraReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                <Video className="h-4 w-4" /> {t(language, 'preExam.camera.label')} {needsCamera ? cameraReady ? t(language, 'preExam.camera.ready') : t(language, 'preExam.camera.notChecked') : t(language, 'preExam.camera.required')}
                {cameraReady && needsCamera && <Check className="ml-auto h-4 w-4" />}
              </div>
              <div className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium ${!needsMicrophone || microphoneReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                <Mic className="h-4 w-4" /> {t(language, 'preExam.microphone.label')} {needsMicrophone ? microphoneReady ? t(language, 'preExam.camera.ready') : t(language, 'preExam.camera.notChecked') : t(language, 'preExam.camera.required')}
                {microphoneReady && needsMicrophone && <Check className="ml-auto h-4 w-4" />}
              </div>
            </div>
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-[0.6875rem] leading-4 text-blue-800">
              {t(language, 'preExam.mediaPrivacy')}
            </p>
            {!permissionGranted && (needsCamera || needsMicrophone) && (
              <button type="button" onClick={() => void requestDevices()} className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
                {t(language, 'preExam.checkDevices', { devices: needsCamera && needsMicrophone ? `${t(language, 'preExam.camera.label')} & ${t(language, 'preExam.microphone.label')}` : t(language, needsCamera ? 'preExam.camera.label' : 'preExam.microphone.label') })}
              </button>
            )}
            {error && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{error}</p>}
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-slate-500">{t(language, 'preExam.confirmRead')}</p>
          <button type="button" onClick={() => void startExam()} disabled={!permissionGranted || starting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Check className="h-4 w-4" /> {t(language, 'preExam.start')}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
