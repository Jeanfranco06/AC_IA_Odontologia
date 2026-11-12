import { CustomerAiQueryService } from '../services/customerAiQueryService';
import { CustomerAiActionService } from '../services/customerAiActionService';
import { durableKnowledgeService } from '../../knowledge-base/durableKnowledgeService';
import { AiAgentError, AiAgentPrincipal } from '../types';
import { LlmToolDefinition } from './provider';
import { metricsCollector } from '../monitoring/metricsCollector';

type Tool = LlmToolDefinition & { roles: AiAgentPrincipal['role'][]; execute: (principal: AiAgentPrincipal, args: Record<string, unknown>) => Promise<unknown> };
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
  { type: 'function', name: 'getPatientTreatments', description: 'Obtiene los tratamientos del paciente autenticado.', parameters: object({}), strict: true, roles: [...patientOnly], execute: (p, a) => { noArgs(a); return CustomerAiQueryService.getPatientTreatments(p, { audit: false }); } },
  { type: 'function', name: 'getPatientAttentions', description: 'Obtiene las atenciones y consultas odontológicas del paciente autenticado, indicando fechas, profesional, servicio realizado e identificador de atención.', parameters: object({}), strict: true, roles: [...patientOnly], execute: (p, a) => { noArgs(a); return CustomerAiQueryService.getPatientAttentions(p, {}, { audit: false }); } },
  { type: 'function', name: 'getTreatmentDetail', description: 'Obtiene el detalle documental de un tratamiento autorizado.', parameters: object({ treatmentId: integer('tratamiento') }, ['treatmentId']), strict: true, roles: [...all], execute: (p, a) => CustomerAiQueryService.getTreatmentDetail(p, id(a, 'treatmentId'), { audit: false }) },
  { type: 'function', name: 'getTreatmentSessions', description: 'Obtiene sesiones de un tratamiento autorizado.', parameters: object({ treatmentId: integer('tratamiento'), page: { type: 'integer', minimum: 1, maximum: 20 }, pageSize: { type: 'integer', minimum: 1, maximum: 50 } }, ['treatmentId']), strict: true, roles: [...all], execute: (p, a) => CustomerAiQueryService.getTreatmentSessions(p, id(a, 'treatmentId'), { page: a.page as number | undefined, pageSize: a.pageSize as number | undefined }, { audit: false }) },
  { type: 'function', name: 'getUpcomingSessions', description: 'Obtiene próximas sesiones del paciente autenticado.', parameters: object({}), strict: true, roles: [...patientOnly], execute: (p, a) => { noArgs(a); return CustomerAiQueryService.getUpcomingSessions(p, { audit: false }); } },
  { 
    type: 'function', 
    name: 'getMyAftercareInstructions', 
    description: 'Obtiene las indicaciones médicas post-atención personalizadas y aprobadas por el odontólogo tratante de la última atención recibida por el paciente autenticado. No requiere parámetros.', 
    parameters: object({}), 
    strict: true, 
    roles: [...patientOnly], 
    execute: async (p, a) => {
      noArgs(a);
      if (!p.idPersona) return { success: true, data: [] };
      const { prisma } = await import('../../../../db');
      const latest = await prisma.atenciones.findFirst({
        where: { id_persona: p.idPersona },
        orderBy: { fecha_atencion: 'desc' },
        select: { id_atencion: true }
      });
      if (!latest?.id_atencion) return { success: true, data: [] };
      return CustomerAiQueryService.getApprovedAftercareInstructions(p, latest.id_atencion, { audit: false });
    } 
  },
  { type: 'function', name: 'getTreatmentProgress', description: 'Obtiene el avance operativo, no clínico, de un tratamiento autorizado.', parameters: object({ treatmentId: integer('tratamiento') }, ['treatmentId']), strict: true, roles: [...all], execute: (p, a) => CustomerAiQueryService.getTreatmentProgress(p, id(a, 'treatmentId'), { audit: false }) },
  { 
    type: 'function', 
    name: 'getApprovedAftercareInstructions', 
    description: 'Obtiene indicaciones postatención aprobadas y vigentes emitidas para el paciente. Si no se especifica attentionId, consulta automáticamente las indicaciones de la última atención del paciente.', 
    parameters: object({ attentionId: { type: 'integer', minimum: 1, description: 'Identificador opcional de la atención. Si se omite, se consulta la última atención.' } }), 
    strict: true, 
    roles: [...all], 
    execute: async (p, a) => {
      let attId = optionalId(a, 'attentionId');
      if (!attId && p.role === 'PACIENTE' && p.idPersona) {
        const { prisma } = await import('../../../../db');
        const latest = await prisma.atenciones.findFirst({
          where: { id_persona: p.idPersona },
          orderBy: { fecha_atencion: 'desc' },
          select: { id_atencion: true }
        });
        attId = latest?.id_atencion;
      }
      if (!attId) return { success: true, data: [] };
      return CustomerAiQueryService.getApprovedAftercareInstructions(p, attId, { audit: false });
    } 
  },
  { type: 'function', name: 'getAuthorizedClinicalContext', description: 'Obtiene contexto clínico documental de una atención autorizada.', parameters: object({ attentionId: integer('atención') }, ['attentionId']), strict: true, roles: [...clinical], execute: (p, a) => CustomerAiQueryService.getAuthorizedClinicalContext(p, id(a, 'attentionId'), { audit: false }) },
  { type: 'function', name: 'getClinicalDocumentationStatus', description: 'Obtiene el estado documental de una atención autorizada.', parameters: object({ attentionId: integer('atención') }, ['attentionId']), strict: true, roles: [...all], execute: (p, a) => CustomerAiQueryService.getClinicalDocumentationStatus(p, id(a, 'attentionId'), { audit: false }) },
  { type: 'function', name: 'getAuthorizedAiRecords', description: 'Obtiene registros de IA dentro del ámbito autorizado.', parameters: object({ pageSize: { type: 'integer', minimum: 1, maximum: 50 } }), strict: true, roles: [...all], execute: (p, a) => CustomerAiQueryService.getAuthorizedAiRecords(p, { pageSize: a.pageSize as number | undefined }, { audit: false }) },
  {
    type: 'function',
    name: 'prepareRescheduleRequest',
    description: 'Prepara una solicitud de reprogramación o cambio de fecha de una sesión del paciente autenticado. No modifica la agenda directamente; registra la solicitud para que recepción la revise y apruebe tras confirmación del paciente.',
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
      let resolvedSessionId = a.sessionId !== undefined && a.sessionId !== null ? Number(a.sessionId) : undefined;
      let sessionNumber = a.sessionNumber !== undefined && a.sessionNumber !== null ? Number(a.sessionNumber) : undefined;

      // Si el LLM proporcionó un número pequeño en sessionId (ej. 2, 3) sin haber consultado getUpcomingSessions,
      // verificamos si pertenece directamente al paciente; si no, verificamos si corresponde a su numero_sesion.
      if (resolvedSessionId && p.idPersona) {
        const { prisma } = await import('../../../../db');
        const belongs = await prisma.sesionesTratamiento.findFirst({
          where: {
            id_sesion: resolvedSessionId,
            TratamientosContratados: { id_persona: p.idPersona }
          }
        });
        if (!belongs) {
          const byNumber = await prisma.sesionesTratamiento.findFirst({
            where: {
              numero_sesion: resolvedSessionId,
              TratamientosContratados: {
                id_persona: p.idPersona,
                estado_tratamiento: { in: ['Contratado', 'Activado', 'Activo', 'En_Curso', 'En curso'] }
              }
            }
          });
          if (byNumber) {
            resolvedSessionId = byNumber.id_sesion;
            sessionNumber = byNumber.numero_sesion;
          }
        }
      }

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
    execute: (p, a) => {
      const q = String(a.query || '').trim();
      if (!q) throw new AiAgentError('INVALID_INPUT', 'La consulta de búsqueda documental no puede estar vacía.');
      const validCategories = ['KB-01', 'KB-02', 'KB-03', 'KB-04', 'KB-05'];
      const cat = typeof a.category === 'string' && validCategories.includes(a.category.trim().toUpperCase())
        ? a.category.trim().toUpperCase()
        : undefined;
      return durableKnowledgeService.search(p, q, { category: cat as any });
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

export async function executeTool(principal: AiAgentPrincipal, name: string, rawArgs: unknown): Promise<{ name: string; result: unknown }> {
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
    if (schema.type === 'integer' && (!Number.isInteger(value) || Number(value) < (schema.minimum ?? 1) || Number(value) > (schema.maximum ?? Number.MAX_SAFE_INTEGER))) throw new AiAgentError('INVALID_INPUT', `El argumento ${key} no cumple el esquema requerido.`);
    if (schema.type === 'string' && (typeof value !== 'string' || (schema.maxLength !== undefined && value.length > schema.maxLength))) throw new AiAgentError('INVALID_INPUT', `El argumento ${key} no cumple el esquema requerido.`);
  }
  metricsCollector.recordToolExecution(name);
  return { name, result: await tool.execute(principal, args) };
}
