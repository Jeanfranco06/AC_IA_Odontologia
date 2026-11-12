# Cierre de subsanación CUSTOMER

Fecha: 12 de noviembre de 2026, America/Lima. Alcance verificado: entorno local aislado y datos sintéticos. **IMPLEMENTADO Y VERIFICADO se refiere a pruebas técnicas en Test, no a habilitación institucional ni certificación clínica de Gemini.** No se ejecutaron escrituras, ETL ni migraciones sobre NexoSaludDB o NexoSalud_Mart operativas.

El corpus oficial, las políticas por servicio, las ventanas de confirmación, las plantillas y los protocolos de derivación deben ser aprobados por responsables reales. Los registros publicados por los fixtures están marcados como sintéticos y solo existen en Test. El LLM externo permanece bloqueado en la certificación; las pruebas del proveedor usan dobles explícitos.

## Situación inicial y alcance final

Rama customer; HEAD inicial 171ac22. Existían cambios de la auditoría previa en el árbol de trabajo; se conservaron. Situación documentada inicial: 11 actividades parciales, dos sin evidencia integrada y una ausente; ocho alertas sin certificación integrada; 79 pruebas backend, 49 frontend y 133 omitidas. La conexión anterior operativa con privilegios sysadmin no se utilizó para ejecutar estas pruebas con escritura.

Se implementaron solicitud de programación distinta de PAYER y de reprogramación, ficha específica desde notas, políticas revisables, validaciones reales, cierres supervisados, derivaciones, ocho alertas con ciclo de vida, sesiones revocables y eventos de personal sin paciente ficticio. Se conservaron AL-C01–05. Se corrigieron defectos observados contra SQL/navegador: mojibake de estados, cierre que fabricaba Completa, mezcla UTC/local, solicitud duplicada por concurrencia, clave de sesión de acceso concurrente, DTO de borrador NaN, denominador ficticio y CHECK dimensional incompatible con 0.

SQL JEAC: NexoSaludDB_Test y NexoSalud_Mart_Test con cuenta de ejecución sin sysadmin/ALTER/acceso operativo. Prisma incorpora políticas, solicitudes, confirmación, revisión de ficha, actor y revocación; las migraciones originales no se ejecutaron sobre producción. Se entregan scripts separados de despliegue administrativo Test y runner de mínimos privilegios. React integra los nuevos flujos; Gemini y RAG separan interpretación de decisiones; el corpus institucional sigue bloqueado por falta de acreditación real.

## Resultado y dictamen

Backend: Test Files  24 passed (24); Tests  234 passed (234). Frontend: Test Files  6 passed (6); Tests  49 passed (49). Navegador: {"startTime": "2026-11-12T12:42:24.768Z", "duration": 61526.498, "expected": 6, "skipped": 0, "unexpected": 0, "flaky": 0}. Compilaciones y evidencia agregada se registran en certificación. No se suma ninguna omisión como éxito. No se ejecutaron llamadas reales a Gemini ni pruebas con pacientes reales.

La implementación técnica CUSTOMER tiene evidencia integrada en el laboratorio sintético. **No se declara habilitación institucional, certificación clínica del LLM ni despliegue productivo.** IA05 conserva bloqueo de operación institucional por corpus no acreditado; las políticas/plantillas/ventanas/protocolo deben recibir aprobación auténtica antes de activarse. El informe actualizado contiene las nueve columnas solicitadas y las catorce actividades/ocho alertas, distinguiendo intervención IA, backend y responsabilidad profesional.

## Riesgos y límites residuales

1. Gemini real y evaluación clínica/semántica abierta no ejecutados; la fidelidad de indicaciones se garantiza conservando texto literal, no con paráfrasis libre.
2. Migraciones, ETL y saneamiento operativos no aplicados; los 164 tipos desconocidos del corte operativo antiguo no se presentan como reparados.
3. Scheduler optativo requiere identidad/configuración operativa y monitorización institucional; rate limit es por proceso. Bandeja no garantiza entrega externa ni urgencias.
4. Políticas de servicio, ventanas, corpus y derivación no acreditados institucionalmente. Los ejemplos sintéticos publicados no deben promoverse a producción.
5. Pruebas de navegador no sustituyen auditoría completa de accesibilidad ni ocho escenarios visuales independientes por alerta. BUYER/LEAD no tuvieron certificación E2E integral en este trabajo.
6. El bundle principal de React conserva advertencia de tamaño; no impide compilación. Las rutas históricas amplias siguen restringidas y los cierres se canalizan por el servicio seguro.

## Entregables

- [Implementación IA01–IA14](SUBSANACION_IMPLEMENTACION_IA01_IA14.md)
- [Alertas ALT-C01–ALT-C08](SUBSANACION_ALERTAS_ALT_C01_C08.md)
- [Seguridad y autenticación](SUBSANACION_SEGURIDAD_Y_AUTENTICACION.md)
- [Validación y cierre](SUBSANACION_VALIDACIONES_Y_CIERRE.md)
- [Conciliación OLTP/Mart](SUBSANACION_OLTP_DATAMART.md)
- [Certificación y comandos](SUBSANACION_CERTIFICACION_22_REQUISITOS.md)
- [Informe académico completo](INFORME_ACADEMICO_IA_ACTUALIZADO.md)

