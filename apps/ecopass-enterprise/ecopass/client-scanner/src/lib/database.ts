import fs from 'node:fs';
import path from 'node:path';

export interface StoreQr {
  id: string;
  qrCode: string;
  storeId: string;
  storeName: string;
  location: string;
  status: 'active' | 'maintenance';
  scanCount: number;
  createdAt: string;
}

export interface PartnerStore {
  id: string;
  name: string;
  category: string;
  activeStickers: number;
  totalScans: number;
  portalPort: number;
  status: 'connected' | 'offline';
}

export interface OrderSticker {
  id: string;
  barcode: string;
  code: string;
  storeId: string;
  storeName: string;
  drinkName: string;
  price: number;
  posTerminal: string;
  status: 'active' | 'used';
  usedAt?: string | null;
  usedBy?: string | null;
  syncedAt?: string;
  source: string;
}

export interface VoucherClaim {
  id: string;
  voucherCode: string;
  barcode: string;
  storeName: string;
  discountAmount: number;
  createdAt: string;
}

interface EcoPassDbSchema {
  storeQrs: StoreQr[];
  partnerStores: PartnerStore[];
  orderStickers: OrderSticker[];
  voucherClaims: VoucherClaim[];
}

const DB_PATH = path.resolve(process.cwd(), '../data/ecopass_db.json');

const INITIAL_STORES: PartnerStore[] = [
  { id: 'highlands', name: 'Highlands Coffee', category: 'Cà phê & Đồ uống', activeStickers: 7, totalScans: 48, portalPort: 3012, status: 'connected' },
  { id: 'phuclong', name: 'Phúc Long Tea & Coffee', category: 'Trà & Cà phê', activeStickers: 2, totalScans: 26, portalPort: 3012, status: 'connected' },
  { id: 'tch', name: 'The Coffee House', category: 'Cà phê', activeStickers: 2, totalScans: 19, portalPort: 3012, status: 'connected' },
  { id: 'cheese', name: 'Cheese Coffee', category: 'Cà phê sáng tạo', activeStickers: 1, totalScans: 12, portalPort: 3012, status: 'connected' },
];

const INITIAL_QRS: StoreQr[] = [
  { id: 'qr-1', qrCode: 'BIN-HL-01', storeId: 'highlands', storeName: 'Highlands Coffee', location: 'Khu B - Sảnh Căn Tin FPT', status: 'active', scanCount: 142, createdAt: '2026-09-18 08:00:00' },
  { id: 'qr-2', qrCode: 'BIN-PL-02', storeId: 'phuclong', storeName: 'Phúc Long Tea & Coffee', location: 'Khu E - Cửa Hàng Phúc Long', status: 'active', scanCount: 89, createdAt: '2026-09-18 09:30:00' },
  { id: 'qr-3', qrCode: 'BIN-TCH-03', storeId: 'tch', storeName: 'The Coffee House', location: 'Tòa Alpha - Hành Lang Tầng 1', status: 'active', scanCount: 65, createdAt: '2026-09-19 08:15:00' },
  { id: 'qr-4', qrCode: 'BIN-CHEESE-04', storeId: 'cheese', storeName: 'Cheese Coffee', location: 'Tòa Gamma - Cổng Tây', status: 'active', scanCount: 38, createdAt: '2026-09-19 14:20:00' },
];

