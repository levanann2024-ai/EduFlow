import {
  BarChart3,
  Bell,
  BookOpen,
  BookMarked,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Page, Role } from '@/types';

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
  role: Role;
  onLogout: () => void;
}

const roleLabels: Record<Role, string> = {
  admin: 'Quản trị viên',
  lecturer: 'Giáo viên',
  student: 'Học sinh',
};

const roleInitials: Record<Role, string> = {
  admin: 'AD',
  lecturer: 'GV',
  student: 'SV',
};

const menuIcons: Record<Page, LucideIcon> = {
  dashboard: LayoutDashboard,
  classes: GraduationCap,
  lectures: BookOpen,
  'lesson-plan': FileText,
  'lesson-slides': Sparkles,
  'ai-quiz': ClipboardCheck,
  grading: ClipboardCheck,
  analytics: BarChart3,
  'ai-chat': MessageSquare,
  assignments: ClipboardCheck,
  'my-classes': GraduationCap,
  'my-lessons': BookMarked,
  'my-results': BarChart3,
  users: Users,
  notifications: Bell,
  settings: Settings,
};

const menus: Record<Role, { id: Page; label: string }[]> = {
  lecturer: [
    { id: 'dashboard', label: 'Tổng quan' },
    { id: 'classes', label: 'Lớp học của tôi' },
    { id: 'lectures', label: 'Bài giảng' },
    { id: 'lesson-plan', label: 'Tạo giáo án' },
    { id: 'lesson-slides', label: 'Tạo slide bài giảng' },
    { id: 'ai-quiz', label: 'Tạo câu hỏi' },
    { id: 'grading', label: 'Chấm điểm' },
    { id: 'analytics', label: 'Phân tích tiến độ học tập' },
    { id: 'ai-chat', label: 'Trợ lý AI' },
  ],
  student: [
    { id: 'dashboard', label: 'Tổng quan' },
    { id: 'my-classes', label: 'Lớp học của tôi' },
    { id: 'my-lessons', label: 'Bài học của tôi' },
    { id: 'assignments', label: 'Bài tập / Bài kiểm tra'},
    { id: 'ai-chat', label: 'Trợ lý học tập' },
    { id: 'my-results', label: 'Kết quả học tập'},
  ],
  admin: [
    { id: 'dashboard', label: 'Tổng quan' },
    { id: 'users', label: 'Quản lý người dùng' },
    { id: 'lectures', label: 'Quản lý lưu trữ hệ thống' },
    { id: 'analytics', label: 'Thống kê hệ thống' },
  ],
};

export function Sidebar({ current, onNavigate, role, onLogout }: SidebarProps) {
  const items = menus[role];
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-slate-900 border-r border-slate-800 fixed inset-y-0 left-0 z-40">
      {/* 1. Phần Logo cố định ở trên */}
      <div className="px-5 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <BookOpen className="w-[18px] h-[18px] text-white" />
          </div>
          <span className="font-semibold text-slate-100 text-base tracking-tight">EduFlow</span>
        </div>
      </div>

      {/* 2. Danh sách menu ở giữa có đường gạch nhỏ (border-t) phía trên mỗi mục */}
      <nav className="px-3 py-3 space-y-1 overflow-y-auto flex-1">
        <p className="px-3 py-1 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Điều hướng</p>
        {items.map((item, index) => {
          const active = current === item.id;
          const Icon = menuIcons[item.id];
          return (
            <div key={item.id}>
              {/* Đường gạch nhỏ phía trên đầu mỗi mục điều hướng */}
              {index > 0 && <div className="my-1 mx-3 border-t border-slate-800/80" />}
              <button
                onClick={() => onNavigate(item.id)}
                className={`nav-item w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-blue-600/10 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span>{item.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* 3. Phần Cài đặt & Đăng xuất ép dính chặt ở đáy sidebar */}
      <div className="shrink-0 px-3 py-3 border-t border-slate-800 space-y-1 bg-slate-900">
        <button onClick={() => onNavigate('settings')} className="nav-item w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
          <Settings className="w-[18px] h-[18px]" />
          <span>Cài đặt</span>
        </button>
        <div className="my-1 mx-3 border-t border-slate-800/80" />
        <button onClick={onLogout} className="nav-item w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
          <LogOut className="w-[18px] h-[18px]" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({ current, onNavigate, role }: Omit<SidebarProps, 'onLogout'>) {
  const items = menus[role].slice(0, 4);
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 z-50 px-2 py-2 flex justify-around">
      {items.map((item) => {
        const active = current === item.id;
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
            <span className="truncate max-w-[72px]">{item.label.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TopBar({ title, subtitle, role, onNotifications }: { title: string; subtitle: string; role: Role; onNotifications: () => void }) {
  return (
    <header className="mb-8 pb-5 border-b border-slate-200 flex items-center justify-between gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="hidden md:flex items-center relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
        </div>
        <button onClick={onNotifications} aria-label="Mở thông báo" className="relative p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
          <Bell className="w-[18px] h-[18px] text-slate-500" />
          <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-600" />
        </button>
        <div className="flex items-center gap-2 pl-1">
          <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-white text-sm font-medium">
            {roleInitials[role]}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-700 leading-none">{roleLabels[role]}</p>
            <p className="text-xs text-slate-400 mt-1">Đang hoạt động</p>
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