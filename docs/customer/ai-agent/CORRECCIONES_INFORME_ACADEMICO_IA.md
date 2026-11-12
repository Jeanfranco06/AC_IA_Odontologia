# Correcciones del informe académico — texto definitivo y registro de cambios

El encargo reproduce los requisitos IA y ALT y la denominación, pero no entrega los párrafos literales completos de las seis secciones ni un archivo editable del informe académico. No se encontró ese informe en DOCX/PDF entre los archivos visibles del repositorio. Se usa como texto original únicamente el aportado por el usuario; donde falta, se indica expresamente. No se modifica un documento inexistente.

## Texto completo listo para copiar y pegar

### 1. Denominación y descripción general del agente

**Agente Inteligente de Atención y Seguimiento Odontológico: Asistencia al Paciente y Copiloto Clínico-Documental.**

El agente se sitúa principalmente en la etapa CUSTOMER del recorrido BUYER → LEAD → PAYER → CUSTOMER → TURNED. Su diseño comprende asistencia administrativa al paciente y apoyo documental al odontólogo. La implementación disponible permite consultar información autorizada, preparar solicitudes de reprogramación, recuperar indicaciones aprobadas y emitidas, consultar contexto documental, gestionar determinadas alertas y revisar borradores. La preparación de un checklist de cierre es consultiva y no constituye alta clínica ni transición formal a TURNED.

El alcance de diseño y el estado de implementación se distinguen en las tablas siguientes. Las funciones previstas conservan su condición de propuesta; su inclusión no acredita disponibilidad operativa. La revisión de código y las pruebas de contrato no sustituyen la validación integral en un entorno aislado. No se afirma la realización de pilotos clínicos con pacientes reales ni la aprobación institucional de las plantillas incluidas como demostración.

### 2. Intervenciones y actividades del agente

| Código | Actividad y actor | Alcance implementado y condición pendiente |
|---|---|---|
| IA01 | Consultar cronograma — paciente | Consulta las sesiones propias, sus fechas vigentes y sus estados registrados desde el portal o mediante herramientas autorizadas. La validación integral autenticada permanece pendiente. |
| IA02 | Consultar progreso — paciente | Calcula avance administrativo desde el plan vigente y las sesiones realizadas y cerradas. No representa evolución clínica ni acredita cierre del tratamiento. La conciliación integrada por tratamiento está pendiente. |
| IA03 | Solicitar agendamiento — paciente | Se propone solicitar la programación de sesiones del plan que aún no estén agendadas. Existe un procedimiento de agenda CUSTOMER, pero falta integrarlo con un contrato de solicitud, confirmación y aplicación supervisada del paciente. Esta actividad no se considera cubierta por la reprogramación. |
| IA04 | Solicitar reprogramación — paciente y recepción | Prepara una propuesta para una sesión elegible. Tras confirmación explícita del paciente se registra una solicitud para revisión institucional. Solo la aplicación humana aprobada sobre disponibilidad válida modifica la agenda. La prueba transaccional integral está pendiente. |
| IA05 | Resolver preguntas generales — paciente | Dispone de recuperación documental con restricciones de acceso, vigencia y referencias. Su uso institucional depende de documentos auténticos revisados y publicados por responsables autorizados. Las plantillas de demostración no acreditan políticas oficiales. Ante falta de evidencia debe abstenerse. |
| IA06 | Explicar indicaciones — paciente | Recupera indicaciones propias vigentes, aprobadas y emitidas para presentarlas y explicarlas de manera limitada. La explicación no debe cambiar dosis, frecuencia, duración ni significado; una ambigüedad requiere intervención profesional. La fidelidad de las respuestas generadas exige evaluación adicional. |
| IA07 | Preparar contexto — odontólogo | Recupera contexto documental autorizado, antecedentes registrados y su verificación, alergias documentadas y procedimientos previos disponibles. La falta de un dato no demuestra ausencia clínica. El profesional debe comprobar el contexto antes de utilizarlo. |
| IA08 | Presentar alertas — odontólogo y personal autorizado | Ejecuta a demanda reglas documentales y operativas identificadas en la tabla de alertas. Los cinco detectores AL históricos no cubren por sí solos las ocho alertas ALT propuestas. Las alertas requieren revisión humana y no producen decisiones terapéuticas. |
| IA09 | Asistir registro clínico — odontólogo | Se propone estructurar notas proporcionadas por el profesional en un borrador editable de ficha, asociado a la atención y sujeto a revisión. La asistencia específica de ficha no está implementada; la edición manual y el borrador postatención no la sustituyen. |
| IA10 | Preparar indicaciones — odontólogo | Prepara un borrador documental a partir de datos e indicaciones ya registrados, con edición, versionado y aprobación profesional. La emisión al paciente es posterior y diferenciada. El uso de una plantilla institucional acreditada y su vinculación con procedimientos confirmados permanece pendiente. No genera prescripciones autónomas. |
| IA11 | Verificar documentación — odontólogo | Consulta validaciones registradas, campos pendientes y estado documental. No constituye todavía un validador integral de requisitos por tipo de atención ni permite al agente firmar o cerrar documentos autónomamente. |
| IA12 | Actualizar progreso — coordinación | Recalcula el avance administrativo al consultar las fuentes oficiales, sin duplicar un campo de progreso persistente. No cierra el tratamiento por conteos. La actualización oportuna de todas las vistas abiertas y su comprobación integrada están pendientes. |
| IA13 | Preparar cierre — odontólogo | Agrupa plan vigente, sesiones, atenciones, validaciones e indicaciones emitidas en un checklist consultivo, señalando diferencias y excepciones. Requiere confirmación profesional. No registra por sí mismo una decisión formal de cierre ni una transición a TURNED. |
| IA14 | Registrar interacciones — auditoría y BI | Registra metadatos de consultas y acciones, alertas y borradores con correlación cuando el flujo la proporciona. Las consultas internas del chat no deben duplicar la conversación. La auditoría integral de fallos y roles, y la conciliación del Data Mart desplegado, permanecen pendientes. |

