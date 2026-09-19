# Citizen Portal Design Specification

**Date:** 2026-09-17  
**Branch:** `dev-EnglandLee`  
**Owner:** Dev 3  
**Status:** Approved design; awaiting user review

## 1. Purpose

This specification defines the household-facing Citizen Portal for Smartbin. It covers household access, bin telemetry display, collection schedules and evidence, citizen complaints, household membership, and notifications.

The module is frontend-first and contract-first. It must run against a deterministic mock repository for demonstrations and tests while preserving service interfaces that can later be backed by production APIs. The Traccar session supplies an authenticated user identifier only. The Smartbin waste-management backend remains authoritative for household membership and capabilities, payments, collection operations, and state transitions.

## 2. Source requirements

The design follows pages 8–13 of `quy-trinh-thu-gom-iot-traccar-ai (1).pdf` and the cross-cutting rules on pages 1–7.

Key requirements are:

- Each household has its own service profile, contract, address, and bin.
- A QR code locates a household profile but never proves ownership or access.
- Citizens can view bin fill level, odor signal, data freshness, the next collection, collection history, evidence, invoices, bulky orders, support requests, and refund progress.
- Complaints remain independent from payment status and require a reasoned response.
- Stale, offline, or faulty telemetry must remain visible with its quality and timestamp; missing data must never be converted to a zero reading.
- Monthly fees and bulky-waste charges remain separate bounded contexts and separate receivables.
- Service suspension requires policy checks and approval by an authorized person. Environmental telemetry continues while collection service is suspended.

## 3. Scope

### 3.1 Included

- Reuse of the authenticated Traccar session as the authentication source and user identifier, followed by an independent Smartbin membership lookup.
- Household membership and active-household selection.
- Representative/member capability-based authorization in the UI.
- QR household selection after membership authorization.
- Citizen overview dashboard.
- Bin telemetry display with explicit quality state.
- Collection schedule, status, ETA, history, and evidence summary.
- Complaint creation, tracking, responses, and review requests.
- Household invitations, membership acceptance, capability changes, and revocation.
- In-app notification inbox and per-category channel preferences.
- Read-only Billing and Bulky summary cards with navigation into their modules.
- Versioned mock repository with deterministic seed data, per-user persistence, and reset support.
- Offline cached reads and complaint drafts, with the retention policy in section 9.
- Route and reducer exports for later registration by shared-file owners.

### 3.2 Excluded

- Payment initiation, gateway callbacks, reconciliation, recurring debit, debt reminders, and suspension decisions. These belong to Billing.
- Bulky-waste recognition, capacity checks, quoting, holds, payment, and order mutation. These belong to Bulky.
- Ticket creation, dispatch, route planning, and field execution. These belong to Dev 2.
- Telemetry ingestion and Traccar vehicle tracking. These belong to Dev 1 and Dev 2.
- Production HTTP endpoint mapping, backend schedulers, notification delivery, webhook verification, and final authorization enforcement.
- Direct edits to `src/Navigation.jsx`, `src/store/index.js`, `package.json`, or shared contracts without team agreement.

## 4. Users and authorization

### 4.1 System roles

- `CITIZEN`: household-facing access only.
- `BILLING_STAFF`: internal billing and reconciliation access; defined for cross-module consistency but not granted Citizen household mutations by itself.
- `AUTHORIZED_MANAGER`: approval authority for sensitive Billing actions; defined for cross-module consistency but not used to bypass household membership.

### 4.2 Household roles

- `REPRESENTATIVE`: manages household membership and receives all household capabilities by default.
- `MEMBER`: receives safe operational capabilities by default. Financial visibility and order capabilities require explicit grants.

The capability set is fixed for this design:

- `VIEW_OPERATIONS`
- `VIEW_COLLECTION_HISTORY`
- `CREATE_COMPLAINT`
- `VIEW_FINANCIALS`
- `MANAGE_PAYMENTS`
- `VIEW_BULKY_ORDERS`
- `MANAGE_BULKY_ORDERS`
- `MANAGE_MEMBERS`

