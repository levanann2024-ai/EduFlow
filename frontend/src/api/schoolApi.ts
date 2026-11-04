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
  student_count?: number;
  class_average?: number | null;
  pending_assignment_count?: number;
  subjects?: Array<{
    subject: string;
    teacherName: string | null;
    teacherGender?: 'female' | 'male' | 'other' | 'unspecified' | null;
  }>;
}

export type TeacherAssessmentKind = 'exam' | 'assignment';
export interface TeacherAssessmentRecord {
  id: string;
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
  averageHistory: Array<{
    average: number;
    recordedAt: string;
  }>;
  assignments: {
    total: number;
    submitted: number;
    overdueMissing: number;
  };
}

export interface TeacherProgressAnalysis {
  classOverview: string;
  learningAdvice: string;
  strengths: string[];
  focusAreas: string[];
  studentInsights: Array<{
    studentKey: string;
    level: 'support' | 'steady' | 'strong';
    insight: string;
    evidence: string[];
  }>;
  recommendations: Array<{
    type: 'assignment' | 'exam' | 'review' | 'classroom';
    title: string;
    action: string;
    reason: string;
  }>;
  limitations: string[];
}

export interface TeacherProgressAnalysisResult {
  scope: {
    classId: string;
    className: string;
    academicYear: string;
    semester: string;
    subject: string;
    isHomeroom: boolean;
  };
  crossSubjectSummary: Array<{
    subject: string;
    classAverage: number | null;
    studentsWithGrades: number;
  }> | null;
  students: Array<{
    studentId: string;
    fullName: string;
    studentKey: string;
  }>;
  analysis: TeacherProgressAnalysis;
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
  files: AssignmentSubmissionFile[];
  submittedAt: string | null;
  score: number | null;
  teacherFeedback: string;
  questionScores: Record<string, number>;
  questionFeedback: Record<string, string>;
  gradedAt: string | null;
}

export interface AssignmentSubmissionFile {
  id: string;
  name: string;
  mediaType: string;
  sizeBytes: number;
}

export interface StudentAssignment extends Omit<ClassAssignment, 'studentCount' | 'submittedCount' | 'students'> {
  classId: string;
  className: string;
  classCode: string;
  teacherName: string;
  responseText: string | null;
  files: AssignmentSubmissionFile[];
  submittedAt: string | null;
  score: number | null;
  teacherFeedback: string;
  questionScores: Record<string, number>;
  questionFeedback: Record<string, string>;
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

export interface StudentTimetable {
  semester: ProgressSemester;
  session: 'morning' | 'afternoon';
  effectiveFrom: string;
  periodCount: number;
  entries: Array<{
    weekday: number;
    period: number;
    subject: string;
    type?: 'lesson' | 'makeup' | 'homework' | 'exam' | 'exam_return';
    title?: string;
    topic?: string;
    dueAt?: string | null;
    hasHomework?: boolean;
    homeworkTitle?: string;
    homeworkDueAt?: string | null;
    hasExam?: boolean;
    examTitle?: string;
    examStartsAt?: string | null;
    hasExamReturn?: boolean;
    examReturnNote?: string;
    examReturnAt?: string | null;
  }>;
}

export interface StudentTimetableResponse {
  weekNumber: number | null;
  classroom: {
    id: string;
    code: string;
    name: string;
    academicYear: string;
  } | null;
  timetable: StudentTimetable | null;
}

export interface TeacherTimetableClass {
  id: string;
  code: string;
  name: string;
  grade: string;
  academicYear: string;
  isHomeroom: boolean;
  subjects: string[];
}

export type TimetableEntryType = 'lesson' | 'makeup' | 'homework' | 'exam' | 'exam_return' | 'cancelled';

export interface TeacherTimetableEntry {
  weekday: number;
  period: number;
  classId: string;
  classCode: string;
  className: string;
  isHomeroom: boolean;
  subject: string;
  type: TimetableEntryType;
  title: string;
  topic: string;
  dueAt: string | null;
  hasHomework: boolean;
  homeworkTitle: string;
  homeworkDueAt: string | null;
  hasExam: boolean;
  examTitle: string;
  examStartsAt: string | null;
  hasExamReturn: boolean;
  examReturnNote: string;
  examReturnAt: string | null;
}

export interface TeacherTimetableResponse {
  weekNumber: number | null;
  classes: TeacherTimetableClass[];
  timetable: {
    id: string;
    academicYear: string;
    semester: ProgressSemester;
    weekStart: string;
    session: 'morning' | 'afternoon';
    periodCount: number;
    status: 'draft' | 'published';
    isEstimated: boolean;
    isTemplate: boolean;
    dailyNote: string;
  } | null;
  entries: TeacherTimetableEntry[];
  upcomingWork: Array<{
    id: string;
    title: string;
    subject: string;
    dueAt: string;
    classId: string;
    classCode: string;
    submittedCount: number;
    ungradedCount: number;
  }>;
}

export interface StudentSubjectAverage {
  classId: string;
  className: string;
  classCode: string;
  academicYear: string;
  subject: string;
  average: number | null;
  regularScores?: (number | null)[];
  previousAverage: number | null;
  averageHistory?: Array<{
    average: number;
    recordedAt: string;
  }>;
}

export type ProgressSemester = 'Kỳ 1' | 'Kỳ 2';

export interface StudentProgressClass {
  id: string;
  name: string;
  code: string;
  grade: string;
  academicYear: string;
  subjects: string[];
}

export interface StudentProgressAverage extends StudentSubjectAverage {
  semester: ProgressSemester;
}

export interface StudentProgressScope {
  classId: string | null;
  academicYear: string | null;
  semester: ProgressSemester | 'Cả năm' | null;
  subject: string | null;
}

export interface StudentProgressResource {
  id: string;
  classId: string;
  subject: string;
  academicYear: string;
  semester: ProgressSemester;
  chapter: string;
  lesson: string;
  title: string;
}

export interface StudentProgressData {
  scope: StudentProgressScope;
  classes: StudentProgressClass[];
  officialAverages: StudentProgressAverage[];
  assignments: StudentAssignment[];
  examResults: StudentExamResult[];
  upcomingExams: Array<{
    id: string;
    classIds: string[];
    title: string;
    subject: string;
    startsAt: string;
  }>;
  resources: StudentProgressResource[];
  academicCalendar: {
    available: false;
    message: string;
  };
}

export interface StudentProgressAnalysis {
  overview: { text: string; evidenceIds: string[] };
  strengths: Array<{ text: string; evidenceIds: string[] }>;
  focusAreas: Array<{ topic: string; text: string; evidenceIds: string[] }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    evidenceIds: string[];
    resourceIds: string[];
  }>;
  roadmap: Array<{
    stage: string;
    goal: string;
    actions: string[];
    evaluation: string;
    evidenceIds: string[];
  }>;
  limitations: string[];
}

export interface StudentProgressFilters {
  classId?: string;
  academicYear?: string;
  semester?: ProgressSemester | 'Cả năm';
  subject?: string;
  assessmentId?: string;
}

export type StudentProgressAnalysisResponse =
  | { status: 'insufficient-data'; message: string; analysis: null }
  | { status: 'analyzed'; analysis: StudentProgressAnalysis; limitations: string[] };

