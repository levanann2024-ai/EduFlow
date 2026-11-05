const vietnamTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const periods = [
  { number: 1, start: 7 * 60 + 15, end: 8 * 60 },
  { number: 2, start: 8 * 60 + 15, end: 9 * 60 },
  { number: 3, start: 9 * 60 + 10, end: 9 * 60 + 50 },
  { number: 4, start: 10 * 60, end: 10 * 60 + 40 },
  { number: 5, start: 11 * 60, end: 11 * 60 + 45 },
];

function getExamPeriodSlot(startsAt) {
  const timestamp = new Date(startsAt);
  if (!Number.isFinite(timestamp.getTime())) return null;

  const parts = Object.fromEntries(
    vietnamTime.formatToParts(timestamp).map(({ type, value }) => [type, value]),
  );
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 }[parts.weekday];
  if (!weekday) return null;

  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const period = periods.find(({ start, end }) => minute >= start && minute < end);
  if (!period) return null;

  return {
    eventDate: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    period: period.number,
  };
}

module.exports = { getExamPeriodSlot };
