import { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Toolbar,
  IconButton,
  OutlinedInput,
  InputAdornment,
  Popover,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Badge,
  ListItemButton,
  ListItemText,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import MapIcon from '@mui/icons-material/Map';
import DnsIcon from '@mui/icons-material/Dns';
import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useDeviceReadonly } from '../common/util/permissions';
import DeviceRow from './DeviceRow';

const useStyles = makeStyles()((theme) => ({
  toolbar: {
    display: 'flex',
    gap: theme.spacing(1),
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minHeight: '56px',
    backgroundColor: '#ffffff',
    [theme.breakpoints.up('sm')]: {
      paddingLeft: theme.spacing(1.5),
      paddingRight: theme.spacing(1.5),
      minHeight: '56px',
    },
  },
  actionButton: {
    borderRadius: '8px',
    color: '#64748b',
    padding: theme.spacing(1),
    transition: 'background-color 0.15s ease-in-out, color 0.15s ease-in-out',
    '&:hover': {
      backgroundColor: '#f1f5f9',
      color: '#020817',
    },
    '&.Mui-disabled': {
      opacity: 0.5,
      color: '#94a3b8',
    },
  },
  filterButton: {
    borderRadius: '8px',
    color: '#64748b',
    padding: '6px',
    transition: 'background-color 0.15s ease-in-out, color 0.15s ease-in-out',
    '&:hover': {
      backgroundColor: '#f1f5f9',
      color: '#020817',
    },
  },
  searchRoot: {
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    height: 40,
    transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
    '&:hover': {
      borderColor: '#cbd5e1',
    },
    '&.Mui-focused': {
      borderColor: '#1d4ed8',
      boxShadow: '0 0 0 1px #1d4ed8',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      border: 'none',
    },
    '& input': {
      padding: '8px 4px',
      fontSize: '14px',
      color: '#020817',
    },
  },
  searchIcon: {
    color: '#64748b',
    fontSize: 20,
    marginLeft: theme.spacing(0.5),
  },
  filterPanel: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    gap: theme.spacing(2),
    width: theme.dimensions.drawerWidthTablet,
  },
}));

