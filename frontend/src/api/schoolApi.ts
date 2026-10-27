import { authenticatedFetch } from '@/auth/authApi';

export interface SchoolClass {
  id: string;
  school_id: string;
  code: string;
  name: string;
  grade: string;
  academic_year: string;
  status: string;
  school_name: string;
  is_homeroom: boolean;
  homeroom_subject: string | null;
}

export interface ClassStudent {
  id: string;
  fullName: string;
  email: string;
  grade: string | null;
  studentNumber: string | null;
}

export type TermGrades = {
  regular: (number | null)[];
  midterm: number | null;
  final: number | null;
};

export interface GradebookStudent extends ClassStudent {
  grades: TermGrades;
  confirmedAverage: number | null;
  previousConfirmedAverage: number | null;
  assignments: {
    total: number;
    submitted: number;
    overdueMissing: number;
  };
}

export interface HomeroomGradeSummary {
  classId: string;
  academicYear: string;
  semester: string;
  homeroomSubject: string;
  subjects: string[];
  students: Array<{
    id: string;
    fullName: string;
    averages: Record<string, number | null>;
  }>;
}

function isHomeroomGradeSummary(
  value: unknown,
  classId: string,
  academicYear: string,
  semester: string,
): value is HomeroomGradeSummary {
  if (!isRecord(value)
    || value.classId !== classId
    || value.academicYear !== academicYear
    || value.semester !== semester
    || typeof value.homeroomSubject !== 'string'
    || !Array.isArray(value.subjects)
    || !Array.isArray(value.students)) {
    return false;
  }
  const subjects = value.subjects;
  if (!subjects.every((subject): subject is string => typeof subject === 'string')) return false;
  return value.students.every((student) => {
    if (!isRecord(student)
      || typeof student.id !== 'string'
      || typeof student.fullName !== 'string'
      || !isRecord(student.averages)) {
      return false;
    }
    const averages = student.averages;
    return subjects.every((subject) => (
      averages[subject] === null
      || (typeof averages[subject] === 'number' && Number.isFinite(averages[subject]))
    ));
  });
}

export interface ClassAssignment {
  id: string;
  title: string;
  description: string;
  subject: string;
  academicYear: string;
  semester: string;
  chapter: string;
  lesson: string;
  period: string | null;
  dueAt: string;
  createdAt?: string;
  studentCount: number;
  submittedCount: number;
  students: AssignmentStudentStatus[];
}

export interface AssignmentStudentStatus {
  id: string;
  fullName: string;
  submittedAt: string | null;
  score: number | null;
  gradedAt: string | null;
}

export interface AssignmentSubmission {
  studentId: string;
  studentName: string;
  responseText: string | null;
  submittedAt: string | null;
  score: number | null;
  teacherFeedback: string;
  gradedAt: string | null;
}

export interface StudentAssignment extends Omit<ClassAssignment, 'studentCount' | 'submittedCount' | 'students'> {
  classId: string;
  className: string;
  classCode: string;
  teacherName: string;
  responseText: string | null;
  submittedAt: string | null;
  score: number | null;
  teacherFeedback: string;
  gradedAt: string | null;
}

export interface ClassLearningResource {
  id: string;
  classId: string;
  subject: string;
  academicYear: string;
  semester: string;
  chapter: string;
  lesson: string;
  period: string | null;
  title: string;
  content: string;
  note: string;
  createdAt: string;
  files: LearningResourceFile[];
}

export interface LearningResourceFile {
  id: string;
  name: string;
  mediaType: string;
  sizeBytes: number;
}

export interface StudentLearningResource extends ClassLearningResource {
  className: string;
  classCode: string;
  teacherName: string;
}

export class SchoolApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'SchoolApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
  }

  if (!isRecord(body)) {
    throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
  }

  if (!response.ok || body.success !== true) {
    throw new SchoolApiError(
      typeof body.message === 'string' ? body.message : 'Không thể tải dữ liệu lớp học.',
      response.status,
      typeof body.code === 'string' ? body.code : undefined,
    );
  }

  return body;
}

function isSchoolClass(value: unknown): value is SchoolClass {
  return isRecord(value)
    && ['id', 'school_id', 'code', 'name', 'grade', 'academic_year', 'status', 'school_name']
      .every((field) => typeof value[field] === 'string')
    && typeof value.is_homeroom === 'boolean'
    && (typeof value.homeroom_subject === 'string' || value.homeroom_subject === null);
}

