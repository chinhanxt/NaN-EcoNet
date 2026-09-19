import 'package:flutter/foundation.dart';
import '../../../core/constants/bulky_constants.dart';
import '../../../core/domain/models/bulky_quote.dart';
import '../../../core/domain/pricing/pricing_engine.dart';
import '../../../core/services/ai/ai_recognition_result.dart';

/// State management provider for the 3-step Bulky Waste booking wizard.
/// Step 0: Items & Material survey
/// Step 1: Schedule & Pickup Address
/// Step 2: Quote Breakdown & Review
class BookingWizardProvider extends ChangeNotifier {
  int _currentStep = 0;
  List<BulkyItem> _items = [];
  BulkyQuote? _currentQuote;
  Uint8List? _imageBytes;

  // Logistics & Handling
  bool _requiresDisassembly = false;
  int _floorNumber = 0;
  bool _hasElevator = false;
  int _areaFee = DEFAULT_AREA_FEE;

  // Customer pickup details
  String _contactName = '';
  String _contactPhone = '';
  String _address = '';
  String _scheduledDate = '';
  String _scheduledTimeSlot = '08:00 - 11:30';
  String _notes = '';

  int get currentStep => _currentStep;
  List<BulkyItem> get items => List.unmodifiable(_items);
  BulkyQuote? get currentQuote => _currentQuote;
  Uint8List? get imageBytes => _imageBytes;

  bool get requiresDisassembly => _requiresDisassembly;
  int get floorNumber => _floorNumber;
  bool get hasElevator => _hasElevator;
  int get areaFee => _areaFee;

  String get contactName => _contactName;
  String get contactPhone => _contactPhone;
  String get address => _address;
  String get scheduledDate => _scheduledDate;
  String get scheduledTimeSlot => _scheduledTimeSlot;
  String get notes => _notes;

  double get totalEstimatedWeightKg =>
      PricingEngine.calculateTotalEstimatedWeight(_items);

  int get totalItemsCount =>
      _items.fold(0, (sum, item) => sum + item.quantity);

  /// Initializes items and photo from Gemini AI recognition result.
  void initFromScan(AiRecognitionResult result, Uint8List? imageBytes) {
    _imageBytes = imageBytes;
    _items = List.from(result.items);
    _requiresDisassembly = result.items.any((i) => i.requiresDisassembly);
    _recalculateQuote();
    notifyListeners();
  }

  /// Appends a new item and triggers live quote recalculation.
  void addItem(BulkyItem item) {
    _items.add(item);
    _recalculateQuote();
    notifyListeners();
  }

  /// Removes an item at [index] and updates live quote.
  void removeItem(int index) {
    if (index >= 0 && index < _items.length) {
      _items.removeAt(index);
      _recalculateQuote();
      notifyListeners();
    }
  }

  /// Replaces an existing item at [index].
  void updateItem(int index, BulkyItem newItem) {
    if (index >= 0 && index < _items.length) {
      _items[index] = newItem;
      _recalculateQuote();
      notifyListeners();
    }
  }

  /// 1-Click material adjustment for item at [index] (LIGHT, STANDARD, HEAVY).
  void updateItemMaterial(int index, MaterialType material) {
    if (index >= 0 && index < _items.length) {
      _items[index] = _items[index].copyWith(material: material);
      _recalculateQuote();
      notifyListeners();
    }
  }

  /// Updates item quantity. If [quantity] <= 0, the item is removed.
  void updateItemQuantity(int index, int quantity) {
    if (index >= 0 && index < _items.length) {
      if (quantity <= 0) {
        _items.removeAt(index);
      } else {
        _items[index] = _items[index].copyWith(quantity: quantity);
      }
      _recalculateQuote();
      notifyListeners();
    }
  }

  /// Updates logistics options (disassembly, floor level, elevator).
  void setLogistics({
    bool? requiresDisassembly,
    int? floorNumber,
    bool? hasElevator,
    int? areaFee,
  }) {
    if (requiresDisassembly != null) {
      _requiresDisassembly = requiresDisassembly;
    }
    if (floorNumber != null) {
      _floorNumber = floorNumber;
    }
    if (hasElevator != null) {
      _hasElevator = hasElevator;
    }
    if (areaFee != null) {
      _areaFee = areaFee;
    }
    _recalculateQuote();
    notifyListeners();
  }

  /// Updates customer pickup address and contact details.
  void setCustomerInfo({
    String? name,
    String? phone,
    String? address,
    String? date,
    String? timeSlot,
    String? notes,
  }) {
    if (name != null) _contactName = name;
    if (phone != null) _contactPhone = phone;
    if (address != null) _address = address;
    if (date != null) _scheduledDate = date;
    if (timeSlot != null) _scheduledTimeSlot = timeSlot;
    if (notes != null) _notes = notes;
    notifyListeners();
  }

  /// Validates whether the user can navigate to the next step.
  bool canGoNext() {
    switch (_currentStep) {
      case 0:
        return _items.isNotEmpty;
      case 1:
        return _address.trim().isNotEmpty && _scheduledDate.trim().isNotEmpty;
      case 2:
        return _currentQuote != null;
      default:
        return true;
    }
  }

  /// Advances to next wizard step if valid.
  bool nextStep() {
    if (canGoNext() && _currentStep < 2) {
      _currentStep++;
      notifyListeners();
      return true;
    }
    return false;
  }

  /// Steps back to previous wizard step.
  bool prevStep() {
    if (_currentStep > 0) {
      _currentStep--;
      notifyListeners();
      return true;
    }
    return false;
  }

  /// Directly navigates to a specific step.
  void goToStep(int step) {
    if (step >= 0 && step <= 2 && step != _currentStep) {
      _currentStep = step;
      notifyListeners();
    }
  }

  /// Resets wizard state back to initial default.
  void reset() {
    _currentStep = 0;
    _items = [];
    _currentQuote = null;
    _imageBytes = null;
    _requiresDisassembly = false;
    _floorNumber = 0;
    _hasElevator = false;
    _areaFee = DEFAULT_AREA_FEE;
    _contactName = '';
    _contactPhone = '';
    _address = '';
    _scheduledDate = '';
    _scheduledTimeSlot = '08:00 - 11:30';
    _notes = '';
    notifyListeners();
  }

  void _recalculateQuote() {
    if (_items.isEmpty) {
      _currentQuote = null;
      return;
    }

    _currentQuote = PricingEngine.calculateQuote(
      items: _items,
      requiresDisassembly: _requiresDisassembly,
      floorNumber: _floorNumber,
      hasElevator: _hasElevator,
      areaFee: _areaFee,
    );
  }
}
