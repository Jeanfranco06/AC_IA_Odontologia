# Subsanación de IA01–IA14

Fecha: 12 de noviembre de 2026, America/Lima. Alcance verificado: entorno local aislado y datos sintéticos. **IMPLEMENTADO Y VERIFICADO se refiere a pruebas técnicas en Test, no a habilitación institucional ni certificación clínica de Gemini.** No se ejecutaron escrituras, ETL ni migraciones sobre NexoSaludDB o NexoSalud_Mart operativas.

El corpus oficial, las políticas por servicio, las ventanas de confirmación, las plantillas y los protocolos de derivación deben ser aprobados por responsables reales. Los registros publicados por los fixtures están marcados como sintéticos y solo existen en Test. El LLM externo permanece bloqueado en la certificación; las pruebas del proveedor usan dobles explícitos.

| Código | Función resultante | Servicio comprobable |
|---|---|---|
| IA01 | Autorización por propietario; selección de tratamiento; consulta de sesiones, fechas, profesional, sede y estados canónicos SQL. | [customerAiQueryService.ts:90](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L90) |
| IA02 | Lee plan vigente; cuenta completadas solo con Realizada y Cerrada; sin plan devuelve 0 y expone inconsistencia; misma definición ETL. | [customerAiQueryService.ts:155](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L155) |
| IA03 | Plan/ordinal/slot oficial; propuesta firmada y temporal; confirmación; solicitud persistente; revisión; nueva validación transaccional y procedimiento oficial; evento CREACION. | [customerCompletionService.ts:80](../../../backend/src/modules/customer/ai-agent/services/customerCompletionService.ts#L80) |
| IA04 | Preparar, confirmar, revisar, aprobar y aplicar slot vigente mediante servicio oficial; conserva id_sesion y registra evento. | [customerAiActionService.ts:123](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L123) |
| IA05 | Ingesta/versionado; revisión profesional; publicación administrativa; filtros por rol; recuperación; verificación de cita exacta y revalidación ante revocación. | [durableKnowledgeService.ts:349](../../../backend/src/modules/customer/knowledge-base/durableKnowledgeService.ts#L349) |
| IA06 | Filtra aprobación, emisión y vigencia; atención seleccionable; conserva texto íntegro, cantidades, frecuencia y duración. | [customerAiQueryService.ts:179](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L179) |
| IA07 | Agrupa tratamiento, plan, sesión, antecedentes/verificación, alergias, atenciones previas, procedimientos, alertas y checklist; devuelve IDs de procedencia y revisión. | [customerAiQueryService.ts:413](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L413) |
| IA08 | Conserva AL-C01–05 y evalúa ALT-C01–08; ámbito por rol; identidad deduplicada; revisión y resolución auditadas. | [customerAlertLifecycleService.ts:9](../../../backend/src/modules/customer/ai-agent/services/customerAlertLifecycleService.ts#L9) |
| IA09 | Contrato BORRADOR_FICHA_CLINICA; estructura extractiva o proveedor autorizado con validación literal; edición por secciones; versiones; rechazo; transferencia explícita contra revisión vigente. | [customerCompletionService.ts:176](../../../backend/src/modules/customer/ai-agent/services/customerCompletionService.ts#L176) |
| IA10 | Reutiliza BorradoresIA/versiones; usa notas registradas o plantilla publicada por servicio; aprobación y emisión separadas; preserva identidad del documento. | [customerAiActionService.ts:410](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L410) |
| IA11 | Política DOCUMENTACION publicada por servicio; verifica campos/procedimiento/indicaciones configurados; hash y revisión de ficha; registro Completa/Incompleta. | [customerCompletionService.ts:240](../../../backend/src/modules/customer/ai-agent/services/customerCompletionService.ts#L240) |
| IA12 | Procedimiento asistencial; validación vigente; cierre de sesión supervisado; eventos; nueva consulta y refresco del portal. | [customerCompletionService.ts:252](../../../backend/src/modules/customer/ai-agent/services/customerCompletionService.ts#L252) |
| IA13 | Reúne plan, sesiones, validaciones vigentes, documentos y derivaciones; bloquea excepciones; procedimiento formal y decisión auditada; transición TURNED según regla existente. | [customerCompletionService.ts:287](../../../backend/src/modules/customer/ai-agent/services/customerCompletionService.ts#L287) |
| IA14 | Persistencia por actor real; id_usuario_actor; paciente nullable para personal; correlación; evento por acción; no duplica conversación por herramienta interna. | [customerCompletionService.ts:23](../../../backend/src/modules/customer/ai-agent/services/customerCompletionService.ts#L23) |

## Integración

El panel compartido [CustomerCompletionPanel.tsx:1](../../../frontend/src/modules/customer/components/CustomerCompletionPanel.tsx#L1) se integra en el portal y en el espacio de trabajo. Los tratamientos y las atenciones se seleccionan desde consultas autorizadas; no requieren escribir identificadores internos. Los datos de horarios, profesionales, sedes, estados y documentos provienen del backend. Se corrigió el lector React de borradores para aceptar el DTO real y conservar emisión/versión; la prueba de navegador detectó el defecto NaN después de emitir. El cronograma usa Realizada + Cerrada para sesión completada y consulta sede vigente. Las cargas de contexto usan versión de consulta y publican una instantánea completa; una respuesta anterior no reemplaza la selección vigente ni indica falsamente que no hay sesiones mientras carga.

Las herramientas conversacionales se registran en [toolRegistry.ts:1](../../../backend/src/modules/customer/ai-agent/llm/toolRegistry.ts#L1). Preparar solicitud no confirma ni aplica; generar borrador no transfiere a ficha. Las decisiones privilegiadas se ejecutan desde acciones humanas autenticadas.

## Programación y reprogramación

IA03: selección → ordinal faltante del plan → slot oficial → propuesta firmada de 15 minutos → confirmación explícita → solicitud Pendiente → revisión de recepción → Aprobada → aplicación serializable → sesión + evento CREACION. Revalida plan, ordinal, profesional, sede, duración, conflictos y exclusión PAYER. Dos preferencias concurrentes para el mismo ordinal no generan dos solicitudes activas; mismo token es idempotente. El slot no se reserva al preparar.

IA04 conserva su contrato y su identidad de sesión: propuesta → confirmación → revisión → aplicación del slot → evento REPROGRAMACION. Aprobar no cambia el horario. Reintentos y conflictos se verifican contra SQL; ver [customerCompletionIntegration.test.ts:48](../../../backend/tests/customerCompletionIntegration.test.ts#L48) y las suites históricas.

## Evidencia y límites

Prueba integrada: [customerCompletionIntegration.test.ts:1](../../../backend/tests/customerCompletionIntegration.test.ts#L1). Interfaz y navegador: [customer-completion.spec.ts:1](../../../frontend/e2e/customer-completion.spec.ts#L1). Matriz y resultados exactos: [certificación](SUBSANACION_CERTIFICACION_22_REQUISITOS.md). Validación, política y cierre: [integridad clínica](SUBSANACION_VALIDACIONES_Y_CIERRE.md). No se presenta el proveedor simulado como Gemini real.
