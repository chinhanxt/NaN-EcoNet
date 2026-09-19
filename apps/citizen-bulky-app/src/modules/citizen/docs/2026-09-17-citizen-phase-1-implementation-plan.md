# Citizen Portal Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mock-backed, testable Citizen Portal core that securely selects an authorized household and presents telemetry, collection history/evidence, complaints, and read-only Billing/Bulky histories.

**Architecture:** Implement feature-oriented React modules behind fixed service ports. Redux stores normalized Citizen entities and active-household/request state; a versioned mock adapter persists deterministic demo data in user-scoped `localStorage`. The module exports routes and reducers but does not modify shared router/store files.

**Tech Stack:** React 19, React Router 7, Redux Toolkit 2, React Redux 9, MUI 9, Vitest, React Testing Library, JavaScript/JSX.

---

## Scope and prerequisites

This plan implements only Phase 1 from `src/modules/citizen/docs/2026-09-17-citizen-portal-design.md`. Membership administration and notifications remain Phase 2/3 work.

Vitest and React Testing Library are mandatory prerequisites. Dev 3 must not edit `package.json` or `package-lock.json`. If the packages are absent, stop after Task 0 and ask the shared dependency owner to merge a separate dependency PR containing:

```text
vitest
jsdom
@testing-library/react
@testing-library/user-event
@testing-library/jest-dom
```

Do not substitute untested implementation work while this prerequisite is unresolved.

DOM tests do not require a shared Vitest configuration change. Every `*.test.jsx` file must start with `// @vitest-environment jsdom`, and `src/modules/citizen/testing/renderCitizen.jsx` must import `@testing-library/jest-dom/vitest`. Pure `*.test.js` files remain in the default Node environment.

## Locked file structure

```text
src/modules/citizen/
├── CitizenModuleProvider.jsx       # Service dependency injection
├── sessionLifecycle.js             # Ordered persistence cleanup + Redux reset
├── index.js                        # Public module exports
├── routes.jsx                      # Named citizenRoutes array
├── domain/
│   ├── capabilities.js             # Fixed roles/capabilities and guards
│   ├── constants.js                # Status/category enums
│   ├── errors.js                   # CitizenServiceError
│   ├── householdSelection.js       # Active-household and QR resolution
│   ├── telemetry.js                # Telemetry quality rules
│   └── dateTime.js                 # Asia/Ho_Chi_Minh formatting
├── services/
│   ├── citizenServiceContract.js   # Port documentation and result helpers
│   └── mock/
│       ├── createMockCitizenServices.js
│       ├── mockSeed.js
│       └── mockStorage.js
├── features/
│   ├── dashboard/
│   │   ├── HouseholdSwitcher.jsx
│   │   ├── HouseholdSummaryCard.jsx
│   │   ├── BinStatusCard.jsx
│   │   ├── NextCollectionCard.jsx
│   │   ├── BillingSummaryCard.jsx
│   │   └── BulkySummaryCard.jsx
│   ├── collections/
│   │   ├── CollectionHistoryList.jsx
│   │   └── CollectionEvidenceDialog.jsx
│   └── complaints/
│       ├── ComplaintForm.jsx
│       ├── ComplaintList.jsx
│       ├── ComplaintTimeline.jsx
│       └── complaintValidation.js
├── hooks/
│   └── useCitizenBootstrap.js      # Session/membership/household loading
├── pages/
│   ├── CitizenPortalPage.jsx
│   ├── CitizenHistoryPage.jsx
│   ├── CitizenComplaintsPage.jsx
│   ├── CitizenComplaintDetailPage.jsx
│   ├── CitizenFinancesPage.jsx
│   └── CitizenBulkyOrdersPage.jsx
└── testing/
    ├── createCitizenTestStore.js
    └── renderCitizen.jsx

src/store/citizen/
├── citizenSlice.js                 # Shared Citizen state transitions
├── selectors.js                    # Capability-aware selectors
└── index.js                        # Reducer/actions/selectors exports
```

Tests are colocated next to the file under test using `*.test.js` or `*.test.jsx`.

