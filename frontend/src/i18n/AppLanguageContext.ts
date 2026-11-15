import { createContext, useContext } from 'react';
import type { AppLanguage } from '@/settings/userSettings';

export const AppLanguageContext = createContext<AppLanguage>('vi');

export function useAppLanguage() {
  return useContext(AppLanguageContext);
}
