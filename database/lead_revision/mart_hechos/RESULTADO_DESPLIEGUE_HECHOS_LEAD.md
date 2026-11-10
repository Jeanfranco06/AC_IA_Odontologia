# Instalación de los cinco hechos de LEAD

**Resultado:** instalación autorizada y confirmada en `NexoSalud_Mart`, servidor `ANTHONY` (SQL Server `16.0.1000.6`), el 10 de noviembre de 2026 a las **00:39:55.142 de Lima** (05:39:55.142 UTC). La ejecución de SQLCMD tomó 1274 ms. El corte de carga fue 05:39:54.133 UTC. Se aplicó únicamente el ejecutor transaccional `08_APLICAR_HECHOS.sql`. Las dos bases principales quedaron `ONLINE`, `MULTI_USER`, `READ_WRITE` y con recuperación `FULL`. [Procedimiento aprobado y huellas](PRE_DESPLIEGUE_HECHOS_LEAD.md).

## Preflight y respaldo

- Las nueve huellas SHA-256 coincidieron dos veces. Las nueve dimensiones conservaron sus claves primarias y las tres funciones de corte coincidieron con las definiciones de QA. SQL Server resolvió las diez dependencias examinadas. Antes de instalar había cero de los cinco hechos nuevos y 31 FK habilitadas y confiables.
- El preflight final a las 00:39:53 mostró SQL Server Agent detenido, cero trabajos activos, cero bloqueos de usuario en ambas bases y el recurso `ETL_BUYER_SEMANA9` libre. El único cliente adicional observado era `SQLServerCEIP` inactivo en `master`, sin transacción. El reloj del servidor coincidió con Lima (UTC−05:00).
- Se tomó un respaldo fresco a las **00:38:18 de Lima** con `COPY_ONLY, CHECKSUM`. Ruta: `C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\Backup\Mart_LeadFactsVentana_61957492-703c-4407-9725-61cb2089fa1c.bak`. UUID `263C2393-1A51-429F-8E6C-26EF1F234933`, 10 567 680 bytes, LSN inicial `40000000364700001` y final `40000000365000001`.
- El respaldo pasó `RESTORE VERIFYONLY WITH CHECKSUM` y se restauró con archivos propios como `NexoSalud_Mart_LeadFactsVentanaRef`. La referencia pasó `DBCC CHECKDB` y sigue en línea sin los cinco hechos nuevos. Una consulta auxiliar de seguimiento agotó su tiempo de espera mientras corría el respaldo. La operación de respaldo y restauración completó con código 0, y el preflight posterior pasó antes de la instalación.

## Hechos nuevos y conciliación

| Hecho | Antes | Filas después | FK verificadas |
| --- | --- | ---: | ---: |
| `fact_oportunidades_lead` | Ausente | 0 | 5 |
| `fact_propuestas_aceptadas_lead` | Ausente | 0 | 3 |
| `fact_propuestas_rechazadas_lead` | Ausente | 0 | 4 |
| `fact_alternativas_aceptadas_lead` | Ausente | 0 | 6 |
| `fact_alternativas_rechazadas_lead` | Ausente | 0 | 7 |

Se confirmaron las cinco PK compuestas. Las **25 FK nuevas** coincidieron en tabla, columna y clave dimensional, y quedaron habilitadas y confiables. El Mart quedó con 56 FK en ese estado. `DBCC CHECKDB` pasó y `DBCC CHECKCONSTRAINTS` no devolvió infracciones.

| Fuente | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| OLTP | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Mart | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

La conciliación pasó dentro de la transacción y se repitió tras el `COMMIT` a las 00:39:55.291 de Lima. El recuento directo de la OLTP confirmó 310 solicitudes y 310 opciones sin resultados comerciales terminales, y cero propuestas. [Consulta de conciliación](03_COMPARAR_MEDIDAS.sql).

## Conservación de dimensiones y hechos anteriores

Las nueve dimensiones y los cinco hechos heredados coincidieron fila por fila, incluidas claves, atributos y medidas, con la referencia de la ventana antes y después de la confirmación. La comparación adicional contra la referencia dimensional histórica confirmó las sumas de todas las medidas numéricas no clave y las 31 relaciones originales. [Comparación de las 14 tablas](09_COMPARAR_CON_REFERENCIA.sql) · [Verificación de sumas del legado](../mart_dimensiones/05_PROTEGER_COMPARTIDAS_QA.sql).

| Hecho heredado | Filas antes y después |
| --- | ---: |
| `fact_captacion_buyer` | 449 |
| `fact_negociacion_lead` | 58 |
| `fact_gestion_payer` | 103 |
| `fact_atencion_customer` | 140 |
| `fact_seguimiento_turned` | 29 |

La OLTP se utilizó como origen de lectura. El despliegue se limitó a los cinco hechos nuevos y sus restricciones. Los componentes de BUYER, PAYER, CUSTOMER y TURNED se conservaron. El informe y el procedimiento quedan en `lead` local.
