# IA14 — Registro auditable de interacciones

## Prueba desde el portal

1. Como Administración, abrir el espacio institucional y **Auditoría de interacciones**. La vista consulta `/api/customer/ai-agent/records` con paginación estable, de más reciente a más antiguo.
2. Realizar una consulta al asistente en otra sesión de paciente u odontólogo y pulsar **Actualizar eventos**.
3. Identificar el nuevo evento por su identificador, tipo, actor, estado, versión y correlación. Cuando hay un contexto seleccionado y autorizado, también se guardan sus referencias de tratamiento, sesión y atención.
4. Consultar la auditoría de nuevo: esta lectura no crea otra interacción.
5. Una aprobación, emisión o cierre profesional autorizado debe tener su propio evento. Compartir una correlación no convierte acciones distintas en duplicados.

Administración consulta metadatos institucionales; odontólogos y Recepción solo sus propios eventos por usuario institucional, y pacientes solo los asociados a su identidad. Una identidad institucional ausente se rechaza antes de consultar. No se crea un rol de Auditoría con acceso indiscriminado al expediente.

## Correcciones realizadas

- El respaldo RAG produce un desenlace de conversación recuperada, en vez de registrar primero fracaso y después respuesta. Si una referencia es revocada, se registra solo el fracaso; no se anticipa un evento de éxito.
- Las consultas internas del chat usan `audit:false`: la búsqueda operativa y la comprobación documental ya no generan un segundo evento de consulta además de la conversación. Las acciones supervisadas mantienen su evento propio.
- La comprobación documental directa registra metadatos, sin crear una validación clínica ni atribuir revisión humana. Preparar un borrador tampoco se etiqueta como aprobación.
- La escritura común reutiliza el evento con la misma correlación, actor, tipo y referencias al reintentarlo. Para conversaciones agrupa los tipos de desenlace. Utiliza lectura y escritura en transacción Serializable y reintentos acotados de conflictos; dentro de una operación supervisada utiliza su transacción existente.
- Cada solicitud nueva de chat tiene una correlación nueva. Dos consultas independientes con el mismo texto siguen siendo actividades distintas; no se compara ni conserva el mensaje para deduplicar.
- Las consultas rechazadas antes de llamar al proveedor también generan un evento mínimo. No se vinculan identificadores de un contexto que no se autorizó.
- La capa de persistencia no copia consulta ni respuesta libre a la interacción. Los motivos de reprogramación, descarte o revisión permanecen en su registro de origen, sin duplicarlos en el evento analítico. Las referencias de sesión, atención y tratamiento se comprueban contra el paciente.
- Se conserva el actor institucional y se atribuye revisor solo cuando la operación representa una revisión humana explícita.
- Las búsquedas RAG directas también identifican a los actores institucionales; las búsquedas internas del chat quedan cubiertas por el evento de conversación.

La vista omite conversaciones, respuestas, notas clínicas, motivos y credenciales, incluidos los textos libres que pudieran existir en registros históricos. Estos registros no se borraron ni se reescribieron. La fecha histórica SQL se muestra sin atribuirle una zona horaria que el almacenamiento no acredita.

## Relación con BI

El ETL conserva el grano `ClaseEventoIA + id_origen_ia`. Interacciones, alertas y borradores son clases de evento diferentes; su presencia conjunta no constituye una conversación duplicada. El total de interacciones incluye consultas y acciones auditadas, por lo que no equivale exclusivamente al número de mensajes del chat. El Data Mart refleja su última carga, mientras que la vista de auditoría consulta el OLTP vigente.

## Evidencia de verificación

- Compilaciones de backend y frontend correctas.
- 119 pruebas backend: trazabilidad, auditoría, orquestador, seguridad, preguntas generales y conocimiento institucional.
- 40 pruebas frontend: vista de auditoría, espacio institucional, contratos y controles documentales y de cierre.
- Total: 159 pruebas correctas. Los reintentos, conflictos y desenlaces se verificaron con persistencia simulada; no se ejecutó una prueba de concurrencia de escritura en SQL Server.
- Consulta de solo lectura en NexoSaludDB: 2.122 interacciones, 114 eventos de conversación y cero correlaciones no nulas con más de un evento de conversación al momento de la comprobación.

No se generaron eventos de prueba en la base real, no se eliminaron históricos y no se ejecutó una carga del Data Mart.
