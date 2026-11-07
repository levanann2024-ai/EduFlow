import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, BookOpenCheck, Search, Star, Users } from 'lucide-react';
import { getClass, listClasses, listClassSubjects, type SchoolClass } from '@/api/schoolApi';
import { TeacherClassAssignments } from '@/pages/teacher/TeacherClassAssignments';
import { TeacherClassGradebook } from '@/pages/teacher/TeacherClassGradebook';
import { HomeroomClassOverview } from '@/pages/teacher/HomeroomClassOverview';

const tabs = [
  { id: 'overview', label: 'Thông tin chung', icon: BookOpen },
  { id: 'assignments', label: 'Kiểm tra bài tập', icon: BookOpen },
] as const;

type ClassTab = (typeof tabs)[number]['id'];
type HomeroomTab = 'teaching-subjects' | 'all-subjects';

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="mt-3 font-semibold underline underline-offset-2">
        Thử tải lại
      </button>
    </div>
  );
}

function classAverageStyle(average: number | null | undefined) {
  if (average === null || average === undefined) return 'text-slate-400';
  if (average < 5) return 'text-rose-600';
  if (average < 7) return 'text-amber-500';
  if (average < 9) return 'text-emerald-600';
  return 'text-blue-600';
}

function ClassDetailView({ classId, onBack }: { classId: string; onBack: () => void }) {
  const [classData, setClassData] = useState<SchoolClass | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classError, setClassError] = useState('');
  const [loadingClass, setLoadingClass] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<ClassTab>('overview');
  const [activeHomeroomTab, setActiveHomeroomTab] = useState<HomeroomTab>('teaching-subjects');

  useEffect(() => {
    setActiveHomeroomTab('teaching-subjects');
  }, [classId]);

  useEffect(() => {
    let active = true;
    setClassData(null);
    setSubjects([]);
    setClassError('');
    setLoadingClass(true);

    Promise.all([getClass(classId), listClassSubjects(classId)])
      .then(([result, assignedSubjects]) => {
        if (active) {
          setClassData(result);
          setSubjects(assignedSubjects);
        }
      })
      .catch((error: unknown) => {
        if (active) setClassError(error instanceof Error ? error.message : 'Không thể tải thông tin lớp.');
      })
      .finally(() => {
        if (active) setLoadingClass(false);
      });

    return () => {
      active = false;
    };
  }, [classId, reloadKey]);

  if (loadingClass) {
    return (
      <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Đang tải thông tin lớp...
      </div>
    );
  }

  if (classError || !classData) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách lớp
        </button>
        <ErrorMessage
          message={classError || 'Không tìm thấy lớp trong phạm vi truy cập.'}
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" /> Quay lại lớp
        </button>
        <nav aria-label="Điều hướng lớp học" className="flex flex-wrap items-center gap-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === id
                  ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                  : 'border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && classData.is_homeroom && classData.homeroom_subject && (
        <section className="space-y-4">
          <div className="flex gap-2 overflow-x-auto border-b border-slate-200">
            {([
              { id: 'teaching-subjects', label: 'Môn chính', icon: BookOpen },
              { id: 'all-subjects', label: 'Tất cả các môn', icon: BookOpenCheck },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveHomeroomTab(id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeHomeroomTab === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          {activeHomeroomTab === 'teaching-subjects' ? (
            <TeacherClassGradebook
              classId={classData.id}
              className={classData.name}
              academicYear={classData.academic_year}
              subjects={subjects.includes(classData.homeroom_subject)
                ? [
                  classData.homeroom_subject,
                  ...subjects.filter((subject) => subject !== classData.homeroom_subject),
                ]
                : subjects}
            />
          ) : (
            <HomeroomClassOverview
              classId={classData.id}
              academicYear={classData.academic_year}
              className={classData.name}
              homeroomSubject={classData.homeroom_subject}
            />
          )}
        </section>
      )}
      {activeTab === 'overview' && !classData.is_homeroom && (
        <TeacherClassGradebook
          classId={classData.id}
          className={classData.name}
          academicYear={classData.academic_year}
          subjects={subjects}
        />
      )}
      {activeTab === 'assignments' && (
        <TeacherClassAssignments
          classId={classData.id}
          academicYear={classData.academic_year}
          subjects={subjects}
        />
      )}
    </div>
  );
}

