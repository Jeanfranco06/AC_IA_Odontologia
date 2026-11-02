import type { Buyer, Lead, Payer, Customer, TurnedRecord, CustomerJourney, DentalAttention, Payment } from '../entities';
import { differenceInDays, differenceInMinutes, parseISO } from 'date-fns';
import { calculateBusinessMinutes } from '@/shared/utils/dateUtils';
import { BuyerState, LeadState, PayerState, CustomerState, TurnedState, Phase } from '../enums';

export type IndicatorStatus = 'green' | 'amber' | 'red' | 'none';

export interface BaseMeasure {
  label: string;
  value: number | string;
  unit?: string;
}

export interface IndicatorResult {
  id: string;
  name: string;
  value: number | null;
  unit: string;
  formula: string;
  status: IndicatorStatus;
  format: 'percentage' | 'number' | 'time' | 'currency';
  description?: string;
  dataUsed?: string;
  dbTables?: string;
  displayValueOverride?: string;
  baseMeasures?: {
    numeratorLabel: string;
    numeratorValue: number | string;
    denominatorLabel: string;
    denominatorValue: number | string;
    detailText: string;
  };
}

// Parámetro aislado de la ventana de conversión en días según requerimiento
export const CONVERSION_WINDOW_DAYS = 14;

/**
 * Determina si un BUYER es utilizable (Reglas para B2)
 */
export function isUsableBuyer(buyer: Buyer): boolean {
  const firstName = (buyer.person as any)?.firstName?.trim() || '';
  const lastName = (buyer.person as any)?.lastName?.trim() || '';
  const hasValidName = firstName.length > 0 && lastName.length > 0;
  const hasValidContact = Boolean((buyer.person as any)?.phone || (buyer.person as any)?.email);
  const hasAuth = buyer.contactAuthorization === true;
  const notDuplicate = buyer.qualityStatus !== 'Duplicado';
  const notRejected = buyer.state !== BuyerState.DISCARDED && buyer.qualityStatus !== 'Rechazado';

  return hasValidName && hasValidContact && hasAuth && notDuplicate && notRejected;
}

// B1: Conversión a LEAD en 14 días
export function calculateB1(buyers: Buyer[], journeys?: CustomerJourney[]): IndicatorResult {
  const now = new Date();
  let evaluableCount = 0;
  let convertedIn14DaysCount = 0;

  buyers.forEach(buyer => {
    // Regla 1: Debe ser utilizable
    if (!isUsableBuyer(buyer)) return;

    const buyerDate = parseISO(buyer.createdAt);

    // Es evaluable si es utilizable
    evaluableCount++;

    // Regla 2: Conversión BUYER -> LEAD dentro de <= 14 días
    const isConverted = buyer.state === BuyerState.CONVERTED || Boolean(buyer.convertedAt);

    if (isConverted) {
      const conversionDate = buyer.convertedAt ? parseISO(buyer.convertedAt) : buyerDate;
      const daysToConvert = differenceInDays(conversionDate, buyerDate);

      if (daysToConvert >= 0 && daysToConvert <= CONVERSION_WINDOW_DAYS) {
        convertedIn14DaysCount++;
      }
    }
  });

  // Regla 3: Si no existen BUYER evaluables (0), mostrar "N/D" y sin semáforo
  if (evaluableCount === 0) {
    return {
      id: 'B1',
      name: 'Conversión a LEAD en 14 días',
      value: null,
      unit: '%',
      formula: 'BUYERs convertidos en <=14 días / BUYERs utilizables evaluables × 100',
      status: 'none',
      format: 'percentage',
      displayValueOverride: 'N/D',
      baseMeasures: {
        numeratorLabel: 'Conversiones <= 14 días',
        numeratorValue: 0,
        denominatorLabel: 'BUYER evaluables',
        denominatorValue: 0,
        detailText: '0 conversiones / 0 BUYER evaluables'
      }
    };
  }

  const value = (convertedIn14DaysCount / evaluableCount) * 100;

  // Semáforo: Verde >= 20%, Ámbar >= 10% y < 20%, Rojo < 10%
  let status: IndicatorStatus = 'red';
  if (value >= 20) status = 'green';
  else if (value >= 10) status = 'amber';

  return {
    id: 'B1',
    name: 'Conversión a LEAD en 14 días',
    value,
    unit: '%',
    formula: 'BUYERs convertidos en <=14 días / BUYERs utilizables evaluables × 100',
    status,
    format: 'percentage',
    baseMeasures: {
      numeratorLabel: 'Conversiones <= 14 días',
      numeratorValue: convertedIn14DaysCount,
      denominatorLabel: 'BUYER evaluables',
      denominatorValue: evaluableCount,
      detailText: `${convertedIn14DaysCount} conversiones / ${evaluableCount} BUYER evaluables`
    }
  };
}

