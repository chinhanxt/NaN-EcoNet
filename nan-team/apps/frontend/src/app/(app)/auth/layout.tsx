export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Toaster } from '@gitroom/react/toaster/toaster';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));
export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <MantineWrapper>
      <Toaster />
      <ReturnUrlComponent />
      <div className="relative min-h-screen w-full flex items-center justify-center px-[16px] py-[32px] overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-[#07130f] dark:via-[#0E0E0E] dark:to-[#071312]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[160px] -start-[120px] w-[420px] h-[420px] rounded-full bg-emerald-400/20 dark:bg-emerald-500/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-[160px] -end-[120px] w-[420px] h-[420px] rounded-full bg-teal-400/20 dark:bg-teal-500/10 blur-3xl"
        />
        <main className="relative w-full max-w-[440px] flex flex-col gap-[24px]">
          <div className="flex flex-col items-center gap-[8px] text-gray-900 dark:text-white">
            <LogoTextComponent />
            <p className="text-[14px] text-gray-500 dark:text-gray-400 text-center">
              Nền tảng quản lý & sáng tạo nội dung mạng xã hội
            </p>
          </div>
          <div className="w-full rounded-[20px] border border-emerald-100 dark:border-white/10 bg-white/90 dark:bg-[#1A1919]/90 backdrop-blur shadow-xl shadow-emerald-900/5 dark:shadow-black/40 p-[24px] sm:p-[32px] text-gray-900 dark:text-white">
            <div className="flex">{children}</div>
          </div>
          <p className="text-center text-[12px] text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} NaN-Team
          </p>
        </main>
      </div>
    </MantineWrapper>
  );
}
