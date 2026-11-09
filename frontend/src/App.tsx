import { useEffect, useRef, useState } from 'react';
import { Sidebar, MobileNav, NotificationDrawer, TopBar } from '@/components/Sidebar';
import { ToastViewport } from '@/components/ToastNotifications';
import { Login } from '@/pages/Login';
import { Landing } from '@/pages/Landing';
import { OnboardingGuide } from '@/pages/OnboardingGuide';
import { readOnboardingStatus, saveOnboardingCompletion } from '@/auth/onboarding';
import { Dashboard } from '@/pages/Dashboard';
import { ClassManagement } from '@/pages/teacher/ClassManagement';
import { AIChat } from '@/pages/AIChat';
import { Analytics } from '@/pages/Analytics';
import { Lectures } from '@/pages/Lectures';
import { TeacherDashboard } from '@/pages/teacher/TeacherDashboard';
import { LessonRepository, type LessonRepositoryDraft } from '@/pages/teacher/LessonRepository';
import { AILessonBuilder } from '@/pages/teacher/AILessonBuilder';
import { ExamQuestionWorkspace, GradingAnalyticsWorkspace, ProctoringWorkspace } from '@/pages/teacher/TeacherWorkspaces';
import { MyClasses } from '@/pages/student/MyClasses';
import { Assignments } from '@/pages/student/Assignments';
import { MyResults } from '@/pages/student/MyResults';
import { StudentSchedule } from '@/pages/student/StudentSchedule';
import { TeacherSchedule } from '@/pages/teacher/TeacherSchedule';
import { AIPractice } from '@/pages/student/AIPractice';
import { AILearning } from '@/pages/student/AILearning';
import { Leaderboard } from '@/pages/student/Leaderboard';
import { SavedResources } from '@/pages/student/SavedResources';
import { ContactPage } from '@/pages/ContactPage';
import { StudentDashboard } from '@/pages/student/StudentDashboard';
import { StudentProfile } from '@/pages/student/StudentProfile';
import { OnlineExamRooms } from '@/pages/student/OnlineExamRooms';
import type { StudentExamResult } from '@/api/schoolApi';
import { MobileExamUploadPage } from '@/pages/student/exams/MobileExamUploadPage';
import {
  loadNotificationFeed,
  markNotificationsRead,
  readNotificationState,
  type UserNotification,
} from '@/notifications/notificationApi';
import type { SavedQuiz } from '@/pages/student/savedItems';
import type { SavedExam } from '@/pages/teacher/assessmentStorage';
import { Users } from '@/pages/staff/Users';
import { AdminDashboard } from '@/pages/staff/AdminDashboard';
import { Settings } from '@/pages/Settings';
import {
  DEFAULT_USER_SETTINGS,
  backgroundStyle,
  readUserSettings,
  saveUserSettings,
  type UserSettings,
} from '@/settings/userSettings';
import { FirstLoginSetup } from '@/auth/FirstLoginSetup';
import { InvitationAcceptance } from '@/auth/InvitationAcceptance';
import { login as authenticate, logout as endSession, restoreSession, saveAvatar, type AuthUser } from '@/auth/authApi';
import type { Page, Role } from '@/types';

const allowedPages: Record<Role, Page[]> = {
  lecturer: ['dashboard', 'classes', 'schedule', 'lessons', 'lesson-builder', 'question-bank', 'saved-assignments', 'exams', 'exam-monitor', 'ai-grading', 'ai-chat', 'analytics', 'saved', 'feedback', 'profile', 'settings'],
  student: ['dashboard', 'schedule', 'my-classes', 'assignments', 'ai-learning', 'ai-chat', 'ai-practice', 'my-results', 'leaderboard', 'saved', 'feedback', 'profile', 'online-exams', 'settings'],
  admin: ['dashboard', 'admin-years', 'admin-classes', 'admin-subjects', 'admin-assignments', 'users', 'admin-storage', 'analytics', 'settings'],
};

