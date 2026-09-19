import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  Card,
  CardContent,
  Typography,
  CardActions,
  IconButton,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Menu,
  MenuItem,
  CardMedia,
  TableFooter,
  Link,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CloseIcon from '@mui/icons-material/Close';
import RouteIcon from '@mui/icons-material/Route';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PendingIcon from '@mui/icons-material/Pending';

import { useTranslation } from './LocalizationProvider';
import RemoveDialog from './RemoveDialog';
import PositionValue from './PositionValue';
import { useDeviceReadonly, useRestriction } from '../util/permissions';
import usePositionAttributes from '../attributes/usePositionAttributes';
import { devicesActions } from '../../store';
import { useCatch, useCatchCallback } from '../../reactHelper';
import { useAttributePreference } from '../util/preferences';
import fetchOrThrow from '../util/fetchOrThrow';

const useStyles = makeStyles()((theme, { desktopPadding }) => ({
  card: {
    pointerEvents: 'auto',
    width: theme.dimensions.popupMaxWidth,
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px 10px 16px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    cursor: 'grab',
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: '0.9375rem',
    color: '#0f172a',
    letterSpacing: '-0.01em',
    lineHeight: 1.3,
  },
  closeButton: {
    borderRadius: '8px',
    padding: '6px',
    color: '#64748b',
    transition: 'all 150ms ease-in-out',
    '&:hover': {
      backgroundColor: '#f1f5f9',
      color: '#0f172a',
    },
  },
  media: {
    height: theme.dimensions.popupImageHeight,
    position: 'relative',
    '& $header': {
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(8px)',
    },
  },
  content: {
    padding: 0,
    maxHeight: theme.dimensions.cardContentMaxHeight,
    overflow: 'auto',
    '&:last-child': {
      paddingBottom: 0,
    },
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  labelCell: {
    color: '#64748b',
    fontSize: '0.8125rem',
    fontWeight: 500,
    padding: '8px 12px 8px 16px',
    borderBottom: '1px solid #f1f5f9',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  },
  valueCell: {
    color: '#020817',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontWeight: 500,
    fontSize: '0.8125rem',
    padding: '8px 16px 8px 12px',
    borderBottom: '1px solid #f1f5f9',
    textAlign: 'right',
    wordBreak: 'break-word',
    verticalAlign: 'middle',
  },
  footerCell: {
    padding: '10px 16px',
    borderBottom: 'none',
    textAlign: 'center',
    backgroundColor: '#fafbfc',
  },
  detailsLink: {
    color: '#1d4ed8',
    fontWeight: 500,
    fontSize: '0.8125rem',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
  },
  actionButton: {
    borderRadius: '8px',
    padding: '7px',
    color: '#475569',
    transition: 'all 150ms ease-in-out',
    '&:hover': {
      backgroundColor: '#f1f5f9',
      color: '#0f172a',
    },
    '&.Mui-disabled': {
      color: '#cbd5e1',
    },
  },
  actionButtonDanger: {
    borderRadius: '8px',
    padding: '7px',
    color: '#ef4444',
    transition: 'all 150ms ease-in-out',
    '&:hover': {
      backgroundColor: '#fef2f2',
      color: '#b91c1c',
    },
    '&.Mui-disabled': {
      color: '#cbd5e1',
    },
  },
  root: {
    pointerEvents: 'none',
    position: 'fixed',
    zIndex: 5,
    left: '50%',
    [theme.breakpoints.up('md')]: {
      left: `calc(50% + ${desktopPadding} / 2)`,
      bottom: theme.spacing(3),
    },
    [theme.breakpoints.down('md')]: {
      left: '50%',
      bottom: `calc(${theme.spacing(3)} + ${theme.dimensions.bottomBarHeight}px)`,
    },
    transform: 'translateX(-50%)',
  },
}));

const StatusRow = ({ name, content }) => {
  const { classes } = useStyles({ desktopPadding: 0 });

  return (
    <TableRow>
      <TableCell className={classes.labelCell}>{name}</TableCell>
      <TableCell className={classes.valueCell}>{content}</TableCell>
    </TableRow>
  );
};

const StatusCard = ({ deviceId, position, onClose, disableActions, desktopPadding = 0 }) => {
  const { classes } = useStyles({ desktopPadding });
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const deviceReadonly = useDeviceReadonly();

  const shareDisabled = useSelector((state) => state.session.server.attributes.disableShare);
  const user = useSelector((state) => state.session.user);
  const device = useSelector((state) => state.devices.items[deviceId]);

  const deviceImage = device?.attributes?.deviceImage;

  const positionAttributes = usePositionAttributes(t);
  const positionItems = useAttributePreference(
    'positionItems',
    'fixTime,address,speed,totalDistance',
  );

  const navigationAppLink = useAttributePreference('navigationAppLink');
  const navigationAppTitle = useAttributePreference('navigationAppTitle');

  const [anchorEl, setAnchorEl] = useState(null);

  const [removing, setRemoving] = useState(false);

  const handleRemove = useCatch(async (removed) => {
    if (removed) {
      const response = await fetchOrThrow('/api/devices');
      dispatch(devicesActions.refresh(await response.json()));
    }
    setRemoving(false);
  });

  const handleGeofence = useCatchCallback(async () => {
    const newItem = {
      name: t('sharedGeofence'),
      area: `CIRCLE (${position.latitude} ${position.longitude}, 50)`,
    };
    const response = await fetchOrThrow('/api/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    const item = await response.json();
    await fetchOrThrow('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: position.deviceId, geofenceId: item.id }),
    });
    navigate(`/settings/geofence/${item.id}`);
  }, [navigate, position, t]);

  return (
    <>
      <div className={classes.root}>
        {device && (
          <Rnd
            default={{ x: 0, y: 0, width: 'auto', height: 'auto' }}
            enableResizing={false}
            dragHandleClassName="draggable-header"
            style={{ position: 'relative' }}
          >
            <Card elevation={0} className={classes.card}>
              <CardMedia
                className={`draggable-header ${deviceImage ? classes.media : ''}`}
                image={deviceImage && `/api/media/${device.uniqueId}/${deviceImage}`}
              >
                <div className={classes.header}>
                  <Typography variant="body2" className={classes.headerTitle} noWrap>
                    {device.name}
                  </Typography>
                  <IconButton
                    size="small"
                    className={classes.closeButton}
                    onClick={onClose}
                    onTouchStart={onClose}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </div>
              </CardMedia>
              {position && (
                <CardContent className={classes.content}>
                  <Table size="small" className={classes.table}>
                    <TableBody>
                      {positionItems
                        .split(',')
                        .filter(
                          (key) =>
                            position.hasOwnProperty(key) || position.attributes.hasOwnProperty(key),
                        )
                        .map((key) => (
                          <StatusRow
                            key={key}
                            name={positionAttributes[key]?.name || key}
                            content={
                              <PositionValue
                                position={position}
                                property={position.hasOwnProperty(key) ? key : null}
                                attribute={position.hasOwnProperty(key) ? null : key}
                              />
                            }
                          />
                        ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className={classes.footerCell}>
                          <Link
                            component={RouterLink}
                            to={`/position/${position.id}`}
                            className={classes.detailsLink}
                          >
                            {t('sharedShowDetails')}
                          </Link>
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              )}
              <CardActions className={classes.actions} disableSpacing>
                <Tooltip title={t('sharedExtra')}>
                  <IconButton
                    className={classes.actionButton}
                    size="small"
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                    disabled={!position}
                  >
                    <PendingIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('reportReplay')}>
                  <IconButton
                    className={classes.actionButton}
                    size="small"
                    onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
                    disabled={disableActions || !position}
                  >
                    <RouteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('commandTitle')}>
                  <IconButton
                    className={classes.actionButton}
                    size="small"
                    onClick={() => navigate(`/settings/device/${deviceId}/command`)}
                    disabled={disableActions}
                  >
                    <SendIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('sharedEdit')}>
                  <IconButton
                    className={classes.actionButton}
                    size="small"
                    onClick={() => navigate(`/settings/device/${deviceId}`)}
                    disabled={disableActions || deviceReadonly}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('sharedRemove')}>
                  <IconButton
                    className={classes.actionButtonDanger}
                    size="small"
                    onClick={() => setRemoving(true)}
                    disabled={disableActions || deviceReadonly}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          </Rnd>
        )}
      </div>
      {position && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          slotProps={{
            paper: {
              sx: {
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                mt: 1,
              },
            },
          }}
        >
          <MenuItem
            sx={{
              fontSize: '0.8125rem',
              py: 1,
              px: 2,
              '&:hover': { backgroundColor: '#f1f5f9' },
            }}
            onClick={() => navigate(`/stream?deviceId=${deviceId}`)}
            disabled={position.protocol !== 'jt808'}
          >
            {t('linkLiveVideo')}
          </MenuItem>
          {!readonly && (
            <MenuItem
              sx={{
                fontSize: '0.8125rem',
                py: 1,
                px: 2,
                '&:hover': { backgroundColor: '#f1f5f9' },
              }}
              onClick={handleGeofence}
            >
              {t('sharedCreateGeofence')}
            </MenuItem>
          )}
          <MenuItem
            sx={{
              fontSize: '0.8125rem',
              py: 1,
              px: 2,
              '&:hover': { backgroundColor: '#f1f5f9' },
            }}
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/search/?api=1&query=${position.latitude}%2C${position.longitude}`}
          >
            {t('linkGoogleMaps')}
          </MenuItem>
          <MenuItem
            sx={{
              fontSize: '0.8125rem',
              py: 1,
              px: 2,
              '&:hover': { backgroundColor: '#f1f5f9' },
            }}
            component="a"
            target="_blank"
            href={`https://maps.apple.com/?ll=${position.latitude},${position.longitude}`}
          >
            {t('linkAppleMaps')}
          </MenuItem>
          <MenuItem
            sx={{
              fontSize: '0.8125rem',
              py: 1,
              px: 2,
              '&:hover': { backgroundColor: '#f1f5f9' },
            }}
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${position.latitude}%2C${position.longitude}&heading=${position.course}`}
          >
            {t('linkStreetView')}
          </MenuItem>
          {navigationAppTitle && navigationAppLink && (
            <MenuItem
              sx={{
                fontSize: '0.8125rem',
                py: 1,
                px: 2,
                '&:hover': { backgroundColor: '#f1f5f9' },
              }}
              component="a"
              target="_blank"
              href={navigationAppLink
                .replace('{latitude}', position.latitude)
                .replace('{longitude}', position.longitude)}
            >
              {navigationAppTitle}
            </MenuItem>
          )}
          {!shareDisabled && !user.temporary && (
            <MenuItem
              sx={{
                fontSize: '0.8125rem',
                py: 1,
                px: 2,
                '&:hover': { backgroundColor: '#f1f5f9' },
              }}
              onClick={() => navigate(`/settings/device/${deviceId}/share`)}
            >
              <Typography sx={{ fontSize: '0.8125rem', color: '#1d4ed8' }}>
                {t('sharedShare')}
              </Typography>
            </MenuItem>
          )}
        </Menu>
      )}
      <RemoveDialog
        open={removing}
        endpoint="devices"
        itemId={deviceId}
        onResult={(removed) => handleRemove(removed)}
      />
    </>
  );
};

export default StatusCard;
