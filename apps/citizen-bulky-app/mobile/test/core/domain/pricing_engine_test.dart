import 'package:flutter_test/flutter_test.dart';
import 'package:bulky_mobile/core/constants/bulky_constants.dart';
import 'package:bulky_mobile/core/domain/models/bulky_item.dart';
import 'package:bulky_mobile/core/domain/models/bounding_box.dart';
import 'package:bulky_mobile/core/domain/models/bulky_quote.dart';
import 'package:bulky_mobile/core/domain/models/bulky_order.dart';
import 'package:bulky_mobile/core/domain/pricing/pricing_engine.dart';

void main() {
  group('PricingEngine', () {
    test('calculates correct quote with standard and heavy items', () {
      final items = [
        BulkyItem(
          id: '1',
          category: BulkyCategory.SOFA,
          displayName: 'Sofa da 3 chỗ',
          quantity: 1,
          material: MaterialType.STANDARD,
        ),
        BulkyItem(
          id: '2',
          category: BulkyCategory.OTHER,
          displayName: 'Phế thải gạch ngói',
          quantity: 1,
          material: MaterialType.HEAVY, // 60.000 * 1.3 = 78.000
        ),
      ];

      final quote = PricingEngine.calculateQuote(
        items: items,
        requiresDisassembly: true, // +30.000
        floorNumber: 2,
        hasElevator: false,        // 2 floors * 20.000 = +40.000
      );

      // Total items: 150.000 (Sofa) + 78.000 (Heavy other) = 228.000
      // Handling fees: 30.000 + 40.000 = 70.000
      // Area fee: 25.000
      // Min: 323.000, Max: round(323.000 * 1.3) = 419.900
      expect(quote.minVnd, equals(323000));
      expect(quote.maxVnd, equals(419900));
      expect(quote.depositHoldVnd, equals(323000));
      expect(quote.tolerancePolicy.allowedMaxVnd, equals(482885));
    });

    test('calculates quote with light material and elevator present', () {
      final items = [
        BulkyItem(
          id: '3',
          category: BulkyCategory.TABLE,
          displayName: 'Bàn nhựa gấp gọn',
          quantity: 2,
          material: MaterialType.LIGHT, // 80.000 * 0.8 = 64.000 * 2 = 128.000
        ),
      ];

      final quote = PricingEngine.calculateQuote(
        items: items,
        requiresDisassembly: false,
        floorNumber: 5,
        hasElevator: true, // Has elevator -> 0 floor fee
      );

      // Items: 128.000
      // Handling: 0
      // Area fee: 25.000
      // Min: 153.000, Max: round(153.000 * 1.3) = 198.900
      expect(quote.minVnd, equals(153000));
      expect(quote.maxVnd, equals(198900));
      expect(quote.depositHoldVnd, equals(153000));
      expect(quote.disassemblyFee, equals(0));
      expect(quote.floorHandlingFee, equals(0));
      expect(quote.areaFee, equals(25000));
      expect(quote.tolerancePolicy.allowedPercent, equals(15));
      expect(quote.tolerancePolicy.allowedMaxVnd, equals((198900 * 1.15).round()));
    });

    test('calculates correct breakdown items and estimated weight', () {
      final items = [
        BulkyItem(
          id: 'item-1',
          category: BulkyCategory.MATTRESS,
          displayName: 'Đệm lò xo',
          quantity: 1,
          material: MaterialType.STANDARD,
        ),
        BulkyItem(
          id: 'item-2',
          category: BulkyCategory.CABINET,
          displayName: 'Tủ gỗ ép 2 cánh',
          quantity: 1,
          material: MaterialType.LIGHT,
        ),
      ];

      final quote = PricingEngine.calculateQuote(items: items);

      expect(quote.itemsBreakdown.length, equals(2));
      expect(quote.itemsBreakdown[0].unitPriceVnd, equals(100000));
      expect(quote.itemsBreakdown[0].minVnd, equals(100000));
      expect(quote.itemsBreakdown[0].maxVnd, equals(130000));

      // Cabinet: 120.000 * 0.8 = 96.000
      expect(quote.itemsBreakdown[1].unitPriceVnd, equals(96000));
      expect(quote.itemsBreakdown[1].minVnd, equals(96000));
      expect(quote.itemsBreakdown[1].maxVnd, equals((96000 * 1.3).round()));

      // Total estimated weight:
      // Mattress (30 * 1.0) + Cabinet (40 * 0.7 = 28) = 58 kg
      final totalWeight = PricingEngine.calculateTotalEstimatedWeight(items);
      expect(totalWeight, equals(58.0));
    });

    test('throws ArgumentError when items list is empty', () {
      expect(
        () => PricingEngine.calculateQuote(items: []),
        throwsA(isA<ArgumentError>()),
      );
    });
  });

  group('Domain Models Serialization', () {
    test('BulkyItem converts to and from JSON', () {
      final box = BoundingBox(
        ymin: 100,
        xmin: 50,
        ymax: 700,
        xmax: 950,
        displayName: 'Sofa da',
        confidence: 0.95,
        category: BulkyCategory.SOFA,
      );

      final item = BulkyItem(
        id: 'sofa-1',
        category: BulkyCategory.SOFA,
        displayName: 'Sofa góc da bò',
        quantity: 1,
        lengthCm: 200,
        widthCm: 90,
        heightCm: 85,
        material: MaterialType.HEAVY,
        box2d: box,
        confidence: 0.95,
      );

      final json = item.toJson();
      final fromJson = BulkyItem.fromJson(json);

      expect(fromJson.id, equals(item.id));
      expect(fromJson.category, equals(BulkyCategory.SOFA));
      expect(fromJson.displayName, equals('Sofa góc da bò'));
      expect(fromJson.material, equals(MaterialType.HEAVY));
      expect(fromJson.box2d?.ymin, equals(100));
      expect(fromJson.box2d?.xmax, equals(950));
      expect(fromJson.lengthCm, equals(200));
    });

    test('BoundingBox calculates normalized canvas coordinates', () {
      final box = BoundingBox(
        ymin: 200,
        xmin: 100,
        ymax: 800,
        xmax: 900,
        displayName: 'Tủ quần áo',
        confidence: 0.88,
        category: BulkyCategory.CABINET,
      );

      expect(box.topNormalized, equals(0.2));
      expect(box.leftNormalized, equals(0.1));
      expect(box.bottomNormalized, equals(0.8));
      expect(box.rightNormalized, equals(0.9));
      expect(box.widthNormalized, closeTo(0.8, 0.0001));
      expect(box.heightNormalized, closeTo(0.6, 0.0001));
    });

    test('BulkyOrder converts to and from JSON', () {
      final items = [
        BulkyItem(
          id: '1',
          category: BulkyCategory.SOFA,
          displayName: 'Sofa da',
          quantity: 1,
          material: MaterialType.STANDARD,
        ),
      ];

      final quote = PricingEngine.calculateQuote(items: items);

      final order = BulkyOrder(
        id: 'order-101',
        items: items,
        quote: quote,
        address: '123 Nguyễn Trãi, Quận 5, TP.HCM',
        pickupDate: '2026-09-26',
        status: BulkyOrderStatus.CONFIRMED,
        hasElevator: true,
        floorNumber: 3,
        requiresDisassembly: false,
        vehiclePlate: '51C-889.21',
        createdAt: DateTime(2026, 9, 24, 10, 0),
        depositPaidAt: DateTime(2026, 9, 24, 10, 5),
        contactName: 'Lê Quốc Anh',
        contactPhone: '0901234567',
      );

      final json = order.toJson();
      final fromJson = BulkyOrder.fromJson(json);

      expect(fromJson.id, equals('order-101'));
      expect(fromJson.status, equals(BulkyOrderStatus.CONFIRMED));
      expect(fromJson.quote.minVnd, equals(quote.minVnd));
      expect(fromJson.vehiclePlate, equals('51C-889.21'));
      expect(fromJson.items.first.displayName, equals('Sofa da'));
    });

    test('BulkyQuote converts to and from JSON', () {
      final items = [
        BulkyItem(
          id: '1',
          category: BulkyCategory.SOFA,
          displayName: 'Sofa da',
          quantity: 1,
          material: MaterialType.STANDARD,
        ),
      ];

      final BulkyQuote quote = PricingEngine.calculateQuote(items: items);
      final json = quote.toJson();
      final fromJson = BulkyQuote.fromJson(json);

      expect(fromJson.quoteId, equals(quote.quoteId));
      expect(fromJson.minVnd, equals(quote.minVnd));
      expect(fromJson.maxVnd, equals(quote.maxVnd));
      expect(fromJson.tolerancePolicy.allowedMaxVnd, equals(quote.tolerancePolicy.allowedMaxVnd));
      expect(fromJson.itemsBreakdown.length, equals(quote.itemsBreakdown.length));
    });
  });
}
