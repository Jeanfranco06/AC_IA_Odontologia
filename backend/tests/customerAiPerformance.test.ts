// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/db';
import { CustomerAiQueryService } from '../src/modules/customer/ai-agent/services/customerAiQueryService';
import { durableKnowledgeService } from '../src/modules/customer/knowledge-base/durableKnowledgeService';
import { CustomerAiOrchestrator } from '../src/modules/customer/ai-agent/llm/orchestrator';
import { issueAiAgentToken, verifyAiAgentToken } from '../src/modules/customer/ai-agent/authContext';
import { AiAgentPrincipal } from '../src/modules/customer/ai-agent/types';

describe('FASE H: RENDIMIENTO Y RESILIENCIA DEL SISTEMA CUSTOMER AI', () => {
  let principalPaciente: AiAgentPrincipal;

  beforeAll(async () => {
    process.env.AI_AGENT_SESSION_SECRET = 'performance-evaluation-secret-2026';
    process.env.AI_AGENT_LLM_ENABLED = 'true';
    process.env.AI_AGENT_PROVIDER = 'gemini';
    process.env.AI_AGENT_EXTERNAL_DATA_AUTHORIZED = 'true';

    const p = await prisma.personas.findFirstOrThrow({ where: { dni: '99000001' } });
    principalPaciente = { role: 'PACIENTE', idPersona: p.id_persona };
  });

  // Helper para calcular p50 y p95 a partir de muestras de latencia
  function computePercentiles(latencies: number[]) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    return { p50, p95, avg };
  }

  it('PERF-01: Benchmark de latencia para Autenticación / Emisión de Tokens (p50 < 20ms, p95 < 50ms)', () => {
    const iterations = 50;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const token = issueAiAgentToken(principalPaciente);
      const verified = verifyAiAgentToken(token);
      latencies.push(performance.now() - start);
      expect(verified.role).toBe('PACIENTE');
    }

    const { p50, p95, avg } = computePercentiles(latencies);
    console.log(`[PERF TOKEN] p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms, avg: ${avg.toFixed(2)}ms`);

    expect(p50).toBeLessThan(20);
    expect(p95).toBeLessThan(50);
  });

  it('PERF-02: Benchmark de latencia para Consulta de Tratamientos (p50 < 100ms, p95 < 250ms)', async () => {
    const iterations = 20;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const res = await CustomerAiQueryService.getPatientTreatments(principalPaciente, { audit: false });
      latencies.push(performance.now() - start);
      expect(res.success).toBe(true);
    }

    const { p50, p95, avg } = computePercentiles(latencies);
    console.log(`[PERF TREATMENTS] p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms, avg: ${avg.toFixed(2)}ms`);

    expect(p50).toBeLessThan(100);
    expect(p95).toBeLessThan(250);
  });

  it('PERF-03: Benchmark de latencia para Consulta de Próximas Sesiones (p50 < 100ms, p95 < 250ms)', async () => {
    const iterations = 20;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const res = await CustomerAiQueryService.getUpcomingSessions(principalPaciente, { audit: false });
      latencies.push(performance.now() - start);
      expect(res.success).toBe(true);
    }

    const { p50, p95, avg } = computePercentiles(latencies);
    console.log(`[PERF SESSIONS] p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms, avg: ${avg.toFixed(2)}ms`);

    expect(p50).toBeLessThan(100);
    expect(p95).toBeLessThan(250);
  });

  it('PERF-04: Benchmark de latencia para Búsqueda RAG Lexical BM25 (p50 < 50ms, p95 < 150ms)', async () => {
    const iterations = 20;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const res = await durableKnowledgeService.search(principalPaciente, 'cuidado cepillado profilaxis dental higiene', { limit: 3 });
      latencies.push(performance.now() - start);
      expect(res).toBeDefined();
    }

    const { p50, p95, avg } = computePercentiles(latencies);
    console.log(`[PERF RAG SEARCH] p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms, avg: ${avg.toFixed(2)}ms`);

    expect(p50).toBeLessThan(50);
    expect(p95).toBeLessThan(150);
  });

  it('PERF-05: Benchmark de latencia para Orquestación Conversacional con LLM Simulado (p50 < 80ms, p95 < 200ms)', async () => {
    const iterations = 15;
    const latencies: number[] = [];

    const simulatedProvider = {
      complete: async () => ({
        kind: 'message' as const,
        text: 'Respuesta sintética de evaluación de latencia sin bloqueo.'
      })
    };

    const orchestrator = new CustomerAiOrchestrator(() => simulatedProvider);

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const res = await orchestrator.answer(principalPaciente, '¿Cómo agendo una cita?');
      latencies.push(performance.now() - start);
      expect(res.message).toBeDefined();
    }

    const { p50, p95, avg } = computePercentiles(latencies);
    console.log(`[PERF ORCHESTRATOR] p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms, avg: ${avg.toFixed(2)}ms`);

    expect(p50).toBeLessThan(80);
    expect(p95).toBeLessThan(200);
  });

  // Resiliencia
  it('RES-01: Resiliencia ante caída del proveedor LLM (timeout controlado y degradación elegante)', async () => {
    // Proveedor que simula un timeout infinito
    const hangingProvider = {
      complete: async ({ signal }: { signal: AbortSignal }) => {
        return new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('AbortError'));
          });
        });
      }
    };

    // Configuramos timeout mínimo para la prueba (1000ms)
    process.env.AI_AGENT_TIMEOUT_MS = '1000';

    const orchestrator = new CustomerAiOrchestrator(() => hangingProvider);

    await expect(
      orchestrator.answer(principalPaciente, '¿Qué debo hacer tras mi endodoncia?')
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });

    delete process.env.AI_AGENT_TIMEOUT_MS;
  }, 10000);

  it('RES-02: Resiliencia ante concurrencia simultánea sin fugas en semáforo', async () => {
    const simulatedProvider = {
      complete: async () => {
        await new Promise(r => setTimeout(r, 20));
        return { kind: 'message' as const, text: 'Respuesta concurrente exitosa.' };
      }
    };

    const orchestrator = new CustomerAiOrchestrator(() => simulatedProvider);

    // 5 peticiones en paralelo
    const promises = Array.from({ length: 5 }, (_, i) =>
      orchestrator.answer(principalPaciente, `Consulta concurrente #${i + 1}`)
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(5);
    expect(results.every(r => r.message.includes('exitosa'))).toBe(true);
  });

  it('RES-03: Degradación elegante con Gemini desactivado (AI_AGENT_LLM_ENABLED=false)', async () => {
    process.env.AI_AGENT_LLM_ENABLED = 'false';

    const orchestrator = new CustomerAiOrchestrator();

    await expect(
      orchestrator.answer(principalPaciente, 'Hola')
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });

    process.env.AI_AGENT_LLM_ENABLED = 'true';
  });
});
