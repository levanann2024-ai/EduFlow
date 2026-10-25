import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Calendar, Clock3, Search, Users } from 'lucide-react';
import { getClass, listClasses, listClassSubjects, type SchoolClass } from '@/api/schoolApi';
import { TeacherClassAssignments } from '@/pages/teacher/TeacherClassAssignments';
import { TeacherClassGradebook } from '@/pages/teacher/TeacherClassGradebook';

const tabs = [
  { id: 'overview', label: 'Thông tin chung', icon: BookOpen },
  { id: 'schedule', label: 'Lịch học', icon: Calendar },
  { id: 'assignments', label: 'Bài tập', icon: BookOpen },
] as const;

type ClassTab = (typeof tabs)[number]['id'];

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

function ClassDetailView({ classId, onBack }: { classId: string; onBack: () => void }) {
  const [classData, setClassData] = useState<SchoolClass | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classError, setClassError] = useState('');
  const [loadingClass, setLoadingClass] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<ClassTab>('overview');

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
      <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-blue-600">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách lớp
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{classData.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Mã lớp: {classData.code} <span className="px-1.5">-</span> Khối: {classData.grade}
            <span className="px-1.5">-</span> Năm học: {classData.academic_year}
          </p>
          <p className="mt-1 text-sm text-slate-500">{classData.school_name}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 pt-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-all ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'overview' && (
        <TeacherClassGradebook
          classId={classData.id}
          academicYear={classData.academic_year}
          subjects={subjects}
        />
      )}
      {activeTab === 'schedule' && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Lịch học lớp {classData.name}</h2>
          <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            API hiện tại chưa cung cấp dữ liệu lịch học của lớp.
          </p>
        </section>
      )}
      {activeTab === 'assignments' && (
        <TeacherClassAssignments
          classId={classData.id}
          academicYear={classData.academic_year}
          className={classData.name}
          subjects={subjects}
        />
      )}
    </div>
  );
}

export function ClassManagement() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

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
      <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Quản lý lớp học</h1>
        <p className="mt-1 text-sm text-slate-600">
          {loading ? 'Đang tải danh sách lớp...' : `Bạn đang được phân công ${classes.length} lớp`}
        </p>
      </section>

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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:gap-4">
          {classes.map((classData, index) => {
            const tones = [
              { border: 'border-l-blue-400', icon: 'bg-blue-50 text-blue-600' },
              { border: 'border-l-emerald-400', icon: 'bg-emerald-50 text-emerald-600' },
              { border: 'border-l-violet-400', icon: 'bg-violet-50 text-violet-600' },
              { border: 'border-l-amber-400', icon: 'bg-amber-50 text-amber-600' },
              { border: 'border-l-cyan-400', icon: 'bg-cyan-50 text-cyan-600' },
              { border: 'border-l-pink-400', icon: 'bg-pink-50 text-pink-600' },
            ];
            const tone = tones[index % tones.length];

            return (
              <button
                key={classData.id}
                type="button"
                onClick={() => setSelectedClassId(classData.id)}
                className={`group flex min-h-[150px] flex-col justify-between rounded-xl border border-slate-200 border-l-4 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md ${tone.border}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.icon}`}>
                      <Users className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-bold text-slate-900">{classData.name}</span>
                      <span className="mt-0.5 block text-sm text-slate-600">Mã lớp: {classData.code}</span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-blue-600 transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-4 block space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
                  <span className="flex items-center gap-2"><Users className="h-4 w-4 text-slate-400" />Khối {classData.grade}</span>
                  <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" />Năm học {classData.academic_year}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
