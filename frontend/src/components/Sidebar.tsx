import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bookmark,
  CalendarDays,
  Check,
  ClipboardCheck,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  FileText,
  Eye,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  MessageSquareText,
  DoorOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  PenLine,
  Settings,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users,
  ScanLine,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Page, Role } from '@/types';
import type { AppLanguage } from '@/settings/userSettings';
import type { NotificationKind, UserNotification } from '@/notifications/notificationApi';
import { recordRecentSearch } from '@/pages/student/profileActivity';

const notificationIcons: Record<NotificationKind, LucideIcon> = {
  assignment: ClipboardList,
  grade: GraduationCap,
  appeal: MessageSquareText,
  grading: ClipboardCheck,
  exam: CalendarDays,
};

const notificationColors: Record<NotificationKind, { icon: string; accent: string; label: string }> = {
  assignment: { icon: 'bg-blue-100 text-blue-700', accent: 'border-l-blue-500', label: 'Bài tập' },
  grade: { icon: 'bg-emerald-100 text-emerald-700', accent: 'border-l-emerald-500', label: 'Kết quả' },
  appeal: { icon: 'bg-amber-100 text-amber-700', accent: 'border-l-amber-500', label: 'Phúc khảo' },
  grading: { icon: 'bg-violet-100 text-violet-700', accent: 'border-l-violet-500', label: 'Chấm bài' },
  exam: { icon: 'bg-rose-100 text-rose-700', accent: 'border-l-rose-500', label: 'Lịch thi' },
};

