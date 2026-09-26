import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/domain/models/bulky_order.dart';
import '../../../core/theme/bulky_colors.dart';

/// Represents a collection stop on the driver's shift route
enum StopType {
  currentVehicle,
  iotBin,
  bulkyWaste,
  transferStation,
}

class ShiftStop {
  final String id;
  final int sequence;
  final String name;
  final String address;
  final StopType type;
  final String? fillLevel;
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
    this.fillLevel,
    this.itemDetails,
    required this.distanceText,
    required this.etaText,
    required this.directionInstruction,
    required this.relativeX,
    required this.relativeY,
    this.isCompleted = false,
  });
}

/// Interactive Mockup Map displaying the driver's shift route,
/// containing both IoT public smart bins and bulky waste pickup spots
/// with optimized directional paths and turn-by-turn guidance.
class DriverRouteMapCard extends StatefulWidget {
  final String vehiclePlate;
  final List<BulkyOrder> activeOrders;

  const DriverRouteMapCard({
    super.key,
    required this.vehiclePlate,
    this.activeOrders = const [],
  });

  @override
  State<DriverRouteMapCard> createState() => _DriverRouteMapCardState();
}

class _DriverRouteMapCardState extends State<DriverRouteMapCard> {
  int _selectedStopIndex = 1; // Default to first actual pickup stop
  String _selectedFilter = 'all'; // 'all', 'iot', 'bulky'
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
        oldWidget.vehiclePlate != widget.vehiclePlate) {
      _initStops();
    }
  }

  void _initStops() {
    // Bulky order 1 details
    String bulky1Name = 'Rác cồng kềnh: Sofa 3 chỗ & Bàn trà';
    String bulky1Addr = '120 Đường Cầu Giấy, Quan Hoa';
    if (widget.activeOrders.isNotEmpty) {
      final o = widget.activeOrders.first;
      bulky1Name = 'Rác cồng kềnh: ${o.items.map((i) => i.displayName).take(2).join(', ')}';
      bulky1Addr = o.address;
    }

    // Bulky order 2 details
    String bulky2Name = 'Rác cồng kềnh: Tủ gỗ ép & Giường ngủ';
    String bulky2Addr = '45 Phố Duy Tân, Dịch Vọng Hậu';
    if (widget.activeOrders.length > 1) {
      final o = widget.activeOrders[1];
      bulky2Name = 'Rác cồng kềnh: ${o.items.map((i) => i.displayName).take(2).join(', ')}';
      bulky2Addr = o.address;
    }

    _stops = [
      ShiftStop(
        id: 'start_truck',
        sequence: 0,
        name: 'Vị trí xe ${widget.vehiclePlate}',
        address: 'Bãi đỗ xe đội VSMT Cầu Giấy (Điểm xuất phát)',
        type: StopType.currentVehicle,
        distanceText: '0 km',
        etaText: 'Bắt đầu',
        directionInstruction: 'Xuất phát từ bãi xe, rẽ phải vào đường Cầu Giấy',
        relativeX: 0.12,
        relativeY: 0.28,
      ),
      const ShiftStop(
        id: 'tb_01',
        sequence: 1,
        name: 'Thùng rác IoT #TB-01 (Mức đầy 92%)',
        address: 'Số 68 Cầu Giấy, Quan Hoa',
        type: StopType.iotBin,
        fillLevel: '92% • Bốc mùi cấp 2',
        distanceText: '450 m',
        etaText: '~2 phút',
        directionInstruction: 'Đi thẳng 400m trên đường Cầu Giấy, rẽ phải vào Ngõ 68',
        relativeX: 0.36,
        relativeY: 0.28,
      ),
      ShiftStop(
        id: 'bulky_01',
        sequence: 2,
        name: bulky1Name,
        address: bulky1Addr,
        type: StopType.bulkyWaste,
        itemDetails: 'Hộ dân đã tập kết vỉa hè • Cần 2 nhân công bốc dỡ',
        distanceText: '1.2 km',
        etaText: '~5 phút',
        directionInstruction: 'Từ ngõ 68 quay ra trục chính, đi tiếp 800m hướng ngã tư Trần Thái Tông',
        relativeX: 0.46,
        relativeY: 0.58,
      ),
      const ShiftStop(
        id: 'tb_04',
        sequence: 3,
        name: 'Thùng rác IoT #TB-04 (Mức đầy 85%)',
        address: 'Ngã tư Trần Thái Tông - Xuân Thủy',
        type: StopType.iotBin,
        fillLevel: '85% • Cần dọn sớm',
        distanceText: '1.8 km',
        etaText: '~8 phút',
        directionInstruction: 'Rẽ trái vào đường Trần Thái Tông, thùng rác đặt trước trạm xe buýt',
        relativeX: 0.65,
        relativeY: 0.58,
      ),
      ShiftStop(
        id: 'bulky_02',
        sequence: 4,
        name: bulky2Name,
        address: bulky2Addr,
        type: StopType.bulkyWaste,
        itemDetails: 'Tầng 1 sảnh chung cư • Có bảo vệ hỗ trợ hướng dẫn xe đỗ',
        distanceText: '2.5 km',
        etaText: '~12 phút',
        directionInstruction: 'Đi thẳng phố Duy Tân 600m, rẽ vào sảnh tòa nhà',
        relativeX: 0.78,
        relativeY: 0.32,
      ),
      const ShiftStop(
        id: 'end_station',
        sequence: 5,
        name: 'Trạm trung chuyển rác thải Cầu Giấy',
        address: 'Khu liên hiệp xử lý chất thải Nam Sơn / Điểm tập kết Q. Cầu Giấy',
        type: StopType.transferStation,
        distanceText: '5.8 km',
        etaText: '~25 phút',
        directionInstruction: 'Chạy thẳng hướng Phạm Hùng ra đường gom vành đai 3 để đổ tải',
        relativeX: 0.90,
        relativeY: 0.75,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final selectedStop = _stops[_selectedStopIndex.clamp(0, _stops.length - 1)];

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
                    const Row(
                      children: [
                        Text('🗺️ ', style: TextStyle(fontSize: 18)),
                        Text(
                          'LỘ TRÌNH THU GOM CA TRỰC',
                          style: TextStyle(
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
                        color: BulkyColors.primaryLight.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        '⚡ AI Tối Ưu',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: BulkyColors.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Ca sáng: 07:30 - 11:30 • Tuyến liên hoàn 5.8 km • ~38 phút di chuyển',
                  style: TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
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
              children: [
                _buildFilterChip('all', 'Tất cả (5 điểm)', Icons.alt_route_rounded),
                _buildFilterChip('iot', '🗑️ Thùng rác IoT (2)', null),
                _buildFilterChip('bulky', '🛋️ Rác cồng kềnh (2)', null),
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
                    if (_selectedFilter == 'iot' && stop.type != StopType.iotBin && stop.type != StopType.currentVehicle) {
                      return const SizedBox.shrink();
                    }
                    if (_selectedFilter == 'bulky' && stop.type != StopType.bulkyWaste && stop.type != StopType.currentVehicle) {
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
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('🚚 Xe', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold)),
                          SizedBox(width: 6),
                          Text('➔', style: TextStyle(fontSize: 9, color: BulkyColors.primary, fontWeight: FontWeight.bold)),
                          SizedBox(width: 6),
                          Text('🗑️ Thùng IoT', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFFD97706))),
                          SizedBox(width: 6),
                          Text('➔', style: TextStyle(fontSize: 9, color: BulkyColors.primary, fontWeight: FontWeight.bold)),
                          SizedBox(width: 6),
                          Text('🛋️ Cồng kềnh', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF7C3AED))),
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
                              : selectedStop.sequence == 5
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

                  // Detail / Telemetry Badge
                  if (selectedStop.fillLevel != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.sensors_rounded, size: 13, color: Color(0xFFD97706)),
                          const SizedBox(width: 5),
                          Text(
                            'Cảm biến IoT: ${selectedStop.fillLevel}',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                          ),
                        ],
                      ),
                    ),

                  if (selectedStop.itemDetails != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3E8FF),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFA855F7).withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.inventory_2_outlined, size: 13, color: Color(0xFF7C3AED)),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              selectedStop.itemDetails!,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF6D28D9)),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Turn-by-turn Navigation Instruction
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: BulkyColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.turn_right_rounded, size: 18, color: BulkyColors.primary),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            selectedStop.directionInstruction,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: BulkyColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Action Buttons for this stop
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('✓ Đang mở bản đồ Google Maps chỉ đường tới ${selectedStop.address}'),
                                backgroundColor: BulkyColors.primary,
                                duration: const Duration(seconds: 3),
                              ),
                            );
                          },
                          icon: const Icon(Icons.navigation_rounded, size: 15),
                          label: const Text('Mở Google Maps', style: TextStyle(fontSize: 12)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: BulkyColors.primary,
                            side: const BorderSide(color: BulkyColors.primary),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            setState(() {
                              _isNavigating = true;
                              if (_selectedStopIndex < _stops.length - 1) {
                                _selectedStopIndex++;
                              }
                            });
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('✓ Đã chọn điểm thu gom tiếp theo: ${_stops[_selectedStopIndex].name}'),
                                backgroundColor: BulkyColors.primary,
                              ),
                            );
                          },
                          icon: const Icon(Icons.play_arrow_rounded, size: 16),
                          label: Text(_isNavigating ? 'Tiếp tục lộ trình' : 'Bắt đầu di chuyển', style: const TextStyle(fontSize: 12)),
                          style: ElevatedButton.styleFrom(
                            minimumSize: const Size(100, 36),
                            backgroundColor: BulkyColors.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            elevation: 0,
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

          // 5. Timeline / Waypoints List (Quick Select Stops)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.list_alt_rounded, size: 15, color: BulkyColors.textSecondary),
                    SizedBox(width: 4),
                    Text(
                      'Danh sách 5 điểm dừng tối ưu trên tuyến:',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: BulkyColors.textSecondary),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ..._stops.asMap().entries.map((entry) {
                  final index = entry.key;
                  final stop = entry.value;
                  final isSelected = index == _selectedStopIndex;

                  return InkWell(
                    onTap: () {
                      setState(() {
                        _selectedStopIndex = index;
                      });
                    },
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? BulkyColors.primaryLight.withValues(alpha: 0.12) : BulkyColors.background,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected ? BulkyColors.primary : BulkyColors.border,
                          width: isSelected ? 1.5 : 1.0,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 22,
                            height: 22,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: isSelected ? BulkyColors.primary : BulkyColors.border,
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '${stop.sequence}',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: isSelected ? Colors.white : BulkyColors.textSecondary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(_getStopEmoji(stop.type), style: const TextStyle(fontSize: 14)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              stop.name,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                color: isSelected ? BulkyColors.primary : BulkyColors.textPrimary,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            stop.distanceText,
                            style: const TextStyle(fontSize: 11, color: BulkyColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String filterKey, String label, IconData? icon) {
    final isSelected = _selectedFilter == filterKey;
    return ChoiceChip(
      avatar: icon != null ? Icon(icon, size: 14, color: isSelected ? Colors.white : BulkyColors.textSecondary) : null,
      label: Text(label),
      selected: isSelected,
      selectedColor: BulkyColors.primary,
      backgroundColor: BulkyColors.background,
      labelStyle: TextStyle(
        fontSize: 11,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        color: isSelected ? Colors.white : BulkyColors.textSecondary,
      ),
      side: BorderSide(color: isSelected ? BulkyColors.primary : BulkyColors.border),
      onSelected: (selected) {
        if (selected) {
          setState(() {
            _selectedFilter = filterKey;
          });
        }
      },
    );
  }

  Widget _buildMapPinWidget(ShiftStop stop, bool isSelected) {
    Color pinColor = _getStopBadgeColor(stop.type);
    String emoji = _getStopEmoji(stop.type);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: isSelected ? 36 : 28,
          height: isSelected ? 36 : 28,
          decoration: BoxDecoration(
            color: pinColor,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: isSelected ? 2.5 : 1.5),
            boxShadow: [
              BoxShadow(
                color: pinColor.withValues(alpha: 0.5),
                blurRadius: isSelected ? 8 : 4,
                spreadRadius: isSelected ? 2 : 0,
              ),
            ],
          ),
          alignment: Alignment.center,
          child: Text(
            emoji,
            style: TextStyle(fontSize: isSelected ? 16 : 12),
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
      case StopType.iotBin:
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
        return BulkyColors.primary;
      case StopType.iotBin:
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
      case StopType.iotBin:
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
        return BulkyColors.primary.withValues(alpha: 0.3);
      case StopType.iotBin:
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
      ..strokeWidth = 12
      ..style = PaintingStyle.stroke;

    final minorRoadPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 7
      ..style = PaintingStyle.stroke;

    final dividerPaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    // Road A: Đường Cầu Giấy (Horizontal upper)
    final roadAPath = Path();
    roadAPath.moveTo(0, h * 0.28);
    roadAPath.lineTo(w, h * 0.28);
    canvas.drawPath(roadAPath, roadBorderPaint);
    canvas.drawPath(roadAPath, roadSurfacePaint);
    canvas.drawPath(roadAPath, dividerPaint);

    // Road B: Trần Thái Tông (Vertical mid)
    final roadBPath = Path();
    roadBPath.moveTo(w * 0.46, 0);
    roadBPath.lineTo(w * 0.46, h);
    canvas.drawPath(roadBPath, roadBorderPaint);
    canvas.drawPath(roadBPath, roadSurfacePaint);
    canvas.drawPath(roadBPath, dividerPaint);

    // Road C: Duy Tân (Horizontal mid-lower)
    final roadCPath = Path();
    roadCPath.moveTo(w * 0.25, h * 0.58);
    roadCPath.lineTo(w, h * 0.58);
    canvas.drawPath(roadCPath, roadBorderPaint);
    canvas.drawPath(roadCPath, roadSurfacePaint);
    canvas.drawPath(roadCPath, dividerPaint);

    // Road D: Phố phụ & Ngõ
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

    // 6. Draw Directional Route Polyline connecting stops 0 -> 1 -> 2 -> 3 -> 4 -> 5
    final routePoints = stops.map((s) => Offset(s.relativeX * w, s.relativeY * h)).toList();

    if (routePoints.length >= 2) {
      // Glow underlay
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
