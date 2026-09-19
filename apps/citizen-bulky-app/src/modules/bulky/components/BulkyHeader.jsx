import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Button,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Divider,
  Container,
  Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { BULKY_PERSONAS } from '../services/bulkyServiceContract.js';
import {
  switchBulkyUser,
  markNotificationRead as markNotificationReadAction,
  markAllNotificationsRead as markAllNotificationsReadAction,
} from '../store/bulkySlice.js';
import {
  selectActiveBulkyUser,
  selectRoleNotifications,
  selectUnreadNotificationsCount,
} from '../store/selectors.js';
import {
  SofaIcon,
  ClipboardIcon,
  PlusIcon,
  UserIcon,
  SettingsIcon,
  TruckIcon,
} from './BulkyIcons.jsx';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function BulkyHeader({ thunks }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const activeUser = useSelector(selectActiveBulkyUser) || BULKY_PERSONAS[0];
  const roleNotifications = useSelector(selectRoleNotifications);
  const unreadCount = useSelector(selectUnreadNotificationsCount);

  const [openModal, setOpenModal] = useState(false);
  const [notifAnchorEl, setNotifAnchorEl] = useState(null);
  const isNotifOpen = Boolean(notifAnchorEl);

  useEffect(() => {
    if (activeUser?.role && thunks?.fetchNotifications) {
      dispatch(thunks.fetchNotifications(activeUser.role));
      const interval = setInterval(() => {
        dispatch(thunks.fetchNotifications(activeUser.role));
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [dispatch, activeUser?.role, thunks]);

  const handleSelectPersona = (persona) => {
    dispatch(switchBulkyUser(persona));
    if (thunks?.fetchNotifications) {
      dispatch(thunks.fetchNotifications(persona.role));
    }
    setOpenModal(false);
  };

  const handleOpenNotif = (e) => {
    setNotifAnchorEl(e.currentTarget);
  };

  const handleCloseNotif = () => {
    setNotifAnchorEl(null);
  };

  const handleMarkAllAsRead = (e) => {
    e.stopPropagation();
    if (thunks?.markAllNotificationsRead) {
      dispatch(thunks.markAllNotificationsRead(activeUser.role));
    } else {
      dispatch(markAllNotificationsReadAction());
    }
  };

  const handleClickNotification = (notif) => {
    if (!notif.read) {
      if (thunks?.markNotificationRead) {
        dispatch(thunks.markNotificationRead(notif.id));
      } else {
        dispatch(markNotificationReadAction(notif.id));
      }
    }
    handleCloseNotif();
    if (notif.orderId) {
      navigate(`/bulky/orders/${notif.orderId}`);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'CITIZEN':
        return { label: 'Cư Dân', color: 'primary', icon: <UserIcon size={13} /> };
      case 'DISPATCHER':
        return { label: 'Điều Phối Viên', color: 'secondary', icon: <SettingsIcon size={13} /> };
      case 'COLLECTOR':
        return { label: 'Tài Xế Thu Gom', color: 'success', icon: <TruckIcon size={13} /> };
      default:
        return { label: 'Người Dân', color: 'primary', icon: <UserIcon size={13} /> };
    }
  };

  const currentBadge = getRoleBadge(activeUser.role);

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          color: '#0f172a',
          zIndex: 1100,
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: 60 }}>
            {/* Brand Logo & Title */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/bulky/orders')}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  backgroundColor: '#eff6ff',
                  border: '1px solid #dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1d4ed8',
                }}
              >
                <SofaIcon size={20} />
              </Box>
              <Box>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  sx={{ color: '#0f172a', lineHeight: 1.2 }}
                >
                  Smartbin • Thu Gom Rác Cồng Kềnh
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Dịch vụ thu gom đồ cũ &amp; phế thải đô thị
                </Typography>
              </Box>
            </Box>

            {/* Navigation & Role Switcher */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Button
                variant={location.pathname === '/bulky/orders' ? 'contained' : 'text'}
                size="small"
                startIcon={<ClipboardIcon size={15} />}
                onClick={() => navigate('/bulky/orders')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 2,
                  px: 2,
                  ...(location.pathname === '/bulky/orders'
                    ? { backgroundColor: '#1d4ed8', color: '#ffffff', boxShadow: 'none' }
                    : { color: '#475569', '&:hover': { backgroundColor: '#f1f5f9' } }),
                }}
              >
                Đơn thu gom
              </Button>

              <Button
                variant={location.pathname === '/bulky/booking' ? 'contained' : 'outlined'}
                size="small"
                startIcon={<PlusIcon size={15} />}
                onClick={() => navigate('/bulky/booking')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 2,
                  px: 2,
                  ...(location.pathname === '/bulky/booking'
                    ? { backgroundColor: '#1d4ed8', color: '#ffffff', boxShadow: 'none' }
                    : { borderColor: '#e2e8f0', color: '#1d4ed8', '&:hover': { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' } }),
                }}
              >
                Đặt lịch mới
              </Button>

              {/* Notification Bell */}
              <Tooltip title="Thông báo hệ thống">
                <IconButton
                  onClick={handleOpenNotif}
                  size="small"
                  aria-label="thông báo"
                  sx={{
                    p: 1,
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    backgroundColor: isNotifOpen ? '#eff6ff' : '#ffffff',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: '#94a3b8',
                      backgroundColor: '#f8fafc',
                    },
                  }}
                >
                  <Badge
                    badgeContent={unreadCount}
                    color="error"
                    max={99}
                    sx={{
                      '& .MuiBadge-badge': {
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        height: 18,
                        minWidth: 18,
                        px: 0.5,
                      },
                    }}
                  >
                    <NotificationsIcon
                      sx={{
                        fontSize: 22,
                        color: unreadCount > 0 ? '#ea580c' : '#64748b',
                      }}
                    />
                  </Badge>
                </IconButton>
              </Tooltip>

              <Divider orientation="vertical" flexItem sx={{ height: 24, my: 'auto', mx: 0.5 }} />

              {/* Active User Chip & Switch Button */}
              <Box
                onClick={() => setOpenModal(true)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2,
                  backgroundColor: activeUser.role === 'DISPATCHER' ? '#fffbeb' : '#f8fafc',
                  border:
                    activeUser.role === 'DISPATCHER'
                      ? '1px solid #fde68a'
                      : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: '#94a3b8',
                    backgroundColor: activeUser.role === 'DISPATCHER' ? '#fef3c7' : '#f1f5f9',
                  },
                }}
              >
                <Typography sx={{ fontSize: '1.1rem' }}>{currentBadge.icon}</Typography>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    sx={{ color: '#0f172a', lineHeight: 1.1 }}
                  >
                    {activeUser.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {currentBadge.label}
                  </Typography>
                </Box>
                <Chip
                  label={currentBadge.label}
                  size="small"
                  color={currentBadge.color}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    height: 22,
                    display: { xs: 'flex', sm: 'none' },
                  }}
                />
                <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 600, ml: 0.5 }}>
                  Đổi vai trò ▾
                </Typography>
              </Box>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Notification Dropdown Menu */}
      <Menu
        anchorEl={notifAnchorEl}
        open={isNotifOpen}
        onClose={handleCloseNotif}
        slotProps={{
          paper: {
            elevation: 4,
            sx: {
              width: { xs: 320, sm: 400 },
              maxHeight: 520,
              borderRadius: 3,
              mt: 1.5,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Notification Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#0f172a' }}>
              🔔 Thông báo
            </Typography>
            {unreadCount > 0 && (
              <Chip
                label={`${unreadCount} mới`}
                size="small"
                color="error"
                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
              />
            )}
          </Box>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={handleMarkAllAsRead}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                p: 0,
                minWidth: 0,
                color: '#2563eb',
                fontWeight: 600,
                '&:hover': { backgroundColor: 'transparent', textDecoration: 'underline' },
              }}
            >
              Đánh dấu đã đọc
            </Button>
          )}
        </Box>

        {/* Notification List */}
        <Box sx={{ overflowY: 'auto', flex: 1, maxHeight: 420 }}>
          {roleNotifications.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '2rem', mb: 1 }}>📭</Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Chưa có thông báo nào dành cho vai trò {currentBadge.label.toLowerCase()}.
              </Typography>
            </Box>
          ) : (
            roleNotifications.map((notif) => {
              const isUnread = !notif.read;
              const isRescheduleReq = notif.type === 'RESCHEDULE_REQUESTED';
              const isCancelReq = notif.type === 'CANCEL_REQUESTED';
              const isAccepted = notif.type === 'CHANGE_REQUEST_ACCEPTED';
              const isRejected = notif.type === 'CHANGE_REQUEST_REJECTED';

              let iconEmoji = '🔔';
              let iconBg = '#f1f5f9';
              if (isRescheduleReq) {
                iconEmoji = '📅';
                iconBg = '#fef3c7';
              } else if (isCancelReq) {
                iconEmoji = '🚫';
                iconBg = '#fee2e2';
              } else if (isAccepted) {
                iconEmoji = '✅';
                iconBg = '#dcfce7';
              } else if (isRejected) {
                iconEmoji = '❌';
                iconBg = '#fee2e2';
              }

              return (
                <MenuItem
                  key={notif.id}
                  onClick={() => handleClickNotification(notif)}
                  sx={{
                    py: 1.5,
                    px: 2,
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: isUnread ? '#eff6ff' : '#ffffff',
                    whiteSpace: 'normal',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    transition: 'background-color 0.15s',
                    '&:hover': {
                      backgroundColor: isUnread ? '#dbeafe' : '#f8fafc',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  >
                    {iconEmoji}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 1,
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight={isUnread ? 700 : 600}
                        sx={{
                          color: isUnread ? '#1e3a8a' : '#0f172a',
                          lineHeight: 1.3,
                        }}
                      >
                        {notif.title}
                      </Typography>
                      {isUnread && (
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#2563eb',
                            flexShrink: 0,
                            mt: 0.5,
                          }}
                        />
                      )}
                    </Box>

                    <Typography
                      variant="caption"
                      sx={{
                        color: '#475569',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        my: 0.5,
                        lineHeight: 1.4,
                      }}
                    >
                      {notif.message}
                    </Typography>

                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 0.5,
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                        {formatRelativeTime(notif.createdAt)}
                      </Typography>
                      {activeUser.role === 'DISPATCHER' && (isRescheduleReq || isCancelReq) ? (
                        <Typography
                          variant="caption"
                          sx={{ color: '#d97706', fontWeight: 700, fontSize: '0.75rem' }}
                        >
                          Xem & Duyệt ngay →
                        </Typography>
                      ) : (
                        <Typography
                          variant="caption"
                          sx={{ color: '#2563eb', fontWeight: 600, fontSize: '0.75rem' }}
                        >
                          Xem đơn #{notif.orderId} →
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </MenuItem>
              );
            })
          )}
        </Box>
      </Menu>

      {/* Role Switcher Dialog */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: { borderRadius: 3, p: 1 },
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography component="span" variant="h6" fontWeight="bold" sx={{ color: '#0f172a', display: 'block' }}>
            Đăng Nhập / Chuyển Đổi Tài Khoản &amp; Vai Trò
          </Typography>
          <Typography component="span" variant="body2" sx={{ color: '#64748b', display: 'block' }}>
            Chọn tài khoản để trải nghiệm đúng quyền hạn nghiệp vụ giữa Người dân và Điều phối viên.
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {BULKY_PERSONAS.map((persona) => {
              const isSelected = activeUser.id === persona.id;
              const badge = getRoleBadge(persona.role);

              return (
                <Card
                  key={persona.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 2.5,
                    borderColor: isSelected ? '#1d4ed8' : '#e2e8f0',
                    borderWidth: isSelected ? 2 : 1,
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    transition: 'all 0.2s',
                  }}
                >
                  <CardActionArea
                    onClick={() => handleSelectPersona(persona)}
                    sx={{ p: 2 }}
                  >
                    <CardContent sx={{ p: 0 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                          <Typography sx={{ fontSize: '1.4rem' }}>{badge.icon}</Typography>
                          <Box>
                            <Typography
                              variant="subtitle1"
                              fontWeight="bold"
                              sx={{ color: '#0f172a' }}
                            >
                              {persona.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {persona.householdName || 'Hệ thống Smartbin'}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          label={badge.label}
                          color={badge.color}
                          size="small"
                          sx={{ fontWeight: 700 }}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ color: '#334155', mt: 0.5 }}>
                        {persona.description}
                      </Typography>
                      {isSelected && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#1d4ed8',
                            fontWeight: 700,
                            display: 'block',
                            mt: 1,
                          }}
                        >
                          ✓ Đang hoạt động ở vai trò này
                        </Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setOpenModal(false)}
            variant="outlined"
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default BulkyHeader;
