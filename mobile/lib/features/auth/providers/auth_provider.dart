import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/citizen_user.dart';

/// Provider managing authentication state across Citizen, Operator, and Driver roles.
class AuthProvider extends ChangeNotifier {
  static const String _userStorageKey = 'smartbin_bulky_current_user';

  CitizenUser? _currentUser;
  bool _isLoading = false;

  AuthProvider({CitizenUser? initialUser})
      : _currentUser = initialUser ?? CitizenUser.demoCitizen;

  CitizenUser? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;

  UserRole get currentRole => _currentUser?.role ?? UserRole.citizen;
  bool get isCitizen => _currentUser?.role == UserRole.citizen;
  bool get isOperator => _currentUser?.role == UserRole.operator;
  bool get isDriver => _currentUser?.role == UserRole.driver;
  bool get isRegularDriver => _currentUser?.isRegularWasteDriver ?? false;
  bool get isBulkyDriver => _currentUser?.isBulkyWasteDriver ?? false;
  bool get isRegularWasteDriver => isRegularDriver;
  bool get isBulkyWasteDriver => isBulkyDriver;

  /// Loads stored user from local storage or defaults to demo citizen.
  Future<void> loadSession() async {
    _isLoading = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      final userJsonStr = prefs.getString(_userStorageKey);
      if (userJsonStr != null) {
        final data = jsonDecode(userJsonStr) as Map<String, dynamic>;
        _currentUser = CitizenUser.fromJson(data);
      } else {
        _currentUser = CitizenUser.demoCitizen;
        await _saveUserToPrefs(_currentUser!);
      }
    } catch (_) {
      _currentUser = CitizenUser.demoCitizen;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Quickly switches the active role between Citizen, Operator, and Driver (Regular vs Bulky).
  Future<void> switchRole(UserRole role, {DriverWasteType? driverType}) async {
    _isLoading = true;
    notifyListeners();

    switch (role) {
      case UserRole.citizen:
        _currentUser = CitizenUser.demoCitizen;
        break;
      case UserRole.operator:
        _currentUser = CitizenUser.demoOperator;
        break;
      case UserRole.driver:
        if (driverType == DriverWasteType.bulky) {
          _currentUser = CitizenUser.demoBulkyDriver;
        } else {
          _currentUser = CitizenUser.demoRegularDriver;
        }
        break;
    }

    await _saveUserToPrefs(_currentUser!);
    _isLoading = false;
    notifyListeners();
  }

  /// Sets arbitrary authenticated user.
  Future<void> loginAs(CitizenUser user) async {
    _isLoading = true;
    notifyListeners();

    _currentUser = user;
    await _saveUserToPrefs(_currentUser!);

    _isLoading = false;
    notifyListeners();
  }

  /// Logs in user with phone number and password.
  /// Automatically recognizes Operator and Driver phone numbers.
  Future<bool> login(String phone, String password) async {
    _isLoading = true;
    notifyListeners();

    final trimmedPhone = phone.trim();
    if (trimmedPhone.isEmpty) {
      _isLoading = false;
      notifyListeners();
      return false;
    }

    final normalized = trimmedPhone.replaceAll(RegExp(r'\D'), '');

    if (normalized == '0908111222' || trimmedPhone == '0908.111.222') {
      _currentUser = CitizenUser.demoOperator;
    } else if (normalized == '0909123456' || trimmedPhone == '0909.123.456') {
      _currentUser = CitizenUser.demoRegularDriver;
    } else if (normalized == '0903888999' || trimmedPhone == '0903.888.999') {
      _currentUser = CitizenUser.demoBulkyDriver;
    } else if (normalized == '0912345678' || trimmedPhone == '0912.345.678') {
      _currentUser = CitizenUser.demoCitizen;
    } else {
      _currentUser = CitizenUser(
        id: 'user-$normalized',
        name: 'Công dân $trimmedPhone',
        phone: trimmedPhone,
        email: 'congdan.$normalized@smartbin.vn',
        defaultAddress: '123 Nguyễn Thị Minh Khai, P. Bến Nghé, Q.1, TP.HCM',
        householdId: 'HH-${normalized.length >= 4 ? normalized.substring(normalized.length - 4) : "1234"}',
        rewardPoints: 120,
        role: UserRole.citizen,
      );
    }

    await _saveUserToPrefs(_currentUser!);
    _isLoading = false;
    notifyListeners();
    return true;
  }

  /// 1-Click quick login for Citizen demo account.
  Future<void> loginDemo() async => switchRole(UserRole.citizen);

  /// 1-Click quick login for Operator demo account.
  Future<void> loginOperator() async => switchRole(UserRole.operator);

  /// 1-Click quick login for Driver demo account.
  Future<void> loginDriver() async => switchRole(UserRole.driver);

  /// Logs out and clears local session.
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_userStorageKey);
    } catch (_) {}

    _currentUser = null;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> _saveUserToPrefs(CitizenUser user) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_userStorageKey, jsonEncode(user.toJson()));
    } catch (_) {}
  }
}
