# Preflight y despliegue de los cinco hechos LEAD

**Corte de preparación:** ensayo aprobado el 10 de noviembre de 2026. La autorización y la ejecución posteriores constan en el [informe de instalación](RESULTADO_DESPLIEGUE_HECHOS_LEAD.md). El punto de partida fue `31433da772b0f9ca2f17337c0ee6f578d9338307` en `lead`. Esta preparación conserva el grano, las PK compuestas, las 25 FK y las reglas de M1–M8. Se añadieron guardas por entorno, un ejecutor transaccional, comparaciones con la referencia y controles operativos. [Diseño y evidencia del ensayo anterior](README.md).

## Estado del Mart principal y fuentes

- En `ANTHONY`, SQL Server `16.0.1000.6`, las dos bases estaban `ONLINE`, `MULTI_USER`, `READ_WRITE`, con recuperación `FULL` y cotejamiento `Modern_Spanish_CI_AS`. Espacio libre en C: aproximadamente 222 GiB.
- Están las nueve dimensiones con sus PK sustitutas esperadas. Las 31 FK del Mart están habilitadas y son confiables. El Mart conserva cero de los cinco hechos nuevos. Los cinco hechos heredados y sus sumas coinciden con la referencia de la instalación dimensional. [Resultado de la instalación dimensional](../mart_dimensiones/RESULTADO_DESPLIEGUE_MART_LEAD.md).
- Las tres funciones de corte son funciones de tabla en línea, con `@corte_utc datetime2(7)`. Sus definiciones coinciden con QA y las diez referencias registradas por SQL Server se resuelven. Oportunidades depende de su historial, eventos de etapa, captaciones, campañas, etapas e interacciones. Propuestas y alternativas usan sus historiales y los motivos.
- Las 310 solicitudes y las 310 opciones carecen de resultado comercial terminal. La OLTP tiene cero propuestas. Antes de cualquier unión dimensional, las funciones devolvieron cero oportunidades, cero raíces y 310 opciones sin resultado. El mismo estado se confirmó en las copias recientes.
- El reloj local del servidor coincide con Lima (UTC−05:00). Se conserva la fecha de negocio grabada y se usa UTC para seleccionar observaciones. El ensayo reciente repitió los casos de medianoche. La función de oportunidades interpreta eventos e interacciones con el desplazamiento del servidor. Si aparece un escritor que almacena UTC en campos de negocio `datetime2`, conciliar primero la convención de la fuente.
- SQL Server Agent estaba detenido. El único cliente adicional observado era `SQLServerCEIP` inactivo en `master`, sin transacción. Hubo cero trabajos activos y cero bloqueos de usuarios en las bases principales. El recurso `ETL_BUYER_SEMANA9` estaba libre en la OLTP. Este bloqueo solo coordina consumidores que lo usan en esa misma base. La ventana debe mantener pausados los escritores y ETL externos.

## Respaldos y resultado del nuevo ensayo

