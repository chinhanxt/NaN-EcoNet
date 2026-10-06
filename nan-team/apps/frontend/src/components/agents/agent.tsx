'use client';

import React, {
  createContext,
  FC,
  useCallback,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
import useSWR from 'swr';
import { orderBy } from 'lodash';
import { SVGLine } from '@gitroom/frontend/components/launches/svg.line';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useWaitForClass } from '@gitroom/helpers/utils/use.wait.for.class';
import { MultiMediaComponent } from '@gitroom/frontend/components/media/media.component';
import { Integration } from '@prisma/client';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import { DeleteConfirmationModal } from '@gitroom/frontend/components/agents/delete.thread.modal';

export const MediaPortal: FC<{
  media: { path: string; id: string }[];
  value: string;
  onPostText?: (text: string) => void;
  setMedia: (event: {
    target: {
      name: string;
      value?: {
        id: string;
        path: string;
        alt?: string;
        thumbnail?: string;
        thumbnailTimestamp?: number;
      }[];
    };
  }) => void;
}> = ({ media, setMedia, value, onPostText }) => {
  const waitForClass = useWaitForClass('copilotKitMessages');
  const t = useT();
  if (!waitForClass) return null;
  return (
    <div className="pl-[14px] pr-[24px] whitespace-nowrap editor rm-bg">
      <MultiMediaComponent
        aiVideoStudio
        onStudioPostText={onPostText}
        allData={[{ content: value }]}
        text={value}
        label={t('attachments', 'Attachments')}
        description=""
        value={media}
        dummy={false}
        name="image"
        onChange={setMedia}
        onOpen={() => {}}
        onClose={() => {}}
        toolBar={
          <>
          <Link
            href="/launches"
            className="cursor-pointer h-[32px] px-2.5 rounded-[8px] justify-center items-center flex gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 hover:border-emerald-500/40 transition-all duration-150 active:scale-[0.98] select-none no-underline shrink-0 text-[12px] font-medium"
            title={t('open_calendar', 'Xem lịch đăng bài trên hệ thống')}
          >
            <svg
              className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="leading-none">{t('calendar', 'Lịch')}</span>
          </Link>
          </>
        }
      />
    </div>
  );
};

