import type { StudentProgressAverage, StudentProgressClass } from '@/api/schoolApi';

export interface StudentDashboardGradeSummary {
  subjectScores: { subject: string; average: number | null }[];
  allAverage: number | null;
}

export function getStudentDashboardGradeSummary(
  progressClass: Pick<StudentProgressClass, 'subjects'> | null,
  officialAverages: Pick<StudentProgressAverage, 'subject' | 'average'>[],
): StudentDashboardGradeSummary {
  if (!progressClass) return { subjectScores: [], allAverage: null };

  const subjectNames = [...new Set([
    ...progressClass.subjects,
    ...officialAverages.map((item) => item.subject),
  ])];
  const subjectScores = subjectNames
    .map((subject) => {
      const averages = officialAverages
        .flatMap((item) => item.subject === subject && item.average !== null ? [item.average] : []);
      return {
        subject,
        average: averages.length > 0
          ? averages.reduce((sum, average) => sum + average, 0) / averages.length
          : null,
      };
    })
    .sort((first, second) => (second.average ?? -Infinity) - (first.average ?? -Infinity));
  const scoredSubjects = subjectScores.filter(
    (item): item is { subject: string; average: number } => item.average !== null,
  );
  const allAverage = scoredSubjects.length > 0
    ? scoredSubjects.reduce((sum, item) => sum + item.average, 0) / scoredSubjects.length
    : null;

  return { subjectScores, allAverage };
}