const INITIAL_STICKERS: OrderSticker[] = [
  { id: 'stk-1', barcode: '1089215437', code: '#HL-8921', storeId: 'highlands', storeName: 'Highlands Coffee', drinkName: 'Phindi Hạnh Nhân', price: 45000, posTerminal: 'POS 1', status: 'active', syncedAt: '2026-09-20 10:30:00', source: 'Cổng Đối Tác :3012' },
  { id: 'stk-2', barcode: '2789229104', code: '#HL-8922', storeId: 'highlands', storeName: 'Highlands Coffee', drinkName: 'Trà Sen Vàng', price: 49000, posTerminal: 'POS 1', status: 'active', syncedAt: '2026-09-20 10:35:00', source: 'Cổng Đối Tác :3012' },
  { id: 'stk-3', barcode: '3989231846', code: '#HL-8923', storeId: 'highlands', storeName: 'Highlands Coffee', drinkName: 'Phindi Hạnh Nhân', price: 45000, posTerminal: 'POS 2', status: 'active', syncedAt: '2026-09-20 10:41:00', source: 'Cổng Đối Tác :3012' },
  { id: 'stk-4', barcode: '4889247215', code: '#HL-8924', storeId: 'highlands', storeName: 'Highlands Coffee', drinkName: 'Freeze Matcha', price: 55000, posTerminal: 'POS 2', status: 'active', syncedAt: '2026-09-20 09:40:00', source: 'Cổng Đối Tác :3012' },
  { id: 'stk-5', barcode: '5289256390', code: '#HL-8925', storeId: 'highlands', storeName: 'Highlands Coffee', drinkName: 'Bánh Mì Que', price: 22000, posTerminal: 'POS 1', status: 'active', syncedAt: '2026-09-20 08:50:00', source: 'Cổng Đối Tác :3012' },
  { id: 'stk-6', barcode: '6389198041', code: '#HL-8919', storeId: 'highlands', storeName: 'Highlands Coffee', drinkName: 'Trà Sen Vàng', price: 49000, posTerminal: 'POS 1', status: 'used', usedAt: '2026-09-20 09:12:00', source: 'Cổng Đối Tác :3012' },
  { id: 'stk-7', barcode: '7589184319', code: '#HL-8918', storeId: 'highlands', storeName: 'Highlands Coffee', drinkName: 'Freeze Matcha', price: 55000, posTerminal: 'POS 2', status: 'used', usedAt: '2026-09-20 08:45:00', source: 'Cổng Đối Tác :3012' },
  { id: 'stk-8', barcode: '4921008711', code: '#PL-7721', storeId: 'phuclong', storeName: 'Phúc Long Tea & Coffee', drinkName: 'Trà Đào Cam Sả', price: 52000, posTerminal: 'POS 1', status: 'active', syncedAt: '2026-09-20 09:15:00', source: 'Cổng Đối Tác :3012' },
  { id: 'stk-9', barcode: '4921008712', code: '#PL-7722', storeId: 'phuclong', storeName: 'Phúc Long Tea & Coffee', drinkName: 'Trà Sữa Phúc Long', price: 48000, posTerminal: 'POS 1', status: 'active', syncedAt: '2026-09-20 09:30:00', source: 'Cổng Đối Tác :3012' },
  { id: 'stk-10', barcode: '5501192834', code: '#TCH-5501', storeId: 'tch', storeName: 'The Coffee House', drinkName: 'Cà phê Sữa Đá', price: 39000, posTerminal: 'POS 2', status: 'active', syncedAt: '2026-09-20 08:20:00', source: 'Cổng Đối Tác :3012' },
  { id: 'stk-11', barcode: '5501192835', code: '#TCH-5502', storeId: 'tch', storeName: 'The Coffee House', drinkName: 'Hi-Tea Yuzu Vải', price: 55000, posTerminal: 'POS 1', status: 'active', syncedAt: '2026-09-20 10:10:00', source: 'Cổng Đối Tác :3012' },
  { id: 'stk-12', barcode: '7829104419', code: '#CHEESE-101', storeId: 'cheese', storeName: 'Cheese Coffee', drinkName: 'Arabica Bạc Xỉu', price: 45000, posTerminal: 'POS 1', status: 'active', syncedAt: '2026-09-20 10:05:00', source: 'Cổng Đối Tác :3012' },
];

function ensureDb(): EcoPassDbSchema {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      const initialData: EcoPassDbSchema = {
        storeQrs: INITIAL_QRS,
        partnerStores: INITIAL_STORES,
        orderStickers: INITIAL_STICKERS,
        voucherClaims: [],
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Database load error, returning memory fallback:', err);
    return {
      storeQrs: INITIAL_QRS,
      partnerStores: INITIAL_STORES,
      orderStickers: INITIAL_STICKERS,
      voucherClaims: [],
    };
  }
}

function saveDb(data: EcoPassDbSchema) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save EcoPass DB:', err);
  }
}

// =========================================================================
// PUBLIC CRUD & VERIFICATION METHODS
// =========================================================================