Capability matrix:

| Capability | Representative | Member default | Member may be granted |
|---|---:|---:|---:|
| `VIEW_OPERATIONS` | Yes | Yes | Yes |
| `VIEW_COLLECTION_HISTORY` | Yes | Yes | Yes |
| `CREATE_COMPLAINT` | Yes | Yes | Yes |
| `VIEW_FINANCIALS` | Yes | No | Yes |
| `MANAGE_PAYMENTS` | Yes | No | Yes |
| `VIEW_BULKY_ORDERS` | Yes | No | Yes |
| `MANAGE_BULKY_ORDERS` | Yes | No | Yes |
| `MANAGE_MEMBERS` | Yes | No | No |

Representatives always have all capabilities. Citizen Portal cannot remove representative capabilities, demote a representative, or promote a member; those governance operations require an authorized administrative workflow outside this spec. A member invitation can contain only capabilities marked grantable above. The UI uses capabilities for visibility and interaction states. The backend must enforce the same permissions independently.

### 4.3 Membership rules

- A user can belong to multiple households through `householdMemberships`.
- Exactly one authorized household is active in the Citizen UI at a time.
- A QR household reference can select a household only when the current user has an active membership.
- Unauthorized and unknown household references return the same non-disclosing access-denied experience.
- Representatives invite members by email or phone. The recipient must authenticate and accept before membership becomes active.
- Only a representative can invite, change capabilities, or revoke a member. Citizen Portal cannot revoke a representative.
- Invitation, acceptance, capability change, revocation, and expiry are audit events.

## 5. Information architecture

The Citizen dashboard is the entry point. It exposes critical status immediately and routes detailed workflows to focused pages.

Proposed exported routes:

| Route | Purpose |
|---|---|
| `/citizen` | Household overview dashboard |
| `/citizen/history` | Collection history and evidence |
| `/citizen/finances` | Read-only monthly invoice/payment history and refund progress |
| `/citizen/bulky-orders` | Read-only bulky-order history, payment state, and refund progress |
| `/citizen/complaints` | Complaint list and creation |
| `/citizen/complaints/:complaintId` | Complaint timeline, response, and review request |
| `/citizen/members` | Members, invitations, and capabilities |
| `/citizen/notifications` | Notification inbox and channel preferences |

The dashboard contains:

- Authorized household switcher.
- Household identity, address, contract reference, and service-status banner.
- Current bin snapshot with freshness and fault state.
- Next collection window, progress status, and ETA.
- Current monthly invoice summary and a link to read-only finance history. Payment mutations deep-link to Billing when that module is registered.
- Active bulky-order summary and a link to read-only bulky-order history. Booking and order mutations deep-link to Bulky when that module is registered.
- Recent notifications.
- Quick complaint action.

## 6. Module architecture

The module uses feature-oriented boundaries.

```text
src/modules/citizen/
├── docs/
├── features/
│   ├── dashboard/
│   ├── households/
│   ├── collections/
│   ├── complaints/
│   ├── memberships/
│   └── notifications/
├── pages/
├── services/
│   ├── ports/
│   ├── mock/
│   └── http/
├── routes.jsx
└── index.js

src/store/citizen/
├── citizenSlice.js
├── selectors.js
└── index.js
```

Responsibilities:

- `routes.jsx` exports a named `citizenRoutes` array whose entries have the fixed shape `{ path, element }`; it does not mutate the root router.
- Pages compose features and contain no repository-specific logic.
- A feature owns its presentational components, form validation, view models, and local tests.
- Service ports define behavior independently of transport.
- Mock adapters implement the service interfaces and error semantics. HTTP adapters are deferred until production endpoint contracts are ratified.
- The Citizen store holds shared entities, active-household state, request state, unread counts, cache metadata, and offline drafts.
- Backend-owned workflow decisions must not be reproduced as authoritative frontend reducers.

Service ports:

- `CitizenIdentityService`
- `HouseholdService`
- `CollectionService`
- `ComplaintService`
- `MembershipService`
- `NotificationService`

