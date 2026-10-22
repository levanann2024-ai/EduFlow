import { Fragment, useState } from 'react';
import { 
  AlertTriangle, Calendar, CheckCircle2, Clock3, FileWarning, Search, Users, XCircle,
  BookOpen, ArrowLeft, CheckSquare, TrendingDown, TrendingUp, Minus, Bell, Eye, ChevronDown
} from 'lucide-react';
import { mockClasses as originalMockClasses, mockSchedule, mockStudents } from '@/data';
import type { ClassRoom } from '@/types';

const mockClasses = originalMockClasses;

const classHighlights: Record<string, { lowScoreStudents: number; makeupLessons: number }> = {
  c1: { lowScoreStudents: 2, makeupLessons: 1 },
  c2: { lowScoreStudents: 1, makeupLessons: 0 },
  c3: { lowScoreStudents: 0, makeupLessons: 1 },
  c5: { lowScoreStudents: 3, makeupLessons: 2 },
  c6: { lowScoreStudents: 0, makeupLessons: 0 },
};

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
  { id: 'assignments', label: 'Bài tập', icon: CheckSquare },
];

type Semester = 'Kỳ 1' | 'Kỳ 2';
type StudentInsight = {
  completion: number;
  change: number;
  status: 'good' | 'missing' | 'support';
  detail: string;
};

const demoStudentInsights: Record<Semester, StudentInsight[]> = {
  'Kỳ 1': [
    { completion: 100, change: 0.4, status: 'good', detail: 'Học tốt' },
    { completion: 82, change: 0.2, status: 'missing', detail: 'Chưa nộp Bài tập Hàm số bậc hai' },
    { completion: 40, change: -0.8, status: 'support', detail: 'Cần phụ đạo Phương trình bậc hai' },
    { completion: 90, change: -0.2, status: 'missing', detail: 'Chưa nộp Bài tập chương 2' },
    { completion: 96, change: 0.6, status: 'good', detail: 'Tiến bộ' },
  ],
  'Kỳ 2': [
    { completion: 96, change: 0.3, status: 'good', detail: 'Học tốt' },
    { completion: 78, change: -0.1, status: 'missing', detail: 'Chưa nộp Bài tập tuần 3' },
    { completion: 52, change: 0.2, status: 'support', detail: 'Cần phụ đạo Đồ thị hàm số' },
    { completion: 88, change: 0.1, status: 'good', detail: 'Tiến bộ' },
    { completion: 100, change: 0.5, status: 'good', detail: 'Học tốt' },
  ],
};

const demoSemesterScores: Record<Semester, (number | null)[][]> = {
  'Kỳ 1': [
    [9.2, 9.2, 9.2, 9.2, 9.2, 9.2],
    [8.7, 8.7, 8.7, 8.7, 8.7, 8.7],
    [4.5, 4.5, 4.5, 4.5, 4.5, 4.5],
    [null, 8, 8, null, 9, null],
    [9, null, 8, null, 8.5, 9],
  ],
  'Kỳ 2': [
    [9.4, 9.1, 9.2, 9.4, 9.3, 9.5],
    [8.4, 8.8, null, 8.6, 8.7, null],
    [5, 4.8, 5.2, null, 5.5, null],
    [8, 8.5, 9, null, 8.5, 9],
    [9.5, 9.2, 9.4, 9.3, 9.5, 9.6],
  ],
};

const gradeWeights = [1, 1, 1, 1, 2, 3];

function calculateAverage(scores: (number | null)[]) {
  let weightedTotal = 0;
  let totalWeight = 0;

  scores.forEach((score, index) => {
    if (score !== null && Number.isFinite(score)) {
      weightedTotal += score * gradeWeights[index];
      totalWeight += gradeWeights[index];
    }
  });

  return totalWeight > 0 ? weightedTotal / totalWeight : null;
}