## Task 0: Verify prerequisites and baseline

**Files:** None.

- [ ] **Step 1: Confirm branch, scope, and clean starting state**

Run:

```bash
git branch --show-current
git status --short
```

Expected: branch is `dev-EnglandLee`; no unrelated worktree changes. Preserve any user changes if present.

- [ ] **Step 2: Check required test packages without changing dependencies**

Run:

```bash
npm ls vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Expected: exit 0 with all packages listed. If packages are missing, stop and request the shared dependency PR described above.

The dependency-owner PR does not need to edit `vite.config.js`; Phase 1 uses per-file jsdom directives and the shared Citizen test render helper imports the jest-dom matchers.

- [ ] **Step 3: Establish a fresh baseline**

Run:

```bash
npm run lint
npm run build
npx vitest run
```

Expected: all commands exit 0. Record pre-existing failures before changing source.

## Task 1: Implement domain rules

**Files:**
- Create: `src/modules/citizen/domain/constants.js`
- Create: `src/modules/citizen/domain/capabilities.js`
- Create: `src/modules/citizen/domain/errors.js`
- Create: `src/modules/citizen/domain/householdSelection.js`
- Create: `src/modules/citizen/domain/telemetry.js`
- Create: `src/modules/citizen/domain/dateTime.js`
- Test: `src/modules/citizen/domain/capabilities.test.js`
- Test: `src/modules/citizen/domain/householdSelection.test.js`
- Test: `src/modules/citizen/domain/telemetry.test.js`
- Test: `src/modules/citizen/domain/dateTime.test.js`

- [ ] **Step 1: Write failing capability tests**

Cover representative full access, member defaults, optional financial/Bulky grants, and the rule that `MANAGE_MEMBERS` is never member-grantable.

```js
import { describe, expect, it } from 'vitest';
import { CAPABILITIES, defaultCapabilitiesForRole, can } from './capabilities';