## Estado de los requisitos

| Requisito | Estado inicial | Implementación realizada | Prueba ejecutada | Estado final |
|---|---|---|---|---|
| IA01 | SIN EVIDENCIA INTEGRADA | Autorización por propietario; selección de tratamiento; consulta de sesiones, fechas, profesional, sede y estados canónicos SQL. | SQL/HTTP IA01; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA02 | SIN EVIDENCIA INTEGRADA | Lee plan vigente; cuenta completadas solo con Realizada y Cerrada; sin plan devuelve 0 y expone inconsistencia; misma definición ETL. | SQL/HTTP IA02; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA03 | PARCIAL | Plan/ordinal/slot oficial; propuesta firmada y temporal; confirmación; solicitud persistente; revisión; nueva validación transaccional y procedimiento oficial; evento CREACION. | SQL/HTTP IA03; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA04 | PARCIAL | Preparar, confirmar, revisar, aprobar y aplicar slot vigente mediante servicio oficial; conserva id_sesion y registra evento. | SQL/HTTP IA04; contratos históricos | IMPLEMENTADO Y VERIFICADO |
| IA05 | PARCIAL | Ingesta/versionado; revisión profesional; publicación administrativa; filtros por rol; recuperación; verificación de cita exacta y revalidación ante revocación. | SQL/HTTP IA05; contratos históricos | BLOQUEADO POR DEPENDENCIA EXTERNA |
| IA06 | PARCIAL | Filtra aprobación, emisión y vigencia; atención seleccionable; conserva texto íntegro, cantidades, frecuencia y duración. | SQL/HTTP IA06; contratos históricos | IMPLEMENTADO Y VERIFICADO |
| IA07 | PARCIAL | Agrupa tratamiento, plan, sesión, antecedentes/verificación, alergias, atenciones previas, procedimientos, alertas y checklist; devuelve IDs de procedencia y revisión. | SQL/HTTP IA07; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA08 | PARCIAL | Conserva AL-C01–05 y evalúa ALT-C01–08; ámbito por rol; identidad deduplicada; revisión y resolución auditadas. | SQL/HTTP IA08; contratos históricos | IMPLEMENTADO Y VERIFICADO |
| IA09 | NO IMPLEMENTADO | Contrato BORRADOR_FICHA_CLINICA; estructura extractiva o proveedor autorizado con validación literal; edición por secciones; versiones; rechazo; transferencia explícita contra revisión vigente. | SQL/HTTP IA09; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA10 | PARCIAL | Reutiliza BorradoresIA/versiones; usa notas registradas o plantilla publicada por servicio; aprobación y emisión separadas; preserva identidad del documento. | SQL/HTTP IA10; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA11 | PARCIAL | Política DOCUMENTACION publicada por servicio; verifica campos/procedimiento/indicaciones configurados; hash y revisión de ficha; registro Completa/Incompleta. | SQL/HTTP IA11; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA12 | PARCIAL | Procedimiento asistencial; validación vigente; cierre de sesión supervisado; eventos; nueva consulta y refresco del portal. | SQL/HTTP IA12; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA13 | PARCIAL | Reúne plan, sesiones, validaciones vigentes, documentos y derivaciones; bloquea excepciones; procedimiento formal y decisión auditada; transición TURNED según regla existente. | SQL/HTTP IA13; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA14 | PARCIAL | Persistencia por actor real; id_usuario_actor; paciente nullable para personal; correlación; evento por acción; no duplica conversación por herramienta interna. | SQL/HTTP IA14; contratos históricos | IMPLEMENTADO Y VERIFICADO |
| ALT-C01 | AUSENTE | Sesión futura, pendiente y dentro de ventana CONFIRMACION publicada; confirmar no modifica asistencia. | SQL real ALT-C01; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C02 | AUSENTE | Fin del horario programado ya transcurrió y el estado sigue pendiente; solicitar revisión humana. | SQL real ALT-C02; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C03 | AUSENTE | Plan vigente con cantidad prevista mayor que sesiones oficiales; deriva al flujo IA03. | SQL real ALT-C03; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C04 | CÓDIGO SIN E2E | Alergia documentada o antecedente pendiente de verificación; muestra advertencia documental. | SQL real ALT-C04; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C05 | PARCIAL | Evalúa campos reales y requisitos de política vigente; explicita falta de política; no depende solo de validación antigua. | SQL real ALT-C05; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C06 | CÓDIGO SIN E2E | Borrador vigente postatención no aprobado; excluye borrador de ficha; identidad y versión. | SQL real ALT-C06; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C07 | AUSENTE | Plan completo gestionado (cierre o excepciones oficiales) y tratamiento activo; solicitar revisión de checklist. | SQL real ALT-C07; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C08 | PARCIAL | Paciente puede solicitar revisión explícita; protocolo publicado puede activar derivación antes del LLM; solicitud y alerta persistidas. | SQL real ALT-C08; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |


## Archivos y Git

