import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent }; } }));
import { GeminiProvider } from '../src/modules/customer/ai-agent/llm/geminiProvider';
const input = { model: 'configured-model', input: [], instructions: 'Prueba', tools: [], maxOutputTokens: 128, timeoutMs: 1000, signal: new AbortController().signal };
beforeEach(() => { vi.stubEnv('AI_AGENT_ALLOW_REAL_GEMINI', 'true'); generateContent.mockReset(); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe('Gemini provider diagnosis', () => {
  it.each([[400, 'parámetros'], [401, 'autenticación'], [403, 'permisos'], [404, 'modelo'], [429, 'cuota'], [500, 'temporal'], [503, 'sobrecargado'], [504, 'tiempo']])('categoriza %i sin revelar secretos ni cambiar de modelo', async (status, word) => {
    generateContent.mockRejectedValue({ status, message: 'SECRET_KEY patient-private-data' });
    const error = await new GeminiProvider('synthetic-key').complete(input).catch(e => e);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(error.message.toLowerCase()).toContain(word);
    expect(error.message).not.toContain('SECRET_KEY');
    expect(error.message).not.toContain('patient-private-data');
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0][0].model).toBe('configured-model');
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('SECRET_KEY');
  });
  it('conserva la causa de respuesta vacía', async () => {
    generateContent.mockResolvedValue({ text: '' });
    await expect(new GeminiProvider('synthetic-key').complete(input)).rejects.toThrow('respuesta vacía');
  });
  it('devuelve respuestas válidas', async () => {
    generateContent.mockResolvedValue({ text: 'Hola' });
    await expect(new GeminiProvider('synthetic-key').complete(input)).resolves.toEqual({ kind: 'message', text: 'Hola' });
  });
  it.each([[], [{ slotId: 9, date: '2099-01-01T15:00:00Z' }], null, 'ok', 3, false])('envuelve resultados no objeto sin perder su contenido: %j', async (result) => {
    generateContent.mockResolvedValue({ text: 'Horarios consultados' });
    await new GeminiProvider('synthetic-key').complete({ ...input, input: [
      { role: 'user', content: 'Consulta horarios' },
      { type: 'function_call', name: 'getCustomerSchedulingSlots', call_id: 'call-1', arguments: '{}', thoughtSignature: 'signature' },
      { type: 'function_call_output', name: 'getCustomerSchedulingSlots', call_id: 'call-1', output: JSON.stringify(result) }
    ] });
    const contents = generateContent.mock.calls[0][0].contents;
    expect(contents[1].parts[0].thoughtSignature).toBe('signature');
    expect(contents[2].parts[0].functionResponse).toEqual({ name: 'getCustomerSchedulingSlots', id: 'call-1', response: { result } });
  });
  it('preserva objetos de las herramientas sin agregar envolturas', async () => {
    generateContent.mockResolvedValue({ text: 'Progreso consultado' });
    const result = { success: true, data: { completedSessions: 1 } };
    await new GeminiProvider('synthetic-key').complete({ ...input, input: [{ type: 'function_call_output', name: 'getTreatmentProgress', call_id: 'call-2', output: JSON.stringify(result) }] });
    expect(generateContent.mock.calls[0][0].contents[0].parts[0].functionResponse.response).toEqual(result);
  });

  it('omite declaraciones de herramientas vacías al organizar notas sin herramientas', async () => {
    generateContent.mockResolvedValue({ text: '{"observaciones":"Nota sintética"}' });
    await new GeminiProvider('synthetic-key').complete(input);
    expect(generateContent.mock.calls[0][0].config.tools).toBeUndefined();
  });

});
