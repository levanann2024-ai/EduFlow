import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, BookOpen, Check, CheckCircle2, Clock3, FileText, GraduationCap, Save,
} from 'lucide-react';
import {
  listClassAssignmentSubmissions,
  listClassAssignments,
  listClassSubjects,
  listClasses,
  saveClassAssignmentGrade,
  type AssignmentSubmission,
  type ClassAssignment,
  type SchoolClass,
} from '@/api/schoolApi';

type GradingFilter = 'all' | 'needs-review' | 'graded';

export function AssignmentGradingWorkspace() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [filter, setFilter] = useState<GradingFilter>('needs-review');
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedClass = classes.find((classroom) => classroom.id === selectedClassId) ?? null;
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null;
  const selectedSubmission = submissions.find((submission) => submission.studentId === selectedStudentId) ?? null;
  const submittedWork = submissions.filter((submission) => submission.responseText !== null);
  const visibleAssignments = useMemo(() => assignments.filter((assignment) => {
    const submittedCount = assignment.students.filter((student) => student.submittedAt).length;
    const gradedCount = assignment.students.filter((student) => student.gradedAt).length;
    return filter === 'all'
      || (filter === 'needs-review' && submittedCount > gradedCount)
      || (filter === 'graded' && submittedCount > 0 && submittedCount === gradedCount);
  }), [assignments, filter]);

  useEffect(() => {
    let active = true;
    listClasses()
      .then((items) => {
        if (!active) return;
        setClasses(items);
        setSelectedClassId(items[0]?.id ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách lớp.');
      })
      .finally(() => {
        if (active) setLoadingClasses(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setSubjects([]);
    setAssignments([]);
    setSelectedAssignmentId('');
    setSubmissions([]);
    setSelectedStudentId('');
    if (!selectedClassId) return () => { active = false; };
    listClassSubjects(selectedClassId)
      .then((items) => {
        if (active) setSubjects(items);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải môn học được phân công.');
      });
    return () => { active = false; };
  }, [selectedClassId]);

  useEffect(() => {
    let active = true;
    if (!selectedClass || subjects.length === 0) {
      setAssignments([]);
      setLoadingAssignments(false);
      return () => { active = false; };
    }
    setLoadingAssignments(true);
    setAssignments([]);
    setSelectedAssignmentId('');
    setSubmissions([]);
    setSelectedStudentId('');
    setError('');
    Promise.all(subjects.flatMap((subject) => ['Kỳ 1', 'Kỳ 2'].map((semester) =>
      listClassAssignments(selectedClass.id, selectedClass.academic_year, semester, subject))))
      .then((results) => {
        if (!active) return;
        const items = results.flat().sort((first, second) =>
          (second.createdAt ?? second.dueAt).localeCompare(first.createdAt ?? first.dueAt));
        setAssignments(items);
        setSelectedAssignmentId(items[0]?.id ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải bài tập.');
      })
      .finally(() => {
        if (active) setLoadingAssignments(false);
      });
    return () => { active = false; };
  }, [selectedClass, subjects]);

  useEffect(() => {
    let active = true;
    if (!selectedClassId || !selectedAssignmentId) {
      setSubmissions([]);
      setSelectedStudentId('');
      return () => { active = false; };
    }
    setLoadingSubmissions(true);
    setSubmissions([]);
    setSelectedStudentId('');
    setError('');
    listClassAssignmentSubmissions(selectedClassId, selectedAssignmentId)
      .then((items) => {
        if (!active) return;
        setSubmissions(items);
        const firstSubmitted = items.find((item) => item.responseText !== null);
        setSelectedStudentId(firstSubmitted?.studentId ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải bài làm.');
      })
      .finally(() => {
        if (active) setLoadingSubmissions(false);
      });
    return () => { active = false; };
  }, [selectedClassId, selectedAssignmentId]);

  useEffect(() => {
    setScore(selectedSubmission?.score?.toString() ?? '');
    setFeedback(selectedSubmission?.teacherFeedback ?? '');
  }, [selectedSubmission]);

  const saveGrade = async () => {
    if (!selectedClassId || !selectedAssignmentId || !selectedSubmission || score.trim() === '') return;
    const parsedScore = Number(score);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 10) {
      setError('Điểm phải là số từ 0 đến 10.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await saveClassAssignmentGrade(
        selectedClassId,
        selectedAssignmentId,
        selectedSubmission.studentId,
        { score: parsedScore, teacherFeedback: feedback },
      );
      setSubmissions((current) => current.map((item) => item.studentId === selectedSubmission.studentId
        ? { ...item, ...result }
        : item));
      setAssignments((current) => current.map((assignment) => assignment.id === selectedAssignmentId
        ? {
          ...assignment,
          students: assignment.students.map((student) => student.id === selectedSubmission.studentId
            ? { ...student, submittedAt: selectedSubmission.submittedAt, gradedAt: result.gradedAt }
            : student),
        }
        : assignment));
      setNotice('Đã lưu điểm và nhận xét.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể lưu điểm.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Chấm bài</h1>
          <p className="mt-1 text-sm text-slate-500">Chọn bài đã giao, xem bài làm, rồi xác nhận điểm và nhận xét.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Lớp
          <select
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
            disabled={loadingClasses || classes.length === 0}
            className="input-field min-h-10 w-44 px-3"
          >
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
            ))}
          </select>
        </label>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <div className="grid min-h-[560px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-semibold text-slate-900">Bài cần chấm</h2>
            <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1">
              {([
                ['needs-review', 'Chưa chấm'],
                ['graded', 'Đã chấm'],
                ['all', 'Tất cả'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${filter === value ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {loadingClasses || loadingAssignments ? (
            <p role="status" className="p-4 text-sm text-slate-500">Đang tải bài tập...</p>
          ) : visibleAssignments.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              {assignments.length ? 'Không có bài phù hợp bộ lọc.' : 'Lớp này chưa có bài tập được giao.'}
            </p>
          ) : (
            <nav aria-label="Danh sách bài tập" className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {visibleAssignments.map((assignment) => {
                const submittedCount = assignment.students.filter((student) => student.submittedAt).length;
                const reviewedCount = assignment.students.filter((student) => student.gradedAt).length;
                return (
                  <button
                    key={assignment.id}
                    type="button"
                    aria-current={selectedAssignmentId === assignment.id ? 'true' : undefined}
                    onClick={() => setSelectedAssignmentId(assignment.id)}
                    className={`w-full p-4 text-left transition hover:bg-slate-50 ${selectedAssignmentId === assignment.id ? 'border-l-2 border-blue-700 bg-blue-50/70' : ''}`}
                  >
                    <span className="block truncate text-sm font-semibold text-slate-900">{assignment.title}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{assignment.subject} · {assignment.semester}</span>
                    <span className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>{submittedCount} bài nộp</span>
                      <span>{reviewedCount} đã chấm</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </aside>

        <main className="min-w-0 rounded-2xl border border-slate-200 bg-white">
          {!selectedAssignment ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
              <BookOpen className="h-8 w-8 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-700">Chọn bài tập để xem bài làm</p>
              <p className="mt-1 text-sm text-slate-500">Bài tập đã giao sẽ xuất hiện ở danh sách bên trái.</p>
            </div>
          ) : (
            <div className="flex min-h-[560px] flex-col">
              <div className="border-b border-slate-100 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-blue-700">{selectedClass?.name} · {selectedAssignment.subject} · {selectedAssignment.semester}</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">{selectedAssignment.title}</h2>
                    {selectedAssignment.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedAssignment.description}</p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    Hạn nộp {new Date(selectedAssignment.dueAt).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>
              {loadingSubmissions ? (
                <p role="status" className="p-6 text-sm text-slate-500">Đang tải bài làm...</p>
              ) : submittedWork.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">Chưa có học sinh nào nộp bài này.</div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto border-b border-slate-100 p-3">
                    {submittedWork.map((submission) => (
                      <button
                        key={submission.studentId}
                        type="button"
                        aria-pressed={selectedStudentId === submission.studentId}
                        onClick={() => setSelectedStudentId(submission.studentId)}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${selectedStudentId === submission.studentId ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                      >
                        {submission.score === null
                          ? <Clock3 className="h-4 w-4 text-amber-600" />
                          : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                        {submission.studentName}
                      </button>
                    ))}
                  </div>
                  {selectedSubmission && (
                    <div className="grid min-h-0 flex-1 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
                      <section className="min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                            <FileText className="h-4 w-4 text-blue-700" /> Bài làm của {selectedSubmission.studentName}
                          </h3>
                          {selectedSubmission.submittedAt && (
                            <span className="text-xs text-slate-500">
                              Nộp {new Date(selectedSubmission.submittedAt).toLocaleString('vi-VN')}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 min-h-64 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800">
                          {selectedSubmission.responseText}
                        </div>
                      </section>
                      <section className="space-y-4 rounded-xl border border-slate-200 p-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">Nhận xét và xác nhận điểm</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Điểm AI đề xuất chưa khả dụng cho bài làm này; hãy đánh giá trực tiếp nội dung trước khi xác nhận.
                          </p>
                        </div>
                        <label className="block text-sm font-medium text-slate-700">
                          Điểm (0–10)
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.25"
                            value={score}
                            onChange={(event) => setScore(event.target.value)}
                            className="input-field mt-1 min-h-11 w-full px-3 text-lg font-semibold"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          Nhận xét cho học sinh
                          <textarea
                            rows={7}
                            maxLength={5000}
                            value={feedback}
                            onChange={(event) => setFeedback(event.target.value)}
                            placeholder="Ghi nhận xét cụ thể về bài làm..."
                            className="input-field mt-1 w-full resize-y p-3 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void saveGrade()}
                          disabled={saving || score.trim() === ''}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {selectedSubmission.score === null
                            ? <><Check className="h-4 w-4" />{saving ? 'Đang lưu...' : 'Xác nhận điểm'}</>
                            : <><Save className="h-4 w-4" />{saving ? 'Đang lưu...' : 'Cập nhật điểm'}</>}
                        </button>
                      </section>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="flex items-center gap-2 font-semibold"><GraduationCap className="h-4 w-4" /> Bài kiểm tra đã kết thúc</p>
        <p className="mt-1 leading-6">
          Hiện hệ thống chưa có API dữ liệu bài làm và chấm điểm bài thi trực tuyến; mục này chỉ chấm bài tập lớp đã nộp, không hiển thị dữ liệu thi giả lập.
        </p>
      </section>
    </div>
  );
}
