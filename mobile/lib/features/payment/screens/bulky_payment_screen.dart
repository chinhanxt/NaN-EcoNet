import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../core/domain/models/bulky_order.dart';
import '../../../core/theme/bulky_colors.dart';
import '../../orders/providers/orders_provider.dart';
import '../../../core/widgets/bulky_app_bottom_nav_bar.dart';
import '../widgets/countdown_timer_widget.dart';

/// Screen for simulating deposit payment via VietQR / MoMo with countdown timer.
class BulkyPaymentScreen extends StatefulWidget {
  final String? orderId;

  const BulkyPaymentScreen({
    super.key,
    this.orderId,
  });

  @override
  State<BulkyPaymentScreen> createState() => _BulkyPaymentScreenState();
}

class _BulkyPaymentScreenState extends State<BulkyPaymentScreen> {
  int _selectedMethodIndex = 0; // 0: VietQR, 1: MoMo
  bool _isProcessing = false;

  @override
  Widget build(BuildContext context) {
    final effectiveOrderId = widget.orderId ??
        ModalRoute.of(context)?.settings.arguments as String?;

    if (effectiveOrderId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Thanh Toán Tiền Cọc')),
        body: const Center(
          child: Text('Không tìm thấy thông tin đơn hàng.'),
        ),
      );
    }

    final ordersProvider = context.watch<OrdersProvider>();
    final order = ordersProvider.getOrderById(effectiveOrderId);

