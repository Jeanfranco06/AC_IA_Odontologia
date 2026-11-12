import crypto from 'crypto';
import { prisma } from '../../../../db';
import { CustomerAiPersistenceService } from '../../../../services/customerAiPersistenceService';
import { attentionForPrincipal, treatmentForPrincipal } from '../policies';
import { AiAgentError, AiAgentPrincipal } from '../types';
import { CustomerSchedulingService } from './customerSchedulingService';

const ACTIVE_ALERT_STATES = { notIn: ['Resuelta', 'Descartada_Justificada'] };
const correlation = () => crypto.randomUUID();
const completed = ['Completada', 'Completado', 'Finalizada', 'Finalizado'];
const rescheduleStates = ['Programada', 'Confirmada', 'Pendiente', 'Reprogramada'];
const activeTreatments = ['Contratado', 'Activado', 'Activo', 'En_Curso', 'En curso'];
const rescheduleReviewStatuses = ['En_Revision', 'Aprobada', 'Rechazada', 'Cancelada'] as const;
const alertReviewStatuses = ['En_Revision', 'Atendida', 'Descartada_Justificada'] as const;
const alertTransitions: Record<string, string[]> = { Generada: ['En_Revision', 'Atendida', 'Descartada_Justificada'], En_Revision: ['Atendida', 'Resuelta', 'Descartada_Justificada'], Atendida: ['Resuelta'] };
const rescheduleTransitions: Record<string, string[]> = { Pendiente: ['En_Revision', 'Aprobada', 'Rechazada', 'Cancelada'], En_Revision: ['Aprobada', 'Rechazada', 'Cancelada'], Aprobada: ['Cancelada'] };
const RULE_VERSION = 'CUSTOMER-RULES-v2';

function staff(principal: AiAgentPrincipal, ...roles: AiAgentPrincipal['role'][]) {
  if (!roles.includes(principal.role)) throw new AiAgentError('FORBIDDEN', 'El perfil no está autorizado para esta acción.');
}

function tokenSecret() {
  const secret = process.env.AI_AGENT_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new AiAgentError('SERVICE_UNAVAILABLE', 'La autenticación de acciones no está configurada.');
  return secret;
}

function issueConfirmation(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 15 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyConfirmation(token: string): Record<string, unknown> {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new AiAgentError('INVALID_INPUT', 'El token de confirmación no es válido.');
  const expected = crypto.createHmac('sha256', tokenSecret()).update(body).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new AiAgentError('INVALID_INPUT', 'El token de confirmación no es válido.');
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) throw new Error();
    return payload;
  } catch { throw new AiAgentError('CONFLICT', 'El token de confirmación expiró o fue alterado.'); }
}

function formatSpanishDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'America/Lima'
    }).format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

function alertKey(input: { personId: number; type: string; treatmentId?: number; sessionId?: number; attentionId?: number }) {
  return crypto.createHash('sha256').update([RULE_VERSION, input.type, input.personId, input.treatmentId ?? '-', input.sessionId ?? '-', input.attentionId ?? '-'].join(':')).digest('hex');
}

function slotDateTime(date: Date, time: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), time.getUTCHours(), time.getUTCMinutes(), time.getUTCSeconds()));
}

async function sessionForPatient(principal: AiAgentPrincipal, sessionId: number) {
  if (principal.role !== 'PACIENTE' || !principal.idPersona) throw new AiAgentError('FORBIDDEN', 'Solo un paciente puede solicitar reprogramaciones.');
  const session = await prisma.sesionesTratamiento.findUnique({ where: { id_sesion: sessionId }, include: { TratamientosContratados: true } });
  if (!session || session.TratamientosContratados.id_persona !== principal.idPersona) throw new AiAgentError('FORBIDDEN', 'La sesión no pertenece al paciente autenticado.');
  if (!activeTreatments.includes(session.TratamientosContratados.estado_tratamiento)) throw new AiAgentError('CONFLICT', 'El tratamiento no está en un estado compatible con una solicitud.');
  if (!rescheduleStates.includes(session.estado_programacion) || session.estado_asistencial !== 'Pendiente' || session.fecha_programada_vigente <= new Date() || session.numero_sesion <= 1) throw new AiAgentError('CONFLICT', 'La sesión no puede solicitar reprogramación en su estado actual.');
  return session;
}

export class CustomerAiActionService {
  static async prepareRescheduleRequest(principal: AiAgentPrincipal, input: { sessionId: number; preferredDate?: string; preferredSlot?: string; reason?: string; idempotencyKey?: string }) {
    if (input.preferredDate && Number.isNaN(new Date(input.preferredDate).getTime())) throw new AiAgentError('INVALID_INPUT', 'La fecha preferida no es válida.');
    if (input.preferredSlot && input.preferredSlot.length > 40) throw new AiAgentError('INVALID_INPUT', 'La franja preferida excede el máximo permitido.');
    if (input.reason && input.reason.length > 300) throw new AiAgentError('INVALID_INPUT', 'El motivo excede el máximo permitido.');
    const session = await sessionForPatient(principal, input.sessionId);
    const key = input.idempotencyKey?.trim() || crypto.randomUUID();
    if (key.length > 100) throw new AiAgentError('INVALID_INPUT', 'La clave de idempotencia es demasiado larga.');
    const scopedKey = `${principal.idPersona}-${crypto.createHash('sha256').update(key).digest('hex')}`;
    const correlationId = correlation();
    return { action: 'REQUEST_RESCHEDULE', requiresConfirmation: true, status: 'PREPARED', summary: 'Solicitar cambio de la sesión seleccionada', confirmationToken: issueConfirmation({ action: 'REQUEST_RESCHEDULE', sessionId: session.id_sesion, treatmentId: session.id_tratamiento, patientId: principal.idPersona, idempotencyKey: scopedKey, originalDate: session.fecha_programada_vigente.toISOString(), preferredDate: input.preferredDate || null, preferredSlot: input.preferredSlot || null, reason: input.reason || null, correlationId }), data: { sessionId: session.id_sesion, treatmentId: session.id_tratamiento, originalDate: session.fecha_programada_vigente.toISOString(), preferredDate: input.preferredDate || null, preferredSlot: input.preferredSlot || null }, meta: { source: 'NexoSaludDB' as const, correlationId } };
  }

