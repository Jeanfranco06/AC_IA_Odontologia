# Instalación de las nueve dimensiones de LEAD

**Resultado:** instalación confirmada en `NexoSalud_Mart`, servidor `ANTHONY` (SQL Server `16.0.1000.6`), el 9 de noviembre de 2026 a las 23:55:37.947 de Lima (10 de noviembre a las 04:55:37.947 UTC). El comando que ejecutó la migración y la carga en una sola transacción terminó en 702 ms. Las dos bases principales finalizaron `ONLINE`, `MULTI_USER` y `READ_WRITE`. La evidencia del ensayo y las huellas de los siete archivos aprobados permanecen en el [procedimiento de la ventana](PRE_DESPLIEGUE_MART_LEAD.md).

## Preflight y respaldo

- Se cotejaron dos veces las siete huellas SHA-256 del paquete. El inventario de objetos, columnas, índices, módulos y restricciones de ambas bases coincidió con las copias de QA. Las 20 tablas originales del Mart coincidieron fila por fila con la referencia anterior y con la referencia de esta ventana. Las 13 fuentes de la OLTP usadas en la carga coincidieron con QA en conteos y proyecciones relevantes antes y después.
- SQL Server Agent estaba detenido. El único cliente adicional observado era `SQLServerCEIP` inactivo en `master`, sin transacción abierta. No hubo sesiones de aplicación ni bloqueos de usuario en las bases principales durante los controles. El primer intento de preflight se detuvo antes del respaldo porque la comprobación confundió el código de retorno de `sp_executesql` (0) con el resultado de `APPLOCK_TEST`. Una consulta directa en `NexoSaludDB` comprobó que el recurso estaba disponible (1) y no existía la referencia de la ventana. Se repitió el preflight sin alterar los archivos aprobados.
- Respaldo completo nuevo del Mart a las **23:54:44 de Lima**, `COPY_ONLY, CHECKSUM`, en `C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\Backup\Mart_LeadVentana_85f4c5be-b750-44ef-aaaa-327078210be2.bak`. UUID `5330C451-25D4-4C20-9E8B-D47AD6F7768F`, 7 749 632 bytes, LSN inicial `40000000279800001` y final `40000000280100001`.
- El respaldo pasó `RESTORE VERIFYONLY WITH CHECKSUM` y se restauró con archivos propios en `NexoSalud_Mart_LeadVentanaRef`. La copia pasó `DBCC CHECKDB` y se conserva sin migrar. El [respaldo de OLTP usado en el ensayo](PRE_DESPLIEGUE_MART_LEAD.md#respaldos-y-copias-del-ensayo) sirvió de referencia para la validación. En la ventana se leyó la OLTP principal sin modificarla.

## Conciliación y conteos

| Dimensión | Antes | Después | Controles |
| --- | ---: | ---: | ---: |
| `Dim_Tiempo` | 46 | 47 | 1 |
| `Dim_Servicio` | 12 | 13 | 1 |
| `Dim_Canal` | 8 | 9 | 1 |
| `Dim_Sede` | 3 | 4 | 1 |
| `Dim_Negociador` | 4 | 5 | 1 |
| `Dim_Profesional` | 4 | 5 | 1 |
| `Dim_Promocion` | Ausente | 4 | 4 |
| `Dim_MotivoRechazo` | Ausente | 3 | 3 |
| `Dim_Horario` | Ausente | 10 | 3 |

La fuente aportó 29 fechas, todas conciliadas, y siete horarios observados. No había promociones de catálogo, promociones de texto ni motivos de catálogo. Las seis dimensiones compartidas ganaron un miembro de control cada una. La comparación por clave sustituta y fila completa mostró **cero filas anteriores modificadas** en esas seis tablas. Se confirmaron seis índices únicos compartidos activos y las **31 claves foráneas** originales habilitadas y confiables.

[04_VALIDAR_DIMENSIONES.sql](04_VALIDAR_DIMENSIONES.sql) y [02_FUENTES.sql](02_FUENTES.sql) comprueban calendario, catálogos, miembros de control, claves naturales y grano de horario. SQL Server emitió avisos de nulos omitidos en agregados durante la conciliación, que completó con código 0. [05_PROTEGER_COMPARTIDAS_QA.sql](05_PROTEGER_COMPARTIDAS_QA.sql) comparó las claves, los atributos protegidos, las columnas y el mapeo y estado de las relaciones de 19 objetos. La comparación complementaria con `EXCEPT` en ambos sentidos y `COUNT_BIG` cubrió las 14 tablas originales fuera del alcance, incluida `Dim_Hora` (125 filas). `DBCC CHECKDB` pasó y `DBCC CHECKCONSTRAINTS` devolvió cero infracciones.

Consultas de conciliación reproducibles desde la raíz del repositorio. Estos comandos validan y comparan el estado actual con la referencia de la ventana.

```powershell
$p = 'database/lead_revision/mart_dimensiones'
$sql = @('-S','localhost','-E','-C','-I','-b','-f','65001','-d','NexoSalud_Mart')
$vars = @('Origen=NexoSaludDB','AutorizarPrincipal=SI','ProvocarError=NO',
  'Referencia=NexoSalud_Mart_LeadVentanaRef')
sqlcmd @sql -v @vars -i "$p/04_VALIDAR_DIMENSIONES.sql"
sqlcmd @sql -v @vars -y 0 -i "$p/05_PROTEGER_COMPARTIDAS_QA.sql"
sqlcmd @sql -Q "DBCC CHECKDB WITH NO_INFOMSGS; DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;"
```

## Hechos conservados

Todos los registros completos coincidieron en ambas direcciones. Las siguientes sumas antes y después corresponden a todas las columnas numéricas no clave verificadas en cada hecho.

| Hecho | Filas antes y después | Sumas iguales antes y después |
| --- | ---: | --- |
| `fact_captacion_buyer` | 449 | `contacto_registrado` 805, `contacto_utilizable` 680, `conversion_lead` 310, `tiempo_conversion_dia` 0, `costo_atribuido_captacion` 0 |
| `fact_negociacion_lead` | 58 | `cohorte_evaluable` 310, `conversion_payer_14_dia` 124, `solicitud_requiere_respuesta` 310, `respuesta_util_15_min` 310, `negociacion_finalizada` 110, `negociacion_abandonada` 45, `leads_en_negociacion` 155 |
| `fact_gestion_payer` | 103 | `pago_registrado` 372, `pago_validado` 330, `pago_rechazado` 18, `conversion_customer` 330, `importe_total_cobro` 57 300, `costo_transaccion` 1 944, `tiempo_validacion_minuto` −36 720 |
| `fact_atencion_customer` | 140 | `cita_evaluable` 219, `atencion_realizada` 185, `cita_inasistencia` 34, `tiempo_sillon_dental_minuto` 9 855, `atencion_finalizada_conforme` 185 |
| `fact_seguimiento_turned` | 29 | `seguimiento_registrado` 80, `seguimiento_efectivo` 80, `incidencia_reportada` 0, `incidencia_resuelta_24_hora` 0, `retorno_cohorte_90_dia` 32, `paciente_elegible_retorno` 80 |

BUYER, PAYER, CUSTOMER y TURNED conservaron sus hechos, medidas y relaciones. El hecho heredado de LEAD también quedó intacto. La suma negativa de PAYER ya estaba presente en la referencia. El único ETL ejecutado en esta ventana fue el dimensional. Los cinco hechos nuevos se instalaron en una ventana posterior. [Informe de instalación de los hechos](../mart_hechos/RESULTADO_DESPLIEGUE_HECHOS_LEAD.md).
