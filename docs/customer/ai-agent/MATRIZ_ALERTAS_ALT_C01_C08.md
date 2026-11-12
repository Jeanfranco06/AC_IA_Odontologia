# Matriz de alertas ALT-C01–ALT-C08

**No hay correspondencia uno a uno entre ALT y AL.** Los códigos AL-C01–AL-C05 conservan su significado histórico. Se añaden ALT-C04 y ALT-C06 sin recodificar filas antiguas. Hay 2 reglas ALT implementadas en código y probadas en contrato, 2 capacidades parciales y 4 no implementadas; **0 de las 8 se certifican de extremo a extremo**.

| Alerta del informe | Detector real | Regla real | Fuente OLTP | Destinatario | Implementación frontend | Coincidencia | Acción |
|---|---|---|---|---|---|---|---|
| ALT-C01 Sesión próxima sin confirmación | Ninguno. AL-C01 es ficha incompleta. | No hay ventana institucional ni flujo oficial de confirmación en el agente. Un estado textual Confirmada no acredita contrato de confirmación. | SesionesTratamiento; faltan contrato/confirmación verificable | Recepción/paciente previstos | No hay alerta equivalente | Ausente | D: propuesta; acordar estado y ventana, sin inferir inasistencia. |
| ALT-C02 Sesión vencida sin desenlace | Ninguno. AL-C02 es atención asistida sin cierre documental. | No hay detector temporal de vencimiento sin desenlace; AL-C05 tampoco equivale. | SesionesTratamiento y Atenciones previstos | Recepción prevista | No hay bandeja con esta regla | Ausente | C pendiente: reglas de corte temporal y desenlaces oficiales; no marcar inasistencia. |
| ALT-C03 Tratamiento activo con sesiones sin agendar | Ninguno. AL-C03 es indicación pendiente. | El plan puede prever más sesiones que las registradas, pero no hay detector ni solicitud IA03. | PlanTratamiento, TratamientosContratados, SesionesTratamiento previstos | Coordinación prevista; no existe rol COORDINACION separado | Checklist muestra diferencia de cantidades; no equivale a alerta de agenda | Ausente | D/C: definir estado activo, ordinales faltantes y acción supervisada de programación. |
| ALT-C04 Alergia o antecedente que requiere revisión | ALT-C04 añadido; AL-C04 conserva solicitud de reprogramación pendiente. | Con atención autorizada: alergias documentadas no vacías O antecedentes registrados del paciente. Mensaje exige revisión, sin determinar contraindicación. | Atenciones.alergias, AntecedentesClinicos, AlertasIA | Odontólogo de la atención; ADMIN supervisa | Detección manual y bandeja genérica del copiloto; recepción no recibe esta alerta | Equivalencia documental limitada implementada | C: regla determinista de presencia. No certifica verificación clínica ni interacción farmacológica. |
| ALT-C05 Campos obligatorios faltantes | AL-C01 parcialmente equivalente; AL-C05 trata falta de atención enlazada. | Última ValidacionesFicha con campos_pendientes y resultado diferente de Completa/Completada/Validada. | Atenciones, ValidacionesFicha, AlertasIA | Odontólogo; ADMIN | Bandeja AL-C01 y estado documental | Parcial: lee una validación previa, no define campos por tipo | B/C: conservar mapeo ALT-C05 → AL-C01 parcial y completar validador institucional. |
| ALT-C06 Borrador postatención sin aprobación | ALT-C06 añadido; AL-C03 histórico solo consulta IndicacionesPostatencion. | BorradoresIA vigente tipo BORRADOR_RESUMEN_DOCUMENTAL o BORRADOR_INDICACIONES_POSTATENCION con estado Generado/Corregido. Registra responsable por atención y mensaje con ID/versión. | BorradoresIA, Atenciones, AlertasIA | Odontólogo de atención; ADMIN | Detección manual y bandeja del copiloto; edición/versionado del borrador aparte | Regla implementada sin política de antigüedad añadida | C: detectar la entidad correcta sin confundir indicación pendiente y borrador IA; no emisión automática. |
| ALT-C07 Tratamiento con sesiones gestionadas sin cierre | Ninguno | No hay detector de todas las sesiones gestionadas, excepciones y ausencia de cierre formal. Checklist consultivo no genera esta alerta. | TratamientosContratados, sesiones, documentos y cierre previstos | Odontólogo previsto | Checklist consultivo nuevo; no alerta ALT-C07 | Ausente | D/C: definir excepciones y condición formal; nunca autoalta por conteo. |
| ALT-C08 Consulta sobre síntoma o complicación | Sin detector/derivador institucional efectivo | Prompts limitan diagnóstico y portal orienta a contacto profesional. No hay protocolo, cola de derivación, notificación ni SLA acreditados. | InteraccionesIA puede registrar conversación; no entidad de derivación efectiva | Profesional responsable previsto; destinatario no notificado automáticamente | Aviso de contacto profesional, sin teléfono ni guardia inventados | Parcial: orientación de límites, no derivación | B/D: declarar escalamiento efectivo como propuesto y dependiente de protocolo institucional. |

## Catálogo real AL-C01–AL-C05

