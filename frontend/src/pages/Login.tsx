import { useState } from 'react';
import { BookOpen, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  error?: string;
  busy?: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
}

export function Login({ error, busy = false, onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onLogin(email, password);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center sm:min-h-[calc(100vh-7rem)]">
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-9 sm:py-10">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">EduFlow</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Chào mừng bạn đến với EduFlow
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Nền tảng hỗ trợ dạy và học thông minh
          </p>

          <form onSubmit={(event) => void submitLogin(event)} className="mt-8">
            {error && (
              <p role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
                {error}
              </p>
            )}

            <div className="space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
                <input
                  required
                  type="email"
                  autoComplete="username"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@school.edu.vn"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Mật khẩu</span>
                <span className="relative block">
                  <input
                    required
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-3.5 pr-11 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((shown) => !shown)}
                    aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-pressed={showPass}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 transition hover:text-slate-800"
                  >
                    {showPass
                      ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                      : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="login-primary mt-7 w-full rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>

            <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
              EduFlow đang trong giai đoạn thử nghiệm. Một số tính năng có thể chưa hoàn thiện. Mọi góp ý của bạn đều giúp chúng tôi cải thiện hệ thống.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
