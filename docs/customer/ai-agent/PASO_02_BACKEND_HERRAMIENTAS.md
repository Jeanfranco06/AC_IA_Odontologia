# Paso 2 — Backend y herramientas deterministas del agente CUSTOMER

Fecha: 2026-11-10. Rama: `customer`.

## Estado inicial

Se verificó el Paso 1 en `docs/customer/ai-agent/PASO_01_INFRAESTRUCTURA.md`. Ya existían las entidades `TratamientosContratados`, `PlanTratamiento`, `SesionesTratamiento`, `Atenciones`, `IndicacionesPostatencion`, `ValidacionesFicha`, `AntecedentesClinicos` y las tablas de persistencia IA. Se reutilizan Prisma y `CustomerAiPersistenceService`.

El backend no tenía middleware para estas consultas ni relación entre `Usuarios` y `Profesionales`. Se añadieron ambos elementos sin crear un cliente Prisma paralelo.

## Arquitectura

El módulo está en `backend/src/modules/customer/ai-agent/`:

- `types.ts`: contratos de respuesta, roles, errores y paginación.
- `authContext.ts`: tokens HMAC, verificación Bearer y roles.
- `validators.ts`: validación de IDs y paginación.
- `policies.ts`: autorización por paciente, tratamiento y atención.
- `services/customerAiQueryService.ts`: consultas read-only, minimización y auditoría.
- `routes.ts`: endpoints Express y errores controlados.
- `backend/src/services/staffAuthService.ts`: PBKDF2 y login institucional.
- `backend/src/routes/staffAuth.routes.ts`: login de odontólogos y administradores.

No se conectó ningún LLM, RAG ni proveedor externo.

## Herramientas

| Herramienta | Autorización | Resultado |
|---|---|---|
| `getPatientTreatments` | Paciente autenticado | Tratamientos propios y conteos operativos |
| `getTreatmentDetail` | Paciente propietario, odontólogo responsable o admin | Plan vigente, sesiones y continuidad |
| `getTreatmentSessions` | Ámbito autorizado del tratamiento | Sesiones paginadas y estados separados |
| `getUpcomingSessions` | Paciente autenticado | Solo sesiones futuras confirmadas o programadas |
| `getTreatmentProgress` | Ámbito autorizado del tratamiento | Avance operativo; porcentaje nulo sin denominador válido |
| `getApprovedAftercareInstructions` | Paciente propietario o profesional autorizado | Solo versiones vigentes, aprobadas y emitidas |
| `getAuthorizedClinicalContext` | Odontólogo autorizado o admin | Contexto documental mínimo, sin diagnósticos |
| `getClinicalDocumentationStatus` | Ámbito autorizado de la atención | Validaciones, pendientes y cierre documental |
| `getAuthorizedAiRecords` | Ámbito por rol y recurso | Alertas, borradores e interacciones minimizadas |

## Endpoints

Todos los endpoints del agente requieren `Authorization: Bearer <token>`:

```text
GET /api/customer/ai-agent/me/treatments
GET /api/customer/ai-agent/treatments/:treatmentId
GET /api/customer/ai-agent/treatments/:treatmentId/sessions?page=1&pageSize=50
GET /api/customer/ai-agent/me/upcoming-sessions
GET /api/customer/ai-agent/treatments/:treatmentId/progress
GET /api/customer/ai-agent/attentions/:attentionId/approved-instructions
GET /api/customer/ai-agent/clinical/:attentionId/context
GET /api/customer/ai-agent/attentions/:attentionId/documentation-status
GET /api/customer/ai-agent/records?page=1&pageSize=50
POST /api/staff-auth/login
```

Respuesta exitosa: `{ success: true, data, meta: { source: "NexoSaludDB", correlationId } }`.

Errores: `{ success: false, error: { code, message } }`, con códigos `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_INPUT`, `CONFLICT`, `SERVICE_UNAVAILABLE` o `INTERNAL_ERROR`.

## Seguridad

- La identidad del paciente proviene del token, nunca de un `id_persona` de URL o body.
- Recursos ajenos responden `NOT_FOUND` para no revelar su existencia.
- El odontólogo debe tener relación con la atención, tratamiento responsable o profesional asignado.
- Se seleccionan campos explícitos y no se devuelven objetos Prisma completos.
- Indicaciones requieren simultáneamente versión vigente, aprobación y emisión.
- Las rutas son de consulta y no modifican CUSTOMER, PAYER ni fichas clínicas.
- La auditoría usa `InteraccionesIA` con correlación y no copia historias clínicas completas.
- Las contraseñas institucionales usan formato PBKDF2: `pbkdf2$iteraciones$salt$hash`.
- El valor legado `hashedpassword_initial` no autentica.
- `AI_AGENT_SESSION_SECRET` es obligatorio fuera del repositorio.

La relación `Usuarios.id_profesional` y su índice único se crean con la migración `20261110190000_customer_ai_staff_auth`.

## Demostración reproducible

El script [customer-ai-agent-demo.ps1](../../../backend/scripts/customer-ai-agent-demo.ps1) ejecuta el escenario sin autenticación y, si se proporcionan tokens reales, los escenarios de paciente y odontólogo:

```powershell
$env:AI_AGENT_PATIENT_TOKEN = '<token emitido por /api/patient-auth/login>'
$env:AI_AGENT_STAFF_TOKEN = '<token emitido por /api/staff-auth/login>'
.\backend\scripts\customer-ai-agent-demo.ps1 -TreatmentId 125 -AttentionId 219
```

Los IDs deben corresponder a datos reales de la base configurada; no hay datos ficticios persistentes.

## Pruebas y evidencia

Ejecutado correctamente:

```powershell
npx prisma generate
$env:SQLSERVER_URL='sqlserver://localhost:1433;database=NexoSaludDB;integratedSecurity=true;trustServerCertificate=true;'
npx prisma validate
npm run build
npx vitest run tests/customerAiAgentSecurity.test.ts tests/customerAiAgentHttp.test.ts
```

Resultados:

- Prisma válido.
- Build TypeScript correcto.
- Pruebas del módulo: **6/6 correctas**.
- Suite completa contra SQL Server: **34/34 correctas**, 9 archivos de prueba.
- Demostración HTTP real de paciente: `GET /me/treatments` y `GET /treatments/1/progress` respondieron 200 con datos de CUSTOMER.
- Demostración HTTP real de odontólogo: login institucional respondió 200 con rol `ODONTOLOGO` y el contexto clínico autorizado respondió 200.

Las pruebas se ejecutaron después de configurar `backend/.env`, aplicar las migraciones oficiales y cargar el fixture controlado local.

## Decisiones y estado

Se añadió autenticación institucional en lugar de aceptar IDs de profesional desde el cliente. El usuario debe estar vinculado a un profesional activo y colegiado; los administradores pueden operar con ámbito institucional. La contraseña debe provisionarse mediante el flujo de configuración enviando `password`, que ahora se almacena con PBKDF2.

**Estado: COMPLETADO.** El código, migraciones, autenticación, herramientas, endpoints, demostración, pruebas contra SQL Server y documentación están implementados y verificados. El fixture de prueba local está en `backend/scripts/seed-customer-ai-test-data.sql` y no debe ejecutarse en producción.

## Preparación para el Paso 3

Un futuro LLM deberá invocar únicamente estos servicios internos, recibir un principal ya autenticado, respetar las herramientas permitidas por rol y conservar `correlationId`. No tendrá acceso directo a SQL Server.
