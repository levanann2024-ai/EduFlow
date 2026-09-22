import { useState } from 'react';
import { 
  BookOpen, Calendar, Users, FileText, Bell, 
  MessageSquare, CheckSquare, BarChart2, ArrowLeft, Download, RefreshCw 
} from 'lucide-react';

// Danh sách các tab mô phỏng theo ảnh của bạn
const tabs = [
  { id: 'overview', label: 'Thông tin chung', icon: BookOpen },
  { id: 'schedule', label: 'Lịch học', icon: Calendar },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'forum', label: 'Diễn đàn', icon: MessageSquare },
  { id: 'assignments', label: 'Bài tập, bài kiểm tra', icon: CheckSquare },
  { id: 'grades', label: 'Kết quả học tập', icon: BarChart2 },
];

export function ClassDetail({ classData, onBack }: { classData: any; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Phần Header phía trên cùng */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <button 
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách lớp
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{classData.name} - {classData.subject}</h1>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                Đang học
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Mã học phần: <span className="text-slate-800 font-medium">THPT_{classData.id}</span> • Khối: {classData.grade} • Sĩ số: {classData.studentCount} học sinh
            </p>
          </div>
        </div>

        {/* Thanh Tabs chuyển đổi */}
        <div className="flex overflow-x-auto gap-2 border-b border-slate-100 pt-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                  isActive 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Nội dung thay đổi tùy theo Tab đang chọn */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột chính bên trái (chiếm 2 phần) */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Khối giới thiệu */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Giới thiệu lớp học</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Trang quản lý chính của lớp {classData.name}. Giáo viên có thể theo dõi tiến độ chương trình, quản lý danh sách học sinh và giao bài tập trực tuyến tại đây.
                </p>
              </div>

              {/* Khối danh sách học sinh (Mô phỏng bảng như ảnh của bạn) */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Danh sách học sinh ({classData.studentCount})</h3>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">
                      <Download className="w-3.5 h-3.5" /> Xuất dữ liệu
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/50">
                        <th className="p-3">TT</th>
                        <th className="p-3">Mã học sinh</th>
                        <th className="p-3">Họ và tên</th>
                        <th className="p-3 text-center">Điểm thưởng</th>
                        <th className="p-3 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                      {/* Dữ liệu giả lập danh sách học sinh */}
                      {[1, 2, 3, 4, 5].map((idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="p-3 text-slate-500">{idx}</td>
                          <td className="p-3 font-medium text-blue-600">HS20260{idx}</td>
                          <td className="p-3 font-medium text-slate-900">Nguyễn Văn Học {idx}</td>
                          <td className="p-3 text-center font-semibold text-slate-800">0</td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-md">
                              Đang học
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab !== 'overview' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
              <p className="text-slate-500 font-medium">Nội dung của mục [{tabs.find(t => t.id === activeTab)?.label}] đang được cập nhật...</p>
            </div>
          )}
        </div>

        {/* Cột phụ bên phải (chiếm 1 phần - Thông tin buổi học tiếp theo & Thông báo) */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Buổi học tiếp theo</h3>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-500">Tiến độ:</span>
                <span className="font-semibold text-slate-900">{Math.round((classData.completedLessons / classData.totalLessons) * 100)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${Math.round((classData.completedLessons / classData.totalLessons) * 100)}%` }} />
              </div>
              <p className="pt-2"><strong className="text-slate-800">Lịch:</strong> {classData.schedule}</p>
              <p><strong className="text-slate-800">Tiết tiếp theo:</strong> {classData.nextLesson}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Thông báo gần đây</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100">
                <p className="font-semibold text-blue-900">Nhắc nhở nộp bài tập</p>
                <p className="text-slate-500 mt-1">Học sinh hoàn thành bài tập tuần trước trước hạn.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}