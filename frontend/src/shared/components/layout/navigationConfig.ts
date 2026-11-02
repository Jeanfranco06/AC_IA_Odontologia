import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  FileSpreadsheet,
  HeartHandshake,
  Layers,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';

export interface NavItemConfig {
  id: string;
  to: string;
  label: string;
  icon: LucideIcon;
  /** Ruta base para coincidencia activa */
  matchPath: string;
  /** Query param opcional `{ key, value }` para distinguir sub-vistas */
  matchQuery?: { key: string; value: string };
  /** Tipo de badge opcional (calculado en tiempo real o discreto) */
  badgeKey?: 'buyers_pending' | 'leads_pending' | 'payers_pending' | 'appointments_today';
  defaultBadgeText?: string;
}

export interface NavGroupConfig {
  id: string;
  label: string;
  items: NavItemConfig[];
}

export const SIDEBAR_NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'gestion-clinica',
    label: 'GESTIÓN CLÍNICA',
    items: [
      {
        id: 'clinica-pacientes',
        to: '/clinica/pacientes',
        label: 'Pacientes',
        icon: Users,
        matchPath: '/clinica/pacientes',
      },
      {
        id: 'clinica-citas',
        to: '/clinica/citas',
        label: 'Citas',
        icon: CalendarClock,
        matchPath: '/clinica/citas',
        badgeKey: 'appointments_today',
      },
      {
        id: 'clinica-odontogramas',
        to: '/clinica/odontogramas',
        label: 'Odontogramas',
        icon: ScanLine,
        matchPath: '/clinica/odontogramas',
      },
    ],
  },
  {
    id: 'embudo-admision',
    label: 'EMBUDO DE ADMISIÓN',
    items: [
      {
        id: 'funnel-buyer',
        to: '/buyer',
        label: 'Buyer',
        icon: UserPlus,
        matchPath: '/buyer',
        badgeKey: 'buyers_pending',
      },
      {
        id: 'funnel-lead',
        to: '/lead',
        label: 'Lead',
        icon: UserCheck,
        matchPath: '/lead',
        badgeKey: 'leads_pending',
      },
      {
        id: 'funnel-payer',
        to: '/payer',
        label: 'Payer',
        icon: CreditCard,
        matchPath: '/payer',
        badgeKey: 'payers_pending',
      },
      {
        id: 'funnel-customer',
        to: '/customer',
        label: 'Customer',
        icon: Stethoscope,
        matchPath: '/customer',
      },
      {
        id: 'funnel-turned',
        to: '/turned',
        label: 'Turned',
        icon: HeartHandshake,
        matchPath: '/turned',
      },
    ],
  },
  {
    id: 'analitica-bi',
    label: 'ANALÍTICA & BI',
    items: [
      {
        id: 'bi-ejecutivos',
        to: '/reportes',
        label: 'Reportes Ejecutivos',
        icon: FileSpreadsheet,
        matchPath: '/reportes',
      },
      {
        id: 'bi-cohortes',
        to: '/analitica/cohortes',
        label: 'Cohortes',
        icon: Layers,
        matchPath: '/analitica/cohortes',
      },
      {
        id: 'bi-rendimiento',
        to: '/analitica/rendimiento',
        label: 'Rendimiento',
        icon: TrendingUp,
        matchPath: '/analitica/rendimiento',
      },
    ],
  },
  {
    id: 'configuracion',
    label: 'CONFIGURACIÓN',
    items: [
      {
        id: 'cfg-sedes',
        to: '/configuracion?tab=sedes',
        label: 'Sedes',
        icon: Building2,
        matchPath: '/configuracion',
        matchQuery: { key: 'tab', value: 'sedes' },
      },
      {
        id: 'cfg-roles',
        to: '/configuracion?tab=usuarios',
        label: 'Roles y Permisos',
        icon: ShieldCheck,
        matchPath: '/configuracion',
        matchQuery: { key: 'tab', value: 'usuarios' },
      },
      {
        id: 'cfg-parametros',
        to: '/configuracion?tab=empresa',
        label: 'Parámetros Clínicos',
        icon: SlidersHorizontal,
        matchPath: '/configuracion',
        matchQuery: { key: 'tab', value: 'empresa' },
      },
    ],
  },
];

export interface BreadcrumbSegment {
  label: string;
  to?: string;
}

/**
 * Resuelve el breadcrumb contextual de 2 o 3 niveles según la ruta activa y sus query params.
 */
