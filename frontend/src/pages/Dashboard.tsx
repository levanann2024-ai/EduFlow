import { useState } from 'react';
import { 
  Sparkles, Send, ClipboardCheck, Clock, BookOpen, ShieldCheck, Activity, BarChart2, ChevronRight, Award, CheckCircle2, FileText, ArrowRight,
} from 'lucide-react';
import { mockSchedule, mockClasses } from '@/data';
import type { Page, Role } from '@/types';

interface DashboardProps {
  onNavigate: (page: Page) => void;
  role: Role;
}

const normalizeRole = (role: Role): 'teacher' | 'student' | 'admin' => {
  if (!role) return 'teacher';
  const r = role.toLowerCase();
  if (r.includes('giảng') || r.includes('teacher') || r.includes('gv')) return 'teacher';
  if (r.includes('sinh') || r.includes('student') || r.includes('học') || r.includes('sv')) return 'student';
  if (r.includes('quản trị') || r.includes('admin') || r.includes('qtv')) return 'admin';
  return 'teacher';
};

const getPromptSuggestions = (roleType: 'teacher' | 'student' | 'admin') => {
  if (roleType === 'teacher') {
    return [
      'Tạo 10 câu trắc nghiệm về hàm số bậc hai',
      'Tóm tắt tài liệu Vật lý chương 3',
      'Lên giáo án bài "Định luật Ohm"',
    ];
  }
  if (roleType === 'student') {
    return [
      'Giải thích lại định luật Ohm dễ hiểu hơn',
      'Tạo bài tập ôn tập chương hàm số bậc hai',
      'Tóm tắt công thức Vật lý 10 quan trọng',
    ];
  }
  return [
    'Thống kê tổng lượng sử dụng token AI tháng này',
    'Báo cáo số lượng giáo viên hoạt động tích cực',
    'Kiểm tra nhật ký hệ thống gần đây',
  ];
};

