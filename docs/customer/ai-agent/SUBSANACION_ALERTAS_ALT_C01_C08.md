# Subsanación de las ocho alertas

Fecha: 12 de noviembre de 2026, America/Lima. Alcance verificado: entorno local aislado y datos sintéticos. **IMPLEMENTADO Y VERIFICADO se refiere a pruebas técnicas en Test, no a habilitación institucional ni certificación clínica de Gemini.** No se ejecutaron escrituras, ETL ni migraciones sobre NexoSaludDB o NexoSalud_Mart operativas.

El corpus oficial, las políticas por servicio, las ventanas de confirmación, las plantillas y los protocolos de derivación deben ser aprobados por responsables reales. Los registros publicados por los fixtures están marcados como sintéticos y solo existen en Test. El LLM externo permanece bloqueado en la certificación; las pruebas del proveedor usan dobles explícitos.

| Código | Condición | Destinatario | Regla y salida | Fuente y resolución | Dependencia/límite |
|---|---|---|---|---|---|
| ALT-C01 | Sesión próxima sin confirmación | Paciente propietario y recepción | Sesión futura, pendiente y dentro de ventana CONFIRMACION publicada; confirmar no modifica asistencia. | SesionesTratamiento.confirmacion_paciente y política; resuelve al confirmar o desaparecer condición. | Ventana institucional aprobada; sin ella no genera. |
| ALT-C02 | Sesión vencida sin desenlace | Recepción | Fin del horario programado ya transcurrió y el estado sigue pendiente; solicitar revisión humana. | Fecha, duración y desenlace persistido; no infiere inasistencia. | Reloj UTC; no asigna SLA ni conclusión clínica. |
| ALT-C03 | Plan activo con sesiones sin programar | Recepción/coordinación operativa | Plan vigente con cantidad prevista mayor que sesiones oficiales; deriva al flujo IA03. | Plan y sesiones reales; sin sesiones ficticias ni denominador de respaldo. | Coordinación se implementa con rol RECEPCION existente. |
| ALT-C04 | Alergia o antecedente para revisión | Odontólogo responsable; ADMIN supervisa | Alergia documentada o antecedente pendiente de verificación; muestra advertencia documental. | Fuente por atención/paciente; evidencia deduplicada; revisión/resolución profesional. | No determina contraindicación; cambios de fuente requieren nueva revisión. |
| ALT-C05 | Requisitos documentales pendientes | Odontólogo; ADMIN supervisa | Evalúa campos reales y requisitos de política vigente; explicita falta de política; no depende solo de validación antigua. | Atenciones, política y documentos; evita otra ALT-C05 cuando hay AL-C01 activa para la misma atención. | Requisitos institucionales por servicio pendientes de aprobación real. |
| ALT-C06 | Borrador postatención sin aprobación | Odontólogo; ADMIN supervisa | Borrador vigente postatención no aprobado; excluye borrador de ficha; identidad y versión. | BorradoresIA; aprobación resuelve condición y no emite automáticamente. | Sin umbral de antigüedad inventado. |
| ALT-C07 | Sesiones gestionadas sin cierre formal | Odontólogo responsable | Plan completo gestionado (cierre o excepciones oficiales) y tratamiento activo; solicitar revisión de checklist. | Plan, sesiones, estado del tratamiento; no realiza alta por conteo. | Cancelaciones/inasistencias requieren revisión y bloquean cierre completado. |
| ALT-C08 | Consulta que requiere revisión humana | Odontólogo responsable del tratamiento | Paciente puede solicitar revisión explícita; protocolo publicado puede activar derivación antes del LLM; solicitud y alerta persistidas. | Solicitud mínima por referencia/correlación, bandeja profesional, Atendida y Resuelta con evidencia. | Sin protocolo aprobado no hay clasificación automática de síntomas ni prioridad médica; no hay garantía de respuesta inmediata. |

## Implementación y disparadores

Detector académico central: [customerAlertLifecycleService.ts:1](../../../backend/src/modules/customer/ai-agent/services/customerAlertLifecycleService.ts#L1). Se ejecuta a demanda, después de acciones exitosas del agente y mediante scheduler optativo. La habilitación requiere CUSTOMER_ALERT_SCHEDULER_ENABLED=true y CUSTOMER_ALERT_SCHEDULER_USER_ID de un ADMIN activo existente. Intervalo mínimo 60 segundos; lotes de 100 tratamientos con cursor; no solapamiento dentro del proceso; índice único y clave de evidencia protegen la creación entre procesos. Un error se registra y se reintenta; nunca se infiere desenlace por fallo del detector.

Una condición activa no genera otra fila al repetirse la consulta. Las revisiones cambian estado y preservan identidad. Resuelta/Descartada_Justificada son terminales para esa evidencia. La resolución de condiciones operativas/documentales desaparecidas requiere identidad institucional y deja evidencia. ALT-C04 exige revisión humana. La bandeja es notificación interna persistente; no se afirma envío por SMS, correo ni atención en tiempo real.

## Cinco detectores históricos conservados

| Código | Semántica conservada |
|---|---|
| AL-C01 | Última validación incompleta con campos pendientes. |
| AL-C02 | Atención asistida pendiente de cierre documental; normalizado Cerrada. |
| AL-C03 | Indicación postatención pendiente de aprobación. |
| AL-C04 | Solicitud de reprogramación pendiente/en revisión. |
| AL-C05 | Sesión realizada sin evidencia de atención enlazada. |


Se mantienen códigos y significados; AL-C02 no se renombra como sesión vencida y AL-C04 no se convierte en alergia. Implementación histórica: [customerAiActionService.ts:1](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts#L1). Las ocho pruebas específicas contra SQL están en [customerCompletionIntegration.test.ts:120](../../../backend/tests/customerCompletionIntegration.test.ts#L120); el navegador verifica la bandeja, no ocho escenarios visuales independientes. Véase el alcance exacto en certificación.
