import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Typography, Container, Alert, Button } from '@mui/material';
import { BulkyRequestWizard } from '../features/request/BulkyRequestWizard.jsx';
import { selectBulkyDraft, selectCanManageBulky } from '../store/selectors.js';
import { analyzeBulkyWasteWithGemini } from '../services/ai/geminiVisionService.js';

export function BulkyBookingPage({
  serviceLocations = [
    {
      id: 'loc-1',
      address: '123 Nguyen Trai, Phuong 3, Quan 5, TP.HCM',
      latitude: 10.756,
      longitude: 106.678,
      serviceArea: { code: 'D5' },
    },
  ],
  thunks,
  services,
  onBookingCreated,
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const canManage = useSelector(selectCanManageBulky);
  const currentDraft = useSelector(selectBulkyDraft);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [submitError, setSubmitError] = useState(null);
  const [priceBook, setPriceBook] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    if (services?.catalog?.getPriceBook) {
      services.catalog
        .getPriceBook()
        .then((book) => {
          if (!cancelled) setPriceBook(book);
        })
        .catch(() => {
          if (!cancelled)
            setSubmitError(
              'Không thể tải bảng giá. Báo giá chính thức sẽ được kiểm tra ở bước giữ chỗ.',
            );
        });
    }
    return () => {
      cancelled = true;
    };
  }, [services]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAnalyzeImages = async (input) => {
    if (services?.recognition?.analyzeImages) {
      return services.recognition.analyzeImages(input);
    }
    return analyzeBulkyWasteWithGemini(input);
  };

  const handleSubmit = async (formData) => {
    setSubmitError(null);
    try {
      let createdOrder;
      if (thunks?.createDraftOrder && dispatch) {
        createdOrder = await dispatch(
          thunks.createDraftOrder({
            serviceLocationId: formData.serviceLocationId,
            requestedDate: formData.requestedDate,
            imageMetadata: formData.imageMetadata,
            recognitionResult: formData.recognitionResult,
            handlingConditions: formData.handlingConditions,
          }),
        );
        if (createdOrder?.orderId && thunks?.confirmOrderItems) {
          createdOrder = await dispatch(
            thunks.confirmOrderItems(createdOrder.orderId, {
              confirmedItems: formData.confirmedItems,
              handlingConditions: formData.handlingConditions,
            }),
          );
        }
      }

      if (onBookingCreated) {
        onBookingCreated(createdOrder || formData);
      } else if (createdOrder?.orderId) {
        navigate(
          createdOrder.orderStatus === 'MANUAL_REVIEW'
            ? `/bulky/orders/${createdOrder.orderId}`
            : `/bulky/quote/${createdOrder.orderId}`,
        );
      }
    } catch (err) {
      setSubmitError(err.message || 'Không thể tạo đơn đặt thu gom');
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
            Bạn không có quyền quản lý đơn đặt thu gom rác cồng kềnh (Yêu cầu quyền
            MANAGE_BULKY_ORDERS).
          </Alert>
        </Container>
      </Box>
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.8,
              px: 1.5,
              py: 0.6,
              borderRadius: 2,
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            Dịch Vụ Thu Gom Đô Thị
          </Box>
        </Box>

        {/* Page Title */}
        <Box sx={{ mb: 3.5, textAlign: 'center' }}>
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            sx={{ color: '#0f172a', letterSpacing: '-0.02em', mb: 0.8 }}
          >
            Đặt Lịch Thu Gom Rác Cồng Kềnh
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 500, mx: 'auto' }}>
            Quy trình 3 bước nhanh chóng • Báo giá minh bạch • Thu gom tận nơi
          </Typography>
        </Box>

        {submitError && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {submitError}
          </Alert>
        )}

        <BulkyRequestWizard
          serviceLocations={serviceLocations}
          priceBook={priceBook}
          initialDraft={currentDraft}
          onAnalyzeImages={handleAnalyzeImages}
          onSubmit={handleSubmit}
          isOffline={isOffline}
        />
      </Container>
    </Box>
  );
}

export default BulkyBookingPage;
