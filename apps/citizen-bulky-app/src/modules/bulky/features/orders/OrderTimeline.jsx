import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
} from '@mui/material';

const EVENT_LABELS = {
  DRAFT_CREATED: 'Khởi tạo bản nháp yêu cầu',
  DRAFT_UPDATED: 'Cập nhật bản nháp',
  ITEMS_CONFIRMED: 'Xác nhận danh mục đồ cồng kềnh',
  QUOTE_AND_HOLD_RESERVED: 'Nhận báo giá và giữ chỗ',
  ORDER_CONFIRMED_PAID: 'Thanh toán thành công & Lên lịch xe gom',
  ORDER_CANCELLED: 'Đã hủy đơn thu gom',
  ORDER_RESCHEDULED: 'Đã đổi ngày thu gom thành công',
  RESCHEDULE_REQUESTED: 'Đã gửi yêu cầu đổi ngày (Đang duyệt)',
  CANCEL_REQUESTED: 'Đã gửi yêu cầu hủy đơn (Đang duyệt)',
  LATE_PAYMENT_RECEIVED: 'Nhận thanh toán muộn (Cần xác nhận lịch)',
  PAYMENT_FAILED: 'Thanh toán thất bại',
};

export function OrderTimeline({ timeline = [] }) {
  if (!timeline || !timeline.length) return null;

  return (
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
          Lịch Sử Sự Kiện
        </Typography>
        <List dense disablePadding>
          {timeline.map((item, index) => {
            const label = EVENT_LABELS[item.event] || item.event;
            const timeStr = item.occurredAt
              ? new Date(item.occurredAt).toLocaleString('vi-VN')
              : '';
            return (
              <ListItem key={index} alignItems="flex-start" sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                  <Chip size="small" label={index + 1} variant="outlined" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography variant="body2" fontWeight="600" sx={{ color: '#0f172a' }}>
                        {label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        {timeStr}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                      {item.requestedDate && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="primary.main"
                          fontWeight="medium"
                          sx={{ display: 'block' }}
                        >
                          Ngày thu gom mới: {item.requestedDate}
                        </Typography>
                      )}
                      {item.reason && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          Lý do: {item.reason}
                        </Typography>
                      )}
                      {item.transactionReference && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          Mã giao dịch: {item.transactionReference}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
}