  static async confirmRescheduleRequest(principal: AiAgentPrincipal, confirmationToken: string) {
    const payload = verifyConfirmation(confirmationToken);
    if (payload.action !== 'REQUEST_RESCHEDULE' || payload.patientId !== principal.idPersona) throw new AiAgentError('FORBIDDEN', 'La confirmación no corresponde al paciente autenticado.');
    const session = await sessionForPatient(principal, Number(payload.sessionId));
    if (session.id_tratamiento !== payload.treatmentId || session.fecha_programada_vigente.toISOString() !== payload.originalDate) throw new AiAgentError('CONFLICT', 'La sesión cambió desde que se preparó la solicitud.');
    const idempotencyKey = String(payload.idempotencyKey);
    const existing = await prisma.solicitudesReprogramacionCustomer.findUnique({ where: { clave_idempotencia: idempotencyKey } });
    if (existing) {
      if (existing.id_persona !== principal.idPersona) throw new AiAgentError('FORBIDDEN', 'La clave de idempotencia no corresponde al paciente autenticado.');
      return { status: 'RECORDED', requestId: existing.id_solicitud_reprogramacion, idempotent: true, correlationId: existing.id_correlacion };
    }
    try {
      const request = await prisma.$transaction(async tx => {
        const interaction = await tx.interaccionesIA.create({ data: { id_persona: principal.idPersona!, id_tratamiento: session.id_tratamiento, id_sesion: session.id_sesion, actor_orientado: 'PACIENTE', tipo_evento: 'SOLICITUD_REPROGRAMACION', resumen_consulta: 'Solicitud de reprogramación confirmada', resultado: 'Registrada para revisión de recepción', id_correlacion: String(payload.correlationId), version_agente: 'CUSTOMER-ACTIONS-v2' } });
        return tx.solicitudesReprogramacionCustomer.create({ data: { id_sesion: session.id_sesion, id_tratamiento: session.id_tratamiento, id_persona: principal.idPersona!, id_interaccion_origen: interaction.id_interaccion_ia, fecha_programada_original: session.fecha_programada_vigente, fecha_preferida: payload.preferredDate ? new Date(String(payload.preferredDate)) : null, franja_preferida: payload.preferredSlot ? String(payload.preferredSlot) : null, motivo_solicitud: payload.reason ? String(payload.reason) : null, estado_solicitud: 'Pendiente', clave_idempotencia: idempotencyKey, id_correlacion: String(payload.correlationId) } });
      }, { isolationLevel: 'Serializable' });
      return { status: 'RECORDED', requestId: request.id_solicitud_reprogramacion, idempotent: false, originalDate: request.fecha_programada_original.toISOString(), correlationId: request.id_correlacion };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') { const duplicate = await prisma.solicitudesReprogramacionCustomer.findUnique({ where: { clave_idempotencia: idempotencyKey } }); if (duplicate && duplicate.id_persona === principal.idPersona) return { status: 'RECORDED', requestId: duplicate.id_solicitud_reprogramacion, idempotent: true, correlationId: duplicate.id_correlacion }; }
      throw error;
    }
  }

  static async getRescheduleRequests(principal: AiAgentPrincipal) {
    if (principal.role === 'PACIENTE' && !principal.idPersona) throw new AiAgentError('FORBIDDEN', 'El paciente no tiene ámbito autorizado.');
    if (!['PACIENTE', 'RECEPCION', 'ADMIN'].includes(principal.role)) throw new AiAgentError('FORBIDDEN', 'Solo recepción, administración o el paciente pueden consultar solicitudes.');
    const rows = await prisma.solicitudesReprogramacionCustomer.findMany({ 
      where: principal.role === 'PACIENTE' ? { id_persona: principal.idPersona } : {}, 
      orderBy: { fecha_creacion: 'desc' }, 
      take: 100 
    });

    const sessionIds = [...new Set(rows.map(r => r.id_sesion))];
    const personIds = [...new Set(rows.map(r => r.id_persona))];

    const [sessions, persons] = await Promise.all([
      prisma.sesionesTratamiento.findMany({
        where: { id_sesion: { in: sessionIds } },
        include: {
          Profesional: { select: { id_profesional: true, nombres: true, apellidos: true } },
          Sede: { select: { id_sede: true, nombre: true } },
          Tratamiento: { select: { Servicio: { select: { nombre_servicio: true } } } }
        }
      }),
      prisma.personas.findMany({
        where: { id_persona: { in: personIds } },
        select: { id_persona: true, nombres: true, apellidos: true, dni: true }
      })
    ]);

    const sessionMap = new Map(sessions.map(s => [s.id_sesion, s]));
    const personMap = new Map(persons.map(p => [p.id_persona, p]));

    return { 
      success: true, 
      data: rows.map(r => {
        const s = sessionMap.get(r.id_sesion);
        const p = personMap.get(r.id_persona);
        return {
          requestId: r.id_solicitud_reprogramacion,
          sessionId: r.id_sesion,
          sessionNumber: s?.numero_sesion ?? 1,
          treatmentId: r.id_tratamiento,
          serviceName: s?.Tratamiento?.Servicio?.nombre_servicio ?? 'Tratamiento Odontológico',
          patientId: r.id_persona,
          patientName: p ? `${p.nombres} ${p.apellidos}`.trim() : 'Paciente',
          patientDni: p?.dni ?? '',
          professionalId: s?.id_profesional ?? 0,
          professionalName: s?.Profesional ? `Dr. ${s.Profesional.nombres} ${s.Profesional.apellidos}`.trim() : 'Profesional asignado',
          branchId: s?.id_sede ?? 1,
          branchName: s?.Sede?.nombre ?? 'Sede Principal',
          originalDate: r.fecha_programada_original.toISOString(),
          preferredDate: r.fecha_preferida?.toISOString() ?? null,
          preferredSlot: r.franja_preferida,
          reason: r.motivo_solicitud,
          status: r.estado_solicitud,
          createdAt: r.fecha_creacion.toISOString(),
          reviewedAt: r.fecha_revision?.toISOString() ?? null,
          resolutionReason: r.motivo_resolucion
        };
      }), 
      meta: { source: 'NexoSaludDB' as const, correlationId: correlation() } 
    };
  }

