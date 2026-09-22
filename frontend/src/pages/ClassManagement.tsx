import { useMemo, useState } from 'react';
import { 
  Calendar, CheckCircle2, Clock3, FileWarning, Search, Users, XCircle, 
  BookOpen, GraduationCap, ArrowLeft, Bell, MessageSquare, CheckSquare, BarChart2 
} from 'lucide-react';
import { mockClasses as originalMockClasses } from '@/data';

// Thêm 1 lớp ví dụ có tiến độ 100% để test ngay giao diện Ant Design
const mockClasses = [
  ...originalMockClasses,
  {
    id: 'test-100-percent',
    name: 'Lớp 10A9',
    subject: 'Toán học',
    grade: 'Khối 10',
    semester: 'Kỳ 1',
    studentCount: 40,
    completedLessons: 35,
    totalLessons: 35, // 100% hoàn thành
    isHomeroom: false,
    schedule: 'Thứ 3, Tiết 4-5',
    nextLesson: 'Đã hoàn thành chương trình học kỳ'
  }
];

const semesters = ['Kỳ 1', 'Kỳ 2'] as const;
const grades = ['Tất cả khối', 'Khối 10', 'Khối 11', 'Khối 12'] as const;

type StatItem = {
  id: number;
  label: string;
  value: number | string;
  icon: React.ElementType;
  bgColor: string;
  textColor: string;
  iconColor: string;
};

// Component Chi Tiết Lớp Học
const tabs = [
  { id: 'overview', label: 'Thông tin chung', icon: BookOpen },
  { id: 'schedule', label: 'Lịch học', icon: Calendar },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'forum', label: 'Diễn đàn', icon: MessageSquare },
  { id: 'assignments', label: 'Bài tập, bài kiểm tra', icon: CheckSquare },
  { id: 'grades', label: 'Kết quả học tập', icon: BarChart2 },
];

