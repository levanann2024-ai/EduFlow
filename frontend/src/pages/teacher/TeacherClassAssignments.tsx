import { FormEvent, useEffect, useState } from 'react';
import { Calendar, ClipboardList, Plus } from 'lucide-react';
import {
  createClassAssignment,
  listClassAssignments,
  type ClassAssignment,
} from '@/api/schoolApi';

interface TeacherClassAssignmentsProps {
  classId: string;
  academicYear: string;
  className: string;
  subjects: string[];
}

export function TeacherClassAssignments({
  classId,
  academicYear,
  className,
  subjects,
}: TeacherClassAssignmentsProps) {
  const [semester, setSemester] = useState('Kỳ 1');
  const [subject, setSubject] = useState(subjects[0] ?? '');
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(subject)) setSubject(subjects[0]);
    if (subjects.length === 0) setSubject('');
  }, [subjects, subject]);

  useEffect(() => {
    let active = true;
    if (!subject) {
      setAssignments([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setError('');
    listClassAssignments(classId, academicYear, semester, subject)
      .then((result) => {
        if (active) setAssignments(result);
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
  }, [classId, academicYear, semester, subject, reloadKey]);

  const publishAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!subject) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await createClassAssignment(classId, {
        academicYear,
        semester,
        subject,
        title,
        description,
        dueAt: new Date(dueAt).toISOString(),
      });
      setTitle('');
      setDescription('');
      setDueAt('');
      setMessage('Đã giao bài tập cho học sinh trong lớp.');
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể giao bài tập.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Bài tập lớp {className}</h2>
          <p className="mt-1 text-sm text-slate-500">Bài tập được giao tại đây sẽ xuất hiện trong tài khoản học sinh của lớp.</p>
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="class-assignment-subject">Môn học</label>
          <select
            id="class-assignment-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="sr-only" htmlFor="class-assignment-semester">Học kỳ</label>
          <select
            id="class-assignment-semester"
            value={semester}
            onChange={(event) => setSemester(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="Kỳ 1">Kỳ 1</option>
            <option value="Kỳ 2">Kỳ 2</option>
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
          <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="ml-2 font-semibold underline">Thử tải lại</button>
        </div>
      )}
      {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}

      <form onSubmit={(event) => void publishAssignment(event)} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Tên bài tập
          <input
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Hạn nộp
          <input
            required
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Hướng dẫn / nội dung
          <textarea
            maxLength={5000}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving || !subject}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />{saving ? 'Đang giao bài...' : 'Giao bài tập'}
          </button>
        </div>
      </form>

      {loading ? (
        <p role="status" className="py-6 text-center text-sm text-slate-500">Đang tải bài tập...</p>
      ) : !error && assignments.length === 0 ? (
        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có bài tập trong học kỳ này.</p>
      ) : !error ? (
        <div className="divide-y divide-slate-100">
          {assignments.map((assignment) => (
            <article key={assignment.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="rounded-lg bg-blue-50 p-2 text-blue-700"><ClipboardList className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{assignment.title}</h3>
                  {assignment.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{assignment.description}</p>}
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    Hạn nộp: {new Date(assignment.dueAt).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
              <span className="text-sm text-slate-600">
                <strong className="text-slate-900">{assignment.submittedCount}/{assignment.studentCount}</strong> đã nộp
              </span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