export const AgentList: FC<{ onChange: (arr: any[]) => void }> = ({
  onChange,
}) => {
  const fetch = useFetch();
  const t = useT();
  const [selected, setSelected] = useState([]);

  const [collapseMenu, setCollapseMenu] = useCookie('collapseMenu', '0');
  const { data } = useIntegrationList();

  const setIntegration = useCallback(
    (integration: Integration) => () => {
      if (selected.some((p) => p.id === integration.id)) {
        onChange(selected.filter((p) => p.id !== integration.id));
        setSelected(selected.filter((p) => p.id !== integration.id));
      } else {
        onChange([...selected, integration]);
        setSelected([...selected, integration]);
      }
    },
    [selected]
  );

  const sortedIntegrations = useMemo(() => {
    return orderBy(
      Array.isArray(data) ? data : [],
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data]);

  return (
    <div
      className={clsx(
        'trz bg-newBgColorInner flex flex-col gap-[15px] transition-all relative',
        collapseMenu === '1' ? 'group sidebar w-[100px]' : 'w-[260px]'
      )}
    >
      <div className="absolute top-0 start-0 w-full h-full p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        <div className="flex items-center">
          <h2 className="group-[.sidebar]:hidden flex-1 text-[20px] font-[500] mb-[15px]">
            {t('select_channels', 'Select Channels')}
          </h2>
          <div
            onClick={() => setCollapseMenu(collapseMenu === '1' ? '0' : '1')}
            className="-mt-3 group-[.sidebar]:rotate-[180deg] group-[.sidebar]:mx-auto text-btnText bg-btnSimple rounded-[6px] w-[24px] h-[24px] flex items-center justify-center cursor-pointer select-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="7"
              height="13"
              viewBox="0 0 7 13"
              fill="none"
            >
              <path
                d="M6 11.5L1 6.5L6 1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className={clsx('flex flex-col gap-[15px]')}>
          {sortedIntegrations.map((integration, index) => (
            <div
              onClick={setIntegration(integration)}
              key={integration.id}
              className={clsx(
                'flex gap-[12px] items-center group/profile justify-center hover:bg-boxHover rounded-e-[8px] hover:opacity-100 cursor-pointer',
                !selected.some((p) => p.id === integration.id) && 'opacity-20'
              )}
            >
              <div
                className={clsx(
                  'relative rounded-full flex justify-center items-center gap-[6px]',
                  integration.disabled && 'opacity-50'
                )}
              >
                {(integration.inBetweenSteps || integration.refreshNeeded) && (
                  <div className="absolute start-0 top-0 w-[39px] h-[46px] cursor-pointer">
                    <div className="bg-red-500 w-[15px] h-[15px] rounded-full start-0 -top-[5px] absolute z-[200] text-[10px] flex justify-center items-center">
                      !
                    </div>
                    <div className="bg-primary/60 w-[39px] h-[46px] start-0 top-0 absolute rounded-full z-[199]" />
                  </div>
                )}
                <div className="h-full w-[4px] -ms-[12px] rounded-s-[3px] opacity-0 group-hover/profile:opacity-100 transition-opacity">
                  <SVGLine />
                </div>
                <ImageWithFallback
                  fallbackSrc={`/icons/platforms/${integration.identifier}.png`}
                  src={integration.picture}
                  className="rounded-[8px]"
                  alt={integration.identifier}
                  width={36}
                  height={36}
                />
                <SafeImage
                  src={`/icons/platforms/${integration.identifier}.png`}
                  className="rounded-[8px] absolute z-10 bottom-[5px] -end-[5px] border border-fifth"
                  alt={integration.identifier}
                  width={18.41}
                  height={18.41}
                />
              </div>
              <div
                className={clsx(
                  'flex-1 whitespace-nowrap text-ellipsis overflow-hidden group-[.sidebar]:hidden',
                  integration.disabled && 'opacity-50'
                )}
              >
                {integration.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PropertiesContext = createContext({ properties: [] });
export const Agent: FC<{ children: ReactNode }> = ({ children }) => {
  const [properties, setProperties] = useState([]);

  return (
    <PropertiesContext.Provider value={{ properties }}>
      <AgentList onChange={setProperties} />
      <div className="bg-newBgColorInner flex flex-1">{children}</div>
      <Threads />
    </PropertiesContext.Provider>
  );
};

const cleanThreadTitle = (raw: string) => {
  if (!raw || !raw.trim()) return 'Phiên hội thoại mới';
  const clean = raw
    .replace(/[#*`_~]/g, '')
    .replace(/^Xin chào[^.\n]*[.\n]/i, '')
    .replace(/^Chào bạn[^.\n]*[.\n]/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || 'Phiên trò chuyện';
};

const Threads: FC = () => {
  const fetch = useFetch();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const { id } = useParams<{ id: string }>();

  const threads = useCallback(async () => {
    try {
      const res = await fetch('/copilot/list');
      if (!res.ok) return { threads: [] };
      const json = await res.json();
      return json?.threads ? json : { threads: [] };
    } catch (e) {
      return { threads: [] };
    }
  }, []);

  const { data, mutate } = useSWR('threads', threads, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: true,
    fallbackData: { threads: [] },
  });

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const promptDelete = useCallback(
    (e: React.MouseEvent, thread: { id: string; title: string }) => {
      e.preventDefault();
      e.stopPropagation();
      setDeleteTarget(thread);
    },
    []
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await fetch(`/copilot/${deleteTarget.id}`, { method: 'DELETE' });
      try {
        if (localStorage.getItem('active_agent_thread_id') === deleteTarget.id) {
          localStorage.removeItem('active_agent_thread_id');
        }
      } catch (e) {}
      await mutate();
      if (id === deleteTarget.id) {
        window.dispatchEvent(new CustomEvent('nan-start-new-chat'));
        router.push('/agents/new');
      }
      setDeleteTarget(null);
    } catch (err) {
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, fetch, id, mutate, router]);

  const startNewChat = useCallback(() => {
    try {
      localStorage.removeItem('active_agent_thread_id');
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('nan-start-new-chat'));
    router.push('/agents/new');
  }, [router]);

  return (
    <div
      className={clsx(
        'trz bg-newBgColorInner flex flex-col gap-[15px] transition-all relative',
        'w-[260px]'
      )}
    >
      <div className="absolute top-0 start-0 w-full h-full p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        <div className="mb-[15px] justify-center flex group-[.sidebar]:pb-[15px]">
          <button
            onClick={startNewChat}
            className="text-white whitespace-nowrap flex-1 pt-[12px] pb-[14px] ps-[16px] pe-[20px] group-[.sidebar]:p-0 min-h-[44px] max-h-[44px] rounded-md bg-btnPrimary flex justify-center items-center gap-[5px] outline-none hover:opacity-90 transition-opacity cursor-pointer border-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="20"
              viewBox="0 0 21 20"
              fill="none"
              className="min-w-[21px] min-h-[20px]"
            >
              <path
                d="M10.5001 4.16699V15.8337M4.66675 10.0003H16.3334"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex-1 text-start text-[15px] font-medium group-[.sidebar]:hidden">
              {t('start_a_new_chat', 'Tạo cuộc trò chuyện mới')}
            </div>
          </button>
        </div>

        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs uppercase tracking-wider text-textColor/50 font-semibold">
            {t('chat_history', 'Lịch sử phiên chat')}
          </span>
          <span className="text-[11px] text-textColor/40">
            {data?.threads?.length || 0}
          </span>
        </div>

        <div className="flex flex-col gap-[4px]">
          {data?.threads?.map((p: any) => {
            const isSelected = p.id === id;
            return (
              <div
                key={p.id}
                className={clsx(
                  'group flex items-center justify-between rounded-[10px] px-[10px] py-[8px] cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-newBgColor border border-primary/30 shadow-sm'
                    : 'hover:bg-newBgColor/60'
                )}
                onClick={() => {
                  try {
                    localStorage.setItem('active_agent_thread_id', p.id);
                  } catch (e) {}
                  router.push(`/agents/${p.id}`);
                }}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1 mr-1">
                  <svg
                    className={clsx(
                      'w-3.5 h-3.5 shrink-0',
                      isSelected ? 'text-primary' : 'text-textColor/40'
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <span
                    className={clsx(
                      'truncate text-xs leading-normal select-none',
                      isSelected ? 'text-textColor font-medium' : 'text-textColor/75'
                    )}
                    title={p.title}
                  >
                    {cleanThreadTitle(p.title)}
                  </span>
                </div>

                <button
                  type="button"
                  title="Xóa phiên trò chuyện"
                  onClick={(e) => promptDelete(e, p)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-textColor/30 p-1 transition-opacity shrink-0 rounded cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        threadTitle={cleanThreadTitle(deleteTarget?.title || '')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </div>
  );
};
