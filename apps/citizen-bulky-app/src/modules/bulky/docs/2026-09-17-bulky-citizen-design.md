# Bulky Waste Citizen Booking — Design Specification

**Date:** 2026-09-17  
**Owner:** Dev 3 (`dev-EnglandLee`)  
**Status:** Proposed for implementation planning  
**Source:** `quy-trinh-thu-gom-iot-traccar-ai (1).pdf`, pages 8 and 11–13

## 1. Purpose

Build the citizen-facing flow for requesting prepaid collection of accepted bulky waste such as sofas, mattresses, tables, and cabinets. The feature lets a citizen describe the items, review AI suggestions, confirm the facts used for pricing, choose an available service date, pay a separate bulky-order charge, and later reschedule, cancel, or track a refund.

Phase 1 is a complete frontend demonstration backed by deterministic, versioned mock services. It does not integrate a production AI model, payment gateway, dispatch system, or staff console.

## 2. Scope

### 2.1 Included capabilities

| ID | Capability | Phase 1 outcome |
|---|---|---|
| 13 | Create bulky collection request | Submit image metadata, description, requested date, item quantities and dimensions, placement, access, lift, floor, and disassembly needs. |
| 14 | AI-assisted item recognition | Return clearly labelled suggestions for item type and visible count; require citizen confirmation or correction. |
| 15 | Quote confirmed information | Produce an itemized, versioned quote only from citizen-confirmed facts and configured pricing rules. |
| 16 | Reserve capacity and prepay | Check cutoff, vehicle, crew, carrying capacity, destination, and available slot; hold capacity temporarily and confirm only after valid payment. |
| 17 | Change an order | Reschedule, cancel, choose a provider-failure resolution, and track refund progress under explicit policy. |

### 2.2 Phase 1 user

Phase 1 serves an authenticated citizen who has an active membership for the selected household. Viewing requires `VIEW_BULKY_ORDERS`; creating or changing an order requires `MANAGE_BULKY_ORDERS`. Staff actions—manual review, capacity approval, dispatch, payment confirmation, and refund processing—are represented by deterministic mock-service outcomes, not staff screens.

### 2.3 Out of scope

- Production AI inference, model training, confidence calibration, or image hosting.
- Staff approval, dispatch, driver, or finance user interfaces.
- Production payment initiation, webhook verification, settlement, or bank reconciliation.
- Editing monthly invoices, monthly debt, service suspension, or payment allocation.
- Guessing exact weight or dimensions from an image.
- Handling hazardous waste, electronics, or construction debris as ordinary bulky waste.
- Direct edits to `src/Navigation.jsx` or `src/store/index.js`; Dev 0 owns global integration.

## 3. Business invariants

1. AI output is advisory. A citizen must confirm or correct item type, count, and dimensions before quoting.
2. AI never claims an exact mass from an image.
3. Unsupported, unclear, or price-uncertain requests enter manual review and cannot be paid.
4. Capacity is checked before money is requested. A hold has an explicit expiry.
5. An order becomes `CONFIRMED` only when the payment is valid and the capacity hold is still active.
6. A late payment never silently promises an expired service date. Capacity is checked again; the citizen must accept a new date or receive a refund if the old slot is unavailable.
7. A quote stores confirmed facts, line items, scope, policy, price-book version, and expiry. The client never recomputes a previously issued quote.
8. Monthly fees and bulky-order charges are separate receivables. One never offsets or mutates the other.
9. Duplicate payment callbacks or retries record a transaction and confirm work at most once.
10. Vehicle arrival is not proof that collection was completed.
11. A field discrepancy cannot cause an unapproved extra charge. It creates an adjusted quote for citizen consent or proceeds through reschedule/cancellation policy.
12. Unknown and unauthorized order identifiers produce the same non-disclosing access error.
13. Orders are household-scoped resources, not creator-private records. Any active member with `VIEW_BULKY_ORDERS` may read the household history; only an active member with `MANAGE_BULKY_ORDERS` may create or mutate it. `createdByUserId` remains an audit field.
14. Phase 1 policy `BULKY_DEMO_V1` never blocks a bulky order because of monthly debt and never reads or mutates Billing receivables. A future production eligibility decision must be disclosed before capacity is held or money is requested.