### 3. Arquitectura funcional y permisos

La solución utiliza React y TypeScript en la presentación, Node.js y Express en la aplicación, Prisma para acceso relacional y SQL Server para el procesamiento transaccional y analítico. Un orquestador integra Gemini mediante herramientas autorizadas; el modelo no recibe permisos para aprobar documentos, emitir indicaciones ni aplicar cambios de agenda. La recuperación documental utiliza un índice léxico y un almacén local de documentos versionados, separado de la historia clínica.

El backend valida los permisos y la pertenencia de los recursos. El paciente accede a información propia. El odontólogo consulta atenciones asignadas o tratamientos de su responsabilidad. Recepción gestiona solicitudes y alertas operativas; no recibe contexto clínico reservado. Administración supervisa las operaciones habilitadas. Los endpoints históricos que devuelven expedientes completos se restringen a administración mientras se completa su separación por recurso y rol; ello limita temporalmente la edición clínica histórica desde otros perfiles. La existencia de rutas de interfaz no sustituye la autorización del servidor.

El uso del proveedor externo requiere configuración y habilitación explícitas, además de autorización institucional para el tratamiento externo de los datos. Dichas variables de configuración son controles técnicos y no constituyen por sí mismas prueba de consentimiento, habilitación normativa o un acuerdo institucional.

### 4. Interfaces, alertas y controles

El portal del paciente presenta tratamientos, sesiones, avance administrativo, solicitudes e indicaciones emitidas, además del acceso conversacional sujeto a disponibilidad del proveedor. El espacio institucional permite seleccionar atenciones autorizadas, recuperar contexto, consultar estado documental y checklist de cierre, revisar alertas y gestionar borradores. La selección de atención está disponible mediante una lista; los identificadores internos no deben ser necesarios para el paciente.

