import { GoogleGenAI } from '@google/genai';
import { AiAgentError } from '../types';
import { LlmProvider, LlmRequest, LlmResult } from './provider';

function providerError(error: any): AiAgentError {
  if (error instanceof AiAgentError) return error;
  const messages: Record<number, string> = {
    400: 'Gemini rechazó los parámetros de la solicitud (400).',
    401: 'Gemini rechazó la autenticación (401); revise la clave configurada.',
    403: 'Gemini denegó el acceso (403); revise permisos y restricciones del proyecto.',
    404: 'El modelo configurado no está disponible para esta API o proyecto (404).',
    429: 'Gemini alcanzó un límite de solicitudes, tokens o cuota (429). Revise los límites del proyecto; puede ser temporal y no implica necesariamente cuota agotada.',
    500: 'Gemini presentó un error interno temporal (500).',
    503: 'Gemini está temporalmente no disponible o sobrecargado (503).',
    504: 'Gemini excedió su tiempo de respuesta (504).'
  };
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return new AiAgentError('SERVICE_UNAVAILABLE', 'La consulta a Gemini excedió el tiempo permitido.');
  return new AiAgentError('SERVICE_UNAVAILABLE', messages[Number(error?.status)] || 'No se pudo completar la conexión con Gemini; revise la conectividad.');
}

export class GeminiProvider implements LlmProvider {
  private readonly client: GoogleGenAI;

  constructor(private readonly apiKey = process.env.GEMINI_API_KEY) {
    if (process.env.NODE_ENV === 'test' && process.env.AI_AGENT_ALLOW_REAL_GEMINI !== 'true') throw new AiAgentError('SERVICE_UNAVAILABLE', 'Proveedor real bloqueado en pruebas; utilice un proveedor simulado explícito.');
    if (!apiKey) throw new AiAgentError('SERVICE_UNAVAILABLE', 'El proveedor Gemini no está configurado.');
    this.client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1beta' } });
  }

  async complete(request: LlmRequest): Promise<LlmResult> {
    try {
      const contents = request.input.map(item => {
        if (item.type === 'function_call_output') {
          const result = JSON.parse(String(item.output || '{}'));
          // Gemini exige un objeto en functionResponse.response, incluso si
          // la herramienta devuelve listas (p. ej. horarios) o valores simples.
          const response = result !== null && typeof result === 'object' && !Array.isArray(result) ? result : { result };
          return {
            role: 'user',
            parts: [{
              functionResponse: {
                name: String(item.name || ''),
                response,
                id: String(item.call_id || '')
              }
            }]
          };
        }
        if (item.type === 'function_call') {
          const part: any = {
            functionCall: {
              name: String(item.name),
              args: JSON.parse(String(item.arguments || '{}')),
              id: String(item.call_id || '')
            }
          };
          if (item.thoughtSignature || item.thought_signature) {
            part.thoughtSignature = item.thoughtSignature || item.thought_signature;
          }
          return { role: 'model', parts: [part] };
        }
        return { role: 'user', parts: [{ text: String(item.content || '') }] };
      });

      // Evitar que cambios de modelo oculten la causa original y multipliquen solicitudes.
      const candidates = [request.model];

      let lastError: any = null;
      for (const modelToTry of candidates) {
        try {
          const response = await this.client.models.generateContent({
            model: modelToTry,
            contents,
            config: {
              systemInstruction: request.instructions,
              maxOutputTokens: request.maxOutputTokens,
              abortSignal: request.signal,
              ...(request.tools.length ? { tools: [{ functionDeclarations: request.tools.map(tool => ({ name: tool.name, description: tool.description, parameters: tool.parameters })) }] } : {}),
              automaticFunctionCalling: { disable: true },
            },
          } as any);

          const candPart = (response as any).candidates?.[0]?.content?.parts?.find((part: any) => part.functionCall);
          const functionCall = (response as any).functionCalls?.[0] || candPart?.functionCall;
          const thoughtSignature = candPart?.thoughtSignature || candPart?.thought_signature;

          if (functionCall) {
            return {
              kind: 'tool_call',
              callId: String(functionCall.id || `${functionCall.name}-${Date.now()}`),
              name: String(functionCall.name),
              arguments: JSON.stringify(functionCall.args || {}),
              thoughtSignature
            };
          }

          const text = String((response as any).text || '').trim();
          if (!text) throw new AiAgentError('SERVICE_UNAVAILABLE', 'Gemini devolvió una respuesta vacía.');
          return { kind: 'message', text };
        } catch (candidateErr: any) {
          lastError = candidateErr;
          console.warn('[GeminiProvider] Solicitud fallida', { status: Number(candidateErr?.status) || null, aborted: request.signal.aborted });
        }
      }

      throw providerError(lastError);
    } catch (error) {
      if (error instanceof AiAgentError) throw error;
      throw providerError(error);
    }
  }
}
