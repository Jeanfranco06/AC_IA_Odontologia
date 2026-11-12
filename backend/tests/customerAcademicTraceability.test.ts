import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('../src/db', () => {
  const model = () => ({ findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() });
  const prisma: any = Object.fromEntries(['personas', 'atenciones', 'tratamientosContratados', 'planTratamiento', 'sesionesTratamiento', 'antecedentesClinicos', 'indicacionesPostatencion', 'validacionesFicha', 'borradoresIA', 'alertasIA', 'interaccionesIA', 'profesionales', 'solicitudesReprogramacionCustomer','politicasCustomerIA','detalleProcedimiento'].map(name => [name, model()]));
  prisma.$transaction = vi.fn(async (callback: any) => callback(prisma));
  return { prisma, withRetry: (callback: any) => callback() };
});

import { prisma } from '../src/db';
import { CustomerAiQueryService as Q, isSessionCompleted } from '../src/modules/customer/ai-agent/services/customerAiQueryService';
import { CustomerAiActionService as A } from '../src/modules/customer/ai-agent/services/customerAiActionService';
import { CustomerAiPersistenceService as P } from '../src/services/customerAiPersistenceService';
import { attentionForPrincipal, treatmentForPrincipal } from '../src/modules/customer/ai-agent/policies';
import { availableTools, executeTool } from '../src/modules/customer/ai-agent/llm/toolRegistry';
import { CustomerAiOrchestrator } from '../src/modules/customer/ai-agent/llm/orchestrator';
import { issueAiAgentToken, verifyAiAgentToken } from '../src/modules/customer/ai-agent/authContext';
import { systemInstructions } from '../src/modules/customer/ai-agent/llm/systemInstructions';
import { analyticsDefinitions, parseAnalyticsFilter } from '../src/modules/customer/ai-agent/services/customerAnalyticsService';
import customerRoutes from '../src/routes/customer.routes';
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
  db.borradoresIA.findFirst.mockResolvedValue(null);
  db.politicasCustomerIA.findFirst.mockResolvedValue(null);
  db.alertasIA.findFirst.mockResolvedValue(null);
  db.alertasIA.findMany.mockResolvedValue([]);
  db.detalleProcedimiento.findMany.mockResolvedValue([]);
  db.alertasIA.create.mockImplementation(async ({ data }: any) => ({ ...data, id_alerta_ia: 8 }));
  process.env.AI_AGENT_SESSION_SECRET = 'traceability-test-secret';
});
afterEach(() => { vi.restoreAllMocks(); process.env = { ...env }; });

