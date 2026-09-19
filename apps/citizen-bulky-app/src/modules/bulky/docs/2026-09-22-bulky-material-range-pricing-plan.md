# Implementation Plan: Material Survey, Estimated Range Pricing (Min-Max) & On-Site Tolerance Reconciliation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi định giá thu gom rác cồng kềnh sang Khoảng giá dự toán (Min - Max), bổ sung khảo sát chất liệu 1-chạm (Nhựa/Ván ép, Gỗ MDF, Gỗ đặc/Đá) trên thẻ đồ vật, và áp dụng cơ chế cam kết dung sai $\pm 15\%$ khi bàn giao thực tế nhằm loại trừ rủi ro cân nặng/giá tiền.

**Architecture:** Mở rộng domain `pricing.js` và `constants.js` với `MATERIAL_TYPES` và `MATERIAL_FACTORS`, nâng cấp `BulkyRequestWizard.jsx` với cụm chọn chất liệu 1-chạm và live floating range bar, đồng thời cập nhật `BulkyQuotePage.jsx`, `BulkyPaymentPage.jsx`, `BulkyOrderDetailPage.jsx` để hiển thị minh bạch 2 tầng giá (Khoảng dự toán & Tiền tạm giữ chỗ) cùng chính sách dung sai.

**Tech Stack:** React 19, Redux Toolkit, Material UI v6/v9, Vitest, JavaScript (ESM).

## Global Constraints

- **Branch:** `dev-EnglandLee` (Developer 3).
- **Scope:** Chỉ được chỉnh sửa mã nguồn trong `src/modules/bulky/` (và các file docs/tests của module này). Tuyệt đối không chạm vào thư mục của Dev 1 hay Dev 2.
- **Language:** 100% tiếng Việt cho tất cả nhãn, thông báo và giao diện người dùng.
- **Security:** Tuyệt đối không lưu raw API key vào git.

---

### Task 1: Domain & Pricing Model Updates (`constants.js`, `pricing.js`, `domain.test.js`)

**Files:**
- Modify: `src/modules/bulky/domain/constants.js`
- Modify: `src/modules/bulky/domain/pricing.js`
- Test: `src/modules/bulky/domain/domain.test.js`

**Interfaces:**
- Consumes: `confirmedItems`, `priceBook`, `handlingConditions`.
- Produces: `quote.estimatedRange`: `{ minVnd, maxVnd, depositHoldVnd }`, `quote.tolerancePolicy`: `{ allowedPercent, message }`, `MATERIAL_TYPES`, `MATERIAL_FACTORS`.

- [ ] **Step 1: Write the failing tests for material factors and range pricing in `domain.test.js`**

```javascript
// Test calculateQuote with material factors and estimatedRange
it('calculates quote with material factors and estimated range', () => {
  const quote = calculateQuote({
    confirmedItems: [
      { catalogItemCode: 'TABLE', quantity: 1, material: 'HEAVY' },
      { catalogItemCode: 'CHAIR', quantity: 2, material: 'LIGHT' },
    ],
    handlingConditions: {},
    serviceArea: { code: 'D5' },
    priceBook: {
      version: 'v1',
      items: { TABLE: 100000, CHAIR: 50000 },
    },
    now: '2026-09-22T10:00:00.000Z',
  });

  expect(quote.estimatedRange).toBeDefined();
  expect(quote.estimatedRange.minVnd).toBeGreaterThan(0);
  expect(quote.estimatedRange.maxVnd).toBeGreaterThan(quote.estimatedRange.minVnd);
  expect(quote.estimatedRange.depositHoldVnd).toBe(quote.estimatedRange.minVnd);
  expect(quote.tolerancePolicy.allowedPercent).toBe(15);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/bulky/domain/domain.test.js`
Expected: FAIL (`quote.estimatedRange is undefined`).

- [ ] **Step 3: Implement material constants and range pricing in `constants.js` and `pricing.js`**

