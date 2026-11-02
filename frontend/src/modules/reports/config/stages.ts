import { CreditCard, HeartHandshake, Stethoscope, UserPlus, Users, type LucideIcon } from 'lucide-react';
import type { ReportStage } from '@/shared/services/report.service';

export type MeasurePolarity = 'up' | 'down' | 'neutral';

export interface MeasureOption {
  value: string;
  label: string;
  unit: 'cant' | 'pen' | 'dias' | 'min';
  aggregation: 'sum' | 'avg' | 'ratio';
  polarity: MeasurePolarity;
}

export interface StageConfig {
  id: ReportStage;
  index: string;
  label: string;
  role: string;
  description: string;
  icon: LucideIcon;
  defaultMeasure: string;
  measures: MeasureOption[];
}

export const UNIT_LABEL: Record<MeasureOption['unit'], string> = {
  cant: 'Cantidad',
  pen: 'Soles (S/)',
  dias: 'Días promedio',
  min: 'Minutos promedio',
};

export const STAGES: StageConfig[] = [
  {
    id: 'buyer',
    index: '01',
    label: 'Captación',
    role: 'Buyer',
    description: 'Contactos atraídos por fuente, canal y sede.',
    icon: Users,
    defaultMeasure: 'contacto_registrado',
    measures: [
      { value: 'contacto_registrado', label: 'contacto_registrado', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'contacto_utilizable', label: 'contacto_utilizable', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'conversion_lead', label: 'conversion_lead', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'tiempo_conversion_dia', label: 'tiempo_conversion_dia', unit: 'dias', aggregation: 'avg', polarity: 'down' },
      { value: 'costo_atribuido_captacion', label: 'costo_atribuido_captacion', unit: 'pen', aggregation: 'sum', polarity: 'down' },
      { value: 'monto_inversion', label: 'Reporte 2: Inversión en Pauta (S/.)', unit: 'pen', aggregation: 'sum', polarity: 'down' },
      { value: 'costo_por_lead', label: 'Reporte 2: CPL de campaña (S/ por LEAD)', unit: 'pen', aggregation: 'ratio', polarity: 'down' },
    ],
  },
  {
    id: 'lead',
    index: '02',
    label: 'Negociación',
    role: 'Lead',
    description: 'Gestión comercial por sede, negociador y tratamiento.',
    icon: UserPlus,
    defaultMeasure: 'cohorte_evaluable',
    measures: [
      { value: 'cohorte_evaluable', label: 'cohorte_evaluable', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'conversion_payer_14_dia', label: 'conversion_payer_14_dia', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'solicitud_requiere_respuesta', label: 'solicitud_requiere_respuesta', unit: 'cant', aggregation: 'sum', polarity: 'neutral' },
      { value: 'respuesta_util_15_min', label: 'respuesta_util_15_min', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'negociacion_finalizada', label: 'negociacion_finalizada', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'negociacion_abandonada', label: 'negociacion_abandonada', unit: 'cant', aggregation: 'sum', polarity: 'down' },
    ],
  },
  {
    id: 'payer',
    index: '03',
    label: 'Recaudación',
    role: 'Payer',
    description: 'Cobros por modalidad, canal y estado del pago.',
    icon: CreditCard,
    defaultMeasure: 'pago_registrado',
    measures: [
      { value: 'pago_registrado', label: 'pago_registrado', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'pago_validado', label: 'pago_validado', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'pago_rechazado', label: 'pago_rechazado', unit: 'cant', aggregation: 'sum', polarity: 'down' },
      { value: 'conversion_customer', label: 'conversion_customer', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'costo_transaccion', label: 'costo_transaccion', unit: 'pen', aggregation: 'sum', polarity: 'down' },
      { value: 'tiempo_validacion_minuto', label: 'tiempo_validacion_minuto', unit: 'min', aggregation: 'avg', polarity: 'down' },
      { value: 'importe_total_cobro', label: 'importe_total_cobro', unit: 'pen', aggregation: 'sum', polarity: 'up' },
    ],
  },
  {
    id: 'customer',
    index: '04',
    label: 'Prestación clínica',
    role: 'Customer',
    description: 'Atenciones por categoría, servicio y sede clínica.',
    icon: Stethoscope,
    defaultMeasure: 'cita_evaluable',
    measures: [
      { value: 'cita_evaluable', label: 'cita_evaluable', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'atencion_realizada', label: 'atencion_realizada', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'cita_inasistencia', label: 'cita_inasistencia', unit: 'cant', aggregation: 'sum', polarity: 'down' },
      { value: 'tiempo_sillon_dental_minuto', label: 'tiempo_sillon_dental_minuto', unit: 'min', aggregation: 'avg', polarity: 'neutral' },
      { value: 'atencion_finalizada_conforme', label: 'atencion_finalizada_conforme', unit: 'cant', aggregation: 'sum', polarity: 'up' },
    ],
  },
  {
    id: 'turned',
    index: '05',
    label: 'Fidelización',
    role: 'Turned',
    description: 'Seguimiento postventa, incidencias y retorno de pacientes.',
    icon: HeartHandshake,
    defaultMeasure: 'seguimiento_registrado',
    measures: [
      { value: 'seguimiento_registrado', label: 'seguimiento_registrado', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'seguimiento_efectivo', label: 'seguimiento_efectivo', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'incidencia_reportada', label: 'incidencia_reportada', unit: 'cant', aggregation: 'sum', polarity: 'down' },
      { value: 'incidencia_resuelta_24_hora', label: 'incidencia_resuelta_24_hora', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'retorno_cohorte_90_dia', label: 'retorno_cohorte_90_dia', unit: 'cant', aggregation: 'sum', polarity: 'up' },
      { value: 'paciente_elegible_retorno', label: 'paciente_elegible_retorno', unit: 'cant', aggregation: 'sum', polarity: 'neutral' },
    ],
  },
];

