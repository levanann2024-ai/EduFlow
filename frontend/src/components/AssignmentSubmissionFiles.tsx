import { useEffect, useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import {
  downloadClassAssignmentSubmissionFile,
  type AssignmentSubmissionFile as SubmissionFile,
} from '@/api/schoolApi';

interface LoadedSubmissionFile {
  url?: string;
  error?: string;
}

export function AssignmentSubmissionFiles({
  assignmentId,
  studentId = null,
  files,
}: {
  assignmentId: string;
  studentId?: string | null;
  files: SubmissionFile[];
}) {
  const [loadedFiles, setLoadedFiles] = useState<Record<string, LoadedSubmissionFile>>({});
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const fileIds = files.map((file) => file.id).join(',');

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    setLoadedFiles({});
    const fileIdsToLoad = fileIds ? fileIds.split(',') : [];
    fileIdsToLoad.forEach((fileId) => {
      void downloadClassAssignmentSubmissionFile(assignmentId, studentId, fileId)
        .then((blob) => {
          if (!active) return;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          setLoadedFiles((current) => ({ ...current, [fileId]: { url } }));
        })
        .catch((error: unknown) => {
          if (active) {
            setLoadedFiles((current) => ({
              ...current,
              [fileId]: {
                error: error instanceof Error ? error.message : 'Không thể tải tệp bài nộp.',
              },
            }));
          }
        });
    });
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [assignmentId, studentId, fileIds]);

  if (!files.length) return null;
  return (
    <section className="mt-4 space-y-3" aria-label="Tệp đính kèm bài nộp">
      <h4 className="text-sm font-semibold text-slate-700">Tệp đính kèm ({files.length})</h4>
      {files.map((file) => {
        const loaded = loadedFiles[file.id];
        return (
          <article key={file.id} className="rounded-xl border border-slate-200 bg-white p-3">
            {file.mediaType.startsWith('image/') && loaded?.url ? (
              <button type="button" onClick={() => setPreviewFile({ url: loaded.url!, name: file.name })} className="block max-w-full text-left" aria-label={`Xem trước ảnh ${file.name}`}>
                <img
                  src={loaded.url}
                  alt={file.name}
                  loading="lazy"
                  className="max-h-[360px] max-w-full cursor-zoom-in rounded-lg object-contain"
                />
                <span className="mt-1 block text-xs text-blue-700">Bấm để xem ảnh</span>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-blue-700" />
                <span className="min-w-0 flex-1 break-all text-sm text-slate-700">{file.name}</span>
                {loaded?.url && (
                  <a
                    href={loaded.url}
                    download={file.name}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    <Download className="h-4 w-4" /> Tải tệp
                  </a>
                )}
              </div>
            )}
            {!loaded && <p role="status" className="text-xs text-slate-500">Đang tải {file.name}...</p>}
            {loaded?.error && <p role="alert" className="text-xs text-rose-700">{loaded.error}</p>}
            {file.mediaType.startsWith('image/') && loaded?.url && (
              <p className="mt-2 break-all text-xs text-slate-500">{file.name}</p>
            )}
          </article>
        );
      })}
      {previewFile && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewFile(null); }}
          onKeyDown={(event) => { if (event.key === 'Escape') setPreviewFile(null); }}
        >
          <section role="dialog" aria-modal="true" aria-label={`Xem trước ${previewFile.name}`} className="relative flex max-h-[92vh] max-w-[94vw] flex-col overflow-hidden rounded-xl bg-white p-2 shadow-2xl">
            <button type="button" onClick={() => setPreviewFile(null)} aria-label="Đóng xem trước" className="absolute right-3 top-3 z-10 rounded-full bg-white/95 p-2 text-slate-700 shadow hover:bg-white">
              <X className="h-5 w-5" />
            </button>
            <img src={previewFile.url} alt={previewFile.name} className="max-h-[82vh] max-w-[92vw] rounded-lg object-contain" />
            <p className="truncate px-2 pt-2 text-center text-xs text-slate-600">{previewFile.name}</p>
          </section>
        </div>
      )}
    </section>
  );
}
