import { useState } from 'react';
import { Check, LockKeyhole, Mail, Palette, Server, ShieldCheck, UserRound } from 'lucide-react';
import type { Role } from '@/types';

export function Settings({ role }: { role: Role }) {
  const [saved, setSaved] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [webNotifications, setWebNotifications] = useState(true);

  const save = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="max-w-4xl space-y-8 animate-fadeIn">
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Thông tin tài khoản</h2>
        <p className="text-sm text-slate-500 mt-1">Cập nhật thông tin hiển thị và thông tin liên hệ của bạn.</p>
        <div className="card p-6 mt-4 space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
            <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center font-semibold text-lg">
              {role === 'admin' ? 'AD' : role === 'lecturer' ? 'GV' : 'SV'}
            </div>
            <div><p className="font-medium text-slate-900">Người dùng EduFlow</p><p className="text-sm text-slate-500 mt-1">Ảnh đại diện hiển thị trong hệ thống</p></div>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <label><span className="text-sm font-medium text-slate-700">Họ và tên</span><div className="relative mt-2"><UserRound className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" /><input className="input-field pl-10" defaultValue={role === 'lecturer' ? 'Nguyễn Văn An' : role === 'student' ? 'Lê Quốc Bảo' : 'Quản trị viên EduFlow'} /></div></label>
            <label><span className="text-sm font-medium text-slate-700">Email liên hệ</span><div className="relative mt-2"><Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" /><input className="input-field pl-10" defaultValue="user@eduflow.edu.vn" /></div></label>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Bảo mật</h2>
        <p className="text-sm text-slate-500 mt-1">Bảo vệ tài khoản và quản lý phiên đăng nhập.</p>
        <div className="card p-6 mt-4 space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            <label><span className="text-sm font-medium text-slate-700">Mật khẩu hiện tại</span><input type="password" className="input-field mt-2" placeholder="Nhập mật khẩu hiện tại" /></label>
            <label><span className="text-sm font-medium text-slate-700">Mật khẩu mới</span><input type="password" className="input-field mt-2" placeholder="Tối thiểu 8 ký tự" /></label>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-5"><div className="flex gap-3"><LockKeyhole className="w-5 h-5 text-slate-500" /><div><p className="font-medium">Xác thực hai bước</p><p className="text-sm text-slate-500 mt-1">Tăng cường bảo mật khi đăng nhập.</p></div></div><button className="text-blue-700 font-medium text-sm">Thiết lập</button></div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Thông báo</h2>
        <p className="text-sm text-slate-500 mt-1">Chọn cách EduFlow gửi cập nhật cho bạn.</p>
        <div className="card p-6 mt-4 divide-y divide-slate-100">
          {[['Thông báo trên web', 'Nhận cập nhật ngay trong EduFlow.', webNotifications, setWebNotifications], ['Thông báo qua email', 'Nhận email khi có bài tập, điểm số hoặc lịch học mới.', emailNotifications, setEmailNotifications]].map(([title, detail, value, setter]) => (
            <label key={title as string} className="flex items-center justify-between py-4 first:pt-0 last:pb-0 cursor-pointer"><div><p className="font-medium text-slate-800">{title as string}</p><p className="text-sm text-slate-500 mt-1">{detail as string}</p></div><input type="checkbox" checked={value as boolean} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} className="w-5 h-5 accent-blue-600" /></label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Giao diện & hiển thị</h2>
        <div className="card p-6 mt-4 flex items-center justify-between"><div className="flex gap-3"><Palette className="w-5 h-5 text-slate-500" /><div><p className="font-medium">Chế độ tối</p><p className="text-sm text-slate-500 mt-1">Tùy chọn giao diện tối sẽ được áp dụng toàn hệ thống.</p></div></div><input type="checkbox" checked={darkMode} onChange={(event) => setDarkMode(event.target.checked)} className="w-5 h-5 accent-blue-600" /></div>
      </section>

      {(role === 'lecturer' || role === 'admin') && <section><h2 className="text-xl font-semibold text-slate-900">Cấu hình hệ thống</h2><p className="text-sm text-slate-500 mt-1">Thiết lập tích hợp dành cho {role === 'admin' ? 'quản trị viên' : 'giáo viên'}.</p><div className="card p-6 mt-4 space-y-4"><div className="flex gap-3"><Server className="w-5 h-5 text-slate-500" /><div><p className="font-medium">Tích hợp AI/LLM</p><p className="text-sm text-slate-500 mt-1">Khóa API đang sử dụng: ••••••••••••demo</p></div></div><div className="flex gap-3"><ShieldCheck className="w-5 h-5 text-slate-500" /><div><p className="font-medium">Quyền hạn người dùng</p><p className="text-sm text-slate-500 mt-1">Vai trò hiện tại: {role === 'admin' ? 'Quản trị viên' : 'Giáo viên'}</p></div></div></div></section>}

      <div className="flex justify-end items-center gap-4 pb-6"><span className="text-sm text-emerald-700">{saved && <><Check className="inline w-4 h-4 mr-1" />Đã lưu thay đổi</>}</span><button onClick={save} className="login-primary px-5 py-2.5 font-medium text-sm">Lưu thay đổi</button></div>
    </div>
  );
}
