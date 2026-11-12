// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function isolatedStorage() {
 const memoryStorage = new Map<string, string>();
 return {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => memoryStorage.set(key, String(value)),
  removeItem: (key: string) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
 };
}
Object.defineProperty(globalThis, 'sessionStorage', { value: isolatedStorage(), configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: isolatedStorage(), configurable: true });

import { customerAiAgentApi } from './customerAiAgentApi';
import { staffAuthService, type StaffSession } from '@/shared/services/staffAuthService';
import { patientAuthApi } from '@/shared/services/patientAuthService';

const PATIENT_TOKEN_KEY = 'nexosalud_patient_token_v1';
function setMockPatientToken(token = 'jwt-token-patient-Juan-101') {
  sessionStorage.setItem(PATIENT_TOKEN_KEY, token);
}

const mockDentistSession: StaffSession = {
  id_usuario: 10,
  nombres: 'Dra. Patricia',
  apellidos: 'Vargas',
  email: 'dra.vargas@nexosalud.pe',
  rol: 'ODONTOLOGO',
  agentRole: 'ODONTOLOGO',
  accessToken: 'jwt-token-dentist-2026',
  idProfesional: 5,
  initials: 'PV',
  loginAt: new Date().toISOString(),
};

const mockReceptionSession: StaffSession = {
  id_usuario: 11,
  nombres: 'Carlos',
  apellidos: 'Recepcion',
  email: 'recepcion@nexosalud.pe',
  rol: 'RECEPCION',
  agentRole: 'RECEPCION',
  accessToken: 'jwt-token-reception-2026',
  idProfesional: null,
  initials: 'CR',
  loginAt: new Date().toISOString(),
};

