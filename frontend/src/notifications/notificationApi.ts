import { authenticatedFetch } from '@/auth/authApi';
import type { Role, Page } from '@/types';
import {
  listClassAssignments,
  listClassSubjects,
  listClasses,
  listStudentAssignments,
  listStudentExamAppeals,
  listStudentExamResults,
  listStudentExamRooms,
  listTeacherExamAppeals,
  listTeacherExamRooms,
  type ClassAssignment,
  type StudentAssignment,
  type StudentExamRoom,
  type StudentExamResult,
  type ExamAppeal,
} from '@/api/schoolApi';
import type { AppLanguage } from '@/settings/userSettings';
import type { ExamRoomRecord } from '@/pages/teacher/examRoomDemoData';

export type NotificationKind = 'assignment' | 'grade' | 'appeal' | 'grading' | 'exam';

export interface UserNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  createdAt: string;
  destination: Page;
  read: boolean;
}

interface NotificationFeed {
  items: UserNotification[];
  error: string;
}

function validDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isWithin(timestamp: number | null, now: number, days: number) {
  return timestamp !== null && timestamp <= now && timestamp >= now - days * 24 * 60 * 60 * 1000;
}

function currentSemester(now: Date) {
  return now.getMonth() >= 7 ? 'Kỳ 1' : 'Kỳ 2';
}

function formatDue(value: string, language: AppLanguage) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(language === 'en' ? 'en' : 'vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function assignmentNotifications(assignments: StudentAssignment[], now: number, language: AppLanguage) {
  const items: UserNotification[] = [];
  for (const assignment of assignments) {
    const createdAt = validDate(assignment.createdAt);
    const dueAt = validDate(assignment.dueAt);
    const dueSoon = dueAt !== null && dueAt >= now && dueAt <= now + 72 * 60 * 60 * 1000;
    if (
      createdAt !== null
      && isWithin(createdAt, now, 7)
      && (!dueSoon || assignment.submittedAt !== null)
    ) {
      items.push({
        id: `student:assignment:new:${assignment.id}`,
        kind: 'assignment',
        title: language === 'en' ? 'New assignment' : 'Bài tập mới được giao',
        detail: language === 'en'
          ? `${assignment.subject} · ${assignment.classCode} · Due ${formatDue(assignment.dueAt, language)}`
          : `${assignment.subject} · ${assignment.classCode} · Hạn ${formatDue(assignment.dueAt, language)}`,
        createdAt: assignment.createdAt ?? new Date(createdAt).toISOString(),
        destination: 'assignments',
        read: false,
      });
    }

    if (
      assignment.submittedAt === null
      && dueSoon
    ) {
      items.push({
        id: `student:assignment:due:${assignment.id}`,
        kind: 'assignment',
        title: language === 'en' ? 'Assignment due soon' : 'Bài tập sắp đến hạn',
        detail: language === 'en'
          ? `${assignment.title} · ${assignment.classCode} · Due ${formatDue(assignment.dueAt, language)}`
          : `${assignment.title} · ${assignment.classCode} · Hạn ${formatDue(assignment.dueAt, language)}`,
        createdAt: new Date(now).toISOString(),
        destination: 'assignments',
        read: false,
      });
    }
  }
  return items;
}

function studentResultNotifications(results: StudentExamResult[], now: number, language: AppLanguage) {
  return results
    .filter((result) => !result.grade.isRead && isWithin(validDate(result.grade.gradedAt), now, 30))
    .map((result) => ({
      id: `student:exam-result:${result.sessionId}:${result.grade.gradedAt ?? ''}`,
      kind: 'grade' as const,
      title: language === 'en' ? 'Exam result available' : 'Bài kiểm tra đã có kết quả',
      detail: language === 'en'
        ? `${result.title} · ${result.subject} · ${result.grade.totalScore} points`
        : `${result.title} · ${result.subject} · ${result.grade.totalScore} điểm`,
      createdAt: result.grade.gradedAt ?? result.submittedAt ?? result.startsAt,
      destination: 'my-results' as const,
      read: false,
    }));
}

