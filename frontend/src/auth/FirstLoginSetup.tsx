import { useState } from 'react';
import { changePassword, completeProfile, type AuthUser } from './authApi';

interface FirstLoginSetupProps {
  user: AuthUser;
  onComplete: (user: AuthUser) => void;
}

export function FirstLoginSetup({ user, onComplete }: FirstLoginSetupProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState(user.fullName);
  const [grade, setGrade] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [passwordChanged, setPasswordChanged] = useState(!user.mustChangePassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!passwordChanged) {
        if (newPassword !== confirmPassword) throw new Error('Mật khẩu xác nhận không khớp.');
        await changePassword(currentPassword, newPassword);
        setPasswordChanged(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        return;
      }
      const updatedUser = await completeProfile(fullName, { grade, studentNumber, employeeNumber });
      onComplete(updatedUser);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể lưu thiết lập tài khoản.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Thiết lập tài khoản</h1>
          <p className="mt-1 text-sm text-slate-500">
            {!passwordChanged
              ? 'Đổi mật khẩu ban đầu trước khi tiếp tục.'
              : `Hoàn thiện hồ sơ${user.role === 'student' ? ' học sinh' : user.role === 'lecturer' ? ' giáo viên' : ''} để bắt đầu sử dụng EduFlow.`}
          </p>
        </div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {!passwordChanged ? (
          <>
            <label className="block text-sm font-medium text-slate-700">
              Mật khẩu hiện tại
              <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Mật khẩu mới (ít nhất 12 ký tự)
              <input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Nhập lại mật khẩu mới
              <input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
          </>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-700">
              Họ và tên
              <input required minLength={2} maxLength={120} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            {user.role === 'student' && (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  Khối/lớp <span className="font-normal text-slate-500">(không bắt buộc)</span>
                  <input maxLength={80} value={grade} onChange={(event) => setGrade(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Mã học sinh <span className="font-normal text-slate-500">(không bắt buộc)</span>
                  <input maxLength={80} value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
                </label>
              </>
            )}
            {user.role === 'lecturer' && (
              <label className="block text-sm font-medium text-slate-700">
                Mã giáo viên/nhân viên <span className="font-normal text-slate-500">(không bắt buộc)</span>
                <input maxLength={80} value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
            )}
          </>
        )}
        <button disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? 'Đang lưu…' : passwordChanged ? 'Hoàn tất thiết lập' : 'Đổi mật khẩu'}
        </button>
      </form>
    </div>
  );
}
