import { Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { prisma } from '../db';

export const leadCommercialRouter = Router();
const router = leadCommercialRouter;
const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

class InputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function id(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      !/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 2147483647) {
    throw new InputError('Identificador inválido.');
  }
  return Number(value);
}

function optionalId(value: unknown) {
  return value == null ? null : id(value);
}

function requiredText(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new InputError('Texto requerido de hasta ' + max + ' caracteres.');
  }
  return value.trim();
}

function price(value: unknown) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d{1,8}(\.\d{1,2})?$/.test(String(value))) {
    throw new InputError('Precio inválido.');
  }
  return new Prisma.Decimal(value);
}

function route(action: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      await action(req, res);
    } catch (error) {
      if (error instanceof InputError) return res.status(error.status).json({ error: error.message });
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (['P2002', 'P2003', 'P2004', 'P2034'].includes(error.code)) {
          return res.status(409).json({ error: 'La operación entra en conflicto con los datos vigentes.' });
        }
      }
      console.error('LEAD comercial', error);
      return res.status(500).json({ error: 'No se pudo completar la operación LEAD.' });
    }
  };
}

async function opportunity(tx: Prisma.TransactionClient, value: unknown, editable: boolean) {
  const row = await tx.solicitudes.findUnique({ where: { id_solicitud: id(value) } });
  if (!row) throw new InputError('Oportunidad inexistente.', 404);
  // The Buyer conversion is authoritative when it supplies a linked stage event.
  const [entry] = await tx.$queryRaw<{ ingreso: Date }[]>`
    SELECT fecha_solicitud AS ingreso
    FROM dbo.fn_Lead_Oportunidades_Corte(SYSUTCDATETIME())
    WHERE id_solicitud = ${row.id_solicitud}
  `;
  if (!entry) throw new InputError('La solicitud no tiene ingreso a LEAD documentado.', 409);
  if (editable && (row.archivada_lead_en ||
      ['ACEPTADA', 'CERRADA_SIN_ACUERDO'].includes(row.resultado_comercial_lead ?? ''))) {
    throw new InputError('La oportunidad ya está cerrada o archivada.', 409);
  }
  return row;
}

router.post('/opportunities', route(async (req, res) => {
  const body = req.body;
  const result = await prisma.$transaction(async tx => {
    const id_persona = id(body.id_persona);
    const person = await tx.personas.findFirst({ where: { id_persona, Etapa: { nombre: 'LEAD' } } });
    if (!person) throw new InputError('La persona debe ingresar a LEAD por el flujo de conversión.', 409);
    return tx.solicitudes.create({
      data: {
        id_persona, id_servicio: id(body.id_servicio), id_canal_origen: optionalId(body.id_canal_origen),
        id_negociador: optionalId(body.id_negociador), id_sede_interes_lead: optionalId(body.id_sede_interes_lead),
        fecha_ingreso_lead: new Date(), resultado_comercial_lead: 'PENDIENTE',
      },
    });
  }, serializable);
  res.status(201).json(result);
}));

router.get('/opportunities/:id', route(async (req, res) => {
  const data = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, false);
    const id_solicitud = row.id_solicitud;
    const [propuestas, alternativas, comunicaciones, preferencias] = await Promise.all([
      tx.propuestasEconomicasLead.findMany({ where: { id_solicitud }, orderBy: { id_propuesta: 'asc' } }),
      tx.opciones.findMany({ where: { id_solicitud }, include: { Disponibilidad: true } }),
      tx.interacciones.findMany({ where: { id_solicitud }, orderBy: { fecha_hora: 'asc' } }),
      tx.personaPreferencias.findMany({ where: { id_persona: row.id_persona } }),
    ]);
    const modificaciones = await tx.cambiosOpcionLead.findMany({
      where: { id_opcion: { in: alternativas.map(option => option.id_opcion) } },
      orderBy: { id_cambio: 'asc' },
    });
    return { oportunidad: row, propuestas, alternativas, comunicaciones, preferencias, modificaciones };
  }, serializable);
  res.json(data);
}));

