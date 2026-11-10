# Preflight y despliegue de las dimensiones LEAD

**Corte del ensayo:** 9 de noviembre de 2026, hora del servidor en Lima. Al cerrar el ensayo, QA estaba aprobado y el Mart principal seguía sin las tres dimensiones nuevas. La autorización y la ejecución posteriores constan en el [informe de despliegue](RESULTADO_DESPLIEGUE_MART_LEAD.md).

El trabajo se mantiene en la rama local `lead`, con `HEAD` y `origin/lead` en `97a8a15` al inicio del corte. El paquete dimensional forma parte de los cambios locales sin seguimiento. Se conservaron los archivos previos y los resultados del [primer ensayo](RESULTADOS_PRUEBAS.md). Véanse el [diagnóstico original](DIAGNOSTICO_DIMENSIONAL.md) y la [auditoría de BUYER y PAYER](../auditoria_dimensional/DIAGNOSTICO_INTEGRACION.md).

## Estado del entorno

- Instancia predeterminada `ANTHONY` (conexión `localhost`), SQL Server `16.0.1000.6`. Ambas bases estaban `ONLINE`, `MULTI_USER`, `READ_WRITE`, con recuperación `FULL` y cotejamiento `Modern_Spanish_CI_AS`. La cuenta usada tenía permisos de respaldo y restauración. Espacio libre en C: 222 GiB. Tamaños asignados de OLTP y Mart: 80 y 16 MB.
- Las seis dimensiones compartidas tenían clave primaria y carecían de índices únicos por clave natural. No se encontraron duplicados naturales ni miembros de clave 0. Las 31 claves foráneas del Mart estaban habilitadas y eran confiables. `Dim_Hora` tenía 125 filas.
- No se observaron sesiones de aplicación ni ETL activos en el corte. SQL Server Agent estaba detenido y no se encontraron los procedimientos de carga consultados. Volver a revisar antes de abrir la ventana, incluidas cargas externas. El bloqueo de BUYER cubre únicamente procesos que lo tomen sobre la misma base.
- La comparación bidireccional de filas entre la referencia anterior y la reciente coincidió para las 19 tablas dimensionales y de hechos. La OLTP del ensayo aportó 29 fechas y 7 horarios observados. Tenía 310 registros en `HistorialOpciones` y cero en los catálogos de promociones y motivos y en las propuestas económicas. Los resultados dimensionales coinciden con el ensayo previo.
- `fact_captacion_buyer` aún carece de `id_persona`. El hecho revisado de inversión y el ETL canónico de BUYER siguen pendientes. LEAD pudo instalar sus dimensiones sin esas dependencias. Se probó únicamente la compatibilidad de los fragmentos dimensionales de Daniel, incluida inversión, con rollback.
- Las tres dimensiones y los tres hechos nuevos publicados por PAYER siguen ausentes en el Mart principal. La auditoría de la rama remota `payer` (`14b4e0b` en este corte) mantiene abiertos problemas de claves, duplicación y restricciones. Este ensayo conserva el contrato compartido, pero no certifica el ETL nuevo de PAYER. La suma histórica negativa de `tiempo_validacion_minuto` (−36 720) del hecho heredado de PAYER fue idéntica en ambas copias.

## Respaldos y copias del ensayo

