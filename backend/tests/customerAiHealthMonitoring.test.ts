// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRoutes from '../src/modules/customer/ai-agent/monitoring/healthRoutes';
import { metricsCollector } from '../src/modules/customer/ai-agent/monitoring/metricsCollector';

describe('FASE E / I: HEALTH CHECKS, OBSERVABILIDAD Y TELEMETRIA', () => {
  const app = express();
  app.use(express.json());
  app.use('/health', healthRoutes);
  app.use('/metrics', healthRoutes);

  it('HLT-01: Liveness probe responde 200 OK de inmediato sin dependencias externas', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.timestamp).toBeDefined();
  });

  it('HLT-02: Readiness probe valida estado de SQL Server y motor RAG local', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY');
    expect(res.body.checks.database).toBe('HEALTHY');
    expect(res.body.checks.ragEngine).toBe('HEALTHY');
    expect(res.body.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('HLT-03: Diagnóstico administrativo expone telemetría segura sin fugar secretos', async () => {
    const res = await request(app).get('/health/diag');
    expect(res.status).toBe(200);
    expect(res.body.environment).toBeDefined();
    expect(res.body.agentVersion).toBe('CUSTOMER-ACTIONS-v2');
    expect(res.body.ragVersion).toBe('RAG-DURABLE-v1');
    expect(res.body.memoryMb.rss).toBeGreaterThan(0);
    expect(res.body.llmConfig).toBeDefined();

    // Verificación de no-fuga de credenciales o URLs de conexión
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain('password');
    expect(jsonStr).not.toContain('CustTest_');
    expect(jsonStr).not.toContain('sqlserver://');
  });

  it('HLT-04: Endpoint de métricas técnicas cuantifica solicitudes, latencias y llamadas a tools', async () => {
    // Registrar métricas simuladas
    metricsCollector.recordRequest(200, 15.2);
    metricsCollector.recordRequest(200, 22.8);
    metricsCollector.recordToolExecution('getPatientTreatments');
    metricsCollector.recordLlmCall(true);
    metricsCollector.recordRagSearch();

    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body.requestsTotal).toBeGreaterThanOrEqual(2);
    expect(res.body.toolExecutionsTotal).toBeGreaterThanOrEqual(1);
    expect(res.body.llmCallsTotal).toBeGreaterThanOrEqual(1);
    expect(res.body.ragSearchesTotal).toBeGreaterThanOrEqual(1);
    expect(res.body.averageLatencyMs).toBeGreaterThanOrEqual(0);
  });
});
