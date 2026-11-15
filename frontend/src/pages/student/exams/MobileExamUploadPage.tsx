import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Upload } from 'lucide-react';
import { useAppLanguage } from '@/i18n/AppLanguageContext';
import { t } from '@/i18n/i18n';

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export function MobileExamUploadPage() {
  const language = useAppLanguage();
  const [sessionToken] = useState(() => new URLSearchParams(window.location.search).get('session') ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function sendPhoto() {
    if (!sessionToken || !file || sending) return;
    setSending(true);
    setError('');
    try {
      const formData = new FormData();
      formData.set('session', sessionToken);
      formData.set('file', file, file.name);
      const response = await fetch('/api/upload-temporary', {
        method: 'POST',
        body: formData,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      let body: { success?: boolean; message?: string };
      try {
        body = await response.json() as { success?: boolean; message?: string };
      } catch {
        throw new Error(t(language, 'mobileUpload.invalidResponse'));
      }
      if (!response.ok || body.success !== true) {
        throw new Error(body.message || t(language, 'mobileUpload.syncError'));
      }
      setSent(true);
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : t(language, 'mobileUpload.syncError'));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          {sent ? <CheckCircle2 className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
        </div>
        <h1 className="mt-4 text-center text-xl font-bold">{t(language, 'mobileUpload.title')}</h1>
        <p className="mt-2 text-center text-sm leading-6 text-slate-600">
          {t(language, 'mobileUpload.description')}
        </p>

        {!sessionToken ? (
          <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {t(language, 'mobileUpload.invalidSession')}
          </p>
        ) : sent ? (
          <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-medium leading-6 text-emerald-800">
            {t(language, 'mobileUpload.success')}
          </p>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const nextFile = event.currentTarget.files?.[0] ?? null;
                event.currentTarget.value = '';
                setError('');
                if (!nextFile) return;
                if (!imageTypes.has(nextFile.type) || nextFile.size === 0 || nextFile.size > 10 * 1024 * 1024) {
                  setFile(null);
                  setError(t(language, 'mobileUpload.invalidFile'));
                  return;
                }
                setFile(nextFile);
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-base font-bold text-white transition hover:bg-blue-800"
            >
              <Camera className="h-5 w-5" />
              {t(language, 'mobileUpload.capture')}
            </button>

            {previewUrl && file && (
              <div className="mt-5 space-y-3">
                <p className="text-sm font-semibold text-slate-700">{t(language, 'mobileUpload.preview')}</p>
                <img
                  src={previewUrl}
                  alt={t(language, 'mobileUpload.previewAlt')}
                  className="max-h-[55vh] w-full rounded-xl border border-slate-200 bg-slate-100 object-contain"
                />
                <p className="truncate text-xs text-slate-500">{file.name}</p>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void sendPhoto()}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {sending ? t(language, 'mobileUpload.sending') : t(language, 'mobileUpload.send')}
                </button>
              </div>
            )}
          </>
        )}
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      </section>
    </main>
  );
}