Respaldos de las **00:30:06 de Lima**, guardados en `C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\Backup\`. Ambos usaron `COPY_ONLY, CHECKSUM`, pasaron `RESTORE VERIFYONLY WITH CHECKSUM` y se restauraron con archivos propios.

| Base | Archivo | UUID | Bytes |
| --- | --- | --- | ---: |
| `NexoSaludDB` | `OLTP_LeadFactsQA_8a400e4a-4a85-4106-bfc8-ba6b371befe2.bak` | `8116FAC1-F13E-41BC-B01D-60849D08AB23` | 11 616 256 |
| `NexoSalud_Mart` | `Mart_LeadFactsQA_ac8cdcae-2c82-46dc-aa6d-f79f788bd09b.bak` | `25F0CE1A-2E7D-48C6-8D24-687954E58D0E` | 10 567 680 |

El par de trabajo fue `NexoSaludDB_LeadFactsQA` → `NexoSalud_Mart_LeadFactsQA`. Se conservó `NexoSalud_Mart_LeadFactsRef` sin migrar. Las tres restauraciones pasaron `DBCC CHECKDB`.

| Hecho nuevo | Filas reales | FK habilitadas y confiables |
| --- | ---: | ---: |
| `fact_oportunidades_lead` | 0 | 5 |
| `fact_propuestas_aceptadas_lead` | 0 | 3 |
| `fact_propuestas_rechazadas_lead` | 0 | 4 |
| `fact_alternativas_aceptadas_lead` | 0 | 6 |
| `fact_alternativas_rechazadas_lead` | 0 | 7 |

| Prueba | Resultado |
| --- | --- |
| Instalación y reejecución del ejecutor completo | Confirmadas en 1076 ms y 613 ms. Cinco PK y 25 FK nuevas confiables. |
| Conciliación independiente M1–M8 | OLTP y Mart coincidieron en `0,0,0,0,0,0,0,0`. |
| Caso sintético reversible y reejecución | Ambos lados dieron `1,1,2,2,1,1,2,1` y se conservaron las combinaciones de claves. |
| Reclasificación | Ambos lados dieron `1,1,3,1,0,2,1,0`. Se retiraron los grupos obsoletos. Tras el rollback, quedaron cero filas nuevas y no persistieron los catálogos ni propuestas de prueba. |
| Rollback de instalación | Se inyectó el error `54937` solo en QA, después de crear, cargar y comparar, antes del `COMMIT` externo. La sesión terminó y quedaron cero de las cinco tablas. |
| Guarda de principal | `AutorizarPrincipal=NO` en el par principal devolvió `54900` antes de iniciar una transacción. |
| Integridad y conservación | `DBCC CHECKCONSTRAINTS` sin infracciones, 56 FK confiables en total. Las nueve dimensiones y los cinco hechos anteriores coincidieron por filas completas ordenadas por PK con la referencia. |

Los hechos heredados conservaron filas y todas sus medidas. BUYER 449, LEAD 58, PAYER 103, CUSTOMER 140 y TURNED 29. La comparación previa contra la referencia dimensional también verificó las sumas de cada columna numérica no clave. Los avisos de agregación de nulos del caso sintético no impidieron la conciliación.

Para repetir la prueba sintética en las copias recientes, ejecutar [12_PROBAR_COPIAS_RECIENTES_QA.ps1](12_PROBAR_COPIAS_RECIENTES_QA.ps1) desde la raíz. El ejecutor limita ambos destinos a QA y sustituye en memoria solo la guarda histórica de la carga dimensional para que reconozca las copias recientes. El caso revierte las escrituras de prueba en OLTP y Mart.

## Huellas SHA-256 de los scripts de la ventana

Comparar con `Get-FileHash database/lead_revision/mart_hechos/*.sql -Algorithm SHA256` antes de ejecutar.

| Archivo | SHA-256 |
| --- | --- |
| `00_CONTEXTO_HECHOS.sql` | `944BA1C67EEE5874CB4BE15A50595C4BEA954C95FA8747B342617CF640684CF9` |
| `01_CREAR_HECHOS.sql` | `A2A2CF8880574FC3FC6FD6CB07724A57EC392C934A6BD9909D7FADE38C61742D` |
| `02_POBLAR_HECHOS.sql` | `9066A1933EC7E0E1C3907895F8705ED09611FFD8DACD53EF4D42B82FD1A6D753` |
| `03_COMPARAR_MEDIDAS.sql` | `B8D928CCECF9759A8704507588C6DC61FBCB2766814B2BABA8D1CBE85533A224` |
| `04_VALIDAR_HECHOS.sql` | `130F1782AFED058484E4F6EE2AFD65DADE4FA3E4E823B027C0994286BC9B1DF0` |
| `08_APLICAR_HECHOS.sql` | `84EED72D9429895C09C989BB3053B5377F81C94510FE1929590849CD95336961` |
| `09_COMPARAR_CON_REFERENCIA.sql` | `51B0E089E6062B270ED54830F9C67198941289D8C972E93D23CD013541A67F65` |
| `10_VERIFICAR_ESTRUCTURA.sql` | `248C0E1B2A6966A4634AC3D2E29293D8A400E8C448A3E0B3FF8C21B655679BF2` |
| `11_PREFLIGHT_PRINCIPAL.sql` | `B11AE021654458AD9AE8784330BE072EA69F51C15EE3B856B77D0D0BCBC1C1BA` |

## Ventana principal, solo después de la autorización

1. Coordinar con los equipos la pausa de escritores, trabajos y ETL en ambas bases. Confirmar espacio y permisos para un respaldo y una restauración nuevos. Revisar huellas, procesos y resultados de la fuente. Ante cambios de resultados, de esquema o de horario, detenerse, revisar la evidencia y repetir QA con nuevas copias.
2. Desde la raíz del repositorio, ejecutar la inspección de solo lectura. Comparar con el corte de este informe y con los conteos y sumas de la referencia histórica.

```powershell
$p = 'database/lead_revision/mart_hechos'
$d = 'database/lead_revision/mart_dimensiones'
$db = @('-S','localhost','-E','-C','-I','-b','-f','65001')
sqlcmd @db -d NexoSaludDB -i "$p/11_PREFLIGHT_PRINCIPAL.sql"
if ($LASTEXITCODE) { throw 'Preflight inesperado.' }
sqlcmd @db -d NexoSalud_Mart -y 0 -v Origen=NexoSaludDB AutorizarPrincipal=SI ProvocarError=NO Referencia=NexoSalud_Mart_LeadVentanaRef -i "$d/05_PROTEGER_COMPARTIDAS_QA.sql"
if ($LASTEXITCODE) { throw 'Cambió el legado.' }
```

3. Manteniendo la ventana, tomar un respaldo fresco del Mart y restaurar la referencia exacta. El respaldo OLTP de QA ya se verificó. Si cambia la fuente, repetir QA con un respaldo nuevo de ambas bases antes de seguir. Registrar el nombre, fecha y UUID del respaldo de ventana.

```powershell
$root = 'C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL'
$bak = "$root\Backup\Mart_LeadFactsVentana_$([guid]::NewGuid()).bak"
$q = @"
IF @@SERVERNAME<>N'ANTHONY' OR DB_ID(N'NexoSalud_Mart') IS NULL
 OR DB_ID(N'NexoSalud_Mart_LeadFactsVentanaRef') IS NOT NULL
 THROW 54948,'Servidor, Mart o referencia de ventana inesperados.',1;
BACKUP DATABASE [NexoSalud_Mart] TO DISK=N'$bak' WITH COPY_ONLY,CHECKSUM;
RESTORE VERIFYONLY FROM DISK=N'$bak' WITH CHECKSUM;
RESTORE DATABASE [NexoSalud_Mart_LeadFactsVentanaRef] FROM DISK=N'$bak' WITH CHECKSUM,RECOVERY,
 MOVE N'NexoSalud_Mart' TO N'$root\DATA\NexoSalud_Mart_LeadFactsVentanaRef.mdf',
 MOVE N'NexoSalud_Mart_log' TO N'$root\DATA\NexoSalud_Mart_LeadFactsVentanaRef_log.ldf';
DBCC CHECKDB(NexoSalud_Mart_LeadFactsVentanaRef) WITH NO_INFOMSGS;
SELECT s.backup_set_uuid,s.backup_finish_date,s.backup_size,s.first_lsn,s.last_lsn
FROM msdb.dbo.backupset s JOIN msdb.dbo.backupmediafamily m ON m.media_set_id=s.media_set_id
WHERE m.physical_device_name=N'$bak' AND s.database_name=N'NexoSalud_Mart';
"@
sqlcmd @db -d master -Q $q
if ($LASTEXITCODE) { throw 'Fallo de respaldo, verificación o restauración.' }
```

4. Repetir el preflight inmediatamente antes de la instalación. Comparar primero las 14 tablas con la referencia. Ejecutar solo `08_APLICAR_HECHOS.sql`. Este ejecutor incluye `01` y `02` en una transacción externa, concilia M1–M8 al mismo corte y verifica las nueve dimensiones y los cinco hechos heredados antes de confirmar.

```powershell
sqlcmd @db -d NexoSaludDB -i "$p/11_PREFLIGHT_PRINCIPAL.sql"
if ($LASTEXITCODE) { throw 'El preflight final cambió.' }
$mart = $db + @('-d','NexoSalud_Mart','-v','Origen=NexoSaludDB',
  'AutorizarPrincipal=SI','Referencia=NexoSalud_Mart_LeadFactsVentanaRef')
sqlcmd @mart -i "$p/09_COMPARAR_CON_REFERENCIA.sql"
if ($LASTEXITCODE) { throw 'La referencia no coincide.' }
$cronometro = [Diagnostics.Stopwatch]::StartNew()
sqlcmd @mart -i "$p/08_APLICAR_HECHOS.sql"
if ($LASTEXITCODE) { throw 'Verificar el estado antes de cualquier recuperación.' }
"Instalación completada en $($cronometro.ElapsedMilliseconds) ms"
foreach ($script in @('04_VALIDAR_HECHOS.sql','09_COMPARAR_CON_REFERENCIA.sql','10_VERIFICAR_ESTRUCTURA.sql')) {
    sqlcmd @mart -i "$p/$script"
    if ($LASTEXITCODE) { throw "Falló $script. Mantener cerrada la ventana." }
}
sqlcmd @db -d NexoSalud_Mart -Q "DBCC CHECKDB WITH NO_INFOMSGS;"
if ($LASTEXITCODE) { throw 'Fallo en CHECKDB.' }
$infracciones = sqlcmd @db -d NexoSalud_Mart -W -h -1 -Q "SET NOCOUNT ON; DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS, NO_INFOMSGS;"
if ($LASTEXITCODE -or @($infracciones | Where-Object { $_.Trim() }).Count) {
    $infracciones
    throw 'Revisar restricciones antes de reabrir la ventana.'
}
```

5. Registrar corte y hora de confirmación, cinco PK, 25 FK nuevas, resultados M1–M8 y filas conservadas. Conservar la referencia sin cambios. Reabrir los escritores y las cargas solo después de completar los controles. Las pruebas sintéticas y los ejecutores QA quedan fuera de la ventana principal.

## Recuperación

- Ante un error antes del `COMMIT`, SQLCMD termina y SQL Server revierte la transacción pendiente. Conservar la salida y verificar catálogo y sesiones desde otra conexión. Comparar las dimensiones y los cinco hechos heredados con `09` y confirmar el estado de las tablas nuevas.
- Ante pérdida de conexión cerca del `COMMIT`, determinar primero si quedó confirmada la transacción. Si se confirma pero falla un control, mantener cerrada la ventana, conservar la evidencia y ensayar la restauración en otra base con el respaldo de la ventana. Antes de considerar reemplazar el Mart, revisar las escrituras posteriores y la disponibilidad de respaldos de log. La restauración de la base principal requiere autorización separada.
