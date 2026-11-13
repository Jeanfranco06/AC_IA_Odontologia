import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/db', () => ({ prisma: {} }));
import { CustomerAiOrchestrator } from '../src/modules/customer/ai-agent/llm/orchestrator';
import { CustomerAiPersistenceService as P } from '../src/services/customerAiPersistenceService';
import { durableKnowledgeService as kb } from '../src/modules/customer/knowledge-base/durableKnowledgeService';
import { AiAgentError } from '../src/modules/customer/ai-agent/types';
const patient = { role: 'PACIENTE' as const, idPersona: 10 };
const reference = { documentCode: 'SYN-IA05', title: 'Documento sintético', version: 1, section: 'Horario', chunkId: 'chunk-1' };
function provider(text = 'El horario de prueba es de 9:00 a 17:00.') {
  return { complete: vi.fn().mockResolvedValueOnce({ kind: 'tool_call', name: 'searchApprovedKnowledge', callId: 'c1', arguments: '{"query":"horarios de atención"}' }).mockResolvedValueOnce({ kind: 'message', text }) };
}
beforeEach(() => {
  vi.stubEnv('AI_AGENT_LLM_ENABLED', 'true'); vi.stubEnv('AI_AGENT_LLM_PROVIDER', 'gemini'); vi.stubEnv('AI_AGENT_EXTERNAL_DATA_AUTHORIZED', 'true');
  vi.spyOn(P, 'registrarInteraccion').mockResolvedValue({} as any);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe('IA05: orientación general con evidencia', () => {
  it('incluye la fuente exacta incluso si el proveedor omite la cita', async () => {
    vi.spyOn(kb, 'search').mockResolvedValue({ sufficientEvidence: true, results: [{ reference, excerpt: 'Horario sintético: 9:00 a 17:00.', score: 1 }] } as any);
    vi.spyOn(kb, 'getReference').mockReturnValue(reference);
    const result = await new CustomerAiOrchestrator(() => provider()).answer(patient, '¿Cuál es el horario de atención?');
    expect(result.message).toContain('[Documento: SYN-IA05 v1, Sección: Horario]');
    expect(result.limitations[0]).toContain('contenidos institucionales');
  });
  it('una búsqueda sin evidencia impide que el modelo invente la respuesta', async () => {
    vi.spyOn(kb, 'search').mockResolvedValue({ sufficientEvidence: false, results: [], limitation: 'NO_AUTHORIZED_EVIDENCE' });
    const fake = provider('Horario inventado: atención las 24 horas; llamar al teléfono inventado.');
    const result = await new CustomerAiOrchestrator(() => fake).answer(patient, '¿Cuál es el horario de atención?');
    expect(result.message).toContain('No encontré información institucional');
    expect(result.message).not.toContain('24 horas');
    expect(fake.complete).toHaveBeenCalledTimes(1);
    expect(result.limitations.join(' ')).toContain('No se ha registrado una derivación');
  });
  it('corpus deshabilitado se comunica sin fingir una búsqueda vacía ni devolver un 503 genérico', async () => {
    vi.spyOn(kb, 'search').mockRejectedValue(new AiAgentError('SERVICE_UNAVAILABLE', 'Recuperación no habilitada'));
    const fake = provider();
    const result = await new CustomerAiOrchestrator(() => fake).answer(patient, '¿Cuál es el horario de atención?');
    expect(result.message).toContain('No pude consultar');
    expect(result.message).toContain('Solicitar revisión humana');
    expect(fake.complete).toHaveBeenCalledTimes(1);
  });
  it('rechaza citas falsas y fuentes revocadas', async () => {
    vi.spyOn(kb, 'search').mockResolvedValue({ sufficientEvidence: true, results: [{ reference, excerpt: 'Horario sintético', score: 1 }] } as any);
    const verify = vi.spyOn(kb, 'getReference').mockReturnValue(reference);
    await expect(new CustomerAiOrchestrator(() => provider('[Documento: INVENTADO v1, Sección: X]')).answer(patient, 'Horario')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    verify.mockReturnValue(undefined);
    await expect(new CustomerAiOrchestrator(() => provider()).answer(patient, 'Horario')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });
});
