import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { prisma } from '../src/db';
import buyer from '../src/routes/buyer.routes';
import lead from '../src/routes/lead.routes';
import { MartSyncService } from '../src/services/martSyncService';

async function run() {
  const [target] = await prisma.$queryRaw<{ db: string }[]>`SELECT DB_NAME() AS db`;
  assert.equal(target.db, 'NexoSalud_LeadPruebas', 'Usar únicamente la copia LEAD');
  // Suppress the existing asynchronous Mart job while exercising OLTP routes.
  MartSyncService.syncBuyer = async () => undefined as never;
  const app = express();
  app.use(express.json());
  app.use('/buyer', buyer);
  app.use('/lead', lead);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    async function call(path: string, method: string, data: object, expected: number | number[], headers: Record<string, string> = {}) {
      const response = await fetch(base + path, {
        method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(data),
      });
      const result = await response.json();
      console.log(method, path, response.status);
      assert.ok((Array.isArray(expected) ? expected : [expected]).includes(response.status), String(result.error ?? result.message ?? ''));
      return { ...result, httpStatus: response.status };
    }

    const service = await prisma.servicios.findFirstOrThrow({ where: { activo: true } });
    const channel = await prisma.canales.findFirstOrThrow({ where: { activo: true } });
    const source = await prisma.fuentes.findFirstOrThrow({ where: { activo: true } });
    const email = 'qa-' + randomUUID() + '@example.invalid';
    const payload = { firstName: 'QA BUYER', lastName: 'Validación LEAD', email,
      id_canal_origen: channel.id_canal, id_fuente: source.id_fuente,
      id_servicio: service.id_servicio, contactAuthorization: true, concreteRequest: 'Consulta QA' };
    const registrations = await Promise.all([
      call('/buyer', 'POST', payload, [200, 201]),
      call('/buyer', 'POST', { ...payload, email: email.toUpperCase() }, [200, 201]),
    ]);
    assert.deepEqual(registrations.map(row => row.httpStatus).sort(), [200, 201]);
    const personId = registrations[0].id;
    assert.equal(registrations[1].id, personId);
    assert.equal(await prisma.personas.count({ where: { email } }), 1);
    const captures = await prisma.$queryRaw<{
      id_captacion: number; id_canal: number; id_fuente: number; id_servicio: number;
      autoriza_contacto: boolean; origen_datos: string;
    }[]>`SELECT id_captacion,id_canal,id_fuente,id_servicio,autoriza_contacto,origen_datos
      FROM dbo.CaptacionesBuyer WHERE id_persona=${personId}`;
    assert.equal(captures.length, 1);
    assert.deepEqual([captures[0].id_canal, captures[0].id_fuente, captures[0].id_servicio, captures[0].autoriza_contacto, captures[0].origen_datos],
      [channel.id_canal, source.id_fuente, service.id_servicio, true, 'REGISTRO_DIRECTO']);

    const priorSlot = await prisma.disponibilidad.findFirstOrThrow({
      where: { Profesional: { activo: true }, Sede: { activo: true } },
    });
    const slot = await prisma.disponibilidad.create({ data: {
      id_sede: priorSlot.id_sede, id_profesional: priorSlot.id_profesional,
      fecha: new Date(Date.now() + 7 * 86400000), hora_inicio: priorSlot.hora_inicio,
      hora_fin: priorSlot.hora_fin, estado: 'Disponible',
    } });
    await call('/buyer/' + personId, 'DELETE', {}, 409);
    const converted = await Promise.all([
      call('/buyer/' + personId + '/convert', 'POST', {}, 200),
      call('/buyer/' + personId + '/convert', 'POST', {}, 200),
    ]);
    const requestId = converted[0].id_solicitud;
    assert.equal(converted[1].id_solicitud, requestId);
    assert.deepEqual(converted.map(row => row.ya_convertido).sort(), [false, true]);
    const late = await call('/buyer', 'POST', payload, 200);
    assert.equal(late.id, personId);
    const [linked] = await prisma.$queryRaw<{ linked_count: number }[]>`
      SELECT COUNT(*) AS linked_count FROM dbo.EventosEtapa
      WHERE id_captacion=${captures[0].id_captacion} AND id_solicitud=${requestId}
    `;
    assert.equal(linked.linked_count, 1);

    const buyerStage = await prisma.etapas.findUniqueOrThrow({ where: { nombre: 'BUYER' } });
    const historical = await prisma.personas.create({
      data: { nombres: 'QA', apellidos: 'Sin evidencia', id_etapa_actual: buyerStage.id_etapa },
    });
    await call('/buyer/' + historical.id_persona + '/convert', 'POST', {}, 409);
    const noConsent = await call('/buyer', 'POST', {
      ...payload, email: 'qa-' + randomUUID() + '@example.invalid', contactAuthorization: false,
    }, 201);
    await call('/buyer/' + noConsent.id + '/convert', 'POST', {}, 409);

    const [opportunity] = await prisma.$queryRaw<{ id_solicitud: number }[]>`
      SELECT id_solicitud FROM dbo.v_OrigenMedidasOportunidadLead WHERE id_solicitud=${requestId}
    `;
    assert.equal(opportunity?.id_solicitud, requestId);
    const option = await call('/lead/' + personId + '/alternative', 'POST', {
      id_solicitud: requestId, id_disponibilidad: slot.id_disponibilidad,
      precio_ofrecido: '150.00', ofr_turno_lead: 'QA',
    }, 201);
    const optionId = option.data.id_opcion;
    const reservation = await call('/lead/' + personId + '/reserve', 'POST', {
      id_solicitud: requestId, id_opcion: optionId,
    }, 201);
    const reservationId = reservation.data.reserva.id_reserva;
    await call('/lead/options/' + optionId, 'DELETE', {}, 409);
    const saved = await prisma.reservas.findUniqueOrThrow({
      where: { id_reserva: reservationId },
      include: { Persona: { include: { Etapa: true } }, Solicitud: true, Opcion: true },
    });
    assert.equal(saved.id_persona, personId);
    assert.equal(saved.id_solicitud, requestId);
    assert.equal(saved.id_opcion, optionId);
    assert.equal(saved.Opcion.estado_respuesta, 'Aceptada');
    assert.equal(saved.Solicitud.resultado_comercial_lead, null);
    assert.equal(saved.Persona.Etapa.nombre, 'PAYER');
    const portalEmail = 'qa-web-' + randomUUID() + '@example.invalid';
    const web = { nombres: 'QA', apellidos: 'Web', email: portalEmail, autoriza_contacto: true,
      id_servicio: service.id_servicio, id_canal: channel.id_canal, id_fuente: source.id_fuente, motivo_consulta: 'Consulta QA web' };
    const webKey = { 'Idempotency-Key': randomUUID() };
    const submissions = await Promise.all([
      call('/buyer/register', 'POST', web, [200, 201], webKey),
      call('/buyer/register', 'POST', web, [200, 201], webKey),
    ]);
    assert.deepEqual(submissions.map(row => row.httpStatus).sort(), [200, 201]);
    const webPerson = submissions[0].data.persona.id_persona;
    const webRequest = submissions[0].data.solicitud.id_solicitud;
    assert.equal(submissions[1].data.solicitud.id_solicitud, webRequest);
    await call('/buyer/register', 'POST', { ...web, motivo_consulta: 'Otra consulta' }, 409, webKey);
    const another = await call('/buyer/register', 'POST', {
      ...web, motivo_consulta: 'Otra consulta',
    }, 200, { 'Idempotency-Key': randomUUID() });
    assert.equal(another.data.persona.id_persona, webPerson);
    assert.notEqual(another.data.solicitud.id_solicitud, webRequest);
    const [webCapture] = await prisma.$queryRaw<{ cantidad: number }[]>`
      SELECT COUNT(*) AS cantidad FROM dbo.CaptacionesBuyer WHERE id_persona=${webPerson}
    `;
    assert.equal(webCapture.cantidad, 1);

    for (const path of ['report-catalogs', ...['R1', 'R2', 'R3'].map(report =>
      'reports/' + report + '?inicio=2020-01-01&fin_exclusivo=2099-01-01')]) {
      const response = await fetch(base + '/lead/commercial/' + path);
      const report = await response.json();
      console.log('GET', path, response.status);
      assert.equal(response.status, 200, report.error);
      if (path === 'report-catalogs') assert.ok(report.servicios.length > 0);
      else if (path.startsWith('reports/R1')) assert.ok(Array.isArray(report));
      else assert.ok(Array.isArray(report.detalle) && Array.isArray(report.resumen));
    }
    for (const report of ['R2', 'R3']) {
      const response = await fetch(base + '/lead/commercial/reports/' + report + '?inicio=2098-01-01&fin_exclusivo=2099-01-01');
      const result = await response.json();
      assert.equal(response.status, 200);
      assert.equal(result.detalle.length, 0);
      assert.equal(result.resumen[0][report === 'R2' ? 'L2Porcentaje' : 'L3Porcentaje'], null);
    }
    console.log('BUYER → LEAD y entrega de la reserva aprobados.');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
