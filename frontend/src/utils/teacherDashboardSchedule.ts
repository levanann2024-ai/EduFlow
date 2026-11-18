import type { TeacherTimetableResponse } from '@/api/schoolApi';

function getWeekStart(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

export function getUpcomingTeacherSchedule(
  timetables: Array<TeacherTimetableResponse | null>,
  now: Date,
) {
  const weekTimetables = timetables.filter((timetable, index, all): timetable is TeacherTimetableResponse => (
    Boolean(timetable)
    && all.findIndex((candidate) => candidate?.timetable?.weekStart === timetable?.timetable?.weekStart) === index
  ));
  for (let daysAhead = 1; daysAhead <= 7; daysAhead += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
    const weekday = ((date.getDay() + 6) % 7) + 1;
    const week = weekTimetables.find((candidate) => candidate.timetable?.weekStart === getWeekStart(date));
    if (!week) continue;
    const entries = week.entries
      .filter((entry) => entry.weekday === weekday && entry.type !== 'cancelled')
      .sort((first, second) => first.period - second.period);
    if (entries.length > 0) return { date, entries };
  }
  return null;
}

export function getIncompleteTeacherScheduleEntries(
  timetable: TeacherTimetableResponse | null,
  currentWeekStart: string,
) {
  if (!timetable?.timetable || timetable.timetable.weekStart !== currentWeekStart) return [];
  return timetable.entries.filter((entry) => {
    if (entry.type === 'cancelled') return false;
    return ![
      entry.topic,
      entry.title,
      entry.homeworkTitle,
      entry.examTitle,
      entry.examReturnNote,
      entry.roomExamTitle,
    ].some((value) => value?.trim());
  });
}