describe('citizen capabilities', () => {
  it('does not grant financial data to a default member', () => {
    const capabilities = defaultCapabilitiesForRole('MEMBER');
    expect(can(capabilities, CAPABILITIES.VIEW_FINANCIALS)).toBe(false);
  });

  it('grants every capability to a representative', () => {
    const capabilities = defaultCapabilitiesForRole('REPRESENTATIVE');
    expect(can(capabilities, CAPABILITIES.MANAGE_MEMBERS)).toBe(true);
  });
});
```

- [ ] **Step 2: Write failing household-selection tests**

Cover authorized QR, unauthorized/unknown QR returning the same denial, previous active household, and first-active fallback.

```js
expect(resolveHouseholdSelection({ memberships, qrHouseholdId: 'hh-2' })).toEqual({
  status: 'AUTHORIZED',
  householdId: 'hh-2',
});
expect(resolveHouseholdSelection({ memberships, qrHouseholdId: 'hidden' })).toEqual({
  status: 'DENIED',
});
```

- [ ] **Step 3: Write failing telemetry tests**

Verify `SENSOR_FAULT` wins over age, missing samples become `OFFLINE`, old samples become `STALE`, and missing fill level remains `null` rather than `0`. Also test invalid/unparseable `capturedAt`, non-numeric fill, and fill outside `0..100`; invalid samples must return `quality: 'SENSOR_FAULT'` and `fillLevelPercent: null`.

Use locked defaults `staleAfterMs = 5 * 60 * 1000` and `offlineAfterMs = 30 * 60 * 1000` so mock and UI tests are deterministic.

- [ ] **Step 4: Write failing date/time tests**

Verify the formatter always uses locale `vi-VN` and time zone `Asia/Ho_Chi_Minh` regardless of the machine time zone.

- [ ] **Step 5: Run tests and confirm RED**

Run:

```bash
npx vitest run src/modules/citizen/domain
```

Expected: FAIL because domain modules do not exist.

- [ ] **Step 6: Implement the minimum domain modules**

`constants.js` must export frozen enums for service status, telemetry quality, collection status, complaint category/status, payment/refund status, and related-entity type. `errors.js` must export `CitizenServiceError` and the fixed error codes from the spec.

`telemetry.js` should expose a pure function:

```js
export const classifyTelemetry = ({
  snapshot,
  now,
  staleAfterMs = 5 * 60 * 1000,
  offlineAfterMs = 30 * 60 * 1000,
}) => {
  if (!snapshot) return { quality: 'OFFLINE', fillLevelPercent: null };
  if (snapshot.isSensorFault) return { ...snapshot, quality: 'SENSOR_FAULT' };
  const capturedAtMs = Date.parse(snapshot.capturedAt);
  const rawFill = snapshot.fillLevelPercent;
  const fill = rawFill === null || rawFill === undefined || String(rawFill).trim() === ''
    ? Number.NaN
    : Number(rawFill);
  if (!Number.isFinite(capturedAtMs) || !Number.isFinite(fill) || fill < 0 || fill > 100) {
    return { ...snapshot, fillLevelPercent: null, quality: 'SENSOR_FAULT' };
  }
  const age = now - capturedAtMs;
  if (age > offlineAfterMs) return { ...snapshot, quality: 'OFFLINE' };
  if (age > staleAfterMs) return { ...snapshot, quality: 'STALE' };
  return { ...snapshot, fillLevelPercent: fill, quality: 'FRESH' };
};
```

`dateTime.js` must wrap `Intl.DateTimeFormat('vi-VN', { ...options, timeZone: 'Asia/Ho_Chi_Minh' })` so the locked time zone cannot be overridden by callers or the browser default.

- [ ] **Step 7: Run tests and confirm GREEN**

Run: `npx vitest run src/modules/citizen/domain`

Expected: all domain tests pass.

- [ ] **Step 8: Commit domain rules**

```bash
git add src/modules/citizen/domain
git commit -m "feat(citizen): add portal domain rules"
```

## Task 2: Build the versioned mock service layer

**Files:**
- Create: `src/modules/citizen/services/citizenServiceContract.js`
- Create: `src/modules/citizen/services/mock/mockSeed.js`
- Create: `src/modules/citizen/services/mock/mockStorage.js`
- Create: `src/modules/citizen/services/mock/createMockCitizenServices.js`
- Test: `src/modules/citizen/services/mock/mockStorage.test.js`
- Test: `src/modules/citizen/services/mock/createMockCitizenServices.test.js`

- [ ] **Step 1: Write failing storage tests**

Test keys namespaced as `smartbin:citizen:v1:<userId>`, deterministic reseeding, reset, schema mismatch, user isolation, and complete deletion on logout.

- [ ] **Step 2: Write failing service contract tests**

Test the exact Phase 1 operations from the spec, abort handling, `CitizenServiceError`, and pagination shape `{ items, nextCursor }`. Construct services with `createMockCitizenServices({ userId, storage, now })`. Every household/resource operation must resolve ownership and verify that the bound user has an active membership before returning data. Unknown and unauthorized household/resource IDs must both reject with the same non-disclosing `{ code: 'FORBIDDEN' }`.

Enforce this operation-to-capability map inside the service, in addition to UI/selector checks:

```text
getHousehold, getTelemetry, getUpcomingVisit -> VIEW_OPERATIONS
listVisits, getVisitEvidence               -> VIEW_COLLECTION_HISTORY
listComplaints, getComplaint,
createComplaint, requestReview              -> CREATE_COMPLAINT
listMonthlyInvoices                         -> VIEW_FINANCIALS
listBulkyOrders                             -> VIEW_BULKY_ORDERS
```

```js
await expect(services.summaries.listMonthlyInvoices('hh-1')).rejects.toMatchObject({
  code: 'FORBIDDEN',
});
```

Also test cross-user isolation for household profile, telemetry, visits, evidence, complaints, invoices, Bulky orders, and draft IDs. No method may trust a caller-provided household ID without the bound-user membership check.

- [ ] **Step 3: Run tests and confirm RED**

Run: `npx vitest run src/modules/citizen/services`

Expected: FAIL because mock services are missing.

- [ ] **Step 4: Define deterministic seed scenarios**

Include at least:

- Representative with two households.
- Default member without financial/Bulky read access.
- Fresh, stale, offline, and sensor-fault telemetry.
- Active, grace, pending-review, suspended, and restored service banners.
- Upcoming/completed/missed collection visits with evidence.
- Complaint in every Phase 1 state.
- Monthly invoices with unpaid, partial, paid, overdue, adjusted, pending payment, and refund states.
- Bulky orders with active, completed, cancelled, and refund states.

- [ ] **Step 5: Implement storage and mock services**

Clone seed data before mutation. Every async method must accept an optional `AbortSignal`, simulate deterministic latency, reject aborted calls with `AbortError`, and return cloned values so callers cannot mutate repository state directly.

The bound bundle must expose `services.session.clear()` plus complaint draft operations `listDrafts()`, `saveDraft({ clientDraftId, ...draft })`, and `deleteDraft(clientDraftId)`. `clientDraftId` is also required by `createComplaint({ clientDraftId, ...input })`. Persist an idempotency map from `clientDraftId` to the server-issued `complaintId`; retrying after success—including a simulated lost response—returns the same complaint and never creates a second record. Saving the same draft ID updates one draft rather than creating duplicates. `session.clear()` removes the bound user's storage namespace and invalidates the bundle so later calls reject `UNAUTHENTICATED`.

- [ ] **Step 6: Run service tests and confirm GREEN**

Run: `npx vitest run src/modules/citizen/services`

Expected: all mock storage and port tests pass.

- [ ] **Step 7: Commit mock services**

```bash
git add src/modules/citizen/services
git commit -m "feat(citizen): add versioned mock services"
```

## Task 3: Add Citizen Redux state and capability-aware selectors

**Files:**
- Create: `src/store/citizen/citizenSlice.js`
- Create: `src/store/citizen/selectors.js`
- Create: `src/store/citizen/index.js`
- Test: `src/store/citizen/citizenSlice.test.js`
- Test: `src/store/citizen/selectors.test.js`
- Create: `src/modules/citizen/testing/createCitizenTestStore.js`

- [ ] **Step 1: Write failing reducer tests**

Cover identity, memberships, active household, per-household entity caches, request IDs, hydrated complaint drafts, draft save/delete results, and logout reset.

- [ ] **Step 2: Write failing selector tests**

Prove that financial/Bulky selectors return no protected entities without the corresponding capability, even if stale entities exist in the store.

```js
expect(selectVisibleInvoices(memberState)).toEqual([]);
expect(selectVisibleBulkyOrders(memberState)).toEqual([]);
```

- [ ] **Step 3: Run tests and confirm RED**

Run: `npx vitest run src/store/citizen`

Expected: FAIL because the slice and selectors are missing.

- [ ] **Step 4: Implement normalized Phase 1 state**

Use this top-level shape:

```js
const initialState = {
  identity: null,
  memberships: [],
  activeHouseholdId: null,
  households: {},
  telemetry: {},
  visits: {},
  complaints: {},
  invoices: {},
  bulkyOrders: {},
  drafts: {},
  draftsHydrated: false,
  requests: {},
};
```

Reducers receiving async results must also receive `{ requestId, householdId }` and ignore responses that do not match the active request context.

- [ ] **Step 5: Export reducer/actions/selectors without touching shared store**

`src/store/citizen/index.js` exports `citizenReducer`, `citizenActions`, and named selectors. Do not modify `src/store/index.js`.

- [ ] **Step 6: Run tests and confirm GREEN**

Run: `npx vitest run src/store/citizen`

Expected: all reducer and selector tests pass.

- [ ] **Step 7: Commit Citizen state**

```bash
git add src/store/citizen src/modules/citizen/testing/createCitizenTestStore.js
git commit -m "feat(citizen): add portal state and selectors"
```

## Task 4: Implement service injection and portal bootstrap

**Files:**
- Create: `src/modules/citizen/CitizenModuleProvider.jsx`
- Create: `src/modules/citizen/sessionLifecycle.js`
- Create: `src/modules/citizen/hooks/useCitizenBootstrap.js`
- Create: `src/modules/citizen/testing/renderCitizen.jsx`
- Test: `src/modules/citizen/hooks/useCitizenBootstrap.test.jsx`
- Test: `src/modules/citizen/sessionLifecycle.test.js`

- [ ] **Step 1: Write failing bootstrap tests**

Start the JSX test with `// @vitest-environment jsdom`. Test unauthenticated return URL through the existing `sessionStorage.postLogin` key, session user ID to membership lookup, QR parameter `household`, first-active fallback, parallel section loading, draft hydration, abort on household switch, stale-response rejection, and non-disclosing denial. Also change the authenticated session user during the test and prove the old Citizen Redux state is reset before any new-user household data renders.

