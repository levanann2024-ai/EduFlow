import { useEffect, useMemo, useState } from 'react';
import { showToast } from '@/components/toast';
import { Activity, BookMarked, BookOpen, Building2, CalendarDays, ChevronRight, CircleAlert, Copy, GraduationCap, History, KeyRound, LogOut, ScanLine, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';
import type { AuthUser } from '@/auth/authApi';
import { changePassword } from '@/auth/authApi';
import { AccountProfileSection } from '@/components/AccountProfileSection';
import { readUserSettings, saveUserSettings, type AppLanguage } from '@/settings/userSettings';
import {
  getTeacherExamRoomGrading,
  listClassAssignments,
  listClassSubjects,
  listClasses,
  listStudentExamResults,
  listTeacherExamRooms,
  type SchoolClass,
  type StudentExamResult,
} from '@/api/schoolApi';
import type { ExamRoomRecord } from '@/pages/teacher/examRoomDemoData';
import { readRecentSearches, type RecentSearch } from './profileActivity';
import { getStudentWeeklyActivity, type StudentWeeklyActivity } from '@/api/studentLearningActivity';

interface StudyPreferences {
  explanationStyle: 'concise' | 'detailed';
}

const PARENT_LINK_CODE = 'EDU-AN11-2026';

interface ProfileActivityItem {
  id: string;
  title: string;
  detail: string;
  date: string | null;
  icon: 'assignment' | 'exam' | 'grading';
}

function activityDateLabel(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function weekdayLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

function activityIcon(icon: ProfileActivityItem['icon']) {
  if (icon === 'assignment') return BookOpen;
  if (icon === 'exam') return CalendarDays;
  return ScanLine;
}

export function StudentProfile({
  onLogout,
  user,
  avatarUrl = '',
  language,
  onUserUpdate,
  onAvatarChange,
  onOpenExamResult,
  onNavigate,
}: {
  onLogout: () => void;
  user: AuthUser;
  avatarUrl?: string;
  language: AppLanguage;
  onUserUpdate: (user: AuthUser) => void;
  onAvatarChange: (avatarUrl: string) => void;
  onOpenExamResult: (result: StudentExamResult) => void;
  onNavigate: (page: 'classes' | 'ai-grading' | 'exams') => void;
}) {
  const [preferences, setPreferences] = useState<StudyPreferences>({
    explanationStyle: 'detailed',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [studentResults, setStudentResults] = useState<StudentExamResult[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<StudentWeeklyActivity | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<SchoolClass[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
  const [teacherActivities, setTeacherActivities] = useState<ProfileActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState('');
  const isTeacher = user.role === 'lecturer';

  useEffect(() => {
    const result = readUserSettings(user.id, user.role);
    setPreferences({ explanationStyle: result.settings.explanationStyle });
    setError(result.error);
  }, [user.id, user.role]);

  useEffect(() => {
    setRecentSearches(readRecentSearches(user.id));
    if (user.isDemo) {
      setActivityLoading(false);
      setStudentResults([]);
      setWeeklyActivity(null);
      setTeacherClasses([]);
      setTeacherSubjects([]);
      setTeacherActivities([]);
      return;
    }

    let active = true;
    setActivityLoading(true);
    setActivityError('');
    setWeeklyActivity(null);
    if (!isTeacher) {
      Promise.allSettled([listStudentExamResults(), getStudentWeeklyActivity()])
        .then(([resultsResult, weeklyResult]) => {
          if (!active) return;
          const errors: string[] = [];
          if (resultsResult.status === 'fulfilled') {
            setStudentResults([...resultsResult.value].sort(
              (first, second) => Date.parse(second.grade.gradedAt) - Date.parse(first.grade.gradedAt),
            ).slice(0, 5));
          } else {
            errors.push(resultsResult.reason instanceof Error ? resultsResult.reason.message : 'Không thể tải lịch sử thi.');
          }
          if (weeklyResult.status === 'fulfilled') {
            setWeeklyActivity(weeklyResult.value);
          } else {
            errors.push(weeklyResult.reason instanceof Error ? weeklyResult.reason.message : 'Không thể tải hành trình học tập.');
          }
          setActivityError(errors.join(' '));
          setActivityLoading(false);
        });
      return () => { active = false; };
    }

    const loadTeacherActivity = async () => {
      const [classesResult, roomsResult] = await Promise.allSettled([
        listClasses(),
        listTeacherExamRooms<ExamRoomRecord>(),
      ]);
      if (!active) return;
      const errors: string[] = [];
      const classes = classesResult.status === 'fulfilled' ? classesResult.value : [];
      const rooms = roomsResult.status === 'fulfilled' ? roomsResult.value : [];
      if (classesResult.status === 'rejected') errors.push('Không thể tải lớp được phân công.');
      if (roomsResult.status === 'rejected') errors.push('Không thể tải đề thi gần đây.');
      setTeacherClasses(classes);

      const recentRoomItems: ProfileActivityItem[] = rooms
        .map((room) => ({
          id: `room:${room.id}`,
          title: room.title,
          detail: `${room.classNames.join(', ')} · ${room.status === 'scheduled' ? 'Đã lên lịch' : room.status === 'completed' ? 'Đã kết thúc' : room.status}`,
          date: room.createdAt,
          icon: 'exam' as const,
        }))
        .sort((first, second) => Date.parse(second.date ?? '') - Date.parse(first.date ?? ''))
        .slice(0, 5);

      const currentAcademicYear = [...new Set(classes.map((item) => item.academic_year))]
        .sort((first, second) => second.localeCompare(first, 'vi', { numeric: true }))[0];
      let assignments: Awaited<ReturnType<typeof listClassAssignments>> = [];
      const teacherClassSubjects = await Promise.allSettled(classes.map(async (classItem) => ({
        classId: classItem.id,
        subjects: await listClassSubjects(classItem.id),
      })));
      const subjectsByClass = new Map(teacherClassSubjects.flatMap((result) => (
        result.status === 'fulfilled' ? [[result.value.classId, result.value.subjects] as const] : []
      )));
      setTeacherSubjects([...new Set(teacherClassSubjects.flatMap((result) => (
        result.status === 'fulfilled' ? result.value.subjects : []
      )))].sort((first, second) => first.localeCompare(second, 'vi')));
      if (teacherClassSubjects.some((result) => result.status === 'rejected')) {
        errors.push('Không thể tải một số môn học được phân công.');
      }
      if (currentAcademicYear) {
        const assignmentResults = await Promise.allSettled(classes
          .filter((classItem) => classItem.academic_year === currentAcademicYear)
          .flatMap((classItem) => (subjectsByClass.get(classItem.id) ?? []).map((subject) => (
            listClassAssignments(classItem.id, currentAcademicYear, 'Kỳ 1', subject)
          ).then(async (firstSemester) => {
            const secondSemester = await listClassAssignments(classItem.id, currentAcademicYear, 'Kỳ 2', subject);
            return [firstSemester, secondSemester];
          }))));
        assignments = assignmentResults.flatMap((result) => (
          result.status === 'fulfilled' ? result.value.flat() : []
        ));
        if (assignmentResults.some((result) => result.status === 'rejected')) {
          errors.push('Một số hoạt động bài tập chưa tải được.');
        }
      }

      const assignmentItems = assignments.map((assignment) => ({
        id: `assignment:${assignment.id}`,
        title: assignment.title,
        detail: `${assignment.subject} · ${assignment.submittedCount}/${assignment.studentCount} bài đã nộp`,
        date: assignment.createdAt ?? null,
        icon: 'assignment' as const,
      }));
      const gradingItems: ProfileActivityItem[] = assignments.flatMap((assignment) => {
        const latestGradedAt = assignment.students
          .map((student) => student.gradedAt)
          .filter((date): date is string => Boolean(date))
          .sort((first, second) => Date.parse(second) - Date.parse(first))[0];
        return latestGradedAt ? [{
          id: `graded-assignment:${assignment.id}:${latestGradedAt}`,
          title: `Đã chấm: ${assignment.title}`,
          detail: `${assignment.subject} · ${assignment.students.filter((student) => student.gradedAt).length} bài`,
          date: latestGradedAt,
          icon: 'grading' as const,
        }] : [];
      });

      if (roomsResult.status === 'fulfilled') {
        const gradingResults = await Promise.allSettled(rooms.slice(0, 5).map((room) => getTeacherExamRoomGrading(room.id)));
        gradingResults.forEach((result) => {
          if (result.status === 'rejected') return;
          const gradedStudents = result.value.students.filter((student) => student.grade);
          if (gradedStudents.length === 0) return;
          const latestGrade = gradedStudents
            .map((student) => student.grade)
            .filter((grade): grade is NonNullable<typeof grade> => grade !== null)
            .sort((first, second) => Date.parse(second.publishedAt ?? second.gradedAt) - Date.parse(first.publishedAt ?? first.gradedAt))[0];
          const room = rooms.find((item) => item.id === result.value.room.id);
          if (!latestGrade || !room) return;
          gradingItems.push({
            id: `graded-exam:${room.id}:${latestGrade.gradedAt}`,
            title: `Đã chấm: ${room.title}`,
            detail: `${gradedStudents.length} bài kiểm tra`,
            date: latestGrade.publishedAt ?? latestGrade.gradedAt,
            icon: 'grading',
          });
        });
        if (gradingResults.some((result) => result.status === 'rejected')) errors.push('Một số lịch sử chấm thi chưa tải được.');
      }

      const recentActivities = [...assignmentItems, ...recentRoomItems, ...gradingItems]
        .sort((first, second) => Date.parse(second.date ?? '') - Date.parse(first.date ?? ''))
        .filter((item, index, items) => items.findIndex((candidate) => (
          candidate.title === item.title && candidate.icon === item.icon
        )) === index)
        .slice(0, 1);
      setTeacherActivities(recentActivities);
      setActivityError(errors.join(' '));
      setActivityLoading(false);
    };
    void loadTeacherActivity().catch((requestError: unknown) => {
      if (!active) return;
      setActivityError(requestError instanceof Error ? requestError.message : 'Không thể tải hoạt động gần đây.');
      setActivityLoading(false);
    });
    return () => { active = false; };
  }, [isTeacher, user.id, user.isDemo]);

  const updatePreferences = (next: StudyPreferences) => {
    try {
      const current = readUserSettings(user.id, user.role).settings;
      saveUserSettings(user.id, { ...current, ...next }, user.role);
      setPreferences(next);
      setError('');
    } catch {
      setError('Không thể lưu thiết lập học tập trên thiết bị này.');
    }
  };

  const copyParentCode = async () => {
    try {
      await navigator.clipboard.writeText(PARENT_LINK_CODE);
      showToast('Đã sao chép mã liên kết.');
      setError('');
    } catch {
      setError('Không thể sao chép mã. Hãy chọn và sao chép mã thủ công.');
    }
  };

  const requestPasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (user.isDemo) {
      showToast('Chế độ demo không lưu thay đổi mật khẩu.', 'info');
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      showToast('Đã đổi mật khẩu.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Không thể đổi mật khẩu.');
    }
  };

  const recentStudentExams = useMemo(() => studentResults.slice(0, 5), [studentResults]);
  const teacherSchools = [...new Set(teacherClasses
    .map((classItem) => classItem.school_name?.trim())
    .filter((name): name is string => Boolean(name)))];

  return (
    <main className={`mx-auto space-y-5 pb-8 ${isTeacher ? 'max-w-6xl' : 'max-w-5xl'}`}>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <AccountProfileSection
        user={user}
        avatarUrl={avatarUrl}
        language={language}
        onUserUpdate={onUserUpdate}
        onAvatarChange={onAvatarChange}
      />

      {isTeacher ? (
        <>
          <section aria-labelledby="teacher-details-title" className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:grid-cols-2">
            <div>
              <h2 id="teacher-details-title" className="text-base font-bold text-slate-900">Tác vụ gần nhất</h2>
              {activityLoading ? (
                <p role="status" className="mt-3 text-sm text-slate-500">Đang tải...</p>
              ) : teacherActivities[0] ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  {(() => {
                    const item = teacherActivities[0];
                    const Icon = activityIcon(item.icon);
                    return (
                      <>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700"><Icon className="h-5 w-5" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                          <p className="truncate text-xs text-slate-500">{item.detail}{item.date ? ` · ${activityDateLabel(item.date)}` : ''}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onNavigate(item.icon === 'exam' ? 'exams' : item.icon === 'grading' ? 'ai-grading' : 'classes')}
                          className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                        >
                          Mở
                        </button>
                      </>
                    );
                  })()}
                </div>
              ) : <p className="mt-3 text-sm text-slate-500">Chưa có tác vụ gần đây.</p>}
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-blue-200">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <Users className="h-4 w-4 text-blue-600" />Lớp phụ trách
                </h3>
                {teacherClasses.length ? (
                  <div className="mt-3 flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                    {teacherClasses.map((classItem) => (
                      <button key={classItem.id} type="button" onClick={() => onNavigate('classes')} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700">
                        {classItem.code || classItem.name}
                      </button>
                    ))}
                  </div>
                ) : <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-500">{activityLoading ? 'Đang tải phân công...' : 'Chưa có lớp được phân công.'}</p>}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-blue-200">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <BookMarked className="h-4 w-4 text-violet-600" />Môn giảng dạy
                </h3>
                {teacherSubjects.length ? (
                  <div className="mt-3 flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                    {teacherSubjects.map((subject) => (
                      <span key={subject} className="rounded-md border border-violet-100 bg-white px-3 py-1.5 text-sm font-semibold text-violet-800 shadow-sm">{subject}</span>
                    ))}
                  </div>
                ) : <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-500">{activityLoading ? 'Đang tải môn học...' : 'Chưa có dữ liệu môn học.'}</p>}
              </div>
              {teacherSchools.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-blue-200">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <Building2 className="h-4 w-4 text-emerald-600" />Trường
                  </h3>
                  <div className="mt-3 space-y-2">
                    {teacherSchools.map((schoolName) => (
                      <p key={schoolName} className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm font-semibold text-slate-800">{schoolName}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        user.isDemo && (
          <section aria-label="Mã liên kết phụ huynh" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mã liên kết phụ huynh</p>
                <p className="mt-1 font-mono text-lg font-bold tracking-wider text-slate-900">{PARENT_LINK_CODE}</p>
                <p className="mt-1 text-xs text-slate-500">Phụ huynh có thể dùng mã này để gửi yêu cầu liên kết.</p>
              </div>
              <button type="button" onClick={() => void copyParentCode()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700">
                <Copy className="h-4 w-4" />Sao chép mã
              </button>
            </div>
          </section>
        )
      )}

      <div className={isTeacher ? '' : 'grid gap-5 lg:grid-cols-[1.05fr_0.95fr]'}>
      {!isTeacher && <section aria-labelledby="learning-journey-title" className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Activity className="h-5 w-5" /></span>
            <div>
              <h2 id="learning-journey-title" className="text-lg font-bold text-slate-900">Hành trình học tập</h2>
              <p className="mt-1 text-sm text-slate-500">Ghi nhận những lần bạn thực sự học và luyện tập.</p>
            </div>
          </div>
        </div>
        {user.isDemo ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-center text-sm text-slate-500">
            Hoạt động học tập thật sẽ được ghi nhận khi bạn sử dụng tài khoản cá nhân.
          </p>
        ) : activityLoading ? (
          <p role="status" className="mt-6 py-5 text-center text-sm text-slate-500">Đang tải hành trình học tập...</p>
        ) : weeklyActivity ? (
          <>
            <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {weeklyActivity.activeDays}<span className="ml-1 text-base font-semibold text-slate-400">/ 7 ngày</span>
                </p>
                <p className="mt-1 text-sm font-medium text-slate-600">có hoạt động học tập</p>
              </div>
              <p className="rounded-xl bg-white/80 px-3 py-2 text-sm font-semibold text-sky-800">
                {weeklyActivity.activityCount} hoạt động trong tuần
              </p>
            </div>
            <div className="mt-5 grid grid-cols-7 gap-2 sm:gap-3">
              {weeklyActivity.days.map((day) => {
                const fill = Math.min(day.count / 4, 1) * 100;
                return (
                  <div key={day.date} className="flex min-w-0 flex-col items-center gap-2" title={`${weekdayLabel(day.date)}: ${day.count} hoạt động`}>
                    <span className={`text-xs font-bold ${day.count ? 'text-sky-800' : 'text-slate-300'}`}>{day.count || '·'}</span>
                    <div
                      aria-label={`${weekdayLabel(day.date)}: ${day.count} hoạt động học tập`}
                      className="flex h-[76px] w-full max-w-10 items-end overflow-hidden rounded-[18px] border-2 border-sky-200 bg-white/80 p-[3px] shadow-inner"
                    >
                      <div
                        className="w-full rounded-[13px] bg-gradient-to-t from-sky-600 via-sky-500 to-cyan-300 transition-[height] duration-700 ease-out"
                        style={{ height: `${fill}%` }}
                      />
                    </div>
                    <span className="text-[0.6875rem] font-medium capitalize text-slate-500">{weekdayLabel(day.date)}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-center text-sm text-slate-500">
            Chưa có dữ liệu hoạt động học tập trong tuần này.
          </p>
        )}
      </section>}
      {!isTeacher && <section aria-labelledby="recent-activity-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Activity className="h-5 w-5" /></span>
          <div>
            <h2 id="recent-activity-title" className="text-lg font-bold text-slate-900">{isTeacher ? 'Công việc giảng dạy' : 'Hoạt động gần đây'}</h2>
          </div>
        </div>
        {activityError && <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{activityError}</p>}
        {activityLoading ? (
          <p role="status" className="py-6 text-center text-sm text-slate-500">Đang tải hoạt động...</p>
        ) : isTeacher ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.7fr)]">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><History className="h-4 w-4 text-blue-600" />Mới đây</h3>
              {teacherActivities.length ? (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {teacherActivities.map((item) => {
                    const Icon = activityIcon(item.icon);
                    const destination = item.icon === 'exam' ? 'exams' : item.icon === 'grading' ? 'ai-grading' : 'classes';
                    const actionLabel = item.icon === 'exam' ? 'Đề thi' : item.icon === 'grading' ? 'Chấm bài' : 'Lớp học';
                    return (
                      <li key={item.id} className="flex items-center gap-3 px-3 py-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          item.icon === 'exam' ? 'bg-violet-50 text-violet-700'
                            : item.icon === 'grading' ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-blue-50 text-blue-700'
                        }`}><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                          <p className="truncate text-xs text-slate-500">{item.detail}{item.date ? ` · ${activityDateLabel(item.date)}` : ''}</p>
                        </div>
                        <button type="button" onClick={() => onNavigate(destination)} className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-50">
                          {actionLabel}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Chưa có hoạt động gần đây.</p>}
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><GraduationCap className="h-4 w-4 text-blue-600" />Lớp phụ trách</h3>
                <button type="button" onClick={() => onNavigate('classes')} className="text-xs font-bold text-blue-700 hover:underline">Mở lớp</button>
              </div>
              {teacherClasses.length ? (
                <ul className="mt-3 space-y-2">
                  {teacherClasses.slice(0, 6).map((classItem) => (
                    <li key={classItem.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                      <span className="truncate text-sm font-semibold text-slate-700">{classItem.code || classItem.name}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-sm text-slate-500">Chưa có lớp được phân công.</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800"><Search className="h-4 w-4 text-blue-600" />Tra cứu gần đây</h3>
              {recentSearches.length ? (
                <ul className="space-y-2">{recentSearches.slice(0, 5).map((item) => (
                  <li key={`${item.query}:${item.searchedAt}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                    <span className="min-w-0 truncate text-sm font-medium text-slate-700">{item.query}</span>
                    <span className="shrink-0 text-xs text-slate-400">{activityDateLabel(item.searchedAt)}</span>
                  </li>
                ))}</ul>
              ) : <p className="text-sm text-slate-500">Các nội dung bạn tìm kiếm sẽ hiển thị ở đây.</p>}
            </div>
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800"><History className="h-4 w-4 text-blue-600" />Lịch sử thi đã có điểm</h3>
              {recentStudentExams.length ? (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {recentStudentExams.map((result) => (
                    <li key={result.sessionId} className="flex items-center gap-3 px-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{result.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{result.subject} · {activityDateLabel(result.grade.gradedAt)}</span>
                      </span>
                      <strong className="shrink-0 text-sm font-bold text-blue-700">{result.grade.totalScore} điểm</strong>
                      <button type="button" onClick={() => onOpenExamResult(result)} className="shrink-0 text-xs font-semibold text-blue-700 hover:underline">Xem</button>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">Chưa có bài thi được công bố điểm.</p>}
            </div>
          </div>
        )}
      </section>}
      </div>

      <section aria-labelledby="study-settings-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h1 id="study-settings-title" className="text-lg font-bold text-slate-900\">Cài đặt tài khoản và AI</h1>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex flex-col gap-4 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Sparkles className="h-5 w-5" /></span>
              <div>
                <h3 className="font-semibold text-slate-800">Thiết lập AI</h3>
                <p className="mt-1 text-sm text-slate-500">{isTeacher ? 'Chọn mức độ chi tiết khi EduBot hỗ trợ công việc.' : 'Chọn mức độ chi tiết khi EduBot giải thích.'}</p>
              </div>
            </div>
            <select
              aria-label="Mức độ giải thích của EduBot"
              value={preferences.explanationStyle}
              onChange={(event) => updatePreferences({ ...preferences, explanationStyle: event.target.value as StudyPreferences['explanationStyle'] })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
            >
              <option value="concise">Giải thích ngắn gọn</option>
              <option value="detailed">Giải thích chi tiết kèm ví dụ</option>
            </select>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <h2 id="account-security-title" className="font-bold text-slate-900">Tài khoản &amp; bảo mật</h2>
            <p className="mt-1 text-sm text-slate-500">Quản lý mật khẩu và phiên đăng nhập.</p>
          </div>
          </div>
          <form onSubmit={(event) => void requestPasswordChange(event)} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu hiện tại
            <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Nhập mật khẩu hiện tại" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu mới
            <input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Tối thiểu 12 ký tự" />
          </label>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <KeyRound className="h-4 w-4" /> Đổi mật khẩu
          </button>
          </form>
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500"></p>
            <button type="button" onClick={onLogout} className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
