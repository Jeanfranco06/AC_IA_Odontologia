# PASO 9 — INVENTARIO FINAL DE ARCHIVOS Y ARTEFACTOS DEL PROYECTO
## AGENTE INTELIGENTE CUSTOMER — NEXOSALUD

**Documento:** Inventario Exhaustivo de Artefactos de Código, Datos, Pruebas y Documentación  
**Rama de Trabajo:** `customer`  
**Fecha de Publicación:** 2026-11-11  

---

## 1. COMPONENTES BACKEND (NODE.JS / EXPRESS / TYPESCRIPT)

- **Núcleo y Rutas Principales:**
  - `backend/src/index.ts`: Punto de entrada de la aplicación, configuración de middlewares y registro de routers.
  - `backend/src/modules/customer/ai-agent/routes.ts`: Router REST con endpoints autenticados del agente CUSTOMER.
  - `backend/src/modules/customer/ai-agent/monitoring/healthRoutes.ts`: Endpoints `/health/live`, `/health/ready`, `/health/diag` y `/metrics`.
  - `backend/src/modules/customer/ai-agent/monitoring/metricsCollector.ts`: Recolector en memoria de percentiles p50/p95 y métricas técnicas.
- **Orquestador LLM & Gemini:**
  - `backend/src/modules/customer/ai-agent/llm/orchestrator.ts`: Orquestador conversacional, gestión de function calling y resiliencia/fallback.
  - `backend/src/modules/customer/ai-agent/llm/toolRegistry.ts`: Definición de las 11 herramientas tipadas con JSON Schema.
  - `backend/src/modules/customer/ai-agent/llm/systemInstructions.ts`: Prompts del sistema con barreras éticas y reglas de abstención clínica.
  - `backend/src/modules/customer/ai-agent/llm/geminiProvider.ts`: Cliente de integración con Google AI Studio (Gemini 2.5 Flash).
- **Servicios de Negocio y Acciones Supervisadas:**
  - `backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts`: Consultas de solo lectura para paciente y personal clínico.
  - `backend/src/modules/customer/ai-agent/services/customerAiActionService.ts`: Acciones supervisadas transaccionales (reprogramaciones, alertas, borradores).
  - `backend/src/modules/customer/ai-agent/services/customerAiPersistenceService.ts`: Persistencia atómica de interacciones, alertas y borradores.
  - `backend/src/modules/customer/ai-agent/services/customerSchedulingService.ts`: Lógica de integración de agenda y slots de disponibilidad.
- **Motor de Conocimiento Documental (RAG):**
  - `backend/src/modules/customer/knowledge-base/durableKnowledgeService.ts`: Servicio RAG con persistencia en disco, control ACL y versionado.
  - `backend/src/modules/customer/knowledge-base/lexicalBM25Engine.ts`: Motor de indexación lexical y scoring BM25.

---

## 2. COMPONENTES FRONTEND (REACT / TYPESCRIPT / VITE)

- **Páginas y Vistas Principales:**
  - `frontend/src/modules/customer/pages/CustomerPatientPortalPage.tsx`: Portal interactivo de autogestión para el paciente.
  - `frontend/src/modules/customer/pages/CustomerAiStaffWorkspacePage.tsx`: Espacio clínico integral para odontólogo y recepción.
- **Servicios y Clientes API:**
  - `frontend/src/modules/customer/services/customerAiAgentApi.ts`: Cliente HTTP para el consumo de los endpoints del backend.
  - `frontend/src/shared/services/patientAuthService.ts`: Servicio de autenticación y manejo de sesión del paciente.
  - `frontend/src/shared/services/staffAuthService.ts`: Servicio de autenticación y manejo de sesión del personal clínico.
- **Enrutamiento y Navegación:**
  - `frontend/src/app/router/index.tsx`: Definición de rutas protegidas para portal de paciente y workspace clínico.
  - `frontend/src/shared/components/layout/navigationConfig.ts`: Menús y enlaces de navegación del sistema.

---

## 3. SCRIPTS DE DEVOPS, DESPLIEGUE Y AUTOMATIZACIÓN

- `backend/scripts/deploy-staging.ps1`: Script reproducible de compilación, verificación de variables y despliegue en staging.
- `backend/scripts/backup-restore-test.ps1`: Script de respaldo completo y restauración verificada hacia una base aislada de prueba.
- `backend/scripts/safe-rollback.ps1`: Procedimiento quirúrgico de detención de procesos por puerto y reversión segura de código/BD.
- `backend/scripts/seed-customer-ai-test-data.sql`: Script SQL para poblar datos sintéticos de paciente, odontólogo y citas.

---

## 4. SUITES DE PRUEBAS AUTOMATIZADAS (29 SUITES / 229 TESTS)