Write a separate lifecycle test proving `clearCitizenSession({ services, dispatch })` awaits `services.session.clear()` before dispatching the Redux reset action, and still resets Redux while surfacing a storage-cleanup error to the caller.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run src/modules/citizen/hooks/useCitizenBootstrap.test.jsx src/modules/citizen/sessionLifecycle.test.js`

Expected: FAIL because provider/hook do not exist.

- [ ] **Step 3: Implement `CitizenModuleProvider`**

Provide the service bundle through React context. Read `state.session.user?.id` and create the default bundle with `createMockCitizenServices({ userId })`. Memoize per user ID, never globally. When the authenticated user changes, invalidate and clear the previous bundle before exposing data for the new user. Tests may inject an explicitly user-bound bundle.

`renderCitizen.jsx` imports `@testing-library/jest-dom/vitest` and builds a Redux store with both a minimal session reducer and `citizenReducer`.

- [ ] **Step 4: Implement `useCitizenBootstrap`**

Use the existing Traccar `state.session.user.id` only as the authenticated user ID. Fetch Smartbin memberships separately. Hydrate drafts through the bound complaint service before rendering draft counts. Use `AbortController`, unique request IDs, and capability checks before invoking summary services.

- [ ] **Step 5: Implement ordered session cleanup**

`clearCitizenSession({ services, dispatch })` is an exported async function, not a plain Redux action:

```js
export const clearCitizenSession = async ({ services, dispatch }) => {
  let cleanupError;
  try {
    await services.session.clear();
  } catch (error) {
    cleanupError = error;
  } finally {
    dispatch(citizenActions.reset());
  }
  if (cleanupError) throw cleanupError;
};
```

The shared logout owner must await this function before clearing the root session. The provider's user-change cleanup is a defense-in-depth fallback, not the primary logout integration.

- [ ] **Step 6: Run the focused test and confirm GREEN**

Run: `npx vitest run src/modules/citizen/hooks/useCitizenBootstrap.test.jsx src/modules/citizen/sessionLifecycle.test.js`

Expected: all bootstrap and ordered-cleanup cases pass.

- [ ] **Step 7: Commit runtime/bootstrap**

```bash
git add src/modules/citizen/CitizenModuleProvider.jsx src/modules/citizen/sessionLifecycle.js src/modules/citizen/hooks src/modules/citizen/testing/renderCitizen.jsx
git commit -m "feat(citizen): add module bootstrap"
```

## Task 5: Build the dashboard

**Files:**
- Create: `src/modules/citizen/features/dashboard/HouseholdSwitcher.jsx`
- Create: `src/modules/citizen/features/dashboard/HouseholdSummaryCard.jsx`
- Create: `src/modules/citizen/features/dashboard/BinStatusCard.jsx`
- Create: `src/modules/citizen/features/dashboard/NextCollectionCard.jsx`
- Create: `src/modules/citizen/features/dashboard/BillingSummaryCard.jsx`
- Create: `src/modules/citizen/features/dashboard/BulkySummaryCard.jsx`
- Create: `src/modules/citizen/pages/CitizenPortalPage.jsx`
- Test: `src/modules/citizen/pages/CitizenPortalPage.test.jsx`

- [ ] **Step 1: Write failing dashboard tests**

Start with `// @vitest-environment jsdom`. Test independent skeleton/error/retry states, all service-status banners, telemetry quality labels/timestamps, missing fill as unavailable rather than 0%, privacy-safe ETA, household switching, and capability-hidden financial/Bulky cards.

