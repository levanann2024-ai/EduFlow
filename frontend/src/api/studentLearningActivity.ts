import { authenticatedFetch } from '@/auth/authApi';

export type StudentLearningActivityType =
  | 'resource_view'
  | 'assignment_submit'
  | 'exam_submit'
  | 'result_view'
  | 'ai_chat'
  | 'ai_practice';

export interface StudentWeeklyActivity {
  days: Array<{ date: string; count: number }>;
  activeDays: number;
  activityCount: number;
}

export async function recordStudentLearningActivity(activityType: StudentLearningActivityType): Promise<void> {
  const response = await authenticatedFetch('/api/student/learning-activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activityType, eventKey: crypto.randomUUID() }),
  });
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body) || body.success !== true) {
    throw new Error(isRecord(body) && typeof body.message === 'string'
      ? body.message
      : 'Không thể ghi nhận hoạt động học tập.');
  }
}

export async function getStudentWeeklyActivity(): Promise<StudentWeeklyActivity> {
  const response = await authenticatedFetch('/api/student/learning-activity', { method: 'GET' });
  const body: unknown = await response.json();
  const days = isRecord(body) ? body.days : null;
  if (!response.ok || !isRecord(body) || body.success !== true
    || !Array.isArray(days)
    || days.length !== 7
    || !days.every(isWeeklyActivityDay)
    || !Number.isInteger(body.activeDays)
    || !Number.isInteger(body.activityCount)
    || body.activeDays !== days.filter((day) => day.count > 0).length
    || body.activityCount !== days.reduce((total, day) => total + day.count, 0)) {
    throw new Error(isRecord(body) && typeof body.message === 'string'
      ? body.message
      : 'Dữ liệu hoạt động học tập không hợp lệ.');
  }
  return {
    days,
    activeDays: body.activeDays,
    activityCount: body.activityCount,
  };
}

function isWeeklyActivityDay(value: unknown): value is StudentWeeklyActivity['days'][number] {
  return isRecord(value)
    && typeof value.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
    && Number.isInteger(value.count)
    && Number(value.count) >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