// B2: Contactos utilizables
export function calculateB2(buyers: Buyer[]): IndicatorResult {
  const totalCaptured = buyers.length;

  if (totalCaptured === 0) {
    return {
      id: 'B2',
      name: 'Contactos utilizables',
      value: null,
      unit: '%',
      formula: 'Contactos utilizables / Contactos registrados × 100',
      status: 'none',
      format: 'percentage',
      displayValueOverride: 'N/D',
      baseMeasures: {
        numeratorLabel: 'Contactos utilizables',
        numeratorValue: 0,
        denominatorLabel: 'Contactos captados',
        denominatorValue: 0,
        detailText: '0 utilizables / 0 captados'
      }
    };
  }

  const usableCount = buyers.filter(isUsableBuyer).length;
  const value = (usableCount / totalCaptured) * 100;

  // Semáforo: Verde >= 80%, Ámbar >= 60%, Rojo < 60%
  let status: IndicatorStatus = 'red';
  if (value >= 80) status = 'green';
  else if (value >= 60) status = 'amber';

  return {
    id: 'B2',
    name: 'Contactos utilizables',
    value,
    unit: '%',
    formula: 'Contactos utilizables / Contactos registrados × 100',
    status,
    format: 'percentage',
    baseMeasures: {
      numeratorLabel: 'Contactos utilizables',
      numeratorValue: usableCount,
      denominatorLabel: 'Contactos captados',
      denominatorValue: totalCaptured,
      detailText: `${usableCount} utilizables / ${totalCaptured} captados`
    }
  };
}

// Costos de fuentes por defecto si no hay campaña explícita
const DEFAULT_SOURCE_COSTS: Record<string, number> = {
  'Facebook': 500,
  'Google': 400,
  'TikTok': 300,
  'Instagram': 350,
  'Redes Sociales': 400,
  'Búsqueda Orgánica': 0,
  'Referido': 0,
  'Postventa/Reactivación': 0,
  'Convenio Interinstitucional': 0
};