export function ClassManagement() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classQuery, setClassQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const homeroomClasses = classes.filter((classData) => classData.is_homeroom);
  const orderedClasses = [...classes].sort((first, second) =>
    Number(second.is_homeroom) - Number(first.is_homeroom)
    || first.academic_year.localeCompare(second.academic_year)
    || first.name.localeCompare(second.name, 'vi'));
  const filteredClasses = orderedClasses.filter((classData) => (
    (!selectedGrade || classData.grade === selectedGrade)
    && (!classQuery.trim()
      || `${classData.name} ${classData.code}`.toLocaleLowerCase('vi')
        .includes(classQuery.trim().toLocaleLowerCase('vi')))
  ));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setClasses([]);

    listClasses()
      .then((result) => {
        if (active) setClasses(result);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách lớp.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (selectedClassId) {
    return <ClassDetailView classId={selectedClassId} onBack={() => setSelectedClassId(null)} />;
  }

  return (
    <div className="flex min-h-[calc(100vh-190px)] flex-col gap-4 animate-fadeIn">
      {!loading && !error && homeroomClasses.length > 0 && (
        <section className="flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-rose-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Star className="h-4 w-4 fill-current" />
          </span>
          <p>
            <strong>Lớp chủ nhiệm cần lưu ý:</strong>{' '}
            {homeroomClasses.map((classData) => classData.name).join(', ')}.
            Chọn lớp để nhập điểm môn được phân công hoặc xem điểm trung bình các môn.
          </p>
        </section>
      )}

      {error && <ErrorMessage message={error} onRetry={() => setReloadKey((key) => key + 1)} />}
      {loading ? (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Đang tải danh sách lớp...
        </div>
      ) : !error && classes.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
          <Search className="mx-auto mb-4 h-12 w-12 text-slate-300" />
          <p className="text-lg font-semibold text-slate-800">Chưa có lớp được phân công</p>
        </div>
      ) : !error ? (
        <>
          <section aria-label="Lọc danh sách lớp" className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Tìm theo tên hoặc mã lớp</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={classQuery}
                onChange={(event) => setClassQuery(event.target.value)}
                placeholder="Tìm theo tên lớp..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-600">
              <span>Khối</span>
              <select
                value={selectedGrade}
                onChange={(event) => setSelectedGrade(event.target.value)}
                className="h-10 min-w-32 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Tất cả</option>
                <option value="10">Khối 10</option>
                <option value="11">Khối 11</option>
                <option value="12">Khối 12</option>
              </select>
            </label>
          </section>
          {filteredClasses.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:gap-4">
          {filteredClasses.map((classData) => (
            <article
              key={classData.id}
              className="group relative isolate flex min-h-[228px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${classData.is_homeroom ? 'bg-gradient-to-r from-amber-500 to-rose-400' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`} />
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 truncate text-3xl font-extrabold tracking-tight text-slate-950">{classData.name}</h2>
                {classData.is_homeroom && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[0.625rem] font-bold text-amber-800">
                    <Star className="h-3 w-3 fill-current" /> Chủ nhiệm
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-sm font-medium text-slate-600">Điểm trung bình môn lớp:</span>
                <strong className={`text-4xl font-black leading-none tabular-nums ${classAverageStyle(classData.class_average)}`}>
                  {classData.class_average == null ? '—' : classData.class_average.toFixed(1)}
                </strong>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                <span className={`font-semibold ${(classData.pending_assignment_count ?? 0) > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {classData.pending_assignment_count ?? '—'} bài chưa hoàn thành
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                  <Users className="h-4 w-4 text-slate-400" /> {classData.student_count ?? '—'} học sinh
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClassId(classData.id)}
                className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Xem lớp <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </article>
          ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Không tìm thấy lớp phù hợp với bộ lọc.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
