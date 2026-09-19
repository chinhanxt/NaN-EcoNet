# Bulky Citizen Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Build citizen-facing mock-backed Bulky functions 13–17: request creation, AI suggestions, versioned quotes, capacity hold/prepayment, and policy-controlled changes/refunds.

**Architecture:** A vertical slice under `src/modules/bulky/` contains pure domain rules, a deterministic versioned mock service, Redux state, accessible React pages, and exported routes/handoff seams. Orders are household-scoped and every protected operation uses a live membership capability resolver.

**Tech Stack:** React 19, React Router 7, Redux Toolkit 2, MUI 9, Vitest 5, React Testing Library 16, JavaScript/JSX, injected clock, AbortSignal.

**Spec:** `src/modules/bulky/docs/2026-09-17-bulky-citizen-design.md`

## Global Constraints

- Edit only `src/modules/bulky/**`; never create `src/store/bulky/`.
- Never edit `src/Navigation.jsx`, `src/store/index.js`, package files, Citizen, or Billing.
- Reads require active membership + `VIEW_BULKY_ORDERS`; drafts and mutations require `MANAGE_BULKY_ORDERS`.
- AI is advisory and never infers exact mass; unsupported/uncertain items cannot reach payment.
- Bulky never reads, mutates, offsets, or blocks on monthly Billing receivables in `BULKY_DEMO_V1`.
- Async mock methods accept a final optional AbortSignal, deterministic latency, deep-cloned input/output, and AbortError.
- Mutations require idempotency keys; unknown and unauthorized resources both return non-disclosing FORBIDDEN.
- Logout clears only ephemeral cache/offline drafts. Durable orders, ledger, refunds, handoffs, and idempotency survive.
- Use TDD and verify current Vitest, scoped ESLint, and production build output before claiming success.

## Locked Files

`src/modules/bulky/domain/{constants,errors,transitions,pricing,policies,dispatchMapper}.js
src/modules/bulky/services/{bulkyServiceContract}.js
src/modules/bulky/services/mock/{mockSeed,mockStorage,createMockBulkyServices}.js
src/modules/bulky/store/{bulkySlice,selectors,index}.js
src/modules/bulky/features/{request,quote,payment,orders}/**
src/modules/bulky/pages/{BulkyOrdersPage,BulkyBookingPage,BulkyQuotePage,BulkyPaymentPage,BulkyOrderDetailPage}.jsx
src/modules/bulky/{routes.jsx,integration.js,index.js}`

Tests are colocated. Every DOM test begins with `// @vitest-environment jsdom`.

### Task 0: Verify prerequisites

**Files:** None.

- [ ] Confirm branch `dev-EnglandLee`, preserve unrelated changes, and verify `npm ls vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @testing-library/dom`.
- [ ] Run `npm run build` and `npx vitest run`; record baseline failures outside Bulky. Do not edit dependencies.
- [ ] Create an isolated feature worktree/branch from the approved spec commit before implementation.

### Task 1: Domain rules and contracts

**Files:** Create six modules under `src/modules/bulky/domain/` and colocated `*.test.js` files.

**Produces:** Frozen enums; `BulkyServiceError`; `transitionOrder(current,event)`; `calculateQuote({confirmedItems,handlingConditions,serviceArea,priceBook,now})`; `evaluateAiResult(input)`; `evaluateChangePolicy({order,requestedAt,now,policy})`; `toDispatchBulkyWasteOrder(order)`; `createDispatchEvent(order,type)`.

- [ ] Write RED tests for the complete order graph, independent payment/refund/hold states, expiry, AI manual-review lockout, pre/post-cutoff change policy, integer VND arithmetic, no inferred mass, and exact Dev 2 handoff/event ID `<orderId>:<confirmationVersion>:<type>`.
- [ ] Implement explicit transition tables and pure injected-clock rules. Preserve the old confirmed booking until an accepted change proposal settles; unpaid cancellation releases capacity without refund.
- [ ] Run `npx vitest run src/modules/bulky/domain`, `npx eslint src/modules/bulky/domain`, and `npm run build`; commit `feat(bulky): add booking domain rules`.

