import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Eye, FileText, Plus, Search, Send, Trash2 } from 'lucide-react';
import { deleteTeacherAssessment, saveTeacherAssessment } from '@/api/schoolApi';
import { defaultAssessmentSections, loadTeacherAssessments, type SavedAssignment } from '@/pages/teacher/assessmentStorage';
import { ExamEditor } from '@/pages/teacher/ExamEditor';

function assignmentContent(assignment: SavedAssignment) {
  const sections = assignment.sections ?? defaultAssessmentSections(assignment.questions);
  const sectionContent = sections.map((section) => {
    const questions = section.questionIds.flatMap((id) => {
      const question = assignment.questions.find((item) => item.id === id);
      return question ? [question] : [];
    }).map((question, index) => {
    const typeLabel = question.type === 'true-false'
      ? 'Đúng / Sai'
      : question.type === 'short-answer'
        ? 'Trả lời ngắn'
        : question.type === 'essay'
          ? 'Tự luận'
          : 'Trắc nghiệm';
    const options = question.options.length
      ? question.options.map((option, optionIndex) => (
        `${question.type === 'true-false' ? String.fromCharCode(97 + optionIndex) : String.fromCharCode(65 + optionIndex)}. ${option}`
      )).join('\n')
      : '';
    return [
      `Câu ${index + 1} - ${typeLabel} (${question.points} điểm)`,
      question.question,
      options,
    ].filter(Boolean).join('\n');
    });
    return [section.title, section.description, ...questions].filter(Boolean).join('\n\n');
  });
  return [
    `Bài tập: ${assignment.title}`,
    `${assignment.subject} - ${assignment.grade} - ${assignment.topic}`,
    ...sectionContent,
  ].join('\n\n');
}

export function AssignmentManagement({
  onAssignToClass,
}: {
  onAssignToClass: (draft: { title: string; subject: string; content: string }) => void;
}) {
  const [assignments, setAssignments] = useState<SavedAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<SavedAssignment | null>(null);
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let active = true;
    loadTeacherAssessments('assignment')
      .then((items) => { if (active) setAssignments(items); })
      .catch((loadError: unknown) => {
        console.error('Không thể tải danh sách bài tập đã lưu từ máy chủ.', loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : 'Không thể tải bài tập đã lưu.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const subjects = useMemo(() => [...new Set(assignments.map((assignment) => assignment.subject))].sort(), [assignments]);
  const grades = useMemo(() => [...new Set(assignments.map((assignment) => assignment.grade))].sort(), [assignments]);
  const filteredAssignments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return assignments.filter((assignment) => (
      (!normalized || `${assignment.title} ${assignment.topic} ${assignment.subject} ${assignment.grade}`.toLocaleLowerCase('vi').includes(normalized))
      && (!subjectFilter || assignment.subject === subjectFilter)
      && (!gradeFilter || assignment.grade === gradeFilter)
      && (!statusFilter || (assignment.status ?? 'draft') === statusFilter)
    ));
  }, [assignments, gradeFilter, query, statusFilter, subjectFilter]);

  const persist = async (assignment: SavedAssignment, successMessage: string) => {
    try {
      const saved = await saveTeacherAssessment('assignment', assignment);
      setAssignments((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setError('');
      setFeedback(successMessage);
      return true;
    } catch (saveError) {
      console.error('Không thể lưu bài tập vào cơ sở dữ liệu.', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu bài tập vào cơ sở dữ liệu.');
      setFeedback('');
      return false;
    }
  };

  const saveAssignment = async (updated: SavedAssignment, status: 'draft' | 'ready') => {
    const nextAssignment = { ...updated, status };
    if (await persist(nextAssignment, status === 'ready' ? 'Bài tập đã sẵn sàng để giao.' : 'Đã lưu bài tập nháp.')) {
      setSelectedAssignment(null);
    }
  };

  const createAssignment = () => {
    const createdAt = Date.now();
    setError('');
    setFeedback('');
    setSelectedAssignment({
      id: `assignment-${createdAt}`,
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

  const deleteAssignment = async (assignment: SavedAssignment) => {
    if (!window.confirm(`Bạn có chắc muốn xóa bài tập "${assignment.title}"?`)) return;
    try {
      await deleteTeacherAssessment('assignment', assignment.id);
      setAssignments((current) => current.filter((item) => item.id !== assignment.id));
      setError('');
      setFeedback('Đã xóa bài tập.');
      if (selectedAssignment?.id === assignment.id) setSelectedAssignment(null);
    } catch (deleteError) {
      console.error('Không thể xóa bài tập khỏi cơ sở dữ liệu.', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa bài tập.');
      setFeedback('');
    }
  };

  return (
    <main className="space-y-4">
      <div className="flex justify-end">
        <button onClick={createAssignment} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
          <Plus className="h-4 w-4" /> Tạo bài tập
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {feedback && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid gap-2 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(135px,190px))]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên bài tập, chủ đề..." className="input-field pl-9" />
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
            <option value="ready">Sẵn sàng giao</option>
          </select>
        </div>

        {loading ? (
          <p role="status" className="p-10 text-center text-sm text-slate-500">Đang tải bài tập đã lưu...</p>
        ) : filteredAssignments.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
            <FileText className="h-8 w-8 text-slate-300" />
            <h2 className="mt-3 font-semibold text-slate-800">{assignments.length ? 'Không tìm thấy bài tập phù hợp' : 'Chưa có bài tập nào được lưu'}</h2>
            <p className="mt-1 max-w-md text-sm text-slate-500">{assignments.length ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Tạo bài tập từ các câu hỏi trong ngân hàng hoặc lưu bài tập tự luyện vào đây.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAssignments.map((assignment) => (
              <article key={assignment.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{assignment.title || 'Bài tập chưa đặt tên'}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${(assignment.status ?? 'draft') === 'ready' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                      {(assignment.status ?? 'draft') === 'ready' ? 'Sẵn sàng giao' : 'Bản nháp'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{assignment.subject} - {assignment.grade} - {assignment.topic}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><ClipboardList className="h-4 w-4" />{assignment.questions.length} câu</span>
                    <span>{assignment.questions.reduce((total, question) => total + question.points, 0)} điểm</span>
                    <span>{assignment.durationMinutes ? `${assignment.durationMinutes} phút` : 'Không giới hạn thời gian'}</span>
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{assignment.createdAt}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <button onClick={() => setSelectedAssignment(assignment)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" /> Mở bài tập</button>
                  <button onClick={() => deleteAssignment(assignment)} aria-label={`Xóa bài tập ${assignment.title}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
                  <button
                    onClick={() => onAssignToClass({
                      title: assignment.title,
                      subject: assignment.subject,
                      content: assignmentContent(assignment),
                    })}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <Send className="h-4 w-4" /> Giao cho lớp
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedAssignment && (
        <ExamEditor
          exam={selectedAssignment}
          kind="assignment"
          onClose={() => setSelectedAssignment(null)}
          onSave={saveAssignment}
        />
      )}
    </main>
  );
}
