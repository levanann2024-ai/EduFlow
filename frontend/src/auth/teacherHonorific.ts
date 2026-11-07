export type TeacherGender = 'female' | 'male' | 'other' | 'unspecified' | null | undefined;

export function getTeacherHonorific(gender: TeacherGender): 'thầy' | 'cô' | null {
  if (gender === 'female') return 'cô';
  if (gender === 'male') return 'thầy';
  return null;
}
