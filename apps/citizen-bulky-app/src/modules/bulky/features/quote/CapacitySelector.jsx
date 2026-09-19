import { Box, Typography, Card, CardContent, Chip, Button, Stack, Alert } from '@mui/material';

const VEHICLE_CLASS_LABELS = {
  TRUCK_SMALL: 'Xe tải nhỏ (1.5 tấn)',
  TRUCK_MEDIUM: 'Xe tải trung (3.5 tấn)',
  TRUCK_LARGE: 'Xe chuyên dụng lớn (5 tấn)',
  STANDARD_VAN: 'Xe van tiêu chuẩn',
  HEAVY_TRUCK: 'Xe tải nặng chuyên dụng',
};

export function CapacitySelector({
  capacity = { decision: 'AVAILABLE', offeredDates: [] },
  selectedDate,
  onSelectDate,
}) {
  const isAvailable = capacity.decision === 'AVAILABLE';
  const hasAlternatives = capacity.decision === 'ALTERNATIVE_DATES';
  const isUnavailable = capacity.decision === 'UNAVAILABLE';

  return (
    <Card
      variant="outlined"
      sx={{
        p: 2,
        mb: 3,
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderRadius: 2.5,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight="bold" sx={{ color: '#0f172a' }}>
            Tình Trạng Sức Chứa Xe Gom Rác
          </Typography>

          {isAvailable && (
            <Alert severity="success">
              Ngày <strong>{selectedDate}</strong> có xe gom rác chuyên dụng sẵn sàng phục vụ.
            </Alert>
          )}

          {hasAlternatives && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Ngày <strong>{selectedDate}</strong> hiện đã đầy tải. Vui lòng chọn một trong các
                ngày đề xuất thay thế:
              </Alert>
              <Stack direction="row" spacing={1}>
                {(capacity.offeredDates || []).map((date) => (
                  <Button
                    key={date}
                    variant={selectedDate === date ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => onSelectDate && onSelectDate(date)}
                  >
                    {date}
                  </Button>
                ))}
              </Stack>
            </Box>
          )}

          {isUnavailable && (
            <Alert severity="error">
              Khu vực hoặc thời gian này tạm thời chưa có tuyến xe rác cồng kềnh. Vui lòng liên hệ
              tổng đài để được hỗ trợ.
            </Alert>
          )}

          {capacity.vehicleClass && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Loại xe điều động:
              </Typography>
              <Chip
                label={VEHICLE_CLASS_LABELS[capacity.vehicleClass] || capacity.vehicleClass}
                size="small"
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                Đội ngũ:
              </Typography>
              <Chip label={`${capacity.crewSize || 2} nhân viên`} size="small" variant="outlined" />
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
