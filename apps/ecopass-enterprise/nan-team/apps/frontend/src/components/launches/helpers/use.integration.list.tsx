'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback } from 'react';
import useSWR from 'swr';

export const useIntegrationList = () => {
  const fetch = useFetch();

  const load = useCallback(async (path: string) => {
    try {
      const res = await fetch(path);
      if (res.ok) {
        const data = await res.json();
        if (data?.integrations && Array.isArray(data.integrations)) {
          return data.integrations;
        }
      }
    } catch (e) {
      // Ignore and fallback
    }

    try {
      const direct = await (await window.fetch('/direct-channel')).json();
      if (direct?.integrations && Array.isArray(direct.integrations)) {
        return direct.integrations;
      }
    } catch (e) {
      // Ignore
    }

    return [];
  }, []);

  return useSWR('/integrations/list', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
};