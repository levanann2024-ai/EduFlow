import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bookmark,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
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
  ShieldAlert,
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
  appeals: ShieldAlert,
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
    { label: 'TỔNG QUAN', items: [
      { id: 'dashboard', label: 'Trang chủ' },
    ] },
    { label: 'QUẢN LÝ LỚP HỌC', items: [
      { id: 'classes', label: 'Lớp học' },
    ] },
    { label: 'SOẠN BÀI & ĐỀ THI', items: [
      { id: 'lesson-builder', label: 'Soạn bài với AI', highlight: true },
      { id: 'exams', label: 'Ngân hàng câu hỏi & Đề thi' },
      { id: 'lessons', label: 'Tài liệu bài giảng' },
    ] },
    { label: 'GIÁM SÁT & CHẤM ĐIỂM', items: [
      { id: 'ai-grading', label: 'Chấm bài' },
      { id: 'analytics', label: 'Phân tích tiến độ' },
      { id: 'exam-monitor', label: 'Giám sát phòng thi' },
    ] },
  ],
  student: [
    { label: 'Tổng quan', items: [
      { id: 'dashboard', label: 'Trang chủ' },
      { id: 'schedule', label: 'Thời khóa biểu & Lịch thi' },
    ] },
    { label: 'Học tập', items: [
      { id: 'my-classes', label: 'Môn học của tôi' },
      { id: 'online-exams', label: 'Phòng thi trực tuyến' },
    ] },
    { label: 'Trợ lý AI', items: [
      { id: 'ai-learning', label: 'AI học tập', highlight: true },
    ] },
    { label: 'Tiến độ & Thi đua', items: [
      { id: 'my-results', label: 'Kết quả học tập' },
    ] },
    { label: 'Hỗ trợ & Tiện ích', items: [
      { id: 'saved', label: 'Đã lưu' },
      { id: 'feedback', label: 'Góp ý & Báo lỗi' },
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

function isMenuItemActive(role: Role, item: MenuItem, current: Page) {
  if (current === item.id) return true;
  if (role === 'student' && item.id === 'ai-learning') return current === 'ai-chat' || current === 'ai-practice';
  if (role !== 'lecturer') return false;
  if (item.id === 'exams') return current === 'question-bank' || current === 'saved-assignments';
  if (item.id === 'exam-monitor') return current === 'appeals';
  return false;
}

export function Sidebar({ current, onNavigate, role, onLogout, collapsed, onToggleCollapsed }: SidebarProps) {
  const sections = menus[role];
  return (
    <aside className={`fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-slate-800 bg-slate-900 transition-[width] duration-200 lg:flex ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* 1. Phần Logo cố định ở trên */}
      <div className={`flex shrink-0 items-center border-b border-slate-800 py-4 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        <div className="flex min-w-0 items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BookOpen className="w-[18px] h-[18px] text-white" />
          </div>
          {!collapsed && <span className="truncate font-semibold text-slate-100 text-base tracking-tight">EduFlow</span>}
        </div>
        {!collapsed && (
          <button type="button" onClick={onToggleCollapsed} aria-label="Thu gọn thanh điều hướng" title="Thu gọn thanh điều hướng" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white">
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>
      {collapsed && (
        <button type="button" onClick={onToggleCollapsed} aria-label="Mở rộng thanh điều hướng" title="Mở rộng thanh điều hướng" className="mx-auto mt-2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white">
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {/* 2. Danh sách menu ở giữa có đường gạch nhỏ (border-t) phía trên mỗi mục */}
      <nav aria-label="Điều hướng chính" className={`flex-1 space-y-1 overflow-y-auto py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        {sections.map((section) => (
          <section key={section.label} className="mb-4">
            {!collapsed && <h2 className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{section.label}</h2>}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isMenuItemActive(role, item, current);
                const Icon = menuIcons[item.id];
                const highlight = item.highlight;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={`nav-item flex w-full items-center rounded-lg py-2 text-sm font-medium transition-colors ${
                      collapsed ? 'justify-center px-2' : 'gap-3 px-3 text-left'
                    } ${
                      highlight
                        ? active ? 'bg-violet-500/20 text-violet-200' : 'text-violet-300 hover:text-violet-100 hover:bg-violet-500/10'
                        : active ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${highlight ? 'text-violet-400' : ''}`} />
                    {!collapsed && <span className="leading-5">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      {/* 3. Phần Cài đặt & Đăng xuất ép dính chặt ở đáy sidebar */}
      <div className={`shrink-0 space-y-1 border-t border-slate-800 bg-slate-900 py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        <button onClick={() => onNavigate('settings')} title={collapsed ? 'Cài đặt' : undefined} aria-label={collapsed ? 'Cài đặt' : undefined} className={`nav-item flex w-full items-center rounded-lg py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-slate-200 ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'}`}>
          <Settings className="w-[18px] h-[18px]" />
          {!collapsed && <span>Cài đặt</span>}
        </button>
        {!collapsed && <div className="my-1 mx-3 border-t border-slate-800/80" />}
        <button onClick={onLogout} title={collapsed ? 'Đăng xuất' : undefined} aria-label={collapsed ? 'Đăng xuất' : undefined} className={`nav-item flex w-full items-center rounded-lg py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400 ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'}`}>
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span>Đăng xuất</span>}
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({ current, onNavigate, role }: Pick<SidebarProps, 'current' | 'onNavigate' | 'role'>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mobilePageIds: Record<Role, Page[]> = {
    admin: ['dashboard', 'users', 'lectures', 'analytics'],
    lecturer: ['dashboard', 'classes', 'lesson-builder', 'exams'],
    student: ['dashboard', 'schedule', 'my-classes', 'ai-learning'],
  };
  const allItems = menus[role].flatMap((section) => section.items);
  const items = mobilePageIds[role].map((id) => allItems.find((item) => item.id === id)).filter((item): item is MenuItem => item !== undefined);
  return (
    <>
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-[55]" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/30" />
          <nav
            aria-label="Tất cả trang"
            className="absolute bottom-20 inset-x-3 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {menus[role].map((section) => (
              <section key={section.label} className="mb-3 last:mb-0">
                <h2 className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{section.label}</h2>
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
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </section>
            ))}
          </nav>
        </div>
      )}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 z-50 px-1 py-2 flex justify-around">
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
            <span className="truncate max-w-[72px]">{item.id === 'ai-learning' ? 'AI học tập' : item.label.split(' ')[0]}</span>
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
          <span>Thêm</span>
        </button>
      </div>
    </>
  );
}

export function TopBar({
  role,
  userName,
  onNotifications,
  onNavigate,
  onLogout,
  onOpenResources,
  onOpenAssignments,
  onAskAI,
}: {
  role: Role;
  userName?: string;
  onNotifications: () => void;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onOpenResources?: (subjectCode: string) => void;
  onOpenAssignments?: (subjectCode: string) => void;
  onAskAI?: (prompt: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const isStudent = role === 'student';
  const isLecturer = role === 'lecturer';
  const isFullWidthBar = isStudent || isLecturer;
  const displayName = userName || (isStudent ? 'Lê Văn An' : role === 'lecturer' ? 'Nguyễn Văn An' : 'Quản trị viên');
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
    { label: 'Kháng nghị', detail: 'Xem yêu cầu phúc khảo', page: 'appeals' },
    { label: 'Chấm bài', detail: 'Bài nộp cần chấm', page: 'ai-grading' },
    { label: 'Phân tích tiến độ', detail: 'Thống kê học tập', page: 'analytics' },
  ];
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('vi');
  const searchItems = isStudent ? studentSearchItems : lecturerSearchItems;
  const matchingSearchItems = normalizedSearch
    ? searchItems.filter((item) => `${item.label} ${item.detail}`.toLocaleLowerCase('vi').includes(normalizedSearch)).slice(0, 5)
    : [];
  const activateSearchItem = (item: (typeof searchItems)[number]) => {
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
            aria-label="Tìm kiếm bài học, tài liệu, câu hỏi"
            aria-expanded={searchOpen && normalizedSearch.length > 0}
            placeholder={isLecturer ? 'Tìm lớp học, bài giảng, đề thi...' : 'Tìm kiếm bài học, tài liệu, câu hỏi...'}
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
                <p className="px-3 py-3 text-sm text-slate-500">Không tìm thấy mục phù hợp.</p>
              )}
            </div>
          )}
        </form>
      )}
      <div className="order-2 ml-auto flex shrink-0 items-center gap-2">
        <button onClick={onNotifications} aria-label="Mở thông báo" className="relative rounded-lg border border-slate-200 bg-white p-1.5 transition-colors hover:bg-slate-50">
          <Bell className="h-4 w-4 text-slate-500" />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-600" />
        </button>
        <div className="group relative">
          <button type="button" aria-haspopup="menu" className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-white">
              {isStudent ? 'L' : roleInitials[role]}
            </span>
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
                <button type="button" role="menuitem" onClick={() => onNavigate('practice-history')} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                  <History className="h-4 w-4 text-slate-400" /> Lịch sử làm bài
                </button>
              </>
            ) : (
              <button type="button" role="menuitem" onClick={() => onNavigate('settings')} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                <Settings className="h-4 w-4 text-slate-400" /> Cài đặt
              </button>
            )}
            <div className="my-1 border-t border-slate-100" />
            <button type="button" role="menuitem" onClick={onLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50">
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function NotificationDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div role="button" tabIndex={0} aria-label="Đóng thông báo" onClick={onClose} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') onClose(); }} className="absolute inset-0 bg-slate-950/45 cursor-default" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Thông báo</h2>
            <p className="text-sm text-slate-500 mt-1">Cập nhật mới từ lớp học và hệ thống</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 text-2xl leading-none" aria-label="Đóng">×</button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {[
            ['Bài tập mới được giao', 'Cô Nguyễn Hà đã đăng bài tập “Hàm số bậc hai”.', '10 phút trước', 'text-blue-600'],
            ['Kết quả đã được cập nhật', 'Bài kiểm tra chương 2 của bạn đã có điểm.', '1 giờ trước', 'text-emerald-600'],
            ['Lịch học ngày mai', 'Lớp Vật lý 11A1 bắt đầu lúc 08:00 tại phòng B203.', 'Hôm qua', 'text-amber-600'],
          ].map(([title, detail, time, color]) => (
            <div key={title} className="px-6 py-5">
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${color.replace('text-', 'bg-')}`} />
                <div>
                  <h3 className="font-medium text-slate-900">{title}</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{detail}</p>
                  <p className={`text-xs mt-2 ${color}`}>{time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="text-sm font-medium text-blue-700 hover:text-blue-900">Đánh dấu tất cả đã đọc</button>
        </div>
      </aside>
    </div>
  );
}