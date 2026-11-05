import type { Role } from '@/types';

const ONBOARDING_VERSION = 'v1';

function onboardingKey(userId: string, role: Role) {
  return `eduflow-onboarding-${ONBOARDING_VERSION}:${role}:${userId}`;
}

export function readOnboardingStatus(userId: string, role: Role) {
  try {
    return {
      completed: localStorage.getItem(onboardingKey(userId, role)) === 'completed',
      error: '',
    };
  } catch (error) {
    return {
      completed: false,
      error: error instanceof Error ? error.message : 'Không thể đọc trạng thái hướng dẫn trên thiết bị này.',
    };
  }
}

export function saveOnboardingCompletion(userId: string, role: Role) {
  try {
    localStorage.setItem(onboardingKey(userId, role), 'completed');
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : 'Không thể lưu trạng thái hướng dẫn trên thiết bị này.';
  }
}
