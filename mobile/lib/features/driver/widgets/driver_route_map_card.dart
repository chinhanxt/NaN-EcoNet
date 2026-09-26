import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/domain/models/bulky_order.dart';
import '../../../core/theme/bulky_colors.dart';

/// Represents a collection stop on the driver's shift route
enum StopType {
  currentVehicle,
  regularBin,
  bulkyWaste,
  transferStation,
}

class ShiftStop {
  final String id;
  final int sequence;
  final String name;
  final String address;
  final StopType type;
  final String? triggerReason; // '📱 Cư dân báo thùng đầy qua App' vs '🗓️ Thu gom định kỳ 2 ngày/lần'
  final String? itemDetails;
  final String distanceText;
  final String etaText;
  final String directionInstruction;
  final double relativeX; // 0.0 to 1.0 on mockup canvas
  final double relativeY; // 0.0 to 1.0 on mockup canvas
  final bool isCompleted;

  const ShiftStop({
    required this.id,
    required this.sequence,
    required this.name,
    required this.address,
    required this.type,
    this.triggerReason,
    this.itemDetails,
    required this.distanceText,
    required this.etaText,
    required this.directionInstruction,
    required this.relativeX,
    required this.relativeY,
    this.isCompleted = false,
  });
}

/// Interactive Mockup Map displaying the driver's shift route
/// with optimized directional paths and turn-by-turn guidance.
/// Supports both:
/// 1. Regular waste route (Xe ép rác 5T - Tuyến định kỳ 2-3 ngày & Cư dân báo app)
/// 2. Bulky waste route (Xe tải chuyên dụng 2.5T - Điểm hẹn rác cồng kềnh đã duyệt & cọc)
class DriverRouteMapCard extends StatefulWidget {
  final String vehiclePlate;
  final List<BulkyOrder> activeOrders;
  final bool isRegularWasteRoute;

  const DriverRouteMapCard({
    super.key,
    required this.vehiclePlate,
    this.activeOrders = const [],
    this.isRegularWasteRoute = false,
  });

  @override
  State<DriverRouteMapCard> createState() => _DriverRouteMapCardState();
}

class _DriverRouteMapCardState extends State<DriverRouteMapCard> {
  int _selectedStopIndex = 1; // Default to first actual pickup stop
  String _selectedFilter = 'all';
  bool _isNavigating = false;

  late List<ShiftStop> _stops;

  @override
  void initState() {
    super.initState();
    _initStops();
  }