function studentAppealNotifications(appeals: ExamAppeal[], now: number, language: AppLanguage) {
  return appeals
    .filter((appeal) => appeal.status !== 'pending' && isWithin(validDate(appeal.reviewedAt), now, 30))
    .map((appeal) => ({
      id: `student:appeal:${appeal.id}:${appeal.reviewedAt ?? ''}`,
      kind: 'appeal' as const,
      title: language === 'en'
        ? appeal.status === 'reviewed' ? 'Appeal reviewed' : 'Appeal not accepted'
        : appeal.status === 'reviewed' ? 'Yêu cầu phúc khảo đã được phản hồi' : 'Yêu cầu phúc khảo không được chấp nhận',
      detail: `${appeal.examTitle} · ${appeal.subject}${appeal.teacherResponse ? ` · ${appeal.teacherResponse}` : ''}`,
      createdAt: appeal.reviewedAt ?? appeal.createdAt,
      destination: 'online-exams' as const,
      read: false,
    }));
}

function studentExamNotifications(rooms: StudentExamRoom[], now: number, language: AppLanguage) {
  return rooms
    .filter((room) => {
      const startsAt = validDate(room.startsAt);
      return room.status === 'scheduled'
        && !room.hasSubmitted
        && startsAt !== null
        && startsAt >= now
        && startsAt <= now + 7 * 24 * 60 * 60 * 1000;
    })
    .map((room) => ({
      id: `student:exam:${room.id}:${room.startsAt}`,
      kind: 'exam' as const,
      title: language === 'en' ? 'Upcoming online exam' : 'Sắp có lịch thi trực tuyến',
      detail: `${room.title} · ${room.subject} · ${formatDue(room.startsAt, language)}`,
      createdAt: new Date(now).toISOString(),
      destination: 'online-exams' as const,
      read: false,
    }));
}

function teacherAppealNotifications(appeals: ExamAppeal[], now: number, language: AppLanguage) {
  return appeals
    .filter((appeal) => appeal.status === 'pending' && isWithin(validDate(appeal.createdAt), now, 30))
    .map((appeal) => ({
      id: `teacher:appeal:${appeal.id}`,
      kind: 'appeal' as const,
      title: language === 'en' ? 'New exam appeal' : 'Có yêu cầu phúc khảo mới',
      detail: `${appeal.studentName ?? (language === 'en' ? 'Student' : 'Học sinh')} · ${appeal.className} · ${appeal.examTitle}`,
      createdAt: appeal.createdAt,
      destination: 'exams' as const,
      read: false,
    }));
}

function teacherExamNotifications(rooms: ExamRoomRecord[], now: number, language: AppLanguage) {
  return rooms
    .filter((room) => {
      const startsAt = validDate(room.startsAt);
      return room.status === 'scheduled'
        && startsAt !== null
        && startsAt >= now
        && startsAt <= now + 7 * 24 * 60 * 60 * 1000;
    })
    .map((room) => ({
      id: `teacher:exam:${room.id}:${room.startsAt}`,
      kind: 'exam' as const,
      title: language === 'en' ? 'Upcoming exam' : 'Sắp đến lịch kiểm tra',
      detail: `${room.title} · ${room.classNames.join(', ')} · ${formatDue(room.startsAt, language)}`,
      createdAt: new Date(now).toISOString(),
      destination: 'exam-monitor' as const,
      read: false,
    }));
}

function teacherSubmissionNotifications(assignments: ClassAssignment[], classCode: string, now: number, language: AppLanguage) {
  return assignments.flatMap((assignment) => {
    const ungraded = assignment.students.filter((student) => student.submittedAt && !student.gradedAt);
    if (ungraded.length === 0) return [];
    const latestSubmission = ungraded
      .map((student) => student.submittedAt)
      .filter((value): value is string => Boolean(value))
      .sort((first, second) => Date.parse(second) - Date.parse(first))[0];
    if (!isWithin(validDate(latestSubmission), now, 30)) return [];
    return [{
      id: `teacher:assignment:submissions:${assignment.id}:${latestSubmission}`,
      kind: 'grading' as const,
      title: language === 'en'
        ? `${ungraded.length} submission${ungraded.length === 1 ? '' : 's'} awaiting grading`
        : `${ungraded.length} bài nộp đang chờ chấm`,
      detail: `${assignment.title} · ${assignment.subject} · ${classCode}`,
      createdAt: latestSubmission ?? assignment.createdAt ?? assignment.dueAt,
      destination: 'ai-grading' as const,
      read: false,
    }];
  });
}

