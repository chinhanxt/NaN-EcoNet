import React from 'react';
import { Divider, List, ListSubheader } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import TimelineIcon from '@mui/icons-material/Timeline';
import PauseCircleFilledIcon from '@mui/icons-material/PauseCircleFilled';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PlaceIcon from '@mui/icons-material/Place';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BarChartIcon from '@mui/icons-material/BarChart';
import RouteIcon from '@mui/icons-material/Route';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import NotesIcon from '@mui/icons-material/Notes';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAdministrator, useRestriction } from '../../common/util/permissions';
import MenuItem from '../../common/components/MenuItem';

const subheaderStyle = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  lineHeight: '26px',
  px: 2,
  pt: 1.5,
  pb: 0.5,
  bgcolor: 'transparent',
};

const ReportsMenu = () => {
  const t = useTranslation();
  const location = useLocation();

  const admin = useAdministrator();
  const readonly = useRestriction('readonly');

  const buildLink = (path) => {
    const sourceParams = new URLSearchParams(location.search);
    const deviceIds = sourceParams.getAll('deviceId');
    const groupIds = sourceParams.getAll('groupId');
    if (!deviceIds.length && !groupIds.length) {
      return path;
    }
    const params = new URLSearchParams();
    if (path === '/reports/chart' || path === '/reports/route' || path === '/replay') {
      const [firstDeviceId] = deviceIds;
      if (firstDeviceId != null) {
        params.append('deviceId', firstDeviceId);
      }
    } else {
      deviceIds.forEach((deviceId) => params.append('deviceId', deviceId));
      groupIds.forEach((groupId) => params.append('groupId', groupId));
    }
    const search = params.toString();
    return search ? `${path}?${search}` : path;
  };

  return (
    <List disablePadding sx={{ py: 1 }}>
      <ListSubheader disableSticky sx={subheaderStyle}>
        Lộ trình & Hoạt động
      </ListSubheader>
      <MenuItem
        title={t('reportCombined')}
        link={buildLink('/reports/combined')}
        icon={<StarIcon />}
        selected={location.pathname === '/reports/combined'}
      />
      <MenuItem
        title={t('reportEvents')}
        link={buildLink('/reports/events')}
        icon={<NotificationsActiveIcon />}
        selected={location.pathname === '/reports/events'}
      />
      <MenuItem
        title={t('reportTrips')}
        link={buildLink('/reports/trips')}
        icon={<PlayCircleFilledIcon />}
        selected={location.pathname === '/reports/trips'}
      />
      <MenuItem
        title={t('reportStops')}
        link={buildLink('/reports/stops')}
        icon={<PauseCircleFilledIcon />}
        selected={location.pathname === '/reports/stops'}
      />
      <MenuItem
        title={t('reportPositions')}
        link={buildLink('/reports/route')}
        icon={<TimelineIcon />}
        selected={location.pathname === '/reports/route'}
      />
      <MenuItem
        title={t('reportReplay')}
        link={buildLink('/replay')}
        icon={<RouteIcon />}
        selected={location.pathname === '/replay'}
      />

      <Divider sx={{ my: 1, mx: 1.5, borderColor: '#e2e8f0' }} />

      <ListSubheader disableSticky sx={subheaderStyle}>
        Phân tích & Thống kê
      </ListSubheader>
      <MenuItem
        title={t('reportSummary')}
        link={buildLink('/reports/summary')}
        icon={<FormatListBulletedIcon />}
        selected={location.pathname === '/reports/summary'}
      />
      <MenuItem
        title={t('reportChart')}
        link={buildLink('/reports/chart')}
        icon={<TrendingUpIcon />}
        selected={location.pathname === '/reports/chart'}
      />
      <MenuItem
        title={t('sharedGeofences')}
        link={buildLink('/reports/geofences')}
        icon={<PlaceIcon />}
        selected={location.pathname === '/reports/geofences'}
      />

      <Divider sx={{ my: 1, mx: 1.5, borderColor: '#e2e8f0' }} />

      <ListSubheader disableSticky sx={subheaderStyle}>
        Hệ thống & Kiểm toán
      </ListSubheader>
      <MenuItem
        title={t('sharedLogs')}
        link="/reports/logs"
        icon={<NotesIcon />}
        selected={location.pathname === '/reports/logs'}
      />
      {!readonly && (
        <MenuItem
          title={t('reportScheduled')}
          link="/reports/scheduled"
          icon={<EventRepeatIcon />}
          selected={location.pathname === '/reports/scheduled'}
        />
      )}
      {admin && (
        <MenuItem
          title={t('statisticsTitle')}
          link="/reports/statistics"
          icon={<BarChartIcon />}
          selected={location.pathname === '/reports/statistics'}
        />
      )}
      {admin && (
        <MenuItem
          title={t('reportAudit')}
          link="/reports/audit"
          icon={<VerifiedUserIcon />}
          selected={location.pathname === '/reports/audit'}
        />
      )}
    </List>
  );
};

export default React.memo(ReportsMenu);