const MainToolbar = ({
  filteredDevices,
  devicesOpen,
  setDevicesOpen,
  keyword,
  setKeyword,
  filter,
  setFilter,
  filterSort,
  setFilterSort,
  filterMap,
  setFilterMap,
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();
  const t = useTranslation();

  const deviceReadonly = useDeviceReadonly();

  const groups = useSelector((state) => state.groups.items);
  const devices = useSelector((state) => state.devices.items);
  const devicesLoaded = useSelector((state) => state.devices.loaded);
  const geofences = useSelector((state) => state.geofences.items);

  const toolbarRef = useRef();
  const inputRef = useRef();
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [devicesAnchorEl, setDevicesAnchorEl] = useState(null);

  const deviceStatusCount = (status) =>
    Object.values(devices).filter((d) => d.status === status).length;

  return (
    <Toolbar ref={toolbarRef} className={classes.toolbar}>
      <IconButton
        edge="start"
        className={classes.actionButton}
        onClick={() => setDevicesOpen(!devicesOpen)}
      >
        {devicesOpen ? <MapIcon /> : <DnsIcon />}
      </IconButton>
      <OutlinedInput
        ref={inputRef}
        placeholder={t('sharedSearchDevices')}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onFocus={() => setDevicesAnchorEl(toolbarRef.current)}
        onBlur={() => setDevicesAnchorEl(null)}
        startAdornment={
          <InputAdornment position="start">
            <SearchIcon className={classes.searchIcon} />
          </InputAdornment>
        }
        endAdornment={
          <InputAdornment position="end">
            <IconButton
              size="small"
              edge="end"
              className={classes.filterButton}
              onClick={() => setFilterAnchorEl(inputRef.current)}
            >
              <Badge
                color="info"
                variant="dot"
                invisible={
                  !filter.statuses.length && !filter.groups.length && !filter.geofences.length
                }
              >
                <TuneIcon fontSize="small" />
              </Badge>
            </IconButton>
          </InputAdornment>
        }
        size="small"
        fullWidth
        className={classes.searchRoot}
      />
      <Popover
        open={!!devicesAnchorEl && !devicesOpen}
        anchorEl={devicesAnchorEl}
        onClose={() => setDevicesAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: Number(theme.spacing(2).slice(0, -2)),
        }}
        marginThreshold={0}
        slotProps={{
          paper: {
            style: {
              width: `calc(${toolbarRef.current?.clientWidth}px - ${theme.spacing(4)})`,
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.08)',
              marginTop: '4px',
            },
          },
        }}
        elevation={0}
        disableAutoFocus
        disableEnforceFocus
      >
        {filteredDevices.slice(0, 3).map((_, index) => (
          <DeviceRow key={filteredDevices[index].id} devices={filteredDevices} index={index} />
        ))}
        {filteredDevices.length > 3 && (
          <ListItemButton alignItems="center" onClick={() => setDevicesOpen(true)}>
            <ListItemText primary={t('notificationAlways')} style={{ textAlign: 'center' }} />
          </ListItemButton>
        )}
      </Popover>
      <Popover
        open={!!filterAnchorEl}
        anchorEl={filterAnchorEl}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            style: {
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.08)',
              marginTop: '4px',
            },
          },
        }}
        elevation={0}
      >
        <div className={classes.filterPanel}>
          <FormControl>
            <InputLabel>{t('deviceStatus')}</InputLabel>
            <Select
              label={t('deviceStatus')}
              value={filter.statuses}
              onChange={(e) => setFilter({ ...filter, statuses: e.target.value })}
              multiple
            >
              <MenuItem value="online">{`${t('deviceStatusOnline')} (${deviceStatusCount('online')})`}</MenuItem>
              <MenuItem value="offline">{`${t('deviceStatusOffline')} (${deviceStatusCount('offline')})`}</MenuItem>
              <MenuItem value="unknown">{`${t('deviceStatusUnknown')} (${deviceStatusCount('unknown')})`}</MenuItem>
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>{t('settingsGroups')}</InputLabel>
            <Select
              label={t('settingsGroups')}
              value={filter.groups}
              onChange={(e) => setFilter({ ...filter, groups: e.target.value })}
              multiple
            >
              {Object.values(groups)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {group.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>{t('sharedGeofences')}</InputLabel>
            <Select
              label={t('sharedGeofences')}
              value={filter.geofences}
              onChange={(e) => setFilter({ ...filter, geofences: e.target.value })}
              multiple
            >
              {Object.values(geofences)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((geofence) => (
                  <MenuItem key={geofence.id} value={geofence.id}>
                    {geofence.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>{t('sharedSortBy')}</InputLabel>
            <Select
              label={t('sharedSortBy')}
              value={filterSort}
              onChange={(e) => setFilterSort(e.target.value)}
            >
              <MenuItem value="">{'\u00a0'}</MenuItem>
              <MenuItem value="name">{t('sharedName')}</MenuItem>
              <MenuItem value="lastUpdate">{t('deviceLastUpdate')}</MenuItem>
            </Select>
          </FormControl>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox checked={filterMap} onChange={(e) => setFilterMap(e.target.checked)} />
              }
              label={t('sharedFilterMap')}
            />
          </FormGroup>
        </div>
      </Popover>
      <IconButton
        edge="end"
        className={classes.actionButton}
        onClick={() => navigate('/settings/device')}
        disabled={deviceReadonly}
      >
        <Tooltip
          open={!deviceReadonly && devicesLoaded && Object.keys(devices).length === 0}
          title={t('deviceRegisterFirst')}
          arrow
        >
          <AddIcon />
        </Tooltip>
      </IconButton>
    </Toolbar>
  );
};

export default MainToolbar;
