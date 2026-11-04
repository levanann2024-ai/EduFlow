import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { acceptInvitation, type AuthUser } from './authApi';

interface InvitationAcceptanceProps {
  token: string;
  onAccepted: (user: AuthUser) => void;
}

export function InvitationAcceptance({ token, onAccepted }: InvitationAcceptanceProps) {
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setBusy(true);
    try {
      onAccepted(await acceptInvitation(token, fullName, password));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể hoàn tất lời mời.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600"><BookOpen className="h-4 w-4 text-white" /></span>
          <span className="font-semibold text-slate-800">EduFlow</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Hoàn tất tạo tài khoản</h1>
          <p className="mt-1 text-sm text-slate-500">Đặt thông tin hồ sơ và mật khẩu cho lời mời này.</p>
        </div>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <label className="block text-xs font-medium text-slate-700">
          Họ và tên
          <input required minLength={2} maxLength={120} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Mật khẩu (ít nhất 12 ký tự)
          <input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Nhập lại mật khẩu
          <input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" />
        </label>
        <button disabled={busy} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
        </button>
      </form>
    </div>
  );
}
