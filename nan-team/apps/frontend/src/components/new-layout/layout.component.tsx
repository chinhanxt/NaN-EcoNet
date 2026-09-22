'use client';

import React, { ReactNode, useCallback, useEffect } from 'react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { Plus_Jakarta_Sans } from 'next/font/google';
const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  {
    ssr: false,
  }
);

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
import { ShowMediaBoxModal } from '@gitroom/frontend/components/media/media.modal';
import { ShowLinkedinCompany } from '@gitroom/frontend/components/launches/helpers/linkedin.component';
import { MediaSettingsLayout } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { ShowPostSelector } from '@gitroom/frontend/components/post-url-selector/post.url.selector';
import { Support } from '@gitroom/frontend/components/layout/support';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { CopilotKit } from '@copilotkit/react-core';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Impersonate } from '@gitroom/frontend/components/layout/impersonate';
import { AnnouncementBanner } from '@gitroom/frontend/components/layout/announcement.banner';
import { Title } from '@gitroom/frontend/components/layout/title';
import { TopMenu } from '@gitroom/frontend/components/layout/top.menu';
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import { StreakComponent } from '@gitroom/frontend/components/layout/streak.component';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { AttachToFeedbackIcon } from '@gitroom/frontend/components/new-layout/sentry.feedback.component';
import { setSentryUser } from '@gitroom/react/sentry/initialize.sentry.client';
import { LaunchesSkeleton } from '@gitroom/frontend/components/launches/launches.skeleton';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const ContinueProvider = dynamic(
  () => import('@gitroom/frontend/components/layout/continue.provider').then((module) => module.ContinueProvider),
  { ssr: false }
);

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
});

