import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Button,
  Chip,
  Stack,
  Alert,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  selectBulkyOrders,
  selectCanReadBulky,
  selectCanManageBulky,
  selectIsDispatcher,
  selectActiveBulkyUser,
} from '../store/selectors.js';
import { switchBulkyUser } from '../store/bulkySlice.js';
import { BULKY_PERSONAS } from '../services/bulkyServiceContract.js';
import { ORDER_STATUS, PAYMENT_STATUS, REFUND_STATUS } from '../domain/constants.js';
import { SofaIcon, PlusIcon, ClipboardIcon } from '../components/BulkyIcons.jsx';

export function BulkyOrdersPage({ thunks }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const canRead = useSelector(selectCanReadBulky);
  const canManage = useSelector(selectCanManageBulky);
  const isDispatcher = useSelector(selectIsDispatcher);
  const activeUser = useSelector(selectActiveBulkyUser);
  const orders = useSelector(selectBulkyOrders);

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (thunks?.fetchOrders && dispatch) {
      dispatch(thunks.fetchOrders());
    }
    if (thunks?.fetchNotifications && dispatch) {
      dispatch(thunks.fetchNotifications(activeUser?.role));
    }
  }, [thunks, dispatch, activeUser?.role]);

  const formatVnd = (val) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const getOrderStatusColor = (status) => {
    switch (status) {
      case ORDER_STATUS.CONFIRMED:
      case ORDER_STATUS.COMPLETED:
        return 'success';
      case ORDER_STATUS.CANCELLED:
        return 'error';
      case ORDER_STATUS.AWAITING_PAYMENT:
      case ORDER_STATUS.MANUAL_REVIEW:
        return 'warning';
      default:
        return 'default';
    }
  };

  const getOrderStatusLabel = (status) => {
    switch (status) {
      case ORDER_STATUS.CONFIRMED:
        return 'Đã xác nhận';
      case ORDER_STATUS.COMPLETED:
        return 'Đã hoàn thành';
      case ORDER_STATUS.CANCELLED:
        return 'Đã hủy đơn';
      case ORDER_STATUS.AWAITING_PAYMENT:
        return 'Chờ thanh toán';
      case ORDER_STATUS.MANUAL_REVIEW:
        return 'Cần xét duyệt';
      case ORDER_STATUS.DRAFT:
        return 'Bản nháp';
      default:
        return status;
    }
  };

  const getRefundStatusLabel = (status) => {
    switch (status) {
      case REFUND_STATUS.REQUESTED:
        return 'Đang yêu cầu';
      case REFUND_STATUS.PROCESSING:
        return 'Đang xử lý';
      case REFUND_STATUS.COMPLETED:
        return 'Đã hoàn tiền';
      case REFUND_STATUS.FAILED:
        return 'Thất bại';
      default:
        return status || 'Hoàn tiền';
    }
  };

  // KPI Metrics
  const stats = useMemo(() => {
    const total = orders.length;
    const confirmed = orders.filter(
      (o) =>
        o.orderStatus === ORDER_STATUS.CONFIRMED ||
        o.orderStatus === ORDER_STATUS.ASSIGNED ||
        o.orderStatus === ORDER_STATUS.IN_PROGRESS,
    ).length;
    const underReview = orders.filter(
      (o) =>
        o.changeRequest?.status === 'UNDER_REVIEW' ||
        o.orderStatus === ORDER_STATUS.MANUAL_REVIEW,
    ).length;
    const cancelled = orders.filter(
      (o) =>
        o.orderStatus === ORDER_STATUS.CANCELLED ||
        o.refundStatus === REFUND_STATUS.REQUESTED,
    ).length;
    return { total, confirmed, underReview, cancelled };
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Tab filter
      if (activeTab === 'CONFIRMED') {
        const isConf =
          order.orderStatus === ORDER_STATUS.CONFIRMED ||
          order.orderStatus === ORDER_STATUS.ASSIGNED ||
          order.orderStatus === ORDER_STATUS.IN_PROGRESS;
        if (!isConf) return false;
      } else if (activeTab === 'PAYMENT') {
        if (order.orderStatus !== ORDER_STATUS.AWAITING_PAYMENT) return false;
      } else if (activeTab === 'REVIEW') {
        const isRev =
          order.changeRequest?.status === 'UNDER_REVIEW' ||
          order.orderStatus === ORDER_STATUS.MANUAL_REVIEW;
        if (!isRev) return false;
      } else if (activeTab === 'CANCELLED') {
        const isCanc =
          order.orderStatus === ORDER_STATUS.CANCELLED ||
          order.refundStatus === REFUND_STATUS.REQUESTED;
        if (!isCanc) return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchId = order.orderId?.toLowerCase().includes(term);
        const matchAddr = order.serviceLocation?.address?.toLowerCase().includes(term);
        const matchItem = order.confirmedItems?.some((i) =>
          (i.displayName || i.catalogItemCode)?.toLowerCase().includes(term),
        );
        if (!matchId && !matchAddr && !matchItem) return false;
      }

      return true;
    });
  }, [orders, activeTab, searchTerm]);

  if (!canRead) {
    return (
      <Box sx={{ minHeight: '100vh', width: '100%', backgroundColor: '#f8fafc', color: '#0f172a', py: { xs: 2, sm: 4 } }}>
        <Container maxWidth="md">
          <Alert severity="error">
            Bạn không có quyền xem danh sách đơn rác cồng kềnh (Yêu cầu quyền VIEW_BULKY_ORDERS).
          </Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', width: '100%', backgroundColor: '#f8fafc', color: '#0f172a', py: { xs: 2, sm: 4 } }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              component="h1"
              fontWeight="bold"
              sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}
            >
              Đơn Thu Gom Rác Cồng Kềnh
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              Quản lý các yêu cầu thu gom sofa, nệm, tủ gỗ và tiến trình xử lý
            </Typography>
          </Box>
          {canManage && orders.length > 0 && (
            <Button
            variant="contained"
            onClick={() => navigate('/bulky/booking')}
            sx={{
              backgroundColor: '#1d4ed8',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              px: 2.5,
              py: 1,
              boxShadow: '0 4px 6px -1px rgba(29, 78, 216, 0.2)',
              '&:hover': { backgroundColor: '#1e40af' },
            }}
          >
            + Tạo yêu cầu mới
          </Button>
        )}
      </Box>

      {/* KPI Metric Summary Cards */}
      {orders.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          <Card
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              TỔNG ĐƠN HÀNG
            </Typography>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#0f172a', mt: 0.5 }}>
              {stats.total}
            </Typography>
          </Card>

          <Card
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: '1px solid #bbf7d0',
              backgroundColor: '#f0fdf4',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <Typography variant="caption" sx={{ color: '#166534', fontWeight: 600 }}>
              ĐÃ XÁC NHẬN
            </Typography>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#15803d', mt: 0.5 }}>
              {stats.confirmed}
            </Typography>
          </Card>

          <Card
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: '1px solid #fde68a',
              backgroundColor: '#fffbeb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <Typography variant="caption" sx={{ color: '#92400e', fontWeight: 600 }}>
              CHỜ XÉT DUYỆT
            </Typography>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#b45309', mt: 0.5 }}>
              {stats.underReview}
            </Typography>
          </Card>

          <Card
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: '1px solid #fed7aa',
              backgroundColor: '#fff7ed',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <Typography variant="caption" sx={{ color: '#9a3412', fontWeight: 600 }}>
              HỦY / HOÀN TIỀN
            </Typography>
            <Typography variant="h5" fontWeight="bold" sx={{ color: '#c2410c', mt: 0.5 }}>
              {stats.cancelled}
            </Typography>
          </Card>
        </Box>
      )}

      {/* Dispatcher Pending Review Alert Banner */}
      {isDispatcher && stats.underReview > 0 && (
        <Alert
          severity="warning"
          sx={{
            mb: 3,
            borderRadius: 2.5,
            border: '1px solid #fde68a',
            backgroundColor: '#fffbeb',
            color: '#92400e',
            fontWeight: 500,
            '& .MuiAlert-icon': { color: '#d97706' },
          }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setActiveTab('REVIEW')}
              sx={{ fontWeight: 'bold', textTransform: 'none' }}
            >
              Lọc đơn chờ duyệt →
            </Button>
          }
        >
          ⚡ <strong>Thông báo điều phối:</strong> Đang có {stats.underReview} đơn hàng có yêu cầu dời ngày hoặc hủy đơn chờ bạn xem xét phê duyệt!
        </Alert>
      )}

      {/* Filter Tabs & Search Bar */}
      {orders.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(e, val) => setActiveTab(val)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  minHeight: 44,
                },
              }}
            >
              <Tab label={`Tất cả (${orders.length})`} value="ALL" />
              <Tab label={`Đã xác nhận (${stats.confirmed})`} value="CONFIRMED" />
              <Tab
                label={`Chờ duyệt (${stats.underReview})`}
                value="REVIEW"
                sx={{ color: stats.underReview > 0 ? '#b45309' : undefined }}
              />
              <Tab label={`Hủy & Hoàn tiền (${stats.cancelled})`} value="CANCELLED" />
            </Tabs>
          </Box>

          <TextField
            placeholder="Tìm kiếm theo mã đơn, địa chỉ, hoặc loại đồ đạc..."
            size="small"
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <span style={{ fontSize: '1rem', color: '#64748b' }}>🔍</span>
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              backgroundColor: '#ffffff',
              borderRadius: 2,
              '& .MuiInputBase-input': { color: '#0f172a' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' },
            }}
          />
        </Box>
      )}

      {/* Empty state */}
      {orders.length === 0 ? (
        <Card
          variant="outlined"
          sx={{
            p: 5,
            textAlign: 'center',
            borderRadius: 3,
            border: '2px dashed #cbd5e1',
            backgroundColor: '#f8fafc',
          }}
        >
          <CardContent>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1d4ed8',
                mx: 'auto',
                mb: 2,
              }}
            >
              <SofaIcon size={32} />
            </Box>
            <Typography variant="h6" color="#0f172a" fontWeight="bold" gutterBottom>
              Chưa có đơn thu gom rác cồng kềnh nào
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 460, mx: 'auto' }}>
              Gửi yêu cầu thu gom đồ đạc cũ, rác cỡ lớn để được định giá minh bạch và sắp xếp xe vận
              chuyển tận nơi.
            </Typography>
            {canManage && (
              <Button
                variant="contained"
                onClick={() => navigate('/bulky/booking')}
                sx={{
                  backgroundColor: '#1d4ed8',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 3,
                  py: 1.2,
                }}
              >
                Tạo yêu cầu mới
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: 2 }}>
          <Typography variant="body1" color="text.secondary">
            Không tìm thấy đơn hàng nào phù hợp với bộ lọc hiện tại.
          </Typography>
          <Button size="small" onClick={() => { setActiveTab('ALL'); setSearchTerm(''); }} sx={{ mt: 1 }}>
            Xóa bộ lọc
          </Button>
        </Box>
      ) : (
        /* Order Cards List */
        <Stack spacing={2}>
          {filteredOrders.map((order) => {
            const isPaid = order.paymentStatus === PAYMENT_STATUS.SUCCESS;
            const isUnderReview = order.changeRequest?.status === 'UNDER_REVIEW';

            return (
              <Card
                key={order.orderId}
                variant="outlined"
                sx={{
                  borderRadius: 2.5,
                  borderColor: isUnderReview ? '#f59e0b' : '#e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease',
                  backgroundColor: '#ffffff',
                  '&:hover': {
                    borderColor: '#94a3b8',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  },
                }}
              >
                <CardActionArea
                  onClick={() => navigate(`/bulky/orders/${order.orderId}`)}
                  sx={{ p: 2 }}
                >
                  <CardContent sx={{ p: 0 }}>
                    {/* Card Header */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: 1,
                        mb: 1.5,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1.5,
                            backgroundColor: '#eff6ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#1d4ed8',
                          }}
                        >
                          <SofaIcon size={20} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#0f172a' }}>
                            {order.orderId}
                          </Typography>
                          {order.confirmedServiceWindow?.date && (
                            <Typography variant="caption" color="text.secondary">
                              Lịch hẹn: {order.confirmedServiceWindow.date}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {isUnderReview && (
                          <Chip
                            label="Cần điều phối duyệt"
                            color="warning"
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                        <Chip
                          label={getOrderStatusLabel(order.orderStatus)}
                          color={getOrderStatusColor(order.orderStatus)}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                        {order.paymentStatus && (
                          <Chip
                            label={isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                            color={isPaid ? 'success' : 'default'}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {order.refundStatus && order.refundStatus !== REFUND_STATUS.NONE && (
                          <Chip
                            label={`Hoàn tiền: ${getRefundStatusLabel(order.refundStatus)}`}
                            color="warning"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </Box>

                    {/* Items preview */}
                    {order.confirmedItems && order.confirmedItems.length > 0 && (
                      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          Đồ vật:
                        </Typography>
                        {order.confirmedItems.map((item, idx) => (
                          <Chip
                            key={idx}
                            label={`${item.quantity}x ${item.displayName || item.catalogItemCode}`}
                            size="small"
                            sx={{
                              backgroundColor: '#f1f5f9',
                              color: '#334155',
                              fontSize: '0.75rem',
                              height: 22,
                            }}
                          />
                        ))}
                      </Box>
                    )}

                    {/* Address */}
                    <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                      <span>📍</span> Địa chỉ: {order.serviceLocation?.address || 'Chưa cập nhật địa chỉ'}
                    </Typography>

                    {/* Card Footer */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        pt: 1.5,
                        borderTop: '1px solid #f1f5f9',
                      }}
                    >
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Ngày thu gom:{' '}
                        <strong style={{ color: '#0f172a' }}>
                          {order.confirmedServiceWindow?.date || order.requestedDate || 'Chưa chọn'}
                        </strong>
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#1d4ed8' }}>
                          {formatVnd(order.acceptedQuote?.totalVnd)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#1d4ed8', fontWeight: 600 }}>
                          Chi tiết →
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>

                {/* Role-based action banner for UNDER_REVIEW orders */}
                {isUnderReview && (
                  isDispatcher ? (
                    <Box
                      sx={{
                        px: 2.5,
                        py: 1.5,
                        backgroundColor: '#fffbeb',
                        borderTop: '1px dashed #fde68a',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 0.5,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#92400e' }}>
                          ⚡ Bàn Điều Phối ({activeUser?.name || 'Điều phối viên'}): Yêu cầu{' '}
                          {order.changeRequest?.type === 'RESCHEDULE'
                            ? `dời ngày sang ${order.changeRequest?.requestedDate}`
                            : 'hủy đơn'}{' '}
                          đang chờ duyệt
                        </Typography>
                        <Chip label="UNDER_REVIEW" size="small" color="warning" sx={{ fontWeight: 600 }} />
                      </Box>
                      {order.changeRequest?.reason && (
                        <Typography
                          variant="caption"
                          sx={{ color: '#78350f', display: 'block', mb: 1.2 }}
                        >
                          Lý do từ người dân: <em>"{order.changeRequest.reason}"</em>
                        </Typography>
                      )}
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (thunks?.acceptChangeOffer && dispatch) {
                              await dispatch(
                                thunks.acceptChangeOffer({
                                  changeRequestId: order.changeRequest.changeRequestId,
                                }),
                              );
                              if (thunks?.fetchOrders) dispatch(thunks.fetchOrders());
                            }
                          }}
                          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}
                        >
                          ✓ Duyệt chấp thuận
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (thunks?.rejectChangeOffer && dispatch) {
                              await dispatch(
                                thunks.rejectChangeOffer({
                                  changeRequestId: order.changeRequest.changeRequestId,
                                }),
                              );
                              if (thunks?.fetchOrders) dispatch(thunks.fetchOrders());
                            }
                          }}
                          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem' }}
                        >
                          ✕ Từ chối yêu cầu
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => navigate(`/bulky/orders/${order.orderId}`)}
                          sx={{ textTransform: 'none', color: '#64748b', fontSize: '0.8rem' }}
                        >
                          Xem chi tiết &amp; Outbox →
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    /* Citizen Perspective: Cannot self-approve, waiting for dispatcher */
                    <Box
                      sx={{
                        px: 2.5,
                        py: 1.5,
                        backgroundColor: '#f8fafc',
                        borderTop: '1px dashed #cbd5e1',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mb: 0.5,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                          ⏳ Đang chờ Trung tâm Điều phối Smartbin phê duyệt
                        </Typography>
                        <Chip
                          label="CHỜ DUYỆT"
                          size="small"
                          variant="outlined"
                          color="warning"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{ color: '#64748b', display: 'block', mb: 1 }}
                      >
                        Bạn đã gửi yêu cầu{' '}
                        {order.changeRequest?.type === 'RESCHEDULE'
                          ? `dời lịch hẹn sang ngày ${order.changeRequest?.requestedDate}`
                          : 'hủy đơn và hoàn tiền'}
                        . Điều phối viên đang sắp xếp lịch trình xe và sẽ phản hồi sớm.
                        (Tài khoản Người dân không thể tự duyệt đơn của mình).
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
                        onClick={(e) => {
                          e.stopPropagation();
                          const dispatcherPersona = BULKY_PERSONAS.find(
                            (p) => p.role === 'DISPATCHER',
                          );
                          if (dispatcherPersona) dispatch(switchBulkyUser(dispatcherPersona));
                        }}
                        sx={{
                          textTransform: 'none',
                          color: '#b45309',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          p: 0,
                          '&:hover': { textDecoration: 'underline', backgroundColor: 'transparent' },
                        }}
                      >
                        ⚡ Bạn muốn duyệt thử nghiệm? Bấm vào đây để chuyển sang tài khoản Điều phối viên →
                      </Button>
                    </Box>
                  )
                )}
              </Card>
            );
          })}
        </Stack>
      )}
      </Container>
    </Box>
  );
}

export default BulkyOrdersPage;
