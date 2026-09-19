import 'package:flutter/material.dart';

class BulkyColors {
  // Eco Emerald / Smartbin Green (Chủ đề Môi trường & Tái chế Rác thải đô thị)
  static const Color primary = Color(0xFF059669); // Emerald 600 - Xanh môi trường chủ đạo
  static const Color primaryLight = Color(0xFF10B981); // Emerald 500 - Xanh tươi sáng
  static const Color primaryDark = Color(0xFF047857); // Emerald 700 - Xanh đậm tương phản cao
  static const Color primaryContainer = Color(0xFFECFDF5); // Emerald 50 - Nền xanh minty nhẹ

  // Nền & Khung thẻ (Sạch sẽ, dịu mát với ánh ngọc sinh thái)
  static const Color background = Color(0xFFF6FBF8); // Off-white ánh xanh lá thanh nhẹ
  static const Color surface = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE2EBE5); // Viền xám ánh xanh lá dịu mắt

  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);

  static const Color success = Color(0xFF16A34A);
  static const Color successBg = Color(0xFFDCFCE7);
  static const Color warning = Color(0xFFD97706);
  static const Color warningBg = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFDC2626);
  static const Color errorBg = Color(0xFFFEE2E2);

  // Phân loại vật phẩm & Bounding Box (Trực quan, mang màu sắc chất liệu nội thất/môi trường)
  static const Color boxSofa = Color(0xFF059669); // Xanh Emerald cho sofa/nệm bọc
  static const Color boxMattress = Color(0xFF0284C7); // Xanh da trời cho đệm lò xo
  static const Color boxCabinet = Color(0xFFB45309); // Nâu gỗ ấm cho tủ/kệ
  static const Color boxTable = Color(0xFFD97706); // Vàng hổ phách cho bàn ăn/bàn đá
  static const Color boxOther = Color(0xFF64748B); // Xám đá cho xà bần/phế thải
  static const Color boxHazardous = Color(0xFFDC2626); // Đỏ cảnh báo cho chất độc hại

  // Phân loại rác sinh thái Eco-Tech (Deepthi N Anekal)
  static const Color wasteOrganic = Color(0xFF16A34A); // Rác hữu cơ sinh hoạt
  static const Color wasteRecyclable = Color(0xFF2563EB); // Rác tái chế (giấy, nhựa, kim loại)
  static const Color wasteBulky = Color(0xFFEA580C); // Rác cồng kềnh đô thị
  static const Color wasteHazardous = Color(0xFFDC2626); // Rác nguy hại & điện tử

  // Gradient viễn thám IoT Telemetry (Nixtio)
  static const LinearGradient iotSafeGradient = LinearGradient(
    colors: [Color(0xFF059669), Color(0xFF10B981)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient iotWarnGradient = LinearGradient(
    colors: [Color(0xFFD97706), Color(0xFFF59E0B)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
  static const LinearGradient iotDangerGradient = LinearGradient(
    colors: [Color(0xFFDC2626), Color(0xFFEF4444)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Soft ambient shadow (LazyInterface)
  static const List<BoxShadow> softShadow = [
    BoxShadow(
      color: Color(0x0A0F172A),
      blurRadius: 16,
      offset: Offset(0, 4),
    ),
  ];

  /// Formats VND amount with dot thousands separator, e.g. 150000 -> "150.000 đ"
  static String formatCurrency(int amount) {
    final isNegative = amount < 0;
    final str = amount.abs().toString();
    final buffer = StringBuffer();
    for (int i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) {
        buffer.write('.');
      }
      buffer.write(str[i]);
    }
    return '${isNegative ? '-' : ''}${buffer.toString()} đ';
  }
}