Add explicit invariant assertions:

- A `SUSPENDED` household still calls the telemetry service and renders the environmental-monitoring card.
- `GRACE_PERIOD` and `PENDING_SUSPENSION_REVIEW` still call/render upcoming collection service.
- Debt days alone never produce a suspended banner.
- A member without financial/Bulky read capability triggers neither protected service call nor cached entity rendering.
- A member without `VIEW_OPERATIONS` triggers no household, telemetry, or upcoming-collection service call and sees the access-denied state.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run src/modules/citizen/pages/CitizenPortalPage.test.jsx`

Expected: FAIL because dashboard components do not exist.

- [ ] **Step 3: Implement the responsive dashboard shell**

Use MUI cards and existing project conventions. Mobile is one column; tablet/desktop uses a two-column card grid. Each card owns its loading, empty, stale, error, and retry presentation.

- [ ] **Step 4: Implement safety-critical display rules**

- Always show telemetry `capturedAt` and a text quality label.
- Never render missing fill as `0%`.
- Show collection continues for `GRACE_PERIOD` and `PENDING_SUSPENSION_REVIEW`.
- Show that IoT monitoring remains active for `SUSPENDED`.
- Never expose full route or driver personal data.
- Hide both card and service invocation when read capability is absent.

- [ ] **Step 5: Run dashboard and accessibility assertions**

Run: `npx vitest run src/modules/citizen/pages/CitizenPortalPage.test.jsx`

Expected: PASS; queries use roles/names rather than implementation classes.

- [ ] **Step 6: Commit dashboard**

```bash
git add src/modules/citizen/features/dashboard src/modules/citizen/pages/CitizenPortalPage.jsx
git commit -m "feat(citizen): add household dashboard"
```

## Task 6: Add collection history and evidence

**Files:**
- Create: `src/modules/citizen/features/collections/CollectionHistoryList.jsx`
- Create: `src/modules/citizen/features/collections/CollectionEvidenceDialog.jsx`
- Create: `src/modules/citizen/pages/CitizenHistoryPage.jsx`
- Test: `src/modules/citizen/pages/CitizenHistoryPage.test.jsx`

- [ ] **Step 1: Write failing collection-history tests**

Start with `// @vitest-environment jsdom`. Cover pagination, scheduled/completed/missed/cancelled/rescheduled status, result summary, evidence loading, no-evidence state, and `VIEW_COLLECTION_HISTORY` denial. Assert that denial causes no visits/evidence service call even when cached entities exist. Add an explicit case where only arrival/geofence data exists and assert that the UI does not render “đã thu gom”, “hoàn thành”, or equivalent proof wording.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run src/modules/citizen/pages/CitizenHistoryPage.test.jsx`