const teacherPageByPath: Record<string, Page> = {
  '/teacher/dashboard': 'dashboard',
  '/teacher/schedule': 'schedule',
  '/teacher/classes': 'classes',
  '/teacher/lessons': 'lessons',
  '/teacher/ai-lesson-builder': 'lesson-builder',
  '/teacher/question-bank': 'question-bank',
  '/teacher/saved-assignments': 'saved-assignments',
  '/teacher/exams': 'exams',
  '/teacher/exam-monitor': 'exam-monitor',
  '/teacher/ai-grading': 'ai-grading',
  '/teacher/ai-chat': 'ai-chat',
  '/teacher/analytics': 'analytics',
  '/teacher/saved': 'saved',
  '/teacher/contact': 'feedback',
};

function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [adminSchoolId, setAdminSchoolId] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authScreen, setAuthScreen] = useState<'landing' | 'login'>(
    () => window.location.pathname === '/' ? 'landing' : 'login',
  );
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStorageError, setOnboardingStorageError] = useState('');
  const [page, setPage] = useState<Page>(() => teacherPageByPath[window.location.pathname] ?? 'dashboard');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const demoNotificationReadIds = useRef<{ userId: string; ids: Set<string> }>({ userId: '', ids: new Set() });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [userSettingsError, setUserSettingsError] = useState('');
  const [studentChatSeed, setStudentChatSeed] = useState<{ subject: string; prompt: string } | null>(null);
  const [teacherChatPrompt, setTeacherChatPrompt] = useState('');
  const [practiceSeed, setPracticeSeed] = useState<SavedQuiz | null>(null);
  const [practiceTopicSeed, setPracticeTopicSeed] = useState<{ subject: string; topic: string } | null>(null);
  const [resourceSubjectSeed, setResourceSubjectSeed] = useState<string | null>(null);
  const [lessonBuilderInitialMode, setLessonBuilderInitialMode] = useState<'lesson' | 'exam'>('lesson');
  const [roomExamSeed, setRoomExamSeed] = useState<SavedExam | null>(null);
  const [lessonRepositoryDraft, setLessonRepositoryDraft] = useState<LessonRepositoryDraft | null>(null);
  const [lessonsWorkspaceVisited, setLessonsWorkspaceVisited] = useState(
    () => window.location.pathname === '/teacher/lessons',
  );
  const [initialSubjectView, setInitialSubjectView] = useState<'lessons' | 'assignments' | 'exam' | null>(null);
  const [initialSubjectTopic, setInitialSubjectTopic] = useState<string | null>(null);
  const [initialExamSessionId, setInitialExamSessionId] = useState<string | null>(null);
  const [initialExamClassId, setInitialExamClassId] = useState<string | null>(null);
  const [initialResourceId, setInitialResourceId] = useState<string | null>(null);
  const [initialAssignmentId, setInitialAssignmentId] = useState<string | null>(null);
  const [initialChatConversationId, setInitialChatConversationId] = useState<string | null>(null);

  useEffect(() => {
    const syncAuthScreen = () => setAuthScreen(window.location.pathname === '/' ? 'landing' : 'login');
    window.addEventListener('popstate', syncAuthScreen);
    return () => window.removeEventListener('popstate', syncAuthScreen);
  }, []);

  useEffect(() => {
    if (!authUser || (authUser.role !== 'student' && authUser.role !== 'lecturer')
      || authUser.mustChangePassword || !authUser.profileComplete) {
      setOnboardingOpen(false);
      setOnboardingStorageError('');
      return;
    }
    const status = readOnboardingStatus(authUser.id, authUser.role);
    setOnboardingOpen(!status.completed);
    setOnboardingStorageError(status.error);
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setUserSettings(DEFAULT_USER_SETTINGS);
      setUserSettingsError('');
      return;
    }
    const result = readUserSettings(authUser.id, authUser.role);
    const settings = {
      ...result.settings,
      avatar: authUser.avatarUrl ?? result.settings.avatar,
    };
    setUserSettings(settings);
    setUserSettingsError(result.error);
    document.documentElement.lang = settings.language;
    let active = true;
    const syncSettings = () => {
      const updated = readUserSettings(authUser.id, authUser.role);
      setUserSettings({ ...updated.settings, avatar: authUser.avatarUrl ?? updated.settings.avatar });
      setUserSettingsError(updated.error);
    };
    window.addEventListener('eduflow-user-settings-updated', syncSettings);
    if (!authUser.isDemo && !authUser.avatarUrl && result.settings.avatar) {
      void saveAvatar(result.settings.avatar)
        .then((updatedUser) => {
          if (!active) return;
          setAuthUser(updatedUser);
          const currentSettings = readUserSettings(authUser.id, authUser.role).settings;
          saveUserSettings(authUser.id, { ...currentSettings, avatar: updatedUser.avatarUrl ?? '' }, authUser.role);
        })
        .catch((error: unknown) => {
          if (active) setUserSettingsError(error instanceof Error ? error.message : 'Không thể đồng bộ ảnh đại diện lên máy chủ.');
        });
    }
    return () => {
      active = false;
      window.removeEventListener('eduflow-user-settings-updated', syncSettings);
    };
  }, [authUser]);

  useEffect(() => {
    document.documentElement.lang = userSettings.language;
    document.documentElement.style.setProperty(
      '--app-font-scale',
      String(userSettings.fontScalePercent / 100),
    );
  }, [userSettings.fontScalePercent, userSettings.language]);

  const updateUserSettings = (nextSettings: UserSettings) => {
    if (!authUser) return;
    saveUserSettings(authUser.id, nextSettings, authUser.role);
    setUserSettings(nextSettings);
    setUserSettingsError('');
  };

  const navigateToPage = (nextPage: Page) => {
    setInitialExamSessionId(null);
    setInitialExamClassId(null);
    setInitialResourceId(null);
    setInitialAssignmentId(null);
    setInitialChatConversationId(null);
    if (nextPage === 'lesson-builder') setLessonBuilderInitialMode(page === 'exams' ? 'exam' : 'lesson');
    if (nextPage === 'lessons') setLessonsWorkspaceVisited(true);
    setResourceSubjectSeed(null);
    setInitialSubjectView(null);
    setInitialSubjectTopic(null);
    if (nextPage !== 'ai-chat') {
      setStudentChatSeed(null);
      setTeacherChatPrompt('');
    }
    if (nextPage === 'ai-practice') setPracticeSeed(null);
    else setPracticeTopicSeed(null);
    setPage(nextPage);
    if (role === 'lecturer') {
      const route = Object.entries(teacherPageByPath).find(([, pageId]) => pageId === nextPage)?.[0];
      if (route && route !== window.location.pathname) window.history.pushState({ page: nextPage }, '', route);
    }
  };

  const logout = async () => {
    try {
      await endSession();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Không thể thu hồi phiên đăng nhập.');
    }
    setAuthUser(null);
    setRole(null);
    setOnboardingOpen(false);
    setAuthScreen('landing');
    window.history.replaceState(null, '', '/');
  };

  const openLogin = () => {
    window.history.pushState(null, '', '/login');
    setAuthScreen('login');
  };

  const openLanding = () => {
    window.history.pushState(null, '', '/');
    setAuthScreen('landing');
  };

  const dismissOnboarding = () => {
    if (!authUser || (authUser.role !== 'student' && authUser.role !== 'lecturer')) return null;
    const error = saveOnboardingCompletion(authUser.id, authUser.role);
    if (error) return `Không thể lưu trạng thái hướng dẫn: ${error}`;
    setOnboardingOpen(false);
    setOnboardingStorageError('');
    return null;
  };


  const openSubjectResources = (subjectCode: string) => {
    navigateToPage('my-classes');
    setResourceSubjectSeed(subjectCode);
    setInitialSubjectView('lessons');
  };

  const openSubjectAssignments = (subjectCode: string, topic?: string) => {
    navigateToPage('my-classes');
    setResourceSubjectSeed(subjectCode);
    setInitialSubjectView('assignments');
    setInitialSubjectTopic(topic ?? null);
  };

  const openScheduledContent = (subject: string, topic: string, type: 'lesson' | 'exam' | 'homework') => {
    const subjectCodes: Record<string, string> = {
      'Toán học': 'TOAN10',
      'Ngữ văn': 'VAN10',
      'Hóa học': 'HOA10',
      'Vật lý': 'LY10',
      'Tiếng Anh': 'ANH10',
      'Tin học': 'TIN10',
      'Sinh học': 'SINH10',
      'Lịch sử': 'SU10',
      'Địa lý': 'DIA10',
      'Giáo dục thể chất': 'GDTC10',
    };
    navigateToPage('my-classes');
    setResourceSubjectSeed(subjectCodes[subject] ?? null);
    setInitialSubjectView(type === 'homework' ? 'assignments' : 'lessons');
    setInitialSubjectTopic(topic);
  };

  const openPublishedExamResult = (result: StudentExamResult) => {
    navigateToPage('my-classes');
    setResourceSubjectSeed(result.subject);
    setInitialSubjectView('exam');
    setInitialSubjectTopic(null);
    setInitialExamSessionId(result.sessionId);
  };

  const askStudentAI = (prompt: string, subject = '') => {
    setStudentChatSeed({ subject, prompt });
    navigateToPage('ai-chat');
  };

  const askTeacherAI = (prompt: string) => {
    setTeacherChatPrompt(prompt);
    navigateToPage('ai-chat');
  };

  const markNotificationRead = async (id: string) => {
    try {
      if (authUser?.isDemo) demoNotificationReadIds.current.ids.add(id);
      else await markNotificationsRead([id]);
      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
      setNotificationsError('');
      return true;
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : 'Không thể lưu trạng thái thông báo.');
      return false;
    }
  };

  const markAllNotificationsRead = async () => {
    const unreadIds = notifications.filter((item) => !item.read).map((item) => item.id);
    try {
      if (authUser?.isDemo) unreadIds.forEach((id) => demoNotificationReadIds.current.ids.add(id));
      else await markNotificationsRead(unreadIds);
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      setNotificationsError('');
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : 'Không thể lưu trạng thái thông báo.');
    }
  };

  const openNotification = async (notification: UserNotification) => {
    if (!notification.read && !(await markNotificationRead(notification.id))) return;
    setNotificationsOpen(false);
    navigateToPage(notification.destination);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [page, role]);

  useEffect(() => {
    let cancelled = false;
    if (window.location.pathname === '/upload-mobile') {
      setAuthLoading(false);
      return () => { cancelled = true; };
    }
    restoreSession()
      .then((user) => {
        if (!cancelled && user) {
          setAuthUser(user);
          setRole(user.role);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : 'Không thể khôi phục phiên đăng nhập.');
        }
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const notificationUserId = authUser?.id;
  const notificationRole = authUser?.role;
  const notificationIsDemo = authUser?.isDemo ?? false;
  useEffect(() => {
    if (!notificationUserId || !notificationRole) {
      demoNotificationReadIds.current = { userId: '', ids: new Set() };
      setNotifications([]);
      setNotificationsError('');
      setNotificationsLoading(false);
      return;
    }

    let active = true;
    if (demoNotificationReadIds.current.userId !== notificationUserId) {
      demoNotificationReadIds.current = { userId: notificationUserId, ids: new Set() };
    }
    const refresh = async () => {
      setNotificationsLoading(true);
      try {
        const feed = notificationIsDemo
          ? { items: [] as UserNotification[], error: '' }
          : await loadNotificationFeed(notificationRole, userSettings.language);
        const feedIds = feed.items.map((item) => item.id);
        const readIds = notificationIsDemo
          ? feedIds.filter((id) => demoNotificationReadIds.current.ids.has(id))
          : await readNotificationState(feedIds);
        if (!active) return;
        const readIdSet = new Set(readIds);
        setNotifications(feed.items.map((item) => ({ ...item, read: readIdSet.has(item.id) })));
        setNotificationsError(feed.error);
      } catch (error) {
        if (!active) return;
        setNotificationsError(error instanceof Error ? error.message : 'Không thể tải thông báo.');
      } finally {
        if (active) setNotificationsLoading(false);
      }
    };

    void refresh();
    const refreshTimer = window.setInterval(() => { void refresh(); }, 5 * 60_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [notificationIsDemo, notificationRole, notificationUserId, notificationsOpen, userSettings.language]);

  useEffect(() => {
    const syncTeacherRoute = () => {
      const nextPage = teacherPageByPath[window.location.pathname];
      if (role === 'lecturer' && nextPage) setPage(nextPage);
    };
    window.addEventListener('popstate', syncTeacherRoute);
    return () => window.removeEventListener('popstate', syncTeacherRoute);
  }, [role]);

  if (window.location.pathname === '/upload-mobile') {
    return <MobileExamUploadPage />;
  }

  if (authLoading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7faff] px-5 py-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-40 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="absolute -bottom-48 -right-32 h-[28rem] w-[28rem] rounded-full bg-sky-200/30 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#f7faff_75%)]" />
        </div>
        <section
          role="status"
          aria-live="polite"
          className="relative w-full max-w-md rounded-3xl border border-white/80 bg-white/90 px-7 py-9 text-center shadow-[0_24px_80px_-36px_rgba(37,99,235,0.3)] backdrop-blur sm:px-10 sm:py-11"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 shadow-sm">
            <img src="/eduflow-mark.png" alt="" className="h-11 w-11 rounded-xl object-cover" />
          </div>
          <p className="mt-4 text-sm font-bold tracking-wide text-slate-800">EduFlow</p>
          <h1 className="mt-5 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
            Đang khôi phục phiên đăng nhập
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Đang chuẩn bị không gian học tập.
          </p>
          <div className="mx-auto mt-7 flex h-8 w-8 items-center justify-center" aria-hidden="true">
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600" />
          </div>
          <p className="mt-3 text-xs font-medium text-slate-400">Vui lòng đợi trong giây lát</p>
        </section>
      </main>
    );
  }

  const invitationToken = new URLSearchParams(window.location.hash.slice(1)).get('invite');
  if (invitationToken) {
    return (
      <InvitationAcceptance
        token={invitationToken}
        onAccepted={(user) => {
          setAuthUser(user);
          setRole(user.role);
          setPage('dashboard');
          window.history.replaceState(null, '', window.location.pathname);
        }}
      />
    );
  }

  if (!role || !authUser) {
    if (authScreen === 'landing') return <Landing onLogin={openLogin} />;
    const completeLogin = (user: AuthUser) => {
      setAuthUser(user);
      setRole(user.role);
      setAuthError('');
      const requestedPage = user.role === 'lecturer' ? teacherPageByPath[window.location.pathname] : undefined;
      setPage(requestedPage ?? 'dashboard');
      if (user.role === 'lecturer' && !requestedPage) window.history.replaceState(null, '', '/teacher/dashboard');
      if (user.role !== 'lecturer') window.history.replaceState(null, '', '/');
    };
    return (
      <Login
        error={authError}
        busy={authBusy}
        onBackToLanding={openLanding}
        onLogin={async (email, password) => {
          setAuthBusy(true);
          setAuthError('');
          try {
            completeLogin(await authenticate(email, password));
          } catch (error) {
            setAuthError(error instanceof Error ? error.message : 'Không thể đăng nhập.');
          } finally {
            setAuthBusy(false);
          }
        }}
      />
    );
  }

  if (authUser.mustChangePassword || !authUser.profileComplete) {
    return (
      <FirstLoginSetup
        user={authUser}
        onComplete={(user) => {
          setAuthUser(user);
          setRole(user.role);
        }}
      />
    );
  }

  const activePage = allowedPages[role].includes(page) ? page : 'dashboard';
  return (
    <div
      className={`flex min-h-screen bg-slate-50 ${!userSettings.animationsEnabled ? 'reduce-motion' : ''} ${role === 'student' ? 'student-interface' : role === 'lecturer' && activePage === 'dashboard' ? 'teacher-dashboard-interface' : role === 'lecturer' && activePage === 'lessons' ? 'teacher-library-interface md:h-dvh md:overflow-hidden' : ''}`}
      style={backgroundStyle(userSettings)}
    >
      <ToastViewport />
      <Sidebar
        current={activePage}
        onNavigate={navigateToPage}
        role={role}
        userId={authUser.id}
        language={userSettings.language}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />
      <div className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-200 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-[clamp(80px,14vw,224px)]'}`}>
        <TopBar
          role={role}
          userId={authUser.id}
          userName={authUser.fullName}
          avatarUrl={userSettings.avatar}
          language={userSettings.language}
          unreadNotificationCount={notifications.filter((item) => !item.read).length}
          onNotifications={() => setNotificationsOpen(true)}
          onNavigate={navigateToPage}
          onLogout={logout}
          onOpenResources={role === 'student' ? openSubjectResources : undefined}
          onOpenAssignments={role === 'student' ? openSubjectAssignments : undefined}
          onAskAI={role === 'student' ? askStudentAI : undefined}
          onShowGuide={() => {
            setOnboardingStorageError('');
            setOnboardingOpen(true);
          }}
        />
        <div className={`app-page-content mx-auto w-full min-w-0 max-w-[1480px] flex-1 p-3 pb-24 sm:p-5 sm:pb-24 md:p-6 md:pb-8 ${role === 'lecturer' && activePage === 'dashboard' ? 'lg:max-w-none lg:p-5 lg:pb-0' : role === 'student' && activePage === 'dashboard' ? 'lg:max-w-none lg:p-5 lg:pb-8' : role === 'lecturer' && activePage === 'lessons' ? 'flex min-h-0 flex-col p-3 pb-24 sm:p-3 sm:pb-24 md:overflow-hidden md:p-3 md:pb-3 lg:max-w-none lg:p-4 lg:pb-3' : 'lg:p-8 lg:pb-8'}`}>
          {role === 'student' && activePage === 'dashboard' ? (
            <StudentDashboard
              userName={authUser.fullName}
              onNavigate={navigateToPage}
              onOpenResources={openSubjectResources}
              onOpenAssignments={openSubjectAssignments}
              onAskAI={askStudentAI}
            />
          ) : (
            <>
              {activePage === 'dashboard' && (role === 'lecturer'
                ? <TeacherDashboard userName={authUser.fullName} userGender={authUser.gender} onNavigate={navigateToPage} onAskAI={askTeacherAI} />
                : role === 'admin'
                  ? <AdminDashboard page="dashboard" schoolId={adminSchoolId} onSchoolIdChange={setAdminSchoolId} onNavigate={navigateToPage} />
                  : <Dashboard onNavigate={navigateToPage} role={role} />)}
              {activePage === 'classes' && <ClassManagement />}
              {activePage === 'ai-learning' && <AILearning onNavigate={navigateToPage} />}
              {activePage === 'ai-chat' && <AIChat role={role} userName={authUser.fullName} userId={authUser.id} studentId={role === 'student' ? authUser.id : undefined} gender={authUser.gender} isDemo={authUser.isDemo} onExit={role === 'student' ? () => navigateToPage('ai-learning') : undefined} initialSubject={role === 'student' ? studentChatSeed?.subject : undefined} initialPrompt={role === 'student' ? studentChatSeed?.prompt : teacherChatPrompt || undefined} initialConversationId={initialChatConversationId ?? undefined} />}
              {role === 'lecturer' && lessonsWorkspaceVisited && (
                <div className={activePage === 'lessons' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
                  <LessonRepository initialDraft={lessonRepositoryDraft} />
                </div>
              )}
              {role === 'lecturer' && (
                <div className={activePage === 'lesson-builder' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
                  <AILessonBuilder
                    initialMode={lessonBuilderInitialMode}
                    onAssignLesson={(draft) => {
                      setLessonRepositoryDraft({
                        ...draft,
                        id: `lesson-draft-${Date.now()}`,
                      });
                      navigateToPage('lessons');
                    }}
                  />
                </div>
              )}
              {role === 'lecturer' && (activePage === 'question-bank' || activePage === 'saved-assignments' || activePage === 'exams') && (
                <ExamQuestionWorkspace
                  currentPage={activePage}
                  onNavigate={navigateToPage}
                  onCreateExamRoom={(exam) => {
                    setRoomExamSeed(exam);
                    navigateToPage('exam-monitor');
                  }}
                  onAssignAssignment={(draft) => {
                    setLessonRepositoryDraft({
                      ...draft,
                      id: `assignment-draft-${Date.now()}`,
                      contentType: 'assignment',
                    });
                    navigateToPage('lessons');
                  }}
                />
              )}
              {role === 'lecturer' && (activePage === 'ai-grading' || activePage === 'analytics') && <GradingAnalyticsWorkspace currentPage={activePage} />}
              {role === 'lecturer' && activePage === 'exam-monitor' && (
                <ProctoringWorkspace
                  onNavigate={navigateToPage}
                  initialExam={roomExamSeed}
                  onInitialExamConsumed={() => setRoomExamSeed(null)}
                />
              )}
              {activePage === 'analytics' && role === 'admin' && <AdminDashboard page="analytics" schoolId={adminSchoolId} onSchoolIdChange={setAdminSchoolId} onNavigate={navigateToPage} />}
              {activePage === 'analytics' && role === 'student' && <Analytics role={role} />}
              {activePage === 'lectures' && <Lectures />}
              {role === 'admin' && activePage === 'admin-years' && <AdminDashboard page="admin-years" schoolId={adminSchoolId} onSchoolIdChange={setAdminSchoolId} onNavigate={navigateToPage} />}
              {role === 'admin' && activePage === 'admin-classes' && <AdminDashboard page="admin-classes" schoolId={adminSchoolId} onSchoolIdChange={setAdminSchoolId} onNavigate={navigateToPage} />}
              {role === 'admin' && activePage === 'admin-subjects' && <AdminDashboard page="admin-subjects" schoolId={adminSchoolId} onSchoolIdChange={setAdminSchoolId} onNavigate={navigateToPage} />}
              {role === 'admin' && activePage === 'admin-assignments' && <AdminDashboard page="admin-assignments" schoolId={adminSchoolId} onSchoolIdChange={setAdminSchoolId} onNavigate={navigateToPage} />}
              {role === 'admin' && activePage === 'admin-storage' && <AdminDashboard page="admin-storage" schoolId={adminSchoolId} onSchoolIdChange={setAdminSchoolId} onNavigate={navigateToPage} />}
              {activePage === 'my-classes' && (
                <MyClasses
                  studentUserId={authUser.id}
                  isDemo={authUser.isDemo}
                  initialSubjectCode={resourceSubjectSeed}
                  initialSubjectView={initialSubjectView}
                  initialSubjectTopic={initialSubjectTopic}
                  initialExamSessionId={initialExamSessionId}
                  initialExamClassId={initialExamClassId}
                  initialResourceId={initialResourceId}
                  initialAssignmentId={initialAssignmentId}
                  onExitGroup={() => {
                    setResourceSubjectSeed(null);
                    setInitialSubjectView(null);
                    setInitialSubjectTopic(null);
                    setInitialExamSessionId(null);
                    setInitialExamClassId(null);
                    setInitialResourceId(null);
                    setInitialAssignmentId(null);
                  }}
                  onOpenSchedule={() => navigateToPage('schedule')}
                  onAskAI={askStudentAI}
                />
              )}
              {activePage === 'assignments' && <Assignments />}
              {activePage === 'my-results' && (
                <MyResults
                  studentUserId={authUser.id}
                  studentName={authUser.fullName}
                  onOpenResources={(subject, topic) => openScheduledContent(subject, topic, 'lesson')}
                  onCreatePractice={(subject, topic) => {
                    navigateToPage('ai-practice');
                    setPracticeTopicSeed({ subject, topic });
                  }}
                />
              )}
              {activePage === 'schedule' && (
                role === 'lecturer'
                  ? <TeacherSchedule gender={authUser.gender} />
                  : <div className="student-schedule-scale"><StudentSchedule studentId={authUser.id} /></div>
              )}
              {activePage === 'ai-practice' && (
                <AIPractice
                  onExit={() => navigateToPage('ai-learning')}
                  initialSubject={practiceTopicSeed?.subject ?? practiceSeed?.subject}
                  initialTopic={practiceTopicSeed?.topic ?? practiceSeed?.topic}
                  initialQuestions={practiceSeed?.questions}
                  initialMode={practiceSeed?.mode}
                  initialSavedId={practiceSeed?.id}
                  isDemo={authUser.isDemo}
                />
              )}
              {activePage === 'leaderboard' && <Leaderboard />}
              {activePage === 'saved' && (
                <SavedResources
                  role={role}
                  onOpen={(item) => {
                    if (item.type === 'quiz') {
                      navigateToPage('ai-practice');
                      setPracticeSeed(item);
                    } else if (item.type === 'resource') {
                      navigateToPage('my-classes');
                      setInitialResourceId(item.id);
                    } else if (role === 'student' && item.type === 'assignment' && 'assignmentId' in item) {
                      navigateToPage('my-classes');
                      setInitialAssignmentId(item.assignmentId);
                    } else if (role === 'student' && item.type === 'exam' && 'sessionId' in item) {
                      navigateToPage('my-classes');
                      setInitialExamSessionId(item.sessionId);
                      setInitialExamClassId(item.classId);
                    } else if (item.type === 'answer' && item.conversationId) {
                      navigateToPage('ai-chat');
                      setInitialChatConversationId(item.conversationId);
                    } else if (item.type === 'exam' || item.type === 'assignment') {
                      navigateToPage(item.type === 'exam' ? 'exams' : 'saved-assignments');
                    }
                  }}
                />
              )}
              {activePage === 'feedback' && <ContactPage role={role} language={userSettings.language} />}
              {activePage === 'profile' && (
                <StudentProfile
                  user={authUser}
                  avatarUrl={userSettings.avatar}
                  language={userSettings.language}
                  onUserUpdate={setAuthUser}
                  onAvatarChange={(avatarUrl) => updateUserSettings({ ...userSettings, avatar: avatarUrl })}
                  onLogout={logout}
                  onNavigate={navigateToPage}
                  onOpenExamResult={openPublishedExamResult}
                />
              )}
              {activePage === 'online-exams' && (
                <OnlineExamRooms
                  onViewResult={openPublishedExamResult}
                  isDemo={authUser.isDemo}
                />
              )}
              {activePage === 'users' && role === 'admin' && <AdminDashboard page="users" schoolId={adminSchoolId} onSchoolIdChange={setAdminSchoolId} onNavigate={navigateToPage} />}
              {activePage === 'users' && role !== 'admin' && <Users currentUser={authUser} />}
              {activePage === 'settings' && (
                <Settings
                  user={authUser}
                  settings={userSettings}
                  settingsError={userSettingsError}
                  onSettingsChange={updateUserSettings}
                  onUserUpdate={setAuthUser}
                  onLogout={logout}
                />
              )}
            </>
          )}
        </div>
      </div>
      <MobileNav
        current={activePage}
        onNavigate={navigateToPage}
        role={role}
        userId={authUser.id}
        language={userSettings.language}
      />
      {onboardingOpen && authUser && (role === 'student' || role === 'lecturer') && (
        <OnboardingGuide
          key={`${authUser.id}:${role}`}
          role={role}
          initialStorageError={onboardingStorageError}
          onDismiss={dismissOnboarding}
          onCloseWithoutSaving={() => setOnboardingOpen(false)}
        />
      )}
      {notificationsOpen && (
        <NotificationDrawer
          notifications={notifications}
          loading={notificationsLoading}
          error={notificationsError}
          onClose={() => setNotificationsOpen(false)}
          onMarkRead={(id) => { void markNotificationRead(id); }}
          onMarkAllRead={() => { void markAllNotificationsRead(); }}
          onOpenNotification={(notification) => { void openNotification(notification); }}
          language={userSettings.language}
        />
      )}
    </div>
  );
}

export default App;
