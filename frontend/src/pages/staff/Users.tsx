import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, Search, UserPlus, X } from 'lucide-react';
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
  temporaryPassword?: string;
}

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
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'lecturer' | 'admin'>('student');
  const [schoolId, setSchoolId] = useState(currentUser.schoolIds.length === 1 ? currentUser.schoolIds[0] : '');
  const [schoolName, setSchoolName] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState('');
  const [passwordBusyId, setPasswordBusyId] = useState('');
  const [resetCredential, setResetCredential] = useState<{ fullName: string; email: string; password: string; status: UserRecord['status'] } | null>(null);

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
    () => users.filter((user) => (
      (roleFilter === 'all' || user.role === roleFilter)
      && `${user.full_name} ${user.email}`.toLowerCase().includes(query.toLowerCase())
    )),
    [users, query, roleFilter],
  );
  const schoolNames = useMemo(
    () => new Map(schools.map((school) => [school.id, school.name])),
    [schools],
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

  const resetUserPassword = async (user: UserRecord) => {
    if (!window.confirm(`Cấp mật khẩu tạm mới cho ${user.full_name}? Mật khẩu hiện tại sẽ không còn dùng được.`)) return;
    setPasswordBusyId(user.id);
    setResetCredential(null);
    setError('');
    try {
      const result = await requestJson<{ id: string; temporaryPassword: string }>(
        `/api/auth/users/${encodeURIComponent(user.id)}/password-reset`,
        'POST',
      );
      if (!result.user?.temporaryPassword) throw new Error('Phản hồi cấp lại mật khẩu không có mật khẩu tạm.');
      setResetCredential({
        fullName: user.full_name,
        email: user.email,
        password: result.user.temporaryPassword,
        status: user.status,
      });
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Không thể cấp lại mật khẩu.');
    } finally {
      setPasswordBusyId('');
    }
  };

  const copyTemporaryPassword = async () => {
    if (!resetCredential) return;
    try {
      await navigator.clipboard.writeText(resetCredential.password);
      showToast('Đã sao chép mật khẩu tạm.');
    } catch {
      setError('Không thể sao chép. Hãy chọn và sao chép mật khẩu thủ công.');
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
    return (
      <div className="space-y-5">
        <header><h1 className="text-xl font-semibold">Quản lý người dùng</h1><p className="mt-1 text-sm text-slate-500">Quản lý tài khoản giáo viên và học sinh</p></header>
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Phiên demo không được phép xem hoặc thay đổi tài khoản thật. Hãy đăng nhập bằng tài khoản quản trị thật để sử dụng nghiệp vụ này.</p>
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
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          <div className="relative min-w-[220px] max-w-sm flex-1"><Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" /><input className="input-field pl-9" placeholder="Tìm người dùng..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <label className="sr-only" htmlFor="admin-user-role-filter">Lọc theo vai trò</label>
          <select
            id="admin-user-role-filter"
            aria-label="Lọc theo vai trò"
            value={roleFilter}
            onChange={(event) => {
              const { value } = event.target;
              if (value === 'all' || value === 'student' || value === 'lecturer' || value === 'admin') {
                setRoleFilter(value);
              }
            }}
            className="input-field w-auto min-w-40"
          >
            <option value="all">Tất cả vai trò</option>
            <option value="student">Học sinh</option>
            <option value="lecturer">Giáo viên</option>
            <option value="admin">Quản trị viên</option>
          </select>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-4 py-3">Người dùng</th><th className="px-4 py-3">Vai trò</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Trường</th><th className="px-4 py-3">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Đang tải…</td></tr> : filteredUsers.map((user) => <tr key={user.id}><td className="px-4 py-3"><p className="font-medium">{user.full_name}</p><p className="text-slate-500">{user.email}</p></td><td className="px-4 py-3">{user.role === 'lecturer' ? 'Giáo viên' : user.role === 'student' ? 'Học sinh' : user.admin_scope === 'system' ? 'Quản trị viên hệ thống' : 'Quản trị viên trường'}</td><td className="px-4 py-3">{user.status === 'active' ? 'Đang hoạt động' : 'Tạm khóa'}</td><td className="px-4 py-3 text-xs text-slate-500">{user.school_ids?.length ? user.school_ids.map((id) => schoolNames.get(id) ?? 'Trường không hoạt động').join(', ') : user.admin_scope === 'system' ? 'Toàn hệ thống' : 'Chưa gắn trường'}</td><td className="px-4 py-3">{user.role === 'admin' ? <span className="text-xs text-slate-400">—</span> : <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><button type="button" disabled={passwordBusyId === user.id || statusBusyId === user.id || user.id === currentUser.id} onClick={() => void resetUserPassword(user)} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-900 disabled:cursor-wait disabled:opacity-50">{passwordBusyId === user.id ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" />Đang cấp…</> : <><KeyRound className="h-3.5 w-3.5" />Cấp lại mật khẩu</>}</button><button type="button" disabled={statusBusyId === user.id || passwordBusyId === user.id || user.id === currentUser.id} onClick={() => void changeUserStatus(user)} className="text-xs font-medium text-blue-700 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-50">{statusBusyId === user.id ? 'Đang cập nhật…' : user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}</button></div>}</td></tr>)}
          {!loading && filteredUsers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Không tìm thấy người dùng.</td></tr>}
        </tbody></table></div>
      </section>
      {resetCredential && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetCredential(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="temporary-password-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="temporary-password-title" className="text-lg font-semibold text-slate-900">Mật khẩu tạm đã được cấp</h2>
                <p className="mt-1 text-sm text-slate-600">{resetCredential.fullName} · {resetCredential.email}</p>
              </div>
              <button type="button" onClick={() => setResetCredential(null)} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <label htmlFor="temporary-password" className="mt-5 block text-xs font-medium text-slate-600">Mật khẩu mới · 12 ký tự gồm chữ và số</label>
            <input id="temporary-password" readOnly value={resetCredential.password} onFocus={(event) => event.currentTarget.select()} className="input-field mt-1 font-mono text-lg tracking-wider" />
            <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-800">
              Hãy gửi mật khẩu này cho người dùng qua kênh riêng. Họ sẽ cần đổi mật khẩu sau khi đăng nhập; các phiên đăng nhập trước đã bị thu hồi.
              {resetCredential.status === 'disabled' && ' Tài khoản hiện vẫn đang bị khóa, cần mở khóa trước khi người dùng có thể đăng nhập.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setResetCredential(null)} className="btn-ghost">Đóng</button>
              <button type="button" onClick={() => void copyTemporaryPassword()} className="btn-primary"><Copy className="h-4 w-4" /><span>Sao chép mật khẩu</span></button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