No se creó commit propio ni se revirtió trabajo previo. Archivos presentes en el diff al generar este corte (incluye auditoría previa y directorios nuevos):

```text
backend/prisma/schema.prisma
backend/src/db.ts
backend/src/index.ts
backend/src/modules/customer/ai-agent/authContext.ts
backend/src/modules/customer/ai-agent/llm/geminiProvider.ts
backend/src/modules/customer/ai-agent/llm/orchestrator.ts
backend/src/modules/customer/ai-agent/llm/systemInstructions.ts
backend/src/modules/customer/ai-agent/llm/toolRegistry.ts
backend/src/modules/customer/ai-agent/policies.ts
backend/src/modules/customer/ai-agent/routes.ts
backend/src/modules/customer/ai-agent/services/customerAiActionService.ts
backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts
backend/src/modules/customer/knowledge-base/durableKnowledgeService.ts
backend/src/routes/customer.routes.ts
backend/src/routes/patientAuth.routes.ts
backend/src/routes/staffAuth.routes.ts
backend/src/services/customerAiPersistenceService.ts
backend/src/services/patientAuthService.ts
backend/src/services/staffAuthService.ts
backend/tests/customerAiOrchestrator.test.ts
backend/tests/customerAiPilotFunctional.test.ts
backend/tests/customerKnowledgeBaseCertificationP01P32.test.ts
backend/tests/helpers/isolatedSqlServer.ts
database/customer/04_hechos_customer.sql
database/customer/05_etl_customer.sql
frontend/package-lock.json
frontend/package.json
frontend/src/modules/customer/components/CustomerDetailModal.tsx
frontend/src/modules/customer/pages/CustomerAiStaffWorkspacePage.tsx
frontend/src/modules/customer/pages/CustomerPatientPortalPage.tsx
frontend/src/modules/customer/services/customerAiAgentApi.ts
frontend/src/modules/customer/services/customerFrontendCertificationF01F30.test.ts
frontend/src/shared/services/patientAuthService.ts
frontend/src/shared/services/staffAuthService.ts
backend/prisma/migrations/20261112060000_customer_completion/
backend/scripts/audit-customer-readonly.cjs
backend/scripts/build-customer-audit-docs.py
backend/scripts/build-customer-completion-docs.py
backend/scripts/completion-fixture.ts
backend/scripts/install-customer-certification.py
backend/scripts/provision-customer-certification.ps1
backend/scripts/run-customer-certification.cjs
backend/scripts/start-customer-certification.ts
backend/src/modules/customer/ai-agent/completionRoutes.ts
backend/src/modules/customer/ai-agent/llm/sourceIntegrity.ts
backend/src/modules/customer/ai-agent/securityControls.ts
backend/src/modules/customer/ai-agent/services/customerAlertLifecycleService.ts
backend/src/modules/customer/ai-agent/services/customerCompletionService.ts
backend/tests/customerAcademicTraceability.test.ts
backend/tests/customerCompletionIntegration.test.ts
backend/tests/customerCompletionMart.test.ts
backend/tests/helpers/syncCertificationMart.ts
database/customer/08_cierre_documental_seguro.sql
database/customer/09_programacion_sesion_segura.sql
database/customer/10_ajustes_dimensionales_ia.sql
database/customer/11_version_ficha_clinica.sql
database/customer/12_catalogos_estados_utf8.sql
database/customer/13_cierre_tratamiento_seguro.sql
database/customer/14_evento_asistencial_utc.sql
docs/customer/ai-agent/AUDITORIA_CUMPLIMIENTO_INFORME_IA.md
docs/customer/ai-agent/CIERRE_SUBSANACION_AGENTE_INTELIGENTE.md
docs/customer/ai-agent/CORRECCIONES_INFORME_ACADEMICO_IA.md
docs/customer/ai-agent/INFORME_ACADEMICO_IA_ACTUALIZADO.md
docs/customer/ai-agent/MATRIZ_ALERTAS_ALT_C01_C08.md
docs/customer/ai-agent/MATRIZ_TRAZABILIDAD_IA01_IA14.md
docs/customer/ai-agent/RESULTADOS_VERIFICACION_IA.md
docs/customer/ai-agent/SUBSANACION_ALERTAS_ALT_C01_C08.md
docs/customer/ai-agent/SUBSANACION_CERTIFICACION_22_REQUISITOS.md
docs/customer/ai-agent/SUBSANACION_IMPLEMENTACION_IA01_IA14.md
docs/customer/ai-agent/SUBSANACION_OLTP_DATAMART.md
docs/customer/ai-agent/SUBSANACION_SEGURIDAD_Y_AUTENTICACION.md
docs/customer/ai-agent/SUBSANACION_VALIDACIONES_Y_CIERRE.md
docs/customer/ai-agent/evidencias/
frontend/e2e/
frontend/playwright.customer.config.ts
frontend/src/modules/customer/components/CustomerCompletionPanel.tsx
```

Los logs de diagnóstico iniciales se conservan privados para no ocultar fallos corregidos. La evidencia pública final contiene agregados y capturas sintéticas. La definición de medidas y el procedimiento de reproducción permiten evaluar estos resultados sin credenciales publicadas.
