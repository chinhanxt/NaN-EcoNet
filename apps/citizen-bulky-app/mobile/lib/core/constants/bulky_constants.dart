// ignore_for_file: constant_identifier_names

library;

/// Constants and definitions for the Bulky Waste service.

enum BulkyCategory {
  SOFA,
  MATTRESS,
  CABINET,
  TABLE,
  OTHER;

  String get displayName {
    switch (this) {
      case BulkyCategory.SOFA:
        return 'Sofa / Ghế bành';
      case BulkyCategory.MATTRESS:
        return 'Đệm / Nệm';
      case BulkyCategory.CABINET:
        return 'Tủ / Kệ';
      case BulkyCategory.TABLE:
        return 'Bàn / Bàn ghế';
      case BulkyCategory.OTHER:
        return 'Khác / Phế thải';
    }
  }

  int get defaultPrice => BASE_PRICES[this] ?? 60000;
  int get defaultWeight => BASE_WEIGHTS[this] ?? 15;
}

typedef BulkyItemCategory = BulkyCategory;

enum MaterialType {
  LIGHT,
  STANDARD,
  HEAVY;

  String get label {
    switch (this) {
      case MaterialType.LIGHT:
        return 'Nhựa / Ván ép / Mút nhẹ';
      case MaterialType.STANDARD:
        return 'Gỗ MDF / Tiêu chuẩn';
      case MaterialType.HEAVY:
        return 'Gỗ đặc / Mặt đá / Gạch ngói';
    }
  }

  String get shortLabel {
    switch (this) {
      case MaterialType.LIGHT:
        return 'Nhựa / Mút';
      case MaterialType.STANDARD:
        return 'MDF / Tiêu chuẩn';
      case MaterialType.HEAVY:
        return 'Gỗ đặc / Đá';
    }
  }

  String get emoji {
    switch (this) {
      case MaterialType.LIGHT:
        return '🪶';
      case MaterialType.STANDARD:
        return '🪵';
      case MaterialType.HEAVY:
        return '🪨';
    }
  }

  double get priceFactor => MATERIAL_FACTORS[this]?.priceFactor ?? 1.0;
  double get weightFactor => MATERIAL_FACTORS[this]?.weightFactor ?? 1.0;
}

class MaterialFactor {
  final MaterialType type;
  final String label;
  final String shortLabel;
  final String emoji;
  final double priceFactor;
  final double weightFactor;
  final String description;

  const MaterialFactor({
    required this.type,
    required this.label,
    required this.shortLabel,
    required this.emoji,
    required this.priceFactor,
    required this.weightFactor,
    this.description = '',
  });
}

const Map<BulkyCategory, int> BASE_PRICES = {
  BulkyCategory.SOFA: 150000,
  BulkyCategory.MATTRESS: 100000,
  BulkyCategory.CABINET: 120000,
  BulkyCategory.TABLE: 80000,
  BulkyCategory.OTHER: 60000,
};

const Map<BulkyCategory, int> BASE_WEIGHTS = {
  BulkyCategory.SOFA: 45,
  BulkyCategory.MATTRESS: 30,
  BulkyCategory.CABINET: 40,
  BulkyCategory.TABLE: 20,
  BulkyCategory.OTHER: 15,
};

