import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, BookOpen, ClipboardCheck, Users } from 'lucide-react';
import {
  getClassGradebook,
  listClasses,
  listClassSubjects,
  type GradebookStudent,
  type SchoolClass,
} from '@/api/schoolApi';

export function ClassAnalytics() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [semester, setSemester] = useState('Kỳ 1');
  const [students, setStudents] = useState<GradebookStudent[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState('');

  const selectedClass = classes.find((classroom) => classroom.id === classId) ?? null;
  const report = useMemo(() => {
    const allScores = students.flatMap((student) => [
      ...student.grades.regular,
      student.grades.midterm,
      student.grades.final,
    ].filter((score): score is number => score !== null));
    const assignmentTotal = students.reduce((total, student) => total + student.assignments.total, 0);
    const assignmentSubmitted = students.reduce((total, student) => total + student.assignments.submitted, 0);
    const studentsWithScores = students.filter((student) => [
      ...student.grades.regular,
      student.grades.midterm,
      student.grades.final,
    ].some((score) => score !== null)).length;
    return {
      average: allScores.length
        ? (allScores.reduce((sum, score) => sum + score, 0) / allScores.length).toFixed(2)
        : null,
      studentsWithScores,
      assignmentTotal,
      assignmentSubmitted,
      assignmentRate: assignmentTotal ? Math.round((assignmentSubmitted / assignmentTotal) * 100) : null,
    };
  }, [students]);

  useEffect(() => {
    let active = true;
    listClasses()
      .then((items) => {
        if (!active) return;
        setClasses(items);
        setClassId(items[0]?.id ?? '');
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
    setSubject('');
    setStudents([]);
    if (!classId) return () => { active = false; };
    listClassSubjects(classId)
      .then((items) => {
        if (!active) return;
        setSubjects(items);
        setSubject(items[0] ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải môn học được phân công.');
      });
    return () => { active = false; };
  }, [classId]);

  useEffect(() => {
    let active = true;
    if (!selectedClass || !subject) {
      setStudents([]);
      setLoadingReport(false);
      return () => { active = false; };
    }
    setLoadingReport(true);
    setError('');
    getClassGradebook(selectedClass.id, selectedClass.academic_year, semester, subject)
      .then((items) => {
        if (active) setStudents(items);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải dữ liệu tiến độ.');
      })
      .finally(() => {
        if (active) setLoadingReport(false);
      });
    return () => { active = false; };
  }, [selectedClass, semester, subject]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Phân tích tiến độ</h1>
          <p className="mt-1 text-sm text-slate-500">Theo dõi điểm đã nhập và tình hình nộp bài theo lớp, môn, học kỳ.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="progress-class">Lớp</label>
          <select
            id="progress-class"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            disabled={loadingClasses || classes.length === 0}
            className="input-field min-h-10 w-40 px-3 text-sm"
          >
            {classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="progress-subject">Môn học</label>
          <select
            id="progress-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={subjects.length === 0}
            className="input-field min-h-10 w-40 px-3 text-sm"
          >
            {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="sr-only" htmlFor="progress-semester">Học kỳ</label>
          <select
            id="progress-semester"
            value={semester}
            onChange={(event) => setSemester(event.target.value)}
            className="input-field min-h-10 w-28 px-3 text-sm"
          >
            <option>Kỳ 1</option>
            <option>Kỳ 2</option>
          </select>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {loadingClasses ? (
        <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải danh sách lớp...</p>
      ) : !classes.length ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Bạn chưa được phân công lớp nào.</p>
      ) : !subjects.length ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Lớp này chưa có môn học được phân công.</p>
      ) : loadingReport ? (
        <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải dữ liệu tiến độ...</p>
      ) : !error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Học sinh trong lớp', value: students.length, icon: Users },
              { label: 'Học sinh có điểm', value: report.studentsWithScores, icon: BookOpen },
              { label: 'Điểm trung bình các cột đã nhập', value: report.average ?? 'Chưa có điểm', icon: BarChart3 },
              {
                label: 'Bài tập đã nộp',
                value: report.assignmentTotal
                  ? `${report.assignmentSubmitted}/${report.assignmentTotal} (${report.assignmentRate}%)`
                  : 'Chưa có bài tập',
                icon: ClipboardCheck,
              },
            ].map(({ label, value, icon: Icon }) => (
              <section key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-500">{label}</p>
                  <Icon className="h-4 w-4 shrink-0 text-blue-700" />
                </div>
                <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
              </section>
            ))}
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-slate-900">
                Tiến độ từng học sinh - {selectedClass?.name} - {subject} - {semester}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Điểm trung bình là trung bình cộng của các cột điểm đã nhập, không áp dụng trọng số.
              </p>
            </div>
            {students.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Lớp hiện chưa có học sinh đang theo học.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Học sinh</th>
                      <th className="px-4 py-3">Điểm đã nhập</th>
                      <th className="px-4 py-3">Trung bình</th>
                      <th className="px-4 py-3">Bài tập</th>
                      <th className="px-4 py-3">Quá hạn chưa nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student) => {
                      const scores = [
                        ...student.grades.regular,
                        student.grades.midterm,
                        student.grades.final,
                      ].filter((score): score is number => score !== null);
                      const average = scores.length
                        ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)
                        : null;
                      return (
                        <tr key={student.id} className="text-slate-700">
                          <td className="px-4 py-3 font-medium text-slate-900">{student.fullName}</td>
                          <td className="px-4 py-3">{scores.length}/6</td>
                          <td className="px-4 py-3">{average ?? 'Chưa có điểm'}</td>
                          <td className="px-4 py-3">{student.assignments.submitted}/{student.assignments.total}</td>
                          <td className="px-4 py-3">{student.assignments.overdueMissing}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
