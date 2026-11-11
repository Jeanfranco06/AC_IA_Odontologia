# PASO 07 — REGISTRO DE HALLAZGOS, DEFECTOS Y CORRECCIONES IMPLEMENTADAS

## AGENTE INTELIGENTE DE ATENCIÓN Y SEGUIMIENTO ODONTOLÓGICO: ASISTENCIA AL PACIENTE Y COPILOTO CLÍNICO-DOCUMENTAL
**Rama Git:** `customer`  
**Entorno de Verificación:** `NexoSaludDB_Test` (OLTP) / `NexoSalud_Mart_Test` (Data Mart) / SQL Server Local (Puerto 1433)  
**Fecha:** Noviembre 2026  
**Equipo Auditor:** Equipo Multidisciplinario Senior NexoSalud  

---

## 1. RESUMEN EJECUTIVO DE HALLAZGOS

Durante la auditoría integral y ejecución reproducible del **Paso 7**, se identificaron y subsanaron **5 hallazgos técnicos y de gobernanza**, clasificados según su severidad:

| ID | Clasificación | Dimensión | Descripción Sintética | Estado |
|---|---|---|---|---|
| **H-01** | **CRÍTICO** | Seguridad / Credenciales | Contraseña de SQL Server de pruebas expuesta en texto plano en documentación y código versionado | **CORREGIDO Y AUDITADO** |
| **H-02** | **ALTO** | Gobernanza Clínica | Acoplamiento implícito entre la aprobación técnica del borrador y la emisión documental visible al paciente | **CORREGIDO Y CERTIFICADO** |
| **H-03** | **MEDIO** | Resiliencia / I/O RAG | Escritura de persistencia en disco de la base de conocimiento RAG susceptible a corrupción por no ser atómica | **CORREGIDO Y CERTIFICADO** |
| **H-04** | **MEDIO** | QA / Reproducibilidad | Colisión de ejecución paralela en Vitest y filtrado incompleto de horario en reprogramaciones (P31 / E2E-03) | **CORREGIDO Y CERTIFICADO** |
| **H-05** | **BAJO** | Configuración Test Runner | Configuración de Vite/Vitest en frontend ejecutaba suites de backend en entorno jsdom | **CORREGIDO Y CERTIFICADO** |

---

## 2. DETALLE DE HALLAZGOS Y ACCIONES DE REMEDIACIÓN

### HALLAZGO H-01 (CRÍTICO) — EXPOSICIÓN DE CREDENCIALES DE BASE DE DATOS
* **Gravedad:** CRÍTICO.
* **Componente afectado:** `CIERRE_INTEGRAL_PASOS_01_A_06.md`, `customerAiCertificationP01P32.test.ts`.
* **Condición detectada:** La contraseña del usuario de SQL Server `NexoSaludCustomerTest` (`[CREDENCIAL_HISTORICA_REVOCADA]`) se encontraba documentada en texto plano en el reporte de cierre y como literal en una aserción de prueba.
* **Causa Raíz:** Documentación técnica generada con credenciales explícitas de prueba sin uso estricto de variables de entorno locales ignoradas por git.
* **Impacto Potencial:** Exposición de accesos a la base de datos de pruebas o riesgo de propagación a entornos compartidos.
* **Acción Correctiva Implementada:**
  1. Rotación inmediata en SQL Server mediante sentencia DDL transaccional:
     `ALTER LOGIN [NexoSaludCustomerTest] WITH PASSWORD = N'[ROTATED_TEST_SECRET_REDACTED]';`
  2. Almacenamiento seguro y aislado en `backend/.env.test.local` (ignorado expresamente en `.gitignore`).
  3. Modificación de `backend/src/db.ts` para cargar automáticamente `.env.test.local` con prioridad sobre `.env`.
  4. Saneamiento integral en `CIERRE_INTEGRAL_PASOS_01_A_06.md` y `customerAiCertificationP01P32.test.ts`, sustituyendo la cadena por referencias a variables de entorno (`process.env.SQLSERVER_TEST_PASSWORD`).
  5. Verificación con `Select-String`: cero ocurrencias de la contraseña anterior en todo el repositorio.

