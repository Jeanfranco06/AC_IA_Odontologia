export interface SedeCatalogItem {
  id_sede: number;
  nombre: string;
  direccion?: string | null;
}

export interface CanalCatalogItem {
  id_canal: number;
  nombre: string;
}

export interface FuenteCatalogItem {
  id_fuente: number;
  nombre: string;
}

export interface ServicioCatalogItem {
  id_servicio: number;
  nombre: string;
}

export interface ModalidadCatalogItem {
  id_modalidad: number;
  nombre: string;
}

export interface HorarioCatalogItem {
  id_horario: number;
  dia_semana?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
}

export interface BuyerCatalogs {
  canales: CanalCatalogItem[];
  fuentes: FuenteCatalogItem[];
  servicios: ServicioCatalogItem[];
  sedes: SedeCatalogItem[];
  modalidades: ModalidadCatalogItem[];
  horarios: HorarioCatalogItem[];
}

export interface OpportunityPerson {
  id_persona: number;
  nombres: string;
  apellidos: string;
  numero: string;
  telefono_normalizado?: string | null;
  email?: string | null;
  dni?: string | null;
  autoriza_contacto?: boolean;
  consentimiento_atencion?: boolean;
  estado_calidad?: string;
}

export interface ImpulseAlertItem {
  id_alerta: number;
  codigo_alerta: string;
  tipo_alerta: string;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  estado: 'ACTIVA' | 'RESUELTA' | 'IGNORADA';
  mensaje: string;
  fecha_creacion: string;
  fecha_resolucion?: string | null;
  motivo_resolucion?: string | null;
  id_oportunidad?: number | null;
  id_persona?: number | null;
}

export interface OpportunityItem {
  id_oportunidad: number;
  id_persona: number;
  estado_oportunidad: 'NUEVO' | 'EN_CALIFICACION' | 'CALIFICADO' | 'CONVERTIDO' | 'DESCARTADO';
  fecha_registro: string;
  fecha_primera_respuesta?: string | null;
  fecha_conversion?: string | null;
  necesidad_declarada?: string | null;
  costo_atribuido?: number;
  canal?: string;
  fuente?: string;
  sede?: string;
  servicio?: string;
  campana?: string | null;
  Persona: OpportunityPerson;
  Canal?: CanalCatalogItem;
  Fuente?: FuenteCatalogItem;
  SedePreferida?: SedeCatalogItem;
  ServicioInteres?: ServicioCatalogItem;
  Campana?: { id_campana: number; nombre: string } | null;
  ImpulseAlerts?: ImpulseAlertItem[];
}

export interface OpportunityDetail extends OpportunityItem {
  tiempo_respuesta_minutos?: number | null;
  DecisionesIA?: AIDecisionItem[];
}

export interface FollowUpTask {
  id_oportunidad: number;
  persona: OpportunityPerson;
  servicioInteres: string;
  sedePreferida: string;
  canal: string;
  fuente: string;
  campana: string | null;
  estado_oportunidad: string;
  fecha_registro: string;
  minutosEspera: number;
  isSlaBreached: boolean;
  isPendingResponse: boolean;
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA';
  alertasActivas: number;
  alertas: ImpulseAlertItem[];
  necesidad_declarada?: string | null;
}

export interface CampaignExpense {
  id_gasto: number;
  id_campana: number;
  importe: number;
  fecha: string;
  descripcion: string;
}

export interface CampaignItem {
  id_campana: number;
  nombre: string;
  descripcion?: string | null;
  canal: string;
  fuente: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  activo: boolean;
  totalGasto: number;
  totalOportunidades: number;
  costoPorContacto: number;
  gastos: CampaignExpense[];
}

export interface AIDecisionItem {
  id_decision: number;
  agente: string;
  etapa: string;
  fecha_hora: string;
  accion?: string | null;
  decision: string;
  justificacion?: string | null;
  metodo?: string;
  confianza?: number | null;
  requiere_revision_humana?: boolean;
  regla_aplicada?: string | null;
  Persona?: {
    id_persona: number;
    nombres: string;
    apellidos: string;
    numero: string;
    email?: string | null;
  };
  Oportunidad?: {
    id_oportunidad: number;
    estado_oportunidad: string;
    fecha_registro: string;
    necesidad_declarada?: string | null;
  };
}

export interface AgentStatsData {
  totalProcessed: number;
  llmExecuted: number;
  rulesFallback: number;
  requiresHumanReview: number;
  actionDistribution: Record<string, number>;
  healthStatus: string;
  providerActive: string;
}

export interface BuyerOperationalKpis {
  totalRegistros: number;
  registradosSinConvertir: number;
  convertidosLead: number;
  tasaConversionDirecta: number;
  contactosUtilizables: number;
  tasaUtilizables: number;
  alertasActivas: number;
  alertasSla: number;
  alertasNoContacto: number;
}

export interface BuyerMartKpiData {
  period: string;
  total_registrados: number;
  total_utilizables: number;
  total_conversiones: number;
  conv_14d: number;
  b1_tasa_conversion_14d: number;
  b2_tasa_contactos_utilizables: number;
  b3_costo_por_lead_cpl: number;
  total_costo: number;
  avg_tiempo_dias: number;
  benchmark_b1_objetivo: number;
  benchmark_b2_objetivo: number;
  benchmark_b3_objetivo: number;
}
