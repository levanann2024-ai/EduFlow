import type { StudentProgressAverage, StudentProgressClass, StudentProgressData } from '@/api/schoolApi';
import { getStudentSubjectCode, getStudentSubjectSlug } from '@/pages/student/studentSubjectRoutes';

export interface StudentDashboardGradeSummary {
  subjectScores: { subject: string; average: number | null }[];
  allAverage: number | null;
}

export interface StudentDashboardSubject {
  name: string;
  artworkKey: string;
  resources: number;
  assignments: number;
}

export function getStudentDashboardSubjects(
  progress: Pick<StudentProgressData, 'classes' | 'resources' | 'assignments'> | null,
): StudentDashboardSubject[] {
  if (!progress) return [];

  const subjectNames = [...new Set(progress.classes.flatMap((classItem) => classItem.subjects))];
  return subjectNames.map((name) => {
    const normalizedName = name.trim().toLocaleLowerCase('vi');
    return {
      name,
      artworkKey: getStudentSubjectCode(getStudentSubjectSlug(name)) ?? name,
      resources: progress.resources.filter((resource) => (
        resource.subject.trim().toLocaleLowerCase('vi') === normalizedName
      )).length,
      assignments: progress.assignments.filter((assignment) => (
        assignment.subject.trim().toLocaleLowerCase('vi') === normalizedName
      )).length,
    };
  });
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