## 4. Module boundary

All Phase 1 code remains within the Dev 3 ownership paths:

```text
src/modules/bulky/
  docs/
  domain/
  services/
  store/
  features/
  pages/
  routes.jsx
  integration.js
```

The feature-owned Redux slice remains under `src/modules/bulky/store/`. Dev 3 is not authorized to create `src/store/bulky/` or modify the global store.

The module exports:

- a route manifest from `routes.jsx` for Dev 0 to register;
- its reducer and reducer key;
- selectors and public navigation helpers;
- a service factory contract;
- an integration guide identifying the required global wiring.

Bulky must not import Citizen presentation components or mutate Billing state. It consumes an authenticated `userId`, selected `householdId`, and authoritative membership resolver through its composition boundary. Reads require `VIEW_BULKY_ORDERS`; draft creation and every order mutation require `MANAGE_BULKY_ORDERS`.

## 5. Architecture

Phase 1 uses feature-oriented vertical slices with a domain state machine:

- `domain/` owns enums, transitions, policies, quote validation, and pure decisions.
- `services/` defines stable ports and a deterministic mock adapter.
- `store/` owns request state, normalized entities, active draft/order, and stale-request protection.
- `features/` owns focused workflow components.
- `pages/` compose route-level screens.
- `routes.jsx` and `integration.js` expose integration contracts without changing global files.

The service is authoritative for mutations. Redux updates an entity only from a returned service representation; it does not assume that a payment, cancellation, reschedule, or refund succeeded.

## 6. Routes and screens

| Route | Purpose |
|---|---|
| `/bulky/orders` | List the citizen's bulky orders, with separate order, payment, and refund states. |
| `/bulky/orders/new` | Multi-step request wizard. |
| `/bulky/orders/:orderId/quote` | Review confirmed facts, itemized quote, scope, expiry, and cancellation policy. |
| `/bulky/orders/:orderId/payment` | Run the in-app payment simulator for success, failure, or late completion. |
| `/bulky/orders/:orderId` | Show details, timeline, rescheduling, cancellation, provider-failure resolution, and refund progress. |

All routes require an authenticated user and an active membership for the order's household. List/detail routes additionally require `VIEW_BULKY_ORDERS`; creation, payment, reschedule, cancellation, and resolution routes require `MANAGE_BULKY_ORDERS`. Route loaders must not render cached protected entities before authorization is established.

## 7. Request wizard

The wizard has six explicit stages:

1. **Evidence:** select an authorized household service location, images, a description, and the desired date. The form submits only `serviceLocationId`; it never submits authoritative free-form coordinates.
2. **AI suggestion:** display suggested accepted item types, visible counts, and confidence labels.
3. **Citizen confirmation:** confirm or correct types, quantities, dimensions, and oversize attributes.
4. **Handling conditions:** capture placement, floor, lift, access, disassembly, and special crew needs.
5. **Eligibility and capacity:** check accepted category, service area, receiving destination, cutoff, vehicle, crew, and carrying space.
6. **Quote review:** display every charge, scope, date/window, policy, price version, total, and expiry before payment.

Drafts persist between steps. Browser file objects and object URLs remain session-only. Persisted drafts store only safe image metadata such as client ID, name, type, size, and reselection requirement. After refresh, the UI clearly requests image reselection rather than pretending the binary remains available.

## 8. AI assistance contract

`recognition.analyzeImages` returns one of three outcomes:

- `SUGGESTED`: sufficiently confident accepted-category suggestions that still require citizen confirmation;
- `NEEDS_CONFIRMATION`: low-confidence or conflicting suggestions that the citizen must correct;
- `MANUAL_REVIEW`: unclear, unsupported, or price-uncertain evidence; quoting and payment remain unavailable.

Each suggestion contains a candidate catalog item, visible count, confidence band, and explanation suitable for display. It does not contain an exact weight. The mock selects deterministic outcomes from synthetic file metadata and scenario flags; UI code must not infer confidence itself.

## 9. Domain models

