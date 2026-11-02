export const BuyerState = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  CONVERTED: 'CONVERTED',
  DISCARDED: 'DISCARDED',
  DUPLICATED: 'DUPLICATED',
} as const;
export type BuyerState = (typeof BuyerState)[keyof typeof BuyerState];

export const LeadState = {
  IN_NEGOTIATION: 'IN_NEGOTIATION',
  ALTERNATIVE_SELECTED: 'ALTERNATIVE_SELECTED',
  PAYMENT_REQUESTED: 'PAYMENT_REQUESTED',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
} as const;
export type LeadState = (typeof LeadState)[keyof typeof LeadState];

export const PayerState = {
  PENDING: 'PENDIENTE',
  IN_REVIEW: 'EN_REVISION',
  VALIDATED: 'VALIDADO',
  REJECTED: 'RECHAZADO',
  REVERTED: 'REVERTIDO',

  // Identificadores canónicos en español
  PENDIENTE: 'PENDIENTE',
  EN_REVISION: 'EN_REVISION',
  VALIDADO: 'VALIDADO',
  RECHAZADO: 'RECHAZADO',
  REVERTIDO: 'REVERTIDO',
} as const;
export type PayerState = (typeof PayerState)[keyof typeof PayerState];

export function normalizePayerState(state?: string | null): PayerState {
  if (!state) return PayerState.PENDIENTE;
  const s = state.toUpperCase().trim();
  if (s === 'VALIDATED' || s === 'VALIDADO') return PayerState.VALIDADO;
  if (s === 'IN_REVIEW' || s === 'EN_REVISION' || s === 'EN REVISIÓN' || s === 'EN REVISION') return PayerState.EN_REVISION;
  if (s === 'REJECTED' || s === 'RECHAZADO') return PayerState.RECHAZADO;
  if (s === 'REVERTED' || s === 'REVERTIDO') return PayerState.REVERTIDO;
  return PayerState.PENDIENTE;
}

export const CustomerState = {
  SCHEDULED: 'SCHEDULED',
  ATTENDANCE_CONFIRMED: 'ATTENDANCE_CONFIRMED',
  IN_ATTENTION: 'IN_ATTENTION',
  ATTENDED: 'ATTENDED',
  NO_SHOW: 'NO_SHOW',
  CANCELED: 'CANCELED',
} as const;
export type CustomerState = (typeof CustomerState)[keyof typeof CustomerState];

export const TurnedState = {
  FOLLOW_UP_PENDING: 'FOLLOW_UP_PENDING',
  IN_FOLLOW_UP: 'IN_FOLLOW_UP',
  CLOSED: 'CLOSED',
  NEW_REQUEST: 'NEW_REQUEST',
} as const;
export type TurnedState = (typeof TurnedState)[keyof typeof TurnedState];

export const Phase = {
  BUYER: 'BUYER',
  LEAD: 'LEAD',
  PAYER: 'PAYER',
  CUSTOMER: 'CUSTOMER',
  TURNED: 'TURNED',
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];
