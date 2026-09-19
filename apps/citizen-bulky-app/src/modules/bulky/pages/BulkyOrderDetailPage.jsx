import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  selectBulkyOrderById,
  selectOrderActions,
  selectRefundProgress,
  selectCanReadBulky,
  selectIsDispatcher,
  selectActiveBulkyUser,
} from '../store/selectors.js';
import { ITEM_SIZES } from '../domain/itemSizes.js';
import { OrderTimeline } from '../features/orders/OrderTimeline.jsx';
import { RescheduleDialog } from '../features/orders/RescheduleDialog.jsx';
import { CancelDialog } from '../features/orders/CancelDialog.jsx';
import { RefundTracker } from '../features/orders/RefundTracker.jsx';
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  MATERIAL_FACTORS,
} from '../domain/constants.js';

export function BulkyOrderDetailPage({ thunks }) {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const canRead = useSelector(selectCanReadBulky);
  const isDispatcher = useSelector(selectIsDispatcher);
  const activeUser = useSelector(selectActiveBulkyUser);
  const order = useSelector((state) => selectBulkyOrderById(state, orderId));
  const actions = useSelector((state) => selectOrderActions(state, orderId), shallowEqual);
  const refundProgress = useSelector((state) => selectRefundProgress(state, orderId), shallowEqual);

  const [openReschedule, setOpenReschedule] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [safetyReviewNote, setSafetyReviewNote] = useState('');
  const [safetyConfirmationChecked, setSafetyConfirmationChecked] = useState(false);

  const hasSafetyFlags = Boolean(
    order?.recognitionResult?.containsHazardousWaste ||
    order?.recognitionResult?.containsConstructionWaste,
  );
  const safetyReviewCleared = order?.safetyReview?.status === 'CLEARED';

  const handleManualPrice = async () => {
    setIsProcessing(true);
    setActionError(null);
    try {
      await dispatch(
        thunks.setManualPrice(orderId, { totalVnd: Number(manualAmount), note: manualNote }),
      );
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearSafetyFlag = async () => {
    setIsProcessing(true);
    setActionError(null);
    try {
      await dispatch(thunks.resolveSafetyReview(orderId, { note: safetyReviewNote.trim() }));
      setSafetyConfirmationChecked(false);
    } catch (error) {
      setActionError(error.message || 'Không thể lưu kết quả kiểm tra an toàn.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (orderId && thunks?.fetchOrderById && dispatch) {
      dispatch(thunks.fetchOrderById(orderId));
    }
  }, [orderId, thunks, dispatch]);

  const formatVnd = (val) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const handoverToleranceStatus =
    order?.handoverToleranceStatus ||
    order?.toleranceStatus ||
    order?.handoverStatus ||
    (order?.orderStatus === ORDER_STATUS.COMPLETED
      ? 'VERIFIED_WITHIN_TOLERANCE'
      : 'PENDING_ON_SITE_REVIEW');

  const getHandoverStatusLabel = (status) => {
    switch (status) {
      case 'VERIFIED_WITHIN_TOLERANCE':
        return 'Đạt dung sai (VERIFIED_WITHIN_TOLERANCE)';
      case 'PENDING_ON_SITE_REVIEW':
        return 'Chờ nghiệm thu tại chỗ (PENDING_ON_SITE_REVIEW)';
      case 'REFUND_DISCREPANCY':
        return 'Hoàn tiền chênh lệch (REFUND_DISCREPANCY)';
      case 'SUPPLEMENTAL_REVIEW':
        return 'Phụ thu bổ sung (SUPPLEMENTAL_REVIEW)';
      default:
        return status || 'Chờ nghiệm thu';
    }
  };

  const estimatedRange = ['ITEM_SIZE', 'MANUAL'].includes(order?.acceptedQuote?.pricingBasis)
    ? null
    : order?.acceptedQuote?.estimatedRange ||
      (order?.acceptedQuote?.totalVnd
        ? {
            minVnd: order.acceptedQuote.totalVnd,
            maxVnd: Math.round(order.acceptedQuote.totalVnd * 1.3),
            depositHoldVnd: order.acceptedQuote.totalVnd,
          }
        : null);

  const tolerancePolicy = order?.acceptedQuote?.tolerancePolicy || {
    allowedPercent: 15,
    message:
      'Miễn phí phụ thu nếu khối lượng hoặc kích thước thực tế sai lệch không quá ±15% so với khai báo.',
  };

  const getOrderStatusLabel = (status) => {
    switch (status) {
      case ORDER_STATUS.CONFIRMED:
        return 'Đã xác nhận';
      case ORDER_STATUS.ASSIGNED:
        return 'Đã phân công xe';
      case ORDER_STATUS.IN_PROGRESS:
        return 'Đang thu gom';
      case ORDER_STATUS.COMPLETED:
        return 'Đã hoàn thành';
      case ORDER_STATUS.CANCELLED:
        return 'Đã hủy đơn';
      case ORDER_STATUS.AWAITING_PAYMENT:
        return 'Chờ thanh toán';
      case ORDER_STATUS.MANUAL_REVIEW:
        return 'Chờ xét duyệt';
      case ORDER_STATUS.DRAFT:
        return 'Bản nháp';
      default:
        return status;
    }
  };

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
        return 'primary';
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

  const getPlacementLabel = (placement) => {
    switch (placement) {
      case 'CURBSIDE':
        return 'Vỉa hè / Mặt đường';
      case 'GROUND_FLOOR':
        return 'Tầng trệt trong nhà';
      case 'INDOORS':
        return 'Trong nhà';
      default:
        return placement || 'Mặt đường';
    }
  };

  const handleConfirmReschedule = async ({ requestedDate, reason }) => {
    setIsProcessing(true);
    setActionError(null);
    try {
      if (thunks?.rescheduleOrder && dispatch) {
        await dispatch(thunks.rescheduleOrder({ orderId, requestedDate, reason }));
        if (thunks?.fetchNotifications) {
          dispatch(thunks.fetchNotifications(activeUser?.role));
        }
      }
      setOpenReschedule(false);
    } catch (err) {
      setActionError(err.message || 'Không thể gửi yêu cầu đổi ngày');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmCancel = async (reason) => {
    setIsProcessing(true);
    setActionError(null);
    try {
      if (thunks?.cancelOrder && dispatch) {
        await dispatch(thunks.cancelOrder({ orderId, reason }));
        if (thunks?.fetchNotifications) {
          dispatch(thunks.fetchNotifications(activeUser?.role));
        }
      }
      setOpenCancel(false);
    } catch (err) {
      setActionError(err.message || 'Không thể hủy đơn');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptChangeRequest = async () => {
    if (!order?.changeRequest?.changeRequestId) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      if (thunks?.acceptChangeOffer && dispatch) {
        await dispatch(
          thunks.acceptChangeOffer({ changeRequestId: order.changeRequest.changeRequestId }),
        );
        if (thunks?.fetchNotifications) {
          dispatch(thunks.fetchNotifications(activeUser?.role));
        }
      }
    } catch (err) {
      setActionError(err.message || 'Không thể chấp thuận yêu cầu');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectChangeRequest = async () => {
    if (!order?.changeRequest?.changeRequestId) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      if (thunks?.rejectChangeOffer && dispatch) {
        await dispatch(
          thunks.rejectChangeOffer({ changeRequestId: order.changeRequest.changeRequestId }),
        );
        if (thunks?.fetchNotifications) {
          dispatch(thunks.fetchNotifications(activeUser?.role));
        }
      }
    } catch (err) {
      setActionError(err.message || 'Không thể từ chối yêu cầu');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!canRead) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          py: { xs: 2, sm: 4 },
        }}
      >
        <Container maxWidth="md">
          <Alert severity="error">
            Bạn không có quyền xem thông tin đơn rác cồng kềnh (Yêu cầu quyền VIEW_BULKY_ORDERS).
          </Alert>
        </Container>
      </Box>
    );
  }

  if (!order) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          width: '100%',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          py: { xs: 2, sm: 4 },
        }}
      >
        <Container maxWidth="md">
          <Alert severity="info">Không tìm thấy thông tin đơn hàng.</Alert>
        </Container>
      </Box>
    );
  }

  const isPaid = order.paymentStatus === PAYMENT_STATUS.SUCCESS;
  const isUnderReview = order.changeRequest?.status === 'UNDER_REVIEW';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        py: { xs: 2, sm: 4 },
      }}
    >
      <Container maxWidth="md">
        {/* Navigation Breadcrumb */}
        <Box sx={{ mb: 2 }}>
          <Button
            onClick={() => navigate('/bulky/orders')}
            sx={{
              textTransform: 'none',
              color: '#64748b',
              fontWeight: 600,
              fontSize: '0.875rem',
              '&:hover': { color: '#1d4ed8', backgroundColor: '#eff6ff' },
            }}
          >
            ← Danh sách đơn thu gom
          </Button>
        </Box>

        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}
        >
          <Box>
            <Typography
              variant="h4"
              component="h1"
              fontWeight="bold"
              sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}
            >
              {order.orderId}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              Chi tiết yêu cầu thu gom rác cồng kềnh
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              label={getOrderStatusLabel(order.orderStatus)}
              color={getOrderStatusColor(order.orderStatus)}
              sx={{ fontWeight: 600 }}
            />
            <Chip
              label={isPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
              color={isPaid ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>
        </Box>

        {actionError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {actionError}
          </Alert>
        )}

        <Stack spacing={3}>
          {/* Change Request Banner */}
          {order.changeRequest && (
            <Alert
              severity={order.changeRequest.status === 'UNDER_REVIEW' ? 'warning' : 'info'}
              sx={{ mb: 1 }}
            >
              <strong>
                {order.changeRequest.type === 'RESCHEDULE'
                  ? 'Yêu cầu đổi ngày thu gom: '
                  : 'Yêu cầu hủy đơn: '}
              </strong>
              {order.changeRequest.status === 'UNDER_REVIEW'
                ? 'Yêu cầu đã được gửi và đang được ban điều phối xem xét duyệt.'
                : order.changeRequest.status === 'ACCEPTED'
                  ? `Đã được chấp nhận (Ngày mới: ${order.changeRequest.requestedDate || order.requestedDate}).`
                  : order.changeRequest.status === 'REJECTED'
                    ? 'Yêu cầu đã bị ban điều phối từ chối (giữ nguyên đơn cũ).'
                    : order.changeRequest.status}
              {order.changeRequest.reason && ` (Lý do: ${order.changeRequest.reason})`}
            </Alert>
          )}

          {/* Dispatcher Review Simulation Panel */}
          {order.changeRequest?.status === 'UNDER_REVIEW' && (
            <Card
              sx={{
                border: '2px solid #f59e0b',
                backgroundColor: '#fffbeb',
                borderRadius: 2,
                boxShadow:
                  '0 4px 6px -1px rgba(245, 158, 11, 0.1), 0 2px 4px -2px rgba(245, 158, 11, 0.1)',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    label="BÀN ĐIỀU PHỐI VIÊN (MÔ PHỎNG TEST)"
                    color="warning"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                  <Chip
                    label="CHỜ XỬ LÝ (UNDER_REVIEW)"
                    variant="outlined"
                    color="warning"
                    size="small"
                  />
                </Box>
                <Typography variant="h6" fontWeight="bold" color="#92400e" gutterBottom>
                  Yêu cầu{' '}
                  {order.changeRequest.type === 'RESCHEDULE' ? 'dời ngày thu gom' : 'hủy đơn hàng'}{' '}
                  sau thời hạn cắt (&lt; 24h)
                </Typography>
                <Typography variant="body2" color="#78350f">
                  {order.changeRequest.type === 'RESCHEDULE' ? (
                    <>
                      Người dân yêu cầu chuyển ngày hẹn từ{' '}
                      <strong>{order.confirmedServiceWindow?.date || order.requestedDate}</strong>{' '}
                      sang <strong>{order.changeRequest.requestedDate}</strong>.
                    </>
                  ) : (
                    <>Người dân yêu cầu hủy đơn hàng đã xác nhận và đề nghị hoàn tiền.</>
                  )}
                  {order.changeRequest.reason && (
                    <>
                      {' '}
                      (Lý do: <em>"{order.changeRequest.reason}"</em>)
                    </>
                  )}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: '#b45309', fontSize: '0.85rem' }}>
                  💡{' '}
                  <em>
                    {isDispatcher
                      ? `Tài khoản hiện tại: Điều phối viên (${activeUser?.name || 'Cán bộ'}). Bạn có thẩm quyền phê duyệt:`
                      : 'Khu vực thao tác thử nghiệm: Ở môi trường thực tế, cư dân chỉ thấy trạng thái chờ duyệt. Tại đây bạn có thể bấm duyệt hoặc từ chối để kiểm thử luồng nghiệp vụ:'}
                  </em>
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    color="success"
                    disabled={isProcessing}
                    onClick={handleAcceptChangeRequest}
                  >
                    Duyệt yêu cầu (Chấp thuận)
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    disabled={isProcessing}
                    onClick={handleRejectChangeRequest}
                  >
                    Từ chối yêu cầu (Bác bỏ)
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Refund tracker */}
          {refundProgress.hasRefund && (
            <RefundTracker refund={refundProgress.refund} refundStatus={refundProgress.status} />
          )}

          {/* General Details Card */}
          <Card
            variant="outlined"
            sx={{
              p: 1,
              borderRadius: 2.5,
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ color: '#0f172a' }} gutterBottom>
                Thông Tin Thu Gom
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.2}>
                <Typography variant="body2" sx={{ color: '#475569' }}>
                  <strong style={{ color: '#0f172a' }}>Địa chỉ:</strong>{' '}
                  {order.serviceLocation?.address || 'Chưa cập nhật'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569' }}>
                  <strong style={{ color: '#0f172a' }}>Ngày hẹn thu gom:</strong>{' '}
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>
                    {order.confirmedServiceWindow?.date || order.requestedDate || 'Chưa xếp lịch'}
                  </span>
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569' }}>
                  <strong style={{ color: '#0f172a' }}>Điều kiện bốc xếp:</strong> Vị trí{' '}
                  {getPlacementLabel(order.handlingConditions?.placement)}, Tầng:{' '}
                  {order.handlingConditions?.floorNumber || 0} (
                  {order.handlingConditions?.hasLift ? 'Có thang máy' : 'Không thang máy'})
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569' }}>
                  <strong style={{ color: '#0f172a' }}>Tổng chi phí:</strong>{' '}
                  <span style={{ fontWeight: 'bold', color: '#1d4ed8', fontSize: '1.1rem' }}>
                    {order.orderStatus === ORDER_STATUS.MANUAL_REVIEW
                      ? 'Chờ nhân viên báo giá'
                      : formatVnd(order.acceptedQuote?.totalVnd)}
                  </span>
                </Typography>
                {estimatedRange && (
                  <Typography variant="body2" sx={{ color: '#475569' }}>
                    <strong style={{ color: '#0f172a' }}>Khoảng giá dự toán:</strong>{' '}
                    <span style={{ fontWeight: 600, color: '#0369a1' }}>
                      {formatVnd(estimatedRange.minVnd)} – {formatVnd(estimatedRange.maxVnd)}
                    </span>
                  </Typography>
                )}
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pt: 0.5 }}
                >
                  <Typography variant="body2" sx={{ color: '#475569' }}>
                    <strong style={{ color: '#0f172a' }}>Nghiệm thu bàn giao:</strong>
                  </Typography>
                  <Chip
                    label={getHandoverStatusLabel(handoverToleranceStatus)}
                    size="small"
                    color={
                      handoverToleranceStatus === 'VERIFIED_WITHIN_TOLERANCE' ? 'success' : 'info'
                    }
                    variant={
                      handoverToleranceStatus === 'VERIFIED_WITHIN_TOLERANCE'
                        ? 'filled'
                        : 'outlined'
                    }
                    sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                  />
                </Box>
                {order.imageMetadata?.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {order.imageMetadata.map(
                      (photo, index) =>
                        photo.dataUrl && (
                          <Box
                            key={index}
                            component="img"
                            src={photo.dataUrl}
                            alt={`Ảnh đồ vật ${index + 1}`}
                            sx={{ width: 180, height: 140, objectFit: 'contain', borderRadius: 1 }}
                          />
                        ),
                    )}
                  </Stack>
                )}
                {order.orderStatus === ORDER_STATUS.MANUAL_REVIEW && hasSafetyFlags && (
                  <Alert severity={safetyReviewCleared ? 'warning' : 'error'}>
                    <strong>AI đã gắn cờ an toàn:</strong>{' '}
                    {order.recognitionResult?.hazardousReason ||
                      order.recognitionResult?.explanation ||
                      'Có thể có rác nguy hại hoặc phế thải xây dựng.'}{' '}
                    {safetyReviewCleared
                      ? `Điều phối viên ${order.safetyReview.reviewedBy} đã kiểm tra và xác nhận cờ nhầm.`
                      : 'Chưa được báo giá hoặc xác nhận lịch thu gom.'}
                  </Alert>
                )}
                {order.orderStatus === ORDER_STATUS.MANUAL_REVIEW && !hasSafetyFlags && (
                  <Alert severity="info">
                    Yêu cầu cần nhân viên kiểm tra ảnh, loại đồ và kích thước trước khi báo giá.
                    Chưa thu tiền hoặc xác nhận lịch thu gom. {order.manualReviewReasons?.join(' ')}
                  </Alert>
                )}
                {order.orderStatus === ORDER_STATUS.MANUAL_REVIEW &&
                  isDispatcher &&
                  hasSafetyFlags &&
                  !safetyReviewCleared &&
                  thunks?.resolveSafetyReview && (
                    <Stack spacing={1.5}>
                      <TextField
                        label="Ghi chú kiểm tra ảnh"
                        multiline
                        minRows={2}
                        value={safetyReviewNote}
                        onChange={(event) => setSafetyReviewNote(event.target.value)}
                        helperText="Ghi rõ vật dụng đã kiểm tra và vì sao cờ nguy hại/xây dựng không áp dụng."
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={safetyConfirmationChecked}
                            onChange={(event) => setSafetyConfirmationChecked(event.target.checked)}
                          />
                        }
                        label="Tôi đã kiểm tra ảnh và xác nhận không có rác nguy hại hoặc phế thải xây dựng."
                      />
                      <Button
                        variant="outlined"
                        disabled={
                          isProcessing ||
                          !safetyConfirmationChecked ||
                          safetyReviewNote.trim().length < 10
                        }
                        onClick={handleClearSafetyFlag}
                      >
                        Xác nhận cờ AI nhầm, mở báo giá
                      </Button>
                    </Stack>
                  )}
                {order.orderStatus === ORDER_STATUS.MANUAL_REVIEW &&
                  isDispatcher &&
                  (!hasSafetyFlags || safetyReviewCleared) &&
                  thunks?.setManualPrice && (
                    <Stack spacing={2}>
                      <TextField
                        label="Tổng phí trọn gói (VND)"
                        type="number"
                        value={manualAmount}
                        onChange={(event) => setManualAmount(event.target.value)}
                      />
                      <TextField
                        label="Nội dung và phạm vi báo giá"
                        multiline
                        value={manualNote}
                        onChange={(event) => setManualNote(event.target.value)}
                        helperText="Kiểm tra ảnh và thông tin vật dụng trước khi báo giá; không nhận rác nguy hại/xây dựng."
                      />
                      <Button
                        variant="contained"
                        disabled={isProcessing || !manualNote.trim() || !(Number(manualAmount) > 0)}
                        onClick={handleManualPrice}
                      >
                        Gửi báo giá cho người dân
                      </Button>
                    </Stack>
                  )}
                {order.manualPrice && !order.acceptedQuote && (
                  <Alert severity="success">
                    Nhân viên đề xuất {formatVnd(order.manualPrice.totalVnd)}:{' '}
                    {order.manualPrice.note}
                    {!isDispatcher && (
                      <Button onClick={() => navigate(`/bulky/quote/${orderId}`)}>
                        Xem báo giá & giữ chỗ
                      </Button>
                    )}
                  </Alert>
                )}
                {['ITEM_SIZE', 'MANUAL'].includes(order.acceptedQuote?.pricingBasis) ? (
                  <Alert severity="info">{order.acceptedQuote.priceChangeNotice}</Alert>
                ) : (
                  order.acceptedQuote && (
                    <Alert severity="success" sx={{ mt: 1, py: 0.5, px: 1.5, borderRadius: 2 }}>
                      🛡️ <strong>Cam kết dung sai ±{tolerancePolicy.allowedPercent}%:</strong>{' '}
                      {tolerancePolicy.message}
                    </Alert>
                  )
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Multi-Module Trace Card (Dev 2 Dispatch & Dev 3 Billing) */}
          <Card
            variant="outlined"
            sx={{
              p: 1,
              borderRadius: 2.5,
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <CardContent>
              <Typography
                variant="h6"
                fontWeight="bold"
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#0f172a' }}
              >
                📡 Tích Hợp Đa Phân Hệ (Dev 2 Dispatch & Dev 3 Billing Trace)
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={2}>
                {/* Dev 2 Dispatch Outbox */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 1.5,
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight="bold" color="#1e293b">
                      1. Phân hệ Điều phối & Lộ trình xe (Dev 2 - dispatch/, routing/)
                    </Typography>
                    {order.lastDispatchEvent ? (
                      <Chip
                        label={
                          order.lastDispatchEvent.type === 'UPSERT'
                            ? 'Cập nhật lộ trình (UPSERT)'
                            : 'Hủy điểm dừng (CANCEL)'
                        }
                        color={order.lastDispatchEvent.type === 'UPSERT' ? 'success' : 'error'}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    ) : (
                      <Chip label="Chưa có sự kiện" size="small" variant="outlined" />
                    )}
                  </Box>
                  {order.lastDispatchEvent ? (
                    <Stack spacing={0.5}>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        <strong>Mã sự kiện:</strong> <code>{order.lastDispatchEvent.eventId}</code>
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        <strong>Phiên bản xác nhận:</strong> v
                        {order.lastDispatchEvent.confirmationVersion} | <strong>Thời điểm:</strong>{' '}
                        {new Date(order.lastDispatchEvent.occurredAt).toLocaleString('vi-VN')}
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#059669' }}>
                        ✓ Đã gửi vào <code>dispatchOutbox</code> để bên Dev 2{' '}
                        {order.lastDispatchEvent.type === 'UPSERT'
                          ? 'tự động cập nhật điểm dừng thu gom của tài xế.'
                          : 'tự động gỡ bỏ điểm dừng và giải phóng tải xe thu gom.'}
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      Sự kiện điều vận (createDispatchEvent) sẽ tự động phát sinh khi hoàn tất thanh
                      toán hoặc khi đổi lịch/hủy đơn thành công.
                    </Typography>
                  )}
                </Box>

                {/* Dev 3 Billing & Refund */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 1.5,
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight="bold" color="#1e293b">
                      2. Phân hệ Kế toán & Cổng thanh toán (Dev 3 - billing/)
                    </Typography>
                    <Chip
                      label={
                        refundProgress.hasRefund
                          ? `Hoàn tiền: ${getRefundStatusLabel(refundProgress.status)}`
                          : isPaid
                            ? 'Đã quyết toán (Doanh thu)'
                            : 'Chưa thanh toán'
                      }
                      color={refundProgress.hasRefund ? 'warning' : isPaid ? 'success' : 'default'}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </Box>
                  {refundProgress.hasRefund ? (
                    <Stack spacing={0.5}>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        <strong>Mã phiếu hoàn tiền:</strong>{' '}
                        <code>{refundProgress.refund?.refundId || 'Đang xử lý'}</code>
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        <strong>Số tiền hoàn:</strong>{' '}
                        <span style={{ color: '#dc2626', fontWeight: 'bold' }}>
                          {formatVnd(
                            refundProgress.refund?.amountVnd || order.acceptedQuote?.totalVnd,
                          )}
                        </span>{' '}
                        (100% chi phí đơn)
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#b45309' }}>
                        ✓ Phiếu hoàn tiền đã được ghi nhận trong sổ cái Billing để đối soát và trả
                        lại tài khoản người dân.
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      {isPaid
                        ? `Đã nhận thanh toán ${formatVnd(order.acceptedQuote?.totalVnd)}. Giao dịch đã được ghi nhận trong sổ cái doanh thu.`
                        : 'Đơn chưa thanh toán trả trước.'}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Confirmed Items Card */}
          <Card
            variant="outlined"
            sx={{
              p: 1,
              borderRadius: 2.5,
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ color: '#0f172a' }} gutterBottom>
                Danh Mục Đồ Cồng Kềnh
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                    <TableCell sx={{ color: '#475569', fontWeight: 600 }}>Tên đồ vật</TableCell>
                    <TableCell sx={{ color: '#475569', fontWeight: 600 }}>Chất liệu</TableCell>
                    <TableCell align="right" sx={{ color: '#475569', fontWeight: 600 }}>
                      Số lượng
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#475569', fontWeight: 600 }}>
                      Kích thước
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(order.confirmedItems || []).map((item, idx) => {
                    const materialMeta =
                      MATERIAL_FACTORS[item.material] ||
                      (item.material ? { label: item.material } : null);
                    return (
                      <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                        <TableCell sx={{ color: '#0f172a', fontWeight: 500 }}>
                          {item.displayName || item.catalogItemCode}
                        </TableCell>
                        <TableCell>
                          {materialMeta ? (
                            <Chip
                              label={materialMeta.label}
                              size="small"
                              variant="outlined"
                              color="primary"
                              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                            />
                          ) : (
                            <Chip
                              label="Chưa xác nhận"
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.75rem', color: '#64748b' }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#0f172a', fontWeight: 600 }}>
                          {item.quantity}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#64748b' }}>
                          {ITEM_SIZES[item.catalogItemCode]?.[item.sizeCode] ||
                            (item.sizeCode === 'OVERSIZE'
                              ? 'Quá khổ / cần kiểm tra'
                              : item.dimensionsCm?.length
                                ? `${item.dimensionsCm.length || 0}x${item.dimensionsCm.width || 0}x${item.dimensionsCm.height || 0}`
                                : 'Chưa rõ')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Action Controls */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {actions.canPay && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate(`/bulky/payment/${order.orderId}`)}
              >
                Thanh toán ngay
              </Button>
            )}
            {actions.canReschedule && !isUnderReview && (
              <Button variant="outlined" onClick={() => setOpenReschedule(true)}>
                Đổi ngày thu gom
              </Button>
            )}
            {actions.canCancel && !isUnderReview && (
              <Button variant="outlined" color="error" onClick={() => setOpenCancel(true)}>
                Hủy đơn
              </Button>
            )}
          </Box>

          {/* Timeline */}
          <OrderTimeline timeline={order.timeline} />
        </Stack>

        <RescheduleDialog
          open={openReschedule}
          onClose={() => setOpenReschedule(false)}
          currentDate={order.confirmedServiceWindow?.date || order.requestedDate}
          onConfirmReschedule={handleConfirmReschedule}
          isLoading={isProcessing}
        />

        <CancelDialog
          open={openCancel}
          onClose={() => setOpenCancel(false)}
          isPaid={isPaid}
          onConfirmCancel={handleConfirmCancel}
          isLoading={isProcessing}
        />
      </Container>
    </Box>
  );
}

export default BulkyOrderDetailPage;