export class SchoolApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'SchoolApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getAcademicYearWeekNumber(academicYear: string, weekStart?: string): number | null {
  const yearMatch = academicYear.match(/^(\d{4})-\d{4}$/);
  if (!yearMatch || !weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;

  const firstDay = new Date(Date.UTC(Number(yearMatch[1]), 8, 5));
  const weekday = firstDay.getUTCDay();
  firstDay.setUTCDate(firstDay.getUTCDate() - ((weekday + 6) % 7) + (weekday >= 5 || weekday === 0 ? 7 : 0));
  const selectedWeek = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(selectedWeek.getTime()) || selectedWeek.getUTCDay() !== 1
    || selectedWeek.toISOString().slice(0, 10) !== weekStart || selectedWeek < firstDay) {
    return null;
  }
  return Math.floor((selectedWeek.getTime() - firstDay.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function normalizeTimetableEntry(entry: unknown): unknown {
  if (!isRecord(entry)) return entry;
  const legacyType = entry.type;
  const homework = legacyType === 'homework';
  const exam = legacyType === 'exam';
  const examReturn = legacyType === 'exam_return';
  return {
    ...entry,
    type: homework || exam ? 'lesson' : legacyType,
    hasHomework: entry.hasHomework === undefined ? homework : entry.hasHomework,
    homeworkTitle: entry.homeworkTitle === undefined
      ? homework && typeof entry.title === 'string' ? entry.title : ''
      : entry.homeworkTitle,
    homeworkDueAt: entry.homeworkDueAt === undefined
      ? homework && (typeof entry.dueAt === 'string' || entry.dueAt === null) ? entry.dueAt : null
      : entry.homeworkDueAt,
    hasExam: entry.hasExam === undefined ? exam : entry.hasExam,
    examTitle: entry.examTitle === undefined
      ? exam && typeof entry.title === 'string' ? entry.title : ''
      : entry.examTitle,
    examStartsAt: entry.examStartsAt === undefined
      ? exam && (typeof entry.dueAt === 'string' || entry.dueAt === null) ? entry.dueAt : null
      : entry.examStartsAt,
    hasExamReturn: entry.hasExamReturn === undefined ? examReturn : entry.hasExamReturn,
    examReturnNote: entry.examReturnNote === undefined
      ? examReturn && typeof entry.title === 'string' ? entry.title : ''
      : entry.examReturnNote,
    examReturnAt: entry.examReturnAt === undefined
      ? examReturn && (typeof entry.dueAt === 'string' || entry.dueAt === null) ? entry.dueAt : null
      : entry.examReturnAt,
  };
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value)
    && Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item));
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
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
    && (typeof value.homeroom_subject === 'string' || value.homeroom_subject === null)
    && (value.student_count === undefined || (typeof value.student_count === 'number' && Number.isInteger(value.student_count) && value.student_count >= 0))
    && (value.class_average === undefined || value.class_average === null || (typeof value.class_average === 'number' && Number.isFinite(value.class_average)))
    && (value.pending_assignment_count === undefined || (typeof value.pending_assignment_count === 'number' && Number.isInteger(value.pending_assignment_count) && value.pending_assignment_count >= 0))
    && (value.subjects === undefined || (
      Array.isArray(value.subjects)
      && value.subjects.every((subject) => isRecord(subject)
        && typeof subject.subject === 'string'
        && (typeof subject.teacherName === 'string' || subject.teacherName === null)
        && (subject.teacherGender === undefined || subject.teacherGender === null
          || ['female', 'male', 'other', 'unspecified'].includes(String(subject.teacherGender))))
    ));
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

export async function listTeacherAssessments<T extends TeacherAssessmentRecord>(
  kind: TeacherAssessmentKind,
): Promise<T[]> {
  const response = await authenticatedFetch(
    `/api/teacher/assessments/${kind}`,
    { method: 'GET' },
  );
  const body = await readResponse(response);
  if (!Array.isArray(body.assessments) || !body.assessments.every((assessment) => (
    isRecord(assessment) && typeof assessment.id === 'string'
  ))) {
    throw new Error('Phản hồi danh sách nội dung đã lưu không đúng định dạng.');
  }
  return body.assessments as T[];
}

export async function saveTeacherAssessment<T extends TeacherAssessmentRecord>(
  kind: TeacherAssessmentKind,
  assessment: T,
): Promise<T> {
  const response = await authenticatedFetch(`/api/teacher/assessments/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assessment),
  });
  const body = await readResponse(response);
  if (!isRecord(body.assessment) || typeof body.assessment.id !== 'string') {
    throw new Error('Phản hồi lưu nội dung không đúng định dạng.');
  }
  return body.assessment as T;
}

export async function deleteTeacherAssessment(
  kind: TeacherAssessmentKind,
  clientId: string,
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/teacher/assessments/${kind}/${encodeURIComponent(clientId)}`,
    { method: 'DELETE' },
  );
  await readResponse(response);
}

export async function listTeacherExamRooms<T extends { id: string }>(): Promise<T[]> {
  const response = await authenticatedFetch('/api/teacher/exam-rooms', { method: 'GET' });
  const body = await readResponse(response);
  if (!Array.isArray(body.rooms) || !body.rooms.every((room) => (
    isRecord(room) && typeof room.id === 'string'
  ))) {
    throw new Error('Phản hồi danh sách phòng thi không đúng định dạng.');
  }
  return body.rooms as T[];
}

export interface TeacherExamGradingQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
  question: string;
  options: string[];
  correctIndex: number;
  correctAnswer: string;
  correctAnswers?: boolean[];
  points: number;
}

export interface TeacherExamGradingRoom {
  id: string;
  code: string;
  title: string;
  status: string;
  startsAt: string;
  classIds: string[];
  classNames: string[];
  examSnapshot: {
    subject: string;
    questions: TeacherExamGradingQuestion[];
  };
}

export interface TeacherExamSessionGrade {
  questionScores: Record<string, number>;
  questionFeedback: Record<string, string>;
  totalScore: number;
  teacherFeedback: string;
  evidenceFiles: TeacherExamGradeEvidenceFile[];
  gradedAt: string;
  publishedAt: string | null;
}

export interface TeacherExamGradeEvidenceFile {
  id: string;
  questionId: string;
  name: string;
  mediaType: string;
  sizeBytes: number;
}

export interface TeacherExamSubmissionFile {
  id: string;
  questionNumber: number;
  name: string;
  mediaType: string;
  sizeBytes: number;
}

export interface TeacherExamGradingStudent {
  studentId: string;
  studentName: string;
  className: string;
  sessionId: string | null;
  status: 'not-started' | 'in-progress' | 'review' | 'submitted';
  submittedAt: string | null;
  answers: Record<string, string>;
  files: TeacherExamSubmissionFile[];
  automaticScores: Record<string, number>;
  grade: TeacherExamSessionGrade | null;
}

function isTeacherExamSubmissionFile(value: unknown): value is TeacherExamSubmissionFile {
  return isRecord(value)
    && typeof value.id === 'string'
    && Number.isInteger(value.questionNumber)
    && typeof value.name === 'string'
    && typeof value.mediaType === 'string'
    && typeof value.sizeBytes === 'number';
}

function isTeacherExamGradingStudent(value: unknown): value is TeacherExamGradingStudent {
  return isRecord(value)
    && typeof value.studentId === 'string'
    && typeof value.studentName === 'string'
    && typeof value.className === 'string'
    && (typeof value.sessionId === 'string' || value.sessionId === null)
    && ['not-started', 'in-progress', 'review', 'submitted'].includes(String(value.status))
    && (typeof value.submittedAt === 'string' || value.submittedAt === null)
    && isRecord(value.answers)
    && Object.values(value.answers).every((answer) => typeof answer === 'string')
    && Array.isArray(value.files)
    && value.files.every(isTeacherExamSubmissionFile)
    && isRecord(value.automaticScores)
    && Object.values(value.automaticScores).every((score) => typeof score === 'number')
    && (value.grade === null || isTeacherExamSessionGrade(value.grade));
}

function isTeacherExamGradingRoom(value: unknown): value is TeacherExamGradingRoom {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.code === 'string'
    && typeof value.title === 'string'
    && typeof value.status === 'string'
    && typeof value.startsAt === 'string'
    && Array.isArray(value.classIds)
    && value.classIds.every((id) => typeof id === 'string')
    && Array.isArray(value.classNames)
    && value.classNames.every((name) => typeof name === 'string')
    && isRecord(value.examSnapshot)
    && typeof value.examSnapshot.subject === 'string'
    && Array.isArray(value.examSnapshot.questions)
    && value.examSnapshot.questions.every((question) => (
      isRecord(question)
      && typeof question.id === 'string'
      && ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(String(question.type))
      && typeof question.question === 'string'
      && Array.isArray(question.options)
      && question.options.every((option) => typeof option === 'string')
      && typeof question.correctIndex === 'number'
      && typeof question.correctAnswer === 'string'
      && (question.correctAnswers === undefined || (
        Array.isArray(question.correctAnswers)
        && question.correctAnswers.every((answer) => typeof answer === 'boolean')
      ))
      && typeof question.points === 'number'
    ));
}

