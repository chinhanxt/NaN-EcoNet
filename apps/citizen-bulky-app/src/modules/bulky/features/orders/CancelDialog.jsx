import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Alert,
  Stack,
  CircularProgress,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
} from '@mui/material';

export function CancelDialog({
  open,
  onClose,
  isPaid = false,
  onConfirmCancel,
  isLoading = false,
}) {
  const [reason, setReason] = useState('');
  const [cutoffScenario, setCutoffScenario] = useState('PRE_CUTOFF');

  const handleSubmit = async () => {
    if (onConfirmCancel) {
      const finalReason =
        cutoffScenario === 'POST_CUTOFF'
          ? `[POST_CUTOFF] ${reason || 'Người dân yêu cầu hủy đơn sát giờ'}`
          : reason || 'Người dân yêu cầu hủy đơn';
      await onConfirmCancel(finalReason);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Xác nhận hủy yêu cầu thu gom</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            Bạn có chắc chắn muốn hủy đơn thu gom rác cồng kềnh này không?
          </Typography>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
            }}
          >
            <FormLabel
              sx={{
                fontWeight: 600,
                color: '#0f172a',
                fontSize: '0.85rem',
                display: 'block',
                mb: 0.5,
              }}
            >
              Mô phỏng thời điểm hủy (Kiểm thử Cutoff 24h):
            </FormLabel>
            <RadioGroup
              row
              value={cutoffScenario}
              onChange={(e) => setCutoffScenario(e.target.value)}
            >
              <FormControlLabel
                value="PRE_CUTOFF"
                control={<Radio size="small" />}
                label={
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    Trước 24h (Tự duyệt & hoàn tiền)
                  </Typography>
                }
              />
              <FormControlLabel
                value="POST_CUTOFF"
                control={<Radio size="small" />}
                label={
                  <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                    Sát giờ &lt; 24h (Cần duyệt)
                  </Typography>
                }
              />
            </RadioGroup>
          </Box>

          {cutoffScenario === 'POST_CUTOFF' ? (
            <Alert severity="warning">
              <strong>Kịch bản sát giờ hẹn (&lt;24h):</strong> Đơn hàng đã được xếp tải trên xe
              gom. Yêu cầu hủy sẽ chuyển thành <strong>UNDER_REVIEW</strong> gửi về Bàn Điều Phối
              Viên để kiểm duyệt giải phóng vị trí.
            </Alert>
          ) : isPaid ? (
            <Alert severity="info">
              <strong>Kịch bản trước thời hạn cắt (&gt;24h):</strong> Hệ thống tự động hủy đơn ngay
              lập tức, khoản tiền đã thanh toán sẽ được tự động hoàn trả lại cho bạn (100% qua Dev 3 - Billing), đồng thời đẩy sự kiện <strong>CANCEL</strong>{' '}
              sang hàng đợi điều phối (Dev 2 - Dispatch).
            </Alert>
          ) : (
            <Alert severity="info">
              Đơn chưa thanh toán. Khi hủy, vị trí giữ chỗ xe gom và báo giá sẽ được giải phóng mà
              không phát sinh bất kỳ khoản phí nào.
            </Alert>
          )}

          <FormControl fullWidth>
            <FormLabel
              htmlFor="cancel-reason-input"
              sx={{
                fontWeight: 600,
                mb: 1,
                color: 'text.primary',
                fontSize: '0.9rem',
                textAlign: 'left',
                display: 'block',
              }}
            >
              Lý do hủy đơn
            </FormLabel>
            <TextField
              id="cancel-reason-input"
              placeholder="Ví dụ: Đã tự xử lý xong, thay đổi kế hoạch dọn nhà..."
              multiline
              rows={3}
              fullWidth
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              sx={{
                borderRadius: 2,
                backgroundColor: '#ffffff',
                '& .MuiInputBase-input': {
                  color: '#0f172a',
                  fontWeight: 500,
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#cbd5e1',
                },
              }}
            />
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Giữ lại đơn
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleSubmit}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Xác nhận hủy đơn
        </Button>
      </DialogActions>
    </Dialog>
  );
}
