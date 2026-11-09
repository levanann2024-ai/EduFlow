import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  GraduationCap,
  Plus,
  School,
  Users,
  X,
} from 'lucide-react';
import { fetchAdminApi, useAdminResource } from '@/pages/staff/adminSchoolApi';
import type { Page } from '@/types';

export type AdminSchoolPage = Extract<Page, 'dashboard' | 'admin-years' | 'admin-classes' | 'admin-subjects' | 'admin-assignments'>;

interface AcademicYear {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  status: 'planned' | 'active' | 'closed' | 'legacy';
  is_current: boolean;
}

interface SchoolClass {
  id: string;
  name: string;
  code: string;
  grade: string;
  academic_year: string;
  academic_year_id: string;
  status: string;
  homeroom_teacher_id: string | null;
  homeroom_teacher_name: string | null;
  student_count: number;
  subject_count: number;
  assigned_subject_count: number;
}

interface ClassDetail extends SchoolClass {
  students: Array<{
    user_id: string;
    full_name: string;
    email: string;
    account_status: 'active' | 'disabled';
    student_number: string | null;
  }>;
  teachers: Array<{
    id: string;
    teacher_user_id: string;
    teacher_name: string;
    teacher_email: string;
    subject_id: string;
    subject_name: string;
  }>;
  subjects: Array<{ id: string; name: string; assigned: boolean }>;
  homeroomHistory: Array<{
    teacher_user_id: string;
    teacher_name: string;
    created_at: string;
    ended_at: string | null;
  }>;
}

interface SchoolSubject {
  id: string;
  name: string;
  code: string | null;
  class_count: number;
  teacher_count: number;
}

interface SubjectDetail extends Pick<SchoolSubject, 'id' | 'name' | 'code'> {
  classes: Array<{
    class_id: string;
    class_name: string;
    grade: string;
    academic_year: string;
    assignment_id: string | null;
    teacher_user_id: string | null;
    teacher_name: string | null;
    assigned: boolean;
  }>;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  employee_number: string | null;
}

interface Student {
  id: string;
  full_name: string;
  email: string;
  account_status: 'active' | 'disabled';
  student_number: string | null;
  current_class_id: string | null;
  current_class_name: string | null;
}

interface TeachingAssignment {
  id: string;
  class_id: string;
  class_name: string;
  grade: string;
  academic_year_id: string;
  academic_year: string;
  subject_id: string;
  subject_name: string;
  teacher_user_id: string;
  teacher_name: string;
}

interface AdminOverviewData {
  current_year_id: string | null;
  current_year_name: string | null;
  student_count: number;
  teacher_count: number;
  class_count: number;
  subject_count: number;
  missingHomeroomClasses: Array<{ class_id: string; class_name: string }>;
  unassignedSubjects: Array<{ class_id: string; class_name: string; subject_name: string }>;
}

function queryPath(base: string, values: Record<string, string>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.toString();
  return suffix ? `${base}?${suffix}` : base;
}

function formatDate(value: string | null) {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function StatusBadge({ children, positive = true }: { children: string; positive?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${positive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {children}
    </span>
  );
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </header>
  );
}

function DataState({ loading, error, empty, children }: {
  loading: boolean;
  error: string;
  empty?: boolean;
  children?: ReactNode;
}) {
  if (loading) return <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Đang tải dữ liệu...</p>;
  if (error) return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>;
  if (empty) return <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Chưa có dữ liệu phù hợp.</p>;
  return children ?? null;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="admin-form-title" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="admin-form-title" className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function useMutationError() {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const run = useCallback(async (action: () => Promise<void>) => {
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : 'Không thể lưu thay đổi.');
    } finally {
      setSaving(false);
    }
  }, []);
  return { error, saving, setError, run };
}