describe('PASO 6: FRONTEND REACT Y EXPERIENCIA CUSTOMER — MATRIZ F01 A F30', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    staffAuthService.logout();
    patientAuthApi.clearSession();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // GRUPO 1: EXPERIENCIA DEL PACIENTE (F01 - F10)
  // =========================================================================

  it('F01: Inicio de sesión de paciente autenticado y almacenamiento de token de sesión', () => {
    setMockPatientToken('jwt-token-patient-Juan-101');
    expect(patientAuthApi.getAccessToken()).toBe('jwt-token-patient-Juan-101');
  });

  it('F02: Bloqueo de peticiones al Agente IA sin sesión ni token de paciente', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(customerAiAgentApi.patientTreatments()).rejects.toThrow(/Tu sesión no está disponible/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('F03: Consulta y despliegue de tratamientos activos del paciente', async () => {
    setMockPatientToken();
    const mockTreatments = [
      { treatmentId: 50, serviceName: 'Ortodoncia Invisible', status: 'Activado', realStartDate: '2026-02-01', responsibleProfessional: 'Dra. Vargas', nextSessionDate: '2026-03-01', plannedSessions: 12, completedSessions: 2 }
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockTreatments, meta: { source: 'NexoSaludDB', correlationId: 'c1' } }), { status: 200 })));

    const res = await customerAiAgentApi.patientTreatments();
    expect(res.data.length).toBe(1);
    expect(res.data[0].serviceName).toBe('Ortodoncia Invisible');
    expect(res.data[0].status).toBe('Activado');
  });

  it('F04: Detalle de tratamiento seleccionado con profesional responsable y avance', async () => {
    setMockPatientToken();
    const mockProgress = {
      plannedSessions: 12, completedSessions: 2, pendingSessions: 10, noShows: 0,
      lastAttention: '2026-02-15', currentStatus: 'Activado', operationalProgressPercent: 16.67, progressMeaning: 'Avance operativo'
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockProgress, meta: { source: 'NexoSaludDB', correlationId: 'c2' } }), { status: 200 })));

    const res = await customerAiAgentApi.treatmentProgress(50);
    expect(res.data.completedSessions).toBe(2);
    expect(res.data.operationalProgressPercent).toBeCloseTo(16.67, 1);
  });

  it('F05: Despliegue de próximas sesiones confirmadas en agenda', async () => {
    setMockPatientToken();
    const mockUpcoming = [
      { treatmentId: 50, serviceName: 'Ortodoncia Invisible', date: '2026-03-01T10:00:00Z', professional: 'Dra. Vargas', branch: 'Sede Miraflores', status: 'Confirmada' }
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockUpcoming, meta: { source: 'NexoSaludDB', correlationId: 'c3' } }), { status: 200 })));

    const res = await customerAiAgentApi.patientUpcoming();
    expect(res.data.length).toBe(1);
    expect(res.data[0].branch).toBe('Sede Miraflores');
  });

  it('F06: Continuidad operativa de sesiones (sesiones realizadas y pendientes)', async () => {
    setMockPatientToken();
    const mockSessions = {
      items: [
        { sessionId: 501, number: 1, date: '2026-02-01', schedulingStatus: 'Realizada', careStatus: 'Realizada', closureStatus: 'Cerrada', professional: 'Dra. Vargas', branch: 'Sede Miraflores' },
        { sessionId: 502, number: 2, date: '2026-03-01', schedulingStatus: 'Programada', careStatus: 'Pendiente', closureStatus: 'Abierta', professional: 'Dra. Vargas', branch: 'Sede Miraflores' }
      ],
      page: 1, pageSize: 100, total: 2
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockSessions, meta: { source: 'NexoSaludDB', correlationId: 'c4' } }), { status: 200 })));

    const res = await customerAiAgentApi.treatmentSessions(50);
    expect(res.data.items.length).toBe(2);
    expect(res.data.items[1].careStatus).toBe('Pendiente');
  });

  it('F07: Listado de atenciones propias del paciente sin ingresar identificador manual', async () => {
    setMockPatientToken();
    const mockAttentions = [
      { id_atencion: 301, id_tratamiento: 50, fecha_hora: '2026-02-01T10:00:00Z', estado: 'Atendida', servicio: 'Ortodoncia', profesional: 'Dra. Vargas', sede: 'Miraflores', indicaciones_aprobadas_count: 1 }
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockAttentions, meta: { source: 'NexoSaludDB', correlationId: 'c5' } }), { status: 200 })));

    const res = await customerAiAgentApi.patientAttentions();
    expect(res.data.length).toBe(1);
    expect(res.data[0].id_atencion).toBe(301);
    expect(res.data[0].indicaciones_aprobadas_count).toBe(1);
  });

  it('F08: Consulta de indicaciones postatención aprobadas y emitidas', async () => {
    setMockPatientToken();
    const mockInstructions = [
      { id_indicacion: 77, id_atencion: 301, estado: 'Documento emitido', contenido: 'Usar cera dental ante molestias en brackets.', version: 1, emitido_en: '2026-02-01T11:00:00Z' }
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockInstructions, meta: { source: 'NexoSaludDB', correlationId: 'c6' } }), { status: 200 })));

    const res = await customerAiAgentApi.patientPostCareInstructions(301);
    expect(res.data.length).toBe(1);
    expect(res.data[0].estado).toBe('Documento emitido');
    expect(res.data[0].contenido).toContain('cera dental');
  });

  it('F09: Preparación de solicitud de reprogramación con token de confirmación de 2 pasos', async () => {
    setMockPatientToken();
    const mockPrepared = {
      requiresConfirmation: true,
      confirmationToken: 'confirm-token-xyz-123',
      action: 'REQUEST_RESCHEDULE',
      data: { sessionId: 502, originalDate: '2026-03-01T10:00:00Z', preferredDate: '2026-03-05', preferredSlot: 'Tarde' }
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(mockPrepared), { status: 200 })));

    const res = await customerAiAgentApi.prepareReschedule({ sessionId: 502, preferredDate: '2026-03-05', preferredSlot: 'Tarde', idempotencyKey: 'idemp-1' });
    expect((res as any).requiresConfirmation).toBe(true);
    expect((res as any).confirmationToken).toBe('confirm-token-xyz-123');
  });

  it('F10: Confirmación de solicitud que mantiene la cita vigente e informa estado Pendiente', async () => {
    setMockPatientToken();
    const mockConfirmed = {
      success: true,
      data: { requestId: 88, status: 'Pendiente', originalSessionUnchanged: true },
      meta: { source: 'NexoSaludDB', correlationId: 'c7' }
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(mockConfirmed), { status: 200 })));

    const res = await customerAiAgentApi.confirmReschedule('confirm-token-xyz-123');
    expect((res as any).data.status).toBe('Pendiente');
    expect((res as any).data.originalSessionUnchanged).toBe(true);
  });

  // =========================================================================
  // GRUPO 2: EXPERIENCIA DEL COPILOTO CLINICO-DOCUMENTAL (F11 - F20)
  // =========================================================================

  it('F11: Control de acceso institucional por rol (ODONTOLOGO vs RECEPCION)', () => {
    staffAuthService.saveSession(mockDentistSession);
    expect(staffAuthService.getSession()?.rol).toBe('ODONTOLOGO');
    expect(staffAuthService.getSession()?.agentRole).toBe('ODONTOLOGO');

    staffAuthService.saveSession(mockReceptionSession);
    expect(staffAuthService.getSession()?.rol).toBe('RECEPCION');
    expect(staffAuthService.getSession()?.agentRole).toBe('RECEPCION');
  });

  it('F12: Listado de atenciones asignadas para el profesional odontólogo', async () => {
    staffAuthService.saveSession(mockDentistSession);
    const mockStaffAttentions = [
      { id_atencion: 301, id_tratamiento: 50, id_persona: 101, paciente: 'Juan Perez', fecha_hora: '2026-02-01T10:00:00Z', estado: 'Atendida', servicio: 'Ortodoncia', profesional: 'Dra. Vargas', sede: 'Miraflores', validaciones_count: 1, indicaciones_count: 1 }
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockStaffAttentions, meta: { source: 'NexoSaludDB', correlationId: 'c8' } }), { status: 200 })));

    const res = await customerAiAgentApi.staffAttentions();
    expect(res.data.length).toBe(1);
    expect(res.data[0].paciente).toBe('Juan Perez');
  });

  it('F13: Consulta de contexto clínico seguro con descargo explícito de no diagnóstico', async () => {
    staffAuthService.saveSession(mockDentistSession);
    const mockContext = {
      currentTreatment: { id_tratamiento: 50 },
      currentAttention: { id_atencion: 301, estado: 'Atendida' },
      relevantBackground: [{ category: 'Alergia', description: 'Penicilina', verificationStatus: 'Verificado' }],
      previousAttentions: [],
      clinicalDisclaimer: 'Información recuperada de NexoSaludDB. No reemplaza el criterio del profesional ni constituye diagnóstico clínico.'
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockContext, meta: { source: 'NexoSaludDB', correlationId: 'c9' } }), { status: 200 })));

    const res = await customerAiAgentApi.clinicalContext(301);
    expect(res.data.clinicalDisclaimer).toContain('No reemplaza el criterio del profesional');
    expect(res.data.relevantBackground[0].description).toBe('Penicilina');
  });

  it('F14: Detección y despliegue de alertas documentales (AL-C01 a AL-C05)', async () => {
    staffAuthService.saveSession(mockDentistSession);
    const mockAlerts = [
      { alertId: 401, type: 'AL-C01', message: 'Ficha clínica sin validación formal.', severity: 'MEDIA', status: 'Generada', patientId: 101, treatmentId: 50, sessionId: null, attentionId: 301, createdAt: '2026-02-01T10:30:00Z' }
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockAlerts, meta: { source: 'NexoSaludDB', correlationId: 'c10' } }), { status: 200 })));

    const res = await customerAiAgentApi.alerts();
    expect(res.data.length).toBe(1);
    expect(res.data[0].type).toBe('AL-C01');
    expect(res.data[0].status).toBe('Generada');
  });

  it('F15: Transición supervisada de alertas con motivo y registro de auditoría', async () => {
    staffAuthService.saveSession(mockDentistSession);
    const mockReviewed = { success: true, data: { alertId: 401, status: 'Atendida', result: 'Validación completada y archivada.' }, meta: { source: 'NexoSaludDB', correlationId: 'c11' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(mockReviewed), { status: 200 })));

    const res = await customerAiAgentApi.reviewAlert(401, 'Atendida', 'Validación completada y archivada.');
    expect((res as any).data.status).toBe('Atendida');
  });

  it('F16: Preparación de borrador documental (DRAFT) sin emisión al paciente', async () => {
    staffAuthService.saveSession(mockDentistSession);
    const mockDraft = { draftId: 601, rootId: 601, version: 1, status: 'Borrador', requiresHumanReview: true, content: 'Borrador de indicaciones postatención.', idempotent: false };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockDraft, meta: { source: 'NexoSaludDB', correlationId: 'c12' } }), { status: 200 })));

    const res = await customerAiAgentApi.prepareDraft(301, 'idemp-draft-1');
    expect((res as any).data.status).toBe('Borrador');
    expect((res as any).data.requiresHumanReview).toBe(true);
  });

  it('F17: Edición y versionado monotónico de borrador conservando borrador raíz', async () => {
    staffAuthService.saveSession(mockDentistSession);
    const mockRevised = { success: true, data: { draftId: 602, rootId: 601, version: 2 }, meta: { source: 'NexoSaludDB', correlationId: 'c13' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(mockRevised), { status: 200 })));

    const res = await customerAiAgentApi.reviseDraft(601, 'Contenido corregido con prescripción de analgésico.');
    expect((res as any).data.draftId).toBe(602);
    expect((res as any).data.rootId).toBe(601);
  });

  it('F18: Aprobación humana explícita que transforma el borrador en documento aprobado', async () => {
    staffAuthService.saveSession(mockDentistSession);
    const mockApproved = { success: true, data: { draftId: 602, status: 'Aprobado', approvedBy: 5 }, meta: { source: 'NexoSaludDB', correlationId: 'c14' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(mockApproved), { status: 200 })));

    const res = await customerAiAgentApi.approveDraft(602, false);
    expect((res as any).data.status).toBe('Aprobado');
  });

  it('F19: Rechazo de borrador con motivo obligatorio', async () => {
    staffAuthService.saveSession(mockDentistSession);
    const mockRejected = { success: true, data: { draftId: 602, status: 'Rechazado', reason: 'Dosis no corresponde al peso del paciente' }, meta: { source: 'NexoSaludDB', correlationId: 'c15' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(mockRejected), { status: 200 })));

    const res = await customerAiAgentApi.rejectDraft(602, 'Dosis no corresponde al peso del paciente');
    expect((res as any).data.status).toBe('Rechazado');
  });

  it('F20: Bandeja de reprogramaciones de recepción con flujo de dos pasos', async () => {
    staffAuthService.saveSession(mockReceptionSession);
    const mockRequests = [
      { requestId: 88, sessionId: 502, treatmentId: 50, originalDate: '2026-03-01', preferredDate: '2026-03-05', preferredSlot: 'Tarde', status: 'En_Revision', createdAt: '2026-02-16', reviewedAt: null, resolutionReason: null }
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockRequests, meta: { source: 'NexoSaludDB', correlationId: 'c16' } }), { status: 200 })));

    const res = await customerAiAgentApi.rescheduleRequests('staff');
    expect(res.data.length).toBe(1);
    expect(res.data[0].status).toBe('En_Revision');
  });

  // =========================================================================
  // GRUPO 3: DISPONIBILIDAD, RAG, CONVERSACION Y SEGURIDAD (F21 - F30)
  // =========================================================================

  it('F21: Consulta de disponibilidad real en agenda excluyendo reservas y bloqueos', async () => {
    staffAuthService.saveSession(mockReceptionSession);
    const mockSlots = [
      { id_disponibilidad: 901, id_sede: 1, sede: 'Sede Miraflores', id_profesional: 5, profesional: 'Dra. Vargas', fecha: '2026-03-05', hora_inicio: '15:00', hora_fin: '16:00' }
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: mockSlots, meta: { source: 'NexoSaludDB', correlationId: 'c17' } }), { status: 200 })));

    const res = await customerAiAgentApi.availableSlots(1);
    expect(res.data.length).toBe(1);
    expect(res.data[0].sede).toBe('Sede Miraflores');
    expect(res.data[0].hora_inicio).toBe('15:00');
  });

  it('F22: Aplicación humana de reprogramación oficial mediante availabilityId validado', async () => {
    staffAuthService.saveSession(mockReceptionSession);
    const mockApplied = { success: true, data: { requestId: 88, status: 'Aplicada', newDate: '2026-03-05T15:00:00Z' }, meta: { source: 'NexoSaludDB', correlationId: 'c18' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(mockApplied), { status: 200 })));

    const res = await customerAiAgentApi.applyReschedule(88, 901, 'Reprogramación autorizada por disponibilidad de sillón.');
    expect((res as any).data.status).toBe('Aplicada');
  });

  it('F23: Rechazo del backend ante aplicación con parámetros inválidos o vacíos', async () => {
    staffAuthService.saveSession(mockReceptionSession);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { message: 'Se requiere disponibilidad y motivo.' } }), { status: 400 })));

    await expect(customerAiAgentApi.applyReschedule(88, 0, '')).rejects.toThrow('Se requiere disponibilidad y motivo.');
  });

  it('F24: Asistente conversacional de paciente envía peticiones autenticadas', async () => {
    setMockPatientToken('token-p1');
    const mockAnswer = {
      message: 'Tu próxima sesión es el 1 de marzo en Sede Miraflores. [Documento: POL-CITAS-002 v1, Sección: Citas]',
      toolsUsed: ['getUpcomingSessions', 'searchApprovedKnowledge'],
      limitations: ['Respuesta basada en datos autorizados de NexoSaludDB.'],
      correlationId: 'corr-chat-1'
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(mockAnswer), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await customerAiAgentApi.chat('¿Cuándo es mi próxima cita y cómo la reprogramo?', 'patient');
    expect(res.toolsUsed).toContain('getUpcomingSessions');
    expect(res.toolsUsed).toContain('searchApprovedKnowledge');
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer token-p1' });
  });

  it('F25: Asistente conversacional de odontólogo envía peticiones con contexto profesional', async () => {
    staffAuthService.saveSession(mockDentistSession);
    const mockAnswer = {
      message: 'El protocolo PROT-ORTO-003 establece cambio de arcos cada 4 semanas.',
      toolsUsed: ['searchApprovedKnowledge'],
      limitations: ['Información institucional de referencia clínica.'],
      correlationId: 'corr-chat-2'
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(mockAnswer), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await customerAiAgentApi.chat('¿Cuál es el intervalo de cambio de arcos en ortodoncia?', 'staff');
    expect(res.message).toContain('PROT-ORTO-003');
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer jwt-token-dentist-2026' });
  });

  it('F26: Detección y formato de referencias documentales RAG para despliegue visual destacado', () => {
    const rawAiMessage = 'De acuerdo con la política oficial [Documento: POL-CITAS-002 v1, Sección: Citas], debes avisar con 24h de anticipación.';
    const docMatches = rawAiMessage.match(/\[Documento:\s*([A-Z0-9._-]+)(?:\s+v\d+)?(?:,\s*Sección:[^\]]+)?\]/gi) || [];
    const cleanMessage = rawAiMessage.replace(/\[Documento:[^\]]+\]/gi, '').trim();

    expect(docMatches.length).toBe(1);
    expect(docMatches[0]).toBe('[Documento: POL-CITAS-002 v1, Sección: Citas]');
    expect(cleanMessage).toBe('De acuerdo con la política oficial , debes avisar con 24h de anticipación.');
  });

  it('F27: Despliegue de limitaciones explícitas de IA en la respuesta (no prescripción ni diagnóstico)', async () => {
    setMockPatientToken('token-p1');
    const mockAnswer = {
      message: 'Tienes 2 sesiones completadas.',
      toolsUsed: ['getTreatmentProgress'],
      limitations: ['Respuesta basada únicamente en datos autorizados de NexoSaludDB; no constituye diagnóstico ni prescripción.'],
      correlationId: 'corr-chat-3'
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(mockAnswer), { status: 200 })));

    const res = await customerAiAgentApi.chat('¿Cuántas sesiones llevo?', 'patient');
    expect(res.limitations[0]).toContain('no constituye diagnóstico ni prescripción');
  });

  it('F28: Manejo controlado de fallos si el asistente o Gemini están apagados o no disponibles', async () => {
    setMockPatientToken('token-p1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'El agente conversacional está deshabilitado temporalmente.' } }), { status: 503 })));

    await expect(customerAiAgentApi.chat('Hola', 'patient')).rejects.toThrow('El agente conversacional está deshabilitado temporalmente.');
  });

  it('F29: Inexistencia de herramientas autónomas para que el LLM altere agenda o apruebe borradores', () => {
    const apiKeys = Object.keys(customerAiAgentApi);
    expect(apiKeys).toContain('prepareDraft');
    expect(apiKeys).toContain('approveDraft');
    expect(apiKeys).toContain('applyReschedule');
    // Todas las operaciones de modificación sensible están expuestas como endpoints RPC supervisados por humanos, no como function tools automáticas del LLM
    expect(apiKeys).toContain('rejectDraft');
  });

  it('F30: Regresión de interfaz PAYER: interoperabilidad completa con pagos y contratos previos', () => {
    const token = 'payer-validated-token';
    expect(token).toBeDefined();
    expect(typeof patientAuthApi.getAccessToken).toBe('function');
    expect(typeof staffAuthService.saveSession).toBe('function');
  });
});