export const KPI_STAGES: StageConfig[] = STAGES.slice(0, 4);

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<ReportStage, StageConfig>;

const LEGACY_MEASURE_MAP: Record<string, string> = {
  contactos_registrados: 'contacto_registrado',
  contactos_utilizables: 'contacto_utilizable',
  conversiones_lead: 'conversion_lead',
  tiempo_conversion: 'tiempo_conversion_dia',
  costo_atribuido: 'costo_atribuido_captacion',
  leads_cohorte: 'cohorte_evaluable',
  leads_convertidos_14d: 'conversion_payer_14_dia',
  leads_requieren_resp: 'solicitud_requiere_respuesta',
  leads_resp_15m: 'respuesta_util_15_min',
  leads_resultado_final: 'negociacion_finalizada',
  leads_abandonados: 'negociacion_abandonada',
  pagos_registrados: 'pago_registrado',
  pagos_validados: 'pago_validado',
  pagos_rechazados: 'pago_rechazado',
  conversiones_customer: 'conversion_customer',
  costo_transacciones: 'costo_transaccion',
  tiempo_validacion: 'tiempo_validacion_minuto',
  importe_total: 'importe_total_cobro',
  citas_evaluables: 'cita_evaluable',
  atenciones_realizadas: 'atencion_realizada',
  citas_inasistencia: 'cita_inasistencia',
  tiempo_sillon: 'tiempo_sillon_dental_minuto',
  atenciones_conformes: 'atencion_finalizada_conforme',
  seguimientos_registrados: 'seguimiento_registrado',
  seguimientos_efectivos: 'seguimiento_efectivo',
  incidencias_reportadas: 'incidencia_reportada',
  incidencias_resueltas: 'incidencia_resuelta_24_hora',
  retornos_cohorte: 'retorno_cohorte_90_dia',
  retornos_90dias: 'retorno_cohorte_90_dia',
  pacientes_elegibles: 'paciente_elegible_retorno',
};

export function getMeasure(stage: ReportStage, value: string): MeasureOption {
  const cfg = STAGE_BY_ID[stage];
  const normalizedValue = LEGACY_MEASURE_MAP[value] || value;
  return cfg.measures.find((m) => m.value === normalizedValue) ?? cfg.measures[0];
}

export type ReportView = ReportStage | 'all';

export const VIEW_OPTIONS: Array<{ id: ReportView; label: string }> = [
  ...STAGES.map((s) => ({ id: s.id as ReportView, label: s.label })),
  { id: 'all', label: 'Consolidado' },
];
