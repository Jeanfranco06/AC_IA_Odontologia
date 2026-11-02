import {
  BuyerState,
  LeadState,
  PayerState,
  CustomerState,
  TurnedState,
  Phase,
} from '../enums';

export interface Person {
  id?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  documentType?: string;
  documentNumber?: string;
}

export interface DentalService {
  id: string;
  name: string;
  description: string;
}

export interface Professional {
  id: string;
  name: string;
  specialty: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
}

export interface Buyer {
  id: string;
  personId: string;
  person?: Person;
  channel: string;
  channelId?: string;
  attractionSource: string;
  attractionSourceId?: string;
  campaignId?: string;
  campaignName?: string;
  campaignCost?: number;
  serviceOfInterest?: string;
  serviceOfInterestId?: string;
  preferences?: string;
  contactAuthorization: boolean;
  qualityStatus?: string;
  convertedAt?: string;
  state: BuyerState;
  createdAt: string;
  concreteRequest?: string; // Requerido para pasar a LEAD

  // Campos adicionales de Mesa de Negociación
  pref_id_canal?: string;
  pref_id_horario?: string;
  pref_id_modalidad?: string;
  pref_sede_preferida?: string;
  pref_profesional_preferido?: string;
  
  estudianteAplica?: boolean;
  universidad?: string;
  carrera?: string;
  ciclo?: string;
  
  laboralAplica?: boolean;
  ocupacion?: string;
  empresa?: string;
  modalidadLaboral?: string;
  disponibilidadLaboral?: string;
  
  ultima_visita_odontologica?: string;
  tratamiento_previo?: string;
  nivel_dolor?: string;
  presenta_sensibilidad?: string;
  sangrado_o_inflamacion?: string;
  usa_aparato_o_protesis?: string;
  condicion_atencion_especial?: string;

  // Inteligencia de Consultas Recurrentes
  consultasCount?: number;
  solicitudesHistory?: Array<{ id: string; servicio?: string; motivo?: string; fecha?: string }>;
  interaccionesHistory?: Array<{ id: string; tipo: string; mensaje: string; canal?: string; fuente?: string; fecha: string }>;
}

export interface NegotiationAlternative {
  id: string;
  leadId: string;
  service: string;
  professional: string;
  branch: string;
  date: string;
  time: string;
  price: number;
  conditions?: string;
  observations?: string;
}

export interface Lead {
  id: string;
  buyerId: string;
  requestedServiceId: string;
  professionalId?: string;
  branchId?: string;
  date?: string;
  time?: string;
  price?: number;
  declaredPreferences?: string;
  selectedAlternativeId?: string;
  reservationId?: string;
  paymentRequestId?: string;
  state: LeadState;
  createdAt: string;
  alternatives?: NegotiationAlternative[];
  receptionDate?: string;
  firstResponseDate?: string;
  followUpAuthorization?: boolean;
  clinicalDerivationNeeded?: boolean;
  clinicalObservation?: string;

  // Datos específicos de negociación y cierre de LEAD (L1, L2, L3)
  id_negociacion?: string | number;
  estado_negociacion?: string;
  resultado_final?: 'Abandonado' | 'Convertido' | string;
  fecha_cierre?: string;
  motivo_cierre?: string;
  fecha_ingreso_lead?: string;
  fecha_validacion_pago?: string;
  estado_pago?: string;
  etapa_destino?: string;
  fecha_hora_solicitud?: string;
  fecha_hora_primera_respuesta_util?: string;
  minutos_habiles_respuesta?: number;
}

export interface Reservation {
  id: string;
  leadId: string;
  date: string;
  time: string;
  professionalId?: string;
  branchId?: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELED';
}

export interface PaymentRequest {
  id: string;
  leadId: string;
  amount: number;
  currency: 'PEN';
  status: 'PENDING' | 'PAID';
}

export interface Payment {
  id: string;
  payerId: string;
  amount: number;
  currency: 'PEN';
  channel: string;
  operationNumber: string;
  operationDate: string;
  receiptMetadata?: {
    name: string;
    size: number;
    type: string;
  };
  observations?: string;
}

export interface PaymentIncident {
  id: string;
  payerId: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
}

export interface Payer {
  id: string;
  leadId: string;
  reservationId: string;
  paymentId?: string;
  amountToPay: number;
  currency: 'PEN';
  state: PayerState;
  createdAt: string;
}

export interface DentalAttention {
  id: string;
  customerId: string;
  reasonForConsultation?: string;
  relevantBackground?: string;
  allergies?: string;
  evaluation?: string;
  observations?: string;
  procedure?: string;
  instructions?: string;
  startTime?: string;
  endTime?: string;
}

export interface Customer {
  id: string;
  payerId: string;
  reservationId: string;
  state: CustomerState;
  createdAt: string;
  attentionId?: string;
  isTurned?: boolean;
  currentPhase?: typeof Phase.CUSTOMER | typeof Phase.TURNED;
}

export interface CustomerIncident {
  id: string;
  customerId: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
}

export interface FollowUp {
  id: string;
  turnedId: string;
  date: string;
  channel: string;
  contactResult: string;
  observations: string;
  nextFollowUpDate?: string;
}

export interface Alert {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface TurnedRecord {
  id: string;
  customerId: string;
  state: TurnedState;
  finalResult?: string;
  satisfaction?: number;
  customerComment?: string;
  endDate?: string;
  nextContactDate?: string;
  createdAt: string;
}

export interface CustomerJourney {
  id: string;
  personId: string;
  currentPhase: Phase;
  buyerId?: string;
  leadId?: string;
  payerId?: string;
  customerId?: string;
  turnedId?: string;
  createdAt: string;
  updatedAt: string;
}
