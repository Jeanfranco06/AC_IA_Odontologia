import crypto from 'crypto';
import { prisma } from '../../../../db';
import { CustomerAiPersistenceService } from '../../../../services/customerAiPersistenceService';
import { treatmentForPrincipal, attentionForPrincipal } from '../policies';
import { AiAgentError, AiAgentPrincipal, SessionQuery, ToolResponse } from '../types';

const meta = (correlationId: string) => ({ source: 'NexoSaludDB' as const, correlationId });
const correlation = () => crypto.randomUUID();
const dateOrNull = (value: Date | null | undefined) => value?.toISOString() ?? null;
const completed = ['Completada', 'Completado', 'Finalizada', 'Finalizado'];
export interface QueryOptions { audit?: boolean; }

async function audit(principal: AiAgentPrincipal, type: string, correlationId: string, idPersona?: number, idTratamiento?: number, idAtencion?: number) {
  if (!idPersona) return;
  await CustomerAiPersistenceService.registrarInteraccion({ idPersona, actorOrientado: principal.role === 'ODONTOLOGO' ? 'ODONTOLOGO' : 'PACIENTE', tipoEvento: type, resumenConsulta: `Consulta determinista ${type}`, idTratamiento, idAtencion, idProfesional: principal.idProfesional, idCorrelacion: correlationId });
}

export class CustomerAiQueryService {
  static async getPatientTreatments(principal: AiAgentPrincipal, options: QueryOptions = {}): Promise<ToolResponse<unknown[]>> {
    if (principal.role !== 'PACIENTE' || !principal.idPersona) throw new AiAgentError('FORBIDDEN', 'Solo un paciente puede consultar sus tratamientos.');
    const id = correlation();
    const rows = await prisma.tratamientosContratados.findMany({ where: { id_persona: principal.idPersona }, include: { Servicios: true, Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales: true, SesionesTratamiento: { orderBy: { fecha_programada_vigente: 'asc' } } }, orderBy: { fecha_contratacion: 'desc' } });
    if (options.audit !== false) await audit(principal, 'CONSULTA_TRATAMIENTOS', id, principal.idPersona);
    return { success: true, data: rows.map(t => ({ treatmentId: t.id_tratamiento, serviceName: t.Servicios.nombre, status: t.estado_tratamiento, realStartDate: dateOrNull(t.fecha_inicio_real), responsibleProfessional: t.Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales ? `${t.Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales.nombres} ${t.Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales.apellidos}` : null, nextSessionDate: t.SesionesTratamiento.find(s => s.fecha_programada_vigente >= new Date() && !['Cancelada', 'Cancelado'].includes(s.estado_programacion))?.fecha_programada_vigente.toISOString() ?? null, plannedSessions: t.SesionesTratamiento.length, completedSessions: t.SesionesTratamiento.filter(s => completed.includes(s.estado_asistencial) || completed.includes(s.estado_cierre)).length })), meta: meta(id) };
  }

  static async getTreatmentDetail(principal: AiAgentPrincipal, idTratamiento: number, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    const id = correlation(); const t = await treatmentForPrincipal(idTratamiento, principal);
    const plan = await prisma.planTratamiento.findFirst({ where: { id_tratamiento: idTratamiento, es_vigente: true }, orderBy: { version_plan: 'desc' } });
    const sessions = await prisma.sesionesTratamiento.findMany({ where: { id_tratamiento: idTratamiento } });
    if (options.audit !== false) await audit(principal, 'CONSULTA_DETALLE_TRATAMIENTO', id, t.id_persona, idTratamiento);
    return { success: true, data: { treatmentId: t.id_tratamiento, serviceName: t.Servicios.nombre, status: t.estado_tratamiento, clinicalPlan: plan ? { version: plan.version_plan, status: plan.estado_plan } : null, plannedSessions: plan?.sesiones_planificadas ?? null, completedSessions: sessions.filter(s => completed.includes(s.estado_asistencial) || completed.includes(s.estado_cierre)).length, lastSession: sessions.filter(s => completed.includes(s.estado_asistencial) || completed.includes(s.estado_cierre)).sort((a, b) => b.fecha_programada_vigente.getTime() - a.fecha_programada_vigente.getTime())[0]?.fecha_programada_vigente.toISOString() ?? null, nextSession: sessions.filter(s => s.fecha_programada_vigente >= new Date() && !['Cancelada', 'Cancelado'].includes(s.estado_programacion)).sort((a, b) => a.fecha_programada_vigente.getTime() - b.fecha_programada_vigente.getTime())[0]?.fecha_programada_vigente.toISOString() ?? null, continuityStatus: t.estado_tratamiento }, meta: meta(id) };
  }

