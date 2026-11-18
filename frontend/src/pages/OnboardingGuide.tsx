import {
  Bookmark,
  Bot,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  School,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { Role } from '@/types';

const guidanceByRole: Record<Extract<Role, 'student' | 'lecturer'>, {
  section: string;
  icon: typeof LayoutDashboard;
  pages: { page: string; description: string }[];
}[]> = {
  student: [
    { section: 'Tổng quan', icon: LayoutDashboard, pages: [
      { page: 'Trang chủ', description: 'Xem lời nhắc, lịch học và hoạt động học tập.' },
    ] },
    { section: 'Học tập', icon: GraduationCap, pages: [
      { page: 'Lịch học', description: 'Theo dõi thời khóa biểu và lịch kiểm tra.' },
      { page: 'Môn học của tôi', description: 'Mở bài giảng, tài liệu và bài tập theo môn.' },
      { page: 'Phòng thi', description: 'Vào phòng thi trực tuyến khi giáo viên tổ chức.' },
    ] },
    { section: 'Kết quả', icon: ChartNoAxesColumnIncreasing, pages: [
      { page: 'Kết quả học tập', description: 'Xem điểm và theo dõi tiến độ của mình.' },
    ] },
    { section: 'Trợ lý AI', icon: Bot, pages: [
      { page: 'AI học tập', description: 'Hỏi bài hoặc tạo nội dung luyện tập.' },
    ] },
    { section: 'Tiện ích', icon: Bookmark, pages: [
      { page: 'Đã lưu', description: 'Mở lại tài liệu và nội dung đã lưu.' },
      { page: 'Liên hệ & góp ý', description: 'Gửi câu hỏi hoặc phản hồi về hệ thống.' },
    ] },
    { section: 'Cài đặt', icon: Settings, pages: [
      { page: 'Cài đặt', description: 'Tùy chỉnh giao diện và tài khoản.' },
    ] },
  ],
  lecturer: [
    { section: 'Tổng quan', icon: LayoutDashboard, pages: [
      { page: 'Trang chủ', description: 'Xem tóm tắt lớp, lịch dạy và việc cần theo dõi.' },
    ] },
    { section: 'Lớp học', icon: School, pages: [
      { page: 'Lớp của tôi', description: 'Xem lớp được phân công và thông tin học sinh.' },
      { page: 'Lịch dạy', description: 'Xem và cập nhật thời khóa biểu, đề mục từng tiết.' },
      { page: 'Phân tích lớp', description: 'Theo dõi kết quả và học sinh cần hỗ trợ.' },
    ] },
    { section: 'Giảng dạy', icon: BookOpen, pages: [
      { page: 'Câu hỏi & đề thi', description: 'Quản lý câu hỏi, bài tập và đề thi.' },
      { page: 'Tài liệu bài giảng', description: 'Quản lý tài liệu và chia sẻ nội dung cho lớp.' },
    ] },
    { section: 'Chấm & theo dõi', icon: ClipboardCheck, pages: [
      { page: 'Chấm bài', description: 'Xem bài nộp, chấm điểm và gửi nhận xét.' },
      { page: 'Giám sát phòng thi', description: 'Theo dõi phòng thi và tình trạng bài làm.' },
    ] },
    { section: 'Trợ lý AI', icon: Sparkles, pages: [
      { page: 'Soạn bài với AI', description: 'Tạo bản nháp bài giảng, câu hỏi hoặc bài tập để chỉnh sửa.' },
      { page: 'Chatbot AI', description: 'Hỏi AI và tham khảo gợi ý phục vụ giảng dạy.' },
    ] },
    { section: 'Tiện ích', icon: Bookmark, pages: [
      { page: 'Đã lưu', description: 'Mở lại nội dung đã lưu.' },
      { page: 'Liên hệ & góp ý', description: 'Gửi câu hỏi hoặc phản hồi về hệ thống.' },
    ] },
    { section: 'Cài đặt', icon: Settings, pages: [
      { page: 'Cài đặt', description: 'Tùy chỉnh giao diện và tài khoản.' },
    ] },
  ],
};

export function OnboardingGuide({
  role,
  initialStorageError = '',
  onDismiss,
  onCloseWithoutSaving,
}: {
  role: Extract<Role, 'student' | 'lecturer'>;
  initialStorageError?: string;
  onDismiss: () => string | null;
  onCloseWithoutSaving: () => void;
}) {
  const [storageError, setStorageError] = useState(initialStorageError);

  const dismiss = () => {
    const error = onDismiss();
    if (error) {
      setStorageError(error);
      return;
    }
    setStorageError('');
  };

  return (
    <aside
      aria-label="Hướng dẫn nhanh"
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-40 flex max-h-[min(78vh,48rem)] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 sm:right-5 md:bottom-5"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-violet-50 px-4 py-3.5">
        <div>
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-blue-600">EduFlow</p>
          <h2 className="mt-0.5 text-2xl font-bold leading-tight text-slate-900">
            {role === 'student' ? 'Hướng dẫn học sinh' : 'Hướng dẫn giáo viên'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Chọn một mục trên thanh bên để bắt đầu.</p>
        </div>
        <button
          type="button"
          onClick={() => storageError ? onCloseWithoutSaving() : dismiss()}
          aria-label="Đóng hướng dẫn"
          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>
      <div className="space-y-3 overflow-y-auto bg-slate-50/70 px-3 py-3">
        {guidanceByRole[role].map(({ section, icon: Icon, pages }, sectionIndex) => (
          <section key={section} aria-labelledby={`guide-section-${sectionIndex}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <h3 id={`guide-section-${sectionIndex}`} className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {section}
            </h3>
            <ul className="divide-y divide-slate-100 px-3">
              {pages.map(({ page, description }) => (
                <li key={page} className="py-2.5 first:pt-2.5 last:pb-2.5">
                  <p className="text-sm font-semibold leading-5 text-slate-800">{page}</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {storageError && <p role="status" className="mt-3 text-sm leading-5 text-amber-800">{storageError}</p>}
        {storageError && (
          <button type="button" onClick={onCloseWithoutSaving} className="mt-2 text-sm font-medium text-slate-600 underline underline-offset-2">
            Đóng, không lưu
          </button>
        )}
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-900">
          Cần hỗ trợ thêm? Liên hệ quản trị viên của đơn vị bạn.
        </p>
      </div>
    </aside>
  );
}
