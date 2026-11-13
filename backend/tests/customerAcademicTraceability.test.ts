import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('../src/db', () => {
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() });
  const prisma: any = Object.fromEntries(['disponibilidad', 'solicitudesCustomerIA', 'personas', 'atenciones', 'tratamientosContratados', 'planTratamiento', 'sesionesTratamiento', 'antecedentesClinicos', 'indicacionesPostatencion', 'validacionesFicha', 'borradoresIA', 'alertasIA', 'interaccionesIA', 'profesionales', 'solicitudesReprogramacionCustomer','politicasCustomerIA','detalleProcedimiento'].map(name => [name, model()]));
  prisma.$transaction = vi.fn(async (callback: any) => callback(prisma));
  return { prisma, withRetry: (callback: any) => callback() };
});

import { prisma } from '../src/db';
import { CustomerCompletionService as C } from '../src/modules/customer/ai-agent/services/customerCompletionService';
import { CustomerAiQueryService as Q, isSessionCompleted } from '../src/modules/customer/ai-agent/services/customerAiQueryService';
import { CustomerAlertLifecycleService as L } from '../src/modules/customer/ai-agent/services/customerAlertLifecycleService';
import { CustomerAiActionService as A } from '../src/modules/customer/ai-agent/services/customerAiActionService';
import { CustomerAiPersistenceService as P } from '../src/services/customerAiPersistenceService';
import { attentionForPrincipal, treatmentForPrincipal } from '../src/modules/customer/ai-agent/policies';
import { availableTools, executeTool } from '../src/modules/customer/ai-agent/llm/toolRegistry';
import { CustomerAiOrchestrator } from '../src/modules/customer/ai-agent/llm/orchestrator';
import { issueAiAgentToken, verifyAiAgentToken } from '../src/modules/customer/ai-agent/authContext';
import { systemInstructions } from '../src/modules/customer/ai-agent/llm/systemInstructions';
import { analyticsDefinitions, parseAnalyticsFilter } from '../src/modules/customer/ai-agent/services/customerAnalyticsService';
import customerRoutes from '../src/routes/customer.routes';
import completionRoutes from '../src/modules/customer/ai-agent/completionRoutes';
import { patientAuthService } from '../src/services/patientAuthService';
import { DurableKnowledgeService, durableKnowledgeService } from '../src/modules/customer/knowledge-base/durableKnowledgeService';

const db = prisma as any;
const patient = { role: 'PACIENTE' as const, idPersona: 10 };
const dentist = { role: 'ODONTOLOGO' as const, idProfesional: 2, idUsuario: 3 };
const reception = { role: 'RECEPCION' as const, idUsuario: 4 };
const attention = { id_atencion: 20, id_persona: 10, id_profesional: 2, id_tratamiento: null, id_sesion: null, fecha_atencion: new Date('2026-11-01T10:00:00Z'), Servicio: { nombre: 'Servicio registrado' }, procedimiento: null, alergias: null, observaciones: null, indicaciones_finales: null, asistencia: 'Pendiente', estado_cierre_documental: 'Pendiente', ValidacionesFicha: [] };
const treatment = { id_tratamiento: 30, id_persona: 10, id_profesional_responsable: 2, estado_tratamiento: 'En ejecución', Servicios: { nombre: 'Servicio' } };
const env = { ...process.env };

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (callback: any) => callback(db));
  db.atenciones.findUnique.mockResolvedValue({ ...attention });
  db.tratamientosContratados.findUnique.mockResolvedValue({ ...treatment });
  db.planTratamiento.findFirst.mockResolvedValue({ id_plan: 7, version_plan: 2, sesiones_planificadas: 2 });
  db.sesionesTratamiento.findMany.mockResolvedValue([]);
  db.antecedentesClinicos.findMany.mockResolvedValue([]);
  db.indicacionesPostatencion.findFirst.mockResolvedValue(null);
  db.indicacionesPostatencion.findMany.mockResolvedValue([]);
  db.borradoresIA.findFirst.mockResolvedValue(null);
  db.politicasCustomerIA.findFirst.mockResolvedValue(null);
  db.alertasIA.findFirst.mockResolvedValue(null);
  db.alertasIA.findMany.mockResolvedValue([]);
  db.detalleProcedimiento.findMany.mockResolvedValue([]);
  db.alertasIA.create.mockImplementation(async ({ data }: any) => ({ ...data, id_alerta_ia: 8 }));
  process.env.AI_AGENT_SESSION_SECRET = 'traceability-test-secret';
});
afterEach(() => { vi.restoreAllMocks(); process.env = { ...env }; });

function setupIndicationSource() {
  db.profesionales.findUnique.mockResolvedValue({ activo: true, numero_colegiatura: 'SIM-01' });
  db.atenciones.findUnique.mockResolvedValue({ ...attention, revision_ficha: 0, asistencia: 'Asistió', estado_servicio: 'Finalizado', procedimiento: 'Procedimiento sintético', indicaciones_finales: 'Texto autorizado sintético sin prescripción real.' });
  db.detalleProcedimiento.findMany.mockResolvedValue([{ procedimiento_realizado: 'Procedimiento sintético' }]);
  db.politicasCustomerIA.findFirst.mockResolvedValue({ id_politica: 7, version: 2, configuracion: JSON.stringify({text:'{{indicaciones_profesional}}'}) });
  return 'Procedimiento confirmado: Procedimiento sintético\nTexto autorizado sintético sin prescripción real.\nFuente: plantilla aprobada 7, versión 2; ficha revisión 0.';
}

