import crypto from 'crypto';
import { CustomerAiQueryService } from '../services/customerAiQueryService';
import type { IssuedInstruction } from './sourceIntegrity';
import { CustomerAiPersistenceService } from '../../../../services/customerAiPersistenceService';
import { AiAgentError, AiAgentPrincipal } from '../types';
import { availableTools, executeTool } from './toolRegistry';
import { durableKnowledgeService } from '../../knowledge-base/durableKnowledgeService';
import { metricsCollector } from '../monitoring/metricsCollector';
import { LlmProvider, LlmResult, runtimeConfig } from './provider';
import { GeminiProvider } from './geminiProvider';
import { systemInstructions } from './systemInstructions';
import { CustomerCompletionService, auditCustomer, type CustomerAuditResource } from '../services/customerCompletionService';
import { treatmentForPrincipal, attentionForPrincipal } from '../policies';
import { preserveIssuedInstructions, ensureKnowledgeCitations,explainAnalytics,explainDocumentationCheck,explainTreatmentClosureChecklist } from './sourceIntegrity';

export interface RescheduleDraft {
  sessionId: number; sessionNumber: number; treatmentId: number;
  originalDate: string; preferredDate: string | null; preferredSlot: string | null; reason: string | null;
  alternatives: Array<{ date: string; professionalName: string; branchName: string }>;
}
export interface ChatAnswer { rescheduleDraft?: RescheduleDraft; message: string; toolsUsed: string[]; limitations: string[]; correlationId: string; }

export function boundedToolOutput(value: unknown, limit: number) {
  const serialized = JSON.stringify(value) ?? 'null';
  if (serialized.length <= limit) return serialized;
  return JSON.stringify({ truncated: true, preview: serialized.slice(0, Math.max(0, limit - 64)) });
}

export class CustomerAiOrchestrator {
  private static activeRequests = 0;
  constructor(private readonly providerFactory: () => LlmProvider = () => new GeminiProvider()) {}

