import type { Role } from '@/types';
import type { CSSProperties } from 'react';

export type AppLanguage = 'vi' | 'en';
export type BackgroundPreset = 'default' | 'aurora' | 'mint' | 'sunset' | 'ocean' | 'custom';
export type ExplanationStyle = 'concise' | 'detailed';

export const MIN_FONT_SCALE_PERCENT = 85;
export const MAX_FONT_SCALE_PERCENT = 115;
export const FONT_SCALE_STEP_PERCENT = 5;

export interface UserSettings {
  avatar: string;
  background: BackgroundPreset;
  backgroundUrl: string;
  animationsEnabled: boolean;
  language: AppLanguage;
  fontScalePercent: number;
  explanationStyle: ExplanationStyle;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  avatar: '',
  background: 'default',
  backgroundUrl: '',
  animationsEnabled: true,
  language: 'vi',
  fontScalePercent: 100,
  explanationStyle: 'concise',
};

const STUDY_PREFERENCES_KEY = 'eduflow.student.preferences';
const TEACHER_PREFERENCES_KEY = 'eduflow.teacher.preferences';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validBackground(value: unknown): value is BackgroundPreset {
  return ['default', 'aurora', 'mint', 'sunset', 'ocean', 'custom'].includes(String(value));
}

function validFontScalePercent(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= MIN_FONT_SCALE_PERCENT
    && value <= MAX_FONT_SCALE_PERCENT
    && (value - MIN_FONT_SCALE_PERCENT) % FONT_SCALE_STEP_PERCENT === 0;
}

export function readUserSettings(userId: string, role: Role): { settings: UserSettings; error: string } {
  let settings = { ...DEFAULT_USER_SETTINGS };
  let error = '';

  try {
    const stored = localStorage.getItem(`eduflow.user-settings.${userId}`);
    const hasUserSettings = Boolean(stored);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (!isRecord(parsed)) throw new Error('Dữ liệu cài đặt tài khoản không hợp lệ.');
      settings = {
        ...settings,
        ...(typeof parsed.avatar === 'string' ? { avatar: parsed.avatar } : {}),
        ...(validBackground(parsed.background) ? { background: parsed.background } : {}),
        ...(typeof parsed.backgroundUrl === 'string' ? { backgroundUrl: parsed.backgroundUrl } : {}),
        ...(typeof parsed.animationsEnabled === 'boolean' ? { animationsEnabled: parsed.animationsEnabled } : {}),
        ...(parsed.language === 'vi' || parsed.language === 'en' ? { language: parsed.language } : {}),
        ...(validFontScalePercent(parsed.fontScalePercent) ? { fontScalePercent: parsed.fontScalePercent } : {}),
        ...(parsed.explanationStyle === 'concise' || parsed.explanationStyle === 'detailed'
          ? { explanationStyle: parsed.explanationStyle }
          : {}),
      };
    }

    if (settings.avatar.length > 500_000 || settings.backgroundUrl.length > 2048) {
      throw new Error('Ảnh đại diện hoặc địa chỉ nền đã lưu vượt quá giới hạn.');
    }

    if (settings.avatar && !isSafeImageUrl(settings.avatar)) {
      throw new Error('Ảnh đại diện đã lưu không đúng định dạng.');
    }
    if (settings.backgroundUrl && !isSafeImageUrl(settings.backgroundUrl)) {
      throw new Error('Địa chỉ ảnh nền đã lưu không hợp lệ.');
    }

    if (!hasUserSettings && (role === 'student' || role === 'lecturer')) {
      const legacy = localStorage.getItem(role === 'student' ? STUDY_PREFERENCES_KEY : TEACHER_PREFERENCES_KEY);
      if (legacy) {
        const parsed: unknown = JSON.parse(legacy);
        if (isRecord(parsed)) {
          if (parsed.explanationStyle === 'concise' || parsed.explanationStyle === 'detailed') {
            settings.explanationStyle = parsed.explanationStyle;
          }
        }
      }
    }
  } catch (loadError) {
    error = loadError instanceof Error ? loadError.message : 'Không thể đọc cài đặt đã lưu.';
  }

  return { settings, error };
}

