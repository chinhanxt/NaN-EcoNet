import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import {
  IconButton,
  Tooltip,
  Avatar,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
} from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { devicesActions } from '../store';
import { formatAlarm, formatBoolean } from '../common/util/formatter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { mapIconKey, mapIcons } from '../map/core/preloadImages';
import { useAdministrator } from '../common/util/permissions';
import EngineIcon from '../resources/images/data/engine.svg?react';
import { useAttributePreference } from '../common/util/preferences';
import GeofencesValue from '../common/components/GeofencesValue';
import DriverValue from '../common/components/DriverValue';
import MotionBar from './components/MotionBar';

dayjs.extend(relativeTime);

const useStyles = makeStyles()(() => ({
  button: {
    height: '100%',
    paddingLeft: '16px',
    paddingRight: '12px',
    transition: 'background-color 150ms ease-in-out',
    '&:hover': {
      backgroundColor: '#f8fafc',
    },
    '&.Mui-selected': {
      backgroundColor: '#eff6ff',
      '&:hover': {
        backgroundColor: '#eff6ff',
      },
    },
  },
  avatar: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    width: 38,
    height: 38,
  },
  icon: {
    width: '20px',
    height: '20px',
    opacity: 0.8,
  },
  primaryText: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: '#020817',
    lineHeight: 1.3,
  },
  secondaryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '3px',
    overflow: 'hidden',
  },
  secondaryValue: {
    fontSize: '0.75rem',
    color: '#64748b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '9999px',
    padding: '2px 10px',
    fontSize: '0.75rem',
    fontWeight: 500,
    lineHeight: '1rem',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
  },
  statusOnline: {
    backgroundColor: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
  },
  statusOffline: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
  },
  statusAlarm: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
  },
  trailingIcons: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    marginLeft: '6px',
    flexShrink: 0,
  },
  iconButton: {
    padding: '4px',
    borderRadius: '6px',
    '&:hover': {
      backgroundColor: '#f1f5f9',
    },
  },
}));

const DeviceRow = ({ devices, index, style }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const admin = useAdministrator();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const item = devices[index];
  const position = useSelector((state) => state.session.positions[item.id]);

  const devicePrimary = useAttributePreference('devicePrimary', 'name');
  const deviceSecondary = useAttributePreference('deviceSecondary', '');

  const resolveFieldValue = (field) => {
    if (field === 'geofenceIds') {
      const geofenceIds = position?.geofenceIds;
      return geofenceIds?.length ? <GeofencesValue geofenceIds={geofenceIds} /> : null;
    }
    if (field === 'driverUniqueId') {
      const driverUniqueId = position?.attributes?.driverUniqueId;
      return driverUniqueId ? <DriverValue driverUniqueId={driverUniqueId} /> : null;
    }
    if (field === 'motion') {
      return <MotionBar deviceId={item.id} />;
    }
    return item[field];
  };

  const primaryValue = resolveFieldValue(devicePrimary);
  const secondaryValue = resolveFieldValue(deviceSecondary);

  const isAlarm = Boolean(position?.attributes?.alarm || item.status === 'alarm');

  let badgeClass;
  let statusBadgeText;

  if (isAlarm) {
    badgeClass = classes.statusAlarm;
    statusBadgeText =
      (position?.attributes?.alarm && formatAlarm(position.attributes.alarm, t)) || 'Báo động';
  } else if (item.status === 'online') {
    badgeClass = classes.statusOnline;
    statusBadgeText = 'Trực tuyến';
  } else {
    badgeClass = classes.statusOffline;
    statusBadgeText =
      item.lastUpdate && dayjs(item.lastUpdate).isValid()
        ? dayjs(item.lastUpdate).locale('vi').fromNow()
        : 'Ngoại tuyến';
  }

  return (
    <div style={style}>
      <ListItemButton
        key={item.id}
        onClick={() => dispatch(devicesActions.selectId(item.id))}
        disabled={!admin && item.disabled}
        selected={selectedDeviceId === item.id}
        className={classes.button}
      >
        <ListItemAvatar sx={{ minWidth: '48px' }}>
          <Avatar className={classes.avatar}>
            <img className={classes.icon} src={mapIcons[mapIconKey(item.category)]} alt="" />
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={primaryValue}
          secondary={
            <div className={classes.secondaryRow}>
              {secondaryValue && <span className={classes.secondaryValue}>{secondaryValue}</span>}
              <span className={`${classes.statusBadge} ${badgeClass}`}>{statusBadgeText}</span>
            </div>
          }
          slotProps={{
            primary: {
              className: classes.primaryText,
              noWrap: true,
            },
            secondary: {
              component: 'div',
            },
          }}
        />
        {position && (
          <div className={classes.trailingIcons}>
            {position.attributes.hasOwnProperty('alarm') && (
              <Tooltip title={`${t('eventAlarm')}: ${formatAlarm(position.attributes.alarm, t)}`}>
                <IconButton size="small" className={classes.iconButton}>
                  <ErrorIcon fontSize="small" sx={{ color: '#ef4444' }} />
                </IconButton>
              </Tooltip>
            )}
            {position.attributes.hasOwnProperty('ignition') && (
              <Tooltip
                title={`${t('positionIgnition')}: ${formatBoolean(position.attributes.ignition, t)}`}
              >
                <IconButton size="small" className={classes.iconButton}>
                  {position.attributes.ignition ? (
                    <EngineIcon width={18} height={18} style={{ color: '#22c55e' }} />
                  ) : (
                    <EngineIcon width={18} height={18} style={{ color: '#94a3b8' }} />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </div>
        )}
      </ListItemButton>
    </div>
  );
};

export default DeviceRow;