  static async reviewRescheduleRequest(principal: AiAgentPrincipal, requestId: number, status: string, reason?: string) {
    staff(principal, 'RECEPCION', 'ADMIN');
    if (!principal.idUsuario) throw new AiAgentError('FORBIDDEN', 'El usuario institucional no tiene identidad de auditoría.');
    if (!rescheduleReviewStatuses.includes(status as typeof rescheduleReviewStatuses[number])) throw new AiAgentError('INVALID_INPUT', 'El estado de revisión no es válido. La aplicación requiere el servicio oficial de agenda.');
    if (reason && reason.length > 300) throw new AiAgentError('INVALID_INPUT', 'El motivo excede el máximo permitido.');
    if (['Rechazada', 'Cancelada'].includes(status) && !reason?.trim()) throw new AiAgentError('INVALID_INPUT', 'El rechazo o cancelación requiere un motivo.');
    const updated = await prisma.$transaction(async tx => {
      const current = await tx.solicitudesReprogramacionCustomer.findUnique({ where: { id_solicitud_reprogramacion: requestId } });
      if (!current) throw new AiAgentError('NOT_FOUND', 'Solicitud de reprogramación no encontrada.');
      if (!rescheduleTransitions[current.estado_solicitud]?.includes(status)) throw new AiAgentError('CONFLICT', 'La solicitud ya no admite esa transición.');
      const change = await tx.solicitudesReprogramacionCustomer.updateMany({ where: { id_solicitud_reprogramacion: requestId, estado_solicitud: current.estado_solicitud }, data: { estado_solicitud: status, id_usuario_responsable: principal.idUsuario!, fecha_revision: new Date(), motivo_resolucion: reason?.trim() || null } });
      if (change.count !== 1) throw new AiAgentError('CONFLICT', 'La solicitud cambió durante la revisión.');
      await tx.interaccionesIA.create({ data: { id_persona: current.id_persona, id_usuario_revisor: principal.idUsuario!, id_tratamiento: current.id_tratamiento, id_sesion: current.id_sesion, actor_orientado: 'PACIENTE', tipo_evento: `SOLICITUD_REPROGRAMACION_${status.toUpperCase()}`, resumen_consulta: `Revisión institucional de solicitud ${current.id_solicitud_reprogramacion}`, resultado: (reason?.trim() || `Cambio de estado ${current.estado_solicitud} a ${status}`).slice(0, 200), id_correlacion: current.id_correlacion, version_agente: 'CUSTOMER-ACTIONS-v2' } });
      return tx.solicitudesReprogramacionCustomer.findUniqueOrThrow({ where: { id_solicitud_reprogramacion: requestId } });
    }, { isolationLevel: 'Serializable' });
    return { success: true, data: { requestId: updated.id_solicitud_reprogramacion, status: updated.estado_solicitud, agendaChanged: false, reason: updated.motivo_resolucion }, meta: { source: 'NexoSaludDB' as const, correlationId: updated.id_correlacion || correlation() } };
  }

