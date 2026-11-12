import crypto from 'crypto';
import { prisma } from '../../../../db';
import { CustomerAiPersistenceService } from '../../../../services/customerAiPersistenceService';
import { treatmentForPrincipal, attentionForPrincipal } from '../policies';
import { AiAgentError, AiAgentPrincipal, SessionQuery, ToolResponse } from '../types';
import { auditCustomer } from './customerCompletionService';

const meta = (correlationId: string) => ({ source: 'NexoSaludDB' as const, correlationId });
const correlation = () => crypto.randomUUID();
const dateOrNull = (value: Date | null | undefined) => value?.toISOString() ?? null;
// Misma definición administrativa que Fact_TratamientoCustomer; asistir no equivale a cerrar.
export function isSessionCompleted(s: { estado_asistencial?: string | null; estado_cierre?: string | null }): boolean {
  return s.estado_asistencial === 'Realizada' && s.estado_cierre === 'Cerrada';
}

export interface QueryOptions { audit?: boolean; }

async function audit(principal: AiAgentPrincipal, type: string, correlationId: string, idPersona?: number, idTratamiento?: number, idAtencion?: number) {
  if (principal.role!=='PACIENTE') { await auditCustomer(principal,type,{personId:idPersona,treatmentId:idTratamiento,attentionId:idAtencion},'Completada',correlationId); return; }
  if (!idPersona) { if(principal.idUsuario)await auditCustomer(principal,type,{treatmentId:idTratamiento,attentionId:idAtencion},'Completada',correlationId); return; }
  await CustomerAiPersistenceService.registrarInteraccion({ idPersona, actorOrientado: 'PACIENTE', tipoEvento: type, resumenConsulta: `Consulta determinista ${type}`, idTratamiento, idAtencion, idProfesional: principal.idProfesional, idCorrelacion: correlationId });
}

export class CustomerAiQueryService {
  static async getPatientTreatments(principal: AiAgentPrincipal, options: QueryOptions = {}): Promise<ToolResponse<unknown[]>> {
    if (principal.role !== 'PACIENTE' || !principal.idPersona) throw new AiAgentError('FORBIDDEN', 'Solo un paciente puede consultar sus tratamientos.');
    const id = correlation();
    const rows = await prisma.tratamientosContratados.findMany({
      where: { id_persona: principal.idPersona },
      include: {
        Servicios: true,
        Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales: true,
        PlanTratamiento: { where: { es_vigente: true }, orderBy: { version_plan: 'desc' }, take: 1 },
        SesionesTratamiento: {
          include: { Atenciones: true },
          orderBy: { fecha_programada_vigente: 'asc' }
        }
      },
      orderBy: { fecha_contratacion: 'desc' }
    });
    if (options.audit !== false) await audit(principal, 'CONSULTA_TRATAMIENTOS', id, principal.idPersona);
    return {
      success: true,
      data: rows.map(t => {
        const planned = t.PlanTratamiento[0]?.sesiones_planificadas && t.PlanTratamiento[0].sesiones_planificadas > 0
          ? t.PlanTratamiento[0].sesiones_planificadas
          : 0;
        const completedCount = t.SesionesTratamiento.filter(isSessionCompleted).length;
        const nextSession = t.SesionesTratamiento.find(s => !isSessionCompleted(s) && !['Cancelada', 'Cancelado'].includes(s.estado_programacion));
        return {
          treatmentId: t.id_tratamiento,
          serviceName: t.Servicios.nombre,
          status: t.estado_tratamiento,
          realStartDate: dateOrNull(t.fecha_inicio_real),
          responsibleProfessional: t.Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales ? `${t.Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales.nombres} ${t.Profesionales_TratamientosContratados_id_profesional_responsableToProfesionales.apellidos}` : null,
          nextSessionDate: nextSession ? nextSession.fecha_programada_vigente.toISOString() : null,
          plannedSessions: planned,
          completedSessions: completedCount
        };
      }),
      meta: meta(id)
    };
  }

