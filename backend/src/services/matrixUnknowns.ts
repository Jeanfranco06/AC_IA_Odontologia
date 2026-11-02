import type { ExecutiveReportData } from '../routes/report.routes';

/** Restituye costos desconocidos sin convertirlos en ceros ni totales parciales. */
export function preserveUnknownCosts(
  report: ExecutiveReportData,
  rows: Array<{ categoria: string; item: string; columna: string; valor: number | null }>
): ExecutiveReportData {
  const unknown = new Set(rows.filter(r => r.valor === null)
    .map(r => JSON.stringify([r.categoria, r.item, r.columna])));
  for (const category of report.categories) {
    for (const item of category.items) {
      for (const column of report.columns) {
        if (unknown.has(JSON.stringify([category.categoryName, item.itemName, column]))) {
          item.values[column] = null;
          item.total = null;
        }
      }
    }
    for (const column of report.columns) {
      if (category.items.some(item => item.values[column] === null)) category.subtotals[column] = null;
    }
    if (category.items.some(item => item.total === null)) category.subtotalTotal = null;
  }
  for (const column of report.columns) {
    if (report.categories.some(category => category.subtotals[column] === null)) report.grandTotals[column] = null;
  }
  if (!rows.length || report.categories.some(category => category.subtotalTotal === null)) report.grandTotal = null;
  return report;
}
