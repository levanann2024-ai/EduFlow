import { AlertTriangle, TrendingUp, TrendingDown, Users, Clock, Target, Sparkles, ChevronRight, Server } from 'lucide-react';
import { mockClasses, mockStudents, atRiskStudents, weeklyProgress } from '@/data';
import type { Role } from '@/types';

interface AnalyticsProps {
  role?: Role;
}

export function Analytics({ role }: AnalyticsProps) {
  const roleStr = String(role).toLowerCase();
  const isAdmin = roleStr.includes('admin') || roleStr.includes('quản trị') || roleStr === 'admin';

  // --- NẾU LÀ QUẢN TRỊ VIÊN (HIỂN THỊ THỐNG KÊ VĨ MÔ HỆ THỐNG) ---
  if (isAdmin) {
    return (
      <div className="space-y-5 animate-fadeIn">
        {/* KPI Cards cho Admin */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4 bg-white">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">1,245</p>
            <p className="text-sm text-slate-500 mt-0.5">Tổng số người dùng</p>
          </div>
          <div className="card p-4 bg-white">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">42</p>
            <p className="text-sm text-slate-500 mt-0.5">Tổng số lớp học</p>
          </div>
          <div className="card p-4 bg-white">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">358</p>
            <p className="text-sm text-slate-500 mt-0.5">Tài liệu & Giáo án</p>
          </div>
          <div className="card p-4 bg-white">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">18,450</p>
            <p className="text-sm text-slate-500 mt-0.5">Tổng lượt gọi API AI (Tháng)</p>
          </div>
        </div>

        {/* Biểu đồ & Tình trạng hệ thống */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-5 bg-white lg:col-span-2">
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Mức độ sử dụng tính năng AI toàn hệ thống</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-slate-600 mb-1">
                  <span>Tạo câu hỏi trắc nghiệm tự động</span>
                  <span className="font-semibold">64% (11,800 lượt)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full rounded-full" style={{ width: '64%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm text-slate-600 mb-1">
                  <span>Soạn giáo án & Slide tự động</span>
                  <span className="font-semibold">22% (4,050 lượt)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: '22%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm text-slate-600 mb-1">
                  <span>Trợ lý AI hỏi đáp 24/7</span>
                  <span className="font-semibold">14% (2,600 lượt)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: '14%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5 bg-white">
            <h3 className="font-semibold text-slate-900 text-sm mb-3 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-blue-600" /> Trạng thái hạ tầng AI
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600">Google Gemini API:</span>
                <span className="font-semibold text-green-600">Hoạt động ổn định</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600">Độ trễ trung bình:</span>
                <span className="font-semibold text-slate-800">380ms</span>
              </div>
              <div className="flex justify-between p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600">Dung lượng lưu trữ:</span>
                <span className="font-semibold text-slate-800">42.8 GB / 500 GB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nhật ký hoạt động hệ thống gần đây */}
        <div className="card overflow-hidden bg-white">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 text-sm">Nhật ký hoạt động hệ thống (System Audit Log)</h3>
            <p className="text-sm text-slate-400 mt-0.5">Theo dõi lịch sử thao tác của các tài khoản trên hệ thống</p>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
              <span className="text-slate-700"><strong>Thầy Nguyễn Văn An</strong> đã tạo một bộ đề trắc nghiệm Vật lý 10.</span>
              <span className="text-slate-400">10 phút trước</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
              <span className="text-slate-700"><strong>Cô Trần Thị Bình</strong> đã xuất file giáo án chương 3.</span>
              <span className="text-slate-400">25 phút trước</span>
            </div>
            <div className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-50">
              <span className="text-slate-700">Hệ thống đã tự động sao lưu dữ liệu định kỳ (Auto-backup).</span>
              <span className="text-slate-400">2 giờ trước</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- NẾU LÀ GIẢNG VIÊN (GIỮ NGUYÊN GIAO DIỆN PHÂN TÍCH HỌC SINH) ---
  const avgScore = (mockStudents.reduce((s, st) => s + st.avgScore, 0) / mockStudents.length).toFixed(1);
  const avgAttendance = Math.round(mockStudents.reduce((s, st) => s + st.attendance, 0) / mockStudents.length);
  const maxLessons = Math.max(...weeklyProgress.map((d) => d.lessons));

  const stats = [
    { label: 'Điểm trung bình', value: avgScore, icon: Target, up: true, change: '+0.3' },
    { label: 'Tỷ lệ chuyên cần', value: `${avgAttendance}%`, icon: Clock, up: true, change: '+2%' },
    { label: 'Tỷ lệ hoàn thành', value: '78%', icon: TrendingUp, up: true, change: '+5%' },
    { label: 'Học sinh nguy cơ cao', value: atRiskStudents.filter((s) => s.risk === 'high').length, icon: AlertTriangle, up: false, change: '-1' },
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-slate-500" />
                </div>
                <span className={`badge ${stat.up ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-600'}`}>
                  {stat.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{stat.value}</p>
              <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly activity chart */}
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Hoạt động học tập trong tuần</h3>
              <p className="text-sm text-slate-400 mt-0.5">Số tiết học và học sinh tham gia</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600" /> Tiết học</span>
              <span className="flex items-center gap-1.5 text-slate-500"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> Học sinh</span>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 sm:gap-4 h-40">
            {weeklyProgress.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex items-end gap-1 h-32">
                  <div className="flex-1 bg-slate-100 rounded-t flex items-end overflow-hidden">
                    <div className="w-full bg-blue-600 rounded-t transition-all duration-300" style={{ height: `${(d.lessons / maxLessons) * 100}%` }} />
                  </div>
                  <div className="flex-1 bg-slate-100 rounded-t flex items-end overflow-hidden">
                    <div className="w-full bg-slate-400 rounded-t transition-all duration-300" style={{ height: `${(d.students / 100) * 100}%` }} />
                  </div>
                </div>
                <span className="text-sm font-medium text-slate-400">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI insights */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Gợi ý từ AI</h3>
              <p className="text-sm text-slate-400">Phân tích và đề xuất</p>
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="p-3 rounded-md bg-amber-50 border border-amber-100">
              <p className="text-sm font-semibold text-amber-700 mb-1">Cần chú ý</p>
              <p className="text-sm text-amber-900/80">2 học sinh có nguy cơ sa sút cao. Cần liên hệ phụ huynh và đề xuất kế hoạch ôn tập cá nhân.</p>
            </div>
            <div className="p-3 rounded-md bg-blue-50 border border-blue-100">
              <p className="text-sm font-semibold text-blue-700 mb-1">Đề xuất</p>
              <p className="text-sm text-blue-900/80">Lớp 11B3 tiến độ 58% — nên tăng cường bài luyện tập chương 3 Vật lý.</p>
            </div>
            <div className="p-3 rounded-md bg-green-50 border border-green-100">
              <p className="text-sm font-semibold text-green-700 mb-1">Tích cực</p>
              <p className="text-sm text-green-900/80">Lớp 11A1 đạt tiến độ 91% — có thể chuyển sang chủ đề mới sớm.</p>
            </div>
          </div>
        </div>
      </div>

      {/* At-risk students table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Học sinh có nguy cơ học tập sa sút</h3>
            <p className="text-sm text-slate-400 mt-0.5">AI dự đoán dựa trên điểm số, chuyên cần và tiến độ</p>
          </div>
          <Users className="w-4 h-4 text-slate-300" />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">Học sinh</th>
              <th className="text-left px-4 py-2 text-sm font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Lớp</th>
              <th className="text-right px-4 py-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">Điểm TB</th>
              <th className="text-right px-4 py-2 text-sm font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Chuyên cần</th>
              <th className="text-left px-4 py-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">Mức độ</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {atRiskStudents.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{s.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">{s.class}</td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right tabular-nums">{s.avgScore}</td>
                <td className="px-4 py-3 text-sm text-slate-500 text-right tabular-nums hidden sm:table-cell">{s.attendance}%</td>
                <td className="px-4 py-3">
                  <span className={`badge ${s.risk === 'high' ? 'bg-rose-50 text-rose-600' : s.risk === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                    {s.risk === 'high' ? 'Nguy cơ cao' : s.risk === 'medium' ? 'Cần theo dõi' : 'Ổn định'}
                  </span>
                </td>
                <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-slate-300" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Class progress table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">Tiến độ theo lớp</h3>
          <p className="text-sm text-slate-400 mt-0.5">Tỷ lệ hoàn thành chương trình</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">Lớp</th>
              <th className="text-left px-4 py-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">Môn</th>
              <th className="text-left px-4 py-2 text-sm font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Sĩ số</th>
              <th className="text-left px-4 py-2 text-sm font-semibold text-slate-500 uppercase tracking-wider">Tiến độ</th>
            </tr>
          </thead>
          <tbody>
            {mockClasses.map((cls) => (
              <tr key={cls.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5">
                  <span className="text-sm font-semibold text-slate-800">{cls.name}</span>
                  <span className="text-sm text-slate-400 ml-1.5">{cls.grade}</span>
                </td>
                <td className="px-4 py-2.5 text-sm text-slate-600">{cls.subject}</td>
                <td className="px-4 py-2.5 text-sm text-slate-500 tabular-nums hidden sm:table-cell">{cls.studentCount}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 w-28">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${cls.progress}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-600 tabular-nums w-8 text-right">{cls.progress}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}