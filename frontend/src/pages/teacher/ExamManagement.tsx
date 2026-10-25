import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Copy, Eye, FileText, Plus, Search, Trash2 } from 'lucide-react';
import type { Page } from '@/types';
import { readSavedExams, writeSavedExams, type SavedExam } from '@/pages/teacher/assessmentStorage';
import { ExamEditor } from '@/pages/teacher/ExamEditor';

export function ExamManagement({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [exams, setExams] = useState<SavedExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<SavedExam | null>(null);
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    try {
      setExams(readSavedExams());
    } catch (loadError) {
      console.error('Không thể đọc danh sách đề đã lưu trên thiết bị.', loadError);
      setError('Không đọc được dữ liệu đề thi trong trình duyệt.');
    } finally {
      setLoading(false);
    }
  }, []);

  const subjects = useMemo(() => [...new Set(exams.map((exam) => exam.subject))].sort(), [exams]);
  const grades = useMemo(() => [...new Set(exams.map((exam) => exam.grade))].sort(), [exams]);
  const filteredExams = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return exams.filter((exam) => (
      (!normalized || `${exam.title} ${exam.topic} ${exam.subject} ${exam.grade}`.toLocaleLowerCase('vi').includes(normalized))
      && (!subjectFilter || exam.subject === subjectFilter)
      && (!gradeFilter || exam.grade === gradeFilter)
      && (!statusFilter || (exam.status ?? 'draft') === statusFilter)
    ));
  }, [exams, gradeFilter, query, statusFilter, subjectFilter]);

  const persist = (next: SavedExam[], successMessage: string) => {
    try {
      writeSavedExams(next);
      setExams(next);
      setError('');
      setFeedback(successMessage);
      return true;
    } catch (saveError) {
      console.error('Không thể cập nhật danh sách đề đã lưu trên thiết bị.', saveError);
      setError('Không lưu được thay đổi. Hãy kiểm tra dung lượng lưu trữ của trình duyệt.');
      setFeedback('');
      return false;
    }
  };

  const deleteExam = (exam: SavedExam) => {
    if (!window.confirm(`Bạn có chắc muốn xóa đề "${exam.title}"?`)) return;
    if (persist(exams.filter((item) => item.id !== exam.id), 'Đã xóa đề thi.')) {
      if (selectedExam?.id === exam.id) setSelectedExam(null);
    }
  };

  const duplicateExam = (exam: SavedExam) => {
    const copiedAt = Date.now();
    const copy: SavedExam = {
      ...exam,
      id: `exam-${copiedAt}`,
      title: `${exam.title} (bản sao)`,
      createdAt: new Date().toLocaleDateString('vi-VN'),
      status: 'draft',
      questions: exam.questions.map((question, index) => ({ ...question, id: `copy-${copiedAt}-${index}` })),
    };
    persist([copy, ...exams], 'Đã sao chép đề thi.');
  };

  const saveExam = (updated: SavedExam, status: 'draft' | 'ready') => {
    const nextExam = { ...updated, status };
    if (persist(exams.map((exam) => exam.id === nextExam.id ? nextExam : exam), status === 'ready' ? 'Đề đã sẵn sàng sử dụng.' : 'Đã lưu bản nháp.')) {
      setSelectedExam(null);
    }
  };

  return (
    <main className="space-y-4">
      <div>
        <button onClick={() => onNavigate('lesson-builder')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
          <Plus className="h-4 w-4" /> Soạn bài kiểm tra
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {feedback && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid gap-2 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(135px,190px))]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên đề, chủ đề..." className="input-field pl-9" />
          </label>
          <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="input-field">
            <option value="">Tất cả môn học</option>
            {subjects.map((subject) => <option key={subject}>{subject}</option>)}
          </select>
          <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="input-field">
            <option value="">Tất cả khối lớp</option>
            {grades.map((grade) => <option key={grade}>{grade}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input-field">
            <option value="">Mọi trạng thái</option>
            <option value="draft">Bản nháp</option>
            <option value="ready">Sẵn sàng sử dụng</option>
          </select>
        </div>

        {loading ? (
          <p className="p-10 text-center text-sm text-slate-500">Đang tải đề đã lưu...</p>
        ) : filteredExams.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
            <FileText className="h-8 w-8 text-slate-300" />
            <h2 className="mt-3 font-semibold text-slate-800">{exams.length ? 'Không tìm thấy đề phù hợp' : 'Chưa có đề thi được lưu'}</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">{exams.length ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Tạo và lưu đề trong tab Bài kiểm tra của Soạn bài với AI. Đề được lưu trên trình duyệt này.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredExams.map((exam) => (
              <article key={exam.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{exam.title}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${(exam.status ?? 'draft') === 'ready' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{(exam.status ?? 'draft') === 'ready' ? 'Sẵn sàng sử dụng' : 'Bản nháp'}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{exam.subject} - {exam.grade} - {exam.topic}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><ClipboardList className="h-4 w-4" />{exam.questions.length} câu</span>
                    <span>{exam.questions.reduce((total, question) => total + question.points, 0)} điểm</span>
                    <span>{exam.durationMinutes ? `${exam.durationMinutes} phút` : 'Chưa đặt thời lượng'}</span>
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{exam.createdAt}</span>
                  </div>
                  {exam.structureSummary && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{exam.structureSummary.join(' - ')}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <button onClick={() => setSelectedExam(exam)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" /> Mở đề</button>
                  <button onClick={() => duplicateExam(exam)} aria-label={`Sao chép đề ${exam.title}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><Copy className="h-4 w-4" /></button>
                  <button onClick={() => deleteExam(exam)} aria-label={`Xóa đề ${exam.title}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
                  <button type="button" disabled title="Chức năng tạo phòng thi chưa được triển khai." className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400">Tạo phòng thi - chưa khả dụng</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedExam && <ExamEditor exam={selectedExam} onClose={() => setSelectedExam(null)} onSave={saveExam} />}
    </main>
  );
}