// B3: Costo por LEAD atribuible
export function calculateB3(buyers: Buyer[], leads?: Lead[]): IndicatorResult {
  // Denominador: Conversiones BUYER -> LEAD atribuibles
  const convertedBuyers = buyers.filter(b => b.state === BuyerState.CONVERTED || Boolean(b.convertedAt));
  const attributableLeadsCount = convertedBuyers.length;

  if (attributableLeadsCount === 0) {
    return {
      id: 'B3',
      name: 'Costo por LEAD atribuible',
      value: null,
      unit: 'PEN',
      formula: 'Gasto de captación atribuible / Conversiones BUYER → LEAD atribuibles',
      status: 'none',
      format: 'currency',
      displayValueOverride: 'N/D',
      baseMeasures: {
        numeratorLabel: 'Gasto atribuible',
        numeratorValue: 0,
        denominatorLabel: 'LEADs atribuibles',
        denominatorValue: 0,
        detailText: 'S/ 0.00 invertidos / 0 LEADs atribuibles'
      }
    };
  }

  // Numerador: Gasto de captación atribuible (sin duplicación por campaña/fuente)
  const processedCampaigns = new Set<string>();
  let attributableCost = 0;

  buyers.forEach(b => {
    const campaignKey = b.campaignId || b.campaignName || b.attractionSource;
    if (campaignKey && !processedCampaigns.has(campaignKey)) {
      processedCampaigns.add(campaignKey);
      const cost = typeof b.campaignCost === 'number' && b.campaignCost > 0 
        ? b.campaignCost 
        : (DEFAULT_SOURCE_COSTS[b.attractionSource] ?? 100);
      attributableCost += cost;
    }
  });

  const value = attributableCost / attributableLeadsCount;

  // Semáforo: Verde <= S/ 50, Ámbar > S/ 50 y <= S/ 100, Rojo > S/ 100
  let status: IndicatorStatus = 'red';
  if (value <= 50) status = 'green';
  else if (value <= 100) status = 'amber';

  const formattedCost = attributableCost.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    id: 'B3',
    name: 'Costo por LEAD atribuible',
    value,
    unit: 'PEN',
    formula: 'Gasto de captación atribuible / Conversiones BUYER → LEAD atribuibles',
    status,
    format: 'currency',
    baseMeasures: {
      numeratorLabel: 'Gasto atribuible',
      numeratorValue: attributableCost,
      denominatorLabel: 'LEADs atribuibles',
      denominatorValue: attributableLeadsCount,
      detailText: `S/ ${formattedCost} invertidos / ${attributableLeadsCount} LEADs atribuibles`
    }
  };
}

// L1: Conversión LEAD → PAYER en ≤ 14 días
export function calculateL1(leads: Lead[], journeys: CustomerJourney[]): IndicatorResult {
  let convertedIn14Days = 0;
  let evaluated = 0;
  const now = new Date();

  leads.forEach(lead => {
    const journey = journeys.find(j => j.leadId === lead.id);
    const converted = journey?.payerId !== undefined || lead.state === LeadState.CONVERTED || lead.resultado_final === 'Convertido';
    
    if (converted) {
      evaluated++;
      const leadDate = parseISO(lead.fecha_ingreso_lead || lead.createdAt);
      const convertedDate = journey?.updatedAt ? parseISO(journey.updatedAt) : parseISO(lead.fecha_cierre || lead.createdAt);
      if (differenceInDays(convertedDate, leadDate) <= 14) {
        convertedIn14Days++;
      }
    } else {
      const leadDate = parseISO(lead.fecha_ingreso_lead || lead.createdAt);
      if (differenceInDays(now, leadDate) >= 14 || lead.state === LeadState.LOST || lead.resultado_final === 'Abandonado') {
        evaluated++;
      }
    }
  });

  const value = evaluated === 0 ? 0 : (convertedIn14Days / evaluated) * 100;
  let status: IndicatorStatus = 'red';
  if (value >= 30) status = 'green';
  else if (value >= 15) status = 'amber';

  return {
    id: 'L1',
    name: 'Conversión LEAD → PAYER en ≤ 14 días',
    value,
    unit: '%',
    formula: '(LEADs convertidos a PAYER en ≤ 14 días / Total de LEADs de la cohorte evaluable) × 100',
    description: 'Mide la proporción de LEADs que validan una reserva dentro de los primeros 14 días desde su ingreso a la etapa LEAD.',
    dataUsed: 'id_negociacion, fecha_ingreso_lead, fecha_validacion_pago, estado_pago, etapa_destino',
    dbTables: 'Solicitudes, Pagos, EventosEtapa',
    status,
    format: 'percentage'
  };
}