### Task 2: Versioned mock services

**Files:** `services/bulkyServiceContract.js`, `services/mock/mockSeed.js`, `mockStorage.js`, `createMockBulkyServices.js`, and two colocated test files.

**Consumes:** Task 1 domain exports. **Produces:** `createMockBulkyServices({userId,membershipResolver,storage,now,scenario})` with catalog, recognition, orders, reviews, capacity, quotes, payments, latePayments, changes, refunds, and session groups.

- [ ] Write RED tests for shared durable repository key `smartbin:bulky:v1:repository`, per-user cache/offline-draft keys, schema reset, clone isolation, live membership revocation, capabilities, all AI/capacity/payment/order/refund scenarios, pagination, aborts, and idempotency.
- [ ] Implement household authorization on every operation, service-location snapshots, synthetic scenarios, and current membership resolution. Reads require `VIEW_BULKY_ORDERS`; mutations require `MANAGE_BULKY_ORDERS`.
- [ ] Implement atomic `quotes.reserveAndCreate(orderId,date,key,signal)` returning `{order,quote,hold}`, one-time expiry materialization, exact payment validation, durable ledger, and versioned UPSERT/CANCEL outbox.
- [ ] Implement `latePayments.acceptRevalidatedSlot`, `latePayments.acceptAlternativeDate`, `latePayments.chooseRefund`, change proposals, provider-failure choices, review refresh, refunds, draft isolation, duplicate callbacks, and logout invalidation.
- [ ] Run `npx vitest run src/modules/bulky/services`, `npx eslint src/modules/bulky/services`, and `npm run build`; commit `feat(bulky): add versioned mock services`.

### Task 3: Redux state and selectors

**Files:** `src/modules/bulky/store/{bulkySlice,selectors,index}.js` and colocated tests.

**Consumes:** Task 2 service ports. **Produces:** normalized orders, quotes, holds, payments, refunds, change requests, late-payment resolutions, pagination, request contexts, `createBulkyThunks(services)`, and selectors `selectCanReadBulky`, `selectCanManageBulky`, `selectOrderActions`, `selectPaymentState`, `selectRefundProgress`.

- [ ] Write RED tests for independent loading/errors, stale-response protection, pessimistic mutations, serializability, capability gating, and service denial.
- [ ] Implement thunks with request contexts and obsolete-request aborts. Store no File, object URL, AbortController, service instance, or raw Error.
- [ ] Run `npx vitest run src/modules/bulky/store`, `npx eslint src/modules/bulky/store`, and `npm run build`; commit `feat(bulky): add booking redux state`.

### Task 4: Request wizard and AI confirmation

**Files:** request feature components, `requestValidation.js`, `pages/BulkyBookingPage.jsx`, and colocated DOM tests.

**Consumes:** Task 2 ports and Task 3 thunks/selectors. **Produces:** draft with authorized `serviceLocationId`, image metadata, description, date, confirmed items, and handling conditions.

- [ ] Write RED tests for six stages: authorized location/evidence/date, suggested/low-confidence/manual-review AI, editable confirmation, dimensions/count, floor/lift/access/disassembly, unsupported category, offline draft label, remount file-reselection warning.
- [ ] Implement labelled mobile MUI wizard. Keep File objects outside Redux, persist safe metadata only, and never show payment for unconfirmed/manual-review requests.
- [ ] Run `npx vitest run src/modules/bulky/features/request src/modules/bulky/pages/BulkyBookingPage.test.jsx`, `npx eslint src/modules/bulky/features/request src/modules/bulky/pages/BulkyBookingPage.jsx`, and `npm run build`; commit `feat(bulky): add request and recognition wizard`.

### Task 5: Capacity, quote, and payment UI

**Files:** quote/payment feature components, `BulkyQuotePage.jsx`, `BulkyPaymentPage.jsx`, and colocated DOM tests.

