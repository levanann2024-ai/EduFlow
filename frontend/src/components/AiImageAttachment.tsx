import { useRef } from 'react';
import { Camera, Paperclip, X } from 'lucide-react';
import { showToast } from '@/components/toast';

interface AiImageAttachmentProps {
  file: File | null;
  onChange: (file: File | null) => void;
}

export function AiImageAttachment({ file, onChange }: AiImageAttachmentProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleSelection = (selected?: File) => {
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      showToast('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.', 'error');
      return;
    }
    if (selected.size === 0 || selected.size > 5 * 1024 * 1024) {
      showToast('Ảnh đính kèm phải có dung lượng tối đa 5 MB.', 'error');
      return;
    }
    onChange(selected);
  };

  const removeFile = () => {
    onChange(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="mt-2 flex min-w-0 items-center gap-1">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          handleSelection(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          handleSelection(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => imageInputRef.current?.click()}
        aria-label="Đính kèm ảnh"
        title="Đính kèm ảnh"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-100 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Paperclip className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => cameraInputRef.current?.click()}
        aria-label="Chụp ảnh"
        title="Chụp ảnh bằng camera"
        className="dashboard-camera-control h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-100 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
      </button>
      {file && (
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/40 bg-white/90 px-2.5 text-xs text-slate-700">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
          <button
            type="button"
            onClick={removeFile}
            aria-label="Xóa ảnh đính kèm"
            className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