- [ ] **Step 3: Implement history and evidence UI**

Evidence must show only household-safe fields: evidence timestamp, collection result, redacted attachment references, and verification status. Arrival/geofence alone must never be labelled proof of collection.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npx vitest run src/modules/citizen/pages/CitizenHistoryPage.test.jsx`

Expected: all history/evidence tests pass.

- [ ] **Step 5: Commit collection history**

```bash
git add src/modules/citizen/features/collections src/modules/citizen/pages/CitizenHistoryPage.jsx
git commit -m "feat(citizen): add collection history"
```

## Task 7: Implement complaints and offline drafts

**Files:**
- Create: `src/modules/citizen/features/complaints/complaintValidation.js`
- Create: `src/modules/citizen/features/complaints/ComplaintForm.jsx`
- Create: `src/modules/citizen/features/complaints/ComplaintList.jsx`
- Create: `src/modules/citizen/features/complaints/ComplaintTimeline.jsx`
- Create: `src/modules/citizen/pages/CitizenComplaintsPage.jsx`
- Create: `src/modules/citizen/pages/CitizenComplaintDetailPage.jsx`
- Test: `src/modules/citizen/features/complaints/complaintValidation.test.js`
- Test: `src/modules/citizen/pages/CitizenComplaintsPage.test.jsx`
- Test: `src/modules/citizen/pages/CitizenComplaintDetailPage.test.jsx`

- [ ] **Step 1: Write failing validation tests**

Require category, trimmed description, authorized related entity, allowed attachment metadata, and review reason. Validation must be pure and return field-keyed messages.

Phase 1 attachment metadata is fixed as:

```text
name: non-empty string
mimeType: image/jpeg | image/png | image/webp
sizeBytes: integer from 1 through 5_242_880
mockObjectUrl?: string used only within the current mock session
```

Allow at most three attachments per complaint. Persist only metadata; never persist Blob data or object URLs. After refresh, a draft with former attachments must tell the user to reselect those files before submission. Production upload tokens/endpoints are deferred to the backend contract.

- [ ] **Step 2: Write failing workflow tests**

Start JSX tests with `// @vitest-environment jsdom`. Cover pessimistic submission, server-issued complaint ID, offline draft labelling, persisted draft hydration after remount, attachment-reselection warning, retry after a lost response with the same `clientDraftId` returning the same `complaintId`, timeline states, reasoned response, review request, `CREATE_COMPLAINT` denial with no complaint service calls or cached complaint rendering, and incorrect-charge non-mutation.