The first implementation supplies only mock adapters. HTTP adapters are a later integration phase after endpoint contracts are ratified; this design does not invent production URLs or payload envelopes. All ports return promises and reject with the common `CitizenServiceError` shape:

```text
code: UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT |
      VALIDATION | RATE_LIMITED | UNAVAILABLE | OFFLINE | UNKNOWN
message
fieldErrors?
retryAfterMs?
cause?
```

Minimum port operations:

```text
CitizenIdentityService
  getCurrentIdentity(signal)
  listMemberships(userId, signal)

HouseholdService
  getHousehold(householdId, signal)
  getTelemetry(householdId, signal)

CollectionService
  getUpcomingVisit(householdId, signal)
  listVisits(householdId, cursor?, signal)
  getVisitEvidence(visitId, signal)

ComplaintService
  listComplaints(householdId, cursor?, signal)
  getComplaint(complaintId, signal)
  createComplaint(input, signal)
  requestReview(complaintId, reason, signal)

MembershipService
  listInvitations(householdId, signal)
  createInvitation(input, signal)
  acceptInvitation(invitationId, signal)
  updateMemberCapabilities(membershipId, capabilities, signal)
  revokeMember(membershipId, signal)

NotificationService
  listNotifications(userId, cursor?, signal)
  markRead(notificationId, signal)
  getPreferences(userId, signal)
  updatePreferences(userId, preferences, signal)

CitizenSummaryService
  listMonthlyInvoices(householdId, cursor?, signal)
  listBulkyOrders(householdId, cursor?, signal)
```

## 7. Data model

### 7.1 UserIdentity

```text
userId
displayName
systemRoles[]
```

### 7.2 HouseholdMembership

```text
membershipId
userId
householdId
role: REPRESENTATIVE | MEMBER
capabilities[]
status: INVITED | ACTIVE | REVOKED
createdAt
updatedAt
```

### 7.3 HouseholdProfile

```text
householdId
contractId
binId
displayName
address
serviceStatus
serviceStatusUpdatedAt
```

`serviceStatus` uses the Citizen view enum:

```text
ACTIVE | GRACE_PERIOD | PENDING_SUSPENSION_REVIEW | SUSPENDED | RESTORED
```

- `ACTIVE`: normal service.
- `GRACE_PERIOD`: confirmed overdue balance is still within an applicable grace policy; collection continues.
- `PENDING_SUSPENSION_REVIEW`: a threshold was reached but no authorized approval is effective; collection continues.
- `SUSPENDED`: an authorized suspension is effective for future in-scope visits; IoT monitoring continues.
- `RESTORED`: restoration was confirmed and routing synchronization is pending or recently completed.

This is a read-only presentation contract. Citizen never derives suspension directly from debt days and never performs suspension or restoration. The future backend/adapter must provide an explicit state or a team-approved mapping from the shared `HouseholdServiceStatus`; frontend code must not infer the mapping itself.

### 7.4 BinTelemetrySnapshot

```text
binId
householdId
fillLevelPercent
odorStatus
batteryPercent?
capturedAt
quality: FRESH | STALE | OFFLINE | SENSOR_FAULT
```

Every reading must include `capturedAt` and `quality`. A missing or invalid value is not rendered as zero.

### 7.5 CollectionVisit

```text
visitId
householdId
windowStart
windowEnd
status
eta?
publicVehiclePosition?
resultSummary?
evidenceSummary?
updatedAt
```

Citizen sees schedule, status, ETA, and limited vehicle position near the service window. It must not expose the full route, unrelated households, or driver personal information.

### 7.6 CitizenComplaint

```text
complaintId
householdId
category
description
attachments[]
relatedEntity?
status
responses[]
createdAt
updatedAt
```

Categories include missed collection, odor, damaged bin, unsatisfactory result, and incorrect charge.

Status flow:

