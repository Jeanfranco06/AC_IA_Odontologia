import { CustomerAiQueryService } from '../services/customerAiQueryService';
import { CustomerAiActionService } from '../services/customerAiActionService';
import { durableKnowledgeService } from '../../knowledge-base/durableKnowledgeService';
import { AiAgentError, AiAgentPrincipal } from '../types';
import { LlmToolDefinition } from './provider';
import { metricsCollector } from '../monitoring/metricsCollector';
import { CustomerCompletionService } from '../services/customerCompletionService';
import { CustomerAnalyticsService,AnalyticsKind } from '../services/customerAnalyticsService';
import { WhatsAppPostCareService } from '../../whatsapp/services/whatsappPostCareService';
import { WhatsAppLoyaltyService } from '../../whatsapp/services/whatsappLoyaltyService';

type ToolContext = { correlationId?: string; sourceMessage?: string; attentionId?: number };
type Tool = LlmToolDefinition & { roles: AiAgentPrincipal['role'][]; execute: (principal: AiAgentPrincipal, args: Record<string, unknown>, context?: ToolContext) => Promise<unknown> };
const integer = (name: string) => ({ type: 'integer', minimum: 1, description: `Identificador positivo de ${name}.` });
const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', additionalProperties: false, properties, required });
const id = (args: Record<string, unknown>, name: string) => { const value = args[name]; if (!Number.isInteger(value) || Number(value) < 1) throw new AiAgentError('INVALID_INPUT', `El argumento ${name} debe ser un entero positivo.`); return Number(value); };
const optionalId = (args: Record<string, unknown>, name: string) => args[name] === undefined || args[name] === null ? undefined : id(args, name);
const noArgs = (args: Record<string, unknown>) => { if (Object.keys(args).length) throw new AiAgentError('INVALID_INPUT', 'La herramienta no acepta argumentos.'); };

const all = ['PACIENTE', 'ODONTOLOGO', 'ADMIN'] as const;
const patientOnly = ['PACIENTE'] as const;
const clinical = ['ODONTOLOGO', 'ADMIN'] as const;
const operations = ['RECEPCION', 'ADMIN'] as const;
const clinicalOnly = ['ODONTOLOGO'] as const;