### 9.1 BulkyOrder

```text
orderId
householdId
createdByUserId
orderNumber
serviceLocation: {
  address,
  latitude,
  longitude,
  householdLocationVersion
}
requestedDate
confirmedServiceWindow?
orderStatus
paymentStatus
refundStatus
confirmedItems[]
handlingConditions
imageMetadata[]
recognitionResult?
capacityDecision?
activeQuoteId?
activeHoldId?
confirmationVersion            // starts at 1 on first confirmation
changeRequest?
providerFailure?
timeline[]
createdAt
updatedAt
```

`serviceLocation` is an immutable snapshot resolved from the authorized household profile. The citizen may choose only a service location returned for that household; arbitrary address or coordinate substitution is rejected. This snapshot is included in the confirmed dispatch handoff.

### 9.2 Confirmed item

```text
itemId
catalogItemCode
displayName
quantity
dimensionsCm: { length, width, height }
oversize
citizenConfirmedAt
```

Mass is deliberately absent from AI-derived data. A future manually verified operational weight may use a separate field and authority.

### 9.3 Handling conditions

```text
placement: CURBSIDE | GROUND_FLOOR | UPPER_FLOOR
floorNumber?
hasLift?
accessNotes?
requiresDisassembly
requestedCrewNotes?
```

### 9.4 Capacity decision and hold

```text
decision: AVAILABLE | ALTERNATIVE_DATES | MANUAL_REVIEW | UNAVAILABLE
requestedDate
offeredDates[]
vehicleClass?
crewSize?
receivingSite?
reasonCode?

holdId
orderId
serviceWindow
status: ACTIVE | EXPIRED | RELEASED | CONSUMED
expiresAt
```

### 9.5 Versioned quote

```text
quoteId
orderId
priceBookVersion
confirmedInputHash
serviceWindow
lineItems[]: { code, label, quantity, unitPriceVnd, amountVnd }
subtotalVnd
discountVnd
taxVnd
totalVnd
currency: VND
scope[]
exclusions[]
cancellationPolicyVersion
status: ACTIVE | ACCEPTED | EXPIRED | SUPERSEDED
expiresAt
createdAt
```

Only the mock pricing engine creates line items and totals. Components format these values but never calculate an authoritative amount.

### 9.6 Change proposal

```text
changeRequestId
orderId
type: RESCHEDULE | CANCEL | FIELD_ADJUSTMENT | PROVIDER_FAILURE
status: REQUESTED | UNDER_REVIEW | OFFERED | AWAITING_SETTLEMENT |
        ACCEPTED | REJECTED | WITHDRAWN
requestedDate?
proposedServiceWindow?
proposedQuoteId?
proposedHoldId?
financialEffect: NONE | ADDITIONAL_PAYMENT | PARTIAL_REFUND | FULL_REFUND
amountVnd
reason
createdAt
updatedAt
```

A change proposal never replaces the active confirmed booking merely by being created. The existing service window and accepted quote remain authoritative until the citizen accepts the proposal and any required settlement succeeds atomically. Rejecting, withdrawing, or allowing the proposal hold to expire preserves the old commitment unless the provider has declared it impossible; provider failure instead preserves a claim to replacement service or full refund.

### 9.7 Payment and refund

```text
paymentAttemptId
orderId
quoteId
idempotencyKey
purpose: INITIAL_PREPAYMENT | CHANGE_ADDITIONAL_PAYMENT
amountVnd
currency: VND
status: UNPAID | PENDING | SUCCESS | FAILED | REFUNDED
transactionReference?
receivedAt?

refundId
orderId
paymentAttemptId
amountVnd
reason
status: NONE | REQUESTED | PROCESSING | COMPLETED | FAILED
createdAt
updatedAt
```

An order may have multiple payment attempts and transactions, but a transaction reference is globally unique within the mock ledger. The order financial summary stores `settledAmountVnd`, `balanceDueVnd`, and `refundableAmountVnd`. A lower replacement quote creates a partial-refund obligation only after the citizen accepts the change; a higher quote keeps the original booking until the additional payment succeeds.

Late payment uses a separate reconciliation record:

