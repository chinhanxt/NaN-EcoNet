import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Alert,
  Stack,
  LinearProgress,
} from '@mui/material';
import { REFUND_STATUS } from '../../domain/constants.js';

export function RefundTracker({ refund, refundStatus }) {
  const status = refund?.status || refundStatus || REFUND_STATUS.NONE;
  if (status === REFUND_STATUS.NONE) return null;

  const formatVnd = (val) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const getStatusLabel = () => {
    switch (status) {
      case REFUND_STATUS.REQUESTED:
        return 'Đã gửi yêu cầu hoàn tiền';
      case REFUND_STATUS.PROCESSING:
        return 'Đang xử lý hoàn tiền';
      case REFUND_STATUS.COMPLETED:
        return 'Hoàn tiền thành công';
      case REFUND_STATUS.FAILED:
        return 'Hoàn tiền thất bại';
      default:
        return status;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case REFUND_STATUS.COMPLETED:
        return 'success';
      case REFUND_STATUS.FAILED:
        return 'error';
      case REFUND_STATUS.PROCESSING:
      case REFUND_STATUS.REQUESTED:
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        backgroundColor: '#ffffff',
        borderColor: '#38bdf8',
        borderRadius: 2.5,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ color: '#0f172a' }}>
              Tiến Trình Hoàn Tiền
            </Typography>
            <Chip label={getStatusLabel()} color={getStatusColor()} size="small" sx={{ fontWeight: 600 }} />
          </Box>

          {(status === REFUND_STATUS.REQUESTED || status === REFUND_STATUS.PROCESSING) && (
            <LinearProgress color="warning" />
          )}

          <Alert severity={status === REFUND_STATUS.FAILED ? 'error' : 'info'}>
            Số tiền hoàn dự kiến: <strong>{formatVnd(refund?.amountVnd)}</strong>.
            {status === REFUND_STATUS.REQUESTED &&
              ' Hệ thống đã tiếp nhận yêu cầu và sẽ hoàn tiền về phương thức thanh toán ban đầu của bạn trong 1–3 ngày làm việc.'}
            {status === REFUND_STATUS.COMPLETED &&
              ' Tiền đã được hoàn trả thành công về tài khoản/ví của bạn.'}
            {status === REFUND_STATUS.FAILED &&
              ' Quá trình hoàn tiền tự động gặp lỗi. Vui lòng liên hệ ban quản lý thu gom để nhận hỗ trợ xử lý thủ công.'}
          </Alert>
        </Stack>
      </CardContent>
    </Card>
  );
}
