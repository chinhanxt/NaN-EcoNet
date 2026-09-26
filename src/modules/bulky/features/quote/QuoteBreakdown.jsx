import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Stack,
  Divider,
} from '@mui/material';

export function QuoteBreakdown({ quote, hold, now }) {
  const [currentTime] = useState(() => (now ? new Date(now).getTime() : Date.now()));

  if (!quote) return null;

  const formatVnd = (val) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const isExpired =
    hold?.status === 'EXPIRED' ||
    (quote.expiresAt && currentTime >= new Date(quote.expiresAt).getTime());

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
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ color: '#0f172a' }}>
              Chi Tiết Báo Giá & Giữ Chỗ
            </Typography>
            <Chip
              label={isExpired ? 'Hết hạn' : 'Đang giữ chỗ'}
              color={isExpired ? 'error' : 'success'}
              size="small"
            />
          </Box>

          {isExpired && (
            <Alert severity="error">
              Báo giá hoặc vị trí giữ chỗ đã hết hạn. Vui lòng tạo lại báo giá mới để cập nhật mức
              giá và tải phục vụ hiện tại.
            </Alert>
          )}

          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ color: '#475569', fontWeight: 600 }}>Hạng mục</TableCell>
                <TableCell align="right" sx={{ color: '#475569', fontWeight: 600 }}>
                  Số lượng
                </TableCell>
                <TableCell align="right" sx={{ color: '#475569', fontWeight: 600 }}>
                  Thành tiền
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(quote.lineItems || []).map((item, idx) => (
                <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}>
                  <TableCell sx={{ color: '#0f172a', fontWeight: 500 }}>
                    {item.label || item.code}
                  </TableCell>
                  <TableCell align="right" sx={{ color: '#0f172a', fontWeight: 600 }}>
                    {item.quantity}
                  </TableCell>
                  <TableCell align="right" sx={{ color: '#0f172a', fontWeight: 600 }}>
                    {formatVnd(item.amountVnd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Divider />

          {['ITEM_SIZE', 'MANUAL'].includes(quote?.pricingBasis) && (
            <Alert severity="info">
              Thanh toán toàn bộ phí theo thông tin đã xác nhận. {quote.priceChangeNotice}
              {quote.isDemo && ' Bảng giá minh họa, chưa phải biểu phí chính thức.'}
            </Alert>
          )}

          <Stack spacing={1} sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Tạm tính:
              </Typography>
              <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 500 }}>
                {formatVnd(quote.subtotalVnd)}
              </Typography>
            </Box>
            {Boolean(quote.discountVnd) && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="success.main">
                  Giảm giá:
                </Typography>
                <Typography variant="body2" color="success.main" fontWeight={600}>
                  -{formatVnd(quote.discountVnd)}
                </Typography>
              </Box>
            )}
            {Boolean(quote.taxVnd) && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Thuế (VAT):
                </Typography>
                <Typography variant="body2" sx={{ color: '#0f172a' }}>
                  {formatVnd(quote.taxVnd)}
                </Typography>
              </Box>
            )}
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1 }}
            >
              <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#0f172a' }}>
                Tổng cộng:
              </Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ color: '#1d4ed8' }}>
                {formatVnd(quote.totalVnd)}
              </Typography>
            </Box>
          </Stack>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Phạm vi dịch vụ:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {(quote.scope || []).map((s, i) => (
                <Chip key={i} label={s} size="small" variant="outlined" />
              ))}
            </Stack>
          </Box>

          {quote.exclusions?.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Không bao gồm:
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                {quote.exclusions.map((e, i) => (
                  <Chip key={i} label={e} size="small" color="default" />
                ))}
              </Stack>
            </Box>
          )}

          <Typography variant="caption" color="text.secondary">
            Bảng giá: {quote.priceBookVersion} • Chính sách hủy/đổi:{' '}
            {quote.cancellationPolicyVersion}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
