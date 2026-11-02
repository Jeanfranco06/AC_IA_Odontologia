import type { ExecutiveReportData } from '../routes/report.routes';

export interface CampaignRow {
  KeyFuente: number;
  categoria: string;
  item: string;
  columna: string;
  inversion: number | null;
  leads: number;
}
// Importes acumulados como centimos enteros para evitar deriva binaria.
interface Bucket { inversion: number; leads: number; missing: boolean }
const empty = (): Bucket => ({ inversion: 0, leads: 0, missing: false });
function add(target: Bucket, value: Bucket): void {
  target.inversion += value.inversion;
  target.leads += value.leads;
  target.missing ||= value.missing;
}

/** Ratios se recalculan desde importes y LEADs en cada nivel, nunca se suman. */
export function buildBuyerCampaignMatrix(
  rows: CampaignRow[],
  measure: string,
  range: { key: string; label: string }
): ExecutiveReportData {
  const metric = ['costo_por_lead', 'cpl'].includes(measure) ? 'costo_por_lead'
    : ['conversion_lead', 'leads_generados'].includes(measure) ? 'conversion_lead' : 'monto_inversion';
  const value = (b: Bucket): number | null => {
    if (metric === 'conversion_lead') return b.leads;
    if (b.missing) return null;
    if (metric === 'monto_inversion') return b.inversion / 100;
    return b.leads > 0 ? Math.round(b.inversion / b.leads) / 100 : null;
  };
  const columns = [...new Set(rows.map(r => r.columna))].sort();
  const groups = new Map<string, Map<number, { name: string; cells: Map<string, Bucket> }>>();
  for (const row of rows) {
    let items = groups.get(row.categoria);
    if (!items) { items = new Map(); groups.set(row.categoria, items); }
    let item = items.get(row.KeyFuente);
    if (!item) { item = { name: row.item, cells: new Map() }; items.set(row.KeyFuente, item); }
    const cell = item.cells.get(row.columna) ?? empty();
    add(cell, { inversion: Math.round(Number(row.inversion ?? 0) * 100), leads: Number(row.leads), missing: row.inversion === null });
    item.cells.set(row.columna, cell);
  }
  const grand = empty();
  const grandColumns = new Map(columns.map(c => [c, empty()]));
  const categories: ExecutiveReportData['categories'] = [];
  for (const [categoryName, group] of groups) {
    const subtotal = empty();
    const subtotalColumns = new Map(columns.map(c => [c, empty()]));
    const items = [];
    for (const item of group.values()) {
      const total = empty();
      const values: Record<string, number | null> = {};
      for (const column of columns) {
        const cell = item.cells.get(column) ?? empty();
        values[column] = value(cell);
        add(total, cell);
        add(subtotalColumns.get(column)!, cell);
        add(grandColumns.get(column)!, cell);
      }
      items.push({ itemName: item.name, values, total: value(total) });
      add(subtotal, total);
    }
    categories.push({ categoryName, items,
      subtotals: Object.fromEntries(columns.map(c => [c, value(subtotalColumns.get(c)!)])),
      subtotalTotal: value(subtotal), subtotalLabel: `Subtotal ${categoryName}` });
    add(grand, subtotal);
  }
  return {
    stage: 'BUYER', reportTitle: 'Inversión registrada y CPL de campaña',
    metric, period: range.label, periodKey: range.key,
    rowHeader: 'Tipo de origen / Campaña', superHeader: 'Canal', columns,
    totalColumnName: metric === 'costo_por_lead' ? 'CPL (S/ por LEAD)' : metric === 'monto_inversion' ? 'Total (S/)' : 'Total LEADs',
    categories, grandTotals: Object.fromEntries(columns.map(c => [c, value(grandColumns.get(c)!)])),
    grandTotal: rows.length ? value(grand) : (metric === 'conversion_lead' ? 0 : null),
    grandTotalLabel: 'Total general', isCurrency: metric !== 'conversion_lead',
    generatedAt: new Date().toISOString(), comparison: null,
    sourceMart: 'fact_inversion_campana_buyer + fact_captacion_buyer',
  };
}
