import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let getIncompleteTeacherScheduleEntries;
let getUpcomingTeacherSchedule;

before(async () => {
  vite = await createServer({
    configFile: './vite.config.ts',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  ({ getIncompleteTeacherScheduleEntries, getUpcomingTeacherSchedule } = await vite.ssrLoadModule('/src/utils/teacherDashboardSchedule.ts'));
});

after(async () => {
  await vite?.close();
});

function timetable(weekStart, isTemplate, entries) {
  return { timetable: { weekStart, isTemplate }, entries };
}

test('upcoming schedule includes recurring entries from a template week', () => {
  const mondayClass = { weekday: 1, period: 2, type: 'lesson', subject: 'Mathematics' };
  const result = getUpcomingTeacherSchedule(
    [timetable('2026-11-09', false, []), timetable('2026-11-16', true, [mondayClass])],
    new Date(2026, 10, 15, 14),
  );

  assert.equal(result.date.toDateString(), new Date(2026, 10, 16).toDateString());
  assert.deepEqual(result.entries, [mondayClass]);
});

test('upcoming schedule skips cancelled sessions and duplicate weeks', () => {
  const cancelledClass = { weekday: 1, period: 1, type: 'cancelled' };
  const tuesdayClass = { weekday: 2, period: 3, type: 'lesson' };
  const result = getUpcomingTeacherSchedule(
    [
      timetable('2026-11-16', true, [cancelledClass, tuesdayClass]),
      timetable('2026-11-16', true, [{ weekday: 1, period: 4, type: 'lesson' }]),
    ],
    new Date(2026, 10, 15, 14),
  );

  assert.equal(result.date.toDateString(), new Date(2026, 10, 17).toDateString());
  assert.deepEqual(result.entries, [tuesdayClass]);
});

test('incomplete timetable entries identify blank teaching periods and ignore completed or cancelled periods', () => {
  const blankPeriod = { weekday: 1, period: 1, type: 'lesson', topic: '', title: '', classCode: '11A2' };
  const completedPeriod = { weekday: 1, period: 2, type: 'lesson', topic: 'Bài 4', title: '', classCode: '11A2' };
  const cancelledPeriod = { weekday: 1, period: 3, type: 'cancelled', topic: '', title: '', classCode: '11A2' };
  const week = timetable('2026-11-16', true, [blankPeriod, completedPeriod, cancelledPeriod]);

  assert.deepEqual(
    getIncompleteTeacherScheduleEntries(week, '2026-11-16'),
    [blankPeriod],
  );
  assert.deepEqual(getIncompleteTeacherScheduleEntries(week, '2026-11-09'), []);
});