```text
latePaymentResolutionId
orderId
paymentAttemptId
status: CAPACITY_RECHECK_REQUIRED | SLOT_OFFERED | ALTERNATIVES_OFFERED |
        REFUND_OFFERED | RESOLVED_WITH_SLOT | RESOLVED_WITH_REFUND
offeredHoldId?
offeredDates[]
expiresAt?
updatedAt
```

## 10. State model

Order, payment, refund, and hold statuses are independent.

### 10.1 Order status

```text
DRAFT
NEEDS_INFO
MANUAL_REVIEW
AWAITING_PAYMENT
CONFIRMED
ASSIGNED
IN_PROGRESS
COMPLETED
CANCELLED
```

Core transitions:

```text
DRAFT -> NEEDS_INFO | MANUAL_REVIEW | AWAITING_PAYMENT
NEEDS_INFO -> MANUAL_REVIEW | AWAITING_PAYMENT
MANUAL_REVIEW -> NEEDS_INFO | AWAITING_PAYMENT | CANCELLED
AWAITING_PAYMENT -> CONFIRMED | CANCELLED
CONFIRMED -> ASSIGNED | CANCELLED
ASSIGNED -> IN_PROGRESS | CONFIRMED | CANCELLED
IN_PROGRESS -> COMPLETED
```

Rescheduling creates a separate change proposal. The order and original service commitment remain `CONFIRMED` while that proposal is reviewed, quoted, held, and settled. For an equal-price change, accepting the proposal atomically consumes the proposed hold, releases the old capacity, and replaces the service window. For a higher price, the replacement happens only after the additional payment succeeds. For a lower price, acceptance atomically replaces the window and creates a partial-refund obligation. Only then does the previous quote become `SUPERSEDED`.

An action is rejected with `CONFLICT` when the current server state does not permit its transition. The UI reloads and explains the current state.

## 11. Change, cancellation, and provider-failure policy

Phase 1 uses a visible, versioned demo policy:

- Before the configured cutoff, rescheduling is allowed when new capacity exists. Cancelling a settled eligible order produces a full refund; cancelling an unpaid draft or awaiting-payment order only releases its quote/hold and creates no refund.
- After cutoff but before collection starts, a change or cancellation enters review; the UI does not promise a refund immediately.
- `IN_PROGRESS` and `COMPLETED` orders cannot be self-cancelled.
- When the provider cancels or a vehicle fails, the citizen chooses an available replacement date or a full refund.
- Any change affecting price produces a new quote. The citizen must accept it before the service commitment changes.
- Refund progress remains visible until `COMPLETED` or `FAILED` with a retry/support path.

Post-cutoff requests use `REQUESTED` or `UNDER_REVIEW` change status and leave the current booking unchanged. The mock scenario engine resolves them deterministically to an offer or rejection. Citizen UI can poll/refresh the request but cannot invoke a staff decision.

Policy results come from the service, not from hiding a button alone.

## 12. Service ports

The mock bundle is constructed with authenticated context and injected dependencies:

```text
createMockBulkyServices({
  userId,
  membershipResolver,
  storage,
  now,
  scenario
})
```

Minimum operations:

```text
catalog.listAcceptedItems(signal)

recognition.analyzeImages(input, signal)

orders.createDraft(input, idempotencyKey, signal)
orders.updateDraft(orderId, input, idempotencyKey, signal)
orders.confirmItems(orderId, input, idempotencyKey, signal)
orders.list(cursor?, signal) -> { items, nextCursor }
orders.get(orderId, signal)

reviews.refresh(orderId, signal)

capacity.preview(orderId, requestedDate, signal)

quotes.reserveAndCreate(orderId, requestedDate, idempotencyKey, signal)
  -> { order, quote, hold }
quotes.accept(orderId, quoteId, idempotencyKey, signal)

payments.start(orderId, quoteId, idempotencyKey, signal)
payments.simulateResult(paymentAttemptId, result, idempotencyKey, signal)
latePayments.acceptRevalidatedSlot(orderId, offeredHoldId, idempotencyKey, signal)
latePayments.acceptAlternativeDate(orderId, selectedDate, idempotencyKey, signal)
latePayments.chooseRefund(orderId, idempotencyKey, signal)

changes.requestReschedule(orderId, requestedDate, reason, idempotencyKey, signal)
changes.requestCancellation(orderId, reason, idempotencyKey, signal)
changes.get(changeRequestId, signal)
changes.acceptOffer(changeRequestId, idempotencyKey, signal)
changes.rejectOffer(changeRequestId, idempotencyKey, signal)
changes.resolveProviderFailure(orderId, choice, offeredDate?, idempotencyKey, signal)

refunds.get(refundId, signal)

session.clear()
```

