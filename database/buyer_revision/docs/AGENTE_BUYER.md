# Ruta posterior para integrar el sistema y desarrollar el agente Buyer

[Guía principal](../README.md) · [Cierre previo de las BD](PENDIENTES_BUYER_BD.md) · [Registro de cambios](../CAMBIOS_REALIZADOS.md).

**Estado: recomendaciones, no implementación ni pruebas realizadas.** El cierre de BD tiene prioridad. No se ha integrado el backend antiguo con `CaptacionesBuyer`, ni implementado aquí un agente funcional.

## 1. Resolver primero el contrato sistema ↔ BD

Revisar en la base de código de esta rama:

- [schema.prisma](../../../backend/prisma/schema.prisma).
- [buyer.routes.ts](../../../backend/src/routes/buyer.routes.ts).
- [martSyncService.ts](../../../backend/src/services/martSyncService.ts).
- [report.routes.ts](../../../backend/src/routes/report.routes.ts).
- El contrato SQL vigente en [init_oltp.sql](../semana9/init_oltp.sql).

Actualizar modelos/relaciones y DTO con el esquema comprobado, sin usar un `db push` ciego que quite objetos o recree datos. La mezcla de nombres PascalCase/snake_case debe contrastarse con las tablas reales; las rutas no quedan adaptadas solo por ejecutar el DDL.

El registro debe guardar persona y captación declarada en una transacción. Resolver catálogo, autorización, duplicados e intención con reglas verificables. No rellenar nombres ficticios para que un registro parezca completo. Para consultas recurrentes, reutilizar identidad/captación inicial y registrar interacción; si se necesita otro episodio comercial, diseñarlo expresamente sin cambiar el conteo del reporte.

La conversión operativa debe invocar `usp_ConvertirBuyerALead` con parámetros validados. Probar reintentos, persona de otra fase y errores antes de conectar IA. No crear una Solicitud/LEAD automáticamente en todo registro web.

## 2. Sustituir el sincronizador antiguo

`MartSyncService.syncBuyer()` utiliza ahora los procedimientos canonicos de captacion e inversion en una transaccion. Instalar ambos procedimientos segun [cierre y validacion local](CIERRE_BUYER_Y_VALIDACION_LOCAL.md) antes de iniciar el backend. La integracion funcional del agente sigue siendo trabajo posterior.

- Adoptar una implementación canónica basada en el bloque 1 del ETL vigente, preferentemente encapsulada en una operación de BD/servicio preparada para su ejecución repetida.
- No copiar la extracción en rutas, agente y reportes por separado.
- Ejecutar sincronización después de confirmar la operación OLTP. Una falla del Mart debe registrarse y poder reintentarse sin repetir el pago/conversión/alta original.
- No recalcular las cinco fases por cada interacción del agente.
- Si se ejecutan archivos SQL desde Node, recordar que `GO` es un separador del cliente SSMS, no una sentencia del motor; resolver los lotes o encapsular el procedimiento antes de enviar consultas por el driver.
- Los reportes deben aceptar `NULL`/«no calculable» para B3 y columnas de sede desconocida. No convertir valores ausentes en cero o semáforo verde.

## 3. Definir lo que sí hará el agente

Según Buyer en la pestaña principal del informe:

1. Ayudar a validar completitud y detectar posibles duplicados.
2. Clasificar interés y preferencias declarados contra catálogos.
3. Identificar o confirmar el origen de captación con evidencia disponible.
4. Evaluar intención administrativa de precio, disponibilidad, sede o condiciones, manteniendo como Buyer lo ambiguo.

No hacer diagnósticos clínicos, inferir una autorización ni fabricar campaña/sede/gasto. La IA sugiere; la política de negocio y la operación transaccional controlan la conversión. Definir quién confirma una recomendación y bajo qué permisos.

## 4. Implementación gradual sugerida

### Paso A: reglas deterministas sin proveedor externo

Implementar y probar validación de campos, catálogos, autorización y duplicación. Definir un resultado estructurado con intención, servicio sugerido, motivo, incertidumbre y acción propuesta. Los IDs sugeridos deben existir realmente y estar permitidos.

### Paso B: proveedor en el backend

Elegir/configurar el proveedor cuando el equipo lo decida. Credenciales en variables de entorno del servidor; no incluirlas en frontend, archivos de pruebas ni commits. Enviar datos mínimos pertinentes; no incluir identificadores personales o información clínica innecesarios.

Validar la salida como datos no confiables: formato, rangos, valores de catálogo y campos obligatorios. No ejecutar SQL ni instrucciones arbitrarias propuestas por el modelo. Una respuesta ambigua o un fallo del proveedor debe mantener el caso en revisión/Buyer, con una alternativa determinista que no simule una inferencia remota exitosa.

### Paso C: persistencia auditable

Usar `DecisionesIA` y sus referencias a captación/interacción. Registrar entrada mínima, regla/versión usada, sugerencia, acción realmente ejecutada, revisión y fecha. Si hacen falta columnas para proveedor, modelo, versión o resultado estructurado, proponer una migración aditiva; **no asumir que ya existen por aparecer en el refactor antiguo**.

Comprobar que la persona de la decisión, la captación y la interacción sea la misma. Mantener por separado recomendación y autorización/ejecución de transición. La bitácora de IA no reemplaza `EventosEtapa`.

### Paso D: alertas e interfaz

Vincular las alertas del informe: registro incompleto, posible duplicado, falta de autorización e intención ambigua. Mostrar motivo y opción de revisión. No inventar tendencias, porcentajes ni fechas en la interfaz para representar actividad.

## 5. Pruebas de aceptación futuras

| Caso | Resultado esperado |
|---|---|
| Datos completos e intención concreta | Recomendación verificable; conversión solo mediante la política y operación autorizadas. |
| Falta autorización | No convertir aunque el modelo lo sugiera. |
| Intención ambigua | Mantener Buyer/revisión, sin solicitud formal falsa. |
| Servicio inventado por el modelo | Rechazar sugerencia fuera del catálogo. |
| Consulta recurrente | No duplicar persona ni captación inicial. |
| Dos solicitudes de conversión/reintento | Una operación efectiva y evidencia consistente. |
| Timeout o salida inválida | Fallback/revisión identificados, sin éxito ficticio. |
| Conversión válida | Solicitud + evento + etapa + hecho + reporte concordantes. |
| Costo ausente | B3 no calculable, no costo cero inventado. |

No marcar el agente como terminado por compilar o generar una respuesta de texto. Demostrar la cadena operativa y sus rechazos.

## 6. Nota sobre PostgreSQL

Es una posibilidad futura para despliegue; **no forma parte del cierre actual**. Mantener el modelo lógico y las reglas independientes del motor. Cuando se abra esa tarea, planificar por separado proveedor de Prisma, drivers, identidades/secuencias, separadores de lotes, funciones de fecha, procedimientos, índices, bloqueos y ETL.

Primero obtener pruebas de paridad en SQL Server; después reproducirlas en PostgreSQL. No mezclar una migración de motor con el rediseño de Buyer y el agente en un solo cambio.
