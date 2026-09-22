import { useState } from 'react';
import { BookOpen, Mail, Lock, Eye, EyeOff, ArrowRight, GraduationCap, Users, Shield } from 'lucide-react';
import type { Role } from '@/types';

interface LoginProps {
  onLogin: (role: Role) => void;
}

const roles: { value: Role; label: string; icon: typeof Users; desc: string }[] = [
  { value: 'lecturer', label: 'Giáo viên', icon: GraduationCap, desc: 'Quản lý lớp, tạo bài giảng, đề kiểm tra' },
  { value: 'student', label: 'Học sinh', icon: Users, desc: 'Học bài, làm bài tập, hỏi đáp AI' },
  { value: 'admin', label: 'Quản trị viên', icon: Shield, desc: 'Quản lý hệ thống, người dùng, thống kê' },
];

export function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<Role>('lecturer');
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm bg-white border border-slate-300 rounded-xl p-6 shadow-sm">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-800">EduFlow</span>
          </div>

          <h1 className="text-xl font-semibold text-slate-900">
            {mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'login' ? 'Chọn vai trò và nhập thông tin' : 'Điền thông tin để đăng ký'}
          </p>

          {/* Role selector */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            {roles.map((r) => {
              const Icon = r.icon;
              const active = role === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg text-center transition-colors border ${
                    active ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`text-xs font-medium ${active ? 'text-blue-700' : 'text-slate-600'}`}>{r.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2 min-h-[32px]">{roles.find((r) => r.value === role)?.desc}</p>

          {/* Form Inputs */}
          <div className="mt-4 space-y-3">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-medium text-slate-700 mb-1 block">Họ và tên</label>
                <input 
                  type="text" 
                  placeholder="Nguyễn Văn An" 
                  className="w-full bg-white border border-slate-400 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="email" 
                  placeholder="email@truong.edu.vn" 
                  className="w-full bg-white border border-slate-400 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 mb-1 block">Mật khẩu</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type={showPass ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  className="w-full bg-white border border-slate-400 rounded-lg pl-9 pr-9 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                />
                <button 
                  type="button"
                  onClick={() => setShowPass(!showPass)} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {mode === 'login' && (
            <div className="flex items-center justify-between mt-3">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input type="checkbox" className="rounded border-slate-400 text-blue-600 focus:ring-blue-500 w-4 h-4" />
                Ghi nhớ đăng nhập
              </label>
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">Quên mật khẩu?</button>
            </div>
          )}

          {/* Nút Đăng nhập/Đăng ký chính: Màu xanh đậm + Chữ trắng chắc chắn hiển thị */}
          <button
            onClick={() => onLogin(role)}
            className="login-primary w-full mt-5 py-2.5 font-medium text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">hoặc</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Nút Đăng nhập với Google: Có border xám rõ ràng */}
          <button className="login-google w-full py-2.5 font-medium text-sm transition-colors flex items-center justify-center gap-2 shadow-xs">
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Đăng nhập với Google
          </button>

          <p className="text-center text-xs text-slate-600 mt-5">
            {mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
            <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-blue-600 hover:text-blue-700 font-medium">
              {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}