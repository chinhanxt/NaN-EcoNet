/// Enum defining user roles in the Smartbin bulky waste management platform.
enum UserRole {
  citizen,
  operator,
  driver;

  String get displayName {
    switch (this) {
      case UserRole.citizen:
        return 'Công dân';
      case UserRole.operator:
        return 'Điều phối viên';
      case UserRole.driver:
        return 'Tài xế thu gom';
    }
  }

  String get badgeLabel {
    switch (this) {
      case UserRole.citizen:
        return 'Hộ gia đình';
      case UserRole.operator:
        return 'Tổ điều hành VSMT';
      case UserRole.driver:
        return 'Đội xe cơ động';
    }
  }
}

/// Model representing a logged-in user (citizen, operator, or driver) in Smartbin Bulky mobile app.
class CitizenUser {
  final String id;
  final String name;
  final String phone;
  final String email;
  final String defaultAddress;
  final String householdId;
  final int rewardPoints;
  final UserRole role;
  final String? staffCode;
  final String? vehiclePlate;
  final String? department;

  const CitizenUser({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    required this.defaultAddress,
    required this.householdId,
    this.rewardPoints = 120,
    this.role = UserRole.citizen,
    this.staffCode,
    this.vehiclePlate,
    this.department,
  });

  bool get isCitizen => role == UserRole.citizen;
  bool get isOperator => role == UserRole.operator;
  bool get isDriver => role == UserRole.driver;

  CitizenUser copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    String? defaultAddress,
    String? householdId,
    int? rewardPoints,
    UserRole? role,
    String? staffCode,
    String? vehiclePlate,
    String? department,
  }) {
    return CitizenUser(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      defaultAddress: defaultAddress ?? this.defaultAddress,
      householdId: householdId ?? this.householdId,
      rewardPoints: rewardPoints ?? this.rewardPoints,
      role: role ?? this.role,
      staffCode: staffCode ?? this.staffCode,
      vehiclePlate: vehiclePlate ?? this.vehiclePlate,
      department: department ?? this.department,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'email': email,
        'defaultAddress': defaultAddress,
        'householdId': householdId,
        'rewardPoints': rewardPoints,
        'role': role.name,
        'staffCode': staffCode,
        'vehiclePlate': vehiclePlate,
        'department': department,
      };

  factory CitizenUser.fromJson(Map<String, dynamic> json) => CitizenUser(
        id: json['id'] as String? ?? 'user-citizen-01',
        name: json['name'] as String? ?? 'Nguyễn Văn An',
        phone: json['phone'] as String? ?? '0912.345.678',
        email: json['email'] as String? ?? 'nguyenvanan@gmail.com',
        defaultAddress: json['defaultAddress'] as String? ??
            '123 Nguyễn Thị Minh Khai, P. Bến Nghé, Q.1, TP.HCM',
        householdId: json['householdId'] as String? ?? 'HH-78921',
        rewardPoints: (json['rewardPoints'] as num?)?.toInt() ?? 120,
        role: UserRole.values.firstWhere(
          (r) => r.name == json['role'],
          orElse: () => UserRole.citizen,
        ),
        staffCode: json['staffCode'] as String?,
        vehiclePlate: json['vehiclePlate'] as String?,
        department: json['department'] as String?,
      );

  // Predefined demo accounts
  static const CitizenUser demoCitizen = CitizenUser(
    id: 'user-citizen-01',
    name: 'Nguyễn Văn An',
    phone: '0912.345.678',
    email: 'nguyenvanan@gmail.com',
    defaultAddress: '123 Nguyễn Thị Minh Khai, P. Bến Nghé, Q.1, TP.HCM',
    householdId: 'HH-78921',
    rewardPoints: 120,
    role: UserRole.citizen,
    department: 'Cư dân Quận 1',
  );

  static const CitizenUser demoOperator = CitizenUser(
    id: 'user-operator-01',
    name: 'Trần Thị Mai',
    phone: '0908.111.222',
    email: 'mai.tran@smartbin.vn',
    defaultAddress: 'Trung tâm Điều hành VSMT Q.1, 45 Lê Duẩn, TP.HCM',
    householdId: 'STAFF-DP01',
    staffCode: 'NV-DP01',
    department: 'Tổ Điều Phối Thu Gom Rác Cồng Kềnh Q.1',
    rewardPoints: 500,
    role: UserRole.operator,
  );

  static const CitizenUser demoDriver = CitizenUser(
    id: 'user-driver-01',
    name: 'Nguyễn Văn Hùng',
    phone: '0909.123.456',
    email: 'hung.nguyen@smartbin.vn',
    defaultAddress: 'Trạm Xe Thu Gom Cơ Động 24/7, Q.1, TP.HCM',
    householdId: 'STAFF-TX01',
    staffCode: 'TX-51C889',
    vehiclePlate: '51C-889.21',
    department: 'Đội Xe Thu Gom Chuyên Dụng 2.5T Q.1',
    rewardPoints: 350,
    role: UserRole.driver,
  );

  // Default demo user maintains backwards compatibility
  static const CitizenUser demoUser = demoCitizen;
}