  @override
  void didUpdateWidget(covariant DriverRouteMapCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.activeOrders != widget.activeOrders ||
        oldWidget.vehiclePlate != widget.vehiclePlate ||
        oldWidget.isRegularWasteRoute != widget.isRegularWasteRoute) {
      _initStops();
    }
  }

  void _initStops() {
    if (widget.isRegularWasteRoute) {
      // Tuyến xe ép rác sinh hoạt thông dụng (Nguyễn Văn Hùng - 51C-889.21)
      _stops = [
        ShiftStop(
          id: 'start_regular',
          sequence: 0,
          name: 'Vị trí xe ${widget.vehiclePlate}',
          address: 'Bãi đỗ xe Đội VSMT Cầu Giấy (Điểm xuất phát)',
          type: StopType.currentVehicle,
          distanceText: '0 km',
          etaText: 'Bắt đầu',
          directionInstruction: 'Xuất phát từ bãi xe, rẽ phải vào đường Cầu Giấy',
          relativeX: 0.12,
          relativeY: 0.28,
        ),
        const ShiftStop(
          id: 'sh_01',
          sequence: 1,
          name: 'Thùng rác công cộng #SH-01',
          address: 'Số 68 Cầu Giấy, Quan Hoa',
          type: StopType.regularBin,
          triggerReason: '📱 Cư dân báo thùng đầy qua App (15 phút trước)',
          itemDetails: 'Thùng rác vỉa hè đầy tràn rác sinh hoạt sau ca chợ sáng',
          distanceText: '450 m',
          etaText: '~2 phút',
          directionInstruction: 'Đi thẳng 400m trên đường Cầu Giấy, rẽ phải vào Ngõ 68',
          relativeX: 0.36,
          relativeY: 0.28,
        ),
        const ShiftStop(
          id: 'sh_02',
          sequence: 2,
          name: 'Điểm thu gom rác #SH-02',
          address: '120 Đường Cầu Giấy, Quan Hoa',
          type: StopType.regularBin,
          triggerReason: '🗓️ Thu gom định kỳ (Chu kỳ 2 ngày/lần)',
          itemDetails: 'Tuyến cố định xe ép rác sinh hoạt sáng T7',
          distanceText: '1.2 km',
          etaText: '~5 phút',
          directionInstruction: 'Từ ngõ 68 quay ra trục chính, đi tiếp 800m hướng ngã tư',
          relativeX: 0.46,
          relativeY: 0.58,
        ),
        const ShiftStop(
          id: 'sh_03',
          sequence: 3,
          name: 'Thùng rác công cộng #SH-03',
          address: 'Ngã tư Trần Thái Tông - Xuân Thủy',
          type: StopType.regularBin,
          triggerReason: '📱 Cư dân báo tồn đọng rác qua App (25 phút trước)',
          itemDetails: 'Rác sinh hoạt tồn đọng quanh điểm chờ xe buýt',
          distanceText: '1.8 km',
          etaText: '~8 phút',
          directionInstruction: 'Rẽ trái vào đường Trần Thái Tông, thu gom thùng trước trạm xe buýt',
          relativeX: 0.65,
          relativeY: 0.58,
        ),
        const ShiftStop(
          id: 'sh_04',
          sequence: 4,
          name: 'Điểm thu gom rác #SH-04',
          address: '45 Phố Duy Tân, Dịch Vọng Hậu',
          type: StopType.regularBin,
          triggerReason: '🗓️ Thu gom định kỳ (Chu kỳ 2 ngày/lần)',
          itemDetails: 'Cụm 3 thùng rác công cộng khu văn phòng Duy Tân',
          distanceText: '2.5 km',
          etaText: '~12 phút',
          directionInstruction: 'Đi thẳng phố Duy Tân 600m, gom sạch cụm thùng rác',
          relativeX: 0.78,
          relativeY: 0.32,
        ),
        const ShiftStop(
          id: 'end_regular',
          sequence: 5,
          name: 'Trạm ép rác kín trung chuyển Cầu Giấy',
          address: 'Trạm trung chuyển ép rác kín Q. Cầu Giấy',
          type: StopType.transferStation,
          distanceText: '5.2 km',
          etaText: '~22 phút',
          directionInstruction: 'Chạy thẳng hướng Phạm Hùng ra đường gom vành đai 3 để xả ép rác',
          relativeX: 0.90,
          relativeY: 0.75,
        ),
      ];
    } else {
      // Tuyến xe tải thu gom rác cồng kềnh (Lê Hoàng Long - 51D-924.58)
      String bulky1Name = 'Rác cồng kềnh: Sofa 3 chỗ & Bàn trà';
      String bulky1Addr = '120 Đường Cầu Giấy, Quan Hoa';
      if (widget.activeOrders.isNotEmpty) {
        final o = widget.activeOrders.first;
        bulky1Name = 'Rác cồng kềnh: ${o.items.map((i) => i.displayName).take(2).join(', ')}';
        bulky1Addr = o.address;
      }

      String bulky2Name = 'Rác cồng kềnh: Tủ gỗ ép & Giường ngủ';
      String bulky2Addr = '45 Phố Duy Tân, Dịch Vọng Hậu';
      if (widget.activeOrders.length > 1) {
        final o = widget.activeOrders[1];
        bulky2Name = 'Rác cồng kềnh: ${o.items.map((i) => i.displayName).take(2).join(', ')}';
        bulky2Addr = o.address;
      }

      _stops = [
        ShiftStop(
          id: 'start_bulky',
          sequence: 0,
          name: 'Vị trí xe ${widget.vehiclePlate}',
          address: 'Bãi đỗ xe Đội VSMT Cầu Giấy (Điểm xuất phát)',
          type: StopType.currentVehicle,
          distanceText: '0 km',
          etaText: 'Bắt đầu',
          directionInstruction: 'Xuất phát từ bãi xe, rẽ phải vào đường Cầu Giấy',
          relativeX: 0.12,
          relativeY: 0.28,
        ),
        ShiftStop(
          id: 'bulky_01',
          sequence: 1,
          name: bulky1Name,
          address: bulky1Addr,
          type: StopType.bulkyWaste,
          itemDetails: 'Hộ dân đã tập kết vỉa hè • Đã đặt cọc giữ xe',
          distanceText: '450 m',
          etaText: '~3 phút',
          directionInstruction: 'Rẽ phải vào đường Cầu Giấy, tiếp tục 400m đến điểm hẹn nhà dân',
          relativeX: 0.38,
          relativeY: 0.32,
        ),
        ShiftStop(
          id: 'bulky_02',
          sequence: 2,
          name: bulky2Name,
          address: bulky2Addr,
          type: StopType.bulkyWaste,
          itemDetails: 'Tầng 1 sảnh chung cư • Có bảo vệ hướng dẫn xe đỗ',
          distanceText: '1.4 km',
          etaText: '~6 phút',
          directionInstruction: 'Rẽ trái vào đường Trần Thái Tông rồi sang phố Duy Tân',
          relativeX: 0.58,
          relativeY: 0.55,
        ),
        const ShiftStop(
          id: 'bulky_03',
          sequence: 3,
          name: 'Rác cồng kềnh: Đệm lò xo & Bàn ăn gỗ',
          address: '88 Phố Trần Thái Tông, Dịch Vọng',
          type: StopType.bulkyWaste,
          itemDetails: 'Đã duyệt giá 450.000 đ • Cần 2 nhân công bốc dỡ',
          distanceText: '2.2 km',
          etaText: '~10 phút',
          directionInstruction: 'Quay đầu hướng Trần Thái Tông, tiếp cận sảnh tòa nhà',
          relativeX: 0.74,
          relativeY: 0.35,
        ),
        const ShiftStop(
          id: 'end_bulky',
          sequence: 4,
          name: 'Trạm phân loại rác cồng kềnh Cầu Giấy',
          address: 'Khu tập kết & băm nghiền rác cồng kềnh Cầu Giấy',
          type: StopType.transferStation,
          distanceText: '5.8 km',
          etaText: '~25 phút',
          directionInstruction: 'Chạy thẳng Phạm Hùng về trạm tháo dỡ tách gỗ và kim loại',
          relativeX: 0.90,
          relativeY: 0.75,
        ),
      ];
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedStop = _stops[_selectedStopIndex.clamp(0, _stops.length - 1)];

    final titleText = widget.isRegularWasteRoute
        ? 'LỘ TRÌNH THU GOM RÁC SINH HOẠT'
        : 'LỘ TRÌNH THU GOM RÁC CỒNG KỀNH';

    final subtitleText = widget.isRegularWasteRoute
        ? 'Ca sáng: 07:30 - 11:30 • Tuyến liên hoàn 5.2 km • Chu kỳ 2-3 ngày & Dân báo App'
        : 'Ca sáng: 07:30 - 11:30 • Tuyến chuyên dụng 5.8 km • Đơn hẹn đã duyệt giá & cọc';

    return Container(
      decoration: BoxDecoration(
        color: BulkyColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: BulkyColors.border),
        boxShadow: BulkyColors.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Header Banner
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Text('🗺️ ', style: TextStyle(fontSize: 18)),
                        Text(
                          titleText,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.4,
                            color: BulkyColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: (widget.isRegularWasteRoute ? const Color(0xFF0D9488) : BulkyColors.primary)
                            .withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        widget.isRegularWasteRoute ? '⚡ Tuyến Tối Ưu' : '⚡ AI Tối Ưu',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: widget.isRegularWasteRoute ? const Color(0xFF0D9488) : BulkyColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  subtitleText,
                  style: const TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
                ),
              ],
            ),
          ),

          // 2. Filter & Legend Badges
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Wrap(
              spacing: 6,
              runSpacing: 4,
              children: widget.isRegularWasteRoute
                  ? [
                      _buildFilterChip('all', 'Tất cả (5 điểm)', Icons.alt_route_rounded),
                      _buildFilterChip('app_report', '📱 Dân báo qua App (2)', null),
                      _buildFilterChip('routine', '🗓️ Định kỳ 2 ngày (2)', null),
                    ]
                  : [
                      _buildFilterChip('all', 'Tất cả (4 điểm)', Icons.alt_route_rounded),
                      _buildFilterChip('sofa', '🛋️ Sofa & Đệm (2)', null),
                      _buildFilterChip('wood', '🪵 Tủ & Giường (1)', null),
                    ],
            ),
          ),
          const SizedBox(height: 10),

          // 3. Map Viewport (Interactive CustomPainter with Map Aesthetic)
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 14),
            height: 240,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: BulkyColors.border),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Stack(
                children: [
                  // Vector Map Canvas
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _RouteMapCanvasPainter(
                        stops: _stops,
                        selectedStopIndex: _selectedStopIndex,
                        filter: _selectedFilter,
                      ),
                    ),
                  ),

                  // Stop Marker Hit Boxes (Clickable on map)
                  ..._stops.asMap().entries.map((entry) {
                    final index = entry.key;
                    final stop = entry.value;

                    // Filter condition
                    if (_selectedFilter == 'app_report' &&
                        stop.triggerReason?.contains('App') != true &&
                        stop.type != StopType.currentVehicle) {
                      return const SizedBox.shrink();
                    }
                    if (_selectedFilter == 'routine' &&
                        stop.triggerReason?.contains('định kỳ') != true &&
                        stop.type != StopType.currentVehicle) {
                      return const SizedBox.shrink();
                    }
                    if (_selectedFilter == 'sofa' &&
                        stop.itemDetails?.toLowerCase().contains('sofa') != true &&
                        stop.itemDetails?.toLowerCase().contains('đệm') != true &&
                        stop.type != StopType.currentVehicle) {
                      return const SizedBox.shrink();
                    }
                    if (_selectedFilter == 'wood' &&
                        stop.itemDetails?.toLowerCase().contains('tủ') != true &&
                        stop.type != StopType.currentVehicle) {
                      return const SizedBox.shrink();
                    }

                    return Positioned(
                      left: stop.relativeX * 380 - 18,
                      top: stop.relativeY * 240 - 18,
                      child: GestureDetector(
                        onTap: () {
                          setState(() {
                            _selectedStopIndex = index;
                          });
                        },
                        child: _buildMapPinWidget(stop, index == _selectedStopIndex),
                      ),
                    );
                  }),

                  // Compass & Map Legend Overlay (Top Right)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: BulkyColors.border),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.near_me, size: 12, color: BulkyColors.primary),
                          SizedBox(width: 4),
                          Text(
                            'Khu vực Q. Cầu Giấy',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: BulkyColors.textPrimary),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Legend (Bottom Left)
                  Positioned(
                    bottom: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.92),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: BulkyColors.border),
                      ),
                      child: widget.isRegularWasteRoute
                          ? const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text('🚚 Xe ép', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                                SizedBox(width: 6),
                                Text('➔', style: TextStyle(fontSize: 9, color: BulkyColors.primary, fontWeight: FontWeight.bold)),
                                SizedBox(width: 6),
                                Text('📱 Dân báo App', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFFD97706))),
                                SizedBox(width: 6),
                                Text('➔', style: TextStyle(fontSize: 9, color: BulkyColors.primary, fontWeight: FontWeight.bold)),
                                SizedBox(width: 6),
                                Text('🗓️ Định kỳ 2 ngày', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF0D9488))),
                              ],
                            )
                          : const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text('🚚 Xe 2.5T', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                                SizedBox(width: 6),
                                Text('➔', style: TextStyle(fontSize: 9, color: BulkyColors.primary, fontWeight: FontWeight.bold)),
                                SizedBox(width: 6),
                                Text('🛋️ Sofa & Đệm', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED))),
                                SizedBox(width: 6),
                                Text('➔', style: TextStyle(fontSize: 9, color: BulkyColors.primary, fontWeight: FontWeight.bold)),
                                SizedBox(width: 6),
                                Text('🪵 Tủ & Giường', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFFEA580C))),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // 4. Next Action / Selected Stop Turn-by-Turn Card
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _getStopBackgroundColor(selectedStop.type),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _getStopBorderColor(selectedStop.type)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: _getStopBadgeColor(selectedStop.type),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          selectedStop.sequence == 0
                              ? 'VỊ TRÍ HIỆN TẠI'
                              : selectedStop.sequence == _stops.length - 1
                                  ? 'ĐÍCH ĐẾN'
                                  : 'ĐIỂM DỪNG #${selectedStop.sequence}',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          selectedStop.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: BulkyColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: BulkyColors.border),
                        ),
                        child: Text(
                          '${selectedStop.distanceText} • ${selectedStop.etaText}',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: BulkyColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),

                  // Address
                  Row(
                    children: [
                      const Icon(Icons.location_on_rounded, size: 14, color: BulkyColors.textSecondary),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          selectedStop.address,
                          style: const TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),

                  // Trigger Reason Badge (App report vs routine cycle)
                  if (selectedStop.triggerReason != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: selectedStop.triggerReason!.contains('App')
                            ? const Color(0xFFFEF3C7)
                            : const Color(0xFFE6FFFA),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: selectedStop.triggerReason!.contains('App')
                              ? const Color(0xFFF59E0B).withValues(alpha: 0.3)
                              : const Color(0xFF0D9488).withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            selectedStop.triggerReason!.contains('App')
                                ? Icons.phone_android_rounded
                                : Icons.event_repeat_rounded,
                            size: 13,
                            color: selectedStop.triggerReason!.contains('App')
                                ? const Color(0xFFD97706)
                                : const Color(0xFF0D9488),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            selectedStop.triggerReason!,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: selectedStop.triggerReason!.contains('App')
                                  ? const Color(0xFFB45309)
                                  : const Color(0xFF0F766E),
                            ),
                          ),
                        ],
                      ),
                    ),

                  if (selectedStop.itemDetails != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: widget.isRegularWasteRoute ? const Color(0xFFF1F5F9) : const Color(0xFFF3E8FF),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: (widget.isRegularWasteRoute ? BulkyColors.border : const Color(0xFFA855F7))
                              .withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            widget.isRegularWasteRoute ? Icons.delete_outline_rounded : Icons.inventory_2_outlined,
                            size: 13,
                            color: widget.isRegularWasteRoute ? BulkyColors.textSecondary : const Color(0xFF7C3AED),
                          ),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              selectedStop.itemDetails!,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: widget.isRegularWasteRoute ? BulkyColors.textPrimary : const Color(0xFF6D28D9),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Direction Instruction
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: BulkyColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.turn_right_rounded, size: 16, color: BulkyColors.primary),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            selectedStop.directionInstruction,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: BulkyColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Action Buttons: Open Google Maps & Advance Step
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Đang mở Google Maps dẫn đường đến "${selectedStop.name}"...',
                                ),
                                backgroundColor: BulkyColors.textPrimary,
                                duration: const Duration(seconds: 2),
                              ),
                            );
                          },
                          icon: const Icon(Icons.navigation_outlined, size: 15),
                          label: const Text('Mở Google Maps', style: TextStyle(fontSize: 12)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: BulkyColors.textPrimary,
                            side: const BorderSide(color: BulkyColors.border),
                            padding: const EdgeInsets.symmetric(vertical: 9),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            setState(() {
                              if (_selectedStopIndex < _stops.length - 1) {
                                _selectedStopIndex++;
                              } else {
                                _selectedStopIndex = 1;
                              }
                              _isNavigating = true;
                            });

                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Chuyển sang chặng #$_selectedStopIndex: ${_stops[_selectedStopIndex].name}',
                                ),
                                backgroundColor: widget.isRegularWasteRoute ? const Color(0xFF0D9488) : BulkyColors.primary,
                                duration: const Duration(seconds: 2),
                              ),
                            );
                          },
                          icon: Icon(
                            _isNavigating ? Icons.check_circle_outline : Icons.play_arrow_rounded,
                            size: 16,
                          ),
                          label: Text(
                            _selectedStopIndex < _stops.length - 1 ? 'Bắt đầu di chuyển' : 'Lặp lại tuyến',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: widget.isRegularWasteRoute ? const Color(0xFF0D9488) : BulkyColors.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 9),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // 5. Waypoints Sequence Preview Strip
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '📋 Danh sách ${_stops.length} điểm dừng tối ưu trên tuyến:',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: BulkyColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ..._stops.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final stop = entry.value;
                  final isCurrent = idx == _selectedStopIndex;

                  return GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedStopIndex = idx;
                      });
                    },
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: isCurrent
                            ? (widget.isRegularWasteRoute ? const Color(0xFFE6FFFA) : BulkyColors.primaryLight.withValues(alpha: 0.15))
                            : Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isCurrent
                              ? (widget.isRegularWasteRoute ? const Color(0xFF0D9488) : BulkyColors.primary)
                              : BulkyColors.border,
                          width: isCurrent ? 1.5 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: isCurrent
                                  ? (widget.isRegularWasteRoute ? const Color(0xFF0D9488) : BulkyColors.primary)
                                  : const Color(0xFFE2E8F0),
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '$idx',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: isCurrent ? Colors.white : BulkyColors.textSecondary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(_getStopEmoji(stop.type), style: const TextStyle(fontSize: 14)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              stop.name,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                                color: isCurrent ? BulkyColors.textPrimary : BulkyColors.textSecondary,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            stop.distanceText,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: BulkyColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String key, String label, IconData? icon) {
    final isSelected = _selectedFilter == key;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedFilter = key;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected
              ? (widget.isRegularWasteRoute ? const Color(0xFF0D9488) : BulkyColors.primary)
              : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected
                ? (widget.isRegularWasteRoute ? const Color(0xFF0D9488) : BulkyColors.primary)
                : BulkyColors.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 13,
                color: isSelected ? Colors.white : BulkyColors.textSecondary,
              ),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? Colors.white : BulkyColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapPinWidget(ShiftStop stop, bool isSelected) {
    Color pinColor = _getStopBadgeColor(stop.type);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          width: isSelected ? 34 : 26,
          height: isSelected ? 34 : 26,
          decoration: BoxDecoration(
            color: pinColor,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: isSelected ? 2.5 : 1.5),
            boxShadow: [
              BoxShadow(
                color: pinColor.withValues(alpha: isSelected ? 0.6 : 0.3),
                blurRadius: isSelected ? 10 : 4,
                spreadRadius: isSelected ? 3 : 1,
              ),
            ],
          ),
          child: Center(
            child: Text(
              _getStopEmoji(stop.type),
              style: TextStyle(fontSize: isSelected ? 16 : 12),
            ),
          ),
        ),
        if (isSelected)
          Container(
            margin: const EdgeInsets.only(top: 2),
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              stop.sequence == 0 ? 'Xe' : '#${stop.sequence}',
              style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
            ),
          ),
      ],
    );
  }

  String _getStopEmoji(StopType type) {
    switch (type) {
      case StopType.currentVehicle:
        return '🚚';
      case StopType.regularBin:
        return '🗑️';
      case StopType.bulkyWaste:
        return '🛋️';
      case StopType.transferStation:
        return '🏁';
    }
  }

  Color _getStopBadgeColor(StopType type) {
    switch (type) {
      case StopType.currentVehicle:
        return widget.isRegularWasteRoute ? const Color(0xFF0D9488) : BulkyColors.primary;
      case StopType.regularBin:
        return const Color(0xFFD97706); // Amber
      case StopType.bulkyWaste:
        return const Color(0xFF7C3AED); // Purple
      case StopType.transferStation:
        return const Color(0xFF2563EB); // Blue
    }
  }

  Color _getStopBackgroundColor(StopType type) {
    switch (type) {
      case StopType.currentVehicle:
        return BulkyColors.primaryLight.withValues(alpha: 0.1);
      case StopType.regularBin:
        return const Color(0xFFFEF3C7);
      case StopType.bulkyWaste:
        return const Color(0xFFF3E8FF);
      case StopType.transferStation:
        return const Color(0xFFEFF6FF);
    }
  }

  Color _getStopBorderColor(StopType type) {
    switch (type) {
      case StopType.currentVehicle:
        return (widget.isRegularWasteRoute ? const Color(0xFF0D9488) : BulkyColors.primary)
            .withValues(alpha: 0.3);
      case StopType.regularBin:
        return const Color(0xFFF59E0B).withValues(alpha: 0.3);
      case StopType.bulkyWaste:
        return const Color(0xFFA855F7).withValues(alpha: 0.3);
      case StopType.transferStation:
        return const Color(0xFF3B82F6).withValues(alpha: 0.3);
    }
  }
}

