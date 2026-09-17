'use client';
import dayjs, { ConfigType } from 'dayjs';
import { FC, useEffect } from 'react';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import isoWeek from 'dayjs/plugin/isoWeek';
import i18next from 'i18next';

import 'dayjs/locale/en';
import 'dayjs/locale/vi';
import 'dayjs/locale/he';
import 'dayjs/locale/ru';
import 'dayjs/locale/zh';
import 'dayjs/locale/fr';
import 'dayjs/locale/es';
import 'dayjs/locale/pt';
import 'dayjs/locale/de';
import 'dayjs/locale/it';
import 'dayjs/locale/ja';
import 'dayjs/locale/ko';
import 'dayjs/locale/ar';
import 'dayjs/locale/tr';

dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.extend(isoWeek);

export const syncDayjsLocale = (lng?: string) => {
  const target = lng || i18next.resolvedLanguage || i18next.language || 'en';
  dayjs.locale(target);
};

syncDayjsLocale();

const { utc: originalUtc } = dayjs;

export const getTimezone = () => {
  if (typeof window === 'undefined') {
    return dayjs.tz.guess();
  }
  return localStorage.getItem('timezone') || dayjs.tz.guess();
};

export const newDayjs = (config?: ConfigType) => {
  return dayjs(config);
};

const SetTimezone: FC = () => {
  useEffect(() => {
    syncDayjsLocale();
    const handleLanguageChanged = (lng: string) => {
      syncDayjsLocale(lng);
    };
    i18next.on('languageChanged', handleLanguageChanged);

    dayjs.utc = (config?: ConfigType, format?: string, strict?: boolean) => {
      const result = originalUtc(config, format, strict);

      // Attach `.local()` method to the returned Dayjs object
      result.local = function () {
        return result.tz(getTimezone());
      };

      return result;
    };
    if (localStorage.getItem('timezone')) {
      dayjs.tz.setDefault(getTimezone());
    }

    return () => {
      i18next.off('languageChanged', handleLanguageChanged);
    };
  }, []);
  return null;
};

export default SetTimezone;
