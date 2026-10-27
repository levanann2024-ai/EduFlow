import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, Heart, RefreshCw, Star } from 'lucide-react';
import { getHomeroomClassGradeSummary, type HomeroomGradeSummary } from '@/api/schoolApi';

interface HomeroomClassOverviewProps {
  classId: string;
  academicYear: string;
  className: string;
  homeroomSubject: string;
}

export function HomeroomClassOverview({
  classId,
  academicYear,
  className,
  homeroomSubject,
}: HomeroomClassOverviewProps) {
  const [semester, setSemester] = useState('Kỳ 1');
  const [summary, setSummary] = useState<HomeroomGradeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getHomeroomClassGradeSummary(classId, academicYear, semester)
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải điểm tổng hợp của lớp.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [academicYear, classId, reloadKey, semester]);

  const subjects = useMemo(() => {
    const availableSubjects = summary?.subjects ?? [];
    return [
      ...availableSubjects.filter((subject) => subject === homeroomSubject),
      ...availableSubjects
        .filter((subject) => subject !== homeroomSubject)
        .sort((first, second) => first.localeCompare(second, 'vi')),
    ];
  }, [homeroomSubject, summary]);

  return (
    <section className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-rose-50 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Heart className="h-5 w-5" />
            </span>
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
                <Star className="h-4 w-4 fill-current" /> Lớp chủ nhiệm của bạn
              </p>
              <h2 className="mt-1 text-xl font-extrabold text-slate-900">{className}</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Một góc nhìn tổng quan để đồng hành cùng lớp — theo dõi điểm trung bình từng môn và chú ý môn {homeroomSubject}.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            Học kỳ
            <select
              aria-label="Học kỳ tổng hợp điểm"
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              className="min-h-10 rounded-lg border border-amber-200 bg-white px-3 text-sm text-slate-800"
            >
              <option value="Kỳ 1">Kỳ 1</option>
              <option value="Kỳ 2">Kỳ 2</option>
            </select>
          </label>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="inline-flex items-center gap-2 font-semibold underline underline-offset-2"
          >
            <RefreshCw className="h-4 w-4" /> Thử tải lại
          </button>
        </div>
      )}

      {loading ? (
        <p role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Đang xem lại bảng điểm của lớp...
        </p>
      ) : !error && summary && summary.students.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <BookOpenCheck className="h-4 w-4 text-blue-600" />
              Điểm trung bình theo môn
            </p>
            <span className="text-xs text-slate-500">{summary.students.length} học sinh · {academicYear} · {semester}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th scope="col" className="sticky left-0 z-20 min-w-14 bg-slate-50 px-3 py-3">TT</th>
                  <th scope="col" className="sticky left-14 z-20 min-w-48 bg-slate-50 px-3 py-3">Học sinh</th>
                  {subjects.map((subject) => {
                    const isHomeroomSubject = subject === homeroomSubject;
                    return (
                      <th
                        key={subject}
                        scope="col"
                        className={`min-w-28 px-3 py-3 text-center ${
                          isHomeroomSubject ? 'bg-amber-100 text-amber-900' : 'bg-slate-50'
                        }`}
                      >
                        <span className="block">{subject}</span>
                        {isHomeroomSubject && <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide">Môn chủ nhiệm</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {summary.students.map((student, index) => (
                  <tr key={student.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="sticky left-0 z-10 bg-white px-3 py-3 text-slate-500">{index + 1}</td>
                    <th scope="row" className="sticky left-14 z-10 bg-white px-3 py-3 font-semibold text-slate-800">
                      {student.fullName}
                    </th>
                    {subjects.map((subject) => {
                      const average = student.averages[subject];
                      return (
                        <td
                          key={subject}
                          className={`px-3 py-3 text-center font-semibold ${
                            subject === homeroomSubject ? 'bg-amber-50 text-amber-900' : 'text-slate-700'
                          }`}
                        >
                          {average === null || average === undefined ? '—' : average.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            Điểm trung bình tính theo sổ điểm: thường xuyên ×1, giữa kỳ ×2, cuối kỳ ×3. Dấu “—” là môn chưa có điểm.
          </p>
        </div>
      ) : !error ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Lớp chưa có học sinh hoặc chưa có môn học được khai báo.
        </p>
      ) : null}
    </section>
  );
}