async function loadTeacherAssignmentNotifications(now: number, language: AppLanguage) {
  const classes = await listClasses();
  const academicYear = [...new Set(classes.map((item) => item.academic_year))]
    .sort((first, second) => second.localeCompare(first, 'vi', { numeric: true }))[0];
  if (!academicYear) return { items: [] as UserNotification[], error: '' };

  const semester = currentSemester(new Date(now));
  const currentClasses = classes.filter((item) => item.academic_year === academicYear);
  const results = await Promise.allSettled(currentClasses.map(async (classItem) => {
    const subjects = await listClassSubjects(classItem.id);
    const assignmentGroups = await Promise.all(subjects.map((subject) => (
      listClassAssignments(classItem.id, academicYear, semester, subject)
    )));
    return assignmentGroups.flatMap((assignments) => (
      teacherSubmissionNotifications(assignments, classItem.code, now, language)
    ));
  }));
  const items = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const failed = results.some((result) => result.status === 'rejected');
  return {
    items,
    error: failed
      ? language === 'en' ? 'Some assignment notifications could not be loaded.' : 'Một số thông báo bài tập của giáo viên chưa tải được.'
      : '',
  };
}

export async function loadNotificationFeed(role: Role, language: AppLanguage = 'vi'): Promise<NotificationFeed> {
  if (role === 'admin') return { items: [], error: '' };
  const now = Date.now();
  const sortByDate = (items: UserNotification[]) => (
    items.sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
  );
  if (role === 'student') {
    const [assignmentsResult, gradesResult, appealsResult, examsResult] = await Promise.allSettled([
      listStudentAssignments(),
      listStudentExamResults(),
      listStudentExamAppeals(),
      listStudentExamRooms(),
    ]);
    const items = [
      ...(assignmentsResult.status === 'fulfilled' ? assignmentNotifications(assignmentsResult.value, now, language) : []),
      ...(gradesResult.status === 'fulfilled' ? studentResultNotifications(gradesResult.value, now, language) : []),
      ...(appealsResult.status === 'fulfilled' ? studentAppealNotifications(appealsResult.value, now, language) : []),
      ...(examsResult.status === 'fulfilled' ? studentExamNotifications(examsResult.value, now, language) : []),
    ];
    const failed = [assignmentsResult, gradesResult, appealsResult, examsResult].some((result) => result.status === 'rejected');
    return {
      items: sortByDate(items),
      error: failed
        ? language === 'en' ? 'Some learning notifications could not be loaded.' : 'Một số thông báo học tập chưa tải được.'
        : '',
    };
  }

  const [assignmentsResult, appealsResult, examsResult] = await Promise.allSettled([
    loadTeacherAssignmentNotifications(now, language),
    listTeacherExamAppeals(),
    listTeacherExamRooms<ExamRoomRecord>(),
  ]);
  const items = [
    ...(assignmentsResult.status === 'fulfilled' ? assignmentsResult.value.items : []),
    ...(appealsResult.status === 'fulfilled' ? teacherAppealNotifications(appealsResult.value, now, language) : []),
    ...(examsResult.status === 'fulfilled' ? teacherExamNotifications(examsResult.value, now, language) : []),
  ];
  const error = [
    assignmentsResult.status === 'fulfilled'
      ? assignmentsResult.value.error
      : language === 'en' ? 'Could not load assignment grading notifications.' : 'Không thể tải thông báo bài tập cần chấm.',
    appealsResult.status === 'rejected'
      ? language === 'en' ? 'Could not load appeal notifications.' : 'Không thể tải thông báo phúc khảo.'
      : '',
    examsResult.status === 'rejected'
      ? language === 'en' ? 'Could not load exam notifications.' : 'Không thể tải thông báo lịch kiểm tra.'
      : '',
  ].filter(Boolean).join(' ');
  return { items: sortByDate(items), error };
}

export async function readNotificationState(ids: string[]) {
  if (ids.length === 0) return [];
  const readIds: string[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const response = await authenticatedFetch('/api/notifications/read-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids.slice(index, index + 100) }),
    });
    const body: unknown = await response.json();
    if (!response.ok || !isRecord(body) || body.success !== true || !Array.isArray(body.readIds)
      || !body.readIds.every((id) => typeof id === 'string')) {
      throw new Error('Không thể tải trạng thái đã đọc của thông báo.');
    }
    readIds.push(...body.readIds);
  }
  return readIds;
}

export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  for (let index = 0; index < ids.length; index += 100) {
    const response = await authenticatedFetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids.slice(index, index + 100) }),
    });
    const body: unknown = await response.json();
    if (!response.ok || !isRecord(body) || body.success !== true) {
      throw new Error('Không thể lưu trạng thái đã đọc của thông báo.');
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