/// CustomPainter rendering urban street network, park areas,
/// optimized route polyline, and direction arrows
class _RouteMapCanvasPainter extends CustomPainter {
  final List<ShiftStop> stops;
  final int selectedStopIndex;
  final String filter;

  _RouteMapCanvasPainter({
    required this.stops,
    required this.selectedStopIndex,
    required this.filter,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // 1. Map base background
    final bgPaint = Paint()..color = const Color(0xFFE8EEF5);
    canvas.drawRect(Rect.fromLTWH(0, 0, w, h), bgPaint);

    // 2. Parks & Green Patches
    final parkPaint = Paint()..color = const Color(0xFFDCFCE7);
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.05, h * 0.52, w * 0.22, h * 0.38), const Radius.circular(12)),
      parkPaint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(w * 0.68, h * 0.08, w * 0.25, h * 0.22), const Radius.circular(10)),
      parkPaint,
    );

    // 3. Water body (Canal / Lake)
    final waterPaint = Paint()..color = const Color(0xFFE0F2FE);
    final waterPath = Path();
    waterPath.moveTo(w * 0.48, 0);
    waterPath.quadraticBezierTo(w * 0.52, h * 0.45, w * 0.48, h);
    waterPath.lineTo(w * 0.55, h);
    waterPath.quadraticBezierTo(w * 0.58, h * 0.45, w * 0.55, 0);
    waterPath.close();
    canvas.drawPath(waterPath, waterPaint);

    // 4. Urban Road Network
    final roadBorderPaint = Paint()
      ..color = const Color(0xFFCBD5E1)
      ..strokeWidth = 14
      ..style = PaintingStyle.stroke;

    final roadSurfacePaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 11
      ..style = PaintingStyle.stroke;

    // Primary thoroughfares
    final roadAPath = Path();
    roadAPath.moveTo(0, h * 0.28);
    roadAPath.lineTo(w, h * 0.28);
    canvas.drawPath(roadAPath, roadBorderPaint);
    canvas.drawPath(roadAPath, roadSurfacePaint);

    final roadBPath = Path();
    roadBPath.moveTo(w * 0.46, 0);
    roadBPath.lineTo(w * 0.46, h);
    canvas.drawPath(roadBPath, roadBorderPaint);
    canvas.drawPath(roadBPath, roadSurfacePaint);

    final roadCPath = Path();
    roadCPath.moveTo(0, h * 0.58);
    roadCPath.lineTo(w, h * 0.58);
    canvas.drawPath(roadCPath, roadBorderPaint);
    canvas.drawPath(roadCPath, roadSurfacePaint);

    // Secondary streets
    final minorRoadPaint = Paint()
      ..color = const Color(0xFFF8FAFC)
      ..strokeWidth = 7
      ..style = PaintingStyle.stroke;

    final roadDPath = Path();
    roadDPath.moveTo(w * 0.78, 0);
    roadDPath.lineTo(w * 0.78, h);
    canvas.drawPath(roadDPath, minorRoadPaint);

    final roadEPath = Path();
    roadEPath.moveTo(0, h * 0.75);
    roadEPath.lineTo(w, h * 0.75);
    canvas.drawPath(roadEPath, minorRoadPaint);

    // 5. Street Labels
    _drawStreetLabel(canvas, 'Đ. CẦU GIẤY', Offset(w * 0.18, h * 0.28 - 10));
    _drawStreetLabel(canvas, 'TRẦN THÁI TÔNG', Offset(w * 0.46 + 4, h * 0.12));
    _drawStreetLabel(canvas, 'PHỐ DUY TÂN', Offset(w * 0.60, h * 0.58 - 10));

    // 6. Draw Directional Route Polyline connecting stops
    final routePoints = stops.map((s) => Offset(s.relativeX * w, s.relativeY * h)).toList();

    if (routePoints.length >= 2) {
      final glowPaint = Paint()
        ..color = BulkyColors.primary.withValues(alpha: 0.25)
        ..strokeWidth = 10
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;

      final routePath = Path();
      routePath.moveTo(routePoints[0].dx, routePoints[0].dy);
      for (int i = 1; i < routePoints.length; i++) {
        routePath.lineTo(routePoints[i].dx, routePoints[i].dy);
      }
      canvas.drawPath(routePath, glowPaint);

      // Main route polyline
      final routePaint = Paint()
        ..color = BulkyColors.primary
        ..strokeWidth = 4.5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;
      canvas.drawPath(routePath, routePaint);

      // Draw direction arrows along each segment
      for (int i = 0; i < routePoints.length - 1; i++) {
        _drawDirectionArrow(canvas, routePoints[i], routePoints[i + 1]);
      }
    }
  }

  void _drawStreetLabel(Canvas canvas, String text, Offset offset) {
    final textSpan = TextSpan(
      text: text,
      style: const TextStyle(
        color: Color(0xFF64748B),
        fontSize: 9,
        fontWeight: FontWeight.bold,
        letterSpacing: 0.5,
      ),
    );
    final textPainter = TextPainter(
      text: textSpan,
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(canvas, offset);
  }

  void _drawDirectionArrow(Canvas canvas, Offset p1, Offset p2) {
    final mid = Offset((p1.dx + p2.dx) / 2, (p1.dy + p2.dy) / 2);
    final angle = math.atan2(p2.dy - p1.dy, p2.dx - p1.dx);

    const arrowSize = 7.0;
    final arrowPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    final arrowPath = Path();
    arrowPath.moveTo(
      mid.dx + arrowSize * math.cos(angle),
      mid.dy + arrowSize * math.sin(angle),
    );
    arrowPath.lineTo(
      mid.dx + arrowSize * math.cos(angle + 2.5),
      mid.dy + arrowSize * math.sin(angle + 2.5),
    );
    arrowPath.lineTo(
      mid.dx + arrowSize * math.cos(angle - 2.5),
      mid.dy + arrowSize * math.sin(angle - 2.5),
    );
    arrowPath.close();

    canvas.drawPath(arrowPath, arrowPaint);
  }

  @override
  bool shouldRepaint(covariant _RouteMapCanvasPainter oldDelegate) {
    return oldDelegate.selectedStopIndex != selectedStopIndex ||
        oldDelegate.filter != filter ||
        oldDelegate.stops != stops;
  }
}
