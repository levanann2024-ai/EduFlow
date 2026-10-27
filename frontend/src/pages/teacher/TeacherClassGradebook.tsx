import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Save, TrendingDown, TrendingUp } from 'lucide-react';
import {
  getClassGradebook,
  saveClassGradebook,
  type GradebookStudent,
  type TermGrades,
} from '@/api/schoolApi';

interface TeacherClassGradebookProps {
  classId: string;
  academicYear: string;
  subjects: string[];
}

function weightedAverage(grades: TermGrades): number | null {
  const scores = [
    ...grades.regular.map((value) => ({ value, weight: 1 })),
    { value: grades.midterm, weight: 2 },
    { value: grades.final, weight: 3 },
  ];
  const graded = scores.filter((score) => score.value !== null && Number.isFinite(score.value));
  if (graded.length === 0) return null;
  const points = graded.reduce((total, score) => total + (score.value ?? 0) * score.weight, 0);
  const weights = graded.reduce((total, score) => total + score.weight, 0);
  return points / weights;
}

function toInputs(grades: TermGrades): string[] {
  return [...grades.regular, grades.midterm, grades.final].map((score) => score === null ? '' : String(score));
}

function toScore(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

function hasGradeChanges(inputs: string[], grades: TermGrades): boolean {
  const savedInputs = toInputs(grades);
  return inputs.some((value, scoreIndex) => !Object.is(toScore(value), toScore(savedInputs[scoreIndex])));
}

export function TeacherClassGradebook({ classId, academicYear, subjects }: TeacherClassGradebookProps) {
  const [semester, setSemester] = useState('Kỳ 1');
  const [subject, setSubject] = useState(subjects[0] ?? '');
  const [students, setStudents] = useState<GradebookStudent[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(subject)) setSubject(subjects[0]);
    if (subjects.length === 0) setSubject('');
  }, [subjects, subject]);

  useEffect(() => {
    let active = true;
    if (!subject) {
      setStudents([]);
      setDrafts({});
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setError('');
    getClassGradebook(classId, academicYear, semester, subject)
      .then((result) => {
        if (!active) return;
        setStudents(result);
        setDrafts(Object.fromEntries(result.map((student) => [student.id, toInputs(student.grades)])));
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải sổ điểm.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId, academicYear, semester, subject, reloadKey]);

  const totals = useMemo(() => students.reduce(
    (summary, student) => ({
      assignments: summary.assignments + student.assignments.total,
      submitted: summary.submitted + student.assignments.submitted,
    }),
    { assignments: 0, submitted: 0 },
  ), [students]);
  const progress = totals.assignments === 0 ? null : Math.round((totals.submitted / totals.assignments) * 100);

  const changedStudents = students.filter((student) => {
    const values = drafts[student.id] ?? toInputs(student.grades);
    return hasGradeChanges(values, student.grades);
  });

  const saveGrades = async () => {
    if (changedStudents.length === 0) return;
    setSaveError('');
    setSaveMessage('');
    const invalidStudent = changedStudents.find((student) => (
      (drafts[student.id] ?? toInputs(student.grades))
        .some((value) => value.trim() !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10))
    ));
    if (invalidStudent) {
      setSaveError(`Điểm của ${invalidStudent.fullName} phải nằm trong khoảng từ 0 đến 10.`);
      return;
    }

    setSaving(true);
    try {
      const saved = await saveClassGradebook(classId, {
        academicYear,
        semester,
        subject,
        entries: changedStudents.map((student) => {
          const parsed = (drafts[student.id] ?? toInputs(student.grades)).map(toScore);
          return {
            studentId: student.id,
            regular: parsed.slice(0, 4),
            midterm: parsed[4],
            final: parsed[5],
          };
        }),
      });
      setSaveMessage(`Đã lưu bảng điểm cho ${saved.length} học sinh.`);
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      setSaveError(requestError instanceof Error ? requestError.message : 'Không thể lưu bảng điểm.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Tiến độ bài tập</h2>
            <p className="mt-1 text-sm text-slate-500">
              {totals.assignments === 0
                ? 'Chưa có bài tập được giao trong kỳ này.'
                : `${totals.submitted} / ${totals.assignments} lượt nộp đã hoàn thành`}
            </p>
          </div>
          {progress !== null && <span className="text-xl font-bold text-blue-700">{progress}%</span>}
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress ?? 0}%` }} />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Tổng quan học sinh</h2>
            <p className="mt-1 text-sm text-slate-500">{academicYear}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              Môn học
              <select
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              Học kỳ
              <select
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="Kỳ 1">Kỳ 1</option>
                <option value="Kỳ 2">Kỳ 2</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void saveGrades()}
              disabled={saving || loading || changedStudents.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Đang lưu bảng điểm...' : `Lưu bảng điểm${changedStudents.length ? ` (${changedStudents.length})` : ''}`}
            </button>
          </div>
        </div>

        {saveError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{saveError}</p>}
        {saveMessage && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{saveMessage}</p>}
        {error ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p>{error}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-2 font-semibold underline">Thử tải lại</button>
          </div>
        ) : loading ? (
          <p role="status" className="py-8 text-center text-sm text-slate-500">Đang tải sổ điểm...</p>
        ) : students.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Lớp hiện chưa có học sinh đang theo học.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] border-collapse text-left">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th rowSpan={2} className="sticky left-0 z-10 bg-slate-50 p-3">TT</th>
                  <th rowSpan={2} className="sticky left-12 z-10 min-w-48 bg-slate-50 p-3">Họ và tên</th>
                  <th colSpan={4} className="p-2 text-center">Điểm thường xuyên (×1)</th>
                  <th rowSpan={2} className="p-2 text-center">Giữa kỳ (×2)</th>
                  <th rowSpan={2} className="p-2 text-center">Cuối kỳ (×3)</th>
                  <th rowSpan={2} className="p-2 text-center">Điểm cũ</th>
                  <th rowSpan={2} className="p-2 text-center">Điểm mới</th>
                  <th rowSpan={2} className="p-2">Tăng / giảm TBM</th>
                  <th rowSpan={2} className="min-w-32 p-2">Tỷ lệ hoàn thành</th>
                  <th rowSpan={2} className="min-w-52 p-2">Đánh giá &amp; cảnh báo</th>
                </tr>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-500">
                  {[1, 2, 3, 4].map((number) => <th key={number} className="p-2 text-center">CC {number}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {students.map((student, index) => {
                  const inputs = drafts[student.id] ?? toInputs(student.grades);
                  const draftGrades: TermGrades = {
                    regular: inputs.slice(0, 4).map(toScore),
                    midterm: toScore(inputs[4] ?? ''),
                    final: toScore(inputs[5] ?? ''),
                  };
                  const calculatedAverage = weightedAverage(draftGrades);
                  const gradesChanged = hasGradeChanges(inputs, student.grades);
                  const oldAverage = gradesChanged
                    ? student.confirmedAverage
                    : student.previousConfirmedAverage;
                  const newAverage = gradesChanged ? calculatedAverage : student.confirmedAverage;
                  const change = newAverage === null || oldAverage === null
                    ? null
                    : Number((newAverage - oldAverage).toFixed(2));
                  const completion = student.assignments.total === 0
                    ? null
                    : Math.round((student.assignments.submitted / student.assignments.total) * 100);
                  const assessment = student.assignments.overdueMissing > 0
                    ? { label: `Chưa nộp ${student.assignments.overdueMissing} bài quá hạn`, tone: 'bg-amber-50 text-amber-800', icon: AlertTriangle }
                    : newAverage !== null && newAverage < 5
                      ? { label: 'Cần phụ đạo', tone: 'bg-rose-50 text-rose-700', icon: AlertTriangle }
                      : newAverage !== null && newAverage >= 8
                        ? { label: 'Học tốt', tone: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 }
                        : null;
                  const AssessmentIcon = assessment?.icon;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70">
                      <td className="sticky left-0 bg-white p-3 text-slate-500">{index + 1}</td>
                      <td className="sticky left-12 bg-white p-3 font-semibold text-slate-900">{student.fullName}</td>
                      {inputs.map((value, scoreIndex) => (
                        <td key={scoreIndex} className="p-1.5 text-center">
                          <input
                            aria-label={`${student.fullName}, ${scoreIndex < 4 ? `điểm thường xuyên ${scoreIndex + 1}` : scoreIndex === 4 ? 'điểm giữa kỳ' : 'điểm cuối kỳ'}`}
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={value}
                            onChange={(event) => {
                              const next = [...inputs];
                              next[scoreIndex] = event.target.value;
                              setDrafts((current) => ({ ...current, [student.id]: next }));
                            }}
                            className="w-14 rounded-md border border-slate-200 px-1.5 py-1 text-center text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                          />
                        </td>
                      ))}
                      <td className="p-3 text-center font-semibold text-slate-600">
                        {oldAverage === null ? '—' : oldAverage.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-bold text-slate-900">{newAverage === null ? '—' : newAverage.toFixed(2)}</span>
                        {gradesChanged && <span className="mt-1 block text-[10px] text-slate-400">Chưa lưu</span>}
                      </td>
                      <td className="p-3">
                        {newAverage === null ? '—' : oldAverage === null ? (
                          <span className="text-xs text-slate-400">Chưa có điểm cũ</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${change !== null && change > 0 ? 'text-emerald-700' : change !== null && change < 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                            {change !== null && change > 0
                              ? <TrendingUp className="h-3.5 w-3.5" />
                              : change !== null && change < 0
                                ? <TrendingDown className="h-3.5 w-3.5" />
                                : null}
                            {gradesChanged ? 'Dự kiến ' : ''}
                            {change !== null && change > 0 ? 'Tăng ' : change !== null && change < 0 ? 'Giảm ' : 'Không đổi '}
                            {Math.abs(change ?? 0).toFixed(2)} điểm
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {completion === null ? '—' : (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${completion < 60 ? 'bg-rose-500' : completion < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${completion}%` }} />
                            </div>
                            <span className="text-xs font-semibold">{completion}%</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {assessment && AssessmentIcon ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${assessment.tone}`}>
                            <AssessmentIcon className="h-3.5 w-3.5 shrink-0" />{assessment.label}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500">
          Điểm mới là TBM tính từ điểm thành phần hiện tại; khi lưu, điểm mới trước đó chuyển sang điểm cũ. Lần nhập đầu tiên chưa có điểm cũ.
        </p>
      </section>
    </div>
  );
}