function isTeacherExamSessionGrade(value: unknown): value is TeacherExamSessionGrade {
  return isRecord(value)
    && isRecord(value.questionScores)
    && Object.values(value.questionScores).every((score) => typeof score === 'number')
    && isRecord(value.questionFeedback)
    && Object.values(value.questionFeedback).every((feedback) => typeof feedback === 'string')
    && typeof value.totalScore === 'number'
    && typeof value.teacherFeedback === 'string'
    && Array.isArray(value.evidenceFiles)
    && value.evidenceFiles.every((file) => (
      isRecord(file)
      && typeof file.id === 'string'
      && typeof file.questionId === 'string'
      && typeof file.name === 'string'
      && typeof file.mediaType === 'string'
      && typeof file.sizeBytes === 'number'
    ))
    && typeof value.gradedAt === 'string'
    && (typeof value.publishedAt === 'string' || value.publishedAt === null);
}

export async function getTeacherExamRoomGrading(
  roomId: string,
): Promise<{ room: TeacherExamGradingRoom; students: TeacherExamGradingStudent[] }> {
  const response = await authenticatedFetch(
    `/api/teacher/exam-rooms/${encodeURIComponent(roomId)}/grading`,
    { method: 'GET' },
  );
  const body = await readResponse(response);
  if (!isTeacherExamGradingRoom(body.room)
    || !Array.isArray(body.students)
    || !body.students.every(isTeacherExamGradingStudent)) {
    throw new Error('Phản hồi dữ liệu chấm bài thi không đúng định dạng.');
  }
  return {
    room: body.room,
    students: body.students,
  };
}

export async function saveTeacherExamSessionGrade(
  roomId: string,
  sessionId: string,
  input: {
    questionScores: Record<string, number>;
    questionFeedback: Record<string, string>;
    teacherFeedback: string;
    evidenceFiles: Array<{ questionId: string; file: File }>;
    deletedEvidenceIds: string[];
  },
): Promise<TeacherExamSessionGrade> {
  const formData = new FormData();
  formData.append('questionScores', JSON.stringify(input.questionScores));
  formData.append('questionFeedback', JSON.stringify(input.questionFeedback));
  formData.append('teacherFeedback', input.teacherFeedback);
  formData.append('deletedEvidenceIds', JSON.stringify(input.deletedEvidenceIds));
  input.evidenceFiles.forEach(({ questionId, file }) => {
    formData.append('evidenceQuestionIds', questionId);
    formData.append('evidenceFiles', file);
  });
  const response = await authenticatedFetch(
    `/api/teacher/exam-rooms/${encodeURIComponent(roomId)}/sessions/${encodeURIComponent(sessionId)}/grade`,
    {
      method: 'PUT',
      body: formData,
    },
  );
  const body = await readResponse(response);
  if (!isTeacherExamSessionGrade(body.grade)) {
    throw new Error('Phản hồi lưu điểm thi không đúng định dạng.');
  }
  return body.grade;
}

export async function publishTeacherExamRoomGrades(
  roomId: string,
): Promise<{ publishedCount: number; totalPublishedCount: number; publishedAt: string }> {
  const response = await authenticatedFetch(
    `/api/teacher/exam-rooms/${encodeURIComponent(roomId)}/publish-grades`,
    { method: 'POST' },
  );
  const body = await readResponse(response);
  if (!isRecord(body.publication)
    || typeof body.publication.publishedCount !== 'number'
    || !Number.isInteger(body.publication.publishedCount)
    || typeof body.publication.totalPublishedCount !== 'number'
    || !Number.isInteger(body.publication.totalPublishedCount)
    || typeof body.publication.publishedAt !== 'string') {
    throw new Error('Phản hồi công bố điểm thi không đúng định dạng.');
  }
  return {
    publishedCount: body.publication.publishedCount,
    totalPublishedCount: body.publication.totalPublishedCount,
    publishedAt: body.publication.publishedAt,
  };
}

export async function downloadTeacherExamSubmissionFile(
  roomId: string,
  sessionId: string,
  fileId: string,
): Promise<Blob> {
  const response = await authenticatedFetch(
    `/api/teacher/exam-rooms/${encodeURIComponent(roomId)}/sessions/${encodeURIComponent(sessionId)}/files/${encodeURIComponent(fileId)}`,
    { method: 'GET' },
  );
  if (!response.ok) await readResponse(response);
  return response.blob();
}

export async function downloadTeacherExamGradeEvidenceFile(
  roomId: string,
  sessionId: string,
  fileId: string,
): Promise<Blob> {
  const response = await authenticatedFetch(
    `/api/teacher/exam-rooms/${encodeURIComponent(roomId)}/sessions/${encodeURIComponent(sessionId)}/grade-files/${encodeURIComponent(fileId)}`,
    { method: 'GET' },
  );
  if (!response.ok) await readResponse(response);
  return response.blob();
}

export async function saveTeacherExamRoom<T extends { id: string }>(room: T, isUpdate = false): Promise<T> {
  const response = await authenticatedFetch(
    isUpdate ? `/api/teacher/exam-rooms/${encodeURIComponent(room.id)}` : '/api/teacher/exam-rooms',
    {
      method: isUpdate ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room),
    },
  );
  const body = await readResponse(response);
  if (!isRecord(body.room) || typeof body.room.id !== 'string') {
    throw new Error('Phản hồi lưu phòng thi không đúng định dạng.');
  }
  return body.room as T;
}

export async function deleteTeacherExamRoom(roomId: string): Promise<void> {
  const response = await authenticatedFetch(
    `/api/teacher/exam-rooms/${encodeURIComponent(roomId)}`,
    { method: 'DELETE' },
  );
  await readResponse(response);
}

export type StudentExamEventType =
  | 'tab-hidden'
  | 'window-blur'
  | 'fullscreen-exit'
  | 'connection-lost'
  | 'connection-restored';

export interface StudentExamQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
  question: string;
  options: string[];
  points: number;
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string;
}

export interface StudentExamRoom {
  id: string;
  classIds: string[];
  code: string;
  title: string;
  subject: string;
  startsAt: string;
  durationMinutes: number;
  inProgressCount: number;
  hasSubmitted: boolean;
  status: 'scheduled' | 'open' | 'closed' | 'completed';
  instructions: string;
  settings: {
    shuffleQuestions: boolean;
    allowBackNavigation: boolean;
    allowEarlySubmit: boolean;
    requireCamera: boolean;
    requireMicrophone: boolean;
    monitorFace: boolean;
    monitorSpeech: boolean;
    monitorTabSwitch: boolean;
    monitorConnection: boolean;
    warningThreshold: number;
  };
  examSnapshot: {
    sections: Array<{
      id: string;
      title: string;
      description: string;
      questionIds: string[];
    }>;
    questions: StudentExamQuestion[];
  };
}