const tools: Tool[] = [
  {type:'function',name:'getTreatmentClosureChecklist',description:'Prepara IA13: consulta evidencias por sesión, validaciones vigentes, revisiones humanas y borradores pendientes del tratamiento autorizado. Solo lectura; no cierra ni da alta.',parameters:object({treatmentId:integer('tratamiento')},['treatmentId']),roles:[...clinical],execute:(p,a)=>CustomerAiQueryService.getTreatmentClosureChecklist(p,id(a,'treatmentId'),{audit:false})},
  ...([
    ['getTreatmentAnalytics','treatments','Indicadores administrativos de tratamientos por cohorte de contratación.',['ADMIN','ODONTOLOGO','RECEPCION']],
    ['getSessionComplianceAnalytics','sessions','Cumplimiento de sesiones por fecha programada vigente; no consulta agenda en tiempo real.',['ADMIN','ODONTOLOGO','RECEPCION']],
    ['getClinicalDocumentationAnalytics','documentation','Atenciones y documentación agregadas del ámbito autorizado.',['ADMIN','ODONTOLOGO']],
    ['getAiPerformanceAnalytics','ai','Eventos, alertas y linajes documentales agregados; no lista pacientes.',['ADMIN','ODONTOLOGO']]
  ] as const).map(([name,kind,description,roles]):Tool=>({type:'function',name,description:description+' Fuente: Data Mart histórico; devuelve fecha de carga. No permite SQL libre.',parameters:object({startDate:{type:'string',maxLength:10,description:'Inicio inclusivo YYYY-MM-DD'},endDate:{type:'string',maxLength:10,description:'Fin inclusivo YYYY-MM-DD'},groupBy:{type:'string',enum:['none','month','branch','service']},branchId:integer('sede'),serviceId:integer('servicio')},['startDate','endDate']),roles:[...roles],execute:(p,a)=>CustomerAnalyticsService.query(p,kind as AnalyticsKind,a,{audit:false})})),
  { type:'function', name:'getPendingPlanSessions', description:'Consulta ordinales previstos todavía sin programar en un tratamiento propio. NO usar para reprogramar citas ya existentes; solo para programar sesiones vírgenes.', parameters:object({treatmentId:integer('tratamiento')},['treatmentId']),roles:[...patientOnly],execute:(p,a)=>CustomerCompletionService.pendingSessions(p,id(a,'treatmentId')) },
  { type:'function', name:'getCustomerSchedulingSlots', description:'Consulta horarios oficiales elegibles para citas nuevas. Para reprogramar citas ya existentes usa prepareRescheduleRequest.', parameters:object({treatmentId:integer('tratamiento')},['treatmentId']),roles:[...patientOnly],execute:(p,a)=>CustomerCompletionService.slots(p,id(a,'treatmentId')) },
  { type:'function', name:'prepareSchedulingRequest', description:'Prepara una propuesta de sesión nueva (no programada) en un tratamiento. NO USAR para reprogramar citas existentes (para reprogramar usa requestReschedule o prepareRescheduleRequest).',parameters:object({treatmentId:integer('tratamiento'),number:integer('ordinal'),slotId:integer('horario'),idempotencyKey:{type:'string',maxLength:120}},['treatmentId','number','slotId','idempotencyKey']),roles:[...patientOnly],execute:async(p,a)=>{const {confirmationToken:_token,...safe}=await CustomerCompletionService.prepareScheduling(p,id(a,'treatmentId'),id(a,'number'),id(a,'slotId'),String(a.idempotencyKey));return safe;} },
  { type:'function', name:'getCustomerRequests',description:'Consulta solicitudes de programación y revisión humana dentro del ámbito del usuario.',parameters:object({}),roles:['PACIENTE','ODONTOLOGO','RECEPCION','ADMIN'],execute:p=>CustomerCompletionService.requests(p) },
  { type:'function', name:'prepareClinicalFileDraft', description:'Estructura exclusivamente notas literales proporcionadas por el odontólogo; no transfiere a la ficha.',parameters:object({attentionId:integer('atención'),notes:{type:'string',maxLength:8000},idempotencyKey:{type:'string',maxLength:120}},['attentionId','notes','idempotencyKey']),roles:[...clinicalOnly],execute:(p,a,context)=>{const source = context?.sourceMessage?.replace(/\r\n/g,'\n').trim(); const block = source?.match(/(?:^|\n)Notas(?: originales)?(?: del profesional)?:[ \t]*\n([\s\S]+)$/i); const declared = (block?.[1] ?? source)?.trim(); if(!declared || String(a.notes).replace(/\r\n/g,'\n').trim() !== declared)throw new AiAgentError('INVALID_INPUT','Las notas deben copiar íntegramente el texto declarado por el profesional. Use un bloque separado que empiece por Notas:; no recorte frases ni negaciones.');return CustomerCompletionService.prepareClinicalDraft(p,id(a,'attentionId'),String(a.notes),String(a.idempotencyKey));} },
  { type:'function', name:'checkClinicalDocumentation',description:'Comprueba requisitos documentales publicados; no firma ni valida profesionalmente.',parameters:object({attentionId:integer('atención')},['attentionId']),roles:[...clinicalOnly],execute:(p,a)=>CustomerCompletionService.validateDocumentation(p,id(a,'attentionId'),false,{audit:false}) },
  { type: 'function', name: 'getPatientTreatments', description: 'Obtiene los tratamientos del paciente autenticado.', parameters: object({}), strict: true, roles: [...patientOnly], execute: (p, a) => { noArgs(a); return CustomerAiQueryService.getPatientTreatments(p, { audit: false }); } },
  { type: 'function', name: 'getPatientAttentions', description: 'Obtiene las atenciones y consultas odontológicas del paciente autenticado, indicando fechas, profesional, servicio realizado e identificador de atención.', parameters: object({}), strict: true, roles: [...patientOnly], execute: (p, a) => { noArgs(a); return CustomerAiQueryService.getPatientAttentions(p, {}, { audit: false }); } },
  { type: 'function', name: 'getTreatmentDetail', description: 'Obtiene el detalle documental de un tratamiento autorizado.', parameters: object({ treatmentId: integer('tratamiento') }, ['treatmentId']), strict: true, roles: [...all], execute: (p, a) => CustomerAiQueryService.getTreatmentDetail(p, id(a, 'treatmentId'), { audit: false }) },
  { type: 'function', name: 'getTreatmentSessions', description: 'Obtiene sesiones de un tratamiento autorizado.', parameters: object({ treatmentId: integer('tratamiento'), page: { type: 'integer', minimum: 1, maximum: 20 }, pageSize: { type: 'integer', minimum: 1, maximum: 50 } }, ['treatmentId']), strict: true, roles: [...all], execute: (p, a) => CustomerAiQueryService.getTreatmentSessions(p, id(a, 'treatmentId'), { page: a.page as number | undefined, pageSize: a.pageSize as number | undefined }, { audit: false }) },
  { type: 'function', name: 'getUpcomingSessions', description: 'Obtiene próximas sesiones del paciente autenticado.', parameters: object({}), strict: true, roles: [...patientOnly], execute: (p, a) => { noArgs(a); return CustomerAiQueryService.getUpcomingSessions(p, { audit: false }); } },
  {
    type: 'function',
    name: 'confirmSessionAttendance',
    description: 'Confirma la asistencia del paciente a una sesión programada pendiente. Si no se especifica sessionId, confirma la próxima sesión pendiente.',
    parameters: object({ sessionId: { type: 'integer', minimum: 1, description: 'ID opcional de la sesión a confirmar.' } }),
    roles: [...patientOnly],
    execute: async (p, a) => {
      let targetId = optionalId(a, 'sessionId');
      if (!targetId) {
        const upcoming = await CustomerAiQueryService.getUpcomingSessions(p, { audit: false });
        const list = (upcoming.data as any[]) || [];
        const candidate = list.find((s: any) => s.attendanceStatus === 'Pendiente' || s.estado_asistencial === 'Pendiente');
        if (!candidate) {
          return {
            success: true,
            status: 'Sin_Pendientes',
            message: 'No tienes citas próximas pendientes de confirmación en este momento.'
          };
        }
        targetId = candidate.id_sesion ?? candidate.sessionId;
      }
      if (!targetId) {
        return {
          success: true,
          status: 'Sin_Pendientes',
          message: 'No se identificó una sesión pendiente para confirmar.'
        };
      }
      try {
        await CustomerCompletionService.confirmSession(p, targetId, true);
      } catch (err: any) {
        if (err?.code === 'CONFLICT') {
          return {
            success: true,
            sessionId: targetId,
            status: 'Confirmada',
            idempotent: true,
            message: 'Tu cita ya se encuentra registrada como confirmada en nuestro sistema. ¡Te esperamos!'
          };
        }
        throw err;
      }
      return {
        success: true,
        sessionId: targetId,
        status: 'Confirmada',
        message: 'Tu asistencia ha sido confirmada satisfactoriamente en el sistema.'
      };
    }
  },
  {
    type: 'function',
    name: 'registerPatientSymptomTriage',
    description: 'Registra los síntomas reportados por el paciente, nivel de dolor EVA (0 a 10) y banderas rojas. Si detecta signos de alarma o dolor severo, activa automáticamente la alerta de urgencia ALT-C08 para el equipo odontológico.',
    parameters: object({
      painLevel: { type: 'integer', minimum: 0, maximum: 10, description: 'Nivel de dolor en escala 0 al 10.' },
      symptoms: { type: 'string', maxLength: 400, description: 'Descripción de los síntomas o molestias manifestadas.' },
      hasRedFlags: { type: 'boolean', description: 'Indica si presenta fiebre >38°, sangrado continuo, parestesia o dificultad respiratoria/deglución.' },
      redFlagDetails: { type: 'string', maxLength: 300, description: 'Detalle opcional de las banderas rojas identificadas.' },
      attentionId: { type: 'integer', minimum: 1, description: 'Identificador opcional de la atención relacionada.' },
      treatmentId: { type: 'integer', minimum: 1, description: 'Identificador opcional del tratamiento relacionado.' }
    }, ['painLevel', 'symptoms']),
    roles: [...patientOnly],
    execute: async (p, a) => {
      const patientContext = {
        idPersona: p.idPersona!,
        nombres: 'Paciente',
        apellidos: '',
        numero: '',
        dni: null,
        autorizaContacto: true
      };
      const result = await WhatsAppPostCareService.evaluateAndRegisterTriage(patientContext, {
        painLevel: Number(a.painLevel ?? 0),
        symptoms: String(a.symptoms || ''),
        hasRedFlags: Boolean(a.hasRedFlags),
        redFlagDetails: a.redFlagDetails ? String(a.redFlagDetails) : undefined,
        attentionId: optionalId(a, 'attentionId')
      });
      return {
        isUrgent: result.isUrgent,
        alertGenerated: Boolean(result.alertId),
        guidance: result.patientGuidance
      };
    }
  },
  {
    type: 'function',
    name: 'recordPatientSatisfactionSurvey',
    description: 'Guarda la calificación de satisfacción/NPS del paciente (0 al 10) y sus comentarios sobre el servicio recibido.',
    parameters: object({
      score: { type: 'integer', minimum: 0, maximum: 10, description: 'Calificación NPS de 0 a 10.' },
      feedback: { type: 'string', maxLength: 500, description: 'Comentario opcional del paciente sobre su experiencia.' },
      treatmentId: { type: 'integer', minimum: 1, description: 'ID opcional del tratamiento.' }
    }, ['score']),
    roles: [...patientOnly],
    execute: async (p, a) => {
      const patientContext = {
        idPersona: p.idPersona!,
        nombres: 'Paciente',
        apellidos: '',
        numero: '',
        dni: null,
        autorizaContacto: true
      };
      const result = await WhatsAppLoyaltyService.recordSatisfactionSurvey(patientContext, {
        score: Number(a.score),
        feedback: a.feedback ? String(a.feedback) : undefined
      });
      return {
        category: result.category,
        score: result.score,
        replyMessage: result.replyMessage,
        referralCode: result.referralCode,
        googleReviewUrl: result.googleReviewUrl
      };
    }
  },
  {
    type: 'function',
    name: 'createComplementaryTreatmentLead',
    description: 'Registra el interés del paciente en un servicio o tratamiento complementario hacia la etapa LEAD.',
    parameters: object({
      serviceId: integer('servicio'),
      notes: { type: 'string', maxLength: 200, description: 'Notas o detalles del tratamiento complementario de interés.' },
      treatmentId: { type: 'integer', minimum: 1, description: 'ID opcional del tratamiento actual.' }
    }, ['serviceId']),
    roles: [...patientOnly],
    execute: async (p, a) => {
      const patientContext = {
        idPersona: p.idPersona!,
        nombres: 'Paciente',
        apellidos: '',
        numero: '',
        dni: null,
        autorizaContacto: true
      };
      const result = await WhatsAppLoyaltyService.createComplementaryLead(
        patientContext,
        id(a, 'serviceId'),
        a.notes ? String(a.notes) : undefined
      );
      return result;
    }
  },
  {
    type: 'function',
    name: 'getMyAftercareInstructions',
    description: 'Obtiene las indicaciones médicas post-atención personalizadas y aprobadas por el odontólogo tratante de la atención seleccionada; si no hay selección, de la última atención cerrada. Nunca sustituye una atención sin indicaciones por otra anterior.',
    parameters: object({ attentionId: integer('atención') }),
    strict: true,
    roles: [...patientOnly],
    execute: async (p, a, context) => {
      const selected = optionalId(a, 'attentionId') ?? context?.attentionId;
      if (selected) {
        try {
          return await CustomerAiQueryService.getApprovedAftercareInstructions(p, selected, { audit: false });
        } catch {
          // Si el attentionId pasado por el LLM no es válido o pertenece a otro contexto, recurre a la última atención cerrada propia
          return await CustomerAiQueryService.getLatestClosedAftercareInstructions(p, { audit: false });
        }
      }
      return CustomerAiQueryService.getLatestClosedAftercareInstructions(p, { audit: false });
    }
  },
  { type: 'function', name: 'getOperationalTreatments', description: 'Busca por nombre, apellido o servicio hasta 50 tratamientos para coordinación. Solo datos administrativos.', parameters: object({search:{type:'string',maxLength:100}},['search']), roles: [...operations], execute: (p,a) => CustomerAiQueryService.getOperationalTreatments(p,String(a.search ?? ''),{audit:false}) },
  { type: 'function', name: 'getTreatmentProgress', description: 'Obtiene el avance operativo, no clínico, de un tratamiento autorizado. No modifica sesiones ni cierra el tratamiento.', parameters: object({ treatmentId: integer('tratamiento') }, ['treatmentId']), strict: true, roles: [...all, 'RECEPCION'], execute: (p, a) => CustomerAiQueryService.getTreatmentProgress(p, id(a, 'treatmentId'), { audit: false }) },
  {
    type: 'function',
    name: 'getApprovedAftercareInstructions',
    description: 'Obtiene indicaciones postatención aprobadas y vigentes emitidas para el paciente. Respeta la atención seleccionada; sin selección consulta la última atención cerrada, sin buscar documentos de otra anterior.',
    parameters: object({ attentionId: { type: 'integer', minimum: 1, description: 'Identificador opcional de la atención. Si se omite, se consulta la última atención.' } }),
    strict: true,
    roles: [...all],
    execute: async (p, a, context) => {
      const selected = optionalId(a, 'attentionId') ?? context?.attentionId;
      if (selected) return CustomerAiQueryService.getApprovedAftercareInstructions(p, selected, { audit: false });
      if (p.role === 'PACIENTE') return CustomerAiQueryService.getLatestClosedAftercareInstructions(p, { audit: false });
      throw new AiAgentError('INVALID_INPUT', 'Debe seleccionar una atención autorizada.');
    }
  },
  { type: 'function', name: 'getAuthorizedSessionContext', description: 'Consulta contexto de preparación de una sesión asignada, incluso sin atención abierta. Solo lectura; no registra asistencia ni inicia atención.', parameters: object({ sessionId: integer('sesión') }, ['sessionId']), strict: true, roles: [...clinical], execute: (p, a) => CustomerAiQueryService.getAuthorizedSessionContext(p, id(a, 'sessionId'), { audit: false }) },
  { type: 'function', name: 'getAuthorizedClinicalContext', description: 'Obtiene contexto clínico documental de una atención autorizada.', parameters: object({ attentionId: integer('atención') }, ['attentionId']), strict: true, roles: [...clinical], execute: (p, a) => CustomerAiQueryService.getAuthorizedClinicalContext(p, id(a, 'attentionId'), { audit: false }) },
  { type: 'function', name: 'getClinicalDocumentationStatus', description: 'Obtiene el estado documental de una atención autorizada.', parameters: object({ attentionId: integer('atención') }, ['attentionId']), strict: true, roles: [...all], execute: (p, a) => CustomerAiQueryService.getClinicalDocumentationStatus(p, id(a, 'attentionId'), { audit: false }) },
  { type: 'function', name: 'getAuthorizedAiRecords', description: 'Obtiene registros de IA dentro del ámbito autorizado.', parameters: object({ pageSize: { type: 'integer', minimum: 1, maximum: 50 } }), strict: true, roles: [...all], execute: (p, a) => CustomerAiQueryService.getAuthorizedAiRecords(p, { pageSize: a.pageSize as number | undefined }, { audit: false }) },
  {
    type: 'function',
    name: 'prepareRescheduleRequest',
    description: 'Prepara una propuesta de reprogramación de una sesión y consulta alternativas verificadas de horarios disponibles. Úsalo cuando el paciente desee explorar qué días u horas hay disponibles antes de registrar una solicitud formal.',
    parameters: object({
      sessionId: { type: 'integer', minimum: 1, description: 'ID de la sesión (id_sesion) obtenido mediante getUpcomingSessions.' },
      sessionNumber: { type: 'integer', minimum: 1, description: 'Número ordinal de la sesión dentro del tratamiento (ej. 2 para la segunda sesión, 3 para la tercera).' },
      preferredDate: { type: 'string', description: 'Fecha preferida en formato YYYY-MM-DD (ej. "2026-11-20").' },
      preferredSlot: { type: 'string', maxLength: 40, description: 'Franja horaria preferida (ej. "Tarde", "Mañana" o "15:00 - 17:00").' },
      reason: { type: 'string', maxLength: 300, description: 'Motivo del cambio de fecha indicado por el paciente (ej. "Viaje programado").' },
      idempotencyKey: { type: 'string', maxLength: 120 }
    }),
    strict: true,
    roles: [...patientOnly],
    execute: async (p, a) => {
      const resolvedSessionId = a.sessionId !== undefined && a.sessionId !== null ? Number(a.sessionId) : undefined;
      const sessionNumber = a.sessionNumber !== undefined && a.sessionNumber !== null ? Number(a.sessionNumber) : undefined;

      const prepared = await CustomerAiActionService.prepareRescheduleRequest(p, {
        sessionId: resolvedSessionId,
        sessionNumber,
        preferredDate: a.preferredDate as string | undefined,
        preferredSlot: a.preferredSlot as string | undefined,
        reason: a.reason as string | undefined,
        idempotencyKey: a.idempotencyKey as string | undefined
      });
      const { confirmationToken: _token, ...safeResult } = prepared;
      return safeResult;
    }
  },
  {
    type: 'function',
    name: 'requestReschedule',
    description: 'Registra de inmediato la solicitud formal de reprogramación de una sesión para el paciente. La solicitud queda guardada en el sistema en estado Pendiente para revisión y aplicación por parte de Recepción. Úsalo cuando el paciente solicite reprogramar y proporcione su fecha/hora preferida o confirme una de las alternativas.',
    parameters: object({
      sessionId: { type: 'integer', minimum: 1, description: 'ID de la sesión (id_sesion) obtenido mediante getUpcomingSessions.' },
      sessionNumber: { type: 'integer', minimum: 1, description: 'Número ordinal de la sesión dentro del tratamiento (ej. 2 para la segunda sesión).' },
      preferredDate: { type: 'string', description: 'Fecha preferida en formato YYYY-MM-DD (ej. "2026-11-16").' },
      preferredSlot: { type: 'string', maxLength: 40, description: 'Franja horaria o hora preferida (ej. "17:00" o "Tarde").' },
      reason: { type: 'string', maxLength: 300, description: 'Motivo del cambio de fecha indicado por el paciente.' },
      idempotencyKey: { type: 'string', maxLength: 120 }
    }),
    strict: true,
    roles: [...patientOnly],
    execute: async (p, a) => {
      const resolvedSessionId = a.sessionId !== undefined && a.sessionId !== null ? Number(a.sessionId) : undefined;
      const sessionNumber = a.sessionNumber !== undefined && a.sessionNumber !== null ? Number(a.sessionNumber) : undefined;

      const prepared = await CustomerAiActionService.prepareRescheduleRequest(p, {
        sessionId: resolvedSessionId,
        sessionNumber,
        preferredDate: a.preferredDate as string | undefined,
        preferredSlot: a.preferredSlot as string | undefined,
        reason: a.reason as string | undefined,
        idempotencyKey: a.idempotencyKey as string | undefined
      });
      const confirmed = await CustomerAiActionService.confirmRescheduleRequest(p, prepared.confirmationToken);
      return {
        action: 'RESCHEDULE_REGISTERED',
        status: 'PENDING_APPROVAL',
        requestId: confirmed.requestId,
        sessionNumber: prepared.data.sessionNumber,
        originalDate: prepared.data.originalDate,
        preferredDate: prepared.data.preferredDate,
        preferredSlot: prepared.data.preferredSlot,
        summary: `Solicitud de reprogramación #${confirmed.requestId} registrada formalmente para la sesión #${prepared.data.sessionNumber}. Enviada directamente a Recepción para revisión y aplicación en agenda clínica. La cita actual sigue reservada hasta que recepción confirme el cambio.`
      };
    }
  },
  { type: 'function', name: 'getRescheduleRequestStatus', description: 'Consulta solicitudes de reprogramación dentro del ámbito autorizado.', parameters: object({}), strict: true, roles: [...patientOnly, ...operations], execute: (p, a) => { noArgs(a); return CustomerAiActionService.getRescheduleRequests(p); } },
  { type: 'function', name: 'detectDocumentationIssues', description: 'Detecta condiciones documentales u operativas verificables y deduplica alertas abiertas.', parameters: object({ attentionId: integer('atención'), treatmentId: integer('tratamiento') }), strict: true, roles: ['ODONTOLOGO', 'RECEPCION', 'ADMIN'], execute: (p, a) => CustomerAiActionService.detectDocumentationIssues(p, { attentionId: optionalId(a, 'attentionId'), treatmentId: optionalId(a, 'treatmentId') }) },
  { type: 'function', name: 'getPendingAlerts', description: 'Consulta alertas pendientes de revisión humana.', parameters: object({}), strict: true, roles: ['ODONTOLOGO', 'RECEPCION', 'ADMIN'], execute: (p, a) => { noArgs(a); return CustomerAiActionService.getPendingAlerts(p); } },
  { type: 'function', name: 'prepareDocumentationDraft', description: 'Genera un borrador documental no prescriptivo a partir de datos ya registrados.', parameters: object({ attentionId: integer('atención') }, ['attentionId']), strict: true, roles: [...clinicalOnly], execute: (p, a) => CustomerAiActionService.prepareDocumentationDraft(p, id(a, 'attentionId')) },
  { type: 'function', name: 'getDocumentDraft', description: 'Consulta un borrador documental autorizado para revisión.', parameters: object({ draftId: integer('borrador') }, ['draftId']), strict: true, roles: ['ODONTOLOGO', 'ADMIN'], execute: (p, a) => CustomerAiActionService.getDocumentDraft(p, id(a, 'draftId')) },
  {
    type: 'function',
    name: 'searchApprovedKnowledge',
    description: 'Busca protocolos, políticas y guías generales aprobadas de la institución en el corpus oficial RAG. No devuelve historias clínicas de pacientes.',
    parameters: object({
      query: { type: 'string', maxLength: 300, description: 'Términos de consulta sobre políticas, guías o protocolos.' },
      category: { type: 'string', maxLength: 50, description: 'Categoría opcional (KB-01 a KB-05).' }
    }, ['query']),
    strict: true,
    roles: [...all, 'RECEPCION'],
    execute: (p, a, context) => {
      const q = String(a.query || '').trim();
      if (!q) throw new AiAgentError('INVALID_INPUT', 'La consulta de búsqueda documental no puede estar vacía.');
      const validCategories = ['KB-01', 'KB-02', 'KB-03', 'KB-04', 'KB-05'];
      const cat = typeof a.category === 'string' && validCategories.includes(a.category.trim().toUpperCase())
        ? a.category.trim().toUpperCase()
        : undefined;
      return durableKnowledgeService.search(p, q, { category: cat as any, correlationId: context?.correlationId, audit: false }).catch(error => {
        if (error instanceof AiAgentError && error.code === 'SERVICE_UNAVAILABLE') return { sufficientEvidence: false, results: [], limitation: 'NO_AUTHORIZED_EVIDENCE', availability: 'UNAVAILABLE' };
        throw error;
      });
    }
  },
  {
    type: 'function',
    name: 'getKnowledgeDocumentReference',
    description: 'Verifica y valida la referencia de un fragmento de conocimiento institucional aprobado para respaldar una cita.',
    parameters: object({
      documentCode: { type: 'string', maxLength: 60 },
      title: { type: 'string', maxLength: 200 },
      version: { type: 'integer', minimum: 1 },
      section: { type: 'string', maxLength: 200 },
      chunkId: { type: 'string', maxLength: 100 }
    }, ['documentCode', 'title', 'version', 'section', 'chunkId']),
    strict: true,
    roles: [...all, 'RECEPCION'],
    execute: (p, a) => {
      const ref = durableKnowledgeService.getReference(p, {
        documentCode: String(a.documentCode),
        title: String(a.title),
        version: Number(a.version),
        section: String(a.section),
        chunkId: String(a.chunkId)
      });
      return Promise.resolve(ref ?? { verified: false, message: 'La referencia no corresponde a un documento vigente y publicado.' });
    }
  }
];