function isClassStudent(value: unknown): value is ClassStudent {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.fullName === 'string'
    && typeof value.email === 'string'
    && (typeof value.grade === 'string' || value.grade === null)
    && (typeof value.studentNumber === 'string' || value.studentNumber === null);
}

export async function listClasses(): Promise<SchoolClass[]> {
  const response = await authenticatedFetch('/api/classes', { method: 'GET' });
  const body = await readResponse(response);
  if (!Array.isArray(body.classes) || !body.classes.every(isSchoolClass)) {
    throw new Error('Phản hồi danh sách lớp không đúng định dạng.');
  }
  return body.classes;
}

export async function getClass(classId: string): Promise<SchoolClass> {
  const response = await authenticatedFetch(`/api/classes/${encodeURIComponent(classId)}`, { method: 'GET' });
  const body = await readResponse(response);
  if (!isSchoolClass(body.class)) {
    throw new Error('Phản hồi chi tiết lớp không đúng định dạng.');
  }
  return body.class;
}

export async function listClassStudents(classId: string): Promise<ClassStudent[]> {
  const response = await authenticatedFetch(`/api/classes/${encodeURIComponent(classId)}/students`, { method: 'GET' });
  const body = await readResponse(response);
  if (!Array.isArray(body.students) || !body.students.every(isClassStudent)) {
    throw new Error('Phản hồi danh sách học sinh không đúng định dạng.');
  }
  return body.students;
}

export async function listClassSubjects(classId: string): Promise<string[]> {
  const response = await authenticatedFetch(`/api/classes/${encodeURIComponent(classId)}/subjects`, { method: 'GET' });
  const body = await readResponse(response);
  if (!Array.isArray(body.subjects) || !body.subjects.every((subject) => typeof subject === 'string')) {
    throw new Error('Phản hồi môn học được phân công không đúng định dạng.');
  }
  return body.subjects;
}

export async function getClassGradebook(
  classId: string,
  academicYear: string,
  semester: string,
  subject: string,
): Promise<GradebookStudent[]> {
  const query = new URLSearchParams({ academicYear, semester, subject });
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/gradebook?${query.toString()}`,
    { method: 'GET' },
  );
  const body = await readResponse(response);
  if (!Array.isArray(body.students) || !body.students.every(isGradebookStudent)) {
    throw new Error('Phản hồi sổ điểm không đúng định dạng.');
  }
  return body.students;
}

export async function getHomeroomClassGradeSummary(
  classId: string,
  academicYear: string,
  semester: string,
): Promise<HomeroomGradeSummary> {
  const query = new URLSearchParams({ academicYear, semester });
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/homeroom-gradebook?${query.toString()}`,
    { method: 'GET' },
  );
  const body = await readResponse(response);
  if (!isHomeroomGradeSummary(body.summary, classId, academicYear, semester)) {
    throw new Error('Phản hồi tổng hợp điểm lớp chủ nhiệm không đúng định dạng.');
  }
  return body.summary;
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isTermGrades(value: unknown): value is TermGrades {
  return isRecord(value)
    && Array.isArray(value.regular)
    && value.regular.length === 4
    && value.regular.every(isNumberOrNull)
    && isNumberOrNull(value.midterm)
    && isNumberOrNull(value.final);
}

function isGradebookStudent(value: unknown): value is GradebookStudent {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.fullName === 'string'
    && typeof value.email === 'string'
    && (typeof value.grade === 'string' || value.grade === null)
    && (typeof value.studentNumber === 'string' || value.studentNumber === null)
    && isTermGrades(value.grades)
    && isNumberOrNull(value.confirmedAverage)
    && isNumberOrNull(value.previousConfirmedAverage)
    && isRecord(value.assignments)
    && typeof value.assignments.total === 'number'
    && typeof value.assignments.submitted === 'number'
    && typeof value.assignments.overdueMissing === 'number';
}

async function parseAssignmentResponse(response: Response): Promise<Record<string, unknown>> {
  const body = await readResponse(response);
  return body;
}