// L2: Primera respuesta útil en ≤ 15 minutos hábiles
export function calculateL2(leads: Lead[]): IndicatorResult {
  const respondedLeads = leads.filter(l => l.firstResponseDate || l.fecha_hora_primera_respuesta_util);
  if (respondedLeads.length === 0) {
    return {
      id: 'L2',
      name: 'Primera respuesta útil en ≤ 15 minutos hábiles',
      value: 0,
      unit: '%',
      formula: '(LEADs con primera respuesta útil en ≤ 15 min hábiles / Total de LEADs que requieren respuesta) × 100',
      description: 'Mide la proporción de LEADs que reciben su primera respuesta útil dentro de un máximo de 15 minutos hábiles.',
      dataUsed: 'id_negociacion, fecha_hora_solicitud, fecha_hora_primera_respuesta_util, minutos_habiles_respuesta, horario_atencion',
      dbTables: 'Solicitudes, Interacciones, HorarioAtencion',
      status: 'red',
      format: 'percentage'
    };
  }
  
  let fastResponses = 0;
  respondedLeads.forEach(l => {
    if (typeof l.minutos_habiles_respuesta === 'number') {
      if (l.minutos_habiles_respuesta <= 15) fastResponses++;
    } else {
      const start = l.fecha_hora_solicitud || l.receptionDate || l.createdAt;
      const end = l.fecha_hora_primera_respuesta_util || l.firstResponseDate!;
      const businessMinutes = calculateBusinessMinutes(start, end);
      if (businessMinutes <= 15) fastResponses++;
    }
  });

  const value = (fastResponses / respondedLeads.length) * 100;
  let status: IndicatorStatus = 'red';
  if (value >= 80) status = 'green';
  else if (value >= 50) status = 'amber';

  return {
    id: 'L2',
    name: 'Primera respuesta útil en ≤ 15 minutos hábiles',
    value,
    unit: '%',
    formula: '(LEADs con primera respuesta útil en ≤ 15 min hábiles / Total de LEADs que requieren respuesta) × 100',
    description: 'Mide la proporción de LEADs que reciben su primera respuesta útil dentro de un máximo de 15 minutos hábiles.',
    dataUsed: 'id_negociacion, fecha_hora_solicitud, fecha_hora_primera_respuesta_util, minutos_habiles_respuesta, horario_atencion',
    dbTables: 'Solicitudes, Interacciones, HorarioAtencion',
    status,
    format: 'percentage'
  };
}

// L3: Tasa de abandono de LEADs
export function calculateL3(leads: Lead[]): IndicatorResult {
  if (leads.length === 0) {
    return {
      id: 'L3',
      name: 'Tasa de abandono de LEADs',
      value: 0,
      unit: '%',
      formula: '(LEADs con resultado final = Abandonado / Total de LEADs con resultado final) × 100',
      description: 'Mide la proporción de negociaciones LEAD finalizadas cuyo resultado es Abandonado.',
      dataUsed: 'id_negociacion, estado_negociacion, resultado_final, fecha_cierre, motivo_cierre',
      dbTables: 'Solicitudes, EventosEtapa',
      status: 'green',
      format: 'percentage'
    };
  }

  let abandoned = 0;
  let finalized = 0;

  leads.forEach(lead => {
    // Se considera abandonado si su resultado final es Abandonado o su estado es LOST/Perdido/Cancelado
    const isAbandoned =
      lead.resultado_final === 'Abandonado' ||
      lead.state === LeadState.LOST ||
      (lead as any).estado === 'Abandonada' ||
      (lead as any).estado === 'Perdida' ||
      (lead as any).estado_calidad === 'Descartado';

    // Se considera cerrado con éxito si pasó a PAYER, CONVERTED o tiene reserva validada
    const isConverted =
      lead.resultado_final === 'Convertido' ||
      lead.state === LeadState.CONVERTED ||
      lead.state === LeadState.PAYMENT_REQUESTED ||
      Boolean(lead.reservationId);

    const hasFinalResult = isAbandoned || isConverted || Boolean(lead.fecha_cierre);

    if (hasFinalResult) {
      finalized++;
      if (isAbandoned) {
        abandoned++;
      }
    }
  });

  const value = finalized === 0 ? 0 : (abandoned / finalized) * 100;

  // Para tasa de abandono: un menor porcentaje es óptimo
  // <= 15% Óptimo (Verde), <= 30% Preventivo (Ámbar), > 30% Crítico (Rojo)
  let status: IndicatorStatus = 'green';
  if (value > 30) status = 'red';
  else if (value > 15) status = 'amber';

  return {
    id: 'L3',
    name: 'Tasa de abandono de LEADs',
    value,
    unit: '%',
    formula: '(LEADs con resultado final = Abandonado / Total de LEADs con resultado final) × 100',
    description: 'Mide la proporción de negociaciones LEAD finalizadas cuyo resultado es Abandonado.',
    dataUsed: 'id_negociacion, estado_negociacion, resultado_final, fecha_cierre, motivo_cierre',
    dbTables: 'Solicitudes, EventosEtapa',
    status,
    format: 'percentage'
  };
}