  static async applyRescheduleRequest(principal: AiAgentPrincipal, requestId: number, availabilityId: number, reason: string) {
    staff(principal, 'RECEPCION', 'ADMIN');
    if (!principal.idUsuario) throw new AiAgentError('FORBIDDEN', 'El usuario institucional no tiene identidad de auditoría.');
    const userId = principal.idUsuario;
    if (!reason?.trim() || reason.length > 300) throw new AiAgentError('INVALID_INPUT', 'La aplicación requiere un motivo de hasta 300 caracteres.');
    const correlationId = correlation();
    const applied = await prisma.$transaction(async tx => {
      const request = await tx.solicitudesReprogramacionCustomer.findUnique({ where: { id_solicitud_reprogramacion: requestId } });
      if (!request) throw new AiAgentError('NOT_FOUND', 'Solicitud de reprogramación no encontrada.');
      if (request.estado_solicitud !== 'Aprobada') throw new AiAgentError('CONFLICT', 'Solo se pueden aplicar solicitudes previamente aprobadas.');
      const session = await tx.sesionesTratamiento.findUnique({ where: { id_sesion: request.id_sesion } });
      if (!session || session.id_tratamiento !== request.id_tratamiento || session.fecha_programada_vigente.getTime() !== request.fecha_programada_original.getTime()) throw new AiAgentError('CONFLICT', 'La sesión cambió desde que se registró la solicitud.');
      const treatment = await tx.tratamientosContratados.findUnique({ where: { id_tratamiento: request.id_tratamiento }, select: { id_persona: true, estado_tratamiento: true } });
      if (!treatment || treatment.id_persona !== request.id_persona || !activeTreatments.includes(treatment.estado_tratamiento)) throw new AiAgentError('CONFLICT', 'El tratamiento ya no está habilitado para reprogramar sesiones.');
      if (session.estado_asistencial !== 'Pendiente' || !rescheduleStates.includes(session.estado_programacion) || session.fecha_programada_vigente <= new Date()) throw new AiAgentError('CONFLICT', 'La sesión ya no admite reprogramación.');
      const slot = await tx.disponibilidad.findUnique({ where: { id_disponibilidad: availabilityId } });
      if (!slot || slot.estado !== 'Disponible' || slot.disponible === false) throw new AiAgentError('CONFLICT', 'El horario ya no está disponible.');
      if (slot.id_profesional !== session.id_profesional || slot.id_sede !== session.id_sede) throw new AiAgentError('INVALID_INPUT', 'El horario debe corresponder al profesional y sede asignados al tratamiento.');
      const start = slotDateTime(slot.fecha, slot.hora_inicio);
      const end = slotDateTime(slot.fecha, slot.hora_fin);
      const duration = (end.getTime() - start.getTime()) / 60_000;
      if (start <= new Date() || duration < session.duracion_programada_min) throw new AiAgentError('CONFLICT', 'El horario no cubre la duración de la sesión o ya pasó.');
      const payerReservation = await tx.reservas.findFirst({ where: { Opcion: { id_disponibilidad: availabilityId } }, select: { id_reserva: true } });
      if (payerReservation) throw new AiAgentError('CONFLICT', 'El horario está vinculado a una reserva del flujo PAYER y no puede reutilizarse.');
      const sameSlot = await tx.sesionesTratamiento.findFirst({ where: { id_disponibilidad: availabilityId, id_sesion: { not: session.id_sesion }, estado_programacion: { in: ['Programada', 'Confirmada', 'Pendiente'] } }, select: { id_sesion: true } });
      if (sameSlot) throw new AiAgentError('CONFLICT', 'El horario ya está asignado a otra sesión.');
      const dayStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const sameProfessional = await tx.sesionesTratamiento.findMany({ where: { id_profesional: session.id_profesional, id_sesion: { not: session.id_sesion }, fecha_programada_vigente: { gte: dayStart, lt: dayEnd }, estado_programacion: { in: ['Programada', 'Confirmada', 'Pendiente', 'Reprogramada'] } }, select: { fecha_programada_vigente: true, duracion_programada_min: true } });
      if (sameProfessional.some(other => start < new Date(other.fecha_programada_vigente.getTime() + other.duracion_programada_min * 60_000) && other.fecha_programada_vigente < new Date(start.getTime() + session.duracion_programada_min * 60_000))) throw new AiAgentError('CONFLICT', 'El profesional ya tiene otra sesión en ese intervalo.');
      const claimed = await tx.disponibilidad.updateMany({ where: { id_disponibilidad: availabilityId, estado: 'Disponible' }, data: { estado: 'Ocupado' } });
      if (claimed.count !== 1) throw new AiAgentError('CONFLICT', 'El horario fue ocupado por otra operación.');
      await CustomerSchedulingService.reprogramTreatmentSession(tx, { sessionId: session.id_sesion, originalDate: request.fecha_programada_original, newDate: start, reason: reason.trim(), userId, availabilityId });
      const updatedRequest = await tx.solicitudesReprogramacionCustomer.updateMany({ where: { id_solicitud_reprogramacion: requestId, estado_solicitud: 'Aprobada', fecha_aplicacion: null }, data: { estado_solicitud: 'Aplicada', id_usuario_responsable: principal.idUsuario, fecha_revision: new Date(), fecha_aplicacion: new Date(), motivo_resolucion: reason.trim() } });
      if (updatedRequest.count !== 1) throw new AiAgentError('CONFLICT', 'La solicitud cambió durante la aplicación.');
      await tx.interaccionesIA.create({ data: { id_persona: request.id_persona, id_usuario_revisor: principal.idUsuario, id_tratamiento: session.id_tratamiento, id_sesion: session.id_sesion, actor_orientado: 'PACIENTE', tipo_evento: 'SOLICITUD_REPROGRAMACION_APLICADA', resumen_consulta: `Solicitud ${requestId} aplicada por agenda`, resultado: `Nueva fecha ${start.toISOString()}`.slice(0, 200), id_correlacion: request.id_correlacion, version_agente: 'CUSTOMER-SCHEDULING-v1' } });
      if (session.id_disponibilidad && session.id_disponibilidad !== availabilityId) {
        const stillAssigned = await tx.sesionesTratamiento.findFirst({ where: { id_disponibilidad: session.id_disponibilidad, estado_programacion: { in: ['Programada', 'Confirmada', 'Pendiente', 'Reprogramada'] } }, select: { id_sesion: true } });
        const payerStillOwnsSlot = await tx.reservas.findFirst({ where: { Opcion: { id_disponibilidad: session.id_disponibilidad } }, select: { id_reserva: true } });
        if (!stillAssigned && !payerStillOwnsSlot) await tx.disponibilidad.updateMany({ where: { id_disponibilidad: session.id_disponibilidad, estado: 'Ocupado' }, data: { estado: 'Disponible' } });
      }
      return { sessionId: session.id_sesion, originalDate: session.fecha_programada_vigente, newDate: start };
    }, { isolationLevel: 'Serializable' });
    return { success: true, data: { requestId, status: 'Aplicada', agendaChanged: true, ...applied, newDate: applied.newDate.toISOString() }, meta: { source: 'NexoSaludDB' as const, correlationId } };
  }

