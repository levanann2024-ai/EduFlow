import { Trophy } from 'lucide-react';
import { StudentFeaturePage } from './StudentFeaturePage';
import { useAppLanguage } from '@/i18n/AppLanguageContext';
import { t } from '@/i18n/i18n';

export function Leaderboard() {
  const language = useAppLanguage();
  return (
    <StudentFeaturePage
      icon={Trophy}
      title={t(language, 'leaderboard.title')}
      description={t(language, 'leaderboard.description')}
    />
  );
}