- [ ] **Step 3: Run tests and confirm RED**

Run: `npx vitest run src/modules/citizen/features/complaints src/modules/citizen/pages/CitizenComplaint`

- [ ] **Step 4: Implement complaint form/list/detail**

Do not display “submitted” until `createComplaint` returns an ID. Offline save must call `services.complaints.saveDraft`, then dispatch the returned persisted draft into Redux and say “Bản nháp — chưa gửi”. On bootstrap, hydrate Redux with `listDrafts`. Successful submission deletes the persisted draft only after the server-issued complaint ID is stored. Incorrect-charge responses may link to a Billing adjustment reference but never dispatch invoice/payment actions.

- [ ] **Step 5: Implement logout draft warning and deletion**

Expose a selector for unsent drafts so the shared logout integration can warn. Re-export the async `clearCitizenSession` lifecycle function from Task 4; do not create a misleading plain Redux action. Do not edit the shared logout component in this branch.

- [ ] **Step 6: Run tests and confirm GREEN**

Run: `npx vitest run src/modules/citizen/features/complaints src/modules/citizen/pages/CitizenComplaint`

Expected: all validation and workflow tests pass.

- [ ] **Step 7: Commit complaints**

```bash
git add src/modules/citizen/features/complaints src/modules/citizen/pages/CitizenComplaint* src/store/citizen
git commit -m "feat(citizen): add tracked complaints"
```

## Task 8: Add read-only finance and bulky histories

**Files:**
- Create: `src/modules/citizen/pages/CitizenFinancesPage.jsx`
- Create: `src/modules/citizen/pages/CitizenBulkyOrdersPage.jsx`
- Test: `src/modules/citizen/pages/CitizenFinancesPage.test.jsx`
- Test: `src/modules/citizen/pages/CitizenBulkyOrdersPage.test.jsx`

- [ ] **Step 1: Write failing finance tests**

Cover invoice/payment/refund states, pagination, absence of mutation controls, `VIEW_FINANCIALS` denial, and separation from bulky charges.

- [ ] **Step 2: Write failing bulky-history tests**

Cover order/payment/refund states, pagination, hidden booking mutation before Bulky routes exist, and `VIEW_BULKY_ORDERS` denial.

- [ ] **Step 3: Run tests and confirm RED**

Run: `npx vitest run src/modules/citizen/pages/CitizenFinancesPage.test.jsx src/modules/citizen/pages/CitizenBulkyOrdersPage.test.jsx`

- [ ] **Step 4: Implement read-only pages**