export const LayoutComponent = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();
  const t = useT();

  const { backendUrl } = useVariables();
  const searchParams = useSearchParams();

  // Feedback icon component attaches Sentry feedback to a top-bar icon when DSN is present
  const load = useCallback(async (path: string) => {
    try {
      const res = await fetch(path);
      if (!res.ok) {
        if (res.status === 401) {
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
            window.location.href = '/auth/logout';
          }
          return null;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (e) {
      try {
        const direct = await (await window.fetch('/direct-user')).json();
        if (direct?.id) {
          return direct;
        }
      } catch (err) {
        // ignore
      }
      throw e;
    }
  }, []);
  const { data: user, mutate, error } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    errorRetryCount: 3,
    errorRetryInterval: 1500,
  });

  useEffect(() => {
    setSentryUser(
      user ? { id: user.id, email: user.email, orgId: user.orgId } : null
    );
  }, [user]);

  if (!user) {
    return (
      <div
        className={clsx(
          'flex flex-col min-h-screen min-w-screen text-newTextColor p-[12px]',
          jakartaSans.className
        )}
      >
        <div className="flex-1 flex gap-[10px]">
          {/* Sidebar Skeleton */}
          <div className="flex flex-col bg-newBgColorInner w-[96px] rounded-[24px] shadow-sm border border-newBorder/40">
            <div className="w-[78px] flex flex-col h-full gap-[28px] py-[14px] mx-auto items-center">
              <Logo />
              <div className="flex flex-col gap-[12px] items-center w-full">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="w-[66px] h-[52px] rounded-[18px] bg-newBorder/40 animate-pulse"
                  />
                ))}
              </div>
              <div className="mt-auto w-[66px] h-[52px] rounded-[18px] bg-newBorder/30 animate-pulse" />
            </div>
          </div>

          {/* Main Board Skeleton */}
          <div className="flex-1 bg-newBgLineColor rounded-[12px] overflow-hidden flex flex-col gap-[1px]">
            {/* Top Bar Skeleton */}
            <div className="flex bg-newBgColorInner h-[80px] px-[20px] items-center justify-between">
              <div className="h-[28px] w-[140px] rounded-[8px] bg-newBorder/50 animate-pulse" />
              <div className="flex items-center gap-[16px]">
                <div className="w-[36px] h-[36px] rounded-full bg-newBorder/40 animate-pulse" />
                <div className="w-[36px] h-[36px] rounded-full bg-newBorder/40 animate-pulse" />
                <div className="w-[36px] h-[36px] rounded-full bg-newBorder/40 animate-pulse" />
              </div>
            </div>

            {/* Body Skeleton */}
            <div className="flex flex-1 gap-[1px]">
              <LaunchesSkeleton />
            </div>
          </div>
        </div>

        {error && (
          <div className="fixed bottom-6 right-6 bg-rose-950/95 text-rose-100 px-5 py-3 rounded-xl shadow-2xl border border-rose-500/40 flex items-center gap-4 z-50 animate-fade-in backdrop-blur-md">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">{t('cannot_connect_api_server', 'Cannot connect to API server')}</span>
              <span className="text-xs text-rose-200">{t('auto_retrying_server_online', 'Automatically retrying when server comes online...')}</span>
            </div>
            <button
              onClick={() => mutate()}
              className="px-3 py-1.5 bg-white text-rose-950 text-xs font-bold rounded-lg hover:bg-rose-100 transition shadow-sm"
            >
              {t('retry_now', 'Retry now')}
            </button>
            <a
              href="/auth/logout"
              className="px-3 py-1.5 bg-rose-800 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition"
            >
              {t('login_again', 'Login again')}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <ContextWrapper user={user}>
      <CopilotKit
        credentials="include"
        headers={() => {
          if (typeof document === 'undefined') return {};
          const auth = document.cookie
            .split(';')
            .find((p) => p.trim().startsWith('auth='))
            ?.split('=')[1];
          return auth ? { auth } : {};
        }}
        runtimeUrl={backendUrl + '/copilot/chat'}
        {...({ useSingleEndpoint: true } as any)}
        showDevConsole={false}
        enableInspector={false}
      >
        <MantineWrapper>
          <ToolTip />
          <Toaster />
          <ShowMediaBoxModal />
          <ShowLinkedinCompany />
          <MediaSettingsLayout />
          <ShowPostSelector />
          <PreConditionComponent />
          {searchParams.has('added') && searchParams.has('continue') && (
            <ContinueProvider />
          )}
          <div
            className={clsx(
              'flex flex-col min-h-screen min-w-screen text-newTextColor p-[12px]',
              jakartaSans.className
            )}
          >
            <div>{user?.admin ? <Impersonate /> : <div />}</div>
            <AnnouncementBanner />
            <div className="flex-1 flex gap-[10px]">
              <Support />
              <div className="flex flex-col bg-newBgColorInner w-[96px] rounded-[24px] shadow-sm border border-newBorder/40 transition-all duration-300">
                <div
                  id="left-menu"
                  className={clsx(
                    'fixed h-full w-[78px] start-[20px] flex flex-1 top-0',
                    user?.admin && 'pt-[60px] max-h-[1000px]:w-[500px]'
                  )}
                >
                  <div className="flex flex-col h-full gap-[28px] flex-1 py-[14px]">
                    <Logo />
                    <TopMenu />
                  </div>
                </div>
              </div>
              <div className="flex-1 bg-newBgLineColor rounded-[12px] overflow-hidden flex flex-col gap-[1px] blurMe">
                <div className="flex bg-newBgColorInner h-[80px] px-[20px] items-center">
                  <div className="text-[24px] font-[600] flex flex-1">
                    <Title />
                  </div>
                  <div className="flex gap-[20px] text-textItemBlur items-center">
                    <StreakComponent />
                    <div className="w-[1px] h-[20px] bg-blockSeparator self-center" />
                    <OrganizationSelector />
                    <div className="hover:text-newTextColor flex items-center justify-center h-[24px]">
                      <ModeComponent />
                    </div>
                    <div className="w-[1px] h-[20px] bg-blockSeparator self-center" />
                    <div className="flex items-center justify-center h-[24px]">
                      <LanguageComponent />
                    </div>
                    <div className="w-[1px] h-[20px] bg-blockSeparator self-center" />
                    <AttachToFeedbackIcon />
                    <div className="flex items-center justify-center h-[24px]">
                      <NotificationComponent />
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 gap-[1px]">{children}</div>
              </div>
            </div>
          </div>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
