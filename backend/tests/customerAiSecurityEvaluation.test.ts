import { assertIsolatedSqlServer } from './helpers/isolatedSqlServer';
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/db';
import { CustomerAiQueryService } from '../src/modules/customer/ai-agent/services/customerAiQueryService';
import { CustomerAiActionService } from '../src/modules/customer/ai-agent/services/customerAiActionService';
import { AiAgentPrincipal } from '../src/modules/customer/ai-agent/types';

describe.skipIf(process.env.AI_AGENT_SQLSERVER_INTEGRATION !== 'true')('FASE F: EVALUACION DE SEGURIDAD, PRIVACIDAD Y GOBERNANZA CLINICA', () => {
  let paciente1: { principal: AiAgentPrincipal; idTratamiento: number; idAtencion: number };
  let paciente2: { principal: AiAgentPrincipal; idTratamiento: number; idAtencion: number };
  let odontologo1: AiAgentPrincipal;
  let odontologo2: AiAgentPrincipal;
  let recepcionPrincipal: AiAgentPrincipal;

  beforeAll(async () => {
    await assertIsolatedSqlServer();
    const p1 = await prisma.personas.findFirstOrThrow({
      where: { dni: '99000001' },
      include: {
        TratamientosContratados: true,
        Atenciones: true
      }
    });
    paciente1 = {
      principal: { role: 'PACIENTE', idPersona: p1.id_persona },
      idTratamiento: p1.TratamientosContratados[0].id_tratamiento,
      idAtencion: p1.Atenciones[0].id_atencion
    };

    const p2 = await prisma.personas.findFirstOrThrow({
      where: { dni: '99000002' },
      include: {
        TratamientosContratados: true,
        Atenciones: true
      }
    });
    paciente2 = {
      principal: { role: 'PACIENTE', idPersona: p2.id_persona },
      idTratamiento: p2.TratamientosContratados[0].id_tratamiento,
      idAtencion: p2.Atenciones[0].id_atencion
    };

    const profs = await prisma.profesionales.findMany({ where: { activo: true }, take: 2 });
    odontologo1 = { role: 'ODONTOLOGO', idUsuario: 1, idProfesional: profs[0].id_profesional };
    odontologo2 = { role: 'ODONTOLOGO', idUsuario: 2, idProfesional: profs[1]?.id_profesional ?? (profs[0].id_profesional + 100) };
    recepcionPrincipal = { role: 'RECEPCION', idUsuario: 3 };
  });

  // 1. Control Horizontal Entre Pacientes
  it('SEC-01: Paciente 1 no puede consultar tratamientos ni sesiones de Paciente 2', async () => {
    await expect(
      CustomerAiQueryService.getTreatmentDetail(paciente1.principal, paciente2.idTratamiento)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      CustomerAiQueryService.getTreatmentSessions(paciente1.principal, paciente2.idTratamiento)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('SEC-02: Paciente 1 no puede solicitar reprogramación de sesiones de Paciente 2', async () => {
    const sesionP2 = await prisma.sesionesTratamiento.findFirstOrThrow({
      where: { id_tratamiento: paciente2.idTratamiento }
    });

    await expect(
      CustomerAiActionService.prepareRescheduleRequest(paciente1.principal, {
        sessionId: sesionP2.id_sesion,
        preferredDate: '2026-12-20'
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // 2. Control Horizontal Entre Odontólogos
  it('SEC-03: Odontólogo no asignado no puede acceder al contexto clínico de otra atención', async () => {
    await expect(
      CustomerAiQueryService.getAuthorizedClinicalContext(odontologo2, paciente1.idAtencion)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('SEC-04: Odontólogo no asignado no puede aprobar borradores clínicos de otro profesional', async () => {
    // Odontólogo 1 crea un borrador
    const draft = await CustomerAiActionService.prepareDocumentationDraft(odontologo1, paciente1.idAtencion);
    expect(draft.success).toBe(true);

    // Odontólogo 2 intenta aprobarlo
    await expect(
      CustomerAiActionService.approveDocumentationDraft(odontologo2, draft.data.draftId)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // 3. Separación de Roles (RBAC)
  it('SEC-05: Recepción no puede preparar, aprobar ni emitir borradores clínicos', async () => {
    await expect(
      CustomerAiActionService.prepareDocumentationDraft(recepcionPrincipal as any, paciente1.idAtencion)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const draft = await CustomerAiActionService.prepareDocumentationDraft(odontologo1, paciente1.idAtencion);

    await expect(
      CustomerAiActionService.approveDocumentationDraft(recepcionPrincipal as any, draft.data.draftId)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      CustomerAiActionService.issueDocumentationDraft(recepcionPrincipal as any, draft.data.draftId)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // 4. Gobernanza Clínica: Triple Barrera Anti-Diagnóstico / Anti-Prescripción
  it('SEC-06: Barrera SQL Server (CHECK Constraint) bloquea inserción de diagnósticos o prescripciones de IA', async () => {
    await expect(
      prisma.interaccionesIA.create({
        data: {
          id_persona: paciente1.principal.idPersona,
          actor_orientado: 'ODONTOLOGO',
          tipo_evento: 'PRESCRIPCION_MEDICAMENTO_TEST',
          resumen_consulta: 'Receta amoxicilina 500mg',
          resultado: 'Invalido',
          es_diagnostico_o_prescripcion: true // Debe ser rechazado por CK_InteraccionesIA_NoDiagnostico
        }
      })
    ).rejects.toThrow();
  });

  it('SEC-07: Odontólogo sin colegiatura profesional activa no puede aprobar documentos clínicos', async () => {
    const fakeDentistPrincipal: AiAgentPrincipal = { role: 'ODONTOLOGO', idUsuario: 998, idProfesional: 998 };
    
    await expect(
      CustomerAiActionService.approveDocumentationDraft(fakeDentistPrincipal, 99999)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('SEC-08: Dos pasos obligatorios: un borrador aprobado NO es visible por el paciente hasta su emisión explícita', async () => {
    // 1. Odontólogo 1 crea y aprueba un nuevo borrador
    const draft = await CustomerAiActionService.prepareDocumentationDraft(odontologo1, paciente1.idAtencion);
    const approved = await CustomerAiActionService.approveDocumentationDraft(odontologo1, draft.data.draftId);
    expect(approved.data.status).toBe('Aprobado');
    expect(approved.data.issuedToPatient).toBe(false);

    // 2. Limpiar indicaciones previas desvinculando primero borradores para respetar FK
    await prisma.borradoresIA.updateMany({
      where: { id_atencion: paciente1.idAtencion },
      data: { id_indicacion_vinculada: null }
    });
    await prisma.indicacionesPostatencion.deleteMany({
      where: { id_atencion: paciente1.idAtencion, origen_documento: 'COPILOTO_IA' }
    });

    // 3. El paciente consulta sus indicaciones: debe recibir 0 registros
    const patientViewBefore = await CustomerAiQueryService.getApprovedAftercareInstructions(paciente1.principal, paciente1.idAtencion);
    expect(patientViewBefore.data.length).toBe(0);

    // 4. Odontólogo emite formalmente el borrador
    const issued = await CustomerAiActionService.issueDocumentationDraft(odontologo1, draft.data.draftId);
    expect(issued.data.issuedToPatient).toBe(true);

    // 5. Ahora sí el paciente puede consultar la indicación emitida
    const patientViewAfter = await CustomerAiQueryService.getApprovedAftercareInstructions(paciente1.principal, paciente1.idAtencion);
    expect(patientViewAfter.data.length).toBeGreaterThanOrEqual(1);
    expect((patientViewAfter.data[0] as any).status).toBe('Documento emitido');
  });
});
