import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Eye, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { deleteTeacherAssessment, saveTeacherAssessment } from '@/api/schoolApi';
import { loadTeacherAssessments, type SavedExam } from '@/pages/teacher/assessmentStorage';
import { ExamEditor } from '@/pages/teacher/ExamEditor';

function examReady(exam: SavedExam) {
  return exam.status === 'ready'
    && exam.questions.length > 0
    && exam.questions.every((question) => question.question.trim() && question.points > 0);
}

export function ExamManagement({ onCreateExamRoom }: { onCreateExamRoom: (exam: SavedExam) => void }) {
  const [exams, setExams] = useState<SavedExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<SavedExam | null>(null);
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let active = true;
    loadTeacherAssessments('exam')
      .then((items) => { if (active) setExams(items); })
      .catch((loadError: unknown) => {
        console.error('Không thể tải danh sách đề đã lưu từ máy chủ.', loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : 'Không thể tải đề thi đã lưu.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const grades = useMemo(() => [...new Set(exams.map((exam) => exam.grade))].sort(), [exams]);
  const filteredExams = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return exams.filter((exam) => (
      (!normalized || `${exam.title} ${exam.topic} ${exam.subject} ${exam.grade}`.toLocaleLowerCase('vi').includes(normalized))
      && (!gradeFilter || exam.grade === gradeFilter)
      && (!statusFilter || (exam.status ?? 'draft') === statusFilter)
    )).sort((a, b) => Number((b.status ?? 'draft') === 'ready') - Number((a.status ?? 'draft') === 'ready'));
  }, [exams, gradeFilter, query, statusFilter]);

  const persist = async (exam: SavedExam, successMessage: string) => {
    try {
      const saved = await saveTeacherAssessment('exam', exam);
      setExams((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setError('');
      setFeedback(successMessage);
      return true;
    } catch (saveError) {
      console.error('Không thể lưu đề thi vào cơ sở dữ liệu.', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu đề thi vào cơ sở dữ liệu.');
      setFeedback('');
      return false;
    }
  };

  const deleteExam = async (exam: SavedExam) => {
    if (!window.confirm(`Bạn có chắc muốn xóa đề "${exam.title}"?`)) return;
    try {
      await deleteTeacherAssessment('exam', exam.id);
      setExams((current) => current.filter((item) => item.id !== exam.id));
      setError('');
      setFeedback('Đã xóa đề thi.');
      if (selectedExam?.id === exam.id) setSelectedExam(null);
    } catch (deleteError) {
      console.error('Không thể xóa đề thi khỏi cơ sở dữ liệu.', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa đề thi.');
      setFeedback('');
    }
  };

  const saveExam = async (updated: SavedExam, status: 'draft' | 'ready') => {
    const nextExam = { ...updated, status };
    if (await persist(nextExam, status === 'ready' ? 'Đề đã sẵn sàng sử dụng.' : 'Đã lưu bản nháp.')) {
      setSelectedExam(null);
    }
  };

  const createExam = () => {
    const createdAt = Date.now();
    setError('');
    setFeedback('');
    setSelectedExam({
      id: `exam-${createdAt}`,
      title: '',
      topic: '',
      subject: '',
      grade: '',
      createdAt: new Date(createdAt).toLocaleDateString('vi-VN'),
      durationMinutes: null,
      questions: [],
      status: 'draft',
    });
  };

  return (
    <main className="space-y-4">
      <div className="flex justify-end">
        <button onClick={createExam} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
          <Plus className="h-4 w-4" /> Soạn bài kiểm tra
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {feedback && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid gap-2 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_repeat(2,minmax(135px,190px))]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên đề, chủ đề..." className="input-field pl-9" />
          </label>
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
            <p className="mt-1 max-w-md text-sm text-slate-500">{exams.length ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Bấm Soạn bài kiểm tra để tạo đề trong môi trường chỉnh sửa. Đề sẽ được lưu vào cơ sở dữ liệu.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredExams.map((exam) => (
              <article key={exam.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-slate-900">
                      {exam.title}{exam.grade ? ` - ${/^khối\b/i.test(exam.grade) ? exam.grade : `khối ${exam.grade}`}` : ''}
                    </h2>
                    <span className={`shrink-0 text-base font-semibold ${(exam.status ?? 'draft') === 'ready' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      ({(exam.status ?? 'draft') === 'ready' ? 'Sẵn sàng sử dụng' : 'Bản nháp'})
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><ClipboardList className="h-4 w-4" />{exam.questions.length} câu</span>
                    <span>{exam.questions.reduce((total, question) => total + question.points, 0)} điểm</span>
                    <span>{exam.durationMinutes ? `${exam.durationMinutes} phút` : 'Chưa đặt thời lượng'}</span>
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{exam.createdAt}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <button onClick={() => setSelectedExam(exam)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" /> Mở đề</button>
                  <button onClick={() => deleteExam(exam)} aria-label={`Xóa đề ${exam.title}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
                  <button
                    type="button"
                    disabled={!examReady(exam)}
                    onClick={() => onCreateExamRoom(exam)}
                    title={examReady(exam) ? 'Tạo phòng thi từ đề này' : 'Chỉ đề sẵn sàng, đã hoàn thiện mới tạo được phòng thi.'}
                    className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    Tạo phòng thi
                  </button>
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
