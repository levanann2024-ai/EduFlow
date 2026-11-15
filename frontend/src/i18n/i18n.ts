import type { AppLanguage } from '@/settings/userSettings';
import { dynamicMessages } from './dynamicMessages';
import { messages } from './messages';
import { pageMessages } from './pageMessages';

export function t(language: AppLanguage, key: string, values: Record<string, string | number> = {}) {
  const message = dynamicMessages[language][key] ?? pageMessages[language][key] ?? messages[language][key] ?? key;
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder
  ));
}

export function studentLocale(language: AppLanguage) {
  return language === 'en' ? 'en-US' : 'vi-VN';
}

const englishSubjects: Record<string, string> = {
  'toán': 'Mathematics',
  'toán học': 'Mathematics',
  'ngữ văn': 'Literature',
  'văn học': 'Literature',
  'hóa học': 'Chemistry',
  'vật lý': 'Physics',
  'tiếng anh': 'English',
  'tin học': 'Computer Science',
  'sinh học': 'Biology',
  'lịch sử': 'History',
  'địa lý': 'Geography',
  'giáo dục thể chất': 'Physical Education',
};

export function localizeStudentSubject(subject: string, language: AppLanguage) {
  if (language !== 'en') return subject;
  const normalized = subject.trim().toLocaleLowerCase('vi');
  const matchedName = Object.keys(englishSubjects).find((name) => normalized.startsWith(name));
  if (!matchedName) return subject;
  return `${englishSubjects[matchedName]}${subject.slice(matchedName.length)}`;
}
