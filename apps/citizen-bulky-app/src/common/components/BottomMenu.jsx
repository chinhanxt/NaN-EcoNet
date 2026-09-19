import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Menu,
  MenuItem,
  Typography,
  Badge,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';

import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import MapIcon from '@mui/icons-material/Map';
import PersonIcon from '@mui/icons-material/Person';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

import { sessionActions } from '../../store';
import { useTranslation } from './LocalizationProvider';
import { useRestriction } from '../util/permissions';
import { nativePostMessage } from './NativeInterface';

const useStyles = makeStyles()((theme) => ({
  paper: {
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e2e8f0',
    borderLeft: 'none',
    borderRight: 'none',
    borderBottom: 'none',
    boxShadow: 'none',
    padding: '4px 8px',
  },
  navigation: {
    backgroundColor: 'transparent',
    height: 'auto',
    display: 'flex',
    gap: theme.spacing(0.5),
  },
  action: {
    borderRadius: '8px',
    padding: '6px 4px',
    minWidth: 0,
    flex: 1,
    color: '#64748b',
    transition: 'background-color 0.15s ease-in-out, color 0.15s ease-in-out',
    '&:hover': {
      backgroundColor: '#f1f5f9',
      color: '#020817',
    },
    '&.Mui-selected': {
      backgroundColor: 'rgba(29, 78, 216, 0.1)',
      color: '#1d4ed8',
      '&:hover': {
        backgroundColor: 'rgba(29, 78, 216, 0.15)',
      },
    },
    '& .MuiBottomNavigationAction-label': {
      fontSize: '12px',
      fontWeight: 500,
      marginTop: '3px',
      color: '#64748b',
      transition: 'color 0.15s ease-in-out',
      '&.Mui-selected': {
        fontSize: '12px',
        fontWeight: 600,
        color: '#1d4ed8',
      },
    },
    '& .MuiSvgIcon-root': {
      fontSize: '22px',
      color: '#64748b',
      transition: 'color 0.15s ease-in-out',
    },
    '&.Mui-selected .MuiSvgIcon-root': {
      color: '#1d4ed8',
    },
  },
  menuPaper: {
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.08)',
    padding: '4px',
    minWidth: '160px',
    backgroundColor: '#ffffff',
  },
  menuItem: {
    borderRadius: '8px',
    padding: '8px 12px',
    gap: '10px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#020817',
    transition: 'background-color 0.15s ease-in-out',
    '&:hover': {
      backgroundColor: '#f1f5f9',
    },
  },
  logoutItem: {
    borderRadius: '8px',
    padding: '8px 12px',
    gap: '10px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#ef4444',
    transition: 'background-color 0.15s ease-in-out',
    '&:hover': {
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
    },
  },
}));

const BottomMenu = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');
  const devices = useSelector((state) => state.devices.items);
  const user = useSelector((state) => state.session.user);
  const socket = useSelector((state) => state.session.socket);
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const [anchorEl, setAnchorEl] = useState(null);

  const currentSelection = () => {
    if (location.pathname === `/settings/user/${user?.id}`) {
      return 'account';
    }
    if (location.pathname.startsWith('/settings')) {
      return 'settings';
    }
    if (location.pathname.startsWith('/reports')) {
      return 'reports';
    }
    if (location.pathname === '/') {
      return 'map';
    }
    return null;
  };

  const handleAccount = () => {
    setAnchorEl(null);
    navigate(`/settings/user/${user.id}`);
  };

  const handleLogout = async () => {
    setAnchorEl(null);

    const notificationToken = window.localStorage.getItem('notificationToken');
    if (notificationToken && !user.readonly) {
      window.localStorage.removeItem('notificationToken');
      const tokens = user.attributes.notificationTokens?.split(',') || [];
      if (tokens.includes(notificationToken)) {
        const updatedUser = {
          ...user,
          attributes: {
            ...user.attributes,
            notificationTokens:
              tokens.length > 1
                ? tokens.filter((it) => it !== notificationToken).join(',')
                : undefined,
          },
        };
        await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedUser),
        });
      }
    }

    await fetch('/api/session', { method: 'DELETE' });
    nativePostMessage('logout');
    navigate('/login');
    dispatch(sessionActions.updateUser(null));
  };

  const handleSelection = (event, value) => {
    switch (value) {
      case 'map':
        navigate('/');
        break;
      case 'reports': {
        let id = selectedDeviceId;
        if (id == null) {
          const deviceIds = Object.keys(devices);
          if (deviceIds.length === 1) {
            id = deviceIds[0];
          }
        }

        if (id != null) {
          navigate(`/reports/combined?deviceId=${id}`);
        } else {
          navigate('/reports/combined');
        }
        break;
      }
      case 'settings':
        navigate('/settings/preferences?menu=true');
        break;
      case 'account':
        setAnchorEl(event.currentTarget);
        break;
      case 'logout':
        handleLogout();
        break;
      default:
        break;
    }
  };

  return (
    <Paper square elevation={0} className={classes.paper}>
      <BottomNavigation
        value={currentSelection()}
        onChange={handleSelection}
        showLabels
        className={classes.navigation}
      >
        <BottomNavigationAction
          label={t('mapTitle') || 'Bản đồ'}
          icon={
            <Badge color="error" variant="dot" overlap="circular" invisible={socket !== false}>
              <MapIcon />
            </Badge>
          }
          value="map"
          className={classes.action}
        />
        {!disableReports && (
          <BottomNavigationAction
            label={t('reportTitle') || 'Báo cáo'}
            icon={<DescriptionIcon />}
            value="reports"
            className={classes.action}
          />
        )}
        {!readonly && (
          <BottomNavigationAction
            label={t('settingsTitle') || 'Cài đặt'}
            icon={<SettingsIcon />}
            value="settings"
            className={classes.action}
          />
        )}
        {readonly ? (
          <BottomNavigationAction
            label={t('loginLogout') || 'Đăng xuất'}
            icon={<ExitToAppIcon />}
            value="logout"
            className={classes.action}
          />
        ) : (
          <BottomNavigationAction
            label={t('settingsUser') || 'Tài khoản'}
            icon={<PersonIcon />}
            value="account"
            className={classes.action}
          />
        )}
      </BottomNavigation>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        slotProps={{
          paper: {
            className: classes.menuPaper,
          },
        }}
        elevation={0}
      >
        <MenuItem onClick={handleAccount} className={classes.menuItem}>
          <PersonIcon style={{ fontSize: 18, color: '#64748b' }} />
          <Typography style={{ fontSize: '13px', fontWeight: 500, color: '#020817' }}>
            {t('settingsUser') || 'Tài khoản'}
          </Typography>
        </MenuItem>
        <MenuItem onClick={handleLogout} className={classes.logoutItem}>
          <ExitToAppIcon style={{ fontSize: 18, color: '#ef4444' }} />
          <Typography style={{ fontSize: '13px', fontWeight: 500, color: '#ef4444' }}>
            {t('loginLogout') || 'Đăng xuất'}
          </Typography>
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default BottomMenu;