  static async detectDocumentationIssues(principal: AiAgentPrincipal, input: { attentionId?: number; treatmentId?: number } = {}) {
    staff(principal, 'ODONTOLOGO', 'RECEPCION', 'ADMIN');
    if (principal.role === 'RECEPCION' && input.attentionId) throw new AiAgentError('FORBIDDEN', 'Recepción solo puede detectar alertas operativas.');
    if (principal.role === 'ODONTOLOGO') {
      if (!input.attentionId && !input.treatmentId) throw new AiAgentError('INVALID_INPUT', 'El odontólogo debe especificar una atención o tratamiento de su ámbito.');
      if (input.treatmentId) await treatmentForPrincipal(input.treatmentId, principal);
    }
    const correlationId = correlation(); const created: unknown[] = [];
    const createAlert = async (data: { personId: number; type: string; message: string; treatmentId?: number; sessionId?: number; attentionId?: number; professionalId?: number }) => {
      const key = alertKey(data);
      const createData = { id_persona: data.personId, tipo_evento: data.type, mensaje_alerta: data.message.slice(0, 300), severidad: data.type === 'AL-C01' || data.type === 'AL-C02' || data.type === 'AL-C05' ? 'Alta' : 'Media', id_profesional: data.professionalId ?? null, id_tratamiento: data.treatmentId ?? null, id_sesion: data.sessionId ?? null, id_atencion: data.attentionId ?? null, version_agente: RULE_VERSION, estado: 'Generada', requiere_revision_humana: true, clave_deduplicacion: key, id_correlacion: correlationId } as const;
      let result = await prisma.alertasIA.findFirst({ where: { clave_deduplicacion: key } });
      if (!result) {
        try { result = await prisma.alertasIA.create({ data: createData }); }
        catch (error) {
          if ((error as { code?: string }).code !== 'P2002') throw error;
          result = await prisma.alertasIA.findFirst({ where: { clave_deduplicacion: key } });
        }
      }
      if (!result) throw new AiAgentError('CONFLICT', 'No fue posible registrar la alerta deduplicada.');
      if (!created.some((item: any) => item.id_alerta_ia === (result as any).id_alerta_ia)) created.push(result);
    };
    if (input.attentionId) {
      const attention = await prisma.atenciones.findUnique({ where: { id_atencion: input.attentionId }, include: { ValidacionesFicha: { orderBy: { numero_revision: 'desc' }, take: 1 } } });
      if (!attention) throw new AiAgentError('NOT_FOUND', 'Atención no encontrada.');
      await attentionForPrincipal(input.attentionId, principal);
      if (input.treatmentId && attention.id_tratamiento !== input.treatmentId) throw new AiAgentError('INVALID_INPUT', 'La atención no pertenece al tratamiento indicado.');
      const validation = attention.ValidacionesFicha[0];
      if (validation && validation.campos_pendientes && !['Completa', 'Completada', 'Validada'].includes(validation.resultado_validacion)) await createAlert({ personId: attention.id_persona, type: 'AL-C01', message: `Ficha clínica con campos pendientes: ${validation.campos_pendientes}`, treatmentId: attention.id_tratamiento ?? undefined, sessionId: attention.id_sesion ?? undefined, attentionId: attention.id_atencion, professionalId: attention.id_profesional });
      if (attention.asistencia === 'Asistió' && attention.estado_cierre_documental !== 'Completado') await createAlert({ personId: attention.id_persona, type: 'AL-C02', message: 'Atención realizada pendiente de cierre documental.', treatmentId: attention.id_tratamiento ?? undefined, sessionId: attention.id_sesion ?? undefined, attentionId: attention.id_atencion, professionalId: attention.id_profesional });
      const pendingInstruction = await prisma.indicacionesPostatencion.findFirst({ where: { id_atencion: attention.id_atencion, estado: { in: ['Borrador', 'Pendiente_Aprobacion'] } } });
      if (pendingInstruction) await createAlert({ personId: attention.id_persona, type: 'AL-C03', message: 'Existe una indicación postatención pendiente de aprobación profesional.', treatmentId: attention.id_tratamiento ?? undefined, sessionId: attention.id_sesion ?? undefined, attentionId: attention.id_atencion, professionalId: attention.id_profesional });
    }
    if (principal.role === 'RECEPCION' || principal.role === 'ADMIN') {
      const pendingRequests = await prisma.solicitudesReprogramacionCustomer.findMany({ where: { estado_solicitud: { in: ['Pendiente', 'En_Revision'] }, ...(input.treatmentId ? { id_tratamiento: input.treatmentId } : {}) }, take: 100 });
      for (const request of pendingRequests) await createAlert({ personId: request.id_persona, type: 'AL-C04', message: `Solicitud ${request.id_solicitud_reprogramacion} pendiente de gestión; estado verificable: ${request.estado_solicitud}.`, treatmentId: request.id_tratamiento, sessionId: request.id_sesion });
    }
    const inconsistentSessions = await prisma.sesionesTratamiento.findMany({ where: { estado_asistencial: { in: completed }, Atenciones: { none: { asistencia: 'Asistió' } }, ...(input.treatmentId ? { id_tratamiento: input.treatmentId } : principal.role === 'ODONTOLOGO' ? { TratamientosContratados: { id_profesional_responsable: principal.idProfesional } } : {}) }, take: 100 });
    for (const session of inconsistentSessions) await createAlert({ personId: (await prisma.tratamientosContratados.findUniqueOrThrow({ where: { id_tratamiento: session.id_tratamiento }, select: { id_persona: true } })).id_persona, type: 'AL-C05', message: `Sesión ${session.id_sesion} marcada ${session.estado_asistencial} sin atención registrada como asistida.`, treatmentId: session.id_tratamiento, sessionId: session.id_sesion, professionalId: session.id_profesional });
    return { success: true, data: { created: created.map((alert: any) => ({ alertId: alert.id_alerta_ia, type: alert.tipo_evento, status: alert.estado })), deduplicated: true }, meta: { source: 'NexoSaludDB' as const, correlationId } };
  }

  static async getPendingAlerts(principal: AiAgentPrincipal) {
    staff(principal, 'ODONTOLOGO', 'RECEPCION', 'ADMIN');
    const where = principal.role === 'ODONTOLOGO' ? { id_profesional: principal.idProfesional, estado: ACTIVE_ALERT_STATES } : principal.role === 'RECEPCION' ? { tipo_evento: { in: ['AL-C04', 'AL-C05'] }, estado: ACTIVE_ALERT_STATES } : { estado: ACTIVE_ALERT_STATES };
    const rows = await prisma.alertasIA.findMany({ where, orderBy: { fecha_hora: 'desc' }, take: 100 });
    return { success: true, data: rows.map(a => ({ alertId: a.id_alerta_ia, type: a.tipo_evento, message: a.mensaje_alerta, severity: a.severidad, status: a.estado, patientId: a.id_persona, treatmentId: a.id_tratamiento, sessionId: a.id_sesion, attentionId: a.id_atencion, createdAt: a.fecha_hora.toISOString() })), meta: { source: 'NexoSaludDB' as const, correlationId: correlation() } };
  }