export function resolveBreadcrumbs(pathname: string, search: string): BreadcrumbSegment[] {
  const params = new URLSearchParams(search);

  if (pathname.startsWith('/clinica/pacientes')) {
    return [
      { label: 'Gestión Clínica', to: '/clinica/pacientes' },
      { label: 'Directorio Maestro de Pacientes 360°' },
    ];
  }

  if (pathname.startsWith('/clinica/citas')) {
    return [
      { label: 'Gestión Clínica', to: '/clinica/pacientes' },
      { label: 'Agenda Clínica y Sillones Odontológicos' },
    ];
  }

  if (pathname.startsWith('/clinica/odontogramas')) {
    return [
      { label: 'Gestión Clínica', to: '/clinica/pacientes' },
      { label: 'Odontograma Digital FDI y Evolución Clínica' },
    ];
  }

  if (pathname.startsWith('/analitica/cohortes')) {
    return [
      { label: 'Analítica & BI', to: '/reportes' },
      { label: 'Análisis de Cohortes y Conversión del Embudo' },
    ];
  }

  if (pathname.startsWith('/analitica/rendimiento')) {
    return [
      { label: 'Analítica & BI', to: '/reportes' },
      { label: 'Rendimiento Clínico y Productividad Médica' },
    ];
  }

  if (pathname.startsWith('/reportes')) {
    const tab = params.get('tab') || 'buyer';
    const tabLabels: Record<string, string> = {
      all: 'Reportes Ejecutivos Matriciales',
      buyer: 'Reportes Ejecutivos Matriciales · Buyer',
      lead: 'Reportes Ejecutivos Matriciales · Lead',
      payer: 'Reportes Ejecutivos Matriciales · Payer',
      customer: 'Reportes Ejecutivos Matriciales · Customer',
      turned: 'Reportes Ejecutivos Matriciales · Turned',
    };
    return [
      { label: 'Analítica & BI', to: '/reportes' },
      { label: tabLabels[tab] || 'Reportes Ejecutivos Matriciales' },
    ];
  }

  if (pathname.startsWith('/buyer')) {
    if (pathname === '/buyer/new' || pathname === '/buyer/nuevo') {
      return [
        { label: 'Embudo de Admisión', to: '/buyer' },
        { label: 'Buyer', to: '/buyer' },
        { label: 'Nuevo Prospecto' },
      ];
    }
    if (pathname !== '/buyer') {
      return [
        { label: 'Embudo de Admisión', to: '/buyer' },
        { label: 'Buyer', to: '/buyer' },
        { label: 'Ficha de Prospecto' },
      ];
    }
    return [
      { label: 'Embudo de Admisión', to: '/buyer' },
      { label: 'Buyer · Captación de Pacientes' },
    ];
  }

  if (pathname.startsWith('/lead')) {
    if (pathname.includes('/negotiation')) {
      return [
        { label: 'Embudo de Admisión', to: '/lead' },
        { label: 'Lead', to: '/lead' },
        { label: 'Mesa de Negociación' },
      ];
    }
    if (pathname !== '/lead') {
      return [
        { label: 'Embudo de Admisión', to: '/lead' },
        { label: 'Lead', to: '/lead' },
        { label: 'Detalle de Oportunidad' },
      ];
    }
    return [
      { label: 'Embudo de Admisión', to: '/lead' },
      { label: 'Lead · Negociación y Agenda' },
    ];
  }

  if (pathname.startsWith('/payer')) {
    if (pathname !== '/payer') {
      return [
        { label: 'Embudo de Admisión', to: '/payer' },
        { label: 'Payer', to: '/payer' },
        { label: 'Validación de Comprobante' },
      ];
    }
    return [
      { label: 'Embudo de Admisión', to: '/payer' },
      { label: 'Payer · Cobros y Validación' },
    ];
  }

  if (pathname.startsWith('/customer')) {
    if (pathname !== '/customer') {
      return [
        { label: 'Embudo de Admisión', to: '/customer' },
        { label: 'Customer', to: '/customer' },
        { label: 'Atención en Sillón e Historia Clínica' },
      ];
    }
    return [
      { label: 'Embudo de Admisión', to: '/customer' },
      { label: 'Customer · Atención Clínica Activa' },
    ];
  }

  if (pathname.startsWith('/turned')) {
    if (pathname !== '/turned') {
      return [
        { label: 'Embudo de Admisión', to: '/turned' },
        { label: 'Turned', to: '/turned' },
        { label: 'Seguimiento de Fidelización' },
      ];
    }
    return [
      { label: 'Embudo de Admisión', to: '/turned' },
      { label: 'Turned · Fidelización y Retorno' },
    ];
  }

  if (pathname.startsWith('/configuracion')) {
    const tab = params.get('tab') || 'empresa';
    const tabMap: Record<string, string> = {
      empresa: 'Parámetros Institucionales',
      servicios: 'Catálogo de Tratamientos y Tarifas',
      sedes: 'Sedes e Infraestructura Física',
      profesionales: 'Staff Odontológico y RNE',
      canales: 'Canales y Fuentes de Captación',
      usuarios: 'Roles, Usuarios y Permisos',
    };
    return [
      { label: 'Configuración', to: '/configuracion?tab=empresa' },
      { label: tabMap[tab] || 'Parámetros del Sistema' },
    ];
  }

  return [
    { label: 'NexoSalud', to: '/clinica/pacientes' },
    { label: 'Panel Operativo' },
  ];
}

