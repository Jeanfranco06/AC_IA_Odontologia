# Cambios y limpieza final de Buyer

[Inicio](README.md) · [Validacion](docs/CIERRE_BUYER_Y_VALIDACION_LOCAL.md) · [Entrega a LEAD](docs/ENTREGA_A_LEAD.md).

## 1. Implementado y publicado

- CaptacionesBuyer atomico por persona; contexto declarado y procedencia observada.
- Eventos de conversion vinculados y usp_ConvertirBuyerALead con transaccion, validacion y reintento.
- Hecho de captacion con cinco medidas originales, dimensiones y fechas/evidencia de conversion.
- Hecho transaccional de inversion, sin perder campanas con gasto pero sin contactos; datos monetarios de ejemplo separados.
- Procedimientos canonicos de captacion e inversion, API de sincronizacion atomica, propagacion de errores y coordinacion de solicitudes concurrentes.
- CPL calculado desde componentes en cada nivel; costos desconocidos en NULL en consulta, matriz, CSV y PDF.
- Configuracion local SQLSERVER_URL y desactivacion opcional de cobranza para pruebas; no se incorporan credenciales.
- Otras fases conservadas en bloque 2 con reglas heredadas y correccion del JOIN de fuente PAYER que triplicaba pagos.

## 2. Hitos de codigo

| Commit | Cambio |
|---|---|
| f6f8bbc | Base atomica Buyer, evidencia y conversion sobre Semana 9. |
| b82b4a7 | Reincorporacion de otras fases y conciliacion basica. |
| eaea9b0 | Pruebas operativas de Germain y opciones SET del procedimiento. |
| 281537d | Segundo hecho y reporte de inversion. |
| 7d3709b | Confiabilidad de inversion, separacion de semillas y limpieza literal. |
| 5214f7e | CPL por nivel y valores no calculables. |
| c5f42c2 | Sincronizacion Buyer canonica y transaccion entre ambos hechos. |
| 42d10c2 | Prueba de fallo/rollback y guia de cierre. |
| bf4f8fb | Ejemplo .env y control de cobranza automatica. |
| ee29743 | Costos desconocidos en matriz de captacion; 27 tests aprobados. |

El historial conserva propuestas y archivos retirados. El informe Google Docs sigue sin modificar; su siguiente actualizacion es exclusivamente Buyer. Agente y PostgreSQL no se implementaron.

## 3. Limpieza de esta entrega

| Archivo o grupo anterior | Tratamiento y reemplazo |
|---|---|
| docs/PENDIENTES_BUYER_BD.md | Retirado: pruebas y limites consolidados en cierre/validacion. |
| docs/REVISION_BLOQUE1_CONFIABILIDAD.md | Retirado: borrador de parche superado por codigo publicado y guia de ejecucion. |
| docs/ENTREGA_GERMAIN_AVANCE.md | Retirado: evidencias consolidadas en cierre, recomendaciones conservadas en su guia por fase. |
| docs/GUIA_PRUEBAS_SEGUNDA_TABLA_HECHO_Y_REPORTE2.md | Retirado: orden y comprobaciones consolidados en ejecucion/validacion; se eliminan totales antiguos presentados como obligatorios. |
| semana9/04_pruebas_reglas_buyer.sql y 05_pruebas_operativas_germain.sql | Movidos a semana9/pruebas/; se conservan sus pruebas y se ajustan descripciones de catalogo. |
| Cuatro SQL en database/ raiz | Movidos a database/legacy_pre_buyer/ como referencia del esquema anterior. No son intercambiables con el paquete activo. |
| backend/src/scripts/test-certification-suite.ts | Retirado: usa columnas de hechos anteriores, IDs fijos y modificaciones de pagos. Version recuperable en ee29743; no se mantiene como certificacion vigente. |
| backend/src/scripts/run-etl.ts | Adaptado al servicio canonico Buyer; deja de cargar SQL legado. Se invoca como npm run etl:buyer desde backend. |
| Guias restantes | Reescritas para un unico estado vigente; informe futuro y agente distinguidos de la entrega validada. |

Se conservan init_oltp, init_mart y migracion_buyer porque cumplen rutas distintas; no son duplicados prescindibles. La limpieza solo afecta archivos del repositorio: no elimina ni altera datos de SQL Server.

## 4. Resultado y alcance

Evidencias de Daniel: 808 contactos, 682 utilizables y 311 conversiones; gastos OLTP/Mart 2 por S/150; rollback, bloqueo, reintento, sincronizacion repetida y reportes/exportaciones comprobados en el alcance acordado. El CSV final y la matriz corregida completaron los pendientes de interfaz.

Las recomendaciones LEAD/PAYER/CUSTOMER/TURNED siguen pendientes de implementacion por sus responsables. La ronda Buyer no certifica todo el sistema, todas las migraciones ni los datos reales del negocio. El nuevo CLI requiere conexion local y procedimientos instalados, igual que el servicio que reutiliza.

Comprobaciones de esta limpieza: 27 tests aprobados, compilaciones frontend/backend, 66 enlaces relativos y conservacion byte a byte de los cuatro SQL archivados. No se ejecuto el CLI contra una instancia SQL en el entorno de preparacion.

## 5. Ampliacion opcional de simulacion: 10k

- Agregados semana9/simulacion/08_poblamiento_buyer_10k.sql y 09_validacion_buyer_10k.sql, con guia docs/POBLAMIENTO_BUYER_10K.md.
- Cohorte adicional versionada de 10 000 personas, 8 500 utilizables, 2 550 conversiones historicas con solicitud/evento, 60 gastos por S/60 000 y multiples interacciones. Reejecucion sin duplicados; bloqueo y transaccion que incluyen ambos ETL canonicos. No purga datos anteriores.
- Costos y B3 se calculan desde gastos de campana/mes; no se asignan defaults al hecho. La validacion filtra V1, concilia por persona, gasto y periodo y conserva NULL para otras cohortes sin evidencia.
- No se modifican DDL, logica ETL, indicadores, backend ni otras fases. Las conversiones historicas masivas son fixtures de datos, no una nueva ruta operativa.
- Preparacion: analisis estatico T-SQL y reproduccion determinista de distribuciones/importes. Pendiente ejecutar 08/09 y comprobar API en SQL Server local; las evidencias previas de cierre corresponden al conjunto anterior.

## 6. Promedio de tiempo de conversion Buyer

- Corregida agregacion en backend/src/routes/report.routes.ts mediante buyerDurationMatrix.ts: suma de dias / cantidad de duraciones conocidas en cada nivel. Deja de sumar promedios redondeados.
- Grupos sin conversion conservan NULL y cero dias conocido conserva cero. Se conserva agrupacion por fuente/canal/sede, filtro temporal y alias anterior. Comparacion, tarjeta, matriz y exportaciones reciben el mismo promedio corregido.
- Pruebas de cantidades desiguales, subtotales, columnas, valores nulos, ceros, precision, API y regresion noviembre V1 (213 conversiones; aproximadamente 7,02 dias). No se modifican bases, ETL ni otros indicadores/fases. Pasos de actualizacion y SQL de contraste en docs/POBLAMIENTO_BUYER_10K.md, seccion 6.