`quotes.reserveAndCreate` is the authoritative atomic operation for function 16. It rechecks membership/capability, the Phase 1 eligibility policy, confirmed item data, cutoff, vehicle, crew, carrying space, receiving site, and current price book in one transaction. On success it creates one immutable quote and one active hold. An idempotent retry returns the same pair. Failure creates neither. A hold is consumed by valid confirmation, released by eligible cancellation or an accepted replacement, and treated as expired whenever `now >= expiresAt`.

`orders.createDraft` accepts a `serviceLocationId` from the current authorized household profile. The service resolves and snapshots its address and coordinates; it rejects a missing, stale, or foreign location and never trusts client-supplied address/coordinate values.

Reading an expired quote/hold materializes `EXPIRED` once and appends at most one timeline event. Starting payment or accepting a quote against it returns `SLOT_EXPIRED`. A failed simulated payment leaves the hold active until its existing expiry; it does not extend capacity.

`reviews.refresh` is a citizen-safe status refresh. In the mock adapter, an injected scenario and clock may deterministically advance a manual review or post-cutoff change review; the caller cannot choose the staff decision. Provider failures and refund progression are likewise driven by seed/scenario time. A separate mock-only test driver may expose `simulateProviderFailure`, `resolveManualReview`, and `advanceRefund`, but it is not part of the citizen service bundle and no production component may invoke it.

`changes.acceptOffer` records citizen consent and validates the proposed hold. For equal or lower price it atomically replaces the commitment; the lower-price branch also creates the partial-refund obligation. For a higher price it moves only the proposal to `AWAITING_SETTLEMENT` and returns an additional-payment instruction while preserving the old booking. A successful `payments.simulateResult` for that proposal atomically replaces the commitment; failure leaves the old booking intact and permits retry until the proposed hold expires. Rejection, expiry, or any partial failure also preserves the old booking. `changes.resolveProviderFailure` atomically reserves an offered replacement or creates the full-refund obligation; refund creation is not used as a substitute for rescheduling.

For a late payment, `acceptRevalidatedSlot` consumes the exact `offeredHoldId` already recorded on the reconciliation object. When only alternative dates exist, `acceptAlternativeDate` takes the citizen's selected date and atomically rechecks capacity, creates and consumes a hold, and confirms the order. If capacity disappears, it leaves the reconciliation unresolved, returns new alternatives when available, and always preserves the full-refund choice.

`changes.requestCancellation` has two deterministic branches. Before cutoff, after the citizen has confirmed the UI warning, it atomically cancels the order, releases active capacity, supersedes an unused quote, and either creates a full-refund obligation for settled funds or records `financialEffect: NONE` for an unpaid order. After cutoff it creates an `UNDER_REVIEW` request and changes no booking or financial state. `reviews.refresh` may resolve that request to `OFFERED` or `REJECTED`; rejection preserves the booking. Accepting an offered cancellation via `changes.acceptOffer` atomically cancels, releases capacity, and creates exactly the refund specified by the reviewed offer.

All mutating operations require an idempotency key. The mock persists operation result records so a retry returns the original result without duplicating an order, quote, hold, transaction, timeline event, dispatch handoff, change, or refund.

Every asynchronous operation supports deterministic latency and an optional `AbortSignal`. Aborted operations reject with `AbortError`. Domain/service failures use `BulkyServiceError` with stable codes:

```text
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
VALIDATION
CONFLICT
SLOT_EXPIRED
UNAVAILABLE
OFFLINE
UNKNOWN
```

