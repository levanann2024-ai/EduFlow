import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { toastEventName, type ToastDetail } from './toast';

interface ToastEntry extends ToastDetail {
  id: string;
}

function ToastItem({ toast, onDismiss }: { toast: ToastEntry; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const isError = toast.kind === 'error';
  const Icon = isError ? AlertCircle : toast.kind === 'info' ? Info : CheckCircle2;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    const exitStart = window.setTimeout(() => setLeaving(true), 5000);
    const remove = window.setTimeout(() => onDismiss(toast.id), 5300);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(exitStart);
      window.clearTimeout(remove);
    };
  }, [onDismiss, toast.id]);

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`toast-item relative overflow-hidden rounded-xl border bg-white shadow-[0_12px_36px_-14px_rgba(15,23,42,0.3)] transition-[opacity,transform] duration-300 ease-out ${
        visible && !leaving ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      } ${isError ? 'border-rose-200' : 'border-slate-200'}`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${isError ? 'text-rose-600' : toast.kind === 'info' ? 'text-blue-600' : 'text-emerald-600'}`} aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-medium leading-5 text-slate-800">{toast.message}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Đóng thông báo"
          className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="h-1 overflow-hidden bg-slate-900/10" aria-hidden="true">
        <span className={`toast-progress-fill block h-full origin-left ${isError ? 'bg-rose-600' : toast.kind === 'info' ? 'bg-blue-600' : 'bg-emerald-600'}`} />
      </div>
    </div>
  );
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const { message, kind } = (event as CustomEvent<ToastDetail>).detail;
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((current) => [...current.slice(-3), { id, message, kind }]);
    };
    window.addEventListener(toastEventName, handleToast);
    return () => window.removeEventListener(toastEventName, handleToast);
  }, []);

  const dismiss = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[100] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 sm:right-5 sm:top-5">
      {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />)}
    </div>
  );
}
