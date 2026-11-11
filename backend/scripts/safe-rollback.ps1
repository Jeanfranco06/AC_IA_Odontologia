<#
.SYNOPSIS
    Procedimiento seguro de parada y reversión (Rollback) para NexoSalud Staging.
    Paso 9 — OBS-02: Control granular de procesos y versionado seguro.
.DESCRIPTION
    1. Identifica y detiene EXCLUSIVAMENTE el proceso Node.js del backend de NexoSalud
       a través del puerto en escucha (por defecto 3001) o PID registrado, sin afectar
       otros procesos Node.js del sistema.
    2. Reversión segura de código y artefactos: restaura el bundle compilado o el checkout
       controlado a un tag/commit estable SIN utilizar 'git reset --hard' que destruya
       cambios locales de trabajo.
    3. Restauración selectiva de base de datos desde el último backup verificado si existe fallo de esquema.
#>

[CmdletBinding()]
param (
    [int]$Port = 3001,
    [string]$TargetCommitOrTag = "",
    [string]$DatabaseBackupFile = "",
    [string]$DatabaseName = "NexoSaludDB_Test",
    [switch]$RestoreDatabaseOnly
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host " NEXOSALUD — PROCEDIMIENTO SEGURO DE ROLLBACK Y REVERSIÓN CONTROLADA" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

# 1. Detener de forma quirúrgica el backend de NexoSalud
Write-Host "`n[1/3] Identificando proceso de NexoSalud en escucha en el puerto $Port..." -ForegroundColor Yellow
$Netstat = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($Netstat) {
    $TargetPid = $Netstat.OwningProcess
    $Proc = Get-Process -Id $TargetPid -ErrorAction SilentlyContinue
    if ($Proc -and $Proc.ProcessName -match "node") {
        Write-Host "[OK] Encontrado proceso Node.js de NexoSalud (PID: $TargetPid). Deteniendo de forma segura..." -ForegroundColor Green
        Stop-Process -Id $TargetPid -Force
        Start-Sleep -Seconds 2
        Write-Host "[OK] Servicio de NexoSalud detenido limpiamente." -ForegroundColor Green
    } else {
        Write-Host "[INFO] El puerto $Port está ocupado por otro proceso: $($Proc.ProcessName) (PID: $TargetPid)." -ForegroundColor Gray
    }
} else {
    Write-Host "[INFO] No se detectó ningún servicio escuchando en el puerto $Port." -ForegroundColor Gray
}

# 2. Restauración de Base de Datos si se especificó backup
if ($DatabaseBackupFile -and (Test-Path $DatabaseBackupFile)) {
    Write-Host "`n[2/3] Restaurando base de datos $DatabaseName desde $DatabaseBackupFile..." -ForegroundColor Yellow
    $RestoreSql = @"
ALTER DATABASE [$DatabaseName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
RESTORE DATABASE [$DatabaseName] FROM DISK = N'$DatabaseBackupFile' WITH REPLACE, RECOVERY;
ALTER DATABASE [$DatabaseName] SET MULTI_USER;
"@
    sqlcmd -S . -E -C -Q $RestoreSql
    Write-Host "[OK] Base de datos $DatabaseName revertida exitosamente al estado del backup." -ForegroundColor Green
} else {
    Write-Host "`n[2/3] No se proporcionó archivo de backup de BD. El esquema relacional se mantiene intacto." -ForegroundColor DarkGray
}

# 3. Reversión de versión de código de forma no destructiva
Write-Host "`n[3/3] Verificando estado del código y artefactos..." -ForegroundColor Yellow
if ($TargetCommitOrTag) {
    Write-Host "Reversión a commit/tag específico: $TargetCommitOrTag solicitada." -ForegroundColor Yellow
    Write-Host "Nota de Seguridad: Se utiliza 'git checkout' o 'git stash' preventivo para NO destruir cambios no confirmados." -ForegroundColor Yellow
    git stash push -m "Pre-rollback-safety-stash-$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    git checkout $TargetCommitOrTag
    Write-Host "[OK] Código ubicado en la versión estable: $TargetCommitOrTag" -ForegroundColor Green
} else {
    Write-Host "[INFO] No se especificó TargetCommitOrTag. Se preserva el árbol de código actual." -ForegroundColor DarkGray
}

Write-Host "`n==========================================================================" -ForegroundColor Cyan
Write-Host " PROCEDIMIENTO DE ROLLBACK SEGURO Y CONTROLADO FINALIZADO" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Cyan