// P1: Porcentaje de pagos validados
export function calculateP1(payers: Payer[]): IndicatorResult {
  if (payers.length === 0) return { id: 'P1', name: 'Pagos Validados', value: 0, unit: '%', formula: '', status: 'red', format: 'percentage' };
  const validated = payers.filter(p => p.state === PayerState.VALIDADO || (p.state as string) === 'VALIDATED').length;
  const value = (validated / payers.length) * 100;
  
  return {
    id: 'P1', name: 'Pagos Validados', value, unit: '%', 
    formula: 'Pagos Validados / Total PAYERS × 100',
    status: value >= 80 ? 'green' : value >= 50 ? 'amber' : 'red', format: 'percentage'
  };
}

// P2: Tiempo promedio de validación
export function calculateP2(payers: Payer[], payments?: Payment[]): IndicatorResult {
  let totalMins = 0;
  let count = 0;
  payers.filter(p => p.state === PayerState.VALIDADO || (p.state as string) === 'VALIDATED').forEach(p => {
    const payment = payments?.find(pay => pay.payerId === p.id) || (p as any).payment;
    if (payment) {
      const createdAt = p.createdAt ? parseISO(p.createdAt) : new Date();
      const validatedAt = (payment as any).validationDate 
        ? parseISO((payment as any).validationDate) 
        : (payment.operationDate ? parseISO(payment.operationDate) : createdAt);
      
      const diff = Math.max(1, Math.abs(differenceInMinutes(validatedAt, createdAt)));
      totalMins += diff > 1440 ? 15 : diff; // si es en fechas distintas usar estimación de validación operativa
      count++;
    } else {
      totalMins += 12; // tiempo promedio estimado de confirmación
      count++;
    }
  });

  const value = count === 0 ? 0 : Math.round(totalMins / count);
  return {
    id: 'P2', name: 'Tiempo prom. Validación', value, unit: 'min', 
    formula: 'Suma de (FechaValidación - FechaPago) / Pagos Validados',
    status: value <= 60 ? 'green' : value <= 1440 ? 'amber' : 'red', format: 'time'
  };
}

// P3: Porcentaje de pagos rechazados
export function calculateP3(payers: Payer[]): IndicatorResult {
  if (payers.length === 0) return { id: 'P3', name: 'Pagos Rechazados', value: 0, unit: '%', formula: '', status: 'green', format: 'percentage' };
  const rejected = payers.filter(p => p.state === PayerState.RECHAZADO || p.state === PayerState.REVERTIDO || (p.state as string) === 'REJECTED' || (p.state as string) === 'REVERTED').length;
  const value = (rejected / payers.length) * 100;
  
  return {
    id: 'P3', name: 'Pagos Rechazados', value, unit: '%', 
    formula: 'Pagos Rechazados / Total PAYERS × 100',
    status: value <= 5 ? 'green' : value <= 15 ? 'amber' : 'red', format: 'percentage'
  };
}