  static async reviewAlert(principal: AiAgentPrincipal, alertId: number, status: string, result: string) {
    if (!result?.trim() || result.length > 200) throw new AiAgentError('INVALID_INPUT', 'La revisión requiere evidencia de hasta 200 caracteres.');
    if (![...alertReviewStatuses, 'Resuelta'].includes(status)) throw new AiAgentError('INVALID_INPUT', 'El estado de revisión de alerta no es válido.');
    const alert = await prisma.alertasIA.findUnique({ where: { id_alerta_ia: alertId } }); if (!alert) throw new AiAgentError('NOT_FOUND', 'Alerta no encontrada.');
    if (principal.role === 'ODONTOLOGO') { if (alert.id_profesional && alert.id_profesional !== principal.idProfesional) throw new AiAgentError('FORBIDDEN', 'La alerta no pertenece al profesional autenticado.'); if (alert.id_atencion) await attentionForPrincipal(alert.id_atencion, principal); else if (alert.id_tratamiento) await treatmentForPrincipal(alert.id_tratamiento, principal); else throw new AiAgentError('FORBIDDEN', 'La alerta no tiene un recurso clínico verificable para este profesional.'); }
    else {
      staff(principal, 'RECEPCION', 'ADMIN');
      if (principal.role === 'RECEPCION' && !['AL-C04', 'AL-C05'].includes(alert.tipo_evento)) throw new AiAgentError('FORBIDDEN', 'Recepción solo puede gestionar alertas operativas.');
    }
    if (!alertTransitions[alert.estado]?.includes(status)) throw new AiAgentError('CONFLICT', 'La alerta ya no admite esa transición.');
    const updated = await CustomerAiPersistenceService.atenderAlerta({ idAlerta: alertId, idUsuarioRevisor: principal.idUsuario, idProfesionalRevisor: principal.idProfesional, estado: status as typeof alertReviewStatuses[number] | 'Resuelta', estadoAnterior: alert.estado, resultado: result.trim() });
    return { success: true, data: { alertId: updated.id_alerta_ia, status: updated.estado, reviewedAt: updated.fecha_atencion_alerta?.toISOString() ?? null }, meta: { source: 'NexoSaludDB' as const, correlationId: correlation() } };
  }

