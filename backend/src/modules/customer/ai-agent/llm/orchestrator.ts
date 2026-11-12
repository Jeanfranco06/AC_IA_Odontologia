import crypto from 'crypto';
import { CustomerAiPersistenceService } from '../../../../services/customerAiPersistenceService';
import { AiAgentError, AiAgentPrincipal } from '../types';
import { availableTools, executeTool } from './toolRegistry';
import { durableKnowledgeService } from '../../knowledge-base/durableKnowledgeService';
import { metricsCollector } from '../monitoring/metricsCollector';
import { LlmProvider, LlmResult, runtimeConfig } from './provider';
import { GeminiProvider } from './geminiProvider';
import { systemInstructions } from './systemInstructions';
import { CustomerCompletionService, auditCustomer } from '../services/customerCompletionService';
import { treatmentForPrincipal, attentionForPrincipal } from '../policies';
import { preserveIssuedInstructions, verifyCitations,explainAnalytics } from './sourceIntegrity';

export interface ChatAnswer { message: string; toolsUsed: string[]; limitations: string[]; correlationId: string; }

export function boundedToolOutput(value: unknown, limit: number) {
  const serialized = JSON.stringify(value) ?? 'null';
  if (serialized.length <= limit) return serialized;
  return JSON.stringify({ truncated: true, preview: serialized.slice(0, Math.max(0, limit - 64)) });
}

export class CustomerAiOrchestrator {
  private static activeRequests = 0;
  constructor(private readonly providerFactory: () => LlmProvider = () => new GeminiProvider()) {}

