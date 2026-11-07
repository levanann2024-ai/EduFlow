import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import { completeProfile, saveAvatar, type AuthUser } from '@/auth/authApi';
import type { AppLanguage } from '@/settings/userSettings';
import { isSafeImageUrl } from '@/settings/userSettings';
import { showToast } from '@/components/toast';

const text = {
  vi: {
    title: 'Hồ sơ cá nhân',
    description: 'Có thể đổi tên hiển thị; email đăng nhập do nhà trường quản lý.',
    changeAvatar: 'Chọn ảnh đại diện',
    avatarHint: 'Ảnh được lưu vào tài khoản để dùng trên các thiết bị khác. PNG, JPG hoặc WebP.',
    imageUrl: 'Hoặc dùng URL ảnh',
    apply: 'Áp dụng',
    email: 'Email đăng nhập',
    name: 'Tên hiển thị',
    saveName: 'Lưu tên',
    saving: 'Đang cập nhật…',
    saved: 'Đã cập nhật tên hiển thị.',
    profileError: 'Không thể cập nhật hồ sơ lúc này.',
    imageError: 'Không thể đọc ảnh này. Hãy chọn PNG, JPG hoặc WebP nhỏ hơn 5 MB.',
    imageUrlError: 'URL ảnh cần bắt đầu bằng http:// hoặc https://.',
    avatarError: 'Không thể lưu ảnh đại diện lên máy chủ.',
    removeAvatar: 'Xóa ảnh',
    admin: 'Quản trị viên',
    lecturer: 'Giáo viên',
    student: 'Học sinh',
  },
  en: {
    title: 'Profile',
    description: 'You can update your display name. Your sign-in email is managed by your school.',
    changeAvatar: 'Choose an avatar',
    avatarHint: 'Saved to your account and available on other devices. PNG, JPG, or WebP.',
    imageUrl: 'Or use an image URL',
    apply: 'Apply',
    email: 'Sign-in email',
    name: 'Display name',
    saveName: 'Save name',
    saving: 'Updating…',
    saved: 'Display name updated.',
    profileError: 'Could not update the profile right now.',
    imageError: 'Could not read this image. Choose a PNG, JPG, or WebP under 5 MB.',
    imageUrlError: 'Image URLs must start with http:// or https://.',
    avatarError: 'Could not save the avatar to the server.',
    removeAvatar: 'Remove avatar',
    admin: 'Administrator',
    lecturer: 'Teacher',
    student: 'Student',
  },
} as const;

const roleLabels = {
  admin: { vi: text.vi.admin, en: text.en.admin },
  lecturer: { vi: text.vi.lecturer, en: text.en.lecturer },
  student: { vi: text.vi.student, en: text.en.student },
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

export function AccountProfileSection({
  user,
  avatarUrl,
  language,
  onUserUpdate,
  onAvatarChange,
}: {
  user: AuthUser;
  avatarUrl: string;
  language: AppLanguage;
  onUserUpdate: (user: AuthUser) => void;
  onAvatarChange: (avatarUrl: string) => void;
}) {
  const labels = text[language];
  const [displayName, setDisplayName] = useState(user.fullName);
  const [imageUrlDraft, setImageUrlDraft] = useState(avatarUrl.startsWith('http') ? avatarUrl : '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayNameForAvatar = user.fullName.trim() || user.email;
  const initials = displayNameForAvatar
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase(language);

  useEffect(() => setDisplayName(user.fullName), [user.fullName]);
  useEffect(() => {
    setImageUrlDraft(avatarUrl.startsWith('http') ? avatarUrl : '');
  }, [avatarUrl]);

  const persistAvatar = async (avatar: string) => {
    if (user.isDemo) return;
    setSavingAvatar(true);
    setAvatarError('');
    try {
      const updatedUser = await saveAvatar(avatar);
      onUserUpdate(updatedUser);
      onAvatarChange(updatedUser.avatarUrl ?? '');
      setImageUrlDraft((updatedUser.avatarUrl ?? '').startsWith('http') ? updatedUser.avatarUrl ?? '' : '');
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : labels.avatarError);
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleAvatarFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    try {
      await persistAvatar(await compressAvatar(file));
    } catch {
      setAvatarError(labels.imageError);
    } finally {
      event.target.value = '';
    }
  };

  const applyAvatarUrl = async () => {
    const value = imageUrlDraft.trim();
    if (value && !isSafeImageUrl(value)) {
      setAvatarError(labels.imageUrlError);
      return;
    }
    setAvatarError('');
    await persistAvatar(value);
  };

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError('');
    if (displayName.trim().length < 2 || displayName.trim().length > 120) {
      setProfileError(language === 'en'
        ? 'Display name must be between 2 and 120 characters.'
        : 'Tên hiển thị cần có từ 2 đến 120 ký tự.');
      return;
    }
    setSavingProfile(true);
    try {
      const updatedUser = await completeProfile(displayName.trim());
      onUserUpdate(updatedUser);
      showToast(labels.saved);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : labels.profileError);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <section aria-labelledby="profile-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 id="profile-title" className="font-bold text-slate-900">{labels.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{labels.description}</p>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white">{initials || 'EF'}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{user.fullName || user.email}</p>
          <span className="mt-1 inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
            {roleLabels[user.role][language]}
          </span>
        </div>
        {avatarUrl && (
          <button type="button" disabled={savingAvatar || user.isDemo} onClick={() => void persistAvatar('')} className="text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50">
            {labels.removeAvatar}
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleAvatarFile(event)} className="sr-only" />
          <button type="button" disabled={savingAvatar || user.isDemo} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <ImagePlus className="h-4 w-4" />{savingAvatar ? labels.saving : labels.changeAvatar}
          </button>
          <p className="mt-1.5 text-xs text-slate-500">{labels.avatarHint}</p>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{labels.imageUrl}</span>
          <div className="mt-1.5 flex gap-2">
            <input value={imageUrlDraft} onChange={(event) => setImageUrlDraft(event.target.value)} className="input-field min-w-0" type="url" maxLength={2048} placeholder="https://…" />
            <button type="button" disabled={savingAvatar || user.isDemo} onClick={() => void applyAvatarUrl()} className="shrink-0 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
              {savingAvatar ? labels.saving : labels.apply}
            </button>
          </div>
        </label>
      </div>
      {avatarError && <p role="alert" className="mt-2 text-sm text-rose-700">{avatarError}</p>}
      <div className="mt-4 rounded-lg border border-slate-200 px-4 py-3">
        <div className="text-xs font-semibold text-slate-500">{labels.email}</div>
        <p className="mt-1 break-all text-sm font-medium text-slate-800">{user.email}</p>
      </div>
      {!user.isDemo && (
        <form onSubmit={(event) => void handleProfileSave(event)} className="mt-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{labels.name}</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} maxLength={120} className="input-field min-w-0 flex-1" />
              <button type="submit" disabled={savingProfile || displayName.trim() === user.fullName} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                {savingProfile ? labels.saving : labels.saveName}
              </button>
            </div>
          </label>
          {profileError && <p role="alert" className="mt-2 text-sm text-rose-700">{profileError}</p>}
        </form>
      )}
    </section>
  );
}