const Map<MaterialType, MaterialFactor> MATERIAL_FACTORS = {
  MaterialType.LIGHT: MaterialFactor(
    type: MaterialType.LIGHT,
    label: 'Nhựa / Ván ép / Mút nhẹ',
    shortLabel: 'Nhựa / Mút',
    emoji: '🪶',
    priceFactor: 0.8,
    weightFactor: 0.7,
    description: 'Bàn nhựa, mút xốp nhẹ, ván ép mỏng, nhôm gấp',
  ),
  MaterialType.STANDARD: MaterialFactor(
    type: MaterialType.STANDARD,
    label: 'Gỗ MDF / Tiêu chuẩn',
    shortLabel: 'MDF / Tiêu chuẩn',
    emoji: '🪵',
    priceFactor: 1.0,
    weightFactor: 1.0,
    description: 'Đệm thông dụng, gỗ ép công nghiệp, kệ sắt rỗng',
  ),
  MaterialType.HEAVY: MaterialFactor(
    type: MaterialType.HEAVY,
    label: 'Gỗ đặc / Mặt đá / Gạch ngói',
    shortLabel: 'Gỗ đặc / Đá',
    emoji: '🪨',
    priceFactor: 1.3,
    weightFactor: 1.4,
    description: 'Bàn mặt đá, gỗ lim tự nhiên đặc, gạch vỡ, bê tông xà bần',
  ),
};

// Handling and Logistics Fees
const int DISASSEMBLY_FEE = 30000;
const int FLOOR_FEE_PER_FLOOR = 20000;
const int DEFAULT_AREA_FEE = 25000;
const double SPREAD_FACTOR = 1.3;
const int TOLERANCE_PERCENT = 15;
const int DEFAULT_CALLOUT_FEE_VND = 50000;
const String TOLERANCE_MESSAGE =
    'Miễn phí phụ thu nếu khối lượng hoặc kích thước thực tế sai lệch không quá ±15% so với khai báo.';

enum BulkyOrderStatus {
  DRAFT,
  AWAITING_PAYMENT,
  CONFIRMED,
  SCHEDULED,
  ASSIGNED,
  IN_PROGRESS,
  COLLECTED,
  COMPLETED,
  CANCELLED,
  PENDING_REVIEW,
  APPROVED_AWAITING_PAYMENT,
  DISCREPANCY_PENDING,
  REJECTED_ON_SITE,
  REJECTED;

  String get label {
    switch (this) {
      case BulkyOrderStatus.DRAFT:
        return 'Bản nháp';
      case BulkyOrderStatus.AWAITING_PAYMENT:
        return 'Chờ thanh toán cọc';
      case BulkyOrderStatus.CONFIRMED:
        return 'Đã cọc • Chờ phê duyệt';
      case BulkyOrderStatus.SCHEDULED:
        return 'Đã duyệt & Lên lịch xe';
      case BulkyOrderStatus.ASSIGNED:
        return 'Đã điều phối xe thu gom';
      case BulkyOrderStatus.IN_PROGRESS:
        return 'Xe đang đến thu gom';
      case BulkyOrderStatus.COLLECTED:
        return 'Đã thu gom';
      case BulkyOrderStatus.COMPLETED:
        return 'Hoàn tất quyết toán';
      case BulkyOrderStatus.CANCELLED:
        return 'Đã hủy';
      case BulkyOrderStatus.PENDING_REVIEW:
        return 'Chờ điều phối viên duyệt giá';
      case BulkyOrderStatus.APPROVED_AWAITING_PAYMENT:
        return 'Đã duyệt giá • Chờ đặt cọc';
      case BulkyOrderStatus.DISCREPANCY_PENDING:
        return 'Chờ duyệt phát sinh tại chỗ';
      case BulkyOrderStatus.REJECTED_ON_SITE:
        return 'Từ chối tại hiện trường';
      case BulkyOrderStatus.REJECTED:
        return 'Đã từ chối';
    }
  }

  String get displayName => label;
}

enum BulkyPaymentStatus {
  UNPAID,
  DEPOSIT_HELD,
  PAID,
  REFUNDED;

  String get label {
    switch (this) {
      case BulkyPaymentStatus.UNPAID:
        return 'Chưa thanh toán';
      case BulkyPaymentStatus.DEPOSIT_HELD:
        return 'Đã giữ cọc';
      case BulkyPaymentStatus.PAID:
        return 'Đã thanh toán đủ';
      case BulkyPaymentStatus.REFUNDED:
        return 'Đã hoàn tiền';
    }
  }
}