router.post('/opportunities/:id/interactions', route(async (req, res) => {
  const result = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, true);
    const useful = req.body.es_respuesta_util === true;
    const interaction = await tx.interacciones.create({
      data: {
        id_solicitud: row.id_solicitud, id_persona: row.id_persona, id_canal: id(req.body.id_canal),
        tipo: requiredText(req.body.tipo, 50), es_respuesta_util: useful,
        mensaje: req.body.mensaje == null ? null : requiredText(req.body.mensaje, 4000),
      },
    });
    if (useful && !row.fecha_primera_respuesta) {
      await tx.solicitudes.update({
        where: { id_solicitud: row.id_solicitud }, data: { fecha_primera_respuesta: interaction.fecha_hora },
      });
    }
    return interaction;
  }, serializable);
  res.status(201).json(result);
}));

router.get('/catalogs', route(async (_req, res) => {
  const [promociones, motivos] = await Promise.all([
    prisma.promocionesLead.findMany({ where: { activo: true } }),
    prisma.motivosRechazoLead.findMany({ where: { activo: true } }),
  ]);
  res.json({ promociones, motivos });
}));

router.get('/report-catalogs', route(async (_req, res) => {
  const [servicios, sedes, canales, fuentes, negociadores, promociones, motivos, audit, horarios] = await Promise.all([
    prisma.servicios.findMany({ select: { id_servicio: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.sedes.findMany({ select: { id_sede: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.canales.findMany({ select: { id_canal: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.fuentes.findMany({ select: { id_fuente: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.$queryRaw`SELECT DISTINCT u.id_usuario, CONCAT(u.nombres,' ',u.apellidos) AS nombre
      FROM dbo.Usuarios u JOIN dbo.HistorialSolicitudesLead h ON h.id_negociador=u.id_usuario
      ORDER BY nombre`,
    prisma.promocionesLead.findMany({ select: { id_promocion: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    prisma.motivosRechazoLead.findMany({ select: { id_motivo_rechazo: true, motivo: true, ambito: true }, orderBy: { motivo: 'asc' } }),
    prisma.$queryRaw<{ auditoria_desde_utc: Date }[]>`SELECT auditoria_desde_utc FROM dbo.ConfiguracionLeadRevision WHERE version_codigo='LEAD-V2'`,
    prisma.$queryRaw`SELECT DISTINCT h.id_profesional, CONCAT(p.nombres,' ',p.apellidos) AS profesional,
      h.pref_turno_lead, h.ofr_turno_lead FROM dbo.HistorialOpcionesLead h
      JOIN dbo.Profesionales p ON p.id_profesional=h.id_profesional`,
  ]);
  res.json({ servicios, sedes, canales, fuentes, negociadores, promociones, motivos, horarios,
    auditoria_desde_utc: audit[0]?.auditoria_desde_utc ?? null });
}));

router.post('/promotions', route(async (req, res) => {
  const result = await prisma.promocionesLead.create({ data: {
    nombre: requiredText(req.body.nombre, 150), tipo_promocion: requiredText(req.body.tipo_promocion, 80),
    id_servicio: optionalId(req.body.id_servicio),
  } });
  res.status(201).json(result);
}));

router.post('/rejection-reasons', route(async (req, res) => {
  const { ambito, categoria } = req.body;
  if (!(ambito === 'PROPUESTA' && ['ECONOMICO', 'OTROS'].includes(categoria)) &&
      !(ambito === 'ALTERNATIVA' && ['INCOMPATIBILIDAD', 'OTROS'].includes(categoria))) {
    throw new InputError('El ámbito y la categoría no son compatibles.');
  }
  const result = await prisma.motivosRechazoLead.create({ data: {
    codigo: requiredText(req.body.codigo, 60), motivo: requiredText(req.body.motivo, 160), ambito, categoria,
  } });
  res.status(201).json(result);
}));

async function currentProposal(tx: Prisma.TransactionClient, proposalId: number, requestId: number) {
  const proposal = await tx.propuestasEconomicasLead.findFirst({
    where: { id_propuesta: proposalId, id_solicitud: requestId },
  });
  if (!proposal) throw new InputError('La propuesta no corresponde a la oportunidad.', 404);
  const root = proposal.id_propuesta_raiz ?? proposal.id_propuesta;
  const latest = await tx.propuestasEconomicasLead.findFirst({
    where: { OR: [{ id_propuesta: root }, { id_propuesta_raiz: root }] },
    orderBy: { numero_version: 'desc' },
  });
  if (latest?.id_propuesta !== proposalId) throw new InputError('Usa la versión vigente de la propuesta.', 409);
  return { proposal, root };
}

router.post('/opportunities/:id/proposals', route(async (req, res) => {
  const body = req.body;
  const result = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, true);
    if (row.id_servicio == null) throw new InputError('La oportunidad debe tener un tratamiento.');
    const prior = body.id_version_anterior == null ? null :
      await currentProposal(tx, id(body.id_version_anterior), row.id_solicitud);
    const promotion = optionalId(body.id_promocion_lead);
    if (promotion && !await tx.promocionesLead.findFirst({
      where: { id_promocion: promotion, activo: true, OR: [{ id_servicio: null }, { id_servicio: row.id_servicio }] },
    })) throw new InputError('Promoción inactiva o incompatible con el tratamiento.');
    return tx.propuestasEconomicasLead.create({ data: {
      id_solicitud: row.id_solicitud, id_servicio: row.id_servicio,
      id_propuesta_raiz: prior?.root ?? null, numero_version: (prior?.proposal.numero_version ?? 0) + 1,
      precio_cotizado: price(body.precio_cotizado), id_promocion_lead: promotion,
      id_sede_lead: optionalId(body.id_sede_lead),
    } });
  }, serializable);
  res.status(201).json(result);
}));

async function decision(tx: Prisma.TransactionClient, body: Request['body'], scope: string) {
  if (!['Aceptada', 'Rechazada'].includes(body.estado)) throw new InputError('Resultado de decisión inválido.');
  const reason = optionalId(body.id_motivo_rechazo_lead);
  if (body.estado === 'Rechazada') {
    if (!reason || !await tx.motivosRechazoLead.findFirst({
      where: { id_motivo_rechazo: reason, ambito: scope, activo: true },
    })) throw new InputError('Selecciona un motivo de rechazo vigente del ámbito correspondiente.');
  } else if (reason) throw new InputError('Un resultado aceptado no admite un motivo de rechazo.');
  return { state: body.estado as string, reason, date: new Date() };
}

router.post('/opportunities/:id/proposals/:proposal/decision', route(async (req, res) => {
  const result = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, true);
    const { proposal } = await currentProposal(tx, id(req.params.proposal), row.id_solicitud);
    if (proposal.estado !== 'Pendiente') throw new InputError('La versión ya tiene una decisión.', 409);
    const outcome = await decision(tx, req.body, 'PROPUESTA');
    return tx.propuestasEconomicasLead.update({
      where: { id_propuesta: proposal.id_propuesta },
      data: { estado: outcome.state, fecha_decision: outcome.date, id_motivo_rechazo_lead: outcome.reason },
    });
  }, serializable);
  res.json(result);
}));

router.post('/opportunities/:id/outcome', route(async (req, res) => {
  const result = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, true);
    const now = new Date();
    const data: Prisma.SolicitudesUncheckedUpdateInput = { fecha_decision_comercial_lead: now };
    if (req.body.resultado === 'ACEPTADA' && req.body.aceptacion_expresa === true) {
      const { proposal } = await currentProposal(tx, id(req.body.id_propuesta), row.id_solicitud);
      if (proposal.estado !== 'Aceptada') throw new InputError('La propuesta vigente debe estar aceptada.');
      data.resultado_comercial_lead = 'ACEPTADA';
      data.id_propuesta_aceptada_lead = proposal.id_propuesta;
      data.valor_acordado_lead = proposal.precio_cotizado;
      data.motivo_cierre_lead = null;
    } else if (req.body.resultado === 'CERRADA_SIN_ACUERDO') {
      data.resultado_comercial_lead = 'CERRADA_SIN_ACUERDO';
      data.motivo_cierre_lead = requiredText(req.body.motivo, 400);
      data.estado = 'Abandonada';
      data.fecha_cierre = now;
    } else throw new InputError('Registra un cierre válido o confirma la aceptación comercial expresa.');
    return tx.solicitudes.update({ where: { id_solicitud: row.id_solicitud }, data });
  }, serializable);
  res.json(result);
}));

router.post('/opportunities/:id/alternatives/:option/decision', route(async (req, res) => {
  const result = await prisma.$transaction(async tx => {
    const row = await opportunity(tx, req.params.id, true);
    const option = await tx.opciones.findFirst({
      where: {
        id_opcion: id(req.params.option), id_solicitud: row.id_solicitud, archivada_lead_en: null,
        Reservas: { none: {} }, OR: [{ estado_respuesta: null }, { estado_respuesta: 'Pendiente' }],
      },
    });
    if (!option) throw new InputError('La alternativa no admite una decisión.', 409);
    const outcome = await decision(tx, req.body, 'ALTERNATIVA');
    return tx.opciones.update({
      where: { id_opcion: option.id_opcion },
      data: {
        estado_respuesta: outcome.state, fecha_respuesta: outcome.date,
        seleccionada: outcome.state === 'Aceptada', id_motivo_rechazo_lead: outcome.reason,
      },
    });
  }, serializable);
  res.json(result);
}));

function calendarDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InputError('Las fechas del período deben usar YYYY-MM-DD.');
  }
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new InputError('Fecha del período inválida.');
  }
  return value;
}

router.get('/reports/:report', route(async (req, res) => {
  const q = req.query;
  const start = calendarDate(q.inicio);
  const end = calendarDate(q.fin_exclusivo);
  const cutoff = q.corte_utc == null ? new Date() : new Date(requiredText(q.corte_utc, 32));
  if (start >= end || !Number.isFinite(cutoff.getTime()) || cutoff.getTime() > Date.now() ||
      (q.corte_utc != null && !String(q.corte_utc).endsWith('Z'))) {
    throw new InputError('Período o corte UTC inválido.');
  }
  const service = optionalId(q.id_servicio);
  const branch = optionalId(q.id_sede);
  const reason = optionalId(q.id_motivo);
  const scope = Prisma.sql`@periodo_inicio=${start}, @periodo_fin_exclusivo=${end},
    @corte_utc=${cutoff}, @id_servicio=${service}, @id_sede=${branch}`;
  const [audit] = await prisma.$queryRaw<{ auditoria_desde_utc: Date }[]>`
    SELECT auditoria_desde_utc FROM dbo.ConfiguracionLeadRevision WHERE version_codigo='LEAD-V2'
  `;
  if (!audit || cutoff < audit.auditoria_desde_utc) throw new InputError('El corte antecede al inicio de la auditoría.');
  let payload: unknown;
  const report = req.params.report;
  if (report === 'R1') {
    payload = await prisma.$queryRaw(Prisma.sql`EXEC dbo.usp_Lead_ReporteR1 ${scope},
      @id_canal=${optionalId(q.id_canal)}, @id_fuente=${optionalId(q.id_fuente)},
      @id_negociador=${optionalId(q.id_negociador)}, @desglosar_canal=${q.desglosar_canal === 'true'}`);
  } else if (report === 'R2' || report === 'R3') {
    const command = report === 'R2'
      ? Prisma.sql`EXEC dbo.usp_Lead_ReporteR2 ${scope}, @id_motivo=${reason},
          @id_promocion=${optionalId(q.id_promocion)}, @precio_min=${q.precio_min == null ? null : price(q.precio_min)},
          @precio_max=${q.precio_max == null ? null : price(q.precio_max)},
          @con_promocion=${q.con_promocion == null ? null : q.con_promocion === 'true'}`
      : Prisma.sql`EXEC dbo.usp_Lead_ReporteR3 ${scope}, @id_motivo=${reason},
          @id_profesional=${optionalId(q.id_profesional)}, @pref_dia=${optionalId(q.pref_dia)},
          @ofr_dia=${optionalId(q.ofr_dia)}, @pref_turno=${q.pref_turno == null ? null : requiredText(q.pref_turno, 30)},
          @ofr_turno=${q.ofr_turno == null ? null : requiredText(q.ofr_turno, 30)}`;
    const [detalle, resumen] = await prisma.$transaction([
      prisma.$queryRaw(Prisma.sql`${command}, @seccion='detalle'`),
      prisma.$queryRaw(Prisma.sql`${command}, @seccion='resumen'`),
    ], serializable);
    payload = { detalle, resumen };
  } else {
    throw new InputError('Reporte LEAD inexistente.', 404);
  }
  res.type('json').send(JSON.stringify(payload, (_, value) => typeof value === 'bigint' ? value.toString() : value));
}));
