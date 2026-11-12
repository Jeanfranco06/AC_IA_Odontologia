# Matriz de trazabilidad IA01–IA14

Fecha local de revisión: 12 de noviembre de 2026 (America/Lima). Fuente normativa de contraste: texto del encargo entregado por el usuario. Se distingue implementación comprobada por código/pruebas de contrato de integración real en SQL. Ninguna fila se certifica integralmente por tener un endpoint o un mock.

Resultado: **0 IMPLEMENTADO Y VERIFICADO; 11 IMPLEMENTADO PARCIALMENTE; 2 IMPLEMENTADO SIN EVIDENCIA SUFICIENTE; 1 NO IMPLEMENTADO**. Sin filas NO APLICABLE. La ejecución integrada está BLOQUEADA transversalmente por el entorno, sin ocultar el estado funcional de cada fila.

Prefijo de endpoints de esta matriz: `/api/customer/ai-agent`, salvo indicación distinta. Las pruebas `customerAcademicTraceability.test.ts` son de contrato con Prisma simulado; las suites SQL históricas se mantienen separadas y protegidas.

| Requisito | Estado final | Evidencia principal |
|---|---|---|
| IA01 — Consultar cronograma | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE | [customerAiQueryService.ts:88](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L88) |
| IA02 — Consultar progreso del tratamiento | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE | [customerAiQueryService.ts:152](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L152) |
| IA03 — Solicitar agendamiento de sesión | IMPLEMENTADO PARCIALMENTE | [01_migracion_oltp_customer.sql:1093](../../../database/customer/01_migracion_oltp_customer.sql#L1093) |
| IA04 — Solicitar reprogramación | IMPLEMENTADO PARCIALMENTE | [customerAiActionService.ts:122](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L122) |
| IA05 — Resolver preguntas generales | IMPLEMENTADO PARCIALMENTE | [durableKnowledgeService.ts:46](../../../backend/src/modules/customer/knowledge-base/durableKnowledgeService.ts#L46) |
| IA06 — Explicar indicaciones finales | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:175](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L175) |
| IA07 — Preparar contexto de sesión | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:409](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L409) |
| IA08 — Presentar alertas preventivas | IMPLEMENTADO PARCIALMENTE | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) |
| IA09 — Asistir registro clínico | NO IMPLEMENTADO | [customerAiActionService.ts:408](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L408) |
| IA10 — Preparar indicaciones | IMPLEMENTADO PARCIALMENTE | [customerAiActionService.ts:408](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L408) |
| IA11 — Verificar documentación | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:451](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L451) |
| IA12 — Actualizar progreso de sesiones | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:152](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L152) |
| IA13 — Preparar cierre del tratamiento | IMPLEMENTADO PARCIALMENTE | [customerAiQueryService.ts:369](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L369) |
| IA14 — Registrar interacciones | IMPLEMENTADO PARCIALMENTE | [customerAiPersistenceService.ts:74](../../../backend/src/services/customerAiPersistenceService.ts#L74) |

## IA01 — Consultar cronograma

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | leer sesiones vigentes y mostrar próximas sesiones y estados. |
| 2. Objetivo funcional | Consultar cronograma con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | Paciente propietario |
| 4. Evento disparador | Solicitud en portal/chat |
| 5. Servicio backend | CustomerAiQueryService.getTreatmentSessions |
| 6. Endpoint | GET /treatments/:treatmentId/sessions; GET /me/upcoming-sessions |
| 7. Herramienta LLM | getTreatmentSessions; getUpcomingSessions |
| 8. Vista frontend | Portal: cronograma y sesiones; chat |
| 9. Tablas OLTP/fuentes | SesionesTratamiento, TratamientosContratados, Profesionales, Sedes |
| 10. Efectos de escritura | Lectura; InteraccionesIA si consulta directa |
| 11. Auditoría | CONSULTA_SESIONES_TRATAMIENTO / CONSULTA_PROXIMAS_SESIONES |
| 12. Medidas BI | interacciones_registradas; consulta sin mutar sesiones_programadas |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:53](../../../backend/tests/customerAcademicTraceability.test.ts#L53); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE |
| 15. Deficiencias | Hay camino de producto y aislamiento en código; falta E2E autenticado SQL aislado. No inventar estados desde una atención asistida. |
| 16. Acción/decisión | C: devolver estados persistidos e incluir Reprogramada en próximas sesiones. B: limitar la afirmación de verificación. |

Evidencia principal: [customerAiQueryService.ts:88](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L88). Estado anterior: Estados derivados podían aparentar sesión cerrada; Reprogramada omitida en próximas sesiones.

## IA02 — Consultar progreso del tratamiento

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | resumir sesiones realizadas y pendientes, proporcionando avance administrativo. |
| 2. Objetivo funcional | Consultar progreso del tratamiento con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | Paciente propietario |
| 4. Evento disparador | Consulta de tratamiento |
| 5. Servicio backend | CustomerAiQueryService.getTreatmentProgress |
| 6. Endpoint | GET /treatments/:treatmentId/progress |
| 7. Herramienta LLM | getTreatmentProgress |
| 8. Vista frontend | Portal: indicadores del tratamiento seleccionado |
| 9. Tablas OLTP/fuentes | PlanTratamiento vigente, SesionesTratamiento, TratamientosContratados |
| 10. Efectos de escritura | Lectura y auditoría; sin progreso duplicado persistente |
| 11. Auditoría | CONSULTA_PROGRESO_OPERATIVO |
| 12. Medidas BI | sesiones_planificadas, sesiones_completadas de Fact_TratamientoCustomer |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:62](../../../backend/tests/customerAcademicTraceability.test.ts#L62); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO SIN EVIDENCIA SUFICIENTE |
| 15. Deficiencias | No se ejecutó reconciliación por tratamiento en SQL aislado; sesiones de planes anteriores no tienen política de sustitución explícita. Si realizadas exceden plan, el porcentaje puede superar 100 y requiere revisar datos. |
| 16. Acción/decisión | C/E: alinear completada a Realizada Y Cerrada, plan vigente más reciente y cero sesiones sin denominador ficticio. |

Evidencia principal: [customerAiQueryService.ts:152](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L152). Estado anterior: Se contaba asistencia, cierre o sinónimos como completitud, de forma distinta al ETL.

## IA03 — Solicitar agendamiento de sesión

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | consultar disponibilidad y solicitar programación de una sesión del plan. |
| 2. Objetivo funcional | Solicitar agendamiento de sesión con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | Paciente; aplicación institucional supervisada |
| 4. Evento disparador | Sesión prevista todavía no creada/programada |
| 5. Servicio backend | Ver evidencia y límites específicos; no equiparar servicio relacionado con actividad completa. |
| 6. Endpoint | No existe endpoint del agente para solicitud de programación nueva. /availability/slots es solo staff. |
| 7. Herramienta LLM | No existe herramienta de programación inicial CUSTOMER |
| 8. Vista frontend | No hay formulario específico en portal; reprogramación es distinta |
| 9. Tablas OLTP/fuentes | PlanTratamiento, SesionesTratamiento, Disponibilidad, EventosSesion; SP usp_ProgramarSesionTratamiento |
| 10. Efectos de escritura | El SP existente crea sesión, atención y evento CREACION; no es un flujo del paciente |
| 11. Auditoría | EventosSesion del SP; sin solicitud de programación propia del agente |
| 12. Medidas BI | sesiones_programadas, sesiones_planificadas, atenciones; no atribuir reprogramaciones |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:70](../../../backend/tests/customerAcademicTraceability.test.ts#L70); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO PARCIALMENTE |
| 15. Deficiencias | Existe infraestructura SQL, no solicitud con confirmación, elegibilidad ordinal y contrato de estados. Fecha de sesión es obligatoria: las sesiones faltantes se infieren del plan, no de filas sin horario. El SP debe endurecer inexistencia y compatibilidad del slot antes de exponerlo. |
| 16. Acción/decisión | D/C pendiente: diseñar contrato de solicitud y adaptar agenda oficial; no duplicar reserva PAYER. No exponer SP incompleto al LLM. |

Evidencia principal: [01_migracion_oltp_customer.sql:1093](../../../database/customer/01_migracion_oltp_customer.sql#L1093). Estado anterior: SP disponible; ausencia de flujo del agente para nuevas sesiones.

## IA04 — Solicitar reprogramación

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | validar elegibilidad y disponibilidad, y preparar una propuesta de cambio. |
| 2. Objetivo funcional | Solicitar reprogramación con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | Paciente propietario; RECEPCION/ADMIN revisan y aplican |
| 4. Evento disparador | Sesión propia futura, pendiente, posterior a la primera |
| 5. Servicio backend | CustomerAiActionService.prepareRescheduleRequest |
| 6. Endpoint | POST /actions/prepare; /actions/confirm; /reschedule-requests/:requestId/review; /apply |
| 7. Herramienta LLM | prepareRescheduleRequest; getRescheduleRequestStatus. Sin confirmación/aplicación como tools. |
| 8. Vista frontend | Portal: preparar/confirmar; staff: bandeja, revisión y slot |
| 9. Tablas OLTP/fuentes | SolicitudesReprogramacionCustomer, SesionesTratamiento, Disponibilidad, EventosSesion, InteraccionesIA |
| 10. Efectos de escritura | Pendiente → En_Revision opcional → Aprobada → Aplicada; rechazo/cancelación. PREPARED no persiste. |
| 11. Auditoría | SOLICITUD_REPROGRAMACION y revisiones; REPROGRAMACION en EventosSesion solo al aplicar |
| 12. Medidas BI | interacciones_registradas; reprogramaciones_acumuladas solo desde evento aplicado |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:72](../../../backend/tests/customerAcademicTraceability.test.ts#L72); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO PARCIALMENTE |
| 15. Deficiencias | Transacciones y SP en código; faltan pruebas reales de solapamiento, concurrencia y horario SQL. La confirmación repetida tras cambiar la sesión aún puede devolver conflicto. La resolución por ordinal debe desambiguar tratamientos. |
| 16. Acción/decisión | C/E: eliminar conversión silenciosa de ID a ordinal, rechazar ordinal ambiguo, reintento de aplicación al mismo slot sin otro evento, corregir mensaje PREPARED. |

Evidencia principal: [customerAiActionService.ts:122](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L122). Estado anterior: Mensaje de registro prematuro y posible elección ambigua; reintento de aplicación rechazado.

## IA05 — Resolver preguntas generales

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | consultar contenido institucional aprobado y proporcionar orientación no diagnóstica. |
| 2. Objetivo funcional | Resolver preguntas generales con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | Paciente y staff según ACL documental |
| 4. Evento disparador | Consulta general al chat |
| 5. Servicio backend | Ver evidencia y límites específicos; no equiparar servicio relacionado con actividad completa. |
| 6. Endpoint | POST /chat; /knowledge/documents y ciclo de versiones por rol |
| 7. Herramienta LLM | searchApprovedKnowledge; getKnowledgeDocumentReference |
| 8. Vista frontend | Chat del portal y staff; gestión de conocimiento |
| 9. Tablas OLTP/fuentes | Corpus JSON local + InteraccionesIA; no tabla OLTP de conocimiento institucional |
| 10. Efectos de escritura | Registro/aprobación/publicación humana de documentos; búsqueda sin texto sensible en auditoría |
| 11. Auditoría | Conversación raíz; búsqueda directa auditable, búsqueda interna sin duplicación |
| 12. Medidas BI | interacciones_registradas no equivale exclusivamente a conversaciones |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:79](../../../backend/tests/customerAcademicTraceability.test.ts#L79); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO PARCIALMENTE |
| 15. Deficiencias | El corpus incluido se autodenominaba oficial y se autopublicaba con identidades 1. No existe acreditación externa de esas fuentes. Faltan E2E con documentos institucionales auténticos y verificación determinista de todas las citas de la salida. |
| 16. Acción/decisión | C/E: desactivar semilla automática, poner v1 autogeneradas identificables en revisión al cargar; exigir publicación humana. D: contenido institucional pendiente. |

Evidencia principal: [durableKnowledgeService.ts:46](../../../backend/src/modules/customer/knowledge-base/durableKnowledgeService.ts#L46). Estado anterior: Diez plantillas se publicaban automáticamente como oficiales; citas generadas no se verifican al finalizar la respuesta.

## IA06 — Explicar indicaciones finales

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | recuperar indicaciones aprobadas y emitidas, y explicarlas de manera limitada. |
| 2. Objetivo funcional | Explicar indicaciones finales con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | Paciente propietario; profesional autorizado |
| 4. Evento disparador | Pregunta sobre indicaciones o vista del portal |
| 5. Servicio backend | CustomerAiQueryService.getApprovedAftercareInstructions |
| 6. Endpoint | GET /attentions/:attentionId/approved-instructions; POST /chat |
| 7. Herramienta LLM | getMyAftercareInstructions; getApprovedAftercareInstructions |
| 8. Vista frontend | Portal: indicaciones por atención y chat |
| 9. Tablas OLTP/fuentes | Atenciones, IndicacionesPostatencion |
| 10. Efectos de escritura | Lectura; sin prescripción ni modificación del documento |
| 11. Auditoría | CONSULTA_INDICACIONES_APROBADAS o conversación única |
| 12. Medidas BI | interacciones_registradas; indicaciones_emitidas no aumenta por lectura |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:84](../../../backend/tests/customerAcademicTraceability.test.ts#L84); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO PARCIALMENTE |
| 15. Deficiencias | Recuperación por propiedad, vigencia y fechas existe; explicación limitada está instruida en prompt, sin garantía semántica determinista. La herramienta sin ID consulta solo la última atención, aunque una previa pudiera tener indicaciones. |
| 16. Acción/decisión | C/B: reforzar instrucción de no alterar dosis/frecuencia/duración y alinear indicador de disponibilidad del portal con aprobación más emisión. |

Evidencia principal: [customerAiQueryService.ts:175](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L175). Estado anterior: Vista y herramienta existen; límites de explicación sin prueba clínica ni garantía de salida.

## IA07 — Preparar contexto de sesión

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | recuperar plan, antecedentes y datos relevantes para la atención. |
| 2. Objetivo funcional | Preparar contexto de sesión con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | ODONTOLOGO asignado o responsable; ADMIN |
| 4. Evento disparador | Selección de atención autorizada |
| 5. Servicio backend | CustomerAiQueryService.getAuthorizedClinicalContext |
| 6. Endpoint | GET /clinical/:attentionId/context |
| 7. Herramienta LLM | getAuthorizedClinicalContext |
| 8. Vista frontend | Copiloto: selector de atenciones, antecedentes y contexto |
| 9. Tablas OLTP/fuentes | Atenciones, AntecedentesClinicos, TratamientosContratados; checklist añade PlanTratamiento, sesiones, validaciones e indicaciones |
| 10. Efectos de escritura | Lectura y auditoría |
| 11. Auditoría | CONSULTA_CONTEXTO_CLINICO |
| 12. Medidas BI | interacciones_registradas; no modifica evolución |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:93](../../../backend/tests/customerAcademicTraceability.test.ts#L93); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO PARCIALMENTE |
| 15. Deficiencias | Devuelve antecedentes/verificación y procedimientos anteriores, pero no un resumen clínico integral validado ni citas documentales completas por cada antecedente. Alertas se consultan en bandeja separada. Checklist del plan completo solo para responsable/ADMIN. |
| 16. Acción/decisión | C/B: integrar preparación documental del cierre sin ampliar ámbito; explicar que NO_REGISTRADA no significa ausencia clínica. |

Evidencia principal: [customerAiQueryService.ts:409](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L409). Estado anterior: Contexto básico y datos previos; sin checklist verificable.

## IA08 — Presentar alertas preventivas

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | detectar información relevante o inconsistencias mediante reglas deterministas. |
| 2. Objetivo funcional | Presentar alertas preventivas con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | ODONTOLOGO; RECEPCION solo AL-C04/AL-C05; ADMIN |
| 4. Evento disparador | POST /alerts/detect o herramienta; no scheduler general de las ocho ALT |
| 5. Servicio backend | CustomerAiActionService.detectDocumentationIssues |
| 6. Endpoint | POST /alerts/detect; GET /alerts; POST /alerts/:alertId/review |
| 7. Herramienta LLM | detectDocumentationIssues; getPendingAlerts |
| 8. Vista frontend | Copiloto: detectar, listar y revisar alertas |
| 9. Tablas OLTP/fuentes | AlertasIA, ValidacionesFicha, Atenciones, AntecedentesClinicos, BorradoresIA, IndicacionesPostatencion, solicitudes y sesiones |
| 10. Efectos de escritura | Alertas deduplicadas; revisión con evidencia; liberar clave al resolver |
| 11. Auditoría | Correlación/versionado de reglas; revisiones registradas en InteraccionesIA |
| 12. Medidas BI | alertas_generadas, alertas_atendidas; revisar sin crear nueva alerta |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:100](../../../backend/tests/customerAcademicTraceability.test.ts#L100); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO PARCIALMENTE |
| 15. Deficiencias | Cinco AL históricos no son ocho ALT. Dos ALT añadidas con tests unitarios, cuatro ALT ausentes y dos parciales. No hay cobertura de disparadores temporales generales. |
| 16. Acción/decisión | C/E: añadir ALT-C04 y ALT-C06 conservando AL; AL-C05 usa estado canónico Realizada. Mantener códigos históricos. |

Evidencia principal: [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340). Estado anterior: Cinco detectores no equivalentes; AL-C05 buscaba sinónimos sin Realizada.

## IA09 — Asistir registro clínico

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | estructurar notas proporcionadas por el profesional para preparar un borrador editable de ficha. |
| 2. Objetivo funcional | Asistir registro clínico con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | Odontólogo autorizado |
| 4. Evento disparador | Notas profesionales para estructuración |
| 5. Servicio backend | Ver evidencia y límites específicos; no equiparar servicio relacionado con actividad completa. |
| 6. Endpoint | No hay endpoint específico de notas → borrador de ficha |
| 7. Herramienta LLM | prepareDocumentationDraft prepara documento postatención, no ficha |
| 8. Vista frontend | Hay ficha manual y visor de borradores; no asistente específico de ficha |
| 9. Tablas OLTP/fuentes | Atenciones manual; BorradoresIA genérico |
| 10. Efectos de escritura | No existe asociación asistida/versionada borrador → campos de ficha |
| 11. Auditoría | Auditoría de borrador genérico no acredita esta actividad |
| 12. Medidas BI | No atribuir borradores genéricos a fichas asistidas |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:105](../../../backend/tests/customerAcademicTraceability.test.ts#L105); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | NO IMPLEMENTADO |
| 15. Deficiencias | No hay contrato de secciones de ficha, entrada de notas, revisión y transferencia a registro oficial supervisada. La ficha histórica queda restringida a ADMIN por exposición completa previa. |
| 16. Acción/decisión | D/C pendiente: definir contrato y reutilizar versionado con aprobación profesional. No crear hallazgos ni registrar contenido generado automáticamente. |

Evidencia principal: [customerAiActionService.ts:408](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L408). Estado anterior: Sin asistencia específica; edición manual no satisface IA09.

## IA10 — Preparar indicaciones

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | utilizar una plantilla o documento institucional autorizado y los procedimientos confirmados para generar un borrador postatención. |
| 2. Objetivo funcional | Preparar indicaciones con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | ODONTOLOGO crea/aprueba; ODONTOLOGO/ADMIN emiten con aprobación previa |
| 4. Evento disparador | Atención autorizada y solicitud de borrador |
| 5. Servicio backend | CustomerAiActionService.prepareDocumentationDraft |
| 6. Endpoint | POST /document-drafts; /:draftId/revisions; /approve; /issue; /reject |
| 7. Herramienta LLM | prepareDocumentationDraft; getDocumentDraft. Aprobar/emitir no son herramientas. |
| 8. Vista frontend | Copiloto: crear, editar, versionar, aprobar y emitir |
| 9. Tablas OLTP/fuentes | BorradoresIA, Atenciones, Profesionales, IndicacionesPostatencion, InteraccionesIA |
| 10. Efectos de escritura | Versionado → aprobación humana → emisión separada; no cambia asistencia/cierre de sesión |
| 11. Auditoría | BORRADOR_DOCUMENTAL_CREADO/REVISION/APROBADO/EMITIDO |
| 12. Medidas BI | borradores_generados por raíz; aprobados versión vigente; indicaciones_emitidas separadas |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:107](../../../backend/tests/customerAcademicTraceability.test.ts#L107); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO PARCIALMENTE |
| 15. Deficiencias | No hay plantilla institucional aprobada enlazada ni verificación de procedimientos en DetalleProcedimiento como fuente del generador. Borrador seguro transcribe datos registrados; no equivale a indicaciones institucionales completas. Aprobar placeholders sigue requiriendo revisión cuidadosa. |
| 16. Acción/decisión | C/E: quitar cuidados, evolución y contactos inventados; relectura de versión en transacción de emisión y separar emisión de cierre asistencial. D: plantilla autorizada pendiente. |

Evidencia principal: [customerAiActionService.ts:408](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L408). Estado anterior: Incluía evolución favorable/cuidados sin fuente y emitir cerraba la sesión.

## IA11 — Verificar documentación

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | ejecutar validaciones backend y mostrar requisitos pendientes. |
| 2. Objetivo funcional | Verificar documentación con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | Odontólogo; paciente solo proyección autorizada |
| 4. Evento disparador | Consulta de estado documental y revisión de atención |
| 5. Servicio backend | CustomerAiQueryService.getClinicalDocumentationStatus |
| 6. Endpoint | GET /attentions/:attentionId/documentation-status |
| 7. Herramienta LLM | getClinicalDocumentationStatus |
| 8. Vista frontend | Copiloto: última validación y campos pendientes |
| 9. Tablas OLTP/fuentes | ValidacionesFicha, Atenciones, IndicacionesPostatencion |
| 10. Efectos de escritura | La consulta no valida ni firma. Cierre histórico separado. |
| 11. Auditoría | CONSULTA_ESTADO_DOCUMENTAL |
| 12. Medidas BI | fichas_completas; no derivar de presencia de un campo |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:116](../../../backend/tests/customerAcademicTraceability.test.ts#L116); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO PARCIALMENTE |
| 15. Deficiencias | Lee validaciones previas, no ejecuta motor completo por tipo de atención. El endpoint histórico de cierre y el SP no garantizan reglas completas; SP puede crear Completa sin revisión previa completa. Se conserva como riesgo de cierre institucional. |
| 16. Acción/decisión | B/C pendiente: distinguir consulta de validación efectiva; definir política de campos/consentimientos y cierre único transaccional antes de certificar. |

Evidencia principal: [customerAiQueryService.ts:451](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L451). Estado anterior: Consulta documental existente; validación por tipo de atención incompleta.

## IA12 — Actualizar progreso de sesiones

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | actualizar automáticamente el avance administrativo del plan. |
| 2. Objetivo funcional | Actualizar progreso de sesiones con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | Coordinación; lectura por paciente y staff |
| 4. Evento disparador | Cambios oficiales de sesión y siguiente consulta/refresco |
| 5. Servicio backend | CustomerAiQueryService.getTreatmentProgress |
| 6. Endpoint | GET /treatments/:treatmentId/progress |
| 7. Herramienta LLM | getTreatmentProgress |
| 8. Vista frontend | Portal carga al seleccionar tratamiento; pantalla CUSTOMER invalida consultas tras mutaciones |
| 9. Tablas OLTP/fuentes | PlanTratamiento y SesionesTratamiento autoritativas; sin caché duplicada persistente |
| 10. Efectos de escritura | Cálculo bajo demanda; no alta clínica ni transición por conteo |
| 11. Auditoría | Consulta operativa; eventos de sesión en flujos oficiales |
| 12. Medidas BI | sesiones_completadas; tratamientos_completados requiere estado/fecha formal |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:124](../../../backend/tests/customerAcademicTraceability.test.ts#L124); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO PARCIALMENTE |
| 15. Deficiencias | Cálculo correcto en contrato unitario tras cambio; falta actualización oportuna de una pestaña de paciente ya abierta. El botón general no necesariamente recarga progreso si selectedId no cambia. No hay push ni polling documentado. |
| 16. Acción/decisión | C/E: fórmula canónica; no considerar emisión documental como sesión atendida. Pendiente refresco sincronizado y test multisesión. |

Evidencia principal: [customerAiQueryService.ts:152](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L152). Estado anterior: Varias definiciones de completitud y efecto lateral al emitir.

## IA13 — Preparar cierre del tratamiento

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | agrupar evidencias y preparar un checklist de cierre. |
| 2. Objetivo funcional | Preparar cierre del tratamiento con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | Odontólogo responsable del tratamiento; ADMIN |
| 4. Evento disparador | Consulta del checklist o contexto clínico |
| 5. Servicio backend | CustomerAiQueryService.getTreatmentClosureChecklist |
| 6. Endpoint | GET /treatments/:treatmentId/closure-checklist; incluido en /clinical/:attentionId/context cuando está autorizado |
| 7. Herramienta LLM | Indirecta mediante getAuthorizedClinicalContext; sin herramienta de cierre |
| 8. Vista frontend | Copiloto: checklist consultivo, estado formal, sesiones y pendientes |
| 9. Tablas OLTP/fuentes | TratamientosContratados, PlanTratamiento, SesionesTratamiento, Atenciones, ValidacionesFicha, IndicacionesPostatencion |
| 10. Efectos de escritura | Solo lectura. No decisión persistida, no cierre ni transición TURNED. |
| 11. Auditoría | CONSULTA_CHECKLIST_CIERRE directa; contexto externo audita una consulta |
| 12. Medidas BI | No modifica tratamientos_completados; evidencia para revisión |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:130](../../../backend/tests/customerAcademicTraceability.test.ts#L130); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO PARCIALMENTE |
| 15. Deficiencias | Checklist nuevo con pruebas unitarias; falta E2E, decisión profesional registrada y reglas institucionales de excepciones. No declara completitud por conteos. |
| 16. Acción/decisión | C/B: añadir checklist con referencias a IDs de plan, sesión, atención, validación e indicación. Presentarlo como preparación consultiva. |

Evidencia principal: [customerAiQueryService.ts:369](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L369). Estado anterior: Vista de estado no agrupaba un checklist de cierre.

## IA14 — Registrar interacciones

| Campo | Resultado |
|---|---|
| 1. Requisito académico original | registrar metadatos auditables de las actividades del agente. |
| 2. Objetivo funcional | Registrar interacciones con datos autoritativos y sin atribuciones clínicas autónomas. |
| 3. Actor autorizado | Auditoría/BI; actores reales registrados por servicios |
| 4. Evento disparador | Consulta significativa, conversación o acción supervisada |
| 5. Servicio backend | Ver evidencia y límites específicos; no equiparar servicio relacionado con actividad completa. |
| 6. Endpoint | GET /records; escrituras de auditoría internas de servicios |
| 7. Herramienta LLM | getAuthorizedAiRecords |
| 8. Vista frontend | Registros y bandejas; no panel exhaustivo de fallos |
| 9. Tablas OLTP/fuentes | InteraccionesIA, AlertasIA, BorradoresIA, SolicitudesReprogramacionCustomer; Fact_InteraccionIACustomer |
| 10. Efectos de escritura | Auditoría de eventos, alertas y borradores; múltiples clases de grano diferente |
| 11. Auditoría | Correlación, recurso, tipo/resultado; revisión con usuario/profesional |
| 12. Medidas BI | interacciones_registradas, alertas_generadas/atendidas, borradores_generados/aprobados |
| 13. Pruebas existentes y añadidas | [customerAcademicTraceability.test.ts:52](../../../backend/tests/customerAcademicTraceability.test.ts#L52); suites históricas P01–P32/piloto/E2E según el inventario, sin ejecución de escritura en esta auditoría. |
| 14. Resultado | IMPLEMENTADO PARCIALMENTE |
| 15. Deficiencias | Chats staff sin idPersona pueden no persistir; fallos no se registran integralmente; actor_orientado solo paciente/odontólogo confunde recepción. /records exige idPersona al odontólogo aunque su token normalmente carece de ella. BI desplegado no coincide con repositorio. |
| 16. Acción/decisión | C/E: evitar auditoría duplicada del RAG interno, correlacionar y minimizar texto; ETL cuenta raíces y conserva Resuelta como atendida. Pendiente auditoría completa de fallos/roles y despliegue. |

Evidencia principal: [customerAiPersistenceService.ts:74](../../../backend/src/services/customerAiPersistenceService.ts#L74). Estado anterior: RAG añadía una interacción por búsqueda interna; versiones duplicaban medida de borradores en SQL anterior.

## Cobertura frontend y pruebas

[CustomerPatientPortalPage.tsx:114](../../../frontend/src/modules/customer/pages/CustomerPatientPortalPage.tsx#L114) y [CustomerAiStaffWorkspacePage.tsx:355](../../../frontend/src/modules/customer/pages/CustomerAiStaffWorkspacePage.tsx#L355) consumen el cliente [customerAiAgentApi.ts:1](../../../frontend/src/modules/customer/services/customerAiAgentApi.ts#L1). Los tests F01–F30 prueban principalmente contratos de fetch/credenciales, no 30 recorridos React con SQL. No reemplazan una prueba de navegación autenticada.