function ClassDetailView({ classData, onBack }: { classData: any; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState('overview');
  const isCompleted = classData.completedLessons >= classData.totalLessons;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <button 
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách lớp
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{classData.name} - {classData.subject}</h1>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                Đang hoạt động
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Khối: {classData.grade} • Sĩ số: {classData.studentCount} học sinh • Học kỳ: {classData.semester}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-2 border-b border-slate-100 pt-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-all cursor-pointer ${
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

      {/* Nội dung Tab */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Danh sách học sinh ({classData.studentCount})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/50">
                      <th className="p-3">TT</th>
                      <th className="p-3">Mã học sinh</th>
                      <th className="p-3">Họ và tên</th>
                      <th className="p-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                    {[1, 2, 3, 4, 5].map((idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="p-3 text-slate-500">{idx}</td>
                        <td className="p-3 font-medium text-blue-600">HS20260{idx}</td>
                        <td className="p-3 font-medium text-slate-900">Học sinh ví dụ {idx}</td>
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
          )}
          {activeTab !== 'overview' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
              <p className="text-slate-500 font-medium">Nội dung tab [{tabs.find(t => t.id === activeTab)?.label}] đang cập nhật.</p>
            </div>
          )}
        </div>

        {/* Sidebar thông tin lớp */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Tiến độ chương trình</h3>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Tiến trình:</span>
                <span className="font-semibold text-slate-900">{classData.completedLessons} / {classData.totalLessons}</span>
              </div>
              
              {/* Thanh tiến trình chuẩn Ant Design style */}
              <div className="ant-progress-outer flex items-center gap-2" style={{ width: '100%' }}>
                <div className="ant-progress-inner flex-1 bg-slate-100 rounded-full overflow-hidden" style={{ height: '6px' }}>
                  <div 
                    className="ant-progress-bg ant-progress-bg-outer rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${Math.min(100, Math.round((classData.completedLessons / classData.totalLessons) * 100))}%`, 
                      height: '6px', 
                      background: isCompleted ? '#52c41a' : '#2563eb' 
                    }} 
                  />
                </div>
                {isCompleted && (
                  <span className="ant-progress-text ant-progress-text-end ant-progress-text-outer shrink-0">
                    <span role="img" aria-label="check-circle" className="anticon anticon-check-circle text-[#52c41a] flex items-center justify-center">
                      <svg viewBox="64 64 896 896" focusable="false" data-icon="check-circle" width="18px" height="18px" fill="currentColor" aria-hidden="true">
                        <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm193.5 301.7l-210.6 292a31.8 31.8 0 01-51.7 0L318.5 484.9c-3.8-5.3 0-12.7 6.5-12.7h46.9c10.2 0 19.9 4.9 25.9 13.3l71.2 98.8 157.2-218c6-8.3 15.6-13.3 25.9-13.3H699c6.5 0 10.3 7.4 6.5 12.7z"></path>
                      </svg>
                    </span>
                  </span>
                )}
              </div>

              <p className="pt-2"><strong className="text-slate-800">Lịch:</strong> {classData.schedule}</p>
              <p><strong className="text-slate-800">Tiết tiếp theo:</strong> {classData.nextLesson}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClassManagement() {
  const [semester, setSemester] = useState<(typeof semesters)[number]>('Kỳ 1');
  const [grade, setGrade] = useState<(typeof grades)[number]>('Tất cả khối');
  const [selectedSubject, setSelectedSubject] = useState<string>('Tất cả môn');
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState<any>(null);

  const subjects = useMemo(() => {
    const list = Array.from(new Set(mockClasses.map(item => item.subject)));
    return ['Tất cả môn', ...list];
  }, []);

  const classes = useMemo(() => mockClasses.filter((item) => (
    item.semester === semester
    && (grade === 'Tất cả khối' || item.grade === grade)
    && (selectedSubject === 'Tất cả môn' || item.subject === selectedSubject)
    && `${item.name} ${item.subject}`.toLowerCase().includes(search.toLowerCase())
  )), [grade, search, semester, selectedSubject]);

  const statsData: StatItem[] = [
    {
      id: 1,
      label: 'Bài tập đã giao',
      value: 1,
      icon: CheckCircle2,
      bgColor: 'bg-amber-50/80',
      textColor: 'text-amber-600',
      iconColor: 'text-amber-500'
    },
    {
      id: 2,
      label: 'Bài nộp chờ chấm',
      value: 17,
      icon: FileWarning,
      bgColor: 'bg-emerald-50/80',
      textColor: 'text-emerald-600',
      iconColor: 'text-emerald-500'
    },
    {
      id: 3,
      label: 'Đã chấm điểm',
      value: 0,
      icon: Clock3,
      bgColor: 'bg-sky-50/80',
      textColor: 'text-sky-600',
      iconColor: 'text-sky-500'
    },
    {
      id: 4,
      label: 'Học sinh chưa nộp',
      value: 51,
      icon: XCircle,
      bgColor: 'bg-rose-50/80',
      textColor: 'text-rose-600',
      iconColor: 'text-rose-500'
    },
  ];

  if (selectedClass) {
    return <ClassDetailView classData={selectedClass} onBack={() => setSelectedClass(null)} />;
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Phần tiêu đề và bộ lọc */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <input 
            value={search} 
            onChange={(event) => setSearch(event.target.value)} 
            className="input-field w-50 rounded-xl border-slate-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" 
            placeholder="Tìm tên lớp..." 
          />
          <select 
            value={selectedSubject} 
            onChange={(event) => setSelectedSubject(event.target.value)} 
            className="input-field w-auto rounded-xl border-slate-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          >
            {subjects.map((subj) => <option key={subj} value={subj}>{subj}</option>)}
          </select>
          <select 
            value={semester} 
            onChange={(event) => setSemester(event.target.value as typeof semester)} 
            className="input-field w-auto rounded-xl border-slate-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          >
            {semesters.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select 
            value={grade} 
            onChange={(event) => setGrade(event.target.value as typeof grade)} 
            className="input-field w-auto rounded-xl border-slate-200 bg-white shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          >
            {grades.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </div>

      {/* Phần thống kê nhanh bài tập */}
      <div className="card p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 border border-slate-100 shadow-sm rounded-2xl bg-white">
        <div className="col-span-full flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-slate-800">Thống kê bài tập & kiểm tra</h3>
          <span className="text-xs text-slate-400">Cập nhật theo thời gian thực</span>
        </div>
        
        {statsData.map((stat) => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.id} 
              className={`p-5 rounded-2xl border border-slate-200/80 ${stat.bgColor} flex flex-col justify-between gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-slate-300`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white shadow-sm">
                  <Icon className={`w-5 h-5 ${stat.iconColor}`} strokeWidth={2} />
                </div>
                <span className="text-slate-700 text-sm font-medium">{stat.label}</span>
              </div>
              <div className={`text-4xl font-bold ${stat.textColor} tabular-nums tracking-tight`}>
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Danh sách lớp học */}
      {classes.length > 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {classes.map((item) => {
            const isCompleted = item.completedLessons >= item.totalLessons;
            return (
              <article 
                key={item.id} 
                onClick={() => setSelectedClass(item)}
                className="card p-6 space-y-5 rounded-2xl border border-slate-200/80 bg-white flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 inline-block mb-2">
                        {item.grade}
                      </span>
                      <h3 className="text-xl font-bold text-slate-900">{item.name}</h3>
                      <p className="text-sm font-medium text-blue-600 mt-0.5 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" /> {item.subject}
                      </p>
                    </div>
                    {item.isHomeroom && (
                      <span className="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60 px-3 py-1 rounded-full shadow-2xs">
                        Chủ nhiệm
                      </span>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
                    <span className="flex items-center gap-2 font-medium">
                      <Users className="w-4 h-4 text-slate-400" /> Sĩ số:
                    </span>
                    <span className="font-semibold text-slate-900">{item.studentCount} học sinh</span>
                  </div>
                </div>
                
                {/* Tiến độ chương trình (Chuẩn Ant Design style) */}
                <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Tiến trình:</span>
                    <strong className="text-slate-800">{item.completedLessons} / {item.totalLessons}</strong>
                  </div>
                  
                  <div className="ant-progress-outer flex items-center gap-2" style={{ width: '100%' }}>
                    <div className="ant-progress-inner flex-1 bg-slate-200/70 rounded-full overflow-hidden" style={{ height: '6px' }}>
                      <div 
                        className="ant-progress-bg ant-progress-bg-outer rounded-full transition-all duration-500" 
                        style={{ 
                          width: `${Math.min(100, Math.round((item.completedLessons / item.totalLessons) * 100))}%`, 
                          height: '6px', 
                          background: isCompleted ? '#52c41a' : '#2563eb' 
                        }} 
                      />
                    </div>
                    {isCompleted && (
                      <span className="ant-progress-text ant-progress-text-end ant-progress-text-outer shrink-0">
                        <span role="img" aria-label="check-circle" className="anticon anticon-check-circle text-[#52c41a] flex items-center justify-center">
                          <svg viewBox="64 64 896 896" focusable="false" data-icon="check-circle" width="16px" height="16px" fill="currentColor" aria-hidden="true">
                            <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm193.5 301.7l-210.6 292a31.8 31.8 0 01-51.7 0L318.5 484.9c-3.8-5.3 0-12.7 6.5-12.7h46.9c10.2 0 19.9 4.9 25.9 13.3l71.2 98.8 157.2-218c6-8.3 15.6-13.3 25.9-13.3H699c6.5 0 10.3 7.4 6.5 12.7z"></path>
                          </svg>
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>Hoàn thành</span>
                    <span className={`font-medium ${isCompleted ? 'text-[#52c41a]' : 'text-slate-600'}`}>
                      {Math.round((item.completedLessons / item.totalLessons) * 100)}%
                    </span>
                  </div>
                </div>
                
                {/* Lịch học & Tiết tiếp theo */}
                <div className="space-y-2 text-xs text-slate-600 pt-1">
                  <p className="flex items-center gap-2.5 truncate">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{item.schedule}</span>
                  </p>
                  <p className="flex items-center gap-2.5 truncate">
                    <Clock3 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Tiết kế tiếp: <span className="text-slate-900 font-medium">{item.nextLesson}</span></span>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card p-16 text-center border border-slate-200/80 rounded-2xl bg-white shadow-sm">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="font-semibold text-slate-800 text-lg">Không tìm thấy lớp học phù hợp</p>
          <p className="text-slate-500 text-sm mt-1">Thử thay đổi bộ lọc học kỳ, khối lớp hoặc môn học.</p>
        </div>
      )}
    </div>
  );
}