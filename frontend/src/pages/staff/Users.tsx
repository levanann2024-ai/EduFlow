import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Search, UserPlus } from 'lucide-react';
import { authenticatedFetch } from '@/auth/authApi';
import { showToast } from '@/components/toast';
import type { AuthUser } from '@/auth/authApi';
import type { Role } from '@/types';

interface School {
  id: string;
  name: string;
}

interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  admin_scope: 'system' | 'school' | null;
  status: 'active' | 'disabled';
  school_ids: string[];
}

interface ApiResult<T> {
  success: boolean;
  message?: string;
  user?: T;
  users?: T;
  schools?: T;
  school?: T;
  invitationToken?: string;
}

const demoUsers = [
  { name: 'Giáo viên mẫu 01', email: 'teacher01@example.invalid', role: 'Giáo viên', status: 'Đang hoạt động' },
  { name: 'Giáo viên mẫu 02', email: 'teacher02@example.invalid', role: 'Giáo viên', status: 'Đang hoạt động' },
  { name: 'Học sinh mẫu 01', email: 'student01@example.invalid', role: 'Học sinh', status: 'Đang hoạt động' },
  { name: 'Học sinh mẫu 02', email: 'student02@example.invalid', role: 'Học sinh', status: 'Tạm khóa' },
];

async function requestJson<T>(path: string, method = 'GET', body?: unknown): Promise<ApiResult<T>> {
  const response = await authenticatedFetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let result: ApiResult<T>;
  try {
    result = await response.json() as ApiResult<T>;
  } catch {
    throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
  }
  if (!response.ok || !result.success) throw new Error(result.message || 'Không thể hoàn tất yêu cầu.');
  return result;
}

