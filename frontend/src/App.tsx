import { useEffect, useState } from 'react';
import { Sidebar, MobileNav, NotificationDrawer, TopBar } from '@/components/Sidebar';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { ClassManagement } from '@/pages/teacher/ClassManagement';
import { AIChat } from '@/pages/AIChat';
import { Analytics } from '@/pages/Analytics';
import { Lectures } from '@/pages/Lectures';
import { TeacherDashboard } from '@/pages/teacher/TeacherDashboard';
import { LessonRepository } from '@/pages/teacher/LessonRepository';
import { AILessonBuilder } from '@/pages/teacher/AILessonBuilder';
import { ExamQuestionWorkspace, GradingAnalyticsWorkspace, ProctoringWorkspace } from '@/pages/teacher/TeacherWorkspaces';
import { MyClasses } from '@/pages/student/MyClasses';
import { Assignments } from '@/pages/student/Assignments';
import { MyResults } from '@/pages/student/MyResults';
import { StudentSchedule } from '@/pages/student/StudentSchedule';
import { AIPractice } from '@/pages/student/AIPractice';
import { AILearning } from '@/pages/student/AILearning';
import { Leaderboard } from '@/pages/student/Leaderboard';
import { SavedResources } from '@/pages/student/SavedResources';
import { StudentFeedback } from '@/pages/student/StudentFeedback';
import { StudentDashboard } from '@/pages/student/StudentDashboard';
import { StudentProfile } from '@/pages/student/StudentProfile';
import { PracticeHistory } from '@/pages/student/PracticeHistory';
import { OnlineExamRooms } from '@/pages/student/OnlineExamRooms';
import type { SavedQuiz } from '@/pages/student/savedItems';
import { Users } from '@/pages/staff/Users';
import { Settings } from '@/pages/Settings';
import type { Page, Role } from '@/types';

const allowedPages: Record<Role, Page[]> = {
  lecturer: ['dashboard', 'classes', 'lessons', 'lesson-builder', 'question-bank', 'exams', 'exam-monitor', 'appeals', 'ai-grading', 'analytics', 'settings'],
  student: ['dashboard', 'schedule', 'my-classes', 'assignments', 'ai-learning', 'ai-chat', 'ai-practice', 'my-results', 'leaderboard', 'saved', 'feedback', 'profile', 'practice-history', 'online-exams', 'settings'],
  admin: ['dashboard', 'users', 'lectures', 'analytics', 'settings'],
};

const teacherPageByPath: Record<string, Page> = {
  '/teacher/dashboard': 'dashboard',
  '/teacher/classes': 'classes',
  '/teacher/lessons': 'lessons',
  '/teacher/ai-lesson-builder': 'lesson-builder',
  '/teacher/question-bank': 'question-bank',
  '/teacher/exams': 'exams',
  '/teacher/exam-monitor': 'exam-monitor',
  '/teacher/appeals': 'appeals',
  '/teacher/ai-grading': 'ai-grading',
  '/teacher/analytics': 'analytics',
};