  static async prepareDocumentationDraft(principal: AiAgentPrincipal, attentionId: number, idempotencyKey?: string) {
    staff(principal, 'ODONTOLOGO');
    const attention = await attentionForPrincipal(attentionId, principal);
    const professionalId = principal.idProfesional!;
    if (idempotencyKey) {
      const existing = await prisma.borradoresIA.findFirst({ where: { clave_idempotencia: idempotencyKey, id_atencion: attentionId }, orderBy: { id_borrador_ia: 'desc' } });
      if (existing) return { success: true, data: { draftId: existing.id_borrador_ia, rootId: existing.id_borrador_raiz, version: existing.version_borrador, status: existing.estado, requiresHumanReview: true, content: existing.contenido_sugerido, idempotent: true }, meta: { source: 'NexoSaludDB' as const, correlationId: correlation() } };
    }
    const formattedDate = formatSpanishDate(attention.fecha_atencion);
    const serviceName = attention.Servicio?.nombre || 'Consulta Odontológica';
    const content = [
      `INDICACIONES POSTATENCIÓN Y PLAN DE CUIDADOS`,
      `Atención Clínica: #${attention.id_atencion} · Fecha: ${formattedDate}`,
      `Servicio: ${serviceName}`,
      `Procedimiento Realizado: ${attention.procedimiento || attention.procedimiento_realizado || 'Evaluación y tratamiento odontológico'}`,
      ``,
      `1. DIRECTIVAS Y CUIDADOS GENERALES:`,
      `- No ingerir alimentos calientes, duros ni irritantes durante las primeras 2 a 4 horas.`,
      `- Mantener reposo relativo el día de hoy; evitar esfuerzos físicos intensos y exposición solar prolongada.`,
      `- Higiene oral con técnica de cepillado suave en la zona tratada; no realizar enjuagues bucales enérgicos.`,
      `- Evitar el consumo de tabaco o alcohol durante las 24 horas siguientes al procedimiento.`,
      ``,
      `2. EVOLUCIÓN Y OBSERVACIONES CLÍNICAS:`,
      `${attention.observaciones || attention.evaluacion || 'Paciente evoluciona favorablemente sin complicaciones intraoperatorias.'}`,
      ``,
      `3. PAUTA DE ALERTA MÉDICA:`,
      `- En caso de sangrado persistente, inflamación creciente o dolor agudo que no ceda con analgésicos habituales, comuníquese de inmediato a la central de urgencias de NexoSalud.`
    ].join('\n');
    const correlationId = correlation();
    let draft;
    try {
      draft = await CustomerAiPersistenceService.registrarBorrador({ idPersona: attention.id_persona, idProfesional: professionalId, idAtencion: attention.id_atencion, idTratamiento: attention.id_tratamiento, idSesion: attention.id_sesion, contenidoSugerido: content, tipoEvento: 'BORRADOR_RESUMEN_DOCUMENTAL', claveIdempotencia: idempotencyKey || null, eventoAuditoria: { actorOrientado: 'ODONTOLOGO', idUsuario: principal.idUsuario, idCorrelacion: correlationId, tipoEvento: 'BORRADOR_DOCUMENTAL_CREADO', resultado: 'Borrador documental generado; requiere revisión humana' } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002' && idempotencyKey) {
        const duplicate = await prisma.borradoresIA.findFirst({ where: { clave_idempotencia: idempotencyKey, id_atencion: attentionId }, orderBy: { id_borrador_ia: 'desc' } });
        if (duplicate) return { success: true, data: { draftId: duplicate.id_borrador_ia, rootId: duplicate.id_borrador_raiz, version: duplicate.version_borrador, status: duplicate.estado, requiresHumanReview: true, content: duplicate.contenido_sugerido, idempotent: true }, meta: { source: 'NexoSaludDB' as const, correlationId: correlation() } };
      }
      throw error;
    }
    return { success: true, data: { draftId: draft.id_borrador_ia, rootId: draft.id_borrador_raiz, version: draft.version_borrador, status: draft.estado, requiresHumanReview: true, content: draft.contenido_sugerido, idempotent: false }, meta: { source: 'NexoSaludDB' as const, correlationId } };
  }

  static async getDraftsForAttention(principal: AiAgentPrincipal, attentionId: number) {
    staff(principal, 'ODONTOLOGO', 'ADMIN');
    await attentionForPrincipal(attentionId, principal);
    const rows = await prisma.borradoresIA.findMany({
      where: { id_atencion: attentionId },
      orderBy: { version_borrador: 'desc' },
      select: {
        id_borrador_ia: true,
        id_borrador_raiz: true,
        version_borrador: true,
        estado: true,
        fecha_hora: true,
        id_indicacion_vinculada: true
      }
    });
    return {
      success: true,
      data: rows.map(r => ({
        draftId: r.id_borrador_ia,
        rootId: r.id_borrador_raiz,
        version: r.version_borrador,
        status: Boolean(r.id_indicacion_vinculada) ? 'Emitido' : r.estado,
        createdAt: r.fecha_hora.toISOString(),
        isIssued: Boolean(r.id_indicacion_vinculada)
      })),
      meta: { source: 'NexoSaludDB' as const, correlationId: correlation() }
    };
  }

  private static async authorizedDraft(principal: AiAgentPrincipal, draftId: number) {
    const draft = await prisma.borradoresIA.findUnique({ where: { id_borrador_ia: draftId } }); if (!draft) throw new AiAgentError('NOT_FOUND', 'Borrador no encontrado.');
    if (principal.role === 'ODONTOLOGO') { await attentionForPrincipal(draft.id_atencion, principal); if (draft.id_profesional !== principal.idProfesional) throw new AiAgentError('FORBIDDEN', 'El borrador no pertenece al profesional autenticado.'); }
    else if (principal.role !== 'ADMIN') throw new AiAgentError('FORBIDDEN', 'El perfil no puede consultar borradores.');
    return draft;
  }

  static async getDocumentDraft(principal: AiAgentPrincipal, draftId: number) { 
    const draft = await this.authorizedDraft(principal, draftId); 
    const isIssued = Boolean(draft.id_indicacion_vinculada);
    return { 
      success: true, 
      data: {
        draftId: draft.id_borrador_ia,
        rootId: draft.id_borrador_raiz,
        version: draft.version_borrador,
        status: isIssued ? 'Emitido' : draft.estado,
        requiresHumanReview: draft.requiere_revision_humana,
        content: draft.contenido_sugerido,
        idempotent: false,
        isIssued,
        indicationId: draft.id_indicacion_vinculada,
        reason: draft.resultado
      }, 
      meta: { source: 'NexoSaludDB' as const, correlationId: correlation() } 
    }; 
  }

  static async reviseDocumentationDraft(principal: AiAgentPrincipal, draftId: number, content: string) {
    if (!content?.trim() || content.length > 10000) throw new AiAgentError('INVALID_INPUT', 'El contenido del borrador no es válido.');
    const draft = await this.authorizedDraft(principal, draftId); if (!['Generado', 'Rechazado'].includes(draft.estado)) throw new AiAgentError('CONFLICT', 'Solo se puede revisar un borrador no aprobado.');
    const rootId = draft.id_borrador_raiz || draft.id_borrador_ia; const latest = await prisma.borradoresIA.findFirst({ where: { OR: [{ id_borrador_ia: rootId }, { id_borrador_raiz: rootId }], es_version_actual: true }, orderBy: { version_borrador: 'desc' } });
    const correlationId = correlation();
    const revision = await CustomerAiPersistenceService.registrarBorrador({ idPersona: draft.id_persona, idProfesional: draft.id_profesional, idAtencion: draft.id_atencion, idTratamiento: draft.id_tratamiento, idSesion: draft.id_sesion, contenidoSugerido: content.trim(), tipoEvento: draft.tipo_evento, idBorradorRaiz: rootId, versionBorrador: (latest?.version_borrador || draft.version_borrador) + 1, eventoAuditoria: { actorOrientado: 'ODONTOLOGO', idUsuario: principal.idUsuario, idCorrelacion: correlationId, tipoEvento: 'BORRADOR_DOCUMENTAL_REVISION', resultado: `Nueva versión documental ${draft.version_borrador + 1}` } });
    return { success: true, data: { draftId: revision.id_borrador_ia, rootId: revision.id_borrador_raiz, version: revision.version_borrador, status: revision.estado }, meta: { source: 'NexoSaludDB' as const, correlationId } };
  }

  static async approveDocumentationDraft(principal: AiAgentPrincipal, draftId: number, corrected = false) {
    staff(principal, 'ODONTOLOGO'); const draft = await this.authorizedDraft(principal, draftId); const professional = await prisma.profesionales.findUnique({ where: { id_profesional: principal.idProfesional }, select: { activo: true, numero_colegiatura: true } });
    if (!professional?.activo || !professional.numero_colegiatura) throw new AiAgentError('FORBIDDEN', 'El profesional no está habilitado para aprobar.');
    const correlationId = correlation();
    const approved = await prisma.$transaction(async tx => {
      const interaction = await tx.interaccionesIA.create({ data: { id_persona: draft.id_persona, id_profesional: principal.idProfesional, id_usuario_revisor: principal.idUsuario ?? null, id_tratamiento: draft.id_tratamiento, id_sesion: draft.id_sesion, id_atencion: draft.id_atencion, actor_orientado: 'ODONTOLOGO', tipo_evento: 'BORRADOR_DOCUMENTAL_APROBADO', resumen_consulta: `Aprobación de borrador ${draftId}, versión ${draft.version_borrador}`, resultado: corrected ? 'Aprobado con correcciones por odontólogo' : 'Aprobado formalmente por odontólogo', id_correlacion: correlationId, version_agente: draft.version_agente } });
      const result = await tx.borradoresIA.updateMany({ where: { id_borrador_ia: draft.id_borrador_ia, es_version_actual: true, estado: { in: ['Generado', 'Corregido'] } }, data: { estado: corrected ? 'Corregido_Y_Aprobado' : 'Aprobado', id_profesional_aprobador: principal.idProfesional, id_usuario_revisor: principal.idUsuario ?? null, fecha_aprobacion: new Date(), resultado: corrected ? 'Aprobado con correcciones por odontólogo' : 'Aprobado formalmente por odontólogo', id_interaccion_origen: interaction.id_interaccion_ia } });
      if (!result.count) throw new AiAgentError('CONFLICT', 'La versión ya no es vigente o fue aprobada por otro proceso.');
      return tx.borradoresIA.findUniqueOrThrow({ where: { id_borrador_ia: draft.id_borrador_ia } });
    }, { isolationLevel: 'Serializable' });
    return { success: true, data: { draftId, rootId: approved.id_borrador_raiz, version: approved.version_borrador, status: approved.estado, issuedToPatient: false }, meta: { source: 'NexoSaludDB' as const, correlationId } };
  }

  static async issueDocumentationDraft(principal: AiAgentPrincipal, draftId: number) {
    staff(principal, 'ODONTOLOGO', 'ADMIN');
    const draft = await this.authorizedDraft(principal, draftId);
    if (!['Aprobado', 'Corregido_Y_Aprobado'].includes(draft.estado)) {
      throw new AiAgentError('CONFLICT', 'Solo se puede emitir al paciente un borrador previamente aprobado por un odontólogo.');
    }
    const professionalId = draft.id_profesional_aprobador || principal.idProfesional;
    if (!professionalId) throw new AiAgentError('FORBIDDEN', 'No hay profesional habilitado responsable de la emisión.');

    const correlationId = correlation();

    if (draft.id_indicacion_vinculada) {
      const existing = await prisma.indicacionesPostatencion.findUnique({
        where: { id_indicacion: draft.id_indicacion_vinculada }
      });
      if (existing) {
        return {
          success: true,
          data: {
            draftId,
            status: 'Emitido',
            issuedToPatient: true,
            indicationId: existing.id_indicacion,
            emittedAt: existing.fecha_emision?.toISOString() ?? null,
            idempotent: true
          },
          meta: { source: 'NexoSaludDB' as const, correlationId }
        };
      }
    }

    const emitted = await prisma.$transaction(async tx => {
      const now = new Date();
      const indication = await tx.indicacionesPostatencion.create({
        data: {
          id_atencion: draft.id_atencion,
          version: draft.version_borrador,
          es_version_vigente: true,
          estado: 'Documento emitido',
          contenido_indicaciones: draft.contenido_sugerido,
          origen_documento: 'COPILOTO_IA',
          id_profesional_aprobador: professionalId,
          fecha_aprobacion: draft.fecha_aprobacion || now,
          fecha_emision: now,
          fecha_creacion: draft.fecha_hora
        }
      });

      await tx.indicacionesPostatencion.updateMany({
        where: {
          id_atencion: draft.id_atencion,
          id_indicacion: { not: indication.id_indicacion },
          es_version_vigente: true
        },
        data: { es_version_vigente: false }
      });

      await tx.borradoresIA.update({
        where: { id_borrador_ia: draft.id_borrador_ia },
        data: {
          id_indicacion_vinculada: indication.id_indicacion,
          resultado: 'Borrador aprobado y emitido formalmente al paciente'
        }
      });

      await tx.interaccionesIA.create({
        data: {
          id_persona: draft.id_persona,
          id_profesional: professionalId,
          id_usuario_revisor: principal.idUsuario ?? null,
          id_tratamiento: draft.id_tratamiento,
          id_sesion: draft.id_sesion,
          id_atencion: draft.id_atencion,
          actor_orientado: 'ODONTOLOGO',
          tipo_evento: 'BORRADOR_DOCUMENTAL_EMITIDO',
          resumen_consulta: `Emisión formal de borrador ${draftId} a indicaciones postatención ${indication.id_indicacion}`,
          resultado: 'Documento emitido y disponible para el paciente',
          id_correlacion: correlationId,
          version_agente: draft.version_agente
        }
      });

      return indication;
    }, { isolationLevel: 'Serializable' });

    return {
      success: true,
      data: {
        draftId,
        status: 'Emitido',
        issuedToPatient: true,
        indicationId: emitted.id_indicacion,
        emittedAt: emitted.fecha_emision?.toISOString() ?? null,
        idempotent: false
      },
      meta: { source: 'NexoSaludDB' as const, correlationId }
    };
  }

  static async rejectDocumentationDraft(principal: AiAgentPrincipal, draftId: number, reason: string) {
    staff(principal, 'ODONTOLOGO'); if (!reason?.trim()) throw new AiAgentError('INVALID_INPUT', 'El rechazo requiere una justificación.'); const draft = await this.authorizedDraft(principal, draftId);
    if (reason.length > 180) throw new AiAgentError('INVALID_INPUT', 'La justificación excede el máximo permitido.');
    const correlationId = correlation();
    await prisma.$transaction(async tx => {
      const interaction = await tx.interaccionesIA.create({ data: { id_persona: draft.id_persona, id_profesional: principal.idProfesional, id_usuario_revisor: principal.idUsuario ?? null, id_tratamiento: draft.id_tratamiento, id_sesion: draft.id_sesion, id_atencion: draft.id_atencion, actor_orientado: 'ODONTOLOGO', tipo_evento: 'BORRADOR_DOCUMENTAL_RECHAZADO', resumen_consulta: `Rechazo de borrador ${draftId}, versión ${draft.version_borrador}`, resultado: reason.trim(), id_correlacion: correlationId, version_agente: draft.version_agente } });
      const result = await tx.borradoresIA.updateMany({ where: { id_borrador_ia: draft.id_borrador_ia, es_version_actual: true, estado: { in: ['Generado', 'Corregido'] } }, data: { estado: 'Rechazado', id_usuario_revisor: principal.idUsuario ?? null, fecha_aprobacion: new Date(), resultado: `Rechazado: ${reason.trim()}`, id_interaccion_origen: interaction.id_interaccion_ia } });
      if (!result.count) throw new AiAgentError('CONFLICT', 'La versión ya no es vigente.');
    }, { isolationLevel: 'Serializable' });
    return { success: true, data: { draftId, status: 'Rechazado', reason: reason.trim() }, meta: { source: 'NexoSaludDB' as const, correlationId } };
  }
}