  static async getTreatmentDetail(principal: AiAgentPrincipal, idTratamiento: number, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    const id = correlation(); const t = await treatmentForPrincipal(idTratamiento, principal);
    const plan = await prisma.planTratamiento.findFirst({ where: { id_tratamiento: idTratamiento, es_vigente: true }, orderBy: { version_plan: 'desc' } });
    const sessions = await prisma.sesionesTratamiento.findMany({ where: { id_tratamiento: idTratamiento }, include: { Atenciones: true } });
    if (options.audit !== false) await audit(principal, 'CONSULTA_DETALLE_TRATAMIENTO', id, t.id_persona, idTratamiento);
    const completedCount = sessions.filter(isSessionCompleted).length;
    const lastSession = sessions.filter(isSessionCompleted).sort((a, b) => b.fecha_programada_vigente.getTime() - a.fecha_programada_vigente.getTime())[0]?.fecha_programada_vigente.toISOString() ?? null;
    const nextSession = sessions.filter(s => !isSessionCompleted(s) && !['Cancelada', 'Cancelado'].includes(s.estado_programacion)).sort((a, b) => a.fecha_programada_vigente.getTime() - b.fecha_programada_vigente.getTime())[0]?.fecha_programada_vigente.toISOString() ?? null;
    return {
      success: true,
      data: {
        treatmentId: t.id_tratamiento,
        serviceName: t.Servicios.nombre,
        status: t.estado_tratamiento,
        clinicalPlan: plan ? { version: plan.version_plan, status: plan.estado_plan } : null,
        plannedSessions: plan?.sesiones_planificadas ?? 0,
        completedSessions: completedCount,
        lastSession,
        nextSession,
        continuityStatus: t.estado_tratamiento
      },
      meta: meta(id)
    };
  }