Las solicitudes preparadas se distinguen de las confirmadas y de los cambios aplicados. Un borrador aprobado no es todavía una indicación emitida. La emisión de un documento no acredita asistencia ni cierre clínico de una sesión. Las alertas documentales son avisos para revisión y no diagnósticos, prescripciones o evaluaciones automáticas de seguridad de un tratamiento.

El sistema no acredita un servicio de urgencias de 24 horas ni una derivación automática por mostrar un aviso de contacto. Solo deben publicarse contactos y políticas respaldados por fuentes verificadas. La evaluación visual realizada cubre el acceso público y dicho aviso; los recorridos clínicos autenticados completos requieren un entorno aislado adicional.

### 5. Alertas preventivas ALT-C01–ALT-C08

| Código | Alerta y destinatario | Estado y alcance |
|---|---|---|
| ALT-C01 | Sesión próxima sin confirmación — recepción/paciente | Propuesta. Requiere estado oficial de confirmación y ventana temporal institucional. No se infiere inasistencia. |
| ALT-C02 | Sesión vencida sin desenlace — recepción | Propuesta pendiente de implementación. Debe solicitar revisión del resultado sin asignar automáticamente inasistencia. AL-C02 corresponde a otra regla. |
| ALT-C03 | Tratamiento activo con sesiones sin agendar — coordinación | Propuesta pendiente. Requiere detectar sesiones previstas sin programación y conectarlas con la futura solicitud supervisada IA03. |
| ALT-C04 | Alergia o antecedente documentado para revisión — odontólogo | Regla documental implementada a demanda: detecta presencia de alergias o antecedentes registrados. No determina contraindicaciones ni interacciones farmacológicas. Validación integral pendiente. |
| ALT-C05 | Campos obligatorios faltantes — odontólogo | Implementación parcial mediante AL-C01: presenta campos pendientes de una validación registrada. Falta verificar requisitos completos por tipo de atención y su integración con el bloqueo de cierre. |
| ALT-C06 | Borrador postatención sin aprobación — odontólogo | Regla implementada a demanda sobre borradores vigentes pendientes. Identifica borrador y versión para revisión, sin emisión automática. No presupone una política de antigüedad. Validación integral pendiente. |
| ALT-C07 | Tratamiento con sesiones gestionadas sin cierre — odontólogo | Propuesta pendiente de detector. El checklist consultivo no sustituye esta alerta ni resuelve excepciones o una decisión profesional. |
| ALT-C08 | Consulta sobre síntoma o complicación — profesional responsable | Implementación parcial de límites y orientación de contacto. La detección institucional con derivación, notificación y seguimiento permanece propuesta, condicionada a un protocolo aprobado. No se promete un tiempo de respuesta. |

Los códigos históricos se conservan: AL-C01 identifica validación de ficha con pendientes; AL-C02, atención asistida sin cierre documental; AL-C03, indicación pendiente de aprobación; AL-C04, solicitud de reprogramación pendiente; y AL-C05, sesión realizada sin atención asistida enlazada. Esta nomenclatura no es intercambiable con ALT-C01–ALT-C08.

### 6. Protección de datos

El tratamiento de información debe limitarse a los datos necesarios para la finalidad autorizada, con autenticación, control de acceso por rol y recurso, trazabilidad y revisión humana. Los documentos de conocimiento general deben mantenerse separados de la historia clínica y someterse a revisión y publicación por responsables identificables. La auditoría debe priorizar metadatos y evitar conservar texto clínico innecesario. El envío de datos a un proveedor externo requiere una base institucional documentada y controles apropiados; una bandera técnica no acredita dicha autorización. Persisten necesidades de endurecimiento de credenciales, retención, sesiones y acceso administrativo. Esta descripción no constituye certificación legal, consentimiento de pacientes ni autorización para uso clínico productivo.

## Registro de modificaciones y fundamento

### Denominación, arquitectura, interfaces y protección de datos