Unknown and unauthorized order IDs both return non-disclosing `FORBIDDEN`. `NOT_FOUND` is reserved for an already-authorized relationship whose referenced subordinate entity is unavailable.

## 13. Authorization and privacy

- A service bundle is bound to one authenticated `userId`.
- Every operation resolves the household resource, verifies an `ACTIVE` membership for the bound user, and checks `VIEW_BULKY_ORDERS` for reads or `MANAGE_BULKY_ORDERS` for mutations.
- Orders belong to households. They are readable by any currently authorized household member with read capability, regardless of which member created them.
- A caller-provided household, order, quote, hold, payment, change, or refund ID is never trusted without resolving its household and capability.
- Every operation calls the injected authoritative `membershipResolver` for the current membership/capabilities; it does not retain a construction-time authorization snapshot. The mock resolver reads cloned current membership records from the versioned repository. Revocation or capability removal therefore applies to the next operation without rebuilding the bundle. A production adapter obtains the decision from the backend rather than a client assertion.
- Logout deletes only the bound user's session cache, offline drafts, and image object URLs, then invalidates the bundle. It does not delete durable orders, transaction/refund history, dispatch handoffs, or idempotency records.
- Seed data is synthetic and contains no production identity, payment credential, gateway payload, or personal image.
- Public order views never expose unrelated households, full vehicle routes, driver personal data, or internal staff notes.

## 14. Mock persistence and scenarios

Mock persistence separates a shared synthetic authoritative repository from per-user ephemeral client state:

```text
smartbin:bulky:v1:repository
smartbin:bulky:v1:cache:<userId>
smartbin:bulky:v1:offline-drafts:<userId>
```

The repository deep-clones seed data before mutation and all returned values. A schema mismatch discards incompatible synthetic state and reseeds deterministically. `session.clear()` removes only the two per-user ephemeral keys and invalidates that bundle. A separately exported development/test fixture reset restores the repository and all demo namespaces; citizen UI cannot invoke it. Logging out and back in therefore retains orders, payment/refund history, and replay protection.

Required scenarios:

- AI suggested, low confidence, and manual-review outcomes.
- Accepted and unsupported waste types.
- Capacity available, alternative dates, unavailable vehicle, unavailable crew, insufficient space, and cutoff passed.
- Active and expired holds.
- Itemized quote with item, area/vehicle, handling/disassembly, tax, and valid discount examples.
- Payment pending, success, failure, duplicate callback, and success after hold expiry.
- Draft, awaiting-payment, confirmed, assigned, in-progress, completed, cancelled, and refund-progress orders.
- Provider cancellation or vehicle failure with reschedule and full-refund choices.
- Field discrepancy that creates an adjusted quote rather than an automatic extra charge.

## 15. Payment simulation and idempotency

The in-app simulator presents three citizen-testable outcomes: success, failure, and success after the hold expires.

For success within the hold:

1. Verify the payment attempt references the order's accepted active quote and active hold.
2. Verify exact expected amount, `VND` currency, a non-empty unique transaction reference, and an allowed prior processing state.
3. Persist the successful transaction once.
4. Consume the hold once.
5. Move the order to `CONFIRMED` once and create one dispatch-handoff outbox record.
6. Return the same result for the same idempotency key or transaction reference.

An order/quote mismatch, amount or currency mismatch, reused transaction reference for different intent, or illegal prior state does not confirm the order. It produces `VALIDATION` or `CONFLICT` and a reconciliation marker suitable for citizen support. Production signature verification remains outside Phase 1.

For late success:

1. Persist and reconcile the payment without confirming the expired slot.
2. Keep the order `AWAITING_PAYMENT` and set `latePaymentResolution.status` to `CAPACITY_RECHECK_REQUIRED`.
3. Recheck capacity and atomically create a new offered hold when possible.
4. If capacity remains available, ask the citizen to accept the revalidated slot through `latePayments.acceptRevalidatedSlot`.
5. Otherwise let the citizen atomically select an alternative through `latePayments.acceptAlternativeDate`, or choose a full refund through `latePayments.chooseRefund`.

