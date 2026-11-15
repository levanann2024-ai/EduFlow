import type { Page, Role } from '@/types';

export interface EduFlowHistoryEntry {
  role: Role;
  page: Page;
  path: string;
  parentPath?: string;
}

export interface HistoryPort {
  readonly state: unknown;
  pushState(data: unknown, unused: string, url?: string | URL | null): void;
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

const EDUFLOW_HISTORY_KEY = '__eduflow';

export function readEduFlowHistoryEntry(state: unknown): EduFlowHistoryEntry | null {
  if (!state || typeof state !== 'object' || !(EDUFLOW_HISTORY_KEY in state)) return null;
  const entry = (state as Record<string, unknown>)[EDUFLOW_HISTORY_KEY];
  if (!entry || typeof entry !== 'object') return null;
  const candidate = entry as Record<string, unknown>;
  if ((candidate.role !== 'student' && candidate.role !== 'lecturer' && candidate.role !== 'admin')
    || typeof candidate.page !== 'string'
    || typeof candidate.path !== 'string'
    || (candidate.parentPath !== undefined && typeof candidate.parentPath !== 'string')) {
    return null;
  }
  return {
    role: candidate.role,
    page: candidate.page as Page,
    path: candidate.path,
    ...(typeof candidate.parentPath === 'string' ? { parentPath: candidate.parentPath } : {}),
  };
}

function createHistoryState(
  history: HistoryPort,
  role: Role,
  page: Page,
  path: string,
  parentPath?: string,
) {
  const currentState = history.state;
  const baseState = currentState && typeof currentState === 'object' && !Array.isArray(currentState)
    ? currentState as Record<string, unknown>
    : {};
  return {
    ...baseState,
    [EDUFLOW_HISTORY_KEY]: { role, page, path, ...(parentPath ? { parentPath } : {}) },
  };
}

export function replaceAppHistoryRoute(
  history: HistoryPort,
  role: Role,
  page: Page,
  path: string,
) {
  const currentEntry = readEduFlowHistoryEntry(history.state);
  const parentPath = currentEntry?.role === role ? currentEntry.parentPath : undefined;
  history.replaceState(createHistoryState(history, role, page, path, parentPath), '', path);
}

export function pushAppHistoryRoute(
  history: HistoryPort,
  role: Role,
  page: Page,
  path: string,
  currentPath: string,
  dashboardPath: string,
) {
  const currentEntry = readEduFlowHistoryEntry(history.state);
  const parentPath = currentEntry?.role === role && currentEntry.path === currentPath
    ? currentPath
    : dashboardPath;
  history.pushState(createHistoryState(history, role, page, path, parentPath), '', path);
}

export function ensureAppHistoryRoute(
  history: HistoryPort,
  role: Role,
  page: Page,
  path: string,
  dashboardPath: string,
) {
  const currentEntry = readEduFlowHistoryEntry(history.state);
  if (currentEntry?.role === role && currentEntry.page === page && currentEntry.path === path) return;
  if (page === 'dashboard') {
    history.replaceState(createHistoryState(history, role, page, path), '', path);
    return;
  }
  history.replaceState(
    createHistoryState(history, role, 'dashboard', dashboardPath),
    '',
    dashboardPath,
  );
  history.pushState(
    createHistoryState(history, role, page, path, dashboardPath),
    '',
    path,
  );
}
