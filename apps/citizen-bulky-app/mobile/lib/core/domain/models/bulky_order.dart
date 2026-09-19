import '../../constants/bulky_constants.dart';
import 'bulky_item.dart';
import 'bulky_quote.dart';

/// Represents a citizen's bulky waste pickup order.
class BulkyOrder {
  final String id;
  final List<BulkyItem> items;
  final BulkyQuote quote;
  final String address;
  final String pickupDate; // Format: YYYY-MM-DD
  final BulkyOrderStatus status;
  final BulkyPaymentStatus paymentStatus;
  final bool hasElevator;
  final int floorNumber;
  final bool requiresDisassembly;
  final String? vehiclePlate;
  final DateTime createdAt;
  final DateTime? depositPaidAt;
  final String? contactName;
  final String? contactPhone;
  final String? note;
  final String? imageUri;
  final int? finalizedPriceVnd;
  final String? operatorNote;
  final int? onSiteAdjustedPriceVnd;
  final String? onSiteDiscrepancyNote;
  final String? onSiteRejectionReason;
  final int calloutFeeVnd;

  const BulkyOrder({
    required this.id,
    required this.items,
    required this.quote,
    required this.address,
    required this.pickupDate,
    this.status = BulkyOrderStatus.AWAITING_PAYMENT,
    this.paymentStatus = BulkyPaymentStatus.UNPAID,
    this.hasElevator = false,
    this.floorNumber = 0,
    this.requiresDisassembly = false,
    this.vehiclePlate,
    required this.createdAt,
    this.depositPaidAt,
    this.contactName,
    this.contactPhone,
    this.note,
    this.imageUri,
    this.finalizedPriceVnd,
    this.operatorNote,
    this.onSiteAdjustedPriceVnd,
    this.onSiteDiscrepancyNote,
    this.onSiteRejectionReason,
    this.calloutFeeVnd = 0,
  });

  int get totalItemsCount =>
      items.fold(0, (sum, item) => sum + item.quantity);

  BulkyCategory get primaryCategory =>
      items.isNotEmpty ? items.first.category : BulkyCategory.OTHER;

  BulkyOrder copyWith({
    String? id,
    List<BulkyItem>? items,
    BulkyQuote? quote,
    String? address,
    String? pickupDate,
    BulkyOrderStatus? status,
    BulkyPaymentStatus? paymentStatus,
    bool? hasElevator,
    int? floorNumber,
    bool? requiresDisassembly,
    String? vehiclePlate,
    DateTime? createdAt,
    DateTime? depositPaidAt,
    String? contactName,
    String? contactPhone,
    String? note,
    String? imageUri,
    int? finalizedPriceVnd,
    String? operatorNote,
    int? onSiteAdjustedPriceVnd,
    String? onSiteDiscrepancyNote,
    String? onSiteRejectionReason,
    int? calloutFeeVnd,
  }) {
    return BulkyOrder(
      id: id ?? this.id,
      items: items ?? this.items,
      quote: quote ?? this.quote,
      address: address ?? this.address,
      pickupDate: pickupDate ?? this.pickupDate,
      status: status ?? this.status,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      hasElevator: hasElevator ?? this.hasElevator,
      floorNumber: floorNumber ?? this.floorNumber,
      requiresDisassembly: requiresDisassembly ?? this.requiresDisassembly,
      vehiclePlate: vehiclePlate ?? this.vehiclePlate,
      createdAt: createdAt ?? this.createdAt,
      depositPaidAt: depositPaidAt ?? this.depositPaidAt,
      contactName: contactName ?? this.contactName,
      contactPhone: contactPhone ?? this.contactPhone,
      note: note ?? this.note,
      imageUri: imageUri ?? this.imageUri,
      finalizedPriceVnd: finalizedPriceVnd ?? this.finalizedPriceVnd,
      operatorNote: operatorNote ?? this.operatorNote,
      onSiteAdjustedPriceVnd:
          onSiteAdjustedPriceVnd ?? this.onSiteAdjustedPriceVnd,
      onSiteDiscrepancyNote:
          onSiteDiscrepancyNote ?? this.onSiteDiscrepancyNote,
      onSiteRejectionReason:
          onSiteRejectionReason ?? this.onSiteRejectionReason,
      calloutFeeVnd: calloutFeeVnd ?? this.calloutFeeVnd,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'items': items.map((e) => e.toJson()).toList(),
      'quote': quote.toJson(),
      'address': address,
      'pickupDate': pickupDate,
      'status': status.name,
      'paymentStatus': paymentStatus.name,
      'hasElevator': hasElevator,
      'floorNumber': floorNumber,
      'requiresDisassembly': requiresDisassembly,
      'vehiclePlate': vehiclePlate,
      'createdAt': createdAt.toIso8601String(),
      'depositPaidAt': depositPaidAt?.toIso8601String(),
      'contactName': contactName,
      'contactPhone': contactPhone,
      'note': note,
      'imageUri': imageUri,
      'finalizedPriceVnd': finalizedPriceVnd,
      'operatorNote': operatorNote,
      'onSiteAdjustedPriceVnd': onSiteAdjustedPriceVnd,
      'onSiteDiscrepancyNote': onSiteDiscrepancyNote,
      'onSiteRejectionReason': onSiteRejectionReason,
      'calloutFeeVnd': calloutFeeVnd,
    };
  }

  factory BulkyOrder.fromJson(Map<String, dynamic> json) {
    return BulkyOrder(
      id: json['id'] as String? ?? 'order-${DateTime.now().millisecondsSinceEpoch}',
      items: (json['items'] as List<dynamic>? ?? [])
          .map((e) => BulkyItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      quote: BulkyQuote.fromJson(json['quote'] as Map<String, dynamic>),
      address: json['address'] as String? ?? '',
      pickupDate: json['pickupDate'] as String? ?? '',
      status: BulkyOrderStatus.values.firstWhere(
        (s) => s.name == json['status'],
        orElse: () => BulkyOrderStatus.AWAITING_PAYMENT,
      ),
      paymentStatus: BulkyPaymentStatus.values.firstWhere(
        (p) => p.name == json['paymentStatus'],
        orElse: () => BulkyPaymentStatus.UNPAID,
      ),
      hasElevator: json['hasElevator'] as bool? ?? false,
      floorNumber: (json['floorNumber'] as num?)?.toInt() ?? 0,
      requiresDisassembly: json['requiresDisassembly'] as bool? ?? false,
      vehiclePlate: json['vehiclePlate'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      depositPaidAt: json['depositPaidAt'] != null
          ? DateTime.parse(json['depositPaidAt'] as String)
          : null,
      contactName: json['contactName'] as String?,
      contactPhone: json['contactPhone'] as String?,
      note: json['note'] as String?,
      imageUri: json['imageUri'] as String?,
      finalizedPriceVnd: (json['finalizedPriceVnd'] as num?)?.toInt(),
      operatorNote: json['operatorNote'] as String?,
      onSiteAdjustedPriceVnd: (json['onSiteAdjustedPriceVnd'] as num?)?.toInt(),
      onSiteDiscrepancyNote: json['onSiteDiscrepancyNote'] as String?,
      onSiteRejectionReason: json['onSiteRejectionReason'] as String?,
      calloutFeeVnd: (json['calloutFeeVnd'] as num?)?.toInt() ?? 0,
    );
  }
}
