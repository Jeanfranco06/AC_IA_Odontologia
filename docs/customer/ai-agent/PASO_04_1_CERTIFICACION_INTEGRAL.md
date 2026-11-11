# Paso 4.1 — Certificación integral CUSTOMER

**Estado: PARCIALMENTE CERTIFICADO.** Las bases aisladas existen y tienen esquema OLTP/Mart CUSTOMER/PAYER. El validador integral SQL encontró un defecto en el harness (evidencia cuantitativa nula en una fila de resultados) y abortó; por tanto, no se certifica el Paso 4 ni se aprueban escenarios que no concluyeron.

## A. Estado inicial e infraestructura

- Rama: `customer`. Commit observado al iniciar la auditoría: `d7f12bc`.
- El árbol ya tenía cambios sin confirmar de los pasos 2–4. Se preservaron; no se creó commit.
- `SQLSERVER_URL` cargado por el backend seleccionó `NexoSaludDB` en la instancia `JEAC` (consultas de solo lectura `DB_NAME()` y `SERVERPROPERTY('ServerName')`). La cuenta efectiva tiene `sysadmin=1`; la configuración y scripts también nombran `NexoSalud_Mart`.
- Con autorización temporal del usuario se crearon `NexoSaludDB_Test` y `NexoSalud_Mart_Test` en JEAC, sin alterar ni copiar datos de las bases reales. Se inicializó el esquema base y se aplicaron migraciones CUSTOMER/PAYER sustituyendo en memoria las referencias a bases para limitar los scripts a `_Test`. Se creó un login restringido no-sysadmin, aunque su contraseña aleatoria temporal no se conservó y debe rotarse antes de otra sesión de integración.
- `npx prisma validate` pasó y `npx prisma migrate status` informó seis migraciones y esquema actualizado. Son comprobaciones de esquema/conectividad, no certifican datos ni flujos.
- En una ejecución previa de `npm test` pasaron 48 tests. La suite incluía `customerAiPersistence.test.ts`, que selecciona personas, reservas, atenciones y pagos existentes, y crea interacciones, alertas y borradores sin rollback. Como la conexión activa apunta a `NexoSaludDB`, esa ejecución pudo escribir registros de prueba en la base operativa. Se bloqueó esa suite por defecto en esta auditoría. No se borraron registros; requiere revisión del responsable de la base antes de cualquier limpieza.

## B. Matriz P01–P32

“Bloqueada” significa que el requisito necesita SQL Server o un fixture de integración aislado, no disponible de forma segura. “No ejecutada” indica que las pruebas unitarias existentes no bastan para el requisito completo. No se infieren aprobaciones por nombre de archivo o por el total de tests.