  async answer(principal: AiAgentPrincipal, message: unknown, context: {treatmentId?:number;attentionId?:number;sessionId?:number;mode?:'analytics'} = {}): Promise<ChatAnswer> {
    const config = runtimeConfig();
    const correlationId = crypto.randomUUID();
    const resource:CustomerAuditResource={};
    try {
      if(context.mode&&context.mode!=='analytics')throw new AiAgentError('INVALID_INPUT','Modalidad no reconocida.');
      if(context.mode==='analytics'&&principal.role==='PACIENTE')throw new AiAgentError('FORBIDDEN','El paciente no accede al Mart analítico.');
      if (typeof message !== 'string' || !message.trim() || message.length > config.maxInputChars) throw new AiAgentError('INVALID_INPUT', `El mensaje debe tener entre 1 y ${config.maxInputChars} caracteres.`);
      if(context.treatmentId){const t=await treatmentForPrincipal(context.treatmentId,principal);Object.assign(resource,{personId:t.id_persona,treatmentId:t.id_tratamiento});}
      if(context.attentionId){const a=await attentionForPrincipal(context.attentionId,principal);if(context.treatmentId&&a.id_tratamiento!==context.treatmentId)throw new AiAgentError('INVALID_INPUT','La atención seleccionada no corresponde al tratamiento.');Object.assign(resource,{personId:a.id_persona,treatmentId:a.id_tratamiento??undefined,attentionId:a.id_atencion,sessionId:a.id_sesion??undefined});}
      if(context.sessionId){const response:any=await CustomerAiQueryService.getAuthorizedSessionContext(principal,context.sessionId,{audit:false});const c=response.data;if((context.treatmentId&&c.provenance?.treatmentId!==context.treatmentId)||(context.attentionId&&c.provenance?.attentionId!==context.attentionId))throw new AiAgentError('INVALID_INPUT','La sesión no corresponde al contexto seleccionado.');Object.assign(resource,{personId:c.patientId,treatmentId:c.provenance?.treatmentId,attentionId:c.provenance?.attentionId??undefined,sessionId:context.sessionId});}
      if(principal.role==='PACIENTE'&&context.treatmentId){
        const protocol=await CustomerCompletionService.policy('DERIVACION');
        const triggers:string[]=protocol?JSON.parse(protocol.configuracion).triggers:[];
        if(triggers.some(word=>message.toLocaleLowerCase('es').includes(word.toLocaleLowerCase('es')))){
          await CustomerCompletionService.refer(principal,context.treatmentId,correlationId,correlationId);
          await this.audit(principal,correlationId,'CONVERSACION_DERIVADA',resource);
          return {message:'La consulta requiere valoración profesional. Se registró una solicitud en la bandeja del odontólogo responsable; el asistente no realiza diagnóstico, no asigna gravedad y no garantiza atención inmediata.',toolsUsed:['derivacionPorPoliticaPublicada'],limitations:['No es un servicio de emergencias ni un triaje automatizado.'],correlationId};
        }
      }
      if (!config.enabled) throw new AiAgentError('SERVICE_UNAVAILABLE', 'El agente conversacional está deshabilitado. Configure AI_AGENT_LLM_ENABLED=true para habilitarlo.');
      if (config.provider !== 'gemini') throw new AiAgentError('SERVICE_UNAVAILABLE', 'El proveedor configurado no está disponible.');
      if (!config.externalDataAuthorized) throw new AiAgentError('SERVICE_UNAVAILABLE', 'El envío de datos al proveedor externo no tiene autorización de privacidad.');
      if (CustomerAiOrchestrator.activeRequests >= config.maxConcurrency) throw new AiAgentError('CONFLICT', 'El agente está atendiendo el máximo de conversaciones simultáneas.');
    } catch(error) {
      if(principal.idPersona||principal.idUsuario)await auditCustomer(principal,'CONVERSACION_RECHAZADA',{},'Fallida',correlationId).catch(()=>undefined);
      throw error;
    }
    CustomerAiOrchestrator.activeRequests += 1;
    try {
      const provider = this.providerFactory();
      const tools = availableTools(principal).filter(t=>context.mode!=='analytics'||['getTreatmentAnalytics','getSessionComplianceAnalytics','getClinicalDocumentationAnalytics','getAiPerformanceAnalytics'].includes(t.name));
      const input: Record<string, unknown>[] = [{ role: 'user', content: message.trim()+(context.sessionId?`\nSesión seleccionada y autorizada para preparación: ${context.sessionId}. Usa getAuthorizedSessionContext; consultar no abre atención.`:'')+(context.attentionId?`\nAtención seleccionada y autorizada: ${context.attentionId}`:'')+(context.treatmentId?`\nTratamiento seleccionado y autorizado: ${context.treatmentId}`:'') }];
      const toolsUsed: string[] = [];
      const references: any[] = [];
      let issuedInstructions: IssuedInstruction[] = [];
      const analyticsResults:any[]=[];
      let rescheduleDraft: RescheduleDraft | undefined;
      const limitations: string[] = ['Respuesta basada únicamente en datos autorizados de NexoSaludDB; no constituye diagnóstico ni prescripción.'];
      for (let iteration = 0; iteration < config.maxIterations; iteration += 1) {
        const result = await this.withTimeout(signal => provider.complete({ instructions: systemInstructions(principal), input, tools, model: config.model, maxOutputTokens: config.maxOutputTokens, timeoutMs: config.timeoutMs, signal }), config.timeoutMs);
        metricsCollector.recordLlmCall(true);
        if (result.kind === 'message') {
          for (const reference of references) if (!durableKnowledgeService.getReference(principal, reference)) throw new AiAgentError('SERVICE_UNAVAILABLE','Una fuente fue revocada durante la respuesta.');
          for (const attentionId of new Set(issuedInstructions.map(row => row.id_atencion).filter((id): id is number => typeof id === 'number'))) {
            const current = (await CustomerAiQueryService.getApprovedAftercareInstructions(principal, attentionId, { audit: false })).data as IssuedInstruction[];
            if (issuedInstructions.filter(row => row.id_atencion === attentionId).some(row => !current.some(latest => latest.instructionId === row.instructionId && latest.version === row.version && latest.content === row.content))) throw new AiAgentError('SERVICE_UNAVAILABLE', 'Las indicaciones cambiaron o dejaron de estar autorizadas durante la consulta. Vuelve a consultar antes de utilizarlas.');
          }
          const answer = analyticsResults.length?explainAnalytics(analyticsResults):issuedInstructions.length ? preserveIssuedInstructions(issuedInstructions) : ensureKnowledgeCitations(result.text.trim(), references);
          if (!answer || answer.length > config.maxOutputChars) throw new AiAgentError('SERVICE_UNAVAILABLE', 'La respuesta del proveedor no cumple las restricciones de salida.');
          await this.audit(principal, correlationId, toolsUsed.length ? 'CONVERSACION_CON_HERRAMIENTAS' : 'CONVERSACION_AGENTE', resource);
          return { message: answer, toolsUsed, limitations, correlationId, ...(rescheduleDraft ? { rescheduleDraft } : {}) };
        }
        if (toolsUsed.length >= config.maxToolCalls) throw new AiAgentError('CONFLICT', 'Se alcanzó el límite seguro de consultas internas para este turno.');
        const args = this.parseArguments(result);
        if(!tools.some(t=>t.name===result.name))throw new AiAgentError('FORBIDDEN','La herramienta no pertenece a la modalidad autorizada.');
        const execution = await executeTool(principal, result.name, args, { correlationId, sourceMessage: message.trim(), attentionId: context.attentionId });
        if (execution.name === 'getTreatmentClosureChecklist') {
          await this.audit(principal, correlationId, 'CONVERSACION_CHECKLIST_CIERRE', resource);
          return {message:explainTreatmentClosureChecklist(execution.result as any),toolsUsed:[...toolsUsed,execution.name],limitations:['Preparación consultiva; solo el profesional confirma la conclusión del tratamiento.'],correlationId};
        }
        if (execution.name === 'checkClinicalDocumentation') {
          const message = explainDocumentationCheck(execution.result as any);
          await this.audit(principal, correlationId, 'CONVERSACION_VERIFICACION_DOCUMENTAL', resource);
          return { message, toolsUsed: [...toolsUsed,execution.name], limitations: ['Comprobación de solo lectura; la validación y el cierre requieren acciones profesionales separadas.'], correlationId };
        }
        if(['getTreatmentAnalytics','getSessionComplianceAnalytics','getClinicalDocumentationAnalytics','getAiPerformanceAnalytics'].includes(execution.name))analyticsResults.push(execution.result);
        if (execution.name === 'prepareRescheduleRequest' && principal.role === 'PACIENTE') {
          const prepared = execution.result as { status: string; data: RescheduleDraft };
          if (prepared.status === 'PREPARED') {
            const d = prepared.data;
            // Solo datos autorizados del servicio, sin token ni texto interpretado del modelo.
            rescheduleDraft = { sessionId: d.sessionId, sessionNumber: d.sessionNumber, treatmentId: d.treatmentId, originalDate: d.originalDate, preferredDate: d.preferredDate, preferredSlot: d.preferredSlot, reason: d.reason, alternatives: d.alternatives.map(slot => ({ date: slot.date, professionalName: slot.professionalName, branchName: slot.branchName })) };
          }
        }
        if (execution.name === 'searchApprovedKnowledge') {
          const knowledge = execution.result as any;
          if (!knowledge.sufficientEvidence || !knowledge.results?.length) {
            // No entregar una respuesta inventada por el proveedor tras una búsqueda vacía o no disponible.
            if (!references.length) {
              await this.audit(principal, correlationId, 'CONVERSACION_RAG_SIN_EVIDENCIA', resource);
              return {
                message: (issuedInstructions.length ? preserveIssuedInstructions(issuedInstructions) + '\n\nSobre la información general adicional: ' : '') + (knowledge.availability === 'UNAVAILABLE'
                  ? 'No pude consultar la información institucional aprobada en este momento. No puedo verificar la respuesta ni proporcionar un contacto institucional. Para una duda clínica, utiliza «Solicitar revisión humana» en el portal o consulta a tu profesional por el canal que ya te haya proporcionado la clínica.'
                  : 'No encontré información institucional publicada y autorizada sobre esta consulta. No puedo confirmar horarios, reglas o contactos sin una fuente verificada. Para una duda clínica, utiliza «Solicitar revisión humana» en el portal o consulta a tu profesional por el canal que ya te haya proporcionado la clínica.'),
                toolsUsed: [...toolsUsed, execution.name], limitations: ['Sin evidencia documental verificable; no constituye diagnóstico ni prescripción. No se ha registrado una derivación automáticamente.'], correlationId
              };
            }
          } else {
            for (const item of knowledge.results) references.push(item.reference);
            limitations.splice(0, limitations.length, 'Respuesta basada en contenidos institucionales publicados y autorizados; no constituye diagnóstico ni prescripción.');
          }
        }
        if (['getMyAftercareInstructions','getApprovedAftercareInstructions'].includes(execution.name)) {
          const instructions = execution.result as any;
          issuedInstructions = instructions?.data ?? [];
          if (!issuedInstructions.length) {
            const reason = instructions?.meta?.availabilityReason;
            await this.audit(principal, correlationId, 'CONVERSACION_SIN_INDICACIONES_EMITIDAS', resource);
            return { message: reason === 'ATTENTION_NOT_CLOSED'
              ? 'La atención seleccionada todavía no está cerrada. No puedo presentar sus indicaciones como finales. Solicita al odontólogo que confirme las instrucciones correspondientes.'
              : reason === 'NO_CLOSED_ATTENTION' ? 'No encontré una atención cerrada de la que pueda consultar indicaciones finales. Solicita orientación al odontólogo.'
              : 'No encontré indicaciones aprobadas, emitidas y vigentes para esta atención. No las sustituiré por las de otra atención ni por recomendaciones generales. Solicita al odontólogo las indicaciones correspondientes.',
              toolsUsed: [...toolsUsed, execution.name], limitations: ['Consulta de solo lectura. No se modificaron indicaciones ni tratamientos.'], correlationId };
          }
        }
        toolsUsed.push(execution.name);
        input.push({
          type: 'function_call',
          call_id: result.callId,
          name: result.name,
          arguments: JSON.stringify(args),
          thoughtSignature: (result as any).thoughtSignature,
        });
        input.push({ type: 'function_call_output', call_id: result.callId, name: execution.name, output: boundedToolOutput(execution.result, config.maxOutputChars) });
      }
      throw new AiAgentError('CONFLICT', 'Se alcanzó el límite seguro de iteraciones del agente.');
    } catch (error) {
      metricsCollector.recordLlmCall(false);
      // Si la llamada al LLM externo falló durante el completado o por timeout de red
      // (y la variable AI_AGENT_RAG_FALLBACK_ENABLED está activa o en producción ante error de red de Gemini),
      // activamos el fallback local determinista con el motor RAG indexado
      if (
        process.env.AI_AGENT_RAG_FALLBACK_ENABLED === 'true' &&
        error instanceof AiAgentError &&
        error.code === 'SERVICE_UNAVAILABLE'
      ) {
        try {
          const fallback = await this.fallbackAnswer(principal, String(message).trim(), correlationId, resource);
          if (fallback) return fallback;
        } catch {
          // continuar con el error original si el fallback no aplica
        }
      }
      if (principal.idUsuario || principal.idPersona) await auditCustomer(principal, 'CONVERSACION_FALLIDA', resource, 'Fallida', correlationId).catch(() => undefined);
      if (error instanceof AiAgentError) throw error;
      throw new AiAgentError('SERVICE_UNAVAILABLE', 'No fue posible completar la conversación con el proveedor de IA.');
    } finally {
      CustomerAiOrchestrator.activeRequests -= 1;
    }
  }

