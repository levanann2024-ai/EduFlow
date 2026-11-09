import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Eye,
  KeyRound,
  LockKeyhole,
  LogOut,
  MoreVertical,
  Plus,
  Trash2,
  UnlockKeyhole,
  X,
} from 'lucide-react';
import type { Page } from '@/types';
import { AdminSchoolManagement, type AdminSchoolPage } from '@/pages/staff/AdminSchoolManagement';
import { useAdminResource } from '@/pages/staff/adminSchoolApi';

type AdminPage = Extract<Page, 'dashboard' | 'admin-years' | 'admin-classes' | 'admin-subjects' | 'admin-assignments' | 'users' | 'admin-storage' | 'analytics'>;
type UserTab = 'Tất cả người dùng' | 'Học sinh' | 'Giáo viên';

const prototypeUsers = [
  { id: 'u1', name: 'Thầy Nguyễn A', email: 'teacher01@example.invalid', role: 'Giáo viên', status: 'Hoạt động', createdAt: '12/08/2025', studentCode: '', teacherCode: 'GV-001', className: '', academicYear: '', subjects: ['Hóa học', 'Sinh học'], teachingClasses: ['11A2', '11A1'], homeroom: false, lastLogin: 'Không có trong API hiện tại' },
  { id: 'u2', name: 'Cô Trần B', email: 'teacher02@example.invalid', role: 'Giáo viên', status: 'Hoạt động', createdAt: '20/08/2025', studentCode: '', teacherCode: 'GV-002', className: '', academicYear: '', subjects: ['Tiếng Anh'], teachingClasses: ['11A2', '11A1', '10A1'], homeroom: true, lastLogin: 'Không có trong API hiện tại' },
  { id: 'u3', name: 'Học sinh minh họa 01', email: 'student01@example.invalid', role: 'Học sinh', status: 'Hoạt động', createdAt: '01/09/2025', studentCode: 'HS-11021', teacherCode: '', className: '11A2', academicYear: 'Minh họa', subjects: [], teachingClasses: [], homeroom: false, lastLogin: 'Không có trong API hiện tại' },
  { id: 'u4', name: 'Học sinh minh họa 02', email: 'student02@example.invalid', role: 'Học sinh', status: 'Tạm khóa', createdAt: '01/09/2025', studentCode: 'HS-11022', teacherCode: '', className: '11A2', academicYear: 'Minh họa', subjects: [], teachingClasses: [], homeroom: false, lastLogin: 'Không có trong API hiện tại' },
  { id: 'u5', name: 'Thầy Lê C', email: 'teacher03@example.invalid', role: 'Giáo viên', status: 'Hoạt động', createdAt: '20/08/2025', studentCode: '', teacherCode: 'GV-003', className: '', academicYear: '', subjects: ['Toán'], teachingClasses: ['11A2', '10A1', '12A1'], homeroom: false, lastLogin: 'Không có trong API hiện tại' },
  { id: 'u6', name: 'Cô Phạm D', email: 'teacher04@example.invalid', role: 'Giáo viên', status: 'Hoạt động', createdAt: '20/08/2025', studentCode: '', teacherCode: 'GV-004', className: '', academicYear: '', subjects: ['Ngữ văn'], teachingClasses: ['11A2', '11A1', '10A1'], homeroom: false, lastLogin: 'Không có trong API hiện tại' },
];

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