  static async getTreatmentSessions(principal: AiAgentPrincipal, idTratamiento: number, query: SessionQuery = {}, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    const id = correlation(); const t = await treatmentForPrincipal(idTratamiento, principal); const page = query.page ?? 1; const pageSize = query.pageSize ?? 50;
    const where = { id_tratamiento: idTratamiento, ...(query.from || query.to ? { fecha_programada_vigente: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}) };
    const [rows, total] = await Promise.all([
      prisma.sesionesTratamiento.findMany({ where, include: { Profesionales: true, Sedes: true, Atenciones: true }, orderBy: { fecha_programada_vigente: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.sesionesTratamiento.count({ where })
    ]);
    if (options.audit !== false) await audit(principal, 'CONSULTA_SESIONES_TRATAMIENTO', id, t.id_persona, idTratamiento);
    return {
      success: true,
      data: {
        items: rows.map(s => {
          return {
            sessionId: s.id_sesion,
            number: s.numero_sesion,
            date: s.fecha_programada_vigente.toISOString(),
            schedulingStatus: s.estado_programacion,
            confirmationStatus: s.confirmacion_paciente,
            careStatus: s.estado_asistencial,
            closureStatus: s.estado_cierre,
            professional: `${s.Profesionales.nombres} ${s.Profesionales.apellidos}`,
            branch: s.Sedes.nombre
          };
        }),
        page,
        pageSize,
        total
      },
      meta: meta(id)
    };
  }

  static async getUpcomingSessions(principal: AiAgentPrincipal, options: QueryOptions = {}): Promise<ToolResponse<unknown[]>> {
    if (principal.role !== 'PACIENTE' || !principal.idPersona) throw new AiAgentError('FORBIDDEN', 'Solo un paciente puede consultar sus próximas sesiones.');
    const id = correlation();
    const rows = await prisma.sesionesTratamiento.findMany({
      where: {
        TratamientosContratados: { id_persona: principal.idPersona },
        fecha_programada_vigente: { gte: new Date() },
        estado_programacion: { in: ['Programada', 'Confirmada', 'Reprogramada'] }
      },
      include: {
        TratamientosContratados: { include: { Servicios: true } },
        Profesionales: true,
        Sedes: true,
        Atenciones: true
      },
      orderBy: { fecha_programada_vigente: 'asc' }
    });
    if (options.audit !== false) await audit(principal, 'CONSULTA_PROXIMAS_SESIONES', id, principal.idPersona);
    const upcoming = rows.filter(s => !isSessionCompleted(s));
    return {
      success: true,
      data: upcoming.map(s => ({
        treatmentId: s.id_tratamiento,
        serviceName: s.TratamientosContratados.Servicios.nombre,
        date: s.fecha_programada_vigente.toISOString(),
        professional: `${s.Profesionales.nombres} ${s.Profesionales.apellidos}`,
        branch: s.Sedes.nombre,
        status: s.estado_programacion
      })),
      meta: meta(id)
    };
  }

  static async getTreatmentProgress(principal: AiAgentPrincipal, idTratamiento: number, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    const id = correlation(); const t = await treatmentForPrincipal(idTratamiento, principal);
    const plan = await prisma.planTratamiento.findFirst({ where: { id_tratamiento: idTratamiento, es_vigente: true }, orderBy: { version_plan: 'desc' } });
    const sessions = await prisma.sesionesTratamiento.findMany({ where: { id_tratamiento: idTratamiento }, include: { Atenciones: true }, orderBy: { fecha_programada_vigente: 'desc' } });
    const completedCount = sessions.filter(isSessionCompleted).length;
    const planned = plan?.sesiones_planificadas && plan.sesiones_planificadas > 0 ? plan.sesiones_planificadas : 0;
    if (options.audit !== false) await audit(principal, 'CONSULTA_PROGRESO_OPERATIVO', id, t.id_persona, idTratamiento);
    return {
      success: true,
      data: {
        plannedSessions: planned,
        completedSessions: completedCount,
        pendingSessions: Math.max(planned - completedCount, 0),
        noShows: sessions.filter(s => ['Inasistida', 'No asistió', 'No asiste'].includes(s.estado_asistencial)).length,
        lastAttention: sessions.find(isSessionCompleted)?.fecha_programada_vigente.toISOString() ?? null,
        currentStatus: t.estado_tratamiento,
        operationalProgressPercent: planned > 0 ? Number(((completedCount / planned) * 100).toFixed(2)) : 0,
        inconsistencies: [...(!plan ? ['SIN_PLAN_VIGENTE'] : []), ...(completedCount > planned ? ['SESIONES_COMPLETADAS_EXCEDEN_PLAN'] : []), ...(sessions.some(session => plan && session.id_plan !== plan.id_plan) ? ['SESIONES_DE_OTRA_VERSION_PLAN'] : [])],
        progressMeaning: 'Avance operativo de sesiones; no representa progreso clínico.'
      },
      meta: meta(id)
    };
  }

  static async getApprovedAftercareInstructions(principal: AiAgentPrincipal, idAtencion: number, options: QueryOptions = {}): Promise<ToolResponse<unknown[]>> {
    const id = correlation(); const a = await attentionForPrincipal(idAtencion, principal);
    const rows = await prisma.indicacionesPostatencion.findMany({
      where: {
        id_atencion: idAtencion,
        estado: { in: ['Documento emitido', 'Documento aprobado', 'Emitido', 'Aprobado', 'Vigente'] },
        es_version_vigente: true,
        fecha_aprobacion: { not: null },
        fecha_emision: { not: null }
      },
      orderBy: { version: 'desc' },
      select: { id_indicacion: true, version: true, estado: true, contenido_indicaciones: true, fecha_aprobacion: true, fecha_emision: true }
    });
    if (options.audit !== false) await audit(principal, 'CONSULTA_INDICACIONES_APROBADAS', id, a.id_persona, a.id_tratamiento ?? undefined, idAtencion);
    return { 
      success: true, 
      data: rows.map(r => ({ 
        instructionId: r.id_indicacion, 
        id_indicacion: r.id_indicacion,
        id_atencion: idAtencion,
        version: r.version, 
        status: r.estado, 
        estado: r.estado,
        content: r.contenido_indicaciones, 
        contenido: r.contenido_indicaciones,
        approvedAt: r.fecha_aprobacion?.toISOString(), 
        issuedAt: r.fecha_emision?.toISOString(),
        emitido_en: r.fecha_emision?.toISOString()
      })), 
      meta: meta(id) 
    };
  }

  static async getPatientAttentions(principal: AiAgentPrincipal, query: SessionQuery = {}, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    if (principal.role !== 'PACIENTE' || !principal.idPersona) throw new AiAgentError('FORBIDDEN', 'Solo un paciente puede consultar sus atenciones.');
    const id = correlation();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where = { id_persona: principal.idPersona };
    const [rows, total] = await Promise.all([
      prisma.atenciones.findMany({
        where,
        include: {
          Servicio: true,
          Profesional: true,
          Sede: true,
          IndicacionesPostatencion: {
            where: {
              estado: { in: ['Documento emitido', 'Documento aprobado', 'Emitido', 'Aprobado', 'Vigente'] },
              es_version_vigente: true,
              fecha_aprobacion: { not: null },
              fecha_emision: { not: null }
            },
            take: 1
          }
        },
        orderBy: { fecha_atencion: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.atenciones.count({ where })
    ]);
    if (options.audit !== false) await audit(principal, 'CONSULTA_ATENCIONES_PROPIAS', id, principal.idPersona);
    return {
      success: true,
      data: {
        items: rows.map(a => ({
          attentionId: a.id_atencion,
          treatmentId: a.id_tratamiento,
          sessionId: a.id_sesion,
          date: a.fecha_atencion.toISOString(),
          attendance: a.asistencia,
          serviceStatus: a.estado_servicio,
          serviceName: a.Servicio?.nombre ?? 'Servicio Odontológico',
          professionalName: a.Profesional ? `${a.Profesional.nombres} ${a.Profesional.apellidos}` : 'No asignado',
          branchName: a.Sede?.nombre ?? 'Sede Principal',
          documentationClosure: a.estado_cierre_documental,
          hasApprovedInstructions: a.IndicacionesPostatencion.length > 0
        })),
        page,
        pageSize,
        total
      },
      meta: meta(id)
    };
  }

  static async getStaffAttentions(principal: AiAgentPrincipal, query: SessionQuery = {}, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    if (!['ODONTOLOGO', 'RECEPCION', 'ADMIN'].includes(principal.role)) {
      throw new AiAgentError('FORBIDDEN', 'No autorizado para consultar el registro institucional de atenciones.');
    }
    const id = correlation();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: any = {};
    if (principal.role === 'ODONTOLOGO' && !principal.idProfesional) throw new AiAgentError('FORBIDDEN', 'Se requiere identidad profesional.');
    if (principal.role === 'ODONTOLOGO') {
      where.id_profesional = principal.idProfesional;
    }
    const [rows, total] = await Promise.all([
      prisma.atenciones.findMany({
        where,
        include: {
          Persona: { select: { id_persona: true, nombres: true, apellidos: true } },
          Servicio: true,
          Profesional: true,
          Sede: true,
          ValidacionesFicha: { orderBy: { numero_revision: 'desc' }, take: 1 }
        },
        orderBy: { fecha_atencion: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.atenciones.count({ where })
    ]);
    if (options.audit !== false) await audit(principal, 'CONSULTA_ATENCIONES_INSTITUCIONALES', id, undefined, undefined);
    return {
      success: true,
      data: {
        items: rows.map(a => ({
          attentionId: a.id_atencion,
          patientId: a.Persona.id_persona,
          patientName: `${a.Persona.nombres} ${a.Persona.apellidos}`.trim(),
          treatmentId: a.id_tratamiento,
          sessionId: a.id_sesion,
          date: a.fecha_atencion.toISOString(),
          attendance: a.asistencia,
          serviceStatus: a.estado_servicio,
          serviceName: a.Servicio?.nombre ?? 'Servicio Odontológico',
          professionalName: a.Profesional ? `${a.Profesional.nombres} ${a.Profesional.apellidos}` : 'No asignado',
          branchName: a.Sede?.nombre ?? 'Sede Principal',
          documentationClosure: a.estado_cierre_documental,
          lastValidationResult: a.ValidacionesFicha[0]?.resultado_validacion ?? 'Sin_Revision'
        })),
        page,
        pageSize,
        total
      },
      meta: meta(id)
    };
  }

  static async getAvailableSchedulingSlots(principal: AiAgentPrincipal, query: { idSede?: number; idProfesional?: number; fechaDesde?: string; fechaHasta?: string } = {}, options: QueryOptions = {}): Promise<ToolResponse<unknown[]>> {
    if (!['RECEPCION', 'ADMIN', 'ODONTOLOGO'].includes(principal.role)) {
      throw new AiAgentError('FORBIDDEN', 'No autorizado para consultar disponibilidad de agenda.');
    }
    const id = correlation();
    const now = new Date();
    const fromDate = query.fechaDesde ? new Date(query.fechaDesde) : now;
    const toDate = query.fechaHasta ? new Date(query.fechaHasta) : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const where: any = {
      estado: 'Disponible',
      fecha: { gte: fromDate, lte: toDate },
      Opciones: {
        none: {
          Reservas: {
            some: {
              estado: { notIn: ['Cancelada', 'Cancelado', 'Expirada', 'Expirado'] }
            }
          }
        }
      }
    };
    if (query.idSede) where.id_sede = query.idSede;
    if (query.idProfesional) where.id_profesional = query.idProfesional;

    const rows = await prisma.disponibilidad.findMany({
      where,
      include: {
        Profesional: true,
        Sede: true
      },
      orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
      take: 50
    });
    if (options.audit !== false) await audit(principal, 'CONSULTA_DISPONIBILIDAD_AGENDA', id);
    return {
      success: true,
      data: rows.map(d => ({
        slotId: d.id_disponibilidad,
        date: d.fecha.toISOString().split('T')[0],
        startTime: d.hora_inicio.toISOString().split('T')[1].substring(0, 5),
        endTime: d.hora_fin.toISOString().split('T')[1].substring(0, 5),
        professionalId: d.id_profesional,
        professionalName: `${d.Profesional.nombres} ${d.Profesional.apellidos}`.trim(),
        branchId: d.id_sede,
        branchName: d.Sede.nombre,
        status: d.estado
      })),
      meta: meta(id)
    };
  }

  static async getTreatmentClosureChecklist(principal: AiAgentPrincipal, treatmentId: number, options: QueryOptions = {}) {
    if (!['ODONTOLOGO', 'ADMIN'].includes(principal.role)) throw new AiAgentError('FORBIDDEN', 'El checklist requiere un profesional autorizado.');
    const treatment = await treatmentForPrincipal(treatmentId, principal);
    const [plan, sessions] = await Promise.all([
      prisma.planTratamiento.findFirst({ where: { id_tratamiento: treatmentId, es_vigente: true }, orderBy: { version_plan: 'desc' } }),
      prisma.sesionesTratamiento.findMany({ where: { id_tratamiento: treatmentId }, orderBy: { numero_sesion: 'asc' }, include: { Atenciones: { include: { ValidacionesFicha: { orderBy: { numero_revision: 'desc' }, take: 1 }, IndicacionesPostatencion: { where: { es_version_vigente: true, fecha_aprobacion: { not: null }, fecha_emision: { not: null } } } } } } })
    ]);
    const items = sessions.map(session => ({
      sessionId: session.id_sesion,
      number: session.numero_sesion,
      careStatus: session.estado_asistencial,
      closureStatus: session.estado_cierre,
      completed: isSessionCompleted(session),
      requiresExceptionReview: ['Cancelada', 'Cancelado'].includes(session.estado_programacion) || session.estado_asistencial === 'Inasistida',
      attentions: session.Atenciones.map(attention => ({
        attentionId: attention.id_atencion,
        validationId: attention.ValidacionesFicha[0]?.id_validacion ?? null,
        validationResult: attention.ValidacionesFicha[0]?.resultado_validacion ?? 'SIN_VALIDACION',
        pendingFields: attention.ValidacionesFicha[0]?.campos_pendientes ?? null,
        documentationClosure: attention.estado_cierre_documental,
        issuedInstructionIds: attention.IndicacionesPostatencion.map(instruction => instruction.id_indicacion)
      }))
    }));
    const pending: string[] = [];
    if (!plan) pending.push('No hay un plan vigente verificable.');
    if (plan && sessions.length !== plan.sesiones_planificadas) pending.push('La cantidad de sesiones registradas difiere del plan vigente.');
    for (const item of items) {
      if (!item.completed) pending.push(`Sesión ${item.number}: pendiente de realización y/o cierre.`);
      if (item.requiresExceptionReview) pending.push(`Sesión ${item.number}: excepción que requiere decisión profesional.`);
      if (!item.attentions.length) pending.push(`Sesión ${item.number}: sin atención vinculada.`);
      for (const attention of item.attentions) {
        if (attention.validationResult !== 'Completa' || attention.pendingFields?.trim()) pending.push(`Atención ${attention.attentionId}: ficha sin validación completa o con campos pendientes.`);
        if (!attention.issuedInstructionIds.length) pending.push(`Atención ${attention.attentionId}: sin indicaciones aprobadas y emitidas; verificar aplicabilidad.`);
      }
    }
    const id = correlation();
    if (options.audit !== false) await audit(principal, 'CONSULTA_CHECKLIST_CIERRE', id, treatment.id_persona, treatmentId);
    return { success: true, data: { treatmentId, formalTreatmentStatus: treatment.estado_tratamiento, planId: plan?.id_plan ?? null, planVersion: plan?.version_plan ?? null, plannedSessions: plan?.sesiones_planificadas ?? null, completedSessions: sessions.filter(isSessionCompleted).length, sessions: items, pending, readOnly: true, requiresProfessionalConfirmation: true, disclaimer: 'Preparación documental consultiva. No certifica alta clínica, no resuelve excepciones y no cierra ni transiciona el tratamiento.' }, meta: meta(id) };
  }

  static async getAuthorizedClinicalContext(principal: AiAgentPrincipal, idAtencion: number, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    if (principal.role !== 'ODONTOLOGO' && principal.role !== 'ADMIN') throw new AiAgentError('FORBIDDEN', 'El contexto clínico requiere perfil odontólogo autorizado.'); const id = correlation(); const a = await attentionForPrincipal(idAtencion, principal); const background = await prisma.antecedentesClinicos.findMany({ where: { id_persona: a.id_persona }, select: { categoria_antecedente: true, descripcion_antecedente: true, estado_verificacion: true } }); const previous = await prisma.atenciones.findMany({ where: { id_persona: a.id_persona, id_atencion: { not: idAtencion } }, select: { id_atencion: true, fecha_atencion: true, procedimiento: true, estado_servicio: true }, orderBy: { fecha_atencion: 'desc' }, take: 10 });
    const [plan, session, procedures, alerts] = await Promise.all([
      a.id_tratamiento ? prisma.planTratamiento.findFirst({where:{id_tratamiento:a.id_tratamiento,es_vigente:true},orderBy:{version_plan:'desc'}}) : null,
      a.id_sesion ? prisma.sesionesTratamiento.findUnique({where:{id_sesion:a.id_sesion}}) : null,
      prisma.detalleProcedimiento.findMany({where:{id_atencion:idAtencion},select:{id_detalle_procedimiento:true,procedimiento_realizado:true,fecha_registro:true,id_profesional:true}}),
      prisma.alertasIA.findMany({where:{id_persona:a.id_persona,OR:[{id_atencion:idAtencion},...(a.id_tratamiento?[{id_tratamiento:a.id_tratamiento}]:[])],estado:{notIn:['Resuelta','Descartada_Justificada']}},select:{id_alerta_ia:true,tipo_evento:true,mensaje_alerta:true,estado:true,fecha_hora:true},take:50})
    ]);
    if (options.audit !== false) await audit(principal, 'CONSULTA_CONTEXTO_CLINICO', id, a.id_persona, a.id_tratamiento ?? undefined, idAtencion);
    const isFutureOrPending = ['Pendiente', 'Confirmada'].includes(a.asistencia) || a.estado_servicio === 'Programado';
    const isNoShow = ['No asistió', 'No asiste'].includes(a.asistencia) || a.estado_servicio === 'Cancelado';
    const pendingVerification = isFutureOrPending
      ? ['Cita programada en agenda; pendiente de atención presencial en sillón']
      : isNoShow
        ? ['Atención no ejecutada por inasistencia del paciente']
        : (!a.evaluacion || !a.procedimiento ? ['Evaluación o procedimiento clínico pendiente de documentar'] : []);

    return {
      success: true,
      data: {
        patientId: a.id_persona,
        provenance: {attentionId:idAtencion,treatmentId:a.id_tratamiento,sessionId:a.id_sesion,planId:plan?.id_plan??null,clinicalRevision:a.revision_ficha,source:'OLTP autorizado',retrievedAt:new Date().toISOString()},
        currentPlan: plan ? {planId:plan.id_plan,version:plan.version_plan,plannedSessions:plan.sesiones_planificadas} : null,
        currentSession: session ? {sessionId:session.id_sesion,number:session.numero_sesion,date:session.fecha_programada_vigente,schedulingStatus:session.estado_programacion,careStatus:session.estado_asistencial,closureStatus:session.estado_cierre} : null,
        registeredProcedures: procedures,
        relatedAlerts: alerts,
        closureChecklist: a.id_tratamiento && (principal.role === 'ADMIN' || a.TratamientosContratados?.id_profesional_responsable === principal.idProfesional) ? (await this.getTreatmentClosureChecklist(principal, a.id_tratamiento, { audit: false })).data : null,
        relevantBackground: background.map(b => ({
          category: b.categoria_antecedente,
          description: b.descripcion_antecedente,
          verificationStatus: b.estado_verificacion
        })),
        currentTreatment: a.TratamientosContratados ? {
          treatmentId: a.TratamientosContratados.id_tratamiento,
          serviceName: a.Servicio?.nombre || 'Evaluación Odontológica Integral',
          status: a.TratamientosContratados.estado_tratamiento
        } : null,
        currentAttention: {
          attendance: a.asistencia,
          serviceStatus: a.estado_servicio,
          reason: a.motivo_consulta || (isFutureOrPending ? `Cita programada de ${a.Servicio?.nombre || 'consulta odontológica'}` : null),
          allergies: a.alergias,
          allergiesStatus: a.alergias ? 'DOCUMENTADA' : 'NO_REGISTRADA',
          procedure: a.procedimiento,
          pendingVerification
        },
        previousAttentions: previous,
        clinicalDisclaimer: 'Contexto documental; no constituye diagnóstico ni recomendación terapéutica.'
      },
      meta: meta(id)
    };
  }

  static async getClinicalDocumentationStatus(principal: AiAgentPrincipal, idAtencion: number, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    const id = correlation(); const a = await attentionForPrincipal(idAtencion, principal); const validations = await prisma.validacionesFicha.findMany({ where: { id_atencion: idAtencion }, orderBy: { numero_revision: 'asc' } }); const instructions = await prisma.indicacionesPostatencion.findMany({ where: { id_atencion: idAtencion, estado: { in: ['Borrador', 'Pendiente_Aprobacion'] } }, select: { id_indicacion: true, estado: true } }); if (options.audit !== false) await audit(principal, 'CONSULTA_ESTADO_DOCUMENTAL', id, a.id_persona, a.id_tratamiento ?? undefined, idAtencion);
    return { success: true, data: { attentionId: idAtencion, hasClinicalFile: Boolean(a.motivo_consulta || a.evaluacion || a.procedimiento), firstValidation: validations[0] ? { result: validations[0].resultado_validacion, date: validations[0].fecha_revision.toISOString() } : null, lastValidation: validations.at(-1) ? { result: validations.at(-1)!.resultado_validacion, date: validations.at(-1)!.fecha_revision.toISOString(), pendingFields: validations.at(-1)!.campos_pendientes } : null, closureStatus: a.estado_cierre_documental, pendingInstructions: instructions }, meta: meta(id) };
  }

  static async getAuthorizedAiRecords(principal: AiAgentPrincipal, query: SessionQuery = {}, options: QueryOptions = {}): Promise<ToolResponse<unknown>> {
    if (principal.role === 'ODONTOLOGO' && !principal.idProfesional) throw new AiAgentError('FORBIDDEN', 'Falta identidad profesional.');
    if (principal.role === 'PACIENTE' && !principal.idPersona) throw new AiAgentError('FORBIDDEN', 'Falta identidad del paciente.');
    const take = query.pageSize ?? 50;
    const alertWhere = principal.role === 'ADMIN' ? {} : principal.role === 'PACIENTE' ? {id_persona:principal.idPersona,tipo_evento:'ALT-C01'} : principal.role === 'RECEPCION' ? {tipo_evento:{in:['AL-C04','AL-C05','ALT-C01','ALT-C02','ALT-C03']}} : {id_profesional:principal.idProfesional};
    const interactionWhere = principal.role === 'ADMIN' ? {} : principal.role === 'PACIENTE' ? {id_persona:principal.idPersona} : {id_usuario_actor:principal.idUsuario};
    const draftWhere = principal.role === 'ADMIN' ? {} : {id_profesional:principal.idProfesional};
    const [alerts,drafts,interactions] = await Promise.all([
      prisma.alertasIA.findMany({where:alertWhere,select:{id_alerta_ia:true,tipo_evento:true,severidad:true,estado:true,fecha_hora:true},take}),
      ['ADMIN','ODONTOLOGO'].includes(principal.role) ? prisma.borradoresIA.findMany({where:draftWhere,select:{id_borrador_ia:true,estado:true,fecha_hora:true},take}) : Promise.resolve([]),
      prisma.interaccionesIA.findMany({where:interactionWhere,select:{id_interaccion_ia:true,tipo_evento:true,actor_orientado:true,estado:true,fecha_hora:true,id_correlacion:true},take})
    ]);
    const id = correlation(); return {success:true,data:{alerts,drafts,interactions},meta:meta(id)};
  }
}
