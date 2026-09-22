import type { Page } from '@/types';

interface PlaceholderProps {
  page: Page;
}

const pageNames: Record<string, string> = {
  lectures: 'Bài giảng',
  assignments: 'Bài tập',
  grading: 'Chấm điểm',
  notifications: 'Thông báo',
  settings: 'Cài đặt',
  users: 'Quản lý người dùng',
  'my-classes': 'Lớp học của tôi',
  'my-lessons': 'Bài học',
  'my-results': 'Kết quả học tập',
};

export function Placeholder({ page }: PlaceholderProps) {
  const name = pageNames[page] || 'Trang';
  return (
    <div className="card p-10 flex flex-col items-center text-center min-h-[400px] justify-center animate-fadeIn">
      <div className="w-14 h-14 rounded-md bg-slate-100 flex items-center justify-center">
        <span className="text-2xl font-bold text-slate-300">{name.charAt(0)}</span>
      </div>
      <h3 className="text-base font-semibold text-slate-800 mt-4">{name}</h3>
      <p className="text-sm text-slate-400 mt-1.5 max-w-sm">
        Chức năng này đang được phát triển. Vui lòng quay lại sau.
      </p>
    </div>
  );
}