| ID | Requisito | Evidencia existente | Tipo requerido | Estado / observación |
|---|---|---|---|---|
| P01 | Preparar solicitud propia | `customerAiActions.test.ts` solo valida entradas inválidas | Integración SQL | BLOQUEADA |
| P02 | Impedir solicitud sobre sesión ajena | No hay caso de propiedad de sesión | Integración SQL/seguridad | BLOQUEADA |
| P03 | Preparar sin cambiar agenda | No hay comparación de fecha en fixture aislado | Integración SQL | BLOQUEADA |
| P04 | Confirmar crea un registro | No se probó flujo prepare-confirm sobre fixture aislado | Integración SQL | BLOQUEADA |
| P05 | Confirmación idempotente | Sin concurrencia SQL comprobada | Integración SQL/concurrencia | BLOQUEADA |
| P06 | Rechazar token vencido o recurso alterado | Hay prueba de token manipulado, no expiración/cambio de recurso | Seguridad + SQL | NO EJECUTADA |
| P07 | Rechazar sesión completada | Sin caso | Integración SQL | BLOQUEADA |
| P08 | Pendiente no suma reprogramación efectiva | No se concilió OLTP/Data Mart | ETL real | BLOQUEADA |
| P09 | Paciente consulta solo su solicitud | Sin test de datos cruzados | Integración SQL/seguridad | BLOQUEADA |
| P10 | Ficha incompleta genera AL-C01 | No se ejercitó detector sobre fixture | Integración SQL | BLOQUEADA |
| P11 | Detector repetido deduplica | Sin ejecución concurrente en SQL | Integración SQL/concurrencia | BLOQUEADA |
| P12 | Alerta pasa legítimamente a revisión | Persistencia genérica fue probada previamente sobre la conexión operativa; no es fixture aceptable de certificación | Integración SQL aislada | BLOQUEADA |
| P13 | Revisar no resuelve automáticamente | Igual que P12; evidencia previa no aislada | Integración SQL aislada | BLOQUEADA |
| P14 | Usuario no gestiona alertas ajenas | No hay prueba de autorización con datos SQL | Integración SQL/seguridad | BLOQUEADA |
| P15 | Resolver requiere responsable/evidencia | Hay validación unitaria de evidencia vacía; falta caso SQL y evidencia verificable | Mixta | NO EJECUTADA |
| P16 | Odontólogo autorizado crea borrador permitido | Persistencia genérica previa no aislada | Integración SQL | BLOQUEADA |
| P17 | Borrador vinculado a atención correcta | Persistencia genérica previa no aislada | Integración SQL | BLOQUEADA |
| P18 | Revisión conserva raíz/versiona | Persistencia genérica previa no aislada | Integración SQL | BLOQUEADA |
| P19 | Paciente no aprueba borradores | Prueba unitaria de rol en `customerAiActions.test.ts` | Unidad + autorización SQL | NO EJECUTADA |
| P20 | Odontólogo ajeno no aprueba | Sin caso con profesional y atención ajenos | Integración SQL/seguridad | BLOQUEADA |
| P21 | Aprobación registra profesional/versión/fecha | Persistencia genérica previa no aislada | Integración SQL | BLOQUEADA |
| P22 | No aprobar versión obsoleta concurrentemente | Sin prueba concurrente sobre SQL Server | Integración SQL/concurrencia | BLOQUEADA |
| P23 | Aprobación no emite indicación al paciente | No se verificaron tablas/efectos en SQL | Integración SQL | BLOQUEADA |
| P24 | Sin nuevos diagnósticos/prescripciones | Campo persistido marca falso en un test previo; no demuestra todos los endpoints ni el modelo real | Unidad + integración | NO EJECUTADA |
| P25 | Orquestador procesa intenciones implementadas | Fake provider prueba recorrido genérico, no todas las intenciones | Unidad Gemini simulado + integración | NO EJECUTADA |
| P26 | LLM no confirma acciones humanas | `customerAiOrchestrator.test.ts` verifica que no ofrece `approveDocumentationDraft` ni `applyRescheduleRequest` | Unidad con proveedor simulado | APROBADA (solo exposición de herramientas; no certifica Gemini real) |
| P27 | Inyección no elude autorización | Caso de herramienta fuera de rol, no ataque de inyección de extremo a extremo | Unidad + integración | NO EJECUTADA |
| P28 | Acciones deterministas con Gemini deshabilitado | No hay prueba explícita de configuración apagada | Unidad/integración | NO EJECUTADA |
| P29 | Respuestas/logs no filtran datos de terceros | No se inspeccionaron logs ni contexto de dos pacientes | Seguridad | NO EJECUTADA |
| P30 | Contratos financieros PAYER intactos | Test anterior comparaba algunos campos de un pago/reserva, pero ejecutó operaciones CUSTOMER en `NexoSaludDB`; no cubre el inventario financiero requerido | Integración aislada | BLOQUEADA |
| P31 | ETL no duplica y medidas concilian | No se ejecutó `usp_ETL_SincronizarCustomerMart` en base aislada | ETL real | BLOQUEADA |
| P32 | Suites previas CUSTOMER continúan | La suite completa pasó previamente, pero no se repitió bajo entorno aislado ni se acreditó su alcance CUSTOMER | Regresión | NO EJECUTADA |

## C. Agenda y reprogramación

El código conecta la aplicación humana a `dbo.usp_ReprogramarSesionTratamiento`; las herramientas del modelo no exponen la aplicación. No se ejecutó el endpoint de aplicación, el procedimiento, ni se verificaron fecha anterior/nueva, `EventosSesion`, identidad de sesión, atención asociada o estado final. Tampoco se probaron horario ocupado, rollback ni concurrencia. Por tanto, la aplicación efectiva sigue **sin certificación**.