const demoAssignments: Record<string, { title: string; kind: string; due: string; submitted: number; total: number; status: string }[]> = {
  c1: [
    { title: 'Bài tập Hàm số bậc hai', kind: 'Bài tập', due: 'Hạn nộp 24/10/2026', submitted: 32, total: 38, status: 'Đang nhận bài' },
    { title: 'Kiểm tra 15 phút · Chương 2', kind: 'Bài kiểm tra', due: '22/10/2026', submitted: 38, total: 38, status: 'Đã kết thúc' },
  ],
  c2: [
    { title: 'Bài tập Định luật Ohm', kind: 'Bài tập', due: 'Hạn nộp 25/10/2026', submitted: 29, total: 35, status: 'Đang nhận bài' },
    { title: 'Kiểm tra dòng điện', kind: 'Bài kiểm tra', due: '20/10/2026', submitted: 35, total: 35, status: 'Đã kết thúc' },
  ],
  c3: [
    { title: 'Đọc hiểu Vợ chồng A Phủ', kind: 'Bài tập', due: 'Hạn nộp 26/10/2026', submitted: 34, total: 40, status: 'Đang nhận bài' },
    { title: 'Kiểm tra tác phẩm văn học', kind: 'Bài kiểm tra', due: '19/10/2026', submitted: 40, total: 40, status: 'Đã kết thúc' },
  ],
  c5: [
    { title: 'Bài tập Liên kết ion', kind: 'Bài tập', due: 'Hạn nộp 24/10/2026', submitted: 28, total: 36, status: 'Đang nhận bài' },
    { title: 'Kiểm tra cấu tạo nguyên tử', kind: 'Bài kiểm tra', due: '18/10/2026', submitted: 36, total: 36, status: 'Đã kết thúc' },
  ],
  c6: [
    { title: 'Bài tập ADN và gene', kind: 'Bài tập', due: 'Hạn nộp 27/10/2026', submitted: 31, total: 34, status: 'Đang nhận bài' },
    { title: 'Ôn tập di truyền học', kind: 'Bài kiểm tra', due: '21/10/2026', submitted: 34, total: 34, status: 'Đã kết thúc' },
  ],
};