export function getFullDb(): EcoPassDbSchema {
  return ensureDb();
}

export function getStoreQrs(): StoreQr[] {
  const db = ensureDb();
  return db.storeQrs;
}

export function addStoreQr(qr: Omit<StoreQr, 'id' | 'scanCount' | 'createdAt'>): StoreQr {
  const db = ensureDb();
  const newQr: StoreQr = {
    ...qr,
    id: 'qr-' + Date.now(),
    scanCount: 0,
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
  };
  db.storeQrs.push(newQr);
  saveDb(db);
  return newQr;
}

export function getPartnerStores(): PartnerStore[] {
  const db = ensureDb();
  return db.partnerStores;
}

export function getOrderStickers(storeId?: string): OrderSticker[] {
  const db = ensureDb();
  if (storeId && storeId !== 'all') {
    return db.orderStickers.filter(s => s.storeId === storeId);
  }
  return db.orderStickers;
}

export function addOrderSticker(sticker: Omit<OrderSticker, 'id' | 'syncedAt' | 'source'>): OrderSticker {
  const db = ensureDb();
  const newSticker: OrderSticker = {
    ...sticker,
    id: 'stk-' + Date.now(),
    syncedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    source: 'Thêm thủ công / Portal :3010',
  };
  db.orderStickers.unshift(newSticker);
  saveDb(db);
  return newSticker;
}

// 1. Xác thực Bước 1: Quét mã QR thùng rác cửa hàng
export function verifyBinQr(code: string): { valid: boolean; message: string; data?: StoreQr } {
  const db = ensureDb();
  const normalized = (code || '').trim().toUpperCase();

  const found = db.storeQrs.find(q => 
    q.qrCode.toUpperCase() === normalized || 
    normalized.includes(q.qrCode.toUpperCase())
  );

  if (!found) {
    return {
      valid: false,
      message: `Mã QR "${code}" không hợp lệ hoặc chưa được đăng ký trong hệ thống EcoPass!`,
    };
  }

  if (found.status !== 'active') {
    return {
      valid: false,
      message: `Thùng rác tại "${found.location}" đang bảo trì, vui lòng dùng điểm khác!`,
    };
  }

  // Tăng lượt quét
  found.scanCount += 1;
  saveDb(db);

  return {
    valid: true,
    message: `Đã xác nhận thùng rác hợp lệ: ${found.storeName} (${found.location})`,
    data: found,
  };
}

// 2. Xác thực Bước 2: Quét mã tem ly nước (mã vạch)
export function verifyOrderSticker(barcodeInput: string): { valid: boolean; message: string; data?: OrderSticker; errorCode?: string } {
  const db = ensureDb();
  const cleanInput = (barcodeInput || '').trim();

  const found = db.orderStickers.find(s => 
    s.barcode === cleanInput || 
    s.code.toLowerCase() === cleanInput.toLowerCase() ||
    cleanInput.includes(s.barcode)
  );

  if (!found) {
    return {
      valid: false,
      errorCode: 'NOT_FOUND',
      message: `Mã tem "${barcodeInput}" không tồn tại trong cơ sở dữ liệu đối tác!`,
    };
  }

  if (found.status === 'used') {
    return {
      valid: false,
      errorCode: 'ALREADY_USED',
      message: `Mã tem "${found.code}" (${found.drinkName}) đã được quét và ký số thành công lúc ${found.usedAt || 'trước đó'}! Mã chỉ dùng 1 lần.`,
      data: found,
    };
  }

  return {
    valid: true,
    message: `Khớp tem đơn hàng: ${found.drinkName} - ${found.storeName}`,
    data: found,
  };
}

