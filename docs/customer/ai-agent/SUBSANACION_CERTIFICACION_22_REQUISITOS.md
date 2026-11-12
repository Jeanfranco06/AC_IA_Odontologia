# Certificación técnica de los 22 requisitos

Fecha: 12 de noviembre de 2026, America/Lima. Alcance verificado: entorno local aislado y datos sintéticos. **IMPLEMENTADO Y VERIFICADO se refiere a pruebas técnicas en Test, no a habilitación institucional ni certificación clínica de Gemini.** No se ejecutaron escrituras, ETL ni migraciones sobre NexoSaludDB o NexoSalud_Mart operativas.

El corpus oficial, las políticas por servicio, las ventanas de confirmación, las plantillas y los protocolos de derivación deben ser aprobados por responsables reales. Los registros publicados por los fixtures están marcados como sintéticos y solo existen en Test. El LLM externo permanece bloqueado en la certificación; las pruebas del proveedor usan dobles explícitos.

## Resultado ejecutado

- Backend: Test Files  24 passed (24); Tests  234 passed (234).
- Frontend: Test Files  6 passed (6); Tests  49 passed (49).
- Navegador Chrome headless, backend/HTTP/SQL reales, únicamente proveedor LLM simulado: {"startTime": "2026-11-12T12:42:24.768Z", "duration": 61526.498, "expected": 6, "skipped": 0, "unexpected": 0, "flaky": 0}.
- BI: 20 medidas al mismo corte; claves desconocidas y duplicados se detallan en [conciliación](SUBSANACION_OLTP_DATAMART.md).

Las siete declaraciones it.skip de la auditoría eran placeholders de funciones pendientes, sin cuerpo de prueba; se retiraron al reemplazarlas por casos SQL ejecutables, no se transformaron en aprobaciones vacías. La guardia SQL de las suites permanece y ahora permite ejecución únicamente con Test/no-sysadmin/instancia verificados. Un skip registrado en un intento fallido no se cuenta aprobado.

## Matriz

| Requisito | Estado inicial | Implementación realizada | Prueba ejecutada | Estado final |
|---|---|---|---|---|
| IA01 | SIN EVIDENCIA INTEGRADA | Autorización por propietario; selección de tratamiento; consulta de sesiones, fechas, profesional, sede y estados canónicos SQL. | SQL/HTTP IA01; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA02 | SIN EVIDENCIA INTEGRADA | Lee plan vigente; cuenta completadas solo con Realizada y Cerrada; sin plan devuelve 0 y expone inconsistencia; misma definición ETL. | SQL/HTTP IA02; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA03 | PARCIAL | Plan/ordinal/slot oficial; propuesta firmada y temporal; confirmación; solicitud persistente; revisión; nueva validación transaccional y procedimiento oficial; evento CREACION. | SQL/HTTP IA03; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA04 | PARCIAL | Preparar, confirmar, revisar, aprobar y aplicar slot vigente mediante servicio oficial; conserva id_sesion y registra evento. | SQL/HTTP IA04; contratos históricos | IMPLEMENTADO Y VERIFICADO |
| IA05 | PARCIAL | Ingesta/versionado; revisión profesional; publicación administrativa; filtros por rol; recuperación; verificación de cita exacta y revalidación ante revocación. | SQL/HTTP IA05; contratos históricos | BLOQUEADO POR DEPENDENCIA EXTERNA |
| IA06 | PARCIAL | Filtra aprobación, emisión y vigencia; atención seleccionable; conserva texto íntegro, cantidades, frecuencia y duración. | SQL/HTTP IA06; contratos históricos | IMPLEMENTADO Y VERIFICADO |
| IA07 | PARCIAL | Agrupa tratamiento, plan, sesión, antecedentes/verificación, alergias, atenciones previas, procedimientos, alertas y checklist; devuelve IDs de procedencia y revisión. | SQL/HTTP IA07; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA08 | PARCIAL | Conserva AL-C01–05 y evalúa ALT-C01–08; ámbito por rol; identidad deduplicada; revisión y resolución auditadas. | SQL/HTTP IA08; contratos históricos | IMPLEMENTADO Y VERIFICADO |
| IA09 | NO IMPLEMENTADO | Contrato BORRADOR_FICHA_CLINICA; estructura extractiva o proveedor autorizado con validación literal; edición por secciones; versiones; rechazo; transferencia explícita contra revisión vigente. | SQL/HTTP IA09; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA10 | PARCIAL | Reutiliza BorradoresIA/versiones; usa notas registradas o plantilla publicada por servicio; aprobación y emisión separadas; preserva identidad del documento. | SQL/HTTP IA10; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA11 | PARCIAL | Política DOCUMENTACION publicada por servicio; verifica campos/procedimiento/indicaciones configurados; hash y revisión de ficha; registro Completa/Incompleta. | SQL/HTTP IA11; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA12 | PARCIAL | Procedimiento asistencial; validación vigente; cierre de sesión supervisado; eventos; nueva consulta y refresco del portal. | SQL/HTTP IA12; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA13 | PARCIAL | Reúne plan, sesiones, validaciones vigentes, documentos y derivaciones; bloquea excepciones; procedimiento formal y decisión auditada; transición TURNED según regla existente. | SQL/HTTP IA13; contratos históricos; navegador según alcance descrito | IMPLEMENTADO Y VERIFICADO |
| IA14 | PARCIAL | Persistencia por actor real; id_usuario_actor; paciente nullable para personal; correlación; evento por acción; no duplica conversación por herramienta interna. | SQL/HTTP IA14; contratos históricos | IMPLEMENTADO Y VERIFICADO |
| ALT-C01 | AUSENTE | Sesión futura, pendiente y dentro de ventana CONFIRMACION publicada; confirmar no modifica asistencia. | SQL real ALT-C01; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C02 | AUSENTE | Fin del horario programado ya transcurrió y el estado sigue pendiente; solicitar revisión humana. | SQL real ALT-C02; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C03 | AUSENTE | Plan vigente con cantidad prevista mayor que sesiones oficiales; deriva al flujo IA03. | SQL real ALT-C03; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C04 | CÓDIGO SIN E2E | Alergia documentada o antecedente pendiente de verificación; muestra advertencia documental. | SQL real ALT-C04; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C05 | PARCIAL | Evalúa campos reales y requisitos de política vigente; explicita falta de política; no depende solo de validación antigua. | SQL real ALT-C05; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C06 | CÓDIGO SIN E2E | Borrador vigente postatención no aprobado; excluye borrador de ficha; identidad y versión. | SQL real ALT-C06; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C07 | AUSENTE | Plan completo gestionado (cierre o excepciones oficiales) y tratamiento activo; solicitar revisión de checklist. | SQL real ALT-C07; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |
| ALT-C08 | PARCIAL | Paciente puede solicitar revisión explícita; protocolo publicado puede activar derivación antes del LLM; solicitud y alerta persistidas. | SQL real ALT-C08; permisos/ciclo de vida; BI agregado | IMPLEMENTADO Y VERIFICADO |