Use separate lists and labels for monthly invoices and bulky orders. Never aggregate or offset their amounts. Hide mutation CTAs until Billing/Bulky route contracts are registered.

- [ ] **Step 5: Run tests and confirm GREEN**

Run the same focused command. Expected: all tests pass.

- [ ] **Step 6: Commit histories**

```bash
git add src/modules/citizen/pages/CitizenFinancesPage* src/modules/citizen/pages/CitizenBulkyOrdersPage*
git commit -m "feat(citizen): add account histories"
```

## Task 9: Export routes and integration surface

**Files:**
- Create: `src/modules/citizen/routes.jsx`
- Create: `src/modules/citizen/index.js`
- Test: `src/modules/citizen/routes.test.jsx`
- Modify: `src/modules/citizen/docs/2026-09-17-citizen-portal-design.md`

- [ ] **Step 1: Write a failing route-export test**

Assert a named `citizenRoutes` array with exactly the Phase 1 paths and `{ path, element }` entries. Render each element with the Citizen test provider and prove capability-denied routes do not load protected service data.

- [ ] **Step 2: Run the route test and confirm RED**

Run: `npx vitest run src/modules/citizen/routes.test.jsx`

- [ ] **Step 3: Implement route and public exports**

Export these Phase 1 routes:

```text
/citizen
/citizen/history
/citizen/complaints
/citizen/complaints/:complaintId
/citizen/finances
/citizen/bulky-orders
```

Do not export `/citizen/members` or `/citizen/notifications` until their phases are implemented. Do not edit `src/Navigation.jsx`.

- [ ] **Step 4: Document the exact handoff**

Append a short implementation-status section to the design spec listing:

- `citizenRoutes` import path.
- `citizenReducer` import path and required state key `citizen`.
- Required logout hook/action.
- Test prerequisite status.
- Explicit shared files the integrator must edit.

- [ ] **Step 5: Run route tests and confirm GREEN**

Run: `npx vitest run src/modules/citizen/routes.test.jsx`

- [ ] **Step 6: Commit exports and handoff**

```bash
git add src/modules/citizen/routes.jsx src/modules/citizen/index.js src/modules/citizen/routes.test.jsx src/modules/citizen/docs/2026-09-17-citizen-portal-design.md
git commit -m "feat(citizen): export phase one module"
```

## Task 10: Verify Phase 1 and prepare integration handoff

**Files:** No new production files expected.

- [ ] **Step 1: Run all Citizen tests**

Run:

```bash
npx vitest run src/modules/citizen src/store/citizen
```

Expected: all Citizen tests pass with zero failures.

- [ ] **Step 2: Run the full project gates**

Run:

```bash
npm run lint
npm run build
npx vitest run
```

Expected: all commands exit 0 with no warnings promoted to failures.

- [ ] **Step 3: Verify folder ownership**

Run:

```bash
git diff --name-only origin/main...HEAD
```

Expected: implementation changes appear only under `src/modules/citizen/` and `src/store/citizen/`. The previously committed branch instruction files are not implementation changes from this plan.

- [ ] **Step 4: Verify forbidden files are untouched**

Run:

```bash
git diff --quiet origin/main...HEAD -- src/Navigation.jsx src/store/index.js package.json package-lock.json
```

Expected: exit 0.

- [ ] **Step 5: Manually exercise deterministic scenarios**

Verify representative/member access, two-household switching, authorized/unauthorized QR, all telemetry qualities, each service banner, partial dashboard failure, complaint online/offline/review flow, collection evidence, separate monthly/Bulky histories, refund progress, refresh persistence, reset, and logout cleanup.

- [ ] **Step 6: Record integration handoff without editing shared files**

Provide the shared-file owner with route import, reducer import/state key, logout cleanup hook, and the required test/dependency status. Do not perform the integration on this branch.

- [ ] **Step 7: Create a final verification commit only if documentation changed**

```bash
git add src/modules/citizen/docs
git commit -m "docs(citizen): record phase one handoff"
```

Skip this commit when there is no documentation diff.
