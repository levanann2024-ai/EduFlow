import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Eye } from 'lucide-react';
import type { AuthUser } from '@/auth/authApi';
import type { Page } from '@/types';
import { AdminSchoolManagement, type AdminSchoolPage } from '@/pages/staff/AdminSchoolManagement';
import { Users } from '@/pages/staff/Users';
import { useAdminResource } from '@/pages/staff/adminSchoolApi';

type AdminPage = Extract<Page, 'dashboard' | 'admin-years' | 'admin-classes' | 'admin-subjects' | 'admin-assignments' | 'users' | 'admin-storage' | 'analytics'>;

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

function StoragePage() {
  return <div className="space-y-5"><PageHeader title="Lưu trữ hệ thống" description="Theo dõi trạng thái và lịch sử sao lưu dữ liệu trường." /><section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-semibold text-amber-900">Chức năng chưa khả dụng</h2><p className="mt-1 text-sm text-amber-800">Backend hiện chưa cung cấp dịch vụ sao lưu hoặc danh sách bản sao lưu. Không có thao tác sao lưu nào được thực hiện.</p></section></div>;
}

function AnalyticsPage() {
  return <div className="space-y-5"><PageHeader title="Thống kê hệ thống" description="Theo dõi hoạt động tổng thể của EduFlow." /><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Đang chờ triển khai</h2><p className="mt-1 text-sm text-slate-500">Chưa có API thống kê tổng hợp. Không hiển thị số liệu minh họa như dữ liệu thật.</p></section></div>;
}

interface AdminSchool {
  id: string;
  name: string;
}

export function AdminDashboard({ page, schoolId, onSchoolIdChange, onNavigate, currentUser }: {
  page: AdminPage;
  schoolId: string;
  onSchoolIdChange: (schoolId: string) => void;
  onNavigate: (page: Page) => void;
  currentUser?: AuthUser;
}) {
  const needsSchool = ['dashboard', 'admin-years', 'admin-classes', 'admin-subjects', 'admin-assignments'].includes(page);
  const schoolsResource = useAdminResource<{ schools: AdminSchool[] }>(needsSchool ? '/schools' : null);
  const schools = useMemo(() => schoolsResource.data?.schools ?? [], [schoolsResource.data]);

  useEffect(() => {
    if (!needsSchool || schoolsResource.loading || schoolsResource.error) return;
    if (schools.length && !schools.some((school) => school.id === schoolId)) {
      onSchoolIdChange(schools[0].id);
    }
    if (!schools.length && schoolId) onSchoolIdChange('');
  }, [needsSchool, schools, schoolsResource.error, schoolsResource.loading, schoolId, onSchoolIdChange]);

  const pageContent = (() => {
    if (needsSchool) {
      return schoolId
        ? <AdminSchoolManagement page={page as AdminSchoolPage} schoolId={schoolId} onNavigate={onNavigate} />
        : null;
    }
    if (page === 'users') {
      return currentUser
        ? <Users currentUser={currentUser} />
        : <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">Thiếu thông tin phiên quản trị để tải người dùng.</p>;
    }
    if (page === 'admin-storage') return <StoragePage />;
    return <AnalyticsPage />;
  })();
  const isPrototypePage = page === 'admin-storage' || page === 'analytics';

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5 pb-8">
      {needsSchool && schools.length > 1 && <div className="flex flex-wrap items-center justify-end gap-2"><label className="text-xs font-medium text-slate-600">Trường<select value={schoolId} onChange={(event) => onSchoolIdChange(event.target.value)} className="input-field ml-2 w-auto min-w-52">{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label></div>}
      {needsSchool && schoolsResource.error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{schoolsResource.error}</p>}
      {needsSchool && schoolsResource.loading && <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">Đang tải phạm vi trường học...</p>}
      {needsSchool && !schoolsResource.loading && !schoolsResource.error && !schools.length && <p className="rounded-lg border border-slate-200 bg-white px-3 py-5 text-center text-sm text-slate-500">Tài khoản quản trị chưa có trường học đang hoạt động trong phạm vi truy cập.</p>}
      {isPrototypePage && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-900"><span className="inline-flex items-center gap-2 font-medium"><Eye className="h-4 w-4" />Prototype · Các thao tác chưa kết nối nghiệp vụ thật</span><span className="text-blue-700">Dữ liệu minh họa</span></div>}
      {pageContent}
    </div>
  );
}