function isStudentExamRoom(value: unknown): value is StudentExamRoom {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.code !== 'string'
    || !Array.isArray(value.classIds) || !value.classIds.every((id) => typeof id === 'string')
    || typeof value.title !== 'string' || typeof value.subject !== 'string'
    || typeof value.startsAt !== 'string' || typeof value.durationMinutes !== 'number'
    || !Number.isInteger(value.inProgressCount) || typeof value.hasSubmitted !== 'boolean'
    || typeof value.instructions !== 'string' || !isRecord(value.settings)
    || !isRecord(value.examSnapshot) || !Array.isArray(value.examSnapshot.questions)) {
    return false;
  }
  const settings = value.settings;
  return ['shuffleQuestions', 'allowBackNavigation', 'allowEarlySubmit', 'requireCamera', 'requireMicrophone',
    'monitorFace', 'monitorSpeech',
    'monitorTabSwitch', 'monitorConnection'].every((key) => typeof settings[key] === 'boolean')
    && Number.isInteger(settings.warningThreshold)
    && ['scheduled', 'open', 'closed', 'completed'].includes(String(value.status))
    && value.examSnapshot.questions.every((question) => isRecord(question)
      && typeof question.id === 'string'
      && ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(String(question.type))
      && typeof question.question === 'string'
      && Array.isArray(question.options)
      && question.options.every((option) => typeof option === 'string')
      && typeof question.points === 'number'
      && typeof question.sectionId === 'string'
      && typeof question.sectionTitle === 'string'
      && typeof question.sectionDescription === 'string')
    && Array.isArray(value.examSnapshot.sections)
    && value.examSnapshot.sections.every((section) => isRecord(section)
      && typeof section.id === 'string'
      && typeof section.title === 'string'
      && typeof section.description === 'string'
      && Array.isArray(section.questionIds)
      && section.questionIds.every((id) => typeof id === 'string'));
}

export async function listStudentExamRooms(): Promise<StudentExamRoom[]> {
  const response = await authenticatedFetch('/api/student/exam-rooms', { method: 'GET' });
  const body = await readResponse(response);
  if (!Array.isArray(body.rooms) || !body.rooms.every(isStudentExamRoom)) {
    throw new Error('Phản hồi danh sách phòng thi không đúng định dạng.');
  }
  return body.rooms;
}

export interface StudentExamReviewQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
  question: string;
  options: string[];
  correctIndex: number;
  correctAnswer: string;
  correctAnswers?: boolean[];
  explanation: string;
  points: number;
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string;
}

export interface StudentExamResult {
  sessionId: string;
  roomId: string;
  roomCode: string;
  title: string;
  subject: string;
  classId: string;
  className: string;
  academicYear: string;
  startsAt: string;
  semester?: ProgressSemester | null;
  submittedAt: string | null;
  answers: Record<string, string>;
  files: Array<{
    id: string;
    questionNumber: number;
    name: string;
    mediaType: string;
    sizeBytes: number;
  }>;
  questions: StudentExamReviewQuestion[];
  grade: {
    questionScores: Record<string, number>;
    questionFeedback: Record<string, string>;
    totalScore: number;
    teacherFeedback: string;
    evidenceFiles: Array<{
      id: string;
      questionId: string;
      name: string;
      mediaType: string;
      sizeBytes: number;
    }>;
    gradedAt: string;
    isRead: boolean;
  };
}

export interface ExamAppeal {
  id: string;
  sessionId: string;
  examTitle: string;
  subject: string;
  className: string;
  studentName: string | null;
  reason: string;
  status: 'pending' | 'reviewed' | 'rejected';
  teacherResponse: string;
  createdAt: string;
  reviewedAt: string | null;
}

function isExamAppeal(value: unknown): value is ExamAppeal {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.sessionId === 'string'
    && typeof value.examTitle === 'string'
    && typeof value.subject === 'string'
    && typeof value.className === 'string'
    && (typeof value.studentName === 'string' || value.studentName === null)
    && typeof value.reason === 'string'
    && ['pending', 'reviewed', 'rejected'].includes(String(value.status))
    && typeof value.teacherResponse === 'string'
    && typeof value.createdAt === 'string'
    && (typeof value.reviewedAt === 'string' || value.reviewedAt === null);
}

export async function listStudentExamAppeals(): Promise<ExamAppeal[]> {
  const response = await authenticatedFetch('/api/student/exam-appeals', { method: 'GET' });
  const body = await readResponse(response);
  if (!Array.isArray(body.appeals) || !body.appeals.every(isExamAppeal)) {
    throw new Error('Phản hồi danh sách yêu cầu phúc khảo không đúng định dạng.');
  }
  return body.appeals;
}