| Sección | Texto original disponible | Problema | Evidencia | Corrección y motivo | Naturaleza |
|---|---|---|---|---|---|
| Denominación/general | Denominación proporcionada en el apartado 2 del encargo; párrafo completo del informe no suministrado | No puede atribuirse despliegue completo a un diseño | Matrices IA/ALT y resultados de verificación | Se conserva la denominación y se distingue alcance implementado del previsto | Mixta |
| Arquitectura/permisos | Párrafo original no suministrado; lista tecnológica del apartado 2 | Permisos del agente no protegían todas las rutas históricas; configuración no prueba autorización externa | policies.ts, authContext.ts, index.ts, rutas CUSTOMER/patient-auth | Se describe el control real y la restricción temporal de expedientes completos | Implementada con pendientes |
| Interfaces/controles | Descripciones y criterios de apartados 8 y 18; no hay párrafo literal completo | Guardias/contactos, firma y cierre se sobreafirmaban | Portal y emisión en servicio; inspección visual | Se diferencia aprobación, emisión, asistencia y cierre; se eliminan promesas sin fuente | Implementada parcialmente |
| Protección de datos | Párrafo original no suministrado | No hay prueba de consentimiento, pilotos reales, retención ni contrato externo | Flags del orquestador y metadatos de auditoría | Se formula como controles y obligaciones pendientes, sin certificación normativa | Mixta |

### Actividades IA: original, problema, evidencia y texto corregido

#### IA01 — Consultar cronograma

- **Texto original aportado:** «leer sesiones vigentes y mostrar próximas sesiones y estados.»
- **Problema identificado:** Hay camino de producto y aislamiento en código; falta E2E autenticado SQL aislado. No inventar estados desde una atención asistida.
- **Evidencia:** [customerAiQueryService.ts:88](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L88).
- **Texto corregido definitivo:** fila IA01 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** C: devolver estados persistidos e incluir Reprogramada en próximas sesiones. B: limitar la afirmación de verificación.
- **Implementada o propuesta:** IMPLEMENTADO SIN EVIDENCIA SUFICIENTE; la fila distingue expresamente los componentes previstos.

#### IA02 — Consultar progreso del tratamiento

- **Texto original aportado:** «resumir sesiones realizadas y pendientes, proporcionando avance administrativo.»
- **Problema identificado:** No se ejecutó reconciliación por tratamiento en SQL aislado; sesiones de planes anteriores no tienen política de sustitución explícita. Si realizadas exceden plan, el porcentaje puede superar 100 y requiere revisar datos.
- **Evidencia:** [customerAiQueryService.ts:152](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L152).
- **Texto corregido definitivo:** fila IA02 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** C/E: alinear completada a Realizada Y Cerrada, plan vigente más reciente y cero sesiones sin denominador ficticio.
- **Implementada o propuesta:** IMPLEMENTADO SIN EVIDENCIA SUFICIENTE; la fila distingue expresamente los componentes previstos.

#### IA03 — Solicitar agendamiento de sesión

