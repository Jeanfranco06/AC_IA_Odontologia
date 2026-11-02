import type { ExecutiveReportData } from '@/shared/services/report.service';
import { cleanLabel } from './format';

export type MatrixRow =
  | { kind: 'category'; key: string; label: string; itemCount: number }
  | { kind: 'item'; key: string; category: string; label: string; values: Record<string, number | null>; total: number | null }
  | { kind: 'subtotal'; key: string; category: string; label: string; values: Record<string, number | null>; total: number | null }
  | { kind: 'total'; key: string; label: string; values: Record<string, number | null>; total: number | null };

export type DisplayMode = 'absolute' | 'percent';

/**
 * Aplana la matriz jerárquica a filas tipadas. El filtro de búsqueda conserva
 * una categoría si coincide su nombre o cualquiera de sus ítems.
 */
export function buildMatrixRows(report: ExecutiveReportData, query = ''): MatrixRow[] {
  const q = normalize(query);
  const rows: MatrixRow[] = [];

  for (const cat of report.categories) {
    const catMatches = q === '' || normalize(cat.categoryName).includes(q);
    const items = catMatches ? cat.items : cat.items.filter((it) => normalize(it.itemName).includes(q));
    if (items.length === 0) continue;

    rows.push({ kind: 'category', key: `c:${cat.categoryName}`, label: cat.categoryName, itemCount: items.length });
    for (const it of items) {
      rows.push({
        kind: 'item',
        key: `i:${cat.categoryName}:${it.itemName}`,
        category: cat.categoryName,
        label: it.itemName,
        values: it.values,
        total: it.total,
      });
    }
    rows.push({
      kind: 'subtotal',
      key: `s:${cat.categoryName}`,
      category: cat.categoryName,
      label: cleanLabel(cat.subtotalLabel) || `Subtotal ${cat.categoryName}`,
      values: cat.subtotals,
      total: cat.subtotalTotal,
    });
  }

  return rows;
}

export function grandTotalRow(report: ExecutiveReportData): Extract<MatrixRow, { kind: 'total' }> {
  return {
    kind: 'total',
    key: 'grand-total',
    label: cleanLabel(report.grandTotalLabel) || 'Total general',
    values: report.grandTotals,
    total: report.grandTotal,
  };
}

/** Participación sobre el total general, en %. */
export function toPercent(value: number | null, report: ExecutiveReportData): number {
  return value === null || report.grandTotal === null || report.grandTotal === 0 ? 0 : (value / report.grandTotal) * 100;
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
