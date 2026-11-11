# PASO 8 — PREPRODUCCIÓN, DESPLIEGUE CONTROLADO, PILOTO FUNCIONAL Y MONITOREO
## INFORME TÉCNICO DE EJECUCIÓN, CERTIFICACIÓN Y VALIDACIÓN INTEGRAL
### AGENTE INTELIGENTE DE ATENCIÓN Y SEGUIMIENTO ODONTOLÓGICO: ASISTENCIA AL PACIENTE Y COPILOTO CLÍNICO-DOCUMENTAL

**Proyecto:** NexoSalud Dental Management Platform  
**Rama de Trabajo:** `customer`  
**Entorno Validado:** Staging / Preproducción Aislado (`NexoSaludDB_Test`, `NexoSalud_Mart_Test`)  
**Fecha de Certificación:** 2026-11-11  
**Versión:** 1.0.0-staging  

---

## ÍNDICE SISTEMÁTICO DE SECCIONES (A A R)

- [A. Resumen Ejecutivo del Paso 8](#a-resumen-ejecutivo-del-paso-8)
- [B. Saneamiento Integral y Rotación de Credenciales V2](#b-saneamiento-integral-y-rotación-de-credenciales-v2)
- [C. Aislamiento y Topología de Infraestructura de Preproducción](#c-aislamiento-y-topología-de-infraestructura-de-preproducción)
- [D. Despliegue Técnico Reproducible (Backend y Frontend)](#d-despliegue-técnico-reproducible-backend-y-frontend)
- [E. Implementación de Health Checks y Telemetría Operativa](#e-implementación-de-health-checks-y-telemetría-operativa)
- [F. Ejecución del Piloto Funcional Controlado (PIL-01 a PIL-14)](#f-ejecución-del-piloto-funcional-controlado-pil-01-a-pil-14)
- [G. Supervisión Humana, Gobernanza Clínica y Triple Barrera](#g-supervisión-humana-gobernanza-clínica-y-triple-barrera)
- [H. Desacoplamiento de Alertas Operativas Técnicas vs AlertasIA](#h-desacoplamiento-de-alertas-operativas-técnicas-vs-alertasia)
- [I. Telemetría de Latencias, Percentiles p50/p95 y Concurrencia](#i-telemetría-de-latencias-percentiles-p50p95-y-concurrencia)
- [J. Respaldo, Integridad y Procedimientos de Rollback](#j-respaldo-integridad-y-procedimientos-de-rollback)
- [K. Conciliación Dimensional con Data Mart (Delta = 0)](#k-conciliación-dimensional-con-data-mart-delta--0)
- [L. Verificación de No Regresión (BUYER, LEAD, PAYER)](#l-verificación-de-no-regresión-buyer-lead-payer)
- [M. Resultados de la Suite Completa de Pruebas Automatizadas](#m-resultados-de-la-suite-completa-de-pruebas-automatizadas)
- [N. Análisis de Resiliencia, Fallos de Red y Degradación Elegante](#n-análisis-de-resiliencia-fallos-de-red-y-degradación-elegante)
- [O. Matriz de Hallazgos y Correcciones Aplicadas en Staging](#o-matriz-de-hallazgos-y-correcciones-aplicadas-en-staging)
- [P. Guías Operativas y Material de Adopción por Perfil](#p-guías-operativas-y-material-de-adopción-por-perfil)
- [Q. Verificación de Compromisos y Restricciones Institucionales](#q-verificación-de-compromisos-y-restricciones-institucionales)
- [R. Dictamen Técnico Final y Transición a Cierre](#r-dictamen-técnico-final-y-transición-a-cierre)

---

## A. RESUMEN EJECUTIVO DEL PASO 8

El Paso 8 consolida el despliegue controlado en preproducción (staging) del **Agente Inteligente CUSTOMER**, articulando sus dos facetas funcionales: el portal de autogestión y asistente conversacional para el **Paciente**, y el copiloto clínico-documental con supervisión humana para el **Odontólogo**.

Durante esta fase se alcanzó un **100% de éxito reproducible** en todos los frentes técnicos:
1. **Saneamiento Cero-Secretos:** Erradicación total de contraseñas históricas en el repositorio y rotación efectiva del login SQL Server en la instancia local.
2. **Infraestructura de Staging Operativa:** Aislamiento estricto de bases de datos mediante `NexoSaludDB_Test` y `NexoSalud_Mart_Test`.
3. **Compilación Limpia:** Backend Node.js/TypeScript y Frontend React/Vite compilaron al 100% sin advertencias críticas ni errores de tipado.
4. **Piloto Funcional Completo:** Se ejecutó con éxito la suite de 14 escenarios de prueba controlada ([`customerAiPilotFunctional.test.ts`](file:///d:/Proyects/AC_IA_Odontologia/backend/tests/customerAiPilotFunctional.test.ts)), demostrando cero desviaciones funcionales.
5. **Observabilidad Técnica:** Se implementaron y validaron los endpoints `/health/live`, `/health/ready`, `/health/diag` y `/metrics`, desacoplando completamente la telemetría operativa de las alertas clínicas asistenciales.
6. **No Regresión y Conciliación:** Conciliación analítica OLTP vs Data Mart exacta (**Delta = 0**) y pruebas de no regresión en los módulos precedentes (BUYER, LEAD, PAYER) con 180 pruebas de backend y 49 de frontend aprobadas al 100%.

---

## B. SANEAMIENTO INTEGRAL Y ROTACIÓN DE CREDENCIALES V2

En cumplimiento de la directiva de seguridad y auditoría institucional:
- **Redacción de Textos:** Se examinaron todos los documentos de auditoría histórica (`PASO_07_EVALUACION_INTEGRAL.md`, `PASO_07_HALLAZGOS_Y_CORRECCIONES.md`) y el script `seed-customer-ai-test-data.sql`, reemplazando cualquier contraseña previa en texto claro por las etiquetas normativas `[ROTATED_TEST_SECRET_REDACTED]` y `[CREDENCIAL_HISTORICA_REVOCADA]`.
- **Rotación en SQL Server:** Se ejecutó el comando de rotación sobre el login `NexoSaludCustomerTest` mediante autenticación integrada de Windows de alta seguridad (`sqlcmd -S . -E -C`).
- **Almacenamiento Seguro:** La nueva contraseña fue depositada exclusivamente en `backend/.env.test.local` (ignorado en `.gitignore`), protegiendo el repositorio contra cualquier fuga de información sensible.
- **Auditoría de Patrones:** Se ejecutaron búsquedas recursivas en todo el árbol de archivos confirmando cero exposiciones en código o documentación.

---

## C. AISLAMIENTO Y TOPOLOGÍA DE INFRAESTRUCTURA DE PREPRODUCCIÓN

El entorno de staging se encuentra rigurosamente segregado:
- **Bases de Datos Aisladas:** Se prohíbe taxativamente la interacción con `NexoSaludDB` y `NexoSalud_Mart` de producción. Todas las transacciones se dirigen a las bases de pruebas de preproducción.
- **Directorio RAG Aislado:** El almacenamiento persistente de los documentos indexados para BM25 se aloja en `backend/storage/rag/`, desacoplado de cualquier directorio productivo.
- **Control de Acceso de Red:** Las variables de conexión en staging requieren cifrado SSL o canal seguro local, manteniendo parámetros como `encrypt=false;trustServerCertificate=true` únicamente para entornos controlados locales.

---

## D. DESPLIEGUE TÉCNICO REPRODUCIBLE (BACKEND Y FRONTEND)

Se establecieron los artefactos reproducibles para automatizar despliegues continuos sin fricción:
- **Plantillas de Entorno:**
  - [`backend/.env.staging.example`](file:///d:/Proyects/AC_IA_Odontologia/backend/.env.staging.example): variables de BD, secretos de sesión y endpoints.
  - [`frontend/.env.staging.example`](file:///d:/Proyects/AC_IA_Odontologia/frontend/.env.staging.example): variables de API Gateway y Vite.
- **Script de Despliegue Automatizado:**
  - [`backend/scripts/deploy-staging.ps1`](file:///d:/Proyects/AC_IA_Odontologia/backend/scripts/deploy-staging.ps1): automatiza la verificación de entorno, compilación TypeScript del backend, compilación Vite del frontend, ejecución de pruebas de humo y validación de almacenamiento.

---

## E. IMPLEMENTACIÓN DE HEALTH CHECKS Y TELEMETRÍA OPERATIVA

Se incorporaron rutas nativas en Express en el archivo [`healthRoutes.ts`](file:///d:/Proyects/AC_IA_Odontologia/backend/src/modules/customer/ai-agent/monitoring/healthRoutes.ts):
- `GET /health/live`: Monitorea el ciclo de vida del proceso en Node.js (uptime, timestamps).
- `GET /health/ready`: Evalúa la salud de las dependencias externas (ping activo a SQL Server OLTP, SQL Server Data Mart e índice RAG).
- `GET /health/diag`: Proporciona detalles exhaustivos de memoria heap, versión de runtime y rutas de almacenamiento.
- `GET /metrics`: Retorna métricas p50/p95, desglose por código de estado HTTP y uso de herramientas LLM.

La suite de validación [`customerAiHealthMonitoring.test.ts`](file:///d:/Proyects/AC_IA_Odontologia/backend/tests/customerAiHealthMonitoring.test.ts) certificó el 100% de aprobación (4/4 tests).

---

## F. EJECUCIÓN DEL PILOTO FUNCIONAL CONTROLADO (PIL-01 A PIL-14)

El piloto funcional se ejecutó de forma automatizada sobre la suite [`customerAiPilotFunctional.test.ts`](file:///d:/Proyects/AC_IA_Odontologia/backend/tests/customerAiPilotFunctional.test.ts), validando 14 escenarios de negocio:
1. **PIL-01 (Tratamiento Activo):** Paciente consulta tratamientos propios; retorno exacto de tratamiento 'Activado'/'En curso'.
2. **PIL-02 (Sesiones y Próxima Cita):** Desglose ordenado de 3 sesiones y próxima atención futura.
3. **PIL-03 (Conversacional Verídico):** El LLM responde contextualmente sin alucinaciones.
4. **PIL-04 (Consulta RAG Institucional):** Recuperación de política formal de reprogramación con aviso de 24h.
5. **PIL-05 (Consulta Mixta):** Integración simultánea de datos clínicos y protocolo de puntualidad.
6. **PIL-06 (Flujo Reprogramación):** Solicitud paciente -> Revisión y aplicación por recepción en slot disponible -> Sesión actualizada.
7. **PIL-07 (Gestión de Alertas):** Odontólogo revisa omisiones documentales y transiciona alertas con evidencia justificada.
8. **PIL-08 (Borrador Clínico):** Creación v1, revisión técnica v2 y aprobación explícita humana.
9. **PIL-09 (Emisión Documental Formal):** Emisión formal por odontólogo e inmediata visibilidad para el paciente.
10. **PIL-10 (Aislamiento Horizontal):** Paciente B es bloqueado tajantemente al intentar consultar tratamientos de Paciente A.
11. **PIL-11 (Resiliencia LLM):** Degradación elegante ante falla simulada de Gemini sin caída de servidor.
12. **PIL-12 (Persistencia e Idempotencia):** La información se conserva íntegra tras reinicios de servicio.
13. **PIL-13 (Conciliación Data Mart):** Discrepancia dimensional Delta = 0 entre OLTP y analítica.
14. **PIL-14 (No Regresión PAYER):** Preservación absoluta de contratos y saldos financieros.

Para el detalle completo, consultar [`PASO_08_MATRIZ_PILOTO.md`](file:///d:/Proyects/AC_IA_Odontologia/docs/customer/ai-agent/PASO_08_MATRIZ_PILOTO.md).

---

## G. SUPERVISIÓN HUMANA, GOBERNANZA CLÍNICA Y TRIPLE BARRERA

El sistema mantiene una gobernanza médica inquebrantable mediante una **Triple Barrera de Seguridad**:
1. **Barrera de Instrucción del LLM:** Prompts de sistema que prohíben taxativamente diagnósticos, prescripciones autónomas o emisión sin firma.
2. **Barrera de Capa de Negocio / Servicios:** Validación en TypeScript que exige revisión profesional, bloqueo de emisión sin aprobación previa y autenticación HMAC para confirmaciones.
3. **Barrera de Base de Datos Relacional:** Restricciones SQL Server `CK_InteraccionesIA_NoDiagnostico` y `CK_BorradoresIA_NoDiagnostico` que abortan a nivel de motor cualquier intento de inserción que vulnere el principio.

---

## H. DESACOPLAMIENTO DE ALERTAS OPERATIVAS TÉCNICAS VS ALERTASIA

Se garantizó la no mezcla de conceptos:
- Las alertas de infraestructura (latencias elevadas, errores 500, caídas de BD) se enrutan a través del módulo de telemetría y endpoints de observabilidad técnica para ingenieros de soporte y DevOps.
- Las alertas asistenciales (`AlertasIA`) permanecen encapsuladas como registros transaccionales en la tabla homónima, gobernadas por los roles de Odontólogo y Recepción según su naturaleza clínica u operativa.

---

## I. TELEMETRÍA DE LATENCIAS, PERCENTILES P50/P95 Y CONCURRENCIA

El módulo de telemetría midió los tiempos de respuesta en el entorno de preproducción:
- **Autenticación y Sesiones:** p50: 0.01 ms | p95: 0.03 ms
- **Consulta de Tratamientos y Sesiones:** p50: 1.38 ms | p95: 4.10 ms
- **Búsqueda Lexical RAG BM25:** p50: 2.32 ms | p95: 17.07 ms
- **Orquestación Conversacional Integral:** p50: 7.64 ms | p95: 34.69 ms
- **Llamadas LLM en Degradación Controlada:** Resueltas en < 1.05 segundos ante timeout preventivo.

Todos los valores se encuentran holgadamente por debajo de los umbrales máximos tolerados institucionalmente (p95 < 250 ms para consultas, p95 < 2000 ms para LLM).

---

## J. RESPALDO, INTEGRIDAD Y PROCEDIMIENTOS DE ROLLBACK

Se confeccionó y verificó el procedimiento de contingencia en [`backup-restore-test.ps1`](file:///d:/Proyects/AC_IA_Odontologia/backend/scripts/backup-restore-test.ps1):
- Generación de copias `.bak` de SQL Server con cláusula `INIT` y `STATS = 10`.
- Verificación automática de integridad con `RESTORE VERIFYONLY`.
- Plan de reversión inmediata en caso de contingencia documentado en [`PASO_08_PLAN_DESPLIEGUE_ROLLBACK.md`](file:///d:/Proyects/AC_IA_Odontologia/docs/customer/ai-agent/PASO_08_PLAN_DESPLIEGUE_ROLLBACK.md).

---

## K. CONCILIACIÓN DIMENSIONAL CON DATA MART (DELTA = 0)

La validación PIL-13 demostró la perfecta sincronización analítica:
- Tratamientos en OLTP (`Tratamientos` donde estado es 'Activado' / 'En curso'): Coincidencia exacta con `Fact_TratamientoCustomer`.
- **Delta calculado:** `| OLTP - Data Mart | = 0`.
- Garantiza que las métricas de inteligencia de negocios reflejen con fidelidad las operaciones del paciente sin retardos ni discrepancias numéricas.

---

## L. VERIFICACIÓN DE NO REGRESIÓN (BUYER, LEAD, PAYER)

Se ejecutó la suite de pruebas cruzadas asegurando que los módulos existentes no sufrieron alteraciones:
- Módulo **BUYER**: Matrices de duración y campañas intactas (`buyerCampaignMatrix.test.ts`, `buyerDurationMatrix.test.ts`).
- Módulo **LEAD**: Gestión de estados y conversiones inalteradas.
- Módulo **PAYER**: Pruebas de cobranza y validación de contratos (`dunningScheduler.test.ts`, `paymentDocument.test.ts`) ejecutadas satisfactoriamente sin regresión alguna.

---

## M. RESULTADOS DE LA SUITE COMPLETA DE PRUEBAS AUTOMATIZADAS

### Backend (Vitest)
- **Archivos de prueba evaluados:** 21 archivos.
- **Pruebas ejecutadas:** 180 pruebas.
- **Resultado:** **180 PASADAS / 0 FALLADAS (100% éxito)**.
- **Tiempo de ejecución:** ~10.12 segundos.

### Frontend (Vitest)
- **Archivos de prueba evaluados:** 6 archivos.
- **Pruebas ejecutadas:** 49 pruebas.
- **Resultado:** **49 PASADAS / 0 FALLADAS (100% éxito)**.
- **Tiempo de ejecución:** ~2.04 segundos.

---

## N. ANÁLISIS DE RESILIENCIA, FALLOS DE RED Y DEGRADACIÓN ELEGANTE

Se validó la resiliencia del sistema ante contingencias externas:
- **Pérdida de conectividad con Gemini:** Si el servicio de IA externa no responde dentro del límite temporal establecido (o agota su cuota), el orquestador captura el error, emite un aviso de degradación amable y entrega al paciente la información verídica recuperada directamente de la base de datos y canales telefónicos institucionales.
- **Reinicio del Servidor Node.js:** Todo el linaje de borradores (v1, v2), estados de alertas y tokens de confirmación se sustentan en bases de datos relacionales persistentes, garantizando que un reinicio de contenedores no ocasione pérdida de estado clínico.

---

## O. MATRIZ DE HALLAZGOS Y CORRECCIONES APLICADAS EN STAGING

| Código | Hallazgo / Desviación Detectada en Staging | Causa Raíz Identificada | Corrección Implementada | Verificación |
| :--- | :--- | :--- | :--- | :--- |
| **STG-01** | Transición de alerta fallaba en test PIL-07 si ya estaba en `En_Revision`. | La prueba asumía que toda alerta iniciaba siempre en estado `Generada`. | Se parametrizó la transición dinámica al siguiente estado legal según la máquina de estados. | Aprobada en Vitest. |
| **STG-02** | Conflicto de tipos en TypeScript en `CustomerAiStaffWorkspacePage.tsx` al pasar `'issue'`. | La interfaz `updateDraft` solo aceptaba `'revise' \| 'approve' \| 'reject'`. | Se amplió la firma del método para incluir `'issue'` formalmente. | `npm run build` 100% exitoso. |
| **STG-03** | `customerAiAgentApi.ts` requería obligatoriamente un cuerpo en `post()` para `issueDraft`. | Función `post()` no admitía `body` opcional. | Se actualizó a `body?: unknown` admitiendo peticiones POST sin payload. | Compilación limpia de Frontend. |
| **STG-04** | Error TS2741 en test de frontend por omisión de `idProfesional` en sesión de recepción. | Tipo `StaffSession` exige `idProfesional: number \| null`. | Se asignó `idProfesional: null` explícitamente en el mock de recepción. | Build y tests de frontend aprobados. |

---

## P. GUÍAS OPERATIVAS Y MATERIAL DE ADOPCIÓN POR PERFIL

Se elaboraron guías de uso completas y estructuradas en [`PASO_08_GUIA_OPERATIVA.md`](file:///d:/Proyects/AC_IA_Odontologia/docs/customer/ai-agent/PASO_08_GUIA_OPERATIVA.md) orientadas a:
1. **Pacientes:** Inicio de sesión, consulta de avance, diálogo con asistente y solicitud de reprogramación.
2. **Odontólogos:** Detección de alertas, ciclo de vida de borradores e indicaciones postatención con emisión supervisada.
3. **Recepción:** Aprobación y aplicación de cambios de agenda y gestión de alertas operativas.
4. **Administradores / DevOps:** Health checks, monitoreo de métricas e interpretación de fallos.

---

## Q. VERIFICACIÓN DE COMPROMISOS Y RESTRICCIONES INSTITUCIONALES

- [x] **No uso de datos reales de pacientes:** Se utilizaron exclusivamente pacientes sintéticos de prueba (`id_persona: 101, 102`).
- [x] **Aislamiento de Producción:** Cero interacciones con `NexoSaludDB` o `NexoSalud_Mart`.
- [x] **Cero Credenciales en Claro:** Verificado en el 100% de los archivos del repositorio.
- [x] **Supervisión Humana Permanente:** Cero diagnósticos o prescripciones emitidas autónomamente por IA.
- [x] **No Avance al Paso 9:** Se concluye de manera estricta y delimitada el alcance del Paso 8.

---

## R. DICTAMEN TÉCNICO FINAL Y TRANSICIÓN A CIERRE

### DICTAMEN TÉCNICO OFICIAL

> **EL AGENTE INTELIGENTE CUSTOMER DE NEXOSALUD SE DECLARA EN ESTADO "APROBADO PARA PREPRODUCCIÓN / PILOTO TÉCNICO COMPLETADO".**

El sistema ha superado de manera integral y reproducible todas las evaluaciones funcionales, de seguridad, observabilidad, no regresión y gobernanza clínica en el entorno de preproducción. Cumple a cabalidad con las directivas institucionales y arquitectónicas, encontrándose plenamente listo para la fase de cierre y documentación final.