export function availableTools(principal: AiAgentPrincipal): LlmToolDefinition[] { return tools.filter(tool => tool.roles.includes(principal.role)).map(({ roles: _roles, execute: _execute, ...definition }) => definition); }

export async function executeTool(principal: AiAgentPrincipal, name: string, rawArgs: unknown, context?: ToolContext): Promise<{ name: string; result: unknown }> {
  const tool = tools.find(item => item.name === name);
  if (!tool || !tool.roles.includes(principal.role)) throw new AiAgentError('FORBIDDEN', 'La herramienta solicitada no está autorizada para este perfil.');
  if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) throw new AiAgentError('INVALID_INPUT', 'Los argumentos de la herramienta no son válidos.');
  const args = rawArgs as Record<string, unknown>;
  const properties = (tool.parameters.properties || {}) as Record<string, { type?: string; minimum?: number; maximum?: number; maxLength?: number }>;
  const allowed = Object.keys(properties);
  if (Object.keys(args).some(key => !allowed.includes(key))) throw new AiAgentError('INVALID_INPUT', 'La herramienta recibió argumentos no permitidos.');
  const required = (tool.parameters.required || []) as string[];
  if (required.some(key => args[key] === undefined || args[key] === null)) throw new AiAgentError('INVALID_INPUT', 'Faltan argumentos obligatorios para la herramienta.');
  for (const [key, value] of Object.entries(args)) {
    const schema = properties[key];
    if (!schema) continue;
    if (schema.type === 'integer' && (!Number.isInteger(value) || Number(value) < (schema.minimum ?? 0) || Number(value) > (schema.maximum ?? Number.MAX_SAFE_INTEGER))) throw new AiAgentError('INVALID_INPUT', `El argumento ${key} no cumple el esquema requerido.`);
    if (schema.type === 'string' && (typeof value !== 'string' || (schema.maxLength !== undefined && value.length > schema.maxLength))) throw new AiAgentError('INVALID_INPUT', `El argumento ${key} no cumple el esquema requerido.`);
  }
  metricsCollector.recordToolExecution(name);
  return { name, result: await tool.execute(principal, args, context) };
}
