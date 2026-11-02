import type { ExecutiveReportData } from '@/shared/services/report.service';
import type { MeasureOption } from '../config/stages';

const LOCALE = 'es-PE';

const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const moneyFmt = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Formatea un valor según la unidad de la medida (sin símbolo de moneda). */
export function formatNumber(value: number | null, unit: MeasureOption['unit']): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (unit === 'pen') return moneyFmt.format(value);
  if (unit === 'dias' || unit === 'min') return decFmt.format(value);
  return intFmt.format(value);
}

/** Valor con prefijo/sufijo de unidad, para KPIs. */
export function formatWithUnit(value: number | null, unit: MeasureOption['unit']): string {
  if (value === null) return '—';
  const n = formatNumber(value, unit);
  if (unit === 'pen') return `S/ ${n}`;
  if (unit === 'dias') return `${n} d`;
  if (unit === 'min') return `${n} min`;
  return n;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${pctFmt.format(value)} %`;
}

/** Elimina marcadores de formato crudo ("** Totales **") heredados del backend. */
export function cleanLabel(label: string): string {
  return label.replace(/\*+/g, '').replace(/\s{2,}/g, ' ').trim();
}

/** Traducción de valores de dimensión técnicos a lenguaje de negocio. */
const COLUMN_LABELS: Record<string, string> = {
  VALIDATED: 'Validado',
  VALIDADO: 'Validado',
  PENDING: 'Pendiente',
  PENDIENTE: 'Pendiente',
  REJECTED: 'Rechazado',
  RECHAZADO: 'Rechazado',
  IN_REVIEW: 'En revisión',
  EN_REVISION: 'En revisión',
  REVERTED: 'Revertido',
  REVERTIDO: 'Revertido',
  CANCELLED: 'Anulado',
  CANCELADO: 'Cancelado',
  REFUNDED: 'Reembolsado',
  REEMBOLSADO: 'Reembolsado',
};

export function columnLabel(column: string): string {
  return COLUMN_LABELS[column.toUpperCase()] ?? column;
}

export interface Delta {
  /** Variación porcentual vs período anterior; null si no hay base comparable. */
  pct: number | null;
  direction: 'up' | 'down' | 'flat';
  label: string;
}

export function computeDelta(report: ExecutiveReportData): Delta | null {
  const cmp = report.comparison;
  if (!cmp || cmp.grandTotal === null || report.grandTotal === null) return null;
  if (cmp.grandTotal === 0) {
    return report.grandTotal === 0
      ? { pct: 0, direction: 'flat', label: cmp.period }
      : { pct: null, direction: 'up', label: cmp.period };
  }
  const pct = ((report.grandTotal - cmp.grandTotal) / Math.abs(cmp.grandTotal)) * 100;
  const direction = Math.abs(pct) < 0.05 ? 'flat' : pct > 0 ? 'up' : 'down';
  return { pct, direction, label: cmp.period };
}

const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

/** "hace 12 min", "hace un momento", "hace 2 h". */
export function relativeTime(fromMs: number, nowMs: number = Date.now()): string {
  const diffSec = Math.round((fromMs - nowMs) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return 'hace un momento';
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
