import { useState } from 'react';
import { ArrowRight, BookOpen, Eye, EyeOff, GraduationCap, Shield, Users } from 'lucide-react';
import type { Role } from '@/types';

interface LoginProps {
  error?: string;
  busy?: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
  onDemoLogin?: (role: Role) => Promise<void>;
}

const roles: { value: Role; label: string; icon: typeof Users }[] = [
  { value: 'lecturer', label: 'Giáo viên', icon: GraduationCap },
  { value: 'student', label: 'Học sinh', icon: Users },
  { value: 'admin', label: 'Quản trị viên', icon: Shield },
];

const demoEnabled = import.meta.env.DEV && import.meta.env.VITE_EDUFLOW_DEMO_MODE === 'true';

export function Login({ error, busy = false, onLogin, onDemoLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('lecturer');
  const [showPass, setShowPass] = useState(false);

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onLogin(email, password);
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <form onSubmit={(event) => void submitLogin(event)} className="w-full max-w-sm bg-white border border-slate-300 rounded-xl p-6 shadow-sm">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-800">EduFlow</span>
          </div>

          <h1 className="text-xl font-semibold text-slate-900">Đăng nhập</h1>
          <p className="text-sm text-slate-500 mt-1">Nhập thông tin tài khoản do nhà trường cấp.</p>

          {demoEnabled && onDemoLogin && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">Chế độ demo dành cho phát triển</p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {roles.map((item) => {
                  const Icon = item.icon;
                  const active = role === item.value;
                  return (
                    <button
                      type="button"
                      key={item.value}
                      onClick={() => setRole(item.value)}
                      aria-pressed={active}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg text-center border ${
                        active ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className={`text-xs font-medium ${active ? 'text-blue-700' : 'text-slate-600'}`}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDemoLogin(role)}
                className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-60"
              >
                Vào bản demo
              </button>
            </div>
          )}

          {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-700 mb-1 block">Email</span>
              <input
                required
                type="email"
                autoComplete="username"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@truong.edu.vn"
                className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 mb-1 block">Mật khẩu</span>
              <div className="relative">
                <input
                  required
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-white border border-slate-400 rounded-lg pl-3 pr-9 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((shown) => !shown)}
                  aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="login-primary w-full mt-5 py-2.5 font-medium text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Đang xác thực…' : 'Đăng nhập'}
            {!busy && <ArrowRight className="w-4 h-4" />}
          </button>

          <p className="text-center text-xs text-slate-500 mt-5">
            Chưa có tài khoản? Hãy liên hệ quản trị viên của trường để được cấp lời mời.
          </p>
        </form>
      </div>
    </div>
  );
}
