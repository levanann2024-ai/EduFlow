function academicYearWeekOneStart(academicYear) {
  const match = typeof academicYear === 'string' && academicYear.match(/^(\d{4})-\d{4}$/);
  if (!match) return null;

  const septemberFifth = new Date(Date.UTC(Number(match[1]), 8, 5));
  const weekday = septemberFifth.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const monday = new Date(septemberFifth);
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday + (weekday >= 5 || weekday === 0 ? 7 : 0));
  return monday;
}

function getAcademicYearWeekNumber(academicYear, weekStart) {
  const firstWeek = academicYearWeekOneStart(academicYear);
  if (!firstWeek || typeof weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;
  const selectedWeek = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(selectedWeek.getTime()) || selectedWeek.getUTCDay() !== 1
    || selectedWeek.toISOString().slice(0, 10) !== weekStart || selectedWeek < firstWeek) {
    return null;
  }
  return Math.floor((selectedWeek.getTime() - firstWeek.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function getEventDate(weekStart, weekday) {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + weekday - 1);
  return date.toISOString().slice(0, 10);
}

function toIsoString(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mergeClassTimetableEvents(baseEntries, events) {
  const entries = new Map(baseEntries.map((entry) => [`${entry.weekday}:${entry.period}`, {
    ...entry,
    hasHomework: false,
    homeworkTitle: '',
    homeworkDueAt: null,
    hasExam: false,
    examTitle: '',
    examStartsAt: null,
    hasExamReturn: false,
    examReturnNote: '',
    examReturnAt: null,
  }]));

  for (const event of events) {
    const weekday = Number(event.weekday);
    const period = Number(event.period_number);
    const key = `${weekday}:${period}`;
    if (event.operation === 'cancel') {
      entries.delete(key);
      continue;
    }

    const existing = entries.get(key);
    const hasHomework = Boolean(event.has_homework);
    const hasExam = Boolean(event.has_exam);
    const hasExamReturn = Boolean(event.has_exam_return);
    const homeworkDueAt = toIsoString(event.homework_due_at);
    const examStartsAt = toIsoString(event.exam_starts_at);
    const examReturnAt = toIsoString(event.exam_return_at);
    const type = event.operation === 'makeup'
      ? 'makeup'
      : hasExam
        ? 'exam'
        : hasHomework
          ? 'homework'
          : hasExamReturn
            ? 'exam_return'
            : 'lesson';

    entries.set(key, {
      weekday,
      period,
      subject: event.subject || existing?.subject || '',
      type,
      title: event.title || event.exam_title || event.homework_title || '',
      topic: event.lesson_topic || '',
      dueAt: homeworkDueAt || examStartsAt || examReturnAt,
      hasHomework,
      homeworkTitle: event.homework_title || '',
      homeworkDueAt,
      hasExam,
      examTitle: event.exam_title || '',
      examStartsAt,
      hasExamReturn,
      examReturnNote: event.exam_return_note || '',
      examReturnAt,
    });
  }

  return [...entries.values()].sort((first, second) => (
    first.weekday - second.weekday || first.period - second.period
  ));
}

module.exports = {
  getAcademicYearWeekNumber,
  getEventDate,
  mergeClassTimetableEvents,
};
