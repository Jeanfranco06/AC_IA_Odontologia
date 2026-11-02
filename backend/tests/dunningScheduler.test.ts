// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('../src/db', () => ({ prisma: { reservas: { findMany } } }));
vi.mock('../src/routes/payer.routes', () => ({ sendPaymentNoticeOrConfirmation: vi.fn(), generateBackendPdfBase64: vi.fn() }));
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  findMany.mockReset().mockResolvedValue([]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
test('desactivar cobranza impide la consulta inicial y el temporizador', async () => {
  vi.stubEnv('DUNNING_ENABLED', 'false');
  const { startDunningScheduler } = await import('../src/services/dunningScheduler');
  startDunningScheduler();
  expect(findMany).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
test('sin configurar el flag conserva la ejecucion anterior', async () => {
  vi.stubEnv('DUNNING_ENABLED', undefined);
  const { startDunningScheduler } = await import('../src/services/dunningScheduler');
  startDunningScheduler();
  expect(findMany).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(1);
});