function formatNotificationTime(value: string, language: AppLanguage) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '';
  const minutes = Math.round((timestamp - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat(language === 'en' ? 'en' : 'vi', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
}

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
  role: Role;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const roleInitials: Record<Role, string> = {
  admin: 'AD',
  lecturer: 'GV',
  student: 'SV',
};

const menuIcons: Record<Page, LucideIcon> = {
  dashboard: LayoutDashboard,
  'ai-learning': Sparkles,
  classes: GraduationCap,
  lectures: BookOpen,
  'lesson-plan': FileText,
  'lesson-slides': Sparkles,
  'lesson-builder': PenLine,
  'question-bank': Puzzle,
  'saved-assignments': ClipboardCheck,
  lessons: BookOpen,
  exams: ClipboardList,
  'exam-monitor': Eye,
  'ai-grading': ScanLine,
  'ai-quiz': ClipboardCheck,
  'ai-practice': Target,
  grading: ClipboardCheck,
  analytics: BarChart3,
  'ai-chat': MessageSquare,
  assignments: ClipboardCheck,
  schedule: CalendarDays,
  'my-classes': GraduationCap,
  'my-results': BarChart3,
  leaderboard: Trophy,
  saved: Bookmark,
  feedback: MessageSquareText,
  users: Users,
  notifications: Bell,
  settings: Settings,
  profile: UserRound,
  'practice-history': History,
  'online-exams': DoorOpen,
};

interface MenuItem {
  id: Page;
  label: string;
  highlight?: boolean;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const menus: Record<Role, MenuSection[]> = {
  lecturer: [
    { label: 'Tổng quan', items: [
      { id: 'dashboard', label: 'Trang chủ' },
    ] },
    { label: 'Giảng dạy', items: [
      { id: 'exams', label: 'Câu hỏi & đề thi' },
      { id: 'lessons', label: 'Tài liệu bài giảng' },
    ] },
    { label: 'Lớp học', items: [
      { id: 'classes', label: 'Lớp của tôi' },
      { id: 'schedule', label: 'Lịch dạy' },
      { id: 'analytics', label: 'Phân tích lớp' },
    ] },
    { label: 'Chấm & theo dõi', items: [
      { id: 'ai-grading', label: 'Chấm bài' },
      { id: 'exam-monitor', label: 'Giám sát phòng thi' },
    ] },
    { label: 'Trợ lý AI', items: [
      { id: 'lesson-builder', label: 'Soạn bài với AI', highlight: true },
      { id: 'ai-chat', label: 'Chatbot AI', highlight: true },
    ] },
    { label: 'Hỗ trợ', items: [
      { id: 'feedback', label: 'Liên hệ & góp ý' },
    ] },
  ],
  student: [
    { label: 'Tổng quan', items: [
      { id: 'dashboard', label: 'Trang chủ' },
    ] },
    { label: 'Học tập', items: [
      { id: 'schedule', label: 'Lịch học' },
      { id: 'my-classes', label: 'Môn học của tôi' },
      { id: 'online-exams', label: 'Phòng thi' },
    ] },
    { label: 'Kết quả', items: [
      { id: 'my-results', label: 'Kết quả học tập' },
    ] },
    { label: 'Trợ lý AI', items: [
      { id: 'ai-learning', label: 'AI học tập', highlight: true },
    ] },
    { label: 'Tiện ích', items: [
      { id: 'saved', label: 'Đã lưu' },
      { id: 'feedback', label: 'Liên hệ & góp ý' },
    ] },
  ],
  admin: [
    { label: 'Điều hướng', items: [
      { id: 'dashboard', label: 'Tổng quan' },
      { id: 'users', label: 'Quản lý người dùng' },
      { id: 'lectures', label: 'Quản lý lưu trữ hệ thống' },
      { id: 'analytics', label: 'Thống kê hệ thống' },
    ] },
  ],
};

const englishMenuLabels: Partial<Record<Page, string>> = {
  dashboard: 'Home',
  'ai-learning': 'AI Learning',
  classes: 'My Classes',
  lectures: 'Resource Management',
  'lesson-plan': 'Lesson Plan',
  'lesson-slides': 'Lesson Slides',
  'lesson-builder': 'AI Lesson Builder',
  'question-bank': 'Question Bank',
  'saved-assignments': 'Saved Assignments',
  lessons: 'Lesson Library',
  exams: 'Questions & Exams',
  'exam-monitor': 'Exam Monitoring',
  'ai-grading': 'Grading',
  'ai-practice': 'AI Practice',
  analytics: 'Class Analytics',
  'ai-chat': 'AI Chat',
  assignments: 'Assignments',
  schedule: 'Schedule',
  'my-classes': 'My Subjects',
  'my-results': 'Learning Results',
  leaderboard: 'Leaderboard',
  saved: 'Saved',
  feedback: 'Contact & Feedback',
  users: 'User Management',
  notifications: 'Notifications',
  settings: 'Settings',
  profile: 'Profile',
  'practice-history': 'Practice History',
  'online-exams': 'Exam Rooms',
};

const englishSectionLabels: Record<string, string> = {
  'Tổng quan': 'Overview',
  'Giảng dạy': 'Teaching',
  'Lớp học': 'Classes',
  'Chấm & theo dõi': 'Grading & Monitoring',
  'Trợ lý AI': 'AI Assistant',
  'Hỗ trợ': 'Support',
  'Học tập': 'Learning',
  'Kết quả': 'Results',
  'Tiện ích': 'Tools',
  'Điều hướng': 'Navigation',
};

function menuLabel(language: AppLanguage, page: Page, fallback: string) {
  return language === 'en' ? englishMenuLabels[page] ?? fallback : fallback;
}

function sectionLabel(language: AppLanguage, label: string) {
  return language === 'en' ? englishSectionLabels[label] ?? label : label;
}

function isMenuItemActive(role: Role, item: MenuItem, current: Page) {
  if (current === item.id) return true;
  if (role === 'student' && item.id === 'ai-learning') return current === 'ai-chat' || current === 'ai-practice';
  if (role !== 'lecturer') return false;
  if (item.id === 'exams') return current === 'question-bank' || current === 'saved-assignments';
  return false;
}

export function Sidebar({ current, onNavigate, role, onLogout, collapsed, onToggleCollapsed, language = 'vi' }: SidebarProps & { language?: AppLanguage }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [iconOnlyViewport, setIconOnlyViewport] = useState(
    () => window.matchMedia('(min-width: 768px) and (max-width: 899px)').matches,
  );
  const [tightSpacingViewport, setTightSpacingViewport] = useState(
    () => window.matchMedia('(min-width: 768px) and (max-width: 1439px)').matches,
  );
  useEffect(() => {
    const iconOnlyQuery = window.matchMedia('(min-width: 768px) and (max-width: 899px)');
    const tightSpacingQuery = window.matchMedia('(min-width: 768px) and (max-width: 1439px)');
    const updateViewport = () => {
      setIconOnlyViewport(iconOnlyQuery.matches);
      setTightSpacingViewport(tightSpacingQuery.matches);
    };
    updateViewport();
    iconOnlyQuery.addEventListener('change', updateViewport);
    tightSpacingQuery.addEventListener('change', updateViewport);
    return () => {
      iconOnlyQuery.removeEventListener('change', updateViewport);
      tightSpacingQuery.removeEventListener('change', updateViewport);
    };
  }, []);
  const iconOnly = collapsed || iconOnlyViewport;
  const sections = menus[role];
  return (
    <aside data-icon-only={iconOnly} className={`app-sidebar fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-slate-800 bg-slate-900 transition-[width] duration-200 md:flex ${collapsed ? 'w-16' : 'w-[clamp(80px,14vw,224px)]'}`}>
      {/* 1. Phần Logo cố định ở trên */}
      <div className={`flex shrink-0 items-center border-b border-slate-800 py-4 ${iconOnly ? 'justify-center px-2' : tightSpacingViewport ? 'justify-between gap-1.5 px-2' : 'justify-between px-4'}`}>
        <div className={`flex min-w-0 items-center ${tightSpacingViewport ? 'gap-1.5' : 'gap-2'}`}>
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BookOpen className="w-[18px] h-[18px] text-white" />
          </div>
          {!iconOnly && <span className="truncate font-semibold text-slate-100 text-base tracking-tight">EduFlow</span>}
        </div>
        {!iconOnly && (
          <button type="button" onClick={onToggleCollapsed} aria-label={language === 'en' ? 'Collapse navigation' : 'Thu gọn thanh điều hướng'} title={language === 'en' ? 'Collapse navigation' : 'Thu gọn thanh điều hướng'} className={`shrink-0 rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white ${tightSpacingViewport ? 'p-1.5' : 'p-2'}`}>
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>
      {collapsed && (
        <button type="button" onClick={onToggleCollapsed} aria-label={language === 'en' ? 'Expand navigation' : 'Mở rộng thanh điều hướng'} title={language === 'en' ? 'Expand navigation' : 'Mở rộng thanh điều hướng'} className="mx-auto mt-2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white">
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {/* 2. Danh sách menu ở giữa có đường gạch nhỏ (border-t) phía trên mỗi mục */}
      <nav aria-label="Điều hướng chính" className={`flex-1 space-y-1 overflow-y-auto py-3 ${iconOnly ? 'px-2' : tightSpacingViewport ? 'px-1.5' : 'px-3'}`}>
        {sections.map((section, sectionIndex) => {
          const sectionId = `sidebar-section-${sectionIndex}`;
          const sectionExpanded = iconOnly || (role !== 'lecturer' && role !== 'student')
            || expandedSections[section.label] === true;
          const sectionActive = section.items.some((item) => isMenuItemActive(role, item, current));
          return (
          <section key={section.label} className="mb-4">
            {!iconOnly && (role === 'lecturer' || role === 'student' ? (
              <button
                type="button"
                aria-expanded={sectionExpanded}
                aria-controls={sectionId}
                onClick={() => setExpandedSections((expanded) => ({
                  ...expanded,
                  [section.label]: !sectionExpanded,
                }))}
                className={`flex w-full items-center justify-between rounded-md py-2 text-left text-[11px] font-semibold uppercase tracking-wider transition hover:bg-slate-800/50 ${tightSpacingViewport ? 'gap-1 px-1.5' : 'gap-2 px-3'} ${
                  sectionActive ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                <span className="min-w-0 truncate">{sectionLabel(language, section.label)}</span>
                {expandedSections[section.label]
                  ? <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                  : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ) : (
              <h2 className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{section.label}</h2>
            ))}
            <div id={sectionId} hidden={!sectionExpanded} className="space-y-1">
              {section.items.map((item) => {
                const active = isMenuItemActive(role, item, current);
                const Icon = menuIcons[item.id];
                const highlight = item.highlight;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    title={menuLabel(language, item.id, item.label)}
                    aria-label={iconOnly ? menuLabel(language, item.id, item.label) : undefined}
                    className={`nav-item flex w-full items-center rounded-lg py-2 text-sm font-medium transition-colors ${
                      iconOnly ? 'justify-center px-2' : tightSpacingViewport ? 'gap-1.5 px-1.5 text-left' : 'gap-3 px-3 text-left'
                    } ${
                      highlight
                        ? active ? 'bg-violet-500/20 text-violet-200' : 'text-violet-300 hover:text-violet-100 hover:bg-violet-500/10'
                        : active ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${highlight ? 'text-violet-400' : ''}`} />
                    {!iconOnly && <span className="min-w-0 flex-1 truncate whitespace-nowrap leading-5">{menuLabel(language, item.id, item.label)}</span>}
                  </button>
                );
              })}
            </div>
          </section>
          );
        })}
      </nav>

      {/* 3. Phần Cài đặt & Đăng xuất ép dính chặt ở đáy sidebar */}
      <div className={`shrink-0 space-y-1 border-t border-slate-800 bg-slate-900 py-3 ${iconOnly ? 'px-2' : tightSpacingViewport ? 'px-1.5' : 'px-3'}`}>
        <button onClick={() => onNavigate('settings')} title={iconOnly ? 'Cài đặt' : undefined} aria-label={iconOnly ? 'Cài đặt' : undefined} className={`nav-item flex w-full items-center rounded-lg py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-slate-200 ${iconOnly ? 'justify-center px-2' : tightSpacingViewport ? 'gap-1.5 px-1.5' : 'gap-3 px-3'}`}>
          <Settings className="w-[18px] h-[18px]" />
          {!iconOnly && <span className="min-w-0 truncate">Cài đặt</span>}
        </button>
        {!iconOnly && <div className="my-1 mx-3 border-t border-slate-800/80" />}
        <button onClick={onLogout} title={iconOnly ? (language === 'en' ? 'Sign out' : 'Đăng xuất') : undefined} aria-label={iconOnly ? (language === 'en' ? 'Sign out' : 'Đăng xuất') : undefined} className={`nav-item flex w-full items-center rounded-lg py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400 ${iconOnly ? 'justify-center px-2' : tightSpacingViewport ? 'gap-1.5 px-1.5' : 'gap-3 px-3'}`}>
          <LogOut className="w-[18px] h-[18px]" />
          {!iconOnly && <span className="min-w-0 truncate">{language === 'en' ? 'Sign out' : 'Đăng xuất'}</span>}
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({ current, onNavigate, role, language = 'vi' }: Pick<SidebarProps, 'current' | 'onNavigate' | 'role'> & { language?: AppLanguage }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mobilePageIds: Record<Role, Page[]> = {
    admin: ['dashboard', 'users', 'lectures', 'analytics'],
    lecturer: ['dashboard', 'schedule', 'classes', 'lesson-builder', 'exams'],
    student: ['dashboard', 'schedule', 'my-classes', 'ai-learning'],
  };
  const allItems = menus[role].flatMap((section) => section.items);
  const items = mobilePageIds[role].map((id) => allItems.find((item) => item.id === id)).filter((item): item is MenuItem => item !== undefined);
  return (
    <>
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[55]" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/30" />
          <nav
            aria-label="Tất cả trang"
            className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] inset-x-3 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {menus[role].map((section) => (
              <section key={section.label} className="mb-3 last:mb-0">
                <h2 className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{sectionLabel(language, section.label)}</h2>
                {section.items.map((item) => {
                  const Icon = menuIcons[item.id];
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.id); setMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
                        isMenuItemActive(role, item, current) ? 'bg-blue-50 text-blue-700' : item.highlight ? 'text-violet-700' : 'text-slate-700'
                      }`}
                    >
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${item.highlight ? 'text-violet-500' : ''}`} />
                      <span>{menuLabel(language, item.id, item.label)}</span>
                    </button>
                  );
                })}
              </section>
            ))}
          </nav>
        </div>
      )}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 z-50 px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex justify-around">
        {items.map((item) => {
          const active = isMenuItemActive(role, item, current);
          const Icon = menuIcons[item.id];
          return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              active ? 'text-blue-400' : 'text-slate-500'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="truncate max-w-[72px]">{language === 'en'
              ? menuLabel(language, item.id, item.label).split(' ')[0]
              : item.id === 'ai-learning' ? 'AI học tập' : item.label.split(' ')[0]}</span>
          </button>
          );
        })}
        <button
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          className={`flex flex-col items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
            menuOpen ? 'text-blue-400' : 'text-slate-500'
          }`}
        >
          <MenuIcon className="w-5 h-5" />
          <span>{language === 'en' ? 'More' : 'Thêm'}</span>
        </button>
      </div>
    </>
  );
}

export function TopBar({
  role,
  userId,
  userName,
  avatarUrl,
  onNotifications,
  onNavigate,
  onLogout,
  onOpenResources,
  onOpenAssignments,
  onAskAI,
  unreadNotificationCount = 0,
  language = 'vi',
}: {
  role: Role;
  userId?: string;
  userName?: string;
  avatarUrl?: string;
  language?: AppLanguage;
  onNotifications: () => void;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onOpenResources?: (subjectCode: string) => void;
  onOpenAssignments?: (subjectCode: string) => void;
  onAskAI?: (prompt: string) => void;
  unreadNotificationCount?: number;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const isStudent = role === 'student';
  const isLecturer = role === 'lecturer';
  const isFullWidthBar = isStudent || isLecturer;
  const displayName = userName || (language === 'en' ? 'User' : 'Người dùng');
  const studentSearchItems: { label: string; detail: string; page?: Page; subjectCode?: string; action?: 'resources' | 'assignments' }[] = [
    ...[
      ['Toán học', 'TOAN10'],
      ['Ngữ văn', 'VAN10'],
      ['Hóa học', 'HOA10'],
      ['Vật lý', 'LY10'],
      ['Tiếng Anh', 'ANH10'],
      ['Tin học', 'TIN10'],
      ['Sinh học', 'SINH10'],
      ['Lịch sử', 'SU10'],
      ['Địa lý', 'DIA10'],
      ['Giáo dục thể chất', 'GDTC10'],
    ].map(([name, code]) => ({ label: name, detail: 'Tài liệu môn học', subjectCode: code, action: 'resources' as const })),
    { label: 'Bài tập', detail: 'Xem bài cần làm', page: 'assignments' as const },
    { label: 'Thời khóa biểu', detail: 'Lịch học và lịch thi', page: 'schedule' as const },
    { label: 'Phòng thi trực tuyến', detail: 'Vào phòng thi', page: 'online-exams' as const },
    { label: 'Kết quả học tập', detail: 'Điểm và tiến độ', page: 'my-results' as const },
    { label: 'AI Trợ giảng', detail: 'Hỏi bài với EduBot', page: 'ai-chat' as const },
    { label: 'AI Ôn luyện', detail: 'Tạo bài luyện', page: 'ai-practice' as const },
  ];
  const lecturerSearchItems: { label: string; detail: string; page: Page }[] = [
    { label: 'Lớp học', detail: 'Quản lý lớp và học sinh', page: 'classes' },
    { label: 'Kho bài giảng', detail: 'Tài liệu giảng dạy', page: 'lessons' },
    { label: 'Soạn bài với AI', detail: 'Tạo nội dung bài giảng', page: 'lesson-builder' },
    { label: 'Ngân hàng câu hỏi', detail: 'Quản lý câu hỏi và đề thi', page: 'question-bank' },
    { label: 'Đề thi', detail: 'Tạo và quản lý đề thi', page: 'exams' },
    { label: 'Giám sát phòng thi', detail: 'Phòng thi và sự cố', page: 'exam-monitor' },
    { label: 'Chấm bài', detail: 'Bài nộp cần chấm', page: 'ai-grading' },
    { label: 'Phân tích tiến độ', detail: 'Thống kê học tập', page: 'analytics' },
  ];
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('vi');
  const searchItems = isStudent ? studentSearchItems : lecturerSearchItems;
  const matchingSearchItems = normalizedSearch
    ? searchItems.filter((item) => `${item.label} ${item.detail}`.toLocaleLowerCase('vi').includes(normalizedSearch)).slice(0, 5)
    : [];
  const activateSearchItem = (item: (typeof searchItems)[number]) => {
    if (userId) recordRecentSearch(userId, searchQuery.trim() || item.label);
    if ('action' in item && item.action === 'resources' && item.subjectCode) onOpenResources?.(item.subjectCode);
    else if ('action' in item && item.action === 'assignments' && item.subjectCode) onOpenAssignments?.(item.subjectCode);
    else if (item.page) onNavigate(item.page);
    setSearchQuery('');
    setSearchOpen(false);
  };
  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstMatch = matchingSearchItems[0];
    if (firstMatch) {
      activateSearchItem(firstMatch);
      return;
    }
    if (normalizedSearch && onAskAI) {
      if (userId) recordRecentSearch(userId, searchQuery);
      onAskAI(searchQuery.trim());
      setSearchQuery('');
      setSearchOpen(false);
    }
  };
  return (
    <header className={`relative z-30 flex w-full flex-nowrap items-center gap-3 border-b border-slate-200 bg-white px-1 py-2 shadow-sm sm:px-2 ${isFullWidthBar ? 'mb-4 h-16 rounded-b-2xl px-4 sm:px-6' : '-mt-1 mb-3 h-14 bg-white/90 backdrop-blur'}`}>
      {(isStudent || isLecturer) && (
        <form onSubmit={handleSearchSubmit} role="search" className="relative order-1 min-w-0 w-full max-w-[440px] flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }}
            aria-label={language === 'en' ? 'Search lessons, resources, and questions' : 'Tìm kiếm bài học, tài liệu, câu hỏi'}
            aria-expanded={searchOpen && normalizedSearch.length > 0}
            placeholder={language === 'en'
              ? isLecturer ? 'Search classes, lessons, and exams...' : 'Search lessons, resources, and questions...'
              : isLecturer ? 'Tìm lớp học, bài giảng, đề thi...' : 'Tìm kiếm bài học, tài liệu, câu hỏi...'}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          {searchOpen && normalizedSearch && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              {matchingSearchItems.length > 0 ? matchingSearchItems.map((item) => (
                <button
                  key={`${item.label}-${item.detail}`}
                  type="button"
                  onClick={() => activateSearchItem(item)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-blue-50 focus-visible:bg-blue-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{item.detail}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              )              ) : isStudent && onAskAI ? (
                <button
                  type="button"
                  onClick={() => {
                    onAskAI?.(searchQuery.trim());
                    setSearchQuery('');
                    setSearchOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-blue-50"
                >
                  <Search className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="text-sm text-slate-700">Hỏi EduBot về “{searchQuery.trim()}”</span>
                </button>
              ) : (
                <p className="px-3 py-3 text-sm text-slate-500">{language === 'en' ? 'No matching results.' : 'Không tìm thấy mục phù hợp.'}</p>
              )}
            </div>
          )}
        </form>
      )}
      <div className="order-2 ml-auto flex shrink-0 items-center gap-2">
        <button onClick={onNotifications} aria-label={language === 'en' ? 'Open notifications' : 'Mở thông báo'} className="relative rounded-lg border border-slate-200 bg-white p-1.5 transition-colors hover:bg-slate-50">
          <Bell className="h-4 w-4 text-slate-500" />
          {unreadNotificationCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </span>
          )}
        </button>
        <div className="group relative">
          <button type="button" aria-haspopup="menu" className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-white">
                {isStudent ? 'L' : roleInitials[role]}
              </span>
            )}
            <span className="hidden max-w-[120px] truncate text-sm font-semibold text-slate-700 sm:inline">{displayName}</span>
            <span className="text-xs font-semibold text-slate-400 sm:hidden">{roleInitials[role]}</span>
            <span aria-hidden="true" className="text-xs text-slate-400">⌄</span>
          </button>
          <div role="menu" className="invisible absolute right-0 top-full z-50 mt-1 w-52 translate-y-1 rounded-xl border border-slate-200 bg-white p-1.5 opacity-0 shadow-lg transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
            {isStudent ? (
              <>
                <button type="button" role="menuitem" onClick={() => onNavigate('profile')} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                  <UserRound className="h-4 w-4 text-slate-400" /> Hồ sơ cá nhân
                </button>
              </>
            ) : (
              <>
                <button type="button" role="menuitem" onClick={() => onNavigate('profile')} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                  <UserRound className="h-4 w-4 text-slate-400" /> {language === 'en' ? 'Profile & activity' : 'Hồ sơ & hoạt động'}
                </button>
                <button type="button" role="menuitem" onClick={() => onNavigate('settings')} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                  <Settings className="h-4 w-4 text-slate-400" /> {language === 'en' ? 'Settings' : 'Cài đặt'}
                </button>
              </>
            )}
            <div className="my-1 border-t border-slate-100" />
            <button type="button" role="menuitem" onClick={onLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50">
              <LogOut className="h-4 w-4" /> {language === 'en' ? 'Sign out' : 'Đăng xuất'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function NotificationDrawer({
  notifications,
  loading,
  error,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onOpenNotification,
  language = 'vi',
}: {
  notifications: UserNotification[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenNotification: (notification: UserNotification) => void;
  language?: AppLanguage;
}) {
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  return (
    <div className="fixed inset-0 z-[60]">
      <div role="button" tabIndex={0} aria-label={language === 'en' ? 'Close notifications' : 'Đóng thông báo'} onClick={onClose} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') onClose(); }} className="absolute inset-0 bg-slate-950/45 cursor-default" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-slate-50 shadow-2xl">
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 px-4 py-3.5 text-white sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold leading-5">{language === 'en' ? 'Notifications' : 'Thông báo'}</h2>
                <p className="mt-0.5 truncate text-xs text-blue-100/80">{language === 'en' ? 'Up to 10 latest updates' : 'Tối đa 10 cập nhật gần nhất'}</p>
              </div>
            </div>
            <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-blue-100 transition hover:bg-white/10 hover:text-white" aria-label={language === 'en' ? 'Close' : 'Đóng'}>
              <span aria-hidden="true" className="text-2xl leading-none">×</span>
            </button>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/10 pt-2.5">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-blue-50 ring-1 ring-white/10">
              {language === 'en' ? `${unreadCount} unread` : `${unreadCount} chưa đọc`}
            </span>
            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={unreadCount === 0 || loading}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {language === 'en' ? 'Mark all as read' : 'Đánh dấu tất cả đã đọc'}
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
          {error && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {loading && notifications.length === 0 && (
            <div role="status" className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-8 text-sm font-medium text-slate-600 shadow-sm">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
              {language === 'en' ? 'Loading your updates…' : 'Đang tải cập nhật…'}
            </div>
          )}
          {!loading && notifications.length === 0 && !error && (
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Bell className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-bold text-slate-900">{language === 'en' ? 'You’re all caught up' : 'Bạn đã cập nhật đầy đủ'}</h3>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-5 text-slate-500">
                {language === 'en' ? 'New assignments, grades, and class updates will show up here.' : 'Bài tập mới, kết quả và cập nhật lớp học sẽ xuất hiện tại đây.'}
              </p>
            </div>
          )}
          {notifications.map((notification) => {
            const Icon = notificationIcons[notification.kind];
            const colors = notificationColors[notification.kind];
            return (
              <article
                key={notification.id}
                className={`group relative rounded-xl border border-slate-200 border-l-[3px] bg-white px-3 py-2.5 shadow-sm transition hover:shadow-md ${colors.accent} ${notification.read ? 'opacity-75' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors.icon}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenNotification(notification)}
                        className="min-w-0 truncate text-left text-sm font-bold leading-5 text-slate-900 hover:text-blue-800"
                      >
                        {notification.title}
                      </button>
                      <span className="hidden shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 sm:inline-flex">
                        {language === 'en'
                          ? ({ assignment: 'Assignment', grade: 'Result', appeal: 'Appeal', grading: 'Grading', exam: 'Exam' } satisfies Record<NotificationKind, string>)[notification.kind]
                          : colors.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs leading-4 text-slate-600">{notification.detail}</p>
                      <span className="shrink-0 text-[10px] font-medium text-slate-400">{formatNotificationTime(notification.createdAt, language)}</span>
                    </div>
                  </div>
                  {!notification.read ? (
                    <button
                      type="button"
                      onClick={() => onMarkRead(notification.id)}
                      aria-label={language === 'en' ? 'Mark as read' : 'Đánh dấu đã đọc'}
                      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-600" />
                      <Check className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="h-8 w-8 shrink-0" aria-hidden="true" />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}