function isClassAssignment(value: unknown): value is ClassAssignment {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.subject === 'string'
    && typeof value.academicYear === 'string'
    && typeof value.semester === 'string'
    && typeof value.chapter === 'string'
    && typeof value.lesson === 'string'
    && (value.period === null || typeof value.period === 'string')
    && typeof value.dueAt === 'string'
    && (value.createdAt === undefined || typeof value.createdAt === 'string')
    && typeof value.studentCount === 'number'
    && typeof value.submittedCount === 'number'
    && Array.isArray(value.students)
    && value.students.every((student) => isRecord(student)
      && typeof student.id === 'string'
      && typeof student.fullName === 'string'
      && (student.submittedAt === null || typeof student.submittedAt === 'string')
      && (student.score === null || (typeof student.score === 'number' && Number.isFinite(student.score)))
      && (student.gradedAt === null || typeof student.gradedAt === 'string'));
}

function isAssignmentSubmission(value: unknown): value is AssignmentSubmission {
  return isRecord(value)
    && typeof value.studentId === 'string'
    && typeof value.studentName === 'string'
    && (value.responseText === null || typeof value.responseText === 'string')
    && (value.submittedAt === null || typeof value.submittedAt === 'string')
    && (value.score === null || (typeof value.score === 'number' && Number.isFinite(value.score)))
    && typeof value.teacherFeedback === 'string'
    && (value.gradedAt === null || typeof value.gradedAt === 'string');
}

export async function saveStudentGrades(
  classId: string,
  studentId: string,
  payload: {
    academicYear: string;
    semester: string;
    subject: string;
    regular: (number | null)[];
    midterm: number | null;
    final: number | null;
  },
): Promise<number | null> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/gradebook/${encodeURIComponent(studentId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const body = await readResponse(response);
  if (body.average !== null && (typeof body.average !== 'number' || !Number.isFinite(body.average))) {
    throw new Error('Phản hồi điểm TBM đã lưu không đúng định dạng.');
  }
  return body.average;
}

export async function saveClassGradebook(
  classId: string,
  payload: {
    academicYear: string;
    semester: string;
    subject: string;
    entries: Array<{
      studentId: string;
      regular: (number | null)[];
      midterm: number | null;
      final: number | null;
    }>;
  },
): Promise<Array<{ studentId: string; average: number | null }>> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/gradebook`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const body = await readResponse(response);
  if (!Array.isArray(body.saved) || !body.saved.every((item) => (
    isRecord(item)
    && typeof item.studentId === 'string'
    && isNumberOrNull(item.average)
  ))) {
    throw new Error('Phản hồi lưu bảng điểm không đúng định dạng.');
  }
  return body.saved;
}

export async function listClassAssignments(
  classId: string,
  academicYear: string,
  semester: string,
  subject: string,
): Promise<ClassAssignment[]> {
  const query = new URLSearchParams({ academicYear, semester, subject });
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/assignments?${query.toString()}`,
    { method: 'GET' },
  );
  const body = await parseAssignmentResponse(response);
  if (!Array.isArray(body.assignments) || !body.assignments.every(isClassAssignment)) {
    throw new Error('Phản hồi danh sách bài tập không đúng định dạng.');
  }
  return body.assignments;
}

export async function listClassAssignmentSubmissions(
  classId: string,
  assignmentId: string,
): Promise<AssignmentSubmission[]> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/assignments/${encodeURIComponent(assignmentId)}/submissions`,
    { method: 'GET' },
  );
  const body = await parseAssignmentResponse(response);
  if (body.assignmentId !== assignmentId
    || !Array.isArray(body.submissions)
    || !body.submissions.every(isAssignmentSubmission)) {
    throw new Error('Phản hồi danh sách bài nộp không đúng định dạng.');
  }
  return body.submissions;
}

export async function saveClassAssignmentGrade(
  classId: string,
  assignmentId: string,
  studentId: string,
  input: { score: number; teacherFeedback: string },
): Promise<{ score: number; teacherFeedback: string; gradedAt: string }> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/assignments/${encodeURIComponent(assignmentId)}`
      + `/submissions/${encodeURIComponent(studentId)}/grade`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  const body = await parseAssignmentResponse(response);
  const grade = body.grade;
  if (!isRecord(grade)
    || typeof grade.score !== 'number'
    || typeof grade.teacherFeedback !== 'string'
    || typeof grade.gradedAt !== 'string') {
    throw new Error('Phản hồi lưu điểm không đúng định dạng.');
  }
  return {
    score: grade.score,
    teacherFeedback: grade.teacherFeedback,
    gradedAt: grade.gradedAt,
  };
}

