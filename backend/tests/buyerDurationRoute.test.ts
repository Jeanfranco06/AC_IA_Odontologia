// @vitest-environment node
import { expect, test, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/mart', () => ({ queryMart: query }));
import router from '../src/routes/report.routes';

test('API Buyer aplica filtro, promedio ponderado, NULL y comparacion al periodo anterior', async () => {
  query.mockImplementation(async (_sql: string, params: { fromKey: number }) =>
    params.fromKey === 20251101 ? [
      { categoria: 'Redes', item: 'WhatsApp', columna: 'Centro', suma_dias: 90, cantidad: 9 },
      { categoria: 'Redes', item: 'WhatsApp', columna: 'California', suma_dias: 2, cantidad: 1 },
      { categoria: 'Redes', item: 'WhatsApp', columna: 'No especificada', suma_dias: null, cantidad: 0 },
    ] : [{ categoria: 'Redes', item: 'WhatsApp', columna: 'Centro', suma_dias: 6, cantidad: 2 }]);
  const app = express();
  app.use('/api/reports', router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const port = (server.address() as AddressInfo).port;
    for (const measure of ['tiempo_conversion_dia', 'tiempo_conversion']) {
      const response = await fetch(`http://127.0.0.1:${port}/api/reports/executive/buyer?measure=${measure}&period=2025-11`);
      expect(response.status).toBe(200);
      const report = await response.json();
      expect(report.grandTotal).toBe(9.2);
      expect(report.categories[0].items[0].values['No especificada']).toBeNull();
      expect(report.comparison.grandTotal).toBe(3);
      expect(report.comparison.periodKey).toBe('2025-10');
    }
    expect(query.mock.calls.some(([, params]) => params.fromKey === 20251101 && params.toKey === 20251131)).toBe(true);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