  async answer(principal: AiAgentPrincipal, message: unknown, context: {treatmentId?:number;attentionId?:number;mode?:'analytics'} = {}): Promise<ChatAnswer> {
    const config = runtimeConfig();
    const correlationId = crypto.randomUUID();
    if(context.mode&&context.mode!=='analytics')throw new AiAgentError('INVALID_INPUT','Modalidad no reconocida.');
    if(context.mode==='analytics'&&principal.role==='PACIENTE')throw new AiAgentError('FORBIDDEN','El paciente no accede al Mart analítico.');
    if (typeof message !== 'string' || !message.trim() || message.length > config.maxInputChars) throw new AiAgentError('INVALID_INPUT', `El mensaje debe tener entre 1 y ${config.maxInputChars} caracteres.`);
    if(context.treatmentId)await treatmentForPrincipal(context.treatmentId,principal);
    if(context.attentionId)await attentionForPrincipal(context.attentionId,principal);
    if(principal.role==='PACIENTE'&&context.treatmentId){
      const protocol=await CustomerCompletionService.policy('DERIVACION');
      const triggers:string[]=protocol?JSON.parse(protocol.configuracion).triggers:[];
      if(triggers.some(word=>message.toLocaleLowerCase('es').includes(word.toLocaleLowerCase('es')))){
        await CustomerCompletionService.refer(principal,context.treatmentId,correlationId,correlationId);
        await this.audit(principal,correlationId,'CONVERSACION_DERIVADA');
        return {message:'La consulta requiere valoración profesional. Se registró una solicitud en la bandeja del odontólogo responsable; el asistente no realiza diagnóstico, no asigna gravedad y no garantiza atención inmediata.',toolsUsed:['derivacionPorPoliticaPublicada'],limitations:['No es un servicio de emergencias ni un triaje automatizado.'],correlationId};
      }
    }
    if (!config.enabled) throw new AiAgentError('SERVICE_UNAVAILABLE', 'El agente conversacional está deshabilitado. Configure AI_AGENT_LLM_ENABLED=true para habilitarlo.');
    if (config.provider !== 'gemini') throw new AiAgentError('SERVICE_UNAVAILABLE', 'El proveedor configurado no está disponible.');
    if (!config.externalDataAuthorized) throw new AiAgentError('SERVICE_UNAVAILABLE', 'El envío de datos al proveedor externo no tiene autorización de privacidad.');
    if (CustomerAiOrchestrator.activeRequests >= config.maxConcurrency) throw new AiAgentError('CONFLICT', 'El agente está atendiendo el máximo de conversaciones simultáneas.');

    CustomerAiOrchestrator.activeRequests += 1;
    try {
      const provider = this.providerFactory();
      const tools = availableTools(principal).filter(t=>context.mode!=='analytics'||['getTreatmentAnalytics','getSessionComplianceAnalytics','getClinicalDocumentationAnalytics','getAiPerformanceAnalytics'].includes(t.name));
      const input: Record<string, unknown>[] = [{ role: 'user', content: message.trim()+(context.attentionId?`\nAtención seleccionada y autorizada: ${context.attentionId}`:'')+(context.treatmentId?`\nTratamiento seleccionado y autorizado: ${context.treatmentId}`:'') }];
      const toolsUsed: string[] = [];
      const references: any[] = [];
      let issuedInstructions: Array<{content:string;instructionId?:number;version?:number}> = [];
      const analyticsResults:any[]=[];
      const limitations: string[] = ['Respuesta basada únicamente en datos autorizados de NexoSaludDB; no constituye diagnóstico ni prescripción.'];
      for (let iteration = 0; iteration < config.maxIterations; iteration += 1) {
        const result = await this.withTimeout(signal => provider.complete({ instructions: systemInstructions(principal), input, tools, model: config.model, maxOutputTokens: config.maxOutputTokens, timeoutMs: config.timeoutMs, signal }), config.timeoutMs);
        metricsCollector.recordLlmCall(true);
        if (result.kind === 'message') {
          for (const reference of references) if (!durableKnowledgeService.getReference(principal, reference)) throw new AiAgentError('SERVICE_UNAVAILABLE','Una fuente fue revocada durante la respuesta.');
          const answer = analyticsResults.length?explainAnalytics(analyticsResults):issuedInstructions.length ? preserveIssuedInstructions(issuedInstructions) : verifyCitations(result.text.trim(), references);
          if (!answer || answer.length > config.maxOutputChars) throw new AiAgentError('SERVICE_UNAVAILABLE', 'La respuesta del proveedor no cumple las restricciones de salida.');
          await this.audit(principal, correlationId, toolsUsed.length ? 'CONVERSACION_CON_HERRAMIENTAS' : 'CONVERSACION_AGENTE');
          return { message: answer, toolsUsed, limitations, correlationId };
        }
        if (toolsUsed.length >= config.maxToolCalls) throw new AiAgentError('CONFLICT', 'Se alcanzó el límite seguro de consultas internas para este turno.');
        const args = this.parseArguments(result);
        if(!tools.some(t=>t.name===result.name))throw new AiAgentError('FORBIDDEN','La herramienta no pertenece a la modalidad autorizada.');
        const execution = await executeTool(principal, result.name, args, { correlationId, sourceMessage: message.trim() });
        if(['getTreatmentAnalytics','getSessionComplianceAnalytics','getClinicalDocumentationAnalytics','getAiPerformanceAnalytics'].includes(execution.name))analyticsResults.push(execution.result);
        if (execution.name === 'searchApprovedKnowledge') for (const item of (execution.result as any)?.results ?? []) references.push(item.reference);
        if (['getMyAftercareInstructions','getApprovedAftercareInstructions'].includes(execution.name)) issuedInstructions = (execution.result as any)?.data ?? [];
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
      if (principal.idUsuario || principal.idPersona) await auditCustomer(principal, 'CONVERSACION_FALLIDA', {}, 'Fallida', correlationId).catch(() => undefined);
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
          const fallback = await this.fallbackAnswer(principal, String(message).trim(), correlationId);
          if (fallback) return fallback;
        } catch {
          // continuar con el error original si el fallback no aplica
        }
      }
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
  private async fallbackAnswer(principal: AiAgentPrincipal, query: string, correlationId: string): Promise<ChatAnswer | null> {
    const ragResult = await durableKnowledgeService.search(principal, query, { limit: 3, correlationId, audit: false });
    await this.audit(principal, correlationId, 'CONVERSACION_RAG_LOCAL');
    if (!ragResult.sufficientEvidence || !ragResult.results.length) {
      return {
        message: 'No se encontró evidencia institucional publicada ni autorizada sobre este tema en la base de conocimientos oficial de NexoSalud.',
        toolsUsed: ['searchApprovedKnowledge'],
        limitations: ['Respuesta basada en búsqueda documental local; abstención por falta de evidencia aprobada.'],
        correlationId
      };
    }

    const citations = ragResult.results.map(r => `[Documento: ${r.reference.documentCode} v${r.reference.version}, Sección: ${r.reference.section}]`);
    const excerpts = ragResult.results.map(r => r.excerpt).join('\n\n');
    const message = `${excerpts}\n\n${citations.join(' ')}`;

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

  private async audit(principal: AiAgentPrincipal, correlationId: string, type: string) {
    if (!principal.idPersona) { await auditCustomer(principal, type, {}, 'Completada', correlationId); return; }
    await CustomerAiPersistenceService.registrarInteraccion({ idPersona: principal.idPersona, actorOrientado: principal.role === 'ODONTOLOGO' ? 'ODONTOLOGO' : 'PACIENTE', tipoEvento: type, resumenConsulta: 'Consulta conversacional del agente', idProfesional: principal.idProfesional, idCorrelacion: correlationId });
  }
}

export const customerAiOrchestrator = new CustomerAiOrchestrator();