export async function createClassAssignment(
  classId: string,
  input: {
    academicYear: string;
    semester: string;
    subject: string;
    chapter?: string;
    lesson?: string;
    period?: string | null;
    title: string;
    description: string;
    dueAt: string;
  },
): Promise<void> {
  const response = await authenticatedFetch(`/api/classes/${encodeURIComponent(classId)}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  await readResponse(response);
}

interface RawClassLearningResource {
  id: string;
  class_id: string;
  subject: string;
  academic_year: string;
  semester: string;
  chapter: string;
  lesson: string;
  period: string | null;
  title: string;
  content: string;
  note: string;
  created_at: string;
  files: LearningResourceFile[];
}

function isLearningResourceFile(value: unknown): value is LearningResourceFile {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.mediaType === 'string'
    && typeof value.sizeBytes === 'number';
}

function isClassLearningResource(value: unknown): value is RawClassLearningResource {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.class_id === 'string'
    && typeof value.subject === 'string'
    && typeof value.academic_year === 'string'
    && typeof value.semester === 'string'
    && typeof value.chapter === 'string'
    && typeof value.lesson === 'string'
    && (value.period === null || typeof value.period === 'string')
    && typeof value.title === 'string'
    && typeof value.content === 'string'
    && typeof value.note === 'string'
    && typeof value.created_at === 'string'
    && Array.isArray(value.files)
    && value.files.every(isLearningResourceFile);
}

function mapClassLearningResource(value: RawClassLearningResource): ClassLearningResource {
  return {
    id: value.id,
    classId: value.class_id,
    subject: value.subject,
    academicYear: value.academic_year,
    semester: value.semester,
    chapter: value.chapter,
    lesson: value.lesson,
    period: value.period,
    title: value.title,
    content: value.content,
    note: value.note,
    createdAt: value.created_at,
    files: value.files,
  };
}

export async function listClassLearningResources(classId: string): Promise<ClassLearningResource[]> {
  const response = await authenticatedFetch(`/api/classes/${encodeURIComponent(classId)}/resources`, { method: 'GET' });
  const body = await readResponse(response);
  if (!Array.isArray(body.resources) || !body.resources.every(isClassLearningResource)) {
    throw new Error('Phản hồi tài liệu lớp không đúng định dạng.');
  }
  return body.resources.map(mapClassLearningResource);
}

export async function renameClassLearningResourceChapter(
  classId: string,
  chapter: string,
  input: { academicYear: string; semester: string; subject: string; newChapter: string },
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/resource-chapters/${encodeURIComponent(chapter)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  await readResponse(response);
}

export async function deleteClassLearningResourceChapter(
  classId: string,
  chapter: string,
  input: { academicYear: string; semester: string; subject: string },
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/resource-chapters/${encodeURIComponent(chapter)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  await readResponse(response);
}

export async function createClassLearningResource(
  classId: string,
  input: {
    academicYear: string;
    semester: string;
    subject: string;
    chapter: string;
    lesson: string;
    period: string | null;
    title: string;
    content: string;
    note: string;
  },
): Promise<void> {
  const response = await authenticatedFetch(`/api/classes/${encodeURIComponent(classId)}/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  await readResponse(response);
}

export async function updateClassLearningResource(
  classId: string,
  resourceId: string,
  input: {
    academicYear: string;
    semester: string;
    subject: string;
    chapter: string;
    lesson: string;
    period: string | null;
    title: string;
    content: string;
    note: string;
    fileName?: string;
    file?: File;
  },
): Promise<void> {
  const formData = new FormData();
  formData.set('academicYear', input.academicYear);
  formData.set('semester', input.semester);
  formData.set('subject', input.subject);
  formData.set('chapter', input.chapter);
  formData.set('lesson', input.lesson);
  formData.set('period', input.period ?? '');
  formData.set('title', input.title);
  formData.set('content', input.content);
  formData.set('note', input.note);
  if (input.fileName !== undefined) formData.set('fileName', input.fileName);
  if (input.file) formData.set('file', input.file, input.file.name);
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/resources/${encodeURIComponent(resourceId)}`,
    {
      method: 'PUT',
      body: formData,
    },
  );
  await readResponse(response);
}

export async function uploadClassLearningResource(
  classId: string,
  input: {
    academicYear: string;
    semester: string;
    subject: string;
    chapter: string;
    lesson: string;
    period: string | null;
    title: string;
    note: string;
    file: File;
  },
): Promise<void> {
  const formData = new FormData();
  formData.set('academicYear', input.academicYear);
  formData.set('semester', input.semester);
  formData.set('subject', input.subject);
  formData.set('chapter', input.chapter);
  formData.set('lesson', input.lesson);
  formData.set('period', input.period ?? '');
  formData.set('title', input.title);
  formData.set('note', input.note);
  formData.set('file', input.file, input.file.name);
  const response = await authenticatedFetch(`/api/classes/${encodeURIComponent(classId)}/resources/upload`, {
    method: 'POST',
    body: formData,
  });
  await readResponse(response);
}

export async function downloadClassLearningResourceFile(resourceId: string, fileId: string): Promise<Blob> {
  const response = await authenticatedFetch(
    `/api/resources/${encodeURIComponent(resourceId)}/files/${encodeURIComponent(fileId)}`,
    { method: 'GET' },
  );
  if (!response.ok) {
    let message = 'Không thể tải tệp tài liệu.';
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && typeof body.message === 'string') message = body.message;
    } catch {
      throw new Error(message);
    }
    throw new SchoolApiError(message, response.status);
  }
  return response.blob();
}

function isStudentAssignment(value: unknown): value is StudentAssignment {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.subject === 'string'
    && typeof value.academicYear === 'string'
    && typeof value.semester === 'string'
    && typeof value.chapter === 'string'
    && typeof value.lesson === 'string'
    && (value.period === null || typeof value.period === 'string')
    && typeof value.dueAt === 'string'
    && (value.createdAt === undefined || typeof value.createdAt === 'string')
    && typeof value.classId === 'string'
    && typeof value.className === 'string'
    && typeof value.classCode === 'string'
    && typeof value.teacherName === 'string'
    && (value.responseText === null || typeof value.responseText === 'string')
    && (value.submittedAt === null || typeof value.submittedAt === 'string')
    && (value.score === null || (typeof value.score === 'number' && Number.isFinite(value.score)))
    && typeof value.teacherFeedback === 'string'
    && (value.gradedAt === null || typeof value.gradedAt === 'string');
}

function isStudentLearningResource(value: unknown): value is StudentLearningResource {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.classId === 'string'
    && typeof value.className === 'string'
    && typeof value.classCode === 'string'
    && typeof value.subject === 'string'
    && typeof value.academicYear === 'string'
    && typeof value.semester === 'string'
    && typeof value.chapter === 'string'
    && typeof value.lesson === 'string'
    && (value.period === null || typeof value.period === 'string')
    && typeof value.title === 'string'
    && typeof value.content === 'string'
    && typeof value.note === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.teacherName === 'string'
    && Array.isArray(value.files)
    && value.files.every(isLearningResourceFile);
}

export async function listStudentLearningResources(): Promise<StudentLearningResource[]> {
  const response = await authenticatedFetch('/api/student/resources', { method: 'GET' });
  const body = await readResponse(response);
  if (!Array.isArray(body.resources) || !body.resources.every(isStudentLearningResource)) {
    throw new Error('Phản hồi tài liệu học sinh không đúng định dạng.');
  }
  return body.resources;
}

export async function listStudentAssignments(): Promise<StudentAssignment[]> {
  const response = await authenticatedFetch('/api/assignments', { method: 'GET' });
  const body = await parseAssignmentResponse(response);
  if (!Array.isArray(body.assignments) || !body.assignments.every(isStudentAssignment)) {
    throw new Error('Phản hồi bài tập học sinh không đúng định dạng.');
  }
  return body.assignments;
}

export async function submitAssignment(assignmentId: string, responseText: string): Promise<void> {
  const response = await authenticatedFetch(
    `/api/assignments/${encodeURIComponent(assignmentId)}/submission`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responseText }),
    },
  );
  await readResponse(response);
}