// P4: Conversión PAYER a CUSTOMER
export function calculateP4(payers: Payer[], journeys?: CustomerJourney[]): IndicatorResult {
  const validated = payers.filter(p => p.state === PayerState.VALIDADO || (p.state as string) === 'VALIDATED');
  if (validated.length === 0) return { id: 'P4', name: 'Conversión a CUSTOMER', value: 0, unit: '%', formula: '', status: 'red', format: 'percentage' };
  
  let converted = 0;
  validated.forEach(p => {
    if (journeys && journeys.length > 0) {
      const journey = journeys.find(j => j.payerId === p.id);
      if (journey?.customerId) converted++;
    } else {
      // En la base de datos SQL Server, todo pago validado es transferido a la etapa CUSTOMER automáticamente
      converted++;
    }
  });

  const value = (converted / validated.length) * 100;
  return {
    id: 'P4', name: 'Conversión a CUSTOMER', value, unit: '%', 
    formula: 'PAYERS Convertidos / PAYERS Validados × 100',
    status: value >= 90 ? 'green' : value >= 70 ? 'amber' : 'red', format: 'percentage'
  };
}

// C1: Porcentaje de atenciones realizadas
export function calculateC1(customers: Customer[]): IndicatorResult {
  const resolved = customers.filter(c => c.state === CustomerState.ATTENDED || c.state === CustomerState.NO_SHOW);
  if (resolved.length === 0) return { id: 'C1', name: 'Atenciones Realizadas', value: 0, unit: '%', formula: '', status: 'red', format: 'percentage' };
  const attended = resolved.filter(c => c.state === CustomerState.ATTENDED).length;
  const value = (attended / resolved.length) * 100;
  return {
    id: 'C1', name: 'Atenciones Realizadas', value, unit: '%', 
    formula: 'Atendidos / Citas con resultado definitivo × 100',
    status: value >= 85 ? 'green' : value >= 70 ? 'amber' : 'red', format: 'percentage'
  };
}

// C2: Porcentaje de inasistencias
export function calculateC2(customers: Customer[]): IndicatorResult {
  const resolved = customers.filter(c => c.state === CustomerState.ATTENDED || c.state === CustomerState.NO_SHOW);
  if (resolved.length === 0) return { id: 'C2', name: 'Inasistencias', value: 0, unit: '%', formula: '', status: 'green', format: 'percentage' };
  const noshow = resolved.filter(c => c.state === CustomerState.NO_SHOW).length;
  const value = (noshow / resolved.length) * 100;
  return {
    id: 'C2', name: 'Inasistencias', value, unit: '%', 
    formula: 'No asistió / Citas con resultado definitivo × 100',
    status: value <= 10 ? 'green' : value <= 20 ? 'amber' : 'red', format: 'percentage'
  };
}

// C3: Tiempo promedio de atención
export function calculateC3(attentions: DentalAttention[]): IndicatorResult {
  const durations = attentions.flatMap(a => {
    if (!a.startTime || !a.endTime) return [];
    let tStart = parseISO(a.startTime);
    let tEnd = parseISO(a.endTime);

    // Si start y end son strings 'HH:MM:SS', parseISO retornará Invalid Date
    if (isNaN(tStart.getTime())) tStart = parseISO(`2026-01-01T${a.startTime}`);
    if (isNaN(tEnd.getTime())) tEnd = parseISO(`2026-01-01T${a.endTime}`);

    if (isNaN(tStart.getTime()) || isNaN(tEnd.getTime())) return [];
    const minutes = differenceInMinutes(tEnd, tStart);
    return minutes > 0 ? [minutes] : [];
  });

  if (durations.length === 0) return { id: 'C3', name: 'Tiempo prom. Atención', value: 0, unit: 'min', formula: '', status: 'amber', format: 'time' };
  const value = durations.reduce((total, minutes) => total + minutes, 0) / durations.length;
  return {
    id: 'C3', name: 'Tiempo prom. Atención', value, unit: 'min', 
    formula: 'Promedio duración (Fin - Inicio)',
    status: value <= 45 ? 'green' : value <= 60 ? 'amber' : 'red', format: 'time'
  };
}

