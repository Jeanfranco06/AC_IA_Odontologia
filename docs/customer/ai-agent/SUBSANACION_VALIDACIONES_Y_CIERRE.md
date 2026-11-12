# Validaciones e integridad del cierre

Fecha: 12 de noviembre de 2026, America/Lima. Alcance verificado: entorno local aislado y datos sintéticos. **IMPLEMENTADO Y VERIFICADO se refiere a pruebas técnicas en Test, no a habilitación institucional ni certificación clínica de Gemini.** No se ejecutaron escrituras, ETL ni migraciones sobre NexoSaludDB o NexoSalud_Mart operativas.

El corpus oficial, las políticas por servicio, las ventanas de confirmación, las plantillas y los protocolos de derivación deben ser aprobados por responsables reales. Los registros publicados por los fixtures están marcados como sintéticos y solo existen en Test. El LLM externo permanece bloqueado en la certificación; las pruebas del proveedor usan dobles explícitos.

## Política aprobada y revisión vigente

PoliticasCustomerIA admite Borrador → Revisada por odontólogo activo → Publicada por ADMIN. Exige procedencia y versión; DOCUMENTACION se vincula a un servicio y a campos soportados. La publicación no convierte el fixture en política clínica real. La falta de política produce bloqueo explícito; no hay listado universal de campos clínicos inventados.

ValidacionesFicha registra revisión, política, resultado, pendientes, hash de contenido y revision_ficha. El trigger [11_version_ficha_clinica.sql:1](../../../database/customer/11_version_ficha_clinica.sql#L1) incrementa revisión al cambiar campos de ficha, no por un mero cambio de estado. La validación nueva no reescribe la historia. Cierre exige la última validación efectiva y contenido actual, no que alguna validación histórica haya sido Completa.

## Borrador y ficha oficial

BORRADOR_FICHA_CLINICA se distingue del borrador postatención. Conserva notas originales, secciones, método, advertencias y revisión base. Propuesta del LLM: cada fragmento debe existir literalmente en las notas; JSON nulo, claves ajenas e invenciones se rechazan antes de persistir. Edición humana crea versión. La transferencia requiere confirmación diferenciada, versión actual no rechazada y ficha sin cambios/cierre. Motivo y alergias admiten 300 caracteres; restantes secciones 500, en concordancia con SQL. Nunca se truncó texto clínico para hacerlo caber.

## Estados y transacciones

Una sesión completada administrativamente requiere estado_asistencial=Realizada y estado_cierre=Cerrada. Asistió/Realizado describen la atención, no una transición automática a TURNED. Emitir indicaciones deja asistencia/cierre intactos.

[08_cierre_documental_seguro.sql:1](../../../database/customer/08_cierre_documental_seguro.sql#L1) reemplaza el cierre que fabricaba Completa. Comprueba identidad profesional, política publicada, campos, indicaciones/procedimiento configurados y revisión vigente. [13_cierre_tratamiento_seguro.sql:1](../../../database/customer/13_cierre_tratamiento_seguro.sql#L1) exige inicio efectivo, plan real, todas las sesiones realizadas/cerradas, última validación vigente y profesional responsable. Servicio y auditoría se ejecutan dentro de la transacción; reintentos conservan identidad.

El servicio formal añade comprobación de hash y derivaciones pendientes, evidencia y confirmación humana: [customerCompletionService.ts:287](../../../backend/src/modules/customer/ai-agent/services/customerCompletionService.ts#L287). Inasistencia/cancelación no se resuelve artificialmente como completada. La transición TURNED se delega al procedimiento existente y considera otros tratamientos activos de la persona.

## Fechas y datos históricos

Se detectaron textos SQL desplegados con mojibake y uso de hora local frente a fechas UTC del backend. Scripts canónicos se despliegan UTF-8 y usan UTC en las operaciones nuevas. [12_catalogos_estados_utf8.sql:1](../../../database/customer/12_catalogos_estados_utf8.sql#L1) mantiene CHECK de estados reales. La reparación de texto se aplicó exclusivamente a fixtures sintéticos Test. [14_evento_asistencial_utc.sql:1](../../../database/customer/14_evento_asistencial_utc.sql#L1) evita inventar llegada/inicio retrospectivos al registrar finalización; duraciones desconocidas permanecen desconocidas. No se migraron fechas ni estados operativos.

## Evidencias

Pruebas SQL: cierre sin política rechazado, bypass SQL rechazado, validación efectiva, cambio de ficha después de validar bloqueado, cierre de sesión, progreso, cierre formal Completado y reintento idempotente: [customerCompletionIntegration.test.ts:1](../../../backend/tests/customerCompletionIntegration.test.ts#L1). Navegador: notas/secciones/versión/transferencia, aprobación/emisión y cierre supervisado según resultado detallado de la suite E2E. No se certifica juicio clínico por estos casos sintéticos.
