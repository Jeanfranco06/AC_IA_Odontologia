# Ejecutar desde la raíz del repositorio. Solo opera sobre copias.
param([switch]$VentanaNueva)
$ErrorActionPreference = 'Stop'
$OutputEncoding=[Text.UTF8Encoding]::new($false)
$qaMart = if ($VentanaNueva) { 'NexoSalud_Mart_LeadPreQA' } else { 'NexoSalud_Mart_LeadQA' }
$qaOrigen = if ($VentanaNueva) { 'NexoSaludDB_LeadPreQA' } else { 'NexoSaludDB_MartLeadQA' }
$qaRef = if ($VentanaNueva) { 'NexoSalud_Mart_LeadPreRef' } else { 'NexoSalud_Mart_LeadRef' }
$folder = 'database/lead_revision/mart_dimensiones'
$connection = @('-S','localhost','-E','-C','-I','-b','-d',$qaMart,'-f','65001','-W','-s','|')
$variables = @("Origen=$qaOrigen","Referencia=$qaRef","AutorizarPrincipal=NO")

function RunSql([string]$script, [string]$fail = 'NO') {
    $duration=[Diagnostics.Stopwatch]::StartNew()
    & sqlcmd @connection -v @variables "ProvocarError=$fail" -i "$folder/$script"
    if ($LASTEXITCODE -ne 0) { throw "Falló $script ($LASTEXITCODE)" }
    "$script completado en $($duration.ElapsedMilliseconds) ms."
}

