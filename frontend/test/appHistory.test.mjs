import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/routing/appHistory.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const historyModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

class MockHistory {
  entries;
  index;

  constructor(path) {
    this.entries = [{ path, state: null }];
    this.index = 0;
  }

  get state() {
    return this.entries[this.index].state;
  }

  get path() {
    return this.entries[this.index].path;
  }

  pushState(state, _title, path) {
    this.entries.splice(this.index + 1);
    this.entries.push({ path, state });
    this.index += 1;
  }

  replaceState(state, _title, path) {
    this.entries[this.index] = { path, state };
  }

  back() {
    this.index = Math.max(0, this.index - 1);
  }

  forward() {
    this.index = Math.min(this.entries.length - 1, this.index + 1);
  }
}

const dashboardPaths = {
  student: '/student/dashboard',
  lecturer: '/teacher/dashboard',
};

test('direct student child URL creates dashboard parent and survives refresh without duplicate entries', () => {
  const history = new MockHistory('/my-classes/math');
  historyModule.ensureAppHistoryRoute(
    history,
    'student',
    'my-classes',
    '/my-classes/math',
    dashboardPaths.student,
  );
  assert.deepEqual(history.entries.map((entry) => entry.path), [
    dashboardPaths.student,
    '/my-classes/math',
  ]);
  historyModule.ensureAppHistoryRoute(
    history,
    'student',
    'my-classes',
    '/my-classes/math',
    dashboardPaths.student,
  );
  assert.equal(history.entries.length, 2);
  history.back();
  assert.equal(history.path, dashboardPaths.student);
  history.forward();
  assert.equal(history.path, '/my-classes/math');
});

test('direct teacher child URL has a dashboard Back destination', () => {
  const history = new MockHistory('/teacher/lessons');
  historyModule.ensureAppHistoryRoute(
    history,
    'lecturer',
    'lessons',
    '/teacher/lessons',
    dashboardPaths.lecturer,
  );
  history.back();
  assert.equal(history.path, dashboardPaths.lecturer);
  history.forward();
  assert.equal(history.path, '/teacher/lessons');
});

test('opening a subject group pushes a child entry so Back and Forward restore both routes', () => {
  const history = new MockHistory(dashboardPaths.student);
  historyModule.ensureAppHistoryRoute(
    history,
    'student',
    'dashboard',
    dashboardPaths.student,
    dashboardPaths.student,
  );
  historyModule.pushAppHistoryRoute(
    history,
    'student',
    'my-classes',
    '/student/my-classes',
    history.path,
    dashboardPaths.student,
  );
  historyModule.pushAppHistoryRoute(
    history,
    'student',
    'my-classes',
    '/my-classes/math',
    history.path,
    dashboardPaths.student,
  );
  history.back();
  assert.equal(history.path, '/student/my-classes');
  history.forward();
  assert.equal(history.path, '/my-classes/math');
});

test('canonicalizing a subject URL replaces the current entry instead of adding another', () => {
  const history = new MockHistory(dashboardPaths.student);
  historyModule.ensureAppHistoryRoute(
    history,
    'student',
    'dashboard',
    dashboardPaths.student,
    dashboardPaths.student,
  );
  historyModule.pushAppHistoryRoute(
    history,
    'student',
    'my-classes',
    '/student/my-classes',
    history.path,
    dashboardPaths.student,
  );
  historyModule.replaceAppHistoryRoute(history, 'student', 'my-classes', '/my-classes/math');
  assert.deepEqual(history.entries.map((entry) => entry.path), [
    dashboardPaths.student,
    '/my-classes/math',
  ]);
  history.back();
  assert.equal(history.path, dashboardPaths.student);
});
