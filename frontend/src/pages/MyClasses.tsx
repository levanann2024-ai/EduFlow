import { BookOpen, CalendarDays, CheckCircle2 } from 'lucide-react';

const subjects = [
  { name: 'Toán học', teacher: 'Nguyễn Văn An', completed: 18, total: 25, next: 'Hàm số bậc hai' },
  { name: 'Vật lý', teacher: 'Trần Thị Bình', completed: 14, total: 24, next: 'Định luật Ohm' },
  { name: 'Ngữ văn', teacher: 'Lê Hoàng Cường', completed: 22, total: 26, next: 'Vợ chồng A Phủ' },
  { name: 'Hóa học', teacher: 'Phạm Thu Dung', completed: 9, total: 20, next: 'Liên kết ion' },
];

export function MyClasses() {
  return (
    <div className="max-w-5xl space-y-6 animate-fadeIn">
      <section className="card p-6">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
          <div className="w-11 h-11 bg-slate-100 flex items-center justify-center"><BookOpen className="w-5 h-5 text-slate-600" /></div>
          <div><h3 className="text-lg font-semibold text-slate-900">Lớp 10A1</h3><p className="text-sm text-slate-500 mt-1">Giáo viên chủ nhiệm: Nguyễn Văn An • 38 học sinh</p></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-5 text-sm text-slate-600">
          <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-slate-400" />Lịch sinh hoạt: Thứ hai,  tiết 1</p>
          <p className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-slate-400" />Học kỳ 1 đang diễn ra</p>
        </div>
      </section>
      <div><h3 className="text-lg font-semibold text-slate-900">Tiến độ theo môn học</h3><p className="text-sm text-slate-500 mt-1">Số tiết đã hoàn thành trong học kỳ hiện tại.</p></div>
      <div className="grid md:grid-cols-2 gap-5">
        {subjects.map((subject) => {
          const progress = Math.round((subject.completed / subject.total) * 100);
          return <article key={subject.name} className="card p-5"><div className="flex justify-between gap-3"><div><h4 className="font-semibold text-slate-900">{subject.name}</h4><p className="text-sm text-slate-500 mt-1">Giáo viên: {subject.teacher}</p></div><strong className="text-slate-800">{progress}%</strong></div><div className="h-2 bg-slate-100 mt-5"><div className="h-full bg-blue-600" style={{ width: `${progress}%` }} /></div><div className="flex justify-between text-sm text-slate-500 mt-3"><span>{subject.completed}/{subject.total} tiết đã học</span><span>Tiết sau: {subject.next}</span></div></article>;
        })}
      </div>
    </div>
  );
}
