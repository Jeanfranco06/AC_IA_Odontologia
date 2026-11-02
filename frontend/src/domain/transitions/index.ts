import type {
  Buyer,
  Lead,
  Payer,
  Customer,
  DentalAttention,
  Reservation,
} from '../entities';
import { PayerState, CustomerState } from '../enums';

export interface TransitionResult {
  success: boolean;
  error?: string;
}

export function canTransitionBuyerToLead(buyer: Buyer): TransitionResult {
  // Se requiere un ID de persona o ID de buyer asociado
  if (!buyer.personId && !buyer.id) {
    return {
      success: false,
      error: 'Faltan datos mínimos del prospecto.',
    };
  }
  return { success: true };
}

export function canTransitionLeadToPayer(lead: Lead): TransitionResult {
  if (!lead.selectedAlternativeId) {
    return {
      success: false,
      error: 'Debe existir una alternativa seleccionada.',
    };
  }
  if (!lead.reservationId) {
    return { success: false, error: 'Debe existir una reserva.' };
  }
  if (!lead.paymentRequestId) {
    return { success: false, error: 'Debe generarse una solicitud de pago.' };
  }
  return { success: true };
}

export function canTransitionPayerToCustomer(
  payer: Payer,
  reservation?: Reservation,
): TransitionResult {
  if (payer.state !== PayerState.VALIDADO && (payer.state as string) !== 'VALIDATED') {
    return { success: false, error: 'El pago debe estar validado.' };
  }
  if (!payer.reservationId) {
    return {
      success: false,
      error: 'El pago debe estar vinculado con una reserva.',
    };
  }
  if (reservation && reservation.id !== payer.reservationId) {
    return { success: false, error: 'La reserva vinculada no coincide.' };
  }
  return { success: true };
}

export function canTransitionCustomerToTurned(
  customer: Customer,
  attention?: DentalAttention,
): TransitionResult {
  if (customer.state !== CustomerState.ATTENDED) {
    return {
      success: false,
      error: 'El estado debe ser atendido para finalizar el recorrido.',
    };
  }
  if (!attention) {
    return { success: false, error: 'Debe existir un registro de atención.' };
  }
  if (!attention.procedure || attention.procedure.trim() === '') {
    return {
      success: false,
      error: 'Debe existir información del procedimiento realizado.',
    };
  }
  if (!attention.instructions || attention.instructions.trim() === '') {
    return {
      success: false,
      error: 'Debe existir información de las indicaciones dadas.',
    };
  }
  return { success: true };
}
