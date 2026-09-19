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

export function RescheduleDialog({
  open,
  onClose,
  currentDate,
  onConfirmReschedule,
  isLoading = false,
}) {
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [cutoffScenario, setCutoffScenario] = useState('PRE_CUTOFF');
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!newDate) {
      setError('Vui lòng chọn ngày thu gom mới');
      return;
    }
    setError(null);
    if (onConfirmReschedule) {
      const finalReason =
        cutoffScenario === 'POST_CUTOFF'
          ? `[POST_CUTOFF] ${reason || 'Người dân đổi ngày sát giờ gom'}`
          : reason;
      await onConfirmReschedule({ requestedDate: newDate, reason: finalReason });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Đổi Ngày Thu Gom Rác Cồng Kềnh</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2">
            Ngày thu gom hiện tại: <strong>{currentDate}</strong>
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
              Mô phỏng thời điểm yêu cầu (Kiểm thử Cutoff 24h):
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
                    Trước 24h (Tự duyệt ngay)
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
              <strong>Kịch bản sát giờ hẹn (&lt;24h):</strong> Yêu cầu sẽ được chuyển sang trạng
              thái <strong>UNDER_REVIEW</strong> gửi về Bàn Điều Phối Viên để kiểm tra tải xe và lịch
              trình trước khi quyết định duyệt hay từ chối.
            </Alert>
          ) : (
            <Alert severity="info">
              <strong>Kịch bản trước thời hạn cắt (&gt;24h):</strong> Hệ thống tự động duyệt, cập nhật
              ngày hẹn mới và đẩy sự kiện điều vận <strong>UPSERT</strong> vào <code>dispatchOutbox</code>{' '}
              cho phân hệ Điều phối (Dev 2).
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          <FormControl fullWidth>
            <FormLabel
              htmlFor="reschedule-date-input"
              sx={{
                fontWeight: 600,
                mb: 1,
                color: 'text.primary',
                fontSize: '0.9rem',
                textAlign: 'left',
                display: 'block',
              }}
            >
              Ngày mong muốn mới *
            </FormLabel>
            <TextField
              id="reschedule-date-input"
              type="date"
              fullWidth
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              sx={{
                borderRadius: 2,
                backgroundColor: '#ffffff',
                '& .MuiInputBase-input': {
                  py: 1.5,
                  px: 2,
                  color: '#0f172a',
                  fontWeight: 500,
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#cbd5e1',
                },
              }}
            />
          </FormControl>

          <FormControl fullWidth>
            <FormLabel
              htmlFor="reschedule-reason-input"
              sx={{
                fontWeight: 600,
                mb: 1,
                color: 'text.primary',
                fontSize: '0.9rem',
                textAlign: 'left',
                display: 'block',
              }}
            >
              Lý do thay đổi (không bắt buộc)
            </FormLabel>
            <TextField
              id="reschedule-reason-input"
              multiline
              rows={2}
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
          Hủy bỏ
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isLoading || !newDate}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Xác nhận đổi ngày
        </Button>
      </DialogActions>
    </Dialog>
  );
}