function OverviewPage({ schoolId, onNavigate }: { schoolId: string; onNavigate: (page: Page) => void }) {
  const { data, loading, error } = useAdminResource<{ overview: AdminOverviewData }>(
    schoolId ? `/schools/${schoolId}/overview` : null,
  );
  const overview = data?.overview;

  return (
    <div className="space-y-6">
      <PageHeader title="Tổng quan" description="Tình hình tổ chức trường học và những mục cần được xử lý." />
      <DataState loading={loading} error={error}>
        {overview && <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><CalendarDays className="h-5 w-5" /></span><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Năm học hiện hành</p><p className="mt-0.5 font-semibold text-slate-900">{overview.current_year_name || 'Chưa thiết lập'}</p></div></div>
            <button type="button" onClick={() => onNavigate('admin-years')} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900">Quản lý năm học<ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Học sinh', value: overview.student_count, icon: Users },
              { label: 'Giáo viên', value: overview.teacher_count, icon: GraduationCap },
              { label: 'Lớp học', value: overview.class_count, icon: School },
              { label: 'Môn học', value: overview.subject_count, icon: BookOpen },
            ].map((item) => {
              const Icon = item.icon;
              return <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{item.label}</p><Icon className="h-4 w-4 text-slate-400" /></div><p className="mt-3 text-2xl font-semibold tabular-nums text-slate-950">{item.value}</p></div>;
            })}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5"><div><h2 className="font-semibold text-slate-900">Lớp chưa có giáo viên chủ nhiệm</h2><p className="mt-0.5 text-xs text-slate-500">{overview.current_year_name || 'Chưa có năm học hiện hành'}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{overview.missingHomeroomClasses.length} lớp</span></div>
              {overview.missingHomeroomClasses.length
                ? <div className="divide-y divide-slate-100">{overview.missingHomeroomClasses.map((item) => <div key={item.class_id} className="flex items-center justify-between gap-3 px-4 py-3"><p className="font-medium text-slate-800">{item.class_name}</p><button type="button" onClick={() => onNavigate('admin-classes')} className="text-sm font-medium text-blue-700">Xem lớp</button></div>)}</div>
                : <p className="px-4 py-6 text-sm text-slate-500">Không có lớp nào cần phân công GVCN.</p>}
            </section>
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5"><div><h2 className="font-semibold text-slate-900">Môn/lớp chưa được phân công</h2><p className="mt-0.5 text-xs text-slate-500">Phân công bộ môn còn thiếu</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{overview.unassignedSubjects.length} mục</span></div>
              {overview.unassignedSubjects.length
                ? <div className="divide-y divide-slate-100">{overview.unassignedSubjects.map((item) => <div key={`${item.class_id}-${item.subject_name}`} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="font-medium text-slate-800">{item.subject_name} · {item.class_name}</p><p className="text-xs text-slate-500">Chưa có giáo viên phụ trách</p></div><button type="button" onClick={() => onNavigate('admin-assignments')} className="text-sm font-medium text-blue-700">Phân công</button></div>)}</div>
                : <p className="px-4 py-6 text-sm text-slate-500">Không có môn/lớp nào đang thiếu phân công.</p>}
            </section>
          </div>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2"><CircleAlert className="h-4 w-4 text-slate-400" /><h2 className="font-semibold text-slate-900">Hoạt động quản trị gần đây</h2></div>
            <p className="mt-2 text-sm text-slate-500">Chưa có audit log quản trị được kết nối. Hoạt động mẫu không được hiển thị.</p>
          </section>
        </>}
      </DataState>
    </div>
  );
}

function AcademicYearsPage({ schoolId }: { schoolId: string }) {
  const { data, loading, error, reload } = useAdminResource<{ years: AcademicYear[] }>(
    schoolId ? `/schools/${schoolId}/academic-years` : null,
  );
  const { error: saveError, saving, run } = useMutationError();
  const [editing, setEditing] = useState<AcademicYear | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [status, setStatus] = useState<AcademicYear['status']>('planned');

  const openForm = (year?: AcademicYear) => {
    setEditing(year ?? null);
    setName(year?.name ?? '');
    setStartsOn(year?.starts_on?.slice(0, 10) ?? '');
    setEndsOn(year?.ends_on?.slice(0, 10) ?? '');
    setStatus(year?.status ?? 'planned');
    setDialogOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await run(async () => {
      const path = `/schools/${schoolId}/academic-years${editing ? `/${editing.id}` : ''}`;
      await fetchAdminApi(path, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ name, startsOn, endsOn, status }),
      });
      setDialogOpen(false);
      reload();
    });
  };

  const setCurrent = async (year: AcademicYear) => run(async () => {
    await fetchAdminApi(`/schools/${schoolId}/academic-years/${year.id}/current`, { method: 'POST' });
    reload();
  });

  const closeYear = async (year: AcademicYear) => {
    if (!window.confirm(`Đóng năm học ${year.name}?`)) return;
    await run(async () => {
      await fetchAdminApi(`/schools/${schoolId}/academic-years/${year.id}/close`, { method: 'PATCH' });
      reload();
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Năm học" description="Quản lý thời gian và cơ cấu lớp học theo từng năm học." action={<button type="button" onClick={() => openForm()} className="btn-primary"><Plus className="h-4 w-4" />Tạo năm học</button>} />
      <p className="text-xs text-slate-500">Năm học có dữ liệu liên quan được lưu trữ, không xóa vật lý.</p>
      {saveError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{saveError}</p>}
      <DataState loading={loading} error={error} empty={!data?.years.length}>
        {data && <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Năm học</th><th className="px-4 py-3">Ngày bắt đầu</th><th className="px-4 py-3">Ngày kết thúc</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.years.map((year) => <tr key={year.id} className="hover:bg-slate-50/70">
            <td className="px-4 py-4 font-medium text-slate-900">{year.name}{year.is_current && <span className="ml-2 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">Hiện hành</span>}</td>
            <td className="px-4 py-4 text-slate-600">{formatDate(year.starts_on)}</td><td className="px-4 py-4 text-slate-600">{formatDate(year.ends_on)}</td>
            <td className="px-4 py-4"><StatusBadge positive={year.status === 'active'}>{year.status === 'legacy' ? 'Dữ liệu cũ' : year.status === 'closed' ? 'Đã kết thúc' : year.status === 'active' ? 'Đang hoạt động' : 'Sắp diễn ra'}</StatusBadge></td>
            <td className="px-4 py-4 text-right"><div className="inline-flex flex-wrap justify-end gap-1">
              <button type="button" onClick={() => openForm(year)} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50">Chỉnh sửa</button>
              {!year.is_current && year.status !== 'closed' && <button type="button" onClick={() => void setCurrent(year)} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50">Đặt hiện hành</button>}
              {year.status !== 'closed' && <button type="button" onClick={() => void closeYear(year)} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Đóng năm học</button>}
            </div></td>
          </tr>)}</tbody>
        </table></div></div>}
      </DataState>
      {dialogOpen && <Modal title={editing ? 'Chỉnh sửa năm học' : 'Tạo năm học'} onClose={() => setDialogOpen(false)}>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs font-medium text-slate-700">Tên năm học<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="input-field mt-1" placeholder="Ví dụ: 2027-2028" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700">Ngày bắt đầu<input required type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className="input-field mt-1" /></label>
            <label className="block text-xs font-medium text-slate-700">Ngày kết thúc<input required type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className="input-field mt-1" /></label>
          </div>
          <label className="block text-xs font-medium text-slate-700">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as AcademicYear['status'])} className="input-field mt-1"><option value="planned">Sắp diễn ra</option><option value="active">Đang hoạt động</option><option value="closed">Đã kết thúc</option><option value="legacy">Dữ liệu cũ</option></select></label>
          {saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setDialogOpen(false)} className="btn-ghost">Hủy</button><button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button></div>
        </form>
      </Modal>}
    </div>
  );
}

