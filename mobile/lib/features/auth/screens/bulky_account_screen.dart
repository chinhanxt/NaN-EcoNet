import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/bulky_colors.dart';
import '../models/citizen_user.dart';
import '../providers/auth_provider.dart';

/// Screen for citizen profile, staff management, role switching, login and logout.
class BulkyAccountScreen extends StatefulWidget {
  const BulkyAccountScreen({super.key});

  @override
  State<BulkyAccountScreen> createState() => _BulkyAccountScreenState();
}

class _BulkyAccountScreenState extends State<BulkyAccountScreen> {
  final _phoneController = TextEditingController(text: '0912.345.678');
  final _passwordController = TextEditingController(text: '123456');
  bool _obscurePassword = true;

  @override
  void dispose() {
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogout(BuildContext context, AuthProvider authProvider) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.logout_rounded, color: BulkyColors.error, size: 24),
            SizedBox(width: 8),
            Text('Đăng Xuất', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(
          'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng Smartbin Bulky?',
          style: TextStyle(fontSize: 14, color: BulkyColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Hủy', style: TextStyle(color: BulkyColors.textSecondary)),
          ),
          ElevatedButton(
            key: const Key('confirm_logout_button'),
            style: ElevatedButton.styleFrom(
              backgroundColor: BulkyColors.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () async {
              Navigator.pop(dialogCtx);
              await authProvider.logout();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Đã đăng xuất tài khoản thành công.'),
                    backgroundColor: BulkyColors.textPrimary,
                    duration: Duration(seconds: 2),
                  ),
                );
              }
            },
            child: const Text('Đăng xuất'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;
    final isAuthenticated = auth.isAuthenticated;

    return Scaffold(
      backgroundColor: BulkyColors.background,
      appBar: AppBar(
        title: Text(
          isAuthenticated
              ? 'Tài Khoản ${user?.isCitizen == true ? "Công Dân" : (user?.isOperator == true ? "Điều Phối Viên" : "Tài Xế Thu Gom")}'
              : 'Đăng Nhập',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        elevation: 0,
        backgroundColor: BulkyColors.surface,
        foregroundColor: BulkyColors.textPrimary,
        centerTitle: false,
      ),
      body: auth.isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: isAuthenticated && user != null
                  ? _buildLoggedInView(context, auth, user)
                  : _buildLoggedOutView(context, auth),
            ),
    );
  }

  Widget _buildLoggedInView(BuildContext context, AuthProvider auth, CitizenUser user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 1. Quick Role Switcher Banner (Testing 3-in-1 tool)
        _buildRoleSwitcherCard(context, auth, user),
        const SizedBox(height: 16),

        // 2. User Profile Card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: BulkyColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: BulkyColors.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 32,
                backgroundColor: _getRoleColor(user.role).withValues(alpha: 0.15),
                child: Icon(
                  _getRoleIcon(user.role),
                  size: 32,
                  color: _getRoleColor(user.role),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            user.name,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: BulkyColors.textPrimary,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.verified, size: 16, color: BulkyColors.primary),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: _getRoleColor(user.role).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        user.isCitizen
                            ? 'Hộ gia đình • Hạng Bạc'
                            : (user.isOperator
                                ? '👮 ĐIỀU PHỐI VIÊN ĐÔ THỊ • Tổ VSMT Q.1'
                                : '🚚 TÀI XẾ THU GOM CHUYÊN DỤNG • Đội Xe 2.5T'),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: _getRoleColor(user.role),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user.phone,
                      style: const TextStyle(
                        fontSize: 13,
                        color: BulkyColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // 3. Role-specific Information Cards
        if (user.isCitizen) ...[
          _buildCitizenSummary(user),
        ] else if (user.isOperator) ...[
          _buildOperatorSummary(user),
        ] else if (user.isDriver) ...[
          _buildDriverSummary(user),
        ],
        const SizedBox(height: 16),

        // 4. Registered Service Location / Workplace Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: BulkyColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: BulkyColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    user.isCitizen ? Icons.location_on_outlined : Icons.business_outlined,
                    size: 18,
                    color: BulkyColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    user.isCitizen ? 'Địa chỉ thu gom mặc định' : 'Trụ sở & Đơn vị trực thuộc',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: BulkyColors.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                user.defaultAddress,
                style: const TextStyle(
                  fontSize: 13,
                  color: BulkyColors.textPrimary,
                  height: 1.4,
                ),
              ),
              if (user.department != null) ...[
                const SizedBox(height: 4),
                Text(
                  user.department!,
                  style: const TextStyle(
                    fontSize: 12,
                    color: BulkyColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        // 5. Utility Options
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: BulkyColors.border),
          ),
          child: Material(
            color: BulkyColors.surface,
            borderRadius: BorderRadius.circular(14),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.support_agent_rounded, color: BulkyColors.primary),
                  title: const Text('Tổng đài hỗ trợ Smartbin', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: const Text('1900 6868 (Miễn phí 24/7)', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: BulkyColors.textSecondary),
                  onTap: () {},
                ),
                const Divider(height: 1, indent: 56),
                ListTile(
                  leading: const Icon(Icons.policy_outlined, color: BulkyColors.primary),
                  title: const Text('Chính sách thu gom rác cồng kềnh', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: const Text('Biểu cước niêm yết & Cam kết dung sai ±15%', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: BulkyColors.textSecondary),
                  onTap: () {},
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),

        // 6. Logout Button
        ElevatedButton.icon(
          key: const Key('logout_button'),
          onPressed: () => _handleLogout(context, auth),
          icon: const Icon(Icons.logout_rounded, size: 18),
          label: const Text('Đăng Xuất Khỏi Thiết Bị'),
          style: ElevatedButton.styleFrom(
            backgroundColor: BulkyColors.error.withValues(alpha: 0.1),
            foregroundColor: BulkyColors.error,
            elevation: 0,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: BulkyColors.error.withValues(alpha: 0.3)),
            ),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildRoleSwitcherCard(
    BuildContext context,
    AuthProvider auth,
    CitizenUser user,
  ) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: BulkyColors.primaryLight.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: BulkyColors.primary.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.swap_horiz_rounded, size: 20, color: BulkyColors.primary),
              SizedBox(width: 8),
              Text(
                'Chuyển đổi vai trò kiểm thử',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: BulkyColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Chọn 1 trong 3 tài khoản để test toàn bộ luồng thu gom cồng kềnh:',
            style: TextStyle(fontSize: 12, color: BulkyColors.textSecondary),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildRoleSwitchButton(
                  key: const Key('switch_role_citizen_button'),
                  label: 'Công dân',
                  sub: 'An',
                  isSelected: user.isCitizen,
                  color: BulkyColors.primary,
                  onTap: () => auth.switchRole(UserRole.citizen),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _buildRoleSwitchButton(
                  key: const Key('switch_role_operator_button'),
                  label: 'Điều phối',
                  sub: 'Mai',
                  isSelected: user.isOperator,
                  color: const Color(0xFF6366F1),
                  onTap: () => auth.switchRole(UserRole.operator),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _buildRoleSwitchButton(
                  key: const Key('switch_role_driver_button'),
                  label: 'Tài xế',
                  sub: 'Hùng',
                  isSelected: user.isDriver,
                  color: const Color(0xFFEA580C),
                  onTap: () => auth.switchRole(UserRole.driver),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRoleSwitchButton({
    required Key key,
    required String label,
    required String sub,
    required bool isSelected,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      key: key,
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color : BulkyColors.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? color : BulkyColors.border,
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: isSelected ? Colors.white : BulkyColors.textPrimary,
              ),
            ),
            Text(
              sub,
              style: TextStyle(
                fontSize: 11,
                color: isSelected ? Colors.white.withValues(alpha: 0.9) : BulkyColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCitizenSummary(CitizenUser user) {
    return Row(
      children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: BulkyColors.successBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: BulkyColors.success.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.home_work_outlined, size: 18, color: BulkyColors.success),
                    SizedBox(width: 6),
                    Text(
                      'Mã hộ gia đình',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: BulkyColors.success,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  user.householdId,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: BulkyColors.primaryLight.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: BulkyColors.primary.withValues(alpha: 0.3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.eco_rounded, size: 18, color: BulkyColors.primary),
                    SizedBox(width: 6),
                    Text(
                      'Ví Điểm Xanh cư dân',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: BulkyColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Hạng Bạc - ${user.rewardPoints} Điểm Xanh',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: BulkyColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildOperatorSummary(CitizenUser user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF6366F1).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.3)),
          ),
          child: const Row(
            children: [
              Icon(Icons.admin_panel_settings_rounded, size: 18, color: Color(0xFF6366F1)),
              SizedBox(width: 8),
              Text(
                '👮 ĐIỀU PHỐI VIÊN ĐÔ THỊ • Cổng Quản Trị VSMT',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF6366F1),
                ),
              ),
            ],
          ),
        ),
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFEEF2FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.badge_outlined, size: 18, color: Color(0xFF6366F1)),
                        SizedBox(width: 6),
                        Text(
                          'Mã điều phối viên',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF6366F1),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      user.staffCode ?? 'NV-DP01',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: BulkyColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: BulkyColors.successBg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: BulkyColors.success.withValues(alpha: 0.3)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.timelapse_rounded, size: 18, color: BulkyColors.success),
                        SizedBox(width: 6),
                        Text(
                          'Ca trực điều hành',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: BulkyColors.success,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 6),
                    Text(
                      'Ca Sáng (06:00-14:00)',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: BulkyColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDriverSummary(CitizenUser user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFEA580C).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFEA580C).withValues(alpha: 0.3)),
          ),
          child: const Row(
            children: [
              Icon(Icons.local_shipping_rounded, size: 18, color: Color(0xFFEA580C)),
              SizedBox(width: 8),
              Text(
                '🚚 TÀI XẾ THU GOM CHUYÊN DỤNG • Đội Xe Hiện Trường',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFEA580C),
                ),
              ),
            ],
          ),
        ),
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFEA580C).withValues(alpha: 0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.directions_car_rounded, size: 18, color: Color(0xFFEA580C)),
                        SizedBox(width: 6),
                        Text(
                          'Biển số xe tải',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFEA580C),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      user.vehiclePlate ?? '51C-889.21',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: BulkyColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: BulkyColors.primaryLight.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: BulkyColors.primary.withValues(alpha: 0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.badge_outlined, size: 18, color: BulkyColors.primary),
                        SizedBox(width: 6),
                        Text(
                          'Mã tài xế',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: BulkyColors.primary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      user.staffCode ?? 'TX-51C889',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: BulkyColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildLoggedOutView(BuildContext context, AuthProvider auth) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 20),
        Center(
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: BulkyColors.primaryLight.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.recycling_rounded,
              size: 40,
              color: BulkyColors.primary,
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Đăng Nhập Tài Khoản Công Dân',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: BulkyColors.textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
        const Text(
          'Đăng nhập để theo dõi lịch thu gom rác cồng kềnh, điều phối xe hoặc thực hiện lộ trình thu gom.',
          style: TextStyle(fontSize: 13, color: BulkyColors.textSecondary, height: 1.4),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),

        // Form fields
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: BulkyColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: BulkyColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                key: const Key('login_phone_input'),
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Số điện thoại',
                  prefixIcon: Icon(Icons.phone_iphone_rounded, size: 20),
                  border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(10))),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                key: const Key('login_password_input'),
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  labelText: 'Mật khẩu',
                  prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                  border: const OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(10))),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword ? Icons.visibility_off : Icons.visibility,
                      size: 20,
                    ),
                    onPressed: () {
                      setState(() {
                        _obscurePassword = !_obscurePassword;
                      });
                    },
                  ),
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                key: const Key('login_submit_button'),
                onPressed: () async {
                  final success = await auth.login(
                    _phoneController.text,
                    _passwordController.text,
                  );
                  if (context.mounted && success) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Xin chào, ${auth.currentUser?.name}! Đăng nhập thành công.'),
                        backgroundColor: BulkyColors.success,
                      ),
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  backgroundColor: BulkyColors.primary,
                  foregroundColor: Colors.white,
                ),
                child: const Text('Đăng Nhập', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(height: 16),
              const Divider(height: 1, color: BulkyColors.border),
              const SizedBox(height: 12),
              const Text(
                'Tài khoản mẫu để kiểm thử:',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: BulkyColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),

              // 1. Citizen demo button
              OutlinedButton.icon(
                key: const Key('login_quick_demo_button'),
                onPressed: () async {
                  await auth.loginDemo();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Đã đăng nhập tài khoản mẫu: Công dân (Nguyễn Văn An)'),
                        backgroundColor: BulkyColors.primary,
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.person_rounded, size: 18),
                label: const Text('1. Công dân: Nguyễn Văn An (0912.345.678)'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  side: const BorderSide(color: BulkyColors.primary),
                  foregroundColor: BulkyColors.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  alignment: Alignment.centerLeft,
                ),
              ),
              const SizedBox(height: 8),

              // 2. Operator demo button
              OutlinedButton.icon(
                key: const Key('login_quick_operator_button'),
                onPressed: () async {
                  await auth.loginOperator();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Đã đăng nhập tài khoản mẫu: Điều phối viên (Trần Thị Mai)'),
                        backgroundColor: Color(0xFF6366F1),
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.admin_panel_settings_rounded, size: 18),
                label: const Text('2. Điều phối: Trần Thị Mai (NV-DP01)'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  side: const BorderSide(color: Color(0xFF6366F1)),
                  foregroundColor: const Color(0xFF6366F1),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  alignment: Alignment.centerLeft,
                ),
              ),
              const SizedBox(height: 8),

              // 3. Driver demo button
              OutlinedButton.icon(
                key: const Key('login_quick_driver_button'),
                onPressed: () async {
                  await auth.loginDriver();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Đã đăng nhập tài khoản mẫu: Tài xế xe tải thu gom (Nguyễn Văn Hùng)'),
                        backgroundColor: Color(0xFFEA580C),
                      ),
                    );
                  }
                },
                icon: const Icon(Icons.local_shipping_rounded, size: 18),
                label: const Text('3. Tài xế: Nguyễn Văn Hùng (Xe 51C-889.21)'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  side: const BorderSide(color: Color(0xFFEA580C)),
                  foregroundColor: const Color(0xFFEA580C),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  alignment: Alignment.centerLeft,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Color _getRoleColor(UserRole role) {
    switch (role) {
      case UserRole.citizen:
        return BulkyColors.primary;
      case UserRole.operator:
        return const Color(0xFF6366F1);
      case UserRole.driver:
        return const Color(0xFFEA580C);
    }
  }

  IconData _getRoleIcon(UserRole role) {
    switch (role) {
      case UserRole.citizen:
        return Icons.person_rounded;
      case UserRole.operator:
        return Icons.admin_panel_settings_rounded;
      case UserRole.driver:
        return Icons.local_shipping_rounded;
    }
  }
}