  /**
   * Respaldo local determinista basado en el motor RAG y fuentes oficiales cuando el LLM externo
   * no está disponible o se agota su cuota.
   */
  private async fallbackAnswer(principal: AiAgentPrincipal, query: string, correlationId: string, resource:CustomerAuditResource): Promise<ChatAnswer | null> {
    const ragResult = await durableKnowledgeService.search(principal, query, { limit: 3, correlationId, audit: false });
    if (!ragResult.sufficientEvidence || !ragResult.results.length) {
      await this.audit(principal, correlationId, 'CONVERSACION_RAG_LOCAL',resource);
      return {
        message: 'No se encontró evidencia institucional publicada ni autorizada sobre este tema en la base de conocimientos oficial de NexoSalud.',
        toolsUsed: ['searchApprovedKnowledge'],
        limitations: ['Respuesta basada en búsqueda documental local; abstención por falta de evidencia aprobada.'],
        correlationId
      };
    }

    if (ragResult.results.some(r => !durableKnowledgeService.getReference(principal, r.reference))) throw new AiAgentError('SERVICE_UNAVAILABLE', 'Una fuente fue revocada durante la respuesta documental.');
    const citations = ragResult.results.map(r => `[Documento: ${r.reference.documentCode} v${r.reference.version}, Sección: ${r.reference.section}]`);
    const excerpts = ragResult.results.map(r => r.excerpt).join('\n\n');
    const message = `${excerpts}\n\n${citations.join(' ')}`;
    await this.audit(principal, correlationId, 'CONVERSACION_RAG_LOCAL',resource);

    return {
      message,
      toolsUsed: ['searchApprovedKnowledge'],
      limitations: ['Respaldo documental asistido mediante motor RAG oficial de NexoSalud.'],
      correlationId
    };
  }

