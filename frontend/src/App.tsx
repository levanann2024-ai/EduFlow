import { useEffect, useState } from 'react';
import { Sidebar, MobileNav, NotificationDrawer, TopBar } from '@/components/Sidebar';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { ClassManagement } from '@/pages/ClassManagement';
import { AIQuizGenerator } from '@/pages/AIQuizGenerator';
import { AIChat } from '@/pages/AIChat';
import { LessonPlan } from '@/pages/LessonPlan';
import { LessonSlides } from '@/pages/LessonSlides';
import { Analytics } from '@/pages/Analytics';
import { Lectures } from '@/pages/Lectures';
import { Grading } from '@/pages/Grading';
import { MyClasses } from '@/pages/MyClasses';
import { MyLessons } from '@/pages/MyLessons';
import { Assignments } from '@/pages/Assignments';
import { MyResults } from '@/pages/MyResults';
import { Users } from '@/pages/Users';
import { Settings } from '@/pages/Settings';
import type { Page, Role } from '@/types';

const pageMeta: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'Tổng quan', subtitle: 'Không gian làm việc AI' },
  classes: { title: 'Quản lý lớp học', subtitle: 'Danh sách và tiến độ các lớp học' },
  'ai-quiz': { title: 'AI tạo câu hỏi trắc nghiệm', subtitle: 'Tạo bộ đề trắc nghiệm tự động' },
  'ai-chat': { title: 'Trợ lý AI', subtitle: 'Hỏi đáp và hỗ trợ học tập' },
  'lesson-plan': { title: 'Tạo giáo án bằng AI', subtitle: 'Lên kế hoạch bài giảng tự động' },
  'lesson-slides': { title: 'Tạo slide bài giảng', subtitle: 'Thiết kế slide bài giảng tự động bằng AI' },
  analytics: { title: 'Phân tích học tập', subtitle: 'Tiến độ, cảnh báo và gợi ý từ AI' },
  lectures: { title: 'Bài giảng', subtitle: 'Quản lý tài liệu bài giảng' },
  assignments: { title: 'Bài tập', subtitle: 'Danh sách bài tập và kiểm tra' },
  grading: { title: 'Chấm điểm', subtitle: 'Chấm bài và nhận xét' },
  notifications: { title: 'Thông báo', subtitle: 'Thông báo từ hệ thống và lớp học' },
  settings: { title: 'Cài đặt', subtitle: 'Cài đặt tài khoản và hệ thống' },
  users: { title: 'Quản lý người dùng', subtitle: 'Tài khoản học sinh và giáo viên' },
  'my-classes': { title: 'Lớp học của tôi', subtitle: 'Các lớp đang tham gia' },
  'my-lessons': { title: 'Bài học', subtitle: 'Tài liệu và bài giảng' },
  'my-results': { title: 'Kết quả học tập', subtitle: 'Điểm số và tiến độ cá nhân' },
};

const allowedPages: Record<Role, Page[]> = {
  lecturer: ['dashboard', 'classes', 'lectures', 'lesson-plan', 'lesson-slides', 'ai-quiz', 'grading', 'analytics', 'ai-chat', 'settings'],
  student: ['dashboard', 'my-classes', 'my-lessons', 'assignments', 'ai-chat', 'my-results', 'settings'],
  admin: ['dashboard', 'users', 'lectures', 'analytics', 'settings'],
};

function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [page, setPage] = useState<Page>('dashboard');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [page, role]);

  if (!role) {
    return <Login onLogin={(r) => { setRole(r); setPage('dashboard'); }} />;
  }

  const activePage = allowedPages[role].includes(page) ? page : 'dashboard';
  const meta = pageMeta[activePage];

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar current={activePage} onNavigate={setPage} role={role} onLogout={() => setRole(null)} />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <div className="flex-1 p-5 sm:p-6 lg:p-8 max-w-[1480px] w-full mx-auto pb-24 lg:pb-8">
          <TopBar title={meta.title} subtitle={meta.subtitle} role={role} onNotifications={() => setNotificationsOpen(true)} />
          {activePage === 'dashboard' && <Dashboard onNavigate={setPage} role={role} />}
          {activePage === 'classes' && <ClassManagement />}
          {activePage === 'ai-quiz' && <AIQuizGenerator />}
          {activePage === 'ai-chat' && <AIChat />}
          {activePage === 'lesson-plan' && <LessonPlan />}
          {activePage === 'lesson-slides' && <LessonSlides />}
          {activePage === 'analytics' && <Analytics role={role} />}
          {activePage === 'lectures' && <Lectures role={role} />}
          {activePage === 'grading' && <Grading />}
          {activePage === 'my-classes' && <MyClasses />}
          {activePage === 'my-lessons' && <MyLessons />}
          {activePage === 'assignments' && <Assignments />}
          {activePage === 'my-results' && <MyResults />}
          {activePage === 'users' && <Users />}
          {activePage === 'settings' && <Settings role={role} />}
        </div>
      </div>
      <MobileNav current={activePage} onNavigate={setPage} role={role} />
      {notificationsOpen && <NotificationDrawer onClose={() => setNotificationsOpen(false)} />}
    </div>
  );
}

export default App;
