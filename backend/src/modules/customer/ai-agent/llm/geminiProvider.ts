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
        if (item.type === 'function_call_output') return { role: 'user', parts: [{ functionResponse: { name: String(item.name || ''), response: JSON.parse(String(item.output || '{}')), id: String(item.call_id || '') } }] };
        if (item.type === 'function_call') return { role: 'model', parts: [{ functionCall: { name: String(item.name), args: JSON.parse(String(item.arguments || '{}')), id: String(item.call_id || '') } }] };
        return { role: 'user', parts: [{ text: String(item.content || '') }] };
      });
      const response = await this.client.models.generateContent({
        model: request.model,
        contents,
        config: {
          systemInstruction: request.instructions,
          maxOutputTokens: request.maxOutputTokens,
          abortSignal: request.signal,
          tools: [{ functionDeclarations: request.tools.map(tool => ({ name: tool.name, description: tool.description, parameters: tool.parameters })) }],
          automaticFunctionCalling: { disable: true },
        },
      } as any);
      const functionCall = (response as any).functionCalls?.[0] || (response as any).candidates?.[0]?.content?.parts?.find((part: any) => part.functionCall)?.functionCall;
      if (functionCall) return { kind: 'tool_call', callId: String(functionCall.id || `${functionCall.name}-${Date.now()}`), name: String(functionCall.name), arguments: JSON.stringify(functionCall.args || {}) };
      const text = String((response as any).text || '').trim();
      if (!text) throw new AiAgentError('SERVICE_UNAVAILABLE', 'Gemini devolvió una respuesta vacía.');
      return { kind: 'message', text };
    } catch (error) {
      if (error instanceof AiAgentError) throw error;
      console.error('[Customer AI Agent Gemini provider] request failed');
      throw new AiAgentError('SERVICE_UNAVAILABLE', 'El proveedor Gemini no está disponible en este momento.');
    }
  }
}
