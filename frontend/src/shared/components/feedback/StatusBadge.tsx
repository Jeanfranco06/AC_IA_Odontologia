type StatusVariant = 'success' | 'warning' | 'error' | 'neutral' | 'primary' | 'purple';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
}

const statusDictionary: Record<string, { label: string; defaultVariant: StatusVariant }> = {
  // ── 1. BUYER (Captación) ─────────────────────────────────
  NEW: { label: 'Nuevo', defaultVariant: 'warning' },
  CONTACTED: { label: 'Contactado', defaultVariant: 'primary' },
  CONVERTED: { label: 'Convertido a LEAD', defaultVariant: 'success' },
  DISCARDED: { label: 'Descartado', defaultVariant: 'error' },
  DUPLICATED: { label: 'Duplicado', defaultVariant: 'purple' },

  // ── 2. LEAD (Negociación) ────────────────────────────────
  IN_NEGOTIATION: { label: 'En Negociación', defaultVariant: 'warning' },
  ALTERNATIVE_SELECTED: { label: 'Alternativa Elegida', defaultVariant: 'primary' },
  PAYMENT_REQUESTED: { label: 'Convertido a PAYER', defaultVariant: 'success' },
  LOST: { label: 'Descartado', defaultVariant: 'error' },

  // ── 3. PAYER (Cobro y Validación) ───────────────────────
  PENDIENTE: { label: 'Pendiente de Pago', defaultVariant: 'warning' },
  EN_REVISION: { label: 'En Revisión', defaultVariant: 'primary' },
  VALIDADO: { label: 'Validado', defaultVariant: 'success' },
  RECHAZADO: { label: 'Rechazado', defaultVariant: 'error' },
  REVERTIDO: { label: 'Revertido', defaultVariant: 'error' },
  // Compatibilidad adicional
  PENDING: { label: 'Pendiente de Pago', defaultVariant: 'warning' },
  IN_REVIEW: { label: 'En Revisión', defaultVariant: 'primary' },
  VALIDATED: { label: 'Validado', defaultVariant: 'success' },
  REJECTED: { label: 'Rechazado', defaultVariant: 'error' },
  REVERTED: { label: 'Revertido', defaultVariant: 'error' },
  'Pendiente': { label: 'Pendiente de Pago', defaultVariant: 'warning' },
  'En Revisión': { label: 'En Revisión', defaultVariant: 'primary' },
  'En revisión': { label: 'En Revisión', defaultVariant: 'primary' },
  'Validado': { label: 'Validado', defaultVariant: 'success' },
  'Rechazado': { label: 'Rechazado', defaultVariant: 'error' },
  'Revertido': { label: 'Revertido', defaultVariant: 'error' },

  // ── 4. CUSTOMER (Atención Odontológica) ─────────────────
  SCHEDULED: { label: 'Programado', defaultVariant: 'warning' },
  CONFIRMED: { label: 'Asistencia Confirmada', defaultVariant: 'primary' },
  ATTENDANCE_CONFIRMED: { label: 'Asistencia Confirmada', defaultVariant: 'primary' },
  IN_PROGRESS: { label: 'En Atención', defaultVariant: 'warning' },
  IN_ATTENTION: { label: 'En Atención', defaultVariant: 'warning' },
  ATTENDED: { label: 'Atendido', defaultVariant: 'success' },
  NO_SHOW: { label: 'No Asistió', defaultVariant: 'error' },
  CANCELED: { label: 'Cancelado', defaultVariant: 'error' },

  // ── 5. TURNED (Postventa y Fidelización) ────────────────
  FOLLOW_UP_PENDING: { label: 'Seguimiento Pendiente', defaultVariant: 'error' },
  IN_FOLLOW_UP: { label: 'En Seguimiento', defaultVariant: 'warning' },
  CLOSED: { label: 'Cerrado', defaultVariant: 'success' },
  NEW_REQUEST: { label: 'Nueva Solicitud Creada', defaultVariant: 'purple' },
  LOYALTY_PROGRAM: { label: 'Programa de Fidelización', defaultVariant: 'purple' },
  DORMANT: { label: 'Inactivo', defaultVariant: 'neutral' },

  // ── Fases del Embudo ────────────────────────────────────
  BUYER: { label: 'Etapa BUYER', defaultVariant: 'primary' },
  LEAD: { label: 'Etapa LEAD', defaultVariant: 'primary' },
  PAYER: { label: 'Etapa PAYER', defaultVariant: 'primary' },
  CUSTOMER: { label: 'Etapa CUSTOMER', defaultVariant: 'primary' },
  TURNED: { label: 'Etapa TURNED', defaultVariant: 'primary' },
};

const variantStyles: Record<StatusVariant, { pill: string; dot: string }> = {
  success: {
    pill: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80',
    dot: 'bg-emerald-500'
  },
  warning: {
    pill: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80',
    dot: 'bg-amber-500'
  },
  error: {
    pill: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/80',
    dot: 'bg-rose-500'
  },
  purple: {
    pill: 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/80',
    dot: 'bg-purple-600 dark:bg-purple-400'
  },
  neutral: {
    pill: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700',
    dot: 'bg-slate-400 dark:bg-slate-500'
  },
  primary: {
    pill: 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200/80 dark:border-teal-800/80',
    dot: 'bg-teal-600 dark:bg-teal-400'
  },
};

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const match = status ? statusDictionary[status.trim()] : undefined;
  const displayLabel = match ? match.label : status;
  const effectiveVariant = variant || match?.defaultVariant || 'neutral';
  const current = variantStyles[effectiveVariant] || variantStyles.neutral;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${current.pill} transition-colors shadow-sm`}>
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      {displayLabel}
    </span>
  );
}