```text
SUBMITTED -> ACKNOWLEDGED -> IN_REVIEW -> RESOLVED
                                      -> REJECTED
RESOLVED | REJECTED -> REVIEW_REQUESTED -> IN_REVIEW
```

A complaint keeps its own identity and history even if a backend system merges its operational work into an existing ticket.

Resolving or rejecting an incorrect-charge complaint never edits an invoice, erases debt, reallocates a payment, or changes an approved price. Any accepted financial correction is a separate, authorized Billing operation referenced from the complaint response.

### 7.7 MembershipInvitation

```text
invitationId
householdId
recipient
capabilities[]
status: PENDING | ACCEPTED | EXPIRED | REVOKED
expiresAt
createdAt
```

### 7.8 CitizenNotification

```text
notificationId
userId
category
title
body
relatedEntity?
createdAt
readAt?
```

### 7.9 NotificationPreference

```text
userId
category
inApp: true
push: boolean
email: boolean
sms: boolean
quietHours?
```

In-app notification is always available. Backend services own actual push, email, and SMS delivery and delivery logs.

### 7.10 Read-only summaries and histories

`MonthlyInvoiceSummary` contains:

```text
invoiceId
period
status: UNPAID | PARTIALLY_PAID | PAID | OVERDUE | ADJUSTED
amountDueVnd
amountPaidVnd
dueDate
debtDays
latestPaymentStatus?: PENDING | SUCCESS | FAILED | REFUNDED
refundStatus?: NONE | REQUESTED | PROCESSING | COMPLETED | FAILED
```

`BulkyOrderSummary` contains:

```text
orderId
itemSummary
pickupDate
paymentStatus: UNPAID | PENDING | PAID | FAILED | REFUNDED
orderStatus
refundStatus?: NONE | REQUESTED | PROCESSING | COMPLETED | FAILED
```

The dashboard uses the current invoice and active bulky order. The finance and bulky history pages display paginated read-only summary lists, including refund progress. Citizen does not own or mutate either entity. Payment actions navigate to a route exported by Billing; booking/order actions navigate to a route exported by Bulky. Until those routes are registered, mutation calls to action are hidden rather than implemented inside Citizen.

## 8. Primary flows

### 8.1 Entering the portal

1. Check the Traccar session.
2. If unauthenticated, save the return URL and redirect to login.
3. Load active household memberships.
4. Resolve an optional QR household reference.
5. Reject unauthorized references without revealing whether the household exists.
6. Select the authorized QR household, the previous active household, or the first active membership.
7. Load household profile first.
8. Load telemetry, collection information, notifications, Billing summary, and Bulky summary in parallel.
9. Render each dashboard section independently so one failed source does not block the others.

### 8.2 Switching household

1. User selects an active membership.
2. Abort requests for the previous household.
3. Set the active household and clear transient previous-household views.
4. Render cached data with freshness markers when available.
5. Refresh each data source and ignore responses belonging to an obsolete request context.

### 8.3 Viewing collection progress

- Show the planned day and time window.
- Show progress and ETA when available.
- Near the service window, show only the public vehicle position allowed by the dispatch contract.
- Show result and evidence after completion.
- Never treat vehicle arrival alone as proof of collection.

### 8.4 Filing a complaint

1. Select category and related collection, invoice, or bin when applicable.
2. Enter description and optional attachments.
3. Validate and review the submission.
4. When online, submit pessimistically and show success only after receiving `complaintId`.
5. When offline, save a local draft and clearly mark it as not submitted.
6. Display the complaint timeline and reasoned responses.
7. Allow a review request after resolution or rejection according to the server contract.
8. Never mutate invoice balance, debt status, payment allocation, or approved price as a side effect of the complaint flow.

### 8.5 Inviting a member

1. Require `MANAGE_MEMBERS`.
2. Enter recipient and choose capabilities.
3. Create a pending invitation.
4. Recipient authenticates and accepts.
5. Server creates an active membership and an audit event.
6. Representatives can later modify capabilities or revoke membership.

### 8.6 Notifications

