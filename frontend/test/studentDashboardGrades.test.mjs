import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let getStudentDashboardGradeSummary;
let getStudentDashboardSubjects;

before(async () => {
  vite = await createServer({
    configFile: './vite.config.ts',
    server: { middlewareMode: true },
    appType: 'custom',
  });
  ({ getStudentDashboardGradeSummary, getStudentDashboardSubjects } = await vite.ssrLoadModule('/src/utils/studentDashboardGrades.ts'));
});

after(async () => {
  await vite?.close();
});

test('does not show any dashboard grades when no progress class is available', () => {
  const summary = getStudentDashboardGradeSummary(null, [
    { subject: 'Toán học', average: 8.1 },
  ]);

  assert.deepEqual(summary, { subjectScores: [], allAverage: null });
});

test('subjects without official grades have no average and do not affect the overall average', () => {
  const summary = getStudentDashboardGradeSummary(
    { subjects: ['Toán học', 'Vật lý'] },
    [{ subject: 'Toán học', average: 8 }],
  );

  assert.deepEqual(summary, {
    subjectScores: [
      { subject: 'Toán học', average: 8 },
      { subject: 'Vật lý', average: null },
    ],
    allAverage: 8,
  });
});

test('dashboard subjects come from live progress data rather than a static list', () => {
  assert.deepEqual(getStudentDashboardSubjects(null), []);

  const subjects = getStudentDashboardSubjects({
    classes: [{ subjects: ['Toán học'] }],
    resources: [{ subject: 'Toán học' }, { subject: 'Toán học' }],
    assignments: [{ subject: 'Toán học' }],
  });

  assert.deepEqual(subjects, [{
    name: 'Toán học',
    artworkKey: 'TOAN10',
    resources: 2,
    assignments: 1,
  }]);
});
