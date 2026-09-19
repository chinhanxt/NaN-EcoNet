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

/// Specialization of driver: regular urban waste vs on-demand bulky waste
enum DriverWasteType {
  regular, // Thu gom rác thông dụng / sinh hoạt (định kỳ 2-3 ngày, dân báo qua app)
  bulky,   // Thu gom rác cồng kềnh (theo đơn hẹn cư dân: sofa, tủ, đệm...)
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
  final DriverWasteType? driverWasteType;
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
    this.driverWasteType,
    this.staffCode,
    this.vehiclePlate,
    this.department,
  });

  bool get isCitizen => role == UserRole.citizen;
  bool get isOperator => role == UserRole.operator;
  bool get isDriver => role == UserRole.driver;

  bool get isRegularWasteDriver =>
      role == UserRole.driver &&
      (driverWasteType == DriverWasteType.regular || name == 'Nguyễn Văn Hùng');

  bool get isBulkyWasteDriver =>
      role == UserRole.driver && !isRegularWasteDriver;

  CitizenUser copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    String? defaultAddress,
    String? householdId,
    int? rewardPoints,
    UserRole? role,
    DriverWasteType? driverWasteType,
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
      driverWasteType: driverWasteType ?? this.driverWasteType,
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
        'driverWasteType': driverWasteType?.name,
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
        driverWasteType: json['driverWasteType'] != null
            ? DriverWasteType.values.firstWhere(
                (t) => t.name == json['driverWasteType'],
                orElse: () => DriverWasteType.regular,
              )
            : null,
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
    department: 'Tổ Điều Phối Thu Gom Rác Q.1',
    rewardPoints: 500,
    role: UserRole.operator,
  );

  /// Tài xế 1: Thu gom rác thông dụng / sinh hoạt (Nguyễn Văn Hùng - xe ép rác 5T)
  static const CitizenUser demoRegularDriver = CitizenUser(
    id: 'user-driver-regular-01',
    name: 'Nguyễn Văn Hùng',
    phone: '0909.123.456',
    email: 'hung.nguyen@smartbin.vn',
    defaultAddress: 'Trạm Xe Thu Gom Cơ Động 24/7, Q.1, TP.HCM',
    householdId: 'STAFF-TX01',
    staffCode: 'TX-51C889',
    vehiclePlate: '51C-889.21',
    department: 'Đội Xe Ép Rác Sinh Hoạt Đô Thị Q.1',
    rewardPoints: 350,
    role: UserRole.driver,
    driverWasteType: DriverWasteType.regular,
  );

  /// Tài xế 2: Thu gom rác cồng kềnh chuyên dụng (Lê Hoàng Long - xe tải 2.5T có bửng nâng)
  static const CitizenUser demoBulkyDriver = CitizenUser(
    id: 'user-driver-bulky-01',
    name: 'Lê Hoàng Long',
    phone: '0903.888.999',
    email: 'long.le@smartbin.vn',
    defaultAddress: 'Trạm Thu Gom Rác Cồng Kềnh Chuyên Dụng, Q.1, TP.HCM',
    householdId: 'STAFF-TX02',
    staffCode: 'TX-CK924',
    vehiclePlate: '51D-924.58',
    department: 'Đội Xe Tải Thu Gom Rác Cồng Kềnh Q.1',
    rewardPoints: 420,
    role: UserRole.driver,
    driverWasteType: DriverWasteType.bulky,
  );

  /// Default demo driver points to regular waste driver (Nguyễn Văn Hùng)
  static const CitizenUser demoDriver = demoRegularDriver;

  // Default demo user maintains backwards compatibility
  static const CitizenUser demoUser = demoCitizen;
}