In `src/modules/bulky/domain/constants.js`:
```javascript
export const MATERIAL_TYPES = {
  LIGHT: 'LIGHT',
  STANDARD: 'STANDARD',
  HEAVY: 'HEAVY',
};

export const MATERIAL_FACTORS = {
  LIGHT: {
    code: 'LIGHT',
    label: '🪶 Nhựa / Ván ép / Mút',
    priceFactor: 0.85,
    weightFactor: 0.70,
  },
  STANDARD: {
    code: 'STANDARD',
    label: '🪵 Gỗ MDF / Tiêu chuẩn',
    priceFactor: 1.00,
    weightFactor: 1.00,
  },
  HEAVY: {
    code: 'HEAVY',
    label: '🪨 Gỗ đặc / Mặt đá / Kính',
    priceFactor: 1.35,
    weightFactor: 1.80,
  },
};
```

In `src/modules/bulky/domain/pricing.js`:
```javascript
import { MATERIAL_FACTORS } from './constants.js';

// Inside calculateQuote:
for (const item of confirmedItems) {
  const code = item.catalogItemCode || item.itemType;
  const quantity = asVnd(item.quantity, 'quantity');
  const baseUnitVnd = asVnd(priceBook.items?.[code], `priceBook.items.${code}`);
  const material = item.material || 'STANDARD';
  const factor = MATERIAL_FACTORS[material]?.priceFactor || 1.0;
  
  const unitPriceVnd = Math.round(baseUnitVnd * factor);
  const amountVnd = quantity * unitPriceVnd;
  lineItems.push({
    code,
    label: item.displayName || code,
    material,
    quantity,
    unitPriceVnd,
    amountVnd,
  });
  subtotalVnd += amountVnd;
}

// Compute estimatedRange:
const minVnd = totalVnd;
const maxVnd = Math.round(minVnd * 1.30);
const estimatedRange = {
  minVnd,
  maxVnd,
  depositHoldVnd: minVnd,
};

const tolerancePolicy = {
  allowedPercent: 15,
  message: 'Miễn phí phụ thu nếu khối lượng hoặc kích thước thực tế sai lệch không quá ±15% so với khai báo.',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/bulky/domain/domain.test.js`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/modules/bulky/domain/constants.js src/modules/bulky/domain/pricing.js src/modules/bulky/domain/domain.test.js
