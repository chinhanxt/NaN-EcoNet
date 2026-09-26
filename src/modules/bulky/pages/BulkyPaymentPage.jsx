import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Stack,
  Divider,
  Button,
} from '@mui/material';
import { PaymentSimulator } from '../features/payment/PaymentSimulator.jsx';
import { LatePaymentReconciliation } from '../features/payment/LatePaymentReconciliation.jsx';
import { selectBulkyOrderById, selectCanManageBulky } from '../store/selectors.js';
import { ORDER_STATUS, PAYMENT_STATUS } from '../domain/constants.js';

export function BulkyPaymentPage({ thunks, onPaymentSuccess }) {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const canManage = useSelector(selectCanManageBulky);
  const order = useSelector((state) => selectBulkyOrderById(state, orderId));
  const paymentsById = useSelector((state) => state.bulky?.paymentsById || {});
  const quotesById = useSelector((state) => state.bulky?.quotesById || {});

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const formatVnd = (val) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const existingAttempt = Object.values(paymentsById).find((p) => p.orderId === orderId);
  const paymentAttemptId = existingAttempt?.paymentAttemptId || `pay-${orderId}`;
  const amountVnd = order?.acceptedQuote?.totalVnd || existingAttempt?.amountVnd || 0;
  const targetQuote =
    order?.acceptedQuote || (order?.activeQuoteId ? quotesById[order.activeQuoteId] : null);
  const depositHoldVnd =
    targetQuote?.estimatedRange?.depositHoldVnd ||
    targetQuote?.estimatedRange?.minVnd ||
    targetQuote?.totalVnd ||
    amountVnd;

  useEffect(() => {
    const ensurePaymentAttempt = async () => {
      const existing = Object.values(paymentsById).find((p) => p.orderId === orderId);
      const targetQuoteId = order?.activeQuoteId || order?.acceptedQuote?.quoteId;
      if (!existing && targetQuoteId && thunks?.startOrderPayment && dispatch) {
        try {
          await dispatch(thunks.startOrderPayment({ orderId, quoteId: targetQuoteId }));
        } catch (err) {
          console.warn('Unable to auto-start payment attempt:', err);
        }
      }
    };
    ensurePaymentAttempt();
  }, [
    orderId,
    order?.activeQuoteId,
    order?.acceptedQuote?.quoteId,
    paymentsById,
    thunks,
    dispatch,
  ]);

  const handleSimulate = async (result) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      let targetAttemptId = existingAttempt?.paymentAttemptId;
      if (!targetAttemptId) {
        const targetQuoteId = order?.activeQuoteId || order?.acceptedQuote?.quoteId;
        if (targetQuoteId && thunks?.startOrderPayment && dispatch) {
          try {
            const newAttempt = await dispatch(
              thunks.startOrderPayment({ orderId, quoteId: targetQuoteId }),
            );
            targetAttemptId = newAttempt?.paymentAttemptId;
          } catch (e) {
            console.warn('Could not auto-start payment attempt on simulate:', e);
          }
        }
      }
      if (!targetAttemptId) {
        targetAttemptId = paymentAttemptId;
      }

      if (thunks?.simulatePaymentResult && dispatch) {
        const res = await dispatch(
          thunks.simulatePaymentResult({
            paymentAttemptId: targetAttemptId,
            result,
          }),
        );
        if (res?.payment?.status === PAYMENT_STATUS.FAILED) {
          setErrorMessage(
            'Mô phỏng: Giao dịch thanh toán thất bại (Ví dụ: Thẻ hết hạn, không đủ số dư hoặc người dùng hủy giao dịch). Bạn có thể bấm thử lại.',
          );
        } else if (res?.order?.orderStatus === ORDER_STATUS.CONFIRMED && onPaymentSuccess) {
          onPaymentSuccess(res.order);
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Mô phỏng thanh toán thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptAlternative = async (date) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (thunks?.acceptLatePaymentAlternative && dispatch) {
        await dispatch(thunks.acceptLatePaymentAlternative({ orderId, selectedDate: date }));
      }
    } catch (err) {
      setErrorMessage(err.message || 'Không thể chọn ngày thay thế');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChooseRefund = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (thunks?.chooseLatePaymentRefund && dispatch) {
        await dispatch(thunks.chooseLatePaymentRefund({ orderId }));
      }
    } catch (err) {
      setErrorMessage(err.message || 'Không thể yêu cầu hoàn tiền');
    } finally {
      setIsLoading(false);
    }
  };

  if (!canManage) {
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
            Bạn không có quyền quản lý thanh toán đơn này (Yêu cầu quyền MANAGE_BULKY_ORDERS).
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
          <Alert severity="info">Không tìm thấy đơn hàng cần thanh toán.</Alert>
        </Container>
      </Box>
    );
  }

  const isConfirmed =
    order.orderStatus === ORDER_STATUS.CONFIRMED && order.paymentStatus === PAYMENT_STATUS.SUCCESS;
  const isCancelled = order.orderStatus === ORDER_STATUS.CANCELLED;

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

        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            fontWeight="bold"
            sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}
          >
            Thanh Toán Dịch Vụ Thu Gom
          </Typography>
          <Typography variant="body1" sx={{ color: '#64748b' }}>
            Mã đơn: <strong style={{ color: '#0f172a' }}>{order.orderId}</strong> • Địa chỉ thu gom:{' '}
            {order.serviceLocation?.address}
          </Typography>
        </Box>

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {errorMessage}
          </Alert>
        )}

        {isCancelled ? (
          <Card
            variant="outlined"
            sx={{
              p: 3,
              textAlign: 'center',
              borderColor: '#f59e0b',
              backgroundColor: '#ffffff',
              borderRadius: 2.5,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <CardContent>
              <Typography variant="h5" color="warning.main" fontWeight="bold" gutterBottom>
                Đã Hủy Đơn & Yêu Cầu Hoàn Tiền Thành Công!
              </Typography>
              <Typography variant="body1" sx={{ mb: 2, color: '#475569' }}>
                Yêu cầu hoàn tiền toàn phần cho đơn thu gom rác cồng kềnh đã được hệ thống tiếp
                nhận.
              </Typography>
              <Alert severity="info" sx={{ my: 2, textAlign: 'left' }}>
                Khoản thanh toán <strong>{formatVnd(amountVnd)}</strong> sẽ được hoàn trả về tài
                khoản / ví điện tử của bạn.
              </Alert>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/bulky/orders')}
                sx={{ mt: 2 }}
              >
                Xem Danh Sách Đơn Của Tôi
              </Button>
            </CardContent>
          </Card>
        ) : isConfirmed ? (
          <Card
            variant="outlined"
            sx={{
              p: 3,
              textAlign: 'center',
              borderColor: '#22c55e',
              backgroundColor: '#ffffff',
              borderRadius: 2.5,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <CardContent>
              <Typography variant="h5" color="success.main" fontWeight="bold" gutterBottom>
                Xác Nhận & Thanh Toán Thành Công!
              </Typography>
              <Typography variant="body1" sx={{ mb: 2, color: '#475569' }}>
                Đơn thu gom rác cồng kềnh đã được hệ thống xác nhận và lên lịch xe điều động (Phiên
                bản: v{order.confirmationVersion || 1}).
              </Typography>
              <Alert severity="success" sx={{ my: 2, textAlign: 'left' }}>
                <strong>Ngày thu gom dự kiến:</strong>{' '}
                {order.confirmedServiceWindow?.date || order.requestedDate}
                <br />
                <strong>Mã giao dịch thanh toán:</strong>{' '}
                {order.acceptedPayment?.transactionReference || 'TXN-SUCCESS'}
              </Alert>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/bulky/orders')}
                sx={{ mt: 2 }}
              >
                Xem Danh Sách Đơn Của Tôi
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={3}>
            <Card
              variant="outlined"
              sx={{
                p: 2,
                backgroundColor: '#ffffff',
                borderColor: '#e2e8f0',
                borderRadius: 2.5,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <CardContent>
                <Typography variant="h6" fontWeight="bold" sx={{ color: '#0f172a' }} gutterBottom>
                  Tóm Tắt Khoản Phí Cần Thanh Toán
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 1,
                  }}
                >
                  <Typography variant="body1" sx={{ color: '#475569' }}>
                    Phí thu gom & vận chuyển rác cồng kềnh:
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" sx={{ color: '#1d4ed8' }}>
                    {formatVnd(amountVnd)}
                  </Typography>
                </Box>
                {['ITEM_SIZE', 'MANUAL'].includes(targetQuote?.pricingBasis) && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Thanh toán toàn bộ phí theo báo giá đã xác nhận. {targetQuote.priceChangeNotice}
                  </Alert>
                )}
                {!['ITEM_SIZE', 'MANUAL'].includes(targetQuote?.pricingBasis) &&
                  (targetQuote?.estimatedRange || order?.acceptedQuote?.estimatedRange) && (
                    <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                      Bạn đang thanh toán số tiền tạm giữ chỗ{' '}
                      <strong>{formatVnd(depositHoldVnd)}</strong>. Quyết toán thực tế dựa trên
                      nghiệm thu khi bàn giao (dung sai ±15% không phụ thu).
                    </Alert>
                  )}
              </CardContent>
            </Card>

            {order.latePaymentResolution ? (
              <LatePaymentReconciliation
                resolution={order.latePaymentResolution}
                onAcceptAlternative={handleAcceptAlternative}
                onChooseRefund={handleChooseRefund}
                isLoading={isLoading}
              />
            ) : (
              <PaymentSimulator onSimulate={handleSimulate} isLoading={isLoading} />
            )}
          </Stack>
        )}
      </Container>
    </Box>
  );
}

export default BulkyPaymentPage;
