# Resultados de verificación IA — ejecución de esta auditoría

Fecha local: 12 de noviembre de 2026, America/Lima. Rama `customer`. No se reutilizan los 229 aprobados del paso 9 como si se hubieran ejecutado ahora.

## Resultado reproducible

| Verificación | Resultado | Alcance y evidencia |
|---|---|---|
| Compilación backend | Exitosa | `npm run build --prefix backend`; [log](evidencias/backend-build.txt) |
| Compilación frontend | Exitosa | `npm run build --prefix frontend`; aviso por bundle >500 kB; [log](evidencias/frontend-build.txt) |
| Suite backend con integración SQL deshabilitada | **79 aprobadas, 133 omitidas, 0 fallidas; 13 archivos aprobados y 9 omitidos** | [log completo](evidencias/backend-tests.txt). Son 212 pruebas descubiertas, no 212 ejecutadas. |
| Suite frontend | **49 aprobadas, 0 fallidas; 6 archivos** | [log completo](evidencias/frontend-tests.txt). No acredita navegación React completa con SQL. |
| Suite adicional de trazabilidad | **25 aprobadas y 7 omitidas de 32** | [customerAcademicTraceability.test.ts](../../../backend/tests/customerAcademicTraceability.test.ts). Prisma y proveedor simulados. |
| SQL operativo, solo lectura | Ejecutado con SELECT | [snapshot](evidencias/sql-readonly.json), script [audit-customer-readonly.cjs](../../../backend/scripts/audit-customer-readonly.cjs) |
| SQL de escritura / ETL / concurrencia real | **BLOQUEADO; no ejecutado** | Conexión actual NexoSaludDB y cuenta sysadmin. Se exige NexoSaludDB_Test en instancia autorizada y credencial no sysadmin. |
| Gemini real | No ejecutado | No se enviaron consultas clínicas ni datos de pacientes al proveedor. No se certifican cuota, disponibilidad ni exactitud clínica. |
| Inspección visual pública | Ejecutada | Portal en localhost:5173: acceso, retirada de credenciales de demostración y aviso de contacto sin teléfonos/guardia ficticios. Workspace sin sesión redirige al inicio. |
| Navegación clínica autenticada y flujo al Data Mart | Pendiente | No se utilizaron pacientes reales ni escrituras en bases operativas. |

Las 133 omisiones corresponden a **126 pruebas históricas dependientes de SQL aislado** y **7 casos explícitamente pendientes del diseño**. Las omisiones no son aprobaciones ni evidencia de que la función exista.

La primera ejecución general encontró nueve suites bloqueadas por la guardia de aislamiento antes de sus escrituras. Tras indicar explícitamente `AI_AGENT_SQLSERVER_INTEGRATION=false`, las suites inseguras no se ejecutaron y pasó la regresión segura. No se debilitó la guardia para hacer pasar pruebas. No se reejecutaron scripts destructivos de fixtures.

## Comandos

Desde la raíz del repositorio en PowerShell:

```powershell
$env:AI_AGENT_SQLSERVER_INTEGRATION = 'false'
npm test --prefix backend -- --reporter=dot
npm test --prefix frontend
npm run build --prefix backend
npm run build --prefix frontend
node backend/scripts/audit-customer-readonly.cjs
git diff --check
```

El último comando Node usa únicamente SELECT con SQL constante. No ejecuta migraciones, seeds, procedimientos operativos ni ETL. Las conexiones usan configuración local sin imprimir secretos. Los totales son agregados; no se exportan historias clínicas o identificadores de pacientes.

## Cobertura identificable IA y ALT

