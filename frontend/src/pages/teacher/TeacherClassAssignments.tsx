import { useEffect, useState } from 'react';
import { Calendar, Check, ClipboardList, Circle, Eye, X } from 'lucide-react';
import { listClassAssignments, type ClassAssignment } from '@/api/schoolApi';

interface TeacherClassAssignmentsProps {
  classId: string;
  academicYear: string;
  subjects: string[];
}

function scoreColor(score: number) {
  if (score >= 8) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (score >= 5) return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-rose-200 bg-rose-50 text-rose-800';
}

export function TeacherClassAssignments({
  classId,
  academicYear,
  subjects,
}: TeacherClassAssignmentsProps) {
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [checkingAssignmentId, setCheckingAssignmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (subjects.length === 0) {
      setAssignments([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setError('');
    setAssignments([]);
    setCheckingAssignmentId(null);
    Promise.all(subjects.flatMap((subject) => ['Kỳ 1', 'Kỳ 2'].map((semester) =>
      listClassAssignments(classId, academicYear, semester, subject))))
      .then((results) => {
        if (active) {
          setAssignments(results.flat().sort((first, second) =>
            first.dueAt.localeCompare(second.dueAt)));
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách bài tập.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, academicYear, subjects, reloadKey]);

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="ml-2 font-semibold underline">Thử tải lại</button>
        </div>
      )}

      {loading ? (
        <p role="status" className="py-6 text-center text-sm text-slate-500">Đang tải bài tập...</p>
      ) : !error && assignments.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có bài tập nào được giao cho lớp.</p>
      ) : !error ? (
        <div className="divide-y divide-slate-100">
          {assignments.map((assignment) => (
            <article key={assignment.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-700"><ClipboardList className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{assignment.title}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {assignment.subject} - {assignment.semester}
                      </span>
                    </div>
                    {assignment.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{assignment.description}</p>}
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      Hạn nộp: {new Date(assignment.dueAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm text-slate-600">
                    <strong className="text-slate-900">{assignment.submittedCount}/{assignment.studentCount}</strong> đã nộp
                  </span>
                  <button
                    type="button"
                    aria-expanded={checkingAssignmentId === assignment.id}
                    aria-controls={`assignment-submissions-${assignment.id}`}
                    onClick={() => setCheckingAssignmentId((current) =>
                      current === assignment.id ? null : assignment.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    {checkingAssignmentId === assignment.id
                      ? <><X className="h-4 w-4" /> Đóng</>
                      : <><Eye className="h-4 w-4" /> Kiểm tra</>}
                  </button>
                </div>
              </div>
              {checkingAssignmentId === assignment.id && (
                <div
                  id={`assignment-submissions-${assignment.id}`}
                  className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  {assignment.students.length === 0 ? (
                    <p className="text-sm text-slate-500">Lớp hiện chưa có học sinh đang theo học.</p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {([
                        {
                          title: `Đã nộp (${assignment.students.filter((student) => student.submittedAt).length})`,
                          submitted: true,
                        },
                        {
                          title: `Chưa nộp (${assignment.students.filter((student) => !student.submittedAt).length})`,
                          submitted: false,
                        },
                      ]).map(({ title, submitted }) => {
                        const students = assignment.students
                          .filter((student) => Boolean(student.submittedAt) === submitted)
                          .sort((first, second) => {
                            if (!submitted) return first.fullName.localeCompare(second.fullName, 'vi');
                            if (first.score !== null && second.score === null) return -1;
                            if (first.score === null && second.score !== null) return 1;
                            if (first.score !== null && second.score !== null && first.score !== second.score) {
                              return second.score - first.score;
                            }
                            return first.fullName.localeCompare(second.fullName, 'vi');
                          });
                        return (
                          <section key={title}>
                            <h4 className={`mb-2 text-sm font-semibold ${submitted ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {title}
                            </h4>
                            {students.length ? (
                              <ul className="space-y-2">
                                {students.map((student) => (
                                  <li
                                    key={student.id}
                                    className={`flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 text-sm ${
                                      submitted && student.score !== null ? scoreColor(student.score) : 'text-slate-700'
                                    }`}
                                  >
                                    {submitted
                                      ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                      : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate">{student.fullName}</span>
                                      {student.submittedAt && (
                                        <span className="block text-xs text-slate-500">
                                          Nộp lúc {new Date(student.submittedAt).toLocaleString('vi-VN')}
                                        </span>
                                      )}
                                    </span>
                                    {submitted && student.score !== null && (
                                      <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-md border px-2 py-1 text-center ${scoreColor(student.score)}`}>
                                        <span className="text-xl font-extrabold leading-none">{student.score}</span>
                                        <span className="text-[10px] font-semibold leading-none">/10</span>
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-slate-500">Không có học sinh nào trong nhóm này.</p>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
