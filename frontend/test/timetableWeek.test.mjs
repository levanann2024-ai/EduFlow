import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let timetableWeek;

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

before(async () => {
  vite = await createServer({
    configFile: './vite.config.ts',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  timetableWeek = await vite.ssrLoadModule('/src/utils/timetableWeek.ts');
});

after(async () => {
  await vite?.close();
});

test('timetable switches focus at 11:00 on Saturday and stays on next week Sunday', () => {
  const beforeCutoff = new Date(2026, 10, 14, 10, 59);
  const atCutoff = new Date(2026, 10, 14, 11, 0);
  const sunday = new Date(2026, 10, 15, 9, 0);

  assert.equal(localDateKey(timetableWeek.getTimetableWeekStart(beforeCutoff)), '2026-11-09');
  assert.equal(localDateKey(timetableWeek.getTimetableWeekStart(atCutoff)), '2026-11-16');
  assert.equal(localDateKey(timetableWeek.getTimetableWeekStart(sunday)), '2026-11-16');
});

test('next cutoff is today before 11:00 Saturday and the following Saturday after cutoff', () => {
  assert.equal(
    timetableWeek.getNextTimetableCutoff(new Date(2026, 10, 14, 10, 59)).getTime(),
    new Date(2026, 10, 14, 11, 0).getTime(),
  );
  assert.equal(
    timetableWeek.getNextTimetableCutoff(new Date(2026, 10, 14, 11, 0)).getTime(),
    new Date(2026, 10, 21, 11, 0).getTime(),
  );
});
