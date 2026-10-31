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
  subjects?: Array<{ subject: string; teacherName: string | null }>;
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
  files: AssignmentSubmissionFile[];
  submittedAt: string | null;
  score: number | null;
  teacherFeedback: string;
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

export interface StudentSubjectAverage {
  classId: string;
  className: string;
  classCode: string;
  academicYear: string;
  subject: string;
  average: number | null;
  previousAverage: number | null;
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
    && (typeof value.homeroom_subject === 'string' || value.homeroom_subject === null)
    && (value.subjects === undefined || (
      Array.isArray(value.subjects)
      && value.subjects.every((subject) => isRecord(subject)
        && typeof subject.subject === 'string'
        && (typeof subject.teacherName === 'string' || subject.teacherName === null))
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
    || typeof value.title !== 'string' || typeof value.subject !== 'string'
    || typeof value.startsAt !== 'string' || typeof value.durationMinutes !== 'number'
    || !Number.isInteger(value.inProgressCount) || typeof value.hasSubmitted !== 'boolean'
    || typeof value.instructions !== 'string' || !isRecord(value.settings)
    || !isRecord(value.examSnapshot) || !Array.isArray(value.examSnapshot.questions)) {
    return false;
  }
  const settings = value.settings;
  return ['shuffleQuestions', 'allowBackNavigation', 'allowEarlySubmit', 'requireCamera', 'requireMicrophone',
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
    && Array.isArray(value.files)
    && value.files.every(isAssignmentSubmissionFile)
    && (value.submittedAt === null || typeof value.submittedAt === 'string')
    && (value.score === null || (typeof value.score === 'number' && Number.isFinite(value.score)))
    && typeof value.teacherFeedback === 'string'
    && (value.gradedAt === null || typeof value.gradedAt === 'string');
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

function isStudentSubjectAverage(value: unknown): value is StudentSubjectAverage {
  return isRecord(value)
    && typeof value.classId === 'string'
    && typeof value.className === 'string'
    && typeof value.classCode === 'string'
    && typeof value.academicYear === 'string'
    && typeof value.subject === 'string'
    && (value.average === null || (typeof value.average === 'number' && Number.isFinite(value.average)))
    && (value.previousAverage === null
      || (typeof value.previousAverage === 'number' && Number.isFinite(value.previousAverage)));
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