- In-app inbox is the durable user-facing notification record.
- Users can mark items read and navigate to related entities.
- Users configure push, email, and SMS per category.
- Delivery failures do not remove in-app notifications.

## 9. Mock repository

The mock implementation provides deterministic scenarios for all primary and exceptional states.

Requirements:

- Seed data is versioned.
- Persistence keys are namespaced by schema version and user ID.
- A reset operation restores deterministic seed data.
- Simulated latency and configured error cases are supported.
- Mock adapters return the fixed model shapes and error types defined by the service ports.
- Synthetic data contains no real personal, authentication, or payment information.
- Logout removes sensitive per-user cache and drafts according to the policy below.

The repository may persist household demo state, complaints, invitations, notification read status, and drafts. It must not store tokens, payment credentials, gateway payloads, or sensitive production data.

Retention policy for the mock implementation:

- Persist only until explicit logout, demo reset, or a change to a different authenticated user.
- On logout, delete all Citizen cache, notification state, invitations, and complaint drafts for that user before clearing session UI.
- Warn about unsent complaint drafts before a user-triggered logout when possible; logout still deletes them.
- A page refresh within the same authenticated demo session retains data.
- A seed schema-version change discards incompatible persisted data and reseeds deterministically.

## 10. Loading, errors, and offline behavior

Household profile is the minimum data required to open the portal. Other dashboard sources load independently with their own skeleton, empty, stale, error, and retry states.

Error behavior:

| Condition | Behavior |
|---|---|
| `401` | Store return URL and redirect to login |
| `403` | Show non-disclosing access denied |
| `404` | Explain that the referenced resource is unavailable and return to its list |
| `409` | Reload current server state and explain the conflict |
| `422` | Attach validation errors to the relevant fields |
| `429` | Disable resubmission temporarily and show retry timing |
| `5xx` | Keep marked cached data when safe and provide retry |
| Offline | Show timestamped cache; allow drafts only; block authoritative mutations |

Important mutations use pessimistic updates. Marking a notification read may use an optimistic update with rollback.

All requests support cancellation. Responses are associated with their user and household request context so a late response cannot overwrite data after household switching or logout.

## 11. Accessibility and privacy

- All workflows are keyboard accessible.
- Dialogs manage focus on open and close.
- Status is communicated by text/icon in addition to color.
- Inputs have programmatic labels, descriptions, and linked validation messages.
- Live regions announce meaningful ETA, submission, and connectivity changes without excessive noise.
- Financial capability controls both navigation and data rendering.
- Full vehicle routes, unrelated household locations, and driver personal data are not exposed.
- Access-denied responses do not disclose whether a household or invitation exists.
- Cached data is scoped by user ID and cleared appropriately on logout.

## 12. Testing strategy

Vitest and React Testing Library are prerequisites. Because Dev 3 cannot change `package.json`, the team must approve and merge the test dependencies separately before implementation tests are added.

### 12.1 Unit tests

- Membership and capability authorization.
- Active-household and QR resolution.
- Telemetry quality classification.
- Complaint and invitation validation.
- Mock schema migration and reset.
- Reducers, selectors, and per-user/per-household cache behavior.

### 12.2 Port contract tests

- Mock adapters conform to the fixed port method, result, and `CitizenServiceError` behavior.
- A future HTTP adapter must pass the same reusable conformance suite before it can replace the mock.
- Billing and Bulky summaries remain read-only.
- Missing telemetry never becomes zero fill.
- Unauthorized household lookup is non-disclosing.

### 12.3 Component tests

- Dashboard loading, empty, stale, error, and partial-failure states.
- Authorized household switching.
- Capability-based controls.
- Offline complaint drafts.
- Inbox, unread count, and preferences.

### 12.4 Integration tests

- Session to membership to household dashboard.
- Authorized and unauthorized QR flows.
- Household switching while old requests remain in flight.
- Complaint creation and tracked resolution/rejection.
- Invitation, acceptance, capability changes, and revocation.
- Offline and reconnect behavior.
- Partial service failure without whole-page failure.

### 12.5 Manual acceptance