| Código estable | Condición real | Relación académica | Destinatario y activación |
|---|---|---|---|
| AL-C01 | Última validación incompleta con campos pendientes | ALT-C05 parcial, no ALT-C01 | Odontólogo; detectar sobre atención autorizada |
| AL-C02 | asistencia = Asistió y estado_cierre_documental distinto de Completado | No equivale a ALT-C02 ni a cierre de tratamiento | Odontólogo; debe normalizarse Cerrada/Completado con contrato de cierre |
| AL-C03 | Indicación en Borrador/Pendiente_Aprobacion | Relacionada con ALT-C06, pero otra entidad | Odontólogo; consulta IndicacionesPostatencion |
| AL-C04 | Solicitud de reprogramación Pendiente/En_Revision | Sin fila ALT equivalente; no antecedentes | Recepción/ADMIN; consulta solicitudes |
| AL-C05 | Sesión Realizada sin atención vinculada con asistencia Asistió | Sin fila ALT equivalente; no campos faltantes | Odontólogo en ámbito y recepción/ADMIN; anomalía de evidencia |

## Disparadores y ciclo de vida

Detección a demanda desde endpoint/tool, no ejecución periódica garantizada. La bandeja no equivale a envío de notificación ni a confirmación por paciente. Clave SHA-256 por tipo/recurso más índice único filtrado; repetir detección devuelve la misma fila. Generada → En_Revision/Atendida/Descartada_Justificada; En_Revision → Atendida/Resuelta/Descartada_Justificada; Atendida → Resuelta. Resolver libera clave para una nueva ocurrencia; descartar mantiene supresión. Por tanto, resolver sin corregir la condición puede generar otra alerta después y debe documentarse como recurrencia, no duplicación de la misma fila. Las revisiones requieren evidencia y no crean nuevas AlertasIA.

Las nuevas ALT clínicas son de prioridad documental Media según el código, no clasificación de urgencia médica. No se inventa una ventana de antigüedad ni una interacción farmacológica. La ausencia de antecedentes no demuestra ausencia de condiciones médicas.

## ALT-C01 — Verificación

**Estado:** NO IMPLEMENTADO. **Prueba y límites:** Omitida explícitamente: contrato no disponible.

**Pendiente para cierre:** disparador positivo y negativo en SQL aislado; destinatario por rol; propiedad del recurso; repetición sin duplicar; revisión/resolución con identidad profesional. Para reglas no implementadas estos casos están pendientes, no aprobados.

## ALT-C02 — Verificación

**Estado:** NO IMPLEMENTADO. **Prueba y límites:** Omitida explícitamente; casos positivo/negativo pendientes de implementar.

**Pendiente para cierre:** disparador positivo y negativo en SQL aislado; destinatario por rol; propiedad del recurso; repetición sin duplicar; revisión/resolución con identidad profesional. Para reglas no implementadas estos casos están pendientes, no aprobados.

## ALT-C03 — Verificación

**Estado:** NO IMPLEMENTADO. **Prueba y límites:** Omitida; no se cuenta como cubierta por checklist.

**Pendiente para cierre:** disparador positivo y negativo en SQL aislado; destinatario por rol; propiedad del recurso; repetición sin duplicar; revisión/resolución con identidad profesional. Para reglas no implementadas estos casos están pendientes, no aprobados.

## ALT-C04 — Verificación

**Estado:** IMPLEMENTADO SIN EVIDENCIA SUFICIENTE. **Prueba y límites:** Positivo alergia, negativo vacío, propiedad/rol y deduplicación con Prisma simulado. Falta SQL y resolución E2E.

**Pendiente para cierre:** disparador positivo y negativo en SQL aislado; destinatario por rol; propiedad del recurso; repetición sin duplicar; revisión/resolución con identidad profesional. Para reglas no implementadas estos casos están pendientes, no aprobados.

## ALT-C05 — Verificación

**Estado:** IMPLEMENTADO PARCIALMENTE. **Prueba y límites:** Positivo validación incompleta, negativo Completa; permisos generales IA08. Falta matriz por tipo y cierre E2E.

**Pendiente para cierre:** disparador positivo y negativo en SQL aislado; destinatario por rol; propiedad del recurso; repetición sin duplicar; revisión/resolución con identidad profesional. Para reglas no implementadas estos casos están pendientes, no aprobados.

## ALT-C06 — Verificación

**Estado:** IMPLEMENTADO SIN EVIDENCIA SUFICIENTE. **Prueba y límites:** Positivo borrador, negativo inexistente, filtro de versión/estado, permisos y deduplicación simulada. Falta aprobación/resolución SQL E2E.

**Pendiente para cierre:** disparador positivo y negativo en SQL aislado; destinatario por rol; propiedad del recurso; repetición sin duplicar; revisión/resolución con identidad profesional. Para reglas no implementadas estos casos están pendientes, no aprobados.

## ALT-C07 — Verificación

**Estado:** NO IMPLEMENTADO. **Prueba y límites:** Omitida explícitamente; IA13 cubre consulta, no este detector.

**Pendiente para cierre:** disparador positivo y negativo en SQL aislado; destinatario por rol; propiedad del recurso; repetición sin duplicar; revisión/resolución con identidad profesional. Para reglas no implementadas estos casos están pendientes, no aprobados.

## ALT-C08 — Verificación

**Estado:** IMPLEMENTADO PARCIALMENTE. **Prueba y límites:** Omitida la derivación; inspección visual del aviso y límites; no certificación clínica.

**Pendiente para cierre:** disparador positivo y negativo en SQL aislado; destinatario por rol; propiedad del recurso; repetición sin duplicar; revisión/resolución con identidad profesional. Para reglas no implementadas estos casos están pendientes, no aprobados.

Evidencia: [customerAiActionService.ts:340](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L340), [customerAiActionService.ts:394](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L394), [customerAiPersistenceService.ts:197](../../../backend/src/services/customerAiPersistenceService.ts#L197), [customerAcademicTraceability.test.ts:151](../../../backend/tests/customerAcademicTraceability.test.ts#L151).
