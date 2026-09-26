import { ACCEPTED_ITEM_TYPES } from '../../domain/constants.js';

export function validateRequestLocation(draft = {}) {
  const errors = {};
  if (!draft.serviceLocationId) {
    errors.serviceLocationId = 'Vui lòng chọn địa điểm thu gom';
  }
  if (!draft.requestedDate) {
    errors.requestedDate = 'Vui lòng chọn ngày thu gom mong muốn';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.requestedDate)) {
    errors.requestedDate = 'Định dạng ngày không hợp lệ (YYYY-MM-DD)';
  }
  return errors;
}

export function validateRequestItems(items = []) {
  const errors = {};
  if (!Array.isArray(items) || items.length === 0) {
    errors.confirmedItems = 'Danh sách đồ cồng kềnh không được để trống';
    return errors;
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!ACCEPTED_ITEM_TYPES.includes(item.catalogItemCode)) {
      errors.confirmedItems = `Loại đồ "${item.catalogItemCode || 'không xác định'}" không thuộc danh mục hỗ trợ`;
      return errors;
    }
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      errors.confirmedItems = 'Số lượng đồ phải là số nguyên dương (tối thiểu 1)';
      return errors;
    }
  }

  return errors;
}

export function validateHandlingConditions(conditions = {}) {
  const errors = {};
  if (conditions.floorNumber !== undefined && conditions.floorNumber !== null) {
    const floor = Number(conditions.floorNumber);
    if (!Number.isInteger(floor) || floor < 0) {
      errors.floorNumber = 'Số tầng phải là số nguyên không âm (0 là tầng trệt)';
    }
  }
  if (conditions.hasLift !== undefined && typeof conditions.hasLift !== 'boolean') {
    errors.hasLift = 'Thông tin thang máy phải là giá trị đúng/sai';
  }
  if (conditions.placement === 'UPPER_FLOOR' && !(Number(conditions.floorNumber) >= 1))
    errors.floorNumber = 'Vui lòng nhập tầng lầu từ 1 trở lên';
  return errors;
}

export function validateCanProceedToQuote({ confirmedItems = [], aiResult = {} } = {}) {
  if (aiResult.requiresManualReview) {
    return {
      allowed: false,
      reason: 'Yêu cầu cần được nhân viên review thủ công trước khi có thể báo giá',
    };
  }

  const itemsErrors = validateRequestItems(confirmedItems);
  if (itemsErrors.confirmedItems) {
    return {
      allowed: false,
      reason: itemsErrors.confirmedItems,
    };
  }

  return { allowed: true };
}

export function validateStepLogistics(draft = {}) {
  const locErrors = validateRequestLocation(draft);
  const condErrors = validateHandlingConditions(draft?.handlingConditions);
  return { ...locErrors, ...condErrors };
}