## Tipos de evidencia y cobertura

[customerCompletionIntegration.test.ts:1](../../../backend/tests/customerCompletionIntegration.test.ts#L1) ejecuta 28 casos reales SQL/HTTP: catorce actividades, ocho alertas, concurrencia de borradores, autenticación/revocación, concurrencia de agenda/cambio de plan/PAYER, proveedor simulado literal e invención rechazada, cierre formal positivo, y lote de scheduler real sin solapamiento. Los casos compuestos contienen aserciones negativas, propiedad de recurso, idempotencia y ausencia de efectos colaterales. Las suites históricas añaden contratos, errores, transacciones, RAG y regresión.

[customer-completion.spec.ts:1](../../../frontend/e2e/customer-completion.spec.ts#L1) usa formularios reales de paciente/recepción/odontólogo, persistencia al recargar, programación y reprogramación oficiales, secciones de ficha y revisión humana, emisión, comprobación y cierre según el resultado de cada ejecución, alertas y móvil de 390 px. La prueba no inyecta respuestas del backend ni evita la autenticación. Capturas en [evidencias/subsanacion](evidencias/subsanacion). El controlador de escritorio falló al inicializar sus recursos; se utilizó Chrome instalado mediante Playwright en un perfil efímero aislado ([documentación oficial de canales](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge)). No se controló el perfil habitual del usuario.

Concurrencia no aplica a consultas de solo lectura IA01/02/06/07; sí a versiones, solicitudes y escrituras. BI se certifica por hechos y medidas agregadas, no como prueba clínica individual. Las ocho alertas tienen casos SQL específicos; una bandeja visible en navegador no equivale a ocho escenarios E2E visuales independientes. Reprogramación dispone de integración SQL y recorrido visual paciente/recepción hasta Aplicada, preservando la identidad de sesión. No se ejecutó Gemini real por falta de autorización; los dobles verifican herramientas, aislamiento, abstención, citas y texto literal, sin acreditar competencia clínica del proveedor.

## Reproducción

Desde la raíz del repositorio, con SQL Server local y ambas bases Test con esquema previo:

```powershell
powershell -File backend/scripts/provision-customer-certification.ps1
python backend/scripts/install-customer-certification.py
node backend/scripts/run-customer-certification.cjs verify
node backend/scripts/run-customer-certification.cjs
npm --prefix backend run build
npm --prefix frontend test
npm --prefix frontend run build
```

E2E en terminales independientes:

```powershell
node backend/node_modules/tsx/dist/cli.mjs backend/scripts/start-customer-certification.ts --fresh
$env:VITE_API_URL='http://localhost:3101/api'
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5174
cd frontend
npx playwright test --config playwright.customer.config.ts
```

Después de finalizar navegador, detener solamente el helper Test antes de repetir la conciliación para evitar escrituras del scheduler durante otro corte. Para reemitir documentación después de la ejecución final: python backend/scripts/build-customer-completion-docs.py. No publicar .env local, logs privados ni fixture con credenciales.
