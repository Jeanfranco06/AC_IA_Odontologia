import { Router, Request, Response } from 'express';
import { prisma } from '../../../../db';
import { durableKnowledgeService } from '../../knowledge-base/durableKnowledgeService';
import { metricsCollector } from './metricsCollector';
import { runtimeConfig } from '../llm/provider';

const router = Router();

// Liveness: indica si el proceso Express está levantado
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// Readiness: verifica dependencias críticas (Base de datos OLTP y RAG)
router.get('/ready', async (_req: Request, res: Response) => {
  const start = performance.now();
  let dbOk = false;
  let dbError: string | null = null;

  try {
    const rawResult: unknown = await prisma.$queryRaw`SELECT 1 as ok`;
    dbOk = Array.isArray(rawResult) && rawResult.length > 0;
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'Database ping failed';
  }

  const ragDocs = durableKnowledgeService.listDocuments({ role: 'ADMIN', idUsuario: 1 });
  const ragOk = Array.isArray(ragDocs);

  const durationMs = Number((performance.now() - start).toFixed(2));

  if (!dbOk || !ragOk) {
    metricsCollector.recordRequest(503, durationMs);
    return res.status(503).json({
      status: 'DOWN',
      checks: {
        database: dbOk ? 'HEALTHY' : 'UNHEALTHY',
        ragEngine: ragOk ? 'HEALTHY' : 'UNHEALTHY'
      },
      durationMs,
      timestamp: new Date().toISOString()
    });
  }

  metricsCollector.recordRequest(200, durationMs);
  return res.status(200).json({
    status: 'READY',
    checks: {
      database: 'HEALTHY',
      ragEngine: 'HEALTHY'
    },
    durationMs,
    timestamp: new Date().toISOString()
  });
});

// Diagnóstico administrativo: telemetría operativa para preproducción / staging
router.get('/diag', async (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const config = runtimeConfig();

  let activeAlerts = 0;
  try {
    activeAlerts = await prisma.alertasIA.count({ where: { estado: { in: ['Generada', 'En_Revision'] } } });
  } catch {}

  const summary = metricsCollector.getSummary();
  summary.activeAlertsCount = activeAlerts;

  res.status(200).json({
    environment: process.env.NODE_ENV || 'staging',
    version: '1.0.0-customer-p08',
    agentVersion: 'CUSTOMER-ACTIONS-v2',
    ragVersion: 'RAG-DURABLE-v1',
    uptimeSeconds: summary.uptimeSeconds,
    memoryMb: {
      rss: Number((mem.rss / 1024 / 1024).toFixed(1)),
      heapUsed: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
      heapTotal: Number((mem.heapTotal / 1024 / 1024).toFixed(1))
    },
    llmConfig: {
      enabled: config.enabled,
      provider: config.provider,
      model: config.model,
      externalDataAuthorized: config.externalDataAuthorized,
      maxIterations: config.maxIterations,
      timeoutMs: config.timeoutMs
    },
    metrics: summary,
    timestamp: new Date().toISOString()
  });
});

// Endpoint de métricas en formato JSON (disponible en /metrics o /health/metrics)
router.get(['/metrics', '/'], (_req: Request, res: Response) => {
  res.status(200).json(metricsCollector.getSummary());
});

export default router;