---

### HALLAZGO H-02 (ALTO) — SEPARACIÓN FORMAL DE DOS PASOS: APROBACIÓN VS EMISIÓN AL PACIENTE
* **Gravedad:** ALTO (Gobernanza y Privacidad Clínica).
* **Componente afectado:** `customerAiActionService.ts`, `routes.ts`, `customerAiAgentApi.ts`, `CustomerAiStaffWorkspacePage.tsx`.
* **Condición detectada:** El borrador documental aprobado por el odontólogo quedaba en estado `Aprobado` en `dbo.BorradoresIA`, pero no disponía de un endpoint explícito, trazable e independiente para transferirlo a `dbo.IndicacionesPostatencion` (`estado = 'Documento emitido'`) con confirmación del profesional.
* **Causa Raíz:** Falta de formalización del ciclo de vida documental de dos pasos (Paso 1: Aprobación técnica clínica; Paso 2: Emisión formal al paciente).
* **Impacto Potencial:** Confusión operativa en el equipo asistencial; riesgo de que un borrador aprobado internamente se emita sin revisión final de derivación, o que el paciente no disponga del documento oficial emitido en su bandeja.
* **Acción Correctiva Implementada:**
  1. Implementación del método formal `CustomerAiActionService.issueDocumentationDraft(principal, draftId)` con transacción `Serializable`:
     - Valida estado previo (`Aprobado` o `Corregido_Y_Aprobado`).
     - Requiere profesional activo colegiado.
     - Inserta fila oficial en `dbo.IndicacionesPostatencion` con `estado = 'Documento emitido'`, `origen_documento = 'COPILOTO_IA'` y fechas verificables.
     - Vincula `id_indicacion_vinculada` en `dbo.BorradoresIA`.
     - Registra evento de auditoría `BORRADOR_DOCUMENTAL_EMITIDO` en `dbo.InteraccionesIA`.
     - Implementa idempotencia ante reemisiones.
  2. Exposición del endpoint `POST /document-drafts/:draftId/issue` con validación RBAC (`ODONTOLOGO`, `ADMIN`).
  3. Exposición en API cliente frontend `customerAiAgentApi.issueDraft(id)`.
  4. Incorporación del botón "Emitir formalmente al paciente" en `CustomerAiStaffWorkspacePage.tsx`.
  5. Pruebas de regresión añadidas en `P23` de `customerAiCertificationP01P32.test.ts` y `SEC-08` de `customerAiSecurityEvaluation.test.ts`.

---

