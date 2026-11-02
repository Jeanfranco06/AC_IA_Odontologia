import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildBuyerCampaignMatrix, type CampaignRow } from '../src/services/buyerCampaignMatrix';
const range = { key: 'all', label: 'Histórico completo' };
const row = (key: number, inversion: number | null, leads: number, columna = 'WhatsApp'): CampaignRow =>
  ({ KeyFuente: key, categoria: 'Marketing', item: `Campaña ${key}`, columna, inversion, leads });
test('CPL total y subtotales son cocientes de sumas; incluyen gasto sin LEADs', () => {
  const r = buildBuyerCampaignMatrix([row(1, 1600, 251), row(2, 850, 60, 'Instagram'), row(3, 450, 0), row(4, 200, 0), row(5, 150, 0)], 'cpl', range);
  assert.equal(r.grandTotal, 10.45);
  assert.equal(r.categories[0].subtotalTotal, 10.45);
  assert.equal(r.grandTotals.WhatsApp, 9.56);
  assert.equal(r.categories[0].items[2].total, null);
});
test('ausencia de evidencia monetaria no se convierte en cero', () => {
  const r = buildBuyerCampaignMatrix([row(1, 100, 10), row(2, null, 5)], 'cpl', range);
  assert.equal(r.categories[0].items[1].total, null);
  assert.equal(r.grandTotal, null);
});
test('costo cero explicito con LEADs es calculable; sin LEADs es null', () => {
  assert.equal(buildBuyerCampaignMatrix([row(1, 0, 2)], 'cpl', range).grandTotal, 0);
  assert.equal(buildBuyerCampaignMatrix([row(1, 100, 0)], 'cpl', range).grandTotal, null);
  assert.equal(buildBuyerCampaignMatrix([], 'cpl', range).grandTotal, null);
});
test('inversion y conteos suman; desconocidos se conservan', () => {
  const rows = [row(0, 100.01, 0), row(1, 0, 2)];
  assert.equal(buildBuyerCampaignMatrix(rows, 'monto_inversion', range).grandTotal, 100.01);
  assert.equal(buildBuyerCampaignMatrix(rows, 'leads_generados', range).grandTotal, 2);
});

test('los importes se acumulan al centimo', () => {
  assert.equal(buildBuyerCampaignMatrix([row(1, 0.10, 1), row(2, 0.20, 1)], 'monto_inversion', range).grandTotal, 0.30);
});