describe('IA01–IA14: verificación de contratos, sin conexión SQL ni proveedor externo', () => {
  it('IA01: conserva estados oficiales y rechaza tratamientos ajenos', async () => {
    db.sesionesTratamiento.findMany.mockResolvedValue([{ id_sesion: 1, numero_sesion: 1, fecha_programada_vigente: new Date(), estado_programacion: 'Reprogramada', estado_asistencial: 'Realizada', estado_cierre: 'Pendiente', Profesionales: { nombres: 'A', apellidos: 'B' }, Sedes: { nombre: 'Sede' } }]);
    db.sesionesTratamiento.count.mockResolvedValue(1);
    const response: any = await Q.getTreatmentSessions(patient, 30, {}, { audit: false });
    expect(response.data.items[0]).toMatchObject({ schedulingStatus: 'Reprogramada', careStatus: 'Realizada', closureStatus: 'Pendiente' });
    db.tratamientosContratados.findUnique.mockResolvedValue({ ...treatment, id_persona: 99 });
    await expect(Q.getTreatmentSessions(patient, 30)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('IA02: cuenta sesiones realizadas Y cerradas y maneja un plan vacío', async () => {
    db.sesionesTratamiento.findMany.mockResolvedValue([{ estado_asistencial: 'Realizada', estado_cierre: 'Cerrada', fecha_programada_vigente: new Date() }, { estado_asistencial: 'Realizada', estado_cierre: 'Pendiente' }]);
    expect((await Q.getTreatmentProgress(patient, 30, { audit: false })).data).toMatchObject({ completedSessions: 1, pendingSessions: 1, operationalProgressPercent: 50 });
    db.planTratamiento.findFirst.mockResolvedValue(null);
    db.sesionesTratamiento.findMany.mockResolvedValue([]);
    expect((await Q.getTreatmentProgress(patient, 30, { audit: false })).data).toMatchObject({ plannedSessions: 0, operationalProgressPercent: 0 });
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
    db.indicacionesPostatencion.findMany.mockResolvedValue([]);
    await Q.getApprovedAftercareInstructions(patient, 20, { audit: false });
    expect(db.indicacionesPostatencion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ fecha_aprobacion: { not: null }, fecha_emision: { not: null }, es_version_vigente: true }) }));
    expect(systemInstructions(patient)).toContain('sin modificar dosis, frecuencia, duración ni significado');
    db.atenciones.findUnique.mockResolvedValue({ ...attention, id_persona: 99 });
    await expect(Q.getApprovedAftercareInstructions(patient, 20)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('IA07: falta de alergias se identifica como no registrada; recepción no accede', async () => {
    db.atenciones.findMany.mockResolvedValue([]);
    const response: any = await Q.getAuthorizedClinicalContext(dentist, 20, { audit: false });
    expect(response.data.currentAttention).toMatchObject({ allergies: null, allergiesStatus: 'NO_REGISTRADA' });
    await expect(Q.getAuthorizedClinicalContext(reception, 20)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('IA08: un paciente no puede ejecutar detectores ni emitir decisiones clínicas', async () => {
    await expect(A.detectDocumentationIssues(patient, { attentionId: 20 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.alertasIA.create).not.toHaveBeenCalled();
  });


  it('IA10: el borrador no inventa evolución, cuidados ni procedimientos', async () => {
    const persist = vi.spyOn(P, 'registrarBorrador').mockImplementation(async (input: any) => ({ id_borrador_ia: 1, id_borrador_raiz: 1, version_borrador: 1, estado: 'Generado', contenido_sugerido: input.contenidoSugerido }) as any);
    const response = await A.prepareDocumentationDraft(dentist, 20);
    expect(response.data.content).toContain('NO REGISTRADO');
    expect(response.data.content).toContain('PENDIENTES');
    expect(response.data.content).not.toMatch(/evoluciona favorablemente|2 a 4 horas|central de urgencias/i);
    expect(persist).toHaveBeenCalledOnce();
  });

  it('IA11: no declara validación completa cuando no existe revisión', async () => {
    db.validacionesFicha.findMany.mockResolvedValue([]);
    db.indicacionesPostatencion.findMany.mockResolvedValue([]);
    const response: any = await Q.getClinicalDocumentationStatus(dentist, 20, { audit: false });
    expect(response.data.lastValidation).toBeNull();
    expect(response.data.hasClinicalFile).toBe(false);
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
  it('IA05: no publica automáticamente semillas ni recupera la v1 histórica autogenerada', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexosalud-audit-rag-'));
    try {
      const clean = new DurableKnowledgeService(dir);
      expect(clean.listDocuments({ role: 'ADMIN', idUsuario: 1 })).toHaveLength(0);
      expect(() => clean.ensureOfficialSeedDocuments()).toThrow();
      fs.writeFileSync(path.join(dir, 'knowledgeStore.json'), JSON.stringify([{ code: 'DOC-MINSA-01', title: 'Semilla de demostración', category: 'KB-03', active: true, createdAt: new Date().toISOString(), versions: [{ version: 1, status: 'PUBLISHED', content: 'Contenido sintético', format: 'TXT', contentHash: 'fixture', allowedRoles: ['PACIENTE'], validFrom: '2026-01-01', createdById: 1, approvedById: 1, approvedAt: '2026-01-01', publishedAt: '2026-01-01' }] }]));
      const loaded = new DurableKnowledgeService(dir);
      expect(loaded.getDocument('DOC-MINSA-01')?.versions[0].status).toBe('IN_REVIEW');
      const result = await loaded.search(patient, 'Contenido sintético', { audit: false });
      expect(result.sufficientEvidence).toBe(false);
      expect(() => loaded.getDocumentDetails(patient, 'DOC-MINSA-01')).toThrow();
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
    const draft = { id_borrador_ia: 1, id_atencion: 20, id_profesional: 2, id_profesional_aprobador: 2, id_persona: 10, es_version_actual: true, estado: 'Aprobado', fecha_aprobacion: new Date(), version_borrador: 1, contenido_sugerido: 'Texto revisado', fecha_hora: new Date() };
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