function ClassDetailView({ classData, onBack }: { classData: ClassRoom; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [semester, setSemester] = useState<Semester>('Kỳ 1');
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, string>>({});
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const students = mockStudents.filter((student) => student.classId === classData.id);
  const visibleStudents = Array.from({ length: Math.max(5, students.length) }, (_, index) => (
    students[index] ?? {
      id: `demo-${classData.id}-${index + 1}`,
      name: ['Lê Gia Huy', 'Đỗ Ngọc Mai', 'Phan Minh Tuấn'][index - students.length] ?? `Học sinh ${index + 1}`,
    }
  ));
  const assignments = demoAssignments[classData.id] ?? [];
  const progress = Math.round((classData.completedLessons / classData.totalLessons) * 100);

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
              <h1 className="text-2xl font-bold text-slate-900">{classData.name}</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">Sĩ số: {classData.studentCount} học sinh <span className="px-1.5">·</span> Học kỳ: {classData.semester}</p>
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
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Tiến độ học tập</h3>
                    <p className="mt-1 text-sm text-slate-500">{classData.completedLessons} / {classData.totalLessons} bài đã hoàn thành</p>
                  </div>
                  <span className="text-xl font-bold text-blue-700">{progress}%</span>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </section>
              <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Tổng quan học sinh · {visibleStudents.length} mẫu / {classData.studentCount}</h3>
                    <p className="mt-1 text-xs text-slate-500">Điểm và nhận xét minh họa · Chọn học kỳ để xem, chỉnh điểm</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    Học kỳ
                    <select
                      value={semester}
                      onChange={(event) => {
                        if (event.target.value === 'Kỳ 1' || event.target.value === 'Kỳ 2') {
                          setSemester(event.target.value);
                        }
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="Kỳ 1">Kỳ 1</option>
                      <option value="Kỳ 2">Kỳ 2</option>
                    </select>
                  </label>
                </div>
                {actionMessage && (
                  <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{actionMessage}</p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1500px] border-collapse text-left">
                    <thead>
                      <tr className="border-y border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th rowSpan={2} className="sticky left-0 z-10 bg-slate-50 p-3">TT</th>
                        <th rowSpan={2} className="sticky left-12 z-10 min-w-48 bg-slate-50 p-3">Họ và tên</th>
                        <th colSpan={4} className="p-2 text-center">Điểm chuyên cần</th>
                        <th rowSpan={2} className="p-2 text-center">Giữa kỳ<br />(×2)</th>
                        <th rowSpan={2} className="p-2 text-center">Cuối kỳ<br />(×3)</th>
                        <th rowSpan={2} className="p-2 text-center">Điểm TBM</th>
                        <th rowSpan={2} className="p-2">Tăng / giảm TBM</th>
                        <th rowSpan={2} className="p-2 min-w-36">Tỷ lệ hoàn thành</th>
                        <th rowSpan={2} className="p-2 min-w-56">Đánh giá & cảnh báo</th>
                        <th rowSpan={2} className="p-2 text-center">Thao tác</th>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-500">
                        {[1, 2, 3, 4].map((score) => <th key={score} className="p-2 text-center">CC {score}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {visibleStudents.map((student, index) => {
                        const insight = demoStudentInsights[semester][index % demoStudentInsights[semester].length];
                        const scores = demoSemesterScores[semester][index % demoSemesterScores[semester].length]
                          .map((score, scoreIndex) => {
                            const override = scoreOverrides[`${semester}-${student.id}-${scoreIndex}`];
                            return override === undefined ? score : override === '' ? null : Number(override);
                          });
                        const average = calculateAverage(scores);
                        const baseAverage = calculateAverage(demoSemesterScores[semester][index % demoSemesterScores[semester].length]);
                        const previousAverage = semester === 'Kỳ 2'
                          ? calculateAverage(demoSemesterScores['Kỳ 1'][index % demoSemesterScores['Kỳ 1'].length])
                          : baseAverage === null ? null : baseAverage - insight.change;
                        const change = average === null || previousAverage === null ? null : average - previousAverage;
                        const badgeStyles = {
                          good: 'bg-emerald-50 text-emerald-700',
                          missing: 'bg-amber-50 text-amber-800',
                          support: 'bg-rose-50 text-rose-700',
                        };
                        const StatusIcon = insight.status === 'good' ? CheckCircle2 : insight.status === 'missing' ? AlertTriangle : FileWarning;
                        return (
                          <Fragment key={student.id}>
                            <tr className="hover:bg-slate-50/70">
                              <td className="sticky left-0 bg-white p-3 text-slate-500">{index + 1}</td>
                              <td className="sticky left-12 bg-white p-3 font-semibold text-slate-900">{student.name}</td>
                              {scores.map((score, scoreIndex) => (
                                <td key={scoreIndex} className="p-1.5 text-center">
                                  <input
                                    aria-label={`${student.name}, ${semester}, ${scoreIndex < 4 ? `điểm chuyên cần ${scoreIndex + 1}` : scoreIndex === 4 ? 'điểm giữa kỳ' : 'điểm cuối kỳ'}`}
                                    type="number"
                                    min="0"
                                    max="10"
                                    step="0.1"
                                    value={score === null ? '' : score}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      if (value === '' || (Number(value) >= 0 && Number(value) <= 10)) {
                                        setScoreOverrides((current) => ({ ...current, [`${semester}-${student.id}-${scoreIndex}`]: value }));
                                      }
                                    }}
                                    className="w-14 rounded-md border border-slate-200 px-1.5 py-1 text-center text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                                  />
                                </td>
                              ))}
                              <td className="p-3 text-center font-bold text-slate-900">{average === null ? '—' : average.toFixed(1)}</td>
                              <td className="p-3">
                              {change === null ? (
                                <span className="text-xs text-slate-400">—</span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${change > 0 ? 'text-emerald-700' : change < 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                                  {change > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : change < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                                  {change > 0 ? '+' : ''}{change.toFixed(1)}
                                </span>
                              )}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                                    <div className={`h-full rounded-full ${insight.completion < 60 ? 'bg-rose-500' : insight.completion < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${insight.completion}%` }} />
                                  </div>
                                  <span className="text-xs font-semibold">{insight.completion}%</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${badgeStyles[insight.status]}`}>
                                  <StatusIcon className="h-3.5 w-3.5 shrink-0" />{insight.detail}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {insight.status === 'missing' ? (
                                  <button
                                    onClick={() => setActionMessage(`Đã gửi nhắc nộp bài cho ${student.name}.`)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                                  >
                                    <Bell className="h-3.5 w-3.5" /> Nhắc nộp
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setExpandedStudent((current) => current === student.id ? null : student.id)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <Eye className="h-3.5 w-3.5" /> Chi tiết
                                  </button>
                                )}
                              </td>
                            </tr>
                            {expandedStudent === student.id && (
                              <tr key={`${student.id}-detail`} className="bg-blue-50/50">
                                <td colSpan={13} className="px-4 py-3 text-sm text-slate-700">
                                  {student.name} · Điểm TBM {semester}: {average === null ? 'Chưa có điểm' : average.toFixed(1)} · {insight.detail}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">TBM = tổng điểm thành phần có điểm × hệ số / tổng hệ số tương ứng. Ô để trống không được tính.</p>
              </section>
            </div>
          )}
          {activeTab === 'schedule' && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-lg font-bold text-slate-900">Lịch học lớp {classData.name}</h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[440px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                      <th className="p-3">Thứ</th>
                      <th className="p-3">Giờ học</th>
                      <th className="p-3">Môn học</th>
                      <th className="p-3">Phòng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {mockSchedule.filter((item) => item.className === classData.name).map((item) => (
                      <tr key={item.id}>
                        <td className="p-3 font-medium">{item.day}</td>
                        <td className="p-3">{item.time}</td>
                        <td className="p-3">{item.subject}</td>
                        <td className="p-3">{item.room}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mockSchedule.every((item) => item.className !== classData.name) && (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Lớp chưa có lịch học được cập nhật.</p>
                )}
              </div>
            </div>
          )}
          {activeTab === 'assignments' && (
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-lg font-bold text-slate-900">Bài tập đã giao</h3>
                <p className="mt-1 text-xs text-slate-500">Danh sách demo cho lớp {classData.name}</p>
              </div>
              <div className="divide-y divide-slate-100">
                {assignments.map((assignment) => {
                  const submissions = Array.from({ length: assignment.total }, (_, index) => ({
                    id: students[index]?.id ?? `demo-${classData.id}-${index + 1}`,
                    name: students[index]?.name ?? `Học sinh ${String(index + 1).padStart(2, '0')}`,
                    score: index < assignment.submitted ? Number((10 - ((index * 7) % 51) / 10).toFixed(1)) : null,
                  })).sort((first, second) => {
                    if (first.score === null) return second.score === null ? first.name.localeCompare(second.name, 'vi') : 1;
                    if (second.score === null) return -1;
                    return second.score - first.score;
                  });
                  const isExpanded = expandedAssignment === assignment.title;

                  return (
                    <article key={assignment.title}>
                      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`mt-0.5 rounded-lg p-2 ${assignment.kind === 'Bài kiểm tra' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>
                            {assignment.kind === 'Bài kiểm tra' ? <CheckSquare className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                          </span>
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-semibold text-slate-900">{assignment.title}</h4>
                            <p className="mt-1 text-xs text-slate-500">{assignment.kind} <span className="px-1">·</span> {assignment.due}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                          <span className="text-xs text-slate-600"><strong className="text-slate-900">{assignment.submitted}/{assignment.total}</strong> đã nộp</span>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${assignment.status === 'Đã kết thúc' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{assignment.status}</span>
                          <button
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedAssignment(isExpanded ? null : assignment.title)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
                          >
                            {isExpanded ? 'Thu gọn' : 'Xem danh sách'}
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h5 className="text-sm font-semibold text-slate-800">Danh sách bài làm</h5>
                            <p className="text-xs text-slate-500">Đã nộp xếp theo điểm từ cao xuống thấp · Chưa nộp ở cuối</p>
                          </div>
                          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                              <thead className="sticky top-0 bg-slate-100 text-xs font-semibold text-slate-600">
                                <tr>
                                  <th className="p-2.5">TT</th>
                                  <th className="p-2.5">Họ và tên</th>
                                  <th className="p-2.5 text-right">Điểm</th>
                                  <th className="p-2.5 text-right">Trạng thái</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {submissions.map((submission, index) => (
                                  <tr key={submission.id} className={submission.score === null ? 'text-slate-500' : 'text-slate-700'}>
                                    <td className="p-2.5 text-slate-400">{index + 1}</td>
                                    <td className="p-2.5 font-medium">{submission.name}</td>
                                    <td className="p-2.5 text-right font-semibold">{submission.score === null ? '—' : submission.score.toFixed(1)}</td>
                                    <td className="p-2.5 text-right">
                                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${submission.score === null ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                                        {submission.score === null ? 'Chưa nộp' : 'Đã nộp'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="mt-2 text-[11px] text-slate-400">Điểm và tên học sinh ngoài dữ liệu sẵn có là thông tin minh họa.</p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>

      </div>
    </div>
  );
}

export function ClassManagement() {
  const [selectedClass, setSelectedClass] = useState<ClassRoom | null>(null);
  const classes = mockClasses;

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
    <div className="flex min-h-[calc(100vh-190px)] flex-col gap-4 animate-fadeIn">
      {/* Phần thống kê nhanh bài tập */}
      <div className="border-0 bg-transparent p-0 shadow-none">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-800 sm:text-lg">Thống kê bài tập & kiểm tra</h2>
          <span className="text-[10px] text-slate-400 sm:text-xs">Số liệu mẫu</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {statsData.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.id}
                className={`flex min-h-[84px] items-center gap-3 rounded-xl border border-slate-200/80 p-3 transition-colors hover:border-slate-300 sm:min-h-[96px] sm:p-4 ${stat.bgColor}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm sm:h-10 sm:w-10">
                  <Icon className={`h-5 w-5 ${stat.iconColor}`} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-medium leading-4 text-slate-700 sm:text-sm">{stat.label}</span>
                  <span className={`mt-1 block text-2xl font-bold leading-none tracking-tight sm:text-3xl ${stat.textColor}`}>{stat.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Danh sách lớp học */}
      {classes.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:gap-4">
          {classes.map((item, index) => {
            const highlights = classHighlights[item.id] ?? { lowScoreStudents: 0, makeupLessons: 0 };
            const progress = Math.round((item.completedLessons / item.totalLessons) * 100);
            const cardTones = [
              { border: 'border-l-blue-400', icon: 'bg-blue-50 text-blue-600' },
              { border: 'border-l-emerald-400', icon: 'bg-emerald-50 text-emerald-600' },
              { border: 'border-l-violet-400', icon: 'bg-violet-50 text-violet-600' },
              { border: 'border-l-amber-400', icon: 'bg-amber-50 text-amber-600' },
              { border: 'border-l-cyan-400', icon: 'bg-cyan-50 text-cyan-600' },
              { border: 'border-l-pink-400', icon: 'bg-pink-50 text-pink-600' },
            ][index % 6];
            return (
              <article 
                key={item.id} 
                onClick={() => setSelectedClass(item)}
                className={`group relative flex min-h-[188px] cursor-pointer flex-col justify-between rounded-xl border border-slate-200 border-l-4 bg-white p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-4 ${cardTones.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cardTones.icon}`}>
                      <Users className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold leading-6 text-slate-900 sm:text-xl">{item.name}</h3>
                    </div>
                  </div>
                  <ArrowLeft className="h-4 w-4 shrink-0 rotate-180 text-blue-600 transition-transform group-hover:translate-x-0.5" />
                </div>

                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                    <Users className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate"><strong className="text-slate-900">{item.studentCount}</strong> học sinh</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                    <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">Bài tiếp theo: <strong className="font-medium text-slate-800">{item.nextLesson}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold text-slate-500">{progress}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium ${highlights.lowScoreStudents > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{highlights.lowScoreStudents > 0 ? `${highlights.lowScoreStudents} HS điểm thấp` : 'Không có HS điểm thấp'}</span>
                    </div>
                    <div className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium ${highlights.makeupLessons > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'}`}>
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{highlights.makeupLessons > 0 ? `${highlights.makeupLessons} tiết cần bù` : 'Không cần bù tiết'}</span>
                    </div>
                  </div>
                  <p className="text-right text-[9px] text-slate-400">Thông tin demo</p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="font-semibold text-slate-800 text-lg">Không tìm thấy lớp học phù hợp</p>
          <p className="text-slate-500 text-sm mt-1">Thử thay đổi bộ lọc học kỳ, khối lớp hoặc môn học.</p>
        </div>
      )}
    </div>
  );
}