describe('IA01–IA14: verificación de contratos, sin conexión SQL ni proveedor externo', () => {
  it('IA01: conserva estados oficiales y rechaza tratamientos ajenos', async () => {
    db.sesionesTratamiento.findMany.mockResolvedValue([{ id_sesion: 1, numero_sesion: 1, fecha_programada_vigente: new Date(), estado_programacion: 'Reprogramada', estado_asistencial: 'Realizada', estado_cierre: 'Pendiente', Profesionales: { nombres: 'A', apellidos: 'B' }, Sedes: { nombre: 'Sede' } }]);
    db.sesionesTratamiento.count.mockResolvedValue(1);
    const response: any = await Q.getTreatmentSessions(patient, 30, {}, { audit: false });
    expect(response.data.items[0]).toMatchObject({ schedulingStatus: 'Reprogramada', careStatus: 'Realizada', closureStatus: 'Pendiente' });
    db.tratamientosContratados.findUnique.mockResolvedValue({ ...treatment, id_persona: 99 });
    await expect(Q.getTreatmentSessions(patient, 30)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('IA01: próximas sesiones conservan identidad, estados, fuente y filtro del propietario', async () => {
    const session = { id_sesion: 12, numero_sesion: 2, id_tratamiento: 30, fecha_programada_vigente: new Date('2099-11-20T20:00:00Z'), estado_programacion: 'Reprogramada', confirmacion_paciente: 'Pendiente', estado_asistencial: 'Pendiente', estado_cierre: 'Pendiente', Profesionales: { nombres: 'A', apellidos: 'B' }, Sedes: { nombre: 'Sede' }, TratamientosContratados: { Servicios: { nombre: 'Servicio' } } };
    db.sesionesTratamiento.findMany.mockResolvedValue([session, { ...session, id_sesion: 13, estado_asistencial: 'Realizada', estado_cierre: 'Cerrada' }]);
    const response: any = await Q.getUpcomingSessions(patient, { audit: false });
    expect(db.sesionesTratamiento.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { TratamientosContratados: { id_persona: 10 }, fecha_programada_vigente: { gte: expect.any(Date) }, estado_programacion: { in: ['Programada', 'Confirmada', 'Reprogramada'] } } }));
    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({ sessionId: 12, number: 2, status: 'Reprogramada', schedulingStatus: 'Reprogramada', confirmationStatus: 'Pendiente', careStatus: 'Pendiente', closureStatus: 'Pendiente', date: '2099-11-20T20:00:00.000Z' });
    expect(response.meta).toMatchObject({ source: 'NexoSaludDB', correlationId: expect.any(String) });
    expect(db.sesionesTratamiento.update).not.toHaveBeenCalled();
    expect(db.sesionesTratamiento.create).not.toHaveBeenCalled();
  });

  it('IA01: sin identidad de paciente no consulta sesiones; un resultado vacío no se inventa', async () => {
    for (const principal of [reception, dentist, { role: 'PACIENTE' as const }]) {
      await expect(Q.getUpcomingSessions(principal, { audit: false })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
    expect(db.sesionesTratamiento.findMany).not.toHaveBeenCalled();
    expect((await Q.getUpcomingSessions(patient, { audit: false })).data).toEqual([]);
    db.sesionesTratamiento.findMany.mockRejectedValue(new Error('SQL no disponible'));
    await expect(Q.getUpcomingSessions(patient, { audit: false })).rejects.toThrow('SQL no disponible');
  });

  it('IA01: el resumen y el detalle omiten fechas pasadas, canceladas y sesiones completadas', async () => {
    const future = new Date('2099-11-20T20:00:00Z');
    const sessions = [
      { fecha_programada_vigente: new Date('2000-01-01'), estado_programacion: 'Programada' },
      { fecha_programada_vigente: future, estado_programacion: 'Cancelada' },
      { fecha_programada_vigente: future, estado_programacion: 'Confirmada', estado_asistencial: 'Realizada', estado_cierre: 'Cerrada' },
      { fecha_programada_vigente: future, estado_programacion: 'Reprogramada', estado_asistencial: 'Pendiente', estado_cierre: 'Pendiente' }
    ];
    db.tratamientosContratados.findMany.mockResolvedValue([{ ...treatment, PlanTratamiento: [], SesionesTratamiento: sessions }]);
    db.sesionesTratamiento.findMany.mockResolvedValue(sessions);
    expect((await Q.getPatientTreatments(patient, { audit: false })).data[0]).toMatchObject({ nextSessionDate: future.toISOString() });
    expect((await Q.getTreatmentDetail(patient, 30, { audit: false })).data).toMatchObject({ nextSession: future.toISOString() });
    db.sesionesTratamiento.findMany.mockResolvedValue(sessions.slice(0, 3));
    expect((await Q.getTreatmentDetail(patient, 30, { audit: false })).data).toMatchObject({ nextSession: null });
  });

  it('IA02: diferencia realizadas, cerradas y pendientes sin interpretar evolución clínica', async () => {
    db.sesionesTratamiento.findMany.mockResolvedValue([
      { id_plan: 7, estado_asistencial: 'Realizada', estado_cierre: 'Cerrada', fecha_programada_vigente: new Date() },
      { id_plan: 7, estado_asistencial: 'Realizada', estado_cierre: 'Pendiente' }
    ]);
    const result: any = await Q.getTreatmentProgress(patient, 30, { audit: false });
    expect(result.data).toMatchObject({ plannedSessions: 2, completedSessions: 1, performedSessions: 2, performedPendingClosureSessions: 1, pendingSessions: 1, operationalProgressPercent: 50, calculationStatus: 'CALCULABLE' });
    expect(result.meta.source).toBe('NexoSaludDB');
    expect(result.data.progressMeaning).toContain('no representa progreso clínico');
    expect(db.sesionesTratamiento.update).not.toHaveBeenCalled();
  });

  it('IA02: sin plan o con total inválido no inventa cero pendientes ni porcentaje', async () => {
    for (const plan of [null, { id_plan: 7, sesiones_planificadas: 0 }]) {
      db.planTratamiento.findFirst.mockResolvedValue(plan);
      expect((await Q.getTreatmentProgress(patient, 30, { audit: false })).data).toMatchObject({ plannedSessions: null, pendingSessions: null, operationalProgressPercent: null, calculationStatus: 'REQUIERE_REVISION' });
    }
  });

  it('IA02: exceso de completadas y sesiones de otro plan requieren revisión', async () => {
    const completed = { id_plan: 7, estado_asistencial: 'Realizada', estado_cierre: 'Cerrada', fecha_programada_vigente: new Date() };
    db.sesionesTratamiento.findMany.mockResolvedValue([completed, completed, completed]);
    const excess: any = await Q.getTreatmentProgress(patient, 30, { audit: false });
    expect(excess.data).toMatchObject({ completedSessions: 3, pendingSessions: null, operationalProgressPercent: null });
    expect(excess.data.inconsistencies).toContain('SESIONES_COMPLETADAS_EXCEDEN_PLAN');
    db.sesionesTratamiento.findMany.mockResolvedValue([{ ...completed, id_plan: 8 }]);
    const mixed: any = await Q.getTreatmentProgress(patient, 30, { audit: false });
    expect(mixed.data.operationalProgressPercent).toBeNull();
    expect(mixed.data.inconsistencies).toContain('SESIONES_DE_OTRA_VERSION_PLAN');
  });

  it('IA02: cero completadas es 0 % con plan válido; rechaza tratamiento ajeno', async () => {
    expect((await Q.getTreatmentProgress(patient, 30, { audit: false })).data).toMatchObject({ pendingSessions: 2, operationalProgressPercent: 0 });
    db.tratamientosContratados.findUnique.mockResolvedValue({ ...treatment, id_persona: 99 });
    db.sesionesTratamiento.findMany.mockClear();
    await expect(Q.getTreatmentProgress(patient, 30)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(db.sesionesTratamiento.findMany).not.toHaveBeenCalled();
  });

  it('IA03: sin plan válido no ofrece cupos ni ordinales', async () => {
    for (const plan of [null, { sesiones_planificadas: 3, duracion_estimada: 0 }, { sesiones_planificadas: 0, duracion_estimada: 30 }]) {
      db.planTratamiento.findFirst.mockResolvedValue(plan);
      await expect(C.slots(patient, 30)).rejects.toMatchObject({ code: 'CONFLICT' });
      await expect(C.pendingSessions(patient, 30)).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    expect(db.disponibilidad.findMany).not.toHaveBeenCalled();
  });

  it('IA03: solo ofrece sesiones del plan todavía sin programar y rechaza tratamiento ajeno', async () => {
    db.planTratamiento.findFirst.mockResolvedValue({ id_plan: 7, version_plan: 1, sesiones_planificadas: 4, duracion_estimada: 30 });
    db.sesionesTratamiento.findMany.mockResolvedValue([{ numero_sesion: 1 }, { numero_sesion: 3 }]);
    expect((await C.pendingSessions(patient, 30)).pendingNumbers).toEqual([2, 4]);
    db.tratamientosContratados.findUnique.mockResolvedValue({ ...treatment, id_persona: 99 });
    await expect(C.slots(patient, 30)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('IA03: propuesta verificable sin escritura; confirma solo si el cupo sigue vigente', async () => {
    vi.spyOn(C, 'pendingSessions').mockResolvedValue({ treatmentId: 30, planId: 7, planVersion: 1, durationMinutes: 30, pendingNumbers: [2] });
    const slots = vi.spyOn(C, 'slots').mockResolvedValue([{ slotId: 9, date: '2099-11-20T20:00:00.000Z', professionalId: 2, branchId: 1, professionalName: 'A B', branchName: 'Centro', sourceTimeStandard: 'UTC' }]);
    const proposal = await C.prepareScheduling(patient, 30, 2, 9, 'ia03-test');
    expect(proposal.summary).toContain('15:00');
    expect(proposal.summary).toContain('Centro');
    expect(proposal.summary).toContain('no reserva el cupo');
    expect(db.solicitudesCustomerIA.create).not.toHaveBeenCalled();
    await expect(C.confirmScheduling({ role: 'PACIENTE', idPersona: 99 }, proposal.confirmationToken)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    slots.mockResolvedValue([]);
    await expect(C.confirmScheduling(patient, proposal.confirmationToken)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.solicitudesCustomerIA.create).not.toHaveBeenCalled();
    await expect(C.applyScheduling(patient, 1)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('IA04: normaliza fecha, ofrece alternativas y solo registra tras confirmación propia', async () => {
    const date = new Date('2099-11-18T20:00:00Z');
    db.sesionesTratamiento.findUnique.mockResolvedValue({ id_sesion: 42, numero_sesion: 2, id_tratamiento: 30, duracion_programada_min: 45, fecha_programada_vigente: date, estado_programacion: 'Programada', estado_asistencial: 'Pendiente', TratamientosContratados: treatment });
    vi.spyOn(C, 'slots').mockResolvedValue([
      { slotId: 8, durationMinutes: 45, date: date.toISOString(), professionalId: 2, branchId: 1, professionalName: 'A B', branchName: 'Centro', sourceTimeStandard: 'UTC' },
      { slotId: 9, durationMinutes: 45, date: '2099-11-20T20:00:00.000Z', professionalId: 2, branchId: 1, professionalName: 'A B', branchName: 'Centro', sourceTimeStandard: 'UTC' },
      { slotId: 10, durationMinutes: 30, date: '2099-11-21T20:00:00.000Z', professionalId: 2, branchId: 1, professionalName: 'A B', branchName: 'Centro', sourceTimeStandard: 'UTC' }
    ]);
    const prepared = await A.prepareRescheduleRequest(patient, { sessionId: 42, preferredDate: '20/11/2099', preferredSlot: 'Tarde' });
    expect(prepared.data.preferredDate).toBe('2099-11-20');
    expect(prepared.data.alternatives.map(s => s.slotId)).toEqual([9]);
    expect(prepared.data.preferenceIsReservation).toBe(false);
    expect(db.solicitudesReprogramacionCustomer.create).not.toHaveBeenCalled();
    await expect(A.confirmRescheduleRequest({ role: 'PACIENTE', idPersona: 99 }, prepared.confirmationToken)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    db.interaccionesIA.create.mockResolvedValue({ id_interaccion_ia: 50 });
    db.solicitudesReprogramacionCustomer.create.mockImplementation(async ({ data }: any) => ({ ...data, id_solicitud_reprogramacion: 51 }));
    expect(await A.confirmRescheduleRequest(patient, prepared.confirmationToken)).toMatchObject({ status: 'RECORDED', requestId: 51 });
    expect(db.solicitudesReprogramacionCustomer.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fecha_preferida: new Date('2099-11-20T00:00:00Z'), estado_solicitud: 'Pendiente' }) }));
    expect(db.sesionesTratamiento.update).not.toHaveBeenCalled();
  });

  it('IA04: rechaza fechas imposibles y pasadas antes de consultar agenda', async () => {
    for (const preferredDate of ['31/02/2099', '2099-02-30', '2000-01-01', '2099-11-20T20:00:00Z']) {
      await expect(A.prepareRescheduleRequest(patient, { sessionId: 42, preferredDate })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    }
    expect(db.sesionesTratamiento.findUnique).not.toHaveBeenCalled();
  });

  it('IA04: sin cupos informa revisión y una sesión realizada no admite propuesta', async () => {
    const session = { id_sesion: 42, numero_sesion: 2, id_tratamiento: 30, duracion_programada_min: 45, fecha_programada_vigente: new Date('2099-11-18T20:00:00Z'), estado_programacion: 'Programada', estado_asistencial: 'Pendiente', TratamientosContratados: treatment };
    db.sesionesTratamiento.findUnique.mockResolvedValue(session);
    vi.spyOn(C, 'slots').mockResolvedValue([]);
    const prepared = await A.prepareRescheduleRequest(patient, { sessionId: 42 });
    expect(prepared.data.alternatives).toEqual([]);
    expect(prepared.data.availabilityNote).toContain('No hay alternativas');
    db.sesionesTratamiento.findUnique.mockResolvedValue({ ...session, estado_asistencial: 'Realizada' });
    await expect(A.prepareRescheduleRequest(patient, { sessionId: 42 })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(A.applyRescheduleRequest(patient, 1, 9, 'Cambio')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('IA04: transporta el borrador autorizado al portal sin token ni registro automático', async () => {
    Object.assign(process.env, { AI_AGENT_LLM_ENABLED: 'true', AI_AGENT_LLM_PROVIDER: 'gemini', AI_AGENT_EXTERNAL_DATA_AUTHORIZED: 'true' });
    db.sesionesTratamiento.findUnique.mockResolvedValue({ id_sesion: 42, numero_sesion: 2, id_tratamiento: 30, duracion_programada_min: 45, fecha_programada_vigente: new Date('2099-11-18T20:00:00Z'), estado_programacion: 'Programada', estado_asistencial: 'Pendiente', TratamientosContratados: treatment });
    vi.spyOn(C, 'slots').mockResolvedValue([{ slotId: 9, durationMinutes: 45, date: '2099-11-20T20:00:00.000Z', professionalId: 2, branchId: 1, professionalName: 'A B', branchName: 'Centro', sourceTimeStandard: 'UTC' }]);
    vi.spyOn(P, 'registrarInteraccion').mockResolvedValue({} as any);
    const provider = { complete: vi.fn().mockResolvedValueOnce({ kind: 'tool_call', callId: 'c1', name: 'prepareRescheduleRequest', arguments: '{"sessionId":42}' }).mockResolvedValueOnce({ kind: 'message', text: 'Revisa las alternativas en el formulario.' }) };
    const result = await new CustomerAiOrchestrator(() => provider).answer(patient, 'Quiero alternativas para reprogramar mi segunda sesión');
    expect(result.rescheduleDraft).toMatchObject({ sessionId: 42, treatmentId: 30, preferredDate: null, preferredSlot: null, reason: null, alternatives: [{ date: '2099-11-20T20:00:00.000Z', professionalName: 'A B', branchName: 'Centro' }] });
    expect(JSON.stringify(result)).not.toContain('confirmationToken');
    const toolOutput = provider.complete.mock.calls[1][0].input.find((item: any) => item.type === 'function_call_output');
    expect(toolOutput.output).not.toContain('confirmationToken');
    expect(db.solicitudesReprogramacionCustomer.create).not.toHaveBeenCalled();
  });

  it('IA04: una propuesta PREPARED no se comunica como solicitud registrada', () => {
    expect(systemInstructions('PACIENTE')).toContain('todavía NO está registrada');
    const tools = availableTools(patient).map(tool => tool.name);
    expect(tools).toContain('prepareRescheduleRequest');
    expect(tools).not.toContain('applyRescheduleRequest');
  });

  it('IA05: el LLM no recibe permisos para publicar ni aprobar conocimiento', async () => {
    await expect(executeTool(patient, 'publishVersion', {})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(availableTools(patient).map(tool => tool.name)).toContain('searchApprovedKnowledge');
  });

  it('IA06: la consulta exige aprobación y emisión, además de propiedad', async () => {
    db.atenciones.findUnique.mockResolvedValue({ ...attention, estado_cierre_documental: 'Cerrada' });
    db.indicacionesPostatencion.findMany.mockResolvedValue([]);
    await Q.getApprovedAftercareInstructions(patient, 20, { audit: false });
    expect(db.indicacionesPostatencion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ fecha_aprobacion: { not: null }, fecha_emision: { not: null }, es_version_vigente: true }) }));
    expect(systemInstructions(patient)).toContain('sin modificar dosis, frecuencia, duración ni significado');
    db.atenciones.findUnique.mockResolvedValue({ ...attention, id_persona: 99 });
    await expect(Q.getApprovedAftercareInstructions(patient, 20)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('IA06: no consulta indicaciones finales de una atención abierta ni sustituye la seleccionada', async () => {
    const result: any = await Q.getApprovedAftercareInstructions(patient, 20, { audit: false });
    expect(result.data).toEqual([]);
    expect(result.meta.availabilityReason).toBe('ATTENTION_NOT_CLOSED');
    expect(db.indicacionesPostatencion.findMany).not.toHaveBeenCalled();
    const tool = await executeTool(patient, 'getMyAftercareInstructions', {}, { attentionId: 20 });
    expect((tool.result as any).meta.availabilityReason).toBe('ATTENTION_NOT_CLOSED');
    expect(db.atenciones.findFirst).not.toHaveBeenCalled();
  });

  it('IA06: consulta la última atención cerrada aunque no tenga indicaciones y no retrocede', async () => {
    db.atenciones.findFirst.mockResolvedValue({ id_atencion: 20 });
    db.atenciones.findUnique.mockResolvedValue({ ...attention, estado_cierre_documental: 'Cerrada' });
    const result: any = await Q.getLatestClosedAftercareInstructions(patient, { audit: false });
    expect(db.atenciones.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id_persona: 10, estado_cierre_documental: 'Cerrada' } }));
    expect(result.meta.availabilityReason).toBe('NO_ISSUED_INSTRUCTIONS');
    expect(db.atenciones.findFirst).toHaveBeenCalledOnce();
    db.atenciones.findFirst.mockResolvedValue(null);
    expect((await Q.getLatestClosedAftercareInstructions(patient, { audit: false })).meta.availabilityReason).toBe('NO_CLOSED_ATTENTION');
  });

  it('IA06: conserva cantidades, unidades y duración aunque el proveedor proponga cambiarlas', async () => {
    Object.assign(process.env, { AI_AGENT_LLM_ENABLED: 'true', AI_AGENT_LLM_PROVIDER: 'gemini', AI_AGENT_EXTERNAL_DATA_AUTHORIZED: 'true' });
    db.atenciones.findUnique.mockResolvedValue({ ...attention, estado_cierre_documental: 'Cerrada' });
    const original = 'Prueba sintética: Producto X, 2,5 ml por vía oral cada 8 horas durante 3 días. No representa una prescripción real.';
    db.indicacionesPostatencion.findMany.mockResolvedValue([{ id_indicacion: 9, version: 2, estado: 'Documento emitido', contenido_indicaciones: original, fecha_aprobacion: new Date(), fecha_emision: new Date() }]);
    vi.spyOn(P, 'registrarInteraccion').mockResolvedValue({} as any);
    const provider = { complete: vi.fn().mockResolvedValueOnce({ kind: 'tool_call', name: 'getMyAftercareInstructions', callId: 'c1', arguments: '{}' }).mockResolvedValueOnce({ kind: 'message', text: 'Cambia a 20 ml cada hora durante 30 días.' }) };
    const result = await new CustomerAiOrchestrator(() => provider).answer(patient, 'Explícame mis indicaciones', { attentionId: 20 });
    expect(result.message).toContain(original);
    expect(result.message).not.toContain('20 ml');
    expect(result.message).toContain('Para leerlas');
    expect(result.message).toContain('Servicio registrado');
    expect(db.atenciones.findFirst).not.toHaveBeenCalled();
    expect(db.indicacionesPostatencion.update).not.toHaveBeenCalled();
  });

  it('IA06: no inventa indicaciones cuando la herramienta no devuelve documentos', async () => {
    Object.assign(process.env, { AI_AGENT_LLM_ENABLED: 'true', AI_AGENT_LLM_PROVIDER: 'gemini', AI_AGENT_EXTERNAL_DATA_AUTHORIZED: 'true' });
    db.atenciones.findUnique.mockResolvedValue({ ...attention, estado_cierre_documental: 'Cerrada' });
    vi.spyOn(P, 'registrarInteraccion').mockResolvedValue({} as any);
    const provider = { complete: vi.fn().mockResolvedValueOnce({ kind: 'tool_call', name: 'getMyAftercareInstructions', callId: 'c1', arguments: '{}' }).mockResolvedValueOnce({ kind: 'message', text: 'Indicación inventada' }) };
    const result = await new CustomerAiOrchestrator(() => provider).answer(patient, 'Explícame mis indicaciones', { attentionId: 20 });
    expect(result.message).toContain('No encontré indicaciones aprobadas');
    expect(provider.complete).toHaveBeenCalledOnce();
  });

  it('IA06: se abstiene si una indicación se revoca mientras se elabora la respuesta', async () => {
    Object.assign(process.env, { AI_AGENT_LLM_ENABLED: 'true', AI_AGENT_LLM_PROVIDER: 'gemini', AI_AGENT_EXTERNAL_DATA_AUTHORIZED: 'true' });
    db.atenciones.findUnique.mockResolvedValue({ ...attention, estado_cierre_documental: 'Cerrada' });
    db.indicacionesPostatencion.findMany.mockResolvedValueOnce([{ id_indicacion: 9, version: 1, contenido_indicaciones: 'Texto sintético', fecha_aprobacion: new Date(), fecha_emision: new Date() }]).mockResolvedValueOnce([]);
    vi.spyOn(P, 'registrarInteraccion').mockResolvedValue({} as any);
    const provider = { complete: vi.fn().mockResolvedValueOnce({ kind: 'tool_call', name: 'getMyAftercareInstructions', callId: 'c1', arguments: '{}' }).mockResolvedValueOnce({ kind: 'message', text: 'Respuesta' }) };
    await expect(new CustomerAiOrchestrator(() => provider).answer(patient, 'Indicaciones', { attentionId: 20 })).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('IA07: falta de alergias se identifica como no registrada; recepción no accede', async () => {
    db.atenciones.findMany.mockResolvedValue([]);
    const response: any = await Q.getAuthorizedClinicalContext(dentist, 20, { audit: false });
    expect(response.data.currentAttention).toMatchObject({ allergies: null, allergiesStatus: 'NO_REGISTRADA' });
    await expect(Q.getAuthorizedClinicalContext(reception, 20)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('IA07: solo considera atenciones anteriores y pide confirmar datos faltantes', async () => {
    db.antecedentesClinicos.findMany.mockResolvedValue([{ categoria_antecedente: 'Antecedente sintético', descripcion_antecedente: 'Declarado en registro de prueba', estado_verificacion: 'Pendiente' }]);
    db.atenciones.findUnique.mockResolvedValue({ ...attention, alergias: '   ', motivo_consulta: null });
    const result: any = await Q.getAuthorizedClinicalContext(dentist, 20, { audit: false });
    expect(db.atenciones.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id_persona: 10, id_atencion: { not: 20 }, fecha_atencion: { lt: attention.fecha_atencion } }, take: 10 }));
    expect(result.data.currentAttention).toMatchObject({ reason: null, allergies: null, allergiesStatus: 'NO_REGISTRADA' });
    expect(result.data.relevantBackground[0].verificationStatus).toBe('Pendiente');
    expect(result.data.confirmationRequired).toBe(true);
    expect(result.data.preparationSummary).toContain('Alergias no registradas; confirmar');
    expect(result.data.clinicalDisclaimer).toContain('Confirme con el paciente');
    expect(result.data.provenance.source).toBe('OLTP autorizado');
    expect(db.atenciones.update).not.toHaveBeenCalled();
  });

  it('IA07: advierte que la sesión corresponde a otra versión del plan', async () => {
    db.atenciones.findUnique.mockResolvedValue({ ...attention, id_tratamiento: 30, id_sesion: 42, TratamientosContratados: treatment });
    db.sesionesTratamiento.findUnique.mockResolvedValue({ id_sesion: 42, id_tratamiento: 30, id_plan: 6, numero_sesion: 2, fecha_programada_vigente: new Date('2099-11-20'), estado_programacion: 'Programada', estado_asistencial: 'Pendiente', estado_cierre: 'Pendiente' });
    const result: any = await Q.getAuthorizedClinicalContext(dentist, 20, { audit: false });
    expect(result.data.currentPlan).toMatchObject({ planId: 7, version: 2 });
    expect(result.data.contextWarnings.join(' ')).toContain('otra versión del plan');
    expect(result.data.currentSession.careStatus).toBe('Pendiente');
  });

  it('IA07: no expone contexto a pacientes ni a odontólogos ajenos a la atención', async () => {
    await expect(Q.getAuthorizedClinicalContext(patient, 20, { audit: false })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    db.atenciones.findUnique.mockResolvedValue({ ...attention, id_profesional: 99 });
    await expect(Q.getAuthorizedClinicalContext(dentist, 20, { audit: false })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(db.antecedentesClinicos.findMany).not.toHaveBeenCalled();
  });

  it('IA07: detiene el resumen ante una sesión vinculada a otro tratamiento', async () => {
    db.atenciones.findUnique.mockResolvedValue({ ...attention, id_tratamiento: 30, id_sesion: 42, TratamientosContratados: treatment });
    db.sesionesTratamiento.findUnique.mockResolvedValue({ id_sesion: 42, id_tratamiento: 99 });
    await expect(Q.getAuthorizedClinicalContext(dentist, 20, { audit: false })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('IA07: una cita futura asignada aparece en la lista sin registrar asistencia', async () => {
    const future = new Date('2099-11-18T20:00:00Z');
    db.atenciones.findMany.mockResolvedValue([{ ...attention, fecha_atencion: future, estado_servicio: 'Programado', Persona: { id_persona: 10, nombres: 'Paciente', apellidos: 'Simulada' }, Profesional: { nombres: 'Doctor', apellidos: 'Prueba' }, Sede: { nombre: 'Centro' }, SesionesTratamiento: { numero_sesion: 2 } }]);
    db.atenciones.count.mockResolvedValue(1);
    const result: any = await Q.getStaffAttentions(dentist, {}, { audit: false });
    expect(db.atenciones.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id_profesional: 2 } }));
    expect(result.data.items[0]).toMatchObject({ date: future.toISOString(), sessionNumber: 2, attendance: 'Pendiente', serviceStatus: 'Programado' });
    expect(db.atenciones.update).not.toHaveBeenCalled();
  });

  it('IA07: prepara una segunda sesión futura con la primera realizada y no cambia estados', async () => {
    const future = new Date('2099-11-18T20:00:00Z');
    const previous = { id_atencion: 19, fecha_atencion: new Date('2099-11-11T20:00:00Z'), procedimiento: 'Registro sintético previo', estado_servicio: 'Finalizado' };
    db.atenciones.findUnique.mockResolvedValue({ ...attention, id_tratamiento: 30, id_sesion: 42, fecha_atencion: future, estado_servicio: 'Programado', TratamientosContratados: treatment });
    db.atenciones.findMany.mockResolvedValue([previous]);
    db.sesionesTratamiento.findUnique.mockResolvedValue({ id_sesion: 42, id_tratamiento: 30, id_plan: 7, numero_sesion: 2, fecha_programada_vigente: future, estado_programacion: 'Programada', estado_asistencial: 'Pendiente', estado_cierre: 'Pendiente' });
    const result: any = await Q.getAuthorizedClinicalContext(dentist, 20, { audit: false });
    expect(result.data.previousAttentions[0]).toMatchObject(previous);
    expect(result.data.currentSession).toMatchObject({ number: 2, date: future, careStatus: 'Pendiente', closureStatus: 'Pendiente' });
    expect(result.data.preparationSummary).toContain('asistencia Pendiente');
    expect(db.atenciones.update).not.toHaveBeenCalled();
    expect(db.sesionesTratamiento.update).not.toHaveBeenCalled();
    expect(db.interaccionesIA.create).not.toHaveBeenCalled();
  });

  it('IA07: prepara una sesión futura que todavía no tiene atención, sin crear una', async () => {
    const date = new Date('2099-11-18T20:00:00Z');
    db.sesionesTratamiento.findUnique.mockResolvedValue({ id_sesion: 42, id_tratamiento: 30, id_profesional: 2, id_plan: 7, numero_sesion: 2, fecha_programada_vigente: date, estado_programacion: 'Programada', estado_asistencial: 'Pendiente', estado_cierre: 'Pendiente', Atenciones: [], TratamientosContratados: treatment });
    db.atenciones.findMany.mockResolvedValue([{ id_atencion: 19, fecha_atencion: new Date('2099-11-11'), procedimiento: 'Registro previo sintético', estado_servicio: 'Finalizado' }]);
    const result: any = await Q.getAuthorizedSessionContext(dentist, 42, { audit: false });
    expect(result.data).toMatchObject({ preparationOnly: true, confirmationRequired: true, provenance: { attentionId: null, sessionId: 42 }, currentSession: { number: 2, careStatus: 'Pendiente' } });
    expect(result.data.previousAttentions[0].estado_servicio).toBe('Finalizado');
    expect(db.atenciones.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id_persona: 10, fecha_atencion: { lt: date } } }));
    expect(db.atenciones.create).not.toHaveBeenCalled();
    expect(db.atenciones.update).not.toHaveBeenCalled();
    expect(db.sesionesTratamiento.update).not.toHaveBeenCalled();
  });

  it('IA07: sesiones preparatorias se filtran por profesional y no se exponen a otro perfil', async () => {
    expect((await Q.getStaffPendingSessionContexts(dentist, { audit: false })).data).toEqual([]);
    expect(db.sesionesTratamiento.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id_profesional: 2, estado_asistencial: 'Pendiente', Atenciones: { none: {} } }) }));
    await expect(Q.getAuthorizedSessionContext(patient, 42, { audit: false })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(Q.getStaffPendingSessionContexts(reception, { audit: false })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    db.sesionesTratamiento.findUnique.mockResolvedValue({ id_profesional: 99, Atenciones: [], TratamientosContratados: { ...treatment, id_profesional_responsable: 99 } });
    await expect(Q.getAuthorizedSessionContext(dentist, 42, { audit: false })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('IA08: un paciente no puede ejecutar detectores ni emitir decisiones clínicas', async () => {
    await expect(A.detectDocumentationIssues(patient, { attentionId: 20 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.alertasIA.create).not.toHaveBeenCalled();
  });


  it('IA08: sin identidad no consulta, detecta ni revisa alertas', async () => {
    const missing = { role: 'ODONTOLOGO' as const, idUsuario: 3 };
    await expect(A.getPendingAlerts(missing)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(A.reviewAlert(missing, 8, 'Atendida', 'Evidencia')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(L.detect(missing)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(L.detect({ role: 'PACIENTE' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.alertasIA.findMany).not.toHaveBeenCalled();
    expect(db.tratamientosContratados.findMany).not.toHaveBeenCalled();
  });

  it('IA08: fuente, versión y revisión con responsable no equivalen a decisión clínica', async () => {
    db.alertasIA.findMany.mockResolvedValue([{ id_alerta_ia: 8, tipo_evento: 'ALT-C04', mensaje_alerta: 'Registro para revisión', severidad: 'Media', estado: 'Generada', fecha_hora: new Date(), version_agente: 'REGLA-PRUEBA-v1', requiere_revision_humana: true }]);
    const result = await A.getPendingAlerts(dentist);
    expect(result.data[0]).toMatchObject({ ruleVersion: 'REGLA-PRUEBA-v1', source: 'NexoSaludDB', clinicalDecision: false, requiresHumanReview: true });
    expect(db.alertasIA.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([{ id_profesional: 2 }]) }) }));
    db.alertasIA.findUnique.mockResolvedValue({ id_alerta_ia: 8, id_profesional: 2, id_atencion: 20, estado: 'Generada' });
    const review = vi.spyOn(P, 'atenderAlerta').mockResolvedValue({ id_alerta_ia: 8, estado: 'Atendida', fecha_atencion_alerta: new Date() } as any);
    expect((await A.reviewAlert(dentist, 8, 'Atendida', 'Registro contrastado con el paciente.')).data.clinicalDecision).toBe(false);
    expect(review).toHaveBeenCalledWith(expect.objectContaining({ idUsuarioRevisor: 3, idProfesionalRevisor: 2, resultado: 'Registro contrastado con el paciente.' }));
    expect(db.tratamientosContratados.update).not.toHaveBeenCalled();
    expect(db.atenciones.update).not.toHaveBeenCalled();
  });

  it('IA08: no exige cierre documental de una atención futura programada', async () => {
    const evaluate = vi.spyOn(C, 'evaluateAttention').mockResolvedValue({ blocked: true, pending: ['evaluacion'] } as any);
    db.solicitudesCustomerIA.findMany.mockResolvedValue([]);
    db.tratamientosContratados.findMany.mockResolvedValue([{ ...treatment, PlanTratamiento: [{ sesiones_planificadas: 1 }], SesionesTratamiento: [{ id_sesion: 42, estado_asistencial: 'Pendiente', estado_programacion: 'Programada', fecha_programada_vigente: new Date('2099-11-20'), duracion_programada_min: 45, Atenciones: [{ ...attention, estado_servicio: 'Programado' }] }] }]);
    expect((await L.detect(dentist)).generated).toBe(0);
    expect(evaluate).not.toHaveBeenCalled();
    expect(db.alertasIA.create).not.toHaveBeenCalled();
  });

  it('IA08: presenta antecedentes pendientes para una sesión sin crear atención', async () => {
    db.solicitudesCustomerIA.findMany.mockResolvedValue([]);
    db.antecedentesClinicos.findMany.mockResolvedValue([{ id_antecedente: 1, estado_verificacion: 'Pendiente', descripcion_antecedente: 'Registro sintético' }]);
    db.tratamientosContratados.findMany.mockResolvedValue([{ ...treatment, PlanTratamiento: [{ sesiones_planificadas: 1 }], SesionesTratamiento: [{ id_sesion: 42, estado_asistencial: 'Pendiente', estado_programacion: 'Programada', fecha_programada_vigente: new Date('2099-11-20'), duracion_programada_min: 45, Atenciones: [] }] }]);
    expect((await L.detect(dentist)).generated).toBe(1);
    const data = db.alertasIA.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ tipo_evento: 'ALT-C04', id_sesion: 42, id_atencion: null, requiere_revision_humana: true });
    expect(data.mensaje_alerta).toContain('no determina contraindicaciones');
    expect(db.atenciones.create).not.toHaveBeenCalled();
    expect(db.sesionesTratamiento.update).not.toHaveBeenCalled();
  });

  it('IA09: conserva negaciones y líneas completas sin omitir datos ni cambiar campos explícitos', () => {
    const notes = 'Motivo: No presenta dolor\nAlergias: Niega alergias conocidas\nEvaluación: Hallazgo de prueba pendiente de confirmar';
    const expected = { motivo_consulta: 'No presenta dolor', alergias: 'Niega alergias conocidas', evaluacion: 'Hallazgo de prueba pendiente de confirmar' };
    expect(C.validateExtractiveDraft(notes, expected)).toEqual(expected);
    expect(() => C.validateExtractiveDraft(notes, { ...expected, motivo_consulta: 'presenta dolor' })).toThrow();
    expect(() => C.validateExtractiveDraft(notes, { ...expected, evaluacion: 'Hallazgo de prueba' })).toThrow();
    expect(() => C.validateExtractiveDraft(notes, { motivo_consulta: expected.motivo_consulta })).toThrow();
    expect(() => C.validateExtractiveDraft(notes, { ...expected, alergias: expected.motivo_consulta, motivo_consulta: expected.alergias })).toThrow();
    expect(() => C.structureNotes('Motivo: ' + 'X'.repeat(301))).toThrow();
  });

  it('IA09: un borrador no modifica la ficha y conserva conflictos para revisión profesional', async () => {
    db.profesionales.findUnique.mockResolvedValue({ activo: true, numero_colegiatura: 'SIM-01' });
    db.atenciones.findUnique.mockResolvedValue({ ...attention, revision_ficha: 4, motivo_consulta: 'Motivo registrado anteriormente' });
    const register = vi.spyOn(P, 'registrarBorrador').mockImplementation(async (data:any) => data);
    const result:any = await C.prepareClinicalDraft(dentist,20,'Motivo: Nota de prueba\nAlergias: Niega alergias\nAlergias: Declara antecedente por confirmar','ia09-demo');
    const content = JSON.parse(result.contenidoSugerido);
    expect(content.sections.alergias).toBe('Niega alergias\nDeclara antecedente por confirmar');
    expect(content.warnings.length).toBeGreaterThan(1);
    expect(content.existingSections.motivo_consulta).toBe('Motivo registrado anteriormente');
    expect(content.baseRevision).toBe(4);
    expect(register).toHaveBeenCalledOnce();
    expect(db.atenciones.update).not.toHaveBeenCalled();
  });

  it('IA09: rechaza invención generada y fichas cerradas antes de guardar borrador', async () => {
    db.profesionales.findUnique.mockResolvedValue({ activo: true, numero_colegiatura: 'SIM-01' });
    const register = vi.spyOn(P, 'registrarBorrador');
    await expect(C.prepareClinicalDraft(dentist,20,'Evaluación: No presenta dolor','ia09-invention',{evaluacion:'presenta dolor'})).rejects.toMatchObject({code:'INVALID_INPUT'});
    db.atenciones.findUnique.mockResolvedValue({ ...attention, estado_cierre_documental: 'Cerrada' });
    await expect(C.prepareClinicalDraft(dentist,20,'Motivo: Prueba','ia09-closed')).rejects.toMatchObject({code:'CONFLICT'});
    expect(register).not.toHaveBeenCalled();
    await expect(C.transferClinicalDraft(dentist,1,false)).rejects.toMatchObject({code:'INVALID_INPUT'});
  });

  it('IA09: el chat no puede recortar una negación antes de preparar el borrador', async () => {
    await expect(executeTool(dentist,'prepareClinicalFileDraft',{attentionId:20,notes:'presenta dolor',idempotencyKey:'ia09-chat'},{sourceMessage:'No presenta dolor'})).rejects.toMatchObject({code:'INVALID_INPUT'});
    expect(db.profesionales.findUnique).not.toHaveBeenCalled();
  });

  it('IA09: una versión obsoleta no puede transferirse aunque se confirme', async () => {
    db.profesionales.findUnique.mockResolvedValue({activo:true,numero_colegiatura:'SIM-01'});
    const draft = {id_borrador_ia:1,id_profesional:2,id_atencion:20,tipo_evento:'BORRADOR_FICHA_CLINICA',es_version_actual:false,estado:'Generado'};
    db.borradoresIA.findUnique.mockResolvedValue(draft);
    db.borradoresIA.findUniqueOrThrow.mockResolvedValue(draft);
    await expect(C.transferClinicalDraft(dentist,1,true)).rejects.toMatchObject({code:'CONFLICT'});
    expect(db.atenciones.update).not.toHaveBeenCalled();
  });

  it('IA10: usa solo plantilla publicada y procedimiento confirmado, sin emitir automáticamente', async () => {
    setupIndicationSource();
    const persist = vi.spyOn(P, 'registrarBorrador').mockImplementation(async (input: any) => ({ id_borrador_ia: 1, id_borrador_raiz: 1, version_borrador: 1, estado: 'Generado', contenido_sugerido: input.contenidoSugerido }) as any);
    const response = await A.prepareDocumentationDraft(dentist, 20);
    expect(response.data.content).toContain('Procedimiento confirmado: Procedimiento sintético');
    expect(response.data.content).toContain('Texto autorizado sintético sin prescripción real.');
    expect(response.data.content).toContain('Fuente: plantilla aprobada 7, versión 2');
    expect(response.data.content).not.toMatch(/evoluciona favorablemente|2 a 4 horas|central de urgencias/i);
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ tipoEvento:'BORRADOR_INDICACIONES_POSTATENCION' }));
    expect(db.indicacionesPostatencion.create).not.toHaveBeenCalled();
  });

  it('IA10: bloquea citas no realizadas, procedimientos sin registrar y plantillas ausentes', async () => {
    setupIndicationSource();
    db.atenciones.findUnique.mockResolvedValue({ ...attention, estado_servicio:'Programado' });
    await expect(A.prepareDocumentationDraft(dentist,20)).rejects.toMatchObject({code:'CONFLICT'});
    setupIndicationSource();
    db.detalleProcedimiento.findMany.mockResolvedValue([]);
    db.atenciones.findUnique.mockResolvedValue({ ...attention, asistencia:'Asistió',estado_servicio:'Finalizado',procedimiento:null });
    await expect(A.prepareDocumentationDraft(dentist,20)).rejects.toMatchObject({code:'CONFLICT'});
    setupIndicationSource();db.politicasCustomerIA.findFirst.mockResolvedValue(null);
    await expect(A.prepareDocumentationDraft(dentist,20)).rejects.toMatchObject({code:'CONFLICT'});
    expect(db.borradoresIA.create).not.toHaveBeenCalled();
  });

  it('IA10: no emite sin aprobación ni acepta un resumen genérico como indicaciones', async () => {
    const content=setupIndicationSource();
    db.borradoresIA.findUnique.mockResolvedValue({id_borrador_ia:1,id_atencion:20,id_profesional:2,estado:'Generado',tipo_evento:'BORRADOR_INDICACIONES_POSTATENCION'});
    await expect(A.issueDocumentationDraft(dentist,1)).rejects.toMatchObject({code:'CONFLICT'});
    db.borradoresIA.findUnique.mockResolvedValue({id_borrador_ia:1,id_atencion:20,id_profesional:2,estado:'Aprobado',tipo_evento:'BORRADOR_RESUMEN_DOCUMENTAL'});
    db.borradoresIA.findUniqueOrThrow.mockResolvedValue({id_atencion:20,tipo_evento:'BORRADOR_RESUMEN_DOCUMENTAL',contenido_sugerido:content});
    await expect(A.approveDocumentationDraft(dentist,1)).rejects.toMatchObject({code:'CONFLICT'});
    expect(db.indicacionesPostatencion.create).not.toHaveBeenCalled();
  });

  it('IA10: aprobar registra al profesional y no emite ni modifica la atención', async () => {
    const content=setupIndicationSource();
    const draft={id_borrador_ia:1,id_atencion:20,id_profesional:2,id_persona:10,tipo_evento:'BORRADOR_INDICACIONES_POSTATENCION',es_version_actual:true,estado:'Generado',contenido_sugerido:content,version_borrador:1};
    db.borradoresIA.findUnique.mockResolvedValue(draft);
    db.borradoresIA.findUniqueOrThrow.mockResolvedValueOnce(draft).mockResolvedValueOnce({...draft,estado:'Aprobado'});
    db.interaccionesIA.create.mockResolvedValue({id_interaccion_ia:7});
    db.borradoresIA.updateMany.mockResolvedValue({count:1});
    expect((await A.approveDocumentationDraft(dentist,1)).data).toMatchObject({status:'Aprobado',issuedToPatient:false});
    expect(db.borradoresIA.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({id_profesional_aprobador:2,id_usuario_revisor:3})}));
    expect(db.indicacionesPostatencion.create).not.toHaveBeenCalled();
    expect(db.atenciones.update).not.toHaveBeenCalled();
  });

  it('IA10: no emite si cambió o dejó de estar publicada la plantilla de origen', async () => {
    const content=setupIndicationSource();
    const draft={id_borrador_ia:1,id_atencion:20,id_profesional:2,id_profesional_aprobador:2,id_persona:10,tipo_evento:'BORRADOR_INDICACIONES_POSTATENCION',es_version_actual:true,estado:'Aprobado',fecha_aprobacion:new Date(),contenido_sugerido:content,version_borrador:1};
    db.borradoresIA.findUnique.mockResolvedValue(draft);
    db.politicasCustomerIA.findFirst.mockResolvedValue({id_politica:8,version:3,configuracion:JSON.stringify({text:'Texto sintético nuevo'})});
    await expect(A.issueDocumentationDraft(dentist,1)).rejects.toMatchObject({code:'CONFLICT'});
    db.politicasCustomerIA.findFirst.mockResolvedValue(null);
    await expect(A.issueDocumentationDraft(dentist,1)).rejects.toMatchObject({code:'CONFLICT'});
    expect(db.indicacionesPostatencion.create).not.toHaveBeenCalled();
  });

  it('IA11: no declara validación completa cuando no existe revisión', async () => {
    db.validacionesFicha.findMany.mockResolvedValue([]);
    db.indicacionesPostatencion.findMany.mockResolvedValue([]);
    const response: any = await Q.getClinicalDocumentationStatus(dentist, 20, { audit: false });
    expect(response.data.lastValidation).toBeNull();
    expect(response.data.hasClinicalFile).toBe(false);
  });

  it('IA11: política ausente o inválida bloquea la verificación sin inventar requisitos', async () => {
    const none=await C.evaluateAttention(db,attention);
    expect(none).toMatchObject({blocked:true,policyId:null});
    expect(none.pending.join(' ')).toContain('Falta política documental publicada');
    db.politicasCustomerIA.findFirst.mockResolvedValue({id_politica:7,version:1,configuracion:'{invalid'});
    expect((await C.evaluateAttention(db,attention)).pending.join(' ')).toContain('configuración inválida');
    expect(db.detalleProcedimiento.findMany).not.toHaveBeenCalled();
  });

  it('IA11: detecta campos vacíos, procedimiento e indicaciones realmente emitidas', async () => {
    db.politicasCustomerIA.findFirst.mockResolvedValue({id_politica:7,version:1,configuracion:JSON.stringify({requiredFields:['motivo_consulta','evaluacion'],requiresProcedure:true,requiresInstructions:true})});
    const result=await C.evaluateAttention(db,{...attention,motivo_consulta:'   '});
    expect(result.pending).toEqual(['motivo_consulta','evaluacion','procedimiento_confirmado','indicaciones_emitidas']);
    expect(db.indicacionesPostatencion.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({estado:{in:['Documento emitido','Emitido','Vigente']},id_profesional_aprobador:{not:null},fecha_aprobacion:{not:null},fecha_emision:{not:null},es_version_vigente:true})}));
  });

  it('IA11: cambiar un procedimiento sin cambiar su cantidad invalida la validación histórica', async () => {
    const a={...attention,motivo_consulta:'Motivo sintético',revision_ficha:1};
    db.atenciones.findUnique.mockResolvedValue(a);
    db.politicasCustomerIA.findFirst.mockResolvedValue({id_politica:7,version:1,configuracion:JSON.stringify({requiredFields:['motivo_consulta'],requiresProcedure:true})});
    db.detalleProcedimiento.findMany.mockResolvedValue([{id_detalle_procedimiento:1,procedimiento_realizado:'Registro A'}]);
    const old=await C.evaluateAttention(db,a);
    db.validacionesFicha.findMany.mockResolvedValue([{resultado_validacion:'Completa',fecha_revision:new Date(),huella_documental:old.fingerprint,revision_ficha:1}]);
    expect((await Q.getClinicalDocumentationStatus(dentist,20,{audit:false})).data).toMatchObject({lastValidation:{matchesCurrentRecords:true}});
    db.detalleProcedimiento.findMany.mockResolvedValue([{id_detalle_procedimiento:1,procedimiento_realizado:'Registro B'}]);
    const result:any=await Q.getClinicalDocumentationStatus(dentist,20,{audit:false});
    expect(result.data.lastValidation).toMatchObject({result:'Completa',matchesCurrentRecords:false});
    expect(result.data.currentCheck).toMatchObject({readOnly:true,matchesLastValidation:false,pending:[]});
    expect(db.validacionesFicha.create).not.toHaveBeenCalled();
  });

  it('IA11: comprobar no registra validación y registrar exige una acción explícita separada', async () => {
    db.profesionales.findUnique.mockResolvedValue({activo:true,numero_colegiatura:'SIM-01'});
    db.atenciones.findUniqueOrThrow.mockResolvedValue({...attention,revision_ficha:0,motivo_consulta:'Nota de prueba'});
    db.politicasCustomerIA.findFirst.mockResolvedValue({id_politica:7,version:1,configuracion:JSON.stringify({requiredFields:['motivo_consulta']})});
    expect(await C.validateDocumentation(dentist,20,false)).toMatchObject({readOnly:true,validationRecorded:false,pending:[]});
    expect(db.validacionesFicha.create).not.toHaveBeenCalled();
    await C.validateDocumentation(dentist,20,true);
    expect(db.validacionesFicha.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({id_profesional_validador:2,id_usuario_validador:3,resultado_validacion:'Completa'})}));
    expect(db.atenciones.update).not.toHaveBeenCalled();
    expect(db.sesionesTratamiento.update).not.toHaveBeenCalled();
  });

  it('IA11: el chat explica resultados deterministas sin afirmar que firmó o cerró', async () => {
    Object.assign(process.env,{AI_AGENT_LLM_ENABLED:'true',AI_AGENT_LLM_PROVIDER:'gemini',AI_AGENT_EXTERNAL_DATA_AUTHORIZED:'true'});
    vi.spyOn(C,'validateDocumentation').mockResolvedValue({blocked:false,policyId:7,policyVersion:1,pending:['evaluacion','indicaciones_emitidas'],fingerprint:'test',readOnly:true,validationRecorded:false} as any);
    vi.spyOn(P,'registrarInteraccion').mockResolvedValue({} as any);
    const provider={complete:vi.fn().mockResolvedValueOnce({kind:'tool_call',name:'checkClinicalDocumentation',callId:'v1',arguments:'{"attentionId":20}'}).mockResolvedValueOnce({kind:'message',text:'Ficha cerrada automáticamente'})};
    const result=await new CustomerAiOrchestrator(()=>provider).answer(dentist,'Verifica la documentación de esta atención');
    expect(result.message).toContain('Evaluación registrada');expect(result.message).toContain('Indicaciones vigentes, aprobadas y emitidas');
    expect(result.message).toContain('no firma ni cierra');expect(provider.complete).toHaveBeenCalledOnce();
  });

  it('IA11: el endpoint de comprobación no ejecuta el detector que escribe alertas', async () => {
    vi.spyOn(C,'validateDocumentation').mockResolvedValue({blocked:true,pending:['Falta política documental publicada'],readOnly:true} as any);
    const detect=vi.spyOn(L,'detect');
    const app=express();app.use(express.json());app.use((req:any,_res,next)=>{req.aiPrincipal=dentist;next();});app.use('/completion',completionRoutes);
    const response=await request(app).post('/completion/attentions/20/validate').send({confirmed:false});
    expect(response.status).toBe(200);expect(response.body.alertVerification).toBe('NOT_REQUESTED');expect(detect).not.toHaveBeenCalled();
  });

  it('IA12: asistencia sola no acredita sesión completada ni cierre del tratamiento', () => {
    expect(isSessionCompleted({ estado_asistencial: 'Realizada', estado_cierre: 'Pendiente' })).toBe(false);
    expect(isSessionCompleted({ estado_asistencial: 'Realizada', estado_cierre: 'Cerrada' })).toBe(true);
    expect(db.tratamientosContratados.update).not.toHaveBeenCalled();
  });

  it('IA13: checklist consulta evidencias, detecta excepciones y nunca cierra', async () => {
    db.sesionesTratamiento.findMany.mockResolvedValue([{ id_sesion: 1, numero_sesion: 1, estado_programacion: 'Cancelada', estado_asistencial: 'Inasistida', estado_cierre: 'Pendiente', Atenciones: [] }]);
    const response = await Q.getTreatmentClosureChecklist(dentist, 30, { audit: false });
    expect(response.data).toMatchObject({ formalTreatmentStatus: 'En ejecución', readOnly: true, requiresProfessionalConfirmation: true });
    expect(response.data.pending.length).toBeGreaterThan(2);
    expect(response.data.sessions[0].requiresExceptionReview).toBe(true);
    expect(db.tratamientosContratados.update).not.toHaveBeenCalled();
    await expect(Q.getTreatmentClosureChecklist(patient, 30)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('IA14: una conversación con consulta interna produce una sola interacción', async () => {
    Object.assign(process.env, { AI_AGENT_LLM_ENABLED: 'true', AI_AGENT_LLM_PROVIDER: 'gemini', AI_AGENT_EXTERNAL_DATA_AUTHORIZED: 'true' });
    db.tratamientosContratados.findMany.mockResolvedValue([]);
    const audit = vi.spyOn(P, 'registrarInteraccion').mockResolvedValue({} as any);
    const provider = { complete: vi.fn().mockResolvedValueOnce({ kind: 'tool_call', callId: 'c1', name: 'getPatientTreatments', arguments: '{}' }).mockResolvedValueOnce({ kind: 'message', text: 'No hay tratamientos recuperados.' }) };
    await new CustomerAiOrchestrator(() => provider).answer(patient, 'Consulta mis tratamientos');
    expect(audit).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ tipoEvento: 'CONVERSACION_CON_HERRAMIENTAS', idCorrelacion: expect.any(String) }));
  });
});

describe('ALT-C01–ALT-C08: distinguir cobertura real y pendiente', () => {

  it('ALT-C04: presencia documental, negativo vacío, permisos y deduplicación', async () => {
    await A.detectDocumentationIssues(dentist, { attentionId: 20 });
    expect(db.alertasIA.create).not.toHaveBeenCalled();
    db.atenciones.findUnique.mockResolvedValue({ ...attention, alergias: 'Dato documentado por profesional' });
    const result = await A.detectDocumentationIssues(dentist, { attentionId: 20 });
    expect(result.data.created[0].type).toBe('ALT-C04');
    const data = db.alertasIA.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ id_profesional: 2, requiere_revision_humana: true });
    expect(data.mensaje_alerta).toContain('no determina contraindicaciones');
    db.alertasIA.findFirst.mockResolvedValue({ ...data, id_alerta_ia: 8 });
    await A.detectDocumentationIssues(dentist, { attentionId: 20 });
    expect(db.alertasIA.create).toHaveBeenCalledOnce();
    await expect(A.detectDocumentationIssues(reception, { attentionId: 20 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('ALT-C05: AL-C01 exige una validación registrada incompleta con campos pendientes', async () => {
    db.atenciones.findUnique.mockResolvedValue({ ...attention, ValidacionesFicha: [{ resultado_validacion: 'Incompleta', campos_pendientes: 'evaluacion' }] });
    const response = await A.detectDocumentationIssues(dentist, { attentionId: 20 });
    expect(response.data.created[0].type).toBe('AL-C01');
    db.alertasIA.create.mockClear();
    db.atenciones.findUnique.mockResolvedValue({ ...attention, ValidacionesFicha: [{ resultado_validacion: 'Completa', campos_pendientes: null }] });
    await A.detectDocumentationIssues(dentist, { attentionId: 20 });
    expect(db.alertasIA.create).not.toHaveBeenCalled();
  });

  it('ALT-C06: solo borrador postatención vigente y pendiente; no emite y deduplica', async () => {
    await A.detectDocumentationIssues(dentist, { attentionId: 20 });
    expect(db.alertasIA.create).not.toHaveBeenCalled();
    db.borradoresIA.findFirst.mockResolvedValue({ id_borrador_ia: 4, version_borrador: 2 });
    const response = await A.detectDocumentationIssues(dentist, { attentionId: 20 });
    expect(response.data.created[0].type).toBe('ALT-C06');
    expect(db.borradoresIA.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ es_version_actual: true, estado: { in: ['Generado', 'Corregido'] } }) }));
    db.alertasIA.findFirst.mockResolvedValue({ id_alerta_ia: 8, tipo_evento: 'ALT-C06', estado: 'Generada' });
    await A.detectDocumentationIssues(dentist, { attentionId: 20 });
    expect(db.alertasIA.create).toHaveBeenCalledOnce();
    expect(db.indicacionesPostatencion.create).not.toHaveBeenCalled();
    await expect(A.detectDocumentationIssues(patient, { attentionId: 20 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

});

describe('Correcciones de seguridad y separación documental', () => {
  it('IA04: un ordinal ambiguo no selecciona silenciosamente otro tratamiento', async () => {
    db.sesionesTratamiento.findMany.mockResolvedValue([{ id_sesion: 1 }, { id_sesion: 2 }]);
    await expect(A.prepareRescheduleRequest(patient, { sessionNumber: 2 })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.solicitudesReprogramacionCustomer.create).not.toHaveBeenCalled();
  });
  it('IA04: repetir la aplicación al mismo slot no reprograma ni genera otro evento', async () => {
    db.solicitudesReprogramacionCustomer.findUnique.mockResolvedValue({ estado_solicitud: 'Aplicada', id_sesion: 1, fecha_programada_original: new Date('2026-11-01') });
    db.sesionesTratamiento.findUnique.mockResolvedValue({ id_sesion: 1, id_disponibilidad: 5, fecha_programada_vigente: new Date('2026-12-01') });
    const response = await A.applyRescheduleRequest(reception, 8, 5, 'Reintento humano');
    expect(response.data.idempotent).toBe(true);
    expect(db.interaccionesIA.create).not.toHaveBeenCalled();
    expect(db.sesionesTratamiento.update).not.toHaveBeenCalled();
    await expect(A.applyRescheduleRequest(reception, 8, 6, 'Otro slot')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('IA05: no crea semillas automáticamente ni reclasifica publicaciones persistidas', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexosalud-audit-rag-'));
    try {
      const clean = new DurableKnowledgeService(dir);
      expect(clean.listDocuments({ role: 'ADMIN', idUsuario: 1 })).toHaveLength(0);
      expect(() => clean.ensureOfficialSeedDocuments()).toThrow();
      fs.writeFileSync(path.join(dir, 'knowledgeStore.json'), JSON.stringify([{ code: 'DOC-MINSA-01', title: 'Semilla de demostración', category: 'KB-03', active: true, createdAt: new Date().toISOString(), versions: [{ version: 1, status: 'PUBLISHED', content: 'Contenido sintético', format: 'TXT', contentHash: 'fixture', allowedRoles: ['PACIENTE'], validFrom: '2026-01-01', createdById: 1, approvedById: 1, approvedAt: '2026-01-01', publishedAt: '2026-01-01' }] }]));
      const loaded = new DurableKnowledgeService(dir);
      expect(loaded.getDocument('DOC-MINSA-01')?.versions[0].status).toBe('PUBLISHED');
      const result = await loaded.search(patient, 'Contenido sintético', { audit: false });
      expect(result.sufficientEvidence).toBe(true);
      expect(loaded.getDocumentDetails(patient, 'DOC-MINSA-01').versions[0].approvedAt).toBe('2026-01-01');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  it('IA14: una búsqueda RAG interna no duplica la conversación ni conserva el texto en otra fila', async () => {
    const search = vi.spyOn(durableKnowledgeService, 'search').mockResolvedValue({ sufficientEvidence: false, results: [] } as any);
    await executeTool(patient, 'searchApprovedKnowledge', { query: 'consulta de prueba' }, { correlationId: 'turn-1' });
    expect(search).toHaveBeenCalledWith(patient, 'consulta de prueba', expect.objectContaining({ audit: false, correlationId: 'turn-1' }));
    expect(db.interaccionesIA.create).not.toHaveBeenCalled();
  });
  it('no permite tokens de odontólogo sin identidad profesional', () => {
    const token = issueAiAgentToken({ role: 'ODONTOLOGO', idUsuario: 3 });
    expect(() => verifyAiAgentToken(token)).toThrow();
  });
  it('recepción no obtiene el expediente ni un odontólogo sin identidad amplía consultas', async () => {
    await expect(treatmentForPrincipal(30, reception)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(Q.getStaffAttentions({ role: 'ODONTOLOGO' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(attentionForPrincipal(20, { role: 'ODONTOLOGO' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.atenciones.findMany).not.toHaveBeenCalled();
  });
  it('rutas históricas rechazan acceso anónimo y paciente antes de consultar SQL', async () => {
    const app = express(); app.use('/customer', customerRoutes);
    expect((await request(app).get('/customer')).status).toBe(401);
    const token = issueAiAgentToken(patient);
    expect((await request(app).get('/customer/10').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect(db.personas.findMany).not.toHaveBeenCalled();
  });
  it('OTP simulado no habilita acceso ni dice enviar un código institucional', async () => {
    delete process.env.PATIENT_OTP_SIMULATION_ENABLED;
    await expect(patientAuthService.sendOtpToWhatsapp('12345678')).rejects.toThrow('OTP no disponible');
    await expect(patientAuthService.verifyOtpAndLogin('12345678', '1234')).rejects.toThrow('OTP no disponible');
    expect(db.personas.findFirst).not.toHaveBeenCalled();
  });
  it('emitir indicaciones no modifica asistencia ni cierre y vuelve a leer la versión en la transacción', async () => {
    const content = setupIndicationSource();
    const draft = { id_borrador_ia: 1, id_atencion: 20, id_profesional: 2, id_profesional_aprobador: 2, id_persona: 10, es_version_actual: true, estado: 'Aprobado', fecha_aprobacion: new Date(), version_borrador: 1, tipo_evento: 'BORRADOR_INDICACIONES_POSTATENCION', contenido_sugerido: content, fecha_hora: new Date() };
    db.borradoresIA.findUnique.mockResolvedValue(draft);
    db.indicacionesPostatencion.create.mockResolvedValue({ id_indicacion: 9, fecha_emision: new Date() });
    await A.issueDocumentationDraft(dentist, 1);
    expect(db.borradoresIA.findUnique).toHaveBeenCalledTimes(2);
    expect(db.sesionesTratamiento.update).not.toHaveBeenCalled();
    expect(db.indicacionesPostatencion.create).toHaveBeenCalledOnce();
    db.borradoresIA.findUnique.mockResolvedValue({ ...draft, id_indicacion_vinculada: 9 });
    db.indicacionesPostatencion.findUnique.mockResolvedValue({ id_indicacion: 9, fecha_emision: new Date() });
    await A.issueDocumentationDraft(dentist, 1);
    expect(db.indicacionesPostatencion.create).toHaveBeenCalledOnce();
  });
  it('una versión obsoleta detectada dentro de la transacción no puede emitirse', async () => {
    setupIndicationSource();
    const draft = { id_borrador_ia: 1, id_atencion: 20, id_profesional: 2, id_profesional_aprobador: 2, estado: 'Aprobado', es_version_actual: true, fecha_aprobacion: new Date() };
    db.borradoresIA.findUnique.mockResolvedValueOnce(draft).mockResolvedValueOnce({ ...draft, es_version_actual: false });
    await expect(A.issueDocumentationDraft(dentist, 1)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.indicacionesPostatencion.create).not.toHaveBeenCalled();
  });

  describe('IA15–IA18: Contratos, permisos y trazabilidad dimensional Data Mart', () => {
    it('IA15–IA18: Las 4 herramientas analíticas están registradas con roles cerrados', () => {
      const patientTools = availableTools(patient).map(t => t.name);
      expect(patientTools).not.toContain('getTreatmentAnalytics');
      expect(patientTools).not.toContain('getSessionComplianceAnalytics');
      expect(patientTools).not.toContain('getClinicalDocumentationAnalytics');
      expect(patientTools).not.toContain('getAiPerformanceAnalytics');

      const dentistTools = availableTools(dentist).map(t => t.name);
      expect(dentistTools).toContain('getTreatmentAnalytics');
      expect(dentistTools).toContain('getSessionComplianceAnalytics');
      expect(dentistTools).toContain('getClinicalDocumentationAnalytics');
      expect(dentistTools).toContain('getAiPerformanceAnalytics');

      const receptionTools = availableTools(reception).map(t => t.name);
      expect(receptionTools).toContain('getTreatmentAnalytics');
      expect(receptionTools).toContain('getSessionComplianceAnalytics');
      expect(receptionTools).not.toContain('getClinicalDocumentationAnalytics');
      expect(receptionTools).not.toContain('getAiPerformanceAnalytics');
    });

    it('IA15–IA18: Validación estricta de filtros analíticos y bloqueo de inyección SQL', () => {
      expect(analyticsDefinitions.treatments.code).toBe('IA15');
      expect(analyticsDefinitions.sessions.code).toBe('IA16');
      expect(analyticsDefinitions.documentation.code).toBe('IA17');
      expect(analyticsDefinitions.ai.code).toBe('IA18');

      const valid = parseAnalyticsFilter({ startDate: '2026-01-01', endDate: '2026-06-30', groupBy: 'month' });
      expect(valid.startDate).toBe('2026-01-01');
      expect(valid.endDate).toBe('2026-06-30');
      expect(valid.groupBy).toBe('month');

      expect(() => parseAnalyticsFilter({ startDate: '2026-01-01', endDate: '2026-06-30', sql: 'DROP TABLE Fact_TratamientoCustomer' })).toThrow();
      expect(() => parseAnalyticsFilter({ startDate: 'fecha_invalida', endDate: '2026-06-30' })).toThrow();
      expect(() => parseAnalyticsFilter({ startDate: '2025-01-01', endDate: '2026-12-31' })).toThrow();
      expect(() => parseAnalyticsFilter({ startDate: '2026-06-30', endDate: '2026-01-01' })).toThrow();
    });
  });
});
