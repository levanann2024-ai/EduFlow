import type { ReactNode } from 'react';
import { AppLanguageContext } from './AppLanguageContext';
import type { AppLanguage } from '@/settings/userSettings';

export function AppLanguageProvider({ language, children }: { language: AppLanguage; children: ReactNode }) {
  return <AppLanguageContext.Provider value={language}>{children}</AppLanguageContext.Provider>;
}
