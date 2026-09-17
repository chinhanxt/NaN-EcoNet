import { FC, useCallback, useMemo, useState } from 'react';
import { Integration } from '@prisma/client';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { ChartSocial } from '@gitroom/frontend/components/analytics/chart-social';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { ChannelTokenModal } from '@gitroom/frontend/components/launches/channel.token.modal';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useRouter } from 'next/navigation';

interface AnalyticsDataItem {
  label: string;
  data: Array<{ total: number; date: string }>;
  average?: boolean;
  percentageChange?: number;
}

const TrendIndicator: FC<{ value: number; average?: boolean }> = ({
  value,
  average,
}) => {
  if (value === 0) return null;

  const isPositive = value > 0;
  const displayValue = Math.abs(value).toFixed(1);

  return (
    <div
      className={`flex items-center gap-[4px] text-[13px] font-medium ${
        isPositive ? 'text-[#32d583]' : 'text-[#f97066]'
      }`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className={isPositive ? '' : 'rotate-180'}
      >
        <path
          d="M6 2.5L10 7.5H2L6 2.5Z"
          fill="currentColor"
        />
      </svg>
      <span>
        {displayValue}
        {average ? 'pp' : '%'}
      </span>
    </div>
  );
};

const AnalyticsCard: FC<{
  item: AnalyticsDataItem;
  total: string | number;
  index: number;
}> = ({ item, total, index }) => {
  const colorVariants = ['purple', 'green', 'blue'] as const;
  const color = colorVariants[index % colorVariants.length];

  const hasDataPoints = (item?.data?.length || 0) >= 1;

  return (
    <div className="group relative">
      <div
        className={`
          flex flex-col h-full
          bg-newTableHeader
          border border-newTableBorder
          rounded-[12px]
          overflow-hidden
          transition-all duration-200
          hover:border-[#059669]/50
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[16px] pt-[14px] pb-[8px]">
          <div className="flex items-center gap-[10px]">
            <div
              className={`
                w-[8px] h-[8px] rounded-full
                ${color === 'purple' ? 'bg-[#059669]' : ''}
                ${color === 'green' ? 'bg-[#32d583]' : ''}
                ${color === 'blue' ? 'bg-[#1d9bf0]' : ''}
              `}
            />
            <span className="text-[15px] font-medium text-newTableText">
              {item.label}
            </span>
          </div>
          {item.percentageChange !== undefined && (
            <TrendIndicator value={item.percentageChange} average={item.average} />
          )}
        </div>

        {/* Content */}
        {hasDataPoints ? (
          <>
            {/* Chart */}
            <div className="flex-1 px-[12px] py-[8px]">
              <div className="h-[120px] relative">
                <ChartSocial data={item.data} color={color} key={`chart-${index}`} />
              </div>
            </div>

            {/* Value */}
            <div className="px-[16px] pb-[14px]">
              <div className="text-[36px] leading-[42px] font-semibold tracking-tight">
                {total}
              </div>
            </div>
          </>
        ) : (
          /* Single value display */
          <div className="flex-1 flex flex-col items-center justify-center py-[32px] px-[16px]">
            <div className="text-[48px] leading-[56px] font-semibold tracking-tight">
              {total}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyState: FC<{
  integration: Integration;
  date: number;
  onRefresh: () => void;
  onOpenTokenModal?: () => void;
}> = ({ integration, date, onRefresh, onOpenTokenModal }) => {
  const t = useT();
  const router = useRouter();
  const isRefreshNeeded = !!integration?.refreshNeeded;
  const isFacebook =
    (integration as any)?.identifier === 'facebook' ||
    (integration as any)?.providerIdentifier === 'facebook';

  if (isRefreshNeeded) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-[56px] px-[24px] bg-newTableHeader border border-newTableBorder rounded-[16px] text-center">
        <div className="w-[52px] h-[52px] mb-[16px] rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-amber-500"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3 className="text-[17px] font-semibold text-textColor mb-[8px]">
          {t('channel_needs_reauth', 'Channel needs re-authorization')}
        </h3>
        <p className="text-[14px] text-newTableText max-w-[460px] mb-[20px] leading-relaxed">
          {t('channel_needs_reauth_desc', 'The session or Access Token for this channel has expired. Please refresh the connection to continue syncing analytics data.')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-[10px]">
          {isFacebook ? (
            <>
              {onOpenTokenModal && (
                <button
                  onClick={onOpenTokenModal}
                  className="inline-flex items-center gap-[8px] px-[18px] py-[9px] text-[14px] font-medium text-white bg-[#059669] hover:bg-[#047857] rounded-[10px] transition-all shadow-sm"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 2l-2 2m-1.5 6.1L19 8l-3.5-3.5-2.1 2.1c-.8-.2-1.7-.3-2.6-.3-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8c0-.9-.1-1.8-.3-2.6z" />
                    <circle cx="7.5" cy="16.5" r="1.5" />
                  </svg>
                  {t('update_token', 'Update Token')}
                </button>
              )}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-[8px] px-[18px] py-[9px] text-[14px] font-medium text-btnText bg-btnSimple hover:bg-boxHover border border-newTableBorder rounded-[10px] transition-all shadow-sm"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Graph API Explorer ↗
              </a>
            </>
          ) : (
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-[8px] px-[18px] py-[9px] text-[14px] font-medium text-white bg-[#059669] hover:bg-[#047857] rounded-[10px] transition-all shadow-sm"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              {t('refresh_channel', 'Refresh Channel')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-full flex flex-col items-center justify-center py-[56px] px-[24px] bg-newTableHeader border border-newTableBorder rounded-[16px] text-center">
      <div className="w-[52px] h-[52px] mb-[16px] rounded-full bg-btnSimple border border-newTableBorder flex items-center justify-center text-textColor">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path d="M3 3v18h18" />
          <path d="M7 16l4-4 4 4 5-6" />
        </svg>
      </div>
      <h3 className="text-[17px] font-semibold text-textColor mb-[8px]">
        {t('no_analytics_data_title', 'No analytics data yet')}
      </h3>
      <p className="text-[14px] text-newTableText max-w-[480px] mb-[20px] leading-relaxed">
        {t('no_analytics_data_desc', `No engagement metrics recorded in the past ${date} days. Data will automatically appear when the channel has new posts and views.`)}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-[10px]">
        <button
          onClick={() => router.push('/launches')}
          className="inline-flex items-center gap-[8px] px-[18px] py-[9px] text-[14px] font-medium text-white bg-[#059669] hover:bg-[#047857] rounded-[10px] transition-all shadow-sm"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('create_new_post', 'Create Post')}
        </button>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-[6px] px-[16px] py-[9px] text-[13px] font-medium text-btnText bg-btnSimple hover:bg-boxHover border border-newTableBorder rounded-[10px] transition-colors shadow-sm"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          {t('refresh_connection', 'Refresh Connection')}
        </button>
        {isFacebook && onOpenTokenModal && (
          <button
            onClick={onOpenTokenModal}
            className="inline-flex items-center gap-[6px] px-[16px] py-[9px] text-[13px] font-medium text-btnText bg-btnSimple hover:bg-boxHover border border-newTableBorder rounded-[10px] transition-colors shadow-sm"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 2l-2 2m-1.5 6.1L19 8l-3.5-3.5-2.1 2.1c-.8-.2-1.7-.3-2.6-.3-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8c0-.9-.1-1.8-.3-2.6z" />
              <circle cx="7.5" cy="16.5" r="1.5" />
            </svg>
            {t('update_token', 'Update Token')}
          </button>
        )}
        {isFacebook && (
          <a
            href="https://developers.facebook.com/tools/explorer/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-[6px] px-[16px] py-[9px] text-[13px] font-medium text-btnText bg-btnSimple hover:bg-boxHover border border-newTableBorder rounded-[10px] transition-colors shadow-sm"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Graph API Explorer ↗
          </a>
        )}
      </div>
    </div>
  );
};

export const RenderAnalytics: FC<{
  integration: Integration;
  date: number;
}> = (props) => {
  const { integration, date } = props;
  const fetch = useFetch();
  const modal = useModals();
  const toast = useToaster();

  const load = useCallback(async () => {
    if (!integration?.id) {
      return [];
    }
    try {
      const res = await fetch(`/analytics/${integration.id}?date=${date}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          return json;
        }
      }
    } catch (e) {}
    return [];
  }, [integration?.id, date]);

  const { data, mutate, isLoading } = useSWR(
    integration?.id ? `/analytics-${integration?.id}-${date}` : null,
    load,
    {
      refreshInterval: 0,
      refreshWhenHidden: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: true,
      refreshWhenOffline: false,
    }
  );

  const openTokenModal = useCallback(() => {
    const isYoutube = (integration as any)?.identifier === 'youtube' || (integration as any)?.providerIdentifier === 'youtube';
    modal.openModal({
      title: t('channel_token_management', 'Channel Token Management'),
      withCloseButton: true,
      closeOnEscape: true,
      closeOnClickOutside: false,
      size: isYoutube ? '800px' : '650px',
      maxSize: '95vw',
      top: '60px',
      classNames: {
        modal: '!gap-[14px] !p-[20px] !rounded-[16px] shadow-2xl',
      },
      children: (
        <ChannelTokenModal
          integration={integration}
          onClose={() => {
            mutate();
            toast.show(t('channel_updated', 'Channel information updated'), 'success');
          }}
        />
      ),
    });
  }, [modal, integration, mutate, toast]);

  const refreshChannel = useCallback(
    (
        integrationData: Integration & {
          identifier: string;
        }
      ) =>
      async () => {
        const isDirect =
          ['facebook', 'tiktok', 'youtube'].includes(
            (integrationData as any)?.identifier || (integrationData as any)?.providerIdentifier
          );

        if (isDirect) {
          openTokenModal();
          return;
        }

        const res = await fetch(
          `/integrations/social/${integrationData.identifier || (integrationData as any).providerIdentifier}?refresh=${integrationData.internalId}`,
          {
            method: 'GET',
          }
        );
        const { url } = await res.json();
        if (url) {
          window.location.href = url;
        }
      },
    [openTokenModal]
  );

  const t = useT();

  const totals = useMemo(() => {
    return (data || []).map((p: AnalyticsDataItem) => {
      const dataLen = p?.data?.length || 0;
      const sum = (p?.data || []).reduce((acc: number, curr: { total: number }) => acc + (curr?.total || 0), 0);
      const value = sum / (p?.average ? (dataLen || 1) : 1);
      if (p?.average) {
        return value.toFixed(2) + '%';
      }
      return new Intl.NumberFormat().format(Math.round(value));
    });
  }, [data]);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-[48px]">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[16px]">
      {data?.length === 0 && (
        <EmptyState
          integration={integration}
          date={date}
          onRefresh={refreshChannel(integration as any)}
          onOpenTokenModal={openTokenModal}
        />
      )}
      {data?.map((item: AnalyticsDataItem, index: number) => (
        <AnalyticsCard
          key={`analytics-${index}`}
          item={item}
          total={totals[index]}
          index={index}
        />
      ))}
    </div>
  );
};