git commit -m "feat(bulky): add material factors and estimated range calculation to pricing domain"
```

---

### Task 2: Item Cards with 1-Click Material Survey in Wizard (`BulkyRequestWizard.jsx`, tests)

**Files:**
- Modify: `src/modules/bulky/features/request/BulkyRequestWizard.jsx`
- Test: `src/modules/bulky/pages/BulkyBookingPage.test.jsx`

**Interfaces:**
- Consumes: `confirmedItems`, `MATERIAL_TYPES`, `MATERIAL_FACTORS`.
- Produces: Enhanced item cards with 1-click material buttons, live weight recalculation, floating estimated range bar, and review step breakdown.

- [ ] **Step 1: Write test in `BulkyBookingPage.test.jsx` for material selection and range pricing display**

```javascript
it('displays material selection chips and live range pricing in booking wizard', async () => {
  renderWithStore(<BulkyBookingPage />);
  
  // Step 1 should show material options
  expect(screen.getByText(/Gỗ MDF \/ Tiêu chuẩn/i)).toBeInTheDocument();
  expect(screen.getByText(/Gỗ đặc \/ Mặt đá/i)).toBeInTheDocument();
  expect(screen.getByText(/Khoảng giá dự toán/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/bulky/pages/BulkyBookingPage.test.jsx`
Expected: FAIL (`Gỗ đặc / Mặt đá` not found).

- [ ] **Step 3: Implement Material Chips & Live Floating Bar in `BulkyRequestWizard.jsx`**

- For each item in `confirmedItems`:
  - Add state `material` (default `'STANDARD'`).
  - Calculate `estimatedWeightKg = Math.round(baseWeight * MATERIAL_FACTORS[material].weightFactor)`.
  - Render 3 Chip buttons: `🪶 Nhựa / Ván ép`, `🪵 Gỗ MDF / Chuẩn`, `🪨 Gỗ đặc / Mặt đá`.
  - On click, update `item.material` and re-render.
- Add live estimated range bar at the bottom of Step 1:
  - Displays: `Khoảng giá dự toán: [minVnd] - [maxVnd]` • `Tạm tính: [depositHoldVnd]`
  - Badge: `🛡️ Cam kết dung sai ±15% không phát sinh phí`.
- In Step 3 (Review & Quote):
  - Display items with selected material label.
  - Render 2-tier price box: `Khoảng giá dự toán` & `Số tiền tạm giữ chỗ`.
  - Add Transparency Guarantee Banner.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/bulky/pages/BulkyBookingPage.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/modules/bulky/features/request/BulkyRequestWizard.jsx src/modules/bulky/pages/BulkyBookingPage.test.jsx
git commit -m "feat(bulky): add 1-click material survey chips and live range pricing to booking wizard"
```

---

### Task 3: Quote Page, Payment Simulation & Order Details Integration (`BulkyQuotePage.jsx`, `BulkyPaymentPage.jsx`, `BulkyOrderDetailPage.jsx`, `BulkyHeader.jsx`)

**Files:**
- Modify: `src/modules/bulky/pages/BulkyQuotePage.jsx`
- Modify: `src/modules/bulky/pages/BulkyPaymentPage.jsx`
- Modify: `src/modules/bulky/pages/BulkyOrderDetailPage.jsx`
- Modify: `src/modules/bulky/components/BulkyHeader.jsx` (resolve DialogTitle nested h6 warning and PaperProps)
- Test: `src/modules/bulky/pages/BulkyQuotePage.test.jsx`
- Test: `src/modules/bulky/pages/BulkyOrderDetailPage.test.jsx`

**Interfaces:**
- Consumes: `order.acceptedQuote.estimatedRange`, `order.acceptedQuote.tolerancePolicy`.
- Produces: Clear 2-tiered pricing UI on Quote and Order Detail pages, transparent deposit wording on Payment page, zero hydration console warnings.

- [ ] **Step 1: Write test verifying range pricing and tolerance display on Quote page and Order Detail page**

In `BulkyQuotePage.test.jsx`:
```javascript
it('displays estimated price range and tolerance policy banner', () => {
  // Check that range and tolerance message render
  expect(screen.getByText(/Khoảng giá dự toán/i)).toBeInTheDocument();
  expect(screen.getByText(/dung sai/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/bulky/pages/BulkyQuotePage.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Update `BulkyQuotePage.jsx`, `BulkyPaymentPage.jsx`, and `BulkyOrderDetailPage.jsx`**

- In `BulkyQuotePage.jsx`:
  - Display `Khoảng giá dự toán: minVnd - maxVnd` with highlighted chip.
  - Display `Số tiền tạm giữ chỗ: depositHoldVnd`.
  - Display `Chính sách nghiệm thu dung sai ±15%`.
- In `BulkyPaymentPage.jsx`:
  - Show message: `"Bạn đang thanh toán số tiền tạm giữ chỗ [minVnd]. Quyết toán thực tế dựa trên nghiệm thu khi bàn giao (dung sai ±15% không phụ thu)."`.
- In `BulkyOrderDetailPage.jsx`:
  - Display item list with material tags.
  - Display estimated range and handover tolerance guarantee status (`VERIFIED_WITHIN_TOLERANCE`).
- In `BulkyHeader.jsx`:
  - Replace `<Typography variant="h6">` inside `<DialogTitle>` with `<Typography component="span" variant="h6">` to prevent `<h6>` inside `<h2>` hydration error.
  - Replace `PaperProps` on Dialog with `slotProps={{ paper: { sx: ... } }}` to clean up React DOM warning.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/modules/bulky/pages/BulkyQuotePage.test.jsx src/modules/bulky/pages/BulkyOrderDetailPage.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/modules/bulky/pages/BulkyQuotePage.jsx src/modules/bulky/pages/BulkyPaymentPage.jsx src/modules/bulky/pages/BulkyOrderDetailPage.jsx src/modules/bulky/components/BulkyHeader.jsx src/modules/bulky/pages/BulkyQuotePage.test.jsx
git commit -m "feat(bulky): integrate range pricing and tolerance guarantee into quote, payment, and order detail pages"
```

---

### Task 4: Full Suite Regression Verification & Git Sync

**Files:**
- All bulky test files.

- [ ] **Step 1: Run full bulky test suite**

Run: `npx vitest run src/modules/bulky`
Expected: 14 test files passed, 100% tests passed.

- [ ] **Step 2: Run production build check**

Run: `npm run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Push changes to remote branch**

Run: `git push origin dev-EnglandLee`
Expected: Successfully pushed to `origin/dev-EnglandLee`.
