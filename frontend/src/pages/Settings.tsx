import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ImagePlus,
  KeyRound,
  Languages,
  LogOut,
  Palette,
  ShieldCheck,
  Sparkles,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import { changePassword, completeProfile, saveAvatar, type AuthUser } from '@/auth/authApi';
import { showToast } from '@/components/toast';
import {
  backgroundPresets,
  isSafeImageUrl,
  type UserSettings,
} from '@/settings/userSettings';

const roleLabels: Record<AuthUser['role'], { vi: string; en: string }> = {
  admin: { vi: 'Quản trị viên', en: 'Administrator' },
  lecturer: { vi: 'Giáo viên', en: 'Teacher' },
  student: { vi: 'Học sinh', en: 'Student' },
};

const copy = {
  vi: {
    account: 'Tài khoản',
    title: 'Cài đặt',
    subtitle: 'Cá nhân hóa EduFlow và quản lý tài khoản của bạn.',
    profile: 'Hồ sơ cá nhân',
    profileInfo: 'Bạn có thể đổi tên hiển thị; email đăng nhập do nhà trường quản lý.',
    name: 'Tên hiển thị',
    saveProfile: 'Lưu tên',
    profileSaved: 'Đã cập nhật tên hiển thị.',
    profileFail: 'Không thể cập nhật hồ sơ lúc này.',
    changeAvatar: 'Chọn ảnh đại diện',
    avatarHint: 'Ảnh được lưu vào tài khoản để dùng trên các thiết bị khác. PNG, JPG hoặc WebP.',
    imageUrl: 'Hoặc dùng URL ảnh',
    apply: 'Áp dụng',
    avatarError: 'Không thể đọc ảnh này. Hãy chọn PNG, JPG hoặc WebP nhỏ hơn 5 MB.',
    avatarUrlError: 'URL ảnh cần bắt đầu bằng http:// hoặc https://.',
    localOnly: 'Cài đặt cá nhân hóa chỉ lưu trên trình duyệt này.',
    appearance: 'Giao diện',
    background: 'Nền trang',
    backgroundHint: 'Chọn một màu nền nhẹ hoặc dùng ảnh của riêng bạn.',
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
    deleteNote: 'Yêu cầu sẽ được gửi đến quản trị viên. Tài khoản không bị xóa ngay khi bạn bấm gửi.',
    gemini: 'Tích hợp AI',
    geminiHint: 'Gemini API key được quản lý an toàn ở máy chủ, không lưu trong trình duyệt.',
    geminiAdmin: 'Để thay đổi key, quản trị viên cần cập nhật biến GEMINI_API_KEY trong cấu hình máy chủ.',
    session: 'Phiên đăng nhập',
    sessionHint: 'Đăng xuất khỏi tài khoản trên thiết bị này.',
    logout: 'Đăng xuất',
    saved: 'Đã lưu trên thiết bị này.',
    invalidBackground: 'URL ảnh nền cần là địa chỉ http:// hoặc https:// hợp lệ.',
    customBackgroundHint: 'Dùng URL ảnh HTTPS đáng tin cậy; URL ảnh được tải từ máy chủ bên ngoài.',
  },
  en: {
    account: 'ACCOUNT',
    title: 'Settings',
    subtitle: 'Personalize EduFlow and manage your account.',
    profile: 'Profile',
    profileInfo: 'You can update your display name. Your sign-in email is managed by your school.',
    name: 'Display name',
    saveProfile: 'Save name',
    profileSaved: 'Display name updated.',
    profileFail: 'Could not update the profile right now.',
    changeAvatar: 'Choose an avatar',
    avatarHint: 'Saved to your account and available on other devices. PNG, JPG, or WebP.',
    imageUrl: 'Or use an image URL',
    apply: 'Apply',
    avatarError: 'Could not read this image. Choose a PNG, JPG, or WebP under 5 MB.',
    avatarUrlError: 'Image URLs must start with http:// or https://.',
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
    gemini: 'AI integration',
    geminiHint: 'The Gemini API key is securely managed on the server, not stored in your browser.',
    geminiAdmin: 'To change the key, an administrator must update GEMINI_API_KEY in the server configuration.',
    session: 'Session',
    sessionHint: 'Sign out of EduFlow on this device.',
    logout: 'Sign out',
    saved: 'Saved on this device.',
    invalidBackground: 'Enter a valid http:// or https:// image URL.',
    customBackgroundHint: 'Use a trusted HTTPS image URL; it will be loaded from an external server.',
  },
} as const;

