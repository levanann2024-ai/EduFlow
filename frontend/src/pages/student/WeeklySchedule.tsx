import { Star } from 'lucide-react';
import type { TimetableEntryType } from '@/api/schoolApi';

export interface ScheduleGridEntry {
  weekday: number;
  period: number;
  subject: string;
  type: TimetableEntryType;
  title?: string;
  topic?: string;
  classCode?: string;
  isHomeroom?: boolean;
  dueAt?: string | null;
  hasHomework?: boolean;
  homeworkTitle?: string;
  homeworkDueAt?: string | null;
  hasExam?: boolean;
  examTitle?: string;
  examStartsAt?: string | null;
  hasExamReturn?: boolean;
  examReturnNote?: string;
  examReturnAt?: string | null;
}

interface WeeklyScheduleProps {
  entries: ScheduleGridEntry[];
  weekDays: Array<{ label: string; date: Date }>;
  periodCount: number;
  sessionLabel: string;
  editable?: boolean;
  onSelectCell?: (weekday: number, period: number, entry?: ScheduleGridEntry) => void;
}

function entryStyle(entry: ScheduleGridEntry) {
  if (entry.type === 'cancelled') {
    return 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200';
  }
  if (entry.hasHomework || entry.hasExam || entry.hasExamReturn
    || entry.type === 'homework' || entry.type === 'exam' || entry.type === 'exam_return') {
    return 'border-rose-200 bg-rose-50 text-rose-950 hover:bg-rose-100';
  }
  if (entry.type === 'makeup') {
    return 'border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100';
  }
  return 'border-sky-200 bg-sky-50 text-sky-950 hover:bg-sky-100';
}

export function WeeklySchedule({
  entries,
  weekDays,
  periodCount,
  sessionLabel,
  editable = false,
  onSelectCell,
}: WeeklyScheduleProps) {
  const entryMap = new Map(entries.map((entry) => [`${entry.weekday}:${entry.period}`, entry]));

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold text-slate-900">{sessionLabel}</h2>
        <span className="text-xs font-medium text-slate-500">{periodCount} tiết</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[64px_repeat(6,minmax(110px,1fr))] border-b border-slate-200 bg-slate-50">
            <div className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Tiết</div>
            {weekDays.map((day) => (
              <div key={day.label} className="border-l border-slate-200 px-2 py-2 text-center">
                <div className="text-xs font-semibold text-slate-700">{day.label}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {day.date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
          {Array.from({ length: periodCount }, (_, index) => {
            const period = index + 1;
            return (
              <div key={period} className="grid min-h-[92px] grid-cols-[64px_repeat(6,minmax(110px,1fr))] border-b border-slate-100 last:border-b-0">
                <div className="flex items-center justify-center bg-slate-50/70 text-sm font-semibold text-slate-600">{period}</div>
                {weekDays.map((_, dayIndex) => {
                  const weekday = dayIndex + 1;
                  const entry = entryMap.get(`${weekday}:${period}`);
                  const content = entry ? (
                    <>
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          {entry.classCode && <div className="truncate text-[11px] font-bold uppercase tracking-wide opacity-75">{entry.classCode}</div>}
                          <div className="mt-0.5 line-clamp-2 text-sm font-semibold">{entry.subject}</div>
                        </div>
                        {entry.isHomeroom && <Star aria-label="Lớp chủ nhiệm" className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />}
                      </div>
                      {entry.type === 'cancelled' && <div className="mt-1 text-xs font-semibold">Tiết đã hủy</div>}
                      {entry.topic && entry.type !== 'cancelled' && (
                        <div className="mt-1 rounded border-l-2 border-blue-500 bg-blue-50 px-1.5 py-1 text-xs leading-4 text-blue-950">
                          <span className="font-semibold">Tài liệu:</span> {entry.topic}
                        </div>
                      )}
                      {entry.title && entry.type !== 'cancelled'
                        && entry.title !== entry.homeworkTitle && entry.title !== entry.examTitle && (
                          <div className="mt-1 rounded border-l-2 border-slate-400 bg-slate-50 px-1.5 py-1 text-xs leading-4 text-slate-800">
                            <span className="font-semibold">Khác:</span> {entry.title}
                          </div>
                      )}
                      {entry.hasHomework && (
                        <div className="mt-1 rounded border-l-2 border-red-500 bg-red-50 px-1.5 py-1 text-xs leading-4 text-red-950">
                          <span className="font-semibold">BTVN cần nộp:</span>{entry.homeworkTitle ? ` ${entry.homeworkTitle}` : ''}
                        </div>
                      )}
                      {entry.hasExam && (
                        <div className="mt-1 rounded border-l-2 border-green-500 bg-green-50 px-1.5 py-1 text-xs leading-4 text-green-950">
                          <span className="font-semibold">Bài kiểm tra:</span>{entry.examTitle ? ` ${entry.examTitle}` : ''}
                        </div>
                      )}
                      {entry.hasExamReturn && (
                        <div className="mt-1 rounded border-l-2 border-emerald-500 bg-emerald-50 px-1.5 py-1 text-xs leading-4 text-emerald-950">
                          <span className="font-semibold">Trả bài:</span>{entry.examReturnNote ? ` ${entry.examReturnNote}` : ''}
                          {entry.examReturnAt && (
                            <span className="block text-[11px] opacity-80">
                              {new Date(entry.examReturnAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-300">{editable ? '+ Thêm' : ''}</span>
                  );
                  const cellClass = `h-full min-h-[92px] w-full rounded-lg border p-2 text-left transition ${
                    entry ? entryStyle(entry) : editable
                      ? 'border-dashed border-slate-200 bg-white text-slate-400 hover:border-blue-300 hover:bg-blue-50'
                      : 'border-transparent bg-white'
                  }`;

                  return (
                    <div key={weekday} className="border-l border-slate-100 p-1.5">
                      {editable ? (
                        <button
                          type="button"
                          className={cellClass}
                          onClick={() => onSelectCell?.(weekday, period, entry)}
                          aria-label={`${entry ? 'Sửa' : 'Thêm'} tiết ${period}, ${weekDays[dayIndex].label}`}
                        >
                          {content}
                        </button>
                      ) : (
                        <div className={cellClass}>{content}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