function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [page, setPage] = useState<Page>(() => teacherPageByPath[window.location.pathname] ?? 'dashboard');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [studentChatSeed, setStudentChatSeed] = useState<{ subject: string; prompt: string } | null>(null);
  const [practiceSeed, setPracticeSeed] = useState<SavedQuiz | null>(null);
  const [resourceSubjectSeed, setResourceSubjectSeed] = useState<string | null>(null);
  const [initialSubjectView, setInitialSubjectView] = useState<'lessons' | 'assignments' | null>(null);
  const [initialSubjectTopic, setInitialSubjectTopic] = useState<string | null>(null);

  const navigateToPage = (nextPage: Page) => {
    setResourceSubjectSeed(null);
    setInitialSubjectView(null);
    setInitialSubjectTopic(null);
    if (nextPage !== 'ai-chat') setStudentChatSeed(null);
    if (nextPage === 'ai-practice') setPracticeSeed(null);
    setPage(nextPage);
    if (role === 'lecturer') {
      const route = Object.entries(teacherPageByPath).find(([, pageId]) => pageId === nextPage)?.[0];
      if (route && route !== window.location.pathname) window.history.pushState({ page: nextPage }, '', route);
    }
  };

  const logout = () => {
    setRole(null);
    window.history.replaceState(null, '', '/');
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

  const openScheduledApp = (subject: string, topic: string) => {
    setStudentChatSeed({ subject, prompt: `Hãy giúp mình học chủ đề "${topic}" của môn ${subject}.` });
    navigateToPage('ai-chat');
  };

  const askStudentAI = (prompt: string) => {
    setStudentChatSeed({ subject: '', prompt });
    navigateToPage('ai-chat');
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [page, role]);

  useEffect(() => {
    const syncTeacherRoute = () => {
      const nextPage = teacherPageByPath[window.location.pathname];
      if (role === 'lecturer' && nextPage) setPage(nextPage);
    };
    window.addEventListener('popstate', syncTeacherRoute);
    return () => window.removeEventListener('popstate', syncTeacherRoute);
  }, [role]);

  if (!role) {
    return <Login onLogin={(r) => {
      setRole(r);
      const requestedPage = r === 'lecturer' ? teacherPageByPath[window.location.pathname] : undefined;
      setPage(requestedPage ?? 'dashboard');
      if (r === 'lecturer' && !requestedPage) window.history.replaceState(null, '', '/teacher/dashboard');
      if (r !== 'lecturer') window.history.replaceState(null, '', '/');
    }} />;
  }

  const activePage = allowedPages[role].includes(page) ? page : 'dashboard';
  return (
    <div className={`flex min-h-screen bg-slate-50 ${role === 'student' ? 'student-interface' : role === 'lecturer' && activePage === 'dashboard' ? 'teacher-dashboard-interface' : role === 'lecturer' && activePage === 'lessons' ? 'teacher-library-interface h-screen overflow-hidden' : ''}`}>
      <Sidebar
        current={activePage}
        onNavigate={navigateToPage}
        role={role}
        onLogout={logout}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />
      <div className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-200 ${sidebarCollapsed ? 'lg:ml-16' : role === 'student' ? 'lg:ml-48' : 'lg:ml-56'}`}>
        <div className={`mx-auto w-full max-w-[1480px] flex-1 p-3 pb-24 sm:p-5 sm:pb-24 md:p-6 md:pb-24 ${role === 'lecturer' && activePage === 'dashboard' ? 'lg:p-5 lg:pb-0' : role === 'lecturer' && activePage === 'lessons' ? 'flex min-h-0 flex-col overflow-hidden p-3 pb-3 sm:p-3 md:p-3 lg:max-w-none lg:p-4 lg:pb-3' : (role === 'student' && activePage === 'dashboard' ? 'lg:p-5 lg:pb-8' : 'lg:p-8 lg:pb-8')}`}>
          {role === 'student' && activePage === 'dashboard' ? (
            <StudentDashboard
              onNavigate={navigateToPage}
              onOpenResources={openSubjectResources}
              onOpenAssignments={openSubjectAssignments}
              onAskAI={askStudentAI}
              header={<TopBar role={role} onNotifications={() => setNotificationsOpen(true)} onNavigate={navigateToPage} onLogout={logout} onOpenResources={openSubjectResources} onOpenAssignments={openSubjectAssignments} onAskAI={askStudentAI} />}
            />
          ) : (
            <>
              <TopBar role={role} onNotifications={() => setNotificationsOpen(true)} onNavigate={navigateToPage} onLogout={logout} onOpenResources={role === 'student' ? openSubjectResources : undefined} onOpenAssignments={role === 'student' ? openSubjectAssignments : undefined} onAskAI={role === 'student' ? askStudentAI : undefined} />
              {activePage === 'dashboard' && (role === 'lecturer' ? <TeacherDashboard onNavigate={navigateToPage} /> : <Dashboard onNavigate={navigateToPage} role={role} />)}
              {activePage === 'classes' && <ClassManagement />}
              {activePage === 'ai-learning' && <AILearning onNavigate={navigateToPage} />}
              {activePage === 'ai-chat' && <AIChat role={role} onExit={role === 'student' ? () => navigateToPage('ai-learning') : undefined} initialSubject={role === 'student' ? studentChatSeed?.subject : undefined} initialPrompt={role === 'student' ? studentChatSeed?.prompt : undefined} />}
              {activePage === 'lessons' && <LessonRepository />}
              {activePage === 'lesson-builder' && <AILessonBuilder />}
              {role === 'lecturer' && (activePage === 'question-bank' || activePage === 'exams') && <ExamQuestionWorkspace currentPage={activePage} onNavigate={navigateToPage} />}
              {role === 'lecturer' && (activePage === 'ai-grading' || activePage === 'analytics') && <GradingAnalyticsWorkspace currentPage={activePage} onNavigate={navigateToPage} />}
              {role === 'lecturer' && (activePage === 'exam-monitor' || activePage === 'appeals') && <ProctoringWorkspace currentPage={activePage} onNavigate={navigateToPage} />}
              {activePage === 'analytics' && role !== 'lecturer' && <Analytics role={role} />}
              {activePage === 'lectures' && <Lectures role={role} />}
              {activePage === 'my-classes' && (
                <MyClasses
                  initialSubjectCode={resourceSubjectSeed}
                  initialSubjectView={initialSubjectView}
                  initialSubjectTopic={initialSubjectTopic}
                  onOpenSchedule={() => navigateToPage('schedule')}
                />
              )}
              {activePage === 'assignments' && <Assignments />}
              {activePage === 'my-results' && <MyResults />}
              {activePage === 'schedule' && (
                <StudentSchedule onOpenContent={openScheduledContent} onOpenApp={openScheduledApp} />
              )}
              {activePage === 'ai-practice' && (
                <AIPractice
                  onExit={() => navigateToPage('ai-learning')}
                  initialSubject={practiceSeed?.subject}
                  initialTopic={practiceSeed?.topic}
                  initialQuestions={practiceSeed?.questions}
                  initialMode={practiceSeed?.mode}
                />
              )}
              {activePage === 'leaderboard' && <Leaderboard />}
              {activePage === 'saved' && (
                <SavedResources
                  onRepeatQuiz={(quiz) => {
                    setPracticeSeed(quiz);
                    setPage('ai-practice');
                  }}
                />
              )}
              {activePage === 'feedback' && <StudentFeedback />}
              {activePage === 'profile' && <StudentProfile onLogout={logout} />}
              {activePage === 'practice-history' && <PracticeHistory onBackToSaved={() => navigateToPage('saved')} />}
              {activePage === 'online-exams' && <OnlineExamRooms onOpenHistory={() => navigateToPage('practice-history')} />}
              {activePage === 'users' && <Users />}
              {activePage === 'settings' && <Settings role={role} />}
            </>
          )}
        </div>
      </div>
      <MobileNav
        current={activePage}
        onNavigate={navigateToPage}
        role={role}
      />
      {notificationsOpen && <NotificationDrawer onClose={() => setNotificationsOpen(false)} />}
    </div>
  );
}

export default App;