function ClassesPage({ schoolId }: { schoolId: string }) {
  const yearsResource = useAdminResource<{ years: AcademicYear[] }>(schoolId ? `/schools/${schoolId}/academic-years` : null);
  const teachersResource = useAdminResource<{ teachers: Teacher[] }>(schoolId ? `/schools/${schoolId}/teachers` : null);
  const [yearId, setYearId] = useState('');
  const [grade, setGrade] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState<'Tổng quan' | 'Học sinh' | 'Giáo viên' | 'Môn học'>('Tổng quan');
  const [dialog, setDialog] = useState<'class' | 'student' | ''>('');
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [name, setName] = useState('');
  const [classGrade, setClassGrade] = useState('10');
  const [formYearId, setFormYearId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [subjectToAdd, setSubjectToAdd] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [homeroomTeacherId, setHomeroomTeacherId] = useState('');
  const [homeroomSaving, setHomeroomSaving] = useState(false);
  const [homeroomError, setHomeroomError] = useState('');
  const [membershipError, setMembershipError] = useState('');
  const years = useMemo(() => yearsResource.data?.years ?? [], [yearsResource.data]);

  useEffect(() => {
    if (!yearId && years.length) setYearId(years.find((year) => year.is_current)?.id ?? years[0].id);
  }, [yearId, years]);

  const classPath = schoolId
    ? queryPath(`/schools/${schoolId}/classes`, { yearId, grade, q: query, page: String(page), pageSize: '25' })
    : null;
  const classesResource = useAdminResource<{ items: SchoolClass[]; total: number; page: number; pageSize: number }>(classPath);
  const detailResource = useAdminResource<{ classroom: ClassDetail }>(
    schoolId && selectedId ? `/schools/${schoolId}/classes/${selectedId}` : null,
  );
  const selectedClass = detailResource.data?.classroom;
  const classSubjectsResource = useAdminResource<{ subjects: SchoolSubject[] }>(
    schoolId && selectedClass ? `/schools/${schoolId}/subjects?yearId=${selectedClass.academic_year_id}` : null,
  );
  const studentPath = schoolId && selectedId && detailResource.data?.classroom.academic_year_id
    ? `/schools/${schoolId}/students?yearId=${detailResource.data.classroom.academic_year_id}`
    : null;
  const studentsResource = useAdminResource<{ students: Student[] }>(studentPath);
  const classRows = classesResource.data?.items ?? [];
  const teachers = teachersResource.data?.teachers ?? [];
  const studentsToAdd = (studentsResource.data?.students ?? []).filter((student) => student.current_class_id !== selectedId);

  const openClassForm = (classroom?: SchoolClass) => {
    setEditing(classroom ?? null);
    setName(classroom?.name ?? '');
    setClassGrade(classroom?.grade ?? '10');
    setFormYearId(classroom?.academic_year_id ?? yearId);
    setDialog('class');
  };

  const submitClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await fetchAdminApi(`/schools/${schoolId}/classes${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ name, grade: classGrade, academicYearId: formYearId }),
      });
      setDialog('');
      classesResource.reload();
    } catch (error: unknown) {
      setMembershipError(error instanceof Error ? error.message : 'Không thể lưu lớp học.');
    }
  };

  const assignHomeroom = async () => {
    if (!selectedClass || !homeroomTeacherId) return;
    setHomeroomSaving(true);
    setHomeroomError('');
    try {
      await fetchAdminApi(`/schools/${schoolId}/classes/${selectedClass.id}/homeroom`, {
        method: 'PUT',
        body: JSON.stringify({ teacherUserId: homeroomTeacherId }),
      });
      setHomeroomTeacherId('');
      detailResource.reload();
      classesResource.reload();
    } catch (error: unknown) {
      setHomeroomError(error instanceof Error ? error.message : 'Không thể cập nhật GVCN.');
    } finally {
      setHomeroomSaving(false);
    }
  };

  const addClassSubject = async () => {
    if (!selectedClass || !subjectToAdd) return;
    setSubjectError('');
    try {
      await fetchAdminApi(`/schools/${schoolId}/classes/${selectedClass.id}/subjects`, {
        method: 'POST',
        body: JSON.stringify({ subjectId: subjectToAdd }),
      });
      setSubjectToAdd('');
      detailResource.reload();
      classSubjectsResource.reload();
      classesResource.reload();
    } catch (error: unknown) {
      setSubjectError(error instanceof Error ? error.message : 'Không thể thêm môn học vào lớp.');
    }
  };

  const saveMembership = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClass || !studentId) return;
    try {
      await fetchAdminApi(`/schools/${schoolId}/classes/${selectedClass.id}/students`, {
        method: 'POST',
        body: JSON.stringify({ studentUserId: studentId }),
      });
      setDialog('');
      setStudentId('');
      detailResource.reload();
      classesResource.reload();
      studentsResource.reload();
    } catch (error: unknown) {
      setMembershipError(error instanceof Error ? error.message : 'Không thể cập nhật thành viên lớp.');
    }
  };

  const endMembership = async (student: ClassDetail['students'][number]) => {
    if (!selectedClass || !window.confirm(`Gỡ ${student.full_name} khỏi lớp? Lịch sử thành viên và kết quả học tập sẽ được giữ nguyên.`)) return;
    setMembershipError('');
    try {
      await fetchAdminApi(`/schools/${schoolId}/classes/${selectedClass.id}/students/${student.user_id}`, { method: 'DELETE' });
      detailResource.reload();
      classesResource.reload();
    } catch (error: unknown) {
      setMembershipError(error instanceof Error ? error.message : 'Không thể kết thúc thành viên lớp.');
    }
  };

  const endHomeroom = async () => {
    if (!selectedClass || !window.confirm(`Kết thúc phân công GVCN của lớp ${selectedClass.name}? Lịch sử sẽ được giữ nguyên.`)) return;
    setHomeroomError('');
    try {
      await fetchAdminApi(`/schools/${schoolId}/classes/${selectedClass.id}/homeroom`, { method: 'DELETE' });
      detailResource.reload();
      classesResource.reload();
    } catch (error: unknown) {
      setHomeroomError(error instanceof Error ? error.message : 'Không thể kết thúc phân công GVCN.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Lớp học" description="Quản lý lớp theo năm học, khối lớp và giáo viên chủ nhiệm." action={<button type="button" onClick={() => openClassForm()} disabled={!years.length} className="btn-primary disabled:opacity-50"><Plus className="h-4 w-4" />Tạo lớp</button>} />
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="input-field min-w-[220px] flex-1" placeholder="Tìm tên lớp hoặc GVCN..." />
        <select value={yearId} onChange={(event) => { setYearId(event.target.value); setPage(1); }} className="input-field w-auto min-w-40"><option value="">Tất cả năm học</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select>
        <select value={grade} onChange={(event) => { setGrade(event.target.value); setPage(1); }} className="input-field w-auto min-w-36"><option value="">Tất cả khối</option><option value="10">10</option><option value="11">11</option><option value="12">12</option></select>
      </div>
      {classesResource.error && <p role="alert" className="text-sm text-rose-700">{classesResource.error}</p>}
      <DataState loading={yearsResource.loading || classesResource.loading} error={yearsResource.error} empty={!classRows.length}>
        {classesResource.data && <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Tên lớp</th><th className="px-4 py-3">Khối</th><th className="px-4 py-3">Năm học</th><th className="px-4 py-3">GVCN</th><th className="px-4 py-3">Sĩ số</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{classRows.map((classroom) => <tr key={classroom.id} className="hover:bg-slate-50/70">
              <td className="px-4 py-3.5 font-semibold text-slate-900">{classroom.name}</td><td className="px-4 py-3.5 text-slate-600">{classroom.grade}</td><td className="px-4 py-3.5 text-slate-600">{classroom.academic_year}</td>
              <td className={`px-4 py-3.5 ${classroom.homeroom_teacher_name ? 'text-slate-600' : 'font-medium text-amber-700'}`}>{classroom.homeroom_teacher_name || 'Chưa phân công'}</td>
              <td className="px-4 py-3.5 tabular-nums text-slate-600">{classroom.student_count}</td>
              <td className="px-4 py-3.5 text-right"><button type="button" onClick={() => { setSelectedId(classroom.id); setTab('Tổng quan'); setMembershipError(''); }} className="rounded-lg px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50">Chi tiết</button><button type="button" onClick={() => openClassForm(classroom)} className="rounded-lg px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50">Sửa</button></td>
            </tr>)}</tbody>
          </table></div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>{classesResource.data.total} lớp</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">Trước</button><span>Trang {page} / {Math.max(1, Math.ceil(classesResource.data.total / classesResource.data.pageSize))}</span><button type="button" disabled={page >= Math.ceil(classesResource.data.total / classesResource.data.pageSize)} onClick={() => setPage((value) => value + 1)} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">Sau</button></div></div>
        </div>}
      </DataState>
      {selectedClass && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Chi tiết lớp</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{selectedClass.name} <span className="text-sm font-normal text-slate-500">· Khối {selectedClass.grade} · {selectedClass.academic_year}</span></h2></div><button type="button" onClick={() => setSelectedId('')} aria-label="Đóng chi tiết lớp" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3">{(['Tổng quan', 'Học sinh', 'Giáo viên', 'Môn học'] as const).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${tab === item ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}</button>)}</div>
        <DataState loading={detailResource.loading} error={detailResource.error}>
          {tab === 'Tổng quan' && <div className="grid gap-4 p-4 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Giáo viên chủ nhiệm</p><p className="mt-1 font-medium text-slate-900">{selectedClass.homeroom_teacher_name || 'Chưa phân công'}</p></div><div><p className="text-xs text-slate-500">Sĩ số</p><p className="mt-1 font-medium text-slate-900">{selectedClass.students.length} học sinh</p></div><div><p className="text-xs text-slate-500">Môn học đã phân công</p><p className="mt-1 font-medium text-slate-900">{selectedClass.assigned_subject_count}/{selectedClass.subject_count} môn</p></div></div>}
          {tab === 'Học sinh' && <div className="space-y-3 p-4">
            <div className="flex justify-end"><button type="button" onClick={() => { setStudentId(''); setMembershipError(''); setDialog('student'); }} className="btn-ghost"><Plus className="h-4 w-4" />Thêm/chuyển học sinh</button></div>
            {membershipError && <p role="alert" className="text-sm text-rose-700">{membershipError}</p>}
            {selectedClass.students.length
              ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><tr><th className="px-3 py-2">Học sinh</th><th className="px-3 py-2">Mã học sinh</th><th className="px-3 py-2">Tài khoản</th><th className="px-3 py-2 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedClass.students.map((student) => <tr key={student.user_id}><td className="px-3 py-3"><p className="font-medium text-slate-800">{student.full_name}</p><p className="text-xs text-slate-500">{student.email}</p></td><td className="px-3 py-3 text-slate-600">{student.student_number || '—'}</td><td className="px-3 py-3"><StatusBadge positive={student.account_status === 'active'}>{student.account_status === 'active' ? 'Hoạt động' : 'Tạm khóa'}</StatusBadge></td><td className="px-3 py-3 text-right"><button type="button" onClick={() => void endMembership(student)} className="rounded px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50">Gỡ khỏi lớp</button></td></tr>)}</tbody></table></div>
              : <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Lớp chưa có học sinh.</p>}
            <p className="text-xs text-slate-500">Chuyển hoặc gỡ học sinh chỉ kết thúc thành viên lớp; bài nộp, điểm số và lịch sử được giữ nguyên.</p>
          </div>}
          {tab === 'Giáo viên' && <div className="space-y-4 p-4">
            <div className="rounded-lg border border-slate-100 p-3"><p className="text-xs font-medium text-slate-500">Giáo viên chủ nhiệm</p><p className="mt-1 font-medium text-slate-900">{selectedClass.homeroom_teacher_name || 'Chưa phân công'}</p><div className="mt-3 flex flex-wrap gap-2"><select value={homeroomTeacherId} onChange={(event) => setHomeroomTeacherId(event.target.value)} className="input-field w-auto min-w-64"><option value="">Chọn giáo viên đang hoạt động</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name} · {teacher.email}</option>)}</select><button type="button" disabled={!homeroomTeacherId || homeroomSaving} onClick={() => void assignHomeroom()} className="btn-primary disabled:opacity-50">{homeroomSaving ? 'Đang lưu...' : 'Cập nhật GVCN'}</button>{selectedClass.homeroom_teacher_id && <button type="button" onClick={() => void endHomeroom()} className="btn-ghost">Kết thúc phân công</button>}</div>{homeroomError && <p role="alert" className="mt-2 text-sm text-rose-700">{homeroomError}</p>}</div>
            <div><p className="mb-2 text-xs font-medium text-slate-500">Giáo viên bộ môn</p>{selectedClass.teachers.length ? <div className="space-y-2">{selectedClass.teachers.map((teacher) => <div key={teacher.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"><span className="text-sm text-slate-700">{teacher.subject_name}</span><span className="text-sm font-medium text-slate-800">{teacher.teacher_name}</span></div>)}</div> : <p className="text-sm text-slate-500">Chưa có giáo viên bộ môn được phân công.</p>}</div>
            {selectedClass.homeroomHistory.length > 0 && <div><p className="mb-2 text-xs font-medium text-slate-500">Lịch sử GVCN</p><ul className="space-y-1 text-sm text-slate-600">{selectedClass.homeroomHistory.map((item) => <li key={`${item.teacher_user_id}-${item.created_at}`}>{item.teacher_name} · {formatDate(item.created_at)}{item.ended_at ? ` – ${formatDate(item.ended_at)}` : ' · hiện tại'}</li>)}</ul></div>}
          </div>}
          {tab === 'Môn học' && <div className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2"><select value={subjectToAdd} onChange={(event) => setSubjectToAdd(event.target.value)} className="input-field w-auto min-w-56"><option value="">Chọn môn trong danh mục trường</option>{(classSubjectsResource.data?.subjects ?? []).filter((subject) => !selectedClass.subjects.some((item) => item.id === subject.id)).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><button type="button" disabled={!subjectToAdd} onClick={() => void addClassSubject()} className="btn-ghost disabled:opacity-50"><Plus className="h-4 w-4" />Thêm môn học</button></div>
            {subjectError && <p role="alert" className="text-sm text-rose-700">{subjectError}</p>}
            {classSubjectsResource.error && <p role="alert" className="text-sm text-rose-700">{classSubjectsResource.error}</p>}
            {selectedClass.subjects.length ? selectedClass.subjects.map((subject) => <div key={subject.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5"><span className="text-sm font-medium text-slate-800">{subject.name}</span><span className={`text-xs ${subject.assigned ? 'text-emerald-700' : 'text-amber-700'}`}>{subject.assigned ? 'Đã phân công' : 'Chưa phân công'}</span></div>) : <p className="text-sm text-slate-500">Chưa có môn học được tổ chức cho lớp này.</p>}
            <p className="text-xs text-slate-500">Môn đã được tổ chức không bị xóa khỏi lịch sử; hãy kết thúc phân công giáo viên riêng nếu không còn phụ trách.</p>
          </div>}
        </DataState>
      </section>}
      {dialog === 'class' && <Modal title={editing ? 'Chỉnh sửa lớp học' : 'Tạo lớp'} onClose={() => setDialog('')}>
        <form onSubmit={submitClass} className="space-y-4">
          <label className="block text-xs font-medium text-slate-700">Tên lớp<input required maxLength={50} value={name} onChange={(event) => setName(event.target.value)} className="input-field mt-1" /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-medium text-slate-700">Khối lớp<select value={classGrade} onChange={(event) => setClassGrade(event.target.value)} className="input-field mt-1"><option value="10">10</option><option value="11">11</option><option value="12">12</option></select></label><label className="block text-xs font-medium text-slate-700">Năm học<select required disabled={Boolean(editing)} value={formYearId} onChange={(event) => setFormYearId(event.target.value)} className="input-field mt-1 disabled:bg-slate-50"><option value="">Chọn năm học</option>{years.filter((year) => year.status !== 'closed').map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label></div>
          {membershipError && <p role="alert" className="text-sm text-rose-700">{membershipError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setDialog('')} className="btn-ghost">Hủy</button><button type="submit" className="btn-primary">Lưu</button></div>
        </form>
      </Modal>}
      {dialog === 'student' && selectedClass && <Modal title="Thêm hoặc chuyển học sinh" onClose={() => setDialog('')}>
        <form onSubmit={saveMembership} className="space-y-4">
          <label className="block text-xs font-medium text-slate-700">Học sinh<select required value={studentId} onChange={(event) => setStudentId(event.target.value)} className="input-field mt-1"><option value="">Chọn học sinh đang thuộc trường</option>{studentsToAdd.map((student) => <option key={student.id} value={student.id}>{student.full_name} · {student.current_class_name ? `Đang học ${student.current_class_name}` : 'Chưa có lớp'} · {student.email}</option>)}</select></label>
          <p className="text-xs leading-5 text-slate-500">Nếu học sinh đang ở lớp khác trong cùng năm học, thành viên lớp cũ sẽ được kết thúc trước khi chuyển. Lịch sử học tập không bị xóa.</p>
          {membershipError && <p role="alert" className="text-sm text-rose-700">{membershipError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setDialog('')} className="btn-ghost">Hủy</button><button type="submit" className="btn-primary">Lưu</button></div>
        </form>
      </Modal>}
    </div>
  );
}

function SubjectsPage({ schoolId }: { schoolId: string }) {
  const yearsResource = useAdminResource<{ years: AcademicYear[] }>(schoolId ? `/schools/${schoolId}/academic-years` : null);
  const [yearId, setYearId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Pick<SchoolSubject, 'id' | 'name' | 'code'> | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const years = useMemo(() => yearsResource.data?.years ?? [], [yearsResource.data]);
  useEffect(() => {
    if (!yearId && years.length) setYearId(years.find((year) => year.is_current)?.id ?? years[0].id);
  }, [yearId, years]);
  const path = schoolId ? queryPath(`/schools/${schoolId}/subjects`, { yearId }) : null;
  const subjectsResource = useAdminResource<{ subjects: SchoolSubject[] }>(path);
  const detailPath = schoolId && selectedId ? queryPath(`/schools/${schoolId}/subjects/${selectedId}`, { yearId }) : null;
  const detailResource = useAdminResource<{ subject: SubjectDetail }>(detailPath);

  const openForm = (subject?: Pick<SchoolSubject, 'id' | 'name' | 'code'>) => {
    setEditing(subject ?? null);
    setName(subject?.name ?? '');
    setCode(subject?.code ?? '');
    setSaveError('');
    setDialogOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await fetchAdminApi(`/schools/${schoolId}/subjects${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ name, code }),
      });
      setDialogOpen(false);
      subjectsResource.reload();
      if (editing) detailResource.reload();
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Không thể lưu môn học.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Môn học" description="Danh mục môn học của trường; phân công giáo viên được quản lý riêng theo lớp." action={<button type="button" onClick={() => openForm()} className="btn-primary"><Plus className="h-4 w-4" />Thêm môn học</button>} />
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"><label className="text-xs font-medium text-slate-600">Năm học<select value={yearId} onChange={(event) => { setYearId(event.target.value); setSelectedId(''); }} className="input-field mt-1 min-w-40"><option value="">Chọn năm học</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label><p className="text-xs text-slate-500">Số lớp và giáo viên được tính theo năm học đang chọn.</p></div>
      <DataState loading={yearsResource.loading || subjectsResource.loading} error={subjectsResource.error || yearsResource.error} empty={!subjectsResource.data?.subjects.length}>
        {subjectsResource.data && <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Tên môn</th><th className="px-4 py-3">Mã môn</th><th className="px-4 py-3">Số lớp</th><th className="px-4 py-3">Số giáo viên</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{subjectsResource.data.subjects.map((subject) => <tr key={subject.id} className="hover:bg-slate-50/70"><td className="px-4 py-3.5 font-medium text-slate-900">{subject.name}</td><td className="px-4 py-3.5 font-mono text-xs text-slate-600">{subject.code || '—'}</td><td className="px-4 py-3.5 tabular-nums text-slate-600">{subject.class_count}</td><td className="px-4 py-3.5 tabular-nums text-slate-600">{subject.teacher_count}</td><td className="px-4 py-3.5 text-right"><button type="button" onClick={() => setSelectedId(selectedId === subject.id ? '' : subject.id)} className="rounded-lg px-2.5 py-1.5 font-medium text-blue-700 hover:bg-blue-50">Chi tiết</button><button type="button" onClick={() => openForm(subject)} className="rounded-lg px-2.5 py-1.5 font-medium text-blue-700 hover:bg-blue-50">Sửa</button></td></tr>)}</tbody>
        </table></div></div>}
      </DataState>
      {selectedId && detailResource.data?.subject && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Chi tiết môn học · {years.find((year) => year.id === yearId)?.name || 'Năm học'}</p><h2 className="mt-1 font-semibold text-slate-900">{detailResource.data.subject.name} <span className="font-mono text-xs font-normal text-slate-500">{detailResource.data.subject.code || '—'}</span></h2></div><button type="button" onClick={() => openForm(detailResource.data?.subject)} className="btn-ghost">Chỉnh sửa danh mục</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Lớp</th><th className="px-4 py-3">Giáo viên được phân công</th><th className="px-4 py-3">Trạng thái phân công</th></tr></thead><tbody className="divide-y divide-slate-100">{detailResource.data.subject.classes.map((item) => <tr key={`${item.class_id}-${item.teacher_user_id ?? 'unassigned'}`}><td className="px-4 py-3 font-medium text-slate-900">{item.class_name} · Khối {item.grade}</td><td className="px-4 py-3 text-slate-700">{item.teacher_name || 'Chưa phân công'}</td><td className={`px-4 py-3 text-xs ${item.assigned ? 'text-emerald-700' : 'font-medium text-amber-700'}`}>{item.assigned ? 'Đã phân công' : 'Chưa phân công'}</td></tr>)}{detailResource.data.subject.classes.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">Chưa có lớp tổ chức môn học này trong năm học đã chọn.</td></tr>}</tbody></table></div>
        {detailResource.error && <p role="alert" className="p-3 text-sm text-rose-700">{detailResource.error}</p>}
      </section>}
      {dialogOpen && <Modal title={editing ? 'Chỉnh sửa môn học' : 'Thêm môn học'} onClose={() => setDialogOpen(false)}>
        <form onSubmit={submit} className="space-y-4"><label className="block text-xs font-medium text-slate-700">Tên môn<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="input-field mt-1" /></label><label className="block text-xs font-medium text-slate-700">Mã môn<input required maxLength={32} value={code} onChange={(event) => setCode(event.target.value)} className="input-field mt-1" /></label>{saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setDialogOpen(false)} className="btn-ghost">Hủy</button><button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button></div></form>
      </Modal>}
    </div>
  );
}

