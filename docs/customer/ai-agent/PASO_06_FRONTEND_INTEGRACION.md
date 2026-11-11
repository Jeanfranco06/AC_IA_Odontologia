# Paso 6 — Integración frontend CUSTOMER

## Estado

**PARCIAL: portal del paciente y espacio de trabajo institucional conectados a contratos backend existentes.** No se declara completado ni certificado de extremo a extremo. El paso 4.1 permanece parcial y el RAG del paso 5 no está conectado al agente. No avanzar al paso 7.

## Alcance implementado

- Portal de paciente con inicio de sesión backend, tratamientos, próximas sesiones, sesiones e indicadores operativos, solicitudes de reprogramación con confirmación explícita, estado de solicitudes y chat.
- Espacio institucional para odontología, recepción y administración; la API backend aplica autorización por rol/ámbito. Incluye contexto y estado documental por ID de atención, alertas y revisión de borradores con aprobación humana explícita, además de bandeja de solicitudes.
- Cliente API con Bearer token, mensajes de error del servidor y sin datos ficticios de negocio. El login staff ya no inventa sesiones locales ni admite cuentas preconfiguradas.
- Rutas `/portal-customer` y `/customer/agent`, enlaces de acceso y pruebas unitarias del cliente HTTP.

## Contratos consumidos

Se consume `/api/customer/ai-agent` para `GET /me/treatments`, `GET /me/upcoming-sessions`, `GET /treatments/:id/sessions`, `GET /treatments/:id/progress`, `GET /reschedule-requests`, `POST /actions/prepare`, `POST /actions/confirm`, revisión/aplicación de solicitudes, `GET /alerts`, `POST /alerts/detect`, revisión de alertas, `POST /chat`, contexto clínico y estado documental, y ciclo de borradores (`POST/GET /document-drafts`, revisiones, aprobación y rechazo). El acceso institucional usa `/api/staff-auth/login`; el paciente usa `/api/patient-auth` según el servicio de autenticación existente.

## Seguridad y límites deliberados

- Tokens Bearer viven en `sessionStorage`; no son cookies HttpOnly. La sesión client-side no sustituye la autorización del servidor.
- Los IDs de atención y disponibilidad se ingresan/obtienen por canales institucionales porque el backend no ofrece listados de atenciones propias ni búsqueda de disponibilidad para estos flujos. El backend vuelve a autorizar/validar cada acción; no se inventan resultados.
- El backend no devuelve referencias RAG en chat: la UI muestra las limitaciones entregadas por el agente y no presenta citas simuladas ni afirma que usó conocimiento institucional.
- No se muestran indicaciones post-atención porque no existe un contrato de listado de atenciones propias que permita solicitar el recurso de manera segura.
- Las consultas clínicas y acciones sensibles se mantienen tras login y sujetos a validación de ámbito backend. La aprobación documental es explícita y queda en servidor.

## Verificación local

- `frontend`: `npm run build` — compilación TypeScript/Vite aprobada (el bundle principal genera advertencia de tamaño).
- `frontend`: `npm test` — 66 aprobadas, 12 omitidas; pruebas del API client incluidas. Las omitidas corresponden a integración protegida por configuración/fixture.
- ESLint focalizado en archivos modificados — aprobado.
- `npm run lint` global no está limpio: reporta errores preexistentes en archivos ajenos a esta integración (BUYER/LEAD/PAYER y utilidades compartidas). No se modificaron para evitar ampliar alcance.
- No se hizo E2E contra servicios institucionales ni escrituras reales: no hay fixture autenticado de integración certificada; el paso 4.1 continúa parcial.

## Archivos principales

- `frontend/src/modules/customer/pages/CustomerPatientPortalPage.tsx`
- `frontend/src/modules/customer/pages/CustomerAiStaffWorkspacePage.tsx`
- `frontend/src/modules/customer/services/customerAiAgentApi.ts`
- `frontend/src/modules/customer/services/customerAiAgentApi.test.ts`
- `frontend/src/shared/services/patientAuthService.ts`
- `frontend/src/shared/services/staffAuthService.ts`

## Pendiente para declarar completo

1. Completar certificación 4.1 con entorno de integración aislado y fixtures sintéticos confiables.
2. Agregar endpoint autorizado para listar atenciones propias y disponibilidad, y conectar UI sin entrada manual de IDs.
3. Completar catálogo de post-atención autorizado y devolver referencias verificables si se habilita RAG; no activar RAG hasta aprobación institucional y pruebas del modelo.
4. Ejecutar pruebas E2E en ambiente integrado, incluyendo roles/ámbitos, expiración de sesión, reintentos/idempotencia y regresión de otros módulos.
5. Resolver errores de lint global ajenos al alcance y revisar estrategia de almacenamiento de tokens (preferible cookie segura HttpOnly si la arquitectura lo permite).

**Conclusión:** integración frontend realizada con limitaciones visibles y controles del backend; permanece PARCIAL y no se inicia el paso 7.
