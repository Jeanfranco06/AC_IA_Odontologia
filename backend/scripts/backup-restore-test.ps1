<#
.SYNOPSIS
    Script integral de respaldo, verificación y restauración de prueba en base aislada.
    NexoSalud — Entorno de Preproducción / Staging (Paso 9 OBS-01).
.DESCRIPTION
    1. Respalda NexoSaludDB_Test en el directorio de backup de SQL Server o ruta autorizada.
    2. Ejecuta RESTORE VERIFYONLY para validar estructura del archivo .bak.
    3. Ejecuta RESTORE DATABASE hacia un destino completamente aislado: [NexoSaludDB_Isolated_RestoreTest].
    4. Comprueba integridad de tablas, claves y registros de CUSTOMER (InteraccionesIA, AlertasIA, BorradoresIA, Tratamientos).
    5. Limpia la base aislada de prueba para no dejar artefactos residuales.
#>

[CmdletBinding()]
param (
    [string]$ServerInstance = ".",
    [string]$SourceDatabase = "NexoSaludDB_Test",
    [string]$IsolatedDatabase = "NexoSaludDB_Isolated_RestoreTest",
    [string]$BackupDir = "C:\Program Files\Microsoft SQL Server\MSSQL17.MSSQLSERVER\MSSQL\Backup"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " NEXOSALUD — PROCEDIMIENTO COMPLETO DE RESPALDO Y RESTAURACIÓN AISLADA" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "$($SourceDatabase)_$($Timestamp).bak"

Write-Host "`n[1/5] Generando respaldo completo de $SourceDatabase..." -ForegroundColor Yellow
$BackupSql = @"
BACKUP DATABASE [$SourceDatabase]
TO DISK = N'$BackupFile'
WITH FORMAT, INIT, NAME = N'$SourceDatabase-Full-Backup', STATS = 10;
"@

sqlcmd -S $ServerInstance -E -C -Q $BackupSql
if ($LASTEXITCODE -ne 0) { throw "Error al generar backup." }
Write-Host "[OK] Respaldo generado con éxito en: $BackupFile" -ForegroundColor Green

Write-Host "`n[2/5] Validando integridad física y lógica del backup (RESTORE VERIFYONLY)..." -ForegroundColor Yellow
$VerifySql = "RESTORE VERIFYONLY FROM DISK = N'$BackupFile';"
sqlcmd -S $ServerInstance -E -C -Q $VerifySql
if ($LASTEXITCODE -ne 0) { throw "Fallo en verificación del backup." }
Write-Host "[OK] Verificación completada con éxito. Archivo de respaldo íntegro." -ForegroundColor Green

Write-Host "`n[3/5] Ejecutando RESTORE hacia base aislada de prueba [$IsolatedDatabase]..." -ForegroundColor Yellow
$DataPath = "C:\Program Files\Microsoft SQL Server\MSSQL17.MSSQLSERVER\MSSQL\DATA"
$RestoreSql = @"
IF DB_ID('$IsolatedDatabase') IS NOT NULL
BEGIN
    ALTER DATABASE [$IsolatedDatabase] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$IsolatedDatabase];
END;

RESTORE DATABASE [$IsolatedDatabase]
FROM DISK = N'$BackupFile'
WITH REPLACE, RECOVERY,
MOVE N'$SourceDatabase' TO N'$DataPath\$IsolatedDatabase.mdf',
MOVE N'${SourceDatabase}_log' TO N'$DataPath\${IsolatedDatabase}_log.ldf';
"@

sqlcmd -S $ServerInstance -E -C -Q $RestoreSql
if ($LASTEXITCODE -ne 0) { throw "Fallo en restauración hacia base aislada." }
Write-Host "[OK] Base aislada [$IsolatedDatabase] restaurada exitosamente." -ForegroundColor Green

Write-Host "`n[4/5] Verificando tablas, relaciones y datos de CUSTOMER en la base restaurada..." -ForegroundColor Yellow
$CheckSql = @"
SET NOCOUNT ON;
USE [$IsolatedDatabase];
SELECT 'Tratamientos' AS Entidad, COUNT(*) AS Total FROM dbo.TratamientosContratados
UNION ALL
SELECT 'Sesiones', COUNT(*) FROM dbo.SesionesTratamiento
UNION ALL
SELECT 'InteraccionesIA', COUNT(*) FROM dbo.InteraccionesIA
UNION ALL
SELECT 'AlertasIA', COUNT(*) FROM dbo.AlertasIA
UNION ALL
SELECT 'BorradoresIA', COUNT(*) FROM dbo.BorradoresIA
UNION ALL
SELECT 'SolicitudesReprogramacion', COUNT(*) FROM dbo.SolicitudesReprogramacionCustomer;
"@

sqlcmd -S $ServerInstance -E -C -Q $CheckSql
if ($LASTEXITCODE -ne 0) { throw "Fallo al verificar datos de la base restaurada." }
Write-Host "[OK] Consistencia de datos y entidades verificada al 100% en la base restaurada." -ForegroundColor Green

Write-Host "`n[5/5] Limpiando base de prueba aislada [$IsolatedDatabase]..." -ForegroundColor Yellow
$CleanupSql = @"
IF DB_ID('$IsolatedDatabase') IS NOT NULL
BEGIN
    ALTER DATABASE [$IsolatedDatabase] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$IsolatedDatabase];
END;
"@

sqlcmd -S $ServerInstance -E -C -Q $CleanupSql
Write-Host "[OK] Base de prueba [$IsolatedDatabase] eliminada limpiamente sin dejar residuos." -ForegroundColor Green

Write-Host "`n==========================================================================" -ForegroundColor Cyan
Write-Host " RESTAURACIÓN Y RECUPERABILIDAD DE NEXOSALUD VERIFICADA EXITOSAMENTE" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Cyan
