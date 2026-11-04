import {
  Atom,
  Binary,
  BookOpen,
  Calculator,
  Dna,
  Dumbbell,
  FileText,
  FlaskConical,
  Globe2,
  Map,
  ScrollText,
} from 'lucide-react';

const subjectArtwork = {
  TOAN10: { Icon: Calculator, ink: 'text-blue-700' },
  VAN10: { Icon: BookOpen, ink: 'text-amber-700' },
  HOA10: { Icon: FlaskConical, ink: 'text-rose-700' },
  LY10: { Icon: Atom, ink: 'text-violet-700' },
  ANH10: { Icon: Globe2, ink: 'text-emerald-700' },
  TIN10: { Icon: Binary, ink: 'text-cyan-700' },
  SINH10: { Icon: Dna, ink: 'text-green-700' },
  SU10: { Icon: ScrollText, ink: 'text-orange-700' },
  DIA10: { Icon: Map, ink: 'text-sky-700' },
  GDTC10: { Icon: Dumbbell, ink: 'text-emerald-700' },
} as const;

interface StudentSubjectCardProps {
  artworkKey: string;
  name: string;
  lessons: string;
  resources: number;
  assignments: number;
  progress: number;
  isClone?: boolean;
  onLessonsClick: () => void;
  onResourcesClick: () => void;
  onAssignmentsClick: () => void;
}

export function StudentSubjectCard({
  artworkKey,
  name,
  lessons,
  resources,
  assignments,
  progress,
  isClone = false,
  onLessonsClick,
  onResourcesClick,
  onAssignmentsClick,
}: StudentSubjectCardProps) {
  const artwork = subjectArtwork[artworkKey as keyof typeof subjectArtwork] ?? subjectArtwork.TOAN10;
  const { Icon } = artwork;

  return (
    <article className="relative isolate h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 ${artwork.ink}`}>
          <Icon className="h-4 w-4 stroke-[2]" />
        </span>
        <h3 className="min-w-0 truncate text-xs font-bold text-slate-900">{name.replace(' 10', '')}</h3>
      </div>
      <p className="mt-2 truncate text-[9px] text-slate-500">{lessons} tiết - {resources} tài liệu</p>
      <div className="mt-2 flex items-center gap-1.5">
        <button type="button" tabIndex={isClone ? -1 : undefined} onClick={onLessonsClick} aria-label={`Mở thời khóa biểu, ${lessons} tiết đã học môn ${name}`} className="flex h-5 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-slate-50 text-[8px] text-slate-600 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
          <BookOpen className="h-2.5 w-2.5" />{lessons}
        </button>
        <button type="button" tabIndex={isClone ? -1 : undefined} onClick={onResourcesClick} aria-label={`Mở tài liệu môn ${name}`} className="flex h-5 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-slate-50 text-[8px] text-slate-600 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
          <FileText className="h-2.5 w-2.5" />{resources}
        </button>
        <button type="button" tabIndex={isClone ? -1 : undefined} onClick={onAssignmentsClick} aria-label={`Mở ${assignments} bài tập môn ${name}`} className={`flex h-5 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-slate-50 text-[8px] hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${assignments > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
          <FileText className="h-2.5 w-2.5" />{assignments}
        </button>
      </div>
      <div className="mt-2">
        <div className="mb-1 flex justify-between text-[9px]">
          <span className="text-slate-500">Tiến độ</span>
          <span className="font-semibold text-slate-700">{progress}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label={`Tiến độ môn ${name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </article>
  );
}
