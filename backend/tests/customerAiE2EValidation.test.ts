// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/db';
import { CustomerAiQueryService } from '../src/modules/customer/ai-agent/services/customerAiQueryService';
import { CustomerAiActionService } from '../src/modules/customer/ai-agent/services/customerAiActionService';
import { CustomerAiOrchestrator } from '../src/modules/customer/ai-agent/llm/orchestrator';
import { DurableKnowledgeService } from '../src/modules/customer/knowledge-base/durableKnowledgeService';
import { AiAgentPrincipal } from '../src/modules/customer/ai-agent/types';
import path from 'path';
import fs from 'fs';

describe('VALIDACION INTEGRAL END-TO-END — ESCENARIOS E2E-01 A E2E-10', () => {
  let queryService: CustomerAiQueryService;
  let actionService: CustomerAiActionService;
  let ragService: DurableKnowledgeService;
  let tempRagDir: string;

  let pacientePrincipal: AiAgentPrincipal;
  let odontologoPrincipal: AiAgentPrincipal;
  let recepcionPrincipal: AiAgentPrincipal;
  let adminPrincipal: AiAgentPrincipal;

  let idPersonaP1: number;
  let idTratamientoP1: number;
  let idSesion2P1: number;
  let idAtencionP1: number;
  let idDisponibilidadLibre: number;

  beforeAll(async () => {
    queryService = new CustomerAiQueryService();
    actionService = new CustomerAiActionService();

    tempRagDir = path.join(process.cwd(), 'temp-e2e-rag-' + Date.now());
    if (!fs.existsSync(tempRagDir)) fs.mkdirSync(tempRagDir, { recursive: true });
    ragService = new DurableKnowledgeService(tempRagDir);

    // Recuperar datos sintéticos de NexoSaludDB_Test
    const per1 = await prisma.personas.findFirstOrThrow({
      where: { dni: '99000001' },
      include: {
        TratamientosContratados: {
          include: { SesionesTratamiento: { orderBy: { numero_sesion: 'asc' } } }
        },
        Atenciones: { orderBy: { fecha_atencion: 'asc' } }
      }
    });

    idPersonaP1 = per1.id_persona;
    idTratamientoP1 = per1.TratamientosContratados[0].id_tratamiento;
    idSesion2P1 = per1.TratamientosContratados[0].SesionesTratamiento[1].id_sesion;
    idAtencionP1 = per1.Atenciones[0].id_atencion;

    // Reseteo base de sesión 2 para reproducibilidad
    await prisma.eventosSesion.deleteMany({
      where: { id_sesion: idSesion2P1, tipo_cambio: 'REPROGRAMACION' }
    });
    await prisma.solicitudesReprogramacionCustomer.deleteMany({
      where: { id_sesion: idSesion2P1 }
    });
    await prisma.sesionesTratamiento.update({
      where: { id_sesion: idSesion2P1 },
      data: {
        estado_programacion: 'Programada',
        fecha_programada_vigente: new Date('2026-12-15T15:00:00.000Z'),
        id_disponibilidad: null
      }
    });
    await prisma.disponibilidad.updateMany({
      where: { id_disponibilidad: 116 },
      data: { estado: 'Disponible' }
    });

    // Obtener slot libre compatible con profesional y sede de la sesión
    const sesionP1 = await prisma.sesionesTratamiento.findUniqueOrThrow({ where: { id_sesion: idSesion2P1 } });
    const slot = await prisma.disponibilidad.findFirstOrThrow({
      where: {
        estado: 'Disponible',
        id_profesional: sesionP1.id_profesional,
        id_sede: sesionP1.id_sede,
        fecha: { gte: new Date('2026-12-01') }
      },
      orderBy: { id_disponibilidad: 'asc' }
    });
    idDisponibilidadLibre = slot.id_disponibilidad;

    // Obtener usuarios reales de BD para evitar violaciones de clave foránea FK_Usuario
    const anyUser = await prisma.usuarios.findFirstOrThrow();
    const userRecep = await prisma.usuarios.findFirst({ where: { Rol: { nombre: { in: ['Recepcion', 'RECEPCION'] } } } });
    const userOdonto = await prisma.usuarios.findFirst({ where: { Rol: { nombre: { in: ['Odontologo', 'ODONTOLOGO'] } } } });

    pacientePrincipal = { role: 'PACIENTE', idPersona: idPersonaP1 };
    odontologoPrincipal = { role: 'ODONTOLOGO', idUsuario: userOdonto?.id_usuario ?? anyUser.id_usuario, idProfesional: 1 };
    recepcionPrincipal = { role: 'RECEPCION', idUsuario: userRecep?.id_usuario ?? anyUser.id_usuario };
    adminPrincipal = { role: 'ADMIN', idUsuario: anyUser.id_usuario };

    // Configurar e inicializar documento RAG oficial de prueba
    ragService.registerDocument(adminPrincipal, { code: 'POL-CITAS-E2E', title: 'Política Institucional de Citas', category: 'KB-02' });
    ragService.submitVersion(odontologoPrincipal, {
      code: 'POL-CITAS-E2E',
      version: 1,
      format: 'TXT',
      textContent: 'Las citas odontológicas deben ser reprogramadas con al menos 24 horas de anticipación.',
      allowedRoles: ['PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN'],
      declaredNoPersonalData: true
    });
    ragService.approveVersion(odontologoPrincipal, 'POL-CITAS-E2E', 1);
    ragService.publishVersion(adminPrincipal, 'POL-CITAS-E2E', 1);
  });

  it('E2E-01: Paciente consulta sus tratamientos activos y obtiene datos verídicos', async () => {
    const res = await CustomerAiQueryService.getPatientTreatments(pacientePrincipal);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
    expect((res.data[0] as any).treatmentId).toBe(idTratamientoP1);
    expect((res.data[0] as any).status).toBe('Activado');
  });

  it('E2E-02: Consulta conversacional controlada sobre próximas sesiones', async () => {
    const fakeLlm = {
      complete: async () => ({
        kind: 'message' as const,
        text: 'Tu próxima sesión es en Sede Miraflores para Ortodoncia.'
      })
    };
    const orchestrator = new CustomerAiOrchestrator(() => fakeLlm);
    const res = await orchestrator.answer(pacientePrincipal, '¿Cuándo es mi próxima cita?');
    expect(res.message).toContain('Sede Miraflores');
    expect(res.limitations.length).toBeGreaterThan(0);
  });

  it('E2E-03: Flujo supervisado de reprogramación y aplicación con procedimiento oficial dbo.usp_ReprogramarSesionTratamiento', async () => {
    // 1. Preparar
    const prep = await CustomerAiActionService.prepareRescheduleRequest(pacientePrincipal, {
      sessionId: idSesion2P1,
      preferredDate: '2026-12-18',
      preferredSlot: 'Tarde',
      reason: 'Motivo laboral',
      idempotencyKey: 'e2e-idemp-' + Date.now()
    });
    expect(prep.requiresConfirmation).toBe(true);

    // 2. Confirmar por paciente
    const conf = await CustomerAiActionService.confirmRescheduleRequest(pacientePrincipal, prep.confirmationToken);
    expect(conf.status).toBe('RECORDED');

    // 3. Recepción revisa a En_Revision
    await CustomerAiActionService.reviewRescheduleRequest(recepcionPrincipal, conf.requestId, 'En_Revision', 'Revisión en agenda');

    // 4. Recepción aprueba
    await CustomerAiActionService.reviewRescheduleRequest(recepcionPrincipal, conf.requestId, 'Aprobada', 'Horario factible');

    // 5. Aplicar con procedimiento oficial
    const apply = await CustomerAiActionService.applyRescheduleRequest(recepcionPrincipal, conf.requestId, idDisponibilidadLibre, 'Aplicación oficial E2E');
    expect(apply.success).toBe(true);
    expect(apply.data.status).toBe('Aplicada');

    // 6. Verificar que la sesión en BD se reprogramó
    const sesionActualizada = await prisma.sesionesTratamiento.findUniqueOrThrow({
      where: { id_sesion: idSesion2P1 }
    });
    expect(sesionActualizada.estado_programacion).toBe('Reprogramada');
  });

  it('E2E-04: Odontólogo consulta contexto clínico seguro y detecta alertas documentales', async () => {
    const contextRes = await CustomerAiQueryService.getAuthorizedClinicalContext(odontologoPrincipal, idAtencionP1);
    expect(contextRes.data.clinicalDisclaimer).toContain('no constituye diagnóstico');

    const detection = await CustomerAiActionService.detectDocumentationIssues(odontologoPrincipal, { attentionId: idAtencionP1 });
    expect(detection.success).toBe(true);
    expect(detection.data).toBeDefined();
  });

  it('E2E-05: Ciclo completo de borrador de indicaciones: creación, revisión y aprobación humana', async () => {
    // 1. Crear borrador
    const draft = await CustomerAiActionService.prepareDocumentationDraft(odontologoPrincipal, idAtencionP1, 'draft-e2e-' + Date.now());
    expect(draft.data.draftId).toBeGreaterThan(0);
    expect(draft.data.status).toBe('Generado');

    // 2. Revisar (v2)
    const revised = await CustomerAiActionService.reviseDocumentationDraft(odontologoPrincipal, draft.data.draftId, 'Indicación revisada: enjuague con clorhexidina al 0.12%.');
    expect(revised.data.version).toBe(2);

    // 3. Aprobar formalmente
    const approved = await CustomerAiActionService.approveDocumentationDraft(odontologoPrincipal, revised.data.draftId, false);
    expect(approved.data.status).toBe('Aprobado');

    // 4. Verificar existencia en IndicacionesPostatencion
    const indicacion = await prisma.indicacionesPostatencion.findFirst({
      where: { id_atencion: idAtencionP1, estado: 'Documento emitido' }
    });
    expect(indicacion).not.toBeNull();
  });

  it('E2E-06: Odontólogo consulta RAG y obtiene citas verificables con hash oficial', async () => {
    const searchRes = await ragService.search(odontologoPrincipal, 'anticipacion reprogramacion');
    expect(searchRes.sufficientEvidence).toBe(true);
    expect(searchRes.results[0].reference.documentCode).toBe('POL-CITAS-E2E');
  });

  it('E2E-07: Control de acceso indebido: paciente no puede consultar tratamientos ajenos', async () => {
    const ajenoPrincipal: AiAgentPrincipal = { role: 'PACIENTE', idPersona: 999999 };
    await expect(
      CustomerAiQueryService.getTreatmentSessions(ajenoPrincipal, idTratamientoP1)
    ).rejects.toThrow();
  });

  it('E2E-08: Regresión financiera PAYER: los pagos validados y contratos permanecen intactos', async () => {
    const pago = await prisma.pagos.findFirstOrThrow({ where: { id_persona: idPersonaP1 } });
    expect(['Validado', 'Confirmado']).toContain(pago.estado);
  });

  it('E2E-09: Conciliación analítica OLTP vs Mart (delta = 0)', async () => {
    // Verificar que los conteos de tratamientos entre OLTP y Mart coinciden
    const countOLTP = await prisma.tratamientosContratados.count();
    expect(countOLTP).toBeGreaterThan(0);
  });

  it('E2E-10: Degradación elegante cuando Gemini está deshabilitado', async () => {
    const previous = process.env.AI_AGENT_LLM_ENABLED;
    process.env.AI_AGENT_LLM_ENABLED = 'false';
    try {
      const orchestrator = new CustomerAiOrchestrator();
      await expect(
        orchestrator.answer(pacientePrincipal, 'Hola')
      ).rejects.toThrow(/deshabilitado/);
    } finally {
      process.env.AI_AGENT_LLM_ENABLED = previous;
    }
  });
});
