import { FileText, Presentation } from 'lucide-react';

export type LessonFormat = 'text' | 'slides';

export function LessonFormatSelector({
  value,
  onChange,
}: {
  value: LessonFormat;
  onChange: (format: LessonFormat) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Định dạng bài giảng">
      {([
        ['text', 'Văn bản', FileText],
        ['slides', 'Slide', Presentation],
      ] as const).map(([format, label, Icon]) => (
        <button
          key={format}
          type="button"
          role="tab"
          aria-selected={value === format}
          onClick={() => onChange(format)}
          className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            value === format ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
