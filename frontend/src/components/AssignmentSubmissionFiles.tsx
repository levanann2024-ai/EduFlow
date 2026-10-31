import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
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
              <a href={loaded.url} download={file.name} className="block">
                <img
                  src={loaded.url}
                  alt={file.name}
                  loading="lazy"
                  className="max-h-[480px] max-w-full rounded-lg object-contain"
                />
              </a>
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
    </section>
  );
}