export async function submitStudentExamAppeal(sessionId: string, reason: string): Promise<void> {
  const response = await authenticatedFetch(
    `/api/student/exam-results/${encodeURIComponent(sessionId)}/appeals`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
  await readResponse(response);
}

export async function listTeacherExamAppeals(): Promise<ExamAppeal[]> {
  const response = await authenticatedFetch('/api/teacher/exam-appeals', { method: 'GET' });
  const body = await readResponse(response);
  if (!Array.isArray(body.appeals) || !body.appeals.every(isExamAppeal)) {
    throw new Error('Phản hồi danh sách yêu cầu phúc khảo không đúng định dạng.');
  }
  return body.appeals;
}

export async function reviewTeacherExamAppeal(
  appealId: string,
  status: 'reviewed' | 'rejected',
  teacherResponse: string,
): Promise<void> {
  const response = await authenticatedFetch(`/api/teacher/exam-appeals/${encodeURIComponent(appealId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, teacherResponse }),
  });
  await readResponse(response);
}

function isStudentExamResult(value: unknown): value is StudentExamResult {
  return isRecord(value)
    && typeof value.sessionId === 'string'
    && typeof value.roomId === 'string'
    && typeof value.roomCode === 'string'
    && typeof value.title === 'string'
    && typeof value.subject === 'string'
    && typeof value.classId === 'string'
    && typeof value.className === 'string'
    && typeof value.academicYear === 'string'
    && typeof value.startsAt === 'string'
    && (value.semester === undefined
      || value.semester === 'Kỳ 1'
      || value.semester === 'Kỳ 2'
      || value.semester === null)
    && (typeof value.submittedAt === 'string' || value.submittedAt === null)
    && isRecord(value.answers)
    && Object.values(value.answers).every((answer) => typeof answer === 'string')
    && Array.isArray(value.files)
    && value.files.every((file) => isRecord(file)
      && typeof file.id === 'string'
      && Number.isInteger(file.questionNumber)
      && typeof file.name === 'string'
      && typeof file.mediaType === 'string'
      && typeof file.sizeBytes === 'number')
    && Array.isArray(value.questions)
    && value.questions.every((question) => isRecord(question)
      && typeof question.id === 'string'
      && ['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(String(question.type))
      && typeof question.question === 'string'
      && Array.isArray(question.options)
      && question.options.every((option) => typeof option === 'string')
      && typeof question.correctIndex === 'number'
      && typeof question.correctAnswer === 'string'
      && (question.correctAnswers === undefined || (
        Array.isArray(question.correctAnswers)
        && question.correctAnswers.every((answer) => typeof answer === 'boolean')
      ))
      && typeof question.explanation === 'string'
      && typeof question.points === 'number'
      && typeof question.sectionId === 'string'
      && typeof question.sectionTitle === 'string'
      && typeof question.sectionDescription === 'string')
    && isRecord(value.grade)
    && isRecord(value.grade.questionScores)
    && Object.values(value.grade.questionScores).every((score) => typeof score === 'number')
    && isRecord(value.grade.questionFeedback)
    && Object.values(value.grade.questionFeedback).every((feedback) => typeof feedback === 'string')
    && typeof value.grade.totalScore === 'number'
    && typeof value.grade.teacherFeedback === 'string'
    && Array.isArray(value.grade.evidenceFiles)
    && value.grade.evidenceFiles.every((file) => isRecord(file)
      && typeof file.id === 'string'
      && typeof file.questionId === 'string'
      && typeof file.name === 'string'
      && typeof file.mediaType === 'string'
      && typeof file.sizeBytes === 'number')
    && typeof value.grade.gradedAt === 'string'
    && typeof value.grade.isRead === 'boolean';
}

export async function listStudentExamResults(): Promise<StudentExamResult[]> {
  const response = await authenticatedFetch('/api/student/exam-results', { method: 'GET' });
  const body = await readResponse(response);
  if (!Array.isArray(body.results) || !body.results.every(isStudentExamResult)) {
    throw new Error('Phản hồi danh sách bài thi đã chấm không đúng định dạng.');
  }
  return body.results;
}

export async function markStudentExamResultRead(sessionId: string): Promise<void> {
  const response = await authenticatedFetch(
    `/api/student/exam-results/${encodeURIComponent(sessionId)}/read`,
    { method: 'POST' },
  );
  await readResponse(response);
}

export async function downloadStudentExamResultFile(
  sessionId: string,
  fileId: string,
  gradeEvidence = false,
): Promise<Blob> {
  const fileKind = gradeEvidence ? 'grade-files' : 'files';
  const response = await authenticatedFetch(
    `/api/student/exam-results/${encodeURIComponent(sessionId)}/${fileKind}/${encodeURIComponent(fileId)}`,
    { method: 'GET' },
  );
  if (!response.ok) await readResponse(response);
  return response.blob();
}

export async function startStudentExam(roomId: string): Promise<{ id: string; startedAt: string }> {
  const response = await authenticatedFetch(`/api/student/exam-rooms/${encodeURIComponent(roomId)}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = await readResponse(response);
  if (!isRecord(body.session) || typeof body.session.id !== 'string' || typeof body.session.startedAt !== 'string') {
    throw new Error('Phản hồi bắt đầu phiên thi không đúng định dạng.');
  }
  return { id: body.session.id, startedAt: body.session.startedAt };
}

export async function recordStudentExamEvent(
  sessionId: string,
  eventType: StudentExamEventType,
): Promise<{ eventCount: number; needsReview: boolean }> {
  const response = await authenticatedFetch(`/api/student/exam-sessions/${encodeURIComponent(sessionId)}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType }),
  });
  const body = await readResponse(response);
  if (!Number.isInteger(body.eventCount) || typeof body.needsReview !== 'boolean') {
    throw new Error('Phản hồi ghi nhận sự kiện phòng thi không đúng định dạng.');
  }
  return { eventCount: Number(body.eventCount), needsReview: body.needsReview };
}

export type StudentExamBehaviorEventType =
  | 'tab_hidden'
  | 'face_missing'
  | 'multiple_faces'
  | 'speech_activity';

export interface StudentExamBehaviorEventData {
  event_type: StudentExamBehaviorEventType;
  timestamp: string;
  duration_seconds: number;
}

export async function sendStudentExamBehaviorEvent(
  sessionId: string,
  eventData: StudentExamBehaviorEventData,
): Promise<{ saved: boolean; duplicate: boolean }> {
  const response = await authenticatedFetch(
    `/api/student/exam-sessions/${encodeURIComponent(sessionId)}/behavior-logs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    },
  );
  const body = await readResponse(response);
  if (typeof body.saved !== 'boolean' || typeof body.duplicate !== 'boolean') {
    throw new Error('Phản hồi ghi nhận hành vi phòng thi không đúng định dạng.');
  }
  return { saved: body.saved, duplicate: body.duplicate };
}

export async function createStudentExamMobileUploadSession(
  sessionId: string,
  questionNumber: number,
): Promise<{ token: string; questionNumber: number; expiresAt: string }> {
  const response = await authenticatedFetch(
    `/api/student/exam-sessions/${encodeURIComponent(sessionId)}/mobile-upload-sessions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionNumber }),
    },
  );
  const body = await readResponse(response);
  if (!isRecord(body.uploadSession)
    || typeof body.uploadSession.token !== 'string'
    || body.uploadSession.questionNumber !== questionNumber
    || typeof body.uploadSession.expiresAt !== 'string') {
    throw new Error('Phản hồi tạo mã QR tải ảnh không đúng định dạng.');
  }
  return {
    token: body.uploadSession.token,
    questionNumber,
    expiresAt: body.uploadSession.expiresAt,
  };
}

export async function getStudentExamMobileUploadStatus(
  token: string,
): Promise<{ status: 'pending' } | { status: 'success'; imageUrl: string; name: string }> {
  const response = await authenticatedFetch(
    `/api/check-session?session=${encodeURIComponent(token)}`,
    { method: 'GET' },
  );
  const body = await readResponse(response);
  if (body.status === 'pending') return { status: 'pending' };
  if (body.status !== 'success' || typeof body.imageUrl !== 'string' || typeof body.name !== 'string') {
    throw new Error('Phản hồi đồng bộ ảnh điện thoại không đúng định dạng.');
  }
  return { status: 'success', imageUrl: body.imageUrl, name: body.name };
}

export async function deleteStudentExamMobileUpload(sessionId: string, token: string): Promise<void> {
  const response = await authenticatedFetch('/api/delete-temporary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, session: token }),
  });
  await readResponse(response);
}

export async function submitStudentExam(
  sessionId: string,
  answers: Record<number, string>,
  files: Array<{ questionNumber: number; file: File }> = [],
  mobileUploadTokens: string[] = [],
): Promise<{ answered: number; total: number; submittedAt: string }> {
  const headers: Record<string, string> = {};
  let body: BodyInit;
  if (files.length > 0 || mobileUploadTokens.length > 0) {
    const formData = new FormData();
    formData.set('answers', JSON.stringify(answers));
    files.forEach(({ questionNumber, file }) => {
      formData.append('files', file, file.name);
      formData.append('fileQuestionNumbers', String(questionNumber));
    });
    mobileUploadTokens.forEach((token) => formData.append('mobileUploadTokens', token));
    body = formData;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ answers });
  }
  const response = await authenticatedFetch(`/api/student/exam-sessions/${encodeURIComponent(sessionId)}/submit`, {
    method: 'POST',
    headers,
    body,
  });
  const resultBody = await readResponse(response);
  if (!isRecord(resultBody.result) || !Number.isInteger(resultBody.result.answered)
    || !Number.isInteger(resultBody.result.total) || typeof resultBody.result.submittedAt !== 'string') {
    throw new Error('Phản hồi nộp bài thi không đúng định dạng.');
  }
  return {
    answered: Number(resultBody.result.answered),
    total: Number(resultBody.result.total),
    submittedAt: resultBody.result.submittedAt,
  };
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

function isTeacherProgressAnalysis(value: unknown): value is TeacherProgressAnalysis {
  return isRecord(value)
    && typeof value.classOverview === 'string'
    && typeof value.learningAdvice === 'string'
    && Array.isArray(value.strengths)
    && value.strengths.every((item) => typeof item === 'string')
    && Array.isArray(value.focusAreas)
    && value.focusAreas.every((item) => typeof item === 'string')
    && Array.isArray(value.studentInsights)
    && value.studentInsights.every((item) => isRecord(item)
      && typeof item.studentKey === 'string'
      && ['support', 'steady', 'strong'].includes(String(item.level))
      && typeof item.insight === 'string'
      && Array.isArray(item.evidence)
      && item.evidence.every((evidence) => typeof evidence === 'string'))
    && Array.isArray(value.recommendations)
    && value.recommendations.every((item) => isRecord(item)
      && ['assignment', 'exam', 'review', 'classroom'].includes(String(item.type))
      && typeof item.title === 'string'
      && typeof item.action === 'string'
      && typeof item.reason === 'string')
    && Array.isArray(value.limitations)
    && value.limitations.every((item) => typeof item === 'string');
}

export async function analyzeTeacherClassProgress(
  classId: string,
  input: { academicYear: string; semester: string; subject: string },
): Promise<TeacherProgressAnalysisResult> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/progress-analysis`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  const body = await readResponse(response);
  if (!isRecord(body.scope)
    || body.scope.classId !== classId
    || typeof body.scope.className !== 'string'
    || typeof body.scope.academicYear !== 'string'
    || typeof body.scope.semester !== 'string'
    || typeof body.scope.subject !== 'string'
    || typeof body.scope.isHomeroom !== 'boolean'
    || (body.crossSubjectSummary !== null && (!Array.isArray(body.crossSubjectSummary)
      || !body.crossSubjectSummary.every((item) => isRecord(item)
        && typeof item.subject === 'string'
        && isNumberOrNull(item.classAverage)
        && typeof item.studentsWithGrades === 'number')))
    || !Array.isArray(body.students)
    || !isTeacherProgressAnalysis(body.analysis)) {
    throw new Error('Phản hồi phân tích tiến độ lớp không đúng định dạng.');
  }
  const students = body.students.map((student) => {
    if (!isRecord(student)
      || typeof student.studentId !== 'string'
      || typeof student.fullName !== 'string'
      || typeof student.studentKey !== 'string') {
      throw new Error('Phản hồi danh sách học sinh phân tích không đúng định dạng.');
    }
    return {
      studentId: student.studentId,
      fullName: student.fullName,
      studentKey: student.studentKey,
    };
  });
  return {
    scope: {
      classId,
      className: body.scope.className,
      academicYear: body.scope.academicYear,
      semester: body.scope.semester,
      subject: body.scope.subject,
      isHomeroom: body.scope.isHomeroom,
    },
    crossSubjectSummary: Array.isArray(body.crossSubjectSummary)
      ? body.crossSubjectSummary.map((item) => ({
        subject: String(item.subject),
        classAverage: isNumberOrNull(item.classAverage) ? item.classAverage : null,
        studentsWithGrades: Number(item.studentsWithGrades),
      }))
      : null,
    students,
    analysis: body.analysis,
  };
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
    && Array.isArray(value.averageHistory)
    && value.averageHistory.every((snapshot) => isRecord(snapshot)
      && typeof snapshot.average === 'number'
      && Number.isFinite(snapshot.average)
      && typeof snapshot.recordedAt === 'string')
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
    && Array.isArray(value.files)
    && value.files.every(isAssignmentSubmissionFile)
    && (value.submittedAt === null || typeof value.submittedAt === 'string')
    && (value.score === null || (typeof value.score === 'number' && Number.isFinite(value.score)))
    && typeof value.teacherFeedback === 'string'
    && isNumberRecord(value.questionScores)
    && isStringRecord(value.questionFeedback)
    && (value.gradedAt === null || typeof value.gradedAt === 'string')
}

function isAssignmentSubmissionFile(value: unknown): value is AssignmentSubmissionFile {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.mediaType === 'string'
    && typeof value.sizeBytes === 'number';
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
  input: {
    score: number;
    teacherFeedback: string;
    questionScores?: Record<string, number>;
    questionFeedback?: Record<string, string>;
  },
): Promise<{
  score: number;
  teacherFeedback: string;
  questionScores: Record<string, number>;
  questionFeedback: Record<string, string>;
  gradedAt: string;
}> {
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
    || !isNumberRecord(grade.questionScores)
    || !isStringRecord(grade.questionFeedback)
    || typeof grade.gradedAt !== 'string') {
    throw new Error('Phản hồi lưu điểm không đúng định dạng.');
  }
  return {
    score: grade.score,
    teacherFeedback: grade.teacherFeedback,
    questionScores: grade.questionScores,
    questionFeedback: grade.questionFeedback,
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

export async function updateClassAssignment(
  classId: string,
  assignmentId: string,
  input: {
    title: string;
    description: string;
    chapter: string;
    lesson: string;
    period: string | null;
    dueAt: string;
  },
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/assignments/${encodeURIComponent(assignmentId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  await readResponse(response);
}

export async function deleteClassAssignment(
  classId: string,
  assignmentId: string,
  input: { academicYear: string; semester: string; subject: string },
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/assignments/${encodeURIComponent(assignmentId)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  await readResponse(response);
}

export async function renameClassAssignmentChapter(
  classId: string,
  chapter: string,
  input: { academicYear: string; semester: string; subject: string; newChapter: string },
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/assignment-chapters/${encodeURIComponent(chapter)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  await readResponse(response);
}

export async function deleteClassAssignmentChapter(
  classId: string,
  chapter: string,
  input: { academicYear: string; semester: string; subject: string },
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/assignment-chapters/${encodeURIComponent(chapter)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  await readResponse(response);
}

export async function renameClassAssignmentLesson(
  classId: string,
  chapter: string,
  lesson: string,
  input: { academicYear: string; semester: string; subject: string; newLesson: string },
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/assignment-chapters/${encodeURIComponent(chapter)}`
      + `/lessons/${encodeURIComponent(lesson)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  await readResponse(response);
}

export async function deleteClassAssignmentLesson(
  classId: string,
  chapter: string,
  lesson: string,
  input: { academicYear: string; semester: string; subject: string },
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/assignment-chapters/${encodeURIComponent(chapter)}`
      + `/lessons/${encodeURIComponent(lesson)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
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

export async function renameClassLearningResourceLesson(
  classId: string,
  chapter: string,
  lesson: string,
  input: { academicYear: string; semester: string; subject: string; newLesson: string },
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/resource-chapters/${encodeURIComponent(chapter)}`
      + `/lessons/${encodeURIComponent(lesson)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  await readResponse(response);
}

export async function deleteClassLearningResourceLesson(
  classId: string,
  chapter: string,
  lesson: string,
  input: { academicYear: string; semester: string; subject: string },
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/resource-chapters/${encodeURIComponent(chapter)}`
      + `/lessons/${encodeURIComponent(lesson)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  await readResponse(response);
}

export async function deleteClassLearningResource(
  classId: string,
  resourceId: string,
  input: { academicYear: string; semester: string; subject: string },
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/classes/${encodeURIComponent(classId)}/resources/${encodeURIComponent(resourceId)}`,
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

export async function downloadClassAssignmentSubmissionFile(
  assignmentId: string,
  studentId: string | null,
  fileId: string,
): Promise<Blob> {
  const filePath = studentId
    ? `/api/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(studentId)}`
      + `/files/${encodeURIComponent(fileId)}`
    : `/api/assignments/${encodeURIComponent(assignmentId)}/submission/files/${encodeURIComponent(fileId)}`;
  const response = await authenticatedFetch(
    filePath,
    { method: 'GET' },
  );
  if (!response.ok) {
    let message = 'Không thể tải tệp bài nộp.';
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
    && Array.isArray(value.files)
    && value.files.every(isAssignmentSubmissionFile)
    && (value.submittedAt === null || typeof value.submittedAt === 'string')
    && (value.score === null || (typeof value.score === 'number' && Number.isFinite(value.score)))
    && typeof value.teacherFeedback === 'string'
    && isNumberRecord(value.questionScores)
    && isStringRecord(value.questionFeedback)
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

function isStudentTimetableResponse(value: unknown): value is StudentTimetableResponse {
  return isRecord(value)
    && (value.weekNumber === null || (Number.isInteger(value.weekNumber) && Number(value.weekNumber) >= 1))
    && (value.classroom === null || (isRecord(value.classroom)
      && typeof value.classroom.id === 'string'
      && typeof value.classroom.code === 'string'
      && typeof value.classroom.name === 'string'
      && typeof value.classroom.academicYear === 'string'))
    && (value.timetable === null || (isRecord(value.timetable)
      && (value.timetable.semester === 'Kỳ 1' || value.timetable.semester === 'Kỳ 2')
      && (value.timetable.session === 'morning' || value.timetable.session === 'afternoon')
      && typeof value.timetable.effectiveFrom === 'string'
      && Number.isInteger(value.timetable.periodCount)
      && Number(value.timetable.periodCount) >= 1
      && Number(value.timetable.periodCount) <= 10
      && Array.isArray(value.timetable.entries)
      && value.timetable.entries.every((entry) => isRecord(entry)
        && Number.isInteger(entry.weekday)
        && Number(entry.weekday) >= 1
        && Number(entry.weekday) <= 6
        && Number.isInteger(entry.period)
        && Number(entry.period) >= 1
        && Number(entry.period) <= 10
        && typeof entry.subject === 'string'
        && (entry.type === undefined || ['lesson', 'makeup', 'homework', 'exam', 'exam_return', 'cancelled'].includes(String(entry.type)))
        && (entry.title === undefined || typeof entry.title === 'string')
        && (entry.topic === undefined || typeof entry.topic === 'string')
        && (entry.dueAt === undefined || entry.dueAt === null || typeof entry.dueAt === 'string')
        && (entry.hasHomework === undefined || typeof entry.hasHomework === 'boolean')
        && (entry.homeworkTitle === undefined || typeof entry.homeworkTitle === 'string')
        && (entry.homeworkDueAt === undefined || entry.homeworkDueAt === null || typeof entry.homeworkDueAt === 'string')
        && (entry.hasExam === undefined || typeof entry.hasExam === 'boolean')
        && (entry.examTitle === undefined || typeof entry.examTitle === 'string')
        && (entry.examStartsAt === undefined || entry.examStartsAt === null || typeof entry.examStartsAt === 'string')
        && (entry.hasExamReturn === undefined || typeof entry.hasExamReturn === 'boolean')
        && (entry.examReturnNote === undefined || typeof entry.examReturnNote === 'string')
        && (entry.examReturnAt === undefined || entry.examReturnAt === null || typeof entry.examReturnAt === 'string'))));
}

export async function getStudentTimetable(
  semester: ProgressSemester,
  weekStart?: string,
): Promise<StudentTimetableResponse> {
  const search = new URLSearchParams({ semester });
  if (weekStart) search.set('weekStart', weekStart);
  const response = await authenticatedFetch(
    `/api/student/timetable?${search.toString()}`,
    { method: 'GET' },
  );
  const body = await readResponse(response);
  const academicYear = isRecord(body.classroom) && typeof body.classroom.academicYear === 'string'
    ? body.classroom.academicYear
    : '';
  const timetable = isRecord(body.timetable) && Array.isArray(body.timetable.entries)
    ? { ...body.timetable, entries: body.timetable.entries.map(normalizeTimetableEntry) }
    : body.timetable;
  const result = {
    classroom: body.classroom,
    timetable,
    weekNumber: body.weekNumber === undefined
      ? getAcademicYearWeekNumber(academicYear, weekStart)
      : body.weekNumber,
  };
  if (!isStudentTimetableResponse(result)) {
    throw new Error('Phản hồi thời khóa biểu học sinh không đúng định dạng.');
  }
  return result;
}

export async function generateStudentTimetableSuggestion(input: {
  semester: ProgressSemester;
  weekStart: string;
  tomorrowWeekday: number;
  availability: string;
}): Promise<string> {
  const response = await authenticatedFetch('/api/student/timetable/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readResponse(response);
  if (typeof body.suggestion !== 'string' || !body.suggestion.trim()) {
    throw new Error('Phản hồi gợi ý thời gian biểu không đúng định dạng.');
  }
  return body.suggestion;
}

function isTeacherTimetableResponse(value: unknown): value is TeacherTimetableResponse {
  const validEntryTypes = ['lesson', 'makeup', 'homework', 'exam', 'exam_return', 'cancelled'];
  return isRecord(value)
    && (value.weekNumber === null || (Number.isInteger(value.weekNumber) && Number(value.weekNumber) >= 1))
    && Array.isArray(value.classes)
    && value.classes.every((item) => isRecord(item)
      && typeof item.id === 'string'
      && typeof item.code === 'string'
      && typeof item.name === 'string'
      && typeof item.grade === 'string'
      && typeof item.academicYear === 'string'
      && typeof item.isHomeroom === 'boolean'
      && Array.isArray(item.subjects)
      && item.subjects.every((subject) => typeof subject === 'string'))
    && (value.timetable === null || (isRecord(value.timetable)
      && typeof value.timetable.id === 'string'
      && typeof value.timetable.academicYear === 'string'
      && (value.timetable.semester === 'Kỳ 1' || value.timetable.semester === 'Kỳ 2')
      && typeof value.timetable.weekStart === 'string'
      && (value.timetable.session === 'morning' || value.timetable.session === 'afternoon')
      && Number.isInteger(value.timetable.periodCount)
      && (value.timetable.status === 'draft' || value.timetable.status === 'published')
      && typeof value.timetable.isEstimated === 'boolean'
      && typeof value.timetable.isTemplate === 'boolean'
      && typeof value.timetable.dailyNote === 'string'))
    && Array.isArray(value.entries)
    && value.entries.every((entry) => isRecord(entry)
      && Number.isInteger(entry.weekday)
      && Number(entry.weekday) >= 1
      && Number(entry.weekday) <= 6
      && Number.isInteger(entry.period)
      && Number(entry.period) >= 1
      && typeof entry.classId === 'string'
      && typeof entry.classCode === 'string'
      && typeof entry.className === 'string'
      && typeof entry.isHomeroom === 'boolean'
      && typeof entry.subject === 'string'
      && validEntryTypes.includes(String(entry.type))
      && typeof entry.title === 'string'
      && typeof entry.topic === 'string'
      && (entry.dueAt === null || typeof entry.dueAt === 'string')
      && typeof entry.hasHomework === 'boolean'
      && typeof entry.homeworkTitle === 'string'
      && (entry.homeworkDueAt === null || typeof entry.homeworkDueAt === 'string')
      && typeof entry.hasExam === 'boolean'
      && typeof entry.examTitle === 'string'
      && (entry.examStartsAt === null || typeof entry.examStartsAt === 'string')
      && typeof entry.hasExamReturn === 'boolean'
      && typeof entry.examReturnNote === 'string'
      && (entry.examReturnAt === null || typeof entry.examReturnAt === 'string'))
    && Array.isArray(value.upcomingWork)
    && value.upcomingWork.every((item) => isRecord(item)
      && typeof item.id === 'string'
      && typeof item.title === 'string'
      && typeof item.subject === 'string'
      && typeof item.dueAt === 'string'
      && typeof item.classId === 'string'
      && typeof item.classCode === 'string'
      && Number.isInteger(item.submittedCount)
      && Number.isInteger(item.ungradedCount));
}

export async function getTeacherTimetable(
  academicYear: string,
  semester: ProgressSemester,
  weekStart: string,
): Promise<TeacherTimetableResponse> {
  const search = new URLSearchParams({ academicYear, semester, weekStart });
  const response = await authenticatedFetch(`/api/teacher/timetable?${search.toString()}`, { method: 'GET' });
  const body = await readResponse(response);
  const result = {
    weekNumber: body.weekNumber === undefined
      ? getAcademicYearWeekNumber(academicYear, weekStart)
      : body.weekNumber,
    classes: body.classes,
    timetable: body.timetable,
    entries: Array.isArray(body.entries) ? body.entries.map(normalizeTimetableEntry) : body.entries,
    upcomingWork: body.upcomingWork,
  };
  if (!isTeacherTimetableResponse(result)) {
    throw new Error('Phản hồi thời khóa biểu giáo viên không đúng định dạng.');
  }
  return result;
}

export async function saveTeacherTimetable(input: {
  academicYear: string;
  semester: ProgressSemester;
  weekStart: string;
  session: 'morning' | 'afternoon';
  periodCount: number;
  status: 'draft' | 'published';
  dailyNote: string;
  entries: Array<{
    weekday: number;
    period: number;
    classId: string;
    subject: string;
    type: TimetableEntryType;
    title: string;
    topic: string;
    dueAt: string | null;
    hasHomework: boolean;
    homeworkTitle: string;
    homeworkDueAt: string | null;
    hasExam: boolean;
    examTitle: string;
    examStartsAt: string | null;
    hasExamReturn: boolean;
    examReturnNote: string;
    examReturnAt: string | null;
  }>;
}): Promise<TeacherTimetableResponse> {
  const response = await authenticatedFetch('/api/teacher/timetable', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readResponse(response);
  const result = {
    weekNumber: body.weekNumber === undefined
      ? getAcademicYearWeekNumber(input.academicYear, input.weekStart)
      : body.weekNumber,
    classes: body.classes,
    timetable: body.timetable,
    entries: Array.isArray(body.entries) ? body.entries.map(normalizeTimetableEntry) : body.entries,
    upcomingWork: body.upcomingWork,
  };
  if (!isTeacherTimetableResponse(result)) {
    throw new Error('Phản hồi lưu thời khóa biểu giáo viên không đúng định dạng.');
  }
  return result;
}

export async function generateTeacherTimetableSuggestion(input: {
  academicYear: string;
  semester: ProgressSemester;
  weekStart: string;
  gender?: 'female' | 'male' | 'other' | 'unspecified' | null;
}): Promise<string> {
  const response = await authenticatedFetch('/api/teacher/timetable/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readResponse(response);
  if (typeof body.suggestion !== 'string' || !body.suggestion.trim()) {
    throw new Error('Phản hồi gợi ý công việc giáo viên không đúng định dạng.');
  }
  return body.suggestion;
}

export async function listStudentAssignments(): Promise<StudentAssignment[]> {
  const response = await authenticatedFetch('/api/assignments', { method: 'GET' });
  const body = await parseAssignmentResponse(response);
  if (!Array.isArray(body.assignments) || !body.assignments.every(isStudentAssignment)) {
    throw new Error('Phản hồi bài tập học sinh không đúng định dạng.');
  }
  return body.assignments;
}

function isStudentSubjectAverage(value: unknown): value is StudentSubjectAverage {
  return isRecord(value)
    && typeof value.classId === 'string'
    && typeof value.className === 'string'
    && typeof value.classCode === 'string'
    && typeof value.academicYear === 'string'
    && typeof value.subject === 'string'
    && (value.average === null || (typeof value.average === 'number' && Number.isFinite(value.average)))
    && (value.regularScores === undefined
      || (Array.isArray(value.regularScores)
        && value.regularScores.length === 4
        && value.regularScores.every(isNumberOrNull)))
    && (value.previousAverage === null
      || (typeof value.previousAverage === 'number' && Number.isFinite(value.previousAverage)))
    && (value.averageHistory === undefined
      || (Array.isArray(value.averageHistory) && value.averageHistory.every((snapshot) => (
        isRecord(snapshot)
        && typeof snapshot.average === 'number'
        && Number.isFinite(snapshot.average)
        && typeof snapshot.recordedAt === 'string'
        && !Number.isNaN(Date.parse(snapshot.recordedAt))
      ))));
}

export async function listStudentSubjectAverages(semester: string): Promise<StudentSubjectAverage[]> {
  const query = new URLSearchParams({ semester });
  const response = await authenticatedFetch(`/api/student/subject-averages?${query.toString()}`, { method: 'GET' });
  const body = await readResponse(response);
  if (!Array.isArray(body.averages) || !body.averages.every(isStudentSubjectAverage)) {
    throw new Error('Phản hồi điểm trung bình theo môn không đúng định dạng.');
  }
  return body.averages;
}

function isStudentProgressClass(value: unknown): value is StudentProgressClass {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.code === 'string'
    && typeof value.grade === 'string'
    && typeof value.academicYear === 'string'
    && Array.isArray(value.subjects)
    && value.subjects.every((subject) => typeof subject === 'string');
}

function isStudentProgressAverage(value: unknown): value is StudentProgressAverage {
  return isRecord(value)
    && isStudentSubjectAverage(value)
    && (value.semester === 'Kỳ 1' || value.semester === 'Kỳ 2');
}

function isStudentProgressResource(value: unknown): value is StudentProgressResource {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.classId === 'string'
    && typeof value.subject === 'string'
    && typeof value.academicYear === 'string'
    && (value.semester === 'Kỳ 1' || value.semester === 'Kỳ 2')
    && typeof value.chapter === 'string'
    && typeof value.lesson === 'string'
    && typeof value.title === 'string';
}

function isStudentProgressData(value: unknown): value is StudentProgressData {
  return isRecord(value)
    && isRecord(value.scope)
    && (typeof value.scope.classId === 'string' || value.scope.classId === null)
    && (typeof value.scope.academicYear === 'string' || value.scope.academicYear === null)
    && (value.scope.semester === null
      || value.scope.semester === 'Kỳ 1'
      || value.scope.semester === 'Kỳ 2'
      || value.scope.semester === 'Cả năm')
    && (typeof value.scope.subject === 'string' || value.scope.subject === null)
    && Array.isArray(value.classes)
    && value.classes.every(isStudentProgressClass)
    && Array.isArray(value.officialAverages)
    && value.officialAverages.every(isStudentProgressAverage)
    && Array.isArray(value.assignments)
    && value.assignments.every(isStudentAssignment)
    && Array.isArray(value.examResults)
    && value.examResults.every(isStudentExamResult)
    && Array.isArray(value.upcomingExams)
    && value.upcomingExams.every((exam) => isRecord(exam)
      && typeof exam.id === 'string'
      && Array.isArray(exam.classIds)
      && exam.classIds.every((id) => typeof id === 'string')
      && typeof exam.title === 'string'
      && typeof exam.subject === 'string'
      && typeof exam.startsAt === 'string')
    && Array.isArray(value.resources)
    && value.resources.every(isStudentProgressResource)
    && isRecord(value.academicCalendar)
    && value.academicCalendar.available === false
    && typeof value.academicCalendar.message === 'string';
}

function isStudentProgressAnalysis(value: unknown): value is StudentProgressAnalysis {
  const isEvidenceList = (items: unknown) => Array.isArray(items)
    && items.every((id) => typeof id === 'string');
  const isTextEvidenceItem = (item: unknown, fields: string[]) => isRecord(item)
    && fields.every((field) => typeof item[field] === 'string')
    && isEvidenceList(item.evidenceIds);
  return isRecord(value)
    && isRecord(value.overview)
    && typeof value.overview.text === 'string'
    && isEvidenceList(value.overview.evidenceIds)
    && Array.isArray(value.strengths)
    && value.strengths.every((item) => isTextEvidenceItem(item, ['text']))
    && Array.isArray(value.focusAreas)
    && value.focusAreas.every((item) => isTextEvidenceItem(item, ['topic', 'text']))
    && Array.isArray(value.recommendations)
    && value.recommendations.every((item) => isRecord(item)
      && ['high', 'medium', 'low'].includes(String(item.priority))
      && typeof item.action === 'string'
      && isEvidenceList(item.evidenceIds)
      && isEvidenceList(item.resourceIds))
    && Array.isArray(value.roadmap)
    && value.roadmap.every((item) => isTextEvidenceItem(item, ['stage', 'goal', 'evaluation'])
      && Array.isArray(item.actions)
      && item.actions.every((action: unknown) => typeof action === 'string'))
    && Array.isArray(value.limitations)
    && value.limitations.every((item) => typeof item === 'string');
}

export async function getStudentProgress(): Promise<StudentProgressData> {
  const response = await authenticatedFetch('/api/student/progress', { method: 'GET' });
  const body = await readResponse(response);
  if (!isStudentProgressData(body.progress)) {
    throw new Error('Phản hồi phân tích tiến độ học tập không đúng định dạng.');
  }
  return body.progress;
}

export async function analyzeStudentProgress(
  filters: StudentProgressFilters,
): Promise<StudentProgressAnalysisResponse> {
  const response = await authenticatedFetch('/api/student/progress/analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  const body = await readResponse(response);
  if (body.status === 'insufficient-data'
    && typeof body.message === 'string'
    && body.analysis === null) {
    return { status: 'insufficient-data', message: body.message, analysis: null };
  }
  if (body.status !== 'analyzed'
    || !isStudentProgressAnalysis(body.analysis)
    || !Array.isArray(body.limitations)
    || !body.limitations.every((item) => typeof item === 'string')) {
    throw new Error('Phản hồi phân tích AI không đúng định dạng.');
  }
  return {
    status: 'analyzed',
    analysis: body.analysis,
    limitations: body.limitations,
  };
}

export async function submitAssignment(
  assignmentId: string,
  responseText: string,
  files: File[] = [],
): Promise<void> {
  const formData = new FormData();
  formData.set('responseText', responseText);
  files.forEach((file) => formData.append('files', file, file.name));
  const response = await authenticatedFetch(
    `/api/assignments/${encodeURIComponent(assignmentId)}/submission`,
    {
      method: 'PUT',
      body: formData,
    },
  );
  await readResponse(response);
}
