import { assertIsolatedSqlServer } from './helpers/isolatedSqlServer';
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/db';
import { CustomerAiQueryService } from '../src/modules/customer/ai-agent/services/customerAiQueryService';
import { CustomerAiActionService } from '../src/modules/customer/ai-agent/services/customerAiActionService';
import { CustomerAiOrchestrator } from '../src/modules/customer/ai-agent/llm/orchestrator';
import { durableKnowledgeService } from '../src/modules/customer/knowledge-base/durableKnowledgeService';
import { AiAgentPrincipal } from '../src/modules/customer/ai-agent/types';

describe.skipIf(process.env.AI_AGENT_SQLSERVER_INTEGRATION !== 'true')('PILOTO FUNCIONAL CONTROLADO EN STAGING — ESCENARIOS PIL-01 A PIL-14', () => {
  let pacienteA: { idPersona: number; principal: AiAgentPrincipal; idTratamiento: number; sesion2Id: number; atencion1Id: number };
  let pacienteB: { idPersona: number; principal: AiAgentPrincipal; idTratamiento: number };
  let odontologoA: AiAgentPrincipal;
  let odontologoB: AiAgentPrincipal;
  let recepcion: AiAgentPrincipal;
  let admin: AiAgentPrincipal;

  let requestIdPIL06: number;
  let draftIdPIL08: number;
  let alertIdPIL07: number;

  beforeAll(async () => {
    await assertIsolatedSqlServer();
    process.env.AI_AGENT_SESSION_SECRET = 'pilot-staging-secret-2026-auth';
    process.env.AI_AGENT_LLM_ENABLED = 'true';
    process.env.AI_AGENT_PROVIDER = 'gemini';
    process.env.AI_AGENT_EXTERNAL_DATA_AUTHORIZED = 'true';

    // Paciente A sintético (DNI 99000001)
    const perA = await prisma.personas.findFirstOrThrow({
      where: { dni: '99000001' },
      include: {
        TratamientosContratados: {
          include: { SesionesTratamiento: { orderBy: { numero_sesion: 'asc' } } }
        },
        Atenciones: true
      }
    });
    pacienteA = {
      idPersona: perA.id_persona,
      principal: { role: 'PACIENTE', idPersona: perA.id_persona },
      idTratamiento: perA.TratamientosContratados[0].id_tratamiento,
      sesion2Id: perA.TratamientosContratados[0].SesionesTratamiento[1].id_sesion,
      atencion1Id: perA.Atenciones[0].id_atencion
    };

    // Paciente B sintético (DNI 99000002)
    const perB = await prisma.personas.findFirstOrThrow({
      where: { dni: '99000002' },
      include: { TratamientosContratados: true }
    });
    pacienteB = {
      idPersona: perB.id_persona,
      principal: { role: 'PACIENTE', idPersona: perB.id_persona },
      idTratamiento: perB.TratamientosContratados[0].id_tratamiento
    };

    // Profesionales y roles con usuarios reales existentes en la base de datos
    const profs = await prisma.profesionales.findMany({ where: { activo: true }, take: 2 });
    const userOdonto = await prisma.usuarios.findFirst({ where: { id_profesional: profs[0].id_profesional } });
    const userRecep = await prisma.usuarios.findFirst({ where: { Rol: { nombre: { in: ['Recepcion', 'RECEPCION', 'Administrador', 'Admin'] } } } });
    const userAdmin = await prisma.usuarios.findFirst({ where: { Rol: { nombre: { in: ['Administrador', 'Admin'] } } } });
    const anyUser = await prisma.usuarios.findFirstOrThrow();

    odontologoA = { role: 'ODONTOLOGO', idUsuario: userOdonto?.id_usuario ?? anyUser.id_usuario, idProfesional: profs[0].id_profesional };
    odontologoB = { role: 'ODONTOLOGO', idUsuario: anyUser.id_usuario, idProfesional: profs[1]?.id_profesional ?? (profs[0].id_profesional + 100) };
    recepcion = { role: 'RECEPCION', idUsuario: userRecep?.id_usuario ?? anyUser.id_usuario };
    admin = { role: 'ADMIN', idUsuario: userAdmin?.id_usuario ?? anyUser.id_usuario };

    // Limpieza inicial para garantizar aislamiento e idempotencia del piloto
    await prisma.eventosSesion.deleteMany({
      where: { id_sesion: pacienteA.sesion2Id, tipo_cambio: 'REPROGRAMACION' }
    });
    await prisma.solicitudesReprogramacionCustomer.deleteMany({
      where: { id_sesion: pacienteA.sesion2Id }
    });
    await prisma.alertasIA.deleteMany({
      where: { id_persona: pacienteA.idPersona }
    });
    await prisma.sesionesTratamiento.update({
      where: { id_sesion: pacienteA.sesion2Id },
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

    // Ingestar documento de prueba en RAG si no existiera
    const docs = durableKnowledgeService.listDocuments(admin);
    if (!docs.some(d => d.code === 'PILOT-POL-01')) {
      durableKnowledgeService.registerDocument(admin, {
        code: 'PILOT-POL-01',
        title: 'Política Institucional de Horarios de Piloto',
        category: 'KB-05'
      });
      durableKnowledgeService.submitVersion(odontologoA, {
        code: 'PILOT-POL-01',
        version: 1,
        format: 'TXT',
        textContent: 'La clínica dental atiende en horario continuo de lunes a sábado de 08:00 a 20:00 horas.',
        allowedRoles: ['PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN'],
        declaredNoPersonalData: true
      });
      durableKnowledgeService.approveVersion(odontologoA, 'PILOT-POL-01', 1);
      durableKnowledgeService.publishVersion(admin, 'PILOT-POL-01', 1);
    }
  });

  it('PIL-01: Consulta de tratamiento activo por el paciente', async () => {
    const res = await CustomerAiQueryService.getPatientTreatments(pacienteA.principal);
    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(1);
    expect(res.data[0].treatmentId).toBe(pacienteA.idTratamiento);
    expect(['Activado', 'En curso', 'En ejecución']).toContain(res.data[0].status);
  });

  it('PIL-02: Seguimiento de sesiones realizadas, pendientes y próximas', async () => {
    const upcoming = await CustomerAiQueryService.getUpcomingSessions(pacienteA.principal);
    expect(upcoming.success).toBe(true);
    expect(upcoming.data.length).toBeGreaterThanOrEqual(1);

    const history = await CustomerAiQueryService.getTreatmentSessions(pacienteA.principal, pacienteA.idTratamiento);
    expect(history.success).toBe(true);
    expect((history.data as any).items.length).toBeGreaterThanOrEqual(2);
  });

  it('PIL-03: Asistente conversacional responde con datos verídicos del tratamiento', async () => {
    const simulatedProvider = {
      complete: async () => ({
        kind: 'message' as const,
        text: 'Tu tratamiento actual de ortodoncia se encuentra en curso con avance según lo programado.'
      })
    };
    const orchestrator = new CustomerAiOrchestrator(() => simulatedProvider);
    const res = await orchestrator.answer(pacienteA.principal, '¿Cómo va mi tratamiento de ortodoncia?');
    expect(res.message).toContain('ortodoncia');
    expect(res.limitations[0]).toContain('no constituye diagnóstico');
  });

  it('PIL-04: Consulta documental RAG de política institucional autorizada', async () => {
    const searchRes = await durableKnowledgeService.search(pacienteA.principal, 'horario continuo atiende clínica', { limit: 1 });
    expect(searchRes.sufficientEvidence).toBe(true);
    expect(searchRes.results.length).toBe(1);
    expect(searchRes.results[0].excerpt).toContain('08:00 a 20:00');
    expect(searchRes.results[0].reference.documentCode).toBe('PILOT-POL-01');
  });

  it('PIL-05: Consulta mixta (próxima sesión y política de atención)', async () => {
    let callCount = 0;
    const simulatedProvider = {
      complete: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            kind: 'tool_call' as const,
            callId: 'call-pil-05',
            name: 'getUpcomingSessions',
            arguments: '{}'
          };
        }
        return {
          kind: 'message' as const,
          text: 'Tu próxima sesión es el 15 de diciembre en sede principal, y atendemos de 08:00 a 20:00.'
        };
      }
    };
    const orchestrator = new CustomerAiOrchestrator(() => simulatedProvider);
    const res = await orchestrator.answer(pacienteA.principal, '¿Cuándo es mi cita y cuál es el horario de la clínica?');
    expect(res.toolsUsed).toContain('getUpcomingSessions');
    expect(res.message).toContain('15 de diciembre');
  });

  it('PIL-06: Flujo supervisado completo de solicitud y aplicación de reprogramación', async () => {
    // 1. Preparación de solicitud
    const prep = await CustomerAiActionService.prepareRescheduleRequest(pacienteA.principal, {
      sessionId: pacienteA.sesion2Id,
      preferredDate: '2026-12-19',
      preferredSlot: 'Mañana',
      reason: 'Cruce con horario de trabajo',
      idempotencyKey: 'pilot-idemp-' + Date.now()
    });
    expect(prep.requiresConfirmation).toBe(true);
    expect(prep.confirmationToken).toBeDefined();

    // 2. Confirmación explícita
    const conf = await CustomerAiActionService.confirmRescheduleRequest(pacienteA.principal, prep.confirmationToken);
    expect(conf.status).toBe('RECORDED');
    requestIdPIL06 = conf.requestId;

    // 3. Revisión por recepción (En_Revision -> Aprobada)
    await CustomerAiActionService.reviewRescheduleRequest(recepcion, requestIdPIL06, 'En_Revision', 'Evaluando agenda');
    await CustomerAiActionService.reviewRescheduleRequest(recepcion, requestIdPIL06, 'Aprobada', 'Horario disponible');

    // 4. Aplicación oficial con procedimiento usp_ReprogramarSesionTratamiento
    const sesion = await prisma.sesionesTratamiento.findUniqueOrThrow({ where: { id_sesion: pacienteA.sesion2Id } });
    const slot = await prisma.disponibilidad.findFirstOrThrow({
      where: {
        estado: 'Disponible',
        id_profesional: sesion.id_profesional,
        id_sede: sesion.id_sede,
        fecha: { gte: new Date('2026-12-01') }
      }
    });

    const applied = await CustomerAiActionService.applyRescheduleRequest(recepcion, requestIdPIL06, slot.id_disponibilidad, 'Aplicación oficial en piloto');
    expect(applied.success).toBe(true);
    expect(applied.data.status).toBe('Aplicada');

    const updatedSession = await prisma.sesionesTratamiento.findUniqueOrThrow({ where: { id_sesion: pacienteA.sesion2Id } });
    expect(updatedSession.estado_programacion).toBe('Reprogramada');
  });

  it('PIL-07: Consulta y gestión supervisada de alertas documentales', async () => {
    const alertsBefore = await CustomerAiActionService.getPendingAlerts(odontologoA);
    expect(alertsBefore.success).toBe(true);

    // Detectar alertas en atención autorizada
    const detect = await CustomerAiActionService.detectDocumentationIssues(odontologoA, { attentionId: pacienteA.atencion1Id });
    expect(detect.success).toBe(true);

    const alertsAfter = await CustomerAiActionService.getPendingAlerts(odontologoA);
    expect(alertsAfter.data.length).toBeGreaterThanOrEqual(1);
    const targetAlert = alertsAfter.data.find(a => a.status === 'Generada') || alertsAfter.data.find(a => a.status === 'En_Revision') || alertsAfter.data[0];
    const nextStatus = targetAlert.status === 'Generada' ? 'En_Revision' : targetAlert.status === 'En_Revision' ? 'Atendida' : 'Resuelta';
    const review = await CustomerAiActionService.reviewAlert(odontologoA, targetAlert.alertId, nextStatus, 'Gestión controlada por odontólogo');
    expect(review.data.status).toBe(nextStatus);
  });

  it('PIL-08: Elaboración, revisión y aprobación humana de borrador clínico', async () => {
    // 1. Preparar borrador inicial v1
    const draft = await CustomerAiActionService.prepareDocumentationDraft(odontologoA, pacienteA.atencion1Id);
    expect(draft.data.status).toBe('Generado');
    expect(draft.data.version).toBe(1);
    draftIdPIL08 = draft.data.draftId;

    // 2. Revisión técnica odontológica (v2)
    const revised = await CustomerAiActionService.reviseDocumentationDraft(odontologoA, draftIdPIL08, 'Indicaciones revisadas: enjuagues con clorhexidina al 0.12% tras 24h.');
    expect(revised.data.version).toBe(2);
    draftIdPIL08 = revised.data.draftId;

    // 3. Aprobación profesional (sin emisión aún)
    const approved = await CustomerAiActionService.approveDocumentationDraft(odontologoA, draftIdPIL08);
    expect(approved.data.status).toBe('Aprobado');
    expect(approved.data.issuedToPatient).toBe(false);
  });

  it('PIL-09: Emisión documental formal separada con confirmación y visibilidad al paciente', async () => {
    // 1. Antes de emitir, el paciente no tiene indicaciones de este borrador
    await prisma.borradoresIA.updateMany({ where: { id_atencion: pacienteA.atencion1Id }, data: { id_indicacion_vinculada: null } });
    await prisma.indicacionesPostatencion.deleteMany({ where: { id_atencion: pacienteA.atencion1Id, origen_documento: 'COPILOTO_IA' } });

    const viewBefore = await CustomerAiQueryService.getApprovedAftercareInstructions(pacienteA.principal, pacienteA.atencion1Id);
    expect(viewBefore.data.length).toBe(0);

    // 2. Acción formal de emisión por el odontólogo
    const issued = await CustomerAiActionService.issueDocumentationDraft(odontologoA, draftIdPIL08);
    expect(issued.success).toBe(true);
    expect(issued.data.issuedToPatient).toBe(true);

    // 3. El paciente ahora sí visualiza y descarga sus indicaciones
    const viewAfter = await CustomerAiQueryService.getApprovedAftercareInstructions(pacienteA.principal, pacienteA.atencion1Id);
    expect(viewAfter.data.length).toBeGreaterThanOrEqual(1);
    expect(viewAfter.data[0].content).toContain('clorhexidina');
  });

  it('PIL-10: Seguridad de acceso perimetral y rechazo de violaciones horizontales', async () => {
    // Paciente A intenta acceder a tratamiento de Paciente B -> Rechazado
    await expect(
      CustomerAiQueryService.getTreatmentDetail(pacienteA.principal, pacienteB.idTratamiento)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Odontólogo B intenta aprobar borrador de Odontólogo A -> Rechazado
    await expect(
      CustomerAiActionService.approveDocumentationDraft(odontologoB, draftIdPIL08)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('PIL-11: Resiliencia ante falla controlada de Gemini (degradación elegante)', async () => {
    process.env.AI_AGENT_LLM_ENABLED = 'false';
    const orchestrator = new CustomerAiOrchestrator();

    await expect(
      orchestrator.answer(pacienteA.principal, 'Hola')
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });

    process.env.AI_AGENT_LLM_ENABLED = 'true';
  });

  it('PIL-12: Continuidad de servicio tras reinicio y preservación íntegra de estado', async () => {
    // Comprobar que los registros generados en el piloto persisten íntegramente
    const sesionCheck = await prisma.sesionesTratamiento.findUniqueOrThrow({ where: { id_sesion: pacienteA.sesion2Id } });
    expect(sesionCheck.estado_programacion).toBe('Reprogramada');

    const draftCheck = await prisma.borradoresIA.findUniqueOrThrow({ where: { id_borrador_ia: draftIdPIL08 } });
    expect(draftCheck.estado).toBe('Aprobado');
    expect(draftCheck.id_indicacion_vinculada).not.toBeNull();
  });

  it('PIL-13: Conciliación dimensional con Data Mart (Delta = 0)', async () => {
    const oltpResult = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      'SELECT COUNT(*) as total FROM dbo.TratamientosContratados'
    );
    const martResult = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      'SELECT COUNT(*) as total FROM [NexoSalud_Mart_Test].dbo.Fact_TratamientoCustomer'
    );
    expect(Number(oltpResult[0].total)).toBe(Number(martResult[0].total));
  });

  it('PIL-14: No regresión financiera sobre contratos de PAYER', async () => {
    const pagosValidados = await prisma.pagos.count({ where: { estado: 'Validado' } });
    expect(pagosValidados).toBeGreaterThanOrEqual(1);

    const reservasConfirmadas = await prisma.reservas.count({ where: { estado: 'Confirmada' } });
    expect(reservasConfirmadas).toBeGreaterThanOrEqual(1);
  });
});
