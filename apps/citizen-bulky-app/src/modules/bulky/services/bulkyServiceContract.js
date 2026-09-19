export const BULKY_CAPABILITIES = Object.freeze({
  VIEW_BULKY_ORDERS: 'VIEW_BULKY_ORDERS',
  MANAGE_BULKY_ORDERS: 'MANAGE_BULKY_ORDERS',
  DISPATCH_BULKY_ORDERS: 'DISPATCH_BULKY_ORDERS',
});

export const BULKY_PERSONAS = Object.freeze([
  {
    id: 'citizen-demo-user',
    name: 'Lê Quốc Anh',
    role: 'CITIZEN',
    roleLabel: 'Người dân / Cư dân',
    description: 'Tài khoản công dân: Đặt lịch thu gom, thanh toán, gửi yêu cầu dời lịch / hủy đơn.',
    badgeColor: 'primary',
    householdId: 'hh-demo-1',
    householdName: 'Hộ gia đình Lê Quốc Anh (Quận 5)',
    capabilities: [
      'VIEW_BULKY_ORDERS',
      'MANAGE_BULKY_ORDERS',
    ],
  },
  {
    id: 'dispatcher-demo-user',
    name: 'Trần Minh Đức',
    role: 'DISPATCHER',
    roleLabel: 'Điều phối viên Smartbin',
    description: 'Cán bộ điều hành: Kiểm tra lộ trình xe, tiếp nhận và duyệt/từ chối yêu cầu đổi ngày từ người dân.',
    badgeColor: 'warning',
    householdId: 'hh-demo-1',
    capabilities: [
      'VIEW_BULKY_ORDERS',
      'DISPATCH_BULKY_ORDERS',
    ],
  },
  {
    id: 'admin-demo-user',
    name: 'Nguyễn Quản Trị',
    role: 'ADMIN',
    roleLabel: 'Quản trị viên Hệ thống',
    description: 'Quản trị viên: Toàn quyền quản lý, kiểm thử tất cả các luồng người dân và điều phối.',
    badgeColor: 'error',
    householdId: 'hh-demo-1',
    capabilities: [
      'VIEW_BULKY_ORDERS',
      'MANAGE_BULKY_ORDERS',
      'DISPATCH_BULKY_ORDERS',
    ],
  },
]);

export const BULKY_ERROR_CODES = Object.freeze({
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  CONFLICT: 'CONFLICT',
  SLOT_EXPIRED: 'SLOT_EXPIRED',
  UNAVAILABLE: 'UNAVAILABLE',
  OFFLINE: 'OFFLINE',
  UNKNOWN: 'UNKNOWN',
});

export const BULKY_STORAGE_KEYS = Object.freeze({
  REPOSITORY: 'smartbin:bulky:v1:repository',
  CACHE_PREFIX: 'smartbin:bulky:v1:cache:',
  DRAFTS_PREFIX: 'smartbin:bulky:v1:offline-drafts:',
  ACTIVE_USER: 'smartbin:bulky:v1:active-user',
});
