import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Container,
  Box,
  Typography,
  Button,
  Alert,
  Stack,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Divider,
} from '@mui/material';
import { QuoteBreakdown } from '../features/quote/QuoteBreakdown.jsx';
import { CapacitySelector } from '../features/quote/CapacitySelector.jsx';
import { selectBulkyOrderById, selectCanManageBulky } from '../store/selectors.js';

export function BulkyQuotePage({ thunks, onProceedToPayment }) {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const canManage = useSelector(selectCanManageBulky);
  const order = useSelector((state) => selectBulkyOrderById(state, orderId));
  const quotesById = useSelector((state) => state.bulky?.quotesById || {});
  const holdsById = useSelector((state) => state.bulky?.holdsById || {});

  const [currentTime] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeQuote = order?.activeQuoteId ? quotesById[order.activeQuoteId] : null;
  const activeHold = order?.activeHoldId ? holdsById[order.activeHoldId] : null;

  const formatVnd = (val) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const estimatedRange = ['ITEM_SIZE', 'MANUAL'].includes(activeQuote?.pricingBasis)
    ? null
    : activeQuote?.estimatedRange ||
      (activeQuote?.totalVnd
        ? {
            minVnd: activeQuote.totalVnd,
            maxVnd: Math.round(activeQuote.totalVnd * 1.3),
            depositHoldVnd: activeQuote.totalVnd,
          }
        : null);

  const tolerancePolicy = activeQuote?.tolerancePolicy || {
    allowedPercent: 15,
    message:
      'Miễn phí phụ thu nếu khối lượng hoặc kích thước thực tế sai lệch không quá ±15% so với khai báo.',
  };

  const isExpired =
    activeHold?.status === 'EXPIRED' ||
    (activeQuote?.expiresAt && currentTime >= new Date(activeQuote.expiresAt).getTime());

  const handleRequestQuote = async (targetDate) => {
    if (!orderId || !thunks?.reserveQuoteAndHold) return;
    setIsLoading(true);
    setError(null);
    try {
      await dispatch(
        thunks.reserveQuoteAndHold({
          orderId,
          requestedDate: targetDate || order.requestedDate,
        }),
      );
    } catch (err) {
      setError(err.message || 'Không thể tạo báo giá và vị trí giữ chỗ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceed = async () => {
    if (thunks?.startOrderPayment && activeQuote?.quoteId) {
      try {
        await dispatch(thunks.startOrderPayment({ orderId, quoteId: activeQuote.quoteId }));
      } catch (err) {
        console.warn('Could not start payment attempt on proceed:', err);
      }
    }
    if (onProceedToPayment) {
      onProceedToPayment({ orderId, quote: activeQuote, hold: activeHold });
    } else {
      navigate(`/bulky/payment/${orderId}`);
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
            Bạn không có quyền quản lý đơn đặt thu gom này (Yêu cầu quyền MANAGE_BULKY_ORDERS).
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
          <Alert severity="info">Không tìm thấy thông tin đơn thu gom rác cồng kềnh.</Alert>
        </Container>
      </Box>
    );
  }

  if (order.orderStatus === 'MANUAL_REVIEW') {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="info">
          Đơn đang chờ nhân viên kiểm tra và báo giá. Chưa thu tiền hoặc xác nhận lịch thu gom.
        </Alert>
        <Button onClick={() => navigate(`/bulky/orders/${orderId}`)}>Xem yêu cầu</Button>
      </Container>
    );
  }

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
            Báo Giá & Giữ Chỗ Thu Gom
          </Typography>
          <Typography variant="body1" sx={{ color: '#64748b' }}>
            Mã đơn: <strong style={{ color: '#0f172a' }}>{order.orderId}</strong> • Địa chỉ:{' '}
            {order.serviceLocation?.address}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Stack spacing={3}>
          <CapacitySelector
            selectedDate={order.requestedDate}
            onSelectDate={(newDate) => handleRequestQuote(newDate)}
          />

          {activeQuote ? (
            <>
              {estimatedRange && (
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
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Stack spacing={2}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: '#f0f9ff',
                          border: '1px solid #bae6fd',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1,
                          }}
                        >
                          <Box>
                            <Typography
                              variant="subtitle2"
                              sx={{ color: '#0369a1', fontWeight: 700 }}
                            >
                              📊 Khoảng giá dự toán:
                            </Typography>
                            <Typography
                              variant="h6"
                              sx={{ color: '#0284c7', fontWeight: 800, mt: 0.5 }}
                            >
                              {formatVnd(estimatedRange?.minVnd)} –{' '}
                              {formatVnd(estimatedRange?.maxVnd)}
                            </Typography>
                          </Box>
                          <Chip
                            label={`Cam kết ±${tolerancePolicy.allowedPercent}%`}
                            color="primary"
                            sx={{ fontWeight: 700, backgroundColor: '#0284c7' }}
                          />
                        </Box>
                        <Divider sx={{ my: 1.5, borderColor: '#bae6fd' }} />
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1,
                          }}
                        >
                          <Box>
                            <Typography
                              variant="subtitle1"
                              sx={{ color: '#0f172a', fontWeight: 700 }}
                            >
                              💳 Số tiền tạm giữ chỗ:
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              (Thanh toán trước để điều phối xe, quyết toán theo nghiệm thu thực tế
                              khi bàn giao)
                            </Typography>
                          </Box>
                          <Typography variant="h5" sx={{ color: '#16a34a', fontWeight: 800 }}>
                            {formatVnd(estimatedRange?.depositHoldVnd)}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Tolerance Policy Banner */}
                      <Alert
                        severity="success"
                        sx={{
                          borderRadius: 2,
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          '& .MuiAlert-icon': { color: '#16a34a' },
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#166534' }}>
                          🛡️ Chính sách nghiệm thu dung sai ±{tolerancePolicy.allowedPercent}%:
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#15803d', mt: 0.5 }}>
                          {tolerancePolicy.message}
                        </Typography>
                      </Alert>
                    </Stack>
                  </CardContent>
                </Card>
              )}

              <QuoteBreakdown quote={activeQuote} hold={activeHold} />
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => handleRequestQuote()}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {isLoading ? 'Đang kiểm tra & tạo báo giá...' : 'Lấy báo giá & Giữ chỗ'}
              </Button>
            </Box>
          )}

          {activeQuote && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/bulky/booking')}>
                Chỉnh sửa thông tin
              </Button>
              <Button variant="contained" size="large" disabled={isExpired} onClick={handleProceed}>
                Tiến hành thanh toán
              </Button>
            </Box>
          )}
        </Stack>
      </Container>
    </Box>
  );
}

export default BulkyQuotePage;
