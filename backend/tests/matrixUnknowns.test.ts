import { expect, test } from 'vitest';
import type { ExecutiveReportData } from '../src/routes/report.routes';
import { preserveUnknownCosts } from '../src/services/matrixUnknowns';
function fixture(): ExecutiveReportData {
  return {
    stage: 'BUYER', reportTitle: 'Costo', metric: 'costo_atribuido_captacion', period: 'Historico', periodKey: 'all',
    rowHeader: 'Fuente/canal', superHeader: 'Sede', columns: ['California','No especificada'], totalColumnName: 'Total',
    categories: [{categoryName: 'Redes', items: [
      {itemName: 'WhatsApp', values: {California: 50, 'No especificada': 0}, total: 50},
      {itemName: 'Instagram', values: {California: 0, 'No especificada': 0}, total: 0},
    ], subtotals: {California: 50, 'No especificada': 0}, subtotalTotal: 50, subtotalLabel: 'Subtotal'}],
    grandTotals: {California: 50, 'No especificada': 0}, grandTotal: 50, grandTotalLabel: 'Total', isCurrency: true,
    sourceMart: 'fact_captacion_buyer', generatedAt: '', comparison: null,
  };
}
test('costo desconocido permanece NULL en celda, fila, subtotal y total general', () => {
  const r=preserveUnknownCosts(fixture(), [{categoria:'Redes',item:'WhatsApp',columna:'No especificada',valor:null}]);
  expect(r.categories[0].items[0].values['No especificada']).toBeNull();
  expect(r.categories[0].items[0].total).toBeNull();
  expect(r.categories[0].subtotals['No especificada']).toBeNull();
  expect(r.categories[0].subtotalTotal).toBeNull();
  expect(r.grandTotal).toBeNull();
  expect(r.grandTotals.California).toBe(50);
});
test('cero explicitamente registrado se conserva y vacio no se informa como costo cero', () => {
  const r=preserveUnknownCosts(fixture(), [{categoria:'Redes',item:'Instagram',columna:'No especificada',valor:0}]);
  expect(r.categories[0].items[1].values['No especificada']).toBe(0);
  expect(r.grandTotal).toBe(50);
  expect(preserveUnknownCosts(fixture(), []).grandTotal).toBeNull();
});