    if (order == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Thanh Toán Tiền Cọc')),
        body: const Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    final depositVnd = order.quote.depositHoldVnd;

    return Scaffold(
      backgroundColor: BulkyColors.background,
      appBar: AppBar(
        title: const Text(
          'Thanh Toán Tiền Cọc',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        elevation: 0,
        backgroundColor: BulkyColors.surface,
        foregroundColor: BulkyColors.textPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Timer & Expiry Alert Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: BulkyColors.warningBg.withValues(alpha: 0.35),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: BulkyColors.warning.withValues(alpha: 0.4)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Thời gian giữ chỗ còn lại:',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: BulkyColors.textPrimary,
                        ),
                      ),
                      CountdownTimerWidget(
                        initialDuration: const Duration(minutes: 15),
                        onExpired: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Thời gian giữ chỗ xe đã hết hạn! Vui lòng đặt lại.'),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Vui lòng hoàn tất thanh toán cọc trong vòng 15 phút để giữ xe thu gom theo lịch hẹn.',
                    style: TextStyle(
                      fontSize: 12,
                      color: BulkyColors.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Order & Deposit Hold Summary
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: BulkyColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: BulkyColors.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Mã đơn hàng:',
                        style: TextStyle(
                          fontSize: 13,
                          color: BulkyColors.textSecondary,
                        ),
                      ),
                      Text(
                        order.id,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: BulkyColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Divider(height: 1, color: BulkyColors.border),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Tiền cọc cần thanh toán:',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: BulkyColors.textPrimary,
                        ),
                      ),
                      Text(
                        BulkyColors.formatCurrency(depositVnd),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: BulkyColors.primary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Payment Methods Tabs
            Row(
              children: [
                Expanded(
                  child: _buildMethodTab(
                    index: 0,
                    label: 'VietQR (Chuyển khoản)',
                    icon: Icons.qr_code_2_rounded,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildMethodTab(
                    index: 1,
                    label: 'Ví MoMo',
                    icon: Icons.account_balance_wallet_outlined,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // QR Code Simulation Card
            _buildQrSimulationCard(order, depositVnd),
            const SizedBox(height: 24),
          ],
        ),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: BulkyColors.surface,
              border: const Border(
                top: BorderSide(color: BulkyColors.border, width: 1),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -3),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              bottom: false,
              child: Row(
                children: [
                  OutlinedButton.icon(
                    key: const Key('payment_back_button'),
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 15),
                    label: const Text('Quay lại'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: BulkyColors.textPrimary,
                      side: const BorderSide(color: BulkyColors.border),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      key: const Key('confirm_payment_button'),
                      onPressed: _isProcessing
                          ? null
                          : () async {
                              setState(() {
                                _isProcessing = true;
                              });
                              try {
                                await context
                                    .read<OrdersProvider>()
                                    .simulateDepositPayment(order.id);
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Đặt cọc thành công! Đơn hàng đã được xác nhận.',
                                      ),
                                      backgroundColor: BulkyColors.success,
                                    ),
                                  );
                                  Navigator.pushReplacementNamed(
                                    context,
                                    '/order-detail',
                                    arguments: order.id,
                                  );
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Lỗi thanh toán: $e')),
                                  );
                                }
                              } finally {
                                if (mounted) {
                                  setState(() {
                                    _isProcessing = false;
                                  });
                                }
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: BulkyColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        elevation: 2,
                      ),
                      child: _isProcessing
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Xác nhận đã thanh toán cọc',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                SizedBox(width: 6),
                                Text(
                                  '✓',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const BulkyAppBottomNavBar(activeIndex: 1),
        ],
      ),
    );
  }

  Widget _buildMethodTab({
    required int index,
    required String label,
    required IconData icon,
  }) {
    final isSelected = _selectedMethodIndex == index;
    return InkWell(
      onTap: () {
        setState(() {
          _selectedMethodIndex = index;
        });
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: isSelected ? BulkyColors.primary : BulkyColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? BulkyColors.primary : BulkyColors.border,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color: isSelected ? Colors.white : BulkyColors.textPrimary,
            ),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? Colors.white : BulkyColors.textPrimary,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQrSimulationCard(BulkyOrder order, int depositVnd) {
    final isMoMo = _selectedMethodIndex == 1;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BulkyColors.border),
      ),
      child: Column(
        children: [
          // QR Code simulation box
          Container(
            width: 200,
            height: 200,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: BulkyColors.border, width: 2),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Simulated QR Pattern Grid
                Column(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: List.generate(
                    12,
                    (row) => Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: List.generate(
                        12,
                        (col) {
                          final isCorner = (row < 3 && col < 3) ||
                              (row < 3 && col > 8) ||
                              (row > 8 && col < 3);
                          final isDot = (row + col) % 2 == 0 || isCorner;
                          return Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              color: isDot
                                  ? (isCorner
                                      ? (isMoMo ? const Color(0xFFA50064) : BulkyColors.primary)
                                      : Colors.black87)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                  child: Icon(
                    isMoMo ? Icons.account_balance_wallet : Icons.qr_code_rounded,
                    size: 28,
                    color: isMoMo ? const Color(0xFFA50064) : BulkyColors.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            isMoMo ? 'Quét mã bằng Ví MoMo' : 'Quét mã VietQR bằng bất kỳ App Ngân Hàng',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: BulkyColors.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: BulkyColors.border),
          const SizedBox(height: 14),

          // Transfer Instructions
          _buildInfoRow('Ngân hàng:', 'MB Bank (Ngân hàng Quân Đội)'),
          const SizedBox(height: 8),
          _buildInfoRow('Tên thụ hưởng:', 'CÔNG TY CP MÔI TRƯỜNG SMARTBIN'),
          const SizedBox(height: 8),
          _buildInfoRowWithCopy('Số tài khoản:', '999888666'),
          const SizedBox(height: 8),
          _buildInfoRowWithCopy('Nội dung CK:', order.id),
          const SizedBox(height: 8),
          _buildInfoRow('Số tiền:', BulkyColors.formatCurrency(depositVnd)),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: BulkyColors.textSecondary,
          ),
        ),
        Flexible(
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: BulkyColors.textPrimary,
            ),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRowWithCopy(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: BulkyColors.textSecondary,
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: BulkyColors.primary,
              ),
            ),
            const SizedBox(width: 4),
            InkWell(
              onTap: () {
                Clipboard.setData(ClipboardData(text: value));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Đã sao chép: $value'),
                    duration: const Duration(seconds: 1),
                  ),
                );
              },
              child: const Icon(
                Icons.copy_rounded,
                size: 16,
                color: BulkyColors.primaryLight,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