### HALLAZGO H-03 (MEDIO) — PERSISTENCIA ATÓMICA DE LA BASE DE CONOCIMIENTO RAG
* **Gravedad:** MEDIO (Resiliencia y Confiabilidad).
* **Componente afectado:** `durableKnowledgeService.ts`.
* **Condición detectada:** `saveToDisk` utilizaba `fs.writeFileSync(this.storagePath, ...)` directamente sobre el archivo principal de almacenamiento.
* **Causa Raíz:** Escritura síncrona directa sobre el archivo de destino sin fase intermedia de intercambio.
* **Impacto Potencial:** Si el proceso Node.js se interrumpía bruscamente durante la serialización, el archivo `knowledgeStore.json` quedaba truncado o con JSON inválido, bloqueando el arranque del servicio RAG.
* **Acción Correctiva Implementada:**
  1. Sustitución por escritura atómica de dos fases:
     ```typescript
     const tempPath = `${this.storagePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
     fs.writeFileSync(tempPath, JSON.stringify(list, null, 2), 'utf8');
     fs.renameSync(tempPath, this.storagePath);
     ```
  2. Limpieza de archivos temporales huérfanos en caso de error.
  3. Prueba de verificación `E05` en `customerAiRagEvaluation.test.ts` asegurando persistencia íntegra y ausencia de temporales residuales.

---

### HALLAZGO H-04 (MEDIO) — CONDICIONES DE CARRERA EN SUITES PARALELAS Y FILTRADO DE HORARIO
* **Gravedad:** MEDIO (Estabilidad de Aseguramiento de Calidad).
* **Componente afectado:** `backend/package.json`, `customerAiCertificationP01P32.test.ts`, `customerAiE2EValidation.test.ts`.
* **Condición detectada:** 
  - Al correr Vitest con paralelismo por archivo sobre la misma base de datos `NexoSaludDB_Test`, las operaciones de limpieza de una suite interferían con las aserciones de métricas de otra suite (`customerAiPersistence.test.ts`).
  - La prueba P31 y E2E-03 tomaban cualquier slot disponible sin validar que coincidiera con el profesional y sede asignados al tratamiento, arrojando `INVALID_INPUT`.
* **Causa Raíz:** Falta de aislamiento secuencial en el script de test de backend y selección no discriminada de slots en fixtures.
* **Acción Correctiva Implementada:**
  1. Configuración de `"test": "vitest run --fileParallelism=false"` en `backend/package.json` para ejecución secuencial limpia.
  2. Ajuste del query de disponibilidad en P31 y E2E-03 para filtrar explícitamente por `id_profesional` e `id_sede` de la sesión a reprogramar.
  3. Reseteo base del slot 116 en `beforeAll` para garantizar reproducibilidad en cada ejecución.

---

### HALLAZGO H-05 (BAJO) — AISLAMIENTO DE CONFIGURACIÓN DE TESTS DE FRONTEND
* **Gravedad:** BAJO (Higiene de Build y Test Runner).
* **Componente afectado:** `frontend/vite.config.ts`.
* **Condición detectada:** La propiedad `test.include` de Vite incluía `backend/tests/**/*.test.ts`, haciendo que el runner de frontend intentara ejecutar tests de backend con entorno `jsdom` y alias `@/` no resueltos.
* **Causa Raíz:** Patrón de inclusión excesivamente amplio configurado previamente en la migración del Paso 6.
* **Acción Correctiva Implementada:**
  1. Modificación de `frontend/vite.config.ts` limitando `test.include` estrictamente a `['frontend/src/**/*.test.{ts,tsx}']`.
  2. Verificación independiente: `npm run test --prefix frontend` corre 49/49 pruebas en 1.93s sin interferencia.

---

## 3. RESUMEN DE PRUEBAS DE REGRESIÓN AGREGADAS

Para asegurar que los defectos subsanados no vuelvan a presentarse, se crearon e integraron tres suites dedicadas:

1. **`backend/tests/customerAiGeminiEvaluation.test.ts`** (5 pruebas):
   - Cobertura de Tool Selection Accuracy (100%), Abstención Clínica (100%), Resistencia a Inyección de Prompts (100%) y Veracidad Factual con Gemini simulado.
2. **`backend/tests/customerAiRagEvaluation.test.ts`** (5 pruebas):
   - Cobertura de BM25 Precision@3 (33.33%), Recall@3 (100%), MRR (1.000), Verificación de Citas SHA-256, Inyección de directivas en fragmentos y Persistencia Atómica.
3. **`backend/tests/customerAiSecurityEvaluation.test.ts`** (8 pruebas):
   - Cobertura de Aislamiento Horizontal Paciente-Paciente, Aislamiento Horizontal Odontólogo-Odontólogo, Restricciones RBAC para Recepción, CHECK constraint en SQL Server contra diagnósticos de IA, y Separación de dos pasos Aprobación vs Emisión.
4. **`backend/tests/customerAiPerformance.test.ts`** (8 pruebas):
   - Cobertura de latencias p50 y p95 para tokens, tratamientos, sesiones, RAG, orquestación, resiliencia ante timeout de LLM, concurrencia de 5 llamadas y degradación con LLM desactivado.

**Total acumulado de pruebas activas del proyecto: 211 pruebas automatizadas pasando con 100% de éxito.**
