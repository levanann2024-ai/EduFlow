import { useState, type FormEvent } from 'react';
import {
  ImagePlus,
  KeyRound,
  Languages,
  LogOut,
  Palette,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { changePassword, type AuthUser } from '@/auth/authApi';
import { AccountProfileSection } from '@/components/AccountProfileSection';
import { showToast } from '@/components/toast';
import {
  FONT_SCALE_STEP_PERCENT,
  MAX_FONT_SCALE_PERCENT,
  MIN_FONT_SCALE_PERCENT,
  backgroundPresets,
  isSafeImageUrl,
  type UserSettings,
} from '@/settings/userSettings';

const roleLabels: Record<AuthUser['role'], string> = {
  admin: 'Quản trị viên',
  lecturer: 'Giáo viên',
  student: 'Học sinh',
};

const copy = {
  vi: {
    apply: 'Áp dụng',
    fontSize: 'Cỡ chữ',
    fontSizeHint: 'Điều chỉnh cỡ chữ trên toàn bộ giao diện.',
    fontSizeMinimum: 'Nhỏ nhất',
    fontSizeMaximum: 'Lớn nhất',
    fontSizeSlider: 'Cỡ chữ toàn ứng dụng',
    localOnly: 'Cài đặt cá nhân hóa chỉ lưu trên trình duyệt này.',
    appearance: 'Giao diện',
    background: 'Nền trang',
    backgroundHint: 'Chọn một màu nền nhẹ hoặc dùng ảnh riêng.',
    customUrl: 'URL ảnh nền',
    motion: 'Hiệu ứng chuyển động',
    motionDetail: 'Cho phép animation và chuyển cảnh trong ứng dụng.',
    language: 'Ngôn ngữ',
    languageHint: 'Một số trang vẫn đang được dịch sang tiếng Anh.',
    ai: 'Học tập & AI',
    aiHint: 'Tùy chỉnh cách trợ lý AI giải thích trong cuộc trò chuyện.',
    style: 'Phong cách giải thích',
    concise: 'Ngắn gọn, đi thẳng vào ý chính',
    detailed: 'Từng bước, kèm giải thích và ví dụ',
    security: 'Bảo mật',
    securityHint: 'Dùng mật khẩu dài và riêng cho tài khoản EduFlow.',
    demoAccount: 'Đây là tài khoản trải nghiệm. Không thể đổi mật khẩu hoặc gửi yêu cầu xóa tài khoản demo.',
    currentPassword: 'Mật khẩu hiện tại',
    newPassword: 'Mật khẩu mới',
    confirmPassword: 'Xác nhận mật khẩu mới',
    passwordLength: 'Từ 12 đến 128 ký tự.',
    updatePassword: 'Đổi mật khẩu',
    saving: 'Đang cập nhật…',
    passwordMismatch: 'Mật khẩu xác nhận chưa khớp.',
    passwordLengthError: 'Mật khẩu mới cần có từ 12 đến 128 ký tự.',
    passwordSuccess: 'Đã cập nhật mật khẩu.',
    passwordFail: 'Không thể cập nhật mật khẩu lúc này.',
    deleting: 'Yêu cầu xóa tài khoản',
    deletingHint: 'Gửi email cho quản trị viên để yêu cầu xử lý tài khoản và dữ liệu liên quan.',
    requestDelete: 'Soạn yêu cầu xóa tài khoản',
    deleteConfirm: 'Xác nhận gửi yêu cầu xóa tài khoản',
    cancel: 'Hủy',
    emailRequest: 'Mở ứng dụng email',
    deleteNote: 'Yêu cầu sẽ được gửi đến quản trị viên. Tài khoản không bị xóa ngay sau khi gửi yêu cầu.',
    session: 'Phiên đăng nhập',
    sessionHint: 'Đăng xuất khỏi tài khoản trên thiết bị này.',
    logout: 'Đăng xuất',
    saved: 'Đã lưu trên thiết bị này.',
    invalidBackground: 'URL ảnh nền cần là địa chỉ http:// hoặc https:// hợp lệ.',
    customBackgroundHint: 'Dùng URL ảnh HTTPS đáng tin cậy; URL ảnh được tải từ máy chủ bên ngoài.',
  },
  en: {
    apply: 'Apply',
    fontSize: 'Text size',
    fontSizeHint: 'Adjust text size across the entire interface.',
    fontSizeMinimum: 'Smallest',
    fontSizeMaximum: 'Largest',
    fontSizeSlider: 'Application text size',
    localOnly: 'Personalization settings are saved in this browser.',
    appearance: 'Appearance',
    background: 'Page background',
    backgroundHint: 'Choose a soft color or use your own image.',
    customUrl: 'Background image URL',
    motion: 'Motion effects',
    motionDetail: 'Allow animations and transitions in the app.',
    language: 'Language',
    languageHint: 'Some pages are still being translated into English.',
    ai: 'Learning & AI',
    aiHint: 'Choose how the AI assistant explains answers in chat.',
    style: 'Explanation style',
    concise: 'Concise and focused',
    detailed: 'Step-by-step, with explanations and examples',
    security: 'Security',
    securityHint: 'Use a long, unique password for your EduFlow account.',
    demoAccount: 'This is a demo account. Password changes and account deletion requests are unavailable.',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    passwordLength: '12 to 128 characters.',
    updatePassword: 'Change password',
    saving: 'Updating…',
    passwordMismatch: 'The confirmation password does not match.',
    passwordLengthError: 'The new password must be 12 to 128 characters.',
    passwordSuccess: 'Password updated.',
    passwordFail: 'Could not update the password right now.',
    deleting: 'Account deletion request',
    deletingHint: 'Email an administrator to request review of your account and related data.',
    requestDelete: 'Prepare deletion request',
    deleteConfirm: 'Confirm account deletion request',
    cancel: 'Cancel',
    emailRequest: 'Open email app',
    deleteNote: 'Your account will not be deleted immediately when you prepare this email.',
    session: 'Session',
    sessionHint: 'Sign out of EduFlow on this device.',
    logout: 'Sign out',
    saved: 'Saved on this device.',
    invalidBackground: 'Enter a valid http:// or https:// image URL.',
    customBackgroundHint: 'Use a trusted HTTPS image URL; it will be loaded from an external server.',
  },
} as const;

export function Settings({
  user,
  settings,
  settingsError,
  onSettingsChange,
  onUserUpdate,
  onLogout,
}: {
  user: AuthUser;
  settings: UserSettings;
  settingsError: string;
  onSettingsChange: (settings: UserSettings) => void;
  onUserUpdate: (user: AuthUser) => void;
  onLogout: () => void;
}) {
  const text = copy[settings.language];
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [backgroundError, setBackgroundError] = useState('');
  const [backgroundUrlDraft, setBackgroundUrlDraft] = useState(settings.backgroundUrl);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const supportEmail = 'eduflow.contact2026@gmail.com';
  const deletionSubject = encodeURIComponent(`Yêu cầu xóa tài khoản EduFlow - ${user.email}`);
  const deletionBody = encodeURIComponent(
    `Tôi yêu cầu quản trị viên xem xét xóa tài khoản EduFlow của tôi.\n\nEmail: ${user.email}\nUser ID: ${user.id}\nVai trò: ${roleLabels[user.role]}\n\nTôi hiểu rằng yêu cầu cần được quản trị viên xử lý và có thể cần xác minh thêm.`,
  );
  const deletionMailto = `mailto:${supportEmail}?subject=${deletionSubject}&body=${deletionBody}`;

  const updateSettings = (patch: Partial<UserSettings>) => {
    try {
      onSettingsChange({ ...settings, ...patch });
    } catch (error) {
      setBackgroundError(error instanceof Error ? error.message : 'Không thể lưu cài đặt trên thiết bị này.');
    }
  };

  const applyBackgroundUrl = () => {
    const value = backgroundUrlDraft.trim();
    if (!value || !isSafeImageUrl(value) || !value.startsWith('https://')) {
      setBackgroundError(text.invalidBackground);
      return;
    }
    setBackgroundError('');
    updateSettings({ background: 'custom', backgroundUrl: value });
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    if (newPassword.length < 12 || newPassword.length > 128) {
      setPasswordError(text.passwordLengthError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(text.passwordMismatch);
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast(text.passwordSuccess);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : text.passwordFail);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 pb-8">
      {settingsError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{settingsError}</p>}
      {backgroundError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{backgroundError}</p>}

      <AccountProfileSection
        user={user}
        avatarUrl={settings.avatar}
        language={settings.language}
        onUserUpdate={onUserUpdate}
        onAvatarChange={(avatarUrl) => updateSettings({ avatar: avatarUrl })}
      />

      <section aria-labelledby="appearance-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-700"><Palette className="h-5 w-5" /></div>
          <div>
            <h2 id="appearance-title" className="font-bold text-slate-900">{text.appearance}</h2>
            <p className="mt-1 text-sm text-slate-500">{text.backgroundHint}</p>
          </div>
        </div>
        <fieldset className="mt-5">
          <legend className="mb-3 text-sm font-semibold text-slate-700">{text.background}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {backgroundPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={settings.background === preset.id}
                onClick={() => updateSettings({ background: preset.id })}
                className={`rounded-xl border p-2 text-left transition ${settings.background === preset.id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <span className="block h-12 rounded-lg border border-slate-100" style={preset.style} />
                <span className="mt-2 block truncate text-xs font-semibold text-slate-700">
                  {settings.language === 'en' ? preset.labelEn : preset.label}
                </span>
              </button>
            ))}
            <button
              type="button"
              aria-pressed={settings.background === 'custom'}
              onClick={() => {
                if (settings.backgroundUrl) updateSettings({ background: 'custom' });
              }}
              className={`rounded-xl border p-2 text-left transition ${settings.background === 'custom' ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <span className="flex h-12 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-500"><ImagePlus className="h-5 w-5" /></span>
              <span className="mt-2 block truncate text-xs font-semibold text-slate-700">{settings.language === 'en' ? 'Custom URL' : 'Ảnh từ URL'}</span>
            </button>
          </div>
        </fieldset>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">{text.customUrl}</span>
          <div className="mt-1.5 flex gap-2">
            <input value={backgroundUrlDraft} onChange={(event) => setBackgroundUrlDraft(event.target.value)} className="input-field min-w-0" type="url" maxLength={2048} placeholder="https://…" />
            <button type="button" onClick={applyBackgroundUrl} className="shrink-0 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">{text.apply}</button>
          </div>
          <span className="mt-1.5 block text-xs text-slate-500">{text.customBackgroundHint}</span>
        </label>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{text.fontSize}</h3>
              <p className="mt-1 text-xs text-slate-500">{text.fontSizeHint}</p>
            </div>
            <output htmlFor="font-scale" className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-bold text-indigo-700">
              {settings.fontScalePercent}%
            </output>
          </div>
          <label htmlFor="font-scale" className="sr-only">{text.fontSizeSlider}</label>
          <input
            id="font-scale"
            type="range"
            min={MIN_FONT_SCALE_PERCENT}
            max={MAX_FONT_SCALE_PERCENT}
            step={FONT_SCALE_STEP_PERCENT}
            value={settings.fontScalePercent}
            aria-valuetext={`${settings.fontScalePercent}%`}
            onChange={(event) => updateSettings({ fontScalePercent: Number(event.target.value) })}
            className="mt-4 w-full cursor-pointer accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>{text.fontSizeMinimum} · {MIN_FONT_SCALE_PERCENT}%</span>
            <span>{text.fontSizeMaximum} · {MAX_FONT_SCALE_PERCENT}%</span>
          </div>
        </div>
        <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 border-t border-slate-100 pt-4">
          <span className="flex items-center gap-3">
            <WandSparkles className="h-5 w-5 text-violet-600" />
            <span><span className="block text-sm font-semibold text-slate-800">{text.motion}</span><span className="mt-1 block text-xs text-slate-500">{text.motionDetail}</span></span>
          </span>
          <input type="checkbox" checked={settings.animationsEnabled} onChange={(event) => updateSettings({ animationsEnabled: event.target.checked })} className="h-5 w-5 accent-indigo-600" />
        </label>
      </section>

      <section aria-labelledby="language-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Languages className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <h2 id="language-title" className="font-bold text-slate-900">{text.language}</h2>
            <p className="mt-1 text-sm text-slate-500">{text.languageHint}</p>
          </div>
          <select value={settings.language} onChange={(event) => updateSettings({ language: event.target.value as UserSettings['language'] })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      {(user.role === 'student' || user.role === 'lecturer') && (
        <section aria-labelledby="ai-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Sparkles className="h-5 w-5" /></div>
            <div>
              <h2 id="ai-title" className="font-bold text-slate-900">{text.ai}</h2>
              <p className="mt-1 text-sm text-slate-500">{text.aiHint}</p>
            </div>
          </div>
          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-700">{text.style}</span>
            <select value={settings.explanationStyle} onChange={(event) => updateSettings({ explanationStyle: event.target.value as UserSettings['explanationStyle'] })} className="input-field mt-1.5">
              <option value="concise">{text.concise}</option>
              <option value="detailed">{text.detailed}</option>
            </select>
          </label>
        </section>
      )}

      <section aria-labelledby="security-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <h2 id="security-title" className="font-bold text-slate-900">{text.security}</h2>
            <p className="mt-1 text-sm text-slate-500">{text.securityHint}</p>
          </div>
        </div>
        {user.isDemo ? (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{text.demoAccount}</p>
        ) : (
          <form onSubmit={handlePasswordChange} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{text.currentPassword}</span>
              <input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="input-field mt-1.5" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{text.newPassword}</span>
                <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="input-field mt-1.5" />
                <span className="mt-1 block text-xs text-slate-500">{text.passwordLength}</span>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{text.confirmPassword}</span>
                <input type="password" autoComplete="new-password" required maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="input-field mt-1.5" />
              </label>
            </div>
            {passwordError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{passwordError}</p>}
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button type="submit" disabled={savingPassword} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
                <KeyRound className="h-4 w-4" />{savingPassword ? text.saving : text.updatePassword}
              </button>
            </div>
          </form>
        )}
      </section>

      {!user.isDemo && (
        <section aria-labelledby="delete-title" className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 id="delete-title" className="font-bold text-rose-800">{text.deleting}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">{text.deletingHint}</p>
          {!deleteConfirmOpen ? (
            <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="mt-4 rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
              {text.requestDelete}
            </button>
          ) : (
            <div className="mt-4 rounded-xl bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-900">{text.deleteConfirm}</p>
              <p className="mt-1 text-xs leading-5 text-rose-800">{text.deleteNote}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={deletionMailto} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800">{text.emailRequest}</a>
                <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">{text.cancel}</button>
              </div>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="session-title" className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 id="session-title" className="font-bold text-slate-900">{text.session}</h2>
          <p className="mt-1 text-sm text-slate-500">{text.sessionHint}</p>
        </div>
        <button type="button" onClick={onLogout} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
          <LogOut className="h-4 w-4" />{text.logout}
        </button>
      </section>
      <p className="text-center text-xs text-slate-500">{text.localOnly}</p>
    </main>
  );
}