- **Backend (21 suites / 180 tests):**
  - `backend/tests/customerAiCertificationP01P32.test.ts`
  - `backend/tests/customerKnowledgeBaseCertificationP01P32.test.ts`
  - `backend/tests/customerAiPilotFunctional.test.ts`
  - `backend/tests/customerAiPersistence.test.ts`
  - `backend/tests/customerAiE2EValidation.test.ts`
  - `backend/tests/customerAiOrchestrator.test.ts`
  - `backend/tests/customerKnowledgeBase.test.ts`
  - `backend/tests/customerAiPerformance.test.ts`
  - `backend/tests/customerAiSecurityEvaluation.test.ts`
  - `backend/tests/customerAiAgentHttp.test.ts`
  - `backend/tests/customerAiGeminiEvaluation.test.ts`
  - `backend/tests/customerAiRagEvaluation.test.ts`
  - `backend/tests/customerAiHealthMonitoring.test.ts`
  - `backend/tests/customerAiActions.test.ts`
  - `backend/tests/customerAiAgentSecurity.test.ts`
  - `backend/tests/buyerDurationMatrix.test.ts`
  - `backend/tests/buyerDurationRoute.test.ts`
  - `backend/tests/buyerCampaignMatrix.test.ts`
  - `backend/tests/matrixUnknowns.test.ts`
  - `backend/tests/martSyncService.test.ts`
  - `backend/tests/dunningScheduler.test.ts`
- **Frontend (6 suites / 49 tests):**
  - `frontend/src/modules/customer/services/customerFrontendCertificationF01F30.test.ts`
  - `frontend/src/modules/customer/services/customerAiAgentApi.test.ts`
  - `frontend/src/modules/reports/lib/reports.test.ts`
  - `frontend/src/shared/pdf/paymentDocument.test.ts`
  - `frontend/src/modules/payer/components/PaymentNoticePdfModal.test.tsx`
  - `frontend/src/shared/services/groqService.test.ts`

---

## 5. DOCUMENTACIÓN TÉCNICA OFICIAL (`docs/customer/ai-agent/`)

- `PASO_01_INFRAESTRUCTURA.md`: Arquitectura base y modelo de datos.
- `PASO_02_BACKEND_HERRAMIENTAS.md`: Catálogo y seguridad de tools.
- `PASO_03_LLM_ORQUESTACION.md`: Orquestación Gemini y function calling.
- `PASO_04_ACCIONES_SUPERVISADAS.md`: Reprogramación, alertas y borradores.
- `PASO_04_1_CERTIFICACION_INTEGRAL.md`: Certificación integral P01-P32.
- `PASO_05_RAG_CONOCIMIENTO.md`: Sistema de conocimiento RAG BM25.
- `PASO_06_FRONTEND_INTEGRACION.md`: Interfaces React y componentes de usuario.
- `PASO_07_EVALUACION_INTEGRAL.md`: Informe exhaustivo de auditoría QA.
- `PASO_07_MATRIZ_EVALUACION.md`: Matriz de resultados de evaluación integral.
- `PASO_07_HALLAZGOS_Y_CORRECCIONES.md`: Registro de remediaciones técnicas.
- `PASO_08_PREPRODUCCION_PILOTO.md`: Informe técnico de preproducción.
- `PASO_08_MATRIZ_PILOTO.md`: Matriz de los 14 escenarios PIL-01 a PIL-14.
- `PASO_08_PLAN_DESPLIEGUE_ROLLBACK.md`: Plan de contingencia y rollback.
- `PASO_08_MONITOREO_Y_METRICAS.md`: Especificación de salud y telemetría.
- `PASO_08_GUIA_OPERATIVA.md`: Manual operativo por perfil institucional.
- `PASO_09_CIERRE_DEFINITIVO.md`: Informe maestro de cierre final.
- `PASO_09_MATRIZ_TRAZABILIDAD.md`: Matriz de trazabilidad de requisitos.
- `PASO_09_ARQUITECTURA_FINAL.md`: Arquitectura final y diagramas de secuencia.
- `PASO_09_VALIDACION_OLTP_DATAMART.md`: Conciliación analítica Delta = 0.
- `PASO_09_RESULTADOS_PRUEBAS.md`: Resultados consolidados de 229 pruebas.
- `PASO_09_SEGURIDAD_Y_RIESGOS.md`: Evaluación de riesgos residuales.
- `PASO_09_DEMOSTRACION_ACADEMICA.md`: Guion y protocolo de exposición docente.
- `PASO_09_GUIA_ENTREGA.md`: Instrucciones de puesta en marcha del proyecto.
- `PASO_09_INVENTARIO_ARCHIVOS.md`: Inventario de artefactos (el presente archivo).
