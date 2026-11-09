import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  fieldClassName?: string;
  labelClassName?: string;
  inputWrapperClassName?: string;
  inputClassName?: string;
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  maxLength,
  fieldClassName = 'text-sm font-medium text-slate-700',
  labelClassName,
  inputWrapperClassName = 'relative mt-1',
  inputClassName = 'w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 font-normal',
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={fieldClassName}>
      <label htmlFor={id} className={labelClassName}>{label}</label>
      <div className={inputWrapperClassName}>
        <input
          id={id}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClassName} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          className="absolute inset-y-0 right-0 inline-flex items-center px-3 text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        >
          {visible
            ? <EyeOff className="h-4 w-4" aria-hidden="true" />
            : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