  private parseArguments(result: Extract<LlmResult, { kind: 'tool_call' }>): Record<string, unknown> {
    try { const parsed = JSON.parse(result.arguments); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); return parsed as Record<string, unknown>; }
    catch { throw new AiAgentError('INVALID_INPUT', 'El proveedor devolvió argumentos de herramienta malformados.'); }
  }

  private async withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new AiAgentError('SERVICE_UNAVAILABLE', 'La consulta al proveedor de IA excedió el tiempo permitido.')); }, timeoutMs); });
    try { return await Promise.race([operation(controller.signal), timeout]); } finally { if (timer) clearTimeout(timer); }
  }

  private async audit(principal: AiAgentPrincipal, correlationId: string, type: string, resource:CustomerAuditResource = {}) {
    if (principal.role!=='PACIENTE' || !principal.idPersona) { await auditCustomer(principal, type, resource, 'Completada', correlationId); return; }
    await CustomerAiPersistenceService.registrarInteraccion({ idPersona: principal.idPersona, actorOrientado: 'PACIENTE', tipoEvento: type, resumenConsulta: 'Consulta conversacional del agente', idProfesional: principal.idProfesional, idTratamiento:resource.treatmentId,idAtencion:resource.attentionId,idSesion:resource.sessionId,idCorrelacion: correlationId });
  }
}

export const customerAiOrchestrator = new CustomerAiOrchestrator();
