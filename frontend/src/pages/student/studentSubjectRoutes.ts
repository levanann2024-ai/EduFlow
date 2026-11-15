const studentSubjects = [
  { slug: 'math', code: 'TOAN10', aliases: ['TOAN', 'MATH'] },
  { slug: 'literature', code: 'VAN10', aliases: ['NGUVAN', 'VAN', 'LITERATURE'] },
  { slug: 'physics', code: 'LY10', aliases: ['VATLY', 'LY', 'PHYSICS'] },
  { slug: 'chemistry', code: 'HOA10', aliases: ['HOAHOC', 'HOA', 'CHEMISTRY'] },
  { slug: 'english', code: 'ANH10', aliases: ['TIENGANH', 'ANH', 'ENGLISH'] },
  { slug: 'informatics', code: 'TIN10', aliases: ['TINHOC', 'TIN', 'INFORMATICS', 'COMPUTERSCIENCE'] },
  { slug: 'biology', code: 'SINH10', aliases: ['SINHHOC', 'SINH', 'BIOLOGY'] },
  { slug: 'history', code: 'SU10', aliases: ['LICHSU', 'SU', 'HISTORY'] },
  { slug: 'geography', code: 'DIA10', aliases: ['DIALY', 'DIA', 'GEOGRAPHY'] },
  { slug: 'physical-education', code: 'GDTC10', aliases: ['GIAODUCTHECHAT', 'GDTC', 'PHYSICALEDUCATION'] },
] as const;

function normalizeSubject(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('vi').replace(/[^A-Z0-9]/g, '');
}

export function getStudentSubjectSlug(value: string) {
  const normalized = normalizeSubject(value);
  const knownSubject = studentSubjects.find(({ aliases }) => (
    aliases.some((alias) => normalized === alias || normalized.startsWith(alias))
  ));
  if (knownSubject) return knownSubject.slug;
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getStudentSubjectCode(slug: string) {
  return studentSubjects.find((subject) => subject.slug === slug.toLocaleLowerCase('vi'))?.code ?? null;
}
