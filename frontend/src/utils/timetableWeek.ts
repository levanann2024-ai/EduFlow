function getMondayStart(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function hasPassedTimetableCutoff(date: Date) {
  return date.getDay() === 0
    || (date.getDay() === 6 && date.getHours() >= 11);
}

export function getTimetableWeekStart(date: Date) {
  const monday = getMondayStart(date);
  if (hasPassedTimetableCutoff(date)) monday.setDate(monday.getDate() + 7);
  return monday;
}

export function getNextTimetableCutoff(date: Date) {
  const cutoff = new Date(date);
  cutoff.setDate(cutoff.getDate() + ((6 - cutoff.getDay() + 7) % 7));
  cutoff.setHours(11, 0, 0, 0);
  if (cutoff.getTime() <= date.getTime()) cutoff.setDate(cutoff.getDate() + 7);
  return cutoff;
}
