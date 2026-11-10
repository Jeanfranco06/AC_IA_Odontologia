import { once } from 'node:events';
import { type AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';

const { tx, db } = vi.hoisted(() => {
  const tx = {
    solicitudes: { findUnique: vi.fn(), update: vi.fn() },
    propuestasEconomicasLead: { findFirst: vi.fn(), create: vi.fn() },
    opciones: { findFirst: vi.fn(), update: vi.fn() },
    motivosRechazoLead: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
  };
  return { tx, db: { $transaction: vi.fn(), $queryRaw: vi.fn() } };
});
vi.mock('../src/db', () => ({ prisma: db }));

import { leadCommercialRouter } from '../src/routes/leadCommercial.routes';

const app = express();
app.use(express.json());
app.use('/commercial', leadCommercialRouter);
let server: ReturnType<typeof app.listen>;
let url: string;

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/commercial';
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async action => action(tx));
  tx.solicitudes.findUnique.mockResolvedValue({ id_solicitud: 12, id_servicio: 5 });
  tx.$queryRaw.mockResolvedValue([{ ingreso: new Date() }]);
});

function post(path: string, body: unknown) {
  return fetch(url + path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('L1 exige una confirmación expresa y usa el precio de la propuesta vigente', async () => {
  const path = '/opportunities/12/outcome';
  const denied = await post(path, { resultado: 'ACEPTADA', id_propuesta: 7, id_reserva: 1 });
  expect(denied.status).toBe(400);
  expect(tx.solicitudes.update).not.toHaveBeenCalled();

  const proposal = { id_propuesta: 7, id_solicitud: 12, estado: 'Aceptada', precio_cotizado: '150.00' };
  tx.propuestasEconomicasLead.findFirst.mockResolvedValue(proposal);
  tx.solicitudes.update.mockResolvedValue({ id_solicitud: 12 });
  const accepted = await post(path, { resultado: 'ACEPTADA', id_propuesta: 7, aceptacion_expresa: true, valor_acordado: 999 });
  expect(accepted.status).toBe(200);
  expect(tx.solicitudes.update).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ valor_acordado_lead: '150.00', id_propuesta_aceptada_lead: 7 }),
  }));
});

test('L2 agrega una versión a la raíz y rechaza una versión anterior obsoleta', async () => {
  const path = '/opportunities/12/proposals';
  const prior = { id_propuesta: 9, id_propuesta_raiz: 7, numero_version: 2 };
  tx.propuestasEconomicasLead.findFirst.mockResolvedValue(prior);
  tx.propuestasEconomicasLead.create.mockResolvedValue({ id_propuesta: 10 });
  const revised = await post(path, { id_version_anterior: 9, precio_cotizado: '120.50' });
  expect(revised.status).toBe(201);
  expect(tx.propuestasEconomicasLead.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ id_propuesta_raiz: 7, numero_version: 3 }),
  }));

  tx.propuestasEconomicasLead.findFirst.mockResolvedValueOnce(prior).mockResolvedValueOnce({ id_propuesta: 10 });
  const stale = await post(path, { id_version_anterior: 9, precio_cotizado: '130.00' });
  expect(stale.status).toBe(409);
  expect(tx.propuestasEconomicasLead.create).toHaveBeenCalledTimes(1);
});

test('L3 exige un motivo válido de ALTERNATIVA para registrar un rechazo', async () => {
  const path = '/opportunities/12/alternatives/8/decision';
  tx.opciones.findFirst.mockResolvedValue({ id_opcion: 8 });
  tx.motivosRechazoLead.findFirst.mockResolvedValue(null);
  expect((await post(path, { estado: 'Rechazada', id_motivo_rechazo_lead: 2 })).status).toBe(400);
  expect(tx.opciones.update).not.toHaveBeenCalled();

  tx.motivosRechazoLead.findFirst.mockResolvedValue({ id_motivo_rechazo: 3 });
  tx.opciones.update.mockResolvedValue({ id_opcion: 8 });
  expect((await post(path, { estado: 'Rechazada', id_motivo_rechazo_lead: 3 })).status).toBe(200);
  expect(tx.motivosRechazoLead.findFirst).toHaveBeenLastCalledWith({
    where: { id_motivo_rechazo: 3, ambito: 'ALTERNATIVA', activo: true },
  });
});

test('los reportes rechazan fechas inválidas sin consultar la base', async () => {
  const result = await fetch(url + '/reports/R1?inicio=2026-02-31&fin_exclusivo=2026-03-01');
  expect(result.status).toBe(400);
  expect(db.$queryRaw).not.toHaveBeenCalled();
});