**Consumes:** capacity preview, atomic quote/hold, quote acceptance, payment start/simulation, and late-payment ports.

- [ ] Write RED tests for available/alternative/unavailable capacity, cutoff and hold expiry, itemized versioned quote, success/failure/late-success payment, duplicate/mismatched transaction, alternative-date acceptance, and refund choice.
- [ ] Implement pessimistic UI showing line items, scope, exclusions, policy, expiry, separate payment/refund states, and authoritative late-payment reconciliation. Do not mark confirmed before the service response.
- [ ] Run `npx vitest run src/modules/bulky/features/quote src/modules/bulky/features/payment src/modules/bulky/pages/BulkyQuotePage.test.jsx src/modules/bulky/pages/BulkyPaymentPage.test.jsx`, `npx eslint src/modules/bulky/features/quote src/modules/bulky/features/payment src/modules/bulky/pages/BulkyQuotePage.jsx src/modules/bulky/pages/BulkyPaymentPage.jsx`, and `npm run build`; commit `feat(bulky): add quote capacity and payment flow`.

### Task 6: Order history, changes, and refunds

**Files:** order feature components, `BulkyOrdersPage.jsx`, `BulkyOrderDetailPage.jsx`, and colocated DOM tests.

**Consumes:** order/change/review/provider-failure/refund services and selectors.

- [ ] Write RED tests for separate statuses, pagination, pre-cutoff cancel/reschedule, reviewed post-cutoff requests, equal/higher/lower settlement, in-progress/completed denial, provider failure, late alternatives, refund progress, and support/retry.
- [ ] Implement timeline and dialogs with conflict reload, generic denial, explicit financial consequences, old-booking preservation, and accessible keyboard/focus-safe status presentation.
- [ ] Run `npx vitest run src/modules/bulky/features/orders src/modules/bulky/pages/BulkyOrdersPage.test.jsx src/modules/bulky/pages/BulkyOrderDetailPage.test.jsx`, `npx eslint src/modules/bulky/features/orders src/modules/bulky/pages/BulkyOrdersPage.jsx src/modules/bulky/pages/BulkyOrderDetailPage.jsx`, and `npm run build`; commit `feat(bulky): add order changes and refund tracking`.

### Task 7: Routes, exports, and Dev 2 handoff

**Files:** `routes.jsx`, `integration.js`, `index.js`, and colocated route/integration tests.

**Produces:** five route entries, public reducer/actions/selectors/service exports, `toDispatchBulkyWasteOrder`, and typed versioned `UPSERT`/`CANCEL` events deduped by `eventId`. Dev 0 receives the live `membershipResolver`; Dev 2 receives only exported outbox events.

- [ ] Write RED tests for route paths/elements, public exports, exact shared `BulkyWasteOrder` shape, unpaid rejection, one event per confirmation version, accepted replacement, cancellation event, and retry dedupe.
- [ ] Implement exports without global file edits. Initial confirmation emits version 1 UPSERT; accepted replacement increments version; confirmed cancellation emits CANCEL.
- [ ] Run `npx vitest run src/modules/bulky/routes.test.jsx src/modules/bulky/integration.test.js`, `npx eslint src/modules/bulky/routes.jsx src/modules/bulky/integration.js src/modules/bulky/index.js`, and `npm run build`; commit `feat(bulky): export citizen routes and dispatch handoff`.

### Task 8: Full verification and handoff

**Files:** None unless a scoped correction is required.

- [ ] Run `npx vitest run src/modules/bulky`, `npx eslint src/modules/bulky`, `npm run build`, `git diff --check`, and `git status --short`.
- [ ] Verify only `src/modules/bulky/**` changed, no secrets/generated files/global edits exist, Redux is serializable, and baseline failures outside scope are documented.
- [ ] Handoff commits, exports, mock scenarios, Dev 0/Dev 2 integration steps, and explicit statement that production AI/payment/dispatch/refund integrations are not included.