export function saveUserSettings(userId: string, settings: UserSettings, role: Role) {
  localStorage.setItem(`eduflow.user-settings.${userId}`, JSON.stringify(settings));
  if (role === 'student') {
    localStorage.setItem(STUDY_PREFERENCES_KEY, JSON.stringify({
      explanationStyle: settings.explanationStyle,
    }));
  } else if (role === 'lecturer') {
    localStorage.setItem(TEACHER_PREFERENCES_KEY, JSON.stringify({
      explanationStyle: settings.explanationStyle,
    }));
  }
  window.dispatchEvent(new CustomEvent('eduflow-user-settings-updated', { detail: { userId, settings } }));
}

export function readExplanationStyle(userId: string, role: Role): { style: ExplanationStyle; error: string } {
  try {
    const stored = localStorage.getItem(`eduflow.user-settings.${userId}`);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (!isRecord(parsed)) throw new Error('Thiết lập AI đã lưu không đúng định dạng.');
      if (parsed.explanationStyle === 'concise' || parsed.explanationStyle === 'detailed') {
        return { style: parsed.explanationStyle, error: '' };
      }
      if (parsed.explanationStyle !== undefined) throw new Error('Thiết lập AI đã lưu không đúng định dạng.');
    }

    if (role === 'student' || role === 'lecturer') {
      const legacy = localStorage.getItem(role === 'student' ? STUDY_PREFERENCES_KEY : TEACHER_PREFERENCES_KEY);
      if (legacy) {
        const parsed: unknown = JSON.parse(legacy);
        if (!isRecord(parsed) || (parsed.explanationStyle !== 'concise' && parsed.explanationStyle !== 'detailed')) {
          throw new Error('Thiết lập AI đã lưu không đúng định dạng.');
        }
        return { style: parsed.explanationStyle, error: '' };
      }
    }
    return { style: DEFAULT_USER_SETTINGS.explanationStyle, error: '' };
  } catch (error) {
    return {
      style: DEFAULT_USER_SETTINGS.explanationStyle,
      error: error instanceof Error ? error.message : 'Không thể đọc thiết lập AI.',
    };
  }
}

export function isSafeImageUrl(value: string) {
  if (value.startsWith('data:image/')) {
    return /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(value);
  }
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const backgroundPresets: Array<{
  id: BackgroundPreset;
  label: string;
  labelEn: string;
  style: CSSProperties;
}> = [
  { id: 'default', label: 'Mặc định', labelEn: 'Default', style: { backgroundColor: '#f8fafc' } },
  {
    id: 'aurora',
    label: 'Vở kẻ ngang',
    labelEn: 'Ruled notebook',
    style: {
      backgroundColor: '#fff4d9',
      backgroundImage: 'linear-gradient(90deg, transparent 0 52px, rgba(196, 91, 91, .36) 52px 54px, transparent 54px), repeating-linear-gradient(to bottom, transparent 0 31px, rgba(67, 112, 166, .3) 31px 32px)',
    },
  },
  {
    id: 'mint',
    label: 'Ô ly xanh',
    labelEn: 'Graph paper',
    style: {
      backgroundColor: '#e5f2e8',
      backgroundImage: 'linear-gradient(rgba(75, 131, 98, .23) 1px, transparent 1px), linear-gradient(90deg, rgba(75, 131, 98, .23) 1px, transparent 1px)',
      backgroundSize: '26px 26px',
    },
  },
  {
    id: 'sunset',
    label: 'Trang sách',
    labelEn: 'Book pages',
    style: {
      backgroundColor: '#f7e8dc',
      backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, .86) 0 3px, transparent 3.5px), linear-gradient(90deg, transparent 0 42px, rgba(181, 111, 81, .22) 42px 43px, transparent 43px)',
      backgroundSize: '34px 34px, 100% 100%',
    },
  },
  {
    id: 'ocean',
    label: 'Ghi chú xanh',
    labelEn: 'Blue notes',
    style: {
      backgroundColor: '#e3eefb',
      backgroundImage: 'radial-gradient(rgba(62, 105, 160, .42) 1.25px, transparent 1.5px)',
      backgroundSize: '22px 22px',
    },
  },
];

export function backgroundStyle(settings: UserSettings): CSSProperties {
  if (settings.background === 'custom' && settings.backgroundUrl && isSafeImageUrl(settings.backgroundUrl)) {
    return {
      backgroundImage: `linear-gradient(rgba(248,250,252,.90), rgba(248,250,252,.90)), url("${settings.backgroundUrl.replace(/["\\\n\r]/g, '')}")`,
      backgroundAttachment: 'fixed',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return backgroundPresets.find((preset) => preset.id === settings.background)?.style ?? {};
}
