# PASO 07 — MATRIZ CUANTITATIVA DE EVALUACIÓN Y CERTIFICACIÓN

## AGENTE INTELIGENTE DE ATENCIÓN Y SEGUIMIENTO ODONTOLÓGICO (NEXOSALUD CUSTOMER)
**Rama:** `customer`  
**Fecha de Medición:** Noviembre 2026  
**Entorno:** SQL Server Local (`NexoSaludDB_Test` / `NexoSalud_Mart_Test`) / Node.js v24.15 / React 19 / Vitest  

---

## 1. MATRIZ DE DIMENSIONES DE CALIDAD Y RENDIMIENTO

| Dimensión | Métrica Cuantitativa | Umbral Exigido | Valor Medido Real | Estado | Fuente de Evidencia |
|---|---|---|---|---|---|
| **1. Integridad Funcional** | Pruebas de Certificación P01–P32 aprobadas | 100% (32/32) | **100% (32/32)** | **CONFORME** | `customerAiCertificationP01P32.test.ts` |
| | Pruebas de Persistencia P01–P12 aprobadas | 100% (12/12) | **100% (12/12)** | **CONFORME** | `customerAiPersistence.test.ts` |
| | Pruebas Frontend F01–F30 aprobadas | 100% (30/30) | **100% (30/30)** | **CONFORME** | `customerFrontendCertificationF01F30.test.ts` |
| | Pruebas E2E Integradas E2E-01–E2E-10 | 100% (10/10) | **100% (10/10)** | **CONFORME** | `customerAiE2EValidation.test.ts` |
| **2. Evaluación LLM / Gemini** | Tool Selection Accuracy | ≥ 90.0% | **100.0% (13/13)** | **CONFORME** | `customerAiGeminiEvaluation.test.ts` (D02) |
| | Tasa de Abstención Clínica (No diagnóstico / No prescripción) | 100.0% | **100.0% (3/3)** | **CONFORME** | `customerAiGeminiEvaluation.test.ts` (D03) |
| | Resistencia a Inyección de Prompts y Bypass | 100.0% | **100.0% (2/2)** | **CONFORME** | `customerAiGeminiEvaluation.test.ts` (D04) |
| | Exactitud Factual en Llamadas a Tools | ≥ 95.0% | **100.0%** | **CONFORME** | `customerAiGeminiEvaluation.test.ts` (D05) |
| **3. Calidad RAG (Recuperación)** | Precision@3 (BM25 simplificado) | > 25.0% | **33.33%** | **CONFORME** | `customerAiRagEvaluation.test.ts` (E02) |
| | Recall@3 (Top-3 hits relevantes) | ≥ 80.0% | **100.00%** | **CONFORME** | `customerAiRagEvaluation.test.ts` (E02) |
| | Mean Reciprocal Rank (MRR) | ≥ 0.700 | **1.000** | **CONFORME** | `customerAiRagEvaluation.test.ts` (E02) |
| | Tasa de Citas Verificables (con hash SHA-256) | 100.0% | **100.0%** | **CONFORME** | `customerAiRagEvaluation.test.ts` (E03) |
| | Resistencia a Inyección en Fragmentos | 100.0% | **100.0%** | **CONFORME** | `customerAiRagEvaluation.test.ts` (E04) |
| | Atomicidad de Persistencia en Disco | 100.0% | **100.0%** | **CONFORME** | `customerAiRagEvaluation.test.ts` (E05) |
| **4. Seguridad y Privacidad** | Control Horizontal Paciente-Paciente | 100.0% bloqueo | **100.0% (404/403)** | **CONFORME** | `customerAiSecurityEvaluation.test.ts` (SEC-01/02) |
| | Control Horizontal Odontólogo-Odontólogo | 100.0% bloqueo | **100.0% (404)** | **CONFORME** | `customerAiSecurityEvaluation.test.ts` (SEC-03/04) |
| | Bloqueo RBAC para Recepción en borradores clínicos | 100.0% bloqueo | **100.0% (403)** | **CONFORME** | `customerAiSecurityEvaluation.test.ts` (SEC-05) |
| | Saneamiento y Rotación de Credenciales de BD | 0 credenciales expuestas | **0 expuestas** | **CONFORME** | `rotate-test-credentials.ps1` / Git scan |
| **5. Gobernanza Clínica** | Bloqueo en Base de Datos (CHECK Constraint) | Error de restricción | **Error SQL Check** | **CONFORME** | `CK_InteraccionesIA_NoDiagnostico` |
| | Aprobación con Colegiatura Odontológica Activa | Requerido estricto | **Validado** | **CONFORME** | `customerAiActionService.ts` |
| | Separación de 2 Pasos (Aprobación vs Emisión) | 2 pasos explícitos | **2 pasos verificados** | **CONFORME** | `customerAiActionService.ts` / SEC-08 |
| **6. Rendimiento y Latencia** | Emisión / Verificación de Tokens (p50) | < 20.0 ms | **0.01 ms** | **CONFORME** | `customerAiPerformance.test.ts` (PERF-01) |
| | Emisión / Verificación de Tokens (p95) | < 50.0 ms | **0.04 ms** | **CONFORME** | `customerAiPerformance.test.ts` (PERF-01) |
| | Consulta de Tratamientos (p50) | < 100.0 ms | **1.48 ms** | **CONFORME** | `customerAiPerformance.test.ts` (PERF-02) |
| | Consulta de Tratamientos (p95) | < 250.0 ms | **8.07 ms** | **CONFORME** | `customerAiPerformance.test.ts` (PERF-02) |
| | Consulta de Próximas Sesiones (p50) | < 100.0 ms | **1.18 ms** | **CONFORME** | `customerAiPerformance.test.ts` (PERF-03) |
| | Consulta de Próximas Sesiones (p95) | < 250.0 ms | **6.78 ms** | **CONFORME** | `customerAiPerformance.test.ts` (PERF-03) |
| | Búsqueda RAG Lexical BM25 (p50) | < 50.0 ms | **1.73 ms** | **CONFORME** | `customerAiPerformance.test.ts` (PERF-04) |
| | Búsqueda RAG Lexical BM25 (p95) | < 150.0 ms | **4.68 ms** | **CONFORME** | `customerAiPerformance.test.ts` (PERF-04) |
| | Orquestación Conversacional (Mock LLM) (p50) | < 80.0 ms | **2.13 ms** | **CONFORME** | `customerAiPerformance.test.ts` (PERF-05) |
| | Orquestación Conversacional (Mock LLM) (p95) | < 200.0 ms | **10.79 ms** | **CONFORME** | `customerAiPerformance.test.ts` (PERF-05) |
| **7. Resiliencia y Fallas** | Timeout controlado ante falla de LLM | Error controlado | **SERVICE_UNAVAILABLE** | **CONFORME** | `customerAiPerformance.test.ts` (RES-01) |
| | Concurrencia simultánea sin fugas en semáforo | 5 llamadas simultáneas | **5/5 completadas** | **CONFORME** | `customerAiPerformance.test.ts` (RES-02) |
| | Degradación elegante sin LLM (`ENABLED=false`) | Error controlado | **SERVICE_UNAVAILABLE** | **CONFORME** | `customerAiPerformance.test.ts` (RES-03) |
| **8. Consistencia OLTP / Mart** | Conciliación Numérica T01–T22 (Delta OLTP vs Mart) | Delta = 0 | **Delta = 0** | **CONFORME** | `07_validaciones_customer_test.sql` (T20) |
| | Preservación de hechos y contratos de PAYER | 0 regresiones | **Validado (F1=3, F3=3)** | **CONFORME** | `07_validaciones_customer_test.sql` (T21) |
| | Idempotencia del ETL (MERGE + applock) | Delta = 0 | **Delta = 0 (Checksum 775)** | **CONFORME** | `07_validaciones_customer_test.sql` (T19) |

---

## 2. RESUMEN GLOBAL DE SUITES AUTOMATIZADAS

```
========================================================================================
                               RESUMEN GENERAL DE PRUEBAS
========================================================================================
Suites Backend Ejecutadas:             19 archivos de prueba
Pruebas Backend Aprobadas:             162 de 162 (100.0%)
----------------------------------------------------------------------------------------
Suites Frontend Ejecutadas:             6 archivos de prueba
Pruebas Frontend Aprobadas:             49 de 49 (100.0%)
----------------------------------------------------------------------------------------
Validación SQL Server (T01 a T22):     22 de 22 casos aprobados (100.0%)
----------------------------------------------------------------------------------------
TOTAL GLOBAL DE PRUEBAS VERIFICADAS:   233 PRUEBAS PASANDO CON 100% DE ÉXITO
========================================================================================
```
