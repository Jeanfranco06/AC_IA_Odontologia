// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/mart', () => ({ queryMart: query }));
beforeEach(() => { vi.resetModules(); query.mockReset(); });
test('captacion e inversion usan una sola transaccion y solicitudes simultaneas comparten carga', async () => {
  let finish!: (value: unknown[]) => void;
  query.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { MartSyncService } = await import('../src/services/martSyncService');
  const a = MartSyncService.syncBuyer();
  const b = MartSyncService.syncBuyer();
  expect(a).toBe(b);
  expect(query).toHaveBeenCalledTimes(1);
  const sql = query.mock.calls[0][0];
  expect(sql).toContain('BEGIN TRANSACTION');
  expect(sql).toContain('usp_SincronizarCaptacionBuyer');
  expect(sql).toContain('usp_SincronizarInversionCampanaBuyer');
  expect(sql).toContain('ROLLBACK TRANSACTION');
  finish([]);
  await a;
  await MartSyncService.syncAll();
  expect(query).toHaveBeenCalledTimes(1);
});
test('un fallo se propaga y permite reintento sin marcar exito', async () => {
  query.mockRejectedValueOnce(new Error('Fallo controlado')).mockResolvedValueOnce([]);
  const { MartSyncService } = await import('../src/services/martSyncService');
  await expect(MartSyncService.syncBuyer()).rejects.toThrow('Fallo controlado');
  await MartSyncService.syncAll();
  expect(query).toHaveBeenCalledTimes(2);
});