export function Users({ currentUser }: { currentUser: AuthUser }) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'lecturer' | 'admin'>('student');
  const [schoolId, setSchoolId] = useState(currentUser.schoolIds.length === 1 ? currentUser.schoolIds[0] : '');
  const [schoolName, setSchoolName] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResult, schoolsResult] = await Promise.all([
        requestJson<UserRecord[]>('/api/auth/users'),
        requestJson<School[]>('/api/auth/schools'),
      ]);
      setUsers(usersResult.users ?? []);
      setSchools(schoolsResult.schools ?? []);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu người dùng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser.isDemo) void loadData();
  }, [currentUser.isDemo, loadData]);

  const filteredUsers = useMemo(
    () => users.filter((user) => `${user.full_name} ${user.email}`.toLowerCase().includes(query.toLowerCase())),
    [users, query],
  );

  const createSchool = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      const result = await requestJson<School>('/api/auth/schools', 'POST', { name: schoolName });
      const school = result.school;
      if (!school) throw new Error('Phản hồi tạo trường thiếu thông tin.');
      setSchools((existing) => [...existing, school]);
      setSchoolId(school.id);
      setSchoolName('');
      showToast('Đã tạo trường.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không thể tạo trường.');
    }
  };

  const createInvitation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInviteLink('');
    try {
      const result = await requestJson<never>('/api/auth/invitations', 'POST', { email, role, schoolId });
      if (!result.invitationToken) throw new Error('Phản hồi tạo lời mời thiếu mã token.');
      setInviteLink(`${window.location.origin}/#invite=${encodeURIComponent(result.invitationToken)}`);
      setEmail('');
      showToast('Đã tạo lời mời. Hãy gửi liên kết bảo mật này cho người được mời.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không thể tạo lời mời.');
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast('Đã sao chép liên kết lời mời.');
      setError('');
    } catch {
      setError('Không thể sao chép. Hãy chọn và sao chép liên kết thủ công.');
    }
  };

  const changeUserStatus = async (user: UserRecord) => {
    const status = user.status === 'active' ? 'disabled' : 'active';
    const action = status === 'disabled' ? 'khóa' : 'mở khóa';
    if (!window.confirm(`Bạn có chắc muốn ${action} tài khoản ${user.full_name}?`)) return;

    setStatusBusyId(user.id);
    setError('');
    try {
      const result = await requestJson<{ id: string; status: 'active' | 'disabled' }>(
        `/api/auth/users/${encodeURIComponent(user.id)}/status`,
        'PATCH',
        { status },
      );
      if (!result.user) throw new Error('Phản hồi cập nhật thiếu trạng thái tài khoản.');
      setUsers((existing) => existing.map((item) => (
        item.id === result.user?.id ? { ...item, status: result.user.status } : item
      )));
      showToast(status === 'disabled'
        ? `Đã khóa tài khoản ${user.full_name} và thu hồi các phiên đăng nhập.`
        : `Đã mở khóa tài khoản ${user.full_name}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Không thể cập nhật trạng thái tài khoản.');
    } finally {
      setStatusBusyId('');
    }
  };

  if (currentUser.isDemo) {
    const visibleDemoUsers = demoUsers.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase()));
    return (
      <div className="space-y-5">
        <header><h1 className="text-xl font-semibold">Quản lý người dùng</h1><p className="mt-1 text-sm text-slate-500">Quản lý tài khoản giáo viên và học sinh</p></header>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Đang xem dữ liệu minh họa trong chế độ demo. Tài khoản demo không thể tạo lời mời thật.</p>
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 p-4"><div className="relative max-w-sm"><Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" /><input className="input-field pl-9" placeholder="Tìm người dùng..." value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-3">Người dùng</th><th className="px-4 py-3">Vai trò</th><th className="px-4 py-3">Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleDemoUsers.map((user) => <tr key={user.email}><td className="px-4 py-3"><p className="font-medium">{user.name}</p><p className="text-slate-500">{user.email}</p></td><td className="px-4 py-3">{user.role}</td><td className="px-4 py-3">{user.status}</td></tr>)}</tbody></table></div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-xl font-semibold">Quản lý người dùng</h1><p className="mt-1 text-sm text-slate-500">Quản lý tài khoản giáo viên và học sinh trong phạm vi được cấp.</p></div>
        <button type="button" onClick={() => void loadData()} className="btn-ghost">Làm mới</button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {currentUser.adminScope === 'system' && (
        <form onSubmit={(event) => void createSchool(event)} className="card flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-[220px] flex-1 text-xs font-medium text-slate-700">
            Tạo trường
            <input required minLength={2} maxLength={160} value={schoolName} onChange={(event) => setSchoolName(event.target.value)} className="input-field mt-1" placeholder="Tên trường" />
          </label>
          <button className="btn-primary" type="submit">Tạo trường</button>
        </form>
      )}

      <form onSubmit={(event) => void createInvitation(event)} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-slate-700">Email người được mời<input required type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="input-field mt-1" /></label>
        <label className="text-xs font-medium text-slate-700">Vai trò<select value={role} onChange={(event) => setRole(event.target.value as 'student' | 'lecturer' | 'admin')} className="input-field mt-1"><option value="student">Học sinh</option><option value="lecturer">Giáo viên</option>{currentUser.adminScope === 'system' && <option value="admin">Quản trị viên trường</option>}</select></label>
        <label className="text-xs font-medium text-slate-700">Trường<select required value={schoolId} onChange={(event) => setSchoolId(event.target.value)} className="input-field mt-1"><option value="">Chọn trường</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        <button disabled={!schoolId} type="submit" className="btn-primary self-end disabled:cursor-not-allowed disabled:opacity-60"><UserPlus className="h-4 w-4" />Tạo lời mời</button>
        {inviteLink && <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><input readOnly value={inviteLink} aria-label="Liên kết lời mời" className="input-field min-w-0 flex-1" /><button type="button" onClick={() => void copyInviteLink()} className="btn-ghost"><Copy className="h-4 w-4" />Sao chép</button></div>}
      </form>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4"><div className="relative max-w-sm"><Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" /><input className="input-field pl-9" placeholder="Tìm người dùng..." value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-3">Người dùng</th><th className="px-4 py-3">Vai trò</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Mã trường</th><th className="px-4 py-3">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Đang tải…</td></tr> : filteredUsers.map((user) => <tr key={user.id}><td className="px-4 py-3"><p className="font-medium">{user.full_name}</p><p className="text-slate-500">{user.email}</p></td><td className="px-4 py-3">{user.role === 'lecturer' ? 'Giáo viên' : user.role === 'student' ? 'Học sinh' : user.admin_scope === 'system' ? 'Quản trị viên hệ thống' : 'Quản trị viên trường'}</td><td className="px-4 py-3">{user.status === 'active' ? 'Đang hoạt động' : 'Tạm khóa'}</td><td className="px-4 py-3 font-mono text-xs text-slate-500">{user.school_ids?.join(', ') || 'Toàn hệ thống'}</td><td className="px-4 py-3">{user.role === 'admin' ? <span className="text-xs text-slate-400">—</span> : <button type="button" disabled={statusBusyId === user.id || user.id === currentUser.id} onClick={() => void changeUserStatus(user)} className="text-xs font-medium text-blue-700 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-50">{statusBusyId === user.id ? 'Đang cập nhật…' : user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}</button>}</td></tr>)}
          {!loading && filteredUsers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Không tìm thấy người dùng.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