export interface QuickCommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Navegación Clínica' | 'Embudo de Admisión' | 'Analítica & BI' | 'Configuración';
  to: string;
  icon: LucideIcon;
  keywords: string;
}

export const STATIC_COMMAND_ITEMS: QuickCommandItem[] = [
  {
    id: 'cmd-pacientes',
    title: 'Directorio Maestro de Pacientes 360°',
    subtitle: 'Gestión Clínica · Historias clínicas y trazabilidad integral',
    category: 'Navegación Clínica',
    to: '/clinica/pacientes',
    icon: Users,
    keywords: 'pacientes historia clinica expediente directorio 360',
  },
  {
    id: 'cmd-citas',
    title: 'Agenda de Citas y Sillones Odontológicos',
    subtitle: 'Gestión Clínica · Programación de turnos y disponibilidad de sillones',
    category: 'Navegación Clínica',
    to: '/clinica/citas',
    icon: CalendarClock,
    keywords: 'citas agenda turnos horarios calendario sillones',
  },
  {
    id: 'cmd-odontogramas',
    title: 'Odontograma Digital FDI y Box Clínico',
    subtitle: 'Gestión Clínica · Registro interactivo de 32 piezas y evolución',
    category: 'Navegación Clínica',
    to: '/clinica/odontogramas',
    icon: ScanLine,
    keywords: 'odontograma dientes fdi box copilot clinico piezas',
  },
  {
    id: 'cmd-buyer',
    title: 'Módulo Buyer — Captación de Prospectos',
    subtitle: 'Embudo de Admisión · Solicitudes web y WhatsApp',
    category: 'Embudo de Admisión',
    to: '/buyer',
    icon: UserPlus,
    keywords: 'buyer prospectos captacion interesados',
  },
  {
    id: 'cmd-lead',
    title: 'Módulo Lead — Mesa de Negociación',
    subtitle: 'Embudo de Admisión · Propuestas y agendamiento',
    category: 'Embudo de Admisión',
    to: '/lead',
    icon: UserCheck,
    keywords: 'lead negociacion propuesta agenda',
  },
  {
    id: 'cmd-payer',
    title: 'Módulo Payer — Cobros y Validación',
    subtitle: 'Embudo de Admisión · Órdenes de pago y comprobantes',
    category: 'Embudo de Admisión',
    to: '/payer',
    icon: CreditCard,
    keywords: 'payer pagos cobros recibos facturacion',
  },
  {
    id: 'cmd-customer',
    title: 'Módulo Customer — Atención en Sillón',
    subtitle: 'Embudo de Admisión · Ejecución de tratamientos y alta clínica',
    category: 'Embudo de Admisión',
    to: '/customer',
    icon: Stethoscope,
    keywords: 'customer atencion sillon tratamiento ejecucion',
  },
  {
    id: 'cmd-turned',
    title: 'Módulo Turned — Fidelización y Controles',
    subtitle: 'Embudo de Admisión · Retorno, NPS y referidos',
    category: 'Embudo de Admisión',
    to: '/turned',
    icon: HeartHandshake,
    keywords: 'turned fidelizacion postventa controles',
  },
  {
    id: 'cmd-reportes-all',
    title: 'Reportes Ejecutivos Matriciales',
    subtitle: 'Analítica & BI · Consolidado multidimensional del embudo',
    category: 'Analítica & BI',
    to: '/reportes',
    icon: BarChart3,
    keywords: 'reportes bi matriz ejecutiva kpi datamart',
  },
  {
    id: 'cmd-reportes-cohortes',
    title: 'Análisis de Cohortes y Retención Longitudinal',
    subtitle: 'Analítica & BI · Cascada de conversión Buyer → Turned por canal',
    category: 'Analítica & BI',
    to: '/analitica/cohortes',
    icon: Activity,
    keywords: 'cohortes canales sedes conversion embudo retencion',
  },
  {
    id: 'cmd-reportes-rendimiento',
    title: 'Rendimiento Clínico y Productividad Médica',
    subtitle: 'Analítica & BI · Ocupación de sillones, ticket promedio y especialistas',
    category: 'Analítica & BI',
    to: '/analitica/rendimiento',
    icon: TrendingUp,
    keywords: 'rendimiento productividad doctores especialistas ocupacion ingresos',
  },
  {
    id: 'cmd-cfg-sedes',
    title: 'Configuración de Sedes Clínicas',
    subtitle: 'Configuración · California, El Golf y Centro Histórico',
    category: 'Configuración',
    to: '/configuracion?tab=sedes',
    icon: Building2,
    keywords: 'sedes direccion california golf centro',
  },
  {
    id: 'cmd-cfg-roles',
    title: 'Roles, Usuarios y Permisos de Acceso',
    subtitle: 'Configuración · Operadores, doctores y administradores',
    category: 'Configuración',
    to: '/configuracion?tab=usuarios',
    icon: ShieldCheck,
    keywords: 'usuarios roles permisos seguridad staff',
  },
];