function PrototypeDialog({ title, onClose }: { title: string; onClose: () => void }) {
  const action = ['Cấp lại mật khẩu', 'Thu hồi phiên đăng nhập', 'Khóa tài khoản', 'Mở khóa tài khoản', 'Xóa tài khoản'].find((item) => title.startsWith(item));
  const isDanger = action === 'Xóa tài khoản';
  const actionMessage = action === 'Cấp lại mật khẩu'
    ? 'Quy trình thật sẽ gửi lời mời đặt mật khẩu mới hoặc cấp mật khẩu tạm bắt buộc đổi ở lần đăng nhập đầu tiên. Không thể xem hoặc truy xuất mật khẩu cũ.'
    : action === 'Thu hồi phiên đăng nhập'
      ? 'Các phiên đang hoạt động sẽ bị thu hồi và người dùng phải đăng nhập lại. Thao tác này chưa khả dụng.'
      : action === 'Khóa tài khoản'
        ? 'Khóa tài khoản sẽ chặn đăng nhập nhưng không xóa hồ sơ, lớp thành viên hay lịch sử học tập.'
        : action === 'Mở khóa tài khoản'
          ? 'Mở khóa cho phép tài khoản đăng nhập trở lại; dữ liệu học tập được giữ nguyên.'
          : 'Xóa tài khoản có thể ảnh hưởng hồ sơ và dữ liệu liên quan. Đây không phải thao tác gỡ học sinh khỏi lớp; lịch sử học tập cần được bảo toàn.';
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="prototype-dialog-title" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><h2 id="prototype-dialog-title" className="text-lg font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">Prototype — chưa lưu dữ liệu thật.</p></div><button type="button" onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
        <div className={`mt-5 rounded-lg border p-4 text-sm leading-6 ${isDanger ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><p>{actionMessage}</p></div>
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="btn-ghost">Đóng</button><button type="button" disabled className={`cursor-not-allowed rounded-lg px-3 py-2 text-sm font-medium text-white opacity-50 ${isDanger ? 'bg-rose-700' : 'bg-blue-700'}`}>Chưa khả dụng</button></div>
      </section>
    </div>
  );
}

function UsersPage({ onOpenDialog }: { onOpenDialog: (title: string) => void }) {
  const [tab, setTab] = useState<UserTab>('Tất cả người dùng');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('Tất cả vai trò');
  const [status, setStatus] = useState('Mọi trạng thái');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const filtered = useMemo(() => prototypeUsers.filter((item) => (
    (tab === 'Tất cả người dùng' || item.role === tab)
    && `${item.name} ${item.email}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))
    && (roleFilter === 'Tất cả vai trò' || item.role === roleFilter)
    && (status === 'Mọi trạng thái' || item.status === status)
  )), [query, roleFilter, status, tab]);
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleUsers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedUser = prototypeUsers.find((item) => item.id === selectedUserId);
  const showUserProfile = (userId: string) => {
    setOpenMenuId('');
    setSelectedUserId(userId);
  };
  const openAction = (action: string, user: (typeof prototypeUsers)[number]) => {
    setOpenMenuId('');
    onOpenDialog(`${action} — ${user.name}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Người dùng" description="Quản lý tài khoản và trạng thái truy cập. Các thao tác tài khoản vẫn là prototype." action={<button type="button" onClick={() => onOpenDialog('Tạo lời mời tài khoản')} className="btn-primary"><Plus className="h-4 w-4" />Tạo tài khoản</button>} />
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">{(['Tất cả người dùng', 'Học sinh', 'Giáo viên'] as UserTab[]).map((item) => <button type="button" key={item} onClick={() => { setTab(item); setPage(1); }} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${tab === item ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{item}</button>)}</div>
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative min-w-[220px] flex-1"><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="input-field" placeholder="Tìm theo họ tên hoặc email..." /></div>
        <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="input-field w-auto min-w-36"><option>Tất cả vai trò</option><option>Học sinh</option><option>Giáo viên</option></select>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="input-field w-auto min-w-36"><option>Mọi trạng thái</option><option>Hoạt động</option><option>Tạm khóa</option></select>
      </div>
      {selectedUser && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hồ sơ minh họa</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{selectedUser.name}</h2><p className="mt-0.5 text-sm text-slate-500">{selectedUser.email}</p></div><div className="flex items-center gap-2"><StatusBadge positive={selectedUser.status === 'Hoạt động'}>{selectedUser.status}</StatusBadge><button type="button" onClick={() => setSelectedUserId('')} aria-label="Đóng hồ sơ" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div></div>
        <div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-xs text-slate-500">Ngày tạo tài khoản</p><p className="mt-1 text-sm font-medium text-slate-800">{selectedUser.createdAt}</p></div><div><p className="text-xs text-slate-500">Lần đăng nhập gần nhất</p><p className="mt-1 text-sm text-slate-600">{selectedUser.lastLogin}</p></div>
          {selectedUser.role === 'Học sinh'
            ? <><div><p className="text-xs text-slate-500">Mã học sinh</p><p className="mt-1 text-sm font-medium text-slate-800">{selectedUser.studentCode}</p></div><div><p className="text-xs text-slate-500">Lớp hiện tại</p><p className="mt-1 text-sm font-medium text-slate-800">{selectedUser.className} · {selectedUser.academicYear}</p></div><div className="sm:col-span-2 lg:col-span-3"><p className="text-xs text-slate-500">Lịch sử thành viên lớp</p><p className="mt-1 text-sm text-slate-600">Thông tin minh họa; dữ liệu hồ sơ thật chưa kết nối.</p></div></>
            : <><div><p className="text-xs text-slate-500">Mã giáo viên</p><p className="mt-1 text-sm font-medium text-slate-800">{selectedUser.teacherCode || 'Chưa có mã'}</p></div><div><p className="text-xs text-slate-500">Vai trò GVCN</p><p className="mt-1 text-sm font-medium text-slate-800">{selectedUser.homeroom ? 'Có · lớp minh họa' : 'Không'}</p></div><div className="sm:col-span-2 lg:col-span-3"><p className="text-xs text-slate-500">Các lớp đang giảng dạy</p><p className="mt-1 text-sm font-medium text-slate-800">{selectedUser.teachingClasses.join(', ') || 'Chưa có phân công'}</p><p className="mt-3 text-xs text-slate-500">Môn phụ trách</p><p className="mt-1 text-sm font-medium text-slate-800">{selectedUser.subjects.join(', ') || 'Chưa có phân công'}</p></div></>}
        </div>
      </section>}
      <div className="overflow-visible rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[690px] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Người dùng</th><th className="px-4 py-3">Vai trò</th><th className="px-4 py-3">Trạng thái tài khoản</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{visibleUsers.map((item) => <Fragment key={item.id}><tr className="hover:bg-slate-50/70"><td className="px-4 py-3"><p className="font-medium text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.email}</p></td><td className="px-4 py-3 text-slate-600">{item.role}</td><td className="px-4 py-3"><StatusBadge positive={item.status === 'Hoạt động'}>{item.status}</StatusBadge></td><td className="px-4 py-3 text-right"><div className="inline-flex items-center gap-1"><button type="button" onClick={() => showUserProfile(item.id)} className="rounded-lg px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50">Chi tiết</button><button type="button" aria-label={`Thao tác với ${item.name}`} aria-expanded={openMenuId === item.id} onClick={() => setOpenMenuId(openMenuId === item.id ? '' : item.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><MoreVertical className="h-4 w-4" /></button></div></td></tr>
          {openMenuId === item.id && <tr><td colSpan={4} className="bg-slate-50/70 px-4 py-3"><div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => showUserProfile(item.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" />Xem hồ sơ</button>
            <button type="button" onClick={() => openAction('Cấp lại mật khẩu', item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"><KeyRound className="h-3.5 w-3.5" />Cấp lại mật khẩu</button>
            <button type="button" onClick={() => openAction('Thu hồi phiên đăng nhập', item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"><LogOut className="h-3.5 w-3.5" />Thu hồi phiên đăng nhập</button>
            <button type="button" onClick={() => openAction(item.status === 'Hoạt động' ? 'Khóa tài khoản' : 'Mở khóa tài khoản', item)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">{item.status === 'Hoạt động' ? <LockKeyhole className="h-3.5 w-3.5" /> : <UnlockKeyhole className="h-3.5 w-3.5" />}{item.status === 'Hoạt động' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}</button>
            <button type="button" onClick={() => openAction('Xóa tài khoản', item)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" />Xóa tài khoản</button>
          </div></td></tr>}</Fragment>)}
          {visibleUsers.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">Không tìm thấy người dùng phù hợp.</td></tr>}</tbody>
      </table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3"><p className="text-xs text-slate-500">Hiển thị {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} trong {filtered.length} người dùng minh họa</p><div className="flex items-center gap-2"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Trước</button><span className="text-xs text-slate-500">Trang {currentPage} / {pageCount}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Sau</button></div></div></div>
    </div>
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

export function AdminDashboard({ page, schoolId, onSchoolIdChange, onNavigate }: {
  page: AdminPage;
  schoolId: string;
  onSchoolIdChange: (schoolId: string) => void;
  onNavigate: (page: Page) => void;
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

  const [dialogTitle, setDialogTitle] = useState('');
  const openDialog = (title: string) => setDialogTitle(title);
  const pageContent = (() => {
    if (needsSchool) {
      return schoolId
        ? <AdminSchoolManagement page={page as AdminSchoolPage} schoolId={schoolId} onNavigate={onNavigate} />
        : null;
    }
    if (page === 'users') return <UsersPage onOpenDialog={openDialog} />;
    if (page === 'admin-storage') return <StoragePage />;
    return <AnalyticsPage />;
  })();
  const isPrototypePage = page === 'users' || page === 'admin-storage' || page === 'analytics';

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5 pb-8">
      {needsSchool && schools.length > 1 && <div className="flex flex-wrap items-center justify-end gap-2"><label className="text-xs font-medium text-slate-600">Trường<select value={schoolId} onChange={(event) => onSchoolIdChange(event.target.value)} className="input-field ml-2 w-auto min-w-52">{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label></div>}
      {needsSchool && schoolsResource.error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{schoolsResource.error}</p>}
      {needsSchool && schoolsResource.loading && <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">Đang tải phạm vi trường học...</p>}
      {needsSchool && !schoolsResource.loading && !schoolsResource.error && !schools.length && <p className="rounded-lg border border-slate-200 bg-white px-3 py-5 text-center text-sm text-slate-500">Tài khoản quản trị chưa có trường học đang hoạt động trong phạm vi truy cập.</p>}
      {isPrototypePage && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-900"><span className="inline-flex items-center gap-2 font-medium"><Eye className="h-4 w-4" />Prototype · Các thao tác chưa kết nối nghiệp vụ thật</span><span className="text-blue-700">Dữ liệu minh họa</span></div>}
      {pageContent}
      {dialogTitle && <PrototypeDialog title={dialogTitle} onClose={() => setDialogTitle('')} />}
    </div>
  );
}