Respaldos completos `COPY_ONLY, CHECKSUM`, finalizados a las 23:43:44 del servidor, en `C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\Backup\`. Ambos pasaron `RESTORE VERIFYONLY WITH CHECKSUM` y se restauraron con `MOVE` a archivos nuevos, sin reemplazar bases.

| Base | Archivo | UUID del respaldo | Tamaño |
| --- | --- | --- | ---: |
| `NexoSaludDB` | `OLTP_LeadPreQA_C5A3A50A-DCC4-4F14-BBE8-9ABA523AEEA9.bak` | `04F5E032-E73C-499C-B96D-2C815713BE42` | 11 616 256 bytes |
| `NexoSalud_Mart` | `Mart_LeadPreQA_739A33C3-AFFB-455A-9AAE-FA9F047E0678.bak` | `C7D82F53-CF2B-456A-9DFC-6BBF7B55541C` | 7 749 632 bytes |

Las copias de trabajo fueron `NexoSaludDB_LeadPreQA` y `NexoSalud_Mart_LeadPreQA`. Se preservó `NexoSalud_Mart_LeadPreRef` como referencia sin migrar, restaurada del mismo respaldo del Mart. `DBCC CHECKDB` pasó en las tres copias.

## Resultado del ensayo reciente

| Dimensión | Nivel o grano | Antes | Después | Miembros de control |
| --- | --- | ---: | ---: | ---: |
| `Dim_Tiempo` | Día → Mes → Trimestre → Año | 46 | 47 | 1 |
| `Dim_Servicio` | Servicio odontológico | 12 | 13 | 1 |
| `Dim_Canal` | Nombre de canal | 8 | 9 | 1 |
| `Dim_Sede` | Sede → Zona | 3 | 4 | 1 |
| `Dim_Negociador` | Negociador | 4 | 5 | 1 |
| `Dim_Profesional` | Profesional → Especialidad | 4 | 5 | 1 |
| `Dim_Promocion` | Promoción aplicada | Ausente | 4 | 4 |
| `Dim_MotivoRechazo` | Motivo → Tipo, con ámbito | Ausente | 3 | 3 |
| `Dim_Horario` | Día de semana × turno × intervalo | Ausente | 10 | 3 |

- **Conciliación:** pasaron claves naturales, calendario, atributos de origen, miembros de control y grano de horario. Las fechas ya presentes se reutilizaron. Los cuatro miembros de promoción y los tres de motivo son controles. Los escenarios sintéticos comprobaron promoción de catálogo y texto histórico, motivos por ámbito y categoría, días distintos con el mismo intervalo y horarios preferidos, ofrecidos y parciales. Los datos sintéticos se revirtieron.
- **Integridad:** se compararon 19 objetos preexistentes con la referencia. Se conservaron las claves sustitutas y los atributos protegidos, el esquema de columnas y el mapeo y estado de las 31 relaciones verificadas. `Dim_Hora` permaneció independiente y sus 125 filas coincidieron.
- **Idempotencia:** se repitió dos veces la carga. Coincidieron las nueve huellas SHA-256 de filas completas ordenadas por clave. También se repitió el paquete completo (553 ms) en la copia ya migrada. Mantuvo los conteos, pasó la conciliación y `DBCC CHECKCONSTRAINTS` no mostró infracciones.
- **Rollback:** el error previsto `54718` revirtió DDL y carga en una misma sesión. Antes y después del fallo había cero tablas nuevas y cero índices `UX_Lead_*`. Otra prueba revirtió la carga y los datos sintéticos en ambas copias. Las secuencias `IDENTITY` pueden avanzar en QA aun con rollback.
- **Concurrencia y guarda:** una segunda sesión tomó `ETL_BUYER_SEMANA9` en la misma OLTP de QA. La carga simultánea devolvió `54712` y las nueve huellas quedaron iguales. Un par incorrecto de bases fue rechazado con `54710` antes del DDL.
- **Tiempos del ensayo:** instalación atómica 541 ms, conciliación 450 ms, reejecuciones 581 y 558 ms y comparación 1968 ms. SQL Server avisó que omitió nulos en agregados de la conciliación. La conciliación completó con código 0. El ejecutor completo también devolvió código 0.

| Hecho heredado | Filas antes y después | Ejemplos de sumas idénticas |
| --- | ---: | --- |
| `fact_captacion_buyer` | 449 | Contactos 805, conversiones 310 |
| `fact_negociacion_lead` | 58 | Cohorte evaluable 310, conversión PAYER a 14 días 124 |
| `fact_gestion_payer` | 103 | Pagos registrados 372, importe total 57 300 |
| `fact_atencion_customer` | 140 | Citas evaluables 219, atenciones realizadas 185 |
| `fact_seguimiento_turned` | 29 | Seguimientos registrados 80, efectivos 80 |

El comparador comprobó las filas completas y todas las sumas de columnas numéricas que no son claves en estos hechos. Para ver las sumas completas en SQLCMD usar `-y 0` y evitar `-W` en la misma llamada.

## Alcance exacto y archivos

La instalación agrega seis índices únicos por clave natural en las dimensiones compartidas y crea `Dim_Promocion`, `Dim_MotivoRechazo` y `Dim_Horario` con sus claves, índices y restricciones. La carga inserta miembros de control y filas por clave natural. Puede actualizar nombres de servicio, canal y negociador, nombre y zona de sede, y odontólogo y especialidad. Conserva claves existentes, calendario, categoría y procedimiento de servicio, tipo de medio y distrito. Las fuentes de la OLTP se leen y las escrituras se limitan a las nueve dimensiones del Mart.

La guarda admite en el servidor `ANTHONY` el par principal exacto con `AutorizarPrincipal=SI` y `ProvocarError=NO`. El ejecutor `09` integra el DDL de `01` y la carga `03` en una transacción externa. La carga usa `02` para las fuentes y el bloqueo de BUYER en la OLTP. `04` concilia datos y `05` compara el Mart con su referencia. `06`, `07` y `08` se reservan para QA. Los ajustes del paquete se limitaron a las guardas, la ejecución atómica y los controles de prueba y comparación.

| Archivo | SHA-256 validado |
| --- | --- |
| `00_CONTEXTO.sql` | `03FEEF47E28CF4742BD382FB3177A15C16E10FB4486C09F09CCB2D5F408DFDDB` |
| `01_MIGRAR_DIMENSIONES.sql` | `507280CE3B3435877FFB8F4BF85279460ADE4B0634A016E0A11B9D9F85DA48B6` |
| `02_FUENTES.sql` | `09F53F99CE7C1227D6BC46C4B9BD4B915BBBF085A3B58E3C93D4D65565FE77BE` |
| `03_CARGAR_DIMENSIONES.sql` | `05D8433C82DA36A545136CCB24D7BF208081AC28888D5BE007A850F5AD300077` |
| `04_VALIDAR_DIMENSIONES.sql` | `C836D095C221364478A35C552ADCDEC6E3BD988C250448E2DFC053D1E91F7003` |
| `05_PROTEGER_COMPARTIDAS_QA.sql` | `4F94213A467AEF9B66B5EFEDABD91A8D59A46E61C94F1D96C950291844DB55CD` |
| `09_APLICAR_DIMENSIONES.sql` | `B04CECCB978B5EDDC7F4529485C11DEB876E04C361115030BD08BC9929FE2593` |

## Ventana principal pendiente de autorización

1. Coordinar con Daniel y el equipo PAYER la suspensión de cargas y escritores del Mart, y mantener estable la OLTP durante la extracción y la conciliación. Revisar sesiones, trabajos y procesos externos. Repetir el inventario y contrastar esquema, claves, restricciones, dependencias, disponibilidad, espacio y fuentes con este corte. Ante deriva de esquema, conflictos o pérdida potencial, detenerse y repetir el ensayo con copias actuales. Si varían solo las filas de origen, reconciliar expectativas con la OLTP de la ventana.
2. Verificar las huellas con `Get-FileHash database/lead_revision/mart_dimensiones/*.sql -Algorithm SHA256`. Tomar un nuevo respaldo del Mart, verificarlo y restaurar una referencia de la ventana. El respaldo del ensayo queda como evidencia. Si cambió la OLTP, tomar también un respaldo fresco de origen para repetir el ensayo según corresponda. Guardar registros de ejecución y respaldo fuera del repositorio.
3. Ejecutar el siguiente bloque desde la raíz, con la ventana controlada y tras la autorización. Usa un archivo de respaldo único y aborta si la referencia de la ventana ya existe. En ese caso se debe revisar su identidad y resolver el nombre antes de continuar.

```powershell
$db = @('-S','localhost','-E','-C','-I','-b','-f','65001')
$bak = "C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\Backup\Mart_LeadVentana_$([guid]::NewGuid()).bak"
$data = 'C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\DATA'
$backupSql = @"
IF @@SERVERNAME <> N'ANTHONY' OR DB_ID(N'NexoSalud_Mart') IS NULL
 OR DB_ID(N'NexoSalud_Mart_LeadVentanaRef') IS NOT NULL
 THROW 54773,'Servidor, Mart o referencia de ventana inesperados.',1;
BACKUP DATABASE [NexoSalud_Mart] TO DISK=N'$bak' WITH COPY_ONLY,CHECKSUM;
RESTORE VERIFYONLY FROM DISK=N'$bak' WITH CHECKSUM;
RESTORE DATABASE [NexoSalud_Mart_LeadVentanaRef] FROM DISK=N'$bak'
 WITH CHECKSUM, RECOVERY,
 MOVE N'NexoSalud_Mart' TO N'$data\NexoSalud_Mart_LeadVentanaRef.mdf',
 MOVE N'NexoSalud_Mart_log' TO N'$data\NexoSalud_Mart_LeadVentanaRef_log.ldf';
DBCC CHECKDB(NexoSalud_Mart_LeadVentanaRef) WITH NO_INFOMSGS;
"@
sqlcmd @db -d master -Q $backupSql
if ($LASTEXITCODE -ne 0) { throw 'Fallo al verificar o restaurar el respaldo de ventana.' }

$mart = $db + @('-d','NexoSalud_Mart','-v','Origen=NexoSaludDB',
  'AutorizarPrincipal=SI','ProvocarError=NO','Referencia=NexoSalud_Mart_LeadVentanaRef')
$p = 'database/lead_revision/mart_dimensiones'
$timer = [Diagnostics.Stopwatch]::StartNew()
sqlcmd @mart -i "$p/09_APLICAR_DIMENSIONES.sql"
if ($LASTEXITCODE -ne 0) { throw 'Fallo de instalación. Mantener la ventana y verificar el estado.' }
"Instalación completada en $($timer.ElapsedMilliseconds) ms"
sqlcmd @mart -i "$p/04_VALIDAR_DIMENSIONES.sql"
if ($LASTEXITCODE -ne 0) { throw 'Fallo de conciliación. Mantener la ventana.' }
sqlcmd @mart -y 0 -i "$p/05_PROTEGER_COMPARTIDAS_QA.sql"
if ($LASTEXITCODE -ne 0) { throw 'Fallo de conservación. Mantener la ventana.' }
sqlcmd @db -d NexoSalud_Mart -Q "DBCC CHECKDB WITH NO_INFOMSGS; DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;"
if ($LASTEXITCODE -ne 0) { throw 'Fallo en las comprobaciones de integridad.' }
```

4. Revisar la salida de `DBCC CHECKCONSTRAINTS` y exigir cero filas de infracciones, además del código de salida. Registrar respaldo, duración, salida de `04`, comparación de `05` y estado de las nueve dimensiones, los hechos y las relaciones. La evidencia de reejecución sin duplicados proviene de QA y la unicidad se comprueba en el Mart tras la instalación. Reabrir la ventana operativa solo tras conformidad de todos los controles.
5. Ante fallo previo al `COMMIT`, SQLCMD termina la sesión y SQL Server revierte la transacción pendiente. Confirmar estado y ausencia de cambios contra la referencia. Si falló la conexión cerca del `COMMIT`, determinar primero si se confirmó. Ante una discrepancia posterior, conservar el bloqueo operativo y la evidencia, informar y validar una recuperación en otra base. Una restauración sobre el Mart requeriría autorización separada y evaluación de escrituras posteriores y, si procede, de los respaldos de log disponibles. Mantener intacta la OLTP.

## Siguiente fase de LEAD

Los cinco grupos del cuadro aprobado quedan reservados para los hechos futuros: F1 oportunidades (M1–M2), F2 propuestas aceptadas (M3), F3 propuestas rechazadas (M4–M5), F4 alternativas aceptadas (M6) y F5 alternativas rechazadas (M7–M8). Ver [medidas y fórmulas L1–L3](README.md#medidas-reservadas-para-la-siguiente-fase). Falta definir y conciliar esos hechos con una oportunidad por solicitud, una propuesta por raíz y una alternativa por opción, aplicando los roles de tiempo y horario y mostrando «No calculable» ante denominador nulo o cero. El hecho heredado `fact_negociacion_lead` conserva su definición.
