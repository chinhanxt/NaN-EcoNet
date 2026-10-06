'use client';

import { useForm, SubmitHandler } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { useState } from 'react';
import { clsx } from 'clsx';

type Inputs = {
  // Identifier field: accepts a plain username (e.g. "admin") or an email.
  email: string;
  password: string;
};

const DEMO_ACCOUNT = { email: 'admin', password: '123456' };
const INVALID_CREDENTIALS = 'Sai tên đăng nhập hoặc mật khẩu';

const inputClass =
  'w-full h-[48px] rounded-[12px] border bg-white dark:bg-[#0E0E0E] px-[14px] text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30';

export function Login() {
  const [loading, setLoading] = useState(false);
  const [notActivated, setNotActivated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const form = useForm<Inputs>({
    defaultValues: { email: '', password: '' },
  });
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors },
  } = form;
  const fetchData = useFetch();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    setNotActivated(false);
    setFormError('');
    try {
      const login = await fetchData('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email.trim(),
          password: data.password,
          providerToken: '',
          provider: 'LOCAL',
        }),
      });
      if (login.ok) {
        // Success: the fetch wrapper reloads the page via the "reload" header.
        return;
      }
      const errorMessage = await login.text();
      if (errorMessage === 'User is not activated') {
        setNotActivated(true);
      } else if (login.status === 400 || login.status === 401) {
        setFormError(INVALID_CREDENTIALS);
      } else {
        setFormError('Không thể kết nối máy chủ. Vui lòng thử lại.');
      }
    } catch (e) {
      setFormError('Không thể kết nối máy chủ. Vui lòng thử lại.');
    }
    setLoading(false);
  };

  const fillDemo = () => {
    setValue('email', DEMO_ACCOUNT.email, { shouldValidate: true });
    setValue('password', DEMO_ACCOUNT.password, { shouldValidate: true });
    setFormError('');
    setFocus('password');
  };

  const emailField = register('email', {
    required: 'Vui lòng nhập tên đăng nhập hoặc email',
    validate: (v) =>
      !!v.trim() || 'Vui lòng nhập tên đăng nhập hoặc email',
    onChange: () => formError && setFormError(''),
  });
  const passwordField = register('password', {
    required: 'Vui lòng nhập mật khẩu',
    onChange: () => formError && setFormError(''),
  });

  return (
    <form
      className="flex-1 flex flex-col gap-[20px]"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="flex flex-col gap-[4px]">
        <h1 className="text-[26px] font-bold tracking-tight">Đăng nhập</h1>
        <p className="text-[14px] text-gray-500 dark:text-gray-400">
          Chào mừng bạn quay lại NaN
        </p>
      </div>

      <div className="flex flex-col gap-[6px]">
        <label htmlFor="login-identifier" className="text-[14px] font-medium">
          Tên đăng nhập hoặc email
        </label>
        <input
          id="login-identifier"
          type="text"
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="vd: admin"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'login-identifier-error' : undefined}
          className={clsx(
            inputClass,
            errors.email
              ? 'border-red-500'
              : 'border-gray-200 dark:border-white/10'
          )}
          {...emailField}
        />
        {errors.email && (
          <p id="login-identifier-error" className="text-[13px] text-red-500">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-[6px]">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="text-[14px] font-medium">
            Mật khẩu
          </label>
          <Link
            href="/auth/forgot"
            className="text-[13px] text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Quên mật khẩu?
          </Link>
        </div>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            aria-invalid={!!errors.password}
            aria-describedby={
              errors.password ? 'login-password-error' : undefined
            }
            className={clsx(
              inputClass,
              'pe-[48px]',
              errors.password
                ? 'border-red-500'
                : 'border-gray-200 dark:border-white/10'
            )}
            {...passwordField}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={showPassword}
            className="absolute end-[6px] top-1/2 -translate-y-1/2 w-[36px] h-[36px] flex items-center justify-center rounded-[8px] text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            {showPassword ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <path d="M1 1l22 22" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {errors.password && (
          <p id="login-password-error" className="text-[13px] text-red-500">
            {errors.password.message}
          </p>
        )}
      </div>

      {formError && (
        <div
          role="alert"
          className="rounded-[12px] border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-[14px] py-[10px] text-[14px] text-red-600 dark:text-red-400"
        >
          {formError}
        </div>
      )}

      {notActivated && (
        <div
          role="alert"
          className="rounded-[12px] border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-[14px] py-[10px] text-[14px]"
        >
          <p className="text-amber-700 dark:text-amber-400 mb-[6px]">
            Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email để kích hoạt.
          </p>
          <Link
            href="/auth/activate"
            className="text-amber-700 dark:text-amber-400 underline font-medium"
          >
            Gửi lại email kích hoạt
          </Link>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="w-full h-[52px] rounded-[12px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[16px] font-semibold shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-[10px] disabled:opacity-70 disabled:cursor-wait focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40"
      >
        {loading && (
          <span
            aria-hidden="true"
            className="w-[18px] h-[18px] rounded-full border-2 border-white/40 border-t-white animate-spin"
          />
        )}
        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>

      <div className="rounded-[14px] border border-dashed border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/5 p-[14px] flex flex-col sm:flex-row sm:items-center gap-[12px]">
        <div className="flex-1 text-[13px] leading-[1.5]">
          <div className="font-semibold text-emerald-700 dark:text-emerald-400">
            Tài khoản demo
          </div>
          <div className="text-gray-600 dark:text-gray-300">
            Tên đăng nhập:{' '}
            <code className="font-mono font-semibold">
              {DEMO_ACCOUNT.email}
            </code>{' '}
            · Mật khẩu:{' '}
            <code className="font-mono font-semibold">
              {DEMO_ACCOUNT.password}
            </code>
          </div>
        </div>
        <button
          type="button"
          onClick={fillDemo}
          className="shrink-0 h-[38px] px-[14px] rounded-[10px] border border-emerald-500/60 text-emerald-700 dark:text-emerald-300 text-[13px] font-semibold hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          Điền tài khoản demo
        </button>
      </div>
    </form>
  );
}
