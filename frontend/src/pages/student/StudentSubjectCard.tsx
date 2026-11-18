import {
  Atom,
  Binary,
  BookOpen,
  CalendarDays,
  Calculator,
  Dna,
  Dumbbell,
  FileText,
  FlaskConical,
  Globe2,
  Map,
  ScrollText,
} from 'lucide-react';
import { useAppLanguage } from '@/i18n/AppLanguageContext';
import { localizeStudentSubject, t } from '@/i18n/i18n';

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
  resources: number;
  assignments: number;
  isClone?: boolean;
  onLessonsClick: () => void;
  onResourcesClick: () => void;
  onAssignmentsClick: () => void;
}

export function StudentSubjectCard({
  artworkKey,
  name,
  resources,
  assignments,
  isClone = false,
  onLessonsClick,
  onResourcesClick,
  onAssignmentsClick,
}: StudentSubjectCardProps) {
  const artwork = subjectArtwork[artworkKey as keyof typeof subjectArtwork] ?? { Icon: BookOpen, ink: 'text-blue-700' };
  const { Icon } = artwork;
  const language = useAppLanguage();
  const displayName = localizeStudentSubject(name, language);

  return (
    <article className="relative isolate h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative flex items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 ${artwork.ink}`}>
          <Icon className="h-4 w-4 stroke-[2]" />
        </span>
        <h3 className="min-w-0 truncate text-xs font-bold text-slate-900">{displayName}</h3>
      </div>
      <p className="mt-2 truncate text-[0.5625rem] text-slate-500">
        {resources} {t(language, "tài liệu")} · {assignments} {t(language, "phrase:Bài tập::Assignments")}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <button type="button" tabIndex={isClone ? -1 : undefined} onClick={onLessonsClick} aria-label={t(language, 'studentSubject.timetable.open', { subject: language === 'en' ? displayName : name })} className="flex h-5 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-slate-50 text-[0.5rem] text-slate-600 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
          <CalendarDays className="h-2.5 w-2.5" />{language === 'en' ? 'Schedule' : 'Lịch'}
        </button>
        <button type="button" tabIndex={isClone ? -1 : undefined} onClick={onResourcesClick} aria-label={t(language, 'studentSubject.resources.open', { subject: language === 'en' ? displayName : name })} className="flex h-5 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-slate-50 text-[0.5rem] text-slate-600 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
          <FileText className="h-2.5 w-2.5" />{resources}
        </button>
        <button type="button" tabIndex={isClone ? -1 : undefined} onClick={onAssignmentsClick} aria-label={t(language, `studentSubject.assignments.open.${assignments === 1 ? 'one' : 'many'}`, { count: assignments, subject: language === 'en' ? displayName : name })} className={`flex h-5 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-slate-50 text-[0.5rem] hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${assignments > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
          <FileText className="h-2.5 w-2.5" />{assignments}
        </button>
      </div>
    </article>
  );
}