Accepting a revalidated slot consumes its new hold and confirms the order exactly once. Choosing refund creates one full-refund obligation and cancels the unconfirmed order. Until one branch succeeds, successful payment and service confirmation remain visibly separate.

A duplicate callback cannot duplicate payment, order, timeline event, assigned work, or refund.

## 16. Redux state

The Bulky slice stores normalized, serializable data only:

```text
catalog
draft
ordersById
orderIds
quotesById
holdsById
paymentsById
refundsById
changeRequestsById
latePaymentResolutionsById
pagination
requestsByKey
activeRequestContexts
```

Request records distinguish `idle`, `loading`, `success`, and `error`. Each household/order load carries a request context so a late response cannot overwrite a newer selection. Browser `File`, object URL, `AbortController`, service instances, and Error objects remain outside Redux.

Selectors expose allowed actions based on server/domain policy results. Components still handle a service-side denial because UI gating is not authorization.

## 17. User experience requirements

- Use existing Material UI patterns and remain usable on narrow mobile screens.
- Label recognition output as an AI suggestion and make confirmation explicit.
- Show unsupported-category guidance before collecting payment.
- Render quote line items, total, price version, service scope, exclusions, date/window, expiry, and cancellation policy.
- Show a visible hold countdown, but treat the service clock as authoritative at submission.
- Distinguish payment processing from success; network delay is not payment failure.
- Show order, payment, and refund statuses separately in lists and timelines.
- Confirm destructive actions and disclose financial consequences before submission.
- Provide loading, empty, error, retry, offline, expired, and conflict states.
- Preserve keyboard navigation, labelled inputs, useful validation messages, focus management, and non-color-only statuses.

## 18. Error and offline behavior

- Validation errors stay attached to fields and preserve entered values.
- `FORBIDDEN` displays a generic access-denied state without entity details.
- `CONFLICT` reloads current state and explains why the requested transition is unavailable.
- `SLOT_EXPIRED` returns the citizen to capacity selection without silently changing the date.
- `UNAVAILABLE` preserves a safe draft and offers retry.
- Offline mode may create or update a per-user local draft, clearly labelled “Bản nháp — chưa gửi”. It is not an authoritative order and has a distinct `clientDraftId`, not an accepted mutation idempotency result.
- On reconnect, the citizen explicitly submits or merges the local draft. The service uses a new mutation idempotency key and returns the authoritative `orderId`; only then may the local draft be deleted. Conflicts preserve both versions for citizen choice.
- Quoting, capacity reservation, payment, cancellation, rescheduling, and refund selection require an authoritative online response and are never queued as if accepted.

## 19. Testing strategy

Implementation follows test-driven development.

### 19.1 Domain tests

- All permitted and forbidden state transitions.
- Hold and quote expiry boundaries using an injected clock.
- Cancellation/reschedule policy before and after cutoff.
- AI outcomes never introduce exact inferred mass.
- Price inputs and quote invariants; UI cannot alter service totals.

### 19.2 Mock service tests

- Versioning, reset, schema mismatch, cloning, and user isolation.
- Active-membership plus `VIEW_BULKY_ORDERS`/`MANAGE_BULKY_ORDERS` enforcement for household-scoped resources.
- Membership revocation and capability removal after bundle construction take effect on the next operation.
- Abort handling and stable error types.
- Pagination shape.
- Mutation idempotency and duplicate payment callback handling.
- Atomic quote/hold creation, expiry materialization exactly once, release, and capacity alternatives.
- Late payment, provider failure, rescheduling, cancellation, adjusted quote, and refund progress.
- Alternative-date acceptance after late payment and the retained full-refund choice when capacity disappears.
- Immediate pre-cutoff cancellation and reviewed post-cutoff cancellation, including rejected review preserving the booking.
- Payment order/quote/amount/currency/reference validation.
- Service-location snapshot validation and exactly one typed dispatch event per confirmation version.
- Logout/relogin ledger persistence, replay protection, ephemeral deletion, and bundle invalidation.
- Explicit `BULKY_DEMO_V1` monthly-debt independence and proof that Bulky neither reads nor mutates Billing receivables.

