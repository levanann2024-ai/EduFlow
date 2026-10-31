import { useEffect, useRef, useState } from 'react';
import { Download, FileImage, X } from 'lucide-react';
import {
  downloadTeacherExamGradeEvidenceFile,
  downloadTeacherExamSubmissionFile,
  type TeacherExamGradeEvidenceFile,
  type TeacherExamSubmissionFile,
} from '@/api/schoolApi';

export function TeacherExamSubmissionFiles({
  roomId,
  sessionId,
  files,
  heading = 'Ảnh bài làm',
  onRemoveFile,
}: {
  roomId: string;
  sessionId: string;
  files: Array<TeacherExamSubmissionFile | TeacherExamGradeEvidenceFile>;
  heading?: string;
  onRemoveFile?: (fileId: string) => void;
}) {
  const [loadedFiles, setLoadedFiles] = useState<Record<string, { url?: string; error?: string; loading?: boolean }>>({});
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const objectUrls = useRef(new Set<string>());
  const requestGeneration = useRef(0);
  const fileIds = files.map((file) => file.id).join(',');
  const selectedFile = files.find((file) => file.id === selectedFileId);
  const selectedImage = selectedFile ? loadedFiles[selectedFile.id] : undefined;

  useEffect(() => {
    const activeObjectUrls = objectUrls.current;
    requestGeneration.current += 1;
    setLoadedFiles({});
    return () => {
      requestGeneration.current += 1;
      activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
      activeObjectUrls.clear();
    };
  }, [fileIds, roomId, sessionId]);

  useEffect(() => {
    if (!selectedFileId) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedFileId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFileId]);

  if (!files.length) return null;

  function openImage(file: TeacherExamSubmissionFile | TeacherExamGradeEvidenceFile) {
    setSelectedFileId(file.id);
    if (loadedFiles[file.id]?.url || loadedFiles[file.id]?.loading) return;

    const generation = requestGeneration.current;
    setLoadedFiles((current) => ({ ...current, [file.id]: { loading: true } }));
    const downloadFile = 'questionId' in file
      ? downloadTeacherExamGradeEvidenceFile
      : downloadTeacherExamSubmissionFile;
    void downloadFile(roomId, sessionId, file.id)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (requestGeneration.current !== generation) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrls.current.add(url);
        setLoadedFiles((current) => ({ ...current, [file.id]: { url } }));
      })
      .catch((error: unknown) => {
        if (requestGeneration.current === generation) {
          setLoadedFiles((current) => ({
            ...current,
            [file.id]: {
              error: error instanceof Error ? error.message : 'Không thể tải ảnh bài thi.',
            },
          }));
        }
      });
  }

  return (
    <section className="mt-3 space-y-2" aria-label={heading}>
      <h5 className="text-xs font-semibold text-slate-600">{heading} ({files.length})</h5>
      <div className="flex flex-wrap gap-2">
        {files.map((file) => {
          const loaded = loadedFiles[file.id];
          return (
            <div key={file.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <button
                type="button"
                onClick={() => openImage(file)}
                aria-label={`Xem ảnh bài làm ${file.name}`}
                title={`Xem ảnh ${file.name}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900"
              >
                <FileImage className="h-4 w-4 shrink-0" />
                {file.name}
              </button>
              {loaded?.url && (
                <a href={loaded.url} download={file.name} aria-label={`Tải ảnh ${file.name}`} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                  <Download className="h-3.5 w-3.5" />
                </a>
              )}
              {loaded?.error && <span role="alert" className="text-xs text-rose-700">{loaded.error}</span>}
              {onRemoveFile && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(file.id)}
                  aria-label={`Xóa ảnh minh chứng ${file.name}`}
                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {selectedFile && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4"
          role="presentation"
          onClick={() => setSelectedFileId(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Ảnh bài làm ${selectedFile.name}`}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h3 className="min-w-0 truncate text-sm font-semibold text-slate-800">{selectedFile.name}</h3>
              <div className="flex shrink-0 items-center gap-2">
                {selectedImage?.url && (
                  <a href={selectedImage.url} download={selectedFile.name} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                    <Download className="h-4 w-4" /> Tải ảnh
                  </a>
                )}
                <button type="button" onClick={() => setSelectedFileId(null)} aria-label="Đóng ảnh" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>
            <div className="flex min-h-48 flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
              {selectedImage?.url ? (
                <img src={selectedImage.url} alt={selectedFile.name} className="max-h-[78vh] max-w-full object-contain" />
              ) : (
                <p role={selectedImage?.error ? 'alert' : 'status'} className="text-sm text-slate-600">
                  {selectedImage?.error ?? (selectedImage?.loading ? `Đang tải ${selectedFile.name}...` : '')}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
