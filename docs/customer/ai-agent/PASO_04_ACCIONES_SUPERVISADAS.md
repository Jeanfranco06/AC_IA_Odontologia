# Paso 4 — Acciones supervisadas y trazabilidad

## Estado

Implementado en el backend Customer AI Agent. El agente solo prepara la solicitud; recepción/administración puede revisarla, aprobarla y, en una operación humana separada, aplicarla usando el procedimiento oficial CUSTOMER `dbo.usp_ReprogramarSesionTratamiento`. La solicitud recibida o aprobada no cambia por sí sola la agenda.

## Qué se incorporó

- Modelo `SolicitudesReprogramacionCustomer` y migración con estado, responsable, fechas, correlación y clave de idempotencia.
- Columna/index de idempotencia para `BorradoresIA`.
- Rol institucional `RECEPCION` para operaciones de agenda y alertas operativas.
- Servicio [CustomerAiActionService](../../../backend/src/modules/customer/ai-agent/services/customerAiActionService.ts) con prepare/confirm, revisión de solicitudes, alertas y ciclo de borradores.
- Adaptador [CustomerSchedulingService](../../../backend/src/modules/customer/ai-agent/services/customerSchedulingService.ts) sobre el procedimiento oficial; conserva fecha anterior, actualiza la atención vinculada e inserta `EventosSesion.tipo_cambio = 'REPROGRAMACION'`.
- Endpoints supervisados en [routes.ts](../../../backend/src/modules/customer/ai-agent/routes.ts).
- Herramientas Gemini de lectura/preparación. Las operaciones de aprobar, rechazar, revisar y aplicar no se exponen como herramientas del modelo.
- Fixture local ampliado en [seed-customer-ai-test-data.sql](../../../backend/scripts/seed-customer-ai-test-data.sql) con una segunda sesión demostrable.

## Flujos

### Solicitud de reprogramación

1. Paciente autenticado solicita `REQUEST_RESCHEDULE` para una sesión propia, futura, pendiente y posterior a la primera sesión.
2. El backend devuelve un resumen y un token temporal de confirmación; no persiste todavía una solicitud.
3. El paciente confirma. Se registra una interacción y una solicitud `Pendiente` con correlación e idempotencia.
4. Recepción o administración puede pasarla a `En_Revision`, `Aprobada`, `Rechazada` o `Cancelada`.
5. Solo después de aprobación humana, recepción puede elegir un horario `Disponible` y aplicarlo desde un endpoint institucional separado. El backend vuelve a comprobar disponibilidad/solapamiento y excluye slots vinculados a una reserva PAYER.
6. El adaptador invoca `dbo.usp_ReprogramarSesionTratamiento` parametrizado dentro de una transacción serializable, compara la fecha anterior devuelta, vincula el horario a la sesión y marca `Aplicada` solo si operación y auditorías concluyen.
7. El procedimiento oficial inserta `REPROGRAMACION`, evento que consume el ETL CUSTOMER. Solicitudes pendientes/aprobadas no incrementan esa medida.

Repetir la confirmación con la misma clave firmada y acotada al paciente devuelve la misma solicitud. Solicitud e interacción se crean en una transacción; la restricción única cubre reintentos concurrentes. Las revisiones institucionales usan transiciones explícitas y se auditan atómicamente.

### Alertas determinísticas

`POST /alerts/detect` genera alertas con deduplicación por entidad y tipo:

- `AL-C01`: validación de ficha con campos pendientes.
- `AL-C02`: atención asistida sin cierre documental.
- `AL-C03`: indicación postatención pendiente de aprobación.
- `AL-C04`: solicitud de reprogramación pendiente.
- `AL-C05`: sesión completada sin una atención enlazada como asistida.

Cada alerta nueva conserva clave lógica SHA-256, correlación y versión de regla; un índice único filtrado evita duplicados concurrentes. `Resuelta` y `Descartada_Justificada` son estados distintos: resolver libera la clave para admitir una ocurrencia posterior; descartar conserva la supresión de esa ocurrencia. Toda revisión requiere responsable y evidencia. Odontología solo ve recursos de su ámbito; recepción ve/gestiona únicamente alertas operativas (`AL-C04`/`AL-C05`); administración conserva la supervisión global.

### Borradores documentales

El backend produce un resumen no prescriptivo con estado `Generado` y revisión humana obligatoria. Se puede consultar, revisar como nueva versión y aprobar o rechazar por un odontólogo habilitado. La aprobación usa actualización condicional de la versión vigente para evitar doble aprobación. No se publica automáticamente al paciente (`issuedToPatient: false`).

## Seguridad y límites

- Todas las rutas requieren token firmado por `AI_AGENT_SESSION_SECRET`.
- Las comprobaciones de ámbito se hacen con el principal autenticado y relaciones de base de datos, no con un `patientId` enviado por el cliente.
- Las operaciones de escritura se validan en el servicio y usan Prisma; el modelo no recibe SQL ni permisos privilegiados.
- Los tokens de confirmación duran 15 minutos y están vinculados a paciente, sesión, acción y clave de idempotencia.
- No se implementa reprogramación autónoma del agente. La aplicación humana institucional posterior a la aprobación sí está implementada mediante el procedimiento oficial descrito arriba. Tampoco se implementan envío de correo/WhatsApp, emisión de diagnóstico ni prescripción.

## Rutas principales

```text
POST /api/customer/ai-agent/actions/prepare
POST /api/customer/ai-agent/actions/confirm
GET  /api/customer/ai-agent/reschedule-requests
POST /api/customer/ai-agent/reschedule-requests/:requestId/review
POST /api/customer/ai-agent/reschedule-requests/:requestId/apply
POST /api/customer/ai-agent/alerts/detect
GET  /api/customer/ai-agent/alerts
POST /api/customer/ai-agent/alerts/:alertId/review
POST /api/customer/ai-agent/document-drafts
GET  /api/customer/ai-agent/document-drafts/:draftId
POST /api/customer/ai-agent/document-drafts/:draftId/revisions
POST /api/customer/ai-agent/document-drafts/:draftId/approve
POST /api/customer/ai-agent/document-drafts/:draftId/reject
```

## Validación

Se validan por separado esquema/migraciones, compilación, suite del agente y suite completa. La verificación real de Gemini fue una llamada sintética del Paso 3; acciones CUSTOMER funcionan aun con Gemini apagado. El fixture local permite repetir el ciclo de agenda. La ruta `apply` depende del procedimiento oficial y debe considerarse probada solo tras una ejecución controlada con ese fixture.

Las pruebas de autenticación, roles, argumentos, límites, drafts e integración se ejecutan automáticamente. Los escenarios que requieren datos de ficha/sesión en estados específicos deben ejecutarse con el fixture antes de declarar la matriz P01–P32 totalmente certificada. `InteraccionesIA`, `AlertasIA` y `BorradoresIA` mantienen las métricas existentes; una solicitud no cuenta como sesión ni reprogramación efectiva; el evento oficial solo suma al aplicarse.

## Siguiente integración segura

La interfaz definitiva y la publicación al paciente siguen fuera de alcance. El esquema actual no identifica sillones/unidades dentales como recursos separados; se valida franja disponible y solapamiento por profesional con las reglas existentes. Para colisiones por sillón se necesita incorporar ese recurso al contrato oficial de agenda.