### 19.3 Redux tests

- Independent request states and stale-response protection.
- Pessimistic mutation updates from returned server state.
- Entity replacement after conflict reload.
- No non-serializable state.

### 19.4 UI tests

- Complete request wizard and persisted draft restoration.
- Suggested, low-confidence, and manual-review AI outcomes.
- Unsupported item and missing-information blocks.
- Available, alternative, and unavailable capacity.
- Quote breakdown and expiry.
- Payment success, failure, duplicate, and late-success flows.
- Order timeline, reschedule, cancellation, provider failure, and refund progress.
- Hidden or disabled invalid actions plus service-side denial handling.
- Accessibility-oriented labels, keyboard flow, and focus after errors.

## 20. Acceptance criteria

1. A citizen can create and resume a bulky request with the required evidence and handling facts.
2. AI suggestions are editable and never represented as authoritative or as exact mass estimates.
3. Unsupported or uncertain requests cannot reach payment without review.
4. Capacity and quote expiry rules are visible and enforced by the mock service.
5. The itemized quote is versioned and based only on confirmed information.
6. A valid on-time payment confirms exactly one order; duplicates are idempotent.
7. A late payment rechecks capacity and results in an accepted new slot or refund path, never a silent old-date promise.
8. Citizens can reschedule or cancel only under the configured policy and can track refunds.
9. Provider cancellation/vehicle failure offers rescheduling or a full refund.
10. Bulky charges never alter or offset monthly invoices.
11. Users cannot infer or access resources of a household for which they lack the required active membership and capability; authorized household members can share household order history as specified.
12. Read and mutation capability checks are enforced in routes, selectors, and services.
13. A confirmed paid order produces exactly one Dev 2 outbox event per confirmation version; accepted schedule changes and confirmed cancellations produce typed versioned updates without duplicate events. An unpaid or unconfirmed order produces none.
14. Bulky tests pass, scoped ESLint is clean, and the production build succeeds; known baseline failures outside scope are reported separately.

## 21. Integration handoff

Dev 3 supplies module exports and documentation only. Dev 0 later:

1. registers the Bulky reducer;
2. mounts the route manifest;
3. provides the authenticated user and authoritative live `membershipResolver` required by the module;
4. adds Citizen deep links to the Bulky routes when both modules are available.

After valid payment and atomic order confirmation, the mock repository sets `confirmationVersion` to 1 and writes one typed dispatch outbox event. Each accepted reschedule or provider-failure replacement increments the version and emits one new `UPSERT`; cancellation of a previously confirmed order increments the version and emits one `CANCEL`. Events use this envelope:

```text
BulkyDispatchEvent {
  eventId                      // <orderId>:<confirmationVersion>:<type>
  type: UPSERT | CANCEL
  orderId
  confirmationVersion
  occurredAt
  order?: BulkyWasteOrder      // required for UPSERT
  cancellation?: { reason }   // required for CANCEL
}
```

`UPSERT` contains the pure mapped payload matching the existing Dev 3 → Dev 2 agreement:

```text
BulkyWasteOrder {
  orderId
  householdId
  itemType: SOFA | MATTRESS | CABINET | TABLE | OTHER
  itemsCount
  pickupDate                 // YYYY-MM-DD
  address
  latitude
  longitude
  hasElevator
  floor
  totalPriceVnd
  isPaid: true
  paymentTransactionId
  status: PAID_CONFIRMED | ASSIGNED | COLLECTED | REFUNDED
}
```

For mixed-item orders, `itemType` is the dominant accepted type or `OTHER`, while `itemsCount` is the confirmed total; the full item breakdown remains in Bulky. `toDispatchBulkyWasteOrder(order)` rejects unconfirmed or unpaid orders. A `CANCEL` references the last committed work without pretending the refund has already completed. The outbox deduplicates by `eventId`, survives logout, and is exposed only as a mock integration seam; Dev 3 does not write into Dev 2 folders or dispatch state.

The production integration phase will replace mock adapters behind the same ports after AI, capacity, pricing, payment, and refund contracts are ratified. It must not change the citizen-visible invariants in this specification.
