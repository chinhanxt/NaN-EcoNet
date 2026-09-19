# Streamline Bulky Request Wizard (3-Step Modern GovTech) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Streamline the 6-step bulky waste request wizard into a 3-step modern GovTech experience with in-place Gemini Vision AI recognition, consolidated logistics, and transparent summary.

**Architecture:** Refactor `BulkyRequestWizard.jsx` to define a 3-step Stepper (`['Ảnh đồ vật & AI Quét', 'Địa điểm & Bốc xếp', 'Xem lại & Báo giá']`). Step 1 handles photo uploads and immediate AI detection rendering editable item cards below the photos. Step 2 handles location, requested date, and handling conditions (placement, floor, elevator). Step 3 renders the complete summary and triggers order creation.

**Tech Stack:** React 18, Vite, Material UI (MUI v5), Redux Toolkit, Gemini 2.5 Flash Vision AI, Vitest, React Testing Library.

## Global Constraints
- Developer 3 scope: ONLY touch files in `src/modules/bulky/`, `src/modules/citizen/`, `src/modules/billing/`, `src/store/citizen/`, `src/store/billing/`.
- Do NOT touch `fleet/`, `iot-bins/` (Dev 1) or `tickets/`, `dispatch/`, `routing/` (Dev 2).
- Preserve Redux contract for `createDraftOrder` and `confirmOrderItems`.
- All 13 test suites and 78+ unit/integration tests must pass 100%.

---

### Task 1: Update Validation Functions for 3-Step Flow
**Files:**
- Modify: `src/modules/bulky/features/request/requestValidation.js`
- Test: `src/modules/bulky/features/request/requestValidation.test.js`

**Interfaces:**
- Consumes: `validateRequestItems(items)`, `validateRequestLocation(draft)`, `validateHandlingConditions(conditions)`
- Produces: `validateStep1(items)`, `validateStep2(locationAndConditions)` or step-specific validators for 3 steps.

- [ ] **Step 1: Write test for step validation helpers in requestValidation.test.js**
- [ ] **Step 2: Run vitest to ensure new tests fail as expected**
- [ ] **Step 3: Implement step validation helpers in requestValidation.js**
- [ ] **Step 4: Run vitest to ensure all tests pass**

---

### Task 2: Refactor BulkyRequestWizard to 3 Steps
**Files:**
- Modify: `src/modules/bulky/features/request/BulkyRequestWizard.jsx`

**Step Structure:**
1. **Step 0 (Bước 1): `Ảnh đồ vật & AI Quét tức thì`**
   - Image upload / drag & drop box.
   - Instant Gemini AI vision analysis button & status indicator.
   - Direct inline editable items list (name, catalog code, quantity, dimensions, add item button).
2. **Step 1 (Bước 2): `Địa điểm & Bốc xếp`**
   - Service location dropdown.
   - Requested date picker (tomorrow onwards).
   - Placement selector (Mặt đường / Vỉa hè / Trong nhà).
   - Floor number & elevator switch.
3. **Step 2 (Bước 3): `Xem lại & Báo giá`**
   - Comprehensive summary card (Items + Location + Logistics).
   - Transparent price estimate preview.
   - Submit button: "Xác nhận & Lấy báo giá".

- [ ] **Step 1: Define `STEPS = ['Ảnh đồ vật & AI Quét', 'Địa điểm & Bốc xếp', 'Xem lại & Báo giá']`**
- [ ] **Step 2: Consolidate photo upload, AI analyze trigger, and items editor into Step 0**
- [ ] **Step 3: Consolidate service location, requested date, and handling conditions into Step 1**
- [ ] **Step 4: Consolidate complete summary into Step 2**
- [ ] **Step 5: Verify back/next navigation and submission logic**

---

### Task 3: Update and Verify Unit & Integration Tests
**Files:**
- Modify: `src/modules/bulky/pages/BulkyBookingPage.test.jsx`
- Verify: All 13 test files in `src/modules/bulky/`

- [ ] **Step 1: Update BulkyBookingPage.test.jsx to align with 3-step labels and validation**
- [ ] **Step 2: Run `npx vitest run src/modules/bulky`**
- [ ] **Step 3: Run `npm run build` to verify clean production compilation**

---

### Task 4: Visual & Interactive Sanity Check
- [ ] **Step 1: Check UI on dev server (`http://localhost:3000/bulky/booking`)**
- [ ] **Step 2: Verify smooth transition from Step 1 -> Step 2 -> Step 3 -> Quote Page**