## D. Alertas

Los detectores AL-C01–AL-C05 están implementados en el servicio, pero faltan escenarios positivos/negativos, repetición, condición corregida, nueva ocurrencia y concurrencia en SQL Server. No se declara ningún detector certificado.

## E. Borradores

El código implementa versionado y revisión humana. Faltan fixtures aislados para generar, revisar, rechazar, aprobar, impedir doble aprobación, comprobar versión obsoleta, relaciones y medidas. No se declara certificado el flujo.

## F. Data Mart

El ETL CUSTOMER documenta `dbo.usp_ETL_SincronizarCustomerMart` y conciliaciones internas. No se ejecutó ni se compararon las ocho medidas requeridas antes/después de reejecutarlo. Resultado: **pendiente**.

## G. Seguridad

Los tests unitarios verifican tokens manipulados, límite de paginación, solicitud sin autenticación y exclusión de herramientas humanas. No cubren expiración real, tokens vinculados al recurso, usuarios cruzados sobre datos SQL, logs ni datos de terceros. No se envió contexto clínico a Gemini durante esta auditoría.

## H. Correcciones de seguridad de pruebas

- `backend/tests/customerAiPersistence.test.ts`: ahora se omite por defecto; antes de leer/escribir exige `AI_AGENT_SQLSERVER_INTEGRATION=true`, una instancia explícita `AI_AGENT_TEST_SQLSERVER_INSTANCE`, la base exacta `NexoSaludDB_Test`, coincidencia del servidor y una credencial no-sysadmin.
- `backend/scripts/seed-customer-ai-test-data.sql`: retirado el `USE NexoSaludDB` que podía redirigir una sesión a la base operativa; exige `NexoSaludDB_Test` exacta y rechaza credenciales sysadmin.
- El fixture `seed-customer-ai-test-data.sql` no se ejecutó: conserva dependencias de IDs y no es autónomo. El validador `07_validaciones_customer.sql`, con referencias transformadas a `_Test`, primero abortó por `NULL` en `#ResultadosPruebasCustomer.EvidenciaCuantitativa`. En un diagnóstico posterior en memoria se permitió evidencia nula solo para poder continuar; el propio script terminó informando que falló al menos una prueba obligatoria. Además, T21 exige cifras históricas fijas de producción (805 captaciones y 124 pagos/reservas), datos que no se copiaron a las bases aisladas. Por tanto, no se considera aprobado. La comprobación posterior no encontró pacientes, tratamientos, sesiones, atenciones ni solicitudes de reprogramación sintéticos persistidos.

## I. Limitaciones y pendientes

- Falta una credencial restringida utilizable para las pruebas de aplicación; la contraseña temporal generada no se conservó. Las bases `_Test` tienen esquema, pero no cuentan aún con un fixture sintético completo y autónomo para las pruebas de API/Prisma.
- El fixture actual sigue usando reservas con IDs fijos 122/123 y no es autónomo ni garantiza datos sintéticos; debe rediseñarse antes de cargarlo en un entorno nuevo.
- No se conciliaron pagos/contratos PAYER, ETL o medidas dimensionales.
- El modelo no representa sillón/unidad dental. Verifica disponibilidad del slot y solapamiento por profesional; no puede probar exclusión física por sillón. Modelarlo exige agregar el recurso al contrato de agenda y su restricción de unicidad; esta limitación no bloquea los escenarios aprobados que solo requieren disponibilidad profesional.
- Se desconoce cuántos registros de prueba creó la ejecución previa. No se realizó limpieza para preservar datos y evitar borrar información ajena.

## J. Conclusión y Paso 5

Resultado verificable de la matriz previa: **1 aprobada (P26, alcance acotado), 0 fallidas, 9 no ejecutadas y 22 bloqueadas**. La infraestructura de prueba ya se aisló y el ETL inicial fue ejecutado dos veces con reconciliación exitosa. El validador adicional falló por el harness descrito arriba; no cambia el conteo de certificación P01–P32. El Paso 4 sigue **PARCIALMENTE CERTIFICADO** y requiere corregir el harness, proveer un fixture autónomo y ejecutar la matriz de integración restante.
