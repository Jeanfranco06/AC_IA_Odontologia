import type { ExecutiveReportData } from '../routes/report.routes';

export interface DurationRow {
  categoria: string;
  item: string;
  columna: string;
  suma_dias: number | null;
  cantidad: number;
}
interface Bucket { days: number; count: number }
const empty = (): Bucket => ({ days: 0, count: 0 });
const add = (target: Bucket, source: Bucket): void => {
  target.days += source.days;
  target.count += source.count;
};
// Conservar precision hasta presentar el resultado; cero dias puede ser real.
const average = (bucket: Bucket): number | null => bucket.count > 0 ? bucket.days / bucket.count : null;

/** Promedio de conversiones desde suma y cantidad en TODOS los niveles. */
export function buildBuyerDurationMatrix(
  rows: DurationRow[],
  range: { key: string; label: string }
): ExecutiveReportData {
  const preferred = ['Sede Centro Historico', 'Sede California'];
  const columns = [...new Set(rows.map(row => row.columna))].sort((a, b) => {
    const ai = preferred.indexOf(a), bi = preferred.indexOf(b);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? preferred.length : ai) - (bi < 0 ? preferred.length : bi);
    return a.localeCompare(b);
  });
  const groups = new Map<string, Map<string, Map<string, Bucket>>>();
  for (const row of rows) {
    let category = groups.get(row.categoria);
    if (!category) { category = new Map(); groups.set(row.categoria, category); }
    let item = category.get(row.item);
    if (!item) { item = new Map(); category.set(row.item, item); }
    const cell = item.get(row.columna) ?? empty();
    add(cell, { days: Number(row.suma_dias ?? 0), count: Number(row.cantidad) });
    item.set(row.columna, cell);
  }
  const grand = empty();
  const grandColumns = new Map(columns.map(column => [column, empty()]));
  const categories: ExecutiveReportData['categories'] = [];
  for (const [categoryName, group] of groups) {
    const subtotal = empty();
    const subtotalColumns = new Map(columns.map(column => [column, empty()]));
    const items = [];
    for (const [itemName, cells] of group) {
      const total = empty();
      const values: Record<string, number | null> = {};
      for (const column of columns) {
        const cell = cells.get(column) ?? empty();
        values[column] = average(cell);
        add(total, cell);
        add(subtotalColumns.get(column)!, cell);
        add(grandColumns.get(column)!, cell);
      }
      items.push({ itemName, values, total: average(total) });
      add(subtotal, total);
    }
    categories.push({ categoryName, items,
      subtotals: Object.fromEntries(columns.map(column => [column, average(subtotalColumns.get(column)!)])),
      subtotalTotal: average(subtotal), subtotalLabel: `Subtotal ${categoryName}` });
    add(grand, subtotal);
  }
  return {
    stage: 'BUYER', reportTitle: 'Tiempo promedio de conversión a LEAD',
    metric: 'tiempo_conversion_dia', period: range.label, periodKey: range.key,
    rowHeader: 'Fuente de Atracción / Canal', superHeader: 'Sede Física', columns,
    totalColumnName: 'Promedio (días)', categories,
    grandTotals: Object.fromEntries(columns.map(column => [column, average(grandColumns.get(column)!)])),
    grandTotal: average(grand), grandTotalLabel: 'Promedio general', isCurrency: false,
    generatedAt: new Date().toISOString(), comparison: null,
    sourceMart: 'NexoSalud_Mart.fact_captacion_buyer',
  };
}