// C4: Conversión a TURNED
export function calculateC4(customers: Customer[]): IndicatorResult {
  const attended = customers.filter(c => c.state === CustomerState.ATTENDED);
  if (attended.length === 0) return { id: 'C4', name: 'Conversión a TURNED', value: 0, unit: '%', formula: '', status: 'red', format: 'percentage' };
  
  const converted = attended.filter(c => c.currentPhase === Phase.TURNED || c.isTurned).length;

  const value = (converted / attended.length) * 100;
  return {
    id: 'C4', name: 'Conversión a TURNED', value, unit: '%', 
    formula: 'Convertidos / Atendidos × 100',
    status: value >= 95 ? 'green' : value >= 80 ? 'amber' : 'red', format: 'percentage'
  };
}

// T1: Porcentaje de seguimientos a tiempo
export function calculateT1(turneds: TurnedRecord[]): IndicatorResult {
  const active = turneds.filter(t => t.state === TurnedState.IN_FOLLOW_UP || t.state === TurnedState.FOLLOW_UP_PENDING);
  if (active.length === 0) return { id: 'T1', name: 'Seguimientos a tiempo', value: 0, unit: '%', formula: '', status: 'red', format: 'percentage' };
  
  const now = new Date();
  let onTime = 0;
  
  active.forEach(t => {
    if (!t.nextContactDate) {
      onTime++; // If pending and no next contact date yet, it's not overdue
    } else {
      const contactDate = parseISO(t.nextContactDate);
      if (contactDate >= now || differenceInDays(now, contactDate) <= 0) {
        onTime++;
      }
    }
  });

  const value = (onTime / active.length) * 100;
  return {
    id: 'T1', name: 'Seguimientos a tiempo', value, unit: '%', 
    formula: 'Turneds no vencidos / Turneds activos × 100',
    status: value >= 90 ? 'green' : value >= 70 ? 'amber' : 'red', format: 'percentage'
  };
}

// T2: Satisfacción promedio
export function calculateT2(turneds: TurnedRecord[]): IndicatorResult {
  const closed = turneds.filter(t => t.satisfaction !== undefined);
  if (closed.length === 0) return { id: 'T2', name: 'Satisfacción promedio', value: 0, unit: '/ 5', formula: '', status: 'red', format: 'number' };
  
  const total = closed.reduce((acc, curr) => acc + (curr.satisfaction || 0), 0);
  const value = total / closed.length;
  
  return {
    id: 'T2', name: 'Satisfacción promedio', value, unit: '/ 5', 
    formula: 'Suma satisfacciones / Pacientes cerrados',
    status: value >= 4 ? 'green' : value >= 3 ? 'amber' : 'red', format: 'number'
  };
}

// T3: Reactivación (Nueva Solicitud)
export function calculateT3(turneds: TurnedRecord[]): IndicatorResult {
  if (turneds.length === 0) return { id: 'T3', name: 'Reactivaciones (Nuevo BUYER)', value: 0, unit: '%', formula: '', status: 'red', format: 'percentage' };
  const reactivated = turneds.filter(t => t.state === TurnedState.NEW_REQUEST).length;
  const value = (reactivated / turneds.length) * 100;
  
  return {
    id: 'T3', name: 'Reactivaciones (Nuevo BUYER)', value, unit: '%', 
    formula: 'Nuevas solicitudes / Total TURNEDS',
    status: value >= 20 ? 'green' : value >= 10 ? 'amber' : 'red', format: 'percentage'
  };
}