export function Dashboard({ onNavigate, role }: DashboardProps) {
  const [prompt, setPrompt] = useState('');
  const roleType = normalizeRole(role);

  const handlePromptSubmit = () => {
    if (!prompt.trim()) return;
    onNavigate('ai-chat');
  };

  const suggestions = getPromptSuggestions(roleType);

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto pb-10">
   {roleType === 'teacher' && (
  <>
    {/*CÁC THẺ CHỈ SỐ NHỎ GỌN (STATS CARDS) */}
    <div className="rounded-2xl p-6 border border-blue-200/60 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/30 border border-blue-400/30 flex items-center justify-center backdrop-blur-md">
            <Sparkles className="w-4.5 h-4.5 text-blue-300" />
          </div>
          <div>
            <h2 className="font-semibold text-white text-base">
              {roleType === 'teacher'
                ? 'Trợ lý AI thông minh cho Giáo viên'
                : roleType === 'student'
                  ? 'Không gian học tập cá nhân hóa cho Học sinh'
                  : 'Trung tâm điều phối & Giám sát hệ thống AI'}
            </h2>
            <p className="text-sm text-blue-200/70">Nhập yêu cầu bất kỳ để hệ thống tự động xử lý nội dung chuyên môn.</p>
          </div>
        </div>

        <div className="relative bg-slate-900/50 p-4 rounded-xl border border-slate-700/60 shadow-inner">
  {/* Ô nhập nội dung */}
  <textarea
    value={prompt}
    onChange={(e) => setPrompt(e.target.value)}
    placeholder="VD: Soạn giáo án chi tiết 45 phút môn Vật lý lớp 10..."
    className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-sm focus:outline-none resize-none min-h-[80px] pb-3"
  />

  {/* Thanh công cụ dưới ô nhập: Đưa nút Thực thi ra ngoài, nằm sát góc phải */}
  <div className="flex items-center justify-between pt-2 border-t border-slate-700/40">
    <span className="text-xs text-slate-400">Nhập yêu cầu chi tiết để đạt kết quả tốt nhất</span>
    <button 
      onClick={handlePromptSubmit} 
      aria-disabled={!prompt.trim()}
      className="student-ai-button font-medium px-5 py-2.5 flex items-center gap-1.5 transition-colors text-sm"
    >
      <Send className="w-3.5 h-3.5" />
      <span>Thực thi</span>
    </button>
  </div>
</div>

        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/10">
          <span className="text-sm text-blue-200/60 uppercase tracking-wider font-medium">Gợi ý nhanh:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => setPrompt(s)}
              className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/15 border border-white/10 text-sm text-blue-100 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="card p-4 bg-white shadow-2xs border-l-4 border-l-blue-500">
        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Tổng số lớp học</p>
        <div className="flex items-baseline justify-between mt-2">
          <span className="text-2xl font-bold text-slate-900">{mockClasses.length}</span>
          <span className="text-sm text-emerald-600 font-medium">Đang tham gia</span>
        </div>
      </div>
      <div className="card p-4 bg-white shadow-2xs border-l-4 border-l-indigo-500">
        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Bài giảng đã tạo</p>
        <div className="flex items-baseline justify-between mt-2">
          <span className="text-2xl font-bold text-slate-900">32</span>
          <span className="text-sm text-slate-400">Trong tổng số 100+</span>
        </div>
      </div>
      <div className="card p-4 bg-white shadow-2xs border-l-4 border-l-amber-500">
        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Bài tập đã nộp</p>
        <div className="flex items-baseline justify-between mt-2">
          <span className="text-2xl font-bold text-slate-900">28</span>
          <span className="text-sm text-blue-600 font-medium">Trong tuần này</span>
        </div>
      </div>
      <div className="card p-4 bg-white shadow-2xs border-l-4 border-l-emerald-500">
        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Điểm trung bình</p>
        <div className="flex items-baseline justify-between mt-2">
          <span className="text-2xl font-bold text-slate-900">9.2</span>
          <span className="text-sm text-slate-400">Của tất cả các môn</span>
        </div>
      </div>
    </div>

    {/*BỐ CỤC 2 CỘT: VIỆC CẦN LÀM (TRÁI) & LỊCH DẠY (PHẢI) */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="card lg:col-span-2 bg-white overflow-hidden shadow-2xs">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Việc cần làm hôm nay</h3>
          <button onClick={() => onNavigate('grading')} className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
            Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="divide-y divide-slate-100 text-sm">
          <div className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-800">Chấm bài kiểm tra Toán 10A2</p>
              <p className="text-slate-400 text-sm">Còn 23 bài cần chấm. Ước tính ~ 45 phút.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-medium">10A2</span>
              <span className="text-slate-400">Hôm nay</span>
              <button onClick={() => onNavigate('grading')} className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 font-semibold hover:underline">Chấm ngay</button>
            </div>
          </div>

          <div className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-800">Soạn giáo án: Bài 5 - Hàm số bậc hai</p>
              <p className="text-slate-400 text-sm">Lớp 10A1 • Tiết 3 • Theo chương trình tuần này.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-medium">10A1</span>
              <span className="text-slate-400">Còn 2 giờ</span>
              <button onClick={() => onNavigate('lesson-plan')} className="text-blue-600 font-semibold hover:underline">Tiếp tục</button>
            </div>
          </div>

          <div className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-800">Tạo bộ câu hỏi ôn tập</p>
              <p className="text-slate-400 text-sm">Lớp 10A2 • Chương 2: Hàm số</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-medium">10A2</span>
              <span className="text-slate-400">Còn 3 giờ</span>
              <button onClick={() => onNavigate('ai-quiz')} className="text-blue-600 font-semibold hover:underline">Tạo ngay</button>
            </div>
          </div>

          <div className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-800">Tạo slide bài giảng</p>
              <p className="text-slate-400 text-sm">Bài 6 - Phương trình bậc hai • Lớp 10A1</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-medium">10A1</span>
              <span className="text-slate-400">Còn 1 ngày</span>
              <button onClick={() => onNavigate('lesson-slides')} className="text-blue-600 font-semibold hover:underline">Tạo slide</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-white p-5 shadow-2xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Lịch dạy trong tuần</h3>
            <span className="text-sm text-slate-400">Tháng 9, 2025</span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <p className="font-semibold text-slate-800">Thứ 2 • 15/9</p>
                <p className="text-sm text-slate-500">10A2 - Toán (07:30 - 09:10)</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <p className="font-semibold text-slate-800">Thứ 3 • 16/9</p>
                <p className="text-sm text-slate-500">Vật lý 10A1 (09:20 - 11:00)</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <p className="font-semibold text-slate-800">Thứ 4 • 17/9</p>
                <p className="text-sm text-slate-500">Hóa học 10A2 (14:00 - 15:40)</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <p className="font-semibold text-slate-800">Thứ 5 • 18/9</p>
                <p className="text-sm text-slate-500">Lớp bồi dưỡng (15:00 - 17:00)</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>
    </div>

    {/*PHẦN DƯỚI: HOẠT ĐỘNG GẦN ĐÂY & CẦN LƯU Ý */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="card lg:col-span-2 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Hoạt động gần đây</h3>
          <button onClick={() => onNavigate('ai-chat')} className="text-sm text-blue-600 font-medium hover:underline">Xem tất cả</button>
        </div>
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex justify-between items-center">
            <span>Bạn đã nộp bài tập: Bài 5 - Hàm số bậc hai (Toán 10A1)</span>
            <span className="text-sm text-slate-400">2 giờ trước</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Đã tạo giáo án mới: Phương trình bậc hai (Toán 10)</span>
            <span className="text-sm text-slate-400">3 giờ trước</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Bạn đã chấm xong bài kiểm tra: Vật lý 11 - Chương 3.pdf</span>
            <span className="text-sm text-slate-400">5 giờ trước</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Đã tạo slide bài giảng: Hàm số (Toán 10A1)</span>
            <span className="text-sm text-slate-400">6 giờ trước</span>
          </div>
        </div>
      </div>

      <div className="card bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Cần lưu ý</h3>
          <button onClick={() => onNavigate('analytics')} className="text-sm text-blue-600 font-medium hover:underline">Chi tiết</button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center">
            <div>
              <p className="font-semibold text-slate-800">Phạm Thu Trang (Lớp 11B3)</p>
              <p className="text-sm text-slate-400">Nộp bài tập trễ 1 ngày</p>
            </div>
            <span className="status-label text-rose-600 text-sm font-semibold">Quá hạn</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center">
            <div>
              <p className="font-semibold text-slate-800">Hoàng Mai Anh (Lớp 10C1)</p>
              <p className="text-sm text-slate-400">Chưa nộp bài kiểm tra</p>
            </div>
            <span className="status-label text-amber-600 text-sm font-semibold">Chưa nộp</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center">
            <div>
              <p className="font-semibold text-slate-800">Lê Quốc Bảo (Lớp 11B3)</p>
              <p className="text-sm text-slate-400">Điểm thấp (7.5)</p>
            </div>
            <span className="status-label text-blue-600 text-sm font-semibold">Cần theo dõi</span>
          </div>
        </div>
      </div>
    </div>
  </>
)}
      {/* --- DASHBOARD CHO SINH VIÊN --- */}
      {roleType === 'student' && (
        <>
          {/* 1. GIA SƯ AI FULL CHIỀU NGANG (ĐÃ XÓA BANNER CHÀO MỪNG) */}
          <div className="w-full rounded-2xl p-6 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white shadow-lg space-y-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-blue-500/30 flex items-center justify-center">
        <Sparkles className="w-5 h-5 text-blue-300" />
      </div>
      <div>
        <h3 className="font-bold text-base text-white">AI hỗ trợ học tập</h3>
        <p className="text-xs text-blue-200">Trợ lý ảo hỗ trợ giải bài tập, tóm tắt lý thuyết và giải đáp mọi thắc mắc học tập.</p>
      </div>
    </div>
    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30 shrink-0">Sẵn sàng hỗ trợ</span>
  </div>

  <div>
    <textarea
      value={prompt}
      onChange={(e) => setPrompt(e.target.value)}
      placeholder="Nhờ AI giải bài tập Toán, Lý, Hóa, Văn hoặc đặt câu hỏi bất kỳ..."
      className="w-full bg-slate-800/80 text-slate-100 placeholder-slate-400 text-sm p-3.5 rounded-xl border border-slate-700 focus:outline-none focus:border-blue-500 resize-none min-h-[90px]"
    />
  </div>

  {/* Dùng Flex cột hoặc Grid tách bạch hẳn phần gợi ý và nút hành động */}
  <div className="flex flex-col gap-3 pt-1">
    <div className="flex flex-wrap gap-2">
      {suggestions.map((s) => (
        <button 
          key={s} 
          onClick={() => setPrompt(s)} 
          className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 transition-colors rounded-lg text-blue-100 flex items-center gap-1"
        >
          <span>{s}</span>
        </button>
      ))}
    </div>

    <div className="flex justify-end pt-2 border-t border-white/10">
      <button 
  type="button"
  onClick={handlePromptSubmit}
  aria-disabled={!prompt.trim()}
  className="student-ai-button px-5 py-2.5 text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
>
  <Send className="w-3.5 h-3.5 text-white" /> Thực thi
</button>
    </div>
  </div>
</div>

          {/* 2. THÔNG BÁO & HOẠT ĐỘNG NHANH */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông báo</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold">Mới</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 line-clamp-2">Lịch kiểm tra 1 tiết môn Toán sắp diễn ra vào tuần tới</p>
              </div>
              <span className="text-[11px] text-slate-400 mt-2">21/09/2026</span>
            </div>
            
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hoạt động</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold">Sắp tới</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 line-clamp-2">Đại hội Đoàn trường và thi đấu thể thao khối 10</p>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-slate-400">26/09/2026</span>
                <span className="text-[11px] text-blue-600 font-semibold cursor-pointer hover:underline">Chi tiết</span>
              </div>
            </div>
          </div>

          {/* 3. KHỐI MÔN HỌC LỚP 10 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" /> Các môn học lớp 10 (Học kỳ 1)
              </h2>
              <button onClick={() => onNavigate('classes')} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Môn 1: Toán 10 */}
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-xs font-bold">TOAN10</span>
                    <span className="text-xs text-slate-400">Trọng tâm</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1">Toán học 10</h3>
                </div>
                <div className="grid grid-cols-3 gap-1 py-2 bg-slate-50 rounded-xl text-center text-xs">
                  <div><span className="block text-[10px] text-slate-400">Tiết học</span><span className="font-bold text-slate-700">18/35</span></div>
                  <div><span className="block text-[10px] text-slate-400">Tài liệu</span><span className="font-bold text-slate-700">12</span></div>
                  <div><span className="block text-[10px] text-slate-400">Bài tập</span><span className="font-bold text-slate-700">3</span></div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Tiến độ chương trình</span><span className="font-semibold text-blue-600">51%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: '51%' }}></div>
                  </div>
                </div>
              </div>

              {/* Môn 2: Vật lý 10 */}
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 text-xs font-bold">VL10</span>
                    <span className="text-xs text-slate-400">Khoa học tự nhiên</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1">Vật lý 10</h3>
                </div>
                <div className="grid grid-cols-3 gap-1 py-2 bg-slate-50 rounded-xl text-center text-xs">
                  <div><span className="block text-[10px] text-slate-400">Tiết học</span><span className="font-bold text-slate-700">14/28</span></div>
                  <div><span className="block text-[10px] text-slate-400">Tài liệu</span><span className="font-bold text-slate-700">8</span></div>
                  <div><span className="block text-[10px] text-slate-400">Bài tập</span><span className="font-bold text-slate-700">2</span></div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Tiến độ chương trình</span><span className="font-semibold text-indigo-600">50%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: '50%' }}></div>
                  </div>
                </div>
              </div>

              {/* Môn 3: Hóa học 10 */}
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 text-xs font-bold">HH10</span>
                    <span className="text-xs text-slate-400">Khoa học tự nhiên</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1">Hóa học 10</h3>
                </div>
                <div className="grid grid-cols-3 gap-1 py-2 bg-slate-50 rounded-xl text-center text-xs">
                  <div><span className="block text-[10px] text-slate-400">Tiết học</span><span className="font-bold text-slate-700">12/28</span></div>
                  <div><span className="block text-[10px] text-slate-400">Tài liệu</span><span className="font-bold text-slate-700">6</span></div>
                  <div><span className="block text-[10px] text-slate-400">Bài tập</span><span className="font-bold text-slate-700">1</span></div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Tiến độ chương trình</span><span className="font-semibold text-amber-600">42%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: '42%' }}></div>
                  </div>
                </div>
              </div>

              {/* Môn 4: Ngữ văn 10 */}
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 text-xs font-bold">NV10</span>
                    <span className="text-xs text-slate-400">Bắt buộc</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1">Ngữ văn 10</h3>
                </div>
                <div className="grid grid-cols-3 gap-1 py-2 bg-slate-50 rounded-xl text-center text-xs">
                  <div><span className="block text-[10px] text-slate-400">Tiết học</span><span className="font-bold text-slate-700">20/35</span></div>
                  <div><span className="block text-[10px] text-slate-400">Tài liệu</span><span className="font-bold text-slate-700">10</span></div>
                  <div><span className="block text-[10px] text-slate-400">Bài tập</span><span className="font-bold text-slate-700">0</span></div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Tiến độ chương trình</span><span className="font-semibold text-rose-600">57%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full" style={{ width: '57%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. BÀI TẬP VỀ NHÀ & LỊCH THÁNG */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">Bài tập về nhà & Kiểm tra</h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold">2</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-blue-600 font-semibold cursor-pointer underline">Chưa nộp (2)</span>
                  <span className="text-slate-400 cursor-pointer hover:text-slate-600">Đã hoàn thành</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-blue-600 font-semibold mb-1">
                      <span>#TOAN10-CH2</span><span className="text-slate-400 font-normal">Toán học 10</span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">Bài tập trắc nghiệm Hàm số bậc hai và đồ thị</p>
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      <span className="truncate max-w-[180px]">De_cuong_Ham_so_10.pdf</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                    <span className="text-slate-500">Hạn: <strong className="text-slate-700">20:00 22/09/2026</strong></span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">Chưa nộp</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-indigo-600 font-semibold mb-1">
                      <span>#VL10-CH3</span><span className="text-slate-400 font-normal">Vật lý 10</span>
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">Bài tập Định luật II Newton và lực ma sát</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                    <span className="text-slate-500">Hạn: <strong className="text-slate-700">23:00 23/09/2026</strong></span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">Chưa nộp</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900 text-sm">Lịch học • Tháng 9/2026</h3>
                  <div className="flex items-center gap-1 text-slate-400">
                    <ChevronRight className="w-4 h-4 rotate-180 cursor-pointer hover:text-slate-600" />
                    <ChevronRight className="w-4 h-4 cursor-pointer hover:text-slate-600" />
                  </div>
                </div>
                <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400 mb-2">
                  <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
                </div>
                <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
                  {['31','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20'].map((day, idx) => (
                    <span key={idx} className="py-1 text-slate-600">{day}</span>
                  ))}
                  <span className="py-1 rounded-full bg-blue-600 text-white font-bold">21</span>
                  {['22','23','24','25','26','27','28','29','30','01','02','03','04'].map((day, idx) => (
                    <span key={idx} className={`py-1 ${Number(day) < 7 && idx > 5 ? 'text-slate-300' : 'text-slate-600'}`}>{day}</span>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Hôm nay: 21/09/2026</span>
                <span className="text-blue-600 font-semibold cursor-pointer hover:underline">Thời khóa biểu</span>
              </div>
            </div>
          </div>

          {/* 5. THỐNG KÊ KẾT QUẢ HỌC TẬP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-900 text-sm">Điểm trung bình học kỳ</h3>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-bold">Giỏi (8.8)</span>
              </div>
              <div className="flex items-center justify-center py-4">
                <div className="relative w-28 h-28 rounded-full border-8 border-slate-100 border-t-emerald-500 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-slate-900">8.8</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Xếp hạng: Top 3</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-blue-600 font-semibold cursor-pointer pt-2 border-t border-slate-100">
                <span>Xem sổ liên lạc điện tử</span><ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-900 text-sm">Hạnh kiểm & Rèn luyện</h3>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold">Tốt</span>
              </div>
              <div className="flex items-center justify-center py-4">
                <div className="relative w-28 h-28 rounded-full border-8 border-slate-100 border-t-blue-500 flex flex-col items-center justify-center">
                  <span className="text-xl font-black text-slate-900">98/100</span>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase">Điểm thi đua</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-blue-600 font-semibold cursor-pointer pt-2 border-t border-slate-100">
                <span>Không vi phạm nội quy</span><CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </>
      )}
      {/* --- DASHBOARD CHO QUẢN TRỊ VIÊN --- */}
      {roleType === 'admin' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card p-4 bg-white shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center mb-2.5 text-purple-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <p className="font-semibold text-slate-800 text-sm">Quản lý người dùng</p>
              <p className="text-sm text-slate-400 mt-0.5">Phân quyền tài khoản giáo viên/học sinh</p>
            </div>
            <div className="card p-4 bg-white shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-2.5 text-blue-600">
                <Activity className="w-4 h-4" />
              </div>
              <p className="font-semibold text-slate-800 text-sm">Nhật ký hệ thống</p>
              <p className="text-sm text-slate-400 mt-0.5">Kiểm soát lượt gọi API và token AI</p>
            </div>
            <div className="card p-4 bg-white shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-2.5 text-amber-600">
                <BarChart2 className="w-4 h-4" />
              </div>
              <p className="font-semibold text-slate-800 text-sm">Thống kê tài nguyên</p>
              <p className="text-sm text-slate-400 mt-0.5">Dung lượng lưu trữ giáo án & tài liệu</p>
            </div>
          </div>

          <div className="card p-5 bg-white shadow-2xs">
            <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wider mb-3">Hiệu suất sử dụng các tính năng AI</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm text-slate-600 mb-1">
                  <span>Tạo câu hỏi trắc nghiệm tự động</span>
                  <span className="font-semibold">64% (1,420 lượt)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: '64%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm text-slate-600 mb-1">
                  <span>Soạn giáo án & Bài giảng tự động</span>
                  <span className="font-semibold">22% (480 lượt)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: '22%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}