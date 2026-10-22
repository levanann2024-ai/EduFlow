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
  TOAN10: { Icon: Calculator, wash: 'from-blue-100/90 via-blue-50/70 to-white', ink: 'text-blue-700', marks: [] },
  VAN10: { Icon: BookOpen, wash: 'from-amber-100/90 via-orange-50/70 to-white', ink: 'text-amber-700', marks: [] },
  HOA10: { Icon: FlaskConical, wash: 'from-rose-100/90 via-pink-50/70 to-white', ink: 'text-rose-700', marks: [] },
  LY10: { Icon: Atom, wash: 'from-violet-100/90 via-purple-50/70 to-white', ink: 'text-violet-700', marks: [] },
  ANH10: { Icon: Globe2, wash: 'from-emerald-100/90 via-teal-50/70 to-white', ink: 'text-emerald-700', marks: [] },
  TIN10: { Icon: Binary, wash: 'from-cyan-100/90 via-sky-50/70 to-white', ink: 'text-cyan-700', marks: [] },
  SINH10: { Icon: Dna, wash: 'from-lime-100/90 via-green-50/70 to-white', ink: 'text-green-700', marks: [] },
  SU10: { Icon: ScrollText, wash: 'from-orange-100/90 via-amber-50/70 to-white', ink: 'text-orange-700', marks: [] },
  DIA10: { Icon: Map, wash: 'from-blue-100/90 via-sky-50/70 to-white', ink: 'text-sky-700', marks: [] },
  GDTC10: { Icon: Dumbbell, wash: 'from-emerald-100/90 via-green-50/70 to-white', ink: 'text-emerald-700', marks: [] },
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
    <article className={`relative isolate h-full w-full overflow-hidden rounded-xl border border-slate-100/80 bg-gradient-to-br p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${artwork.wash}`}>
      <div className="relative flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 ${artwork.ink}`}>
          <Icon className="h-4 w-4 stroke-[2]" />
        </span>
        <h3 className="min-w-0 truncate text-xs font-bold text-slate-900">{name.replace(' 10', '')}</h3>
      </div>
      <p className="mt-2 truncate text-[9px] text-slate-500">{lessons} tiết · {resources} tài liệu</p>
      <div className="mt-2 flex items-center gap-1.5">
        <button type="button" tabIndex={isClone ? -1 : undefined} onClick={onLessonsClick} aria-label={`Mở thời khóa biểu, ${lessons} tiết đã học môn ${name}`} className="flex h-5 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-white/75 text-[8px] text-slate-600 hover:bg-white hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
          <BookOpen className="h-2.5 w-2.5" />{lessons}
        </button>
        <button type="button" tabIndex={isClone ? -1 : undefined} onClick={onResourcesClick} aria-label={`Mở tài liệu môn ${name}`} className="flex h-5 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-white/75 text-[8px] text-slate-600 hover:bg-white hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
          <FileText className="h-2.5 w-2.5" />{resources}
        </button>
        <button type="button" tabIndex={isClone ? -1 : undefined} onClick={onAssignmentsClick} aria-label={`Mở ${assignments} bài tập môn ${name}`} className={`flex h-5 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-white/75 text-[8px] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${assignments > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
          <FileText className="h-2.5 w-2.5" />{assignments}
        </button>
      </div>
      <div className="mt-2">
        <div className="mb-1 flex justify-between text-[9px]">
          <span className="text-slate-500">Tiến độ</span>
          <span className="font-semibold text-slate-700">{progress}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-white/80"
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