function Snapshot {
    $query = @"
SET NOCOUNT ON;
DECLARE @sql nvarchar(max)=N'';
SELECT @sql+=N'SELECT '''+t.name+N''' AS Dimension, CONVERT(char(64),
 HASHBYTES(''SHA2_256'',(SELECT * FROM dbo.'+QUOTENAME(t.name)+N' ORDER BY '+
 QUOTENAME(COL_NAME(t.object_id,1))+N' FOR JSON PATH, INCLUDE_NULL_VALUES)),2) AS Huella;'
FROM sys.tables t
WHERE t.name IN ('Dim_Tiempo','Dim_Servicio','Dim_Canal','Dim_Sede','Dim_Negociador','Dim_Profesional',
 'Dim_Promocion','Dim_MotivoRechazo','Dim_Horario')
ORDER BY t.name;
EXEC sys.sp_executesql @sql;
"@
    $result = & sqlcmd @connection -h -1 -Q $query
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo calcular la huella de la copia.' }
    return @($result | Where-Object { $_ -match '^Dim_[^|]+\|[A-F0-9]{64}$' } | Sort-Object)
}

if ($VentanaNueva) {
    $ddlQuery = "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.tables WHERE name IN ('Dim_Horario','Dim_Promocion','Dim_MotivoRechazo'); SELECT COUNT(*) FROM sys.indexes WHERE name LIKE 'UX_Lead[_]%';"
    $ddlBefore = & sqlcmd @connection -h -1 -Q $ddlQuery
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar el DDL inicial.' }
    $failed = & sqlcmd @connection -v @variables ProvocarError=SI -i "$folder/09_APLICAR_DIMENSIONES.sql" 2>&1
    if ($LASTEXITCODE -eq 0 -or ($failed -join ' ') -notmatch '54718') { $failed; throw 'No se provocó el rollback de instalación.' }
    $ddlAfter = & sqlcmd @connection -h -1 -Q $ddlQuery
    if ($LASTEXITCODE -ne 0 -or (Compare-Object @($ddlBefore) @($ddlAfter))) { throw 'No se revirtió el DDL del paquete.' }
    "Rollback de instalación: DDL y carga revertidos; conteos DDL antes y después: $($ddlBefore -join ', ')."
}
RunSql '09_APLICAR_DIMENSIONES.sql'
RunSql '04_VALIDAR_DIMENSIONES.sql'
$before = @(Snapshot)
if ($before.Count -ne 9) { throw 'Se esperaban nueve huellas.' }
RunSql '03_CARGAR_DIMENSIONES.sql'
RunSql '03_CARGAR_DIMENSIONES.sql'
if (Compare-Object $before @(Snapshot)) { throw 'La reejecución modificó dimensiones.' }
'Reejecución x2: las nueve huellas completas coinciden.'
RunSql '05_PROTEGER_COMPARTIDAS_QA.sql'
RunSql '07_PROBAR_CASOS_QA.sql'

$failure = @"
:ON ERROR EXIT
BEGIN TRANSACTION;
:r .\database\lead_revision\mart_dimensiones\06_DATOS_QA.sql
GO
:r .\database\lead_revision\mart_dimensiones\03_CARGAR_DIMENSIONES.sql
GO
"@
$output = $failure | & sqlcmd @connection -v @variables ProvocarError=SI 2>&1
if ($LASTEXITCODE -eq 0 -or ($output -join ' ') -notmatch '54718') { $output; throw 'No se reprodujo la falla esperada.' }
if (Compare-Object $before @(Snapshot)) { throw 'La falla dejó cambios en el Mart.' }
$noFixture = "IF EXISTS (SELECT 1 FROM ${qaOrigen}.dbo.MotivosRechazoLead WHERE codigo LIKE 'QA-MART-%') THROW 54745,'Quedaron datos sintéticos en OLTP QA.',1;"
& sqlcmd @connection -Q $noFixture
if ($LASTEXITCODE -ne 0) { throw 'No se confirmó el rollback de OLTP QA.' }
'Falla 54718: se revirtieron las escrituras de dimensiones y los casos sintéticos.'

# Mantener el mismo recurso que usa Daniel en otra sesión de la OLTP QA.
$job = Start-Job -ArgumentList $qaOrigen -ScriptBlock {
    param($qaOrigen)
    & sqlcmd -S localhost -E -C -b -d $qaOrigen -Q "
SET NOCOUNT ON;
IF DB_NAME()<>'$qaOrigen' THROW 54749,'Solo prueba.',1;
BEGIN TRAN;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0;
IF @lock<0 THROW 54749,'No se obtuvo el bloqueo de prueba.',1;
WAITFOR DELAY '00:00:13';
ROLLBACK;"
    if ($LASTEXITCODE -ne 0) { throw 'Falló la sesión que simula BUYER.' }
}
try {
    $held = $false
    for ($i=0; $i -lt 10 -and -not $held; $i++) {
        $probe = & sqlcmd -S localhost -E -C -b -d $qaOrigen -h -1 -W -Q "
SET NOCOUNT ON; SELECT APPLOCK_TEST('public','ETL_BUYER_SEMANA9','Exclusive','Session');"
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo inspeccionar el bloqueo.' }
        $held = @($probe | Where-Object { $_.Trim() -eq '0' }).Count -gt 0
        if (-not $held) { Start-Sleep -Milliseconds 250 }
    }
    if (-not $held) { throw 'El bloqueo de prueba no se hizo visible.' }
    $blocked = & sqlcmd @connection -v @variables ProvocarError=NO -i "$folder/03_CARGAR_DIMENSIONES.sql" 2>&1
    if ($LASTEXITCODE -eq 0 -or ($blocked -join ' ') -notmatch '54712') { $blocked; throw 'El ETL no respetó el bloqueo compartido.' }
    'Concurrencia: el ETL rechazó la carga simultánea con 54712.'
} finally {
    if ($job.State -eq 'Running') { Stop-Job $job }
    Remove-Job $job
}
if (Compare-Object $before @(Snapshot)) { throw 'La carga bloqueada dejó cambios.' }

# Probar únicamente los tres MERGE conformados de Daniel y su lógica temporal.
$canonical = Get-Content -Raw -LiteralPath 'database/buyer_revision/semana9/poblamiento_merge_mart.sql'
$from = $canonical.IndexOf('    MERGE NexoSalud_Mart.dbo.Dim_Tiempo AS dim')
$to = $canonical.IndexOf('-- 7. Dim_TipoPersona', $from)
if ($from -lt 0 -or $to -le $from) { throw 'No se encontró el bloque canónico.' }
$fragment = $canonical.Substring($from,$to-$from).Replace('NexoSalud_Mart',$qaMart)
$laterFrom = $canonical.IndexOf('-- 9. Dim_Profesional')
$laterTo = $canonical.IndexOf('-- 11. Dim_Pasarela', $laterFrom)
$later = $canonical.Substring($laterFrom,$laterTo-$laterFrom).Replace('NexoSalud_Mart',$qaMart)
$qa = @"
:ON ERROR EXIT
IF DB_NAME() <> N'$qaOrigen' THROW 54746,'Solo OLTP de prueba.',1;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @corte datetime2=SYSDATETIME(),@lock int;
EXEC @lock=sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
IF @lock<0 THROW 54747,'No se obtuvo el bloqueo BUYER en la prueba.',1;
SELECT CAST('20420106' AS datetime2) AS fecha_captacion,CAST(NULL AS datetime2) AS fecha_conversion INTO #DatosBuyer;
$fragment
$later
IF EXISTS (
 SELECT KeySede,Distrito FROM ${qaRef}.dbo.Dim_Sede
 EXCEPT SELECT KeySede,Distrito FROM ${qaMart}.dbo.Dim_Sede)
 THROW 54748,'El bloque BUYER sobrescribió Distrito.',1;
ROLLBACK;
SELECT 'Bloque temporal y dimensiones compartidas de Daniel compatibles' AS Resultado;
GO
"@
$qa | & sqlcmd -S localhost -E -C -I -b -d $qaOrigen -f 65001 -W
if ($LASTEXITCODE -ne 0) { throw 'Falló el bloque dimensional de Daniel.' }
if (Compare-Object $before @(Snapshot)) { throw 'La prueba de Daniel dejó cambios.' }
$investment = Get-Content -Raw -LiteralPath 'database/buyer_revision/semana9/06_segunda_tabla_hecho_inversion_buyer.sql'
$invFrom = $investment.IndexOf('        MERGE dbo.Dim_Tiempo AS dim')
$invTo = $investment.IndexOf('        SELECT g.id_gasto,dt.KeyTiempo', $invFrom)
$inv = $investment.Substring($invFrom,$invTo-$invFrom).Replace('NexoSaludDB',$qaOrigen)
$qaInvestment = @"
:ON ERROR EXIT
IF DB_NAME()<>'$qaMart' THROW 54746,'Solo Mart de prueba.',1;
SET XACT_ABORT ON;
BEGIN TRAN;
SELECT CAST('20420107' AS date) AS fecha, MIN(id_canal) AS id_canal, 0 AS id_fuente, 0 AS id_campana,
 CAST('Sin campaña QA' AS varchar(150)) AS Campana,CAST('QA' AS varchar(100)) AS TipoOrigen
INTO #GastosOrigen FROM ${qaOrigen}.dbo.Canales;
$inv
ROLLBACK;
SELECT 'Bloque dimensional de inversión BUYER compatible' AS Resultado;
GO
"@
$qaInvestment | & sqlcmd @connection
if ($LASTEXITCODE -ne 0) { throw 'Falló el bloque dimensional de inversión BUYER.' }
if (Compare-Object $before @(Snapshot)) { throw 'La prueba de inversión dejó cambios.' }
& sqlcmd @connection -Q 'DBCC CHECKDB WITH NO_INFOMSGS;'
if ($LASTEXITCODE -ne 0) { throw 'CHECKDB no pasó.' }
'Pruebas de dimensiones completas.'
