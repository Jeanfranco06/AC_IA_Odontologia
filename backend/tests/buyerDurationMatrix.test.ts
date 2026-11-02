import { test, expect } from 'vitest';
import { buildBuyerDurationMatrix, type DurationRow } from '../src/services/buyerDurationMatrix';
const range = { key: '2025-11', label: 'Noviembre 2025' };
const row = (item: string, columna: string, suma_dias: number | null, cantidad: number,
  categoria = 'Redes'): DurationRow => ({ categoria, item, columna, suma_dias, cantidad });

test('pondera filas, subtotales, columnas y total con cantidades desiguales', () => {
  const r = buildBuyerDurationMatrix([
    row('WhatsApp', 'California', 90, 9), row('WhatsApp', 'Centro', 2, 1),
    row('Instagram', 'Centro', 8, 2), row('Web', 'California', 12, 3, 'Organico'),
  ], range);
  expect(r.categories[0].items[0].total).toBe(9.2);
  expect(r.categories[0].subtotalTotal).toBeCloseTo(100 / 12);
  expect(r.categories[0].subtotals.Centro).toBeCloseTo(10 / 3);
  expect(r.grandTotals.California).toBe(8.5);
  expect(r.grandTotal).toBeCloseTo(112 / 15);
});

test('sin conversiones es NULL; cero dias observado es cero y participa en el promedio', () => {
  const r = buildBuyerDurationMatrix([
    row('WhatsApp', 'California', 0, 1), row('WhatsApp', 'Centro', null, 0),
    row('Web', 'Centro', null, 0, 'Organico'),
  ], range);
  expect(r.categories[0].items[0].values.Centro).toBeNull();
  expect(r.categories[1].items[0].values.California).toBeNull();
  expect(r.categories[1].subtotalTotal).toBeNull();
  expect(r.grandTotals.Centro).toBeNull();
  expect(r.grandTotal).toBe(0);
  expect(buildBuyerDurationMatrix([], range).grandTotal).toBeNull();
  expect(buildBuyerDurationMatrix([row('Web', 'Centro', null, 0)], range).grandTotal).toBeNull();
});

test('no redondea componentes antes de calcular el promedio', () => {
  const r = buildBuyerDurationMatrix([row('Web', 'Centro', 1.04, 1), row('Web', 'California', 1.05, 1)], range);
  expect(r.grandTotal).toBeCloseTo(1.045, 10);
});

test('regresion cohorte 10k: noviembre tiene 213 conversiones y promedio cercano a 7.02 dias', () => {
  const rows: DurationRow[] = [];
  let expectedDays = 0;
  let count = 0;
  for (let n = 1; n <= 10000; n++) {
    if ((n - 1) % 12 !== 1) continue;
    const converted = (n * 7919) % 10000 + 1 <= 2550;
    const days = converted ? Math.round((1 + n % 13 + (n % 60) / 1440) * 1e6) / 1e6 : null;
    rows.push(row(`Canal ${Math.floor(n / 12) % 5}`, `Sede ${Math.floor(n / 5) % 3}`,
      days, converted ? 1 : 0));
    if (days !== null) { expectedDays += days; count++; }
  }
  const r = buildBuyerDurationMatrix(rows, range);
  expect(count).toBe(213);
  expect(r.grandTotal).toBeCloseTo(expectedDays / count, 10);
  expect(r.grandTotal).toBeCloseTo(7.022594, 6);
});
