# PASO 9 — RESULTADOS Y EVIDENCIAS DE LAS PRUEBAS FINALES DE REGRESIÓN
## AGENTE INTELIGENTE CUSTOMER — NEXOSALUD

**Documento:** Reporte Integral de Pruebas Automatizadas y de Regresión  
**Fecha de Ejecución:** 2026-11-11  
**Entorno de Ejecución:** Windows 11 / Node.js v20+ / SQL Server 2022  
**Framework de Pruebas:** Vitest v2.1.9 (Backend) & Vitest v5.1.0 (Frontend)  

---

## 1. RESUMEN GLOBAL DE RESULTADOS

| Nivel de Evaluación | Total Suites | Suites Aprobadas | Total Pruebas | Pruebas Aprobadas | Pruebas Falladas | Tasa de Éxito | Duración Total |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Backend (Node/TS/Vitest)** | 21 | 21 | 180 | 180 | 0 | **100.0%** | 9.88 s |
| **Frontend (React/Vite/Vitest)**| 6 | 6 | 49 | 49 | 0 | **100.0%** | 1.89 s |
| **Compilación Backend (tsc)** | 1 | 1 | N/A | Exitosa | 0 | **100.0%** | ~1.5 s |
| **Compilación Frontend (Vite)** | 1 | 1 | N/A | Exitosa | 0 | **100.0%** | 1.41 s |
| **TOTAL CONSOLIDADO** | **29** | **29** | **229** | **229** | **0** | **100.0%** | **~14.7 s** |

---

## 2. DESGLOSE DETALLADO DE SUITES DE PRUEBA EN BACKEND

| Suite de Prueba | Pruebas | Estado | Ámbito de Validación |
| :--- | :---: | :---: | :--- |
| `tests/customerAiCertificationP01P32.test.ts` | 32 | APROBADO | Matriz de certificación integral P01 a P32 de infraestructura, queries y orquestación. |
| `tests/customerKnowledgeBaseCertificationP01P32.test.ts` | 32 | APROBADO | Matriz de base de conocimiento RAG, persistencia en disco, indexación BM25 y ACL. |
| `tests/customerAiPilotFunctional.test.ts` | 14 | APROBADO | Piloto funcional controlado: escenarios PIL-01 a PIL-14 de extremo a extremo. |
| `tests/customerAiPersistence.test.ts` | 12 | APROBADO | Persistencia transaccional de interacciones, deduplicación de alertas y borradores. |
| `tests/customerAiE2EValidation.test.ts` | 10 | APROBADO | Flujos E2E de paciente y odontólogo, autenticación y confirmaciones HMAC. |
| `tests/customerAiOrchestrator.test.ts` | 10 | APROBADO | Selección de tools con function calling, system instructions y barreras de abstención. |
| `tests/customerKnowledgeBase.test.ts` | 11 | APROBADO | Operaciones del motor BM25, cálculo de scores de relevancia y stopwords. |
| `tests/customerAiPerformance.test.ts` | 8 | APROBADO | Benchmarks de latencia p50/p95 y resiliencia ante caídas simuladas de Gemini. |
| `tests/customerAiSecurityEvaluation.test.ts` | 8 | APROBADO | Seguridad perimetral, tokens HMAC, restricciones CHECK anti-diagnóstico en BD. |
| `tests/customerAiAgentHttp.test.ts` | 6 | APROBADO | Endpoints HTTP del agente, manejo de headers de autenticación y códigos de error. |
| `tests/customerAiGeminiEvaluation.test.ts` | 5 | APROBADO | Evaluación del proveedor Gemini con prompts clínicos y no clínicos. |
| `tests/customerAiRagEvaluation.test.ts` | 5 | APROBADO | Métricas cuantitativas de recuperación RAG (Precision@3, Recall@3, MRR). |
| `tests/customerAiHealthMonitoring.test.ts` | 4 | APROBADO | Endpoints de observabilidad: `/health/live`, `/health/ready`, `/health/diag`, `/metrics`. |
| `tests/customerAiActions.test.ts` | 4 | APROBADO | Acciones supervisadas: reprogramación, revisión de alertas y aprobación humana. |
| `tests/customerAiAgentSecurity.test.ts` | 3 | APROBADO | Aislamiento horizontal de recursos entre pacientes y profesionales de salud. |
| `tests/buyerDurationMatrix.test.ts` | 4 | APROBADO | **No regresión BUYER:** Matriz de duraciones y SLAs comerciales. |
| `tests/buyerDurationRoute.test.ts` | 1 | APROBADO | **No regresión BUYER:** Endpoint de cálculo de duraciones. |
| `tests/buyerCampaignMatrix.test.ts` | 5 | APROBADO | **No regresión BUYER:** Asignación de campañas y canales de captación. |
| `tests/matrixUnknowns.test.ts` | 2 | APROBADO | Manejo de casos de borde y parámetros nulos en matrices analíticas. |
| `tests/martSyncService.test.ts` | 2 | APROBADO | Servicio de sincronización transaccional al Data Mart. |
| `tests/dunningScheduler.test.ts` | 2 | APROBADO | **No regresión PAYER:** Programador de cobros y notificaciones de pago. |

---

## 3. DESGLOSE DETALLADO DE SUITES DE PRUEBA EN FRONTEND

| Suite de Prueba | Pruebas | Estado | Ámbito de Validación |
| :--- | :---: | :---: | :--- |
| `customerFrontendCertificationF01F30.test.ts` | 30 | APROBADO | Matriz de certificación F01 a F30 de componentes React, accesibilidad y roles. |
| `customerAiAgentApi.test.ts` | 3 | APROBADO | Cliente API de frontend para consumo de endpoints del agente CUSTOMER. |
| `reports.test.ts` | 5 | APROBADO | Generación y formato de reportes visuales de Inteligencia de Negocios. |
| `paymentDocument.test.ts` | 5 | APROBADO | **No regresión PAYER:** Generación de recibos y constancias PDF de pago. |
| `PaymentNoticePdfModal.test.tsx` | 3 | APROBADO | **No regresión PAYER:** Modal de previsualización de avisos y órdenes de pago. |
| `groqService.test.ts` | 3 | APROBADO | Servicio auxiliar de traducción/procesamiento secundario. |

---

## 4. COMANDOS PARA REPRODUCIR LA EVALUACIÓN

Para reproducir localmente la totalidad de las pruebas en preproducción:

```powershell
# 1. Compilación de Backend
npm run build --prefix backend

# 2. Compilación de Frontend
npm run build --prefix frontend

# 3. Ejecución de toda la suite de pruebas Backend
npm test --prefix backend

# 4. Ejecución de toda la suite de pruebas Frontend
npm test --prefix frontend
```
