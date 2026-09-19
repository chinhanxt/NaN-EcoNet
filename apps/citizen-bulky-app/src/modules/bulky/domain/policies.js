import {
  ACCEPTED_ITEM_TYPES,
  AI_DECISION,
  CHANGE_DECISION,
  ORDER_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
} from './constants.js';

export function evaluateAiResult({ itemType, confidence = 0, quantity, uncertain = false } = {}) {
  const accepted = ACCEPTED_ITEM_TYPES.includes(itemType);
  const manualReview = !accepted || uncertain;
  return {
    itemType: accepted ? itemType : 'OTHER',
    confidence,
    ...(Number.isInteger(quantity) ? { suggestedQuantity: quantity } : {}),
    requiresManualReview: manualReview,
    decision: manualReview
      ? AI_DECISION.MANUAL_REVIEW
      : confidence >= 0.8
        ? AI_DECISION.SUGGESTED
        : AI_DECISION.NEEDS_CONFIRMATION,
  };
}

export function evaluateChangePolicy({
  order,
  action = 'RESCHEDULE',
  requestedAt,
  now,
  policy = {},
}) {
  const status = order?.orderStatus || order?.status;
  if ([ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED].includes(status))
    return {
      decision: CHANGE_DECISION.REJECTED,
      reason: 'ORDER_NOT_CHANGEABLE',
      preservesCurrentBooking: status !== ORDER_STATUS.CANCELLED,
    };
  const serviceDate =
    order?.confirmedServiceWindow?.start ||
    order?.confirmedServiceWindow?.date ||
    order?.serviceWindow?.start ||
    order?.serviceWindow?.date ||
    order?.pickupDate;
  const cutoff =
    new Date(serviceDate || now).getTime() - Number(policy.cutoffHours ?? 24) * 3600000;
  const beforeCutoff =
    new Date(requestedAt).getTime() <= cutoff && new Date(now).getTime() <= cutoff;
  if (action === 'CANCEL' && !beforeCutoff)
    return {
      decision: CHANGE_DECISION.REVIEW,
      reason: 'AFTER_CUTOFF',
      preservesCurrentBooking: true,
      refundStatus: REFUND_STATUS.NONE,
    };
  if (action === 'CANCEL' && beforeCutoff) {
    const settled =
      order?.paymentStatus === PAYMENT_STATUS.SUCCESS ||
      order?.acceptedPayment?.status === PAYMENT_STATUS.SUCCESS;
    return {
      decision: CHANGE_DECISION.ALLOWED,
      reason: settled ? 'FULL_REFUND' : 'RELEASE_HOLD_NO_REFUND',
      preservesCurrentBooking: false,
      refundStatus: settled ? REFUND_STATUS.REQUESTED : REFUND_STATUS.NONE,
      releasesHold: true,
    };
  }
  return {
    decision: beforeCutoff ? CHANGE_DECISION.ALLOWED : CHANGE_DECISION.REVIEW,
    reason: beforeCutoff ? 'BEFORE_CUTOFF' : 'AFTER_CUTOFF',
    preservesCurrentBooking: true,
    proposalRequired: true,
  };
}

export const settleChangeProposal = ({ order, proposal, settlement = {} }) => {
  const proposalStatus = proposal?.status;
  const holdStatus = proposal?.hold?.status || proposal?.proposedHold?.status;
  if (!['ACCEPTED', 'OFFERED'].includes(proposalStatus) || holdStatus !== 'ACTIVE')
    return { accepted: false, preservesCurrentBooking: true, outcome: 'PROPOSAL_NOT_SETTLEABLE' };
  const difference =
    Number(proposal?.quote?.totalVnd ?? proposal?.totalVnd ?? 0) -
    Number(order?.acceptedQuote?.totalVnd ?? order?.totalPriceVnd ?? 0);
  if (difference > 0 && settlement.paymentStatus !== PAYMENT_STATUS.SUCCESS)
    return {
      accepted: false,
      preservesCurrentBooking: true,
      outcome: 'ADDITIONAL_PAYMENT_REQUIRED',
    };
  return {
    accepted: true,
    preservesCurrentBooking: false,
    outcome:
      difference > 0
        ? 'ADDITIONAL_PAYMENT_SETTLED'
        : difference < 0
          ? 'PARTIAL_REFUND_DUE'
          : 'EQUAL_PRICE',
    amountVnd: Math.abs(difference),
  };
};
