import { useEffect, useState } from 'react';
import { BadgeCheck, Bell, BookOpen, Check, Copy, KeyRound, LogOut, ShieldCheck, Sparkles } from 'lucide-react';

interface StudyPreferences {
  explanationStyle: 'concise' | 'detailed';
  homeworkReminders: boolean;
}

const PREFERENCES_KEY = 'eduflow.student.preferences';
const PARENT_LINK_CODE = 'EDU-AN11-2026';

export function StudentProfile({ onLogout }: { onLogout: () => void }) {
  const [preferences, setPreferences] = useState<StudyPreferences>({
    explanationStyle: 'detailed',
    homeworkReminders: true,
  });
  const [passwordNotice, setPasswordNotice] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (
        !parsed
        || typeof parsed !== 'object'
        || !['concise', 'detailed'].includes(String((parsed as Record<string, unknown>).explanationStyle))
        || typeof (parsed as Record<string, unknown>).homeworkReminders !== 'boolean'
      ) {
        throw new Error('Thiết lập học tập đã lưu không đúng định dạng.');
      }
      setPreferences(parsed as StudyPreferences);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể đọc thiết lập học tập.');
    }
  }, []);

  const updatePreferences = (next: StudyPreferences) => {
    setPreferences(next);
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
      setError('');
    } catch {
      setError('Không thể lưu thiết lập học tập trên thiết bị này.');
    }
  };

  const copyParentCode = async () => {
    try {
      await navigator.clipboard.writeText(PARENT_LINK_CODE);
      setCopyNotice('Đã sao chép mã liên kết.');
      setError('');
    } catch {
      setCopyNotice('');
      setError('Không thể sao chép mã. Hãy chọn và sao chép mã thủ công.');
    }
  };

  const requestPasswordChange = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordNotice('Đổi mật khẩu chưa được kết nối với dịch vụ tài khoản.');
  };

  return (
    <main className="mx-auto max-w-5xl space-y-5 pb-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hồ sơ cá nhân</h1>
        <p className="text-sm text-slate-500">Thông tin học sinh và cài đặt trải nghiệm học tập.</p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <section aria-labelledby="student-card-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-xl font-bold text-amber-600">
              LV
            </div>
            <div>
              <h2 id="student-card-title" className="text-xl font-bold text-slate-900">Lê Văn An</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">Học sinh</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Lớp 11</span>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                <BookOpen className="h-4 w-4 text-slate-400" /> Trường THPT EduFlow
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between lg:min-w-[380px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mã liên kết phụ huynh</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-wider text-slate-900">{PARENT_LINK_CODE}</p>
              <p className="mt-1 text-xs text-slate-500">Phụ huynh có thể dùng mã này để gửi yêu cầu liên kết.</p>
            </div>
            <button type="button" onClick={() => void copyParentCode()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700">
              {copyNotice ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copyNotice ? 'Đã sao chép' : 'Sao chép mã'}
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            <BadgeCheck className="h-5 w-5" /> Đã xác thực tài khoản học sinh
          </p>
          {copyNotice && <p role="status" className="text-sm text-emerald-700">{copyNotice}</p>}
        </div>
      </section>

      <section aria-labelledby="study-settings-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 id="study-settings-title" className="text-lg font-bold text-slate-900">Cài đặt học tập &amp; AI</h2>
          <p className="mt-1 text-sm text-slate-500">Tùy chỉnh cách EduBot hướng dẫn và nhắc em học tập.</p>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex flex-col gap-4 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Sparkles className="h-5 w-5" /></span>
              <div>
                <h3 className="font-semibold text-slate-800">Thiết lập AI</h3>
                <p className="mt-1 text-sm text-slate-500">Chọn mức độ chi tiết khi EduBot giải thích.</p>
              </div>
            </div>
            <select
              aria-label="Mức độ giải thích của EduBot"
              value={preferences.explanationStyle}
              onChange={(event) => updatePreferences({ ...preferences, explanationStyle: event.target.value as StudyPreferences['explanationStyle'] })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
            >
              <option value="concise">Giải thích ngắn gọn</option>
              <option value="detailed">Giải thích chi tiết kèm ví dụ</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4 py-4">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Bell className="h-5 w-5" /></span>
              <div>
                <h3 className="font-semibold text-slate-800">Nhắc nhở bài tập về nhà</h3>
                <p className="mt-1 text-sm text-slate-500">Nhận nhắc nhở khi sắp đến hạn nộp bài.</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.homeworkReminders}
              onChange={(event) => updatePreferences({ ...preferences, homeworkReminders: event.target.checked })}
              className="h-5 w-5 shrink-0 accent-blue-600"
            />
          </label>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <h2 id="account-security-title" className="font-bold text-slate-900">Tài khoản &amp; bảo mật</h2>
            <p className="mt-1 text-sm text-slate-500">Quản lý mật khẩu và phiên đăng nhập.</p>
          </div>
          </div>
          <form onSubmit={requestPasswordChange} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu hiện tại
            <input type="password" autoComplete="current-password" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Nhập mật khẩu hiện tại" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Mật khẩu mới
            <input type="password" autoComplete="new-password" minLength={8} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Tối thiểu 8 ký tự" />
          </label>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <KeyRound className="h-4 w-4" /> Đổi mật khẩu
          </button>
          </form>
          {passwordNotice && <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{passwordNotice}</p>}
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">Thoát khỏi tài khoản EduFlow trên thiết bị này.</p>
            <button type="button" onClick={onLogout} className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
