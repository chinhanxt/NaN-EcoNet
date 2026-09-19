import React from 'react';
import { Divider, List, ListSubheader } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import DrawIcon from '@mui/icons-material/Draw';
import NotificationsIcon from '@mui/icons-material/Notifications';
import FolderIcon from '@mui/icons-material/Folder';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import BuildIcon from '@mui/icons-material/Build';
import PeopleIcon from '@mui/icons-material/People';
import TodayIcon from '@mui/icons-material/Today';
import SendIcon from '@mui/icons-material/Send';
import DnsIcon from '@mui/icons-material/Dns';
import HelpIcon from '@mui/icons-material/Help';
import PaymentIcon from '@mui/icons-material/Payment';
import CampaignIcon from '@mui/icons-material/Campaign';
import CalculateIcon from '@mui/icons-material/Calculate';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAdministrator, useManager, useRestriction } from '../../common/util/permissions';
import useFeatures from '../../common/util/useFeatures';
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

const SettingsMenu = () => {
  const t = useTranslation();
  const location = useLocation();

  const readonly = useRestriction('readonly');
  const admin = useAdministrator();
  const manager = useManager();
  const userId = useSelector((state) => state.session.user?.id);
  const supportLink = useSelector((state) => state.session.server.attributes?.support);
  const billingLink = useSelector((state) => state.session.user?.attributes?.billingLink);

  const features = useFeatures();

  return (
    <List disablePadding sx={{ py: 1 }}>
      <ListSubheader disableSticky sx={subheaderStyle}>
        Cá nhân & Tùy chọn
      </ListSubheader>
      <MenuItem
        title={t('sharedPreferences')}
        link="/settings/preferences"
        icon={<TuneIcon />}
        selected={location.pathname === '/settings/preferences'}
      />
      {!readonly && (
        <>
          <MenuItem
            title={t('sharedNotifications')}
            link="/settings/notifications"
            icon={<NotificationsIcon />}
            selected={location.pathname.startsWith('/settings/notification')}
          />
          {userId && (
            <MenuItem
              title={t('settingsUser')}
              link={`/settings/user/${userId}`}
              icon={<PersonIcon />}
              selected={location.pathname === `/settings/user/${userId}`}
            />
          )}
        </>
      )}

      {!readonly && (
        <>
          <Divider sx={{ my: 1, mx: 1.5, borderColor: '#e2e8f0' }} />
          <ListSubheader disableSticky sx={subheaderStyle}>
            Thiết bị & Giám sát
          </ListSubheader>
          <MenuItem
            title={t('deviceTitle')}
            link="/settings/devices"
            icon={<DnsIcon />}
            selected={location.pathname.startsWith('/settings/device')}
          />
          <MenuItem
            title={t('sharedGeofences')}
            link="/geofences"
            icon={<DrawIcon />}
            selected={location.pathname.startsWith('/settings/geofence')}
          />
          {!features.disableGroups && (
            <MenuItem
              title={t('settingsGroups')}
              link="/settings/groups"
              icon={<FolderIcon />}
              selected={location.pathname.startsWith('/settings/group')}
            />
          )}
          {!features.disableDrivers && (
            <MenuItem
              title={t('sharedDrivers')}
              link="/settings/drivers"
              icon={<PersonIcon />}
              selected={location.pathname.startsWith('/settings/driver')}
            />
          )}
          {!features.disableCalendars && (
            <MenuItem
              title={t('sharedCalendars')}
              link="/settings/calendars"
              icon={<TodayIcon />}
              selected={location.pathname.startsWith('/settings/calendar')}
            />
          )}
        </>
      )}

      {!readonly &&
        (!features.disableComputedAttributes ||
          !features.disableMaintenance ||
          !features.disableSavedCommands ||
          billingLink ||
          supportLink) && (
          <>
            <Divider sx={{ my: 1, mx: 1.5, borderColor: '#e2e8f0' }} />
            <ListSubheader disableSticky sx={subheaderStyle}>
              Vận hành & Bảo trì
            </ListSubheader>
            {!features.disableComputedAttributes && (
              <MenuItem
                title={t('sharedComputedAttributes')}
                link="/settings/attributes"
                icon={<CalculateIcon />}
                selected={location.pathname.startsWith('/settings/attribute')}
              />
            )}
            {!features.disableMaintenance && (
              <MenuItem
                title={t('sharedMaintenance')}
                link="/settings/maintenances"
                icon={<BuildIcon />}
                selected={location.pathname.startsWith('/settings/maintenance')}
              />
            )}
            {!features.disableSavedCommands && (
              <MenuItem
                title={t('sharedSavedCommands')}
                link="/settings/commands"
                icon={<SendIcon />}
                selected={location.pathname.startsWith('/settings/command')}
              />
            )}
            {billingLink && (
              <MenuItem title={t('userBilling')} link={billingLink} icon={<PaymentIcon />} />
            )}
            {supportLink && (
              <MenuItem title={t('settingsSupport')} link={supportLink} icon={<HelpIcon />} />
            )}
          </>
        )}

      {manager && (
        <>
          <Divider sx={{ my: 1, mx: 1.5, borderColor: '#e2e8f0' }} />
          <ListSubheader disableSticky sx={subheaderStyle}>
            Quản trị hệ thống
          </ListSubheader>
          <MenuItem
            title={t('settingsUsers')}
            link="/settings/users"
            icon={<PeopleIcon />}
            selected={
              location.pathname.startsWith('/settings/user') &&
              location.pathname !== `/settings/user/${userId}`
            }
          />
          {admin && (
            <MenuItem
              title={t('settingsServer')}
              link="/settings/server"
              icon={<SettingsIcon />}
              selected={location.pathname === '/settings/server'}
            />
          )}
          <MenuItem
            title={t('serverAnnouncement')}
            link="/settings/announcement"
            icon={<CampaignIcon />}
            selected={location.pathname === '/settings/announcement'}
          />
        </>
      )}
    </List>
  );
};

export default React.memo(SettingsMenu);