| Requisito | Verificación efectivamente realizada | Pendiente material |
|---|---|---|
| IA01 | Estados persistidos, sesión reprogramada y rechazo de tratamiento ajeno con datos simulados | Portal autenticado a SQL y estados reales |
| IA02 | Realizada Y Cerrada, cálculo 50 %, plan vacío sin sesión ficticia | Reconciliación plan/sesiones/ETL por tratamiento |
| IA03 | Caso omitido explícito; inspección SP Programar y ausencia de flujo paciente | Solicitud, confirmación, contrato, UI y E2E |
| IA04 | Límites de herramientas, mensaje PREPARED, rechazo de ordinal ambiguo y repetición al mismo slot sin otro evento | SQL real, carreras y disponibilidad/horarios |
| IA05 | Rol de publicación, ausencia de semilla automática y cuarentena de v1 con identidad fija; unidad RAG sintético | Corpus institucional acreditado y citas reales en respuestas |
| IA06 | Filtros aprobación/emisión/vigencia, pertenencia y límites de explicación en instrucciones | Fidelidad semántica con evaluación autorizada y flujo autenticado |
| IA07 | Alergia no registrada no se presenta como ausente; recepción no lee contexto | Contexto completo validado profesionalmente |
| IA08 | Paciente no ejecuta detectores; reglas añadidas y existentes contrastadas | Ocho reglas ALT integrales y disparadores |
| IA09 | Caso omitido: no se finge asistencia específica de ficha | Contrato notas/borrador/ficha/revisión |
| IA10 | Borrador sin evolución/cuidados inventados, emisión separada de asistencia, relectura de versión en transacción y rechazo de versión obsoleta | Plantilla institucional y concurrencia SQL |
| IA11 | Ausencia de validación no produce ficha completa en consulta | Motor de completitud por tipo y cierre bloqueado coherentemente |
| IA12 | Definición canónica de sesión completada; no cerrar tratamiento por cálculo | Refresco oportuno de paciente y escenarios multisesión |
| IA13 | Checklist detecta diferencias, sesiones sin atención y excepciones; solo lectura; paciente rechazado | Flujo autenticado y decisión profesional registrada |
| IA14 | Una conversación con herramienta produce una interacción; búsqueda RAG interna correlacionada sin duplicación | Fallos, actores staff, linajes y mart conciliado |
| ALT-C01 | Omitida: sin estado/ventana oficial | Positivo, negativo, destinatario, permisos, deduplicación y resolución |
| ALT-C02 | Omitida: no hay detector de vencimiento | Mismos casos con desenlace y corte temporal acordados |
| ALT-C03 | Omitida: no hay detector de brechas conectado a IA03 | Reglas, solicitud y actor coordinación |
| ALT-C04 | Positivo alergia, negativo sin datos, rol/propiedad y repetición sin duplicar; sin decisión clínica | SQL, presencia de antecedentes aislada y resolución E2E |
| ALT-C05 | AL-C01 positivo incompleta/campos y negativo Completa; permisos generales del detector | Campos por tipo, datos contradictorios y cierre |
| ALT-C06 | Borrador pendiente positivo, negativo inexistente; filtro de estado/versión, rol, no emisión y deduplicación | SQL, transiciones de aprobación/resolución e idempotencia concurrente |
| ALT-C07 | Omitida; checklist no se cuenta como alerta | Regla de todas las sesiones/excepciones y ausencia de cierre formal |
| ALT-C08 | Omitida la derivación; inspección visual del aviso de límites | Protocolo aprobado, detección, destinatario, cola, notificación y seguimiento |

Los asserts sobre instrucciones del modelo son controles de configuración, **no** pruebas de que Gemini siempre obedecerá. Los dobles de Prisma permiten comprobar consultas, permisos y ausencia de ciertas mutaciones; no demuestran locks, CHECK, índices ni atomicidad del motor SQL. Las pruebas omitidas no reciben una implementación trivial para aparentar éxito.

## Regresión y seguridad

Se ejecutaron las suites BUYER de campañas, duraciones y ruta; PAYER de dunning y documentos PDF; servicio de sincronización mart; contratos de seguridad y HTTP del agente; unidad RAG y orquestador. LEAD y TURNED compilan y se revisaron sus contratos de frontera, pero no se ejecutó una regresión transaccional dedicada de esas etapas. La restricción administrativa de rutas históricas es intencionada por seguridad y deja una limitación funcional que debe resolverse con endpoints por rol/recurso.

Se probaron el rechazo anónimo/paciente del expediente histórico, claims de odontólogo incompletos, recepción sin contexto clínico y OTP simulado deshabilitado. La parametrización de patient-auth y el consumo condicional de activación se compilaron y revisaron; no se alteraron contraseñas ni se activaron cuentas para probarlos. Persiste endurecimiento necesario de autenticación heredada y cierre clínico institucional.

## SQL y BI

El snapshot registra base operativa y sysadmin, existencia de tablas/procedimientos, índices únicos, totales de clases IA, estados de sesiones, medidas clínicas del mart, tipos desconocidos y duplicaciones de grano. No es una transacción congelada entre todas las consultas. Otras tareas estaban activas y los conteos de interacciones cambiaron entre lecturas; cada evidencia conserva timestamp UTC.

Se confirmó un desfase entre OLTP y mart y que el procedimiento desplegado carece de la lógica de raíces/Resuelta preparada en el repositorio. Se mantienen pendientes: despliegue al clon, reconciliación con mismo corte de todas las medidas, repetición del ETL sin delta, historial de eventos y casos de joins/versionado. No se certifica `Δ=0` ni que el SQL modificado esté instalado.

## Condiciones para completar la aceptación

1. Proporcionar un entorno realmente aislado con datos sintéticos, usuario no sysadmin e instancia verificada; evitar reutilizar .env de operación.
2. Completar contratos de programación nueva CUSTOMER, asistencia específica de ficha, confirmación, campos obligatorios/cierre y derivación clínica.
3. Acreditar revisión y publicación del corpus/plantillas por responsables institucionales; no volver a activar semillas como si fueran documentos oficiales.
4. Ejecutar navegación autenticada y pruebas SQL de autorización, carreras, reintentos, documentos y reprogramación; probar Gemini solo con datos autorizados.
5. Aplicar y verificar el ETL en clon, conciliar las medidas con mismo corte y comprobar no regresión BUYER/LEAD/PAYER/CUSTOMER/TURNED.

La auditoría y las correcciones locales se entregan; la certificación funcional integral queda abierta. No hay aceptación del 100 %.
