import { useState } from 'react';
import { CalendarDays, ClipboardList, Eye, Plus, Users } from 'lucide-react';
import type { Page } from '@/types';

interface Exam {
  id: string;
  title: string;
  className: string;
  questionCount: number;
  date: string;
  status: 'Đang mở' | 'Bản nháp' | 'Đã kết thúc';
}

const initialExams: Exam[] = [
  { id: 'E-201', title: 'Kiểm tra chương 2', className: '10A1', questionCount: 20, date: '22/10/2026 · 08:00', status: 'Đang mở' },
  { id: 'E-198', title: 'Ôn tập Hàm số bậc hai', className: '10A2', questionCount: 15, date: '24/10/2026 · 09:00', status: 'Bản nháp' },
  { id: 'E-194', title: 'Kiểm tra giữa kỳ', className: '11B3', questionCount: 25, date: '18/10/2026 · 13:30', status: 'Đã kết thúc' },
];

export function ExamManagement({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [exams, setExams] = useState(initialExams);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [className, setClassName] = useState('10A1');
  const [error, setError] = useState('');

  const createExam = () => {
    if (!title.trim()) {
      setError('Nhập tên bài kiểm tra trước khi tạo.');
      return;
    }
    const exam: Exam = {
      id: `E-${Date.now()}`,
      title: title.trim(),
      className,
      questionCount: 0,
      date: 'Chưa lên lịch',
      status: 'Bản nháp',
    };
    setExams((items) => [exam, ...items]);
    setTitle('');
    setError('');
    setCreateOpen(false);
  };

  return (
    <main className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-950">Đề thi & bài kiểm tra</h1>
            <p className="mt-1 text-sm text-slate-500">Tạo đề, sắp lịch và theo dõi trạng thái bài kiểm tra.</p>
          </div>
          <button onClick={() => setCreateOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
            <Plus className="h-4 w-4" /> Tạo bài kiểm tra
          </button>
        </header>

        {createOpen && (
          <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <label className="block text-sm font-medium text-slate-700">
              Tên bài kiểm tra
              <input autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} placeholder="Ví dụ: Kiểm tra chương 3" className="input-field mt-1.5" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Lớp
              <select value={className} onChange={(event) => setClassName(event.target.value)} className="input-field mt-1.5">
                <option>10A1</option><option>10A2</option><option>11B3</option>
              </select>
            </label>
            <button onClick={createExam} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">Tạo bản nháp</button>
            {error && <p role="alert" className="text-sm text-rose-700 sm:col-span-3">{error}</p>}
            <p className="text-sm text-slate-500 sm:col-span-3">Thêm câu hỏi từ <button onClick={() => onNavigate('question-bank')} className="font-semibold text-blue-700 hover:underline">Ngân hàng câu hỏi</button> sau khi tạo.</p>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {exams.map((exam) => (
            <article key={exam.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-900">{exam.title}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${exam.status === 'Đang mở' ? 'bg-emerald-50 text-emerald-800' : exam.status === 'Bản nháp' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{exam.status}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{exam.className}</span>
                  <span className="inline-flex items-center gap-1.5"><ClipboardList className="h-4 w-4" />{exam.questionCount} câu</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{exam.date}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => onNavigate('question-bank')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Sửa đề</button>
                <button onClick={() => onNavigate('exam-monitor')} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"><Eye className="h-4 w-4" />Giám sát</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