- **Texto original aportado:** «consultar disponibilidad y solicitar programación de una sesión del plan.»
- **Problema identificado:** Existe infraestructura SQL, no solicitud con confirmación, elegibilidad ordinal y contrato de estados. Fecha de sesión es obligatoria: las sesiones faltantes se infieren del plan, no de filas sin horario. El SP debe endurecer inexistencia y compatibilidad del slot antes de exponerlo.
- **Evidencia:** [01_migracion_oltp_customer.sql:1093](../../../database/customer/01_migracion_oltp_customer.sql#L1093).
- **Texto corregido definitivo:** fila IA03 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** D/C pendiente: diseñar contrato de solicitud y adaptar agenda oficial; no duplicar reserva PAYER. No exponer SP incompleto al LLM.
- **Implementada o propuesta:** IMPLEMENTADO PARCIALMENTE; la fila distingue expresamente los componentes previstos.

#### IA04 — Solicitar reprogramación

- **Texto original aportado:** «validar elegibilidad y disponibilidad, y preparar una propuesta de cambio.»
- **Problema identificado:** Transacciones y SP en código; faltan pruebas reales de solapamiento, concurrencia y horario SQL. La confirmación repetida tras cambiar la sesión aún puede devolver conflicto. La resolución por ordinal debe desambiguar tratamientos.
- **Evidencia:** [customerAiActionService.ts:122](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L122).
- **Texto corregido definitivo:** fila IA04 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** C/E: eliminar conversión silenciosa de ID a ordinal, rechazar ordinal ambiguo, reintento de aplicación al mismo slot sin otro evento, corregir mensaje PREPARED.
- **Implementada o propuesta:** IMPLEMENTADO PARCIALMENTE; la fila distingue expresamente los componentes previstos.

#### IA05 — Resolver preguntas generales

- **Texto original aportado:** «consultar contenido institucional aprobado y proporcionar orientación no diagnóstica.»
- **Problema identificado:** El corpus incluido se autodenominaba oficial y se autopublicaba con identidades 1. No existe acreditación externa de esas fuentes. Faltan E2E con documentos institucionales auténticos y verificación determinista de todas las citas de la salida.
- **Evidencia:** [durableKnowledgeService.ts:46](../../../backend/src/modules/customer/knowledge-base/durableKnowledgeService.ts#L46).
- **Texto corregido definitivo:** fila IA05 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** C/E: desactivar semilla automática, poner v1 autogeneradas identificables en revisión al cargar; exigir publicación humana. D: contenido institucional pendiente.
- **Implementada o propuesta:** IMPLEMENTADO PARCIALMENTE; la fila distingue expresamente los componentes previstos.

#### IA06 — Explicar indicaciones finales

- **Texto original aportado:** «recuperar indicaciones aprobadas y emitidas, y explicarlas de manera limitada.»
- **Problema identificado:** Recuperación por propiedad, vigencia y fechas existe; explicación limitada está instruida en prompt, sin garantía semántica determinista. La herramienta sin ID consulta solo la última atención, aunque una previa pudiera tener indicaciones.
- **Evidencia:** [customerAiQueryService.ts:175](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L175).
- **Texto corregido definitivo:** fila IA06 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** C/B: reforzar instrucción de no alterar dosis/frecuencia/duración y alinear indicador de disponibilidad del portal con aprobación más emisión.
- **Implementada o propuesta:** IMPLEMENTADO PARCIALMENTE; la fila distingue expresamente los componentes previstos.

#### IA07 — Preparar contexto de sesión

- **Texto original aportado:** «recuperar plan, antecedentes y datos relevantes para la atención.»
- **Problema identificado:** Devuelve antecedentes/verificación y procedimientos anteriores, pero no un resumen clínico integral validado ni citas documentales completas por cada antecedente. Alertas se consultan en bandeja separada. Checklist del plan completo solo para responsable/ADMIN.
- **Evidencia:** [customerAiQueryService.ts:409](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L409).
- **Texto corregido definitivo:** fila IA07 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** C/B: integrar preparación documental del cierre sin ampliar ámbito; explicar que NO_REGISTRADA no significa ausencia clínica.
- **Implementada o propuesta:** IMPLEMENTADO PARCIALMENTE; la fila distingue expresamente los componentes previstos.

#### IA08 — Presentar alertas preventivas

- **Texto original aportado:** «detectar información relevante o inconsistencias mediante reglas deterministas.»
- **Problema identificado:** Cinco AL históricos no son ocho ALT. Dos ALT añadidas con tests unitarios, cuatro ALT ausentes y dos parciales. No hay cobertura de disparadores temporales generales.
- **Evidencia:** [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340).
- **Texto corregido definitivo:** fila IA08 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** C/E: añadir ALT-C04 y ALT-C06 conservando AL; AL-C05 usa estado canónico Realizada. Mantener códigos históricos.
- **Implementada o propuesta:** IMPLEMENTADO PARCIALMENTE; la fila distingue expresamente los componentes previstos.

#### IA09 — Asistir registro clínico

- **Texto original aportado:** «estructurar notas proporcionadas por el profesional para preparar un borrador editable de ficha.»
- **Problema identificado:** No hay contrato de secciones de ficha, entrada de notas, revisión y transferencia a registro oficial supervisada. La ficha histórica queda restringida a ADMIN por exposición completa previa.
- **Evidencia:** [customerAiActionService.ts:408](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L408).
- **Texto corregido definitivo:** fila IA09 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** D/C pendiente: definir contrato y reutilizar versionado con aprobación profesional. No crear hallazgos ni registrar contenido generado automáticamente.
- **Implementada o propuesta:** NO IMPLEMENTADO; la fila distingue expresamente los componentes previstos.

#### IA10 — Preparar indicaciones

- **Texto original aportado:** «utilizar una plantilla o documento institucional autorizado y los procedimientos confirmados para generar un borrador postatención.»
- **Problema identificado:** No hay plantilla institucional aprobada enlazada ni verificación de procedimientos en DetalleProcedimiento como fuente del generador. Borrador seguro transcribe datos registrados; no equivale a indicaciones institucionales completas. Aprobar placeholders sigue requiriendo revisión cuidadosa.
- **Evidencia:** [customerAiActionService.ts:408](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L408).
- **Texto corregido definitivo:** fila IA10 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** C/E: quitar cuidados, evolución y contactos inventados; relectura de versión en transacción de emisión y separar emisión de cierre asistencial. D: plantilla autorizada pendiente.
- **Implementada o propuesta:** IMPLEMENTADO PARCIALMENTE; la fila distingue expresamente los componentes previstos.

#### IA11 — Verificar documentación

- **Texto original aportado:** «ejecutar validaciones backend y mostrar requisitos pendientes.»
- **Problema identificado:** Lee validaciones previas, no ejecuta motor completo por tipo de atención. El endpoint histórico de cierre y el SP no garantizan reglas completas; SP puede crear Completa sin revisión previa completa. Se conserva como riesgo de cierre institucional.
- **Evidencia:** [customerAiQueryService.ts:451](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L451).
- **Texto corregido definitivo:** fila IA11 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** B/C pendiente: distinguir consulta de validación efectiva; definir política de campos/consentimientos y cierre único transaccional antes de certificar.
- **Implementada o propuesta:** IMPLEMENTADO PARCIALMENTE; la fila distingue expresamente los componentes previstos.

#### IA12 — Actualizar progreso de sesiones

- **Texto original aportado:** «actualizar automáticamente el avance administrativo del plan.»
- **Problema identificado:** Cálculo correcto en contrato unitario tras cambio; falta actualización oportuna de una pestaña de paciente ya abierta. El botón general no necesariamente recarga progreso si selectedId no cambia. No hay push ni polling documentado.
- **Evidencia:** [customerAiQueryService.ts:152](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L152).
- **Texto corregido definitivo:** fila IA12 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** C/E: fórmula canónica; no considerar emisión documental como sesión atendida. Pendiente refresco sincronizado y test multisesión.
- **Implementada o propuesta:** IMPLEMENTADO PARCIALMENTE; la fila distingue expresamente los componentes previstos.

#### IA13 — Preparar cierre del tratamiento

- **Texto original aportado:** «agrupar evidencias y preparar un checklist de cierre.»
- **Problema identificado:** Checklist nuevo con pruebas unitarias; falta E2E, decisión profesional registrada y reglas institucionales de excepciones. No declara completitud por conteos.
- **Evidencia:** [customerAiQueryService.ts:369](../../../backend/src/modules/customer/ai-agent/services/customerAiQueryService.ts#L369).
- **Texto corregido definitivo:** fila IA13 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** C/B: añadir checklist con referencias a IDs de plan, sesión, atención, validación e indicación. Presentarlo como preparación consultiva.
- **Implementada o propuesta:** IMPLEMENTADO PARCIALMENTE; la fila distingue expresamente los componentes previstos.

#### IA14 — Registrar interacciones

- **Texto original aportado:** «registrar metadatos auditables de las actividades del agente.»
- **Problema identificado:** Chats staff sin idPersona pueden no persistir; fallos no se registran integralmente; actor_orientado solo paciente/odontólogo confunde recepción. /records exige idPersona al odontólogo aunque su token normalmente carece de ella. BI desplegado no coincide con repositorio.
- **Evidencia:** [customerAiPersistenceService.ts:74](../../../backend/src/services/customerAiPersistenceService.ts#L74).
- **Texto corregido definitivo:** fila IA14 de la tabla de intervenciones anterior, que se conserva íntegra para copiar.
- **Motivo/decisión:** C/E: evitar auditoría duplicada del RAG interno, correlacionar y minimizar texto; ETL cuenta raíces y conserva Resuelta como atendida. Pendiente auditoría completa de fallos/roles y despliegue.
- **Implementada o propuesta:** IMPLEMENTADO PARCIALMENTE; la fila distingue expresamente los componentes previstos.

### Alertas: cambios individuales

| Original aportado | Problema | Evidencia | Texto corregido definitivo | Motivo y naturaleza |
|---|---|---|---|---|
| ALT-C01 — Sesión próxima sin confirmación | Ausente: Ninguno. AL-C01 es ficha incompleta. | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT | Fila ALT-C01 de la tabla definitiva anterior | D: propuesta; acordar estado y ventana, sin inferir inasistencia. Estado: NO IMPLEMENTADO. |
| ALT-C02 — Sesión vencida sin desenlace | Ausente: Ninguno. AL-C02 es atención asistida sin cierre documental. | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT | Fila ALT-C02 de la tabla definitiva anterior | C pendiente: reglas de corte temporal y desenlaces oficiales; no marcar inasistencia. Estado: NO IMPLEMENTADO. |
| ALT-C03 — Tratamiento activo con sesiones sin agendar | Ausente: Ninguno. AL-C03 es indicación pendiente. | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT | Fila ALT-C03 de la tabla definitiva anterior | D/C: definir estado activo, ordinales faltantes y acción supervisada de programación. Estado: NO IMPLEMENTADO. |
| ALT-C04 — Alergia o antecedente que requiere revisión | Equivalencia documental limitada implementada: ALT-C04 añadido; AL-C04 conserva solicitud de reprogramación pendiente. | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT | Fila ALT-C04 de la tabla definitiva anterior | C: regla determinista de presencia. No certifica verificación clínica ni interacción farmacológica. Estado: IMPLEMENTADO SIN EVIDENCIA SUFICIENTE. |
| ALT-C05 — Campos obligatorios faltantes | Parcial: lee una validación previa, no define campos por tipo: AL-C01 parcialmente equivalente; AL-C05 trata falta de atención enlazada. | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT | Fila ALT-C05 de la tabla definitiva anterior | B/C: conservar mapeo ALT-C05 → AL-C01 parcial y completar validador institucional. Estado: IMPLEMENTADO PARCIALMENTE. |
| ALT-C06 — Borrador postatención sin aprobación | Regla implementada sin política de antigüedad añadida: ALT-C06 añadido; AL-C03 histórico solo consulta IndicacionesPostatencion. | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT | Fila ALT-C06 de la tabla definitiva anterior | C: detectar la entidad correcta sin confundir indicación pendiente y borrador IA; no emisión automática. Estado: IMPLEMENTADO SIN EVIDENCIA SUFICIENTE. |
| ALT-C07 — Tratamiento con sesiones gestionadas sin cierre | Ausente: Ninguno | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT | Fila ALT-C07 de la tabla definitiva anterior | D/C: definir excepciones y condición formal; nunca autoalta por conteo. Estado: NO IMPLEMENTADO. |
| ALT-C08 — Consulta sobre síntoma o complicación | Parcial: orientación de límites, no derivación: Sin detector/derivador institucional efectivo | [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340) y matriz ALT | Fila ALT-C08 de la tabla definitiva anterior | B/D: declarar escalamiento efectivo como propuesto y dependiente de protocolo institucional. Estado: IMPLEMENTADO PARCIALMENTE. |
