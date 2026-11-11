# Paso 3 — LLM y orquestación segura del agente CUSTOMER

## Estado

- **Implementado:** proveedor Gemini desacoplado, `generateContent` con function calling, registro de herramientas, políticas de rol, límites independientes de caracteres/tokens, timeout cancelable en el cliente, validación de argumentos, prompt anti-inyección, endpoint conversacional y auditoría única por turno.
- El cliente Gemini usa explícitamente la API `v1beta`, necesaria para el flujo de function calling utilizado por este agente.
- **Verificado:** TypeScript compila y las pruebas de seguridad/orquestación usan un proveedor falso; no requieren credenciales externas.
- **Datos clínicos reales habilitados:** no por defecto. El endpoint permanece deshabilitado mientras `AI_AGENT_LLM_ENABLED=false`.

## Configuración

En `backend/.env`:

```env
AI_AGENT_LLM_ENABLED=false
AI_AGENT_LLM_PROVIDER=gemini
AI_AGENT_LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEY=
AI_AGENT_EXTERNAL_DATA_AUTHORIZED=false
AI_AGENT_MAX_ITERATIONS=4
AI_AGENT_MAX_TOOL_CALLS=4
AI_AGENT_MAX_INPUT_CHARS=2000
AI_AGENT_MAX_OUTPUT_CHARS=4000
AI_AGENT_MAX_OUTPUT_TOKENS=1024
AI_AGENT_TIMEOUT_MS=15000
AI_AGENT_MAX_CONCURRENCY=8
```

Para habilitar Gemini se requiere una clave de Google AI Studio, autorización de privacidad para enviar el contexto mínimo necesario al proveedor y establecer explícitamente `AI_AGENT_EXTERNAL_DATA_AUTHORIZED=true`. La clave nunca se devuelve al cliente ni se registra.

## Flujo

1. `aiAgentAuth` valida el Bearer token y obtiene el principal.
2. `POST /api/customer/ai-agent/chat` recibe solo `message`.
3. El orquestador construye instrucciones por rol y entrega únicamente herramientas permitidas.
4. El modelo puede solicitar una herramienta; el backend valida nombre, rol, argumentos y ámbito de datos.
5. La herramienta reutiliza `CustomerAiQueryService` con auditoría interna desactivada.
6. El resultado minimizado vuelve al modelo y el turno termina con una respuesta textual.
7. Se registra una sola interacción `CONVERSACION_AGENTE` o `CONVERSACION_CON_HERRAMIENTAS`.

## Herramientas

Las herramientas cubren consultas autorizadas y preparación limitada de una solicitud de reprogramación o un borrador documental. El token firmado de confirmación se elimina del resultado entregado al LLM. No existe herramienta de aprobación/rechazo, aplicación de agenda, diagnóstico, prescripción o búsqueda externa.

## Ejemplo

```http
POST /api/customer/ai-agent/chat
Authorization: Bearer <token-de-paciente-o-staff>
Content-Type: application/json

{"message":"¿Cuándo es mi próxima sesión?"}
```

La respuesta incluye `message`, `toolsUsed`, `limitations` y `correlationId`. Si el proveedor está deshabilitado, no hay clave o se supera un límite, el backend responde un error controlado sin filtrar secretos ni detalles internos.

## Validación

```powershell
cd backend
npm run build
npm test
```

Las pruebas automatizadas usan proveedores simulados y no requieren credenciales externas. Se verificó previamente una llamada real a Gemini con una consulta sintética, incluyendo function calling; no se envió contexto clínico en esa prueba. El uso con datos clínicos requiere autorización explícita de privacidad.