  static async getTreatmentSessions(principal: AiAgentPrincipal, idTratamiento: number, query: SessionQuery = {}, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    const id = correlation(); const t = await treatmentForPrincipal(idTratamiento, principal); const page = query.page ?? 1; const pageSize = query.pageSize ?? 50;
    const where = { id_tratamiento: idTratamiento, ...(query.from || query.to ? { fecha_programada_vigente: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}) };
    const [rows, total] = await Promise.all([prisma.sesionesTratamiento.findMany({ where, include: { Profesionales: true, Sedes: true }, orderBy: { fecha_programada_vigente: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }), prisma.sesionesTratamiento.count({ where })]);
    if (options.audit !== false) await audit(principal, 'CONSULTA_SESIONES_TRATAMIENTO', id, t.id_persona, idTratamiento);
    return { success: true, data: { items: rows.map(s => ({ sessionId: s.id_sesion, number: s.numero_sesion, date: s.fecha_programada_vigente.toISOString(), schedulingStatus: s.estado_programacion, careStatus: s.estado_asistencial, closureStatus: s.estado_cierre, professional: `${s.Profesionales.nombres} ${s.Profesionales.apellidos}`, branch: s.Sedes.nombre })), page, pageSize, total }, meta: meta(id) };
  }

  static async getUpcomingSessions(principal: AiAgentPrincipal, options: QueryOptions = {}): Promise<ToolResponse<unknown[]>> {
    if (principal.role !== 'PACIENTE' || !principal.idPersona) throw new AiAgentError('FORBIDDEN', 'Solo un paciente puede consultar sus próximas sesiones.');
    const id = correlation(); const rows = await prisma.sesionesTratamiento.findMany({ where: { TratamientosContratados: { id_persona: principal.idPersona }, fecha_programada_vigente: { gte: new Date() }, estado_programacion: { in: ['Programada', 'Confirmada'] } }, include: { TratamientosContratados: { include: { Servicios: true } }, Profesionales: true, Sedes: true }, orderBy: { fecha_programada_vigente: 'asc' } });
    if (options.audit !== false) await audit(principal, 'CONSULTA_PROXIMAS_SESIONES', id, principal.idPersona);
    return { success: true, data: rows.map(s => ({ treatmentId: s.id_tratamiento, serviceName: s.TratamientosContratados.Servicios.nombre, date: s.fecha_programada_vigente.toISOString(), professional: `${s.Profesionales.nombres} ${s.Profesionales.apellidos}`, branch: s.Sedes.nombre, status: s.estado_programacion })), meta: meta(id) };
  }

  static async getTreatmentProgress(principal: AiAgentPrincipal, idTratamiento: number, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    const id = correlation(); const t = await treatmentForPrincipal(idTratamiento, principal); const plan = await prisma.planTratamiento.findFirst({ where: { id_tratamiento: idTratamiento, es_vigente: true }, orderBy: { version_plan: 'desc' } }); const sessions = await prisma.sesionesTratamiento.findMany({ where: { id_tratamiento: idTratamiento }, orderBy: { fecha_programada_vigente: 'desc' } });
    const completedCount = sessions.filter(s => completed.includes(s.estado_asistencial) || completed.includes(s.estado_cierre)).length; const planned = plan?.sesiones_planificadas && plan.sesiones_planificadas > 0 ? plan.sesiones_planificadas : null;
    if (options.audit !== false) await audit(principal, 'CONSULTA_PROGRESO_OPERATIVO', id, t.id_persona, idTratamiento);
    return { success: true, data: { plannedSessions: planned, completedSessions: completedCount, pendingSessions: planned === null ? null : Math.max(planned - completedCount, 0), noShows: sessions.filter(s => ['Inasistida', 'No asistió', 'No asiste'].includes(s.estado_asistencial)).length, lastAttention: sessions.find(s => completed.includes(s.estado_asistencial) || completed.includes(s.estado_cierre))?.fecha_programada_vigente.toISOString() ?? null, currentStatus: t.estado_tratamiento, operationalProgressPercent: planned === null ? null : Number(((completedCount / planned) * 100).toFixed(2)), progressMeaning: 'Avance operativo de sesiones; no representa progreso clínico.' }, meta: meta(id) };
  }

  static async getApprovedAftercareInstructions(principal: AiAgentPrincipal, idAtencion: number, options: QueryOptions = {}): Promise<ToolResponse<unknown[]>> {
    const id = correlation(); const a = await attentionForPrincipal(idAtencion, principal); const rows = await prisma.indicacionesPostatencion.findMany({ where: { id_atencion: idAtencion, estado: { in: ['Aprobado', 'Emitido', 'Vigente'] }, es_version_vigente: true, fecha_aprobacion: { not: null }, fecha_emision: { not: null } }, orderBy: { version: 'desc' }, select: { id_indicacion: true, version: true, estado: true, contenido_indicaciones: true, fecha_aprobacion: true, fecha_emision: true } });
    if (options.audit !== false) await audit(principal, 'CONSULTA_INDICACIONES_APROBADAS', id, a.id_persona, a.id_tratamiento ?? undefined, idAtencion); return { success: true, data: rows.map(r => ({ instructionId: r.id_indicacion, version: r.version, status: r.estado, content: r.contenido_indicaciones, approvedAt: r.fecha_aprobacion?.toISOString(), issuedAt: r.fecha_emision?.toISOString() })), meta: meta(id) };
  }

  static async getAuthorizedClinicalContext(principal: AiAgentPrincipal, idAtencion: number, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    if (principal.role !== 'ODONTOLOGO' && principal.role !== 'ADMIN') throw new AiAgentError('FORBIDDEN', 'El contexto clínico requiere perfil odontólogo autorizado.'); const id = correlation(); const a = await attentionForPrincipal(idAtencion, principal); const background = await prisma.antecedentesClinicos.findMany({ where: { id_persona: a.id_persona }, select: { categoria_antecedente: true, descripcion_antecedente: true, estado_verificacion: true } }); const previous = await prisma.atenciones.findMany({ where: { id_persona: a.id_persona, id_atencion: { not: idAtencion } }, select: { id_atencion: true, fecha_atencion: true, procedimiento: true, estado_servicio: true }, orderBy: { fecha_atencion: 'desc' }, take: 10 });
    if (options.audit !== false) await audit(principal, 'CONSULTA_CONTEXTO_CLINICO', id, a.id_persona, a.id_tratamiento ?? undefined, idAtencion); return { success: true, data: { patientId: a.id_persona, relevantBackground: background.map(b => ({ category: b.categoria_antecedente, description: b.descripcion_antecedente, verificationStatus: b.estado_verificacion })), currentTreatment: a.TratamientosContratados ? { treatmentId: a.TratamientosContratados.id_tratamiento, status: a.TratamientosContratados.estado_tratamiento } : null, currentAttention: { reason: a.motivo_consulta, allergies: a.alergias, allergiesStatus: a.alergias ? 'DOCUMENTADA' : 'NO_REGISTRADA', procedure: a.procedimiento, pendingVerification: !a.evaluacion || !a.procedimiento ? ['evaluacion/procedimiento pendiente de verificar'] : [] }, previousAttentions: previous, clinicalDisclaimer: 'Contexto documental; no constituye diagnóstico ni recomendación terapéutica.' }, meta: meta(id) };
  }

  static async getClinicalDocumentationStatus(principal: AiAgentPrincipal, idAtencion: number, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    const id = correlation(); const a = await attentionForPrincipal(idAtencion, principal); const validations = await prisma.validacionesFicha.findMany({ where: { id_atencion: idAtencion }, orderBy: { numero_revision: 'asc' } }); const instructions = await prisma.indicacionesPostatencion.findMany({ where: { id_atencion: idAtencion, estado: { in: ['Borrador', 'Pendiente_Aprobacion'] } }, select: { id_indicacion: true, estado: true } }); if (options.audit !== false) await audit(principal, 'CONSULTA_ESTADO_DOCUMENTAL', id, a.id_persona, a.id_tratamiento ?? undefined, idAtencion);
    return { success: true, data: { attentionId: idAtencion, hasClinicalFile: Boolean(a.motivo_consulta || a.evaluacion || a.procedimiento), firstValidation: validations[0] ? { result: validations[0].resultado_validacion, date: validations[0].fecha_revision.toISOString() } : null, lastValidation: validations.at(-1) ? { result: validations.at(-1)!.resultado_validacion, date: validations.at(-1)!.fecha_revision.toISOString(), pendingFields: validations.at(-1)!.campos_pendientes } : null, closureStatus: a.estado_cierre_documental, pendingInstructions: instructions }, meta: meta(id) };
  }

  static async getAuthorizedAiRecords(principal: AiAgentPrincipal, query: SessionQuery = {}, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    if (!principal.idPersona && principal.role !== 'ADMIN') throw new AiAgentError('FORBIDDEN', 'No existe un ámbito de paciente autorizado.'); const id = correlation(); const alertWhere = principal.role === 'ADMIN' ? {} : principal.role === 'PACIENTE' ? { id_persona: principal.idPersona } : { id_profesional: principal.idProfesional }; const interactionWhere = principal.role === 'ADMIN' ? {} : { id_persona: principal.idPersona }; const draftWhere = principal.role === 'ADMIN' ? {} : { id_persona: principal.idPersona, ...(principal.role === 'PACIENTE' ? { estado: { in: ['Aprobado', 'Corregido_Y_Aprobado'] } } : {}) }; const [alerts, drafts, interactions] = await Promise.all([prisma.alertasIA.findMany({ where: alertWhere, select: { id_alerta_ia: true, id_persona: true, tipo_evento: true, severidad: true, estado: true, fecha_hora: true }, take: query.pageSize ?? 50 }), prisma.borradoresIA.findMany({ where: draftWhere, select: { id_borrador_ia: true, id_persona: true, estado: true, fecha_creacion: true }, take: query.pageSize ?? 50 }), prisma.interaccionesIA.findMany({ where: interactionWhere, select: { id_interaccion_ia: true, id_persona: true, tipo_evento: true, estado: true, fecha_hora: true }, take: query.pageSize ?? 50 })]); if (options.audit !== false) await audit(principal, 'CONSULTA_REGISTROS_IA', id, principal.idPersona); return { success: true, data: { alerts: principal.role === 'PACIENTE' ? [] : alerts, drafts: drafts, interactions }, meta: meta(id) };
  }
}