async function compressAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) throw new Error('Invalid image');
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.82);
  } finally {
    URL.revokeObjectURL(source);
  }
}

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
  const [displayName, setDisplayName] = useState(user.fullName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [backgroundError, setBackgroundError] = useState('');
  const [imageUrlDraft, setImageUrlDraft] = useState(settings.avatar.startsWith('http') ? settings.avatar : '');
  const [backgroundUrlDraft, setBackgroundUrlDraft] = useState(settings.backgroundUrl);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initials = user.fullName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase(settings.language);
  const supportEmail = 'eduflow.contact2026@gmail.com';
  const deletionSubject = encodeURIComponent(`Yêu cầu xóa tài khoản EduFlow - ${user.email}`);
  const deletionBody = encodeURIComponent(
    `Tôi yêu cầu quản trị viên xem xét xóa tài khoản EduFlow của tôi.\n\nEmail: ${user.email}\nUser ID: ${user.id}\nVai trò: ${roleLabels[user.role].vi}\n\nTôi hiểu rằng yêu cầu cần được quản trị viên xử lý và có thể cần xác minh thêm.`,
  );
  const deletionMailto = `mailto:${supportEmail}?subject=${deletionSubject}&body=${deletionBody}`;

  useEffect(() => setDisplayName(user.fullName), [user.fullName]);

  const updateSettings = (patch: Partial<UserSettings>) => {
    try {
      onSettingsChange({ ...settings, ...patch });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Không thể lưu cài đặt trên thiết bị này.');
    }
  };

  const persistAvatar = async (avatar: string) => {
    if (user.isDemo) {
      setAvatarError(settings.language === 'en' ? 'Demo accounts cannot save an avatar.' : 'Tài khoản trải nghiệm không thể lưu ảnh đại diện.');
      return;
    }
    setSavingAvatar(true);
    setAvatarError('');
    try {
      const updatedUser = await saveAvatar(avatar);
      onUserUpdate(updatedUser);
      updateSettings({ avatar: updatedUser.avatarUrl ?? '' });
      setImageUrlDraft((updatedUser.avatarUrl ?? '').startsWith('http') ? updatedUser.avatarUrl ?? '' : '');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Không thể lưu ảnh đại diện lên máy chủ.');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleAvatarFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    try {
      const avatar = await compressAvatar(file);
      await persistAvatar(avatar);
    } catch {
      setAvatarError(text.avatarError);
    } finally {
      event.target.value = '';
    }
  };

  const applyAvatarUrl = async () => {
    const value = imageUrlDraft.trim();
    if (value && !isSafeImageUrl(value)) {
      setAvatarError(text.avatarUrlError);
      return;
    }
    setAvatarError('');
    await persistAvatar(value);
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

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError('');
    if (displayName.trim().length < 2 || displayName.trim().length > 120) {
      setProfileError(settings.language === 'en'
        ? 'Display name must be between 2 and 120 characters.'
        : 'Tên hiển thị cần có từ 2 đến 120 ký tự.');
      return;
    }
    setSavingProfile(true);
    try {
      const updatedUser = await completeProfile(displayName.trim());
      onUserUpdate(updatedUser);
      showToast(text.profileSaved);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : text.profileFail);
    } finally {
      setSavingProfile(false);
    }
  };

  const downloadSettingsCopy = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      personalSettings: settings,
      note: settings.language === 'en'
        ? 'This file contains account profile and local preferences only, not school-managed academic records.'
        : 'Tệp này chỉ gồm hồ sơ tài khoản và tùy chọn cá nhân trên thiết bị, không gồm hồ sơ học tập do trường quản lý.',
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'eduflow-account-settings.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(settings.language === 'en'
      ? 'Downloaded profile and preferences. Academic records are not included.'
      : 'Đã tải hồ sơ và cài đặt. Tệp không gồm dữ liệu học tập.');
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 pb-8">
      <header>
        <p className="text-sm font-semibold text-indigo-600">{text.account}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{text.title}</h1>
        <p className="mt-2 text-sm text-slate-500">{text.subtitle}</p>
      </header>

      {settingsError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{settingsError}</p>}
      {avatarError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{avatarError}</p>}
      {backgroundError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{backgroundError}</p>}

      <section aria-labelledby="profile-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><UserRound className="h-5 w-5" /></div>
          <div>
            <h2 id="profile-title" className="font-bold text-slate-900">{text.profile}</h2>
            <p className="mt-1 text-sm text-slate-500">{text.profileInfo}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4">
          {settings.avatar ? (
            <img src={settings.avatar} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white">{initials || 'EF'}</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{user.fullName}</p>
            <span className="mt-1 inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
              {roleLabels[user.role][settings.language]}
            </span>
          </div>
          {settings.avatar && (
            <button type="button" disabled={savingAvatar} onClick={() => void persistAvatar('')} className="text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50">
              {settings.language === 'en' ? 'Remove avatar' : 'Xóa ảnh'}
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleAvatarFile(event)} className="sr-only" />
            <button type="button" disabled={savingAvatar || user.isDemo} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <ImagePlus className="h-4 w-4" />{savingAvatar ? text.saving : text.changeAvatar}
            </button>
            <p className="mt-1.5 text-xs text-slate-500">{text.avatarHint}</p>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{text.imageUrl}</span>
            <div className="mt-1.5 flex gap-2">
              <input value={imageUrlDraft} onChange={(event) => setImageUrlDraft(event.target.value)} className="input-field min-w-0" type="url" maxLength={2048} placeholder="https://…" />
              <button type="button" disabled={savingAvatar || user.isDemo} onClick={() => void applyAvatarUrl()} className="shrink-0 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">{savingAvatar ? text.saving : text.apply}</button>
            </div>
          </label>
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 px-4 py-3">
          <div className="text-xs font-semibold text-slate-500">{settings.language === 'en' ? 'Sign-in email' : 'Email đăng nhập'}</div>
          <p className="mt-1 break-all text-sm font-medium text-slate-800">{user.email}</p>
        </div>
        {!user.isDemo && (
          <form onSubmit={(event) => void handleProfileSave(event)} className="mt-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{text.name}</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} maxLength={120} className="input-field min-w-0 flex-1" />
                <button type="submit" disabled={savingProfile || displayName.trim() === user.fullName} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {savingProfile ? text.saving : text.saveProfile}
                </button>
              </div>
            </label>
            {profileError && <p role="alert" className="mt-2 text-sm text-rose-700">{profileError}</p>}
          </form>
        )}
      </section>

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

      {(user.role === 'admin' || user.role === 'lecturer') && (
        <section aria-labelledby="gemini-title" className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700"><Sparkles className="h-5 w-5" /></div>
            <div>
              <h2 id="gemini-title" className="font-bold text-slate-900">{text.gemini}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{text.geminiHint}</p>
              {user.role === 'admin' && <p className="mt-2 text-xs leading-5 text-slate-500">{text.geminiAdmin}</p>}
            </div>
          </div>
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

      <section aria-labelledby="data-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 id="data-title" className="font-bold text-slate-900">{settings.language === 'en' ? 'Your data' : 'Dữ liệu của bạn'}</h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">
          {settings.language === 'en'
            ? 'Download a copy of your account profile and preferences. School-managed learning records are not included.'
            : 'Tải bản sao hồ sơ tài khoản và tùy chọn cá nhân. Dữ liệu học tập do trường quản lý không nằm trong tệp này.'}
        </p>
        <button type="button" onClick={downloadSettingsCopy} className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          {settings.language === 'en' ? 'Download profile and settings' : 'Tải hồ sơ và cài đặt'}
        </button>
      </section>

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