- Mobile and desktop layouts.
- Long Vietnamese content.
- Multiple household memberships.
- `Asia/Ho_Chi_Minh` date and time presentation.
- Mock state restoration after refresh.
- Cache isolation and cleanup after logout.

Every business invariant must have at least one automated test. Lint and build remain required gates but do not replace tests.

## 13. Integration handoff

The Citizen module delivers:

- Exported Citizen routes.
- Exported Citizen reducer and selectors.
- Documented service interfaces and summary contracts.
- Mock adapters and deterministic scenarios.
- A list of required shared-router and shared-store registration steps.

The module does not perform those shared-file edits. Owners of `src/Navigation.jsx`, `src/store/index.js`, and shared contracts must review and integrate them.

## 14. Delivery phases

This design is delivered through separate implementation plans so the first plan remains focused.

### Phase 1 — Citizen core portal

- Authentication adapter using the Traccar session user ID only.
- Read-only household memberships and active-household switching.
- Read-time enforcement of `VIEW_OPERATIONS`, `VIEW_COLLECTION_HISTORY`, `CREATE_COMPLAINT`, `VIEW_FINANCIALS`, and `VIEW_BULKY_ORDERS`; unauthorized cards, routes, cached entities, and service calls are omitted.
- Authorized QR resolution.
- Dashboard shell and independent loading states.
- Household profile and service-status banner.
- Telemetry quality display.
- Upcoming collection, ETA, history, and evidence summary.
- Complaint list, create, detail timeline, review request, and offline draft.
- Read-only monthly invoice and bulky-order summaries/histories.
- Versioned mock repository and reset.
- Route/reducer exports and Phase 1 automated tests.

### Phase 2 — Membership administration

- Invitations, acceptance, expiry, capability assignment, and revocation.
- Membership audit presentation.
- Capability administration and tests. Phase 1 already enforces capabilities granted by seed/service data; Phase 2 adds the UI that changes those grants.

### Phase 3 — Notifications and production integration readiness

- Notification inbox, unread counts, and preferences.
- Broader cached-read offline behavior.
- HTTP adapter implementations only after endpoint and shared-contract approval.
- Reusable port conformance tests against HTTP adapters.

Each phase receives its own implementation plan and verification checklist. Approval of this design does not authorize Phase 2 or Phase 3 work while executing the Phase 1 plan.

## 15. Phase 1 acceptance criteria

The Citizen design is satisfied when:

1. An authenticated user can access only households with active memberships.
2. Phase 1 enforces read capabilities before rendering protected routes/cards, issuing service calls, or reading cached financial and bulky-order entities.
3. An authorized QR selects a household; an unauthorized QR reveals no household details.
4. Dashboard cards load and fail independently.
5. Telemetry always displays quality and timestamp and never invents a zero reading.
6. Collection information exposes only household-relevant schedule, ETA, position, result, and evidence.
7. Complaints receive stable IDs, traceable status, reasoned responses, and review requests.
8. Offline complaint activity remains an explicit draft until the server accepts it.
9. Incorrect-charge complaints never directly change invoices, debt, payment allocation, or prices.
10. Authorized users can view monthly invoice, payment/refund progress, and bulky-order/refund histories without Citizen owning their mutations.
11. Mock persistence is deterministic, versioned, resettable, isolated by user, and cleared on logout.
12. Route/reducer integration is exported without modifying forbidden shared files.
13. Phase 1 uses the fixed service ports and error model; no production endpoints are invented.

## 16. Open integration dependencies

- Team agreement on shared model contracts and ownership.
- Root route registry integration by the shared-file owner.
- Root reducer registration by the shared-file owner.
- Test dependency PR for Vitest and React Testing Library.
- Production API definitions, HTTP adapter mapping, and backend authorization enforcement. These do not block the Phase 1 mock implementation.
- Dev 1 telemetry contract and freshness policy.
- Dev 2 collection schedule, evidence, and privacy-safe ETA/position contract.
- Billing and Bulky summary contracts.