function AssignmentsPage({ schoolId }: { schoolId: string }) {
  const yearsResource = useAdminResource<{ years: AcademicYear[] }>(schoolId ? `/schools/${schoolId}/academic-years` : null);
  const teachersResource = useAdminResource<{ teachers: Teacher[] }>(schoolId ? `/schools/${schoolId}/teachers` : null);
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<'create' | TeachingAssignment | null>(null);
  const [newClassId, setNewClassId] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newTeacherId, setNewTeacherId] = useState('');
  const [replacementTeacherId, setReplacementTeacherId] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [saving, setSaving] = useState(false);
  const years = useMemo(() => yearsResource.data?.years ?? [], [yearsResource.data]);
  useEffect(() => {
    if (!yearId && years.length) setYearId(years.find((year) => year.is_current)?.id ?? years[0].id);
  }, [yearId, years]);
  const classesPath = schoolId ? queryPath(`/schools/${schoolId}/classes`, { yearId, pageSize: '100' }) : null;
  const classesResource = useAdminResource<{ items: SchoolClass[] }>(classesPath);
  const subjectsPath = schoolId ? queryPath(`/schools/${schoolId}/subjects`, { yearId }) : null;
  const subjectsResource = useAdminResource<{ subjects: SchoolSubject[] }>(subjectsPath);
  const assignmentsPath = schoolId ? queryPath(`/schools/${schoolId}/assignments`, {
    yearId,
    classId,
    subjectId,
    teacherId,
  }) : null;
  const assignmentsResource = useAdminResource<{ assignments: TeachingAssignment[] }>(assignmentsPath);
  const assignments = useMemo(() => assignmentsResource.data?.assignments ?? [], [assignmentsResource.data]);
  const filtered = useMemo(() => assignments.filter((item) => (
    `${item.class_name} ${item.subject_name} ${item.teacher_name}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))
  )), [assignments, query]);
  const yearClasses = classesResource.data?.items ?? [];
  const subjects = subjectsResource.data?.subjects ?? [];
  const teachers = teachersResource.data?.teachers ?? [];

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const editing = dialog && typeof dialog === 'object' ? dialog : null;
    setSaving(true);
    setMutationError('');
    try {
      if (editing) {
        await fetchAdminApi(`/schools/${schoolId}/assignments/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ teacherUserId: replacementTeacherId }),
        });
      } else {
        await fetchAdminApi(`/schools/${schoolId}/assignments`, {
          method: 'POST',
          body: JSON.stringify({ academicYearId: yearId, classId: newClassId, subjectId: newSubjectId, teacherUserId: newTeacherId }),
        });
      }
      setDialog(null);
      setReplacementTeacherId('');
      assignmentsResource.reload();
      classesResource.reload();
      subjectsResource.reload();
    } catch (error: unknown) {
      setMutationError(error instanceof Error ? error.message : 'Không thể lưu phân công.');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (assignment: TeachingAssignment) => {
    if (!window.confirm(`Kết thúc phân công ${assignment.subject_name} của ${assignment.teacher_name} tại lớp ${assignment.class_name}? Lịch sử sẽ được giữ nguyên.`)) return;
    setMutationError('');
    try {
      await fetchAdminApi(`/schools/${schoolId}/assignments/${assignment.id}`, { method: 'DELETE' });
      assignmentsResource.reload();
      classesResource.reload();
      subjectsResource.reload();
    } catch (error: unknown) {
      setMutationError(error instanceof Error ? error.message : 'Không thể kết thúc phân công.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Phân công giảng dạy" description="Quản lý giáo viên phụ trách môn học theo từng lớp và năm học." action={<button type="button" onClick={() => { setMutationError(''); setDialog('create'); }} disabled={!yearId} className="btn-primary disabled:opacity-50"><Plus className="h-4 w-4" />Tạo phân công</button>} />
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="input-field min-w-[220px] flex-1" placeholder="Tìm lớp, môn hoặc giáo viên..." />
        <select value={yearId} onChange={(event) => { setYearId(event.target.value); setClassId(''); setSubjectId(''); }} className="input-field w-auto min-w-40"><option value="">Tất cả năm học</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select>
        <select value={classId} onChange={(event) => setClassId(event.target.value)} className="input-field w-auto min-w-32"><option value="">Tất cả lớp</option>{yearClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="input-field w-auto min-w-36"><option value="">Tất cả môn học</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="input-field w-auto min-w-36"><option value="">Tất cả giáo viên</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</select>
      </div>
      {mutationError && <p role="alert" className="text-sm text-rose-700">{mutationError}</p>}
      <DataState loading={yearsResource.loading || classesResource.loading || subjectsResource.loading || assignmentsResource.loading} error={assignmentsResource.error || yearsResource.error} empty={!filtered.length}>
        {assignmentsResource.data && <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[740px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Lớp</th><th className="px-4 py-3">Môn học</th><th className="px-4 py-3">Giáo viên</th><th className="px-4 py-3">Loại phân công</th><th className="px-4 py-3">Năm học</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{filtered.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3.5 font-semibold text-slate-900">{item.class_name}</td><td className="px-4 py-3.5 text-slate-700">{item.subject_name}</td><td className="px-4 py-3.5 text-slate-700">{item.teacher_name}</td><td className="px-4 py-3.5 text-slate-600">Bộ môn</td><td className="px-4 py-3.5 text-slate-600">{item.academic_year}</td><td className="px-4 py-3.5 text-right"><button type="button" onClick={() => { setDialog(item); setReplacementTeacherId(item.teacher_user_id); setMutationError(''); }} className="rounded-lg px-2 py-1.5 font-medium text-blue-700 hover:bg-blue-50">Sửa</button><button type="button" onClick={() => void revoke(item)} className="rounded-lg px-2 py-1.5 font-medium text-rose-700 hover:bg-rose-50">Gỡ</button></td></tr>)}</tbody>
        </table></div><div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{filtered.length} phân công hiển thị</div></div>}
      </DataState>
      <p className="text-xs text-slate-500">GVCN là quan hệ riêng, không hiển thị như phân công bộ môn. Thay đổi và gỡ phân công đều lưu lịch sử.</p>
      {dialog && <Modal title={typeof dialog === 'object' ? `Đổi giáo viên · ${dialog.class_name} · ${dialog.subject_name}` : 'Tạo phân công'} onClose={() => setDialog(null)}>
        <form onSubmit={save} className="space-y-4">
          {typeof dialog === 'object'
            ? <label className="block text-xs font-medium text-slate-700">Giáo viên<select required value={replacementTeacherId} onChange={(event) => setReplacementTeacherId(event.target.value)} className="input-field mt-1"><option value="">Chọn giáo viên đang hoạt động</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name} · {teacher.email}</option>)}</select></label>
            : <>
              <label className="block text-xs font-medium text-slate-700">Năm học<select required value={yearId} onChange={(event) => setYearId(event.target.value)} className="input-field mt-1"><option value="">Chọn năm học</option>{years.filter((year) => year.status !== 'closed').map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
              <label className="block text-xs font-medium text-slate-700">Lớp<select required value={newClassId} onChange={(event) => setNewClassId(event.target.value)} className="input-field mt-1"><option value="">Chọn lớp</option>{yearClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="block text-xs font-medium text-slate-700">Môn học<select required value={newSubjectId} onChange={(event) => setNewSubjectId(event.target.value)} className="input-field mt-1"><option value="">Chọn môn học</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="block text-xs font-medium text-slate-700">Giáo viên<select required value={newTeacherId} onChange={(event) => setNewTeacherId(event.target.value)} className="input-field mt-1"><option value="">Chọn giáo viên đang hoạt động</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name} · {teacher.email}</option>)}</select></label>
            </>}
          {mutationError && <p role="alert" className="text-sm text-rose-700">{mutationError}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setDialog(null)} className="btn-ghost">Hủy</button><button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu'}</button></div>
        </form>
      </Modal>}
    </div>
  );
}

export function AdminSchoolManagement({ page, schoolId, onNavigate }: {
  page: AdminSchoolPage;
  schoolId: string;
  onNavigate: (page: Page) => void;
}) {
  switch (page) {
    case 'dashboard': return <OverviewPage schoolId={schoolId} onNavigate={onNavigate} />;
    case 'admin-years': return <AcademicYearsPage schoolId={schoolId} />;
    case 'admin-classes': return <ClassesPage schoolId={schoolId} />;
    case 'admin-subjects': return <SubjectsPage schoolId={schoolId} />;
    case 'admin-assignments': return <AssignmentsPage schoolId={schoolId} />;
  }
}