// 3. Ký số & Huỷ mã tem 1 lần (1-Time Burn) sau khi hoàn tất khảo sát
export function burnOrderSticker(barcodeInput: string, userChoice?: string): { success: boolean; message: string; voucher?: any } {
  const db = ensureDb();
  const cleanInput = (barcodeInput || '').trim();

  const sticker = db.orderStickers.find(s => 
    s.barcode === cleanInput || 
    s.code.toLowerCase() === cleanInput.toLowerCase() ||
    cleanInput.includes(s.barcode)
  );

  if (!sticker) {
    return { success: false, message: 'Không tìm thấy tem cần đốt!' };
  }

  if (sticker.status === 'used') {
    return { success: false, message: 'Tem đã được sử dụng trước đó!' };
  }

  // Chuyển trạng thái sang USED ngay lập tức
  sticker.status = 'used';
  sticker.usedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Tạo bản ghi claim voucher
  const voucherCode = `ECO-${sticker.storeId.toUpperCase()}-10K-${Math.floor(100 + Math.random() * 900)}`;
  const claim: VoucherClaim = {
    id: 'claim-' + Date.now(),
    voucherCode,
    barcode: sticker.barcode,
    storeName: sticker.storeName,
    discountAmount: 10000,
    createdAt: sticker.usedAt,
  };
  db.voucherClaims.push(claim);
  saveDb(db);

  return {
    success: true,
    message: 'Ký số và đốt tem thành công!',
    voucher: {
      id: claim.id,
      code: voucherCode,
      title: 'Giảm 10.000đ',
      subtitle: `Đơn từ 45.000đ khi mua tại quầy ${sticker.storeName}`,
      brand: sticker.storeName,
      drink: sticker.drinkName,
      barcode: sticker.barcode,
      expiresIn: 'Tem ký số 1 lần (Dùng tại quầy)',
    },
  };
}

// 4. Xóa tem mã vạch khỏi CSDL (Dành cho chức năng dọn dẹp hoặc bỏ tem rác)
export function deleteOrderSticker(barcodeOrId: string): { success: boolean; message: string } {
  const db = ensureDb();
  const clean = (barcodeOrId || '').trim();
  const initialLen = db.orderStickers.length;
  db.orderStickers = db.orderStickers.filter(s => s.barcode !== clean && s.id !== clean && s.code !== clean);

  if (db.orderStickers.length === initialLen) {
    return { success: false, message: 'Không tìm thấy tem cần xóa!' };
  }

  saveDb(db);
  return { success: true, message: 'Đã xóa tem khỏi CSDL thành công!' };
}

// 5. Đặt lại (Reset) trạng thái tem đã quét về trạng thái sẵn sàng (active) để test lại
export function resetOrderSticker(barcodeOrId: string): { success: boolean; message: string; data?: OrderSticker } {
  const db = ensureDb();
  const clean = (barcodeOrId || '').trim();
  const sticker = db.orderStickers.find(s => s.barcode === clean || s.id === clean || s.code === clean);

  if (!sticker) {
    return { success: false, message: 'Không tìm thấy tem cần đặt lại!' };
  }

  sticker.status = 'active';
  sticker.usedAt = null;
  sticker.usedBy = null;
  saveDb(db);

  return { success: true, message: 'Đã khôi phục tem về trạng thái sẵn sàng quét!', data: sticker };
}

// 6. Đồng bộ tem ly nước từ Cửa Hàng (:3013)
export async function syncFromStorePortal(storeUrl = 'http://localhost:3013/api/stickers') {
  const db = ensureDb();
  try {
    const res = await fetch(storeUrl, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Cửa hàng :3013 trả về mã lỗi ${res.status}`);
    }
    const json = await res.json();
    const storeItems = json.data || [];

    let newCount = 0;
    for (const item of storeItems) {
      const existing = db.orderStickers.find(s => s.barcode === item.barcode);
      if (!existing) {
        db.orderStickers.unshift({
          id: 'stk-sync-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          barcode: item.barcode,
          code: item.code || `#HL-${item.barcode.slice(-4)}`,
          storeId: item.storeId || 'highlands',
          storeName: item.storeName || 'Highlands Coffee',
          drinkName: item.drink || 'Thức uống Highlands',
          price: item.price || 45000,
          posTerminal: item.pos || 'POS 1',
          status: 'active',
          syncedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
          source: 'Cửa Hàng Highlands :3013',
        });
        newCount++;
      }
    }

    saveDb(db);
    return { success: true, source: 'Cửa Hàng Highlands :3013', total: storeItems.length, newCount, currentTotal: db.orderStickers.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Giữ lại alias để tương thích
export const syncFromPartnerPortal = syncFromStorePortal;


