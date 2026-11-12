import { GoogleGenAI } from '@google/genai';
import { AiAgentError } from '../types';
import { LlmProvider, LlmRequest, LlmResult } from './provider';

export class GeminiProvider implements LlmProvider {
  private readonly client: GoogleGenAI;

  constructor(private readonly apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey) throw new AiAgentError('SERVICE_UNAVAILABLE', 'El proveedor Gemini no está configurado.');
    this.client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1beta' } });
  }

  async complete(request: LlmRequest): Promise<LlmResult> {
    try {
      const contents = request.input.map(item => {
        if (item.type === 'function_call_output') {
          return {
            role: 'user',
            parts: [{
              functionResponse: {
                name: String(item.name || ''),
                response: JSON.parse(String(item.output || '{}')),
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

      const candidates = Array.from(new Set([
        request.model,
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.6-flash'
      ]));

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
              tools: [{ functionDeclarations: request.tools.map(tool => ({ name: tool.name, description: tool.description, parameters: tool.parameters })) }],
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
          console.warn(`[GeminiProvider] Model ${modelToTry} failed (${candidateErr?.status || candidateErr?.message || candidateErr}), attempting fallback...`);
        }
      }

      console.error('[Customer AI Agent Gemini provider] all models failed:', lastError);
      throw new AiAgentError('SERVICE_UNAVAILABLE', 'El proveedor Gemini no está disponible en este momento.');
    } catch (error) {
      if (error instanceof AiAgentError) throw error;
      console.error('[Customer AI Agent Gemini provider] request failed:', error);
      throw new AiAgentError('SERVICE_UNAVAILABLE', 'El proveedor Gemini no está disponible en este momento.');
    }
  }
}
