import { X } from 'lucide-react';
import { useState } from 'react';
import type { Role } from '@/types';

const guidanceByRole: Record<Extract<Role, 'student' | 'lecturer'>, { page: string; description: string }[]> = {
  student: [
    { page: 'Trang chủ', description: 'Xem lời nhắc, lịch học và tóm tắt hoạt động học tập.' },
    { page: 'Lịch học', description: 'Theo dõi thời khóa biểu và lịch kiểm tra.' },
    { page: 'Môn học của tôi', description: 'Chọn môn để mở bài giảng, tài liệu, bài tập và bài kiểm tra.' },
    { page: 'Phòng thi', description: 'Vào phòng thi trực tuyến khi giáo viên tổ chức.' },
    { page: 'Kết quả học tập', description: 'Xem điểm và theo dõi tiến độ học tập của mình.' },
    { page: 'AI học tập', description: 'Hỏi bài hoặc tạo nội dung luyện tập để ôn tập.' },
    { page: 'Đã lưu', description: 'Mở lại tài liệu và nội dung học tập đã lưu.' },
    { page: 'Liên hệ & góp ý', description: 'Gửi câu hỏi hoặc phản hồi về hệ thống.' },
  ],
  lecturer: [
    { page: 'Trang chủ', description: 'Xem tóm tắt lớp, lịch dạy và hoạt động cần theo dõi.' },
    { page: 'Câu hỏi & đề thi', description: 'Quản lý ngân hàng câu hỏi, bài tập đã lưu và đề thi đã lưu.' },
    { page: 'Tài liệu bài giảng', description: 'Quản lý tài liệu giảng dạy và nội dung chia sẻ cho lớp.' },
    { page: 'Lớp của tôi', description: 'Xem các lớp được phân công và thông tin học sinh.' },
    { page: 'Lịch dạy', description: 'Xem thời khóa biểu giảng dạy.' },
    { page: 'Phân tích lớp', description: 'Theo dõi kết quả, tiến độ và nội dung học sinh cần hỗ trợ.' },
    { page: 'Chấm bài', description: 'Xem bài nộp, chấm điểm và gửi nhận xét cho học sinh.' },
    { page: 'Giám sát phòng thi', description: 'Theo dõi các phòng thi và tình trạng bài làm.' },
    { page: 'Soạn bài với AI', description: 'Tạo bản nháp giáo án, bài giảng, câu hỏi hoặc bài tập; kiểm tra và chỉnh sửa trước khi dùng.' },
    { page: 'Chatbot AI', description: 'Đặt câu hỏi hoặc nhờ AI gợi ý nội dung phục vụ công việc giảng dạy.' },
    { page: 'Liên hệ & góp ý', description: 'Gửi câu hỏi hoặc phản hồi về hệ thống.' },
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
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-40 flex max-h-[min(74vh,44rem)] w-[min(23rem,calc(100vw-1.5rem))] flex-col rounded-xl border border-slate-200 bg-white shadow-xl sm:right-5 md:bottom-5"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3.5">
        <h2 className="text-lg font-semibold text-slate-900">Hướng dẫn nhanh</h2>
        <button
          type="button"
          onClick={() => storageError ? onCloseWithoutSaving() : dismiss()}
          aria-label="Đóng hướng dẫn"
          className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>
      <div className="overflow-y-auto px-4 py-3.5">
        <ul className="list-disc space-y-2.5 pl-5 text-[0.9375rem] leading-6 text-slate-600 marker:text-slate-500">
          {guidanceByRole[role].map(({ page, description }) => (
            <li key={page}>
              Vào <strong className="font-semibold text-slate-700">{page}</strong> để {description.charAt(0).toLocaleLowerCase('vi') + description.slice(1)}
            </li>
          ))}
        </ul>
        {storageError && <p role="status" className="mt-3 text-sm leading-5 text-amber-800">{storageError}</p>}
        {storageError && (
          <button type="button" onClick={onCloseWithoutSaving} className="mt-2 text-sm font-medium text-slate-600 underline underline-offset-2">
            Đóng, không lưu
          </button>
        )}
        <p className="mt-4 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600">
          Cần hỗ trợ thêm? Liên hệ quản trị viên của đơn vị bạn.
        </p>
      </div>
    </aside>
  );
}
